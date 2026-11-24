// MISSION 02 — EXTRACTION (stage 2): playable door-gunner section aboard Viper 2-1.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { Helicopter } from '../entities/Helicopter.js';
import { Truck } from '../entities/Vehicles.js';
import { drawFigure, STYLES } from '../render/StickFigure.js';
import { segRect } from '../systems/Combat.js';

const G = 940;
const rand = (a, b) => a + Math.random() * (b - a);
const SCROLL = 175;

// Enemy AA emplacement: telegraphed flak bursts around the helicopter
export class Flak {
  constructor(scene, x) {
    this.scene = scene; this.x = x; this.team = 'enemy'; this.alive = true; this.hp = 260; this.maxHp = 260; this.isVehicle = true;
    this.img = scene.add.image(x, G, 'flak').setOrigin(0.5, 1).setDepth(DEPTH.vehicles).setFlipX(true);
    this.fireT = rand(1.5, 3); this.charge = 0;
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: G - 50 }; }
  hitTest(x1, y1, x2, y2) { if (!this.alive) return null; const t = segRect(x1, y1, x2, y2, { x: this.x - 60, y: G - 100, w: 120, h: 100 }); return t >= 0 ? { t, part: 'body', material: 'metal' } : null; }
  takeDamage(d, info = {}) {
    if (!this.alive) return false; this.hp -= d * (info.explosive ? 1.5 : 1);
    if (this.hp <= 0) { this.alive = false; this.img.setTint(0x333333); this.scene.fx.explosion(this.x, G - 50, { radius: 200 }); this.scene.fx.fireSource(this.x, G, 0.8, 0); this.scene.hud.notify('AA GUN DESTROYED', '#7cff9a'); return true; }
    return false;
  }
  update(dt) {
    if (!this.alive) return;
    const h = this.scene.viper; if (!h) return;
    const dx = h.x - this.x; if (Math.abs(dx) > 1400) return;
    this.fireT -= dt;
    if (this.fireT < 1 && this.fireT > 0) { this.charge += dt; if (Math.random() < dt * 12) { this.scene.fx.burst('spark', this.x - 40, G - 100, 1, -120, 30, 50, 120); this.scene.lighting && 0; } }
    if (this.fireT <= 0) {
      this.fireT = rand(2.8, 4.2); this.charge = 0;
      for (let i = 0; i < 3; i++) this.scene.time.delayedCall(i * 220, () => {
        if (!this.alive) return;
        const tx = h.x + rand(-140, 220), ty = h.y + rand(-80, 120);
        const ang = Math.atan2(ty - (G - 110), tx - (this.x - 50));
        const dist = Math.hypot(tx - this.x, ty - G);
        this.scene.combat.shell({ x: this.x - 50, y: G - 110, angle: ang, speed: 1400, team: 'enemy', damage: 9, radius: 120, owner: this }).life = dist / 1400;
        this.scene.fx.muzzle(this.x - 50, G - 110, ang, 1.3);
        AudioEngine.play('flak', { x: this.x });
      });
    }
  }
}

// Fuel tank: big secondary explosions
export class FuelTank {
  constructor(scene, x) {
    this.scene = scene; this.x = x; this.team = 'enemy'; this.alive = true; this.hp = 120; this.maxHp = 120; this.isVehicle = true;
    this.img = scene.add.image(x, G, 'tank_oil').setOrigin(0.5, 1).setDepth(DEPTH.decorBack + 3);
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: G - 70 }; }
  hitTest(x1, y1, x2, y2) { if (!this.alive) return null; const t = segRect(x1, y1, x2, y2, { x: this.x - 80, y: G - 150, w: 160, h: 150 }); return t >= 0 ? { t, part: 'body', material: 'metal' } : null; }
  takeDamage(d) {
    if (!this.alive) return false; this.hp -= d;
    if (this.hp <= 0) {
      this.alive = false; this.img.setTint(0x222222).setScale(1, 0.5);
      this.scene.fx.explosion(this.x, G - 80, { radius: 320, damage: 400, owner: 'player' });
      this.scene.time.delayedCall(200, () => this.scene.fx.explosion(this.x + 60, G - 140, { radius: 200 }));
      this.scene.fx.fireSource(this.x, G, 1.6, 0);
      return true;
    }
    return false;
  }
  update() {}
}

export class EnemyHeli extends Helicopter {
  constructor(scene, x, y, slot) {
    super(scene, x, y, { kind: 'gunship', art: 'v_tiger', scale: 0.72, speed: 480, searchlight: false, loud: 0.8 });
    this.team = 'enemy'; this.isHeli = true; this.hp = this.maxHp = 700; this.slot = slot; this.fireT = 2; this.burst = 0;
    scene.targets.push(this);
  }
  center() { return { x: this.x, y: this.y }; }
  hitTest(x1, y1, x2, y2) { if (!this.alive || this.dying) return null; const t = segRect(x1, y1, x2, y2, { x: this.x - 110, y: this.y - 26, w: 220, h: 52 }); return t >= 0 ? { t, part: 'body', material: 'metal' } : null; }
  takeDamage(d, info = {}) {
    if (!this.alive || this.dying) return false;
    this.hp -= d * (info.explosive ? 1.2 : 1);
    this.smoking = this.hp < this.maxHp * 0.4 ? 2 : this.hp < this.maxHp * 0.7 ? 1 : 0;
    if (this.hp <= 0) { this.dying = true; this.vy = 80; this.target = null; this.scene.fx.explosion(this.x, this.y, { radius: 160 }); this.scene.setSlowmo(0.35, 1200); return true; }
    return false;
  }
  updateBoss(dt) {
    const sc = this.scene; const v = sc.viper;
    if (this.dying) {
      this.extraRot = (this.extraRot || 0) + dt * 3; this.vy += 400 * dt; this.x += 60 * dt;
      this.y += this.vy * dt; this.update(0);
      if (this.y > G - 30) { sc.fx.explosion(this.x, G - 40, { radius: 300 }); sc.fx.fireSource(this.x, G, 1.4, 0); this.destroy(); }
      return;
    }
    // hold a slot ahead of Viper, weaving
    const t = this.time;
    this.lockFacing = true; this.facing = -1;
    this.moveTo(v.x + 720 + this.slot * 160 + Math.sin(t * 0.7 + this.slot) * 120, v.y - 40 + this.slot * 130 + Math.sin(t * 1.3 + this.slot * 2) * 70, 480);
    this.fireT -= dt;
    if (this.fireT <= 0.8 && this.fireT > 0 && Math.random() < dt * 10) sc.fx.burst('spark', this.x - 110, this.y + 20, 1, 180, 30, 60, 120);
    if (this.fireT <= 0) {
      if (this.burst <= 0) this.burst = 14;
      const gp = { x: this.x - 120 * this.scale, y: this.y + 22 * this.scale };
      const ang = Math.atan2(v.y + 10 - gp.y, v.x - gp.x) + rand(-0.06, 0.06);
      sc.combat.fire({ x: gp.x, y: gp.y, angle: ang, speed: 1800, damage: 5, team: 'enemy', range: 1500, color: 0xff9a50, width: 2.5, owner: this });
      sc.fx.muzzle(gp.x, gp.y, ang, 0.8); AudioEngine.play('minigun', { x: this.x, gap: 50 });
      this.burst--; this.fireT = this.burst > 0 ? 0.08 : rand(1.6, 2.6);
    }
    this.update(dt);
  }
}

export class HeliGunnerScene extends BaseMission {
  constructor() { super('HeliGunner'); }
  get missionId() { return 2; }
  get stageIndex() { return 1; }
  get levelWidth() { return 15500; }
  get themeName() { return 'dawn'; }

  buildLevel() {
    const L = this.level;
    L.background({ horizon: 560 + 200 });
    this.spawnPoint = { x: 400, y: 400 };
    L.ground(0, this.levelWidth, G, 'dirt');
    // a burning valley: villages, roads, encampments
    const R = (a, b) => a + Math.random() * (b - a);
    for (let x = 900; x < this.levelWidth - 800; x += R(500, 900)) {
      const t = Math.random();
      if (t < 0.45) L.building(x, G, R(200, 360), R(180, 320), { lit: 0.08, color: '#2b2523', depth: DEPTH.backdrop });
      else if (t < 0.65) L.decor('tent', x, G, { depth: DEPTH.decorBack, tint: 0xa09080 });
      else if (t < 0.8) L.decor('wreck', x, G, { depth: DEPTH.decorBack, tint: 0x8a7a70 });
      else this.fx.fireSource(x, G, R(0.6, 1.2), 0);
      if (Math.random() < 0.5) L.sandbags(x + 260, G);
    }
    this.hudMode = 'heli';
    this.addTraffic({ y: 632, tint: 0x2e2226, row: 2, rate: 3.5, maxAlive: 7, depth: DEPTH.mid + 0.5, scale: 1.6 });
  }

  setupMission() {
    this.aimErrMul = 3.2;
    this.addCheckpoint(400, 400);
    this.addCheckpoint(7600, 400, { auto: false, restore() {
      // skip only waves already behind us; the gunship (7000) and anything ahead spawn again on retry
      this.scrollX = 7600; for (const w of this.waves) if (w.x < 6700) w.done = true;
      this.viper.x = this.scrollX - 120; this.viper.y = G - 520; Music.play('heli'); this.flying = true;
      this.camFollow.setPosition(this.scrollX + 330, G - 290); this.cameras.main.centerOn(this.scrollX + 330, G - 290);
      this.setObjective('Protect Viper 2-1 — destroy AA guns, RPG teams and armour', null);
    } });
    // hide and lock the ground player; he rides in the door
    const p = this.player;
    p.visible = false; p.controlsLocked = true; p.godMode = true; p.body.setAllowGravity(false); p.hitTest = () => null;
    p.body.checkCollision.none = true;
    this.heliState = { hull: 100, maxHull: 100, heat: 0, overheated: false, distance: 0 };
    this.scrollX = 400;
    this.gunAim = 0.6; this.spin = 0; this.fireT = 0;
    this.gunnerG = this.add.graphics().setDepth(DEPTH.foreground + 1);
    this.objectsUpd = [];
    // encounter script by world x
    const waves = [
      [1500, () => this.infantry(2300, 4)], [2400, () => this.truck(3200)], [3000, () => this.flak(3900)],
      [3800, () => this.infantry(4600, 5)], [4400, () => this.tank(5200)], [4600, () => this.rpgSquad(5400)],
      [5600, () => { this.flak(6300); this.infantry(6500, 3); }], [6400, () => this.truck(7200)],
      [7000, () => this.midHeli()], [8200, () => this.infantry(9000, 6)], [8600, () => { this.tank(9400); this.flak(9600); }],
      [9400, () => this.rpgSquad(10200)], [10000, () => { this.truck(10800); this.truck(11000); }], [10600, () => this.flak(11500)],
      [11200, () => { this.infantry(12000, 5); this.tank(12200); }], [12000, () => this.rpgSquad(12800)],
      [13200, () => this.finalWave()],
    ];
    this.waves = waves.map(([x, fn]) => ({ x, fn, done: false }));
    this.input.on('pointerdown', (ptr) => { if (ptr.button === 0) this.clickQ = true; });
    this.createViper();
  }

  createViper() {
    this.viper = new Helicopter(this, this.scrollX - 300, G - 600, { kind: 'ally', scale: 1.25, depth: DEPTH.foreground, loud: 1.2 });
    this.helis.push(this.viper);
    this.viper.lockFacing = true; this.viper.facing = 1;
    this.hull = { team: 'player', alive: true, center: () => ({ x: this.viper.x, y: this.viper.y }),
      hitTest: (x1, y1, x2, y2) => { const v = this.viper; const t = segRect(x1, y1, x2, y2, { x: v.x - 170, y: v.y - 40, w: 330, h: 90 }); return t >= 0 ? { t, part: 'body', material: 'metal' } : null; },
      takeDamage: (d, info = {}) => this.damageHull(info.explosive ? d * 0.3 : Math.min(0.7, 0.18 + d * 0.03)) };
    this.targets.push(this.hull);
  }

  onStart() {
    Music.play('heli');
    this.cutscene(async () => {
      this.camTo(this.scrollX + 300, G - 360, 0.82);
      await this.say('VIPER 2-1', 'Hold on back there! We\'re running the valley — it\'s the only way out.', 3000);
      await this.say('OVERLORD', 'Ghost, clear a path. Priority targets: AA guns and RPG teams.', 3000);
    }).then(() => {
      this.setObjective('Protect Viper 2-1 — destroy AA guns, RPG teams and armour', null);
      this.hud.notify('HOLD LMB TO FIRE · WATCH THE HEAT', '#9fb4c0');
      this.flying = true;
    });
  }

  // ---------- encounter helpers ----------
  infantry(x, n) { for (let i = 0; i < n; i++) this.spawnSoldier(Math.random() < 0.2 ? 'heavy' : 'rifleman', x + i * rand(50, 90), G, { state: 'combat', facing: -1, noCover: true }); }
  truck(x) { const t = new Truck(this, x + 600, G, { facing: -1, stopX: x }); this.vehicles.push(t); }
  tank(x) { const t = new Truck(this, x + 600, G, { facing: -1, stopX: x, hp: 900, art: 'v_mrap', artW: 230, name: 'MRAP' }); this.vehicles.push(t); }
  flak(x) { const f = new Flak(this, x); this.objectsUpd.push(f); this.hud.notify('AA GUN AHEAD', '#ff4a3a'); }
  rpgSquad(x) {
    for (let i = 0; i < 3; i++) { const s = this.spawnSoldier('rifleman', x + i * 90, G, { state: 'combat', facing: -1, noCover: true }); s.isRpg = true; s.rpgT = rand(2, 4); }
    this.fuel = new FuelTank(this, x + 380); this.objectsUpd.push(this.fuel);
    this.hud.notify('RPG TEAM — SHOOT THE ROCKETS DOWN!', '#ff4a3a');
  }
  midHeli() {
    this.hud.notify('ENEMY GUNSHIP!', '#ff4a3a');
    this.say('VIPER 2-1', 'Bandit on our nose! Light him up!', 2400);
    const h = new EnemyHeli(this, this.viper.x + 1600, this.viper.y - 100, 0); this.helis.push(h); this.midH = h;
    this.hud.setBoss(h, 'HIND-K GUNSHIP');
    this.reachCheckpoint(1);
  }
  finalWave() {
    this.finalActive = true; this.flying = false;
    Music.play('boss');
    this.say('VIPER 2-1', 'Two gunships, twelve o\'clock! We\'re pinned — take them out!', 3000);
    this.finals = [new EnemyHeli(this, this.viper.x + 1500, this.viper.y - 140, 0), new EnemyHeli(this, this.viper.x + 1700, this.viper.y + 40, 1)];
    for (const h of this.finals) this.helis.push(h);
    this.finalBar = { get hp() { return this._s().reduce((a, h) => a + Math.max(0, h.hp), 0); }, maxHp: 1400, get alive() { return this._s().some((h) => !h.dying && h.alive); }, _s: () => this.finals };
    this.hud.setBoss(this.finalBar, 'HIND-K PAIR');
    this.setObjective('Destroy both enemy gunships', null);
  }

  damageHull(d) {
    if (this.ended) return false;
    const s = this.heliState; s.hull = Math.max(0, s.hull - d * (0.4 + this.player.diff.dmgTaken * 0.6)); this.lastHullHit = this.time.now;
    this.hud.damage({}); AudioEngine.play('hitmetal', { gap: 60 });
    this.fx.shake(120, 0.004);
    this.viper.smoking = s.hull < 30 ? 2 : s.hull < 60 ? 1 : 0;
    if (s.hull <= 0) this.crash();
    return false;
  }

  crash() {
    this.ended = true; this.flying = false;
    this.say('VIPER 2-1', 'We\'re hit! Going down, going down!', 2500);
    this.setSlowmo(0.4, 1500);
    this.viper.target = null; this.viper.smoking = 2;
    const ev = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      this.viper.y += 6; this.viper.x += 4; this.viper.extraRot = (this.viper.extraRot || 0) + 0.05;
      if (this.viper.y > G - 60) { ev.remove(); this.fx.explosion(this.viper.x, G - 60, { radius: 320 }); this.viper.destroy(); this.stats.deaths++;
        this.time.delayedCall(1500, () => { this.scene.launch('Fail', { from: this.scene.key, cp: this.cpIndex, reason: 'VIPER 2-1 WAS SHOT DOWN' }); this.scene.pause(); }); }
    } });
  }

  onPlayerHit(target, killed, head, b) {
    super.onPlayerHit(target, killed, head, b);
    if (killed && (target.isVehicle || target.isHeli)) this.stats.kills++;
  }

  // ---------- loop ----------
  tick(dt, rdt) {
    if (!this.viper) return;
    const s = this.heliState; const v = this.viper;
    if (this.flying && !this.ended) this.scrollX += SCROLL * dt;
    s.distance = Math.min(1, this.scrollX / 13400);
    if (!this.ended && s.hull > 0 && this.time.now - (this.lastHullHit || 0) > 3500) s.hull = Math.min(s.maxHull, s.hull + rdt * 1.5);
    // viper rides along with the camera, evading slightly
    if (!this.ended) {
      const t = this.time.now / 1000;
      v.moveTo(this.scrollX - 40 + Math.sin(t * 0.5) * 60, G - 520 + Math.sin(t * 0.8) * 35, 600);
    }
    // keep the (hidden) player at the door so enemies aim at the helicopter
    const door = v.loc ? v.loc(40, 30) : { x: v.x, y: v.y };
    this.player.setPosition(door.x, door.y + 52);
    // waves
    for (const w of this.waves) if (!w.done && this.scrollX + 900 >= w.x) { w.done = true; w.fn(); }
    for (const o of this.objectsUpd) o.update(dt);
    // RPG soldiers
    for (const e of this.enemies) {
      if (!e.alive || !e.isRpg) continue;
      if (Math.abs(e.x - v.x) > 1300) continue;
      e.rpgT -= dt;
      if (e.rpgT < 0.8 && !e.rpgWarn) { e.rpgWarn = true; e.setMark('!', '#ff4a3a'); }
      if (e.rpgT <= 0) {
        e.rpgT = rand(4, 6.5); e.rpgWarn = false; e.setMark(null);
        const ang = Math.atan2(v.y - (e.y - 60), v.x - e.x);
        this.combat.rocket({ x: e.x, y: e.y - 60, angle: ang, speed: 380, accel: 300, maxSpeed: 650, team: 'enemy', damage: 18, radius: 120, homing: this.viperTarget(), turn: 0.9, life: 5, owner: e, shootable: true });
      }
    }
    // gunner
    this.updateGun(dt);
    // finals
    if (this.finalActive && this.finals.every((h) => h.dying || !h.alive)) { this.finalActive = false; this.endSequence(); }
    if (this.midH && (this.midH.dying || !this.midH.alive)) { this.midH = null; this.hud.setBoss(null); this.hud.notify('GUNSHIP DOWN', '#7cff9a'); }
    // cleanup enemies far behind
    for (const e of this.enemies) if (e.alive && e.x < this.scrollX - 1400) e.destroy();
  }

  viperTarget() { const v = this.viper; return { get x() { return v.x; }, get y() { return v.y; }, alive: true }; }

  updateGun(dt) {
    const s = this.heliState; const v = this.viper; const g = this.gunnerG; g.clear();
    if (!v.alive) return;
    const door = v.loc(40, 18);
    const ptr = this.input.activePointer; const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    let a = Math.atan2(wp.y - (door.y - 30), wp.x - door.x);
    a = Math.max(-0.5, Math.min(1.55, a));
    this.gunAim += (a - this.gunAim) * Math.min(1, dt * 14);
    const firing = !this.cinematic && !this.ended && (ptr.leftButtonDown() || this.clickQ) && !s.overheated;
    this.clickQ = false;
    this.spin = Math.max(0, Math.min(1, this.spin + (firing ? dt * 4 : -dt * 2)));
    s.heat = Math.max(0, s.heat - dt * (s.overheated ? 0.3 : 0.38));
    if (s.overheated && s.heat < 0.25) s.overheated = false;
    this.fireT -= dt;
    const pose = drawFigure(g, { x: door.x, y: door.y + 30, facing: 1, aim: this.gunAim, walk: 0, move: 0, crouch: 0.9, air: false, recoil: firing && this.spin > 0.6 ? Math.random() : 0, reload: -1, hurt: 0, weapon: 'minigun', style: STYLES.player, time: this.time.now / 1000 });
    if (firing && this.spin > 0.6 && this.fireT <= 0) {
      this.fireT = 0.045;
      const m = pose.muzzle; const ang = pose.weaponAngle + rand(-0.03, 0.03) * (1 + s.heat);
      this.combat.fire({ x: m.x, y: m.y, angle: ang, speed: 3000, damage: 30, team: 'player', range: 2200, color: 0xffd27a, width: 2.5, penetration: 2, knock: 300, weapon: 'turret', owner: this.player, trailLen: 160 });
      this.stats.shots++;
      this.fx.muzzle(m.x, m.y, ang, 1.1);
      if (Math.random() < 0.5) this.fx.casing(door.x, door.y, 1);
      AudioEngine.play('doorgun', { gap: 35 });
      this.fx.shake(40, 0.0018);
      s.heat += 0.0105;
      if (s.heat >= 1) { s.heat = 1; s.overheated = true; this.hud.notify('OVERHEATED', '#ff4a3a'); AudioEngine.play('dry'); }
    }
  }

  async endSequence() {
    this.hud.setBoss(null);
    this.hud.bigText('SKIES CLEAR', '#7cff9a', 2000);
    await this.cutscene(async () => {
      this.flying = true;
      await this.say('VIPER 2-1', 'That\'s both bandits down! Hell of a shooting, Ghost!', 2800);
      await this.say('SPARROW', 'Iron Spire... Varkov runs BLACKOUT from the Iron Spire base. I can show you where.', 3400);
      if (this.registry.get('rookFell')) { Music.play('sad'); await this.say('GHOST', '(holding Rook’s dog tags) ...We made it out, brother.', 3200); }
      await this.say('OVERLORD', 'Copy that. Get some rest, Echo-6. Tonight we end this.', 2800);
    });
    this.allowComplete = true;
    this.completeStage();
  }

  updateCamera(rdt) {
    const cam = this.cameras.main;
    const tx = this.scrollX + 330, ty = G - 290;
    if (this.camOverride) { this.camFollow.x += (this.camOverride.x - this.camFollow.x) * Math.min(1, rdt * 2); this.camFollow.y += (this.camOverride.y - this.camFollow.y) * Math.min(1, rdt * 2); }
    else { this.camFollow.x = tx; this.camFollow.y += (ty - this.camFollow.y) * Math.min(1, rdt * 3); }
    cam.zoom += ((this.camOverride ? this.zoomTarget : 0.82) - cam.zoom) * Math.min(1, rdt * 3);
  }

  applyExplosion(x, y, r, dmg, owner, source) {
    super.applyExplosion(x, y, r, dmg, owner, source);
    // flak and rockets near the helicopter damage the hull (hull is a 'player' target, handled by super when owner is enemy)
  }
}
