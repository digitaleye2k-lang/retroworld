// AI soldier (enemy or allied). Patrol → suspicious → combat with cover usage, bursts and reloads.
import { Actor } from './Actor.js';
import { STYLES } from '../render/StickFigure.js';
import { WEAPONS, ENEMY_TYPES, DIFFICULTY, FONT, DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { SaveSystem } from '../core/SaveSystem.js';
import { lineOfSight } from '../systems/Combat.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Soldier extends Actor {
  constructor(scene, x, y, type, opts = {}) {
    const def = ENEMY_TYPES[type] || ENEMY_TYPES.rifleman;
    const diff = DIFFICULTY[SaveSystem.settings.difficulty] || DIFFICULTY.regular;
    const team = opts.team || 'enemy';
    const style = opts.style ? STYLES[opts.style] : team === 'player' ? Object.assign({}, STYLES.player, { rim: 0x4f8a6a, strobe: false, antenna: false }) : STYLES[def.gear];
    super(scene, x, y, { style, team, hp: (opts.hp || def.hp) * (team === 'enemy' ? diff.enemyHp : 1), facing: opts.facing || -1 });
    this.def = def; this.type = type; this.diff = diff;
    this.wdef = WEAPONS[opts.weapon || def.weapon];
    this.weaponShape = this.wdef.shape;
    this.isAlly = team === 'player';
    this.state = opts.state || (this.isAlly ? 'combat' : 'patrol');
    this.patrol = opts.patrol || null;
    this.home = x;
    this.awareness = this.state === 'combat' ? 1 : 0;
    this.reactT = def.reaction / 1000;
    this.burst = 0; this.fireT = 0; this.pauseT = rand(0.3, 1);
    this.shotsInMag = 0; this.magSize = this.wdef.id === 'e_lmg' ? 60 : this.wdef.id === 'e_sniper' ? 5 : this.wdef.id === 'e_shotgun' ? 6 : 30;
    this.reloadT = 0;
    this.cover = null; this.coverPhase = 0; this.coverT = 0;
    this.thinkT = 0; this.waitT = 0; this.patrolDir = this.facing;
    this.lastSeen = null; this.lostT = 0;
    this.aimTarget = this.aim; this.strafeT = 0; this.strafeDir = 0;
    this.laser = def.laser ? 0 : -1;
    this.armor = def.armor || 1;
    this.armorHead = type === 'heavy';
    this.lowered = this.state !== 'combat';
    this.target = null;
    this.speedMul = opts.speedMul || 1;
    this.holdPosition = opts.hold || false;
    this.noCover = opts.noCover || false;
    if (opts.flashlight && scene.lighting) {
      this.flash = scene.lighting.add({ x, y, cone: { angle: 0, len: 330, width: 150 }, i: 0.85, color: 0xfff2c8, glowAlpha: 0.12 });
    }
    this.mark = null;
    if (this.state === 'rappel') { this.body.setAllowGravity(false); this.lowered = true; }
  }

  isUnaware() { return !this.isAlly && this.state !== 'combat' && this.awareness < 0.7; }

  setMark(ch, color) {
    if (!ch) { if (this.mark) this.mark.setVisible(false); return; }
    if (!this.mark) this.mark = this.scene.add.text(0, 0, '', { fontFamily: FONT.title, fontSize: '22px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.fxTop);
    this.mark.setText(ch).setColor(color).setVisible(true);
  }

  alert(by) {
    if (!this.alive || this.state === 'scripted') return;
    if (this.state === 'rappel') { this.pendingAlert = true; return; }
    if (this.state !== 'combat') {
      this.state = 'combat'; this.awareness = 1; this.reactT = this.def.reaction / 1000 + rand(0, 0.3); this.lowered = false;
      this.setMark('!', '#ff4a3a'); this.scene.time.delayedCall(1200, () => { if (this.alive && this.mark) this.setMark(null); });
      if (this.scene.onEnemyAlerted) this.scene.onEnemyAlerted(this, by);
    }
  }

  hear(x, y, radius) {
    if (!this.alive || this.isAlly || this.state === 'scripted') return;
    const d = Math.hypot(x - this.x, y - this.y);
    if (d > radius) return;
    if (d < radius * 0.6 || this.state === 'suspicious') this.alert('noise');
    else { this.state = 'suspicious'; this.investigate = { x, y }; this.awareness = Math.max(this.awareness, 0.5); this.setMark('?', '#ffc34d'); }
  }

  pickTarget() {
    const scene = this.scene;
    if (this.isAlly) {
      let best = null, bd = 1e9;
      for (const e of scene.enemies) { if (!e.alive || e.state === 'rappel' || e.isHeli) continue; const d = Math.abs(e.x - this.x) + Math.abs(e.y - this.y) * 2; if (d < bd && d < 1100) { bd = d; best = e; } }
      return best;
    }
    const p = scene.player;
    let best = p && p.alive ? p : null; let bd = best ? Math.hypot(p.x - this.x, p.y - this.y) : 1e9;
    for (const a of scene.allies) { if (!a.alive || a.noTarget) continue; const d = Math.hypot(a.x - this.x, a.y - this.y) * 1.4; if (d < bd) { bd = d; best = a; } }
    return best;
  }

  canSee(t) {
    if (!t) return false;
    const e = this.eye(); const c = t.chest ? t.chest() : { x: t.x, y: t.y - 40 };
    const h = t.headCenter ? t.headCenter() : c;
    const solids = this.scene.solids;
    return lineOfSight(solids, e.x, e.y, c.x, c.y) || lineOfSight(solids, e.x, e.y, h.x, h.y);
  }

  perceive(dt) {
    const p = this.scene.player; if (!p || !p.alive) return;
    const dx = p.x - this.x, dy = p.y - this.y; const d = Math.hypot(dx, dy);
    const sight = this.def.sight * (this.scene.visibilityOf ? this.scene.visibilityOf(p) : 1);
    if (d > sight) { this.awareness = Math.max(0, this.awareness - dt * 0.25); return; }
    const inFront = dx * this.facing > 0 || d < 90;
    if (!inFront || !this.canSee(p)) { this.awareness = Math.max(0, this.awareness - dt * 0.2); return; }
    const rate = (1.5 - d / sight) * 1.6 * (p.crouching ? 0.6 : 1) * (Math.abs(p.body.velocity.x) > 100 ? 1.3 : 1);
    this.awareness += rate * dt;
    if (this.awareness > 0.35 && this.state === 'patrol') { this.state = 'suspicious'; this.setMark('?', '#ffc34d'); }
    if (this.state === 'suspicious') { this.investigate = { x: p.x, y: p.y }; }
    if (this.awareness >= 1) { this.alert('sight'); this.scene.alertNearby && this.scene.alertNearby(this, 520); }
  }

  update(dt) {
    this.updateBase(dt);
    if (!this.alive) return;
    if (this.flash) {
      this.flash.x = this.x + this.facing * 8; this.flash.y = this.y - 58;
      this.flash.cone.angle = this.state === 'combat' ? this.aim : (this.facing === 1 ? 0.25 : Math.PI - 0.25);
    }
    if (this.mark && this.mark.visible) this.mark.setPosition(this.x, this.y - 105 * this.S);
    if (this.mantleState) { this.updateMantle(dt); this.lowered = true; return; }
    switch (this.state) {
      case 'rappel': this.updateRappel(dt); break;
      case 'patrol': this.perceive(dt); this.updatePatrol(dt); break;
      case 'suspicious': this.perceive(dt); this.updateSuspicious(dt); break;
      case 'combat': this.updateCombat(dt); break;
      case 'scripted': default:
        if (this.scriptVx !== undefined) { this.body.setVelocityX(this.scriptVx); if (this.scriptVx) this.facing = Math.sign(this.scriptVx); }
        else this.body.setVelocityX(this.body.velocity.x * 0.8);
        break;
    }
    if (this.reloadT > 0) {
      this.reloadT -= dt; this.reload = 1 - Math.max(0, this.reloadT) / 2.2;
      if (this.reloadT <= 0) { this.reload = -1; this.shotsInMag = 0; }
    } else this.reload = -1;
    // smooth aim
    let d = this.aimTarget - this.aim; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const turn = (this.state === 'combat' ? 4.2 : 2) * dt;
    this.aim += Math.max(-turn, Math.min(turn, d));
    if (this.state !== 'combat' || !this.target) this.crouch += (0 - this.crouch) * Math.min(1, dt * 8);
  }

  updateRappel(dt) {
    this.body.setVelocity(0, 190);
    this.lowered = true; this.aimTarget = this.facing === 1 ? 0.6 : Math.PI - 0.6;
    const g = this.scene.groundBelow(this.x, this.y - 2);
    if (g !== null && this.y >= g - 4) {
      this.body.setAllowGravity(true); this.state = 'combat'; this.awareness = 1; this.lowered = false; this.reactT = 0.5;
      this.scene.fx.burst('dust', this.x, this.y, 5, -90, 160, 30, 80);
    }
  }

  moveToward(tx, speedMul = 1) {
    const dx = tx - this.x;
    if (Math.abs(dx) < 8) { this.body.setVelocityX(this.body.velocity.x * 0.7); return true; }
    const dir = Math.sign(dx);
    const spd = this.def.speed * this.speedMul * speedMul;
    // ledge check
    const ahead = this.scene.groundBelow(this.x + dir * 22, this.y - 6);
    if (ahead === null || ahead - this.y > 180) { this.body.setVelocityX(0); return true; }
    this.body.setVelocityX(dir * spd);
    const blocked = (dir < 0 && this.body.blocked.left) || (dir > 0 && this.body.blocked.right);
    if (blocked && this.onGround) {
      // climb over crates, sandbags and containers instead of getting stuck behind them
      const ledge = this.findLedge(dir, 150);
      if (ledge) { this.startMantle(ledge, dir); return false; }
      this.body.setVelocityX(0);
      return true;   // impassable: callers treat this as 'arrived' (patrols turn around)
    }
    return false;
  }

  updatePatrol(dt) {
    this.lowered = true;
    this.aimTarget = this.facing === 1 ? 0.35 : Math.PI - 0.35;
    if (!this.patrol) { this.body.setVelocityX(0); this.lookT = (this.lookT || rand(3, 6)) - dt; if (this.lookT <= 0) { this.lookT = rand(3, 7); this.facing *= -1; } return; }
    if (this.waitT > 0) { this.waitT -= dt; this.body.setVelocityX(0); if (this.waitT <= 0) this.patrolDir *= -1; return; }
    const tx = this.patrolDir > 0 ? this.patrol[1] : this.patrol[0];
    this.facing = this.patrolDir;
    if (this.moveToward(tx, 0.42)) this.waitT = rand(1.4, 3);
  }

  updateSuspicious(dt) {
    this.lowered = false;
    const t = this.investigate;
    if (t) {
      this.facing = t.x >= this.x ? 1 : -1;
      this.aimTarget = Math.atan2(t.y - 50 - (this.y - 60), t.x - this.x);
      if (Math.abs(t.x - this.x) > 60) this.moveToward(t.x, 0.5); else this.body.setVelocityX(0);
    }
    this.susT = (this.susT || 0) + dt;
    if (this.susT > 7 && this.awareness < 0.3) { this.state = 'patrol'; this.susT = 0; this.setMark(null); this.investigate = null; }
  }

  findCover(target) {
    if (this.noCover) return null;
    let best = null, bd = 1e9;
    for (const c of this.scene.covers) {
      if (c.taken && c.taken !== this) continue;
      if (c.dead) continue;
      const side = target.x > c.x + c.w / 2 ? -1 : 1; // stand on side away from target
      const sx = side < 0 ? c.x - 16 : c.x + c.w + 16;
      if (Math.abs(this.y - (c.y + c.h)) > 30) continue;
      const dToTarget = Math.abs(target.x - sx);
      if (dToTarget < 140 || dToTarget > this.def.prefer[1] + 250) continue;
      const d = Math.abs(sx - this.x);
      if (d < 420 && d < bd) { bd = d; best = { c, x: sx }; }
    }
    return best;
  }

  updateCombat(dt) {
    const scene = this.scene;
    if (scene.cinematic && !this.cineActive) { this.body.setVelocityX(this.body.velocity.x * 0.8); this.burst = 0; this.laser = this.laser >= 0 ? 0 : -1; return; }
    this.thinkT -= dt;
    if (!this.target || !this.target.alive || this.thinkT <= 0) { this.target = this.pickTarget(); this.thinkT = rand(0.6, 1.2); }
    const t = this.target;
    const pl = scene.player;
    if (this.isAlly && pl && pl.alive && !pl.controlsLocked) {
      // allies stay with the player instead of charging ahead
      const lead = this.x - pl.x;
      if (lead > 260 || lead < -420 || !t) {
        this.lowered = !t; if (t) this.facing = t.x >= this.x ? 1 : -1;
        this.moveToward(pl.x - pl.facing * (90 + (this.allyIdx || 0) * 50), 1.3); this.crouch *= 0.8;
        if (!t) return;
      }
    }
    if (!t) { this.body.setVelocityX(this.body.velocity.x * 0.8); this.lowered = true; return; }
    this.lowered = false;
    const see = this.canSee(t);
    const tc = t.chest ? t.chest() : { x: t.x, y: t.y - 45 };
    if (see) { this.lastSeen = { x: t.x, y: t.y }; this.lostT = 0; } else this.lostT += dt;
    const aimPt = see ? tc : this.lastSeen ? { x: this.lastSeen.x, y: this.lastSeen.y - 45 } : tc;
    const eye = { x: this.x, y: this.y - (60 - this.crouch * 15) * this.S };
    this.facing = aimPt.x >= this.x ? 1 : -1;
    const dist = Math.abs(t.x - this.x);

    // positioning
    const [pmin, pmax] = this.def.prefer;
    let wantCrouch = false;
    if (this.type === 'sniper' || this.holdPosition) {
      this.body.setVelocityX(0);
      wantCrouch = this.type === 'sniper' && this.reactT > 0.5 && this.laser <= 0;
    } else if (this.type === 'shotgunner') {
      if (dist > pmin) this.moveToward(t.x, 1); else this.body.setVelocityX(0);
    } else {
      // cover logic
      if (this.cover && (this.cover.c.dead || Math.abs((t.x > this.cover.c.x ? -1 : 1) - (this.cover.x < this.cover.c.x ? -1 : 1)) > 0)) { this.cover.c.taken = null; this.cover = null; }
      if (!this.cover && this.reloadT <= 0 && Math.random() < dt * 0.8) { this.cover = this.findCover(t); if (this.cover) this.cover.c.taken = this; }
      if (this.cover) {
        const arrived = this.moveToward(this.cover.x, 1.1);
        if (arrived) {
          this.coverT -= dt;
          if (this.coverT <= 0) { this.coverPhase = this.coverPhase ? 0 : 1; this.coverT = this.coverPhase ? rand(1.4, 2.6) : rand(1.0, 2.2); }
          wantCrouch = this.coverPhase === 0 || this.reloadT > 0;
          if (dist < 120 && Math.random() < dt) { this.cover.c.taken = null; this.cover = null; }
        }
      } else {
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeT = rand(0.8, 2.2); this.strafeDir = Math.random() < 0.45 ? 0 : Math.random() < 0.5 ? -1 : 1; }
        if (!see && this.lastSeen && this.lostT > 1.5) this.moveToward(this.lastSeen.x, 0.8);
        else if (dist > pmax) this.moveToward(t.x, 1);
        else if (dist < pmin) this.moveToward(this.x - Math.sign(t.x - this.x) * 120, 0.8);
        else if (this.strafeDir) this.moveToward(this.x + this.strafeDir * 60, 0.5);
        else this.body.setVelocityX(this.body.velocity.x * 0.8);
        if (this.reloadT > 0) wantCrouch = true;
      }
    }
    this.crouch += ((wantCrouch ? 1 : 0) - this.crouch) * Math.min(1, dt * 10);

    // aiming with error
    const acc = this.isAlly ? 1 : this.diff.enemyAcc;
    const errScale = (this.wdef.spread + 0.02) / acc * (this.isAlly ? 1 : (scene.aimErrMul || 1));
    this.aimErrT = (this.aimErrT || 0) - dt;
    if (this.aimErrT <= 0) { this.aimErrT = rand(0.25, 0.6); this.aimErr = (Math.random() - 0.5) * 2 * errScale * (t.isPlayer && Math.abs(t.body.velocity.x) > 120 ? 1.5 : 1); }
    this.aimTarget = Math.atan2(aimPt.y - eye.y, aimPt.x - eye.x) + (this.aimErr || 0);

    // firing
    this.reactT -= dt;
    if (this.reloadT > 0 || this.reactT > 0 || dist > this.wdef.range) { this.laser = this.laser >= 0 ? 0 : -1; return; }
    if (this.type === 'sniper') {
      if (see && !wantCrouch) {
        this.laser += dt / 1.7;
        if (this.laser >= 1) { this.fireShot(t); this.laser = 0; this.reactT = rand(1.2, 2.2); }
      } else { this.laser = Math.max(0, this.laser - dt); if (!see && Math.random() < dt * 0.5) this.crouch = 0; }
      return;
    }
    const exposed = !(this.cover && this.coverPhase === 0) || this.crouch < 0.3;
    if (this.burst > 0) {
      this.fireT -= dt * 1000;
      if (this.fireT <= 0 && exposed) { this.fireShot(t); this.burst--; this.fireT = this.wdef.rate * rand(0.9, 1.3); if (this.burst === 0) this.pauseT = rand(0.5, 1.4) / (this.isAlly ? 1 : acc); }
    } else {
      this.pauseT -= dt;
      if (this.pauseT <= 0 && (see || (this.lostT < 1.2 && this.lastSeen)) && exposed) {
        const [a, b] = this.wdef.burst; this.burst = Math.round(rand(a, b));
      }
    }
  }

  fireShot(t) {
    if (this.shotsInMag >= this.magSize) { this.reloadT = 2.2; this.burst = 0; AudioEngine.play('reload', { x: this.x, dur: 2.2, vol: 0.5 }); return; }
    this.shotsInMag++;
    const scene = this.scene; const pose = this.lastPose;
    let mx = this.x + this.facing * 30, my = this.y - 55;
    if (pose && pose.muzzle) { mx = pose.muzzle.x; my = pose.muzzle.y; }
    const sh = pose ? pose.shoulder : { x: this.x, y: this.y - 55 };
    if (!lineOfSight(scene.solids, sh.x, sh.y, mx, my)) { mx = sh.x; my = sh.y; }
    const w = this.wdef; const pellets = w.pellets || 1;
    const ang = pose ? pose.weaponAngle : this.aim;
    for (let i = 0; i < pellets; i++) {
      const sp = pellets > 1 ? (Math.random() - 0.5) * w.spread : (Math.random() - 0.5) * w.spread * 0.4;
      scene.combat.fire({ x: mx, y: my, angle: ang + sp, speed: w.speed, damage: w.damage * (this.isAlly ? 0.45 : 1), team: this.team, range: w.range + 200, color: this.isAlly ? 0xffe0a0 : w.tracer, width: w.id === 'e_sniper' ? 3 : 2, penetration: 1, headMult: 1.5, knock: 140, weapon: w.id, owner: this });
    }
    scene.fx.muzzle(mx, my, ang, w.id === 'e_shotgun' ? 1.2 : 0.85);
    scene.fx.casing(this.x + this.facing * 6, this.y - 52, this.facing, w.id === 'e_shotgun');
    this.recoil = 1;
    AudioEngine.play(w.sound === 'shotgun' ? 'shotgun' : w.sound, { x: this.x, vol: this.isAlly ? 0.5 : 0.8, gap: 25 });
  }

  damageMod(dmg, info) {
    let d = dmg;
    if (info.part !== 'head') d *= this.armor;
    else if (this.armorHead && info.weapon !== 'sniper') d *= 0.6;
    if (this.isAlly) d *= 0.35;
    return d;
  }

  onDamaged(dmg, info) {
    if (this.state !== 'combat' && this.state !== 'scripted' && this.state !== 'rappel' && !info.silent) this.alert('shot');
    if (this.cover && Math.random() < 0.3) this.coverPhase = 0;
  }

  onDeath(info) {
    if (this.flash && this.scene.lighting) { this.scene.lighting.remove(this.flash); this.flash = null; }
    if (this.mark) { this.mark.destroy(); this.mark = null; }
    if (this.cover) this.cover.c.taken = null;
    if (this.scene.onSoldierKilled) this.scene.onSoldierKilled(this, info);
  }

  draw() {
    super.draw();
    if (this.alive && this.laser > 0 && this.lastPose && this.lastPose.muzzle) {
      const m = this.lastPose.muzzle; const a = this.lastPose.weaponAngle; const g = this.gfx;
      const len = 1600; const col = this.laser > 0.75 ? 0xff2020 : 0xff6040;
      // clip laser at first solid
      let ex = m.x + Math.cos(a) * len, ey = m.y + Math.sin(a) * len;
      const hit = this.scene.raycast(m.x, m.y, ex, ey);
      if (hit) { ex = hit.x; ey = hit.y; }
      g.lineStyle(1.5 + this.laser * 1.5, col, 0.35 + this.laser * 0.5); g.lineBetween(m.x, m.y, ex, ey);
      g.fillStyle(col, 0.9); g.fillCircle(ex, ey, 2.5 + this.laser * 2);
      if (Math.random() < 0.1 && this.laser > 0.75) AudioEngine.play('beep', { x: this.x, gap: 200 });
    }
  }

  destroy() {
    if (this.flash && this.scene.lighting) this.scene.lighting.remove(this.flash);
    if (this.mark) this.mark.destroy();
    super.destroy();
  }
}
