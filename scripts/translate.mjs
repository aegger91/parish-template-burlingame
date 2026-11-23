#!/usr/bin/env node
// Machine translation for missing locale text in content/*.json.
// Standalone: needs only Node 20+ and an API key in the environment.
//
//   npm run translate                      translate missing/outdated text
//   npm run translate -- --dry-run         list what would be translated
//   npm run translate -- --check           report status only (never fails without a key)
//   npm run translate -- --to ru           only this locale (default: every non-source locale)
//   npm run translate -- --seed            record the current text as the reviewed baseline
//
// Keys (first one found is used):
//   DEEPL_API_KEY               DeepL API (Free keys end in ":fx")
//   GOOGLE_TRANSLATE_API_KEY    Google Cloud Translation API v2 (Basic)
// With no key the script prints a notice and exits 0; the site still builds and
// any untranslated field falls back to the source locale (marked with lang="en").
//
// Rules, per localized field ({ "en": "...", "ru": "..." }):
//   - Fields inside an object with "ru_locked": true (generally "<locale>_locked")
//     are never written. Use it for the parish's own Russian texts.
//   - A field whose target text was written or edited by a person is never
//     overwritten. The script knows machine output by its hash in
//     i18n/state.<locale>.json; anything else counts as human text.
//   - Empty or missing target text is translated.
//   - Machine text whose English source changed is translated again.
//   - Human text whose English source changed is reported as "needs review".
//   - Plain strings (not { en, ru } objects) are the same in every locale and are skipped.
// URLs, e-mail addresses, phone numbers, Markdown link targets, inline code and
// {placeholders} are protected from translation. Terms in
// i18n/glossary.<source>-<target>.json are passed to DeepL as a glossary.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, CONTENT_DIR, readJson, listContentFiles } from '../src/lib/content.mjs';
import { formatJson } from '../src/lib/json-format.mjs';

const I18N_DIR = path.resolve(ROOT, process.env.I18N_DIR || 'i18n');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const CHECK = flag('check');
const DRY = flag('dry-run');
const SEED = flag('seed');
const MOCK = flag('mock'); // test provider: "[ru] English text", no network

const site = readJson(path.join(CONTENT_DIR, 'site.json'));
const SOURCE = site.sourceLocale;
const LOCALES = site.locales.map((l) => l.code);
const TARGETS = option('to') ? [option('to')] : LOCALES.filter((c) => c !== SOURCE);

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const rel = (file) => path.relative(CONTENT_DIR, file).split(path.sep).join('/');

function isLocalized(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const keys = Object.keys(node);
  return keys.length > 0 && keys.every((k) => LOCALES.includes(k)) && keys.some((k) => typeof node[k] === 'string');
}

// Collect every localized field with a stable key: array items are addressed by
// their id when they have one, so reordering content does not orphan state.
function fields(data, file, target) {
  const out = [];
  const visit = (node, trail, locked) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, [...trail, item && typeof item === 'object' && item.id ? `[${item.id}]` : `[${i}]`], locked));
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (isLocalized(node)) {
      out.push({ key: `${rel(file)}#${trail.join('.')}`, node, locked });
      return;
    }
    const lockedHere = locked || node[`${target}_locked`] === true;
    for (const [k, v] of Object.entries(node)) if (k !== '$schema') visit(v, [...trail, k], lockedHere);
  };
  visit(data, [], false);
  return out;
}

function classify(field, state, target) {
  const source = field.node[SOURCE];
  const text = field.node[target];
  const entry = state[field.key];
  if (typeof source !== 'string' || !source.trim()) return 'no-source';
  if (field.locked) return 'locked';
  if (typeof text !== 'string' || !text.trim()) return 'missing';
  if (entry?.output && entry.output === sha(text)) return entry.source === sha(source) ? 'machine' : 'outdated';
  if (entry?.source && entry.source !== sha(source)) return 'review';
  return 'human';
}

// ---------------------------------------------------------------- protection

const PROTECT = [
  /`[^`\n]+`/g, // inline code
  /\]\([^)\s]+(?:\s+"[^"]*")?\)/g, // markdown link target ](url "title")
  /<[^>\n]+>/g, // autolinks and inline HTML
  /\bhttps?:\/\/[^\s)<>\]]+/g, // bare URLs
  /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, // e-mail
  /\(?\+?\d[\d\s().-]{6,}\d/g, // phone numbers
  /\{[a-zA-Z][\w.]*\}/g // {placeholders}
];

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xmlUnescape = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const DEEPL_TAGS = { open: '<keep>', close: '</keep>', br: '<br/>', match: /<keep>([\s\S]*?)<\/keep>/g };
const GOOGLE_TAGS = { open: '<span translate="no">', close: '</span>', br: '<br>', match: /<span translate="no">([\s\S]*?)<\/span>/g };
const MARK = (i) => String.fromCharCode(0xe000, 0xe100 + i, 0xe000);
const MARKED = /\ue000([\ue100-\uefff])\ue000/g;

export function protect(text, tags = DEEPL_TAGS) {
  const spans = [];
  let masked = text;
  for (const re of PROTECT) {
    masked = masked.replace(re, (m) => {
      spans.push(m);
      return MARK(spans.length - 1);
    });
  }
  const expand = (s) => s.replace(MARKED, (_, c) => expand(spans[c.charCodeAt(0) - 0xe100]));
  return xmlEscape(masked)
    .replace(MARKED, (_, c) => `${tags.open}${xmlEscape(expand(spans[c.charCodeAt(0) - 0xe100]))}${tags.close}`)
    .replace(/\n/g, tags.br);
}

export function unprotect(text, tags = DEEPL_TAGS) {
  return xmlUnescape(text.replace(/[ \t]*<br\s*\/?>[ \t]*/gi, '\n').replace(tags.match, (_, inner) => inner));
}

// ---------------------------------------------------------------- providers

function glossaryFor(target) {
  const file = path.join(I18N_DIR, `glossary.${SOURCE}-${target}.json`);
  if (!fs.existsSync(file)) return {};
  return readJson(file).terms || {};
}

function deepl(key) {
  const base = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const headers = { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' };
  const call = async (pathname, body, method = 'POST') => {
    const res = await fetch(`${base}${pathname}`, { method, headers, body: body && JSON.stringify(body) });
    if (!res.ok) throw new Error(`DeepL ${pathname}: HTTP ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  };
  const glossaries = new Map();
  return {
    name: 'DeepL',
    batch: 40,
    async translate(texts, target) {
      if (!glossaries.has(target)) {
        const terms = Object.entries(glossaryFor(target)).filter(([en, tr]) => en && tr && !/[\t\n]/.test(en + tr));
        let id = null;
        if (terms.length) {
          const g = await call('/v2/glossaries', {
            name: `parish-site ${SOURCE}-${target}`,
            source_lang: SOURCE.toUpperCase(),
            target_lang: target.toUpperCase(),
            entries: terms.map(([en, tr]) => `${en}\t${tr}`).join('\n'),
            entries_format: 'tsv'
          }).catch((e) => (console.warn(`  glossary not used: ${e.message}`), null));
          id = g?.glossary_id ?? null;
        }
        glossaries.set(target, id);
      }
      const glossary_id = glossaries.get(target);
      const out = await call('/v2/translate', {
        text: texts.map((t) => protect(t)),
        source_lang: SOURCE.toUpperCase(),
        target_lang: target.toUpperCase(),
        tag_handling: 'xml',
        ignore_tags: ['keep'],
        preserve_formatting: true,
        formality: 'prefer_more',
        ...(glossary_id ? { glossary_id } : {})
      });
      return out.translations.map((t) => unprotect(t.text));
    },
    async close() {
      for (const id of glossaries.values()) if (id) await call(`/v2/glossaries/${id}`, null, 'DELETE').catch(() => {});
    }
  };
}

function google(key) {
  return {
    name: 'Google Cloud Translation',
    batch: 100,
    async translate(texts, target) {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: texts.map((t) => protect(t, GOOGLE_TAGS)),
          source: SOURCE,
          target,
          format: 'html'
        })
      });
      if (!res.ok) throw new Error(`Google Translate: HTTP ${res.status} ${await res.text()}`);
      const data = await res.json();
      return data.data.translations.map((t) => unprotect(t.translatedText, GOOGLE_TAGS));
    },
    async close() {}
  };
}

function mock() {
  return {
    name: 'mock',
    batch: 50,
    async translate(texts, target) {
      return texts.map((t) => `[${target}] ${unprotect(protect(t))}`);
    },
    async close() {}
  };
}

function provider() {
  if (MOCK) return mock();
  if (process.env.DEEPL_API_KEY) return deepl(process.env.DEEPL_API_KEY.trim());
  if (process.env.GOOGLE_TRANSLATE_API_KEY) return google(process.env.GOOGLE_TRANSLATE_API_KEY.trim());
  return null;
}

// ---------------------------------------------------------------- main

const stateFile = (target) => path.join(I18N_DIR, `state.${target}.json`);
function loadState(target) {
  const file = stateFile(target);
  return fs.existsSync(file) ? readJson(file).entries || {} : {};
}
function saveState(target, entries) {
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  fs.mkdirSync(I18N_DIR, { recursive: true });
  fs.writeFileSync(
    stateFile(target),
    formatJson({
      $comment: `Written by scripts/translate.mjs. Hashes of the ${SOURCE} source and of machine output per field; text whose hash differs from "output" was edited by a person and is never overwritten. Commit this file.`,
      entries: sorted
    })
  );
}

async function main() {
  const files = listContentFiles().filter((f) => !rel(f).startsWith('integrations/'));
  const docs = new Map(files.map((f) => [f, JSON.parse(fs.readFileSync(f, 'utf8'))]));
  const translator = CHECK || DRY || SEED ? null : provider();

  if (!CHECK && !DRY && !SEED && !translator) {
    console.log('Translation skipped: set DEEPL_API_KEY or GOOGLE_TRANSLATE_API_KEY to fill missing text.');
    console.log(`Existing translations are kept; untranslated fields render in "${SOURCE}" (see npm run translate:check).`);
    return 0;
  }

  let exitCode = 0;
  for (const target of TARGETS) {
    if (!LOCALES.includes(target)) {
      console.error(`Unknown locale "${target}". site.json locales: ${LOCALES.join(', ')}`);
      return 1;
    }
    const state = loadState(target);
    const all = [];
    for (const [file, data] of docs) for (const f of fields(data, file, target)) all.push({ ...f, file, status: classify(f, state, target) });

    const count = (s) => all.filter((f) => f.status === s).length;
    const todo = all.filter((f) => f.status === 'missing' || f.status === 'outdated');
    const review = all.filter((f) => f.status === 'review');
    console.log(
      `${SOURCE} → ${target}: ${all.length} fields · ${count('human')} human · ${count('locked')} locked (${target}_locked) · ${count('machine')} machine · ` +
        `${count('missing')} missing · ${count('outdated')} outdated machine · ${review.length} need review`
    );
    for (const f of review) console.log(`  review: ${f.key} (English changed after this ${target} text was written)`);

    if (SEED) {
      for (const f of all) {
        if (f.status === 'no-source' || f.status === 'missing') continue;
        const text = f.node[target];
        const prev = state[f.key] || {};
        state[f.key] = { source: sha(f.node[SOURCE]), ...(prev.output && prev.output === sha(text) ? { output: prev.output } : {}) };
      }
      saveState(target, state);
      console.log(`  baseline recorded in ${path.relative(ROOT, stateFile(target))}`);
      continue;
    }
    if (CHECK || DRY) {
      for (const f of todo) console.log(`  ${f.status === 'missing' ? 'missing ' : 'outdated'}: ${f.key}`);
      if (CHECK && flag('strict') && (todo.length || review.length)) exitCode = 1;
      continue;
    }
    if (!todo.length) continue;

    console.log(`  translating ${todo.length} fields with ${translator.name}…`);
    for (let i = 0; i < todo.length; i += translator.batch) {
      const chunk = todo.slice(i, i + translator.batch);
      const out = await translator.translate(chunk.map((f) => f.node[SOURCE]), target);
      chunk.forEach((f, j) => {
        f.node[target] = out[j];
        state[f.key] = { source: sha(f.node[SOURCE]), output: sha(out[j]) };
        f.changed = true;
      });
    }
    for (const [file, data] of docs) {
      if (todo.some((f) => f.file === file && f.changed)) {
        fs.writeFileSync(file, formatJson(data));
        console.log(`  wrote ${path.relative(ROOT, file)}`);
      }
    }
    saveState(target, state);
  }
  await translator?.close();
  if (CHECK) console.log('Translation check done (informational; add --strict to fail on missing text).');
  return exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message);
      process.exit(1);
    }
  );
}
