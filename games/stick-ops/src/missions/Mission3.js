// MISSION 03 — BLACKOUT (stage 2): assault Iron Spire, destroy the comms centre, down the gunship.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH, WEAPONS } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { Gunship, Helicopter } from '../entities/Helicopter.js';
import { MountedGun, Truck } from '../entities/Vehicles.js';

const G = 940;
const rand = (a, b) => a + Math.random() * (b - a);

export class Mission3 extends BaseMission {
  constructor() { super('Mission3'); }
  get missionId() { return 3; }
  get stageIndex() { return 1; }
  get levelWidth() { return 11000; }
  get themeName() { return 'dusk'; }
  get lightingOpts() { return { ambient: 0x080208, darkness: 0.45 }; }

  buildLevel() {
    const L = this.level;
    L.background();
    this.spawnPoint = { x: 220, y: G };
    this.playerOpts = { loadout: ['rifle', 'pistol', 'shotgun', 'sniper'] };
    L.ground(0, 700, G, 'dirt');
    L.ground(700, 10300, G, 'concrete');
    // perimeter
    L.fence(700, 300, G);
    L.sandbags(900, G); L.jersey(1250, G); L.crate(1500, G); L.crate(1500, G - 54); L.sandbags(1750, G);
    L.decor('tower', 1100, G, { depth: DEPTH.backdrop + 2 });
    L.building(1950, G, 420, 300, { lit: 0.3, sign: 'IRON SPIRE' });
    L.barrel(2150, G); L.jersey(2450, G);
    for (const x of [800, 1600, 2300]) L.lamp(x, G);
    this.mg = new MountedGun(this, 1380, G, { facing: 1 });
    this.updaters.push((dt) => this.mg.update(dt));
    // comms compound
    this.comms = L.building(3150, G, 1250, 470, { lit: 0.45, sign: 'BLACKOUT // COMMS', warm: false, destructible: true });
    L.decor('dish', 3500, G - 470, { depth: DEPTH.backdrop + 1 });
    this.dish2 = L.decor('dish', 4100, G - 470, { depth: DEPTH.backdrop + 1, flip: true });
    this.antenna = this.add.rectangle(3800, G - 470, 10, 420, 0x0d0a0c).setOrigin(0.5, 1).setDepth(DEPTH.backdrop + 1);
    this.antennaLight = this.lighting.add({ x: 3800, y: G - 890, r: 70, i: 0.8, color: 0xff2010, glowAlpha: 0.6 });
    L.platform(3300, G - 200, 900, { supportTo: G });
    L.ladder(3315, G - 200, G); L.ladder(4185, G - 200, G);
    L.crate(2900, G); L.sandbags(3100, G); L.crate(4500, G, 1, true); L.jersey(4700, G); L.barrel(4600, G);
    this.cores = [];
    for (const [x, y] of [[3250, G], [3800, G - 200], [4380, G]]) {
      const img = this.add.image(x, y, 'server').setOrigin(0.5, 1).setDepth(DEPTH.decorBack + 3);
      const glow = this.lighting.add({ x, y: y - 60, r: 120, i: 0.6, color: 0x2bd4ff, glowAlpha: 0.35 });
      const core = { x, y, img, glow, planted: false };
      core.it = { x, y: y - 30, radius: 75, label: 'Plant demolition charge', hold: 1800, enabled: false, onUse: () => this.plant(core) };
      this.interactables.push(core.it); this.cores.push(core);
    }
    this.supplyCrate(2700, G);
    // ---- hangar row ----
    for (const [x, w, h] of [[5100, 560, 280], [5900, 520, 300], [6650, 600, 270]]) L.building(x, G, w, h, { lit: 0.2, color: '#221b1e', sign: 'HANGAR', depth: DEPTH.backdrop });
    L.container(5350, G, 'red'); L.container(5350, G - 120, 'blue', true); L.crate(5700, G); L.crate(5760, G, 1, true); L.barrel(5850, G);
    L.jersey(6150, G); L.sandbags(6450, G); L.decor('truck', 6600, G, { depth: DEPTH.decorBack, tint: 0x444444 }); L.barrel(6750, G);
    L.crate(7000, G); L.crate(7000, G - 54); L.sandbags(7250, G);
    for (const x of [5250, 6050, 6850]) L.lamp(x, G);
    this.speaker = this.lighting.add({ x: 6200, y: G - 320, r: 90, i: 0.7, color: 0xff4020, glowAlpha: 0.5 });
    this.supplyCrate(6300, G);
    // airfield / boss arena
    for (const x of [7900, 9000, 10100]) L.jersey(x, G);
    for (const x of [8400, 9550]) L.sandbags(x, G);
    L.container(8800, G, 'blue'); L.crate(9800, G, 1, true); L.crate(8150, G);
    for (const x of [7750, 8700, 9600, 10500]) L.lamp(x, G);
    this.helipad = this.add.image(10300, G - 2, 'glow').setTint(0xffc34d).setScale(2.4, 0.2).setAlpha(0.4).setDepth(DEPTH.decorBack);
    this.flaks = [new MountedGun(this, 8250, G, { facing: 1, kind: 'flak' }), new MountedGun(this, 9950, G, { facing: -1, kind: 'flak' })];
    for (const f of this.flaks) { f.interact.enabled = false; this.updaters.push((dt) => f.update(dt)); }
    this.rocketCrates = [];
    for (const x of [8050, 9250, 10200]) {
      this.level.prop('crate_metal', x, G, { scale: 0.75, tint: 0xffd9a0 });
      const it = { x, y: G - 20, radius: 70, label: 'Take launcher rockets', hold: 400, enabled: false, onUse: () => this.takeRockets(it) };
      this.interactables.push(it); this.rocketCrates.push(it);
    }
    this.addTraffic({ y: 486, tint: 0x2a1a22, row: 2, rate: 7, maxAlive: 4 });
    // storm atmosphere
    this.add.particles(0, 0, 'rain', { x: { min: -300, max: 1700 }, y: -30, speedY: { min: 1000, max: 1200 }, speedX: -200, lifespan: 800, quantity: 2, frequency: 20, alpha: { start: 0.35, end: 0.1 } }).setScrollFactor(0).setDepth(DEPTH.weather);
  }

  setupMission() {
    this.calmMusic = 'tension';
    this.addCheckpoint(220, G);
    this.addCheckpoint(2700, G, { restore() { this.spawnSquad(2600); this.objectiveCharges(); Music.play('combat'); } });
    this.addCheckpoint(4900, G, { auto: false, restore() { this.spawnSquad(4800); this.commsDestroyed(true); } });
    this.addCheckpoint(6300, G, { restore() { this.spawnSquad(6200); this.commsDestroyed(true); this.objectiveHangars(); Music.play('combat'); } });
    this.addCheckpoint(7900, G, { auto: false, restore() { this.spawnSquad(7800); this.commsDestroyed(true); this.startBoss(true); } });
    this.addTrigger(-1, () => this.spawnPerimeter());
    this.addTrigger(2600, () => this.spawnComms(), { respawnUntil: 3200 });
    this.addTrigger(5000, () => { if (this.commsDown) this.hangarScene(); });
    this.addTrigger(7600, () => { if (this.commsDown && !this.bossStarted) this.startBoss(false); });
    this.updaters.push((dt) => this.lightning(dt));
  }

  objectiveHangars() { this.setObjective('Fight through the hangars to the helipad', { x: 10300, y: G - 60 }); }

  // Varkov taunts over the base loudspeakers, then the hangar defenders open up
  async hangarScene() {
    if (this.hangarDone) return; this.hangarDone = true;
    await this.cutscene(async () => {
      this.camTo(6200, G - 300, 0.8);
      AudioEngine.play('alarm', { vol: 0.6 });
      await this.wait(600);
      await this.say('VARKOV', 'Ghost. I know your name now. I know about your friend, too.', 3200);
      await this.say('VARKOV', 'Rook, wasn’t it? He bled out in a village for a traitor who sells secrets.', 3600);
      await this.say('GHOST', 'He died for something you will never understand.', 2800);
      await this.say('VARKOV', 'Then come and join him.', 2200);
    });
    Music.play('combat');
    this.objectiveHangars();
    for (const [t, x] of [['rifleman', 5600], ['heavy', 5950], ['shotgunner', 6250], ['rifleman', 6600], ['sniper', 6900], ['heavy', 7150]]) this.spawnSoldier(t, x, G, { state: 'combat', facing: -1 });
    this.time.delayedCall(5000, () => { const t = new Truck(this, 7700, G, { facing: -1, stopX: 6900 }); this.vehicles.push(t); this.hud.notify('TECHNICAL INBOUND', '#ff4a3a'); });
  }

  // dawn memorial for Rook at the end of the campaign
  async memorial() {
    const p = this.player; const mx = p.x + 120;
    this.hud.fade(true, 1200);
    await this.wait(1300);
    for (const e of this.enemies) if (e.alive && !e.isVehicle) e.destroy();
    this.lighting.setDarkness(0.12, 3000);
    p.setPosition(mx - 70, G);
    const g = this.add.graphics().setDepth(DEPTH.decorBack + 5);
    g.fillStyle(0x070809, 1); g.fillRect(mx - 3, G - 70, 6, 70);                // rifle, muzzle down
    g.fillRect(mx - 14, G - 64, 28, 6); g.fillRect(mx + 2, G - 56, 10, 4);
    g.beginPath(); g.arc(mx, G - 72, 12, Math.PI, 0, false); g.closePath(); g.fillPath();   // helmet on the stock
    this.hud.chapterCard('IRON SPIRE VALLEY', 'DAWN', 2600);
    await this.wait(1400);
    this.hud.fade(false, 1600);
    Music.play('sad');
    this.camTo(mx - 30, G - 120, 1.5);
    await this.wait(1800);
    await this.walkTo(p, mx - 34, 90);
    p.scriptFacing = 1; p.scriptCrouch = true; p.scriptLowered = true;
    await this.say('GHOST', 'Varkov’s gone, Rook. The network’s gone. SPARROW made it out.', 3600);
    const tags = this.add.image(mx + 2, G - 50, 'glow').setTint(0xc9d4da).setScale(0.12).setDepth(DEPTH.decorBack + 6);
    this.tweens.add({ targets: tags, alpha: 0.5, yoyo: true, repeat: -1, duration: 900 });
    AudioEngine.play('pickup');
    await this.say('GHOST', 'You kept your promise. I’ll keep mine. Anna gets these back in person.', 3800);
    await this.wait(1200);
    await this.say('OVERLORD', 'Echo-6, Viper is inbound. Whenever you’re ready, Ghost.', 3000);
    await this.say('GHOST', '...Take your time, brother. We’ll take it from here.', 3200);
    this.hud.chapterCard('IN MEMORY OF SGT. ELIAS "ROOK" HAYES', 'ECHO-6', 3600);
    await this.wait(3600);
    p.scriptLowered = false; p.scriptCrouch = false; p.scriptFacing = 0;
  }

  spawnSquad(x) {
    if (this.squad) return;
    this.squad = [this.spawnAlly(x - 100, G, { facing: 1 }), this.spawnAlly(x - 160, G, { facing: 1, weapon: 'e_lmg' })];
  }

  onStart() {
    Music.play('combat');
    this.spawnSquad(200);
    this.cutscene(async () => {
      this.camTo(900, G - 260, 0.85);
      await this.say('OVERLORD', 'Echo-6, you\'re clear to hit Iron Spire. Three relay cores feed the BLACKOUT network.', 3200);
      await this.say('OVERLORD', 'Plant charges on all three, then bring the whole building down.', 2800);
      await this.say('GHOST', 'Echo, on me. Let\'s finish this.', 2000);
    }).then(() => {
      this.setObjective('Breach the Iron Spire perimeter', { x: 2600, y: G - 60 });
      this.encounterActive = true;
      this.hud.notify('MOUNTED MG AVAILABLE — PRESS E', '#9fb4c0');
    });
  }

  spawnPerimeter() {
    const alarm = this.registry.get('m3alarm');
    this.spawnSoldier('rifleman', 1650, G, { state: 'combat' });
    this.spawnSoldier('rifleman', 1900, G, { state: 'combat' });
    this.spawnSoldier('sniper', 1100, G - 250, { state: 'combat', hold: true });
    this.spawnSoldier('shotgunner', 2250, G, { state: 'combat' });
    this.spawnSoldier('heavy', 2500, G, { state: 'combat' });
    if (alarm) { this.spawnSoldier('heavy', 2300, G, { state: 'combat' }); this.spawnSoldier('rifleman', 2400, G, { state: 'combat' }); }
    this.time.delayedCall(7000, () => { if (this.player.x < 2200) { const t = new Truck(this, 3300, G, { facing: -1, stopX: 2500 }); this.vehicles.push(t); this.hud.notify('TECHNICAL INBOUND', '#ff4a3a'); } });
  }

  spawnComms() {
    this.objectiveCharges();
    for (const [t, x, y] of [['rifleman', 3400, G], ['rifleman', 3700, G - 200], ['officer', 4000, G - 200], ['heavy', 4200, G], ['shotgunner', 3900, G], ['sniper', 4650, G]]) this.spawnSoldier(t, x, y, { state: 'combat' });
    this.time.delayedCall(12000, () => this.rappelWave(4000));
  }

  objectiveCharges() {
    for (const c of this.cores) if (!c.planted) c.it.enabled = true;
    const left = this.cores.filter((c) => !c.planted);
    this.setObjective(`Plant charges on the relay cores (${3 - left.length}/3)`, left[0] ? { x: left[0].x, y: left[0].y - 80 } : null);
  }

  plant(core) {
    core.planted = true;
    AudioEngine.play('beep', { x: core.x });
    const c4 = this.add.rectangle(core.x, core.y - 50, 14, 10, 0x2a3a20).setDepth(DEPTH.decorBack + 4);
    core.c4 = c4;
    const blink = this.lighting.add({ x: core.x, y: core.y - 50, r: 40, i: 0.8, color: 0xff2010, glowAlpha: 0.6 });
    this.time.addEvent({ delay: 500, loop: true, callback: () => { blink.on = !blink.on; } });
    core.blink = blink;
    const left = this.cores.filter((c) => !c.planted);
    if (left.length) { this.hud.notify(`CHARGE PLANTED · ${left.length} LEFT`, '#7cff9a'); this.setObjective(`Plant charges on the relay cores (${3 - left.length}/3)`, { x: left[0].x, y: left[0].y - 80 }); }
    else {
      this.setObjective('Get clear of the comms centre!', { x: 4900, y: G - 60 });
      this.say('GHOST', 'All charges set. Echo, fall back — we\'re blowing it!', 2400);
      this.detonateTrigger = this.addTrigger(4850, () => this.detonate(), { keep: true });
    }
  }

  rappelWave(x) {
    const h = new Helicopter(this, x + 1600, G - 600, { kind: 'ally', enemy: true, speed: 420, searchlight: true });
    this.helis.push(h); h.searchTarget = this.player; h.moveTo(x, G - 480, 420);
    this.hud.notify('ENEMY HELICOPTER INBOUND', '#ff4a3a');
    const ev = this.time.addEvent({ delay: 200, loop: true, callback: () => {
      if (h.arrived(40)) { ev.remove(); h.rappel(['rifleman', 'shotgunner', 'rifleman']); this.time.delayedCall(3800, () => { h.moveTo(x + 2600, G - 900, 380); this.time.delayedCall(6000, () => { h.destroy(); this.helis = this.helis.filter((q) => q !== h); }); }); }
    } });
  }

  async detonate() {
    this.reachCheckpoint(2);
    await this.cutscene(async () => {
      this.camTo(3800, G - 330, 0.72);
      await this.wait(900);
      await this.say('GHOST', 'Lights out, Varkov.', 1600);
      this.setSlowmo(0.35, 5200);
      for (const [i, c] of this.cores.entries()) this.time.delayedCall(i * 450, () => { this.fx.explosion(c.x, c.y - 50, { radius: 230, damage: 400, owner: 'player' }); if (c.img.active) c.img.destroy(); if (c.c4) c.c4.destroy(); if (c.blink) this.lighting.remove(c.blink); this.lighting.remove(c.glow); });
      await this.wait(1500);
      this.level.collapse(this.comms, { cell: 52 });
      this.lighting.remove(this.antennaLight);
      this.tweens.add({ targets: this.antenna, angle: 75, duration: 2600, ease: 'Quad.easeIn', onComplete: () => { this.fx.explosion(4150, G - 40, { radius: 200 }); this.fx.chunk(4150, G - 40, -90, 20, 500); } });
      this.tweens.add({ targets: this.dish2, y: G + 40, angle: 30, duration: 1800, ease: 'Quad.easeIn' });
      for (let i = 0; i < 8; i++) this.time.delayedCall(600 + i * 350, () => this.fx.explosion(3200 + Math.random() * 1200, G - Math.random() * 400, { radius: 160 }));
      for (const x of [3400, 3900, 4300]) this.fx.fireSource(x, G, 1.6, 0);
      await this.wait(3400);
      this.hud.bigText('COMMS CENTRE DESTROYED', '#ffc34d', 2200);
      await this.say('OVERLORD', 'BLACKOUT network is offline! Outstanding work, Ghost!', 2800);
    });
    this.commsDestroyed(false);
  }

  commsDestroyed(instant) {
    this.commsDown = true;
    if (instant) {
      for (const c of this.cores) { c.planted = true; c.it.enabled = false; if (c.img.active) c.img.destroy(); this.lighting.remove(c.glow); }
      if (!this.comms.dead) { this.comms.dead = true; this.comms.img.destroy(); for (const s of this.comms.solids) this.level.removeSolid(s); }
      this.antenna.setAngle(75); this.lighting.remove(this.antennaLight);
      for (const x of [3400, 3900, 4300]) this.fx.fireSource(x, G, 1.6, 0);
    }
    if (!this.bossStarted) this.objectiveHangars();
  }

  async startBoss(fromCp) {
    if (this.bossStarted) return;
    this.bossStarted = true;
    this.reachCheckpoint(4);
    if (!this.player.loadout.includes('launcher')) this.player.giveWeapon('launcher');
    else { this.player.ammo.launcher.reserve = Math.max(this.player.ammo.launcher.reserve, 4); }
    const boss = this.boss = new Gunship(this, 11200, G - 700, { groundY: G, bounds: [7600, 10900], hp: 2600, onDefeated: () => this.bossDefeated() });
    this.helis.push(boss);
    boss.moveTo(10000, G - 420, 400);
    await this.cutscene(async () => {
      this.camTo(9900, G - 330, 0.78);
      Music.play('boss');
      await this.wait(1600);
      await this.say('VARKOV', 'You destroyed my network... Then I will bury you in this valley myself!', 3200);
      this.hud.bigText('BLACK WIDOW', '#ff4a3a', 1800);
      await this.say('OVERLORD', 'That\'s Varkov\'s gunship! Use the AA guns and launcher rockets on the airfield!', 3000);
    });
    this.hud.setBoss(boss, 'GEN. VARKOV · BLACK WIDOW GUNSHIP');
    this.setObjective('Shoot down the BLACK WIDOW', null, { silent: true });
    for (const f of this.flaks) f.interact.enabled = true;
    for (const c of this.rocketCrates) c.enabled = true;
    this.encounterActive = true;
    this.hud.notify('LAUNCHER (5) LOCKS ON · AA GUNS: PRESS E', '#ffc34d');
  }

  takeRockets(it) {
    const p = this.player;
    if (!p.loadout.includes('launcher')) p.giveWeapon('launcher');
    else p.ammo.launcher.reserve += 3;
    p.switchTo('launcher');
    this.hud.notify('+3 ROCKETS', '#ffc34d');
    this.time.delayedCall(14000, () => { it.enabled = true; });
  }

  rocketLockTarget() {
    const b = this.boss;
    if (!b || !b.alive || b.dying) return null;
    if (Math.random() < 0.2) this.time.delayedCall(350, () => b.popFlares());
    return b;
  }

  async bossDefeated() {
    this.hud.setBoss(null);
    this.encounterActive = false;
    this.hud.bigText('BLACK WIDOW DOWN', '#ffc34d', 2400);
    Music.play('victory');
    for (const e of this.enemies) if (e.alive && !e.isVehicle) e.takeDamage(9999, { angle: 0 });
    await this.wait(2600);
    await this.cutscene(async () => {
      this.camTo(this.player.x + 200, G - 260, 0.9);
      await this.say('OVERLORD', 'Confirmed kill on Varkov. The BLACKOUT network is gone. It\'s over, Ghost.', 3400);
      this.jetFlyby({ dir: -1, count: 3 });
      await this.say('GHOST', 'Echo-6, we\'re going home.', 2200);
      await this.memorial();
      const v = new Helicopter(this, this.player.x - 1400, G - 700, { kind: 'ally', speed: 420 }); this.helis.push(v);
      v.moveTo(this.player.x + 60, G - 280, 420);
      await this.wait(3000);
    });
    this.allowComplete = true;
    this.completeStage();
  }

  updateCamera(rdt) {
    super.updateCamera(rdt);
    const b = this.boss;
    if (b && b.alive && !this.camOverride && this.bossStarted) {
      // frame both the player and the gunship
      const p = this.player;
      const cx = (p.x + b.x) / 2, cy = Math.min(p.y - 110, (p.y - 60 + b.y) / 2);
      const k = Math.min(1, rdt * 3);
      this.camFollow.x += (cx - this.camFollow.x) * k * 0.6; this.camFollow.y += (cy - this.camFollow.y) * k * 0.6;
      const cam = this.cameras.main; cam.zoom += (0.8 - cam.zoom) * Math.min(1, rdt * 2);
    }
  }

  lightning(dt) {
    if (!this.rain && AudioEngine.ready) this.rain = AudioEngine.loopSample('rain', 'rain', 0.28);
    if (Math.random() < dt * 0.12) {
      this.hud.flashScreen(0xd0d8ff, 0.25, 220);
      this.time.delayedCall(rand(400, 1400), () => { if (AudioEngine.hasSample('boom')) AudioEngine.play('boom', { vol: 0.35, rate: 0.6, gap: 500 }); else AudioEngine.play('explosion', { vol: 0.25, gap: 500 }); });
      if (this.lighting) this.lighting.flash(this.cameras.main.midPoint.x, this.cameras.main.worldView.y, 2000, 0.6, 180);
    }
  }
}
