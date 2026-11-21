'use strict';
/* ===== STICKMAN: LAST STAND — core: canvas, math, input, save ===== */
const W = 960, H = 540, TS = 32;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let SCALE = 1, OX = 0, OY = 0, DPR = 1, RQ = 1;
/* Render resolution: the game is 960x540, so the backing canvas is capped at ~1920x1080 pixels
   (a 4K / high-DPI screen used to render 8M pixels per frame). RQ is lowered automatically
   by the frame-rate watchdog in main.js on slower devices. */
function resize() {
  const sw = innerWidth, sh = innerHeight; SCALE = Math.min(sw / W, sh / H);
  const cap = Math.sqrt((W * H * 4) / Math.max(1, sw * sh));
  DPR = Math.max(.5, Math.min(2, window.devicePixelRatio || 1, cap) * RQ);
  cv.width = Math.round(sw * DPR); cv.height = Math.round(sh * DPR); cv.style.width = sw + 'px'; cv.style.height = sh + 'px';
  OX = (sw - W * SCALE) / 2; OY = (sh - H * SCALE) / 2;
}
addEventListener('resize', resize); resize();

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const sgn = v => v < 0 ? -1 : 1;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const ovl = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function seeded(s) { let h = 2166136261 ^ s; return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r * f), 0, 255); g = clamp(Math.round(g * f), 0, 255); b = clamp(Math.round(b * f), 0, 255); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }

/* ---------- input: keyboard, mouse, gamepad, touch (touch buttons live in touch.js) ---------- */
const Input = {
  k: {}, p: {}, tap: {}, kd(c) { return this.k[c] || this.tap[c]; }, mx: W / 2, my: H / 2, mouseOn: false, mouseT: 0, pad: null, padOn: false, touchOn: false, T: {}, TP: {},
  down(a) { return !!(this.act[a] && this.act[a]()); },
  hit(a) { return !!this.ph[a]; },
  ph: {}, prev: {},
  act: {
    left: () => Input.kd("KeyA") || Input.kd("ArrowLeft") || Input.T.left || Input.padAx(0) < -.4 || Input.pb(14),
    right: () => Input.kd("KeyD") || Input.kd("ArrowRight") || Input.T.right || Input.padAx(0) > .4 || Input.pb(15),
    up: () => Input.kd("KeyW") || Input.kd("ArrowUp") || Input.T.up || Input.padAx(1) < -.5 || Input.pb(12),
    down: () => Input.kd("KeyS") || Input.kd("ArrowDown") || Input.T.down || Input.padAx(1) > .5 || Input.pb(13),
    jump: () => Input.kd("Space") || Input.kd("KeyK") || Input.T.jump || Input.pb(0),
    fire: () => Input.kd("M0") || Input.kd("KeyJ") || Input.kd("ControlLeft") || Input.T.fire || Input.pb(2) || Input.pb(7),
    grenade: () => Input.kd("KeyE") || Input.kd("KeyL") || Input.T.grenade || Input.pb(1) || Input.pb(5),
    swap: () => Input.kd("KeyQ") || Input.T.swap || Input.pb(3) || Input.pb(4),
    special: () => Input.kd("KeyF") || Input.kd("M2") || Input.kd("ShiftLeft") || Input.T.special || Input.pb(6),
    pause: () => Input.kd("Escape") || Input.kd("KeyP") || Input.pb(9),
    ok: () => Input.kd("Enter") || Input.kd("Space") || Input.pb(0),
    back: () => Input.kd("Escape") || Input.kd("Backspace") || Input.pb(1),
  },
  padAx(i) { const g = this.pad; if (!g || !g.axes) return 0; const v = g.axes[i] || 0; return Math.abs(v) > .25 ? v : 0; },
  pb(i) { const g = this.pad; return !!(g && g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > .5)); },
  padAim() { const g = this.pad; if (!g) return null; const x = g.axes[2] || 0, y = g.axes[3] || 0; return Math.hypot(x, y) > .45 ? Math.atan2(y, x) : null; },
  poll() {
    const gs = navigator.getGamepads ? navigator.getGamepads() : []; this.pad = null;
    for (const g of gs) if (g && g.connected) { this.pad = g; break; }
    if (this.pad && (this.pad.buttons.some(b => b.pressed) || this.pad.axes.some(a => Math.abs(a) > .5))) { this.padOn = true; this.mouseOn = false; }
    for (const a in this.act) { const d = this.down(a); this.ph[a] = d && !this.prev[a]; this.prev[a] = d; }
    this.tap = {};
  },
  wmx() { return Cam.x + this.mx; }, wmy() { return Cam.y + this.my; },
  clearHits() { for (const a in this.ph) this.ph[a] = false; },
  init() {
    addEventListener('keydown', e => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); this.k[e.code] = true; this.tap[e.code] = true; this.padOn = false; Snd.init(); });
    addEventListener('keyup', e => { this.k[e.code] = false; });
    addEventListener('blur', () => { this.k = {}; this.T = {}; });
    const pos = e => { this.mx = (e.clientX - OX) / SCALE; this.my = (e.clientY - OY) / SCALE; };
    cv.addEventListener('mousemove', e => { pos(e); this.mouseOn = true; this.padOn = false; this.mouseT = 3; });
    cv.addEventListener('mousedown', e => { pos(e); if (e.pointerType === 'touch') return; this.k['M' + e.button] = true; this.tap['M' + e.button] = true; this.mouseOn = true; Snd.init(); UI.click(this.mx, this.my); e.preventDefault(); });
    addEventListener('mouseup', e => { this.k['M' + e.button] = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { if (G.state === 'play') this.wheel = (this.wheel || 0) + Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }
};

/* ---------- persistent save ---------- */
const Save = {
  KEY: 'stickman_last_stand_v1',
  d: null,
  def() { return { unlocked: 1, best: [0, 0, 0, 0, 0], hi: 0, scores: [], settings: { vol: .8, music: true, shake: true, diff: 1, fx: true }, cleared: [] }; },
  load() { try { this.d = Object.assign(this.def(), JSON.parse(localStorage.getItem(this.KEY) || '{}')); this.d.settings = Object.assign(this.def().settings, this.d.settings || {}); } catch (e) { this.d = this.def(); } },
  write() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { } },
  addScore(name, s, lv) { const L = this.d.scores; L.push({ n: name, s, l: lv }); L.sort((a, b) => b.s - a.s); this.d.scores = L.slice(0, 8); this.d.hi = Math.max(this.d.hi, s); this.write(); }
};
Save.load();

/* ---------- Retro World bridge ---------- */
const RWB = { send(t, x) { try { if (parent !== window) parent.postMessage(Object.assign({ source: 'retro-world-game', type: t, gameId: 'last-stand.html', title: 'STICKMAN: LAST STAND' }, x || {}), '*'); } catch (e) { } }, ach(k) { this.send('achievement', { achievement: k }); } };
