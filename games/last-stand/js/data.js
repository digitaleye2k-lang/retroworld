'use strict';
/* ===== data: weapons, enemies, levels ===== */
// rate = shots per second; dmg per projectile; ammo = rounds granted on pickup (rifle infinite)
const WEAPONS = {
  rifle:   { name: 'ASSAULT RIFLE', short: 'AR', key: 'R', col: '#ffd84a', rate: 9, dmg: 10, spd: 980, spread: .03, ammo: Infinity, snd: 'rifle', recoil: 3, len: 30, kick: 50, desc: 'Balanced automatic fire' },
  shotgun: { name: 'SHOTGUN', short: 'SG', key: 'S', col: '#ff8a3a', rate: 1.6, dmg: 11, spd: 900, pellets: 8, spread: .2, range: .32, ammo: 30, snd: 'shotgun', recoil: 10, len: 28, kick: 260, desc: 'Close range devastation' },
  laser:   { name: 'LASER RIFLE', short: 'LZ', key: 'L', col: '#4af0ff', rate: 5, dmg: 22, spd: 1500, pierce: 6, ammo: 90, snd: 'laser', recoil: 2, len: 34, kick: 20, desc: 'Piercing energy beams' },
  rocket:  { name: 'ROCKET LAUNCHER', short: 'RL', key: 'M', col: '#ff4a3a', rate: 1.3, dmg: 70, spd: 620, splash: 96, ammo: 14, snd: 'rocket', recoil: 12, len: 36, kick: 140, desc: 'Explosive heavy damage' },
  flame:   { name: 'FLAME THROWER', short: 'FL', key: 'F', col: '#ff6a1a', rate: 26, dmg: 3.2, spd: 440, spread: .16, life: .42, ammo: 260, snd: 'flame', recoil: 0, len: 32, kick: 0, desc: 'Burns everything up close' },
  minigun: { name: 'MINIGUN', short: 'MG', key: 'G', col: '#ffe9a0', rate: 24, dmg: 7, spd: 1100, spread: .09, ammo: 400, snd: 'minigun', recoil: 2, len: 40, kick: 12, spin: true, desc: 'Absurd rate of fire' },
  plasma:  { name: 'PLASMA CANNON', short: 'PC', key: 'P', col: '#c06bff', rate: 1.2, dmg: 30, spd: 700, charge: 1.1, ammo: 18, snd: 'plasma', recoil: 16, len: 38, kick: 300, desc: 'Hold to charge a devastating orb' }
};
const WORDER = ['rifle', 'shotgun', 'laser', 'rocket', 'flame', 'minigun', 'plasma'];

// enemy archetypes: hp, speed, score, size, behaviour flag
const EDEF = {
  soldier:  { hp: 30, spd: 125, score: 100, w: 20, h: 54, col: '#c8323c', fire: 1.35, ai: 'soldier' },
  heavy:    { hp: 150, spd: 55, score: 400, w: 30, h: 60, col: '#8a3a2a', fire: 2.2, ai: 'heavy', armor: .55 },
  sniper:   { hp: 40, spd: 0, score: 250, w: 20, h: 54, col: '#4a6a3a', fire: 3.2, ai: 'sniper' },
  rocketeer:{ hp: 60, spd: 70, score: 300, w: 22, h: 56, col: '#d07a22', fire: 3.4, ai: 'rocket' },
  drone:    { hp: 28, spd: 170, score: 150, w: 34, h: 18, col: '#9aa4b8', fire: 2.0, ai: 'drone', fly: true, robot: true },
  turret:   { hp: 90, spd: 0, score: 250, w: 34, h: 30, col: '#6c7488', fire: 1.4, ai: 'turret', robot: true, static: true },
  kamikaze: { hp: 24, spd: 270, score: 120, w: 24, h: 26, col: '#ff3a3a', fire: 0, ai: 'kamikaze', robot: true },
  shield:   { hp: 70, spd: 80, score: 300, w: 24, h: 56, col: '#3a5a9a', fire: 2.0, ai: 'shield' },
  commander:{ hp: 260, spd: 130, score: 1000, w: 24, h: 58, col: '#f0d040', fire: 1.0, ai: 'commander', armor: .2 }
};

/* Level scripts: themed palettes plus a list of chunk ids the generator lays out left→right.
   Chunk vocabulary is in world.js. Difficulty ramps with position along the level. */
const LEVELS = [
  { id: 'jungle', name: 'JUNGLE ASSAULT', sub: 'OPERATION GREEN HELL', boss: 'IRONROOT', bossSub: 'MECHANICAL GUARDIAN', music: 1,
    pal: { sky: ['#0d2a2a', '#1c4a3a', '#3c6a3a'], far: '#163828', mid: '#1f4a2c', near: '#0d2416', ground: '#3a2a1e', top: '#3caa3a', top2: '#7ad64a', deco: '#0a1a10', fog: 'rgba(120,200,140,.06)', light: '#c8ffb0', water: '#2a6a7a' },
    weather: 'rain', hazard: 'spikes', pool: ['soldier', 'soldier', 'sniper', 'soldier', 'drone', 'turret', 'shield', 'rocketeer', 'heavy'],
    chunks: ['start', 'flat', 'barrels', 'steps', 'gap', 'trees', 'platforms', 'outpost', 'water', 'flat', 'gap', 'check', 'trees', 'barrels', 'turrets', 'spikes', 'platforms', 'water', 'outpost', 'steps', 'check', 'gauntlet', 'trees', 'gap', 'turrets', 'spikes', 'barrels', 'platforms', 'check', 'gauntlet', 'outpost', 'flat', 'arena'] },
  { id: 'desert', name: 'DESERT WARZONE', sub: 'OPERATION DUST STORM', boss: 'DUNE COLOSSUS', bossSub: 'DESERT WAR MACHINE', music: 2,
    pal: { sky: ['#5a2a1a', '#b8582a', '#f0b060'], far: '#b07040', mid: '#8a5030', near: '#5a3020', ground: '#a06a3a', top: '#e8b46a', top2: '#ffd890', deco: '#4a2a18', fog: 'rgba(255,190,120,.08)', light: '#fff0c0', water: '#c8904a' },
    weather: 'sand', hazard: 'quicksand', pool: ['soldier', 'sniper', 'soldier', 'rocketeer', 'drone', 'turret', 'heavy', 'shield', 'sniper', 'commander'],
    chunks: ['start', 'flat', 'dunes', 'ruins', 'gap', 'snipers', 'barrels', 'quicksand', 'flat', 'tank', 'check', 'ruins', 'platforms', 'quicksand', 'dunes', 'turrets', 'snipers', 'gap', 'check', 'tank', 'ruins', 'gauntlet', 'dunes', 'quicksand', 'platforms', 'check', 'snipers', 'tank', 'gauntlet', 'flat', 'arena'] },
  { id: 'factory', name: 'INDUSTRIAL NIGHTMARE', sub: 'OPERATION IRON LUNG', boss: 'FOUNDRY TITAN', bossSub: 'INDUSTRIAL COMBAT ROBOT', music: 3,
    pal: { sky: ['#0c0a10', '#1c1620', '#3a2418'], far: '#1a1820', mid: '#242030', near: '#121018', ground: '#2a2a32', top: '#6a6e7a', top2: '#ffb020', deco: '#08080c', fog: 'rgba(255,140,40,.05)', light: '#ffb060', water: '#5aff3a' },
    weather: 'sparks', hazard: 'toxic', pool: ['soldier', 'kamikaze', 'drone', 'turret', 'shield', 'heavy', 'rocketeer', 'kamikaze', 'commander'],
    chunks: ['start', 'flat', 'conveyor', 'toxic', 'platforms', 'barrels', 'crusher', 'turrets', 'check', 'conveyor', 'gap', 'robots', 'toxic', 'steps', 'crusher', 'outpost', 'check', 'platforms', 'conveyor', 'toxic', 'robots', 'gauntlet', 'crusher', 'check', 'turrets', 'conveyor', 'robots', 'gauntlet', 'flat', 'arena'] },
  { id: 'frozen', name: 'FROZEN FRONTIER', sub: 'OPERATION WHITE OUT', boss: 'CRYO WARDEN', bossSub: 'EXPERIMENTAL ICE MACHINE', music: 4,
    pal: { sky: ['#0a1a34', '#2a4a7a', '#8ab0d8'], far: '#6a8ab0', mid: '#4a6a90', near: '#1c2c48', ground: '#3a4a64', top: '#e8f4ff', top2: '#ffffff', deco: '#12203a', fog: 'rgba(220,240,255,.08)', light: '#d8f0ff', water: '#8ad0ff' },
    weather: 'snow', hazard: 'icicles', pool: ['soldier', 'shield', 'sniper', 'drone', 'heavy', 'rocketeer', 'commander', 'turret', 'kamikaze'],
    chunks: ['start', 'flat', 'ice', 'icicles', 'gap', 'platforms', 'lake', 'barrels', 'check', 'snipers', 'ice', 'steps', 'icicles', 'outpost', 'lake', 'check', 'gap', 'platforms', 'gauntlet', 'icicles', 'lake', 'turrets', 'check', 'snipers', 'ice', 'gauntlet', 'flat', 'arena'] },
  { id: 'fortress', name: 'THE FINAL FORTRESS', sub: 'OPERATION LAST STAND', boss: 'OVERLORD ZERO', bossSub: 'SUPREME COMMANDER', music: 5,
    pal: { sky: ['#12040a', '#3a0a18', '#7a1a20'], far: '#2a0c14', mid: '#3a1220', near: '#16080c', ground: '#2c242a', top: '#8a7a80', top2: '#ff3a4a', deco: '#0a0406', fog: 'rgba(255,40,60,.05)', light: '#ff8080', water: '#ff4a1a' },
    weather: 'embers', hazard: 'lasers', pool: ['soldier', 'shield', 'heavy', 'commander', 'rocketeer', 'kamikaze', 'drone', 'turret', 'sniper', 'commander'],
    chunks: ['start', 'flat', 'lasers', 'turrets', 'platforms', 'mines', 'barrels', 'check', 'robots', 'gap', 'crusher', 'lasers', 'outpost', 'flames', 'check', 'platforms', 'mines', 'gauntlet', 'turrets', 'flames', 'check', 'lasers', 'robots', 'crusher', 'gauntlet', 'check', 'mines', 'outpost', 'gauntlet', 'flat', 'arena'] }
];
const DIFFS = [{ n: 'RECRUIT', dmg: .55, ehp: .8, fire: 1.35, lives: 5 }, { n: 'SOLDIER', dmg: 1, ehp: 1, fire: 1, lives: 3 }, { n: 'VETERAN', dmg: 1.5, ehp: 1.25, fire: .78, lives: 2 }];
const DIFF = () => DIFFS[Save.d.settings.diff] || DIFFS[1];
