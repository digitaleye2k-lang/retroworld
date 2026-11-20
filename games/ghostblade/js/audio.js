// GHOSTBLADE - audio: fully procedural Web Audio (sfx, generative music, ambience)
(function () {
  'use strict';
  const GB = window.GB = window.GB || {};

  // ---------- state ----------
  let ctx = null, dead = false;
  let master, comp, limiter, musicBus, stingBus, sfxBus, ambBus, reverbIn;
  let active = 0;                       // live one-shot groups
  const vols = { master: 0.8, music: 0.7, sfx: 0.9 };
  const lastFired = {};
  const buffers = {};
  const MUSIC_GAIN = 0.55, SFX_GAIN = 0.85, AMB_GAIN = 0.6;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const fq = f => clamp(f, 10, 20000);
  const ok = () => !!ctx && ctx.state === 'running';

  // ---------- noise buffers (cached) ----------
  function noiseBuf(color) {
    if (buffers[color]) return buffers[color];
    const len = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    if (color === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (color === 'pink') { // Paul Kellet
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else { // brown
      let l = 0;
      for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
    }
    // short crossfade so the loop point is seamless
    const xf = 2048;
    for (let i = 0; i < xf; i++) { const k = i / xf; d[len - xf + i] = d[len - xf + i] * (1 - k) + d[i] * k; }
    return (buffers[color] = buf);
  }

  function makeImpulse() {
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.8), buf = ctx.createBuffer(2, len, sr), pre = Math.floor(sr * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre);
        const v = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2);
        lp += (v - lp) * (1 - 0.88 * Math.min(1, t * 1.6)); // darker tail
        d[i] = lp;
      }
    }
    return buf;
  }

  // ---------- voice plumbing ----------
  function endGroup(c) {
    if (c.dead) return; c.dead = true;
    for (let i = 0; i < c.nodes.length; i++) { try { c.nodes[i].disconnect(); } catch (e) { } }
    if (!c.keep) active--;
  }
  function group(dest, vol, pan) {
    const g = ctx.createGain(); g.gain.value = vol;
    const nodes = [g]; let last = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); nodes.push(p); last = p; }
    last.connect(dest); active++;
    return { in: g, nodes, n: 0, t: ctx.currentTime, r: 1, keep: false, dead: false };
  }
  // context for music notes: writes straight into a persistent layer gain
  function mc(layer, t) { return { in: M.layers[layer].g, nodes: [], n: 0, t, r: 1, keep: true, dead: false }; }

  function track(c, src, nodes) {
    c.n++;
    src.onended = () => {
      try { src.disconnect(); } catch (e) { }
      for (let i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) { } }
      if (--c.n <= 0 && !c.keep) endGroup(c);
    };
  }
  function perc(p, t, a, peak, dur) { // percussive envelope
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01));
    return t + Math.max(dur, a + 0.01) + 0.03;
  }
  function asr(p, t, a, peak, dur, rel) { // sustained envelope
    const hold = Math.max(0, dur - a);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setValueAtTime(peak, t + a + hold);
    p.linearRampToValueAtTime(0, t + a + hold + rel);
    return t + a + hold + rel + 0.03;
  }
  // tone: f may be a number (optionally sweeping to f2) or [[time, freq], ...]
  function T(c, type, f, f2, dt, dur, vol, atk, dest, rel) {
    const t = c.t + dt, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    if (Array.isArray(f)) {
      o.frequency.setValueAtTime(fq(f[0][1] * c.r), t);
      for (let i = 1; i < f.length; i++) o.frequency.exponentialRampToValueAtTime(fq(f[i][1] * c.r), t + f[i][0]);
    } else {
      o.frequency.setValueAtTime(fq(f * c.r), t);
      if (f2) o.frequency.exponentialRampToValueAtTime(fq(f2 * c.r), t + dur);
    }
    const end = rel ? asr(g.gain, t, atk || 0.02, vol, dur, rel) : perc(g.gain, t, atk || 0.004, vol, dur);
    o.connect(g); g.connect(dest || c.in);
    o.start(t); o.stop(end);
    track(c, o, [g]);
    return o;
  }
  // filtered noise burst
  function N(c, color, ftype, f, f2, q, dt, dur, vol, atk, dest) {
    const t = c.t + dt, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    const b = noiseBuf(color); s.buffer = b; s.loop = true;
    fl.type = ftype; fl.Q.value = q || 0.7;
    fl.frequency.setValueAtTime(fq(f * c.r), t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(fq(f2 * c.r), t + dur);
    const end = perc(g.gain, t, atk || 0.003, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(dest || c.in);
    s.start(t, Math.random() * (b.duration - 0.2)); s.stop(end);
    track(c, s, [fl, g]);
  }
  // string voice: two detuned saws -> lowpass -> ASR
  function str(c, f, dt, dur, vol, atk, cut, rel, dest) {
    const t = c.t + dt, fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = 'lowpass'; fl.frequency.value = fq(cut); fl.Q.value = 0.6;
    const end = asr(g.gain, t, atk || 0.03, vol, dur, rel || 0.15);
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = fq(f * c.r); o.detune.value = i ? 8 : -8;
      o.connect(fl); o.start(t); o.stop(end);
      track(c, o, i ? [fl, g] : []);
    }
    fl.connect(g); g.connect(dest || c.in);
  }
  // lute/harp pluck: bright attack, filter closes quickly
  function pluck(c, f, dt, vol, len) {
    const t = c.t + dt, fl = ctx.createBiquadFilter(), g = ctx.createGain();
    len = len || 1.3; f *= c.r;
    fl.type = 'lowpass'; fl.Q.value = 1.2;
    fl.frequency.setValueAtTime(fq(f * 7), t);
    fl.frequency.exponentialRampToValueAtTime(fq(f * 1.4), t + 0.3);
    const end = perc(g.gain, t, 0.003, vol, len);
    const types = ['triangle', 'sawtooth'];
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = types[i];
      o.frequency.value = fq(f); og.gain.value = i ? 0.3 : 1; if (i) o.detune.value = 5;
      o.connect(og); og.connect(fl); o.start(t); o.stop(end);
      track(c, o, i ? [og, fl, g] : [og]);
    }
    fl.connect(g); g.connect(c.in);
  }
  function vib(c, o, rate, depth, dt, dur) {
    const t = c.t + dt, l = ctx.createOscillator(), g = ctx.createGain();
    l.frequency.value = rate; g.gain.value = depth * c.r;
    l.connect(g); g.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1);
    track(c, l, [g]);
  }
  function fx(c, type, f, q, gain) { // shared filter inside a group
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = fq(f * c.r); fl.Q.value = q || 0.7;
    c.nodes.push(fl);
    if (gain !== undefined) { const g = ctx.createGain(); g.gain.value = gain; fl.connect(g); g.connect(c.in); c.nodes.push(g); }
    else fl.connect(c.in);
    return fl;
  }
  function wet(c, amt) {
    const g = ctx.createGain(); g.gain.value = amt; c.in.connect(g); g.connect(reverbIn); c.nodes.push(g);
  }
  function metal(c, f, dt, dur, vol) {
    const R = [1, 1.41, 1.93, 2.57, 3.16, 4.33];
    for (let i = 0; i < R.length; i++) T(c, i % 2 ? 'triangle' : 'sine', f * R[i] * rand(0.995, 1.005), 0, dt, dur / (1 + i * 0.35), vol / (1 + i * 0.5), 0.002);
  }
  function bell(c, f, dt, dur, vol, dest) {
    const R = [0.5, 1, 1.19, 1.5, 2, 2.51, 3.01, 4.1], A = [0.45, 1, 0.5, 0.3, 0.6, 0.25, 0.18, 0.1];
    for (let i = 0; i < R.length; i++) T(c, 'sine', f * R[i], 0, dt, dur / Math.pow(R[i] * 2, 0.85), vol * A[i] * 0.4, 0.003, dest);
    N(c, 'pink', 'bandpass', f * 5, 0, 1, dt, 0.05, vol * 0.4, 0.002, dest);
  }
  function thud(c, dt, v, f) { // low body
    f = f || 90;
    T(c, 'sine', f, f * 0.45, dt, 0.22, 0.5 * v, 0.004);
    N(c, 'brown', 'lowpass', 420, 110, 0.7, dt, 0.16, 0.6 * v);
  }
  function taiko(c, dt, v) {
    T(c, 'sine', 125, 48, dt, 0.3, 0.7 * v, 0.003);
    N(c, 'brown', 'lowpass', 900, 150, 1, dt, 0.18, 0.55 * v);
    N(c, 'white', 'bandpass', 2400, 0, 1.5, dt, 0.02, 0.09 * v, 0.001);
  }
  function eagleCry(c, dt, v) {
    const f = fx(c, 'bandpass', 2700, 1.6);
    const pts = [[0, 3000], [0.08, 3450], [0.5, 2750], [0.95, 2050]];
    const o = T(c, 'sawtooth', pts, 0, dt, 0.95, 0.5 * v, 0.04, f, 0.1);
    vib(c, o, 27, 110, dt, 1.1);
    T(c, 'sine', pts, 0, dt, 0.95, 0.07 * v, 0.04, null, 0.1);
  }
  function thunderRoll(c, dt) {
    N(c, 'white', 'lowpass', 3200, 250, 0.5, dt, 0.4, 0.28, 0.005);
    N(c, 'brown', 'lowpass', 240, 60, 0.5, dt, 3.2, 0.9, 0.08);
    T(c, 'sine', 58, 30, dt + 0.02, 2.2, 0.4, 0.05);
    for (let i = 0; i < 5; i++) N(c, 'brown', 'lowpass', rand(300, 500), 80, 0.6, dt + rand(0.15, 1.9), rand(0.6, 1.2), rand(0.25, 0.5), 0.06);
    wet(c, 0.5);
  }

  // ---------- SFX ----------
  const SFX = Object.create(null);
  const TONAL = { uiMove: 1, uiSelect: 1, uiBack: 1, uiBuy: 1, uiDeny: 1, alertSuspicious: 1, alertSpotted: 1, alarmBell: 1, bell: 1, relic: 1, pickup: 1, heartbeat: 1 };

  SFX.step = c => { N(c, 'brown', 'lowpass', 520, 200, 0.7, 0, 0.07, 0.5); N(c, 'white', 'bandpass', 2500, 0, 1, 0, 0.03, 0.07); };
  SFX.stepWood = c => { T(c, 'sine', 185, 92, 0, 0.08, 0.3); N(c, 'pink', 'bandpass', 900, 0, 2, 0, 0.05, 0.25); };
  SFX.stepSoft = c => { N(c, 'brown', 'lowpass', 300, 150, 0.7, 0, 0.06, 0.2, 0.008); };
  SFX.jump = c => { N(c, 'pink', 'bandpass', 500, 1400, 1, 0, 0.14, 0.25, 0.03); T(c, 'sine', 150, 260, 0, 0.1, 0.08, 0.01); };
  SFX.land = c => { N(c, 'brown', 'lowpass', 420, 120, 0.7, 0, 0.12, 0.6); T(c, 'sine', 110, 55, 0, 0.12, 0.35); };
  SFX.landHard = c => { N(c, 'brown', 'lowpass', 650, 100, 0.7, 0, 0.26, 0.8); T(c, 'sine', 92, 38, 0, 0.3, 0.6); N(c, 'white', 'bandpass', 2000, 0, 1, 0, 0.05, 0.1); wet(c, 0.12); };
  SFX.roll = c => {
    N(c, 'pink', 'bandpass', 650, 300, 0.8, 0, 0.32, 0.3, 0.05);
    T(c, 'sine', 100, 60, 0.05, 0.07, 0.2); T(c, 'sine', 90, 55, 0.2, 0.07, 0.16);
  };
  SFX.slide = c => { N(c, 'pink', 'bandpass', 1800, 700, 0.7, 0, 0.45, 0.22, 0.04); N(c, 'brown', 'lowpass', 400, 0, 0.7, 0, 0.45, 0.2, 0.04); };
  SFX.vault = c => { N(c, 'pink', 'bandpass', 700, 1500, 1, 0, 0.13, 0.2, 0.02); T(c, 'sine', 165, 100, 0, 0.06, 0.25); N(c, 'pink', 'bandpass', 1300, 0, 1.5, 0, 0.03, 0.15); };
  SFX.grab = c => { T(c, 'sine', 200, 110, 0, 0.06, 0.3); N(c, 'pink', 'bandpass', 1500, 0, 1.5, 0, 0.04, 0.25); };
  SFX.climb = c => { N(c, 'pink', 'bandpass', 1100, 700, 1, 0, 0.12, 0.18, 0.02); N(c, 'brown', 'lowpass', 350, 0, 0.7, 0.03, 0.05, 0.2); };
  SFX.wallrun = c => {
    for (let i = 0; i < 2; i++) { N(c, 'pink', 'bandpass', 1400, 900, 1, i * 0.09, 0.05, 0.22); T(c, 'sine', 140, 90, i * 0.09, 0.05, 0.15); }
  };
  SFX.swing = c => {
    const f = fx(c, 'bandpass', 850, 6);
    T(c, 'sawtooth', [[0, 70], [0.15, 96], [0.36, 62]], 0, 0, 0.36, 0.4, 0.05, f, 0.08);
    N(c, 'pink', 'bandpass', 500, 0, 1, 0, 0.4, 0.05, 0.1);
  };
  SFX.ropeFire = c => {
    T(c, 'sine', 150, 60, 0, 0.1, 0.4); N(c, 'pink', 'bandpass', 900, 0, 2, 0, 0.03, 0.3);
    N(c, 'white', 'bandpass', 3000, 800, 1.2, 0.01, 0.26, 0.28, 0.01);
    T(c, 'triangle', 420, 180, 0.01, 0.18, 0.08);
  };
  SFX.cloak = c => { N(c, 'pink', 'bandpass', 400, 1300, 0.7, 0, 0.3, 0.3, 0.1); N(c, 'brown', 'lowpass', 500, 0, 0.7, 0, 0.25, 0.2, 0.08); };
  SFX.splash = c => {
    N(c, 'white', 'bandpass', 1300, 400, 0.6, 0, 0.5, 0.42, 0.01); N(c, 'white', 'highpass', 3000, 0, 0.7, 0.03, 0.35, 0.13, 0.03);
    T(c, 'sine', 120, 50, 0, 0.2, 0.35);
    for (let i = 0; i < 4; i++) { const f = rand(800, 1900); T(c, 'sine', f, f * 1.5, rand(0.18, 0.55), 0.05, 0.05); }
    wet(c, 0.15);
  };
  SFX.swim = c => { N(c, 'pink', 'bandpass', 500, 950, 0.8, 0, 0.35, 0.2, 0.12); const f = rand(600, 900); T(c, 'sine', f, f * 1.6, 0.18, 0.05, 0.04); };
  SFX.hayLand = c => { N(c, 'pink', 'bandpass', 2500, 1200, 0.5, 0, 0.35, 0.3, 0.01); N(c, 'brown', 'lowpass', 300, 0, 0.7, 0, 0.15, 0.5); N(c, 'white', 'highpass', 4000, 0, 0.7, 0.02, 0.2, 0.07, 0.02); };
  SFX.hide = c => { N(c, 'pink', 'bandpass', 2200, 1600, 0.6, 0, 0.22, 0.2, 0.05); N(c, 'white', 'highpass', 5000, 0, 0.7, 0.08, 0.12, 0.05, 0.02); };
  SFX.blade = c => {
    T(c, 'square', 800, 300, 0, 0.015, 0.08, 0.001);
    N(c, 'white', 'highpass', 5000, 0, 0.7, 0, 0.06, 0.2, 0.002);
    T(c, 'triangle', 2400, 3700, 0, 0.05, 0.1, 0.004);
    T(c, 'sine', 4200, 0, 0.03, 0.28, 0.06, 0.003); T(c, 'sine', 6130, 0, 0.03, 0.18, 0.03, 0.003);
  };
  SFX.stab = c => { N(c, 'brown', 'lowpass', 520, 150, 0.7, 0, 0.1, 0.6); T(c, 'sine', 130, 60, 0, 0.1, 0.35); N(c, 'pink', 'bandpass', 1800, 0, 1, 0, 0.04, 0.12); };
  SFX.assassinate = c => {
    SFX.blade(c);
    T(c, 'sine', 82, 34, 0.09, 0.38, 0.6); N(c, 'brown', 'lowpass', 320, 100, 0.7, 0.09, 0.3, 0.5); N(c, 'pink', 'bandpass', 1500, 0, 1, 0.09, 0.04, 0.12);
    wet(c, 0.25);
  };
  SFX.swordSwing = c => { N(c, 'white', 'bandpass', 900, 3300, 1.2, 0, 0.17, 0.3, 0.06); N(c, 'pink', 'bandpass', 500, 1200, 1, 0, 0.14, 0.12, 0.05); };
  SFX.swordHit = c => { N(c, 'brown', 'lowpass', 700, 200, 0.7, 0, 0.1, 0.5); N(c, 'white', 'bandpass', 2800, 0, 1, 0, 0.06, 0.2); T(c, 'sine', 150, 70, 0, 0.1, 0.3); T(c, 'sine', 2900, 0, 0, 0.12, 0.04); };
  SFX.clash = c => { metal(c, 1500, 0, 0.35, 0.15); N(c, 'white', 'highpass', 4000, 0, 0.7, 0, 0.04, 0.22, 0.001); T(c, 'sine', 180, 90, 0, 0.06, 0.2); wet(c, 0.15); };
  SFX.parry = c => { metal(c, 2100, 0, 0.9, 0.15); T(c, 'sine', 3150, 0, 0, 1.0, 0.045, 0.002); N(c, 'white', 'highpass', 6000, 0, 0.7, 0, 0.03, 0.18, 0.001); wet(c, 0.35); };
  SFX.hurt = c => {
    const f = fx(c, 'lowpass', 900, 1);
    T(c, 'sawtooth', 185, 90, 0, 0.18, 0.3, 0.005, f);
    N(c, 'brown', 'lowpass', 500, 150, 0.7, 0, 0.1, 0.5); T(c, 'sine', 90, 50, 0, 0.15, 0.3);
  };
  SFX.death = c => {
    const f = fx(c, 'lowpass', 700, 1);
    T(c, 'sawtooth', [[0, 165], [0.6, 55]], 0, 0, 0.6, 0.28, 0.02, f, 0.15);
    T(c, 'sine', 72, 30, 0.1, 0.8, 0.4); N(c, 'brown', 'lowpass', 300, 80, 0.7, 0.1, 0.5, 0.3);
    wet(c, 0.35);
  };
  SFX.guardDown = c => {
    N(c, 'brown', 'lowpass', 360, 100, 0.7, 0, 0.22, 0.7); T(c, 'sine', 86, 40, 0, 0.25, 0.5);
    N(c, 'white', 'bandpass', 3000, 0, 2, 0.12, 0.04, 0.1); metal(c, 1800, 0.13, 0.15, 0.035);
  };
  SFX.bodyDrop = c => { N(c, 'brown', 'lowpass', 300, 90, 0.7, 0, 0.2, 0.6); T(c, 'sine', 76, 38, 0, 0.2, 0.45); N(c, 'pink', 'bandpass', 1200, 0, 1, 0, 0.08, 0.1, 0.01); };
  SFX.bodyPickup = c => { N(c, 'pink', 'bandpass', 800, 1400, 0.8, 0, 0.25, 0.2, 0.08); T(c, 'sine', 90, 130, 0, 0.15, 0.15, 0.05); };
  SFX.throw = c => { N(c, 'white', 'bandpass', 1200, 4000, 1.5, 0, 0.14, 0.22, 0.04); };
  SFX.knifeHit = c => { T(c, 'sine', 220, 110, 0, 0.06, 0.3); N(c, 'white', 'bandpass', 3500, 0, 2, 0, 0.03, 0.2); N(c, 'brown', 'lowpass', 500, 0, 0.7, 0, 0.06, 0.3); T(c, 'triangle', 910, 880, 0.01, 0.16, 0.045); };
  SFX.arrowFire = c => { T(c, 'triangle', 225, 140, 0, 0.18, 0.25); T(c, 'sawtooth', 440, 300, 0, 0.05, 0.05); N(c, 'white', 'bandpass', 2000, 5000, 1, 0.01, 0.15, 0.15, 0.02); };
  SFX.arrowHit = c => { T(c, 'sine', 260, 120, 0, 0.07, 0.3); N(c, 'pink', 'bandpass', 1800, 0, 2, 0, 0.04, 0.25); T(c, 'triangle', 520, 480, 0.01, 0.13, 0.06); };
  SFX.coin = c => {
    const D = [0, 0.07, 0.16, 0.22, 0.33];
    for (let i = 0; i < D.length; i++) { const f = rand(3800, 5200); T(c, 'sine', f, 0, D[i], 0.13, 0.1 * (1 - i * 0.15), 0.001); T(c, 'sine', f * 1.52, 0, D[i], 0.07, 0.035, 0.001); }
    wet(c, 0.15);
  };
  SFX.smoke = c => { N(c, 'white', 'lowpass', 3200, 500, 0.5, 0, 0.75, 0.3, 0.02); N(c, 'brown', 'lowpass', 300, 0, 0.7, 0, 0.2, 0.5); T(c, 'sine', 100, 50, 0, 0.15, 0.3); };
  SFX.flash = c => {
    N(c, 'white', 'highpass', 1500, 0, 0.7, 0, 0.12, 0.45, 0.001); T(c, 'sine', 200, 50, 0, 0.2, 0.5, 0.002);
    N(c, 'white', 'bandpass', 4000, 1000, 0.8, 0.02, 0.4, 0.14); T(c, 'sine', 3200, 0, 0.02, 0.55, 0.035, 0.01);
    wet(c, 0.35);
  };
  SFX.dart = c => { N(c, 'white', 'bandpass', 3500, 1500, 1, 0, 0.07, 0.22, 0.005); T(c, 'sine', 500, 300, 0, 0.04, 0.05); };
  SFX.decoy = c => {
    const f = fx(c, 'bandpass', 2000, 2);
    let t = 0;
    for (let i = 0; i < 17; i++) {
      T(c, 'square', 900 + (i % 2) * 320, 0, t, 0.02, 0.12, 0.001, f);
      N(c, 'white', 'bandpass', 3600, 0, 3, t, 0.015, 0.09, 0.001);
      t += 0.045 + i * 0.002;
    }
    T(c, 'triangle', 300, 520, 0, 1.0, 0.025, 0.2);
  };
  SFX.glass = c => {
    N(c, 'white', 'highpass', 3500, 0, 0.7, 0, 0.1, 0.42, 0.001); N(c, 'white', 'bandpass', 6000, 0, 1, 0.03, 0.5, 0.14, 0.01);
    for (let i = 0; i < 9; i++) T(c, 'sine', rand(2500, 7500), 0, rand(0.02, 0.5), rand(0.06, 0.16), 0.05, 0.001);
    wet(c, 0.2);
  };
  SFX.door = c => {
    const f = fx(c, 'bandpass', 1100, 5);
    T(c, 'sawtooth', [[0, 55], [0.3, 82], [0.6, 62], [0.88, 96]], 0, 0, 0.88, 0.4, 0.1, f, 0.08);
    T(c, 'sawtooth', [[0, 83], [0.5, 112], [0.88, 90]], 0, 0, 0.88, 0.18, 0.15, f, 0.08);
    T(c, 'sine', 140, 80, 0.94, 0.07, 0.3); N(c, 'pink', 'bandpass', 1500, 0, 1.5, 0.94, 0.03, 0.15);
  };
  SFX.torchOut = c => { N(c, 'white', 'bandpass', 5000, 800, 0.6, 0, 0.45, 0.3, 0.01); N(c, 'brown', 'lowpass', 400, 0, 0.7, 0, 0.12, 0.3); T(c, 'sine', 120, 60, 0, 0.1, 0.15); };
  SFX.pickup = c => {
    const F = [1760, 2349.3, 2793.8];
    for (let i = 0; i < 3; i++) { T(c, 'sine', F[i], 0, i * 0.06, 0.22, 0.09, 0.002); T(c, 'triangle', F[i] / 2, 0, i * 0.06, 0.15, 0.05, 0.002); }
    N(c, 'white', 'highpass', 7000, 0, 0.7, 0, 0.05, 0.04); wet(c, 0.25);
  };
  SFX.relic = c => {
    const F = [587.3, 880, 1174.7, 1396.9, 1760, 2637];
    for (let i = 0; i < F.length; i++) { T(c, 'sine', F[i], 0, i * 0.07, 1.3, 0.07, 0.01); T(c, 'sine', F[i] * 1.004, 0, i * 0.07, 1.3, 0.05, 0.01); }
    N(c, 'white', 'bandpass', 8000, 0, 2, 0, 1.3, 0.03, 0.45); wet(c, 0.6);
  };
  SFX.poster = c => {
    N(c, 'white', 'bandpass', 2500, 4500, 0.8, 0, 0.28, 0.22, 0.02);
    for (let i = 0; i < 8; i++) N(c, 'white', 'highpass', rand(1800, 3000), 0, 0.7, i * 0.032 + rand(0, 0.01), 0.03, rand(0.1, 0.22), 0.002);
  };
  SFX.uiMove = c => { T(c, 'triangle', 587.3, 0, 0, 0.07, 0.12, 0.002); T(c, 'sine', 1174.7, 0, 0, 0.04, 0.04, 0.002); };
  SFX.uiSelect = c => { pluck(c, 587.3, 0, 0.16, 0.25); pluck(c, 880, 0.07, 0.16, 0.4); wet(c, 0.25); };
  SFX.uiBack = c => { pluck(c, 659.3, 0, 0.13, 0.2); pluck(c, 440, 0.06, 0.13, 0.3); wet(c, 0.15); };
  SFX.uiBuy = c => {
    for (let i = 0; i < 3; i++) { const f = rand(4000, 5000); T(c, 'sine', f, 0, i * 0.05, 0.1, 0.07, 0.001); }
    pluck(c, 880, 0.02, 0.12, 0.3); pluck(c, 1174.7, 0.09, 0.12, 0.3); pluck(c, 1760, 0.16, 0.12, 0.5); wet(c, 0.3);
  };
  SFX.uiDeny = c => { const f = fx(c, 'lowpass', 600, 1); T(c, 'square', 147, 0, 0, 0.12, 0.22, 0.005, f); T(c, 'square', 138.6, 0, 0.1, 0.16, 0.22, 0.005, f); };
  SFX.alertSuspicious = c => {
    T(c, 'triangle', 440, 0, 0, 0.13, 0.2, 0.01); T(c, 'sine', 880, 0, 0, 0.1, 0.05, 0.01);
    T(c, 'triangle', [[0, 587.3], [0.22, 668]], 0, 0.14, 0.26, 0.2, 0.015); T(c, 'sine', [[0, 1174.7], [0.22, 1336]], 0, 0.14, 0.2, 0.05, 0.015);
    wet(c, 0.3);
  };
  SFX.alertSpotted = c => {
    const f = fx(c, 'lowpass', 2600, 1);
    T(c, 'sawtooth', [[0, 440], [0.12, 1174.7]], 0, 0, 0.26, 0.2, 0.005, f);
    T(c, 'sawtooth', [[0, 330], [0.12, 880]], 0, 0, 0.26, 0.12, 0.005, f);
    T(c, 'triangle', 1174.7, 0, 0.11, 0.3, 0.1, 0.005);
    N(c, 'white', 'highpass', 3000, 0, 0.7, 0, 0.03, 0.12, 0.001); T(c, 'sine', 110, 52, 0, 0.22, 0.4);
    wet(c, 0.3);
  };
  SFX.alarmBell = c => { for (let i = 0; i < 3; i++) bell(c, 233.1, i * 0.45, 1.8, 0.6); T(c, 'sine', 116.5, 0, 0, 1.6, 0.1, 0.01); wet(c, 0.4); };
  SFX.bell = c => { const f = fx(c, 'lowpass', 1900, 0.5); bell(c, 146.8, 0, 5, 0.55, f); wet(c, 0.7); };
  SFX.whistle = c => {
    const o = T(c, 'sine', [[0, 1500], [0.12, 2100], [0.3, 1900], [0.45, 2450]], 0, 0, 0.45, 0.14, 0.03, null, 0.06);
    vib(c, o, 6, 18, 0.1, 0.5);
    N(c, 'white', 'bandpass', 2000, 2400, 5, 0, 0.5, 0.05, 0.03); wet(c, 0.35);
  };
  SFX.guardShout = c => {
    const f1 = fx(c, 'bandpass', 680, 4), f2 = fx(c, 'bandpass', 1150, 5), f3 = fx(c, 'bandpass', 2500, 6, 0.35);
    const pts = [[0, 150], [0.05, 128], [0.22, 92]];
    for (const f of [f1, f2, f3]) T(c, 'sawtooth', pts, 0, 0, 0.2, 0.7, 0.012, f, 0.06);
    N(c, 'pink', 'bandpass', 1200, 700, 1, 0, 0.2, 0.08, 0.01); wet(c, 0.2);
  };
  SFX.scream = c => {
    const f1 = fx(c, 'bandpass', 1100, 3), f2 = fx(c, 'bandpass', 2800, 4, 0.5);
    const pts = [[0, 640], [0.12, 950], [0.5, 830], [0.75, 590]];
    for (const f of [f1, f2]) { const o = T(c, 'sawtooth', pts, 0, 0, 0.7, 0.4, 0.04, f, 0.1); vib(c, o, 7.5, 22, 0.15, 0.7); }
    N(c, 'pink', 'bandpass', 2400, 0, 1, 0, 0.6, 0.03, 0.05); wet(c, 0.35);
  };
  SFX.horse = c => {
    N(c, 'pink', 'bandpass', 320, 180, 1, 0, 0.3, 0.4, 0.03); N(c, 'white', 'bandpass', 2200, 1200, 1, 0, 0.26, 0.12, 0.02);
    T(c, 'sawtooth', 62, 45, 0, 0.25, 0.08, 0.03);
    for (let i = 0; i < 2; i++) { const d = 0.36 + i * 0.16; T(c, 'sine', 900, 480, d, 0.035, 0.15, 0.001); N(c, 'pink', 'bandpass', 1400, 0, 3, d, 0.045, 0.3, 0.001); }
  };
  SFX.bird = c => {
    const n = 2 + Math.floor(Math.random() * 3), b = rand(2800, 4200); let t = 0;
    for (let i = 0; i < n; i++) { const f = b * rand(0.9, 1.15); T(c, 'sine', [[0, f], [0.04, f * 1.3], [0.08, f * 0.9]], 0, t, 0.09, 0.09, 0.01); t += rand(0.09, 0.17); }
    wet(c, 0.3);
  };
  SFX.eagle = c => { eagleCry(c, 0, 1); wet(c, 0.6); };
  SFX.thunder = c => { thunderRoll(c, 0); };
  SFX.heartbeat = c => { T(c, 'sine', 62, 40, 0, 0.14, 0.6, 0.008); N(c, 'brown', 'lowpass', 130, 0, 0.7, 0, 0.1, 0.4, 0.008); T(c, 'sine', 52, 36, 0.22, 0.16, 0.45, 0.008); N(c, 'brown', 'lowpass', 110, 0, 0.7, 0.22, 0.1, 0.3, 0.008); };
  // ambience-only one-shots
  SFX._cricket = c => { const f = 4300; for (let i = 0; i < 3; i++) T(c, 'sine', f, 0, i * 0.055, 0.035, 0.07, 0.006); T(c, 'sine', f * 1.5, 0, 0, 0.03, 0.015, 0.006); };
  SFX._owl = c => { T(c, 'sine', [[0, 370], [0.1, 400], [0.25, 355]], 0, 0, 0.22, 0.12, 0.05, null, 0.08); T(c, 'sine', [[0, 380], [0.1, 395], [0.5, 340]], 0, 0.42, 0.45, 0.12, 0.05, null, 0.15); wet(c, 0.6); };
  SFX._bells = c => { const f = fx(c, 'lowpass', 1700, 0.5), n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) bell(c, 146.8, i * 2.3, 5, 0.5, f); wet(c, 0.8); };

  // ---------- stingers ----------
  const STING = Object.create(null);
  STING.spotted = c => {
    T(c, 'sine', 105, 40, 0, 0.55, 0.7, 0.003); N(c, 'white', 'bandpass', 3000, 500, 0.8, 0, 0.25, 0.25, 0.002);
    for (const f of [146.8, 293.7, 311.1, 440, 622.3]) str(c, f, 0, 0.14, 0.09, 0.008, 3200, 0.5);
    T(c, 'sawtooth', [[0, 587.3], [0.3, 1244.5]], 0, 0.02, 0.3, 0.035, 0.05, null, 0.3);
    wet(c, 0.45);
  };
  STING.kill = c => {
    T(c, 'sine', 72, 30, 0, 0.9, 0.7, 0.004); N(c, 'brown', 'lowpass', 220, 70, 0.7, 0, 0.5, 0.5);
    for (const f of [73.4, 110, 146.8, 174.6]) str(c, f, 0.02, 0.12, 0.1, 0.01, 1500, 0.35);
    wet(c, 0.45);
  };
  STING.sync = c => {
    const A = [[73.4, 0.12], [110, 0.1], [146.8, 0.09], [220, 0.08], [293.7, 0.07], [370, 0.06], [440, 0.05], [587.3, 0.04]];
    for (let i = 0; i < A.length; i++) str(c, A[i][0], i * 0.12, 3.0 - i * 0.12, A[i][1], 1.9, 700 + i * 260, 1.2);
    T(c, 'sine', 36.7, 0, 0, 3.0, 0.3, 1.8, null, 1.0);
    N(c, 'pink', 'bandpass', 400, 3200, 0.7, 0, 2.6, 0.14, 2.3);
    N(c, 'white', 'highpass', 5000, 0, 0.7, 2.1, 1.8, 0.07, 0.25);
    for (const f of [1174.7, 1480, 1760]) T(c, 'sine', f, 0, 2.1, 1.8, 0.03, 0.02);
    eagleCry(c, 1.5, 0.8);
    wet(c, 0.6);
  };
  STING.success = c => {
    const mel = [[293.7, 0, 0.14], [293.7, 0.2, 0.1], [440, 0.36, 0.28], [587.3, 0.72, 0.28], [523.3, 1.08, 0.16], [587.3, 1.3, 1.5]];
    for (const m of mel) { str(c, m[0], m[1], m[2], 0.1, 0.03, 2000, 0.14); str(c, m[0] * 2 / 3, m[1], m[2], 0.055, 0.03, 1500, 0.14); }
    for (const f of [73.4, 146.8, 220]) str(c, f, 1.3, 1.5, 0.07, 0.06, 1100, 0.6);
    str(c, 880, 1.3, 1.5, 0.03, 0.3, 2400, 0.6);
    for (const d of [0, 0.36, 0.72, 1.3]) taiko(c, d, d === 1.3 ? 0.8 : 0.5);
    N(c, 'white', 'highpass', 6000, 0, 0.7, 1.3, 1.4, 0.05, 0.01);
    wet(c, 0.45);
  };
  STING.fail = c => {
    const mel = [[220, 0], [174.6, 0.4], [146.8, 0.8], [116.5, 1.2]];
    for (let i = 0; i < 4; i++) { const last = i === 3; str(c, mel[i][0], mel[i][1], last ? 1.6 : 0.36, 0.11, 0.06, 1000 - i * 120, last ? 1.2 : 0.2); str(c, mel[i][0] / 2, mel[i][1], last ? 1.6 : 0.36, 0.08, 0.06, 700, last ? 1.2 : 0.2); }
    str(c, 77.8, 1.25, 1.4, 0.05, 0.5, 600, 1.2);
    T(c, 'sine', 58, 34, 1.2, 2.2, 0.45, 0.02); N(c, 'brown', 'lowpass', 200, 60, 0.7, 1.2, 1.2, 0.35, 0.01);
    wet(c, 0.5);
  };
  STING.objective = c => {
    const F = [880, 1174.7];
    for (let i = 0; i < 2; i++) { const d = i * 0.17; T(c, 'sine', F[i], 0, d, 1.1, 0.12, 0.004); T(c, 'sine', F[i] * 2, 0, d, 0.6, 0.03, 0.004); T(c, 'sine', F[i] * 3.01, 0, d, 0.3, 0.014, 0.004); }
    wet(c, 0.5);
  };
  STING.thunder = c => { thunderRoll(c, 0); };

  function play(table, name, dest, vol, pan, rate, vary) {
    const fn = table[name]; if (!fn || active > 44) return;
    const c = group(dest, vol, pan);
    c.r = rate * (vary ? rand(0.96, 1.04) : 1); c.t = ctx.currentTime + 0.004;
    try { fn(c); } catch (e) { }
    if (c.n === 0) endGroup(c);
  }

  // ---------- music ----------
  const LAYERS = ['pad', 'pluck', 'lead', 'drone', 'harm', 'tick', 'ost', 'stab', 'perc', 'bass'];
  const SENDS = { pad: 0.5, pluck: 0.5, lead: 0.6, drone: 0.2, harm: 0.85, tick: 0.3, ost: 0.2, stab: 0.25, perc: 0.22, bass: 0.05 };
  const MOODS = {
    menu: { bpm: 60, g: { pad: 0.85, lead: 0.8 } },
    explore: { bpm: 72, g: { pad: 0.7, pluck: 0.85 } },
    stealth: { bpm: 60, g: { drone: 0.75, harm: 0.7, tick: 0.6 } },
    suspicious: { bpm: 80, g: { drone: 0.75, harm: 0.45, tick: 0.7, ost: 0.8 } },
    detected: { bpm: 132, g: { drone: 0.3, perc: 0.85, stab: 0.75 } },
    combat: { bpm: 144, g: { drone: 0.3, perc: 1, stab: 0.8, bass: 0.9 } },
    silent: { bpm: 0, g: {} }
  };
  // D minor / dorian voicings: [bass, n1, n2, n3]
  const CH = {
    i: [50, 57, 62, 65], VII: [48, 55, 60, 64], IV: [43, 55, 59, 62],
    III: [41, 53, 57, 60], v: [45, 52, 57, 60], VI: [46, 53, 58, 62]
  };
  const PROG_CALM = [CH.i, CH.VII, CH.i, CH.IV, CH.i, CH.III, CH.VII, CH.v];
  const PROG_TENSE = [CH.i, CH.i, CH.VI, CH.VII, CH.i, CH.i, CH.VI, CH.v];
  const DORIAN = []; // D dorian, A3..F5
  for (let m = 57; m <= 77; m++) if ([0, 2, 3, 5, 7, 9, 10].indexOf((m - 50) % 12) >= 0) DORIAN.push(m);
  const STAB_PAT = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
  const TAIKO_PAT = [1, 0, 0, 0.4, 0, 0, 0.7, 0, 1, 0, 0.4, 0.4, 0, 0.6, 0.5, 0.5];
  const OST_SEQ = [0, 0, 3, 0, 7, 0, 5, 3];

  const M = {
    mood: 'silent', layers: {}, lv: {}, tg: {}, bpm: 72, bpmT: 72,
    s: 0, bar: 0, next: 0, ci: -1, chord: CH.i, chordEnd: 0, padEnd: 0, arp: null, lead: 62
  };
  LAYERS.forEach(n => { M.lv[n] = 0; M.tg[n] = 0; });

  const on = n => M.lv[n] > 0.02 || M.tg[n] > 0;

  function applyLayerGains() {
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const n of LAYERS) {
      const p = M.layers[n].g.gain;
      p.cancelScheduledValues(now); p.setTargetAtTime(M.tg[n], now, 0.45);
    }
  }
  function genArp() {
    const a = []; let idx = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < 16; i++) {
      idx = clamp(idx + pick([-2, -1, -1, 1, 1, 2]), 0, 5);
      a.push(i === 0 || Math.random() < (i % 2 ? 0.4 : 0.62) ? idx : -1);
    }
    M.arp = a;
  }
  function nearestScale(m) { let b = 0; for (let i = 1; i < DORIAN.length; i++) if (Math.abs(DORIAN[i] - m) < Math.abs(DORIAN[b] - m)) b = i; return b; }

  function schedStep(t, sd) {
    const s = M.s, bar = M.bar, slow = M.bpm < 100;
    const tense = M.mood === 'detected' || M.mood === 'combat';
    let newChord = false;
    if (s === 0 && (slow || bar % 2 === 0 || M.ci < 0)) {
      M.ci++; M.chord = (tense ? PROG_TENSE : PROG_CALM)[M.ci % 8];
      M.chordEnd = t + sd * 16 * (slow ? 1 : 2); newChord = true;
    }
    const ch = M.chord;
    let c;

    if (on('pad') && (newChord || t >= M.padEnd)) {
      c = mc('pad', t);
      const len = Math.max(sd * 4, M.chordEnd - t); M.padEnd = t + len - 0.01;
      for (let i = 0; i < 4; i++) str(c, mtof(ch[i]), 0, len, i === 0 ? 0.06 : 0.045, 1.1, i === 0 ? 500 : 950, 2.0);
      T(c, 'sine', mtof(ch[0] - 12), 0, 0, len, 0.07, 1.2, null, 2.0);
    }
    if (on('pluck')) {
      c = mc('pluck', t);
      if (!M.arp || (s === 0 && bar % 4 === 0)) genArp();
      if (s % 2 === 0) {
        const v = M.arp[s / 2 + 8 * (bar % 2)];
        if (v >= 0) { const m = ch[1 + v % 3] + (v >= 3 ? 24 : 12); pluck(c, mtof(m), rand(0, 0.012), rand(0.1, 0.16)); }
      }
      if (s === 0 && bar % 2 === 0 && Math.random() < 0.6) { T(c, 'sine', 92, 46, 0, 0.45, 0.3, 0.006); N(c, 'brown', 'lowpass', 220, 90, 0.7, 0, 0.25, 0.25, 0.006); }
    }
    if (on('lead') && s % 8 === 0 && (s === 0 || Math.random() < 0.75)) {
      c = mc('lead', t);
      if (s === 0) { const opts = [ch[2], ch[3], ch[1] + 12, ch[2] + 12]; let b = opts[0]; for (const o of opts) if (Math.abs(o - M.lead) < Math.abs(b - M.lead) && o !== M.lead) b = o; M.lead = b; }
      else M.lead = DORIAN[clamp(nearestScale(M.lead) + pick([-2, -1, -1, 1, 1, 2]), 2, DORIAN.length - 1)];
      const f = mtof(M.lead + 12), len = sd * 7;
      const o = T(c, 'sine', f, 0, 0, len, 0.11, 0.14, null, 0.5); vib(c, o, 4.8, f * 0.005, 0.3, len + 0.4);
      T(c, 'triangle', f, 0, 0, len, 0.03, 0.14, null, 0.4);
      N(c, 'pink', 'bandpass', f * 2, 0, 3, 0, 0.25, 0.012, 0.06);
    }
    if (on('harm') && s === 0 && Math.random() < 0.6) {
      c = mc('harm', t);
      const f = mtof(pick([81, 86, 88, 84, 89, 93]));
      T(c, 'sine', f, 0, 0, 3.5, 0.05, 1.6, null, 2.2); T(c, 'sine', f * 1.003, 0, 0, 3.5, 0.035, 1.6, null, 2.2);
      T(c, 'triangle', f / 2, 0, 0, 3.0, 0.012, 1.8, null, 2.0);
    }
    if (on('tick')) {
      c = mc('tick', t);
      if (s === 0 || (s === 8 && Math.random() < 0.4)) { T(c, 'sine', 62, 40, 0, 0.22, s ? 0.16 : 0.26, 0.01); }
      if ((s % 4 === 2 && Math.random() < 0.6) || (s === 13 && Math.random() < 0.25)) N(c, 'white', 'bandpass', rand(4000, 5200), 0, 3, 0, 0.03, 0.06, 0.002);
    }
    if (on('ost') && s % 2 === 0) {
      c = mc('ost', t);
      const acc = s % 4 === 0;
      str(c, mtof(38 + OST_SEQ[s / 2]), 0, sd * 1.3, acc ? 0.22 : 0.14, 0.02, acc ? 800 : 520, 0.09);
    }
    if (on('stab') && STAB_PAT[s]) {
      c = mc('stab', t);
      if (s % 4 === 0) { for (let i = 1; i < 4; i++) str(c, mtof(ch[i]), 0, sd * 0.55, 0.075, 0.008, 2600, 0.07); str(c, mtof(ch[0]), 0, sd * 0.55, 0.08, 0.008, 1400, 0.07); }
      else str(c, mtof(ch[1 + (s % 3 === 0 ? 1 : 0)]), 0, sd * 0.5, 0.06, 0.008, 2000, 0.06);
    }
    if (on('perc')) {
      c = mc('perc', t);
      let v = TAIKO_PAT[s];
      if (bar % 4 === 3 && s >= 12) v = 0.55 + (s - 12) * 0.12;
      if (v) taiko(c, 0, v * 0.75);
      if (s % 4 === 2) N(c, 'white', 'bandpass', 5200, 0, 4, 0, 0.03, 0.07, 0.001);
    }
    if (on('bass')) {
      c = mc('bass', t);
      if (s % 2 === 0) {
        let m = ch[0]; if (m > 45) m -= 12;
        if (s === 6 || s === 14) m += 7; else if (s === 12) m += 10;
        str(c, mtof(m), 0, sd * 1.5, 0.2, 0.012, 430, 0.07); T(c, 'sine', mtof(m), 0, 0, sd * 1.5, 0.2, 0.012, null, 0.07);
      }
      if (s === 0 || (s === 8 && bar % 2 === 1)) { T(c, 'sine', 76, 30, 0, 0.6, s ? 0.45 : 0.7, 0.004); N(c, 'brown', 'lowpass', 320, 80, 0.7, 0, 0.4, s ? 0.3 : 0.5, 0.004); }
    }
  }

  function buildMusic() {
    for (const n of LAYERS) {
      const g = ctx.createGain(), send = ctx.createGain();
      g.gain.value = 0; send.gain.value = SENDS[n];
      g.connect(musicBus); g.connect(send); send.connect(reverbIn);
      M.layers[n] = { g, send };
    }
    // persistent drone (D)
    const fl = ctx.createBiquadFilter(), dg = ctx.createGain();
    fl.type = 'lowpass'; fl.frequency.value = 210; fl.Q.value = 1; dg.gain.value = 0.3;
    [[73.42, -6, 1], [73.42, 7, 1], [110, 0, 0.35]].forEach(d => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = d[0]; o.detune.value = d[1]; og.gain.value = d[2];
      o.connect(og); og.connect(fl); o.start();
    });
    const sub = ctx.createOscillator(), sg = ctx.createGain(); sub.frequency.value = 36.71; sg.gain.value = 0.3; sub.connect(sg); sg.connect(M.layers.drone.g); sub.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 70; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
    fl.connect(dg); dg.connect(M.layers.drone.g);
  }

  // ---------- ambience ----------
  const A = {
    cur: { rain: 0, wind: 0, night: 0, crowd: 0, indoor: 0, water: 0 },
    tgt: { rain: 0, wind: 0, night: 0, crowd: 0, indoor: 0, water: 0 },
    set: false, leap: 0, leapT: 0, time: 0,
    tBird: 3, tCricket: 1, tBell: rand(25, 60), tOwl: rand(12, 30), n: null
  };
  function loopSrc(color, rate) {
    const s = ctx.createBufferSource(), b = noiseBuf(color); s.buffer = b; s.loop = true; s.playbackRate.value = rate || 1;
    s.start(0, Math.random() * (b.duration - 0.2)); return s;
  }
  function biq(type, f, q) { const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7; return fl; }
  function gn(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function chain() { for (let i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); }
  function lfoTo(param, rate, depth) { const o = ctx.createOscillator(), g = gn(depth); o.frequency.value = rate; o.connect(g); g.connect(param); o.start(); }

  function buildAmbience() {
    const n = A.n = {};
    n.outF = biq('lowpass', 18000, 0.5); n.outG = gn(1); chain(n.outF, n.outG, ambBus);
    // rain
    n.rainG = gn(0); n.rainHP = biq('highpass', 1400, 0.5);
    chain(loopSrc('white'), n.rainHP, biq('lowpass', 8500, 0.5), n.rainG, n.outF);
    chain(loopSrc('pink', 0.9), biq('bandpass', 520, 0.5), gn(0.55), n.rainG);
    // wind
    n.windG = gn(0); n.windF = biq('bandpass', 400, 1.2); n.windF2 = biq('bandpass', 1100, 5);
    const ws = loopSrc('pink', 0.8);
    chain(ws, n.windF, n.windG, n.outF); chain(ws, n.windF2, gn(0.12), n.windG);
    // crowd murmur (not affected by indoor)
    n.crowdG = gn(0); const am = gn(0.55);
    chain(loopSrc('pink', 0.7), biq('bandpass', 430, 1.3), am, n.crowdG, ambBus);
    chain(loopSrc('brown', 1.3), biq('bandpass', 950, 1.6), gn(1.4), am);
    lfoTo(am.gain, 2.3, 0.2); lfoTo(am.gain, 3.7, 0.15); lfoTo(am.gain, 0.31, 0.12);
    // water
    n.waterG = gn(0); const wa = gn(0.6), wb = gn(0.07);
    chain(loopSrc('brown'), biq('lowpass', 650, 0.5), wa, n.waterG, n.outF);
    chain(loopSrc('white', 0.8), biq('bandpass', 2300, 1), wb, n.waterG);
    lfoTo(wa.gain, 0.22, 0.32); lfoTo(wb.gain, 0.31, 0.05);
    // leap of faith wind (direct to sfx bus)
    n.leapG = gn(0); n.leapF = biq('lowpass', 300, 0.8); n.leapF2 = biq('bandpass', 700, 3);
    const ls = loopSrc('pink', 1.3);
    chain(ls, n.leapF, n.leapG, sfxBus); chain(ls, n.leapF2, gn(0.35), n.leapG);
  }

  function updateAmbience(dt) {
    const n = A.n, c = A.cur, g = A.tgt;
    for (const k in c) c[k] = damp(c[k], g[k], 2.2, dt);
    A.time += dt; const t = A.time;
    n.outF.frequency.value = 18000 * Math.pow(550 / 18000, c.indoor);
    n.outG.gain.value = 1 - 0.6 * c.indoor;
    n.rainG.gain.value = Math.pow(c.rain, 1.2) * 0.5;
    n.rainHP.frequency.value = 1800 - 900 * c.rain;
    const gust = 0.65 + 0.25 * Math.sin(t * 0.37) + 0.15 * Math.sin(t * 0.83 + 1.3);
    n.windG.gain.value = c.wind * 0.5 * gust;
    n.windF.frequency.value = 280 + 420 * c.wind + 160 * Math.sin(t * 0.23);
    n.windF2.frequency.value = 900 + 500 * c.wind + 300 * Math.sin(t * 0.31 + 2);
    n.crowdG.gain.value = c.crowd * 0.42;
    n.waterG.gain.value = c.water * 0.45;
    A.leap = damp(A.leap, A.leapT, 7, dt);
    const lv = A.leap;
    n.leapG.gain.value = Math.pow(lv, 1.3) * 0.75;
    n.leapF.frequency.value = 300 * Math.pow(40, lv);
    n.leapF2.frequency.value = 500 + 1900 * lv + 120 * Math.sin(t * 9);

    if (!A.set) return;
    const out = 1 - 0.8 * c.indoor, day = 1 - c.night;
    if (day > 0.4 && c.rain < 0.6) {
      if ((A.tBird -= dt) <= 0) { A.tBird = rand(2.5, 8) / day; play(SFX, 'bird', n.outF, rand(0.25, 0.6) * day * out, rand(-0.8, 0.8), rand(0.85, 1.25), false); }
    }
    if (c.night > 0.3 && c.rain < 0.7) {
      if ((A.tCricket -= dt) <= 0) { A.tCricket = rand(0.25, 1.1); const i = Math.floor(Math.random() * 4); play(SFX, '_cricket', n.outF, 0.3 * c.night * out, [-0.7, -0.2, 0.4, 0.8][i], [1, 1.07, 0.94, 1.12][i], false); }
      if (c.night > 0.6 && (A.tOwl -= dt) <= 0) { A.tOwl = rand(18, 45); play(SFX, '_owl', n.outF, 0.35 * out, rand(-0.7, 0.7), rand(0.9, 1.1), false); }
    }
    if ((A.tBell -= dt) <= 0) { A.tBell = rand(55, 130); play(SFX, '_bells', n.outF, 0.3 * (0.4 + 0.6 * out), rand(-0.5, 0.5), 1, false); }
  }

  // ---------- graph ----------
  function applyVolumes() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(vols.master, now, 0.03);
    musicBus.gain.setTargetAtTime(vols.music * MUSIC_GAIN, now, 0.03);
    stingBus.gain.setTargetAtTime(vols.music * 0.8, now, 0.03);
    sfxBus.gain.setTargetAtTime(vols.sfx * SFX_GAIN, now, 0.03);
    ambBus.gain.setTargetAtTime(vols.sfx * AMB_GAIN, now, 0.03);
  }
  function build() {
    master = gn(vols.master);
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 14; comp.ratio.value = 5; comp.attack.value = 0.005; comp.release.value = 0.22;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
    chain(master, comp, limiter, ctx.destination);
    musicBus = gn(vols.music * MUSIC_GAIN); stingBus = gn(vols.music * 0.8); sfxBus = gn(vols.sfx * SFX_GAIN); ambBus = gn(vols.sfx * AMB_GAIN);
    if (window.RWSFX) { RWSFX.use(ctx, sfxBus); const all = []; Object.keys(REC).forEach(k => [].concat(REC[k][0]).forEach(x => all.indexOf(x) < 0 && all.push(x))); RWSFX.preload(all); }
    musicBus.connect(master); stingBus.connect(master); sfxBus.connect(master); ambBus.connect(master);
    reverbIn = gn(1);
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse();
    chain(reverbIn, conv, biq('highpass', 180, 0.5), gn(0.5), master);
    buildMusic(); buildAmbience(); applyLayerGains();
  }

  // ---------- public API ----------
  // real recorded foley from the shared RETRO WORLD library (assets/sfx); [names, vol, layerSynth]
  const REC = {
    swordSwing: [['sword_light', 'whoosh1'], .6], swing: [['whoosh1', 'whoosh2'], .45], swordHit: [['sword_slice', 'impact_wet'], .65], clash: [['sword_clash', 'sword_clash2'], .7],
    parry: [['sword_clash', 'sword_clash2'], .75, 1], stab: ['splat', .55], assassinate: [['splat', 'bone_snap'], .6, 1], knifeHit: ['impact_wet', .5], blade: ['sword_draw', .55],
    bodyDrop: ['impact_heavy', .55], bodyPickup: ['clothing', .5], guardDown: ['hit_muffled', .55, 1], land: [['land_dirt', 'land_grass'], .4], landHard: ['impact_heavy', .55],
    hayLand: ['land_grass', .6], stepWood: [['step_wood1', 'step_wood2', 'step_wood3', 'step_wood4'], .35], stepSoft: [['step_grass1', 'step_grass2', 'step_grass3', 'step_grass4'], .28],
    door: ['door_creak', .55], splash: [['splash', 'water_splash'], .55], coin: ['coin', .5], pickup: ['item_equip', .5], grab: ['clothing', .45], climb: [['clothing', 'wood_creak'], .3],
    throw: ['swipe', .45], roll: ['swipe', .35], arrowFire: ['whoosh2', .5, 1], arrowHit: ['wood_drop', .55], eagle: ['crow', .35, 1], torchOut: ['fire_light', .4, 1], relic: ['gem', .6, 1]
  };
  GB.audio = {
    init() {
      try {
        if (dead) return;
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) { dead = true; return; }
          ctx = new AC({ latencyHint: 'interactive' });
          if (window.RWSFX) RWSFX.use(ctx);
          try { build(); } catch (e) { dead = true; try { ctx.close(); } catch (e2) { } ctx = null; return; }
        }
        if (ctx.state !== 'running' && ctx.state !== 'closed') { const p = ctx.resume(); if (p && p.catch) p.catch(() => { }); }
      } catch (e) { dead = true; ctx = null; }
    },
    setVolume(master_, music, sfx) {
      vols.master = clamp(num(master_, vols.master), 0, 1);
      vols.music = clamp(num(music, vols.music), 0, 1);
      vols.sfx = clamp(num(sfx, vols.sfx), 0, 1);
      try { applyVolumes(); } catch (e) { }
    },
    sfx(name, opts) {
      try {
        if (!ok() || typeof name !== 'string' || name[0] === '_' || !SFX[name]) return;
        const now = performance.now();
        if (now - (lastFired[name] || -1e9) < 30) return;
        lastFired[name] = now;
        const o = opts || {};
        const rs = REC[name];
        if (rs && window.RWSFX) {
          const nm = Array.isArray(rs[0]) ? pick(rs[0]) : rs[0];
          if (RWSFX.play(nm, { vol: rs[1] * clamp(num(o.vol, 1), 0, 1), pan: num(o.pan, 0), rate: num(o.rate, 1), vary: .06, dest: sfxBus }) && !rs[2]) return;
        }
        play(SFX, name, sfxBus, clamp(num(o.vol, 1), 0, 1), clamp(num(o.pan, 0), -1, 1), clamp(num(o.rate, 1), 0.25, 4), !TONAL[name]);
      } catch (e) { }
    },
    setMood(mood) {
      try {
        const m = MOODS[mood];
        if (!m || mood === M.mood) return;
        let quiet = true; for (const n of LAYERS) if (M.lv[n] > 0.02) quiet = false;
        M.mood = mood;
        for (const n of LAYERS) M.tg[n] = m.g[n] || 0;
        if (m.bpm) M.bpmT = m.bpm;
        if (quiet && m.bpm) { M.bpm = m.bpm; M.s = 0; M.bar = 0; M.next = 0; M.padEnd = 0; }
        applyLayerGains();
      } catch (e) { }
    },
    setAmbience(obj) {
      if (!obj) return;
      for (const k in A.tgt) if (typeof obj[k] === 'number' && isFinite(obj[k])) A.tgt[k] = clamp(obj[k], 0, 1);
      A.set = true;
    },
    setLeapWind(v) { A.leapT = clamp(num(v, 0), 0, 1); },
    stinger(name) {
      try {
        if (!ok() || typeof name !== 'string' || !STING[name]) return;
        const key = '~' + name, now = performance.now();
        if (now - (lastFired[key] || -1e9) < 150) return;
        lastFired[key] = now;
        play(STING, name, name === 'thunder' ? sfxBus : stingBus, 1, 0, 1, false);
      } catch (e) { }
    },
    update(dt) {
      try {
        if (!ok()) return;
        dt = clamp(num(dt, 0.016), 0, 0.1);
        let any = false;
        for (const n of LAYERS) { M.lv[n] = damp(M.lv[n], M.tg[n], 2.2, dt); if (on(n)) any = true; }
        M.bpm = damp(M.bpm, M.bpmT, 1.6, dt);
        const now = ctx.currentTime;
        if (M.next < now - 0.02) M.next = now + 0.06;
        let guard = 0;
        while (M.next < now + 0.2 && guard++ < 16) {
          const sd = 15 / Math.max(30, M.bpm);
          if (any) {
            schedStep(M.next, sd);
            if (++M.s >= 16) { M.s = 0; M.bar++; }
          }
          M.next += sd;
        }
        updateAmbience(dt);
      } catch (e) { }
    }
  };
})();
