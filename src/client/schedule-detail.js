/*
 * Clickable schedule / event rows open a detail dialog with Add to calendar
 * (.ics download + Google Calendar), Get directions, and livestream when live.
 * Rows are marked [data-event] (service lists, hero next services, week/month).
 */

var dialog = doc.querySelector('[data-schedule-dialog]');
if (!dialog || typeof dialog.showModal !== 'function') return;

var titleEl = dialog.querySelector('[data-sd-title]');
var whenEl = dialog.querySelector('[data-sd-when]');
var whereEl = dialog.querySelector('[data-sd-where]');
var noteEl = dialog.querySelector('[data-sd-note]');
var icsBtn = dialog.querySelector('[data-sd-ics]');
var gcalLink = dialog.querySelector('[data-sd-gcal]');
var dirLink = dialog.querySelector('[data-sd-directions]');
var liveLink = dialog.querySelector('[data-sd-live]');
var opener = null;
var release = null;

function pad(n) { return (n < 10 ? '0' : '') + n; }

function utcStamp(ms) {
  var d = new Date(ms);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
}

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function eventPayload(el) {
  var id = el.getAttribute('data-event-id') || '';
  var fromSite = id && (SITE.services || []).filter(function (s) { return s.id === id; })[0];
  var d = el.getAttribute('data-date') || (fromSite && fromSite.d) || '';
  var t = el.getAttribute('data-event-time');
  if (t == null || t === '') t = fromSite ? fromSite.t : '';
  var title = el.getAttribute('data-event-title') || (fromSite && fromSite.title) || el.textContent.trim();
  var note = el.getAttribute('data-event-note');
  if (note == null || note === '') note = fromSite && fromSite.note || '';
  var place = el.getAttribute('data-event-place') || (fromSite && fromSite.place) || SITE.place || '';
  var stream = el.getAttribute('data-event-stream') === '1' || (fromSite && fromSite.stream);
  var dur = +(el.getAttribute('data-event-dur') || (fromSite && fromSite.dur) || 90);
  return { id: id, d: d, t: t, title: title, note: note, place: place, stream: !!stream, dur: dur };
}

function whenText(ev) {
  if (!ev.d) return '';
  var civil = (SITE.calendar || {}).key === 'old' && (SITE.calendar || {}).showOldStyle !== false
    ? (function () {
        var j = churchDate(ev.d, 'julian');
        return t('calendar.civilWithOs', { civil: fmtDate(ev.d, 'weekdayLong'), os: fmtDate(toIso(j.y, j.m, j.d), 'dayMonth') });
      })()
    : fmtDate(ev.d, 'weekdayLong');
  return civil + (ev.t ? ', ' + fmtTime(ev.t) : '');
}

function buildIcs(ev) {
  var start = ev.t ? zonedToEpoch(ev.d, ev.t, TZ) : zonedToEpoch(ev.d, '00:00', TZ);
  var end = start + (ev.t ? ev.dur : 24 * 60) * 60000;
  var stamp = utcStamp(Date.now());
  var uid = (ev.id || 'event') + '@' + (location.hostname || 'parish');
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Parish Site//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + stamp,
    'DTSTART:' + utcStamp(start),
    'DTEND:' + utcStamp(end),
    'SUMMARY:' + icsEscape(ev.title),
    'LOCATION:' + icsEscape(ev.place),
    'DESCRIPTION:' + icsEscape(ev.note || t('schedule.neutralNote')),
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n');
}

function googleUrl(ev) {
  var start = ev.t ? zonedToEpoch(ev.d, ev.t, TZ) : zonedToEpoch(ev.d, '00:00', TZ);
  var end = start + (ev.t ? ev.dur : 24 * 60) * 60000;
  var dates = utcStamp(start) + '/' + utcStamp(end);
  var q = [
    'action=TEMPLATE',
    'text=' + encodeURIComponent(ev.title),
    'dates=' + dates,
    'details=' + encodeURIComponent(ev.note || t('schedule.neutralNote')),
    'location=' + encodeURIComponent(ev.place || '')
  ].join('&');
  return 'https://calendar.google.com/calendar/render?' + q;
}

function open(el) {
  var ev = eventPayload(el);
  if (!ev.d || ev.none) return;
  opener = el;
  titleEl.textContent = ev.title;
  whenEl.textContent = whenText(ev);
  whereEl.textContent = ev.place || '';
  var whereRow = whereEl.closest('div');
  if (whereRow) whereRow.hidden = !ev.place;
  else whereEl.hidden = !ev.place;
  noteEl.textContent = ev.note || t('schedule.neutralNote');
  if (icsBtn) {
    icsBtn.onclick = function () {
      var blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
      var a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (ev.id || 'service') + '.ics';
      doc.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
  }
  if (gcalLink) {
    gcalLink.href = googleUrl(ev);
    gcalLink.hidden = false;
  }
  if (dirLink) {
    var url = SITE.directionsUrl;
    dirLink.hidden = !url;
    if (url) dirLink.href = url;
  }
  if (liveLink) {
    var watch = SITE.livestream && (SITE.livestream.watch || SITE.livestream.page);
    liveLink.hidden = !(ev.stream && watch);
    if (ev.stream && watch) liveLink.href = watch;
  }
  dialog.showModal();
  doc.body.classList.add('is-locked');
  release = trapFocus(dialog);
  var closeBtn = dialog.querySelector('[data-modal-close]');
  if (closeBtn) closeBtn.focus();
}

function close() {
  dialog.close();
}

dialog.addEventListener('close', function () {
  doc.body.classList.remove('is-locked');
  if (release) release();
  if (opener) opener.focus();
});
$all('[data-modal-close]', dialog).forEach(function (b) { b.addEventListener('click', close); });
dialog.addEventListener('click', function (e) {
  if (e.target === dialog) close();
});

function onActivate(e) {
  var el = e.target.closest('[data-event]');
  if (!el || el.classList.contains('sched-entry--none') || el.getAttribute('data-event-none') === '1') return;
  if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  if (e.type === 'keydown') e.preventDefault();
  // Ignore clicks on nested interactive controls (links inside a row).
  if (e.target.closest('a, button, input, select, textarea') && !e.target.closest('[data-event]').isSameNode(e.target.closest('a, button, input, select, textarea'))) {
    var nested = e.target.closest('a, button');
    if (nested && !nested.hasAttribute('data-event')) return;
  }
  open(el);
}

doc.addEventListener('click', onActivate);
doc.addEventListener('keydown', onActivate);
