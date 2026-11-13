'use strict';
/* ===== SHADOW PROTOCOL :: core — math, input, save, audio ===== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const angLerp = (a, b, t) => a + angDiff(a, b) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const damp = (k, dt) => 1 - Math.exp(-k * dt);
function RNG(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------- input ---------- */
const Input = {
  keys: {}, pressed: {}, mx: innerWidth / 2, my: innerHeight / 2, wheel: 0,
  down(c) { return !!this.keys[c]; },
  hit(c) { return !!this.pressed[c]; },
  endFrame() { this.pressed = {}; this.wheel = 0; },
  clear() { this.keys = {}; this.pressed = {}; },
  init(canvas) {
    addEventListener('keydown', e => {
      if (['Space', 'Tab', 'ShiftLeft', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!e.repeat) { this.pressed[e.code] = true; }
      this.keys[e.code] = true;
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => this.clear());
    canvas.addEventListener('mousemove', e => { this.mx = e.clientX; this.my = e.clientY; });
    canvas.addEventListener('mousedown', e => { this.mx = e.clientX; this.my = e.clientY; this.keys['M' + e.button] = true; this.pressed['M' + e.button] = true; Snd.init(); e.preventDefault(); });
    addEventListener('mouseup', e => { this.keys['M' + e.button] = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }
};

/* ---------- persistent save ---------- */
const Save = {
  KEY: 'shadow_protocol_save_v1', data: null,
  def() {
    return { unlocked: 1, best: {}, credits: 0, upgrades: {}, abilities: {}, loadout: ['pistol'],
      settings: { diff: 'easy', vol: 0.7, music: true, shake: true, fx: true, fps: false } };
  },
  load() {
    let d = this.def();
    try { const raw = localStorage.getItem(this.KEY); if (raw) { const o = JSON.parse(raw); d = Object.assign(d, o); d.settings = Object.assign(this.def().settings, o.settings || {}); } } catch (e) { }
    this.data = d;
  },
  write() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { } },
  reset() { this.data = this.def(); this.write(); }
};
Save.load();

/* ---------- synthesized audio ---------- */
const Snd = {
  ctx: null, bus: null, filter: null, nb: null, rate: 1, last: {}, musicGain: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    try {
      const ctx = this.ctx = new C();
      this.master = ctx.createGain(); this.master.gain.value = Save.data.settings.vol;
      this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 20000;
      this.bus = ctx.createGain(); this.bus.connect(this.filter); this.filter.connect(this.master); this.master.connect(ctx.destination);
      this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.5; this.musicGain.connect(this.filter);
      const n = ctx.sampleRate; this.nb = ctx.createBuffer(1, n, n); const d = this.nb.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      for (const k of ['sg', 'pump', 'rico1', 'rico2', 'hit']) this.loadSmp(k); // recorded samples shared with Gun Fu
    } catch (e) { this.ctx = null; }
  },
  smp: {}, smpT: {},
  loadSmp(k) { try { fetch('audio/sfx/' + k + '.mp3').then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b, d => { this.smp[k] = d; }, () => { })).catch(() => { }); } catch (e) { } },
  // play a recorded sample through the game bus (so slow motion pitches and muffles it); false = not loaded, caller falls back to synth
  sample(k, vol = .7, rate = 1, delay = 0) {
    const ctx = this.ctx; if (!ctx || !this.smp[k]) return false;
    const now = performance.now(); if (!delay && now - (this.smpT[k] || 0) < 70) return true; this.smpT[k] = now; // same 70 ms retrigger guard Gun Fu uses
    try { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = this.smp[k]; s.playbackRate.value = rate * this.rate; g.gain.value = vol; s.connect(g); g.connect(this.bus); s.start(ctx.currentTime + delay); } catch (e) { return false; }
    return true;
  },
  // Gun Fu's synth voices, ported 1:1: linearly decaying filtered noise + a sliding oscillator
  gfNoise(d, vol, hp, lp) {
    const ctx = this.ctx; if (!ctx) return; const n = Math.floor(ctx.sampleRate * d), b = ctx.createBuffer(1, n, ctx.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = lp ? 'lowpass' : 'highpass'; f.frequency.value = lp || hp || 800; g.gain.value = vol * 1.7; s.buffer = b; s.playbackRate.value = this.rate; s.connect(f); f.connect(g); g.connect(this.bus); s.start();
  },
  gfTone(f, d, type, vol, slide, delay) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain(), r = this.rate; o.type = type || 'square';
    o.frequency.setValueAtTime(f * r, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide * r), t + d);
    g.gain.setValueAtTime(vol * 1.7, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + d + .02);
  },
  setVol(v) { if (this.master) this.master.gain.value = v; },
  setSlow(k) { // 0 normal .. 1 deep slow motion
    if (!this.ctx) return;
    this.filter.frequency.setTargetAtTime(lerp(20000, 700, k * k < 0.02 ? 0 : Math.sqrt(k)), this.ctx.currentTime, 0.06);
    this.rate = lerp(1, 0.55, k); this.slowK = k;
  },
  noise(dur, o = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0), s = ctx.createBufferSource(); s.buffer = this.nb;
    s.playbackRate.value = (o.rate || 1) * this.rate;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 1500, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q || 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(o.g || 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || this.bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  tone(dur, o = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0), s = ctx.createOscillator(); s.type = o.type || 'sine';
    const r = o.dest ? 1 : this.rate;
    s.frequency.setValueAtTime((o.f || 440) * r, t); if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2 * r, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(o.g || 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(g); g.connect(o.dest || this.bus); s.start(t); s.stop(t + dur + 0.05);
  },
  play(name, a) {
    if (!this.ctx) return; const now = performance.now();
    if (now - (this.last[name] || 0) < 28) return; this.last[name] = now;
    const fn = SFX[name]; if (fn) fn(a);
  }
};
const SFX = {
  pistol() { Snd.gfNoise(.09, .2, 600, 6000); Snd.gfTone(190, .12, 'sawtooth', .13, .3); Snd.gfTone(70, .2, 'sine', .22, .4); }, // Gun Fu pistol shot
  dual() { Snd.gfNoise(.08, .18, 700, 6500); Snd.gfTone(215, .1, 'sawtooth', .12, .3); Snd.gfTone(80, .16, 'sine', .18, .4); },
  smg() { Snd.gfNoise(.04, .1, 1500, 7000); Snd.gfTone(210, .05, 'square', .05, .5); }, // Gun Fu SMG
  ar() { Snd.gfNoise(.1, .22, 500, 5200); Snd.gfTone(160, .13, 'sawtooth', .14, .3); Snd.gfTone(62, .22, 'sine', .24, .4); },
  shotgun() { if (!Snd.sample('sg', .9, .96 + Math.random() * .08)) { Snd.gfNoise(.24, .3, 200, 2500); Snd.gfTone(60, .28, 'sawtooth', .2, .4); } if (!Snd.sample('pump', .7, 1, .38)) { Snd.gfTone(300, .05, 'square', .05, 0, .38); Snd.gfTone(500, .06, 'square', .05, 0, .53); } }, // Gun Fu shotgun blast + pump
  sniper() { Snd.noise(.5, { f: 2600, f2: 120, g: 1 }); Snd.tone(.4, { f: 95, f2: 28, type: 'sawtooth', g: .5 }); Snd.noise(.7, { f: 6000, type: 'highpass', g: .1, delay: .08 }); },
  silenced() { Snd.noise(.07, { f: 1100, type: 'bandpass', q: 2, g: .22 }); Snd.tone(.04, { f: 300, f2: 120, g: .08 }); },
  eshot() { Snd.gfNoise(.08, .12, 500, 4000); Snd.gfTone(150, .1, 'square', .06, .35); }, // Gun Fu enemy shot
  flame() { Snd.noise(.2, { f: 700, f2: 300, type: 'bandpass', q: .6, g: .26 }); Snd.noise(.12, { f: 2600, type: 'highpass', g: .05 }); },
  ignite() { Snd.noise(.35, { f: 500, f2: 1800, type: 'bandpass', g: .3 }); },
  empty() { Snd.tone(.03, { f: 1800, type: 'square', g: .1 }); },
  reload() { Snd.tone(.03, { f: 900, type: 'square', g: .12 }); Snd.tone(.04, { f: 1400, type: 'square', g: .12, delay: .12 }); },
  reloadDone() { Snd.tone(.04, { f: 700, type: 'square', g: .14 }); Snd.noise(.05, { f: 4000, type: 'highpass', g: .12 }); },
  perfect() { Snd.tone(.09, { f: 1200, f2: 2000, g: .2 }); Snd.tone(.12, { f: 1800, f2: 2600, g: .14, delay: .06 }); },
  glass() { Snd.noise(.4, { f: 4200, type: 'highpass', g: .4 }); for (let i = 0; i < 5; i++) Snd.tone(.08 + Math.random() * .1, { f: 2200 + Math.random() * 4000, g: .06, delay: Math.random() * .18 }); },
  light() { Snd.noise(.15, { f: 5000, type: 'highpass', g: .25 }); Snd.tone(.25, { f: 110, f2: 40, type: 'sawtooth', g: .18 }); },
  boom() { Snd.noise(1.0, { f: 700, f2: 40, g: 1.1 }); Snd.tone(.7, { f: 95, f2: 24, g: .9 }); Snd.noise(.25, { f: 3000, f2: 600, g: .5 }); },
  hit() { if (!Snd.sample('hit', .6, .95 + Math.random() * .12)) Snd.tone(.06, { f: 330, f2: 90, type: 'triangle', g: .22 }); },
  rico() { if (!Snd.sample(Math.random() < .5 ? 'rico1' : 'rico2', .5, .92 + Math.random() * .16)) { Snd.gfNoise(.06, .16, 2500, 9000); Snd.gfTone(1500, .09, 'square', .05, .6); } },
  head() { Snd.tone(.1, { f: 1500, f2: 600, type: 'triangle', g: .25 }); Snd.noise(.07, { f: 900, g: .25 }); },
  kill() { Snd.tone(.16, { f: 240, f2: 50, type: 'sawtooth', g: .2 }); },
  hurt() { Snd.tone(.2, { f: 160, f2: 50, type: 'sawtooth', g: .35 }); Snd.noise(.12, { f: 600, g: .3 }); },
  slide() { Snd.noise(.4, { f: 500, f2: 1700, type: 'bandpass', q: 1.2, g: .22 }); },
  roll() { Snd.noise(.25, { f: 400, f2: 1000, type: 'bandpass', g: .16 }); },
  dive() { Snd.noise(.5, { f: 300, f2: 1400, type: 'bandpass', g: .2 }); Snd.tone(.5, { f: 500, f2: 180, g: .08 }); },
  land() { Snd.noise(.1, { f: 300, g: .3 }); },
  btOn() { Snd.tone(.9, { f: 1000, f2: 60, g: .32, dest: Snd.master }); Snd.noise(.8, { f: 5000, f2: 200, g: .2, dest: Snd.master }); },
  btOff() { Snd.tone(.5, { f: 80, f2: 900, g: .22, dest: Snd.master }); },
  dodge() { Snd.tone(.22, { f: 600, f2: 1900, g: .2, dest: Snd.master }); Snd.noise(.25, { f: 2500, type: 'bandpass', q: 3, g: .12, dest: Snd.master }); },
  note() { Snd.tone(.07, { f: 880, g: .1, dest: Snd.master }); Snd.tone(.1, { f: 1320, g: .08, delay: .05, dest: Snd.master }); },
  big() { Snd.tone(.12, { f: 660, g: .14, dest: Snd.master }); Snd.tone(.12, { f: 990, g: .12, delay: .07, dest: Snd.master }); Snd.tone(.25, { f: 1320, g: .12, delay: .14, dest: Snd.master }); },
  ui() { Snd.tone(.04, { f: 700, type: 'square', g: .07, dest: Snd.master }); },
  uiOk() { Snd.tone(.06, { f: 520, type: 'square', g: .08, dest: Snd.master }); Snd.tone(.08, { f: 1040, type: 'square', g: .07, delay: .05, dest: Snd.master }); },
  deny() { Snd.tone(.12, { f: 140, type: 'square', g: .1, dest: Snd.master }); },
  metal() { if (!Snd.sample(Math.random() < .5 ? 'rico1' : 'rico2', .55, 1 + Math.random() * .2)) { Snd.tone(.12, { f: 2400 + Math.random() * 1500, type: 'triangle', g: .12 }); Snd.noise(.04, { f: 5000, type: 'highpass', g: .15 }); } },
  wood() { Snd.noise(.08, { f: 700, g: .3 }); Snd.tone(.05, { f: 180, f2: 90, g: .12 }); },
  crash() { Snd.noise(.3, { f: 900, f2: 200, g: .5 }); Snd.tone(.15, { f: 120, f2: 50, g: .3 }); },
  door() { Snd.noise(.12, { f: 500, g: .3 }); Snd.tone(.08, { f: 110, g: .2 }); },
  takedown() { Snd.noise(.14, { f: 500, g: .5 }); Snd.tone(.18, { f: 130, f2: 40, type: 'square', g: .3 }); },
  mark() { Snd.tone(.05, { f: 1700, type: 'square', g: .1, dest: Snd.master }); },
  pickup() { Snd.tone(.07, { f: 600, g: .12 }); Snd.tone(.09, { f: 900, g: .12, delay: .06 }); },
  alert() { Snd.tone(.09, { f: 760, type: 'square', g: .07 }); Snd.tone(.09, { f: 1010, type: 'square', g: .07, delay: .08 }); },
  laststand() { Snd.tone(.6, { f: 60, f2: 180, type: 'sawtooth', g: .3, dest: Snd.master }); },
  rank() { [523, 659, 784, 1047].forEach((f, i) => Snd.tone(.3, { f, type: 'triangle', g: .14, delay: i * .11, dest: Snd.master })); }
};

/* ---------- adaptive soundtrack ----------
   menu.mp3 = main-menu theme, game.mp3 = in-mission theme. The game track reacts to the scene:
   - intensity (0..1): calm = quiet and low-passed, full combat = loud and wide open
   - slow motion: the tape slows down and drops in pitch with the world, and the master filter muffles it */
const Music = {
  tr: null, intensity: 0, rate: 1, mode: 'menu', web: location.protocol !== 'file:',
  ensure() {
    const ctx = Snd.ctx; if (this.tr || !ctx) return;
    this.tr = {};
    for (const k of ['menu', 'game']) {
      const a = new Audio('audio/' + k + '.mp3'); a.loop = true; a.preload = 'auto'; a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
      const t = this.tr[k] = { a, f: null, g: null, vol: 0 };
      if (this.web) { // route through the WebAudio graph so filters apply
        try { const src = ctx.createMediaElementSource(a); t.f = ctx.createBiquadFilter(); t.f.type = 'lowpass'; t.f.frequency.value = 20000; t.f.Q.value = .4; t.g = ctx.createGain(); t.g.gain.value = 0; src.connect(t.f); t.f.connect(t.g); t.g.connect(Snd.musicGain); } catch (e) { t.f = t.g = null; }
      }
      if (!t.g) a.volume = 0;
    }
  },
  // target: scene intensity 0..1, mode: which track should be playing
  update(rdt, target, mode = 'game') {
    const ctx = Snd.ctx; if (!ctx) return; this.ensure();
    const on = Save.data.settings.music, now = ctx.currentTime; this.mode = mode;
    Snd.musicGain.gain.setTargetAtTime(on ? .85 : 0, now, .2);
    this.intensity = lerp(this.intensity, target, damp(target > this.intensity ? 2.2 : .7, rdt)); // swells fast, relaxes slowly
    const I = this.intensity, slow = Snd.slowK || 0;
    this.rate = lerp(this.rate, mode === 'game' ? 1 - .32 * slow : 1, damp(6, rdt));
    for (const k in this.tr) {
      const t = this.tr[k], active = k === mode && on;
      const want = !active ? 0 : k === 'menu' ? .8 : lerp(.38, 1, I);
      t.vol = lerp(t.vol, want, damp(want > t.vol ? 1.6 : 1.1, rdt)); // crossfade between tracks
      if (t.g) { t.g.gain.setTargetAtTime(t.vol, now, .05); t.f.frequency.setTargetAtTime(k === 'menu' ? 20000 : 650 * Math.pow(30, I), now, .12); }
      else t.a.volume = clamp(t.vol * Save.data.settings.vol, 0, 1);
      if (active && t.a.paused) { const p = t.a.play(); if (p && p.catch) p.catch(() => { }); }
      else if (!active && t.vol < .01 && !t.a.paused) t.a.pause();
      if (!t.a.paused && Math.abs(t.a.playbackRate - this.rate) > .004) t.a.playbackRate = k === 'game' ? this.rate : 1;
    }
  }
};
addEventListener('pointerdown', () => Snd.init(), true); addEventListener('keydown', () => Snd.init(), true); // browsers need a gesture before audio can start
