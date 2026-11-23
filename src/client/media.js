/*
 * Media: YouTube facades, the photo lightbox (captions, "3 of 12", arrow
 * keys, swipe) and the shared sermon audio player.
 */

/* ---- video facade -> privacy-enhanced embed on click */
doc.addEventListener('click', function (e) {
  var link = e.target.closest('[data-youtube] .video__link');
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  var box = link.parentElement;
  var frame = doc.createElement('iframe');
  frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(box.getAttribute('data-youtube')) + '?autoplay=1&rel=0';
  frame.title = (link.querySelector('.video__title') || link).textContent.trim();
  frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  frame.allowFullscreen = true;
  box.appendChild(frame);
  link.hidden = true;
  frame.focus();
});

/* ---- lightbox */
var lb = doc.querySelector('[data-lightbox-root]');
if (lb) {
  var lbImg = lb.querySelector('[data-lb-img]');
  var lbCaption = lb.querySelector('[data-lb-caption]');
  var lbCount = lb.querySelector('[data-lb-count]');
  var items = [];
  var index = 0;
  var opener = null;
  var release = null;

  var show = function (i) {
    index = (i + items.length) % items.length;
    var link = items[index];
    var thumb = link.querySelector('img');
    lbImg.src = link.href;
    lbImg.alt = thumb ? thumb.alt : '';
    lbCaption.textContent = link.getAttribute('data-caption') || (thumb ? thumb.alt : '');
    var multi = items.length > 1;
    lb.querySelector('[data-lb-prev]').hidden = !multi;
    lb.querySelector('[data-lb-next]').hidden = !multi;
    lbCount.textContent = multi ? t('gallery.count', { n: index + 1, total: items.length }) : '';
  };
  var close = function () {
    lb.hidden = true;
    doc.body.classList.remove('is-locked');
    lbImg.removeAttribute('src');
    if (release) release();
    if (opener) opener.focus();
  };

  doc.addEventListener('click', function (e) {
    var link = e.target.closest('[data-lightbox]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    var group = link.closest('.gallery');
    items = (group ? $all('[data-lightbox]', group) : [link]).filter(function (a) { return !a.closest('[hidden]'); });
    opener = link;
    show(items.indexOf(link));
    lb.hidden = false;
    doc.body.classList.add('is-locked');
    release = trapFocus(lb);
    lb.querySelector('[data-lb-close]').focus();
  });
  lb.querySelector('[data-lb-close]').addEventListener('click', close);
  lb.querySelector('[data-lb-prev]').addEventListener('click', function () { show(index - 1); });
  lb.querySelector('[data-lb-next]').addEventListener('click', function () { show(index + 1); });
  lb.addEventListener('click', function (e) {
    if (e.target === lb) close();
  });
  var touchX = null;
  lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (touchX == null || items.length < 2) return;
    var dx = e.changedTouches[0].clientX - touchX;
    var rtl = root.dir === 'rtl';
    if (Math.abs(dx) > 40) show(index + ((dx < 0) !== rtl ? 1 : -1));
    touchX = null;
  });
  doc.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    var rtl = root.dir === 'rtl';
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index + (rtl ? 1 : -1));
    else if (e.key === 'ArrowRight') show(index + (rtl ? -1 : 1));
  });
}

/* ---- sermon player */
$all('[data-sermons]').forEach(function (box) {
  var player = box.querySelector('[data-player]');
  var audio = player.querySelector('[data-player-audio]');
  var toggle = player.querySelector('[data-player-toggle]');
  var seek = player.querySelector('[data-player-seek]');
  var time = player.querySelector('[data-player-time]');
  var dur = player.querySelector('[data-player-duration]');
  var rate = player.querySelector('[data-player-rate]');
  var current = null;
  var RATES = [1, 1.25, 1.5, 0.75];
  var clock = function (s) {
    s = Math.floor(s || 0);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  };
  var sync = function () {
    var playing = !audio.paused;
    player.classList.toggle('is-playing', playing);
    $all('[data-play-sermon]', box).forEach(function (b) {
      var on = b === current && playing;
      b.classList.toggle('is-playing', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };
  $all('[data-play-sermon]', box).forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      if (current === b) {
        if (audio.paused) audio.play();
        else audio.pause();
        return;
      }
      current = b;
      audio.src = b.getAttribute('data-play-sermon');
      player.querySelector('[data-player-title]').textContent = b.getAttribute('data-title');
      player.querySelector('[data-player-meta]').textContent = b.getAttribute('data-meta');
      player.hidden = false;
      audio.play();
    });
  });
  toggle.addEventListener('click', function () {
    if (audio.paused) audio.play();
    else audio.pause();
  });
  rate.addEventListener('click', function () {
    var next = RATES[(RATES.indexOf(audio.playbackRate) + 1) % RATES.length];
    audio.playbackRate = next;
    rate.textContent = next + '\u00d7';
  });
  audio.addEventListener('play', sync);
  audio.addEventListener('pause', sync);
  audio.addEventListener('loadedmetadata', function () { dur.textContent = clock(audio.duration); });
  audio.addEventListener('timeupdate', function () {
    time.textContent = clock(audio.currentTime);
    if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
  });
  seek.addEventListener('input', function () {
    if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
  });
});
