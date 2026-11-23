/**
 * page-header — title block at the top of every inner page.
 *
 * Props: eyebrow, title, accent (liturgical-language line), lede, image (shown
 *        in an onion-arch frame), breadcrumbs (bool, default true)
 * Breadcrumbs follow the page tree (Home > Our Parish > Clergy).
 */
import { html } from '../lib/html.mjs';
import { eyebrow, accentUnlessSame, image } from './_primitives.mjs';

export const meta = {
  type: 'page-header',
  title: 'Page header',
  bare: true,
  description: 'Breadcrumbs, eyebrow, H1, accent line and lede, with an arch-framed photograph.'
};

export function breadcrumbs(ctx) {
  const trail = (ctx.page.ancestors || []).map((id) => ctx.content.index.pages[id]).filter(Boolean);
  return html`<nav class="breadcrumbs" aria-label="${ctx.t('a11y.breadcrumbs')}"><ol>
    <li><a href="${ctx.pagePath('home')}">${ctx.t('nav.home')}</a></li>
    ${trail.map((p) => html`<li><a href="${ctx.pagePath(p.id)}">${ctx.pageTitle(p, { short: true })}</a></li>`)}
    <li aria-current="page">${ctx.pageTitle(ctx.page, { short: true })}</li>
  </ol></nav>`;
}

export function render(p, ctx) {
  return html`<section class="page-header${p.image ? '' : ' page-header--plain'}" id="${p.id}" data-section-type="page-header">
    <div class="container page-header__inner">
      <div class="page-header__content">
        ${p.breadcrumbs !== false ? breadcrumbs(ctx) : ''}
        ${eyebrow(ctx.l(p.eyebrow))}
        <h1 class="page-header__title">${ctx.l(p.title)}</h1>
        ${accentUnlessSame(p.accent, ctx.l(p.title), ctx, 'page-header__accent accent')}
        ${p.lede ? html`<p class="page-header__lede">${ctx.l(p.lede)}</p>` : ''}
      </div>
      ${p.image ? html`<div class="page-header__media arch-frame">${image(p.image, ctx, { priority: true, sizes: '(min-width: 900px) 40vw, 100vw' })}</div>` : ''}
    </div>
  </section>`;
}
