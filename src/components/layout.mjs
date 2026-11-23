// Page shell: <head> (SEO, Open Graph, hreflang, JSON-LD), sticky header with
// the page-tree menu, language switcher, cart and Donate button, the mobile
// drawer and the footer.
// Data: site.json, navigation.json, ui.json, the page tree (content/pages).
import { html, raw, attrs, cx } from '../lib/html.mjs';
import { SPRITE, icon, cross, phoneHref, accentLang } from './_primitives.mjs';
import { renderSection } from './registry.mjs';
import { addressLines } from './contact.mjs';
import { clientData } from './client-data.mjs';
import { featureEnabled } from '../lib/content.mjs';

function pageUrls(ctx) {
  return Object.fromEntries(ctx.localeCodes.map((code) => [code, ctx.pagePath(ctx.page.id, { locale: code })]));
}

// ---------------------------------------------------------------- brand

// One brand treatment: the parish's logo image (any shape: a round seal, an
// icon in a kiot, a square badge) at a fixed height beside the parish name.
// Without logo.image the name stands alone with the eight-pointed cross.
export function brand(ctx, { place = 'header' } = {}) {
  const logo = ctx.site.logo || {};
  const name = ctx.l(ctx.site.name);
  const tagline = ctx.l(ctx.site.location);
  return html`<a class="${cx('brand', `brand--${place}`, !logo.image && 'brand--text')}" href="${ctx.pagePath('home')}">
    ${logo.image
      ? html`<span class="brand__mark"><img src="${ctx.asset(logo.image)}" alt="" width="${ctx.logo.width}" height="${ctx.logo.height}"${place === 'footer' ? html` loading="lazy"` : ''}></span>`
      : html`<span class="brand__mark brand__mark--cross">${cross('brand__cross')}</span>`}
    <span class="brand__text">
      <span class="brand__name">${name}</span>
      ${tagline ? html`<span class="brand__tagline">${tagline}</span>` : ''}
    </span>
  </a>`;
}

// ---------------------------------------------------------------- languages

// One language: no switcher. Two or three: a segmented control. Four or
// more: a compact menu (the drawer always lists every language by name).
function langSwitch(ctx, place) {
  const locales = ctx.site.locales;
  if (locales.length < 2) return '';
  const urls = pageUrls(ctx);
  const link = (l, className, text) =>
    html`<a${attrs({ class: className, href: urls[l.code], hreflang: l.code, lang: l.code, dir: l.dir === 'rtl' ? 'rtl' : null, 'aria-current': l.code === ctx.locale ? 'true' : null, 'data-lang': l.code, title: text === l.name ? null : l.name })}>${text}</a>`;
  if (place === 'drawer') {
    return html`<div class="lang-list" role="group" aria-label="${ctx.t('a11y.language')}">
      ${locales.map((l) => link(l, 'lang-list__link lang-switch__link', l.name))}
    </div>`;
  }
  if (locales.length <= 3) {
    return html`<div class="${cx('lang-switch', `lang-switch--${place}`)}" role="group" aria-label="${ctx.t('a11y.language')}">
      ${locales.map((l) => link(l, 'lang-switch__link', l.label))}
    </div>`;
  }
  return html`<details class="${cx('lang-menu', `lang-menu--${place}`)}" data-lang-menu>
    <summary class="lang-menu__button" aria-label="${ctx.t('a11y.language')}: ${ctx.localeInfo.name}">${icon('globe', 'lang-menu__icon')}<span>${ctx.localeInfo.label}</span>${icon('chevron', 'lang-menu__chevron')}</summary>
    <div class="lang-menu__list">${locales.map((l) => link(l, 'lang-menu__link lang-switch__link', l.name))}</div>
  </details>`;
}

// ---------------------------------------------------------------- menu

// The menu is the page tree: every page with nav.show !== false, in `order`,
// children under their parent. navigation.header.extra adds plain links.
export function navTree(ctx) {
  const shown = (p) => p.nav?.show !== false && p.id !== 'not-found';
  const pages = ctx.content.pages.filter(shown);
  // nav.overview names the parent page itself as the first item of its
  // dropdown (e.g. "Schedule" under "Services").
  const node = (p) => {
    const children = pages.filter((c) => c.parent === p.id).map(node);
    const overview = children.length && p.nav?.overview ? [{ id: `${p.id}-overview`, page: p.id, label: ctx.l(p.nav.overview), live: false, overview: true, children: [] }] : [];
    return {
      id: p.id,
      page: p.id,
      label: ctx.pageTitle(p, { short: true }),
      live: p.requires === 'livestream',
      children: [...overview, ...children]
    };
  };
  const top = pages.filter((p) => !p.parent).map(node);
  const extra = (ctx.content.navigation.header?.extra || []).map((l) => ({ id: l.id, href: ctx.href(l), label: ctx.l(l.label), external: ctx.isExternal(ctx.href(l)), children: [] }));
  return [...top, ...extra];
}

const isCurrentPage = (item, ctx) => item.page === ctx.page.id && (item.overview || !item.children.some((c) => c.overview));
const inBranch = (item, ctx) => item.page === ctx.page.id || ctx.page.ancestors?.includes(item.page) || item.children.some((c) => inBranch(c, ctx));
const itemHref = (item, ctx) => item.href || ctx.pagePath(item.page);

function liveDot(item) {
  return item.live ? html`<span class="live-dot" data-live-indicator hidden><span class="visually-hidden"> (live)</span></span>` : '';
}

function subList(items, ctx, depth) {
  return html`<ul class="${cx('nav__dropdown-list', depth > 1 && 'nav__dropdown-list--nested')}">
    ${items.map(
      (c) => html`<li><a${attrs({ class: 'nav__sublink', href: itemHref(c, ctx), 'aria-current': isCurrentPage(c, ctx) ? 'page' : null })}>${c.label}${liveDot(c)}</a>
        ${c.children.length ? subList(c.children, ctx, depth + 1) : ''}</li>`
    )}
  </ul>`;
}

function navItem(item, ctx) {
  const current = inBranch(item, ctx);
  const link = html`<a${attrs({ class: 'nav__link', href: itemHref(item, ctx), 'aria-current': isCurrentPage(item, ctx) ? 'page' : null, target: item.external ? '_blank' : null, rel: item.external ? 'noopener' : null })}>${item.label}${liveDot(item)}</a>`;
  if (!item.children.length) return html`<li class="${cx('nav__item', current && 'is-current')}">${link}</li>`;
  return html`<li class="${cx('nav__item', 'nav__item--parent', current && 'is-current')}">
    ${link}<button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-${item.id}"><span class="visually-hidden">${ctx.t('a11y.submenu', { name: item.label })}</span>${icon('chevron', 'nav__chevron')}</button>
    <div class="nav__dropdown" id="nav-${item.id}">${subList(item.children, ctx, 1)}</div>
  </li>`;
}

function drawerItems(items, ctx, depth = 0) {
  return html`<ul class="${cx('drawer-nav', depth && 'drawer-nav--sub')}">
    ${items.map((item) => {
      const link = html`<a${attrs({ class: 'drawer-nav__link', href: itemHref(item, ctx), 'aria-current': isCurrentPage(item, ctx) ? 'page' : null })}>${item.label}${liveDot(item)}</a>`;
      if (!item.children.length) return html`<li class="drawer-nav__item">${link}</li>`;
      const open = inBranch(item, ctx);
      return html`<li class="drawer-nav__item drawer-nav__item--parent">
        <div class="drawer-nav__row">${link}<button class="drawer-nav__toggle" type="button" aria-expanded="${open ? 'true' : 'false'}" aria-controls="drawer-${item.id}"><span class="visually-hidden">${ctx.t('a11y.submenu', { name: item.label })}</span>${icon('chevron', 'drawer-nav__chevron')}</button></div>
        <div class="drawer-nav__children" id="drawer-${item.id}"${open ? '' : html` hidden`}>${drawerItems(item.children, ctx, depth + 1)}</div>
      </li>`;
    })}
  </ul>`;
}

// The Donate button: navigation.header.button ({ page, label }).
function headerActions(ctx, className) {
  const b = ctx.content.navigation.header?.button;
  const url = b && ctx.href(b);
  if (!url) return '';
  const label = ctx.l(b.label) || ctx.pageTitle(ctx.content.index.pages[b.page] || { title: '' }, { short: true });
  return html`<a class="${cx('btn', 'btn--accent', className)}" href="${url}"${ctx.page.id === b.page ? html` aria-current="page"` : ''}>${icon('candle', 'btn__icon')}<span>${label}</span></a>`;
}

// Cart icon with a live item count (site.js keeps it in sync with the cart
// in localStorage). Shown while the store is on.
function cartLink(ctx) {
  if (!featureEnabled(ctx.site, 'store')) return '';
  const page = ctx.content.pages.find((p) => p.requires === 'cart');
  if (!page) return '';
  return html`<a class="cart-link" href="${ctx.pagePath(page.id)}" data-cart-link>${icon('cart', 'cart-link__icon')}<span class="cart-link__count" data-cart-count hidden>0</span><span class="visually-hidden">${ctx.t('cart.title')}</span></a>`;
}

function header(ctx, tree) {
  return html`<header class="site-header" data-header>
    <div class="container site-header__inner">
      ${brand(ctx)}
      <nav class="site-nav" id="site-nav" aria-label="${ctx.t('a11y.mainNav')}" data-nav>
        <ul class="nav__list">${tree.filter((i) => i.page !== 'home').map((i) => navItem(i, ctx))}
          <li class="nav__item nav__item--parent nav__item--more" data-nav-more hidden>
            <button class="nav__link nav__more" type="button" aria-expanded="false" aria-controls="nav-more">${ctx.t('a11y.more')}${icon('chevron', 'nav__chevron')}</button>
            <div class="nav__dropdown nav__dropdown--more" id="nav-more"><ul class="nav__dropdown-list" data-nav-more-list></ul></div>
          </li>
        </ul>
      </nav>
      <div class="site-header__tools">
        ${langSwitch(ctx, 'header')}
        ${cartLink(ctx)}
        ${headerActions(ctx, 'site-header__action')}
        <button class="burger" type="button" aria-expanded="false" aria-controls="site-drawer" aria-haspopup="dialog" data-burger>
          ${icon('menu', 'burger__icon')}<span class="burger__label">${ctx.t('a11y.menu')}</span>
        </button>
      </div>
    </div>
  </header>`;
}

function drawer(ctx, tree) {
  const c = ctx.site.contact;
  return html`<div class="drawer" id="site-drawer" data-drawer hidden>
    <div class="drawer__backdrop" data-drawer-close></div>
    <div class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabindex="-1">
      <div class="drawer__head">
        <p class="drawer__title" id="drawer-title">${cross('drawer__cross')}<span>${ctx.t('a11y.menu')}</span></p>
        <button class="drawer__close" type="button" data-drawer-close>${icon('close', 'drawer__close-icon')}<span class="visually-hidden">${ctx.t('a11y.closeMenu')}</span></button>
      </div>
      <nav class="drawer__nav" aria-label="${ctx.t('a11y.mainNav')}">${drawerItems(tree, ctx)}</nav>
      <div class="drawer__actions">${headerActions(ctx, 'btn--block')}</div>
      ${langSwitch(ctx, 'drawer')}
      <div class="drawer__contact">
        <p class="drawer__address">${icon('pin', 'drawer__icon')}<span><bdi>${addressLines(ctx).join(', ')}</bdi></span></p>
        ${c.phone ? html`<p><a href="${phoneHref(c.phone)}">${icon('phone', 'drawer__icon')}<span><bdi dir="ltr">${c.phone.display}</bdi></span></a></p>` : ''}
        ${c.directionsUrl ? html`<p><a href="${c.directionsUrl}" target="_blank" rel="noopener">${icon('arrow', 'drawer__icon')}<span>${ctx.t('contact.directions')}</span></a></p>` : ''}
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- footer

// Shown only when features.newsletter is on (the OrthodoxConnect newsletter).
// The submit handler is a placeholder in site.js.
function newsletter(ctx) {
  if (!featureEnabled(ctx.site, 'newsletter')) return '';
  return html`<div class="site-footer__newsletter">
    <h2 class="site-footer__title">${ctx.t('newsletter.title')}</h2>
    <p class="site-footer__newsletter-text">${ctx.t('newsletter.text')}</p>
    <form class="newsletter" data-form="newsletter" data-list="${ctx.site.orthodoxConnect?.newsletterListId || ''}" novalidate>
      <label class="visually-hidden" for="newsletter-email">${ctx.t('form.email')}</label>
      <input class="newsletter__input" id="newsletter-email" name="email" type="email" autocomplete="email" required placeholder="${ctx.t('newsletter.placeholder')}">
      <button class="btn btn--accent newsletter__button" type="submit">${ctx.t('newsletter.subscribe')}</button>
      <p class="form-status newsletter__status" role="status" aria-live="polite" data-form-status></p>
    </form>
  </div>`;
}

function footer(ctx, tree) {
  const f = ctx.content.navigation.footer;
  const c = ctx.site.contact;
  const year = new Date().getFullYear();
  const accentName = ctx.site.accent?.name;
  const flat = (items) => items.flatMap((i) => [i, ...flat(i.children)]);
  const pageLinks = (f.pages === 'top' ? tree : flat(tree)).filter((i) => !i.external && !i.overview);
  return html`<footer class="site-footer">
    <div class="container">
      <div class="site-footer__brand">
        ${brand(ctx, { place: 'footer' })}
        <div class="site-footer__intro">
          <p class="site-footer__about">${ctx.l(f.about)}</p>
          ${accentName && accentName !== ctx.l(ctx.site.name) ? html`<p class="site-footer__slavonic accent" lang="${accentLang(ctx)}">${accentName}</p>` : ''}
        </div>
      </div>
      <div class="${cx('site-footer__top', featureEnabled(ctx.site, 'newsletter') && 'site-footer__top--newsletter')}">
        <div class="site-footer__visit">
          <h2 class="site-footer__title">${ctx.t('footer.visit')}</h2>
          <address class="site-footer__address">${addressLines(ctx).map((l, i) => html`${i ? html`<br>` : ''}<bdi>${l}</bdi>`)}</address>
          <ul class="site-footer__contact">
            ${c.phone ? html`<li><a href="${phoneHref(c.phone)}">${icon('phone', 'site-footer__icon')}<span><bdi dir="ltr">${c.phone.display}</bdi></span></a></li>` : ''}
            ${c.email ? html`<li><a href="mailto:${c.email}">${icon('mail', 'site-footer__icon')}<span>${c.email}</span></a></li>` : ''}
            ${c.directionsUrl ? html`<li><a href="${c.directionsUrl}" target="_blank" rel="noopener">${icon('pin', 'site-footer__icon')}<span>${ctx.t('contact.directions')}</span></a></li>` : ''}
          </ul>
        </div>
        <div class="site-footer__col">
          <h2 class="site-footer__title">${ctx.t('footer.pages')}</h2>
          <ul class="site-footer__links site-footer__links--pages">${pageLinks.map((i) => html`<li><a href="${itemHref(i, ctx)}">${i.label}</a></li>`)}</ul>
        </div>
        <div class="site-footer__col">
          <h2 class="site-footer__title">${ctx.t('footer.connect')}</h2>
          <ul class="site-footer__links">
            ${(f.connect || []).map((l) => {
              const url = ctx.href(l);
              if (!url) return '';
              const ext = ctx.isExternal(url);
              return html`<li><a href="${url}"${ext ? html` target="_blank" rel="noopener"` : ''}>${l.icon ? icon(l.icon, 'site-footer__icon') : ''}<span>${ctx.l(l.label)}</span></a></li>`;
            })}
            ${ctx.site.social.map((s) => html`<li><a href="${s.url}" target="_blank" rel="noopener">${icon(s.icon, 'site-footer__icon')}<span>${ctx.l(s.label)}</span></a></li>`)}
          </ul>
        </div>
        ${newsletter(ctx)}
      </div>
      <div class="site-footer__bottom">
        <p>${cross('site-footer__cross')}<span>© ${year} ${ctx.l(ctx.site.name)}. ${ctx.l(f.legal)}</span></p>
        ${langSwitch(ctx, 'footer')}
      </div>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------- head

function jsonLd(ctx) {
  const s = ctx.site;
  const a = s.contact.address;
  const otherNames = ctx.localeCodes.filter((c) => c !== ctx.locale).map((c) => s.name[c]).filter((n) => n && n !== ctx.l(s.name));
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: ctx.l(s.name),
    alternateName: otherNames.length ? otherNames : undefined,
    url: ctx.absoluteUrl(ctx.pagePath('home')),
    logo: ctx.logo.icon ? ctx.absoluteUrl(ctx.asset(ctx.logo.icon)) : undefined,
    telephone: s.contact.phone?.e164,
    email: s.contact.email,
    address: { '@type': 'PostalAddress', streetAddress: a.street, addressLocality: a.city, addressRegion: a.region, postalCode: a.postalCode, addressCountry: a.country },
    geo: s.contact.geo ? { '@type': 'GeoCoordinates', latitude: s.contact.geo.lat, longitude: s.contact.geo.lng } : undefined,
    sameAs: s.social.map((x) => x.url),
    parentOrganization: s.jurisdiction ? { '@type': 'Organization', name: ctx.l(s.jurisdiction.name), url: s.jurisdiction.url } : undefined
  };
  return raw(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
}

function head(ctx, assets) {
  const { cssHref, jsHref } = assets;
  const { site, page } = ctx;
  const seo = page.seo || {};
  const siteName = ctx.l(site.seo.siteName);
  const pageTitle = ctx.l(seo.title) || ctx.l(page.title);
  const title = page.id === 'home' ? ctx.l(site.seo.title) : `${pageTitle} · ${siteName}`;
  const description = ctx.l(seo.description) || ctx.l(site.seo.description);
  const urls = pageUrls(ctx);
  const canonical = ctx.absoluteUrl(urls[ctx.locale]);
  const ogImage = ctx.absoluteUrl(ctx.asset(seo.image || site.seo.image));
  const fontsPreload = assets.preloadFonts || [];
  return html`<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${page.noindex ? html`<meta name="robots" content="noindex">\n` : ''}<link rel="canonical" href="${canonical}">
${ctx.localeCodes.map((code) => html`<link rel="alternate" hreflang="${code}" href="${ctx.absoluteUrl(urls[code])}">\n`)}<link rel="alternate" hreflang="x-default" href="${ctx.absoluteUrl(urls[ctx.sourceLocale])}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${siteName}">
<meta property="og:title" content="${page.id === 'home' ? title : pageTitle}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:locale" content="${ctx.localeInfo.ogLocale}">
${ctx.site.locales.filter((l) => l.code !== ctx.locale).map((l) => html`<meta property="og:locale:alternate" content="${l.ogLocale}">\n`)}<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${assets.themeColor}">
<link rel="icon" href="${ctx.asset(ctx.logo.favicon)}"${/\.svg$/i.test(ctx.logo.favicon) ? html` type="image/svg+xml"` : ''}>
${ctx.logo.icon ? html`<link rel="apple-touch-icon" href="${ctx.asset(ctx.logo.icon)}">\n` : ''}${fontsPreload.map((f) => html`<link rel="preload" href="${ctx.asset(f)}" as="font" type="font/woff2" crossorigin>\n`)}<link rel="stylesheet" href="${cssHref}">
<script>document.documentElement.classList.add('js')</script>
<script src="${jsHref}" defer></script>
${jsonLd(ctx)}
</head>`;
}

export function renderPage(ctx, assets) {
  const { page } = ctx;
  const tree = navTree(ctx);
  return `<!doctype html>
<html lang="${ctx.locale}" dir="${ctx.dir}" data-page="${page.id}" data-timezone="${ctx.site.timezone}" data-currency="${ctx.currency}">
${head(ctx, assets)}
<body class="page-${page.id}">
${html`<a class="skip-link" href="#main">${ctx.t('a11y.skip')}</a>
${SPRITE}
${header(ctx, tree)}
<main id="main" tabindex="-1">
${page.sections.map((s) => renderSection(s, ctx))}
</main>
${footer(ctx, tree)}
${drawer(ctx, tree)}
<div class="lightbox" data-lightbox-root hidden role="dialog" aria-modal="true" aria-label="${ctx.t('gallery.viewer')}">
  <button class="lightbox__btn lightbox__close" type="button" data-lb-close aria-label="${ctx.t('gallery.close')}">${icon('close')}</button>
  <button class="lightbox__btn lightbox__prev" type="button" data-lb-prev aria-label="${ctx.t('gallery.prev')}">${icon('chevron')}</button>
  <figure class="lightbox__figure"><img alt="" data-lb-img><figcaption data-lb-caption></figcaption></figure>
  <button class="lightbox__btn lightbox__next" type="button" data-lb-next aria-label="${ctx.t('gallery.next')}">${icon('chevron')}</button>
  <p class="lightbox__count" data-lb-count aria-live="polite"></p>
</div>
<dialog class="modal schedule-detail" data-schedule-dialog aria-labelledby="schedule-detail-title">
  <div class="modal__panel">
    <div class="modal__head">
      <h2 class="modal__title" id="schedule-detail-title" data-sd-title></h2>
      <button class="icon-btn modal__close" type="button" data-modal-close>${icon('close', 'icon-btn__icon')}<span class="visually-hidden">${ctx.t('form.close')}</span></button>
    </div>
    <dl class="schedule-detail__meta">
      <div><dt>${ctx.t('schedule.when')}</dt><dd data-sd-when></dd></div>
      <div data-sd-where-row><dt>${ctx.t('schedule.where')}</dt><dd data-sd-where></dd></div>
      <div><dt>${ctx.t('schedule.note')}</dt><dd data-sd-note></dd></div>
    </dl>
    <div class="schedule-detail__actions modal__actions">
      <div class="schedule-detail__calendar">
        <span class="schedule-detail__cal-label">${ctx.t('schedule.addToCalendar')}</span>
        <button class="btn btn--secondary btn--sm" type="button" data-sd-ics>${icon('calendar', 'btn__icon')}<span>${ctx.t('schedule.downloadIcs')}</span></button>
        <a class="btn btn--secondary btn--sm" data-sd-gcal target="_blank" rel="noopener">${icon('calendar', 'btn__icon')}<span>${ctx.t('schedule.googleCalendar')}</span></a>
      </div>
      <a class="btn btn--primary btn--sm" data-sd-directions target="_blank" rel="noopener" hidden>${icon('pin', 'btn__icon')}<span>${ctx.t('schedule.getDirections')}</span></a>
      <a class="btn btn--accent btn--sm" data-sd-live target="_blank" rel="noopener" hidden>${icon('live', 'btn__icon')}<span>${ctx.t('schedule.watchLive')}</span></a>
    </div>
  </div>
</dialog>
${clientData(ctx)}`.toString()}
</body>
</html>
`;
}
