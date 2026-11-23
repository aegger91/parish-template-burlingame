/**
 * Livestream and sermons (site.livestream, content/sermons.json).
 *
 * livestream props: eyebrow, title, intro, upcoming (number of streamed
 *   services to list, default 4)
 * sermon-list props: eyebrow, title, intro, limit, filters (series buttons
 *   and a speaker menu), actions
 *
 * The live player is a facade: nothing loads from the video host until the
 * visitor presses play. site.js shows "Live now" during a streamed service
 * (start minus livestream.leadMinutes until the service ends) and otherwise
 * the next broadcast. Sermon audio plays in one shared player.
 */
import { html, cx } from '../lib/html.mjs';
import { sectionHead, actions, icon, cross, image } from './_primitives.mjs';
import { upcomingServices, isStreamed, serviceLabel } from './service-times.mjs';
import { videoFacade } from './media.mjs';
import { featureEnabled } from '../lib/content.mjs';

export const liveMeta = {
  type: 'livestream',
  title: 'Livestream',
  description: 'Live player (loads on click), live or next broadcast status, and upcoming streamed services.',
  dataSources: ['site.json livestream', 'services.json']
};
export const sermonMeta = {
  type: 'sermon-list',
  title: 'Sermons',
  description: 'Sermon archive with series and speaker filters and one audio player.',
  dataSources: ['sermons.json', 'people.json']
};

export function renderLive(p, ctx) {
  const live = ctx.site.livestream;
  if (!live || !featureEnabled(ctx.site, 'livestream')) return '';
  const next = upcomingServices(ctx).filter((e) => isStreamed(e, ctx)).slice(0, p.upcoming || 4);
  const links = (live.links || []).map((l) => ({ ...l, url: ctx.href(l) })).filter((l) => l.url);
  return html`<div class="livestream" data-livestream>
    <div class="livestream__player">
      <div class="live-frame" data-live-frame${live.embedUrl ? html` data-embed="${live.embedUrl}"` : ''}>
        ${image(live.poster, ctx, { className: 'live-frame__poster' })}
        <div class="live-frame__overlay">
          ${cross('live-frame__cross')}
          <p class="live-frame__status" data-live-status aria-live="polite"><span class="live-badge live-badge--inline" data-live-badge hidden><span class="live-badge__dot" aria-hidden="true"></span><span class="live-badge__label">${ctx.t('live.now')}</span></span><span data-live-next>${next[0] ? ctx.t('live.next', { when: `${ctx.formatDate(next[0].date, 'short')}, ${ctx.formatTime(next[0].time)}`, what: serviceLabel(next[0], ctx) }) : ''}</span></p>
          ${live.embedUrl
            ? html`<button class="live-frame__play" type="button" data-live-play>${icon('play', 'live-frame__play-icon')}<span>${ctx.t('live.play')}</span></button>`
            : live.watchUrl
              ? html`<a class="live-frame__play" href="${live.watchUrl}" target="_blank" rel="noopener">${icon('play', 'live-frame__play-icon')}<span>${ctx.t('live.watch')}</span></a>`
              : ''}
          ${live.embedUrl ? html`<p class="live-frame__note">${ctx.t('live.privacy')}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="livestream__side">
      ${sectionHead(p, ctx)}
      ${next.length
        ? html`<h3 class="livestream__subtitle">${ctx.t('live.upcoming')}</h3>
          <ol class="live-list" data-hide-past>
            ${next.map((e) => html`<li class="live-list__item" data-date="${e.date}"><time datetime="${e.date}T${e.time}">${ctx.formatDate(e.date, 'short')}<span>${ctx.formatTime(e.time)}</span></time><span>${serviceLabel(e, ctx)}</span></li>`)}
          </ol>`
        : ''}
      ${links.length
        ? html`<ul class="social-links">${links.map((l) => html`<li><a class="social-link" href="${l.url}" target="_blank" rel="noopener">${icon(l.icon || 'external', 'social-link__icon')}<span>${ctx.l(l.label)}</span></a></li>`)}</ul>`
        : ''}
      ${actions(p.actions, ctx)}
    </div>
  </div>`;
}

function speakerName(id, ctx) {
  const person = ctx.content.index.people?.[id];
  return person ? ctx.l(person.shortName || person.name) : ctx.l(ctx.content.sermons.speakers?.find((s) => s.id === id)?.name) || '';
}

const fmtDuration = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

export function renderSermons(p, ctx) {
  const data = ctx.content.sermons;
  if (!data) return '';
  let list = [...data.sermons].filter((s) => s.published !== false).sort((a, b) => b.date.localeCompare(a.date));
  if (p.limit) list = list.slice(0, p.limit);
  const series = (data.series || []).filter((s) => list.some((x) => x.series === s.id));
  const speakers = [...new Set(list.map((s) => s.speaker).filter(Boolean))];
  return html`<div class="sermons" data-filter-root data-sermons>
    ${sectionHead(p, ctx)}
    ${p.filters !== false && (series.length > 1 || speakers.length > 1)
      ? html`<div class="filter-row" data-filter-bar hidden>
          ${series.length > 1
            ? html`<div class="filter-bar" role="group" aria-label="${ctx.t('sermons.series')}">
                <button class="chip" type="button" data-filter="" aria-pressed="true">${ctx.t('filter.all')}</button>
                ${series.map((s) => html`<button class="chip" type="button" data-filter="${s.id}" aria-pressed="false">${ctx.l(s.label)}</button>`)}
              </div>`
            : ''}
          ${speakers.length > 1
            ? html`<label class="filter-select"><span class="visually-hidden">${ctx.t('sermons.speaker')}</span>
                <select class="field__input field__input--sm" data-filter-key="speaker">
                  <option value="">${ctx.t('sermons.allSpeakers')}</option>
                  ${speakers.map((id) => html`<option value="${id}">${speakerName(id, ctx)}</option>`)}
                </select></label>`
            : ''}
        </div>`
      : ''}
    <ol class="sermon-list">
      ${list.map((s) => {
        const ser = data.series?.find((x) => x.id === s.series);
        return html`<li class="sermon" id="sermon-${s.id}" data-filter-item data-category="${s.series || ''}" data-speaker="${s.speaker || ''}">
          ${s.audio
            ? html`<button class="sermon__play" type="button" data-play-sermon="${ctx.asset(s.audio.src)}" data-title="${ctx.l(s.title)}" data-meta="${speakerName(s.speaker, ctx)}" hidden>${icon('play', 'sermon__play-icon')}<span class="visually-hidden">${ctx.t('sermons.play', { title: ctx.l(s.title) })}</span></button>`
            : html`<span class="sermon__mark">${icon('gospel', 'sermon__mark-icon')}</span>`}
          <div class="sermon__body">
            <p class="sermon__meta"><time datetime="${s.date}">${ctx.formatDate(s.date, 'long')}</time>${ser ? html`<span class="news-cat">${ctx.l(ser.label)}</span>` : ''}</p>
            <h3 class="sermon__title">${ctx.l(s.title)}</h3>
            <p class="sermon__by">${[speakerName(s.speaker, ctx), ctx.l(s.scripture)].filter(Boolean).join(' · ')}${s.audio?.duration ? html`<span class="sermon__duration">${icon('clock', 'sermon__icon')}${fmtDuration(s.audio.duration)}</span>` : ''}</p>
            ${s.summary ? html`<p class="sermon__summary">${ctx.l(s.summary)}</p>` : ''}
            ${s.audio ? html`<p class="sermon__download"><a href="${ctx.asset(s.audio.src)}" download>${icon('audio', 'sermon__icon')}${ctx.t('sermons.download')}</a></p>` : ''}
          </div>
          ${s.youtubeId ? html`<div class="sermon__video">${videoFacade({ youtubeId: s.youtubeId, title: s.title }, ctx)}</div>` : ''}
        </li>`;
      })}
    </ol>
    <p class="filter-empty" data-filter-empty hidden>${ctx.t('filter.none')}</p>
    <div class="${cx('player')}" data-player hidden>
      <audio preload="none" data-player-audio></audio>
      <button class="player__toggle" type="button" data-player-toggle aria-label="${ctx.t('sermons.playPause')}">${icon('play', 'player__icon player__icon--play')}${icon('pause', 'player__icon player__icon--pause')}</button>
      <div class="player__info"><p class="player__title" data-player-title></p><p class="player__meta" data-player-meta></p></div>
      <input class="player__seek" type="range" min="0" max="100" step="0.1" value="0" aria-label="${ctx.t('sermons.seek')}" data-player-seek>
      <p class="player__time"><span data-player-time>0:00</span> / <span data-player-duration>0:00</span></p>
      <button class="player__rate" type="button" data-player-rate aria-label="${ctx.t('sermons.speed')}">1×</button>
    </div>
    ${actions(p.actions, ctx, { className: 'section-actions' })}
  </div>`;
}
