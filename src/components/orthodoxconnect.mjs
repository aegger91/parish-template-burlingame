/**
 * OrthodoxConnect integration (Get Involved). Placeholders until the API is live.
 *
 * orthodoxconnect-feed props: eyebrow, title, intro, kinds (["event" | "volunteer" | "need"]),
 *   limit, filters (category filter buttons), appActions (["createEvent", "postNeed"]),
 *   actions
 * orthodoxconnect-cta props: eyebrow, title, text, buttonLabel
 *
 * Data: content.orthodoxconnect, a feed matching
 *   schemas/orthodoxconnect-feed.schema.json, read from
 *   site.orthodoxConnect.sampleFeed or, at build time, from
 *   ORTHODOXCONNECT_FEED_URL. Item fields mirror OrthodoxConnect: id, kind,
 *   title, date, time, location, capacity, signups, organizer, category.
 *   With isSample: true every card carries a visible "Sample" label.
 * Links (site.orthodoxConnect.links) are URL templates
 *   with {appUrl}, {parishId} and {id}. Sign-up goes through the
 *   ParishSite.handlers.ocSignup placeholder in site.js.
 */
import { html, cx } from '../lib/html.mjs';
import { sectionHead, eyebrow, icon, cross, actions } from './_primitives.mjs';

export const feedMeta = {
  type: 'orthodoxconnect-feed',
  title: 'OrthodoxConnect: events, volunteering and needs',
  description: 'Events with RSVP, volunteer opportunities and parish needs with sign-up slots, from the OrthodoxConnect app.',
  dataSources: ['integrations/orthodoxconnect.sample.json', 'env ORTHODOXCONNECT_FEED_URL']
};

export const ctaMeta = {
  type: 'orthodoxconnect-cta',
  title: 'Join on OrthodoxConnect',
  description: 'Invitation to join the parish on the OrthodoxConnect app.',
  dataSources: ['site.json orthodoxConnect']
};

const KIND_ICON = { event: 'calendar', volunteer: 'bell', need: 'candle' };
const SHOWN = new Set(['open', 'full']);

export function ocLink(ctx, name, vars = {}) {
  const oc = ctx.site.orthodoxConnect || {};
  const template = oc.links?.[name];
  if (!template) return null;
  const values = { appUrl: oc.appUrl || '', parishId: encodeURIComponent(oc.parishId || ctx.content.orthodoxconnect?.parishId || ''), id: encodeURIComponent(vars.id || '') };
  return template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
}

const items = (ctx) => (ctx.content.orthodoxconnect?.items || []).filter((i) => SHOWN.has(i.status || 'open'));

export function ocEntries(ctx) {
  return items(ctx)
    .filter((i) => i.date)
    .map((i) => ({ id: i.id, d: i.date, t: i.time || '', title: ctx.l(i.title), note: ctx.l(i.location) || undefined, kind: i.kind }))
    .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
}

function when(item, ctx) {
  if (!item.date) return '';
  const start = item.time ? ctx.formatTime(item.time) : '';
  const time = start && item.endTime ? ctx.t('oc.timeRange', { start, end: ctx.formatTime(item.endTime) }) : start;
  return ctx.formatDate(item.date, 'weekdayLong') + (time ? ` · ${time}` : '');
}

function capacity(item, ctx) {
  if (!item.capacity) return '';
  const done = Math.min(item.signups || 0, item.capacity);
  const pct = Math.round((done / item.capacity) * 100);
  const left = item.capacity - done;
  const unit = ctx.l(item.unit);
  const label = unit ? ctx.t('oc.pledged', { filled: done, needed: item.capacity, unit }) : ctx.t('oc.signedUp', { filled: done, needed: item.capacity });
  return html`<div class="oc-progress" data-oc-progress data-capacity="${item.capacity}" data-signups="${done}">
    <div class="oc-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="${item.capacity}" aria-valuenow="${done}" aria-label="${label}"><span style="width:${pct}%"></span></div>
    <p class="oc-progress__label"><span>${label}</span><span class="oc-progress__left">${left > 0 ? ctx.t('oc.spotsLeft', { n: left }) : ctx.t('oc.full')}</span></p>
  </div>`;
}

function card(item, ctx, sample) {
  const cat = (ctx.content.orthodoxconnect.categories || []).find((c) => c.id === item.category);
  const full = item.status === 'full' || (item.capacity && (item.signups || 0) >= item.capacity);
  const link = item.url || ocLink(ctx, 'item', { id: item.id });
  return html`<li class="card oc-card oc-card--${item.kind}" id="oc-${item.id}" data-oc-id="${item.id}" data-oc-kind="${item.kind}" data-filter-item data-category="${item.category || ''}">
    <div class="oc-card__top">
      <span class="oc-kind">${icon(KIND_ICON[item.kind], 'oc-kind__icon')}${ctx.t(`oc.kind.${item.kind}`)}</span>
      ${cat ? html`<span class="chip chip--static">${ctx.l(cat.label)}</span>` : ''}
    </div>
    <h3 class="card__title oc-card__title">${ctx.l(item.title)}</h3>
    <ul class="oc-card__meta">
      ${item.date ? html`<li>${icon('clock', 'oc-card__icon')}<time datetime="${item.date}${item.time ? `T${item.time}` : ''}">${when(item, ctx)}</time></li>` : ''}
      ${item.location ? html`<li>${icon('pin', 'oc-card__icon')}<span>${ctx.l(item.location)}</span></li>` : ''}
      ${item.organizer ? html`<li>${icon('church', 'oc-card__icon')}<span>${ctx.t('oc.organizer', { name: ctx.l(item.organizer) })}</span></li>` : ''}
    </ul>
    ${item.summary ? html`<p class="oc-card__text">${ctx.l(item.summary)}</p>` : ''}
    ${capacity(item, ctx)}
    <div class="oc-card__foot">
      <a class="${cx('btn', 'btn--sm', full ? 'btn--secondary is-disabled' : 'btn--primary')}" href="${link || '#'}" data-oc-signup="${item.id}"${full ? html` aria-disabled="true"` : ''}>${full ? ctx.t('oc.full') : ctx.l(item.cta) || ctx.t(`oc.cta.${item.kind}`)}</a>
      <span class="oc-badge">${cross('oc-badge__cross')}${ctx.t('oc.onConnect')}</span>
      ${sample ? html`<span class="badge badge--sample">${ctx.t('oc.sampleBadge')}</span>` : ''}
    </div>
    <p class="form-status oc-card__status" role="status" aria-live="polite" data-form-status hidden></p>
  </li>`;
}

export function renderFeed(p, ctx) {
  const feed = ctx.content.orthodoxconnect;
  if (!feed) return '';
  let list = items(ctx).filter((i) => !p.kinds || p.kinds.includes(i.kind));
  list.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  if (p.limit) list = list.slice(0, p.limit);
  const sample = feed.isSample;
  const cats = (feed.categories || []).filter((c) => list.some((i) => i.category === c.id));
  const appActions = (p.appActions || []).map((name) => ({ name, url: ocLink(ctx, name) })).filter((a) => a.url);
  return html`<div class="${cx('oc-feed', sample && 'oc-feed--sample')}" data-oc-feed data-oc-parish="${ctx.site.orthodoxConnect?.parishId || feed.parishId || ''}" data-oc-sample="${sample ? 'true' : 'false'}" data-filter-root>
    <div class="oc-feed__head">
      ${sectionHead(p, ctx)}
      ${appActions.length
        ? html`<div class="oc-feed__app">
            <div class="oc-feed__app-buttons">${appActions.map((a) => html`<a class="btn btn--secondary btn--sm" href="${a.url}" data-oc-deeplink="${a.name}">${icon(a.name === 'postNeed' ? 'candle' : 'calendar', 'btn__icon')}<span>${ctx.t(`oc.${a.name}`)}</span></a>`)}</div>
            <p class="oc-feed__app-note">${ctx.t('oc.appNote')}</p>
          </div>`
        : ''}
    </div>
    ${sample ? html`<p class="oc-sample-banner" role="note"><span class="badge badge--sample">${ctx.t('oc.sampleBadge')}</span><span>${ctx.t('oc.sampleNotice')}</span></p>` : ''}
    ${p.filters && cats.length > 1
      ? html`<div class="filter-bar" role="group" aria-label="${ctx.t('filter.label')}" data-filter-bar hidden>
          <button class="chip" type="button" data-filter="" aria-pressed="true">${ctx.t('filter.all')}</button>
          ${cats.map((c) => html`<button class="chip" type="button" data-filter="${c.id}" aria-pressed="false">${ctx.l(c.label)}</button>`)}
        </div>`
      : ''}
    <ul class="card-grid card-grid--3 oc-feed__items">${list.map((i) => card(i, ctx, sample))}</ul>
    <p class="filter-empty" data-filter-empty hidden>${ctx.t('filter.none')}</p>
    ${actions(p.actions, ctx, { className: 'section-actions' })}
  </div>`;
}

export function renderCta(p, ctx) {
  const oc = ctx.site.orthodoxConnect;
  if (!oc) return '';
  const url = ocLink(ctx, 'join');
  const sample = ctx.content.orthodoxconnect?.isSample !== false;
  return html`<div class="oc-cta" data-oc-parish="${oc.parishId || ''}" data-oc-sample="${sample ? 'true' : 'false'}">
    <div class="oc-cta__mark">${cross('oc-cta__cross')}</div>
    <div class="oc-cta__text">
      ${eyebrow(ctx.l(p.eyebrow))}
      <h2 class="oc-cta__title">${ctx.l(p.title)}</h2>
      ${p.text ? html`<div class="oc-cta__body">${ctx.md(p.text)}</div>` : ''}
    </div>
    <div class="oc-cta__action">
      ${url
        ? html`<a class="btn btn--accent" href="${url}" data-oc-deeplink="join"><span>${ctx.l(p.buttonLabel) || ctx.t('oc.join')}</span>${icon('arrow', 'btn__icon')}</a>`
        : html`<span class="btn btn--accent is-disabled" aria-disabled="true">${ctx.t('oc.comingSoon')}</span>`}
    </div>
  </div>`;
}
