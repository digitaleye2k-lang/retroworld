// Combat: swept-segment bullets with penetration, rockets, grenades, and hit resolution.
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';

// Liang-Barsky segment vs AABB. returns entry t in [0,1] or -1
export function segRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return -1; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return -1; if (t > t0) t0 = t; }
      else { if (t < t0) return -1; if (t < t1) t1 = t; }
    }
  }
  return t0;
}

export function lineOfSight(solids, x1, y1, x2, y2) {
  for (const s of solids) { if (s.oneWay || s.seeThrough) continue; if (segRect(x1, y1, x2, y2, s) >= 0) return false; }
  return true;
}

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.bullets = [];
    this.projectiles = [];
    this.g = scene.add.graphics().setDepth(DEPTH.bullets).setBlendMode('ADD');
  }

  fire(o) {
    const b = {
      x: o.x, y: o.y, vx: Math.cos(o.angle) * o.speed, vy: Math.sin(o.angle) * o.speed, angle: o.angle,
      dmg: o.damage, team: o.team, life: (o.range || 1500) / o.speed, color: o.color || 0xffd080, width: o.width || 2,
      pen: o.penetration || 1, hit: new Set(), tx: o.x, ty: o.y, headMult: o.headMult || 2, knock: o.knock || 120,
      weapon: o.weapon, traveled: 0, whizzed: false, trailLen: o.trailLen || 110, owner: o.owner,
    };
    this.bullets.push(b);
    return b;
  }

  rocket(o) {
    const img = this.scene.add.image(o.x, o.y, 'rocket').setDepth(DEPTH.bullets).setRotation(o.angle).setScale(o.scale || 1);
    const glow = this.scene.add.image(o.x, o.y, 'glow').setBlendMode('ADD').setTint(0xffa040).setScale(0.5).setDepth(DEPTH.bullets);
    const p = { kind: 'rocket', img, glow, x: o.x, y: o.y, vx: Math.cos(o.angle) * o.speed, vy: Math.sin(o.angle) * o.speed, speed: o.speed, team: o.team,
      dmg: o.damage || 220, radius: o.radius || 150, life: o.life || 4, homing: o.homing || null, turn: o.turn || 2.2, trail: 0, owner: o.owner, accel: o.accel || 0, maxSpeed: o.maxSpeed || o.speed, shootable: o.shootable || false, hp: 1, gravity: o.gravity || 0 };
    this.projectiles.push(p);
    AudioEngine.play('launcher', { x: o.x, vol: o.team === 'player' ? 1 : 0.7 });
    if (p.shootable) this.scene.registerTarget && this.scene.registerTarget(this._rocketTarget(p));
    return p;
  }

  _rocketTarget(p) {
    const t = {
      team: 'enemy', alive: true, isRocket: true,
      hitTest: (x1, y1, x2, y2) => { const tt = segRect(x1, y1, x2, y2, { x: p.x - 14, y: p.y - 14, w: 28, h: 28 }); return tt >= 0 ? { t: tt, part: 'body', material: 'metal' } : null; },
      takeDamage: () => { if (!p.dead) { this._explodeProjectile(p, true); t.alive = false; } return true; },
    };
    p.target = t;
    return t;
  }

  grenade(o) {
    const img = this.scene.add.image(o.x, o.y, 'grenade').setDepth(DEPTH.bullets);
    const p = { kind: 'grenade', img, x: o.x, y: o.y, vx: o.vx, vy: o.vy, team: o.team, fuse: o.fuse || 2.2, dmg: o.damage || 200, radius: o.radius || 170, va: 8, owner: o.owner };
    this.projectiles.push(p);
    AudioEngine.play('grenadepin', { x: o.x });
    return p;
  }

  shell(o) { // enemy cannon/tank shell: fast explosive slug
    const img = this.scene.add.image(o.x, o.y, 'spark').setDepth(DEPTH.bullets).setBlendMode('ADD').setScale(2.5, 2).setTint(0xffc070).setRotation(o.angle);
    const p = { kind: 'shell', img, x: o.x, y: o.y, vx: Math.cos(o.angle) * o.speed, vy: Math.sin(o.angle) * o.speed, team: o.team, dmg: o.damage || 60, radius: o.radius || 120, life: 3, gravity: o.gravity || 0, owner: o.owner };
    this.projectiles.push(p);
    return p;
  }

  update(dt) {
    const scene = this.scene; const solids = scene.solids; const targets = scene.targets;
    const g = this.g; g.clear();
    const player = scene.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const sx = b.x, sy = b.y;
      const ex = sx + b.vx * dt, ey = sy + b.vy * dt;
      let tWall = 2, wall = null;
      for (const s of solids) {
        if (s.oneWay || s.bulletPass) continue;
        const t = segRect(sx, sy, ex, ey, s);
        if (t >= 0 && t < tWall) { tWall = t; wall = s; }
      }
      // targets
      const hits = [];
      for (const tg of targets) {
        if (!tg.alive || tg.team === b.team || b.hit.has(tg)) continue;
        const h = tg.hitTest(sx, sy, ex, ey);
        if (h && h.t < tWall) hits.push([h, tg]);
      }
      hits.sort((a, c) => a[0].t - c[0].t);
      let stopped = false, stopT = 1;
      for (const [h, tg] of hits) {
        b.hit.add(tg);
        const hx = sx + (ex - sx) * h.t, hy = sy + (ey - sy) * h.t;
        const head = h.part === 'head';
        const dmg = b.dmg * (head ? b.headMult : 1);
        const killed = tg.takeDamage(dmg, { x: hx, y: hy, angle: b.angle, part: h.part, team: b.team, weapon: b.weapon, knock: b.knock, owner: b.owner });
        scene.fx.impact(hx, hy, b.angle, h.material || 'flesh');
        if (b.team === 'player' && scene.onPlayerHit) scene.onPlayerHit(tg, killed, head, b);
        b.pen--;
        b.dmg *= 0.6;
        if (b.pen <= 0) { stopped = true; stopT = h.t; break; }
      }
      // near miss whiz near player
      if (b.team !== 'player' && !b.whizzed && player && player.alive) {
        const px = player.x, py = player.y - 45;
        const d = Math.abs((ex - sx) * (sy - py) - (sx - px) * (ey - sy)) / (Math.hypot(ex - sx, ey - sy) || 1);
        if (d < 50 && (px - sx) * (px - ex) <= 0) { b.whizzed = true; AudioEngine.play('whiz', { x: px, gap: 60 }); }
      }
      if (!stopped && wall && tWall <= 1) {
        stopped = true; stopT = tWall;
        const hx = sx + (ex - sx) * tWall, hy = sy + (ey - sy) * tWall;
        scene.fx.impact(hx, hy, b.angle, wall.material || 'concrete');
        if (wall.onHit) wall.onHit(b, hx, hy);
      }
      const cx = stopped ? sx + (ex - sx) * stopT : ex, cy = stopped ? sy + (ey - sy) * stopT : ey;
      b.traveled += Math.hypot(cx - sx, cy - sy);
      b.x = cx; b.y = cy; b.life -= dt;
      // draw tracer
      const tl = Math.min(b.traveled, b.trailLen);
      const ux = Math.cos(b.angle), uy = Math.sin(b.angle);
      g.lineStyle(b.width + 2, b.color, 0.18); g.lineBetween(cx - ux * tl, cy - uy * tl, cx, cy);
      g.lineStyle(b.width, b.color, 0.85); g.lineBetween(cx - ux * tl * 0.6, cy - uy * tl * 0.6, cx, cy);
      g.lineStyle(1, 0xffffff, 0.9); g.lineBetween(cx - ux * 14, cy - uy * 14, cx, cy);
      if (stopped || b.life <= 0) this.bullets.splice(i, 1);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.dead) { this.projectiles.splice(i, 1); continue; }
      if (p.kind === 'grenade') this._updateGrenade(p, dt, solids);
      else this._updateRocket(p, dt, solids, targets);
      if (p.dead) this.projectiles.splice(i, 1);
    }
  }

  _updateRocket(p, dt, solids, targets) {
    p.life -= dt;
    if (p.accel) { const sp = Math.min(p.maxSpeed, Math.hypot(p.vx, p.vy) + p.accel * dt); const a = Math.atan2(p.vy, p.vx); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; }
    if (p.gravity) p.vy += p.gravity * dt;
    if (p.homing && p.homing.alive !== false && !(p.homing.flaresActive)) {
      const hx = p.homing.x, hy = p.homing.y;
      const want = Math.atan2(hy - p.y, hx - p.x); let cur = Math.atan2(p.vy, p.vx);
      let d = want - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      cur += Math.max(-p.turn * dt, Math.min(p.turn * dt, d));
      const sp = Math.hypot(p.vx, p.vy); p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
    } else if (p.homing && p.homing.flaresActive && !p.decoyed) {
      p.decoyed = true; p.vy -= 200; p.homing = null;
    }
    const sx = p.x, sy = p.y, ex = sx + p.vx * dt, ey = sy + p.vy * dt;
    let hit = false;
    for (const s of solids) { if (s.oneWay || s.bulletPass) continue; if (segRect(sx, sy, ex, ey, s) >= 0) { hit = true; break; } }
    if (!hit) for (const tg of targets) {
      if (!tg.alive || tg.team === p.team || tg.isRocket || (p.target && tg === p.target)) continue;
      if (tg.hitTest(sx, sy, ex, ey)) { hit = true; break; }
    }
    p.x = ex; p.y = ey;
    const ang = Math.atan2(p.vy, p.vx);
    p.img.setPosition(p.x, p.y).setRotation(ang);
    if (p.glow) p.glow.setPosition(p.x - Math.cos(ang) * 14, p.y - Math.sin(ang) * 14);
    if (p.kind === 'rocket') {
      p.trail += dt;
      if (p.trail > 0.025) { p.trail = 0; this.scene.fx.burst('smoke', p.x - Math.cos(ang) * 14, p.y - Math.sin(ang) * 14, 1, ang * 57.3 + 180, 30, 10, 40); this.scene.fx.burst('fire', p.x - Math.cos(ang) * 14, p.y - Math.sin(ang) * 14, 1, ang * 57.3 + 180, 20, 20, 80); }
      if (this.scene.lighting) this.scene.lighting.flash(p.x, p.y, 120, 0.7, 40);
    }
    if (hit || p.life <= 0 || p.y > 4000) this._explodeProjectile(p, hit || p.kind !== 'rocket');
  }

  _explodeProjectile(p, boom) {
    if (p.dead) return;
    p.dead = true; p.img.destroy(); if (p.glow) p.glow.destroy();
    if (p.target) p.target.alive = false;
    if (boom) this.scene.fx.explosion(p.x, p.y, { radius: p.radius, damage: p.dmg, owner: p.team, source: p.owner });
  }

  _updateGrenade(p, dt, solids) {
    p.fuse -= dt;
    p.vy += 1500 * dt;
    let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    for (const s of solids) {
      if (s.oneWay && (p.vy < 0 || p.y > s.y + 2)) continue;
      if (nx > s.x - 4 && nx < s.x + s.w + 4 && ny > s.y - 5 && ny < s.y + s.h + 5) {
        const fromTop = p.y <= s.y - 4, fromBottom = p.y >= s.y + s.h + 4;
        if (fromTop) { ny = s.y - 5; p.vy = -p.vy * 0.4; p.vx *= 0.7; if (Math.abs(p.vy) > 80) AudioEngine.play('bounce', { x: nx }); if (Math.abs(p.vy) < 60) p.vy = 0; }
        else if (fromBottom) { ny = s.y + s.h + 5; p.vy = Math.abs(p.vy) * 0.3; }
        else { p.vx = -p.vx * 0.5; nx = p.x; AudioEngine.play('bounce', { x: nx }); }
      }
    }
    p.x = nx; p.y = ny; p.va *= 0.995;
    p.img.setPosition(p.x, p.y); p.img.rotation += p.va * dt * (Math.abs(p.vx) > 10 ? 1 : 0);
    if (Math.floor(p.fuse * 6) % 2 === 0 && this.scene.lighting) this.scene.lighting.flash(p.x, p.y, 30, 0.8, 30);
    if (p.fuse <= 0) this._explodeProjectile(p, true);
  }

  clear() {
    this.bullets = [];
    for (const p of this.projectiles) { p.img.destroy(); if (p.glow) p.glow.destroy(); }
    this.projectiles = []; this.g.clear();
  }
}
