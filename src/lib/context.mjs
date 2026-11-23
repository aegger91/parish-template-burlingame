// The render context passed to every component: current locale, content,
// and helpers for localized text, URLs, markdown, dates and images.
import { Marked } from 'marked';
import { esc, raw } from './html.mjs';
import { pickLocale, formatDate, formatTime, interpolate } from './i18n.mjs';
import { imageSize } from './images.mjs';
import { PUBLIC_DIR } from './content.mjs';
import { feastsOn, churchDate, toIso } from './calendar.mjs';

const ASSET_PREFIXES = ['/assets/', '/logo/'];

export function createContext({ content, locale, page, basePath = '', siteUrl }) {
  const { site } = content;
  const localeCodes = site.locales.map((l) => l.code);
  const sourceLocale = site.sourceLocale;

  const ctx = {
    content,
    site,
    page,
    locale,
    sourceLocale,
    localeCodes,
    localeInfo: site.locales.find((l) => l.code === locale),
    basePath,
    siteUrl
  };

  ctx.l = (value) => pickLocale(value, locale, sourceLocale).text;
  ctx.lx = (value) => pickLocale(value, locale, sourceLocale);

  ctx.t = (key, vars) => {
    const entry = content.ui.strings[key];
    if (!entry) throw new Error(`Missing UI string "${key}"`);
    return interpolate(ctx.l(entry), vars);
  };

  ctx.asset = (p) => (!p || /^(https?:|mailto:|tel:|data:)/.test(p) ? p : `${basePath}${p.startsWith('/') ? p : `/${p}`}`);

  ctx.dir = ctx.localeInfo?.dir === 'rtl' ? 'rtl' : 'ltr';
  ctx.pageOn = (pageId) => !!content.index.pages[pageId];

  // Links to a page that is switched off (enabled: false, or a feature it
  // requires is off) resolve to null and are left out by every component.
  ctx.pagePath = (pageId, { anchor, locale: loc = locale } = {}) => {
    const target = content.index.pages[pageId];
    if (!target) {
      if (content.index.allPages?.[pageId]) return null;
      throw new Error(`Unknown page id "${pageId}" (from page "${page?.id}")`);
    }
    const slug = target.path ? `${target.path}/` : '';
    return `${basePath}/${loc}/${slug}${anchor ? `#${anchor}` : ''}`;
  };

  ctx.pageTitle = (p, { short = false } = {}) => ctx.l((short && p.nav?.label) || p.title);

  // Root-relative links written by editors ("/services/#upcoming") are
  // made locale-aware; assets and already-prefixed paths are left alone.
  ctx.localizePath = (href) => {
    if (!href || !href.startsWith('/') || href.startsWith('//')) return href;
    if (ASSET_PREFIXES.some((p) => href.startsWith(p))) return ctx.asset(href);
    if (localeCodes.some((c) => href === `/${c}` || href.startsWith(`/${c}/`))) return `${basePath}${href}`;
    return `${basePath}/${locale}${href}`;
  };

  // A Link is { page, anchor } | { href } | { document } | { email, subject } | { phone }
  ctx.href = (link) => {
    if (!link) return null;
    if (link.page) return ctx.pagePath(link.page, { anchor: link.anchor });
    if (link.document) return ctx.documentUrl(link.document);
    if (link.email) return `mailto:${link.email}${link.subject ? `?subject=${encodeURIComponent(ctx.l(link.subject))}` : ''}`;
    if (link.phone) return `tel:${link.phone}`;
    if (link.anchor && !link.href) return `#${link.anchor}`;
    return ctx.localizePath(link.href);
  };

  ctx.isExternal = (url) => typeof url === 'string' && /^https?:\/\//.test(url);

  ctx.documentUrl = (id) => {
    const doc = content.index.documents[id];
    if (!doc) throw new Error(`Unknown document id "${id}"`);
    return doc.url.startsWith('/') ? ctx.asset(doc.url) : doc.url;
  };

  ctx.formatDate = (iso, style) => formatDate(iso, locale, style);
  ctx.formatTime = (hhmm) => formatTime(hhmm, locale);
  ctx.currency = site.currency || 'USD';
  ctx.money = (amount) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: ctx.currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);

  const cal = site.calendar || {};
  ctx.calendarStyle = cal.style || 'gregorian';
  ctx.feastsOn = (iso) => feastsOn(iso, ctx.calendarStyle, content.calendar);
  // "November 10" for a civil date, on the Julian calendar (Old Style), when
  // the parish keeps the Julian calendar and shows both dates.
  ctx.oldStyleDate = (iso) => {
    if (ctx.calendarStyle !== 'julian' || cal.showOldStyle === false) return '';
    const j = churchDate(iso, 'julian');
    return ctx.t('calendar.oldStyle', { date: formatDate(toIso(j.y, j.m, j.d), locale, 'dayMonth') });
  };
  ctx.imageSize = (src) => imageSize(PUBLIC_DIR, src);

  // site.logo: image (optional, any shape), favicon (SVG or PNG) and icon
  // (a square PNG for phones' home screens and search results).
  const logo = site.logo || {};
  const size = logo.image ? ctx.imageSize(logo.image) || { width: 96, height: 96 } : null;
  ctx.logo = {
    width: size?.width,
    height: size?.height,
    favicon: logo.favicon || logo.image || logo.icon,
    icon: logo.icon || logo.image || logo.favicon
  };

  const marked = new Marked({
    gfm: true,
    breaks: false,
    renderer: {
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const url = ctx.localizePath(href);
        const external = ctx.isExternal(url);
        const isPdf = /\.pdf($|[?#])/i.test(url);
        return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' target="_blank" rel="noopener"' : ''}${isPdf ? ' data-kind="pdf"' : ''}>${text}</a>`;
      },
      image({ href, title, text }) {
        const src = ctx.asset(href);
        const size = ctx.imageSize(href);
        const dims = size ? ` width="${size.width}" height="${size.height}"` : '';
        const img = `<img src="${esc(src)}" alt="${esc(text)}"${dims} loading="lazy" decoding="async">`;
        return title ? `<figure class="prose-figure">${img}<figcaption>${esc(title)}</figcaption></figure>` : img;
      }
    }
  });

  // Renders a localized (or plain) markdown value. Text that fell back to
  // the source language is wrapped with the right lang attribute.
  ctx.md = (value, { inline = false, lang } = {}) => {
    const picked = typeof value === 'string' ? { text: value, fallback: false } : ctx.lx(value);
    if (!picked.text) return raw('');
    const out = inline
      ? marked.parseInline(picked.text)
      : marked.parse(picked.text).replace(/<p>(<figure class="prose-figure">[\s\S]*?<\/figure>)<\/p>/g, '$1');
    const forcedLang = lang || (picked.fallback ? picked.lang : null);
    if (forcedLang && forcedLang !== locale) {
      return raw(inline ? `<span lang="${forcedLang}">${out}</span>` : `<div lang="${forcedLang}">${out}</div>`);
    }
    return raw(out);
  };

  ctx.absoluteUrl = (p) => `${siteUrl.replace(/\/$/, '')}${p}`;

  return ctx;
}
