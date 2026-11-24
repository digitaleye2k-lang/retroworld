// Base class for every stickman soldier (player, enemies, allies, informant).
import { DEPTH } from '../config.js';
import { drawFigure, Ragdoll } from '../render/StickFigure.js';
import { segRect } from '../systems/Combat.js';
import { AudioEngine } from '../core/AudioEngine.js';

export class Actor {
  constructor(scene, x, y, opts) {
    this.scene = scene;
    this.style = opts.style;
    this.team = opts.team;
    const S = this.style.scale || 1;
    this.S = S;
    this.bw = 22 * S; this.bh = 80 * S;
    this.zone = scene.add.zone(x, y - this.bh / 2, this.bw, this.bh);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body;
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(1200, 1300);
    this.zone.actor = this;
    this.gfx = scene.add.graphics().setDepth(opts.depth || DEPTH.actors);
    this.hp = this.maxHp = opts.hp || 100;
    this.alive = true;
    this.facing = opts.facing || 1;
    this.aim = this.facing === 1 ? 0 : Math.PI;
    this.walk = 0; this.moveAmt = 0; this.crouch = 0; this.recoil = 0; this.hurt = 0; this.reload = -1;
    this.time = Math.random() * 10;
    this.weaponShape = opts.weaponShape || 'rifle';
    this.lean = 0; this.melee = 0; this.throwing = 0;
    this.dropping = 0;
    this.lastPose = null;
    this.ragdoll = null;
    this.visible = true;
    this.noGravity = false;
    this.poseMem = {};
    this.facingDisplay = this.facing;
    this.land = 0; this.accel = 0; this.lastVx = 0; this.lastDt = 1 / 60;
    this.mantleState = null; this.climbing = null; this.climbPhase = 0;
    scene.registerActor(this);
  }

  get x() { return this.body.center.x; }
  get y() { return this.body.bottom; }
  get onGround() { return this.body.blocked.down || this.body.touching.down; }
  get crouching() { return this.crouch > 0.5; }

  setPosition(x, y) { this.body.reset(x, y - this.bh / 2); }

  headCenter() {
    const S = this.S; const cr = this.crouch;
    return { x: this.x + this.facing * (2 + cr * 6) * S, y: this.y - (74 - cr * 16) * S };
  }
  chest() { const cr = this.crouch; return { x: this.x + this.facing * 2, y: this.y - (52 - cr * 15) * this.S }; }
  eye() { const h = this.headCenter(); return { x: h.x + this.facing * 3, y: h.y }; }

  hitTest(x1, y1, x2, y2) {
    if (!this.alive) return null;
    const S = this.S; const h = this.headCenter(); const cr = this.crouch;
    const headR = { x: h.x - 8 * S, y: h.y - 9 * S, w: 16 * S, h: 17 * S };
    const top = this.y - (64 - cr * 16) * S;
    const bodyR = { x: this.x - 11 * S + this.facing * 2, y: top, w: 22 * S, h: this.y - top };
    const th = segRect(x1, y1, x2, y2, headR);
    const tb = segRect(x1, y1, x2, y2, bodyR);
    if (th < 0 && tb < 0) return null;
    if (th >= 0 && (tb < 0 || th <= tb + 0.002)) return { t: th, part: 'head', material: this.armorHead ? 'metal' : 'flesh' };
    return { t: tb, part: 'body', material: 'flesh' };
  }

  damageMod(dmg) { return dmg; }

  takeDamage(dmg, info = {}) {
    if (!this.alive || this.invulnerable) return false;
    dmg = this.damageMod(dmg, info);
    this.hp -= dmg;
    this.hurt = 1;
    this.lastHit = info;
    if (info.angle !== undefined) this.lean = -Math.cos(info.angle) * this.facing * 4;
    this.onDamaged(dmg, info);
    if (this.hp <= 0) { this.hp = 0; this.die(info); return true; }
    return false;
  }

  onDamaged() {}

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    const ang = info.angle !== undefined ? info.angle : (this.facing === 1 ? Math.PI : 0);
    const force = (info.knock || 140) + (info.explosive ? 400 : 0);
    const imp = { x: Math.cos(ang) * force, y: Math.sin(ang) * force - (info.explosive ? 380 : 90) };
    if (info.explosive && info.x !== undefined) { const dx = this.x - info.x; imp.x = Math.sign(dx || 1) * force; }
    if (this.lastPose) {
      this.ragdoll = new Ragdoll(this.lastPose, this.style, imp, () => this.scene.solids);
      if (info.part === 'head') this.ragdoll.pts.head.px -= imp.x * 0.012;
    }
    // drop weapon
    if (this.lastPose && this.weaponShape && this.lastPose.muzzle) {
      const m = this.lastPose.muzzle;
      this.scene.fx.spawnDebris('px', m.x, m.y, imp.x * 0.4 + (Math.random() - 0.5) * 80, -200, { scale: 6, tint: 0x111417, life: 10, bounce: 0.2, half: 2 });
    }
    this.body.enable = false;
    this.gfx.setDepth(DEPTH.corpses);
    this.deathTime = this.scene.time.now;
    const fx = this.x;
    this.scene.time.delayedCall(320 + Math.random() * 200, () => AudioEngine.play('bodyfall', { x: fx, gap: 40 }));
    this.onDeath(info);
  }

  onDeath() {}

  updateBase(dt) {
    this.time += dt;
    this.lastDt = dt || 1 / 60;
    // turn-around squash: the drawn facing sweeps through zero instead of flipping instantly
    const fd = this.facing - this.facingDisplay;
    if (Math.abs(fd) > 0.001) this.facingDisplay += Math.sign(fd) * Math.min(Math.abs(fd), dt * 13);
    this.land = Math.max(0, this.land - dt * 4.5);
    if (dt > 0) { const ax = (this.body.velocity.x - this.lastVx) / dt * this.facing; this.accel += (ax - this.accel) * Math.min(1, dt * 10); }
    this.lastVx = this.body.velocity.x;
    this.hurt = Math.max(0, this.hurt - dt * 5);
    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.lean *= Math.max(0, 1 - dt * 8);
    if (this.melee > 0) this.melee = Math.max(0, this.melee - dt * 4);
    if (this.throwing > 0) this.throwing = Math.max(0, this.throwing - dt * 3.5);
    if (this.dropping > 0) this.dropping -= dt;
    const vx = this.body.velocity.x;
    const speed = Math.abs(vx);
    this.moveAmt += ((this.onGround ? Math.min(1, speed / 220) : 0) - this.moveAmt) * Math.min(1, dt * 12);
    const dir = vx * this.facing >= 0 ? 1 : -1;
    const prev = this.walk;
    this.walk += dt * speed * 0.058 * dir;
    if (this.onGround && speed > 40 && Math.floor(prev / Math.PI) !== Math.floor(this.walk / Math.PI)) this.onStep();
    if (!this.wasGround && this.onGround && this.prevVy > 400) this.onLand(this.prevVy);
    this.wasGround = this.onGround; this.prevVy = this.body.velocity.y;
  }

  surfaceBelow() {
    for (const s of this.scene.solids) if (this.x >= s.x && this.x <= s.x + s.w && Math.abs(s.y - this.y) < 6) return s.material;
    return 'concrete';
  }
  onStep() {
    if (this.team === 'player' || Math.random() < 0.5) AudioEngine.play('step', { x: this.x, vol: this.team === 'player' ? (this.crouching ? 0.45 : 1) : 0.6, gap: 60, surface: this.surfaceBelow() === 'dirt' ? 'dirt' : 'concrete' });
  }
  onLand(vy) { this.land = Math.min(1, (vy || 500) / 1000); AudioEngine.play('land', { x: this.x, vol: this.team === 'player' ? 1 : 0.6 }); this.scene.fx.burst('dust', this.x, this.y - 2, 4, -90, 160, 30, 90); }

  // ---------- climbing: mantle onto ledges ----------
  // Finds a solid ledge directly in front (dir = +1/-1) whose top is reachable and has room to stand on.
  findLedge(dir, maxH = 150, minH = 16) {
    const S = this.S, x = this.x, y = this.y, half = this.bw / 2;
    let best = null;
    for (const s of this.scene.solids) {
      if (s.dead || s.oneWay) continue;
      const front = dir > 0 ? s.x : s.x + s.w;
      const gap = dir > 0 ? front - (x + half) : (x - half) - front;
      if (gap < -8 || gap > 30) continue;
      const h = y - s.y;
      if (h < minH || h > maxH * S) continue;
      const tx = dir > 0 ? s.x + Math.min(20 * S, s.w / 2) : s.x + s.w - Math.min(20 * S, s.w / 2);
      // room to stand on top?
      const room = { x: tx - half + 2, y: s.y - this.bh + 4, w: this.bw - 4, h: this.bh - 6 };
      let blocked = false;
      for (const o of this.scene.solids) {
        if (o === s || o.dead || o.oneWay) continue;
        if (room.x < o.x + o.w && room.x + room.w > o.x && room.y < o.y + o.h && room.y + room.h > o.y) { blocked = true; break; }
      }
      if (blocked) continue;
      if (!best || h < best.h) best = { h, tx, ty: s.y, edge: front, solid: s };
    }
    return best;
  }

  startMantle(ledge, dir) {
    if (this.mantleState) return;
    const quick = ledge.h < 52;
    this.mantleState = { t: 0, dur: quick ? 0.22 : 0.3 + ledge.h / 520, from: { x: this.x, y: this.y }, to: { x: ledge.tx, y: ledge.ty }, edge: ledge.edge, dir, h: ledge.h };
    this.facing = dir;
    this.body.setAllowGravity(false); this.body.setVelocity(0, 0); this.body.checkCollision.none = true;
    AudioEngine.play('mantle', { x: this.x, vol: this.team === 'player' ? 0.9 : 0.5 });
  }

  updateMantle(dt) {
    const m = this.mantleState; if (!m) return false;
    m.t += dt;
    const k = Math.min(1, m.t / m.dur);
    // rise first (hands on ledge), then roll forward over the top
    const up = Math.min(1, k / 0.62), fw = Math.max(0, (k - 0.45) / 0.55);
    const ease = (v) => 1 - Math.pow(1 - v, 2.2);
    const nx = m.from.x + (m.to.x - m.from.x) * ease(fw);
    const ny = m.from.y + (m.to.y - m.from.y) * ease(up);
    this.body.reset(nx, ny - this.bh / 2);
    this.mantleK = k;
    if (k >= 1) {
      this.mantleState = null; this.mantleK = 0;
      this.body.setAllowGravity(!this.noGravity); this.body.checkCollision.none = false;
      this.body.setVelocity(m.dir * 90, 0);
      this.land = 0.35;
    }
    return true;
  }

  poseData() {
    return {
      x: this.x, y: this.y, facing: this.facing, aim: this.aim, walk: this.walk, move: this.moveAmt, crouch: this.crouch,
      air: !this.onGround && !this.seated && !this.mantleState && !this.climbing, vy: this.body.velocity.y, recoil: this.recoil, reload: this.reload, hurt: this.hurt,
      weapon: this.weaponShape, style: this.style, time: this.time, lean: this.lean, melee: this.melee, throwing: this.throwing,
      handsUp: this.handsUp, seated: this.seated, lowered: this.lowered, nvgDown: this.nvgDown,
      mem: this.poseMem, dt: this.lastDt, facingDisplay: this.facingDisplay, land: this.land, accel: this.accel,
      vxRel: this.body.velocity.x * this.facing / 245,
      mantle: this.mantleState ? Math.max(0.01, this.mantleK || 0.01) : 0,
      ledge: this.mantleState ? { x: (this.mantleState.edge - this.x) * this.facing / this.S + 2, y: (this.mantleState.to.y - this.y) / this.S } : null,
      climb: !!this.climbing, climbPhase: this.climbPhase,
    };
  }

  draw() {
    const g = this.gfx;
    if (!this.alive) {
      if (this.ragdoll) {
        if (this.ragdoll.settled < 1.2 || !this.ragdollDrawnSettled) {
          g.clear(); this.ragdoll.draw(g);
          if (this.ragdoll.settled >= 1.2) this.ragdollDrawnSettled = true;
        }
      }
      return;
    }
    g.clear();
    if (!this.visible) return;
    this.lastPose = drawFigure(g, this.poseData());
  }

  updateCorpse(dt) {
    if (this.ragdoll) this.ragdoll.update(dt);
    const age = (this.scene.time.now - this.deathTime) / 1000;
    if (age > 25) { this.gfx.setAlpha(Math.max(0, 1 - (age - 25) / 3)); if (age > 28) this.destroy(); }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.alive = false;
    this.gfx.destroy(); this.zone.destroy();
    this.scene.unregisterActor(this);
  }
}
