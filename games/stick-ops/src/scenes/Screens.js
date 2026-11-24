// Menu screens and overlays: mission select, settings, armory, controls, briefing, pause, fail, results, credits.
import { GAME_W, GAME_H, FONT, COLORS, MISSIONS, UPGRADES, DIFFICULTY } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { Music } from '../core/Music.js';
import { SaveSystem } from '../core/SaveSystem.js';
import { button, title, label, slider, toggle, panel, addCursor } from '../ui/UI.js';
import { menuBackdrop } from './MenuScene.js';

const W = GAME_W, H = GAME_H;

function header(scene, text, sub) {
  title(scene, 80, 70, text, 44).setOrigin(0, 0.5);
  if (sub) label(scene, 82, 108, sub, 16, COLORS.uiDim);
  const g = scene.add.graphics(); g.fillStyle(COLORS.accent, 1); g.fillRect(80, 128, 60, 3);
}

function startMission(scene, id) {
  scene.registry.set('mstats', null);
  scene.registry.set('missionId', id);
  scene.scene.start('Briefing', { missionId: id });
}

export class MissionSelectScene extends Phaser.Scene {
  constructor() { super('MissionSelect'); }
  create() {
    menuBackdrop(this, { squad: false });
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45);
    header(this, 'MISSION SELECT', 'OPERATION BLACKOUT · ACT I & ACT II · ' + MISSIONS.length + ' MISSIONS');
    const save = SaveSystem.data;
    MISSIONS.forEach((m, i) => {
      const row = i < 4 ? 0 : 1; const col = row ? i - 4 : i; const perRow = row ? 3 : 4;
      const cw = 292, ch = 262;
      const x = W / 2 + (col - (perRow - 1) / 2) * (cw + 14), y = 290 + row * (ch + 16);
      const locked = m.id > save.unlocked; const done = save.completed[m.id];
      panel(this, x, y, cw, ch, 0.84);
      label(this, x - cw / 2 + 16, y - ch / 2 + 14, m.code + (m.id >= 4 ? ' · ACT II' : ''), 14, locked ? '#4a565e' : COLORS.goldHex);
      title(this, x - cw / 2 + 16, y - ch / 2 + 54, m.name, 30, locked ? '#4a565e' : '#e8eef2').setOrigin(0, 0.5);
      label(this, x - cw / 2 + 16, y - ch / 2 + 76, m.location, 11, COLORS.uiDim);
      label(this, x - cw / 2 + 16, y - ch / 2 + 98, locked ? 'CLASSIFIED — complete the previous mission to unlock.' : m.summary, 14, locked ? '#4a565e' : COLORS.uiText, { wordWrap: { width: cw - 32 } });
      if (done) label(this, x - cw / 2 + 16, y + ch / 2 - 66, `RANK ${done.rank} · ${done.kills} KILLS`, 13, '#7cff9a');
      button(this, x, y + ch / 2 - 30, locked ? 'LOCKED' : 'DEPLOY', () => startMission(this, m.id), { width: cw - 32, height: 38, size: 18, disabled: locked });
    });    button(this, 180, H - 50, '◀  BACK', () => this.scene.start('Menu'), { width: 200, back: true });
    addCursor(this);
  }
}

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }
  init(d) { this.from = d.from || 'Menu'; }
  create() {
    const overlay = this.from === 'Pause';
    if (!overlay) menuBackdrop(this, { squad: false });
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, overlay ? 0.75 : 0.5);
    header(this, 'SETTINGS', 'AUDIO · GAMEPLAY · DISPLAY');
    const s = SaveSystem.settings; const cx = W / 2, y0 = 200, dy = 52;
    panel(this, cx, 390, 620, 470, 0.85);
    slider(this, cx, y0, 'MASTER VOLUME', s.master, (v) => { SaveSystem.setSetting('master', v); AudioEngine.applyVolumes(); });
    slider(this, cx, y0 + dy, 'MUSIC', s.music, (v) => { SaveSystem.setSetting('music', v); AudioEngine.applyVolumes(); });
    slider(this, cx, y0 + dy * 2, 'SOUND EFFECTS', s.sfx, (v) => { SaveSystem.setSetting('sfx', v); AudioEngine.applyVolumes(); AudioEngine.play('rifle', { gap: 120 }); });
    slider(this, cx, y0 + dy * 3, 'SCREEN SHAKE', s.shake, (v) => SaveSystem.setSetting('shake', v));
    toggle(this, cx, y0 + dy * 4, 'DIFFICULTY', Object.entries(DIFFICULTY).map(([k, d]) => ({ value: k, label: d.label })), s.difficulty, (v) => SaveSystem.setSetting('difficulty', v));
    toggle(this, cx, y0 + dy * 5, 'SUBTITLES', [{ value: true, label: 'ON' }, { value: false, label: 'OFF' }], s.subtitles, (v) => SaveSystem.setSetting('subtitles', v));
    toggle(this, cx, y0 + dy * 6, 'BLOOD EFFECTS', [{ value: true, label: 'ON' }, { value: false, label: 'OFF' }], s.blood, (v) => SaveSystem.setSetting('blood', v));
    toggle(this, cx, y0 + dy * 7, 'SHOW FPS', [{ value: false, label: 'OFF' }, { value: true, label: 'ON' }], s.showFps, (v) => SaveSystem.setSetting('showFps', v));
    toggle(this, cx, y0 + dy * 8, 'FULLSCREEN', [{ value: false, label: 'OFF' }, { value: true, label: 'ON' }], this.scale.isFullscreen, (v) => { try { if (v) this.scale.startFullscreen(); else this.scale.stopFullscreen(); } catch (e) {} });
    label(this, cx, y0 + dy * 9 - 6, 'Difficulty changes apply from the next checkpoint.', 13, COLORS.uiDim).setOrigin(0.5);
    button(this, 180, H - 50, '◀  BACK', () => {
      if (overlay) { this.scene.stop(); this.scene.wake('Pause'); }
      else this.scene.start('Menu');
    }, { width: 200, back: true });
    if (!overlay) button(this, W - 200, H - 50, 'RESET PROGRESS', () => { SaveSystem.resetAll(); this.scene.start('Menu'); }, { width: 260, size: 18 });
    addCursor(this);
  }
}

export class ArmoryScene extends Phaser.Scene {
  constructor() { super('Armory'); }
  create() {
    menuBackdrop(this, { squad: true });
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55);
    header(this, 'ARMORY', 'SPEND INTEL EARNED FROM MISSIONS ON PERMANENT UPGRADES');
    this.pts = label(this, W - 80, 70, '', 26, COLORS.goldHex).setOrigin(1, 0.5);
    this.rows = [];
    UPGRADES.forEach((u, i) => {
      const y = 190 + i * 82;
      panel(this, W / 2, y, 900, 70, 0.8);
      label(this, W / 2 - 430, y - 20, u.name, 22, '#ffffff');
      label(this, W / 2 - 430, y + 6, u.desc, 16, COLORS.uiDim);
      const st = label(this, W / 2 + 120, y, '', 18, COLORS.uiText).setOrigin(0, 0.5);
      const b = button(this, W / 2 + 330, y, 'BUY · ' + u.cost, () => { if (SaveSystem.buyUpgrade(u)) { AudioEngine.play('objective'); this.refresh(); } else AudioEngine.play('dry'); }, { width: 200, size: 18 });
      this.rows.push({ u, st, b });
    });
    this.refresh();
    label(this, W / 2, H - 100, 'Earn intel by completing missions (+2 first clear, +1 for A rank, +2 for S rank).', 15, COLORS.uiDim).setOrigin(0.5);
    button(this, 180, H - 50, '◀  BACK', () => this.scene.start('Menu'), { width: 200, back: true });
    addCursor(this);
  }
  refresh() {
    this.pts.setText(SaveSystem.data.points + ' INTEL');
    for (const r of this.rows) { const lvl = SaveSystem.upgrade(r.u.id); r.st.setText(lvl >= r.u.max ? 'MAXED' : `LEVEL ${lvl} / ${r.u.max}`).setColor(lvl >= r.u.max ? '#7cff9a' : COLORS.uiText); }
  }
}

export class ControlsScene extends Phaser.Scene {
  constructor() { super('Controls'); }
  create() {
    menuBackdrop(this, { squad: false });
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6);
    header(this, 'CONTROLS', 'KEYBOARD & MOUSE');
    const rows = [
      ['A / D', 'Move'], ['W / SPACE', 'Jump'], ['S', 'Crouch (hold) · S + Jump drops through catwalks'], ['MOUSE', 'Aim'], ['LEFT CLICK', 'Fire'],
      ['RIGHT CLICK', 'Aim down sights (steadier, longer view)'], ['SHIFT', 'Hold breath while aiming'], ['R', 'Reload'], ['1 – 4 / WHEEL', 'Rifle · Pistol · Shotgun · Sniper'], ['5', 'Launcher (when picked up)'],
      ['Q', 'Quick-swap last weapon'], ['G', 'Throw frag grenade'], ['F', 'Melee / silent takedown on unaware enemies'], ['E', 'Interact (hold for hacking & charges)'], ['ESC / P', 'Pause'],
    ];
    panel(this, W / 2, 410, 860, 520, 0.85);
    rows.forEach(([k, v], i) => {
      const y = 180 + i * 33;
      label(this, W / 2 - 390, y, k, 19, COLORS.accentHex);
      label(this, W / 2 - 150, y, v, 19, COLORS.uiText);
    });
    button(this, 180, H - 50, '◀  BACK', () => this.scene.start('Menu'), { width: 200, back: true });
    addCursor(this);
  }
}

export class BriefingScene extends Phaser.Scene {
  constructor() { super('Briefing'); }
  init(d) { this.mission = MISSIONS[(d.missionId || 1) - 1]; }
  create() {
    const m = this.mission;
    this.registry.set('mstats', null);
    this.registry.set('missionId', m.id);
    SaveSystem.setCheckpoint({ mission: m.id, stage: 0, cp: 0 });
    Music.play('briefing');
    this.cameras.main.setBackgroundColor('#04070a');
    this.cameras.main.fadeIn(700, 0, 0, 0);
    // tactical map
    const g = this.add.graphics();
    g.lineStyle(1, 0x123040, 0.7);
    for (let x = 0; x < W; x += 40) g.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 40) g.lineBetween(0, y, W, y);
    g.lineStyle(1.5, 0x1d5a6e, 0.6);
    for (let k = 0; k < 9; k++) { g.beginPath(); for (let x = 640; x <= W; x += 10) { const y = 360 + Math.sin(x / 90 + k) * 30 + (k - 4) * 34 + Math.sin(x / 33 + k * 2) * 8; if (x === 640) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath(); }
    const marks = [[760, 250], [930, 410], [1110, 300]];
    marks.forEach(([x, y], i) => {
      const r = this.add.circle(x, y, 10, COLORS.danger, 0.8); this.tweens.add({ targets: r, scale: 2.2, alpha: 0, duration: 1400, repeat: -1, delay: i * 400 });
      this.add.circle(x, y, 5, COLORS.danger);
      label(this, x + 14, y - 8, ['ENTRY', 'OBJ', 'EXFIL'][i], 13, COLORS.dangerHex);
    });
    g.lineStyle(2, COLORS.accent, 0.8); g.beginPath(); g.moveTo(700, 560); marks.forEach(([x, y]) => g.lineTo(x, y)); g.strokePath();
    const scan = this.add.rectangle(960, 0, 640, 4, COLORS.accent, 0.25); this.tweens.add({ targets: scan, y: H, duration: 3000, repeat: -1 });
    // text
    label(this, 80, 70, m.code + ' · BRIEFING', 18, COLORS.goldHex);
    title(this, 80, 130, m.name, 72).setOrigin(0, 0.5);
    label(this, 82, 180, m.location, 16, COLORS.uiDim);
    const lines = m.briefing; let y = 240;
    const typed = [];
    lines.forEach((ln) => { const t = label(this, 82, y, ln, 21, COLORS.uiText, { wordWrap: { width: 520 } }); y += t.height + 12; t.setText(''); typed.push([t, ln]); });
    let li = 0, ci = 0;
    this.time.addEvent({ delay: 22, loop: true, callback: () => {
      if (li >= typed.length) return;
      const [t, ln] = typed[li]; ci++; t.setText(ln.slice(0, ci));
      if (ci % 3 === 0) AudioEngine.play('hack', { gap: 30 });
      if (ci >= ln.length) { li++; ci = 0; }
    } });
    label(this, 82, y + 14, 'OPERATOR: "GHOST" · SQUAD: ECHO-6 · SUPPORT: OVERLORD', 14, COLORS.uiDim);
    button(this, 260, H - 110, 'DEPLOY', () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(620, () => this.scene.start(m.stages[0], { cp: 0 }));
    }, { width: 360, size: 26 });
    button(this, 180, H - 50, '◀  BACK', () => this.scene.start('Menu'), { width: 200, back: true });
    addCursor(this);
  }
}

export class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }
  init(d) { this.from = d.from; }
  create() {
    AudioEngine.setMuffled(true);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);
    title(this, W / 2, 170, 'PAUSED', 64);
    const mission = this.scene.get(this.from);
    if (mission && mission.objective) label(this, W / 2, 230, 'OBJECTIVE: ' + mission.objective.text, 18, COLORS.goldHex).setOrigin(0.5);
    const resume = () => { AudioEngine.setMuffled(false); this.scene.stop(); this.scene.resume(this.from); this.scene.resume('HUD'); };
    button(this, W / 2, 310, 'RESUME', resume);
    button(this, W / 2, 366, 'RESTART CHECKPOINT', () => {
      AudioEngine.setMuffled(false); const ms = this.scene.get(this.from);
      if (ms && ms.statsAtStart) { const st = Object.assign({}, ms.statsAtStart, { time: ms.stats.time, deaths: ms.stats.deaths }); this.registry.set('mstats', st); }
      this.scene.stop(); this.scene.stop('HUD'); this.scene.get(this.from).scene.restart({ cp: ms ? ms.cpIndex || 0 : 0 });
    });
    button(this, W / 2, 422, 'SETTINGS', () => { this.scene.sleep(); this.scene.launch('Settings', { from: 'Pause' }); this.scene.bringToTop('Settings'); });
    button(this, W / 2, 478, 'QUIT TO MENU', () => { AudioEngine.setMuffled(false); this.scene.stop('HUD'); this.scene.stop(this.from); this.scene.start('Menu'); }, { back: true });
    this.input.keyboard.once('keydown-ESC', resume);
    addCursor(this);
  }
}

export class FailScene extends Phaser.Scene {
  constructor() { super('Fail'); }
  init(d) { this.from = d.from; this.cp = d.cp || 0; this.reason = d.reason; }
  create() {
    AudioEngine.setMuffled(true);
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x200404, 0); this.tweens.add({ targets: bg, fillAlpha: 0.72, duration: 600 });
    const t = title(this, W / 2, 230, 'MISSION FAILED', 72, COLORS.dangerHex).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 500 });
    label(this, W / 2, 300, this.reason || 'K.I.A.', 22, COLORS.uiText).setOrigin(0.5);
    const tips = ['Crouch behind sandbags and crates — enemy fire hits cover first.', 'Health regenerates when you avoid damage for a few seconds.', 'Snipers show a laser before they fire. Break line of sight!', 'Headshots deal massive damage. Aim high.', 'Grenades (G) flush enemies out of cover.', 'Explosive barrels make excellent traps.', 'Use F for silent takedowns on unaware guards.'];
    label(this, W / 2, 340, 'TIP: ' + tips[Math.floor(Math.random() * tips.length)], 16, COLORS.uiDim).setOrigin(0.5);
    button(this, W / 2, 420, 'RETRY FROM CHECKPOINT', () => {
      AudioEngine.setMuffled(false); const ms = this.scene.get(this.from);
      if (ms && ms.statsAtStart) { const st = Object.assign({}, ms.statsAtStart, { time: ms.stats.time, deaths: ms.stats.deaths }); this.registry.set('mstats', st); }
      this.scene.stop('HUD'); this.scene.stop(); ms.scene.restart({ cp: this.cp });
    });
    button(this, W / 2, 476, 'QUIT TO MENU', () => { AudioEngine.setMuffled(false); this.scene.stop('HUD'); this.scene.stop(this.from); this.scene.start('Menu'); }, { back: true });
    addCursor(this);
  }
}

export function rankFor(stats) {
  const acc = stats.shots ? stats.hits / stats.shots : 0;
  const score = stats.kills * 100 + stats.headshots * 60 + Math.round(acc * 2500) - stats.deaths * 600 - Math.round(stats.time * 1.5);
  const rank = score > 4200 ? 'S' : score > 2800 ? 'A' : score > 1500 ? 'B' : 'C';
  return { acc, score: Math.max(0, score), rank };
}

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }
  init(d) { this.missionId = d.missionId; this.stats = d.stats || { kills: 0, shots: 0, hits: 0, headshots: 0, time: 0, deaths: 0 }; }
  create() {
    const m = MISSIONS[this.missionId - 1];
    Music.play('victory');
    menuBackdrop(this, { theme: m.id === 2 ? 'dawn' : m.id === 3 ? 'dusk' : 'night' });
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55);
    this.cameras.main.fadeIn(800, 0, 0, 0);
    const st = this.stats; const { acc, score, rank } = rankFor(st);
    const earned = SaveSystem.completeMission(m.id, { kills: st.kills, accuracy: acc, time: st.time, rank, score });
    label(this, W / 2, 90, m.code, 18, COLORS.goldHex).setOrigin(0.5);
    title(this, W / 2, 150, m.name + ' — COMPLETE', 54);
    panel(this, W / 2, 380, 620, 330, 0.85);
    const mm = Math.floor(st.time / 60), ss = Math.floor(st.time % 60);
    const rows = [['MISSION TIME', `${mm}:${String(ss).padStart(2, '0')}`], ['HOSTILES ELIMINATED', st.kills], ['HEADSHOTS', st.headshots], ['ACCURACY', Math.round(acc * 100) + '%'], ['DEATHS', st.deaths], ['SCORE', score], ['INTEL EARNED', '+' + earned]];
    rows.forEach(([k, v], i) => {
      const y = 250 + i * 38;
      const a = label(this, W / 2 - 270, y, k, 20, COLORS.uiDim).setAlpha(0);
      const b = label(this, W / 2 + 120, y, String(v), 22, '#ffffff').setOrigin(1, 0).setAlpha(0);
      this.tweens.add({ targets: [a, b], alpha: 1, delay: 300 + i * 160, duration: 250, onStart: () => AudioEngine.play('ui') });
    });
    const r = title(this, W / 2 + 210, 360, rank, 140, rank === 'S' ? COLORS.goldHex : rank === 'A' ? '#7cff9a' : '#ffffff').setAlpha(0).setScale(2);
    label(this, W / 2 + 210, 450, 'RANK', 16, COLORS.uiDim).setOrigin(0.5);
    this.tweens.add({ targets: r, alpha: 1, scale: 1, delay: 1600, duration: 400, ease: 'Back.easeOut', onStart: () => AudioEngine.play('explosion', { vol: 0.5 }) });
    if (m.id < MISSIONS.length) button(this, W / 2 + 170, H - 80, 'NEXT MISSION  ▶', () => startMission(this, m.id + 1), { width: 300 });
    else button(this, W / 2 + 170, H - 80, 'EPILOGUE  ▶', () => this.scene.start('Credits'), { width: 300 });
    button(this, W / 2 - 170, H - 80, 'MAIN MENU', () => this.scene.start('Menu'), { width: 300, back: true });
    addCursor(this);
  }
}

export class CreditsScene extends Phaser.Scene {
  constructor() { super('Credits'); }
  create() {
    Music.play('victory');
    menuBackdrop(this, { theme: 'dawn' });
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5);
    const lines = [
      ['title', 'CAMPAIGN COMPLETE'], ['', ''],
      ['', 'BLACK SUN never launched. Colonel Drago died in the silo she built.'], ['', 'The BLACKOUT network, Varkov\'s war and Drago\'s gamble all ended in the same week.'], ['', ''],
      ['', 'Sgt. Elias "Rook" Hayes was buried with honours. Ghost carried his dog tags home to Anna.'], ['', 'SPARROW\'s name was finally made public: Mikhail Orlov. He gave the codes that saved a city.'], ['', ''],
      ['', '"Echo-6, this is Overlord. Stand down. You\'re going home."'], ['', ''], ['', ''],
      ['title', 'STICK OPS: BLACKOUT'], ['', ''], ['h', 'DESIGN · CODE · ANIMATION'], ['', 'Built with Phaser 3, Arcade Physics & Web Audio'], ['', ''],
      ['h', 'ART'], ['', 'Characters, vehicles and skylines painted procedurally at runtime'], ['', ''],
      ['h', 'MUSIC & SOUND'], ['', 'Score synthesised live in your browser'], ['', 'Sound effects: Snake’s Authentic Gun Sounds · Sonniss GDC 2024 Bundle'], ['', '400 Sounds Pack · 96 Extra SFX · freesound community'], ['', ''],
      ['h', 'VISUAL EFFECTS & TEXTURES'], ['', 'Brackeys VFX Bundle (CodeManu, Kenney, Picster) · SBS Texture Packs'], ['', 'Pixel Military Vehicles 2.0 by de-alpe-game-art'], ['', ''], ['h', 'THANK YOU FOR PLAYING'], ['', ''], ['', ''],
    ];
    const c = this.add.container(0, H + 40);
    let y = 0;
    for (const [k, s] of lines) {
      const t = k === 'title' ? title(this, W / 2, y, s, 48) : label(this, W / 2, y, s, k === 'h' ? 18 : 22, k === 'h' ? COLORS.goldHex : COLORS.uiText).setOrigin(0.5);
      c.add(t); y += k === 'title' ? 70 : 40;
    }
    this.tweens.add({ targets: c, y: -y + 200, duration: (y + H) * 22, ease: 'Linear', onComplete: () => this.scene.start('Menu') });
    button(this, W - 170, H - 50, 'MAIN MENU', () => this.scene.start('Menu'), { width: 260, back: true });
    addCursor(this);
  }
}
