// Player soldier: input, movement, weapons, grenades, melee takedowns, interaction.
import { Actor } from './Actor.js';
import { STYLES } from '../render/StickFigure.js';
import { WEAPONS, PLAYER_LOADOUT, DIFFICULTY } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { SaveSystem } from '../core/SaveSystem.js';
import { lineOfSight } from '../systems/Combat.js';

const SPEED = 245, JUMP = 600;

export class Player extends Actor {
  constructor(scene, x, y, opts = {}) {
    const armor = SaveSystem.upgrade('armor');
    super(scene, x, y, { style: STYLES.player, team: 'player', hp: 100 + armor * 25 });
    this.isPlayer = true;
    this.diff = DIFFICULTY[SaveSystem.settings.difficulty] || DIFFICULTY.regular;
    this.reloadMult = SaveSystem.upgrade('hands') ? 0.75 : 1;
    this.magMult = SaveSystem.upgrade('ammo') ? 1.3 : 1;
    this.regenRate = SaveSystem.upgrade('medic') ? 34 : 20;
    this.loadout = opts.loadout || PLAYER_LOADOUT.slice();
    this.ammo = {};
    for (const id of this.loadout) this.giveWeapon(id, true);
    this.current = opts.weapon || this.loadout[0];
    this.last = this.loadout[1] || this.current;
    this.weaponShape = WEAPONS[this.current].shape;
    this.cooldown = 0; this.switchT = 0; this.reloadT = 0; this.reloading = false;
    this.kick = 0; this.spreadNow = 0.02;
    this.grenades = 3 + SaveSystem.upgrade('grenades') * 2;
    this.lastDamage = -10000; this.coyote = 0; this.jumpBuf = 0;
    this.ads = false; this.steady = 1; this.breath = 100;
    this.interactT = 0; this.interactTarget = null;
    this.controlsLocked = false;
    this.noise = 0;
    this.stats = { shots: 0, hits: 0, kills: 0, headshots: 0 };
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,SPACE,R,E,G,F,Q,SHIFT,ONE,TWO,THREE,FOUR,FIVE');
    this.wheelHandler = (pointer, objs, dx, dy) => { if (!this.controlsLocked && this.alive) this.cycleWeapon(dy > 0 ? 1 : -1); };
    scene.input.on('wheel', this.wheelHandler);
    this.downHandler = (ptr) => { if (ptr.button === 0) this.clickQueued = true; };
    scene.input.on('pointerdown', this.downHandler);
    this.nvgDown = scene.theme === 'night';
  }

  giveWeapon(id, initial) {
    const w = WEAPONS[id];
    if (!this.loadout.includes(id)) this.loadout.push(id);
    const mag = Math.round(w.mag * (id === 'launcher' ? 1 : this.magMult));
    if (!this.ammo[id]) this.ammo[id] = { mag, max: mag, reserve: w.reserve };
    else this.ammo[id].reserve += w.reserve;
    if (!initial) { this.switchTo(id); }
  }

  get weapon() { return WEAPONS[this.current]; }

  switchTo(id) {
    if (!this.loadout.includes(id) || id === this.current) return;
    this.last = this.current; this.current = id; this.weaponShape = WEAPONS[id].shape;
    this.switchT = 0.32; this.reloading = false; this.reload = -1;
    AudioEngine.play('switch', { x: this.x });
  }

  cycleWeapon(d) {
    const i = this.loadout.indexOf(this.current);
    this.switchTo(this.loadout[(i + d + this.loadout.length) % this.loadout.length]);
  }

  startReload() {
    const a = this.ammo[this.current];
    if (this.reloading || a.mag >= a.max || a.reserve <= 0) return;
    this.reloading = true; this.reloadT = 0;
    this.reloadDur = this.weapon.reload * this.reloadMult / 1000;
    this.reloadSound(this.reloadDur, a.max - a.mag);
  }

  reloadSound(dur, need) {
    const id = this.current; const A = AudioEngine;
    if (id === 'shotgun' && A.hasSample('shell_load')) {
      const n = Math.max(1, Math.min(need, 4));
      for (let i = 0; i < n; i++) this.scene.time.delayedCall((0.15 + i * (dur * 0.7) / n) * 1000, () => { if (this.reloading) A.play('shell_load', { x: this.x, gap: 0 }); });
      this.scene.time.delayedCall(dur * 0.88 * 1000, () => { if (this.reloading) A.play('pump', { x: this.x }); });
      return;
    }
    const map = { rifle: 'reload_rifle', pistol: 'reload_pistol', sniper: 'reload_sniper', launcher: 'reload_sniper' };
    const g = map[id];
    if (g && A.hasSample(g)) A.play(g, { x: this.x, rate: Phaser.Math.Clamp((id === 'rifle' ? 2.5 : id === 'pistol' ? 1.6 : 1.97) / dur, 0.85, 1.4) });
    else A.play('reload', { x: this.x, dur });
  }

  pointerWorld() {
    const p = this.scene.input.activePointer; const cam = this.scene.cameras.main;
    return cam.getWorldPoint(p.x, p.y);
  }

  update(dt) {
    this.updateBase(dt);
    if (!this.alive) return;
    const k = this.keys; const scene = this.scene; const body = this.body;
    const locked = this.controlsLocked;
    const pointer = scene.input.activePointer;
    // aim
    const wp = this.pointerWorld();
    const sh = { x: this.x, y: this.y - (60 - this.crouch * 15) };
    if (this.mantleState) { this.facing = this.mantleState.dir; }
    else if (this.scriptFacing) { this.facing = this.scriptFacing; this.aim = this.facing === 1 ? 0.5 : Math.PI - 0.5; }
    else if (!locked || this.aimWhileLocked) {
      this.facing = wp.x >= this.x ? 1 : -1;
      this.aim = Math.atan2(wp.y - sh.y, wp.x - sh.x) - this.kick * this.facing;
    }
    this.kick *= Math.max(0, 1 - dt * 7);
    this.ads = !locked && pointer.rightButtonDown();

    // movement
    let mx = 0;
    if (!locked) { if (k.A.isDown) mx -= 1; if (k.D.isDown) mx += 1; }
    if (!locked && (Phaser.Input.Keyboard.JustDown(k.W) || Phaser.Input.Keyboard.JustDown(k.SPACE))) this.jumpBuf = 0.14; else this.jumpBuf -= dt;
    this.busy = false;
    if (this.mantleState) { this.updateMantle(dt); this.busy = true; this.crouch += (0 - this.crouch) * Math.min(1, dt * 10); }
    else if (this.climbing) { this.updateLadder(dt, mx, locked); this.busy = !!this.climbing; }
    else {
      const wantCrouch = (!locked && k.S.isDown && this.onGround) || !!this.scriptCrouch;
      this.crouch += ((wantCrouch ? 1 : 0) - this.crouch) * Math.min(1, dt * 14);
      let spd = SPEED * (this.crouching ? 0.45 : 1) * (this.ads ? 0.6 : 1) * (this.reloading ? 0.85 : 1);
      if (this.current === 'launcher') spd *= 0.85;
      const target = this.scriptVx !== undefined ? this.scriptVx : mx * spd;
      const accel = this.onGround ? (mx === 0 ? 16 : 15) : 8;
      body.setVelocityX(body.velocity.x + (target - body.velocity.x) * Math.min(1, dt * accel));
      if (this.onGround) this.coyote = 0.1; else this.coyote -= dt;
      // ladders: W climbs up, S climbs down from the top
      const lad = !locked ? this.ladderAt() : null;
      if (lad && ((k.W.isDown && this.y > lad.top + 6) || (k.S.isDown && this.y <= lad.top + 8))) { this.grabLadder(lad); this.jumpBuf = 0; }
      // mantling / vaulting / ledge grabs
      const blockedDir = mx > 0 ? body.blocked.right : mx < 0 ? body.blocked.left : false;
      if (!locked && !this.climbing && mx !== 0) {
        let ledge = null;
        if (this.jumpBuf > 0 && this.coyote > 0) ledge = this.findLedge(mx, 150, 44);                 // jump at a wall -> climb it
        else if (blockedDir && this.onGround && !this.crouching) {
          ledge = this.findLedge(mx, 75);                                                              // run into low cover -> vault
          this.blockT = (this.blockT || 0) + dt;
          if (!ledge && this.blockT > 0.18) ledge = this.findLedge(mx, 150);                          // keep pushing -> climb it
        }
        else if (blockedDir && !this.onGround && body.velocity.y > -260) ledge = this.findLedge(mx, 150); // grab ledge mid-air
        if (!blockedDir) this.blockT = 0;
        if (ledge) { this.startMantle(ledge, mx); this.jumpBuf = 0; this.busy = true; this.blockT = 0; }
      }
      if (!this.mantleState && !this.climbing) {
        if (this.jumpBuf > 0 && this.coyote > 0) {
          if (k.S.isDown && this.standingOnOneWay()) { this.dropping = 0.3; this.jumpBuf = 0; }
          else { body.setVelocityY(-JUMP); this.coyote = 0; this.jumpBuf = 0; AudioEngine.play('jump', { x: this.x }); this.scene.fx.burst('dust', this.x, this.y, 3, -90, 120, 20, 60); }
        }
        if (!locked && !k.W.isDown && !k.SPACE.isDown && body.velocity.y < -200) body.setVelocityY(body.velocity.y * 0.88); // variable jump
      }
    }

    // weapon switching
    if (!locked) {
      const slots = [k.ONE, k.TWO, k.THREE, k.FOUR, k.FIVE];
      slots.forEach((key, i) => { if (Phaser.Input.Keyboard.JustDown(key)) { const id = this.loadout.find((w) => WEAPONS[w].slot === i + 1); if (id) this.switchTo(id); } });
      if (Phaser.Input.Keyboard.JustDown(k.Q)) this.switchTo(this.last);
      if (Phaser.Input.Keyboard.JustDown(k.R)) this.startReload();
      if (Phaser.Input.Keyboard.JustDown(k.G)) this.throwGrenade(wp);
      if (Phaser.Input.Keyboard.JustDown(k.F)) this.meleeAttack();
    }
    // breath / steady aim (Shift)
    if (this.ads && k.SHIFT.isDown && this.breath > 0) { this.breath = Math.max(0, this.breath - dt * 35); this.steady = 0.15; }
    else { this.breath = Math.min(100, this.breath + dt * 20); this.steady = 1; }

    // reload progress
    if (this.reloading) {
      this.reloadT += dt;
      this.reload = Math.min(1, this.reloadT / this.reloadDur);
      if (this.reloadT >= this.reloadDur) {
        const a = this.ammo[this.current]; const need = a.max - a.mag; const take = Math.min(need, a.reserve);
        a.mag += take; a.reserve -= take; this.reloading = false; this.reload = -1;
      }
    } else this.reload = -1;

    this.switchT = Math.max(0, this.switchT - dt);
    this.lowered = this.switchT > 0.12 || !!this.scriptLowered;
    this.cooldown -= dt * 1000;

    // shooting
    const w = this.weapon;
    const clicked = this.clickQueued; this.clickQueued = false;
    if (clicked && this.cooldown > 0 && !w.auto) this.bufferedShot = 0.25;
    this.bufferedShot = Math.max(0, (this.bufferedShot || 0) - dt);
    const firing = !locked && !this.busy && (pointer.leftButtonDown() || clicked || this.bufferedShot > 0) && !scene.uiBlocking;
    if (firing && this.switchT <= 0) {
      const a = this.ammo[this.current];
      if (this.reloading) { /* wait */ }
      else if (a.mag <= 0) { if (this.cooldown <= 0) { AudioEngine.play('dry', { x: this.x }); this.cooldown = 300; this.startReload(); } }
      else if (this.cooldown <= 0 && (w.auto || !this.triggerHeld || clicked || this.bufferedShot > 0)) { this.bufferedShot = 0; this.shoot(); }
    }
    this.triggerHeld = pointer.leftButtonDown();

    // spread
    const moveSpread = Math.min(1, Math.abs(body.velocity.x) / SPEED) * 0.03 + (this.onGround ? 0 : 0.05);
    const base = (this.ads ? w.adsSpread : w.spread) * (this.crouching ? 0.7 : 1);
    this.spreadNow += ((base + moveSpread * (this.ads ? 0.5 : 1)) - this.spreadNow) * Math.min(1, dt * 10);

    // health regen
    const regenDelay = this.diff.regenDelay;
    if (scene.time.now - this.lastDamage > regenDelay && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    if (this.hp < this.maxHp * 0.3) { this.hbT = (this.hbT || 0) - dt; if (this.hbT <= 0) { this.hbT = 0.9; AudioEngine.play('heartbeat'); } }

    // interaction
    this.updateInteract(dt, locked);
    this.noise = Math.max(0, this.noise - dt * 1500);
  }

  ladderAt() {
    for (const l of this.scene.ladders || []) if (Math.abs(this.x - l.x) < 22 && this.y >= l.top - 6 && this.y <= l.bottom + 6) return l;
    return null;
  }

  grabLadder(l) {
    this.climbing = l; this.body.setAllowGravity(false); this.body.setVelocity(0, 0);
    this.body.reset(l.x, this.y - this.bh / 2); this.crouch = 0;
  }

  leaveLadder(jump, mx) {
    this.climbing = null; this.body.setAllowGravity(true); this.dropping = 0;
    if (jump) this.body.setVelocity(mx * 180, -380);
  }

  updateLadder(dt, mx, locked) {
    const l = this.climbing; const k = this.keys;
    const vy = locked ? 0 : k.W.isDown ? -175 : k.S.isDown ? 175 : 0;
    this.body.setVelocity(0, vy);
    this.dropping = 0.15;            // pass through catwalks while on the ladder
    const prev = this.climbPhase; this.climbPhase += dt * Math.abs(vy) * 0.05;
    if (Math.floor(prev / Math.PI) !== Math.floor(this.climbPhase / Math.PI)) AudioEngine.play('ladder', { x: this.x, gap: 120 });
    if (vy < 0 && this.y <= l.top) { this.body.reset(l.x, l.top - this.bh / 2); this.leaveLadder(false); return; }
    if (vy > 0 && this.y >= l.bottom) { this.leaveLadder(false); return; }
    if (!locked && this.jumpBuf > 0) { this.jumpBuf = 0; this.leaveLadder(true, mx || this.facing); }
  }

  standingOnOneWay() {
    for (const s of this.scene.solids) if (s.oneWay && Math.abs(this.y - s.y) < 4 && this.x > s.x && this.x < s.x + s.w) return true;
    return false;
  }

  shoot() {
    const w = this.weapon; const a = this.ammo[this.current]; const scene = this.scene;
    a.mag--; this.cooldown = w.rate;
    const pose = this.lastPose;
    let mx = this.x + this.facing * 30, my = this.y - 55;
    let ang = pose ? pose.weaponAngle : this.aim;
    if (pose && pose.muzzle) { mx = pose.muzzle.x; my = pose.muzzle.y; }
    // prevent shooting through walls when muzzle clips into geometry
    const sh = pose ? pose.shoulder : { x: this.x, y: this.y - 55 };
    if (!lineOfSight(scene.solids, sh.x, sh.y, mx, my)) { mx = sh.x; my = sh.y; }
    // aim exactly at cursor from muzzle for accuracy
    const wp = this.pointerWorld();
    const dToCursor = Math.hypot(wp.x - mx, wp.y - my);
    if (dToCursor > 40) ang = Math.atan2(wp.y - my, wp.x - mx) - this.kick * this.facing;
    const spread = this.spreadNow * this.steady;
    if (w.rocket) {
      scene.combat.rocket({ x: mx, y: my, angle: ang + (Math.random() - 0.5) * spread, speed: 520, accel: 1400, maxSpeed: 1300, team: 'player', damage: w.splashDamage, radius: w.splash, homing: scene.rocketLockTarget ? scene.rocketLockTarget() : null, turn: 2.6, owner: this });
    } else {
      for (let i = 0; i < w.pellets; i++) {
        const sp = (Math.random() - 0.5) * 2 * spread + (w.pellets > 1 ? (i / (w.pellets - 1) - 0.5) * spread * 0.8 : 0);
        scene.combat.fire({ x: mx, y: my, angle: ang + sp, speed: w.speed * (0.92 + Math.random() * 0.16), damage: w.damage, team: 'player', range: w.range,
          color: w.tracer, width: w.id === 'sniper' ? 3 : 2, penetration: w.penetration, headMult: w.headMult, knock: w.knockback || 150, weapon: w.id, owner: this, trailLen: w.id === 'sniper' ? 260 : 120 });
      }
      this.stats.shots++;
    }
    scene.fx.muzzle(mx, my, ang, w.id === 'pistol' ? 0.6 : w.id === 'sniper' ? 1.4 : w.id === 'shotgun' ? 1.3 : 0.95);
    if (w.id === 'launcher') scene.fx.burst('smoke', mx - Math.cos(ang) * 60, my - Math.sin(ang) * 60, 8, ang * 57.3 + 180, 40, 40, 200);
    else scene.fx.casing(this.x + this.facing * 6, this.y - 52, this.facing, w.id === 'shotgun');
    this.recoil = 1;
    this.kick += w.recoil * (this.ads ? 0.6 : 1) * (this.crouching ? 0.7 : 1);
    this.spreadNow += w.recoil * 0.25;
    scene.fx.shake(w.id === 'sniper' || w.id === 'launcher' ? 140 : 70, w.shake);
    AudioEngine.play(w.sound, { pan: 0, gap: 10 });
    if (w.id === 'shotgun') this.scene.time.delayedCall(330, () => { if (this.alive && this.current === 'shotgun') AudioEngine.play('pump', { x: this.x }); });
    if (w.id === 'sniper' && a.mag > 0) this.scene.time.delayedCall(420, () => { if (this.alive && this.current === 'sniper') AudioEngine.play('bolt', { x: this.x }); });
    this.noise = w.suppressed ? w.noise : w.noise;
    if (scene.makeNoise) scene.makeNoise(this.x, this.y, w.noise, this);
    if (w.id === 'shotgun' || w.id === 'sniper') { this.body.setVelocityX(this.body.velocity.x - Math.cos(ang) * (w.id === 'sniper' ? 120 : 90)); }
    if (a.mag === 0 && a.reserve > 0) this.scene.time.delayedCall(200, () => { if (this.alive) this.startReload(); });
  }

  throwGrenade(wp) {
    if (this.grenades <= 0 || this.throwing > 0) return;
    this.grenades--; this.throwing = 1;
    const sx = this.x + this.facing * 10, sy = this.y - 66;
    const dx = wp.x - sx, dy = wp.y - sy;
    const dist = Math.min(700, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx) - 0.35 * this.facing * (Math.cos(Math.atan2(dy, dx)) > 0 ? 1 : -1) * 0.8;
    const sp = 380 + dist * 0.75;
    this.scene.time.delayedCall(120, () => {
      if (!this.alive) return;
      this.scene.combat.grenade({ x: sx, y: sy, vx: Math.cos(ang) * sp + this.body.velocity.x * 0.4, vy: Math.sin(ang) * sp - 160, team: 'player', fuse: 2.0, damage: 240, radius: 175, owner: this });
    });
  }

  meleeAttack() {
    if (this.melee > 0) return;
    this.melee = 1;
    AudioEngine.play('knife', { x: this.x });
    const scene = this.scene;
    for (const e of scene.enemies) {
      if (!e.alive || e.isVehicle) continue;
      const dx = (e.x - this.x) * this.facing;
      if (dx > -8 && dx < 58 && Math.abs(e.y - this.y) < 40) {
        const silent = e.isUnaware && e.isUnaware();
        const killed = e.takeDamage(silent ? 9999 : 60, { x: e.x, y: e.y - 50, angle: this.facing === 1 ? 0 : Math.PI, part: 'body', team: 'player', weapon: 'knife', knock: 260, silent });
        scene.fx.impact(e.x, e.y - 50, this.facing === 1 ? 0 : Math.PI, 'flesh');
        if (scene.onPlayerHit) scene.onPlayerHit(e, killed, false, { weapon: 'knife' });
        if (silent && scene.hud) scene.hud.notify('SILENT TAKEDOWN', '#7cff9a');
        break;
      }
    }
  }

  updateInteract(dt, locked) {
    const scene = this.scene; let best = null, bd = 1e9;
    for (const it of scene.interactables || []) {
      if (!it.enabled) continue;
      const d = Math.hypot(it.x - this.x, (it.y - this.y) * 0.6);
      if (d < (it.radius || 70) && d < bd) { best = it; bd = d; }
    }
    if (best !== this.interactTarget) { this.interactT = 0; this.interactTarget = best; }
    if (this.eLatch && !this.keys.E.isDown) this.eLatch = false;
    if (best && !locked && !this.eLatch && this.keys.E.isDown) {
      this.interactT += dt * 1000;
      if (best.hold && Math.random() < 0.3) AudioEngine.play('hack', { gap: 50 });
      if (this.interactT >= (best.hold || 0)) { this.interactT = 0; const it = best; it.enabled = false; this.interactTarget = null; this.eLatch = true; it.onUse(this); }
    } else if (!best || !this.keys.E.isDown) this.interactT = 0;
  }

  damageMod(dmg, info) {
    let d = dmg * this.diff.dmgTaken;
    if (this.crouching && info.part !== 'head') d *= 0.85;
    if (info.part === 'head') d = dmg * this.diff.dmgTaken * 1.3;
    return this.godMode ? 0 : d;
  }

  onDamaged(dmg, info) {
    this.lastDamage = this.scene.time.now;
    AudioEngine.play('playerhit', { gap: 80 });
    if (this.scene.hud) this.scene.hud.damage(info, dmg);
    this.scene.fx.shake(120, 0.004 + Math.min(0.01, dmg / 2000));
  }

  onDeath(info) {
    if (this.scene.onPlayerDeath) this.scene.onPlayerDeath(info);
  }

  destroy() {
    this.scene.input.off('wheel', this.wheelHandler);
    this.scene.input.off('pointerdown', this.downHandler);
    super.destroy();
  }
}
