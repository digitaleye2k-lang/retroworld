'use strict';
/* ===== SHADOW PROTOCOL :: game — state, time dilation, missions, menus, main loop ===== */
const G = {
  state: 'menu', time: 0, rt: 0, ws: 1, bt: false, mi: 0, stats: {}, glows: [], timers: [], flash: 0, hitstop: 0, pdT: 0, shock: null, plight: 1, plT: 0,
  wave: 0, waveT: 0, surviveT: 0, phase: 'fight', objective: '', introT: 0, hint: '', wmx: 0, wmy: 0, fps: 60, total: 0, deathT: 0,
  after(d, fn) { this.timers.push({ t: this.time + d, fn }); },
  onPlayerDeath() { this.deathT = 1.8; }
};
const HINTS = ['WASD to move — the mouse aims independently — LEFT CLICK to shoot', 'SHIFT: combat slide. Bullets pass over you while you slide — keep shooting', 'SPACE: dodge roll with invulnerability. Press SPACE during a slide to chain into a roll',
  'C: slow-motion dive (no direction = backwards). Hold SHIFT as you land to slide out of it', 'Q: BULLET TIME. Watch the tracers, step between them, pick your shots', 'Let a bullet barely miss you while moving for a PERFECT DODGE',
  'E near an enemy: takedown. Slide into them first to knock them down', 'V: jump over desks and crates. SPACE next to a wall mid-air or mid-slide: wall kick', 'Shoot barrels, glass, lights and fuse boxes. F flips desks into cover and opens doors', 'R reloads — tap R again in the green zone for a PERFECT RELOAD. RIGHT CLICK steadies your aim'];

function newStats() { return { kills: 0, shots: 0, hits: 0, heads: 0, dmg: 0, time: 0, dodges: 0, glass: 0, lights: 0, flips: 0, explosions: 0, env: 0, moves: 0, bt: 0, takedowns: 0, deadeye: 0 }; }
function clearScene() { Enemies.length = 0; Bullets.length = 0; FX.parts.length = 0; FX.flashes.length = 0; FX.texts.length = 0; G.glows = []; G.timers = []; G.time = 0; G.ws = 1; G.bt = false; G.flash = 0; G.hitstop = 0; G.pdT = 0; G.shock = null; }
function startMission(i) {
  const m = MISSIONS[i]; G.mi = i; G.state = 'load'; clearScene(); G.stats = newStats();
  Save.data.loadout = Save.data.loadout.filter(id => WEAPONS[id] && WEAPONS[id].unlock < Save.data.unlocked); if (!Save.data.loadout.length) Save.data.loadout = ['pistol'];
  buildLevel(m); resetPlayer(World.start.x, World.start.y);
  for (const s of World.spawnPlan) spawnEnemy(s.type, s.x, s.y, { patrol: s.patrol, face: s.face });
  G.total = Enemies.length; for (const w of m.waves || []) for (const k in w) G.total += w[k];
  Style.reset(); Cam.x = P.x; Cam.y = P.y; Cam.zoom = 1.25; Cam.trauma = 0;
  G.phase = 'fight'; G.wave = 0; G.waveT = 14; G.surviveT = m.survive || 0; G.introT = 3.4; G.deathT = 0; G.plight = lightAt(P.x, P.y);
  UI.hide(); G.state = 'play'; Input.clear(); Snd.init();
}
function spawnWave(def) {
  let tiles = World.spawnTiles.filter(t => { const x = t.tx * TS + 20, y = t.ty * TS + 20; return walkT(tIdx(t.tx, t.ty)) && dist(x, y, P.x, P.y) > 480 && !losClear(x, y, P.x, P.y); });
  if (tiles.length < 4) tiles = World.spawnTiles.filter(t => dist(t.tx * TS + 20, t.ty * TS + 20, P.x, P.y) > 380); if (!tiles.length) tiles = World.spawnTiles;
  for (const type in def) for (let n = 0; n < def[type]; n++) { const t = pick(tiles); spawnEnemy(type, t.tx * TS + 20 + rand(-8, 8), t.ty * TS + 20 + rand(-8, 8), { hunt: true }); }
  Style.note('REINFORCEMENTS', null, 2);
}
function updateObjective(dt) {
  const m = MISSIONS[G.mi]; let alive = 0; for (const e of Enemies) if (e.alive) alive++;
  const waves = m.waves || [];
  if (G.phase === 'fight') {
    if (m.survive) {
      G.surviveT -= dt; G.waveT -= dt;
      if ((G.waveT <= 0 || alive <= 1) && G.surviveT > 8) { spawnWave(waves[G.wave++ % waves.length]); G.waveT = 22; }
      G.objective = `HOLD OUT — EXTRACTION IN ${Math.max(0, Math.ceil(G.surviveT))}s`;
      if (G.surviveT <= 0) G.phase = 'exit';
    } else {
      if (alive <= 1 && G.wave < waves.length) spawnWave(waves[G.wave++]);
      else if (alive === 0) G.phase = 'exit';
      if (alive <= 3) for (const e of Enemies) if (e.alive && !e.alert) e.alertTo(P.x, P.y, false); // stragglers come to you
      G.objective = (m.boss && Enemies.some(e => e.alive && e.def.boss) ? 'ELIMINATE THE DIRECTOR — ' : 'ELIMINATE ALL HOSTILES — ') + alive + ' REMAINING' + (G.wave < waves.length ? '  (REINFORCEMENTS INBOUND)' : '');
    }
    if (G.phase === 'exit') { World.exitOpen = true; Style.note(m.survive ? 'EXTRACTION READY' : 'AREA CLEAR', null, 2); }
  } else { G.objective = 'REACH THE EXTRACTION POINT'; if (P.alive && dist(P.x, P.y, World.exit.x, World.exit.y) < World.exit.r) finishMission(); }
  G.hint = m.tutorial && G.stats.time < HINTS.length * 8 ? HINTS[Math.floor(G.stats.time / 8) % HINTS.length] : '';
}
function finishMission() {
  const s = G.stats, acc = s.shots ? s.hits / s.shots : 0, par = Math.max(G.total, s.kills) * 330;
  const q = Style.score / par + acc * .35 - s.dmg / 350;
  const rank = q >= 2.2 ? 4 : q >= 1.6 ? 3 : q >= 1.1 ? 2 : q >= .65 ? 1 : 0, credits = Math.floor(Style.score / 40) + rank * 60;
  const d = Save.data, prev = d.best[G.mi]; const newBest = !prev || Style.score > prev.score;
  if (newBest) d.best[G.mi] = { score: Style.score, rank: Math.max(rank, prev ? prev.rank : 0) }; else if (rank > prev.rank) prev.rank = rank;
  d.credits += credits; const before = d.unlocked; d.unlocked = Math.min(MISSIONS.length, Math.max(d.unlocked, G.mi + 2));
  const newW = WEAPON_ORDER.filter(id => WEAPONS[id].unlock >= before && WEAPONS[id].unlock < d.unlocked);
  Save.write(); if (G.bt) endBT(); G.state = 'results'; Snd.play('rank'); Snd.setSlow(0);
  UI.results({ rank, credits, acc, newBest, newW });
}

G.tick = function (rdt) {
  if (G.state === 'intro' || G.state === 'story') { G.rt += rdt; Snd.slowK = 0; Music.update(rdt, 0, G.state === 'story' ? 'menu' : 'none'); return; }
  if (G.state === 'menu') { G.rt += rdt; if (World.bg) { Cam.x = World.W * TS / 2 + Math.cos(G.rt * .07) * World.W * TS * .25; Cam.y = World.H * TS / 2 + Math.sin(G.rt * .09) * World.H * TS * .25; Cam.zoom = 1; Cam.sx = Cam.sy = 0; updateWorld(rdt); G.time += rdt; } Music.update(rdt, 1, 'menu'); return; }
  if (G.state !== 'play') { Snd.slowK = 0; Music.update(rdt, G.state === 'results' ? .55 : G.state === 'dead' ? 0 : .08, 'game'); return; } // paused / dead: the track sinks under a low-pass
  // ---- time dilation: world scale vs. player scale ----
  let target = 1;
  if (G.bt) target = .25;
  if (P.state === 'dive') target = Math.min(target, .5); else if (P.state === 'jump') target = Math.min(target, .8);
  if (P.focusSlow) target = Math.min(target, .5);
  if (P.reflexT > 0) target = Math.min(target, .2);
  if (P.state === 'takedown') target = Math.min(target, .4);
  if (P.de.mode === 1) target = .04; else if (P.de.mode === 2) target = .12;
  if (G.pdT > 0) { G.pdT -= rdt; target *= .4; } // perfect dodge: time slows even further for a beat
  if (!P.alive) target = .3;
  G.ws = lerp(G.ws, target, damp(target < G.ws ? 20 : 6, rdt));
  let ws = G.ws; if (G.hitstop > 0) { G.hitstop -= rdt; ws = .02; }
  const dt = rdt * ws;
  let ps = (P.state === 'dive' || P.state === 'jump' || P.state === 'takedown') ? Math.min(1, ws * 1.35) : lerp(1, ws, .4); // player stays far more responsive than the world
  if (P.de.mode) ps = Math.min(ps, .2); if (G.hitstop > 0) ps = .05;
  G.time += dt; G.rt += rdt; G.stats.time += rdt; G.introT -= rdt;
  View.S = viewScale(); G.wmx = Cam.x + Cam.sx + (Input.mx - View.w / 2) / View.S; G.wmy = Cam.y + Cam.sy + (Input.my - View.h / 2) / View.S; // matches the drawn crosshair even mid-shake
  G.plT -= rdt; if (G.plT <= 0) { G.plT = .2; G.plight = Math.max(lightAt(P.x, P.y), P.muzzleT > -0.3 ? .8 : 0); }
  updatePlayer(rdt * ps, rdt);
  for (const e of Enemies) e.update(dt);
  for (let i = Enemies.length - 1; i >= 0; i--) if (Enemies[i].remove) Enemies.splice(i, 1);
  updateBullets(dt); FX.update(dt, rdt); updateWorld(dt);
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.timers[i].t <= G.time) { const t = G.timers.splice(i, 1)[0]; t.fn(); }
  for (const g of G.glows) g.t -= rdt; G.glows = G.glows.filter(g => g.t > 0);
  if (G.shock) { G.shock.t += rdt; if (G.shock.t > .6) G.shock = null; }
  G.flash = Math.max(0, G.flash - rdt * 2.5);
  Style.update(rdt); if (G.state === 'play') updateObjective(dt);
  Cam.update(rdt);
  Snd.setSlow(clamp(1 - G.ws, 0, 1));
  let al = 0; for (const e of Enemies) if (e.alive && e.alert) al++;
  // scene intensity drives the soundtrack: threats, bullets in the air, combo heat, danger
  let eb = 0; for (const b of Bullets) if (b.owner === 'e') eb++;
  const heat = !P.alive ? 0 : clamp(.16 + al * .16 + Math.min(.3, eb * .03) + Math.min(.2, Style.combo * .02) + (P.hp < P.maxHp * .3 ? .15 : 0) + (G.introT > 0 ? .25 : 0) + (World.exitOpen ? .2 : 0), 0, 1);
  Music.update(rdt, heat, 'game');
  if (!P.alive && G.state === 'play') { G.deathT -= rdt; if (G.deathT <= 0) { G.state = 'dead'; Snd.setSlow(0); UI.dead(); } }
  if (Input.hit('Escape') || Input.hit('KeyP')) pauseGame();
};
function pauseGame() { if (G.state !== 'play') return; G.state = 'pause'; Input.clear(); Snd.setSlow(0); UI.pause(); }

/* ---------------- menus (DOM overlay) ---------------- */
const UI = {
  el: null, back: 'main',
  show(html, cls = '') { this.el.className = 'on ' + cls; this.el.innerHTML = html; document.body.classList.remove('playing'); },
  hide() { this.el.className = ''; this.el.innerHTML = ''; document.body.classList.add('playing'); },
  title: `<div class="logo"><span>SHADOW</span><b>PROTOCOL</b></div>`,
  main() {
    const d = Save.data, next = Math.min(d.unlocked, MISSIONS.length) - 1;
    this.show(`${this.title}<div class="tag">CINEMATIC TOP-DOWN STICKMAN SHOOTER</div>
      <div class="menu"><button data-a="play:${next}">PLAY <small>${d.unlocked > 1 ? 'CONTINUE — ' : ''}MISSION ${next + 1}: ${MISSIONS[next].name}</small></button>
      <button data-a="levels">LEVEL SELECT</button><button data-a="loadout">WEAPON LOADOUT</button><button data-a="upgrades">UPGRADES <small>${d.credits} CREDITS</small></button><button data-a="settings:main">SETTINGS</button><button data-a="story">STORY <small>READ THE COMIC · <u data-a="intro">REPLAY INTRO VIDEO</u></small></button></div>
      <div class="keys">${this.keys()}</div>`, 'main');
  },
  keys() { return [['WASD', 'Move'], ['MOUSE', 'Aim'], ['LMB', 'Shoot'], ['RMB', 'Focus aim'], ['SHIFT', 'Slide'], ['SPACE', 'Roll / wall kick'], ['C', 'Dive'], ['V', 'Jump'], ['Q', 'Bullet time'], ['E', 'Takedown'], ['R', 'Reload'], ['F', 'Interact'], ['X', 'Dead Eye'], ['1-3', 'Weapons'], ['ESC', 'Pause']].map(k => `<span><kbd>${k[0]}</kbd>${k[1]}</span>`).join(''); },
  levels() {
    const d = Save.data;
    this.show(`<h2>LEVEL SELECT</h2><div class="grid">${MISSIONS.map((m, i) => { const open = i < d.unlocked, b = d.best[i]; return `<button class="card ${open ? '' : 'locked'}" ${open ? `data-a="play:${i}"` : 'disabled'}><i>${String(i + 1).padStart(2, '0')}</i><b>${m.name}</b><small>${open ? m.sub : 'LOCKED'}</small>${b ? `<em class="r${b.rank}">${RANKS[b.rank]}</em><u>${b.score.toLocaleString()}</u>` : ''}</button>`; }).join('')}</div><button class="back" data-a="main">BACK</button>`);
  },
  loadout() {
    const d = Save.data;
    this.show(`<h2>WEAPON LOADOUT</h2><p class="sub">Choose up to three weapons. Order = slot number.</p><div class="grid">${WEAPON_ORDER.map(id => { const w = WEAPONS[id], open = w.unlock < d.unlocked, slot = d.loadout.indexOf(id); return `<button class="card ${open ? '' : 'locked'} ${slot >= 0 ? 'sel' : ''}" ${open ? `data-a="equip:${id}"` : 'disabled'}><i>${slot >= 0 ? 'SLOT ' + (slot + 1) : ''}</i><b>${w.name}</b><small>${open ? w.desc : 'Complete mission ' + w.unlock + ' to unlock'}</small><u>DMG ${w.dmg}${w.pellets ? '×' + w.pellets : ''} · MAG ${w.mag} · RPM ${Math.round(60 / w.rate)} · PEN ${w.pen}</u></button>`; }).join('')}</div><button class="back" data-a="main">BACK</button>`);
  },
  upgrades() {
    const d = Save.data;
    const up = Object.entries(UPGRADES).map(([k, u]) => { const lv = d.upgrades[k] || 0, max = lv >= u.max, c = u.cost[lv]; return `<button class="card ${max ? 'sel' : ''}" ${max ? 'disabled' : `data-a="buy:${k}"`}><i>${'■'.repeat(lv)}${'□'.repeat(u.max - lv)}</i><b>${u.name}</b><small>${u.desc}</small><u>${max ? 'MAXED' : c + ' CREDITS'}</u></button>`; }).join('');
    const ab = Object.entries(ABILITIES).map(([k, a]) => { const own = d.abilities[k]; return `<button class="card ab ${own ? 'sel' : ''}" ${own ? 'disabled' : `data-a="ability:${k}"`}><i>${a.key}</i><b>${a.name}</b><small>${a.desc}</small><u>${own ? 'UNLOCKED' : a.cost + ' CREDITS'}</u></button>`; }).join('');
    this.show(`<h2>UPGRADES</h2><p class="sub">CREDITS: <b class="cr">${d.credits}</b> — earned from style score and mission rank.</p><h3>OPERATIVE</h3><div class="grid">${up}</div><h3>CINEMATIC ABILITIES</h3><div class="grid">${ab}</div><button class="back" data-a="main">BACK</button>`);
  },
  settings(back) {
    const s = Save.data.settings; this.back = back || this.back; const tg = (k, l) => `<button data-a="toggle:${k}">${l} <small>${s[k] ? 'ON' : 'OFF'}</small></button>`;
    this.show(`<h2>SETTINGS</h2><div class="menu"><button data-a="diff">DIFFICULTY <small>${DIFF().name} — ${s.diff === 'hard' ? 'enemies hit harder and react faster' : s.diff === 'normal' ? 'balanced; slow health recovery' : 'enemies deal less than half damage, aim worse, react slower; health recovers out of combat'}</small></button><label>MASTER VOLUME <input type="range" min="0" max="100" value="${Math.round(s.vol * 100)}" id="vol"></label>${tg('music', 'MUSIC')}${tg('shake', 'SCREEN SHAKE')}${tg('fx', 'CHROMATIC SLOW-MO FX')}${tg('fps', 'FPS COUNTER')}<button data-a="reset" class="danger">RESET ALL PROGRESS</button></div><button class="back" data-a="${this.back === 'pause' ? 'pausemenu' : 'main'}">BACK</button>`);
    document.getElementById('vol').oninput = e => { s.vol = e.target.value / 100; Snd.setVol(s.vol); Save.write(); };
  },
  pause() { this.show(`<h2>PAUSED</h2><div class="menu"><button data-a="resume">RESUME</button><button data-a="restart">RESTART MISSION</button><button data-a="settings:pause">SETTINGS</button><button data-a="quit">QUIT TO MENU</button></div><div class="keys">${this.keys()}</div>`, 'dim'); },
  dead() { this.show(`<h2 class="red">OPERATIVE DOWN</h2><p class="sub">Style ${Style.score.toLocaleString()} · ${G.stats.kills} kills</p><div class="menu"><button data-a="restart">RETRY</button><button data-a="quit">QUIT TO MENU</button></div>`, 'dim'); },
  results(r) {
    const s = G.stats, t = s.time, row = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    this.show(`<h2>MISSION COMPLETE</h2><p class="sub">${MISSIONS[G.mi].name}</p><div class="res"><div class="stats">
      ${row('TOTAL KILLS', s.kills)}${row('ACCURACY', Math.round(r.acc * 100) + '%')}${row('HEADSHOTS', s.heads)}${row('HIGHEST COMBO', Style.best)}${row('PERFECT DODGES', s.dodges)}${row('ENVIRONMENTAL KILLS', s.env)}${s.burned ? row('ROASTED', s.burned) : ''}${row('DAMAGE RECEIVED', Math.round(s.dmg))}${row('TIME TAKEN', Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'))}${row('STYLE SCORE', Style.score.toLocaleString() + (r.newBest ? ' ★' : ''))}${row('CREDITS EARNED', '+' + r.credits)}</div>
      <div class="rank r${r.rank}"><small>OVERALL RANK</small>${RANKS[r.rank]}</div></div>${r.newW.length ? `<p class="unl">NEW WEAPON UNLOCKED: ${r.newW.map(id => WEAPONS[id].name).join(', ')} — equip it in WEAPON LOADOUT</p>` : ''}
      <div class="menu row">${G.mi + 1 < MISSIONS.length ? `<button data-a="play:${G.mi + 1}">NEXT MISSION</button>` : '<button data-a="ending">EPILOGUE</button>'}<button data-a="restart">REPLAY</button><button data-a="quit">MENU</button></div>`, 'dim');
  },
  act(a) {
    const [cmd, arg] = a.split(':'), d = Save.data; Snd.init(); Snd.play('uiOk');
    if (cmd === 'play') Story.show(briefing(+arg), () => startMission(+arg)); // comic briefing panel, then the mission
    else if (cmd === 'story') Story.show(PROLOGUE, () => this.main());
    else if (cmd === 'intro') Intro.start(() => { G.state = 'menu'; this.main(); }, false);
    else if (cmd === 'ending') Story.show(ENDING, () => { G.state = 'menu'; menuBackdrop(); this.main(); });
    else if (cmd === 'main') this.main(); else if (cmd === 'levels') this.levels(); else if (cmd === 'loadout') this.loadout(); else if (cmd === 'upgrades') this.upgrades();
    else if (cmd === 'settings') this.settings(arg); else if (cmd === 'pausemenu') this.pause();
    else if (cmd === 'equip') { const i = d.loadout.indexOf(arg); if (i >= 0) { if (d.loadout.length > 1) d.loadout.splice(i, 1); } else if (d.loadout.length < 3) d.loadout.push(arg); else Snd.play('deny'); Save.write(); this.loadout(); }
    else if (cmd === 'buy') { const u = UPGRADES[arg], lv = d.upgrades[arg] || 0; if (lv < u.max && d.credits >= u.cost[lv]) { d.credits -= u.cost[lv]; d.upgrades[arg] = lv + 1; Save.write(); } else Snd.play('deny'); this.upgrades(); }
    else if (cmd === 'ability') { const ab = ABILITIES[arg]; if (!d.abilities[arg] && d.credits >= ab.cost) { d.credits -= ab.cost; d.abilities[arg] = true; Save.write(); } else Snd.play('deny'); this.upgrades(); }
    else if (cmd === 'diff') { const o = ['easy', 'normal', 'hard']; d.settings.diff = o[(o.indexOf(d.settings.diff) + 1) % 3] || 'easy'; Save.write(); this.settings(); }
    else if (cmd === 'toggle') { d.settings[arg] = !d.settings[arg]; Save.write(); this.settings(); }
    else if (cmd === 'reset') { if (confirm('Erase all progress, unlocks and credits?')) { Save.reset(); Snd.setVol(Save.data.settings.vol); this.main(); } }
    else if (cmd === 'resume') { this.hide(); G.state = 'play'; Input.clear(); }
    else if (cmd === 'restart') startMission(G.mi);
    else if (cmd === 'quit') { G.state = 'menu'; menuBackdrop(); this.main(); }
  }
};
function menuBackdrop() { clearScene(); buildLevel(MISSIONS[1]); resetPlayer(World.start.x, World.start.y); P.aim = -1; updateRig(P, .016); Style.reset(); }

/* ---------------- boot ---------------- */
function boot() {
  const canvas = document.getElementById('c'); initView(canvas); Input.init(canvas);
  UI.el = document.getElementById('ui');
  UI.el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) UI.act(b.dataset.a); });
  UI.el.addEventListener('mouseover', e => { if (e.target.closest('button')) Snd.play('ui'); });
  addEventListener('keydown', e => { if (e.code === 'Escape' && G.state === 'pause') { UI.hide(); G.state = 'play'; Input.clear(); } });
  addEventListener('blur', () => pauseGame());
  G.stats = newStats(); menuBackdrop(); UI.main(); Story.init(); Intro.init();
  // launch sequence: click-to-begin splash → intro video → comic prologue (first time only) → main menu
  Intro.start(() => { const go = () => { G.state = 'menu'; UI.main(); }; if (!Save.data.seenStory) Story.show(PROLOGUE, () => { Save.data.seenStory = true; Save.write(); go(); }); else go(); }, true);
  let last = performance.now();
  (function frame(now) {
    const rdt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now; G.fps = lerp(G.fps, 1 / rdt, .05);
    try { G.tick(rdt); render(); } catch (err) { console.error(err); G.lastError = String(err && err.stack || err); }
    Input.endFrame(); requestAnimationFrame(frame);
  })(last);
}
addEventListener('DOMContentLoaded', boot);
