// MISSION 04 — IRON DAWN: armoured assault in the tank HAMMER-1.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { PlayerTank, EnemyTank, Bunker } from '../entities/Armor.js';
import { APC, Truck, AllyTank } from '../entities/Vehicles.js';

const G = 940;
const rand = (a, b) => a + Math.random() * (b - a);

export class Mission4 extends BaseMission {
  constructor() { super('Mission4'); }
  get missionId() { return 4; }
  get stageIndex() { return 0; }
  get levelWidth() { return 13000; }
  get themeName() { return 'dawn'; }

  buildLevel() {
    const L = this.level;
    L.background();
    this.spawnPoint = { x: 400, y: G - 200 };
    L.ground(0, 13000, G, 'dirt');
    const D = (k, x, o = {}) => L.decor(k, x, G, Object.assign({ depth: DEPTH.decorBack }, o));
    // trench line
    for (const x of [900, 1300, 2050, 2600, 2950]) D('sandbags', x);
    D('wreck', 1600, { tint: 0x8a7a70 }); D('tent', 700, { tint: 0xa09080 }); D('jersey', 2300); D('wreck', 3300, { tint: 0x6a5a50, flip: true });
    // town crossroads
    for (const [x, w, h] of [[3700, 300, 260], [4150, 360, 340], [4800, 280, 220], [5350, 420, 380], [6000, 300, 250]]) L.building(x, G, w, h, { lit: 0.05, color: '#2a2422', depth: DEPTH.backdrop });
    D('wreck', 4600, { tint: 0x777777 }); D('jersey', 5100); D('jersey', 5700); D('wreck', 6300, { tint: 0x777777, flip: true });
    // artillery ridge
    for (const x of [7000, 7600, 8300, 8900]) D('sandbags', x);
    D('flak', 7400, { flip: true }); D('flak', 8600, { flip: true }); D('tent', 8100, { tint: 0x8a7a70 });
    // valley mouth (boss arena)
    for (const x of [9800, 10600, 11500, 12300]) D('wreck', x, { tint: 0x5a4a44, flip: x % 2 === 0 });
    D('tank_oil', 12600); D('tank_oil', 12780);
    for (const x of [600, 2200, 4400, 5900, 7800, 10200, 11900]) this.fx.fireSource(x, G + 2, 0.6, 0);
    this.add.particles(0, 0, 'ember', { x: { min: 0, max: 1600 }, y: 760, speedY: { min: -60, max: -20 }, speedX: { min: -30, max: 30 }, lifespan: 4000, frequency: 110, scale: { start: 0.8, end: 0 }, blendMode: 'ADD' }).setScrollFactor(0).setDepth(DEPTH.weather);
    this.addTraffic({ y: 486, tint: 0x3c2c32, row: 2, rate: 3.5, maxAlive: 7 });
    this.hudMode = 'heli';
    // repair crates
    this.repairs = [3400, 6550, 9400, 11200].map((x) => ({ x, img: this.add.image(x, G - 20, 'wrench').setDepth(DEPTH.actors), used: false }));
  }

  setupMission() {
    const p = this.player;
    p.visible = false; p.controlsLocked = true; p.godMode = true; p.body.setAllowGravity(false); p.hitTest = () => null; p.body.checkCollision.none = true;
    this.playerTank = new PlayerTank(this, 400, G);
    this.heliState = { hull: 100, maxHull: 100, heat: 0, hullLabel: 'HAMMER-1 ARMOUR', weaponName: '120mm CANNON', subText: 'RMB MG' };
    this.allyTanks = [new AllyTank(this, 100, G, { speed: 120 }), new AllyTank(this, -250, G, { speed: 120 })];
    this.allyTanks.forEach((t, i) => { t.name = i ? 'HAMMER-3' : 'HAMMER-2'; t.c.setScale(0.8, 0.8); t.onFire = (tk) => this.allyShot(tk); this.vehicles.push(t); });
    this.addCheckpoint(400, G);
    this.addCheckpoint(3500, G, { restore() { this.placeTank(3500); this.objectiveTown(); Music.play('combat'); } });
    this.addCheckpoint(6600, G, { restore() { this.placeTank(6600); this.hammer3Lost = true; this.killAlly(1, true); this.setObjective('Silence the artillery ridge', { x: 9000, y: G - 80 }); Music.play('combat'); } });
    this.addCheckpoint(9500, G, { auto: false, restore() { this.placeTank(9500); this.hammer3Lost = true; this.killAlly(1, true); this.startBoss(); } });
    this.addTrigger(-1, () => this.spawnTrench());
    this.addTrigger(3500, () => this.spawnTown());
    this.addTrigger(4300, () => this.airStrike());
    this.addTrigger(5500, () => this.hammer3Scene());
    this.addTrigger(6600, () => this.spawnRidge());
    this.addTrigger(9500, () => this.startBoss());
  }

  placeTank(x) { this.playerTank.body.reset(x, G - 40); this.allyTanks.forEach((t, i) => { t.x = x - 300 - i * 330; }); }

  onStart() {
    Music.play('combat');
    this.cutscene(async () => {
      await this.chapter('IRON DAWN', 'SARN VALLEY  -  06:10 LOCAL', 3000);
      this.camTo(700, G - 260, 0.75);
      this.jetFlyby({ dir: 1, count: 3 });
      await this.say('OVERLORD', 'HAMMER-1, this is Overlord. Drago’s armour is dug in along the valley. Break the line.', 3400);
      await this.say('LOADER', 'Sabot up! Gun’s ready, Ghost.', 2000);
      await this.say('HAMMER-3', 'Hollis on your six, HAMMER-1. Let’s ruin their morning.', 2800);
      await this.say('GHOST', 'HAMMER platoon, advance. Watch for AT teams in the trenches.', 2800);
    }).then(() => {
      this.setObjective('Break through the trench line', { x: 3400, y: G - 80 });
      this.hud.notify('A/D DRIVE · MOUSE AIM · LMB FIRE · RMB COAX · 1 CANNON  2 GUIDED ATGM  3 ROCKET SALVO', '#9fb4c0');
    });
  }

  // ---------- spawns ----------
  soldiers(list) { for (const [t, x, rpg] of list) { const s = this.spawnSoldier(t, x, G, { state: 'combat', facing: -1 }); if (rpg) { s.isRpg = true; s.rpgT = rand(2, 4); s.setMark('▲', '#ff8a3a'); } } }
  spawnTrench() {
    this.vehicles.push(new Bunker(this, 1900, G), new Bunker(this, 3150, G));
    this.soldiers([['rifleman', 1200], ['rifleman', 1450, true], ['heavy', 2100], ['rifleman', 2400], ['rifleman', 2700, true], ['shotgunner', 2850]]);
  }
  objectiveTown() { this.setObjective('Clear the town crossroads', { x: 6300, y: G - 80 }); }
  spawnTown() {
    this.objectiveTown();
    const t1 = new EnemyTank(this, 5300, G, { stopX: 4700 }); const t2 = new EnemyTank(this, 6400, G, { stopX: 5600 });
    const apc = new APC(this, 6000, G, { facing: -1, stopX: 5200 });
    this.vehicles.push(t1, t2, apc);
    this.soldiers([['rifleman', 4300], ['rifleman', 4500, true], ['heavy', 4900], ['rifleman', 5200, true], ['shotgunner', 5600]]);
    this.say('LOADER', 'Enemy armour, two o’clock! HEAT loaded!', 2400);
  }
  async airStrike() {
    this.say('REAPER-2', 'Reaper flight, rolling in hot on the crossroads!', 2400);
    await this.wait(1600);
    this.jetFlyby({ dir: 1, count: 2, strike: [4900, 5150, 5400], damage: 300 });
  }
  async hammer3Scene() {
    if (this.hammer3Lost) return;
    this.hammer3Lost = true;
    const t = this.allyTanks[1];
    await this.cutscene(async () => {
      this.camTo(t.x + 100, G - 220, 0.9);
      AudioEngine.play('incoming');
      await this.say('HAMMER-3', 'Contact left! Contact le—', 1200);
      this.killAlly(1, false);
      this.setSlowmo(0.3, 1800);
      Music.play('sad');
      await this.wait(1800);
      await this.say('GHOST', 'HAMMER-3! Hollis, respond!', 2400);
      await this.say('HAMMER-2', '...They’re gone, Ghost. Whole crew.', 2600);
      await this.say('GHOST', 'Then we make Drago pay for every one of them. Push!', 2800);
    });
    Music.play('combat');
  }
  killAlly(i, instant) {
    const t = this.allyTanks[i]; if (!t || !t.alive) return;
    if (instant) { t.alive = false; t.bodyImg.setTint(0x2a2220); t.fire = this.fx.fireSource(t.x, G - 40, 1.2, 0); return; }
    t.destroyVehicle();
  }
  spawnRidge() {
    this.setObjective('Silence the artillery ridge', { x: 9000, y: G - 80 });
    this.vehicles.push(new Bunker(this, 7300, G), new Bunker(this, 8450, G, { hp: 900 }));
    const tr = new Truck(this, 9400, G, { facing: -1, stopX: 8000 }); this.vehicles.push(tr);
    this.vehicles.push(new EnemyTank(this, 9200, G, { stopX: 8200 }));
    this.soldiers([['rifleman', 7100, true], ['heavy', 7700], ['rifleman', 8100, true], ['rifleman', 8700], ['sniper', 8900], ['rifleman', 9100, true]]);
    this.artilleryT = 4;
  }
  startBoss() {
    if (this.boss) return;
    this.reachCheckpoint(3);
    const boss = this.boss = new EnemyTank(this, 12200, G, { boss: true, hp: 4200, scale: 1.3, minDist: 700, name: 'MAMMOTH', stopX: 10600 });
    this.vehicles.push(boss);
    boss.onHurt = (f) => {
      if (f < 0.66 && !this.p2) { this.p2 = true; this.say('LOADER', 'It’s calling infantry! AT teams on the ridge!', 2400); this.soldiers([['rifleman', 11800, true], ['heavy', 12000], ['rifleman', 12200, true]]); }
      if (f < 0.33 && !this.p3) { this.p3 = true; this.say('HAMMER-2', 'Its armour is cracking! Keep hitting it!', 2400); this.soldiers([['rifleman', 11900, true], ['rifleman', 12100, true]]); }
    };
    boss.onDestroyed = () => this.bossDown();
    this.cutscene(async () => {
      this.camTo(11300, G - 260, 0.7);
      Music.play('boss');
      await this.wait(1200);
      await this.say('LOADER', 'Holy... what IS that thing?', 2200);
      await this.say('OVERLORD', 'That’s the MAMMOTH. Aim for the turret ring. Use the wrecks for cover.', 3000);
      this.hud.bigText('MAMMOTH', '#ff4a3a', 1800);
    }).then(() => {
      this.hud.setBoss(boss, 'MAMMOTH · SUPER-HEAVY TANK');
      this.setObjective('Destroy the MAMMOTH', null, { silent: true });
    });
  }
  async bossDown() {
    this.hud.setBoss(null);
    this.setSlowmo(0.25, 2400);
    this.hud.bigText('MAMMOTH DESTROYED', '#ffc34d', 2400);
    for (const e of this.enemies) if (e.alive) e.takeDamage(9999, { angle: 0 });
    await this.wait(2600);
    await this.cutscene(async () => {
      Music.play('tension');
      this.camTo(this.playerTank.x + 300, G - 240, 0.8);
      await this.say('OVERLORD', 'Valley is open. Outstanding work, HAMMER-1.', 2600);
      await this.say('SPARROW', 'Ghost... it’s SPARROW. I cracked Drago’s traffic. She calls it BLACK SUN.', 3400);
      await this.say('SPARROW', 'It’s a missile silo past Kessel. She means to launch it.', 3000);
      await this.say('GHOST', 'Then we go through her sky to get there.', 2600);
    });
    this.allowComplete = true;
    this.completeStage();
  }

  allyShot(t) {
    // allied tanks fire real shells at the nearest enemy armour or bunker in range
    let best = null, bd = 1600;
    for (const v of this.vehicles) if (v.alive && v.team === 'enemy') { const d = Math.abs(v.x - t.x); if (d < bd) { bd = d; best = v; } }
    if (!best || !t.alive) return;
    const c = best.center(); const mx = t.x + 150, my = G - 72;
    this.combat.shell({ x: mx, y: my, angle: Math.atan2(c.y - my, c.x - mx) + rand(-0.04, 0.04), speed: 1300, team: 'player', damage: 90, radius: 130, gravity: 120 });
  }

  tankDestroyed() {
    this.fx.explosion(this.playerTank.x, G - 60, { radius: 320, big: true });
    this.failMission('HAMMER-1 WAS DESTROYED');
  }

  onVehicleDestroyed(v) { if (v.team === 'enemy') this.stats.kills++; }

  tick(dt, rdt) {
    const tk = this.playerTank; if (!tk) return;
    tk.update(dt);
    const p = this.player; const m = tk.vis.muzzle(); p.setPosition(m.px, m.py + 50);
    const s = this.heliState; s.hull = Math.max(0, tk.hp / tk.maxHp * 100); s.heat = tk.heat; s.overheated = tk.overheated;
    s.ammoText = tk.ammoText(); s.weaponName = '[' + (tk.weapon + 1) + '] ' + tk.WEAPONS[tk.weapon] + '   ·   1/2/3 SWITCH'; s.secondary = 'ATGM ' + tk.atgm + '  ·  SALVO ' + tk.salvo;
    // allied tanks keep formation behind HAMMER-1
    this.allyTanks.forEach((t, i) => { if (t.alive) t.stopX = Math.max(t.x - 40, tk.x - 320 - i * 330); });
    // repair crates
    for (const r of this.repairs) if (!r.used && Math.abs(r.x - tk.x) < 120) { r.used = true; r.img.destroy(); tk.hp = Math.min(tk.maxHp, tk.hp + 320); tk.refill(); this.hud.notify('+ ARMOUR REPAIRED · REARMED', '#7cff9a'); AudioEngine.play('pickup'); }
    // anti-tank teams
    for (const e of this.enemies) {
      if (!e.alive || !e.isRpg || this.cinematic) continue;
      if (Math.abs(e.x - tk.x) > 1150) continue;
      e.rpgT -= dt;
      if (e.rpgT <= 0) {
        e.rpgT = rand(4, 6.5);
        const c = tk.center(); const ang = Math.atan2(c.y - (e.y - 60), c.x - e.x);
        this.combat.rocket({ x: e.x, y: e.y - 60, angle: ang, speed: 420, accel: 500, maxSpeed: 800, team: 'enemy', damage: 75, radius: 110, life: 4, owner: e, shootable: true });
      }
    }
    // ridge artillery barrages
    if (this.artilleryT !== undefined && !this.boss && !this.cinematic) {
      this.artilleryT -= dt;
      if (this.artilleryT <= 0) {
        this.artilleryT = rand(3.5, 5.5);
        const x = tk.x + rand(-100, 500);
        const mk = this.add.image(x, G - 4, 'glow').setTint(0xff2a1a).setBlendMode('ADD').setScale(1.2, 0.2).setDepth(DEPTH.fx);
        AudioEngine.play('incoming', { x });
        this.time.delayedCall(1300, () => { mk.destroy(); this.fx.explosion(x, G - 10, { radius: 170, damage: 60, owner: 'world' }); });
      }
    }
    // distant war on the horizon
    if (Math.random() < dt * 2) {
      const cam = this.cameras.main; const x = cam.worldView.x + Math.random() * cam.worldView.width; const y = G - 330 - Math.random() * 140;
      const f = this.add.image(x, y, 'glow').setTint(0xffb060).setBlendMode('ADD').setScale(0.3 + Math.random() * 0.6).setDepth(DEPTH.mid + 0.5);
      this.tweens.add({ targets: f, alpha: 0, scale: 0.1, duration: 320, onComplete: () => f.destroy() });
    }
  }

  updateCamera(rdt) {
    const cam = this.cameras.main; const tk = this.playerTank;
    if (this.camOverride || !tk) return super.updateCamera(rdt);
    const ptr = this.input.activePointer;
    const tx = tk.x + 220 * tk.vis.facing + (ptr.x - 640) * 0.35, ty = G - 270 + (ptr.y - 360) * 0.15;
    const k = Math.min(1, rdt * 5);
    this.camFollow.x += (tx - this.camFollow.x) * k; this.camFollow.y += (ty - this.camFollow.y) * k;
    cam.zoom += (0.74 - cam.zoom) * Math.min(1, rdt * 3);
  }
}
