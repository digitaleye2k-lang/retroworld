'use strict';
/* ===== stickman rig: procedural poses for soldiers (player + enemies) ===== */
function ik(ax, ay, bx, by, l1, l2, bend) {
  const dx = bx - ax, dy = by - ay; let d = Math.hypot(dx, dy); const maxd = l1 + l2 - .01; if (d > maxd) { bx = ax + dx / d * maxd; by = ay + dy / d * maxd; d = maxd; }
  const a = Math.atan2(dy, dx), c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), t = a + Math.acos(c) * bend;
  return [ax + Math.cos(t) * l1, ay + Math.sin(t) * l1, bx, by];
}
function limb(g, pts, w, col) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); }
/* draw a weapon along angle a from (hx,hy) */
function drawGun(g, hx, hy, a, id, s, rec, spin) {
  const Wd = WEAPONS[id] || WEAPONS.rifle; g.save(); g.translate(hx, hy); g.rotate(a); g.scale(s, Math.cos(a) < 0 ? -s : s); g.translate(-rec, 0);
  const L = Wd.len; g.lineJoin = 'round';
  const body = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.fillStyle = '#000'; g.fillRect(-10, -5, L + 12, 10); // silhouette outline
  if (id === 'rifle') { body(-8, -3, 30, 6, '#2c3038'); body(18, -2, 14, 3, '#15171c'); body(-2, 2, 5, 7, '#15171c'); body(8, 2, 4, 6, '#3a3f4a'); body(-12, -2, 6, 5, '#3a3f4a'); body(4, -5, 8, 2, Wd.col); }
  else if (id === 'shotgun') { body(-10, -3, 30, 6, '#5a3a22'); body(10, -3, 18, 3, '#2a2c32'); body(10, 0, 16, 3, '#1a1c20'); body(-2, 3, 5, 5, '#2a1a10'); body(14, 2, 8, 3, '#8a5a32'); }
  else if (id === 'laser') { body(-8, -4, 34, 8, '#1c2a3a'); body(24, -2, 12, 4, '#4af0ff'); body(0, -6, 16, 3, '#2a3e52'); body(-2, 3, 5, 6, '#101820'); g.globalCompositeOperation = 'lighter'; body(2, -1, 22, 2, 'rgba(74,240,255,.8)'); g.globalCompositeOperation = 'source-over'; }
  else if (id === 'rocket') { body(-14, -6, 44, 12, '#3a4a2a'); body(28, -7, 8, 14, '#2a3420'); body(-16, -5, 4, 10, '#1a2014'); body(0, 5, 5, 7, '#151a10'); body(10, -9, 8, 4, '#ff4a3a'); }
  else if (id === 'flame') { body(-10, -4, 32, 8, '#5a2a1a'); body(20, -2, 14, 4, '#2a2a2a'); g.fillStyle = '#ff6a1a'; g.beginPath(); g.arc(-4, 6, 6, 0, TAU); g.fill(); body(-2, 3, 4, 6, '#1a1a1a'); }
  else if (id === 'minigun') { body(-10, -6, 22, 12, '#3a3a3a'); const sp = (spin || 0); for (let i = 0; i < 3; i++) body(10, -5 + i * 3.5 + Math.sin(sp + i) * .6, 30, 2.4, i === 1 ? '#888' : '#5a5a5a'); body(36, -6, 4, 12, '#2a2a2a'); body(-4, 5, 6, 7, '#1a1a1a'); }
  else if (id === 'plasma') { body(-10, -6, 38, 12, '#2a1a3a'); body(22, -4, 14, 8, '#c06bff'); body(-2, 5, 6, 6, '#120a1a'); g.globalCompositeOperation = 'lighter'; body(4, -2, 18, 4, 'rgba(192,107,255,.7)'); g.globalCompositeOperation = 'source-over'; }
  g.restore();
}
/* main figure. o: {x,y,face,run,spd,air,vy,crouch,aim,rec,wpn,body,accent,helmet,hurt,s,band,shield,armor,lean,spin} */
function drawStick(g, o) {
  const s = o.s || 1, f = o.face, x = o.x, y = o.y, bc = o.hurt > 0 ? '#ffffff' : (o.body || '#0b0b10');
  const crouch = o.crouch ? 1 : 0, hipY = y - (crouch ? 17 : 27) * s;
  const lean = (o.lean || 0) + (o.spd || 0) * .12 * f, run = o.run || 0, sp = clamp(o.spd || 0, 0, 1);
  const hipX = x - lean * 4 * s;
  const neckX = hipX + Math.sin(lean) * 22 * s + (crouch ? f * 4 * s : 0), neckY = hipY - Math.cos(lean) * (crouch ? 19 : 22) * s;
  const headX = neckX + f * 1 * s, headY = neckY - 9 * s;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // legs
  const leg = (ph, back) => {
    let fx, fy, bend = f > 0 ? -1 : 1;
    if (o.air) { const tuck = o.vy < 0 ? .7 : .35; fx = hipX + f * (back ? -6 : 9) * s; fy = hipY + (28 - 12 * tuck) * s + (back ? -4 : 0) * s; }
    else if (crouch) { fx = hipX + f * (back ? -12 : 13) * s; fy = y; }
    else { const a = Math.sin(run + ph) * .95 * sp; fx = hipX + Math.sin(a) * 26 * s + (sp < .1 ? (back ? -5 : 5) * f * s : 0); fy = y - Math.max(0, Math.cos(run + ph + .9)) * 9 * s * sp; }
    const k = ik(hipX, hipY, fx, fy, 15 * s, 15 * s, -bend);
    limb(g, [hipX, hipY, k[0], k[1], k[2], k[3]], 5.6 * s, bc); limb(g, [k[2], k[3], k[2] + f * 6 * s, k[3]], 5 * s, bc);
  };
  // back arm behind body
  const a = o.aim, ca = Math.cos(a), sa = Math.sin(a), shX = neckX, shY = neckY + 4 * s, rec = (o.rec || 0) * s;
  const gunX = shX + ca * (11 * s - rec), gunY = shY + sa * (11 * s - rec) + 2 * s;
  const hand2X = gunX + ca * 13 * s, hand2Y = gunY + sa * 13 * s;
  if (o.pack) { g.fillStyle = '#1c1f26'; g.fillRect(neckX - f * 13 * s - 5 * s, neckY + 2 * s, 9 * s, 15 * s); }
  leg(Math.PI, true);
  const eb = ik(shX, shY, gunX, gunY, 10 * s, 10 * s, ca > 0 ? 1 : -1); limb(g, [shX, shY, eb[0], eb[1], eb[2], eb[3]], 4.6 * s, bc);
  // torso
  limb(g, [hipX, hipY, neckX, neckY], 7 * s, bc);
  if (o.armor) { g.fillStyle = o.armor; g.save(); g.translate((hipX + neckX) / 2, (hipY + neckY) / 2); g.rotate(lean); g.fillRect(-6 * s, -9 * s, 12 * s, 16 * s); g.restore(); }
  if (o.belt) { g.strokeStyle = o.belt; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(neckX - f * 4 * s, neckY + 3 * s); g.lineTo(hipX + f * 4 * s, hipY - 3 * s); g.stroke(); }
  leg(0, false);
  // weapon + front arm
  if (o.wpn) drawGun(g, gunX, gunY, a, o.wpn, s, 0, o.spin);
  const ef = ik(shX, shY, hand2X, hand2Y, 11 * s, 12 * s, ca > 0 ? 1 : -1); limb(g, [shX, shY, ef[0], ef[1], ef[2], ef[3]], 4.6 * s, bc);
  // head
  g.fillStyle = bc; g.beginPath(); g.arc(headX, headY, 8 * s, 0, TAU); g.fill();
  if (o.band) { // headband with tails that flow behind
    g.strokeStyle = o.band; g.lineWidth = 3 * s; g.beginPath(); g.arc(headX, headY, 8 * s, Math.PI * .9, Math.PI * 2.1); g.stroke();
    const t = o.t || 0, tx = headX - f * 7 * s, ty = headY - 2 * s; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx - f * 10 * s, ty + Math.sin(t * 9) * 3 * s, tx - f * (18 + sp * 6) * s, ty + 4 * s + Math.sin(t * 11) * 4 * s); g.stroke();
  }
  if (o.helmet) { g.fillStyle = o.helmet; g.beginPath(); g.arc(headX, headY - 1 * s, 9 * s, Math.PI * 1.02, Math.PI * 1.98); g.fill(); g.fillRect(headX - 10 * s, headY - 2 * s, 20 * s, 3 * s); }
  if (o.visor) { g.fillStyle = o.visor; g.fillRect(headX + f * 1 * s - (f < 0 ? 7 * s : 0), headY - 2 * s, 7 * s, 3 * s); if (o.glow) { g.globalCompositeOperation = 'lighter'; g.fillStyle = o.visor + '66'; g.beginPath(); g.arc(headX + f * 4 * s, headY - 1 * s, 6 * s, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; } }
  if (o.shield) { g.save(); g.translate(x + f * 16 * s, y - 30 * s); g.fillStyle = '#20304a'; g.strokeStyle = '#000'; g.lineWidth = 3; g.fillRect(-4 * s, -24 * s, 9 * s, 50 * s); g.strokeRect(-4 * s, -24 * s, 9 * s, 50 * s); g.fillStyle = 'rgba(140,200,255,.6)'; g.fillRect(-2 * s, -18 * s, 4 * s, 10 * s); g.fillStyle = o.shieldFlash > 0 ? '#fff' : '#ffd84a'; g.fillRect(-3 * s, 6 * s, 7 * s, 3 * s); g.restore(); }
  return { gunX, gunY, mx: gunX + ca * (WEAPONS[o.wpn] ? WEAPONS[o.wpn].len : 26) * s, my: gunY + sa * (WEAPONS[o.wpn] ? WEAPONS[o.wpn].len : 26) * s, headX, headY };
}
