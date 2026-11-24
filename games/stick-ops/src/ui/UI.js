// Reusable UI widgets: buttons, panels, cursor, sliders.
import { FONT, COLORS } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';

export function addCursor(scene) {
  const g = scene.add.graphics().setDepth(10000);
  const fn = () => {
    const p = scene.input.activePointer; g.clear();
    g.lineStyle(3, 0x000000, 0.6); g.strokeCircle(p.x, p.y, 7);
    g.lineStyle(1.5, 0xffffff, 1); g.strokeCircle(p.x, p.y, 7);
    g.fillStyle(0x5ee0ff, 1); g.fillCircle(p.x, p.y, 1.8);
  };
  scene.events.on('update', fn);
  scene.events.once('shutdown', () => scene.events.off('update', fn));
  return g;
}

export function title(scene, x, y, text, size = 64, color = '#e8eef2') {
  return scene.add.text(x, y, text, { fontFamily: FONT.title, fontSize: size + 'px', color }).setOrigin(0.5).setShadow(0, 4, '#000', 10, true, true);
}

export function label(scene, x, y, text, size = 18, color = COLORS.uiText, opts = {}) {
  return scene.add.text(x, y, text, Object.assign({ fontFamily: FONT.ui, fontSize: size + 'px', color, fontStyle: '700' }, opts)).setShadow(0, 2, '#000', 4, true, true);
}

export function button(scene, x, y, text, onClick, opts = {}) {
  const w = opts.width || 320, h = opts.height || 46;
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, 0x0b1218, 0.72).setStrokeStyle(1, 0x2c3a44, 1);
  const bar = scene.add.rectangle(-w / 2, 0, 4, h, COLORS.accent, 1).setOrigin(0, 0.5).setAlpha(0.35);
  const fill = scene.add.rectangle(-w / 2, 0, 0, h, COLORS.accent, 0.14).setOrigin(0, 0.5);
  const t = scene.add.text(-w / 2 + 22, 0, text, { fontFamily: FONT.ui, fontSize: (opts.size || 22) + 'px', fontStyle: '700', color: opts.disabled ? '#4a565e' : '#d9e4ea' }).setOrigin(0, 0.5);
  const sub = opts.sub ? scene.add.text(w / 2 - 16, 0, opts.sub, { fontFamily: FONT.ui, fontSize: '14px', fontStyle: '600', color: opts.subColor || COLORS.uiDim }).setOrigin(1, 0.5) : null;
  c.add([bg, fill, bar, t]); if (sub) c.add(sub);
  c.setSize(w, h);
  c.label = t; c.sub = sub; c.disabled = !!opts.disabled;
  if (!opts.disabled) {
    bg.setInteractive({ useHandCursor: false });
    bg.on('pointerover', () => { AudioEngine.play('ui'); scene.tweens.add({ targets: fill, width: w, duration: 160, ease: 'Quad.easeOut' }); bar.setAlpha(1); t.setColor('#ffffff'); scene.tweens.add({ targets: t, x: -w / 2 + 30, duration: 120 }); });
    bg.on('pointerout', () => { scene.tweens.add({ targets: fill, width: 0, duration: 160 }); bar.setAlpha(0.35); t.setColor('#d9e4ea'); scene.tweens.add({ targets: t, x: -w / 2 + 22, duration: 120 }); });
    bg.on('pointerdown', () => { AudioEngine.resume(); AudioEngine.play(opts.back ? 'uiback' : 'uiconfirm'); onClick(); });
  }
  return c;
}

export function slider(scene, x, y, text, value, onChange, opts = {}) {
  const w = opts.width || 460;
  const c = scene.add.container(x, y);
  const lbl = label(scene, -w / 2, 0, text, 20).setOrigin(0, 0.5);
  const trackX = 0, trackW = w / 2 - 70;
  const track = scene.add.rectangle(trackX, 0, trackW, 6, 0x24303a).setOrigin(0, 0.5);
  const fillR = scene.add.rectangle(trackX, 0, trackW * value, 6, COLORS.accent).setOrigin(0, 0.5);
  const knob = scene.add.rectangle(trackX + trackW * value, 0, 12, 22, 0xffffff);
  const val = label(scene, w / 2, 0, Math.round(value * 100) + '%', 18, COLORS.uiDim).setOrigin(1, 0.5);
  c.add([lbl, track, fillR, knob, val]);
  const hit = scene.add.rectangle(trackX + trackW / 2, 0, trackW + 24, 30, 0xffffff, 0.001).setInteractive();
  c.add(hit);
  const set = (px) => {
    const v = Phaser.Math.Clamp((px - (x + trackX)) / trackW, 0, 1);
    fillR.width = trackW * v; knob.x = trackX + trackW * v; val.setText(Math.round(v * 100) + '%'); onChange(v);
  };
  let drag = false;
  hit.on('pointerdown', (p) => { drag = true; set(p.x); AudioEngine.play('ui'); });
  scene.input.on('pointermove', (p) => { if (drag && p.isDown) set(p.x); });
  scene.input.on('pointerup', () => { drag = false; });
  return c;
}

export function toggle(scene, x, y, text, options, current, onChange, opts = {}) {
  const w = opts.width || 460;
  const c = scene.add.container(x, y);
  const lbl = label(scene, -w / 2, 0, text, 20).setOrigin(0, 0.5);
  let idx = Math.max(0, options.findIndex((o) => o.value === current));
  const val = label(scene, w / 2 - 30, 0, '', 20, '#ffffff').setOrigin(1, 0.5);
  const left = label(scene, 0, 0, '◀', 18, COLORS.accentHex).setOrigin(0.5);
  const right = label(scene, w / 2 - 6, 0, '▶', 18, COLORS.accentHex).setOrigin(0.5);
  const refresh = () => val.setText(options[idx].label);
  refresh();
  const step = (d) => { idx = (idx + d + options.length) % options.length; refresh(); AudioEngine.play('ui'); onChange(options[idx].value); };
  left.setInteractive().on('pointerdown', () => step(-1));
  right.setInteractive().on('pointerdown', () => step(1));
  val.setInteractive().on('pointerdown', () => step(1));
  c.add([lbl, val, left, right]);
  return c;
}

export function panel(scene, x, y, w, h, alpha = 0.8) {
  const g = scene.add.graphics();
  g.fillStyle(0x060a0e, alpha); g.fillRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(1, 0x2c3a44, 1); g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle(COLORS.accent, 1); g.fillRect(x - w / 2, y - h / 2, 40, 3);
  return g;
}
