'use strict';
/* ===== SHADOW PROTOCOL :: story — intro video + comic-book story =====
   Every panel is drawn procedurally on a canvas in the game's noir stickman style.
   Prologue (first launch / STORY menu), one briefing panel before each mission, epilogue after the finale. */
const HERO = { col: '#f2f4f7', visor: '#4fe3ff' }, FOE = { col: '#c22f3d', visor: '#ffd0d4' };
const Art = {
  sky(c, W, H, a, b) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); },
  skyline(c, W, base, seed, col, win, hMin = 30, hMax = 120) { const r = RNG(seed); for (let x = -10; x < W;) { const w = 22 + r() * 46, h = hMin + r() * (hMax - hMin); c.fillStyle = col; c.fillRect(x, base - h, w, h + 400); if (win) for (let wy = base - h + 6; wy < base - 4; wy += 9) for (let wx = x + 4; wx < x + w - 5; wx += 8) if (r() < .3) { c.fillStyle = win; c.globalAlpha = .25 + r() * .6; c.fillRect(wx, wy, 3.5, 4.5); c.globalAlpha = 1; } x += w + 2; } },
  rain(c, W, H, seed, a = .22) { const r = RNG(seed); c.strokeStyle = `rgba(190,215,255,${a})`; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < W * H / 900; i++) { const x = r() * W, y = r() * H, l = 8 + r() * 16; c.moveTo(x, y); c.lineTo(x - l * .3, y + l); } c.stroke(); },
  glow(c, x, y, r, col) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); },
  flash(c, x, y, s, a = 0) { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = '#fff3c4'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .35 : s * (i === 0 ? 1.7 : 1), t = i / 10 * TAU; c.lineTo(Math.cos(t) * r, Math.sin(t) * r); } c.fill(); c.restore(); Art.glow(c, x, y, s * 4, 'rgba(255,210,120,.35)'); },
  sfx(c, t, x, y, size, col = '#ffd23d', rot = -.12) { c.save(); c.translate(x, y); c.rotate(rot); c.font = `italic 900 ${size}px Impact, 'Arial Black', sans-serif`; c.textAlign = 'center'; c.lineWidth = size * .16; c.strokeStyle = '#000'; c.lineJoin = 'round'; c.strokeText(t, 0, 0); c.fillStyle = col; c.fillText(t, 0, 0); c.restore(); },
  speed(c, x, y, a, n, len, seed) { const r = RNG(seed); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < n; i++) { const o = (r() - .5) * 70, s = r() * 30, l = len * (.4 + r() * .6); const px = x - Math.sin(a) * o - Math.cos(a) * s, py = y + Math.cos(a) * o - Math.sin(a) * s; c.moveTo(px, py); c.lineTo(px - Math.cos(a) * l, py - Math.sin(a) * l); } c.stroke(); },
  shards(c, x, y, n, rad, seed) { const r = RNG(seed); for (let i = 0; i < n; i++) { const a = r() * TAU, d = r() * rad, s = 3 + r() * 9; c.save(); c.translate(x + Math.cos(a) * d, y + Math.sin(a) * d); c.rotate(r() * 6); c.fillStyle = `rgba(190,235,255,${.3 + r() * .5})`; c.beginPath(); c.moveTo(-s, 0); c.lineTo(s * .7, -s * .5); c.lineTo(s * .2, s * .7); c.fill(); c.restore(); } },
  tracer(c, x0, y0, x1, y1, col = '#fff') { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, col); c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); },
  // side-view articulated stickman. y = ground under the hips. angles: 0 = straight down, PI/2 = forward
  fig(c, x, y, s, p = {}, who = HERO) {
    const f = p.f || 1, lean = (p.lean || 0) * f, L = 11 * s, col = p.col || who.col;
    c.save(); if (p.rot) { c.translate(x, y); c.rotate(p.rot); c.translate(-x, -y); }
    const hip = { x, y: y - (p.crouch ? 13 : 21) * s }, sh = { x: hip.x + Math.sin(lean) * 19 * s, y: hip.y - Math.cos(lean) * 19 * s }, hd = { x: sh.x + Math.sin(lean) * 8 * s, y: sh.y - Math.cos(lean) * 8 * s };
    c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
    const limb = (j, a1, a2, l) => { const m = { x: j.x + Math.sin(a1) * l * f, y: j.y + Math.cos(a1) * l }, e = { x: m.x + Math.sin(a2) * l * f, y: m.y + Math.cos(a2) * l }; c.beginPath(); c.moveTo(j.x, j.y); c.lineTo(m.x, m.y); c.lineTo(e.x, e.y); c.stroke(); return e; };
    c.lineWidth = 3.3 * s; const lg = p.legs || [.28, .08, -.3, -.06]; limb(hip, lg[0], lg[1], L); limb(hip, lg[2], lg[3], L);
    c.lineWidth = 4.2 * s; c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(sh.x, sh.y); c.stroke();
    c.lineWidth = 2.9 * s; const ar = p.arms || [.3, .25, -.3, -.1]; limb(sh, ar[2], ar[3], L * .9); const h = limb(sh, ar[0], ar[1], L * .9);
    c.beginPath(); c.arc(hd.x, hd.y, 6.6 * s, 0, TAU); c.fill();
    if (who.visor && !p.noVisor) { c.strokeStyle = who.visor; c.lineWidth = 2.2 * s; c.beginPath(); const va = f > 0 ? 0 : Math.PI; c.arc(hd.x, hd.y, 5 * s, va - .75, va + .75); c.stroke(); }
    if (p.tie) { c.strokeStyle = p.tie; c.lineWidth = 2.4 * s; c.beginPath(); c.moveTo(sh.x, sh.y + 1); c.lineTo(sh.x + f * 1.5 * s, sh.y + 11 * s); c.stroke(); }
    let tip = h; if (p.gun) { const ga = p.gunA || 0; tip = { x: h.x + f * Math.cos(ga) * p.gun * s, y: h.y - Math.sin(ga) * p.gun * s }; c.strokeStyle = p.gunCol || '#9aa1ab'; c.lineWidth = 3.2 * s; c.lineCap = 'butt'; c.beginPath(); c.moveTo(h.x - f * 2 * s, h.y); c.lineTo(tip.x, tip.y); c.stroke(); }
    c.restore(); return tip;
  },
  floor(c, W, H, y, col = '#0c0d10') { c.fillStyle = col; c.fillRect(0, y, W, H - y); c.strokeStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(0, y + .5); c.lineTo(W, y + .5); c.stroke(); },
  vignette(c, W, H) { const g = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
};
const AIM = [1.55, 1.6, 1.25, 1.8], RUN = [.9, -.5, -.9, .3];

/* ---------------- panel scenes ---------------- */
const Scene = {
  city(c, W, H) { Art.sky(c, W, H, '#05070d', '#161c2c'); c.fillStyle = '#e8ecf5'; c.globalAlpha = .9; c.beginPath(); c.arc(W * .82, H * .24, 26, 0, TAU); c.fill(); c.globalAlpha = 1; Art.glow(c, W * .82, H * .24, 120, 'rgba(160,190,255,.18)'); Art.skyline(c, W, H * .78, 7, '#0d1018', 'rgba(255,220,150,1)', 40, 110); Art.skyline(c, W, H + 10, 3, '#050608', 'rgba(120,200,255,1)', 50, 150); c.fillStyle = '#050608'; c.fillRect(W * .44, H * .1, 46, H); c.fillStyle = '#ff2d3d'; c.fillRect(W * .44 + 6, H * .1 + 8, 34, 5); Art.glow(c, W * .44 + 23, H * .1 + 10, 70, 'rgba(255,45,61,.35)'); Art.rain(c, W, H, 5); Art.vignette(c, W, H); },
  lineup(c, W, H) { Art.sky(c, W, H, '#0b0c10', '#16181e'); Art.floor(c, W, H, H * .82); for (let i = 0; i < 9; i++) { const x = 30 + i * (W - 60) / 8, me = i === 5; if (me) Art.glow(c, x, H * .5, 90, 'rgba(79,227,255,.2)'); Art.fig(c, x, H * .82, 1.35, { arms: [.3, .1, -.3, -.1], legs: [.24, 0, -.24, 0], noVisor: !me, col: me ? '#f2f4f7' : '#3a3e47' }, HERO); } c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '700 11px Segoe UI'; c.fillText('07', 30 + 5 * (W - 60) / 8 - 6, H * .82 + 16); Art.vignette(c, W, H); },
  director(c, W, H) { Art.sky(c, W, H, '#3a090f', '#a01c2a'); Art.skyline(c, W, H * .9, 11, '#2a060c', 'rgba(255,120,110,1)', 30, 90); c.strokeStyle = '#050305'; c.lineWidth = 7; for (let x = 0; x <= W; x += W / 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } c.beginPath(); c.moveTo(0, H * .42); c.lineTo(W, H * .42); c.stroke(); Art.floor(c, W, H, H * .86, '#050305'); Art.fig(c, W * .62, H * .86, 1.9, { f: -1, col: '#050305', arms: [.1, -.5, -.2, -.3], legs: [.15, 0, -.15, 0], noVisor: true, tie: '#ff2d3d' }); c.fillStyle = '#050305'; c.fillRect(W * .08, H * .7, W * .36, 12); c.fillRect(W * .12, H * .7, 8, H); c.fillRect(W * .38, H * .7, 8, H); Art.vignette(c, W, H); },
  purge(c, W, H) { Art.sky(c, W, H, '#07080b', '#101218'); Art.floor(c, W, H, H * .84); Art.fig(c, W * .13, H * .84, 1.3, { arms: AIM, gun: 12 }, FOE); Art.fig(c, W * .22, H * .84, 1.3, { arms: AIM, gun: 16, crouch: true, legs: [1.2, -.3, -.8, 1.2] }, FOE); Art.flash(c, W * .13 + 46, H * .84 - 53, 13); Art.flash(c, W * .22 + 52, H * .84 - 42, 11); for (const x of [.34, .43]) Art.fig(c, W * x, H * .84 - 4, 1.2, { rot: 1.45, col: '#3a3e47', noVisor: true, arms: [.9, .4, -1.2, -.6], legs: [.4, .3, -.2, .5] }); c.fillStyle = 'rgba(140,220,255,.12)'; c.fillRect(W * .6, 0, 10, H * .84); Art.shards(c, W * .64, H * .45, 34, 90, 9); Art.speed(c, W * .78, H * .42, -.25, 16, 110, 4); Art.fig(c, W * .78, H * .56, 1.4, { rot: -1.1, arms: [2.4, 2.6, 2.0, 2.9], legs: [.5, .2, -.1, .5], gun: 11, f: -1 }); Art.tracer(c, W * .3, H * .5, W * .7, H * .38, '#ffb3a8'); Art.tracer(c, W * .28, H * .6, W * .72, H * .62, '#ffb3a8'); Art.sfx(c, 'BLAM!', W * .19, H * .5, 38, '#ff2d3d'); Art.sfx(c, 'KRASH!', W * .66, H * .2, 30, '#bfeaff', .1); Art.vignette(c, W, H); },
  rooftop(c, W, H) { Art.sky(c, W, H, '#04060c', '#141a2a'); Art.skyline(c, W, H * .86, 21, '#0a0d15', 'rgba(255,220,150,1)', 30, 80); c.fillStyle = '#030406'; c.fillRect(W * .66, H * .08, 60, H); for (let y = H * .14; y < H; y += 12) { c.fillStyle = 'rgba(255,45,61,.5)'; c.fillRect(W * .66 + 6, y, 48, 2); } Art.glow(c, W * .66 + 30, H * .1, 110, 'rgba(255,45,61,.3)'); c.fillStyle = '#020203'; c.fillRect(0, H * .8, W * .5, H); c.fillRect(W * .46, H * .74, 8, H * .1); Art.fig(c, W * .26, H * .8, 1.7, { arms: [.15, .1, -.2, -.1], legs: [.2, 0, -.2, 0], gun: 10, gunA: -1.4 }); Art.rain(c, W, H, 12); Art.vignette(c, W, H); },
  title(c, W, H) { Art.sky(c, W, H, '#020203', '#0c0d12'); Art.glow(c, W * .22, H * .5, 220, 'rgba(79,227,255,.16)'); Art.fig(c, W * .2, H * 1.25, 4.6, { arms: [1.5, 1.7, 1.2, 1.9], gun: 13, lean: .06 }); Art.sfx(c, 'SHADOW PROTOCOL', W * .62, H * .2, Math.min(54, W * .068), '#fff', -.04); c.fillStyle = '#ff2d3d'; c.save(); c.translate(W * .62, H * .27); c.rotate(-.04); c.fillRect(-W * .3, 0, W * .6, 4); c.restore(); Art.vignette(c, W, H); },
  // --- mission briefing scenes ---
  door(c, W, H, t) { Art.sky(c, W, H, '#07080b', '#12141a'); Art.floor(c, W, H, H * .84); c.fillStyle = '#030304'; c.fillRect(W * .36, 0, 16, H * .84); c.fillStyle = t.neon; c.globalAlpha = .12; c.beginPath(); c.moveTo(W * .37, H * .3); c.lineTo(W, H * .1); c.lineTo(W, H * .84); c.lineTo(W * .37, H * .84); c.fill(); c.globalAlpha = 1; c.save(); c.translate(W * .44, H * .52); c.rotate(.5); c.fillStyle = '#5a4632'; c.fillRect(-6, -60, 12, 120); c.restore(); Art.speed(c, W * .3, H * .6, 0, 12, 90, 2); Art.fig(c, W * .28, H * .84, 1.6, { arms: AIM, gun: 13, legs: [1.3, -.2, -.5, .6], lean: .25 }); for (const [x, s] of [[.62, 1.25], [.74, 1.15], [.86, 1.3]]) Art.fig(c, W * x, H * .84, s, { f: -1, arms: [.6, 1.2, .3, .9], gun: 12, gunA: -.5 }, FOE); for (const x of [.56, .7]) { c.fillStyle = '#1e1a16'; c.fillRect(W * x, H * .72, 54, 9); c.fillRect(W * x + 4, H * .72, 5, H * .12); c.fillRect(W * x + 45, H * .72, 5, H * .12); } Art.sfx(c, 'KRAK!', W * .46, H * .22, 34); Art.vignette(c, W, H); },
  dark(c, W, H, t) { c.fillStyle = '#020203'; c.fillRect(0, 0, W, H); Art.floor(c, W, H, H * .84, '#040405'); Art.glow(c, W * .24, H * .55, 170, 'rgba(79,227,255,.14)'); Art.fig(c, W * .22, H * .84, 1.6, { arms: AIM, gun: 13, crouch: true, legs: [1.1, -.3, -.7, 1.1] }); const r = RNG(31); for (let i = 0; i < 6; i++) { const x = W * (.5 + r() * .46), y = H * (.38 + r() * .3); c.fillStyle = '#ff2d3d'; c.fillRect(x, y, 7, 2.5); Art.glow(c, x + 3, y + 1, 26, 'rgba(255,45,61,.4)'); } c.strokeStyle = t.light[0]; c.globalAlpha = .5; c.lineWidth = 3; c.beginPath(); c.moveTo(W * .58, 6); c.lineTo(W * .66, 6); c.stroke(); c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 5; i++) c.fillRect(W * .6 + i * 5, 12 + i * 9, 2, 5); Art.vignette(c, W, H); },
  crates(c, W, H, t) { Art.sky(c, W, H, '#0b0906', '#1a1611'); Art.floor(c, W, H, H * .84, '#0b0906'); Art.glow(c, W * .5, 0, 260, 'rgba(255,190,100,.14)'); const box = (x, y, s) => { c.fillStyle = '#3d2f1e'; c.fillRect(x, y, s, s); c.strokeStyle = '#1b140c'; c.lineWidth = 2; c.strokeRect(x, y, s, s); c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s); c.moveTo(x + s, y); c.lineTo(x, y + s); c.stroke(); }; box(W * .55, H * .84 - 46, 46); box(W * .55 + 48, H * .84 - 46, 46); box(W * .55 + 22, H * .84 - 92, 46); c.fillStyle = '#7d1c17'; c.fillRect(W * .84, H * .84 - 44, 30, 44); c.fillStyle = '#ffd23d'; c.fillRect(W * .84, H * .84 - 28, 30, 5); Art.speed(c, W * .16, H * .78, 0, 14, 100, 6); Art.fig(c, W * .3, H * .84 + 4, 1.6, { rot: -1.25, arms: [2.9, 3.0, 2.5, 3.2], legs: [.1, .1, .7, -1.2], gun: 13, gunA: 1.25 }); Art.tracer(c, W * .36, H * .66, W * .86, H * .7); Art.fig(c, W * .72, H * .84 - 92, 1.2, { f: -1, arms: AIM, gun: 15, crouch: true, legs: [1.1, -.3, -.7, 1.1] }, FOE); Art.sfx(c, 'SSSHK', W * .22, H * .3, 28, '#fff'); Art.vignette(c, W, H); },
  roof(c, W, H) { Art.sky(c, W, H, '#04060c', '#161d30'); Art.skyline(c, W, H * .95, 33, '#080b12', 'rgba(255,220,150,1)', 20, 70); c.fillStyle = '#020203'; c.fillRect(0, H * .62, W * .34, H); c.fillRect(W * .62, H * .7, W, H); Art.speed(c, W * .46, H * .4, -.2, 14, 90, 8); Art.fig(c, W * .48, H * .52, 1.6, { rot: -.5, arms: [1.9, 1.7, 1.2, 2.2], legs: [1.3, .2, -1.0, -1.4], gun: 12 }); Art.fig(c, W * .86, H * .7, 1.25, { f: -1, arms: AIM, gun: 26, crouch: true, legs: [1.1, -.3, -.7, 1.1] }, FOE); c.strokeStyle = 'rgba(255,45,61,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W * .8, H * .7 - 37); c.lineTo(W * .1, H * .25); c.stroke(); Art.rain(c, W, H, 14, .15); Art.vignette(c, W, H); },
  boss(c, W, H) { Art.sky(c, W, H, '#150306', '#30080f'); Art.skyline(c, W, H * .88, 41, '#0c0206', 'rgba(255,140,120,1)', 20, 70); c.strokeStyle = '#050203'; c.lineWidth = 8; for (let x = 0; x <= W; x += W / 5) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H * .84); c.stroke(); } Art.floor(c, W, H, H * .84, '#060203'); Art.fig(c, W * .24, H * .84, 1.7, { arms: AIM, gun: 13 }); Art.fig(c, W * .76, H * .84, 2.0, { f: -1, col: '#f2f2f2', arms: [1.5, 1.6, .2, .1], gun: 12, gunCol: '#c9a13c', tie: '#ff0f25' }, { col: '#f2f2f2', visor: '#ff0f25' }); Art.glow(c, W * .76, H * .5, 150, 'rgba(255,45,61,.18)'); Art.vignette(c, W, H); },
  // --- epilogue ---
  fall(c, W, H) { Art.sky(c, W, H, '#0a0406', '#1c0a0e'); Art.floor(c, W, H, H * .84, '#060203'); Art.shards(c, W * .5, H * .7, 30, 150, 3); Art.fig(c, W * .42, H * .84 - 4, 1.8, { rot: 1.5, col: '#b9bbc0', noVisor: true, tie: '#ff0f25', arms: [1.0, .5, -1.3, -.4], legs: [.4, .3, -.2, .6] }); Art.fig(c, W * .14, H * .84, 1.6, { arms: [.2, .1, -.2, -.1], gun: 11, gunA: -1.4, legs: [.2, 0, -.2, 0] }); Art.vignette(c, W, H); },
  dawn(c, W, H) { Art.sky(c, W, H, '#1b2440', '#ff9a5a'); c.fillStyle = '#ffe2b0'; c.beginPath(); c.arc(W * .7, H * .48, 30, 0, TAU); c.fill(); Art.glow(c, W * .7, H * .48, 220, 'rgba(255,200,130,.4)'); Art.skyline(c, W, H * .86, 7, '#12121c', null, 30, 110); c.fillStyle = '#0a0a10'; c.fillRect(W * .44, H * .12, 46, H); Art.vignette(c, W, H); },
  walk(c, W, H) { Art.sky(c, W, H, '#232c48', '#ffb074'); Art.skyline(c, W, H * .8, 51, '#141420', null, 20, 60); Art.floor(c, W, H, H * .84, '#0c0c12'); c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(W * .72, H * .86, 70, 6, 0, 0, TAU); c.fill(); Art.fig(c, W * .7, H * .84, 2.0, { arms: [.5, .2, -.5, -.2], legs: [.5, .1, -.5, .3], lean: .05 }); Art.vignette(c, W, H); }
};

/* ---------------- script ---------------- */
const PROLOGUE = [
  [{ s: 'city', span: 6, h: 250, cap: [['tl', 'New Meridian. A city owned floor by floor by people you will never see.'], ['br', 'They call themselves the Syndicate.']] },
   { s: 'lineup', span: 3, h: 230, cap: [['tl', 'They built us to keep it that way. Twelve operatives. No names. No records.'], ['br', 'I was number seven.']] },
   { s: 'director', span: 3, h: 230, cap: [['tl', 'Then the Director decided we knew too much.']], say: ['Activate the Shadow Protocol.', 'r'] }],
  [{ s: 'purge', span: 6, h: 260, cap: [['tl', 'One night. Eleven operatives erased by their own handlers.'], ['br', 'They missed one.']] },
   { s: 'rooftop', span: 3, h: 230, cap: [['tl', 'The protocol says every trace gets deleted.'], ['br', 'Fine. I will start at the bottom and delete my way up.']] },
   { s: 'title', span: 3, h: 230, cap: [['br', 'Ten floors of hired guns between me and the Director.']], say: ['Time to clock in.', 'm'] }]
];
const BRIEF_LINES = ['They trained me on this floor. Tonight it trains them.', 'Accounting. Legal. Human Resources. Every desk signed off on the purge.', 'Under the tower they keep what they do not want found. Including the lights.', 'The shipments that paid for all of it — and the crews that guard them.', 'The fast way up is outside. Forty stories of wet concrete and long sightlines.', 'The executive floor. The Syndicate sends its heavy hitters.', 'The research wing. Where they built the protocol — and the agents meant to replace us.', 'They have locked the tower down. My ride needs two minutes. They need me dead in one.', 'The inner circle. The best killers money ever bought, all in one room.', 'The Director wrote the Shadow Protocol. Time to enforce it.'];
const BRIEF_SAY = ['Knock knock.', null, 'Lights out.', null, null, 'Big guns. Bigger targets.', null, 'Two minutes. Easy.', null, 'You missed one.'];
const BRIEF_SCENE = { training: 'door', office: 'door', bunker: 'dark', lab: 'dark', warehouse: 'crates', parking: 'crates', roof: 'roof', penthouse: 'door' };
function briefing(i) { const m = MISSIONS[i]; return [[{ s: m.boss ? 'boss' : BRIEF_SCENE[m.theme], span: 6, h: 380, theme: THEMES[m.theme], cap: [['tl', `Mission ${i + 1} — ${m.name}`], ['br', BRIEF_LINES[i]]], say: BRIEF_SAY[i] ? [BRIEF_SAY[i], 'l'] : null }]]; }
const ENDING = [[
  { s: 'fall', span: 3, h: 240, cap: [['tl', 'The Director built a protocol to erase every trace of us.'], ['br', 'It worked. There is no trace of him left either.']] },
  { s: 'dawn', span: 3, h: 240, cap: [['tl', 'By sunrise the tower was just another dark building.']] },
  { s: 'walk', span: 6, h: 260, cap: [['tl', 'Twelve operatives. No names. No records.'], ['br', 'Just one shadow, walking away. Protocol complete.']] }]];

/* ---------------- comic reader ---------------- */
const Story = {
  el: null, pages: null, pi: 0, shown: 0, done: null, prev: 'menu', active: false,
  show(pages, done) { this.pages = pages; this.pi = 0; this.done = done; this.prev = G.state; G.state = 'story'; this.active = true; this.el.className = 'on'; document.body.classList.remove('playing'); this.page(); },
  page() {
    const pg = this.pages[this.pi]; this.shown = 0;
    this.el.innerHTML = `<div class="page">${pg.map((p, i) => `<div class="panel" style="grid-column:span ${p.span};aspect-ratio:${180 * p.span}/${p.h};--r:${((i * 37 % 5) - 2) * .25}deg"><canvas width="${180 * p.span}" height="${p.h}"></canvas>${(p.cap || []).map(c => `<div class="cap ${c[0]}">${c[1]}</div>`).join('')}${p.say ? `<div class="say ${p.say[1]}">${p.say[0]}</div>` : ''}</div>`).join('')}</div><div class="shint">CLICK / SPACE — NEXT &nbsp;·&nbsp; ESC — SKIP</div>`;
    this.el.querySelectorAll('canvas').forEach((cv, i) => { const p = pg[i], c = cv.getContext('2d'); try { Scene[p.s](c, cv.width, cv.height, p.theme || THEMES.office); } catch (e) { console.error(e); } });
    this.next();
  },
  next() {
    if (!this.active) return; const panels = this.el.querySelectorAll('.panel');
    if (this.shown < panels.length) { panels[this.shown++].classList.add('show'); Snd.play(this.shown === 1 ? 'big' : 'note'); return; }
    if (++this.pi < this.pages.length) this.page(); else this.finish();
  },
  finish() { if (!this.active) return; this.active = false; this.el.className = ''; this.el.innerHTML = ''; if (G.state === 'story') G.state = this.prev; const d = this.done; this.done = null; if (d) d(); },
  init() {
    this.el = document.getElementById('story');
    this.el.addEventListener('click', () => this.next());
    addEventListener('keydown', e => { if (!this.active) return; if (e.code === 'Escape') { e.stopImmediatePropagation(); this.finish(); } else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.next(); } }, true);
  }
};

/* ---------------- intro video ---------------- */
const Intro = {
  el: null, vid: null, playing: false, done: null, t0: 0,
  // browsers only allow sound after a click, so the very first launch shows a "click to begin" splash
  start(done, needGesture) {
    this.done = done; this.el = document.getElementById('intro'); this.vid = this.el.querySelector('video'); G.state = 'intro'; document.body.classList.remove('playing');
    this.el.className = 'on' + (needGesture ? ' wait' : '');
    if (!needGesture) this.play();
  },
  play() {
    if (this.playing) return; this.playing = true; this.t0 = performance.now(); this.el.className = 'on'; Snd.init();
    const v = this.vid; v.currentTime = 0; v.volume = clamp(Save.data.settings.vol, 0, 1); v.onended = () => this.end(); v.onerror = () => this.end();
    const p = v.play(); if (p && p.catch) p.catch(() => this.end());
  },
  end() { if (!this.el || this.el.className === '') return; this.playing = false; try { this.vid.pause(); } catch (e) { } this.el.className = ''; const d = this.done; this.done = null; if (d) d(); },
  init() {
    const el = document.getElementById('intro');
    el.addEventListener('click', () => { if (!this.playing) this.play(); else if (performance.now() - this.t0 > 600) this.end(); });
    addEventListener('keydown', e => { if (G.state !== 'intro') return; if (!this.playing) this.play(); else if (performance.now() - this.t0 > 600 && ['Escape', 'Space', 'Enter'].includes(e.code)) this.end(); });
  }
};
