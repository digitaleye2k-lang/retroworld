'use strict';
/* ===== SHADOW PROTOCOL :: touch — twin-stick controls for phones and tablets =====
   Left half of the screen: floating movement stick (analog).
   Right half: floating aim stick — push it past the ring to fire. Light aim assist snaps to a target near your aim.
   Buttons feed the same Input codes the keyboard uses, so every move and combo works identically.
   Activates on the first real touch, so mouse + keyboard players never see it. */
const TOUCH_HINTS = ['LEFT THUMB moves — RIGHT THUMB aims. Push the right stick out to shoot', 'SLIDE: bullets pass over you while you slide — keep shooting', 'ROLL gives a moment of invulnerability. Tap ROLL during a slide to chain',
  'DIVE: slow-motion dive. Hold SLIDE as you land to slide out of it', 'BT: BULLET TIME. Watch the tracers, step between them, pick your shots', 'Let a bullet barely miss you while moving for a PERFECT DODGE',
  'ACT near an enemy: takedown. ACT also opens doors and flips desks into cover', 'JUMP clears desks and crates. ROLL next to a wall mid-air: wall kick', 'Shoot barrels, glass, lights and fuse boxes', 'RLD reloads — tap it again in the green zone for a PERFECT RELOAD. SWAP changes weapon'];
const Touch = {
  on: false, el: null, aim: 0, L: { id: null, ox: 0, oy: 0, x: 0, y: 0, el: null }, R: { id: null, ox: 0, oy: 0, x: 0, y: 0, el: null }, MAX: 54,
  enable() { if (this.on) return; this.on = true; Input.touch = true; Input.ax = Input.ay = 0; document.body.classList.add('touch'); },
  init() {
    const el = this.el = document.getElementById('touch'); if (!el) return;
    this.L.el = el.querySelector('.stick.l'); this.R.el = el.querySelector('.stick.r');
    addEventListener('touchstart', () => { this.enable(); Snd.init(); }, { passive: true, capture: true });
    const pick = t => t.clientX < innerWidth / 2 ? this.L : this.R;
    el.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) { const s = pick(t); if (s.id === null) { s.id = t.identifier; s.ox = s.x = t.clientX; s.oy = s.y = t.clientY; s.el.style.display = 'block'; s.el.style.left = s.ox + 'px'; s.el.style.top = s.oy + 'px'; } } }, { passive: false });
    el.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) for (const s of [this.L, this.R]) if (s.id === t.identifier) { s.x = t.clientX; s.y = t.clientY; } }, { passive: false });
    const end = e => { for (const t of e.changedTouches) for (const s of [this.L, this.R]) if (s.id === t.identifier) { s.id = null; s.el.style.display = 'none'; } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    el.querySelectorAll('[data-k]').forEach(b => {
      const codes = b.dataset.k.split(',');
      b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('dn');
        if (codes[0] === 'pause') return pauseGame(); if (codes[0] === 'wheel') { Input.wheel = 1; return; }
        for (const c of codes) { Input.keys[c] = true; Input.pressed[c] = true; } }, { passive: false });
      const up = e => { e.preventDefault(); e.stopPropagation(); b.classList.remove('dn'); for (const c of codes) Input.keys[c] = false; };
      b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    });
  },
  reset() { for (const s of [this.L, this.R]) { s.id = null; if (s.el) s.el.style.display = 'none'; } Input.ax = Input.ay = 0; if (this.on) Input.keys.M0 = false; },
  vec(s) { if (s.id === null) return [0, 0, 0]; let dx = s.x - s.ox, dy = s.y - s.oy; const l = Math.hypot(dx, dy); if (l > this.MAX) { s.ox = s.x - dx / l * this.MAX; s.oy = s.y - dy / l * this.MAX; s.el.style.left = s.ox + 'px'; s.el.style.top = s.oy + 'px'; dx = s.x - s.ox; dy = s.y - s.oy; } // the base follows a dragging thumb
    const k = s.el.firstElementChild; k.style.transform = `translate(${dx}px,${dy}px)`; const d = Math.min(1, l / this.MAX); return d < .14 ? [0, 0, d] : [dx / (l || 1) * d, dy / (l || 1) * d, d]; },
  // nearest live enemy the player could plausibly mean: inside a cone around `ang` (or anywhere if cone is PI)
  target(ang, cone, range) { let best = null, bs = 1e9; for (const e of Enemies) { if (!e.alive || e.dP > range) continue; const a = Math.atan2(e.y - P.y, e.x - P.x), df = Math.abs(angDiff(ang, a)); if (df > cone) continue; const s = e.dP * (1 + df * 2); if (s < bs && losClear(P.x, P.y, e.x, e.y)) { bs = s; best = e; } } return best; },
  update() {
    if (!this.on || !P.alive) return;
    const [mx, my] = this.vec(this.L); Input.ax = mx; Input.ay = my;
    const [ax, ay, d] = this.vec(this.R);
    if (d > .2) { // manual aim, with a gentle snap onto a target close to the aim line
      this.aim = Math.atan2(ay, ax); const t = this.target(this.aim, .3, 620); if (t) { const J = t.rig.J; this.aim = Math.atan2((J ? J.head.y : t.y) - P.y, (J ? J.head.x : t.x) - P.x); }
      Input.keys.M0 = d > .45;
    } else {
      Input.keys.M0 = false; const t = this.target(this.aim, Math.PI, 420); // thumb off the stick: face the nearest visible threat, else the way you run
      if (t) this.aim = Math.atan2(t.y - P.y, t.x - P.x); else if (mx || my) this.aim = Math.atan2(my, mx);
    }
    const sx = View.w / 2 + (P.x - Cam.x - Cam.sx) * View.S, sy = View.h / 2 + (P.y - Cam.y - Cam.sy) * View.S, r = Math.min(View.w, View.h) * .3;
    Input.mx = sx + Math.cos(this.aim) * r; Input.my = sy + Math.sin(this.aim) * r;
    const de = this.el.querySelector('.de'); if (de) de.style.display = hasAb('deadeye') ? 'flex' : 'none';
  }
};
