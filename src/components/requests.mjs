/**
 * Request a Service (features.serviceRequests), from content/requests.json.
 *
 * request-services props: eyebrow, title, intro, services (ids; default all)
 *
 * Each service card has an illustration slot (service.image, or a framed
 * pictogram), a title, the price (free or a donation) and how long it takes.
 * Request opens one shared form; site.js sends it to
 * ParishSite.handlers.serviceRequest (placeholder), or POSTs it to
 * requests.endpoint when that is set. A card with a `link` (e.g. the
 * commemoration notes page) goes there instead.
 */
import { html } from '../lib/html.mjs';
import { sectionHead, image, icon, cross, phoneHref } from './_primitives.mjs';
import { phoneField } from './store.mjs';

export const meta = {
  type: 'request-services',
  title: 'Request a Service',
  description: 'Cards for sacraments and services (moleben, baptism, house blessing and more) with a request form for the priest or office.',
  dataSources: ['requests.json']
};

function price(s, ctx) {
  const pr = s.price || { type: 'free' };
  if (pr.type === 'donation') return html`<span class="req-price req-price--donation">${pr.suggested ? ctx.t('requests.suggested', { amount: ctx.money(pr.suggested) }) : ctx.t('requests.donation')}</span>`;
  return html`<span class="req-price req-price--free">${ctx.t('requests.free')}</span>`;
}

function illustration(s, ctx) {
  if (s.image?.src) return html`<div class="req-card__art req-card__art--image">${image(s.image, ctx, { className: 'req-card__img' })}</div>`;
  return html`<div class="req-card__art" aria-hidden="true"><span class="req-card__frame">${icon(s.icon || 'church', 'req-card__pictogram')}</span></div>`;
}

export function render(p, ctx) {
  const data = ctx.content.requests;
  if (!data) return '';
  const list = (p.services ? p.services.map((id) => ctx.content.index.requests[id]) : data.services).filter((s) => s && s.published !== false);
  const c = ctx.site.contact;
  return html`<div class="requests" data-requests data-endpoint="${data.endpoint || ''}">
    ${sectionHead(p, ctx)}
    <ul class="card-grid card-grid--3 req-grid">
      ${list.map((s) => {
        const url = s.link ? ctx.href(s.link) : null;
        return html`<li class="card req-card" id="request-${s.id}">
          ${illustration(s, ctx)}
          <div class="req-card__body">
            <h3 class="req-card__title">${ctx.l(s.title)}</h3>
            ${s.accent ? html`<p class="req-card__accent accent" lang="${ctx.site.accent?.lang || 'ru'}">${ctx.l(s.accent)}</p>` : ''}
            ${s.summary ? html`<p class="req-card__text">${ctx.l(s.summary)}</p>` : ''}
            <ul class="req-card__meta">
              <li>${price(s, ctx)}</li>
              ${s.duration ? html`<li class="req-card__duration">${icon('clock', 'req-card__icon')}<span>${ctx.l(s.duration)}</span></li>` : ''}
            </ul>
          </div>
          <div class="req-card__foot">
            ${url
              ? html`<a class="btn btn--primary btn--sm btn--block" href="${url}">${ctx.l(s.cta) || ctx.t('requests.submitOnline')}</a>`
              : html`<button class="btn btn--primary btn--sm btn--block" type="button" data-request="${s.id}" data-request-title="${ctx.l(s.title)}" data-ask-date="${s.askDate === false ? 'false' : 'true'}" hidden>${ctx.l(s.cta) || ctx.t('requests.request')}</button>
                  <noscript><a class="btn btn--secondary btn--sm btn--block" href="${phoneHref(c.phone) || `mailto:${c.email}`}">${ctx.t('requests.callOffice')}</a></noscript>`}
          </div>
        </li>`;
      })}
    </ul>
    ${data.note ? html`<p class="requests__note">${cross('requests__note-cross')}<span>${ctx.l(data.note)}</span></p>` : ''}
    <dialog class="modal" data-request-dialog aria-labelledby="request-dialog-title">
      <form class="modal__panel request-form" method="dialog" data-form="service-request" novalidate>
        <div class="modal__head">
          <div>
            <p class="eyebrow">${cross('eyebrow__cross')}<span>${ctx.t('requests.formEyebrow')}</span></p>
            <h2 class="modal__title" id="request-dialog-title" data-request-heading>${ctx.t('requests.request')}</h2>
          </div>
          <button class="icon-btn modal__close" type="button" data-modal-close>${icon('close', 'icon-btn__icon')}<span class="visually-hidden">${ctx.t('form.close')}</span></button>
        </div>
        <input type="hidden" name="service" data-request-service>
        <p class="modal__intro">${ctx.l(data.recipient) ? ctx.t('requests.goesTo', { who: ctx.l(data.recipient) }) : ''}</p>
        <div class="form-grid">
          <div class="field field--full">
            <label class="field__label" for="rq-name">${ctx.t('form.name')}</label>
            <input class="field__input" id="rq-name" name="name" autocomplete="name" required>
          </div>
          ${phoneField('rq-phone', ctx, { required: true })}
          <div class="field">
            <label class="field__label" for="rq-email">${ctx.t('form.email')}</label>
            <input class="field__input" id="rq-email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field" data-date-field>
            <label class="field__label" for="rq-date">${ctx.t('requests.date')} <span class="field__optional">${ctx.t('form.optional')}</span></label>
            <input class="field__input" id="rq-date" name="date" type="date">
          </div>
          <div class="field" data-date-field>
            <label class="field__label" for="rq-time">${ctx.t('requests.time')} <span class="field__optional">${ctx.t('form.optional')}</span></label>
            <input class="field__input" id="rq-time" name="time" type="time" step="900">
          </div>
          <div class="field field--full">
            <label class="field__label" for="rq-notes">${ctx.t('requests.notes')} <span class="field__optional">${ctx.t('form.optional')}</span></label>
            <textarea class="field__input" id="rq-notes" name="notes" rows="4"></textarea>
          </div>
        </div>
        <p class="form-note">${ctx.t('requests.privacy')}</p>
        <div class="modal__actions">
          <button class="btn btn--secondary" type="button" data-modal-close>${ctx.t('form.cancel')}</button>
          <button class="btn btn--accent" type="submit">${ctx.t('requests.send')}</button>
        </div>
        <p class="form-status" role="status" aria-live="polite" data-form-status hidden></p>
      </form>
    </dialog>
  </div>`;
}
