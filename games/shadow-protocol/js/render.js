'use strict';
/* ===== SHADOW PROTOCOL :: render — cinematic camera, world, dynamic lighting, post FX, HUD ===== */
const Cam = {
  x: 0, y: 0, zoom: 1, trauma: 0, kx: 0, ky: 0, sx: 0, sy: 0,
  addShake(a) { if (Save.data.settings.shake) this.trauma = Math.min(1, this.trauma + a); },
  kick(cx, cy, a) { if (Save.data.settings.shake) { this.kx -= cx * a; this.ky -= cy * a; } },
  update(rdt) {
    const S = View.S, look = P.focus ? .34 : .17;
    let tx = P.x + (Input.mx - View.w / 2) / S * look, ty = P.y + (Input.my - View.h / 2) / S * look;
    if (G.ws < .7) { tx += Math.sin(G.rt * .8) * 7; ty += Math.cos(G.rt * .6) * 5; } // slow drifting camera in slow motion
    if (P.state === 'takedown' && P.tk) { tx = (P.x + P.tk.x) / 2; ty = (P.y + P.tk.y) / 2; }
    // keep the view inside the building so half the screen is never empty void
    const hw = View.w / S / 2, hh = View.h / S / 2, mw = World.W * TS, mh = World.H * TS;
    tx = mw > hw * 2 ? clamp(tx, hw - 60, mw - hw + 60) : mw / 2; ty = mh > hh * 2 ? clamp(ty, hh - 60, mh - hh + 60) : mh / 2;
    const k = damp(7, rdt); this.x = lerp(this.x, tx, k); this.y = lerp(this.y, ty, k);
    // zoom states blend smoothly: combat tightens, crowds widen, takedowns punch in
    let near = 0, alert = 0; for (const e of Enemies) if (e.alive) { if (e.alert) alert++; if (e.alert && e.dP < 520) near++; }
    let z = 1; if (alert) z = 1.06; if (near >= 4) z = .9; if (G.bt) z += .05; if (P.state === 'dive' || P.state === 'jump') z += .06; if (P.focus) z += .06;
    if (P.state === 'takedown') z = 1.38; if (P.de.mode) z = 1.12; if (!P.alive) z = 1.25;
    this.zoom = lerp(this.zoom, z, damp(P.state === 'takedown' ? 9 : 2.5, rdt));
    this.trauma = Math.max(0, this.trauma - rdt * 1.7); const t = this.trauma * this.trauma, r = G.rt * 47;
    this.sx = (Math.sin(r) + Math.sin(r * 1.7 + 1)) * 5 * t + this.kx; this.sy = (Math.cos(r * 1.3) + Math.sin(r * 2.1 + 2)) * 5 * t + this.ky;
    const kd = damp(14, rdt); this.kx = lerp(this.kx, 0, kd); this.ky = lerp(this.ky, 0, kd);
  }
};
const View = { c: null, x: null, w: 0, h: 0, S: 1, L: null, lx: null, F: null, fx: null };
function initView(canvas) {
  View.c = canvas; View.x = canvas.getContext('2d');
  View.L = document.createElement('canvas'); View.lx = View.L.getContext('2d'); View.F = document.createElement('canvas'); View.fx = View.F.getContext('2d');
  const rs = () => { View.w = canvas.width = innerWidth; View.h = canvas.height = innerHeight; View.L.width = View.F.width = Math.ceil(View.w / 2); View.L.height = View.F.height = Math.ceil(View.h / 2); };
  addEventListener('resize', rs); rs();
}
const viewScale = () => Math.min(View.h / 580, View.w / 880) * Cam.zoom;

function drawProp(x, p) {
  const dmg = 1 - clamp(p.hp / p.maxHp, 0, 1);
  if (p.type === 'barrel') {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = p.w / 2;
    x.fillStyle = '#7d1c17'; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); x.strokeStyle = '#d6342b'; x.lineWidth = 2; x.stroke();
    x.strokeStyle = '#ffd23d'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, r * .55, 0, TAU); x.stroke(); x.fillStyle = '#ffd23d'; x.fillRect(cx - 1, cy - 4, 2, 5); x.fillRect(cx - 1, cy + 2.5, 2, 2); return;
  }
  if (p.type === 'fuse') { x.fillStyle = '#3d3a1c'; x.fillRect(p.x, p.y, p.w, p.h); x.strokeStyle = '#ffd23d'; x.lineWidth = 1.5; x.strokeRect(p.x, p.y, p.w, p.h); x.beginPath(); x.moveTo(p.x + 9, p.y + 2); x.lineTo(p.x + 5, p.y + 8); x.lineTo(p.x + 9, p.y + 8); x.lineTo(p.x + 5, p.y + 13); x.stroke(); return; }
  if (p.type === 'car') {
    x.fillStyle = p.seed < .33 ? '#252a33' : p.seed < .66 ? '#33262a' : '#2b2f2b'; rr(x, p.x, p.y, p.w, p.h, 14); x.fill(); x.strokeStyle = '#4d5560'; x.lineWidth = 1.5; x.stroke();
    x.fillStyle = 'rgba(130,200,240,.22)'; rr(x, p.x + p.w * .22, p.y + 7, p.w * .16, p.h - 14, 4); x.fill(); rr(x, p.x + p.w * .66, p.y + 7, p.w * .13, p.h - 14, 4); x.fill();
    x.fillStyle = '#ffe9a8'; x.fillRect(p.x + 2, p.y + 8, 3, 8); x.fillRect(p.x + 2, p.y + p.h - 16, 3, 8); x.fillStyle = '#d6342b'; x.fillRect(p.x + p.w - 5, p.y + 8, 3, 8); x.fillRect(p.x + p.w - 5, p.y + p.h - 16, 3, 8);
    if (dmg > .3) { x.fillStyle = `rgba(0,0,0,${dmg * .5})`; rr(x, p.x, p.y, p.w, p.h, 14); x.fill(); } return;
  }
  if (p.mat === 'metal') {
    x.fillStyle = '#262b32'; x.fillRect(p.x, p.y, p.w, p.h); x.strokeStyle = '#59626e'; x.lineWidth = 1.5; x.strokeRect(p.x + .5, p.y + .5, p.w - 1, p.h - 1);
    x.strokeStyle = 'rgba(255,255,255,.1)'; x.beginPath(); for (let i = 7; i < p.h - 4; i += 6) { x.moveTo(p.x + 6, p.y + i); x.lineTo(p.x + p.w - 6, p.y + i); } x.stroke();
    x.fillStyle = p.seed > .5 ? '#4fe3ff' : '#52ff8f'; x.fillRect(p.x + 5, p.y + 4, 2, 2); return;
  }
  if (p.flipped) { // knocked-over table: a thick slab of cover on its edge
    const hz = Math.abs(p.fdx) > Math.abs(p.fdy), t = 13;
    const rx = hz ? (p.fdx > 0 ? p.x + p.w - t : p.x) : p.x, ry = hz ? p.y : (p.fdy > 0 ? p.y + p.h - t : p.y), rw = hz ? t : p.w, rh = hz ? p.h : t;
    x.fillStyle = '#241d17'; x.fillRect(p.x, p.y, p.w, p.h); x.fillStyle = '#5c4a38'; x.fillRect(rx, ry, rw, rh); x.strokeStyle = '#8a7256'; x.lineWidth = 1.5; x.strokeRect(rx + .5, ry + .5, rw - 1, rh - 1);
  } else {
    x.fillStyle = p.col; x.fillRect(p.x, p.y, p.w, p.h); x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1.5; x.strokeRect(p.x + .5, p.y + .5, p.w - 1, p.h - 1);
    if (p.type === 'crate') { x.strokeStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.moveTo(p.x + 3, p.y + 3); x.lineTo(p.x + p.w - 3, p.y + p.h - 3); x.moveTo(p.x + p.w - 3, p.y + 3); x.lineTo(p.x + 3, p.y + p.h - 3); x.stroke(); }
    else if (p.type === 'sofa') { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h * .35); }
    else { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(p.x + 6, p.y + 6, 14, 9); x.fillStyle = 'rgba(79,227,255,.35)'; x.fillRect(p.x + p.w - 22, p.y + p.h - 15, 12, 8); }
  }
  if (dmg > .05) { x.strokeStyle = `rgba(0,0,0,${.3 + dmg * .5})`; x.lineWidth = 1; const r = RNG(p.seed * 1e6 | 0); x.beginPath(); for (let i = 0; i < dmg * 9; i++) { const ax = p.x + r() * p.w, ay = p.y + r() * p.h; x.moveTo(ax, ay); x.lineTo(ax + (r() - .5) * 16, ay + (r() - .5) * 16); } x.stroke(); }
}
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

function render() {
  const x = View.x, w = View.w, h = View.h, W = World;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  x.fillStyle = '#020203'; x.fillRect(0, 0, w, h);
  if (!W.bg || w < 4 || h < 4 || View.L.width < 2) return;
  const S = View.S = viewScale(), camx = Cam.x + Cam.sx, camy = Cam.y + Cam.sy;
  const vw = w / S, vh = h / S, x0 = camx - vw / 2, y0 = camy - vh / 2, x1 = x0 + vw, y1 = y0 + vh;
  const on = (px, py, m) => px > x0 - m && px < x1 + m && py > y0 - m && py < y1 + m;
  x.setTransform(S, 0, 0, S, w / 2 - camx * S, h / 2 - camy * S);
  const sx = Math.max(0, Math.floor(x0)), sy = Math.max(0, Math.floor(y0)), sw = Math.min(W.bg.width - sx, Math.ceil(vw) + 2), sh = Math.min(W.bg.height - sy, Math.ceil(vh) + 2);
  if (sw > 0 && sh > 0) { x.drawImage(W.bg, sx, sy, sw, sh, sx, sy, sw, sh); x.drawImage(W.decal, sx, sy, sw, sh, sx, sy, sw, sh); }
  // extraction pad
  const ex = W.exit, pulse = .5 + .5 * Math.sin(G.rt * 4);
  x.lineWidth = 3; x.strokeStyle = W.exitOpen ? `rgba(82,255,143,${.5 + pulse * .5})` : 'rgba(120,120,130,.25)'; x.setLineDash([10, 8]); x.beginPath(); x.arc(ex.x, ex.y, ex.r - 6, G.rt, G.rt + TAU); x.stroke(); x.setLineDash([]);
  x.fillStyle = W.exitOpen ? 'rgba(82,255,143,.9)' : 'rgba(140,140,150,.3)'; x.font = '700 11px Segoe UI, Arial'; x.textAlign = 'center'; x.fillText('EXTRACTION', ex.x, ex.y + 4);
  // pickups
  for (const p of W.pickups) if (!p.dead && on(p.x, p.y, 20)) { const b = Math.sin(p.t * 4) * 1.5; if (p.type === 'health') { x.fillStyle = '#12301d'; x.fillRect(p.x - 8, p.y - 8 + b, 16, 16); x.fillStyle = '#52ff8f'; x.fillRect(p.x - 2, p.y - 6 + b, 4, 12); x.fillRect(p.x - 6, p.y - 2 + b, 12, 4); } else { x.fillStyle = '#3b2f12'; x.fillRect(p.x - 8, p.y - 6 + b, 16, 12); x.fillStyle = '#ffc94a'; for (let i = 0; i < 3; i++) x.fillRect(p.x - 6 + i * 5, p.y - 4 + b, 3, 8); } }
  // furniture, chairs, doors
  for (const c of W.chairs) if (on(c.x, c.y, 20)) { x.save(); x.translate(c.x, c.y); x.rotate(c.ang); x.fillStyle = c.down ? '#23262b' : '#30343b'; x.fillRect(-6, -6, 12, 12); x.fillStyle = c.down ? '#3a3f47' : '#565d68'; x.fillRect(-6, c.down ? -2 : -7, 12, 3); x.restore(); }
  for (const p of W.props) if (!p.dead && on(p.x + p.w / 2, p.y + p.h / 2, 90)) drawProp(x, p);
  for (const d of W.doors) {
    if (d.dead) continue; const cx = d.tx * TS + 20, cy = d.ty * TS + 20; if (!on(cx, cy, 60)) continue;
    x.save(); if (d.v) { x.translate(cx, d.ty * TS); x.rotate(-d.swing * 1.45 * d.side); x.fillStyle = '#6b4f33'; x.fillRect(-4, 0, 8, TS); x.fillStyle = '#c9a13c'; x.fillRect(-2, TS - 9, 4, 4); }
    else { x.translate(d.tx * TS, cy); x.rotate(d.swing * 1.45 * d.side); x.fillStyle = '#6b4f33'; x.fillRect(0, -4, TS, 8); x.fillStyle = '#c9a13c'; x.fillRect(TS - 9, -2, 4, 4); }
    x.restore();
  }
  // characters
  x.fillStyle = 'rgba(0,0,0,.4)';
  for (const e of Enemies) if (on(e.x, e.y, 40)) { x.beginPath(); x.ellipse(e.x + 2, e.y + 3, 10 * e.scale, 8 * e.scale, 0, 0, TAU); x.fill(); }
  { const sc = 1 - P.z * .012; x.beginPath(); x.ellipse(P.x + 2, P.y + 3, 10 * sc, 8 * sc, 0, 0, TAU); x.fill(); }
  for (const e of Enemies) if (on(e.x, e.y, 40)) { if (e.hitT > 1.38 && e.alive) drawRig(x, e, { limb: '#fff', head: '#fff', gun: '#fff', accent: '#fff' }); else drawRig(x, e, e.def.col); }
  for (const t of P.trail) { x.globalAlpha = (1 - t.t / .3) * .28; drawRig(x, P, { limb: '#4fe3ff', head: '#4fe3ff', gun: '#4fe3ff', accent: '#4fe3ff' }, t.J); }
  x.globalAlpha = P.iframes > 0 && P.alive ? .75 : 1;
  drawRig(x, P, P.lastStandT > 0 ? { limb: '#ffd0d0', head: '#fff', gun: '#8d949e', accent: '#ff2d3d' } : PCOL); x.globalAlpha = 1;
  // particles
  for (const p of FX.parts) {
    if (!on(p.x, p.y, 40)) continue; const u = p.t / p.max;
    if (p.type === 'spark') { x.strokeStyle = p.col; x.globalAlpha = 1 - u; x.lineWidth = 1.4; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); x.stroke(); }
    else if (p.type === 'dust') { x.fillStyle = p.col + (.22 * (1 - u)) + ')'; x.beginPath(); x.arc(p.x, p.y, p.size * (1 + u), 0, TAU); x.fill(); }
    else if (p.type === 'fire') { x.globalCompositeOperation = 'lighter'; x.fillStyle = `rgba(255,${200 - u * 150 | 0},${90 - u * 80 | 0},${(1 - u) * .7})`; x.beginPath(); x.arc(p.x, p.y, p.size * (1 - u * .5), 0, TAU); x.fill(); x.globalCompositeOperation = 'source-over'; }
    else if (p.type === 'ring') {
      x.globalAlpha = (1 - u) * (p.col === 'boom' ? .8 : .5); x.strokeStyle = p.col === 'p' ? '#cfefff' : p.col === 'e' ? '#ff8a8a' : p.col === 'dodge' ? '#4fe3ff' : '#ffd9a0'; x.lineWidth = p.col === 'boom' ? 5 : 1.2;
      x.beginPath(); x.arc(p.x, p.y, p.col === 'boom' ? p.size * (.3 + u * 1.4) : p.col === 'dodge' ? 14 + u * 50 : p.size + u * 13, 0, TAU); x.stroke();
    }
    else if (p.type === 'blood') { x.fillStyle = p.col; x.globalAlpha = 1; x.beginPath(); x.arc(p.x, p.y, p.size, 0, TAU); x.fill(); }
    else { x.save(); x.translate(p.x, p.y); x.rotate(p.rot || 0); x.fillStyle = p.col; x.globalAlpha = p.type === 'shard' ? .8 : 1; if (p.type === 'shard') { x.beginPath(); x.moveTo(-p.size, 0); x.lineTo(p.size * .6, -p.size * .5); x.lineTo(p.size * .3, p.size * .6); x.fill(); } else if (p.type === 'shell') x.fillRect(-2, -.8, 4, 1.6); else x.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); x.restore(); }
    x.globalAlpha = 1;
  }
  // ---- dynamic lighting: darkness layer with light-shaped holes ----
  const lx = View.lx, hs = S * .5; lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, View.L.width, View.L.height);
  lx.fillStyle = `rgba(2,3,6,${W.ambient})`; lx.fillRect(0, 0, View.L.width, View.L.height);
  lx.setTransform(hs, 0, 0, hs, w / 4 - camx * hs, h / 4 - camy * hs); lx.globalCompositeOperation = 'destination-out';
  for (const l of W.lights) if (l.a > 0 && on(l.x, l.y, l.r)) { lx.globalAlpha = l.a; lx.drawImage(l.mask, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
  lx.globalAlpha = 1; const hole = (px, py, r, a) => { const g = lx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); lx.fillStyle = g; lx.fillRect(px - r, py - r, r * 2, r * 2); };
  hole(P.x, P.y, 170, .62);
  for (const g of G.glows) if (on(g.x, g.y, g.r)) hole(g.x, g.y, g.r, Math.min(1, g.t / g.max + .2));
  for (const b of Bullets) if (on(b.x, b.y, 60)) hole(b.x, b.y, b.flame ? 55 : 26, .5);
  x.drawImage(View.L, x0, y0, vw, vh);
  // ---- emissive pass (drawn over the darkness) ----
  x.globalCompositeOperation = 'lighter';
  for (const l of W.lights) if (l.a > 0 && on(l.x, l.y, l.r)) { x.globalAlpha = l.a; x.drawImage(l.glow, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); x.globalAlpha = l.a * .9; x.fillStyle = l.color; x.beginPath(); x.arc(l.x, l.y, 3.5, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  for (const l of W.lights) if (!l.on && on(l.x, l.y, 10)) { x.fillStyle = 'rgba(90,90,100,.35)'; x.beginPath(); x.arc(l.x, l.y, 3, 0, TAU); x.fill(); }
  for (const n of W.neon) { x.strokeStyle = n.col; x.globalAlpha = .16; x.lineWidth = 9; x.beginPath(); x.moveTo(n.x0, n.y0); x.lineTo(n.x1, n.y1); x.stroke(); x.globalAlpha = .9; x.lineWidth = 1.6; x.stroke(); }
  x.globalAlpha = 1;
  for (const g of G.glows) { const a = g.t / g.max; const gr = x.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r * .6); gr.addColorStop(0, `rgba(${g.col},${a * .35})`); gr.addColorStop(1, `rgba(${g.col},0)`); x.fillStyle = gr; x.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2); }
  for (const f of FX.flashes) { x.save(); x.translate(f.x, f.y); x.rotate(f.ang); const k = 1 - f.t / f.max; x.fillStyle = `rgba(255,236,180,${k})`; x.beginPath(); x.moveTo(-2, 0); x.lineTo(f.size * .35, -f.size * .28); x.lineTo(f.size, 0); x.lineTo(f.size * .35, f.size * .28); x.fill(); x.beginPath(); x.arc(0, 0, f.size * .3, 0, TAU); x.fill(); x.restore(); }
  // bullets: glowing head + trail (long, visible streaks in slow motion)
  const slow = G.ws < .7;
  for (const b of Bullets) {
    if (b.flame) { const u = clamp(b.dist / b.range, 0, 1), r = 4 + u * 15; x.fillStyle = `rgba(255,${235 - u * 150 | 0},${150 - u * 140 | 0},${.5 * (1 - u * .75)})`; x.beginPath(); x.arc(b.x, b.y, r, 0, TAU); x.fill(); continue; }
    if (b.fire) { const tl2 = Math.min(b.dist, 26); x.strokeStyle = 'rgba(255,150,50,.9)'; x.lineWidth = 2.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(b.x - b.cx * tl2, b.y - b.cy * tl2); x.stroke(); x.fillStyle = '#fff2c0'; x.beginPath(); x.arc(b.x, b.y, 2, 0, TAU); x.fill(); continue; }
    const tl = Math.min(b.dist, slow ? 70 : 20 + b.speed * .03), tx = b.x - b.cx * tl, ty = b.y - b.cy * tl, pl = b.owner === 'p';
    const g = x.createLinearGradient(b.x, b.y, tx, ty); g.addColorStop(0, pl ? 'rgba(255,255,255,1)' : 'rgba(255,120,110,1)'); g.addColorStop(1, pl ? 'rgba(160,220,255,0)' : 'rgba(255,40,40,0)');
    x.strokeStyle = g; x.lineWidth = pl ? 2.2 : 2.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(tx, ty); x.stroke();
    x.fillStyle = pl ? '#fff' : '#ffd0c8'; x.beginPath(); x.arc(b.x, b.y, pl ? 1.8 : 2.4, 0, TAU); x.fill();
    if (!pl) { x.fillStyle = 'rgba(255,60,50,.25)'; x.beginPath(); x.arc(b.x, b.y, 7, 0, TAU); x.fill(); }
  }
  // enemy overlays: visor glow, sniper lasers, awareness, health, barks
  for (const e of Enemies) {
    if (!e.alive || !on(e.x, e.y, 60)) continue; const J = e.rig.J; if (!J) continue;
    if (e.burnT > 0) { const fl = .5 + .5 * Math.sin(G.time * 30 + e.id); x.fillStyle = `rgba(255,${130 + fl * 70 | 0},40,.35)`; x.beginPath(); x.arc(e.x, e.y, (13 + fl * 4) * e.scale, 0, TAU); x.fill(); }
    if (e.alert) { x.fillStyle = 'rgba(255,45,61,.55)'; x.beginPath(); x.arc(J.head.x, J.head.y, 4, 0, TAU); x.fill(); }
    if (e.def.sniper && e.aimT > 0) { const k = e.aimT / 1.25; x.strokeStyle = `rgba(255,40,50,${.25 + k * .7})`; x.lineWidth = .8 + k * 1.4; x.beginPath(); x.moveTo(e.x, e.y); x.lineTo(e.x + Math.cos(e.aim) * 1200, e.y + Math.sin(e.aim) * 1200); x.stroke(); }
  }
  if (G.shock) { const u = G.shock.t / .6; x.strokeStyle = `rgba(140,225,255,${(1 - u) * .7})`; x.lineWidth = 10 * (1 - u) + 1; x.beginPath(); x.arc(G.shock.x, G.shock.y, 20 + u * 520, 0, TAU); x.stroke(); }
  x.globalCompositeOperation = 'source-over'; x.textAlign = 'center';
  for (const e of Enemies) {
    if (!e.alive || !on(e.x, e.y, 60)) continue;
    if (e.hp < e.maxHp && e.hitT > -2) { const bw = 26 * e.scale; x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(e.x - bw / 2, e.y - 24 * e.scale, bw, 3.5); x.fillStyle = '#ff2d3d'; x.fillRect(e.x - bw / 2, e.y - 24 * e.scale, bw * clamp(e.hp / e.maxHp, 0, 1), 3.5); }
    if (!e.alert && e.aware > 0) { x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 3; x.beginPath(); x.arc(e.x, e.y - 26, 6, 0, TAU); x.stroke(); x.strokeStyle = '#ffd23d'; x.beginPath(); x.arc(e.x, e.y - 26, 6, -Math.PI / 2, -Math.PI / 2 + TAU * e.aware); x.stroke(); }
    if (e.barkT > 0) { x.font = '900 17px Segoe UI, Arial'; x.fillStyle = e.bark[0] === '!' ? '#ff2d3d' : '#ffd23d'; x.globalAlpha = Math.min(1, e.barkT * 2); x.fillText(e.bark, e.x, e.y - 30 - (1.1 - e.barkT) * 8); x.globalAlpha = 1; }
    if (e.reloadT > 0) { x.font = '700 9px Segoe UI, Arial'; x.fillStyle = 'rgba(255,255,255,.6)'; x.fillText('RELOADING', e.x, e.y + 26); }
    if (e.def.boss) { x.font = '800 10px Segoe UI, Arial'; x.fillStyle = '#ffd76a'; x.fillText('THE DIRECTOR', e.x, e.y - 30); }
  }
  for (const t of FX.texts) { x.font = `${t.big ? 900 : 700} ${t.big ? 16 : 12}px Segoe UI, Arial`; x.fillStyle = t.col; x.globalAlpha = 1 - t.t / .8; x.fillText(t.s, t.x, t.y - t.t * 30); }
  x.globalAlpha = 1;
  if (P.de.mode) for (const e of P.de.marks) if (e.alive) { x.strokeStyle = '#ff2d3d'; x.lineWidth = 2; x.beginPath(); x.arc(e.x, e.y, 15, 0, TAU); x.moveTo(e.x - 20, e.y); x.lineTo(e.x - 8, e.y); x.moveTo(e.x + 8, e.y); x.lineTo(e.x + 20, e.y); x.moveTo(e.x, e.y - 20); x.lineTo(e.x, e.y - 8); x.moveTo(e.x, e.y + 8); x.lineTo(e.x, e.y + 20); x.stroke(); }
  // ---- screen-space post FX ----
  x.setTransform(1, 0, 0, 1, 0, 0);
  const sl = clamp(1 - G.ws, 0, 1), fxOn = Save.data.settings.fx;
  if (sl > .08) {
    if (fxOn) { // chromatic split: tinted half-res copies offset left / right
      const f = View.fx, off = 5 * sl; f.globalCompositeOperation = 'source-over'; f.drawImage(View.c, 0, 0, View.F.width, View.F.height); f.globalCompositeOperation = 'multiply'; f.fillStyle = '#ff2030'; f.fillRect(0, 0, View.F.width, View.F.height);
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = .2 * sl; x.drawImage(View.F, -off, 0, w, h);
      f.globalCompositeOperation = 'source-over'; f.drawImage(View.c, 0, 0, View.F.width, View.F.height); f.globalCompositeOperation = 'multiply'; f.fillStyle = '#20e0ff'; f.fillRect(0, 0, View.F.width, View.F.height);
      x.drawImage(View.F, off, 0, w, h); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    }
    x.fillStyle = `rgba(30,80,120,${.13 * sl})`; x.fillRect(0, 0, w, h);
    const v = x.createRadialGradient(w / 2, h / 2, h * .35, w / 2, h / 2, h * .85); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,10,25,${.7 * sl})`); x.fillStyle = v; x.fillRect(0, 0, w, h);
    x.fillStyle = `rgba(0,0,0,${sl})`; const bar = h * .055 * sl; x.fillRect(0, 0, w, bar); x.fillRect(0, h - bar, w, bar); // cinematic letterbox
  }
  const v2 = x.createRadialGradient(w / 2, h / 2, h * .45, w / 2, h / 2, h * .95); v2.addColorStop(0, 'rgba(0,0,0,0)'); v2.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v2; x.fillRect(0, 0, w, h);
  const low = P.alive ? clamp(1 - P.hp / (P.maxHp * .4), 0, 1) : 1, ht = clamp(P.hurtT / .6, 0, 1), red = Math.max(ht * .5, low * (.25 + .12 * Math.sin(G.rt * 6)));
  if (red > .01) { const v3 = x.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, h * .8); v3.addColorStop(0, 'rgba(255,0,20,0)'); v3.addColorStop(1, `rgba(255,0,20,${red})`); x.fillStyle = v3; x.fillRect(0, 0, w, h); }
  if (G.flash > .01) { x.fillStyle = `rgba(255,240,210,${G.flash})`; x.fillRect(0, 0, w, h); }
  drawHUD(x, w, h, S, camx, camy);
}

function drawHUD(x, w, h, S, camx, camy) {
  if (G.state !== 'play' && G.state !== 'pause') return;
  const F = (s, wt = 700) => { x.font = `${wt} ${s}px Segoe UI, Arial`; };
  const toScr = (px, py) => [w / 2 + (px - camx) * S, h / 2 + (py - camy) * S];
  // offscreen threat indicators + damage direction
  for (const e of Enemies) if (e.alive && e.alert) { const [sx, sy] = toScr(e.x, e.y); if (sx < 0 || sy < 0 || sx > w || sy > h) { const a = Math.atan2(sy - h / 2, sx - w / 2), r = Math.min(w, h) / 2 - 30; x.save(); x.translate(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); x.rotate(a); x.fillStyle = 'rgba(255,45,61,.85)'; x.beginPath(); x.moveTo(10, 0); x.lineTo(-6, -7); x.lineTo(-6, 7); x.fill(); x.restore(); } }
  if (P.hurtT > 0) { x.save(); x.translate(w / 2, h / 2); x.rotate(P.hurtDir); x.strokeStyle = `rgba(255,45,61,${P.hurtT / .6})`; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 90, -.35, .35); x.stroke(); x.restore(); }
  if (W_exitArrow()) { const [sx, sy] = toScr(World.exit.x, World.exit.y); if (sx < 0 || sy < 0 || sx > w || sy > h) { const a = Math.atan2(sy - h / 2, sx - w / 2), r = Math.min(w, h) / 2 - 60; x.save(); x.translate(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); x.rotate(a); x.fillStyle = '#52ff8f'; x.beginPath(); x.moveTo(14, 0); x.lineTo(-8, -9); x.lineTo(-8, 9); x.fill(); x.restore(); } }
  // health
  const pad = 26; x.textAlign = 'left'; F(11, 800); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillText('HEALTH', pad, h - 62);
  x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(pad, h - 54, 230, 12); x.fillStyle = P.hp < P.maxHp * .3 ? '#ff2d3d' : '#e9edf2'; x.fillRect(pad, h - 54, 230 * clamp(P.hp / P.maxHp, 0, 1), 12);
  F(13, 800); x.fillStyle = '#fff'; x.fillText(Math.ceil(P.hp), pad + 238, h - 43);
  // bullet-time energy
  F(11, 800); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillText(G.bt ? 'BULLET TIME — ACTIVE' : P.btCd > 0 ? 'BULLET TIME — COOLDOWN' : 'BULLET TIME  [Q]', pad, h - 28);
  x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(pad, h - 22, 230, 7); x.fillStyle = P.btCd > 0 && !G.bt ? '#5a6b75' : G.bt ? '#fff' : '#4fe3ff'; x.fillRect(pad, h - 22, 230 * P.energy / P.maxE, 7);
  if (P.btCd > 0 && !G.bt) { x.fillStyle = '#ffd23d'; x.fillRect(pad, h - 13, 230 * (P.btCd / 2), 2); }
  // abilities
  let ax = pad + 290; const ab = (key, lbl, cd, max, act) => { if (!hasAb(key)) return; x.fillStyle = act ? 'rgba(79,227,255,.25)' : 'rgba(255,255,255,.07)'; x.fillRect(ax, h - 56, 74, 38); x.fillStyle = cd > 0 ? 'rgba(255,255,255,.3)' : '#fff'; F(10, 800); x.fillText(lbl, ax + 6, h - 41); if (cd > 0) { x.fillStyle = '#ffd23d'; x.fillRect(ax, h - 22, 74 * clamp(cd / max, 0, 1), 3); F(10); x.fillText(cd.toFixed(0) + 's', ax + 6, h - 27); } else { x.fillStyle = '#52ff8f'; F(10); x.fillText(act ? 'ACTIVE' : 'READY', ax + 6, h - 27); } ax += 80; };
  ab('deadeye', 'DEAD EYE [X]', P.de.cd, 18, P.de.mode > 0); ab('reflex', 'REFLEX', P.reflexCd, 9, P.reflexT > 0); ab('laststand', 'LAST STAND', P.lastStandCd, 60, P.lastStandT > 0);
  if (hasAb('focus')) { x.fillStyle = P.focusSlow ? 'rgba(79,227,255,.25)' : 'rgba(255,255,255,.07)'; x.fillRect(ax, h - 56, 74, 38); x.fillStyle = '#fff'; F(10, 800); x.fillText('FOCUS [RMB]', ax + 6, h - 41); ax += 80; }
  // weapon + ammo
  const wp = curW(), wd = WEAPONS[wp.id]; x.textAlign = 'right'; F(13, 800); x.fillStyle = 'rgba(255,255,255,.6)'; x.fillText(wd.name, w - pad, h - 62);
  F(40, 900); x.fillStyle = wp.mag === 0 ? '#ff2d3d' : wp.mag <= wd.mag * .25 ? '#ffd23d' : '#fff'; x.fillText(wp.mag, w - pad - 70, h - 22); F(18, 700); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillText('/ ' + wp.reserve, w - pad, h - 24);
  F(10, 700); P.slots.forEach((s, i) => { x.fillStyle = i === P.cur ? '#4fe3ff' : 'rgba(255,255,255,.35)'; x.fillText(`${i + 1} ${WEAPONS[s.id].name}`, w - pad, h - 82 - (P.slots.length - 1 - i) * 14); });
  // objective + timer
  x.textAlign = 'left'; F(11, 800); x.fillStyle = '#ff2d3d'; x.fillText(`MISSION ${G.mi + 1} — ${MISSIONS[G.mi].name}`, pad, 34);
  F(15, 700); x.fillStyle = '#fff'; x.fillText(G.objective, pad, 56);
  const tm = G.stats.time; F(12, 600); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillText(`${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`, pad, 76);
  // score + combo
  x.textAlign = 'right'; F(12, 800); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillText('STYLE', w - pad, 32); F(30, 900); x.fillStyle = '#fff'; x.fillText(Style.score.toLocaleString(), w - pad, 62);
  if (Style.combo > 0) {
    const m = Style.mult(), k = clamp(Style.comboT / 5, 0, 1); F(26, 900); x.fillStyle = m >= 4 ? '#ff2d3d' : m >= 2 ? '#ffd23d' : '#4fe3ff'; x.fillText('x' + m.toFixed(1), w - pad, 96);
    F(11, 800); x.fillStyle = 'rgba(255,255,255,.6)'; x.fillText(Style.combo + ' CHAIN', w - pad - 74, 94); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(w - pad - 150, 103, 150, 3); x.fillStyle = '#fff'; x.fillRect(w - pad - 150 * k, 103, 150 * k, 3);
  }
  // notifications
  let ny = 132, big = null; for (let i = Style.notes.length - 1; i >= 0; i--) { const n = Style.notes[i]; if (n.tier === 2 && !big && n.t < 1.6) { big = n; continue; } const a = Math.min(1, n.t * 8) * clamp((2.6 - n.t) * 2, 0, 1), sl = (1 - Math.min(1, n.t * 8)) * 30; x.globalAlpha = a; F(n.tier ? 17 : 14, 900); x.fillStyle = n.tier ? '#ffd23d' : '#fff'; x.fillText(n.text, w - pad + sl, ny); if (n.pts) { F(11, 700); x.fillStyle = '#4fe3ff'; x.fillText('+' + n.pts, w - pad + sl, ny + 13); ny += 12; } ny += 22; }
  x.globalAlpha = 1; x.textAlign = 'center';
  if (big) { const a = Math.min(1, big.t * 7) * clamp((1.6 - big.t) * 3, 0, 1), sc = 1 + (1 - Math.min(1, big.t * 7)) * .8; x.globalAlpha = a; x.save(); x.translate(w / 2, h * .2); x.scale(sc, sc); F(44, 900); x.fillStyle = 'rgba(255,45,61,.85)'; x.fillText(big.text, 2, 2); x.fillStyle = '#fff'; x.fillText(big.text, 0, 0); if (big.pts) { F(16, 800); x.fillStyle = '#4fe3ff'; x.fillText('+' + big.pts, 0, 26); } x.restore(); x.globalAlpha = 1; }
  // mission title card / hints
  if (G.introT > 0) { const a = clamp(G.introT, 0, 1); x.globalAlpha = a; F(54, 900); x.fillStyle = '#fff'; x.fillText(MISSIONS[G.mi].name, w / 2, h * .4); F(16, 600); x.fillStyle = '#ff2d3d'; x.fillText(MISSIONS[G.mi].sub, w / 2, h * .4 + 32); x.globalAlpha = 1; }
  if (G.hint) { F(15, 700); const tw = x.measureText(G.hint).width + 36; x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(w / 2 - tw / 2, h - 128, tw, 32); x.fillStyle = '#4fe3ff'; x.fillRect(w / 2 - tw / 2, h - 128, 3, 32); x.fillStyle = '#fff'; x.fillText(G.hint, w / 2, h - 107); }
  if (P.de.mode === 1) { F(16, 900); x.fillStyle = '#ff2d3d'; x.fillText(`DEAD EYE — MARK TARGETS (${P.de.marks.length}) — RELEASE X TO EXECUTE`, w / 2, h * .82); }
  if (Save.data.settings.fps) { x.textAlign = 'left'; F(11); x.fillStyle = '#52ff8f'; x.fillText(G.fps.toFixed(0) + ' FPS', pad, 96); x.textAlign = 'center'; }
  // crosshair + reload ring
  const mx = Input.mx, my = Input.my, sp = 7 + P.bloom * 26 + (P.focus ? -3 : 0) + (Math.hypot(P.vx, P.vy) > 120 ? 4 : 0);
  x.strokeStyle = P.de.mode ? '#ff2d3d' : '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(mx - sp - 7, my); x.lineTo(mx - sp, my); x.moveTo(mx + sp, my); x.lineTo(mx + sp + 7, my); x.moveTo(mx, my - sp - 7); x.lineTo(mx, my - sp); x.moveTo(mx, my + sp); x.lineTo(mx, my + sp + 7); x.stroke();
  x.fillStyle = '#ff2d3d'; x.fillRect(mx - 1, my - 1, 2, 2);
  if (P.reloadT > 0) {
    const pr = 1 - P.reloadT / P.reloadDur, bw = 90, bx = mx - bw / 2, by = my + 30; x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(bx, by, bw, 7); x.fillStyle = P.activeUsed ? 'rgba(255,255,255,.12)' : 'rgba(82,255,143,.55)'; x.fillRect(bx + bw * .45, by, bw * .18, 7);
    x.fillStyle = P.jamT > 0 ? '#ff2d3d' : '#fff'; x.fillRect(bx + bw * pr - 1.5, by - 3, 3, 13); F(9, 800); x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(P.activeUsed ? 'RELOADING' : 'TAP R IN THE GREEN', mx, by + 20);
  } else if (wp.mag === 0) { F(11, 900); x.fillStyle = '#ff2d3d'; x.fillText(wp.reserve ? 'RELOAD [R]' : 'NO AMMO', mx, my + 36); }
}
const W_exitArrow = () => World.exitOpen;
