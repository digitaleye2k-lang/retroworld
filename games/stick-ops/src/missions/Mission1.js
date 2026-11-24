// MISSION 01 — NIGHTFALL: night infiltration, security sabotage, slow-mo breach, rescue, boss.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { Helicopter } from '../entities/Helicopter.js';
import { Juggernaut, Informant } from '../entities/Boss.js';

const G = 940;

export class Mission1 extends BaseMission {
  constructor() { super('Mission1'); }
  get missionId() { return 1; }
  get stageIndex() { return 0; }
  get levelWidth() { return 10200; }
  get themeName() { return 'night'; }
  get lightingOpts() { return { ambient: 0x01040a, darkness: 0.62 }; }

  buildLevel() {
    const L = this.level;
    L.background();
    this.spawnPoint = { x: 330, y: G };
    this.stealthHud = true;
    // ground
    L.ground(0, 1000, G, 'dirt');
    L.ground(1000, 6000, G, 'concrete');
    L.ground(7000, 2400, G, 'concrete');
    L.ground(9400, 800, G, 'dirt');
    // ---- motor pool (escape route) ----
    L.container(7450, G, 'green'); L.jersey(7700, G); L.decor('wreck', 7950, G, { depth: DEPTH.decorBack, tint: 0x777777 });
    L.crate(8150, G, 1, true); L.crate(8150, G - 54); L.sandbags(8400, G); L.container(8700, G, 'blue', true);
    L.barrel(7600, G); L.barrel(8300, G); L.barrel(8950, G); L.jersey(9150, G);
    L.lamp(7800, G); L.lamp(8600, G); L.building(7300, G, 600, 280, { lit: 0.2, sign: 'MOTOR POOL', depth: DEPTH.backdrop - 1, tint: 0x888888 });
    this.supplyCrate(7250, G);
    L.fence(560, 380, G); L.fence(1010, 2400, G - 0, DEPTH.backdrop + 1);
    L.decor('wreck', 200, G, { depth: DEPTH.decorBack, tint: 0x666666 });
    // ---- outer yard ----
    L.crate(1250, G); L.crate(1250, G - 54);
    L.lamp(1400, G);
    L.sandbags(1540, G);
    L.container(1760, G, 'blue');
    L.decor('tower', 2000, G, { depth: DEPTH.backdrop + 2 });
    this.towerPlat = L.platform(1925, G - 250, 150, { rail: true, supportTo: G });
    L.ladder(1940, G - 250, G);
    L.crate(2120, G); L.crate(2175, G, 1, true); L.crate(2148, G - 54);
    L.lamp(2200, G);
    L.prop('generator', 2380, G, { depth: DEPTH.decorBack + 2 });
    this.barrelA = L.barrel(2490, G);
    L.jersey(2620, G);
    // ---- inner yard ----
    L.container(2880, G, 'red');
    L.container(2880, G - 120, 'green', true);
    L.crate(3040, G);
    L.building(3150, G, 520, 330, { lit: 0.25, sign: 'BARRACKS' });
    L.decor('door', 3330, G, { depth: DEPTH.backdrop + 1 });
    L.platform(3060, G - 190, 560, { supportTo: G });
    L.ladder(3600, G - 190, G);
    L.prop('terminal', 3480, G - 190, { depth: DEPTH.decorBack + 2 });
    L.lamp(3720, G);
    this.barrelB = L.barrel(3660, G);
    L.jersey(3860, G);
    L.crate(4060, G, 1, true);
    L.sandbags(4220, G);
    // ---- holding block ----
    L.building(4300, G, 1200, 420, { lit: 0.1, sign: 'BLOCK C' });
    L.block(4300, G - 420, 1200, 40, { tex: 'tex_concrete' });       // roof slab
    L.wall(4300, G - 380, 40, 140);                                     // above door
    this.doorSolid = L.block(4300, G - 240, 40, 240, { tex: 'tex_metal' });
    this.add.rectangle(4340, G - 380, 1120, 380, 0x0b0e10, 1).setOrigin(0, 0).setDepth(DEPTH.backdrop + 1);
    for (let x = 4400; x < 5450; x += 120) this.add.rectangle(x, G - 380, 6, 380, 0x14181b, 1).setOrigin(0, 0).setDepth(DEPTH.backdrop + 1);
    this.roomLights = [];
    for (const x of [4600, 4900, 5200]) { this.add.rectangle(x, G - 370, 2, 40, 0x111111).setOrigin(0.5, 0).setDepth(DEPTH.backdrop + 2); this.roomLights.push(this.lighting.add({ x, y: G - 325, r: 260, i: 0.9, color: 0xffd49a, flicker: 0.1, glowAlpha: 0.25 })); }
    this.chair = this.add.rectangle(5010, G - 26, 30, 4, 0x2a2a2a).setDepth(DEPTH.decorBack + 3);
    L.crate(4750, G); L.crate(5250, G, 1, true);
    this.backDoor = L.block(5460, G - 380, 40, 380, { tex: 'tex_metal' });
    // ---- courtyard ----
    L.jersey(5760, G); L.sandbags(6080, G); L.jersey(6420, G);
    this.courtBarrels = [L.barrel(5900, G), L.barrel(6260, G), L.barrel(6600, G)];
    L.crate(6150, G, 1, true);
    L.container(6760, G, 'red');
    L.lamp(5650, G); L.lamp(6550, G);
    L.building(5600, G - 0, 400, 260, { lit: 0.3, depth: DEPTH.backdrop - 1, tint: 0x888888 });
    L.building(6300, G, 500, 300, { lit: 0.3, depth: DEPTH.backdrop - 1, tint: 0x888888 });
    this.gate = this.add.rectangle(6990, G - 200, 20, 200, 0x1c2226).setOrigin(0.5, 0).setDepth(DEPTH.decorBack);
    L.fence(7020, 300, G);
    // ---- extraction ----
    this.lzMark = this.add.image(9850, G - 4, 'glow').setTint(0x40ff70).setBlendMode('ADD').setScale(1.4, 0.25).setAlpha(0.6).setDepth(DEPTH.decorBack);
    this.tweens.add({ targets: this.lzMark, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
    // grid lights list (lamps registered by Level.lamp -> lighting) become "grid" lights
    this.gridLights = this.lighting.lights.filter((l) => l.cone && !this.roomLights.includes(l));
    // searchlight on tower
    this.searchLight = this.lighting.add({ x: 2000, y: G - 300, cone: { angle: 1.9, len: 520, width: 170 }, i: 1, color: 0xe8f4ff, glowAlpha: 0.2 });
    this.gridLights.push(this.searchLight);
    // rain
    this.add.particles(0, 0, 'rain', { x: { min: -300, max: 1700 }, y: -30, speedY: { min: 900, max: 1100 }, speedX: -120, lifespan: 900, quantity: 3, frequency: 16, alpha: { start: 0.5, end: 0.2 } }).setScrollFactor(0).setDepth(DEPTH.weather);
    this.gridOff = false; this.alarm = false; this.gens = 0;
  }

  setupMission() {
    // checkpoints: 0 start, 1 generator, 2 grid off, 3 rescued, 4 boss down
    this.calmMusic = 'stealth';
    this.addTrigger(7300, () => this.spawnMotorPool());
    this.addCheckpoint(330, G);
    this.addCheckpoint(2380, G, { auto: false, restore() { this.genDone = true; this.objectiveTerminal(); Music.play('stealth'); } });
    this.addCheckpoint(3480, G - 190, { auto: false, restore() { this.genDone = true; this.cutGrid(true); this.objectiveBreach(); } });
    this.addCheckpoint(5000, G, { auto: false, restore() { this.genDone = true; this.cutGrid(true); this.doorSolid && this.level.removeSolid(this.doorSolid); this.doorSolid.visuals.forEach((v) => v.destroy()); this.openBackDoor(); this.spawnSparrow(true); this.objectiveExit(); } });
    this.addCheckpoint(6400, G, { auto: false, restore() { this.genDone = true; this.cutGrid(true); this.level.removeSolid(this.doorSolid); this.doorSolid.visuals.forEach((v) => v.destroy()); this.openBackDoor(); this.spawnSparrow(true); this.bossDone = true; this.objectiveExtract(); } });

    // section spawns
    this.addTrigger(-1, () => this.spawnOuterYard());
    this.addTrigger(1000, () => { if (!this.genDone) this.setObjective('Sabotage the compound generator', { x: 2380, y: G - 60 }); });
    this.addTrigger(2300, () => this.spawnInnerYard(), { respawnUntil: 4000 });
    this.addTrigger(4000, () => this.spawnHoldingBlock());
    this.addTrigger(5600, () => this.startBoss());

    // interactables
    this.interactables.push({ x: 2380, y: G - 30, radius: 80, label: 'Sabotage generator', hold: 2200, enabled: true, onUse: () => this.sabotageGenerator() });
    this.terminal = { x: 3480, y: G - 220, radius: 70, label: 'Hack security terminal', hold: 3000, enabled: false, onUse: () => this.hackTerminal() };
    this.interactables.push(this.terminal);
    this.breachIt = { x: 4270, y: G - 30, radius: 80, label: 'Plant breaching charge', hold: 900, enabled: false, onUse: () => this.breach() };
    this.interactables.push(this.breachIt);
    this.supplyCrate(3000, G - 240);
    this.supplyCrate(5560, G);

    this.updaters.push((dt) => this.updateSearchlight(dt));
  }

  onStart() {
    Music.play('stealth');
    this.startRain();
    this.cutscene(async () => {
      await this.chapter('NIGHTFALL', 'KARVOSK COMPOUND  -  02:40 LOCAL', 3000);
      const heli = new Helicopter(this, -300, G - 520, { kind: 'ally', facing: 1, speed: 320 });
      this.helis.push(heli); this.heli = heli;
      const p = this.player; p.visible = false; p.body.setAllowGravity(false); p.setPosition(330, G - 400);
      this.camTo(330, G - 260, 0.9);
      heli.moveTo(360, G - 500, 320);
      await this.wait(2800);
      this.say('VIPER 2-1', 'Over the drop. Rope is out. Go, go!', 2200);
      p.visible = true;
      const rope = this.add.graphics().setDepth(DEPTH.actors - 1);
      const t0 = this.time.now;
      await new Promise((res) => {
        const ev = this.time.addEvent({ delay: 16, loop: true, callback: () => {
          const k = Math.min(1, (this.time.now - t0) / 1900);
          p.setPosition(330, G - 400 + k * 400); p.body.setVelocity(0, 0);
          rope.clear(); rope.lineStyle(2, 0x3a3328, 1); rope.lineBetween(heli.x + 25, heli.y + 10, 330, G - 70 + Math.sin(this.time.now / 200) * 4);
          if (k >= 1) { ev.remove(); res(); }
        } });
      });
      p.body.setAllowGravity(true);
      this.fx.burst('dust', 330, G, 6, -90, 160, 30, 90);
      await this.wait(400);
      heli.moveTo(-600, G - 700, 360);
      this.tweens.add({ targets: rope, alpha: 0, duration: 800, onComplete: () => rope.destroy() });
      this.camTo(1500, G - 200, 0.8);
      await this.say('OVERLORD', 'Ghost, this is Overlord. Karvosk compound is due east. Stay in the shadows.', 3200);
      await this.say('OVERLORD', 'Kill the generator and the security grid goes dark. Guards won\'t see you coming.', 3200);
      await this.say('ROOK', 'Rook on overwatch. I\'ve got eyes on the yard, Ghost. Bring him home.', 3000);
      await this.say('GHOST', 'Copy, Rook. Drinks are on me when we\'re out.', 2400);
      this.camRelease();
      this.time.delayedCall(6000, () => { if (heli.alive && heli.x < -400) { heli.destroy(); this.helis = this.helis.filter((q) => q !== heli); } });
    }).then(() => {
      this.setObjective('Infiltrate the compound', { x: 1050, y: G - 60 });
      this.hud.notify('TIP: CROUCH (S) IN SHADOWS · F FOR SILENT TAKEDOWNS', '#9fb4c0');
    });
  }

  // ---------------- spawns ----------------
  spawnOuterYard() {
    const fl = { flashlight: true };
    this.spawnSoldier('rifleman', 1350, G, Object.assign({ patrol: [1150, 1600], facing: -1 }, fl));
    this.spawnSoldier('rifleman', 2100, G, Object.assign({ patrol: [1950, 2450], facing: 1 }, fl));
    this.towerGuard = this.spawnSoldier('sniper', 2000, G - 250, { facing: -1, hold: true });
    this.spawnSoldier('rifleman', 2560, G, { facing: -1 });
  }
  spawnInnerYard() {
    this.spawnSoldier('rifleman', 3200, G - 190, { patrol: [3080, 3560], facing: -1, flashlight: true });
    this.spawnSoldier('rifleman', 3300, G, { patrol: [3000, 3650], facing: 1, flashlight: true });
    this.spawnSoldier('shotgunner', 3800, G, { facing: -1 });
    this.spawnSoldier('rifleman', 4120, G, { facing: -1 });
    this.spawnSoldier('officer', 3950, G, { patrol: [3800, 4180], facing: -1, flashlight: true });
  }
  spawnHoldingBlock() {
    this.roomGuards = [
      this.spawnSoldier('rifleman', 4560, G, { facing: 1, state: 'scripted' }),
      this.spawnSoldier('shotgunner', 4820, G, { facing: -1, state: 'scripted' }),
      this.spawnSoldier('rifleman', 5160, G, { facing: -1, state: 'scripted' }),
      this.spawnSoldier('officer', 5330, G, { facing: -1, state: 'scripted' }),
    ];
    this.spawnSparrow(false);
    this.roomGuards.forEach((g) => { g.lowered = true; });
  }
  spawnSparrow(free) {
    if (this.sparrow) return;
    this.sparrow = new Informant(this, free ? 4950 : 5010, G);
    if (free) { this.sparrow.free(); }
  }

  // ---------------- objectives ----------------
  sabotageGenerator() {
    this.genDone = true;
    AudioEngine.play('door', { x: 2380 });
    this.fx.burst('spark', 2380, G - 50, 30, -90, 180, 100, 400);
    this.fx.burst('smoke', 2380, G - 60, 8, -90, 60, 20, 60);
    this.fx.fireSource(2400, G - 60, 0.4, 4000);
    this.searchLight.on = false;
    this.reachCheckpoint(1);
    this.say('OVERLORD', 'Main generator is down. Backup grid is still up — hack the terminal on the barracks catwalk.', 3600);
    this.objectiveTerminal();
  }
  objectiveTerminal() { this.searchLight.on = false; this.terminal.enabled = true; this.setObjective('Hack the security terminal (barracks catwalk)', { x: 3480, y: G - 250 }); }

  hackTerminal() {
    this.cutGrid(false);
    this.reachCheckpoint(2);
    this.objectiveBreach();
  }

  cutGrid(instant) {
    if (this.gridOff) return;
    this.gridOff = true; this.alarmOff = true; this.alarm = false;
    if (this.alarmTimer) this.alarmTimer.remove();
    if (this.alarmLoop) { this.alarmLoop.stop(); this.alarmLoop = null; }
    this.searchLight.on = false;
    const lights = this.gridLights;
    if (instant) { lights.forEach((l) => { l.on = false; }); this.lighting.ambient = 0x021208; this.lighting.darkness = 0.6; return; }
    AudioEngine.play('door');
    lights.forEach((l, i) => this.time.delayedCall(200 + i * 180, () => {
      l.on = false; this.time.delayedCall(80, () => { l.on = true; }); this.time.delayedCall(160, () => { l.on = false; });
      AudioEngine.play('hitmetal', { x: l.x, vol: 0.4 });
    }));
    this.time.delayedCall(300 + lights.length * 180, () => {
      this.tweens.add({ targets: this.lighting, darkness: 0.6, duration: 900 });
      this.lighting.ambient = 0x021208;
      this.hud.notify('SECURITY GRID OFFLINE · NVG ACTIVE', '#7cff9a');
      this.say('OVERLORD', 'Grid is dark. They\'re blind out there, Ghost. SPARROW is in Block C.', 3200);
    });
  }

  objectiveBreach() { this.breachIt.enabled = true; this.setObjective('Breach Block C and rescue SPARROW', { x: 4270, y: G - 80 }); }

  visibilityOf(p) { const v = super.visibilityOf(p); return this.gridOff ? Math.min(v, p.noise > 300 ? 1 : 0.42) : v; }

  onEnemyAlerted(e) {
    if (this.gridOff || this.alarm || this.cpIndex >= 2) return;
    this.alarm = true;
    this.hud.bigText('ALARM RAISED', '#ff4a3a', 1800);
    Music.play('combat');
    this.encounterActive = true;
    this.alarmLoop = AudioEngine.loopSample('alarmLoop', 'alarm', 0.3);
    if (!this.alarmLoop) { const sound = () => { if (this.alarm) AudioEngine.play('alarm'); }; sound(); this.alarmTimer = this.time.addEvent({ delay: 3000, loop: true, callback: sound }); }
    this.alarmLight = this.lighting.add({ x: 3330, y: G - 360, r: 400, i: 0.6, color: 0xff2010, glowAlpha: 0.4 });
    this.time.addEvent({ delay: 400, loop: true, callback: () => { if (this.alarmLight) this.alarmLight.on = this.alarm && !this.alarmLight.on; } });
    // reinforcements from the barracks
    this.reinforce = 0;
    this.time.addEvent({ delay: 9000, repeat: 1, callback: () => {
      if (!this.alarm) return;
      for (let i = 0; i < 2; i++) this.time.delayedCall(i * 700, () => { const s = this.spawnSoldier(i ? 'shotgunner' : 'rifleman', 3340, G, { state: 'combat', facing: -1 }); s.alert('alarm'); });
      this.hud.notify('ENEMY REINFORCEMENTS', '#ff4a3a');
    } });
    this.say('OVERLORD', 'You\'ve been made! Cut the grid and their alarm dies with it.', 3000);
  }

  async breach() {
    this.reachCheckpointLater = true;
    const p = this.player;
    await this.cutscene(async () => {
      this.camTo(4420, G - 160, 1.15);
      p.body.setVelocityX(0);
      await this.wait(400);
      AudioEngine.play('beep', { x: 4300 });
      const charge = this.add.rectangle(4296, G - 110, 6, 18, 0xff3020).setDepth(DEPTH.fxTop);
      await this.wait(400); AudioEngine.play('beep', { x: 4300 }); await this.wait(300); AudioEngine.play('beep', { x: 4300 }); await this.wait(250);
      charge.destroy();
      AudioEngine.play('breach', { x: 4300 });
      this.fx.explosion(4310, G - 110, { radius: 120 });
      this.level.removeSolid(this.doorSolid); this.doorSolid.visuals.forEach((v) => v.destroy());
      this.fx.chunk(4320, G - 120, 0, 18, 600);
      for (const g of this.roomGuards) { g.state = 'combat'; g.awareness = 1; g.lowered = false; g.reactT = 1.0 + Math.random() * 0.6; }
      this.camRelease();
    });
    this.setSlowmo(0.25, 3800);
    this.hud.bigText('BREACH', '#ffffff', 1200);
    this.encounterActive = true; Music.play('combat');
    this.setObjective('Clear the room — don\'t hit SPARROW', { x: 5010, y: G - 60 }, { silent: true });
    this.breachWatch = true;
  }

  onKill(s) {
    if (this.breachWatch && this.roomGuards && this.roomGuards.every((g) => !g.alive)) {
      this.breachWatch = false; this.encounterActive = false;
      this.time.delayedCall(900, () => {
        Music.play('tension');
        this.say('GHOST', 'Room clear. SPARROW, you\'re coming with me.', 2400);
        this.interactables.push({ x: this.sparrow.x, y: G - 30, radius: 80, label: 'Free SPARROW', hold: 1400, enabled: true, onUse: () => this.freeSparrow() });
        this.setObjective('Free SPARROW', { x: this.sparrow.x, y: G - 80 });
      });
    }
  }

  async freeSparrow() {
    this.sparrow.free();
    this.reachCheckpoint(3);
    this.hud.notify('SPARROW RESCUED', '#7cff9a');
    await this.cutscene(async () => {
      Music.play('sad');
      const sp = this.sparrow; const p = this.player;
      this.camTo((sp.x + p.x) / 2, G - 120, 1.35);
      sp.crouch = 1; p.scriptFacing = sp.x > p.x ? 1 : -1;
      await this.wait(700);
      await this.say('SPARROW', 'You came... I didn\'t think anyone would come.', 2800);
      await this.say('GHOST', 'You\'re safe now. Can you walk?', 2200);
      await this.say('SPARROW', 'They took my brother three days ago. Dragged him out of that same chair.', 3400);
      await this.say('SPARROW', 'I heard the shot from the yard. Then nothing.', 3000);
      await this.say('GHOST', '...I\'m sorry.', 2000);
      await this.say('SPARROW', 'Don\'t be sorry. Get me out, so it meant something.', 3200);
      sp.crouch = 0;
      await this.say('SPARROW', 'Varkov moved the BLACKOUT plans yesterday. There\'s a back way out.', 3000);
      p.scriptFacing = 0;
    });
    Music.play('tension');
    this.openBackDoor();
    this.objectiveExit();
  }
  openBackDoor() {
    if (!this.backDoor || this.backDoor.dead) return;
    AudioEngine.play('door', { x: 5460 });
    this.tweens.add({ targets: this.backDoor.visuals, y: '-=360', duration: 1400 });
    this.level.removeSolid(this.backDoor);
  }
  objectiveExit() { this.setObjective('Escort SPARROW through the courtyard', { x: 6200, y: G - 80 }); }

  startBoss() {
    if (this.bossDone) return;
    const p = this.player;
    this.cutscene(async () => {
      this.sparrow.hideAt(5560);
      this.camTo(6600, G - 180, 0.95);
      Music.play('boss');
      AudioEngine.play('door', { x: 6990 }); this.fx.shake(500, 0.01);
      await this.wait(500);
      this.tweens.add({ targets: this.gate, angle: -80, duration: 500, ease: 'Quad.easeIn' });
      this.fx.chunk(6990, G - 100, 180, 12, 500); this.fx.burst('dust', 6990, G - 60, 10, 180, 60, 60, 220);
      const boss = this.boss = new Juggernaut(this, 7060, G, { facing: -1 });
      boss.body.setVelocityX(-120);
      boss.onPhase2 = () => this.bossPhase2();
      boss.onDefeated = () => this.bossDefeated();
      await this.wait(1600);
      await this.say('THE WARDEN', 'Nobody leaves Karvosk. Nobody.', 2400);
      this.hud.bigText('THE WARDEN', '#ff4a3a', 1600);
    }).then(() => {
      this.boss.state = 'combat';
      this.hud.setBoss(this.boss, 'THE WARDEN · JUGGERNAUT');
      this.setObjective('Defeat THE WARDEN — use explosives and cracked armour', null, { silent: true });
      this.encounterActive = true;
    });
  }
  bossPhase2() {
    this.say('THE WARDEN', 'GUARDS! To me!', 1800);
    for (const [x, t] of [[5650, 'rifleman'], [6900, 'shotgunner']]) { const s = this.spawnSoldier(t, x, G, { state: 'combat' }); s.alert('boss'); }
  }
  bossDefeated() {
    this.bossDone = true; this.encounterActive = false;
    this.hud.setBoss(null);
    this.hud.bigText('THE WARDEN IS DOWN', '#ffc34d', 2000);
    this.reachCheckpoint(4);
    this.time.delayedCall(1800, () => {
      Music.play('tension');
      this.sparrow.free();
      this.say('OVERLORD', 'Outstanding. Get SPARROW to the landing zone past the gate.', 3000);
      this.objectiveExtract();
    });
  }
  spawnMotorPool() {
    this.say('SPARROW', 'The motor pool... they keep the trucks here. Stay low!', 2600);
    for (const [t, x] of [['rifleman', 7900], ['shotgunner', 8250], ['heavy', 8650], ['rifleman', 9000], ['sniper', 9300]]) this.spawnSoldier(t, x, G, { state: 'combat', facing: -1 });
    this.encounterActive = true;
  }

  objectiveExtract() {
    this.setObjective('Reach the landing zone with SPARROW', { x: 9850, y: G - 60 });
    this.addTrigger(9750, () => this.endMission(), { keep: true });
  }

  async endMission() {
    if (this.sparrow && Math.abs(this.sparrow.x - this.player.x) > 400) { this.sparrow.setPosition(this.player.x - 60, G); }
    await this.cutscene(async () => {
      this.camTo(9700, G - 220, 0.85);
      await this.say('OVERLORD', 'Ghost, abort the pickup! Enemy armour is closing on the LZ — Viper can\'t land.', 3200);
      AudioEngine.play('explosion', { x: 10150 }); this.fx.explosion(10080, G - 30, { radius: 160 }); this.fx.shake(600, 0.015);
      await this.say('OVERLORD', 'New LZ is HAMMER, across the valley. Move, now!', 2600);
      await this.say('ROOK', 'I\'m coming down off the ridge. We walk out of this valley together.', 2800);
      await this.say('GHOST', 'Copy. SPARROW, stay on me. It\'s going to be a long morning.', 2600);
    });
    this.allowComplete = true;
    this.completeStage();
  }

  updateSearchlight(dt) {
    const sl = this.searchLight; if (!sl || !sl.on) return;
    this.slT = (this.slT || 0) + dt;
    sl.cone.angle = 1.85 + Math.sin(this.slT * 0.6) * 0.55;
    const p = this.player; const g = this.towerGuard;
    if (!g || !g.alive || !p.alive) { if (g && !g.alive) sl.on = false; return; }
    const dx = p.x - sl.x, dy = p.y - 40 - sl.y; const d = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - sl.cone.angle; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    if (d < sl.cone.len && Math.abs(da) < 0.28 && g.state !== 'combat') { g.awareness += dt * 1.8; g.facing = dx > 0 ? 1 : -1; if (g.awareness >= 1) { g.alert('searchlight'); this.alertNearby(g, 700); } }
  }

  startRain() { if (!this.rain) this.rain = AudioEngine.loopSample('rain', 'rain', 0.32); }

  tick(dt) {
    if (!this.rain && AudioEngine.ready) this.startRain();
    if (this.gridOff && this.alarmLight) { this.lighting.remove(this.alarmLight); this.alarmLight = null; }
  }
}
