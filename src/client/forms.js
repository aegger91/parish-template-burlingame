/*
 * Forms: donation, contact, newsletter and service requests. Each one goes
 * through submitTo (core.js): ParishSite.handlers.<name>, else a POST to the
 * form's data-endpoint, else a sample message (nothing is sent).
 */

function done(form, result, okKey) {
  setStatus(form.querySelector('[data-form-status]'), result.sample ? t('form.sample') : t(okKey), result.sample ? 'info' : 'ok');
}
function failed(form) {
  setStatus(form.querySelector('[data-form-status]'), t('form.error'), 'error');
}

/* ---- donation */
$all('form[data-form="donate"]').forEach(function (form) {
  var other = form.querySelector('[data-other-amount]');
  var otherInput = other && other.querySelector('input');
  var label = form.querySelector('[data-donate-label]');
  var hint = form.querySelector('[data-fund-hint]');
  var hints = readJson(form.querySelector('[data-fund-hints]')) || {};
  var frequency = function () { return (form.querySelector('[name="frequency"]:checked') || {}).value || 'once'; };
  var amount = function () {
    var picked = form.querySelector('[name="amount-' + frequency() + '"]:checked');
    if (!picked) return 0;
    return picked.value === 'other' ? parseFloat(otherInput.value) || 0 : +picked.value;
  };
  var update = function () {
    var f = frequency();
    $all('[data-amounts]', form).forEach(function (g) { g.hidden = g.getAttribute('data-amounts') !== f; });
    var picked = form.querySelector('[name="amount-' + f + '"]:checked');
    if (other) other.hidden = !(picked && picked.value === 'other');
    var a = amount();
    if (label) label.textContent = a ? t(f === 'monthly' ? 'donate.giveMonthly' : 'donate.giveAmount', { amount: money(a) }) : t('donate.give');
  };
  form.addEventListener('change', function (e) {
    if (e.target.name === 'fund' && hint) hint.textContent = hints[e.target.value] || '';
    update();
  });
  form.addEventListener('input', update);
  update();
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(form)) return;
    var v = formValues(form);
    var gift = { frequency: frequency(), amount: amount(), currency: CURRENCY, fund: v.fund, name: v.name, email: v.email };
    // No minimum: zero and any positive amount are accepted.
    if (!(gift.amount >= 0) || Number.isNaN(gift.amount)) {
      if (otherInput) otherInput.focus();
      return;
    }
    submitTo('donate', gift, form.getAttribute('data-endpoint')).then(function (r) { done(form, r, 'donate.thanks'); }, function () { failed(form); });
  });
});

/* ---- contact and newsletter */
$all('form[data-form="contact"], form[data-form="newsletter"]').forEach(function (form) {
  var kind = form.getAttribute('data-form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(form)) return;
    var v = formValues(form);
    if (kind === 'newsletter') v.list = form.getAttribute('data-list') || '';
    submitTo(kind, v, form.getAttribute('data-endpoint')).then(function (r) {
      done(form, r, kind === 'newsletter' ? 'newsletter.thanks' : 'form.thanks');
      if (!r.sample) form.reset();
    }, function () { failed(form); });
  });
});

/* ---- service requests (one dialog per request section) */
$all('[data-requests]').forEach(function (box) {
  var dialog = box.querySelector('[data-request-dialog]');
  var form = dialog && dialog.querySelector('form');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var opener = null;
  $all('[data-request]', box).forEach(function (btn) {
    btn.hidden = false;
    btn.addEventListener('click', function () {
      opener = btn;
      form.reset();
      setStatus(form.querySelector('[data-form-status]'), '');
      dialog.querySelector('[data-request-heading]').textContent = btn.getAttribute('data-request-title');
      dialog.querySelector('[data-request-service]').value = btn.getAttribute('data-request');
      var askDate = btn.getAttribute('data-ask-date') !== 'false';
      $all('[data-date-field]', form).forEach(function (f) { f.hidden = !askDate; });
      var date = form.querySelector('[name="date"]');
      if (date) date.min = TODAY;
      dialog.showModal();
      doc.body.classList.add('is-locked');
      form.querySelector('input:not([type="hidden"])').focus();
    });
  });
  var close = function () { dialog.close(); };
  $all('[data-modal-close]', dialog).forEach(function (b) { b.addEventListener('click', close); });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) close();
  });
  dialog.addEventListener('close', function () {
    doc.body.classList.remove('is-locked');
    if (opener) opener.focus();
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(form)) return;
    var v = formValues(form);
    v.serviceTitle = dialog.querySelector('[data-request-heading]').textContent;
    submitTo('serviceRequest', v, box.getAttribute('data-endpoint')).then(function (r) { done(form, r, 'requests.thanks'); }, function () { failed(form); });
  });
});
