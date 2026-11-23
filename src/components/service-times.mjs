/**
 * service-times — upcoming services from content/services.json.
 *
 * Props: eyebrow, title, intro, limit (number), 
 *        showNotices (bool), showSeason (bool), showStanding (bool), actions (Action[])
 * Data:  services.upcoming[], services.serviceTypes[], services.notices[],
 *        services.season, services.standing (shown only when published),
 *        content/calendar.json for feast names
 *
 * Each row carries data-date so the client script can hide past services
 * without a rebuild.
 */
import { html, attrs, cx } from '../lib/html.mjs';
import { sectionHead, actions, icon, cross, withSpares, spareHidden, accentLang } from './_primitives.mjs';
import { featureEnabled } from '../lib/content.mjs';

export const meta = {
  type: 'service-times',
  title: 'Service times',
  description: 'Upcoming services list (date, time, service, feast) with notices and actions.',
  dataSources: ['services.json', 'calendar.json']
};

const byDateTime = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));

export function allServices(ctx) {
  return [...ctx.content.services.upcoming].sort(byDateTime);
}

export function upcomingServices(ctx, limit) {
  const list = allServices(ctx);
  return limit ? list.slice(0, limit) : list;
}

export const serviceType = (entry, ctx) => ctx.content.index.serviceTypes[entry.serviceType];

export function serviceLabel(entry, ctx) {
  if (entry.title) return ctx.l(entry.title);
  const type = serviceType(entry, ctx);
  return type ? ctx.l(type.name) : '';
}

export const isStreamed = (entry, ctx) => featureEnabled(ctx.site, 'livestream') && (entry.stream ?? serviceType(entry, ctx)?.streamed ?? false);

// The feast shown with a service: the most important commemoration on that
// date from the calendar (an entry's own note is shown instead when set).
export function feastFor(entry, ctx) {
  return ctx.feastsOn(entry.date)[0] || null;
}

export function serviceRow(entry, ctx, { compact = false, hidden = null } = {}) {
  const time = entry.time ? ctx.formatTime(entry.time) : '';
  const label = serviceLabel(entry, ctx);
  const feast = feastFor(entry, ctx);
  const note = ctx.l(entry.note) || (feast ? ctx.l(feast.title) : '');
  const rank = feast?.rank;
  const marked = rank === 'great' || rank === 'major';
  return html`<li${attrs({ class: cx('service-list__item', entry.noService && 'is-none', marked && `is-feast is-feast--${rank}`), 'data-date': entry.date, hidden })}>
    <time class="service-list__date" datetime="${entry.date}${entry.time ? `T${entry.time}` : ''}">${ctx.formatDate(entry.date, 'weekdayLong')}</time>
    <div class="service-list__body">
      <p class="service-list__service">${time ? html`<span class="service-list__time">${time}</span>` : ''}<span>${label}</span>${isStreamed(entry, ctx) ? html`<span class="stream-tag" title="${ctx.t('live.streamed')}">${icon('live', 'stream-tag__icon')}<span class="visually-hidden">${ctx.t('live.streamed')}</span></span>` : ''}</p>
      ${note && !compact ? html`<p class="service-list__note">${marked ? cross('service-list__cross') : ''}<span>${note}</span></p>` : ''}
    </div>
  </li>`;
}

export function seasonNotice(ctx) {
  const season = ctx.content.services.season;
  if (!season || season.published === false) return '';
  const title = ctx.l(season.title);
  const showAccent = season.accent && season.accent.toLowerCase() !== title.toLowerCase();
  return html`<div class="notice notice--season"${attrs({ 'data-until': season.end })}>
    <p class="notice__title">${cross('notice__cross')}<span>${title}</span>${showAccent ? html`<span class="accent-inline" lang="${accentLang(ctx)}">${season.accent}</span>` : ''}</p>
    <p class="notice__text">${ctx.l(season.text)}</p>
  </div>`;
}

export function standingTimes(ctx) {
  const standing = ctx.content.services.standing;
  if (!standing || standing.published === false) return '';
  return html`<dl class="standing-times">${standing.items.map((i) => html`<div class="standing-times__row"><dt>${ctx.l(i.label)}</dt><dd>${ctx.l(i.text)}</dd></div>`)}</dl>`;
}

export function render(p, ctx) {
  const list = withSpares(upcomingServices(ctx), p.limit);
  const notices = p.showNotices ? ctx.content.services.notices.filter((n) => n.published !== false) : [];
  return html`<div class="service-times">
    ${sectionHead(p, ctx, { level: p.headingLevel || 2 })}
    ${p.showStanding ? standingTimes(ctx) : ''}
    ${p.showSeason ? seasonNotice(ctx) : ''}
    ${notices.map((n) => html`<p class="notice notice--alert">${icon('clock', 'notice__icon')}<span>${ctx.l(n.text)}</span></p>`)}
    <ol${attrs({ class: 'service-list', 'data-hide-past': true, 'data-limit': p.limit })}>${list.map((e, i) => serviceRow(e, ctx, { hidden: spareHidden(i, p.limit) }))}</ol>
    <p class="service-list__empty" hidden>${ctx.t('services.allPast')}</p>
    ${actions(p.actions, ctx, { className: 'service-times__actions' })}
  </div>`;
}
