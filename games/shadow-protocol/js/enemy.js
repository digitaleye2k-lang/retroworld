'use strict';
/* ===== SHADOW PROTOCOL :: enemy AI =====
   modes: patrol → investigate → combat ⇄ cover / flee → search → patrol
   Squad logic: alerted enemies take evenly spaced slots around the player (surround),
   push harder when they outnumber, duck into cover when suppressed or reloading. */
const Enemies = []; let EID = 0;
function walkClear(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0); if (d > 420) return false; if (d < 1) return true; const n = Math.ceil(d / 10), sx = (x1 - x0) / n, sy = (y1 - y0) / n, ox = -(y1 - y0) / d * 10, oy = (x1 - x0) / d * 10;
  for (let i = 1; i <= n; i++) for (let s = -1; s <= 1; s += 2) { // two parallel feelers so bodies do not snag on corners
    const tx = tileOf(x0 + sx * i + ox * s), ty = tileOf(y0 + sy * i + oy * s); if (!inMap(tx, ty) || !walkT(tIdx(tx, ty)) || solidCode(tx, ty, false)) return false; }
  return true;
}
function findCover(e) {
  const tx0 = tileOf(e.x), ty0 = tileOf(e.y); let best = null, bs = 1e9;
  for (let oy = -6; oy <= 6; oy++) for (let ox = -6; ox <= 6; ox++) {
    const tx = tx0 + ox, ty = ty0 + oy; if (!inMap(tx, ty) || !walkT(tIdx(tx, ty))) continue;
    const cx = tx * TS + 20, cy = ty * TS + 20, dp = dist(cx, cy, P.x, P.y); if (dp < 130) continue;
    if (shotClear(cx, cy, P.x, P.y)) continue;
    const s = dist(cx, cy, e.x, e.y) + Math.abs(dp - 260) * .3; if (s < bs) { bs = s; best = { x: cx, y: cy }; }
  }
  return best;
}
class Enemy {
  constructor(type, x, y, o = {}) {
    const d = ENEMY[type];
    Object.assign(this, {
      id: EID++, type, def: d, x, y, vx: 0, vy: 0, aim: o.face || 0, r: d.r || 11, scale: d.scale || 1, z: 0, hp: Math.round(d.hp * DIFF().hp), maxHp: Math.round(d.hp * DIFF().hp), alive: true,
      state: 'run', stT: 0, stDur: 1, mode: o.hunt ? 'combat' : 'patrol', alert: !!o.hunt, wasAlert: !!o.hunt, aware: 0, gun: d.gun, rig: makeRig(), lowered: !o.hunt,
      patrol: o.patrol || null, pi: 0, waitT: rand(1, 3), homeAim: o.face || 0, path: null, pathT: 0, pgx: 0, pgy: 0, goal: null, thinkT: rand(.3), seeT: rand(.1),
      canSee: false, lastSeen: { x: P.x, y: P.y }, lostT: o.hunt ? 1 : 0, mag: d.mag, reloadT: 0, reloadDur: d.reload, fireT: rand(.2, .6), burst: 0, reactT: 0, aimT: 0,
      staggerT: 0, coverT: 0, coverCd: 0, supp: 0, confT: 0, dodgeCd: rand(1, 3), inv: null, invT: 0, lookT: 0, calloutT: -1, strikeT: 0, strikeDur: 1, swapT: 0,
      deathDir: 0, deadT: 0, burnT: 0, burnAcc: 0, burnFx: 0, panicT: 0, spreadT: 0, charred: false, tackled: -1, bark: '', barkT: 0, fleeT: 0, fleeFrom: null, searchT: 0, ddx: 0, ddy: 0, hitT: 0, remove: false, dP: 999
    });
  }
  say(s) { this.bark = s; this.barkT = 1.1; }
  alertTo(x, y, direct) {
    this.lastSeen.x = x; this.lastSeen.y = y;
    if (this.alert) return;
    this.alert = true; this.wasAlert = true; this.mode = 'combat'; this.lowered = false; this.reactT = this.def.react * DIFF().react * (direct ? 1 : .6); this.calloutT = .6;
    this.lostT = direct ? 0 : 1; this.thinkT = 0; this.say('!'); Snd.play('alert');
  }
  hear(x, y, kind) {
    if (this.alert) { if (!this.canSee && (kind === 'shot' || kind === 'boom')) { this.lastSeen.x = x; this.lastSeen.y = y; this.lostT = Math.min(this.lostT, 2.5); } return; }
    if (this.mode === 'flee') return;
    this.mode = 'investigate'; this.inv = { x, y }; this.invT = 0; this.lookT = 0; this.lowered = false; this.path = null; this.say('?');
  }
  ignite(t) { // set alight: burn damage over time, panic, and the fire can jump to anyone too close
    if (!this.alive) return;
    if (this.burnT <= 0) { Snd.play('ignite'); this.say('!!'); if (!this.def.heavy) this.panicT = 1.4; if (!this.alert) this.alertTo(P.x, P.y, false); G.stats.ignited = (G.stats.ignited || 0) + 1; }
    this.burnT = Math.max(this.burnT, t);
  }
  suppressed() { this.supp = Math.min(2, this.supp + .5); if (!this.alert) this.alertTo(P.x, P.y, false); }
  confuse(t) { this.confT = Math.max(this.confT, t); this.say('?'); }
  onBulletTime() { // enemies notice the world slowing down around the player
    if (!this.alert || !this.canSee) return;
    if (this.def.dodge && this.dodgeCd <= 0) this.startDodge();
    else if (this.def.iq >= 3) { this.supp = 1.5; this.thinkT = 0; this.coverCd = 0; }
    else if (!this.def.heavy) { this.reactT = Math.max(this.reactT, .3); this.confT = Math.max(this.confT, .22); this.say('!?'); }
  }
  onExplosion(x, y) {
    if (this.def.heavy) return this.alertTo(P.x, P.y, false);
    if (!this.alert) { this.alert = true; this.wasAlert = true; this.lowered = false; this.lastSeen.x = x; this.lastSeen.y = y; this.lostT = 3; this.calloutT = .8; }
    this.mode = 'flee'; this.fleeT = .75; this.fleeFrom = { x, y }; this.say('!!'); this.burst = 0;
  }
  tryEvade(b) {
    if (this.state === 'dodge') return Math.random() < .75;
    if (this.def.dodge && this.alert && this.dodgeCd <= 0 && this.state === 'run' && Math.random() < .4) { this.startDodge(); return true; }
    return false;
  }
  startDodge() {
    const a = Math.atan2(P.y - this.y, P.x - this.x), s = Math.random() < .5 ? 1 : -1;
    let dx = -Math.sin(a) * s, dy = Math.cos(a) * s;
    if (solidCode(tileOf(this.x + dx * 60), tileOf(this.y + dy * 60), false)) { dx = -dx; dy = -dy; }
    this.ddx = dx; this.ddy = dy; this.state = 'dodge'; this.stT = 0; this.stDur = .36; this.dodgeCd = rand(2.5, 4.5);
  }
  stagger(t, kx, ky) { if (!this.alive) return; if (this.def.heavy) t *= .3; this.state = 'stagger'; this.staggerT = Math.max(this.staggerT, t); this.vx += kx; this.vy += ky; this.burst = 0; this.aimT = 0; }
  hurt(dmg, info = {}) {
    if (!this.alive) return;
    this.hp -= dmg; this.hitT = 1.5; const dir = info.dir ?? this.aim + Math.PI;
    this.rig.fx += Math.cos(dir) * 5; this.rig.fy += Math.sin(dir) * 5;
    if (!info.burn) { FX.blood(this.x, this.y, dir, info.head ? 12 : 6); Snd.play(info.head ? 'head' : 'hit'); }
    if (dmg < 9000 && !info.quiet) FX.text(this.x, this.y - 18, Math.round(dmg), info.head ? '#ffd23d' : '#fff', info.head);
    if (this.hp <= 0) return this.die(info, dir);
    if (info.burn) return;
    if (!this.def.heavy && (dmg > 24 || info.head) && this.state !== 'dodge') this.stagger(.16 + Math.min(.4, dmg * .004), info.kx || 0, info.ky || 0);
    if (!this.alert) this.alertTo(P.x, P.y, false);
    this.supp = Math.min(2, this.supp + .7);
  }
  die(info, dir) {
    this.alive = false; this.state = 'dead'; this.deathDir = dir; this.vx += info.kx || Math.cos(dir) * 120; this.vy += info.ky || Math.sin(dir) * 120;
    Snd.play('kill'); if (info.head || info.takedown) G.hitstop = Math.max(G.hitstop, .045); Cam.addShake(info.head ? .22 : .12);
    if (this.burnT > 0 || info.burn) { info.burn = true; this.charred = true; for (let i = 0; i < 10; i++) FX.add({ type: 'fire', x: this.x + rand(-8, 8), y: this.y + rand(-8, 8), vx: rand(-40, 40), vy: rand(-40, 40), t: 0, max: rand(.4, .9), size: rand(6, 14), drag: 2 }); const sd = World.dx; sd.fillStyle = 'rgba(0,0,0,.5)'; sd.beginPath(); sd.arc(this.x, this.y, 20, 0, TAU); sd.fill(); }
    else FX.blood(this.x, this.y, dir, 14);
    const d = World.dx; d.fillStyle = 'rgba(120,8,18,.55)'; d.beginPath(); d.ellipse(this.x + Math.cos(dir) * 14, this.y + Math.sin(dir) * 14, rand(9, 15), rand(6, 10), dir, 0, TAU); d.fill();
    const q = Math.random(); if (q < .5) World.pickups.push({ x: this.x, y: this.y, type: 'ammo', t: 0 }); else if (q < .66) World.pickups.push({ x: this.x, y: this.y, type: 'health', t: 0 });
    Style.kill(this, info);
  }
  moveTo(gx, gy, speed, dt) {
    let tx = gx, ty = gy; this.pathT -= dt;
    if (!walkClear(this.x, this.y, gx, gy)) {
      if (!this.path || this.pathT <= 0 || dist(this.pgx, this.pgy, gx, gy) > 60) { this.path = findPath(this.x, this.y, gx, gy); this.pathT = rand(.5, .9); this.pgx = gx; this.pgy = gy; }
      const p = this.path;
      if (p && p.length) {
        while (p.length > 1 && dist(this.x, this.y, p[0].x, p[0].y) < 17) p.shift();
        tx = p[0].x; ty = p[0].y;
        const dr = World.doorAt[tIdx(tileOf(tx), tileOf(ty))]; if (dr && !dr.open && !dr.dead && dist(this.x, this.y, tx, ty) < 52) openDoor(dr, this.x, this.y, false);
      }
    } else this.path = null;
    const a = Math.atan2(ty - this.y, tx - this.x), k = damp(10, dt);
    this.vx = lerp(this.vx, Math.cos(a) * speed, k); this.vy = lerp(this.vy, Math.sin(a) * speed, k);
    return a;
  }
  think() {
    const d = this.def, allies = Enemies.filter(o => o.alive && o.alert), n = allies.length, idx = allies.indexOf(this), aggressive = n >= 3;
    this.aggr = aggressive;
    if (this.lostT > 2.5) { this.goal = { x: this.lastSeen.x, y: this.lastSeen.y }; return; }
    if (d.cover > 0 && this.coverCd <= 0 && (this.reloadT > 0 || this.supp > .5 || this.hp < this.maxHp * .4) && Math.random() < d.cover * (aggressive ? .6 : 1)) {
      const c = findCover(this); if (c) { this.mode = 'cover'; this.goal = c; this.coverT = rand(1.4, 2.8) * (aggressive ? .6 : 1); return; }
    }
    const dp = this.dP; let pref = d.pref * (aggressive && !d.sniper ? .72 : 1);
    if (d.sniper && this.canSee && dp > 260) { this.goal = null; return; }
    const mine = Math.atan2(this.y - P.y, this.x - P.x);
    let ang = n >= 3 ? Math.atan2(allies[0].y - P.y, allies[0].x - P.x) + idx * TAU / n : mine + (d.flank ? (this.id % 2 ? 1 : -1) * .9 : rand(-.4, .4));
    for (const r of [pref, pref * .7, pref * 1.35, pref * .45]) {
      const gx = P.x + Math.cos(ang) * r, gy = P.y + Math.sin(ang) * r, tx = tileOf(gx), ty = tileOf(gy);
      if (inMap(tx, ty) && walkT(tIdx(tx, ty)) && losClear(gx, gy, P.x, P.y)) { this.goal = { x: gx, y: gy }; return; }
    }
    this.goal = this.canSee && dp < d.range * .8 ? null : { x: P.x, y: P.y };
  }
  fire() {
    const d = this.def, evasive = P.state === 'slide' || P.state === 'dive' || P.state === 'roll' || P.state === 'jump';
    const sp = d.spread * DIFF().spread * (evasive ? 2.4 : 1) * (G.bt ? 1.35 : 1) * (G.plight < .25 ? 1.4 : 1), n = d.pellets || 1;
    const mx = this.x + Math.cos(this.aim) * (d.gun.len + 12) * this.scale, my = this.y + Math.sin(this.aim) * (d.gun.len + 12) * this.scale;
    for (let i = 0; i < n; i++) spawnBullet({ x: mx, y: my, ang: this.aim + (Math.random() - .5) * 2 * sp, speed: d.bspeed * DIFF().bspeed * rand(.95, 1.05), dmg: d.dmg * DIFF().dmg, owner: 'e', src: this });
    this.mag--; this.rig.recoil = 1; if (d.gun.dual && this.mag % 2) { this.rig.recoil = 0; this.rig.recoil2 = 1; }
    FX.muzzle(mx, my, this.aim, d.sniper ? .5 : .12); G.glows.push({ x: mx, y: my, r: 130, t: .06, max: .06, col: '255,190,150' });
    Snd.play(d.sniper ? 'sniper' : d.pellets ? 'shotgun' : 'eshot');
  }
  update(dt) {
    if (!this.alive) {
      this.deadT += dt; moveCircle(this, this.vx * dt, this.vy * dt, false); const f = Math.exp(-5 * dt); this.vx *= f; this.vy *= f; updateRig(this, dt);
      if (this.deadT > 1.3) { // bake the body into the floor — persists for the mission
        const d = World.dx; d.globalAlpha = .8; drawRig(d, this, this.charred ? { limb: '#0b0a0a', head: '#141111', gun: '#111', accent: '#0b0a0a' } : { limb: '#3a1218', head: '#571a22', gun: '#222', accent: '#3a1218' }); d.globalAlpha = 1;
        d.strokeStyle = '#2b2e33'; d.lineWidth = 3; const a = this.rig.seed; d.beginPath(); d.moveTo(this.x + Math.cos(a) * 16, this.y + Math.sin(a) * 16); d.lineTo(this.x + Math.cos(a) * 16 + Math.cos(a * 3) * this.def.gun.len, this.y + Math.sin(a) * 16 + Math.sin(a * 3) * this.def.gun.len); d.stroke();
        this.remove = true;
      }
      return;
    }
    const d = this.def; this.barkT -= dt; this.hitT -= dt; this.confT -= dt; this.reactT -= dt; this.coverCd -= dt; this.dodgeCd -= dt; this.supp = Math.max(0, this.supp - dt * .6);
    const dp = this.dP = dist(this.x, this.y, P.x, P.y), toP = Math.atan2(P.y - this.y, P.x - this.x);
    // ---- perception: sight depends on light, FOV and line of sight ----
    this.seeT -= dt;
    if (this.seeT <= 0) {
      this.seeT = .1; let vis = d.vis; if (!this.alert) vis *= lerp(.38, 1, G.plight) * (P.state === 'slide' ? .8 : 1); else vis *= lerp(.7, 1, G.plight);
      this.canSee = P.alive && dp < vis && (this.alert || dp < 46 || Math.abs(angDiff(this.aim, toP)) < d.fov / 2) && losClear(this.x, this.y, P.x, P.y);
    }
    if (this.canSee) { this.lastSeen.x = P.x; this.lastSeen.y = P.y; this.lostT = 0; if (!this.alert) { this.aware += dt / (d.react * DIFF().react * (.7 + dp / 350)); if (this.aware >= 1) this.alertTo(P.x, P.y, true); } }
    else { this.lostT += dt; this.aware = Math.max(0, this.aware - dt * .35); }
    if (this.calloutT > 0) { this.calloutT -= dt; if (this.calloutT <= 0) for (const o of Enemies) if (o.alive && !o.alert && dist(this.x, this.y, o.x, o.y) < 420) o.alertTo(this.lastSeen.x, this.lastSeen.y, false); } // radio the squad
    if (this.burnT > 0) { // on fire
      this.burnT -= dt; this.burnAcc += 17 * dt; this.burnFx -= dt; this.spreadT -= dt;
      if (this.burnFx <= 0) { this.burnFx = .045; FX.add({ type: 'fire', x: this.x + rand(-7, 7), y: this.y + rand(-7, 7), vx: this.vx * .4 + rand(-25, 25), vy: this.vy * .4 + rand(-25, 25), t: 0, max: rand(.2, .45), size: rand(5, 10) * this.scale, drag: 2 }); if (Math.random() < .3) G.glows.push({ x: this.x, y: this.y, r: 150, t: .14, max: .14, col: '255,140,50' }); }
      if (this.spreadT <= 0) { this.spreadT = .25; for (const o of Enemies) if (o !== this && o.alive && o.burnT <= 0 && dist(this.x, this.y, o.x, o.y) < 32) o.ignite(2.2); }
      if (this.burnAcc >= 5) { const a = this.burnAcc; this.burnAcc = 0; FX.text(this.x + rand(-6, 6), this.y - 18, Math.round(a), '#ff9a3c'); this.hurt(a, { burn: true, quiet: true }); if (!this.alive) return; }
    }
    if (this.panicT > 0 && this.state === 'run') { // flailing around while burning: no shooting
      this.panicT -= dt; const a = Math.sin(G.time * 5 + this.id * 2.3) * 2.6 + this.id, k = damp(9, dt);
      this.vx = lerp(this.vx, Math.cos(a) * d.speed * 1.4, k); this.vy = lerp(this.vy, Math.sin(a) * d.speed * 1.4, k); this.aim += dt * 9; this.burst = 0; this.aimT = 0; this.finish(dt); return;
    }
    // ---- hard states ----
    if (this.state === 'stagger') { this.staggerT -= dt; const f = Math.exp(-6 * dt); this.vx *= f; this.vy *= f; if (this.staggerT <= 0) this.state = 'run'; this.finish(dt); return; }
    if (this.state === 'dodge') { this.stT += dt; this.vx = this.ddx * 330; this.vy = this.ddy * 330; if (this.stT >= this.stDur) this.state = 'run'; this.finish(dt); return; }
    const limp = this.hp < this.maxHp * .3 ? .7 : 1; let wantAim = null, moving = false;
    switch (this.mode) {
      case 'patrol': {
        this.lowered = true;
        if (this.patrol) {
          const g = this.patrol[this.pi % this.patrol.length];
          if (dist(this.x, this.y, g.x, g.y) < 22) { this.waitT -= dt; this.vx *= .8; this.vy *= .8; wantAim = this.homeAim + Math.sin(G.time * .8 + this.id) * 1.1; if (this.waitT <= 0) { this.pi++; this.waitT = rand(1.5, 3.5); } }
          else { wantAim = this.moveTo(g.x, g.y, 62, dt); moving = true; }
        } else { this.vx *= .8; this.vy *= .8; wantAim = this.homeAim + Math.sin(G.time * .5 + this.id * 1.7) * .9; }
        break;
      }
      case 'investigate': {
        this.invT += dt;
        if (dist(this.x, this.y, this.inv.x, this.inv.y) > 34 && this.invT < 9) { wantAim = this.moveTo(this.inv.x, this.inv.y, 118, dt); moving = true; }
        else { this.vx *= .8; this.vy *= .8; this.lookT += dt; this.aim += Math.sin(this.lookT * 2.2) * 2.4 * dt; if (this.lookT > 2.6) { this.mode = 'patrol'; this.homeAim = this.aim; if (!this.patrol) this.patrol = null; } }
        break;
      }
      case 'flee': {
        this.fleeT -= dt; const a = Math.atan2(this.y - this.fleeFrom.y, this.x - this.fleeFrom.x), k = damp(10, dt);
        this.vx = lerp(this.vx, Math.cos(a) * d.speed * 1.35, k); this.vy = lerp(this.vy, Math.sin(a) * d.speed * 1.35, k); wantAim = a + Math.PI;
        if (this.fleeT <= 0) { this.mode = 'combat'; this.thinkT = 0; }
        break;
      }
      case 'search': {
        this.searchT += dt; this.thinkT -= dt;
        if (this.thinkT <= 0 || !this.goal) { this.thinkT = rand(2.5, 4); const a = Math.random() * TAU, r = rand(60, 240); this.goal = { x: this.lastSeen.x + Math.cos(a) * r, y: this.lastSeen.y + Math.sin(a) * r }; }
        if (dist(this.x, this.y, this.goal.x, this.goal.y) > 26) { wantAim = this.moveTo(this.goal.x, this.goal.y, 100 * limp, dt); moving = true; } else { this.vx *= .8; this.vy *= .8; this.aim += dt * 1.5; }
        if (this.canSee) { this.mode = 'combat'; this.thinkT = 0; }
        else if (this.searchT > 14) { this.mode = 'patrol'; this.alert = false; this.aware = 0; this.homeAim = this.aim; this.say('...'); }
        break;
      }
      case 'cover': {
        const arrived = dist(this.x, this.y, this.goal.x, this.goal.y) < 20;
        if (!arrived) { this.moveTo(this.goal.x, this.goal.y, d.speed * 1.15 * limp, dt); moving = true; } else { this.vx *= .7; this.vy *= .7; this.coverT -= dt; }
        wantAim = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
        if ((arrived && this.coverT <= 0 && this.reloadT <= 0) || (arrived && this.canSee && dp < 220)) { this.mode = 'combat'; this.thinkT = 0; this.coverCd = rand(2.5, 4); }
        this.gunLogic(dt, toP, dp, d.iq >= 3);
        break;
      }
      case 'combat': {
        this.lowered = false; this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = rand(.6, 1.1); this.think(); }
        if (this.mode !== 'combat') break;
        if (this.lostT > 9) { this.mode = 'search'; this.searchT = 0; this.thinkT = 0; this.say('?'); break; }
        if (this.goal && dist(this.x, this.y, this.goal.x, this.goal.y) > 20) { const a = this.moveTo(this.goal.x, this.goal.y, d.speed * limp * (this.aggr ? 1.1 : 1), dt); moving = true; if (!this.canSee && this.lostT > .8) wantAim = a; }
        else { const k = damp(8, dt); this.vx = lerp(this.vx, -Math.sin(toP) * Math.sin(G.time * 1.3 + this.id) * 40, k); this.vy = lerp(this.vy, Math.cos(toP) * Math.sin(G.time * 1.3 + this.id) * 40, k); }
        if (wantAim === null) { const lead = dp / d.bspeed * (d.iq >= 3 ? .85 : .45); wantAim = this.canSee ? Math.atan2(P.y + P.vy * lead - this.y, P.x + P.vx * lead - this.x) : Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x); }
        this.gunLogic(dt, toP, dp, true);
        break;
      }
    }
    if (wantAim !== null) this.aim += clamp(angDiff(this.aim, wantAim), -d.turn * dt, d.turn * dt);
    this.finish(dt);
  }
  gunLogic(dt, toP, dp, mayShoot) {
    const d = this.def;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.mag = d.mag; return; }
    if (this.mag <= 0) { this.reloadT = this.reloadDur = d.reload; this.thinkT = Math.min(this.thinkT, .1); return; }
    if (!mayShoot || !this.canSee || this.reactT > 0 || this.confT > 0 || dp > d.range) { this.aimT = Math.max(0, this.aimT - dt * 2); return; }
    const aligned = Math.abs(angDiff(this.aim, toP)) < (d.sniper ? .12 : .3);
    if (d.sniper) { this.aimT += dt; if (this.aimT >= 1.25 && aligned) { this.fire(); this.aimT = 0; } return; } // laser telegraphs the shot
    this.fireT -= dt;
    if (this.fireT <= 0 && aligned) { this.fire(); if (++this.burst >= d.burst) { this.burst = 0; this.fireT = d.pause * DIFF().pause * rand(.7, 1.3) * (this.aggr ? .7 : 1); } else this.fireT = d.rate; }
  }
  finish(dt) {
    for (const o of Enemies) { if (o === this || !o.alive) continue; const dx = this.x - o.x, dy = this.y - o.y, dd = dx * dx + dy * dy, rr = this.r + o.r + 4; if (dd < rr * rr && dd > .01) { const l = Math.sqrt(dd); this.vx += dx / l * 840 * dt; this.vy += dy / l * 840 * dt; } }
    const hit = moveCircle(this, this.vx * dt, this.vy * dt, false);
    if (hit && hit.door) openDoor(hit.door, this.x, this.y, false);
    updateRig(this, dt);
  }
}
function spawnEnemy(type, x, y, o) { const e = new Enemy(type, x, y, o); Enemies.push(e); return e; }
