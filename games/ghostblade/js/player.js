// GHOSTBLADE - physics + the assassin's movement state machine
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T, W = GB.world, I = GB.input;
  const { PLAT, LADDER, WATER, SMOOTH, FACADE } = W;

  GB.sfx = (n, o) => { if (GB.audio && GB.audio.sfx) GB.audio.sfx(n, o); };
  const fx = (n, a, b, c, d) => { if (GB.fx && GB.fx[n]) GB.fx[n](a, b, c, d); };
  const noise = (x, y, r, kind) => { if (GB.stealth) GB.stealth.noise(x, y, r, kind); };

  // ---------------- shared physics ----------------
  const phys = GB.phys = {
    boxFree(x, y, w, h) {
      const x0 = Math.floor((x - w / 2) / T), x1 = Math.floor((x + w / 2) / T), y0 = Math.floor((y - h) / T), y1 = Math.floor((y - 0.5) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (W.solid(tx, ty)) return false;
      return true;
    },
    standable(tx, r) { const t = W.get(tx, r); return W.isSolid(t) || t === PLAT || (t === LADDER && W.get(tx, r - 1) !== LADDER); },
    move(e, dt, drop) {
      e.hitWall = 0; e.hitHead = false;
      // X
      if (e.vx !== 0) {
        let nx = e.x + e.vx * dt; const dir = e.vx > 0 ? 1 : -1;
        const tx = Math.floor((nx + dir * e.w / 2) / T), y0 = Math.floor((e.y - e.h) / T), y1 = Math.floor((e.y - 0.5) / T);
        for (let ty = y0; ty <= y1; ty++) if (W.solid(tx, ty)) { nx = dir > 0 ? tx * T - e.w / 2 - 0.01 : (tx + 1) * T + e.w / 2 + 0.01; e.hitWall = dir; e.vx = 0; break; }
        e.x = nx;
      }
      // Y
      let ny = e.y + e.vy * dt; const x0 = Math.floor((e.x - e.w / 2) / T), x1 = Math.floor((e.x + e.w / 2) / T);
      const was = e.onGround; e.onGround = false; e.groundT = 0;
      if (e.vy >= 0) {
        const r1 = Math.floor(ny / T);
        outer: for (let r = Math.floor((e.y + 0.001) / T); r <= r1; r++) for (let tx = x0; tx <= x1; tx++) {
          const t = W.get(tx, r);
          if (W.isSolid(t) || (!drop && (t === PLAT || (t === LADDER && W.get(tx, r - 1) !== LADDER)) && e.y <= r * T + 0.5)) {
            ny = r * T; e.landVy = e.vy; e.vy = 0; e.onGround = true; e.groundT = t; break outer;
          }
        }
      } else {
        const ty = Math.floor((ny - e.h) / T);
        for (let tx = x0; tx <= x1; tx++) if (W.solid(tx, ty)) { ny = (ty + 1) * T + e.h + 0.01; e.vy = 0; e.hitHead = true; break; }
      }
      e.y = ny; e.justLanded = !was && e.onGround;
    }
  };

  const WALK = 150, SNEAK = 78, SPRINT = 325, GRAV = 1500, MAXFALL = 1400, STAND = 44, LOW = 22;

  const P = GB.player = {
    x: 0, y: 0, vx: 0, vy: 0, w: 14, h: STAND, face: 1, state: 'air', onGround: false,
    reset(x, y) {
      Object.assign(P, { x, y, vx: 0, vy: 0, h: STAND, face: 1, state: 'air', onGround: false, stateT: 0, crouch: false,
        slideT: 0, rollT: 0, vaultT: 0, landT: 0, coyote: 0, jumpBuf: 0, airJumps: 0, grabCd: 0, swingCd: 0, burstT: 0, wallrunUsed: false,
        hang: null, climb: null, swing: null, hideSpot: null, bench: null, carrying: null, lock: null, leap: null, zip: null, pull: null,
        dead: false, deadT: 0, hp: P.maxHp(), stamina: P.maxSta(), hurtT: 0, invuln: 0, stepDist: 0, runPhase: 0, fallFrom: y,
        attackT: 0, attackCd: 0, blocking: false, blockT: 0, drawn: false, light: 1, concealed: false, blended: false, sprinting: false,
        noReg: 0, cutJump: false, chainT: 0, seenBy: 0, trail: [] });
    },
    maxHp() { return 100 + (GB.save.upgrades.vigor ? 25 : 0); },
    maxSta() { return 100 + (GB.save.outfit === 'crimson' ? 25 : 0); },
    cx() { return P.x; }, cy() { return P.y - P.h * 0.6; },
    busy() { return P.dead || P.state === 'lock' || P.state === 'leap' || P.state === 'zip' || P.state === 'pullup'; },
    grounded() { return P.onGround && (P.state === 'ground'); },
    setState(s) { if (P.state !== s) { if (s === 'air' && P.state !== 'ground') P.coyote = 0; P.state = s; P.stateT = 0; } },
    canStand() { return phys.boxFree(P.x, P.y, P.w, STAND); },
    hurt(dmg, fromX) {
      if (P.dead || P.invuln > 0 || P.state === 'leap') return;
      P.hp -= dmg; P.hurtT = 0.35; P.invuln = 0.5; P.noReg = 5;
      GB.sfx('hurt'); fx('shake', 6); fx('blood', P.x, P.y - 28, 6);
      if (P.state === 'hang' || P.state === 'climb' || P.state === 'ladder' || P.state === 'swing' || P.state === 'hidden' || P.state === 'sit') { P.exitSpecial(); P.setState('air'); }
      if (fromX !== undefined && P.state !== 'lock') { P.vx = U.sign(P.x - fromX) * 160; if (P.onGround) P.vy = -160; }
      if (P.hp <= 0) P.die('slain');
    },
    die(why) {
      if (P.dead) return; P.dead = true; P.deadT = 0; P.hp = 0; P.exitSpecial(); P.setState('dead'); P.lock = null;
      if (P.carrying) { GB.combat.dropBody(); }
      GB.sfx('death'); GB.events.emit('playerDied', why);
    },
    exitSpecial() { if (P.hideSpot) { P.hideSpot = null; } P.bench = null; P.hang = null; P.climb = null; P.swing = null; P.burstT = 0; P.h = P.crouch ? LOW : STAND; },
    // ----- external entry points -----
    enterHide(spot) { P.hideSpot = spot; P.setState('hidden'); P.vx = P.vy = 0; P.x = spot.x; P.y = spot.y; P.crouch = false; P.h = STAND; GB.sfx('hide'); fx('leaves', spot.x, spot.y - 14, spot.type); fx('punch', 0.06); },
    leaveHide() { const s = P.hideSpot; P.hideSpot = null; P.setState('ground'); P.y = s.y; if (!phys.boxFree(P.x, P.y, P.w, STAND)) { P.crouch = true; P.h = LOW; } GB.sfx('hide', { vol: 0.7, rate: 1.25 }); fx('leaves', s.x, s.y - 14, s.type); },
    sit(b) { P.bench = b; P.setState('sit'); P.x = b.x; P.y = b.y; P.vx = P.vy = 0; },
    startLock(dur, o) { P.exitSpecial(); P.lock = Object.assign({ t: 0, dur, x0: P.x, y0: P.y }, o || {}); P.setState('lock'); P.vx = P.vy = 0; },
    startLeap(vp) {
      const dy = vp.land.y - P.y, D = Math.sqrt(2 * Math.max(60, dy) / 950) + 0.35;
      P.exitSpecial(); P.leap = { vp, t: -0.45, D, x0: P.x, y0: P.y, g: 2 * (dy + 200 * D) / (D * D) };
      P.face = U.sign(vp.land.x - P.x) || 1; P.setState('leap'); P.vx = P.vy = 0; P.crouch = false; P.h = STAND;
      GB.events.emit('leapStart', vp);
    },
    startZip(tx, ty) { P.exitSpecial(); P.zip = { x: tx, y: ty, t: 0 }; P.setState('zip'); P.face = U.sign(tx - P.x) || P.face; },

    update(dt) {
      P.stateT += dt;
      P.invuln = Math.max(0, P.invuln - dt); P.hurtT = Math.max(0, P.hurtT - dt); P.grabCd -= dt; P.swingCd -= dt;
      P.attackT = Math.max(0, P.attackT - dt); P.attackCd = Math.max(0, P.attackCd - dt); P.landT = Math.max(0, P.landT - dt);
      P.vaultT = Math.max(0, P.vaultT - dt); P.chainT = Math.max(0, P.chainT - dt); P.noReg = Math.max(0, P.noReg - dt);
      if (P.dead) { P.deadT += dt; P.vx = U.approach(P.vx, 0, 600 * dt); P.vy = Math.min(P.vy + GRAV * dt, MAXFALL); phys.move(P, dt); return; }
      if (I.hit('jump')) P.jumpBuf = 0.13; else P.jumpBuf -= dt;
      const st = P.state;
      if (st === 'lock') updLock(dt);
      else if (st === 'leap') updLeap(dt);
      else if (st === 'zip') updZip(dt);
      else if (st === 'pullup') updPull(dt);
      else if (st === 'hidden') { const s = P.hideSpot; P.x = s.x; P.y = s.y; if (P.jumpBuf > 0) { P.jumpBuf = 0; P.leaveHide(); } }
      else if (st === 'sit') { if (I.axisX() || P.jumpBuf > 0) { P.bench = null; P.setState('ground'); } }
      else if (st === 'hang') updHang(dt);
      else if (st === 'climb') updClimb(dt);
      else if (st === 'ladder') updLadder(dt);
      else if (st === 'swing') updSwing(dt);
      else if (st === 'swim') updSwim(dt);
      else updNormal(dt);
      // stamina + health regen
      const resting = !P.sprinting && P.burstT <= 0 && !P.blocking;
      if (resting) P.stamina = Math.min(P.maxSta(), P.stamina + (P.onGround || P.state === 'hidden' ? 26 : 12) * dt);
      if (P.noReg <= 0 && P.hp < P.maxHp()) P.hp = Math.min(P.maxHp(), P.hp + 4 * dt);
      // cloak trail
      P.trail.unshift({ x: P.x, y: P.y }); if (P.trail.length > 8) P.trail.pop();
      if (P.y > W.pxH + 200) P.die('fell');
    }
  };

  function sta(n) { if (P.stamina < n) return false; P.stamina -= n; return true; }
  function climbSpeed() { return 118 * (GB.has('p1') ? 1.35 : 1); }
  function jumpVel() { return GB.has('p2') ? 555 : 520; }

  // ---------------- ground + air ----------------
  function updNormal(dt) {
    const ix = I.axisX(), wasGround = P.onGround, prevVx = P.vx;
    const carry = !!P.carrying, strong = GB.has('g6');
    // ---- crouch / stance ----
    const feetTx = Math.floor(P.x / T), feetRow = Math.floor((P.y + 1) / T);
    const onLadderTop = wasGround && W.get(feetTx, feetRow) === LADDER;
    let wantCrouch = (I.isDown('crouch') || (I.isDown('down') && wasGround && !onLadderTop)) && !carry;
    if (P.rollT > 0 || P.slideT > 0) wantCrouch = true;
    if (!wantCrouch && P.crouch && !P.canStand()) wantCrouch = true;
    if (wasGround || P.crouch) { P.crouch = wantCrouch; }
    if (!wasGround && !P.rollT && !P.slideT && P.crouch && P.canStand() && !I.isDown('crouch')) P.crouch = false;
    P.h = P.crouch ? LOW : STAND;

    // ---- horizontal ----
    P.sprinting = false;
    if (P.rollT > 0) {
      P.rollT -= dt; P.vx = P.face * Math.max(250, Math.abs(P.vx));
    } else if (P.slideT > 0) {
      P.slideT -= dt; P.vx = U.approach(P.vx, 0, 260 * dt);
      if (Math.abs(P.vx) < 110 || !wasGround) P.slideT = 0;
      if (P.slideT <= 0 && !P.canStand()) { P.crouch = true; }
      if (Math.random() < 0.5) fx('dust', P.x - P.face * 8, P.y, 1);
    } else if (wasGround) {
      let max = P.crouch ? SNEAK : WALK;
      if (!P.crouch && I.isDown('sprint') && ix && P.stamina > 1 && (!carry)) { max = SPRINT; P.sprinting = true; P.stamina -= 9 * dt; }
      if (carry) max *= strong ? 0.9 : 0.55;
      if (P.blocking) max = 60;
      P.vx = U.approach(P.vx, ix * max, (ix ? 1700 : 2300) * dt);
      if (ix) P.face = ix;
      if (I.hit('crouch') && Math.abs(P.vx) > 240 && !carry) { P.slideT = 0.75; P.vx *= 1.12; P.crouch = true; P.h = LOW; GB.sfx('slide'); noise(P.x, P.y, 90, 'slide'); }
    } else {
      const sp = I.isDown('sprint') ? SPRINT : WALK;
      const cap = Math.max(sp * (GB.has('p2') ? 1.0 : 0.94), Math.abs(P.vx));
      if (ix) { P.vx = U.approach(P.vx, ix * cap, 950 * dt); P.face = ix; } else P.vx = U.approach(P.vx, 0, 400 * dt);
      P.sprinting = I.isDown('sprint') && Math.abs(P.vx) > 250;
    }

    // ---- jump ----
    if (wasGround) { P.coyote = 0.1; P.airJumps = 0; P.wallrunUsed = false; } else P.coyote -= dt;
    let drop = false;
    if (P.jumpBuf > 0 && P.rollT <= 0) {
      if (wasGround && I.isDown('down') && (P.groundT === PLAT || P.groundT === LADDER)) {
        P.jumpBuf = 0;
        if (P.groundT === PLAT && !carry && tryBarHang(true)) return;
        drop = true; P.y += 2; P.coyote = 0;
      } else if (P.coyote > 0 && (P.canStand() || !P.crouch)) {
        const high = P.crouch && Math.abs(P.vx) < 40 && P.canStand();
        P.vy = -(high ? jumpVel() * 1.15 : jumpVel()) * (carry ? (strong ? 0.85 : 0.6) : 1);
        if (P.sprinting) P.vx *= 1.06;
        P.jumpBuf = 0; P.coyote = 0; P.cutJump = true; P.slideT = 0; P.crouch = false; P.h = STAND;
        GB.sfx('jump'); noise(P.x, P.y, 55, 'jump'); fx('dust', P.x, P.y, 3);
      } else if (!wasGround && GB.has('p6') && P.airJumps < 1 && !carry) {
        P.airJumps++; P.vy = -jumpVel() * 0.88; P.jumpBuf = 0; P.cutJump = true; GB.sfx('cloak'); fx('ring', P.x, P.y);
      }
    }
    if (P.cutJump && P.vy < -210 && !I.isDown('jump')) { P.vy = -210; P.cutJump = false; }
    if (P.vy >= 0) P.cutJump = false;
    if (!wasGround && P.vy <= 0) P.fallFrom = P.y;
    if (wasGround) P.fallFrom = P.y;

    P.vy = Math.min(P.vy + GRAV * dt, MAXFALL);
    const preVy = P.vy;
    phys.move(P, dt, drop || (I.isDown('down') && I.isDown('jump') && !wasGround));
    if (P.onGround) P.setState('ground'); else P.setState('air');

    // ---- water ----
    if (W.at(P.x, P.y - 14) === WATER) {
      if (preVy > 300) { GB.sfx('splash'); fx('splash', P.x, Math.floor((P.y - 14) / T) * T); noise(P.x, P.y, Math.min(260, preVy * 0.22), 'splash'); }
      if (P.carrying) GB.combat.dropBody();
      P.setState('swim'); P.crouch = false; P.h = STAND; P.slideT = P.rollT = 0; return;
    }

    // ---- landing ----
    if (P.justLanded) {
      const v = P.landVy || preVy;
      const inHay = GB.stealth ? GB.stealth.softSpotAt(P.x, P.y) : null;
      if (v > 420) {
        let roll = false, dmg = 0;
        if (inHay) { GB.sfx('hayLand'); fx('leaves', P.x, P.y - 10, 'hay'); noise(P.x, P.y, 40, 'land'); }
        else {
          if (v > 640 && (I.isDown('crouch') || I.isDown('down') || GB.has('p4')) && !carry) { roll = true; P.rollT = 0.42; P.crouch = true; P.h = LOW; GB.sfx('roll'); }
          if (v > 930) { dmg = (v - 930) / 5.5; if (roll) dmg *= 0.5; if (GB.has('p4')) dmg *= 0.5; }
          if (v >= MAXFALL - 1 && P.y - P.fallFrom > 30 * T) dmg = 999;
          const loud = v > 800;
          GB.sfx(loud ? 'landHard' : 'land', { vol: U.clamp(v / 900, 0.3, 1) });
          noise(P.x, P.y, (roll ? 0.5 : 1) * U.clamp((v - 380) * 0.3, 20, 230) * (GB.has('g1') ? 0.6 : 1), 'land');
          fx('dust', P.x, P.y, loud ? 8 : 4); if (loud && !roll) { fx('shake', 4); P.landT = 0.22; P.vx *= 0.4; } else P.landT = 0.1;
          if (dmg > 0) P.hurt(dmg);
        }
      } else if (v > 150) { GB.sfx('land', { vol: 0.2, rate: 1.2 }); fx('dust', P.x, P.y, 2); P.landT = 0.06; }
    }
    if (P.dead) return;

    // ---- footsteps ----
    if (P.onGround && Math.abs(P.vx) > 20 && P.slideT <= 0 && P.rollT <= 0) {
      P.stepDist += Math.abs(P.vx) * dt; P.runPhase += Math.abs(P.vx) * dt * 0.058;
      if (P.stepDist > (P.sprinting ? 54 : 40)) {
        P.stepDist = 0;
        const q = GB.has('g1') ? 0.6 : 1;
        if (P.crouch) { GB.sfx('stepSoft', { vol: 0.35 }); }
        else if (P.sprinting) { GB.sfx(P.groundT === PLAT ? 'stepWood' : 'step', { vol: 0.9 }); noise(P.x, P.y, 165 * q, 'step'); if (Math.random() < 0.6) fx('dust', P.x, P.y, 1); }
        else { GB.sfx(P.groundT === PLAT ? 'stepWood' : 'step', { vol: 0.45 }); noise(P.x, P.y, 44 * q, 'step'); }
      }
    } else if (!P.onGround) P.runPhase += dt * 6;

    // ---- context actions ----
    if (carry) return;
    const up = I.isDown('up');
    if (P.onGround) {
      // crouch-walk off an edge -> drop to a hang
      // step / vault
      const dir = P.hitWall || 0;
      if (dir && P.rollT <= 0) {
        const tx = Math.floor((P.x + dir * (P.w / 2 + 3)) / T), fr = Math.floor((P.y - 1) / T);
        const need = P.crouch ? 1 : 2; let free = true;
        for (let k = 1; k <= need; k++) if (W.solid(tx, fr - k)) free = false;
        if (W.solid(tx, fr) && free && phys.boxFree(P.x, P.y - T, P.w, P.h)) {
          P.y -= T; P.x += dir * 3; P.vx = prevVx * 0.92; if (Math.abs(prevVx) > 120) { P.vaultT = 0.26; GB.sfx('vault'); }
        } else if (W.climbable(tx, fr) && W.climbable(tx, fr - 1)) {
          if (Math.abs(prevVx) > 250 && I.isDown('sprint') && sta(10)) startClimb('wall', dir, true);
          else if (up) startClimb('wall', dir, false);
        }
      } else if (up && P.rollT <= 0 && P.slideT <= 0) {
        if (W.at(P.x, P.y - 12) === LADDER) { P.setState('ladder'); P.x = Math.floor(P.x / T) * T + T / 2; P.vx = 0; P.crouch = false; P.h = STAND; }
        else if (W.at(P.x, P.y - 26) === FACADE && P.canStand()) startClimb('face', 0, I.isDown('sprint') && Math.abs(prevVx) > 200 && sta(10));
        else { const d = ix || P.face, tx = Math.floor((P.x + d * (P.w / 2 + 3)) / T), fr = Math.floor((P.y - 1) / T); if (W.climbable(tx, fr) && W.climbable(tx, fr - 1) && P.canStand()) startClimb('wall', d, false); }
      } else if (I.isDown('down') && onLadderTop && !I.isDown('crouch')) {
        P.setState('ladder'); P.x = feetTx * T + T / 2; P.y += 4; P.vx = 0; P.crouch = false; P.h = STAND;
      }
      return;
    }
    // --- airborne ---
    if (wasGround && !P.onGround && P.vy >= 0 && P.vy < 120 && (I.isDown('crouch'))) { if (tryEdgeHang()) return; }
    if (P.swingCd <= 0) for (const s of W.swings) {
      const bx = s.x + Math.sin(s.ang || 0) * s.len, by = s.y + Math.cos(s.ang || 0) * s.len;
      if (Math.abs(bx - P.x) < 30 && Math.abs(by - (P.y - P.h + 6)) < 34) {
        P.swing = s; P.setState('swing'); s.ang = Math.atan2(P.x - s.x, Math.max(20, (P.y - P.h) - s.y)); s.w = U.clamp(P.vx / s.len, -3.2, 3.2); GB.sfx('swing'); P.crouch = false; return;
      }
    }
    if (P.grabCd <= 0 && P.vy > -140) { if (tryLedge(ix || P.face)) return; }
    if (P.hitWall && P.grabCd <= 0) {
      const d = P.hitWall, tx = Math.floor((P.x + d * (P.w / 2 + 3)) / T), cr = Math.floor((P.y - 24) / T);
      if (W.climbable(tx, cr)) {
        if (I.isDown('sprint') && !P.wallrunUsed && Math.abs(prevVx) > 200 && P.vy < 350 && sta(10)) { startClimb('wall', d, true); return; }
        if (up || ix === d) { startClimb('wall', d, false); return; }
      }
    }
    if (up && P.grabCd <= 0 && P.vy > -260 && W.at(P.x, P.y - 26) === FACADE) { startClimb('face', 0, false); return; }
    if (up && W.at(P.x, P.y - 20) === LADDER && P.vy > -100) { P.setState('ladder'); P.x = Math.floor(P.x / T) * T + T / 2; P.vx = 0; P.vy = 0; return; }
    if (up && P.vy > 60 && P.grabCd <= 0) tryBarHang(false);
  }

  function startClimb(kind, d, burst) {
    P.climb = { kind, d }; P.setState('climb'); P.vx = 0; P.crouch = false; P.h = STAND; P.slideT = P.rollT = 0;
    if (d) P.face = d;
    if (burst) { P.burstT = 0.46 * (GB.has('p3') ? 1.5 : 1); P.wallrunUsed = true; GB.sfx('wallrun'); noise(P.x, P.y, 110, 'wallrun'); fx('dust', P.x + (d || 0) * 6, P.y, 4); fx('punch', 0.04); }
    else { P.burstT = 0; P.vy = 0; GB.sfx('grab', { vol: 0.5 }); }
  }

  function tryLedge(d) {
    const handY = P.y - P.h, tx = Math.floor((P.x + d * (P.w / 2 + 4)) / T), ext = GB.has('p5') ? 10 : 0;
    const r0 = Math.floor((handY - 6 - ext) / T), r1 = Math.floor((handY + 14) / T);
    for (let r = r0; r <= r1; r++) {
      if (W.solid(tx, r) && !W.solid(tx, r - 1) && W.get(tx, r) !== W.DOOR) {
        const top = r * T; if (handY < top - 16 - ext || handY > top + 18) continue;
        const hx = d > 0 ? tx * T - P.w / 2 - 0.5 : (tx + 1) * T + P.w / 2 + 0.5, hy = top + STAND + 3;
        if (!phys.boxFree(hx, hy, P.w, STAND - 2)) continue;
        P.exitSpecial(); P.x = hx; P.y = hy; P.vx = P.vy = 0; P.face = d; P.hang = { kind: 'ledge', d, tx, r }; P.h = STAND; P.crouch = false; P.setState('hang');
        GB.sfx('grab'); fx('dust', d > 0 ? tx * T : (tx + 1) * T, top, 2); return true;
      }
    }
    return false;
  }
  function tryEdgeHang() { // just stepped off a solid edge while sneaking: turn and hang
    const d = -P.face, r = Math.floor((P.y + 2) / T), tx = Math.floor((P.x + d * (P.w / 2 + 6)) / T);
    if (!W.solid(tx, r) || W.solid(tx, r - 1)) return false;
    const hx = d > 0 ? tx * T - P.w / 2 - 0.5 : (tx + 1) * T + P.w / 2 + 0.5, hy = r * T + STAND + 3;
    if (!phys.boxFree(hx, hy, P.w, STAND - 2)) return false;
    P.x = hx; P.y = hy; P.vx = P.vy = 0; P.face = d; P.hang = { kind: 'ledge', d, tx, r }; P.crouch = false; P.h = STAND; P.setState('hang'); GB.sfx('grab', { vol: 0.5 }); return true;
  }
  function tryBarHang(fromTop) {
    const tx = Math.floor(P.x / T);
    let r = fromTop ? Math.floor((P.y + 1) / T) : -1;
    if (!fromTop) { const hr = Math.floor((P.y - P.h) / T); for (let k = hr - 1; k <= hr; k++) if (W.get(tx, k) === PLAT && Math.abs(k * T - (P.y - P.h)) < 20) r = k; }
    if (r < 0 || W.get(tx, r) !== PLAT) return false;
    const hy = r * T + T * 0.4 + STAND;
    if (!phys.boxFree(P.x, hy + 2, P.w, STAND)) return false;
    P.exitSpecial(); P.y = hy; P.vx = P.vy = 0; P.hang = { kind: 'bar', d: P.face, tx, r }; P.crouch = false; P.h = STAND; P.setState('hang'); GB.sfx('grab', { vol: 0.5 }); return true;
  }

  function startPull(tx2, ty2, low) {
    P.pull = { x0: P.x, y0: P.y, x1: tx2, y1: ty2, t: 0, dur: GB.has('p5') ? 0.15 : 0.3, low };
    P.hang = null; P.setState('pullup'); GB.sfx('climb');
  }
  function updPull(dt) {
    const p = P.pull; p.t += dt; const k = Math.min(1, p.t / p.dur);
    P.y = U.lerp(p.y0, p.y1, U.ease(Math.min(1, k * 1.4))); P.x = U.lerp(p.x0, p.x1, U.ease(Math.max(0, (k - 0.35) / 0.65)));
    if (k >= 1) { P.x = p.x1; P.y = p.y1; P.vx = P.vy = 0; P.crouch = !!p.low; P.h = p.low ? LOW : STAND; P.onGround = true; P.setState('ground'); P.pull = null; P.fallFrom = P.y; GB.sfx('land', { vol: 0.25, rate: 1.3 }); fx('dust', P.x, P.y, 2); P.landT = 0.1; }
  }

  function updHang(dt) {
    const h = P.hang, ix = I.axisX(); P.vx = P.vy = 0;
    if (h.kind === 'ledge') {
      P.face = h.d;
      if (!W.solid(h.tx, h.r)) { P.hang = null; P.setState('air'); return; }
      const wantUp = P.jumpBuf > 0 || (I.isDown('up') && P.stateT > 0.16) || (ix === h.d && P.stateT > 0.3);
      if (P.jumpBuf > 0 && ix === -h.d) { P.jumpBuf = 0; P.hang = null; P.vx = -h.d * 245; P.vy = -470; P.face = -h.d; P.grabCd = 0.25; P.setState('air'); P.cutJump = false; GB.sfx('jump'); return; }
      if (I.hit('down') || I.hit('crouch') || (I.isDown('down') && P.jumpBuf > 0)) { P.jumpBuf = 0; P.hang = null; P.grabCd = 0.4; P.setState('air'); return; }
      if (wantUp) {
        P.jumpBuf = 0;
        const tx2 = h.d > 0 ? h.tx * T + P.w / 2 + 2 : (h.tx + 1) * T - P.w / 2 - 2, ty2 = h.r * T;
        if (phys.boxFree(tx2, ty2, P.w, STAND)) startPull(tx2, ty2, false);
        else if (phys.boxFree(tx2, ty2, P.w, LOW)) startPull(tx2, ty2, true);
      }
    } else { // hanging under a beam / platform: shimmy
      if (ix) {
        const nx = P.x + ix * 62 * dt, ntx = Math.floor((nx + ix * 5) / T);
        if (W.get(ntx, h.r) === PLAT && phys.boxFree(nx, P.y, P.w, STAND)) { P.x = nx; P.runPhase += dt * 9; P.face = ix; }
      }
      h.tx = Math.floor(P.x / T);
      if (I.hit('down') || I.hit('crouch')) { P.hang = null; P.grabCd = 0.4; P.setState('air'); return; }
      if (P.jumpBuf > 0 || I.hit('up')) {
        P.jumpBuf = 0;
        if (phys.boxFree(P.x, h.r * T, P.w, STAND)) startPull(P.x, h.r * T, false);
        else if (phys.boxFree(P.x, h.r * T, P.w, LOW)) startPull(P.x, h.r * T, true);
      }
    }
  }

  function updClimb(dt) {
    const c = P.climb, ix = I.axisX(), iy = I.axisY(), sp = climbSpeed();
    let burst = false;
    if (P.burstT > 0) { P.burstT -= dt; burst = true; if (Math.random() < 0.4) fx('dust', P.x + (c.d || 0) * 6, P.y, 1); }
    if (c.kind === 'wall') {
      const d = c.d, wtx = Math.floor((P.x + d * (P.w / 2 + 4)) / T);
      P.face = d; P.vx = 0; P.vy = burst ? -430 : iy * sp;
      const chest = W.get(wtx, Math.floor((P.y - 22) / T));
      if (chest === SMOOTH) { P.vy = 230; P.burstT = 0; }
      // jump off / leap up
      if (P.jumpBuf > 0) {
        P.jumpBuf = 0;
        if (I.isDown('down')) { leave(0, 0); return; }
        if (I.isDown('up') && ix !== -d && !burst && sta(12)) { P.burstT = 0.2; GB.sfx('climb'); return; }
        leave(-d * 250, -480); P.face = -d; GB.sfx('jump'); noise(P.x, P.y, 50, 'jump'); return;
      }
      if (P.vy < 0) {
        const ny = P.y + P.vy * dt, hr = Math.floor((ny - STAND - 2) / T);
        if (!W.solid(wtx, hr)) { // top of the wall (or a window): hang on the ledge
          if (W.solid(wtx, hr + 1)) {
            const top = (hr + 1) * T; P.y = top + STAND + 3; P.hang = { kind: 'ledge', d, tx: wtx, r: hr + 1 }; P.climb = null; P.burstT = 0; P.setState('hang');
            if (I.isDown('up') || burst) P.stateT = 0.2; return;
          }
        }
      }
      phys.move(P, dt, true);
      if (Math.abs(P.vy) > 10 || burst) { P.runPhase += dt * (burst ? 16 : 8); P.stepDist += dt; if (P.stepDist > 0.34) { P.stepDist = 0; GB.sfx('climb', { vol: 0.4 }); } }
      if (P.onGround && iy >= 0) { P.climb = null; P.setState('ground'); return; }
      if (!W.solid(wtx, Math.floor((P.y - 22) / T)) && !W.solid(wtx, Math.floor((P.y - 40) / T))) { leave(0, P.vy); return; }
      if (I.hit('crouch')) { leave(0, 0); return; }
    } else { // facade: free climbing in two axes
      P.vx = ix * sp * 0.85; P.vy = burst ? -440 : iy * sp;
      if (ix) P.face = ix;
      if (P.jumpBuf > 0) {
        P.jumpBuf = 0;
        if (I.isDown('down')) { leave(0, 40); return; }
        if (I.isDown('up') && !ix && !burst && sta(12)) { P.burstT = 0.22; GB.sfx('climb'); return; }
        leave(ix * 235, -470); GB.sfx('jump'); noise(P.x, P.y, 50, 'jump'); return;
      }
      const nx = P.x + P.vx * dt, ny = P.y + P.vy * dt;
      const ctx = Math.floor(nx / T), cr = Math.floor((ny - 24) / T), t = W.get(ctx, cr);
      if (t !== FACADE) {
        if (P.vy < 0 && (t === PLAT || W.get(Math.floor(P.x / T), cr) === PLAT)) { // roof edge: mantle
          const mx = W.get(ctx, cr) === PLAT ? nx : P.x;
          if (phys.boxFree(mx, cr * T, P.w, STAND)) { P.climb = null; P.burstT = 0; startPull(mx, cr * T, false); return; }
        }
        if (W.get(Math.floor(P.x / T), cr) !== FACADE) P.vy = Math.max(0, P.vy);
        if (W.get(ctx, Math.floor((P.y - 24) / T)) !== FACADE) P.vx = 0;
        if (W.at(P.x, P.y - 24) !== FACADE) { leave(0, 0); return; }
      }
      phys.move(P, dt, true);
      if (Math.abs(P.vy) + Math.abs(P.vx) > 10) { P.runPhase += dt * (burst ? 16 : 8); P.stepDist += dt; if (P.stepDist > 0.34) { P.stepDist = 0; GB.sfx('climb', { vol: 0.4 }); } }
      if (P.onGround && iy >= 0) { P.climb = null; P.setState('ground'); return; }
      if (I.hit('crouch')) { leave(0, 0); return; }
    }
    function leave(vx, vy) { P.climb = null; P.burstT = 0; P.vx = vx; P.vy = vy; P.grabCd = 0.28; P.cutJump = false; P.fallFrom = P.y; P.setState('air'); }
  }

  function updLadder(dt) {
    const iy = I.axisY(), ix = I.axisX(), sp = 150 * (GB.has('p1') ? 1.35 : 1);
    P.vx = 0; P.vy = iy * sp; P.h = STAND; P.crouch = false;
    if (P.jumpBuf > 0) { P.jumpBuf = 0; P.vx = ix * 170; P.vy = I.isDown('down') ? 0 : -400; P.grabCd = 0.2; P.setState('air'); P.fallFrom = P.y; GB.sfx('jump'); return; }
    const tx = Math.floor(P.x / T);
    if (iy < 0) { // top?
      const fr = Math.floor((P.y - 1 + P.vy * dt) / T);
      if (W.get(tx, fr) !== LADDER && W.get(tx, fr + 1) === LADDER) { P.y = (fr + 1) * T; P.vy = 0; P.onGround = true; P.setState('ground'); return; }
    }
    phys.move(P, dt, true);
    if (iy) { P.runPhase += dt * 9; P.stepDist += dt; if (P.stepDist > 0.3) { P.stepDist = 0; GB.sfx('stepWood', { vol: 0.3 }); noise(P.x, P.y, 26, 'step'); } }
    if (P.onGround && iy >= 0) { P.setState('ground'); return; }
    if (W.at(P.x, P.y - 4) !== LADDER && W.at(P.x, P.y - 30) !== LADDER) { P.setState('air'); P.fallFrom = P.y; }
    if (P.onGround && ix) P.setState('ground');
  }

  function updSwing(dt) {
    const s = P.swing, ix = I.axisX();
    s.w += (-(GRAV / s.len) * Math.sin(s.ang) + ix * 2.6 * Math.cos(s.ang)) * dt; s.w *= (1 - 0.25 * dt); s.ang += s.w * dt;
    s.ang = U.clamp(s.ang, -1.45, 1.45);
    P.x = s.x + Math.sin(s.ang) * s.len; P.y = s.y + Math.cos(s.ang) * s.len + STAND - 6; P.face = s.w >= 0 ? 1 : -1; if (ix) P.face = ix;
    if (!phys.boxFree(P.x, P.y, P.w, STAND)) { s.w *= -0.4; s.ang += s.w * dt * 2; }
    const rel = P.jumpBuf > 0, dropIt = I.hit('down') || I.hit('crouch');
    if (rel || dropIt) {
      P.jumpBuf = 0; const v = s.w * s.len;
      P.vx = v * Math.cos(s.ang) * (rel ? 1.12 : 1); P.vy = -v * Math.sin(s.ang) - (rel ? (GB.has('p6') ? 380 : 290) : 0);
      P.swing = null; P.swingCd = 0.55; P.grabCd = 0.1; P.setState('air'); P.cutJump = false; P.fallFrom = P.y; if (rel) GB.sfx('cloak');
    }
  }

  function updSwim(dt) {
    const ix = I.axisX();
    P.h = STAND; P.crouch = false; P.sprinting = false;
    P.vx = U.approach(P.vx, ix * 105, 500 * dt); if (ix) P.face = ix;
    // find surface
    let r = Math.floor((P.y - 14) / T); while (W.get(Math.floor(P.x / T), r - 1) === WATER) r--;
    const surf = r * T, target = surf + 30;
    if (I.isDown('down')) P.vy = U.approach(P.vy, 110, 600 * dt); else P.vy = U.clamp((target - P.y) * 7, -160, 160);
    if (P.jumpBuf > 0 && P.y < surf + 46) { P.jumpBuf = 0; P.vy = -470; P.setState('air'); P.grabCd = 0; P.fallFrom = P.y; GB.sfx('splash', { vol: 0.5 }); fx('splash', P.x, surf); phys.move(P, dt); return; }
    phys.move(P, dt, true);
    P.runPhase += dt * (ix ? 7 : 3); P.stepDist += dt; if (ix && P.stepDist > 0.5) { P.stepDist = 0; GB.sfx('swim', { vol: 0.4 }); fx('ripple', P.x, surf); }
    if (W.at(P.x, P.y - 14) !== WATER && W.at(P.x, P.y - 2) !== WATER) P.setState('air');
    if (P.hitWall && (I.isDown('up') || ix === P.hitWall)) { // climb out
      const d = P.hitWall, tx = Math.floor((P.x + d * (P.w / 2 + 4)) / T);
      if (W.climbable(tx, Math.floor((P.y - 24) / T))) { startClimb('wall', d, false); } else if (tryLedge(d)) { /* grabbed */ }
    }
    if (I.isDown('up') && W.at(P.x, P.y - 20) === LADDER) { P.setState('ladder'); P.x = Math.floor(P.x / T) * T + T / 2; }
  }

  // ---------------- scripted states ----------------
  function updLock(dt) {
    const l = P.lock; l.t += dt; const k = Math.min(1, l.t / l.dur);
    if (l.tx !== undefined) { const e = U.ease(Math.min(1, k / (l.moveFrac || 0.5))); P.x = U.lerp(l.x0, l.tx, e); P.y = U.lerp(l.y0, l.ty, e) - (l.arc || 0) * Math.sin(Math.PI * Math.min(1, k / (l.moveFrac || 0.5))); }
    if (l.onHit && !l.hit && k >= (l.hitAt || 0.5)) { l.hit = true; l.onHit(); }
    if (k >= 1) {
      P.lock = null; const end = l.onEnd; P.vx = P.vy = 0;
      if (l.endState === 'hidden' && l.spot) { P.hideSpot = l.spot; P.setState('hidden'); }
      else if (l.endState === 'hang' && l.hang) { P.hang = l.hang; P.x = l.x0; P.y = l.y0; P.setState('hang'); }
      else { P.setState('air'); P.onGround = false; P.fallFrom = P.y; }
      if (end) end();
    }
  }
  function updLeap(dt) {
    const l = P.leap; l.t += dt;
    if (l.t < 0) return; // crouch + spring
    const k = Math.min(1, l.t / l.D), vp = l.vp;
    P.x = U.lerp(l.x0, vp.land.x, k); P.y = l.y0 - 200 * l.t + 0.5 * l.g * l.t * l.t;
    P.vy = -200 + l.g * l.t; P.vx = (vp.land.x - l.x0) / l.D;
    if (k >= 1) {
      P.x = vp.land.x; P.y = vp.land.y; P.leap = null; P.vx = P.vy = 0;
      if (vp.land.type === 'water') { P.y += 30; P.setState('swim'); GB.sfx('splash'); fx('splash', P.x, vp.land.y + (W.at(P.x, vp.land.y + 4) === WATER ? 0 : 0)); }
      else { const s = GB.stealth.softSpotAt(P.x, P.y); GB.sfx('hayLand'); fx('leaves', P.x, P.y - 12, 'hay'); fx('leaves', P.x, P.y - 12, 'hay'); if (s) { P.hideSpot = s; P.setState('hidden'); } else P.setState('ground'); }
      fx('shake', 10); fx('punch', 0.1); fx('dust', P.x, P.y, 10); GB.sfx('landHard', { vol: 0.5 }); GB.events.emit('leapEnd', vp);
    }
  }
  function updZip(dt) {
    const z = P.zip; z.t += dt; const dx = z.x - P.x, dy = z.y - (P.y - 30), d = Math.hypot(dx, dy), sp = 820 * dt;
    if (d <= sp + 6 || z.t > 1.6) {
      P.zip = null; P.vx = U.sign(dx) * 60; P.vy = -120; P.grabCd = 0; P.setState('air'); P.fallFrom = P.y;
      const dir = U.sign(dx) || P.face;
      if (!tryLedge(dir)) {
        const tx = Math.floor((P.x + dir * (P.w / 2 + 6)) / T);
        if (W.climbable(tx, Math.floor((P.y - 24) / T))) startClimb('wall', dir, false);
        else if (W.at(P.x, P.y - 26) === FACADE) startClimb('face', 0, false);
      }
      return;
    }
    const nx = P.x + dx / d * sp, ny = P.y + dy / d * sp;
    if (phys.boxFree(nx, ny, P.w, STAND)) { P.x = nx; P.y = ny; } else if (phys.boxFree(P.x, ny, P.w, STAND)) P.y = ny; else if (phys.boxFree(nx, P.y, P.w, STAND)) P.x = nx; else z.t = 9;
    P.vx = dx / d * 400; P.vy = dy / d * 400;
  }
})();
