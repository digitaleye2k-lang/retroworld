// Procedural art generation: every texture in the game is painted here on canvases,
// so the game never depends on external image files.

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function make(scene, key, w, h, fn) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  fn(ctx, w, h);
  tex.refresh();
}

function radial(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function speckle(ctx, w, h, n, colors, r, seed = 1, size = [1, 3]) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(R() * colors.length)];
    const s = size[0] + R() * (size[1] - size[0]);
    ctx.globalAlpha = 0.25 + R() * 0.6; ctx.fillRect(R() * w, R() * h, s, s * (r || 1));
  }
  ctx.globalAlpha = 1;
}

export const THEMES = {
  night: {
    sky: [[0, '#02040a'], [0.55, '#0a1626'], [1, '#14283a']], far: '#0f1c2a', mid: '#0b1520', near: '#070e15',
    glow: 'rgba(120,180,220,0.10)', moon: true, ground: '#0d1216', groundTop: '#1b252c', fog: 0x0b1a28,
  },
  dawn: {
    sky: [[0, '#1b1c2e'], [0.45, '#5a3a48'], [0.75, '#c2643e'], [1, '#f0a15a']], far: '#4b3440', mid: '#2b2028', near: '#171215',
    glow: 'rgba(255,150,80,0.15)', sun: true, ground: '#1a1512', groundTop: '#3a2c22', fog: 0x6a3c2c,
  },
  dusk: {
    sky: [[0, '#07040a'], [0.5, '#261027'], [0.8, '#5c1d22'], [1, '#8a3320']], far: '#2a1620', mid: '#180d14', near: '#0d070b',
    glow: 'rgba(255,80,60,0.12)', storm: true, ground: '#120d0e', groundTop: '#2a1c1c', fog: 0x3a1218,
  },
};

// Tiles a loaded photo texture into the canvas and grades it toward the game's palette.
function photo(scene, c, key, w, h, tint, amount) {
  if (!scene.textures.exists(key)) return false;
  const img = scene.textures.get(key).getSourceImage();
  if (!img || !img.width) return false;
  for (let x = 0; x < w; x += img.width) for (let y = 0; y < h; y += img.height) c.drawImage(img, x, y);
  c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,0.55)'; c.fillRect(0, 0, w, h); c.restore();
  c.globalAlpha = amount; c.fillStyle = tint; c.fillRect(0, 0, w, h); c.globalAlpha = 1;
  return true;
}

// Blends a photo texture over an already painted prop (keeps the prop's silhouette)
function overlay(scene, c, key, w, h, mode = 'overlay', alpha = 0.55) {
  if (!scene.textures.exists(key)) return;
  const img = scene.textures.get(key).getSourceImage(); if (!img || !img.width) return;
  c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = alpha * 0.35; c.drawImage(img, 0, 0, w, h);
  c.globalCompositeOperation = mode; c.globalAlpha = alpha; c.drawImage(img, 0, 0, w, h); c.restore();
}

export function generateTextures(scene) {
  // ---------- particles & fx ----------
  make(scene, 'px', 4, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); });
  make(scene, 'glow', 128, 128, (c) => { c.fillStyle = radial(c, 64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 128, 128); });
  make(scene, 'light', 256, 256, (c) => { c.fillStyle = radial(c, 128, 128, 128, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 256, 256); });
  make(scene, 'cone', 512, 256, (c, w, h) => {
    // light cone pointing right, apex at left-middle
    c.save(); c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, 0); c.lineTo(w, h); c.closePath(); c.clip();
    c.fillStyle = lin(c, 0, 0, w, 0, [[0, 'rgba(255,255,255,0.95)'], [0.6, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = lin(c, 0, 0, 0, h, [[0, 'rgba(0,0,0,0)'], [0.3, 'rgba(0,0,0,1)'], [0.7, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    c.fillRect(0, 0, w, h); c.restore();
  });
  make(scene, 'beam', 64, 512, (c, w, h) => {
    // vertical searchlight beam, apex at bottom
    c.save(); c.beginPath(); c.moveTo(w / 2 - 3, h); c.lineTo(0, 0); c.lineTo(w, 0); c.lineTo(w / 2 + 3, h); c.closePath(); c.clip();
    c.fillStyle = lin(c, 0, h, 0, 0, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, w, h); c.restore();
  });
  make(scene, 'spark', 16, 4, (c) => { c.fillStyle = lin(c, 0, 0, 16, 0, [[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,1)']]); rr(c, 0, 0, 16, 4, 2); c.fill(); });
  make(scene, 'smoke', 64, 64, (c) => {
    const R = rng(7);
    for (let i = 0; i < 9; i++) {
      const x = 20 + R() * 24, y = 20 + R() * 24, r = 12 + R() * 14;
      c.fillStyle = radial(c, x, y, r, [[0, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 64, 64);
    }
  });
  make(scene, 'fire', 48, 48, (c) => { c.fillStyle = radial(c, 24, 24, 24, [[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,200,90,0.9)'], [0.7, 'rgba(255,90,20,0.5)'], [1, 'rgba(200,30,0,0)']]); c.fillRect(0, 0, 48, 48); });
  make(scene, 'ember', 6, 6, (c) => { c.fillStyle = radial(c, 3, 3, 3, [[0, 'rgba(255,240,200,1)'], [1, 'rgba(255,120,30,0)']]); c.fillRect(0, 0, 6, 6); });
  make(scene, 'chunk', 8, 8, (c) => { c.fillStyle = '#3a3532'; c.beginPath(); c.moveTo(1, 2); c.lineTo(6, 0); c.lineTo(8, 5); c.lineTo(4, 8); c.lineTo(0, 6); c.closePath(); c.fill(); c.fillStyle = '#5a534c'; c.fillRect(2, 2, 3, 2); });
  make(scene, 'casing', 6, 3, (c) => { c.fillStyle = '#d9a845'; c.fillRect(0, 0, 6, 3); c.fillStyle = '#fff0b0'; c.fillRect(1, 0, 3, 1); });
  make(scene, 'shell', 8, 4, (c) => { c.fillStyle = '#b32a1e'; c.fillRect(0, 0, 6, 4); c.fillStyle = '#d4a840'; c.fillRect(6, 0, 2, 4); });
  make(scene, 'blood', 6, 6, (c) => { c.fillStyle = radial(c, 3, 3, 3, [[0, 'rgba(150,12,10,1)'], [1, 'rgba(90,0,0,0)']]); c.fillRect(0, 0, 6, 6); });
  make(scene, 'rain', 2, 18, (c) => { c.fillStyle = lin(c, 0, 0, 0, 18, [[0, 'rgba(180,210,255,0)'], [1, 'rgba(180,210,255,0.7)']]); c.fillRect(0, 0, 2, 18); });
  make(scene, 'ring', 128, 128, (c) => { c.strokeStyle = 'rgba(255,255,255,1)'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 14; c.stroke(); });
  make(scene, 'scorch', 160, 40, (c) => { c.fillStyle = radial(c, 80, 20, 80, [[0, 'rgba(0,0,0,0.85)'], [0.6, 'rgba(10,6,4,0.5)'], [1, 'rgba(0,0,0,0)']]); c.save(); c.scale(1, 0.25); c.fillRect(0, 0, 160, 160); c.restore(); });
  make(scene, 'muzzle', 64, 32, (c) => {
    c.fillStyle = radial(c, 10, 16, 28, [[0, 'rgba(255,255,240,1)'], [0.3, 'rgba(255,220,120,0.9)'], [1, 'rgba(255,140,40,0)']]);
    c.beginPath(); c.moveTo(0, 16); c.lineTo(18, 4); c.lineTo(26, 12); c.lineTo(64, 16); c.lineTo(26, 20); c.lineTo(18, 28); c.closePath(); c.fill();
  });
  make(scene, 'flare', 256, 16, (c) => { c.fillStyle = lin(c, 0, 0, 256, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 6, 256, 4); });
  make(scene, 'rocket', 28, 8, (c) => { c.fillStyle = '#4b5640'; rr(c, 4, 1, 20, 6, 3); c.fill(); c.fillStyle = '#2a2f24'; c.fillRect(0, 0, 6, 8); c.fillStyle = '#c9b25a'; c.fillRect(20, 2, 6, 4); });
  make(scene, 'grenade', 10, 12, (c) => { c.fillStyle = '#3c4a32'; c.beginPath(); c.ellipse(5, 7, 5, 5, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#222'; c.fillRect(3, 0, 4, 3); c.fillStyle = '#6a7a58'; c.fillRect(3, 5, 2, 2); });
  make(scene, 'ammo', 30, 20, (c) => { c.fillStyle = '#3a4430'; rr(c, 0, 4, 30, 16, 2); c.fill(); c.fillStyle = '#5a6a48'; c.fillRect(2, 6, 26, 3); c.fillStyle = '#d4b04a'; c.font = 'bold 9px sans-serif'; c.fillText('AMMO', 3, 17); c.fillStyle = '#222'; c.fillRect(10, 0, 10, 5); });
  make(scene, 'vignette', 512, 288, (c, w, h) => { c.fillStyle = radial(c, w / 2, h / 2, w * 0.62, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0.15)'], [1, 'rgba(0,0,0,0.85)']]); c.fillRect(0, 0, w, h); });
  make(scene, 'dmgvig', 512, 288, (c, w, h) => { c.fillStyle = radial(c, w / 2, h / 2, w * 0.6, [[0, 'rgba(120,0,0,0)'], [0.55, 'rgba(140,0,0,0.12)'], [1, 'rgba(160,0,0,0.9)']]); c.fillRect(0, 0, w, h); });
  make(scene, 'scope', 1024, 1024, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = radial(c, w / 2, h / 2, 300, [[0, 'rgba(0,0,0,1)'], [0.93, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    c.beginPath(); c.arc(w / 2, h / 2, 300, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(w / 2 - 300, h / 2); c.lineTo(w / 2 - 18, h / 2); c.moveTo(w / 2 + 18, h / 2); c.lineTo(w / 2 + 300, h / 2);
    c.moveTo(w / 2, h / 2 - 300); c.lineTo(w / 2, h / 2 - 18); c.moveTo(w / 2, h / 2 + 18); c.lineTo(w / 2, h / 2 + 300); c.stroke();
    c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2 - 300, h / 2); c.lineTo(w / 2 - 120, h / 2); c.moveTo(w / 2 + 120, h / 2); c.lineTo(w / 2 + 300, h / 2); c.moveTo(w / 2, h / 2 + 120); c.lineTo(w / 2, h / 2 + 300); c.stroke();
    c.lineWidth = 1.5; for (let i = 1; i <= 4; i++) { c.beginPath(); c.moveTo(w / 2 - 8, h / 2 + i * 22); c.lineTo(w / 2 + 8, h / 2 + i * 22); c.stroke(); }
    c.fillStyle = 'rgba(255,40,30,0.95)'; c.beginPath(); c.arc(w / 2, h / 2, 2.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(40,60,70,0.6)'; c.lineWidth = 10; c.beginPath(); c.arc(w / 2, h / 2, 300, 0, Math.PI * 2); c.stroke();
  });

  // ---------- surfaces ----------
  const surf = (key, base, colors, seed, extra, img, amount = 0.62) => make(scene, key, 256, 256, (c, w, h) => {
    if (!(img && photo(scene, c, img, w, h, base, amount))) { c.fillStyle = base; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, colors, 1, seed); }
    if (extra) extra(c, w, h);
  });
  surf('tex_dirt', '#15110e', ['#211a15', '#0c0a08', '#2a221b'], 3, (c, w, h) => {
    if (scene.textures.exists('img_dirt')) return;
    const R = rng(4); for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(60,50,40,0.5)'; c.beginPath(); c.ellipse(R() * w, R() * h, 3 + R() * 6, 2 + R() * 3, 0, 0, 7); c.fill(); }
  }, 'img_dirt', 0.66);
  surf('tex_concrete', '#1f2326', ['#2e3336', '#1a1d1f', '#34393c'], 5, (c, w, h) => {
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    for (let x = 0; x < w; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    const R = rng(9); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; for (let i = 0; i < 8; i++) { let x = R() * w, y = R() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 30; y += R() * 14; c.lineTo(x, y); } c.stroke(); }
  }, 'img_concrete', 0.6);
  surf('tex_metal', '#1e2428', ['#283035', '#161b1e'], 6, (c, w, h) => {
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { c.strokeRect(x + 1, y + 1, 62, 62); c.fillStyle = 'rgba(255,255,255,0.08)'; for (const [dx, dy] of [[5, 5], [57, 5], [5, 57], [57, 57]]) c.fillRect(x + dx, y + dy, 3, 3); }
    c.fillStyle = 'rgba(255,255,255,0.03)'; for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 2, h);
  }, 'img_metal', 0.6);
  surf('tex_asphalt', '#121314', ['#202122', '#0e0f10', '#2a2b2c'], 8, null, 'img_asphalt', 0.86);
  surf('tex_wall', '#2a2c2e', ['#323537', '#202224'], 11, (c, w, h) => {
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2;
    for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); const off = (y / 32) % 2 ? 32 : 0; for (let x = off; x < w; x += 64) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 32); c.stroke(); } }
  }, 'img_wall', 0.55);
  surf('tex_rock', '#17171a', ['#222226', '#0d0d10'], 15, null, 'img_rock', 0.62);
  // ground top edges
  const edge = (key, base, tuft, seed) => make(scene, key, 256, 28, (c, w, h) => {
    c.fillStyle = lin(c, 0, 0, 0, h, [[0, base], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 6, w, h - 6);
    const R = rng(seed); c.fillStyle = tuft;
    for (let x = 0; x < w; x += 2) { const hh = 4 + R() * 7; c.fillRect(x, 8 - hh * 0.5, 2, hh); }
    c.fillRect(0, 6, w, 4);
  });
  edge('edge_night', '#1b252c', '#243139', 12);
  edge('edge_dawn', '#3a2c22', '#4a3828', 13);
  edge('edge_dusk', '#2a1c1c', '#3a2622', 14);
  make(scene, 'edge_concrete', 256, 12, (c, w) => { c.fillStyle = '#3c4246'; c.fillRect(0, 0, w, 5); c.fillStyle = '#1c2023'; c.fillRect(0, 5, w, 7); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, 0, w, 1); });
  make(scene, 'edge_metal', 128, 10, (c, w) => { c.fillStyle = '#39434a'; c.fillRect(0, 0, w, 4); c.fillStyle = '#20272c'; c.fillRect(0, 4, w, 6); for (let x = 0; x < w; x += 16) { c.fillStyle = '#56636b'; c.fillRect(x + 6, 1, 3, 2); } });

  // ---------- props ----------
  make(scene, 'crate', 64, 64, (c) => {
    c.fillStyle = '#3a3324'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#2b2519';
    for (let y = 0; y < 64; y += 16) c.fillRect(0, y, 64, 2);
    c.strokeStyle = '#1c1810'; c.lineWidth = 6; c.strokeRect(3, 3, 58, 58);
    c.beginPath(); c.moveTo(6, 6); c.lineTo(58, 58); c.stroke();
    c.strokeStyle = '#4c4330'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, 63, 63);
    c.fillStyle = 'rgba(220,200,140,0.35)'; c.font = 'bold 10px monospace'; c.fillText('7.62', 34, 20);
    overlay(scene, c, 'img_wood', 64, 64, 'overlay', 0.6);
  });
  make(scene, 'crate_metal', 64, 64, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, 64, [[0, '#3a464d'], [1, '#232b30']]); c.fillRect(0, 0, 64, 64);
    c.strokeStyle = '#151a1d'; c.lineWidth = 3; c.strokeRect(2, 2, 60, 60); c.fillStyle = '#151a1d';
    for (let x = 10; x < 60; x += 12) c.fillRect(x, 6, 3, 52);
    c.fillStyle = '#c9a43a'; c.fillRect(4, 26, 56, 8); c.fillStyle = '#151a1d'; for (let x = 4; x < 60; x += 10) { c.beginPath(); c.moveTo(x, 34); c.lineTo(x + 5, 26); c.lineTo(x + 9, 26); c.lineTo(x + 4, 34); c.fill(); }
    overlay(scene, c, 'img_metal', 64, 64, 'overlay', 0.5);
  });
  make(scene, 'barrel', 34, 48, (c) => {
    c.fillStyle = lin(c, 0, 0, 34, 0, [[0, '#5a120c'], [0.35, '#b02a1a'], [0.7, '#7a1a10'], [1, '#3a0a06']]); rr(c, 1, 0, 32, 48, 4); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(1, 10, 32, 3); c.fillRect(1, 34, 32, 3);
    c.fillStyle = '#f0c030'; c.beginPath(); c.moveTo(17, 16); c.lineTo(25, 30); c.lineTo(9, 30); c.closePath(); c.fill();
    c.fillStyle = '#111'; c.fillRect(16, 20, 2, 6); c.fillRect(16, 27, 2, 2);
    overlay(scene, c, 'img_rust', 34, 48, 'overlay', 0.55);
  });
  make(scene, 'sandbags', 110, 46, (c) => {
    const R = rng(21);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - (row === 2 ? 1 : 0); i++) {
      const x = i * 27 + (row % 2) * 13 + 2, y = 46 - (row + 1) * 15;
      c.fillStyle = ['#4a4232', '#3e3829', '#544a37'][Math.floor(R() * 3)];
      rr(c, x, y, 28, 16, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x + 4, y + 3, 18, 2);
    }
  });
  const container = (key, col, dark) => make(scene, key, 260, 120, (c, w, h) => {
    c.fillStyle = col; c.fillRect(0, 0, w, h);
    for (let x = 4; x < w - 4; x += 10) { c.fillStyle = dark; c.fillRect(x, 6, 4, h - 12); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x + 4, 6, 2, h - 12); }
    c.fillStyle = dark; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6); c.fillRect(0, 0, 6, h); c.fillRect(w - 6, 0, 6, h);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.font = 'bold 18px monospace'; c.fillText('KRV 4471', 20, 30);
    overlay(scene, c, 'img_corrugated', w, h, 'overlay', 0.55);
    overlay(scene, c, 'img_rust', w, h, 'soft-light', 0.35);
    const g = lin(c, 0, 0, 0, h, [[0, 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0.35)']]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  container('container_red', '#5a1f18', '#3a120d');
  container('container_blue', '#1d3448', '#10202e');
  container('container_green', '#2c3a22', '#1a2414');
  make(scene, 'jersey', 90, 40, (c) => {
    c.fillStyle = '#4a4c4a'; c.beginPath(); c.moveTo(0, 40); c.lineTo(10, 26); c.lineTo(22, 0); c.lineTo(68, 0); c.lineTo(80, 26); c.lineTo(90, 40); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(22, 0, 46, 3);
    for (let x = 0; x < 90; x += 18) { c.fillStyle = 'rgba(220,170,30,0.5)'; c.fillRect(x + 22, 14, 8, 6); }
  });
  make(scene, 'generator', 100, 70, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, 70, [[0, '#4b5a3c'], [1, '#2b3422']]); rr(c, 0, 8, 100, 62, 4); c.fill();
    c.fillStyle = '#1a2014'; for (let x = 10; x < 60; x += 8) c.fillRect(x, 20, 4, 30);
    c.fillStyle = '#111'; c.fillRect(68, 18, 24, 22); c.fillStyle = '#3cff7a'; c.fillRect(72, 22, 6, 4); c.fillStyle = '#ff3a2a'; c.fillRect(82, 22, 6, 4);
    c.fillStyle = '#222'; c.fillRect(12, 0, 10, 10); c.fillStyle = '#d4a83a'; c.fillRect(66, 46, 28, 10); c.fillStyle = '#111'; c.font = 'bold 8px monospace'; c.fillText('HV 440', 67, 54);
  });
  make(scene, 'terminal', 48, 76, (c) => {
    c.fillStyle = '#20272b'; rr(c, 0, 0, 48, 76, 3); c.fill();
    c.fillStyle = '#081016'; c.fillRect(5, 6, 38, 28); c.fillStyle = '#2bd4ff'; for (let y = 10; y < 32; y += 5) c.fillRect(8, y, 10 + (y * 7) % 22, 2);
    c.fillStyle = '#11171a'; c.fillRect(5, 40, 38, 18); c.fillStyle = '#ff3a2a'; c.fillRect(8, 62, 6, 6); c.fillStyle = '#2a3236'; for (let i = 0; i < 4; i++) c.fillRect(8 + i * 9, 43, 7, 5);
  });
  make(scene, 'server', 56, 110, (c) => {
    c.fillStyle = '#15191c'; c.fillRect(0, 0, 56, 110); c.fillStyle = '#232a2f';
    for (let y = 6; y < 104; y += 14) { c.fillRect(4, y, 48, 11); c.fillStyle = (y / 14) % 2 ? '#38ff8a' : '#2bd4ff'; c.fillRect(8, y + 4, 3, 3); c.fillRect(14, y + 4, 3, 3); c.fillStyle = '#0b0e10'; c.fillRect(24, y + 3, 24, 5); c.fillStyle = '#232a2f'; }
    c.strokeStyle = '#2f383e'; c.lineWidth = 2; c.strokeRect(1, 1, 54, 108);
  });
  make(scene, 'door', 50, 100, (c) => {
    c.fillStyle = '#2b3236'; c.fillRect(0, 0, 50, 100); c.fillStyle = '#1f2528'; c.fillRect(5, 5, 40, 90);
    c.fillStyle = '#394348'; c.fillRect(8, 10, 34, 30); c.fillStyle = '#111'; c.fillRect(36, 52, 6, 4);
    c.fillStyle = '#c9a43a'; c.fillRect(8, 80, 34, 6); c.fillStyle = '#111'; for (let x = 8; x < 42; x += 8) c.fillRect(x, 80, 4, 6);
  });
  make(scene, 'lamp', 60, 230, (c) => {
    c.fillStyle = '#14191c'; c.fillRect(27, 20, 6, 210); c.fillRect(10, 222, 40, 8);
    c.fillRect(6, 12, 30, 6); c.fillStyle = '#20272b'; rr(c, 0, 8, 22, 12, 3); c.fill(); c.fillStyle = '#ffe9b0'; c.fillRect(3, 18, 16, 3);
  });
  make(scene, 'tower', 160, 330, (c) => {
    c.strokeStyle = '#0c1115'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(30, 330); c.lineTo(50, 110); c.moveTo(130, 330); c.lineTo(110, 110); c.stroke();
    c.lineWidth = 3; for (let y = 140; y < 330; y += 50) { c.beginPath(); c.moveTo(48 - (y - 110) * 0.09, y); c.lineTo(112 + (y - 110) * 0.09, y + 45); c.moveTo(112 + (y - 110) * 0.09, y); c.lineTo(48 - (y - 110) * 0.09, y + 45); c.stroke(); }
    c.fillStyle = '#10161a'; c.fillRect(20, 70, 120, 44); c.fillStyle = '#0a0e11'; c.beginPath(); c.moveTo(10, 72); c.lineTo(80, 30); c.lineTo(150, 72); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,220,140,0.35)'; c.fillRect(32, 80, 96, 14);
  });
  make(scene, 'fence', 128, 110, (c, w, h) => {
    c.strokeStyle = 'rgba(120,140,150,0.35)'; c.lineWidth = 1;
    for (let x = -h; x < w + h; x += 9) { c.beginPath(); c.moveTo(x, 14); c.lineTo(x + h, 14 + h); c.moveTo(x + h, 14); c.lineTo(x, 14 + h); c.stroke(); }
    c.fillStyle = '#12171a'; c.fillRect(0, 10, 5, h - 10); c.fillRect(0, 14, w, 3);
    c.strokeStyle = 'rgba(150,160,170,0.5)'; c.lineWidth = 1.2; c.beginPath(); for (let x = 0; x < w; x += 6) c.arc(x, 7, 4, 0, Math.PI * 2); c.stroke();
  });
  make(scene, 'wreck', 200, 80, (c) => {
    c.fillStyle = '#1b1a19'; c.beginPath(); c.moveTo(8, 60); c.lineTo(20, 34); c.lineTo(62, 30); c.lineTo(86, 8); c.lineTo(140, 6); c.lineTo(164, 32); c.lineTo(196, 38); c.lineTo(194, 62); c.closePath(); c.fill();
    c.fillStyle = '#0b0a0a'; c.beginPath(); c.arc(48, 62, 16, 0, 7); c.arc(156, 62, 16, 0, 7); c.fill();
    c.fillStyle = '#3a2418'; c.fillRect(92, 14, 40, 16); c.fillStyle = 'rgba(255,120,40,0.25)'; c.fillRect(30, 40, 150, 6);
  });
  make(scene, 'tent', 220, 100, (c) => {
    c.fillStyle = '#2c3222'; c.beginPath(); c.moveTo(0, 100); c.lineTo(30, 20); c.lineTo(190, 20); c.lineTo(220, 100); c.closePath(); c.fill();
    c.fillStyle = '#1e2318'; c.beginPath(); c.moveTo(80, 100); c.lineTo(110, 30); c.lineTo(140, 100); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2; for (let x = 40; x < 190; x += 30) { c.beginPath(); c.moveTo(x, 20); c.lineTo(x - 10, 100); c.stroke(); }
  });
  make(scene, 'dish', 140, 180, (c) => {
    c.fillStyle = '#12161a'; c.fillRect(64, 70, 12, 110); c.fillRect(40, 170, 60, 10);
    c.save(); c.translate(70, 60); c.rotate(-0.5); c.fillStyle = '#2a3136'; c.beginPath(); c.ellipse(0, 0, 60, 22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1f23'; c.beginPath(); c.ellipse(0, -4, 50, 16, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#12161a'; c.fillRect(-2, -40, 4, 36); c.restore();
    c.fillStyle = '#ff3a2a'; c.fillRect(56, 18, 5, 5);
  });
  make(scene, 'tank_oil', 160, 150, (c) => {
    c.fillStyle = lin(c, 0, 0, 160, 0, [[0, '#2a2d2c'], [0.4, '#4a4e4c'], [1, '#1c1e1d']]); c.fillRect(0, 20, 160, 130);
    c.fillStyle = '#3a3e3c'; c.beginPath(); c.ellipse(80, 20, 80, 14, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 40; y < 150; y += 30) c.fillRect(0, y, 160, 3);
    c.fillStyle = '#c9a43a'; c.fillRect(40, 70, 80, 20); c.fillStyle = '#111'; c.font = 'bold 14px monospace'; c.fillText('FUEL', 62, 86);
  });
  make(scene, 'mg_nest', 120, 60, (c) => {
    c.fillStyle = '#16191b'; c.fillRect(50, 10, 12, 40); c.fillRect(20, 50, 70, 10);
    c.fillStyle = '#222a2e'; rr(c, 34, 6, 50, 14, 3); c.fill(); c.fillStyle = '#111'; c.fillRect(84, 9, 36, 6); c.fillRect(40, 20, 10, 14);
    c.fillStyle = '#2b3236'; c.fillRect(22, 0, 14, 26);
  });
  make(scene, 'flak', 150, 110, (c) => {
    c.fillStyle = '#1b2022'; c.fillRect(20, 80, 110, 30); c.fillStyle = '#2b3236'; rr(c, 40, 50, 70, 36, 6); c.fill();
    c.save(); c.translate(80, 60); c.rotate(-0.7); c.fillStyle = '#111'; c.fillRect(0, -10, 90, 7); c.fillRect(0, 3, 90, 7); c.restore();
  });

  // ---------- backgrounds ----------
  for (const [name, th] of Object.entries(THEMES)) buildThemeLayers(scene, name, th);

  // ---------- vehicles ----------
  buildVehicles(scene);
}

function ridge(R, w, base, amp, harmonics) {
  const ph = harmonics.map(() => R() * Math.PI * 2);
  return (x) => {
    let y = 0; harmonics.forEach((k, i) => { y += Math.sin((x / w) * Math.PI * 2 * k + ph[i]) / (i + 1); });
    return base - y * amp;
  };
}

function buildThemeLayers(scene, name, th) {
  make(scene, 'sky_' + name, 64, 512, (c, w, h) => {
    c.fillStyle = lin(c, 0, 0, 0, h, th.sky); c.fillRect(0, 0, w, h);
  });
  make(scene, 'stars_' + name, 1024, 400, (c, w, h) => {
    if (name === 'dawn') return;
    const R = rng(77); for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(220,230,255,${0.2 + R() * 0.7})`; const s = R() < 0.1 ? 2 : 1; c.fillRect(R() * w, R() * h * 0.8, s, s); }
  });
  make(scene, 'far_' + name, 1024, 360, (c, w, h) => {
    const R = rng(name.length * 13 + 1);
    const f = ridge(R, w, h * 0.45, 70, [1, 2, 3, 5, 8]);
    c.fillStyle = th.far; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 4) c.lineTo(x, f(x)); c.lineTo(w, h); c.closePath(); c.fill();
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = lin(c, 0, h * 0.3, 0, h, [[0, 'rgba(0,0,0,0)'], [1, th.glow]]); c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
  });
  make(scene, 'mid_' + name, 1024, 420, (c, w, h) => {
    const R = rng(name.length * 31 + 7);
    c.fillStyle = th.mid;
    if (name === 'night') {
      // compound silhouettes: warehouses, towers, antennas
      let x = 0; while (x < w) {
        const bw = 80 + R() * 160, bh = 80 + R() * 140; c.fillRect(x, h - bh, bw, bh);
        if (R() < 0.5) { c.fillRect(x + bw * 0.3, h - bh - 60, 4, 60); }
        c.fillStyle = 'rgba(255,200,120,0.35)'; for (let k = 0; k < 6; k++) if (R() < 0.4) c.fillRect(x + 8 + R() * (bw - 20), h - bh + 10 + R() * (bh - 30), 6, 4);
        c.fillStyle = th.mid; x += bw + 10 + R() * 50;
      }
    } else if (name === 'dawn') {
      // ruined city
      let x = 0; while (x < w) {
        const bw = 50 + R() * 110, bh = 90 + R() * 210; c.beginPath(); c.moveTo(x, h); c.lineTo(x, h - bh);
        const steps = 4; for (let k = 1; k <= steps; k++) c.lineTo(x + (bw * k) / steps, h - bh + (R() - 0.3) * 50); c.lineTo(x + bw, h); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 8; k++) c.fillRect(x + 6 + R() * (bw - 14), h - bh + 30 + R() * (bh - 40), 6, 8);
        c.fillStyle = th.mid; x += bw + R() * 30;
      }
    } else {
      // base: hangars, radar, comm towers
      let x = 0; while (x < w) {
        const t = R();
        if (t < 0.35) { const bw = 160 + R() * 100, bh = 80 + R() * 40; c.beginPath(); c.moveTo(x, h); c.lineTo(x, h - bh); c.quadraticCurveTo(x + bw / 2, h - bh - 70, x + bw, h - bh); c.lineTo(x + bw, h); c.fill(); x += bw + 20; }
        else if (t < 0.6) { c.fillRect(x + 20, h - 260, 6, 260); c.beginPath(); c.moveTo(x, h); c.lineTo(x + 23, h - 260); c.lineTo(x + 46, h); c.fill(); c.fillStyle = 'rgba(255,40,30,0.9)'; c.fillRect(x + 20, h - 266, 6, 6); c.fillStyle = th.mid; x += 70; }
        else { const bw = 70 + R() * 80, bh = 100 + R() * 120; c.fillRect(x, h - bh, bw, bh); c.fillStyle = 'rgba(255,180,120,0.25)'; for (let k = 0; k < 6; k++) if (R() < 0.5) c.fillRect(x + 6 + R() * (bw - 14), h - bh + 10 + R() * (bh - 20), 7, 4); c.fillStyle = th.mid; x += bw + 30; }
      }
    }
  });
  make(scene, 'near_' + name, 1024, 300, (c, w, h) => {
    const R = rng(name.length * 57 + 3);
    c.fillStyle = th.near;
    if (name === 'dusk' || name === 'night') {
      // pines + fence
      for (let x = 0; x < w; x += 18 + R() * 30) { const th2 = 90 + R() * 140; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 14, h - th2); c.lineTo(x + 28, h); c.fill(); }
    } else {
      for (let x = 0; x < w; x += 60 + R() * 90) { const bh = 30 + R() * 90; c.fillRect(x, h - bh, 40 + R() * 60, bh); if (R() < 0.4) { c.fillRect(x + 10, h - bh - 50, 3, 50); } }
    }
    c.fillRect(0, h - 30, w, 30);
  });
}

function buildVehicles(scene) {
  // Transport helicopter (ally), facing right
  make(scene, 'heli_ally', 340, 130, (c) => {
    const body = '#1a2126', hi = '#2c363d';
    c.fillStyle = body;
    // tail boom
    c.beginPath(); c.moveTo(20, 46); c.lineTo(130, 42); c.lineTo(130, 62); c.lineTo(20, 54); c.closePath(); c.fill();
    c.fillRect(6, 22, 16, 34); c.fillStyle = hi; c.fillRect(6, 22, 16, 3); c.fillStyle = body;
    // cabin
    c.beginPath(); c.moveTo(120, 36); c.lineTo(250, 30); c.quadraticCurveTo(318, 36, 326, 72); c.lineTo(318, 92); c.lineTo(130, 96); c.lineTo(118, 70); c.closePath(); c.fill();
    c.fillStyle = hi; c.beginPath(); c.moveTo(120, 36); c.lineTo(250, 30); c.quadraticCurveTo(300, 34, 314, 50); c.lineTo(250, 40); c.lineTo(122, 44); c.closePath(); c.fill();
    // cockpit glass
    c.fillStyle = 'rgba(120,200,230,0.55)'; c.beginPath(); c.moveTo(262, 40); c.quadraticCurveTo(306, 42, 318, 70); c.lineTo(270, 70); c.closePath(); c.fill();
    // open door (dark)
    c.fillStyle = '#05080a'; c.fillRect(160, 48, 70, 42); c.fillStyle = '#3a454c'; c.fillRect(158, 46, 74, 3);
    // engine housing
    c.fillStyle = '#20282d'; rr(c, 160, 18, 90, 18, 6); c.fill(); c.fillStyle = '#0c1013'; c.fillRect(200, 6, 8, 14);
    // skids
    c.fillStyle = '#0c1013'; c.fillRect(150, 96, 5, 22); c.fillRect(270, 92, 5, 26); c.fillRect(130, 116, 170, 5); c.fillRect(296, 112, 12, 5);
    // markings
    c.fillStyle = 'rgba(94,224,255,0.5)'; c.fillRect(132, 76, 20, 4); c.fillStyle = 'rgba(255,255,255,0.18)'; c.font = 'bold 12px monospace'; c.fillText('VIPER 21', 240, 86);
    c.fillStyle = '#ff3a2a'; c.fillRect(8, 24, 4, 4);
  });
  make(scene, 'heli_gunship', 360, 130, (c) => {
    const body = '#1d1617', hi = '#3a2b2a';
    c.fillStyle = body;
    c.beginPath(); c.moveTo(10, 50); c.lineTo(150, 44); c.lineTo(150, 64); c.lineTo(10, 58); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, 20); c.lineTo(26, 20); c.lineTo(34, 54); c.lineTo(6, 58); c.closePath(); c.fill();
    // fuselage (narrow, tandem)
    c.beginPath(); c.moveTo(140, 40); c.lineTo(250, 30); c.quadraticCurveTo(330, 38, 350, 70); c.lineTo(320, 86); c.lineTo(160, 82); c.closePath(); c.fill();
    c.fillStyle = hi; c.beginPath(); c.moveTo(140, 40); c.lineTo(250, 30); c.quadraticCurveTo(300, 32, 320, 46); c.lineTo(160, 48); c.closePath(); c.fill();
    // canopies
    c.fillStyle = 'rgba(255,110,60,0.5)'; c.beginPath(); c.moveTo(250, 34); c.quadraticCurveTo(290, 30, 300, 52); c.lineTo(252, 52); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(302, 44); c.quadraticCurveTo(334, 46, 342, 66); c.lineTo(304, 64); c.closePath(); c.fill();
    // stub wing + pods
    c.fillStyle = '#120d0e'; c.fillRect(190, 72, 80, 7); c.fillStyle = '#2b2223'; rr(c, 190, 80, 34, 14, 6); c.fill(); rr(c, 236, 80, 34, 14, 6); c.fill();
    c.fillStyle = '#0a0707'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(222, 84 + i * 4, 1.6, 0, 7); c.fill(); c.beginPath(); c.arc(268, 84 + i * 4, 1.6, 0, 7); c.fill(); }
    // chin gun
    c.fillStyle = '#0a0707'; c.fillRect(318, 86, 14, 10); c.fillRect(330, 90, 26, 4);
    c.fillStyle = '#20191a'; rr(c, 180, 16, 90, 18, 6); c.fill(); c.fillStyle = '#0a0707'; c.fillRect(220, 4, 8, 14);
    c.fillStyle = '#ff3a2a'; c.fillRect(4, 22, 4, 4); c.fillStyle = 'rgba(255,60,40,0.4)'; c.font = 'bold 12px monospace'; c.fillText('BLACK WIDOW', 160, 68);
  });
  make(scene, 'jet', 260, 70, (c) => {
    c.fillStyle = '#14181c';
    c.beginPath(); c.moveTo(0, 38); c.lineTo(30, 30); c.lineTo(200, 28); c.quadraticCurveTo(250, 30, 260, 38); c.quadraticCurveTo(250, 44, 200, 46); c.lineTo(30, 44); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(80, 32); c.lineTo(150, 30); c.lineTo(90, 4); c.lineTo(70, 4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(80, 42); c.lineTo(150, 44); c.lineTo(100, 66); c.lineTo(80, 66); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(4, 36); c.lineTo(34, 32); c.lineTo(16, 10); c.lineTo(4, 10); c.closePath(); c.fill();
    c.fillStyle = 'rgba(140,200,230,0.5)'; c.beginPath(); c.ellipse(205, 33, 20, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a3238'; c.fillRect(40, 36, 150, 3);
  });
  // main battle tank: hull (tracks) and a separate turret that rotates
  make(scene, 'tank_hull', 320, 90, (c) => {
    c.fillStyle = '#1b2527';
    c.beginPath(); c.moveTo(4, 50); c.lineTo(26, 24); c.lineTo(292, 24); c.lineTo(316, 50); c.closePath(); c.fill();
    c.fillStyle = '#2a383b'; c.fillRect(30, 24, 260, 5);
    c.fillStyle = '#0b1011'; rr(c, 6, 48, 308, 38, 18); c.fill();
    c.fillStyle = '#1c2526'; for (let x = 32; x < 300; x += 37) { c.beginPath(); c.arc(x, 67, 13, 0, 7); c.fill(); }
    c.fillStyle = '#2f3b3e'; for (let x = 32; x < 300; x += 37) { c.beginPath(); c.arc(x, 67, 5, 0, 7); c.fill(); }
    c.strokeStyle = '#151c1d'; c.lineWidth = 3; c.setLineDash([6, 5]); rr(c, 6, 48, 308, 38, 18); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 50; x < 280; x += 40) c.fillRect(x, 32, 24, 10);
    c.fillStyle = 'rgba(255,230,170,0.75)'; c.fillRect(306, 36, 8, 5);
  });
  make(scene, 'tank_turret', 230, 60, (c) => {
    c.fillStyle = '#1f2c2f'; c.beginPath(); c.moveTo(6, 52); c.lineTo(20, 14); c.lineTo(120, 10); c.lineTo(138, 30); c.lineTo(132, 54); c.closePath(); c.fill();
    c.fillStyle = '#2d3d41'; c.fillRect(24, 12, 96, 6);
    c.fillStyle = '#121a1c'; c.fillRect(128, 25, 96, 10); c.fillRect(214, 22, 16, 16);
    c.fillStyle = '#121a1c'; c.fillRect(48, 2, 26, 10); c.fillRect(58, 0, 3, 4);
    c.fillStyle = 'rgba(94,224,255,0.35)'; c.fillRect(30, 30, 22, 5);
  });
  make(scene, 'bunker', 200, 110, (c) => {
    c.fillStyle = '#2c2d2a'; c.beginPath(); c.moveTo(0, 110); c.lineTo(12, 30); c.quadraticCurveTo(100, -6, 188, 30); c.lineTo(200, 110); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(20, 30, 160, 4);
    c.fillStyle = '#070707'; c.fillRect(40, 54, 120, 16);
    c.fillStyle = '#3a3b37'; for (let x = 0; x < 200; x += 22) c.fillRect(x, 96, 18, 14);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 80, 200, 4);
  });
  make(scene, 'sam', 160, 120, (c) => {
    c.fillStyle = '#20262a'; c.fillRect(20, 90, 120, 30); c.fillStyle = '#0c0f11'; for (let x = 34; x < 140; x += 30) { c.beginPath(); c.arc(x, 118, 10, 0, 7); c.fill(); }
    c.save(); c.translate(80, 86); c.rotate(-0.75);
    c.fillStyle = '#2b3338'; c.fillRect(0, -18, 90, 36); c.fillStyle = '#d4dde2';
    for (let i = 0; i < 3; i++) { c.fillRect(88, -14 + i * 11, 14, 7); }
    c.restore(); c.fillStyle = '#ff3a2a'; c.fillRect(24, 92, 6, 6);
  });
  make(scene, 'bomber', 520, 150, (c) => {
    c.fillStyle = '#16131a';
    c.beginPath(); c.moveTo(0, 74); c.lineTo(60, 56); c.lineTo(430, 52); c.quadraticCurveTo(510, 58, 520, 76); c.quadraticCurveTo(510, 92, 430, 96); c.lineTo(60, 94); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(150, 60); c.lineTo(330, 58); c.lineTo(190, 2); c.lineTo(150, 2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(150, 90); c.lineTo(330, 92); c.lineTo(200, 148); c.lineTo(160, 148); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(10, 72); c.lineTo(70, 62); c.lineTo(40, 22); c.lineTo(14, 22); c.closePath(); c.fill();
    c.fillStyle = '#2a2430'; for (const [x, y] of [[200, 24], [200, 126], [250, 40], [250, 110]]) { rr(c, x, y - 7, 60, 14, 7); c.fill(); }
    c.fillStyle = 'rgba(255,90,60,0.5)'; c.beginPath(); c.ellipse(470, 70, 26, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,60,40,0.35)'; c.font = 'bold 14px monospace'; c.fillText('VALKYRIE', 300, 80);
  });
  make(scene, 'parachute', 120, 70, (c) => {
    c.fillStyle = '#4a5a3a'; c.beginPath(); c.moveTo(0, 30); c.quadraticCurveTo(60, -24, 120, 30); c.quadraticCurveTo(60, 14, 0, 30); c.fill();
    c.strokeStyle = 'rgba(30,30,30,0.9)'; c.lineWidth = 1.2; for (const x of [4, 30, 60, 90, 116]) { c.beginPath(); c.moveTo(x, 28); c.lineTo(60, 70); c.stroke(); }
  });
  make(scene, 'wrench', 34, 34, (c) => {
    c.fillStyle = '#2a3a2a'; rr(c, 0, 0, 34, 34, 6); c.fill(); c.strokeStyle = '#7cff9a'; c.lineWidth = 2; rr(c, 1, 1, 32, 32, 6); c.stroke();
    c.fillStyle = '#7cff9a'; c.fillRect(14, 8, 6, 18); c.fillRect(9, 12, 16, 6);
  });
  make(scene, 'grave', 50, 80, (c) => {
    c.fillStyle = '#3a3c3e'; rr(c, 4, 10, 42, 70, 18); c.fill(); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(18, 26, 14, 4); c.fillRect(23, 18, 4, 22);
  });
  make(scene, 'rotor', 360, 16, (c, w, h) => {
    c.fillStyle = lin(c, 0, 0, w, 0, [[0, 'rgba(30,36,40,0)'], [0.1, 'rgba(30,36,40,0.55)'], [0.5, 'rgba(20,24,28,0.8)'], [0.9, 'rgba(30,36,40,0.55)'], [1, 'rgba(30,36,40,0)']]);
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2 - 2, 0, 0, Math.PI * 2); c.fill();
  });
  make(scene, 'tailrotor', 44, 44, (c) => { c.fillStyle = 'rgba(30,36,40,0.6)'; c.beginPath(); c.arc(22, 22, 21, 0, 7); c.fill(); c.fillStyle = '#0a0d10'; c.beginPath(); c.arc(22, 22, 4, 0, 7); c.fill(); });
  // APC
  make(scene, 'apc', 300, 120, (c) => {
    c.fillStyle = '#232a22';
    c.beginPath(); c.moveTo(10, 90); c.lineTo(20, 46); c.lineTo(220, 40); c.lineTo(290, 64); c.lineTo(292, 92); c.closePath(); c.fill();
    c.fillStyle = '#323b30'; c.beginPath(); c.moveTo(20, 46); c.lineTo(220, 40); c.lineTo(290, 64); c.lineTo(230, 54); c.lineTo(22, 58); c.closePath(); c.fill();
    c.fillStyle = '#151a14'; c.fillRect(10, 86, 282, 12);
    c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 40; x < 220; x += 45) c.fillRect(x, 60, 30, 20);
    c.fillStyle = '#c9a43a'; c.fillRect(250, 70, 14, 6); c.fillStyle = 'rgba(255,240,200,0.8)'; c.fillRect(284, 70, 6, 6);
    c.fillStyle = '#ff3a2a'; c.fillRect(30, 62, 10, 6);
  });
  make(scene, 'apc_turret', 150, 40, (c) => {
    c.fillStyle = '#2a3228'; rr(c, 0, 8, 70, 28, 8); c.fill(); c.fillStyle = '#111510'; c.fillRect(64, 16, 86, 9); c.fillRect(140, 14, 10, 13); c.fillStyle = '#3a4436'; c.fillRect(8, 8, 50, 5);
  });
  make(scene, 'wheel', 40, 40, (c) => { c.fillStyle = '#0a0b0a'; c.beginPath(); c.arc(20, 20, 19, 0, 7); c.fill(); c.fillStyle = '#2a2e2a'; c.beginPath(); c.arc(20, 20, 9, 0, 7); c.fill(); c.fillStyle = '#0a0b0a'; for (let i = 0; i < 5; i++) { const a = i * 1.256; c.fillRect(20 + Math.cos(a) * 5 - 1.5, 20 + Math.sin(a) * 5 - 1.5, 3, 3); } c.strokeStyle = '#1c1e1c'; c.lineWidth = 3; c.setLineDash([4, 3]); c.beginPath(); c.arc(20, 20, 17, 0, 7); c.stroke(); });
  // technical truck
  make(scene, 'truck', 240, 100, (c) => {
    c.fillStyle = '#2d2a22';
    c.beginPath(); c.moveTo(4, 74); c.lineTo(6, 46); c.lineTo(130, 46); c.lineTo(140, 20); c.lineTo(190, 18); c.lineTo(214, 46); c.lineTo(236, 50); c.lineTo(236, 76); c.closePath(); c.fill();
    c.fillStyle = 'rgba(150,190,210,0.45)'; c.beginPath(); c.moveTo(146, 26); c.lineTo(186, 24); c.lineTo(204, 44); c.lineTo(146, 44); c.closePath(); c.fill();
    c.fillStyle = '#1a1814'; c.fillRect(4, 72, 232, 8); c.fillStyle = '#3d392e'; c.fillRect(6, 46, 124, 5);
    c.fillStyle = 'rgba(255,240,200,0.8)'; c.fillRect(230, 54, 6, 6);
  });
  // ally tank (friendly armor)
  make(scene, 'tank', 340, 130, (c) => {
    c.fillStyle = '#1d2a2c';
    c.beginPath(); c.moveTo(10, 100); c.lineTo(30, 70); c.lineTo(310, 70); c.lineTo(330, 100); c.closePath(); c.fill();
    c.fillStyle = '#0b1011'; rr(c, 14, 96, 312, 30, 14); c.fill(); c.fillStyle = '#1c2526'; for (let x = 36; x < 320; x += 38) { c.beginPath(); c.arc(x, 111, 11, 0, 7); c.fill(); }
    c.fillStyle = '#26363a'; c.beginPath(); c.moveTo(100, 70); c.lineTo(120, 40); c.lineTo(230, 38); c.lineTo(250, 70); c.closePath(); c.fill();
    c.fillStyle = '#0e1415'; c.fillRect(240, 48, 100, 9); c.fillStyle = 'rgba(94,224,255,0.4)'; c.fillRect(130, 50, 20, 4);
  });
}
