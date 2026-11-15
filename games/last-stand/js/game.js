'use strict';
/* ===== game: state, level flow, props, projectiles, pickups, spawning, rendering ===== */
const G = {
  state: 'title', li: 0, score: 0, lives: 3, kills: 0, deaths: 0, t: 0, E: [], B: [], GR: [], EG: [], PK: [], PR: [], spawnT: 0, special: null, maxCamX: 0, cp: 0, boss: false, bossIntro: 0, clearT: 0, levelT: 0, noHit: true, banner: 0, carry: null,
  startRun(li, keep) {
    this.li = li; if (!keep) { this.score = 0; this.lives = DIFF().lives; this.carry = null; }
    this.load(li); RWB.send('start');
  },
  load(li) {
    World.build(li); FX.reset(); Haz.reset(); Boss.b = null; Cam.lockL = Cam.lockR = null;
    this.E = []; this.B = []; this.GR = []; this.EG = []; this.PK = []; this.PR = []; this.special = null; this.boss = false; this.bossIntro = 0; this.clearT = 0; this.levelT = 0; this.kills = 0; this.deaths = 0; this.noHit = true; this.maxCamX = 0; this.cp = 0; this.spawnT = 4;
    for (const e of World.ents) { if (e.k === 'spawn') continue; this.PR.push(Object.assign({ t: 0, alive: true }, e)); }
    this.spawns = World.ents.filter(e => e.k === 'spawn').map(e => Object.assign({ done: false }, e)); this.tags = 0; this.tagTotal = this.PR.filter(p => p.k === 'tag').length; this.fade = 1;
    P = mkPlayer(World.checkpoints[0], 10 * TS); const sy = World.surfaceY(P.x + 10, 0); P.y = (sy || 13 * TS) - P.h;
    if (this.carry) { P.inv2 = Object.assign({ rifle: Infinity }, this.carry.inv); P.cur = this.carry.cur in P.inv2 ? this.carry.cur : 'rifle'; P.gren = this.carry.gren; P.sp = this.carry.sp; }
    Cam.x = clamp(P.x - W / 2 + 120, 0, World.W - W); Cam.y = clamp(P.y - H * .58, -60, ROWS * TS - H);
    this.state = 'play'; this.banner = 3; Music.intensity = 1; Music.play(LEVELS[li].music); this.t = 0; Amb.cur = null; Amb.set(LEVELS[li].id);
  },
  respawn() {
    const cx = World.checkpoints[this.cp] || World.checkpoints[0];
    const keepInv = P.inv2, cur = P.cur; P = mkPlayer(cx, 0); const sy = World.surfaceY(cx + 10, 0); P.y = (sy || 13 * TS) - P.h; P.inv = 2.4;
    P.inv2 = keepInv; if (cur !== 'rifle') { delete P.inv2[cur]; } P.cur = 'rifle'; P.gren = Math.max(3, P.gren || 0);
    if (this.boss) { P.x = Cam.lockL + 120; P.y = FLOOR - P.h - 40; }
    this.E = this.E.filter(e => Math.abs(e.x - P.x) > 500 || e.t === 'turret' || this.boss); this.B = this.B.filter(b => b.own === 'p');
    FX.text(P.x + 10, P.y - 20, 'BACK IN ACTION', '#7ae0ff', 18);
  },
  bossDown() { this.clearT = .01; Music.stop(); Snd.play('clear'); RWB.ach('boss' + (this.li + 1)); for (const e of this.E) if (e.alive) eKill(e, 1, 'boom'); },
  EB() { this.B = this.B.filter(b => b.own === 'p'); this.EG = []; },
  update(dt) {
    this.t += dt; this.levelT += dt; this.banner = Math.max(0, this.banner - dt);
    if (FX.hs > 0) { FX.hs -= dt; FX.update(dt * .1); return; }
    playerUpdate(dt); World.update(dt);
    if (!P.alive && P.deathT > 1.6) { if (this.lives > 0) { this.lives--; this.respawn(); } else { this.gameOver(); return; } }
    // spawn markers come alive as the camera reaches them
    for (const s of this.spawns) if (!s.done && s.x < Cam.x + W + 40 && s.x > Cam.x - 120) { s.done = true; spawnEnemy(s.e, s.x, s.y); }
    // dynamic reinforcements keep the pressure on (never during boss fights)
    if (!this.boss) { this.spawnT -= dt; const prog = P.x / World.W, alive = this.E.filter(e => e.alive).length; if (this.spawnT <= 0 && alive < 7 + this.li) { this.spawnT = rnd(2.4, 4.2) - prog * 1.2 - this.li * .2; const side = Math.random() < .8 ? 1 : -1, x = side > 0 ? Cam.x + W + 40 : Cam.x - 40, sy = World.surfaceY(x, Cam.y + 40); if (sy != null && x > 400 && x < World.arenaX - 200) { const t = Math.random() < .12 + this.li * .03 ? pick(LEVELS[this.li].pool.filter(k => k !== 'turret' && k !== 'sniper')) : 'soldier'; const e = spawnEnemy(t, x, sy); e.face = -side; } } }
    for (const e of this.E) enemyUpdate(e, dt);
    this.E = this.E.filter(e => e.alive || e.dead < 2) ; this.E = this.E.filter(e => e.alive ? (e.x > Cam.x - 700 && e.x < Cam.x + W + 900) || this.boss : true);
    this.updProps(dt); this.updBullets(dt); this.updGrenades(dt); this.updPickups(dt); this.updSpecial(dt);
    if (this.boss) { Boss.update(dt); Haz.update(dt); }
    // checkpoints
    for (let i = this.cp + 1; i < World.checkpoints.length; i++) if (P.x > World.checkpoints[i]) { this.cp = i; Snd.play('checkpoint'); FX.text(P.x + 10, P.y - 30, 'CHECKPOINT', '#5aff8a', 20); }
    Cam.update(dt, P); FX.update(dt);
    if (Input.wheel) Input.wheel = 0;
    if (this.clearT > 0) { this.clearT += dt; if (this.clearT > 2.8) this.levelClear(); }
  },
  /* ---------- props ---------- */
  updProps(dt) {
    for (const p of this.PR) {
      if (!p.alive) continue; p.t += dt;
      const near = Math.abs(p.x - P.x) < W;
      switch (p.k) {
        case 'checkpoint': break;
        case 'med': if (ovl({ x: p.x + 4, y: p.y - 24, w: 24, h: 24 }, P)) { p.alive = false; P.hp = Math.min(P.maxHp, P.hp + 45); Snd.play('heal'); FX.text(p.x + 16, p.y - 30, '+45 HP', '#5aff8a', 16); } break;
        case 'capsule': if (!p.fly && P.x > p.x - 420) { p.fly = 1; p.fx = Cam.x - 40; p.fy = p.y; } if (p.fly) { p.fx += 170 * dt; p.cy = p.fy + Math.sin(p.t * 3) * 40; if (p.fx > Cam.x + W + 80) p.alive = false; } break;
        case 'crusher': { const c = (p.t * .9 + p.ph) % 3; p.dy = c < 1.6 ? -150 + Math.min(c, .2) * 0 : c < 1.75 ? lerp(-150, 0, (c - 1.6) / .15) : c < 2.3 ? 0 : lerp(0, -150, (c - 2.3) / .7); if (c >= 1.6 && c < 1.75) p.armed = 1; if (p.armed && c >= 1.75) { p.armed = 0; if (near) { Cam.add(8); Snd.play('land'); FX.smoke(p.x + 16, p.y, 3); } } const r = { x: p.x - 8, y: p.y - 40 + p.dy, w: 48, h: 40 }; if (c > 1.6 && c < 2.3 && ovl(r, P)) pHurt(34, sgn(P.x - p.x)); break; }
        case 'laser': { const c = (p.t + p.ph) % 2.6; p.on = c > 1.1 && c < 2.2; p.warn = c > .7 && c <= 1.1; if (p.on && P.x + P.w > p.x + 10 && P.x < p.x + 22 && P.y + P.h > p.y - 160) pHurt(20, sgn(P.x - p.x)); if (p.on) for (const e of this.E) if (e.alive && e.x + e.w > p.x + 10 && e.x < p.x + 22) eHurt(e, 60 * dt, 1, 'laser'); break; }
        case 'flamejet': { const c = (p.t + p.ph) % 2.7; p.on = c > 1.3 && c < 2.3; p.warn = c > .9 && c <= 1.3; if (p.on) { if (Math.random() < .8) FX.p({ x: p.x + 16 + rnd(-6, 6), y: p.y - 4, vx: rnd(-20, 20), vy: rnd(-560, -380), life: .35, s: 10, s2: 22, c: pick(['#ffd04a', '#ff8a2a', '#ff4a1a']), add: true, drag: 1 }); if (P.x + P.w > p.x + 4 && P.x < p.x + 28 && P.y + P.h > p.y - 150) pHurt(18, sgn(P.x - p.x)); if (near && Math.random() < .2) Snd.play('flame', .5); } break; }
        case 'icicle': { if (!p.fall && Math.abs(P.x - p.x) < 90 && P.y > p.y) { p.fall = 1; p.vy = 0; p.shake = .35; Snd.play('crack', .5); } if (p.fall) { if (p.shake > 0) p.shake -= dt; else { p.vy += 1800 * dt; p.y += p.vy * dt; if (ovl({ x: p.x + 6, y: p.y, w: 20, h: 30 }, P)) { pHurt(22, 0); p.alive = false; } if (World.solidPx(p.x + 16, p.y + 30)) { p.alive = false; for (let i = 0; i < 8; i++) FX.debris(p.x + 16, p.y + 26, '#d8f0ff'); Snd.play('crack', .4); } } } break; }
        case 'mine': { if (!p.trig && Math.abs(P.x + P.w / 2 - (p.x + 16)) < 30 && P.y + P.h > p.y - 20) { p.trig = .45; Snd.play('alarm', .4); } if (p.trig) { p.trig -= dt; if (p.trig <= 0) { p.alive = false; FX.explode(p.x + 16, p.y - 6, 70); areaDamage(p.x + 16, p.y - 6, 70, 26); } } break; }
        case 'bossTrigger': if (!this.boss && P.x > p.x) { this.startBoss(); p.alive = false; } break;
        case 'tag': if (ovl({ x: p.x + 6, y: p.y - 30, w: 20, h: 26 }, P)) { p.alive = false; this.tags++; this.score += 1000; Snd.play('pickup'); FX.text(p.x + 16, p.y - 40, 'DOG TAG ' + this.tags + '/' + this.tagTotal + '  +1000', '#9fe8ff', 15); FX.spark(p.x + 16, p.y - 16, '#bfe8ff', 10); } break;
        case 'sign': break;
      }
    }
  },
  startBoss() {
    this.boss = true; const ax = World.arenaX, lockL = ax + 64; Cam.lockL = lockL; Cam.lockR = lockL + W;
    for (let r = 0; r < 13; r++) World.set(Math.floor(lockL / TS) - 1, r, 1); // seal the arena behind the player
    this.E = this.E.filter(e => e.x > lockL); this.cp = World.checkpoints.length - 1;
    Boss.start(this.li);
  },
  hitProp(p, dmg, src) {
    if (p.k === 'barrel') { p.hp = (p.hp == null ? 30 : p.hp) - dmg; if (p.hp <= 0) { p.alive = false; const x = p.x + 16, y = p.y - 20; FX.explode(x, y, 100); for (const e of this.E) if (e.alive && dist(x, y, e.x + e.w / 2, e.y + e.h / 2) < 110) eHurt(e, 120, sgn(e.x - x), 'blast'); areaDamage(x, y, 90, 24); for (const q of this.PR) if (q !== p && q.alive && (q.k === 'barrel' || q.k === 'crate') && Math.abs(q.x - p.x) < 100) setTimeout(() => q.alive && this.hitProp(q, 99, 'blast'), 140); } return true; }
    if (p.k === 'crate') { p.hp = (p.hp == null ? 24 : p.hp) - dmg; Snd.play('hit', .4); if (p.hp <= 0) { p.alive = false; Snd.play('crack'); for (let i = 0; i < 10; i++) FX.debris(p.x + 16, p.y - 16, '#8a5a2a'); const r = Math.random(); if (r < .45) dropWeapon(p.x + 16, p.y - 20); else if (r < .75) dropItem('med', p.x + 16, p.y - 20); else dropItem('gren', p.x + 16, p.y - 20); } return true; }
    if (p.k === 'capsule' && p.fly) { p.alive = false; FX.explode(p.fx, p.cy, 50, { vol: .5 }); dropWeapon(p.fx, p.cy); return true; }
    if (p.k === 'sandbag') { Snd.play('hit', .3); FX.p({ x: p.x + 16, y: p.y - 14, vx: rnd(-60, 60), vy: -120, g: 600, life: .5, s: 3, c: '#c8a870' }); return true; }
    return false;
  },
  propRect(p) { if (p.k === 'barrel') return { x: p.x + 4, y: p.y - 36, w: 24, h: 36 }; if (p.k === 'crate') return { x: p.x + 2, y: p.y - 30, w: 30, h: 30 }; if (p.k === 'capsule' && p.fly) return { x: p.fx - 22, y: p.cy - 14, w: 44, h: 28 }; if (p.k === 'sandbag') return { x: p.x, y: p.y - 22, w: 40, h: 22 }; return null; },
  /* ---------- projectiles ---------- */
  updBullets(dt) {
    for (const b of this.B) {
      b.life -= dt; if (b.grav) b.vy += b.grav * dt;
      if (b.acc) { const s = Math.hypot(b.vx, b.vy), ns = s + b.acc * dt; b.vx *= ns / s; b.vy *= ns / s; if (Math.random() < .7) FX.p({ x: b.x, y: b.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: .4, s: 4, s2: 10, c: 'rgba(200,200,200,.4)' }); }
      if (b.home && P.alive) { const a = Math.atan2(P.y + 20 - b.y, P.x + 10 - b.x), cur = Math.atan2(b.vy, b.vx), s = Math.hypot(b.vx, b.vy), na = cur + clamp(Math.atan2(Math.sin(a - cur), Math.cos(a - cur)), -b.home * dt, b.home * dt); b.vx = Math.cos(na) * s; b.vy = Math.sin(na) * s; }
      if (b.type === 'erocket' && Math.random() < .6) FX.p({ x: b.x, y: b.y, life: .35, s: 4, s2: 9, c: 'rgba(200,200,200,.35)' });
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 10));
      for (let i = 0; i < steps && b.life > 0; i++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps; if (b.grow) b.r += 30 * dt / steps;
        if (World.solidPx(b.x, b.y)) { if (b.bounce > 0) { b.bounce--; b.vy = -Math.abs(b.vy) * .7; b.y -= 4; Snd.play('bounce'); } else { this.bulletEnd(b, true); break; } }
        if (b.own === 'p') {
          for (const e of this.E) { if (!e.alive || (b.hit && b.hit.has(e))) continue; if (b.x + b.r > e.x && b.x - b.r < e.x + e.w && b.y + b.r > e.y && b.y - b.r < e.y + e.h) {
            if (b.splash) { this.bulletEnd(b); break; }
            const res = eHurt(e, b.dmg, sgn(b.vx), b.type === 'plasma' ? 'plasma' : b.type === 'shotgun' ? 'blast' : 'gun');
            if (res === 'block') { b.vx *= -.4; b.vy = -Math.abs(b.vy) - 200; b.own = 'x'; b.life = .3; break; }
            if (b.type === 'flame') e.burn = 1.4; FX.spark(b.x, b.y, b.type === 'laser' ? '#4af0ff' : '#ffe0a0', 3);
            if (b.pierce > 0 && b.hit) { b.hit.add(e); b.pierce--; } else { b.life = 0; break; } } }
          if (b.life > 0) for (const p of this.PR) { if (!p.alive) continue; const r = this.propRect(p); if (r && b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h) { if (b.splash) { this.bulletEnd(b); break; } this.hitProp(p, b.dmg, 'gun'); if (!b.pierce || p.k !== 'capsule') { b.life = 0; FX.spark(b.x, b.y, '#ffe0a0', 2); } break; } }
          if (b.life > 0 && this.boss && Boss.b) { const part = Boss.hitTest(b); if (part && !(b.hit && b.hit.has(part))) { if (b.splash) { this.bulletEnd(b); break; } Boss.damage(b.dmg, part, b.type); if (b.pierce > 0 && b.hit) { b.hit.add(part); b.pierce--; } else b.life = 0; } }
          for (const eb of this.B) if (eb.own === 'e' && (eb.type === 'erocket' || eb.type === 'eplasma') && Math.abs(eb.x - b.x) < eb.r + 6 && Math.abs(eb.y - b.y) < eb.r + 6) { eb.hp = (eb.hp || (eb.type === 'eplasma' ? 120 : 20)) - b.dmg; if (eb.hp <= 0) { this.bulletEnd(eb); } b.life = 0; FX.spark(b.x, b.y); }
        } else if (b.own === 'e' && P.alive) {
          if (b.x + b.r > P.x + 2 && b.x - b.r < P.x + P.w - 2 && b.y + b.r > P.y + 2 && b.y - b.r < P.y + P.h) { if (b.splash) this.bulletEnd(b); else { pHurt(b.dmg, sgn(b.vx)); b.life = 0; } }
        }
      }
      if (b.life <= 0 && (b.splash) && !b.ended) this.bulletEnd(b);
      if (b.x < Cam.x - 200 || b.x > Cam.x + W + 200 || b.y > ROWS * TS + 100 || b.y < Cam.y - 400) b.life = 0;
    }
    this.B = this.B.filter(b => b.life > 0);
    for (const e of this.E) if (e.burn > 0 && e.alive) { e.burn -= dt; eHurt(e, 12 * dt, 0, 'burn'); if (Math.random() < .4) FX.fire(e.x + e.w / 2, e.y + 20, 1); }
  },
  bulletEnd(b, wall) {
    if (b.ended) return; b.ended = 1; b.life = 0;
    if (b.splash) {
      FX.explode(b.x, b.y, b.splash * (b.type === 'plasma' ? 1.1 : 1));
      if (b.own === 'p') { for (const e of this.E) if (e.alive && dist(b.x, b.y, e.x + e.w / 2, e.y + e.h / 2) < b.splash + e.w / 2) eHurt(e, b.dmg * (b.type === 'plasma' ? 1 : 1), sgn(e.x - b.x), 'blast'); for (const p of this.PR) { const r = this.propRect(p); if (p.alive && r && dist(b.x, b.y, r.x + r.w / 2, r.y + r.h / 2) < b.splash + 20) this.hitProp(p, 99, 'blast'); } if (this.boss && Boss.b) { for (const part of Boss.b.def.parts(Boss.b)) if (!part.off && b.x > part.x - b.splash && b.x < part.x + part.w + b.splash && b.y > part.y - b.splash && b.y < part.y + part.h + b.splash) { Boss.damage(b.dmg * .8, part, 'blast'); break; } } }
      else areaDamage(b.x, b.y, b.splash, b.dmg);
    } else if (wall) { FX.spark(b.x, b.y, b.own === 'p' ? '#ffe0a0' : '#ff9a6a', 3); if (b.type === 'ice' || b.type === 'icicle') for (let i = 0; i < 3; i++) FX.debris(b.x, b.y, '#d8f0ff'); }
  },
  updGrenades(dt) {
    const tick = (n, own) => { n.t += dt; n.vy += 1300 * dt; n.rot += n.vx * dt * .05; const ox = n.x, oy = n.y; n.x += n.vx * dt; n.y += n.vy * dt;
      if (World.solidPx(n.x, n.y + 5)) { n.y = oy; n.vy *= -.45; n.vx *= .7; if (Math.abs(n.vy) > 60) Snd.play('bounce', .5); } if (World.solidPx(n.x + sgn(n.vx) * 5, n.y)) { n.x = ox; n.vx *= -.5; }
      let boom = n.t > (own ? 1.25 : 1.6); if (own) for (const e of this.E) if (e.alive && n.x > e.x && n.x < e.x + e.w && n.y > e.y && n.y < e.y + e.h) boom = true;
      if (own && this.boss && Boss.b && Boss.hitTest({ x: n.x, y: n.y, r: 6 })) boom = true;
      if (boom) { n.dead = 1; this.bulletEnd({ x: n.x, y: n.y, splash: 105, dmg: own ? 90 : 18, own: own ? 'p' : 'e', type: 'gren' }); } };
    for (const n of this.GR) tick(n, true); for (const n of this.EG) tick(n, false);
    this.GR = this.GR.filter(n => !n.dead); this.EG = this.EG.filter(n => !n.dead);
  },
  updPickups(dt) {
    for (const k of this.PK) {
      k.t += dt; k.vy = Math.min(600, k.vy + 1200 * dt); k.x += k.vx * dt; k.vx *= .98; k.y += k.vy * dt; const sy = World.surfaceY(k.x, k.y - 12); if (sy != null && k.y > sy - 2 && k.vy > 0) { k.y = sy - 2; k.vy = 0; k.vx = 0; }
      if (k.y > ROWS * TS + 50) k.dead = 1;
      if (Math.abs(P.x + P.w / 2 - k.x) < 26 && Math.abs(P.y + P.h / 2 - (k.y - 12)) < 40 && P.alive && k.t > .25) {
        k.dead = 1;
        if (k.k === 'weapon') { const Wd = WEAPONS[k.w]; P.inv2[k.w] = Math.min((P.inv2[k.w] || 0) + Wd.ammo, Wd.ammo * 2); P.cur = k.w; P.charge = 0; Snd.play('weapon'); FX.text(k.x, k.y - 40, Wd.name + '!', Wd.col, 20); FX.flash(.12, Wd.col); this.score += 100; }
        else if (k.k === 'med') { P.hp = Math.min(P.maxHp, P.hp + 35); Snd.play('heal'); FX.text(k.x, k.y - 30, '+35 HP', '#5aff8a', 16); }
        else if (k.k === 'gren') { P.gren = Math.min(9, P.gren + 2); Snd.play('pickup'); FX.text(k.x, k.y - 30, '+2 GRENADES', '#ffd84a', 15); }
        else if (k.k === 'life') { this.lives++; Snd.play('life'); FX.text(k.x, k.y - 30, '1UP!', '#5aff8a', 22); }
      }
      if (k.t > 18) k.dead = 1;
    }
    this.PK = this.PK.filter(k => !k.dead);
    if (this.score >= (this.nextLife || 20000)) { this.nextLife = (this.nextLife || 20000) + 30000; this.lives++; Snd.play('life'); FX.text(P.x + 10, P.y - 50, 'EXTRA LIFE!', '#5aff8a', 22); }
  },
  updSpecial(dt) {
    const s = this.special; if (!s) return; s.t += dt;
    if (s.t > .3 && s.n < 10 && s.t > .3 + s.n * .11) { s.n++; const x = Cam.x + 60 + (s.n * 397) % (W - 120); s.beams = s.beams || []; s.beams.push({ x, t: 0 }); Snd.play('laser'); Cam.add(6);
      for (const e of this.E) if (e.alive && Math.abs(e.x + e.w / 2 - x) < 110) eHurt(e, 260, sgn(e.x - x), 'plasma');
      for (const p of this.PR) { const r = this.propRect(p); if (p.alive && r && Math.abs(r.x - x) < 90) this.hitProp(p, 99, 'blast'); }
      for (const b of this.B) if (b.own === 'e') b.life = 0;
      if (this.boss && Boss.b && !Boss.b.dying) { const parts = Boss.b.def.parts(Boss.b), wk = parts.find(q => q.weak && !q.off) || parts.find(q => !q.off); if (wk) Boss.damage(80, Object.assign({}, wk, { weak: true }), 'plasma'); } }
    if (s.beams) for (const bm of s.beams) bm.t += dt;
    if (s.t > 1.8) this.special = null;
  },
  levelClear() {
    this.state = 'clear'; const L = LEVELS[this.li]; const bonus = { time: Math.max(0, Math.round(3000 - this.levelT * 6)), lives: this.lives * 1000, nohit: this.noHit ? 5000 : 0 };
    this.bonus = bonus; this.score += bonus.time + bonus.lives + bonus.nohit; Save.d.best[this.li] = Math.max(Save.d.best[this.li] || 0, this.score);
    Save.d.unlocked = Math.max(Save.d.unlocked, Math.min(5, this.li + 2)); if (!Save.d.cleared.includes(this.li)) Save.d.cleared.push(this.li); Save.write();
    RWB.ach('level' + (this.li + 1)); if (this.noHit) RWB.ach('nohit');
    this.carry = { inv: Object.assign({}, P.inv2), cur: P.cur, gren: P.gren, sp: P.sp };
    if (this.li === 4) { this.state = 'victory'; this.vT = 0; RWB.send('finish', { metric: 'score', value: this.score, higherBetter: true, result: 'win' }); RWB.ach('victory'); Music.play(0); }
    UI.sel = 0;
  },
  gameOver() { this.state = 'over'; Music.stop(); RWB.send('finish', { metric: 'score', value: this.score, higherBetter: true, result: 'lose' }); UI.sel = 0; this.overT = 0; },
  /* ---------- rendering ---------- */
  draw() {
    const g = ctx; Bg.draw(Cam.x);
    g.save(); g.translate(-Math.round(Cam.x - Cam.sx), -Math.round(Cam.y - Cam.sy));
    this.drawDeco(g, true); this.drawTiles(g); this.drawDeco(g, false); this.drawProps(g);
    if (this.boss) Boss.draw(g);
    for (const k of this.PK) this.drawPickup(g, k);
    for (const e of this.E) drawEnemy(g, e);
    drawPlayer(g);
    this.drawGren(g); this.drawBullets(g);
    if (this.boss) Haz.draw(g);
    FX.draw(g); FX.drawLights(g);
    if (this.special && this.special.beams) for (const bm of this.special.beams) { const k = 1 - bm.t / .5; if (k <= 0) continue; g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(bm.x - 40, 0, bm.x + 40, 0); gr.addColorStop(0, 'rgba(255,200,80,0)'); gr.addColorStop(.5, 'rgba(255,240,180,' + k + ')'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.fillRect(bm.x - 40, Cam.y, 80, H); g.globalCompositeOperation = 'source-over'; }
    FX.drawText(g);
    g.restore();
    this.drawFore(g);
    this.drawWeather(g);
    // vignette + flash
    const vg = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (P.hp < 30 && P.alive) { g.fillStyle = 'rgba(255,0,20,' + (.12 + .08 * Math.sin(this.t * 8)) + ')'; g.fillRect(0, 0, W, H); }
    if (this.fade > 0) { this.fade = Math.max(0, this.fade - 1 / 40); g.fillStyle = 'rgba(0,0,0,' + this.fade + ')'; g.fillRect(0, 0, W, H); }
    if (FX.flashA > 0) { g.globalAlpha = FX.flashA; g.fillStyle = FX.flashC; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    HUD.draw(g);
  },
  drawTiles(g) {
    const P2 = World.L.pal, c0 = Math.max(0, Math.floor(Cam.x / TS) - 1), c1 = Math.min(World.cols - 1, Math.floor((Cam.x + W) / TS) + 1), id = World.L.id;
    for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) {
      const t = World.t(c, r); if (!t) continue; const x = c * TS, y = r * TS, above = World.t(c, r - 1);
      if (SOLID[t]) {
        const top = !SOLID[above];
        let dep = 0; while (dep < 6 && SOLID[World.t(c, r - dep - 1)]) dep++; g.fillStyle = shade(P2.ground, Math.max(.45, 1.08 - dep * .11)); g.fillRect(x, y, TS, TS);
        const n = (c * 7 + r * 13) % 5; g.fillStyle = shade(P2.ground, .82 + n * .04); g.fillRect(x + (n * 5) % 20, y + 8 + (n * 3) % 14, 8, 5);
        if (id === 'factory' || id === 'fortress') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, TS - 2, TS - 2); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 4, y + 4, 3, 3); g.fillRect(x + TS - 7, y + 4, 3, 3); }
        if (top) {
          if (t === 3 || t === 9) { g.fillStyle = t === 9 ? '#b8d8f0' : '#d8f0ff'; g.fillRect(x, y, TS, 10); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x + 4, y + 2, 12, 2); if (t === 9) { const k = World.crack[c + ',' + r]; g.strokeStyle = 'rgba(40,80,120,' + (k ? .4 + k.t : .35) + ')'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 4, y + 2); g.lineTo(x + 14, y + 8); g.lineTo(x + 26, y + 3); if (k) { g.moveTo(x + 14, y + 8); g.lineTo(x + 18, y + 18); } g.stroke(); } }
          else if (t === 4 || t === 5) { g.fillStyle = '#2a2a30'; g.fillRect(x, y, TS, 10); g.fillStyle = '#ffb020'; const off = ((this.t * 60 * (t === 5 ? 1 : -1)) % 16 + 16) % 16; for (let k = -16; k < TS; k += 16) g.fillRect(x + k + off, y + 3, 8, 3); }
          else { g.fillStyle = P2.top; g.fillRect(x, y, TS, 8); g.fillStyle = P2.top2; g.fillRect(x, y, TS, 3); if (id === 'jungle') { g.fillStyle = P2.top; for (let k = 0; k < 4; k++) g.fillRect(x + k * 8 + 2, y + 8, 3, 3 + ((c + k) % 3) * 2); } if (id === 'desert') { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x + (c % 3) * 9, y + 4, 9, 2); } }
        }
      } else if (t === 2) { g.fillStyle = id === 'jungle' ? '#5a3a1e' : id === 'frozen' ? '#9ab8d8' : '#4a4a52'; g.fillRect(x, y, TS, 9); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, TS, 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + 9, TS, 3); if (World.t(c - 1, r) !== 2) { g.fillStyle = '#222'; g.fillRect(x + 2, y + 9, 3, 18); } if (World.t(c + 1, r) !== 2) { g.fillStyle = '#222'; g.fillRect(x + TS - 5, y + 9, 3, 18); } }
      else if (t === 6) { const isTop = World.t(c, r - 1) !== 6; if (id === 'jungle' || id === 'frozen') { g.fillStyle = '#2a2a30'; g.fillRect(x, y + 14, TS, TS - 14); g.fillStyle = '#c8ccd8'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + k * 8, y + 16); g.lineTo(x + k * 8 + 4, y + 1); g.lineTo(x + k * 8 + 8, y + 16); g.fill(); } } else { g.fillStyle = id === 'fortress' ? '#ff4a1a' : '#4aff3a'; g.globalAlpha = .85; g.fillRect(x, y + (isTop ? 6 + Math.sin(this.t * 3 + c) * 2 : 0), TS, TS); g.globalAlpha = 1; if (isTop && Math.random() < .03) FX.p({ x: x + rnd(0, TS), y: y + 6, vy: -60, life: .6, s: 3, s2: 7, c: id === 'fortress' ? 'rgba(255,120,30,.5)' : 'rgba(120,255,80,.5)', add: true }); } }
      else if (t === 7) { g.fillStyle = 'rgba(60,140,170,.55)'; g.fillRect(x, y + (World.t(c, r - 1) !== 7 ? 6 : 0), TS, TS); if (World.t(c, r - 1) !== 7) { g.fillStyle = 'rgba(200,240,255,.5)'; g.fillRect(x, y + 6 + Math.sin(this.t * 2 + c) * 1.5, TS, 2); } }
      else if (t === 8) { g.fillStyle = '#c89a5a'; g.fillRect(x, y, TS, TS); g.fillStyle = 'rgba(120,80,40,.4)'; const o = (this.t * 10 + c * 5) % 20; g.fillRect(x + o, y + 6, 10, 2); g.fillRect(x + (o + 10) % 30, y + 16, 8, 2); }
    }
  },
  drawDeco(g, back) {
    const id = World.L.id;
    for (const d of World.deco) { if (d.x < Cam.x - 200 || d.x > Cam.x + W + 200) continue;
      if (back && d.k === 'tree') { g.fillStyle = '#1a120c'; g.fillRect(d.x - 10, d.y - 260, 20, 260); g.fillStyle = '#123a1a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(d.x + (i - 1.5) * 34, d.y - 250 + (i % 2) * 22, 60, 26, 0, 0, TAU); g.fill(); } }
      if (!back && d.k === 'plant') { g.save(); g.translate(d.x, d.y); g.scale(d.s, d.s); if (id === 'jungle') { g.strokeStyle = d.v < .5 ? '#2a8a2a' : '#4aaa3a'; g.lineWidth = 3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(i * 8, -14, i * 14, -22 + Math.abs(i) * 4 + Math.sin(this.t * 2 + d.x) * 2); g.stroke(); } } else if (id === 'desert') { if (d.v < .4) { g.fillStyle = '#3a6a2a'; g.fillRect(-3, -26, 6, 26); g.fillRect(-10, -18, 7, 4); g.fillRect(-10, -24, 4, 8); } else { g.fillStyle = '#8a6a4a'; g.beginPath(); g.ellipse(0, -4, 10, 6, 0, 0, TAU); g.fill(); } } else if (id === 'frozen') { g.fillStyle = '#e8f4ff'; g.beginPath(); g.ellipse(0, -2, 14, 6, 0, 0, TAU); g.fill(); } else if (id === 'factory') { g.fillStyle = '#3a3a42'; g.fillRect(-6, -14, 12, 14); g.fillStyle = '#ffb020'; g.fillRect(-6, -14, 12, 3); } else { g.fillStyle = '#2a1a1e'; g.fillRect(-4, -18, 8, 18); g.fillStyle = 'rgba(255,60,60,.8)'; g.fillRect(-2, -16, 4, 3); } g.restore(); } }
  },
  drawProps(g) {
    const id = World.L.id;
    for (const p of this.PR) { if (!p.alive) continue; const x = p.x, y = p.y; if (x < Cam.x - 300 || x > Cam.x + W + 300) continue;
      switch (p.k) {
        case 'barrel': g.fillStyle = '#b8322a'; g.fillRect(x + 4, y - 36, 24, 36); g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(x + 4, y - 36, 24, 36); g.fillStyle = '#ffd84a'; g.fillRect(x + 4, y - 26, 24, 6); g.fillStyle = '#000'; g.font = '900 10px Arial'; g.textAlign = 'center'; g.fillText('!', x + 16, y - 21); break;
        case 'crate': g.fillStyle = '#8a5a2a'; g.fillRect(x + 2, y - 30, 30, 30); g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(x + 2, y - 30, 30, 30); g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 4, y - 28); g.lineTo(x + 30, y - 2); g.moveTo(x + 30, y - 28); g.lineTo(x + 4, y - 2); g.stroke(); g.fillStyle = '#ffd84a'; g.fillRect(x + 12, y - 18, 10, 6); break;
        case 'sandbag': g.fillStyle = '#b89a6a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x + 8 + i * 12, y - 6, 9, 6, 0, 0, TAU); g.fill(); } g.beginPath(); g.ellipse(x + 14, y - 16, 9, 6, 0, 0, TAU); g.ellipse(x + 26, y - 16, 9, 6, 0, 0, TAU); g.fill(); break;
        case 'med': { const b = Math.sin(p.t * 4) * 3; g.fillStyle = '#f4f4f8'; g.fillRect(x + 4, y - 24 + b, 24, 18); g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(x + 4, y - 24 + b, 24, 18); g.fillStyle = '#e8323c'; g.fillRect(x + 13, y - 21 + b, 6, 12); g.fillRect(x + 10, y - 18 + b, 12, 6); break; }
        case 'checkpoint': { const on = World.checkpoints.indexOf(x) <= this.cp; g.fillStyle = '#222'; g.fillRect(x + 14, y - 80, 4, 80); g.fillStyle = on ? '#5aff8a' : '#888'; g.beginPath(); g.moveTo(x + 18, y - 80); g.lineTo(x + 50 + Math.sin(this.t * 5) * 3, y - 72); g.lineTo(x + 18, y - 62); g.fill(); if (on) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(90,255,140,.25)'; g.beginPath(); g.arc(x + 16, y - 70, 30, 0, TAU); g.fill(); g.restore(); } break; }
        case 'capsule': if (p.fly) { const cx = p.fx, cy = p.cy; g.save(); g.translate(cx, cy); g.fillStyle = '#c8ccd8'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 22, 12, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#ff3a3a'; g.fillRect(-6, -12, 12, 24); for (const s of [-1, 1]) { g.fillStyle = '#888'; g.beginPath(); g.moveTo(s * 18, -4); g.lineTo(s * 32, -14 + Math.sin(this.t * 30) * 4); g.lineTo(s * 30, 2); g.fill(); g.stroke(); } g.fillStyle = '#fff'; g.font = '900 11px Arial'; g.textAlign = 'center'; g.fillText('W', 0, 4); g.restore(); } break;
        case 'crusher': { const top = y - 40 + (p.dy || 0); g.fillStyle = '#2a2a30'; g.fillRect(x + 10, Cam.y - 20, 12, top - Cam.y + 20); g.fillStyle = '#5a5a62'; g.fillRect(x - 8, top, 48, 40); g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(x - 8, top, 48, 40); g.fillStyle = '#ffb020'; for (let i = 0; i < 4; i++) g.fillRect(x - 6 + i * 12, top + 32, 6, 6); break; }
        case 'laser': { g.fillStyle = '#3a3a42'; g.fillRect(x + 8, y - 12, 16, 12); g.fillRect(x + 8, y - 176, 16, 12); if (p.on) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,40,60,.8)'; g.fillRect(x + 12, y - 164, 8, 152); g.fillStyle = '#fff'; g.fillRect(x + 15, y - 164, 2, 152); g.restore(); } else if (p.warn) { g.fillStyle = 'rgba(255,40,60,' + (.2 + .2 * Math.sin(this.t * 40)) + ')'; g.fillRect(x + 14, y - 164, 4, 152); } break; }
        case 'flamejet': g.fillStyle = '#3a3a42'; g.fillRect(x + 6, y - 8, 20, 8); g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(x + 6, y - 8, 20, 8); if (p.warn) { g.fillStyle = 'rgba(255,140,40,' + (.4 + .4 * Math.sin(this.t * 30)) + ')'; g.fillRect(x + 8, y - 12, 16, 4); } break;
        case 'icicle': { const sx = p.shake > 0 ? rnd(-2, 2) : 0; g.fillStyle = '#d8f0ff'; g.strokeStyle = '#6a9ac8'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4 + sx, y); g.lineTo(x + 28 + sx, y); g.lineTo(x + 16 + sx, y + 34); g.closePath(); g.fill(); g.stroke(); break; }
        case 'mine': g.fillStyle = '#2a2a30'; g.beginPath(); g.ellipse(x + 16, y - 4, 13, 5, 0, 0, TAU); g.fill(); g.fillStyle = p.trig || Math.floor(this.t * 3) % 2 ? '#ff2a2a' : '#5a0a0a'; g.beginPath(); g.arc(x + 16, y - 8, 3, 0, TAU); g.fill(); break;
        case 'pipe': g.fillStyle = '#3a3a42'; g.fillRect(x, Cam.y, 26, y - Cam.y + 8); if (Math.random() < .3) FX.p({ x: x + 13 + rnd(-4, 4), y: y + 10, vy: rnd(160, 260), g: 400, life: .9, s: 3, c: '#5aff3a', add: true }); break;
        case 'tag': { const b = Math.sin(p.t * 4) * 4; g.save(); g.translate(x + 16, y - 22 + b); g.rotate(Math.sin(p.t * 2) * .3); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(0, 0, 1, 0, 0, 26); gr.addColorStop(0, 'rgba(160,230,255,.6)'); gr.addColorStop(1, 'rgba(160,230,255,0)'); g.fillStyle = gr; g.fillRect(-26, -26, 52, 52); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#c8d0dc'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.roundRect ? g.roundRect(-8, -11, 16, 22, 4) : g.rect(-8, -11, 16, 22); g.fill(); g.stroke(); g.fillStyle = '#4a5260'; g.fillRect(-4, -4, 8, 2); g.fillRect(-4, 0, 8, 2); g.strokeStyle = '#888'; g.beginPath(); g.moveTo(0, -11); g.lineTo(0, -18); g.stroke(); g.restore(); break; }
        case 'sign': g.fillStyle = '#3a2a1a'; g.fillRect(x + 14, y - 50, 5, 50); g.fillStyle = '#c8b080'; g.fillRect(x - 40, y - 74, 112, 28); g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(x - 40, y - 74, 112, 28); g.fillStyle = '#2a1a0a'; g.font = '900 9px Arial'; g.textAlign = 'center'; g.fillText(p.txt, x + 16, y - 56); break;
      }
    }
  },
  drawPickup(g, k) {
    const b = Math.sin(k.t * 5) * 2, x = k.x, y = k.y - 12 + b;
    g.save(); g.globalCompositeOperation = 'lighter'; const c = k.k === 'weapon' ? WEAPONS[k.w].col : k.k === 'med' ? '#5aff8a' : '#ffd84a'; const gr = g.createRadialGradient(x, y, 2, x, y, 34); gr.addColorStop(0, c + '99'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(x - 34, y - 34, 68, 68); g.restore();
    if (k.t > 14 && Math.floor(k.t * 8) % 2) return;
    if (k.k === 'weapon') { g.fillStyle = '#14141c'; g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 16, y); g.lineTo(x - 8, y - 12); g.lineTo(x + 8, y - 12); g.lineTo(x + 16, y); g.lineTo(x + 8, y + 12); g.lineTo(x - 8, y + 12); g.closePath(); g.fill(); g.stroke(); g.fillStyle = c; g.font = '900 13px Impact,sans-serif'; g.textAlign = 'center'; g.fillText(WEAPONS[k.w].key, x, y + 5); }
    else if (k.k === 'med') { g.fillStyle = '#f4f4f8'; g.fillRect(x - 11, y - 8, 22, 16); g.fillStyle = '#e8323c'; g.fillRect(x - 3, y - 6, 6, 12); g.fillRect(x - 8, y - 3, 16, 6); }
    else if (k.k === 'gren') { g.fillStyle = '#3a5a2a'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#888'; g.fillRect(x - 3, y - 12, 6, 5); }
    else { g.fillStyle = '#5aff8a'; g.font = '900 14px Impact'; g.textAlign = 'center'; g.fillText('1UP', x, y + 5); }
  },
  drawGren(g) { for (const n of this.GR.concat(this.EG)) { g.save(); g.translate(n.x, n.y); g.rotate(n.rot); g.fillStyle = '#3a5a2a'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#999'; g.fillRect(-2, -9, 4, 4); g.restore(); if (Math.floor(n.t * 10) % 2) { g.fillStyle = '#ff3030'; g.beginPath(); g.arc(n.x, n.y - 9, 2, 0, TAU); g.fill(); } } },
  drawBullets(g) {
    g.globalCompositeOperation = 'lighter';
    for (const b of this.B) {
      const a = Math.atan2(b.vy, b.vx);
      if (b.own === 'p') {
        if (b.type === 'flame') { const k = clamp(b.life / .42, 0, 1); g.fillStyle = k > .6 ? 'rgba(255,240,160,.6)' : k > .3 ? 'rgba(255,140,40,.5)' : 'rgba(180,60,30,.35)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); continue; }
        if (b.type === 'laser') { g.strokeStyle = '#4af0ff'; g.lineWidth = 5; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - Math.cos(a) * 46, b.y - Math.sin(a) * 46); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); continue; }
        if (b.type === 'plasma') { const gr = g.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 1.8); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, 'rgba(210,140,255,.9)'); gr.addColorStop(1, 'rgba(150,60,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r * 1.8, 0, TAU); g.fill(); continue; }
        if (b.type === 'rocket') { g.save(); g.translate(b.x, b.y); g.rotate(a); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#5a6a3a'; g.fillRect(-10, -3.5, 18, 7); g.fillStyle = '#ff4a3a'; g.fillRect(6, -3, 5, 6); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,180,60,.9)'; g.beginPath(); g.arc(-12, 0, 5 + Math.random() * 3, 0, TAU); g.fill(); g.restore(); continue; }
        const L = b.type === 'minigun' ? 18 : b.type === 'shotgun' ? 10 : 22; g.strokeStyle = b.type === 'shotgun' ? '#ffb070' : '#ffe68a'; g.lineWidth = b.type === 'shotgun' ? 3 : 3.5; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - Math.cos(a) * L, b.y - Math.sin(a) * L); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
      } else {
        const col = b.type === 'ice' || b.type === 'icicle' ? '#9adcff' : b.col || (b.type === 'snipe' ? '#ff2a2a' : '#ff6a3a');
        if (b.type === 'snipe') { g.strokeStyle = '#ff3030'; g.lineWidth = 4; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - Math.cos(a) * 40, b.y - Math.sin(a) * 40); g.stroke(); continue; }
        if (b.type === 'erocket' || b.type === 'shell') { g.globalCompositeOperation = 'source-over'; g.save(); g.translate(b.x, b.y); g.rotate(a); g.fillStyle = '#3a3a3a'; g.fillRect(-9, -4, 16, 8); g.fillStyle = '#ff3a2a'; g.fillRect(5, -3, 5, 6); g.restore(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,150,50,.8)'; g.beginPath(); g.arc(b.x - Math.cos(a) * 10, b.y - Math.sin(a) * 10, 5, 0, TAU); g.fill(); continue; }
        if (b.type === 'icicle') { g.globalCompositeOperation = 'source-over'; g.fillStyle = '#d8f0ff'; g.beginPath(); g.moveTo(b.x - 7, b.y - 20); g.lineTo(b.x + 7, b.y - 20); g.lineTo(b.x, b.y + 10); g.fill(); g.globalCompositeOperation = 'lighter'; continue; }
        const r = b.r, gr = g.createRadialGradient(b.x, b.y, 1, b.x, b.y, r * 2.4); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, col); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, r * 2.4, 0, TAU); g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
  },
  drawFore(g) { // near-camera silhouettes for depth
    const id = World.L.id, sp = 760, off = Cam.x * 1.35, col = World.L.pal.deco; g.save(); g.fillStyle = col; g.globalAlpha = .92;
    for (let k = Math.floor(off / sp) - 1; k < Math.floor((off + W) / sp) + 2; k++) { const r = seeded(k * 13 + 7), x = k * sp - off + r() * 300, y = H + 4 - (Cam.y - (ROWS * TS - H)) * .2;
      if (id === 'jungle') { for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(x + i * 22, y - 10, 30, 70 + r() * 40, -.6 + i * .2, 0, TAU); g.fill(); } }
      else if (id === 'desert') { g.beginPath(); g.moveTo(x - 60, y); g.quadraticCurveTo(x + 40, y - 70 - r() * 30, x + 160, y); g.fill(); g.fillRect(x + 60, y - 120, 14, 120); g.fillRect(x + 40, y - 90, 20, 10); }
      else if (id === 'factory') { g.fillRect(x, y - 150, 30, 150); g.fillRect(x - 40, y - 150, 120, 14); g.fillRect(x + 100, y - 60, 90, 60); }
      else if (id === 'frozen') { g.beginPath(); g.moveTo(x - 50, y); g.lineTo(x + 10, y - 110 - r() * 50); g.lineTo(x + 70, y); g.fill(); g.beginPath(); g.moveTo(x + 50, y); g.lineTo(x + 90, y - 60); g.lineTo(x + 130, y); g.fill(); }
      else { g.fillRect(x, y - 180, 46, 180); for (let i = 0; i < 3; i++) g.fillRect(x - 8 + i * 22, y - 196, 14, 18); g.fillStyle = 'rgba(255,40,60,.6)'; g.fillRect(x + 18, y - 150, 10, 16); g.fillStyle = col; }
    }
    g.restore();
  },
  drawWeather(g) {
    const w = World.L.weather, t = this.t, cx = Cam.x;
    g.save();
    if (w === 'rain') { g.strokeStyle = 'rgba(180,220,255,.35)'; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < 90; i++) { const x = ((i * 97 - cx * .9 + t * 160) % (W + 40) + W + 40) % (W + 40) - 20, y = ((i * 53 + t * 900) % (H + 40)) - 20; g.moveTo(x, y); g.lineTo(x - 5, y + 16); } g.stroke(); if (Math.sin(t * .37) > .995) { FX.flash(.3, '#dfeaff'); Snd.play('thunder', .5); } }
    else if (w === 'sand') { const k = .5 + .5 * Math.sin(t * .25); g.fillStyle = 'rgba(230,180,120,' + (.06 + k * .14) + ')'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,220,160,.5)'; for (let i = 0; i < 70; i++) { const x = ((i * 131 - t * (400 + k * 500) - cx * .3) % (W + 20) + W + 20) % (W + 20), y = (i * 37 + Math.sin(t + i) * 20) % H; g.fillRect(x, y, 6 + k * 10, 1.5); } }
    else if (w === 'snow') { g.fillStyle = 'rgba(255,255,255,.85)'; const k = .5 + .5 * Math.sin(t * .2); for (let i = 0; i < 110; i++) { const x = ((i * 89 - cx * .7 - t * (40 + k * 260)) % (W + 20) + W + 20) % (W + 20), y = ((i * 47 + t * (60 + i % 5 * 14)) % (H + 20)); g.fillRect(x + Math.sin(t * 2 + i) * 6, y, 2.5, 2.5); } if (k > .75) { g.fillStyle = 'rgba(230,240,255,' + (k - .75) * .6 + ')'; g.fillRect(0, 0, W, H); } }
    else if (w === 'sparks') { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const x = ((i * 173 - cx * .8) % (W + 20) + W + 20) % (W + 20), y = ((i * 61 + t * (120 + i * 7)) % (H + 20)); g.fillStyle = 'rgba(255,170,60,.7)'; g.fillRect(x, y, 2, 2); } if (Math.random() < .02) FX.spark(Cam.x + rnd(0, W), Cam.y + rnd(40, 200), '#ffb040', 8); }
    else { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { const x = ((i * 151 - cx * .6 + Math.sin(t + i) * 30) % (W + 20) + W + 20) % (W + 20), y = H - ((i * 71 + t * (40 + i % 7 * 10)) % (H + 20)); g.fillStyle = i % 3 ? 'rgba(255,90,40,.7)' : 'rgba(255,200,80,.7)'; g.fillRect(x, y, 2.5, 2.5); } const sx = W / 2 + Math.sin(t * .6) * 380; const gr = g.createRadialGradient(sx, 0, 10, sx, 300, 260); gr.addColorStop(0, 'rgba(255,240,200,.12)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(sx - 20, 0); g.lineTo(sx + 20, 0); g.lineTo(sx + 160, H); g.lineTo(sx - 160, H); g.fill(); }
    g.restore();
  }
};
