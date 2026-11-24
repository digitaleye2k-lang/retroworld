// In-game HUD overlay. Reads state from the active mission scene each frame.
import { GAME_W, GAME_H, FONT, COLORS, WEAPONS } from '../config.js';
import { SaveSystem } from '../core/SaveSystem.js';

const W = GAME_W, H = GAME_H;

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  init(data) { this.mission = data.mission; }

  create() {
    this.ff = 1; this.cineHint = null; this.time.timeScale = 1; this.tweens.timeScale = 1;
    const txt = (x, y, s, size, color = COLORS.uiText, font = FONT.ui, weight = '700') => this.add.text(x, y, s, { fontFamily: font, fontSize: size + 'px', color, fontStyle: weight }).setShadow(0, 2, '#000', 4, true, true);
    this.g = this.add.graphics();
    this.vig = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.75);
    this.dmgVig = this.add.image(W / 2, H / 2, 'dmgvig').setDisplaySize(W, H).setAlpha(0);
    this.slowOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x4070a0, 0).setBlendMode('MULTIPLY');
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0);
    this.scopeImg = this.add.image(W / 2, H / 2, 'scope').setVisible(false);
    this.scopeL = this.add.rectangle(0, 0, (W - 1024) / 2 + 2, H, 0x000000).setOrigin(0).setVisible(false);
    this.scopeR = this.add.rectangle(W, 0, (W - 1024) / 2 + 2, H, 0x000000).setOrigin(1, 0).setVisible(false);
    this.dirG = this.add.graphics();
    // letterbox
    this.lbTop = this.add.rectangle(W / 2, -50, W, 100, 0x000000).setOrigin(0.5, 0.5);
    this.lbBot = this.add.rectangle(W / 2, H + 50, W, 100, 0x000000).setOrigin(0.5, 0.5);
    this.lb = 0; this.lbTarget = 0;

    // objective
    this.objLabel = txt(28, 22, 'OBJECTIVE', 14, COLORS.goldHex);
    this.objText = txt(28, 40, '', 22);
    this.objText.setWordWrapWidth(330);
    this.markerG = this.add.graphics();
    this.markerTxt = txt(0, 0, '', 14, COLORS.goldHex).setOrigin(0.5, 0);

    // health
    this.hpLabel = txt(28, H - 74, 'VITALS', 13, COLORS.uiDim);
    this.gLabel = txt(250, H - 74, '', 15, COLORS.uiText);
    // ammo
    this.wName = txt(W - 28, H - 106, '', 16, COLORS.uiDim).setOrigin(1, 0);
    this.ammoMag = txt(W - 150, H - 84, '', 46, '#ffffff', FONT.title, 'normal').setOrigin(1, 0);
    this.ammoRes = txt(W - 28, H - 66, '', 24, COLORS.uiDim).setOrigin(1, 0);
    this.slotTexts = [];
    for (let i = 0; i < 5; i++) this.slotTexts.push(txt(0, 0, '', 12, COLORS.uiDim).setOrigin(0.5));
    // notifications
    this.notes = [];
    // subtitles
    this.subBg = this.add.rectangle(W / 2, H - 150, 760, 64, 0x000000, 0.55).setVisible(false);
    this.subName = txt(W / 2, H - 172, '', 16, COLORS.accentHex).setOrigin(0.5, 0);
    this.subText = txt(W / 2, H - 152, '', 21, '#ffffff').setOrigin(0.5, 0).setAlign('center');
    this.subText.setWordWrapWidth(640);
    this.subT = 0;
    // interact
    this.intTxt = txt(0, 0, '', 18, '#ffffff').setOrigin(0.5);
    // boss
    this.bossName = txt(W / 2, 22, '', 18, COLORS.dangerHex, FONT.title, 'normal').setOrigin(0.5, 0);
    this.boss = null;
    // detection
    this.detTxt = txt(W / 2, 92, '', 14, COLORS.goldHex).setOrigin(0.5);
    this.centerTxt = txt(W / 2, H * 0.36, '', 40, '#ffffff', FONT.title, 'normal').setOrigin(0.5).setAlpha(0);
    this.fps = txt(W - 10, 6, '', 12, COLORS.uiDim).setOrigin(1, 0);
    this.hit = 0; this.hitKill = false; this.hitHead = false;
    this.damageDirs = [];
    this.lastHp = 100;
    this.time.addEvent({ delay: 16, loop: true, callback: () => {} });
  }

  // ---------- API used by missions ----------
  notify(text, color = '#ffffff') {
    const t = this.add.text(W / 2, 128, text, { fontFamily: FONT.ui, fontSize: '22px', fontStyle: '700', color }).setOrigin(0.5).setShadow(0, 2, '#000', 6, true, true).setAlpha(0);
    this.notes.push(t);
    this.tweens.add({ targets: t, alpha: 1, duration: 150 });
    this.time.delayedCall(2200, () => this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => { t.destroy(); this.notes.splice(this.notes.indexOf(t), 1); } }));
  }
  bigText(text, color = '#ffffff', ms = 2500) {
    this.centerTxt.setText(text).setColor(color).setAlpha(0).setScale(1.3);
    this.tweens.add({ targets: this.centerTxt, alpha: 1, scale: 1, duration: 350, ease: 'Back.easeOut' });
    this.time.delayedCall(ms, () => this.tweens.add({ targets: this.centerTxt, alpha: 0, duration: 500 }));
  }
  subtitle(name, text, ms = 3000) {
    if (SaveSystem.settings.subtitles === false) return;
    this.subName.setText(name ? name.toUpperCase() : ''); this.subText.setText(text);
    const h = this.subText.height + 34; const top = H - 22 - h;
    this.subBg.setSize(Math.max(420, Math.min(700, this.subText.width + 60)), h).setY(top + h / 2).setVisible(true);
    this.subName.setY(top + 5); this.subText.setY(top + 25);
    this.subT = ms / 1000;
  }
  setObjective(text, target) {
    this.objText.setText(text); this.objTarget = target;
    this.objText.setAlpha(0); this.tweens.add({ targets: this.objText, alpha: 1, duration: 400 });
    this.objFlash = 1.5;
  }
  // full-screen chapter card: fades to black, shows a title + subtitle, fades back
  chapterCard(title, sub, ms = 3200) {
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(500);
    const t = this.add.text(W / 2, H / 2 - 18, title, { fontFamily: FONT.title, fontSize: '40px', color: '#e8eef2' }).setOrigin(0.5).setAlpha(0).setDepth(501);
    const s2 = this.add.text(W / 2, H / 2 + 30, sub || '', { fontFamily: FONT.ui, fontSize: '18px', fontStyle: '700', color: COLORS.goldHex }).setOrigin(0.5).setAlpha(0).setDepth(501);
    this.tweens.add({ targets: bg, fillAlpha: 1, duration: 500 });
    this.tweens.add({ targets: [t, s2], alpha: 1, duration: 700, delay: 400 });
    this.time.delayedCall(ms - 700, () => this.tweens.add({ targets: [bg, t, s2], alpha: 0, duration: 700, onComplete: () => { bg.destroy(); t.destroy(); s2.destroy(); } }));
  }
  // slow fade to/from black for emotional beats
  fade(toBlack, ms = 900) {
    if (!this.fadeRect) this.fadeRect = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(490);
    this.tweens.add({ targets: this.fadeRect, fillAlpha: toBlack ? 1 : 0, duration: ms });
  }
  hitMarker(kill, head) { this.hit = 1; this.hitKill = kill; this.hitHead = head; }
  damage(info) {
    const m = this.mission; const p = m.player;
    if (info && info.x !== undefined && p) {
      const a = Math.atan2(info.y - (p.y - 50), info.x - p.x) + Math.PI;
      const src = info.angle !== undefined && !info.explosive ? info.angle + Math.PI : a;
      this.damageDirs.push({ a: src, t: 1 });
    }
    this.dmgPulse = 1;
  }
  flashScreen(color, alpha, ms) { this.flash.setFillStyle(color, alpha); this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: ms }); }
  letterbox(on) { this.lbTarget = on ? 1 : 0; }
  setSlowmo(on) { this.tweens.add({ targets: this.slowOverlay, fillAlpha: on ? 0.35 : 0, duration: 250 }); }
  setBoss(entity, name) { this.boss = entity; this.bossName.setText(name || ''); this.bossShown = 0; }
  showScope(on) { this.scopeImg.setVisible(on); }

  setCineHint(on, ff) {
    if (!this.cineHint) this.cineHint = this.add.text(W - 24, 22, '', { fontFamily: FONT.ui, fontSize: '15px', fontStyle: '700', color: '#c9d3da' }).setOrigin(1, 0).setDepth(600).setAlpha(0.8);
    this.cineHint.setVisible(!!on).setText(ff ? '▶▶ FAST-FORWARD ×4' : 'HOLD ENTER / SPACE TO FAST-FORWARD');
    this.cineHint.setColor(ff ? '#ffd36b' : '#c9d3da');
  }
  update(time, delta) {
    const dt = delta / 1000 * (this.ff || 1); const m = this.mission; if (!m || !m.sys || !m.sys.settings) return;
    const g = this.g; g.clear();
    const mode = m.hudMode || 'ground';
    const p = m.player;
    // letterbox
    this.lb += (this.lbTarget - this.lb) * Math.min(1, dt * 4);
    this.lbTop.y = -50 + this.lb * 100 - 15 * this.lb; this.lbBot.y = H + 50 - this.lb * 100 + 15 * this.lb;
    const hudAlpha = 1 - this.lb;
    for (const o of [this.objLabel, this.objText, this.hpLabel, this.gLabel, this.wName, this.ammoMag, this.ammoRes, ...this.slotTexts, this.markerTxt]) o.setAlpha(Math.min(o.alpha === undefined ? 1 : 1, hudAlpha));
    this.objText.setAlpha(hudAlpha); this.objLabel.setAlpha(hudAlpha * (this.objText.text ? 1 : 0));

    if (mode === 'ground' && p) this.drawGround(g, p, m, dt, hudAlpha);
    else if (mode === 'heli') this.drawHeli(g, m, dt, hudAlpha);
    else if (mode === 'sniper') this.drawSniper(g, m, dt, hudAlpha);

    // objective marker
    this.drawMarker(m, hudAlpha);

    // subtitles
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) { this.subBg.setVisible(false); this.subName.setText(''); this.subText.setText(''); } }

    // boss bar
    if (this.boss && (this.boss.alive || this.boss.hp > 0)) {
      this.bossShown = Math.min(1, (this.bossShown || 0) + dt * 2);
      const frac = Math.max(0, this.boss.hp / this.boss.maxHp); const bw = 520 * this.bossShown;
      this.bossName.setAlpha(this.bossShown);
      g.fillStyle(0x000000, 0.6); g.fillRect(W / 2 - bw / 2 - 3, 48, bw + 6, 16);
      g.fillStyle(0x5a1010, 1); g.fillRect(W / 2 - bw / 2, 51, bw, 10);
      g.fillStyle(0xff3a2a, 1); g.fillRect(W / 2 - bw / 2, 51, bw * frac, 10);
      g.fillStyle(0xffffff, 0.25); g.fillRect(W / 2 - bw / 2, 51, bw * frac, 3);
      for (const t of [0.33, 0.66]) { g.fillStyle(0x000000, 0.8); g.fillRect(W / 2 - bw / 2 + bw * t - 1, 49, 2, 14); }
    } else { this.bossName.setAlpha(0); if (this.boss && !this.boss.alive) this.boss = null; }

    // notifications stacking
    this.notes.forEach((n, i) => { n.y += ((128 + i * 30) - n.y) * Math.min(1, dt * 10); });

    // damage directions
    this.dirG.clear();
    for (let i = this.damageDirs.length - 1; i >= 0; i--) {
      const d = this.damageDirs[i]; d.t -= dt * 0.9; if (d.t <= 0) { this.damageDirs.splice(i, 1); continue; }
      this.dirG.lineStyle(8, 0xff2a1a, d.t * 0.8);
      this.dirG.beginPath(); this.dirG.arc(W / 2, H / 2, 150, d.a - 0.25, d.a + 0.25); this.dirG.strokePath();
    }
    this.dmgPulse = Math.max(0, (this.dmgPulse || 0) - dt * 2);
    if (SaveSystem.settings.showFps) this.fps.setText(Math.round(this.game.loop.actualFps) + ' FPS'); else this.fps.setText('');
  }

  drawGround(g, p, m, dt, ha) {
    const hpF = Math.max(0, p.hp / p.maxHp);
    this.dmgVig.setAlpha(Math.min(1, (1 - hpF) * 0.9 + this.dmgPulse * 0.4));
    // health segments
    const x0 = 28, y0 = H - 54; const segs = 10, sw = 19;
    g.fillStyle(0x000000, 0.45 * ha); g.fillRect(x0 - 6, y0 - 8, segs * (sw + 3) + 10, 30);
    for (let i = 0; i < segs; i++) {
      const fill = Math.max(0, Math.min(1, hpF * segs - i));
      g.fillStyle(0x2a3238, ha); g.fillRect(x0 + i * (sw + 3), y0, sw, 14);
      const col = hpF < 0.3 ? (Math.floor(this.time.now / 250) % 2 ? 0xff3a2a : 0xaa2010) : 0xd9e4ea;
      g.fillStyle(col, ha); g.fillRect(x0 + i * (sw + 3), y0, sw * fill, 14);
    }
    this.gLabel.setText('◆ ' + p.grenades + '  FRAG').setX(x0 + segs * (sw + 3) + 16);
    // weapon & ammo
    const w = p.weapon; const a = p.ammo[p.current];
    if (p.mounted) {
      const mg = p.mounted;
      this.wName.setText(mg.kind === 'flak' ? 'AA FLAK CANNON' : 'MOUNTED HMG'); this.ammoMag.setText(Math.round(mg.heat * 100) + '%'); this.ammoRes.setText(mg.overheated ? 'OVERHEAT' : '');
      g.fillStyle(0x000000, 0.5); g.fillRect(W - 230, H - 30, 202, 10);
      g.fillStyle(mg.overheated ? 0xff3a2a : mg.heat > 0.7 ? 0xffa030 : 0x5ee0ff, 1); g.fillRect(W - 229, H - 29, 200 * mg.heat, 8);
    } else {
      this.wName.setText(w.name); this.ammoMag.setText(String(a.mag)); this.ammoRes.setText('/ ' + a.reserve);
      this.ammoMag.setColor(a.mag <= Math.ceil(a.max * 0.25) ? COLORS.dangerHex : '#ffffff');
      // bullets row
      const n = Math.min(a.max, 30); const bw = Math.max(2, Math.min(6, 180 / n - 2));
      for (let i = 0; i < n; i++) {
        const filled = i < Math.ceil(a.mag * n / a.max);
        g.fillStyle(filled ? 0xffc34d : 0x3a3a3a, ha * (filled ? 1 : 0.6));
        g.fillRect(W - 28 - (i + 1) * (bw + 2), H - 28, bw, 12);
      }
      if (p.reloading) {
        g.fillStyle(0x000000, 0.6); g.fillRect(W / 2 - 60, H / 2 + 40, 120, 6);
        g.fillStyle(0x5ee0ff, 1); g.fillRect(W / 2 - 60, H / 2 + 40, 120 * p.reload, 6);
      }
    }
    // slots
    const slots = p.loadout.slice().sort((a1, b1) => WEAPONS[a1].slot - WEAPONS[b1].slot);
    for (let i = 0; i < 5; i++) {
      const id = slots[i]; const t = this.slotTexts[i];
      if (!id) { t.setText(''); continue; }
      const sx = W - 28 - (slots.length - i) * 58 + 29, sy = H - 128;
      const active = id === p.current;
      g.fillStyle(active ? 0x5ee0ff : 0x000000, active ? 0.25 * ha : 0.4 * ha); g.fillRect(sx - 27, sy - 11, 54, 22);
      g.lineStyle(1, active ? 0x5ee0ff : 0x3a4650, ha); g.strokeRect(sx - 27, sy - 11, 54, 22);
      t.setText(WEAPONS[id].slot + ' ' + id.toUpperCase().slice(0, 5)).setPosition(sx, sy).setColor(active ? '#ffffff' : COLORS.uiDim);
    }
    // interact prompt
    const it = p.interactTarget;
    if (it && it.enabled && !m.cinematic && !p.mounted) {
      const sp = this.toScreen(it.x, it.y - 70);
      this.intTxt.setText('[E] ' + it.label).setPosition(sp.x, sp.y).setVisible(true);
      if (it.hold) {
        const f = Math.min(1, p.interactT / it.hold);
        g.lineStyle(4, 0x000000, 0.5); g.beginPath(); g.arc(sp.x, sp.y + 30, 14, 0, Math.PI * 2); g.strokePath();
        g.lineStyle(4, 0x5ee0ff, 1); g.beginPath(); g.arc(sp.x, sp.y + 30, 14, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.strokePath();
      }
    } else this.intTxt.setVisible(false);
    // detection meter (stealth)
    let maxAw = 0, anyCombat = false;
    for (const e of m.enemies) { if (!e.alive || e.isVehicle) continue; if (e.state === 'combat') anyCombat = true; else maxAw = Math.max(maxAw, e.awareness || 0); }
    if (m.stealthHud && !anyCombat && maxAw > 0.05) {
      g.fillStyle(0x000000, 0.5); g.fillRect(W / 2 - 80, 104, 160, 6);
      g.fillStyle(maxAw > 0.6 ? 0xff4a3a : 0xffc34d, 1); g.fillRect(W / 2 - 80, 104, 160 * Math.min(1, maxAw), 6);
      this.detTxt.setText(maxAw > 0.6 ? 'BEING DETECTED' : 'SUSPICIOUS');
    } else this.detTxt.setText(m.hudTimerText || (m.stealthHud && anyCombat && !m.alarmOff ? 'COMPROMISED' : ''));
    // crosshair
    if (!m.cinematic && p.alive) this.drawCrosshair(g, p);
    // breath for sniper ADS
    if (p.ads && p.current === 'sniper') {
      g.fillStyle(0x000000, 0.5); g.fillRect(W / 2 - 50, H / 2 + 56, 100, 4); g.fillStyle(0x9fe0ff, 1); g.fillRect(W / 2 - 50, H / 2 + 56, p.breath, 4);
    }
  }

  drawCrosshair(g, p) {
    const ptr = this.input.activePointer; const x = ptr.x, y = ptr.y;
    const gap = 6 + p.spreadNow * 380; const len = 9;
    const col = p.ads ? 0x9fe0ff : 0xffffff;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      g.lineStyle(4, 0x000000, 0.5); g.lineBetween(x + dx * gap, y + dy * gap, x + dx * (gap + len), y + dy * (gap + len));
      g.lineStyle(2, col, 0.95); g.lineBetween(x + dx * gap, y + dy * gap, x + dx * (gap + len), y + dy * (gap + len));
    }
    g.fillStyle(col, 1); g.fillCircle(x, y, 1.5);
    if (this.hit > 0) {
      this.hit -= 0.06;
      const c = this.hitKill ? 0xff3a2a : 0xffffff; const s = 8 + (1 - this.hit) * 4;
      g.lineStyle(this.hitHead ? 3 : 2, c, this.hit);
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.lineBetween(x + dx * 5, y + dy * 5, x + dx * s, y + dy * s);
    }
  }

  drawHeli(g, m, dt, ha) {
    const s = m.heliState; if (!s) return;
    this.dmgVig.setAlpha(Math.min(1, (1 - s.hull / s.maxHull) * 0.7 + this.dmgPulse * 0.4));
    this.hpLabel.setText(s.hullLabel || 'HULL INTEGRITY');
    const x0 = 28, y0 = H - 54;
    g.fillStyle(0x000000, 0.5); g.fillRect(x0 - 4, y0 - 4, 268, 22);
    g.fillStyle(s.hull / s.maxHull < 0.3 ? 0xff3a2a : 0xd9e4ea, 1); g.fillRect(x0, y0, 260 * Math.max(0, s.hull / s.maxHull), 14);
    this.wName.setText(s.weaponName || 'M134 DOOR GUN'); this.ammoMag.setText(s.ammoText !== undefined ? s.ammoText : Math.round(s.heat * 100) + '%'); this.ammoRes.setText(s.overheated ? 'OVERHEAT' : (s.subText || 'HEAT'));
    this.gLabel.setText(s.secondary || '').setX(320);
    g.fillStyle(0x000000, 0.5); g.fillRect(W - 230, H - 30, 202, 12);
    g.fillStyle(s.overheated ? 0xff3a2a : s.heat > 0.7 ? 0xffa030 : 0x5ee0ff, 1); g.fillRect(W - 229, H - 29, 200 * s.heat, 10);
    if (s.distance !== undefined) { g.fillStyle(0x000000, 0.5); g.fillRect(W / 2 - 200, 80, 400, 6); g.fillStyle(0x5ee0ff, 1); g.fillRect(W / 2 - 200, 80, 400 * s.distance, 6); }
    for (const t of this.slotTexts) t.setText('');
    this.intTxt.setVisible(false); this.detTxt.setText('');
    if (!m.cinematic) {
      const ptr = this.input.activePointer; const spr = 14 + s.heat * 10;
      g.lineStyle(2, 0xffffff, 0.9); g.strokeCircle(ptr.x, ptr.y, spr); g.fillStyle(0xffffff, 1); g.fillCircle(ptr.x, ptr.y, 2);
      if (this.hit > 0) { this.hit -= 0.08; g.lineStyle(2, this.hitKill ? 0xff3a2a : 0xffffff, this.hit); for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.lineBetween(ptr.x + dx * 6, ptr.y + dy * 6, ptr.x + dx * 12, ptr.y + dy * 12); }
    }
  }

  drawSniper(g, m, dt, ha) {
    const s = m.sniperState; if (!s) return;
    this.dmgVig.setAlpha(this.dmgPulse * 0.5 + (s.hp !== undefined ? (1 - s.hp / 100) * 0.6 : 0));
    this.hpLabel.setText(s.hp !== undefined ? 'VITALS' : '');
    if (s.hp !== undefined) { g.fillStyle(0x000000, 0.5); g.fillRect(24, H - 58, 228, 22); g.fillStyle(0xd9e4ea, 1); g.fillRect(28, H - 54, 220 * Math.max(0, s.hp / 100), 14); }
    this.gLabel.setText('');
    this.wName.setText('LONGBOW .50 — SUPPRESSED'); this.ammoMag.setText(String(s.mag)); this.ammoRes.setText('/ ' + s.reserve);
    for (const t of this.slotTexts) t.setText('');
    this.intTxt.setVisible(false); this.detTxt.setText(s.alarm ? 'ALARM: ' + Math.ceil(s.alarm) + 's' : '');
    const sc = !!s.scoped && !m.cinematic; this.scopeImg.setVisible(sc); this.scopeL.setVisible(sc); this.scopeR.setVisible(sc);
    if (s.scoped) {
      g.fillStyle(0x000000, 0.6); g.fillRect(W / 2 - 60, H - 120, 120, 6); g.fillStyle(0x9fe0ff, 1); g.fillRect(W / 2 - 60, H - 120, 120 * s.breath / 100, 6);
      this.markerTxt.setText('');
    } else if (!m.cinematic) {
      const ptr = this.input.activePointer; g.lineStyle(2, 0xffffff, 0.9); g.strokeCircle(ptr.x, ptr.y, 10); g.fillStyle(0xffffff, 1); g.fillCircle(ptr.x, ptr.y, 1.5);
    }
    if (s.reloading) { g.fillStyle(0x000000, 0.6); g.fillRect(W / 2 - 60, H / 2 + 80, 120, 6); g.fillStyle(0x5ee0ff, 1); g.fillRect(W / 2 - 60, H / 2 + 80, 120 * s.reloading, 6); }
    if (this.hit > 0) { this.hit -= 0.03; this.centerTxt.alpha < 0.1 && g.lineStyle(3, this.hitKill ? 0xff3a2a : 0xffffff, this.hit); const x = W / 2, y = H / 2; for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.lineBetween(x + dx * 8, y + dy * 8, x + dx * 18, y + dy * 18); }
  }

  toScreen(wx, wy) {
    const cam = this.mission.cameras.main; const v = cam.worldView;
    return { x: (wx - v.x) * cam.zoom, y: (wy - v.y) * cam.zoom };
  }

  drawMarker(m, ha) {
    const mg = this.markerG; mg.clear();
    const t = this.objTarget;
    if (!t || m.cinematic || (m.hudMode === 'sniper' && m.sniperState && m.sniperState.scoped)) { this.markerTxt.setText(''); return; }
    const tx = typeof t.x === 'function' ? t.x() : t.x, ty = typeof t.y === 'function' ? t.y() : t.y;
    if (t.alive === false) { this.markerTxt.setText(''); return; }
    const sp = this.toScreen(tx, ty);
    const margin = 40;
    let x = sp.x, y = sp.y, off = false;
    if (x < margin || x > W - margin || y < margin + 60 || y > H - margin - 80) {
      off = true; x = Phaser.Math.Clamp(x, margin, W - margin); y = Phaser.Math.Clamp(y, margin + 60, H - margin - 80);
    }
    const pulse = 1 + Math.sin(this.time.now / 180) * 0.12;
    mg.fillStyle(0x000000, 0.4 * ha); mg.fillCircle(x, y, 13 * pulse);
    mg.lineStyle(2, 0xffc34d, ha); mg.beginPath(); mg.moveTo(x, y - 10 * pulse); mg.lineTo(x + 8 * pulse, y); mg.lineTo(x, y + 10 * pulse); mg.lineTo(x - 8 * pulse, y); mg.closePath(); mg.strokePath();
    if (off) { const a = Math.atan2(sp.y - y, sp.x - x); mg.fillStyle(0xffc34d, ha); mg.fillTriangle(x + Math.cos(a) * 22, y + Math.sin(a) * 22, x + Math.cos(a + 2.5) * 13, y + Math.sin(a + 2.5) * 13, x + Math.cos(a - 2.5) * 13, y + Math.sin(a - 2.5) * 13); }
    const p = m.player;
    if (p && p.x !== undefined && m.hudMode !== 'heli' && m.hudMode !== 'sniper') { const dist = Math.round(Math.hypot(tx - p.x, ty - p.y) / 40); this.markerTxt.setText(dist + 'm').setPosition(x, y + 15).setAlpha(ha); }
    else this.markerTxt.setText('');
  }
}
