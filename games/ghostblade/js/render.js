// GHOSTBLADE - camera, particles, world rendering, lighting, weather
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T, W = GB.world, P = GB.player, env = GB.env;
  const { SOLID, PLAT, LADDER, WATER, SMOOTH, GLASS } = W;
  let cv, ctx, lightCv, lctx, CW = 1280, CH = 720, DPR = 1;

  // ---------------- camera ----------------
  const cam = GB.cam = {
    x: 0, y: 0, zoom: 1, tz: 1, punchZ: 0, shakeT: 0, shakeA: 0, sx: 0, sy: 0, cine: null, scale: 1, lookY: 0,
    snap() { cam.offY = P.y > W.groundY + 6 ? -10 : -92; cam.x = P.x; cam.y = P.y - 64 + cam.offY; cam.zoom = cam.tz = 1; },
    viewW() { return CW / cam.scale; }, viewH() { return CH / cam.scale; },
    toWorld(mx, my) { return { x: cam.x + (mx * DPR - CW / 2) / cam.scale, y: cam.y + (my * DPR - CH / 2) / cam.scale }; },
    toScreen(x, y) { return { x: ((x - cam.x) * cam.scale + CW / 2) / DPR, y: ((y - cam.y) * cam.scale + CH / 2) / DPR }; },
    update(dt, rdt) {
      let tx, ty, tz;
      if (cam.cine) {
        const c = cam.cine; c.t += rdt; const k = U.ease(Math.min(1, c.t / c.dur));
        tx = U.lerp(c.x0, c.x1, k); ty = U.lerp(c.y0, c.y1, k); tz = U.lerp(c.z0, c.z1, k);
        cam.x = U.damp(cam.x, tx, 4, rdt); cam.y = U.damp(cam.y, ty, 4, rdt); cam.zoom = U.damp(cam.zoom, tz, 3, rdt);
        if (c.t >= c.dur + (c.hold || 0)) { const d = c.done; cam.cine = null; if (d) d(); }
      } else {
        const iy = GB.input.axisY(), still = Math.abs(P.vx) < 5 && P.state === 'ground';
        cam.lookY = U.damp(cam.lookY, still && !P.crouch && GB.input.isDown('up') ? -110 : (P.state === 'hang' && iy > 0) ? 120 : 0, 3, rdt);
        tx = P.x + P.face * 18 + U.clamp(P.vx * 0.24, -90, 90);
        cam.offY = U.damp(cam.offY || 0, P.y > W.groundY + 6 ? -10 : -92, 2.2, rdt);
        ty = P.y - 64 + U.clamp(P.vy * 0.12, -8, 130) + cam.lookY + cam.offY;
        tz = 1;
        if (P.state === 'leap') { tz = 0.62; ty = P.y - 20; }
        else if (P.state === 'hidden' || (P.crouch && P.onGround)) tz = 1.14;
        else if (P.sprinting || P.state === 'zip') tz = 0.9;
        else if (GB.stealth.onRoof || P.state === 'climb' || P.state === 'swing') tz = 0.9;
        if (GB.ai.combatCount > 0) tz = Math.min(tz, 0.94);
        cam.x = U.damp(cam.x, tx, 6, rdt); cam.y = U.damp(cam.y, ty, P.state === 'leap' ? 9 : 7, rdt);
        cam.zoom = U.damp(cam.zoom, tz, 2.6, rdt);
      }
      cam.punchZ = U.damp(cam.punchZ, 0, 9, rdt);
      cam.scale = CH / 720 * (cam.zoom + cam.punchZ);
      const vw = cam.viewW() / 2, vh = cam.viewH() / 2;
      cam.x = U.clamp(cam.x, vw + T, W.pxW - vw); cam.y = Math.min(cam.y, W.pxH - vh - T * 2);
      cam.shakeT = Math.max(0, cam.shakeT - rdt);
      const sh = GB.save.settings.shake ? cam.shakeA * (cam.shakeT / 0.3) : 0;
      cam.sx = (Math.random() - 0.5) * sh; cam.sy = (Math.random() - 0.5) * sh;
    },
    cinematic(x1, y1, z1, dur, hold, done) { cam.cine = { x0: cam.x, y0: cam.y, z0: cam.zoom, x1, y1, z1, dur, hold: hold || 0, t: 0, done }; }
  };

  // ---------------- particles / effects ----------------
  const parts = [];
  const add = (x, y, vx, vy, life, col, size, g, kind) => { if (parts.length < 600) parts.push({ x, y, vx, vy, life, max: life, col, size, g: g === undefined ? 300 : g, kind }); };
  const fx = GB.fx = {
    sm: null, flashA: 0, flashX: 0, flashY: 0,
    dust(x, y, n) { for (let i = 0; i < n; i++) add(x + U.rand(-6, 6), y - 1, U.rand(-40, 40), U.rand(-50, -5), U.rand(0.25, 0.55), '150,140,125', U.rand(1.5, 3.5), 60); },
    blood(x, y, n) { for (let i = 0; i < n; i++) add(x, y, U.rand(-70, 70), U.rand(-110, -10), U.rand(0.3, 0.6), '120,14,18', U.rand(1.2, 2.4), 500); },
    spark(x, y, n) { for (let i = 0; i < n; i++) add(x, y, U.rand(-170, 170), U.rand(-190, 40), U.rand(0.15, 0.4), '255,225,150', U.rand(1, 2), 500, 'glow'); },
    leaves(x, y, type) { const c = type === 'hay' || type === 'cart' ? '214,180,90' : type === 'bush' ? '70,120,60' : '140,120,100'; for (let i = 0; i < 12; i++) add(x + U.rand(-16, 16), y, U.rand(-70, 70), U.rand(-130, -20), U.rand(0.4, 0.9), c, U.rand(1.5, 3), 260); },
    splash(x, y) { for (let i = 0; i < 16; i++) add(x + U.rand(-8, 8), y, U.rand(-90, 90), U.rand(-240, -60), U.rand(0.4, 0.8), '190,220,240', U.rand(1.5, 3), 700); fx.ripple(x, y); },
    ripple(x, y) { add(x, y + 1, 0, 0, 0.8, '200,225,245', 4, 0, 'ripple'); },
    ring(x, y) { add(x, y - 14, 0, 0, 0.5, '255,235,170', 6, 0, 'ring'); },
    shards(x, y, dir) { for (let i = 0; i < 18; i++) add(x, y + U.rand(-20, 20), (dir || 0) * U.rand(40, 240) + U.rand(-60, 60), U.rand(-160, 30), U.rand(0.5, 1), '200,230,245', U.rand(1.5, 3.5), 700); },
    flashbang(x, y) { fx.flashA = 1; fx.flashX = x; fx.flashY = y; fx.spark(x, y, 20); },
    shake(a) { cam.shakeA = Math.max(cam.shakeA * (cam.shakeT > 0 ? 1 : 0), a); cam.shakeT = 0.3; },
    slowmo(scale, dur) { fx.sm = { scale, t: dur }; },
    punch(z) { cam.punchZ = Math.max(cam.punchZ, z); },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      fx.flashA = Math.max(0, fx.flashA - dt * 1.4);
    }
  };

  // ---------------- palettes ----------------
  const MAT = [
    { c: [58, 52, 46], top: [86, 80, 66] }, { c: [94, 94, 102], top: [128, 128, 136] }, { c: [166, 148, 118], top: [120, 62, 44] }, { c: [106, 84, 60], top: [78, 58, 40] },
    { c: [178, 170, 152], top: [70, 86, 122] }, { c: [72, 74, 84], top: [104, 106, 118] }, { c: [98, 68, 44], top: [130, 96, 62] }, { c: [124, 72, 58], top: [150, 96, 78] }, { c: [140, 50, 46], top: [170, 70, 60] }
  ];
  const SKY = [[0, [8, 10, 24], [22, 28, 56]], [5, [22, 26, 56], [86, 62, 84]], [6.5, [70, 110, 170], [236, 170, 130]], [9, [74, 136, 208], [188, 216, 236]], [15, [70, 128, 204], [190, 214, 232]],
    [17.5, [78, 104, 170], [248, 186, 116]], [19.2, [48, 38, 86], [236, 112, 66]], [20.6, [16, 18, 44], [64, 46, 84]], [24, [8, 10, 24], [22, 28, 56]]];
  function skyCols() {
    let a = SKY[0], b = SKY[1]; for (let i = 0; i < SKY.length - 1; i++) if (env.time >= SKY[i][0] && env.time <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
    const k = (env.time - a[0]) / Math.max(0.001, b[0] - a[0]); let top = U.mixColor(a[1], b[1], k), bot = U.mixColor(a[2], b[2], k);
    const dl = env.dayLight(), grey = [70 + 60 * dl, 76 + 60 * dl, 88 + 60 * dl], w = Math.max(env.rain * 0.7, env.fog * 0.75);
    top = U.mixColor(top, [grey[0] * 0.6, grey[1] * 0.6, grey[2] * 0.65], w); bot = U.mixColor(bot, grey, w);
    if (env.flash > 0) { top = U.mixColor(top, [220, 225, 255], env.flash * 0.7); bot = U.mixColor(bot, [230, 235, 255], env.flash * 0.7); }
    return { top, bot };
  }

  // ---------------- background layers ----------------
  const rb = U.rng(4242), far = [], mid = [], stars = [], clouds = [], birds = [];
  for (let i = 0; i < 120; i++) far.push(60 + Math.sin(i * 0.21) * 34 + Math.sin(i * 0.57 + 1) * 22 + rb() * 10);
  for (let x = 0; x < 2400;) { const w = rb.int(26, 70), h = rb.int(40, 150), tower = rb() < 0.18; mid.push({ x, w, h: tower ? h + 90 : h, tower, win: rb.int(0, 9999) }); x += w + rb.int(0, 8); }
  for (let i = 0; i < 110; i++) stars.push({ x: rb(), y: rb() * 0.7, s: rb() * 1.4 + 0.4, p: rb() * 6 });
  for (let i = 0; i < 9; i++) clouds.push({ x: rb() * 2400, y: 40 + rb() * 220, w: 120 + rb() * 220, s: 4 + rb() * 9 });
  for (let i = 0; i < 9; i++) birds.push({ x: rb() * 3000, y: 90 + rb() * 240, s: 30 + rb() * 40, p: rb() * 6 });

  function drawSky(sk) {
    const g = ctx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, U.rgb(sk.top)); g.addColorStop(0.75, U.rgb(sk.bot)); g.addColorStop(1, U.rgb(sk.bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
    const dl = env.dayLight(), s = CH / 720, hz = horizon();
    if (dl < 0.5) { const a = (0.5 - dl) * 2 * (1 - Math.max(env.rain, env.fog) * 0.9); ctx.fillStyle = '#fff'; for (const st of stars) { ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(GB.time * 1.5 + st.p)); ctx.fillRect(st.x * CW, st.y * CH * 0.8, st.s * s, st.s * s); } ctx.globalAlpha = 1; }
    // sun + moon on arcs
    const sa = (env.time - 6) / 12 * Math.PI, sx = CW * (0.5 - Math.cos(sa) * 0.42), sy = hz - Math.sin(sa) * CH * 0.55;
    if (env.time > 5.5 && env.time < 18.8) { const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, 150 * s); gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.12, 'rgba(255,225,160,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - 160 * s, sy - 160 * s, 320 * s, 320 * s); }
    const mt = (env.time + 6) % 24, ma = mt / 12 * Math.PI, mx = CW * (0.5 - Math.cos(ma) * 0.4), my = hz - Math.sin(ma) * CH * 0.5;
    if (mt < 12.5) { ctx.fillStyle = 'rgba(225,232,250,' + (0.9 * (1 - dl)) + ')'; ctx.beginPath(); ctx.arc(mx, my, 24 * s, 0, 7); ctx.fill(); ctx.fillStyle = U.rgb(sk.top, 0.95 * (1 - dl)); ctx.beginPath(); ctx.arc(mx + 9 * s, my - 5 * s, 21 * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = U.rgb(U.mixColor(sk.bot, [255, 255, 255], 0.35), 0.16 + 0.2 * Math.max(env.rain, env.fog));
    for (const c of clouds) { const x = ((c.x + GB.time * c.s - cam.x * 0.04) % 2600 + 2600) % 2600 - 300; ctx.beginPath(); ctx.ellipse(x * s, c.y * s, c.w * s, c.w * 0.16 * s, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse((x + c.w * 0.4) * s, (c.y - 12) * s, c.w * 0.5 * s, c.w * 0.12 * s, 0, 0, 7); ctx.fill(); }
  }
  const horizon = () => CH / 2 + (W.groundY - cam.y) * cam.scale * 0.5 + CH * 0.12;
  function drawParallax(sk) {
    const s = CH / 720, hz = horizon(), dl = env.dayLight();
    // far mountains + citadel silhouette
    let col = U.mixColor(sk.bot, [30, 34, 54], 0.42); ctx.fillStyle = U.rgb(col);
    const ox = -(cam.x * 0.06) % (120 * 20); ctx.beginPath(); ctx.moveTo(0, CH);
    for (let i = -1; i < CW / (20 * s) + 2; i++) { const idx = ((Math.floor(-ox / 20) + i) % 120 + 120) % 120; ctx.lineTo((i * 20 + (ox % 20)) * s, hz - far[idx] * 1.5 * s); }
    ctx.lineTo(CW, CH); ctx.fill();
    // mid skyline
    col = U.mixColor(sk.bot, [22, 22, 34], 0.68); ctx.fillStyle = U.rgb(col);
    const mo = cam.x * 0.2, night = dl < 0.5;
    for (const b of mid) {
      let x = ((b.x - mo) % 2400 + 2400) % 2400 - 100; if (x * s > CW) continue; x *= s;
      const bw = b.w * s, bh = b.h * s, by = hz + 40 * s - bh;
      ctx.fillRect(x, by, bw + 1, CH - by);
      if (b.tower) { ctx.beginPath(); ctx.moveTo(x - 3 * s, by); ctx.lineTo(x + bw / 2, by - 34 * s); ctx.lineTo(x + bw + 3 * s, by); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x - 2 * s, by); ctx.lineTo(x + bw / 2, by - 12 * s); ctx.lineTo(x + bw + 2 * s, by); ctx.fill(); }
      if (night) { ctx.fillStyle = 'rgba(255,196,110,0.5)'; for (let i = 0; i < 3; i++) { const h = U.hash(b.win, i); if (h < 0.5) ctx.fillRect(x + (0.2 + U.hash(b.win + 3, i) * 0.6) * bw, by + (0.15 + h * 1.4) * bh * 0.5, 3 * s, 4 * s); } ctx.fillStyle = U.rgb(col); }
    }
    ctx.fillStyle = U.rgb(sk.bot, 0.22 + 0.4 * env.fog); ctx.fillRect(0, hz - 200 * s, CW, CH);
    // birds
    if (dl > 0.4 && env.rain < 0.3) { ctx.strokeStyle = 'rgba(20,20,26,0.55)'; ctx.lineWidth = 1.4 * s; for (const b of birds) { const x = ((b.x + GB.time * b.s - cam.x * 0.12) % 3000 + 3000) % 3000 - 200, y = b.y + Math.sin(GB.time * 0.7 + b.p) * 14, f = Math.sin(GB.time * 9 + b.p) * 4; ctx.beginPath(); ctx.moveTo((x - 6) * s, (y - f) * s); ctx.lineTo(x * s, y * s); ctx.lineTo((x + 6) * s, (y - f) * s); ctx.stroke(); } }
  }

  // ---------------- world ----------------
  let vx0, vx1, vy0, vy1;
  function drawBuildings() {
    const G = W.G;
    for (const b of W.buildings) {
      if (b.x > vx1 || b.x + b.w < vx0) continue;
      const m = MAT[b.mat], x = b.x * T, w = b.w * T, top = (G - b.h) * T, h = b.h * T, v = U.hash(b.seed, 1) * 0.28 - 0.14;
      const wall = [m.c[0] * (0.78 + v), m.c[1] * (0.78 + v), m.c[2] * (0.78 + v)];
      ctx.fillStyle = U.rgb(wall); ctx.fillRect(x, top + 5, w, h - 5);
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x, top + 5, 3, h - 5); ctx.fillRect(x + w - 3, top + 5, 3, h - 5); ctx.fillRect(x, W.groundY - 10, w, 10);
      if (b.mat === 2 || b.mat === 3) { ctx.strokeStyle = b.mat === 2 ? 'rgba(62,42,28,0.9)' : 'rgba(50,36,24,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); for (let yy = top + 5 + 4 * T; yy < W.groundY - 20; yy += 4 * T) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); } for (let xx = x + 3 * T; xx < x + w - 10; xx += 3 * T) { ctx.moveTo(xx, top + 6); ctx.lineTo(xx, W.groundY); } ctx.stroke(); }
      else if (b.mat !== 4) { ctx.fillStyle = 'rgba(0,0,0,0.07)'; for (let yy = top + 12; yy < W.groundY; yy += 12) ctx.fillRect(x, yy, w, 1); }
      // windows
      const night = env.dayLight() < 0.5;
      for (let r = 2; r < b.h - 1; r += 4) for (let c = 1; c < b.w - 1; c += 3) {
        const wx = x + c * T + 3, wy = top + r * T; if (wy > W.groundY - 60 && U.hash(b.seed + c, r) < 0.4) continue;
        const lit = night && U.hash(b.seed + c * 7, r * 3) < 0.34;
        ctx.fillStyle = lit ? 'rgb(236,178,92)' : 'rgba(18,20,30,0.82)'; ctx.fillRect(wx, wy, 16, 24);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(wx + 7, wy, 2, 24); ctx.fillRect(wx, wy + 11, 16, 2);
        ctx.fillStyle = b.mat === 4 ? 'rgba(235,228,205,0.9)' : 'rgba(52,38,28,0.9)'; ctx.fillRect(wx - 2, wy + 24, 20, 3);
      }
      // ground-floor door
      if (b.w >= 6) { const dx = x + Math.floor(b.w / 2) * T; ctx.fillStyle = 'rgba(40,28,20,0.95)'; ctx.fillRect(dx, W.groundY - 40, 22, 40); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(dx + 10, W.groundY - 40, 2, 40); }
      // roof cap / spire
      ctx.fillStyle = U.rgb(m.top);
      if (b.roof === 'spire') { ctx.beginPath(); ctx.moveTo(x + 8, top); ctx.lineTo(x + w / 2, top - 110); ctx.lineTo(x + w - 8, top); ctx.fill(); ctx.fillRect(x + w / 2 - 1.5, top - 132, 3, 26); ctx.fillRect(x + w / 2 - 8, top - 124, 16, 3); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 16, top - 40, w - 32, 34); }
      else if (b.kind === 'church') { ctx.beginPath(); ctx.moveTo(x - 4, top + 6); ctx.lineTo(x + w * 0.5, top - 4); ctx.lineTo(x + w + 4, top + 6); ctx.fill(); }
      else if (b.kind === 'mill') { ctx.save(); ctx.translate(x + w / 2, top + 70); ctx.rotate(GB.time * 0.35); ctx.strokeStyle = 'rgba(60,44,30,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 76, Math.sin(a) * 76); } ctx.stroke(); ctx.fillStyle = 'rgba(190,170,130,0.5)'; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(16, 2, 58, 16); } ctx.restore(); }
      if (b.kind === 'tavern') { ctx.fillStyle = 'rgba(50,34,22,0.95)'; ctx.fillRect(x + w - 8, W.groundY - 70, 26, 3); ctx.fillStyle = '#c9a24a'; ctx.fillRect(x + w + 4, W.groundY - 66, 12, 14); }
    }
  }
  function drawInteriors() {
    ctx.fillStyle = 'rgb(20,18,18)'; ctx.fillRect(vx0 * T, W.groundY, (vx1 - vx0 + 1) * T, W.pxH - W.groundY + 400);
    if (vx0 < 58) { const sg = ctx.createLinearGradient(0, W.groundY, 0, W.groundY + 240); const dl = env.dayLight(); sg.addColorStop(0, U.rgb([30 + 50 * dl, 60 + 70 * dl, 86 + 80 * dl])); sg.addColorStop(1, 'rgb(10,22,36)'); ctx.fillStyle = sg; ctx.fillRect(T, W.groundY, 57 * T, 9 * T); }
    for (const r of W.interiors) {
      if (r.x1 < vx0 * T || r.x0 > vx1 * T) continue;
      const m = MAT[r.mat].c; ctx.fillStyle = U.rgb([m[0] * 0.42, m[1] * 0.40, m[2] * 0.40]); ctx.fillRect(r.x0 - T, r.y0 - T, r.x1 - r.x0 + T * 2, r.y1 - r.y0 + T);
      ctx.fillStyle = 'rgba(0,0,0,0.13)'; for (let x = r.x0; x < r.x1; x += 48) ctx.fillRect(x, r.y0 - T, 2, r.y1 - r.y0 + T);
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; for (let y = r.y1 - 5 * T; y > r.y0; y -= 5 * T) ctx.fillRect(r.x0, y + T, r.x1 - r.x0, 40);
    }
    // carved rock texture for the hideout
    const z = W.zones.find(z => z.id === 'hq'); if (z && z.x1 > vx0 * T && z.x0 < vx1 * T) { ctx.fillStyle = 'rgba(70,60,52,0.35)'; ctx.fillRect(z.x0 + T, z.y0 + T, z.x1 - z.x0 - T, z.y1 - z.y0 - T * 2); }
  }
  function drawTiles() {
    const tl = W.tiles, mt = W.mat, WW = W.w;
    for (let ty = Math.max(0, vy0); ty <= Math.min(W.h - 1, vy1); ty++) {
      let run = -1, rm = -1, rt = -1;
      for (let tx = Math.max(0, vx0); tx <= Math.min(WW - 1, vx1) + 1; tx++) {
        const t = tx <= Math.min(WW - 1, vx1) ? tl[ty * WW + tx] : 0, sol = t === SOLID || t === SMOOTH, m = sol ? mt[ty * WW + tx] : -1, key = sol ? t : -1;
        if (key !== rt || m !== rm) {
          if (rt !== -1) { const c = MAT[rm].c, d = rt === SMOOTH ? 0.86 : 1, sh = 1 - (ty & 1) * 0.045; ctx.fillStyle = U.rgb([c[0] * d * sh, c[1] * d * sh, c[2] * d * sh]); ctx.fillRect(run * T, ty * T, (tx - run) * T + 0.5, T + 0.5); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(run * T, ty * T + T - 2, (tx - run) * T, 2); }
          run = tx; rm = m; rt = key;
        }
      }
      for (let tx = Math.max(0, vx0); tx <= Math.min(WW - 1, vx1); tx++) {
        const t = tl[ty * WW + tx]; if (!t || t === W.FACADE) continue;
        const x = tx * T, y = ty * T, m = MAT[mt[ty * WW + tx]] || MAT[0];
        if (t === SOLID || t === SMOOTH) {
          const up = ty > 0 ? tl[(ty - 1) * WW + tx] : 0;
          if (up !== SOLID && up !== SMOOTH) { ctx.fillStyle = U.rgb(m.top); ctx.fillRect(x, y, T + 0.5, 4); if (ty === W.G && mt[ty * WW + tx] === 0 && U.hash(tx, 3) < 0.5) { ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x + 4 + U.hash(tx, 9) * 10, y + 1, 8, 2); } }
          if (t === SMOOTH) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x + 2, y + 2, T - 4, T - 4); }
          else if ((tx * 3 + ty * 5) % 7 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fillRect(x + ((tx * 13) % 12), y + 6, 1.5, T - 8); }
        } else if (t === PLAT) {
          const mi = mt[ty * WW + tx];
          if (mi === 8) { ctx.fillStyle = (tx & 1) ? 'rgb(150,52,46)' : 'rgb(214,196,160)'; ctx.fillRect(x, y, T + 0.5, 7); ctx.beginPath(); ctx.arc(x + T / 2, y + 7, T / 2, 0, Math.PI); ctx.fill(); }
          else if (mi === 3 && tl[(ty + 1) * WW + tx] === 0 && tl[(ty - 1) * WW + tx] === 0 && W.get(tx, ty + 1) !== W.FACADE && U.hash(tx >> 3, ty) < 0.45) { ctx.fillStyle = 'rgb(120,100,78)'; ctx.fillRect(x, y, T + 0.5, 2); if (tx % 2) { ctx.fillStyle = U.hash(tx, ty) < 0.5 ? 'rgba(200,190,170,0.85)' : 'rgba(150,80,70,0.85)'; ctx.fillRect(x + 4, y + 2, 14, 15 + Math.sin(GB.time * 2 + tx) * 2); } }
          else { ctx.fillStyle = U.rgb(m.top); ctx.fillRect(x, y, T + 0.5, 6); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + 6, T + 0.5, 2); }
        } else if (t === LADDER) { ctx.fillStyle = 'rgb(110,82,52)'; ctx.fillRect(x + 4, y, 3, T + 0.5); ctx.fillRect(x + T - 7, y, 3, T + 0.5); ctx.fillRect(x + 4, y + 4, T - 8, 2.5); ctx.fillRect(x + 4, y + 16, T - 8, 2.5); }
        else if (t === GLASS) { ctx.fillStyle = 'rgba(150,200,230,0.32)'; ctx.fillRect(x + 8, y, 8, T + 0.5); ctx.fillStyle = 'rgba(230,245,255,0.5)'; ctx.fillRect(x + 10, y + 3, 1.5, T - 6); ctx.fillStyle = 'rgba(60,44,30,0.9)'; ctx.fillRect(x + 6, y, 2, T); ctx.fillRect(x + 16, y, 2, T); }
      }
    }
  }
  function drawWater() {
    const tl = W.tiles, WW = W.w;
    for (let ty = Math.max(0, vy0); ty <= Math.min(W.h - 1, vy1); ty++) for (let tx = Math.max(0, vx0); tx <= Math.min(WW - 1, vx1); tx++) {
      if (tl[ty * WW + tx] !== WATER) continue; const x = tx * T, y = ty * T, surf = tl[(ty - 1) * WW + tx] !== WATER;
      ctx.fillStyle = 'rgba(28,62,92,0.62)'; ctx.fillRect(x, y + (surf ? 3 : 0), T + 0.5, T + 0.5 - (surf ? 3 : 0));
      if (surf) { ctx.fillStyle = 'rgba(170,210,235,0.5)'; ctx.fillRect(x, y + 2 + Math.sin(GB.time * 2 + tx * 0.8) * 1.5, T + 0.5, 2); }
    }
  }
  const onScreen = (x, y, m) => x > vx0 * T - (m || 60) && x < (vx1 + 1) * T + (m || 60) && y > vy0 * T - 120 && y < (vy1 + 1) * T + 120;

  function drawProps(front) {
    const night = env.dayLight() < 0.62;
    if (!front) {
      for (const d of W.decor) { if (onScreen(d.x, d.y, 200)) drawDecor(d); }
      for (const f of W.flags) if (onScreen(f.x, f.y)) { ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y - 34); ctx.stroke(); ctx.fillStyle = f.c; ctx.beginPath(); ctx.moveTo(f.x, f.y - 34); for (let i = 1; i <= 5; i++) ctx.lineTo(f.x + i * 5, f.y - 34 + Math.sin(GB.time * 5 - i * 0.9 + f.x) * (1 + i * 0.6) * (1 + env.rain)); for (let i = 5; i >= 0; i--) ctx.lineTo(f.x + i * 5, f.y - 22 + Math.sin(GB.time * 5 - i * 0.9 + f.x) * (1 + i * 0.6)); ctx.fill(); }
      for (const d of W.doors) if (onScreen(d.x, d.y)) { const y = d.ty * T; if (d.open) { ctx.fillStyle = 'rgb(84,58,36)'; ctx.fillRect(d.x - 12, y, 5, 48); } else { ctx.fillStyle = 'rgb(92,64,40)'; ctx.fillRect(d.x - 7, y, 14, 48); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(d.x - 7, y + 14, 14, 2); ctx.fillRect(d.x - 7, y + 34, 14, 2); ctx.fillStyle = '#c9a24a'; ctx.fillRect(d.x + 2, y + 24, 3, 3); } }
      for (const p of W.posters) if (GB.combat.posterUp(p) && onScreen(p.x, p.y)) { ctx.fillStyle = 'rgb(214,200,160)'; ctx.fillRect(p.x - 9, p.y - 14, 18, 24); ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 3.4, 0, 7); ctx.moveTo(p.x - 5, p.y + 4); ctx.lineTo(p.x, p.y - 2); ctx.lineTo(p.x + 5, p.y + 4); ctx.stroke(); ctx.fillStyle = '#8a1620'; ctx.fillRect(p.x - 7, p.y + 6, 14, 2); }
      for (const b of W.benches) if (onScreen(b.x, b.y)) { ctx.fillStyle = 'rgb(86,62,40)'; ctx.fillRect(b.x - 20, b.y - 12, 40, 4); ctx.fillRect(b.x - 18, b.y - 12, 3, 12); ctx.fillRect(b.x + 15, b.y - 12, 3, 12); ctx.fillRect(b.x - 20, b.y - 24, 3, 14); ctx.fillRect(b.x - 20, b.y - 24, 40, 3); }
      for (const s of W.swings) if (onScreen(s.x, s.y, 200)) { const a = (GB.player.swing === s ? s.ang : (s.ang = (s.ang || 0) * 0.985 + Math.sin(GB.time * 1.1 + s.x) * 0.0012)), bx = s.x + Math.sin(a) * s.len, by = s.y + Math.cos(a) * s.len; ctx.strokeStyle = 'rgb(170,150,110)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(bx, by); ctx.stroke(); ctx.beginPath(); ctx.arc(bx, by + 5, 5, 0, 7); ctx.stroke(); }
      for (const c of W.chests) if (onScreen(c.x, c.y)) { const open = GB.save.chests[c.id]; ctx.fillStyle = 'rgb(98,66,36)'; ctx.fillRect(c.x - 11, c.y - 12, 22, 12); ctx.fillStyle = open ? 'rgb(60,40,24)' : 'rgb(124,86,46)'; ctx.fillRect(c.x - 12, c.y - (open ? 20 : 17), 24, open ? 4 : 6); ctx.fillStyle = '#d9b44a'; ctx.fillRect(c.x - 2, c.y - 12, 4, 5); if (!open) { ctx.fillStyle = 'rgba(255,220,120,' + (0.15 + 0.1 * Math.sin(GB.time * 3)) + ')'; ctx.beginPath(); ctx.arc(c.x, c.y - 10, 18, 0, 7); ctx.fill(); } }
      for (const v of W.viewpoints) if (onScreen(v.x, v.y)) { ctx.fillStyle = '#2a2622'; const bx = v.x + 2, by = v.y - 3; if (U.dist(P.x, P.y, v.x, v.y) > 60) { ctx.beginPath(); ctx.ellipse(bx, by - 5, 5, 4, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(bx + 4, by - 9, 2.6, 0, 7); ctx.fill(); ctx.fillRect(bx + 6, by - 9.5, 3, 1.4); } }
      for (const L of W.lights) if (onScreen(L.x, L.y)) drawLightProp(L, night);
      for (const s of W.stealables) if (!s.taken && onScreen(s.x, s.y)) { ctx.fillStyle = 'rgb(226,214,180)'; ctx.fillRect(s.x - 7, s.y - 22, 14, 4); ctx.fillStyle = '#8a1620'; ctx.fillRect(s.x - 2, s.y - 22, 4, 4); if (s.active) { ctx.strokeStyle = 'rgba(255,230,150,' + (0.5 + 0.4 * Math.sin(GB.time * 4)) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x, s.y - 20, 12, 0, 7); ctx.stroke(); } }
      for (const it of GB.combat.items) { if (it.kind === 'coin') { ctx.fillStyle = '#e6c35a'; ctx.beginPath(); ctx.arc(it.x, it.y - 2, 2.2, 0, 7); ctx.fill(); } else if (it.kind === 'knife') { ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(it.x - 6, it.y - 6); ctx.stroke(); } else { ctx.fillStyle = '#b08a3a'; ctx.fillRect(it.x - 5, it.y - 8, 10, 8); if (it.t > 3) { ctx.strokeStyle = 'rgba(255,230,150,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(it.x, it.y - 4, 8 + (it.t * 12 % 10), 0, 7); ctx.stroke(); } } }
    }
    for (const h of W.hides) { if (!onScreen(h.x, h.y, 100)) continue; const isFront = h.type === 'grass' || h.type === 'bush' || h.type === 'hay' || h.type === 'cart' || h.type === 'curtain' || h.type === 'barrel'; if (isFront === front) drawHide(h); }
    if (front) for (const r of W.relics) if (!GB.save.relics[r.id] && onScreen(r.x, r.y)) { const y = r.y + Math.sin(GB.time * 2.4 + r.x) * 3; ctx.fillStyle = 'rgba(255,240,190,0.18)'; ctx.beginPath(); ctx.arc(r.x, y, 12, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,246,214,0.95)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(r.x - 5, y + 7); ctx.quadraticCurveTo(r.x + 4, y, r.x + 4, y - 8); ctx.moveTo(r.x - 2, y + 3); ctx.lineTo(r.x - 5, y - 1); ctx.moveTo(r.x + 1, y - 1); ctx.lineTo(r.x - 2, y - 6); ctx.stroke(); }
  }
  function drawLightProp(L, night) {
    const lit = L.on && (L.kind !== 'lamp' || night);
    if (L.kind === 'lamp') { ctx.fillStyle = '#26221e'; ctx.fillRect(L.x - 1.5, L.y, 3, W.groundY - L.y); ctx.fillRect(L.x - 6, L.y - 3, 12, 3); ctx.fillStyle = lit ? 'rgb(255,214,130)' : 'rgb(60,56,50)'; ctx.fillRect(L.x - 4, L.y - 12, 8, 9); }
    else if (L.kind === 'lantern') { ctx.strokeStyle = '#26221e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L.x, L.y - 10); ctx.lineTo(L.x, L.y - 4); ctx.stroke(); ctx.fillStyle = lit ? 'rgb(255,206,120)' : 'rgb(52,48,44)'; ctx.fillRect(L.x - 4, L.y - 4, 8, 10); ctx.strokeStyle = '#26221e'; ctx.strokeRect(L.x - 4, L.y - 4, 8, 10); }
    else if (L.kind === 'brazier') { ctx.fillStyle = '#2a2622'; ctx.fillRect(L.x - 9, L.y + 2, 18, 5); ctx.fillRect(L.x - 2, L.y + 7, 4, 8); if (lit) GB.stick.flame(ctx, L.x, L.y + 2, 1.9); }
    else { ctx.fillStyle = '#3a2e22'; ctx.fillRect(L.x - 1.5, L.y, 3, 12); ctx.fillRect(L.x - 4, L.y + 10, 8, 2); if (lit) GB.stick.flame(ctx, L.x, L.y, 1.1); }
  }
  function drawHide(h) {
    const x = h.x, y = h.y, occ = P.hideSpot === h, wob = occ ? Math.sin(GB.time * 3) * 0.6 : 0;
    switch (h.type) {
      case 'hay': case 'cart': {
        if (h.type === 'cart') { ctx.fillStyle = 'rgb(84,58,36)'; ctx.fillRect(x - 32, y - 16, 64, 8); ctx.strokeStyle = 'rgb(50,36,24)'; ctx.lineWidth = 3; for (const wx of [-20, 20]) { ctx.beginPath(); ctx.arc(x + wx, y - 8, 8, 0, 7); ctx.stroke(); } drawHorse(x + (h.dir || 1) * 62, y, h.dir || 1, h.moving); }
        const by = h.type === 'cart' ? y - 16 : y; ctx.fillStyle = 'rgb(198,164,78)'; ctx.beginPath(); ctx.moveTo(x - h.w / 2, by); ctx.quadraticCurveTo(x - h.w / 2 + 4, by - 26 + wob, x, by - 28 + wob); ctx.quadraticCurveTo(x + h.w / 2 - 4, by - 26, x + h.w / 2, by); ctx.fill();
        ctx.strokeStyle = 'rgba(236,208,120,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = -3; i <= 3; i++) { ctx.moveTo(x + i * 6, by - 4); ctx.lineTo(x + i * 7 + 2, by - 20 - (i & 1) * 5); } ctx.stroke(); break;
      }
      case 'bush': ctx.fillStyle = 'rgb(46,84,48)'; for (const o of [[-14, -10, 12], [0, -15, 15], [14, -10, 12], [-6, -6, 10], [8, -5, 10]]) { ctx.beginPath(); ctx.arc(x + o[0], y + o[1] + wob, o[2], 0, 7); ctx.fill(); } ctx.fillStyle = 'rgba(90,140,80,0.5)'; ctx.beginPath(); ctx.arc(x - 4, y - 18, 7, 0, 7); ctx.fill(); break;
      case 'grass': ctx.strokeStyle = 'rgb(66,104,58)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = -h.w / 2; i < h.w / 2; i += 4) { const sway = Math.sin(GB.time * 1.8 + (x + i) * 0.1) * 2.5 + (Math.abs(P.x - (x + i)) < 12 && Math.abs(P.y - y) < 10 ? U.sign(x + i - P.x) * 4 : 0); ctx.moveTo(x + i, y); ctx.lineTo(x + i + sway, y - 13 - U.hash(Math.floor(x + i), 5) * 9); } ctx.stroke(); break;
      case 'barrel': ctx.fillStyle = 'rgb(96,66,40)'; ctx.fillRect(x - 12, y - 30, 24, 30); ctx.fillStyle = 'rgb(118,84,52)'; ctx.fillRect(x - 13, y - 24, 26, 18); ctx.fillStyle = 'rgba(30,26,22,0.8)'; ctx.fillRect(x - 13, y - 25, 26, 2); ctx.fillRect(x - 13, y - 8, 26, 2); break;
      case 'closet': ctx.fillStyle = 'rgb(74,50,32)'; ctx.fillRect(x - 14, y - 48, 28, 48); ctx.fillStyle = 'rgb(94,66,42)'; ctx.fillRect(x - 12, y - 46, 11, 44); ctx.fillRect(x + 1, y - 46, 11, 44); ctx.fillStyle = '#c9a24a'; ctx.fillRect(x - 3, y - 26, 2, 4); ctx.fillRect(x + 1, y - 26, 2, 4); break;
      case 'curtain': ctx.fillStyle = 'rgb(120,30,36)'; ctx.beginPath(); ctx.moveTo(x - 14, y - 52); for (let i = 0; i <= 6; i++) ctx.lineTo(x - 14 + i * 4.7 + wob, y - 2 + (i & 1) * 2); ctx.lineTo(x + 14, y - 52); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 9 + i * 9, y - 50, 2.5, 48); ctx.fillStyle = '#b08a3a'; ctx.fillRect(x - 16, y - 54, 32, 3); break;
      case 'table': ctx.fillStyle = 'rgb(92,64,40)'; ctx.fillRect(x - 24, y - 22, 48, 4); ctx.fillRect(x - 21, y - 18, 3, 18); ctx.fillRect(x + 18, y - 18, 3, 18); ctx.fillStyle = 'rgba(110,34,38,0.92)'; ctx.fillRect(x - 22, y - 18, 44, 14); break;
    }
    if (h.body && h.type !== 'closet' && h.type !== 'barrel') { ctx.fillStyle = 'rgba(20,18,18,0.7)'; ctx.fillRect(x + 8, y - 4, 10, 3); }
  }
  function drawHorse(x, y, d, moving) {
    const ph = moving ? GB.time * 7 : 0, s = Math.sin(ph) * 5; ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(x - d * 16, y - 26); ctx.lineTo(x + d * 14, y - 27); ctx.lineTo(x + d * 24, y - 40); ctx.lineTo(x + d * 32, y - 36);
    ctx.moveTo(x - d * 15, y - 25); ctx.lineTo(x - d * 16 - s, y); ctx.moveTo(x - d * 11, y - 25); ctx.lineTo(x - d * 10 + s, y); ctx.moveTo(x + d * 11, y - 26); ctx.lineTo(x + d * 10 - s, y); ctx.moveTo(x + d * 14, y - 26); ctx.lineTo(x + d * 16 + s, y);
    ctx.moveTo(x - d * 16, y - 26); ctx.lineTo(x - d * 22, y - 14); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,96,60,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - d * 16, y - 20); ctx.lineTo(x - d * 34, y - 16); ctx.stroke();
  }
  function drawDecor(d) {
    const x = d.x, y = d.y;
    switch (d.type) {
      case 'pierpost': ctx.fillStyle = 'rgb(70,50,34)'; ctx.fillRect(x - 3, y - T - 8, 6, 9 * T); break;
      case 'sail': { const b = Math.sin(GB.time * 1.2 + x) * 6; ctx.fillStyle = 'rgba(214,204,176,0.9)'; ctx.beginPath(); ctx.moveTo(x - d.w / 2, y + 8); ctx.lineTo(x + d.w / 2, y + 8); ctx.quadraticCurveTo(x + d.w / 2 + b, y + d.h / 2, x + d.w / 2 - 6, y + d.h); ctx.lineTo(x - d.w / 2 + 6, y + d.h); ctx.quadraticCurveTo(x - d.w / 2 + b, y + d.h / 2, x - d.w / 2, y + 8); ctx.fill(); break; }
      case 'well': ctx.fillStyle = 'rgb(96,96,104)'; ctx.fillRect(x - 28, y - 14, 12, 14); ctx.fillRect(x + 16, y - 14, 12, 14); ctx.fillStyle = 'rgb(84,58,36)'; ctx.fillRect(x - 26, y - 50, 4, 38); ctx.fillRect(x + 22, y - 50, 4, 38); ctx.fillStyle = 'rgb(112,60,46)'; ctx.beginPath(); ctx.moveTo(x - 34, y - 48); ctx.lineTo(x, y - 64); ctx.lineTo(x + 34, y - 48); ctx.fill(); break;
      case 'crypt': ctx.fillStyle = 'rgb(78,78,88)'; ctx.fillRect(x - 22, y - 34, 8, 34); ctx.fillRect(x + 14, y - 34, 8, 34); ctx.beginPath(); ctx.moveTo(x - 26, y - 34); ctx.lineTo(x, y - 50); ctx.lineTo(x + 26, y - 34); ctx.fill(); ctx.fillRect(x - 1.5, y - 66, 3, 18); ctx.fillRect(x - 6, y - 61, 12, 3); break;
      case 'stall': ctx.fillStyle = 'rgb(84,58,36)'; ctx.fillRect(x - 44, y - 3 * T, 4, 3 * T); ctx.fillRect(x + 40, y - 3 * T, 4, 3 * T); ctx.fillRect(x - 44, y - 26, 88, 6); ctx.fillStyle = d.c; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x - 30 + i * 15, y - 30, 5, 0, 7); ctx.fill(); } break;
      case 'fountain': ctx.fillStyle = 'rgb(120,120,130)'; ctx.fillRect(x - 34, y - 12, 68, 12); ctx.fillRect(x - 4, y - 44, 8, 34); ctx.fillRect(x - 14, y - 46, 28, 5); ctx.strokeStyle = 'rgba(180,215,240,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); for (const s of [-1, 1]) { ctx.moveTo(x + s * 10, y - 44); ctx.quadraticCurveTo(x + s * 24, y - 44 + Math.sin(GB.time * 6) * 2, x + s * 26, y - 12); } ctx.stroke(); break;
      case 'arch': ctx.fillStyle = 'rgb(176,168,150)'; ctx.fillRect(x - 20, y - 8, 40, 10); break;
      case 'desk': ctx.fillStyle = 'rgb(92,64,40)'; ctx.fillRect(x - 20, y - 18, 40, 4); ctx.fillRect(x - 17, y - 14, 3, 14); ctx.fillRect(x + 14, y - 14, 3, 14); break;
      case 'banner': ctx.fillStyle = 'rgb(24,22,26)'; ctx.fillRect(x - 12, y, 24, 60); ctx.beginPath(); ctx.moveTo(x - 12, y + 60); ctx.lineTo(x, y + 72); ctx.lineTo(x + 12, y + 60); ctx.fill(); ctx.strokeStyle = 'rgba(201,207,214,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y + 44); ctx.moveTo(x - 6, y + 22); ctx.lineTo(x, y + 14); ctx.lineTo(x + 6, y + 22); ctx.stroke(); break;
      case 'armory': ctx.fillStyle = 'rgb(74,50,32)'; ctx.fillRect(x - 26, y - 44, 52, 44); ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(x + i * 9, y - 8); ctx.lineTo(x + i * 9, y - 38); } ctx.stroke(); break;
      case 'prisoner': if (!d.freed) { ctx.strokeStyle = '#201d1b'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x, y - 8); ctx.lineTo(x + 10, y - 6); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 18); ctx.lineTo(x + 7, y - 12); ctx.stroke(); ctx.fillStyle = '#201d1b'; ctx.beginPath(); ctx.arc(x, y - 27, 5, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(120,120,130,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = -3; i <= 0; i++) { ctx.moveTo(x - 60 + i * 0, y); } ctx.stroke(); } break;
      case 'crate': ctx.fillStyle = 'rgb(100,72,44)'; ctx.fillRect(x - 11, y - 20, 22, 20); ctx.strokeStyle = 'rgba(40,28,18,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 19, 20, 18); ctx.beginPath(); ctx.moveTo(x - 10, y - 19); ctx.lineTo(x + 10, y - 1); ctx.stroke(); break;
      case 'cartwheel': ctx.strokeStyle = 'rgb(70,50,34)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 12, 11, 0, 7); ctx.moveTo(x - 11, y - 12); ctx.lineTo(x + 11, y - 12); ctx.moveTo(x, y - 23); ctx.lineTo(x, y - 1); ctx.stroke(); break;
    }
  }

  // ---------------- characters / overlays ----------------
  function drawCone(g) {
    const cfg = g.cfg, ex = g.x, ey = g.y - 38, R = cfg.range * env.visionMul() * (0.3 + 0.7 * Math.max(P.light, 0.25)), n = 9;
    const col = g.state === 'combat' ? '255,60,50' : g.state === 'unaware' ? '235,235,225' : (g.state === 'suspicious' || g.state === 'investigating') ? '255,205,70' : '255,130,50';
    ctx.beginPath(); ctx.moveTo(ex, ey);
    for (let i = 0; i <= n; i++) { const a = g.look - cfg.fov + cfg.fov * 2 * i / n, d = W.ray(ex, ey, a, R); ctx.lineTo(ex + Math.cos(a) * d, ey + Math.sin(a) * d); }
    ctx.closePath(); const gr = ctx.createRadialGradient(ex, ey, 8, ex, ey, R); gr.addColorStop(0, 'rgba(' + col + ',' + (g.state === 'unaware' ? 0.13 : 0.2) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0.015)'); ctx.fillStyle = gr; ctx.fill();
  }
  function drawGuardMarks(g) {
    const x = g.x, y = g.y - 58;
    if (g.sleepT > 0) { ctx.fillStyle = 'rgba(200,220,255,0.9)'; ctx.font = 'bold 11px Georgia'; ctx.textAlign = 'center'; ctx.fillText('z', x + 6 + Math.sin(GB.time * 2) * 2, y + 22 - (GB.time * 8 % 10)); return; }
    if (g.stunT > 0.2) { ctx.strokeStyle = 'rgba(255,240,170,0.9)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const a = GB.time * 7 + i * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y + 6 + Math.sin(a) * 3, 1.6, 0, 7); ctx.stroke(); } }
    const st = g.state;
    if (st === 'combat') { ctx.fillStyle = '#ff4638'; ctx.font = 'bold 20px Georgia'; ctx.textAlign = 'center'; ctx.fillText('!', x, y); }
    else if (st !== 'unaware') { ctx.fillStyle = st === 'suspicious' || st === 'investigating' ? '#ffcd46' : '#ff8232'; ctx.font = 'bold 18px Georgia'; ctx.textAlign = 'center'; ctx.fillText(st === 'alerted' || st === 'hunting' ? '!' : '?', x, y); }
    if (g.meter > 0.02 && st !== 'combat') { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y + (st === 'unaware' ? 0 : -26), 7, 0, 7); ctx.stroke(); ctx.strokeStyle = g.meter > 0.62 ? '#ff8232' : '#ffcd46'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + (st === 'unaware' ? 0 : -26), 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.meter); ctx.stroke(); }
    if (g.saidT > 0 && g.said && g.said.length > 2) { ctx.font = 'italic 11px Georgia'; ctx.textAlign = 'center'; const w = ctx.measureText(g.said).width + 10; ctx.globalAlpha = Math.min(1, g.saidT * 2); ctx.fillStyle = 'rgba(12,12,16,0.75)'; ctx.fillRect(x - w / 2, y - 44, w, 16); ctx.fillStyle = '#e8e2d0'; ctx.fillText(g.said, x, y - 32); ctx.globalAlpha = 1; }
    if (g.tag === 'target' || g.cfg.vip || g.cfg.boss) { ctx.fillStyle = 'rgba(255,70,56,' + (0.7 + 0.3 * Math.sin(GB.time * 4)) + ')'; ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x - 6, y - 56); ctx.lineTo(x + 6, y - 56); ctx.fill(); }
  }

  function drawLighting() {
    const dl = env.dayLight(), a = U.clamp((1 - dl) * 0.94, 0, 0.86), LS = 0.33, lw = lightCv.width, lh = lightCv.height, sc = cam.scale * LS;
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = 'rgba(6,8,22,' + a + ')'; lctx.fillRect(0, 0, lw, lh);
    lctx.setTransform(sc, 0, 0, sc, lw / 2 - (cam.x + cam.sx) * sc, lh / 2 - (cam.y + cam.sy) * sc);
    const extra = (tot) => a >= tot ? 0 : (tot - a) / (1 - a);
    let e = extra(0.87); if (e > 0) { const ux = Math.max(vx0 * T - 50, 58 * T); lctx.fillStyle = 'rgba(4,4,10,' + e + ')'; lctx.fillRect(ux, W.groundY + 6, (vx1 + 2) * T + 100 - ux, 2000); }
    e = extra(0.74 - 0.14 * dl); if (e > 0) { lctx.fillStyle = 'rgba(6,6,14,' + e + ')'; for (const r of W.interiors) if (r.x1 > vx0 * T && r.x0 < vx1 * T) lctx.fillRect(r.x0, r.y0 - T, r.x1 - r.x0, r.y1 - r.y0 + T); }
    lctx.globalCompositeOperation = 'destination-out';
    const night = dl < 0.62, hole = (x, y, r, i) => { if (!onScreen(x, y, r)) return; const g = lctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + Math.min(1, i) + ')'); g.addColorStop(0.5, 'rgba(0,0,0,' + Math.min(1, i) * 0.55 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2); };
    for (const L of W.lights) if (L.on && (L.kind !== 'lamp' || night)) hole(L.x, L.y, L.r * (1 + Math.sin(GB.time * 11 + L.x) * 0.025), 0.95 * L.int);
    for (const L of GB.ai.dynLights) hole(L.x, L.y, L.r, 0.95);
    if (fx.flashA > 0) hole(fx.flashX, fx.flashY, 420, fx.flashA);
    hole(P.x, P.y - 24, 46, 0.22);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lightCv, 0, 0, CW, CH);
    // warm glow
    ctx.globalCompositeOperation = 'lighter'; applyCam();
    if (a > 0.2 || true) for (const L of W.lights) if (L.on && (L.kind !== 'lamp' || night) && onScreen(L.x, L.y, L.r)) { const r = L.r * 0.55, k = (W.indoorAt(L.x, L.y + 20) ? 0.2 : 0.2 * (1 - dl) + 0.03); const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, r); g.addColorStop(0, 'rgba(255,170,80,' + k + ')'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(L.x - r, L.y - r, r * 2, r * 2); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function applyCam() { ctx.setTransform(cam.scale, 0, 0, cam.scale, CW / 2 - (cam.x + cam.sx) * cam.scale, CH / 2 - (cam.y + cam.sy) * cam.scale); }

  function drawWeather() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); const s = CH / 720;
    if (env.rain > 0.02 && !(W.indoorAt(P.x, P.y - 20) && P.y > W.groundY)) {
      ctx.strokeStyle = 'rgba(190,205,230,' + (0.28 * env.rain) + ')'; ctx.lineWidth = 1.2 * s; ctx.beginPath();
      const n = Math.floor(170 * env.rain);
      for (let i = 0; i < n; i++) { const x = ((U.hash(i, 1) * CW * 1.2 - cam.x * cam.scale * 0.9 - GB.time * 140 * s) % (CW * 1.2) + CW * 1.2) % (CW * 1.2) - CW * 0.1, y = ((U.hash(i, 2) * CH + GB.time * (900 + U.hash(i, 3) * 400) * s) % CH); ctx.moveTo(x, y); ctx.lineTo(x - 5 * s, y + 20 * s); }
      ctx.stroke();
    }
    if (env.fog > 0.02) { for (let i = 0; i < 4; i++) { const y = CH * (0.3 + i * 0.18) + Math.sin(GB.time * 0.2 + i) * 20, g = ctx.createLinearGradient(0, y - 130 * s, 0, y + 130 * s); const c = 150 + 60 * env.dayLight(); g.addColorStop(0, 'rgba(' + c + ',' + c + ',' + (c + 8) + ',0)'); g.addColorStop(0.5, 'rgba(' + c + ',' + c + ',' + (c + 8) + ',' + 0.2 * env.fog + ')'); g.addColorStop(1, 'rgba(' + c + ',' + c + ',' + (c + 8) + ',0)'); ctx.fillStyle = g; ctx.fillRect(0, y - 130 * s, CW, 260 * s); } }
    if (env.flash > 0.02) { ctx.fillStyle = 'rgba(225,230,255,' + env.flash * 0.3 + ')'; ctx.fillRect(0, 0, CW, CH); }
    if (fx.flashA > 0.4) { ctx.fillStyle = 'rgba(255,255,255,' + (fx.flashA - 0.4) + ')'; ctx.fillRect(0, 0, CW, CH); }
    // vignette: deepens when hidden / hurt
    const v = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.45, CW / 2, CH / 2, CH * 0.95); const hurt = P.hurtT > 0 || P.hp < 30;
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, hurt ? 'rgba(120,0,0,' + (0.35 + (P.hp < 30 ? 0.12 * Math.sin(GB.time * 6) : 0)) + ')' : 'rgba(0,0,0,' + (P.state === 'hidden' ? 0.62 : 0.34) + ')'); ctx.fillStyle = v; ctx.fillRect(0, 0, CW, CH);
  }

  // ---------------- frame ----------------
  const R = GB.render = {
    init(canvas) { cv = canvas; ctx = cv.getContext('2d'); lightCv = document.createElement('canvas'); lctx = lightCv.getContext('2d'); R.resize(); window.addEventListener('resize', R.resize); },
    resize() { DPR = Math.min(window.devicePixelRatio || 1, 1.5); CW = cv.width = Math.max(64, Math.floor(window.innerWidth * DPR)); CH = cv.height = Math.max(64, Math.floor(window.innerHeight * DPR)); lightCv.width = Math.ceil(CW * 0.33); lightCv.height = Math.ceil(CH * 0.33); R.CW = CW; R.CH = CH; R.DPR = DPR; },
    ctx() { return ctx; },
    draw(dt) {
      const sk = skyCols();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawSky(sk); drawParallax(sk);
      const vw = cam.viewW(), vh = cam.viewH();
      vx0 = Math.floor((cam.x - vw / 2) / T) - 1; vx1 = Math.floor((cam.x + vw / 2) / T) + 1; vy0 = Math.floor((cam.y - vh / 2) / T) - 1; vy1 = Math.floor((cam.y + vh / 2) / T) + 1;
      applyCam();
      drawInteriors(); drawBuildings(); drawTiles(); drawProps(false);
      for (const b of GB.combat.bodies) if (onScreen(b.x, b.y)) GB.stick.body(ctx, b);
      for (const c of GB.ai.civs) if (onScreen(c.x, c.y)) GB.stick.civ(ctx, c, dt);
      for (const g of GB.ai.guards) if (!g.dead && onScreen(g.x, g.y)) GB.stick.guard(ctx, g, dt);
      GB.stick.player(ctx, P, dt, false);
      // projectiles
      for (const p of GB.combat.projectiles) { const a = Math.atan2(p.vy, p.vx); if (p.kind === 'coin') { ctx.fillStyle = '#e6c35a'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill(); } else if (p.kind === 'smoke' || p.kind === 'flash') { ctx.fillStyle = p.kind === 'smoke' ? '#3a3a40' : '#d8d2b0'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill(); } else { ctx.strokeStyle = p.kind === 'arrow' || p.kind === 'parrow' ? '#b89a6a' : '#dfe6ee'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * (p.kind === 'knife' || p.kind === 'dart' ? 8 : 15), p.y - Math.sin(a) * (p.kind === 'knife' || p.kind === 'dart' ? 8 : 15)); ctx.stroke(); } }
      drawProps(true); drawWater();
      for (const s of GB.stealth.smokes) { const k = Math.min(1, (s.life - s.t) / 2); for (let i = 0; i < 9; i++) { const a = i * 0.7 + GB.time * 0.3, r = s.r * (0.45 + 0.2 * Math.sin(i * 2.3 + GB.time)); ctx.fillStyle = 'rgba(96,98,108,' + 0.3 * k + ')'; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * s.r * 0.5, s.y + Math.sin(a * 1.3) * s.r * 0.3, r, 0, 7); ctx.fill(); } }
      for (const p of parts) if (!p.kind) { ctx.fillStyle = 'rgba(' + p.col + ',' + Math.min(1, p.life / p.max * 1.4) + ')'; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
      drawLighting();
      applyCam();
      // things that must read through darkness
      if (GB.save.settings.cones) for (const g of GB.ai.guards) if (!g.dead && g.sleepT <= 0 && g.stunT <= 0 && onScreen(g.x, g.y, 420)) drawCone(g);
      GB.stick.player(ctx, P, 0, true);
      for (const g of GB.ai.guards) if (!g.dead && onScreen(g.x, g.y)) drawGuardMarks(g);
      for (const p of parts) if (p.kind) { const k = p.life / p.max; if (p.kind === 'glow') { ctx.fillStyle = 'rgba(' + p.col + ',' + k + ')'; ctx.fillRect(p.x - 1, p.y - 1, p.size, p.size); } else { ctx.strokeStyle = 'rgba(' + p.col + ',' + k * 0.8 + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); if (p.kind === 'ripple') ctx.ellipse(p.x, p.y, (1 - k) * 26 + 4, (1 - k) * 5 + 1, 0, 0, 7); else ctx.arc(p.x, p.y, (1 - k) * 30 + 4, 0, 7); ctx.stroke(); } }
      for (const r of GB.stealth.rings) { if (r.kind === 'step' && r.r < 60) continue; const k = r.t / 0.7; ctx.strokeStyle = 'rgba(255,255,255,' + 0.22 * (1 - k) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y - 6, r.r * (0.25 + 0.75 * k), 0, 7); ctx.stroke(); }
      if (GB.hud && GB.hud.world) GB.hud.world(ctx);
      drawWeather();
      if (GB.hud) GB.hud.draw(ctx, CW, CH, DPR);
    }
  };
})();
