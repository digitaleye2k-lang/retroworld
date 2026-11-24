// Juggernaut boss ("THE WARDEN") and the rescued informant companion.
import { Soldier } from './Soldier.js';
import { Actor } from './Actor.js';
import { STYLES } from '../render/StickFigure.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { DIFFICULTY } from '../config.js';
import { SaveSystem } from '../core/SaveSystem.js';
import { lineOfSight } from '../systems/Combat.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Juggernaut extends Soldier {
  constructor(scene, x, y, opts = {}) {
    super(scene, x, y, 'heavy', Object.assign({ style: 'boss', weapon: 'e_minigun', hp: 1700, state: 'scripted', facing: -1, noCover: true }, opts));
    this.isBoss = true; this.name = 'THE WARDEN';
    this.maxHp = this.hp;
    this.armor = 0.45; this.armorHead = true;
    this.mode = 'idle'; this.modeT = 2; this.spin = 0; this.phase = 1; this.staggerAcc = 0;
    this.def = Object.assign({}, this.def, { speed: 85 });
  }

  damageMod(dmg, info) {
    let d = dmg;
    if (info.part === 'head') d *= info.weapon === 'sniper' ? 1.2 : 0.85;
    else d *= info.explosive ? 0.9 : this.armor;
    if (this.mode === 'stagger') d *= 1.6;
    return d;
  }

  onDamaged(dmg) {
    this.staggerAcc += dmg;
    if (this.staggerAcc > this.maxHp * 0.16 && this.mode !== 'stagger' && this.mode !== 'charge') {
      this.staggerAcc = 0; this.setMode('stagger', 1.3);
      AudioEngine.play('hitmetal', { x: this.x });
      this.scene.hud && this.scene.hud.notify('ARMOUR CRACKED — HIT HIM NOW!', '#ffc34d');
    }
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) { this.phase = 2; if (this.onPhase2) this.onPhase2(); }
  }

  setMode(m, t) { this.mode = m; this.modeT = t; if (m !== 'fire') this.spin = 0; this.burstFire = 0; }

  update(dt) {
    this.updateBase(dt);
    if (!this.alive) return;
    if (this.reloadT > 0) this.reloadT -= dt;
    if (this.mantleState) { this.updateMantle(dt); return; }
    if (this.state === 'scripted') { this.body.setVelocityX(0); return; }
    const p = this.scene.player; if (!p || !p.alive) { this.body.setVelocityX(0); return; }
    const dx = p.x - this.x, dist = Math.abs(dx);
    this.facing = dx >= 0 ? 1 : -1;
    const tc = p.chest();
    const eye = { x: this.x, y: this.y - 80 };
    const want = Math.atan2(tc.y - eye.y, tc.x - eye.x);
    this.modeT -= dt;
    const aggro = this.phase === 2 ? 1.35 : 1;
    switch (this.mode) {
      case 'idle':
        this.lowered = false;
        this.moveToward(p.x - this.facing * 300, 0.8);
        this.aimTarget = want;
        if (this.modeT <= 0) {
          if (dist < 230) this.setMode('charge', 0.9);
          else if (Math.random() < 0.3) this.setMode('grenade', 1.2);
          else { this.setMode('fire', (2.6 + Math.random()) * aggro); AudioEngine.play('warning', { x: this.x }); }
        }
        break;
      case 'fire': {
        this.body.setVelocityX(this.facing * 25 * aggro);
        this.spin += dt;
        // sweep aim with lag: player can outrun the stream
        let d = want - this.aimTarget; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        this.aimTarget += Math.max(-1.1 * dt * aggro, Math.min(1.1 * dt * aggro, d));
        if (this.spin > 0.75) {
          this.fireT -= dt * 1000;
          if (this.fireT <= 0) { this.fireT = 55 / aggro; this.shotsInMag = 0; this.fireShot(p); }
        } else if (Math.random() < dt * 10) AudioEngine.play('hack', { x: this.x, gap: 40 });
        if (this.modeT <= 0) this.setMode('idle', rand(1.0, 1.8) / aggro);
        break;
      }
      case 'grenade':
        this.body.setVelocityX(0); this.throwing = Math.max(this.throwing, 0.5);
        if (!this.thrown && this.modeT < 0.8) {
          this.thrown = true;
          const n = this.phase === 2 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const tx = p.x + rand(-120, 120); const t = 1.0 + i * 0.15;
            const vx = (tx - this.x) / t, vy = (p.y - 60 - (this.y - 100)) / t - 0.5 * 1500 * t;
            this.scene.combat.grenade({ x: this.x, y: this.y - 100, vx, vy, team: 'enemy', fuse: 1.6 + i * 0.2, damage: 70, radius: 150, owner: this });
          }
        }
        if (this.modeT <= 0) { this.thrown = false; this.setMode('idle', rand(0.8, 1.4)); }
        break;
      case 'charge':
        this.lowered = true;
        if (this.modeT > 0.6) { this.body.setVelocityX(0); this.crouch = 0.4; }
        else {
          this.crouch = 0; this.body.setVelocityX(this.facing * 560);
          if (!this.hitPlayer && dist < 60 && Math.abs(p.y - this.y) < 60) {
            this.hitPlayer = true; this.melee = 1;
            p.takeDamage(32, { x: this.x, y: this.y - 50, angle: this.facing === 1 ? 0 : Math.PI, part: 'body', team: 'enemy' });
            p.body.setVelocity(this.facing * 520, -320);
            AudioEngine.play('door', { x: this.x }); this.scene.fx.shake(250, 0.012);
          }
        }
        if (this.modeT <= 0 || this.body.blocked.left || this.body.blocked.right) { this.hitPlayer = false; this.setMode('idle', rand(1, 1.6)); }
        break;
      case 'stagger':
        this.body.setVelocityX(this.body.velocity.x * 0.85); this.lowered = true; this.crouch = 0.6; this.lean = -this.facing * 6;
        if (this.modeT <= 0) { this.crouch = 0; this.setMode('idle', 0.6); }
        break;
    }
    let d = this.aimTarget - this.aim; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    this.aim += Math.max(-5 * dt, Math.min(5 * dt, d));
    this.recoil = this.mode === 'fire' && this.spin > 0.75 ? 0.5 + Math.random() * 0.5 : this.recoil;
  }

  onDeath(info) {
    super.onDeath(info);
    this.scene.setSlowmo(0.25, 2200);
    this.scene.fx.explosion(this.x, this.y - 60, { radius: 110 });
    if (this.onDefeated) this.onDefeated(this);
  }
}

// SPARROW: captive → follower companion
export class Informant extends Actor {
  constructor(scene, x, y) {
    super(scene, x, y, { style: STYLES.informant, team: 'player', hp: 400, facing: -1 });
    this.isInformant = true; this.noTarget = true;
    this.weaponShape = null; this.state = 'captive'; this.seated = true; this.handsUp = true;
    this.hidePoint = null;
  }
  damageMod(d) { return d * 0.25; }
  free() { this.state = 'follow'; this.seated = false; this.handsUp = false; }
  hideAt(x) { this.state = 'hide'; this.hidePoint = x; }
  update(dt) {
    this.updateBase(dt);
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + dt * 15);
    const p = this.scene.player;
    if (this.state === 'captive') { this.body.setVelocityX(0); return; }
    if (this.state === 'script') { this.body.setVelocityX(this.scriptVx || 0); if (this.scriptVx) this.facing = Math.sign(this.scriptVx); return; }
    if (this.mantleState) { this.updateMantle(dt); return; }
    let tx = null;
    if (this.state === 'follow' && p) {
      const off = -p.facing * 70; tx = p.x + off;
      if (Math.abs(p.x - this.x) < 90) tx = null;
    } else if (this.state === 'hide') tx = this.hidePoint;
    if (tx !== null && Math.abs(tx - this.x) > 12) {
      const dir = Math.sign(tx - this.x); const far = Math.abs(tx - this.x) > 300;
      this.body.setVelocityX(dir * (far ? 260 : 170)); this.facing = dir;
      const blocked = (dir < 0 && this.body.blocked.left) || (dir > 0 && this.body.blocked.right);
      if (blocked && this.onGround) { const l = this.findLedge(dir, 150); if (l) this.startMantle(l, dir); else this.body.setVelocityY(-600); }
      else if (p && p.y < this.y - 60 && Math.abs(p.x - this.x) < 160 && this.onGround) { const l = this.findLedge(dir, 150); if (l) this.startMantle(l, dir); }
      if (far && p && Math.abs(p.x - this.x) > 900 && this.state === 'follow') this.setPosition(p.x - p.facing * 60, p.y);
    } else this.body.setVelocityX(this.body.velocity.x * 0.7);
    this.crouch += ((this.state === 'hide' && tx !== null && Math.abs(tx - this.x) < 20 ? 1 : 0) - this.crouch) * Math.min(1, dt * 8);
    this.aim = this.facing === 1 ? 0.6 : Math.PI - 0.6;
  }
  onDeath() { if (this.scene.failMission) this.scene.failMission('SPARROW WAS KILLED'); }
}
