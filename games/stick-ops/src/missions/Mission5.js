// MISSION 05 — SKYFALL: jet combat over the Kessel corridor.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { PlayerJet, EnemyFighter, SamSite, Bomber } from '../entities/Aircraft.js';
import { Flak, FuelTank, EnemyHeli } from './HeliGunner.js';
import { Truck } from '../entities/Vehicles.js';

const G = 940;
const rand = (a, b) => a + Math.random() * (b - a);

export class Mission5 extends BaseMission {
  constructor() { super('Mission5'); }
  get missionId() { return 5; }
  get stageIndex() { return 0; }
  get levelWidth() { return 40000; }
  get themeName() { return 'dawn'; }

  buildLevel() {
    const L = this.level;
    L.background({ horizon: 700 });
    this.spawnPoint = { x: 400, y: 400 };
    L.ground(0, this.levelWidth, G, 'dirt');
    for (let x = 1200; x < this.levelWidth - 1000; x += rand(600, 1100)) {
      const t = Math.random();
      if (t < 0.4) L.building(x, G, rand(220, 380), rand(160, 360), { lit: 0.1, color: '#2a2422', depth: DEPTH.backdrop });
      else if (t < 0.6) L.decor('wreck', x, G, { depth: DEPTH.decorBack, tint: 0x8a7a70 });
      else if (t < 0.75) this.fx.fireSource(x, G, rand(0.6, 1.4), 0);
      else L.decor('tent', x, G, { depth: DEPTH.decorBack, tint: 0xa09080 });
    }
    this.addTraffic({ y: 540, tint: 0x3c2c32, row: 2, rate: 3, maxAlive: 8, sf: 0.35 });
    this.hudMode = 'heli';
    this.groundY = G;
  }

  setupMission() {
    const p = this.player;
    p.visible = false; p.controlsLocked = true; p.godMode = true; p.body.setAllowGravity(false); p.hitTest = () => null; p.body.checkCollision.none = true;
    this.scrollX = 700; this.scrollSpeed = 0; this.air = [];
    this.jet = this.viper = new PlayerJet(this, 500, G - 520);
    this.heliState = { hull: 100, maxHull: 100, heat: 0, hullLabel: 'REAPER-1 AIRFRAME', weaponName: '20mm CANNON · AIM-9', subText: 'MISSILES', distance: 0 };
    this.addCheckpoint(400, 400);
    this.addCheckpoint(17000, 400, { auto: false, restore() { this.scrollX = 17000; this.jet.x = 16700; for (const w of this.waves) if (w.x < 17000) w.done = true; this.flying = true; Music.play('heli'); this.setObjective('Break through the Kessel air defences', null); } });
    this.objectsUpd = [];
    const W = [];
    const at = (x, fn) => W.push({ x, fn, done: false });
    at(2000, () => this.spawnFighters(2));
    at(3500, () => this.flak(4400));
    at(4800, () => this.sam(5800));
    at(6500, () => { this.spawnFighters(3); this.convoy(7600); });
    at(8500, () => { this.flak(9400); this.fuel(9700); this.fuel(9950); });
    at(10500, () => { this.sam(11500); this.spawnFighters(2); });
    at(12500, () => this.spawnHelis());
    at(14500, () => { this.spawnFighters(4); this.sam(15600); });
    at(16800, () => this.reachCheckpoint(1));
    at(17500, () => { this.flak(18400); this.flak(18900); this.convoy(19200); });
    at(20000, () => { this.spawnFighters(3); this.sam(21200); this.sam(21700); });
    at(22800, () => { this.fuel(23700); this.fuel(23950); this.spawnHelis(); });
    at(25000, () => { this.spawnFighters(5); this.flak(26200); });
    at(27500, () => { this.sam(28600); this.convoy(28900); this.spawnFighters(3); });
    at(30500, () => this.startBoss());
    this.waves = W;
    this.addTrigger(-1, () => {});
  }

  onStart() {
    Music.play('heli');
    this.cutscene(async () => {
      await this.chapter('SKYFALL', 'KESSEL AIR CORRIDOR  -  14:30 LOCAL', 3000);
      this.scrollSpeed = 340;
      await this.say('REAPER-2', 'Reaper flight, feet wet. SAMs are active along the corridor. Watch your six, Ghost.', 3400);
      await this.say('GHOST', 'Copy. Weapons free. Let’s open the door for the ground boys.', 2800);
      await this.say('OVERLORD', 'VALKYRIE is somewhere ahead. Drago is aboard. Bring her down.', 3000);
    }).then(() => {
      this.flying = true;
      this.setObjective('Break through the Kessel air defences', null);
      this.hud.notify('MOUSE STEERS THE NOSE · WASD TRIM · LMB GUNS · RMB MISSILE · SPACE FLARES', '#9fb4c0');
    });
  }

  // ---------- spawners ----------
  spawnFighters(n) {
    const v = this.cameras.main.worldView;
    for (let i = 0; i < n; i++) this.time.delayedCall(i * 500, () => { const f = new EnemyFighter(this, v.right + 200 + i * 160, rand(v.y + 120, v.bottom - 260)); this.air.push(f); });
    this.hud.notify('BANDITS INBOUND', '#ff4a3a');
  }
  sam(x) { const s = new SamSite(this, x, G); this.air.push(s); }
  flak(x) { const f = new Flak(this, x); this.objectsUpd.push(f); }
  fuel(x) { const f = new FuelTank(this, x); this.objectsUpd.push(f); }
  convoy(x) { for (let i = 0; i < 3; i++) { const t = new Truck(this, x + i * 260, G, { facing: -1, stopX: x + i * 260 - 2000 }); this.vehicles.push(t); } }
  spawnHelis() { for (let i = 0; i < 2; i++) { const h = new EnemyHeli(this, this.jet.x + 1500 + i * 200, this.jet.y - 80 + i * 140, i); this.helis.push(h); } this.hud.notify('ENEMY GUNSHIPS', '#ff4a3a'); }

  lockTarget(j) {
    let best = null, bs = 1e9;
    for (const t of this.targets) {
      if (!t.alive || t.team !== 'enemy' || t.isRocket || t.dying || !t.center) continue;
      // lock only what is in front of the nose
      const c = t.center(); const dx = c.x - j.x, dy = c.y - j.y; const h = j.heading || 0;
      const fwd = dx * Math.cos(h) + dy * Math.sin(h), side = Math.abs(-dx * Math.sin(h) + dy * Math.cos(h));
      if (fwd < 60 || fwd > 1700 || side > fwd * 0.9 + 120) continue;
      const score = fwd + side * 2.2;
      if (score < bs) { bs = score; best = t; }
    }
    return best;
  }

  async startBoss() {
    const v = this.cameras.main.worldView;
    const b = this.bomber = new Bomber(this, v.right + 500, v.y + 250);
    this.air.push(b);
    Music.play('boss');
    this.say('REAPER-2', 'Big contact, twelve o’clock high... that’s VALKYRIE!', 2600);
    this.hud.bigText('VALKYRIE', '#ff4a3a', 2000);
    this.time.delayedCall(2200, () => { this.hud.setBoss(b, 'VALKYRIE · STRATEGIC BOMBER'); this.setObjective('Shoot down VALKYRIE (missiles hit hardest)', null, { silent: true }); });
  }

  async bomberDown(b) {
    this.hud.setBoss(null);
    this.setSlowmo(0.25, 2600);
    this.hud.bigText('VALKYRIE DOWN', '#ffc34d', 2400);
    for (const a of this.air) if (a !== b && a.alive && a.takeDamage) a.takeDamage(99999, { explosive: true });
    await this.wait(2600);
    await this.cutscene(async () => {
      this.camOverride = { x: this.jet.x + 300, y: this.jet.y };
      await this.say('REAPER-2', 'Splash one VALKYRIE! Drago’s bird is going down!', 2600);
      await this.say('OVERLORD', 'Reaper, be advised: no parachute seen. Drago may have got off before...', 3000);
      AudioEngine.play('warning'); this.hud.notify('MISSILE LOCK', '#ff4a3a');
      await this.say('GHOST', 'Lock tone! I’m out of flares—', 1800);
      // the hit
      this.fx.explosion(this.jet.x - 30, this.jet.y, { radius: 160 });
      this.setSlowmo(0.3, 2000);
      this.jet.alive = false; this.ejecting = true;
      await this.say('REAPER-2', 'Ghost is hit! Eject, eject, EJECT!', 2200);
      // ejection: the pilot under a canopy drifts down into Kessel
      const p = this.player; p.visible = true; p.weaponShape = null; p.setPosition(this.jet.x, this.jet.y - 40);
      this.chute = this.add.image(p.x, p.y - 110, 'parachute').setDepth(DEPTH.actors + 1).setScale(0.1);
      this.tweens.add({ targets: this.chute, scale: 1, duration: 700, ease: 'Back.easeOut' });
      this.scrollSpeed = 120;
      await this.wait(4200);
      Music.play('sad');
      await this.say('GHOST', '(Kessel is burning below. As far as I can see.)', 3200);
      this.hud.fade(true, 1600);
      await this.wait(1800);
    });
    this.allowComplete = true;
    this.completeStage();
  }

  jetDown() {
    this.flying = false;
    this.fx.explosion(this.jet.x, this.jet.y, { radius: 220, big: true });
    this.jet.img.setVisible(false); this.jet.burner.setVisible(false); if (this.jet.pipper) this.jet.pipper.setVisible(false);
    this.failMission('REAPER-1 WAS SHOT DOWN');
  }

  tick(dt, rdt) {
    const j = this.jet; if (!j) return;
    if (this.flying && !this.ended) this.scrollX += this.scrollSpeed * dt;
    else if (this.cinematic || this.ejecting) this.scrollX += this.scrollSpeed * dt;
    const view = this.cameras.main.worldView;
    if (!this.ejecting) j.update(dt, this.scrollX, view);
    else {
      // jet tumbles away, pilot drifts down under the chute
      if (j.pipper) j.pipper.setVisible(false);
      j.x += 150 * dt; j.y += 260 * dt; j.img.setPosition(j.x, j.y).setRotation(j.img.rotation + dt * 2); j.burner.setVisible(false);
      if (Math.random() < dt * 30) this.fx.burst('smoke', j.x, j.y, 1, -90, 40, 30, 80);
      const p = this.player; p.setPosition(p.x + this.scrollSpeed * dt * 0.9, p.y + 70 * dt); p.facing = 1; p.aim = 1.2;
      if (this.chute) this.chute.setPosition(p.x, p.y - 112);
    }
    if (!this.ejecting) this.player.setPosition(j.x, j.y + 50);
    for (const w of this.waves) if (!w.done && this.scrollX >= w.x) { w.done = true; w.fn(); }
    for (let i = this.air.length - 1; i >= 0; i--) { const a = this.air[i]; if (a.alive) a.update(dt); else if (a.dying) a.update(dt); }
    for (const o of this.objectsUpd) o.update(dt);
    // retire everything the corridor has left far behind (keeps the long flight smooth)
    this.pruneT = (this.pruneT || 0) - rdt;
    if (this.pruneT <= 0) {
      this.pruneT = 1;
      const cut = this.scrollX - 1800;
      const gone = (o) => { const x = o.center ? o.center().x : o.x; return x < cut; };
      const drop = (list) => { for (let i = list.length - 1; i >= 0; i--) { const o = list[i]; if (o === this.bomber || !gone(o)) continue; o.alive = false; try { o.destroy && o.destroy(); } catch (e) {} if (o.img && o.img.active) o.img.destroy(); list.splice(i, 1); } };
      drop(this.air); drop(this.vehicles); drop(this.objectsUpd); drop(this.helis);
      for (const e of [...this.enemies]) if (e.x < cut && e.destroy) e.destroy();
      this.targets = this.targets.filter((t) => t.isPlayer || (t.alive && !(t.center && t.center().x < cut)));
    }
    const s = this.heliState; s.hull = Math.max(0, j.hp); s.heat = j.heat; s.overheated = j.overheated;
    s.ammoText = 'x' + j.missiles; s.secondary = 'FLARES ' + j.flares; s.distance = Math.min(1, this.scrollX / 30500);
  }

  updateCamera(rdt) {
    const cam = this.cameras.main;
    if (this.camOverride) { this.camFollow.x += (this.camOverride.x - this.camFollow.x) * Math.min(1, rdt * 2); this.camFollow.y += (this.camOverride.y - this.camFollow.y) * Math.min(1, rdt * 2); }
    else { this.camFollow.x = this.scrollX + 620; this.camFollow.y += ((G - 440) - this.camFollow.y) * Math.min(1, rdt * 3); }
    cam.zoom += (0.8 - cam.zoom) * Math.min(1, rdt * 3);
  }
}
