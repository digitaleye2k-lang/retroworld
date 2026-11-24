// Procedural cinematic score: step sequencer with crossfading tracks.
import { AudioEngine } from './AudioEngine.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// D minor based chord roots (midi)
const PROG_A = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]; // Dm Bb F C
const PROG_B = [[50, 53, 57], [43, 46, 50], [46, 50, 53], [45, 49, 52]]; // Dm Gm Bb A
const PROG_V = [[50, 54, 57], [55, 59, 62], [52, 55, 59], [57, 61, 64]]; // D G Em A (victory)

const TRACKS = {
  menu: { bpm: 72, prog: PROG_A, pad: 0.16, drums: 'epic', bass: 'pulse8', lead: 'piano', choir: 0.05 },
  stealth: { bpm: 84, prog: PROG_B, pad: 0.12, drums: 'tick', bass: 'pulse16', lead: null, choir: 0 },
  combat: { bpm: 138, prog: PROG_A, pad: 0.08, drums: 'combat', bass: 'ostinato', lead: 'stabs', choir: 0 },
  boss: { bpm: 150, prog: PROG_B, pad: 0.1, drums: 'boss', bass: 'ostinato', lead: 'stabs', choir: 0.08 },
  heli: { bpm: 128, prog: PROG_B, pad: 0.08, drums: 'combat', bass: 'ostinato', lead: 'stabs', choir: 0.04 },
  tension: { bpm: 70, prog: PROG_B, pad: 0.14, drums: 'heartbeat', bass: null, lead: null, choir: 0.06 },
  victory: { bpm: 80, prog: PROG_V, pad: 0.16, drums: 'epic', bass: 'pulse8', lead: 'piano', choir: 0.08 },
  sad: { bpm: 56, prog: [[50, 53, 57], [46, 50, 53], [41, 45, 48], [45, 49, 52]], pad: 0.13, drums: null, bass: null, lead: 'lament', choir: 0.07 },
};

// Recorded score. Each game music state maps to a file track plus a mix (gain + low-pass) so
// one piece of music can sit low and muffled while sneaking and open up fully in a firefight.
const FILES = { vanguard: 'assets/music/vanguard_protocol.mp3', shadow: 'assets/music/shadow_division.mp3' };
const STATES = {
  menu: { file: 'vanguard', gain: 0.9, lp: 20000 },
  victory: { file: 'vanguard', gain: 0.85, lp: 20000 },
  briefing: { file: 'vanguard', gain: 0.55, lp: 2600 },
  stealth: { file: 'shadow', gain: 0.38, lp: 750 },
  tension: { file: 'shadow', gain: 0.5, lp: 1500 },
  combat: { file: 'shadow', gain: 0.9, lp: 20000 },
  heli: { file: 'shadow', gain: 1.0, lp: 20000 },
  boss: { file: 'shadow', gain: 1.05, lp: 20000, rate: 1.0 },
  sad: null,            // procedural lament (file tracks fade out)
};

class MusicImpl {
  constructor() {
    this.current = null; this.timer = null; this.step = 0; this.nextTime = 0; this.bus = null; this.intensity = 1;
  }

  play(name) {
    const A = AudioEngine;
    if (!A.ready) { this.pending = name; return; }
    const st = name ? STATES[name] : null;
    const ft = st ? this._fileTrack(st.file) : null;
    if (ft && !ft.failed) {
      if (this.bus) { this._playProcedural(null); }
      this.current = name; this.state = st;
      if (this.currentFile !== st.file) {
        this._fadeOutFile();
        this.currentFile = st.file;
        if (name === 'menu' || name === 'victory' || name === 'briefing') ft.el.currentTime = ft.el.currentTime || 0;
        const pr = ft.el.play();
        if (pr && pr.catch) pr.catch(() => { ft.failed = true; this.currentFile = null; this.current = null; this.play(name); });
      }
      this._applyMix(1.2);
      return;
    }
    this._fadeOutFile(); this.currentFile = null; this.state = null;
    this._playProcedural(name);
  }

  // short dips under dialogue / explosions so speech stays readable
  duck(amount = 0.45, seconds = 2.5) {
    this.duckLevel = amount; clearTimeout(this.duckTimer);
    this._applyMix(0.25);
    this.duckTimer = setTimeout(() => { this.duckLevel = 1; this._applyMix(0.8); }, seconds * 1000);
  }

  _applyMix(tc) {
    const A = AudioEngine; if (!A.ready || !this.currentFile) return;
    const ft = this.fileTracks && this.fileTracks[this.currentFile]; if (!ft || !this.state) return;
    const t = A.ctx.currentTime;
    ft.g.gain.cancelScheduledValues(t);
    ft.g.gain.setTargetAtTime(this.state.gain * (this.duckLevel || 1), t, tc);
    ft.lp.frequency.cancelScheduledValues(t);
    ft.lp.frequency.setTargetAtTime(this.state.lp, t, tc);
  }

  _fileTrack(id) {
    this.fileTracks = this.fileTracks || {};
    if (this.fileTracks[id]) return this.fileTracks[id];
    const A = AudioEngine; const ctx = A.ctx;
    const ft = { failed: false };
    try {
      const el = new Audio(FILES[id]); el.loop = true; el.preload = 'auto';
      el.addEventListener('error', () => { ft.failed = true; if (this.currentFile === id) { this.currentFile = null; const n = this.current; this.current = null; this.play(n); } });
      const src = ctx.createMediaElementSource(el);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      src.connect(lp); lp.connect(g); g.connect(A.music);
      Object.assign(ft, { el, lp, g });
    } catch (e) { ft.failed = true; }
    this.fileTracks[id] = ft;
    return ft;
  }

  _fadeOutFile() {
    const id = this.currentFile; if (!id || !this.fileTracks || !this.fileTracks[id]) return;
    const ft = this.fileTracks[id]; const ctx = AudioEngine.ctx;
    ft.g.gain.cancelScheduledValues(ctx.currentTime);
    ft.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.7);
    const el = ft.el; setTimeout(() => { if (this.currentFile !== id) { try { el.pause(); } catch (e) {} } }, 3500);
  }

  _playProcedural(name) {
    const A = AudioEngine;
    if (this.current === name && this.bus) return;
    const ctx = A.ctx;
    // fade out old bus
    if (this.bus) {
      const old = this.bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
      setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 3500);
    }
    this.current = name;
    if (!name || !TRACKS[name]) { this.bus = null; this._stopTimer(); return; }
    this.track = TRACKS[name];
    this.bus = ctx.createGain(); this.bus.gain.value = 0.0001;
    this.bus.connect(A.music);
    const rev = ctx.createGain(); rev.gain.value = 0.5; this.bus.connect(rev); rev.connect(A.revSend);
    this.bus.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    this.step = 0; this.nextTime = ctx.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this._schedule(), 30);
  }

  stop() { this.play(null); }

  _stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  tryPending() { if (this.pending && AudioEngine.ready) { const p = this.pending; this.pending = null; this.current = null; this.play(p); } }

  _schedule() {
    const A = AudioEngine; if (!A.ready || !this.bus) return;
    const ctx = A.ctx;
    if (ctx.state !== 'running') { this.nextTime = ctx.currentTime + 0.05; return; }
    const spb = 60 / this.track.bpm / 4; // 16th note
    while (this.nextTime < ctx.currentTime + 0.15) {
      if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02;
      this._playStep(this.step, this.nextTime, spb);
      this.nextTime += spb; this.step++;
    }
  }

  _playStep(step, t, spb) {
    const tr = this.track; const bar = Math.floor(step / 16) % tr.prog.length; const s = step % 16;
    const chord = tr.prog[bar];
    const bus = this.bus;
    if (s === 0) {
      if (tr.pad) this._pad(bus, chord, t, spb * 16, tr.pad);
      if (tr.choir) this._choir(bus, chord, t, spb * 16, tr.choir);
    }
    // bass
    if (tr.bass === 'pulse8' && s % 4 === 0) this._bass(bus, chord[0] - 12, t, spb * 3.5, 0.18);
    if (tr.bass === 'pulse16' && s % 2 === 0) this._bass(bus, chord[0] - 12, t, spb * 1.4, s % 8 === 0 ? 0.16 : 0.09);
    if (tr.bass === 'ostinato') {
      const pat = [0, 0, 12, 0, 0, 7, 0, 10, 0, 0, 12, 0, 3, 0, 7, 5];
      this._bass(bus, chord[0] - 12 + pat[s], t, spb * 0.9, s % 4 === 0 ? 0.2 : 0.12);
    }
    // drums
    const d = tr.drums;
    if (d === 'epic') {
      if (s === 0 || s === 10) this._taiko(bus, t, 0.6);
      if (s === 8 && bar % 2 === 1) this._taiko(bus, t, 0.4);
      if (s === 14 && bar === 3) { this._taiko(bus, t, 0.35); this._taiko(bus, t + spb, 0.45); }
    } else if (d === 'tick') {
      if (s % 4 === 2) this._hat(bus, t, 0.04);
      if (s === 0 && bar % 2 === 0) this._taiko(bus, t, 0.3);
    } else if (d === 'combat' || d === 'boss') {
      if (s === 0 || s === 6 || s === 8 || (d === 'boss' && s === 11)) this._taiko(bus, t, 0.55);
      if (s === 4 || s === 12) this._snare(bus, t, 0.3);
      if (s % 2 === 0) this._hat(bus, t, s % 4 === 0 ? 0.06 : 0.035);
      if (d === 'boss' && s === 15) this._snare(bus, t, 0.2);
    } else if (d === 'heartbeat') {
      if (s === 0) this._taiko(bus, t, 0.35);
      if (s === 3) this._taiko(bus, t, 0.22);
    }
    // lead
    if (tr.lead === 'piano') {
      const arp = [0, 1, 2, 1, 2, 1, 0, 2];
      if (s % 2 === 0) { const n = chord[arp[(s / 2) % 8]] + 12; this._piano(bus, n, t, spb * 3, 0.07); }
    } else if (tr.lead === 'lament') {
      const mel = [2, null, 1, null, 0, null, null, null, 1, null, 2, null, 1, null, null, null];
      const k = mel[s]; if (k !== null) this._piano(bus, chord[k] + 12 + (s === 10 && bar === 3 ? 2 : 0), t, spb * 6, 0.09);
      if (s === 0) this._piano(bus, chord[0] - 12, t, spb * 14, 0.06);
    } else if (tr.lead === 'stabs') {
      if ((s === 0 || s === 3 || s === 6) && bar % 2 === 1) for (const n of chord) this._stab(bus, n + 12, t, spb * 1.5, 0.05);
    }
  }

  _env(g, t, a, dur, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _pad(bus, chord, t, dur, vol) {
    const ctx = AudioEngine.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5;
    const g = ctx.createGain(); this._env(g, t, dur * 0.35, dur * 1.05, vol);
    f.connect(g); g.connect(bus);
    for (const n of chord) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = 0.18; o.connect(og); og.connect(f); o.start(t); o.stop(t + dur * 1.1);
    }
  }

  _choir(bus, chord, t, dur, vol) {
    const ctx = AudioEngine.ctx;
    const g = ctx.createGain(); this._env(g, t, dur * 0.4, dur, vol); g.connect(bus);
    for (const n of chord) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n + 12);
      const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 4;
      vib.connect(vg); vg.connect(o.detune);
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 4;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 5;
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);
      o.start(t); o.stop(t + dur); vib.start(t); vib.stop(t + dur);
    }
  }

  _bass(bus, n, t, dur, vol) {
    const ctx = AudioEngine.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g = ctx.createGain(); this._env(g, t, 0.006, dur, vol);
    o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }

  _piano(bus, n, t, dur, vol) {
    const ctx = AudioEngine.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTE(n);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = NOTE(n) * 2;
    const g = ctx.createGain(); this._env(g, t, 0.005, dur, vol);
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }

  _stab(bus, n, t, dur, vol) {
    const ctx = AudioEngine.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(400, t + dur);
    const g = ctx.createGain(); this._env(g, t, 0.01, dur, vol);
    o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }

  _taiko(bus, t, vol) {
    const ctx = AudioEngine.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    const g = ctx.createGain(); this._env(g, t, 0.003, 0.6, vol);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.65);
    const n = ctx.createBufferSource(); n.buffer = AudioEngine.noise;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const ng = ctx.createGain(); this._env(ng, t, 0.002, 0.12, vol * 0.5);
    n.connect(f); f.connect(ng); ng.connect(bus); n.start(t, Math.random()); n.stop(t + 0.15);
  }

  _snare(bus, t, vol) {
    const ctx = AudioEngine.ctx;
    const n = ctx.createBufferSource(); n.buffer = AudioEngine.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ctx.createGain(); this._env(g, t, 0.002, 0.18, vol);
    n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random()); n.stop(t + 0.2);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const og = ctx.createGain(); this._env(og, t, 0.002, 0.1, vol * 0.6); o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.12);
  }

  _hat(bus, t, vol) {
    const ctx = AudioEngine.ctx;
    const n = ctx.createBufferSource(); n.buffer = AudioEngine.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); this._env(g, t, 0.001, 0.05, vol);
    n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random()); n.stop(t + 0.06);
  }
}

export const Music = new MusicImpl();
