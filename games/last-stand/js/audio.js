'use strict';
/* ===== synthesized sound effects + original chiptune-rock music ===== */
const Snd = {
  ac: null, master: null, sfx: null, mus: null, noiseBuf: null, last: {},
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.connect(this.ac.destination);
      const comp = this.ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(this.master);
      this.sfx = this.ac.createGain(); this.sfx.gain.value = .9; this.sfx.connect(comp);
      this.mus = this.ac.createGain(); this.mus.gain.value = .32; this.mus.connect(comp);
      const n = this.ac.sampleRate * 1.2, b = this.ac.createBuffer(1, n, this.ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
      this.setVol(Save.d.settings.vol);
    } catch (e) { this.ac = null; }
  },
  setVol(v) { if (this.master) this.master.gain.value = v; },
  tone(dur, o) {
    const a = this.ac; if (!a) return; const t = a.currentTime + (o.at || 0), os = a.createOscillator(), g = a.createGain();
    os.type = o.type || 'square'; os.frequency.setValueAtTime(o.f, t); if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.g || .2, t + (o.a || .004)); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    let last = g; if (o.lp) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); last = f; }
    os.connect(g); last.connect(o.bus || this.sfx); os.start(t); os.stop(t + dur + .02);
  },
  noise(dur, o) {
    const a = this.ac; if (!a) return; const t = a.currentTime + (o.at || 0), s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    s.buffer = this.noiseBuf; s.playbackRate.value = o.rate || 1; f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 2000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q || 1;
    g.gain.setValueAtTime(o.g || .3, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(o.bus || this.sfx); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  },
  play(n, vol) {
    if (!this.ac) return; const now = this.ac.currentTime; if (this.last[n] && now - this.last[n] < .03) return; this.last[n] = now;
    const f = this.S[n]; if (f) f.call(this, vol == null ? 1 : vol);
  },
  S: {
    rifle(v) { this.noise(.09, { f: 3200, f2: 500, g: .34 * v }); this.tone(.07, { f: 190, f2: 70, g: .18 * v }); },
    shotgun(v) { this.noise(.32, { f: 1800, f2: 200, g: .55 * v }); this.tone(.18, { f: 110, f2: 40, g: .35 * v, type: 'sawtooth' }); this.noise(.06, { f: 900, type: 'bandpass', g: .2, at: .22 }); },
    laser(v) { this.tone(.16, { f: 1400, f2: 260, g: .16 * v, type: 'sawtooth' }); this.tone(.12, { f: 2100, f2: 900, g: .07 * v, type: 'sine' }); },
    rocket(v) { this.noise(.5, { f: 900, f2: 160, g: .38 * v }); this.tone(.4, { f: 220, f2: 60, g: .16 * v, type: 'sawtooth' }); },
    flame(v) { this.noise(.14, { f: 700, f2: 300, g: .22 * v, rate: .6 }); },
    minigun(v) { this.noise(.05, { f: 4200, f2: 900, g: .26 * v }); this.tone(.04, { f: 260, f2: 120, g: .1 * v }); },
    plasma(v) { this.tone(.5, { f: 120, f2: 900, g: .3 * v, type: 'sawtooth', lp: 3000 }); this.tone(.45, { f: 60, f2: 30, g: .35 * v, type: 'sine' }); this.noise(.3, { f: 2400, f2: 300, g: .2 * v }); },
    charge(v) { this.tone(.12, { f: 300 + v * 600, f2: 340 + v * 700, g: .05, type: 'sine' }); },
    enemyShot(v) { this.noise(.07, { f: 2200, f2: 500, g: .16 * v }); this.tone(.06, { f: 320, f2: 120, g: .08 * v }); },
    eLaser(v) { this.tone(.2, { f: 900, f2: 300, g: .1 * v, type: 'sawtooth' }); },
    boom(v) { this.noise(.9, { f: 1200, f2: 60, g: .7 * v }); this.tone(.6, { f: 90, f2: 28, g: .55 * v, type: 'sine' }); },
    bigBoom(v) { this.noise(1.6, { f: 900, f2: 40, g: .9 * v, rate: .7 }); this.tone(1.2, { f: 70, f2: 20, g: .7 * v, type: 'sine' }); this.noise(.4, { f: 4000, f2: 600, g: .3 * v, at: .05 }); },
    hit(v) { this.noise(.05, { f: 1600, type: 'bandpass', g: .25 * v }); this.tone(.05, { f: 520, f2: 200, g: .08 * v }); },
    clang(v) { this.tone(.18, { f: 1800, f2: 1500, g: .12 * v, type: 'triangle' }); this.tone(.22, { f: 2600, f2: 2300, g: .06 * v, type: 'sine' }); },
    die(v) { this.noise(.25, { f: 900, f2: 200, g: .3 * v }); this.tone(.25, { f: 300, f2: 80, g: .14 * v, type: 'sawtooth' }); },
    robotDie(v) { this.tone(.4, { f: 900, f2: 60, g: .16 * v, type: 'square' }); this.noise(.4, { f: 2000, f2: 200, g: .3 * v }); },
    jump(v) { this.tone(.12, { f: 260, f2: 520, g: .08 * v }); },
    djump(v) { this.tone(.14, { f: 400, f2: 900, g: .08 * v, type: 'triangle' }); this.noise(.12, { f: 3000, type: 'highpass', g: .08 }); },
    land(v) { this.noise(.08, { f: 400, g: .18 * v }); },
    hurt(v) { this.tone(.22, { f: 300, f2: 90, g: .22 * v, type: 'sawtooth' }); this.noise(.12, { f: 1200, g: .2 * v }); },
    pickup(v) { [0, .06, .12].forEach((a, i) => this.tone(.12, { f: [660, 880, 1320][i], g: .12, at: a, type: 'square' })); },
    weapon(v) { [0, .07, .14, .21].forEach((a, i) => this.tone(.14, { f: [440, 554, 659, 880][i], g: .13, at: a, type: 'sawtooth', lp: 3200 })); },
    heal(v) { [0, .08].forEach((a, i) => this.tone(.2, { f: [523, 784][i], g: .12, at: a, type: 'triangle' })); },
    life(v) { [0, .1, .2, .3, .4].forEach((a, i) => this.tone(.18, { f: [523, 659, 784, 1046, 1318][i], g: .13, at: a, type: 'square' })); },
    swap(v) { this.tone(.06, { f: 900, g: .08 }); this.noise(.06, { f: 3000, type: 'highpass', g: .1, at: .04 }); },
    empty(v) { this.tone(.05, { f: 1200, g: .05, type: 'triangle' }); },
    throw(v) { this.noise(.18, { f: 900, f2: 2600, type: 'bandpass', g: .14 }); },
    bounce(v) { this.tone(.05, { f: 700, g: .06 * v, type: 'triangle' }); },
    warn(v) { [0, .3, .6].forEach(a => { this.tone(.24, { f: 440, f2: 430, g: .14, at: a, type: 'square' }); this.tone(.24, { f: 660, f2: 650, g: .09, at: a + .12, type: 'square' }); }); },
    alarm(v) { this.tone(.5, { f: 520, f2: 780, g: .09 * v, type: 'sawtooth' }); },
    tele(v) { this.tone(.35, { f: 160, f2: 640, g: .1 * v, type: 'sawtooth', lp: 1800 }); },
    special(v) { this.tone(1.2, { f: 80, f2: 1600, g: .25, type: 'sawtooth', lp: 4000 }); this.noise(1.2, { f: 300, f2: 6000, g: .25 }); },
    ui(v) { this.tone(.05, { f: 880, g: .07 }); },
    uiOk(v) { this.tone(.08, { f: 660, g: .09 }); this.tone(.1, { f: 990, g: .09, at: .06 }); },
    checkpoint(v) { [0, .1, .2].forEach((a, i) => this.tone(.25, { f: [392, 523, 659][i], g: .12, at: a, type: 'triangle' })); },
    clear(v) { [0, .14, .28, .42, .7].forEach((a, i) => this.tone(.35, { f: [523, 659, 784, 1046, 1046][i], g: .14, at: a, type: 'square', lp: 4000 })); },
    shield(v) { this.tone(.12, { f: 1400, f2: 900, g: .1, type: 'triangle' }); },
    step(v) { this.noise(.03, { f: 600, g: .05 * v }); },
    crack(v) { this.noise(.2, { f: 3000, f2: 800, type: 'bandpass', g: .2 * v }); },
    thunder(v) { this.noise(2.4, { f: 400, f2: 60, g: .4 * v, rate: .5 }); }
  }
};

/* ---------- ambience: a filtered noise bed per environment ---------- */
const Amb = {
  src: null, g: null, f: null, cur: null,
  set(id) {
    const a = Snd.ac; if (!a || this.cur === id) return; this.cur = id;
    if (!this.src) { this.src = a.createBufferSource(); this.src.buffer = Snd.noiseBuf; this.src.loop = true; this.f = a.createBiquadFilter(); this.g = a.createGain(); this.g.gain.value = 0; this.src.connect(this.f); this.f.connect(this.g); this.g.connect(Snd.sfx); this.src.start(); }
    const P = { jungle: ['bandpass', 2600, .5, .06], desert: ['bandpass', 600, .7, .07], factory: ['lowpass', 180, 1, .12], frozen: ['highpass', 1800, .4, .05], fortress: ['lowpass', 260, 1, .1] }[id] || ['lowpass', 100, 1, 0];
    this.f.type = P[0]; this.f.frequency.setTargetAtTime(P[1], a.currentTime, .3); this.f.Q.value = P[2]; this.g.gain.setTargetAtTime(P[3], a.currentTime, .6);
  },
  off() { if (this.g && Snd.ac) this.g.gain.setTargetAtTime(0, Snd.ac.currentTime, .3); this.cur = null; }
};

/* ---------- music: per-level original patterns (bass, lead, drums) ---------- */
const Music = {
  on: false, track: -1, step: 0, nextT: 0, tm: null, intensity: 1,
  // scale degrees relative to root; each song: tempo, root midi, bass pattern, lead pattern (0 = rest), chord roots per bar
  SONGS: [
    { bpm: 150, root: 45, bars: [0, 0, 5, 3], bass: [0, 0, 12, 0, 0, 12, 0, 7], lead: [12, 0, 15, 0, 17, 15, 12, 0, 10, 0, 12, 0, 7, 0, 10, 0], hat: 1 }, // title
    { bpm: 156, root: 40, bars: [0, 0, -2, 3], bass: [0, 0, 12, 0, 7, 0, 12, 10], lead: [12, 0, 12, 15, 0, 17, 15, 12, 19, 0, 17, 0, 15, 12, 10, 12], hat: 1 }, // jungle
    { bpm: 144, root: 38, bars: [0, 1, 0, -2], bass: [0, 0, 0, 12, 0, 0, 13, 12], lead: [12, 13, 16, 0, 13, 12, 0, 0, 16, 17, 16, 13, 12, 0, 8, 0], hat: 2 }, // desert (phrygian)
    { bpm: 162, root: 36, bars: [0, 0, 3, 5], bass: [0, 12, 0, 12, 0, 12, 3, 5], lead: [0, 12, 0, 12, 15, 0, 12, 0, 0, 12, 0, 17, 15, 12, 10, 0], hat: 3 }, // industrial
    { bpm: 138, root: 42, bars: [0, -4, -2, -5], bass: [0, 0, 7, 0, 12, 0, 7, 0], lead: [19, 0, 17, 15, 0, 12, 0, 0, 15, 0, 14, 12, 0, 10, 0, 0], hat: 1 }, // frozen
    { bpm: 170, root: 38, bars: [0, 1, 3, -1], bass: [0, 0, 12, 0, 0, 12, 13, 12], lead: [12, 15, 0, 12, 16, 0, 15, 12, 19, 0, 18, 0, 16, 15, 13, 12], hat: 3 }, // fortress
    { bpm: 176, root: 40, bars: [0, 0, 1, 1], bass: [0, 12, 0, 12, 1, 13, 1, 13], lead: [12, 0, 13, 0, 12, 0, 18, 0, 12, 0, 13, 0, 19, 18, 13, 12], hat: 3 }  // boss
  ],
  play(i) { if (this.track === i && this.on) return; this.track = i; this.step = 0; this.on = true; if (Snd.ac) this.nextT = Snd.ac.currentTime + .05; if (!this.tm) this.tm = setInterval(() => this.tick(), 25); },
  stop() { this.on = false; this.track = -1; },
  note(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  tick() {
    const a = Snd.ac; if (!a || !this.on || !Save.d.settings.music) { if (a) this.nextT = a.currentTime + .05; return; }
    const S = this.SONGS[this.track] || this.SONGS[0], sp = 60 / S.bpm / 4;
    if (this.nextT < a.currentTime - .2) this.nextT = a.currentTime + .02;
    while (this.nextT < a.currentTime + .12) {
      const st = this.step, bar = Math.floor(st / 16) % 4, r = S.root + S.bars[bar], at = this.nextT - a.currentTime, bus = Snd.mus, inten = this.intensity;
      const b = S.bass[st % 8]; if (st % 2 === 0) Snd.tone(sp * 1.8, { f: this.note(r + b), g: .34, type: 'sawtooth', lp: 700, at, bus });
      const l = S.lead[st % 16]; if (l && inten > .4) Snd.tone(sp * 1.6, { f: this.note(r + 12 + l), g: .1, type: 'square', lp: 2600, at, bus });
      if (st % 4 === 0) { Snd.tone(.16, { f: 150, f2: 40, g: .55, type: 'sine', at, bus }); }
      if (st % 8 === 4) Snd.noise(.14, { f: 1800, type: 'bandpass', g: .32, at, bus, q: .7 });
      if (S.hat && (st % 2 === 1 || S.hat === 3)) Snd.noise(.03, { f: 7000, type: 'highpass', g: S.hat === 2 ? .05 : .08, at, bus });
      if (S.hat >= 2 && st % 16 === 14) Snd.noise(.1, { f: 1800, type: 'bandpass', g: .2, at, bus });
      if (st % 32 === 0) Snd.tone(sp * 14, { f: this.note(r + 24 + 7), g: .025, type: 'triangle', at, bus });
      this.nextT += sp; this.step++;
    }
  }
};
