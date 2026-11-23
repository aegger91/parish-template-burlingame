/*
 * Filters for any [data-filter-root]: category buttons ([data-filter],
 * matched against data-category) and menus ([data-filter-key="speaker"],
 * matched against data-speaker). Used by the gallery, news, sermons, store
 * and the OrthodoxConnect lists.
 */
$all('[data-filter-root]').forEach(function (rootEl) {
  var items = $all('[data-filter-item]', rootEl);
  var chips = $all('[data-filter]', rootEl);
  var selects = $all('[data-filter-key]', rootEl);
  var empty = rootEl.querySelector('[data-filter-empty]');
  if (!chips.length && !selects.length) return;
  var state = { category: '' };

  function apply() {
    var shown = 0;
    items.forEach(function (item) {
      var ok = Object.keys(state).every(function (k) {
        return !state[k] || item.getAttribute('data-' + k) === state[k];
      });
      item.hidden = !ok;
      if (ok) shown += 1;
    });
    if (empty) empty.hidden = shown > 0;
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.category = chip.getAttribute('data-filter');
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      apply();
    });
  });
  selects.forEach(function (sel) {
    sel.addEventListener('change', function () {
      state[sel.getAttribute('data-filter-key')] = sel.value;
      apply();
    });
  });
  $all('[data-filter-bar]', rootEl).forEach(function (b) { b.hidden = false; });
});
