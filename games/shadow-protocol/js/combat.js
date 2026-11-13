'use strict';
/* ===== SHADOW PROTOCOL :: combat — particles, real projectile bullets, style/kill-chain system ===== */
const FX = {
  parts: [], flashes: [], texts: [],
  add(p) { if (this.parts.length < 900) this.parts.push(p); },
  sparks(x, y, ang, n, col = '#ffd98a', spread = 1.2) { for (let i = 0; i < n; i++) { const a = ang + (Math.random() - .5) * spread, s = rand(120, 520); this.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rand(.12, .35), col, drag: 5 }); } },
  dust(x, y, n, col = 'rgba(190,190,200,') { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rand(10, 60); this.add({ type: 'dust', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rand(.35, .8), size: rand(3, 8), col, drag: 3 }); } },
  debris(x, y, n, col, dx = 0, dy = 0) { const l = Math.hypot(dx, dy) || 1; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rand(60, 320); this.add({ type: 'debris', x: x + rand(-8, 8), y: y + rand(-8, 8), vx: Math.cos(a) * s + dx / l * 160, vy: Math.sin(a) * s + dy / l * 160, t: 0, max: rand(.4, .9), size: rand(2, 6), col, drag: 4, rot: Math.random() * 6, vr: rand(-14, 14), bake: true }); } },
  shards(x, y, n, dx = 0, dy = 0) { const l = Math.hypot(dx, dy) || 1, k = l > 1 ? 1 : 0; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rand(40, 300); this.add({ type: 'shard', x: x + rand(-16, 16), y: y + rand(-16, 16), vx: Math.cos(a) * s + dx / l * 260 * k, vy: Math.sin(a) * s + dy / l * 260 * k, t: 0, max: rand(.5, 1.1), size: rand(2, 6), col: '#bfeaff', drag: 3.2, rot: Math.random() * 6, vr: rand(-18, 18), bake: true }); } },
  blood(x, y, ang, n, col = '#b0101c') { for (let i = 0; i < n; i++) { const a = ang + (Math.random() - .5) * 1.1, s = rand(60, 380); this.add({ type: 'blood', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rand(.2, .5), size: rand(1.5, 3.5), col, drag: 5, bake: true }); } },
  shell(x, y, ang) { const a = ang + Math.PI / 2 + rand(-.4, .4), s = rand(90, 160); this.add({ type: 'shell', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: .7, size: 3, col: '#d9b25a', drag: 3.5, rot: Math.random() * 6, vr: rand(-25, 25), bake: true }); },
  ring(x, y, col) { this.add({ type: 'ring', x, y, vx: 0, vy: 0, t: 0, max: .5, size: 3, col, drag: 0 }); },
  muzzle(x, y, ang, power = .12) { this.flashes.push({ x, y, ang, t: 0, max: .055, size: 12 + power * 34 }); this.sparks(x, y, ang, 3, '#ffe9b0', .5); },
  explosion(x, y, R) {
    for (let i = 0; i < 34; i++) { const a = Math.random() * TAU, s = rand(40, R * 3.2); this.add({ type: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rand(.25, .7), size: rand(8, 26), drag: 4 }); }
    for (let i = 0; i < 16; i++) { const a = Math.random() * TAU, s = rand(20, 120); this.add({ type: 'dust', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rand(.9, 2), size: rand(14, 34), col: 'rgba(40,40,44,', drag: 1.5 }); }
    this.sparks(x, y, 0, 40, '#ffb04a', TAU); this.debris(x, y, 18, '#2b2b2f'); this.add({ type: 'ring', x, y, vx: 0, vy: 0, t: 0, max: .45, size: R * .9, col: 'boom', drag: 0 });
  },
  text(x, y, s, col = '#fff', big) { this.texts.push({ x, y, s, col, t: 0, big }); if (this.texts.length > 30) this.texts.shift(); },
  update(dt, rdt) {
    const ps = this.parts; let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; p.t += dt;
      if (p.t >= p.max) { if (p.bake) this.bake(p); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; if (p.vr) { p.rot += p.vr * dt; p.vr *= f; }
      if (p.bake && solidCode(tileOf(p.x), tileOf(p.y), true) % 2 === 1) { p.vx *= -.3; p.vy *= -.3; p.x += p.vx * dt * 2; p.y += p.vy * dt * 2; }
      ps[w++] = p;
    }
    ps.length = w;
    this.flashes = this.flashes.filter(f => (f.t += rdt) < f.max);
    this.texts = this.texts.filter(t => (t.t += rdt) < .8);
  },
  bake(p) { // persistent debris on the floor
    const d = World.dx; if (!d) return;
    if (p.type === 'blood') { d.fillStyle = p.col; d.globalAlpha = .75; d.beginPath(); d.arc(p.x, p.y, p.size * rand(.8, 1.8), 0, TAU); d.fill(); d.globalAlpha = 1; return; }
    d.save(); d.translate(p.x, p.y); d.rotate(p.rot || 0); d.fillStyle = p.col; d.globalAlpha = p.type === 'shard' ? .55 : .85;
    if (p.type === 'shard') { d.beginPath(); d.moveTo(-p.size, 0); d.lineTo(p.size * .6, -p.size * .5); d.lineTo(p.size * .3, p.size * .6); d.fill(); }
    else if (p.type === 'shell') d.fillRect(-2, -.8, 4, 1.6); else d.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    d.restore(); d.globalAlpha = 1;
  }
};

/* ---------------- bullets: real travelling projectiles with sub-stepped collision ---------------- */
const Bullets = [];
function spawnBullet(o) {
  Bullets.push({ x: o.x, y: o.y, sx: o.x, sy: o.y, ang: o.ang, cx: Math.cos(o.ang), cy: Math.sin(o.ang), speed: o.speed, dmg: o.dmg, owner: o.owner, pen: o.pen || 0, wid: o.wid, deadeye: o.deadeye, src: o.src, flame: o.flame, fire: o.fire, range: o.range, hitSet: o.flame ? new Set() : null, dist: 0, dead: false, near: false, dodged: false, passed: false, over: undefined, lastProp: null, lastE: null, lastDoor: null, wall: false, inWall: false, wake: 0, counted: false });
}
function bulletImpact(b, col) {
  FX.sparks(b.x, b.y, b.ang + Math.PI, 5, col || '#ffd98a', 1.6); FX.dust(b.x, b.y, 1); if (Math.random() < .22) Snd.play('rico');
  const d = World.dx, hx = b.x - b.cx * 2, hy = b.y - b.cy * 2; d.fillStyle = 'rgba(0,0,0,.9)'; d.beginPath(); d.arc(hx, hy, 1.9, 0, TAU); d.fill(); d.strokeStyle = 'rgba(150,150,160,.35)'; d.lineWidth = 1; d.beginPath(); d.arc(hx, hy, 3, 0, TAU); d.stroke();
}
function updateBullets(dt) {
  const hasReflex = hasAb('reflex');
  for (const b of Bullets) {
    if (b.flame) { b.speed *= Math.exp(-2.4 * dt); if (b.dist > b.range || b.speed < 60) { b.dead = true; continue; } }
    const len = b.speed * dt, n = Math.max(1, Math.ceil(len / 5)), st = len / n;
    for (let s = 0; s < n && !b.dead; s++) {
      b.x += b.cx * st; b.y += b.cy * st; b.dist += st;
      const tx = tileOf(b.x), ty = tileOf(b.y);
      if (!inMap(tx, ty) || b.dist > 2800) { b.dead = true; break; }
      const i = tIdx(tx, ty), t = World.T[i];
      if (b.flame && t && t !== 5) { b.dead = true; if (Math.random() < .15) { const d = World.dx; d.fillStyle = 'rgba(0,0,0,.25)'; d.beginPath(); d.arc(b.x - b.cx * 6, b.y - b.cy * 6, rand(4, 9), 0, TAU); d.fill(); } break; }
      if (t === 1) { bulletImpact(b); b.dead = true; break; }
      if (t === 3) { if (!b.inWall) { if (b.pen >= 2) { b.pen -= 2; b.dmg *= .6; b.wall = true; b.inWall = true; bulletImpact(b, '#cfcfd6'); } else { bulletImpact(b, '#cfcfd6'); b.dead = true; break; } } }
      else { if (b.inWall) { b.inWall = false; FX.dust(b.x, b.y, 3); } if (t === 2) { shatterGlass(tx, ty, b.cx, b.cy, b.owner); b.dmg *= .92; } }
      const dr = World.doorAt[i];
      if (dr && !dr.open && !dr.dead && dr !== b.lastDoor) {
        const r = doorRect(dr);
        if (b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h) {
          b.lastDoor = dr; dr.hp -= b.dmg; FX.debris(b.x, b.y, 3, '#6b4f33', b.cx, b.cy); Snd.play('wood');
          if (dr.hp <= 0) destroyDoor(dr, b.cx, b.cy);
          if (b.pen >= 1) { b.pen -= 1; b.dmg *= .7; b.wall = true; } else { b.dead = true; break; }
        }
      }
      const ps = World.propGrid[i];
      if (ps) for (let k = 0; k < ps.length; k++) {
        const p = ps[k]; if (p.dead || p === b.lastProp || b.x < p.x || b.x > p.x + p.w || b.y < p.y || b.y > p.y + p.h) continue;
        if (p.low && b.dist < 58 && p.mat === 'wood') continue; // shooter leaning over adjacent cover
        b.lastProp = p;
        if (p.mat === 'metal' || p.mat === 'car') {
          if (!b.flame) { FX.sparks(b.x, b.y, b.ang + Math.PI, 9, '#ffe9a8', 1.8); Snd.play('metal'); } damageProp(p, b.dmg, b.owner, b.cx, b.cy);
          if (!p.dead && b.pen >= p.pen) { b.pen -= p.pen; b.dmg *= .6; b.wall = true; } else b.dead = true;
        } else {
          if (!b.flame) { FX.debris(b.x, b.y, 3, p.col, b.cx, b.cy); if (p.mat === 'wood') Snd.play('wood'); } damageProp(p, b.dmg * (b.flame ? 1.6 : 1), b.owner, b.cx, b.cy);
          if (p.mat === 'wood' && b.pen >= p.pen) { b.pen -= p.pen; b.dmg *= .7; b.wall = true; } else b.dead = true;
        }
        break;
      }
      if (b.dead) break;
      if (!b.flame) for (const l of World.lights) if (l.on && Math.abs(l.x - b.x) < 8 && Math.abs(l.y - b.y) < 8) breakLight(l);
      if (!b.flame) for (const c of World.chairs) if (Math.abs(c.x - b.x) < 9 && Math.abs(c.y - b.y) < 9) { c.vx += b.cx * 160; c.vy += b.cy * 160; c.va = rand(-14, 14); c.down = true; }
      if (b.owner === 'p') {
        for (const e of Enemies) {
          if (!e.alive || e === b.lastE) continue; const dx = b.x - e.x, dy = b.y - e.y;
          if (b.flame) { if (dx * dx + dy * dy < (e.r + 7) * (e.r + 7) && !b.hitSet.has(e)) { b.hitSet.add(e); if (!b.counted) { b.counted = true; G.stats.hits++; } e.ignite(3.5); e.hurt(b.dmg, { burn: true, quiet: true, dir: b.ang }); } continue; }
          if (dx * dx + dy * dy < e.r * e.r) {
            if (e.tryEvade(b)) { b.lastE = e; continue; }
            const J = e.rig.J, hx = (J ? J.head.x : e.x) - b.x, hy = (J ? J.head.y : e.y) - b.y;
            const head = b.deadeye || Math.abs(hx * b.cy - hy * b.cx) < 4.3 * e.scale; // bullet line passes through the head
            if (!b.counted) { b.counted = true; G.stats.hits++; }
            let dmg = b.dmg; if (b.wid === 'shotgun') dmg *= clamp(1.35 - b.dist / 360, .3, 1); if (b.wid === 'silenced' && !e.alert) dmg *= 4;
            if (b.fire) e.ignite(3);
            e.hurt(dmg * (head ? 2.5 : 1), { head, dir: b.ang, wallbang: b.wall, deadeye: b.deadeye, kx: b.cx * 150, ky: b.cy * 150 });
            if (b.pen >= 5) { b.pen -= 3; b.dmg *= .8; b.lastE = e; } else b.dead = true;
            break;
          }
        }
      } else if (P.alive) {
        const d = dist(b.x, b.y, P.x, P.y);
        if (d < P.r - 1 && !b.passed) {
          if (P.iframes > 0 || P.state === 'takedown') { b.passed = true; b.near = true; }
          else {
            if (b.over === undefined) { const ps2 = P.state, ch = ps2 === 'slide' ? (hasAb('phantom') ? .93 : .65) : ps2 === 'dive' ? .6 : ps2 === 'jump' ? .45 : 0; b.over = Math.random() < ch; } // bullets pass over a low / airborne body
            if (b.over) { b.passed = true; b.near = true; } else { hurtPlayer(b.dmg, b.sx, b.sy); b.dead = true; break; }
          }
        }
        if (d < 27) b.near = true;
        else if (b.near && !b.dodged && d > 34) { b.dodged = true; perfectDodge(b); }
      }
    }
    if (b.dead) continue;
    if (b.owner === 'p') { if (b.flame && Math.random() < .25) FX.add({ type: 'fire', x: b.x, y: b.y, vx: b.cx * b.speed * .5 + rand(-30, 30), vy: b.cy * b.speed * .5 + rand(-30, 30), t: 0, max: rand(.15, .35), size: rand(5, 11) + b.dist * .04, drag: 3 });
      if (b.wid !== 'silenced') for (const e of Enemies) if (e.alive && Math.abs(e.x - b.x) < 48 && Math.abs(e.y - b.y) < 48) e.suppressed(); }
    else if (hasReflex && P.alive && P.reflexCd <= 0 && !G.bt && P.iframes <= 0 && !b.passed) { // REFLEX: a bullet is about to connect
      const rx = P.x - b.x, ry = P.y - b.y, along = rx * b.cx + ry * b.cy;
      if (along > 0 && along < 120 && Math.abs(rx * b.cy - ry * b.cx) < 12) { P.reflexT = .9; P.reflexCd = 9; Style.note('REFLEX', null, 1); Snd.play('dodge'); G.shock = { x: P.x, y: P.y, t: 0 }; }
    }
    if (G.ws < .6 && !b.flame) { b.wake += len; if (b.wake > 20) { b.wake = 0; FX.ring(b.x, b.y, b.owner); } }
  }
  for (let i = Bullets.length - 1; i >= 0; i--) if (Bullets[i].dead) Bullets.splice(i, 1);
}
function perfectDodge(b) {
  if (P.dodgeCd > 0 || !P.alive) return;
  const active = b.passed || P.state !== 'run' || Math.hypot(P.vx, P.vy) > 110; if (!active) return;
  P.dodgeCd = .45; G.pdT = .45; G.stats.dodges++; P.energy = Math.min(P.maxE, P.energy + 6);
  Style.bonus(100, 'PERFECT DODGE', 1); Snd.play('dodge'); FX.ring(P.x, P.y, 'dodge');
}

/* ---------------- style / kill-chain ---------------- */
const Style = {
  score: 0, combo: 0, comboT: 0, best: 0, streak: 0, notes: [], killT: [], engaged: 0,
  reset() { this.score = 0; this.combo = 0; this.comboT = 0; this.best = 0; this.streak = 0; this.notes = []; this.killT = []; this.engaged = 0; },
  mult() { return Math.min(8, 1 + Math.floor(this.combo / 3) * .5); },
  bump(n) { const b = this.combo; this.combo += n; this.comboT = 5; if (this.combo > this.best) this.best = this.combo; if (Math.floor(this.combo / 5) > Math.floor(b / 5)) this.note('STYLE COMBO x' + (Math.floor(this.combo / 5) * 5), null, 1); },
  bonus(pts, label, tier = 0) { if (G.state !== 'play') return; this.bump(1); const v = Math.round(pts * this.mult()); this.score += v; this.note(label, v, tier); },
  note(text, pts, tier = 0) { this.notes.push({ text, pts, tier, t: 0 }); if (this.notes.length > 8) this.notes.shift(); Snd.play(tier ? 'big' : 'note'); },
  onDamage() { this.streak = 0; this.combo = Math.floor(this.combo / 2); },
  update(rdt) {
    if (this.combo > 0) { this.comboT -= rdt * (G.ws < .6 ? .4 : 1); if (this.comboT <= 0) { this.combo = 0; this.engaged = 0; } }
    for (const n of this.notes) n.t += rdt; this.notes = this.notes.filter(n => n.t < 2.6);
  },
  kill(e, info) {
    G.stats.kills++; const now = G.rt; this.killT = this.killT.filter(t => now - t < 1.7); this.killT.push(now); this.streak++; this.engaged++;
    const tags = [], st = P.state;
    if (info.takedown) tags.push([info.stealth ? 'STEALTH TAKEDOWN' : 'TAKEDOWN', info.stealth ? 150 : 100, 1]);
    else if (info.env) { tags.push(['ENVIRONMENTAL KILL', 120, 1]); G.stats.env++; }
    else {
      if (info.head) { tags.push(['HEADSHOT', 50, 0]); G.stats.heads++; }
      if (info.wallbang) tags.push(['WALLBANG', 80, 0]); if (info.deadeye) tags.push(['DEAD EYE', 40, 0]);
      if (!e.wasAlert) tags.push(['STEALTH KILL', 80, 0]);
    }
    if (info.burn) { tags.push(['ROASTED', 60, 0]); G.stats.burned = (G.stats.burned || 0) + 1; }
    if (!info.env && !info.takedown) { if (st === 'slide') tags.push(['SLIDE KILL', 75, 1]); else if (st === 'dive' || st === 'jump') tags.push(['AIRBORNE KILL', 100, 1]); else if (st === 'roll' || P.rollBonus > 0) tags.push(['DODGE KILL', 60, 0]); }
    if (G.bt || P.reflexT > 0 || P.focusSlow) tags.push(['BULLET-TIME KILL', 50, 0]);
    const k = this.killT.length; if (k === 2) tags.push(['DOUBLE KILL', 100, 2]); else if (k === 3) tags.push(['TRIPLE KILL', 200, 2]); else if (k >= 4) tags.push(['MULTI KILL', 300, 2]);
    if (this.streak % 5 === 0) tags.push(['UNTOUCHABLE', 250, 2]);
    if (this.engaged >= 3 && !Enemies.some(o => o.alive && o !== e && o.alert)) { tags.push(['CLEAN SWEEP', 300, 2]); this.engaged = 0; }
    this.bump(1 + tags.length); const m = this.mult(); let total = e.def.pts; for (const t of tags) total += t[1];
    this.score += Math.round(total * m);
    if (!tags.length) this.note(e.def.name.toUpperCase() + ' DOWN', Math.round(e.def.pts * m), 0);
    else tags.forEach((t, i) => this.note(t[0], Math.round((t[1] + (i ? 0 : e.def.pts)) * m), t[2]));
    P.energy = Math.min(P.maxE, P.energy + 5);
  }
};
