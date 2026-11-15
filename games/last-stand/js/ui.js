'use strict';
/* ===== HUD + menus (canvas-drawn, keyboard / mouse / gamepad / touch) ===== */
const font = (s, w) => (w || 900) + ' ' + s + 'px Impact, "Arial Black", sans-serif';
const mono = s => '700 ' + s + 'px "Courier New", monospace';
function txt(g, s, x, y, sz, c, al, o) { g.font = (o && o.mono) ? mono(sz) : font(sz); g.textAlign = al || 'left'; g.textBaseline = 'alphabetic'; if (!o || o.stroke !== false) { g.lineWidth = Math.max(3, sz / 6); g.strokeStyle = '#000'; g.lineJoin = 'round'; g.strokeText(s, x, y); } g.fillStyle = c || '#fff'; g.fillText(s, x, y); }
const HUD = {
  draw(g) {
    if ((G.state !== "play" && G.state !== "pause") || window.__noHud) return;
    // health
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(14, 12, 250, 74); g.strokeStyle = 'rgba(255,255,255,.15)'; g.strokeRect(14.5, 12.5, 250, 74);
    txt(g, 'HP', 22, 34, 14, '#9fe8ff'); const hpk = clamp(P.hp / P.maxHp, 0, 1);
    for (let i = 0; i < 10; i++) { const on = hpk * 10 > i + .01; g.fillStyle = on ? (hpk < .3 ? '#ff3a3a' : hpk < .6 ? '#ffd84a' : '#5aff8a') : 'rgba(255,255,255,.1)'; g.fillRect(48 + i * 20, 22, 17, 14); }
    for (let i = 0; i < Math.min(8, G.lives); i++) { const x = 26 + i * 18, y = 56; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y - 6, 4, 0, TAU); g.moveTo(x, y - 2); g.lineTo(x, y + 6); g.moveTo(x - 5, y + 1); g.lineTo(x + 5, y + 1); g.moveTo(x, y + 6); g.lineTo(x - 4, y + 12); g.moveTo(x, y + 6); g.lineTo(x + 4, y + 12); g.stroke(); }
    if (G.lives > 8) txt(g, '+' + (G.lives - 8), 26 + 8 * 18, 66, 12);
    g.fillStyle = '#3a5a2a'; g.beginPath(); g.arc(196, 62, 7, 0, TAU); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); txt(g, '×' + P.gren, 208, 68, 16, '#ffd84a');
    // special meter
    const spk = P.sp / 100, full = spk >= 1; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(14, 90, 250, 20); g.fillStyle = full ? (Math.floor(G.t * 6) % 2 ? '#ffd84a' : '#ff6a3a') : '#c06bff'; g.fillRect(16, 92, 246 * spk, 16);
    txt(g, full ? 'LAST STAND READY · ' + kname('special') : 'LAST STAND', 140, 105, 11, '#fff', 'center');
    // score
    txt(g, String(G.score).padStart(8, '0'), W - 18, 38, 28, '#fff', 'right'); txt(g, 'HI ' + String(Math.max(Save.d.hi, G.score)).padStart(8, '0'), W - 18, 56, 12, '#9fe8ff', 'right');
    if (P.combo >= 3) txt(g, 'COMBO ×' + P.combo, W - 18, 80, 18 + Math.min(10, P.combo), '#ffd84a', 'right');
    // weapon panel
    const Wd = WEAPONS[P.cur], wy = Input.touchOn ? 186 : H; g.save(); g.translate(0, wy - H); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(14, H - 70, 300, 56); g.strokeStyle = Wd.col; g.lineWidth = 2; g.strokeRect(14.5, H - 69.5, 300, 56);
    txt(g, Wd.name, 24, H - 46, 18, Wd.col); txt(g, P.inv2[P.cur] === Infinity ? '∞' : String(P.inv2[P.cur]), 304, H - 46, 18, '#fff', 'right');
    let x = 24; for (const w of WORDER) { const own = P.inv2[w] > 0, cur = w === P.cur; g.fillStyle = cur ? WEAPONS[w].col : own ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.12)'; g.fillRect(x, H - 36, 36, 16); txt(g, WEAPONS[w].short, x + 18, H - 24, 11, cur ? '#000' : '#000', 'center', { stroke: false }); x += 40; }
    if (Wd.charge && P.charge > 0) { g.fillStyle = '#c06bff'; g.fillRect(14, H - 78, 300 * P.charge / Wd.charge, 5); }
    if (!Input.touchOn) txt(g, kname('swap') + ' SWAP', 318, H - 24, 10, 'rgba(255,255,255,.5)');
    g.restore();
    // level name / progress
    if (!G.boss) { const prog = clamp(P.x / World.arenaX, 0, 1); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(W / 2 - 150, 16, 300, 6); g.fillStyle = '#ff3a3a'; g.fillRect(W / 2 - 150, 16, 300 * prog, 6); for (const c of World.checkpoints) { g.fillStyle = '#5aff8a'; g.fillRect(W / 2 - 150 + 300 * clamp(c / World.arenaX, 0, 1) - 1, 13, 3, 12); } txt(g, 'MISSION ' + (G.li + 1) + ' · ' + LEVELS[G.li].name, W / 2, 40, 13, '#fff', 'center'); }
    // boss bar
    const b = Boss.b; if (G.boss && b && b.st !== 'intro' && !b.gone) { const k = b.hp / b.maxHp; const by = 30; g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(W / 2 - 200, by - 4, 400, 22); g.fillStyle = '#3a0a10'; g.fillRect(W / 2 - 196, by, 392, 14); g.fillStyle = b.flash > 0 ? '#fff' : '#ff2a3a'; g.fillRect(W / 2 - 196, by, 392 * k, 14); for (const m of [.62, .3]) { g.fillStyle = '#000'; g.fillRect(W / 2 - 196 + 392 * m - 1, by, 3, 14); } txt(g, b.name + (b.phase > 1 ? '  ·  PHASE ' + b.phase : ''), W / 2, by + 34, 15, '#ffb0b0', 'center'); }
    // banners
    if (G.banner > 0) { const a = Math.min(1, G.banner, (3 - G.banner) * 3); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H / 2 - 70, W, 120); txt(g, 'MISSION ' + (G.li + 1), W / 2, H / 2 - 30, 22, '#ff3a3a', 'center'); txt(g, LEVELS[G.li].name, W / 2, H / 2 + 14, 48, '#fff', 'center'); txt(g, LEVELS[G.li].sub, W / 2, H / 2 + 38, 14, '#9fe8ff', 'center'); g.globalAlpha = 1; }
    if (G.boss && b && b.st === 'intro') { const k = Math.floor(G.t * 4) % 2; g.fillStyle = k ? 'rgba(200,0,20,.55)' : 'rgba(120,0,10,.55)'; g.fillRect(0, H / 2 - 80, W, 140); g.fillStyle = '#ffd84a'; for (let i = -2; i < 22; i++) { g.beginPath(); const x0 = i * 60 + (G.t * 120) % 60; g.moveTo(x0, H / 2 - 80); g.lineTo(x0 + 30, H / 2 - 80); g.lineTo(x0 + 10, H / 2 - 66); g.lineTo(x0 - 20, H / 2 - 66); g.fill(); g.beginPath(); g.moveTo(x0, H / 2 + 60); g.lineTo(x0 + 30, H / 2 + 60); g.lineTo(x0 + 10, H / 2 + 46); g.lineTo(x0 - 20, H / 2 + 46); g.fill(); } txt(g, '⚠ WARNING ⚠', W / 2, H / 2 - 22, 30, '#ffd84a', 'center'); txt(g, b.name, W / 2, H / 2 + 22, 44, '#fff', 'center'); txt(g, b.sub, W / 2, H / 2 + 40, 13, '#ffb0b0', 'center'); }
    if (G.clearT > .8) { txt(g, 'MISSION COMPLETE', W / 2, H / 2, 54, '#ffd84a', 'center'); }
  }
};
function kname(a) { const pad = Input.padOn, tch = Input.touchOn; const M = { fire: pad ? 'X/RT' : tch ? 'FIRE' : 'LMB/J', jump: pad ? 'A' : tch ? 'JUMP' : 'SPACE', grenade: pad ? 'B/RB' : tch ? 'GREN' : 'E', swap: pad ? 'Y/LB' : tch ? 'SWAP' : 'Q', special: pad ? 'LT' : tch ? 'SPECIAL' : 'F/RMB', pause: pad ? 'START' : 'ESC' }; return M[a] || a; }

const UI = {
  sel: 0, btns: [], scr: 'title', t: 0, demoX: 0,
  button(lbl, x, y, w, h, cb, o) { o = o || {}; const i = this.btns.length; this.btns.push({ x, y, w, h, cb, dis: o.dis }); const hov = Input.mouseOn && Input.mx > x && Input.mx < x + w && Input.my > y && Input.my < y + h; if (hov && !o.dis && this.sel !== i) { this.sel = i; Snd.play('ui', .5); } const on = this.sel === i && !o.dis, g = ctx;
    g.fillStyle = o.dis ? 'rgba(20,20,26,.6)' : on ? 'rgba(255,58,58,.9)' : 'rgba(10,10,16,.75)'; g.beginPath(); g.moveTo(x + 10, y); g.lineTo(x + w, y); g.lineTo(x + w - 10, y + h); g.lineTo(x, y + h); g.closePath(); g.fill(); g.strokeStyle = on ? '#ffd84a' : 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.stroke();
    txt(g, lbl, x + w / 2, y + h / 2 + (o.sz || 20) * .36, o.sz || 20, o.dis ? '#555' : on ? '#fff' : '#ddd', 'center'); if (o.sub) txt(g, o.sub, x + w / 2, y + h - 6, 10, on ? '#ffe' : '#9fe8ff', 'center', { stroke: false }); },
  click(mx, my) { if (G.state === 'play') return; for (let i = 0; i < this.btns.length; i++) { const b = this.btns[i]; if (!b.dis && mx > b.x && mx < b.x + b.w && my > b.y && my < b.y + b.h) { this.sel = i; this.fire(); return; } } },
  fire() { const b = this.btns[this.sel]; if (b && !b.dis) { Snd.play('uiOk'); this.btns = []; b.cb(); } },
  nav() { const n = this.btns.length; if (!n) return; if (Input.hit('down') || Input.hit('right')) { this.sel = (this.sel + 1) % n; Snd.play('ui'); } if (Input.hit('up') || Input.hit('left')) { this.sel = (this.sel - 1 + n) % n; Snd.play('ui'); } this.sel = clamp(this.sel, 0, n - 1); if (Input.hit('ok') || Input.ph.fire && !Input.k.M0) this.fire(); },
  go(s) { G.state = s; this.sel = 0; },
  backdrop(li, speed) { const sv = World.L; World.L = LEVELS[li]; if (!World.bg || World.bgL !== li) { World.bg = Bg.make(LEVELS[li], li); World.bgL = li; } this.demoX += speed; Bg.draw(this.demoX); World.L = sv || LEVELS[li]; const g = ctx; g.fillStyle = LEVELS[li].pal.ground; g.fillRect(0, 440, W, 100); g.fillStyle = LEVELS[li].pal.top; g.fillRect(0, 440, W, 8); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H); },
  draw() {
    const g = ctx; this.t += 1 / 60; this.btns = []; const s = G.state; if (s !== 'pause' && Amb.cur) Amb.off();
    if (s === 'title') this.title(g); else if (s === 'levels') this.levels(g); else if (s === 'controls') this.controls(g); else if (s === 'settings') this.settings(g); else if (s === 'scores') this.scores(g);
    else if (s === 'pause') { G.draw(); g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(0, 0, W, H); txt(g, 'PAUSED', W / 2, 130, 64, '#ffd84a', 'center'); const y = 170; this.button('RESUME', 360, y, 240, 44, () => { G.state = 'play'; }); this.button('RESTART MISSION', 360, y + 54, 240, 44, () => { G.carry = G.carryStart; G.load(G.li); }); this.button('CONTROLS', 360, y + 108, 240, 44, () => { this.back = 'pause'; this.go('controls'); }); this.button('SETTINGS', 360, y + 162, 240, 44, () => { this.back = 'pause'; this.go('settings'); }); this.button('QUIT TO MENU', 360, y + 216, 240, 44, () => { Music.play(0); this.go('title'); }); if (Input.hit('pause') || Input.hit('back')) G.state = 'play'; }
    else if (s === 'over') this.over(g); else if (s === 'clear') this.clear(g); else if (s === 'victory') this.victory(g);
    this.nav();
  },
  title(g) {
    this.backdrop(0, 2.2); const t = this.t;
    // running squad silhouette
    for (let i = 0; i < 3; i++) drawStick(g, { x: 150 + i * 70 + Math.sin(t + i) * 6, y: 440, face: 1, run: t * 14 + i * 2, spd: 1, aim: -.15 + Math.sin(t * 3 + i) * .05, wpn: ['rifle', 'minigun', 'rocket'][i], body: '#07070b', band: i === 0 ? '#ff2a3a' : null, pack: true, t, s: 1.2 });
    if (Math.random() < .08) { const x = 260 + Math.random() * 30; FX.muzzle(x + 60, 400, -.15); }
    const sh = Math.sin(t * 20) * (Math.random() < .04 ? 4 : 0);
    g.save(); g.translate(W / 2 + sh, 0);
    txt(g, 'STICKMAN', 0, 118, 40, '#ffffff', 'center'); g.save(); g.transform(1, 0, -.12, 1, 0, 0); g.font = font(104); g.textAlign = 'center'; g.lineWidth = 12; g.strokeStyle = '#000'; g.strokeText('LAST STAND', 20, 206); const gr = g.createLinearGradient(0, 120, 0, 210); gr.addColorStop(0, '#ffe46a'); gr.addColorStop(.55, '#ff5a2a'); gr.addColorStop(1, '#b8101e'); g.fillStyle = gr; g.fillText('LAST STAND', 20, 206); g.restore();
    txt(g, 'ONE SOLDIER. ENDLESS ENEMIES. NO WAY BACK.', 0, 236, 14, '#9fe8ff', 'center'); g.restore();
    const x = 620, y = 262, w = 260, h = 36; const cont = Save.d.unlocked > 1;
    this.button(cont ? 'CONTINUE · MISSION ' + Save.d.unlocked : 'PLAY', x, y, w, h, () => { G.carry = null; G.startRun(cont ? Save.d.unlocked - 1 : 0); G.carryStart = null; });
    this.button('NEW GAME', x, y + 42, w, h, () => { G.carry = null; G.startRun(0); });
    this.button('LEVEL SELECT', x, y + 84, w, h, () => this.go('levels'));
    this.button('CONTROLS', x, y + 126, w, h, () => { this.back = 'title'; this.go('controls'); });
    this.button('SETTINGS', x, y + 168, w, h, () => { this.back = 'title'; this.go('settings'); });
    this.button('HIGH SCORES', x, y + 210, w, h, () => this.go('scores'));
    txt(g, 'HIGH SCORE  ' + String(Save.d.hi).padStart(8, '0'), 40, 520, 16, '#ffd84a'); txt(g, 'DIFFICULTY: ' + DIFF().n, 40, 498, 12, '#9fe8ff');
  },
  levels(g) {
    this.backdrop(Math.min(4, this.selLv || 0), 1); txt(g, 'SELECT MISSION', W / 2, 70, 44, '#ffd84a', 'center');
    LEVELS.forEach((L, i) => { const lock = i + 1 > Save.d.unlocked, x = 60 + i * 172, y = 120; const hov = this.sel === i; this.btns.push({ x, y, w: 160, h: 260, cb: () => { G.carry = null; G.startRun(i); }, dis: lock }); if (Input.mouseOn && Input.mx > x && Input.mx < x + 160 && Input.my > y && Input.my < y + 260 && this.sel !== i && !lock) { this.sel = i; Snd.play('ui', .5); } if (hov) this.selLv = i;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, 160, 260); g.strokeStyle = hov ? '#ffd84a' : 'rgba(255,255,255,.2)'; g.lineWidth = hov ? 3 : 1.5; g.strokeRect(x, y, 160, 260);
      const sk = g.createLinearGradient(0, y + 8, 0, y + 130); sk.addColorStop(0, L.pal.sky[0]); sk.addColorStop(1, L.pal.sky[2]); g.fillStyle = sk; g.fillRect(x + 8, y + 8, 144, 120); g.fillStyle = L.pal.far; g.beginPath(); g.moveTo(x + 8, y + 128); for (let k = 0; k <= 8; k++) g.lineTo(x + 8 + k * 18, y + 80 + Math.sin(k * 1.7 + i) * 18); g.lineTo(x + 152, y + 128); g.fill(); g.fillStyle = L.pal.ground; g.fillRect(x + 8, y + 112, 144, 16); g.fillStyle = L.pal.top; g.fillRect(x + 8, y + 112, 144, 4);
      if (lock) { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(x + 8, y + 8, 144, 120); txt(g, '🔒', x + 80, y + 80, 34, '#fff', 'center'); }
      txt(g, 'MISSION ' + (i + 1), x + 80, y + 154, 14, '#ff6a6a', 'center'); txt(g, lock ? '???' : L.name.split(' ')[0], x + 80, y + 180, 20, '#fff', 'center'); txt(g, lock ? '' : L.name.split(' ').slice(1).join(' '), x + 80, y + 200, 14, '#ddd', 'center'); txt(g, lock ? 'LOCKED' : 'BOSS: ' + L.boss, x + 80, y + 226, 10, '#9fe8ff', 'center', { stroke: false }); txt(g, 'BEST ' + (Save.d.best[i] || 0), x + 80, y + 246, 11, '#ffd84a', 'center'); });
    this.button('◄ BACK', 380, 420, 200, 42, () => this.go('title'));
    if (Input.hit('back')) this.go('title');
  },
  controls(g) {
    this.backdrop(2, .5); txt(g, 'CONTROLS', W / 2, 64, 44, '#ffd84a', 'center');
    const rows = [['MOVE', 'A D / ◄ ►', 'LEFT STICK / D-PAD', 'LEFT PAD'], ['AIM', 'MOUSE  or  W/S + direction', 'RIGHT STICK  or  stick 8-way', 'PAD DIRECTION'], ['SHOOT', 'LEFT CLICK  /  J', 'X  /  RT', 'FIRE'], ['JUMP (hold = higher, ×2 = double)', 'SPACE  /  K', 'A', 'JUMP'], ['CROUCH  /  DROP THROUGH', 'S  /  S + SPACE', 'DOWN  /  DOWN + A', '▼'], ['GRENADE', 'E', 'B  /  RB', 'GREN'], ['SWITCH WEAPON', 'Q  /  MOUSE WHEEL', 'Y  /  LB', 'SWAP'], ['LAST STAND (meter full)', 'F  /  RIGHT CLICK', 'LT', 'SPECIAL'], ['PAUSE', 'ESC', 'START', '❚❚']];
    const hx = [60, 380, 600, 800]; ['ACTION', 'KEYBOARD + MOUSE', 'CONTROLLER', 'TOUCH'].forEach((h, i) => txt(g, h, hx[i], 112, 13, '#ff6a6a'));
    rows.forEach((r, i) => { const y = 142 + i * 34; g.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.35)'; g.fillRect(50, y - 22, 870, 32); r.forEach((c, k) => txt(g, c, hx[k], y, k ? 14 : 15, k ? '#fff' : '#ffd84a', 'left', { mono: k > 0 })); });
    txt(g, 'Shoot the flying W capsules and crates for weapons. Hold the plasma cannon to charge it.', W / 2, 458, 13, '#9fe8ff', 'center');
    this.button('◄ BACK', 380, 474, 200, 40, () => this.go(this.back || 'title')); if (Input.hit('back')) this.go(this.back || 'title');
  },
  settings(g) {
    this.backdrop(3, .5); txt(g, 'SETTINGS', W / 2, 70, 44, '#ffd84a', 'center'); const S = Save.d.settings, x = 330, w = 300; let y = 110;
    this.button('VOLUME  ' + Math.round(S.vol * 100) + '%', x, y, w, 42, () => { S.vol = S.vol >= 1 ? 0 : Math.round((S.vol + .2) * 10) / 10; Snd.setVol(S.vol); Save.write(); this.sel = 0; }); y += 52;
    this.button('MUSIC  ' + (S.music ? 'ON' : 'OFF'), x, y, w, 42, () => { S.music = !S.music; Save.write(); this.sel = 1; }); y += 52;
    this.button('SCREEN SHAKE  ' + (S.shake ? 'ON' : 'OFF'), x, y, w, 42, () => { S.shake = !S.shake; Save.write(); this.sel = 2; }); y += 52;
    this.button('FLASH EFFECTS  ' + (S.fx ? 'FULL' : 'REDUCED'), x, y, w, 42, () => { S.fx = !S.fx; Save.write(); this.sel = 3; }); y += 52;
    this.button('DIFFICULTY  ' + DIFF().n, x, y, w, 42, () => { S.diff = (S.diff + 1) % 3; Save.write(); this.sel = 4; }, { sub: G.state === 'settings' && this.back === 'pause' ? 'applies to the next mission' : '' }); y += 52;
    this.button('FULLSCREEN', x, y, w, 42, () => { const el = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { } this.sel = 5; }); y += 62;
    this.button('◄ BACK', 380, y, 200, 42, () => this.go(this.back || 'title')); if (Input.hit('back')) this.go(this.back || 'title');
  },
  scores(g) {
    this.backdrop(4, .5); txt(g, 'HIGH SCORES', W / 2, 70, 44, '#ffd84a', 'center'); const L = Save.d.scores;
    if (!L.length) txt(g, 'NO SCORES YET. GET OUT THERE, SOLDIER.', W / 2, 220, 18, '#9fe8ff', 'center');
    L.forEach((s, i) => { const y = 130 + i * 34; txt(g, (i + 1) + '.', 300, y, 20, i === 0 ? '#ffd84a' : '#fff'); txt(g, String(s.s).padStart(8, '0'), 360, y, 20, '#fff', 'left', { mono: true }); txt(g, 'REACHED ' + (s.l > 5 ? 'VICTORY' : 'MISSION ' + s.l), 560, y, 14, '#9fe8ff'); });
    LEVELS.forEach((L2, i) => txt(g, 'M' + (i + 1) + ' BEST ' + (Save.d.best[i] || 0), 120 + i * 180, 430, 12, '#ffd84a', 'center'));
    this.button('◄ BACK', 380, 460, 200, 42, () => this.go('title')); if (Input.hit('back')) this.go('title');
  },
  over(g) {
    G.overT = (G.overT || 0) + 1 / 60; if (G.overT < .02) Save.addScore('YOU', G.score, G.li + 1);
    this.backdrop(G.li, 0); g.fillStyle = 'rgba(40,0,0,.5)'; g.fillRect(0, 0, W, H); txt(g, 'GAME OVER', W / 2, 160, 84, '#ff2a3a', 'center'); txt(g, 'SCORE ' + G.score, W / 2, 210, 24, '#fff', 'center'); txt(g, 'MISSION ' + (G.li + 1) + ' · ' + LEVELS[G.li].name, W / 2, 238, 14, '#9fe8ff', 'center');
    this.button('CONTINUE (SCORE RESETS)', 330, 280, 300, 46, () => { G.score = 0; G.lives = DIFF().lives; G.carry = null; G.load(G.li); RWB.send('start'); });
    this.button('MAIN MENU', 330, 336, 300, 46, () => { Music.play(0); this.go('title'); });
  },
  clear(g) {
    G.draw(); g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 0, W, H); const b = G.bonus;
    txt(g, 'MISSION ' + (G.li + 1) + ' COMPLETE', W / 2, 110, 50, '#ffd84a', 'center'); txt(g, LEVELS[G.li].boss + ' DESTROYED', W / 2, 140, 16, '#ff6a6a', 'center');
    const rows = [['ENEMIES KILLED', G.kills], ['TIME', Math.floor(G.levelT / 60) + ':' + String(Math.floor(G.levelT % 60)).padStart(2, '0')], ['SPEED BONUS', '+' + b.time], ['LIVES BONUS', '+' + b.lives], ['NO DAMAGE BONUS', b.nohit ? '+' + b.nohit : '—'], ['DOG TAGS', G.tags + ' / ' + G.tagTotal], ['SCORE', G.score]];
    rows.forEach((r, i) => { const y = 178 + i * 30; const last = i === rows.length - 1; txt(g, r[0], 300, y, 18, last ? '#ffd84a' : '#ddd'); txt(g, String(r[1]), 660, y, 20, last ? '#ffd84a' : '#fff', 'right', { mono: true }); });
    this.button('NEXT MISSION ►', 340, 400, 280, 46, () => { G.carryStart = G.carry; G.startRun(G.li + 1, true); });
    this.button('MAIN MENU', 340, 454, 280, 40, () => { Save.addScore('YOU', G.score, G.li + 2); Music.play(0); this.go('title'); });
  },
  victory(g) {
    G.vT = (G.vT || 0) + 1 / 60; if (G.vT < .02) Save.addScore('YOU', G.score, 6);
    this.backdrop(4, 3); const t = G.vT;
    if (Math.random() < .12) FX.explode(rnd(100, 860) + Cam.x, rnd(80, 300) + Cam.y, rnd(40, 120), { vol: .3 });
    g.save(); g.translate(-Cam.x, -Cam.y); FX.draw(g); g.restore(); FX.update(1 / 60);
    drawStick(g, { x: 170, y: 440, face: 1, aim: -1.1, wpn: P ? P.cur : 'rifle', body: '#07070b', band: '#ff2a3a', pack: true, belt: '#c8a040', t, s: 1.6 });
    txt(g, 'VICTORY', W / 2, 130, 96, '#ffd84a', 'center'); txt(g, 'OVERLORD ZERO HAS FALLEN. THE LAST SOLDIER STANDS.', W / 2, 168, 16, '#fff', 'center');
    txt(g, 'FINAL SCORE  ' + G.score, W / 2, 210, 30, '#fff', 'center');
    if (t > 2) { this.button('PLAY AGAIN', 340, 250, 280, 44, () => { G.carry = null; G.startRun(0); }); this.button('MAIN MENU', 340, 302, 280, 40, () => { Music.play(0); this.go('title'); }); }
  }
};
