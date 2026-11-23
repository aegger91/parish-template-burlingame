/**
 * Parish store (features.store), from content/store.json.
 *
 * store props: eyebrow, title, intro, categories (ids; default all),
 *   filters (category buttons, default true), featured (only featured items), limit, actions
 * product-detail props: product (product id). The build makes one page per
 *   product under the store page, so editors never write these by hand.
 * cart props: eyebrow, title, intro. The cart and checkout page, shared with
 *   commemoration notes (features.commemorations).
 *
 * The cart lives in the visitor's browser (localStorage). Checkout collects
 * the order and calls ParishSite.handlers.checkout(order) in site.js: a
 * placeholder to connect to the parish's processor (Stripe, Authorize.net).
 * Prices shown here are for display; the processor must price the order
 * again on the server.
 */
import { html, raw, cx } from '../lib/html.mjs';
import { sectionHead, actions, image, icon, cross } from './_primitives.mjs';

export const storeMeta = {
  type: 'store',
  title: 'Store: products',
  description: 'Product grid with category filters (icons, candles, books, prayer ropes, incense, crosses, gifts).',
  dataSources: ['store.json']
};
export const productMeta = {
  type: 'product-detail',
  title: 'Store: product page',
  description: 'One product with photos, options, stock and an Add to cart button. Generated for each product.',
  dataSources: ['store.json']
};
export const cartMeta = {
  type: 'cart',
  title: 'Cart and checkout',
  description: 'Cart, shipping or pickup at the church, contact details and the payment placeholder.',
  dataSources: ['store.json', 'zapiski.json']
};

const json = (value) => raw(JSON.stringify(value).replace(/</g, '\\u003c').replace(/'/g, '\\u0027'));

const productPath = (product, ctx) => ctx.pagePath(`product-${product.id}`);

function priceRange(product) {
  const prices = (product.variants || []).map((v) => v.price ?? product.price).filter((p) => p != null);
  if (!prices.length) return { min: product.price, max: product.price };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function stockOf(product) {
  if (product.variants?.length) {
    const known = product.variants.filter((v) => v.stock != null);
    return known.length === product.variants.length ? known.reduce((n, v) => n + v.stock, 0) : null;
  }
  return product.stock ?? null;
}

function stockBadge(stock, ctx, few = 3) {
  if (stock == null) return '';
  if (stock <= 0) return html`<span class="stock stock--out">${ctx.t('store.soldOut')}</span>`;
  if (stock <= few) return html`<span class="stock stock--low">${ctx.t('store.fewLeft', { n: stock })}</span>`;
  return html`<span class="stock stock--in">${icon('check', 'stock__icon')}${ctx.t('store.inStock')}</span>`;
}

export function cartItemFor(product, variant, ctx) {
  return {
    kind: 'product',
    id: product.id,
    variant: variant?.id || null,
    title: ctx.l(product.name),
    detail: variant ? ctx.l(variant.label) : '',
    price: variant?.price ?? product.price,
    image: product.images?.[0] ? ctx.asset(product.images[0].src) : null,
    url: productPath(product, ctx),
    max: (variant ? variant.stock : product.stock) ?? null,
    ship: product.shippable !== false
  };
}

function productCard(product, ctx) {
  const { min, max } = priceRange(product);
  const cat = ctx.content.index.productCategories[product.category];
  const stock = stockOf(product);
  const url = productPath(product, ctx);
  const quick = !product.variants?.length && stock !== 0;
  return html`<li class="card product-card" data-filter-item data-category="${product.category}">
    <a class="product-card__media" href="${url}" tabindex="-1" aria-hidden="true">${image(product.images?.[0], ctx, { className: 'product-card__img', sizes: '(min-width: 64em) 22vw, (min-width: 40em) 45vw, 100vw' })}</a>
    <div class="product-card__body">
      ${cat ? html`<p class="product-card__cat">${ctx.l(cat.label)}</p>` : ''}
      <h3 class="product-card__title"><a href="${url}">${ctx.l(product.name)}</a></h3>
      ${product.summary ? html`<p class="product-card__text">${ctx.l(product.summary)}</p>` : ''}
      <div class="product-card__foot">
        <p class="price">${min !== max ? ctx.t('store.from', { price: ctx.money(min) }) : ctx.money(min)}</p>
        ${stockBadge(stock, ctx)}
      </div>
      ${quick
        ? html`<button class="btn btn--primary btn--sm btn--block product-card__add" type="button" data-add-to-cart='${json(cartItemFor(product, null, ctx))}'>${icon('cart', 'btn__icon')}<span>${ctx.t('store.addToCart')}</span></button>`
        : html`<a class="btn btn--secondary btn--sm btn--block" href="${url}">${stock === 0 ? ctx.t('store.details') : ctx.t('store.chooseOptions')}</a>`}
    </div>
  </li>`;
}

export function renderStore(p, ctx) {
  const store = ctx.content.store;
  if (!store) return '';
  let products = store.products.filter((x) => x.published !== false && (!p.categories || p.categories.includes(x.category)) && (!p.featured || x.featured));
  if (p.limit) products = products.slice(0, p.limit);
  const cats = store.categories.filter((c) => products.some((x) => x.category === c.id));
  return html`<div class="store" data-filter-root>
    ${sectionHead(p, ctx)}
    ${p.filters !== false && cats.length > 1
      ? html`<div class="filter-bar" role="group" aria-label="${ctx.t('filter.label')}" data-filter-bar hidden>
          <button class="chip" type="button" data-filter="" aria-pressed="true">${ctx.t('filter.all')}</button>
          ${cats.map((c) => html`<button class="chip" type="button" data-filter="${c.id}" aria-pressed="false">${ctx.l(c.label)}</button>`)}
        </div>`
      : ''}
    <ul class="card-grid card-grid--4 product-grid">${products.map((x) => productCard(x, ctx))}</ul>
    <p class="filter-empty" data-filter-empty hidden>${ctx.t('filter.none')}</p>
    ${fulfillmentNote(ctx)}
    ${actions(p.actions, ctx, { className: 'section-actions' })}
  </div>`;
}

function fulfillmentNote(ctx) {
  const f = ctx.content.store?.fulfillment || {};
  const parts = [];
  if (f.pickup?.enabled !== false) parts.push(html`<li>${icon('church', 'store-note__icon')}<span>${ctx.l(f.pickup?.note) || ctx.t('store.pickupNote')}</span></li>`);
  if (f.ship?.enabled) parts.push(html`<li>${icon('cart', 'store-note__icon')}<span>${ctx.l(f.ship.note) || ctx.t('store.shipNote')}</span></li>`);
  return parts.length ? html`<ul class="store-note">${parts}</ul>` : '';
}

export function renderProduct(p, ctx) {
  const product = ctx.content.index.products[p.product];
  if (!product) throw new Error(`Unknown product "${p.product}"`);
  const cat = ctx.content.index.productCategories[product.category];
  const storePage = ctx.content.index.pages[ctx.page.parent];
  const variants = product.variants || [];
  const first = variants.find((v) => v.stock !== 0) || variants[0];
  const stock = first ? first.stock ?? null : product.stock ?? null;
  const images = product.images || [];
  const items = variants.length ? variants.map((v) => cartItemFor(product, v, ctx)) : [cartItemFor(product, null, ctx)];
  return html`<div class="product" data-product>
    <nav class="breadcrumbs" aria-label="${ctx.t('a11y.breadcrumbs')}">
      <ol>${storePage ? html`<li><a href="${ctx.pagePath(storePage.id)}">${ctx.pageTitle(storePage)}</a></li>` : ''}${cat ? html`<li><span>${ctx.l(cat.label)}</span></li>` : ''}</ol>
    </nav>
    <div class="product__layout">
      <div class="product__gallery">
        <div class="product__main">${image(images[0], ctx, { className: 'product__img', priority: true, sizes: '(min-width: 56em) 50vw, 100vw' })}</div>
        ${images.length > 1
          ? html`<ul class="product__thumbs">${images.map(
              (img, i) => html`<li><button class="product__thumb" type="button" data-product-thumb="${ctx.asset(img.src)}" data-alt="${ctx.l(img.alt)}" aria-pressed="${i === 0}">${image(img, ctx, { className: 'product__thumb-img' })}<span class="visually-hidden">${ctx.t('store.photo', { n: i + 1 })}</span></button></li>`
            )}</ul>`
          : ''}
      </div>
      <div class="product__info">
        ${cat ? html`<p class="eyebrow">${cross('eyebrow__cross')}<span>${ctx.l(cat.label)}</span></p>` : ''}
        <h1 class="product__title">${ctx.l(product.name)}</h1>
        <p class="price price--lg" data-product-price>${ctx.money(first?.price ?? product.price)}</p>
        ${product.summary ? html`<p class="product__summary">${ctx.l(product.summary)}</p>` : ''}
        <form class="product__form" data-product-form novalidate>
          <script type="application/json" data-product-items>${json(items)}</script>
          ${variants.length
            ? html`<fieldset class="choice-group">
                <legend class="field__label">${ctx.l(product.variantLabel) || ctx.t('store.option')}</legend>
                <div class="choice-group__options">
                  ${variants.map(
                    (v, i) => html`<label class="choice${v.stock === 0 ? ' is-disabled' : ''}"><input type="radio" name="variant" value="${v.id}"${v === first ? ' checked' : ''}${v.stock === 0 ? ' disabled' : ''} data-index="${i}"><span class="choice__label">${ctx.l(v.label)}${v.price != null && v.price !== product.price ? html` <span class="choice__price">${ctx.money(v.price)}</span>` : ''}</span></label>`
                  )}
                </div>
              </fieldset>`
            : ''}
          <div class="product__buy">
            <div class="qty" data-qty>
              <button class="qty__btn" type="button" data-qty-step="-1">${icon('minus', 'qty__icon')}<span class="visually-hidden">${ctx.t('cart.less')}</span></button>
              <label class="visually-hidden" for="qty-${product.id}">${ctx.t('cart.quantity')}</label>
              <input class="qty__input" id="qty-${product.id}" name="qty" type="number" inputmode="numeric" min="1" max="${stock ?? 99}" value="1">
              <button class="qty__btn" type="button" data-qty-step="1">${icon('plus', 'qty__icon')}<span class="visually-hidden">${ctx.t('cart.more')}</span></button>
            </div>
            <button class="btn btn--accent product__add" type="submit"${stock === 0 ? ' disabled' : ''}>${icon('cart', 'btn__icon')}<span>${ctx.t('store.addToCart')}</span></button>
          </div>
          <p class="product__stock" data-product-stock>${stockBadge(stock, ctx)}</p>
          <p class="form-status" role="status" aria-live="polite" data-form-status hidden></p>
        </form>
        ${product.description ? html`<div class="prose product__desc">${ctx.md(product.description)}</div>` : ''}
        ${fulfillmentNote(ctx)}
      </div>
    </div>
  </div>`;
}

function field(name, label, ctx, { type = 'text', autocomplete, required = false, full = false, attrs: extra = '' } = {}) {
  const id = `co-${name}`;
  return html`<div class="${cx('field', full && 'field--full')}">
    <label class="field__label" for="${id}">${label}${required ? '' : html` <span class="field__optional">${ctx.t('form.optional')}</span>`}</label>
    <input class="field__input" id="${id}" name="${name}" type="${type}"${autocomplete ? html` autocomplete="${autocomplete}"` : ''}${required ? ' required' : ''}${raw(extra)}>
  </div>`;
}

export function phoneField(id, ctx, { required = false, name = 'phone' } = {}) {
  return html`<div class="field">
    <label class="field__label" for="${id}">${ctx.t('form.phone')}${required ? '' : html` <span class="field__optional">${ctx.t('form.optional')}</span>`}</label>
    <input class="field__input" id="${id}" name="${name}" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(000)-000-0000" pattern="\\(\\d{3}\\)-\\d{3}-\\d{4}" maxlength="14" data-phone-mask aria-describedby="${id}-hint"${required ? ' required' : ''}>
    <p class="field__hint" id="${id}-hint">${ctx.t('form.phoneHint')}</p>
  </div>`;
}

export function renderCart(p, ctx) {
  const store = ctx.content.store || {};
  const f = store.fulfillment || {};
  const ship = f.ship?.enabled ? f.ship : null;
  const pickupOn = f.pickup?.enabled !== false;
  const provider = store.checkout?.provider || ctx.site.payments?.provider || null;
  const config = { ship: ship ? { rate: ship.flatRate ?? 0, freeOver: ship.freeOver ?? null } : null, pickup: pickupOn };
  return html`<div class="cart" data-cart data-provider="${provider || ''}" data-endpoint="${store.checkout?.endpoint || ''}">
    ${sectionHead(p, ctx)}
    <script type="application/json" data-cart-config>${json(config)}</script>
    <div class="cart__layout">
      <div class="cart__main">
        <ul class="cart__items" data-cart-items aria-live="polite"></ul>
        <template data-cart-row>
          <li class="cart-row">
            <span class="cart-row__media" data-slot="media"></span>
            <div class="cart-row__body"><p class="cart-row__title"><a data-slot="title"></a></p><p class="cart-row__detail" data-slot="detail"></p></div>
            <div class="qty qty--sm" data-qty>
              <button class="qty__btn" type="button" data-qty-step="-1">${icon('minus', 'qty__icon')}<span class="visually-hidden">${ctx.t('cart.less')}</span></button>
              <input class="qty__input" type="number" inputmode="numeric" min="1" value="1" aria-label="${ctx.t('cart.quantity')}" data-slot="qty">
              <button class="qty__btn" type="button" data-qty-step="1">${icon('plus', 'qty__icon')}<span class="visually-hidden">${ctx.t('cart.more')}</span></button>
            </div>
            <p class="cart-row__price" data-slot="price"></p>
            <button class="icon-btn cart-row__remove" type="button" data-cart-remove>${icon('trash', 'icon-btn__icon')}<span class="visually-hidden">${ctx.t('cart.remove')}</span></button>
          </li>
        </template>
        <div class="cart__empty" data-cart-empty>
          ${cross('cart__empty-cross')}
          <p>${ctx.t('cart.empty')}</p>
          <div class="actions">
            ${ctx.content.pages.find((x) => x.requires === 'store') ? html`<a class="btn btn--primary" href="${ctx.pagePath(ctx.content.pages.find((x) => x.requires === 'store').id)}">${ctx.t('cart.toStore')}</a>` : ''}
            ${ctx.content.pages.find((x) => x.requires === 'zapiski') ? html`<a class="btn btn--secondary" href="${ctx.pagePath(ctx.content.pages.find((x) => x.requires === 'zapiski').id)}">${ctx.t('cart.toZapiski')}</a>` : ''}
          </div>
        </div>
      </div>
      <form class="cart__checkout card" data-checkout novalidate hidden>
        <h2 class="cart__heading">${ctx.t('checkout.title')}</h2>
        ${ship || pickupOn
          ? html`<fieldset class="choice-group" data-fulfillment>
              <legend class="field__label">${ctx.t('checkout.fulfillment')}</legend>
              <div class="choice-group__options choice-group__options--stack">
                ${pickupOn ? html`<label class="choice choice--card"><input type="radio" name="fulfillment" value="pickup" checked><span class="choice__label"><strong>${ctx.t('checkout.pickup')}</strong><span class="choice__hint">${ctx.l(f.pickup?.note) || ctx.t('store.pickupNote')}</span></span></label>` : ''}
                ${ship ? html`<label class="choice choice--card" data-ship-option><input type="radio" name="fulfillment" value="ship"${pickupOn ? '' : ' checked'}><span class="choice__label"><strong>${ctx.t('checkout.ship')}</strong><span class="choice__hint">${ctx.l(ship.note) || ctx.t('store.shipNote')}</span></span></label>` : ''}
              </div>
              <p class="field__hint" data-noship-hint hidden>${ctx.t('checkout.noShipHint')}</p>
            </fieldset>`
          : ''}
        <div class="form-grid">
          ${field('name', ctx.t('form.name'), ctx, { autocomplete: 'name', required: true, full: true })}
          ${field('email', ctx.t('form.email'), ctx, { type: 'email', autocomplete: 'email', required: true })}
          ${phoneField('co-phone', ctx)}
        </div>
        ${ship
          ? html`<div class="form-grid" data-ship-fields hidden>
              ${field('address', ctx.t('checkout.address'), ctx, { autocomplete: 'street-address', full: true })}
              ${field('city', ctx.t('checkout.city'), ctx, { autocomplete: 'address-level2' })}
              ${field('postal', ctx.t('checkout.postal'), ctx, { autocomplete: 'postal-code' })}
            </div>`
          : ''}
        <dl class="cart__totals">
          <div><dt>${ctx.t('cart.subtotal')}</dt><dd data-total="subtotal"></dd></div>
          <div data-total-row="shipping" hidden><dt>${ctx.t('cart.shipping')}</dt><dd data-total="shipping"></dd></div>
          <div class="cart__grand"><dt>${ctx.t('cart.total')}</dt><dd data-total="total"></dd></div>
        </dl>
        <button class="btn btn--accent btn--block" type="submit">${ctx.t('checkout.pay')}</button>
        <p class="cart__provider">${ctx.t('checkout.providerNote')}</p>
        <p class="form-status" role="status" aria-live="polite" data-form-status hidden></p>
      </form>
    </div>
  </div>`;
}
