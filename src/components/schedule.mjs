/**
 * schedule — switchable week and month views of services (or of
 * OrthodoxConnect events), with feasts from content/calendar.json.
 *
 * Props: eyebrow, title, intro, source ("services" | "orthodoxconnect"),
 *        showSeason,
 *        showNotices, showLegend (default true), actions
 *
 * The build writes the full upcoming list as plain HTML; site.js replaces it
 * with the interactive views. The month grid turns into a day list on
 * narrow screens.
 */
import { html, raw, cx } from '../lib/html.mjs';
import { sectionHead, actions, icon, cross } from './_primitives.mjs';
import { upcomingServices, serviceRow, seasonNotice } from './service-times.mjs';
import { ocEntries } from './orthodoxconnect.mjs';
import { featureEnabled } from '../lib/content.mjs';

export const meta = {
  type: 'schedule',
  title: 'Schedule (week and month)',
  description: 'Week and month calendar of services or parish events, with feast days marked; a list on phones.',
  dataSources: ['services.json', 'calendar.json', 'OrthodoxConnect feed']
};

function eventRows(entries, ctx) {
  return entries.map(
    (e) => html`<li class="service-list__item" data-date="${e.d}">
      <time class="service-list__date" datetime="${e.d}">${ctx.formatDate(e.d, 'weekdayLong')}</time>
      <div class="service-list__body"><p class="service-list__service">${e.t ? html`<span class="service-list__time">${ctx.formatTime(e.t)}</span>` : ''}<span>${e.title}</span></p>
      ${e.note ? html`<p class="service-list__note"><span>${e.note}</span></p>` : ''}</div>
    </li>`
  );
}

export function render(p, ctx) {
  const source = p.source || 'services';
  const events = source === 'orthodoxconnect' ? ocEntries(ctx) : null;
  if (events && !ctx.content.orthodoxconnect) return '';
  const view = p.view === 'month' ? 'month' : 'week';
  const legend = p.showLegend !== false;
  return html`<div class="${cx('schedule', `schedule--${source}`)}" data-schedule data-source="${source}" data-view="${view}">
    ${sectionHead(p, ctx)}
    ${p.showSeason ? seasonNotice(ctx) : ''}
    ${p.showNotices ? ctx.content.services.notices.filter((n) => n.published !== false).map((n) => html`<p class="notice notice--alert">${icon('clock', 'notice__icon')}<span>${ctx.l(n.text)}</span></p>`) : ''}
    <div class="schedule__bar" data-schedule-bar hidden>
      <div class="segmented" role="tablist" aria-label="${ctx.t('schedule.view')}">
        <button class="segmented__btn" type="button" role="tab" data-view-btn="week" aria-selected="${view === 'week'}">${ctx.t('schedule.week')}</button>
        <button class="segmented__btn" type="button" role="tab" data-view-btn="month" aria-selected="${view === 'month'}">${ctx.t('schedule.month')}</button>
      </div>
      <div class="schedule__nav">
        <button class="icon-btn icon-btn--prev" type="button" data-step="-1">${icon('chevron', 'icon-btn__icon')}<span class="visually-hidden" data-step-label="-1">${ctx.t('schedule.prevWeek')}</span></button>
        <h3 class="schedule__range" data-range aria-live="polite"></h3>
        <button class="icon-btn icon-btn--next" type="button" data-step="1">${icon('chevron', 'icon-btn__icon')}<span class="visually-hidden" data-step-label="1">${ctx.t('schedule.nextWeek')}</span></button>
        <button class="btn btn--secondary btn--sm schedule__today" type="button" data-today-btn>${ctx.t('schedule.today')}</button>
      </div>
    </div>
    ${legend
      ? html`<ul class="schedule__legend" data-schedule-legend hidden>
          <li><span class="legend-swatch legend-swatch--great">${cross('legend-swatch__cross')}</span>${ctx.t('schedule.legendGreat')}</li>
          <li><span class="legend-swatch legend-swatch--feast"></span>${ctx.t('schedule.legendFeast')}</li>
          ${source === 'services' && featureEnabled(ctx.site, 'livestream') ? html`<li>${icon('live', 'legend-swatch__icon')}${ctx.t('live.streamed')}</li>` : ''}
        </ul>`
      : ''}
    <div class="schedule__view" data-schedule-view></div>
    ${events ? raw(`<script type="application/json" data-schedule-items>${JSON.stringify(events).replace(/</g, '\\u003c')}</script>`) : ''}
    <ol class="service-list schedule__fallback" data-hide-past data-schedule-fallback>
      ${events ? eventRows(events, ctx) : upcomingServices(ctx).map((e) => serviceRow(e, ctx))}
    </ol>
    ${actions(p.actions, ctx, { className: 'section-actions' })}
  </div>`;
}
