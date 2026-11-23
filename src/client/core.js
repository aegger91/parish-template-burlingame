/*
 * Shared helpers for the browser script. The build wraps calendar.mjs and
 * every file in src/client in one closure, in the order set in src/build.mjs.
 * Every feature degrades to working HTML without JavaScript.
 *
 * Parish integrations plug in through window.ParishSite.handlers, e.g.
 *   ParishSite.handlers.checkout = function (order) { return fetch(...) };
 * Handlers may return a promise. Without a handler a form POSTs JSON to its
 * data-endpoint when one is set, or shows a "sample, nothing was sent" note.
 */
var doc = document;
var root = doc.documentElement;
var ParishSite = (window.ParishSite = window.ParishSite || {});
ParishSite.handlers = ParishSite.handlers || {};

function $all(sel, ctx) {
  return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
}

var SITE = (function () {
  var el = doc.getElementById('site-data');
  try {
    return el ? JSON.parse(el.textContent) : {};
  } catch (err) {
    return {};
  }
})();
var STR = SITE.strings || {};
var LOCALE = SITE.locale || root.lang || 'en';
var TZ = SITE.tz || root.getAttribute('data-timezone') || 'UTC';

function t(key, vars) {
  var s = STR[key] || key;
  if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

function todayIso() {
  try {
    return todayIn(TZ);
  } catch (err) {
    return new Date().toISOString().slice(0, 10);
  }
}
var TODAY = todayIso();

var DATE_FORMATS = {};
function fmtDate(iso, style) {
  var opts = {
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    weekdayLong: { weekday: 'long', month: 'long', day: 'numeric' },
    short: { weekday: 'short', month: 'short', day: 'numeric' },
    dayMonth: { month: 'long', day: 'numeric' },
    monthYear: { year: 'numeric', month: 'long' },
    weekdayShort: { weekday: 'short' },
    weekdayNarrow: { weekday: 'narrow' },
    day: { day: 'numeric' }
  }[style || 'long'];
  var key = style || 'long';
  if (!DATE_FORMATS[key]) DATE_FORMATS[key] = new Intl.DateTimeFormat(LOCALE, Object.assign({ timeZone: 'UTC' }, opts));
  var p = parseIso(iso);
  return DATE_FORMATS[key].format(new Date(Date.UTC(p.y, p.m - 1, p.d, 12)));
}

var TIME_FORMAT = null;
function fmtTime(hhmm) {
  if (!hhmm) return '';
  if (!TIME_FORMAT) TIME_FORMAT = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  var hm = hhmm.split(':');
  return TIME_FORMAT.format(new Date(Date.UTC(2000, 0, 1, +hm[0], +hm[1])))
    .replace(/\s?(AM|PM)$/i, function (m) { return '\u00a0' + m.trim().toLowerCase(); });
}

var CURRENCY = root.getAttribute('data-currency') || 'USD';
function money(n) {
  var whole = Math.round(n * 100) % 100 === 0;
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(n);
}

function store(key, value) {
  try {
    if (arguments.length > 1) localStorage.setItem(key, JSON.stringify(value));
    else return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (err) {
    return null;
  }
}

function readJson(el) {
  try {
    return el ? JSON.parse(el.textContent) : null;
  } catch (err) {
    return null;
  }
}

function setStatus(box, text, tone) {
  if (!box) return;
  box.hidden = !text;
  box.textContent = text || '';
  box.className = box.className.replace(/\s?form-status--\w+/g, '') + (tone ? ' form-status--' + tone : '');
}

// Hands a payload to ParishSite.handlers[name], or POSTs it to `endpoint`,
// or resolves as a sample. Resolves to { sample: true } in sample mode.
function submitTo(name, payload, endpoint) {
  var handler = ParishSite.handlers[name];
  if (typeof handler === 'function') return Promise.resolve(handler(payload)).then(function (r) { return r || {}; });
  if (endpoint) {
    return fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return {};
    });
  }
  if (window.console) console.info('[ParishSite] ' + name + ' (sample, nothing sent):', payload);
  return Promise.resolve({ sample: true });
}

// Checks required fields and email/pattern validity; focuses the first problem.
function validate(form) {
  var bad = $all('input, select, textarea', form).filter(function (el) {
    if (el.disabled || el.closest('[hidden]')) return false;
    return !el.checkValidity();
  });
  $all('.field--invalid', form).forEach(function (f) { f.classList.remove('field--invalid'); });
  bad.forEach(function (el) {
    var f = el.closest('.field, .consent');
    if (f) f.classList.add('field--invalid');
    el.setAttribute('aria-invalid', 'true');
  });
  $all('[aria-invalid]', form).forEach(function (el) {
    if (bad.indexOf(el) < 0) el.removeAttribute('aria-invalid');
  });
  if (bad.length) bad[0].focus();
  return !bad.length;
}

function formValues(form) {
  var out = {};
  $all('input[name], select[name], textarea[name]', form).forEach(function (el) {
    if (el.closest('[hidden]') && el.type !== 'hidden') return;
    if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
    out[el.name] = el.value.trim();
  });
  return out;
}

// Keeps Tab inside `box` while it is open. Returns a function that removes it.
function trapFocus(box) {
  function onKey(e) {
    if (e.key !== 'Tab') return;
    var f = $all('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', box).filter(function (el) {
      return el.offsetParent !== null;
    });
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  box.addEventListener('keydown', onKey);
  return function () { box.removeEventListener('keydown', onKey); };
}

/* Phone fields: (000)-000-0000 as you type. */
function maskPhone(value) {
  var d = value.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10);
  if (!d) return '';
  if (d.length < 4) return '(' + d;
  if (d.length < 7) return '(' + d.slice(0, 3) + ')-' + d.slice(3);
  return '(' + d.slice(0, 3) + ')-' + d.slice(3, 6) + '-' + d.slice(6);
}
doc.addEventListener('input', function (e) {
  var el = e.target;
  if (!el.matches || !el.matches('[data-phone-mask]')) return;
  var atEnd = el.selectionStart === el.value.length;
  el.value = maskPhone(el.value);
  if (atEnd) el.setSelectionRange(el.value.length, el.value.length);
});

/* Language: remember the choice and keep the #anchor when switching. */
$all('.lang-switch__link').forEach(function (link) {
  link.addEventListener('click', function () {
    try {
      localStorage.setItem('site-lang', link.getAttribute('data-lang'));
    } catch (err) {
      /* the URL still carries the language */
    }
    if (location.hash && link.href.indexOf('#') === -1) link.href += location.hash;
  });
});

/* Dated rows: hide what has passed, top lists back up from spare rows. */
function hidePast(scope) {
  $all('[data-hide-past]', scope).forEach(function (list) {
    var limit = parseInt(list.getAttribute('data-limit'), 10) || Infinity;
    var shown = 0;
    $all(':scope > [data-date]', list).forEach(function (row) {
      var past = row.getAttribute('data-date') < TODAY;
      row.classList.toggle('is-past', past);
      if (past) {
        row.hidden = true;
        return;
      }
      row.hidden = shown >= limit;
      if (!row.hidden) shown += 1;
    });
    var empty = list.nextElementSibling;
    if (empty && /__empty$/.test(empty.className)) empty.hidden = shown > 0;
  });
  $all('[data-until]', scope).forEach(function (el) {
    if (el.getAttribute('data-until') < TODAY) el.hidden = true;
  });
}
hidePast();

function civilWithOsText(iso, dateStyle) {
  var civil = fmtDate(iso, dateStyle || 'weekdayLong');
  var cal = SITE.calendar || {};
  if (!isOldCalendar(cal.style || cal.key || 'old') || cal.showOldStyle === false) return civil;
  var j = churchDate(iso, 'julian');
  return t('calendar.civilWithOs', { civil: civil, os: fmtDate(toIso(j.y, j.m, j.d), 'dayMonth') });
}

/* Today and the feast of the day ([data-today], refreshed from calendar data). */
$all('[data-today]').forEach(function (box) {
  var style = normalizeCalendarStyle((SITE.calendar || {}).style || (SITE.calendar || {}).key || 'old');
  var dateEl = box.querySelector('[data-today-date]');
  if (dateEl && dateEl.getAttribute('datetime') === TODAY) return;
  if (dateEl) {
    dateEl.textContent = civilWithOsText(TODAY, 'weekdayLong');
    dateEl.setAttribute('datetime', TODAY);
  }
  var today = feastsOn(TODAY, style, SITE.feasts)[0];
  var next = today ? null : nextFeast(TODAY, style, SITE.feasts, 90);
  var set = function (sel, text) {
    var el = box.querySelector(sel);
    if (el) el.textContent = text;
  };
  set('[data-feast-label]', today ? t('calendar.feastToday') : next ? t('calendar.comingFeast') : '');
  set('[data-feast-title]', today ? today.title : next ? next.feast.title : '');
  set('[data-feast-when]', next ? civilWithOsText(next.date, 'weekdayLong') : '');
});
