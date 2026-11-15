// GHOSTBLADE - procedural stick-figure animation (poses blend smoothly; nothing is pre-drawn)
(function () {
  'use strict';
  const GB = window.GB, U = GB.util;
  const KEYS = ['hip', 'lean', 'rot', 'head', 'la0', 'la1', 'lb0', 'lb1', 'aa0', 'aa1', 'ab0', 'ab1', 'dy'];
  const base = () => ({ hip: 20, lean: 0.02, rot: 0, head: 0, la0: 0.08, la1: 0.06, lb0: -0.08, lb1: 0.06, aa0: 0.12, aa1: 0.15, ab0: -0.12, ab1: 0.15, dy: 0, ground: true, snap: false });
  const set = (o, la0, la1, lb0, lb1, aa0, aa1, ab0, ab1) => { o.la0 = la0; o.la1 = la1; o.lb0 = lb0; o.lb1 = lb1; o.aa0 = aa0; o.aa1 = aa1; o.ab0 = ab0; o.ab1 = ab1; return o; };

  function cycle(o, ph, A) {
    const s = Math.sin(ph), c = Math.cos(ph);
    o.la0 = s * A; o.la1 = (0.25 + 0.75 * Math.max(0, -c)) * A * 1.5;
    o.lb0 = -s * A; o.lb1 = (0.25 + 0.75 * Math.max(0, c)) * A * 1.5;
    o.aa0 = -s * A * 0.9; o.aa1 = 0.3 + A * 0.9; o.ab0 = s * A * 0.9; o.ab1 = 0.3 + A * 0.9;
    o.lean = 0.04 + A * 0.26; o.dy = Math.abs(c) * A * 2.2; return o;
  }
  function sneak(o, ph, moving) {
    const s = moving ? Math.sin(ph) : 0;
    set(o, 1.3 + s * 0.35, 2.3, 0.9 - s * 0.35, 2.0, 0.9 - s * 0.4, 0.5, 0.5 + s * 0.4, 0.6); o.lean = 1.22; o.head = -0.7; return o;
  }
  function climb(o, ph) { const s = Math.sin(ph); set(o, 0.9 + s * 0.45, 1.5, 0.9 - s * 0.45, 1.5, 2.6 + s * 0.45, 0.25, 2.6 - s * 0.45, 0.25); o.lean = 0.08; o.ground = false; return o; }

  // ---------- pose selection ----------
  function playerPose(P) {
    const o = base(), ph = P.runPhase, sp = Math.abs(P.vx), t = GB.time;
    switch (P.state) {
      case 'dead': set(o, 0.2, 0.3, -0.1, 0.2, 2.2, 0.3, -0.6, 0.2); o.rot = 1.5 * Math.min(1, P.deadT * 4); break;
      case 'hang': {
        const sway = Math.sin(t * 2.2) * 0.07;
        if (P.hang && P.hang.kind === 'bar') { const s = Math.sin(ph); set(o, 0.1 + sway, 0.25, -0.1 + sway, 0.2, 3.0 + s * 0.2, 0, 3.25 - s * 0.2, 0); o.hip = 12; }
        else { set(o, 0.25 + sway, 0.5, 0.05 + sway, 0.3, 3.0, 0.05, 3.15, 0.05); o.hip = 11; }
        o.ground = false; break;
      }
      case 'pullup': { const k = Math.min(1, P.pull.t / P.pull.dur); set(o, 0.2 + 1.2 * k * (1 - k) * 4 * 0.5, 1.6 * (1 - k), 0.1, 0.9 * (1 - k), 3.0 - 2.5 * k, 0.4 * k, 3.1 - 2.6 * k, 0.4 * k); o.lean = 0.5 * Math.sin(k * Math.PI); o.ground = false; o.hip = 12 + 8 * k; break; }
      case 'climb': {
        if (P.burstT > 0) { cycle(o, ph * 1.3, 0.95); o.rot = P.climb.kind === 'wall' ? -1.15 : 0; o.lean = 0.2; if (P.climb.kind !== 'wall') { o.aa0 = 2.7 + Math.sin(ph) * 0.5; o.ab0 = 2.7 - Math.sin(ph) * 0.5; } o.ground = false; }
        else climb(o, ph);
        break;
      }
      case 'ladder': climb(o, ph); o.aa0 -= 0.5; o.ab0 -= 0.5; o.aa1 = 0.9; o.ab1 = 0.9; break;
      case 'swing': { const s = P.swing; set(o, -0.3, 0.3, -0.5, 0.5, 3.05, 0, 3.2, 0); o.rot = -(s ? s.ang : 0) * 0.7 * P.face; o.ground = false; o.hip = 10; break; }
      case 'swim': { const s = Math.sin(ph); set(o, -0.2 + s * 0.25, 0.3, -0.2 - s * 0.25, 0.3, 2.6 + s * 0.9, 0.2, 2.6 - s * 0.9, 0.2); o.rot = 1.2; o.ground = false; o.hip = 34; break; }
      case 'sit': set(o, 1.5, 1.5, 1.42, 1.5, 0.45, 0.7, 0.3, 0.8); o.lean = -0.06; o.hip = 11; o.ground = false; o.head = 0.15; break;
      case 'zip': set(o, -0.4, 0.4, -0.2, 0.7, 2.7, 0, 0.3, 0.4); o.lean = 0.3; o.ground = false; break;
      case 'leap': {
        const l = P.leap;
        if (l.t < 0) { set(o, 1.3, 2.3, 1.1, 2.1, -0.9, 0.2, -1.1, 0.2); o.lean = 0.7; }
        else { const k = l.t / l.D; set(o, -0.12, 0.08, 0.06, 0.1, 2.75, 0, -2.6, 0); o.rot = k < 0.8 ? U.lerp(0.5, 2.05, U.ease(Math.min(1, k * 1.7))) : U.lerp(2.05, 4.5, (k - 0.8) / 0.2); o.ground = false; o.snap = true; }
        break;
      }
      case 'lock': {
        const l = P.lock, k = Math.min(1, l.t / l.dur), a = l.anim || 'kill';
        if (a === 'dive') { set(o, -0.6, 0.7, -0.25, 1.0, 2.3, 0, 1.5, 0.5); o.rot = 0.95; o.ground = false; }
        else if (a === 'ledgekill') { const r = Math.sin(k * Math.PI); set(o, 0.25, 0.5, 0.05, 0.3, 3.0, 0.05, 3.1 - r * 1.0, r * 0.9); o.hip = 11; o.ground = false; }
        else if (a === 'hidekill') { set(o, 0.3, 0.5, -0.2, 0.4, 1.6, 0.2, 1.2, 0.6); o.lean = 0.4; }
        else { const r = Math.sin(Math.min(1, k * 1.6) * Math.PI); set(o, 0.75, 0.3, -0.55, 0.45, 1.3 + r * 0.6, 0.6 - r * 0.6, a === 'double' ? -1.3 - r * 0.6 : 0.9, a === 'double' ? 0.2 : 1.2); o.lean = 0.3 + r * 0.15; }
        break;
      }
      default: {
        if (P.rollT > 0) { set(o, 1.8, 2.3, 1.6, 2.3, 1.2, 1.6, 1.0, 1.6); o.lean = 1.0; o.rot = (1 - P.rollT / 0.42) * Math.PI * 2; o.snap = true; o.hip = 9; o.pivot = true; }
        else if (P.slideT > 0) { set(o, 1.35, 0.15, 1.0, 0.7, -0.7, 0.3, 0.5, 0.3); o.rot = -1.1; }
        else if (P.vaultT > 0) { set(o, 1.5, 0.5, 1.15, 0.9, 0.2, 0, 1.3, 0.5); o.rot = 0.55; o.ground = false; o.hip = 16; }
        else if (!P.onGround) {
          if (P.vy < 0) set(o, 0.75, 1.1, -0.25, 0.5, 2.3, 0.3, -0.9, 0.4); else set(o, 0.3, 0.45, -0.35, 0.6, 2.2 + Math.sin(t * 14) * 0.1, -0.2, -2.0, 0.3);
          o.lean = 0.18; o.ground = false;
        }
        else if (P.crouch) sneak(o, ph, sp > 12);
        else if (P.landT > 0) { set(o, 0.9, 1.6, 0.6, 1.5, 0.8, 0.4, -0.4, 0.3); o.lean = 0.6; }
        else if (sp > 12) cycle(o, ph, sp > 250 ? 1.0 : sp > 100 ? 0.62 : 0.4);
        else o.dy = Math.sin(t * 2) * 0.5;
        if (P.blocking) { o.aa0 = 1.5; o.aa1 = 1.25; o.ab0 = 1.2; o.ab1 = 0.9; }
        else if (P.attackT > 0) { const k = 1 - P.attackT / 0.2; if (P.throwing) { o.aa0 = 2.9 - k * 1.8; o.aa1 = 0.1; } else { o.aa0 = 2.7 - k * 2.3; o.aa1 = 0.15; o.lean += 0.2; } o.snapArm = true; }
        if (P.carrying) { o.aa0 = 2.5; o.aa1 = 0.9; o.ab0 = 2.2; o.ab1 = 1.1; o.lean += 0.12; }
      }
    }
    return o;
  }
  function guardPose(g) {
    const o = base(), sp = Math.abs(g.vx);
    if (g.sleepT > 0) { set(o, 0.2, 0.3, -0.1, 0.2, 1.8, 0.4, 0.4, 0.3); o.rot = 1.5; return o; }
    if (g.ladder || g.climbing) return climb(o, g.phase);
    if (g.stunT > 0) { set(o, 0.2, 0.3, -0.2, 0.3, 2.5, 2.0, 2.3, 2.1); o.lean = -0.15 + Math.sin(GB.time * 9) * 0.06; return o; }
    if (sp > 8) cycle(o, g.phase, sp > 150 ? 0.9 : 0.42); else o.dy = Math.sin(GB.time * 1.7 + g.phase) * 0.4;
    if (g.attackT > 0) { o.aa0 = 3.0; o.aa1 = 0.4; o.lean = -0.1; }
    else if (g.attackCd > 0.75 && g.state === 'combat' && !g.cfg.ranged) { o.aa0 = 0.9; o.aa1 = 0.2; o.lean = 0.3; }
    else if (g.stoneT > 0 && g.state === 'combat') { const k = Math.min(1, g.aimT / 1.3); o.aa0 = -2.6 + k * 0.5; o.aa1 = -0.9; }
    else if (g.cfg.ranged && g.state === 'combat' && g.aimT > 0) { o.aa0 = 1.57; o.aa1 = 0; o.ab0 = 1.3; o.ab1 = 1.5 - Math.min(1, g.aimT) * 0.6; }
    else if (g.poking) { o.aa0 = 1.5 + Math.sin(GB.time * 10) * 0.2; o.aa1 = 0.1; o.lean = 0.3; }
    else if (g.state === 'suspicious') { o.ab0 = 2.4; o.ab1 = 1.9; }
    else if (g.torch) { o.ab0 = 1.9; o.ab1 = 0.6; }
    else if (g.type === 'guard' || g.type === 'elite') { o.aa0 = 0.5; o.aa1 = 1.3; }
    return o;
  }
  function civPose(c) {
    const o = base(), sp = Math.abs(c.vx);
    if (sp > 8) cycle(o, c.phase, sp > 100 ? 0.85 : 0.36); else { o.dy = Math.sin(GB.time * 1.5 + c.phase) * 0.4; if (c.crowd || c.merchant) { o.aa0 = 0.8 + Math.sin(GB.time * 2 + c.phase * 3) * 0.5; o.aa1 = 1.2; } }
    if (c.flee > 0) { o.aa0 = 2.8; o.ab0 = 2.6; o.aa1 = 0.3; o.ab1 = 0.3; }
    return o;
  }

  // ---------- kinematics ----------
  function blend(e, tgt, dt) {
    let p = e._pose; if (!p || tgt.snap) { p = e._pose = Object.assign({}, tgt); return p; }
    const k = 1 - Math.exp(-20 * dt);
    for (const key of KEYS) p[key] += (tgt[key] - p[key]) * k;
    if (tgt.snapArm) { p.aa0 = tgt.aa0; p.aa1 = tgt.aa1; }
    p.ground = tgt.ground; p.pivot = tgt.pivot; return p;
  }
  const J = { hip: [0, 0], neck: [0, 0], head: [0, 0], ka: [0, 0], fa: [0, 0], kb: [0, 0], fb: [0, 0], ea: [0, 0], ha: [0, 0], eb: [0, 0], hb: [0, 0] };
  function solve(p, scale) {
    const L = 10 * scale, TOR = 14 * scale, ARM = 8 * scale, hy = p.hip * scale;
    const pt = (o, x, y) => { o[0] = x; o[1] = y; };
    pt(J.hip, 0, hy);
    pt(J.neck, Math.sin(p.lean) * TOR, hy + Math.cos(p.lean) * TOR);
    pt(J.head, J.neck[0] + Math.sin(p.lean + p.head) * 6 * scale, J.neck[1] + Math.cos(p.lean + p.head) * 6 * scale);
    const leg = (k, f, a, b) => { pt(k, Math.sin(a) * L, hy - Math.cos(a) * L); pt(f, k[0] + Math.sin(a - b) * L, k[1] - Math.cos(a - b) * L); };
    leg(J.ka, J.fa, p.la0, p.la1); leg(J.kb, J.fb, p.lb0, p.lb1);
    const arm = (e, h, a, b) => { pt(e, J.neck[0] + Math.sin(a) * ARM, J.neck[1] - 2 * scale - Math.cos(a) * ARM); pt(h, e[0] + Math.sin(a + b) * ARM, e[1] - Math.cos(a + b) * ARM); };
    arm(J.ea, J.ha, p.aa0, p.aa1); arm(J.eb, J.hb, p.ab0, p.ab1);
    if (p.rot) {
      const c = Math.cos(p.rot), s = Math.sin(p.rot), px = 0, py = p.pivot ? hy + 4 : hy;
      for (const k in J) { const q = J[k], x = q[0] - px, y = q[1] - py; q[0] = px + x * c + y * s; q[1] = py - x * s + y * c; }
    }
    if (p.ground) { let m = 1e9; for (const k in J) m = Math.min(m, J[k][1]); m -= (p.rot ? 3 : 0); for (const k in J) J[k][1] -= m; }
    if (p.dy) for (const k in J) if (k !== 'fa' && k !== 'fb') J[k][1] += p.dy * (k === 'ka' || k === 'kb' ? 0.5 : 1);
    return J;
  }
  function limbs(ctx, x, y, f, lw, col) {
    const X = q => x + q[0] * f, Y = q => y - q[1];
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(X(J.fb), Y(J.fb)); ctx.lineTo(X(J.kb), Y(J.kb)); ctx.lineTo(X(J.hip), Y(J.hip)); ctx.lineTo(X(J.ka), Y(J.ka)); ctx.lineTo(X(J.fa), Y(J.fa));
    ctx.moveTo(X(J.hip), Y(J.hip)); ctx.lineTo(X(J.neck), Y(J.neck));
    ctx.moveTo(X(J.hb), Y(J.hb)); ctx.lineTo(X(J.eb), Y(J.eb)); ctx.lineTo(X(J.neck), Y(J.neck) + 2); ctx.lineTo(X(J.ea), Y(J.ea)); ctx.lineTo(X(J.ha), Y(J.ha));
    ctx.stroke();
  }
  const X = (x, f, q) => x + q[0] * f, Y = (y, q) => y - q[1];

  const S = GB.stick = {
    outfit() { return GB.defs.byId(GB.defs.outfits, GB.save.outfit) || GB.defs.outfits[0]; },

    player(ctx, P, dt, rim) {
      if (P.state === 'hidden') { // just a pair of eyes in the dark
        const s = P.hideSpot; if (P.lock) return; ctx.fillStyle = 'rgba(230,235,245,' + (0.5 + 0.3 * Math.sin(GB.time * 3)) + ')'; ctx.fillRect(s.x - 4, s.y - s.h * 0.55, 2, 2); ctx.fillRect(s.x + 2, s.y - s.h * 0.55, 2, 2); return;
      }
      const o = S.outfit(), p = blend(P, playerPose(P), dt), f = P.face, x = P.x, y = P.y;
      solve(p, 1);
      const nx = X(x, f, J.neck), ny = Y(y, J.neck), hx = X(x, f, J.head), hy = Y(y, J.head);
      if (rim) { limbs(ctx, x, y, f, 5.5, 'rgba(190,205,230,0.16)'); ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, 7); ctx.fillStyle = 'rgba(190,205,230,0.16)'; ctx.fill(); return; }
      // cloak: flows opposite to motion
      const wave = Math.sin(GB.time * 7 + P.x * 0.03) * 2.5, back = -f * (8 + Math.min(16, Math.abs(P.vx) * 0.055)) - P.vx * 0.012, drop = 20 - Math.min(10, Math.abs(P.vx) * 0.03) - U.clamp(P.vy * 0.02, -12, 10);
      const rr = p.rot || 0, cr = Math.cos(rr * f), sr = Math.sin(rr * f);
      const tipX = nx + back * cr - drop * sr * -1 * 0 + wave * 0.3, tipY = ny + drop * Math.max(0.2, Math.cos(rr)) + back * 0 + wave;
      ctx.fillStyle = o.cloak; ctx.beginPath(); ctx.moveTo(nx + f * 2, ny - 1);
      ctx.quadraticCurveTo(nx + back * 0.4, ny + drop * 0.3, tipX + f * 3, tipY + 3);
      ctx.lineTo(tipX - f * 4, tipY - 3 + wave * 0.4); ctx.quadraticCurveTo(nx + back * 0.9, ny + drop * 0.2, nx - f * 3, ny - 3); ctx.closePath(); ctx.fill();
      // carried body
      if (P.carrying) { ctx.strokeStyle = '#1b1b1f'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(nx - f * 16, ny + 4); ctx.lineTo(nx - f * 4, ny - 5); ctx.lineTo(nx + f * 8, ny - 4); ctx.lineTo(nx + f * 14, ny + 6); ctx.stroke(); ctx.beginPath(); ctx.arc(nx - f * 19, ny + 6, 4.5, 0, 7); ctx.fillStyle = '#1b1b1f'; ctx.fill(); }
      limbs(ctx, x, y, f, 3.3, o.body);
      // head + hood
      ctx.fillStyle = o.body; ctx.beginPath(); ctx.arc(hx, hy, 5.2, 0, 7); ctx.fill();
      const la = p.lean + p.head + rr, ux = Math.sin(la) * f, uy = -Math.cos(la);
      ctx.fillStyle = o.cloak; ctx.beginPath(); ctx.moveTo(hx + ux * 6 - f * uy * 1.5 * -1, hy + uy * 6); ctx.lineTo(hx + f * 7.5 * Math.abs(uy) + ux * 2, hy + uy * 1 + 1.5); ctx.lineTo(hx + ux * 0.5 + f * 2, hy - uy * 2);
      ctx.lineTo(hx - f * 6.2, hy + 4); ctx.lineTo(hx - f * 7.5, hy - 2 + uy * 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = o.trim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + f * 7.5 * Math.abs(uy) + ux * 2, hy + uy + 1.5); ctx.lineTo(hx + ux * 0.5 + f * 2, hy - uy * 2); ctx.stroke();
      // weapons
      const hand = J.ha, wx = X(x, f, hand), wy = Y(y, hand), el = J.ea, ax = wx - X(x, f, el), ay = wy - Y(y, el), al = Math.hypot(ax, ay) || 1;
      const stab = P.state === 'lock' || (P.attackT > 0 && !P.throwing && GB.save.weapon === 'blade');
      if (stab) { ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + ax / al * 9, wy + ay / al * 9); ctx.stroke(); }
      else if (P.drawn && P.state !== 'climb' && P.state !== 'hang' && P.state !== 'swim') {
        const two = GB.save.weapon === 'daggers', len = two ? 10 : 17;
        ctx.strokeStyle = '#cfd6de'; ctx.lineWidth = 1.8; ctx.beginPath();
        if (P.blocking) { ctx.moveTo(wx, wy + 4); ctx.lineTo(wx + f * 2, wy - len); }
        else { ctx.moveTo(wx, wy); ctx.lineTo(wx + ax / al * len, wy + ay / al * len); }
        if (two) { const h2 = J.hb, bx = X(x, f, h2), by = Y(y, h2); ctx.moveTo(bx, by); ctx.lineTo(bx + f * 6, by + 8); }
        ctx.stroke();
      }
      if (P.state === 'zip' && GB.combat.rope) { ctx.strokeStyle = 'rgba(200,180,140,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(GB.combat.rope.x, GB.combat.rope.y); ctx.stroke(); }
    },

    guard(ctx, g, dt) {
      const p = blend(g, guardPose(g), dt), f = g.face, x = g.x, y = g.y, t = g.type;
      solve(p, 1);
      const C = S.uniform(t, g), nx = X(x, f, J.neck), ny = Y(y, J.neck), hx = X(x, f, J.head), hy = Y(y, J.head), px = X(x, f, J.hip), py = Y(y, J.hip);
      limbs(ctx, x, y, f, 3.2, g.hurtT > 0 ? '#e8e8e8' : C.limb);
      // tabard / torso
      ctx.strokeStyle = C.main; ctx.lineWidth = 6.5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(px, py - 1); ctx.lineTo(nx, ny + 1); ctx.stroke(); ctx.lineCap = 'round';
      ctx.strokeStyle = C.trim; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(px - 3, py - 1); ctx.lineTo(px + 3, py - 1); ctx.stroke();
      ctx.fillStyle = C.limb; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, 7); ctx.fill();
      // headgear
      ctx.fillStyle = C.helm;
      if (t === 'archer') { ctx.beginPath(); ctx.moveTo(hx - 6, hy - 1); ctx.lineTo(hx + f * 8, hy - 2); ctx.lineTo(hx, hy - 8); ctx.closePath(); ctx.fill(); }
      else if (t === 'target') { ctx.fillRect(hx - 7, hy - 5, 14, 2); ctx.fillRect(hx - 4, hy - 10, 8, 6); ctx.fillStyle = C.trim; ctx.fillRect(hx - 4, hy - 6, 8, 1.5); }
      else if (t === 'hunter' || t === 'master') { ctx.beginPath(); ctx.moveTo(hx - f * 6, hy + 4); ctx.lineTo(hx - f * 5, hy - 5); ctx.lineTo(hx + f * 1, hy - 7.5); ctx.lineTo(hx + f * 7, hy - 1); ctx.lineTo(hx + f * 2, hy - 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = C.trim; ctx.fillRect(hx + f * 1 - 1, hy - 1, 3, 1.4); }
      else { ctx.beginPath(); ctx.arc(hx, hy - 1, 5.6, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillRect(hx - 6, hy - 1.5, 12, 1.6); if (t === 'captain' || t === 'elite') { ctx.fillStyle = C.trim; ctx.beginPath(); ctx.moveTo(hx, hy - 6); ctx.quadraticCurveTo(hx - f * 9, hy - 14, hx - f * 8, hy - 3); ctx.lineTo(hx - f * 3, hy - 6); ctx.fill(); } }
      // weapon
      const wx = X(x, f, J.ha), wy = Y(y, J.ha);
      ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 1.7; ctx.beginPath();
      if (g.sleepT > 0) { /* dropped */ }
      else if (t === 'archer') { ctx.strokeStyle = '#7a5a36'; ctx.arc(wx, wy, 11, -1.2 * f + (f < 0 ? Math.PI : 0), 1.2 * f + (f < 0 ? Math.PI : 0), f < 0); ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = 'rgba(230,230,230,0.6)'; ctx.lineWidth = 0.8; ctx.moveTo(wx + Math.cos(1.2) * 11 * f, wy - Math.sin(1.2) * 11); ctx.lineTo(wx + Math.cos(1.2) * 11 * f, wy + Math.sin(1.2) * 11); }
      else if (t === 'guard') { const up = g.attackT > 0; ctx.strokeStyle = '#7a5a36'; ctx.moveTo(wx - (up ? f * 8 : 0), wy + (up ? 4 : 16)); ctx.lineTo(wx + (up ? f * 16 : f * 3), wy - (up ? 14 : 26)); ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = '#d5dae0'; ctx.lineWidth = 2.2; ctx.moveTo(wx + (up ? f * 16 : f * 3), wy - (up ? 14 : 26)); ctx.lineTo(wx + (up ? f * 20 : f * 3.6), wy - (up ? 18 : 32)); }
      else if (t !== 'target') { const up = g.attackT > 0, len = t === 'hunter' ? 12 : 18; ctx.moveTo(wx, wy); ctx.lineTo(wx + (up ? -f * 4 : f * len * 0.8), wy - (up ? len : len * 0.55)); if (t === 'hunter') { const bx = X(x, f, J.hb), by = Y(y, J.hb); ctx.moveTo(bx, by); ctx.lineTo(bx + f * 8, by - 8); } }
      ctx.stroke();
      if (g.torch && g.sleepT <= 0) { const bx = X(x, f, J.hb), by = Y(y, J.hb); ctx.strokeStyle = '#5a4026'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by + 4); ctx.lineTo(bx + f * 2, by - 9); ctx.stroke(); S.flame(ctx, bx + f * 2, by - 10, 1); }
    },
    uniform(t, g) {
      if (g && g.thug) return { limb: '#1c1a18', main: '#4a3b2a', trim: '#8a6a3a', helm: '#2a241e' };
      return ({ guard: { limb: '#1d1a1a', main: '#9a2f2a', trim: '#e0c9a0', helm: '#8d939b' }, archer: { limb: '#1a1d1a', main: '#3e7044', trim: '#d8d0a0', helm: '#2f5234' },
        elite: { limb: '#19171d', main: '#5e3d8a', trim: '#e6c35a', helm: '#b9a45a' }, captain: { limb: '#1d1b16', main: '#c59a2e', trim: '#b02a2a', helm: '#d9c06a' },
        hunter: { limb: '#0e0b0c', main: '#3a0d12', trim: '#ff5a4a', helm: '#1a0a0c' }, target: { limb: '#1b1a22', main: '#2f4f9a', trim: '#e6c35a', helm: '#22366a' },
        master: { limb: '#16161a', main: '#d8d8dc', trim: '#b02a2a', helm: '#e4e4e8' } })[t] || { limb: '#1d1a1a', main: '#9a2f2a', trim: '#e0c9a0', helm: '#8d939b' };
    },
    civ(ctx, c, dt) {
      const p = blend(c, civPose(c), dt), f = c.face, x = c.x, y = c.y; solve(p, 0.96);
      const nx = X(x, f, J.neck), ny = Y(y, J.neck), hx = X(x, f, J.head), hy = Y(y, J.head), px = X(x, f, J.hip), py = Y(y, J.hip);
      limbs(ctx, x, y, f, 3, '#201d1b');
      ctx.strokeStyle = c.hue; ctx.lineWidth = 6; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny + 1); ctx.stroke(); ctx.lineCap = 'round';
      if (c.dress) { ctx.fillStyle = c.hue; ctx.beginPath(); ctx.moveTo(px - 3, py - 2); ctx.lineTo(px + 3, py - 2); ctx.lineTo(px + 7, py + 13); ctx.lineTo(px - 7, py + 13); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#201d1b'; ctx.beginPath(); ctx.arc(hx, hy, 4.8, 0, 7); ctx.fill();
      ctx.fillStyle = c.hue;
      if (c.hat === 1) { ctx.fillRect(hx - 7, hy - 4, 14, 1.8); ctx.fillRect(hx - 4, hy - 8, 8, 4); }
      else if (c.hat === 2) { ctx.beginPath(); ctx.arc(hx, hy - 1, 5.6, Math.PI, 0); ctx.fill(); }
      else if (c.hat === 3) { ctx.beginPath(); ctx.moveTo(hx - 6, hy - 2); ctx.lineTo(hx + 6, hy - 2); ctx.lineTo(hx - f * 3, hy - 11); ctx.fill(); }
      if (c.informant) { ctx.fillStyle = 'rgba(255,90,70,' + (0.6 + 0.4 * Math.sin(GB.time * 5)) + ')'; ctx.beginPath(); ctx.moveTo(hx, hy - 14); ctx.lineTo(hx - 4, hy - 21); ctx.lineTo(hx + 4, hy - 21); ctx.fill(); }
    },
    body(ctx, b) {
      if (b.hidden || b.carried) return;
      const C = b.civ ? { limb: '#201d1b', main: b.hue || '#5a4a3a' } : S.uniform(b.type, b), f = b.face, x = b.x, y = b.y - 3;
      ctx.strokeStyle = C.limb; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(x - f * 22, y - 1); ctx.lineTo(x - f * 12, y - 3); ctx.lineTo(x - f * 2, y); ctx.lineTo(x + f * 12, y - 1);
      ctx.moveTo(x - f * 2, y); ctx.lineTo(x - f * 11, y + 1); ctx.lineTo(x - f * 20, y + 2);
      ctx.moveTo(x + f * 10, y - 1); ctx.lineTo(x + f * 6, y + 2); ctx.moveTo(x + f * 10, y - 1); ctx.lineTo(x + f * 17, y + 2); ctx.stroke();
      ctx.strokeStyle = C.main; ctx.lineWidth = 6; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(x - f * 1, y - 0.5); ctx.lineTo(x + f * 11, y - 1.5); ctx.stroke(); ctx.lineCap = 'round';
      ctx.fillStyle = C.limb; ctx.beginPath(); ctx.arc(x + f * 17, y - 3, 4.8, 0, 7); ctx.fill();
      if (b.knife) { ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + f * 5, y - 3); ctx.lineTo(x + f * 3, y - 11); ctx.stroke(); }
    },
    flame(ctx, x, y, s) {
      const t = GB.time * 9 + x; const h = (7 + Math.sin(t) * 1.6 + Math.sin(t * 2.3) * 1.2) * s;
      ctx.fillStyle = 'rgba(255,150,40,0.9)'; ctx.beginPath(); ctx.moveTo(x - 3 * s, y); ctx.quadraticCurveTo(x - 4 * s, y - h * 0.5, x + Math.sin(t * 1.3) * 1.5, y - h); ctx.quadraticCurveTo(x + 4 * s, y - h * 0.5, x + 3 * s, y); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,150,0.95)'; ctx.beginPath(); ctx.arc(x, y - 2 * s, 1.8 * s, 0, 7); ctx.fill();
    }
  };
})();
