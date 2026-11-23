/*
 * Header: condenses on scroll, slides away while reading down and returns
 * on the way up. The menu is measured rather than switched at a fixed
 * breakpoint, so it works for any number of pages and any language: when
 * the full menu does not fit, the last items move into "More"; when more
 * than MAX_MORE would have to move, the header switches to the drawer.
 */
var header = doc.querySelector('[data-header]');
var nav = doc.querySelector('[data-nav]');
var burger = doc.querySelector('[data-burger]');
var drawerEl = doc.querySelector('[data-drawer]');
var MAX_MORE = 3;
var MIN_FULL_WIDTH = 900;
var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

function updateHeaderOffset() {
  if (!header) return;
  root.style.setProperty('--header-bottom', Math.max(0, header.getBoundingClientRect().bottom) + 'px');
  root.style.setProperty('--header-height', header.offsetHeight + 'px');
}

/* ---- scroll (height stays fixed; only shadow + hide-on-scroll change) */
var lastY = window.scrollY;
var ticking = false;
var compactOn = false;
function onScroll() {
  if (!header) return;
  var y = window.scrollY;
  var wantCompact = y > 24;
  if (wantCompact !== compactOn) {
    compactOn = wantCompact;
    header.classList.toggle('is-compact', compactOn);
  }
  var busy = header.contains(doc.activeElement) && doc.activeElement !== doc.body || header.querySelector('[aria-expanded="true"]') || header.querySelector('details[open]');
  if (y > 480 && y > lastY + 8 && !busy) header.classList.add('is-hidden');
  else if (y < lastY - 8 || y <= 480) header.classList.remove('is-hidden');
  lastY = y;
  updateHeaderOffset();
}
window.addEventListener('scroll', function () {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(function () {
    ticking = false;
    onScroll();
  });
}, { passive: true });
if (header) header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });

/* ---- fit: full menu, menu + More, or drawer */
var navList = nav && nav.querySelector('.nav__list');
var moreItem = nav && nav.querySelector('[data-nav-more]');
var moreList = nav && nav.querySelector('[data-nav-more-list]');
var topItems = navList ? $all(':scope > .nav__item:not(.nav__item--more)', navList) : [];

function restoreItems() {
  topItems.forEach(function (li) {
    li.classList.remove('is-in-more');
    navList.insertBefore(li, moreItem);
  });
  if (moreItem) moreItem.hidden = true;
}

function overflowing() {
  return navList.scrollWidth > nav.clientWidth + 1;
}

function fit() {
  if (!header || !navList) return;
  closeDropdowns();
  restoreItems();
  header.setAttribute('data-mode', 'full');
  if (window.innerWidth < MIN_FULL_WIDTH) {
    header.setAttribute('data-mode', 'collapsed');
    updateHeaderOffset();
    return;
  }
  if (overflowing()) {
    moreItem.hidden = false;
    var moved = 0;
    for (var i = topItems.length - 1; i > 0 && overflowing() && moved < MAX_MORE + 1; i--) {
      var li = topItems[i];
      li.classList.add('is-in-more');
      moreList.insertBefore(li, moreList.firstChild);
      moved += 1;
    }
    if (overflowing() || moved > MAX_MORE) {
      restoreItems();
      header.setAttribute('data-mode', 'collapsed');
    } else {
      moreItem.classList.toggle('is-current', !!moreList.querySelector('.is-current, [aria-current="page"]'));
    }
  }
  updateHeaderOffset();
}

var fitTimer = null;
window.addEventListener('resize', function () {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(fit, 80);
});
if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
fit();
onScroll();

/* ---- dropdowns */
function closeDropdowns(except) {
  $all('.site-nav [aria-expanded="true"]').forEach(function (btn) {
    if (btn !== except && !(except && btn.parentElement.contains(except))) btn.setAttribute('aria-expanded', 'false');
  });
}

$all('.nav__toggle, .nav__more').forEach(function (btn) {
  var item = btn.parentElement;
  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') !== 'true';
    closeDropdowns(btn);
    btn.setAttribute('aria-expanded', String(open));
  });
  item.addEventListener('mouseenter', function () {
    if (!finePointer.matches || item.classList.contains('is-in-more')) return;
    closeDropdowns(btn);
    btn.setAttribute('aria-expanded', 'true');
  });
  item.addEventListener('mouseleave', function () {
    if (finePointer.matches && !item.classList.contains('is-in-more')) btn.setAttribute('aria-expanded', 'false');
  });
  item.addEventListener('focusout', function (e) {
    if (!item.contains(e.relatedTarget)) btn.setAttribute('aria-expanded', 'false');
  });
});

doc.addEventListener('click', function (e) {
  if (!e.target.closest('.nav__item--parent')) closeDropdowns();
  $all('details[data-lang-menu][open]').forEach(function (d) {
    if (!d.contains(e.target)) d.open = false;
  });
});

/* ---- drawer */
var releaseTrap = null;
function setDrawer(open) {
  if (!drawerEl || !burger) return;
  if (open) {
    drawerEl.hidden = false;
    doc.body.classList.add('is-locked');
    releaseTrap = trapFocus(drawerEl);
    window.requestAnimationFrame(function () {
      drawerEl.classList.add('is-open');
      var panel = drawerEl.querySelector('.drawer__panel');
      (drawerEl.querySelector('[aria-current="page"]') || panel).focus({ preventScroll: true });
    });
  } else {
    drawerEl.classList.remove('is-open');
    doc.body.classList.remove('is-locked');
    if (releaseTrap) releaseTrap();
    setTimeout(function () { drawerEl.hidden = true; }, 220);
    burger.focus({ preventScroll: true });
  }
  burger.setAttribute('aria-expanded', String(open));
}

if (burger) burger.addEventListener('click', function () { setDrawer(burger.getAttribute('aria-expanded') !== 'true'); });
if (drawerEl) {
  $all('[data-drawer-close]', drawerEl).forEach(function (el) { el.addEventListener('click', function () { setDrawer(false); }); });
  drawerEl.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (link && link.getAttribute('href').indexOf('#') > -1 && link.pathname === location.pathname) setDrawer(false);
  });
  $all('.drawer-nav__toggle', drawerEl).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      doc.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
    });
  });
}

doc.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var open = doc.querySelector('.site-nav [aria-expanded="true"]');
  if (open) {
    closeDropdowns();
    open.focus();
  } else if (drawerEl && !drawerEl.hidden) {
    setDrawer(false);
  } else {
    $all('details[data-lang-menu][open]').forEach(function (d) {
      d.open = false;
      d.querySelector('summary').focus();
    });
  }
});

window.addEventListener('resize', function () {
  if (drawerEl && !drawerEl.hidden && header.getAttribute('data-mode') === 'full') setDrawer(false);
});
