'use strict';
/* ===== SHADOW PROTOCOL :: rig — articulated, procedurally animated stickman =====
   Joints: head, chest, hip, shoulders, elbows, hands, hip joints, knees, feet, weapon(s).
   Every pose parameter is interpolated, so state changes blend instead of snapping. */
function makeRig() {
  return { phase: Math.random() * 6, lean: 0, bd: 0, flip: 1, tuck: 0, recoil: 0, recoil2: 0, fx: 0, fy: 0, reload: 0, swap: 0, land: 0, strike: 0, dead: 0, spd: 0, md: 0, low: 0, J: null, seed: Math.random() * 100 };
}
function updateRig(c, dt) {
  const g = c.rig, sp = Math.hypot(c.vx, c.vy), st = c.state;
  g.spd = lerp(g.spd, sp, damp(12, dt));
  if (sp > 8) g.md = angLerp(g.md, Math.atan2(c.vy, c.vx), damp(14, dt));
  g.phase += dt * (3 + g.spd * .058);
  let lean = 0, tuck = 0, bd = c.aim, flip = 1;
  const va = sp > 5 ? Math.atan2(c.vy, c.vx) : g.bd;
  if (st === 'slide') { lean = 1; bd = va + Math.PI; }
  else if (st === 'dive') { lean = 1; bd = va; }
  else if (st === 'land') { lean = 1; bd = g.bd; }
  else if (st === 'roll' || st === 'dodge') { lean = .85; tuck = 1; bd = va; flip = Math.cos(clamp(c.stT / c.stDur, 0, 1) * TAU); }
  else if (st === 'jump') { tuck = .4; }
  else if (st === 'dead') { lean = 1; bd = c.deathDir; }
  else if (st === 'stagger') { lean = .3; bd = c.aim + Math.PI; }
  else if (st === 'takedown') { lean = .25; bd = c.aim; }
  g.lean = lerp(g.lean, lean, damp(lean ? 18 : 9, dt));
  g.tuck = lerp(g.tuck, tuck, damp(18, dt));
  g.flip = lerp(g.flip, flip, damp(34, dt));
  g.bd = angLerp(g.bd, bd, damp(lean ? 20 : 10, dt));
  g.recoil = lerp(g.recoil, 0, damp(16, dt)); g.recoil2 = lerp(g.recoil2, 0, damp(16, dt));
  const fd = damp(9, dt); g.fx = lerp(g.fx, 0, fd); g.fy = lerp(g.fy, 0, fd);
  g.land = Math.max(0, g.land - dt * 5);
  g.low = lerp(g.low, c.lowered ? 1 : 0, damp(8, dt));
  g.reload = c.reloadT > 0 ? 1 - c.reloadT / c.reloadDur : 0;
  g.swap = c.swapT > 0 ? c.swapT / .25 : 0;
  g.strike = c.strikeT > 0 ? 1 - c.strikeT / c.strikeDur : 0;
  g.dead = st === 'dead' ? Math.min(1, g.dead + dt * 3.2) : 0;
  g.J = computeJoints(c);
}
function elbow(ax, ay, bx, by, l, bend) {
  const dx = bx - ax, dy = by - ay, d = Math.min(Math.hypot(dx, dy), l * 2 - .01) || .01, n = Math.hypot(dx, dy) || .01;
  const h = Math.sqrt(Math.max(0, l * l - d * d / 4)), ux = dx / n, uy = dy / n;
  return { x: ax + ux * d / 2 - uy * h * bend, y: ay + uy * d / 2 + ux * h * bend };
}
function computeJoints(c) {
  const g = c.rig, z = c.z || 0, k = (c.scale || 1) * (1 + z * .011), L = g.lean, tk = g.tuck, D = g.dead;
  const ox = c.x - z * .12, oy = c.y - z * .4;
  const aim = c.aim, ax = Math.cos(aim), ay = Math.sin(aim), apx = -ay, apy = ax;
  const bx = Math.cos(g.bd), by = Math.sin(g.bd);
  let sa = g.bd; if (Math.abs(angDiff(aim, sa)) > Math.PI / 2) sa += Math.PI; sa = angLerp(aim, sa, L);
  const px = -Math.sin(sa), py = Math.cos(sa);
  const tl = lerp(3, 15, L) * (1 - .45 * tk) * g.flip * k;
  const hip = { x: ox - bx * tl * .5, y: oy - by * tl * .5 };
  const chest = { x: ox + bx * tl * .5 + g.fx, y: oy + by * tl * .5 + g.fy };
  const hd = lerp(1.5, 7.5, L) * (1 - .3 * tk) * g.flip * k;
  const head = { x: chest.x + bx * hd + g.fx * .6 + ax * 1.3 * (1 - L) * k, y: chest.y + by * hd + g.fy * .6 + ay * 1.3 * (1 - L) * k };
  const sw = 6.2 * (1 - .3 * tk) * k;
  const shR = { x: chest.x + px * sw, y: chest.y + py * sw }, shL = { x: chest.x - px * sw, y: chest.y - py * sw };
  // ---- arms + weapon attachment ----
  const wd = c.gun || WEAPONS[c.weapon] || { len: 9 };
  const rl = Math.sin(Math.PI * g.reload);
  const reach = (wd.two ? 10 : 13.5) * (1 - .65 * g.swap) * (1 - .35 * g.low) * k;
  const ga = aim + .6 * rl + .7 * g.low + .9 * g.swap, gx = Math.cos(ga), gy = Math.sin(ga);
  const thrust = g.strike ? Math.sin(Math.PI * g.strike) * 10 * k : 0;
  let haR, haL, gun, gun2 = null;
  if (wd.dual) {
    const r1 = reach + thrust - g.recoil * 4.5 * k, r2 = reach - g.recoil2 * 4.5 * k;
    haR = { x: chest.x + ax * r1 + apx * 4.6 * k, y: chest.y + ay * r1 + apy * 4.6 * k };
    haL = { x: chest.x + ax * r2 - apx * 4.6 * k, y: chest.y + ay * r2 - apy * 4.6 * k };
    haR.x = lerp(haR.x, hip.x + px * 6, rl * .8); haR.y = lerp(haR.y, hip.y + py * 6, rl * .8);
    haL.x = lerp(haL.x, hip.x - px * 6, rl * .8); haL.y = lerp(haL.y, hip.y - py * 6, rl * .8);
    gun = { x0: haR.x - gx * 2, y0: haR.y - gy * 2, x1: haR.x + gx * wd.len * k, y1: haR.y + gy * wd.len * k };
    gun2 = { x0: haL.x - gx * 2, y0: haL.y - gy * 2, x1: haL.x + gx * wd.len * k, y1: haL.y + gy * wd.len * k };
  } else {
    const r1 = reach + thrust - g.recoil * 4.5 * k;
    haR = { x: chest.x + ax * r1 + apx * 2 * k, y: chest.y + ay * r1 + apy * 2 * k };
    let sx, sy;
    if (wd.two) { sx = haR.x + gx * wd.len * .5 * k; sy = haR.y + gy * wd.len * .5 * k; }
    else if (L > .5) { sx = shL.x - bx * 5 * k - px * 5 * k; sy = shL.y - by * 5 * k - py * 5 * k; } // free arm balances while prone
    else { sx = haR.x - apx * 2.4 * k; sy = haR.y - apy * 2.4 * k; }
    haL = { x: lerp(sx, hip.x - px * 6 * k, rl), y: lerp(sy, hip.y - py * 6 * k, rl) };
    gun = { x0: haR.x - gx * 2, y0: haR.y - gy * 2, x1: haR.x + gx * wd.len * k, y1: haR.y + gy * wd.len * k };
  }
  if (D > 0) { // ragdoll arms splay out
    const s1 = Math.sin(g.seed * 3), s2 = Math.cos(g.seed * 5);
    haR.x = lerp(haR.x, shR.x + px * 9 * k + bx * 5 * s1 * k, D); haR.y = lerp(haR.y, shR.y + py * 9 * k + by * 5 * s1 * k, D);
    haL.x = lerp(haL.x, shL.x - px * 9 * k + bx * 6 * s2 * k, D); haL.y = lerp(haL.y, shL.y - py * 9 * k + by * 6 * s2 * k, D);
    if (D > .4) { gun = null; gun2 = null; }
  }
  const al = 7.6 * k, elR = elbow(shR.x, shR.y, haR.x, haR.y, al, 1), elL = elbow(shL.x, shL.y, haL.x, haL.y, al, -1);
  // ---- legs ----
  const hw = 3.2 * k, hipR = { x: hip.x + px * hw, y: hip.y + py * hw }, hipL = { x: hip.x - px * hw, y: hip.y - py * hw };
  const mx = Math.cos(g.md), my = Math.sin(g.md), amp = Math.min(9.5, g.spd * .046) * k * (1 - tk * .6), s = Math.sin(g.phase), cp = Math.cos(g.phase);
  const stn = 1.6 * k * (1 + g.land * 1.6);
  const fRu = { x: hipR.x + mx * s * amp + px * stn - ax * 1 * k, y: hipR.y + my * s * amp + py * stn - ay * 1 * k };
  const fLu = { x: hipL.x - mx * s * amp - px * stn + ax * 1.6 * k, y: hipL.y - my * s * amp - py * stn + ay * 1.6 * k };
  const kRu = { x: (hipR.x + fRu.x) / 2 + mx * Math.max(0, cp) * amp * .4, y: (hipR.y + fRu.y) / 2 + my * Math.max(0, cp) * amp * .4 };
  const kLu = { x: (hipL.x + fLu.x) / 2 + mx * Math.max(0, -cp) * amp * .4, y: (hipL.y + fLu.y) / 2 + my * Math.max(0, -cp) * amp * .4 };
  const qx = -by, qy = bx, fl = Math.sin(g.phase * .6) * 1.5;
  let fRp, fLp, kRp, kLp;
  if (c.state === 'slide') { // lead leg extended, trailing leg folded under
    fRp = { x: hip.x - bx * 14 * k + qx * 2 * k, y: hip.y - by * 14 * k + qy * 2 * k }; kRp = { x: hip.x - bx * 7 * k + qx * 3 * k, y: hip.y - by * 7 * k + qy * 3 * k };
    fLp = { x: hip.x - bx * 4 * k - qx * 7 * k, y: hip.y - by * 4 * k - qy * 7 * k }; kLp = { x: hip.x - bx * 8 * k - qx * 5 * k, y: hip.y - by * 8 * k - qy * 5 * k };
  } else {
    const d1 = D * 4 * Math.sin(g.seed * 7), d2 = D * 4 * Math.cos(g.seed * 2);
    fRp = { x: hip.x - bx * 13 * k + qx * (3 + fl + d1) * k, y: hip.y - by * 13 * k + qy * (3 + fl + d1) * k }; kRp = { x: hip.x - bx * 6.5 * k + qx * (4 + d1) * k, y: hip.y - by * 6.5 * k + qy * (4 + d1) * k };
    fLp = { x: hip.x - bx * 11 * k - qx * (3.5 - fl + d2) * k, y: hip.y - by * 11 * k - qy * (3.5 - fl + d2) * k }; kLp = { x: hip.x - bx * 6 * k - qx * (5 + d2) * k, y: hip.y - by * 6 * k - qy * (5 + d2) * k };
  }
  const mix = (a, b) => ({ x: lerp(a.x, b.x, L), y: lerp(a.y, b.y, L) });
  const J = { hip, chest, head, shR, shL, elR, elL, haR, haL, hipR, hipL, knR: mix(kRu, kRp), knL: mix(kLu, kLp), ftR: mix(fRu, fRp), ftL: mix(fLu, fLp), gun, gun2, k, aim };
  if (tk > .01) { const t = 1 - .5 * tk; for (const n of ['elR', 'elL', 'haR', 'haL', 'knR', 'knL', 'ftR', 'ftL']) { J[n].x = ox + (J[n].x - ox) * t; J[n].y = oy + (J[n].y - oy) * t; } if (J.gun) { J.gun = { x0: J.haR.x, y0: J.haR.y, x1: J.haR.x + gx * wd.len * k, y1: J.haR.y + gy * wd.len * k }; if (J.gun2) J.gun2 = { x0: J.haL.x, y0: J.haL.y, x1: J.haL.x + gx * wd.len * k, y1: J.haL.y + gy * wd.len * k }; } }
  return J;
}
function drawRig(x, c, col, J) {
  J = J || c.rig.J; if (!J) return; const k = J.k;
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.strokeStyle = col.limb; x.lineWidth = 3.1 * k;
  x.beginPath(); x.moveTo(J.hipR.x, J.hipR.y); x.lineTo(J.knR.x, J.knR.y); x.lineTo(J.ftR.x, J.ftR.y);
  x.moveTo(J.hipL.x, J.hipL.y); x.lineTo(J.knL.x, J.knL.y); x.lineTo(J.ftL.x, J.ftL.y); x.stroke();
  x.fillStyle = col.limb; x.beginPath(); x.arc(J.ftR.x, J.ftR.y, 2.1 * k, 0, TAU); x.arc(J.ftL.x, J.ftL.y, 2.1 * k, 0, TAU); x.fill();
  x.lineWidth = 4.8 * k; x.beginPath(); x.moveTo(J.hip.x, J.hip.y); x.lineTo(J.chest.x, J.chest.y); x.stroke();
  x.lineWidth = 3.8 * k; x.beginPath(); x.moveTo(J.shL.x, J.shL.y); x.lineTo(J.shR.x, J.shR.y); x.stroke();
  x.lineWidth = 2.7 * k; x.beginPath(); x.moveTo(J.shR.x, J.shR.y); x.lineTo(J.elR.x, J.elR.y); x.lineTo(J.haR.x, J.haR.y);
  x.moveTo(J.shL.x, J.shL.y); x.lineTo(J.elL.x, J.elL.y); x.lineTo(J.haL.x, J.haL.y); x.stroke();
  if (J.gun) { x.strokeStyle = col.gun; x.lineCap = 'butt'; x.lineWidth = 3 * k; x.beginPath(); x.moveTo(J.gun.x0, J.gun.y0); x.lineTo(J.gun.x1, J.gun.y1); if (J.gun2) { x.moveTo(J.gun2.x0, J.gun2.y0); x.lineTo(J.gun2.x1, J.gun2.y1); } x.stroke(); x.lineCap = 'round'; }
  x.fillStyle = col.limb; x.beginPath(); x.arc(J.haR.x, J.haR.y, 1.9 * k, 0, TAU); x.arc(J.haL.x, J.haL.y, 1.9 * k, 0, TAU); x.fill();
  x.fillStyle = col.head; x.beginPath(); x.arc(J.head.x, J.head.y, 5.2 * k, 0, TAU); x.fill();
  x.strokeStyle = col.accent; x.lineWidth = 2 * k; const a = J.aim; // visor shows where the head is looking
  x.beginPath(); x.arc(J.head.x, J.head.y, 4 * k, a - .7, a + .7); x.stroke();
}
function cloneJ(J) { const o = { k: J.k, aim: J.aim, gun: J.gun, gun2: J.gun2 }; for (const n of ['hip', 'chest', 'head', 'shR', 'shL', 'elR', 'elL', 'haR', 'haL', 'hipR', 'hipL', 'knR', 'knL', 'ftR', 'ftL']) o[n] = { x: J[n].x, y: J[n].y }; return o; }
