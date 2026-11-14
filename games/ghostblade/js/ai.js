// GHOSTBLADE - guards (7 awareness states), communication, patrols, civilians and crowds
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T, W = GB.world, phys = GB.phys;
  const { LADDER, DOOR, FACADE, PLAT } = W;
  const S = () => GB.stealth, P = () => GB.player;

  const TYPES = {
    guard:   { range: 250, fov: 0.60, speed: 62, run: 205, hp: 3, perc: 1.0, dmg: 20 },
    archer:  { range: 400, fov: 0.50, speed: 55, run: 170, hp: 2, perc: 1.1, dmg: 12, ranged: true, pitch: 0.32 },
    elite:   { range: 300, fov: 0.70, speed: 68, run: 230, hp: 6, perc: 1.4, dmg: 28, armored: true, inspect: 1 },
    captain: { range: 300, fov: 0.65, speed: 62, run: 215, hp: 7, perc: 1.3, dmg: 26, armored: true, commands: true, inspect: 0.7 },
    hunter:  { range: 340, fov: 0.80, speed: 92, run: 262, hp: 5, perc: 1.6, dmg: 24, climbs: true, inspect: 1 },
    target:  { range: 190, fov: 0.60, speed: 48, run: 165, hp: 1, perc: 0.9, dmg: 0, vip: true },
    master:  { range: 330, fov: 0.80, speed: 70, run: 250, hp: 12, perc: 1.7, dmg: 32, armored: true, boss: true }
  };
  const RANK = { unaware: 0, suspicious: 1, investigating: 2, alerted: 3, hunting: 4, searching: 5, combat: 6 };

  const A = GB.ai = {
    TYPES, guards: [], civs: [], crowds: [], dynLights: [], maxMeter: 0, alertLevel: 0, combatCount: 0,

    spawnGuard(spec) {
      const t = TYPES[spec.type] || TYPES.guard, f = W.feet(spec.tx, (spec.row || W.G) - 2);
      const g = {
        type: spec.type, cfg: t, x: f.x, y: f.y, vx: 0, vy: 0, w: 14, h: 44, onGround: true, face: spec.face || 1,
        state: 'unaware', meter: 0, hp: t.hp, dead: false, sleepT: 0, stunT: 0,
        home: { x: f.x, y: f.y, face: spec.face || 1 }, patrol: spec.p ? [W.px(spec.p[0]), W.px(spec.p[1])] : null, pi: 0, wait: U.rand(0, 2),
        pers: spec.pers || U.pick(['normal', 'normal', 'lazy', 'vigilant', 'nervous']), torch: !!spec.torch, thug: !!spec.thug,
        tag: spec.tag || null, mission: !!spec.mission, dummy: !!spec.dummy, name: spec.name || null,
        target: null, timer: 0, lastSeen: null, loseT: 0, sees: false, attackT: 0, attackCd: U.rand(0.3, 0.9), aimT: 0,
        look: spec.face < 0 ? Math.PI : 0, phase: Math.random() * 6, search: null, huntT: 0, wary: 0, ladder: null, climbing: false,
        barkT: 0, senseT: Math.random() * 0.1, bodyT: Math.random() * 0.3, inspectSpot: null, hurtT: 0, canDrop: false, blockedT: 0, said: null, saidT: 0
      };
      A.guards.push(g); return g;
    },

    populate() {
      A.guards.length = 0; A.civs.length = 0; A.crowds.length = 0; A.dynLights.length = 0; A.alertLevel = 0; A.alarmCd = 0;
      for (const s of W.guards) A.spawnGuard(s);
      const mk = (x, y, o) => { const c = Object.assign({ x, y, vx: 0, vy: 0, w: 12, h: 42, onGround: true, face: Math.random() < 0.5 ? -1 : 1, t: U.rand(0, 4), phase: Math.random() * 6, flee: 0, hue: U.pick(['#5a4a3a', '#6b5a48', '#4a5560', '#6a4040', '#4d5a44', '#62506a', '#7a6a50']), hat: Math.floor(Math.random() * 4), dress: Math.random() < 0.4 }, o || {}); A.civs.push(c); return c; };
      for (const c of W.civs) mk(c.x, c.y, { x0: c.x0 || c.x, x1: c.x1 || c.x, merchant: !!c.merchant, home: c.x });
      for (const c of W.crowds) { const cr = { x: c.x, y: c.y, n: c.n, calm: true, t: 0, members: [] }; for (let i = 0; i < c.n; i++) cr.members.push(mk(c.x + (i - (c.n - 1) / 2) * 15 + U.rand(-3, 3), c.y, { crowd: cr, home: c.x + (i - (c.n - 1) / 2) * 15, face: i < c.n / 2 ? 1 : -1 })); A.crowds.push(cr); }
      for (const o of W.officials) mk(o.x, o.y, { official: o, home: o.x, hue: '#3d355e', hat: 3 });
      // notoriety: reinforcements
      const nl = GB.prog.notorietyLevel();
      if (nl >= 1) { A.spawnGuard({ type: 'guard', tx: 300, p: [290, 338], torch: true }); A.spawnGuard({ type: 'guard', tx: 160, p: [130, 224] }); }
      if (nl >= 2) { A.spawnGuard({ type: 'archer', tx: 393, row: 40, p: [382, 396] }); A.spawnGuard({ type: 'guard', tx: 404, face: -1 }); A.spawnGuard({ type: 'guard', tx: 248, face: -1 }); A.spawnInformant(); }
      if (nl >= 3) { A.spawnGuard({ type: 'hunter', tx: 330, p: [292, 396] }); A.spawnGuard({ type: 'elite', tx: 126, p: [126, 180] }); }
      if (nl >= 4) { A.spawnGuard({ type: 'hunter', tx: 150, p: [128, 224] }); A.spawnGuard({ type: 'hunter', tx: 470, p: [465, 484] }); }
    },
    spawnInformant() { const c = A.civs.find(c => !c.crowd && !c.merchant && !c.official); if (c) c.informant = true; },

    // ---------- communication ----------
    say(g, text) { g.said = text; g.saidT = 1.6; },
    shout(g, x, y, radius) {
      GB.sfx('guardShout', { vol: 0.8 }); A.say(g, '!');
      for (const o of A.guards) {
        if (o === g || o.dead || o.sleepT > 0) continue;
        if (U.dist(g.x, g.y, o.x, o.y) > (radius || 380)) continue;
        if (RANK[o.state] < RANK.alerted) A.setState(o, 'alerted', { x, y });
        else if (o.state !== 'combat') o.target = { x, y };
      }
    },
    alarm(x, y) {
      if (A.alarmCd > 0) return; A.alarmCd = 20;
      GB.sfx('alarmBell'); GB.events.emit('alarm', x, y); GB.prog.addNotoriety(12);
      for (const o of A.guards) { if (o.dead || o.sleepT > 0) continue; if (U.dist(x, y, o.x, o.y) < 950 && RANK[o.state] < RANK.hunting) { A.setState(o, 'hunting', { x, y }); } }
    },
    hear(g, x, y, kind, r) {
      if (g.dead || g.stunT > 0 || g.dummy) return;
      if (g.cfg.vip) { if (r > 150 && g.state === 'unaware') A.setState(g, 'suspicious', { x, y }); return; }
      if (g.state === 'combat') { if (!g.sees && (kind === 'step' || kind === 'land')) g.lastSeen = { x, y }; return; }
      if (g.state === 'hunting' || g.state === 'searching' || g.state === 'alerted') { if (r > 60) { g.target = { x, y }; g.search = null; } return; }
      if (kind === 'alarm') return;
      const loud = r > 240 || kind === 'clash' || kind === 'scream' || kind === 'glass';
      if (loud || kind === 'coin' || kind === 'decoy' || g.state === 'suspicious' || g.state === 'investigating') { A.setState(g, 'investigating', { x, y }); g.fast = loud; }
      else A.setState(g, 'suspicious', { x, y });
    },
    scareCivs(x, y, r) { for (const c of A.civs) if (U.dist(c.x, c.y, x, y) < r) A.civFlee(c, x, false); },
    civFlee(c, fromX, scream) {
      if (c.flee > 0) return; c.flee = U.rand(5, 8); c.fleeDir = U.sign(c.x - fromX) || 1;
      if (c.crowd) { c.crowd.calm = false; c.crowd.t = 22; }
      if (scream) { GB.sfx('scream', { vol: 0.7 }); S().noise(c.x, c.y, 250, 'scream'); }
    },

    setState(g, st, target) {
      const prev = g.state;
      if (target) g.target = { x: target.x, y: target.y };
      if (prev === st) return;
      g.state = st; g.timer = 0; g.inspectSpot = null; g.search = null; g.fast = false; g.arrived = false; g.triedInspect = false; g.closeDoor = null;
      if (st === 'suspicious') { if (prev === 'unaware') { GB.sfx('alertSuspicious', { vol: 0.6, pan: U.clamp((g.x - P().x) / 400, -1, 1) }); A.say(g, '?'); } }
      else if (st === 'investigating') { if (RANK[prev] < 2) A.say(g, '?'); }
      else if (st === 'alerted') { A.say(g, '!'); if (RANK[prev] < RANK.alerted) GB.events.emit('guardAlerted', g); }
      else if (st === 'hunting') { g.huntT = 26 + Math.random() * 6; if (RANK[prev] < RANK.alerted) GB.events.emit('guardAlerted', g); }
      else if (st === 'searching') { g.huntT = 15 + Math.random() * 5; A.say(g, '...?'); }
      else if (st === 'combat') {
        g.meter = 1; g.loseT = 0; g.canDrop = true;
        if (prev !== 'combat') { GB.sfx('alertSpotted'); if (GB.fx && Math.abs(g.x - P().x) < 700) { GB.fx.slowmo(0.35, 0.22); GB.fx.punch(0.07); GB.fx.shake(4); } A.say(g, '!!'); GB.events.emit('detected', g); if (RANK[prev] < RANK.alerted) GB.events.emit('guardAlerted', g); }
      } else if (st === 'unaware') { g.canDrop = false; g.wary = 40; g.meter = 0; g.seenPos = null; g.relight = null; }
    },

    damage(g, dmg, fromX, silent) {
      if (g.dead) return;
      g.hp -= dmg; g.hurtT = 0.25; if (g.sleepT > 0) g.sleepT = 0;
      if (GB.fx) GB.fx.blood(g.x, g.y - 28, 5);
      if (g.hp <= 0) { A.kill(g, 'combat', fromX, silent); return; }
      g.vx = U.sign(g.x - fromX) * 120; g.stunT = Math.max(g.stunT, 0.2);
      if (g.state !== 'combat') { A.setState(g, 'combat'); g.lastSeen = { x: P().x, y: P().y }; A.shout(g, P().x, P().y); }
    },
    kill(g, method, fromX, silent) {
      if (g.dead) return; g.dead = true; g.hp = 0; g.state = 'dead';
      const body = GB.combat.addBody(g, fromX);
      if (!silent) { GB.sfx('guardDown'); S().noise(g.x, g.y, method === 'combat' ? 150 : (GB.has('g2') ? 18 : 34), 'kill'); }
      S().recentKill = 2.5;
      GB.events.emit('kill', g, method, body);
      // witnesses
      for (const c of A.civs) if (c.flee <= 0 && U.dist(c.x, c.y, g.x, g.y) < 170 && W.los(c.x, c.y - 30, g.x, g.y - 30)) A.civFlee(c, g.x, Math.random() < 0.6);
    },
    canAssassinate(g) {
      if (g.dead) return false;
      if (g.sleepT > 0 || g.stunT > 0.2) return true;
      const pl = P(), behind = U.sign(pl.x - g.x) !== g.face;
      if (g.state !== 'combat') { if ((g.cfg.boss || g.type === 'hunter') && !behind && g.state !== 'unaware') return false; return true; }
      if (S().inSmoke(g.x, g.y - 20)) return true;
      if (g.cfg.armored || g.cfg.boss || g.type === 'hunter') return false;
      return behind && !g.sees;
    },

    // ---------- update ----------
    update(dt) {
      const pl = P();
      A.alarmCd = Math.max(0, (A.alarmCd || 0) - dt);
      A.dynLights.length = 0; let maxM = 0, combat = 0, top = 0;
      for (const g of A.guards) {
        if (g.dead) continue;
        const far = Math.abs(g.x - pl.x) > 1500 || Math.abs(g.y - pl.y) > 900;
        if (far && g.state === 'unaware') { continue; }
        updGuard(g, dt, pl);
        if (g.torch && !g.dead && g.sleepT <= 0) A.dynLights.push({ x: g.x + g.face * 8, y: g.y - 40, r: 190, int: 1, on: true, kind: 'torch' });
        if (g.state === 'combat') combat++; else maxM = Math.max(maxM, g.meter);
        top = Math.max(top, RANK[g.state] || 0);
      }
      A.maxMeter = maxM; A.combatCount = combat; A.alertLevel = top;
      for (const c of A.civs) updCiv(c, dt, pl);
      for (const cr of A.crowds) if (!cr.calm) { cr.t -= dt; if (cr.t <= 0 && cr.members.every(m => m.flee <= 0)) cr.calm = true; }
      // doors closing behind guards
      for (const d of W.doors) if (d.open && !d.byPlayer) { d.timer -= dt; if (d.timer <= 0) GB.combat.setDoor(d, false); }
    }
  };

  // ---------- perception ----------
  function sense(g, dt, pl) {
    const cfg = g.cfg, ex = g.x, ey = g.y - 38, st = S();
    const tx = pl.x, ty = pl.y - pl.h * 0.6, dx = tx - ex, dy = ty - ey, d = Math.hypot(dx, dy);
    const hot = RANK[g.state] >= RANK.alerted;
    g.sees = false;
    let rate = 0;
    if (!pl.dead && (pl.state !== 'hidden' || g.knowsSpot === pl.hideSpot)) {
      const diff = Math.abs(U.angDiff(Math.atan2(dy, dx), g.look));
      let eff = cfg.range * (0.3 + 0.7 * pl.light) * (pl.crouch ? 0.8 : 1) * GB.env.visionMul() * (hot || g.wary > 0 ? 1.2 : 1);
      if (g.pers === 'lazy') eff *= 0.85;
      const close = d < (hot ? 60 : 30) && (!pl.crouch || hot) && Math.abs(dy) < 40;
      if (((diff < cfg.fov && d < eff) || close) && st.losClear(ex, ey, tx, ty)) {
        const conceal = pl.concealed && d > 44 && g.state !== 'combat';
        if (!conceal) {
          const sus = (g.state === 'combat' || g.state === 'searching' || g.state === 'hunting' || g.state === 'alerted') ? 1 : st.suspicion(g, d);
          if (sus > 0) {
            g.sees = true;
            const moving = Math.abs(pl.vx) > 200 ? 1.3 : (Math.abs(pl.vx) < 10 && pl.crouch ? 0.6 : 1);
            rate = cfg.perc * sus * (0.45 + 1.9 * (1 - d / Math.max(eff, 1))) * moving * (GB.has('g5') ? 0.75 : 1) * (g.pers === 'lazy' ? 0.7 : g.pers === 'vigilant' ? 1.2 : 1) * (g.wary > 0 ? 1.3 : 1);
            if (d < 60) rate *= 2.6;
            if (hot) rate *= 2.2;
          }
        }
      }
    }
    if (g.cfg.vip && g.state !== 'combat') rate *= 0.7;
    if (rate > 0) { const cap = (!hot && g.state !== 'combat' && st.soft) ? 0.72 : 1; g.meter = Math.max(g.meter, Math.min(cap, g.meter + rate * dt)); g.seenPos = { x: pl.x, y: pl.y }; }
    else if (g.state !== 'combat') g.meter = Math.max(0, g.meter - (hot ? 0.12 : 0.3) * dt);

    // bodies, sleeping comrades, open doors, missing objects
    g.bodyT -= dt;
    if (g.bodyT <= 0 && g.state !== 'combat') {
      g.bodyT = 0.3;
      const seeThing = (x, y, range) => {
        const bx = x - ex, by = y - ey, bd = Math.hypot(bx, by);
        if (bd > range) return false;
        if (bd > 40 && Math.abs(U.angDiff(Math.atan2(by, bx), g.look)) > cfg.fov + 0.15) return false;
        return W.los(ex, ey, x, y);
      };
      for (const b of GB.combat.bodies) {
        if (b.found || b.hidden || b.carried) continue;
        const range = 230 * (0.3 + 0.7 * st.lightAt(b.x, b.y));
        if (seeThing(b.x, b.y - 8, range)) { foundBody(g, b); break; }
      }
      for (const o of A.guards) if (o.sleepT > 0 && !o.dead && o !== g && seeThing(o.x, o.y - 10, 150)) { o.sleepT = 0; o.stunT = 1; A.setState(o, 'alerted', { x: o.x, y: o.y }); A.setState(g, 'alerted', { x: o.x, y: o.y }); A.say(g, 'Wake up!'); break; }
      if (g.state === 'unaware') {
        for (const d of W.doors) if (d.open && d.byPlayer && !d.noticed && seeThing(d.x, d.y - 24, 170)) { d.noticed = true; A.setState(g, 'investigating', { x: d.x, y: d.y }); g.closeDoor = d; A.say(g, 'That door...'); break; }
        for (const s2 of W.stealables) if (s2.taken && !s2.noticed && seeThing(s2.x, s2.y - 20, 130)) { s2.noticed = true; A.say(g, 'It\'s gone!'); A.setState(g, 'alerted', { x: s2.x, y: s2.y }); A.shout(g, s2.x, s2.y); GB.events.emit('evidence', 'theft'); break; }
        for (const L of W.lights) if (L.snuffed && !L.on && !L.noticed && seeThing(L.x, L.y, 150) && Math.abs(L.y - ey) < 60) { L.noticed = true; g.relight = L; A.setState(g, 'investigating', { x: L.x, y: g.y }); A.say(g, 'Torch went out.'); break; }
      }
    }
  }
  function foundBody(g, b) {
    b.found = true; GB.events.emit('bodyFound', b, g); GB.prog.addNotoriety(4);
    A.say(g, 'A body!'); A.setState(g, 'alerted', { x: b.x, y: b.y });
    A.shout(g, b.x, b.y, 420);
    const cap = A.guards.find(o => !o.dead && o.cfg.commands && U.dist(o.x, o.y, g.x, g.y) < 600);
    if (cap || g.pers === 'nervous' || Math.random() < 0.35) A.alarm(b.x, b.y);
  }

  // ---------- navigation ----------
  function findLadder(g, up) {
    const fr = Math.floor((g.y + 1) / T), gx = Math.floor(g.x / T); let best = null, bd = 99;
    for (let c = gx - 24; c <= gx + 24; c++) {
      if (W.get(c, up ? fr - 1 : fr) !== LADDER) continue;
      const d = Math.abs(c - gx); if (d >= bd) continue;
      let ok = true; const s = c < gx ? 1 : -1;
      for (let x = c; x !== gx; x += s) { const t = W.get(x, fr - 1); if (t === W.SOLID || t === W.SMOOTH) { ok = false; break; } }
      if (ok) { best = c; bd = d; }
    }
    return best;
  }
  // returns true when arrived
  function nav(g, tx, ty, sp) {
    if (g.ladder || g.climbing) return false;
    const dy = ty - g.y; let goal = tx;
    if (Math.abs(dy) > 40 && g.onGround) {
      const lad = findLadder(g, dy < 0);
      if (lad !== null) {
        goal = lad * T + T / 2;
        if (Math.abs(g.x - goal) < 5) { g.ladder = { dir: dy < 0 ? -1 : 1, col: lad, toY: ty }; g.x = goal; g.vx = 0; if (dy > 0) g.y += 3; return false; }
      } else if (g.cfg.climbs && dy < 0 && Math.abs(tx - g.x) < 40 && W.at(g.x, g.y - 24) === FACADE) { g.climbing = true; return false; }
    }
    const dx = goal - g.x;
    if (Math.abs(dx) < 7) { g.vx = 0; return Math.abs(dy) <= 44 || goal === tx; }
    const dir = dx > 0 ? 1 : -1; g.face = dir;
    if (!g.canDrop && g.onGround) {
      const ax = Math.floor((g.x + dir * 13) / T), r = Math.floor((g.y + 2) / T);
      if (!phys.standable(ax, r) && !phys.standable(ax, r + 1)) { g.vx = 0; g.blockedT += 0.05; return g.blockedT > 1.2; }
    }
    g.vx = dir * sp; return false;
  }
  function moveGuard(g, dt) {
    if (g.ladder) {
      const l = g.ladder; g.vx = 0; g.vy = l.dir * 105; g.x = l.col * T + T / 2;
      phys.move(g, dt, true);
      if (l.dir < 0) {
        const fr = Math.floor((g.y - 1) / T);
        if (W.get(l.col, fr) !== LADDER) { g.y = (fr + 1) * T; g.vy = 0; g.onGround = true; g.ladder = null; }
        else if (g.y <= l.toY + 2 && phys.standable(l.col, Math.floor((g.y + 4) / T))) { g.y = Math.floor((g.y + 4) / T) * T; g.vy = 0; g.onGround = true; g.ladder = null; }
      } else if (g.onGround || g.y >= l.toY) { if (!g.onGround && W.at(g.x, g.y + 4) === LADDER && g.y < l.toY + 6) { /* keep going */ } g.ladder = g.onGround || W.at(g.x, g.y + 6) !== LADDER ? null : g.ladder; }
      g.phase += dt * 8; return;
    }
    if (g.climbing) { // hunters scale facades
      g.vy = -120; g.vx = 0; phys.move(g, dt, true); g.phase += dt * 9;
      const cr = Math.floor((g.y - 24) / T), tx = Math.floor(g.x / T);
      if (W.get(tx, cr) === PLAT && W.get(tx, cr - 1) !== FACADE) { g.y = cr * T; g.climbing = false; g.vy = 0; }
      else if (W.get(tx, cr) !== FACADE && W.get(tx, cr) !== PLAT) g.climbing = false;
      if (g.state !== 'combat' && g.state !== 'hunting' && g.state !== 'searching') g.climbing = false;
      return;
    }
    g.vy = Math.min(g.vy + 1500 * dt, 1200);
    const pvx = g.vx;
    phys.move(g, dt);
    if (g.hitWall && g.cfg.climbs && g.state === 'combat') { // hunters scale solid walls
      const tx = Math.floor((g.x + g.hitWall * 10) / T), fr = Math.floor((g.y - 1) / T);
      if (W.climbable(tx, fr - 1) && W.solid(tx, fr - 1)) { g.vy = -150; g.vx = pvx; g.phase += dt * 9; return; }
    }
    if (g.hitWall && g.onGround) {
      const dir = g.hitWall, tx = Math.floor((g.x + dir * 10) / T), fr = Math.floor((g.y - 1) / T);
      const t0 = W.get(tx, fr), t1 = W.get(tx, fr - 1);
      if (t0 === DOOR || t1 === DOOR) { const d = W.doors.find(d => d.tx === tx && (d.ty === fr || d.ty === fr - 1)); if (d && !d.locked) { GB.combat.setDoor(d, true, false); d.timer = 2.2; g.vx = pvx; } }
      else if (W.solid(tx, fr) && !W.solid(tx, fr - 1) && !W.solid(tx, fr - 2) && phys.boxFree(g.x, g.y - T, g.w, g.h)) { g.y -= T; g.x += dir * 3; }
      else g.blockedT += dt;
    } else g.blockedT = Math.max(0, g.blockedT - dt * 0.5);
    if (Math.abs(g.vx) > 5) g.phase += Math.abs(g.vx) * dt * 0.06;
  }

  function lookToward(g, x, y, dt) {
    const base = g.face > 0 ? 0 : Math.PI; let a = Math.atan2(y - (g.y - 38), x - g.x);
    let off = U.clamp(U.angDiff(a, base), -1.0, 1.0); g.look += U.angDiff(base + off, g.look) * Math.min(1, dt * 8);
  }
  function lookIdle(g, dt) {
    const pitch = g.cfg.pitch || 0; const target = g.face > 0 ? pitch : Math.PI - pitch;
    g.look += U.angDiff(target + Math.sin(GB.time * 0.9 + g.phase) * 0.08, g.look) * Math.min(1, dt * 6);
  }
  function searchPoints(g, o) {
    const pts = [];
    for (const h of W.hides) if (h.type !== 'grass' && Math.abs(h.x - o.x) < 300 && Math.abs(h.y - o.y) < 70) pts.push({ x: h.x + U.rand(-20, 20), y: h.y, spot: h });
    for (let i = 0; i < 4; i++) pts.push({ x: o.x + U.rand(-280, 280), y: o.y });
    pts.sort(() => Math.random() - 0.5); return pts.slice(0, 6);
  }
  function tryInspect(g) { // maybe poke a nearby hiding place
    const chance = (g.cfg.inspect || 0.35) * (GB.has('g3') ? 0.5 : 1) * (RANK[g.state] >= RANK.alerted ? 1.4 : 0.8);
    let best = null, bd = 150;
    for (const h of W.hides) { if (h.type === 'grass') continue; const d = Math.abs(h.x - g.x); if (d < bd && Math.abs(h.y - g.y) < 30) { best = h; bd = d; } }
    if (best && Math.random() < chance) { g.inspectSpot = best; g.inspectT = 0; g.walkT = 0; return true; }
    return false;
  }
  function doInspect(g, dt, pl) {
    const h = g.inspectSpot;
    g.walkT = (g.walkT || 0) + dt; if (g.walkT > 6) { g.inspectSpot = null; g.walkT = 0; return; }
    if (Math.abs(h.x - g.x) > 30) { nav(g, h.x - U.sign(h.x - g.x) * 24, g.y, g.cfg.speed * 1.2); return; }
    g.vx = 0; g.face = U.sign(h.x - g.x) || g.face; g.inspectT += dt; g.poking = true;
    if (g.inspectT > 1.3) {
      g.inspectSpot = null; g.poking = false;
      if (pl.state === 'hidden' && pl.hideSpot === h) { g.knowsSpot = h; pl.leaveHide(); A.setState(g, 'combat'); g.lastSeen = { x: pl.x, y: pl.y }; A.shout(g, pl.x, pl.y); }
      else if (h.body && !h.body.found) { h.body.hidden = false; h.body.x = h.x + g.face * 10; h.body.y = h.y; h.body = null; }
    }
  }

  // ---------- per-state behaviour ----------
  function updGuard(g, dt, pl) {
    g.hurtT = Math.max(0, g.hurtT - dt); g.saidT = Math.max(0, g.saidT - dt); g.wary = Math.max(0, g.wary - dt); g.attackCd -= dt; g.poking = false;
    if (g.sleepT > 0) { g.sleepT -= dt; g.vx = 0; g.vy = Math.min(g.vy + 1500 * dt, 1200); phys.move(g, dt); if (g.sleepT <= 0) { A.setState(g, 'suspicious', { x: g.x + g.face * 40, y: g.y }); A.say(g, 'Ugh...'); } return; }
    if (g.stunT > 0) { g.stunT -= dt; g.vx = U.approach(g.vx, 0, 500 * dt); g.attackT = 0; g.vy = Math.min(g.vy + 1500 * dt, 1200); phys.move(g, dt); return; }
    if (!g.dummy) sense(g, dt, pl);
    const cfg = g.cfg; g.timer += dt;
    if (g.meter >= 1 && g.state !== 'combat') {
      if (cfg.vip) { A.setState(g, 'combat'); A.shout(g, pl.x, pl.y, 500); }
      else { A.setState(g, 'combat'); g.lastSeen = { x: pl.x, y: pl.y }; A.shout(g, pl.x, pl.y); GB.prog.addNotoriety(3); if (cfg.commands) A.alarm(pl.x, pl.y); }
    }
    const tgt = g.target;
    switch (g.state) {
      case 'unaware': {
        if (g.meter > 0.3) { A.setState(g, 'suspicious', g.seenPos); break; }
        lookIdle(g, dt);
        if (g.patrol) {
          if (g.wait > 0) { g.wait -= dt; g.vx = 0; if (g.pers === 'vigilant' && Math.random() < dt * 0.35) g.face *= -1; }
          else if (nav(g, g.patrol[g.pi], g.home.y, cfg.speed * (g.wary > 0 ? 1.25 : 1))) { g.pi = 1 - g.pi; g.wait = g.pers === 'lazy' ? U.rand(3, 6) : U.rand(1.2, 3); g.blockedT = 0; }
        } else {
          if (Math.abs(g.x - g.home.x) > 10 || Math.abs(g.y - g.home.y) > 30) nav(g, g.home.x, g.home.y, cfg.speed);
          else { g.vx = 0; g.wait -= dt; if (g.wait <= 0) { g.wait = U.rand(4, 9); g.face = (g.pers === 'stoic' || Math.random() < 0.6) ? g.home.face : -g.home.face; } }
        }
        break;
      }
      case 'suspicious': {
        g.vx = 0; if (tgt) { g.face = U.sign(tgt.x - g.x) || g.face; lookToward(g, tgt.x, tgt.y - 24, dt); }
        if (g.meter >= 0.62) { A.setState(g, 'investigating', g.seenPos || tgt); break; }
        if (g.timer > (g.pers === 'lazy' ? 2.4 : 1.5)) { if (g.meter > 0.2 || (tgt && !g.seenPos && g.pers !== 'lazy')) A.setState(g, 'investigating', tgt); else A.setState(g, 'unaware'); }
        break;
      }
      case 'investigating': {
        if (g.inspectSpot) { doInspect(g, dt, pl); break; }
        if (!tgt) { A.setState(g, 'unaware'); break; }
        if (g.sees && g.seenPos) { g.target = { x: g.seenPos.x, y: g.seenPos.y }; }
        if (!g.arrived) {
          lookToward(g, tgt.x, tgt.y - 24, dt);
          if (nav(g, tgt.x, tgt.y, cfg.speed * (g.fast ? 2 : 1.35)) || g.timer > 14) { g.arrived = true; g.timer = 0; g.vx = 0; }
        } else {
          g.vx = 0; lookIdle(g, dt);
          if (g.closeDoor) { GB.combat.setDoor(g.closeDoor, false); g.closeDoor = null; }
          if (g.relight && Math.abs(g.relight.x - g.x) < 40) { g.relight.on = true; g.relight.snuffed = false; g.relight.noticed = false; g.relight = null; GB.sfx('torchOut', { vol: 0.3, rate: 1.5 }); }
          if (Math.floor(g.timer / 0.9) % 2 === 1) g.face = -Math.abs(g.face) * (g.flip || 1); else g.face = Math.abs(g.face) * (g.flip || 1);
          if (g.timer > 2.6) { g.arrived = false; if (!g.triedInspect && tryInspect(g)) { g.triedInspect = true; break; } g.triedInspect = false; g.relight = null; A.setState(g, 'unaware'); A.say(g, 'Nothing.'); }
        }
        break;
      }
      case 'alerted': {
        if (cfg.vip) { vipFlee(g, pl, dt); if (g.timer > 9) A.setState(g, 'hunting', tgt || g); break; }
        if (!tgt) { A.setState(g, 'hunting', { x: g.x, y: g.y }); break; }
        lookToward(g, tgt.x, tgt.y - 24, dt);
        if (nav(g, tgt.x, tgt.y, cfg.run * 0.85) || g.timer > 9 || g.blockedT > 1) A.setState(g, 'hunting', tgt);
        break;
      }
      case 'hunting': case 'searching': {
        if (cfg.vip) { vipFlee(g, pl, dt); g.huntT -= dt; if (g.huntT <= 0) A.setState(g, 'unaware'); break; }
        g.huntT -= dt;
        if (g.huntT <= 0) { A.setState(g, 'unaware'); A.say(g, 'Must have fled.'); break; }
        if (g.inspectSpot) { doInspect(g, dt, pl); break; }
        if (!g.search) { g.search = searchPoints(g, tgt || g); g.si = 0; g.arrived = false; g.timer = 0; }
        const p = g.search[g.si % g.search.length];
        if (!g.arrived) {
          lookToward(g, p.x, p.y - 24, dt);
          if (nav(g, p.x, p.y, g.state === 'hunting' ? cfg.run * 0.7 : cfg.speed * 1.7) || g.timer > 7 || g.blockedT > 0.8) { g.arrived = true; g.timer = 0; g.blockedT = 0; }
        } else {
          g.vx = 0; lookIdle(g, dt); if (g.timer > 0.7 && g.timer < 0.75) g.face *= -1;
          if (g.timer > 1.5) { g.arrived = false; g.si++; g.timer = 0; if (p.spot && Math.abs(p.spot.x - g.x) < 60) { const c = (cfg.inspect || 0.4) * (GB.has('g3') ? 0.5 : 1); if (Math.random() < c + 0.25) { g.inspectSpot = p.spot; g.inspectT = 0; g.walkT = 0; } } }
        }
        break;
      }
      case 'combat': {
        if (cfg.vip) { vipFlee(g, pl, dt); if (!g.sees) { g.loseT += dt; if (g.loseT > 8) A.setState(g, 'searching', g.lastSeen); } else g.loseT = 0; break; }
        if (g.sees) { g.lastSeen = { x: pl.x, y: pl.y }; g.loseT = 0; g.knowsSpot = pl.state === 'hidden' ? pl.hideSpot : null; if (pl.state === 'hidden') { pl.leaveHide(); } }
        else { if (g.loseT < 0.3 && pl.state === 'hidden') g.knowsSpot = pl.hideSpot; else if (pl.state !== 'hidden') g.knowsSpot = null; g.loseT += dt; }
        const ls = g.lastSeen || { x: g.x, y: g.y };
        lookToward(g, ls.x, ls.y - 26, dt);
        if (!g.sees && (g.loseT > 5.5 || (g.loseT > 2.2 && Math.abs(g.x - ls.x) < 30))) { A.setState(g, 'searching', ls); GB.events.emit('lostTrack', g); break; }
        if (pl.dead) { g.vx = 0; if (g.timer > 3) A.setState(g, 'unaware'); break; }
        const dx = pl.x - g.x, dy = pl.y - g.y, ad = Math.abs(dx);
        if (g.attackT > 0) { // wind-up
          g.vx = 0; g.attackT -= dt;
          if (g.attackT <= 0) strike(g, pl);
        } else if (cfg.ranged && g.sees && ad > 70) {
          g.vx = 0; g.face = U.sign(dx) || g.face; g.aimT += dt;
          if (g.aimT > 1.15) { g.aimT = 0; GB.combat.fireArrow(g, pl); }
        } else if (g.sees && ad < 34 && Math.abs(dy) < 34) {
          g.vx = 0; g.face = U.sign(dx) || g.face; g.aimT = 0;
          if (g.attackCd <= 0) { g.attackT = cfg.boss ? 0.36 : cfg.armored ? 0.45 : 0.52; g.attackCd = U.rand(0.9, 1.4); GB.sfx('swordSwing', { vol: 0.5 }); }
        } else {
          g.aimT = 0;
          nav(g, ls.x, ls.y, cfg.run);
          if (g.type === 'hunter' && g.sees && dy < -50 && ad < 60 && !g.climbing && W.at(g.x, g.y - 24) === FACADE) g.climbing = true;
        }
        break;
      }
    }
    if (g.state !== 'investigating') g.arrivedGuard = 0;
    moveGuard(g, dt);
  }
  function strike(g, pl) {
    const dx = pl.x - g.x, dy = pl.y - g.y;
    g.attackT = 0;
    if (Math.abs(dx) > 46 || Math.abs(dy) > 40 || pl.dead || pl.state === 'lock' || pl.state === 'leap') return;
    if (pl.blocking && U.sign(g.x - pl.x) === pl.face) {
      const win = GB.has('b2') ? 0.42 : 0.24;
      if (pl.blockT < win) {
        GB.sfx('parry'); if (GB.fx) { GB.fx.spark(pl.x + pl.face * 14, pl.y - 30, 10); GB.fx.shake(4); GB.fx.slowmo(0.25, 0.35); }
        g.stunT = 1.4; S().noise(pl.x, pl.y, 200, 'clash');
        if (GB.has('b6') && !g.cfg.armored && !g.cfg.boss) { A.kill(g, 'combat', pl.x); } else if (GB.has('b6')) A.damage(g, 2, pl.x);
        return;
      }
      GB.sfx('clash'); if (GB.fx) GB.fx.spark(pl.x + pl.face * 14, pl.y - 30, 5); S().noise(pl.x, pl.y, 220, 'clash');
      pl.stamina -= GB.has('b2') ? 12 : 22; pl.vx = -pl.face * 120;
      if (pl.stamina <= 0) { pl.stamina = 0; pl.hurt(g.cfg.dmg * 0.5, g.x); }
      return;
    }
    GB.sfx('swordHit'); pl.hurt(g.cfg.dmg, g.x);
  }
  function vipFlee(g, pl, dt) {
    const dir = U.sign(g.x - pl.x) || 1;
    if (g.blockedT > 0.6) { g.vx = 0; g.face = -dir; return; }
    nav(g, g.x + dir * 200, g.y, g.cfg.run);
    if (g.barkT <= 0 && g.state === 'combat') { g.barkT = 3; A.shout(g, pl.x, pl.y, 520); A.say(g, 'Guards!'); } g.barkT -= dt;
  }

  // ---------- civilians ----------
  function updCiv(c, dt, pl) {
    if (Math.abs(c.x - pl.x) > 1300) return;
    c.t -= dt;
    if (c.flee > 0) {
      c.flee -= dt; c.vx = c.fleeDir * 190; c.face = c.fleeDir;
      if (c.flee <= 0) { c.vx = 0; }
    } else if (c.crowd || c.merchant || c.official) {
      const dx = c.home - c.x; c.vx = Math.abs(dx) > 6 ? U.sign(dx) * 60 : 0; if (c.vx) c.face = U.sign(c.vx); else if (c.crowd && c.t <= 0) { c.t = U.rand(2, 5); c.face = U.sign(c.crowd.x - c.x) || c.face; }
    } else {
      if (c.t <= 0) { c.t = U.rand(2, 7); c.dir = Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
      if (c.x < c.x0) c.dir = 1; if (c.x > c.x1) c.dir = -1;
      c.vx = (c.dir || 0) * 46; if (c.vx) c.face = c.dir;
      // react to violence
      if (GB.ai.combatCount > 0 && Math.abs(pl.x - c.x) < 150 && Math.abs(pl.y - c.y) < 60 && pl.drawn) A.civFlee(c, pl.x, false);
    }
    if (c.flee <= 0 && c.seeT === undefined) c.seeT = Math.random();
    c.seeT -= dt;
    if (c.seeT <= 0 && c.flee <= 0) { c.seeT = 0.5; for (const b of GB.combat.bodies) if (!b.hidden && !b.carried && Math.abs(b.x - c.x) < 110 && Math.abs(b.y - c.y) < 30) { A.civFlee(c, b.x, !b.screamed); b.screamed = true; break; } if (pl.carrying && Math.abs(pl.x - c.x) < 120 && Math.abs(pl.y - c.y) < 30) A.civFlee(c, pl.x, true); }
    c.vy = Math.min(c.vy + 1500 * dt, 1200); phys.move(c, dt);
    if (c.hitWall) { c.dir = -c.hitWall; c.fleeDir = -c.hitWall; if (c.onGround) { const tx = Math.floor((c.x + c.hitWall * 10) / T), fr = Math.floor((c.y - 1) / T); if (W.solid(tx, fr) && !W.solid(tx, fr - 1) && !W.solid(tx, fr - 2)) { c.y -= T; c.x += c.hitWall * 3; } } }
    if (Math.abs(c.vx) > 5) c.phase += Math.abs(c.vx) * dt * 0.07;
  }
})();
