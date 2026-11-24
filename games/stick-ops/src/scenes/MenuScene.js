// Boot (texture generation + audio unlock) and the animated main menu.
import { GAME_W, GAME_H, FONT, COLORS, DEPTH, MISSIONS } from '../config.js';
import { generateTextures } from '../core/TextureFactory.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { SaveSystem } from '../core/SaveSystem.js';
import { drawFigure, STYLES } from '../render/StickFigure.js';
import { Helicopter } from '../entities/Helicopter.js';
import { button, title, label, addCursor } from '../ui/UI.js';
import { BackgroundTraffic } from '../systems/BackgroundTraffic.js';
import { createVehicleArt } from '../render/VehicleArt.js';

const W = GAME_W, H = GAME_H;

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // photographic surface textures (optional: procedural art is used if any fail)
    for (const k of ['dirt', 'concrete', 'metal', 'corrugated', 'rust', 'wall', 'rock', 'wood', 'asphalt', 'grate']) this.load.image('img_' + k, 'assets/textures/' + k + '.jpg');
    // Brackeys VFX bundle (CC0): flipbooks + particle textures
    this.load.spritesheet('vfx_explosion', 'assets/vfx/explosion_sheet.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('vfx_hit', 'assets/vfx/hit_sheet.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('vfx_ground', 'assets/vfx/ground_sheet.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('vfx_dome', 'assets/vfx/dome_sheet.png', { frameWidth: 80, frameHeight: 80 });
    this.load.spritesheet('vfx_air', 'assets/vfx/air_sheet.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('pv_vehicles', 'assets/vfx/pixel_vehicles.png', { frameWidth: 32, frameHeight: 21 });
    const P = { vfx_smoke1: 'smoke_01', vfx_smoke4: 'smoke_04', vfx_smoke7: 'smoke_07', vfx_ring: 'smoke_10', vfx_star: 'scorch_01', vfx_dirt: 'dirt_01', vfx_fire: 'fire_01', vfx_trace: 'trace_01', vfx_muzzle1: 'muzzle_01', vfx_muzzle2: 'muzzle_02', vfx_muzzle3: 'muzzle_03', vfx_muzzle4: 'muzzle_05' };
    for (const [k, f] of Object.entries(P)) this.load.image(k, 'assets/vfx/' + f + '.png');
    this.load.on('loaderror', (file) => console.warn('Optional asset missing:', file.key));
  }
  create() {
    try { generateTextures(this); } catch (e) { console.error('Texture generation failed', e); }
    try { createVehicleArt(this); } catch (e) { console.error('Vehicle art failed', e); }
    if (this.textures.exists('vfx_explosion') && !this.anims.exists('anim_explosion')) this.anims.create({ key: 'anim_explosion', frames: this.anims.generateFrameNumbers('vfx_explosion', { start: 1, end: 23 }), frameRate: 38 });
    const mk = (key, tex, end, fps) => { if (this.textures.exists(tex) && !this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { start: 0, end }), frameRate: fps }); };
    if (this.textures.exists('pv_vehicles')) this.textures.get('pv_vehicles').setFilter(Phaser.Textures.FilterMode.NEAREST);
    mk('anim_ground', 'vfx_ground', 11, 16); mk('anim_dome', 'vfx_dome', 15, 22); mk('anim_air', 'vfx_air', 7, 20);
    if (this.textures.exists('vfx_hit') && !this.anims.exists('anim_hit')) this.anims.create({ key: 'anim_hit', frames: this.anims.generateFrameNumbers('vfx_hit', { start: 1, end: 12 }), frameRate: 45 });
    const el = document.getElementById('boot'); if (el) el.classList.add('hidden');
    this.cameras.main.setBackgroundColor('#030507');
    title(this, W / 2, H / 2 - 40, 'STICK OPS', 84);
    title(this, W / 2, H / 2 + 30, 'BLACKOUT', 40, COLORS.dangerHex);
    const t = label(this, W / 2, H / 2 + 120, 'CLICK OR PRESS ANY KEY TO ENLIST', 20, COLORS.uiDim).setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0.25, yoyo: true, repeat: -1, duration: 700 });
    label(this, W / 2, H - 40, 'Headphones recommended  ·  WASD + Mouse', 14, '#4a5a64').setOrigin(0.5);
    const go = () => {
      if (this.started) return; this.started = true;
      AudioEngine.resume(); Music.tryPending();
      AudioEngine.play('uiconfirm');
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => this.scene.start(this.startTarget(), this.startData()));
    };
    this.input.once('pointerdown', go);
    this.input.keyboard.once('keydown', go);
    addCursor(this);
    // dev shortcut: ?scene=Mission1 jumps straight into a scene
    const m = /scene=([A-Za-z0-9]+)/.exec(window.location.search);
    this.directScene = m ? m[1] : null;
    if (this.directScene) this.time.delayedCall(50, go);
  }
  startTarget() { return this.directScene || 'Menu'; }
  startData() { const m = /cp=(\d+)/.exec(window.location.search); return { cp: m ? +m[1] : 0 }; }
}

// Shared animated battlefield backdrop used by menus
export function menuBackdrop(scene, opts = {}) {
  const theme = opts.theme || 'dusk';
  scene.add.image(W / 2, H / 2, 'sky_' + theme).setDisplaySize(W, H);
  const stars = scene.add.tileSprite(W / 2, H * 0.3, W, 400, 'stars_' + theme).setAlpha(0.8);
  const far = scene.add.tileSprite(W / 2, H * 0.78 + 40, W, 360, 'far_' + theme).setOrigin(0.5, 1);
  const flashes = scene.add.graphics();
  const convoyLayer = scene.add.container(0, 0);
  const traffic = new BackgroundTraffic(scene, { y: H * 0.78 - 4, sf: 0, sfy: 0, tint: theme === 'dawn' ? 0x3c2c32 : theme === 'night' ? 0x1e2832 : 0x2a1a22, row: 2, scale: 1.5, depth: 0, container: convoyLayer, rate: 5 });
  const mid = scene.add.tileSprite(W / 2, H * 0.78 + 120, W, 420, 'mid_' + theme).setOrigin(0.5, 1);
  // searchlights
  const beams = [];
  for (const [x, a] of [[220, -0.3], [980, 0.25], [640, 0.05]]) {
    const b = scene.add.image(x, H * 0.75, 'beam').setOrigin(0.5, 1).setBlendMode('ADD').setAlpha(0.18).setScale(2.2, 1.6).setRotation(a).setTint(0xcfe4ff);
    beams.push({ b, base: a, ph: Math.random() * 6 });
  }
  const near = scene.add.tileSprite(W / 2, H * 0.78 + 260, W, 300, 'near_' + theme).setOrigin(0.5, 1);
  const fog = scene.add.image(W / 2, H * 0.86, 'glow').setDisplaySize(W * 1.6, 300).setTint(0x5a1a20).setAlpha(0.4);
  // embers
  scene.add.particles(0, 0, 'ember', { x: { min: 0, max: W }, y: H + 10, speedY: { min: -90, max: -30 }, speedX: { min: -20, max: 40 }, lifespan: 7000, scale: { start: 1.1, end: 0 }, frequency: 90, blendMode: 'ADD', tint: [0xffa040, 0xff6020] });
  const smoke = scene.add.particles(0, 0, 'smoke', { x: { min: -100, max: W + 100 }, y: H * 0.8, speedY: { min: -20, max: -5 }, speedX: { min: 5, max: 25 }, lifespan: 9000, scale: { start: 2, end: 6 }, alpha: { start: 0.18, end: 0 }, frequency: 300, tint: 0x201418 });
  // squad silhouettes on a ridge
  const ridge = scene.add.graphics();
  ridge.fillStyle(0x050304, 1); ridge.beginPath(); ridge.moveTo(0, H); ridge.lineTo(0, H - 70);
  for (let x = 0; x <= W; x += 40) ridge.lineTo(x, H - 70 - Math.sin(x / 210) * 18 - (x > 700 && x < 1100 ? 40 * Math.sin((x - 700) / 400 * Math.PI) : 0));
  ridge.lineTo(W, H); ridge.closePath(); ridge.fillPath();
  const squadG = scene.add.graphics();
  const squad = opts.squad === false ? [] : [
    { x: 820, y: H - 108, f: 1, aim: -0.15, w: 'rifle', cr: 0 }, { x: 900, y: H - 120, f: 1, aim: 0.05, w: 'sniper', cr: 1 },
    { x: 980, y: H - 118, f: -1, aim: Math.PI + 0.2, w: 'shotgun', cr: 0 }, { x: 1060, y: H - 106, f: 1, aim: -0.4, w: 'rifle', cr: 0, low: true },
  ];
  const helis = [];
  const state = { t: 0 };
  const spawnHeli = () => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sc = 0.35 + Math.random() * 0.35;
    const h = new Helicopter(scene, dir > 0 ? -200 : W + 200, H * (0.25 + Math.random() * 0.25), { kind: Math.random() < 0.3 ? 'gunship' : 'ally', scale: sc, depth: 1, tint: 0x302830, speed: 220, lightTint: false });
    h.moveTo(dir > 0 ? W + 400 : -400, h.y - 40, 200 + Math.random() * 80); h.loud = sc * 0.6;
    helis.push(h);
  };
  scene.time.addEvent({ delay: 6500, loop: true, callback: spawnHeli });
  scene.time.delayedCall(800, spawnHeli);
  const upd = (time, delta) => {
    const dt = delta / 1000; state.t += dt;
    traffic.update(dt);
    stars.tilePositionX += dt * 2; far.tilePositionX += dt * 4; mid.tilePositionX += dt * 9; near.tilePositionX += dt * 18;
    for (const b of beams) b.b.setRotation(b.base + Math.sin(state.t * 0.4 + b.ph) * 0.35);
    flashes.clear();
    if (Math.random() < dt * 1.2) state.fl = { x: Math.random() * W, y: H * 0.62 + Math.random() * 60, t: 1 };
    if (state.fl && state.fl.t > 0) { state.fl.t -= dt * 3; flashes.fillStyle(0xffa050, state.fl.t * 0.5); flashes.fillCircle(state.fl.x, state.fl.y, 60 * (1 - state.fl.t) + 10); }
    squadG.clear();
    for (const s of squad) drawFigure(squadG, { x: s.x, y: s.y, facing: s.f, aim: s.aim + Math.sin(state.t * 0.7 + s.x) * 0.04, walk: 0, move: 0, crouch: s.cr, air: false, recoil: 0, reload: -1, hurt: 0, weapon: s.w, style: STYLES.player, time: state.t + s.x, lowered: s.low });
    for (let i = helis.length - 1; i >= 0; i--) { const h = helis[i]; h.update(dt); if (h.x < -500 || h.x > W + 500) { h.destroy(); helis.splice(i, 1); } }
  };
  scene.events.on('update', upd);
  scene.events.once('shutdown', () => { scene.events.off('update', upd); for (const h of helis) h.destroy(); helis.length = 0; AudioEngine.stopAllLoops(); });
  scene.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.9);
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    this.cameras.main.fadeIn(600, 0, 0, 0);
    menuBackdrop(this);
    Music.play('menu');
    const t1 = title(this, 330, 150, 'STICK OPS', 96).setOrigin(0.5);
    const t2 = title(this, 330, 228, 'B L A C K O U T', 38, COLORS.dangerHex).setOrigin(0.5);
    this.time.addEvent({ delay: 2600, loop: true, callback: () => {
      t2.setX(330 + (Math.random() - 0.5) * 8); t2.setAlpha(0.5);
      this.time.delayedCall(70, () => { t2.setX(330); t2.setAlpha(1); });
    } });
    label(this, 330, 270, 'A CINEMATIC STICKMAN CAMPAIGN', 14, COLORS.uiDim).setOrigin(0.5);
    const save = SaveSystem.data;
    let y = 350;
    const cp = save.checkpoint;
    if (cp) {
      const m = MISSIONS[cp.mission - 1];
      button(this, 330, y, 'CONTINUE', () => this.go(m.stages[cp.stage], { cp: cp.cp }, cp.mission, true), { sub: m.code + ' · ' + m.name, subColor: COLORS.goldHex }); y += 56;
    }
    button(this, 330, y, save.unlocked > 1 || save.completed[1] ? 'NEW CAMPAIGN' : 'START CAMPAIGN', () => this.scene.start('Briefing', { missionId: 1 })); y += 56;
    button(this, 330, y, 'MISSION SELECT', () => this.scene.start('MissionSelect'), { sub: save.unlocked + '/' + MISSIONS.length + ' UNLOCKED' }); y += 56;
    button(this, 330, y, 'ARMORY', () => this.scene.start('Armory'), { sub: save.points + ' INTEL' }); y += 56;
    button(this, 330, y, 'SETTINGS', () => this.scene.start('Settings', { from: 'Menu' })); y += 56;
    button(this, 330, y, 'CONTROLS', () => this.scene.start('Controls')); y += 56;
    label(this, W - 20, H - 26, 'v1.0  ·  Procedural art & audio', 12, '#5a6a74').setOrigin(1, 0.5);
    addCursor(this);
  }
  go(stage, data, missionId, cont) {
    if (cont) this.registry.set('mstats', null);
    this.registry.set('missionId', missionId);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(520, () => this.scene.start(stage, data));
  }
}
