// Armoured warfare: the player's tank HAMMER-1, enemy tanks (incl. the MAMMOTH boss) and MG bunkers.
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { segRect, lineOfSight } from '../systems/Combat.js';
import { vmeta, turretGeom } from '../render/VehicleArt.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clampAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// shared tank visuals: hull + rotating turret in a container. Uses the illustrated sprite (opts.art)
// split into hull/turret frames; falls back to the procedural drawing.
class TankBody {
  constructor(scene, x, groundY, opts) {
    this.scene = scene; this.s = opts.scale || 0.85; this.facing = opts.facing || 1;
    this.c = scene.add.container(x, groundY).setDepth(opts.depth || DEPTH.vehicles);
    const m = opts.art && vmeta(scene, opts.art);
    if (m && m.cut !== undefined) {
      const g = this.geom = turretGeom(m, opts.width || 360);
      this.hull = scene.add.image(0, 0, opts.art, 'hull').setOrigin(0.5, 1).setScale(g.k);
      // turret = container at the trunnion holding the static turret body and the elevating barrel
      this.turret = scene.add.container(g.trunnion.x, g.trunnion.y);
      this.turretBody = scene.add.image(g.turretPos.x - g.trunnion.x, g.turretPos.y - g.trunnion.y, opts.art, 'turret').setOrigin(0, 0).setScale(g.k);
      this.gun = scene.add.image(0, 0, opts.art, 'barrel').setOrigin(0, g.barrelOriginY).setScale(g.k);
      this.turret.add([this.gun, this.turretBody]);
      this.pivot = g.trunnion; this.barrel = g.barrel; this.barrelAng = 0;
      this.treads = null;
      this.c.add([this.hull, this.turret]);
    } else {
      this.hull = scene.add.image(0, 0, 'tank_hull').setOrigin(0.5, 1);
      this.turret = scene.add.image(-10, -66, 'tank_turret').setOrigin(0.3, 0.53);
      this.pivot = { x: -10, y: -66 }; this.barrel = 158; this.barrelAng = 0;
      this.treads = scene.add.graphics();
      this.c.add([this.hull, this.turret, this.treads]);
    }
    this.baseTint = opts.tint;
    if (opts.tint) this.setTint(opts.tint);
    this.c.setScale(this.s * this.facing, this.s);
    this.tread = 0; this.recoil = 0; this.turretAng = 0;
  }
  // local turret angle (0 = forward); returns world muzzle
  muzzle() {
    const s = this.s, f = this.facing, a = this.turretAng - this.recoil * 0.05;
    const px = this.c.x + this.pivot.x * s * f, py = this.c.y + this.pivot.y * s;
    const la = a + this.barrelAng;
    const wa = f === 1 ? la : Math.PI - la;
    return { x: px + Math.cos(wa) * this.barrel * s, y: py + Math.sin(wa) * this.barrel * s, a: f === 1 ? a : Math.PI - a, px, py };
  }
  draw(dt, vx) {
    this.tread += vx * dt * 0.08 * this.facing;
    this.recoil = Math.max(0, this.recoil - dt * 4);
    if (this.gun) { this.gun.setRotation(this.turretAng).setX(-this.recoil * 10); this.turretBody.setRotation(this.turretAng * 0.08); }
    else this.turret.setRotation(this.turretAng).setX(this.pivot.x - this.recoil * 10);
    if (!this.treads) { this.hull.y = Math.abs(vx) > 20 ? Math.sin(this.tread * 3) * 0.6 : 0; return; }
    const g = this.treads; g.clear(); g.fillStyle(0x3a474a, 1);
    for (let i = 0; i < 16; i++) { const x = -150 + ((i * 19 + this.tread * 19) % 304 + 304) % 304; g.fillRect(x, -6, 6, 3); g.fillRect(x, -42, 6, 3); }
  }
  setTint(c) { for (const o of [this.hull, this.turretBody, this.gun, this.gun ? null : this.turret]) if (o) o.setTint(c); }
  setFacing(f) { this.facing = f; this.c.setScale(this.s * f, this.s); }
  destroy() { this.c.destroy(); }
}

export class PlayerTank {
  constructor(scene, x, groundY) {
    this.scene = scene; this.groundY = groundY; this.team = 'player'; this.alive = true; this.isTank = true;
    this.maxHp = this.hp = 900;
    this.vis = new TankBody(scene, x, groundY, { scale: 0.85, depth: DEPTH.vehicles + 2, art: 'v_abrams' });
    this.zone = scene.add.zone(x, groundY - 35, 240, 66);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body; this.body.setCollideWorldBounds(true); this.body.setMaxVelocity(400, 1200);
    scene.physics.add.collider(this.zone, scene.solidGroup, null, (a, b) => b.solid && b.solid.ground && !b.solid.dead);
    this.cannonCd = 0; this.mgCd = 0; this.heat = 0; this.overheated = false; this.aim = 0;
    this.engine = AudioEngine.loopSample('ptank', 'engine', 0.25) || AudioEngine.loop('ptank', 'engine', 0.2);
    scene.targets.push(this);
    this.clickQ = false;
    scene.input.on('pointerdown', (p) => { if (p.button === 0) this.clickQ = true; });
    // weapon stations: 1 cannon, 2 wire-guided ATGM, 3 rocket salvo (RMB is always the coax MG)
    this.weapon = 0; this.WEAPONS = ['120mm CANNON', 'ATGM (GUIDED)', 'ROCKET SALVO'];
    this.atgm = 6; this.atgmMax = 6; this.atgmCd = 0; this.atgmRegen = 0;
    this.salvo = 3; this.salvoMax = 3; this.salvoCd = 0; this.salvoRegen = 0;
    const kb = scene.input.keyboard;
    this.wKeys = kb.addKeys('ONE,TWO,THREE');
    scene.input.on('wheel', (p, o, dx, dy) => { if (!scene.cinematic && this.alive) this.selectWeapon((this.weapon + (dy > 0 ? 1 : 2)) % 3); });
    // the guidance point follows the mouse cursor
    const tank = this;
    this.guide = { alive: true, get x() { const pt = scene.input.activePointer; return scene.cameras.main.getWorldPoint(pt.x, pt.y).x; }, get y() { const pt = scene.input.activePointer; return scene.cameras.main.getWorldPoint(pt.x, pt.y).y; } };
  }
  selectWeapon(i) {
    if (i === this.weapon) return; this.weapon = i;
    this.scene.hud.notify(this.WEAPONS[i], '#ffd27a'); AudioEngine.play('switch', { gap: 60 });
  }
  ammoText() {
    if (this.weapon === 0) return this.cannonCd > 0 ? 'LOAD' : 'READY';
    if (this.weapon === 1) return this.atgm + '/' + this.atgmMax;
    return this.salvo + '/' + this.salvoMax;
  }
  refill() { this.atgm = this.atgmMax; this.salvo = this.salvoMax; }
  get x() { return this.body.center.x; }
  get y() { return this.body.bottom; }
  center() { return { x: this.x, y: this.y - 40 }; }
  hitTest(x1, y1, x2, y2) {
    if (!this.alive) return null;
    const t = segRect(x1, y1, x2, y2, { x: this.x - 130, y: this.y - 95, w: 260, h: 95 });
    return t >= 0 ? { t, part: 'body', material: 'metal' } : null;
  }
  takeDamage(d, info = {}) {
    if (!this.alive || this.scene.cinematic) return false;
    const diff = this.scene.player.diff.dmgTaken;
    this.hp -= d * (info.explosive ? 0.55 : 0.12) * (0.5 + diff * 0.5);
    this.scene.hud.damage(info); AudioEngine.play('hitmetal', { gap: 60 });
    this.scene.fx.shake(120, info.explosive ? 0.008 : 0.002);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.scene.tankDestroyed(); }
    return false;
  }
  update(dt) {
    const sc = this.scene; const k = sc.player.keys; const v = this.vis;
    const locked = sc.cinematic || !this.alive;
    let mx = 0; if (!locked) { if (k.A.isDown) mx -= 1; if (k.D.isDown) mx += 1; }
    const target = mx * 175;
    this.body.setVelocityX(this.body.velocity.x + (target - this.body.velocity.x) * Math.min(1, dt * 2.2));
    if (mx !== 0 && Math.sign(mx) !== v.facing && Math.abs(this.body.velocity.x) < 40) v.setFacing(mx);
    v.c.setPosition(this.x, this.y + Math.sin(sc.time.now / 90) * (Math.abs(this.body.velocity.x) > 20 ? 0.8 : 0));
    // turret follows the mouse within its traverse
    const ptr = sc.input.activePointer; const wp = sc.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const m0 = v.muzzle();
    let want = Math.atan2(wp.y - m0.py, wp.x - m0.px);
    let local = clampAng(v.facing === 1 ? want : Math.PI - want);
    local = Math.max(-0.7, Math.min(0.22, local));
    v.turretAng += clampAng(local - v.turretAng) * Math.min(1, dt * 5);
    v.draw(dt, this.body.velocity.x);
    // weapons
    this.cannonCd -= dt; this.mgCd -= dt;
    this.heat = Math.max(0, this.heat - dt * (this.overheated ? 0.3 : 0.45)); if (this.overheated && this.heat < 0.25) this.overheated = false;
    if (!locked) { const wk = this.wKeys; if (Phaser.Input.Keyboard.JustDown(wk.ONE)) this.selectWeapon(0); if (Phaser.Input.Keyboard.JustDown(wk.TWO)) this.selectWeapon(1); if (Phaser.Input.Keyboard.JustDown(wk.THREE)) this.selectWeapon(2); }
    this.atgmCd -= dt; this.salvoCd -= dt;
    if (this.atgm < this.atgmMax && (this.atgmRegen += dt) > 9) { this.atgmRegen = 0; this.atgm++; }
    if (this.salvo < this.salvoMax && (this.salvoRegen += dt) > 16) { this.salvoRegen = 0; this.salvo++; }
    const fireMain = !locked && (ptr.leftButtonDown() || this.clickQ); this.clickQ = false;
    if (fireMain) {
      if (this.weapon === 0 && this.cannonCd <= 0) this.fireCannon();
      else if (this.weapon === 1 && this.atgmCd <= 0) { if (this.atgm > 0) this.fireATGM(); else this.dry(); }
      else if (this.weapon === 2 && this.salvoCd <= 0) { if (this.salvo > 0) this.fireSalvo(); else this.dry(); }
    }
    if (!locked && ptr.rightButtonDown() && this.mgCd <= 0 && !this.overheated) this.fireMG();
    // dust from the tracks, smoke when damaged
    if (Math.abs(this.body.velocity.x) > 60 && Math.random() < dt * 14) sc.fx.burst('dust', this.x - v.facing * 110, this.y - 4, 1, 180 + (v.facing > 0 ? 0 : 180), 50, 20, 60);
    if (this.hp < this.maxHp * 0.45 && Math.random() < dt * 8) sc.fx.burst('smoke', this.x - v.facing * 40, this.y - 80, 1, -90, 40, 20, 60);
    if (this.engine) { this.engine.setVol(0.18 + Math.min(0.25, Math.abs(this.body.velocity.x) / 600)); if (this.engine.setRate) this.engine.setRate(0.85 + Math.abs(this.body.velocity.x) / 500); }
  }
  fireCannon() {
    const sc = this.scene; const m = this.vis.muzzle();
    this.cannonCd = 1.5; this.vis.recoil = 1;
    sc.combat.shell({ x: m.x, y: m.y, angle: m.a, speed: 1500, team: 'player', damage: 380, radius: 160, gravity: 140, owner: this });
    sc.fx.muzzle(m.x, m.y, m.a, 2.6); sc.fx.burst('smoke', m.x, m.y, 10, m.a * 57.3, 70, 60, 260);
    sc.fx.burst('dust', this.x, this.y - 2, 8, -90, 180, 40, 160);
    AudioEngine.play('cannon', { gap: 100 }); sc.fx.shake(260, 0.012);
    this.body.setVelocityX(this.body.velocity.x - Math.cos(m.a) * 60);
    sc.stats.shots++;
  }
  dry() { this.atgmCd = this.salvoCd = 0.4; AudioEngine.play('dry', { gap: 200 }); this.scene.hud.notify('NO AMMO - REARMING', '#ff4a3a'); }
  fireATGM() {
    const sc = this.scene; const m = this.vis.muzzle();
    this.atgm--; this.atgmCd = 1.1; this.vis.recoil = 0.4;
    // launched from the turret-side rail, then flies to wherever the cursor is
    const ox = m.px + Math.cos(m.a) * 40, oy = m.py - 26;
    sc.combat.rocket({ x: ox, y: oy, angle: m.a - 0.12, speed: 380, accel: 1100, maxSpeed: 1250, team: 'player', damage: 520, radius: 150, homing: this.guide, turn: 4.2, life: 5, owner: sc.player, scale: 1.2 });
    sc.fx.burst('smoke', ox, oy, 8, m.a * 57.3 + 180, 50, 40, 160); sc.fx.muzzle(ox, oy, m.a, 0.9, 0xffb060);
    sc.stats.shots++;
  }
  fireSalvo() {
    const sc = this.scene; const m = this.vis.muzzle(); const f = this.vis.facing;
    this.salvo--; this.salvoCd = 1.8;
    const wp = this.guide; const tx = wp.x;
    for (let i = 0; i < 6; i++) sc.time.delayedCall(i * 110, () => {
      if (!this.alive) return;
      const ox = this.x - f * 30, oy = this.y - 110;
      // lob toward the cursor with a little scatter
      const dist = Math.max(250, Math.abs(tx - ox)); const g = 900; const ang = f > 0 ? -0.95 : Math.PI + 0.95;
      const sp = Math.sqrt(dist * g / Math.sin(2 * 0.95)) * rand(0.92, 1.08);
      sc.combat.rocket({ x: ox, y: oy, angle: ang + rand(-0.05, 0.05), speed: sp, gravity: g, team: 'player', damage: 220, radius: 130, life: 6, owner: sc.player, scale: 0.8 });
      sc.fx.burst('smoke', ox, oy, 4, ang * 57.3 + 180, 40, 30, 120);
    });
    sc.fx.shake(300, 0.008); sc.stats.shots += 6;
  }
  fireMG() {
    const sc = this.scene; const m = this.vis.muzzle();
    this.mgCd = 0.085; this.heat += 0.03; if (this.heat >= 1) { this.overheated = true; this.heat = 1; sc.hud.notify('COAX OVERHEATED', '#ff4a3a'); }
    const ox = m.px + Math.cos(m.a) * 60, oy = m.py + Math.sin(m.a) * 60 + 6;
    sc.combat.fire({ x: ox, y: oy, angle: m.a + rand(-0.025, 0.025), speed: 2400, damage: 24, team: 'player', range: 1500, color: 0xffd27a, penetration: 2, knock: 200, weapon: 'turret', owner: sc.player });
    sc.fx.muzzle(ox, oy, m.a, 0.7); AudioEngine.play('doorgun', { gap: 40 }); sc.stats.shots++;
  }
  destroy() { this.vis.destroy(); if (this.engine) this.engine.stop(); }
}

// Enemy main battle tank (and the MAMMOTH when opts.boss)
export class EnemyTank {
  constructor(scene, x, groundY, opts = {}) {
    this.scene = scene; this.groundY = groundY; this.team = 'enemy'; this.alive = true; this.isVehicle = true;
    this.boss = !!opts.boss;
    this.maxHp = this.hp = opts.hp || 1400; this.name = opts.name || 'T-80K TANK';
    const art = opts.art || (this.boss ? 'v_k2' : 'v_t14'); const hasArt = !!vmeta(scene, art);
    this.vis = new TankBody(scene, x, groundY, { scale: opts.scale || 0.85, facing: -1, art, tint: hasArt ? (this.boss ? 0x9a8a8a : opts.tint) : (opts.tint || 0x7a5a52), depth: DEPTH.vehicles });
    this.x = x; this.vx = 0; this.stopX = opts.stopX; this.minDist = opts.minDist || 650;
    this.fireT = rand(2.5, 4); this.mgT = 1.5; this.charge = 0; this.hitFlash = 0;
    this.engine = AudioEngine.loopSample('et' + Math.random(), 'engine', 0);
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: this.groundY - 45 * this.vis.s / 0.85 }; }
  hitTest(x1, y1, x2, y2) {
    if (!this.alive) return null; const s = this.vis.s / 0.85;
    const t = segRect(x1, y1, x2, y2, { x: this.x - 135 * s, y: this.groundY - 100 * s, w: 270 * s, h: 100 * s });
    return t >= 0 ? { t, part: 'body', material: 'metal' } : null;
  }
  takeDamage(d, info = {}) {
    if (!this.alive) return false;
    this.hp -= d * (info.explosive ? 1 : info.weapon === 'turret' ? 0.08 : 0.05); this.hitFlash = 1;
    if (this.boss && this.onHurt) this.onHurt(this.hp / this.maxHp);
    if (this.hp <= 0) { this.hp = 0; this.kill(); return true; }
    return false;
  }
  kill() {
    this.alive = false; const sc = this.scene; const c = this.center();
    sc.fx.explosion(c.x, c.y, { radius: this.boss ? 360 : 240, damage: 150, owner: 'world', big: true });
    sc.time.delayedCall(260, () => sc.fx.explosion(c.x + rand(-80, 80), c.y - 30, { radius: 160 }));
    // turret is blown off
    const v0 = this.vis; const t = v0.turret; const tk = t.scaleY;
    const wx = this.x + v0.pivot.x * v0.s * v0.facing, wy = this.groundY + v0.pivot.y * v0.s;
    v0.c.remove(t); sc.add.existing(t); t.setPosition(wx, wy).setScale(v0.s * v0.facing * tk, v0.s * tk).setDepth(DEPTH.fx);
    sc.fx.debris.push({ img: t, vx: rand(-120, 120), vy: -560, va: rand(-4, 4), life: 12, bounce: 0.2, half: 20, fade: false, rest: false });
    this.vis.setTint(0x2a2220);
    this.fire = sc.fx.fireSource(c.x, this.groundY - 30, this.boss ? 2 : 1.3, 0);
    if (this.engine) this.engine.stop();
    if (this.onDestroyed) this.onDestroyed(this);
    if (sc.onVehicleDestroyed) sc.onVehicleDestroyed(this);
  }
  update(dt) {
    const sc = this.scene; const v = this.vis;
    v.draw(dt, this.vx);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 8);
    if (!this.alive) { this.vx *= 0.9; return; }
    if (this.hitFlash > 0.5) v.hull.setTint(0xff9a7a); else if (v.baseTint) v.hull.setTint(v.baseTint); else v.hull.clearTint();
    const p = sc.playerTank || sc.player; if (!p) return;
    const px = p.x, py = p.y; const dist = Math.abs(px - this.x);
    const tx = this.stopX !== undefined ? Math.max(this.stopX, px + this.minDist) : px + this.minDist;
    const want = Math.abs(tx - this.x) < 20 || sc.cinematic ? 0 : Math.sign(tx - this.x) * (this.boss ? 45 : 70);
    this.vx += (want - this.vx) * Math.min(1, dt * 1.2); this.x += this.vx * dt;
    v.c.setPosition(this.x, this.groundY);
    // aim turret
    const m0 = v.muzzle();
    const wa = Math.atan2(py - 50 - m0.py, px - m0.px);
    let local = clampAng(v.facing === 1 ? wa : Math.PI - wa); local = Math.max(-0.5, Math.min(0.25, local));
    v.turretAng += clampAng(local - v.turretAng) * Math.min(1, dt * 1.6);
    if (this.engine) { const cam = sc.cameras.main; this.engine.setVol(Math.max(0, 1 - Math.abs(this.x - cam.midPoint.x) / 1600) * 0.3); }
    if (sc.cinematic || dist > 1500) return;
    const see = lineOfSight(sc.solids, m0.px, m0.py, px, py - 40);
    this.fireT -= dt;
    if (this.fireT < 1.1 && this.fireT > 0) { const m = v.muzzle(); if (Math.random() < dt * 12) sc.fx.burst('spark', m.x, m.y, 1, m.a * 57.3, 30, 30, 90); if (sc.lighting) sc.lighting.flash(m.x, m.y, 80, 0.8, 40); }
    if (this.fireT <= 0) {
      this.fireT = this.boss ? rand(2.2, 3.2) : rand(3.4, 4.8);
      if (see) {
        const shots = this.boss ? 2 : 1;
        for (let i = 0; i < shots; i++) sc.time.delayedCall(i * 260, () => {
          if (!this.alive) return; const m = v.muzzle();
          sc.combat.shell({ x: m.x, y: m.y, angle: m.a + rand(-0.03, 0.03), speed: 1200, team: 'enemy', damage: this.boss ? 110 : 80, radius: 140, gravity: 120, owner: this });
          sc.fx.muzzle(m.x, m.y, m.a, 2.4); sc.fx.burst('smoke', m.x, m.y, 8, m.a * 57.3, 60, 40, 200);
          AudioEngine.play('cannon', { x: this.x, gap: 80 }); v.recoil = 1;
        });
      }
    }
    this.mgT -= dt;
    if (this.mgT <= 0 && see && dist < 1100) {
      this.mgBurst = (this.mgBurst || 0) + 1; const m = v.muzzle();
      sc.combat.fire({ x: m.px + Math.cos(m.a) * 60, y: m.py + Math.sin(m.a) * 60, angle: m.a + rand(-0.06, 0.06), speed: 1500, damage: 8, team: 'enemy', range: 1200, color: 0xff8a5c, owner: this });
      AudioEngine.play('erifle', { x: this.x, vol: 0.5, gap: 40 });
      if (this.mgBurst > 8) { this.mgBurst = 0; this.mgT = rand(1.5, 2.5); } else this.mgT = 0.1;
    }
  }
  destroy() { this.vis.destroy(); if (this.engine) this.engine.stop(); if (this.fire) this.scene.fx.stopFire(this.fire); }
}

// Concrete MG bunker: only explosives really hurt it
export class Bunker {
  constructor(scene, x, groundY, opts = {}) {
    this.scene = scene; this.x = x; this.groundY = groundY; this.team = 'enemy'; this.alive = true; this.isVehicle = true;
    this.maxHp = this.hp = opts.hp || 700;
    this.img = scene.add.image(x, groundY, 'bunker').setOrigin(0.5, 1).setDepth(DEPTH.solids - 1).setFlipX(true);
    this.fireT = rand(1, 2.5); this.burst = 0;
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: this.groundY - 55 }; }
  hitTest(x1, y1, x2, y2) { if (!this.alive) return null; const t = segRect(x1, y1, x2, y2, { x: this.x - 95, y: this.groundY - 100, w: 190, h: 100 }); return t >= 0 ? { t, part: 'body', material: 'concrete' } : null; }
  takeDamage(d, info = {}) {
    if (!this.alive) return false;
    this.hp -= d * (info.explosive ? 1 : 0.1);
    if (this.hp <= 0) {
      this.alive = false; this.img.setTint(0x333333).setScale(1, 0.6);
      this.scene.fx.explosion(this.x, this.groundY - 50, { radius: 220, big: true });
      this.scene.fx.chunk(this.x, this.groundY - 60, -90, 20, 520);
      this.scene.fx.fireSource(this.x, this.groundY, 0.9, 0);
      if (this.onDestroyed) this.onDestroyed(this);
      return true;
    }
    return false;
  }
  update(dt) {
    if (!this.alive || this.scene.cinematic) return;
    const p = this.scene.playerTank || this.scene.player; if (!p) return;
    if (Math.abs(p.x - this.x) > 1200) return;
    this.fireT -= dt;
    if (this.fireT <= 0) {
      if (this.burst <= 0) this.burst = 12;
      const mx = this.x - 60, my = this.groundY - 66;
      const ang = Math.atan2(p.y - 50 - my, p.x - mx) + rand(-0.06, 0.06);
      this.scene.combat.fire({ x: mx, y: my, angle: ang, speed: 1500, damage: 9, team: 'enemy', range: 1300, color: 0xff8a5c, owner: this });
      this.scene.fx.muzzle(mx, my, ang, 1); AudioEngine.play('erifle', { x: this.x, gap: 40 });
      this.burst--; this.fireT = this.burst > 0 ? 0.09 : rand(1.4, 2.4);
    }
  }
  destroy() { this.img.destroy(); }
}
