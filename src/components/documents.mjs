/**
 * document-list — PDFs, audio and external documents from content/documents.json.
 *
 * Props: eyebrow, title, intro, group (group id), documents (explicit ids),
 *        groupBy ("year" | "volume" | "category"), columns (1 | 2 | 3), limit, actions
 *
 * Large files are not committed: `url` is either a path under public/
 * ("/assets/docs/…") or the parish's original live URL.
 */
import { html, cx } from '../lib/html.mjs';
import { sectionHead, actions, icon } from './_primitives.mjs';

export const meta = {
  type: 'document-list',
  title: 'Document list',
  description: 'Downloadable documents with type/language badges, optionally grouped by year or category.',
  dataSources: ['documents.json']
};

export function docKind(doc) {
  const target = doc.url.toLowerCase().split('?')[0];
  if (target.endsWith('.pdf')) return 'pdf';
  if (target.endsWith('.mp3')) return 'mp3';
  if (/\.(docx?|rtf)$/.test(target)) return 'doc';
  return 'link';
}

export function docRow(doc, ctx) {
  const href = ctx.documentUrl(doc.id);
  const kind = docKind(doc);
  const external = !doc.url.startsWith('/');
  const meta = ctx.l(doc.note);
  return html`<li><a class="doc-row" href="${href}" data-kind="${kind}"${external || kind === 'pdf' ? html` target="_blank" rel="noopener"` : ''}>
    ${icon(kind === 'mp3' ? 'audio' : 'doc', 'doc-row__icon')}
    <span class="doc-row__text"><span class="doc-row__title"${doc.titleLang ? html` lang="${doc.titleLang}"` : ''}>${ctx.l(doc.title)}</span>${meta ? html`<span class="doc-row__meta">${meta}</span>` : ''}</span>
    <span class="doc-row__badges">
      ${doc.lang ? html`<span class="badge badge--lang" title="${ctx.t(`lang.${doc.lang}`)}">${doc.lang.toUpperCase()}</span>` : ''}
      ${kind !== 'link' ? html`<span class="badge">${kind.toUpperCase()}</span>` : ''}
      ${external ? html`<span class="visually-hidden">${ctx.t('a11y.opensNewWindow')}</span>${icon('external', 'doc-row__ext')}` : ''}
    </span>
  </a></li>`;
}

function selectDocs(p, ctx) {
  const all = ctx.content.documents.documents;
  if (p.documents) return p.documents.map((id) => ctx.content.index.documents[id] || fail(id));
  return all.filter((d) => d.group === p.group);
}

function fail(id) {
  throw new Error(`Unknown document "${id}"`);
}

export function render(p, ctx) {
  let docs = selectDocs(p, ctx);
  if (p.limit) docs = docs.slice(0, p.limit);
  const cols = p.groupBy === 'year' || p.groupBy === 'volume' ? 3 : 1;
  let body;
  if (p.groupBy === 'year' || p.groupBy === 'volume') {
    const key = p.groupBy;
    const values = [...new Set(docs.map((d) => d[key]))].sort((a, b) => b - a);
    const label = (v) => (key === 'volume' ? ctx.t('documents.volume', { n: v }) : v);
    body = html`<div class="${cx('doc-groups', 'doc-groups--compact', `doc-groups--${cols}`)}">${values.map(
      (v) => html`<section class="doc-group"><h3 class="doc-group__title">${label(v)}</h3><ul class="doc-list doc-list--compact">${docs.filter((d) => d[key] === v).map((d) => docRow(d, ctx))}</ul></section>`
    )}</div>`;
  } else if (p.groupBy === 'category') {
    const group = ctx.content.index.documentGroups[p.group];
    body = html`<div class="${cx('doc-groups', `doc-groups--${cols}`)}">${group.categories.map((c) => {
      const items = docs.filter((d) => d.category === c.id);
      if (!items.length) return '';
      return html`<section class="doc-group" id="${c.id}"><h3 class="doc-group__title">${ctx.l(c.title)}</h3><ul class="doc-list">${items.map((d) => docRow(d, ctx))}</ul></section>`;
    })}</div>`;
  } else {
    body = html`<ul class="${cx('doc-list', cols > 1 && `doc-list--${cols}`)}">${docs.map((d) => docRow(d, ctx))}</ul>`;
  }
  return html`<div class="document-list">${sectionHead(p, ctx)}${body}${actions(p.actions, ctx)}</div>`;
}
