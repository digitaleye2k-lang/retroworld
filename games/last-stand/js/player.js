'use strict';
/* ===== player: movement, aiming, weapons, grenades, special, damage ===== */
const GRAV = 2300, JUMP_V = 800, DJUMP_V = 690, RUN = 290, MAXFALL = 980;
let P = null;
function mkPlayer(x, y) {
  return { x, y, w: 20, h: 54, vx: 0, vy: 0, face: 1, aim: 0, ground: false, coyote: 0, jbuf: 0, jumps: 0, crouch: false, drop: 0,
    hp: 100, maxHp: 100, inv: 0, alive: true, deathT: 0, run: 0, fireT: 0, rec: 0, spin: 0, charge: 0, cur: 'rifle', inv2: { rifle: Infinity },
    gren: 3, sp: 0, spT: 0, t: 0, hurtT: 0, stepT: 0, landT: 0, tile: 0, onIce: false, sinkT: 0, burn: 0, slow: 0, combo: 0, comboT: 0 };
}
function pShoulder() { return { x: P.x + P.w / 2 + P.face * 2, y: P.y + P.h - (P.crouch ? 38 : 50) }; }
function pMuzzle() { const s = pShoulder(), L = WEAPONS[P.cur].len; return { x: s.x + Math.cos(P.aim) * (22 + L * .75), y: s.y + 2 + Math.sin(P.aim) * (22 + L * .75) }; }
function playerUpdate(dt) {
  P.t += dt; P.inv = Math.max(0, P.inv - dt); P.hurtT = Math.max(0, P.hurtT - dt); P.rec = Math.max(0, P.rec - dt * 60); P.fireT -= dt; P.slow = Math.max(0, P.slow - dt);
  P.comboT -= dt; if (P.comboT <= 0) P.combo = 0;
  if (!P.alive) { P.deathT += dt; P.vy += GRAV * dt; World.move(P, dt); P.vx *= .96; return; }
  const L = Input.down('left'), R = Input.down('right'), U = Input.down('up'), D = Input.down('down');
  const liq = World.liquidAt(P), inWater = liq === 7, inSand = liq === 8, inHaz = liq === 6;
  // crouch / drop through
  P.crouch = D && P.ground && !(Input.mouseOn && (L || R));
  const wasCrouch = P.h < 54; const wantH = P.crouch ? 34 : 54;
  if (wantH !== P.h) { if (wantH > P.h) { const test = { x: P.x, y: P.y - (wantH - P.h), w: P.w, h: wantH }; if (!World.solidPx(test.x + 3, test.y + 2) && !World.solidPx(test.x + test.w - 3, test.y + 2)) { P.y -= wantH - P.h; P.h = wantH; } else P.crouch = true; } else { P.y += P.h - wantH; P.h = wantH; } }
  // horizontal
  let mv = (R ? 1 : 0) - (L ? 1 : 0); if (P.crouch) mv = 0;
  let max = RUN * (inWater ? .62 : inSand ? .45 : 1) * (P.slow > 0 ? .55 : 1);
  const acc = P.ground ? (P.onIce ? 900 : 4200) : 2600;
  const target = mv * max; P.vx += clamp(target - P.vx, -acc * dt, acc * dt);
  const belt = P.ground ? (P.tile === 4 ? -95 : P.tile === 5 ? 95 : 0) : 0;
  if (mv) { P.face = mv; P.run += dt * 15 * (Math.abs(P.vx) / RUN); }
  // aim
  const pa = Input.padAim();
  if (Input.mouseOn && !Input.padOn && !Input.touchOn) { const s = pShoulder(); P.aim = Math.atan2(Input.wmy() - s.y, Input.wmx() - s.x); P.face = Math.cos(P.aim) >= 0 ? 1 : -1; }
  else if (pa != null) { P.aim = pa; P.face = Math.cos(pa) >= 0 ? 1 : -1; }
  else { let ax = mv || (U || (D && !P.ground) ? 0 : P.face), ay = (U ? -1 : 0) + (D && !P.ground ? 1 : 0); if (!ax && !ay) ax = P.face; if (U && mv) ax = mv; P.aim = Math.atan2(ay, ax); }
  // jumping (buffer + coyote + double jump + variable height)
  if (Input.hit('jump')) P.jbuf = .13; P.jbuf -= dt; P.coyote -= dt;
  if (P.jbuf > 0) {
    if (D && P.ground && P.tile === 2) { P.drop = .22; P.jbuf = 0; P.y += 2; }
    else if (P.ground || P.coyote > 0) { P.vy = -JUMP_V * (inWater ? .82 : inSand ? .7 : 1); P.ground = false; P.coyote = 0; P.jumps = 1; P.jbuf = 0; Snd.play('jump'); FX.smoke(P.x + P.w / 2, P.y + P.h, 2, 'rgba(200,200,200,.25)'); }
    else if (P.jumps < 2) { P.vy = -DJUMP_V; P.jumps = 2; P.jbuf = 0; Snd.play('djump'); for (let i = 0; i < 8; i++) FX.p({ x: P.x + P.w / 2, y: P.y + P.h, vx: rnd(-160, 160), vy: rnd(20, 120), life: .3, s: 3, s2: 1, c: '#bfe8ff', add: true, drag: 4 }); }
  }
  if (!Input.down('jump') && P.vy < -260) P.vy += GRAV * 1.6 * dt; // short hop when released early
  P.drop = Math.max(0, P.drop - dt);
  P.vy = Math.min(MAXFALL * (inWater || inSand ? .4 : 1), P.vy + GRAV * dt * (inSand ? .3 : 1));
  const ox = P.vx; P.vx += belt; const r = World.move(P, dt); P.vx = (r.wallL || r.wallR) ? 0 : ox;
  const wasG = P.ground; P.ground = r.ground; P.tile = r.tile; P.onIce = r.tile === 3 || r.tile === 9;
  if (P.ground) { P.coyote = .1; P.jumps = 0; if (!wasG && P.vy >= 0) { Snd.play('land', .6); FX.smoke(P.x + P.w / 2, P.y + P.h, 2, 'rgba(200,200,200,.2)'); } World.stepOn(r.gc, r.gr, r.tile); }
  if (P.ground && Math.abs(P.vx) > 60) { P.stepT -= dt; if (P.stepT <= 0) { P.stepT = .26; Snd.play('step', .5); } }
  if (inSand) { P.sinkT += dt; if (P.sinkT > 1.2) { pHurt(9 * dt * 4, 0, true); } } else P.sinkT = 0;
  if (inHaz) { pHurt(20, 0); if (P.alive) P.vy = -720; }
  if (inWater && Math.random() < .2) FX.p({ x: P.x + rnd(0, P.w), y: P.y + P.h - 10, vy: -40, life: .5, s: 2, c: 'rgba(200,240,255,.5)' });
  if (P.y > ROWS * TS + 60) pKill('fall');
  // weapon swap
  if (Input.hit('swap') || Input.wheel) { const own = WORDER.filter(w => P.inv2[w] > 0); const i = own.indexOf(P.cur); P.cur = own[(i + (Input.wheel < 0 ? -1 : 1) + own.length) % own.length]; Input.wheel = 0; P.charge = 0; Snd.play('swap'); FX.text(P.x + P.w / 2, P.y - 14, WEAPONS[P.cur].name, WEAPONS[P.cur].col, 13); }
  // fire
  const Wd = WEAPONS[P.cur], firing = Input.down('fire');
  if (Wd.spin) P.spin += dt * (firing ? 40 : 6);
  if (Wd.charge) { if (firing) { P.charge = Math.min(Wd.charge, P.charge + dt); if (Math.random() < .5) Snd.play('charge', P.charge / Wd.charge); const m = pMuzzle(); FX.p({ x: m.x + rnd(-14, 14), y: m.y + rnd(-14, 14), vx: 0, vy: 0, life: .2, s: 2, c: '#d8a0ff', add: true }); } else if (P.charge > 0) { if (P.fireT <= 0) firePlasma(P.charge / Wd.charge); P.charge = 0; } }
  else if (firing && P.fireT <= 0) fireWeapon();
  // grenade
  if (Input.hit('grenade')) { if (P.gren > 0) { P.gren--; const s = pShoulder(), a = Math.abs(Math.cos(P.aim)) < .3 ? -Math.PI / 2 + P.face * .5 : Math.atan2(Math.min(Math.sin(P.aim), -.35) - .45, Math.cos(P.aim)); G.GR.push({ x: s.x, y: s.y - 4, vx: Math.cos(a) * 520 + P.vx * .4, vy: Math.sin(a) * 520, t: 0, rot: 0 }); Snd.play('throw'); } else Snd.play('empty'); }
  // special: LAST STAND orbital barrage
  if (Input.hit('special')) { if (P.sp >= 100 && !G.special) startSpecial(); else if (P.sp < 100) Snd.play('empty'); }
}
function fireWeapon() {
  const id = P.cur, Wd = WEAPONS[id], m = pMuzzle(), a = P.aim; P.fireT = 1 / Wd.rate; P.rec = Wd.recoil; G.combatT = Math.min(3, (G.combatT || 0) + .3); if (Wd.recoil > 7) Cam.punch(Math.min(.02, Wd.recoil * .0015), 0);
  if (P.inv2[id] !== Infinity) { P.inv2[id]--; if (P.inv2[id] <= 0) { delete P.inv2[id]; P.cur = 'rifle'; FX.text(P.x + P.w / 2, P.y - 18, 'OUT OF AMMO', '#ff6a6a', 13); } }
  const B = (an, sp, o) => G.B.push(Object.assign({ x: m.x, y: m.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, own: 'p', dmg: Wd.dmg, life: 1.2, r: 3, type: id, hit: null, pierce: 0 }, o || {}));
  Snd.play(Wd.snd);
  if (id === 'rifle') { B(a + rnd(-Wd.spread, Wd.spread), Wd.spd); FX.muzzle(m.x, m.y, a); FX.shell(m.x - Math.cos(a) * 20, m.y, P.face); Cam.add(1.2); }
  else if (id === 'shotgun') { for (let i = 0; i < Wd.pellets; i++) B(a + rnd(-Wd.spread, Wd.spread), Wd.spd * rnd(.8, 1.1), { life: Wd.range }); FX.muzzle(m.x, m.y, a, '#ffc070', true); FX.shell(m.x - Math.cos(a) * 18, m.y, P.face, true); Cam.add(7); P.vx -= Math.cos(a) * 120; FX.smoke(m.x, m.y, 3, 'rgba(180,180,180,.3)'); }
  else if (id === 'laser') { B(a, Wd.spd, { pierce: Wd.pierce, hit: new Set(), r: 4, life: .9 }); FX.muzzle(m.x, m.y, a, '#4af0ff'); Cam.add(1.5); }
  else if (id === 'rocket') { B(a, Wd.spd, { r: 6, splash: Wd.splash, life: 2.2, acc: 900 }); FX.muzzle(m.x, m.y, a, '#ffb070', true); FX.smoke(m.x - Math.cos(a) * 40, m.y - Math.sin(a) * 40, 5); Cam.add(6); P.vx -= Math.cos(a) * 80; }
  else if (id === 'flame') { for (let i = 0; i < 2; i++) B(a + rnd(-Wd.spread, Wd.spread), Wd.spd * rnd(.7, 1.1), { life: Wd.life * rnd(.7, 1), r: 9, pierce: 99, hit: new Set(), grow: 1 }); FX.light(m.x, m.y, 120, '#ff7a20', .06); }
  else if (id === 'minigun') { B(a + rnd(-Wd.spread, Wd.spread), Wd.spd); FX.muzzle(m.x, m.y, a, '#fff0a0'); FX.shell(m.x - Math.cos(a) * 24, m.y, P.face); Cam.add(1.6); P.vx -= Math.cos(a) * 14; }
}
function firePlasma(k) {
  k = Math.max(.25, k); const Wd = WEAPONS.plasma, m = pMuzzle(), a = P.aim; P.fireT = 1 / Wd.rate; P.rec = Wd.recoil * k;
  P.inv2.plasma--; if (P.inv2.plasma <= 0) { delete P.inv2.plasma; P.cur = 'rifle'; }
  G.B.push({ x: m.x, y: m.y, vx: Math.cos(a) * Wd.spd, vy: Math.sin(a) * Wd.spd, own: 'p', dmg: Wd.dmg + 150 * k * k, life: 1.6, r: 8 + 18 * k, type: 'plasma', pierce: k > .9 ? 99 : 3, hit: new Set(), splash: 60 + 70 * k, k });
  Snd.play('plasma', .6 + k * .5); FX.muzzle(m.x, m.y, a, '#d08aff', true); Cam.add(4 + 10 * k); FX.hitstop(.02 + .04 * k); P.vx -= Math.cos(a) * 260 * k;
}
function startSpecial() { P.sp = 0; G.special = { t: 0, n: 0 }; P.inv = 2.4; Snd.play('special'); FX.flash(.6, '#ffe0a0'); Cam.add(10); FX.text(P.x + P.w / 2, P.y - 30, 'LAST STAND!', '#ffd84a', 30); RWB.ach('special'); }
function pHurt(d, dir, silent) {
  if (!P.alive || P.inv > 0 || G.special) return; d *= DIFF().dmg * (.8 + G.li * .08); P.hp -= d; G.combatT = Math.min(3, (G.combatT || 0) + 1.5); if (!silent) { Cam.punch(.022, (Math.random() < .5 ? -1 : 1) * .02); Cam.ca = Math.max(Cam.ca, .7); P.inv = 1.0; P.hurtT = .18; Snd.play('hurt'); Cam.add(8); FX.flash(.25, '#ff2030'); FX.ink(P.x + P.w / 2, P.y + 20, dir || -P.face, 6, '#7a0a14'); FX.hitstop(.05); P.vx += (dir || -P.face) * 220; P.vy = Math.min(P.vy, -240); }
  G.noHit = false; if (P.hp <= 0) pKill('hp');
}
function pKill(why) {
  if (!P.alive) return; P.alive = false; P.hp = 0; P.deathT = 0; P.deathFall = why === 'fall'; P.vy = why === 'fall' ? 0 : -560; P.vx = -P.face * 200; Snd.play('die'); Cam.add(14); FX.flash(.5, '#ff2030');
  if (why !== 'fall') FX.ink(P.x + P.w / 2, P.y + 20, -P.face, 18, '#7a0a14'); G.deaths++;
}
function drawPlayer(g) {
  if (!P.alive && P.deathT > 1.2) return; const blink = P.inv > 0 && !G.special && Math.floor(P.t * 20) % 2 === 0; if (blink) g.globalAlpha = .45;
  const o = { x: P.x + P.w / 2, y: P.y + P.h, face: P.face, run: P.run, spd: P.ground ? Math.abs(P.vx) / RUN : 0, air: !P.ground, vy: P.vy, crouch: P.crouch, aim: P.aim, rec: P.rec, wpn: P.cur, body: '#07070b', band: '#ff2a3a', pack: true, belt: '#c8a040', hurt: P.hurtT, t: P.t, spin: P.spin, s: 1 };
  if (!P.alive) { g.save(); g.translate(o.x, o.y - 20); g.rotate(-P.face * Math.min(1.5, P.deathT * 4)); g.translate(-o.x, -(o.y - 20)); drawStick(g, Object.assign(o, { wpn: null, air: true, aim: P.face > 0 ? 0 : Math.PI })); g.restore(); g.globalAlpha = 1; return; }
  if (G.special) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(o.x, o.y - 30, 4, o.x, o.y - 30, 70); gr.addColorStop(0, 'rgba(255,220,120,.5)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.fillRect(o.x - 70, o.y - 100, 140, 140); g.restore(); }
  drawStick(g, o);
  if (P.charge > 0) { const m = pMuzzle(), k = P.charge / WEAPONS.plasma.charge; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(200,120,255,.8)'; g.beginPath(); g.arc(m.x, m.y, 4 + 12 * k + Math.random() * 3, 0, TAU); g.fill(); g.restore(); }
  g.globalAlpha = 1;
}
