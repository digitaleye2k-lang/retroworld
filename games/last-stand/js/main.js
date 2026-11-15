'use strict';
/* ===== main loop (fixed 60 Hz simulation, scaled rendering) ===== */
Input.init(); Touch.init();
const STEP = 1 / 60; let acc = 0, lastT = performance.now(), frames = 0;
function step() {
  Input.poll();
  if (G.state === 'play') {
    if (Input.hit('pause') || (Input.hit('back') && !Input.k.Backspace && Input.padOn)) { G.state = 'pause'; UI.sel = 0; Input.clearHits(); return; }
    G.update(STEP);
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
function loop(now) {
  const dt = Math.min(.1, (now - lastT) / 1000); lastT = now; acc += dt; let n = 0;
  while (acc >= STEP && n < 4) { step(); acc -= STEP; n++; } if (n === 4) acc = 0;
  render(); frames++; requestAnimationFrame(loop);
}
G.state = 'title'; Music.play(0);
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') { G.state = 'pause'; UI.sel = 0; } });
requestAnimationFrame(loop);
window.__LS = { G, get P() { return P; }, World, Boss, UI, Input, Save };
