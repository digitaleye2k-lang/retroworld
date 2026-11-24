// Global constants and data definitions for STICK OPS: BLACKOUT
export const GAME_W = 1280;
export const GAME_H = 720;
export const GRAVITY = 1500;

export const DEPTH = {
  sky: 0, far: 2, mid: 4, near: 6, backdrop: 10, decorBack: 20, solids: 30, corpses: 40,
  actors: 50, vehicles: 48, heli: 46, fx: 60, bullets: 65, fxTop: 70, foreground: 80, light: 90, weather: 95, overlay: 99,
};

export const FONT = {
  title: '"Black Ops One", Impact, "Arial Black", sans-serif',
  ui: 'Rajdhani, "Segoe UI", Arial, sans-serif',
};

export const COLORS = {
  ink: 0x07090b,
  inkHex: '#07090b',
  player: 0x0a0d10,
  playerRim: 0x3d7f8f,
  enemyRim: 0x7a2a22,
  vest: 0x1c232a,
  vestEnemy: 0x2a1f1a,
  accent: 0x5ee0ff,
  accentHex: '#5ee0ff',
  danger: 0xff4a3a,
  dangerHex: '#ff4a3a',
  gold: 0xffc34d,
  goldHex: '#ffc34d',
  uiText: '#d9e4ea',
  uiDim: '#7d8f9a',
};

// Weapon definitions. damage per bullet, rate = ms between shots.
export const WEAPONS = {
  rifle: {
    id: 'rifle', slot: 1, name: 'AR-7 VANGUARD', auto: true, damage: 26, rate: 95, mag: 30, reserve: 180,
    reload: 1900, spread: 0.035, adsSpread: 0.012, recoil: 0.045, pellets: 1, speed: 2600, range: 1600,
    shake: 0.0022, sound: 'rifle', tracer: 0xffd27a, penetration: 1, headMult: 2.2, noise: 700, shape: 'rifle',
    lookahead: 240,
  },
  pistol: {
    id: 'pistol', slot: 2, name: 'P9 SIDEARM', auto: false, damage: 34, rate: 170, mag: 15, reserve: 90,
    reload: 1200, spread: 0.03, adsSpread: 0.01, recoil: 0.07, pellets: 1, speed: 2300, range: 1200,
    shake: 0.0018, sound: 'pistol', tracer: 0xffe3a8, penetration: 1, headMult: 2.5, noise: 260, shape: 'pistol',
    lookahead: 200, suppressed: true,
  },
  shotgun: {
    id: 'shotgun', slot: 3, name: 'BREACHER-12', auto: false, damage: 17, rate: 720, mag: 7, reserve: 42,
    reload: 2400, spread: 0.16, adsSpread: 0.11, recoil: 0.16, pellets: 9, speed: 2100, range: 620,
    shake: 0.008, sound: 'shotgun', tracer: 0xffb35a, penetration: 1, headMult: 1.6, noise: 900, shape: 'shotgun',
    lookahead: 180, knockback: 260,
  },
  sniper: {
    id: 'sniper', slot: 4, name: 'LONGBOW .50', auto: false, damage: 140, rate: 1250, mag: 5, reserve: 30,
    reload: 2700, spread: 0.06, adsSpread: 0.0, recoil: 0.22, pellets: 1, speed: 5200, range: 3200,
    shake: 0.011, sound: 'sniper', tracer: 0xbfe9ff, penetration: 3, headMult: 3, noise: 1100, shape: 'sniper',
    lookahead: 520, knockback: 420,
  },
  launcher: {
    id: 'launcher', slot: 5, name: 'M-90 HAMMER', auto: false, damage: 0, rate: 1100, mag: 1, reserve: 4,
    reload: 2200, spread: 0.01, adsSpread: 0.0, recoil: 0.2, pellets: 1, speed: 900, range: 3000,
    shake: 0.012, sound: 'launcher', tracer: 0xff9a40, penetration: 1, headMult: 1, noise: 1200, shape: 'launcher',
    lookahead: 320, rocket: true, splash: 170, splashDamage: 320,
  },
  // enemy weapons
  e_rifle: { id: 'e_rifle', damage: 9, rate: 120, burst: [3, 6], speed: 1500, spread: 0.06, sound: 'erifle', tracer: 0xff8a5c, shape: 'rifle', range: 900 },
  e_shotgun: { id: 'e_shotgun', damage: 7, rate: 900, burst: [1, 1], pellets: 7, speed: 1400, spread: 0.2, sound: 'shotgun', tracer: 0xff8a5c, shape: 'shotgun', range: 380 },
  e_sniper: { id: 'e_sniper', damage: 42, rate: 2600, burst: [1, 1], speed: 3600, spread: 0.004, sound: 'sniper', tracer: 0xff5050, shape: 'sniper', range: 1800 },
  e_lmg: { id: 'e_lmg', damage: 8, rate: 85, burst: [8, 14], speed: 1500, spread: 0.08, sound: 'erifle', tracer: 0xff8a5c, shape: 'lmg', range: 950 },
  e_minigun: { id: 'e_minigun', damage: 6, rate: 55, burst: [20, 34], speed: 1600, spread: 0.1, sound: 'minigun', tracer: 0xffa060, shape: 'minigun', range: 1100 },
};

export const PLAYER_LOADOUT = ['rifle', 'pistol', 'shotgun', 'sniper'];

export const ENEMY_TYPES = {
  rifleman: { hp: 70, speed: 115, weapon: 'e_rifle', sight: 720, reaction: 650, prefer: [260, 560], gear: 'rifleman', score: 100 },
  shotgunner: { hp: 85, speed: 175, weapon: 'e_shotgun', sight: 620, reaction: 450, prefer: [60, 180], gear: 'breacher', score: 120 },
  sniper: { hp: 55, speed: 80, weapon: 'e_sniper', sight: 1500, reaction: 900, prefer: [600, 1400], gear: 'sniper', score: 150, laser: true },
  heavy: { hp: 260, speed: 70, weapon: 'e_lmg', sight: 760, reaction: 800, prefer: [220, 520], gear: 'heavy', score: 250, armor: 0.7 },
  officer: { hp: 90, speed: 120, weapon: 'e_rifle', sight: 760, reaction: 500, prefer: [280, 600], gear: 'officer', score: 180 },
};

export const DIFFICULTY = {
  recruit: { label: 'RECRUIT', dmgTaken: 0.5, enemyAcc: 0.65, enemyHp: 0.85, regenDelay: 3000 },
  regular: { label: 'REGULAR', dmgTaken: 1.0, enemyAcc: 1.0, enemyHp: 1.0, regenDelay: 4000 },
  veteran: { label: 'VETERAN', dmgTaken: 1.6, enemyAcc: 1.3, enemyHp: 1.15, regenDelay: 5500 },
};

export const UPGRADES = [
  { id: 'armor', name: 'CERAMIC PLATES', desc: '+25 max health', cost: 2, max: 2 },
  { id: 'hands', name: 'FAST HANDS', desc: '25% faster reloads', cost: 2, max: 1 },
  { id: 'grenades', name: 'FRAG POUCH', desc: '+2 grenades per checkpoint', cost: 1, max: 1 },
  { id: 'ammo', name: 'EXTENDED MAGS', desc: '+30% magazine size', cost: 2, max: 1 },
  { id: 'medic', name: 'COMBAT MEDIC', desc: 'Faster health regeneration', cost: 1, max: 1 },
];

export const MISSIONS = [
  {
    id: 1, code: 'MISSION 01', name: 'NIGHTFALL', location: 'KARVOSK COMPOUND — 02:40 LOCAL',
    summary: 'Infiltrate the compound, disable security and rescue the informant codenamed "SPARROW".',
    briefing: [
      'SPARROW has been held at the Karvosk compound for six days.',
      'He knows where General Varkov is hiding the BLACKOUT network.',
      'Insert under cover of darkness. Kill the power to the security grid.',
      'Get him out alive. Everything depends on it.',
    ],
    stages: ['Mission1'],
  },
  {
    id: 2, code: 'MISSION 02', name: 'EXTRACTION', location: 'VALLEY ROAD — 05:55 LOCAL',
    summary: 'Escape through the battlefield with SPARROW and man the door gun during extraction.',
    briefing: [
      'Your exfil was compromised. Varkov\'s armour is rolling into the valley.',
      'Push through the frontline to LZ HAMMER with SPARROW.',
      'Viper 2-1 will pick you up. Expect heavy resistance in the air.',
      'You\'re on the door gun. Keep that bird in the sky.',
    ],
    stages: ['Mission2', 'HeliGunner'],
  },
  {
    id: 3, code: 'MISSION 03', name: 'BLACKOUT', location: 'IRON SPIRE BASE — 21:10 LOCAL',
    summary: 'Assault the Iron Spire base, destroy the communications centre and down Varkov\'s gunship.',
    briefing: [
      'SPARROW\'s intel checks out. The BLACKOUT network runs from Iron Spire.',
      'Clear the overwatch from the ridge, then hit the base.',
      'Plant charges on the relay cores and level the comms centre.',
      'Varkov will run in his gunship. Do not let him leave this valley.',
    ],
    stages: ['Sniper', 'Mission3'],
  },
  {
    id: 4, code: 'MISSION 04', name: 'IRON DAWN', location: 'SARN VALLEY — 06:10 LOCAL',
    summary: 'Command the tank HAMMER-1 through Colonel Drago\'s armoured line and destroy the MAMMOTH.',
    briefing: [
      'Varkov is dead, but his second-in-command, Colonel Ilyana Drago, escaped south with the BLACKOUT backup codes.',
      'Coalition armour is pushing into the Sarn Valley to cut her off.',
      'You command HAMMER-1. Bunkers, anti-tank teams and her heavy armour stand in the way.',
      'Intelligence reports a super-heavy tank at the valley mouth. Codename: MAMMOTH.',
    ],
    stages: ['Mission4'],
  },
  {
    id: 5, code: 'MISSION 05', name: 'SKYFALL', location: 'KESSEL AIR CORRIDOR — 14:30 LOCAL',
    summary: 'Fly the REAPER strike jet through Drago\'s air defences and bring down the VALKYRIE bomber.',
    briefing: [
      'SPARROW traced the codes to a launch facility called BLACK SUN, beyond the Kessel corridor.',
      'Drago\'s air wing and a SAM network guard the only way in.',
      'You fly REAPER-1. Guns on LMB, missiles on RMB, flares on SPACE.',
      'Her flagship bomber, VALKYRIE, is carrying the second launch key. It does not land.',
    ],
    stages: ['Mission5'],
  },
  {
    id: 6, code: 'MISSION 06', name: 'DEAD CITY', location: 'KESSEL — 18:40 LOCAL',
    summary: 'Shot down over Kessel, fight alongside 3rd Battalion through a city at war to reach SPARROW.',
    briefing: [
      'REAPER-1 went down over the city of Kessel. Ghost ejected into the middle of a war.',
      'Coalition 3rd Battalion is pushing street by street toward Drago\'s command post.',
      'SPARROW is with the battalion HQ. He has the final piece of the BLACK SUN codes.',
      'Link up, hold the line, and get to him. Whatever it takes.',
    ],
    stages: ['Mission6'],
  },
  {
    id: 7, code: 'MISSION 07', name: 'BLACK SUN', location: 'BLACK SUN SILO — 23:55 LOCAL',
    summary: 'Storm the BLACK SUN silo, stop the launch, defeat Colonel Drago and get out alive.',
    briefing: [
      'BLACK SUN is a missile silo. Drago intends to launch at midnight.',
      'Fight through the surface defences and descend into the silo.',
      'Destroy the three launch-control cores, then deal with Drago herself.',
      'This ends tonight. For Rook. For SPARROW.',
    ],
    stages: ['Mission7'],
  },
];
