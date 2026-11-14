// GHOSTBLADE - game flow and main loop
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T, W = GB.world, P = GB.player, A = GB.ai, C = GB.combat, St = GB.stealth, M = GB.missions, I = GB.input, env = GB.env, cam = GB.cam, fx = GB.fx;
  let last = 0, wasOpen = false, saveT = 0, districtId = null, bannerCd = 0, leapSeen = false, fps = 60;

  const game = GB.game = {
    state: 'menu', cinematic: false,
    get mission() { return M.cur ? { def: M.cur.meta } : null; },

    resetWorld() {
      W.build();
      for (const c of W.carts) { c.spot = { type: 'cart', x: c.x, y: c.y, w: 58, h: 30, body: null, fixed: true, dir: c.dir, moving: true }; c.wait = 0; W.hides.push(c.spot); }
      A.populate(); C.reset(); St.reset(); C.torn = {};
      game.cinematic = false; cam.cine = null; fx.sm = null;
    },
    newGame() {
      GB.saveSys.reset(); GB.save.started = true; GB.saveSys.save();
      GB.ui.hide(); game.state = 'play'; M.start(1);
    },
    continueGame() { GB.ui.hide(); game.freeRoam(true); },
    startMission(id) { GB.ui.hide(); M.start(id); },
    restartMission() { GB.ui.hide(); M.restart(); },
    abandonMission() { GB.ui.hide(); M.abandon(); },
    resume() { GB.ui.hide(); },
    quitToMenu() { GB.saveSys.save(); M.cur = null; game.toMenu(); },
    toMenu() {
      game.state = 'menu'; game.resetWorld(); env.set(19.3, 'clear', true); env.rain = 0; env.fog = 0;
      const v = W.viewpoints.find(v => v.id === 'old'); P.reset(v.x - 30, v.y); P.onGround = true; P.setState('ground'); P.face = 1;
      GB.ui.showMainMenu(); if (GB.audio) GB.audio.setMood('menu');
    },
    freeRoam(respawn) {
      const px = P.x, py = P.y;
      M.cur = null; game.resetWorld(); env.locked = false; game.state = 'play';
      if (respawn || P.dead) { const m = W.marks.find(m => m.id === 'mentor'); P.reset(m.x + 40, m.y); cam.snap(); if (env.time < 6 || env.time > 20) env.time = 9; }
      else { const keep = { hp: P.hp }; P.reset(px, py); P.hp = keep.hp; }
      const mentor = W.marks.find(m => m.id === 'mentor'), arm = W.marks.find(m => m.id === 'armory');
      C.interactables.push({ x: mentor.x, y: mentor.y, r: 30, label: 'Speak with the Mentor', act() {
        const nxt = GB.defs.byId(GB.defs.missions, GB.save.unlocked), all = Object.keys(GB.save.missions).length >= 10;
        GB.ui.showDialog([{ who: 'The Mentor', text: all ? 'There are no more names on my list. The city is yours to haunt - every tower, every feather, every perfect night.' : 'Your next contract: "' + nxt.name + '" - ' + nxt.desc + ' Follow the gold marker, or choose it from the mission ledger.' }], () => { });
      } });
      C.interactables.push({ x: arm.x, y: arm.y, r: 30, label: 'Restock equipment', act() { C.refill(); P.hp = P.maxHp(); GB.sfx('pickup'); GB.ui.toast('Equipment restocked'); } });
      for (const s of M.starts()) C.interactables.push({ x: s.x, y: s.y, r: 26, label: 'Begin contract: ' + s.name, when: () => !M.cur && A.combatCount === 0, act() { M.start(s.id); } });
      GB.saveSys.save();
    }
  };

  // ---------- world events ----------
  GB.events.on('sync', vp => {
    const first = !GB.save.viewpoints[vp.id];
    GB.save.viewpoints[vp.id] = true; game.cinematic = true;
    if (GB.audio) { GB.audio.stinger('sync'); GB.sfx('eagle'); }
    GB.ui.banner('SYNCHRONIZED', vp.name, 4200);
    cam.cinematic(vp.x + vp.dir * 260, vp.y + 250, 0.4, 3.4, 1.8, () => { game.cinematic = false; });
    if (first) { const up = GB.prog.addXp(60); GB.ui.toast('Viewpoint discovered - map revealed' + (up ? ' - skill point earned!' : '')); }
    GB.saveSys.save();
  });
  GB.events.on('leapStart', () => { if (!leapSeen) { leapSeen = true; GB.ui.banner('LEAP OF FAITH', '', 2600); } GB.sfx('eagle', { vol: 0.6 }); });
  GB.events.on('playerDied', () => { if (!M.cur) setTimeout(() => { if (P.dead && !M.cur && game.state === 'play') { game.freeRoam(true); GB.ui.toast('You wake in the Hidden District. The city remembers.'); } }, 2200); });
  GB.events.on('lostTrack', () => { if (A.combatCount <= 1) { GB.sfx('cloak', { vol: 0.5, rate: 0.7 }); fx.ring(P.x, P.y); } });
  GB.events.on('detected', () => { if (!M.cur && GB.audio && GB.audio.stinger) GB.audio.stinger('spotted'); });

  function updCarts(dt) {
    for (const c of W.carts) {
      if (c.wait > 0) { c.wait -= dt; c.spot.moving = false; continue; }
      c.x += c.dir * 38 * dt; c.spot.moving = true; c.spot.dir = c.dir;
      if (c.x > c.x1) { c.dir = -1; c.wait = 5; } else if (c.x < c.x0) { c.dir = 1; c.wait = 5; }
      c.spot.x = c.x;
    }
  }
  function updAudio(rdt) {
    const au = GB.audio; if (!au || !au.update) return;
    if (game.state === 'menu') au.setMood('menu');
    else {
      let mood = 'explore'; const z = St.zone;
      if (A.combatCount > 0) mood = A.guards.some(g => !g.dead && g.state === 'combat' && Math.abs(g.x - P.x) < 220 && Math.abs(g.y - P.y) < 80) ? 'combat' : 'detected';
      else if (A.alertLevel >= 3 || A.maxMeter > 0.3) mood = 'suspicious';
      else if (P.crouch || P.state === 'hidden' || (z && !z.safe) || P.light < 0.25) mood = 'stealth';
      au.setMood(mood);
    }
    let crowd = 0; for (const c of A.civs) if (Math.abs(c.x - P.x) < 320 && Math.abs(c.y - P.y) < 120) crowd++;
    const indoor = W.indoorAt(P.x, P.y - 20) ? 1 : 0, high = U.clamp((W.groundY - P.y) / 700, 0, 1);
    au.setAmbience({ rain: env.rain, wind: U.clamp(0.15 + high * 0.6 + (env.weather === 'storm' ? 0.4 : 0), 0, 1), night: 1 - env.dayLight(), crowd: U.clamp(crowd / 7, 0, 1), indoor, water: P.x < 62 * T && !indoor ? 1 : 0 });
    au.setLeapWind(P.state === 'leap' && P.leap && P.leap.t > 0 ? U.clamp(P.leap.t / P.leap.D * 1.6, 0, 1) : 0);
    au.update(rdt);
  }

  function frame(ts, manual) {
    if (!manual) requestAnimationFrame(frame);
    let rdt = (ts - last) / 1000; if (!(rdt > 0)) rdt = 0.016; rdt = Math.min(0.05, rdt); last = ts; fps = U.lerp(fps, 1 / Math.max(rdt, 0.001), 0.05); GB.fps = fps;
    const open = GB.ui.isOpen();
    if (open !== wasOpen) { I.clear(); wasOpen = open; }
    if (game.state === 'menu') {
      GB.time += rdt; GB.dt = rdt; env.update(rdt); A.update(rdt); updCarts(rdt); fx.update(rdt);
      cam.x = 330 * T + Math.sin(GB.time * 0.045) * 900; cam.y = (W.G - 11) * T; cam.zoom = 0.82; cam.scale = GB.render.CH / 720 * cam.zoom; cam.sx = cam.sy = 0;
    } else if (!open) {
      let ts2 = 1;
      if (fx.sm) { fx.sm.t -= rdt; ts2 = fx.sm.scale; if (fx.sm.t <= 0) fx.sm = null; }
      if (P.state === 'leap' && P.leap && P.leap.t > 0.12 && P.leap.t < P.leap.D * 0.82) ts2 = Math.min(ts2, 0.62);
      GB.timeScale = U.damp(GB.timeScale, ts2, 30, rdt);
      const dt = rdt * GB.timeScale; GB.dt = dt; GB.time += dt;
      env.update(dt);
      if (!game.cinematic) { C.update(dt); P.update(dt); }
      A.update(dt); St.update(dt); updCarts(dt); M.update(dt); fx.update(dt);
      cam.update(dt, rdt);
      // city reactions
      if (A.combatCount === 0 && A.alertLevel < 3 && GB.save.notoriety > 0) GB.save.notoriety = Math.max(0, GB.save.notoriety - dt / 22);
      bannerCd -= rdt;
      const z = St.zone, did = z && z.id === 'hq' ? 'hq' : W.underground(P.y) ? districtId : W.districtAt(P.x).id;
      if (did !== districtId) { if (districtId && bannerCd <= 0 && !M.cur) { const d = W.districts.find(d => d.id === did); GB.ui.banner(did === 'hq' ? 'The Hidden District' : d.name, did === 'hq' ? 'Nothing is true here but the blade' : d.tag, 3000); bannerCd = 8; } districtId = did; }
      saveT += rdt; GB.save.playTime += rdt; if (saveT > 20 && !M.cur) { saveT = 0; GB.saveSys.save(); }
      if (!game.cinematic && !P.dead) {
        if (I.rawHit('Escape') || I.hit('pause')) GB.ui.showPause();
        else if (I.hit('map')) GB.ui.showScreen('map');
      }
    }
    if (GB.touch) GB.touch.update();
    GB.render.draw(open ? 0 : GB.dt);
    updAudio(rdt);
    I.endFrame();
  }

  GB._step = n => { for (let i = 0; i < (n || 1); i++) frame(last + 16.67, true); }; // deterministic stepping for tests

  window.addEventListener('load', () => {
    const cv = document.getElementById('game');
    GB.saveSys.load(); I.init(cv); GB.render.init(cv); GB.ui.init();
    const kick = () => { if (GB.audio && GB.audio.init) { GB.audio.init(); GB.saveSys.applySettings(); } };
    window.addEventListener('pointerdown', kick); window.addEventListener('keydown', kick);
    document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play' && !GB.ui.isOpen() && !P.dead) GB.ui.showPause(); });
    game.toMenu();
    requestAnimationFrame(frame);
  });
})();
