/**
 * contact-map — address, phone, email, social links and an embedded map.
 *
 * Props: eyebrow, title, intro, body (markdown), showMap (default true; `true`
 *        without site.contact.mapEmbedUrl shows a styled map slot),
 *        actions (defaults to Directions + 360° tour from site.contact)
 * Data:  site.contact, site.social
 */
import { html } from '../lib/html.mjs';
import { sectionHead, actions, icon, phoneHref } from './_primitives.mjs';
import { phoneField } from './store.mjs';

export const meta = {
  type: 'contact-map',
  title: 'Contact & map',
  description: 'Parish address, phone, email and social links beside an embedded map.',
  dataSources: ['site.json']
};

export const formMeta = {
  type: 'contact-form',
  title: 'Contact form',
  description: 'Message form (name, email, phone, topic, message) for the parish office. Placeholder handler until a form service is connected.',
  dataSources: ['site.json forms.contact']
};

// contact-form props: eyebrow, title, intro, topics ([{ id, label }]).
// Sends to ParishSite.handlers.contact, or POSTs to site.forms.contactEndpoint.
export function renderForm(p, ctx) {
  const endpoint = ctx.site.forms?.contactEndpoint || '';
  return html`<div class="contact-form">
    ${sectionHead(p, ctx)}
    <form class="card form-card" data-form="contact" data-endpoint="${endpoint}" novalidate>
      <div class="form-grid">
        <div class="field"><label class="field__label" for="cf-name">${ctx.t('form.name')}</label><input class="field__input" id="cf-name" name="name" autocomplete="name" required></div>
        <div class="field"><label class="field__label" for="cf-email">${ctx.t('form.email')}</label><input class="field__input" id="cf-email" name="email" type="email" autocomplete="email" required></div>
        ${phoneField('cf-phone', ctx)}
        ${p.topics?.length
          ? html`<div class="field"><label class="field__label" for="cf-topic">${ctx.t('form.topic')}</label><select class="field__input" id="cf-topic" name="topic">${p.topics.map((t) => html`<option value="${t.id}">${ctx.l(t.label)}</option>`)}</select></div>`
          : ''}
        <div class="field field--full"><label class="field__label" for="cf-message">${ctx.t('form.message')}</label><textarea class="field__input" id="cf-message" name="message" rows="5" required></textarea></div>
      </div>
      <div class="form-card__foot">
        <p class="form-note">${ctx.t('form.privacy')}</p>
        <button class="btn btn--primary" type="submit">${icon('mail', 'btn__icon')}<span>${ctx.t('form.send')}</span></button>
      </div>
      <p class="form-status" role="status" aria-live="polite" data-form-status hidden></p>
    </form>
  </div>`;
}

export function addressLines(ctx) {
  const a = ctx.site.contact.address;
  return [a.street, `${a.city}, ${a.region} ${a.postalCode}`];
}

export function render(p, ctx) {
  const c = ctx.site.contact;
  const defaultActions = [
    c.directionsUrl && { label: ctx.content.ui.strings['contact.directions'], href: c.directionsUrl, style: 'primary' },
    c.virtualTourUrl && { label: ctx.content.ui.strings['contact.tour'], href: c.virtualTourUrl, style: 'secondary' }
  ].filter(Boolean);
  return html`<div class="contact-map">
    <div class="contact-map__info">
      ${sectionHead(p, ctx)}
      <ul class="contact-list">
        <li>${icon('pin', 'contact-list__icon')}<span><span class="contact-list__label">${ctx.t('contact.address')}</span><address>${addressLines(ctx).map((l, i) => html`${i ? html`<br>` : ''}<bdi>${l}</bdi>`)}</address></span></li>
        ${c.phone ? html`<li>${icon('phone', 'contact-list__icon')}<span><span class="contact-list__label">${ctx.t('contact.phone')}</span><a href="${phoneHref(c.phone)}"><bdi dir="ltr">${c.phone.display}</bdi></a></span></li>` : ''}
        ${c.email ? html`<li>${icon('mail', 'contact-list__icon')}<span><span class="contact-list__label">${ctx.t('contact.email')}</span><a href="mailto:${c.email}">${c.email}</a></span></li>` : ''}
      </ul>
      ${p.body ? html`<div class="prose prose--small">${ctx.md(p.body)}</div>` : ''}
      ${actions(p.actions || defaultActions, ctx)}
      <ul class="social-links">
        ${ctx.site.social.map((s) => html`<li><a class="social-link" href="${s.url}" target="_blank" rel="noopener">${icon(s.icon, 'social-link__icon')}<span>${ctx.l(s.label)}</span></a></li>`)}
      </ul>
    </div>
    ${p.showMap !== false && c.mapEmbedUrl
      ? html`<div class="contact-map__map"><iframe src="${c.mapEmbedUrl}" title="${ctx.t('contact.mapTitle')}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`
      : p.showMap === true
        ? html`<div class="contact-map__map contact-map__map--slot" role="img" aria-label="${ctx.t('contact.mapTitle')}"><span class="contact-map__pin">${icon('church', 'contact-map__pin-icon')}</span><span class="contact-map__slot-text">${addressLines(ctx).join(', ')}</span></div>`
        : ''}
  </div>`;
}
