// Shared gameplay scene: owns world systems, actors, camera, checkpoints, objectives and cinematics.
// Each mission extends this and implements buildLevel() + setupMission().
import { DEPTH, GAME_W, GAME_H, WEAPONS, MISSIONS } from '../config.js';
import { Effects } from '../systems/Effects.js';
import { Lighting } from '../systems/Lighting.js';
import { Level } from '../systems/Level.js';
import { Combat, segRect } from '../systems/Combat.js';
import { Player } from '../entities/Player.js';
import { Soldier } from '../entities/Soldier.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { BackgroundTraffic } from '../systems/BackgroundTraffic.js';
import { Music } from '../core/Music.js';
import { SaveSystem } from '../core/SaveSystem.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class BaseMission extends Phaser.Scene {
  init(data) {
    // Phaser reuses this scene object on restart: drop everything the previous attempt left on it
    // (boss refs, "already spawned" flags...) so a retry rebuilds the mission from scratch.
    if (!this._baseKeys) this._baseKeys = new Set(Object.keys(this).concat('_baseKeys'));
    else for (const k of Object.keys(this)) if (!this._baseKeys.has(k)) delete this[k];
    this.startData = data || {};
    this.cpIndex = this.startData.cp || 0;
  }

  // ---- overridable config ----
  get missionId() { return 1; }
  get stageIndex() { return 0; }
  get levelWidth() { return 6000; }
  get levelHeight() { return 1080; }
  get themeName() { return 'night'; }
  get lightingOpts() { return null; }
  buildLevel() {}
  setupMission() {}
  tick() {}

  create() {
    this.slow = 1; this.cinematic = false; this.ended = false; this.uiBlocking = false;
    this.ffApplied = 1; this.ffKeys = null; this.time.timeScale = 1; this.tweens.timeScale = 1;
    this.actors = []; this.targets = []; this.enemies = []; this.allies = []; this.vehicles = []; this.helis = [];
    this.interactables = []; this.triggers = []; this.pickups = []; this.updaters = []; this.checkpoints = [];
    this.theme = this.themeName;
    this.cameras.main.setBackgroundColor('#000000');
    this.fx = new Effects(this);
    const lo = this.lightingOpts; if (lo) this.lighting = new Lighting(this, lo);
    this.level = new Level(this, { width: this.levelWidth, height: this.levelHeight, theme: this.theme });
    this.combat = new Combat(this);
    this.stats = this.registry.get('mstats') || { kills: 0, shots: 0, hits: 0, headshots: 0, time: 0, deaths: 0 };
    this.registry.set('mstats', this.stats);
    this.statsAtStart = Object.assign({}, this.stats);

    this.buildLevel();
    const sp = this.spawnPoint || { x: 200, y: 900 };
    this.player = new Player(this, sp.x, sp.y, this.playerOpts || {});
    this.player.stats = this.stats;

    // HUD overlay
    this.scene.launch('HUD', { mission: this });
    this.hud = this.scene.get('HUD');
    this.scene.bringToTop('HUD');

    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.levelWidth, this.levelHeight);
    this.camFollow = this.add.zone(sp.x, sp.y - 100, 2, 2);
    cam.startFollow(this.camFollow, false, 1, 1);
    cam.centerOn(sp.x, sp.y - 100);
    this.camOverride = null; this.baseZoom = 1; this.zoomTarget = 1;
    cam.fadeIn(600, 0, 0, 0);

    // pause & debug input
    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard.on('keydown-P', () => this.pauseGame());
    this.blurHandler = () => { if (this.scene.isActive() && !this.ended) this.pauseGame(); };
    this.game.events.on('blur', this.blurHandler);
    this.debug = /debug/.test(window.location.search);
    if (this.debug) this.setupDebug();
    this.input.mouse && this.input.mouse.disableContextMenu();

    this.events.once('shutdown', () => this.cleanup());

    this.setupMission();
    this.ready = false;
    // wait one frame so the HUD scene has been created before scripts talk to it
    this.time.delayedCall(1, () => { this.ready = true; this.applyCheckpoint(this.cpIndex); });
    if (this.lighting) this.playerLight = this.lighting.add({ follow: this.player, ox: 0, oy: -50, r: 230, i: 0.55 });
    window.__mission = this;
  }

  cleanup() {
    AudioEngine.stopAllLoops();
    AudioEngine.setSlowmo(false);
    this.game.events.off('blur', this.blurHandler);
    if (this.lighting) this.lighting.destroy();
  }

  setupDebug() {
    const kb = this.input.keyboard;
    kb.on('keydown-F1', () => { this.player.godMode = !this.player.godMode; this.hud.notify('GOD MODE ' + (this.player.godMode ? 'ON' : 'OFF')); });
    kb.on('keydown-F2', () => { const n = this.cpIndex + 1; if (this.checkpoints[n]) { this.scene.restart({ cp: n }); } });
    kb.on('keydown-F3', () => { for (const e of [...this.enemies]) if (e.alive) e.takeDamage(99999, { angle: 0 }); for (const v of this.vehicles) if (v.alive && v.team === 'enemy') v.takeDamage(99999, { explosive: true }); if (this.boss && this.boss.alive) this.boss.takeDamage(99999, { explosive: true }); });
    kb.on('keydown-F4', () => this.completeStage());
  }

  // ---------- registries ----------
  registerActor(a) {
    this.actors.push(a); this.targets.push(a);
    this.physics.add.collider(a.zone, this.solidGroup, null, (az, sz) => {
      const s = sz.solid; if (!s || s.dead) return false;
      if (s.oneWay) { if (a.dropping > 0) return false; return a.body.velocity.y >= 0 && a.body.bottom <= s.y + 14; }
      return true;
    });
    if (!a.isPlayer) { if (a.team === 'enemy') this.enemies.push(a); else this.allies.push(a); }
  }
  unregisterActor(a) {
    for (const list of [this.actors, this.targets, this.enemies, this.allies]) { const i = list.indexOf(a); if (i >= 0) list.splice(i, 1); }
  }
  registerTarget(t) { this.targets.push(t); }
  spawnSoldier(type, x, y, opts = {}) { return new Soldier(this, x, y, type, opts); }
  spawnAlly(x, y, opts = {}) { const s = new Soldier(this, x, y, 'rifleman', Object.assign({ team: 'player', state: 'combat', weapon: 'e_rifle', hp: 400 }, opts)); s.allyIdx = this.allies.length; return s; }

  // ---------- world queries ----------
  groundBelow(x, y) {
    let best = null;
    for (const s of this.solids) {
      if (x >= s.x && x <= s.x + s.w && s.y >= y - 2) { if (best === null || s.y < best) best = s.y; }
    }
    return best;
  }
  raycast(x1, y1, x2, y2) {
    let bt = 2;
    for (const s of this.solids) { if (s.oneWay || s.bulletPass) continue; const t = segRect(x1, y1, x2, y2, s); if (t >= 0 && t < bt) bt = t; }
    return bt <= 1 ? { x: x1 + (x2 - x1) * bt, y: y1 + (y2 - y1) * bt, t: bt } : null;
  }
  visibilityOf(p) {
    if (this.theme !== 'night' || !this.lighting || this.lighting.darkness < 0.3) return 1;
    if (p.noise > 300) return 1;
    for (const l of this.lighting.lights) {
      if (!l.on) continue;
      if (l.cone) {
        const dx = p.x - l.x, dy = p.y - 40 - l.y; const d = Math.hypot(dx, dy);
        if (d < l.cone.len * 0.9) { let da = Math.atan2(dy, dx) - l.cone.angle; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; if (Math.abs(da) < 0.32) return 1; }
      } else if (l.r > 120 && Math.hypot(p.x - l.x, p.y - 40 - l.y) < l.r * 0.55) return 1;
    }
    return p.crouching ? 0.38 : 0.55;
  }
  makeNoise(x, y, radius) { for (const e of this.enemies) if (e.hear) e.hear(x, y, radius); }
  alertNearby(src, r) { for (const e of this.enemies) if (e !== src && e.alive && e.alert && Math.abs(e.x - src.x) < r && Math.abs(e.y - src.y) < 300) e.alert('radio'); }
  onEnemyAlerted() {}

  applyExplosion(x, y, r, dmg, owner, source) {
    for (const t of [...this.targets]) {
      if (!t.alive) continue;
      const c = t.center ? t.center() : t.chest ? t.chest() : { x: t.x, y: t.y };
      const d = Math.hypot(c.x - x, c.y - y);
      const reach = t.isVehicle || t.isHeli ? r + 80 : r;
      if (d > reach) continue;
      if (owner !== 'world' && t.team === owner && !t.isPlayer) continue;
      const f = 1 - d / reach;
      let dmgNow = dmg * (0.35 + 0.65 * f);
      if (t.isPlayer && owner === 'player') dmgNow *= 0.5;
      const killed = t.takeDamage(dmgNow, { explosive: true, x, y, angle: Math.atan2(c.y - y, c.x - x), knock: 300 + 300 * f, team: owner, part: 'body', weapon: 'explosive' });
      const byPlayer = owner === 'player' || (source && source.isPlayer);
      if (byPlayer && t.team === 'enemy' && !t.isRocket) this.onPlayerHit(t, killed, false, { weapon: 'explosive' });
    }
    for (const b of this.barrels) if (!b.dead && Math.hypot(b.x - x, b.y - y) < r) this.level.damageBarrel(b, 100, source);
    if (this.onExplosion) this.onExplosion(x, y, r);
  }

  onPlayerHit(target, killed, head, b) {
    if (target.isRocket) { this.hud.hitMarker(true, false); return; }
    if (b && b.weapon !== 'explosive') this.stats.hits++;
    this.hud.hitMarker(killed, head);
    AudioEngine.play(killed ? 'killconfirm' : 'hitmarker', { gap: 30 });
    if (killed && !target.isVehicle && !target.isHeli) {
      this.stats.kills++;
      if (head) { this.stats.headshots++; AudioEngine.play('headshot', { x: target.x }); }
      // cinematic kill slow-mo on sniper headshots / last enemy in fights
      const now = this.time.now;
      if (this.slow === 1 && (!this.lastKillcam || now - this.lastKillcam > 7000)) {
        const aliveNear = this.enemies.filter((e) => e.alive && e.state === 'combat' && Math.abs(e.x - this.player.x) < 1200).length;
        if ((head && b && b.weapon === 'sniper') || (aliveNear === 0 && this.encounterActive)) { this.lastKillcam = now; this.setSlowmo(0.3, 900); }
      }
    }
  }

  onSoldierKilled(s) {
    if (s.team === 'enemy' && Math.random() < 0.35) this.spawnPickup('ammo', s.x, s.y - 20);
    if (this.onKill) this.onKill(s);
  }
  onVehicleDestroyed() {}

  spawnPickup(kind, x, y) {
    const img = this.add.image(x, y, 'ammo').setDepth(DEPTH.actors - 1);
    const glow = this.add.image(x, y, 'glow').setBlendMode('ADD').setTint(0xffd060).setScale(0.5).setAlpha(0.35).setDepth(DEPTH.actors - 2);
    const p = { kind, img, glow, x, y, vy: -200, life: 30 };
    this.pickups.push(p);
    return p;
  }

  supplyCrate(x, groundY) {
    this.level.prop('crate_metal', x, groundY, { scale: 0.8 });
    const it = { x, y: groundY - 20, radius: 70, label: 'Resupply ammo & grenades', hold: 500, enabled: true, onUse: () => {
      const p = this.player; for (const id of p.loadout) { const w = WEAPONS[id]; p.ammo[id].reserve = Math.max(p.ammo[id].reserve, w.reserve); }
      p.grenades = Math.max(p.grenades, 3); this.hud.notify('RESUPPLIED', '#7cff9a'); AudioEngine.play('switch');
      this.time.delayedCall(12000, () => { it.enabled = true; });
    } };
    this.interactables.push(it);
    return it;
  }

  updatePickups(dt) {
    const pl = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      const g = this.groundBelow(p.x, p.y - 4);
      p.vy += 1200 * dt; p.y += p.vy * dt;
      if (g !== null && p.y > g - 10) { p.y = g - 10; p.vy = 0; }
      p.img.setPosition(p.x, p.y + Math.sin(this.time.now / 200) * 2); p.glow.setPosition(p.x, p.y);
      if (p.life < 3) p.img.setAlpha(p.life / 3);
      if (pl.alive && Math.abs(pl.x - p.x) < 34 && Math.abs(pl.y - 20 - p.y) < 60) {
        for (const id of pl.loadout) { const w = WEAPONS[id]; const a = pl.ammo[id]; a.reserve = Math.min(w.reserve * 2, a.reserve + Math.ceil(a.max * (id === 'launcher' ? 1 : 0.7))); }
        this.hud.notify('+ AMMO', '#ffc34d'); AudioEngine.play('pickup');
        p.life = 0;
      }
      if (p.life <= 0) { p.img.destroy(); p.glow.destroy(); this.pickups.splice(i, 1); }
    }
  }

  // ---------- triggers, objectives, checkpoints ----------
  addTrigger(x, fn, opts = {}) { const t = Object.assign({ x, fn, fired: false }, opts); this.triggers.push(t); return t; }
  addCheckpoint(x, y, opts = {}) { this.checkpoints.push(Object.assign({ x, y }, opts)); return this.checkpoints.length - 1; }

  reachCheckpoint(i) {
    if (i <= this.cpIndex) return;
    this.cpIndex = i;
    SaveSystem.setCheckpoint({ mission: this.missionId, stage: this.stageIndex, cp: i });
    this.statsAtStart = Object.assign({}, this.stats);
    this.hud.notify('CHECKPOINT REACHED', '#5ee0ff');
  }

  applyCheckpoint(i) {
    const cp = this.checkpoints[i];
    if (!cp) { if (this.onStart) this.onStart(); return; }
    if (i > 0) {
      this.player.setPosition(cp.x, cp.y);
      this.camFollow.setPosition(cp.x, cp.y - 100); this.cameras.main.centerOn(cp.x, cp.y - 100);
      for (const t of this.triggers) if (t.x < cp.x && !t.keep) t.fired = true;
    }
    if (cp.restore) cp.restore.call(this, i);
    else if (i === 0 && this.onStart) this.onStart();
    // Encounters whose trigger sits just behind this checkpoint but whose enemies stand ahead of it:
    // spawn them again on retry, dropping any that would appear behind the player.
    if (i > 0) for (const t of this.triggers) {
      if (!t.respawnUntil || t.x >= cp.x || cp.x >= t.respawnUntil) continue;
      const before = new Set(this.enemies);
      t.fn.call(this, t);
      for (const e of [...this.enemies]) if (!before.has(e) && e.x < cp.x + 200 && e.destroy) e.destroy();
    }
  }

  setObjective(text, target, opts = {}) {
    this.objective = { text, target };
    this.hud.setObjective(text, target, opts);
    if (!opts.silent) AudioEngine.play('objective');
  }

  // ---------- slow motion & cinematics ----------
  setSlowmo(s, ms) {
    this.slow = s;
    this.physics.world.timeScale = 1 / (s * (this.ffApplied || 1));
    this.fx.setTimeScale(s);
    AudioEngine.setSlowmo(s < 1);
    if (s < 1) AudioEngine.play('slowmo');
    this.hud.setSlowmo(s < 1);
    if (this.slowTimer) this.slowTimer.remove();
    if (ms) this.slowTimer = this.time.delayedCall(ms, () => this.setSlowmo(1));
  }

  // ---------- cutscene toolkit ----------
  // walk an actor (player, soldier or SPARROW) to x; resolves on arrival
  walkTo(actor, x, speed = 130) {
    return new Promise((res) => {
      const start = this.time.now;
      const step = () => {
        if (!actor.alive || !this.scene.isActive()) { actor.scriptVx = undefined; res(); return; }
        const dx = x - actor.x;
        if (Math.abs(dx) < 10 || this.time.now - start > 9000) { actor.scriptVx = undefined; actor.body.setVelocityX(0); res(); return; }
        actor.scriptVx = Math.sign(dx) * speed; actor.facing = Math.sign(dx);
        this.time.delayedCall(16, step);
      };
      step();
    });
  }
  chapter(title, sub, ms = 3200) { this.hud.chapterCard(title, sub, ms); return this.wait(ms); }
  // seated, wounded pose with a spreading blood pool
  wound(actor) {
    actor.seated = true; actor.lowered = true; actor.state = actor.state === 'combat' ? 'scripted' : actor.state;
    actor.body.setVelocityX(0);
    const pool = this.add.image(actor.x + 6, actor.y + 1, 'glow').setTint(0x3a0404).setScale(0.05, 0.02).setDepth(DEPTH.decorBack + 6).setAlpha(0.9);
    this.tweens.add({ targets: pool, scaleX: 0.9, scaleY: 0.12, duration: 6000 });
    return pool;
  }
  // music follows the action: combat swells when spotted, settles back when it goes quiet
  updateMusicMix() {
    if (!this.calmMusic || this.cinematic || this.ended) return;
    const pl = this.player;
    const hot = this.enemies.some((e) => e.alive && !e.isVehicle && e.state === 'combat' && Math.abs(e.x - pl.x) < 1300);
    if (hot) { this.lastHot = this.time.now; if (Music.current === this.calmMusic) Music.play('combat'); }
    else if (Music.current === 'combat' && this.time.now - (this.lastHot || 0) > 10000) Music.play(this.calmMusic);
  }

  // distant convoys along the horizon (pixel vehicles), updated every frame
  addTraffic(opts) {
    const t = new BackgroundTraffic(this, opts);
    this.updaters.push((dt, rdt) => t.update(rdt));
    this.events.once('shutdown', () => t.destroy());
    return t;
  }

  wait(ms) { return new Promise((res) => this.time.delayedCall(ms, res)); }
  say(speaker, text, ms = 2800) {
    this.hud.subtitle(speaker, text, ms);
    Music.duck(0.5, ms / 1000 + 0.3);
    if (['OVERLORD', 'VIPER 2-1'].includes(speaker)) AudioEngine.play('radio', { gap: 200 });
    return this.wait(ms);
  }

  // Friendly fast-movers streak across the sky; optionally drop a bomb run on enemy positions.
  jetFlyby(opts = {}) {
    const cam = this.cameras.main; const v = cam.worldView;
    const dir = opts.dir || 1; const y = opts.y || v.y + v.height * 0.18;
    AudioEngine.play('jets', { vol: 0.9, gap: 2000 });
    for (let i = 0; i < (opts.count || 2); i++) {
      const sx = dir > 0 ? v.x - 400 - i * 220 : v.right + 400 + i * 220;
      const jet = (this.textures.exists('v_a10') ? this.add.image(sx, y + i * 46, 'v_a10').setScale((0.75 - i * 0.1) * 260 / 242).setTint(0x8a8e92) : this.add.image(sx, y + i * 46, 'jet').setScale(0.75 - i * 0.1).setTint(0x2a2a30)).setDepth(DEPTH.near + 1).setFlipX(dir < 0);
      const glow = this.add.image(sx, y + i * 46, 'glow').setBlendMode('ADD').setTint(0xffa050).setScale(0.6).setDepth(DEPTH.near + 1);
      this.tweens.add({ targets: [jet, glow], x: `+=${dir * (v.width + 1400)}`, duration: 1900 + i * 150, delay: 300 + i * 260, ease: 'Linear', onComplete: () => { jet.destroy(); glow.destroy(); } });
      this.tweens.add({ targets: glow, alpha: 0.3, yoyo: true, repeat: -1, duration: 60 });
    }
    if (opts.strike) {
      const pts = opts.strike;
      pts.forEach((x, i) => this.time.delayedCall(1400 + i * 220, () => {
        const gy = this.groundBelow(x, 0) ?? (this.levelHeight - 140);
        this.fx.explosion(x, gy - 20, { radius: 230, damage: opts.damage || 400, owner: 'player', big: true });
      }));
    }
    this.fx.shake(900, 0.006);
  }

  async cutscene(fn) {
    this.cinematic = true; this.player.controlsLocked = true; this.hud.letterbox(true);
    this.player.invulnerable = true;
    try { await fn(); } catch (e) { console.error(e); }
    if (!this.scene.isActive() && !this.scene.isPaused()) return;
    this.camOverride = null; this.zoomTarget = 1;
    this.hud.letterbox(false); this.cinematic = false; this.player.invulnerable = false;
    if (this.player.alive && !this.player.mounted) this.player.controlsLocked = false;
  }

  camTo(x, y, zoom) { this.camOverride = { x, y }; if (zoom) this.zoomTarget = zoom; }
  camRelease() { this.camOverride = null; this.zoomTarget = 1; }

  // ---------- flow ----------
  pauseGame() {
    if (this.ended || !this.scene.isActive()) return;
    this.scene.launch('Pause', { from: this.scene.key });
    this.scene.pause();
    this.scene.pause('HUD');
  }

  onPlayerDeath() {
    if (this.ended) return;
    this.ended = true; this.stats.deaths++;
    this.setSlowmo(0.3, 1400);
    this.hud.letterbox(true);
    this.time.delayedCall(1700, () => {
      this.scene.launch('Fail', { from: this.scene.key, cp: this.cpIndex, reason: this.failReason || 'K.I.A.' });
      this.scene.pause();
    });
  }

  failMission(reason) {
    if (this.ended) return;
    this.failReason = reason; this.ended = true; this.stats.deaths++;
    this.player.controlsLocked = true;
    this.setSlowmo(0.35, 1000);
    this.time.delayedCall(1300, () => { this.scene.launch('Fail', { from: this.scene.key, cp: this.cpIndex, reason }); this.scene.pause(); });
  }

  completeStage() {
    if (this.ended && !this.allowComplete) return;
    this.ended = true;
    const m = MISSIONS[this.missionId - 1];
    const next = m.stages[this.stageIndex + 1];
    SaveSystem.setCheckpoint(next ? { mission: this.missionId, stage: this.stageIndex + 1, cp: 0 } : null);
    this.cameras.main.fadeOut(1200, 0, 0, 0);
    this.time.delayedCall(1300, () => {
      if (next) this.scene.start(next, { cp: 0 });
      else { this.scene.stop('HUD'); this.scene.start('Result', { missionId: this.missionId, stats: this.stats }); }
    });
  }

  // ---------- main loop ----------
  /* hold ENTER / SPACE during a cutscene to fast-forward it (x4): everything still plays in order */
  updateFastForward() {
    const kb = this.input.keyboard;
    if (!this.ffKeys) this.ffKeys = kb ? kb.addKeys('ENTER,SPACE', false) : {};
    const held = this.cinematic && !this.ended && ((this.ffKeys.ENTER && this.ffKeys.ENTER.isDown) || (this.ffKeys.SPACE && this.ffKeys.SPACE.isDown));
    const ff = held ? 4 : 1;
    if (this.hud && this.hud.setCineHint) this.hud.setCineHint(this.cinematic && !this.ended, ff > 1);
    if (ff === (this.ffApplied || 1)) return ff;
    this.ffApplied = ff;
    this.time.timeScale = ff; this.tweens.timeScale = ff; this.physics.world.timeScale = 1 / (this.slow * ff);
    if (this.hud && this.hud.sys && this.hud.sys.settings.active) { this.hud.time.timeScale = ff; this.hud.tweens.timeScale = ff; this.hud.ff = ff; }
    return ff;
  }

  update(time, delta) {
    if (!this.ready) return;
    const ff = this.updateFastForward();
    const rdt = Math.min(delta, 50) / 1000 * ff; const dt = rdt * this.slow;
    if (!this.ended) this.stats.time += rdt;
    const pl = this.player;
    pl.update(dt);
    for (const a of [...this.actors]) { if (a === pl) continue; if (a.alive) a.update(dt); else a.updateCorpse(dt); }
    if (!pl.alive) pl.updateCorpse(dt);
    for (const v of this.vehicles) v.update(dt);
    for (const h of this.helis) if (h.alive) { if (h.updateBoss) h.updateBoss(dt); else h.update(dt); }
    this.combat.update(dt);
    this.fx.update(dt);
    for (const u of this.updaters) u(dt, rdt);
    this.updatePickups(dt);
    // triggers
    if (pl.alive) for (const t of this.triggers) {
      if (t.fired) continue;
      if (pl.x >= t.x && (t.minY === undefined || pl.y >= t.minY) && (t.maxY === undefined || pl.y <= t.maxY) && (!t.when || t.when())) { t.fired = true; t.fn.call(this, t); }
    }
    // checkpoints by position
    for (let i = this.cpIndex + 1; i < this.checkpoints.length; i++) { const c = this.checkpoints[i]; if (c.auto !== false && pl.x >= c.x && pl.alive && !this.ended) this.reachCheckpoint(i); }
    this.tick(dt, rdt);
    this.mixT = (this.mixT || 0) - rdt; if (this.mixT <= 0) { this.mixT = 0.5; this.updateMusicMix(); }
    // clean dead non-actor targets
    if (Math.random() < 0.1) this.targets = this.targets.filter((t) => t.alive || t.ragdoll || t.isPlayer || (t.zone && !t.destroyed));
    // draw actors
    for (const a of this.actors) a.draw();
    this.updateCamera(rdt);
    this.level.updateParallax();
    if (this.lighting) this.lighting.update(rdt);
    AudioEngine.listenerX = this.cameras.main.midPoint.x;
  }

  updateCamera(rdt) {
    const cam = this.cameras.main; const pl = this.player;
    let tx, ty;
    if (this.camOverride) { tx = this.camOverride.x; ty = this.camOverride.y; }
    else {
      const ptr = this.input.activePointer; const w = pl.weapon;
      const ads = pl.ads; const la = (w ? w.lookahead : 200) * (ads ? (w.id === 'sniper' ? 1.6 : 1.25) : 0.75);
      const nx = Phaser.Math.Clamp((ptr.x - GAME_W / 2) / (GAME_W / 2), -1, 1), ny = Phaser.Math.Clamp((ptr.y - GAME_H / 2) / (GAME_H / 2), -1, 1);
      tx = pl.x + nx * la; ty = pl.y - 110 + ny * la * 0.45;
      if (pl.mounted && pl.mounted.kind === 'flak') ty -= 160;
      this.zoomTarget = this.cinematic ? this.zoomTarget : (ads && w && w.id === 'sniper' ? 0.84 : (this.baseZoom || 1));
    }
    const k = Math.min(1, rdt * (this.camOverride ? 2.2 : 8));
    this.camFollow.x += (tx - this.camFollow.x) * k; this.camFollow.y += (ty - this.camFollow.y) * k;
    cam.zoom += (this.zoomTarget - cam.zoom) * Math.min(1, rdt * 3);
  }
}
