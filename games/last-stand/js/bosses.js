'use strict';
/* ===== bosses: five multi-phase encounters with telegraphed attacks and weak points ===== */
const FLOOR = 13 * TS;
const Haz = {
  // telegraphs, beams, shockwaves, hazard zones shared by bosses
  TM: [], BM: [], SW: [], ZN: [],
  reset() { this.TM = []; this.BM = []; this.SW = []; this.ZN = []; },
  mark(x, y, w, h, t, c) { this.TM.push({ x, y, w, h, t: 0, dur: t, c: c || '#ff2a2a' }); },
  beam(o) { this.BM.push(Object.assign({ t: 0, warn: .7, dur: .45, w: 16, dmg: 22, c: '#ff3a3a', done: 0 }, o)); },
  wave(x, dir, o) { this.SW.push(Object.assign({ x, dir, t: 0, spd: 420, h: 34, dmg: 18, life: 2.4, c: '#ffb040' }, o || {})); },
  zone(x, w, o) { this.ZN.push(Object.assign({ x, y: FLOOR - 10, w, h: 10, t: 0, dur: 3, dmg: 14, c: '#ff6a1a', warn: .6 }, o || {})); },
  update(dt) {
    for (const m of this.TM) m.t += dt; this.TM = this.TM.filter(m => m.t < m.dur);
    const pr = { x: P.x, y: P.y, w: P.w, h: P.h };
    for (const b of this.BM) { b.t += dt; if (b.move) b.move(b, dt); if (b.t > b.warn && b.t < b.warn + b.dur && P.alive) { if (segHit(b.x1, b.y1, b.x2, b.y2, pr, b.w / 2)) { pHurt(b.dmg, sgn(P.x - b.x1)); if (b.freeze) P.slow = 2; } if (!b.done) { b.done = 1; Snd.play('laser', 1); Cam.add(6); } } }
    this.BM = this.BM.filter(b => b.t < b.warn + b.dur);
    for (const s of this.SW) { s.t += dt; s.x += s.dir * s.spd * dt; if (Math.random() < .6) FX.p({ x: s.x, y: FLOOR - 4, vx: rnd(-40, 40), vy: rnd(-200, -60), life: .3, s: 4, s2: 1, c: s.c, add: true }); if (P.alive && P.x < s.x + 16 && P.x + P.w > s.x - 16 && P.y + P.h > FLOOR - s.h) { pHurt(s.dmg, s.dir); } }
    this.SW = this.SW.filter(s => s.t < s.life && s.x > Cam.x - 60 && s.x < Cam.x + W + 60);
    for (const z of this.ZN) { z.t += dt; if (z.t > z.warn && P.alive && P.x < z.x + z.w && P.x + P.w > z.x && P.y + P.h > z.y - 2 && P.ground) pHurt(z.dmg, 0); if (z.t > z.warn && Math.random() < .5) FX.fire(z.x + rnd(0, z.w), FLOOR - 4, 1); }
    this.ZN = this.ZN.filter(z => z.t < z.dur);
  },
  draw(g) {
    for (const m of this.TM) { const a = .35 + .35 * Math.sin(m.t * 30); g.fillStyle = m.c; g.globalAlpha = a * .5; g.fillRect(m.x, m.y, m.w, m.h); g.globalAlpha = a; g.strokeStyle = m.c; g.lineWidth = 2; g.setLineDash([8, 6]); g.strokeRect(m.x, m.y, m.w, m.h); g.setLineDash([]); g.globalAlpha = 1; g.font = '900 18px Impact,sans-serif'; g.textAlign = 'center'; g.fillStyle = m.c; g.fillText('!', m.x + m.w / 2, m.y - 6); }
    for (const b of this.BM) {
      if (b.t < b.warn) { g.strokeStyle = b.c; g.globalAlpha = .35 + .4 * Math.sin(b.t * 40); g.lineWidth = 2; g.setLineDash([12, 8]); g.beginPath(); g.moveTo(b.x1, b.y1); g.lineTo(b.x2, b.y2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
      else { const k = 1 - (b.t - b.warn) / b.dur; g.globalCompositeOperation = 'lighter'; g.strokeStyle = b.c; g.lineCap = 'round'; g.globalAlpha = k; g.lineWidth = b.w * 1.8; g.beginPath(); g.moveTo(b.x1, b.y1); g.lineTo(b.x2, b.y2); g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = b.w * .5; g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    }
    for (const s of this.SW) { g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, FLOOR - s.h, 0, FLOOR); gr.addColorStop(0, s.c + '00'); gr.addColorStop(1, s.c + 'cc'); g.fillStyle = gr; g.beginPath(); g.moveTo(s.x - 20, FLOOR); g.quadraticCurveTo(s.x, FLOOR - s.h * 2, s.x + 20, FLOOR); g.fill(); g.globalCompositeOperation = 'source-over'; }
    for (const z of this.ZN) { if (z.t < z.warn) { g.fillStyle = 'rgba(255,60,30,' + (.25 + .2 * Math.sin(z.t * 30)) + ')'; g.fillRect(z.x, FLOOR - 4, z.w, 4); } else { g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, FLOOR - 26, 0, FLOOR); gr.addColorStop(0, 'rgba(255,120,30,0)'); gr.addColorStop(1, 'rgba(255,120,30,.75)'); g.fillStyle = gr; g.fillRect(z.x, FLOOR - 26, z.w, 26); g.globalCompositeOperation = 'source-over'; } }
  }
};
function segHit(x1, y1, x2, y2, r, rad) { // segment vs rect (expanded)
  const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 10); for (let i = 0; i <= n; i++) { const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; if (x > r.x - rad && x < r.x + r.w + rad && y > r.y - rad && y < r.y + r.h + rad) return true; } return false;
}
const Boss = {
  b: null,
  start(li) {
    const ax = Cam.lockL, def = BOSSES[li];
    const b = { li, def, ax, t: 0, hp: def.hp * DIFF().ehp, maxHp: def.hp * DIFF().ehp, phase: 1, st: 'intro', stT: 2.6, flash: 0, alive: true, dying: 0, atk: null, atkT: 0, n: 0, x: 0, y: 0, name: LEVELS[li].boss, sub: LEVELS[li].bossSub };
    def.init(b); this.b = b; G.bossIntro = 2.6; G.banner = 0; Snd.play('warn'); Music.play(6); Haz.reset();
  },
  update(dt) {
    const b = this.b; if (!b) return; b.t += dt; b.flash = Math.max(0, b.flash - dt);
    if (b.dying) { b.dying += dt; if (Math.random() < .35 && b.dying < 3) { const r = b.def.box(b); FX.explode(r.x + rnd(0, r.w), r.y + rnd(0, r.h), rnd(50, 110), { vol: .6, noStop: 1 }); } if (b.dying > 3.4 && !b.gone) { b.gone = 1; const r = b.def.box(b); FX.explode(r.x + r.w / 2, r.y + r.h / 2, 220); FX.flash(1, '#fff'); G.bossDown(); } return; }
    if (b.st === 'intro') { b.stT -= dt; b.def.intro && b.def.intro(b, dt); if (b.stT <= 0) b.st = 'fight'; return; }
    const ph = b.hp / b.maxHp < .3 ? 3 : b.hp / b.maxHp < .62 ? 2 : 1;
    if (ph > b.phase) { b.phase = ph; FX.text(Cam.x + W / 2, Cam.y + 150, ph === 3 ? 'FINAL PHASE' : 'PHASE ' + ph, '#ff4a4a', 34); Snd.play('alarm'); Cam.add(14); b.def.phase && b.def.phase(b, ph); }
    b.def.update(b, dt);
    // contact damage
    for (const r of b.def.parts(b)) if (r.contact && P.alive && ovl(r, P)) pHurt(r.contact, sgn(P.x - (r.x + r.w / 2)));
  },
  hitTest(bl) { // returns damage multiplier or 0
    const b = this.b; if (!b || b.dying || b.st === 'intro') return null; for (const r of b.def.parts(b)) { if (r.off) continue; if (bl.x + bl.r > r.x && bl.x - bl.r < r.x + r.w && bl.y + bl.r > r.y && bl.y - bl.r < r.y + r.h) return r; } return null;
  },
  damage(dmg, part, src) {
    const b = this.b; if (!b || b.dying) return; if (part.hp != null) { part.hp -= dmg; part.flash = .08; if (part.hp <= 0 && !part.dead) { part.dead = 1; part.off = true; FX.explode(part.x + part.w / 2, part.y + part.h / 2, 90); G.score += 800; b.def.partDead && b.def.partDead(b, part); } return; }
    const k = part.weak ? 1 : part.armor != null ? part.armor : .22; if (k < .3) { if (Math.random() < .3) Snd.play('clang', .5); FX.spark(clamp(P.x, part.x, part.x + part.w), part.y + part.h / 2, '#cfe0ff', 2); }
    b.hp -= dmg * k; b.fcd = (b.fcd || 0); if (b.t - b.fcd > .16) { b.flash = .05; b.fcd = b.t; } if (part.weak) { if (Math.random() < .5) FX.spark(part.x + part.w / 2, part.y + part.h / 2, '#fff', 3); }
    if (b.hp <= 0) { b.hp = 0; b.dying = .01; Snd.play('bigBoom'); FX.hitstop(.25); Cam.add(26); FX.flash(.8); Haz.reset(); G.EB(); }
  },
  draw(g) { const b = this.b; if (!b || b.gone) return; b.def.draw(g, b); }
};
/* ---- helpers ---- */
function px() { return P.x + P.w / 2; }
function bShot(x, y, a, sp, o) { G.B.push(Object.assign({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, own: 'e', dmg: 12, life: 4, r: 6, type: 'orb' }, o || {})); }
function mortar(x, y, tx, o) { const t = 1.05, vx = (tx - x) / t, vy = (FLOOR - 6 - y - .5 * 900 * t * t) / t; G.B.push(Object.assign({ x, y, vx, vy, own: 'e', dmg: 16, life: 3, r: 8, type: 'shell', grav: 900, splash: 70 }, o || {})); Haz.mark(tx - 34, FLOOR - 6, 68, 6, t, '#ffb020'); }
function plate(g, x, y, w, h, c, fl) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, shade(c, 1.35)); gr.addColorStop(.5, c); gr.addColorStop(1, shade(c, .6)); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 3, y + 3, w - 6, 3); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 3, y + h - 6, w - 6, 3);
  if (w > 40 && h > 26) { g.fillStyle = shade(c, .45); for (const [rx, ry] of [[x + 6, y + 8], [x + w - 9, y + 8], [x + 6, y + h - 11], [x + w - 9, y + h - 11]]) { g.beginPath(); g.arc(rx + 1.5, ry + 1.5, 2.2, 0, TAU); g.fill(); } }
  if (w > 120) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + w * .5, y + 6); g.lineTo(x + w * .5, y + h - 6); g.stroke(); }
  g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
  if (fl) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x, y, w, h); }
}
function glowDot(g, x, y, r, c, k) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 1, x, y, r * 3); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.globalAlpha = k == null ? 1 : k; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); g.restore(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * .5, 0, TAU); g.fill(); }
function nextAtk(b, list, cd) { b.atk = pick(list); b.atkT = 0; b.n = 0; b.cd = cd; }

const BOSSES = [
/* 1. IRONROOT — jungle mechanical guardian rooted at the right wall */
{ hp: 2600,
  init(b) { b.x = b.ax + 700; b.y = FLOOR - 300; b.cd = 1.2; b.armA = 0; b.coreOpen = 0; },
  box(b) { return { x: b.x, y: b.y, w: 220, h: 300 }; },
  parts(b) { const open = b.coreOpen > 0 || b.phase >= 2; return [{ x: b.x + 70, y: b.y + 110, w: 70, h: 70, weak: open, armor: open ? 1 : .3 }, { x: b.x + 20, y: b.y + 20, w: 180, h: 280, armor: .3 }, { x: b.x - 70, y: b.y + 150 + Math.sin(b.armA) * 8, w: 90, h: 34, armor: .35 }]; },
  intro(b) { b.y = FLOOR - 300 + Math.max(0, b.stT - 1.2) * 120; if (Math.random() < .3) FX.debris(b.x + rnd(0, 220), FLOOR, '#4a3a2a'); Cam.add(1); },
  update(b, dt) {
    b.coreOpen = Math.max(0, b.coreOpen - dt); b.armA += dt * 2; b.vent = (b.vent || 0) + dt; if (b.vent > 4.2) { b.vent = 0; b.coreOpen = 1.8; FX.smoke(b.x + 105, b.y + 140, 6, 'rgba(220,220,220,.4)'); FX.text(b.x + 105, b.y + 96, 'CORE EXPOSED', '#ff8a6a', 14); } b.cd -= dt * (b.phase === 3 ? 1.5 : 1); const sp = b.phase === 3 ? 1.35 : 1;
    if (!b.atk && b.cd <= 0) nextAtk(b, b.phase === 1 ? ['volley', 'beam', 'volley'] : b.phase === 2 ? ['volley', 'beam', 'smash', 'drones'] : ['volley', 'beam', 'smash', 'combo'], 0);
    if (!b.atk) return; b.atkT += dt * sp;
    if (b.atk === 'volley') { if (b.atkT > .5 && b.n < (b.phase >= 2 ? 5 : 3)) { if (b.atkT > .5 + b.n * .32) { b.n++; mortar(b.x - 60, b.y + 160, clamp(px() + rnd(-90, 90) + (b.n - 2) * 60, b.ax + 30, b.x - 40)); Snd.play('rocket', .7); FX.smoke(b.x - 60, b.y + 160, 4); } } else if (b.atkT > 2.2) { b.atk = null; b.cd = 1.1; } }
    else if (b.atk === 'beam') { if (b.n === 0) { b.n = 1; const hi = Math.random() < .5; const y = hi ? FLOOR - 46 : FLOOR - 14; Haz.beam({ x1: b.x + 30, y1: y, x2: b.ax - 20, y2: y, warn: .85 / sp, dur: .4, w: 18, dmg: 24, c: '#ff3a5a' }); FX.text(px(), P.y - 30, hi ? 'DUCK!' : 'JUMP!', '#ff6a6a', 18); b.coreOpen = 1.6; } if (b.atkT > 1.5) { b.atk = null; b.cd = 1; } }
    else if (b.atk === 'smash') { if (b.n === 0 && b.atkT > .6) { b.n = 1; Cam.add(18); Snd.play('boom'); FX.smoke(b.x - 40, FLOOR, 8); Haz.wave(b.x - 30, -1, { spd: 460 }); if (b.phase === 3) setTimeout(() => G.state === 'play' && Haz.wave(b.x - 30, -1, { spd: 300 }), 450); b.coreOpen = 1.8; } if (b.atkT > 1.6) { b.atk = null; b.cd = .9; } }
    else if (b.atk === 'drones') { if (b.n < 2 && b.atkT > .4 + b.n * .4) { b.n++; spawnEnemy('drone', b.x + 40, b.y + 60); } if (b.atkT > 1.4) { b.atk = null; b.cd = 1.4; } }
    else if (b.atk === 'combo') { if (b.n === 0) { b.n = 1; Haz.beam({ x1: b.x + 30, y1: FLOOR - 14, x2: b.ax - 20, y2: FLOOR - 14, warn: .7, dur: .35, w: 18, dmg: 24, c: '#ff3a5a' }); } if (b.n === 1 && b.atkT > 1.3) { b.n = 2; for (let i = 0; i < 4; i++) mortar(b.x - 60, b.y + 160, b.ax + 80 + i * 170); } if (b.atkT > 2.8) { b.atk = null; b.cd = 1; } }
  },
  draw(g, b) {
    const fl = b.flash > 0, x = b.x, y = b.y;
    // roots
    g.strokeStyle = '#2a1e14'; g.lineWidth = 14; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x + 30 + i * 40, y + 280); g.quadraticCurveTo(x + i * 40 - 30, FLOOR + 10, x - 30 + i * 30, FLOOR + 6); g.stroke(); }
    plate(g, x + 20, y + 20, 180, 280, '#3a4a32', fl); plate(g, x + 40, y - 10, 140, 60, '#4a5a3a', fl);
    g.fillStyle = '#26301f'; for (let i = 0; i < 6; i++) g.fillRect(x + 30, y + 60 + i * 38, 160, 4);
    g.fillStyle = '#5aff6a'; g.fillRect(x + 60, y + 8, 100, 10); glowDot(g, x + 110, y + 14, 8, 'rgba(90,255,110,.7)');
    // moss
    g.fillStyle = '#2a7a2a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(x + 30 + i * 20, y + 22, 16, 8, 0, 0, TAU); g.fill(); }
    // core
    const open = b.coreOpen > 0 || b.phase >= 2; plate(g, x + 62, y + 102, 86, 86, '#1a1e18', fl); if (open) glowDot(g, x + 105, y + 145, 22, 'rgba(255,90,60,.8)', .7 + .3 * Math.sin(b.t * 10)); else { g.fillStyle = '#4a5a3a'; g.fillRect(x + 66, y + 106, 78, 78); g.strokeStyle = '#000'; g.strokeRect(x + 66, y + 106, 78, 78); }
    // cannon arm
    const ay = y + 150 + Math.sin(b.armA) * 8; plate(g, x - 70, ay, 110, 34, '#3a3e32', fl); g.fillStyle = '#111'; g.fillRect(x - 80, ay + 8, 14, 18); if (b.atk === 'volley' && b.atkT < .5) glowDot(g, x - 74, ay + 17, 10, 'rgba(255,160,40,.8)');
    // eye
    const ec = b.atk === 'beam' || b.atk === 'combo' ? 'rgba(255,40,80,.9)' : 'rgba(255,200,60,.6)'; glowDot(g, x + 50, y + 22, 9, ec);
  }
},
/* 2. DUNE COLOSSUS — a walking war machine with a cockpit weak point on top */
{ hp: 3000,
  init(b) { b.x = b.ax + 960; b.y = FLOOR - 200; b.tx = b.ax + 600; b.cd = 1.4; b.leg = 0; b.dir = -1; },
  box(b) { return { x: b.x, y: b.y, w: 260, h: 200 }; },
  parts(b) { return [{ x: b.x + 100, y: b.y - 34, w: 70, h: 40, weak: true }, { x: b.x + 20, y: b.y + 10, w: 230, h: 100, armor: .35, contact: 0 }, { x: b.x + 40, y: b.y + 110, w: 40, h: 90, armor: .4, contact: 18 }, { x: b.x + 190, y: b.y + 110, w: 40, h: 90, armor: .4, contact: 18 }]; },
  intro(b, dt) { b.x += (b.tx - b.x) * dt * 1.4; b.leg += dt * 6; if (Math.floor(b.t * 3) !== Math.floor((b.t - dt) * 3)) { Cam.add(6); Snd.play('land'); } },
  update(b, dt) {
    const sp = b.phase === 3 ? 1.4 : 1; b.cd -= dt * sp;
    if (b.walkT > 0) { b.walkT -= dt; const nx = clamp(b.x + b.dir * 150 * sp * dt, b.ax + 40, b.ax + 960 - 300); if (nx === b.x) b.dir *= -1; b.x = nx; b.leg += dt * 7; if (Math.floor(b.leg / Math.PI) !== Math.floor((b.leg - dt * 7) / Math.PI)) { Cam.add(5); Snd.play('land', .8); FX.smoke(b.x + 60, FLOOR, 2, 'rgba(220,180,120,.4)'); } }
    if (!b.atk && b.cd <= 0) { nextAtk(b, b.phase === 1 ? ['missiles', 'cannon', 'walk'] : ['missiles', 'flame', 'cannon', 'walk', 'flame'], 0); }
    if (!b.atk) return; b.atkT += dt * sp;
    const cx = b.x + 135;
    if (b.atk === 'walk') { if (b.n === 0) { b.n = 1; b.dir = px() < cx ? -1 : 1; b.walkT = 1.6; } if (b.atkT > 1.8) { b.atk = null; b.cd = .4; } }
    else if (b.atk === 'missiles') { const N = b.phase >= 2 ? 7 : 5; if (b.n < N && b.atkT > .3 + b.n * .16) { b.n++; const tx = clamp(px() + (b.n - N / 2) * 70 + rnd(-30, 30), b.ax + 20, b.ax + 940); Haz.mark(tx - 30, FLOOR - 6, 60, 6, 1.4, '#ff4a2a'); G.B.push({ x: cx + rnd(-30, 30), y: b.y - 10, vx: 0, vy: -700, own: 'e', dmg: 0, life: .5, r: 5, type: 'erocket' }); setTimeout(() => { if (G.state === 'play' && Boss.b === b && !b.dying) G.B.push({ x: tx, y: Cam.y - 40, vx: 0, vy: 900, own: 'e', dmg: 18, life: 2, r: 7, type: 'erocket', splash: 70 }); }, 1000); Snd.play('rocket', .6); } if (b.atkT > 2.6) { b.atk = null; b.cd = 1; } }
    else if (b.atk === 'cannon') { if (b.n < 3 && b.atkT > .4 + b.n * .55) { b.n++; const a = Math.atan2(-.5, px() < cx ? -1 : 1); bShot(cx + (px() < cx ? -110 : 110), b.y + 50, a, 520, { r: 9, type: 'shell', grav: 700, dmg: 18, splash: 70, bounce: 2 }); Snd.play('shotgun'); Cam.add(5); } if (b.atkT > 2.2) { b.atk = null; b.cd = .9; } }
    else if (b.atk === 'flame') { const dir = px() < cx ? -1 : 1, x0 = dir < 0 ? b.x : b.x + 260; if (b.n === 0) { b.n = 1; Haz.mark(dir < 0 ? x0 - 380 : x0, FLOOR - 60, 380, 60, .8, '#ff7a1a'); } if (b.atkT > .8 && b.atkT < 2.2) { for (let i = 0; i < 3; i++) FX.p({ x: x0, y: FLOOR - 30, vx: dir * rnd(400, 700), vy: rnd(-80, 40), life: .55, s: 10, s2: 26, c: pick(['#ffd04a', '#ff8a2a', '#ff4a1a']), add: true, drag: 1 }); if (P.alive && P.y + P.h > FLOOR - 62 && (dir < 0 ? (px() < x0 && px() > x0 - 380) : (px() > x0 && px() < x0 + 380))) pHurt(14, dir); if (Math.random() < .3) Snd.play('flame'); } if (b.atkT > 2.4) { b.atk = null; b.cd = .8; } }
  },
  draw(g, b) {
    const fl = b.flash > 0, x = b.x, y = b.y, l1 = Math.sin(b.leg) * 14, l2 = Math.sin(b.leg + Math.PI) * 14;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 135, FLOOR + 2, 160, 10, 0, 0, TAU); g.fill();
    for (const [lx, o] of [[x + 40, l1], [x + 190, l2]]) { plate(g, lx + o, y + 110, 40, FLOOR - y - 110 - 14, '#6a4a2a', fl); plate(g, lx + o - 12, FLOOR - 16, 64, 16, '#3a2a1a', fl); }
    plate(g, x + 20, y + 10, 230, 100, '#8a6a3a', fl); g.fillStyle = '#5a4020'; for (let i = 0; i < 5; i++) g.fillRect(x + 30 + i * 44, y + 20, 30, 6);
    g.fillStyle = '#e8b04a'; g.fillRect(x + 20, y + 76, 230, 8); g.fillStyle = '#000'; for (let i = 0; i < 12; i++) g.fillRect(x + 22 + i * 20, y + 76, 9, 8);
    plate(g, x - 30, y + 40, 60, 22, '#4a3a22', fl); plate(g, x + 240, y + 40, 60, 22, '#4a3a22', fl);
    plate(g, x + 100, y - 34, 70, 44, '#a07a3a', fl); g.fillStyle = '#0c1a2a'; g.fillRect(x + 110, y - 26, 50, 18); glowDot(g, x + 135, y - 17, 8, 'rgba(255,80,60,.8)', .6 + .4 * Math.sin(b.t * 8));
    g.fillStyle = '#3a2a1a'; g.fillRect(x + 60, y - 20, 24, 30); g.strokeRect(x + 60, y - 20, 24, 30); g.fillRect(x + 190, y - 20, 24, 30); g.strokeRect(x + 190, y - 20, 24, 30);
    if (b.atk === 'flame' && b.atkT < .8) glowDot(g, px() < x + 135 ? x - 30 : x + 300, y + 51, 12, 'rgba(255,120,30,.9)');
  }
},
/* 3. FOUNDRY TITAN — giant robot torso; punches open its chest core */
{ hp: 3300,
  init(b) { b.x = b.ax + 560; b.y = FLOOR - 380; b.cd = 1.2; b.fx = b.ax + 400; b.fy = FLOOR - 260; b.fState = 'idle'; b.core = 0; b.rise = 1; },
  box(b) { return { x: b.x, y: b.y, w: 360, h: 380 }; },
  parts(b) { const fist = { x: b.fx - 50, y: b.fy - 40, w: 100, h: 80, armor: .35, contact: b.fState === 'slam' ? 30 : 0 }; return [{ x: b.x + 140, y: b.y + 150, w: 80, h: 80, weak: b.core > 0, armor: b.core > 0 ? 1 : .1 }, fist, { x: b.x + 150, y: b.y + 20, w: 60, h: 50, weak: true, armor: .6 }, { x: b.x + 60, y: b.y + 90, w: 240, h: 290, armor: .25 }]; },
  intro(b, dt) { b.rise = Math.max(0, b.rise - dt * .5); Cam.add(1.5); },
  update(b, dt) {
    const sp = b.phase === 3 ? 1.4 : 1; b.cd -= dt * sp; b.core = Math.max(0, b.core - dt);
    if (b.fState === 'idle') { b.fx += (b.ax + 420 + Math.sin(b.t) * 40 - b.fx) * dt * 2; b.fy += (FLOOR - 250 + Math.sin(b.t * 1.7) * 14 - b.fy) * dt * 2; }
    if (!b.atk && b.cd <= 0) nextAtk(b, b.phase === 1 ? ['punch', 'spray', 'punch'] : b.phase === 2 ? ['punch', 'spray', 'bots', 'molten'] : ['punch', 'punch', 'molten', 'spray', 'bots'], 0);
    if (!b.atk) return; b.atkT += dt * sp;
    if (b.atk === 'punch') {
      if (b.n === 0) { b.n = 1; b.tx = clamp(px(), b.ax + 60, b.x - 20); b.fState = 'raise'; Haz.mark(b.tx - 50, FLOOR - 8, 100, 8, .9 / sp, '#ff3a2a'); }
      if (b.fState === 'raise') { b.fx += (b.tx - b.fx) * dt * 6; b.fy += (FLOOR - 330 - b.fy) * dt * 6; if (b.atkT > .9) { b.fState = 'slam'; } }
      else if (b.fState === 'slam') { b.fy += 2400 * dt; if (b.fy >= FLOOR - 40) { b.fy = FLOOR - 40; b.fState = 'stuck'; Cam.add(22); FX.hitstop(.06); Snd.play('bigBoom', .8); FX.smoke(b.fx, FLOOR, 10); for (let i = 0; i < 10; i++) FX.debris(b.fx, FLOOR - 10, '#5a5a62'); Haz.wave(b.fx - 50, -1, { spd: 400, c: '#ff9a3a' }); Haz.wave(b.fx + 50, 1, { spd: 400, c: '#ff9a3a' }); b.core = 2.2; b.stuck = 1.6; } }
      else if (b.fState === 'stuck') { b.stuck -= dt; if (b.stuck <= 0) { b.fState = 'idle'; b.atk = null; b.cd = .7; } }
    }
    else if (b.atk === 'spray') { if (b.atkT > .5 && b.n < (b.phase >= 2 ? 18 : 12) && b.atkT > .5 + b.n * .09) { b.n++; const a = Math.PI * .6 + Math.sin(b.n * .6) * .45 + (b.n / 18) * .4; bShot(b.x + 180, b.y + 60, a, 330, { dmg: 11, r: 6, type: 'orb', col: '#ffb040' }); Snd.play('enemyShot', .5); } if (b.atkT > 2.8) { b.atk = null; b.cd = .8; } }
    else if (b.atk === 'bots') { if (b.n < 3 && b.atkT > .4 + b.n * .5) { b.n++; const e = spawnEnemy('kamikaze', b.x + 80, FLOOR); e.armed = true; } if (b.atkT > 2) { b.atk = null; b.cd = 1; } }
    else if (b.atk === 'molten') { if (b.n === 0) { b.n = 1; for (let i = 0; i < 3; i++) Haz.zone(clamp(px() - 220 + i * 190 + rnd(-40, 40), b.ax + 20, b.x - 120), 90, { warn: .9, dur: 4.5, dmg: 12 }); Snd.play('alarm', .6); } if (b.atkT > 1.6) { b.atk = null; b.cd = .8; } }
  },
  draw(g, b) {
    const fl = b.flash > 0, x = b.x, y = b.y + b.rise * 300;
    plate(g, x + 60, y + 90, 240, 320, '#4a4a52', fl); plate(g, x + 20, y + 80, 320, 70, '#5a5a62', fl);
    g.fillStyle = '#ffb020'; for (let i = 0; i < 8; i++) { g.fillRect(x + 70 + i * 28, y + 395, 14, 10); }
    plate(g, x + 140, y + 150, 80, 80, '#2a2a30', fl); if (b.core > 0) glowDot(g, x + 180, y + 190, 26, 'rgba(255,120,30,.9)', .8 + .2 * Math.sin(b.t * 14)); else { g.fillStyle = '#6a6a72'; g.fillRect(x + 145, y + 155, 70, 32); g.fillRect(x + 145, y + 193, 70, 32); }
    plate(g, x + 150, y + 20, 60, 56, '#6a6a72', fl); glowDot(g, x + 168, y + 44, 7, 'rgba(255,200,60,.9)'); glowDot(g, x + 192, y + 44, 7, 'rgba(255,200,60,.9)');
    g.strokeStyle = '#2a2a30'; g.lineWidth = 16; g.beginPath(); g.moveTo(x + 40, y + 110); g.quadraticCurveTo(b.fx + 40, b.fy - 160, b.fx, b.fy - 30); g.stroke(); g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke();
    plate(g, b.fx - 50, b.fy - 40, 100, 80, '#7a6a52', fl); g.fillStyle = '#3a3226'; for (let i = 0; i < 4; i++) g.fillRect(b.fx - 44 + i * 24, b.fy + 20, 18, 16);
    if (b.fState === 'raise') glowDot(g, b.fx, b.fy, 14, 'rgba(255,60,30,.7)');
    for (let i = 0; i < 3; i++) if (Math.random() < .3) FX.smoke(x + 80 + i * 100, y + 80, 1, 'rgba(60,60,64,.4)');
  }
},
/* 4. CRYO WARDEN — floating ice machine; its eye is the weak point */
{ hp: 3000,
  init(b) { b.x = b.ax + 600; b.y = -200; b.cd = 1; b.cx = b.ax + 600; b.cy = 150; },
  box(b) { return { x: b.x - 110, y: b.y - 80, w: 220, h: 160 }; },
  parts(b) { return [{ x: b.x - 26, y: b.y - 22, w: 52, h: 44, weak: true }, { x: b.x - 110, y: b.y - 70, w: 220, h: 140, armor: .3, contact: 16 }]; },
  intro(b, dt) { b.y += (150 - b.y) * dt * 2; },
  phase(b, ph) { if (ph >= 2) { const c0 = Math.floor(b.ax / TS); for (let c = c0; c < c0 + 30; c++) if (World.t(c, 13) === 1) World.set(c, 13, 3); FX.text(Cam.x + W / 2, 200, 'THE FLOOR FREEZES!', '#bfe8ff', 22); } },
  update(b, dt) {
    const sp = b.phase === 3 ? 1.35 : 1; b.cd -= dt * sp;
    b.cx = b.ax + 480 + Math.sin(b.t * .5) * 300; b.cy = 140 + Math.sin(b.t * 1) * 50; b.x += (b.cx - b.x) * dt * 1.5; b.y += (b.cy - b.y) * dt * 1.5;
    if (!b.atk && b.cd <= 0) nextAtk(b, b.phase === 1 ? ['shards', 'ray', 'icicles'] : b.phase === 2 ? ['shards', 'ray', 'icicles', 'drones'] : ['spiral', 'ray', 'icicles', 'shards'], 0);
    if (!b.atk) return; b.atkT += dt * sp;
    if (b.atk === 'shards') { if (b.atkT > .5 && b.n < 3 && b.atkT > .5 + b.n * .45) { b.n++; const base = Math.atan2(P.y - b.y, px() - b.x); for (let i = -3; i <= 3; i++) bShot(b.x, b.y + 30, base + i * .16, 320, { dmg: 10, r: 6, type: 'ice' }); Snd.play('laser', .5); } if (b.atkT > 2) { b.atk = null; b.cd = .8; } }
    else if (b.atk === 'ray') { if (b.n === 0) { b.n = 1; const tx = px(), ty = P.y + 30, a = Math.atan2(ty - b.y, tx - b.x); Haz.beam({ x1: b.x, y1: b.y, x2: b.x + Math.cos(a) * 900, y2: b.y + Math.sin(a) * 900, warn: .9 / sp, dur: .5, w: 20, dmg: 18, c: '#7ad8ff', freeze: true }); } if (b.atkT > 1.6) { b.atk = null; b.cd = .7; } }
    else if (b.atk === 'icicles') { const N = b.phase >= 2 ? 8 : 6; if (b.n < N && b.atkT > .2 + b.n * .18) { b.n++; const x = b.ax + 40 + ((b.n * 137 + Math.floor(b.t * 10)) % 880); Haz.mark(x - 16, FLOOR - 8, 32, 8, .9); setTimeout(() => { if (G.state === 'play' && !b.dying) G.B.push({ x, y: Cam.y - 20, vx: 0, vy: 860, own: 'e', dmg: 16, life: 1.5, r: 8, type: 'icicle' }); }, 800); } if (b.atkT > 2.4) { b.atk = null; b.cd = .7; } }
    else if (b.atk === 'drones') { if (b.n < 2 && b.atkT > .4 + b.n * .5) { b.n++; spawnEnemy('drone', b.x, b.y + 40); } if (b.atkT > 1.5) { b.atk = null; b.cd = 1.2; } }
    else if (b.atk === 'spiral') { if (b.atkT > .4 && b.n < 40 && b.atkT > .4 + b.n * .06) { b.n++; const a = b.n * .55; bShot(b.x, b.y, a, 260, { dmg: 9, r: 5, type: 'ice' }); bShot(b.x, b.y, a + Math.PI, 260, { dmg: 9, r: 5, type: 'ice' }); if (b.n % 3 === 0) Snd.play('eLaser', .4); } if (b.atkT > 3.2) { b.atk = null; b.cd = .9; } }
  },
  draw(g, b) {
    const fl = b.flash > 0, x = b.x, y = b.y;
    g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 10, x, y, 200); gr.addColorStop(0, 'rgba(140,220,255,.25)'); gr.addColorStop(1, 'rgba(140,220,255,0)'); g.fillStyle = gr; g.fillRect(x - 200, y - 200, 400, 400); g.restore();
    g.fillStyle = fl ? '#fff' : '#3a5a80'; g.strokeStyle = '#000'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x - 110, y); g.lineTo(x - 60, y - 70); g.lineTo(x + 60, y - 70); g.lineTo(x + 110, y); g.lineTo(x + 60, y + 70); g.lineTo(x - 60, y + 70); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#bfe8ff'; for (let i = 0; i < 6; i++) { const a = b.t * .8 + i / 6 * TAU, r = 120; g.save(); g.translate(x + Math.cos(a) * r, y + Math.sin(a) * r * .5); g.rotate(a); g.beginPath(); g.moveTo(-6, 0); g.lineTo(0, -22); g.lineTo(6, 0); g.lineTo(0, 10); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    g.fillStyle = '#d8f0ff'; g.beginPath(); g.moveTo(x - 60, y + 70); g.lineTo(x - 40, y + 110); g.lineTo(x - 20, y + 70); g.moveTo(x + 20, y + 70); g.lineTo(x + 40, y + 110); g.lineTo(x + 60, y + 70); g.fill(); g.stroke();
    plate(g, x - 30, y - 26, 60, 52, '#0a1424', fl); const charging = b.atk && b.atkT < .6; glowDot(g, x + clamp(px() - x, -10, 10) * .5, y, 16, charging ? 'rgba(255,255,255,.95)' : 'rgba(110,210,255,.85)', .8 + .2 * Math.sin(b.t * 12));
  }
},
/* 5. OVERLORD ZERO — fortress gate (two cannons + core), then the Overlord battle mech */
{ hp: 4600,
  init(b) { b.x = b.ax + 700; b.y = FLOOR - 340; b.cd = 1.4; b.stage = 1; b.guns = [{ x: 0, y: 0, w: 70, h: 50, hp: 700 * DIFF().ehp, id: 'g1', ry: 70 }, { x: 0, y: 0, w: 70, h: 50, hp: 700 * DIFF().ehp, id: 'g2', ry: 210 }]; b.mx = b.ax + 700; b.my = FLOOR - 120; b.mvx = 0; b.mvy = 0; b.face = -1; b.mjT = 0; },
  box(b) { return b.stage === 1 ? { x: b.x, y: b.y, w: 260, h: 340 } : { x: b.mx - 60, y: b.my - 120, w: 120, h: 120 }; },
  parts(b) {
    if (b.stage === 1) { for (const gg of b.guns) { gg.x = b.x - 40; gg.y = b.y + gg.ry; } const open = b.guns.every(gg => gg.dead); return [...b.guns.filter(gg => !gg.dead), { x: b.x + 70, y: b.y + 120, w: 90, h: 100, weak: open, armor: open ? 1 : 0 }, { x: b.x + 20, y: b.y, w: 240, h: 340, armor: .05 }]; }
    return [{ x: b.mx - 18, y: b.my - 112, w: 36, h: 30, weak: true }, { x: b.mx - 34, y: b.my - 84, w: 68, h: 84, armor: .5, contact: 20 }];
  },
  partDead(b, p) { Snd.play('alarm'); FX.text(p.x + 30, p.y - 10, 'CANNON DOWN', '#ffd84a', 18); if (b.guns.every(gg => gg.dead)) FX.text(b.x + 110, b.y + 100, 'CORE EXPOSED!', '#ff4a4a', 22); },
  phase(b, ph) { if (ph >= 2 && b.stage === 1) { b.stage = 2; b.hp = b.maxHp * .6; FX.explode(b.x + 120, b.y + 170, 200); FX.flash(.8); Cam.add(26); FX.text(Cam.x + W / 2, 160, 'OVERLORD ZERO EMERGES', '#ff3a4a', 28); b.my = b.y + 200; b.mx = b.x + 120; b.mvy = -900; Music.intensity = 1; } if (ph === 3) { FX.text(Cam.x + W / 2, 200, 'SECURITY LASERS ONLINE', '#ff6a6a', 20); } },
  update(b, dt) {
    const sp = b.phase === 3 ? 1.35 : 1; b.cd -= dt * sp;
    if (b.stage === 1) {
      for (const gg of b.guns) gg.flash = Math.max(0, (gg.flash || 0) - dt);
      if (!b.atk && b.cd <= 0) nextAtk(b, ['cannons', 'cannons', 'mortars', 'troops'], 0);
      if (!b.atk) return; b.atkT += dt;
      if (b.atk === 'cannons') { if (b.atkT > .5 && b.n < 8 && b.atkT > .5 + b.n * .22) { b.n++; for (const gg of b.guns) if (!gg.dead) { const a = Math.atan2(P.y + 20 - (gg.y + 25), px() - gg.x) + rnd(-.08, .08); bShot(gg.x, gg.y + 25, a, 400, { dmg: 11, r: 6, col: '#ff5a3a' }); } Snd.play('enemyShot', .6); } if (b.atkT > 2.6) { b.atk = null; b.cd = .9; } }
      else if (b.atk === 'mortars') { if (b.n < 4 && b.atkT > .3 + b.n * .3) { b.n++; mortar(b.x + 120, b.y, clamp(px() + rnd(-120, 120), b.ax + 30, b.x - 60)); } if (b.atkT > 2.2) { b.atk = null; b.cd = .8; } }
      else if (b.atk === 'troops') { if (b.n < 2 && b.atkT > .3 + b.n * .6) { b.n++; spawnEnemy(b.n === 2 ? 'shield' : 'soldier', b.ax + 960 - 300, FLOOR); } if (b.atkT > 1.6) { b.atk = null; b.cd = 1.4; } }
      return;
    }
    // stage 2: battle mech
    b.mvy += GRAV * dt; b.my += b.mvy * dt; b.mx += b.mvx * dt; if (b.my >= FLOOR) { if (b.mvy > 400) { Cam.add(12); Snd.play('boom', .6); FX.smoke(b.mx, FLOOR, 6); } b.my = FLOOR; b.mvy = 0; b.mvx *= .85; b.grounded = true; } else b.grounded = false;
    b.mx = clamp(b.mx, b.ax + 60, b.ax + 960 - 100); b.face = px() < b.mx ? -1 : 1;
    if (b.phase === 3) { b.lz = (b.lz || 0) - dt; if (b.lz <= 0) { b.lz = 3.2; const hi = Math.random() < .5, y = hi ? FLOOR - 50 : FLOOR - 14; Haz.beam({ x1: b.ax, y1: y, x2: b.ax + 960, y2: y, warn: 1, dur: .35, w: 14, dmg: 20, c: '#ff2a4a' }); } }
    if (!b.atk && b.cd <= 0) nextAtk(b, b.phase === 2 ? ['leap', 'spread', 'dash', 'plasma'] : ['leap', 'spread', 'dash', 'plasma', 'spiral'], 0);
    if (!b.atk) return; b.atkT += dt * sp;
    if (b.atk === 'leap') { if (b.n === 0 && b.grounded) { b.n = 1; b.mvy = -1050; b.mvx = (px() - b.mx) * 1.05; Snd.play('djump'); } if (b.n === 1 && b.atkT > .2 && b.grounded) { b.n = 2; Haz.wave(b.mx - 30, -1, { c: '#ff4a6a' }); Haz.wave(b.mx + 30, 1, { c: '#ff4a6a' }); } if (b.atkT > 1.6) { b.atk = null; b.cd = .5; } }
    else if (b.atk === 'spread') { if (b.atkT > .45 && b.n < 4 && b.atkT > .45 + b.n * .35) { b.n++; const base = Math.atan2(P.y + 20 - (b.my - 70), px() - b.mx); for (let i = -2; i <= 2; i++) bShot(b.mx + b.face * 30, b.my - 70, base + i * .18, 380, { dmg: 11, r: 6, col: '#ff3a6a' }); Snd.play('enemyShot'); } if (b.atkT > 2) { b.atk = null; b.cd = .6; } }
    else if (b.atk === 'dash') { if (b.n === 0) { b.n = 1; Haz.mark(Math.min(b.mx, px()) - 40, FLOOR - 90, Math.abs(px() - b.mx) + 80, 90, .6, '#ff3a6a'); } if (b.atkT > .6 && b.n === 1) { b.n = 2; b.mvx = b.face * 1100; } if (b.n === 2 && Math.random() < .6) FX.p({ x: b.mx, y: b.my - 50, life: .3, s: 30, s2: 4, c: 'rgba(255,40,90,.35)', add: true }); if (b.atkT > 1.3) { b.atk = null; b.cd = .6; } }
    else if (b.atk === 'plasma') { if (b.atkT > .9 && b.n === 0) { b.n = 1; bShot(b.mx + b.face * 40, b.my - 60, b.face > 0 ? 0 : Math.PI, 260, { dmg: 26, r: 20, type: 'eplasma', life: 5, home: .7 }); Snd.play('plasma', .7); Cam.add(8); } if (b.atkT > 1.8) { b.atk = null; b.cd = .7; } }
    else if (b.atk === 'spiral') { if (b.atkT > .5 && b.n < 36 && b.atkT > .5 + b.n * .05) { b.n++; const a = b.n * .5; for (let k = 0; k < 3; k++) bShot(b.mx, b.my - 70, a + k * TAU / 3, 250, { dmg: 9, r: 5, col: '#ff6a9a' }); } if (b.atkT > 2.6) { b.atk = null; b.cd = .8; } }
  },
  draw(g, b) {
    const fl = b.flash > 0;
    if (b.stage === 1) { const x = b.x, y = b.y; plate(g, x + 20, y, 240, 340, '#3a2a30', fl); g.fillStyle = '#2a1c22'; for (let i = 0; i < 8; i++) g.fillRect(x + 30, y + 20 + i * 40, 220, 6); for (let i = 0; i < 6; i++) plate(g, x + 20 + i * 40, y - 22, 26, 24, '#4a3a40', fl);
      const open = b.guns.every(gg => gg.dead); plate(g, x + 70, y + 120, 90, 100, '#1a1014', fl); if (open) glowDot(g, x + 115, y + 170, 28, 'rgba(255,40,70,.9)', .8 + .2 * Math.sin(b.t * 12)); else { g.fillStyle = '#5a4a50'; g.fillRect(x + 76, y + 126, 78, 88); g.fillStyle = '#ff3a4a'; g.font = '900 16px Impact'; g.textAlign = 'center'; g.fillText('Ω', x + 115, y + 176); }
      for (const gg of b.guns) { if (gg.dead) { g.fillStyle = '#1a1a1a'; g.fillRect(b.x - 40, b.y + gg.ry, 50, 50); if (Math.random() < .2) FX.smoke(b.x - 20, b.y + gg.ry + 20, 1); continue; } plate(g, b.x - 40, b.y + gg.ry, 70, 50, '#5a4a50', gg.flash > 0); g.save(); g.translate(b.x - 30, b.y + gg.ry + 25); g.rotate(Math.atan2(P.y - (b.y + gg.ry), px() - b.x)); g.fillStyle = '#1a1a1a'; g.fillRect(-4, -7, -40, 14); g.restore(); const hpk = gg.hp / (700 * DIFF().ehp); g.fillStyle = '#000'; g.fillRect(b.x - 40, b.y + gg.ry - 10, 70, 5); g.fillStyle = '#ffb020'; g.fillRect(b.x - 40, b.y + gg.ry - 10, 70 * Math.max(0, hpk), 5); }
      return; }
    const x = b.mx, y = b.my, f = b.face;
    g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y - 60, 10, x, y - 60, 120); gr.addColorStop(0, 'rgba(255,40,80,.3)'); gr.addColorStop(1, 'rgba(255,40,80,0)'); g.fillStyle = gr; g.fillRect(x - 120, y - 180, 240, 240); g.restore();
    drawStick(g, { x, y, face: f, run: b.t * 8, spd: Math.min(1, Math.abs(b.mvx) / 300), air: !b.grounded, vy: b.mvy, aim: f > 0 ? Math.atan2(P.y - y + 60, px() - x) : Math.atan2(P.y - y + 60, px() - x), wpn: 'plasma', body: fl ? '#fff' : '#1a0a10', helmet: '#5a1020', visor: '#ff2a4a', glow: 1, armor: '#4a1a24', belt: '#ff3a4a', s: 2.1, t: b.t });
    glowDot(g, x + f * 4, y - 104, 8, 'rgba(255,40,80,.9)');
  }
}
];
