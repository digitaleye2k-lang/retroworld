'use strict';
/* ===== SHADOW PROTOCOL :: player — movement state machine, gunplay, abilities =====
   States: run | slide | roll | dive | jump | land | takedown | dead
   Chains: slide→roll, slide→dive, roll→slide, dive→slide, dive→roll(land), jump→slide, any air/evasive→wall kick. */
const P = { alive: false, rig: makeRig() };
const PCOL = { limb: '#e9edf2', head: '#ffffff', gun: '#8d949e', accent: '#4fe3ff' };
const upg = k => Save.data.upgrades[k] || 0;
const hasAb = k => !!Save.data.abilities[k];
const curW = () => P.slots[P.cur];

function resetPlayer(x, y) {
  const slots = Save.data.loadout.map(id => ({ id, mag: WEAPONS[id].mag, reserve: Math.round(WEAPONS[id].reserve * (1 + .35 * upg('ammo'))) }));
  Object.assign(P, {
    x, y, vx: 0, vy: 0, aim: 0, r: 11, z: 0, scale: 1, state: 'run', stT: 0, stDur: 1, dirx: 1, diry: 0, sp0: 0,
    hp: 100 + 25 * upg('health'), maxHp: 100 + 25 * upg('health'), energy: 100 + 25 * upg('energy'), maxE: 100 + 25 * upg('energy'),
    btCd: 0, regenDelay: 0, cur: 0, slots, weapon: slots[0].id, fireCd: 0, reloadT: 0, reloadDur: 1, activeUsed: false, perfT: 0, jamT: 0,
    swapT: 0, strikeT: 0, strikeDur: .42, iframes: 0, rollBonus: 0, bloom: 0, touchT: 9, touchN: { x: 0, y: 0 }, hurtT: 0, hurtDir: 0, muzzleT: 0,
    alive: true, de: { cd: 0, mode: 0, marks: [], t: 0, i: 0 }, reflexCd: 0, reflexT: 0, lastStandT: 0, lastStandCd: 0, dodgeCd: 0,
    lastGround: { x, y }, groundT: 0, trail: [], trailT: 0, hand: 0, focus: false, focusSlow: false, tk: null, tkDone: false, tackleId: 0, dustT: 0, rig: makeRig(), deathDir: 0, lowered: false
  });
}
function setState(s, dur) { P.state = s; P.stT = 0; P.stDur = dur || 1; }
function dirFrom(ix, iy, fb) { if (ix || iy) { const l = Math.hypot(ix, iy); return [ix / l, iy / l]; } const sp = Math.hypot(P.vx, P.vy); if (sp > 40) return [P.vx / sp, P.vy / sp]; return [Math.cos(fb), Math.sin(fb)]; }
function startSlide(ix, iy, keep) {
  const [dx, dy] = dirFrom(ix, iy, P.aim); P.dirx = dx; P.diry = dy; P.sp0 = keep || 440; P.z = 0;
  setState('slide', hasAb('phantom') ? .95 : .6); P.tackleId++; Snd.play('slide'); G.stats.moves++;
}
function startRoll(ix, iy) {
  const [dx, dy] = dirFrom(ix, iy, P.aim); P.dirx = dx; P.diry = dy; P.sp0 = 400; P.z = 0;
  setState('roll', .42); P.iframes = .3; Snd.play('roll'); G.stats.moves++;
}
function startDive(ix, iy, sp) {
  const [dx, dy] = dirFrom(ix, iy, P.aim + Math.PI); P.dirx = dx; P.diry = dy; P.sp0 = sp || 400; // no input → dive backwards, still aiming forward
  setState('dive', .62); P.tackleId++; Snd.play('dive'); G.stats.moves++;
}
function startJump() { P.vx *= 1.15; P.vy *= 1.15; setState('jump', .5); Snd.play('roll'); G.stats.moves++; }
function wallKick(ix, iy) {
  const n = P.touchN; let dx = n.x + ix * .8, dy = n.y + iy * .8; const l = Math.hypot(dx, dy) || 1;
  FX.dust(P.x - n.x * 10, P.y - n.y * 10, 8); P.touchT = 9;
  startDive(dx / l, dy / l, 450); Style.bonus(80, 'WALL KICK');
}
function landCheck() {
  P.z = 0; const tx = tileOf(P.x), ty = tileOf(P.y);
  if (inMap(tx, ty) && World.T[tIdx(tx, ty)] === 5) { // dropped into a rooftop gap
    P.x = P.lastGround.x; P.y = P.lastGround.y; P.vx = P.vy = 0; setState('run'); P.iframes = 0; hurtPlayer(20, P.x, P.y); P.iframes = 1; Style.note('LONG WAY DOWN', null, 0); return false;
  }
  for (let k = 0; k < 6; k++) { // landed on top of furniture: pop out to the nearest edge instead of clipping through it
    const h = circleHits(P, false); if (!h || !h.prop) break; const p = h.prop, r = P.r + 1;
    const dl = P.x - (p.x - r), dr = (p.x + p.w + r) - P.x, du = P.y - (p.y - r), dd = (p.y + p.h + r) - P.y, m = Math.min(dl, dr, du, dd), ox = P.x, oy = P.y;
    if (m === dl) P.x = p.x - r; else if (m === dr) P.x = p.x + p.w + r; else if (m === du) P.y = p.y - r; else P.y = p.y + p.h + r;
    const h2 = circleHits(P, false); if (h2 && h2.tile) { P.x = ox; P.y = oy; break; }
  }
  P.rig.land = 1; FX.dust(P.x, P.y, 6); Snd.play('land'); return true;
}

function updatePlayer(dt, rdt) {
  if (!P.alive) { moveCircle(P, P.vx * dt, P.vy * dt, false); const f = Math.exp(-5 * dt); P.vx *= f; P.vy *= f; updateRig(P, dt); return; }
  P.fireCd -= dt; P.iframes -= dt; P.rollBonus -= dt; P.touchT += rdt; P.hurtT -= rdt; P.muzzleT -= rdt; P.bloom = Math.max(0, P.bloom - dt * .6);
  P.swapT = Math.max(0, P.swapT - dt); P.btCd = Math.max(0, P.btCd - rdt); P.reflexCd -= rdt; P.reflexT -= rdt; P.lastStandCd -= rdt; P.lastStandT -= rdt; P.dodgeCd -= rdt;
  P.de.cd -= rdt; P.strikeT = Math.max(0, P.strikeT - dt); P.perfT -= rdt; P.jamT -= rdt;
  const ls = P.lastStandT > 0;
  if (P.state !== 'takedown' && P.de.mode !== 2) P.aim = Math.atan2(G.wmy - P.y, G.wmx - P.x); // aim is always real-time
  let ix = (Input.down('KeyD') ? 1 : 0) - (Input.down('KeyA') ? 1 : 0), iy = (Input.down('KeyS') ? 1 : 0) - (Input.down('KeyW') ? 1 : 0);
  if (ix && iy) { ix *= .7071; iy *= .7071; }
  if (Input.touch && (Input.ax || Input.ay)) { ix = Input.ax; iy = Input.ay; } // analog movement stick
  const shiftHit = Input.hit('ShiftLeft') || Input.hit('ShiftRight'), shiftDown = Input.down('ShiftLeft') || Input.down('ShiftRight');
  const space = Input.hit('Space'), nearWall = P.touchT < .2;
  P.focus = Input.down('KeyC') && P.state === 'run';
  P.focusSlow = P.focus && hasAb('focus') && P.energy > 0 && !G.bt;
  P.stT += dt; const u = P.stT / P.stDur;
  switch (P.state) {
    case 'run': {
      const sp = 215 * (P.focus ? .55 : 1) * (ls ? 1.3 : 1), a = damp(15, dt);
      P.vx = lerp(P.vx, ix * sp, a); P.vy = lerp(P.vy, iy * sp, a);
      if (shiftHit) startSlide(ix, iy); else if (space) startRoll(ix, iy); else if (Input.hit('M2')) startDive(ix, iy); else if (Input.hit('KeyV')) startJump();
      P.groundT -= dt; if (P.groundT <= 0) { P.groundT = .25; P.lastGround.x = P.x; P.lastGround.y = P.y; }
      break;
    }
    case 'slide': {
      if (ix || iy) { const cur = Math.atan2(P.diry, P.dirx), na = cur + clamp(angDiff(cur, Math.atan2(iy, ix)), -2.6 * dt, 2.6 * dt); P.dirx = Math.cos(na); P.diry = Math.sin(na); } // steer around corners
      const sp = P.sp0 * (1 - .62 * u * u); P.vx = P.dirx * sp; P.vy = P.diry * sp;
      P.dustT -= dt; if (P.dustT <= 0) { P.dustT = .03; FX.dust(P.x + P.dirx * 8, P.y + P.diry * 8, 1); }
      if (space) { if (nearWall) wallKick(ix, iy); else startRoll(ix || P.dirx, iy || P.diry); }
      else if (Input.hit('M2')) startDive(ix || P.dirx, iy || P.diry);
      else if (Input.hit('KeyV')) startJump();
      else if (u >= 1) setState('run');
      break;
    }
    case 'roll': {
      const sp = P.sp0 * (1 - .35 * u); P.vx = P.dirx * sp; P.vy = P.diry * sp;
      if (space && nearWall && u > .2) wallKick(ix, iy);
      else if (u >= 1) { P.rollBonus = .6; if (shiftDown) startSlide(ix || P.dirx, iy || P.diry, 380); else setState('run'); }
      break;
    }
    case 'dive': {
      P.z = Math.sin(Math.PI * clamp(u, 0, 1)) * 26; const sp = P.sp0 * (1 - .25 * u); P.vx = P.dirx * sp; P.vy = P.diry * sp;
      if (space && nearWall) wallKick(ix, iy);
      else if (u >= 1 && landCheck()) {
        if (shiftDown) { startSlide(P.dirx, P.diry, 390); Style.bonus(30, 'DIVE SLIDE'); }
        else { setState('land', .3); }
      }
      break;
    }
    case 'land': {
      const f = Math.exp(-7 * dt); P.vx *= f; P.vy *= f;
      if (space) startRoll(ix, iy); else if (shiftHit) startSlide(ix, iy, 380); else if (u >= 1) setState('run');
      break;
    }
    case 'jump': {
      P.z = Math.sin(Math.PI * clamp(u, 0, 1)) * 30; const a = damp(2.5, dt); P.vx = lerp(P.vx, ix * 250, a); P.vy = lerp(P.vy, iy * 250, a);
      if (space && nearWall) wallKick(ix, iy);
      else if (u >= 1 && landCheck()) { if (shiftDown) startSlide(ix, iy, 400); else setState('run'); }
      break;
    }
    case 'takedown': {
      const e = P.tk, a = Math.atan2(e.y - P.y, e.x - P.x), d = dist(P.x, P.y, e.x, e.y); P.aim = a;
      const sp = d > 22 ? 320 : 0; P.vx = Math.cos(a) * sp; P.vy = Math.sin(a) * sp;
      if (u >= .5 && !P.tkDone) {
        P.tkDone = true; Snd.play('takedown'); Cam.addShake(.5); G.hitstop = .08;
        const w = curW(); if (w.mag > 0) { w.mag--; FX.muzzle(e.x - Math.cos(a) * 8, e.y - Math.sin(a) * 8, a); Snd.play(WEAPONS[w.id].snd); G.glows.push({ x: e.x, y: e.y, r: 200, t: .08, max: .08, col: '255,230,170' }); }
        e.hurt(99999, { takedown: true, stealth: !e.wasAlert, dir: a, kx: Math.cos(a) * 380, ky: Math.sin(a) * 380 });
      }
      if (u >= 1) { setState('run'); P.tk = null; }
      break;
    }
  }
  // ---- movement + world interaction ----
  const air = P.z > 8, evasive = P.state === 'slide' || P.state === 'roll' || P.state === 'dive' || P.state === 'jump';
  const hit = moveCircle(P, P.vx * dt, P.vy * dt, air);
  if (hit) {
    if (hit.tile === 2 && evasive) { shatterGlass(hit.tx, hit.ty, P.vx, P.vy, 'p'); Style.bonus(50, 'GLASS CRASH'); }
    else if (hit.door) { openDoor(hit.door, P.x, P.y, evasive); if (evasive) Style.bonus(40, 'BREACH'); }
    else if (hit.prop && P.state === 'slide' && flipDesk(hit.prop, P.dirx, P.diry)) Style.bonus(20, 'TABLE FLIP');
    else { P.touchT = 0; P.touchN.x = hit.nx; P.touchN.y = hit.ny; }
  }
  for (const e of Enemies) {
    if (!e.alive) continue; const d = dist(P.x, P.y, e.x, e.y), rr = P.r + e.r;
    if (d < rr && d > .01) {
      if ((P.state === 'slide' || P.state === 'dive') && e.tackled !== P.tackleId && !e.def.heavy) {
        e.tackled = P.tackleId; e.hurt(12, { tackle: true, dir: Math.atan2(P.diry, P.dirx) }); if (e.alive) e.stagger(1.0, P.dirx * 260, P.diry * 260);
        Style.bonus(40, P.state === 'slide' ? 'SLIDE TACKLE' : 'DIVE TACKLE'); Snd.play('takedown'); Cam.addShake(.25);
      } else if (P.z < 8) { const o = (rr - d) * .5; P.x -= (e.x - P.x) / d * o; P.y -= (e.y - P.y) / d * o; if (circleHits(P, false)) { P.x += (e.x - P.x) / d * o; P.y += (e.y - P.y) / d * o; } }
    }
  }
  // ---- pickups ----
  for (const p of World.pickups) if (!p.dead && dist(P.x, P.y, p.x, p.y) < 28) {
    if (p.type === 'health') { if (P.hp >= P.maxHp) continue; P.hp = Math.min(P.maxHp, P.hp + 35); Style.note('+35 HEALTH', null, 0); }
    else { for (const s of P.slots) { const base = Math.round(WEAPONS[s.id].reserve * (1 + .35 * upg('ammo'))); s.reserve = Math.min(base * 2, s.reserve + Math.ceil(base * .4)); } Style.note('AMMO', null, 0); }
    p.dead = true; Snd.play('pickup');
  }
  // ---- actions ----
  if (P.state !== 'takedown' && P.de.mode === 0) {
    for (let i = 0; i < P.slots.length; i++) if (Input.hit('Digit' + (i + 1))) switchTo(i);
    if (Input.wheel && P.slots.length > 1) switchTo((P.cur + Math.sign(Input.wheel) + P.slots.length) % P.slots.length);
    if (Input.hit('KeyR')) reloadPress();
    if (Input.down('M0')) tryFire();
    if (Input.hit('KeyE')) tryTakedown();
    if (Input.hit('KeyF')) interact();
    if (Input.hit('KeyQ')) toggleBT();
    if (Input.hit('KeyX')) startDeadEye();
  }
  if (P.reloadT > 0) { P.reloadT -= dt * (ls ? 1.5 : 1); if (P.reloadT <= 0) finishReload(); }
  // ---- energy ----
  if (G.bt) { P.energy -= 20 * rdt; if (P.energy <= 0) { P.energy = 0; endBT(); } }
  else if (P.focusSlow) { P.energy = Math.max(0, P.energy - 11 * rdt); P.regenDelay = .8; }
  else { P.regenDelay -= rdt; if (P.regenDelay <= 0) P.energy = Math.min(P.maxE, P.energy + 9 * (1 + .3 * upg('regen')) * rdt); }
  if (DIFF().regen && P.hurtT < -4 && P.hp < P.maxHp * .6) P.hp = Math.min(P.maxHp * .6, P.hp + DIFF().regen * rdt); // catch your breath out of combat
  updateDeadEye(rdt);
  // ---- afterimages ----
  for (const t of P.trail) t.t += rdt; while (P.trail.length && P.trail[0].t > .3) P.trail.shift();
  P.trailT -= rdt;
  updateRig(P, dt);
  if (P.trailT <= 0 && (G.bt || evasive || ls || P.reflexT > 0)) { P.trailT = .04; P.trail.push({ J: cloneJ(P.rig.J), t: 0 }); }
}

/* ---------------- gunplay ---------------- */
function fireShot(ang, opt = {}) {
  const w = curW(), wd = WEAPONS[w.id], n = wd.pellets || 1;
  let side = 2; if (wd.dual) { P.hand ^= 1; side = P.hand ? -4.6 : 4.6; }
  const ca = Math.cos(ang), sa = Math.sin(ang), L = wd.len + 13;
  let mx = P.x + ca * L - sa * side, my = P.y + sa * L + ca * side;
  if (solidCode(tileOf(mx), tileOf(my), true)) { mx = P.x; my = P.y; }
  let sp = wd.spread * (1 + P.bloom * 3);
  const st = P.state, moving = Math.hypot(P.vx, P.vy) > 120;
  sp *= st === 'roll' ? (P.stT / P.stDur > .65 ? 1 : 2.2) : st === 'dive' || st === 'jump' ? 1.15 : st === 'slide' ? 1.05 : moving ? 1.3 : 1;
  if (P.focus) sp *= .35; if (P.rollBonus > 0) sp *= .25; if (opt.deadeye) sp = 0;
  if (wd.flame) { // flamethrower: a stream of short-lived fire projectiles
    for (let i = 0; i < n; i++) spawnBullet({ x: mx, y: my, ang: ang + (Math.random() - .5) * 2 * wd.spread, speed: wd.speed * rand(.8, 1.15), dmg: wd.dmg, owner: 'p', pen: 0, wid: w.id, flame: true, range: wd.range * rand(.8, 1.1) });
    G.stats.shots++; P.rig.recoil = .25; P.muzzleT = .05; Cam.addShake(wd.shake);
    G.glows.push({ x: mx + ca * 40, y: my + sa * 40, r: 210, t: .09, max: .09, col: '255,150,60' });
    Snd.play('flame'); makeNoise(P.x, P.y, wd.noise, 'shot'); return;
  }
  for (let i = 0; i < n; i++) spawnBullet({ x: mx, y: my, ang: ang + (Math.random() - .5) * 2 * sp, speed: wd.speed * rand(.94, 1.06), dmg: wd.dmg * (opt.deadeye ? 1.5 : 1), owner: 'p', pen: wd.pen, wid: w.id, deadeye: opt.deadeye, fire: wd.fire });
  if (wd.fire) FX.sparks(mx, my, ang, 16, '#ff9a3c', .7);
  if (wd.kick && P.state === 'run') { P.vx -= ca * wd.kick; P.vy -= sa * wd.kick; } // the sawed-off shoves you back
  G.stats.shots += n; P.bloom = Math.min(1, P.bloom + wd.spread * 1.5);
  if (wd.dual && P.hand) P.rig.recoil2 = 1; else P.rig.recoil = 1;
  FX.muzzle(mx, my, ang, wd.shake); FX.shell(P.x - sa * side, P.y + ca * side, ang); P.muzzleT = .05;
  G.glows.push({ x: mx, y: my, r: 150 + wd.shake * 200, t: .06, max: .06, col: '255,225,170' });
  Cam.addShake(wd.shake); Cam.kick(ca, sa, wd.shake * 14);
  Snd.play(wd.snd); makeNoise(P.x, P.y, wd.noise, 'shot');
}
function tryFire() {
  const w = curW(), wd = WEAPONS[w.id];
  if (P.fireCd > 0 || P.swapT > 0 || P.reloadT > 0) return;
  if (w.mag <= 0) { if (Input.hit('M0')) Snd.play('empty'); startReload(); return; }
  w.mag--; P.fireCd = wd.rate / (P.lastStandT > 0 ? 1.4 : 1);
  fireShot(P.aim);
}
function startReload() {
  const w = curW(), wd = WEAPONS[w.id];
  if (P.reloadT > 0 || w.mag >= wd.mag || w.reserve <= 0) return;
  P.reloadDur = wd.reload * (1 - .15 * upg('reload')); P.reloadT = P.reloadDur; P.activeUsed = false; Snd.play('reload');
}
function reloadPress() { // active reload: tap R again inside the sweet spot
  if (P.reloadT > 0) {
    if (P.activeUsed) return; P.activeUsed = true; const pr = 1 - P.reloadT / P.reloadDur;
    if (pr > .45 && pr < .63) { finishReload(); Style.bonus(50, 'PERFECT RELOAD'); Snd.play('perfect'); P.perfT = .6; }
    else { P.reloadT += .3; P.reloadDur += .3; P.jamT = .5; Snd.play('deny'); }
  } else startReload();
}
function finishReload() { const w = curW(), n = Math.min(WEAPONS[w.id].mag - w.mag, w.reserve); w.mag += n; w.reserve -= n; P.reloadT = 0; Snd.play('reloadDone'); }
function switchTo(i) { if (i === P.cur || !P.slots[i]) return; P.cur = i; P.weapon = P.slots[i].id; P.swapT = .25; P.reloadT = 0; P.bloom = 0; Snd.play('ui'); }

/* ---------------- bullet time ---------------- */
function toggleBT() {
  if (G.bt) return endBT();
  if (P.energy < 15 || P.btCd > 0) return Snd.play('deny');
  G.bt = true; Snd.play('btOn'); Style.note('BULLET TIME', null, 2); G.shock = { x: P.x, y: P.y, t: 0 }; G.stats.bt++;
  for (const e of Enemies) if (e.alive) e.onBulletTime();
}
function endBT() { if (!G.bt) return; G.bt = false; P.btCd = 2; P.regenDelay = 1.2; Snd.play('btOff'); }

/* ---------------- takedowns / interaction ---------------- */
function tryTakedown() {
  if (P.state === 'dive' || P.state === 'jump') return;
  let e = null, bd = 60; for (const o of Enemies) { if (!o.alive) continue; const d = dist(P.x, P.y, o.x, o.y); if (d < bd && losClear(P.x, P.y, o.x, o.y)) { e = o; bd = d; } }
  if (!e) return;
  const a = Math.atan2(e.y - P.y, e.x - P.x), behind = Math.abs(angDiff(e.aim, a + Math.PI)) > 1.9;
  const fin = e.def.boss ? e.hp <= e.maxHp * .12 : (!e.alert || e.state === 'stagger' || behind || e.hp <= Math.max(60, e.maxHp * .4));
  if (fin) { setState('takedown', .42); P.tk = e; P.tkDone = false; P.strikeDur = .42; P.strikeT = .42; P.iframes = .7; P.z = 0; e.stagger(.7, 0, 0); G.stats.takedowns++; }
  else { P.strikeDur = .25; P.strikeT = .25; e.hurt(35, { melee: true, dir: a }); if (e.alive) e.stagger(.9, Math.cos(a) * 220, Math.sin(a) * 220); Snd.play('takedown'); Cam.addShake(.3); Style.bonus(20, 'MELEE'); }
}
function interact() {
  let bd = 64, door = null; for (const d of World.doors) { if (d.dead) continue; const dd = dist(P.x, P.y, d.tx * TS + 20, d.ty * TS + 20); if (dd < bd) { bd = dd; door = d; } }
  if (door) { if (door.open) { if (bd > 30) { door.open = false; door.swing = 0; Snd.play('door'); } } else openDoor(door, P.x, P.y, false); return; }
  let prop = null; bd = 70; for (const p of World.props) { if (p.dead || p.flipped) continue; const dd = dist(P.x, P.y, p.x + p.w / 2, p.y + p.h / 2); if (dd < bd && (p.type === 'desk' || p.type === 'deskv' || p.type === 'sofa')) { bd = dd; prop = p; } }
  if (prop) { const a = Math.atan2(prop.y + prop.h / 2 - P.y, prop.x + prop.w / 2 - P.x); if (flipDesk(prop, Math.cos(a), Math.sin(a))) Style.note('COVER UP', null, 0); }
}

/* ---------------- DEAD EYE ---------------- */
function startDeadEye() {
  if (!hasAb('deadeye') || P.de.mode !== 0) return;
  if (P.de.cd > 0 || P.energy < 20 || curW().mag <= 0 || P.reloadT > 0) return Snd.play('deny');
  P.de.mode = 1; P.de.t = 0; P.de.marks = []; P.energy -= 20; P.regenDelay = 2; Snd.play('btOn'); Style.note('DEAD EYE', null, 2); G.stats.deadeye++;
}
function updateDeadEye(rdt) {
  const de = P.de;
  if (de.mode === 1) {
    de.t += rdt; const max = Math.min(6, curW().mag);
    for (const e of Enemies) if (e.alive && de.marks.length < max && !de.marks.includes(e) && (dist(G.wmx, G.wmy, e.x, e.y) < 28 || (Input.touch && Math.abs(angDiff(P.aim, Math.atan2(e.y - P.y, e.x - P.x))) < .2)) && losClear(P.x, P.y, e.x, e.y)) { de.marks.push(e); Snd.play('mark'); }
    if (!Input.down('KeyX') || de.t > 3.2) { if (de.marks.length) { de.mode = 2; de.i = 0; de.t = .1; } else { de.mode = 0; de.cd = 2; } }
  } else if (de.mode === 2) {
    de.t -= rdt;
    if (de.t <= 0) {
      while (de.i < de.marks.length && !de.marks[de.i].alive) de.i++;
      const e = de.marks[de.i], w = curW();
      if (!e || w.mag <= 0) { de.mode = 0; de.cd = 18; de.marks = []; return; }
      P.aim = Math.atan2(e.y - P.y, e.x - P.x); w.mag--; fireShot(P.aim, { deadeye: true }); de.i++; de.t = .13;
    }
  }
}

/* ---------------- damage ---------------- */
function hurtPlayer(d, sx, sy) {
  if (!P.alive || P.iframes > 0 || P.state === 'takedown' || G.state !== 'play') return false;
  if (P.lastStandT > 0) d *= .5;
  P.hp -= d; G.stats.dmg += d; Style.onDamage(d); P.hurtT = .6; P.hurtDir = Math.atan2(sy - P.y, sx - P.x);
  P.rig.fx -= Math.cos(P.hurtDir) * 5; P.rig.fy -= Math.sin(P.hurtDir) * 5;
  Cam.addShake(.3 + d * .012); Snd.play('hurt'); FX.blood(P.x, P.y, P.hurtDir + Math.PI, 5, '#e9edf2');
  if (P.hp > 0 && P.hp <= P.maxHp * .25 && hasAb('laststand') && P.lastStandCd <= 0) { P.lastStandT = 6; P.lastStandCd = 60; Style.note('LAST STAND', null, 2); Snd.play('laststand'); }
  if (P.hp <= 0) { P.hp = 0; P.alive = false; P.state = 'dead'; P.z = 0; P.deathDir = P.hurtDir + Math.PI; P.vx = -Math.cos(P.hurtDir) * 160; P.vy = -Math.sin(P.hurtDir) * 160; if (G.bt) endBT(); P.de.mode = 0; G.onPlayerDeath(); }
  return true;
}
