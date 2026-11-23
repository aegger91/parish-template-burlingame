// Section registry: maps a section `type` (as used in content/pages/*.json)
// to its component. Add a component here and run `npm run schemas` to make
// it available to pages. Sections carry content only: the design decides
// how each type looks (meta.tone, meta.width), and backgrounds alternate
// down the page on their own.
import { html, attrs, cx } from '../lib/html.mjs';
import * as hero from './hero.mjs';
import * as pageHeader from './page-header.mjs';
import * as richText from './rich-text.mjs';
import * as serviceTimes from './service-times.mjs';
import * as people from './people.mjs';
import * as news from './news.mjs';
import * as media from './media.mjs';
import * as giving from './giving.mjs';
import * as documents from './documents.mjs';
import * as contact from './contact.mjs';
import * as blocks from './blocks.mjs';
import * as oc from './orthodoxconnect.mjs';
import * as schedule from './schedule.mjs';
import * as sermons from './sermons.mjs';
import * as store from './store.mjs';
import * as requests from './requests.mjs';
import * as zapiski from './zapiski.mjs';

export const registry = {
  hero: { meta: hero.meta, render: hero.render },
  'page-header': { meta: pageHeader.meta, render: pageHeader.render },
  'rich-text': { meta: richText.meta, render: richText.render },
  'service-times': { meta: serviceTimes.meta, render: serviceTimes.render },
  'person-profile': { meta: people.profileMeta, render: people.renderProfile },
  'people-list': { meta: people.listMeta, render: people.renderList },
  schedule: { meta: schedule.meta, render: schedule.render },
  'news-list': { meta: news.meta, render: news.render },
  gallery: { meta: media.galleryMeta, render: media.renderGallery },
  'video-list': { meta: media.videoMeta, render: media.renderVideos },
  'donate-form': { meta: giving.donateMeta, render: giving.renderDonate },
  'dues-table': { meta: giving.duesMeta, render: giving.renderDues },
  'document-list': { meta: documents.meta, render: documents.render },
  'contact-map': { meta: contact.meta, render: contact.render },
  'contact-form': { meta: contact.formMeta, render: contact.renderForm },
  livestream: { meta: sermons.liveMeta, render: sermons.renderLive },
  'sermon-list': { meta: sermons.sermonMeta, render: sermons.renderSermons },
  store: { meta: store.storeMeta, render: store.renderStore },
  'product-detail': { meta: store.productMeta, render: store.renderProduct },
  cart: { meta: store.cartMeta, render: store.renderCart },
  'request-services': { meta: requests.meta, render: requests.render },
  zapiski: { meta: zapiski.meta, render: zapiski.render },
  'cta-band': { meta: blocks.metas['cta-band'], render: blocks.renderCta },
  'card-grid': { meta: blocks.metas['card-grid'], render: blocks.renderCards },
  timeline: { meta: blocks.metas.timeline, render: blocks.renderTimeline },
  'link-list': { meta: blocks.metas['link-list'], render: blocks.renderLinks },
  quote: { meta: blocks.metas.quote, render: blocks.renderQuote },
  notice: { meta: blocks.metas.notice, render: blocks.renderNotice },
  prayer: { meta: blocks.metas.prayer, render: blocks.renderPrayer },
  'fact-list': { meta: blocks.metas['fact-list'], render: blocks.renderFacts },
  'orthodoxconnect-feed': { meta: oc.feedMeta, render: oc.renderFeed },
  'orthodoxconnect-cta': { meta: oc.ctaMeta, render: oc.renderCta }
};

const visible = (s, ctx) => s.enabled !== false && (!s.locales || s.locales.includes(ctx.locale));

function component(type) {
  const entry = registry[type];
  if (!entry) throw new Error(`Unknown section type "${type}"`);
  return entry;
}

// A block is a section rendered inside another component.
export function renderBlock(block, ctx) {
  if (!visible(block, ctx)) return '';
  const { render } = component(block.type);
  const inner = render(block, ctx, { renderBlock });
  if (!String(inner).trim()) return '';
  return html`<div${attrs({ class: cx('block', `block--${block.type}`), id: block.id, 'data-section-type': block.type })}>${inner}</div>`;
}

export function renderSection(section, ctx) {
  if (!visible(section, ctx)) return '';
  const { meta, render } = component(section.type);
  const inner = render(section, ctx, { renderBlock });
  if (meta.bare || !String(inner).trim()) return inner;
  return html`<section${attrs({
    id: section.id,
    class: cx('section', `section--${section.type}`, meta.tone && `section--tone-${meta.tone}`),
    'data-section-type': section.type
  })}><div class="${cx('container', meta.width && `container--${meta.width}`)}">${inner}</div></section>`;
}
