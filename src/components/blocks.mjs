/**
 * General-purpose content blocks.
 *
 * cta-band   — eyebrow, title, accent, text, actions
 * card-grid  — eyebrow, title, intro, cards[] | source ("children": the
 *              subpages of this page, or of `parent`), card: { id, eyebrow, title,
 *              accent, text (markdown), image, icon, link, actions }
 * timeline   — eyebrow, title, intro, items: [{ year, title, text (markdown), image }]
 * link-list  — eyebrow, title, intro, groups (ids in links.json)
 * quote      — eyebrow, title, text (markdown), cite, image, more
 * notice     — title, text (markdown), actions
 * prayer     — eyebrow, title, text (liturgical original, line breaks kept),
 *              textLang (default "cu", Church Slavonic), translation (localized), cite, actions
 * fact-list  — eyebrow, title, intro, facts: [{ label, value (markdown) }], actions
 */
import { html, cx } from '../lib/html.mjs';
import { sectionHead, eyebrow, accent, actions, image, icon, cross, figure } from './_primitives.mjs';
import { more } from './rich-text.mjs';

export const metas = {
  'cta-band': { type: 'cta-band', title: 'Call to action band', description: 'Short message with one or two buttons on the navy band.', tone: 'navy' },
  'card-grid': { type: 'card-grid', title: 'Card grid', description: 'Grid of linked cards (page teasers, subpages) with optional image or pictogram.' },
  timeline: { type: 'timeline', title: 'Timeline', description: 'Parish history as dated milestones, with optional photographs.' },
  'link-list': { type: 'link-list', title: 'Link list', description: 'Grouped external links with short descriptions.', dataSources: ['links.json'] },
  quote: { type: 'quote', title: 'Quote / message', description: 'Pastoral message or quotation with attribution and optional portrait.' },
  notice: { type: 'notice', title: 'Notice', description: 'Highlighted announcement (season, alert or information).' },
  prayer: { type: 'prayer', title: 'Prayer', description: 'Liturgical text set with preserved line breaks.' },
  'fact-list': { type: 'fact-list', title: 'Fact list', description: 'Label/value list ("at a glance").' },

};

export function renderCta(p, ctx) {
  return html`<div class="cta-band">
    <div class="cta-band__text">
      ${eyebrow(ctx.l(p.eyebrow))}
      <h2 class="cta-band__title">${ctx.l(p.title)}</h2>
      ${accent(p.accent, ctx, 'cta-band__accent accent')}
      ${p.text ? html`<div class="cta-band__body">${ctx.md(p.text)}</div>` : ''}
    </div>
    ${actions(p.actions, ctx, { className: 'cta-band__actions', onDark: true })}
  </div>`;
}

function cardsFrom(p, ctx) {
  if (p.source === 'children') {
    const parent = p.parent || ctx.page.id;
    return ctx.content.pages
      .filter((x) => x.parent === parent && !x.generated && x.nav?.show !== false)
      .map((x) => ({ id: `card-${x.id}`, title: x.title, text: x.summary || x.seo?.description, image: x.cardImage, icon: x.nav?.icon, link: { page: x.id } }));
  }
  return (p.cards || []).filter((c) => !c.link || ctx.href(c.link));
}

export function renderCards(p, ctx) {
  const cards = cardsFrom(p, ctx);
  return html`<div class="card-grid-block">
    ${sectionHead(p, ctx)}
    <div class="${cx('card-grid', `card-grid--${Math.min(cards.length, cards.length === 4 ? 4 : 3)}`)}">
      ${cards.map((c) => {
        const url = ctx.href(c.link);
        const body = html`
          ${c.image ? html`<div class="card__media">${image({ ...c.image, alt: c.image.alt || '' }, ctx)}</div>` : ''}
          <div class="card__body">
            ${c.icon ? html`<span class="card__icon">${icon(c.icon, 'card__icon-svg')}</span>` : ''}
            ${eyebrow(ctx.l(c.eyebrow))}
            <h3 class="card__title">${ctx.l(c.title)}</h3>
            ${accent(c.accent, ctx, 'card__accent accent')}
            ${c.text ? html`<div class="card__text">${ctx.md(c.text)}</div>` : ''}
            ${url ? html`<span class="text-link">${ctx.l(c.link.label) || ctx.t('common.learnMore')}${icon(ctx.isExternal(url) ? 'external' : 'arrow', 'text-link__icon')}</span>` : ''}
            ${actions(c.actions, ctx, { size: 'sm' })}
          </div>`;
        const ext = ctx.isExternal(url);
        return url
          ? html`<article class="${cx('card', 'card--link', c.image && 'card--media')}"${c.id ? html` id="${c.id}"` : ''}><a class="card__link" href="${url}"${ext ? html` target="_blank" rel="noopener"` : ''}>${body}</a></article>`
          : html`<article class="${cx('card', c.image && 'card--media')}"${c.id ? html` id="${c.id}"` : ''}>${body}</article>`;
      })}
    </div>
  </div>`;
}

export function renderLinks(p, ctx) {
  const groups = p.groups.map((id) => {
    const g = ctx.content.index.linkGroups[id];
    if (!g) throw new Error(`Unknown link group "${id}"`);
    return g;
  });
  return html`<div class="link-list">
    ${sectionHead(p, ctx)}
    <div class="${cx('link-groups', `link-groups--${Math.min(groups.length, 3)}`)}">
      ${groups.map(
        (g) => html`<section class="link-group">
          ${g.title ? html`<h3 class="link-group__title">${ctx.l(g.title)}</h3>` : ''}
          <ul class="link-rows">
            ${g.links.map((l) => {
              const url = ctx.href(l);
              const ext = ctx.isExternal(url);
              const desc = ctx.l(l.description);
              return html`<li><a class="link-row" href="${url}"${ext ? html` target="_blank" rel="noopener"` : ''}>
                <span class="link-row__text"><span class="link-row__title">${ctx.l(l.label)}</span>${desc ? html`<span class="link-row__meta">${desc}</span>` : ''}</span>
                ${icon(ext ? 'external' : 'arrow', 'link-row__icon')}
              </a></li>`;
            })}
          </ul>
        </section>`
      )}
    </div>
  </div>`;
}

export function renderQuote(p, ctx) {
  return html`<div class="${cx('quote-block', p.image && 'quote-block--media')}">
    ${p.image ? html`<div class="quote-block__media">${figure(p.image, ctx, { frame: 'arch' })}</div>` : ''}
    <div class="quote-block__body">
      ${sectionHead({ eyebrow: p.eyebrow, title: p.title, accent: p.accent }, ctx, { align: p.image ? 'start' : 'center' })}
      <blockquote class="quote-block__quote">
        <div class="quote-block__text">${ctx.md(p.text)}</div>
        ${p.cite ? html`<footer class="quote-block__cite">${cross('quote-block__cross')}<cite>${ctx.l(p.cite)}</cite></footer>` : ''}
      </blockquote>
      ${more(p, ctx)}
      ${actions(p.actions, ctx)}
    </div>
  </div>`;
}

export function renderNotice(p, ctx) {
  return html`<div class="notice notice--block">
    ${p.title ? html`<p class="notice__title">${ctx.l(p.title)}</p>` : ''}
    ${p.text ? html`<div class="notice__text prose prose--small">${ctx.md(p.text)}</div>` : ''}
    ${actions(p.actions, ctx, { size: 'sm' })}
  </div>`;
}

const lines = (text) => text.split(/\n{2,}/).map((para) => html`<p>${para.split('\n').map((line, i) => html`${i ? html`<br>` : ''}${line}`)}</p>`);

// The liturgical original (`text`, e.g. Church Slavonic) is always shown.
// `translation` is shown only in locales that have their own translation.
export function renderPrayer(p, ctx) {
  const lang = p.textLang || 'cu';
  const tr = p.translation ? ctx.lx(p.translation) : null;
  const showTranslation = tr && tr.text && !tr.fallback;
  return html`<div class="prayer">
    ${sectionHead({ eyebrow: p.eyebrow, title: p.title, accent: p.accent }, ctx, { level: p.headingLevel || 3 })}
    ${showTranslation ? html`<div class="prayer__translation">${lines(tr.text)}</div>` : ''}
    <div class="prayer__text prayer__text--${lang}" lang="${lang}">${lines(p.text)}</div>
    ${p.cite ? html`<p class="prayer__cite">${ctx.l(p.cite)}</p>` : ''}
    ${actions(p.actions, ctx, { size: 'sm' })}
  </div>`;
}



export function renderFacts(p, ctx) {
  return html`<div class="fact-list">
    ${sectionHead(p, ctx)}
    <dl class="facts">
      ${p.facts.map((f) => html`<div class="facts__row"><dt>${ctx.l(f.label)}</dt><dd>${ctx.md(f.value, { inline: true })}</dd></div>`)}
    </dl>
    ${actions(p.actions, ctx)}
  </div>`;
}

export function renderTimeline(p, ctx) {
  return html`<div class="timeline-block">
    ${sectionHead(p, ctx)}
    <ol class="timeline">
      ${p.items.map(
        (item) => html`<li class="${cx('timeline__item', item.image && 'timeline__item--media')}">
          <p class="timeline__year"><span>${ctx.l(item.year)}</span></p>
          <span class="timeline__mark" aria-hidden="true">${cross('timeline__cross')}</span>
          <div class="timeline__body">
            <h3 class="timeline__title">${ctx.l(item.title)}</h3>
            ${item.text ? html`<div class="timeline__text prose prose--small">${ctx.md(item.text)}</div>` : ''}
            ${item.image ? figure(item.image, ctx, { className: 'timeline__figure' }) : ''}
          </div>
        </li>`
      )}
    </ol>
    ${actions(p.actions, ctx, { className: 'section-actions' })}
  </div>`;
}
