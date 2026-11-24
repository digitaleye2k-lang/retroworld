// Hand-designed vehicle illustrations, painted procedurally on canvases (no Phaser dependency).
// Silhouettes follow the reference sheets (Abrams, Leopard, T-14, LAV-25, HEMTT, MRAP, Wildcat, Hind,
// Tiger, F-22, Typhoon, A-10, C-130) but are drawn in the game's own style: clean ink outline,
// top-lit gradient shading, soft camo, panel lines, rim light. Everything faces RIGHT.
// Each entry produces { canvas, meta }; meta uses fractions of the canvas so the game can split
// turreted vehicles into hull / turret / barrel frames (see VehicleArt.js).

export const RES = 2; // canvases are painted at 2x and drawn downscaled for crisp edges

// ---------------------------------------------------------------- colour helpers
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb(a) { return `rgb(${a.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`; }
// f > 0 lightens toward white, f < 0 darkens toward black
export function shade(h, f) { const c = hexRgb(h); return rgb(c.map((v) => (f >= 0 ? v + (255 - v) * f : v * (1 + f)))); }
function rgba(h, a) { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const P = (d) => new Path2D(d);
const INK = '#14181a';

// ---------------------------------------------------------------- drawing kit
function kit(c) {
  const k = {
    // filled, top-lit, outlined body part. y0/y1: vertical extent for the light gradient
    part(path, base, y0, y1, o = {}) {
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, shade(base, o.top ?? 0.16));
      g.addColorStop(0.45, base);
      g.addColorStop(1, shade(base, o.bottom ?? -0.32));
      c.fillStyle = g; c.fill(path);
      if (o.camo) k.camo(path, o.camo, o.box || [0, y0, 600, y1 - y0], o.seed || 1, o.camoN || 10, o.camoS || 26);
      if (o.camo) { // re-apply shading over the camo
        const g2 = c.createLinearGradient(0, y0, 0, y1);
        g2.addColorStop(0, 'rgba(255,255,255,0.10)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,0.28)');
        c.save(); c.clip(path); c.fillStyle = g2; c.fill(path); c.restore();
      }
      if (o.rim !== false) k.rim(path, o.rimA ?? 0.32);
      if (o.ink !== false) k.ink(path, o.inkW ?? 1.6);
    },
    ink(path, w = 1.6) { c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = w; c.stroke(path); },
    // light catching the upper edges: stroke the path shifted down, clipped inside
    rim(path, a = 0.3) {
      c.save(); c.clip(path); c.translate(0, 1.3); c.strokeStyle = `rgba(255,248,230,${a})`; c.lineWidth = 1.4; c.stroke(path); c.restore();
    },
    camo(path, colors, box, seed, n, size) {
      const R = rng(seed); c.save(); c.clip(path);
      for (let i = 0; i < n; i++) {
        const cx = box[0] + R() * box[2], cy = box[1] + R() * box[3]; const r = size * (0.5 + R() * 0.8);
        c.fillStyle = colors[i % colors.length]; c.beginPath();
        const pts = 7; const arr = [];
        for (let j = 0; j < pts; j++) { const a = (j / pts) * Math.PI * 2; const rr = r * (0.55 + R() * 0.6); arr.push([cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr * 0.75]); }
        c.moveTo((arr[0][0] + arr[pts - 1][0]) / 2, (arr[0][1] + arr[pts - 1][1]) / 2);
        for (let j = 0; j < pts; j++) { const p = arr[j], q = arr[(j + 1) % pts]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
        c.fill();
      }
      c.restore();
    },
    // engraved panel line: dark line with a faint highlight beneath
    seam(pts, a = 0.5) {
      c.lineCap = 'round';
      for (const [col, dy] of [[`rgba(10,12,12,${a})`, 0], [`rgba(255,250,235,${a * 0.3})`, 0.9]]) {
        c.strokeStyle = col; c.lineWidth = 0.9; c.beginPath();
        for (let i = 0; i < pts.length; i += 2) { if (i === 0) c.moveTo(pts[i], pts[i + 1] + dy); else c.lineTo(pts[i], pts[i + 1] + dy); }
        c.stroke();
      }
    },
    line(x0, y0, x1, y1, col = INK, w = 1.2) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); },
    rect(x, y, w, h, base, o = {}) { k.part(P(`M${x} ${y}h${w}v${h}h${-w}Z`), base, y, y + h, o); },
    rrect(x, y, w, h, r, base, o = {}) {
      const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
      k.part(p, base, y, y + h, o); return p;
    },
    ellipse(x, y, rx, ry, base, o = {}) { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); k.part(p, base, y - ry, y + ry, o); return p; },
    // tank road wheel: rubber tyre, dished steel disc, hub, bolts
    roadWheel(x, y, r, base) {
      const t = new Path2D(); t.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = '#1a1d1d'; c.fill(t); k.ink(t, 1.4);
      const d = new Path2D(); d.arc(x, y, r * 0.78, 0, Math.PI * 2);
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 0.8);
      g.addColorStop(0, shade(base, 0.25)); g.addColorStop(0.7, base); g.addColorStop(1, shade(base, -0.45));
      c.fillStyle = g; c.fill(d);
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.8; c.beginPath(); c.arc(x, y, r * 0.55, 0, Math.PI * 2); c.stroke();
      c.fillStyle = shade(base, -0.5); c.beginPath(); c.arc(x, y, r * 0.24, 0, Math.PI * 2); c.fill();
      c.fillStyle = shade(base, 0.35); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.fillRect(x + Math.cos(a) * r * 0.38 - 0.5, y + Math.sin(a) * r * 0.38 - 0.5, 1, 1); }
    },
    // drive sprocket with teeth
    sprocket(x, y, r, base) {
      c.fillStyle = INK; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.2, 0, 7); c.fill(); }
      k.roadWheel(x, y, r * 0.92, base);
    },
    // track loop around the running gear (x0..x1, top & bottom runs), with link texture
    track(x0, x1, yT, yB, r) {
      const p = new Path2D(); const h = yB - yT;
      p.moveTo(x0 + r, yT); p.lineTo(x1 - r, yT); p.arcTo(x1, yT, x1, yT + r, r); p.lineTo(x1, yB - r); p.arcTo(x1, yB, x1 - r, yB, r);
      p.lineTo(x0 + r, yB); p.arcTo(x0, yB, x0, yB - r, r); p.lineTo(x0, yT + r); p.arcTo(x0, yT, x0 + r, yT, r); p.closePath();
      c.fillStyle = '#202423'; c.fill(p);
      c.save(); c.clip(p);
      c.fillStyle = '#121515'; c.fillRect(x0 + 3, yT + 3, x1 - x0 - 6, h - 6);
      c.fillStyle = 'rgba(160,160,150,0.22)'; for (let x = x0; x < x1; x += 4.2) { c.fillRect(x, yB - 3.2, 2.2, 2.4); c.fillRect(x + 1, yT + 0.8, 2.2, 1.6); }
      c.restore(); k.ink(p, 1.6);
    },
    tyre(x, y, r, base = '#3a3d3a') {
      const t = new Path2D(); t.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#191b1b'; c.fill(t);
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; k.line(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98, 'rgba(255,255,255,0.10)', 1); }
      k.ink(t, 1.5);
      const g = c.createRadialGradient(x - r * 0.2, y - r * 0.25, 1, x, y, r * 0.6);
      g.addColorStop(0, shade(base, 0.3)); g.addColorStop(1, shade(base, -0.4));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.56, 0, 7); c.fill();
      c.fillStyle = shade(base, -0.55); c.beginPath(); c.arc(x, y, r * 0.2, 0, 7); c.fill();
      c.fillStyle = shade(base, 0.4); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.fillRect(x + Math.cos(a) * r * 0.38 - 0.6, y + Math.sin(a) * r * 0.38 - 0.6, 1.2, 1.2); }
    },
    glass(path, y0, y1) {
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, '#b9dbe6'); g.addColorStop(0.35, '#5f8797'); g.addColorStop(1, '#1d313a');
      c.fillStyle = g; c.fill(path);
      c.save(); c.clip(path); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, y0 + (y1 - y0) * 0.35); c.lineTo(600, y0 - 20); c.stroke(); c.restore();
      k.ink(path, 1.4);
    },
    // soft contact shadow / ambient occlusion band
    ao(x, y, w, h, a = 0.35) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y, w, h); },
    light(x, y, r, col) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); },
    // gun barrel along +x from (x0,y) to x1 with taper, sleeve bands and muzzle
    barrel(x0, x1, y, t0, t1, base, o = {}) {
      const p = P(`M${x0} ${y - t0} L${x1} ${y - t1} L${x1} ${y + t1} L${x0} ${y + t0} Z`);
      k.part(p, base, y - t0, y + t0, { top: 0.35, bottom: -0.45, rimA: 0.4 });
      for (const bx of o.bands || []) { const tt = t0 + (t1 - t0) * ((bx - x0) / (x1 - x0)); k.line(bx, y - tt + 0.3, bx, y + tt - 0.3, 'rgba(0,0,0,0.55)', 0.9); }
      if (o.evac) { const ex = o.evac, tt = t0 + (t1 - t0) * ((ex - x0) / (x1 - x0)); k.rrect(ex - 7, y - tt - 1.6, 14, (tt + 1.6) * 2, 2.5, base, { top: 0.35, bottom: -0.45 }); }
      if (o.muzzle !== false) k.rect(x1 - 5, y - t1 - 0.8, 6, (t1 + 0.8) * 2, shade(base, -0.15), { top: 0.3, bottom: -0.5 });
    },
  };
  return k;
}

// ---------------------------------------------------------------- palettes
const PAL = {
  desert: { base: '#ab9670', camo: ['#c2ad84', '#8c7752', '#a0895f'], metal: '#857356', dark: '#5e5240' },
  nato: { base: '#56603f', camo: ['#3b3628', '#25281f', '#6a6b47'], metal: '#4a5236', dark: '#2e3324' },
  natoB: { base: '#69684a', camo: ['#4a4f35', '#2d2e24', '#8a7f58'], metal: '#55553c', dark: '#33342a' },
  enemy: { base: '#5b5c45', camo: ['#7b7552', '#3c3e2d', '#2a2b22'], metal: '#4b4c39', dark: '#2c2d24' },
  heavy: { base: '#424541', camo: ['#2f312e', '#55574f', '#383a35'], metal: '#3a3c38', dark: '#222321', accent: '#9b2b22' },
  rust: { base: '#9a8562', camo: ['#7d6243', '#b39b72', '#6a5a40'], metal: '#7a6a4e', dark: '#4a3f30' },
  navy: { base: '#5c6873', camo: ['#4b5660', '#6d7a85'], metal: '#4d5761', dark: '#30373e' },
  hind: { base: '#5f6844', camo: ['#7d6d4a', '#414a30', '#8a835c'], metal: '#4d553a', dark: '#2e3324' },
  tiger: { base: '#8f7f5d', camo: ['#62573f', '#b09d75', '#4b4333'], metal: '#6e6248', dark: '#3d372b' },
  jet: { base: '#8d969d', camo: ['#7a838a', '#9fa7ad'], metal: '#6e767c', dark: '#454b50' },
  jetEnemy: { base: '#50565c', camo: ['#3f4449', '#5e646a'], metal: '#43484d', dark: '#2a2e31', accent: '#a32a22' },
  warthog: { base: '#6d7468', camo: ['#5a6157', '#7d8478'], metal: '#5a6157', dark: '#3a3f37' },
  bomber: { base: '#3d4146', camo: ['#33363a', '#474b50'], metal: '#34383c', dark: '#1f2225', accent: '#a32a22' },
};

// ================================================================ TANKS
// Layout rule for turreted vehicles: everything above `cut` belongs to the turret, nothing of
// the hull pokes above it; the barrel occupies x >= barrelX in the turret rows.

function abrams(c, k, pal) {
  // running gear
  k.track(14, 254, 84, 110, 12);
  for (let i = 0; i < 7; i++) k.roadWheel(46 + i * 28, 99, 9.5, pal.metal);
  k.sprocket(25, 96, 8.5, pal.metal); k.roadWheel(243, 95, 7.5, pal.metal);
  // hull (front glacis at right)
  const hull = P('M8 67 L20 60 L236 60 L268 71 L264 79 L248 84 L16 84 L8 78 Z');
  k.part(hull, pal.base, 60, 84, { camo: pal.camo, seed: 3, box: [0, 58, 270, 30], camoN: 12 });
  k.seam([236, 61, 262, 71]); k.light(262, 74, 3.2, 'rgba(255,225,160,0.9)');
  // side skirts
  const sk = P('M14 63 L238 63 L248 68 L246 91 L22 91 L14 86 Z');
  k.part(sk, pal.base, 63, 91, { camo: pal.camo, seed: 4, box: [0, 60, 260, 34], camoN: 14 });
  for (let x = 46; x < 240; x += 32) k.seam([x, 64, x, 90], 0.42);
  k.seam([16, 85, 246, 85], 0.3);
  k.ao(14, 91, 236, 3, 0.4);
  // turret (above y = 60)
  const bus = P('M5 37 L32 36 L32 57 L8 57 Z'); c.fillStyle = '#2b2a24'; c.fill(bus);
  for (let x = 9; x < 32; x += 4.5) k.line(x, 37, x, 57, 'rgba(160,150,120,0.6)', 0.8);
  k.line(7, 47, 32, 47, 'rgba(160,150,120,0.6)', 0.8); k.ink(bus, 1.3);
  k.rrect(8, 29, 15, 9, 3, '#6f6a4c'); k.rrect(19, 31, 11, 6, 2, '#5d5a42');
  const tur = P('M26 58 L28 41 L44 31 L166 29 L198 38 L205 46 L199 56 L188 59 Z');
  k.part(tur, pal.base, 29, 59, { camo: pal.camo, seed: 5, box: [20, 30, 190, 30], camoN: 9, camoS: 20 });
  k.part(P('M44 31 L166 29 L173 32 L48 35 Z'), shade(pal.base, 0.16), 29, 35, { ink: false, rim: false });
  k.part(P('M166 29 L198 38 L205 46 L171 37 Z'), shade(pal.base, 0.08), 29, 46, { ink: false });
  k.seam([56, 45, 168, 43]); k.seam([110, 33, 112, 57], 0.35); k.seam([150, 31, 152, 57], 0.35);
  k.ao(30, 55, 170, 4, 0.45);
  k.rrect(186, 39, 18, 13, 2, pal.metal); // mantlet
  // roof kit: CITV, CROWS remote weapon, loader's MG, antennas
  k.line(22, 37, 17, 2, INK, 1.1); k.line(31, 37, 29, 6, INK, 1.1);
  k.rrect(80, 19, 13, 11, 2, pal.metal); k.rect(82, 21, 9, 3, '#24343a', { rim: false });
  k.rect(118, 23, 18, 7, pal.dark); k.rrect(121, 16, 12, 8, 2, pal.metal); k.rect(123, 18, 5, 3, '#24343a', { rim: false });
  k.rect(133, 20.5, 26, 2.2, '#222', { rim: false }); k.rect(152, 19.8, 3, 3.6, '#222', { rim: false });
  k.rect(60, 26, 12, 5, pal.dark); k.rect(66, 25, 18, 1.8, '#222', { rim: false });
  // 120mm gun with thermal sleeve
  k.barrel(204, 296, 45, 3.4, 2.6, pal.base, { bands: [222, 240, 258, 276] });
  k.rect(284, 40.5, 4, 2.4, pal.dark, { rim: false });
  return { cut: 60, barrelX: 204, tipX: 297, tipY: 45, pivotX: 115, pivotY: 48 };
}

function leopard(c, k, pal, variant = 0) {
  k.track(14, 254, 84, 110, 12);
  for (let i = 0; i < 7; i++) k.roadWheel(44 + i * 28.5, 99, 9.5, pal.metal);
  k.sprocket(24, 95, 8.5, pal.metal); k.roadWheel(244, 95, 7.5, pal.metal);
  const hull = P('M10 66 L18 61 L232 61 L266 70 L262 80 L246 84 L16 84 L10 78 Z');
  k.part(hull, pal.base, 61, 84, { camo: pal.camo, seed: 11 + variant, box: [0, 58, 270, 30] });
  const sk = P('M14 64 L234 64 L248 69 L246 90 L20 90 L14 85 Z');
  k.part(sk, pal.base, 64, 90, { camo: pal.camo, seed: 12 + variant, box: [0, 60, 260, 34], camoN: 14 });
  for (let x = 40; x < 240; x += 25) k.seam([x, 65, x, 89], 0.38);
  k.ao(14, 90, 236, 3, 0.4);
  // turret: Leopard 2A7 arrow-head front / Challenger flat sloped front
  const tur = variant === 0
    ? P('M30 59 L30 40 L52 31 L150 30 L198 44 L186 54 L176 59 Z')
    : P('M28 59 L30 38 L50 30 L170 30 L198 42 L198 52 L186 59 Z');
  k.part(tur, pal.base, 30, 59, { camo: pal.camo, seed: 13 + variant, box: [20, 30, 190, 30], camoN: 9, camoS: 20 });
  k.part(variant === 0 ? P('M52 31 L150 30 L160 33 L54 34 Z') : P('M50 30 L170 30 L177 33 L52 33 Z'), shade(pal.base, 0.16), 30, 34, { ink: false, rim: false });
  k.seam([70, 44, 150, 43]); k.ao(30, 56, 160, 3, 0.45);
  k.rect(14, 38, 18, 18, pal.dark); for (let x = 16; x < 32; x += 4) k.line(x, 38, x, 56, 'rgba(0,0,0,0.5)', 0.7);
  k.rrect(70, 20, 12, 11, 2, pal.metal); k.rect(72, 22, 8, 3, '#24343a', { rim: false });
  k.rrect(112, 22, 14, 9, 2, pal.metal); k.rect(114, 24, 6, 3, '#24343a', { rim: false });
  k.line(26, 38, 22, 4, INK, 1.1);
  k.rrect(180, 42, 14, 10, 2, pal.metal);
  k.barrel(192, 296, 46, 3.2, 2.5, pal.base, variant === 0 ? {} : { bands: [216, 240, 264] });
  return { cut: 61, barrelX: 192, tipX: 297, tipY: 46, pivotX: 112, pivotY: 48 };
}

function t14(c, k, pal) {
  k.track(14, 262, 90, 116, 12);
  for (let i = 0; i < 7; i++) k.roadWheel(44 + i * 30, 105, 10, pal.metal);
  k.sprocket(24, 101, 8.5, pal.metal); k.roadWheel(252, 101, 7.5, pal.metal);
  const hull = P('M6 72 L20 64 L240 64 L276 76 L272 84 L254 90 L14 90 L6 82 Z');
  k.part(hull, pal.base, 64, 90, { camo: pal.camo, seed: 21, box: [0, 60, 280, 34] });
  k.light(270, 79, 3, 'rgba(255,200,140,0.8)');
  const sk = P('M12 67 L244 67 L258 73 L256 96 L18 96 L12 90 Z');
  k.part(sk, pal.base, 67, 96, { camo: pal.camo, seed: 22, box: [0, 64, 260, 36], camoN: 14 });
  // slat grilles over the rear third and panel seams forward
  c.save(); c.clip(sk); for (let x = 16; x < 92; x += 3.4) k.line(x, 68, x, 95, 'rgba(0,0,0,0.35)', 0.9); c.restore();
  for (let x = 96; x < 250; x += 26) k.seam([x, 68, x, 95], 0.4);
  k.seam([14, 80, 256, 80], 0.3); k.ao(14, 96, 244, 3, 0.4);
  // unmanned angular turret (above y = 64)
  const tur = P('M58 63 L62 44 L90 33 L178 32 L208 44 L210 57 L198 63 Z');
  k.part(tur, pal.base, 32, 63, { camo: pal.camo, seed: 23, box: [50, 34, 170, 32], camoN: 8, camoS: 18 });
  k.part(P('M90 33 L178 32 L187 36 L94 37 Z'), shade(pal.base, 0.15), 32, 37, { ink: false, rim: false });
  k.part(P('M178 32 L208 44 L210 52 L185 40 Z'), shade(pal.base, 0.06), 32, 52, { ink: false });
  k.seam([68, 50, 198, 48]); k.seam([130, 34, 132, 62], 0.35); k.ao(62, 60, 140, 3, 0.45);
  // sensor masts and the remote MG
  k.rrect(110, 22, 14, 11, 2, pal.metal); k.rect(112, 24, 10, 3.5, '#3a1e1e', { rim: false }); k.light(117, 25.5, 3, 'rgba(255,60,40,0.6)');
  k.rrect(150, 25, 12, 8, 2, pal.metal); k.rect(160, 27, 16, 2, '#222', { rim: false });
  k.line(76, 42, 72, 4, INK, 1.1); k.rect(64, 40, 18, 6, pal.dark);
  k.rrect(196, 46, 14, 10, 2, pal.metal);
  k.barrel(208, 297, 51, 3.0, 2.3, pal.base, { bands: [232, 262] });
  return { cut: 64, barrelX: 208, tipX: 298, tipY: 51, pivotX: 130, pivotY: 52 };
}

function mammoth(c, k, pal) {
  // super-heavy MAMMOTH: ERA-tiled skirts, wide turret, thick gun with bore evacuator, red stripe
  k.track(12, 268, 90, 118, 13);
  for (let i = 0; i < 8; i++) k.roadWheel(40 + i * 28, 106, 10, pal.metal);
  k.sprocket(22, 102, 9, pal.metal); k.roadWheel(258, 102, 8, pal.metal);
  const hull = P('M4 72 L18 62 L244 62 L282 76 L278 86 L258 92 L12 92 L4 84 Z');
  k.part(hull, pal.base, 62, 92, { camo: pal.camo, seed: 31, box: [0, 60, 290, 34] });
  const sk = P('M10 66 L248 66 L264 72 L262 98 L16 98 L10 92 Z');
  k.part(sk, pal.base, 66, 98, { camo: pal.camo, seed: 32, box: [0, 62, 270, 38] });
  // explosive reactive armour bricks
  for (let row = 0; row < 2; row++) for (let x = 16; x < 252; x += 16) {
    const p = P(`M${x} ${70 + row * 13} h14 v11 h-14 Z`); c.fillStyle = row ? shade(pal.base, -0.12) : shade(pal.base, 0.04); c.fill(p);
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.8; c.stroke(p); k.line(x + 1, 70.8 + row * 13, x + 13, 70.8 + row * 13, 'rgba(255,255,255,0.12)', 0.7);
  }
  c.fillStyle = pal.accent; c.fillRect(12, 94, 248, 3); k.ao(12, 98, 252, 3, 0.45);
  const tur = P('M28 61 L30 42 L56 33 L176 32 L210 42 L214 54 L204 61 Z');
  k.part(tur, pal.base, 32, 61, { camo: pal.camo, seed: 33, box: [20, 28, 200, 34], camoN: 8 });
  for (let x = 120; x < 206; x += 14) { const p = P(`M${x} 38 l12 1 v10 l-12 -1 Z`); c.fillStyle = shade(pal.base, 0.06); c.fill(p); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.8; c.stroke(p); }
  c.fillStyle = pal.accent; c.fillRect(40, 50, 70, 3);
  k.part(P('M56 33 L176 32 L184 35 L58 36 Z'), shade(pal.base, 0.18), 32, 36, { ink: false, rim: false });
  k.ao(30, 58, 180, 3, 0.5);
  k.rect(8, 40, 22, 18, pal.dark); for (let x = 10; x < 30; x += 4) k.line(x, 40, x, 58, 'rgba(0,0,0,0.5)', 0.7);
  k.rrect(84, 22, 16, 12, 2, pal.metal); k.rect(86, 24, 12, 3.5, '#3a1e1e', { rim: false }); k.light(92, 25.5, 3.4, 'rgba(255,60,40,0.7)');
  k.rrect(140, 24, 14, 9, 2, pal.metal); k.rect(152, 26, 18, 2.2, '#222', { rim: false });
  k.line(20, 42, 15, 4, INK, 1.2); k.line(30, 42, 28, 10, INK, 1.2);
  k.rrect(200, 42, 16, 13, 2, pal.metal);
  k.barrel(214, 298, 48, 4.2, 3.4, pal.base, { evac: 250, bands: [228, 276] });
  return { cut: 62, barrelX: 214, tipX: 298, tipY: 48, pivotX: 120, pivotY: 50 };
}

// ================================================================ WHEELED
function lav(c, k, pal) {
  // LAV-25 style 8x8: boat-shaped hull, nose at right, small two-man turret with 25mm chain gun
  const hull = P('M6 74 L14 54 L150 52 L178 56 L212 72 L204 84 L180 88 L22 88 L8 84 Z');
  k.part(hull, pal.base, 52, 88, { camo: pal.camo, seed: 41, box: [0, 48, 220, 44], camoN: 12 });
  k.part(P('M14 54 L150 52 L160 55 L18 57 Z'), shade(pal.base, 0.15), 52, 57, { ink: false, rim: false });
  k.seam([20, 70, 200, 70]); k.seam([60, 56, 60, 86], 0.35); k.seam([120, 54, 122, 86], 0.35);
  k.rect(150, 60, 22, 7, pal.dark); k.rect(152, 61, 18, 4, '#24343a', { rim: false });
  k.light(204, 74, 3, 'rgba(255,220,160,0.85)');
  for (const x of [34, 70, 134, 170]) { k.ao(x - 15, 84, 30, 4, 0.5); k.tyre(x, 90, 13); }
  // turret above y = 52
  const tur = P('M86 52 L90 42 L104 35 L136 35 L146 42 L146 50 L140 52 Z');
  k.part(tur, pal.base, 35, 52, { camo: pal.camo, seed: 42, box: [80, 30, 70, 24], camoN: 4, camoS: 12 });
  k.rect(92, 44, 10, 5, pal.dark); for (let i = 0; i < 4; i++) k.ellipse(108 + i * 6, 40, 2.4, 2.4, pal.dark, { rim: false });
  k.rrect(118, 28, 10, 8, 2, pal.metal); k.line(96, 36, 92, 6, INK, 1);
  k.barrel(146, 200, 44, 1.9, 1.6, pal.metal, { bands: [176] });
  return { cut: 52, barrelX: 146, tipX: 201, tipY: 44, pivotX: 116, pivotY: 44 };
}

function technical(c, k, pal) {
  // heavy 6x6 truck turned gun truck: slatted cargo bed at the rear (left), cab at the front (right)
  k.rect(150, 66, 108, 10, pal.dark); k.rect(8, 66, 166, 10, shade(pal.dark, -0.2)); // chassis
  const bed = P('M8 40 L170 40 L170 66 L8 66 Z');
  k.part(bed, pal.base, 40, 66, { camo: pal.camo, seed: 52, box: [0, 36, 180, 32], camoN: 6, camoS: 16 });
  for (let x = 30; x < 170; x += 26) k.seam([x, 41, x, 65], 0.45);
  k.seam([9, 52, 169, 52], 0.4);
  k.rect(6, 36, 166, 4, shade(pal.base, -0.15));
  const cab = P('M174 76 L174 24 L186 14 L226 14 L236 34 L258 40 L260 76 Z');
  k.part(cab, pal.base, 14, 76, { camo: pal.camo, seed: 51, box: [170, 10, 90, 70], camoN: 6, camoS: 16 });
  k.part(P('M186 14 L226 14 L229 19 L188 19 Z'), shade(pal.base, 0.15), 14, 19, { ink: false, rim: false });
  k.glass(P('M190 21 L224 21 L231 35 L190 35 Z'), 21, 35);
  k.seam([186, 40, 186, 74]); k.seam([236, 40, 256, 42]); k.seam([188, 52, 234, 52], 0.35);
  k.rect(242, 46, 16, 4, pal.dark); for (let y = 52; y < 70; y += 4) k.line(244, y, 257, y, 'rgba(0,0,0,0.5)', 0.8);
  k.rect(168, 6, 5, 34, '#2a2a28'); k.rect(166, 4, 9, 4, '#1c1c1b');
  k.rect(178, 58, 14, 8, pal.dark); k.light(258, 60, 3.2, 'rgba(255,225,170,0.9)');
  k.rect(130, 66, 30, 9, pal.metal);
  for (const x of [40, 80]) { k.ao(x - 18, 76, 36, 4, 0.5); k.tyre(x, 82, 17.5); }
  k.ao(206, 76, 36, 4, 0.5); k.tyre(224, 82, 17.5);
  return { bedTop: 62, bedX: 82 };
}

function mrap(c, k, pal) {
  // tall V-hull MRAP with roof gun shield
  const body = P('M10 112 L10 56 L24 44 L150 44 L170 62 L208 70 L212 112 L196 122 L26 122 Z');
  k.part(body, pal.base, 44, 122, { camo: pal.camo, seed: 61, box: [0, 40, 220, 86], camoN: 10, camoS: 22 });
  k.part(P('M24 44 L150 44 L156 49 L26 49 Z'), shade(pal.base, 0.16), 44, 49, { ink: false, rim: false });
  k.glass(P('M120 52 L150 52 L164 66 L120 66 Z'), 52, 66); k.glass(P('M80 54 L110 54 L110 68 L80 68 Z'), 54, 68); k.glass(P('M34 54 L62 54 L62 68 L34 68 Z'), 54, 68);
  k.seam([70, 50, 70, 116]); k.seam([116, 50, 116, 116]); k.seam([12, 96, 210, 96], 0.4);
  k.rect(2, 66, 12, 40, pal.dark); k.ellipse(6, 86, 8, 16, '#1d1f1f', { rim: false });
  k.rect(190, 80, 22, 6, pal.dark); k.light(210, 76, 3, 'rgba(255,225,170,0.9)');
  // roof turret ring & shield
  k.rect(76, 36, 44, 8, pal.dark);
  k.part(P('M82 36 L84 16 L118 16 L120 36 Z'), pal.base, 16, 36, { camo: pal.camo, seed: 62, box: [80, 14, 40, 24], camoN: 3, camoS: 10 });
  k.rect(118, 24, 24, 2.4, '#222', { rim: false }); k.line(60, 44, 56, 6, INK, 1);
  for (const x of [52, 170]) { k.ao(x - 22, 116, 44, 5, 0.5); k.tyre(x, 126, 21); }
  return { roofTop: 36 };
}

// ================================================================ HELICOPTERS (no main rotor: the game spins its own)
function wildcat(c, k, pal) {
  const fin = P('M12 14 L30 12 L46 56 L54 70 L30 72 L18 48 Z');
  k.part(fin, pal.base, 12, 72, { camo: pal.camo, seed: 71, box: [0, 8, 60, 70], camoN: 3 });
  k.part(P('M30 60 L76 58 L76 64 L30 66 Z'), shade(pal.base, -0.1), 58, 66);
  const body = P('M36 58 C80 58 110 60 132 54 L150 42 C170 36 200 34 246 36 C278 38 302 48 318 60 C332 72 332 86 316 92 C290 100 220 102 168 100 C150 98 140 92 132 80 C110 76 70 74 40 72 Z');
  k.part(body, pal.base, 34, 102, { camo: pal.camo, seed: 72, box: [20, 30, 320, 74], camoN: 9, camoS: 24 });
  k.part(P('M152 40 C158 28 172 22 190 22 L226 22 C238 24 246 30 250 40 Z'), shade(pal.base, -0.04), 22, 40);
  k.rect(176, 28, 18, 5, '#1c2024', { rim: false }); k.rect(204, 28, 18, 5, '#1c2024', { rim: false });
  k.rect(196, 12, 9, 12, pal.dark, { rim: false });
  k.glass(P('M268 44 C292 48 308 58 318 72 L282 72 L264 52 Z'), 44, 72);
  k.glass(P('M240 44 L262 46 L266 66 L240 66 Z'), 44, 66);
  k.seam([176, 44, 176, 98]); k.seam([232, 42, 232, 98]); k.seam([140, 84, 310, 86], 0.35); k.seam([60, 62, 132, 62], 0.3);
  k.glass(P('M186 52 L220 52 L220 68 L186 68 Z'), 52, 68);
  k.rect(148, 72, 12, 6, pal.dark); c.fillStyle = '#d6c24a'; c.fillRect(246, 80, 18, 2);
  k.light(326, 80, 3.5, 'rgba(255,240,200,0.8)'); k.light(26, 60, 3, 'rgba(255,60,50,0.8)');
  k.line(200, 100, 200, 107, INK, 2.2); k.line(292, 96, 292, 104, INK, 2.2);
  k.tyre(200, 108, 7); k.tyre(292, 106, 6);
  return { hubX: 200, hubY: 12, tailX: 22, tailY: 30 };
}

function hind(c, k, pal) {
  const fin = P('M8 18 L26 16 L44 58 L52 72 L28 74 L16 50 Z');
  k.part(fin, pal.base, 16, 74, { camo: pal.camo, seed: 81, box: [0, 12, 60, 66], camoN: 3 });
  k.part(P('M26 64 L74 62 L74 68 L26 70 Z'), shade(pal.base, -0.1), 62, 70);
  const body = P('M34 62 C80 62 110 64 132 58 L150 44 C175 38 220 36 266 38 C290 40 306 48 320 56 C340 64 354 78 348 92 C340 102 300 106 260 106 L178 106 C156 104 144 96 136 84 C110 80 72 78 38 76 Z');
  k.part(body, pal.base, 36, 106, { camo: pal.camo, seed: 82, box: [20, 32, 340, 76], camoN: 11, camoS: 26 });
  k.part(P('M160 38 L170 24 L266 24 L280 38 Z'), shade(pal.base, -0.04), 24, 38, { camo: pal.camo, seed: 83, box: [160, 20, 120, 20], camoN: 3, camoS: 12 });
  k.ellipse(276, 31, 6, 6, '#1b1d1d', { rim: false }); k.rect(172, 28, 20, 6, '#1c1c1c', { rim: false });
  k.rect(208, 12, 9, 14, pal.dark, { rim: false });
  k.glass(P('M292 46 C306 48 318 54 322 66 L294 66 Z'), 46, 66);
  k.glass(P('M322 66 C336 68 346 76 348 86 L322 86 Z'), 66, 86);
  k.seam([190, 46, 190, 102]); k.seam([250, 40, 250, 104]); k.seam([150, 90, 320, 94], 0.35); k.seam([60, 66, 132, 66], 0.3);
  k.part(P('M172 74 L238 72 L234 80 L176 82 Z'), shade(pal.base, -0.08), 72, 82);
  for (const x of [184, 214]) { k.rect(x, 82, 3, 6, INK); k.rrect(x - 11, 86, 26, 9, 4.5, '#3a3d34'); k.ellipse(x + 14, 90.5, 2.6, 4, '#1a1a1a', { rim: false }); }
  k.ellipse(334, 102, 7.5, 6.5, pal.dark); k.rect(338, 101, 16, 2.4, '#222', { rim: false });
  c.fillStyle = '#9b2b22'; c.fillRect(96, 68, 16, 4); c.fillStyle = '#e2d2a0'; c.fillRect(224, 88, 12, 2);
  k.light(348, 82, 3, 'rgba(255,240,200,0.8)'); k.light(26, 62, 3, 'rgba(255,60,50,0.85)');
  k.line(204, 106, 204, 112, INK, 2.2); k.line(308, 102, 308, 110, INK, 2.2); k.tyre(204, 113, 6.5); k.tyre(308, 111, 5.5);
  return { hubX: 212, hubY: 12, tailX: 18, tailY: 32 };
}

function tiger(c, k, pal) {
  const fin = P('M10 26 L24 22 L38 56 L44 66 L26 68 L16 48 Z');
  k.part(fin, pal.base, 22, 68, { camo: pal.camo, seed: 91, box: [0, 18, 50, 54], camoN: 2 });
  k.part(P('M18 58 L60 56 L60 62 L18 64 Z'), shade(pal.base, -0.1), 56, 64);
  k.rect(14, 48, 4, 18, pal.dark); k.rect(56, 48, 4, 16, pal.dark);
  const body = P('M30 58 C70 58 104 60 126 56 L144 46 C164 42 200 40 236 42 C262 46 290 60 306 72 C316 82 310 90 292 92 C260 96 210 98 170 96 C152 94 142 88 134 78 C104 74 66 72 32 70 Z');
  k.part(body, pal.base, 40, 98, { camo: pal.camo, seed: 92, box: [20, 36, 300, 64], camoN: 10, camoS: 22 });
  k.part(P('M158 42 L168 30 L222 30 L234 42 Z'), shade(pal.base, -0.05), 30, 42);
  k.rect(186, 16, 8, 16, pal.dark, { rim: false }); k.ellipse(190, 14, 8, 5.5, pal.metal);
  k.glass(P('M236 46 C250 48 260 54 264 66 L238 66 Z'), 46, 66);
  k.glass(P('M266 62 C280 64 294 72 298 80 L270 80 Z'), 62, 80);
  k.seam([176, 46, 176, 94]); k.seam([140, 84, 290, 86], 0.35); k.seam([56, 62, 126, 62], 0.3);
  k.part(P('M166 70 L220 68 L216 76 L170 78 Z'), shade(pal.base, -0.08), 68, 78);
  for (const x of [176, 202]) { k.rect(x, 78, 3, 5, INK); k.rrect(x - 10, 82, 24, 8, 4, '#3d3a30'); }
  k.ellipse(296, 93, 5.5, 5, pal.dark); k.rect(298, 92, 12, 2.2, '#222', { rim: false });
  c.fillStyle = '#7a1f1a'; c.fillRect(90, 62, 14, 3);
  k.light(26, 60, 3, 'rgba(255,60,50,0.85)');
  k.line(190, 96, 190, 103, INK, 2); k.line(280, 92, 280, 100, INK, 2); k.tyre(190, 105, 6); k.tyre(280, 103, 5);
  return { hubX: 190, hubY: 9, tailX: 18, tailY: 30 };
}

function f22(c, k, pal) {
  k.part(P('M40 46 L60 6 L86 6 L84 44 Z'), shade(pal.base, -0.18), 6, 46);          // far fin
  k.part(P('M4 52 L44 48 L48 56 L6 60 Z'), shade(pal.base, -0.12), 48, 60);          // tailplane
  const body = P('M8 46 C40 40 80 36 130 34 C170 32 200 30 230 32 C258 34 280 40 298 48 C280 54 250 58 200 60 L60 62 C34 60 16 56 8 52 Z');
  k.part(body, pal.base, 30, 62, { camo: pal.camo, seed: 101, box: [0, 28, 300, 36], camoN: 10, camoS: 16 });
  k.part(P('M68 58 L182 56 L152 72 L84 72 Z'), shade(pal.base, -0.24), 56, 72);   // wing
  k.part(P('M24 46 L48 8 L74 8 L70 44 Z'), pal.base, 8, 46, { camo: pal.camo, seed: 102, box: [20, 6, 60, 42], camoN: 3, camoS: 12 }); // near fin
  k.part(P('M2 46 L24 44 L26 58 L2 56 Z'), '#2a2f33', 44, 58, { rim: false });   // nozzle
  k.part(P('M150 43 L186 39 L190 58 L154 60 Z'), shade(pal.base, -0.12), 39, 60);
  k.part(P('M156 45 L182 42 L184 55 L158 57 Z'), '#1c2023', 42, 57, { rim: false }); // intake mouth
  k.glass(P('M204 33 C214 17 244 17 264 38 Z'), 17, 38);
  k.seam([60, 50, 290, 48], 0.35); k.seam([120, 36, 122, 60], 0.3); k.seam([196, 32, 198, 58], 0.3);
  k.seam([40, 40, 60, 38], 0.25); c.fillStyle = 'rgba(30,36,40,0.5)'; c.fillRect(100, 44, 22, 2);
  k.light(296, 48, 2.5, 'rgba(255,90,70,0.7)');
  return {};
}

function typhoon(c, k, pal) {
  const body = P('M8 46 C40 42 90 40 140 38 C180 37 210 38 230 42 C246 45 256 48 260 50 C246 54 220 58 180 60 L60 62 C30 60 14 56 8 52 Z');
  k.part(body, pal.base, 37, 62, { camo: pal.camo, seed: 111, box: [0, 34, 262, 30], camoN: 8, camoS: 14 });
  k.part(P('M40 58 L152 56 L76 74 L44 72 Z'), shade(pal.base, -0.24), 56, 74);     // delta wing
  const fin = P('M18 46 L40 4 L62 4 L58 44 Z');
  k.part(fin, pal.base, 4, 46); c.save(); c.clip(fin); c.fillStyle = pal.accent; c.fillRect(0, 4, 80, 12); c.restore(); k.ink(fin, 1.5);
  k.part(P('M132 54 L170 54 L166 68 L136 68 Z'), shade(pal.base, -0.15), 54, 68);
  k.part(P('M138 57 L164 57 L162 65 L140 65 Z'), '#1c2023', 57, 65, { rim: false });
  k.part(P('M176 46 L204 43 L194 54 Z'), shade(pal.base, -0.08), 43, 54);           // canard
  k.part(P('M2 46 L22 44 L24 58 L2 56 Z'), '#2a2f33', 44, 58, { rim: false });
  k.glass(P('M180 39 C192 25 214 27 232 43 Z'), 25, 43);
  k.seam([46, 50, 250, 49], 0.35); k.seam([120, 40, 120, 60], 0.3);
  c.fillStyle = pal.accent; c.fillRect(80, 46, 12, 4);
  return {};
}

function a10(c, k, pal) {
  k.part(P('M18 58 L22 12 L44 12 L44 58 Z'), shade(pal.base, -0.18), 12, 58);      // far fin
  k.rect(4, 54, 52, 6, shade(pal.base, -0.1));
  const body = P('M20 60 C60 52 120 50 200 50 C240 50 262 54 280 60 L296 65 L280 70 C250 76 120 76 60 74 C36 72 24 68 20 64 Z');
  k.part(body, pal.base, 50, 76, { camo: pal.camo, seed: 121, box: [0, 46, 300, 32], camoN: 10, camoS: 16 });
  k.part(P('M108 68 L214 66 L198 86 L124 86 Z'), shade(pal.base, -0.22), 66, 86);  // straight wing
  k.part(P('M6 60 L10 14 L32 14 L32 60 Z'), pal.base, 14, 60);                       // near fin
  k.rect(72, 44, 8, 10, pal.dark);
  k.rrect(54, 28, 70, 22, 11, pal.base, { camo: pal.camo, seed: 122, box: [50, 24, 80, 30], camoN: 3 });
  k.ellipse(124, 39, 4, 10, '#1d2023', { rim: false }); k.part(P('M50 32 L56 30 L56 48 L50 46 Z'), '#262a2c', 30, 48, { rim: false });
  k.glass(P('M228 52 C240 36 262 38 274 56 Z'), 38, 56);
  k.rect(290, 63, 10, 3, '#222', { rim: false });
  k.seam([60, 62, 276, 62], 0.35); k.seam([160, 52, 160, 74], 0.3);
  return {};
}

function c130(c, k, pal) {
  // high-wing four-prop transport converted into the VALKYRIE bomber
  const fin = P('M16 72 L36 10 L80 10 L96 72 Z');
  k.part(fin, pal.base, 10, 72, { camo: pal.camo, seed: 131, box: [10, 6, 90, 70], camoN: 4 });
  c.fillStyle = pal.accent; c.fillRect(36, 22, 50, 6);
  k.rect(8, 70, 90, 6, shade(pal.base, -0.1));
  const body = P('M20 78 L90 74 L120 70 L420 68 L468 72 L500 84 L512 98 L500 110 L460 116 L130 118 L90 110 L30 92 Z');
  k.part(body, pal.base, 68, 118, { camo: pal.camo, seed: 132, box: [10, 64, 510, 56], camoN: 16, camoS: 34 });
  k.glass(P('M470 80 L496 88 L500 96 L470 94 Z'), 80, 96);
  for (const x of [380, 410, 440]) k.ellipse(x, 86, 3.5, 3.5, '#1f2a30', { rim: false });
  k.rect(150, 78, 18, 26, shade(pal.base, -0.1)); k.seam([150, 78, 168, 78, 168, 104, 150, 104, 150, 78], 0.5);
  k.part(P('M240 110 L330 110 L326 122 L246 122 Z'), shade(pal.base, -0.12), 110, 122); // gear sponson
  k.seam([130, 100, 470, 100], 0.35); for (let x = 150; x < 460; x += 60) k.seam([x, 70, x, 116], 0.3);
  // high wing and two visible engine nacelles with prop blur
  k.part(P('M190 58 L380 56 L384 66 L194 68 Z'), shade(pal.base, -0.05), 56, 68);
  for (const x of [250, 330]) {
    k.rrect(x, 58, 52, 14, 6, pal.base);
    k.rect(x + 48, 60, 6, 10, '#222', { rim: false });
    const g = c.createRadialGradient(x + 56, 65, 2, x + 56, 65, 26);
    g.addColorStop(0, 'rgba(40,40,40,0.7)'); g.addColorStop(1, 'rgba(40,40,40,0.08)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x + 56, 65, 5, 30, 0, 0, 7); c.fill();
    k.ellipse(x + 55, 65, 3.5, 4, '#1a1a1a', { rim: false });
  }
  c.fillStyle = pal.accent; c.fillRect(140, 104, 40, 4);
  k.light(512, 98, 3, 'rgba(255,240,200,0.8)');
  return {};
}

// ---------------------------------------------------------------- registry
// key: [design width, design height, painter, palette, extra]
const DEFS = {
  v_abrams: [300, 112, abrams, 'desert'],
  v_leopard: [300, 112, (c, k, p) => leopard(c, k, p, 0), 'nato'],
  v_challenger: [300, 112, (c, k, p) => leopard(c, k, p, 1), 'natoB'],
  v_t14: [300, 118, t14, 'enemy'],
  v_k2: [300, 120, mammoth, 'heavy'],
  v_lav: [216, 104, lav, 'enemy'],
  v_hemtt: [262, 102, technical, 'rust'],
  v_mrap: [216, 148, mrap, 'enemy'],
  v_wildcat: [332, 116, wildcat, 'navy'],
  v_hind: [358, 120, hind, 'hind'],
  v_tiger: [318, 112, tiger, 'tiger'],
  v_f22: [300, 76, f22, 'jet'],
  v_typhoon: [262, 78, typhoon, 'jetEnemy'],
  v_a10: [300, 90, a10, 'warthog'],
  v_c130: [516, 126, c130, 'bomber'],
};

// Paint every vehicle. makeCanvas(w, h) -> HTMLCanvasElement
export function buildVehicles(makeCanvas) {
  const out = {};
  for (const [key, [W, H, fn, palName]] of Object.entries(DEFS)) {
    const cv = makeCanvas(W * RES, H * RES); const c = cv.getContext('2d');
    c.scale(RES, RES);
    const g = fn(c, kit(c), PAL[palName]) || {};
    const meta = { w: W * RES, h: H * RES };
    if (g.cut !== undefined) Object.assign(meta, { cut: g.cut / H, barrelX: g.barrelX / W, tipX: g.tipX / W, tipY: g.tipY / H, pivotX: g.pivotX / W, pivotY: g.pivotY / H });
    if (g.hubX !== undefined) Object.assign(meta, { hubX: g.hubX / W, hubY: g.hubY / H, tailX: g.tailX / W, tailY: g.tailY / H });
    if (g.bedTop !== undefined) Object.assign(meta, { bedY: (H - g.bedTop) / H, bedX: g.bedX / W });
    if (g.roofTop !== undefined) Object.assign(meta, { roofY: (H - g.roofTop) / H });
    out[key] = { canvas: cv, meta };
  }
  return out;
}
