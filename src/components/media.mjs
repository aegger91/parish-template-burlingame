/**
 * Media components.
 *
 * gallery props: eyebrow, title, intro, gallery (one album id in galleries.json)
 *   or galleries (several album ids, with album filter buttons), limit
 * video-list props: eyebrow, title, intro,
 *   videos: [{ id, youtubeId, embed, title, date, description, descriptionLang }]
 *
 * Photos open in an accessible lightbox (site.js) with captions and a count.
 * Videos render as a lightweight facade (YouTube thumbnail from i.ytimg.com);
 * the player (privacy-enhanced youtube-nocookie.com) loads only after a click.
 */
import { html, cx } from '../lib/html.mjs';
import { sectionHead, icon, cross, image } from './_primitives.mjs';

export const galleryMeta = {
  type: 'gallery',
  title: 'Photo gallery',
  description: 'Photo grid with album filters and an accessible lightbox.',
  dataSources: ['galleries.json']
};

export const videoMeta = {
  type: 'video-list',
  title: 'Video list',
  description: 'YouTube videos as click-to-load facades, optionally with dated descriptions.'
};

const album = (id, ctx) => {
  const g = ctx.content.index.galleries[id];
  if (!g) throw new Error(`Unknown gallery "${id}"`);
  return g;
};

function grid(entries, ctx, { columns = 4, id } = {}) {
  // A short album fills the row instead of leaving empty columns; three photos
  // stay on one row on phones rather than leaving one orphan.
  const cols = Math.max(2, Math.min(columns, entries.length));
  return html`<ul class="${cx('gallery', `gallery--${cols}`, entries.length === 3 && 'gallery--trio')}"${id ? html` data-gallery="${id}"` : ''}>
    ${entries.map(
      ({ img, g }) => html`<li class="gallery__item" data-filter-item data-category="${g.id}"><a class="gallery__link" href="${ctx.asset(img.src)}" data-lightbox data-caption="${ctx.l(img.caption) || ctx.l(img.alt) || ctx.l(g.title)}">${image({ ...img, alt: img.alt || g.title }, ctx, { className: 'gallery__img', sizes: '(min-width: 900px) 25vw, 50vw' })}<span class="visually-hidden">${ctx.t('gallery.openPhoto')}</span></a></li>`
    )}
  </ul>`;
}

export function galleryGrid(galleryId, ctx, { limit, columns = 4 } = {}) {
  const g = album(galleryId, ctx);
  const images = limit ? g.images.slice(0, limit) : g.images;
  return grid(images.map((img) => ({ img, g })), ctx, { columns, id: g.id });
}

export function renderGallery(p, ctx) {
  if (!p.galleries) return html`<div class="gallery-block">${sectionHead(p, ctx)}${galleryGrid(p.gallery, ctx, { limit: p.limit })}</div>`;
  const albums = p.galleries.map((id) => album(id, ctx));
  let entries = albums.flatMap((g) => g.images.map((img) => ({ img, g })));
  if (p.limit) entries = entries.slice(0, p.limit);
  return html`<div class="gallery-block" data-filter-root>
    ${sectionHead(p, ctx)}
    ${albums.length > 1
      ? html`<div class="filter-bar" role="group" aria-label="${ctx.t('gallery.albums')}" data-filter-bar hidden>
          <button class="chip" type="button" data-filter="" aria-pressed="true">${ctx.t('filter.all')}</button>
          ${albums.map((g) => html`<button class="chip" type="button" data-filter="${g.id}" aria-pressed="false">${ctx.l(g.title)}<span class="chip__count">${g.images.length}</span></button>`)}
        </div>`
      : ''}
    ${grid(entries, ctx)}
  </div>`;
}

export function videoFacade(v, ctx) {
  const url = `https://www.youtube.com/watch?v=${v.youtubeId}`;
  const title = ctx.l(v.title) || ctx.t('video.watch');
  const inline = v.embed !== false;
  return html`<div class="video"${inline ? html` data-youtube="${v.youtubeId}"` : ''}>
    ${cross('video__mark')}
    <img class="video__thumb" src="https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">
    <a class="video__link" href="${url}" target="_blank" rel="noopener">
      <span class="video__play">${icon('play', 'video__play-icon')}</span>
      <span class="video__text"><span class="video__title">${title}</span><span class="video__meta">${icon('youtube', 'video__yt')}${ctx.t(inline ? 'video.playsFromYoutube' : 'video.opensOnYoutube')}</span></span>
    </a>
  </div>`;
}

export function renderVideos(p, ctx) {
  return html`<div class="video-list">
    ${sectionHead(p, ctx)}
    <div class="video-list__items">
      ${p.videos.map(
        (v) => html`<article class="video-item"${v.id ? html` id="${v.id}"` : ''}>
          ${v.date ? html`<p class="video-item__date"><time datetime="${v.date}">${ctx.formatDate(v.date, 'full')}</time></p>` : ''}
          ${v.heading ? html`<h3 class="video-item__title">${ctx.l(v.heading)}</h3>` : ''}
          ${v.description ? html`<div class="prose prose--small">${ctx.md(v.description, { lang: v.descriptionLang })}</div>` : ''}
          ${v.youtubeId ? videoFacade(v, ctx) : v.status ? html`<p class="video-item__status">${ctx.l(v.status)}</p>` : ''}
        </article>`
      )}
    </div>
  </div>`;
}
