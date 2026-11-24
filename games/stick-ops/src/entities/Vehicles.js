// Ground vehicles (enemy APC, technical truck, allied tank) and player-usable mounted guns.
import { DEPTH, FONT } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { segRect, lineOfSight } from '../systems/Combat.js';
import { drawFigure, STYLES } from '../render/StickFigure.js';
import { vmeta, turretGeom } from '../render/VehicleArt.js';

const rand = (a, b) => a + Math.random() * (b - a);

class GroundVehicle {
  constructor(scene, x, groundY, key, opts) {
    this.scene = scene; this.x = x; this.groundY = groundY; this.key = key;
    this.team = opts.team || 'enemy'; this.isVehicle = true;
    this.maxHp = this.hp = opts.hp || 1000;
    this.facing = opts.facing || -1;
    this.alive = true; this.vx = 0; this.time = 0;
    this.c = scene.add.container(x, groundY).setDepth(DEPTH.vehicles);
    this.wheels = [];
    const art = opts.art && vmeta(scene, opts.art);
    if (art) {
      // illustrated sprite (wheels are part of the drawing)
      const k = opts.artW / art.w; this.art = opts.art; this.artMeta = art; this.artK = k;
      this.artGeom = art.cut !== undefined && opts.split ? turretGeom(art, opts.artW) : null;
      this.bodyY = 0;
      this.bodyImg = scene.add.image(0, 0, opts.art, this.artGeom ? 'hull' : undefined).setOrigin(0.5, 1).setScale(k);
      this.c.add(this.bodyImg);
      this.w = art.w * k; this.h = art.h * k;
    } else {
      this.bodyY = opts.bodyY || -12;
      this.bodyImg = scene.add.image(0, this.bodyY, key).setOrigin(0.5, 1);
      this.c.add(this.bodyImg);
      for (const wx of opts.wheels || []) { const w = scene.add.image(wx, -20, 'wheel').setScale(opts.wheelScale || 1); this.wheels.push(w); this.c.add(w); }
      this.w = this.bodyImg.width; this.h = this.bodyImg.height;
    }
    this.c.setScale(this.facing, 1);
    this.hitFlash = 0;
    const vid = 'veh' + Math.random();
    this.engine = AudioEngine.loopSample(vid, 'engine', 0) || AudioEngine.loop(vid, 'engine', 0);
    if (this.team === 'enemy') scene.targets.push(this);
    if (opts.name) this.name = opts.name;
  }

  center() { return { x: this.x, y: this.groundY - this.h * 0.45 }; }
  hitTest(x1, y1, x2, y2) {
    if (!this.alive) return null;
    const t = segRect(x1, y1, x2, y2, { x: this.x - this.w * 0.45, y: this.groundY - this.h + 10, w: this.w * 0.9, h: this.h - 14 });
    return t >= 0 ? { t, part: 'body', material: 'metal' } : null;
  }
  armorMod(info) { return info.explosive ? 1 : 0.12; }
  takeDamage(dmg, info = {}) {
    if (!this.alive) return false;
    this.hp -= dmg * this.armorMod(info); this.hitFlash = 1;
    if (this.hp <= 0) { this.hp = 0; this.destroyVehicle(); return true; }
    return false;
  }
  destroyVehicle() {
    this.alive = false;
    const scene = this.scene;
    const c = this.center();
    scene.fx.explosion(c.x, c.y, { radius: 240, damage: 120, owner: 'world' });
    scene.time.delayedCall(220, () => scene.fx.explosion(c.x + rand(-60, 60), c.y - 20, { radius: 140 }));
    this.bodyImg.setTint(0x2a2220);
    for (const w of this.wheels) w.setTint(0x333333);
    if (this.turret) this.turret.setTint(0x2a2220);
    if (this.turretBody) this.turretBody.setTint(0x2a2220);
    this.fire = scene.fx.fireSource(c.x, this.groundY - this.h * 0.6, 1.3, 0);
    if (this.engine) this.engine.stop();
    scene.fx.chunk(c.x, c.y, -90, 14, 600);
    if (this.onDestroyed) this.onDestroyed(this);
    if (scene.onVehicleDestroyed) scene.onVehicleDestroyed(this);
  }
  driveToward(tx, speed, dt) {
    const dx = tx - this.x;
    const want = Math.abs(dx) < 12 ? 0 : Math.sign(dx) * speed;
    this.vx += (want - this.vx) * Math.min(1, dt * 1.5);
  }
  baseUpdate(dt) {
    this.time += dt;
    this.x += this.vx * dt;
    this.c.x = this.x;
    for (const w of this.wheels) w.rotation += (this.vx * this.facing / 20) * dt;
    this.bodyImg.y = this.bodyY + (Math.abs(this.vx) > 5 ? Math.sin(this.time * 18) * 0.8 : 0);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 8);
    if (this.alive) { if (this.hitFlash > 0.5) this.bodyImg.setTint(0xff9a7a); else this.bodyImg.clearTint(); }
    if (this.engine) { const cam = this.scene.cameras.main; const d = Math.abs(this.x - cam.midPoint.x); this.engine.setVol(this.alive ? Math.max(0, 1 - d / 1800) * (0.25 + Math.min(0.3, Math.abs(this.vx) / 300)) : 0); }
  }
  destroy() { this.c.destroy(); if (this.engine) this.engine.stop(); if (this.fire) this.scene.fx.stopFire(this.fire); }
}

export class APC extends GroundVehicle {
  constructor(scene, x, groundY, opts = {}) {
    super(scene, x, groundY, 'apc', Object.assign({ hp: 1500, wheels: [-95, -40, 15, 70], name: 'BTR-K ARMOUR', art: 'v_lav', artW: 300, split: true }, opts));
    const g = this.artGeom;
    if (g) {
      this.turretBody = scene.add.image(g.turretPos.x, g.turretPos.y, this.art, 'turret').setOrigin(0, 0).setScale(g.k);
      this.c.add(this.turretBody);
      this.turret = scene.add.image(g.trunnion.x, g.trunnion.y, this.art, 'barrel').setOrigin(0, g.barrelOriginY).setScale(g.k);
      this.tb = { x: g.trunnion.x, y: g.trunnion.y, len: g.barrel };
    } else {
      this.turret = scene.add.image(20, -86, 'apc_turret').setOrigin(0.2, 0.55);
      this.tb = { x: 20, y: -86, len: 120 };
    }
    this.c.add(this.turret);
    this.turretAng = 0; this.fireT = 3; this.mgT = 1.2; this.charge = 0;
    this.stopX = opts.stopX; this.minDist = opts.minDist || 420;
  }
  muzzle() {
    const a = this.worldTurretAngle(); const base = { x: this.x + this.tb.x * this.facing, y: this.groundY + this.tb.y };
    return { x: base.x + Math.cos(a) * this.tb.len, y: base.y + Math.sin(a) * this.tb.len, a };
  }
  worldTurretAngle() { return this.facing === 1 ? this.turretAng : Math.PI - this.turretAng; }
  update(dt) {
    this.baseUpdate(dt);
    if (!this.alive) { this.vx *= 0.95; return; }
    const p = this.scene.player; if (!p || !p.alive) return;
    const dist = Math.abs(p.x - this.x);
    this.driveToward(this.stopX !== undefined ? this.stopX : (dist > this.minDist ? p.x + (p.x > this.x ? -this.minDist : this.minDist) : this.x), 90, dt);
    // turret aim (local space)
    const base = { x: this.x + this.tb.x * this.facing, y: this.groundY + this.tb.y };
    const wa = Math.atan2(p.y - 40 - base.y, p.x - base.x);
    let la = this.facing === 1 ? wa : Math.PI - wa; while (la > Math.PI) la -= 2 * Math.PI; while (la < -Math.PI) la += 2 * Math.PI;
    la = Math.max(-0.6, Math.min(0.35, la));
    this.turretAng += (la - this.turretAng) * Math.min(1, dt * 2.2);
    this.turret.setRotation(this.turretAng);
    const see = lineOfSight(this.scene.solids, base.x, base.y, p.x, p.y - 40);
    // cannon w/ telegraph
    this.fireT -= dt;
    if (this.fireT <= 0.9 && this.fireT > 0 && see) {
      this.charge += dt;
      const m = this.muzzle(); if (this.scene.lighting) this.scene.lighting.flash(m.x, m.y, 50 + this.charge * 80, 0.8, 40);
      if (Math.random() < dt * 8) this.scene.fx.burst('spark', m.x, m.y, 1, m.a * 57.3, 40, 30, 90);
    }
    if (this.fireT <= 0) {
      this.charge = 0;
      if (see && dist < 1300) {
        const m = this.muzzle();
        this.scene.combat.shell({ x: m.x, y: m.y, angle: m.a, speed: 1100, team: 'enemy', damage: 46, radius: 130, owner: this });
        this.scene.fx.muzzle(m.x, m.y, m.a, 2.2); this.scene.fx.burst('smoke', m.x, m.y, 6, m.a * 57.3, 50, 40, 160);
        AudioEngine.play('cannon', { x: this.x }); this.scene.fx.shake(200, 0.006);
        this.fireT = rand(3.2, 4.4);
      } else this.fireT = 1;
    }
    // coax mg
    this.mgT -= dt;
    if (this.mgT <= 0 && see && dist < 900) {
      this.mgBurst = (this.mgBurst || 0) + 1;
      const m = this.muzzle();
      const ang = m.a + rand(-0.06, 0.06);
      this.scene.combat.fire({ x: m.x, y: m.y + 6, angle: ang, speed: 1500, damage: 6, team: 'enemy', range: 1000, color: 0xff8a5c, knock: 100, weapon: 'coax', owner: this });
      AudioEngine.play('erifle', { x: this.x, vol: 0.6, gap: 40 });
      if (this.mgBurst > 7) { this.mgBurst = 0; this.mgT = rand(1.4, 2.4); } else this.mgT = 0.11;
    }
  }
}

export class Truck extends GroundVehicle {
  constructor(scene, x, groundY, opts = {}) {
    super(scene, x, groundY, 'truck', Object.assign({ hp: 520, wheels: [-70, 70], wheelScale: 0.9, name: 'TECHNICAL', art: 'v_hemtt', artW: 250 }, opts));
    const am = this.artMeta, H = this.h, Wd = this.w;
    this.bed = opts.bed || (am && am.bedY !== undefined ? { x: (0.5 - am.bedX) * Wd, y: am.bedY * H }
      : am && am.roofY !== undefined ? { x: 6, y: am.roofY * H } : { x: 50, y: 58 });
    this.gfx = scene.add.graphics().setDepth(DEPTH.vehicles + 1);
    this.stopX = opts.stopX; this.gunAim = Math.PI; this.fireT = 1.5; this.burst = 0; this.gunnerAlive = true;
  }
  armorMod(info) { return info.explosive ? 1 : 0.4; }
  update(dt) {
    this.baseUpdate(dt);
    const g = this.gfx; g.clear();
    if (!this.alive) { this.vx *= 0.93; return; }
    if (this.stopX !== undefined) this.driveToward(this.stopX, 260, dt);
    const p = this.scene.player;
    // gunner on the bed
    const gx = this.x - this.facing * this.bed.x, gy = this.groundY - this.bed.y;
    if (p && p.alive) { const wa = Math.atan2(p.y - 45 - (gy - 60), p.x - gx); this.gunAim += (wa - this.gunAim) * Math.min(1, dt * 2.5); }
    const pose = drawFigure(g, { x: gx, y: gy, facing: p && p.x > gx ? 1 : -1, aim: this.gunAim, walk: 0, move: 0, crouch: 0, air: false, recoil: this.rec || 0, reload: -1, hurt: this.hitFlash, weapon: 'lmg', style: STYLES.rifleman, time: this.time });
    this.rec = Math.max(0, (this.rec || 0) - dt * 8);
    if (Math.abs(this.vx) < 40 && p && p.alive) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        if (this.burst <= 0) this.burst = 10;
        const m = pose.muzzle || { x: gx, y: gy - 55 };
        this.scene.combat.fire({ x: m.x, y: m.y, angle: pose.weaponAngle + rand(-0.07, 0.07), speed: 1500, damage: 7, team: 'enemy', range: 1100, color: 0xff8a5c, owner: this });
        this.scene.fx.muzzle(m.x, m.y, pose.weaponAngle, 0.9); this.rec = 1;
        AudioEngine.play('erifle', { x: this.x, gap: 30 });
        this.burst--; this.fireT = this.burst > 0 ? 0.1 : rand(1.2, 2);
      }
    }
  }
  destroy() { super.destroy(); this.gfx.destroy(); }
}

// Friendly armour that rolls through and fires at distant targets (cinematic)
let allyTankN = 0;
export class AllyTank extends GroundVehicle {
  constructor(scene, x, groundY, opts = {}) {
    super(scene, x, groundY, 'tank', Object.assign({ team: 'player', hp: 99999, wheels: [], facing: 1, art: (allyTankN++ % 2) ? 'v_challenger' : 'v_leopard', artW: 330 }, opts));
    const m = this.artMeta;
    this.gun = m ? { x: (m.tipX - 0.5) * this.w, y: (1 - m.tipY) * this.h } : { x: 175, y: 78 };
    this.fireT = rand(2, 4); this.speed = opts.speed || 60; this.stopX = opts.stopX;
  }
  update(dt) {
    this.baseUpdate(dt);
    if (this.stopX !== undefined) this.driveToward(this.stopX, this.speed, dt);
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = rand(3, 5.5);
      const mx = this.x + this.facing * this.gun.x, my = this.groundY - this.gun.y;
      this.scene.fx.muzzle(mx, my, this.facing === 1 ? -0.05 : Math.PI + 0.05, 2.6);
      this.scene.fx.burst('smoke', mx, my, 10, this.facing === 1 ? 0 : 180, 60, 60, 260);
      AudioEngine.play('cannon', { x: this.x, vol: 0.9 });
      this.scene.fx.shake(220, 0.005);
      if (this.onFire) this.onFire(this);
    }
  }
}

// Player-usable mounted machine gun / flak emplacement
export class MountedGun {
  constructor(scene, x, groundY, opts = {}) {
    this.scene = scene; this.x = x; this.groundY = groundY; this.facing = opts.facing || 1;
    this.kind = opts.kind || 'mg';
    this.img = scene.add.image(x, groundY, this.kind === 'flak' ? 'flak' : 'mg_nest').setOrigin(0.5, 1).setDepth(DEPTH.solids - 1).setFlipX(this.facing < 0);
    this.gfx = scene.add.graphics().setDepth(DEPTH.actors + 2);
    this.heat = 0; this.overheated = false; this.cool = 0; this.user = null; this.aim = this.facing === 1 ? -0.2 : Math.PI + 0.2;
    this.pivot = { x: x, y: groundY - (this.kind === 'flak' ? 60 : 44) };
    this.interact = { x, y: groundY - 30, radius: 80, label: this.kind === 'flak' ? 'Man the AA gun' : 'Mount machine gun', enabled: true, onUse: (pl) => this.mount(pl) };
    scene.interactables.push(this.interact);
    this.keyE = scene.input.keyboard.addKey('E');
  }
  mount(pl) {
    this.user = pl; pl.controlsLocked = true; pl.mounted = this; pl.visible = true;
    pl.setPosition(this.x - this.facing * 34, this.groundY);
    pl.body.setVelocity(0, 0);
    this.scene.hud && this.scene.hud.notify(this.kind === 'flak' ? 'AA GUN — HOLD LMB · E TO DISMOUNT' : 'MG — HOLD LMB · E TO DISMOUNT', '#5ee0ff');
    this.mountT = 0.4;
  }
  dismount() {
    const pl = this.user; if (!pl) return;
    pl.controlsLocked = false; pl.mounted = null; this.user = null; pl.eLatch = true;
    pl.weaponShape = pl.weapon.shape;
    this.interact.enabled = true;
  }
  update(dt) {
    const g = this.gfx; g.clear();
    this.cool -= dt;
    this.heat = Math.max(0, this.heat - dt * (this.overheated ? 0.35 : 0.5));
    if (this.overheated && this.heat < 0.3) this.overheated = false;
    const pl = this.user;
    if (pl && (!pl.alive)) { this.user = null; this.interact.enabled = true; }
    if (this.user) {
      this.mountT -= dt;
      if (this.mountT <= 0 && Phaser.Input.Keyboard.JustDown(this.keyE)) { this.dismount(); return; }
      const wp = pl.pointerWorld();
      let a = Math.atan2(wp.y - this.pivot.y, wp.x - this.pivot.x);
      const fwd = this.facing === 1 ? 0 : Math.PI;
      let rel = a - fwd; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      const minR = this.kind === 'flak' ? -1.45 : -0.9, maxR = 0.5;
      rel = this.facing === 1 ? Math.max(minR, Math.min(maxR, rel)) : Math.max(-maxR, Math.min(-minR, rel));
      this.aim = fwd + rel;
      pl.facing = this.facing; pl.aim = this.aim; pl.crouch = 0.3;
      pl.weaponShape = null;
      const ptr = this.scene.input.activePointer;
      if (ptr.leftButtonDown() && !this.overheated && this.cool <= 0) this.shoot();
    }
    // draw barrel
    const len = this.kind === 'flak' ? 90 : 70;
    const ex = this.pivot.x + Math.cos(this.aim) * len, ey = this.pivot.y + Math.sin(this.aim) * len;
    g.lineStyle(this.kind === 'flak' ? 9 : 7, 0x0c1013, 1); g.lineBetween(this.pivot.x - Math.cos(this.aim) * 20, this.pivot.y - Math.sin(this.aim) * 20, ex, ey);
    if (this.kind === 'flak') { g.lineStyle(9, 0x0c1013, 1); g.lineBetween(this.pivot.x + 6, this.pivot.y + 8, ex + 6, ey + 8); }
    g.fillStyle(0x1f262b, 1); g.fillCircle(this.pivot.x, this.pivot.y, 10);
    if (this.heat > 0.5) { g.lineStyle(4, 0xff4020, (this.heat - 0.5) * 1.6); g.lineBetween(ex - Math.cos(this.aim) * 30, ey - Math.sin(this.aim) * 30, ex, ey); }
    this.muzzle = { x: ex, y: ey };
  }
  shoot() {
    const flak = this.kind === 'flak';
    this.cool = flak ? 0.16 : 0.07;
    this.heat += flak ? 0.045 : 0.022;
    if (this.heat >= 1) { this.overheated = true; this.heat = 1; AudioEngine.play('dry'); this.scene.hud && this.scene.hud.notify('OVERHEATED', '#ff4a3a'); }
    const a = this.aim + rand(-0.025, 0.025);
    const m = this.muzzle || this.pivot;
    if (flak) {
      // flak: explosive bursts at range
      this.scene.combat.fire({ x: m.x, y: m.y, angle: a, speed: 2400, damage: 60, team: 'player', range: 1500, color: 0xffd080, width: 3, knock: 200, weapon: 'turret', owner: this.user, trailLen: 160 });
      AudioEngine.play('flak', { pan: 0 });
    } else {
      this.scene.combat.fire({ x: m.x, y: m.y, angle: a, speed: 2600, damage: 32, team: 'player', range: 1600, color: 0xffd27a, width: 2.5, penetration: 2, knock: 220, weapon: 'turret', owner: this.user });
      AudioEngine.play('doorgun', { pan: 0 });
    }
    if (this.user) this.user.stats.shots++;
    this.scene.fx.muzzle(m.x, m.y, a, flak ? 1.6 : 1.2);
    this.scene.fx.casing(this.pivot.x, this.pivot.y, this.facing);
    this.scene.fx.shake(60, flak ? 0.005 : 0.003);
  }
}
