// GHOSTBLADE - the ten-mission campaign, objectives, optional challenges and ratings
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T, W = GB.world, P = GB.player, A = GB.ai, C = GB.combat, I = GB.input;
  const G = W.G, fl = W.fl, K = a => I.keyLabel(a);
  const inT = (x0, x1, y0, y1) => P.x >= x0 * T && P.x <= (x1 + 1) * T && P.y >= y0 * T && P.y <= (y1 + 1) * T;
  const calm = () => A.combatCount === 0;
  const zoneOut = id => { const z = GB.stealth.zone; return !z || z.id !== id; };
  const mark = id => W.marks.find(m => m.id === id);
  const spawn = s => A.spawnGuard(Object.assign({ mission: true }, s));
  const noDetect = { text: 'Never be detected', bonus: 100, ok: s => s.detections === 0 };
  const noAlarm = { text: 'Never trigger an alarm', bonus: 60, ok: s => s.alarms === 0 };
  const noKills = { text: 'Kill no one', bonus: 80, ok: s => s.kills === 0 };
  const onlyTarget = { text: 'Kill no one but the target', bonus: 80, ok: s => s.kills === 0 };
  const noGadgets = { text: 'Use no gadgets', bonus: 60, ok: s => s.gadgetsUsed === 0 };
  const underPar = { text: 'Finish under par time', bonus: 60, ok: (s, m) => s.time <= m.meta.par, live: false };

  const DEFS = {
    1: {
      time: 14, weather: 'clear', start: [222, 75],
      intro: [{ who: 'The Mentor', text: 'So. The blade has chosen you. Before the city learns your name, the order must learn your worth.' }, { who: 'The Mentor', text: 'Three truths, initiate. Move as water. Wait as stone. Strike once.' }],
      outro: [{ who: 'The Mentor', text: 'You fell, and the city caught you. Remember that feeling. It is the only faith we keep.' }],
      setup() { spawn({ type: 'guard', tx: 273, row: 75, face: 1, dummy: true, tag: 'dummy', pers: 'stoic' }); spawn({ type: 'guard', tx: 282, row: 75, p: [279, 290], dummy: true, tag: 'dummy' }); },
      tick(dt, m) { if (m.idx < 6 && !A.guards.some(g => g.tag === 'dummy' && !g.dead)) { spawn({ type: 'guard', tx: m.idx <= 3 ? 273 : 288, row: 75, face: 1, p: m.idx <= 3 ? null : [279, 290], dummy: true, tag: 'dummy' }); GB.ui.toast('Another warden steps onto the floor'); } },
      objectives: [
        { text: 'Vault the step and climb the training wall', hint: () => `${K('left')}/${K('right')} move  -  ${K('jump')} jump  -  hold ${K('up')} against a wall to climb. Run into the low step to vault it.`, mk: [259, 72], test: () => P.onGround && P.y <= 72 * T + 1 && inT(258, 261, 66, 72) },
        { text: 'Wall-run to the top of the tall pillar', hint: () => `Hold ${K('sprint')} and run straight at the pillar to run up it, then ${K('up')} to keep climbing and pull yourself over the ledge.`, mk: [264, 66], test: () => P.onGround && P.y <= 66 * T + 1 && inT(264, 265, 60, 66) },
        { text: 'Leap to the beam and hang beneath it', hint: () => `Jump to the wooden beam. Standing on it, press ${K('down')} + ${K('jump')} to drop and hang underneath. ${K('left')}/${K('right')} shimmies.`, mk: [273, 69], test: () => P.state === 'hang' && P.hang.kind === 'bar' },
        { text: 'Air-assassinate the warden below', hint: () => `Let go with ${K('down')} and press ${K('assassinate')} while you are falling above him.`, test: m => m.flags.air },
        { text: 'Carry the body and hide it in the haystack', hint: () => `${K('interact')} picks up a body. Carry it to the hay and press ${K('interact')} again. Bodies left in the open get found.`, mk: [284, 75], test: m => m.flags.bodyHidden },
        { text: 'Hide in the haystack and strike from cover', hint: () => `${K('interact')} to hide. Wait for the patrolling warden to walk close, then ${K('assassinate')}. Guards may search cover once they are suspicious.`, mk: [284, 75], test: m => m.flags.hide },
        { text: 'Take the east tunnel to the crypt and climb St. Aldric\'s belfry', hint: () => `Building fronts can be climbed anywhere: hold ${K('up')} in front of one. ${K('crouch')} sneaks silently. Follow the gold marker.`, vp: 'old', test: () => { const v = W.viewpoints.find(v => v.id === 'old'); return Math.abs(P.x - v.x) < 60 && Math.abs(P.y - v.y) < 8; } },
        { text: 'Synchronize at the viewpoint', hint: () => `Walk to the tip of the beam and press ${K('interact')}.`, vp: 'old', test: m => m.flags.sync === 'old' || GB.save.viewpoints.old && m.flags.syncAny },
        { text: 'Take the Leap of Faith', hint: () => `Stand at the tip of the beam, let go of the movement keys and press ${K('jump')}.`, vp: 'old', test: m => m.flags.leapEnd }
      ],
      challenges: [{ text: 'Finish without taking damage', bonus: 40, ok: s => s.damage === 0 }, underPar]
    },
    2: {
      time: 20.6, weather: 'clear', start: [84, G],
      intro: [{ who: 'The Mentor', text: 'The harbor watchtower burns a signal fire. While it burns, the garrison knows the docks are theirs.' }, { who: 'The Mentor', text: 'Put it out. No blood is required - only that no one can say who climbed the tower.' }],
      outro: [{ who: 'The Mentor', text: 'A dark tower. Tonight our ships land unseen. Take these - smoke has saved more of us than steel.' }],
      setup() { spawn({ type: 'guard', tx: 76, p: [72, 82], torch: true }); },
      objectives: [
        { text: 'Reach the top of the watchtower', hint: () => `There is more than one way up: the guarded door, the open windows, or the outer wall. Throw a coin with ${K('gadget')} to pull a guard away.`, mk: [66, 35], test: () => P.onGround && P.y <= 35 * T + 1 && inT(62, 70, 28, 35) },
        { text: 'Douse the signal fire', mk: [66, 35], use: 'brazier', label: 'Douse the signal fire', done() { const L = W.lights.find(l => l.id === 'brazier'); if (L) L.on = false; GB.sfx('torchOut'); } },
        { text: 'Slip away from the tower', hint: () => 'The hay below the west wall will catch you.', test: () => zoneOut('watchtower') && calm() && (P.x > 74 * T || P.x < 61 * T) && P.onGround }
      ],
      challenges: [noDetect, noKills, underPar],
      reward() { if (!GB.save.gadgets.smoke) { GB.save.gadgets.smoke = true; return 'Smoke Bombs added to your equipment'; } }
    },
    3: {
      time: 22, weather: 'fog', start: [296, G],
      intro: [{ who: 'The Mentor', text: 'The garrison\'s sealed orders sit on a desk on the top floor of the guardhouse. They name every patrol in the city.' }, { who: 'The Mentor', text: 'Take them. If a guard notices the empty desk, the alarm will follow - so be gone before he looks.' }],
      outro: [{ who: 'The Mentor', text: 'Every patrol, every watchword. And one name I did not expect to read: Lord Varric pays the garrison from his own purse.' }],
      setup() { W.stealables.find(s => s.id === 'orders').active = true; },
      objectives: [
        { text: 'Steal the sealed orders from the top floor', hint: () => 'The roof hatch, the upper windows and both doors all lead inside. Closets and curtains hide you; open doors make guards curious.', mk: [276, fl(2)], test: m => m.flags.steal === 'orders' },
        { text: 'Vanish into the market crowd', hint: () => 'Walk - do not run - into a group of citizens to blend in. Guards ignore a face in the crowd.', mk: [322, G], test: () => P.blended && inT(300, 338, G - 4, G) && calm() }
      ],
      challenges: [noDetect, noKills, noAlarm]
    },
    4: {
      time: 21, weather: 'rain', start: [412, G],
      intro: [{ who: 'The Mentor', text: 'Lord Varric sleeps badly, they say. Tonight we cure him of it.' }, { who: 'The Mentor', text: 'His chamber is on the top floor, east side. The rain will cover your footsteps. His household must wake to find him - not hear him.' }],
      outro: [{ who: 'The Mentor', text: 'It is done, then. But the estate is roused and the rooftops are filling with archers. Run, ghost. We will speak when you are underground.' }],
      setup() { spawn({ type: 'target', tx: 446, row: fl(2), p: [443, 450], tag: 'target', name: 'Lord Varric', pers: 'lazy' }); },
      objectives: [
        { text: 'Assassinate Lord Varric', hint: () => 'Rain muffles noise. The roof hatch opens directly above his chamber; the east window faces the walled garden.', tag: 'target', test: m => m.flags.targetDead },
        { text: 'Escape the estate', test: () => zoneOut('villa') && calm() && P.onGround }
      ],
      challenges: [onlyTarget, noDetect, { text: 'No bodies discovered', bonus: 60, ok: s => s.bodiesFound === 0 }]
    },
    5: {
      time: 21.5, weather: 'storm', start: [438, fl(3)], limit: 240,
      intro: [{ who: 'The Mentor', text: 'They know a ghost walks the Royal District. Every archer in the city is climbing to the roofs.' }, { who: 'The Mentor', text: 'Take the rope launcher. Do not fight them - outrun them. The well in the Slums. Go.' }],
      outro: [{ who: 'The Mentor', text: 'You breathe. Good. Sit. There is something in Varric\'s ledgers you need to hear - one of our own was captured, and never reported missing.' }],
      setup() {
        if (!GB.save.gadgets.rope) { GB.save.gadgets.rope = true; } GB.save.gadget = 'rope'; C.refill();
        for (const tx of [415, 395, 386, 352, 296, 240, 176]) spawn({ type: 'archer', tx, row: 12, p: [tx - 2, tx + 2] });
        spawn({ type: 'hunter', tx: 452, row: G }); spawn({ type: 'hunter', tx: 400, row: G });
        for (const g of A.guards) if (Math.abs(g.x - P.x) < 900) A.setState(g, 'hunting', { x: P.x, y: P.y });
      },
      objectives: [
        { text: 'Cross the rooftops to the Slums well', hint: () => `${GB.touch && GB.touch.on ? 'Hold ' + K('gadget') + ' and drag to aim, release' : 'Aim with the mouse and press ' + K('gadget')} to fire the rope launcher at a wall or rooftop. Thunder drowns out your noise.`, mk: [205, G], test: () => inT(198, 212, G - 4, G + 2) },
        { text: 'Descend into the Hidden District', mk: [222, 75], test: () => { const z = GB.stealth.zone; return z && z.id === 'hq'; } }
      ],
      challenges: [noKills, { text: 'Arrive in under 2:30', bonus: 80, ok: s => s.time <= 150, live: false }, { text: 'Take no damage', bonus: 60, ok: s => s.damage === 0 }]
    },
    6: {
      time: 23, weather: 'clear', start: [538, G],
      intro: [{ who: 'The Mentor', text: 'Brother Aldous has sat in the fortress dungeon for a month. He knows who sold him.' }, { who: 'The Mentor', text: 'Over the wall from the customs house roof, through the gate under a captain\'s nose, or beneath it all by the old tunnel. Bring him out.' }],
      outro: [{ who: 'Brother Aldous', text: 'They knew my route. My hour. My name. Only someone inside the order could have told them.' }, { who: 'Brother Aldous', text: 'Watch the harbor warehouse. That is where the gold changes hands.' }],
      setup() { const d = W.decor.find(d => d.type === 'prisoner'); if (d) d.freed = false; },
      objectives: [
        { text: 'Get inside the fortress', hint: () => 'Three ways in: climb the wall from the customs house roof, pass the gate, or take the tunnel from the royal well.', test: () => P.x > 557 * T },
        { text: 'Reach the dungeon beneath the prison', mk: [612, 68], test: () => inT(600, 632, 63, 68) },
        { text: 'Free Brother Aldous', mk: [628, 68], use: 'cell', label: 'Free Brother Aldous', done() { const d = W.decor.find(d => d.type === 'prisoner'); if (d) d.freed = true; GB.ui.toast('Aldous slips away into the tunnels'); GB.sfx('door'); } },
        { text: 'Escape the fortress', hint: () => 'The shaft at the west end of the dungeon drops into the old tunnel.', test: () => P.x < 544 * T && calm() }
      ],
      challenges: [noDetect, noAlarm, { text: 'Kill no more than three guards', bonus: 60, ok: s => s.kills <= 3 }]
    },
    7: {
      time: 1, weather: 'fog', start: [84, G],
      intro: [{ who: 'The Mentor', text: 'A garrison captain meets someone in the smugglers\' warehouse tonight. Listen. Do not be seen. Do not kill - I want to know who, not avenge it.' }],
      outro: [{ who: 'The Mentor', text: 'Corvin. I trained him myself.' }, { who: 'The Mentor', text: '...And yet the seal on this ledger is not Corvin\'s. It is the Grand Master\'s own. Say nothing of this. Not yet.' }],
      setup() {
        W.stealables.find(s => s.id === 'ledger').active = true;
        this.corvin = spawn({ type: 'hunter', tx: 105, row: G, face: -1, tag: 'corvin', name: 'Brother Corvin', pers: 'stoic' });
        this.rusk = spawn({ type: 'captain', tx: 102, row: G, face: 1, tag: 'rusk', name: 'Captain Rusk', pers: 'stoic' });
      },
      talk: ['The names, as promised.', 'And the gold, as promised.', 'The Grand Master wants the Mentor gone before winter.', 'Then give me his door. I will bring the garrison.', 'Soon. One ghost still walks free.'],
      objectives: [
        { text: 'Eavesdrop on the meeting unseen', hint: () => 'Get inside the warehouse and stay hidden until they have said enough. The upper floor and the barrels make good cover.', mk: [102, fl(1)], stay: 13, zone: [93, 111, 50, 59] },
        { text: 'Steal the ledger from the upper floor', mk: [100, fl(1)], test: m => m.flags.steal === 'ledger' },
        { text: 'Leave the warehouse unseen', test: () => zoneOut('warehouse') && calm() && P.onGround && (P.x < 90 * T || P.x > 114 * T) }
      ],
      challenges: [noDetect, noKills, noGadgets]
    },
    8: {
      time: 18.5, weather: 'rain', start: [205, G],
      intro: [{ who: 'The Mentor', text: 'Three Hunters have been loosed on the city. They climb as we climb and they search where we hide.' }, { who: 'The Mentor', text: 'They cannot be taken from the front. From above, from behind, from cover - or blinded first. End the hunt.' }],
      outro: [{ who: 'The Mentor', text: 'Three masks. Bring them to the Grand Master, he says, and be honoured. I say: bring them, and look closely at who is not pleased.' }],
      setup() {
        this.hunters = [spawn({ type: 'hunter', tx: 160, p: [130, 224], tag: 'hunter' }), spawn({ type: 'hunter', tx: 330, p: [292, 396], tag: 'hunter' }), spawn({ type: 'hunter', tx: 474, p: [465, 484], tag: 'hunter' })];
        this.trackT = 10;
      },
      tick(dt, m) { this.trackT -= dt; if (this.trackT <= 0) { this.trackT = 14; for (const h of this.hunters) if (!h.dead && h.state !== 'combat' && Math.abs(h.x - P.x) < 1500) { A.setState(h, 'hunting', { x: P.x + U.rand(-260, 260), y: P.y }); h.huntT = 16; h.search = null; h.target = { x: P.x + U.rand(-200, 200), y: P.y }; } } },
      objectives: [{ text: 'Eliminate the three Hunters', hint: () => 'Hunters track you every few moments. Crowds, rooftops and smoke break the trail.', tagAll: 'hunter', count: 3, test: m => m.flags.hunters >= 3 }, { text: 'Return to the Hidden District', mk: [222, 75], test: () => { const z = GB.stealth.zone; return z && z.id === 'hq' && calm(); } }],
      challenges: [{ text: 'Take every Hunter by assassination', bonus: 100, ok: s => s.loudKills === 0 }, { text: 'Take no damage', bonus: 80, ok: s => s.damage === 0 }, noGadgets]
    },
    9: {
      time: 2, weather: 'clear', start: [470, G],
      intro: [{ who: 'The Mentor', text: 'Chancellor Maelis signs the warrants that hang our brothers. Tonight she works late, at the top of the Royal Keep.' }, { who: 'The Mentor', text: 'Five floors. Elite guard. A captain who will ring the bell at a whisper. Leave by the King\'s Tower if you can - it is a long way down, and a fine way.' }],
      outro: [{ who: 'The Mentor', text: 'Before she fell she laughed, you say? "Ask your Grand Master who wrote the list." Then it is true. All of it.' }, { who: 'The Mentor', text: 'He is in the Fortress citadel, under the garrison\'s own protection. The order was never hunted, ghost. It was farmed.' }],
      setup() { spawn({ type: 'target', tx: 522, row: fl(4), p: [517, 527], tag: 'target', name: 'Chancellor Maelis' }); spawn({ type: 'elite', tx: 518, row: fl(4), face: -1, pers: 'stoic' }); },
      objectives: [
        { text: 'Assassinate Chancellor Maelis', hint: () => 'Her study is behind a door on the fourth floor. The west windows, the roof hatch and the postern door are all less watched than the main gate.', tag: 'target', test: m => m.flags.targetDead },
        { text: 'Escape the keep', hint: () => 'The King\'s Tower rises from the roof. A leap from its beam ends in the hay cart far below.', test: () => zoneOut('keep') && calm() && (P.onGround || P.state === 'hidden') }
      ],
      challenges: [onlyTarget, noDetect, { text: 'Leave by the Leap of Faith', bonus: 100, ok: (s, m) => !!m.flags.leapEver, live: false }]
    },
    10: {
      time: 0, weather: 'storm', start: [561, G],
      intro: [{ who: 'The Mentor', text: 'This is the last thing I will ask of you. He is on the citadel roof, watching the storm, waiting to see which of us comes.' }, { who: 'The Mentor', text: 'He taught me everything. He will hear a clumsy step from a floor away. Be the ghost he pretended to be.' }],
      outro: [{ who: 'The Grand Master', text: 'You think... the order ends with me? I sold a hundred names to keep one thing alive. An idea. That someone unseen... is always watching the powerful.' }, { who: 'The Mentor', text: 'He was wrong about the price and right about the idea. The city needs its ghost. It no longer needs an order.' }, { who: 'The Mentor', text: 'Go. Disappear. It is, after all, the art.' }],
      setup() { spawn({ type: 'master', tx: 678, row: fl(6), p: [674, 686], tag: 'target', name: 'The Grand Master', pers: 'vigilant' }); spawn({ type: 'hunter', tx: 658, row: fl(6), p: [652, 662] }); },
      objectives: [
        { text: 'Reach the citadel', hint: () => 'An inner wall guards the citadel. Elite sentries hold its gate; its top can be reached by rope or from the prison roof.', mk: [648, G], test: () => P.x > 646 * T },
        { text: 'Climb to the citadel roof', mk: [662, fl(6)], test: () => P.y <= fl(6) * T + 1 && P.onGround && inT(648, 689, 8, fl(6)) },
        { text: 'End the Grand Master', hint: () => `He cannot be taken from the front once he knows you. Strike from behind or above - or parry with ${K('block')} at the last instant and answer with ${K('assassinate')}.`, tag: 'target', test: m => m.flags.targetDead },
        { text: 'Climb the Ghost Spire and take the last leap', vp: 'citadel', test: m => m.flags.leapEnd === 'citadel' }
      ],
      challenges: [noAlarm, { text: 'The Grand Master never sees you coming', bonus: 150, ok: (s, m) => !m.flags.masterAlerted }, onlyTarget],
      reward() { if (!GB.save.outfits.crimson) { GB.save.outfits.crimson = true; return 'Outfit unlocked: Crimson Master'; } }
    }
  };

  const M = GB.missions = {
    cur: null, defs: DEFS,
    startPos(id) { const d = DEFS[id]; return W.feet(d.start[0], d.start[1] - 2); },
    starts(all) { // mission markers in the world
      if (M.cur && !all) return [];
      const out = []; for (const meta of GB.defs.missions) if (meta.id <= GB.save.unlocked) { const p = M.startPos(meta.id); if (all || !GB.save.missions[meta.id] || meta.id === GB.save.unlocked) out.push({ id: meta.id, x: p.x, y: p.y, name: meta.name, done: !!GB.save.missions[meta.id] }); }
      return out;
    },
    marker() {
      const m = M.cur; if (!m) return null; const o = m.def.objectives[m.idx]; if (!o) return null;
      if (o.vp) { const v = W.viewpoints.find(v => v.id === o.vp); return { x: v.x, y: v.y }; }
      if (o.tag) { const g = A.guards.find(g => g.tag === o.tag && !g.dead); if (g) return { x: g.x, y: g.y }; }
      if (o.tagAll) { let best = null; for (const g of A.guards) if (g.tag === o.tagAll && !g.dead && (!best || Math.abs(g.x - P.x) < Math.abs(best.x - P.x))) best = g; if (best) return { x: best.x, y: best.y }; }
      if (o.mk) return { x: o.mk[0] * T + T / 2, y: o.mk[1] * T };
      return null;
    },
    hud() {
      const m = M.cur; if (!m) return null; const o = m.def.objectives[m.idx]; if (!o) return null;
      let t = o.text; if (o.stay) t += '  ' + Math.floor(m.stayT) + '/' + o.stay + 's'; if (o.count) t += '  ' + (m.flags.hunters || 0) + '/' + o.count;
      const lines = []; if (m.idx > 0) lines.push({ text: m.def.objectives[m.idx - 1].text, done: true }); lines.push({ text: t });
      const info = { title: m.meta.name, lines, challenges: m.def.challenges.map(c => ({ text: c.text, failed: c.live !== false && !c.ok(m.stats, m) })) };
      if (m.def.limit) { info.timer = m.def.limit - m.stats.time; info.timerWarn = info.timer < 30; }
      return info;
    },
    start(id) {
      const def = DEFS[id], meta = GB.defs.byId(GB.defs.missions, id); if (!def || id > GB.save.unlocked) return;
      GB.game.resetWorld();
      const m = M.cur = { id, def, meta, idx: -1, flags: {}, stayT: 0, done: false, stats: { time: 0, kills: 0, loudKills: 0, stealthKills: 0, airKills: 0, detections: 0, alerted: 0, bodiesFound: 0, alarms: 0, evidence: 0, gadgetsUsed: 0, damage: 0 } };
      GB.env.set(def.time, def.weather, true); GB.env.rain = def.weather === 'rain' ? 0.7 : def.weather === 'storm' ? 1 : 0; GB.env.fog = def.weather === 'fog' ? 1 : 0;
      const p = M.startPos(id); P.reset(p.x, p.y); GB.cam.snap(); m.lastHp = P.hp;
      def.setup.call(def, m);
      GB.game.state = 'play';
      GB.ui.showDialog(def.intro, () => { GB.ui.banner(meta.name, meta.district); M.next(); });
    },
    restart() { if (M.cur) M.start(M.cur.id); },
    abandon() { M.cur = null; GB.game.freeRoam(true); },
    next() {
      const m = M.cur; m.idx++; m.stayT = 0; m.flags.leapEnd = null; const o = m.def.objectives[m.idx];
      if (!o) { M.complete(); return; }
      if (m.idx > 0 && GB.audio && GB.audio.stinger) GB.audio.stinger('objective');
      if (o.hint) GB.hud.setHint(o.hint(), 11);
      if (o.use) { const mk = mark(o.use); C.interactables.push({ x: mk.x, y: mk.y, r: 32, ry: 40, label: o.label, when: () => M.cur === m && m.def.objectives[m.idx] === o, act() { if (o.done) o.done(); m.flags['use_' + o.use] = true; } }); }
    },
    update(dt) {
      const m = M.cur; if (!m || m.done || m.idx < 0 || GB.ui.isOpen()) return;
      m.stats.time += dt;
      if (P.hp < m.lastHp - 0.5) m.stats.damage += m.lastHp - P.hp; m.lastHp = P.hp;
      if (m.def.tick) m.def.tick(dt, m);
      if (m.def.limit && m.stats.time > m.def.limit) { M.fail('The net closed. You were too slow.'); return; }
      const o = m.def.objectives[m.idx]; if (!o) return;
      let ok = false;
      if (o.stay) {
        const z = o.zone, hiddenOk = A.combatCount === 0 && A.maxMeter < 0.6 && A.alertLevel < 3;
        if (inT(z[0], z[1], z[2], z[3]) && hiddenOk) { const before = Math.floor(m.stayT / 2.6); m.stayT += dt; const after = Math.floor(m.stayT / 2.6); if (after !== before && m.def.talk && m.def.talk[before]) { const sp = before % 2 ? m.def.corvin : m.def.rusk; if (sp && !sp.dead) A.say(sp, m.def.talk[before]); } }
        ok = m.stayT >= o.stay;
      } else if (o.use) ok = !!m.flags['use_' + o.use];
      else if (o.test) ok = !!o.test(m);
      if (ok) M.next();
    },
    fail(reason) { const m = M.cur; if (!m || m.done) return; m.done = true; if (GB.audio && GB.audio.stinger) GB.audio.stinger('fail'); GB.ui.showFail(reason, () => M.restart(), () => M.abandon()); },
    complete() {
      const m = M.cur, s = m.stats, meta = m.meta; m.done = true; GB.hud.hintT = 0;
      s.evidence = C.evidenceCount();
      let score = 1000 - s.detections * 70 - s.bodiesFound * 45 - s.alarms * 110 - s.kills * 12 - s.evidence * 25 + Math.min(150, s.stealthKills * 30) + Math.min(120, s.airKills * 40);
      score += s.time <= meta.par ? Math.round(200 * (1 - s.time / meta.par * 0.5)) : -Math.min(150, Math.round((s.time - meta.par) / 3));
      const ch = m.def.challenges.map(c => ({ text: c.text, done: !!c.ok(s, m), bonus: c.bonus })); ch.forEach(c => { if (c.done) score += c.bonus; });
      const ghost = s.detections === 0 && s.bodiesFound === 0 && s.alarms === 0;
      const rank = score >= 1250 && ghost ? 'S+' : score >= 1100 && s.detections === 0 ? 'S' : score >= 900 ? 'A' : score >= 650 ? 'B' : 'C', rdef = GB.defs.byId(GB.defs.ranks, rank);
      const prev = GB.save.missions[meta.id], first = !prev, order = ['C', 'B', 'A', 'S', 'S+'];
      const coins = Math.round((meta.coins * rdef.mult + ch.reduce((a, c) => a + (c.done ? c.bonus : 0), 0)) * (first ? 1 : 0.4)), xp = Math.round(meta.xp * rdef.mult * (first ? 1 : 0.3));
      GB.save.coins += coins; let sp = GB.prog.addXp(xp);
      if (first) { GB.save.skillPoints++; sp++; }
      if (rank === 'S+' && (!prev || prev.rank !== 'S+')) { GB.save.skillPoints++; sp++; }
      if (!prev || order.indexOf(rank) > order.indexOf(prev.rank) || score > prev.score) GB.save.missions[meta.id] = { rank: prev && order.indexOf(prev.rank) > order.indexOf(rank) ? prev.rank : rank, score: Math.max(score, prev ? prev.score : 0), time: Math.min(s.time, prev ? prev.time : 1e9), challenges: ch.map((c, i) => c.done || (prev && prev.challenges[i])) };
      if (meta.id >= GB.save.unlocked) GB.save.unlocked = Math.min(10, meta.id + 1);
      if (ghost) GB.prog.addNotoriety(-10);
      const extra = m.def.reward ? m.def.reward() : null;
      GB.saveSys.save();
      if (GB.audio && GB.audio.stinger) GB.audio.stinger('success');
      const result = { missionId: meta.id, name: meta.name, rank, rankTitle: rdef.title, score: Math.round(score), stats: s, challenges: ch, rewards: { coins, xp, skillPoints: sp }, firstTime: first, story: extra ? [extra] : [] };
      const show = () => GB.ui.showResult(result, () => { M.cur = null; GB.game.freeRoam(false); if (meta.id === 10 && first) GB.ui.banner('GHOSTBLADE', 'The city is yours. Move unseen.', 6000); });
      setTimeout(() => { if (M.cur === m) GB.ui.showDialog(m.def.outro, show); }, 900);
    }
  };

  // ---------- stat tracking ----------
  const E = GB.events, cur = () => M.cur && !M.cur.done ? M.cur : null;
  E.on('kill', (g, method) => {
    const m = cur(); if (!m) return; const s = m.stats, f = m.flags;
    if (method !== 'combat') { s.stealthKills++; if (method === 'air') { s.airKills++; f.air = true; } if (method === 'hide') f.hide = true; if (method === 'ledge') f.ledge = true; } else s.loudKills++;
    if (g.tag === 'target') { f.targetDead = true; if (GB.audio && GB.audio.stinger) GB.audio.stinger('kill'); GB.fx.slowmo(0.2, 0.9); }
    else if (g.tag === 'hunter') f.hunters = (f.hunters || 0) + 1;
    else if (g.tag !== 'dummy') s.kills++;
  });
  E.on('detected', g => { const m = cur(); if (!m) return; m.stats.detections++; if (g.cfg.boss) m.flags.masterAlerted = true; if (GB.audio && GB.audio.stinger) GB.audio.stinger('spotted'); });
  E.on('guardAlerted', g => { const m = cur(); if (m) { m.stats.alerted++; if (g.cfg.boss) m.flags.masterAlerted = true; } });
  E.on('bodyFound', () => { const m = cur(); if (m) m.stats.bodiesFound++; });
  E.on('alarm', () => { const m = cur(); if (m) m.stats.alarms++; });
  E.on('gadgetUsed', () => { const m = cur(); if (m) m.stats.gadgetsUsed++; });
  E.on('bodyHidden', () => { const m = cur(); if (m) m.flags.bodyHidden = true; });
  E.on('steal', s => { const m = cur(); if (m) m.flags.steal = s.id; });
  E.on('sync', v => { const m = cur(); if (m) { m.flags.sync = v.id; m.flags.syncAny = true; } });
  E.on('leapEnd', v => { const m = cur(); if (m) { m.flags.leapEnd = v.id; m.flags.leapEver = true; } });
  E.on('playerDied', why => { const m = cur(); if (m) setTimeout(() => M.fail(why === 'fell' ? 'A ghost who cannot land is only a corpse.' : 'You were cut down.'), 1300); });
})();
