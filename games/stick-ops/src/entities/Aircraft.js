// Air combat: the player's strike jet REAPER-1, enemy fighters, SAM sites and the VALKYRIE bomber.
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { segRect } from '../systems/Combat.js';
import { vmeta } from '../render/VehicleArt.js';

// illustrated aircraft sprite at a given on-screen width, or the procedural fallback
export function aircraftImage(scene, x, y, art, width, fallbackKey, fallbackScale, fallbackTint) {
  const m = vmeta(scene, art);
  if (m) return scene.add.image(x, y, art).setScale(width / m.w);
  const img = scene.add.image(x, y, fallbackKey).setScale(fallbackScale);
  return fallbackTint ? img.setTint(fallbackTint) : img;
}

const rand = (a, b) => a + Math.random() * (b - a);

export class PlayerJet {
  constructor(scene, x, y) {
    this.scene = scene; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.team = 'player'; this.alive = true;
    this.maxHp = this.hp = 100;
    this.img = aircraftImage(scene, x, y, 'v_f22', 160, 'jet', 0.55, 0x46525c).setDepth(DEPTH.foreground - 2);
    this.burner = scene.add.image(x, y, 'glow').setBlendMode('ADD').setTint(0xff9a40).setDepth(DEPTH.foreground - 3);
    this.gunCd = 0; this.heat = 0; this.overheated = false;
    this.missiles = 8; this.missileCd = 0; this.missileRegen = 0;
    this.flares = 3; this.flareRegen = 0; this.flaresActive = false;
    this.clickQ = false;
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,SPACE');
    scene.input.on('pointerdown', (p) => { if (p.button === 0) this.clickQ = true; if (p.button === 2) this.missileQ = true; });
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: this.y }; }
  hitTest(x1, y1, x2, y2) { if (!this.alive) return null; const t = segRect(x1, y1, x2, y2, { x: this.x - 70, y: this.y - 16, w: 140, h: 32 }); return t >= 0 ? { t, part: 'body', material: 'metal' } : null; }
  takeDamage(d, info = {}) {
    if (!this.alive || this.scene.cinematic) return false;
    const diff = this.scene.player.diff.dmgTaken;
    this.hp -= (info.explosive ? d * 0.45 : Math.min(3, 0.6 + d * 0.15)) * (0.5 + diff * 0.5);
    this.scene.hud.damage(info); AudioEngine.play('hitmetal', { gap: 60 }); this.scene.fx.shake(100, 0.004);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.scene.jetDown(); }
    return false;
  }
  update(dt, scrollX, view) {
    const sc = this.scene; const k = this.keys; const locked = sc.cinematic || !this.alive;
    let ax = 0, ay = 0;
    if (!locked) { if (k.A.isDown) ax -= 1; if (k.D.isDown) ax += 1; if (k.W.isDown) ay -= 1; if (k.S.isDown) ay += 1; }
    this.vx += (ax * 420 - this.vx) * Math.min(1, dt * 4); this.vy += (ay * 380 - this.vy) * Math.min(1, dt * 4);
    // nose steering: the mouse sets where the nose points; the jet turns toward it at a fighter's turn rate
    // and flies along its nose, so turning around is a real loop and the guns only fire straight ahead
    const ptr = sc.input.activePointer; const wp = sc.cameras.main.getWorldPoint(ptr.x, ptr.y);
    if (this.heading === undefined) { this.heading = 0; this.roll = 1; }
    if (!locked && Math.hypot(wp.x - this.x, wp.y - this.y) > 70) {
      let d = Math.atan2(wp.y - this.y, wp.x - this.x) - this.heading;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const rate = 3.4;
      this.heading += Phaser.Math.Clamp(d, -rate * dt, rate * dt);
      this.heading = Phaser.Math.Angle.Wrap(this.heading);
    } else if (locked) this.heading += Phaser.Math.Angle.Wrap(0 - this.heading) * Math.min(1, dt * 2);
    const hc = Math.cos(this.heading), hs = Math.sin(this.heading);
    // thrust along the nose on top of WASD trim (relative to the scrolling corridor)
    const thrust = locked ? 0 : 260;
    this.x += (this.vx + sc.scrollSpeed + (hc - 1) * thrust * 0.6) * dt; this.y += (this.vy + hs * thrust) * dt;
    // stay on screen
    if (view.height > 300) { this.x = Phaser.Math.Clamp(this.x, view.x + 90, view.right - 200); this.y = Phaser.Math.Clamp(this.y, view.y + 60, view.bottom - 110); }
    // half-roll when flying backwards so the canopy stays on top
    this.roll += ((hc < -0.05 ? -1 : hc > 0.05 ? 1 : this.roll) - this.roll) * Math.min(1, dt * 7);
    if (this.baseSY === undefined) { this.baseSY = this.img.scaleY; }
    this.img.setPosition(this.x, this.y).setRotation(this.heading).setScale(this.img.scaleX, this.baseSY * (Math.abs(this.roll) < 0.15 ? 0.15 * Math.sign(this.roll || 1) : this.roll));
    this.burner.setPosition(this.x - 72 * hc, this.y - 72 * hs).setRotation(this.heading).setScale(0.45 + Math.random() * 0.15, 0.25);
    if (this.hp < 45 && Math.random() < dt * 20) sc.fx.burst('smoke', this.x - 50 * hc, this.y - 50 * hs, 1, this.heading * 57.3 + 180, 30, 40, 120);
    if (this.pipper) this.pipper.setVisible(!locked);
    if (locked) return;
    // guns: fixed in the nose, firing exactly where the jet points
    const aim = this.heading; this.aim = aim;
    this.gunCd -= dt; this.heat = Math.max(0, this.heat - dt * (this.overheated ? 0.3 : 0.5)); if (this.overheated && this.heat < 0.25) this.overheated = false;
    if ((ptr.leftButtonDown() || this.clickQ) && this.gunCd <= 0 && !this.overheated) {
      this.gunCd = 0.055; this.heat += 0.012; if (this.heat >= 1) { this.heat = 1; this.overheated = true; sc.hud.notify('GUNS OVERHEATED', '#ff4a3a'); }
      const mx = this.x + 70 * hc, my = this.y + 70 * hs;
      sc.combat.fire({ x: mx, y: my, angle: aim + rand(-0.012, 0.012), speed: 3000 + sc.scrollSpeed * Math.max(0, hc), damage: 20, team: 'player', range: 1800, color: 0xffd27a, width: 2.5, knock: 200, weapon: 'turret', owner: sc.player, trailLen: 150 });
      sc.fx.muzzle(mx, my, aim, 0.8); AudioEngine.play('doorgun', { gap: 35 }); sc.stats.shots++;
    }
    // gunsight pipper ahead of the nose
    if (!this.pipper) this.pipper = sc.add.image(0, 0, 'ring').setBlendMode('ADD').setTint(0x7cffb0).setScale(0.22).setAlpha(0.7).setDepth(DEPTH.fxTop);
    this.pipper.setPosition(this.x + 420 * hc, this.y + 420 * hs);
    this.clickQ = false;
    // missiles: lock the nearest target ahead
    this.missileCd -= dt; this.missileRegen += dt; if (this.missileRegen > 4 && this.missiles < 8) { this.missileRegen = 0; this.missiles++; }
    if (this.missileQ && this.missileCd <= 0 && this.missiles > 0) {
      const tgt = sc.lockTarget(this);
      this.missiles--; this.missileCd = 0.5;
      sc.combat.rocket({ x: this.x - 14 * Math.sin(this.heading), y: this.y + 14 * Math.cos(this.heading), angle: this.heading + 0.05, speed: 500 + sc.scrollSpeed * Math.max(0, Math.cos(this.heading)), accel: 1600, maxSpeed: 1700, team: 'player', damage: 280, radius: 130, homing: tgt, turn: 3.6, life: 4, owner: sc.player });
      if (tgt && tgt.onMissile) tgt.onMissile();
    }
    this.missileQ = false;
    // flares
    this.flareRegen += dt; if (this.flareRegen > 10 && this.flares < 3) { this.flareRegen = 0; this.flares++; }
    if (Phaser.Input.Keyboard.JustDown(k.SPACE) && this.flares > 0) this.popFlares();
  }
  popFlares() {
    const sc = this.scene; this.flares--; this.flaresActive = true;
    for (let i = 0; i < 8; i++) {
      const f = sc.add.image(this.x - 40, this.y + 10, 'glow').setBlendMode('ADD').setTint(0xffe0a0).setScale(0.35).setDepth(DEPTH.fxTop);
      sc.tweens.add({ targets: f, x: f.x - rand(150, 420), y: f.y + rand(80, 320), alpha: 0, scale: 0.12, duration: 2000, ease: 'Quad.easeIn', onComplete: () => f.destroy() });
    }
    AudioEngine.play('flak', { vol: 0.4 }); sc.hud.notify('FLARES', '#ffc34d');
    sc.time.delayedCall(2200, () => { this.flaresActive = false; });
  }
  destroy() { this.img.destroy(); this.burner.destroy(); if (this.pipper) this.pipper.destroy(); }
}

export class EnemyFighter {
  constructor(scene, x, y, opts = {}) {
    this.scene = scene; this.x = x; this.y = y; this.baseY = y; this.team = 'enemy'; this.alive = true; this.isHeli = true;
    this.maxHp = this.hp = opts.hp || 140; this.t = Math.random() * 6; this.fireT = rand(0.8, 1.6); this.burst = 0;
    this.speed = opts.speed || -260;    // relative to the scrolling camera (negative = toward the player)
    this.img = aircraftImage(scene, x, y, 'v_typhoon', 130, 'jet', 0.48, 0x6a2a26).setFlipX(true).setDepth(DEPTH.foreground - 4);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode('ADD').setTint(0xff6a30).setScale(0.3, 0.18).setDepth(DEPTH.foreground - 5);
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: this.y }; }
  hitTest(x1, y1, x2, y2) { if (!this.alive || this.dying) return null; const t = segRect(x1, y1, x2, y2, { x: this.x - 62, y: this.y - 16, w: 124, h: 32 }); return t >= 0 ? { t, part: 'body', material: 'metal' } : null; }
  takeDamage(d) {
    if (!this.alive || this.dying) return false;
    this.hp -= d;
    if (this.hp <= 0) { this.dying = true; this.scene.fx.explosion(this.x, this.y, { radius: 120 }); this.scene.stats.kills++; return true; }
    return false;
  }
  update(dt) {
    const sc = this.scene; this.t += dt;
    if (this.dying) {
      this.y += 260 * dt; this.x += (sc.scrollSpeed - 120) * dt; this.img.rotation -= dt * 2;
      if (Math.random() < dt * 30) sc.fx.burst('smoke', this.x, this.y, 1, -90, 40, 20, 60);
      if (this.y > sc.groundY - 20) { sc.fx.explosion(this.x, sc.groundY - 30, { radius: 160 }); this.destroy(); }
      this.img.setPosition(this.x, this.y); this.glow.setPosition(this.x + 60, this.y); return;
    }
    this.x += (sc.scrollSpeed + this.speed) * dt;
    this.y = this.baseY + Math.sin(this.t * 1.3) * 70;
    this.img.setPosition(this.x, this.y).setRotation(Math.cos(this.t * 1.3) * -0.15);
    this.glow.setPosition(this.x + 60, this.y);
    const j = sc.jet;
    if (j && j.alive && !sc.cinematic && this.x > j.x + 120 && this.x - j.x < 1100) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        if (this.burst <= 0) this.burst = 8;
        const ang = Math.atan2(j.y - this.y, j.x - this.x) + rand(-0.06, 0.06);
        sc.combat.fire({ x: this.x - 60, y: this.y + 4, angle: ang, speed: 1700, damage: 6, team: 'enemy', range: 1300, color: 0xff8a5c, owner: this });
        AudioEngine.play('minigun', { x: this.x, gap: 50, vol: 0.6 });
        this.burst--; this.fireT = this.burst > 0 ? 0.08 : rand(1.4, 2.2);
      }
    }
    if (this.x < sc.cameras.main.worldView.x - 400) this.destroy();
  }
  destroy() { this.alive = false; this.img.destroy(); this.glow.destroy(); }
}

export class SamSite {
  constructor(scene, x, groundY) {
    this.scene = scene; this.x = x; this.groundY = groundY; this.team = 'enemy'; this.alive = true; this.isVehicle = true;
    this.maxHp = this.hp = 300;
    this.img = scene.add.image(x, groundY, 'sam').setOrigin(0.5, 1).setDepth(DEPTH.vehicles).setFlipX(true);
    this.fireT = rand(2, 4); this.warned = false;
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: this.groundY - 60 }; }
  hitTest(x1, y1, x2, y2) { if (!this.alive) return null; const t = segRect(x1, y1, x2, y2, { x: this.x - 75, y: this.groundY - 120, w: 150, h: 120 }); return t >= 0 ? { t, part: 'body', material: 'metal' } : null; }
  takeDamage(d, info = {}) {
    if (!this.alive) return false; this.hp -= d * (info.explosive ? 1.2 : 1);
    if (this.hp <= 0) { this.alive = false; this.img.setTint(0x333333); this.scene.fx.explosion(this.x, this.groundY - 60, { radius: 200, big: true }); this.scene.fx.fireSource(this.x, this.groundY, 0.8, 0); this.scene.hud.notify('SAM SITE DESTROYED', '#7cff9a'); this.scene.stats.kills++; return true; }
    return false;
  }
  update(dt) {
    const sc = this.scene; const j = sc.jet; if (!this.alive || !j || !j.alive || sc.cinematic) return;
    const dx = this.x - j.x; if (dx < -200 || dx > 1600) return;
    this.fireT -= dt;
    if (this.fireT < 1.2 && !this.warned) { this.warned = true; sc.hud.notify('MISSILE LOCK — FLARES! (SPACE)', '#ff4a3a'); AudioEngine.play('warning'); }
    if (this.fireT <= 0) {
      this.fireT = rand(5, 7); this.warned = false;
      const sx = this.x - 50, sy = this.groundY - 120;
      sc.combat.rocket({ x: sx, y: sy, angle: Math.atan2(j.y - sy, j.x - sx), speed: 300, accel: 900, maxSpeed: 1100, team: 'enemy', damage: 40, radius: 110, homing: j, turn: 1.7, life: 5, owner: this, shootable: true });
    }
  }
  destroy() { this.img.destroy(); }
}

export class Bomber {
  constructor(scene, x, y) {
    this.scene = scene; this.x = x; this.y = y; this.team = 'enemy'; this.alive = true; this.isHeli = true;
    this.maxHp = this.hp = 5200; this.name = 'VALKYRIE'; this.t = 0; this.phase = 1;
    this.img = aircraftImage(scene, x, y, 'v_c130', 660, 'bomber', 1.25, 0x4a3a44).setFlipX(true).setDepth(DEPTH.foreground - 5);
    this.engines = [0, 1].map(() => scene.add.image(x, y, 'glow').setBlendMode('ADD').setTint(0xff7a30).setScale(0.5, 0.3).setDepth(DEPTH.foreground - 6));
    this.gunT = 1.5; this.fighterT = 9; this.flareCd = 0; this.flaresActive = false; this.bombT = 6;
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: this.y }; }
  hitTest(x1, y1, x2, y2) { if (!this.alive || this.dying) return null; const t = segRect(x1, y1, x2, y2, { x: this.x - 300, y: this.y - 50, w: 600, h: 100 }); return t >= 0 ? { t, part: 'body', material: 'metal' } : null; }
  takeDamage(d, info = {}) {
    if (!this.alive || this.dying) return false;
    this.hp -= d * (info.explosive ? 1 : 0.55);
    const f = this.hp / this.maxHp;
    if (this.phase === 1 && f < 0.6) { this.phase = 2; this.scene.say('DRAGO', 'You fly well for a dead man, Ghost.', 2600); }
    if (this.phase === 2 && f < 0.3) { this.phase = 3; this.scene.fx.explosion(this.x + 120, this.y - 30, { radius: 120 }); this.scene.say('REAPER-2', 'She’s burning! Finish her!', 2200); }
    if (this.hp <= 0) { this.hp = 0; this.dying = true; this.scene.bomberDown(this); return true; }
    return false;
  }
  onMissile() {
    if (this.flareCd > 0 || Math.random() > 0.45) return;
    this.flareCd = 7; this.flaresActive = true;
    for (let i = 0; i < 10; i++) {
      const f = this.scene.add.image(this.x, this.y + 30, 'glow').setBlendMode('ADD').setTint(0xffe0a0).setScale(0.4).setDepth(DEPTH.fxTop);
      this.scene.tweens.add({ targets: f, x: f.x + rand(-200, 300), y: f.y + rand(100, 360), alpha: 0, duration: 2200, onComplete: () => f.destroy() });
    }
    this.scene.hud.notify('VALKYRIE FLARES', '#ffc34d');
    this.scene.time.delayedCall(1600, () => { this.flaresActive = false; });
  }
  update(dt) {
    const sc = this.scene; const j = sc.jet; this.t += dt; this.flareCd -= dt;
    if (this.dying) {
      this.y += 120 * dt; this.img.rotation -= dt * 0.25;
      if (Math.random() < dt * 6) sc.fx.explosion(this.x + rand(-250, 250), this.y + rand(-40, 40), { radius: 90 });
    } else {
      const view = sc.cameras.main.worldView;
      this.x = view.right - 330 + Math.sin(this.t * 0.4) * 60; this.y = view.y + view.height * 0.32 + Math.sin(this.t * 0.7) * 80;
    }
    this.img.setPosition(this.x, this.y);
    this.engines.forEach((e, i) => e.setPosition(this.x + 300, this.y + (i ? 30 : -30)).setAlpha(0.6 + Math.random() * 0.4));
    if (this.phase > 1 && Math.random() < dt * (this.phase * 6)) sc.fx.burst(this.phase > 2 ? 'fire' : 'smoke', this.x + rand(-100, 200), this.y - 10, 1, 0, 40, 40, 120);
    if (this.dying || !j || !j.alive || sc.cinematic) return;
    // tail and belly turrets
    this.gunT -= dt;
    if (this.gunT <= 0) {
      this.gunT = this.phase === 3 ? 0.06 : 0.09; this.burst = (this.burst || 0) + 1;
      for (const oy of [-40, 45]) {
        const gx = this.x - 260, gy = this.y + oy; const ang = Math.atan2(j.y - gy, j.x - gx) + rand(-0.08, 0.08);
        sc.combat.fire({ x: gx, y: gy, angle: ang, speed: 1600, damage: 5, team: 'enemy', range: 1400, color: 0xff9a50, owner: this });
      }
      AudioEngine.play('minigun', { x: this.x, gap: 60, vol: 0.6 });
      if (this.burst > 16) { this.burst = 0; this.gunT = rand(1.6, 2.6) / this.phase; }
    }
    this.fighterT -= dt;
    if (this.fighterT <= 0) { this.fighterT = 13 - this.phase * 2; sc.spawnFighters(2); }
    // phase 2+: rocket salvos
    this.bombT -= dt;
    if (this.phase >= 2 && this.bombT <= 0) {
      this.bombT = 6;
      for (let i = 0; i < 3; i++) sc.time.delayedCall(i * 200, () => { if (!this.alive || this.dying) return; sc.combat.rocket({ x: this.x - 200, y: this.y + 40, angle: Math.PI + rand(-0.2, 0.2), speed: 250, accel: 700, maxSpeed: 900, team: 'enemy', damage: 30, radius: 100, homing: j, turn: 1.3, life: 4, owner: this, shootable: true }); });
      AudioEngine.play('warning');
    }
  }
  destroy() { this.alive = false; this.img.destroy(); this.engines.forEach((e) => e.destroy()); }
}
