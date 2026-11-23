// Small building blocks shared by all components.
import { html, raw, attrs, cx } from '../lib/html.mjs';

// The Russian Orthodox eight-pointed cross, the one drawing used for every
// cross on the site. Titulus, main crossbar and a footrest whose LEFT end
// (viewer's left: Christ's right hand, toward the penitent thief) is higher.
// Bars are 4 units on a 24 x 40 grid, so at 12 x 20 px each bar is 2 px.
export const CROSS_VIEWBOX = '0 0 24 40';
export const CROSS_PATH = 'M10 0h4v40h-4zM6 4h12v4H6zM0 12h24v4H0zM4 22l16 8v4L4 26z';

// Inline SVG sprite, emitted once per page by the layout.
export const SPRITE = raw(`<svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false"><defs>
<symbol id="i-cross" viewBox="${CROSS_VIEWBOX}"><path d="${CROSS_PATH}" fill="currentColor"/></symbol>
<symbol id="i-arch" viewBox="0 0 120 28"><path d="M1 27V19C1 13 23 12.3 43 8.6 51.5 7 57 4.2 60 1 63 4.2 68.5 7 77 8.6 97 12.3 119 13 119 19V27" fill="none" stroke="currentColor" stroke-width="1.2"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-external" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-doc" viewBox="0 0 24 24"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 13h6M9 17h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-audio" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M6.6 3.5 9 3l1.6 4-2 1.3a11 11 0 0 0 7.1 7.1l1.3-2 4 1.6-.5 2.4a2 2 0 0 1-2 1.6A16.6 16.6 0 0 1 5 5.5a2 2 0 0 1 1.6-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><path d="M3.5 6.5h17v11h-17zM4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11.3a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="9.7" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/></symbol>
<symbol id="i-chevron" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></symbol>
<symbol id="i-youtube" viewBox="0 0 24 24"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z" fill="currentColor"/></symbol>
<symbol id="i-facebook" viewBox="0 0 24 24"><path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4A20 20 0 0 0 14.3 4c-2.2 0-3.8 1.4-3.8 3.9v2.6H8v3h2.5V21z" fill="currentColor"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
<symbol id="i-calendar" viewBox="0 0 24 24"><path d="M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m15 15 5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-live" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></symbol>
<symbol id="i-pause" viewBox="0 0 24 24"><path d="M8.5 6.5v11M15.5 6.5v11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
<symbol id="i-cart" viewBox="0 0 24 24"><path d="M5.5 8.5h13l-1.2 11.2a1 1 0 0 1-1 .8H7.7a1 1 0 0 1-1-.8zM9 10.5V7a3 3 0 0 1 6 0v3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
<symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.6a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7M10.2 10.5v6.5M13.8 10.5v6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.8 20.5c.8-3.8 3.6-5.8 7.2-5.8s6.4 2 7.2 5.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></symbol>
<!-- Orthodox pictograms (same line style as the utility icons above) -->
<symbol id="i-church" viewBox="0 0 24 24"><path d="M12 1.8v3.4M10.9 2.9h2.2M11.2 4.3l1.6.6M12 5.6c-1.8 1.7-3.6 2.8-3.6 4.7 0 1.4 1.2 2.4 3.6 2.4s3.6-1 3.6-2.4c0-1.9-1.8-3-3.6-4.7zM9.6 12.7v2.1h4.8v-2.1M5.5 21v-6.2h13V21M10.4 21v-2.6a1.6 1.6 0 0 1 3.2 0V21M3.5 21h17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-candle" viewBox="0 0 24 24"><path d="M12 3.2c1.7 2 2.3 3.3 1.5 4.6a1.8 1.8 0 0 1-3 0c-.8-1.3-.2-2.6 1.5-4.6zM10.4 10.5h3.2V19h-3.2zM7 19h10M8.5 21h7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-chalice" viewBox="0 0 24 24"><path d="M6.5 3.5h11c0 4.2-2.3 7-5.5 7s-5.5-2.8-5.5-7zM12 10.5v1.6M12 15.1v2M7.8 20.5c0-1.9 1.9-3.4 4.2-3.4s4.2 1.5 4.2 3.4zM12 12.1c.9 0 1.6.7 1.6 1.5s-.7 1.5-1.6 1.5-1.6-.7-1.6-1.5.7-1.5 1.6-1.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-censer" viewBox="0 0 24 24"><path d="M12 2.2v1.6M7.2 11.2 11.3 4M16.8 11.2 12.7 4M12 4v4.8M8.6 11.2a3.4 3.4 0 0 1 6.8 0M6.5 11.2h11c0 3.1-2.5 5.4-5.5 5.4s-5.5-2.3-5.5-5.4zM12 16.6v2.2M9.8 18.8h4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-bell" viewBox="0 0 24 24"><circle cx="12" cy="2.9" r="1.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4v1.4M7.2 16.5c.7-1.1 1-2.6 1-4.6v-2a3.8 3.8 0 0 1 7.6 0v2c0 2 .3 3.5 1 4.6zM5.5 16.5h13M10.7 18.7a1.4 1.4 0 0 0 2.6 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-gospel" viewBox="0 0 24 24"><path d="M6.2 3.5h12.3v17H6.2a1.7 1.7 0 0 1-1.7-1.7V5.2a1.7 1.7 0 0 1 1.7-1.7zM4.5 18.8c0-.9.8-1.6 1.7-1.6h12.3M11.5 6.3v8.4M10.1 7.6h2.8M8.6 9.7h5.8M10.1 12.4l2.8 1.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-prayer-rope" viewBox="0 0 24 24"><path d="M12 14.6C7.2 11.6 6 8.6 6 6.9 6 4.2 8.7 2.4 12 2.4s6 1.8 6 4.5c0 1.7-1.2 4.7-6 7.7z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-dasharray="0.01 2.05"/><circle cx="12" cy="15.9" r="1.1" fill="currentColor"/><path d="M12 17.2l-2.6 4.4h5.2zM12 17.2v4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-icon-frame" viewBox="0 0 24 24"><path d="M4.5 21V9.8C4.5 5.6 7.8 3 12 3s7.5 2.6 7.5 6.8V21zM7.6 18V10.6C7.6 8 9.5 6.2 12 6.2s4.4 1.8 4.4 4.4V18zM12 9.1a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4zM9.6 18v-2.3a2.4 2.4 0 0 1 4.8 0V18M3.2 21h17.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-crowns" viewBox="0 0 24 24"><path d="M2.8 18.5 2 10.5l2.6 2.2 1.9-4.2 1.9 4.2L11 10.5l-.8 8zM13.8 18.5 13 10.5l2.6 2.2 1.9-4.2 1.9 4.2L22 10.5l-.8 8zM6.5 6.6V3.4M5.4 4.4h2.2M17.5 6.6V3.4M16.4 4.4h2.2M2.8 16.3h7.4M13.8 16.3h7.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-font" viewBox="0 0 24 24"><path d="M3.5 10.5h17c0 3.6-3.8 6-8.5 6s-8.5-2.4-8.5-6zM12 16.5v3M8 20.5h8M12 2.5v5.5M10.6 3.9h2.8M10.7 6.2l2.6 1.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-oil" viewBox="0 0 24 24"><path d="M10 3.5h4M10.6 3.5v3.2c-2.9.9-4.6 3.5-4.6 6.8 0 3.9 2.7 7 6 7s6-3.1 6-7c0-3.3-1.7-5.9-4.6-6.8V3.5M12 10.3v5.6M10.3 11.8h3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-slip" viewBox="0 0 24 24"><path d="M5.5 2.5h13v19h-13zM12 4.8v4.4M10.6 5.6h2.8M9.6 6.9h4.8M10.6 8.4l2.8.9M8.5 12.5h7M8.5 15.3h7M8.5 18.1h4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-house" viewBox="0 0 24 24"><path d="M3.5 11.5 12 5l8.5 6.5M5.8 9.8V20.5h12.4V9.8M10 20.5v-5h4v5M12 1.5v3M10.8 2.5h2.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
</defs></svg>`);

export const icon = (name, className = 'icon') => html`<svg class="${className}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

// Every cross on the page goes through this (no ☦ text glyphs: fonts draw them inconsistently).
export const cross = (className = 'cross') => icon('cross', className);

export function eyebrow(text) {
  if (!text) return '';
  return html`<p class="eyebrow">${cross('eyebrow__cross')}<span>${text}</span></p>`;
}

// Accent line in the ornament font role (a Slavonic face by default). Plain
// strings are in site.accent.lang (the parish's liturgical language).
export const accentLang = (ctx) => ctx.site.accent?.lang || 'ru';

export function accent(value, ctx, className = 'accent') {
  if (!value) return '';
  const isPlain = typeof value === 'string';
  const text = isPlain ? value : ctx.l(value);
  if (!text) return '';
  const lang = isPlain ? accentLang(ctx) : ctx.lx(value).lang;
  return html`<p class="${className}"${attrs({ lang: lang !== ctx.locale ? lang : null })}>${text}</p>`;
}

// An accent line that only repeats the heading (e.g. on the Russian page) is dropped.
export const sameText = (a, b) => !!a && !!b && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

export function accentUnlessSame(value, title, ctx, className) {
  const text = typeof value === 'string' ? value : ctx.l(value);
  return sameText(text, title) ? '' : accent(value, ctx, className);
}

export function sectionHead(props, ctx, { align = 'start', level = 2, className } = {}) {
  const { eyebrow: eb, title, accent: ac, intro } = props;
  if (!eb && !title && !ac && !intro) return '';
  const Tag = `h${level}`;
  const titleText = ctx.l(title);
  return html`<header class="${cx('section-head', `section-head--${align}`, className)}">
    ${eyebrow(ctx.l(eb))}
    ${titleText ? raw(`<${Tag} class="section-head__title">`) : ''}${titleText}${titleText ? raw(`</${Tag}>`) : ''}
    ${ac ? accentUnlessSame(ac, titleText, ctx, 'section-head__accent accent') : ''}
    ${intro ? html`<div class="section-head__intro">${ctx.md(intro)}</div>` : ''}
  </header>`;
}

// One button look per position: the first action is the main one, the
// second is quieter. Areas on navy (hero, call-to-action band) pass
// { onDark: true } for the light versions.
export function button(action, ctx, { className, size, rank = 0, onDark = false } = {}) {
  if (!action) return '';
  const url = ctx.href(action);
  if (!url) return '';
  const external = ctx.isExternal(url);
  const style = rank === 0 ? (onDark ? 'btn--accent' : 'btn--primary') : onDark ? 'btn--light' : 'btn--secondary';
  return html`<a${attrs({
    class: cx('btn', style, size && `btn--${size}`, className),
    href: url,
    target: external ? '_blank' : null,
    rel: external ? 'noopener' : null,
    'data-kind': action.document ? 'pdf' : null
  })}><span>${ctx.l(action.label)}</span>${external ? icon('external', 'btn__icon') : ''}</a>`;
}

export function actions(list, ctx, { className, size, onDark } = {}) {
  const urls = (list || []).filter((a) => ctx.href(a));
  if (!urls.length) return '';
  return html`<div class="${cx('actions', className)}">${urls.map((a, i) => button(a, ctx, { size, rank: i, onDark }))}</div>`;
}

// Image object: { src, alt, caption, position, width, height }
export function image(img, ctx, { className, loading = 'lazy', sizes, priority = false } = {}) {
  if (!img || !img.src) return '';
  const size = ctx.imageSize(img.src) || {};
  return html`<img${attrs({
    class: className,
    src: ctx.asset(img.src),
    alt: ctx.l(img.alt) || '',
    width: img.width || size.width,
    height: img.height || size.height,
    loading: priority ? null : loading,
    decoding: priority ? null : 'async',
    fetchpriority: priority ? 'high' : null,
    srcset: img.srcset,
    sizes: img.srcset ? sizes : null,
    style: img.position ? `object-position:${img.position}` : null
  })}>`;
}

export function figure(img, ctx, { className, frame = 'plain', ...rest } = {}) {
  if (!img || !img.src) return '';
  const caption = ctx.l(img.caption);
  return html`<figure class="${cx('figure', `figure--${frame}`, className)}">
    <div class="figure__media">${image(img, ctx, rest)}</div>
    ${caption ? html`<figcaption class="figure__caption">${caption}</figcaption>` : ''}
  </figure>`;
}

export function linkTo(link, ctx, content, { className } = {}) {
  const url = ctx.href(link);
  if (!url) return '';
  const external = ctx.isExternal(url);
  return html`<a${attrs({ class: className, href: url, target: external ? '_blank' : null, rel: external ? 'noopener' : null })}>${content}</a>`;
}

export const phoneHref = (phone) => (phone?.e164 ? `tel:${phone.e164}` : null);

// Dated lists with a limit render a few spare rows (hidden) so the client
// script can top the list back up as dates pass, without a rebuild.
export const SPARE_ROWS = 6;
export const withSpares = (list, limit) => (limit ? list.slice(0, limit + SPARE_ROWS) : list);
export const spareHidden = (index, limit) => (limit && index >= limit ? true : null);
