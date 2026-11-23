/**
 * rich-text — heading + markdown body, optionally beside an image.
 *
 * Props: eyebrow, title, accent, body (markdown; localized object, or a plain
 *        string with bodyLang for text that exists in one language only),
 *        bodyLang, media (Image, shown beside the text in an arch frame),
 *        notice (markdown text, or { title, text }),
 *        actions, more ({ title, body } collapsible extra text)
 */
import { html } from '../lib/html.mjs';
import { sectionHead, actions, figure } from './_primitives.mjs';

export const meta = {
  type: 'rich-text',
  title: 'Rich text',
  description: 'Section heading and Markdown body with optional side image, notice, collapsible extra text and actions.'
};

function notice(n, ctx) {
  if (!n) return '';
  const { title, text } = n.text !== undefined || n.title !== undefined ? n : { text: n };
  return html`<div class="notice notice--season">
    ${title ? html`<p class="notice__title">${ctx.l(title)}</p>` : ''}
    ${text ? html`<div class="notice__text prose prose--small">${ctx.md(text)}</div>` : ''}
  </div>`;
}

export function more(p, ctx) {
  if (!p.more) return '';
  return html`<details class="disclosure">
    <summary class="disclosure__summary"><span>${ctx.l(p.more.title)}</span></summary>
    <div class="disclosure__body prose">${ctx.md(p.more.body, { lang: p.more.bodyLang })}</div>
  </details>`;
}

export function render(p, ctx) {
  const body = html`<div class="rich-text__text">
    ${sectionHead(p, ctx, { level: p.headingLevel || 2 })}
    ${p.body ? html`<div class="prose">${ctx.md(p.body, { lang: p.bodyLang })}</div>` : ''}
    ${notice(p.notice, ctx)}
    ${more(p, ctx)}
    ${actions(p.actions, ctx, { className: 'rich-text__actions' })}
  </div>`;
  if (!p.media) return html`<div class="rich-text">${body}</div>`;
  return html`<div class="rich-text rich-text--media rich-text--media-end">
    ${body}
    <div class="rich-text__media">${figure(p.media, ctx, { frame: 'arch' })}</div>
  </div>`;
}
