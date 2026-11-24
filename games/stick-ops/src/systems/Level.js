// Level construction toolkit: solids, platforms, props, cover, explosive barrels,
// parallax backgrounds and destructible buildings.
import { DEPTH, GAME_W, GAME_H } from '../config.js';
import { THEMES } from '../core/TextureFactory.js';
import { AudioEngine } from '../core/AudioEngine.js';

let bldCounter = 0;

export class Level {
  constructor(scene, opts) {
    this.scene = scene;
    this.w = opts.width; this.h = opts.height || 1080;
    this.theme = opts.theme || 'night';
    scene.solids = []; scene.covers = []; scene.barrels = []; scene.destructibles = []; scene.ladders = [];
    this.group = scene.physics.add.staticGroup();
    scene.solidGroup = this.group;
    scene.physics.world.setBounds(0, -400, this.w, this.h + 400);
    scene.physics.world.setBoundsCollision(true, true, false, false);
    this.parallax = [];
    bldCounter = 0;
  }

  // ---------- solids ----------
  solid(x, y, w, h, opts = {}) {
    const s = Object.assign({ x, y, w, h, material: 'concrete' }, opts);
    const z = this.scene.add.zone(x + w / 2, y + h / 2, w, h);
    this.scene.physics.add.existing(z, true);
    if (s.oneWay) { z.body.checkCollision.down = false; z.body.checkCollision.left = false; z.body.checkCollision.right = false; }
    z.solid = s; s.zone = z;
    this.group.add(z);
    this.scene.solids.push(s);
    if (s.cover) this.scene.covers.push(s);
    return s;
  }

  removeSolid(s) {
    const scene = this.scene;
    const i = scene.solids.indexOf(s); if (i >= 0) scene.solids.splice(i, 1);
    const c = scene.covers.indexOf(s); if (c >= 0) scene.covers.splice(c, 1);
    s.dead = true;
    if (s.zone) { this.group.remove(s.zone); s.zone.destroy(); s.zone = null; }
  }

  ground(x, w, y, kind = 'dirt') {
    const tex = kind === 'concrete' ? 'tex_concrete' : kind === 'metal' ? 'tex_metal' : kind === 'asphalt' ? 'tex_asphalt' : 'tex_dirt';
    const h = this.h + 200 - y;
    const edgeKey = kind === 'concrete' || kind === 'asphalt' ? 'edge_concrete' : kind === 'metal' ? 'edge_metal' : 'edge_' + this.theme;
    // visuals in <=2048px chunks: very wide tile sprites exceed the GPU texture limit on many devices
    for (let cx = 0; cx < w; cx += 2048) {
      const cw = Math.min(2048, w - cx);
      this.scene.add.tileSprite(x + cx, y, cw, h, tex).setOrigin(0).setDepth(DEPTH.solids).setTilePosition(cx, 0);
      this.scene.add.tileSprite(x + cx, y - (kind === 'dirt' ? 8 : 0), cw, kind === 'dirt' ? 28 : 12, edgeKey).setOrigin(0).setDepth(DEPTH.solids + 1).setTilePosition(cx, 0);
    }
    const s = this.solid(x, y, w, h, { material: kind === 'metal' ? 'metal' : kind === 'dirt' ? 'dirt' : 'concrete', ground: true });
    // floors only collide from above: seams between neighbouring ground pieces can't snag actors
    s.zone.body.checkCollision.left = false; s.zone.body.checkCollision.right = false;
    return s;
  }

  block(x, y, w, h, opts = {}) {
    const tex = opts.tex || 'tex_concrete';
    const ts = this.scene.add.tileSprite(x, y, w, h, tex).setOrigin(0).setDepth(opts.depth || DEPTH.solids);
    if (opts.tint) ts.setTint(opts.tint);
    if (!opts.noEdge) this.scene.add.tileSprite(x, y, w, 12, tex === 'tex_metal' ? 'edge_metal' : 'edge_concrete').setOrigin(0).setDepth((opts.depth || DEPTH.solids) + 1);
    const s = this.solid(x, y, w, h, { material: tex === 'tex_metal' ? 'metal' : 'concrete', cover: opts.cover });
    s.visuals = [ts];
    return s;
  }

  wall(x, y, w, h, opts = {}) { return this.block(x, y, w, h, Object.assign({ tex: 'tex_wall', tint: 0x9a9a9a }, opts)); }

  platform(x, y, w, opts = {}) {
    const g = this.scene.add.graphics().setDepth(DEPTH.solids - 2);
    g.fillStyle(0x0d1215, 1);
    if (!opts.noSupports) for (let sx = x + 20; sx < x + w; sx += 140) g.fillRect(sx, y + 8, 6, (opts.supportTo || y + 400) - y);
    g.lineStyle(2, 0x2a343a, 1);
    if (opts.rail !== false) {
      g.lineBetween(x, y - 30, x + w, y - 30); g.lineBetween(x, y - 15, x + w, y - 15);
      for (let rx = x; rx <= x + w; rx += 40) g.lineBetween(rx, y - 32, rx, y);
    }
    this.scene.add.tileSprite(x, y, w, 10, 'edge_metal').setOrigin(0).setDepth(DEPTH.solids + 1);
    return this.solid(x, y, w, 10, { oneWay: true, material: 'metal', bulletPass: true });
  }

  // climbable ladder from bottomY up to topY (a platform top)
  ladder(x, topY, bottomY) {
    const g = this.scene.add.graphics().setDepth(DEPTH.solids - 1);
    g.lineStyle(3, 0x1a2125, 1); g.lineBetween(x - 11, topY - 30, x - 11, bottomY); g.lineBetween(x + 11, topY - 30, x + 11, bottomY);
    g.lineStyle(2, 0x2a343a, 1); for (let y = bottomY - 12; y > topY - 28; y -= 18) g.lineBetween(x - 11, y, x + 11, y);
    g.lineStyle(1, 0x5a6a74, 0.5); g.lineBetween(x - 12, topY - 30, x - 12, bottomY);
    if (!this.scene.ladders) this.scene.ladders = [];
    const l = { x, top: topY, bottom: bottomY };
    this.scene.ladders.push(l);
    return l;
  }

  // prop sitting on groundY. opts: solid, cover, material, scale, depth, flip, tint, hitInset
  prop(key, x, groundY, opts = {}) {
    const sc = opts.scale || 1;
    const img = this.scene.add.image(x, groundY, key).setOrigin(0.5, 1).setScale(sc).setDepth(opts.depth || (opts.solid ? DEPTH.solids - 1 : DEPTH.decorBack));
    if (opts.flip) img.setFlipX(true);
    if (opts.tint) img.setTint(opts.tint);
    let s = null;
    if (opts.solid) {
      const inset = opts.hitInset || 0;
      const w = img.displayWidth - inset * 2, h = (opts.solidH || img.displayHeight) - (opts.topInset || 0);
      s = this.solid(x - w / 2, groundY - h, w, h, { material: opts.material || 'concrete', cover: opts.cover });
      s.visuals = [img];
    }
    return { img, solid: s };
  }

  crate(x, groundY, size = 1, metal = false) { return this.prop(metal ? 'crate_metal' : 'crate', x, groundY, { solid: true, cover: true, scale: size * 0.85, material: metal ? 'metal' : 'wood' }); }
  sandbags(x, groundY) { return this.prop('sandbags', x, groundY, { solid: true, cover: true, material: 'dirt', solidH: 40 }); }
  jersey(x, groundY) { return this.prop('jersey', x, groundY, { solid: true, cover: true, material: 'concrete' }); }
  container(x, groundY, color = 'red', flip) { return this.prop('container_' + color, x, groundY, { solid: true, material: 'metal', flip }); }

  barrel(x, groundY) {
    const p = this.prop('barrel', x, groundY, { solid: true, material: 'metal' });
    const b = { x, y: groundY - 24, hp: 30, img: p.img, solid: p.solid, dead: false };
    p.solid.onHit = (bullet) => this.damageBarrel(b, bullet.dmg, bullet.owner);
    this.scene.barrels.push(b);
    return b;
  }

  damageBarrel(b, dmg, owner) {
    if (b.dead) return;
    b.hp -= dmg;
    if (b.hp <= 0) {
      b.dead = true;
      this.scene.time.delayedCall(80, () => {
        b.img.destroy(); this.removeSolid(b.solid);
        this.scene.fx.explosion(b.x, b.y, { radius: 190, damage: 260, owner: 'world', source: owner });
        this.scene.fx.fireSource(b.x, b.y + 22, 0.7, 9000);
      });
    } else if (b.hp < 20 && !b.leaking) { b.leaking = true; this.scene.fx.fireSource(b.x, b.y - 20, 0.3, 1600); this.scene.time.delayedCall(1600, () => this.damageBarrel(b, 100, owner)); }
  }

  decor(key, x, y, opts = {}) {
    const img = this.scene.add.image(x, y, key).setOrigin(opts.ox ?? 0.5, opts.oy ?? 1).setDepth(opts.depth || DEPTH.decorBack).setScale(opts.scale || 1);
    if (opts.tint !== undefined) img.setTint(opts.tint);
    if (opts.alpha !== undefined) img.setAlpha(opts.alpha);
    if (opts.flip) img.setFlipX(true);
    if (opts.scrollFactor) img.setScrollFactor(opts.scrollFactor, 1);
    return img;
  }

  fence(x, w, groundY, depth = DEPTH.decorBack) {
    let first = null;
    for (let cx = 0; cx < w; cx += 2048) { const t = this.scene.add.tileSprite(x + cx, groundY, Math.min(2048, w - cx), 110, 'fence').setOrigin(0, 1).setDepth(depth).setTilePosition(cx, 0); first = first || t; }
    return first;
  }

  lamp(x, groundY, color = 0xffe2a8, on = true) {
    this.decor('lamp', x, groundY, { depth: DEPTH.decorBack + 1 });
    const l = this.scene.lighting ? this.scene.lighting.add({ x: x - 19, y: groundY - 210, cone: { angle: Math.PI / 2, len: 260, width: 220 }, i: 0.9, color, glowAlpha: 0.18, on }) : null;
    return l;
  }

  // ---------- background ----------
  background(opts = {}) {
    const scene = this.scene; const th = THEMES[this.theme];
    const cover = Math.max(1.6, 1.2 / (opts.minZoom || 1));
    const W = GAME_W * cover, H = GAME_H * cover;
    scene.add.image(GAME_W / 2, GAME_H / 2, 'sky_' + this.theme).setDisplaySize(W, H).setScrollFactor(0).setDepth(DEPTH.sky);
    if (this.theme !== 'dawn') this.parallax.push({ obj: scene.add.tileSprite(GAME_W / 2, GAME_H * 0.3, W, 400, 'stars_' + this.theme).setScrollFactor(0).setDepth(DEPTH.sky + 0.5), f: 0.02, baseY: GAME_H * 0.3, fy: 0.01 });
    if (th.moon) {
      const m = scene.add.image(GAME_W * 0.78, GAME_H * 0.2, 'glow').setScrollFactor(0).setDepth(DEPTH.sky + 0.6).setScale(0.55).setTint(0xdfeaff);
      scene.add.image(GAME_W * 0.78, GAME_H * 0.2, 'glow').setScrollFactor(0).setDepth(DEPTH.sky + 0.6).setScale(3).setAlpha(0.18).setTint(0x7fa8d8).setBlendMode('ADD');
      this.parallax.push({ obj: m, f: 0, baseY: GAME_H * 0.2, fy: 0.005, fixed: true });
    }
    if (th.sun) {
      scene.add.image(GAME_W * 0.3, GAME_H * 0.62, 'glow').setScrollFactor(0).setDepth(DEPTH.sky + 0.6).setScale(6).setAlpha(0.5).setTint(0xffa860).setBlendMode('ADD');
    }
    const baseGY = opts.horizon || GAME_H * 0.78;
    const layer = (key, f, y, depth, alpha = 1) => {
      const t = scene.add.tileSprite(GAME_W / 2, y, W, scene.textures.get(key).getSourceImage().height, key).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth).setAlpha(alpha);
      this.parallax.push({ obj: t, f, baseY: y, fy: f * 0.5 });
      return t;
    };
    layer('far_' + this.theme, 0.08, baseGY + 40, DEPTH.far);
    layer('mid_' + this.theme, 0.22, baseGY + 120, DEPTH.mid);
    layer('near_' + this.theme, 0.45, baseGY + 260, DEPTH.near);
    // ground fog band
    const fog = scene.add.image(GAME_W / 2, baseGY + 160, 'glow').setScrollFactor(0).setDepth(DEPTH.near + 0.5).setDisplaySize(W * 1.4, 260).setTint(th.fog).setAlpha(0.35);
    this.parallax.push({ obj: fog, f: 0, baseY: baseGY + 160, fy: 0.45, fixed: true });
    this.camBaseY = opts.camBaseY !== undefined ? opts.camBaseY : this.h - GAME_H;
  }

  updateParallax() {
    const cam = this.scene.cameras.main;
    for (const p of this.parallax) {
      if (!p.fixed) p.obj.tilePositionX = cam.scrollX * p.f;
      p.obj.y = p.baseY - (cam.scrollY - this.camBaseY) * p.fy;
    }
  }

  // ---------- buildings ----------
  facadeTexture(w, h, opts = {}) {
    const key = 'bld_' + this.scene.scene.key + '_' + (bldCounter++);
    if (this.scene.textures.exists(key)) return key;
    const tex = this.scene.textures.createCanvas(key, w, h); const c = tex.getContext();
    const base = opts.color || '#1d2226';
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    if (this.scene.textures.exists('img_concrete')) {
      const img = this.scene.textures.get('img_concrete').getSourceImage();
      for (let x = 0; x < w; x += img.width) for (let y = 0; y < h; y += img.height) c.drawImage(img, x, y);
      c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,0.6)'; c.fillRect(0, 0, w, h); c.restore();
      c.globalAlpha = 0.72; c.fillStyle = base; c.fillRect(0, 0, w, h); c.globalAlpha = 1;
    }
    // concrete noise
    for (let i = 0; i < w * h / 60; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 60; y < h; y += 70) c.fillRect(0, y, w, 4);
    const lit = opts.lit === undefined ? 0.35 : opts.lit;
    for (let y = 22; y < h - 50; y += 70) for (let x = 20; x < w - 40; x += 60) {
      const on = Math.random() < lit;
      c.fillStyle = on ? (opts.warm === false ? 'rgba(150,210,255,0.75)' : 'rgba(255,200,120,0.8)') : 'rgba(5,8,10,0.9)';
      c.fillRect(x, y, 30, 34);
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x + 14, y, 2, 34); c.fillRect(x, y + 16, 30, 2);
      if (on) { c.fillStyle = 'rgba(255,200,120,0.08)'; c.fillRect(x - 8, y - 8, 46, 50); }
    }
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, w, 10); c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, 10, w, 2);
    if (opts.sign) { c.fillStyle = '#c9a43a'; c.fillRect(w / 2 - 70, 30, 140, 24); c.fillStyle = '#111'; c.font = 'bold 16px monospace'; c.textAlign = 'center'; c.fillText(opts.sign, w / 2, 48); }
    tex.refresh();
    return key;
  }

  // Backdrop building (non-colliding) or destructible structure
  building(x, groundY, w, h, opts = {}) {
    const key = this.facadeTexture(w, h, opts);
    const img = this.scene.add.image(x, groundY, key).setOrigin(0, 1).setDepth(opts.depth || DEPTH.backdrop);
    if (opts.tint) img.setTint(opts.tint);
    const b = { x, y: groundY - h, w, h, img, key, solids: [], dead: false };
    if (opts.roof) b.solids.push(this.platform(x, groundY - h, w, { noSupports: true, rail: false }));
    if (opts.destructible) this.scene.destructibles.push(b);
    return b;
  }

  // Shatter a building's facade into physical chunks
  collapse(b, opts = {}) {
    if (b.dead) return; b.dead = true;
    const scene = this.scene; const tex = scene.textures.get(b.key);
    const cell = opts.cell || 46;
    const cols = Math.ceil(b.w / cell), rows = Math.ceil(b.h / cell);
    const cx = b.x + b.w / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const fname = 'c' + r + '_' + c;
      const fw = Math.min(cell, b.w - c * cell), fh = Math.min(cell, b.h - r * cell);
      if (!tex.has(fname)) tex.add(fname, 0, c * cell, r * cell, fw, fh);
      const wx = b.x + c * cell + fw / 2, wy = b.y + r * cell + fh / 2;
      const delay = (rows - r) * 50 * (opts.fromTop ? 0.2 : 1) + Math.random() * 120;
      const dirx = (wx - cx) / (b.w / 2) + (opts.push || 0);
      const vx = dirx * (60 + Math.random() * 160), vy = -Math.random() * 220 * (r < rows / 2 ? 1 : 0.4);
      scene.time.delayedCall(delay, () => {
        if (Math.random() < 0.65 || r > rows - 3) scene.fx.spawnDebris(b.key, wx, wy, vx, vy, { frame: fname, life: 4 + Math.random() * 4, bounce: 0.15, half: fh / 2.5, va: (Math.random() - 0.5) * 4, depth: DEPTH.fx - 3 });
        if (Math.random() < 0.15) scene.fx.burst('dust', wx, wy, 2, -90, 200, 20, 80);
      });
    }
    b.img.destroy();
    for (const s of b.solids) this.removeSolid(s);
    // rubble pile & dust wall
    scene.time.delayedCall(400, () => {
      const rub = scene.add.graphics().setDepth(DEPTH.solids - 1); rub.fillStyle(0x15181a, 1);
      const gy = b.y + b.h;
      rub.beginPath(); rub.moveTo(b.x - 30, gy); for (let i = 0; i <= 10; i++) rub.lineTo(b.x - 30 + (b.w + 60) * i / 10, gy - 20 - Math.random() * 55 * Math.sin((i / 10) * Math.PI)); rub.lineTo(b.x + b.w + 30, gy); rub.closePath(); rub.fillPath();
    });
    for (let i = 0; i < 10; i++) scene.time.delayedCall(i * 90, () => scene.fx.burst('smoke', b.x + Math.random() * b.w, b.y + b.h - 30 - Math.random() * 60, 4, -90, 140, 40, 220));
    AudioEngine.play('debris', { x: cx });
    scene.fx.shake(1200, 0.012);
  }
}
