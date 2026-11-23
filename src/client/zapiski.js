/*
 * Commemoration notes ([data-zapiski]): add and remove slips and names,
 * switch a slip between health and repose, total the suggested donations,
 * then put the slips in the cart (cart.js) or go straight to checkout.
 */
$all('[data-zapiski]').forEach(function (box) {
  var form = box.querySelector('[data-zapiski-form]');
  var slips = box.querySelector('[data-slips]');
  var tpl = box.querySelector('[data-slip-template]');
  var strings = readJson(box.querySelector('[data-zapiski-strings]')) || {};
  var donation = box.querySelector('[data-zapiski-donation]');
  var status = box.querySelector('[data-form-status]');
  var cartUrl = box.getAttribute('data-cart-url');
  form.hidden = false;

  var allSlips = function () { return $all('[data-slip]', slips); };
  var field = function (slip, name) { return slip.querySelector('[data-field="' + name + '"]:checked') || slip.querySelector('select[data-field="' + name + '"], input[type="number"][data-field="' + name + '"]'); };
  var amountOf = function (el) {
    if (!el) return 0;
    var opt = el.tagName === 'SELECT' ? el.options[el.selectedIndex] : el;
    return +(opt.getAttribute('data-amount') || 0);
  };

  function slipTotal(slip) {
    var comm = amountOf(field(slip, 'commemoration'));
    var candle = slip.querySelector('[data-field="candle"]');
    var qty = slip.querySelector('[data-field="candleQty"]');
    var candleCost = candle && candle.value ? amountOf(candle) * Math.max(1, +qty.value || 1) : 0;
    return comm + candleCost;
  }

  function renumber() {
    allSlips().forEach(function (slip, n) {
      slip.querySelector('[data-slip-label]').textContent = t('zapiski.slip', { n: n + 1 });
      $all('input[type="radio"]', slip).forEach(function (r) {
        r.name = r.name.replace(/^slip-\d+-/, 'slip-' + n + '-');
      });
      $all('[id^="slip-"]', slip).forEach(function (el) {
        var old = el.id;
        el.id = old.replace(/^slip-\d+-/, 'slip-' + n + '-');
        var label = slip.querySelector('label[for="' + old + '"]');
        if (label) label.htmlFor = el.id;
      });
      $all('[data-name-row]', slip).forEach(function (row, i) {
        ['prefix', 'name'].forEach(function (k) {
          var input = row.querySelector('[data-field="' + k + '"]');
          var label = row.querySelector('[data-for="' + k + '"]');
          input.id = 'slip-' + n + '-' + k + '-' + i;
          label.htmlFor = input.id;
        });
        row.querySelector('.slip__num').textContent = i + 1 + '.';
      });
      var rows = $all('[data-name-row]', slip).length;
      var max = +slip.querySelector('[data-names]').getAttribute('data-max');
      slip.querySelector('[data-name-count]').textContent = t('zapiski.nameCount', { n: rows, max: max });
      slip.querySelector('[data-add-name]').disabled = rows >= max;
      slip.querySelector('[data-remove-slip]').hidden = allSlips().length < 2;
    });
  }

  function applyType(slip) {
    var type = (slip.querySelector('[data-field="type"]:checked') || {}).value;
    slip.setAttribute('data-type', type);
    slip.className = slip.className.replace(/\bslip--(health|repose)\b/g, '').trim() + ' slip--' + type;
    $all('[data-heading]', slip).forEach(function (h) { h.hidden = h.getAttribute('data-heading') !== type; });
    var first = null;
    $all('[data-for-types]', slip).forEach(function (opt) {
      var ok = opt.getAttribute('data-for-types').split(' ').indexOf(type) > -1;
      opt.hidden = !ok;
      var input = opt.querySelector('input');
      input.disabled = !ok;
      if (ok && !first) first = input;
      if (!ok && input.checked) input.checked = false;
    });
    if (!slip.querySelector('[data-field="commemoration"]:checked') && first) first.checked = true;
  }

  function update() {
    var total = 0;
    var list = allSlips();
    list.forEach(function (slip) {
      var sub = slipTotal(slip);
      slip.querySelector('[data-slip-total]').textContent = money(sub);
      total += sub;
    });
    total += Math.max(0, parseFloat(donation && donation.value) || 0);
    box.querySelector('[data-zapiski-total]').textContent = money(total);
    box.querySelector('[data-zapiski-count]').textContent = String(list.length);
  }

  slips.addEventListener('change', function (e) {
    var slip = e.target.closest('[data-slip]');
    if (e.target.matches('[data-field="type"]')) applyType(slip);
    update();
  });
  form.addEventListener('input', update);

  slips.addEventListener('click', function (e) {
    var slip = e.target.closest('[data-slip]');
    if (!slip) return;
    if (e.target.closest('[data-add-name]')) {
      var list = slip.querySelector('[data-names]');
      var row = list.querySelector('[data-name-row]').cloneNode(true);
      row.querySelector('[data-field="name"]').value = '';
      row.querySelector('[data-field="prefix"]').value = '';
      list.appendChild(row);
      renumber();
      row.querySelector('[data-field="name"]').focus();
    } else if (e.target.closest('[data-remove-name]')) {
      var r = e.target.closest('[data-name-row]');
      var rows = $all('[data-name-row]', slip);
      if (rows.length === 1) {
        r.querySelector('[data-field="name"]').value = '';
        r.querySelector('[data-field="prefix"]').value = '';
        r.querySelector('[data-field="name"]').focus();
      } else {
        var next = r.nextElementSibling || r.previousElementSibling;
        r.remove();
        renumber();
        next.querySelector('[data-field="name"]').focus();
      }
      update();
    } else if (e.target.closest('[data-remove-slip]')) {
      var prev = slip.previousElementSibling || slip.nextElementSibling;
      slip.remove();
      renumber();
      update();
      if (prev) prev.querySelector('[data-field="type"]:checked').focus();
    }
  });

  box.querySelector('[data-add-slip]').addEventListener('click', function () {
    var fresh = tpl.content.firstElementChild.cloneNode(true);
    slips.appendChild(fresh);
    renumber();
    applyType(fresh);
    update();
    fresh.querySelector('[data-field="name"]').focus();
    fresh.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function reset() {
    allSlips().slice(1).forEach(function (s) { s.remove(); });
    var first = allSlips()[0];
    $all('[data-name-row]', first).slice(1).forEach(function (r) { r.remove(); });
    form.reset();
    applyType(first);
    renumber();
    update();
  }

  var lastAction = 'cart';
  $all('[data-zapiski-action]', box).forEach(function (b) {
    b.addEventListener('click', function () { lastAction = b.getAttribute('data-zapiski-action'); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus(status, '');
    var items = [];
    var problem = null;
    allSlips().forEach(function (slip) {
      var names = $all('[data-name-row]', slip)
        .map(function (row) {
          return { prefix: row.querySelector('[data-field="prefix"]').value, name: row.querySelector('[data-field="name"]').value.trim() };
        })
        .filter(function (n) { return n.name; });
      if (!names.length) {
        problem = problem || slip.querySelector('[data-field="name"]');
        return;
      }
      var type = slip.getAttribute('data-type');
      var comm = field(slip, 'commemoration');
      var commId = comm ? comm.value : '';
      items.push({
        kind: 'zapiska',
        id: type + ':' + commId,
        title: strings.types[type] + ': ' + strings.commemorations[commId],
        detail: names.map(function (n) { return (n.prefix ? strings.prefixes[n.prefix] + ' ' : '') + n.name; }).join(', '),
        price: amountOf(comm),
        slip: { type: type, commemoration: commId, names: names }
      });
      var candle = slip.querySelector('[data-field="candle"]');
      if (candle && candle.value) {
        var qty = Math.max(1, +slip.querySelector('[data-field="candleQty"]').value || 1);
        items.push({ kind: 'candle', id: candle.value, title: strings.candle, detail: qty + ' \u00d7 ' + strings.candles[candle.value], price: amountOf(candle) * qty });
      }
    });
    if (problem) {
      setStatus(status, t('zapiski.needName'), 'error');
      problem.focus();
      return;
    }
    var consent = box.querySelector('[data-zapiski-consent]');
    if (!consent.checked) {
      consent.closest('.consent').classList.add('field--invalid');
      setStatus(status, t('zapiski.needConsent'), 'error');
      consent.focus();
      return;
    }
    consent.closest('.consent').classList.remove('field--invalid');
    var gift = Math.max(0, parseFloat(donation && donation.value) || 0);
    if (gift) items.push({ kind: 'donation', id: 'zapiski', title: strings.donation, detail: '', price: gift });
    items.forEach(function (item) { ParishSite.cart.add(item, 1); });
    var n = items.filter(function (i) { return i.kind === 'zapiska'; }).length;
    reset();
    if (lastAction === 'checkout' && cartUrl) location.href = cartUrl;
    else {
      setStatus(status, t('zapiski.added', { n: n }), 'ok');
      if (ParishSite.toast) ParishSite.toast(t('zapiski.added', { n: n }));
    }
  });

  allSlips().forEach(applyType);
  renumber();
  update();
});
