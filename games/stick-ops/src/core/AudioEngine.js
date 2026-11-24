// Procedural Web Audio engine: synthesized weapon/explosion/UI sfx + reverb bus.
import { SaveSystem } from './SaveSystem.js';

// Recorded samples (assets/audio/<file>.mp3). Variants are grouped by name.
const SAMPLE_FILES = ['rifle', 'erifle', 'pistol', 'doorgun', 'minigun', 'sniper', 'shotgun', 'pump', 'reload_rifle', 'reload_pistol', 'reload_sniper',
  'shell_load', 'bolt', 'charge', 'explosion', 'explosion_big', 'boom', 'impact_cine', 'cannon', 'debris', 'hitconcrete', 'hitmetal', 'hitmetal2',
  'hitflesh', 'hitflesh2', 'headshot', 'knife', 'punch', 'bodyfall', 'bodyfall2', 'land', 'mantle', 'ladder', 'switch', 'pickup', 'grenadepin',
  'bounce', 'door', 'breach', 'ui', 'uiconfirm', 'uiback', 'warning', 'objective', 'hack', 'rain', 'engine',
  'heliflyby', 'rotor', 'jets', 'alarm', 'heavyshot', 'radio1', 'radio2', 'radio3', 'radio4',
  'step_concrete1', 'step_concrete2', 'step_concrete3', 'step_concrete4', 'step_dirt1', 'step_dirt2', 'step_dirt3', 'step_dirt4'];
const groupOf = (f) => f.replace(/\d+$/, '');

// play() name -> sample group, gain, reverb send, pitch jitter
const SAMPLE_MAP = {
  rifle: ['rifle', 0.55, 0.35, 0.05], erifle: ['erifle', 0.42, 0.45, 0.06], pistol: ['pistol', 0.5, 0.25, 0.05],
  shotgun: ['shotgun', 0.75, 0.5, 0.04], sniper: ['sniper', 0.85, 0.7, 0.03], minigun: ['minigun', 0.32, 0.15, 0.08],
  doorgun: ['doorgun', 0.4, 0.15, 0.08], cannon: ['heavyshot', 0.85, 0.5, 0.05], heavyshot: ['heavyshot', 0.85, 0.5, 0.05], flak: ['heavyshot', 0.35, 0.3, 0.15],
  alarm: ['alarm', 0.32, 0.4, 0], radio: ['radio', 0.22, 0.05, 0.02], heliflyby: ['heliflyby', 0.8, 0.3, 0], jets: ['jets', 0.85, 0.4, 0], debris: ['debris', 0.7, 0.4, 0.08],
  hitconcrete: ['hitconcrete', 0.3, 0.15, 0.15], hitmetal: ['hitmetal', 0.32, 0.25, 0.15], hitflesh: ['hitflesh', 0.45, 0.05, 0.12],
  headshot: ['headshot', 0.6, 0.1, 0.08], knife: ['knife', 0.6, 0.05, 0.1], land: ['land', 0.45, 0.05, 0.1], mantle: ['mantle', 0.5, 0.05, 0.12],
  ladder: ['ladder', 0.25, 0.1, 0.15], switch: ['switch', 0.45, 0.05, 0.08], pickup: ['pickup', 0.5, 0.1, 0.05], grenadepin: ['grenadepin', 0.5, 0.05, 0.05],
  bounce: ['bounce', 0.3, 0.1, 0.2], door: ['door', 0.6, 0.4, 0.05], breach: ['breach', 0.8, 0.4, 0.05], ui: ['ui', 0.3, 0, 0.02],
  uiconfirm: ['uiconfirm', 0.4, 0.1, 0], uiback: ['uiback', 0.35, 0.05, 0], warning: ['warning', 0.35, 0.1, 0], objective: ['objective', 0.4, 0.3, 0],
  hack: ['hack', 0.18, 0, 0.25], pump: ['pump', 0.55, 0.15, 0.04], bolt: ['bolt', 0.5, 0.1, 0.04], shell_load: ['shell_load', 0.45, 0.05, 0.06],
  reload_rifle: ['reload_rifle', 0.5, 0.05, 0.03], reload_pistol: ['reload_pistol', 0.5, 0.05, 0.03], reload_sniper: ['reload_sniper', 0.5, 0.05, 0.03],
  charge: ['charge', 0.5, 0.05, 0.03], bodyfall: ['bodyfall', 0.5, 0.1, 0.12], punch: ['punch', 0.55, 0.05, 0.1], boom: ['boom', 0.9, 0.5, 0.05],
  impact_cine: ['impact_cine', 0.8, 0.5, 0],
};

class AudioEngineImpl {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.loops = new Map();
    this.listenerX = 0;
    this.lastPlay = {};
    this.raw = {}; this.samples = {}; this.decoding = false;
  }

  // Fetch sample files early (no AudioContext needed); decoded once audio is unlocked.
  preload(base = 'assets/audio/') {
    if (this.preloading) return; this.preloading = true;
    for (const f of SAMPLE_FILES) {
      fetch(base + f + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).then((buf) => {
        if (!buf) return; this.raw[f] = buf; if (this.ctx) this._decode(f);
      }).catch(() => { /* missing file: synth fallback */ });
    }
  }

  _decode(f) {
    const buf = this.raw[f]; if (!buf || !this.ctx) return;
    delete this.raw[f];
    const done = (ab) => { const g = groupOf(f); (this.samples[g] = this.samples[g] || []).push(ab); };
    try {
      const pr = this.ctx.decodeAudioData(buf, done, () => {});
      if (pr && pr.catch) pr.catch(() => {});
    } catch (e) { /* undecodable: synth fallback */ }
  }

  hasSample(g) { return !!(this.samples[g] && this.samples[g].length); }

  playSample(group, vol, pan, rev = 0.2, jitter = 0.05, rate = 1) {
    const list = this.samples[group]; if (!list || !list.length || !this.ready) return null;
    const ctx = this.ctx; const buf = list[Math.floor(Math.random() * list.length)];
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
    const out = this._out(vol, pan, rev);
    src.connect(out); src.start();
    return src;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 5;
      this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
      this.slowFilter = ctx.createBiquadFilter();
      this.slowFilter.type = 'lowpass'; this.slowFilter.frequency.value = 20000; this.slowFilter.Q.value = 0.6;
      this.master.connect(this.slowFilter); this.slowFilter.connect(this.comp); this.comp.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.connect(this.master);
      this.music = ctx.createGain(); this.music.connect(this.master);
      // reverb send
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(2.6, 2.4);
      this.revSend = ctx.createGain(); this.revSend.gain.value = 0.32;
      this.revSend.connect(this.reverb); this.reverb.connect(this.master);
      this.noise = this._noiseBuffer(2, false);
      this.brown = this._noiseBuffer(3, true);
      this.applyVolumes();
      this.ready = true;
      for (const f of Object.keys(this.raw)) this._decode(f);
    } catch (e) { this.ctx = null; this.ready = false; }
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = SaveSystem.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.6, t, 0.05);
  }

  setSlowmo(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.slowFilter.frequency.cancelScheduledValues(t);
    this.slowFilter.frequency.setTargetAtTime(on ? 900 : 20000, t, on ? 0.08 : 0.25);
  }

  setMuffled(on) { this.setSlowmo(on); }

  _noiseBuffer(sec, brown) {
    const ctx = this.ctx; const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  _impulse(sec, decay) {
    const ctx = this.ctx; const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------- building blocks ----------
  _out(vol, pan, rev) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = vol;
    let node = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan || 0));
      g.connect(p); node = p;
    }
    node.connect(this.sfx);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s); s.connect(this.revSend); }
    return g;
  }

  _noise(dest, { t = 0, dur = 0.2, vol = 1, type = 'lowpass', freq = 2000, q = 1, freqEnd, attack = 0.002, brown = false, rate = 1 }) {
    const ctx = this.ctx; const now = ctx.currentTime + t;
    const src = ctx.createBufferSource(); src.buffer = brown ? this.brown : this.noise; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, now); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(now, Math.random() * 1.5); src.stop(now + dur + 0.05);
  }

  _tone(dest, { t = 0, dur = 0.2, vol = 0.5, type = 'sine', freq = 440, freqEnd, attack = 0.002 }) {
    const ctx = this.ctx; const now = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, now);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(dest); o.start(now); o.stop(now + dur + 0.05);
  }

  panFor(x) {
    if (x === undefined || x === null) return 0;
    return Math.max(-0.85, Math.min(0.85, (x - this.listenerX) / 900));
  }
  distVol(x) {
    if (x === undefined || x === null) return 1;
    const d = Math.abs(x - this.listenerX);
    return Math.max(0.12, 1 - d / 2400);
  }

  // ---------- public ----------
  play(name, opts = {}) {
    if (!this.ready || !this.ctx || this.ctx.state !== 'running') return;
    // throttle identical sounds to avoid stacking volume
    const now = performance.now();
    const minGap = opts.gap !== undefined ? opts.gap : 18;
    if (this.lastPlay[name] && now - this.lastPlay[name] < minGap) return;
    this.lastPlay[name] = now;
    const pan = opts.pan !== undefined ? opts.pan : this.panFor(opts.x);
    const v = (opts.vol !== undefined ? opts.vol : 1) * this.distVol(opts.x);
    // recorded sample first, synthesized fallback otherwise
    try {
      if (name === 'step') { if (this.playSample(opts.surface === 'dirt' ? 'step_dirt' : 'step_concrete', v * 0.32, pan, 0.03, 0.12)) return; }
      else if (name === 'explosion') {
        if (this.playSample(opts.big ? 'explosion_big' : 'explosion', v * (opts.big ? 1 : 0.85), pan, 0.6, 0.08)) {
          if (opts.big) this.playSample('boom', v * 0.6, pan, 0.6, 0.03);
          this._tone(this._out(v * 0.5, pan), { dur: 0.6, vol: 0.8, freq: 60, freqEnd: 24 });   // sub-bass weight
          return;
        }
      } else if (SAMPLE_MAP[name]) {
        const [g, gain, rev, jit] = SAMPLE_MAP[name];
        if (this.playSample(g, v * gain * (opts.gainMul || 1), pan, rev, jit, opts.rate || 1)) {
          if (name === 'rifle' || name === 'shotgun' || name === 'sniper') this._tone(this._out(v * 0.35, pan), { dur: 0.12, vol: 0.7, freq: name === 'sniper' ? 80 : 130, freqEnd: 40 });
          return;
        }
      }
    } catch (e) { /* fall through to synth */ }
    const fn = this['s_' + name];
    if (fn) { try { fn.call(this, v, pan, opts); } catch (e) { /* ignore audio errors */ } }
  }

  s_rifle(v, pan) {
    const o = this._out(v * 0.9, pan, 0.5);
    this._noise(o, { dur: 0.09, vol: 1.0, type: 'bandpass', freq: 1800, q: 0.7, freqEnd: 600 });
    this._noise(o, { dur: 0.22, vol: 0.5, type: 'lowpass', freq: 900, freqEnd: 120 });
    this._tone(o, { dur: 0.09, vol: 0.7, freq: 160, freqEnd: 50 });
    this._noise(o, { t: 0.0, dur: 0.03, vol: 0.5, type: 'highpass', freq: 5000 });
  }
  s_erifle(v, pan) {
    const o = this._out(v * 0.6, pan, 0.6);
    this._noise(o, { dur: 0.1, vol: 1.0, type: 'bandpass', freq: 1300, q: 0.8, freqEnd: 500 });
    this._tone(o, { dur: 0.08, vol: 0.5, freq: 130, freqEnd: 45 });
  }
  s_pistol(v, pan) {
    const o = this._out(v * 0.7, pan, 0.35);
    this._noise(o, { dur: 0.07, vol: 0.9, type: 'bandpass', freq: 2600, q: 1.2, freqEnd: 900 });
    this._tone(o, { dur: 0.05, vol: 0.4, freq: 300, freqEnd: 90 });
    this._noise(o, { t: 0.01, dur: 0.12, vol: 0.25, type: 'lowpass', freq: 1500, freqEnd: 200 });
  }
  s_shotgun(v, pan) {
    const o = this._out(v, pan, 0.7);
    this._noise(o, { dur: 0.32, vol: 1.0, type: 'lowpass', freq: 3500, freqEnd: 180 });
    this._tone(o, { dur: 0.18, vol: 0.9, freq: 110, freqEnd: 35 });
    this._noise(o, { dur: 0.05, vol: 0.6, type: 'highpass', freq: 3000 });
    // pump
    this._noise(o, { t: 0.32, dur: 0.05, vol: 0.35, type: 'bandpass', freq: 1200, q: 3 });
    this._noise(o, { t: 0.45, dur: 0.06, vol: 0.4, type: 'bandpass', freq: 900, q: 3 });
  }
  s_sniper(v, pan) {
    const o = this._out(v * 1.1, pan, 0.9);
    this._noise(o, { dur: 0.5, vol: 1.0, type: 'lowpass', freq: 5000, freqEnd: 100 });
    this._tone(o, { dur: 0.3, vol: 1.0, freq: 90, freqEnd: 28 });
    this._noise(o, { dur: 0.04, vol: 0.8, type: 'highpass', freq: 4000 });
    this._noise(o, { t: 0.55, dur: 0.06, vol: 0.3, type: 'bandpass', freq: 1500, q: 4 });
    this._noise(o, { t: 0.75, dur: 0.07, vol: 0.35, type: 'bandpass', freq: 1100, q: 4 });
  }
  s_minigun(v, pan) {
    const o = this._out(v * 0.5, pan, 0.3);
    this._noise(o, { dur: 0.06, vol: 1.0, type: 'bandpass', freq: 1100, q: 0.9 });
    this._tone(o, { dur: 0.05, vol: 0.5, freq: 120, freqEnd: 60 });
  }
  s_doorgun(v, pan) {
    const o = this._out(v * 0.55, pan, 0.25);
    this._noise(o, { dur: 0.07, vol: 1.0, type: 'bandpass', freq: 900, q: 0.8, freqEnd: 400 });
    this._tone(o, { dur: 0.06, vol: 0.7, freq: 95, freqEnd: 40 });
  }
  s_launcher(v, pan) {
    const o = this._out(v, pan, 0.6);
    this._noise(o, { dur: 0.7, vol: 0.9, type: 'bandpass', freq: 600, q: 0.5, freqEnd: 2400, attack: 0.02 });
    this._tone(o, { dur: 0.2, vol: 0.8, freq: 70, freqEnd: 30 });
  }
  s_cannon(v, pan) {
    const o = this._out(v, pan, 0.8);
    this._noise(o, { dur: 0.6, vol: 1, type: 'lowpass', freq: 1800, freqEnd: 60, brown: true });
    this._tone(o, { dur: 0.4, vol: 1, freq: 70, freqEnd: 22 });
  }
  s_explosion(v, pan, opts) {
    const big = opts.big ? 1.4 : 1;
    const o = this._out(v * big, pan, 1.0);
    this._noise(o, { dur: 1.8 * big, vol: 1.0, type: 'lowpass', freq: 1500, freqEnd: 60, brown: true, attack: 0.005 });
    this._noise(o, { dur: 0.35, vol: 0.7, type: 'lowpass', freq: 4000, freqEnd: 300 });
    this._tone(o, { dur: 1.1 * big, vol: 1.0, freq: 65, freqEnd: 20, attack: 0.004 });
    for (let i = 0; i < 6; i++) this._noise(o, { t: 0.2 + Math.random() * 0.9, dur: 0.05, vol: 0.18, type: 'highpass', freq: 2500 });
  }
  s_debris(v, pan) {
    const o = this._out(v * 0.5, pan, 0.4);
    for (let i = 0; i < 8; i++) this._noise(o, { t: Math.random() * 1.2, dur: 0.08 + Math.random() * 0.1, vol: 0.4, type: 'bandpass', freq: 400 + Math.random() * 900, q: 1.5 });
    this._noise(o, { dur: 2.0, vol: 0.5, type: 'lowpass', freq: 500, freqEnd: 80, brown: true, attack: 0.2 });
  }
  s_reload(v, pan, opts) {
    const o = this._out(v * 0.5, pan, 0.1);
    const d = (opts.dur || 1.8);
    this._noise(o, { t: 0.05, dur: 0.05, vol: 0.6, type: 'bandpass', freq: 2200, q: 5 });
    this._noise(o, { t: d * 0.45, dur: 0.06, vol: 0.7, type: 'bandpass', freq: 1500, q: 4 });
    this._noise(o, { t: d * 0.8, dur: 0.05, vol: 0.8, type: 'bandpass', freq: 2800, q: 6 });
    this._noise(o, { t: d * 0.86, dur: 0.06, vol: 0.6, type: 'bandpass', freq: 1900, q: 6 });
  }
  s_shell(v, pan) {
    const o = this._out(v * 0.18, pan, 0.1);
    const f = 3500 + Math.random() * 2500;
    this._tone(o, { dur: 0.08, vol: 0.5, freq: f, freqEnd: f * 0.9 });
    this._tone(o, { t: 0.09, dur: 0.05, vol: 0.25, freq: f * 1.1 });
  }
  s_dry(v, pan) { const o = this._out(v * 0.5, pan); this._noise(o, { dur: 0.03, vol: 0.8, type: 'bandpass', freq: 3000, q: 8 }); }
  s_switch(v, pan) {
    const o = this._out(v * 0.4, pan);
    this._noise(o, { dur: 0.04, vol: 0.7, type: 'bandpass', freq: 1800, q: 4 });
    this._noise(o, { t: 0.1, dur: 0.04, vol: 0.6, type: 'bandpass', freq: 2600, q: 4 });
  }
  s_step(v, pan) { const o = this._out(v * 0.16, pan); this._noise(o, { dur: 0.06, vol: 0.8, type: 'lowpass', freq: 700 + Math.random() * 300 }); }
  s_land(v, pan) { const o = this._out(v * 0.35, pan); this._noise(o, { dur: 0.12, vol: 0.9, type: 'lowpass', freq: 500 }); }
  s_jump(v, pan) { const o = this._out(v * 0.15, pan); this._noise(o, { dur: 0.08, vol: 0.6, type: 'bandpass', freq: 900, q: 1 }); }
  s_hitflesh(v, pan) {
    const o = this._out(v * 0.55, pan, 0.1);
    this._noise(o, { dur: 0.09, vol: 1, type: 'lowpass', freq: 900, freqEnd: 200 });
    this._tone(o, { dur: 0.06, vol: 0.4, freq: 180, freqEnd: 70 });
  }
  s_headshot(v, pan) {
    const o = this._out(v * 0.7, pan, 0.2);
    this._noise(o, { dur: 0.12, vol: 1, type: 'bandpass', freq: 1200, q: 1 });
    this._tone(o, { dur: 0.15, vol: 0.4, freq: 900, freqEnd: 300 });
  }
  s_hitmetal(v, pan) {
    const o = this._out(v * 0.35, pan, 0.3);
    const f = 1800 + Math.random() * 1600;
    this._tone(o, { dur: 0.25, vol: 0.4, freq: f, freqEnd: f * 0.97, type: 'triangle' });
    this._noise(o, { dur: 0.04, vol: 0.6, type: 'highpass', freq: 3000 });
  }
  s_hitconcrete(v, pan) {
    const o = this._out(v * 0.3, pan, 0.2);
    this._noise(o, { dur: 0.08, vol: 1, type: 'bandpass', freq: 1400 + Math.random() * 800, q: 1.2 });
  }
  s_ricochet(v, pan) {
    const o = this._out(v * 0.25, pan, 0.4);
    const f = 2500 + Math.random() * 2000;
    this._tone(o, { dur: 0.35, vol: 0.35, freq: f, freqEnd: f * 0.45, type: 'sine' });
  }
  s_whiz(v, pan) {
    const o = this._out(v * 0.25, pan);
    this._noise(o, { dur: 0.12, vol: 0.7, type: 'bandpass', freq: 3000, q: 3, freqEnd: 1200, attack: 0.04 });
  }
  s_playerhit(v, pan) {
    const o = this._out(v * 0.7, pan);
    this._noise(o, { dur: 0.15, vol: 1, type: 'lowpass', freq: 600, freqEnd: 100 });
    this._tone(o, { dur: 0.1, vol: 0.6, freq: 110, freqEnd: 50 });
  }
  s_hitmarker(v) {
    const o = this._out(v * 0.22, 0);
    this._tone(o, { dur: 0.05, vol: 0.6, freq: 2400, type: 'square' });
  }
  s_killconfirm(v) {
    const o = this._out(v * 0.25, 0);
    this._tone(o, { dur: 0.06, vol: 0.5, freq: 1600, type: 'square' });
    this._tone(o, { t: 0.05, dur: 0.1, vol: 0.5, freq: 2400, type: 'square' });
  }
  s_grenadepin(v, pan) {
    const o = this._out(v * 0.4, pan);
    this._tone(o, { dur: 0.08, vol: 0.4, freq: 3200, freqEnd: 2600, type: 'triangle' });
    this._noise(o, { t: 0.12, dur: 0.05, vol: 0.4, type: 'bandpass', freq: 1500, q: 3 });
  }
  s_bounce(v, pan) { const o = this._out(v * 0.3, pan); this._tone(o, { dur: 0.06, vol: 0.4, freq: 600, freqEnd: 400, type: 'triangle' }); }
  s_knife(v, pan) {
    const o = this._out(v * 0.5, pan, 0.1);
    this._noise(o, { dur: 0.15, vol: 0.8, type: 'highpass', freq: 3000, freqEnd: 6000, attack: 0.03 });
    this._noise(o, { t: 0.12, dur: 0.1, vol: 0.8, type: 'lowpass', freq: 700 });
  }
  s_ui(v) { const o = this._out(v * 0.25, 0); this._tone(o, { dur: 0.05, vol: 0.5, freq: 1300, type: 'triangle' }); }
  s_uiconfirm(v) {
    const o = this._out(v * 0.3, 0, 0.3);
    this._tone(o, { dur: 0.08, vol: 0.5, freq: 880, type: 'triangle' });
    this._tone(o, { t: 0.07, dur: 0.18, vol: 0.5, freq: 1320, type: 'triangle' });
  }
  s_uiback(v) { const o = this._out(v * 0.25, 0); this._tone(o, { dur: 0.1, vol: 0.5, freq: 700, freqEnd: 420, type: 'triangle' }); }
  s_radio(v) {
    const o = this._out(v * 0.35, 0);
    this._noise(o, { dur: 0.12, vol: 0.6, type: 'bandpass', freq: 2200, q: 2 });
    this._tone(o, { t: 0.02, dur: 0.06, vol: 0.25, freq: 1800, type: 'square' });
  }
  s_objective(v) {
    const o = this._out(v * 0.35, 0, 0.5);
    this._tone(o, { dur: 0.25, vol: 0.4, freq: 587, type: 'triangle' });
    this._tone(o, { t: 0.12, dur: 0.25, vol: 0.4, freq: 880, type: 'triangle' });
    this._tone(o, { t: 0.24, dur: 0.5, vol: 0.4, freq: 1175, type: 'triangle' });
  }
  s_alarm(v) {
    const o = this._out(v * 0.25, 0, 0.5);
    for (let i = 0; i < 3; i++) {
      this._tone(o, { t: i * 0.6, dur: 0.3, vol: 0.4, freq: 660, freqEnd: 880, type: 'square', attack: 0.02 });
      this._tone(o, { t: i * 0.6 + 0.3, dur: 0.3, vol: 0.4, freq: 880, freqEnd: 660, type: 'square', attack: 0.02 });
    }
  }
  s_slowmo(v) {
    const o = this._out(v * 0.6, 0, 0.8);
    this._noise(o, { dur: 1.2, vol: 0.8, type: 'lowpass', freq: 3000, freqEnd: 100, attack: 0.05 });
    this._tone(o, { dur: 1.2, vol: 0.6, freq: 220, freqEnd: 40, type: 'sawtooth' });
  }
  s_heartbeat(v) {
    const o = this._out(v * 0.6, 0);
    this._tone(o, { dur: 0.12, vol: 0.8, freq: 60, freqEnd: 40 });
    this._tone(o, { t: 0.22, dur: 0.12, vol: 0.6, freq: 55, freqEnd: 38 });
  }
  s_hack(v) {
    const o = this._out(v * 0.15, 0);
    this._tone(o, { dur: 0.04, vol: 0.5, freq: 900 + Math.random() * 1400, type: 'square' });
  }
  s_beep(v, pan) { const o = this._out(v * 0.3, pan); this._tone(o, { dur: 0.08, vol: 0.5, freq: 1800, type: 'square' }); }
  s_door(v, pan) {
    const o = this._out(v * 0.7, pan, 0.6);
    this._noise(o, { dur: 0.4, vol: 1, type: 'lowpass', freq: 1200, freqEnd: 100, brown: true });
    this._tone(o, { dur: 0.2, vol: 0.6, freq: 90, freqEnd: 40 });
  }
  s_flak(v, pan) {
    const o = this._out(v * 0.6, pan, 0.7);
    this._noise(o, { dur: 0.4, vol: 1, type: 'lowpass', freq: 2500, freqEnd: 200 });
    this._tone(o, { dur: 0.2, vol: 0.5, freq: 120, freqEnd: 40 });
  }
  s_warning(v) {
    const o = this._out(v * 0.25, 0);
    this._tone(o, { dur: 0.12, vol: 0.5, freq: 1400, type: 'square' });
    this._tone(o, { t: 0.16, dur: 0.12, vol: 0.5, freq: 1400, type: 'square' });
  }
  s_incoming(v, pan) {
    const o = this._out(v * 0.45, pan, 0.6);
    this._tone(o, { dur: 1.1, vol: 0.35, freq: 2400, freqEnd: 500, type: 'sine', attack: 0.3 });
  }
  s_rotorstart(v) { const o = this._out(v * 0.4, 0, 0.3); this._noise(o, { dur: 1.5, vol: 0.6, type: 'lowpass', freq: 200, freqEnd: 600, attack: 0.5, brown: true }); }

  // Looping helicopter rotor / engine. Returns handle {setVol(v), setPan(p), stop()}
  loop(id, kind = 'rotor', vol = 0.5) {
    if (!this.ready) return null;
    if (this.loops.has(id)) return this.loops.get(id);
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    const src = ctx.createBufferSource(); src.buffer = this.brown; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'rotor' ? 380 : 260;
    const am = ctx.createGain(); am.gain.value = 0.55;
    const lfo = ctx.createOscillator(); lfo.frequency.value = kind === 'rotor' ? 15 : kind === 'engine' ? 32 : 40;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = kind === 'rotor' ? 0.45 : 0.2;
    lfo.connect(lfoGain); lfoGain.connect(am.gain);
    src.connect(f); f.connect(am); am.connect(g);
    src.start(); lfo.start();
    let extra = null;
    if (kind === 'rotor') {
      extra = ctx.createOscillator(); extra.type = 'sawtooth'; extra.frequency.value = 58;
      const eg = ctx.createGain(); eg.gain.value = 0.05; const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 220;
      extra.connect(ef); ef.connect(eg); eg.connect(am); extra.start();
    }
    const t = ctx.currentTime; g.gain.setTargetAtTime(vol, t, 0.4);
    const handle = {
      setVol: (v) => { try { g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.15); } catch (e) {} },
      setPan: (pp) => { if (p) try { p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pp)), ctx.currentTime, 0.1); } catch (e) {} },
      stop: () => {
        try {
          g.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
          setTimeout(() => { try { src.stop(); lfo.stop(); if (extra) extra.stop(); g.disconnect(); } catch (e) {} }, 1500);
        } catch (e) {}
        this.loops.delete(id);
      },
    };
    this.loops.set(id, handle);
    return handle;
  }

  loopSample(id, group, vol = 0.5) {
    if (!this.ready) return null;
    if (this.loops.has(id)) return this.loops.get(id);
    const list = this.samples[group]; if (!list || !list.length) return null;
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    const src = ctx.createBufferSource(); src.buffer = list[0]; src.loop = true; src.connect(g); src.start();
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.8);
    const handle = {
      setVol: (v) => { try { g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.2); } catch (e) {} },
      setPan: (pp) => { if (p) try { p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pp)), ctx.currentTime, 0.1); } catch (e) {} },
      setRate: (r) => { try { src.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.2); } catch (e) {} },
      stop: () => { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { try { src.stop(); g.disconnect(); } catch (e) {} }, 2000); } catch (e) {} this.loops.delete(id); },
    };
    this.loops.set(id, handle);
    return handle;
  }

  stopLoop(id) { const h = this.loops.get(id); if (h) h.stop(); }
  stopAllLoops() { for (const h of [...this.loops.values()]) h.stop(); }
}

export const AudioEngine = new AudioEngineImpl();
