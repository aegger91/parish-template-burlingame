/**
 * hero — home page hero: what a visitor needs at a glance.
 *
 * Props: eyebrow, title, accent (liturgical-language line), text, image,
 *        actions (one or two buttons), showAddress (default true),
 *        today (default true: today's date, Old Style date and the feast or
 *        saint of the day, from content/calendar.json),
 *        nextServices: { limit, title }, shortcut (a small link, e.g. to the
 *        commemoration notes page; hidden when its page is switched off)
 *
 * The live badge appears while a streamed service is on (site.livestream).
 * The build fills in today's date and feast; site.js refreshes them in the
 * visitor's browser so the page never goes stale between builds.
 */
import { html, attrs } from '../lib/html.mjs';
import { eyebrow, accentUnlessSame, actions, image, icon, cross, withSpares, spareHidden, phoneHref } from './_primitives.mjs';
import { upcomingServices, serviceLabel, isStreamed, feastFor } from './service-times.mjs';
import { addressLines } from './contact.mjs';
import { livestreamPage } from './client-data.mjs';
import { todayIn, nextFeast } from '../lib/calendar.mjs';

export const meta = {
  type: 'hero',
  title: 'Hero',
  bare: true,
  description: 'Parish name, address and directions, live badge, today and the feast of the day, the next services and one or two buttons.'
};

function today(ctx) {
  const iso = todayIn(ctx.site.timezone);
  const feast = ctx.feastsOn(iso)[0];
  const next = feast ? null : nextFeast(iso, ctx.calendarStyle, ctx.content.calendar, 90);
  return html`<div class="hero__today" data-today>
    <p class="hero__date"><span class="hero__date-label">${ctx.t('calendar.today')}</span>
      <time data-today-date datetime="${iso}">${ctx.formatDate(iso, 'weekdayLong')}</time>
      <span class="hero__oldstyle" data-today-os>${ctx.oldStyleDate(iso)}</span></p>
    <p class="hero__feast" data-feast>${cross('hero__feast-cross')}<span>
      <span class="hero__feast-label" data-feast-label>${feast ? ctx.t('calendar.feastToday') : next ? ctx.t('calendar.comingFeast') : ''}</span>
      <strong class="hero__feast-title" data-feast-title>${feast ? ctx.l(feast.title) : next ? ctx.l(next.feast.title) : ''}</strong>
      <span class="hero__feast-when" data-feast-when>${next ? ctx.formatDate(next.date, 'weekdayLong') : ''}</span>
    </span></p>
  </div>`;
}

function nextServices(p, ctx) {
  if (!p.nextServices) return '';
  const limit = p.nextServices.limit || 3;
  const list = withSpares(upcomingServices(ctx), limit);
  const schedule = ctx.pagePath('services');
  return html`<div class="hero__next">
    <p class="hero__panel-title">${ctx.l(p.nextServices.title)}</p>
    <ol class="hero__next-list" data-hide-past data-limit="${limit}">
      ${list.map((e, i) => {
        const feast = feastFor(e, ctx);
        const note = ctx.l(e.note) || (feast && feast.rank !== 'saint' && feast.rank !== 'observance' ? ctx.l(feast.title) : '');
        return html`<li${attrs({ 'data-date': e.date, hidden: spareHidden(i, limit) })}>
          <time datetime="${e.date}">${ctx.formatDate(e.date, 'short')}</time>
          <span class="hero__next-what"><span class="hero__next-time">${e.time ? ctx.formatTime(e.time) : ''}</span> ${serviceLabel(e, ctx)}${isStreamed(e, ctx) ? html`<span class="stream-tag stream-tag--light" title="${ctx.t('live.streamed')}">${icon('live', 'stream-tag__icon')}<span class="visually-hidden">${ctx.t('live.streamed')}</span></span>` : ''}
          ${note ? html`<span class="hero__next-note">${note}</span>` : ''}</span>
        </li>`;
      })}
    </ol>
    <p class="hero__next-empty" hidden>${ctx.t('services.allPast')}</p>
    ${schedule ? html`<a class="hero__panel-link" href="${schedule}"><span>${ctx.t('services.fullSchedule')}</span>${icon('arrow', 'hero__panel-link-icon')}</a>` : ''}
  </div>`;
}

function liveBadge(ctx) {
  const page = livestreamPage(ctx);
  if (!page) return '';
  return html`<a class="live-badge" href="${ctx.pagePath(page.id)}" data-live-badge hidden>
    <span class="live-badge__dot" aria-hidden="true"></span><span class="live-badge__label">${ctx.t('live.now')}</span><span class="live-badge__cta">${ctx.t('live.watch')}${icon('arrow', 'live-badge__icon')}</span>
  </a>`;
}

export function render(p, ctx) {
  const c = ctx.site.contact;
  const shortcutUrl = p.shortcut ? ctx.href(p.shortcut) : null;
  return html`<section class="hero" id="${p.id}" data-section-type="hero">
    <div class="hero__media">${image(p.image, ctx, { className: 'hero__img', priority: true, sizes: '100vw' })}</div>
    <div class="container hero__inner">
      <div class="hero__content">
        ${liveBadge(ctx)}
        ${eyebrow(ctx.l(p.eyebrow))}
        <h1 class="hero__title">${ctx.l(p.title)}</h1>
        ${accentUnlessSame(p.accent, ctx.l(p.title), ctx, 'hero__accent accent')}
        ${p.text ? html`<p class="hero__text">${ctx.l(p.text)}</p>` : ''}
        ${p.showAddress !== false
          ? html`<p class="hero__address">${icon('pin', 'hero__address-icon')}<span><bdi>${addressLines(ctx).join(', ')}</bdi></span>${c.directionsUrl ? html`<a class="hero__directions" href="${c.directionsUrl}" target="_blank" rel="noopener">${ctx.t('contact.directions')}</a>` : ''}</p>`
          : ''}
        ${actions((p.actions || []).slice(0, 2), ctx, { className: 'hero__actions', onDark: true })}
        ${shortcutUrl ? html`<a class="hero__shortcut" href="${shortcutUrl}">${icon(p.shortcut.icon || 'candle', 'hero__shortcut-icon')}<span>${ctx.l(p.shortcut.label)}</span>${icon('arrow', 'hero__shortcut-arrow')}</a>` : ''}
      </div>
      <aside class="hero__panel" aria-label="${ctx.t('calendar.atAGlance')}">
        ${p.today !== false ? today(ctx) : ''}
        ${nextServices(p, ctx)}
        ${c.phone ? html`<p class="hero__phone"><a href="${phoneHref(c.phone)}">${icon('phone', 'hero__phone-icon')}<span><bdi dir="ltr">${c.phone.display}</bdi></span></a></p>` : ''}
      </aside>
    </div>
  </section>`;
}
