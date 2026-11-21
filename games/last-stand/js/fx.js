'use strict';
/* ===== effects: particles, shells, explosions, debris, lights, camera shake, hit-stop ===== */
if (window.RWFX) RWFX.preload(['real-explosion', 'smoke-wisp', 'hit-big', 'hit-white', 'blood-hit']);
const FXS = (n, x, y, o) => { if (window.RWFX && Save.d.settings.fx !== false && RWFX.count < 70) RWFX.spawn(n, x, y, o); };
const Cam = {
  x: 0, y: 0, tx: 0, shake: 0, sx: 0, sy: 0, lockL: null, lockR: null, zoomK: 0,
  add(v) { if (Save.d.settings.shake) this.shake = Math.min(28, this.shake + v); },
  update(dt, P) {
    const look = P.face * 120 + P.vx * .18;
    let tx = P.x + P.w / 2 - W / 2 + look, ty = clamp(P.y - H * .58, -60, ROWS * TS - H);
    const minX = this.lockL != null ? this.lockL : 0; let maxX = this.lockR != null ? this.lockR - W : World.W - W; if (this.zoneR != null) maxX = Math.min(maxX, this.zoneR - W);
    tx = clamp(tx, minX, Math.max(minX, maxX));
    if (G.maxCamX != null && this.lockL == null) tx = Math.max(tx, G.maxCamX - 340);
    this.x += (tx - this.x) * damp(this.lockL != null ? 3 : 5, dt); this.y += (ty - this.y) * damp(3.2, dt);
    this.x = clamp(this.x, minX, Math.max(minX, maxX));
    G.maxCamX = Math.max(G.maxCamX || 0, this.x);
    this.shake = Math.max(0, this.shake - dt * 46); const s = this.shake; this.sx = (Math.random() - .5) * s; this.sy = (Math.random() - .5) * s;
  }
};
const FX = {
  P: [], S: [], T: [], L: [], flashA: 0, flashC: '#fff', hs: 0,
  reset() { this.P = []; this.S = []; this.T = []; this.L = []; this.flashA = 0; this.hs = 0; if (window.RWFX) RWFX.clear(); },
  hitstop(t) { this.hs = Math.max(this.hs, t); },
  flash(a, c) { if (!Save.d.settings.fx) a *= .4; this.flashA = Math.max(this.flashA, a); this.flashC = c || '#fff'; },
  p(o) { if (this.P.length > 900) this.P.shift(); this.P.push(Object.assign({ vx: 0, vy: 0, g: 0, life: .5, t: 0, s: 3, s2: 0, c: '#fff', drag: 0, add: false, k: 'dot' }, o)); },
  light(x, y, r, c, life) { this.L.push({ x, y, r, c, life: life || .08, t: 0 }); },
  text(x, y, s, c, sz) { this.T.push({ x, y, s, c: c || '#fff', sz: sz || 16, t: 0, life: .9 }); },
  spark(x, y, c, n, sp) { if ((n || 6) <= 4) FXS('hit-white', x, y, { size: 24, fps: 42, rot: rnd(0, TAU) }); for (let i = 0; i < (n || 6); i++) { const a = rnd(0, TAU), v = rnd(80, sp || 380); this.p({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(.12, .3), s: rnd(1.5, 3), c: c || '#ffe9a0', add: true, drag: 3, k: 'line' }); } },
  smoke(x, y, n, c) { for (let i = 0; i < (n || 4); i++) this.p({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-30, 30), vy: rnd(-70, -20), life: rnd(.6, 1.3), s: rnd(8, 14), s2: rnd(24, 40), c: c || 'rgba(70,70,80,.45)', drag: 1.2 }); },
  fire(x, y, n) { for (let i = 0; i < (n || 4); i++) this.p({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-40, 40), vy: rnd(-140, -40), life: rnd(.25, .55), s: rnd(6, 12), s2: 2, c: pick(['#ffde5a', '#ff9a2a', '#ff5a1a']), add: true, drag: 1.5 }); },
  debris(x, y, c) { this.p({ x, y, vx: rnd(-260, 260), vy: rnd(-520, -160), g: 1400, life: rnd(.6, 1.2), s: rnd(3, 6), c: c || '#555', k: 'chunk', rot: rnd(0, TAU), vr: rnd(-12, 12), bounce: true }); },
  ink(x, y, dir, n, c) { if (c === '#7a0a14') FXS('blood-hit', x, y, { size: 46 + (n || 8) * 1.5, fps: 40, flip: dir < 0 }); else if ((n || 8) >= 10) FXS('hit-big', x, y - 6, { size: 70, fps: 34 }); for (let i = 0; i < (n || 8); i++) this.p({ x, y, vx: dir * rnd(60, 340) + rnd(-60, 60), vy: rnd(-320, 40), g: 1300, life: rnd(.4, .9), s: rnd(2, 4.5), c: c || '#0a0a0e', bounce: true, splat: true }); },
  shell(x, y, dir, big) { this.S.push({ x, y, vx: -dir * rnd(60, 140), vy: rnd(-300, -180), rot: 0, vr: rnd(-20, 20), t: 0, big, rest: 0 }); if (this.S.length > 80) this.S.shift(); },
  muzzle(x, y, a, c, big) { const n = big ? 7 : 4; for (let i = 0; i < n; i++) { const aa = a + rnd(-.35, .35), v = rnd(200, 600); this.p({ x, y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: rnd(.04, .09), s: rnd(3, 7), c: c || '#fff2a0', add: true, drag: 6 }); } this.light(x, y, big ? 150 : 90, c || '#ffd060', .06); this.P.push({ x, y, k: 'flash', a, t: 0, life: .045, s: big ? 26 : 16, c: c || '#fff6c0', add: true, vx: 0, vy: 0, g: 0, drag: 0 }); },
  explode(x, y, r, opt) {
    opt = opt || {}; const big = r > 90;
    if (window.RWFX && Save.d.settings.fx !== false) { if (r > 55) { RWFX.spawn('real-explosion', x, y - r * .3, { size: r * (big ? 3.3 : 2.9), fps: big ? 38 : 46 }); RWFX.spawn('smoke-wisp', x + rnd(-10, 10), y - r * .5, { size: r * (big ? 2.8 : 2.2), fps: 26, delay: big ? .35 : .25, alpha: .8, vy: -30 }); } else RWFX.spawn('hit-big', x, y, { size: r * 2.6, fps: 34 }); }
    Snd.play(big ? 'bigBoom' : 'boom', opt.vol || 1); Cam.add(big ? 18 : 10); if (!opt.noStop) this.hitstop(big ? .07 : .035); this.flash(big ? .35 : .18, '#fff3d0');
    this.P.push({ x, y, k: 'ring', t: 0, life: .35, s: 4, s2: r * 1.4, c: '#fff3c0', add: true, vx: 0, vy: 0, g: 0, drag: 0 });
    for (let i = 0; i < (big ? 26 : 14); i++) { const a = rnd(0, TAU), v = rnd(40, r * 3.2); this.p({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rnd(.25, .6), s: rnd(10, r * .32), s2: 2, c: pick(['#fff4a0', '#ffc040', '#ff7a1a', '#ff4a1a']), add: true, drag: 3.4 }); }
    for (let i = 0; i < (big ? 14 : 8); i++) { const a = rnd(0, TAU), v = rnd(30, r * 1.8); this.p({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: rnd(.8, 1.8), s: rnd(10, 18), s2: rnd(30, r * .7), c: 'rgba(40,36,40,.55)', drag: 2 }); }
    for (let i = 0; i < (big ? 12 : 6); i++) this.debris(x, y, pick(['#3a3a40', '#222', '#6a5a4a']));
    this.spark(x, y, '#ffd060', big ? 16 : 8, 700);
    this.light(x, y, r * 3.2, '#ff9a40', .35);
  },
  update(dt) {
    for (const p of this.P) {
      p.t += dt; if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt;
      if (p.bounce && p.vy > 0 && World.solidPx(p.x, p.y + 2)) { if (p.splat) { p.vx = 0; p.vy = 0; p.g = 0; p.k = 'splat'; p.life = Math.max(p.life, p.t + 2.5); p.bounce = false; } else { p.vy *= -.35; p.vx *= .6; p.y -= 2; if (Math.abs(p.vy) < 40) { p.vy = 0; p.g = 0; p.vx = 0; p.bounce = false; } } }
    }
    this.P = this.P.filter(p => p.t < p.life);
    for (const s of this.S) { s.t += dt; if (s.rest) continue; s.vy += 1500 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; if (s.vy > 0 && World.solidPx(s.x, s.y + 2)) { s.vy *= -.4; s.vx *= .5; s.vr *= .5; if (Math.abs(s.vy) < 60) s.rest = 1; else if (Math.random() < .5) Snd.play('bounce', .3); } }
    this.S = this.S.filter(s => s.t < 3);
    for (const t of this.T) { t.t += dt; t.y -= 40 * dt; } this.T = this.T.filter(t => t.t < t.life);
    for (const l of this.L) l.t += dt; this.L = this.L.filter(l => l.t < l.life);
    this.flashA = Math.max(0, this.flashA - dt * 3);
    if (window.RWFX) RWFX.update(dt);
  },
  draw(g) {
    for (const s of this.S) { g.save(); g.translate(s.x, s.y); g.rotate(s.rot); g.globalAlpha = Math.min(1, (3 - s.t) * 2); g.fillStyle = s.big ? '#c84a2a' : '#e8b83a'; g.fillRect(-3, -1.3, s.big ? 8 : 6, s.big ? 3.4 : 2.6); g.restore(); }
    g.globalAlpha = 1;
    for (const p of this.P) {
      const u = p.t / p.life, a = 1 - u; g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      if (p.k === 'line') { g.strokeStyle = p.c; g.globalAlpha = a; g.lineWidth = p.s; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); g.stroke(); }
      else if (p.k === 'ring') { g.strokeStyle = p.c; g.globalAlpha = a * .8; g.lineWidth = 6 * a + 1; g.beginPath(); g.arc(p.x, p.y, lerp(p.s, p.s2, Math.sqrt(u)), 0, TAU); g.stroke(); }
      else if (p.k === 'flash') { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = a; g.fillStyle = p.c; g.beginPath(); g.moveTo(0, -p.s * .35); g.lineTo(p.s * 1.6, 0); g.lineTo(0, p.s * .35); g.lineTo(-p.s * .2, 0); g.fill(); g.beginPath(); g.arc(0, 0, p.s * .45, 0, TAU); g.fill(); g.restore(); }
      else if (p.k === 'chunk') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, a * 2); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .7); g.restore(); }
      else if (p.k === 'splat') { g.globalAlpha = Math.min(1, a * 3) * .9; g.fillStyle = p.c; g.beginPath(); g.ellipse(p.x, p.y, p.s * 1.6, p.s * .45, 0, 0, TAU); g.fill(); }
      else { const s = p.s2 ? lerp(p.s, p.s2, u) : p.s; g.globalAlpha = p.add ? a : a * .9; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, Math.max(.5, s), 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (window.RWFX) RWFX.draw(g);
  },
  drawLights(g) {
    g.globalCompositeOperation = 'lighter';
    for (const l of this.L) { const a = 1 - l.t / l.life, gr = g.createRadialGradient(l.x, l.y, 1, l.x, l.y, l.r); gr.addColorStop(0, l.c + Math.floor(clamp(a * .55, 0, 1) * 255).toString(16).padStart(2, '0')); gr.addColorStop(1, l.c + '00'); g.fillStyle = gr; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
    g.globalCompositeOperation = 'source-over';
  },
  drawText(g) { g.textAlign = 'center'; for (const t of this.T) { const a = 1 - t.t / t.life; g.globalAlpha = Math.min(1, a * 2); g.font = '900 ' + t.sz + 'px Impact, "Arial Black", sans-serif'; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(t.s, t.x, t.y); g.fillStyle = t.c; g.fillText(t.s, t.x, t.y); } g.globalAlpha = 1; }
};
