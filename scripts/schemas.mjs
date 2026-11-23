#!/usr/bin/env node
// Writes the JSON Schemas in schemas/ from the definitions below, so the page
// schema always matches the section types in src/components/registry.mjs and
// the icon list matches the sprite.
//
//   npm run schemas
//
// Each section type lists its fields once. A website builder can read
// schemas/page.schema.json to show a form per section: every field has a
// plain name and, where it is not obvious, a one-line description.
import fs from 'node:fs';
import path from 'node:path';
import { registry } from '../src/components/registry.mjs';
import { FEATURES, SCHEMA_DIR, ROOT } from '../src/lib/content.mjs';

const C = (def) => ({ $ref: `common.schema.json#/$defs/${def}` });
const T = (description) => ({ ...C('text'), ...(description && { description }) });
const MD = (description) => ({ ...C('markdown'), ...(description && { description }) });
const ID = (description) => ({ ...C('id'), ...(description && { description }) });
const BOOL = (description, def) => ({ type: 'boolean', ...(description && { description }), ...(def !== undefined && { default: def }) });
const INT = (description, min = 0) => ({ type: 'integer', minimum: min, ...(description && { description }) });
const NUM = (description) => ({ type: 'number', minimum: 0, ...(description && { description }) });
const STR = (description) => ({ type: 'string', ...(description && { description }) });
const ENUM = (values, description) => ({ enum: values, ...(description && { description }) });
const ARR = (items, description) => ({ type: 'array', items, ...(description && { description }) });
const IMG = (description) => ({ ...C('image'), ...(description && { description }) });
const ACTIONS = (description = 'Buttons. The first is the main one.') => ({ ...C('actions'), description });
const editorial = { needsReview: STR('Note for editors. Never shown on the site.') };
const LOCKED = { '^[a-z]{2,3}_locked$': BOOL('Marks the translations in this object as approved by a person.') };

function obj(properties, required = [], extra = {}) {
  return { type: 'object', properties, ...(required.length && { required }), additionalProperties: false, ...extra };
}
const record = (properties, required = []) => obj({ ...editorial, ...properties }, required, { patternProperties: LOCKED });
const file = (id, title, description, properties, required = []) => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: id,
  title,
  description,
  ...obj({ $schema: STR(), $comment: STR(), ...properties }, required)
});

// ---------------------------------------------------------------- sections

const head = {
  eyebrow: T('Small line above the title.'),
  title: T(),
  accent: T('Optional second line, e.g. the name in Church Slavonic.'),
  intro: MD('One or two lines under the title.')
};
const headingLevel = ENUM([2, 3], 'HTML heading level. Default 2.');
const feedKinds = ['event', 'volunteer', 'need'];

const SECTIONS = {
  hero: {
    eyebrow: head.eyebrow,
    title: T('Usually the parish name.'),
    accent: head.accent,
    text: T('One line under the name.'),
    image: IMG('Background photograph.'),
    actions: { ...ACTIONS('One or two buttons.'), maxItems: 2 },
    shortcut: obj({ label: T(), page: ID('Page id.'), icon: C('iconName') }, ['label', 'page'], { description: 'Small link under the buttons.' }),
    nextServices: obj({ limit: INT('How many services to list.', 1), title: T() }, [], { description: 'The panel with today, the feast and the next services.' }),
    showAddress: BOOL('Show the address and directions link.', true)
  },
  'page-header': { eyebrow: head.eyebrow, title: T(), accent: head.accent, lede: T('One line under the title.'), image: IMG(), breadcrumbs: BOOL('Show breadcrumbs.', true) },
  'rich-text': {
    ...head,
    body: MD('The text. Keep sample text to one or two lines.'),
    bodyLang: C('localeCode'),
    media: IMG('Photograph beside the text.'),
    notice: { anyOf: [MD(), obj({ title: T(), text: MD() }, ['text'])], description: 'Highlighted note under the text.' },
    more: obj({ title: T(), body: MD() }, ['title', 'body'], { description: 'Extra text behind a "show more" toggle.' }),
    headingLevel,
    actions: ACTIONS()
  },
  'service-times': {
    ...head,
    limit: INT('How many upcoming services to list. 0 lists none.'),
    showStanding: BOOL('Show the weekly pattern from services.json.'),
    showSeason: BOOL('Show the current fast or season.'),
    showNotices: BOOL('Show schedule notices.'),
    headingLevel,
    actions: ACTIONS()
  },
  'person-profile': {
    person: ID('Person id from people.json.'),
    group: STR('Role group to show, e.g. "clergy".'),
    media: IMG('Photograph instead of the one in people.json.'),
    body: MD(),
    quote: obj({ text: T(), cite: T() }, ['text']),
    more: obj({ title: T(), body: MD() }, ['title', 'body']),
    actions: ACTIONS()
  },
  'people-list': {
    ...head,
    group: STR('Role group to list, e.g. "clergy" or "council".'),
    people: ARR(obj({ person: ID(), group: STR() }, ['person']), 'Pick people in this order instead of listing the whole group.'),
    showEmail: BOOL(undefined, true),
    showPhone: BOOL(undefined, true)
  },
  schedule: {
    ...head,
    source: ENUM(['services', 'orthodoxconnect'], 'Services from services.json, or events from OrthodoxConnect.'),
    view: ENUM(['week', 'month'], 'View shown first. Default week.'),
    showLegend: BOOL(undefined, true),
    showSeason: BOOL('Show the current fast or season.'),
    showNotices: BOOL('Show schedule notices.'),
    actions: ACTIONS()
  },
  'news-list': {
    ...head,
    limit: INT('How many items. Default all.', 1),
    featuredOnly: BOOL(),
    category: ID('Only this category.'),
    filters: BOOL('Category buttons.'),
    articles: BOOL('Full articles instead of cards (the News page).'),
    actions: ACTIONS()
  },
  gallery: { ...head, gallery: ID('One album id.'), galleries: ARR(C('id'), 'Several album ids, with album buttons.'), limit: INT(undefined, 1) },
  'video-list': {
    ...head,
    videos: ARR(obj({ id: ID(), youtubeId: STR(), embed: BOOL(), title: T(), date: C('date'), description: MD(), descriptionLang: C('localeCode') }, ['title']))
  },
  'donate-form': { ...head, funds: ARR(C('id'), 'Fund ids from giving.json. Default all.'), frequency: ENUM(['once', 'monthly'], 'Selected first.') },
  'dues-table': { ...head, body: MD(), actions: ACTIONS() },
  'document-list': {
    ...head,
    group: ID('Document group id.'),
    documents: ARR(C('id'), 'Document ids, in this order.'),
    groupBy: ENUM(['year', 'volume', 'category']),
    columns: ENUM([1, 2, 3]),
    limit: INT(undefined, 1),
    actions: ACTIONS()
  },
  'contact-map': { ...head, body: MD('One line about the location.'), showMap: BOOL(undefined, true), actions: ACTIONS() },
  'contact-form': { ...head, topics: ARR(obj({ id: ID(), label: T() }, ['id', 'label']), 'Choices in the topic menu.') },
  livestream: { ...head, upcoming: INT('How many streamed services to list. Default 4.', 1), actions: ACTIONS() },
  'sermon-list': { ...head, limit: INT(undefined, 1), filters: BOOL('Series buttons and a speaker menu.', true), actions: ACTIONS() },
  store: { ...head, categories: ARR(C('id'), 'Category ids. Default all.'), featured: BOOL('Only featured products.'), filters: BOOL('Category buttons.', true), limit: INT(undefined, 1), actions: ACTIONS() },
  'product-detail': { product: ID('Product id. The build makes these pages itself.') },
  cart: { ...head },
  'request-services': { ...head, services: ARR(C('id'), 'Service ids from requests.json. Default all.') },
  zapiski: { ...head },
  'cta-band': { ...head, text: MD(), actions: ACTIONS() },
  'card-grid': {
    ...head,
    source: ENUM(['children'], 'Make one card per subpage of this page (or of `parent`).'),
    parent: ID('Page id, with source "children".'),
    cards: ARR(
      obj({ id: ID(), eyebrow: T(), title: T(), accent: T(), text: MD(), image: IMG(), icon: C('iconName'), link: C('link'), actions: C('actions'), ...editorial }, ['title'])
    )
  },
  timeline: { ...head, items: ARR(obj({ year: { type: ['string', 'integer'] }, title: T(), text: MD(), image: IMG(), ...editorial }, ['year', 'title'])), actions: ACTIONS() },
  'link-list': { ...head, groups: ARR(C('id'), 'Link group ids from links.json.') },
  quote: { ...head, text: MD(), cite: T('Who said it.'), image: IMG('Portrait.'), more: obj({ title: T(), body: MD() }, ['title', 'body']), actions: ACTIONS() },
  notice: { title: T(), text: MD(), actions: ACTIONS() },
  prayer: { ...head, text: T('The prayer. Line breaks are kept.'), textLang: C('localeCode'), translation: T(), cite: T(), headingLevel, actions: ACTIONS() },
  'fact-list': { ...head, facts: ARR(obj({ label: T(), value: MD() }, ['label', 'value'])), actions: ACTIONS() },
  'orthodoxconnect-feed': {
    ...head,
    kinds: ARR(ENUM(feedKinds), 'Which items to show. Default all.'),
    limit: INT(undefined, 1),
    filters: BOOL('Category buttons.'),
    appActions: ARR(ENUM(['createEvent', 'postNeed']), 'Buttons that open the OrthodoxConnect app for this parish.'),
    actions: ACTIONS()
  },
  'orthodoxconnect-cta': { ...head, text: MD(), buttonLabel: T() }
};

const missing = Object.keys(registry).filter((t) => !SECTIONS[t]);
const extra = Object.keys(SECTIONS).filter((t) => !registry[t]);
if (missing.length || extra.length) throw new Error(`section list out of date. Missing: ${missing.join(', ') || 'none'}. Unknown: ${extra.join(', ') || 'none'}.`);

const sectionBase = {
  type: { const: '' },
  id: ID('Anchor id (#id). Unique on the page.'),
  enabled: BOOL('Set to false to hide the section without deleting it.', true),
  locales: ARR(C('localeCode'), 'Show only in these languages.'),
  ...editorial
};

const sectionDefs = Object.fromEntries(
  Object.entries(SECTIONS).map(([type, props]) => {
    const m = registry[type].meta;
    return [
      type,
      {
        title: m.title,
        description: m.description,
        ...obj({ ...sectionBase, type: { const: type }, ...props }, ['type'], { patternProperties: LOCKED })
      }
    ];
  })
);

const page = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'page.schema.json',
  title: 'Page',
  description:
    'content/pages/<id>.json: one page, built in every language at /<locale>/<parent slugs>/<slug>/. A page is an ordered list of sections; reorder them by moving them in the list and switch one off with "enabled": false. Generated by scripts/schemas.mjs.',
  ...obj(
    {
      $schema: STR(),
      id: ID('Page id used by menus and links. "home" and "not-found" are special.'),
      slug: { type: 'string', pattern: '^([a-z0-9][a-z0-9-]*)?$', description: 'Last part of the URL ("" for the home page).' },
      parent: ID('Page id this page sits under, in the URL and the menu.'),
      order: { type: 'integer', description: 'Position among its siblings in the menu.' },
      enabled: BOOL('Set to false to leave the page out of the site.', true),
      requires: ENUM([...FEATURES, 'cart', 'orthodoxConnect'], 'Build the page only when this feature is on in site.json. "cart" means store or commemorations; "orthodoxConnect" means getInvolved or newsletter.'),
      title: T('Page name for the browser tab, breadcrumbs and menus.'),
      summary: T('One line for cards that link to this page.'),
      cardImage: IMG('Image for cards that link to this page.'),
      nav: obj(
        {
          label: T('Menu label. Default: the title.'),
          overview: T('Label of the link to this page inside its own dropdown, e.g. "Schedule".'),
          icon: C('iconName'),
          show: BOOL('Show in the menus.', true)
        },
        [],
        { description: 'How the page appears in the header menu and the mobile menu.' }
      ),
      sitemap: BOOL(undefined, true),
      noindex: BOOL(),
      seo: C('seo'),
      sections: { type: 'array', minItems: 1, items: { $ref: '#/$defs/section' } },
      ...editorial
    },
    ['id', 'slug', 'title', 'sections'],
    { patternProperties: LOCKED }
  ),
  $defs: {
    section: {
      type: 'object',
      required: ['type'],
      properties: { type: ENUM(Object.keys(SECTIONS), 'Section type.') },
      allOf: Object.keys(SECTIONS).map((t) => ({ if: { properties: { type: { const: t } }, required: ['type'] }, then: { $ref: `#/$defs/${t}` } }))
    },
    ...sectionDefs
  }
};

// ---------------------------------------------------------------- data files

const featureProps = Object.fromEntries(
  [
    ['livestream', 'Livestream page, live badge and sermons.'],
    ['store', 'Parish store, product pages and cart.'],
    ['serviceRequests', 'Request a Service page.'],
    ['commemorations', 'Commemoration notes and candles.'],
    ['getInvolved', 'Events, volunteering and needs from OrthodoxConnect.'],
    ['newsletter', 'Newsletter sign-up in the footer (OrthodoxConnect).']
  ].map(([k, d]) => [k, BOOL(d, false)])
);
if (Object.keys(featureProps).join() !== FEATURES.join()) throw new Error('feature list out of date');

const linkTemplate = STR('URL template. {appUrl}, {parishId} and {id} are filled in.');
const site = file(
  'site.schema.json',
  'Site',
  'content/site.json: parish details, languages and the optional features.',
  {
    id: ID('Short parish id.'),
    url: C('url'),
    name: T('Parish name.'),
    location: T('Town and state, shown under the name.'),
    accent: obj({ name: STR(), lang: C('localeCode') }, ['name'], { description: 'The name in Church Slavonic or another language, shown as a second line.' }),
    jurisdiction: obj({ name: T(), url: C('url') }, ['name']),
    timezone: STR('IANA time zone, e.g. "America/Los_Angeles".'),
    currency: { type: 'string', pattern: '^[A-Z]{3}$', description: 'ISO currency code for prices.' },
    locales: ARR(
      obj({ code: C('localeCode'), label: STR('Short label for the switcher, e.g. "EN".'), name: STR('Name in that language.'), ogLocale: STR(), dir: ENUM(['ltr', 'rtl']), weekStart: ENUM([0, 1], '0 Sunday, 1 Monday.') }, ['code', 'label', 'name']),
      'Site languages. The first is the default.'
    ),
    sourceLocale: C('localeCode'),
    features: obj(featureProps, [], { description: 'Switch optional parts of the site on or off.' }),
    calendar: obj({ style: ENUM(['julian', 'revised-julian', 'gregorian'], 'Church calendar for feasts.'), showOldStyle: BOOL('Show the Old Style date (Julian only).', true) }, ['style']),
    contact: obj(
      {
        address: obj({ street: STR(), city: STR(), region: STR(), postalCode: STR(), country: STR() }, ['street', 'city']),
        phone: C('phone'),
        email: C('email'),
        directionsUrl: C('url'),
        mapEmbedUrl: C('url'),
        officeHours: T()
      },
      ['address']
    ),
    social: ARR(obj({ id: ID(), label: T(), url: C('url'), icon: C('iconName') }, ['id', 'label', 'url'])),
    livestream: obj(
      {
        embedUrl: STR('Player URL, loaded only when someone presses play.'),
        watchUrl: C('url'),
        leadMinutes: INT('Show "Live now" this many minutes before a streamed service.'),
        statusUrl: STR(),
        poster: IMG(),
        links: ARR(C('link'))
      },
      []
    ),
    orthodoxConnect: obj(
      {
        parishId: STR('Parish id on OrthodoxConnect.'),
        appUrl: C('url'),
        sampleFeed: STR('Sample feed file under content/.'),
        newsletterListId: STR(),
        links: obj({ join: linkTemplate, createEvent: linkTemplate, postNeed: linkTemplate, item: linkTemplate })
      },
      ['parishId', 'appUrl']
    ),
    forms: obj({ contactEndpoint: STR('Where the contact form posts. Empty: sample mode.') }),
    logo: obj(
      {
        image: { anyOf: [C('path'), C('url')], description: 'Logo file. Any shape works; the header sizes it by height.' },
        favicon: C('path'),
        icon: C('path')
      },
      ['image']
    ),
    seo: obj({ siteName: T(), title: T(), description: T(), image: C('path') })
  },
  ['id', 'name', 'locales', 'sourceLocale', 'features', 'contact', 'logo']
);

const navigation = file('navigation.schema.json', 'Navigation', 'content/navigation.json: the header button and the footer. The menu itself comes from the page tree (parent, order, nav).', {
  header: obj({ button: obj({ page: ID(), label: T() }, ['page', 'label'], { description: 'The button at the end of the header, e.g. Donate.' }) }),
  footer: obj({
    about: T('One line about the parish.'),
    pages: ENUM(['top'], 'Footer page links: the top-level pages.'),
    connect: ARR(C('link'), 'Links in the Follow column.'),
    legal: T()
  })
});

const giving = file(
  'giving.schema.json',
  'Giving',
  'content/giving.json: the donation form and membership dues.',
  {
    provider: STR('Payment provider name, e.g. "stripe". Connect it in ParishSite.handlers.donate.'),
    endpoint: STR('Where the form posts. Empty: sample mode.'),
    note: T(),
    amounts: obj({ once: ARR(NUM()), monthly: ARR(NUM()) }),
    funds: ARR(record({ id: ID(), title: T(), description: T() }, ['id', 'title']), 'What a gift can go to.'),
    dues: obj({ title: T(), note: MD(), rates: ARR(obj({ id: ID(), label: T(), amount: NUM(), note: T() }, ['id', 'label', 'amount'])) })
  },
  ['funds']
);

const news = file(
  'news.schema.json',
  'News',
  'content/news.json: news items, newest first.',
  {
    categories: ARR(obj({ id: ID(), label: T() }, ['id', 'label'])),
    items: ARR(
      record(
        {
          id: ID(),
          date: C('date'),
          category: ID('Category id.'),
          featured: BOOL(),
          title: T(),
          summary: T(),
          body: MD(),
          bodyLang: C('localeCode'),
          image: IMG(),
          gallery: ID('Album id from galleries.json.'),
          videos: ARR({ type: 'object' }),
          links: ARR(C('link'))
        },
        ['id', 'date', 'title']
      )
    )
  },
  ['items']
);

const services = file(
  'services.schema.json',
  'Services',
  'content/services.json: the weekly pattern, the current season and the dated schedule.',
  {
    serviceTypes: ARR(obj({ id: ID(), name: T(), durationMinutes: INT(undefined, 1), streamed: BOOL('Streamed by default.') }, ['id', 'name'])),
    standing: obj({ title: T(), items: ARR(obj({ label: T(), text: T() }, ['label', 'text'])) }, [], { description: 'The usual week, for the "Every week" list.' }),
    season: obj({ id: ID(), title: T(), accent: STR(), text: T(), start: C('date'), end: C('date') }, ['title', 'start', 'end']),
    notices: ARR(record({ id: ID(), text: MD(), published: BOOL(undefined, true) }, ['text'])),
    upcoming: ARR(
      record(
        { id: ID(), date: C('date'), time: C('time'), serviceType: ID(), title: T('Name, if not the service type name.'), note: T('Feast or occasion.'), streamed: BOOL(), location: T() },
        ['id', 'date', 'serviceType']
      ),
      'Dated services, in date order. Past ones hide on their own.'
    )
  },
  ['serviceTypes', 'upcoming']
);

const rank = ENUM(['great', 'major', 'saint', 'observance']);
const calendar = file(
  'calendar.schema.json',
  'Church calendar',
  'content/calendar.json: feasts by church date (fixed) and by days from Pascha (movable). Shown in the schedule and hero.',
  {
    fixed: ARR(obj({ date: { type: 'string', pattern: '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$', description: 'MM-DD on the church calendar.' }, rank, title: T() }, ['date', 'rank', 'title'])),
    movable: ARR(obj({ offset: { type: 'integer', description: 'Days after Pascha (negative before).' }, rank, title: T() }, ['offset', 'rank', 'title']))
  },
  ['fixed', 'movable']
);

const sermons = file(
  'sermons.schema.json',
  'Sermons',
  'content/sermons.json: recorded sermons and their series.',
  {
    series: ARR(obj({ id: ID(), label: T() }, ['id', 'label'])),
    sermons: ARR(
      record(
        { id: ID(), date: C('date'), title: T(), speaker: ID('Person id.'), series: ID(), scripture: T(), summary: T(), audio: obj({ src: { anyOf: [C('path'), C('url')] }, duration: INT('Seconds.') }, ['src']) },
        ['id', 'date', 'title']
      )
    )
  },
  ['sermons']
);

const store = file(
  'store.schema.json',
  'Store',
  'content/store.json: products, categories and how orders are collected.',
  {
    categories: ARR(obj({ id: ID(), label: T() }, ['id', 'label'])),
    fulfillment: obj({
      pickup: obj({ enabled: BOOL(), note: T() }, ['enabled']),
      ship: obj({ enabled: BOOL(), flatRate: NUM(), freeOver: NUM('Free shipping over this order total.'), note: T() }, ['enabled'])
    }),
    checkout: obj({ provider: STR(), endpoint: STR('Where checkout posts. Empty: sample mode.') }),
    products: ARR(
      record(
        {
          id: ID(),
          slug: ID('URL part. Default: the id.'),
          category: ID(),
          featured: BOOL(),
          name: T(),
          summary: T(),
          description: MD(),
          price: NUM('Price when there are no variants.'),
          stock: INT('How many are left. Leave out for no limit.'),
          variantLabel: T('E.g. "Size".'),
          variants: ARR(obj({ id: ID(), label: T(), price: NUM('Default: the product price.'), stock: INT() }, ['id', 'label'])),
          images: ARR(IMG())
        },
        ['id', 'category', 'name']
      )
    )
  },
  ['categories', 'products']
);

const requests = file(
  'requests.schema.json',
  'Service requests',
  'content/requests.json: services people can request from the priest or the office.',
  {
    recipient: T('Who receives requests, e.g. "Father John or the parish office".'),
    endpoint: STR('Where requests post. Empty: sample mode.'),
    note: T(),
    services: ARR(
      record(
        {
          id: ID(),
          icon: C('iconName'),
          image: IMG('Photograph instead of the pictogram.'),
          title: T(),
          accent: STR(),
          summary: T('One line.'),
          price: obj({ type: ENUM(['free', 'donation']), suggested: NUM('Suggested donation.') }, ['type']),
          duration: T(),
          askDate: BOOL('Ask for a preferred date and time.', true),
          link: C('link'),
          cta: T('Button label.')
        },
        ['id', 'title']
      )
    )
  },
  ['services']
);

const zapiski = file(
  'zapiski.schema.json',
  'Commemoration notes',
  'content/zapiski.json: commemoration notes (zapiski) and candles.',
  {
    maxNames: INT('Names per note.', 1),
    types: ARR(obj({ id: ENUM(['health', 'repose']), label: T(), heading: STR('Heading on the note, e.g. "О здра́вїи".') }, ['id', 'label'])),
    prefixes: ARR(obj({ id: ID(), label: T(), short: T() }, ['id', 'label'])),
    commemorations: ARR(obj({ id: ID(), label: T(), text: T(), suggested: NUM('Suggested donation.'), for: ARR(ENUM(['health', 'repose'])) }, ['id', 'label', 'suggested'])),
    candles: obj({ label: T(), sizes: ARR(obj({ id: ID(), label: T(), price: NUM() }, ['id', 'label', 'price'])) }),
    donation: obj({ label: T() }),
    hint: MD(),
    consent: T()
  },
  ['types', 'commemorations']
);

const feed = file(
  'orthodoxconnect-feed.schema.json',
  'OrthodoxConnect feed',
  'What the OrthodoxConnect app provides for a parish: events, volunteer opportunities and needs. content/integrations/orthodoxconnect.sample.json is a labeled sample.',
  {
    version: { const: 2 },
    isSample: BOOL(),
    source: STR(),
    parishId: STR(),
    generatedAt: { type: 'string', format: 'date-time' },
    categories: ARR(obj({ id: ID(), label: T() }, ['id', 'label'])),
    items: ARR(
      obj(
        {
          id: STR(),
          kind: ENUM(feedKinds),
          status: ENUM(['open', 'full', 'cancelled']),
          category: ID(),
          title: T(),
          summary: T(),
          date: C('date'),
          time: C('time'),
          endTime: C('time'),
          location: T(),
          organizer: T(),
          capacity: INT('Places or items wanted. 0 for no limit.'),
          signups: INT(),
          unit: T('What is counted, e.g. "meals".'),
          url: C('url')
        },
        ['id', 'kind', 'title']
      )
    )
  },
  ['version', 'items']
);

// ---------------------------------------------------------------- write

const out = { 'page.schema.json': page, 'site.schema.json': site, 'navigation.schema.json': navigation, 'giving.schema.json': giving, 'news.schema.json': news, 'services.schema.json': services, 'calendar.schema.json': calendar, 'sermons.schema.json': sermons, 'store.schema.json': store, 'requests.schema.json': requests, 'zapiski.schema.json': zapiski, 'orthodoxconnect-feed.schema.json': feed };

const sprite = fs.readFileSync(path.join(ROOT, 'src/components/_primitives.mjs'), 'utf8');
const icons = [...sprite.matchAll(/<symbol id="i-([a-z0-9-]+)"/g)].map((m) => m[1]);
const commonFile = path.join(SCHEMA_DIR, 'common.schema.json');
const common = JSON.parse(fs.readFileSync(commonFile, 'utf8'));
common.$defs.iconName.enum = icons;
common.$defs.iconName.description = 'Icon from the built-in sprite (SPRITE in src/components/_primitives.mjs).';
out['common.schema.json'] = common;

const tokensFile = path.join(SCHEMA_DIR, 'tokens.schema.json');
const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
tokens.properties['font-role'] = { $ref: '#/$defs/group', description: 'Which font each role uses: heading, button, ornament (Church Slavonic) and body.' };
out['tokens.schema.json'] = tokens;

for (const [name, schema] of Object.entries(out)) fs.writeFileSync(path.join(SCHEMA_DIR, name), `${JSON.stringify(schema, null, 2)}\n`);
for (const name of ['layout.schema.json', 'events.schema.json', 'ministries.schema.json']) fs.rmSync(path.join(SCHEMA_DIR, name), { force: true });
console.log(`Wrote ${Object.keys(out).length} schemas.`);
