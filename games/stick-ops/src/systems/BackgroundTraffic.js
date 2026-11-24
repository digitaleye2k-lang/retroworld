// Distant battlefield traffic: pixel-art convoys (Pixel Military Vehicles 2.0) driving along the
// horizon with parallax, tinted to the scene palette. Tanks fire and rocket trucks launch salvos,
// giving the "distant combat" layer behind the playable area.
import { DEPTH, GAME_W } from '../config.js';
import { AudioEngine } from '../core/AudioEngine.js';

const rand = (a, b) => a + Math.random() * (b - a);
// sheet columns: 0 tank, 1 rocket launcher, 2 APC, 3 supply truck, 4 scout car
const TYPES = [
  { col: 0, speed: 16, weight: 3, fires: 'cannon' },
  { col: 1, speed: 20, weight: 2, fires: 'rockets' },
  { col: 2, speed: 24, weight: 3, fires: 'mg' },
  { col: 3, speed: 30, weight: 2 },
  { col: 4, speed: 44, weight: 2 },
];

export class BackgroundTraffic {
  // opts: y (screen y of the road), sf/sfy scroll factors, tint, row (colour variant), scale, depth, rate (seconds between spawns)
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.ok = scene.textures.exists('pv_vehicles');
    this.o = Object.assign({ y: 600, sf: 0.2, sfy: 0.1, tint: 0x5a4a4a, row: 1, scale: 1.35, depth: DEPTH.far + 0.5, alpha: 0.9, rate: 6, combat: true, maxAlive: 5 }, opts);
    this.list = []; this.fx = []; this.t = 1;
    if (this.ok) for (let i = 0; i < 3; i++) this.spawn(rand(0.1, 0.9));
  }

  camX() { return this.scene.cameras.main.scrollX * this.o.sf; }

  spawn(screenFrac) {
    const o = this.o;
    const total = TYPES.reduce((a, t) => a + t.weight, 0);
    let r = Math.random() * total, type = TYPES[0];
    for (const t of TYPES) { r -= t.weight; if (r <= 0) { type = t; break; } }
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sx = screenFrac !== undefined ? GAME_W * screenFrac : (dir > 0 ? -90 : GAME_W + 90);
    const lane = Math.random() < 0.5 ? 0 : 1;
    const sc = o.scale * (lane ? 0.8 : 1);
    const img = this.scene.add.image(0, 0, 'pv_vehicles', o.row * 5 + type.col)
      .setScrollFactor(o.sf, o.sfy).setDepth(o.depth - lane * 0.05).setScale(sc).setOrigin(0.5, 1)
      .setFlipX(dir < 0).setTint(lane ? this.dim(o.tint, 0.8) : o.tint).setAlpha(o.alpha);
    if (o.container) o.container.add(img);
    const v = { img, type, dir, sx, y: o.y - lane * 10, fireT: rand(1.5, 5), lane, sc };
    this.place(v);
    this.list.push(v);
  }

  layer(img) { if (this.o.container) this.o.container.add(img); return img; }

  dim(c, k) { return (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k); }

  place(v) { v.img.setPosition(v.sx + this.camX(), v.y + this.scene.cameras.main.scrollY * this.o.sfy); }

  update(dt) {
    if (!this.ok) return;
    this.t -= dt;
    if (this.t <= 0 && this.list.length < this.o.maxAlive) { this.t = rand(this.o.rate * 0.6, this.o.rate * 1.4); this.spawn(); }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      v.sx += v.dir * v.type.speed * (v.lane ? 0.8 : 1) * dt;
      this.place(v);
      if (v.sx < -160 || v.sx > GAME_W + 160) { v.img.destroy(); this.list.splice(i, 1); continue; }
      if (this.o.combat && v.type.fires && v.sx > 40 && v.sx < GAME_W - 40) {
        v.fireT -= dt;
        if (v.fireT <= 0) { v.fireT = v.type.fires === 'mg' ? rand(2, 4) : rand(4, 8); this.fire(v); }
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t += dt;
      if (f.kind === 'rocket') {
        f.vy += 30 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        f.img.setPosition(f.x + this.camX(), f.y + this.scene.cameras.main.scrollY * this.o.sfy).setRotation(Math.atan2(f.vy, f.vx));
        if (f.t > f.life) {
          // distant impact flash on the far horizon
          const fl = this.layer(this.scene.add.image(f.img.x, f.img.y, 'glow')).setScrollFactor(this.o.sf, this.o.sfy).setDepth(this.o.depth - 0.2).setBlendMode('ADD').setTint(0xffa050).setScale(0.6);
          this.scene.tweens.add({ targets: fl, scale: 1.4, alpha: 0, duration: 500, onComplete: () => fl.destroy() });
          f.img.destroy(); this.fx.splice(i, 1);
        }
      } else if (f.t > f.life) { f.img.destroy(); this.fx.splice(i, 1); }
    }
  }

  fire(v) {
    const o = this.o; const s = v.sc; const dir = v.dir;
    const mx = v.sx + dir * 16 * s, my = v.y - 15 * s;
    const glow = (x, y, sc, tint) => {
      const g = this.layer(this.scene.add.image(x + this.camX(), y + this.scene.cameras.main.scrollY * o.sfy, 'glow')).setScrollFactor(o.sf, o.sfy).setDepth(o.depth + 0.01).setBlendMode('ADD').setTint(tint).setScale(sc);
      this.scene.tweens.add({ targets: g, alpha: 0, scale: sc * 1.6, duration: 160, onComplete: () => g.destroy() });
    };
    if (v.type.fires === 'cannon') { glow(mx, my, 0.45, 0xffc070); AudioEngine.play('cannon', { vol: 0.12, gap: 900 }); }
    else if (v.type.fires === 'mg') { for (let k = 0; k < 4; k++) this.scene.time.delayedCall(k * 90, () => glow(mx, my + 3, 0.18, 0xffe0a0)); }
    else if (v.type.fires === 'rockets') {
      AudioEngine.play('launcher', { vol: 0.12, gap: 1500 });
      for (let k = 0; k < 4; k++) this.scene.time.delayedCall(k * 180, () => {
        if (!v.img.active) return;
        const img = this.layer(this.scene.add.image(0, 0, 'spark')).setScrollFactor(o.sf, o.sfy).setDepth(o.depth + 0.02).setBlendMode('ADD').setTint(0xffb060).setScale(1.2, 1);
        this.fx.push({ kind: 'rocket', img, x: v.sx - dir * 6 * s, y: v.y - 18 * s, vx: dir * rand(120, 180), vy: -rand(110, 150), t: 0, life: rand(1.6, 2.4) });
      });
    }
  }

  destroy() { for (const v of this.list) v.img.destroy(); for (const f of this.fx) f.img.destroy(); this.list = []; this.fx = []; }
}
