// GHOSTBLADE - world: tile grid, districts, landmarks, props, lights, zones
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T;
  // tile types
  const AIR = 0, SOLID = 1, PLAT = 2, LADDER = 3, WATER = 4, SMOOTH = 5, DOOR = 6, GLASS = 7, FACADE = 8;
  const WW = 760, WH = 92, G = 60;

  const W = GB.world = {
    AIR, SOLID, PLAT, LADDER, WATER, SMOOTH, DOOR, GLASS, FACADE,
    w: WW, h: WH, G, pxW: WW * T, pxH: WH * T, groundY: G * T,
    tiles: new Uint8Array(WW * WH), mat: new Uint8Array(WW * WH),
    version: 0, dirty: [],
    districts: [
      { id: 'harbor', name: 'The Harbor', x0: 0, x1: 125, tag: 'Salt, tar and secrets' },
      { id: 'slums', name: 'The Slums', x0: 125, x1: 250, tag: 'Where the city forgets its own' },
      { id: 'old', name: 'The Old Quarter', x0: 250, x1: 400, tag: 'A thousand rooftops' },
      { id: 'royal', name: 'The Royal District', x0: 400, x1: 546, tag: 'Gold over rot' },
      { id: 'fortress', name: 'The Fortress', x0: 546, x1: 760, tag: 'No one enters. No one leaves.' }
    ],
    get(tx, ty) { if (tx < 0 || tx >= WW || ty >= WH) return SOLID; if (ty < 0) return AIR; return W.tiles[ty * WW + tx]; },
    set(tx, ty, t) { if (tx < 0 || tx >= WW || ty < 0 || ty >= WH) return; W.tiles[ty * WW + tx] = t; W.dirty.push(tx, ty); W.version++; },
    isSolid(t) { return t === SOLID || t === SMOOTH || t === DOOR || t === GLASS; },
    solid(tx, ty) { const t = W.get(tx, ty); return t === SOLID || t === SMOOTH || t === DOOR || t === GLASS; },
    solidAt(x, y) { return W.solid(Math.floor(x / T), Math.floor(y / T)); },
    at(x, y) { return W.get(Math.floor(x / T), Math.floor(y / T)); },
    climbable(tx, ty) { return W.get(tx, ty) === SOLID; },
    opaque(tx, ty) { const t = W.get(tx, ty); return t === SOLID || t === SMOOTH || t === DOOR; },
    // line of sight between two pixel points (tiles only)
    los(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
      const n = Math.ceil(d / 10); if (n <= 0) return true;
      const sx = dx / n, sy = dy / n; let x = x0, y = y0;
      for (let i = 1; i < n; i++) { x += sx; y += sy; if (W.opaque(Math.floor(x / T), Math.floor(y / T))) return false; }
      return true;
    },
    // cast a ray, return distance travelled before hitting an opaque tile
    ray(x0, y0, ang, maxD) {
      const sx = Math.cos(ang) * 8, sy = Math.sin(ang) * 8; let x = x0, y = y0, d = 0;
      while (d < maxD) { x += sx; y += sy; d += 8; if (W.opaque(Math.floor(x / T), Math.floor(y / T))) return d - 4; }
      return maxD;
    },
    districtAt(x) { const tx = x / T; for (const d of W.districts) if (tx >= d.x0 && tx < d.x1) return d; return W.districts[0]; },
    underground(y) { return y > (G + 2) * T; },
    zoneAt(x, y) { for (const z of W.zones) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z; return null; },
    indoorAt(x, y) { if (y > (G + 1) * T) return true; for (const r of W.interiors) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return true; return false; },
    // first standable row at/below a tile position
    floorRow(tx, ty) { for (let y = ty; y < WH; y++) { const t = W.get(tx, y); if (W.isSolid(t) || t === PLAT || (t === LADDER && W.get(tx, y - 1) !== LADDER)) return y; } return WH - 1; },
    feet(tx, row) { return { x: tx * T + T / 2, y: W.floorRow(tx, row) * T }; }
  };

  function fill(x0, y0, x1, y1, t, m) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= WW || y < 0 || y >= WH) continue;
      W.tiles[y * WW + x] = t; if (m !== undefined) W.mat[y * WW + x] = m;
    }
  }
  const px = tx => tx * T + T / 2;

  function build() {
    W.tiles.fill(0); W.mat.fill(0);
    const L = n => (W[n] = []);
    ['buildings', 'interiors', 'zones', 'lights', 'hides', 'doors', 'benches', 'viewpoints', 'chests', 'relics', 'posters', 'swings',
      'crowds', 'civs', 'guards', 'decor', 'flags', 'stealables', 'carts', 'officials', 'marks'].forEach(L);
    const rng = U.rng(90210);

    // ---- helpers ----
    const torch = (tx, row, o) => W.lights.push(Object.assign({ x: px(tx), y: row * T + 6, r: 200, int: 1, on: true, kind: 'torch', ext: true }, o || {}));
    const lantern = (tx, row, o) => W.lights.push(Object.assign({ x: px(tx), y: row * T + 8, r: 170, int: 0.9, on: true, kind: 'lantern', ext: false, breakable: true }, o || {}));
    const hide = (type, tx, row, o) => {
      const dims = { hay: [44, 26], bush: [46, 28], barrel: [26, 30], closet: [28, 48], curtain: [26, 50], table: [44, 22], grass: [96, 20], cart: [58, 30] }[type];
      const h = Object.assign({ type, x: px(tx), y: row * T, w: dims[0], h: dims[1], body: null }, o || {}); W.hides.push(h); return h;
    };
    const guard = (type, tx, row, o) => W.guards.push(Object.assign({ type, tx, row }, o || {}));
    const relic = (tx, row) => W.relics.push({ id: 'r' + W.relics.length, x: px(tx), y: row * T - 16 });
    const chest = (tx, row, coins) => W.chests.push({ id: 'c' + W.chests.length, x: px(tx), y: row * T, coins: coins || 80 });
    const poster = (tx) => W.posters.push({ id: W.posters.length, x: px(tx), y: G * T - 30 });
    const fl = f => G - 5 * f;

    function facade(x, w, h, m, o) {
      o = o || {};
      fill(x, G - h, x + w - 1, G - 1, FACADE, m);
      fill(x, G - h, x + w - 1, G - h, PLAT, m);
      const b = { x, w, h, mat: m, seed: (x * 7919 + h * 31) | 0, kind: o.kind || 'house', roof: o.roof || (rng() < 0.5 ? 'flat' : 'pitch') };
      W.buildings.push(b);
      if (o.chimney !== false && w >= 7 && rng() < 0.7) { const cx = x + 1 + rng.int(0, w - 3); fill(cx, G - h - 2, cx, G - h - 1, SOLID, 7); }
      if (o.balcony !== false && h >= 8 && rng() < 0.6) { const by = G - rng.int(4, h - 3), bx = x + rng.int(0, w - 3); fill(bx, by, bx + 2, by, PLAT, m); }
      return b;
    }
    function house(x, w, floors, m, o) {
      o = o || {};
      const top = G - 5 * floors;
      fill(x, top, x + w - 1, G - 1, AIR);
      for (let f = 1; f <= floors; f++) fill(x, fl(f), x + w - 1, fl(f), SOLID, m);
      fill(x, top, x, G - 1, SOLID, m); fill(x + w - 1, top, x + w - 1, G - 1, SOLID, m);
      W.interiors.push({ x0: (x + 1) * T, y0: (top + 1) * T, x1: (x + w - 1) * T, y1: G * T, mat: m });
      (o.doors || []).forEach(s => door(s === 'L' ? x : x + w - 1, G - 2));
      (o.windows || []).forEach(wd => {
        const wx = wd.s === 'L' ? x : x + w - 1, r = fl(wd.f);
        fill(wx, r - 3, wx, r - 2, wd.glass ? GLASS : AIR, m);
      });
      (o.ladders || []).forEach(ld => fill(ld.x, fl(ld.f + 1), ld.x, fl(ld.f) - 1, LADDER));
      (o.walls || []).forEach(wl => { fill(wl.x, fl(wl.f) - 4, wl.x, fl(wl.f) - 1, SOLID, m); door(wl.x, fl(wl.f) - 2); });
      if (o.zone) W.zones.push({ id: o.zone, name: o.zoneName || o.zone, x0: x * T - (o.pad || 0) * T, y0: (top - 4) * T, x1: (x + w) * T + (o.pad || 0) * T, y1: G * T + 2 });
      // battlements on roof edge
      fill(x, top - 1, x, top - 1, SOLID, m); fill(x + w - 1, top - 1, x + w - 1, top - 1, SOLID, m);
      return { x, w, top };
    }
    function door(tx, ty) { fill(tx, ty, tx, ty + 1, DOOR); W.doors.push({ tx, ty, open: false, byPlayer: false, x: px(tx), y: (ty + 2) * T, timer: 0 }); }
    function shaft(tx, r0, r1) { fill(tx, r0, tx, r1, LADDER); }
    function viewpoint(id, name, tx, row, dir, ltx, lrow, ltype) {
      W.viewpoints.push({ id, name, x: px(tx), y: row * T, dir, land: { x: px(ltx), y: lrow * T, type: ltype } });
    }
    function streetProps(x0, x1, o) {
      o = o || {};
      for (let x = x0 + 3; x < x1 - 3; x += rng.int(7, 12)) {
        if (W.get(x, G - 1) === SOLID || W.get(x, G) !== SOLID) continue;
        const r = rng();
        if (r < 0.16) hide('barrel', x, G);
        else if (r < 0.30) hide(o.rich ? 'bush' : 'hay', x, G);
        else if (r < 0.42) hide('bush', x, G);
        else if (r < 0.52) hide('grass', x, G);
        else if (r < 0.64) W.benches.push({ x: px(x), y: G * T });
        else if (r < 0.80) torch(x, G - 4, { kind: 'lamp', r: 210 });
        else W.decor.push({ type: rng() < 0.5 ? 'crate' : 'cartwheel', x: px(x), y: G * T });
      }
    }
    function facadeRow(x0, x1, o) {
      let x = x0, prev = null;
      while (x < x1 - 4) {
        let w = rng.int(o.w[0], o.w[1]); if (x + w > x1) w = x1 - x; if (w < 4) break;
        const h = rng.int(o.h[0], o.h[1]);
        const b = facade(x, w, h, o.mat);
        if (prev && x - (prev.x + prev.w) >= 2 && rng() < 0.65) { // beam or laundry line across the alley
          const by = G - Math.min(prev.h, h) + rng.int(0, 1); fill(prev.x + prev.w, by, x - 1, by, PLAT, 3);
        }
        if (rng() < 0.35) fill(x + 1, G - 3, x + 3, G - 3, PLAT, 8); // awning
        if (rng() < 0.3) W.flags.push({ x: px(x + w - 1), y: (G - h) * T, c: o.flag || '#8a2b2b' });
        if (rng() < 0.25) relic(x + rng.int(1, w - 2), G - h);
        prev = b; x += w + rng.int(o.g[0], o.g[1]);
      }
    }

    // ================= GROUND =================
    fill(0, G, WW - 1, WH - 1, SOLID, 0);
    fill(0, 0, 0, WH - 1, SMOOTH, 0);

    // ================= HARBOR (0-125) =================
    fill(1, 60, 57, 61, AIR); fill(1, 62, 57, 68, WATER);
    fill(20, 60, 57, 60, PLAT, 6); // pier
    for (let x = 22; x < 57; x += 6) W.decor.push({ type: 'pierpost', x: px(x), y: 61 * T });
    // ship A (big)
    fill(5, 59, 25, 63, SOLID, 6); fill(5, 57, 8, 58, SOLID, 6); fill(23, 58, 25, 58, SOLID, 6);
    shaft(15, 38, 58); fill(13, 38, 14, 38, PLAT, 6); fill(16, 38, 18, 38, PLAT, 6);
    fill(9, 48, 14, 48, PLAT, 6); fill(16, 48, 21, 48, PLAT, 6); fill(11, 43, 14, 43, PLAT, 6); fill(16, 43, 19, 43, PLAT, 6);
    W.decor.push({ type: 'sail', x: px(15), y: 48 * T, w: 11 * T, h: 9 * T }, { type: 'sail', x: px(15), y: 43 * T, w: 8 * T, h: 4.5 * T });
    W.flags.push({ x: px(15), y: 38 * T - 20, c: '#2b4a8a' });
    viewpoint('harbor', 'The Crow\'s Nest', 18, 38, 1, 29, 62, 'water');
    relic(10, 48); chest(7, 57, 90);
    // ship B (small)
    fill(32, 60, 44, 63, SOLID, 6); shaft(38, 47, 59); fill(35, 47, 37, 47, PLAT, 6); fill(39, 47, 41, 47, PLAT, 6);
    W.decor.push({ type: 'sail', x: px(38), y: 47 * T, w: 7 * T, h: 8 * T });
    relic(41, 47);
    // crane with swing rope
    shaft(50, 46, 59); fill(44, 46, 49, 46, PLAT, 6); fill(51, 46, 55, 46, PLAT, 6);
    W.swings.push({ x: px(45), y: 47 * T, len: 150 });
    W.swings.push({ x: px(54), y: 47 * T, len: 130 });
    // quay + harbor tunnel grate
    shaft(60, 60, 74);
    // watchtower (mission 2)
    house(62, 9, 5, 1, { doors: ['R'], windows: [{ f: 2, s: 'L' }, { f: 3, s: 'R', glass: true }, { f: 4, s: 'L' }],
      ladders: [{ f: 0, x: 64 }, { f: 1, x: 68 }, { f: 2, x: 64 }, { f: 3, x: 68 }, { f: 4, x: 64 }], zone: 'watchtower', zoneName: 'Harbor Watchtower' });
    W.marks.push({ id: 'brazier', x: px(66), y: 35 * T }); torch(66, 34, { kind: 'brazier', r: 300, int: 1.2, id: 'brazier', ext: false, y: 35 * T - 14 });
    lantern(66, fl(1) + 1); lantern(66, fl(3) + 1); hide('barrel', 66, G); hide('closet', 67, fl(2)); hide('barrel', 66, fl(4));
    guard('guard', 73, G, { face: 1, pers: 'stoic' }); guard('guard', 66, fl(1), { p: [64, 68] }); guard('guard', 66, fl(3), { p: [64, 68], pers: 'lazy' });
    guard('archer', 66, 35, { p: [64, 68] });
    hide('hay', 59, G); // leap landing by the tower (west side)
    // dockside buildings
    facade(75, 13, 8, 3); facade(115, 9, 7, 3, { kind: 'tavern' });
    // warehouse (mission 7)
    house(92, 21, 2, 3, { doors: ['L', 'R'], windows: [{ f: 1, s: 'L' }], ladders: [{ f: 0, x: 108 }, { f: 1, x: 96 }], zone: 'warehouse', zoneName: 'Smugglers\' Warehouse' });
    fill(99, 58, 100, 59, SOLID, 3); fill(103, 59, 103, 59, SOLID, 3); fill(104, fl(1) - 1, 105, fl(1) - 1, SOLID, 3);
    hide('barrel', 96, G); hide('closet', 110, fl(1)); hide('barrel', 101, fl(1)); lantern(102, fl(1) + 1); lantern(98, fl(2) + 1);
    guard('guard', 90, G, { face: -1 }); guard('guard', 105, G, { p: [95, 110] }); guard('guard', 102, fl(1), { p: [95, 109], pers: 'vigilant' });
    chest(110, G, 120); relic(102, 50);
    streetProps(58, 125); poster(80); poster(118);
    W.crowds.push({ x: px(84), y: G * T, n: 4 }); W.crowds.push({ x: px(40), y: G * T, n: 3 });
    guard('guard', 80, G, { p: [74, 90] }); guard('guard', 118, G, { p: [112, 124], pers: 'lazy' });

    // ================= SLUMS (125-250) =================
    facadeRow(127, 182, { w: [6, 10], h: [4, 9], g: [1, 3], mat: 3, flag: '#6b5a2e' });
    facade(184, 5, 26, 3, { kind: 'mill', chimney: false, balcony: false, roof: 'flat' }); fill(189, 34, 191, 34, PLAT, 3);
    fill(180, 44, 183, 44, PLAT, 3); fill(189, 50, 192, 50, PLAT, 3); // rest platforms
    viewpoint('slums', 'The Old Mill', 191, 34, 1, 196, G, 'hay'); hide('hay', 196, G);
    facadeRow(200, 226, { w: [6, 9], h: [4, 8], g: [1, 3], mat: 3 });
    // well -> hideout
    fill(204, 59, 206, 59, AIR); fill(204, 58, 206, 58, AIR); W.decor.push({ type: 'well', x: px(205), y: G * T });
    shaft(205, 60, 74);
    // criminal den
    house(228, 13, 2, 3, { doors: ['R'], windows: [{ f: 1, s: 'L' }], ladders: [{ f: 0, x: 231 }, { f: 1, x: 238 }], zone: 'den', zoneName: 'Cutthroats\' Den' });
    chest(236, fl(1), 150); hide('barrel', 233, G); lantern(234, fl(1) + 1);
    guard('guard', 236, G, { p: [231, 238], pers: 'lazy', thug: true }); guard('guard', 234, fl(1), { p: [230, 238], thug: true });
    facade(243, 6, 6, 3);
    streetProps(125, 228); poster(150); poster(215);
    for (let x = 132; x < 226; x += 22) hide('grass', x, G);
    W.crowds.push({ x: px(160), y: G * T, n: 4 }); W.crowds.push({ x: px(212), y: G * T, n: 3 });
    guard('guard', 145, G, { p: [130, 170] }); guard('guard', 190, G, { p: [172, 224], pers: 'nervous' });

    // ================= OLD QUARTER (250-400) =================
    facade(252, 13, 12, 2);
    // guardhouse (mission 3)
    house(268, 17, 3, 1, { doors: ['L', 'R'], windows: [{ f: 1, s: 'L' }, { f: 2, s: 'R', glass: true }, { f: 1, s: 'R' }],
      ladders: [{ f: 0, x: 281 }, { f: 1, x: 271 }, { f: 2, x: 281 }], zone: 'guardhouse', zoneName: 'City Guardhouse' });
    hide('closet', 274, G); hide('table', 276, fl(1)); hide('curtain', 280, fl(2)); hide('closet', 272, fl(2));
    lantern(276, fl(1) + 1); lantern(276, fl(2) + 1); lantern(276, fl(3) + 1);
    W.stealables.push({ id: 'orders', name: 'Sealed Orders', x: px(276), y: fl(2) * T, taken: false, mission: 3 });
    W.decor.push({ type: 'desk', x: px(276), y: fl(2) * T });
    W.stealables.push({ id: 'ledger', name: 'the Ledger', x: px(100), y: fl(1) * T, taken: false, mission: 7 }); W.decor.push({ type: 'desk', x: px(100), y: fl(1) * T });
    guard('guard', 266, G, { face: -1, pers: 'stoic' }); guard('guard', 286, G, { face: 1 });
    guard('guard', 276, G, { p: [271, 279] }); guard('guard', 277, fl(1), { p: [273, 282], pers: 'vigilant' }); guard('guard', 276, fl(2), { p: [274, 282] });
    guard('archer', 276, fl(3), { p: [270, 282] });
    facadeRow(288, 300, { w: [9, 11], h: [10, 14], g: [2, 3], mat: 2 });
    // market square 300-338
    for (let x = 303; x < 336; x += 8) { fill(x, G - 3, x + 3, G - 3, PLAT, 8); W.decor.push({ type: 'stall', x: px(x + 1.5), y: G * T, c: rng.pick(['#8a2b2b', '#2b5d8a', '#8a7a2b', '#3d7a4a']) }); W.civs.push({ x: px(x + 1.5), y: G * T, merchant: true }); }
    W.decor.push({ type: 'fountain', x: px(320), y: G * T });
    W.crowds.push({ x: px(310), y: G * T, n: 5 }, { x: px(322), y: G * T, n: 5 }, { x: px(333), y: G * T, n: 4 });
    W.benches.push({ x: px(316), y: G * T }, { x: px(327), y: G * T });
    W.officials.push({ x: px(337), y: G * T, name: 'Magistrate\'s Clerk' });
    guard('guard', 320, G, { p: [302, 338] }); poster(301); poster(338);
    facadeRow(340, 346, { w: [5, 6], h: [9, 12], g: [1, 2], mat: 2 });
    // church + bell tower
    facade(346, 16, 13, 1, { kind: 'church', chimney: false, roof: 'pitch' });
    facade(362, 7, 44, 1, { kind: 'tower', chimney: false, balcony: false, roof: 'spire' }); fill(369, 16, 371, 16, PLAT, 1);
    fill(358, 36, 361, 36, PLAT, 1); fill(369, 28, 371, 28, PLAT, 1);
    viewpoint('old', 'St. Aldric\'s Belfry', 371, 16, 1, 377, G, 'hay'); hide('hay', 377, G);
    W.decor.push({ type: 'crypt', x: px(356), y: G * T }); shaft(356, 60, 74);
    facadeRow(380, 400, { w: [8, 10], h: [9, 14], g: [2, 3], mat: 2 });
    streetProps(250, 300); streetProps(338, 400);
    guard('guard', 345, G, { p: [340, 398] }); guard('guard', 380, G, { p: [342, 398], pers: 'vigilant', torch: true });
    guard('archer', 258, G - 12, { p: [253, 263] });
    relic(371, 28); relic(358, 36); relic(320, G - 3); chest(360, 47, 100);
    W.carts.push({ x: px(300), y: G * T, x0: px(290), x1: px(396), dir: 1 });

    // ================= ROYAL DISTRICT (400-546) =================
    fill(402, 57, 402, 59, SOLID, 4); W.decor.push({ type: 'arch', x: px(402), y: 57 * T });
    fill(402, 58, 402, 59, AIR); // open archway
    facadeRow(405, 421, { w: [7, 8], h: [11, 14], g: [1, 2], mat: 4, flag: '#3a2a8a' });
    // villa (mission 4)
    house(424, 29, 3, 4, { doors: ['L', 'R'], windows: [{ f: 1, s: 'L' }, { f: 1, s: 'R' }, { f: 2, s: 'L', glass: true }, { f: 2, s: 'R' }],
      ladders: [{ f: 0, x: 430 }, { f: 0, x: 448 }, { f: 1, x: 438 }, { f: 2, x: 446 }], walls: [{ f: 2, x: 440 }, { f: 0, x: 436 }], zone: 'villa', zoneName: 'Varric Estate', pad: 0 });
    W.zones.push({ id: 'villa', name: 'Varric Estate', x0: 452 * T, y0: 50 * T, x1: 463 * T, y1: G * T + 2 });
    fill(463, 56, 463, 59, SOLID, 4); // courtyard wall
    hide('bush', 456, G); hide('bush', 460, G); hide('closet', 427, G); hide('curtain', 433, fl(1)); hide('table', 444, fl(1)); hide('curtain', 428, fl(2)); hide('closet', 450, fl(2));
    lantern(431, fl(1) + 1); lantern(444, fl(1) + 1); lantern(432, fl(2) + 1); lantern(445, fl(2) + 1); lantern(432, fl(3) + 1); lantern(446, fl(3) + 1);
    guard('guard', 422, G, { face: -1, pers: 'stoic' }); guard('guard', 457, G, { p: [454, 461] });
    guard('guard', 430, G, { p: [426, 434] }); guard('guard', 445, G, { p: [438, 450], pers: 'lazy' });
    guard('guard', 432, fl(1), { p: [426, 449] }); guard('elite', 434, fl(2), { p: [427, 438] });
    guard('archer', 438, fl(3), { p: [428, 448] });
    chest(450, G, 130); relic(438, fl(3));
    W.decor.push({ type: 'well', x: px(466), y: G * T }); shaft(466, 60, 74);
    facadeRow(469, 483, { w: [6, 7], h: [12, 15], g: [1, 1], mat: 4, flag: '#3a2a8a' });
    // royal keep (mission 9)
    house(486, 45, 5, 4, { doors: ['L', 'R'], windows: [{ f: 1, s: 'L' }, { f: 2, s: 'R' }, { f: 3, s: 'L', glass: true }, { f: 3, s: 'R' }, { f: 4, s: 'L' }],
      ladders: [{ f: 0, x: 492 }, { f: 0, x: 524 }, { f: 1, x: 508 }, { f: 2, x: 490 }, { f: 2, x: 526 }, { f: 3, x: 510 }, { f: 4, x: 496 }],
      walls: [{ f: 4, x: 514 }, { f: 2, x: 500 }, { f: 0, x: 506 }], zone: 'keep', zoneName: 'The Royal Keep' });
    fill(505, 13, 511, 34, SOLID, 4); fill(512, 13, 514, 13, PLAT, 4); fill(503, 24, 504, 24, PLAT, 4); fill(512, 24, 513, 24, PLAT, 4);
    viewpoint('royal', 'The King\'s Tower', 514, 13, 1, 535, G, 'hay'); hide('hay', 535, G);
    W.flags.push({ x: px(508), y: 13 * T, c: '#c9a227' });
    [[495, 1], [520, 1], [495, 2], [518, 2], [498, 3], [520, 3], [495, 4], [522, 4], [500, 5], [522, 5]].forEach(a => lantern(a[0], fl(a[1]) + 1));
    hide('closet', 489, G); hide('curtain', 515, G); hide('table', 498, fl(1)); hide('curtain', 520, fl(1)); hide('closet', 494, fl(2)); hide('curtain', 512, fl(2));
    hide('table', 502, fl(3)); hide('closet', 528, fl(3)); hide('curtain', 517, fl(4)); hide('closet', 488, fl(4)); hide('barrel', 500, fl(5));
    guard('elite', 484, G, { face: -1, pers: 'stoic' }); guard('guard', 533, G, { face: 1 });
    guard('guard', 496, G, { p: [489, 504] }); guard('guard', 518, G, { p: [508, 528], torch: true });
    guard('guard', 500, fl(1), { p: [489, 527] }); guard('guard', 515, fl(1), { p: [510, 528], pers: 'vigilant' });
    guard('guard', 492, fl(2), { p: [488, 498] }); guard('elite', 514, fl(2), { p: [502, 528] });
    guard('guard', 500, fl(3), { p: [489, 527], pers: 'nervous' }); guard('captain', 518, fl(3), { p: [512, 526] });
    guard('elite', 505, fl(4), { p: [489, 512] });
    guard('archer', 494, fl(5), { p: [488, 503] }); guard('archer', 522, fl(5), { p: [513, 528] });
    chest(528, fl(4), 200); chest(488, fl(2), 110); relic(508, 13); relic(503, 24);
    facade(537, 7, 14, 4, { kind: 'customs', roof: 'flat', chimney: false });
    streetProps(403, 422, { rich: true }); streetProps(464, 486, { rich: true });
    W.crowds.push({ x: px(412), y: G * T, n: 4 }, { x: px(474), y: G * T, n: 4 });
    W.officials.push({ x: px(478), y: G * T, name: 'Court Notary' });
    guard('guard', 410, G, { p: [404, 420] }); guard('elite', 474, G, { p: [465, 484] }); guard('guard', 540, G, { p: [534, 544] });
    poster(408); poster(470); poster(538);
    W.carts.push({ x: px(470), y: G * T, x0: px(465), x1: px(483), dir: 1 });

    // ================= FORTRESS (546-760) =================
    fill(546, 40, 551, 59, SOLID, 5); fill(546, 46, 546, 59, SMOOTH, 5);
    fill(546, 57, 551, 59, AIR); // gate passage
    fill(546, 30, 548, 39, SOLID, 5); fill(549, 30, 551, 30, PLAT, 5); fill(549, 39, 549, 39, AIR);
    fill(552, 40, 556, 40, PLAT, 5); shaft(557, 40, 59);
    viewpoint('fortress', 'The Gate Tower', 551, 30, 1, 561, G, 'hay'); hide('hay', 561, G);
    W.zones.push({ id: 'fortress', name: 'The Fortress', x0: 546 * T, y0: 0, x1: 712 * T, y1: 70 * T });
    W.flags.push({ x: px(547), y: 30 * T, c: '#8a1620' });
    guard('guard', 544, G, { face: -1, pers: 'stoic' }); guard('guard', 553, G, { face: 1 }); guard('captain', 566, G, { p: [560, 580] });
    guard('archer', 553, 40, { p: [550, 556] });
    facadeRow(564, 598, { w: [9, 11], h: [6, 9], g: [2, 3], mat: 5, flag: '#8a1620' });
    guard('guard', 580, G, { p: [562, 600], torch: true }); guard('guard', 590, G, { p: [570, 602], pers: 'vigilant' });
    guard('archer', 572, G - 7, { p: [566, 574] });
    hide('barrel', 583, G); hide('hay', 599, G); hide('barrel', 601, G); torch(576, G - 4); torch(596, G - 4);
    // prison + dungeon (mission 6)
    house(604, 21, 2, 5, { doors: ['L'], windows: [{ f: 1, s: 'R' }], ladders: [{ f: 0, x: 620 }, { f: 1, x: 608 }] });
    fill(600, 64, 632, 67, AIR); shaft(610, 60, 67); fill(616, 64, 616, 67, SOLID, 5); door(616, 66); fill(624, 64, 624, 67, SOLID, 5); door(624, 66);
    shaft(602, 68, 74);
    W.marks.push({ id: 'cell', x: px(628), y: 68 * T }); W.decor.push({ type: 'prisoner', x: px(629), y: 68 * T, id: 'prisoner' });
    lantern(613, 64); torch(620, 64, { r: 150 }); hide('barrel', 606, 68); hide('barrel', 621, 68); hide('closet', 612, G); hide('table', 614, fl(1));
    lantern(612, fl(1) + 1); lantern(614, fl(2) + 1);
    guard('guard', 602, G, { face: -1 }); guard('guard', 614, G, { p: [607, 622] }); guard('guard', 613, fl(1), { p: [606, 622], pers: 'lazy' });
    guard('guard', 608, 68, { p: [603, 614], torch: true }); guard('elite', 620, 68, { p: [618, 622] });
    chest(630, 68, 140); relic(614, fl(2));
    // inner wall + citadel (mission 10)
    fill(636, 44, 638, 59, SOLID, 5); fill(636, 49, 636, 59, SMOOTH, 5); fill(636, 57, 638, 59, AIR);
    fill(632, 44, 635, 44, PLAT, 5); fill(639, 44, 641, 44, PLAT, 5);
    guard('elite', 633, G, { face: -1, pers: 'stoic' }); guard('elite', 642, G, { face: 1 }); guard('archer', 637, 44, { p: [633, 640] });
    house(648, 41, 6, 5, { doors: ['L'], windows: [{ f: 2, s: 'L' }, { f: 3, s: 'R' }, { f: 4, s: 'L', glass: true }, { f: 5, s: 'R' }],
      ladders: [{ f: 0, x: 684 }, { f: 1, x: 652 }, { f: 2, x: 684 }, { f: 3, x: 652 }, { f: 4, x: 684 }, { f: 5, x: 660 }], walls: [{ f: 3, x: 668 }, { f: 1, x: 668 }, { f: 5, x: 670 }] });
    fill(665, 9, 671, 29, SOLID, 5); fill(672, 9, 674, 9, PLAT, 5); fill(672, 20, 673, 20, PLAT, 5); fill(663, 20, 664, 20, PLAT, 5);
    fill(692, 60, 706, 66, WATER);
    viewpoint('citadel', 'The Ghost Spire', 674, 9, 1, 698, 60, 'water');
    W.flags.push({ x: px(668), y: 9 * T, c: '#8a1620' });
    for (let f = 1; f <= 6; f++) { lantern(658, fl(f) + 1); lantern(678, fl(f) + 1); }
    hide('closet', 656, G); hide('table', 674, G); hide('curtain', 662, fl(1)); hide('barrel', 680, fl(1)); hide('closet', 672, fl(2)); hide('curtain', 656, fl(2));
    hide('table', 660, fl(3)); hide('curtain', 678, fl(3)); hide('closet', 664, fl(4)); hide('barrel', 676, fl(4)); hide('curtain', 680, fl(5)); hide('table', 658, fl(5)); hide('barrel', 652, fl(6));
    guard('guard', 660, G, { p: [651, 682] }); guard('guard', 672, G, { p: [656, 686], torch: true });
    guard('elite', 660, fl(1), { p: [651, 666] }); guard('guard', 678, fl(1), { p: [670, 686] });
    guard('guard', 666, fl(2), { p: [651, 686], pers: 'vigilant' }); guard('elite', 676, fl(3), { p: [670, 686] }); guard('guard', 658, fl(3), { p: [651, 666] });
    guard('captain', 668, fl(4), { p: [652, 686] }); guard('elite', 660, fl(5), { p: [651, 668] }); guard('elite', 680, fl(5), { p: [672, 686] });
    guard('archer', 654, fl(6), { p: [650, 662] }); guard('archer', 684, fl(6), { p: [674, 687] });
    chest(686, fl(5), 250); relic(672, 20); relic(668, 9);
    fill(712, 14, WW - 1, 59, SMOOTH, 0); // eastern cliffs

    // ================= UNDERGROUND =================
    fill(56, 72, 604, 74, AIR);                      // the long tunnel
    fill(110, 70, 122, 71, AIR);
    [60, 205, 356, 466].forEach(x => shaft(x, 60, 74)); shaft(602, 68, 74); // re-cut the shafts through the tunnel
    // secret alcoves (crawl through 1-tile gaps)
    fill(96, 66, 104, 69, AIR); fill(100, 70, 100, 73, LADDER); chest(98, 70, 110); relic(103, 70);
    fill(408, 66, 418, 69, AIR); fill(413, 70, 413, 73, LADDER); chest(410, 70, 120);
    fill(320, 76, 332, 78, AIR); fill(326, 75, 326, 78, LADDER); chest(330, 79, 140); relic(322, 79);
    fill(500, 66, 512, 71, AIR); fill(504, 68, 508, 68, PLAT, 3); relic(506, 68); chest(510, 75, 100);
    // hidden district: assassin headquarters
    fill(214, 63, 292, 74, AIR);
    fill(214, 63, 222, 63, SOLID, 0);
    fill(226, 68, 240, 68, PLAT, 3); shaft(226, 68, 74); fill(246, 66, 252, 66, PLAT, 3);
    fill(256, 74, 257, 74, SOLID, 1); fill(258, 72, 261, 74, SOLID, 1); fill(264, 66, 265, 74, SOLID, 1);
    fill(270, 69, 276, 69, PLAT, 3);
    fill(286, 67, 291, 67, PLAT, 3); shaft(289, 67, 74);
    W.swings.push({ x: px(243), y: 63 * T + 4, len: 96 });
    W.zones.push({ id: 'hq', name: 'The Hidden District', safe: true, x0: 213 * T, y0: 62 * T, x1: 293 * T, y1: 76 * T });
    hide('hay', 254, 75); hide('barrel', 232, 75); hide('hay', 284, 75); W.benches.push({ x: px(222), y: 75 * T });
    [218, 236, 256, 274, 290].forEach(x => torch(x, 70, { r: 330, int: 1.3, ext: false }));
    torch(244, 64, { r: 220, ext: false }); torch(280, 65, { r: 220, ext: false });
    W.marks.push({ id: 'mentor', x: px(220), y: 75 * T }, { id: 'armory', x: px(228), y: 75 * T });
    W.decor.push({ type: 'banner', x: px(225), y: 64 * T }, { type: 'banner', x: px(250), y: 64 * T }, { type: 'banner', x: px(280), y: 64 * T }, { type: 'armory', x: px(228), y: 75 * T });
    chest(290, 67, 60); relic(249, 66); relic(238, 68);
    // tunnel lighting + guards (far ends only)
    for (let x = 70; x < 600; x += 46) if (x < 210 || x > 296) torch(x, 72, { r: 150, int: 0.8 });
    guard('guard', 480, 75, { p: [440, 520], torch: true }); guard('guard', 570, 75, { p: [530, 598], torch: true, pers: 'nervous' });
    hide('barrel', 150, 75); hide('barrel', 380, 75); hide('barrel', 455, 75); hide('barrel', 545, 75); hide('barrel', 585, 75);

    // ================= civilians =================
    const civ = (a, b, n) => { for (let i = 0; i < n; i++) W.civs.push({ x: px(rng.int(a, b)), y: G * T, x0: px(a), x1: px(b) }); };
    civ(74, 90, 3); civ(113, 124, 2); civ(127, 226, 7); civ(288, 398, 10); civ(404, 421, 3); civ(465, 484, 3);

    // sanity: make sure prop anchors rest on the floor
    W.hides.forEach(h => { if (!h.fixed) h.y = W.floorRow(Math.floor(h.x / T), Math.floor(h.y / T) - 1) * T; });
    W.version++;
  }

  W.build = build;
  W.px = px;
  W.fl = f => G - 5 * f;
  build();
})();
