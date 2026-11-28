'use strict';
/* ===== main loop (fixed 60 Hz simulation, scaled rendering) ===== */
Input.init(); Touch.init();
const STEP = 1 / 60; let acc = 0, lastT = performance.now(), frames = 0;
function step() {
  Input.poll(); try { Music.react(STEP); } catch (e) {}
  if (G.state === 'play') {
    if (Input.hit('pause') || (Input.hit('back') && !Input.k.Backspace && Input.padOn)) { G.state = 'pause'; UI.sel = 0; Input.clearHits(); return; }
    G.update(STEP); Cam.cine(STEP);
  }
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(SCALE * DPR, 0, 0, SCALE * DPR, OX * DPR, OY * DPR);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (G.state === 'play') { G.draw(); Touch.draw(ctx); }
  else { UI.draw(); Input.clearHits(); }
  ctx.restore();
}
/* frame-rate watchdog: drop render resolution on slow devices, restore it when there's headroom */
const Perf = { t: 0, n: 0, good: 0, check(dt) {
  if (G.state !== 'play' || document.hidden || dt > .25) return; this.t += dt; this.n++;
  if (this.t < 2) return; const fps = this.n / this.t; this.t = 0; this.n = 0;
  if (fps < 48 && RQ > .55) { RQ = Math.max(.55, RQ - .15); this.good = 0; resize(); }
  else if (fps > 58 && RQ < 1) { if (++this.good >= 4) { RQ = Math.min(1, RQ + .1); this.good = 0; resize(); } }
  else this.good = 0; } };
function loop(now) {
  const dt = Math.min(.1, (now - lastT) / 1000); lastT = now; acc += dt; let n = 0; Perf.check((now - (loop.p || now)) / 1000); loop.p = now;
  while (acc >= STEP && n < 4) { step(); acc -= STEP; n++; } if (n === 4) acc = 0;
  render(); frames++; requestAnimationFrame(loop);
}
G.state = 'title'; Music.play(0);
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') { G.state = 'pause'; UI.sel = 0; } });
requestAnimationFrame(loop);
window.__LS = { G, get P() { return P; }, World, Boss, UI, Input, Save };
