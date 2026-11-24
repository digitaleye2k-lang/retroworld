// MISSION 07 — BLACK SUN: storm the silo, stop the launch, end Drago, outrun the blast. Epilogue.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { Helicopter, Gunship } from '../entities/Helicopter.js';
import { MountedGun } from '../entities/Vehicles.js';
import { Bunker } from '../entities/Armor.js';
import { Juggernaut, Informant } from '../entities/Boss.js';
import { STYLES } from '../render/StickFigure.js';

const G = 940;
const rand = (a, b) => a + Math.random() * (b - a);
const LAUNCH_SECONDS = 300;

export class Mission7 extends BaseMission {
  constructor() { super('Mission7'); }
  get missionId() { return 7; }
  get stageIndex() { return 0; }
  get levelWidth() { return 12800; }
  get themeName() { return 'night'; }
  get lightingOpts() { return { ambient: 0x08020a, darkness: 0.5 }; }

  buildLevel() {
    const L = this.level;
    L.background();
    this.spawnPoint = { x: 300, y: G };
    L.ground(0, 4000, G, 'dirt');
    L.ground(4000, 7000, G, 'metal');
    L.ground(11000, 1800, G, 'dirt');
    // ---- surface ----
    L.fence(600, 400, G); L.sandbags(1100, G); L.crate(1400, G); L.jersey(1700, G); L.sandbags(2100, G); L.crate(2500, G, 1, true); L.sandbags(3100, G); L.jersey(3500, G);
    L.decor('dish', 1900, G, { depth: DEPTH.backdrop }); L.decor('tower', 3000, G, { depth: DEPTH.backdrop });
    L.building(3600, G, 400, 300, { lit: 0.3, sign: 'BLACK SUN', color: '#1e1a1e' });
    for (const x of [900, 1800, 2700, 3400]) L.lamp(x, G, 0xffb070);
    this.flakGun = new MountedGun(this, 2300, G, { facing: 1, kind: 'flak' });
    this.updaters.push((dt) => this.flakGun.update(dt));
    this.supplyCrate(2700, G);
    // ---- the silo ----
    L.block(4000, G - 620, 7000, 40, { tex: 'tex_metal' });
    this.add.rectangle(4000, G - 580, 7000, 580, 0x0a0b0e, 1).setOrigin(0, 0).setDepth(DEPTH.backdrop - 2);
    for (let x = 4100; x < 11000; x += 180) this.add.rectangle(x, G - 580, 8, 580, 0x15181c).setOrigin(0, 0).setDepth(DEPTH.backdrop - 1);
    // the missile in its shaft
    const mg = this.add.graphics().setDepth(DEPTH.backdrop);
    mg.fillStyle(0x23272c, 1); mg.fillRect(7420, G - 560, 120, 540); mg.fillStyle(0x30353b, 1); mg.fillRect(7420, G - 560, 30, 540);
    mg.fillStyle(0x1a1d21, 1); mg.fillTriangle(7420, G - 560, 7540, G - 560, 7480, G - 640 + 60);
    mg.fillStyle(0xc9a43a, 1); for (let y = G - 480; y < G - 60; y += 90) mg.fillRect(7420, y, 120, 8);
    mg.fillStyle(0x111316, 1); mg.fillRect(7395, G - 120, 170, 100);
    this.add.text(7480, G - 320, 'BLACK SUN', { fontFamily: 'monospace', fontSize: '18px', color: '#c9a43a' }).setOrigin(0.5).setRotation(-Math.PI / 2).setDepth(DEPTH.backdrop + 1);
    // catwalks & ladders
    L.platform(4500, G - 200, 900, { supportTo: G }); L.ladder(4520, G - 200, G); L.ladder(5380, G - 200, G);
    L.platform(5600, G - 400, 700, { supportTo: G }); L.ladder(5620, G - 400, G - 200 + 200); L.platform(5600, G - 200, 200, { supportTo: G, noSupports: true });
    L.platform(6400, G - 220, 600, { supportTo: G }); L.ladder(6980, G - 220, G);
    for (const x of [4700, 5200, 6200, 6650, 8200, 8900, 9600, 10300]) L.crate(x, G, 1, true);
    for (const x of [5000, 6000, 8500, 9300, 10000]) L.barrel(x, G);
    this.alarms = [4600, 5800, 7000, 8200, 9400, 10600].map((x) => this.lighting.add({ x, y: G - 560, r: 360, i: 0.55, color: 0xff2010, glowAlpha: 0.35 }));
    this.cores = [];
    for (const [x, y] of [[4950, G - 200], [5950, G - 400], [6700, G - 220]]) {
      const img = this.add.image(x, y, 'server').setOrigin(0.5, 1).setDepth(DEPTH.decorBack + 3).setTint(0xff9a90);
      const glow = this.lighting.add({ x, y: y - 60, r: 120, i: 0.6, color: 0xff3020, glowAlpha: 0.35 });
      const core = { x, y, img, glow, done: false };
      core.it = { x, y: y - 30, radius: 75, label: 'Destroy launch-control core', hold: 1500, enabled: false, onUse: () => this.killCore(core) };
      this.interactables.push(core.it); this.cores.push(core);
    }
    this.supplyCrate(4300, G); this.supplyCrate(7900, G);
    this.exitLift = this.add.rectangle(10750, G - 140, 120, 140, 0x2a3a2a).setOrigin(0.5, 0).setDepth(DEPTH.decorBack);
    this.exitLight = this.lighting.add({ x: 10750, y: G - 160, r: 220, i: 0.7, color: 0x40ff70, glowAlpha: 0.35 });
    // ---- cemetery (epilogue) ----
    for (let i = 0; i < 12; i++) L.decor('grave', 11300 + i * 110, G, { depth: DEPTH.decorBack, tint: 0x8a8a8a, scale: 0.9 });
    this.rookGrave = L.decor('grave', 12050, G, { depth: DEPTH.decorBack + 1, scale: 1.1 });
    this.rainFx = this.add.particles(0, 0, 'rain', { x: { min: -300, max: 1700 }, y: -30, speedY: { min: 900, max: 1100 }, speedX: -150, lifespan: 900, quantity: 2, frequency: 24, alpha: { start: 0.35, end: 0.1 } }).setScrollFactor(0).setDepth(DEPTH.weather);
  }

  setupMission() {
    this.calmMusic = 'tension';
    this.addCheckpoint(300, G);
    this.addCheckpoint(4050, G, { auto: false, restore() { this.squadUp(3950); this.enterSilo(true); } });
    this.addCheckpoint(7300, G, { auto: false, restore() { this.squadUp(7200); this.enterSilo(true); for (const c of this.cores) this.killCore(c, true); this.startDrago(); } });
    this.addTrigger(-1, () => this.spawnSurface());
    this.addTrigger(4050, () => this.enterSilo(false));
    this.addTrigger(7300, () => { if (this.cores.every((c) => c.done)) this.startDrago(); }, { when: () => this.cores.every((c) => c.done) });
    this.addTrigger(10650, () => this.escaped(), { when: () => this.escaping });
  }

  squadUp(x) {
    if (this.squad) return;
    this.vega = this.spawnAlly(x - 90, G, { facing: 1 });
    this.squad = [this.vega, this.spawnAlly(x - 150, G, { facing: 1, weapon: 'e_lmg' }), this.spawnAlly(x - 210, G, { facing: 1 })];
  }

  onStart() {
    Music.play('tension');
    const p = this.player;
    this.cutscene(async () => {
      await this.chapter('BLACK SUN', 'BLACK SUN SILO  -  23:55 LOCAL', 3000);
      const heli = new Helicopter(this, -300, G - 520, { kind: 'ally', facing: 1, speed: 320 }); this.helis.push(heli);
      p.visible = false; p.body.setAllowGravity(false); p.setPosition(320, G - 400);
      this.camTo(380, G - 280, 0.85);
      heli.moveTo(360, G - 500, 320);
      await this.wait(2600);
      p.visible = true;
      const rope = this.add.graphics().setDepth(DEPTH.actors - 1); const t0 = this.time.now;
      await new Promise((res) => { const ev = this.time.addEvent({ delay: 16, loop: true, callback: () => {
        const k = Math.min(1, (this.time.now - t0) / 1600); p.setPosition(320, G - 400 + k * 400); p.body.setVelocity(0, 0);
        rope.clear(); rope.lineStyle(2, 0x3a3328, 1); rope.lineBetween(heli.x + 25, heli.y + 10, 320, G - 70);
        if (k >= 1) { ev.remove(); res(); }
      } }); });
      p.body.setAllowGravity(true); rope.destroy();
      this.squadUp(240);
      heli.moveTo(-600, G - 800, 360);
      await this.say('SGT. VEGA', 'Echo-6 and 3rd Battalion, together one last time. What’s the plan, sir?', 3200);
      await this.say('GHOST', 'Through the gate, down the shaft, kill the launch. And Drago.', 2800);
      await this.say('OVERLORD', 'Gunship on the pad, Ghost. There’s a flak gun by the dish. Use it.', 3000);
    }).then(() => {
      Music.play('combat');
      this.setObjective('Break the surface defences and reach the silo doors', { x: 4050, y: G - 60 });
    });
  }

  soldiers(list) { for (const [t, x, y] of list) this.spawnSoldier(t, x, y || G, { state: 'combat', facing: -1 }); }

  spawnSurface() {
    this.vehicles.push(new Bunker(this, 2900, G, { hp: 600 }));
    this.soldiers([['rifleman', 1300], ['rifleman', 1600], ['heavy', 1950], ['shotgunner', 2400], ['rifleman', 2800], ['sniper', 3000, G - 250], ['heavy', 3400], ['rifleman', 3700]]);
    this.time.delayedCall(8000, () => {
      if (this.surfaceGunship) return;
      const g = this.surfaceGunship = new Gunship(this, 4400, G - 600, { groundY: G, bounds: [800, 3900], hp: 1600, name: 'SENTINEL', onDefeated: () => { this.hud.setBoss(null); this.hud.notify('GUNSHIP DOWN', '#7cff9a'); } });
      this.helis.push(g); this.hud.setBoss(g, 'SENTINEL · ATTACK HELICOPTER');
      this.say('SGT. VEGA', 'Gunship! Get on the flak gun!', 2200);
    });
    this.time.delayedCall(20000, () => { this.say('REAPER-2', 'Reaper on station, painting the silo gate!', 2400); this.jetFlyby({ dir: 1, count: 2, strike: [3300, 3550, 3800], damage: 400 }); });
  }

  enterSilo(instant) {
    if (this.inSilo) return; this.inSilo = true;
    if (this.rainFx) this.rainFx.setVisible(false);
    if (this.surfaceGunship && this.surfaceGunship.alive) { this.surfaceGunship.destroy(); this.hud.setBoss(null); }
    this.reachCheckpoint(1);
    this.launchT = this.launchT || LAUNCH_SECONDS;
    this.lighting.setDarkness(0.62, instant ? 0 : 1500);
    for (const c of this.cores) if (!c.done) c.it.enabled = true;
    const go = async () => {
      if (!instant) {
        await this.cutscene(async () => {
          this.camTo(4600, G - 300, 0.8);
          AudioEngine.play('alarm', { vol: 0.6 });
          await this.say('DRAGO', 'Ghost. You’re too late. The countdown cannot be stopped from outside.', 3400);
          await this.say('GHOST', 'Then I’ll stop it from inside.', 2200);
        });
      }
      Music.play('boss');
      this.alarmLoop = AudioEngine.loopSample('silo_alarm', 'alarm', 0.18);
      this.objectiveCores();
      this.soldiers([['rifleman', 4800, G - 200], ['shotgunner', 5100], ['heavy', 5400], ['rifleman', 5900, G - 400], ['rifleman', 6300], ['heavy', 6700, G - 220], ['sniper', 6900, G - 220], ['rifleman', 7100]]);
    };
    go();
  }
  objectiveCores() {
    const left = this.cores.filter((c) => !c.done);
    if (left.length) this.setObjective(`Destroy the launch-control cores (${3 - left.length}/3)`, { x: left[0].x, y: left[0].y - 80 });
    else this.setObjective('Reach the launch control room', { x: 7800, y: G - 60 });
  }
  killCore(core, instant) {
    if (core.done) return; core.done = true; core.it.enabled = false;
    if (!instant) { this.fx.explosion(core.x, core.y - 50, { radius: 150 }); AudioEngine.play('door', { x: core.x }); }
    core.img.setTint(0x222222); this.lighting.remove(core.glow);
    if (!instant) { this.launchT += 20; this.hud.notify('CORE DESTROYED · +20s', '#7cff9a'); this.objectiveCores(); }
  }

  startDrago() {
    if (this.drago) return;
    this.reachCheckpoint(2);
    const d = this.drago = new Juggernaut(this, 8700, G, { facing: -1, hp: 2600 });
    d.name = 'COL. DRAGO';
    d.onPhase2 = () => { this.say('DRAGO', 'Varkov was weak. I am not!', 2200); this.soldiers([['rifleman', 7500], ['shotgunner', 9200]]); };
    d.onDefeated = () => this.dragoDown();
    this.cutscene(async () => {
      this.camTo(8300, G - 220, 0.9);
      await this.wait(700);
      await this.say('DRAGO', 'You killed my general. You killed my bomber. You will not kill BLACK SUN.', 3600);
      await this.say('GHOST', 'Rook. Mikhail. Hollis. Say their names, Drago.', 3000);
      await this.say('DRAGO', 'I don’t remember the names of the dead.', 2600);
      await this.say('GHOST', 'I do.', 1600);
      this.hud.bigText('COL. DRAGO', '#ff4a3a', 1600);
    }).then(() => {
      d.state = 'combat';
      this.hud.setBoss(d, 'COLONEL ILYANA DRAGO · EXOSUIT');
      this.setObjective('Defeat Colonel Drago', null, { silent: true });
    });
  }

  async dragoDown() {
    this.hud.setBoss(null);
    this.launchStopped = true; this.hudTimerText = '';
    this.hud.bigText('LAUNCH ABORTED', '#7cff9a', 2200);
    await this.wait(2400);
    await this.cutscene(async () => {
      AudioEngine.play('warning');
      await this.say('SILO', 'Launch abort accepted. Self-destruct sequence engaged.', 2800);
      await this.say('SGT. VEGA', 'The whole silo’s going up! RUN, Ghost! The lift is at the far end!', 2800);
    });
    this.escaping = true; this.fireFront = this.player.x - 700;
    Music.play('boss');
    this.setObjective('ESCAPE! Reach the lift', { x: 10750, y: G - 80 });
  }

  async escaped() {
    this.escaping = false;
    await this.cutscene(async () => {
      this.camTo(10750, G - 300, 0.85);
      await this.say('GHOST', 'Lift! Go, go, go!', 1600);
      this.hud.fade(true, 600); await this.wait(800);
      if (this.alarmLoop) { this.alarmLoop.stop(); this.alarmLoop = null; }
      this.player.setPosition(3200, G);
      this.lighting.setDarkness(0.35, 0);
      this.camTo(5600, G - 360, 0.55);
      this.hud.fade(false, 600);
      // the silo erupts
      for (let i = 0; i < 14; i++) this.time.delayedCall(i * 220, () => this.fx.explosion(rand(4200, 10500), rand(G - 500, G - 60), { radius: rand(200, 340), big: true }));
      this.setSlowmo(0.35, 3200);
      await this.wait(1200);
      this.fx.explosion(7480, G - 400, { radius: 420, big: true });
      await this.wait(2600);
      this.jetFlyby({ dir: -1, count: 3 });
      await this.say('OVERLORD', 'BLACK SUN is gone. Drago is gone. Echo-6... it’s over. Come home.', 3600);
      await this.say('GHOST', 'Copy, Overlord. Ghost is coming home.', 2600);
      this.hud.fade(true, 1400); await this.wait(1600);
    });
    await this.epilogue();
  }

  async epilogue() {
    const p = this.player;
    await this.cutscene(async () => {
      Music.play('sad');
      for (const e of this.enemies) if (e.alive) e.destroy();
      if (this.squad) for (const a of this.squad) if (a.alive) a.destroy();
      this.lighting.setDarkness(0.15, 0); this.lighting.ambient = 0x101418;
      p.setPosition(11400, G); p.scriptLowered = true;
      if (this.rainFx) this.rainFx.setVisible(true);
      const anna = this.anna = new Informant(this, 12130, G);
      anna.free(); anna.state = 'script'; anna.facing = -1; anna.onDeath = () => {};
      anna.style = Object.assign({}, STYLES.informant, { rim: 0xc8b8a8, scale: 0.9 });
      this.camTo(11850, G - 160, 1.15);
      this.hud.chapterCard('SIX MONTHS LATER', 'ARLINGTON  -  A GREY MORNING', 3400);
      await this.wait(2600);
      this.hud.fade(false, 1600);
      await this.wait(1200);
      await this.walkTo(p, 11980, 90);
      p.scriptFacing = 1;
      await this.say('ANNA', 'You’re Ghost. Elias wrote about you. Said you snored.', 3200);
      await this.say('GHOST', 'He lied. ...He asked me to bring you something.', 3000);
      AudioEngine.play('pickup');
      await this.say('GHOST', 'He said to tell you he kept the promise. He came back for the guy.', 3600);
      await this.say('ANNA', '...That sounds like him. Was it worth it?', 3000);
      await this.say('GHOST', 'The man he saved gave us the codes that stopped BLACK SUN. A whole city is still standing.', 4000);
      await this.say('GHOST', 'So yes. It was worth everything.', 2800);
      await this.wait(800);
      await this.say('ANNA', 'Then stay a while. Tell me about him.', 3000);
      this.camTo(12000, G - 220, 0.9);
      await this.wait(2400);
      this.hud.fade(true, 2400); await this.wait(2600);
      this.hud.chapterCard('STICK OPS: BLACKOUT', 'IN MEMORY OF ROOK, HOLLIS AND MIKHAIL', 4200);
      await this.wait(4200);
    });
    Music.play('victory');
    this.allowComplete = true;
    this.completeStage();
  }

  tick(dt) {
    // launch countdown
    if (this.inSilo && !this.launchStopped && !this.ended) {
      if (!this.cinematic) this.launchT -= dt;
      const t = Math.max(0, this.launchT); const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
      this.hudTimerText = `LAUNCH IN ${mm}:${String(ss).padStart(2, '0')}`;
      if (this.launchT <= 0) {
        this.fx.explosion(7480, G - 400, { radius: 400, big: true });
        this.failMission('BLACK SUN WAS LAUNCHED');
      }
    }
    // pulsing red alarm lights
    if (this.inSilo && !this.launchStopped) { const on = Math.floor(this.time.now / 500) % 2 === 0; for (const a of this.alarms) a.on = on; }
    // the self-destruct fire wall
    if (this.escaping && !this.cinematic) {
      this.fireFront += 255 * dt;
      this.hudTimerText = 'SELF-DESTRUCT';
      this.fwT = (this.fwT || 0) - dt;
      if (this.fwT <= 0) { this.fwT = 0.22; this.fx.explosion(this.fireFront + rand(-60, 60), rand(G - 500, G - 40), { radius: rand(110, 200) }); }
      const p = this.player;
      if (p.alive && p.x < this.fireFront + 70) p.takeDamage(160 * dt, { x: this.fireFront, y: p.y - 50, explosive: true, angle: 0 });
      for (const e of this.enemies) if (e.alive && e.x < this.fireFront) e.takeDamage(999, { explosive: true, x: this.fireFront, y: e.y - 40, angle: 0 });
    }
  }
}
