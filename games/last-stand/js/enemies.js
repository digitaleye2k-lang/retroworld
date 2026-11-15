'use strict';
/* ===== enemies: 10 behaviours, damage, deaths, drops ===== */
const TANK = { hp: 420, spd: 60, score: 1500, w: 120, h: 58, col: '#6a5a3a', fire: 2.4, ai: 'tank', robot: true };
function eDef(t) { return t === 'tank' ? TANK : EDEF[t]; }
function spawnEnemy(t, x, y, o) {
  const d = eDef(t), lv = G.li, hpK = DIFF().ehp * (1 + lv * .12);
  const e = Object.assign({ t, d, x: x - d.w / 2, y: y - d.h, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp * hpK, maxHp: d.hp * hpK, face: -1, aim: Math.PI, alive: true, dead: 0, flash: 0, fireT: rnd(.6, 1.4) * d.fire, st: 'idle', stT: 0, ground: false, run: rnd(0, 6), burst: 0, burstT: 0, tele: 0, t: 0, bob: rnd(0, 6), hy: y - 80 - rnd(0, 60), shieldUp: true, rec: 0 }, o || {});
  if (d.fly) { e.y = y - d.h; e.hy = e.y; }
  G.E.push(e); return e;
}
function eCenter(e) { return { x: e.x + e.w / 2, y: e.y + e.h * .4 }; }
function eShoot(e, a, o) {
  o = o || {}; const c = eCenter(e), sx = c.x + Math.cos(a) * (o.off || 22), sy = (o.y != null ? o.y : c.y - 6) + Math.sin(a) * (o.off || 22), sp = o.spd || 420;
  G.B.push(Object.assign({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, own: 'e', dmg: o.dmg || 12, life: o.life || 3, r: o.r || 5, type: o.type || 'orb' }, o.extra || {}));
  FX.muzzle(sx, sy, a, o.col || '#ff8a4a'); Snd.play(o.snd || 'enemyShot', .55); e.rec = 4;
}
function aimAt(e, lead, spread) { const c = eCenter(e), tx = P.x + P.w / 2 + (lead ? P.vx * lead : 0), ty = P.y + (P.crouch ? 18 : 22); return Math.atan2(ty - c.y, tx - c.x) + rnd(-(spread || 0), spread || 0); }
function seesP(e, range) { const c = eCenter(e), dx = P.x + P.w / 2 - c.x; return P.alive && Math.abs(dx) < (range || 560) && Math.abs(P.y - e.y) < 330 && World.lineClear(c.x, c.y - 10, P.x + P.w / 2, P.y + 20); }
function groundAhead(e, dir) { const fx = dir > 0 ? e.x + e.w + 4 : e.x - 4; const fy = e.y + e.h + 6; const t = World.t(Math.floor(fx / TS), Math.floor(fy / TS)); return SOLID[t] || t === 2; }
function enemyUpdate(e, dt) {
  e.t += dt; e.flash = Math.max(0, e.flash - dt); e.rec = Math.max(0, e.rec - dt * 40); e.stT -= dt; const d = e.d;
  if (!e.alive) { e.dead += dt; if (!d.robot) { e.vy += GRAV * dt; World.move(e, dt); e.vx *= .95; } return; }
  const dx = P.x + P.w / 2 - (e.x + e.w / 2), adx = Math.abs(dx), see = seesP(e, d.ai === 'sniper' ? 820 : 600), fk = DIFF().fire;
  if (d.ai !== 'shield' || !e.shieldUp || e.burst > 0) e.face = dx > 0 ? 1 : -1;
  e.fireT -= dt;
  const walk = (sp) => { if (!groundAhead(e, sgn(sp)) && e.ground) { e.vx = 0; return false; } e.vx = sp; e.run += dt * 12 * Math.abs(sp) / 120; return true; };
  switch (d.ai) {
    case 'soldier': {
      if (e.burst > 0) { e.vx = 0; e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = .14; eShoot(e, e.aim + rnd(-.05, .05), { dmg: 10, spd: 470 }); } }
      else if (see && adx < 520 && e.fireT <= 0) { e.aim = aimAt(e, 0, .06); e.burst = rndi(2, 3); e.burstT = .3; e.fireT = d.fire * fk * rnd(.8, 1.3); e.crouchFire = Math.random() < .3; }
      else if (adx > 240 || !see) walk(sgn(dx) * d.spd); else { if (e.stT <= 0) { e.stT = rnd(.6, 1.4); e.wd = Math.random() < .5 ? 0 : -sgn(dx); } walk((e.wd || 0) * d.spd * .6); }
      break;
    }
    case 'heavy': {
      if (e.tele > 0) { e.tele -= dt; e.vx = 0; if (e.tele <= 0) { e.burst = 7; e.burstT = 0; } }
      else if (e.burst > 0) { e.vx = 0; e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = .1; eShoot(e, aimAt(e, 0, .1), { dmg: 9, spd: 470, col: '#ffcc40' }); Cam.add(.8); } }
      else if (see && e.fireT <= 0 && adx < 560) { e.tele = .45; e.fireT = d.fire * fk; Snd.play('alarm', .3); }
      else walk(sgn(dx) * d.spd);
      break;
    }
    case 'sniper': {
      e.vx = 0; if (e.tele > 0) { e.tele -= dt; e.aim = lerp(e.aim, aimAt(e, .12), .08); if (e.tele <= 0) { eShoot(e, e.aim, { dmg: 22, spd: 1150, r: 4, col: '#ff3030', type: 'snipe', snd: 'eLaser' }); e.fireT = d.fire * fk; } }
      else if (see && e.fireT <= 0) { e.tele = 1.0; e.aim = aimAt(e); }
      break;
    }
    case 'rocket': {
      if (e.tele > 0) { e.vx = 0; e.tele -= dt; if (e.tele <= 0) { const a = aimAt(e, 0, .03); eShoot(e, a, { dmg: 20, spd: 300, r: 7, type: 'erocket', life: 4, col: '#ffb060', snd: 'rocket', extra: { splash: 70, home: 1.4 } }); e.fireT = d.fire * fk; } }
      else if (see && e.fireT <= 0 && adx < 640) { e.tele = .7; e.kneel = true; }
      else { e.kneel = false; if (adx > 330) walk(sgn(dx) * d.spd); else e.vx = 0; }
      break;
    }
    case 'drone': {
      const tx = P.x + P.w / 2 - e.w / 2 + Math.sin(e.t * 1.3 + e.bob) * 160, ty = P.y - 170 + Math.sin(e.t * 2.1) * 30;
      e.vx += clamp((tx - e.x) * 2.2 - e.vx, -500 * dt * 3, 500 * dt * 3) * dt * 2; e.vy += ((ty - e.y) * 2.4 - e.vy) * dt * 2.5; e.vx = clamp(e.vx, -d.spd, d.spd);
      e.x += e.vx * dt; e.y += e.vy * dt; e.y = Math.max(e.y, Cam.y + 30);
      if (e.fireT <= 0 && adx < 460) { e.fireT = d.fire * fk; const a = aimAt(e, 0, .05); eShoot(e, a, { dmg: 9, spd: 360, off: 10, y: e.y + 14, col: '#7ad0ff', snd: 'eLaser' }); }
      return;
    }
    case 'turret': {
      e.vx = 0; const want = aimAt(e); e.aim += clamp(Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim)), -2.4 * dt, 2.4 * dt);
      if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = .16; eShoot(e, e.aim, { dmg: 11, spd: 440, off: 26, y: e.y + 10, col: '#ff6a4a' }); } }
      else if (see && e.fireT <= 0) { if (!e.tele) { e.tele = .4; } e.tele -= dt; if (e.tele <= 0) { e.tele = 0; e.burst = 3; e.fireT = d.fire * fk; } }
      return;
    }
    case 'kamikaze': {
      if (adx < 620 && P.alive) { e.armed = true; } if (e.armed) { e.vx += sgn(dx) * 900 * dt; e.vx = clamp(e.vx, -d.spd, d.spd); e.run += dt * 30; if (Math.floor(e.t * 8) % 2 === 0 && e.t % .25 < dt) Snd.play('ui', .3); }
      if (!groundAhead(e, sgn(e.vx)) && e.ground && Math.abs(dx) > 40) e.vy = -520;
      if (ovl(e, P) && P.alive) { pHurt(26, sgn(dx)); eKill(e, 0, 'boom'); return; }
      break;
    }
    case 'shield': {
      if (e.burst > 0) { e.shieldUp = false; e.vx = 0; e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = .18; eShoot(e, aimAt(e, 0, .05), { dmg: 10, spd: 440 }); if (!e.burst) e.lowT = .6; } }
      else if (e.lowT > 0) { e.lowT -= dt; e.vx = 0; }
      else { e.shieldUp = true; e.face = dx > 0 ? 1 : -1; if (see && e.fireT <= 0 && adx < 480) { e.burst = 3; e.burstT = .45; e.fireT = d.fire * fk * rnd(.9, 1.4); } else if (adx > 140) walk(sgn(dx) * d.spd); else e.vx = 0; }
      break;
    }
    case 'commander': {
      if (e.dash > 0) { e.dash -= dt; e.vx = e.face * 520; if (Math.random() < .5) FX.p({ x: e.x + e.w / 2, y: e.y + 30, life: .25, s: 10, s2: 2, c: 'rgba(255,220,80,.4)' }); }
      else if (e.burst > 0) { e.vx = 0; e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = .08; eShoot(e, aimAt(e, .1, .08), { dmg: 11, spd: 520, col: '#ffe060' }); } }
      else if (e.fireT <= 0 && see) { const r = Math.random(); e.fireT = d.fire * fk * rnd(.8, 1.3);
        if (r < .4) { e.burst = 6; e.burstT = .25; } else if (r < .65) { G.EG.push({ x: e.x + e.w / 2, y: e.y + 10, vx: sgn(dx) * clamp(adx * 1.1, 160, 520), vy: -560, t: 0 }); Snd.play('throw'); } else if (r < .85 && e.ground) { e.dash = .35; FX.text(e.x + e.w / 2, e.y - 10, '!', '#ffd84a', 22); } else if (e.ground) { e.vy = -760; } }
      else if (adx > 260) walk(sgn(dx) * d.spd); else if (adx < 120) walk(-sgn(dx) * d.spd); else e.vx = 0;
      break;
    }
    case 'tank': {
      const want = aimAt(e); e.aim += clamp(Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim)), -1.4 * dt, 1.4 * dt); e.aim = clamp(e.aim, -Math.PI, 0);
      if (e.stT <= 0) { e.stT = rnd(1.4, 2.6); e.wd = adx > 360 ? sgn(dx) : -sgn(dx) * (Math.random() < .5 ? 1 : 0); }
      walk((e.wd || 0) * d.spd); e.run += dt * 6;
      if (e.fireT <= 0 && adx < 720) { e.fireT = d.fire * fk; const sp = 560, g2 = 900, rx = dx, flat = Math.abs(rx) / sp; const vy = -(Math.min(520, 220 + Math.abs(rx) * .5)); eShoot(e, Math.atan2(vy, sgn(dx) * sp), { dmg: 22, spd: Math.hypot(sp * .9, vy), r: 7, type: 'shell', col: '#ffd070', snd: 'rocket', off: 40, y: e.y + 4, extra: { grav: 900, splash: 80 } }); Cam.add(4); }
      if (e.t % 2.8 < dt && see) { for (let i = 0; i < 4; i++) setTimeout(() => { if (e.alive && G.state === 'play') eShoot(e, aimAt(e, 0, .08), { dmg: 8, spd: 480, y: e.y + 34, off: 50, col: '#ffe080' }); }, i * 110); }
      break;
    }
  }
  if (!d.fly && !d.static) { e.vy = Math.min(MAXFALL, e.vy + GRAV * dt); const r = World.move(e, dt); e.ground = r.ground; if (e.y > ROWS * TS + 80) { e.alive = false; e.dead = 9; } }
}
function eHurt(e, dmg, dir, src) {
  if (!e.alive) return false;
  if (e.t === 'shield' && e.shieldUp && src !== 'blast' && src !== 'plasma' && dir === -e.face) { e.shieldFlash = .1; Snd.play('clang', .6); FX.spark(e.x + e.w / 2 + e.face * 16, e.y + 26, '#bfe0ff', 4); return 'block'; }
  if (e.d.armor && src !== 'plasma') dmg *= 1 - e.d.armor * (src === 'blast' ? .4 : 1);
  e.hp -= dmg; e.flash = .07; e.vx += dir * Math.min(140, dmg * 6) * (e.d.static || e.t === 'tank' ? 0 : 1);
  if (e.d.robot) FX.spark(e.x + e.w / 2, e.y + e.h * .4, '#ffe0a0', 3); else FX.ink(e.x + e.w / 2, e.y + 20, dir, 2);
  if (e.hp <= 0) { eKill(e, dir, src); return 'kill'; } Snd.play('hit', .4); return 'hit';
}
function eKill(e, dir, src) {
  if (!e.alive) return; e.alive = false; e.dead = 0; const d = e.d, c = eCenter(e);
  P.combo++; P.comboT = 2.6; const mult = 1 + Math.min(4, Math.floor(P.combo / 3)) * .5; const pts = Math.round(d.score * mult); G.score += pts; G.kills++;
  FX.text(c.x, e.y - 8, (P.combo >= 3 ? 'x' + P.combo + ' ' : '') + '+' + pts, P.combo >= 3 ? '#ffd84a' : '#fff', P.combo >= 6 ? 20 : 15);
  P.sp = Math.min(100, P.sp + (e.t === 'commander' || e.t === 'tank' ? 18 : e.t === 'heavy' ? 8 : 3.5));
  if (P.combo === 10) FX.text(P.x + P.w / 2, P.y - 40, 'MASSACRE!', '#ff4a4a', 26);
  if (d.robot || src === 'boom') { FX.explode(c.x, c.y, e.t === 'tank' ? 140 : 60); if (src === 'boom' || e.t === 'kamikaze') areaDamage(c.x, c.y, 70, 18, 'e'); e.dead = 9; Snd.play('robotDie'); }
  else { Snd.play('die', .7); FX.ink(c.x, c.y, dir || 1, 14); e.vy = -380 - (src === 'blast' ? 300 : 0); e.vx = (dir || 1) * (src === 'blast' ? 420 : 200); e.spin = (dir || 1) * rnd(4, 9); FX.hitstop(.02); }
  // drops
  const r = Math.random(); const x = c.x, y = e.y;
  if (e.t === 'commander' || e.t === 'tank') dropWeapon(x, y); else if (r < .05) dropItem('med', x, y); else if (r < .1) dropItem('gren', x, y); else if (r < .14 && e.t !== 'kamikaze') dropWeapon(x, y);
}
function areaDamage(x, y, r, dmg, src) { if (P.alive && dist(x, y, P.x + P.w / 2, P.y + P.h / 2) < r + 14) pHurt(dmg, sgn(P.x + P.w / 2 - x)); }
function drawEnemy(g, e) {
  const d = e.d, cx = e.x + e.w / 2, fy = e.y + e.h; if (!e.alive && (d.robot || e.dead > 1.6)) return;
  g.save(); if (!e.alive) { g.globalAlpha = clamp(1.6 - e.dead, 0, 1); g.translate(cx, fy - 20); g.rotate((e.spin || 2) * Math.min(e.dead, .4)); g.translate(-cx, -(fy - 20)); }
  const fl = e.flash > 0;
  switch (d.ai) {
    case 'drone': { const y = e.y + Math.sin(e.t * 6) * 2; g.fillStyle = fl ? '#fff' : '#2a2e38'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, y + 10, 18, 8, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = fl ? '#fff' : d.col; g.fillRect(cx - 10, y + 2, 20, 6); for (const s of [-1, 1]) { g.fillStyle = '#111'; g.fillRect(cx + s * 16 - 2, y - 2, 4, 8); g.strokeStyle = 'rgba(200,220,255,.5)'; g.lineWidth = 2; g.beginPath(); const w = 14 * Math.abs(Math.sin(e.t * 40 + s)); g.moveTo(cx + s * 16 - w, y - 2); g.lineTo(cx + s * 16 + w, y - 2); g.stroke(); } g.fillStyle = e.fireT < .35 ? '#ff3030' : '#7ad0ff'; g.beginPath(); g.arc(cx + e.face * 6, y + 12, 3.5, 0, TAU); g.fill(); g.globalCompositeOperation = 'lighter'; g.fillStyle = e.fireT < .35 ? 'rgba(255,40,40,.5)' : 'rgba(120,200,255,.35)'; g.beginPath(); g.arc(cx + e.face * 6, y + 12, 9, 0, TAU); g.fill(); break; }
    case 'turret': { g.fillStyle = fl ? '#fff' : '#3a3e4a'; g.strokeStyle = '#000'; g.lineWidth = 3; g.fillRect(e.x, e.y + 14, e.w, 16); g.strokeRect(e.x, e.y + 14, e.w, 16); g.beginPath(); g.arc(cx, e.y + 14, 13, Math.PI, 0); g.fill(); g.stroke(); g.save(); g.translate(cx, e.y + 10); g.rotate(e.aim); g.fillStyle = '#1a1c22'; g.fillRect(0, -4, 28 - e.rec, 8); g.strokeRect(0, -4, 28 - e.rec, 8); g.restore(); g.fillStyle = e.tele > 0 ? '#ff2a2a' : '#ffb020'; g.fillRect(cx - 3, e.y + 18, 6, 4); if (e.tele > 0) { g.strokeStyle = 'rgba(255,40,40,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, e.y + 10); g.lineTo(cx + Math.cos(e.aim) * 400, e.y + 10 + Math.sin(e.aim) * 400); g.stroke(); } break; }
    case 'kamikaze': { const y = e.y; g.fillStyle = fl ? '#fff' : '#2a2a30'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.roundRect ? g.roundRect(e.x, y + 2, e.w, e.h - 10, 5) : g.rect(e.x, y + 2, e.w, e.h - 10); g.fill(); g.stroke(); for (const s of [6, e.w - 6]) { g.fillStyle = '#111'; g.beginPath(); g.arc(e.x + s, fy - 6, 6, 0, TAU); g.fill(); g.strokeStyle = '#555'; g.beginPath(); g.moveTo(e.x + s, fy - 6); g.lineTo(e.x + s + Math.cos(e.run) * 5, fy - 6 + Math.sin(e.run) * 5); g.stroke(); } const bl = e.armed && Math.floor(e.t * 10) % 2 === 0; g.fillStyle = bl ? '#ff2020' : '#6a1010'; g.beginPath(); g.arc(cx, y + 8, 5, 0, TAU); g.fill(); if (bl) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,40,40,.5)'; g.beginPath(); g.arc(cx, y + 8, 14, 0, TAU); g.fill(); } break; }
    case 'tank': { const y = e.y; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, fy, 70, 7, 0, 0, TAU); g.fill(); g.fillStyle = fl ? '#fff' : '#5a5038'; g.strokeStyle = '#000'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(e.x, fy - 14); g.lineTo(e.x + 10, y + 22); g.lineTo(e.x + e.w - 10, y + 22); g.lineTo(e.x + e.w, fy - 14); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#2a2620'; g.fillRect(e.x - 2, fy - 18, e.w + 4, 18); g.strokeRect(e.x - 2, fy - 18, e.w + 4, 18); for (let i = 0; i < 6; i++) { g.fillStyle = '#4a4436'; g.beginPath(); g.arc(e.x + 10 + i * 20, fy - 9, 7, 0, TAU); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.moveTo(e.x + 10 + i * 20, fy - 9); g.lineTo(e.x + 10 + i * 20 + Math.cos(e.run + i) * 6, fy - 9 + Math.sin(e.run + i) * 6); g.stroke(); } g.save(); g.translate(cx, y + 18); g.rotate(e.aim); g.fillStyle = '#3a3428'; g.fillRect(0, -5, 56 - e.rec, 10); g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(0, -5, 56 - e.rec, 10); g.restore(); g.fillStyle = fl ? '#fff' : '#6a6044'; g.beginPath(); g.arc(cx, y + 20, 22, Math.PI, 0); g.fill(); g.stroke(); g.fillStyle = '#c8323c'; g.fillRect(cx - 12, y + 26, 24, 5); const hp = e.hp / e.maxHp; g.fillStyle = '#000'; g.fillRect(cx - 40, y - 10, 80, 6); g.fillStyle = '#ff5a3a'; g.fillRect(cx - 40, y - 10, 80 * hp, 6); break; }
    default: {
      const look = { soldier: { helmet: '#5a2228', visor: '#ff3a3a', armor: '#3a1a1e' }, heavy: { helmet: '#3a2a20', visor: '#ffb020', armor: '#5a4030', s: 1.18 }, sniper: { helmet: '#2a3a20', visor: '#ff2020', glow: 1 }, rocket: { helmet: '#6a4010', visor: '#ffd060', armor: '#4a3010' }, shield: { helmet: '#20305a', visor: '#7ac0ff' }, commander: { helmet: '#d0a020', visor: '#ffffff', armor: '#8a6a10', glow: 1, belt: '#ffd84a' } }[d.ai] || {};
      const wp = { soldier: 'rifle', heavy: 'minigun', sniper: 'laser', rocket: 'rocket', shield: 'rifle', commander: 'rifle' }[d.ai];
      if (e.tele > 0 && d.ai === 'sniper') { const c = eCenter(e); g.strokeStyle = 'rgba(255,30,30,' + (.3 + .5 * (1 - e.tele)) + ')'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c.x, c.y - 6); g.lineTo(c.x + Math.cos(e.aim) * 900, c.y - 6 + Math.sin(e.aim) * 900); g.stroke(); }
      if (e.tele > 0 && d.ai === 'heavy') { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,60,30,.35)'; g.beginPath(); g.arc(cx + e.face * 24, e.y + 24, 18 + Math.random() * 6, 0, TAU); g.fill(); g.restore(); }
      const aim = (e.burst > 0 || e.tele > 0 || e.d.ai === 'sniper' || e.d.ai === 'turret') ? e.aim : (e.face > 0 ? .08 : Math.PI - .08);
      drawStick(g, Object.assign({ x: cx, y: fy, face: e.face, run: e.run, spd: e.alive && e.ground ? Math.abs(e.vx) / 120 : 0, air: !e.ground && e.alive, vy: e.vy, crouch: e.kneel || (e.crouchFire && e.burst > 0), aim, rec: e.rec, wpn: e.alive ? wp : null, body: fl ? '#fff' : '#16141a', hurt: 0, t: e.t, shield: d.ai === 'shield' && e.shieldUp && e.alive, shieldFlash: e.shieldFlash, s: look.s || 1 }, look));
      if (e.shieldFlash > 0) e.shieldFlash -= 1 / 60;
    }
  }
  g.restore();
}
/* ---------- pickups ---------- */
function dropWeapon(x, y) { const pool = ['shotgun', 'laser', 'rocket', 'flame', 'minigun', 'plasma'].filter(w => !(w === 'plasma' && G.li < 1)); G.PK.push({ k: 'weapon', w: pick(pool), x, y, vx: rnd(-60, 60), vy: -360, t: 0, w2: 26, h2: 22 }); }
function dropItem(k, x, y) { G.PK.push({ k, x, y, vx: rnd(-60, 60), vy: -320, t: 0, w2: 22, h2: 20 }); }
