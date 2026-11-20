/* RETRO WORLD shared sound library player.
   Real recorded sounds live in assets/sfx/<name>.mp3 (see assets/sfx/README.md for the list).
   Usage in a game:
     <script src="../../assets/rw-sfx.js"></script>
     RWSFX.use(audioContext, destinationNode)  // optional: share the game's own context + volume bus
     RWSFX.preload(['gun_rifle','punch1'])     // decode early
     RWSFX.play('gun_rifle', {vol:.8, rate:1, at:0, vary:.06, dest:node})  -> true if a sample played
     RWSFX.pick('punch1','punch2','punch3')    // random name from a set
   play() returns false while a sample is still loading (or if audio is unavailable) so a game can
   fall back to its own synthesized sound. */
(function () {
  'use strict';
  if (window.RWSFX) return;
  var cs = document.currentScript;
  var base = (cs && cs.src) ? cs.src.replace(/[^\/]*$/, '') + 'sfx/' : 'assets/sfx/';
  var buf = {}, pend = {}, ctx = null, dest = null, own = false, last = {};
  function ac() {
    if (ctx) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); own = true; dest = ctx.destination; } catch (e) { ctx = null; }
    return ctx;
  }
  function load(n) {
    if (buf[n] || pend[n]) return;
    var c = ac(); if (!c) return;
    pend[n] = 1;
    try {
      fetch(base + n + '.mp3').then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (res, rej) { c.decodeAudioData(b, res, rej); }); })
        .then(function (d) { buf[n] = d; delete pend[n]; }, function () { delete pend[n]; buf[n] = null; });
    } catch (e) { delete pend[n]; }
  }
  function resume() { if (ctx && ctx.state === 'suspended') try { ctx.resume(); } catch (e) {} }
  if (typeof addEventListener === 'function') { addEventListener('pointerdown', resume, { passive: true }); addEventListener('keydown', resume); addEventListener('touchstart', resume, { passive: true }); }
  window.RWSFX = {
    base: base,
    use: function (c, d) { if (c && c !== ctx) { ctx = c; own = false; buf = {}; pend = {}; } dest = d || (ctx && ctx.destination); return this; },
    preload: function (names) { (names || []).forEach(load); return this; },
    has: function (n) { return !!buf[n]; },
    pick: function () { return arguments[Math.floor(Math.random() * arguments.length)]; },
    play: function (n, o) {
      o = o || {};
      var c = ac(); if (!c) return false;
      var b = buf[n]; if (!b) { if (b !== null) load(n); return false; }
      var now = c.currentTime;
      if (o.gap && last[n] && now - last[n] < o.gap) return true;
      last[n] = now;
      resume();
      try {
        var s = c.createBufferSource(), g = c.createGain();
        s.buffer = b;
        var r = (o.rate || 1) * (o.vary ? 1 + (Math.random() * 2 - 1) * o.vary : 1);
        s.playbackRate.value = r;
        g.gain.value = o.vol == null ? 1 : o.vol;
        var out = g;
        if (o.pan && c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); out = p; }
        s.connect(g); out.connect(o.dest || dest || c.destination);
        s.start(now + (o.at || 0));
        return true;
      } catch (e) { return false; }
    }
  };
})();
