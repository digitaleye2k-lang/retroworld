// MISSION 06 — DEAD CITY: a city at war. Link up with 3rd Battalion and reach SPARROW.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { Helicopter } from '../entities/Helicopter.js';
import { APC, Truck, AllyTank, MountedGun } from '../entities/Vehicles.js';
import { EnemyTank } from '../entities/Armor.js';
import { Informant } from '../entities/Boss.js';

const G = 940;
const rand = (a, b) => a + Math.random() * (b - a);

export class Mission6 extends BaseMission {
  constructor() { super('Mission6'); }
  get missionId() { return 6; }
  get stageIndex() { return 0; }
  get levelWidth() { return 11800; }
  get themeName() { return 'dusk'; }
  get lightingOpts() { return { ambient: 0x080208, darkness: 0.32 }; }

  buildLevel() {
    const L = this.level;
    L.background();
    this.spawnPoint = { x: 300, y: G };
    L.ground(0, 11800, G, 'asphalt');
    // A: side streets with rooftop snipers
    L.building(500, G, 420, 300, { lit: 0.2, roof: true, color: '#2a2224' });
    L.ladder(530, G - 300, G);
    L.building(1500, G, 360, 380, { lit: 0.1, color: '#2a2224' });
    L.building(2200, G, 380, 260, { lit: 0.2, roof: true, color: '#2a2224' });
    L.ladder(2560, G - 260, G);
    L.crate(1100, G); L.sandbags(1350, G); L.barrel(1750, G); L.jersey(2000, G); L.decor('wreck', 2700, G, { depth: DEPTH.decorBack, tint: 0x777777 });
    // B: the boulevard
    for (const [x, w, h] of [[3000, 300, 340], [3500, 380, 420], [4400, 340, 300], [5200, 420, 460]]) L.building(x, G, w, h, { lit: 0.15, color: '#2a2224', depth: DEPTH.backdrop });
    this.tower = L.building(4800, G, 300, 520, { lit: 0.25, color: '#2c2426', depth: DEPTH.backdrop + 2, destructible: true, sign: 'HOTEL KESSEL' });
    L.sandbags(3300, G); L.crate(3800, G, 1, true); L.jersey(4200, G); L.barrel(4600, G); L.sandbags(5000, G); L.crate(5600, G); L.barrel(5750, G);
    this.mg1 = new MountedGun(this, 3650, G, { facing: 1 });
    // C: the plaza
    L.building(6100, G, 600, 280, { lit: 0.3, color: '#2a2224', sign: 'CENTRAL STATION', depth: DEPTH.backdrop });
    L.sandbags(6450, G); L.sandbags(6600, G); L.jersey(7000, G); L.crate(7300, G, 1, true); L.sandbags(7600, G); L.barrel(7450, G);
    this.mg2 = new MountedGun(this, 6550, G, { facing: 1 });
    this.supplyCrate(6250, G);
    // D: battalion HQ
    this.hq = L.building(8400, G, 520, 330, { lit: 0.35, color: '#262022', sign: '3RD BN HQ', depth: DEPTH.backdrop + 2, destructible: true });
    L.sandbags(8250, G); L.sandbags(9050, G); L.crate(9300, G);
    this.supplyCrate(9500, G);
    // E: the bridge
    L.building(10000, G, 300, 240, { lit: 0.1, color: '#2a2224', depth: DEPTH.backdrop });
    L.jersey(10400, G); L.sandbags(10800, G); L.jersey(11200, G);
    for (const x of [800, 1900, 3200, 4500, 5900, 7100, 8000, 9700, 10600, 11400]) this.fx.fireSource(x, G + 2, rand(0.5, 1.1), 0);
    for (const x of [1200, 3800, 6800, 9900]) L.lamp(x, G, 0xffb070);
    this.add.particles(0, 0, 'ember', { x: { min: 0, max: 1600 }, y: 760, speedY: { min: -70, max: -20 }, speedX: { min: -30, max: 30 }, lifespan: 4500, frequency: 70, scale: { start: 0.9, end: 0 }, blendMode: 'ADD' }).setScrollFactor(0).setDepth(DEPTH.weather);
    this.addTraffic({ y: 486, tint: 0x2a1a22, row: 2, rate: 3, maxAlive: 8 });
    this.updaters.push((dt) => { this.mg1.update(dt); this.mg2.update(dt); });
  }

  setupMission() {
    this.calmMusic = 'tension';
    this.addCheckpoint(300, G);
    this.addCheckpoint(2900, G, { restore() { this.squadUp(2800); this.objectiveBoulevard(); Music.play('combat'); } });
    this.addCheckpoint(6100, G, { restore() { this.squadUp(6000); if (!this.tower.dead) this.level.collapse(this.tower); this.setObjective('Hold the plaza', { x: 6900, y: G - 60 }); } });
    this.addCheckpoint(8100, G, { auto: false, restore() { this.squadUp(8000); if (!this.tower.dead) this.level.collapse(this.tower); this.toHQ(); } });
    this.addCheckpoint(9700, G, { auto: false, restore() { this.squadUp(9600); if (!this.tower.dead) this.level.collapse(this.tower); if (!this.hq.dead) this.level.collapse(this.hq); this.player.giveWeapon('launcher', true); this.toBridge(); } });
    this.addTrigger(-1, () => this.spawnA());
    this.addTrigger(2900, () => this.spawnB());
    this.addTrigger(4500, () => this.towerCollapse());
    this.addTrigger(6100, () => this.startPlaza());
    this.addTrigger(8150, () => this.hqScene());
  }

  squadUp(x) {
    if (this.squad) return;
    this.vega = this.spawnAlly(x - 90, G, { facing: 1 });
    this.vega.tag = this.add.text(0, 0, 'SGT. VEGA', { fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', fontStyle: '700', color: '#7cffb0' }).setOrigin(0.5).setDepth(DEPTH.fxTop).setAlpha(0.8);
    this.updaters.push(() => { if (this.vega.tag) this.vega.tag.setPosition(this.vega.x, this.vega.y - 104); if (!this.vega.alive && this.vega.tag) { this.vega.tag.destroy(); this.vega.tag = null; } });
    this.squad = [this.vega, this.spawnAlly(x - 150, G, { facing: 1, weapon: 'e_lmg' }), this.spawnAlly(x - 210, G, { facing: 1 })];
    this.bulldog = new AllyTank(this, x - 500, G, { speed: 70 }); this.bulldog.c.setScale(0.8, 0.8);
    this.bulldog.onFire = (t) => this.allyShot(t); this.vehicles.push(this.bulldog);
  }

  allyShot(t) {
    let best = null, bd = 1500;
    for (const v of this.vehicles) if (v.alive && v.team === 'enemy') { const d = Math.abs(v.x - t.x); if (d < bd) { bd = d; best = v; } }
    if (!best) for (const e of this.enemies) if (e.alive && !e.isVehicle) { const d = e.x - t.x; if (d > 100 && d < bd) { bd = d; best = e; } }
    if (!best || !t.alive) return;
    const c = best.center ? best.center() : best.chest(); const mx = t.x + 150, my = G - 72;
    this.combat.shell({ x: mx, y: my, angle: Math.atan2(c.y - my, c.x - mx) + rand(-0.03, 0.03), speed: 1300, team: 'player', damage: 140, radius: 140, gravity: 120 });
  }

  onStart() {
    Music.play('tension');
    const p = this.player;
    this.cutscene(async () => {
      // parachute landing into the burning city
      p.body.setAllowGravity(false); p.setPosition(300, G - 700); p.weaponShape = null;
      const chute = this.add.image(300, G - 812, 'parachute').setDepth(DEPTH.actors + 1);
      this.camTo(380, G - 350, 0.8);
      await this.chapter('DEAD CITY', 'KESSEL  -  18:40 LOCAL', 3000);
      await new Promise((res) => { const ev = this.time.addEvent({ delay: 16, loop: true, callback: () => {
        p.setPosition(p.x + 0.6, p.y + 3.2); p.body.setVelocity(0, 0); chute.setPosition(p.x, p.y - 112);
        if (p.y >= G) { ev.remove(); res(); }
      } }); });
      p.body.setAllowGravity(true); p.weaponShape = p.weapon.shape;
      this.tweens.add({ targets: chute, y: G - 20, alpha: 0, angle: 70, duration: 900, onComplete: () => chute.destroy() });
      this.squadUp(900);
      this.vega.setPosition(700, G);
      await this.walkTo(this.vega, 400, 160);
      await this.say('SGT. VEGA', 'You fell out of the sky, sir? Sergeant Vega, 3rd Battalion. Welcome to Kessel.', 3400);
      await this.say('GHOST', 'I need to get to your HQ. There’s a man there called SPARROW.', 3000);
      await this.say('SGT. VEGA', 'HQ is across the plaza. Half of Drago’s army is between us and it.', 3000);
      await this.say('SGT. VEGA', 'Good news is, we were headed that way anyway. On me!', 2600);
    }).then(() => {
      Music.play('combat');
      this.setObjective('Push through the streets with 3rd Battalion', { x: 2900, y: G - 60 });
    });
  }

  // ---------- encounters ----------
  soldiers(list) { for (const [t, x, y] of list) this.spawnSoldier(t, x, y || G, { state: 'combat', facing: -1 }); }
  spawnA() { this.soldiers([['rifleman', 1300], ['sniper', 600, G - 300], ['rifleman', 1650], ['shotgunner', 1900], ['heavy', 2350], ['sniper', 2300, G - 260], ['rifleman', 2600]]); }
  objectiveBoulevard() { this.setObjective('Take the boulevard', { x: 6000, y: G - 60 }); }
  spawnB() {
    this.objectiveBoulevard();
    this.say('SGT. VEGA', 'Boulevard’s a kill zone! Get on that MG if you can!', 2600);
    const apc = new APC(this, 5600, G, { facing: -1, stopX: 4700 }); this.vehicles.push(apc);
    this.soldiers([['rifleman', 3600], ['rifleman', 3900], ['heavy', 4300], ['shotgunner', 4500], ['rifleman', 5000], ['rifleman', 5300], ['heavy', 5700]]);
    this.time.delayedCall(9000, () => this.rappelWave(4600));
    this.time.delayedCall(4000, () => this.jetFlyby({ dir: -1, count: 2 }));
  }
  rappelWave(x) {
    const h = new Helicopter(this, x + 1500, G - 560, { kind: 'ally', enemy: true, speed: 420, searchlight: true });
    this.helis.push(h); h.searchTarget = this.player; h.moveTo(x, G - 470, 420);
    this.hud.notify('ENEMY HELICOPTER INBOUND', '#ff4a3a');
    const ev = this.time.addEvent({ delay: 200, loop: true, callback: () => {
      if (h.arrived(40)) { ev.remove(); h.rappel(['rifleman', 'shotgunner', 'rifleman', 'heavy']); this.time.delayedCall(4200, () => { h.moveTo(x + 2600, G - 900, 380); this.time.delayedCall(6000, () => { h.destroy(); this.helis = this.helis.filter((q) => q !== h); }); }); }
    } });
  }
  async towerCollapse() {
    if (this.tower.dead) return;
    this.say('SGT. VEGA', 'RPG team in the hotel! BULLDOG, bring it down!', 2400);
    await this.wait(2200);
    this.fx.explosion(4950, G - 360, { radius: 220, big: true });
    this.setSlowmo(0.3, 2400);
    this.level.collapse(this.tower, { push: 0.3 });
    for (const e of this.enemies) if (e.alive && e.x > 4700 && e.x < 5300) e.takeDamage(500, { explosive: true, x: e.x, y: e.y - 100, angle: -Math.PI / 2 });
  }
  startPlaza() {
    this.reachCheckpoint(2);
    this.plazaTime = 50; this.plazaOn = true;
    this.setObjective('Hold the plaza until the column regroups', { x: 6900, y: G - 60 });
    Music.play('boss');
    this.say('SGT. VEGA', 'They’re counter-attacking! Hold this plaza, fifty seconds!', 2800);
    let wave = 0;
    this.plazaEv = this.time.addEvent({ delay: 9000, loop: true, callback: () => {
      if (!this.plazaOn) return; wave++;
      this.soldiers([['rifleman', 7900 + wave * 40], ['rifleman', 8050], ['shotgunner', 8150], [wave % 2 ? 'heavy' : 'rifleman', 8250]]);
      if (wave === 2) this.rappelWave(7400);
      if (wave === 3) { const t = new Truck(this, 8600, G, { facing: -1, stopX: 7800 }); this.vehicles.push(t); }
    } });
    this.soldiers([['rifleman', 7500], ['heavy', 7800], ['rifleman', 7950]]);
  }
  endPlaza() {
    this.plazaOn = false; this.hudTimerText = ''; if (this.plazaEv) this.plazaEv.remove();
    this.say('REAPER-2', 'Reaper flight, clearing your front. Heads down!', 2400);
    this.jetFlyby({ dir: 1, count: 3, strike: [7700, 7950, 8200], damage: 500 });
    this.time.delayedCall(2600, () => { for (const e of this.enemies) if (e.alive && !e.isVehicle && e.x > 7000) e.takeDamage(9999, { angle: 0 }); this.toHQ(); });
  }
  toHQ() { Music.play('tension'); this.setObjective('Reach the battalion HQ', { x: 8600, y: G - 60 }); }

  // SPARROW's last stand at the battalion HQ
  async hqScene() {
    if (this.hqDone) return; this.hqDone = true;
    this.reachCheckpoint(3);
    const sp = this.sparrow = new Informant(this, 8700, G); sp.free(); sp.state = 'script';
    await this.cutscene(async () => {
      this.camTo(8650, G - 250, 0.95);
      await this.say('SPARROW', 'Ghost! Over here! I have the last of the codes—', 2200);
      AudioEngine.play('incoming');
      await this.wait(900);
      this.fx.explosion(8650, G - 300, { radius: 260, big: true });
      this.setSlowmo(0.25, 2600);
      this.level.collapse(this.hq, { push: -0.2 });
      this.fx.explosion(8820, G - 80, { radius: 160 });
      await this.wait(1200);
      this.pool = this.wound(sp);
      Music.play('sad');
      await this.wait(1400);
      this.camTo(sp.x - 30, G - 110, 1.45);
      await this.walkTo(this.player, sp.x - 48, 160);
      this.player.scriptFacing = 1; this.player.scriptCrouch = true; this.player.scriptLowered = true;
      await this.say('GHOST', 'SPARROW. Stay with me. Medic!', 2400);
      await this.say('SPARROW', 'No... no time. Take this. The final launch code. Black Sun.', 3200);
      AudioEngine.play('pickup'); this.hud.notify('BLACK SUN CODES ACQUIRED', '#ffc34d');
      await this.say('SPARROW', 'My name... is Mikhail. Mikhail Orlov. Nobody has said it in years.', 3600);
      await this.say('GHOST', 'Mikhail. I’ll make sure they know it.', 2800);
      await this.say('SPARROW', 'Your friend Rook... he died for me. Tell me it meant something.', 3400);
      await this.say('GHOST', 'It meant everything.', 2400);
      await this.wait(800);
      sp.seated = false; sp.onDeath = () => {}; sp.die({ angle: Math.PI, knock: 10 });
      await this.wait(1600);
      this.hud.fade(true, 1200); await this.wait(1300);
      this.hud.chapterCard('MIKHAIL "SPARROW" ORLOV', 'INFORMANT  ·  KESSEL', 3600);
      await this.wait(1800); this.hud.fade(false, 1600); await this.wait(1400);
      this.player.scriptCrouch = false; this.player.scriptLowered = false; this.player.scriptFacing = 0;
      await this.say('DRAGO', 'Was that your little bird, Ghost? Midnight. BLACK SUN rises at midnight.', 3600);
      await this.say('SGT. VEGA', '...I’m sorry, sir. Take this. Tank on the bridge. Let’s make her pay.', 3200);
    });
    this.player.giveWeapon('launcher');
    this.reachCheckpoint(4);
    this.toBridge();
  }

  toBridge() {
    Music.play('combat');
    this.setObjective('Destroy the armour holding the bridge', { x: 11000, y: G - 80 });
    if (this.bridgeTank) return;
    const t = this.bridgeTank = new EnemyTank(this, 11500, G, { stopX: 10900, hp: 2000, name: 'BRIDGE TANK' });
    this.vehicles.push(t); this.hud.setBoss(t, 'T-80K · BRIDGE GUARD');
    t.onDestroyed = () => this.finish();
    this.soldiers([['rifleman', 10200], ['heavy', 10500], ['rifleman', 10700], ['sniper', 11000], ['shotgunner', 11200]]);
  }

  async finish() {
    this.hud.setBoss(null);
    this.hud.bigText('BRIDGE SECURED', '#ffc34d', 2000);
    await this.wait(2200);
    await this.cutscene(async () => {
      Music.play('tension');
      this.camTo(this.player.x + 300, G - 250, 0.85);
      await this.say('OVERLORD', 'Ghost, BLACK SUN is fuelling. You have until midnight.', 3000);
      await this.say('GHOST', 'Then I’ll be there at eleven fifty-five.', 2600);
    });
    this.allowComplete = true;
    this.completeStage();
  }

  tick(dt) {
    if (this.plazaOn) {
      this.plazaTime -= dt;
      this.hudTimerText = 'HOLD THE PLAZA: ' + Math.max(0, Math.ceil(this.plazaTime)) + 's';
      if (this.plazaTime <= 0) this.endPlaza();
    }
    if (this.bulldog && this.bulldog.alive) this.bulldog.stopX = Math.max(this.bulldog.x - 30, this.player.x - 380);
    // distant fighting over the rooftops
    if (Math.random() < dt * 2.2) {
      const cam = this.cameras.main; const x = cam.worldView.x + Math.random() * cam.worldView.width; const y = G - 380 - Math.random() * 180;
      const f = this.add.image(x, y, 'glow').setTint(0xffb060).setBlendMode('ADD').setScale(0.3 + Math.random() * 0.5).setDepth(DEPTH.mid + 0.5);
      this.tweens.add({ targets: f, alpha: 0, scale: 0.1, duration: 300, onComplete: () => f.destroy() });
      if (Math.random() < 0.25) AudioEngine.play('explosion', { x: x + 2400, vol: 0.12, gap: 800 });
    }
  }
}
