/* RETRO WORLD shared sprite-effects player (explosions, fire, splashes).
   Sheets live in assets/fx/<name>.png as horizontal strips (see assets/fx/index.json):
     boom-small 32px×8 · boom-pop 48×8 · boom-spark 48×7 · boom-fire 64×8 · boom-cloud 80×48×12
     boom-burst 128×80×10 · boom-big 128×12 · boom-huge 192×22 · fireball 64×13 · flash-burst 48×17 · splash-water 64×7
   Usage in a canvas game:
     <script src="../../assets/rw-fx.js"></script>
     RWFX.preload(['boom-big','boom-small'])
     RWFX.spawn('boom-big', x, y, {size:140, fps:20, rot:0, alpha:1, below:false})  // world coords
     RWFX.update(dt)                       // seconds, once per frame (or pass nothing to use real time)
     RWFX.draw(ctx)                        // inside your world transform; RWFX.draw(ctx,{below:true}) for ground layer
     RWFX.ready('boom-big') -> true when the sheet has loaded (fall back to your own effect until then)
   Effects are drawn with imageSmoothing off so pixel art stays crisp. */
(function () {
  'use strict';
  if (window.RWFX) return;
  var cs = document.currentScript;
  var base = (cs && cs.src) ? cs.src.replace(/[^\/]*$/, '') + 'fx/' : 'assets/fx/';
  var META = {
    'boom-small': [32, 32, 8], 'boom-pop': [48, 48, 8], 'boom-spark': [48, 48, 7], 'boom-fire': [64, 64, 8],
    'boom-cloud': [80, 48, 12], 'boom-burst': [128, 80, 10], 'boom-big': [128, 128, 12], 'boom-huge': [192, 192, 22],
    'fireball': [64, 64, 13], 'flash-burst': [48, 48, 17], 'splash-water': [64, 64, 7]
  };
  var img = {}, list = [], last = 0, MAX = 160;
  function load(n) {
    if (img[n] || !META[n]) return img[n];
    var im = new Image(); im.decoding = 'async'; im.src = base + n + '.png'; img[n] = im; return im;
  }
  function ready(n) { var i = load(n); return !!(i && i.complete && i.naturalWidth); }
  function spawn(n, x, y, o) {
    o = o || {}; var m = META[n]; if (!m) return null; load(n);
    if (list.length >= MAX) list.shift();
    var e = { n: n, x: x, y: y, t: -(o.delay || 0), fps: o.fps || 18, size: o.size || m[0], rot: o.rot || 0,
      alpha: o.alpha == null ? 1 : o.alpha, below: !!o.below, flip: !!o.flip, vx: o.vx || 0, vy: o.vy || 0, blend: o.blend || '' };
    list.push(e); return e;
  }
  function update(dt) {
    if (dt == null) { var now = performance.now() / 1000; dt = last ? Math.min(0.1, now - last) : 0; last = now; }
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i]; e.t += dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.t * e.fps >= META[e.n][2]) list.splice(i, 1);
    }
  }
  function draw(ctx, o) {
    var below = !!(o && o.below);
    if (!list.length) return;
    var sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    for (var i = 0; i < list.length; i++) {
      var e = list[i]; if (e.below !== below || e.t < 0) continue;
      var m = META[e.n], im = img[e.n]; if (!im || !im.complete || !im.naturalWidth) continue;
      var f = Math.min(m[2] - 1, Math.floor(e.t * e.fps)), w = e.size, h = e.size * m[1] / m[0];
      ctx.save(); ctx.globalAlpha *= e.alpha; if (e.blend) ctx.globalCompositeOperation = e.blend;
      ctx.translate(e.x, e.y); if (e.rot) ctx.rotate(e.rot); if (e.flip) ctx.scale(-1, 1);
      ctx.drawImage(im, f * m[0], 0, m[0], m[1], -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = sm;
  }
  function clear() { list.length = 0; }
  window.RWFX = { base: base, meta: META, preload: function (a) { (a || Object.keys(META)).forEach(load); return this; },
    ready: ready, spawn: spawn, update: update, draw: draw, clear: clear, get count() { return list.length; } };
})();
