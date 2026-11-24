// Visual effects: particles, explosions, debris, muzzle flashes, decals, screen shake.
import { DEPTH } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { SaveSystem } from '../core/SaveSystem.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.dir = 0; this.spread = 360; this.spdMin = 100; this.spdMax = 300;
    const ang = { onEmit: () => this.dir + (Math.random() - 0.5) * this.spread };
    const spd = { onEmit: () => rand(this.spdMin, this.spdMax) };
    const K = (a, b) => (scene.textures.exists(a) ? a : b);
    this.k = { smoke: K('vfx_smoke1', 'smoke'), smoke2: K('vfx_smoke4', 'smoke'), fire: K('vfx_fire', 'fire'), dust: K('vfx_smoke7', 'smoke') };
    const sS = this.k.smoke === 'smoke' ? 1 : 0.5, fS = this.k.fire === 'fire' ? 1 : 0.42, dS = this.k.dust === 'smoke' ? 1 : 0.5;
    this.sS = sS; this.fS = fS;
    const add = (key, cfg, depth = DEPTH.fx) => {
      const em = scene.add.particles(0, 0, key, Object.assign({ emitting: false }, cfg));
      em.setDepth(depth);
      return em;
    };
    this.em = {
      spark: add('ember', { angle: ang, speed: spd, lifespan: { min: 120, max: 380 }, scale: { start: 1.1, end: 0 }, blendMode: 'ADD', gravityY: 600, tint: [0xffe08a, 0xffb040, 0xffffff] }, DEPTH.fxTop),
      fire: add(this.k.fire, { angle: ang, speed: spd, lifespan: { min: 250, max: 750 }, scale: { start: 1.6 * fS, end: 0.2 * fS }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', gravityY: -120, tint: [0xffe0a0, 0xffa040, 0xff6a20], rotate: { min: 0, max: 360 } }, DEPTH.fxTop),
      smoke: add(this.k.smoke, { angle: ang, speed: spd, lifespan: { min: 1400, max: 2800 }, scale: { start: 0.6 * sS, end: 3.2 * sS }, alpha: { start: 0.6, end: 0 }, gravityY: -25, tint: [0x2a2a2a, 0x3a3836, 0x1c1c1c], rotate: { min: 0, max: 360 } }, DEPTH.fx),
      dust: add(this.k.dust, { angle: ang, speed: spd, lifespan: { min: 500, max: 1100 }, scale: { start: 0.25 * dS, end: 1.1 * dS }, alpha: { start: 0.5, end: 0 }, gravityY: -10, tint: [0x5a5048, 0x6a6058], rotate: { min: 0, max: 360 } }, DEPTH.fx),
      blood: add('blood', { angle: ang, speed: spd, lifespan: { min: 300, max: 700 }, scale: { start: 1.2, end: 0.5 }, gravityY: 900 }, DEPTH.fx),
      ember: add('ember', { angle: ang, speed: spd, lifespan: { min: 800, max: 2200 }, scale: { start: 0.9, end: 0 }, blendMode: 'ADD', gravityY: -60, tint: [0xffa040, 0xff6020] }, DEPTH.fxTop),
      // painterly fireball: each puff cools from white-hot to orange to deep red as it rises
      fireball: add(this.k.fire, { angle: ang, speed: spd, lifespan: { min: 380, max: 820 }, scale: { start: 2.1 * fS, end: 0.5 * fS }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', gravityY: -260,
        color: [0xffd88a, 0xff9a30, 0xe2501a, 0x5a1606], colorEase: 'Quad.easeOut', rotate: { min: 0, max: 360 } }, DEPTH.fxTop),
      flamebody: add(this.k.smoke, { angle: ang, speed: spd, lifespan: { min: 500, max: 1000 }, scale: { start: 1.1 * sS, end: 2.6 * sS }, alpha: { start: 0.95, end: 0 }, gravityY: -200,
        color: [0xff8a2a, 0xc23e12, 0x4a1a0c, 0x1e1410], colorEase: 'Quad.easeIn', rotate: { min: 0, max: 360 } }, DEPTH.fx + 1),
      billow: add(this.k.smoke, { angle: ang, speed: spd, lifespan: { min: 1800, max: 3400 }, scale: { start: 0.9 * sS, end: 4.2 * sS }, alpha: { start: 0.85, end: 0 }, gravityY: -55,
        color: [0x6a3a1c, 0x2e2622, 0x1a1816, 0x121212], colorEase: 'Quad.easeOut', rotate: { min: 0, max: 360 } }, DEPTH.fx),
      skirt: add(this.k.dust, { angle: ang, speed: spd, lifespan: { min: 700, max: 1500 }, scale: { start: 0.5 * dS, end: 2.2 * dS }, alpha: { start: 0.6, end: 0 }, gravityY: -15, tint: [0x5e544a, 0x6e6258, 0x4a4038], rotate: { min: 0, max: 360 } }, DEPTH.fx),
      flash: add('glow', { lifespan: 90, scale: { start: 1.2, end: 0.3 }, alpha: { start: 0.9, end: 0 }, blendMode: 'ADD', tint: 0xffd890 }, DEPTH.fxTop),
    };
    this.debris = [];
    this.decals = [];
    this.fires = [];
  }

  burst(name, x, y, count, dirDeg = 0, spreadDeg = 360, smin = 100, smax = 300) {
    const em = this.em[name]; if (!em) return;
    this.dir = dirDeg; this.spread = spreadDeg; this.spdMin = smin; this.spdMax = smax;
    em.explode(count, x, y);
  }

  setTimeScale(s) { this.timeScale = s; for (const k in this.em) this.em[k].timeScale = s; for (const f of this.fires) if (f.em) f.em.timeScale = s; }

  shake(duration, intensity) {
    const s = SaveSystem.settings.shake; if (!s) return;
    const cam = this.scene.cameras.main;
    if (cam.shakeEffect.isRunning && cam.shakeEffect.intensity.x > intensity * s) return;
    cam.shake(duration, intensity * s);
  }

  muzzle(x, y, angle, scale = 1, color = 0xffd890) {
    const mk = 'vfx_muzzle' + (1 + Math.floor(Math.random() * 4));
    const real = this.scene.textures.exists(mk);
    const img = real
      ? this.scene.add.image(x, y, mk).setOrigin(0.1, 0.5).setRotation(angle).setBlendMode('ADD').setDepth(DEPTH.fxTop).setScale(0.55 * scale * rand(0.85, 1.2), 0.42 * scale * rand(0.8, 1.2)).setTint(0xffe2a8)
      : this.scene.add.image(x, y, 'muzzle').setOrigin(0.05, 0.5).setRotation(angle).setBlendMode('ADD').setDepth(DEPTH.fxTop).setScale(scale * rand(0.8, 1.2), scale * rand(0.7, 1.3)).setTint(color);
    this.scene.time.delayedCall(45, () => img.destroy());
    const gl = this.scene.add.image(x, y, 'glow').setBlendMode('ADD').setDepth(DEPTH.fxTop).setScale(scale * 0.9).setAlpha(0.6).setTint(0xffc070);
    this.scene.time.delayedCall(55, () => gl.destroy());
    if (this.scene.lighting) this.scene.lighting.flash(x, y, 230 * scale, 0.85, 70);
    this.burst('spark', x, y, Math.ceil(3 * scale), angle * 57.3, 30, 200, 500);
  }

  flipbook(anim, x, y, scale, tint, depth = DEPTH.fxTop, blend = 'ADD') {
    if (!this.scene.anims.exists(anim)) return null;
    const TEX = { anim_explosion: 'vfx_explosion', anim_hit: 'vfx_hit', anim_ground: 'vfx_ground', anim_dome: 'vfx_dome', anim_air: 'vfx_air' };
    const sp = this.scene.add.sprite(x, y, TEX[anim]).setDepth(depth).setScale(scale).setBlendMode(blend).setRotation(Math.random() * Math.PI * 2);
    if (tint) sp.setTint(tint);
    sp.play(anim); sp.anims.timeScale = this.timeScale || 1;
    sp.once('animationcomplete', () => sp.destroy());
    return sp;
  }

  // smooth the pixel-art flipbook layers so they blend with the painted style (WebGL only)
  // pixel-art layers sit slightly translucent so they blend with the painted look (no GPU FX: some drivers fail on preFX)
  soften(sp) { sp.setAlpha(sp.alpha * 0.85); }

  impact(x, y, angle, material = 'concrete') {
    const back = angle * 57.3 + 180;
    if (material === 'flesh') {
      if (SaveSystem.settings.blood) this.burst('blood', x, y, 7, angle * 57.3, 50, 80, 280);
      AudioEngine.play('hitflesh', { x });
      return;
    }
    if (material === 'metal') { this.burst('spark', x, y, 9, back, 90, 150, 520); this.flipbook('anim_hit', x, y, 0.32, 0xffd8a0); AudioEngine.play(Math.random() < 0.3 ? 'ricochet' : 'hitmetal', { x, gap: 40 }); }
    else { this.burst('spark', x, y, 3, back, 70, 100, 300); this.burst('dust', x, y, 3, back, 60, 30, 90); AudioEngine.play('hitconcrete', { x, gap: 30 }); if (Math.random() < 0.4) this.chunk(x, y, back, 1); }
    if (this.scene.lighting) this.scene.lighting.flash(x, y, 60, 0.4, 50);
  }

  // physics debris (casings, chunks, dropped guns)
  spawnDebris(key, x, y, vx, vy, opts = {}) {
    if (this.debris.length > 160) { const old = this.debris.shift(); old.img.destroy(); }
    const img = this.scene.add.image(x, y, key, opts.frame).setDepth(opts.depth || DEPTH.fx).setScale(opts.scale || 1);
    if (opts.tint) img.setTint(opts.tint);
    if (opts.crop) img.setCrop(opts.crop.x, opts.crop.y, opts.crop.w, opts.crop.h);
    const d = { img, vx, vy, va: opts.va !== undefined ? opts.va : rand(-12, 12), life: opts.life || 6, bounce: opts.bounce || 0.3, sound: opts.sound, rest: false, fade: opts.fade !== false, half: opts.half || 3 };
    this.debris.push(d);
    return d;
  }

  casing(x, y, facing, shell = false) {
    this.spawnDebris(shell ? 'shell' : 'casing', x, y, -facing * rand(60, 160), rand(-260, -160), { life: 4, bounce: 0.35, sound: 'shell', half: 2 });
  }

  chunk(x, y, dirDeg, n = 6, speed = 300) {
    for (let i = 0; i < n; i++) {
      const a = (dirDeg + rand(-60, 60)) / 57.3; const s = rand(speed * 0.3, speed);
      this.spawnDebris('chunk', x, y, Math.cos(a) * s, Math.sin(a) * s - 120, { life: rand(3, 6), scale: rand(0.6, 1.8), bounce: 0.25, half: 4 });
    }
  }

  surfaceBelow(x, y) {
    let best = null;
    for (const s of this.scene.solids || []) {
      if (x >= s.x && x <= s.x + s.w && s.y >= y - 4) { if (best === null || s.y < best) best = s.y; }
    }
    return best;
  }

  scorch(x, y) {
    const sy = this.surfaceBelow(x, y - 30);
    if (sy === null || sy - y > 140) return;
    const img = this.scene.add.image(x, sy + 2, 'scorch').setScale(rand(0.9, 1.4), 1).setAlpha(0.85).setDepth(DEPTH.solids + 1);
    this.decals.push(img);
    if (this.decals.length > 40) this.decals.shift().destroy();
  }

  explosion(x, y, opts = {}) {
    const scene = this.scene; const r = opts.radius || 160; const big = r > 220;
    // off-screen blasts only deal damage and make noise; busy moments get lighter effects
    const v0 = scene.cameras.main.worldView, pad = 350;
    if (x < v0.x - pad || x > v0.right + pad || y < v0.y - pad || y > v0.bottom + pad) {
      AudioEngine.play('explosion', { x, big, gap: 40 });
      if (opts.damage && scene.applyExplosion) scene.applyExplosion(x, y, r, opts.damage, opts.owner || 'world', opts.source);
      return;
    }
    const now = scene.time.now; this.boomLoad = Math.max(0, (this.boomLoad || 0) - (now - (this.boomT || now)) / 1000) + 1; this.boomT = now;
    const lod = this.boomLoad > 6 ? 0.35 : this.boomLoad > 3 ? 0.6 : 1;
    const k = r / 160, kc = k * lod;
    // core flash
    const fl = scene.add.image(x, y, 'glow').setBlendMode('ADD').setDepth(DEPTH.fxTop).setScale(0.5 * k).setTint(0xffb060).setAlpha(0.7);
    scene.tweens.add({ targets: fl, scale: 3.6 * k, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => fl.destroy() });
    const ring = scene.add.image(x, y, 'ring').setBlendMode('ADD').setDepth(DEPTH.fxTop).setScale(0.2).setAlpha(0.8).setTint(0xffd0a0);
    scene.tweens.add({ targets: ring, scale: 3.4 * k, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    // smooth fireball (replaces the pixel-art flipbooks): hot core, rolling fire, dust skirt, smoke column
    const gy = this.surfaceBelow(x, y - 30); const onGround = gy !== null && gy - y < 90;
    const core = scene.add.image(x, y - 10 * k, 'glow').setBlendMode('ADD').setDepth(DEPTH.fxTop).setScale(1.2 * k).setTint(0xffc070).setAlpha(0.8);
    scene.tweens.add({ targets: core, scale: 2.6 * k, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
    const heat = scene.add.image(x, y - 30 * k, 'glow').setBlendMode('ADD').setDepth(DEPTH.fx).setScale(2.2 * k).setTint(0xff7a2a).setAlpha(0.75);
    scene.tweens.add({ targets: heat, y: y - 110 * k, scale: 4 * k, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => heat.destroy() });
    this.burst('fireball', x, y - 10 * k, Math.floor(18 * kc), -90, onGround ? 200 : 360, 40, 260 * k);
    this.burst('flamebody', x, y - 20 * k, Math.floor(14 * kc), -90, onGround ? 170 : 360, 30, 200 * k);
    scene.time.delayedCall(70, () => this.burst('fireball', x, y - 50 * k, Math.floor(12 * kc), -90, 90, 60, 220 * k));
    if (onGround) {
      this.burst('skirt', x, gy - 8, Math.floor(9 * kc), 0, 30, 120, 420 * k);
      this.burst('skirt', x, gy - 8, Math.floor(9 * kc), 180, 30, 120, 420 * k);
    }
    scene.time.delayedCall(140, () => this.burst('billow', x, y - 30 * k, Math.floor(10 * kc), -90, 110, 30, 150 * k));
    scene.time.delayedCall(420, () => this.burst('billow', x, y - 90 * k, Math.floor(6 * kc), -90, 60, 20, 90 * k));
    this.burst('fire', x, y, Math.floor(10 * kc), -90, 360, 60, 380 * k);
    this.burst('spark', x, y, Math.floor(40 * kc), -90, 300, 200, 900 * k);
    this.burst('ember', x, y, Math.floor(20 * kc), -90, 200, 60, 300 * k);
    if (onGround) { this.chunk(x, y, -90, Math.floor(10 * kc), 520 * k); this.scorch(x, y); }
    if (scene.lighting) scene.lighting.flash(x, y, 700 * k, 1, 380);
    this.shake(big ? 700 : 420, big ? 0.022 : 0.012 * Math.min(1.5, k));
    AudioEngine.play('explosion', { x, big, gap: 40 });
    if (opts.damage && scene.applyExplosion) scene.applyExplosion(x, y, r, opts.damage, opts.owner || 'world', opts.source);
    if (scene.hud && scene.hud.flashScreen) {
      const cam = scene.cameras.main; const v = cam.worldView;
      if (x > v.x - 100 && x < v.right + 100) scene.hud.flashScreen(0xffc080, big ? 0.35 : 0.15, 260);
    }
  }

  fireSource(x, y, scale = 1, duration = 0) {
    const em = this.scene.add.particles(x, y, this.k.fire, {
      speedY: { min: -140 * scale, max: -60 * scale }, speedX: { min: -25, max: 25 }, lifespan: { min: 300, max: 800 },
      scale: { start: 1.3 * scale * this.fS, end: 0.1 * this.fS }, alpha: { start: 0.9, end: 0 }, blendMode: 'ADD', frequency: 40 / scale, x: { min: -16 * scale, max: 16 * scale },
      tint: [0xffd890, 0xff9a40, 0xff6a20], rotate: { min: 0, max: 360 },
    }).setDepth(DEPTH.fx);
    const sm = this.scene.add.particles(x, y - 30, this.k.smoke, {
      speedY: { min: -90, max: -50 }, speedX: { min: -10, max: 30 }, lifespan: { min: 2000, max: 3500 }, scale: { start: 0.6 * scale * this.sS, end: 3 * scale * this.sS },
      alpha: { start: 0.45, end: 0 }, frequency: 140 / scale, tint: [0x222222, 0x333333], rotate: { min: 0, max: 360 },
    }).setDepth(DEPTH.fx - 1);
    const light = this.scene.lighting ? this.scene.lighting.add({ x, y: y - 20, r: 260 * scale, i: 0.8, flicker: 0.25, color: 0xff8030 }) : null;
    const f = { em, sm, light, x, y };
    this.fires.push(f);
    if (duration) this.scene.time.delayedCall(duration, () => this.stopFire(f));
    return f;
  }

  stopFire(f) {
    if (!f || f.dead) return; f.dead = true;
    f.em.stop(); f.sm.stop();
    if (f.light && this.scene.lighting) this.scene.lighting.remove(f.light);
    this.scene.time.delayedCall(4000, () => { f.em.destroy(); f.sm.destroy(); });
  }

  update(dt) {
    // fires far off-screen stop simulating particles (big levels have dozens of them)
    this.cullT = (this.cullT || 0) - dt;
    if (this.cullT <= 0 && this.fires.length) {
      this.cullT = 0.25;
      const v = this.scene.cameras.main.worldView, pad = 900;
      for (const f of this.fires) {
        if (f.dead || !f.em.scene) continue;
        const near = f.x > v.x - pad && f.x < v.right + pad;
        if (near !== !f.culled) continue;
        f.culled = !near;
        for (const e of [f.em, f.sm]) { e.active = near; e.setVisible(near); if (near) e.start(); else e.stop(); }
      }
    }
    const solids = this.scene.solids || [];
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) { d.img.destroy(); this.debris.splice(i, 1); continue; }
      if (d.fade && d.life < 1) d.img.setAlpha(d.life);
      if (d.rest) continue;
      d.vy += 1500 * dt;
      const nx = d.img.x + d.vx * dt, ny = d.img.y + d.vy * dt;
      let hit = false;
      for (const s of solids) {
        if (nx > s.x && nx < s.x + s.w && ny + d.half > s.y && d.img.y + d.half <= s.y + 6) {
          d.img.y = s.y - d.half; d.vy = -d.vy * d.bounce; d.vx *= 0.6; d.va *= 0.5; hit = true;
          if (d.sound && Math.abs(d.vy) > 60) AudioEngine.play(d.sound, { x: nx, gap: 25 });
          if (Math.abs(d.vy) < 40) { d.rest = true; d.vy = 0; }
          break;
        }
      }
      if (!hit) { d.img.x = nx; d.img.y = ny; } else d.img.x = nx;
      d.img.rotation += d.va * dt;
      if (d.img.y > 3000) d.life = 0;
    }
  }
}
