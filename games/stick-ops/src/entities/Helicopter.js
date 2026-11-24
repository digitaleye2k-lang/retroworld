// Helicopters: transports (ally/enemy) with rappel ropes & searchlights, and the gunship boss.
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { segRect } from '../systems/Combat.js';
import { Soldier } from './Soldier.js';
import { vmeta } from '../render/VehicleArt.js';

let heliId = 0;
const rand = (a, b) => a + Math.random() * (b - a);

export class Helicopter {
  constructor(scene, x, y, opts = {}) {
    this.scene = scene; this.id = 'heli' + (heliId++);
    this.kind = opts.kind || 'ally';
    const key = this.kind === 'gunship' ? 'heli_gunship' : 'heli_ally';
    // illustrated sprite: Hind gunship, Wildcat transport, Tiger for enemy transports
    const art = opts.art || (this.kind === 'gunship' ? 'v_hind' : opts.enemy ? 'v_tiger' : 'v_wildcat');
    const am = vmeta(scene, art);
    this.scale = opts.scale || 1;
    this.depth = opts.depth || DEPTH.heli;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.tilt = 0;
    this.facing = opts.facing || 1;
    if (am) {
      const dw = this.kind === 'gunship' ? 380 : 350; const k = dw / am.w;
      this.body = scene.add.image(x, y, art).setDepth(this.depth).setScale(this.scale * k);
      this.hub = { x: (am.hubX - 0.5) * dw, y: (am.hubY - 0.5) * am.h * k };
      this.tailAt = { x: (am.tailX - 0.5) * dw, y: (am.tailY - 0.5) * am.h * k };
    } else {
      this.body = scene.add.image(x, y, key).setDepth(this.depth).setScale(this.scale);
      this.hub = { x: this.kind === 'gunship' ? 55 : 35, y: -56 };
    }
    if (opts.tint) this.body.setTint(opts.tint);
    this.rotor = scene.add.image(x, y, 'rotor').setDepth(this.depth + 0.1).setScale(this.scale);
    this.tail = scene.add.image(x, y, 'tailrotor').setDepth(this.depth + 0.1).setScale(this.scale * 0.9);
    this.gfx = scene.add.graphics().setDepth(this.depth + 0.2);
    this.target = null; this.path = null; this.speed = opts.speed || 260;
    this.time = Math.random() * 10;
    this.ropes = [];
    this.alive = true;
    this.sound = opts.silent ? null : (AudioEngine.loopSample(this.id, 'rotor', 0) || AudioEngine.loop(this.id, 'rotor', 0));
    this.loud = opts.loud !== undefined ? opts.loud : 1;
    if (opts.searchlight && scene.lighting) this.search = scene.lighting.add({ x, y, cone: { angle: Math.PI / 2, len: 560, width: 190 }, i: 0.95, color: 0xe8f4ff, glowAlpha: 0.16 });
    this.searchAngle = Math.PI / 2;
    if (opts.lightTint !== false && scene.lighting) this.navLight = scene.lighting.add({ x, y, r: 60, i: 0.6, color: this.kind === 'gunship' ? 0xff3020 : 0x30ff60, glowAlpha: 0.5 });
    this.smoking = 0;
  }

  moveTo(x, y, speed) { this.target = { x, y }; if (speed) this.speed = speed; this.path = null; }
  followPath(points, speed, onDone) { this.path = points.slice(); this.speed = speed || this.speed; this.onPathDone = onDone; this.target = this.path.shift(); }
  arrived(tol = 20) { return !this.target || Math.hypot(this.target.x - this.x, this.target.y - this.y) < tol; }

  // Deploy soldiers down ropes
  rappel(types, opts = {}) {
    const scene = this.scene; const out = [];
    types.forEach((type, i) => {
      scene.time.delayedCall(i * (opts.gap || 650), () => {
        if (!this.alive) return;
        const dx = this.facing * (20 + (i % 2) * 18) * this.scale;
        const s = scene.spawnSoldier(type, this.x + dx, this.y + 20, { state: 'rappel', facing: Math.random() < 0.5 ? 1 : -1, team: opts.team });
        s.ropeFrom = this; s.ropeDx = dx;
        this.ropes.push(s); out.push(s);
        AudioEngine.play('jump', { x: this.x });
      });
    });
    return out;
  }

  update(dt) {
    this.time += dt;
    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y; const d = Math.hypot(dx, dy);
      const want = Math.min(this.speed, d * 2.2);
      const tvx = d > 1 ? (dx / d) * want : 0, tvy = d > 1 ? (dy / d) * want : 0;
      this.vx += (tvx - this.vx) * Math.min(1, dt * 1.8); this.vy += (tvy - this.vy) * Math.min(1, dt * 1.8);
      if (this.path && d < 40) { if (this.path.length) this.target = this.path.shift(); else { this.path = null; const cb = this.onPathDone; this.onPathDone = null; if (cb) cb(); } }
    } else { this.vx *= 1 - Math.min(1, dt * 2); this.vy *= 1 - Math.min(1, dt * 2); }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.abs(this.vx) > 30 && !this.lockFacing) this.facing = this.vx > 0 ? 1 : -1;
    const bob = Math.sin(this.time * 1.7) * 4;
    this.tilt += ((this.vx / 900) * 0.35 - this.tilt) * Math.min(1, dt * 3);
    const f = this.facing, s = this.scale;
    this.body.setPosition(this.x, this.y + bob).setFlipX(f < 0).setRotation(this.tilt * f * (f < 0 ? -1 : 1) + (this.extraRot || 0));
    const rot = this.body.rotation, c = Math.cos(rot), sn = Math.sin(rot);
    const loc = (lx, ly) => ({ x: this.x + (lx * f * c - ly * sn) * s, y: this.y + bob + (lx * f * sn + ly * c) * s });
    const rp = loc(this.hub.x, this.hub.y);
    this.rotor.setPosition(rp.x, rp.y).setRotation(rot).setScale(s * (0.75 + 0.25 * Math.abs(Math.sin(this.time * 31))), s);
    const tp = this.tailAt ? loc(this.tailAt.x, this.tailAt.y) : loc(this.kind === 'gunship' ? -165 : -156, this.kind === 'gunship' ? -26 : -27);
    this.tail.setPosition(tp.x, tp.y).setRotation(this.time * 40);
    this.loc = loc;
    const g = this.gfx; g.clear();
    // rotor blades flicker lines
    g.lineStyle(2 * s, 0x0a0d10, 0.7);
    const bl = 170 * s; const ph = this.time * 31;
    for (let k = 0; k < 2; k++) { const w = Math.cos(ph + k * Math.PI / 2) * bl; g.lineBetween(rp.x - w * c, rp.y - w * sn, rp.x + w * c, rp.y + w * sn); }
    g.fillStyle(0x0a0d10, 1); g.fillCircle(rp.x, rp.y + 2 * s, 5 * s);
    // ropes
    for (let i = this.ropes.length - 1; i >= 0; i--) {
      const sd = this.ropes[i];
      const top = loc(sd.ropeDx / s * f, 10);
      if (!sd.alive || sd.state !== 'rappel') { if (!sd.ropeFall) { sd.ropeFall = 1; } sd.ropeFall -= dt; if (sd.ropeFall <= 0) { this.ropes.splice(i, 1); continue; } }
      const bottomY = sd.alive && sd.state === 'rappel' ? sd.y - 70 : top.y + 260 * (sd.ropeFall || 1);
      g.lineStyle(2, 0x3a3328, 0.9); g.lineBetween(top.x, top.y, sd.alive && sd.state === 'rappel' ? sd.x : top.x + Math.sin(this.time * 3) * 10, bottomY + (sd.alive && sd.state === 'rappel' ? 0 : 120));
    }
    if (this.search) {
      const sp = loc(120, 30); this.search.x = sp.x; this.search.y = sp.y;
      if (this.searchTarget) { this.searchAngle += (Math.atan2(this.searchTarget.y - sp.y, this.searchTarget.x - sp.x) - this.searchAngle) * Math.min(1, dt * 2); }
      this.search.cone.angle = this.searchAngle;
    }
    if (this.navLight) { const np = loc(-150, -20); this.navLight.x = np.x; this.navLight.y = np.y; this.navLight.on = Math.floor(this.time * 1.5) % 2 === 0; }
    if (this.smoking > 0) {
      this.smokeT = (this.smokeT || 0) + dt;
      if (this.smokeT > 0.05) { this.smokeT = 0; const ep = loc(20, -40); this.scene.fx.burst('smoke', ep.x, ep.y, 1, -90 - f * 60, 30, 30, 90); if (this.smoking > 1) this.scene.fx.burst('fire', ep.x, ep.y, 1, -90, 60, 20, 80); }
    }
    // audio
    if (this.sound) {
      const cam = this.scene.cameras.main; const d = Math.abs(this.x - cam.midPoint.x) + Math.abs(this.y - cam.midPoint.y) * 0.5;
      this.sound.setVol(Math.max(0, 1 - d / 2200) * 0.55 * this.loud);
      this.sound.setPan(Math.max(-1, Math.min(1, (this.x - cam.midPoint.x) / 900)));
    }
  }

  destroy() {
    this.alive = false;
    this.body.destroy(); this.rotor.destroy(); this.tail.destroy(); this.gfx.destroy();
    if (this.search && this.scene.lighting) this.scene.lighting.remove(this.search);
    if (this.navLight && this.scene.lighting) this.scene.lighting.remove(this.navLight);
    if (this.sound) AudioEngine.stopLoop(this.id);
  }
}

// ---------------- Gunship boss ----------------
export class Gunship extends Helicopter {
  constructor(scene, x, y, opts = {}) {
    super(scene, x, y, Object.assign({ kind: 'gunship', searchlight: true, loud: 1.3 }, opts));
    this.team = 'enemy'; this.isHeli = true;
    this.maxHp = this.hp = opts.hp || 3200;
    this.phase = 1; this.attackT = 2.5; this.attack = null; this.flareCd = 0; this.flaresActive = false;
    this.name = opts.name || 'BLACK WIDOW';
    this.quiet = !!opts.name && opts.name !== 'BLACK WIDOW';
    this.groundY = opts.groundY || 900;
    this.bounds = opts.bounds || [0, 99999];
    this.onDefeated = opts.onDefeated;
    this.repositionT = 0;
    this.hitFlash = 0;
    scene.targets.push(this);
  }

  center() { return { x: this.x, y: this.y }; }
  get displayY() { return this.y; }

  hitTest(x1, y1, x2, y2) {
    if (!this.alive || this.dying) return null;
    const t = segRect(x1, y1, x2, y2, { x: this.x - 140 * this.scale, y: this.y - 30 * this.scale, w: 300 * this.scale, h: 60 * this.scale });
    return t >= 0 ? { t, part: 'body', material: 'metal' } : null;
  }

  takeDamage(dmg, info = {}) {
    if (!this.alive || this.dying) return false;
    let d = dmg;
    if (!info.explosive) d *= info.weapon === 'sniper' ? 1 : info.weapon === 'turret' ? 0.65 : 0.45;
    this.hp -= d; this.hitFlash = 1;
    const frac = this.hp / this.maxHp;
    if (this.phase === 1 && frac < 0.66) this.enterPhase(2);
    else if (this.phase === 2 && frac < 0.33) this.enterPhase(3);
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    return false;
  }

  enterPhase(p) {
    this.phase = p; this.smoking = p - 1;
    const hud = this.scene.hud;
    if (p === 2 && !this.quiet) { hud && hud.subtitle('VARKOV', 'You think you can stop BLACKOUT? Bring them down!', 3200); this.attackT = 0.5; this.attack = null; }
    if (p === 3 && !this.quiet) { hud && hud.subtitle('OVERLORD', 'He\'s hit bad! Keep firing, Ghost!', 3000); this.scene.fx.explosion(this.x - 30, this.y - 20, { radius: 90 }); }
  }

  popFlares() {
    if (this.flareCd > 0) return;
    this.flareCd = 13; this.flaresActive = true;
    for (let i = 0; i < 8; i++) {
      const img = this.scene.add.image(this.x, this.y + 20, 'glow').setBlendMode('ADD').setTint(0xffe0a0).setScale(0.35).setDepth(DEPTH.fxTop);
      const vx = -this.facing * rand(60, 260), vy = rand(-200, 60);
      this.scene.tweens.add({ targets: img, x: img.x + vx * 2.2, y: img.y + vy + 380, alpha: 0, scale: 0.15, duration: 2400, ease: 'Quad.easeIn', onComplete: () => img.destroy() });
    }
    AudioEngine.play('flak', { x: this.x, vol: 0.5 });
    this.scene.hud && this.scene.hud.notify('FLARES DEPLOYED', '#ffc34d');
    this.scene.time.delayedCall(1800, () => { this.flaresActive = false; });
  }

  die() {
    this.dying = true;
    const scene = this.scene;
    scene.setSlowmo(0.25, 2600);
    AudioEngine.play('explosion', { x: this.x, big: true });
    scene.fx.explosion(this.x, this.y, { radius: 200 });
    this.smoking = 2; this.target = null;
    this.vx = this.facing * 160; this.vy = 60;
    this.spin = 0;
    if (this.search) { scene.lighting.remove(this.search); this.search = null; }
  }

  updateBoss(dt) {
    const scene = this.scene; const p = scene.player;
    this.flareCd -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.body.setTintFill && (this.hitFlash > 0.5 ? this.body.setTint(0xff8a6a) : this.body.clearTint());
    if (this.dying) {
      this.spin += dt * 4; this.extraRot = Math.sin(this.spin) * 0.6 + this.spin * 0.15;
      this.vy += 380 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.random() < dt * 6) scene.fx.explosion(this.x + rand(-80, 80), this.y + rand(-30, 30), { radius: 70 });
      super.update(0); // reposition sprites without moving
      if (this.y > this.groundY - 40) {
        scene.fx.explosion(this.x, this.groundY - 40, { radius: 340, damage: 0 });
        scene.fx.fireSource(this.x, this.groundY, 2.2, 0);
        scene.time.delayedCall(250, () => scene.fx.explosion(this.x + 90, this.groundY - 70, { radius: 220 }));
        const cb = this.onDefeated; this.destroy(); this.alive = false;
        if (cb) cb(this);
      }
      return;
    }
    if (!p) { this.update(dt); return; }
    // movement: reposition around the player
    this.repositionT -= dt;
    if (this.repositionT <= 0 && (!this.attack || this.attack.type !== 'strafe')) {
      this.repositionT = rand(3, 5) / (this.phase === 3 ? 1.5 : 1);
      const side = Math.random() < 0.5 ? -1 : 1;
      const tx = Math.max(this.bounds[0] + 200, Math.min(this.bounds[1] - 200, p.x + side * rand(320, 560)));
      this.moveTo(tx, this.groundY - rand(340, 460), 300 + this.phase * 40);
    }
    this.lockFacing = true;
    this.facing = p.x >= this.x ? 1 : -1;
    // spotlight on player
    this.searchTarget = { x: p.x, y: p.y - 40 };
    // attacks
    if (!this.attack) {
      this.attackT -= dt;
      if (this.attackT <= 0) {
        const opts = ['gun', 'rockets'];
        if (this.phase >= 2) opts.push('rappel', 'gun');
        if (this.phase >= 3) opts.push('strafe', 'rockets');
        const type = opts[Math.floor(Math.random() * opts.length)];
        this.startAttack(type);
      }
    } else this.runAttack(dt);
    this.update(dt);
  }

  startAttack(type) {
    const scene = this.scene; const p = scene.player;
    this.attack = { type, t: 0 };
    if (type === 'gun') { this.attack.dur = 2 + this.phase * 0.3; this.attack.aim = { x: p.x - this.facing * 260, y: p.y - 30 }; AudioEngine.play('warning'); }
    if (type === 'rockets') {
      const n = 2 + this.phase; this.attack.dur = 1.4 + n * 0.12; this.attack.marks = [];
      for (let i = 0; i < n; i++) {
        const mx = p.x + rand(-260, 260); const my = scene.groundBelow(mx, p.y - 200) ?? p.y;
        const m = scene.add.image(mx, my - 4, 'glow').setTint(0xff2a1a).setBlendMode('ADD').setScale(0.6, 0.18).setDepth(DEPTH.fx);
        scene.tweens.add({ targets: m, alpha: 0.3, yoyo: true, repeat: -1, duration: 120 });
        this.attack.marks.push({ x: mx, y: my, img: m, fired: false, at: 0.9 + i * 0.12 });
      }
      AudioEngine.play('warning');
      scene.hud && scene.hud.notify('INCOMING ROCKETS', '#ff4a3a');
    }
    if (type === 'rappel') {
      this.attack.dur = 4; this.moveTo(p.x + (Math.random() < 0.5 ? -1 : 1) * 380, this.groundY - 300, 320);
      this.scene.time.delayedCall(1300, () => { if (this.alive && !this.dying) this.rappel(this.phase === 3 ? ['rifleman', 'shotgunner', 'rifleman'] : ['rifleman', 'shotgunner']); });
    }
    if (type === 'strafe') {
      this.attack.dur = 3.4; const dir = p.x > this.x ? 1 : -1;
      this.followPath([{ x: p.x + dir * 700, y: this.groundY - 230 }], 560);
      AudioEngine.play('warning');
    }
  }

  runAttack(dt) {
    const a = this.attack; const scene = this.scene; const p = scene.player;
    a.t += dt;
    const gp = this.loc ? this.loc(175, 30) : { x: this.x, y: this.y };
    if (a.type === 'gun' || a.type === 'strafe') {
      // sweep aim toward player with lag (dodgeable by moving / cover)
      const tx = p.x, ty = p.y - 40;
      a.aim = a.aim || { x: tx, y: ty };
      a.aim.x += (tx - a.aim.x) * Math.min(1, dt * (a.type === 'strafe' ? 0.7 : 1.1));
      a.aim.y += (ty - a.aim.y) * Math.min(1, dt * 2);
      a.fireT = (a.fireT || 0) - dt;
      if (a.t > 0.9 && a.fireT <= 0) {
        a.fireT = 0.11;
        const ang = Math.atan2(a.aim.y - gp.y, a.aim.x - gp.x) + rand(-0.05, 0.05);
        scene.combat.fire({ x: gp.x, y: gp.y, angle: ang, speed: 1700, damage: 5, team: 'enemy', range: 1400, color: 0xff9a50, width: 2.5, knock: 160, weapon: 'heli', owner: this });
        scene.fx.muzzle(gp.x, gp.y, ang, 0.9);
        AudioEngine.play('minigun', { x: this.x, gap: 50 });
      }
      if (this.search) this.searchTarget = a.aim;
    }
    if (a.type === 'rockets') {
      for (const m of a.marks) {
        if (!m.fired && a.t >= m.at) {
          m.fired = true;
          const rp = this.loc ? this.loc(60, 40) : { x: this.x, y: this.y };
          const ang = Math.atan2(m.y - rp.y, m.x - rp.x);
          const r = scene.combat.rocket({ x: rp.x, y: rp.y, angle: ang, speed: 900, team: 'enemy', damage: 20, radius: 100, life: 3, owner: this, shootable: true });
          r.onDone = () => m.img.destroy();
          scene.time.delayedCall(1200, () => m.img.destroy());
        }
      }
    }
    if (a.t >= a.dur) {
      if (a.marks) for (const m of a.marks) if (m.img.active) m.img.destroy();
      this.attack = null; this.attackT = rand(2.2, 3.6) / (this.phase === 3 ? 1.25 : 1);
    }
  }
}
