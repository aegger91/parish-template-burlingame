// Church calendar arithmetic, shared by the build and the browser script
// (the build copies this file into assets/site.js, so keep it dependency-free
// and plain ES2015: no imports, every export is a function declaration).
//
// Dates are "YYYY-MM-DD" strings on the civil (Gregorian) calendar unless a
// name says otherwise. The church calendar style comes from site.calendar.style:
//   "julian"          fixed feasts on the Julian (Old Style) calendar, Orthodox Pascha
//   "revised-julian"  fixed feasts on the civil calendar, Orthodox Pascha
//   "gregorian"       fixed feasts on the civil calendar, Western Pascha
// Feast data (content/calendar.json): fixed feasts keyed "MM-DD" in the
// church's own calendar, movable feasts keyed by their day offset from Pascha.

export function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

export function parseIso(iso) {
  return { y: +iso.slice(0, 4), m: +iso.slice(5, 7), d: +iso.slice(8, 10) };
}

export function toIso(y, m, d) {
  return y + '-' + pad2(m) + '-' + pad2(d);
}

export function gregorianToJdn(y, m, d) {
  var a = Math.floor((14 - m) / 12);
  var yy = y + 4800 - a;
  var mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function julianToJdn(y, m, d) {
  var a = Math.floor((14 - m) / 12);
  var yy = y + 4800 - a;
  var mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
}

export function jdnToGregorian(j) {
  var a = j + 32044;
  var b = Math.floor((4 * a + 3) / 146097);
  var c = a - Math.floor((146097 * b) / 4);
  var d = Math.floor((4 * c + 3) / 1461);
  var e = c - Math.floor((1461 * d) / 4);
  var m = Math.floor((5 * e + 2) / 153);
  return { y: 100 * b + d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}

export function jdnToJulian(j) {
  var c = j + 32082;
  var d = Math.floor((4 * c + 3) / 1461);
  var e = c - Math.floor((1461 * d) / 4);
  var m = Math.floor((5 * e + 2) / 153);
  return { y: d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}

export function isoToJdn(iso) {
  var p = parseIso(iso);
  return gregorianToJdn(p.y, p.m, p.d);
}

export function jdnToIso(j) {
  var g = jdnToGregorian(j);
  return toIso(g.y, g.m, g.d);
}

export function addDays(iso, n) {
  return jdnToIso(isoToJdn(iso) + n);
}

// 0 = Sunday ... 6 = Saturday
export function weekday(iso) {
  return (isoToJdn(iso) + 1) % 7;
}

// Orthodox Pascha: Julian computus, returned as a civil date.
export function orthodoxPascha(year) {
  var a = year % 4;
  var b = year % 7;
  var c = year % 19;
  var d = (19 * c + 15) % 30;
  var e = (2 * a + 4 * b - d + 34) % 7;
  var month = Math.floor((d + e + 114) / 31);
  var day = ((d + e + 114) % 31) + 1;
  return jdnToIso(julianToJdn(year, month, day));
}

// Western Pascha (Gregorian computus).
export function westernPascha(year) {
  var a = year % 19;
  var b = Math.floor(year / 100);
  var c = year % 100;
  var d = Math.floor(b / 4);
  var e = b % 4;
  var f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4);
  var k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var month = Math.floor((h + l - 7 * m + 114) / 31);
  var day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIso(year, month, day);
}

export function paschaFor(year, style) {
  return style === 'gregorian' ? westernPascha(year) : orthodoxPascha(year);
}

// The church's own date for a civil date: Julian for "julian", else the same.
export function churchDate(iso, style) {
  if (style !== 'julian') return parseIso(iso);
  return jdnToJulian(isoToJdn(iso));
}

// Civil date of a fixed feast "MM-DD" falling in the given civil year.
export function fixedFeastDate(mmdd, civilYear, style) {
  var m = +mmdd.slice(0, 2);
  var d = +mmdd.slice(3, 5);
  if (style !== 'julian') return toIso(civilYear, m, d);
  // A Julian date can land in the next civil year (Dec 19-31 Julian -> January),
  // so pick the Julian year whose feast falls in civilYear.
  for (var y = civilYear - 1; y <= civilYear; y++) {
    var iso = jdnToIso(julianToJdn(y, m, d));
    if (+iso.slice(0, 4) === civilYear) return iso;
  }
  return null;
}

var RANK_ORDER = { great: 0, major: 1, saint: 2 };

// Every commemoration on a civil date, most important first.
// feasts: { fixed: [{ date: "MM-DD", rank, title }], movable: [{ offset, rank, title }] }
export function feastsOn(iso, style, feasts) {
  var out = [];
  if (!feasts) return out;
  var cd = churchDate(iso, style);
  var key = pad2(cd.m) + '-' + pad2(cd.d);
  var fixed = feasts.fixed || [];
  for (var i = 0; i < fixed.length; i++) if (fixed[i].date === key) out.push(fixed[i]);
  var year = +iso.slice(0, 4);
  var offset = isoToJdn(iso) - isoToJdn(paschaFor(year, style));
  var movable = feasts.movable || [];
  for (var j = 0; j < movable.length; j++) if (movable[j].offset === offset) out.push(movable[j]);
  return out.sort(function (a, b) {
    return (RANK_ORDER[a.rank] === undefined ? 9 : RANK_ORDER[a.rank]) - (RANK_ORDER[b.rank] === undefined ? 9 : RANK_ORDER[b.rank]);
  });
}

// The next great or major feast on or after a civil date (within `days`).
export function nextFeast(iso, style, feasts, days) {
  var limit = days || 120;
  for (var n = 0; n <= limit; n++) {
    var day = addDays(iso, n);
    var list = feastsOn(day, style, feasts).filter(function (f) {
      return f.rank === 'great' || f.rank === 'major';
    });
    if (list.length) return { date: day, feast: list[0], inDays: n };
  }
  return null;
}

// First day of the week containing iso. weekStart: 0 = Sunday, 1 = Monday...
export function startOfWeek(iso, weekStart) {
  var back = (weekday(iso) - (weekStart || 0) + 7) % 7;
  return addDays(iso, -back);
}

export function daysInMonth(y, m) {
  return jdnToGregorian(gregorianToJdn(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1).d;
}

// Milliseconds since epoch for a wall-clock date and time in an IANA timezone.
export function zonedToEpoch(iso, hhmm, timeZone) {
  var p = parseIso(iso);
  var hm = (hhmm || '00:00').split(':');
  var guess = Date.UTC(p.y, p.m - 1, p.d, +hm[0], +hm[1]);
  for (var i = 0; i < 2; i++) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).formatToParts(new Date(guess));
    var get = function (t) {
      for (var k = 0; k < parts.length; k++) if (parts[k].type === t) return +parts[k].value;
      return 0;
    };
    var shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
    guess += Date.UTC(p.y, p.m - 1, p.d, +hm[0], +hm[1]) - shown;
  }
  return guess;
}

// Today's civil date in a timezone.
export function todayIn(timeZone, now) {
  var parts = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now || new Date());
  var get = function (t) {
    for (var k = 0; k < parts.length; k++) if (parts[k].type === t) return parts[k].value;
    return '';
  };
  return get('year') + '-' + get('month') + '-' + get('day');
}
