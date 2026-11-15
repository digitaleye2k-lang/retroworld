// GHOSTBLADE - assassinations, bodies, interactions, melee, gadgets and projectiles
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T, W = GB.world, I = GB.input, phys = GB.phys, P = GB.player, A = GB.ai, St = GB.stealth;
  const { DOOR, AIR, GLASS, WATER, FACADE, PLAT } = W;
  const fx = (n, a, b, c, d) => { if (GB.fx && GB.fx[n]) GB.fx[n](a, b, c, d); };
  const toast = t => { if (GB.ui && GB.ui.toast) GB.ui.toast(t); };

  const C = GB.combat = {
    bodies: [], projectiles: [], items: [], interactables: [], ammo: {}, prompt: null, killTarget: null, torn: {}, gadgetCd: 0, lastVx: 0,

    reset() { C.bodies.length = 0; C.projectiles.length = 0; C.items.length = 0; C.interactables.length = 0; C.prompt = null; C.killTarget = null; C.refill(); },
    refill() { for (const g of GB.defs.gadgets) C.ammo[g.id] = GB.save.gadgets[g.id] ? GB.prog.gadgetCap(g.id) : 0; },
    ownedGadgets() { return GB.defs.gadgets.filter(g => GB.save.gadgets[g.id]).map(g => g.id); },

    // ---------- bodies ----------
    addBody(g, fromX) {
      const b = { x: g.x, y: g.y, vx: U.sign(g.x - (fromX === undefined ? g.x - g.face : fromX)) * 40, vy: -60, w: 18, h: 10, onGround: false, type: g.type, face: g.face, found: false, hidden: false, carried: false, knife: false, t: 0, civ: !!g.civ, hue: g.hue };
      C.bodies.push(b); return b;
    },
    dropBody() {
      const b = P.carrying; if (!b) return; P.carrying = null; b.carried = false; b.x = P.x + P.face * 8; b.y = P.y; b.vx = P.face * 50; b.vy = -40; b.onGround = false;
      GB.sfx('bodyDrop', { vol: 0.5 });
    },
    stashBody(spot) {
      const b = P.carrying; if (!b) return; P.carrying = null; b.carried = false; b.hidden = true; b.x = spot.x; b.y = spot.y; b.vx = b.vy = 0; spot.body = b;
      GB.sfx('hide'); fx('leaves', spot.x, spot.y - 12, spot.type); GB.events.emit('bodyHidden', b);
    },
    setDoor(d, open, byPlayer) {
      if (d.open === open) return;
      if (!open) { // do not close on someone
        const occ = e => !e.dead && Math.abs(e.x - d.x) < 22 && e.y > d.ty * T - 4 && e.y - 44 < (d.ty + 2) * T;
        if (occ(P) || A.guards.some(occ)) { d.timer = 0.6; return; }
      }
      d.open = open; d.byPlayer = open && !!byPlayer; if (!open) d.noticed = false;
      W.set(d.tx, d.ty, open ? AIR : DOOR); W.set(d.tx, d.ty + 1, open ? AIR : DOOR);
      if (Math.abs(d.x - P.x) < 700) GB.sfx('door', { vol: 0.5 });
      if (byPlayer) St.noise(d.x, d.y, P.crouch ? 20 : 48, 'door');
    },

    // ---------- projectiles ----------
    fireArrow(g, pl) {
      const sx = g.x + g.face * 8, sy = g.y - 34, tx = pl.x + pl.vx * 0.25, ty = pl.y - 26, dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
      const sp = 580, t = d / sp, grav = 260;
      C.projectiles.push({ kind: 'arrow', owner: 'e', x: sx, y: sy, vx: dx / t, vy: dy / t - 0.5 * grav * t, g: grav, life: 3, dmg: g.cfg.dmg });
      GB.sfx('arrowFire', { vol: 0.6 });
    },
    throwStone(g, pl) {
      const sx = g.x + g.face * 8, sy = g.y - 40, tx = pl.x + pl.vx * 0.2 + U.rand(-10, 10), ty = pl.y - pl.h * 0.5 + U.rand(-8, 8), dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
      const sp = 520, t = d / sp, grav = 520;
      C.projectiles.push({ kind: 'stone', owner: 'e', x: sx, y: sy, vx: dx / t, vy: dy / t - 0.5 * grav * t, g: grav, life: 3, dmg: g.train ? 3 : 7 });
      GB.sfx('throw', { vol: 0.5, rate: 0.8 });
    },
    throwAt(kind, sp, grav, extra) {
      const m = GB.cam.toWorld(I.mouse.x, I.mouse.y), sx = P.x + P.face * 6, sy = P.y - P.h * 0.75;
      let dx = m.x - sx, dy = m.y - sy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      if (P.state === 'ground' || P.state === 'air') P.face = dx >= 0 ? 1 : -1;
      // arc compensation for lobbed objects
      let vx = dx * sp, vy = dy * sp; if (grav > 500) vy -= Math.min(260, d * 0.45);
      C.projectiles.push(Object.assign({ kind, owner: 'p', x: sx, y: sy, vx, vy, g: grav, life: 3.5 }, extra || {}));
      P.attackT = 0.18; P.throwing = true;
    },

    useGadget() {
      const id = GB.save.gadget; if (!GB.save.gadgets[id]) return;
      if (C.gadgetCd > 0 || P.busy() || P.state === 'hidden' && id !== 'coin' && id !== 'knife' && id !== 'dart') return;
      if (P.carrying) return;
      if (C.ammo[id] <= 0) { GB.sfx('uiDeny'); toast('Out of ' + GB.defs.byId(GB.defs.gadgets, id).name); return; }
      let used = true;
      switch (id) {
        case 'knife': C.throwAt('knife', 720, 260); GB.sfx('throw'); break;
        case 'coin': C.throwAt('coin', 430, 900); GB.sfx('throw', { vol: 0.5 }); break;
        case 'smoke': C.throwAt('smoke', 400, 900); GB.sfx('throw'); break;
        case 'flash': C.throwAt('flash', 420, 900); GB.sfx('throw'); break;
        case 'dart': C.throwAt('dart', 980, 60); GB.sfx('dart'); break;
        case 'bow': C.throwAt('parrow', 780, 380); GB.sfx('arrowFire'); St.noise(P.x, P.y, 34, 'bow'); break;
        case 'crossbow': C.throwAt('bolt', 1150, 30); GB.sfx('arrowFire', { rate: 0.7 }); St.noise(P.x, P.y, 115, 'bow'); break;
        case 'decoy': C.items.push({ kind: 'decoy', x: P.x, y: P.y, t: 0 }); GB.sfx('pickup', { vol: 0.4 }); break;
        case 'rope': used = C.fireRope(); break;
      }
      if (used) { C.ammo[id]--; C.gadgetCd = GB.has('b5') ? 0.3 : 0.5; GB.events.emit('gadgetUsed', id); }
    },
    fireRope() {
      const m = GB.cam.toWorld(I.mouse.x, I.mouse.y), sx = P.x, sy = P.y - 30, ang = Math.atan2(m.y - sy, m.x - sx), R = 360;
      const d = W.ray(sx, sy, ang, R); let hx, hy;
      if (d < R - 1) { hx = sx + Math.cos(ang) * (d - 8); hy = sy + Math.sin(ang) * (d - 8); }
      else {
        const md = Math.min(R, Math.hypot(m.x - sx, m.y - sy)), ex = sx + Math.cos(ang) * md, ey = sy + Math.sin(ang) * md, t = W.at(ex, ey);
        if (t === FACADE || t === PLAT) { hx = ex; hy = ey; } else { GB.sfx('uiDeny'); toast('No anchor in range'); return false; }
      }
      C.rope = { x: hx, y: hy, t: 0.5 }; P.startZip(hx, hy + 30); GB.sfx('ropeFire'); St.noise(P.x, P.y, 70, 'rope'); return true;
    },

    // ---------- assassination ----------
    findKill() {
      if (P.busy() || P.carrying || P.state === 'swim' || P.state === 'sit') return null;
      let best = null, bd = 1e9, method = null;
      const chain = GB.has('b4') && P.chainT > 0;
      for (const g of A.guards) {
        if (g.dead) continue; const dx = g.x - P.x, dy = g.y - P.y, ad = Math.abs(dx);
        let m = null;
        if (P.state === 'hidden') { if (ad < 50 && Math.abs(dy) < 30) m = 'hide'; }
        else if (P.state === 'hang') { const top = P.hang.r * T; if (Math.abs(g.y - top) < 8 && ad < 46) m = 'ledge'; }
        else if (P.state === 'air' && P.vy > -120) { if (dy > 34 && dy < 330 && ad < 70 + dy * 0.3 && W.los(P.x, P.y - 20, g.x, g.y - 40)) m = 'air'; }
        if (!m && (P.state === 'ground' || P.state === 'air' || P.state === 'climb' || P.state === 'ladder')) { if (ad < 42 && Math.abs(dy) < 30) m = 'stealth'; else if (chain && ad < 160 && Math.abs(dy) < 40 && W.los(P.x, P.y - 24, g.x, g.y - 24)) m = 'chain'; }
        if (!m) continue;
        if (m !== 'chain' && !A.canAssassinate(g)) continue;
        if (m === 'chain' && (g.cfg.boss || (g.cfg.armored && g.state === 'combat' && g.stunT <= 0))) continue;
        const d = ad + Math.abs(dy) * 0.5; if (d < bd) { bd = d; best = g; method = m; }
      }
      // informants can be silenced too
      if (!best && (P.state === 'ground')) for (const c of A.civs) if (c.informant && !c.dead && Math.abs(c.x - P.x) < 38 && Math.abs(c.y - P.y) < 20) return { g: c, method: 'informant' };
      return best ? { g: best, method } : null;
    },
    assassinate(k) {
      const g = k.g, m = k.method, fast = GB.has('g2');
      if (m === 'informant') {
        P.startLock(0.4, { tx: g.x - P.face * 12, ty: g.y, hitAt: 0.5, anim: 'kill', onHit() { g.dead = true; A.civs.splice(A.civs.indexOf(g), 1); const b = C.addBody({ x: g.x, y: g.y, face: g.face, type: 'civ', civ: true, hue: g.hue }, P.x); b.civ = true; GB.sfx('assassinate'); GB.prog.addNotoriety(-20); toast('Informant silenced - notoriety reduced'); St.recentKill = 2; for (const c of A.civs) if (U.dist(c.x, c.y, g.x, g.y) < 150) A.civFlee(c, g.x, Math.random() < 0.5); } });
        return;
      }
      const side = U.sign(P.x - g.x) || -g.face;
      g.stunT = Math.max(g.stunT, 1.2); g.vx = 0;
      const finish = (method, victim) => () => {
        A.kill(victim, method, P.x, true);
        GB.sfx('assassinate', { rate: P.chainT > 0 ? 1.18 : 1 }); GB.sfx('stab', { vol: 0.8 }); St.noise(victim.x, victim.y, fast ? 16 : 30, 'kill');
        fx('slowmo', method === 'chain' ? 0.5 : 0.15, method === 'chain' ? 0.1 : 0.18); fx('punch', 0.12); fx('blood', victim.x, victim.y - 30, 9);
        P.chainT = 1.5;
      };
      GB.sfx('blade', { vol: 0.7 });
      if (m === 'stealth' || m === 'chain') {
        const dur = m === 'chain' ? 0.34 : (fast ? 0.3 : 0.5);
        P.face = -side;
        // double assassination
        let second = null;
        if (GB.has('b3')) for (const o of A.guards) if (o !== g && !o.dead && Math.abs(o.x - g.x) < 58 && Math.abs(o.y - g.y) < 20 && (A.canAssassinate(o) || o.state !== 'combat')) { second = o; break; }
        if (second) second.stunT = Math.max(second.stunT, 1.2);
        P.startLock(dur + (second ? 0.2 : 0), { tx: g.x + side * 14, ty: g.y, moveFrac: 0.45, hitAt: second ? 0.45 : 0.6, anim: second ? 'double' : 'kill', arc: m === 'chain' ? 14 : 0,
          onHit() { finish(m === 'chain' ? 'chain' : 'stealth', g)(); if (second) { finish('double', second)(); } } });
      } else if (m === 'air') {
        const d = U.dist(P.x, P.y, g.x, g.y);
        P.face = U.sign(g.x - P.x) || P.face;
        P.startLock(0.2 + d / 950, { tx: g.x, ty: g.y, moveFrac: 0.9, hitAt: 0.88, anim: 'dive', onHit() { finish('air', g)(); fx('dust', g.x, g.y, 12); fx('shake', 9); GB.sfx('landHard', { vol: 0.7 }); } });
      } else if (m === 'ledge') {
        const hang = Object.assign({}, P.hang), px = P.x, py = P.y;
        P.startLock(fast ? 0.4 : 0.55, { hitAt: 0.5, anim: 'ledgekill', endState: 'hang', hang, onHit() {
          const b0 = C.bodies.length; finish('ledge', g)();
          const b = C.bodies[b0]; if (b) { if (hang.kind === 'ledge') { b.x = px - hang.d * 6; b.vx = -hang.d * 70; } else { b.x = px; b.vx = 0; } b.y = py - 30; b.vy = -80; b.fell = true; }
        } });
        P.x = px; P.y = py;
      } else if (m === 'hide') {
        const spot = P.hideSpot;
        P.startLock(fast ? 0.4 : 0.55, { hitAt: 0.5, anim: 'hidekill', endState: 'hidden', spot, onHit() {
          const b0 = C.bodies.length; finish('hide', g)(); const b = C.bodies[b0];
          if (b && !spot.body) { b.hidden = true; b.x = spot.x; b.y = spot.y; b.vx = b.vy = 0; spot.body = b; }
          fx('leaves', spot.x, spot.y - 12, spot.type);
        } });
        P.x = spot.x; P.y = spot.y;
      }
    },

    // ---------- per-frame ----------
    update(dt) {
      C.gadgetCd = Math.max(0, C.gadgetCd - dt);
      if (C.rope) { C.rope.t -= dt; if (C.rope.t <= 0 && P.state !== 'zip') C.rope = null; }
      updBodies(dt); updProjectiles(dt); updItems(dt);
      if (P.dead) { C.prompt = null; C.killTarget = null; return; }

      // breaking through glass
      if (P.hitWall && Math.abs(C.lastVx) > 200 && (P.state === 'air' || P.state === 'ground' || P.state === 'climb')) {
        const tx = Math.floor((P.x + P.hitWall * 12) / T);
        for (let ty = Math.floor((P.y - P.h) / T); ty <= Math.floor((P.y - 1) / T); ty++) if (W.get(tx, ty) === GLASS) { breakGlass(tx, ty); P.vx = C.lastVx * 0.85; if (P.state === 'climb') { P.climb = null; P.setState('air'); } }
      }
      C.lastVx = P.vx;

      // weapon + gadget selection
      if (I.hit('weapon') && !P.busy()) {
        const ws = GB.defs.weapons.filter(w => GB.save.weapons[w.id]).map(w => w.id); GB.save.weapon = ws[(ws.indexOf(GB.save.weapon) + 1) % ws.length]; GB.sfx(GB.save.weapon === 'blade' ? 'blade' : 'swordSwing', { vol: 0.5 });
      }
      P.drawn = GB.save.weapon !== 'blade' && P.state !== 'hidden' && P.state !== 'sit';
      const gs = C.ownedGadgets();
      let gi = gs.indexOf(GB.save.gadget); if (gi < 0) { gi = 0; GB.save.gadget = gs[0]; }
      let step = (I.hit('gadgetNext') ? 1 : 0) + I.mouse.wheel;
      for (let n = 1; n <= 9; n++) if (I.rawHit('Digit' + n) && gs[n - 1]) { GB.save.gadget = gs[n - 1]; GB.sfx('uiMove'); }
      if (step) { GB.save.gadget = gs[((gi + step) % gs.length + gs.length) % gs.length]; GB.sfx('uiMove'); }
      if (I.hit('gadget')) C.useGadget();

      // block + attack
      const canFight = (P.state === 'ground' || P.state === 'air') && !P.carrying && P.rollT <= 0 && P.slideT <= 0;
      const wasBlock = P.blocking; P.blocking = canFight && P.onGround && I.isDown('block') && P.stamina > 0;
      if (P.blocking) { P.blockT = wasBlock ? P.blockT + dt : 0; const m = GB.cam.toWorld(I.mouse.x, I.mouse.y); if (!I.axisX()) P.face = m.x >= P.x ? 1 : -1; }
      if (I.hit('attack') && canFight && P.attackCd <= 0 && !P.blocking) meleeAttack();

      // assassinate
      C.killTarget = C.findKill();
      if (I.hit('assassinate')) { if (C.killTarget) C.assassinate(C.killTarget); else if (canFight && P.attackCd <= 0) meleeAttack(); }

      // interactions
      C.prompt = findInteract();
      if (I.hit('interact') && C.prompt && !P.busy()) { C.prompt.act(); C.prompt = null; }

      // relics + knife retrieval on touch
      for (const r of W.relics) if (!GB.save.relics[r.id] && Math.abs(r.x - P.x) < 18 && Math.abs(r.y - (P.y - 22)) < 30) {
        GB.save.relics[r.id] = true; GB.sfx('relic'); fx('ring', r.x, r.y); const up = GB.prog.addXp(25);
        toast('Ghost Feather ' + Object.keys(GB.save.relics).length + '/' + W.relics.length + (up ? ' - skill point earned!' : '')); GB.saveSys.save();
      }
      for (const b of C.bodies) if (b.knife && !b.hidden && Math.abs(b.x - P.x) < 20 && Math.abs(b.y - P.y) < 24) { b.knife = false; C.ammo.knife = Math.min(GB.prog.gadgetCap('knife'), C.ammo.knife + 1); GB.sfx('pickup', { vol: 0.4 }); }
      // viewpoint leap
      const vp = vpNear();
      if (vp && I.hit('jump') && P.state === 'ground' && !P.carrying && !I.axisX()) { P.jumpBuf = 0; P.startLeap(vp); }
    }
  };

  function vpNear() { if (P.state !== 'ground') return null; for (const v of W.viewpoints) if (Math.abs(v.x - P.x) < 22 && Math.abs(v.y - P.y) < 6) return v; return null; }
  C.vpNear = vpNear;

  function breakGlass(tx, ty) {
    let y = ty; while (W.get(tx, y - 1) === GLASS) y--;
    for (; W.get(tx, y) === GLASS; y++) W.set(tx, y, AIR);
    GB.sfx('glass'); St.noise(tx * T + 12, ty * T, 420, 'glass'); fx('shards', tx * T + 12, ty * T + 12, P.face); fx('shake', 5);
    GB.events.emit('glass');
  }
  C.breakGlass = breakGlass;

  function meleeAttack() {
    const w = GB.defs.byId(GB.defs.weapons, GB.save.weapon) || GB.defs.weapons[0];
    const m = GB.cam.toWorld(I.mouse.x, I.mouse.y); if (!I.axisX() && P.onGround) P.face = m.x >= P.x ? 1 : -1;
    P.attackT = 0.2; P.attackCd = w.cd; P.throwing = false; P.stamina = Math.max(0, P.stamina - 6);
    GB.sfx(w.id === 'blade' ? 'blade' : 'swordSwing', { vol: 0.7 });
    let hit = false;
    for (const g of A.guards) {
      if (g.dead) continue; const dx = g.x - P.x;
      if (dx * P.face < -6 || Math.abs(dx) > 48 || Math.abs(g.y - P.y) > 36) continue;
      hit = true;
      const aware = g.state === 'combat' && g.stunT <= 0 && g.sleepT <= 0 && U.sign(P.x - g.x) === g.face;
      const bc = aware ? (g.cfg.boss ? 0.65 : g.type === 'elite' ? 0.55 : g.type === 'captain' ? 0.5 : g.type === 'hunter' ? 0.4 : 0.22) : 0;
      if (Math.random() < bc) { GB.sfx('clash'); fx('spark', (g.x + P.x) / 2, P.y - 30, 6); St.noise(P.x, P.y, 230, 'clash'); g.attackCd = Math.min(g.attackCd, 0.35); continue; }
      const dmg = (w.dmg + (GB.has('b1') ? 1 : 0)) * (aware ? 1 : 3);
      GB.sfx('swordHit'); fx('shake', 3); St.noise(P.x, P.y, 150, 'clash');
      A.damage(g, dmg, P.x);
    }
    // glass + lanterns in reach
    const tx = Math.floor((P.x + P.face * 22) / T), ty = Math.floor((P.y - 26) / T); if (W.get(tx, ty) === GLASS) breakGlass(tx, ty);
    if (!hit) for (const L of W.lights) if (L.breakable && L.on && Math.abs(L.x - (P.x + P.face * 16)) < 26 && Math.abs(L.y - (P.y - 40)) < 40) { L.on = false; L.snuffed = true; GB.sfx('glass', { vol: 0.4, rate: 1.4 }); St.noise(L.x, L.y, 130, 'glass'); break; }
  }

  // ---------- interactions ----------
  function findInteract() {
    if (P.busy() || P.state === 'swim' || P.state === 'climb' || P.state === 'hang' || P.state === 'swing' || P.state === 'ladder') return null;
    const key = I.keyLabel('interact'), mk = (label, act) => ({ label, key, act });
    if (P.state === 'hidden') return mk('Leave cover', () => P.leaveHide());
    if (P.state === 'sit') return mk('Stand up', () => { P.bench = null; P.setState('ground'); });
    if (P.state !== 'ground') return null;
    if (P.carrying) {
      const s = St.spotNear(P.x + P.face * 10, P.y, 30);
      if (s && !s.body && s.type !== 'table' && s.type !== 'curtain') return mk('Hide body', () => C.stashBody(s));
      return mk('Drop body', () => C.dropBody());
    }
    const near = (x, y, rx, ry) => Math.abs(x - P.x) < rx && Math.abs(y - P.y) < (ry || 24);
    for (const it of C.interactables) if ((!it.when || it.when()) && near(it.x, it.y, it.r || 30, it.ry || 30)) return mk(typeof it.label === 'function' ? it.label() : it.label, it.act);
    for (const b of C.bodies) if (!b.carried && !b.hidden && b.onGround && near(b.x, b.y, 28)) return mk('Carry body', () => { P.carrying = b; b.carried = true; GB.sfx('bodyPickup'); if (b.knife) { b.knife = false; C.ammo.knife++; } });
    for (const s of W.stealables) if (!s.taken && s.active && near(s.x, s.y, 26)) return mk('Steal ' + s.name, () => { s.taken = true; GB.sfx('pickup'); GB.events.emit('steal', s); });
    const vp = vpNear();
    if (vp) return mk(GB.save.viewpoints[vp.id] ? 'Survey the city   [' + I.keyLabel('jump') + '] Leap of Faith' : 'Synchronize   [' + I.keyLabel('jump') + '] Leap of Faith', () => GB.events.emit('sync', vp));
    for (const c of W.chests) if (!GB.save.chests[c.id] && near(c.x, c.y, 26)) return mk('Open chest', () => { GB.save.chests[c.id] = true; GB.save.coins += c.coins; GB.sfx('pickup'); fx('ring', c.x, c.y - 10); toast('+' + c.coins + ' florins'); GB.saveSys.save(); });
    const nl = GB.prog.notorietyLevel();
    for (const p of W.posters) if (C.posterUp(p) && near(p.x, p.y + 30, 22, 30)) return mk('Tear down wanted poster', () => { C.torn[p.id] = true; GB.prog.addNotoriety(-8); GB.sfx('poster'); toast('Poster destroyed - notoriety reduced'); });
    if (GB.save.notoriety > 0) for (const o of W.officials) if (near(o.x, o.y, 30)) return mk('Bribe the ' + o.name + ' (100 florins)', () => { if (GB.save.coins < 100) { GB.sfx('uiDeny'); toast('Not enough florins'); return; } GB.save.coins -= 100; GB.prog.addNotoriety(-25); GB.sfx('uiBuy'); toast('The record of your crimes grows thinner'); });
    for (const d of W.doors) if (!d.locked && Math.abs(d.x - P.x) < 30 && P.y > d.ty * T && P.y <= (d.ty + 2) * T + 2) return mk(d.open ? 'Close door' : 'Open door', () => C.setDoor(d, !d.open, true));
    let spot = St.spotNear(P.x, P.y, 26);
    if (spot && spot.type !== 'bush') {
      if (spot.body && spot.type !== 'hay' && spot.type !== 'cart') return null;
      return mk('Hide', () => P.enterHide(spot));
    }
    for (const b of W.benches) if (near(b.x, b.y, 22, 8)) return mk('Sit', () => P.sit(b));
    for (const L of W.lights) if (L.on && (L.ext || L.breakable) && (L.kind !== 'lamp' || GB.env.dayLight() < 0.62) && Math.abs(L.x - P.x) < 26 && L.y < P.y && P.y - L.y < 110) return mk('Snuff light', () => { L.on = false; L.snuffed = true; GB.sfx('torchOut'); fx('dust', L.x, L.y, 4); GB.events.emit('snuff', L); });
    return null;
  }
  C.posterUp = p => !C.torn[p.id] && p.id < GB.prog.notorietyLevel() * 2 + (GB.save.notoriety > 8 ? 1 : 0);

  // ---------- simulation ----------
  function updBodies(dt) {
    for (let i = C.bodies.length - 1; i >= 0; i--) {
      const b = C.bodies[i]; b.t += dt;
      if (b.carried) { b.x = P.x; b.y = P.y - 30; continue; }
      if (b.hidden) continue;
      if (!b.onGround || Math.abs(b.vx) > 1) {
        b.vy = Math.min(b.vy + 1500 * dt, 1300); const pvy = b.vy; b.vx = U.approach(b.vx, 0, (b.onGround ? 400 : 30) * dt);
        phys.move(b, dt);
        if (b.justLanded && pvy > 420) { GB.sfx('bodyDrop', { vol: U.clamp(pvy / 900, 0.3, 1) }); St.noise(b.x, b.y, U.clamp(pvy * 0.2, 40, 210), 'thud'); fx('dust', b.x, b.y, 5); }
        if (W.at(b.x, b.y - 4) === WATER) { GB.sfx('splash'); fx('splash', b.x, Math.floor((b.y - 4) / T) * T); St.noise(b.x, b.y, 150, 'splash'); b.hidden = true; b.gone = true; GB.events.emit('bodyHidden', b); }
      }
    }
  }
  function hitGuardAt(x, y) { for (const g of A.guards) if (!g.dead && Math.abs(g.x - x) < 11 && y < g.y + 2 && y > g.y - 46) return g; return null; }
  function updProjectiles(dt) {
    for (let i = C.projectiles.length - 1; i >= 0; i--) {
      const p = C.projectiles[i]; p.life -= dt; let dead = p.life <= 0;
      const steps = 3, sdt = dt / steps;
      for (let s = 0; s < steps && !dead; s++) {
        p.vy += p.g * sdt; p.x += p.vx * sdt; p.y += p.vy * sdt;
        const t = W.at(p.x, p.y);
        if (t === GLASS && (p.kind === 'knife' || p.kind === 'parrow' || p.kind === 'bolt')) { breakGlass(Math.floor(p.x / T), Math.floor(p.y / T)); }
        if (W.isSolid(t) || (p.g > 500 && p.vy > 0 && (t === PLAT) && Math.floor((p.y - p.vy * sdt) / T) < Math.floor(p.y / T))) { impact(p, null); dead = true; break; }
        if (p.owner === 'e') {
          if (!P.dead && P.state !== 'hidden' && Math.abs(P.x - p.x) < 9 && p.y < P.y && p.y > P.y - P.h) {
            if (P.blocking && U.sign(p.vx) !== P.face) { GB.sfx('clash'); fx('spark', p.x, p.y, 5); } else if (p.kind === 'stone') { GB.sfx('land', { vol: 0.7, rate: 1.5 }); P.grabCd = 0.7; P.hurt(p.dmg, p.x - p.vx); } else { GB.sfx('arrowHit'); P.hurt(p.dmg, p.x - p.vx); }
            dead = true;
          }
        } else {
          if (p.kind === 'knife' || p.kind === 'parrow' || p.kind === 'bolt' || p.kind === 'dart') {
            const g = hitGuardAt(p.x, p.y); if (g) { impact(p, g); dead = true; }
            for (const L of W.lights) if (L.breakable && L.on && Math.abs(L.x - p.x) < 10 && Math.abs(L.y - p.y) < 12) { L.on = false; L.snuffed = true; GB.sfx('glass', { vol: 0.4, rate: 1.4 }); St.noise(L.x, L.y, 130, 'glass'); fx('shards', L.x, L.y, 0); }
          }
        }
      }
      if (dead) C.projectiles.splice(i, 1);
    }
  }
  function impact(p, g) {
    const x = p.x - p.vx * 0.004, y = p.y - p.vy * 0.004;
    switch (p.kind) {
      case 'arrow': GB.sfx('arrowHit', { vol: 0.3 }); break;
      case 'stone': GB.sfx('land', { vol: 0.35, rate: 1.6 }); break;
      case 'knife': case 'parrow': case 'bolt': {
        if (g) {
          const lethal = p.kind === 'bolt' ? (g.state !== 'combat' || !g.cfg.boss) && !g.cfg.boss : (g.state !== 'combat' && !g.cfg.armored && !g.cfg.boss);
          GB.sfx('knifeHit');
          if (lethal || g.hp <= (p.kind === 'bolt' ? 4 : 2)) { const b0 = C.bodies.length; A.kill(g, 'knife', p.x - p.vx, true); GB.sfx('guardDown', { vol: 0.5 }); St.noise(g.x, g.y, 40, 'kill'); if (p.kind === 'knife' && C.bodies[b0]) C.bodies[b0].knife = true; }
          else A.damage(g, p.kind === 'bolt' ? 4 : 2, p.x - p.vx);
        } else { GB.sfx('knifeHit', { vol: 0.5 }); St.noise(x, y, 60, 'coin'); if (p.kind === 'knife') C.items.push({ kind: 'knife', x, y, t: 0 }); }
        break;
      }
      case 'dart': {
        if (g) { GB.sfx('knifeHit', { vol: 0.3 }); if (g.cfg.boss) A.damage(g, 0.5, p.x - p.vx); else { A.setState(g, 'unaware'); g.wary = 0; g.sleepT = g.cfg.armored ? 14 : 28; g.meter = 0; g.vx = 0; g.attackT = 0; g.ladder = null; g.climbing = false; A.say(g, 'zzz'); GB.events.emit('sleep', g); } }
        break;
      }
      case 'coin': GB.sfx('coin'); St.noise(x, y, 290, 'coin'); C.items.push({ kind: 'coin', x, y, t: 0 }); break;
      case 'smoke': {
        GB.sfx('smoke'); St.smokes.push({ x, y: y - 20, r: 20, max: 120, life: 9, t: 0 });
        for (const o of A.guards) if (!o.dead && U.dist(o.x, o.y - 20, x, y) < 120) { o.stunT = Math.max(o.stunT, 1.6); A.say(o, '*cough*'); }
        break;
      }
      case 'flash': {
        GB.sfx('flash'); fx('flashbang', x, y); St.noise(x, y, 210, 'flash');
        for (const o of A.guards) if (!o.dead && o.sleepT <= 0 && U.dist(o.x, o.y - 30, x, y) < 270 && W.los(x, y - 6, o.x, o.y - 36)) { o.stunT = Math.max(o.stunT, o.cfg.boss ? 2 : 4); o.meter = Math.min(o.meter, 0.5); A.say(o, 'My eyes!'); }
        break;
      }
    }
  }
  function updItems(dt) {
    for (let i = C.items.length - 1; i >= 0; i--) {
      const it = C.items[i]; it.t += dt;
      if (it.kind === 'knife') { if (Math.abs(it.x - P.x) < 18 && Math.abs(it.y - (P.y - 20)) < 34) { C.ammo.knife = Math.min(GB.prog.gadgetCap('knife'), C.ammo.knife + 1); GB.sfx('pickup', { vol: 0.4 }); C.items.splice(i, 1); } }
      else if (it.kind === 'coin') { if (it.t > 12) C.items.splice(i, 1); }
      else if (it.kind === 'decoy') {
        if (it.t > 3 && it.t < 10) { it.n = (it.n || 0) - dt; if (it.n <= 0) { it.n = 0.9; GB.sfx('decoy', { vol: 0.6 }); St.noise(it.x, it.y, 260, 'decoy'); } }
        if (it.t > 10.5) C.items.splice(i, 1);
      }
    }
  }
  // evidence left in the world right now (for mission ratings)
  C.evidenceCount = () => C.bodies.filter(b => !b.hidden && !b.civ).length + C.bodies.filter(b => b.knife).length + C.items.filter(i => i.kind === 'knife').length;
})();
