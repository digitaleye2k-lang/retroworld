// MISSION 02 — EXTRACTION (stage 1): fight through the dawn battlefield to LZ HAMMER.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { Helicopter } from '../entities/Helicopter.js';
import { APC, Truck, AllyTank } from '../entities/Vehicles.js';
import { Informant } from '../entities/Boss.js';

const G = 940;
const rand = (a, b) => a + Math.random() * (b - a);

export class Mission2 extends BaseMission {
  constructor() { super('Mission2'); }
  get missionId() { return 2; }
  get stageIndex() { return 0; }
  get levelWidth() { return 13200; }
  get themeName() { return 'dawn'; }
  get lightingOpts() { return null; }

  buildLevel() {
    const L = this.level;
    L.background();
    this.spawnPoint = { x: 260, y: G };
    L.ground(0, 2400, G, 'dirt');
    L.ground(2400, 3400, G, 'asphalt');
    L.ground(5800, 7400, G, 'dirt');
    // section A trenches
    for (const x of [820, 1180, 1540, 1920]) L.sandbags(x, G);
    L.decor('wreck', 1000, G, { depth: DEPTH.decorBack, tint: 0x8a7a70 });
    L.crate(1350, G); L.barrel(1700, G); L.jersey(2240, G);
    L.decor('tent', 600, G, { depth: DEPTH.decorBack, tint: 0xa09080 });
    // section B ruins
    L.building(2500, G, 300, 360, { lit: 0, color: '#2a2422', depth: DEPTH.backdrop });
    L.crate(2620, G, 1, true); L.sandbags(2900, G); L.jersey(3150, G);
    this.collapseBld = L.building(3260, G, 380, 470, { lit: 0.05, color: '#2e2826', depth: DEPTH.backdrop + 2, destructible: true });
    L.wall(3260, G - 120, 30, 120); // low wall remnant (cover)
    L.crate(3760, G); L.barrel(3840, G);
    // section C armour
    L.jersey(4250, G); L.container(4600, G, 'green'); L.sandbags(4950, G); L.crate(5250, G, 1, true);
    this.barricade = L.block(5560, G - 150, 50, 150, { tex: 'tex_metal' });
    this.supplyCrate(4100, G);
    // section D
    L.building(6100, G, 380, 280, { lit: 0.1, color: '#2b2523' });
    L.building(6900, G, 420, 300, { lit: 0.1, color: '#2b2523', roof: true });
    L.crate(6000, G); L.barrel(6350, G); L.jersey(6600, G); L.sandbags(7400, G); L.barrel(7550, G);
    L.decor('wreck', 6750, G, { depth: DEPTH.decorBack, tint: 0x8a7a70, flip: true });
    // ---- village (Rook's last stand) ----
    for (const [x, w, h] of [[7750, 260, 220], [8150, 300, 300], [8750, 240, 190], [10150, 320, 260], [10600, 260, 210]]) L.building(x, G, w, h, { lit: 0, color: '#2a2422', depth: DEPTH.backdrop });
    this.church = L.building(9250, G, 360, 340, { lit: 0.05, color: '#2c2624', depth: DEPTH.backdrop, sign: 'ST. ILYA' });
    L.decor('tower', 9700, G, { depth: DEPTH.backdrop + 2 });
    L.platform(9625, G - 250, 150, { rail: true, supportTo: G });
    L.ladder(9640, G - 250, G);
    L.sandbags(7900, G); L.crate(8450, G); L.crate(8450, G - 54); L.barrel(8600, G); L.jersey(9050, G);
    L.decor('wreck', 9900, G, { depth: DEPTH.decorBack, tint: 0x8a7a70 });
    L.sandbags(10050, G); L.crate(10450, G, 1, true); L.barrel(10800, G); L.jersey(10950, G);
    this.fountain = L.prop('jersey', 9450, G, { solid: true, cover: true, scale: 1.2 });
    for (const x of [8000, 8900, 10300]) this.fx.fireSource(x, G + 2, 0.7, 0);
    this.supplyCrate(9200, G);
    // LZ
    L.sandbags(11450, G); L.jersey(12100, G); L.crate(12300, G, 1, true); L.sandbags(12500, G);
    this.supplyCrate(11300, G);
    this.lzMark = this.add.image(11800, G - 4, 'glow').setTint(0x40ff70).setBlendMode('ADD').setScale(1.6, 0.25).setAlpha(0.6).setDepth(DEPTH.decorBack);
    this.tweens.add({ targets: this.lzMark, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
    // atmosphere: smoke columns & embers drifting
    for (const x of [700, 2100, 3500, 5200, 6800, 12700]) this.fx.fireSource(x + 200, G + 2, 0.5, 0);
    this.add.particles(0, 0, 'ember', { x: { min: 0, max: 1600 }, y: 760, speedY: { min: -60, max: -20 }, speedX: { min: -30, max: 30 }, lifespan: 4000, frequency: 120, scale: { start: 0.8, end: 0 }, blendMode: 'ADD' }).setScrollFactor(0).setDepth(DEPTH.weather);
    this.artilleryOn = false; this.artT = 3;
    this.addTraffic({ y: 486, tint: 0x3c2c32, row: 2, rate: 5 });
  }

  setupMission() {
    this.addCheckpoint(260, G);
    this.addCheckpoint(2420, G, { restore() { this.spawnCompanions(2350); this.setObjective('Push through the ruins', { x: 3900, y: G - 60 }); Music.play('combat'); } });
    this.addCheckpoint(3950, G, { restore() { this.spawnCompanions(3850); if (!this.collapseBld.dead) this.level.collapse(this.collapseBld); this.objectiveArmour(); Music.play('combat'); } });
    this.addCheckpoint(5700, G, { restore() { this.spawnCompanions(5650); this.removeBarricade(true); this.setObjective('Reach LZ HAMMER', { x: 11800, y: G - 60 }); Music.play('combat'); } });
    this.addCheckpoint(7700, G, { restore() { this.spawnCompanions(7650); this.objectiveVillage(); Music.play('combat'); } });
    this.addCheckpoint(9300, G, { auto: false, restore() { this.rookFell = true; this.spawnCompanions(9200); this.afterRook(); } });
    this.addCheckpoint(11100, G, { auto: true, restore() { this.rookFell = this.rookFell || this.registry.get('rookFell'); this.spawnCompanions(11050); Music.play('combat'); } });

    this.addTrigger(-1, () => this.spawnA());
    this.addTrigger(600, () => { this.artilleryOn = true; this.hud.notify('INCOMING ARTILLERY — KEEP MOVING', '#ff4a3a'); });
    this.addTrigger(2450, () => { this.artilleryOn = false; this.rappelWave(2900, 'B'); });
    this.addTrigger(3150, () => this.collapseScene());
    this.addTrigger(3950, () => this.spawnArmour());
    this.addTrigger(5650, () => this.spawnD(), { respawnUntil: 6200 });
    this.addTrigger(7700, () => this.startVillage());
    this.addTrigger(9150, () => this.rookScene());
    this.addTrigger(11100, () => this.startLZ());
    this.interactables.push({ x: 4100, y: G - 30, radius: 90, label: 'Take M-90 HAMMER launcher', hold: 300, enabled: true, onUse: () => this.takeLauncher() });
    this.launcherProp = this.add.image(4140, G - 6, 'rocket').setScale(2).setOrigin(0.5, 1).setDepth(DEPTH.decorBack + 2).setRotation(-0.2);
    this.updaters.push((dt) => this.updateArtillery(dt));
    this.updaters.push((dt) => this.ambientBattle(dt));
  }

  spawnCompanions(x) {
    if (!this.sparrow) { this.sparrow = new Informant(this, x - 60, G); this.sparrow.free(); }
    if (!this.allySquad) {
      this.allySquad = [this.spawnAlly(x - 180, G, { facing: 1, weapon: 'e_lmg' })];
      if (!this.rookFell) {
        const rook = this.rook = this.spawnAlly(x - 120, G, { facing: 1 });
        rook.invulnerable = true; rook.allyIdx = 0;
        rook.tag = this.add.text(0, 0, 'ROOK', { fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', fontStyle: '700', color: '#7cffb0' }).setOrigin(0.5).setDepth(DEPTH.fxTop).setAlpha(0.8);
        this.updaters.push(() => { if (rook.tag) rook.tag.setPosition(rook.x, rook.y - (rook.seated ? 70 : 104)); });
        this.allySquad.push(rook);
      }
    }
  }

  onStart() {
    Music.play('heli');
    this.registry.set('rookFell', false);
    this.spawnCompanions(260);
    const tank = new AllyTank(this, -200, G, { stopX: 1500, speed: 55 }); this.vehicles.push(tank);
    this.cutscene(async () => {
      this.camTo(700, G - 260, 0.85);
      // low flyover of friendly helicopters in the foreground
      for (let i = 0; i < 2; i++) {
        this.time.delayedCall(i * 700, () => {
          const h = new Helicopter(this, -400, G - 520 + i * 70, { kind: 'ally', scale: 1.7, depth: DEPTH.foreground, tint: 0x3a3030, speed: 700, lightTint: false, loud: 1.4 });
          h.moveTo(3200, G - 640 - i * 40, 700); this.helis.push(h);
          this.time.delayedCall(6000, () => { h.destroy(); this.helis = this.helis.filter((q) => q !== h); });
        });
      }
      AudioEngine.play('heliflyby', { vol: 1, gap: 3000 });
      await this.wait(1200);
      this.fx.shake(800, 0.01);
      await this.say('OVERLORD', 'Echo-6, Varkov\'s army is pushing into the valley. Our armour is holding the road.', 3200);
      await this.say('ROOK', 'Told you I’d make it down. Miss me?', 2200);
      await this.say('GHOST', 'SPARROW, keep your head down and stay behind me.', 2400);
      await this.say('OVERLORD', 'LZ HAMMER is three klicks east. Viper 2-1 is waiting. Move!', 2800);
      this.say('VIPER 2-1', 'Hornets inbound — dropping on the enemy line now!', 2400);
      this.jetFlyby({ dir: 1, strike: [1900, 2150, 2400] });
      await this.wait(2600);
    }).then(() => {
      this.setObjective('Fight through to LZ HAMMER', { x: 2400, y: G - 60 });
      Music.play('combat'); this.encounterActive = true;
    });
  }

  spawnA() {
    this.spawnSoldier('rifleman', 1300, G, { state: 'combat' });
    this.spawnSoldier('rifleman', 1650, G, { state: 'combat' });
    this.spawnSoldier('heavy', 2100, G, { state: 'combat' });
    this.spawnSoldier('rifleman', 2000, G, { state: 'combat' });
    this.spawnSoldier('shotgunner', 2300, G, { state: 'combat' });
  }

  rappelWave(x, tag) {
    const h = new Helicopter(this, x + 1400, G - 560, { kind: 'ally', enemy: true, speed: 420, searchlight: true });
    this.helis.push(h); h.searchTarget = this.player;
    h.moveTo(x, G - 470, 420);
    this.hud.notify('ENEMY HELICOPTER INBOUND', '#ff4a3a');
    const ev = this.time.addEvent({ delay: 200, loop: true, callback: () => {
      if (h.arrived(40)) {
        ev.remove();
        h.rappel(tag === 'LZ' ? ['rifleman', 'shotgunner', 'rifleman'] : ['rifleman', 'shotgunner', 'rifleman', 'heavy'], { gap: 700 });
        this.time.delayedCall(4200, () => { h.moveTo(x + 2200, G - 900, 380); this.time.delayedCall(6000, () => { h.destroy(); this.helis = this.helis.filter((q) => q !== h); }); });
      }
    } });
  }

  async collapseScene() {
    if (this.collapseBld.dead) return;
    this.hud.notify('ENEMY TANK — TAKE COVER!', '#ff4a3a');
    AudioEngine.play('incoming');
    await this.wait(700);
    this.fx.explosion(3450, G - 300, { radius: 200 });
    this.setSlowmo(0.3, 2600);
    this.level.collapse(this.collapseBld, { push: -0.3 });
    // falling debris hurts whoever is under it
    this.time.delayedCall(500, () => {
      const p = this.player; if (p.x > 3240 && p.x < 3660) p.takeDamage(30, { x: p.x, y: p.y - 200, explosive: true, angle: Math.PI / 2 });
      for (const e of this.enemies) if (e.alive && e.x > 3240 && e.x < 3660) e.takeDamage(200, { explosive: true, x: e.x, y: e.y - 100, angle: Math.PI / 2 });
    });
    this.say('OVERLORD', 'That was a T-90 round! Armour is moving on your position!', 3000);
    this.reachCheckpoint(2);
  }

  spawnArmour() {
    this.objectiveArmour();
    const apc = this.apc = new APC(this, 6100, G, { facing: -1, stopX: 5050 });
    this.vehicles.push(apc);
    apc.onDestroyed = () => {
      this.hud.setBoss(null);
      this.hud.bigText('ARMOUR DESTROYED', '#ffc34d', 1800);
      this.time.delayedCall(800, () => { this.removeBarricade(false); this.setObjective('Reach LZ HAMMER', { x: 11800, y: G - 60 }); });
    };
    this.hud.setBoss(apc, 'BTR-K ARMOURED CARRIER');
    this.spawnSoldier('rifleman', 5200, G, { state: 'combat' });
    this.spawnSoldier('rifleman', 5350, G, { state: 'combat' });
    this.time.delayedCall(9000, () => { if (apc.alive) this.spawnSoldier('shotgunner', 5450, G, { state: 'combat' }); });
    this.say('GHOST', 'APC! Rifles won\'t touch it — need that launcher.', 2600);
  }
  objectiveArmour() { this.setObjective('Grab the launcher and destroy the APC', { x: 4100, y: G - 60 }); }

  takeLauncher() {
    this.launcherProp.destroy();
    this.player.giveWeapon('launcher');
    this.hud.notify('M-90 HAMMER ACQUIRED · SLOT 5', '#ffc34d');
    if (this.apc && this.apc.alive) this.setObjective('Destroy the APC', { x: () => this.apc.x, y: () => G - 80, get alive() { return true; } });
  }

  removeBarricade(instant) {
    if (!this.barricade || this.barricade.dead) return;
    if (!instant) { this.fx.explosion(5585, G - 70, { radius: 130 }); this.fx.chunk(5585, G - 80, -60, 14, 500); }
    this.barricade.visuals.forEach((v) => v.destroy());
    this.level.removeSolid(this.barricade);
    if (this.apc === undefined && instant) { /* restored past APC */ }
  }

  spawnD() {
    const truck = new Truck(this, 7600, G, { facing: -1, stopX: 6700 }); this.vehicles.push(truck);
    this.spawnSoldier('sniper', 7050, G - 300, { state: 'combat', hold: true });
    this.spawnSoldier('rifleman', 6250, G, { state: 'combat' });
    this.spawnSoldier('rifleman', 6900, G, { state: 'combat' });
    this.spawnSoldier('heavy', 7300, G, { state: 'combat' });
    this.hud.notify('TECHNICAL INBOUND', '#ff4a3a');
  }

  startLZ() {
    this.reachCheckpoint(6);
    this.lzTime = 40; this.lzActive = true;
    this.setObjective('Hold LZ HAMMER until Viper 2-1 lands', { x: 11800, y: G - 60 });
    Music.play('boss');
    this.say('VIPER 2-1', 'Viper 2-1, forty seconds out. Keep that LZ clear!', 2800);
    this.spawnSoldier('rifleman', 12500, G, { state: 'combat' });
    this.spawnSoldier('shotgunner', 12650, G, { state: 'combat' });
    this.time.delayedCall(9000, () => this.rappelWave(12200, 'LZ'));
    this.time.delayedCall(20000, () => { for (let i = 0; i < 3; i++) this.spawnSoldier(i === 1 ? 'heavy' : 'rifleman', 12650 + i * 40, G, { state: 'combat' }); });
    this.time.delayedCall(28000, () => { const t = new Truck(this, 13000, G, { facing: -1, stopX: 12400 }); this.vehicles.push(t); });
  }

  async boardHeli() {
    this.lzActive = false;
    await this.cutscene(async () => {
      const v = new Helicopter(this, 10400, G - 700, { kind: 'ally', speed: 420 }); this.helis.push(v);
      v.moveTo(11820, G - 120, 420);
      this.camTo(11800, G - 250, 0.85);
      for (const e of this.enemies) if (e.alive && !e.isVehicle) e.takeDamage(9999, { angle: Math.PI, knock: 300 });
      // Viper's door gun clears the LZ
      for (let i = 0; i < 24; i++) this.time.delayedCall(1200 + i * 70, () => { const a = 0.3 + Math.random() * 0.3; this.combat.fire({ x: v.x + 30, y: v.y + 10, angle: a, speed: 2600, damage: 50, team: 'player', range: 1600, color: 0xffd27a }); AudioEngine.play('doorgun', { gap: 40 }); });
      await this.say('VIPER 2-1', 'Viper on station! Get in, get in!', 2800);
      await this.wait(800);
      this.sparrow.setPosition(11800, G); this.sparrow.visible = false;
      this.player.visible = false;
      if (this.rookFell) await this.say('VIPER 2-1', 'Where\'s Rook? ...Copy. I\'m sorry, Ghost.', 2800);
      await this.say('VIPER 2-1', 'Ghost, you\'re on the door gun. Hang on, this ride\'s going to be hot.', 3000);
      v.moveTo(13200, G - 600, 400);
      await this.wait(1600);
    });
    this.allowComplete = true;
    this.completeStage();
  }

  // ---------------- the village ----------------
  objectiveVillage() { this.setObjective('Push through the village', { x: 9300, y: G - 60 }); }

  startVillage() {
    this.objectiveVillage();
    this.say('ROOK', 'Village ahead. Too quiet. Eyes on the windows.', 2600);
    for (const [t, x] of [['rifleman', 8250], ['shotgunner', 8500], ['rifleman', 8800], ['heavy', 9000], ['rifleman', 10200], ['rifleman', 10500]]) this.spawnSoldier(t, x, G, { state: 'combat', facing: -1 });
    this.time.delayedCall(6000, () => { this.artilleryOn = true; });
    this.time.delayedCall(16000, () => { this.artilleryOn = false; });
  }

  // a sniper in the bell tower lines up on SPARROW; Rook takes the bullet
  async rookScene() {
    if (this.rookFell || !this.rook || !this.rook.alive) return;
    this.artilleryOn = false;
    const rook = this.rook, sp = this.sparrow, p = this.player;
    const sniper = this.towerSniper = this.spawnSoldier('sniper', 9700, G - 250, { state: 'scripted', facing: -1, hold: true });
    sniper.invulnerable = true;
    await this.cutscene(async () => {
      rook.state = 'scripted'; sp.state = 'script';
      sp.setPosition(9330, G); rook.setPosition(9230, G); p.scriptFacing = 1;
      this.camTo(9450, G - 200, 1.0);
      await this.wait(500);
      // the laser finds SPARROW
      sniper.aim = Math.atan2(sp.y - 60 - (G - 310), sp.x - 9700); sniper.aimTarget = sniper.aim; sniper.lowered = false; sniper.laser = 0.2;
      this.time.addEvent({ delay: 30, repeat: 40, callback: () => { sniper.laser = Math.min(1, sniper.laser + 0.025); } });
      await this.say('ROOK', 'SNIPER! SPARROW, DOWN!', 1400);
      this.setSlowmo(0.22, 3600);
      this.walkTo(rook, 9320, 260);
      await this.wait(500);
      sp.setPosition(9390, G); sp.crouch = 1;
      AudioEngine.play('sniper', { x: 9700 });
      this.fx.muzzle(9690, G - 300, Math.PI - 0.3, 1.4);
      this.combat.fire({ x: 9690, y: G - 300, angle: Math.atan2(rook.y - 55 - (G - 300), rook.x - 9690), speed: 3200, damage: 1, team: 'enemy', range: 700, color: 0xff5050, width: 3 });
      sniper.laser = -1;
      await this.wait(260);
      AudioEngine.play('headshot', { x: rook.x }); this.fx.impact(rook.x, rook.y - 55, Math.PI, 'flesh');
      this.rookPool = this.wound(rook);
      Music.play('sad');
      await this.wait(900);
      await this.say('GHOST', 'ROOK!', 1400);
      await this.say('ROOK', 'I\'m good... I\'m good. Take that tower!', 2400);
    });
    p.scriptFacing = 0;
    sp.state = 'hide'; sp.hidePoint = 9200;
    sniper.invulnerable = false; sniper.state = 'combat'; sniper.awareness = 1; sniper.reactT = 1.2;
    Music.play('combat');
    this.setObjective('Kill the sniper in the bell tower', { x: () => sniper.x, y: () => sniper.y - 60, get alive() { return sniper.alive; } });
    this.spawnSoldier('rifleman', 10100, G, { state: 'combat' }); this.spawnSoldier('shotgunner', 10300, G, { state: 'combat' });
  }

  onKill(s) {
    if (s === this.towerSniper && !this.rookFell) this.time.delayedCall(1500, () => this.rookFarewell());
  }

  async rookFarewell() {
    const rook = this.rook, p = this.player;
    for (const e of this.enemies) if (e.alive && !e.isVehicle && Math.abs(e.x - 9500) < 1400) e.takeDamage(9999, { angle: 0 });
    await this.cutscene(async () => {
      Music.play('sad');
      this.camTo(rook.x + 30, G - 110, 1.45);
      await this.walkTo(p, rook.x + 46, 150);
      p.scriptFacing = -1; p.scriptLowered = true; p.scriptCrouch = true;
      this.hud.fade(false);
      await this.wait(600);
      await this.say('GHOST', 'Hey. Hey, look at me. Medevac is two minutes out.', 3000);
      await this.say('ROOK', 'Don\'t... don\'t do the voice, Ghost. I know.', 3000);
      await this.say('ROOK', 'Guess I picked the wrong day to be a hero, huh?', 3000);
      await this.say('GHOST', 'You did good. He\'s alive because of you.', 2800);
      await this.say('ROOK', 'Tell Anna... tell her I kept the promise. I came back for the guy.', 3600);
      await this.say('ROOK', 'Drinks were on you... remember that.', 2800);
      await this.wait(600);
      rook.invulnerable = false; rook.seated = false;
      rook.die({ angle: Math.PI, knock: 20 });
      if (rook.tag) { rook.tag.destroy(); rook.tag = null; }
      await this.wait(1500);
      await this.say('SPARROW', 'He... he didn\'t even know me.', 2600);
      await this.say('GHOST', 'He knew enough.', 2200);
      this.hud.fade(true, 1200);
      await this.wait(1400);
      this.hud.chapterCard('SGT. ELIAS "ROOK" HAYES', 'ECHO-6  ·  KIA', 3400);
      await this.wait(1800);
      this.hud.fade(false, 1600);
      await this.wait(1600);
      p.scriptLowered = false; p.scriptCrouch = false;
    });
    p.scriptFacing = 0;
    this.rookFell = true; this.registry.set('rookFell', true);
    this.allySquad = this.allySquad.filter((a) => a !== rook);
    this.reachCheckpoint(5);
    this.interactables.push({ x: rook.x, y: G - 20, radius: 80, label: 'Take Rook\'s dog tags', hold: 1200, enabled: true, onUse: () => {
      AudioEngine.play('pickup'); this.hud.notify('ROOK\'S DOG TAGS', '#c9d4da');
      this.say('GHOST', 'Let\'s go. We finish this for him.', 2400);
      this.afterRook();
    } });
    this.setObjective('Take Rook\'s dog tags', { x: rook.x, y: G - 60 });
  }

  afterRook() {
    this.registry.set('rookFell', true);
    if (this.sparrow) { this.sparrow.state = 'follow'; }
    Music.play('tension');
    this.setObjective('Reach LZ HAMMER', { x: 11800, y: G - 60 });
  }

  updateArtillery(dt) {
    if (!this.artilleryOn || this.ended) return;
    this.artT -= dt;
    if (this.artT <= 0) {
      this.artT = rand(2.8, 4.8);
      const p = this.player; const x = p.x + rand(-160, 420) + p.body.velocity.x * 0.8;
      this.artilleryStrike(x);
    }
  }

  artilleryStrike(x) {
    const gy = this.groundBelow(x, G - 300) ?? G;
    const m = this.add.image(x, gy - 4, 'glow').setTint(0xff2a1a).setBlendMode('ADD').setScale(1.0, 0.2).setDepth(DEPTH.fx);
    this.tweens.add({ targets: m, alpha: 0.2, yoyo: true, repeat: -1, duration: 100 });
    AudioEngine.play('incoming', { x });
    this.time.delayedCall(1300, () => { m.destroy(); this.fx.explosion(x, gy - 10, { radius: 150, damage: 55, owner: 'world' }); });
  }

  ambientBattle(dt) {
    // distant muzzle flashes and tracer fire beyond the front line
    if (Math.random() < dt * 2.5) {
      const cam = this.cameras.main; const x = cam.worldView.x + Math.random() * cam.worldView.width; const y = G - 340 - Math.random() * 120;
      const f = this.add.image(x, y, 'glow').setTint(0xffb060).setBlendMode('ADD').setScale(0.3 + Math.random() * 0.5).setDepth(DEPTH.mid + 0.5).setAlpha(0.8);
      this.tweens.add({ targets: f, alpha: 0, scale: 0.1, duration: 300, onComplete: () => f.destroy() });
      if (Math.random() < 0.3) AudioEngine.play('explosion', { x: x + 2000, vol: 0.15, gap: 600 });
    }
  }

  tick(dt) {
    if (this.lzActive) {
      this.lzTime -= dt;
      this.hudTimerText = 'VIPER ETA: ' + Math.max(0, Math.ceil(this.lzTime)) + 's';
      if (this.lzTime <= 0) { this.hudTimerText = ''; this.boardHeli(); }
    }
  }
}
