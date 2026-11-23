/*
 * Live badge: on during a streamed service, from livestream.leadMinutes
 * before it starts until it ends (start + duration), in the parish's
 * timezone. livestream.statusUrl, when set, can answer { "live": true }
 * to override the schedule. Add ?live=1 to any URL to preview the badge.
 */
var live = SITE.livestream;
if (live) {
  var preview = /[?&]live=1\b/.test(location.search);
  var streamed = (SITE.services || []).filter(function (e) { return e.stream && e.t && !e.none; });

  var windowNow = function () {
    var now = Date.now();
    for (var i = 0; i < streamed.length; i++) {
      var e = streamed[i];
      if (e.d < addDays(TODAY, -1) || e.d > addDays(TODAY, 1)) continue;
      var start = zonedToEpoch(e.d, e.t, TZ);
      if (now >= start - live.lead * 60000 && now <= start + e.dur * 60000) return e;
    }
    return null;
  };

  var nextStream = function () {
    var now = Date.now();
    for (var i = 0; i < streamed.length; i++) {
      var e = streamed[i];
      if (e.d >= TODAY && zonedToEpoch(e.d, e.t, TZ) > now) return e;
    }
    return null;
  };

  var apply = function (on, current) {
    $all('[data-live-badge]').forEach(function (b) { b.hidden = !on; });
    $all('[data-live-indicator]').forEach(function (b) { b.hidden = !on; });
    root.classList.toggle('is-live', on);
    var next = nextStream();
    $all('[data-live-next]').forEach(function (n) {
      if (on && current) n.textContent = current.title;
      else if (next) n.textContent = t('live.next', { when: fmtDate(next.d, 'short') + ', ' + fmtTime(next.t), what: next.title });
      else n.textContent = '';
    });
  };

  var check = function () {
    var current = windowNow();
    if (preview) return apply(true, current || streamed[0]);
    if (!live.statusUrl) return apply(!!current, current);
    fetch(live.statusUrl, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) { apply(!!s.live, current); })
      .catch(function () { apply(!!current, current); });
  };
  check();
  setInterval(check, 60000);
}

/* Live player facade: the embed loads only after the visitor presses play. */
$all('[data-live-frame]').forEach(function (frame) {
  var btn = frame.querySelector('[data-live-play]');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var iframe = doc.createElement('iframe');
    var src = frame.getAttribute('data-embed');
    iframe.src = src + (src.indexOf('?') > -1 ? '&' : '?') + 'autoplay=1';
    iframe.title = t('live.player');
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    frame.appendChild(iframe);
    frame.classList.add('is-playing');
    iframe.focus();
  });
});
