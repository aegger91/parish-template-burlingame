/**
 * Giving components — data from content/giving.json.
 *
 * donate-form props: eyebrow, title, intro, funds (fund ids; default all),
 *   frequency ("once" | "monthly", the one selected first)
 * dues-table props: eyebrow, title, body (markdown), actions
 *
 * The donation form is provider-agnostic. site.js collects { frequency,
 * amount, fund, name, email } and calls ParishSite.handlers.donate(gift),
 * the one place to connect Stripe, Authorize.net, PayPal or another
 * processor. When giving.endpoint is set and no handler exists, it POSTs
 * there instead.
 *
 * Amounts start at 0 with optional suggested chips and a free Other amount
 * field. There is no minimum amount.
 */
import { html } from '../lib/html.mjs';
import { sectionHead, actions, icon, cross } from './_primitives.mjs';

export const donateMeta = {
  type: 'donate-form',
  title: 'Donation form',
  description: 'One-time or monthly gift with suggested amounts, a custom amount and a fund picker. Placeholder payment handler.',
  dataSources: ['giving.json']
};

export const duesMeta = {
  type: 'dues-table',
  title: 'Membership dues',
  description: 'Monthly membership dues rates with notes.',
  dataSources: ['giving.json']
};

export function renderDonate(p, ctx) {
  const g = ctx.content.giving;
  const funds = p.funds ? p.funds.map((id) => ctx.content.index.funds[id]) : g.funds;
  const first = p.frequency || 'once';
  const amounts = g.amounts || { once: [25, 50, 100, 250], monthly: [10, 25, 50, 100] };
  return html`<div class="donate">
    <div class="donate__intro">
      ${sectionHead(p, ctx)}
      ${g.note ? html`<p class="donate__note">${cross('donate__note-cross')}<span>${ctx.l(g.note)}</span></p>` : ''}
    </div>
    <form class="card donate-form" data-form="donate" data-endpoint="${g.endpoint || ''}" data-provider="${g.provider || ''}" novalidate>
      <div class="segmented segmented--wide" role="radiogroup" aria-label="${ctx.t('donate.frequency')}">
        ${['once', 'monthly'].map((f) => html`<label class="segmented__btn"><input class="visually-hidden" type="radio" name="frequency" value="${f}"${f === first ? ' checked' : ''}><span>${ctx.t(`donate.${f}`)}</span></label>`)}
      </div>
      ${['once', 'monthly'].map(
        (f) => html`<fieldset class="amounts" data-amounts="${f}"${f === first ? '' : ' hidden'}>
          <legend class="field__label">${ctx.t('donate.suggested')}</legend>
          <div class="amounts__grid">
            ${amounts[f].map((a) => html`<label class="amount"><input class="visually-hidden" type="radio" name="amount-${f}" value="${a}"><span>${ctx.money(a)}${f === 'monthly' ? html`<small>${ctx.t('donate.perMonth')}</small>` : ''}</span></label>`)}
            <label class="amount amount--other"><input class="visually-hidden" type="radio" name="amount-${f}" value="other" checked><span>${ctx.t('donate.other')}</span></label>
          </div>
        </fieldset>`
      )}
      <div class="field" data-other-amount>
        <label class="field__label" for="dn-other">${ctx.t('donate.otherAmount')}</label>
        <div class="money-input"><span class="money-input__sign" aria-hidden="true">${ctx.money(0).replace(/[\d.,\s\u00a0]/g, '')}</span><input class="field__input" id="dn-other" name="other" type="number" inputmode="decimal" min="0" step="any" value="0" placeholder="0"></div>
      </div>
      ${funds.length > 1
        ? html`<div class="field"><label class="field__label" for="dn-fund">${ctx.t('donate.fund')}</label>
            <select class="field__input" id="dn-fund" name="fund">${funds.map((f) => html`<option value="${f.id}">${ctx.l(f.title)}</option>`)}</select>
            <p class="field__hint" data-fund-hint>${ctx.l(funds[0].description)}</p>
            <script type="application/json" data-fund-hints>${JSON.stringify(Object.fromEntries(funds.map((f) => [f.id, ctx.l(f.description)])))}</script>
          </div>`
        : html`<input type="hidden" name="fund" value="${funds[0]?.id || ''}">`}
      <div class="form-grid">
        <div class="field"><label class="field__label" for="dn-name">${ctx.t('form.name')}</label><input class="field__input" id="dn-name" name="name" autocomplete="name" required></div>
        <div class="field"><label class="field__label" for="dn-email">${ctx.t('form.email')}</label><input class="field__input" id="dn-email" name="email" type="email" autocomplete="email" required></div>
      </div>
      <button class="btn btn--accent btn--block btn--lg" type="submit">${icon('candle', 'btn__icon')}<span data-donate-label>${ctx.t('donate.give')}</span></button>
      <p class="form-note">${ctx.t('donate.secureNote')}</p>
      <p class="form-status" role="status" aria-live="polite" data-form-status hidden></p>
    </form>
  </div>`;
}

export function renderDues(p, ctx) {
  const dues = ctx.content.giving.dues;
  if (!dues) return '';
  return html`<div class="dues-block">
    ${sectionHead(p, ctx)}
    <dl class="dues">
      ${dues.rates.map((r) => html`<div class="dues__item"><dt class="dues__amount">${ctx.money(r.amount)}</dt><dd class="dues__label">${ctx.l(r.label)}</dd></div>`)}
    </dl>
    ${p.body ? html`<div class="prose">${ctx.md(p.body)}</div>` : ''}
    ${actions(p.actions, ctx)}
  </div>`;
}
