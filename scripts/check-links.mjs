#!/usr/bin/env node
// Link checker for the built site (run `npm run build` first).
//
//   node scripts/check-links.mjs              internal links, anchors, images, assets
//   node scripts/check-links.mjs --external   also request every external URL
//                                             (except example.com/.net/.org placeholders)
//
// Checks every HTML file in dist/ (all locales): href/src/srcset/poster/
// data-full targets, #anchors (same page and cross page), CSS url() assets,
// canonical/hreflang/og:image URLs on the site origin, that each page links to
// its counterpart in every other locale, and that every <img> has an alt.
// Environment: OUT_DIR (default dist), BASE_PATH, SITE_URL (as for the build).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson, CONTENT_DIR } from '../src/lib/content.mjs';

const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');
const EXTERNAL = process.argv.includes('--external');
const site = readJson(path.join(CONTENT_DIR, 'site.json'));
const SITE_URL = (process.env.SITE_URL || site.url).replace(/\/$/, '');
const LOCALES = site.locales.map((l) => l.code);

if (!fs.existsSync(OUT)) {
  console.error(`No ${path.relative(ROOT, OUT)}/ folder. Run npm run build first.`);
  process.exit(1);
}

function listFiles(dir, ext) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const urlPathOf = (file) => `${BASE_PATH}/${path.relative(OUT, file).split(path.sep).join('/')}`.replace(/index\.html$/, '');

const idCache = new Map();
function idsIn(file) {
  if (!idCache.has(file)) {
    const html = fs.readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => decode(m[1]))));
  }
  return idCache.get(file);
}

// Map a site path ("/en/services/") to a file in dist, or null.
function resolveFile(sitePath) {
  let p = sitePath;
  if (BASE_PATH) {
    if (!p.startsWith(`${BASE_PATH}/`) && p !== BASE_PATH) return null;
    p = p.slice(BASE_PATH.length) || '/';
  }
  let rel;
  try {
    rel = decodeURIComponent(p);
  } catch {
    return null;
  }
  const full = path.join(OUT, rel);
  if (!full.startsWith(OUT)) return null;
  const candidates = rel.endsWith('/') ? [path.join(full, 'index.html')] : [full, path.join(full, 'index.html'), `${full}.html`];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

const BUILT_ROOTS = new Set([...fs.readdirSync(OUT)]);
function isBuiltPath(p) {
  if (BASE_PATH && p !== BASE_PATH && !p.startsWith(`${BASE_PATH}/`)) return false;
  const first = p.slice(BASE_PATH.length).split(/[/?#]/)[1] || '';
  return first === '' || BUILT_ROOTS.has(first);
}

const errors = [];
const warnings = [];
const external = new Map(); // url -> Set(pages)
const perLocale = Object.fromEntries(LOCALES.map((c) => [c, { pages: 0, links: 0 }]));
let checked = 0;

function checkTarget(raw, fromFile, kind) {
  const from = path.relative(OUT, fromFile);
  const url = decode(raw.trim());
  if (!url) return errors.push(`${from}: empty ${kind}`);
  if (/^(javascript|data):/i.test(url)) return url.startsWith('data:') ? undefined : errors.push(`${from}: ${kind} uses javascript: URL`);
  if (url.startsWith('mailto:')) {
    if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}(\?.*)?$/i.test(url)) errors.push(`${from}: malformed ${url}`);
    return;
  }
  if (url.startsWith('tel:')) {
    if (!/^tel:\+?[0-9-]{7,}$/.test(url)) errors.push(`${from}: malformed ${url}`);
    return;
  }
  if (/^https?:\/\//i.test(url)) {
    // Same-origin URLs are checked against dist/ when the build produces them;
    // others (e.g. the parish's existing /files/ uploads) stay on the live host.
    const local = url.slice(SITE_URL.length) || '/';
    if ((url.startsWith(`${SITE_URL}/`) || url === SITE_URL) && isBuiltPath(local)) return checkTarget(local, fromFile, kind);
    if (kind === 'form action') return; // POST-only endpoints (PayPal) answer GET with 404
    if (!external.has(url)) external.set(url, new Set());
    external.get(url).add(from);
    return;
  }
  if (url.startsWith('//')) return errors.push(`${from}: protocol-relative URL ${url}`);

  checked++;
  const base = `http://x${urlPathOf(fromFile)}`;
  const target = new URL(url, base);
  const file = url.startsWith('#') ? fromFile : resolveFile(target.pathname);
  if (!file) return errors.push(`${from}: broken ${kind} → ${url}`);
  const hash = target.hash.slice(1);
  if (hash && file.endsWith('.html') && !idsIn(file).has(decodeURIComponent(hash))) {
    errors.push(`${from}: missing anchor → ${url}`);
  }
}

const htmlFiles = listFiles(OUT, '.html');
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(OUT, file);
  const locale = rel.split(path.sep)[0];
  if (perLocale[locale]) perLocale[locale].pages++;
  const before = checked + external.size;

  for (const m of html.matchAll(/<(a|link|area)\s[^>]*?href="([^"]*)"/g)) checkTarget(m[2], file, 'link');
  for (const m of html.matchAll(/<(img|script|iframe|source|video|audio|track)\s[^>]*?\ssrc="([^"]*)"/g)) checkTarget(m[2], file, m[1] === 'img' ? 'image' : m[1]);
  for (const m of html.matchAll(/\s(?:srcset|imagesrcset)="([^"]*)"/g)) {
    for (const part of m[1].split(',')) checkTarget(part.trim().split(/\s+/)[0], file, 'srcset image');
  }
  for (const m of html.matchAll(/\s(?:poster|data-full)="([^"]*)"/g)) checkTarget(m[1], file, 'image');
  for (const m of html.matchAll(/<meta\s[^>]*?property="og:image"[^>]*?content="([^"]*)"/g)) checkTarget(m[1], file, 'og:image');
  for (const m of html.matchAll(/<form\s[^>]*?action="([^"]*)"/g)) checkTarget(m[1], file, 'form action');
  for (const m of html.matchAll(/<img\s[^>]*>/g)) if (!/\salt="/.test(m[0])) errors.push(`${rel}: <img> without alt: ${m[0].slice(0, 120)}`);
  for (const m of html.matchAll(/\shref="#([^"]+)"/g)) {
    if (!idsIn(file).has(decode(m[1]))) errors.push(`${rel}: missing anchor → #${m[1]}`);
  }

  // Locale counterparts: every localized page must link to each other locale.
  if (LOCALES.includes(locale)) {
    const pagePath = urlPathOf(file).slice(BASE_PATH.length + locale.length + 1);
    for (const other of LOCALES.filter((c) => c !== locale)) {
      const counterpart = `${BASE_PATH}/${other}${pagePath}`;
      if (!resolveFile(counterpart)) errors.push(`${rel}: no ${other} version (${counterpart})`);
      if (!html.includes(`hreflang="${other}"`)) errors.push(`${rel}: missing hreflang="${other}"`);
      if (!new RegExp(`class="lang-switch__link"[^>]*href="${counterpart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"|href="${counterpart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*class="lang-switch__link"`).test(html)) {
        errors.push(`${rel}: language switch does not link to ${counterpart}`);
      }
    }
    perLocale[locale].links += checked + external.size - before;
  }
}

for (const file of listFiles(OUT, '.css')) {
  const css = fs.readFileSync(file, 'utf8');
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (!m[1].startsWith('data:')) checkTarget(m[1], file, 'CSS url()');
  }
}

for (const file of [path.join(OUT, 'sitemap.xml')]) {
  if (!fs.existsSync(file)) {
    errors.push('sitemap.xml missing');
    continue;
  }
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/(?:<loc>|href=")([^<"]+)/g)) checkTarget(m[1], file, 'sitemap URL');
}

// ---------------------------------------------------------------- external

let reserved = 0;
async function checkExternal() {
  const SOFT = /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com)$/; // block automated requests
  const RESERVED = /(^|\.)(example\.(com|net|org)|[^.]+\.example)$/; // RFC 2606 placeholder domains
  const urls = [...external.keys()].filter((url) => !RESERVED.test(new URL(url).hostname));
  reserved = external.size - urls.length;
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++];
      const host = new URL(url).hostname;
      try {
        let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (link check)' } });
        if (res.status >= 400) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (link check)' } });
        if (res.status >= 400) {
          const msg = `${url} → HTTP ${res.status} (on ${[...external.get(url)].slice(0, 2).join(', ')})`;
          (SOFT.test(host) || res.status === 429 || res.status === 403 ? warnings : errors).push(msg);
        }
      } catch (e) {
        warnings.push(`${url} → ${e.cause?.code || e.name} (could not connect from this machine)`);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

if (EXTERNAL) await checkExternal();

const summary = LOCALES.map((c) => `${c}: ${perLocale[c].pages} pages, ${perLocale[c].links} links`).join(' · ');
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  console.error(`Link check failed (${errors.length}):\n  ${[...new Set(errors)].join('\n  ')}`);
  process.exit(1);
}
console.log(`Links OK — ${htmlFiles.length} HTML files (${summary}); ${checked} internal targets resolved; ${external.size} external URLs ${EXTERNAL ? `checked${reserved ? ` (${reserved} placeholder example.* URLs skipped)` : ''}` : 'skipped (use --external)'}.`);
