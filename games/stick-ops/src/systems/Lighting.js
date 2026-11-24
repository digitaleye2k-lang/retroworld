// Dynamic 2D lighting: a darkness render texture that follows the camera, with lights
// erased out of it (soft radial lights + directional cones) and additive colour glows.
import { DEPTH, GAME_W, GAME_H } from '../config.js';

export class Lighting {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.ambient = opts.ambient !== undefined ? opts.ambient : 0x01040a;
    this.darkness = opts.darkness !== undefined ? opts.darkness : 0.72;
    const mz = opts.minZoom || 0.72;
    this.W = Math.ceil(GAME_W / mz) + 120; this.H = Math.ceil(GAME_H / mz) + 120;
    /* darkness is soft, so it renders at half resolution and is scaled up: a quarter of the GPU fill per frame */
    this.RS = 0.5;
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(this.W * this.RS), Math.ceil(this.H * this.RS)).setOrigin(0, 0).setDepth(DEPTH.light).setScale(1 / this.RS);
    this.lights = [];
    this.flashes = [];
    this.enabled = true;
    this.time = 0;
  }

  // light: {x,y,r,i,color,flicker,cone:{angle,len,width}, glow:true, follow: obj with x,y}
  add(l) {
    const light = Object.assign({ r: 200, i: 1, flicker: 0, on: true }, l);
    if (light.color !== undefined && light.glow !== false) {
      light.glowImg = this.scene.add.image(light.x, light.y, light.cone ? 'cone' : 'glow').setBlendMode('ADD').setTint(light.color).setDepth(DEPTH.fx - 2);
      if (light.cone) light.glowImg.setOrigin(0, 0.5);
      light.glowAlpha = light.glowAlpha !== undefined ? light.glowAlpha : 0.22;
    }
    this.lights.push(light);
    return light;
  }

  remove(l) {
    const i = this.lights.indexOf(l); if (i >= 0) this.lights.splice(i, 1);
    if (l.glowImg) l.glowImg.destroy();
  }

  flash(x, y, r, i, dur) { if (this.flashes.length < 40) this.flashes.push({ x, y, r, i, life: dur, max: dur }); }

  setDarkness(d, ms = 0) {
    if (!ms) { this.darkness = d; return; }
    this.scene.tweens.add({ targets: this, darkness: d, duration: ms });
  }

  update(dt) {
    this.time += dt;
    const rt = this.rt;
    if (!this.enabled || this.darkness <= 0.01) { rt.setVisible(false); this._updateGlows(); return; }
    rt.setVisible(true);
    const cam = this.scene.cameras.main; const v = cam.worldView;
    const ox = v.centerX - this.W / 2, oy = v.centerY - this.H / 2;
    rt.setPosition(ox, oy);
    rt.clear();
    rt.fill(this.ambient, this.darkness);
    const view = { x: ox, y: oy, r: ox + this.W, b: oy + this.H }, k = this.RS;
    for (const l of this.lights) {
      if (l.follow) { l.x = l.follow.x + (l.ox || 0); l.y = l.follow.y + (l.oy || 0); }
      if (!l.on) continue;
      const reach = l.cone ? l.cone.len : l.r;
      if (l.x + reach < view.x || l.x - reach > view.r || l.y + reach < view.y || l.y - reach > view.b) continue;
      let i = l.i;
      if (l.flicker) i *= 1 - l.flicker * (0.5 + 0.5 * Math.sin(this.time * 23 + l.x) * Math.sin(this.time * 7.3 + l.y));
      if (l.cone) {
        rt.stamp('cone', null, (l.x - ox) * k, (l.y - oy) * k, { originX: 0, originY: 0.5, rotation: l.cone.angle, scaleX: l.cone.len / 512 * k, scaleY: (l.cone.width || 200) / 256 * k, alpha: i, erase: true });
        rt.stamp('light', null, (l.x - ox) * k, (l.y - oy) * k, { scale: 0.3 * k, alpha: i * 0.8, erase: true });
      } else {
        rt.stamp('light', null, (l.x - ox) * k, (l.y - oy) * k, { scale: l.r / 128 * k, alpha: i, erase: true });
      }
    }
    for (let k = this.flashes.length - 1; k >= 0; k--) {
      const f = this.flashes[k];
      f.life -= dt * 1000;
      if (f.life <= 0) { this.flashes.splice(k, 1); continue; }
      rt.stamp('light', null, (f.x - ox) * k, (f.y - oy) * k, { scale: f.r / 128 * k, alpha: f.i * (f.life / f.max), erase: true });
    }
    this._updateGlows();
  }

  _updateGlows() {
    for (const l of this.lights) {
      if (!l.glowImg) continue;
      l.glowImg.setVisible(l.on);
      if (!l.on) continue;
      l.glowImg.setPosition(l.x, l.y);
      if (l.cone) { l.glowImg.setRotation(l.cone.angle); l.glowImg.setScale(l.cone.len / 512, (l.cone.width || 200) / 256); }
      else l.glowImg.setScale(l.r / 64 * 0.6);
      let a = l.glowAlpha; if (l.flicker) a *= 1 - l.flicker * 0.5 * (1 + Math.sin(this.time * 19 + l.x));
      l.glowImg.setAlpha(a);
    }
  }

  destroy() { this.rt.destroy(); for (const l of this.lights) if (l.glowImg) l.glowImg.destroy(); this.lights = []; }
}
