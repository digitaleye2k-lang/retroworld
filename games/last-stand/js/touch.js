'use strict';
/* ===== touch controls: virtual stick + action buttons ===== */
const Touch = {
  stick: null, ids: {}, B: [
    { id: 'fire', x: W - 92, y: H - 96, r: 50, lbl: 'FIRE', c: '#ff3a3a' }, { id: 'jump', x: W - 196, y: H - 64, r: 40, lbl: 'JUMP', c: '#5aff8a' },
    { id: 'grenade', x: W - 66, y: H - 210, r: 30, lbl: 'GREN', c: '#ffd84a' }, { id: 'swap', x: W - 164, y: H - 168, r: 30, lbl: 'SWAP', c: '#9fe8ff' },
    { id: 'special', x: W - 262, y: H - 150, r: 30, lbl: 'LAST', c: '#c06bff' }, { id: 'pause', x: W - 34, y: 130, r: 22, lbl: '❚❚', c: '#fff' }],
  pos(t) { return { x: (t.clientX - OX) / SCALE, y: (t.clientY - OY) / SCALE }; },
  init() {
    const on = e => { Input.touchOn = true; Input.mouseOn = false; Input.padOn = false; Snd.init(); };
    cv.addEventListener('touchstart', e => { on(e); e.preventDefault(); for (const t of e.changedTouches) { const p = this.pos(t); if (G.state !== 'play') { Input.mx = p.x; Input.my = p.y; UI.click(p.x, p.y); continue; } const b = this.B.find(b => dist(p.x, p.y, b.x, b.y) < b.r + 14); if (b) { this.ids[t.identifier] = b.id; Input.T[b.id] = true; if (b.id === 'pause') { Input.T.pause = false; G.state = 'pause'; UI.sel = 0; } } else if (p.x < W * .5) { this.stick = { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y }; } } }, { passive: false });
    cv.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) { const p = this.pos(t); if (this.stick && t.identifier === this.stick.id) { this.stick.x = p.x; this.stick.y = p.y; this.applyStick(); } } }, { passive: false });
    const end = e => { for (const t of e.changedTouches) { const id = this.ids[t.identifier]; if (id) { Input.T[id] = false; delete this.ids[t.identifier]; } if (this.stick && t.identifier === this.stick.id) { this.stick = null; Input.T.left = Input.T.right = Input.T.up = Input.T.down = false; } } };
    cv.addEventListener('touchend', end); cv.addEventListener('touchcancel', end);
  },
  applyStick() { const s = this.stick, dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy); if (d > 60) { s.ox = s.x - dx / d * 60; s.oy = s.y - dy / d * 60; } const T = Input.T; T.left = dx < -18; T.right = dx > 18; T.up = dy < -26; T.down = dy > 26; },
  draw(g) {
    if (!Input.touchOn || G.state !== 'play') return; g.save(); g.globalAlpha = .55;
    const s = this.stick; const bx = s ? s.ox : 120, by = s ? s.oy : H - 110; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(bx, by, 60, 0, TAU); g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(s ? s.x : bx, s ? s.y : by, 26, 0, TAU); g.fill();
    for (const b of this.B) { const on = Input.T[b.id]; g.fillStyle = on ? b.c : 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); g.strokeStyle = b.c; g.lineWidth = 3; g.stroke(); g.globalAlpha = .9; txt(g, b.lbl, b.x, b.y + 5, b.r > 40 ? 16 : 11, on ? '#000' : '#fff', 'center', { stroke: false }); g.globalAlpha = .55; if (b.id === 'special' && P && P.sp >= 100) { g.strokeStyle = '#ffd84a'; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, b.r + 6 + Math.sin(G.t * 8) * 3, 0, TAU); g.stroke(); } }
    g.restore();
  }
};
