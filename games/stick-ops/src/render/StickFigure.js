// Procedural skeletal stickman renderer with IK limbs, tactical gear, weapons, and a verlet ragdoll.

export const STYLES = {
  player: { body: 0x07090b, rim: 0x3d8496, vest: 0x1b242b, gear: 0x121a20, helmet: 'helmet', nvg: true, pack: true, antenna: true, strobe: true, eye: null, scale: 1 },
  rifleman: { body: 0x0a0807, rim: 0x7a2c22, vest: 0x2a221c, gear: 0x1a1512, helmet: 'helmet', mask: true, eye: 0xff3a2a, pack: false, scale: 1 },
  breacher: { body: 0x0a0807, rim: 0x8a3322, vest: 0x332318, gear: 0x1a1512, helmet: 'visor', eye: 0xff6a2a, pack: false, scale: 1.03 },
  sniper: { body: 0x0a0807, rim: 0x7a3a22, vest: 0x26261c, gear: 0x1e1e15, helmet: 'boonie', eye: 0xff3a2a, pack: true, scale: 1 },
  heavy: { body: 0x0a0807, rim: 0x9a3020, vest: 0x2e2420, gear: 0x231b18, helmet: 'heavy', eye: 0xff2a1a, pack: true, bulk: 1.5, scale: 1.14 },
  officer: { body: 0x0a0807, rim: 0x9a6a2a, vest: 0x2a2420, gear: 0x1a1512, helmet: 'beret', eye: 0xffaa2a, pack: false, coat: true, scale: 1 },
  boss: { body: 0x0a0807, rim: 0xc23a22, vest: 0x3a2a22, gear: 0x2a1e1a, helmet: 'heavy', eye: 0xff2a1a, pack: true, bulk: 2.0, scale: 1.4 },
  informant: { body: 0x0b0b0c, rim: 0x9aa3a8, vest: null, gear: 0x2a2a2a, helmet: 'hair', eye: null, pack: false, scale: 0.97 },
  pilot: { body: 0x07090b, rim: 0x3d8496, vest: 0x1b242b, gear: 0x121a20, helmet: 'pilot', eye: null, pack: false, scale: 1 },
};

// Weapon parts: [x, y, w, h, shade] in weapon space (x forward, y down). shade 0 = dark, 1 = mid, 2 = accent
export const WEAPON_SHAPES = {
  rifle: { parts: [[-17, -2, 13, 6, 0], [-5, -3.5, 23, 6.5, 1], [17, -3, 14, 5.5, 0], [30, -1.4, 11, 2.8, 0], [6, 3, 5, 10, 0], [-2, 2.5, 4, 7, 0], [2, -8.5, 11, 4.5, 0], [4, -9.5, 2, 1.5, 2]], muzzle: [41, 0], fore: [23, 2], rear: [0, 3], reach: 11 },
  pistol: { parts: [[-2, -4.5, 17, 5.5, 1], [-2, 1, 12, 3, 0], [-3, 1, 5, 9, 0], [15, -3.6, 7, 3.6, 0]], muzzle: [22, -2], fore: [1, 4], rear: [0, 4], reach: 21 },
  shotgun: { parts: [[-19, -2, 15, 6.5, 0], [-5, -3, 19, 6.5, 1], [14, 0.2, 24, 3.4, 0], [14, -3, 27, 3, 0], [17, -0.6, 11, 5.5, 1], [-2, 2.5, 4, 7, 0]], muzzle: [41, -1.5], fore: [22, 3], rear: [0, 3], reach: 11 },
  sniper: { parts: [[-22, -2.5, 18, 8, 0], [-5, -3.2, 26, 6.5, 1], [21, -1.6, 32, 3.2, 0], [0, -11, 19, 5.5, 0], [-2, -12, 3, 7, 0], [17, -12, 3, 7, 0], [8, 3, 6, 8, 0], [-2, 2.5, 4, 7, 0]], muzzle: [53, 0], fore: [20, 2], rear: [0, 3], reach: 10 },
  launcher: { parts: [[-24, -5.5, 56, 11, 1], [-28, -7, 6, 14, 0], [30, -6.5, 6, 13, 0], [6, -11, 8, 5, 0], [-2, 5, 4, 8, 0], [10, 5, 4, 7, 0]], muzzle: [36, 0], fore: [12, 7], rear: [0, 7], reach: 2 },
  lmg: { parts: [[-18, -2.5, 14, 7, 0], [-5, -4, 28, 8, 1], [22, -2, 24, 4, 0], [4, 4, 12, 11, 0], [-2, 3, 4, 7, 0], [6, -9, 10, 4, 0]], muzzle: [46, 0], fore: [26, 3], rear: [0, 3], reach: 9 },
  minigun: { parts: [[-16, -8, 18, 16, 1], [2, -6, 40, 3, 0], [2, -2, 40, 3, 0], [2, 2, 40, 3, 0], [36, -7, 4, 14, 1], [-10, 8, 12, 8, 0]], muzzle: [44, 0], fore: [16, 6], rear: [-6, 6], reach: 4 },
};

const SHADES = [0x0d1012, 0x1f262b, 0x4a5a63];

function ik(ax, ay, bx, by, l1, l2, sign) {
  let dx = bx - ax, dy = by - ay;
  let d = Math.hypot(dx, dy);
  const maxd = l1 + l2 - 0.05;
  if (d > maxd) { bx = ax + (dx / d) * maxd; by = ay + (dy / d) * maxd; dx = bx - ax; dy = by - ay; d = maxd; }
  d = Math.max(d, 0.01);
  const base = Math.atan2(dy, dx);
  const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, c)));
  const ang = base + A * sign;
  return { jx: ax + Math.cos(ang) * l1, jy: ay + Math.sin(ang) * l1, ex: bx, ey: by };
}

// Computes pose joints in world space.
// p.mem (optional, per-actor object) enables temporal smoothing so pose changes blend instead of snapping.
export function computePose(p) {
  const f = p.facing >= 0 ? 1 : -1;
  const fd = p.facingDisplay !== undefined ? p.facingDisplay : f;   // continuous for turn-around squash
  const S = p.style.scale || 1;
  const mem = p.mem || null; const dt = Math.min(0.05, p.dt || 1 / 60);
  const sm = (key, target, rate) => {
    if (!mem) return target;
    if (mem[key] === undefined || !isFinite(mem[key])) mem[key] = target;
    mem[key] += (target - mem[key]) * (1 - Math.exp(-rate * dt));
    return mem[key];
  };
  const smv = (key, v, rate) => ({ x: sm(key + 'x', v.x, rate), y: sm(key + 'y', v.y, rate) });
  let a = f === 1 ? p.aim : Math.PI - p.aim;
  while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
  a = Math.max(-1.45, Math.min(1.45, a));
  const cr = p.crouch || 0, mv = Math.min(1.2, p.move || 0), t = p.time || 0;
  const vrel = p.vxRel || 0;                 // velocity along facing, -1..1
  const L = { thigh: 23, shin: 23, upper: 15, fore: 14 };
  const ph = p.walk || 0;
  const land = p.land || 0;

  // ---- hips & gait ----
  let hipX = -cr * 3 + Math.sin(t * 0.7) * 1.1 * (1 - Math.min(1, mv * 3));   // idle weight shift
  let hipY = -44 + cr * 15 + land * 9;
  const grounded = !p.air && !p.mantle && !p.climb;
  if (grounded && mv > 0.05) hipY -= (1 - Math.abs(Math.cos(ph))) * (1.2 + 2.6 * mv) - 1.2 * mv;     // bob: highest at mid-stance
  if (p.air) hipY -= 3;

  let fa, fb;
  if (p.seated) { fa = { x: 14, y: 0 }; fb = { x: 10, y: 0 }; hipY = -22; hipX = -4; }
  else if (p.climb) {
    const c = p.climbPhase || 0;
    fa = { x: 6, y: -6 - Math.max(0, Math.sin(c)) * 16 }; fb = { x: 4, y: -6 - Math.max(0, Math.sin(c + Math.PI)) * 16 };
    hipX = -6;
  } else if (p.mantle) {
    const m = p.mantle;   // 0..1
    hipY = -44 - m * 18 + Math.sin(m * Math.PI) * 14;
    fa = { x: 8 + m * 10, y: -26 * Math.sin(m * Math.PI) - 4 }; fb = { x: -4 + m * 8, y: -16 * Math.sin(Math.min(1, m * 1.3) * Math.PI) };
    hipX = -4 + m * 6;
  } else if (p.air) {
    const tuck = Math.max(-1, Math.min(1, (p.vy || 0) / 650));
    const up = Math.max(0, -tuck);
    fa = { x: 9 + up * 4, y: -10 - up * 10 + tuck * 2 }; fb = { x: -8 - tuck * 3, y: -4 - up * 4 + Math.max(0, tuck) * 4 };
  } else if (mv > 0.05) {
    // stance: foot planted & sweeping backward; swing: foot lifted & moving forward
    const stride = (7 + 13 * mv) * (1 - cr * 0.35);
    const lift = (5 + 9 * mv) * (1 - cr * 0.45);
    const foot = (phase) => {
      const c = Math.cos(phase), sn = Math.sin(phase);
      const swing = Math.max(0, -sn);                       // lifts only while moving forward
      return { x: c * stride + 2 + mv * 2, y: -Math.pow(swing, 0.8) * lift };
    };
    fa = foot(ph); fb = foot(ph + Math.PI);
  } else if (cr > 0.5) { fa = { x: 13, y: 0 }; fb = { x: -12, y: 0 }; }
  else { fa = { x: 7, y: 0 }; fb = { x: -6, y: 0 }; }
  const footRate = mv > 0.05 && grounded ? 45 : 22;
  fa = smv('fa', fa, footRate); fb = smv('fb', fb, footRate);
  hipY = sm('hipY', hipY, 22); hipX = sm('hipX', hipX, 14);

  // ---- torso & head ----
  const accelLean = Math.max(-5, Math.min(5, (p.accel || 0) * 0.012));
  let lean = 2 + cr * 6 + a * 2.5 + (p.lean || 0) + Math.max(0, vrel) * 5 - Math.max(0, -vrel) * 1.5 + accelLean;
  if (p.mantle) lean = 10;
  if (p.climb) lean = -2;
  lean = sm('lean', lean, 12);
  const breathe = Math.sin(t * 2.2) * 0.7;
  const hip = { x: hipX, y: hipY };
  const neck = { x: hipX + lean, y: hipY - 30 + breathe };
  const head = smv('head', { x: neck.x + 1.5 + Math.sin(a) * 0.6, y: neck.y - 10.5 + a * 1.4 }, 26);
  const shoulder = { x: neck.x, y: neck.y + 4 };

  const legA = ik(hip.x, hip.y, fa.x, fa.y, L.thigh, L.shin, -1);
  const legB = ik(hip.x, hip.y, fb.x, fb.y, L.thigh, L.shin, -1);

  // ---- weapon ----
  const shape = p.weapon ? WEAPON_SHAPES[p.weapon] : null;
  let wa = a, wpos = null, foreG = null, rearG = null, muzzle = null;
  let handF, handB;
  const reloading = p.reload !== undefined && p.reload !== null && p.reload >= 0;
  const busy = !!(p.mantle || p.climb);
  if (shape && !p.handsUp) {
    let reach = shape.reach - (p.recoil || 0) * 6;
    const bob = grounded ? Math.sin(ph * 2) * 1.3 * mv : 0;
    if (reloading) { const r = p.reload; wa = -0.45 + Math.sin(r * Math.PI) * 0.15; reach -= 4; }
    if (p.lowered || busy) { wa = busy ? 1.25 : 0.75; reach -= 2; }
    wa -= (p.recoil || 0) * 0.25;
    wa += grounded ? Math.sin(ph) * 0.025 * mv : 0;
    if (!reloading && !p.lowered && !busy) wa += Math.sin(t * 1.3) * 0.008;   // idle sway
    wa = sm('wa', wa, p.lowered || reloading || busy ? 12 : 40);
    const ca = Math.cos(wa), sa = Math.sin(wa);
    const px = shoulder.x + Math.cos(wa) * reach, py = shoulder.y + Math.sin(wa) * reach + 1 + bob;
    wpos = { x: px, y: py, a: wa };
    const tr = (lx, ly) => ({ x: px + lx * ca - ly * sa, y: py + lx * sa + ly * ca });
    rearG = tr(shape.rear[0], shape.rear[1]);
    foreG = tr(shape.fore[0], shape.fore[1]);
    muzzle = tr(shape.muzzle[0], shape.muzzle[1]);
    handB = rearG; handF = foreG;
    if (reloading) {
      const r = p.reload; const mag = tr(8, 8);
      const belt = { x: hip.x + 4, y: hip.y - 4 };
      const k = r < 0.5 ? r * 2 : (1 - r) * 2;
      handF = { x: mag.x + (belt.x - mag.x) * k, y: mag.y + (belt.y - mag.y) * k };
    }
  } else if (p.handsUp) {
    handF = { x: neck.x + 4, y: neck.y + 18 }; handB = { x: neck.x - 4, y: neck.y + 18 };
  } else {
    const sw = grounded ? Math.sin(ph) * (4 + 9 * mv) : 0;
    handF = { x: shoulder.x + 3 - sw, y: shoulder.y + 25 - Math.abs(sw) * 0.2 }; handB = { x: shoulder.x - 1 + sw, y: shoulder.y + 25 - Math.abs(sw) * 0.2 };
    if (p.air) { handF = { x: shoulder.x + 12, y: shoulder.y + 10 }; handB = { x: shoulder.x - 10, y: shoulder.y + 12 }; }
  }
  if (p.mantle && p.ledge) { handF = { x: p.ledge.x + 6, y: p.ledge.y }; handB = { x: p.ledge.x - 2, y: p.ledge.y }; }
  if (p.climb) { const c = p.climbPhase || 0; handF = { x: 9, y: neck.y - 6 - Math.max(0, Math.sin(c + Math.PI)) * 12 }; handB = { x: 7, y: neck.y - 6 - Math.max(0, Math.sin(c)) * 12 }; }
  if (p.melee > 0) { const k = Math.sin(p.melee * Math.PI); handB = { x: shoulder.x + 10 + k * 18, y: shoulder.y + 4 - k * 4 }; }
  if (p.throwing > 0) { const k = Math.sin(p.throwing * Math.PI); handF = { x: shoulder.x - 10 + k * 26, y: shoulder.y - 14 + k * 6 }; }
  // support hand gets a little secondary-motion lag when it is not glued to a grip
  if (!shape || reloading || p.throwing > 0 || busy || p.handsUp) handF = smv('hf', handF, 22);
  else if (mem) { mem.hfx = handF.x; mem.hfy = handF.y; }

  const armF = ik(shoulder.x + 1, shoulder.y, handF.x, handF.y, L.upper, L.fore, 1);
  const armB = ik(shoulder.x - 1, shoulder.y, handB.x, handB.y, L.upper, L.fore, 1);

  const W = (pt) => ({ x: p.x + pt.x * fd * S, y: p.y + pt.y * S });
  return {
    f, a, S, local: { hip, neck, head, shoulder, legA, legB, armF, armB, wpos, shape },
    hip: W(hip), neck: W(neck), head: W(head), shoulder: W(shoulder),
    kneeA: W({ x: legA.jx, y: legA.jy }), footA: W({ x: legA.ex, y: legA.ey }),
    kneeB: W({ x: legB.jx, y: legB.jy }), footB: W({ x: legB.ex, y: legB.ey }),
    elbowF: W({ x: armF.jx, y: armF.jy }), handF: W({ x: armF.ex, y: armF.ey }),
    elbowB: W({ x: armB.jx, y: armB.jy }), handB: W({ x: armB.ex, y: armB.ey }),
    muzzle: muzzle ? W(muzzle) : null,
    weaponAngle: wpos ? (f === 1 ? wpos.a : Math.PI - wpos.a) : p.aim,
    W,
  };
}

function seg(g, a, b, w, color, alpha = 1) {
  g.lineStyle(w, color, alpha); g.lineBetween(a.x, a.y, b.x, b.y);
  g.fillStyle(color, alpha); g.fillCircle(a.x, a.y, w * 0.5); g.fillCircle(b.x, b.y, w * 0.5);
}

function poly(g, pts, color, alpha = 1) { g.fillStyle(color, alpha); g.fillPoints(pts, true, true); }

function drawWeapon(g, P, p, color, rimOnly, rimColor) {
  const sh = P.local.shape; const wp = P.local.wpos; if (!sh || !wp) return;
  const ca = Math.cos(wp.a), sa = Math.sin(wp.a);
  for (const part of sh.parts) {
    const [x, y, w, h, shade] = part;
    const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([lx, ly]) => P.W({ x: wp.x + lx * ca - ly * sa, y: wp.y + lx * sa + ly * ca }));
    if (rimOnly) {
      g.lineStyle(2.5, rimColor, 0.9); g.strokePoints(corners, true, true);
    } else poly(g, corners, shade === 2 ? (p.style.weaponAccent || 0x5ee0ff) : SHADES[shade]);
  }
}

function drawHead(g, P, st, p, rimPass) {
  const h = P.head; const f = P.f; const S = P.S;
  const r = 7.5 * S;
  if (rimPass) { g.fillStyle(st.rim, 0.95); g.fillCircle(h.x, h.y, r + 1.8); if (st.helmet === 'helmet' || st.helmet === 'heavy' || st.helmet === 'visor') g.fillCircle(h.x, h.y - 1, r + 3.2); return; }
  g.fillStyle(st.body, 1); g.fillCircle(h.x, h.y, r);
  const gear = st.gear;
  switch (st.helmet) {
    case 'helmet': case 'heavy': case 'visor': case 'pilot': {
      g.fillStyle(gear, 1);
      g.beginPath(); g.arc(h.x, h.y - 0.5 * S, r + 1.8, Math.PI, 0, false); g.closePath(); g.fillPath();
      g.lineStyle(2, gear, 1); g.lineBetween(h.x - f * (r + 1), h.y, h.x + f * (r + 3), h.y - 0.5);
      if (st.helmet === 'heavy') { g.fillStyle(0x2a2220, 1); g.fillRect(h.x + (f === 1 ? 1 : -7), h.y - 2, 6, 8); }
      if (st.helmet === 'visor') { g.fillStyle(0x3a120a, 1); g.fillRect(h.x + (f === 1 ? 1 : -8), h.y - 3, 7, 4); }
      if (st.helmet === 'pilot') { g.fillStyle(0x203a44, 1); g.fillRect(h.x + (f === 1 ? 1 : -8), h.y - 3, 7, 3.5); }
      break;
    }
    case 'boonie': {
      g.fillStyle(gear, 1); g.beginPath(); g.arc(h.x, h.y - 1, r + 0.5, Math.PI, 0, false); g.closePath(); g.fillPath();
      g.fillRect(h.x - r - 5, h.y - 2.5, (r + 5) * 2, 2.5); break;
    }
    case 'beret': {
      g.fillStyle(0x3a1512, 1); g.fillEllipse(h.x - f * 1.5, h.y - r + 1.5, r * 2.1, 5); break;
    }
    case 'hair': {
      g.fillStyle(0x1a1a1a, 1); g.beginPath(); g.arc(h.x - f, h.y - 1, r + 0.6, Math.PI * 1.05, -0.2, false); g.closePath(); g.fillPath(); break;
    }
    default: break;
  }
  if (st.nvg) {
    g.fillStyle(0x1b232a, 1); g.fillRect(h.x + f * 3 - (f === 1 ? 0 : 6), h.y - r - 2, 6, 5);
    g.fillStyle(0x7cff9a, p.nvgDown ? 1 : 0.6); g.fillCircle(h.x + f * 8.5, h.y - r + 0.5, 1.3);
  }
  if (st.mask) { g.fillStyle(0x15100e, 1); g.fillRect(h.x - (f === 1 ? 1 : 7), h.y + 1, 8, 5); }
  if (st.eye) { g.fillStyle(st.eye, 1); g.fillCircle(h.x + f * 4.2, h.y - 1, 1.4); g.fillStyle(st.eye, 0.3); g.fillCircle(h.x + f * 4.2, h.y - 1, 3); }
  if (st.strobe && Math.floor((p.time || 0) * 2.5) % 3 === 0) { g.fillStyle(0x5ee0ff, 1); g.fillCircle(h.x - f * 7, h.y - r + 1, 1.5); }
}

function vestPoly(P, st) {
  const { hip, neck } = P.local; const b = st.bulk || 1;
  return [
    P.W({ x: neck.x - 5 * b, y: neck.y + 3 }), P.W({ x: neck.x + 6 * b, y: neck.y + 3 }),
    P.W({ x: hip.x + 6.5 * b, y: hip.y - 5 }), P.W({ x: hip.x - 5.5 * b, y: hip.y - 4 }),
  ];
}

export function drawFigure(g, p) {
  const st = p.style;
  const P = computePose(p);
  const S = P.S;
  const limbW = 5 * S, rimW = limbW + 3.2;
  const backCol = st.body, rim = st.rim;
  const flash = p.hurt > 0 ? p.hurt : 0;
  const bodyCol = flash > 0.5 ? 0x5a1a14 : st.body;

  // ---- rim pass (silhouette outline lit by environment)
  const R = (a, b) => seg(g, a, b, rimW, rim, 0.9);
  R(P.hip, P.kneeB); R(P.kneeB, P.footB); R(P.shoulder, P.elbowF); R(P.elbowF, P.handF);
  R(P.hip, P.neck); R(P.hip, P.kneeA); R(P.kneeA, P.footA); R(P.shoulder, P.elbowB); R(P.elbowB, P.handB);
  if (st.vest) { const vp = vestPoly(P, st); g.lineStyle(3, rim, 0.9); g.strokePoints(vp, true, true); }
  drawHead(g, P, st, p, true);
  drawWeapon(g, P, p, null, true, rim);

  // ---- body pass
  // back leg & back(support) arm, slightly darker
  seg(g, P.hip, P.kneeB, limbW, backCol); seg(g, P.kneeB, P.footB, limbW * 0.95, backCol);
  boot(g, P.footB, P.f, S, backCol);
  // backpack
  if (st.pack) {
    const { hip, neck } = P.local;
    const pp = [P.W({ x: neck.x - 5, y: neck.y + 2 }), P.W({ x: neck.x - 13, y: neck.y + 5 }), P.W({ x: hip.x - 12, y: hip.y - 8 }), P.W({ x: hip.x - 5, y: hip.y - 6 })];
    poly(g, pp, st.gear);
    if (st.antenna) {
      const top = P.W({ x: neck.x - 10, y: neck.y + 3 }); const tip = P.W({ x: neck.x - 15 - (p.move || 0) * 4, y: neck.y - 18 });
      g.lineStyle(1.2, 0x2a343a, 1); g.lineBetween(top.x, top.y, tip.x, tip.y);
    }
  }
  seg(g, P.shoulder, P.elbowF, limbW * 0.95, backCol); seg(g, P.elbowF, P.handF, limbW * 0.9, backCol);
  // torso
  seg(g, P.hip, P.neck, limbW + 1.5, bodyCol);
  if (st.coat) { const { hip, neck } = P.local; poly(g, [P.W({ x: neck.x - 4, y: neck.y + 2 }), P.W({ x: neck.x + 5, y: neck.y + 2 }), P.W({ x: hip.x + 8, y: hip.y + 12 }), P.W({ x: hip.x - 8, y: hip.y + 12 })], 0x1a1412); }
  if (st.vest) {
    const vp = vestPoly(P, st); poly(g, vp, st.vest);
    const { hip, neck } = P.local; const b = st.bulk || 1;
    // pouches & plate details
    for (let i = 0; i < 3; i++) {
      const y = hip.y - 7 - i * 6.5, x = hip.x + (neck.x - hip.x) * ((i * 6.5 + 7) / 30) + 4 * b;
      poly(g, [P.W({ x: x, y: y }), P.W({ x: x + 3.5 * b, y: y }), P.W({ x: x + 3.5 * b, y: y - 5 }), P.W({ x: x, y: y - 5 })], st.gear);
    }
    const bl = [P.W({ x: hip.x - 6 * b, y: hip.y - 3 }), P.W({ x: hip.x + 7 * b, y: hip.y - 3 }), P.W({ x: hip.x + 7 * b, y: hip.y + 1 }), P.W({ x: hip.x - 6 * b, y: hip.y + 1 })];
    poly(g, bl, st.gear);
  }
  // front leg
  seg(g, P.hip, P.kneeA, limbW, bodyCol); seg(g, P.kneeA, P.footA, limbW * 0.95, bodyCol);
  boot(g, P.footA, P.f, S, bodyCol);
  if (st.vest) { // knee pad
    g.fillStyle(st.gear, 1); g.fillCircle(P.kneeA.x + P.f * 1.5, P.kneeA.y, 3.2 * S);
  }
  drawHead(g, P, st, p, false);
  drawWeapon(g, P, p, null, false);
  // front arm on rear grip
  seg(g, P.shoulder, P.elbowB, limbW, bodyCol); seg(g, P.elbowB, P.handB, limbW * 0.92, bodyCol);
  g.fillStyle(0x15191c, 1); g.fillCircle(P.handB.x, P.handB.y, 2.8 * S); g.fillCircle(P.handF.x, P.handF.y, 2.6 * S);
  if (st.vest) { g.fillStyle(st.gear, 1); g.fillCircle(P.shoulder.x, P.shoulder.y + 1, 3.6 * S * (st.bulk || 1)); }
  if (p.handsUp) { g.lineStyle(2, 0x8a7a5a, 1); g.lineBetween(P.handF.x, P.handF.y, P.handB.x, P.handB.y); }
  return P;
}

function boot(g, ft, f, S, col) {
  g.fillStyle(col, 1);
  g.fillRect(ft.x - (f === 1 ? 3 : 7) * S, ft.y - 3.5 * S, 10 * S, 4.5 * S);
}

// ---------------- Ragdoll -----------------
const BONES = [
  ['head', 'neck', 11], ['neck', 'hip', 30], ['hip', 'kneeA', 23], ['kneeA', 'footA', 23], ['hip', 'kneeB', 23], ['kneeB', 'footB', 23],
  ['neck', 'elbowF', 15], ['elbowF', 'handF', 14], ['neck', 'elbowB', 15], ['elbowB', 'handB', 14],
  ['head', 'hip', 40], ['kneeA', 'kneeB', 0], ['head', 'kneeA', 0],
];

export class Ragdoll {
  constructor(pose, style, impulse, solidsFn) {
    this.style = style; this.solidsFn = solidsFn; this.settled = 0; this.age = 0;
    this.pts = {};
    const S = pose.S;
    for (const k of ['head', 'neck', 'hip', 'kneeA', 'footA', 'kneeB', 'footB', 'elbowF', 'handF', 'elbowB', 'handB']) {
      const p = pose[k]; const w = k === 'head' ? 1.3 : k === 'neck' ? 1.0 : 0.85;
      const vx = impulse.x * w + (Math.random() - 0.5) * 60, vy = impulse.y * w + (Math.random() - 0.5) * 60 - (k === 'head' ? 40 : 0);
      this.pts[k] = { x: p.x, y: p.y, px: p.x - vx / 60, py: p.y - vy / 60 };
    }
    this.bones = BONES.map(([a, b, len]) => {
      const pa = this.pts[a], pb = this.pts[b];
      const l = len === 0 ? Math.hypot(pa.x - pb.x, pa.y - pb.y) : len * S;
      return [pa, pb, l, len === 0 ? 0.15 : 1];
    });
    this.S = S; this.f = pose.f;
  }

  update(dt) {
    this.age += dt;
    if (this.settled > 1.2) return;
    const g = 1500 * dt * dt;
    const solids = this.solidsFn();
    let motion = 0;
    for (const k in this.pts) {
      const p = this.pts[k];
      const vx = (p.x - p.px) * 0.995, vy = (p.y - p.py) * 0.995;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + g;
      motion += Math.abs(vx) + Math.abs(vy);
    }
    for (let it = 0; it < 5; it++) {
      for (const [a, b, len, stiff] of this.bones) {
        const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.001;
        if (stiff < 1 && d > len * 0.6) continue;
        const diff = ((d - len) / d) * 0.5 * stiff;
        a.x += dx * diff; a.y += dy * diff; b.x -= dx * diff; b.y -= dy * diff;
      }
      for (const k in this.pts) {
        const p = this.pts[k];
        for (const s of solids) {
          if (s.oneWay && p.py > s.y + 2) continue;
          if (p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h) {
            const top = p.y - s.y, left = p.x - s.x, right = s.x + s.w - p.x, bottom = s.y + s.h - p.y;
            const m = Math.min(top, left, right, bottom);
            if (m === top) { p.y = s.y; p.px = p.x - (p.x - p.px) * 0.5; }
            else if (s.oneWay) continue;
            else if (m === left) p.x = s.x; else if (m === right) p.x = s.x + s.w; else p.y = s.y + s.h;
          }
        }
      }
    }
    if (motion < 1.2) this.settled += dt; else this.settled = 0;
  }

  draw(g, alpha = 1) {
    const st = this.style; const P = this.pts; const w = 5 * this.S;
    const R = (a, b) => seg(g, a, b, w + 3, st.rim, 0.6);
    const B = (a, b) => seg(g, a, b, w, st.body);
    for (const [a, b] of [['hip', 'kneeB'], ['kneeB', 'footB'], ['neck', 'elbowF'], ['elbowF', 'handF'], ['neck', 'hip'], ['hip', 'kneeA'], ['kneeA', 'footA'], ['neck', 'elbowB'], ['elbowB', 'handB']]) R(P[a], P[b]);
    for (const [a, b] of [['hip', 'kneeB'], ['kneeB', 'footB'], ['neck', 'elbowF'], ['elbowF', 'handF'], ['neck', 'hip'], ['hip', 'kneeA'], ['kneeA', 'footA'], ['neck', 'elbowB'], ['elbowB', 'handB']]) B(P[a], P[b]);
    if (st.vest) {
      const n = P.neck, h = P.hip; const dx = h.x - n.x, dy = h.y - n.y; const d = Math.hypot(dx, dy) || 1; const nx = -dy / d * 5.5 * (st.bulk || 1), ny = dx / d * 5.5 * (st.bulk || 1);
      poly(g, [{ x: n.x + nx, y: n.y + ny }, { x: n.x - nx, y: n.y - ny }, { x: h.x - nx, y: h.y - ny }, { x: h.x + nx, y: h.y + ny }], st.vest);
    }
    const hd = P.head; g.fillStyle(st.rim, 0.6); g.fillCircle(hd.x, hd.y, 7.5 * this.S + 1.6); g.fillStyle(st.body, 1); g.fillCircle(hd.x, hd.y, 7.5 * this.S);
    if (st.helmet && st.helmet !== 'hair' && st.helmet !== 'beret') { g.fillStyle(st.gear, 1); g.fillCircle(hd.x + (P.head.x - P.neck.x) * 0.15, hd.y + (P.head.y - P.neck.y) * 0.15, 7.8 * this.S); }
  }
}
