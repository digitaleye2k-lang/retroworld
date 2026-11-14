// GHOSTBLADE - definitions (skills, gear, outfits, mission metadata) and the save system
(function () {
  'use strict';
  const GB = window.GB;
  const D = GB.defs = {};

  D.skills = [
    // GHOST - stealth
    { id: 'g1', branch: 'ghost', name: 'Soft Soles', desc: 'Footsteps, jumps and landings make 40% less noise.', cost: 1 },
    { id: 'g2', branch: 'ghost', name: 'Swift Blade', desc: 'Silent takedowns are 40% faster and quieter.', cost: 1, req: 'g1' },
    { id: 'g3', branch: 'ghost', name: 'Deep Cover', desc: 'Guards inspect your hiding places half as often.', cost: 2, req: 'g2' },
    { id: 'g4', branch: 'ghost', name: 'Face in the Crowd', desc: 'Blend with crowds from further away and stay blended longer.', cost: 2, req: 'g2' },
    { id: 'g5', branch: 'ghost', name: 'Shadow Veil', desc: 'All guards detect you 25% slower.', cost: 3, req: 'g3' },
    { id: 'g6', branch: 'ghost', name: 'Strong Back', desc: 'Carry bodies at nearly full speed and jump while carrying.', cost: 2, req: 'g3' },
    // PHANTOM - parkour
    { id: 'p1', branch: 'phantom', name: 'Monkey Grip', desc: 'Climb walls and ladders 35% faster.', cost: 1 },
    { id: 'p2', branch: 'phantom', name: 'Long Stride', desc: 'Jump higher and carry more speed through the air.', cost: 1, req: 'p1' },
    { id: 'p3', branch: 'phantom', name: 'Wall Dancer', desc: 'Wall runs carry you 50% higher.', cost: 2, req: 'p2' },
    { id: 'p4', branch: 'phantom', name: "Cat's Landing", desc: 'Roll automatically out of long falls and take half fall damage.', cost: 2, req: 'p2' },
    { id: 'p5', branch: 'phantom', name: 'Quick Hands', desc: 'Pull up from ledges twice as fast and grab them from further away.', cost: 2, req: 'p3' },
    { id: 'p6', branch: 'phantom', name: 'Aerialist', desc: 'Unlocks the double jump and stronger rope-swing releases.', cost: 3, req: 'p4' },
    // BLADE - combat
    { id: 'b1', branch: 'blade', name: 'Honed Edge', desc: 'Sword and dagger strikes deal extra damage.', cost: 1 },
    { id: 'b2', branch: 'blade', name: 'Iron Guard', desc: 'A much wider parry window; blocking costs less stamina.', cost: 1, req: 'b1' },
    { id: 'b3', branch: 'blade', name: 'Twin Fangs', desc: 'Double assassination: take down two guards standing together.', cost: 2, req: 'b1' },
    { id: 'b4', branch: 'blade', name: "Death's Dance", desc: 'Chain assassination: after a kill, dash to another nearby guard.', cost: 3, req: 'b3' },
    { id: 'b5', branch: 'blade', name: 'Quick Draw', desc: 'Switch weapons instantly and use gadgets 40% faster.', cost: 1, req: 'b2' },
    { id: 'b6', branch: 'blade', name: 'Riposte', desc: 'A perfect parry automatically counter-kills ordinary guards.', cost: 3, req: 'b5' }
  ];
  D.branches = {
    ghost: { name: 'GHOST', sub: 'Stealth', color: '#7fd6c2' },
    phantom: { name: 'PHANTOM', sub: 'Parkour', color: '#e8b25a' },
    blade: { name: 'BLADE', sub: 'Combat', color: '#d9604c' }
  };

  D.weapons = [
    { id: 'blade', name: 'Hidden Blade', desc: 'Silent. Fast. Concealed - guards never notice it.', cost: 0, dmg: 1, cd: 0.38, concealed: true },
    { id: 'sword', name: 'Short Sword', desc: 'Reliable in open combat. Parries well. Visible when drawn.', cost: 0, dmg: 2, cd: 0.45 },
    { id: 'daggers', name: 'Dual Daggers', desc: 'Very fast strikes. Visible when drawn.', cost: 500, dmg: 1.5, cd: 0.24 }
  ];
  D.gadgets = [
    { id: 'knife', name: 'Throwing Knives', desc: 'Silently drop an unaware guard at range. Retrieve the knife to leave no evidence.', cost: 0, cap: 5 },
    { id: 'coin', name: 'Noise Coins', desc: 'Throw to draw nearby guards toward the sound.', cost: 0, cap: 8 },
    { id: 'smoke', name: 'Smoke Bombs', desc: 'A cloud that blocks vision. Break line of sight and vanish.', cost: 200, cap: 3 },
    { id: 'dart', name: 'Poison Darts', desc: 'Puts a guard to sleep for a while. No kill, no body.', cost: 300, cap: 3 },
    { id: 'flash', name: 'Flash Bombs', desc: 'Blinds every guard who sees it for a few seconds.', cost: 350, cap: 2 },
    { id: 'rope', name: 'Rope Launcher', desc: 'Fire at a wall or rooftop and zip straight to it.', cost: 450, cap: 4 },
    { id: 'decoy', name: 'Clockwork Chirper', desc: 'Place it, walk away. It rattles loudly a few seconds later.', cost: 300, cap: 2 },
    { id: 'bow', name: 'Bow', desc: 'Long range arcing shots. Quiet.', cost: 500, cap: 8 },
    { id: 'crossbow', name: 'Crossbow', desc: 'Flat, fast bolts that punch through elite armour. The click is audible.', cost: 700, cap: 4 }
  ];
  D.upgrades = [
    { id: 'pouch', name: 'Deep Pouches', desc: '+50% ammunition for every gadget.', cost: 400 },
    { id: 'vigor', name: 'Tonic of Vigor', desc: '+25 maximum health.', cost: 450 }
  ];
  D.outfits = [
    { id: 'ghost', name: 'Ghost Robes', desc: 'The order\'s black robes. No special properties.', cost: 0, body: '#0d0d10', cloak: '#16161c', trim: '#c9cfd6' },
    { id: 'shadow', name: 'Shadow Garb', desc: 'Dyed for night work: 25% harder to see in darkness.', cost: 400, body: '#07070a', cloak: '#0c0c18', trim: '#4a5a8a' },
    { id: 'tabard', name: 'Stolen Tabard', desc: 'A guard\'s colours. Guards in restricted areas take far longer to recognise you from a distance.', cost: 600, body: '#141014', cloak: '#6a1e1e', trim: '#d0b070' },
    { id: 'noble', name: 'Noble\'s Coat', desc: 'Fine cloth. Running and loitering draw less suspicion in public.', cost: 800, body: '#101018', cloak: '#3a2a66', trim: '#e6c35a' },
    { id: 'crimson', name: 'Crimson Master', desc: 'Awarded for finishing the campaign. +25 stamina.', cost: -1, body: '#0d0d10', cloak: '#8a1620', trim: '#f0d9a0' }
  ];

  D.missions = [
    { id: 1, name: 'The Initiation', district: 'Hidden District', desc: 'Learn the order\'s craft: movement, shadows and the hidden blade.', par: 420, coins: 150, xp: 100 },
    { id: 2, name: 'The Watchtower', district: 'The Harbor', desc: 'Infiltrate the harbor watchtower and douse its signal fire - unseen.', par: 300, coins: 220, xp: 120 },
    { id: 3, name: 'Silent Footsteps', district: 'The Old Quarter', desc: 'Enter the guardhouse and steal the garrison\'s sealed orders.', par: 300, coins: 260, xp: 140 },
    { id: 4, name: 'The Target', district: 'The Royal District', desc: 'Lord Varric sells the city to its enemies. End him without waking his household.', par: 360, coins: 320, xp: 160 },
    { id: 5, name: 'The Rooftop Escape', district: 'Royal District to Slums', desc: 'The alarm is up. Cross the rooftops while archers hunt you and reach the well.', par: 200, coins: 300, xp: 160 },
    { id: 6, name: 'The Prison', district: 'The Fortress', desc: 'Break into the fortress dungeon and free a captured brother.', par: 420, coins: 380, xp: 200 },
    { id: 7, name: 'The Betrayal', district: 'The Harbor', desc: 'Someone inside the order is selling names. Listen in on the meeting and take the ledger.', par: 360, coins: 380, xp: 200 },
    { id: 8, name: 'The Hunters', district: 'The Whole City', desc: 'Three elite Hunters are combing the city for you. Turn the hunt around.', par: 480, coins: 450, xp: 240 },
    { id: 9, name: 'The Royal Assassination', district: 'The Royal District', desc: 'Infiltrate the royal keep and silence Chancellor Maelis.', par: 480, coins: 550, xp: 280 },
    { id: 10, name: 'The Last Ghost', district: 'The Fortress', desc: 'Climb the citadel. Face the Grand Master. Learn what the order truly is.', par: 600, coins: 800, xp: 400 }
  ];
  D.ranks = [
    { id: 'S+', title: 'Ghost', mult: 2.0 },
    { id: 'S', title: 'Master Assassin', mult: 1.6 },
    { id: 'A', title: 'Skilled', mult: 1.3 },
    { id: 'B', title: 'Capable', mult: 1.0 },
    { id: 'C', title: 'Reckless', mult: 0.7 }
  ];
  D.byId = (list, id) => list.find(e => e.id === id);

  // ---------- save ----------
  const KEY = 'ghostblade_save_v1';
  function fresh() {
    return {
      version: 1, started: false,
      coins: 0, xp: 0, skillPoints: 0, skills: {},
      weapons: { blade: true, sword: true }, weapon: 'blade',
      gadgets: { knife: true, coin: true }, gadget: 'knife',
      upgrades: {},
      outfits: { ghost: true }, outfit: 'ghost',
      missions: {},            // id -> {rank, score, time, challenges:[bool]}
      unlocked: 1,             // highest mission id available
      viewpoints: {}, relics: {}, chests: {},
      notoriety: 0,
      playTime: 0,
      settings: { keys: {}, master: 0.8, music: 0.6, sfx: 0.9, cones: true, shake: true }
    };
  }
  const S = GB.saveSys = {
    data: fresh(),
    exists() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw), f = fresh();
          S.data = Object.assign(f, d);
          S.data.settings = Object.assign(fresh().settings, d.settings || {});
        }
      } catch (e) { S.data = fresh(); }
      S.applySettings();
      return S.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { /* storage unavailable */ } },
    reset() { const keep = S.data.settings; S.data = fresh(); S.data.settings = keep; S.save(); },
    applySettings() {
      GB.input.keys = Object.assign({}, GB.input.DEFAULT_KEYS, S.data.settings.keys || {});
      if (GB.audio && GB.audio.setVolume) GB.audio.setVolume(S.data.settings.master, S.data.settings.music, S.data.settings.sfx);
    },
    setKey(action, code) { S.data.settings.keys[action] = code; S.applySettings(); S.save(); },
    resetKeys() { S.data.settings.keys = {}; S.applySettings(); S.save(); }
  };
  Object.defineProperty(GB, 'save', { get() { return S.data; } });

  // ---------- progression helpers (used by menus and gameplay) ----------
  GB.has = id => !!S.data.skills[id];
  GB.prog = {
    canLearn(id) {
      const s = D.byId(D.skills, id), d = S.data;
      return !!s && !d.skills[id] && d.skillPoints >= s.cost && (!s.req || d.skills[s.req]);
    },
    learn(id) { if (!GB.prog.canLearn(id)) return false; const s = D.byId(D.skills, id); S.data.skillPoints -= s.cost; S.data.skills[id] = true; S.save(); GB.events.emit('progress'); return true; },
    owns(kind, id) { return !!S.data[kind][id]; },             // kind: weapons|gadgets|outfits|upgrades
    canBuy(kind, id) { const it = D.byId(D[kind], id); return !!it && !S.data[kind][id] && it.cost >= 0 && S.data.coins >= it.cost; },
    buy(kind, id) { if (!GB.prog.canBuy(kind, id)) return false; S.data.coins -= D.byId(D[kind], id).cost; S.data[kind][id] = true; S.save(); GB.events.emit('progress'); return true; },
    equip(kind, id) { // kind: weapon|gadget|outfit
      const owned = S.data[kind + 's']; if (!owned[id]) return false; S.data[kind] = id; S.save(); GB.events.emit('progress'); return true;
    },
    gadgetCap(id) { const g = D.byId(D.gadgets, id); return g ? Math.ceil(g.cap * (S.data.upgrades.pouch ? 1.5 : 1)) : 0; },
    addXp(n) { const d = S.data; d.xp += n; let gained = 0; while (d.xp >= GB.prog.xpNeed()) { d.xp -= GB.prog.xpNeed(); d.skillPoints++; d.level = (d.level || 1) + 1; gained++; } return gained; },
    xpNeed() { return 150 + ((S.data.level || 1) - 1) * 40; },
    notorietyLevel() { return Math.min(4, Math.floor(S.data.notoriety / 20)); },
    addNotoriety(n) { S.data.notoriety = GB.util.clamp(S.data.notoriety + n, 0, 100); }
  };
})();
