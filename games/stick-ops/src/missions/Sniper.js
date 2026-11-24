// MISSION 03 — BLACKOUT (stage 1): long-range sniper overwatch from the ridge.
import { BaseMission } from '../scenes/BaseMission.js';
import { DEPTH, GAME_W, GAME_H } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';

const G = 1200, RIDGE = 900;
const rand = (a, b) => a + Math.random() * (b - a);
const ZOOM_OUT = 0.5, ZOOM_IN = 2.3, VIEW_X = 1820;

export class SniperScene extends BaseMission {
  constructor() { super('Sniper'); }
  get missionId() { return 3; }
  get stageIndex() { return 0; }
  get levelWidth() { return 4000; }
  get levelHeight() { return 1440; }
  get themeName() { return 'dusk'; }
  get lightingOpts() { return { ambient: 0x080208, darkness: 0.4, minZoom: 0.48 }; }

  buildLevel() {
    const L = this.level;
    L.background({ horizon: 620, camBaseY: 0, minZoom: 0.48 });
    for (const p of L.parallax) p.fy = 0;
    this.spawnPoint = { x: 700, y: RIDGE };
    // ridge (player position)
    L.block(0, RIDGE, 760, G - RIDGE + 240, { tex: 'tex_rock', noEdge: true });
    this.add.tileSprite(0, RIDGE - 8, 760, 28, 'edge_dusk').setOrigin(0).setDepth(DEPTH.solids + 1);
    L.ground(760, 3240, G, 'concrete');
    // base below
    L.building(1250, G, 420, 300, { lit: 0.35, sign: 'IRON SPIRE' });
    L.decor('tower', 2050, G, { depth: DEPTH.backdrop + 2 });
    L.platform(1975, G - 250, 150, { supportTo: G });
    L.decor('flak', 2650, G, { depth: DEPTH.decorBack + 2, flip: true });
    L.sandbags(2560, G); L.sandbags(2760, G);
    L.building(2950, G, 520, 360, { lit: 0.3, sign: 'COMMS' });
    L.decor('dish', 3250, G - 360, { depth: DEPTH.backdrop + 3 });
    L.building(3500, G, 380, 320, { lit: 0.3, roof: true });
    L.prop('terminal', 3420, G, { depth: DEPTH.decorBack + 2 });
    L.crate(1800, G); L.crate(2300, G, 1, true); L.container(3150, G, 'red');
    for (const x of [1100, 1700, 2450, 3300]) L.lamp(x, G);
    this.lighting.add({ x: 2050, y: G - 300, cone: { angle: 2.2, len: 600, width: 170 }, i: 1, color: 0xe8f4ff, glowAlpha: 0.2 });
    this.hudMode = 'sniper';
  }

  setupMission() {
    this.addCheckpoint(700, RIDGE);
    const p = this.player;
    p.controlsLocked = true; p.crouch = 1; p.switchTo('sniper'); p.switchT = 0;
    this.scoped = false; this.mag = 5; this.reserve = 20; this.reloadT = 0; this.fireCd = 0; this.breath = 100;
    this.aimW = { x: 2000, y: G - 60 }; this.baseW = { x: 2000, y: G - 60 };
    this.sniperState = { scoped: false, breath: 100, mag: 5, reserve: 20, reloading: 0, hp: 100, alarm: 0 };
    this.input.on('pointerdown', (ptr) => {
      if (this.cinematic || this.ended) return;
      if (ptr.button === 2) this.setScope(!this.scoped);
      else if (ptr.button === 0) { if (this.scoped) this.fire(); else this.setScope(true); }
    });
    this.keys = this.input.keyboard.addKeys('R,SHIFT');
    this.targetsList = [];
    this.alarm = false;
  }

  onStart() {
    Music.play('tension');
    const mk = (type, x, y, opts) => { const s = this.spawnSoldier(type, x, y, Object.assign({ facing: -1 }, opts)); s.isMarked = true; s.def = Object.assign({}, s.def, { sight: 0 }); s.setMark('▼', '#ff4a3a'); this.targetsList.push(s); return s; };
    mk('rifleman', 1500, G, { patrol: [1350, 1750], flashlight: true });
    mk('sniper', 2050, G - 250, { hold: true });
    mk('rifleman', 2620, G, {});
    mk('heavy', 2700, G, {});
    this.officer = mk('officer', 3000, G, { patrol: [2850, 3300] });
    this.counter = mk('sniper', 3650, G - 320, { hold: true });
    this.counter.state = 'scripted';
    this.cutscene(async () => {
      await this.chapter('BLACKOUT', 'IRON SPIRE RIDGE  -  21:10 LOCAL', 3000);
      this.camTo(VIEW_X, G - 380, ZOOM_OUT);
      await this.say('GHOST', '(turning Rook’s dog tags over) This one’s for you, brother.', 3000);
      await this.say('OVERLORD', 'Ghost, you have eyes on Iron Spire. Six marked hostiles guard the approach.', 3200);
      await this.say('OVERLORD', 'Take them out quietly. Watch the officer — if he reaches the radio, the base goes on alert.', 3400);
      await this.say('GHOST', 'Wind is low. Range two hundred. Sending it.', 2400);
    }).then(() => {
      this.camOverride = null;
      this.setObjective('Eliminate the 6 marked hostiles', null);
      this.hud.notify('CLICK / RMB: SCOPE · LMB: FIRE · SHIFT: HOLD BREATH · R: RELOAD', '#9fb4c0');
    });
  }

  setScope(on) {
    if (this.reloadT > 0 && on) return;
    this.scoped = on;
    AudioEngine.play('switch');
    if (on) {
      const ptr = this.input.activePointer; const cam = this.cameras.main;
      this.baseW = cam.getWorldPoint(ptr.x, ptr.y); this.ptrAtScope = { x: ptr.x, y: ptr.y };
    }
  }

  fire() {
    if (this.fireCd > 0 || this.reloadT > 0) return;
    if (this.mag <= 0) { AudioEngine.play('dry'); this.startReload(); return; }
    this.mag--; this.fireCd = 1.1; this.stats.shots++;
    const pose = this.player.lastPose; const m = pose && pose.muzzle ? pose.muzzle : { x: 680, y: RIDGE - 40 };
    const P = this.aimPoint();
    const ang = Math.atan2(P.y - m.y, P.x - m.x);
    const b = this.combat.fire({ x: m.x, y: m.y, angle: ang, speed: 4800, damage: 220, team: 'player', range: 4000, color: 0xbfe9ff, width: 3, penetration: 2, headMult: 3, knock: 450, weapon: 'sniper', owner: this.player, trailLen: 300 });
    AudioEngine.play('sniper', { pan: -0.3 });
    this.fx.muzzle(m.x, m.y, ang, 1.4); this.player.recoil = 1;
    this.fx.shake(160, 0.006);
    this.makeNoise(P.x, P.y, 420);
    // bullet-cam on the final marked kill
    const alive = this.targetsList.filter((t) => t.alive);
    if (alive.length === 1) {
      const t = alive[0]; const h = t.hitTest(m.x, m.y, m.x + Math.cos(ang) * 4000, m.y + Math.sin(ang) * 4000);
      if (h) {
        const dmg = 220 * (h.part === 'head' ? 3 : (t.armor || 1));
        if (dmg >= t.hp) this.bulletCam(b);
      }
    }
    this.firstShot = true;
    if (this.mag === 0) this.time.delayedCall(500, () => this.startReload());
  }

  bulletCam(b) {
    this.bcam = b; this.setScope(false); this.cinematic = true; this.hud.letterbox(true);
    this.setSlowmo(0.2, 0);
    b.trailLen = 600;
    this.bulletImg = this.add.image(b.x, b.y, 'spark').setScale(3, 2).setTint(0xffe8b0).setDepth(DEPTH.fxTop).setBlendMode('ADD');
  }

  startReload() {
    if (this.reserve <= 0 || this.mag >= 5 || this.reloadT > 0) return;
    this.reloadT = 2.4; this.scoped = false;
    AudioEngine.play('reload', { dur: 2.4 });
  }

  aimPoint() {
    const t = this.time.now / 1000;
    const steady = this.keys.SHIFT.isDown && this.breath > 0 ? 0.12 : 1;
    const sx = (Math.sin(t * 0.9) * 13 + Math.sin(t * 2.3) * 5) * steady, sy = (Math.cos(t * 1.15) * 10 + Math.sin(t * 1.9) * 4) * steady;
    return { x: this.aimW.x + sx, y: this.aimW.y + sy };
  }

  onKill(s) {
    if (!s.isMarked) return;
    const left = this.targetsList.filter((t) => t.alive).length;
    if (s === this.officer) this.hudTimerText = '';
    if (left > 0) this.hud.notify(`TARGET DOWN · ${left} REMAINING`, '#7cff9a');
    if (left === 0 && !this.done) {
      this.done = true;
      this.time.delayedCall(this.bcam ? 2200 : 900, () => this.finish());
    }
  }

  // guards scatter for cover when shots land nearby
  hearShot(x) {
    for (const e of this.targetsList) {
      if (!e.alive || e.state === 'scripted') continue;
      if (Math.abs(e.x - x) < 600 && !e.panicked) {
        e.panicked = true; e.state = 'suspicious'; e.investigate = { x: e.x + rand(-180, 180), y: e.y }; e.susT = -20; e.speedMul = 2.2; e.setMark('▼', '#ff4a3a');
        if (e === this.officer && !this.alarm) { this.officerRun = 6; this.say('OVERLORD', 'The officer is going for the radio! Drop him!', 2400); e.investigate = { x: 3420, y: G }; }
      }
    }
  }

  makeNoise(x, y, r) { this.hearShot(x); }

  async finish() {
    this.hudTimerText = '';
    this.registry.set('m3alarm', this.alarm);
    await this.cutscene(async () => {
      this.camTo(VIEW_X, G - 380, ZOOM_OUT);
      await this.say('GHOST', 'Overwatch is clear. Moving down to the base.', 2400);
      if (this.alarm) await this.say('OVERLORD', 'They know you\'re coming, Ghost. Expect a warm welcome.', 2600);
      else await this.say('OVERLORD', 'Clean work. They never knew you were there.', 2400);
    });
    this.allowComplete = true;
    this.completeStage();
  }

  tick(dt, rdt) {
    const s = this.sniperState; const p = this.player;
    this.fireCd -= rdt;
    // breath
    if (this.scoped && this.keys.SHIFT.isDown && this.breath > 0) this.breath = Math.max(0, this.breath - rdt * 30); else this.breath = Math.min(100, this.breath + rdt * 18);
    // reload
    if (this.reloadT > 0) { this.reloadT -= rdt; if (this.reloadT <= 0) { const take = Math.min(5 - this.mag, this.reserve); this.mag += take; this.reserve -= take; } }
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.startReload();
    // aim point from pointer
    const ptr = this.input.activePointer; const cam = this.cameras.main;
    if (this.scoped && this.ptrAtScope) {
      const dx = (ptr.x - this.ptrAtScope.x) / ZOOM_IN * 1.4, dy = (ptr.y - this.ptrAtScope.y) / ZOOM_IN * 1.4;
      // edge drift lets you pan further
      if (ptr.x < 60) this.baseW.x -= rdt * 400; if (ptr.x > GAME_W - 60) this.baseW.x += rdt * 400;
      this.aimW = { x: Phaser.Math.Clamp(this.baseW.x + dx, 800, 3950), y: Phaser.Math.Clamp(this.baseW.y + dy, 600, G + 40) };
    } else if (!this.cinematic) {
      const w = cam.getWorldPoint(ptr.x, ptr.y); this.aimW = { x: w.x, y: w.y };
    }
    // player pose: aim toward point
    const P = this.aimPoint();
    p.facing = 1; p.aim = Math.atan2(P.y - (p.y - 45), P.x - p.x); p.crouch = 1;
    // officer alarm run
    if (this.officerRun !== undefined && this.officer.alive && !this.alarm) {
      this.officerRun -= dt; this.hudTimerText = 'RADIO ALARM: ' + Math.max(0, Math.ceil(this.officerRun)) + 's';
      if (this.officerRun <= 0) { this.alarm = true; this.hudTimerText = 'BASE ALERTED'; AudioEngine.play('alarm'); this.hud.notify('ALARM RAISED — EXPECT HEAVIER RESISTANCE', '#ff4a3a'); }
    }
    // counter-sniper
    if (this.firstShot && this.counter && this.counter.alive && !this.ended) {
      this.csT = (this.csT === undefined ? 5 : this.csT) - dt;
      if (this.csT < 1.6 && !this.csWarn) { this.csWarn = true; this.hud.notify('COUNTER-SNIPER GLINT!', '#ff4a3a'); AudioEngine.play('beep'); }
      if (this.csWarn && Math.random() < 0.3) { const g = this.add.image(this.counter.x + 10, this.counter.y - 70, 'glow').setBlendMode('ADD').setTint(0xffffff).setScale(0.6).setDepth(DEPTH.fxTop); this.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() }); }
      if (this.csT <= 0) {
        this.csT = rand(5, 7); this.csWarn = false;
        const from = { x: this.counter.x + 20, y: this.counter.y - 60 };
        const to = p.chest();
        const ang = Math.atan2(to.y - from.y, to.x - from.x) + (this.scoped ? 0 : rand(-0.02, 0.02));
        this.combat.fire({ x: from.x, y: from.y, angle: ang, speed: 3600, damage: this.scoped ? 34 : 14, team: 'enemy', range: 4000, color: 0xff5050, width: 3, owner: this.counter });
        this.fx.muzzle(from.x, from.y, ang, 1.2); AudioEngine.play('sniper', { x: this.counter.x, vol: 0.6 });
      }
    }
    // bullet cam follow
    if (this.bcam) {
      const b = this.bcam;
      if (this.combat.bullets.includes(b)) { this.camOverride = { x: b.x, y: b.y }; this.zoomTarget = 1.6; this.bulletImg.setPosition(b.x, b.y).setRotation(b.angle); this.camFollow.setPosition(b.x, b.y); }
      else { this.bcam = null; this.bulletImg.destroy(); this.time.delayedCall(250, () => { this.setSlowmo(0.3, 1200); this.hud.letterbox(false); this.time.delayedCall(1300, () => { this.cinematic = false; this.camOverride = null; }); }); }
    }
    s.scoped = this.scoped && !this.cinematic; s.breath = this.breath; s.mag = this.mag; s.reserve = this.reserve;
    s.reloading = this.reloadT > 0 ? 1 - this.reloadT / 2.4 : 0; s.hp = p.hp / p.maxHp * 100;
  }

  updateCamera(rdt) {
    const cam = this.cameras.main;
    if (this.camOverride) {
      const k = Math.min(1, rdt * (this.bcam ? 20 : 2));
      this.camFollow.x += (this.camOverride.x - this.camFollow.x) * k; this.camFollow.y += (this.camOverride.y - this.camFollow.y) * k;
      cam.zoom += (this.zoomTarget - cam.zoom) * Math.min(1, rdt * 3);
      return;
    }
    if (this.scoped) {
      const P = this.aimPoint();
      this.camFollow.setPosition(P.x, P.y);
      cam.zoom += (ZOOM_IN - cam.zoom) * Math.min(1, rdt * 12);
    } else {
      this.camFollow.x += (VIEW_X - this.camFollow.x) * Math.min(1, rdt * 6); this.camFollow.y += (G - 380 - this.camFollow.y) * Math.min(1, rdt * 6);
      cam.zoom += (ZOOM_OUT - cam.zoom) * Math.min(1, rdt * 10);
    }
  }
}
