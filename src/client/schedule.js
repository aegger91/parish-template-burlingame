/*
 * Schedule views ([data-schedule]): week (seven day columns, stacked on
 * phones) and month (a calendar grid, a day list on phones). Entries come
 * from the page data (services) or the section's own JSON (OrthodoxConnect
 * events). Feasts come from content/calendar.json via the page data.
 */
var style = normalizeCalendarStyle((SITE.calendar || {}).style || (SITE.calendar || {}).key || 'old');
var showOS = isOldCalendar(style) && (SITE.calendar || {}).showOldStyle !== false;
var weekStart = SITE.weekStart || 0;

function el(tag, cls, text) {
  var n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function liveIcon() {
  var span = el('span', 'stream-tag');
  span.title = t('live.streamed');
  span.innerHTML = '<svg class="stream-tag__icon" aria-hidden="true" focusable="false"><use href="#i-live"></use></svg><span class="visually-hidden">' + t('live.streamed') + '</span>';
  return span;
}

function crossIcon(cls) {
  var s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  var u = doc.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', '#i-cross');
  s.appendChild(u);
  return s;
}

function feastInfo(iso) {
  var list = feastsOn(iso, style, SITE.feasts);
  var top = list[0];
  return { list: list, rank: top ? top.rank : null, cls: top && (top.rank === 'great' || top.rank === 'major') ? ' is-feast is-feast--' + top.rank : '' };
}

function civilWithOs(iso, dateStyle) {
  var civil = fmtDate(iso, dateStyle || 'dayMonth');
  if (!showOS) return civil;
  var j = churchDate(iso, 'julian');
  return t('calendar.civilWithOs', { civil: civil, os: fmtDate(toIso(j.y, j.m, j.d), 'dayMonth') });
}

function osDate(iso) {
  if (!showOS) return '';
  var j = churchDate(iso, 'julian');
  return t('calendar.oldStyle', { date: fmtDate(toIso(j.y, j.m, j.d), 'dayMonth') });
}

function entryNode(e, compact) {
  var li = el('li', 'sched-entry' + (e.none ? ' sched-entry--none' : ' is-clickable'));
  if (!e.none) {
    li.setAttribute('data-event', '');
    li.setAttribute('data-date', e.d);
    if (e.id) li.setAttribute('data-event-id', e.id);
    li.setAttribute('data-event-time', e.t || '');
    li.setAttribute('data-event-title', e.title || '');
    li.setAttribute('data-event-note', e.note || '');
    if (e.place) li.setAttribute('data-event-place', e.place);
    if (e.stream) li.setAttribute('data-event-stream', '1');
    li.setAttribute('data-event-dur', String(e.dur || 90));
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.setAttribute('aria-label', t('schedule.openDetails', { title: e.title || '' }));
  }
  if (e.t) li.appendChild(el('span', 'sched-entry__time', fmtTime(e.t)));
  var what = el('span', 'sched-entry__title', e.title);
  if (e.stream) what.appendChild(liveIcon());
  li.appendChild(what);
  if (e.note && !compact) li.appendChild(el('span', 'sched-entry__note', e.note));
  return li;
}

function feastLine(f, cls) {
  if (!f.list.length) return null;
  var p = el('p', cls + (f.rank ? ' ' + cls + '--' + f.rank : ''));
  if (f.rank === 'great' || f.rank === 'major') p.appendChild(crossIcon(cls + '-cross'));
  p.appendChild(el('span', '', f.list.map(function (x) { return x.title; }).join(' · ')));
  return p;
}

function initSchedule(box) {
  var entries = box.getAttribute('data-source') === 'services' ? SITE.services || [] : readJson(box.querySelector('[data-schedule-items]')) || [];
  var byDay = {};
  entries.forEach(function (e) {
    (byDay[e.d] = byDay[e.d] || []).push(e);
  });
  Object.keys(byDay).forEach(function (d) {
    byDay[d].sort(function (a, b) { return (a.t || '').localeCompare(b.t || ''); });
  });

  var bar = box.querySelector('[data-schedule-bar]');
  var view = box.querySelector('[data-schedule-view]');
  var range = box.querySelector('[data-range]');
  var legend = box.querySelector('[data-schedule-legend]');
  var fallback = box.querySelector('[data-schedule-fallback]');
  var source = box.getAttribute('data-source');
  var mode = store('schedule-view-' + source) || box.getAttribute('data-view') || 'week';
  var anchor = TODAY;

  function weekDays(iso) {
    var start = startOfWeek(iso, weekStart);
    var out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(start, i));
    return out;
  }

  function dayHeadNode(iso, f, cls) {
    var head = el('div', cls);
    var wd = el('span', cls + '-weekday', fmtDate(iso, 'weekdayShort'));
    var num = el('span', cls + '-date', civilWithOs(iso, 'dayMonth'));
    head.appendChild(wd);
    head.appendChild(num);
    return head;
  }

  function renderWeek() {
    var days = weekDays(anchor);
    var fmt = typeof Intl.DateTimeFormat.prototype.formatRange === 'function' ? new Intl.DateTimeFormat(LOCALE, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;
    var a = parseIso(days[0]);
    var b = parseIso(days[6]);
    range.textContent = fmt ? fmt.formatRange(new Date(Date.UTC(a.y, a.m - 1, a.d, 12)), new Date(Date.UTC(b.y, b.m - 1, b.d, 12))) : fmtDate(days[0], 'long') + ' / ' + fmtDate(days[6], 'long');
    var grid = el('ol', 'week');
    days.forEach(function (iso) {
      var f = feastInfo(iso);
      var list = byDay[iso] || [];
      var li = el('li', 'week__day' + f.cls + (iso === TODAY ? ' is-today' : '') + (iso < TODAY ? ' is-past' : '') + (list.length ? '' : ' is-empty'));
      li.appendChild(dayHeadNode(iso, f, 'week__head'));
      var fl = feastLine(f, 'week__feast');
      if (fl) li.appendChild(fl);
      if (list.length) {
        var ul = el('ul', 'week__entries');
        list.forEach(function (e) { ul.appendChild(entryNode(e)); });
        li.appendChild(ul);
      } else {
        li.appendChild(el('p', 'week__none', t(source === 'services' ? 'schedule.noServices' : 'schedule.noEvents')));
      }
      grid.appendChild(li);
    });
    return grid;
  }

  function renderMonth() {
    var p = parseIso(anchor);
    var first = toIso(p.y, p.m, 1);
    range.textContent = fmtDate(first, 'monthYear');
    var wrap = el('div', 'month');
    var grid = el('div', 'month__grid');
    grid.setAttribute('role', 'table');
    var headRow = el('div', 'month__weekdays');
    headRow.setAttribute('role', 'row');
    weekDays(first).forEach(function (iso) {
      var h = el('span', 'month__weekday', fmtDate(iso, 'weekdayShort'));
      h.setAttribute('role', 'columnheader');
      headRow.appendChild(h);
    });
    grid.appendChild(headRow);
    var start = startOfWeek(first, weekStart);
    var last = toIso(p.y, p.m, daysInMonth(p.y, p.m));
    var agenda = el('ol', 'month__agenda');
    var row = null;
    for (var i = 0, iso = start; iso <= last || i % 7 !== 0; i++, iso = addDays(start, i)) {
      if (i % 7 === 0) {
        row = el('div', 'month__row');
        row.setAttribute('role', 'row');
        grid.appendChild(row);
      }
      var inMonth = iso.slice(0, 7) === first.slice(0, 7);
      var f = feastInfo(iso);
      var list = byDay[iso] || [];
      var cell = el('div', 'month__cell' + f.cls + (inMonth ? '' : ' is-outside') + (iso === TODAY ? ' is-today' : '') + (iso < TODAY ? ' is-past' : ''));
      cell.setAttribute('role', 'cell');
      var num = el('p', 'month__num');
      num.appendChild(el('span', 'month__day', String(parseIso(iso).d)));
      if (showOS && inMonth) num.appendChild(el('span', 'month__os', String(churchDate(iso, 'julian').d)));
      cell.appendChild(num);
      var label = el('span', 'visually-hidden', fmtDate(iso, 'weekdayLong'));
      cell.appendChild(label);
      if (inMonth) {
        var fl = feastLine(f, 'month__feast');
        if (fl) cell.appendChild(fl);
        if (list.length) {
          var ul = el('ul', 'month__entries');
          list.slice(0, 3).forEach(function (e) { ul.appendChild(entryNode(e, true)); });
          if (list.length > 3) ul.appendChild(el('li', 'month__more', t('schedule.more', { n: list.length - 3 })));
          cell.appendChild(ul);
        }
        if (list.length || (f.list.length && f.rank !== 'observance')) {
          var day = el('li', 'agenda__day' + f.cls + (iso === TODAY ? ' is-today' : '') + (iso < TODAY ? ' is-past' : ''));
          day.appendChild(dayHeadNode(iso, f, 'agenda__head'));
          var afl = feastLine(f, 'agenda__feast');
          if (afl) day.appendChild(afl);
          if (list.length) {
            var aul = el('ul', 'agenda__entries');
            list.forEach(function (e) { aul.appendChild(entryNode(e)); });
            day.appendChild(aul);
          }
          agenda.appendChild(day);
        }
      }
      row.appendChild(cell);
    }
    if (!agenda.children.length) agenda.appendChild(el('li', 'agenda__empty', t(source === 'services' ? 'schedule.noServicesMonth' : 'schedule.noEventsMonth')));
    wrap.appendChild(grid);
    wrap.appendChild(agenda);
    return wrap;
  }

  function render() {
    view.textContent = '';
    view.appendChild(mode === 'month' ? renderMonth() : renderWeek());
    $all('[data-view-btn]', box).forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-view-btn') === mode));
    });
    box.setAttribute('data-view', mode);
    $all('[data-step-label]', box).forEach(function (s) {
      var dir = s.getAttribute('data-step-label') === '-1' ? 'prev' : 'next';
      s.textContent = t('schedule.' + dir + (mode === 'month' ? 'Month' : 'Week'));
    });
  }

  $all('[data-view-btn]', box).forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-view-btn');
      store('schedule-view-' + source, mode);
      render();
    });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var other = box.querySelector('[data-view-btn]:not([aria-selected="true"])');
      if (other) {
        other.click();
        other.focus();
      }
    });
  });
  $all('[data-step]', box).forEach(function (b) {
    b.addEventListener('click', function () {
      var step = +b.getAttribute('data-step');
      if (mode === 'month') {
        var p = parseIso(anchor);
        var m = p.m + step;
        var y = p.y + (m < 1 ? -1 : m > 12 ? 1 : 0);
        anchor = toIso(y, ((m + 11) % 12) + 1, 1);
      } else {
        anchor = addDays(anchor, 7 * step);
      }
      render();
    });
  });
  var todayBtn = box.querySelector('[data-today-btn]');
  if (todayBtn) todayBtn.addEventListener('click', function () {
    anchor = TODAY;
    render();
  });

  var calLabel = box.querySelector('[data-calendar-label]');
  if (calLabel && SITE.calendar && SITE.calendar.label) calLabel.textContent = SITE.calendar.label;

  bar.hidden = false;
  if (legend) legend.hidden = false;
  if (fallback) fallback.hidden = true;
  render();
}

$all('[data-schedule]').forEach(initSchedule);
