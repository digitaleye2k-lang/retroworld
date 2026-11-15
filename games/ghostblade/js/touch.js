// GHOSTBLADE - on-screen touch controls. Switches on at the first touch (or on touch-only devices at load).
// Buttons feed the same key codes the keyboard does, so every mechanic works unchanged.
(function () {
  'use strict';
  const GB = window.GB, I = GB.input;
  const LABEL = { left: '◀', right: '▶', up: '▲', down: '▼', jump: 'JUMP', interact: 'USE', assassinate: 'STRIKE', attack: 'STRIKE', gadget: 'GADGET', gadgetNext: 'SWAP', weapon: 'BLADE', crouch: 'SNEAK', sprint: 'RUN', block: 'BLOCK', map: 'MAP', pause: 'II' };
  const SHORT = { knife: 'KNIFE', coin: 'COIN', smoke: 'SMOKE', dart: 'DART', flash: 'FLASH', rope: 'ROPE', decoy: 'DECOY', bow: 'BOW', crossbow: 'XBOW' };
  const AUTO = { knife: 1, dart: 1, bow: 1, crossbow: 1 };
  const CSS = `
#touch{position:fixed;inset:0;pointer-events:none;display:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;font:700 11px/1 Georgia,serif;letter-spacing:.08em;color:#e8e2d0}
#touch.on{display:block}
#touch.idle .tc-play{display:none}
#touch *{touch-action:none;-webkit-tap-highlight-color:transparent}
.tc-zone{position:absolute;left:0;bottom:0;width:44%;height:76%;pointer-events:auto}
.tc-base{position:absolute;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;border:2px solid rgba(232,226,208,.28);background:rgba(8,8,12,.22);opacity:.5;pointer-events:none;transition:opacity .15s}
.tc-base.live{opacity:1}
.tc-knob{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:rgba(232,226,208,.34);border:1px solid rgba(232,226,208,.5)}
.tc-pad{position:absolute;right:env(safe-area-inset-right,0);bottom:env(safe-area-inset-bottom,0);width:0;height:0;transform-origin:100% 100%}
.tc-top{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));display:flex;gap:8px;transform-origin:0 0}
.tc-b{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:50%;pointer-events:auto;background:rgba(8,8,12,.42);border:1.5px solid rgba(232,226,208,.38);color:#e8e2d0;text-shadow:0 1px 2px #000;box-sizing:border-box}
.tc-b small{font:400 9px/1 Georgia,serif;letter-spacing:.04em;color:#e6c35a}
.tc-b.down{background:rgba(230,195,90,.34);border-color:#e6c35a}
.tc-b.latch{background:rgba(230,195,90,.24);border-color:#e6c35a;color:#ffe9a8}
.tc-b.kill{border-color:rgba(255,106,92,.6)}
.tc-b.kill.hot{background:rgba(217,65,58,.5);border-color:#ff6a5c;box-shadow:0 0 14px rgba(255,90,70,.55)}
.tc-b.use.hot{background:rgba(230,195,90,.3);border-color:#e6c35a;box-shadow:0 0 12px rgba(230,195,90,.45)}
.tc-top .tc-b{position:static;width:36px;height:36px;border-radius:8px;font-size:10px}
#touch-rot{position:fixed;inset:0;z-index:99;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:#07070a;color:#e8e2d0;font:400 16px/1.5 Georgia,serif;letter-spacing:.14em;text-align:center;padding:24px}
#touch-rot b{font-size:44px;color:#e6c35a;font-weight:400}
#touch-rot.show{display:flex}`;
  // [action, text, right, bottom, size, mode, extra class]
  const BTNS = [
    ['jump', 'JUMP', 16, 16, 74, 'hold'],
    ['assassinate', 'STRIKE', 100, 12, 62, 'hold', 'kill'],
    ['interact', 'USE', 20, 100, 58, 'hold', 'use'],
    ['gadget', 'GADGET', 92, 84, 58, 'aim'],
    ['sprint', 'RUN', 166, 70, 50, 'toggle'],
    ['crouch', 'SNEAK', 172, 10, 50, 'toggle'],
    ['block', 'BLOCK', 24, 168, 46, 'hold'],
    ['gadgetNext', 'SWAP', 80, 152, 42, 'hold'],
    ['weapon', 'BLADE', 132, 152, 42, 'hold']
  ];
  const Tc = GB.touch = { on: false, aiming: false };
  let root, pad, top, rot, base, knob, els = {}, latched = {}, stick = null, stickKeys = {}, aim = null, gadTxt = '', wasPortrait = false;
  const P = () => GB.player;
  const playing = () => GB.game && GB.game.state === 'play' && !GB.ui.isOpen() && !GB.game.cinematic;

  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function setKey(action, on) { const c = I.keys[action]; if (on) I.press(c); else I.release(c); }

  function build() {
    const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('div'); root.id = 'touch';
    const zone = el('div', 'tc-zone tc-play'); base = el('div', 'tc-base'); knob = el('div', 'tc-knob'); base.appendChild(knob); zone.appendChild(base); root.appendChild(zone);
    pad = el('div', 'tc-pad tc-play'); root.appendChild(pad);
    for (const [a, t, r, b, s, mode, cls] of BTNS) {
      const e = el('div', 'tc-b' + (cls ? ' ' + cls : ''), t); e.style.cssText = `right:${r}px;bottom:${b}px;width:${s}px;height:${s}px;font-size:${s > 60 ? 12 : s > 48 ? 10 : 9}px`;
      pad.appendChild(e); els[a] = e; bind(e, a, mode);
    }
    els.gadget.textContent = ''; els.gadget.appendChild(el('span', null, 'GADGET')); els.gadget.appendChild(el('small', null, ''));
    top = el('div', 'tc-top tc-play');
    const bp = el('div', 'tc-b', 'II'), bm = el('div', 'tc-b', 'MAP'); top.appendChild(bp); top.appendChild(bm); root.appendChild(top);
    if (GB.fullscreen.ok()) { const bf = el('div', 'tc-b', '⛶'); bf.style.fontSize = '17px'; top.appendChild(bf); tap(bf, () => GB.fullscreen.toggle()); }
    tap(bp, () => { if (playing() && !P().dead) GB.ui.showPause(); });
    tap(bm, () => { if (playing() && !P().dead) GB.ui.showScreen('map'); });
    const ui = document.getElementById('ui-root'); document.body.insertBefore(root, ui);
    rot = el('div'); rot.id = 'touch-rot'; rot.appendChild(el('b', null, '⟳')); rot.appendChild(el('span', null, 'ROTATE YOUR DEVICE')); rot.appendChild(el('span', null, 'Ghostblade plays in landscape.')); document.body.appendChild(rot);
    bindStick(zone);
    document.getElementById('game').addEventListener('touchstart', e => e.preventDefault(), { passive: false }); // no emulated mouse clicks
    root.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', layout); layout();
  }

  function tap(e, fn) { e.addEventListener('pointerdown', ev => { ev.preventDefault(); e.classList.add('down'); fn(); }); const up = () => e.classList.remove('down'); e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up); }

  function bind(e, action, mode) {
    const cap = ev => { try { e.setPointerCapture(ev.pointerId); } catch (x) { } };
    if (mode === 'toggle') {
      e.addEventListener('pointerdown', ev => { ev.preventDefault(); latched[action] = !latched[action]; setKey(action, latched[action]); e.classList.toggle('latch', latched[action]); });
      return;
    }
    if (mode === 'aim') {
      e.addEventListener('pointerdown', ev => { ev.preventDefault(); cap(ev); aim = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0 }; Tc.aiming = true; e.classList.add('down'); });
      e.addEventListener('pointermove', ev => { if (aim && ev.pointerId === aim.id) { aim.dx = ev.clientX - aim.x0; aim.dy = ev.clientY - aim.y0; } });
      const end = fire => ev => {
        if (!aim || ev.pointerId !== aim.id) return;
        if (fire && playing()) { placeAim(); setKey('gadget', true); setKey('gadget', false); }
        aim = null; Tc.aiming = false; e.classList.remove('down');
      };
      e.addEventListener('pointerup', end(true)); e.addEventListener('pointercancel', end(false));
      return;
    }
    e.addEventListener('pointerdown', ev => { ev.preventDefault(); cap(ev); setKey(action, true); e.classList.add('down'); });
    const up = () => { setKey(action, false); e.classList.remove('down'); };
    e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up);
  }

  function bindStick(zone) {
    const R = 56;
    const set = (a, on) => { if (!!stickKeys[a] !== on) { stickKeys[a] = on; setKey(a, on); } };
    const apply = () => {
      const nx = stick ? stick.dx / R : 0, ny = stick ? stick.dy / R : 0;
      set('left', nx < -0.32); set('right', nx > 0.32); set('up', ny < -0.5); set('down', ny > 0.5);
      knob.style.transform = stick ? `translate(${stick.dx}px,${stick.dy}px)` : '';
    };
    zone.addEventListener('pointerdown', ev => {
      if (stick) return; ev.preventDefault(); try { zone.setPointerCapture(ev.pointerId); } catch (x) { }
      const r = zone.getBoundingClientRect(); stick = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0 };
      base.style.left = (ev.clientX - r.left) + 'px'; base.style.top = (ev.clientY - r.top) + 'px'; base.classList.add('live'); apply();
    });
    zone.addEventListener('pointermove', ev => {
      if (!stick || ev.pointerId !== stick.id) return;
      let dx = ev.clientX - stick.x0, dy = ev.clientY - stick.y0; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; } stick.dx = dx; stick.dy = dy; apply();
    });
    const end = ev => { if (!stick || ev.pointerId !== stick.id) return; stick = null; base.classList.remove('live'); apply(); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    Tc._restStick = () => { const r = zone.getBoundingClientRect(); base.style.left = Math.min(110, r.width * 0.42) + 'px'; base.style.top = (r.height - Math.min(104, r.height * 0.4)) + 'px'; };
  }

  function layout() {
    if (!root) return;
    const w = window.innerWidth, h = window.innerHeight, s = Math.max(0.74, Math.min(1.45, Math.min(h / 400, w / 760)));
    pad.style.transform = `scale(${s})`;
    // sit just right of the compass (HUD is drawn in a 720-high virtual space)
    const u = h / 720, cw = Math.max(160, Math.min(360, w / u - 560));
    top.style.left = (w / 2 + (cw / 2 + 14) * u) + 'px'; top.style.transform = `scale(${Math.max(0.8, Math.min(1.3, s))})`;
    if (!stick && Tc._restStick) Tc._restStick();
    const portrait = h > w * 1.15; rot.classList.toggle('show', Tc.on && portrait);
    if (portrait && !wasPortrait && Tc.on && playing() && !P().dead) GB.ui.showPause();
    wasPortrait = portrait;
  }

  // Point the virtual mouse: forward by default, at a dragged direction while aiming, at the nearest guard on a quick tap.
  function placeAim() {
    const p = P(), cam = GB.cam; let wx = p.x + p.face * 210, wy = p.y - 34;
    if (aim) {
      const len = Math.hypot(aim.dx, aim.dy), id = GB.save.gadget;
      if (len > 14) { const d = Math.max(150, Math.min(400, len * 3.2)); wx = p.x + aim.dx / len * d; wy = p.y - 30 + aim.dy / len * d; }
      else if (AUTO[id]) {
        let best = null, bd = 430;
        for (const g of GB.ai.guards) { if (g.dead) continue; const d = Math.hypot(g.x - p.x, g.y - p.y) + ((g.x - p.x) * p.face < 0 ? 120 : 0); if (d < bd && GB.stealth.losClear(p.x, p.y - 30, g.x, g.y - 30)) { bd = d; best = g; } }
        if (best) { wx = best.x; wy = best.y - 30; }
      }
    }
    const s = cam.toScreen(wx, wy); I.mouse.x = s.x; I.mouse.y = s.y;
  }

  Tc.enable = function () {
    if (Tc.on) return; Tc.on = true;
    if (!root) build();
    root.classList.add('on'); document.documentElement.classList.add('gb-touch'); layout();
  };

  // called once per frame from the main loop
  Tc.update = function () {
    if (!Tc.on) return;
    const play = playing(); root.classList.toggle('idle', !play);
    if (!play) {
      if (stick) { stick = null; base.classList.remove('live'); knob.style.transform = ''; }
      for (const a in stickKeys) if (stickKeys[a]) { stickKeys[a] = false; setKey(a, false); }
      return;
    }
    for (const a in latched) if (latched[a] && !I.isDown(a)) { latched[a] = false; els[a].classList.remove('latch'); } // input was cleared by a menu
    placeAim();
    const C = GB.combat, id = GB.save.gadget, txt = id ? (SHORT[id] || id.toUpperCase()) + ' ' + (C.ammo[id] | 0) : '';
    if (txt !== gadTxt) { gadTxt = txt; els.gadget.lastChild.textContent = txt; }
    els.assassinate.classList.toggle('hot', !!C.killTarget && !P().busy());
    els.interact.classList.toggle('hot', !!C.prompt);
  };

  const keyLabel = I.keyLabel;
  I.keyLabel = a => (Tc.on && LABEL[a]) || keyLabel(a);

  window.addEventListener('touchstart', Tc.enable, { once: true, passive: true, capture: true });
  window.addEventListener('load', () => { try { if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) Tc.enable(); } catch (e) { } });
})();
