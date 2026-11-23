#!/usr/bin/env node
// Language-fit QA for the built static site (run `npm run build` first).
//
// Loads every HTML page under each locale folder in dist/ (e.g. dist/en/,
// dist/ru/) at viewports 360, 768, and 1280, and flags:
//   - horizontal/vertical overflow on leaf text elements
//     (scrollWidth/Height > clientWidth/Height)
//   - conservative overlaps between visible text-containing elements
//
// Checks text carriers (elements with their own text nodes / heading-like
// tags), not layout shells — so decorative overflow:hidden (e.g. page-header
// ::after) does not false-positive. Horizontal overflow is the main gate.
//
// Skips decorative/hidden nodes ([hidden], .visually-hidden, .sprite, svg,
// zero-size, opacity:0, [aria-hidden=true] descendants) and intentional
// scrollers / overlays (textarea, [data-lightbox], .lightbox, .drawer /
// .drawer__panel, dialog, .nav__dropdown, .lang-menu__list, [data-skip-fit],
// overflow:auto/scroll containers). Vertical overflow only when CSS clips or
// white-space:nowrap; absolute dropdowns that inflate scrollHeight are ignored.
//
//   node scripts/check-language-fit.mjs
//   npm run check-language-fit
//
// Exit 1 if any issues. Environment: OUT_DIR (default dist), CHROME_PATH
// (default /usr/local/bin/google-chrome), PORT (optional fixed port).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../src/lib/content.mjs';

const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');
const VIEWPORTS = [360, 768, 1280];
const VIEWPORT_HEIGHT = 900;
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

if (!fs.existsSync(OUT)) {
  console.error(`No ${path.relative(ROOT, OUT)}/ folder. Run npm run build first.`);
  process.exit(1);
}

function listHtml(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listHtml(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** Locale codes discovered from dist/<code>/ folders that contain HTML. */
function discoverLocales() {
  return fs
    .readdirSync(OUT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => listHtml(path.join(OUT, name)).length > 0)
    .filter((name) => !['assets', 'logo', 'images', 'fonts', 'css', 'js'].includes(name))
    .sort();
}

function urlPathFor(file) {
  return '/' + path.relative(OUT, file).split(path.sep).join('/');
}

function resolveChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function loadPuppeteer() {
  try {
    return (await import('puppeteer-core')).default;
  } catch {
    // Allow one-shot runs without a local install.
    const { createRequire } = await import('node:module');
    const { execSync } = await import('node:child_process');
    console.log('puppeteer-core not installed locally; fetching via npx…');
    execSync('npm install --no-save puppeteer-core@24', { cwd: ROOT, stdio: 'inherit' });
    return createRequire(pathToFileURL(path.join(ROOT, 'package.json')))('puppeteer-core');
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const raw = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.normalize(path.join(OUT, raw));
      if (!target.startsWith(OUT)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        target = path.join(target, 'index.html');
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        return res.end('Not found');
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache'
      });
      fs.createReadStream(target).pipe(res);
    });
    const preferred = process.env.PORT ? Number(process.env.PORT) : 0;
    server.listen(preferred, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

/** In-page probe: overflow + conservative text overlaps. */
function pageProbe() {
  // Subpixel / font-metrics slack. Horizontal overflow is the primary signal.
  const OVERFLOW_X_TOLERANCE = 2;
  const OVERFLOW_Y_TOLERANCE = 4;
  const OVERLAP_MIN_AREA = 48;
  const OVERLAP_MIN_RATIO = 0.25;

  // Intentional scroll / overlay regions — document exclusions in script header.
  const SKIP_OVERFLOW_SEL = [
    'textarea',
    '[data-lightbox]',
    '.lightbox',
    '.drawer',
    '.drawer__panel',
    'dialog',
    '[data-skip-fit]',
    '.nav__dropdown',
    '.lang-menu__list'
  ].join(', ');

  function isSkippedDecorative(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest('[hidden], [aria-hidden="true"], .visually-hidden, .sprite, svg')) return true;
    if (el.matches('svg, script, style, link, meta, noscript, template, br, hr, img, picture, source, video, audio, canvas, iframe')) {
      return true;
    }
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
    if (Number(style.opacity) === 0) return true;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return true;
    return false;
  }

  function isIntentionalScroller(el) {
    if (el.matches(SKIP_OVERFLOW_SEL) || el.closest(SKIP_OVERFLOW_SEL)) return true;
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowX) || /(auto|scroll)/.test(style.overflowY)) return true;
    return false;
  }

  function clipsOverflow(style, axis) {
    const value = axis === 'x' ? style.overflowX : style.overflowY;
    return value === 'hidden' || value === 'clip' || value === 'scroll' || value === 'auto';
  }

  /** Absolute/fixed kids inflate scrollHeight without clipping visible text (nav dropdowns). */
  function excessExplainedByOutOfFlow(el, deltaY) {
    if (deltaY <= 0) return false;
    const parentRect = el.getBoundingClientRect();
    let maxBottom = parentRect.bottom;
    for (const child of el.querySelectorAll('*')) {
      const st = getComputedStyle(child);
      if (st.position !== 'absolute' && st.position !== 'fixed') continue;
      const r = child.getBoundingClientRect();
      if (r.height < 1) continue;
      maxBottom = Math.max(maxBottom, r.bottom);
    }
    return maxBottom - parentRect.bottom >= deltaY - 2;
  }

  function visibleText(el) {
    return (el.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function hasOwnText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.textContent.replace(/\s+/g, '').length) return true;
    }
    return false;
  }

  function cssPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 6) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += `#${CSS.escape(cur.id)}`;
        parts.unshift(part);
        break;
      }
      if (cur.classList.length) {
        part += '.' + [...cur.classList].slice(0, 2).map((c) => CSS.escape(c)).join('.');
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  }

  function clipSnippet(text) {
    const t = text.replace(/\s+/g, ' ').trim();
    return t.length > 80 ? `${t.slice(0, 77)}…` : t;
  }

  const LAYOUT_TAGS = new Set([
    'section',
    'header',
    'footer',
    'main',
    'nav',
    'article',
    'aside',
    'form',
    'fieldset',
    'ul',
    'ol',
    'dl',
    'table',
    'thead',
    'tbody',
    'tr',
    'div'
  ]);
  const TEXT_TAGS = new Set([
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'a',
    'button',
    'label',
    'span',
    'li',
    'td',
    'th',
    'figcaption',
    'cite',
    'blockquote',
    'em',
    'strong',
    'small',
    'time',
    'dt',
    'dd'
  ]);

  const overflows = [];
  const candidates = [];

  for (const el of document.body.querySelectorAll('*')) {
    if (isSkippedDecorative(el)) continue;
    const text = visibleText(el);
    if (!text) continue;

    const own = hasOwnText(el);
    const childTextEls = [...el.children].filter((c) => !isSkippedDecorative(c) && visibleText(c));
    const tag = el.tagName.toLowerCase();
    // Language-fit cares about text boxes, not layout shells (page-header overflow:hidden
    // for decorative ::after would otherwise false-positive on every page).
    const isTextTarget =
      own || (TEXT_TAGS.has(tag) && childTextEls.length <= 1 && !LAYOUT_TAGS.has(tag));
    if (!isTextTarget) continue;

    if (!isIntentionalScroller(el)) {
      const style = getComputedStyle(el);
      const sw = el.scrollWidth;
      const sh = el.scrollHeight;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const deltaX = sw - cw;
      const deltaY = sh - ch;
      const hOverflow = deltaX > OVERFLOW_X_TOLERANCE;

      // Vertical overflow: only when this text box (or its parent) clips and the
      // excess is not explained by absolutely positioned descendants.
      let vOverflow = false;
      if (deltaY > OVERFLOW_Y_TOLERANCE && !excessExplainedByOutOfFlow(el, deltaY)) {
        const selfClips = clipsOverflow(style, 'y');
        const parentClips = el.parentElement && clipsOverflow(getComputedStyle(el.parentElement), 'y');
        const nowrap = style.whiteSpace === 'nowrap' || style.whiteSpace === 'pre';
        vOverflow = Boolean(selfClips || parentClips || nowrap);
      }

      if (hOverflow || vOverflow) {
        overflows.push({
          type: hOverflow ? (vOverflow ? 'overflow-both' : 'overflow-x') : 'overflow-y',
          path: cssPath(el),
          text: clipSnippet(text),
          scrollWidth: sw,
          clientWidth: cw,
          scrollHeight: sh,
          clientHeight: ch,
          deltaX: Math.max(0, deltaX),
          deltaY: Math.max(0, deltaY)
        });
      }
    }

    if (TEXT_TAGS.has(tag) || own) {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 4 && rect.height >= 4) {
        candidates.push({
          el,
          path: cssPath(el),
          text: clipSnippet(text),
          tag,
          rect: {
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left
          }
        });
      }
    }
  }

  // Deduplicate nested overflow reports: keep the deeper (more specific) path.
  const filteredOverflows = [];
  for (const issue of overflows) {
    const idx = filteredOverflows.findIndex(
      (prev) =>
        (prev.type === issue.type || (String(prev.type).startsWith('overflow') && String(issue.type).startsWith('overflow'))) &&
        (issue.path.startsWith(prev.path) || prev.path.startsWith(issue.path))
    );
    if (idx >= 0) {
      if (issue.path.length > filteredOverflows[idx].path.length) filteredOverflows[idx] = issue;
      continue;
    }
    filteredOverflows.push(issue);
  }

  // Conservative overlap: heading/link/button pairs with substantial intersection only.
  const overlaps = [];
  const HEADY = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button']);
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    if (!HEADY.has(a.tag)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (!HEADY.has(b.tag)) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.el.closest('nav') && b.el.closest('nav') && a.el.closest('nav') === b.el.closest('nav')) continue;
      const x1 = Math.max(a.rect.left, b.rect.left);
      const y1 = Math.max(a.rect.top, b.rect.top);
      const x2 = Math.min(a.rect.right, b.rect.right);
      const y2 = Math.min(a.rect.bottom, b.rect.bottom);
      const iw = x2 - x1;
      const ih = y2 - y1;
      if (iw <= 2 || ih <= 2) continue;
      const area = iw * ih;
      if (area < OVERLAP_MIN_AREA) continue;
      const minArea = Math.min(a.rect.w * a.rect.h, b.rect.w * b.rect.h);
      if (area / minArea < OVERLAP_MIN_RATIO) continue;
      overlaps.push({
        type: 'overlap',
        a: { path: a.path, text: a.text, tag: a.tag },
        b: { path: b.path, text: b.text, tag: b.tag },
        area: Math.round(area)
      });
    }
  }

  return { overflows: filteredOverflows, overlaps };
}

function formatIssue(issue, page, viewport) {
  const loc = `${page} @ ${viewport}px`;
  if (issue.type === 'overlap') {
    return `${loc}: overlap (${issue.area}px²)\n    A <${issue.a.tag}> "${issue.a.text}" — ${issue.a.path}\n    B <${issue.b.tag}> "${issue.b.text}" — ${issue.b.path}`;
  }
  return `${loc}: ${issue.type} Δx=${issue.deltaX} Δy=${issue.deltaY} ("${issue.text}")\n    ${issue.path}`;
}

async function main() {
  const locales = discoverLocales();
  if (!locales.length) {
    console.error(`No locale folders with HTML found under ${path.relative(ROOT, OUT)}/.`);
    process.exit(1);
  }

  const pages = [];
  for (const locale of locales) {
    for (const file of listHtml(path.join(OUT, locale))) {
      pages.push({ locale, file, url: urlPathFor(file) });
    }
  }

  const chromePath = resolveChrome();
  if (!chromePath) {
    console.error('No Chrome/Chromium binary found. Set CHROME_PATH or install google-chrome.');
    process.exit(1);
  }

  const puppeteer = await loadPuppeteer();
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;

  let browser;
  const issues = [];
  let pagesChecked = 0;
  let viewportPasses = 0;

  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
    });
    const page = await browser.newPage();

    for (const entry of pages) {
      pagesChecked++;
      for (const width of VIEWPORTS) {
        viewportPasses++;
        await page.setViewport({ width, height: VIEWPORT_HEIGHT, deviceScaleFactor: 1 });
        const response = await page.goto(`${base}${entry.url}`, { waitUntil: 'networkidle0', timeout: 30000 });
        if (!response || !response.ok()) {
          issues.push({
            type: 'load-error',
            page: entry.url,
            viewport: width,
            status: response ? response.status() : 0
          });
          continue;
        }
        // Let fonts/layout settle.
        await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
        await new Promise((r) => setTimeout(r, 50));

        const result = await page.evaluate(pageProbe);
        for (const issue of result.overflows) {
          issues.push({ ...issue, page: entry.url, viewport: width, locale: entry.locale });
        }
        for (const issue of result.overlaps) {
          issues.push({ ...issue, page: entry.url, viewport: width, locale: entry.locale });
        }
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }

  const overflowCount = issues.filter((i) => String(i.type).startsWith('overflow')).length;
  const overlapCount = issues.filter((i) => i.type === 'overlap').length;
  const loadErrors = issues.filter((i) => i.type === 'load-error').length;

  console.log('Language-fit check');
  console.log(`  dist:       ${path.relative(ROOT, OUT) || '.'}`);
  console.log(`  locales:    ${locales.join(', ')}`);
  console.log(`  pages:      ${pagesChecked}`);
  console.log(`  viewports:  ${VIEWPORTS.join(', ')} (${viewportPasses} page×viewport passes)`);
  console.log(`  chrome:     ${chromePath}`);
  console.log(`  issues:     ${issues.length} (overflow=${overflowCount}, overlap=${overlapCount}, load=${loadErrors})`);

  if (issues.length) {
    console.error('\nIssues:');
    for (const issue of issues.slice(0, 100)) {
      if (issue.type === 'load-error') {
        console.error(`  ${issue.page} @ ${issue.viewport}px: failed to load (HTTP ${issue.status})`);
      } else {
        console.error(`  ${formatIssue(issue, issue.page, issue.viewport)}`);
      }
    }
    if (issues.length > 100) console.error(`  …and ${issues.length - 100} more`);
    process.exit(1);
  }

  console.log('Language-fit check passed: no text overflow or overlapping text found.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
