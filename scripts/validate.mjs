#!/usr/bin/env node
// Validates every file in content/ (and theme/tokens.json) against its JSON
// Schema, then checks cross-references (page, document, person, gallery ids...).
//
//   node scripts/validate.mjs            exit 1 on any error
//
// Each content file names its schema in "$schema". Builders can import
// { validateContentFile, validateFeed, createValidator } to validate edits
// before saving them.
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CONTENT_DIR, PUBLIC_DIR, SCHEMA_DIR, ROOT, themeFile, listContentFiles, loadContent } from '../src/lib/content.mjs';

export function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const name of fs.readdirSync(SCHEMA_DIR).filter((n) => n.endsWith('.schema.json'))) {
    ajv.addSchema(JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8')), name);
  }
  return ajv;
}

let shared;
const validator = () => (shared ??= createValidator());

function formatErrors(errors = []) {
  // if/then dispatch reports the failing branch plus a generic "must match then",
  // and a failing base schema makes unevaluatedProperties flag every property of
  // that object; keep only the specific messages.
  const real = errors.filter((e) => e.keyword !== 'if' && e.keyword !== 'unevaluatedProperties').map((e) => e.instancePath);
  const covered = (p) => real.some((r) => r === p || r.startsWith(`${p}/`));
  return errors
    .filter((e) => e.keyword !== 'if')
    .filter((e) => e.keyword !== 'unevaluatedProperties' || !covered(e.instancePath))
    .map((e) => {
      const where = e.instancePath || '/';
      if (e.keyword === 'unevaluatedProperties' || e.keyword === 'additionalProperties') {
        return `${where}: unknown property "${e.params.unevaluatedProperty ?? e.params.additionalProperty}"`;
      }
      if (e.keyword === 'enum') return `${where}: must be one of ${e.params.allowedValues.map((v) => JSON.stringify(v)).join(', ')}`;
      return `${where}: ${e.message}`;
    })
    .filter((msg, i, all) => all.indexOf(msg) === i);
}

export function schemaFor(file, data) {
  if (typeof data.$schema === 'string') return path.basename(data.$schema);
  const rel = path.relative(CONTENT_DIR, file);
  if (rel.startsWith(`pages${path.sep}`)) return 'page.schema.json';
  return `${path.basename(file, '.json')}.schema.json`;
}

export function validateContentFile(file, data = JSON.parse(fs.readFileSync(file, 'utf8'))) {
  const name = schemaFor(file, data);
  const validate = validator().getSchema(name);
  if (!validate) return [`no schema "${name}"`];
  return validate(data) ? [] : formatErrors(validate.errors);
}

export function validateFeed(feed) {
  const validate = validator().getSchema('orthodoxconnect-feed.schema.json');
  return validate(feed) ? [] : formatErrors(validate.errors);
}

// ---------------------------------------------------------------- references

function walk(value, visit, trail = []) {
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, [...trail, i]));
  else if (value && typeof value === 'object') {
    visit(value, trail);
    for (const [k, v] of Object.entries(value)) walk(v, visit, [...trail, k]);
  }
}

function duplicates(list) {
  const seen = new Set();
  return list.filter((x) => (seen.has(x) ? true : (seen.add(x), false)));
}

export function checkReferences(content) {
  const errors = [];
  const { site, index, allPages } = content;
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const codes = site.locales.map((l) => l.code);

  if (!codes.includes(site.sourceLocale)) err('site.json', `sourceLocale "${site.sourceLocale}" is not in locales`);

  const collections = {
    'people.json': content.people.people,
    'news.json': content.news.items,
    'news.json categories': content.news.categories || [],
    'galleries.json': content.galleries.galleries,
    'documents.json': content.documents.documents,
    'giving.json funds': content.giving.funds,
    'services.json upcoming': content.services.upcoming,
    'services.json serviceTypes': content.services.serviceTypes,
    'links.json': content.links.groups,
    'sermons.json': content.sermons?.sermons || [],
    'store.json products': content.store?.products || [],
    'store.json categories': content.store?.categories || [],
    'requests.json': content.requests?.services || [],
    pages: allPages
  };
  for (const [name, list] of Object.entries(collections)) {
    for (const id of duplicates(list.map((x) => x.id))) err(name, `duplicate id "${id}"`);
  }
  for (const p of duplicates(allPages.map((p) => p.path))) err('pages', `two pages have the URL path "/${p}/"`);
  if (!index.allPages.home) err('pages', 'a page with id "home" is required');
  for (const problem of content.pageTreeProblems || []) err('pages', problem);

  const ref = (where, kind, id, table) => {
    if (id !== undefined && !table[id]) err(where, `unknown ${kind} "${id}"`);
  };
  const people = index.people;
  const groupsInUse = new Set(content.people.people.flatMap((p) => p.roles.map((r) => r.group)));

  // Links may point at a page whose feature is off; the build drops them.
  const checkTree = (file, data) => {
    walk(data, (node, trail) => {
      const where = `${file} ${trail.join('.')}`.trim();
      if (typeof node.page === 'string') ref(where, 'page', node.page, index.allPages);
      if (typeof node.document === 'string') ref(where, 'document', node.document, index.documents);
      if (!node.type) return;
      switch (node.type) {
        case 'person-profile':
          ref(where, 'person', node.person, people);
          break;
        case 'people-list':
          (node.people || []).forEach((p) => ref(where, 'person', p.person, people));
          if (node.group && !groupsInUse.has(node.group)) err(where, `no person has a role in group "${node.group}"`);
          break;
        case 'gallery':
          ref(where, 'gallery', node.gallery, index.galleries);
          (node.galleries || []).forEach((g) => ref(where, 'gallery', g, index.galleries));
          break;
        case 'link-list':
          node.groups.forEach((g) => ref(where, 'link group', g, index.linkGroups));
          break;
        case 'donate-form':
          (node.funds || []).forEach((f) => ref(where, 'fund', f, index.funds));
          break;
        case 'document-list':
          ref(where, 'document group', node.group, index.documentGroups);
          (node.documents || []).forEach((d) => ref(where, 'document', d, index.documents));
          break;
        case 'news-list':
          ref(where, 'news category', node.category, index.newsCategories);
          break;
        case 'store':
          (node.categories || []).forEach((c) => ref(where, 'store category', c, index.productCategories));
          break;
        case 'request-services':
          (node.services || []).forEach((r) => ref(where, 'service', r, index.requests));
          break;
        case 'card-grid':
          ref(where, 'page', node.parent, index.allPages);
          break;
      }
    });
  };

  for (const page of allPages.filter((p) => !p.generated)) {
    checkTree(`pages/${page.id}.json`, page.sections);
    const ids = [];
    walk(page.sections, (node) => node.type && node.id && ids.push(node.id));
    for (const id of duplicates(ids)) err(`pages/${page.id}.json`, `duplicate section id "${id}"`);
  }
  checkTree('navigation.json', content.navigation);
  checkTree('people.json', content.people);
  checkTree('news.json', content.news);
  checkTree('requests.json', content.requests || {});

  content.redirects.forEach((r) => ref(`redirects.json ${r.from}`, 'page', r.page, index.allPages));
  for (const from of duplicates(content.redirects.map((r) => r.from))) err('redirects.json', `duplicate "${from}"`);

  content.services.upcoming.forEach((s) => ref(`services.json upcoming ${s.id}`, 'service type', s.serviceType, index.serviceTypes));
  content.news.items.forEach((n) => {
    ref(`news.json ${n.id}`, 'gallery', n.gallery, index.galleries);
    ref(`news.json ${n.id}`, 'category', n.category, index.newsCategories);
  });
  (content.sermons?.sermons || []).forEach((x) => {
    ref(`sermons.json ${x.id}`, 'person', x.speaker, people);
    ref(`sermons.json ${x.id}`, 'series', x.series, index.sermonSeries);
  });
  (content.store?.products || []).forEach((x) => ref(`store.json ${x.id}`, 'category', x.category, index.productCategories));
  if (content.orthodoxconnect) {
    const cats = Object.fromEntries((content.orthodoxconnect.categories || []).map((c) => [c.id, c]));
    content.orthodoxconnect.items.forEach((x) => ref(`OrthodoxConnect feed ${x.id}`, 'category', x.category, cats));
  }
  if (content.zapiski) {
    const types = content.zapiski.types.map((t) => t.id);
    content.zapiski.commemorations.forEach((c) => (c.for || []).forEach((t) => types.includes(t) || err(`zapiski.json ${c.id}`, `unknown note type "${t}"`)));
  }
  content.documents.documents.forEach((d) => {
    ref(`documents.json ${d.id}`, 'group', d.group, index.documentGroups);
    const group = index.documentGroups[d.group];
    if (d.category && group && !(group.categories || []).some((c) => c.id === d.category)) {
      err(`documents.json ${d.id}`, `unknown category "${d.category}" in group "${d.group}"`);
    }
  });

  const sorted = [...content.services.upcoming].map((s) => s.date);
  if (sorted.join() !== [...sorted].sort().join()) err('services.json', 'upcoming services are not in date order');

  // Every localized value must have the source locale.
  const filesToScan = listContentFiles().filter((f) => !f.includes(`${path.sep}integrations${path.sep}`));
  for (const file of filesToScan) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    walk(data, (node, trail) => {
      const keys = Object.keys(node);
      const localized = keys.length && keys.every((k) => codes.includes(k)) && keys.some((k) => typeof node[k] === 'string');
      if (localized && typeof node[site.sourceLocale] !== 'string') {
        err(`${path.relative(CONTENT_DIR, file)} ${trail.join('.')}`, `missing "${site.sourceLocale}" text`);
      }
    });
  }

  // Assets referenced from content must exist in public/.
  for (const file of filesToScan) {
    const text = fs.readFileSync(file, 'utf8');
    for (const [, src] of text.matchAll(/"(?:src|url|href|image|favicon|faviconPng|appleTouchIcon|square)":\s*"(\/(?:assets|logo|fonts|files)\/[^"#?]+)"/g)) {
      if (!fs.existsSync(path.join(PUBLIC_DIR, decodeURI(src)))) err(path.relative(CONTENT_DIR, file), `missing file public${src}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------- CLI

export function validateAll() {
  const problems = [];
  const files = [...listContentFiles(), themeFile(JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'site.json'), 'utf8')))];
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      problems.push(`${path.relative(ROOT, file)}: invalid JSON (${e.message})`);
      continue;
    }
    for (const msg of validateContentFile(file, data)) problems.push(`${path.relative(ROOT, file)} ${msg}`);
  }
  if (!problems.length) problems.push(...checkReferences(loadContent()));
  return { files: files.length, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { files, problems } = validateAll();
  if (problems.length) {
    console.error(`Content validation failed (${problems.length}):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Content valid: ${files} files match their schemas and all references resolve.`);
}
