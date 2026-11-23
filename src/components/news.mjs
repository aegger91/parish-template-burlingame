/**
 * news-list — items from content/news.json.
 *
 * Props: eyebrow, title, intro, limit, featuredOnly (bool), category (only
 *        one category), filters (category buttons from news.categories),
 *        articles (true on the News page: full articles instead of cards), actions
 * Cards link to the full article on the news page (#item-id).
 */
import { html } from '../lib/html.mjs';
import { sectionHead, actions, image, figure, icon, accent } from './_primitives.mjs';
import { galleryGrid, videoFacade } from './media.mjs';

export const meta = {
  type: 'news-list',
  title: 'News list',
  description: 'News cards or full articles, with category filters, galleries, videos and links.',
  dataSources: ['news.json', 'galleries.json']
};

const dateText = (item, ctx) => (item.dateLabel ? ctx.l(item.dateLabel) : item.date ? ctx.formatDate(item.date, 'long') : '');
const newsPage = (ctx) => ctx.content.pages.find((p) => p.sections.some((s) => s.type === 'news-list' && s.articles));

function cardImage(item, ctx) {
  if (item.image) return item.image;
  if (item.gallery) return ctx.content.index.galleries[item.gallery]?.images[0];
  return null;
}

const categoryLabel = (item, ctx) => {
  const c = ctx.content.index.newsCategories?.[item.category];
  return c ? html`<span class="news-cat">${ctx.l(c.label)}</span>` : '';
};

function card(item, ctx, page) {
  const img = cardImage(item, ctx);
  const date = dateText(item, ctx);
  const url = page ? ctx.pagePath(page.id, { anchor: item.id }) : null;
  const inner = html`${img ? html`<div class="news-card__media">${image({ ...img, alt: '' }, ctx, { sizes: '(min-width: 900px) 33vw, 100vw' })}</div>` : ''}
      <div class="news-card__body">
        <p class="news-card__date">${categoryLabel(item, ctx)}${date ? html`<span>${date}</span>` : ''}</p>
        <h3 class="news-card__title">${ctx.l(item.title)}</h3>
        ${item.summary ? html`<p class="news-card__summary">${ctx.l(item.summary)}</p>` : ''}
        ${url ? html`<span class="text-link">${ctx.t('news.readMore')}${icon('arrow', 'text-link__icon')}</span>` : ''}
      </div>`;
  return html`<article class="card news-card" data-filter-item data-category="${item.category || ''}">
    ${url ? html`<a class="news-card__link" href="${url}">${inner}</a>` : inner}
  </article>`;
}

function article(item, ctx) {
  const date = dateText(item, ctx);
  return html`<article class="news-article" id="${item.id}" data-filter-item data-category="${item.category || ''}">
    <header class="news-article__head">
      <p class="news-article__date">${categoryLabel(item, ctx)}${date ? html`<span>${date}</span>` : ''}</p>
      <h2 class="news-article__title">${ctx.l(item.title)}</h2>
      ${accent(item.accent, ctx, 'news-article__accent accent')}
    </header>
    <div class="news-article__body">
      ${item.body ? html`<div class="prose">${ctx.md(item.body)}</div>` : ''}
      ${item.links?.length
        ? html`<ul class="link-rows">${item.links.map((l) => {
            const url = ctx.href(l);
            if (!url) return '';
            const ext = ctx.isExternal(url);
            return html`<li><a class="link-row" href="${url}"${ext ? html` target="_blank" rel="noopener"` : ''}><span>${ctx.l(l.label)}</span>${icon(ext ? 'external' : 'arrow', 'link-row__icon')}</a></li>`;
          })}</ul>`
        : ''}
      ${item.videos?.length ? html`<div class="news-article__videos">${item.videos.map((v) => videoFacade(v, ctx))}</div>` : ''}
      ${item.figures?.length ? html`<div class="figure-row">${item.figures.map((f) => figure(f, ctx))}</div>` : ''}
      ${item.image && !item.gallery ? figure(item.image, ctx, { className: 'news-article__figure' }) : ''}
      ${item.gallery ? galleryGrid(item.gallery, ctx, { columns: 4 }) : ''}
    </div>
  </article>`;
}

function filterBar(items, ctx) {
  const cats = (ctx.content.news.categories || []).filter((c) => items.some((i) => i.category === c.id));
  if (cats.length < 2) return '';
  return html`<div class="filter-bar" role="group" aria-label="${ctx.t('filter.label')}" data-filter-bar hidden>
    <button class="chip" type="button" data-filter="" aria-pressed="true">${ctx.t('filter.all')}</button>
    ${cats.map((c) => html`<button class="chip" type="button" data-filter="${c.id}" aria-pressed="false">${ctx.l(c.label)}</button>`)}
  </div>`;
}

export function render(p, ctx) {
  let items = ctx.content.news.items.filter((i) => i.published !== false);
  if (p.featuredOnly) items = items.filter((i) => i.featured);
  if (p.category) items = items.filter((i) => i.category === p.category);
  if (p.limit) items = items.slice(0, p.limit);
  if (!items.length) return '';
  const filters = p.filters ? filterBar(items, ctx) : '';
  if (p.articles) {
    return html`<div class="news-full" data-filter-root>${sectionHead(p, ctx)}${filters}${items.map((i) => article(i, ctx))}<p class="filter-empty" data-filter-empty hidden>${ctx.t('filter.none')}</p></div>`;
  }
  const page = newsPage(ctx);
  return html`<div class="news-list" data-filter-root>
    ${sectionHead(p, ctx)}
    ${filters}
    <div class="card-grid card-grid--3">${items.map((i) => card(i, ctx, page))}</div>
    <p class="filter-empty" data-filter-empty hidden>${ctx.t('filter.none')}</p>
    ${actions(p.actions, ctx, { className: 'section-actions' })}
  </div>`;
}
