'use strict';
/* ===== SHADOW PROTOCOL :: world — level generator, collision, rays, pathfinding, destruction ===== */
const TS = 40;
// tile codes: 0 floor, 1 concrete, 2 glass (shatters), 3 drywall (penetrable), 5 void (rooftop gap)
const World = { W: 0, H: 0, T: null, blocked: null, propGrid: [], doorAt: [], rooms: [], props: [], doors: [], lights: [], chairs: [], pickups: [], neon: [], bg: null, bgx: null, decal: null, dx: null, start: null, exit: null, exitOpen: false, spawnTiles: [], reach: null };

const PROPS = {
  desk:   { w: 2, h: 1, mat: 'wood', hp: 110, low: true, pen: 1, col: '#3b3128' },
  deskv:  { w: 1, h: 2, mat: 'wood', hp: 110, low: true, pen: 1, col: '#3b3128' },
  sofa:   { w: 2, h: 1, mat: 'wood', hp: 90, low: true, pen: 1, col: '#3a2530' },
  crate:  { w: 1, h: 1, mat: 'wood', hp: 70, low: true, pen: 1, col: '#4a3a26' },
  metal:  { w: 1, h: 1, mat: 'metal', hp: 1e9, low: false, pen: 4, col: '#2c3138' },
  barrel: { w: 1, h: 1, mat: 'barrel', hp: 18, low: true, pen: 99, col: '#a3261f', inset: 8 },
  car:    { w: 3, h: 2, mat: 'car', hp: 240, low: false, pen: 5, col: '#23262c', inset: 6 },
  fuse:   { w: 1, h: 1, mat: 'fuse', hp: 1, low: true, pen: 0, col: '#d8c23a', inset: 13, blocks: false }
};

const tileOf = v => Math.floor(v / TS);
const tIdx = (tx, ty) => ty * World.W + tx;
const inMap = (tx, ty) => tx >= 0 && ty >= 0 && tx < World.W && ty < World.H;
const walkT = i => World.T[i] === 0 && !World.blocked[i];

/* ---------------- generator ---------------- */
function buildLevel(m) {
  const th = THEMES[m.theme], R = RNG(m.seed * 7919 + 13), W = m.w, H = m.h, w = World;
  Object.assign(w, { W, H, T: new Uint8Array(W * H), blocked: new Uint8Array(W * H), propGrid: [], doorAt: [], rooms: [], props: [], doors: [], lights: [], chairs: [], pickups: [], neon: [], theme: th, ambient: m.ambient ?? th.ambient, exitOpen: false });
  const T = w.T, I = (x, y) => y * W + x;
  for (let x = 0; x < W; x++) { T[I(x, 0)] = 1; T[I(x, H - 1)] = 1; }
  for (let y = 0; y < H; y++) { T[I(0, y)] = 1; T[I(W - 1, y)] = 1; }
  const splits = [], minR = th.minRoom, maxR = th.room;
  (function split(x0, y0, x1, y1, d) {
    const ww = x1 - x0 + 1, hh = y1 - y0 + 1, canV = ww >= minR * 2 + 1, canH = hh >= minR * 2 + 1;
    if ((!canV && !canH) || (ww <= maxR && hh <= maxR)) { w.rooms.push({ x0, y0, x1, y1, corr: false }); return; }
    const vert = canV && canH ? (ww === hh ? R() < .5 : ww > hh) : canV;
    const span = vert ? ww : hh;
    if (d <= 1 && span >= minR * 2 + 4 && R() < th.corr) { // carve a corridor: two parallel walls
      const c = (vert ? x0 : y0) + minR + Math.floor(R() * (span - 2 * minR - 3));
      if (vert) { splits.push({ v: true, p: c, a: y0, b: y1, corr: true }, { v: true, p: c + 3, a: y0, b: y1, corr: true }); w.rooms.push({ x0: c + 1, y0, x1: c + 2, y1, corr: true }); split(x0, y0, c - 1, y1, d + 1); split(c + 4, y0, x1, y1, d + 1); }
      else { splits.push({ v: false, p: c, a: x0, b: x1, corr: true }, { v: false, p: c + 3, a: x0, b: x1, corr: true }); w.rooms.push({ x0, y0: c + 1, x1, y1: c + 2, corr: true }); split(x0, y0, x1, c - 1, d + 1); split(x0, c + 4, x1, y1, d + 1); }
      return;
    }
    const c = (vert ? x0 : y0) + minR + Math.floor(R() * (span - 2 * minR));
    if (vert) { splits.push({ v: true, p: c, a: y0, b: y1 }); split(x0, y0, c - 1, y1, d + 1); split(c + 1, y0, x1, y1, d + 1); }
    else { splits.push({ v: false, p: c, a: x0, b: x1 }); split(x0, y0, x1, c - 1, d + 1); split(x0, c + 1, x1, y1, d + 1); }
  })(1, 1, W - 2, H - 2, 0);
  // draw partition walls
  for (const s of splits) {
    s.kind = th.voidP && R() < th.voidP ? 5 : R() < th.glass ? 2 : R() < th.dry ? 3 : 1;
    for (let i = s.a; i <= s.b; i++) {
      const k = (s.kind === 2 && (i === s.a || i === s.b)) ? 1 : s.kind;
      T[s.v ? I(s.p, i) : I(i, s.p)] = k;
    }
  }
  // openings / doors: every partition gets at least one, so the whole building is connected
  const reserved = new Uint8Array(W * H);
  for (const s of splits) {
    const cand = [];
    for (let i = s.a; i <= s.b; i++) {
      const A = s.v ? I(s.p - 1, i) : I(i, s.p - 1), B = s.v ? I(s.p + 1, i) : I(i, s.p + 1);
      if (T[A] === 0 && T[B] === 0) cand.push(i);
    }
    const len = s.b - s.a + 1;
    let n = s.corr ? Math.max(2, Math.floor(len / 6)) : 1 + (len > 9 && R() < .7 ? 1 : 0) + (R() < th.loops * .5 ? 1 : 0);
    if (!cand.length) cand.push(Math.floor((s.a + s.b) / 2));
    const chosen = [];
    for (let k = 0; k < 40 && chosen.length < n; k++) { const c = cand[Math.floor(R() * cand.length)]; if (chosen.every(o => Math.abs(o - c) >= 3)) chosen.push(c); }
    for (const c of chosen) {
      const tx = s.v ? s.p : c, ty = s.v ? c : s.p, i = I(tx, ty);
      T[i] = 0;
      if (s.kind === 5) { const c2 = cand.includes(c + 1) ? c + 1 : cand.includes(c - 1) ? c - 1 : null; if (c2 !== null) T[s.v ? I(s.p, c2) : I(c2, s.p)] = 0; }
      else if (R() < th.doorP) { const d = { tx, ty, v: s.v, open: false, hp: 70, dead: false, swing: 0, side: 1 }; w.doors.push(d); w.doorAt[i] = d; }
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (inMap(tx + ox, ty + oy)) reserved[I(tx + ox, ty + oy)] = 1;
    }
  }
  // start / exit rooms
  const rooms = w.rooms, real = rooms.filter(r => !r.corr);
  const startRoom = real.slice().sort((a, b) => (a.x0 - a.y1) - (b.x0 - b.y1))[0];
  const cen = r => ({ tx: Math.floor((r.x0 + r.x1) / 2), ty: Math.floor((r.y0 + r.y1) / 2) });
  const sc = cen(startRoom); w.start = { x: sc.tx * TS + 20, y: sc.ty * TS + 20 };
  const bfs = () => { const D = new Int32Array(W * H).fill(-1), q = [I(sc.tx, sc.ty)]; D[q[0]] = 0; for (let h = 0; h < q.length; h++) { const c = q[h], cx = c % W, cy = (c / W) | 0; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = I(cx + ox, cy + oy); if (D[n] < 0 && walkT(n)) { D[n] = D[c] + 1; q.push(n); } } } return D; };
  let D = bfs();
  let exitRoom = startRoom, best = -1;
  for (const r of real) { const c = cen(r), d = D[I(c.tx, c.ty)]; if (d > best) { best = d; exitRoom = r; } }
  const ec = cen(exitRoom); w.exit = { x: ec.tx * TS + 20, y: ec.ty * TS + 20, r: 46 };
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { reserved[I(sc.tx + ox, sc.ty + oy)] = 1; reserved[I(ec.tx + ox, ec.ty + oy)] = 1; }

  function put(type, tx, ty) {
    const d = PROPS[type];
    for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) { if (!inMap(tx + dx, ty + dy)) return null; const i = I(tx + dx, ty + dy); if (T[i] !== 0 || w.blocked[i] || reserved[i] || w.propGrid[i]) return null; }
    const ins = d.inset ?? 4;
    const p = { type, mat: d.mat, low: d.low, pen: d.pen, hp: d.hp, maxHp: d.hp, blocks: d.blocks !== false, tx, ty, tw: d.w, th: d.h, x: tx * TS + ins, y: ty * TS + ins, w: d.w * TS - ins * 2, h: d.h * TS - ins * 2, dead: false, flipped: false, col: d.col, seed: R() };
    w.props.push(p);
    for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) { const i = I(tx + dx, ty + dy); (w.propGrid[i] = w.propGrid[i] || []).push(p); if (p.blocks) w.blocked[i] = 1; }
    return p;
  }
  const chair = (x, y) => w.chairs.push({ x, y, vx: 0, vy: 0, ang: R() * TAU, va: 0, down: false });
  // furnish
  for (const r of rooms) {
    if (r.corr) continue;
    const ix0 = r.x0 + 1, ix1 = r.x1 - 1, iy0 = r.y0 + 1, iy1 = r.y1 - 1;
    r.kind = r === startRoom ? 'empty' : th.rooms[Math.floor(R() * th.rooms.length)];
    const k = r.kind;
    if (k === 'office') {
      for (let y = iy0; y <= iy1; y += 3) for (let x = ix0; x + 1 <= ix1; x += 3) if (R() < .8 && put('desk', x, y)) { if (R() < .8) chair(x * TS + 20 + R() * 30, (y + 1) * TS + 12); }
    } else if (k === 'meeting') {
      const c = cen(r); if (put('desk', c.tx - 1, c.ty - 1)) { put('desk', c.tx - 1, c.ty); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; chair(c.tx * TS + Math.cos(a) * 62, c.ty * TS + Math.sin(a) * 58); } }
      if (R() < .5) put('fuse', ix0 - 1 + 1, r.y0);
    } else if (k === 'lounge') {
      for (let y = iy0; y <= iy1; y += 3) for (let x = ix0; x + 1 <= ix1; x += 4) if (R() < .6) put('sofa', x, y);
      if (R() < .5) put('crate', ix1, iy1);
    } else if (k === 'storage') {
      for (let y = iy0; y <= iy1; y += 2) for (let x = ix0; x <= ix1; x += 2) if (R() < .5) { const q = R(); put(q < .5 ? 'crate' : q < .78 ? 'metal' : 'barrel', x, y); }
    } else if (k === 'lab') {
      for (let y = iy0; y <= iy1; y += 3) for (let x = ix0; x <= ix1; x += 2) if (R() < .6) put(R() < .75 ? 'metal' : 'barrel', x, y);
      put('fuse', r.x0, iy0);
    } else if (k === 'security') {
      put('desk', ix0, iy0 + 1 <= iy1 ? iy0 + 1 : iy0); put('metal', ix1, iy0); put('metal', ix1, iy1); put('fuse', r.x0, r.y0); chair(ix0 * TS + 40, (iy0 + 2) * TS + 10);
    } else if (k === 'parking') {
      for (let y = iy0; y + 1 <= iy1; y += 4) for (let x = ix0; x + 2 <= ix1; x += 4) if (R() < .6) put('car', x, y); else if (R() < .3) put('barrel', x + 1, y);
    } else if (k === 'roof') {
      for (let y = iy0; y <= iy1; y += 2) for (let x = ix0; x <= ix1; x += 3) if (R() < .28) { const q = R(); put(q < .6 ? 'metal' : q < .85 ? 'crate' : 'barrel', x, y); }
    } else if (k === 'pillars') {
      for (let y = r.y0 + 2; y <= r.y1 - 2; y += 4) for (let x = r.x0 + 2; x <= r.x1 - 2; x += 4) if (!reserved[I(x, y)] && !w.propGrid[I(x, y)]) T[I(x, y)] = 1;
      for (let i = 0; i < 4; i++) put(R() < .5 ? 'crate' : 'barrel', ix0 + Math.floor(R() * (ix1 - ix0 + 1)), iy0 + Math.floor(R() * (iy1 - iy0 + 1)));
    } else { if (R() < .7) put('crate', ix1, iy0); if (R() < .4) put('barrel', ix0, iy1); }
    // ceiling lights
    const nx = Math.max(1, Math.round((r.x1 - r.x0 + 1) / 7)), ny = Math.max(1, Math.round((r.y1 - r.y0 + 1) / 7));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (r === startRoom || R() < th.lightP)
      w.lights.push({ x: (r.x0 + (r.x1 - r.x0 + 1) * (i + .5) / nx) * TS, y: (r.y0 + (r.y1 - r.y0 + 1) * (j + .5) / ny) * TS, r: th.lr, color: th.light[Math.floor(R() * th.light.length)], on: true, a: 1, flick: R() < (th.flick || 0), ph: R() * 10 });
    if (R() < .4) { const col = th.neon; if (R() < .5) w.neon.push({ x0: r.x0 * TS + 8, y0: r.y0 * TS + 3, x1: (r.x1 + 1) * TS - 8, y1: r.y0 * TS + 3, col }); else w.neon.push({ x0: r.x0 * TS + 3, y0: r.y0 * TS + 8, x1: r.x0 * TS + 3, y1: (r.y1 + 1) * TS - 8, col }); }
  }
  for (const r of rooms) if (r.corr) { const horiz = r.x1 - r.x0 > r.y1 - r.y0, len = horiz ? r.x1 - r.x0 : r.y1 - r.y0; for (let i = 2; i < len; i += 6) if (R() < th.lightP) w.lights.push({ x: (horiz ? r.x0 + i : r.x0 + 1) * TS, y: (horiz ? r.y0 + 1 : r.y0 + i) * TS, r: th.lr * .8, color: th.light[0], on: true, a: 1, flick: R() < (th.flick || 0), ph: R() * 10 }); }
  // reachability + spawn tiles
  D = bfs(); w.reach = D; w.startRoom = startRoom; w.exitRoom = exitRoom;
  const freeIn = r => { const out = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { const i = I(x, y); if (walkT(i) && D[i] >= 0) out.push({ tx: x, ty: y, d: D[i] }); } return out; };
  let elig = real.filter(r => r !== startRoom && D[I(cen(r).tx, cen(r).ty)] >= 9); if (elig.length < 2) elig = real.filter(r => r !== startRoom);
  for (let i = elig.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1));[elig[i], elig[j]] = [elig[j], elig[i]]; }
  w.spawnPlan = []; let ri = 0;
  for (const type in m.enemies) for (let n = 0; n < m.enemies[type]; n++) {
    const room = type === 'boss' ? exitRoom : elig[ri++ % elig.length], cells = freeIn(room); if (!cells.length) continue;
    const c = cells[Math.floor(R() * cells.length)];
    let patrol = null;
    if (type === 'guard' && R() < .6) { const o = elig[Math.floor(R() * elig.length)], oc = freeIn(o); if (oc.length) { const c2 = oc[Math.floor(R() * oc.length)]; patrol = [{ x: c.tx * TS + 20, y: c.ty * TS + 20 }, { x: c2.tx * TS + 20, y: c2.ty * TS + 20 }]; } }
    w.spawnPlan.push({ type, x: c.tx * TS + 20, y: c.ty * TS + 20, patrol, face: R() * TAU });
  }
  w.spawnTiles = []; for (const r of real) if (r !== startRoom) w.spawnTiles.push(...freeIn(r));
  for (let i = 0; i < 6; i++) { const r = real[Math.floor(R() * real.length)], cells = freeIn(r); if (cells.length) { const c = cells[Math.floor(R() * cells.length)]; w.pickups.push({ x: c.tx * TS + 20, y: c.ty * TS + 20, type: i < 2 ? 'health' : 'ammo', t: R() * 5 }); } }
  // light visibility polygons + sprites
  for (const l of w.lights) bakeLight(l);
  renderBG();
}
function bakeLight(l) {
  const pts = [], N = 90;
  for (let k = 0; k < N; k++) {
    const a = k / N * TAU, cx = Math.cos(a), cy = Math.sin(a); let d = 0;
    for (; d < l.r; d += 5) { const tx = tileOf(l.x + cx * d), ty = tileOf(l.y + cy * d); if (!inMap(tx, ty)) break; const t = World.T[tIdx(tx, ty)]; if (t === 1 || t === 3) { d += 7; break; } }
    pts.push(l.x + cx * d, l.y + cy * d);
  }
  const s = Math.ceil(l.r), mk = col => {
    const c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
    x.scale(.5, .5); x.translate(l.r - l.x, l.r - l.y); x.beginPath(); for (let i = 0; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.clip();
    const g = x.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    if (col) { g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = .2; }
    else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.55, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    x.fillStyle = g; x.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); return c;
  };
  l.mask = mk(null); l.glow = mk(l.color);
}

/* ---------------- static background ---------------- */
function renderBG() {
  const w = World, mk = () => { const c = document.createElement('canvas'); c.width = w.W * TS; c.height = w.H * TS; return c; };
  w.bg = mk(); w.bgx = w.bg.getContext('2d'); w.decal = mk(); w.dx = w.decal.getContext('2d');
  for (let ty = 0; ty < w.H; ty++) for (let tx = 0; tx < w.W; tx++) redrawTile(tx, ty);
}
function redrawTile(tx, ty) {
  const w = World, x = w.bgx, th = w.theme, t = w.T[tIdx(tx, ty)], px = tx * TS, py = ty * TS;
  const at = (ax, ay) => inMap(ax, ay) ? w.T[tIdx(ax, ay)] : 1;
  x.fillStyle = (tx + ty) & 1 ? th.floor : th.floor2; x.fillRect(px, py, TS, TS);
  x.strokeStyle = 'rgba(255,255,255,.025)'; x.lineWidth = 1; x.strokeRect(px + .5, py + .5, TS - 1, TS - 1);
  if (t === 5) {
    x.fillStyle = '#020307'; x.fillRect(px, py, TS, TS);
    const r = RNG(tx * 131 + ty * 977); for (let i = 0; i < 3; i++) { x.fillStyle = `rgba(${150 + r() * 100 | 0},${150 + r() * 80 | 0},255,${.12 + r() * .25})`; x.fillRect(px + r() * 36, py + r() * 36, 2, 2); }
    x.fillStyle = th.edge; x.globalAlpha = .5;
    if (at(tx - 1, ty) === 0) x.fillRect(px, py, 2, TS); if (at(tx + 1, ty) === 0) x.fillRect(px + TS - 2, py, 2, TS);
    if (at(tx, ty - 1) === 0) x.fillRect(px, py, TS, 2); if (at(tx, ty + 1) === 0) x.fillRect(px, py + TS - 2, TS, 2); x.globalAlpha = 1;
  } else if (t === 1 || t === 3) {
    x.fillStyle = t === 1 ? th.wall : '#121419'; x.fillRect(px, py, TS, TS);
    if (t === 3) { x.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 4; i < TS; i += 8) x.fillRect(px + i, py, 2, TS); }
    x.fillStyle = th.edge; x.globalAlpha = t === 1 ? .9 : .55;
    const open = c => c === 0 || c === 2 || c === 5;
    if (open(at(tx - 1, ty))) x.fillRect(px, py, 2, TS); if (open(at(tx + 1, ty))) x.fillRect(px + TS - 2, py, 2, TS);
    if (open(at(tx, ty - 1))) x.fillRect(px, py, TS, 2); if (open(at(tx, ty + 1))) x.fillRect(px, py + TS - 2, TS, 2); x.globalAlpha = 1;
  } else if (t === 2) {
    const hz = at(tx - 1, ty) !== 0 || at(tx + 1, ty) !== 0;
    x.fillStyle = 'rgba(120,215,255,.13)'; x.strokeStyle = 'rgba(170,235,255,.65)'; x.lineWidth = 1.5;
    if (hz) { x.fillRect(px, py + 14, TS, 12); x.beginPath(); x.moveTo(px, py + 14); x.lineTo(px + TS, py + 14); x.moveTo(px, py + 26); x.lineTo(px + TS, py + 26); x.stroke(); }
    else { x.fillRect(px + 14, py, 12, TS); x.beginPath(); x.moveTo(px + 14, py); x.lineTo(px + 14, py + TS); x.moveTo(px + 26, py); x.lineTo(px + 26, py + TS); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.moveTo(px + 12, py + 24); x.lineTo(px + 24, py + 12); x.stroke();
  }
}

/* ---------------- collision ---------------- */
function solidCode(tx, ty, air) {
  if (!inMap(tx, ty)) return 1;
  const i = tIdx(tx, ty), t = World.T[i];
  if (t) return (t === 5 && air) ? 0 : t;
  const d = World.doorAt[i]; if (d && !d.open && !d.dead) return 9;
  return 0;
}
const circRect = (cx, cy, r, x, y, w, h) => { const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h); return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r; };
function circleHits(c, air, ignore) {
  const r = c.r, x0 = tileOf(c.x - r), x1 = tileOf(c.x + r), y0 = tileOf(c.y - r), y1 = tileOf(c.y + r);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const code = solidCode(tx, ty, air);
    if (code && circRect(c.x, c.y, r, tx * TS, ty * TS, TS, TS)) return { tile: code, tx, ty, door: code === 9 ? World.doorAt[tIdx(tx, ty)] : null };
    if (!code && inMap(tx, ty)) { const ps = World.propGrid[tIdx(tx, ty)]; if (ps) for (const p of ps) if (p !== ignore && p.blocks && !p.dead && !(air && p.low) && circRect(c.x, c.y, r, p.x, p.y, p.w, p.h)) return { prop: p }; }
  }
  return null;
}
function moveCircle(c, dx, dy, air) {
  let ignore = null; const h0 = circleHits(c, air);
  if (h0 && h0.prop) { ignore = h0.prop; const p = h0.prop, ox = c.x - (p.x + p.w / 2), oy = c.y - (p.y + p.h / 2), l = Math.hypot(ox, oy) || 1; dx += ox / l * 1.5; dy += oy / l * 1.5; }
  let hit = null, h;
  c.x += dx; if ((h = circleHits(c, air, ignore))) { c.x -= dx; hit = h; hit.nx = -Math.sign(dx); hit.ny = 0; }
  c.y += dy; if ((h = circleHits(c, air, ignore))) { c.y -= dy; if (!hit) { hit = h; hit.nx = 0; hit.ny = -Math.sign(dy); } }
  return hit;
}

/* ---------------- rays ---------------- */
// vision: blocked by concrete, drywall, closed doors
function losClear(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 9), sx = (x1 - x0) / n, sy = (y1 - y0) / n;
  for (let i = 1; i < n; i++) { const c = solidCode(tileOf(x0 + sx * i), tileOf(y0 + sy * i), true); if (c === 1 || c === 3 || c === 9) return false; }
  return true;
}
// fire line: also blocked by glass-less solid props (cover)
function shotClear(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 9), sx = (x1 - x0) / n, sy = (y1 - y0) / n;
  for (let i = 1; i < n; i++) {
    const px = x0 + sx * i, py = y0 + sy * i, tx = tileOf(px), ty = tileOf(py), c = solidCode(tx, ty, true);
    if (c === 1 || c === 3 || c === 9) return false;
    if (i * 9 > 55 && inMap(tx, ty)) { const ps = World.propGrid[tIdx(tx, ty)]; if (ps) for (const p of ps) if (p.blocks && !p.dead && px > p.x && px < p.x + p.w && py > p.y && py < p.y + p.h) return false; }
  }
  return true;
}
function lightAt(x, y) {
  let v = Math.max(0, 1 - World.ambient) * .6;
  for (const l of World.lights) if (l.on) { const d = dist(x, y, l.x, l.y); if (d < l.r && losClear(l.x, l.y, x, y)) v += (1 - d / l.r) * 1.1; }
  return Math.min(1, v);
}

/* ---------------- A* pathfinding ---------------- */
const PF = { g: null, from: null, mark: null, stamp: 0 };
function findPath(sx, sy, gx, gy) {
  const W = World.W, H = World.H, N = W * H;
  if (!PF.g || PF.g.length !== N) { PF.g = new Float32Array(N); PF.from = new Int32Array(N); PF.mark = new Uint32Array(N); PF.stamp = 0; }
  const stx = clamp(tileOf(sx), 0, W - 1), sty = clamp(tileOf(sy), 0, H - 1); let gtx = clamp(tileOf(gx), 0, W - 1), gty = clamp(tileOf(gy), 0, H - 1);
  if (!walkT(tIdx(gtx, gty))) { let f = null; for (let r = 1; r <= 3 && !f; r++) for (let oy = -r; oy <= r && !f; oy++) for (let ox = -r; ox <= r; ox++) if (inMap(gtx + ox, gty + oy) && walkT(tIdx(gtx + ox, gty + oy))) { f = [gtx + ox, gty + oy]; break; } if (!f) return null; gtx = f[0]; gty = f[1]; gx = gtx * TS + 20; gy = gty * TS + 20; }
  const s = tIdx(stx, sty), goal = tIdx(gtx, gty); if (s === goal) return [{ x: gx, y: gy }];
  const st = ++PF.stamp, g = PF.g, from = PF.from, mark = PF.mark, heapI = [], heapF = [];
  const push = (i, f) => { let k = heapI.length; heapI.push(i); heapF.push(f); while (k > 0) { const p = (k - 1) >> 1; if (heapF[p] <= f) break; heapI[k] = heapI[p]; heapF[k] = heapF[p]; k = p; } heapI[k] = i; heapF[k] = f; };
  const pop = () => { const top = heapI[0], li = heapI.pop(), lf = heapF.pop(); const n = heapI.length; if (n) { let k = 0; for (; ;) { let c = k * 2 + 1; if (c >= n) break; if (c + 1 < n && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= lf) break; heapI[k] = heapI[c]; heapF[k] = heapF[c]; k = c; } heapI[k] = li; heapF[k] = lf; } return top; };
  const hx = i => { const dx = Math.abs(i % W - gtx), dy = Math.abs(((i / W) | 0) - gty); return Math.max(dx, dy) + .41 * Math.min(dx, dy); };
  g[s] = 0; from[s] = -1; mark[s] = st; push(s, hx(s));
  let iter = 0, found = false;
  while (heapI.length && iter++ < 3000) {
    const c = pop(); if (c === goal) { found = true; break; }
    const cx = c % W, cy = (c / W) | 0, gc = g[c];
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue; const nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx; if (!walkT(n)) continue;
      if (ox && oy && (!walkT(cy * W + nx) || !walkT(ny * W + cx))) continue;
      const ng = gc + (ox && oy ? 1.41 : 1) + (World.doorAt[n] && !World.doorAt[n].open && !World.doorAt[n].dead ? 2 : 0);
      if (mark[n] === st && g[n] <= ng) continue;
      g[n] = ng; from[n] = c; mark[n] = st; push(n, ng + hx(n));
    }
  }
  if (!found) return null;
  const path = []; for (let c = goal; c !== s && c >= 0; c = from[c]) path.push({ x: (c % W) * TS + 20, y: ((c / W) | 0) * TS + 20 });
  path.reverse(); path[path.length - 1] = { x: gx, y: gy }; return path;
}

/* ---------------- destruction (persistent for the mission) ---------------- */
function shatterGlass(tx, ty, dirx = 0, diry = 0, by, chain = 0) {
  if (!inMap(tx, ty)) return; const i = tIdx(tx, ty); if (World.T[i] !== 2) return;
  World.T[i] = 0; redrawTile(tx, ty);
  const cx = tx * TS + 20, cy = ty * TS + 20;
  FX.shards(cx, cy, 26, dirx, diry); Snd.play('glass'); G.stats.glass++;
  makeNoise(cx, cy, 380, 'glass'); Cam.addShake(.12);
  if (chain < 6) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(tx + ox, ty + oy) && World.T[tIdx(tx + ox, ty + oy)] === 2 && Math.random() < .55) G.after(.05 + Math.random() * .08, () => shatterGlass(tx + ox, ty + oy, dirx, diry, by, chain + 1));
}
function breakLight(l, quiet) {
  if (!l.on) return; l.on = false; G.stats.lights++;
  FX.sparks(l.x, l.y, 0, 14, '#fff3b0', TAU); FX.shards(l.x, l.y, 6, 0, 0);
  if (!quiet) { Snd.play('light'); makeNoise(l.x, l.y, 260, 'glass'); }
  World.dx.fillStyle = 'rgba(200,230,255,.5)'; for (let i = 0; i < 8; i++) World.dx.fillRect(l.x + rand(-14, 14), l.y + rand(-14, 14), 2, 1.5);
  G.lightDirty = 0;
}
function removeProp(p) {
  p.dead = true;
  for (let dy = 0; dy < p.th; dy++) for (let dx = 0; dx < p.tw; dx++) { const i = tIdx(p.tx + dx, p.ty + dy), a = World.propGrid[i]; if (a) { const k = a.indexOf(p); if (k >= 0) a.splice(k, 1); if (!a.length) World.propGrid[i] = undefined; } if (p.blocks) World.blocked[i] = 0; }
}
function damageProp(p, dmg, by, dirx = 0, diry = 0) {
  if (p.dead || p.mat === 'metal') return;
  p.hp -= dmg; if (p.hp > 0) return;
  removeProp(p);
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  if (p.type === 'barrel') G.after(by === 'chain' ? .1 + Math.random() * .12 : 0, () => explode(cx, cy, 140, 170, by === 'chain' ? 'p' : by));
  else if (p.type === 'car') { explode(cx, cy, 175, 200, by); const d = World.dx; d.fillStyle = '#0c0c0e'; d.fillRect(p.x, p.y, p.w, p.h); d.strokeStyle = '#2a2a2e'; d.lineWidth = 2; d.strokeRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6); }
  else if (p.type === 'fuse') blackout(cx, cy);
  else {
    FX.debris(cx, cy, 16, p.col, dirx, diry); Snd.play('crash'); makeNoise(cx, cy, 300, 'crash');
    const d = World.dx; d.fillStyle = p.col; d.globalAlpha = .7; for (let i = 0; i < 10; i++) { d.save(); d.translate(p.x + Math.random() * p.w, p.y + Math.random() * p.h); d.rotate(Math.random() * 3); d.fillRect(-5, -1.5, 4 + Math.random() * 9, 3); d.restore(); } d.globalAlpha = 1;
  }
}
function flipDesk(p, dirx, diry) {
  if (p.dead || p.flipped || (p.type !== 'desk' && p.type !== 'deskv' && p.type !== 'sofa')) return false;
  p.flipped = true; p.hp += 90; p.maxHp += 90; p.pen = 2; p.fdx = dirx; p.fdy = diry;
  FX.debris(p.x + p.w / 2, p.y + p.h / 2, 5, '#9a8f80', dirx, diry); Snd.play('crash'); makeNoise(p.x + p.w / 2, p.y + p.h / 2, 320, 'crash'); G.stats.flips++;
  return true;
}
function blackout(x, y) {
  FX.sparks(x, y, 0, 30, '#9fe8ff', TAU); Snd.play('light'); Cam.addShake(.2); makeNoise(x, y, 400, 'glass');
  let n = 0; for (const l of World.lights) if (l.on && dist(x, y, l.x, l.y) < 520) { const ll = l; n++; G.after(Math.random() * .35, () => breakLight(ll, true)); }
  if (n) Style.bonus(60, 'BLACKOUT');
  for (const e of Enemies) if (e.alive && dist(x, y, e.x, e.y) < 520) e.confuse(1.2);
}
function openDoor(d, fx, fy, violent) {
  if (d.dead || d.open) return;
  d.open = true; const cx = d.tx * TS + 20, cy = d.ty * TS + 20;
  d.side = d.v ? (fx < cx ? 1 : -1) : (fy < cy ? 1 : -1); d.vio = violent ? 1 : 0;
  Snd.play(violent ? 'crash' : 'door');
  if (violent) { makeNoise(cx, cy, 330, 'crash'); FX.debris(cx, cy, 6, '#5a4632', d.v ? d.side : 0, d.v ? 0 : d.side); Cam.addShake(.2); for (const e of Enemies) if (e.alive && dist(cx, cy, e.x, e.y) < 95) { e.stagger(.9, (e.x - cx) * 2, (e.y - cy) * 2); } }
}
function destroyDoor(d, dirx = 0, diry = 0) {
  if (d.dead) return; d.dead = true; const cx = d.tx * TS + 20, cy = d.ty * TS + 20;
  FX.debris(cx, cy, 18, '#5a4632', dirx, diry); Snd.play('crash'); makeNoise(cx, cy, 300, 'crash');
}
const doorRect = d => d.v ? { x: d.tx * TS + 15, y: d.ty * TS, w: 10, h: TS } : { x: d.tx * TS, y: d.ty * TS + 15, w: TS, h: 10 };

function explode(x, y, R, dmg, by) {
  Snd.play('boom'); Cam.addShake(.75); G.flash = Math.max(G.flash, .35);
  FX.explosion(x, y, R); G.stats.explosions++;
  G.glows.push({ x, y, r: R * 2.4, t: .5, max: .5, col: '255,170,80' });
  const d = World.dx, g = d.createRadialGradient(x, y, 4, x, y, R * .8); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(x - R, y - R, R * 2, R * 2);
  makeNoise(x, y, 900, 'boom');
  const kills = [];
  for (const e of Enemies) {
    if (!e.alive) continue; const dd = dist(x, y, e.x, e.y);
    if (dd < R && losClear(x, y, e.x, e.y)) { const f = 1 - dd / R * .7, a = Math.atan2(e.y - y, e.x - x); e.vx += Math.cos(a) * 420 * f; e.vy += Math.sin(a) * 420 * f; e.hurt(dmg * f, { env: true, by, dir: a, kx: Math.cos(a) * 300, ky: Math.sin(a) * 300 }); }
    else if (dd < R * 2.6) e.onExplosion(x, y);
  }
  if (P.alive) { const dd = dist(x, y, P.x, P.y); if (dd < R && losClear(x, y, P.x, P.y)) { const f = 1 - dd / R * .7, a = Math.atan2(P.y - y, P.x - x); P.vx += Math.cos(a) * 300 * f; P.vy += Math.sin(a) * 300 * f; hurtPlayer(dmg * .4 * f, x, y); } }
  for (const p of World.props.slice()) if (!p.dead) { const dd = dist(x, y, p.x + p.w / 2, p.y + p.h / 2); if (dd < R) damageProp(p, dmg * (1 - dd / R * .6), p.type === 'barrel' ? 'chain' : by); }
  const t0 = tileOf(x - R), t1 = tileOf(x + R), u0 = tileOf(y - R), u1 = tileOf(y + R);
  for (let ty = u0; ty <= u1; ty++) for (let tx = t0; tx <= t1; tx++) if (inMap(tx, ty)) {
    const cx = tx * TS + 20, cy = ty * TS + 20; if (dist(x, y, cx, cy) > R) continue; const i = tIdx(tx, ty);
    if (World.T[i] === 2) shatterGlass(tx, ty, cx - x, cy - y, by);
    const dr = World.doorAt[i]; if (dr && !dr.dead) destroyDoor(dr, cx - x, cy - y);
  }
  for (const l of World.lights) if (l.on && dist(x, y, l.x, l.y) < R * .9) breakLight(l, true);
  for (const c of World.chairs) { const dd = dist(x, y, c.x, c.y); if (dd < R * 1.3) { const a = Math.atan2(c.y - y, c.x - x), f = 1 - dd / (R * 1.3); c.vx += Math.cos(a) * 600 * f; c.vy += Math.sin(a) * 600 * f; c.va = rand(-12, 12); c.down = true; } }
}

/* sound propagation: unaware enemies come to investigate */
function makeNoise(x, y, r, kind) {
  for (const e of Enemies) { if (!e.alive) continue; const d = dist(x, y, e.x, e.y); if (d < r * (losClear(x, y, e.x, e.y) ? 1 : .6)) e.hear(x, y, kind); }
}

function updateWorld(dt) {
  for (const c of World.chairs) {
    const sp = Math.hypot(c.vx, c.vy);
    if (sp > 1) {
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
      if (solidCode(tileOf(nx), tileOf(c.y), false)) c.vx *= -.4; else c.x = nx;
      if (solidCode(tileOf(c.x), tileOf(ny), false)) c.vy *= -.4; else c.y = ny;
      const f = Math.exp(-4 * dt); c.vx *= f; c.vy *= f; c.ang += c.va * dt; c.va *= f;
    }
  }
  const push = ch => { for (const c of World.chairs) { const dx = c.x - ch.x, dy = c.y - ch.y, d = Math.hypot(dx, dy); if (d < 17 && d > .01) { const s = Math.hypot(ch.vx, ch.vy); c.vx = dx / d * (60 + s * .9); c.vy = dy / d * (60 + s * .9); if (s > 150) { c.down = true; c.va = rand(-10, 10); } } } };
  if (P.alive && P.z < 8) push(P); for (const e of Enemies) if (e.alive) push(e);
  for (const d of World.doors) if (d.open && d.swing < 1) d.swing = Math.min(1, d.swing + dt * (d.vio ? 14 : 6));
  for (const l of World.lights) { if (!l.on) { l.a = 0; continue; } l.a = l.flick ? (Math.sin(G.time * 13 + l.ph) + Math.sin(G.time * 31 + l.ph * 2) > 1.25 ? .25 : 1) : 1; }
  for (const p of World.pickups) p.t += dt;
}
