// Loads every content file into one object and builds id indexes.
// The content folder is the only thing a builder/editor needs to write to.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const CONTENT_DIR = path.resolve(ROOT, process.env.CONTENT_DIR || 'content');
export const PUBLIC_DIR = path.resolve(ROOT, process.env.PUBLIC_DIR || 'public');
export const SCHEMA_DIR = path.join(ROOT, 'schemas');
export const THEME_DIR = path.join(ROOT, 'theme');

// The template's one design: theme/tokens.json (colors, type, spacing).
export function themeFile() {
  return path.join(THEME_DIR, 'tokens.json');
}

export function readJson(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete data.$schema;
  return data;
}

const byId = (list = []) => Object.fromEntries(list.map((item) => [item.id, item]));

// Optional site features a page can depend on ("requires"): when the feature
// is switched off the page is not built and every link to it is dropped.
export const FEATURES = ['livestream', 'store', 'serviceRequests', 'commemorations', 'getInvolved', 'newsletter'];

export function featureEnabled(site, name) {
  const on = (f) => site.features?.[f] === true;
  // The cart and checkout serve both the store and commemoration notes.
  if (name === 'cart') return on('store') || on('commemorations');
  if (name === 'orthodoxConnect') return on('getInvolved') || on('newsletter');
  return on(name);
}

// Store products become pages under the store page (content/store.json
// products -> /<locale>/<store path>/<product slug>/).
function productPages(store, allPages) {
  const parent = allPages.find((p) => p.requires === 'store' && p.sections.some((s) => s.type === 'store'));
  if (!parent || !store) return [];
  return store.products.map((product, i) => ({
    id: `product-${product.id}`,
    parent: parent.id,
    slug: product.slug || product.id,
    order: 1000 + i,
    title: product.name,
    seo: { description: product.summary, image: product.images?.[0]?.src },
    nav: { show: false },
    generated: true,
    sections: [{ id: 'product', type: 'product-detail', product: product.id }]
  }));
}

// Pages form a tree through `parent`. A page's URL path is its ancestors'
// slugs plus its own, so a page can be added anywhere, at any depth.
function resolvePageTree(pages) {
  const problems = [];
  const byPageId = byId(pages);
  for (const page of pages) {
    const chain = [];
    let cur = page;
    while (cur) {
      if (chain.includes(cur)) {
        problems.push(`page "${page.id}": parent chain loops`);
        break;
      }
      chain.unshift(cur);
      if (cur.parent && !byPageId[cur.parent]) problems.push(`page "${cur.id}": unknown parent "${cur.parent}"`);
      cur = cur.parent ? byPageId[cur.parent] : null;
    }
    page.ancestors = chain.slice(0, -1).map((p) => p.id);
    page.path = chain.map((p) => p.slug).filter(Boolean).join('/');
  }
  return problems;
}

const readPages = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return readPages(full);
    return entry.name.endsWith('.json') ? [readJson(full)] : [];
  });

export function loadContent({ feedOverride } = {}) {
  const f = (name) => readJson(path.join(CONTENT_DIR, name));
  const optional = (name, fallback) => (fs.existsSync(path.join(CONTENT_DIR, name)) ? f(name) : fallback);
  const site = f('site.json');
  const store = optional('store.json', null);
  const filePages = readPages(path.join(CONTENT_DIR, 'pages'));
  const allPages = [...filePages, ...productPages(store, filePages)].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const treeProblems = resolvePageTree(allPages);
  const isOn = (p) => p.enabled !== false && (!p.requires || featureEnabled(site, p.requires));
  // A page whose ancestor is switched off is switched off too.
  const offIds = new Set();
  for (const p of allPages) if (!isOn(p) || p.ancestors.some((a) => !isOn(allPages.find((x) => x.id === a)))) offIds.add(p.id);
  const pages = allPages.filter((p) => !offIds.has(p.id));

  const content = {
    site,
    navigation: f('navigation.json'),
    ui: f('ui.json'),
    people: f('people.json'),
    services: f('services.json'),
    news: f('news.json'),
    galleries: f('galleries.json'),
    giving: f('giving.json'),
    documents: optional('documents.json', { groups: [], documents: [] }),
    links: optional('links.json', { groups: [] }),
    calendar: optional('calendar.json', { fixed: [], movable: [] }),
    sermons: optional('sermons.json', null),
    store,
    requests: optional('requests.json', null),
    zapiski: optional('zapiski.json', null),
    redirects: fs.existsSync(path.join(CONTENT_DIR, 'redirects.json')) ? f('redirects.json').redirects : [],
    pages,
    allPages,
    disabledPages: offIds
  };
  content.pageTreeProblems = treeProblems;

  if (featureEnabled(site, 'getInvolved')) {
    content.orthodoxconnect = feedOverride ?? readJson(path.join(CONTENT_DIR, site.orthodoxConnect.sampleFeed));
  }

  content.index = {
    allPages: byId(allPages),
    pages: byId(pages),
    sermons: byId(content.sermons?.sermons || []),
    sermonSeries: byId(content.sermons?.series || []),
    newsCategories: byId(content.news.categories || []),
    products: byId(store?.products || []),
    productCategories: byId(store?.categories || []),
    requests: byId(content.requests?.services || []),
    people: byId(content.people.people),
    documents: byId(content.documents.documents),
    documentGroups: byId(content.documents.groups),
    galleries: byId(content.galleries.galleries),
    news: byId(content.news.items),
    serviceTypes: byId(content.services.serviceTypes),
    funds: byId(content.giving.funds),
    linkGroups: byId(content.links.groups)
  };
  return content;
}

export function listContentFiles(dir = CONTENT_DIR) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listContentFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}
