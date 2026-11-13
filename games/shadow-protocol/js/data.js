'use strict';
/* ===== SHADOW PROTOCOL :: data — weapons, enemies, themes, missions, upgrades ===== */
const WEAPONS = {
  pistol:   { name: 'PISTOL', mag: 12, reserve: 84, dmg: 30, rate: .17, spread: .03, speed: 1500, pen: 1, reload: 1.1, snd: 'pistol', len: 9, shake: .12, noise: 620, unlock: 0, desc: 'Reliable sidearm. Accurate, quick reload.' },
  silenced: { name: 'SILENCED PISTOL', mag: 12, reserve: 60, dmg: 36, rate: .21, spread: .018, speed: 1400, pen: 1, reload: 1.15, snd: 'silenced', len: 13, shake: .06, noise: 90, unlock: 1, desc: 'Nearly silent. Unaware targets drop in one shot.' },
  smg:      { name: 'SMG', mag: 32, reserve: 192, dmg: 17, rate: .058, spread: .07, speed: 1500, pen: 1, reload: 1.4, snd: 'smg', len: 13, two: true, shake: .08, noise: 600, unlock: 2, desc: 'Bullet hose. Shreds at close range.' },
  dual:     { name: 'DUAL PISTOLS', mag: 24, reserve: 144, dmg: 27, rate: .085, spread: .055, speed: 1500, pen: 1, reload: 1.6, snd: 'dual', len: 9, dual: true, shake: .11, noise: 620, unlock: 3, desc: 'Twice the lead. Pure action-movie energy.' },
  shotgun:  { name: 'SHOTGUN', mag: 6, reserve: 36, dmg: 14, pellets: 9, rate: .62, spread: .17, speed: 1300, pen: 0, reload: 2.0, snd: 'shotgun', len: 17, two: true, shake: .42, noise: 750, unlock: 4, desc: 'Room clearer. Devastating up close.' },
  ar:       { name: 'ASSAULT RIFLE', mag: 30, reserve: 150, dmg: 28, rate: .095, spread: .038, speed: 1750, pen: 2, reload: 1.7, snd: 'ar', len: 19, two: true, shake: .13, noise: 700, unlock: 5, desc: 'Punches through drywall and furniture.' },
  sniper:   { name: 'SNIPER RIFLE', mag: 5, reserve: 25, dmg: 180, rate: 1.0, spread: .003, speed: 2600, pen: 6, reload: 2.3, snd: 'sniper', len: 26, two: true, shake: .5, noise: 900, unlock: 6, desc: 'Penetrates bodies, metal and walls.' }
};
// fire weapons: both set enemies alight (burn damage over time, panic, fire spreads between enemies)
WEAPONS.sawedoff = { name: 'SAWED-OFF (DRAGON\'S BREATH)', mag: 2, reserve: 30, dmg: 12, pellets: 12, rate: .26, spread: .3, speed: 1150, pen: 0, reload: 1.5, snd: 'shotgun', len: 11, two: true, shake: .55, noise: 800, unlock: 1, fire: true, kick: 190, desc: 'Two barrels of incendiary shot. Everything it touches catches fire.' };
WEAPONS.flame = { name: 'FLAMETHROWER', mag: 120, reserve: 360, dmg: 5, pellets: 2, rate: .03, spread: .13, speed: 470, pen: 0, reload: 2.4, snd: 'flame', len: 17, two: true, shake: .015, noise: 380, unlock: 2, flame: true, range: 235, desc: 'A cone of fire. Passes through crowds, ignites them, lights up the dark.' };
const WEAPON_ORDER = ['pistol', 'silenced', 'sawedoff', 'smg', 'flame', 'dual', 'shotgun', 'ar', 'sniper'];

/* enemy archetypes — iq drives cover / flank / dodge decisions */
const ENEMY = {
  guard:    { name: 'Guard', hp: 60, speed: 120, vis: 520, fov: 1.9, react: .55, turn: 5.5, dmg: 9, rate: .5, burst: 2, pause: .9, mag: 8, reload: 1.8, spread: .09, bspeed: 520, range: 520, pref: 280, iq: 1, pts: 100, gun: { len: 9 }, col: { limb: '#b33642', head: '#ff4252', gun: '#666c75', accent: '#ffd0d4' }, cover: .45 },
  assault:  { name: 'Assault', hp: 80, speed: 175, vis: 600, fov: 2.2, react: .38, turn: 7, dmg: 7, rate: .11, burst: 5, pause: .7, mag: 25, reload: 1.6, spread: .12, bspeed: 540, range: 420, pref: 170, iq: 1, pts: 120, gun: { len: 13, two: true }, col: { limb: '#c22f3d', head: '#ff2d3d', gun: '#666c75', accent: '#ffb347' }, cover: .1 },
  tactical: { name: 'Tactical', hp: 95, speed: 150, vis: 680, fov: 2.4, react: .32, turn: 7.5, dmg: 10, rate: .13, burst: 3, pause: .8, mag: 24, reload: 1.7, spread: .065, bspeed: 600, range: 600, pref: 300, iq: 3, pts: 150, gun: { len: 18, two: true }, col: { limb: '#8f2a36', head: '#e23b4a', gun: '#7a808a', accent: '#4fe3ff' }, cover: .9, flank: true },
  heavy:    { name: 'Heavy', hp: 280, speed: 85, vis: 560, fov: 2.2, react: .5, turn: 3.5, dmg: 7, pellets: 5, rate: .85, burst: 1, pause: .2, mag: 6, reload: 2.6, spread: .2, bspeed: 480, range: 380, pref: 190, iq: 1, pts: 250, scale: 1.32, r: 14, gun: { len: 18, two: true }, col: { limb: '#6e1f28', head: '#c4202e', gun: '#50555d', accent: '#ff8a3d' }, cover: 0, heavy: true },
  sniper:   { name: 'Sniper', hp: 50, speed: 110, vis: 1100, fov: 2.0, react: .6, turn: 4, dmg: 45, rate: 1, burst: 1, pause: 1.6, mag: 5, reload: 2.4, spread: .008, bspeed: 1150, range: 1100, pref: 620, iq: 2, pts: 200, gun: { len: 26, two: true }, col: { limb: '#9c2e52', head: '#ff3b7a', gun: '#7a808a', accent: '#ff2d3d' }, cover: .5, sniper: true },
  elite:    { name: 'Elite Agent', hp: 140, speed: 190, vis: 720, fov: 2.8, react: .2, turn: 10, dmg: 11, rate: .14, burst: 4, pause: .5, mag: 16, reload: 1.3, spread: .055, bspeed: 640, range: 560, pref: 230, iq: 4, pts: 300, gun: { len: 9, dual: true }, col: { limb: '#d9dbe0', head: '#ff2d3d', gun: '#8d949e', accent: '#ff2d3d' }, cover: .7, flank: true, dodge: true },
  boss:     { name: 'The Director', hp: 1100, speed: 180, vis: 900, fov: 3.1, react: .15, turn: 10, dmg: 13, rate: .1, burst: 6, pause: .45, mag: 30, reload: 1.2, spread: .06, bspeed: 680, range: 700, pref: 260, iq: 4, pts: 2500, scale: 1.18, r: 13, gun: { len: 9, dual: true }, col: { limb: '#f2f2f2', head: '#ff0f25', gun: '#c9a13c', accent: '#ffd76a' }, cover: .4, flank: true, dodge: true, heavy: true, boss: true }
};

/* building themes drive the level generator */
const THEMES = {
  training:  { floor: '#191b20', floor2: '#1c1e24', wall: '#07080a', edge: '#3d4250', light: ['#dfe8ff'], neon: '#4fe3ff', ambient: .62, glass: .3, dry: .2, doorP: .6, loops: .6, corr: .4, room: 9, minRoom: 4, lightP: 1, lr: 270, rooms: ['office', 'storage', 'meeting', 'empty'] },
  office:    { floor: '#1a1b1f', floor2: '#1d1e23', wall: '#08090b', edge: '#444a58', light: ['#ffe9c4', '#dfe8ff'], neon: '#4fe3ff', ambient: .7, glass: .42, dry: .35, doorP: .7, loops: .7, corr: .8, room: 9, minRoom: 4, lightP: .9, lr: 260, rooms: ['office', 'office', 'meeting', 'lounge', 'security', 'storage'] },
  bunker:    { floor: '#141617', floor2: '#171a1a', wall: '#050606', edge: '#33403a', light: ['#ff5a4a', '#ffb060', '#b9ffd0'], neon: '#ff3b30', ambient: .88, glass: .08, dry: .1, doorP: .8, loops: .5, corr: .9, room: 8, minRoom: 4, lightP: .55, lr: 230, flick: .35, rooms: ['storage', 'security', 'pillars', 'lab', 'empty'] },
  warehouse: { floor: '#1b1916', floor2: '#1f1c18', wall: '#090807', edge: '#4d4436', light: ['#ffc56b'], neon: '#ffb347', ambient: .74, glass: .1, dry: .15, doorP: .35, loops: .9, corr: .2, room: 14, minRoom: 6, lightP: .8, lr: 300, rooms: ['storage', 'storage', 'pillars', 'storage'] },
  roof:      { floor: '#16181d', floor2: '#181a20', wall: '#0a0b0f', edge: '#3b4254', light: ['#8fb8ff', '#ff4fa3'], neon: '#ff4fa3', ambient: .6, glass: .15, dry: 0, voidP: .6, doorP: .1, loops: 1, corr: .2, room: 11, minRoom: 5, lightP: .6, lr: 280, rooms: ['roof', 'roof', 'storage'] },
  lab:       { floor: '#15191d', floor2: '#171c21', wall: '#06080a', edge: '#35566b', light: ['#8ff2ff', '#c8f6ff'], neon: '#4fe3ff', ambient: .9, glass: .65, dry: .1, doorP: .7, loops: .7, corr: .7, room: 9, minRoom: 4, lightP: .5, lr: 240, flick: .25, rooms: ['lab', 'lab', 'security', 'office', 'storage'] },
  parking:   { floor: '#18181a', floor2: '#1a1a1d', wall: '#070708', edge: '#4a4a52', light: ['#fff1c9', '#ffd070'], neon: '#ffd23d', ambient: .8, glass: .05, dry: .05, doorP: .15, loops: 1, corr: .1, room: 16, minRoom: 7, lightP: .7, lr: 290, flick: .2, rooms: ['parking', 'parking', 'storage'] },
  penthouse: { floor: '#1c1a1d', floor2: '#201d21', wall: '#09080a', edge: '#5a4a5e', light: ['#ffd9a0', '#ff8fb8'], neon: '#ff2d3d', ambient: .76, glass: .6, dry: .2, doorP: .6, loops: .9, corr: .5, room: 11, minRoom: 4, lightP: .8, lr: 270, rooms: ['lounge', 'meeting', 'office', 'security', 'lounge'] }
};

const MISSIONS = [
  { name: 'THE INTRODUCTION', sub: 'Training floor. Learn the choreography.', theme: 'training', w: 30, h: 20, seed: 11, enemies: { guard: 6 }, tutorial: true },
  { name: 'OFFICE ASSAULT', sub: 'Glass, desks and a floor full of hired guns.', theme: 'office', w: 42, h: 28, seed: 23, enemies: { guard: 7, assault: 5 } },
  { name: 'UNDERGROUND', sub: 'A dark facility. The lights are your enemy — or your friend.', theme: 'bunker', w: 44, h: 28, seed: 37, enemies: { guard: 6, assault: 5, tactical: 3 } },
  { name: 'THE WAREHOUSE', sub: 'Tactical teams arrive in waves. Barrels are everywhere.', theme: 'warehouse', w: 42, h: 28, seed: 41, enemies: { guard: 4, tactical: 4 }, waves: [{ tactical: 4, assault: 3 }, { tactical: 5, assault: 2, heavy: 1 }] },
  { name: 'ROOFTOP PURSUIT', sub: 'Leap the gaps. Mind the snipers.', theme: 'roof', w: 48, h: 26, seed: 53, enemies: { assault: 6, sniper: 4, guard: 4, tactical: 2 } },
  { name: 'HOSTILE TAKEOVER', sub: 'Heavies hold the executive floor.', theme: 'office', w: 46, h: 30, seed: 67, enemies: { guard: 6, assault: 5, tactical: 4, heavy: 3 } },
  { name: 'NIGHT SHIFT', sub: 'Research wing. Almost no light. Elite agents on site.', theme: 'lab', w: 44, h: 28, seed: 71, enemies: { guard: 5, tactical: 5, elite: 3, sniper: 1 } },
  { name: 'EXTRACTION', sub: 'Hold the parking structure until the ride arrives.', theme: 'parking', w: 42, h: 26, seed: 83, enemies: { assault: 4, guard: 2 }, survive: 110, waves: [{ assault: 4, guard: 2 }, { tactical: 4, assault: 3 }, { assault: 4, heavy: 2 }, { tactical: 4, elite: 2 }, { assault: 5, heavy: 1, elite: 1 }] },
  { name: 'THE SYNDICATE', sub: 'Their best people. All of them.', theme: 'penthouse', w: 48, h: 30, seed: 97, enemies: { elite: 6, tactical: 6, sniper: 3, heavy: 2 } },
  { name: 'FINAL PROTOCOL', sub: 'The Director is waiting at the top.', theme: 'penthouse', w: 44, h: 28, seed: 113, enemies: { elite: 5, tactical: 4, heavy: 2, boss: 1 }, boss: true }
];

const UPGRADES = {
  health:  { name: 'KEVLAR WEAVE', desc: '+25 max health per level', max: 3, cost: [300, 600, 1000] },
  energy:  { name: 'ADRENAL RESERVE', desc: '+25 bullet-time energy per level', max: 3, cost: [300, 600, 1000] },
  regen:   { name: 'FAST RECOVERY', desc: 'Energy regenerates 30% faster per level', max: 2, cost: [400, 900] },
  reload:  { name: 'QUICK HANDS', desc: 'Reload 15% faster per level', max: 2, cost: [350, 800] },
  ammo:    { name: 'DEEP POCKETS', desc: '+35% reserve ammunition per level', max: 2, cost: [250, 600] }
};
const ABILITIES = {
  focus:     { name: 'FOCUS MODE', key: 'RMB', cost: 500, desc: 'Holding aim slows time while your aim stays at full speed. Drains energy.' },
  phantom:   { name: 'PHANTOM SLIDE', key: 'SHIFT', cost: 600, desc: 'Slides travel 60% farther and bullets almost always pass overhead.' },
  reflex:    { name: 'REFLEX', key: 'AUTO', cost: 800, desc: 'A bullet about to hit you triggers an automatic slow-motion window. 9s cooldown.' },
  deadeye:   { name: 'DEAD EYE', key: 'X', cost: 1200, desc: 'Hold X to mark up to 6 targets in frozen time, release to execute them in sequence. 18s cooldown.' },
  laststand: { name: 'LAST STAND', key: 'AUTO', cost: 900, desc: 'At critical health you move and fire faster and take half damage for 6s. 60s cooldown.' }
};
/* difficulty: multipliers on enemy damage, aim spread, reaction time, health, pause between bursts, bullet speed; regen = player hp/s out of combat */
const DIFFS = {
  easy:   { name: 'EASY', dmg: .4, spread: 1.6, react: 1.8, hp: .8, pause: 1.6, bspeed: .82, regen: 8 },
  normal: { name: 'NORMAL', dmg: .75, spread: 1.2, react: 1.25, hp: 1, pause: 1.2, bspeed: .93, regen: 3 },
  hard:   { name: 'HARD', dmg: 1.1, spread: .95, react: .9, hp: 1.1, pause: .9, bspeed: 1.05, regen: 0 }
};
const DIFF = () => DIFFS[Save.data.settings.diff] || DIFFS.easy;
const RANKS = ['C', 'B', 'A', 'S', 'S+'];
