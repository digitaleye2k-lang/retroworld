/* RETRO WORLD — Kids-friendly mode.
   Hides games with realistic or human-on-human violence, guns or gore across the classic site,
   mobile mode and console mode. Anything marked [data-violent] is hidden while <html> has .kids-mode
   (set before first paint by a tiny inline script in <head>). Turning it OFF needs a grown-up check.
   API: RWKIDS.on() · RWKIDS.set(bool) · RWKIDS.toggle() · RWKIDS.isViolent(gameId) · event 'rw-kids-change' */
(function () {
  'use strict';
  if (window.RWKIDS) return;
  var KEY = 'rw_kids';
  var VIOLENT = ['stick-ops.html', 'gun-fu.html', 'last-stand.html', 'ghostblade.html', 'shadow-protocol.html', 'beat-up-mafia.html',
    'dust-iron.html', 'crimson-fang.html', 'jungle-gunship.html', 'hellbyte-93.html', 'silent-wire.html',
    'stick-fury.html', 'metro-brawler.html', 'shadow-duel.html'];
  var root = document.documentElement;
  function on() { return root.classList.contains('kids-mode'); }
  function isViolent(id) { return VIOLENT.indexOf(String(id || '').replace(/^.*\//, '')) >= 0; }

  function paint() {
    var v = on();
    document.querySelectorAll('[data-kids-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', v ? 'true' : 'false');
      var l = b.querySelector('[data-kids-label]');
      if (l) l.textContent = v ? 'ON' : 'OFF';
    });
  }
  function apply(v) {
    root.classList.toggle('kids-mode', !!v);
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
    paint();
    try { window.dispatchEvent(new CustomEvent('rw-kids-change', { detail: { on: !!v } })); } catch (e) {}
    announce(v ? 'Kids mode on. ' + VIOLENT.length + ' games with realistic violence are hidden.' : 'Kids mode off. All games are shown.');
  }

  var live;
  function announce(t) {
    if (!live) { live = document.createElement('div'); live.className = 'rw-sr'; live.setAttribute('aria-live', 'polite'); document.body.appendChild(live); }
    live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30);
  }

  /* grown-up check before switching kids mode off */
  function parentCheck(done) {
    var a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    var prev = document.activeElement;
    var o = document.createElement('div');
    o.className = 'rw-kids-modal';
    o.innerHTML = '<div class="rw-kids-box" role="dialog" aria-modal="true" aria-labelledby="rwKidsT">' +
      '<div class="rw-kids-ic" aria-hidden="true">🧸</div><h2 id="rwKidsT">Grown-up check</h2>' +
      '<p>Kids mode hides games with realistic violence. To show all games, answer this question:</p>' +
      '<label for="rwKidsA" class="rw-kids-q">What is ' + a + ' × ' + b + '?</label>' +
      '<input id="rwKidsA" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="3">' +
      '<p class="rw-kids-err" role="alert"></p>' +
      '<div class="rw-kids-row"><button type="button" class="rw-kids-no">Keep kids mode</button><button type="button" class="rw-kids-yes">Show all games</button></div></div>';
    document.body.appendChild(o);
    var inp = o.querySelector('input'), err = o.querySelector('.rw-kids-err');
    function close(ok) { o.remove(); document.removeEventListener('keydown', key, true); if (prev && prev.focus) try { prev.focus(); } catch (e) {} done(ok); }
    function check() { if (parseInt(inp.value, 10) === a * b) close(true); else { err.textContent = 'Not quite. Try again.'; inp.select(); } }
    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Enter' && document.activeElement === inp) { e.preventDefault(); e.stopPropagation(); check(); }
      else if (e.key === 'Tab') { var f = [inp, o.querySelector('.rw-kids-no'), o.querySelector('.rw-kids-yes')], i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
      e.stopPropagation();
    }
    document.addEventListener('keydown', key, true);
    o.querySelector('.rw-kids-no').onclick = function () { close(false); };
    o.querySelector('.rw-kids-yes').onclick = check;
    o.addEventListener('click', function (e) { if (e.target === o) close(false); });
    setTimeout(function () { inp.focus(); }, 30);
  }

  function set(v) {
    if (!!v === on()) { paint(); return; }
    if (v) apply(true); else parentCheck(function (ok) { if (ok) apply(false); });
  }

  /* classic site: header toggle + library notice */
  function mount() {
    var mob = document.getElementById('mobileModeBtn');
    if (mob && !document.getElementById('kidsModeBtn')) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'kidsModeBtn'; b.className = 'tv-mode-toggle rw-kids-btn';
      b.setAttribute('data-kids-toggle', '');
      b.title = 'Kids-friendly mode: hide games with realistic violence';
      b.innerHTML = '🧸 KIDS: <span data-kids-label>OFF</span>';
      b.setAttribute('aria-label', 'Kids mode');
      b.addEventListener('click', function () { set(!on()); });
      mob.insertAdjacentElement('afterend', b);
    }
    var grid = document.querySelector('section.grid');
    if (grid && !document.getElementById('rwKidsNote')) {
      var n = document.createElement('div');
      n.id = 'rwKidsNote'; n.className = 'rw-kids-note';
      n.innerHTML = '<span aria-hidden="true">🧸</span><p><b>Kids mode is on.</b> ' + VIOLENT.length + ' games with realistic violence are hidden.</p><button type="button" data-kids-toggle aria-pressed="true">Show all games</button>';
      n.querySelector('button').addEventListener('click', function () { set(false); });
      grid.parentNode.insertBefore(n, grid);
    }
    paint();
  }

  window.RWKIDS = { on: on, set: set, toggle: function () { set(!on()); }, isViolent: isViolent, list: VIOLENT.slice(), paint: paint };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.addEventListener('storage', function (e) { if (e.key === KEY) { root.classList.toggle('kids-mode', e.newValue === '1'); paint(); window.dispatchEvent(new CustomEvent('rw-kids-change', { detail: { on: e.newValue === '1' } })); } });
})();
