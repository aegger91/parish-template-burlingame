/*
 * OrthodoxConnect (Get Involved). Sign-up needs an OrthodoxConnect account,
 * so the button hands the item to ParishSite.handlers.ocSignup({ itemId,
 * parishId, url }) once the app's sign-in is connected; without a handler
 * it opens the item on OrthodoxConnect. Links that open the app ("Create an
 * event", "Post a need", "Join") go to ParishSite.handlers.ocOpen when set.
 * With the sample feed both explain what will happen instead of leaving.
 */
function ocBox(el) { return el.closest('[data-oc-parish]'); }

function signUp(btn) {
  if (btn.getAttribute('aria-disabled') === 'true') return;
  var box = ocBox(btn);
  var card = btn.closest('[data-oc-id]');
  var status = card.querySelector('[data-form-status]');
  var handler = ParishSite.handlers.ocSignup;
  if (typeof handler !== 'function') {
    if (box.getAttribute('data-oc-sample') === 'true') setStatus(status, t('oc.signupSample'), 'info');
    else location.href = btn.href;
    return;
  }
  Promise.resolve(handler({ itemId: btn.getAttribute('data-oc-signup'), parishId: box.getAttribute('data-oc-parish'), url: btn.href })).then(
    function (r) {
      if (r && r.redirect) {
        location.href = r.redirect;
        return;
      }
      setStatus(status, t('oc.signupThanks'), 'ok');
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.add('is-disabled');
      var bar = card.querySelector('[data-oc-progress]');
      if (!bar) return;
      var cap = +bar.getAttribute('data-capacity');
      var n = Math.min(cap, +bar.getAttribute('data-signups') + 1);
      bar.setAttribute('data-signups', n);
      var meter = bar.querySelector('[role="progressbar"]');
      meter.setAttribute('aria-valuenow', n);
      meter.querySelector('span').style.width = Math.round((n / cap) * 100) + '%';
    },
    function () { setStatus(status, t('form.error'), 'error'); }
  );
}

document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-oc-signup]');
  if (btn) {
    e.preventDefault();
    signUp(btn);
    return;
  }
  var link = e.target.closest('[data-oc-deeplink]');
  var box = link && ocBox(link);
  if (!box) return;
  var open = ParishSite.handlers.ocOpen;
  if (typeof open === 'function') {
    e.preventDefault();
    open({ action: link.getAttribute('data-oc-deeplink'), parishId: box.getAttribute('data-oc-parish'), url: link.href });
  } else if (box.getAttribute('data-oc-sample') === 'true') {
    e.preventDefault();
    if (ParishSite.toast) ParishSite.toast(t('oc.deepLinkSample'));
  }
});
