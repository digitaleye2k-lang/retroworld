// Vehicle art: hand-designed illustrations painted at boot by VehicleDraw.js (all face RIGHT).
// If painting fails, callers fall back to the old procedural shapes.
import { buildVehicles } from './VehicleDraw.js';

export function preloadVehicleArt() { /* art is generated, nothing to load */ }

export function createVehicleArt(scene) {
  const V = buildVehicles((w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; });
  const meta = {};
  for (const [key, v] of Object.entries(V)) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, v.canvas);
    meta[key] = v.meta;
  }
  if (scene.cache.json.exists('vehmeta')) scene.cache.json.remove('vehmeta');
  scene.cache.json.add('vehmeta', meta);
  setupVehicleFrames(scene);
}

export function vmeta(scene, key) {
  const j = scene.cache.json.get('vehmeta');
  return j && j[key] && scene.textures.exists(key) ? j[key] : null;
}

// Split turreted vehicles into 'hull', 'turret' (static body) and 'barrel' frames so the gun can elevate.
export function setupVehicleFrames(scene) {
  const j = scene.cache.json.get('vehmeta'); if (!j) return;
  for (const [key, m] of Object.entries(j)) {
    if (!scene.textures.exists(key)) continue;
    const tex = scene.textures.get(key);
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (m.cut === undefined || tex.has('hull')) continue;
    const cy = Math.round(m.cut * m.h), bx = Math.round(m.barrelX * m.w);
    tex.add('turret', 0, 0, 0, bx, cy);
    tex.add('barrel', 0, bx, 0, m.w - bx, cy);
    tex.add('hull', 0, 0, cy, m.w, m.h - cy);
    // adding frames makes Phaser treat 'turret' as the default; keep the whole drawing as default
    tex.firstFrame = '__BASE';
  }
}

// Geometry of a turreted sprite drawn `dispW` pixels wide, in local space with the origin at
// the bottom-centre of the vehicle (x right = forward, y up negative).
export function turretGeom(m, dispW) {
  const k = dispW / m.w, W = m.w * k, H = m.h * k;
  const cy = Math.round(m.cut * m.h), bx = Math.round(m.barrelX * m.w);
  const trunnion = { x: (bx / m.w - 0.5) * W, y: -(1 - m.tipY) * H };
  return {
    k, W, H,
    turretPos: { x: -W / 2, y: -H },                 // top-left of the turret frame
    trunnion,                                       // barrel pivot
    barrelOriginY: (m.tipY * m.h) / cy,             // barrel frame origin (fraction)
    barrel: (m.tipX - m.barrelX) * W,
    pivot: trunnion,
  };
}
