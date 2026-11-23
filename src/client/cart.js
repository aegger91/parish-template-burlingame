/*
 * Cart (localStorage "parish-cart"), shared by the store and commemoration
 * notes. ParishSite.cart exposes add / remove / setQty / clear / items so a
 * parish integration can read it; "cart:change" fires on every change.
 * Checkout hands the order to ParishSite.handlers.checkout (placeholder:
 * connect Stripe Checkout, Authorize.net Accept Hosted, or similar there).
 */
var KEY = 'parish-cart';

function load() {
  var c = store(KEY);
  return c && c.items ? c : { items: [] };
}
function save(c) {
  store(KEY, c);
  doc.dispatchEvent(new CustomEvent('cart:change', { detail: c }));
}
function keyOf(item) {
  return item.key || [item.kind, item.id, item.variant || ''].join(':');
}

var cart = {
  items: function () { return load().items; },
  add: function (item, qty) {
    var c = load();
    var key = keyOf(item);
    var found = c.items.filter(function (i) { return i.key === key; })[0];
    if (found && item.kind === 'product') {
      found.qty = Math.min(found.qty + (qty || 1), item.max || 99);
    } else {
      var copy = Object.assign({}, item, { key: item.kind === 'product' ? key : key + ':' + Date.now(), qty: qty || 1 });
      c.items.push(copy);
    }
    save(c);
  },
  setQty: function (key, qty) {
    var c = load();
    c.items.forEach(function (i) {
      if (i.key === key) i.qty = Math.max(1, Math.min(qty, i.max || 99));
    });
    save(c);
  },
  remove: function (key) {
    var c = load();
    c.items = c.items.filter(function (i) { return i.key !== key; });
    save(c);
  },
  clear: function () { save({ items: [] }); },
  subtotal: function () {
    return load().items.reduce(function (n, i) { return n + i.price * i.qty; }, 0);
  }
};
ParishSite.cart = cart;

/* ---- header count */
function syncCount() {
  var n = cart.items().reduce(function (s, i) { return s + i.qty; }, 0);
  $all('[data-cart-count]').forEach(function (b) {
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
  });
  $all('[data-cart-link]').forEach(function (a) {
    a.setAttribute('aria-label', t('cart.withCount', { n: n }));
  });
}
doc.addEventListener('cart:change', syncCount);
window.addEventListener('storage', function (e) {
  if (e.key === KEY) syncCount();
});
syncCount();

/* ---- toast after adding */
var toast = null;
var toastTimer = null;
function showToast(text) {
  var cartLink = doc.querySelector('[data-cart-link]');
  if (!toast) {
    toast = doc.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    doc.body.appendChild(toast);
  }
  toast.innerHTML = '';
  var p = doc.createElement('span');
  p.textContent = text;
  toast.appendChild(p);
  var href = cartLink ? cartLink.href : null;
  if (href) {
    var a = doc.createElement('a');
    a.href = href;
    a.className = 'toast__link';
    a.textContent = t('cart.view');
    toast.appendChild(a);
  }
  toast.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('is-shown'); }, 4000);
}
ParishSite.toast = showToast;

doc.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-add-to-cart]');
  if (!btn) return;
  var item = JSON.parse(btn.getAttribute('data-add-to-cart'));
  cart.add(item, 1);
  showToast(t('cart.added', { title: item.title }));
});

/* ---- quantity steppers */
doc.addEventListener('click', function (e) {
  var step = e.target.closest('[data-qty-step]');
  if (!step) return;
  var input = step.closest('[data-qty]').querySelector('input');
  var max = +input.max || 99;
  input.value = Math.max(+input.min || 1, Math.min(max, (+input.value || 1) + +step.getAttribute('data-qty-step')));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

/* ---- product page */
$all('[data-product-form]').forEach(function (form) {
  var items = readJson(form.querySelector('[data-product-items]')) || [];
  var priceEl = doc.querySelector('[data-product-price]');
  var qty = form.querySelector('[name="qty"]');
  var add = form.querySelector('[type="submit"]');
  var stockEl = form.querySelector('[data-product-stock]');
  var pick = function () {
    var v = form.querySelector('[name="variant"]:checked');
    return v ? items[+v.getAttribute('data-index')] : items[0];
  };
  var update = function () {
    var item = pick();
    if (!item) return;
    priceEl.textContent = money(item.price);
    qty.max = item.max == null ? 99 : item.max;
    if (+qty.value > +qty.max) qty.value = qty.max;
    add.disabled = item.max === 0;
    if (stockEl && item.max != null) {
      stockEl.innerHTML = '';
      var s = doc.createElement('span');
      s.className = 'stock ' + (item.max <= 0 ? 'stock--out' : item.max <= 3 ? 'stock--low' : 'stock--in');
      s.textContent = item.max <= 0 ? t('store.soldOut') : item.max <= 3 ? t('store.fewLeft', { n: item.max }) : t('store.inStock');
      stockEl.appendChild(s);
    }
  };
  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var item = pick();
    if (!item || item.max === 0) return;
    cart.add(item, Math.max(1, +qty.value || 1));
    showToast(t('cart.added', { title: item.title + (item.detail ? ' (' + item.detail + ')' : '') }));
  });
  update();
});
$all('[data-product-thumb]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var main = doc.querySelector('.product__img');
    main.src = btn.getAttribute('data-product-thumb');
    main.alt = btn.getAttribute('data-alt');
    main.removeAttribute('srcset');
    $all('[data-product-thumb]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
  });
});

/* ---- cart and checkout page */
$all('[data-cart]').forEach(function (box) {
  var list = box.querySelector('[data-cart-items]');
  var tpl = box.querySelector('[data-cart-row]');
  var empty = box.querySelector('[data-cart-empty]');
  var form = box.querySelector('[data-checkout]');
  var config = readJson(box.querySelector('[data-cart-config]')) || {};
  var shipFields = box.querySelector('[data-ship-fields]');
  var shipOption = box.querySelector('[data-ship-option]');
  var fulfillment = box.querySelector('[data-fulfillment]');
  var noShipHint = box.querySelector('[data-noship-hint]');

  var method = function () { return (form.querySelector('[name="fulfillment"]:checked') || {}).value || 'pickup'; };
  var shipping = function (items) {
    if (method() !== 'ship' || !config.ship) return 0;
    var goods = items.filter(function (i) { return i.kind === 'product'; }).reduce(function (n, i) { return n + i.price * i.qty; }, 0);
    if (!goods) return 0;
    return config.ship.freeOver != null && goods >= config.ship.freeOver ? 0 : config.ship.rate;
  };

  function render() {
    var items = cart.items();
    list.textContent = '';
    items.forEach(function (item) {
      var row = tpl.content.firstElementChild.cloneNode(true);
      row.setAttribute('data-key', item.key);
      var media = row.querySelector('[data-slot="media"]');
      if (item.image) {
        var img = doc.createElement('img');
        img.src = item.image;
        img.alt = '';
        img.width = 72;
        img.height = 72;
        media.appendChild(img);
      } else {
        media.classList.add('cart-row__media--slip');
        media.innerHTML = '<svg class="cart-row__slip" aria-hidden="true"><use href="#i-' + (item.kind === 'candle' ? 'candle' : 'slip') + '"></use></svg>';
      }
      var title = row.querySelector('[data-slot="title"]');
      title.textContent = item.title;
      if (item.url) title.href = item.url;
      else title.removeAttribute('href');
      row.querySelector('[data-slot="detail"]').textContent = item.detail || '';
      var q = row.querySelector('[data-slot="qty"]');
      q.value = item.qty;
      if (item.max != null) q.max = item.max;
      if (item.kind !== 'product') row.querySelector('[data-qty]').hidden = true;
      row.querySelector('[data-slot="price"]').textContent = money(item.price * item.qty);
      list.appendChild(row);
    });
    empty.hidden = items.length > 0;
    form.hidden = !items.length;
    var products = items.filter(function (i) { return i.kind === 'product'; });
    var canShip = products.length && products.every(function (i) { return i.ship !== false; });
    if (fulfillment) fulfillment.hidden = !products.length;
    if (shipOption) {
      shipOption.querySelector('input').disabled = !canShip;
      shipOption.classList.toggle('is-disabled', !canShip);
      if (!canShip && method() === 'ship') form.querySelector('[name="fulfillment"][value="pickup"]').checked = true;
    }
    if (noShipHint) noShipHint.hidden = !products.length || canShip;
    if (shipFields) {
      shipFields.hidden = method() !== 'ship' || !products.length;
      $all('input', shipFields).forEach(function (i) { i.required = !shipFields.hidden && i.name !== 'postal'; });
    }
    var sub = cart.subtotal();
    var ship = products.length ? shipping(items) : 0;
    form.querySelector('[data-total="subtotal"]').textContent = money(sub);
    var shipRow = form.querySelector('[data-total-row="shipping"]');
    shipRow.hidden = method() !== 'ship' || !products.length;
    form.querySelector('[data-total="shipping"]').textContent = ship ? money(ship) : t('cart.free');
    form.querySelector('[data-total="total"]').textContent = money(sub + ship);
  }

  list.addEventListener('change', function (e) {
    var row = e.target.closest('[data-key]');
    if (row && e.target.matches('[data-slot="qty"]')) cart.setQty(row.getAttribute('data-key'), +e.target.value || 1);
  });
  list.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-cart-remove]');
    if (!rm) return;
    var row = rm.closest('[data-key]');
    var next = row.nextElementSibling || row.previousElementSibling;
    cart.remove(row.getAttribute('data-key'));
    var focusTo = next && list.querySelector('[data-key="' + next.getAttribute('data-key') + '"] [data-cart-remove]');
    (focusTo || box.querySelector('[data-cart-empty] a') || doc.getElementById('main')).focus();
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'fulfillment') render();
  });
  doc.addEventListener('cart:change', render);
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) render();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(form)) return;
    var items = cart.items();
    var v = formValues(form);
    var ship = shipping(items);
    var order = {
      currency: CURRENCY,
      provider: box.getAttribute('data-provider') || null,
      items: items.map(function (i) {
        return { kind: i.kind, id: i.id, variant: i.variant, title: i.title, detail: i.detail, qty: i.qty, price: i.price, slip: i.slip };
      }),
      fulfillment: items.some(function (i) { return i.kind === 'product'; }) ? method() : 'none',
      customer: { name: v.name, email: v.email, phone: v.phone || '' },
      address: method() === 'ship' ? { street: v.address, city: v.city, postalCode: v.postal } : null,
      totals: { subtotal: cart.subtotal(), shipping: ship, total: cart.subtotal() + ship }
    };
    var status = form.querySelector('[data-form-status]');
    submitTo('checkout', order, box.getAttribute('data-endpoint')).then(function (r) {
      if (r.redirect) location.href = r.redirect;
      else if (r.sample) setStatus(status, t('checkout.sample'), 'info');
      else {
        cart.clear();
        setStatus(status, t('checkout.thanks'), 'ok');
      }
    }, function () { setStatus(status, t('form.error'), 'error'); });
  });

  render();
});
