/**
 * Commemoration notes and candles (features.commemorations), from content/zapiski.json.
 *
 * zapiski props: eyebrow, title, intro
 *
 * Modeled on the paper slips at the candle desk: an eight-pointed cross at
 * the top, "For Health" (red slip) or "For the Repose" (black border),
 * up to zapiski.maxNames baptismal names with optional prefixes
 * (clergy, infant), the commemoration (Proskomedia, Liturgy, Moleben,
 * Panikhida, Sorokoust) with its suggested donation, and an optional candle.
 * A visitor can fill in several slips, then add them to the cart or go
 * straight to checkout. Payment is the same placeholder as the store.
 */
import { html, raw, cx } from '../lib/html.mjs';
import { sectionHead, icon, cross, accentLang } from './_primitives.mjs';

export const meta = {
  type: 'zapiski',
  title: 'Commemoration notes and candles',
  description: 'Online commemoration notes (zapiski) for health or repose, with commemoration type, candles and a donation.',
  dataSources: ['zapiski.json']
};

const json = (value) => raw(JSON.stringify(value).replace(/</g, '\\u003c'));

function nameRow(z, ctx, n) {
  return html`<li class="slip__name" data-name-row>
    <span class="slip__num" aria-hidden="true"></span>
    <label class="visually-hidden" for="slip-${n}-prefix-0" data-for="prefix">${ctx.t('zapiski.prefix')}</label>
    <select class="slip__prefix" id="slip-${n}-prefix-0" name="prefix" data-field="prefix">
      <option value="">${ctx.t('zapiski.noPrefix')}</option>
      ${z.prefixes.map((pr) => html`<option value="${pr.id}">${ctx.l(pr.label)}</option>`)}
    </select>
    <label class="visually-hidden" for="slip-${n}-name-0" data-for="name">${ctx.t('zapiski.name')}</label>
    <input class="slip__input" id="slip-${n}-name-0" name="name" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="${ctx.t('zapiski.namePlaceholder')}" data-field="name">
    <button class="icon-btn slip__remove-name" type="button" data-remove-name>${icon('close', 'icon-btn__icon')}<span class="visually-hidden">${ctx.t('zapiski.removeName')}</span></button>
  </li>`;
}

function slip(z, ctx, n) {
  const [first] = z.types;
  const al = accentLang(ctx);
  return html`<fieldset class="${cx('slip', `slip--${first.id}`)}" data-slip data-type="${first.id}">
    <legend class="slip__legend"><span data-slip-label>${ctx.t('zapiski.slip', { n: n + 1 })}</span></legend>
    <div class="segmented slip__types" role="radiogroup" aria-label="${ctx.t('zapiski.type')}">
      ${z.types.map(
        (t, i) => html`<label class="segmented__btn"><input class="visually-hidden" type="radio" name="slip-${n}-type" value="${t.id}"${i === 0 ? ' checked' : ''} data-field="type"><span>${ctx.l(t.label)}</span></label>`
      )}
    </div>
    <div class="slip__paper">
      ${cross('slip__cross')}
      ${z.types.map((t, i) => html`<p class="slip__heading" lang="${t.heading ? al : ctx.locale}" data-heading="${t.id}"${i === 0 ? '' : ' hidden'}>${t.heading || ctx.l(t.label)}</p>`)}
      <ol class="slip__names" data-names data-max="${z.maxNames}">${nameRow(z, ctx, n)}</ol>
      <div class="slip__name-actions">
        <button class="btn btn--link btn--sm" type="button" data-add-name>${icon('plus', 'btn__icon')}<span>${ctx.t('zapiski.addName')}</span></button>
        <span class="slip__count" data-name-count aria-live="polite"></span>
      </div>
    </div>
    <div class="slip__options">
      <fieldset class="choice-group">
        <legend class="field__label">${ctx.t('zapiski.commemoration')}</legend>
        <div class="choice-group__options choice-group__options--stack">
          ${z.commemorations.map(
            (c, i) => html`<label class="choice choice--card" data-for-types="${(c.for || z.types.map((t) => t.id)).join(' ')}"><input type="radio" name="slip-${n}-commemoration" value="${c.id}"${i === 0 ? ' checked' : ''} data-field="commemoration" data-amount="${c.suggested || 0}"><span class="choice__label"><strong>${ctx.l(c.label)}</strong>${c.text ? html`<span class="choice__hint">${ctx.l(c.text)}</span>` : ''}</span><span class="choice__price">${c.suggested ? ctx.money(c.suggested) : ctx.t('requests.free')}</span></label>`
          )}
        </div>
      </fieldset>
      ${z.candles?.enabled !== false && z.candles?.sizes?.length
        ? html`<div class="slip__candle">
            <label class="field__label" for="slip-${n}-candle">${icon('candle', 'slip__candle-icon')}${ctx.l(z.candles.label) || ctx.t('zapiski.candle')} <span class="field__optional">${ctx.t('form.optional')}</span></label>
            <div class="slip__candle-row">
              <select class="field__input" id="slip-${n}-candle" data-field="candle">
                <option value="" data-amount="0">${ctx.t('zapiski.noCandle')}</option>
                ${z.candles.sizes.map((s) => html`<option value="${s.id}" data-amount="${s.price}">${ctx.l(s.label)} · ${ctx.money(s.price)}</option>`)}
              </select>
              <label class="visually-hidden" for="slip-${n}-candles">${ctx.t('cart.quantity')}</label>
              <input class="field__input slip__candle-qty" id="slip-${n}-candles" type="number" inputmode="numeric" min="1" max="50" value="1" data-field="candleQty">
            </div>
          </div>`
        : ''}
    </div>
    <div class="slip__foot">
      <p class="slip__subtotal">${ctx.t('zapiski.slipTotal')} <strong data-slip-total></strong></p>
      <button class="btn btn--link btn--sm slip__remove" type="button" data-remove-slip>${icon('trash', 'btn__icon')}<span>${ctx.t('zapiski.removeSlip')}</span></button>
    </div>
  </fieldset>`;
}

export function render(p, ctx) {
  const z = ctx.content.zapiski;
  if (!z) return '';
  const cartPage = ctx.content.pages.find((x) => x.requires === 'cart');
  const strings = {
    prefixes: Object.fromEntries(z.prefixes.map((pr) => [pr.id, ctx.l(pr.short || pr.label)])),
    types: Object.fromEntries(z.types.map((t) => [t.id, ctx.l(t.label)])),
    commemorations: Object.fromEntries(z.commemorations.map((c) => [c.id, ctx.l(c.label)])),
    candles: Object.fromEntries((z.candles?.sizes || []).map((s) => [s.id, ctx.l(s.label)])),
    candle: ctx.l(z.candles?.label) || ctx.t('zapiski.candle'),
    title: ctx.t('zapiski.cartTitle'),
    donation: ctx.t('zapiski.donationLine')
  };
  return html`<div class="zapiski" data-zapiski data-cart-url="${cartPage ? ctx.pagePath(cartPage.id) : ''}" data-page-url="${ctx.pagePath(ctx.page.id)}">
    ${sectionHead(p, ctx)}
    <script type="application/json" data-zapiski-strings>${json(strings)}</script>
    <div class="zapiski__hint">
      ${icon('candle', 'zapiski__hint-icon')}
      <div class="prose prose--small">${ctx.md(z.hint)}</div>
    </div>
    <noscript><p class="notice">${ctx.t('zapiski.noscript')}</p></noscript>
    <form class="zapiski__form" data-zapiski-form novalidate hidden>
      <div class="zapiski__slips" data-slips>${slip(z, ctx, 0)}</div>
      <template data-slip-template>${slip(z, ctx, 0)}</template>
      <button class="btn btn--secondary zapiski__add" type="button" data-add-slip>${icon('plus', 'btn__icon')}<span>${ctx.t('zapiski.addSlip')}</span></button>
      <div class="zapiski__summary card">
        ${z.donation?.enabled !== false
          ? html`<div class="field">
              <label class="field__label" for="zap-donation">${ctx.l(z.donation?.label) || ctx.t('zapiski.donation')} <span class="field__optional">${ctx.t('form.optional')}</span></label>
              <div class="money-input"><span class="money-input__sign" aria-hidden="true">${ctx.money(0).replace(/[\d.,\s\u00a0]/g, '')}</span><input class="field__input" id="zap-donation" type="number" inputmode="decimal" min="0" step="1" placeholder="0" data-zapiski-donation></div>
            </div>`
          : ''}
        <dl class="cart__totals">
          <div><dt>${ctx.t('zapiski.notes')}</dt><dd data-zapiski-count></dd></div>
          <div class="cart__grand"><dt>${ctx.t('cart.total')}</dt><dd data-zapiski-total></dd></div>
        </dl>
        <label class="consent"><input type="checkbox" required data-zapiski-consent><span>${ctx.l(z.consent)}</span></label>
        <div class="zapiski__actions">
          <button class="btn btn--secondary" type="submit" data-zapiski-action="cart">${icon('cart', 'btn__icon')}<span>${ctx.t('zapiski.addToCart')}</span></button>
          <button class="btn btn--accent" type="submit" data-zapiski-action="checkout">${ctx.t('zapiski.submit')}</button>
        </div>
        <p class="form-status" role="status" aria-live="polite" data-form-status hidden></p>
      </div>
    </form>
  </div>`;
}
