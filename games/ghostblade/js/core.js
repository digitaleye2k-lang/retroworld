// GHOSTBLADE - core: namespace, utilities, events, input
(function () {
  'use strict';
  const GB = window.GB = { T: 24, time: 0, dt: 0, timeScale: 1 };

  // ---------- utils ----------
  const U = GB.util = {
    clamp: (v, a, b) => v < a ? a : v > b ? b : v,
    lerp: (a, b, t) => a + (b - a) * t,
    sign: v => v < 0 ? -1 : v > 0 ? 1 : 0,
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    approach: (v, target, step) => v < target ? Math.min(v + step, target) : Math.max(v - step, target),
    damp: (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt)),
    ease: t => t * t * (3 - 2 * t),
    rng(seed) { // mulberry32
      let s = seed >>> 0;
      const f = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
      f.pick = arr => arr[Math.floor(f() * arr.length)];
      return f;
    },
    hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
    rand: (a, b) => a + Math.random() * (b - a),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },
    mixColor(c1, c2, t) { // arrays [r,g,b]
      return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
    },
    rgb: (c, a) => a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`,
    fmtTime(s) { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  };

  // ---------- events ----------
  const handlers = {};
  GB.events = {
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    emit(name, a, b, c) { const h = handlers[name]; if (h) for (let i = 0; i < h.length; i++) h[i](a, b, c); }
  };

  // ---------- input ----------
  const DEFAULT_KEYS = {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    sprint: 'ShiftLeft', jump: 'Space', crouch: 'KeyC',
    interact: 'KeyE', assassinate: 'KeyQ', gadget: 'KeyF',
    weapon: 'KeyR', gadgetNext: 'Tab', map: 'KeyM',
    attack: 'Mouse0', block: 'Mouse2', pause: 'Escape'
  };
  const down = new Set(), pressed = new Set(), released = new Set();
  const I = GB.input = {
    DEFAULT_KEYS,
    keys: Object.assign({}, DEFAULT_KEYS),
    mouse: { x: 0, y: 0, wheel: 0 },
    enabled: true,
    capture: null, // fn(code) used by remap UI; return true to consume
    isDown(a) { return I.enabled && down.has(I.keys[a]); },
    hit(a) { return I.enabled && pressed.has(I.keys[a]); },
    up(a) { return I.enabled && released.has(I.keys[a]); },
    rawHit(code) { return pressed.has(code); },
    axisX() { return (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0); },
    axisY() { return (I.isDown('down') ? 1 : 0) - (I.isDown('up') ? 1 : 0); },
    endFrame() { pressed.clear(); released.clear(); I.mouse.wheel = 0; },
    clear() { down.clear(); pressed.clear(); released.clear(); },
    label(code) {
      if (!code) return '-';
      if (code === 'Mouse0') return 'LMB'; if (code === 'Mouse1') return 'MMB'; if (code === 'Mouse2') return 'RMB';
      return code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'RShift')
        .replace('ControlLeft', 'Ctrl').replace('ControlRight', 'RCtrl').replace('AltLeft', 'Alt').replace('Arrow', '');
    },
    keyLabel(action) { return I.label(I.keys[action]); },
    init(canvas) {
      const press = code => { if (!down.has(code)) pressed.add(code); down.add(code); };
      const rel = code => { down.delete(code); released.add(code); };
      window.addEventListener('keydown', e => {
        if (I.capture) { if (I.capture(e.code)) { e.preventDefault(); return; } }
        const inField = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
        if (inField) return;
        if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || (e.ctrlKey && e.code !== 'KeyR' && e.code !== 'KeyW')) e.preventDefault();
        if (!e.repeat) press(e.code);
      });
      window.addEventListener('keyup', e => rel(e.code));
      window.addEventListener('blur', () => { down.clear(); });
      canvas.addEventListener('mousedown', e => {
        if (I.capture) { if (I.capture('Mouse' + e.button)) { e.preventDefault(); return; } }
        press('Mouse' + e.button); e.preventDefault();
      });
      window.addEventListener('mouseup', e => rel('Mouse' + e.button));
      canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); I.mouse.x = e.clientX - r.left; I.mouse.y = e.clientY - r.top; });
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      canvas.addEventListener('wheel', e => { I.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    }
  };
})();
