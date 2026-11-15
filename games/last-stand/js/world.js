'use strict';
/* ===== world: level generation, tiles, collision, hazards, parallax backgrounds ===== */
// tiles: 0 air, 1 solid, 2 one-way, 3 ice, 4 conveyor ←, 5 conveyor →, 6 hazard (spikes/toxic/lava), 7 water, 8 quicksand, 9 cracking ice
const ROWS = 17, SOLID = { 1: 1, 3: 1, 4: 1, 5: 1, 9: 1 };
const World = {
  cols: 0, map: null, ents: [], L: null, W: 0, arenaX: 0, bg: null, checkpoints: [], crack: {}, deco: [],
  t(c, r) { if (c < 0) return 1; if (c >= this.cols || r < 0) return 0; if (r >= ROWS) return 0; return this.map[c * ROWS + r]; },
  set(c, r, v) { if (c >= 0 && c < this.cols && r >= 0 && r < ROWS) this.map[c * ROWS + r] = v; },
  solidPx(x, y) { return !!SOLID[this.t(Math.floor(x / TS), Math.floor(y / TS))]; },
  build(li) {
    const L = LEVELS[li]; this.L = L; this.li = li; const rng = seeded(1000 + li * 77); const cols = []; const ents = []; const deco = []; this.checkpoints = [];
    let g = 13; // current ground row (top solid row)
    const col = (h, top, extra) => { const c = new Array(ROWS).fill(0); if (h != null) for (let r = h; r < ROWS; r++) c[r] = r === h ? (top || 1) : 1; if (extra) extra(c); cols.push(c); return cols.length - 1; };
    const X = () => cols.length * TS; // current pixel x
    const spawn = (e, cx, row, o) => ents.push(Object.assign({ k: 'spawn', e, x: cx * TS + TS / 2, y: row * TS }, o || {}));
    const prop = (k, cx, row, o) => ents.push(Object.assign({ k, x: cx * TS, y: row * TS }, o || {}));
    const plat = (c0, row, w, ty) => { for (let i = 0; i < w; i++) { const c = cols[c0 + i]; if (c) c[row] = ty || 2; } };
    let ci = 0; const P = () => ci / L.chunks.length; // progress 0..1 for difficulty
    const pool = L.pool, enemy = (cx, row) => { const p = P(); const opts = pool.slice(0, Math.max(3, Math.ceil(pool.length * (.35 + p * .75)))).filter(e => e !== 'turret'); spawn(pick(opts), cx, row); };
    const groundTop = () => L.id === 'frozen' ? 3 : L.id === 'factory' ? 1 : 1;
    const C = {
      start: () => { for (let i = 0; i < 20; i++) col(13, groundTop()); this.checkpoints.push(3 * TS); prop('sign', 8, 13, { txt: L.sub }); },
      check: () => { const c0 = cols.length; for (let i = 0; i < 10; i++) col(g, groundTop()); prop('checkpoint', c0 + 4, g); this.checkpoints.push((c0 + 4) * TS); prop('med', c0 + 7, g); },
      flat: () => { const c0 = cols.length; for (let i = 0; i < 18; i++) { if (i % 9 === 4 && rng() < .5) g = clamp(g + (rng() < .5 ? -1 : 1), 11, 14); col(g, groundTop()); } enemy(c0 + 8, g); enemy(c0 + 15, g); if (rng() < .5) prop('crate', c0 + 11, g); },
      barrels: () => { const c0 = cols.length; for (let i = 0; i < 16; i++) col(g, groundTop()); prop('barrel', c0 + 4, g); prop('barrel', c0 + 5, g); prop('crate', c0 + 9, g); prop('barrel', c0 + 13, g); enemy(c0 + 7, g); enemy(c0 + 12, g); },
      steps: () => { const c0 = cols.length; const base = g; let top = g, last = g; for (let i = 0; i < 18; i++) { const s = i < 9 ? Math.max(9, base - Math.floor(i / 3)) : Math.min(14, base - 3 + Math.floor((i - 9) / 3)); col(s, groundTop()); if (i === 8) top = s; last = s; } spawn('sniper', c0 + 8, top); enemy(c0 + 15, last); g = last; if (rng() < .5) prop('tag', c0 + 7, top); },
      gap: () => { const c0 = cols.length; for (let i = 0; i < 5; i++) col(g, groundTop()); const w = 4 + Math.floor(rng() * 2); for (let i = 0; i < w; i++) col(null); plat(c0 + 5, g - 2, w); for (let i = 0; i < 6; i++) col(g, groundTop()); spawn('drone', c0 + 7, g - 6); enemy(c0 + 5 + w + 3, g); },
      platforms: () => { const c0 = cols.length; for (let i = 0; i < 22; i++) col(i > 6 && i < 15 ? null : g, groundTop()); plat(c0 + 4, g - 3, 5); plat(c0 + 10, g - 5, 5); plat(c0 + 14, g - 2, 4); plat(c0 + 7, g - 7, 4); enemy(c0 + 12, g - 5); enemy(c0 + 19, g); prop('tag', c0 + 8, g - 7); },
      outpost: () => { const c0 = cols.length; for (let i = 0; i < 20; i++) col(i >= 7 && i <= 12 ? g - 3 : g, groundTop()); spawn('turret', c0 + 10, g - 3); enemy(c0 + 4, g); enemy(c0 + 16, g); spawn('shield', c0 + 18, g); prop('crate', c0 + 14, g); prop('sandbag', c0 + 5, g); },
      water: () => { const c0 = cols.length; for (let i = 0; i < 16; i++) col(14, 1, c => { if (i > 2 && i < 13) { c[13] = 7; c[12] = 7; } }); g = 14; spawn('drone', c0 + 8, 8); enemy(c0 + 14, 14); plat(c0 + 6, 10, 3); },
      trees: () => { const c0 = cols.length; for (let i = 0; i < 20; i++) col(g, groundTop()); plat(c0 + 3, g - 4, 4); plat(c0 + 9, g - 6, 4); plat(c0 + 15, g - 4, 4); spawn('sniper', c0 + 10, g - 6); spawn('sniper', c0 + 16, g - 4); enemy(c0 + 12, g); prop('tag', c0 + 4, g - 4); deco.push({ k: 'tree', x: (c0 + 5) * TS, y: (g) * TS }, { k: 'tree', x: (c0 + 11) * TS, y: g * TS }, { k: 'tree', x: (c0 + 17) * TS, y: g * TS }); },
      turrets: () => { const c0 = cols.length; for (let i = 0; i < 18; i++) col(i >= 13 ? g - 4 : g, groundTop()); spawn('turret', c0 + 14, g - 4); spawn('turret', c0 + 17, g - 4); plat(c0 + 8, g - 2, 3); enemy(c0 + 6, g); prop('barrel', c0 + 11, g); },
      spikes: () => { const c0 = cols.length; for (let i = 0; i < 4; i++) col(g, groundTop()); for (let i = 0; i < 10; i++) col(15, 6); for (let i = 0; i < 4; i++) col(g, groundTop()); plat(c0 + 5, g - 2, 3); plat(c0 + 9, g - 3, 3); plat(c0 + 12, g - 1, 2); spawn('drone', c0 + 9, g - 7); },
      gauntlet: () => { const c0 = cols.length; for (let i = 0; i < 26; i++) col(g, groundTop()); plat(c0 + 8, g - 3, 5); plat(c0 + 16, g - 3, 5); spawn('heavy', c0 + 12, g); enemy(c0 + 6, g); enemy(c0 + 18, g); enemy(c0 + 22, g); if (L.pool.includes('commander')) spawn('commander', c0 + 24, g); prop('capsule', c0 + 2, 5); prop('barrel', c0 + 15, g); },
      arena: () => { const c0 = cols.length; this.arenaX = c0 * TS; for (let i = 0; i < 34; i++) col(13, groundTop(), c => { if (i === 33) for (let r = 0; r < 13; r++) c[r] = 1; }); prop('bossTrigger', c0 + 4, 13); if (L.id !== 'desert' && L.id !== 'factory') { plat(c0 + 6, 10, 4); plat(c0 + 23, 10, 4); } else { plat(c0 + 8, 9, 3); plat(c0 + 22, 9, 3); } g = 13; },
      // desert
      dunes: () => { const c0 = cols.length; for (let i = 0; i < 22; i++) { const s = Math.round(12 + Math.sin(i / 3.5) * 1.6); col(s, groundTop()); } g = 12; enemy(c0 + 6, 11); enemy(c0 + 14, 11); spawn('drone', c0 + 18, 6); },
      ruins: () => { const c0 = cols.length; for (let i = 0; i < 20; i++) col(g, groundTop(), c => { if (i === 5 || i === 6) for (let r = g - 4; r < g; r++) c[r] = 1; if (i === 14) for (let r = g - 2; r < g; r++) c[r] = 1; }); plat(c0 + 9, g - 4, 4); spawn('sniper', c0 + 5, g - 4); enemy(c0 + 11, g - 4); enemy(c0 + 17, g); prop('crate', c0 + 2, g); prop('tag', c0 + 6, g - 4); },
      snipers: () => { const c0 = cols.length; for (let i = 0; i < 18; i++) col(g, groundTop()); plat(c0 + 4, g - 4, 3); plat(c0 + 12, g - 6, 3); spawn('sniper', c0 + 5, g - 4); spawn('sniper', c0 + 13, g - 6); enemy(c0 + 9, g); prop('sandbag', c0 + 8, g); },
      tank: () => { const c0 = cols.length; for (let i = 0; i < 26; i++) col(13, groundTop()); g = 13; spawn('tank', c0 + 22, 13); enemy(c0 + 10, 13); prop('barrel', c0 + 6, 13); prop('capsule', c0 + 3, 4); },
      quicksand: () => { const c0 = cols.length; for (let i = 0; i < 18; i++) col(15, 1, c => { if (i > 3 && i < 14) { c[14] = 8; c[13] = 8; } else { c[13] = 1; c[14] = 1; } }); g = 13; plat(c0 + 6, 10, 3); plat(c0 + 10, 9, 3); spawn('drone', c0 + 9, 5); enemy(c0 + 16, 13); },
      // factory
      conveyor: () => { const c0 = cols.length; const d = rng() < .5 ? 4 : 5; for (let i = 0; i < 18; i++) col(g, i > 2 && i < 16 ? d : 1); enemy(c0 + 8, g); spawn('kamikaze', c0 + 15, g); plat(c0 + 6, g - 4, 5); prop('barrel', c0 + 12, g); },
      toxic: () => { const c0 = cols.length; for (let i = 0; i < 4; i++) col(g, 1); for (let i = 0; i < 10; i++) col(15, 1, c => { c[14] = 6; c[13] = 6; }); for (let i = 0; i < 4; i++) col(g, 1); plat(c0 + 5, g - 2, 3); plat(c0 + 10, g - 3, 3); spawn('drone', c0 + 8, g - 7); prop('pipe', c0 + 7, 2); prop('tag', c0 + 11, g - 3); },
      crusher: () => { const c0 = cols.length; for (let i = 0; i < 20; i++) col(g, 1); prop('crusher', c0 + 6, g, { ph: 0 }); prop('crusher', c0 + 11, g, { ph: 1.2 }); prop('crusher', c0 + 16, g, { ph: 2.4 }); enemy(c0 + 19, g); },
      robots: () => { const c0 = cols.length; for (let i = 0; i < 20; i++) col(g, 1); spawn('kamikaze', c0 + 10, g); spawn('kamikaze', c0 + 14, g); spawn('kamikaze', c0 + 18, g); spawn('drone', c0 + 12, g - 6); spawn('drone', c0 + 16, g - 7); plat(c0 + 5, g - 3, 4); },
      // frozen
      ice: () => { const c0 = cols.length; for (let i = 0; i < 18; i++) col(g, 3); enemy(c0 + 9, g); spawn('shield', c0 + 15, g); plat(c0 + 5, g - 3, 4); },
      icicles: () => { const c0 = cols.length; for (let i = 0; i < 18; i++) col(g, 3, c => { c[2] = 1; c[3] = 1; }); for (let i = 3; i < 16; i += 3) prop('icicle', c0 + i, 4); enemy(c0 + 12, g); },
      lake: () => { const c0 = cols.length; for (let i = 0; i < 4; i++) col(g, 3); for (let i = 0; i < 12; i++) col(g, 9); for (let i = 0; i < 4; i++) col(g, 3); plat(c0 + 7, g - 4, 3); spawn('drone', c0 + 9, g - 7); enemy(c0 + 18, g); prop('tag', c0 + 8, g - 4); },
      // fortress
      lasers: () => { const c0 = cols.length; for (let i = 0; i < 20; i++) col(g, 1); prop('laser', c0 + 6, g, { ph: 0 }); prop('laser', c0 + 12, g, { ph: 1.1 }); enemy(c0 + 9, g); enemy(c0 + 17, g); plat(c0 + 14, g - 3, 3); },
      mines: () => { const c0 = cols.length; for (let i = 0; i < 18; i++) col(g, 1); for (let i = 4; i < 16; i += 3) prop('mine', c0 + i, g); plat(c0 + 6, g - 3, 6); enemy(c0 + 16, g); spawn('drone', c0 + 10, g - 7); prop('tag', c0 + 9, g - 3); },
      flames: () => { const c0 = cols.length; for (let i = 0; i < 18; i++) col(g, 1); prop('flamejet', c0 + 5, g, { ph: 0 }); prop('flamejet', c0 + 9, g, { ph: .9 }); prop('flamejet', c0 + 13, g, { ph: 1.8 }); plat(c0 + 7, g - 4, 5); enemy(c0 + 16, g); }
    };
    const ZT = { outpost: 1, turrets: 1, gauntlet: 1, tank: 1, robots: 1, snipers: 1, trees: 1, ruins: 1, crusher: 1, lasers: 1 }; const zones = [];
    for (const id of L.chunks) { const z0 = cols.length, e0 = ents.length; (C[id] || C.flat)(); const c1 = cols.length; if (id !== 'start' && id !== 'check' && id !== 'arena' && rng() < .35 + P() * .5) { let r = 0; const cc = c1 - 3; while (r < ROWS && !(SOLID[cols[cc] && cols[cc][r]] || (cols[cc] && cols[cc][r] === 2))) r++; if (r < ROWS) enemy(cc, r); } if (ZT[id] && ci > 1) { const zi = zones.length; let n = 0; for (let k = e0; k < ents.length; k++) if (ents[k].k === 'spawn') { ents[k].zone = zi; n++; } if (n) zones.push({ x0: z0 * TS, x1: c1 * TS, id, n }); } ci++; }
    this.zones = zones;
    this.cols = cols.length; this.W = this.cols * TS; this.map = new Uint8Array(this.cols * ROWS);
    cols.forEach((c, i) => c.forEach((v, r) => { this.map[i * ROWS + r] = v; }));
    // place every entity on the surface beneath its column so nothing floats or sinks
    for (const e of ents) if (e.k !== 'capsule' && e.k !== 'icicle' && e.k !== 'pipe' && !(e.k === 'spawn' && (e.e === 'drone'))) { const c = Math.floor(e.x / TS); let r = Math.max(0, Math.floor(e.y / TS) - 1); while (r < ROWS && !(SOLID[this.t(c, r)] || this.t(c, r) === 2)) r++; while (r > 0 && (SOLID[this.t(c, r - 1)] || this.t(c, r - 1) === 2)) r--; e.y = r * TS; }
    this.ents = ents; this.deco = deco; this.crack = {}; this.bg = Bg.make(L, li); this.bgL = li;
    // decorative scatter
    const rr = seeded(li * 31 + 5);
    for (let c = 2; c < this.cols - 2; c += 1) { if (rr() < .16) { let r = 0; while (r < ROWS && !SOLID[this.t(c, r)]) r++; if (r < ROWS && r > 3) this.deco.push({ k: 'plant', x: c * TS + rr() * TS, y: r * TS, s: .6 + rr() * .8, v: rr() }); } }
  },
  surfaceY(x, fromY) { const c = Math.floor(x / TS); for (let r = Math.max(0, Math.floor(fromY / TS)); r < ROWS; r++) { const t = this.t(c, r); if (SOLID[t] || t === 2) return r * TS; } return null; },
  /* AABB move with tile collision; returns flags */
  move(o, dt) {
    const res = { ground: false, wallL: false, wallR: false, ceil: false, tile: 0 };
    // horizontal
    let nx = o.x + o.vx * dt; const r0 = Math.floor((o.y + 2) / TS), r1 = Math.floor((o.y + o.h - 2) / TS);
    if (o.vx > 0) { const c = Math.floor((nx + o.w) / TS); for (let rr = r0; rr <= r1; rr++) if (SOLID[this.t(c, rr)]) { nx = c * TS - o.w - .01; o.vx = 0; res.wallR = true; break; } }
    else if (o.vx < 0) { const c = Math.floor(nx / TS); for (let rr = r0; rr <= r1; rr++) if (SOLID[this.t(c, rr)]) { nx = (c + 1) * TS + .01; o.vx = 0; res.wallL = true; break; } }
    o.x = nx;
    // vertical
    let ny = o.y + o.vy * dt; const c0 = Math.floor((o.x + 2) / TS), c1 = Math.floor((o.x + o.w - 2) / TS);
    if (o.vy > 0) {
      const rowN = Math.floor((ny + o.h) / TS), prevBot = o.y + o.h;
      for (let c = c0; c <= c1; c++) { const t = this.t(c, rowN); if (SOLID[t] || (t === 2 && prevBot <= rowN * TS + 1 && !o.drop)) { ny = rowN * TS - o.h; o.vy = 0; res.ground = true; res.tile = t; res.gc = c; res.gr = rowN; break; } }
    } else if (o.vy < 0) {
      const rowN = Math.floor(ny / TS);
      for (let c = c0; c <= c1; c++) if (SOLID[this.t(c, rowN)]) { ny = (rowN + 1) * TS + .01; o.vy = 0; res.ceil = true; break; }
    }
    o.y = ny; return res;
  },
  liquidAt(o) { const c0 = Math.floor((o.x + 3) / TS), c1 = Math.floor((o.x + o.w - 3) / TS), r = Math.floor((o.y + o.h - 4) / TS), r2 = Math.floor((o.y + o.h * .5) / TS); let best = 0; for (let c = c0; c <= c1; c++) { for (const rr of [r, r2]) { const t = this.t(c, rr); if (t === 6 || t === 7 || t === 8) best = Math.max(best, t); } } return best; },
  lineClear(x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 14); for (let i = 1; i < n; i++) { const t = i / n; if (this.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; } return true; },
  update(dt) { // cracking ice
    for (const k in this.crack) { const c = this.crack[k]; c.t += dt; if (c.t > .9 && !c.done) { c.done = 1; const [cc, rr] = k.split(',').map(Number); this.set(cc, rr, 0); this.set(cc, rr + 1, 7); Snd.play('crack'); for (let i = 0; i < 8; i++) FX.debris(cc * TS + 16, rr * TS + 8, '#cfeaff'); } }
  },
  stepOn(gc, gr, tile) { if (tile === 9) { const k = gc + ',' + gr; if (!this.crack[k]) { this.crack[k] = { t: 0 }; Snd.play('crack', .5); } } }
};

/* ---------- procedural parallax backgrounds ---------- */
const Bg = {
  make(L, li) {
    const P = L.pal, mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), c); return c; };
    const r = seeded(li * 991 + 3), id = L.id;
    const far = mk(1200, H, g => {
      if (id === 'jungle') { g.fillStyle = P.far; for (let i = 0; i < 9; i++) { const x = i * 150 + r() * 60; g.beginPath(); g.moveTo(x - 160, 420); g.quadraticCurveTo(x, 150 + r() * 80, x + 170, 420); g.fill(); } }
      else if (id === 'desert') { g.fillStyle = P.far; g.beginPath(); g.moveTo(0, 400); for (let x = 0; x <= 1200; x += 40) g.lineTo(x, 330 + Math.sin(x / 140) * 30 + Math.sin(x / 61) * 12); g.lineTo(1200, H); g.lineTo(0, H); g.fill(); g.fillStyle = shade(P.far, .85); for (let i = 0; i < 3; i++) { const x = 150 + i * 400 + r() * 100; g.beginPath(); g.moveTo(x - 90, 360); g.lineTo(x, 230 + r() * 40); g.lineTo(x + 90, 360); g.fill(); } }
      else if (id === 'factory') { for (let i = 0; i < 14; i++) { const x = i * 90 + r() * 40, w = 40 + r() * 70, h = 120 + r() * 200; g.fillStyle = P.far; g.fillRect(x, 420 - h, w, h); if (r() < .5) { g.fillRect(x + w * .3, 420 - h - 80, 14, 80); } g.fillStyle = 'rgba(255,170,60,.35)'; for (let k = 0; k < 6; k++) if (r() < .5) g.fillRect(x + 6 + r() * (w - 12), 420 - h + 10 + r() * (h - 30), 4, 6); } }
      else if (id === 'frozen') { g.fillStyle = P.far; g.beginPath(); g.moveTo(0, 420); for (let x = 0; x <= 1200; x += 60) g.lineTo(x, 200 + Math.abs(Math.sin(x / 170)) * -60 + 120 + r() * 50); g.lineTo(1200, H); g.lineTo(0, H); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 0; x < 1200; x += 60) { g.beginPath(); g.moveTo(x - 20, 300); g.lineTo(x, 270 + r() * 30); g.lineTo(x + 20, 300); g.fill(); } }
      else { g.fillStyle = P.far; for (let i = 0; i < 10; i++) { const x = i * 125, h = 160 + r() * 160; g.fillRect(x, 420 - h, 90, h); for (let k = 0; k < 4; k++) g.fillRect(x + k * 24, 420 - h - 14, 14, 14); g.fillStyle = 'rgba(255,60,60,.5)'; g.fillRect(x + 40, 420 - h + 30, 8, 14); g.fillStyle = P.far; } }
    });
    const mid = mk(1400, H, g => {
      g.fillStyle = P.mid;
      if (id === 'jungle') { for (let i = 0; i < 16; i++) { const x = i * 90 + r() * 40, h = 180 + r() * 140; g.fillRect(x, 440 - h, 10, h); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.ellipse(x + 5 + Math.cos(a) * 30, 440 - h + Math.sin(a) * 14, 42, 14, a, 0, TAU); } g.fill(); } g.fillRect(0, 430, 1400, 120); }
      else if (id === 'desert') { g.beginPath(); g.moveTo(0, 460); for (let x = 0; x <= 1400; x += 30) g.lineTo(x, 420 + Math.sin(x / 90) * 18); g.lineTo(1400, H); g.lineTo(0, H); g.fill(); for (let i = 0; i < 5; i++) { const x = 100 + i * 280 + r() * 60; g.fillRect(x, 330, 26, 100); g.fillRect(x + 40, 360, 22, 70); g.fillRect(x - 10, 320, 82, 12); } }
      else if (id === 'factory') { for (let i = 0; i < 7; i++) { const x = i * 200 + r() * 40; g.fillRect(x, 260, 140, 200); g.fillRect(x + 20, 160, 22, 110); g.fillRect(x + 70, 190, 18, 80); g.strokeStyle = P.mid; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 140, 300); g.lineTo(x + 200, 300); g.stroke(); g.fillStyle = 'rgba(255,170,60,.25)'; g.fillRect(x + 30, 300, 80, 6); g.fillStyle = P.mid; } }
      else if (id === 'frozen') { for (let i = 0; i < 12; i++) { const x = i * 120 + r() * 50, h = 100 + r() * 120; g.beginPath(); g.moveTo(x - 40, 460); g.lineTo(x, 460 - h); g.lineTo(x + 40, 460); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x - 10, 460 - h * .7); g.lineTo(x, 460 - h); g.lineTo(x + 10, 460 - h * .7); g.fill(); g.fillStyle = P.mid; } }
      else { for (let i = 0; i < 6; i++) { const x = i * 240; g.fillRect(x, 230, 200, 260); g.fillRect(x + 80, 120, 40, 120); g.fillStyle = 'rgba(255,40,60,.45)'; g.fillRect(x + 92, 140, 16, 8); g.fillStyle = P.mid; for (let k = 0; k < 8; k++) g.fillRect(x + k * 26, 214, 16, 18); } }
    });
    return { far, mid };
  },
  draw(cx) {
    const P = World.L.pal, g = ctx, B = World.bg, id = World.L.id;
    if (!B.sky) { const c = document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d');
      const sk = q.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, P.sky[0]); sk.addColorStop(.6, P.sky[1]); sk.addColorStop(1, P.sky[2]); q.fillStyle = sk; q.fillRect(0, 0, W, H);
      const sx = 700, sy = id === 'desert' ? 150 : 110; q.globalCompositeOperation = 'lighter'; const sg = q.createRadialGradient(sx, sy, 4, sx, sy, id === 'desert' ? 260 : 160); sg.addColorStop(0, id === 'fortress' ? 'rgba(255,80,60,.55)' : id === 'desert' ? 'rgba(255,230,160,.8)' : 'rgba(220,240,255,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = sg; q.fillRect(0, 0, W, H); q.globalCompositeOperation = 'source-over';
      q.fillStyle = id === 'desert' ? '#fff3c8' : id === 'fortress' ? '#ff7a6a' : '#e8f0ff'; q.beginPath(); q.arc(sx, sy, id === 'desert' ? 44 : 30, 0, TAU); q.fill();
      if (id === 'factory' || id === 'fortress' || id === 'jungle') { q.fillStyle = 'rgba(255,255,255,.6)'; const rr = seeded(7); for (let k = 0; k < 60; k++) q.fillRect(rr() * W, rr() * 260, 1.5, 1.5); }
      B.sky = c; }
    g.drawImage(B.sky, 0, 0);
    const tile = (c, p, y) => { const w = c.width, off = ((cx * p) % w + w) % w; for (let x = -off; x < W; x += w) g.drawImage(c, Math.round(x), y || 0); };
    tile(B.far, .12); g.fillStyle = P.fog; g.fillRect(0, 0, W, H); tile(B.mid, .35, 20);
    g.fillStyle = P.fog; g.fillRect(0, 0, W, H);
  }
};
