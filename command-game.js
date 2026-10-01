(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const rosterEl = document.getElementById("roster");
  const intro = document.getElementById("introPanel");
  const outcome = document.getElementById("outcomePanel");
  const outcomeKicker = document.getElementById("outcomeKicker");
  const outcomeTitle = document.getElementById("outcomeTitle");
  const outcomeText = document.getElementById("outcomeText");
  const startButton = document.getElementById("startButton");
  const briefingButton = document.getElementById("briefingButton");
  const fieldGuide = document.getElementById("fieldGuide");
  const difficultyPicker = document.getElementById("difficultyPicker");
  const restartButton = document.getElementById("restartButton");
  const instructionEl = document.getElementById("instruction");
  const pauseLabel = document.getElementById("pauseLabel");
  const statusText = document.getElementById("statusText");
  const musicTrack = document.getElementById("musicTrack");
  const audioToggle = document.getElementById("audioToggle");
  const audioLabel = document.getElementById("audioLabel");

  // Keep the game logic in stable logical pixels while drawing at the display's
  // native density. This makes the hand-painted detail and small silhouettes
  // substantially cleaner on high-resolution screens without changing input math.
  const W = 1280;
  const H = 720;
  const renderDensity = typeof window === "undefined" ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(W * renderDensity);
  canvas.height = Math.round(H * renderDensity);
  ctx.setTransform(renderDensity, 0, 0, renderDensity, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const TAU = Math.PI * 2;
  const VIEW = { x: 0, y: 42, w: W, h: 548 };
  const WORLD = { w: 2680, h: 1680 };
  const NAV = 32;
  const P = {
    ink: "#11130f", ui: "#171a14", panel: "#20251d", line: "#6e714e",
    paper: "#ead9a5", muted: "#9e9871", gold: "#dbb45f", amber: "#d78049",
    green: "#9ebd7c", red: "#d65f48", blue: "#78b8ce", ground: "#7d7245",
    road: "#ad965f", wall: "#c1a36c", shadow: "rgba(19,16,10,.38)"
  };

  const roads = [
    { x: 40, y: 1340, w: 2580, h: 130 },
    { x: 760, y: 80, w: 130, h: 1510 },
    { x: 140, y: 720, w: 2360, h: 110 },
    { x: 2050, y: 100, w: 135, h: 1500 }
  ];
  const solids = [
    { id: "saloon", type: "building", label: "SALOON", x: 330, y: 1035, w: 340, h: 195, roof: "#794a2f", door: "s" },
    { id: "depot", type: "building", label: "FREIGHT DEPOT", x: 900, y: 210, w: 390, h: 245, roof: "#5f4a35", door: "w" },
    { id: "paymaster", type: "building", label: "PAYMASTER OFFICE", x: 1330, y: 720, w: 340, h: 230, roof: "#70462f", door: "w" },
    { id: "barn", type: "building", label: "STOCKYARD BARN", x: 1810, y: 360, w: 425, h: 280, roof: "#68442d", door: "s" },
    { id: "forge", type: "building", label: "FORGE", x: 960, y: 1245, w: 300, h: 175, roof: "#604a36", door: "n" },
    { id: "ranch", type: "building", label: "RANCH HOUSE", x: 1665, y: 1215, w: 335, h: 215, roof: "#6e4832", door: "s" },
    { id: "signal", type: "building", label: "SIGNAL SHACK", x: 2310, y: 1185, w: 210, h: 150, roof: "#67412d", door: "w" },
    { id: "tower", type: "tower", label: "WATER TOWER", x: 2340, y: 285, r: 95 },
    { id: "railcar", type: "railcar", label: "BOXCAR", x: 710, y: 580, w: 510, h: 112 },
    { id: "wagon", type: "wagon", label: "SUPPLY WAGON", x: 540, y: 950, w: 135, h: 56 },
    { id: "crateA", type: "crate", label: "CRATES", x: 805, y: 1125, w: 95, h: 70 },
    { id: "crateB", type: "crate", label: "CRATES", x: 1710, y: 900, w: 85, h: 65 },
    { id: "crateC", type: "crate", label: "CRATES", x: 2150, y: 1030, w: 95, h: 65 },
    { id: "barrels-west", type: "barrels", label: "BARRELS", x: 460, y: 1330, w: 68, h: 54 },
    { id: "hay-lane", type: "hay", label: "HAY", x: 640, y: 1100, w: 80, h: 55 },
    { id: "sandbags-crossing", type: "sandbags", label: "SANDBAGS", x: 880, y: 870, w: 110, h: 42 },
    { id: "barrels-office", type: "barrels", label: "BARRELS", x: 1535, y: 650, w: 68, h: 54 },
    { id: "sandbags-stockyard", type: "sandbags", label: "SANDBAGS", x: 1815, y: 870, w: 120, h: 42 },
    { id: "rocks-signal", type: "rocks", label: "ROCKS", x: 2200, y: 1455, w: 98, h: 65 },
    { id: "fenceA", type: "fence", label: "FENCE", x: 250, y: 875, w: 290, h: 12 },
    { id: "fenceB", type: "fence", label: "FENCE", x: 1315, y: 1030, w: 270, h: 12 },
    { id: "fenceC", type: "fence", label: "FENCE", x: 2005, y: 925, w: 230, h: 12 },
    { id: "fenceD", type: "fence", label: "FENCE", x: 2200, y: 740, w: 12, h: 260 }
  ];
  const brush = [
    { x: 205, y: 1450, r: 76 }, { x: 360, y: 1480, r: 50 }, { x: 610, y: 1280, r: 48 },
    { x: 620, y: 1040, r: 42 }, { x: 735, y: 500, r: 48 }, { x: 1110, y: 560, r: 46 },
    { x: 1240, y: 1030, r: 50 }, { x: 1640, y: 650, r: 50 }, { x: 2015, y: 720, r: 52 },
    { x: 2200, y: 1380, r: 60 }, { x: 2430, y: 1010, r: 44 }, { x: 2450, y: 500, r: 54 }
  ];
  const cover = [
    { x: 605, y: 978, r: 44 }, { x: 850, y: 1160, r: 50 }, { x: 1000, y: 705, r: 50 },
    { x: 1440, y: 990, r: 52 }, { x: 1752, y: 930, r: 48 }, { x: 2200, y: 1065, r: 50 },
    { x: 2015, y: 950, r: 45 }, { x: 760, y: 845, r: 45 },
    { x: 494, y: 1357, r: 49 }, { x: 680, y: 1127, r: 47 }, { x: 935, y: 891, r: 60 },
    { x: 1569, y: 677, r: 49 }, { x: 1875, y: 891, r: 64 }, { x: 2249, y: 1487, r: 58 }
  ];
  const exit = { x: 60, y: 1365, w: 82, h: 145 };
  const relay = { x: 2225, y: 1295, r: 30, done: false };
  const ledger = { x: 1278, y: 855, r: 27, done: false };
  const cacheSpec = [
    { id: "starter-cache", x: 270, y: 1415, kind: "ammo", amount: 3, label: "BANDOLIER CACHE" },
    { id: "rail-cache", x: 735, y: 500, kind: "ammo", amount: 4, label: "BANDOLIER CACHE" },
    { id: "forge-cache", x: 1292, y: 1460, kind: "ammo", amount: 3, label: "BANDOLIER CACHE" },
    { id: "stockyard-special", x: 1640, y: 650, kind: "special", amount: 2, label: "WHISPER ROUNDS" },
    { id: "ranch-special", x: 2200, y: 1380, kind: "special", amount: 1, label: "WHISPER ROUNDS" }
  ];

  const weapons = {
    pistol: { label: "COLT SIDEARM", range: 185, damage: 1, cooldown: 1.1, capacity: 6, color: "#df924c" },
    rifle: { label: "RANGER RIFLE", range: 285, damage: 2, cooldown: 2.05, capacity: 4, color: "#e2bd64" },
    shotgun: { label: "SCATTERGUN", range: 112, damage: 2, cooldown: 2.4, capacity: 3, color: "#d96d4e" }
  };
  const difficultyLevels = {
    low: { label: "TRAIL", guardHealth: 1, speed: .86, vision: .82, fov: .90, damage: 1, fireDelay: 1.30, spotRate: .74, accuracy: .76, alarm: .75, loudAlarm: .82 },
    standard: { label: "DUST", guardHealth: 2, speed: 1, vision: 1, fov: 1, damage: 1, fireDelay: 1, spotRate: 1, accuracy: 1, alarm: 1, loudAlarm: 1 },
    high: { label: "IRON", guardHealth: 3, speed: 1.10, vision: 1.17, fov: 1.12, damage: 2, fireDelay: .82, spotRate: 1.28, accuracy: 1.14, alarm: 1.25, loudAlarm: 1.18 }
  };
  let difficulty = "standard";
  const heroSpec = [
    { id: "june", key: "1", name: "JUNE MERCER", role: "QUILL · SCOUT", coat: "#3f7186", hat: "#d36c43", skin: "#e2a677", x: 220, y: 1450, speed: 90, health: 3, weapon: "pistol", startAmmo: 4, skill: "SLING SHOT", skillHint: "Stun a guard from range", skillRange: 175, skillKey: "Q" },
    { id: "silas", key: "2", name: "SILAS ROOK", role: "ROOK · RIFLE", coat: "#794a35", hat: "#cda44b", skin: "#d89f74", x: 262, y: 1472, speed: 78, health: 3, weapon: "rifle", startAmmo: 3, skill: "LASSO", skillHint: "Pull and stun a close guard", skillRange: 112, skillKey: "Q" },
    { id: "tomas", key: "3", name: "TOMÁS GARZA", role: "OX · BREACHER", coat: "#647b50", hat: "#5d3d2b", skin: "#ca8b63", x: 174, y: 1495, speed: 68, health: 4, weapon: "shotgun", startAmmo: 2, skill: "SMOKE BOMB", skillHint: "Throw smoke to block sight", skillRange: 190, skillKey: "Q" }
  ];
  const guardSpec = [
    { name: "West Road Watch", weapon: "pistol", x: 650, y: 1410, patrol: [[650,1410],[790,1410],[810,1340],[690,1300]] },
    { name: "Rail Watch", weapon: "shotgun", x: 680, y: 785, patrol: [[680,785],[790,825],[820,875],[730,910]] },
    { name: "Office Watch", weapon: "rifle", x: 1350, y: 585, patrol: [[1350,585],[1450,600],[1500,650],[1400,675]] },
    { name: "Stockyard Watch", weapon: "pistol", x: 1750, y: 700, patrol: [[1750,700],[1850,730],[1900,810],[1780,850]] },
    { name: "Tower Watch", weapon: "rifle", x: 2210, y: 570, patrol: [[2210,570],[2300,610],[2360,670],[2250,710]] },
    { name: "Signal Watch", weapon: "pistol", x: 2110, y: 1060, patrol: [[2110,1060],[2180,1100],[2220,1140],[2080,1130]] },
    { name: "Ranch Watch", weapon: "shotgun", x: 1940, y: 1460, patrol: [[1940,1460],[2070,1480],[2150,1420],[2050,1360]] },
    { name: "Forge Watch", weapon: "rifle", x: 1300, y: 1120, patrol: [[1300,1120],[1400,1150],[1430,1200],[1330,1240]] }
  ];

  const state = {
    started: false, paused: false, won: false, lost: false, elapsed: 0, alarm: 0,
    message: "Move the mouse to a map edge to scroll. Left-click to order; right-click to run, crouch, or quick-fire.",
    messageTime: 6, selection: new Set([0, 1, 2]), focus: 0, action: null,
    camera: { x: 0, y: 850, zoom: .72 }, pointer: { x: -100, y: -100 },
    drag: null, flashes: [], noises: [], smokes: [], specialRounds: 0, specialLoaded: false, lossReason: ""
  };
  let heroes = [];
  let guards = [];
  let caches = [];
  let rosterSignature = "";
  let lastTime = 0;
  let randomSeed = 208921;
  let audioContext = null;
  let audioEnabled = true;
  const terrainSpecks = createSpecks();
  const terrainTufts = createTufts();
  const inventory = {
    weapon: { x: 310, y: 613, w: 225, h: 80 },
    skill: { x: 550, y: 613, w: 250, h: 80 },
    special: { x: 815, y: 613, w: 280, h: 80 }
  };

  function rand() {
    randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  }
  function createSpecks() {
    let seed = 87111;
    const next = () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed / 4294967296;
    };
    return Array.from({ length: 1600 }, () => ({ x: next() * WORLD.w, y: next() * WORLD.h, r: next() < .78 ? 1 : 2, tone: Math.floor(next() * 4) }));
  }
  function createTufts() {
    let seed = 44327;
    const next = () => {
      seed = (seed * 214013 + 2531011) >>> 0;
      return seed / 4294967296;
    };
    return Array.from({ length: 260 }, () => ({
      x: next() * WORLD.w, y: next() * WORLD.h, size: 4 + next() * 7,
      lean: (next() - .5) * 1.1, tone: Math.floor(next() * 3)
    }));
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function angleDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function smoothAngle(a, b, amount) { return a + angleDelta(b, a) * Math.min(1, amount); }
  function timeText(seconds) {
    const value = Math.floor(seconds);
    return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
  }
  function difficultyConfig() { return difficultyLevels[difficulty] || difficultyLevels.standard; }
  function updateDifficultyPicker() {
    if (!difficultyPicker) return;
    for (const button of difficultyPicker.querySelectorAll("[data-difficulty]")) {
      const active = button.dataset.difficulty === difficulty;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }
  function chooseDifficulty(level) {
    if (state.started || !difficultyLevels[level]) return;
    difficulty = level;
    updateDifficultyPicker();
    setMessage(difficultyConfig().label + " difficulty selected. Enemy awareness and firepower are tuned for this contract.", 3);
  }
  function audioContextForSfx() {
    if (!audioEnabled || typeof window === "undefined") return null;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return null;
    try {
      if (!audioContext) audioContext = new AudioEngine();
      if (audioContext.state === "suspended") {
        const resumed = audioContext.resume();
        if (resumed && typeof resumed.catch === "function") resumed.catch(() => {});
      }
      return audioContext;
    } catch (error) {
      return null;
    }
  }
  function tone(context, frequency, duration, volume, options = {}) {
    if (!context) return;
    const start = context.currentTime + (options.delay || 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.wave || "triangle";
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), start);
    if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.endFrequency), start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(.018, duration * .25));
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .03);
  }
  function playSfx(kind) {
    const context = audioContextForSfx();
    if (!context) return;
    if (kind === "start") {
      tone(context, 196, .12, .055, { wave: "triangle" });
      tone(context, 247, .17, .05, { wave: "triangle", delay: .12 });
    } else if (kind === "select") {
      tone(context, 570, .055, .032, { wave: "sine", endFrequency: 690 });
    } else if (kind === "group") {
      tone(context, 350, .06, .028, { wave: "triangle" });
      tone(context, 470, .09, .028, { wave: "triangle", delay: .055 });
    } else if (kind === "order") {
      tone(context, 250, .075, .036, { wave: "triangle", endFrequency: 320 });
    } else if (kind === "run") {
      tone(context, 185, .06, .045, { wave: "square", endFrequency: 130 });
      tone(context, 220, .07, .038, { wave: "square", delay: .07, endFrequency: 155 });
    } else if (kind === "arm") {
      tone(context, 430, .045, .027, { wave: "square" });
      tone(context, 610, .055, .025, { wave: "square", delay: .045 });
    } else if (kind === "heroShot") {
      tone(context, 115, .11, .095, { wave: "sawtooth", endFrequency: 52 });
      tone(context, 760, .035, .028, { wave: "square", delay: .012, endFrequency: 330 });
    } else if (kind === "enemyShot") {
      tone(context, 92, .13, .078, { wave: "sawtooth", endFrequency: 46 });
      tone(context, 510, .05, .025, { wave: "square", delay: .01, endFrequency: 180 });
    } else if (kind === "stun") {
      tone(context, 850, .07, .042, { wave: "sine", endFrequency: 540 });
      tone(context, 690, .14, .036, { wave: "triangle", delay: .05, endFrequency: 250 });
    } else if (kind === "specialShot") {
      tone(context, 740, .045, .026, { wave: "sine", endFrequency: 510 });
      tone(context, 430, .12, .022, { wave: "triangle", delay: .035, endFrequency: 240 });
    } else if (kind === "pickup") {
      tone(context, 392, .055, .03, { wave: "triangle", endFrequency: 493 });
      tone(context, 659, .09, .028, { wave: "sine", delay: .055, endFrequency: 784 });
    } else if (kind === "smoke") {
      tone(context, 170, .28, .045, { wave: "sawtooth", endFrequency: 48 });
    } else if (kind === "alert") {
      tone(context, 310, .12, .055, { wave: "square", endFrequency: 240 });
      tone(context, 310, .12, .055, { wave: "square", delay: .16, endFrequency: 240 });
    } else if (kind === "hit") {
      tone(context, 120, .16, .052, { wave: "sawtooth", endFrequency: 55 });
    } else if (kind === "heroDown") {
      tone(context, 235, .19, .058, { wave: "triangle", endFrequency: 116 });
      tone(context, 168, .30, .062, { wave: "sawtooth", delay: .11, endFrequency: 48 });
      tone(context, 74, .18, .032, { wave: "sine", delay: .24, endFrequency: 42 });
    } else if (kind === "enemyDown") {
      tone(context, 142, .13, .052, { wave: "sawtooth", endFrequency: 57 });
      tone(context, 86, .19, .043, { wave: "triangle", delay: .08, endFrequency: 38 });
    } else if (kind === "objective") {
      tone(context, 392, .09, .04, { wave: "triangle" });
      tone(context, 523, .13, .038, { wave: "triangle", delay: .09 });
      tone(context, 659, .16, .036, { wave: "triangle", delay: .20 });
    } else if (kind === "success") {
      tone(context, 262, .13, .055, { wave: "triangle" });
      tone(context, 330, .14, .052, { wave: "triangle", delay: .13 });
      tone(context, 392, .21, .048, { wave: "triangle", delay: .27 });
    } else if (kind === "failure") {
      tone(context, 196, .16, .055, { wave: "sawtooth", endFrequency: 112 });
      tone(context, 147, .24, .052, { wave: "sawtooth", delay: .16, endFrequency: 72 });
    } else if (kind === "toggle") {
      tone(context, 620, .05, .026, { wave: "sine", endFrequency: 770 });
    }
  }
  function updateAudioUi() {
    if (audioToggle && typeof audioToggle.setAttribute === "function") audioToggle.setAttribute("aria-pressed", String(audioEnabled));
    if (audioLabel) audioLabel.textContent = audioEnabled ? "SOUND ON" : "SOUND OFF";
  }
  function startMusic() {
    if (!audioEnabled || !musicTrack) return;
    musicTrack.volume = .24;
    musicTrack.muted = false;
    const playback = typeof musicTrack.play === "function" ? musicTrack.play() : null;
    if (playback && typeof playback.catch === "function") playback.catch(() => {});
  }
  function setAudioEnabled(enabled, feedback = false) {
    audioEnabled = enabled;
    if (musicTrack) {
      musicTrack.muted = !audioEnabled;
      if (audioEnabled && state.started) startMusic();
    }
    updateAudioUi();
    if (audioEnabled) playSfx("toggle");
    if (feedback) setMessage(audioEnabled ? "Sound on. Music and field effects are live." : "Sound off.", 2.1);
  }
  function startAudio() {
    audioContextForSfx();
    startMusic();
  }
  function setMessage(text, seconds = 3.3) {
    state.message = text;
    state.messageTime = seconds;
    updateDom();
  }
  function viewWorldWidth() { return VIEW.w / state.camera.zoom; }
  function viewWorldHeight() { return VIEW.h / state.camera.zoom; }
  function clampCamera() {
    state.camera.x = clamp(state.camera.x, 0, Math.max(0, WORLD.w - viewWorldWidth()));
    state.camera.y = clamp(state.camera.y, 0, Math.max(0, WORLD.h - viewWorldHeight()));
  }
  function worldToScreen(x, y) {
    return { x: VIEW.x + (x - state.camera.x) * state.camera.zoom, y: VIEW.y + (y - state.camera.y) * state.camera.zoom };
  }
  function screenToWorld(x, y) {
    return { x: state.camera.x + (x - VIEW.x) / state.camera.zoom, y: state.camera.y + (y - VIEW.y) / state.camera.zoom };
  }
  function screenInWorld(x, y) { return x >= VIEW.x && x <= VIEW.x + VIEW.w && y >= VIEW.y && y <= VIEW.y + VIEW.h; }
  function circleRect(x, y, r, box) {
    const px = clamp(x, box.x, box.x + box.w);
    const py = clamp(y, box.y, box.y + box.h);
    return distance(x, y, px, py) < r;
  }
  function terrainOpen(x, y, radius) {
    if (x - radius < 18 || x + radius > WORLD.w - 18 || y - radius < 18 || y + radius > WORLD.h - 18) return false;
    return !solids.some((solid) => solid.type === "tower" ? distance(x, y, solid.x, solid.y) < radius + solid.r : circleRect(x, y, radius, solid));
  }
  function lineOpen(ax, ay, bx, by, radius = 8) {
    const steps = Math.max(2, Math.ceil(distance(ax, ay, bx, by) / 11));
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      if (!terrainOpen(ax + (bx - ax) * t, ay + (by - ay) * t, radius)) return false;
    }
    return true;
  }
  function bodyBlock(actor, x, y) {
    for (const other of [...heroes, ...guards]) {
      if (other === actor || other.down) continue;
      const gap = actor.team === other.team ? 5 : 10;
      if (distance(x, y, other.x, other.y) < actor.radius + other.radius + gap) return other;
    }
    return null;
  }
  function canOccupy(actor, x, y) { return terrainOpen(x, y, actor.radius) && !bodyBlock(actor, x, y); }
  function nearestOpen(point, radius) {
    if (terrainOpen(point.x, point.y, radius)) return { x: point.x, y: point.y };
    for (let ring = 16; ring <= 190; ring += 16) {
      for (let part = 0; part < 24; part += 1) {
        const angle = part / 24 * TAU;
        const x = point.x + Math.cos(angle) * ring;
        const y = point.y + Math.sin(angle) * ring;
        if (terrainOpen(x, y, radius)) return { x, y };
      }
    }
    return null;
  }
  function pathFor(actor, requested) {
    const goal = nearestOpen(requested, actor.radius);
    if (!goal) return [];
    if (lineOpen(actor.x, actor.y, goal.x, goal.y, actor.radius)) return [goal];
    const cols = Math.floor(WORLD.w / NAV);
    const rows = Math.floor(WORLD.h / NAV);
    const nodePoint = (cx, cy) => ({ x: cx * NAV + NAV / 2, y: cy * NAV + NAV / 2 });
    const toCell = (point) => ({ x: clamp(Math.floor(point.x / NAV), 0, cols - 1), y: clamp(Math.floor(point.y / NAV), 0, rows - 1) });
    const start = toCell(actor);
    const end = toCell(goal);
    const key = (x, y) => String(x) + ":" + String(y);
    const startKey = key(start.x, start.y);
    const endKey = key(end.x, end.y);
    const open = [{ x: start.x, y: start.y, f: 0 }];
    const cost = new Map([[startKey, 0]]);
    const parent = new Map();
    const closed = new Set();
    const moves = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.42],[-1,1,1.42],[1,-1,1.42],[-1,-1,1.42]];
    let found = false;
    let limit = 0;
    while (open.length && limit < 5600) {
      limit += 1;
      let best = 0;
      for (let index = 1; index < open.length; index += 1) if (open[index].f < open[best].f) best = index;
      const current = open.splice(best, 1)[0];
      const currentKey = key(current.x, current.y);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      if (currentKey === endKey) {
        found = true;
        break;
      }
      const currentCost = cost.get(currentKey);
      for (const move of moves) {
        const nx = current.x + move[0];
        const ny = current.y + move[1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nextPoint = nodePoint(nx, ny);
        if (!terrainOpen(nextPoint.x, nextPoint.y, actor.radius + 1)) continue;
        if (move[0] && move[1]) {
          const sideA = nodePoint(current.x + move[0], current.y);
          const sideB = nodePoint(current.x, current.y + move[1]);
          if (!terrainOpen(sideA.x, sideA.y, actor.radius + 1) || !terrainOpen(sideB.x, sideB.y, actor.radius + 1)) continue;
        }
        const nextKey = key(nx, ny);
        const nextCost = currentCost + move[2];
        const known = cost.has(nextKey) ? cost.get(nextKey) : Infinity;
        if (nextCost >= known) continue;
        cost.set(nextKey, nextCost);
        parent.set(nextKey, currentKey);
        open.push({ x: nx, y: ny, f: nextCost + Math.hypot(end.x - nx, end.y - ny) });
      }
    }
    if (!found) return [];
    const points = [];
    let cursor = endKey;
    while (cursor && cursor !== startKey) {
      const coords = cursor.split(":").map(Number);
      points.push(nodePoint(coords[0], coords[1]));
      cursor = parent.get(cursor);
    }
    points.reverse();
    points.push(goal);
    const route = [];
    let origin = { x: actor.x, y: actor.y };
    for (let index = 0; index < points.length;) {
      let chosen = index;
      for (let candidate = points.length - 1; candidate > index; candidate -= 1) {
        if (lineOpen(origin.x, origin.y, points[candidate].x, points[candidate].y, actor.radius)) {
          chosen = candidate;
          break;
        }
      }
      route.push(points[chosen]);
      origin = points[chosen];
      index = chosen + 1;
    }
    return route;
  }
  function setRoute(actor, point, mode = "walk") {
    const goal = nearestOpen(point, actor.radius);
    if (!goal) return false;
    actor.goal = goal;
    actor.route = pathFor(actor, goal);
    actor.moveMode = mode;
    actor.moving = actor.route.length > 0;
    actor.blocked = 0;
    return actor.moving;
  }
  function moveActor(actor, dt) {
    if (actor.down || !actor.route.length) {
      actor.moving = false;
      return;
    }
    let target = actor.route[0];
    if (distance(actor.x, actor.y, target.x, target.y) < 7) {
      actor.route.shift();
      if (!actor.route.length) {
        actor.moving = false;
        return;
      }
      target = actor.route[0];
    }
    const heading = Math.atan2(target.y - actor.y, target.x - actor.x);
    const speed = (actor.speed || 72) * (actor.moveMode === "run" ? 1.44 : 1) * (actor.team === "hero" && actor.stance === "crouch" ? .58 : 1);
    const pace = Math.min(speed * dt, distance(actor.x, actor.y, target.x, target.y));
    let moved = false;
    let bodyBlocked = false;
    for (const offset of [0, .3, -.3, .62, -.62, 1.0, -1.0]) {
      const x = actor.x + Math.cos(heading + offset) * pace;
      const y = actor.y + Math.sin(heading + offset) * pace;
      if (canOccupy(actor, x, y)) {
        actor.x = x;
        actor.y = y;
        actor.facing = heading + offset;
        moved = true;
        break;
      }
      if (terrainOpen(x, y, actor.radius) && bodyBlock(actor, x, y)) bodyBlocked = true;
    }
    actor.moving = moved;
    if (!moved) {
      actor.blocked += dt;
      if (!bodyBlocked && actor.blocked > .55 && actor.goal) {
        actor.route = pathFor(actor, actor.goal);
        actor.blocked = 0;
      }
    } else actor.blocked = 0;
  }

  function cloneHero(source) {
    const data = weapons[source.weapon];
    return {
      ...source, team: "hero", radius: 13, maxHealth: source.health, facing: -Math.PI / 2, drawFacing: -Math.PI / 2,
      route: [], goal: null, moving: false, moveMode: "walk", stance: "stand", hidden: false, inBrush: false, inSmoke: false, cover: false,
      down: false, cooldown: 0, skillCooldown: 0, ammo: Math.min(data.capacity, source.startAmmo || data.capacity), maxAmmo: data.capacity,
      phase: rand() * TAU, blocked: 0, hit: 0
    };
  }
  function cloneGuard(source) {
    const data = weapons[source.weapon];
    const tune = difficultyConfig();
    return {
      ...source, team: "guard", radius: 12, health: tune.guardHealth, maxHealth: tune.guardHealth, speed: 43 * tune.speed, data,
      range: data.range, vision: Math.round((data.range * .70 + 92) * tune.vision), fov: Math.PI * .68 * tune.fov,
      standoff: Math.max(105, Math.round(data.range * .66)), damage: tune.damage, fireDelay: tune.fireDelay,
      spotRate: tune.spotRate, accuracy: tune.accuracy, alarmMultiplier: tune.alarm, patrolIndex: 1,
      mode: "patrol", suspicion: 0, lastSeen: null, investigate: null, route: [], goal: null,
      moving: false, moveMode: "walk", facing: 0, drawFacing: 0, phase: rand() * TAU,
      cooldown: .65 + rand() * .35, repath: rand(), blocked: 0, down: false, hit: 0, stunned: 0,
      speech: "", speechTime: 0, barkCooldown: 0
    };
  }
  function reset(started = false) {
    randomSeed = 208921;
    heroes = heroSpec.map(cloneHero);
    guards = guardSpec.map(cloneGuard);
    caches = cacheSpec.map((cache) => ({ ...cache, discovered: false, collected: false }));
    relay.done = false;
    ledger.done = false;
    Object.assign(state, {
      started, paused: false, won: false, lost: false, elapsed: 0, alarm: 0,
      message: "Move the mouse to a map edge to scroll. Left-click to order; right-click to run, crouch, or quick-fire.",
      messageTime: 6, selection: new Set([0,1,2]), focus: 0, action: null,
      camera: { x: 0, y: 850, zoom: .72 }, pointer: { x: -100, y: -100 },
      drag: null, flashes: [], noises: [], smokes: [], specialRounds: 0, specialLoaded: false, lossReason: ""
    });
    clampCamera();
    outcome.classList.add("hidden");
    updateDifficultyPicker();
    updateAudioUi();
    updateDom(true);
  }
  function begin() {
    if (!state.started) {
      reset(true);
      intro.classList.add("hidden");
      if (fieldGuide) fieldGuide.classList.add("hidden");
      if (briefingButton) {
        briefingButton.textContent = "FIELD GUIDE";
        briefingButton.setAttribute("aria-expanded", "false");
      }
    }
    startAudio();
    playSfx("start");
    setMessage(difficultyConfig().label + " difficulty. Pick a hand from the bottom roster; move to a map edge to scroll.", 3.4);
    canvas.focus({ preventScroll: true });
  }
  function finish(won) {
    if (state.won || state.lost) return;
    state.won = won;
    state.lost = !won;
    state.paused = false;
    state.action = null;
    outcome.classList.remove("hidden");
    if (won) {
      outcomeKicker.textContent = "CONTRACT COMPLETE";
      outcomeTitle.textContent = "THE LEDGER VANISHED";
      outcomeText.textContent = "The crew crossed the west gate with the book and the relay silent. Time: " + timeText(state.elapsed) + ".";
    } else {
      outcomeKicker.textContent = "CONTRACT BURNED";
      outcomeTitle.textContent = state.lossReason || "CREW PINNED";
      outcomeText.textContent = "Reset the plan, use the map lanes, and stop patrols with the crew's non-lethal tools.";
    }
    playSfx(won ? "success" : "failure");
    updateDom(true);
  }
  function inZone(zones, actor) { return zones.find((zone) => distance(actor.x, actor.y, zone.x, zone.y) <= zone.r); }
  function pointSegmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / length, 0, 1);
    return distance(px, py, ax + dx * t, ay + dy * t);
  }
  function smokeBlocksLine(a, b) {
    return state.smokes.some((smoke) => pointSegmentDistance(smoke.x, smoke.y, a.x, a.y, b.x, b.y) < smoke.r);
  }
  function refreshActor(actor, dt) {
    if (actor.down) return;
    actor.cover = Boolean(inZone(cover, actor));
    actor.inBrush = actor.team === "hero" && actor.stance === "crouch" && Boolean(inZone(brush, actor));
    actor.inSmoke = actor.team === "hero" && state.smokes.some((smoke) => distance(actor.x, actor.y, smoke.x, smoke.y) < smoke.r);
    actor.hidden = actor.inBrush || actor.inSmoke;
    actor.phase += dt * (actor.moving ? (actor.moveMode === "run" ? 15 : 10) : 1.4);
    actor.drawFacing = smoothAngle(actor.drawFacing, actor.facing, dt * (actor.moving ? 11 : 5));
    actor.cooldown = Math.max(0, actor.cooldown - dt);
    actor.skillCooldown = Math.max(0, actor.skillCooldown - dt);
    actor.hit = Math.max(0, actor.hit - dt);
  }
  function clearSight(a, b) { return lineOpen(a.x, a.y, b.x, b.y, 6) && !smokeBlocksLine(a, b); }
  function visibleHero(guard) {
    let best = null;
    let bestDistance = Infinity;
    for (const hero of heroes) {
      if (hero.down) continue;
      const distanceToHero = distance(guard.x, guard.y, hero.x, hero.y);
      const effectiveVision = guard.vision * (hero.stance === "crouch" ? .76 : 1) * (hero.cover ? .84 : 1);
      // A crouched hand in brush is fully concealed until a guard is almost on top of them.
      // Smoke has the same rule with a slightly tighter reveal distance.
      if (hero.hidden && distanceToHero > (hero.inSmoke ? 18 : 24)) continue;
      if (distanceToHero > effectiveVision) continue;
      const bearing = Math.atan2(hero.y - guard.y, hero.x - guard.x);
      if (Math.abs(angleDelta(bearing, guard.facing)) > guard.fov / 2 || !clearSight(guard, hero)) continue;
      if (distanceToHero < bestDistance) {
        bestDistance = distanceToHero;
        best = hero;
      }
    }
    return best;
  }
  function createNoise(x, y, strength = 1) {
    state.noises.push({ x, y, time: 4.6, strength });
    state.flashes.push({ x, y, time: .45, type: "noise" });
  }
  function makeGuardRoute(guard, target, mode) {
    if (!guard.goal || distance(guard.goal.x, guard.goal.y, target.x, target.y) > 36 || !guard.route.length) setRoute(guard, target, mode);
  }
  function guardSpeak(guard, line, seconds = 2.1) {
    if (guard.barkCooldown > 0 && guard.speech === line) return;
    guard.speech = line;
    guard.speechTime = seconds;
    guard.barkCooldown = Math.min(seconds * .55, 1.1);
  }
  function stunGuard(guard, seconds, source, quiet = false) {
    guard.stunned = Math.max(guard.stunned, seconds);
    guard.route = [];
    guard.moving = false;
    guard.mode = "stunned";
    guard.suspicion = 0;
    guard.hit = .45;
    guardSpeak(guard, "Ugh…", 1.35);
    playSfx(quiet ? "specialShot" : "stun");
    state.flashes.push({ x: guard.x, y: guard.y, time: .6, type: "stun" });
    setMessage(source + " stunned " + guard.name + ".", 2.8);
  }
  function enemyFire(guard, hero) {
    guard.cooldown = (guard.data.cooldown + 1.15) * guard.fireDelay;
    const bark = ["FIRE!", "TAKE COVER!", "THERE!", "DROP THEM!"];
    guardSpeak(guard, bark[Math.floor(rand() * bark.length)], 1.45);
    playSfx("enemyShot");
    state.flashes.push({ x: guard.x, y: guard.y, tx: hero.x, ty: hero.y, time: .16, type: "shot", hostile: true });
    const baseChance = .53 - (hero.cover ? .23 : 0) - (hero.stance === "crouch" ? .10 : 0) - (hero.hidden ? .12 : 0);
    const chance = clamp(Math.max(.12, baseChance) * guard.accuracy, .10, .78);
    if (rand() < chance) {
      hero.health -= guard.damage;
      hero.hit = .36;
      playSfx("hit");
      setMessage(hero.name.split(" ")[0] + " is hit. Get into brush or behind cover.", 2.7);
      if (hero.health <= 0) {
        hero.health = 0;
        hero.down = true;
        state.flashes.push({ x: hero.x, y: hero.y, time: .7, type: "down", hostile: true });
        playSfx("heroDown");
        setMessage(hero.name.split(" ")[0] + " is down.", 3.1);
      }
    }
    state.alarm = clamp(state.alarm + 2 * guard.alarmMultiplier, 0, 100);
    if (heroes.every((hero) => hero.down)) {
      state.lossReason = "THE WHOLE CREW IS DOWN";
      finish(false);
    }
  }
  function updateGuard(guard, dt) {
    if (guard.down) return;
    guard.speechTime = Math.max(0, guard.speechTime - dt);
    guard.barkCooldown = Math.max(0, guard.barkCooldown - dt);
    if (guard.stunned > 0) {
      guard.stunned -= dt;
      guard.route = [];
      guard.moving = false;
      refreshActor(guard, dt);
      if (guard.stunned <= 0) {
        guard.stunned = 0;
        guard.mode = "investigate";
        guard.investigate = { x: guard.x, y: guard.y };
      }
      return;
    }
    guard.cooldown = Math.max(0, guard.cooldown - dt);
    guard.repath -= dt;
    const seen = visibleHero(guard);
    if (seen) {
      guard.lastSeen = { x: seen.x, y: seen.y, hero: seen };
      const rate = (seen.hidden ? .28 : seen.stance === "crouch" ? .52 : seen.cover ? .64 : .92) * guard.spotRate;
      guard.suspicion = clamp(guard.suspicion + rate * dt, 0, 1);
      if (guard.suspicion > .18 && guard.mode === "patrol") {
        guard.mode = "suspicious";
        guardSpeak(guard, "Who's there?", 2.2);
        setMessage(guard.name + " is suspicious. Break sight before the alarm rises.", 2.5);
      }
      if (guard.suspicion >= .56 && guard.mode !== "alert") {
        guard.mode = "alert";
        createNoise(guard.x, guard.y);
        guardSpeak(guard, "INTRUDER!", 2.55);
        playSfx("alert");
        setMessage("Alarm raised. Use a sling shot, lasso, or smoke to regain control.", 3.2);
      }
    } else {
      if (guard.lastSeen && guard.lastSeen.hero) {
        const lastKnown = { x: guard.lastSeen.x, y: guard.lastSeen.y };
        guard.lastSeen = { ...lastKnown, hero: null };
        if (guard.mode === "alert") {
          guard.mode = "investigate";
          guard.investigate = lastKnown;
          guardSpeak(guard, "Lost 'em!", 1.65);
        }
      }
      guard.suspicion = Math.max(0, guard.suspicion - dt * .20);
      if ((guard.mode === "suspicious" || guard.mode === "alert") && guard.suspicion < .12) guard.mode = "investigate";
    }
    const heard = state.noises.filter((noise) => distance(guard.x, guard.y, noise.x, noise.y) < 310).sort((a, b) => distance(guard.x, guard.y, a.x, a.y) - distance(guard.x, guard.y, b.x, b.y))[0];
    if (heard && guard.mode === "patrol") {
      guard.mode = "investigate";
      guard.investigate = { x: heard.x, y: heard.y };
      guardSpeak(guard, "What was that?", 1.9);
    }
    if (guard.mode === "alert" && seen) {
      const hero = seen;
      const gap = distance(guard.x, guard.y, hero.x, hero.y);
      guard.facing = Math.atan2(hero.y - guard.y, hero.x - guard.x);
      if (gap > guard.standoff && guard.repath <= 0) {
        makeGuardRoute(guard, hero, "run");
        guard.repath = .65;
      } else if (gap <= guard.standoff) {
        guard.route = [];
        guard.moving = false;
      }
      if (gap <= guard.range && clearSight(guard, hero) && guard.cooldown <= 0) enemyFire(guard, hero);
    } else if (guard.mode === "alert") {
      guard.mode = "investigate";
      guard.investigate = guard.lastSeen ? { x: guard.lastSeen.x, y: guard.lastSeen.y } : { x: guard.x, y: guard.y };
      guardSpeak(guard, "Where'd they go?", 1.55);
    } else if (guard.mode === "suspicious" && guard.lastSeen) {
      if (guard.repath <= 0) {
        makeGuardRoute(guard, guard.lastSeen, "walk");
        guard.repath = 1.1;
      }
    } else if (guard.mode === "investigate") {
      const target = guard.investigate || guard.lastSeen;
      if (target && distance(guard.x, guard.y, target.x, target.y) > 22) {
        if (guard.repath <= 0) {
          makeGuardRoute(guard, target, "walk");
          guard.repath = 1;
        }
      } else {
        guard.mode = "patrol";
        guard.investigate = null;
      }
    } else {
      const patrol = guard.patrol[guard.patrolIndex];
      if (distance(guard.x, guard.y, patrol[0], patrol[1]) < 22) guard.patrolIndex = (guard.patrolIndex + 1) % guard.patrol.length;
      if (guard.repath <= 0) {
        const next = guard.patrol[guard.patrolIndex];
        makeGuardRoute(guard, { x: next[0], y: next[1] }, "walk");
        guard.repath = 1.3;
      }
    }
    moveActor(guard, dt);
    refreshActor(guard, dt);
  }

  function guardAt(point, padding = 28) {
    return guards.find((guard) => !guard.down && distance(point.x, point.y, guard.x, guard.y) <= guard.radius + padding);
  }
  function heroAt(point, padding = 24) {
    return heroes.findIndex((hero) => !hero.down && distance(point.x, point.y, hero.x, hero.y) <= hero.radius + padding);
  }
  function fireWeapon(hero, guard) {
    if (!hero || hero.down || hero.cooldown > 0 || guard.down) return false;
    const data = weapons[hero.weapon];
    const usingWhisperRound = state.specialLoaded && state.specialRounds > 0;
    if (!usingWhisperRound && hero.ammo <= 0) {
      setMessage(hero.name.split(" ")[0] + " is dry. Search brush and supply caches for ammunition.", 3.2);
      return false;
    }
    if (distance(hero.x, hero.y, guard.x, guard.y) > data.range || !clearSight(hero, guard)) {
      setMessage("No clear weapon shot from this position.");
      return false;
    }
    hero.facing = Math.atan2(guard.y - hero.y, guard.x - hero.x);
    if (usingWhisperRound) {
      hero.cooldown = Math.max(.7, data.cooldown * .72);
      state.specialRounds -= 1;
      state.specialLoaded = false;
      state.flashes.push({ x: hero.x, y: hero.y, tx: guard.x, ty: guard.y, time: .24, type: "specialShot", hostile: false });
      stunGuard(guard, 5.4, "Whisper round", true);
      setMessage("Whisper round lands clean. No alarm, no gunshot.", 3.1);
      return true;
    }
    hero.cooldown = data.cooldown;
    hero.ammo -= 1;
    guard.health -= data.damage;
    guard.hit = .35;
    guard.mode = "alert";
    guard.suspicion = 1;
    state.alarm = clamp(state.alarm + 7 * difficultyConfig().loudAlarm, 0, 100);
    state.flashes.push({ x: hero.x, y: hero.y, tx: guard.x, ty: guard.y, time: .16, type: "shot", hostile: false });
    playSfx("heroShot");
    createNoise(hero.x, hero.y, 1);
    if (guard.health <= 0) {
      guard.health = 0;
      guard.down = true;
      guard.route = [];
      state.flashes.push({ x: guard.x, y: guard.y, time: .55, type: "down", hostile: false });
      playSfx("enemyDown");
      setMessage(guard.name + " is down.", 2.2);
    } else setMessage(hero.name.split(" ")[0] + " fires. The yard heard it.", 2.2);
    return true;
  }
  function useSkillAt(hero, point) {
    if (!hero || hero.down || hero.skillCooldown > 0) {
      setMessage(hero && hero.down ? "That hand is down." : "Skill is recharging.");
      return false;
    }
    if (hero.id === "june") {
      const guard = guardAt(point, 28);
      if (!guard || distance(hero.x, hero.y, guard.x, guard.y) > hero.skillRange || !clearSight(hero, guard)) {
        setMessage("June needs a visible guard in sling-shot range.");
        return false;
      }
      hero.facing = Math.atan2(guard.y - hero.y, guard.x - hero.x);
      hero.skillCooldown = 5;
      stunGuard(guard, 3.2, "Sling shot");
      return true;
    }
    if (hero.id === "silas") {
      const guard = guardAt(point, 28);
      if (!guard || distance(hero.x, hero.y, guard.x, guard.y) > hero.skillRange || !clearSight(hero, guard)) {
        setMessage("Silas needs a clear, close lasso target.");
        return false;
      }
      hero.facing = Math.atan2(guard.y - hero.y, guard.x - hero.x);
      hero.skillCooldown = 6.5;
      stunGuard(guard, 4.4, "Lasso");
      return true;
    }
    const smokePoint = nearestOpen(point, 5);
    if (!smokePoint || distance(hero.x, hero.y, smokePoint.x, smokePoint.y) > hero.skillRange) {
      setMessage("Throw the smoke bomb onto clear ground within Ox's range.");
      return false;
    }
    hero.skillCooldown = 7.5;
    state.smokes.push({ x: smokePoint.x, y: smokePoint.y, r: 118, time: 6.5 });
    state.flashes.push({ x: smokePoint.x, y: smokePoint.y, time: .7, type: "smoke" });
    playSfx("smoke");
    setMessage("Smoke deployed. It hides the crew and breaks sight.", 3.1);
    return true;
  }
  function formation(index) {
    return [{x:0,y:0},{x:-30,y:26},{x:30,y:26},{x:0,y:56}][index] || { x: index % 2 ? -30 : 30, y: 30 + index * 13 };
  }
  function issueMove(point, run = false) {
    const selected = [...state.selection].map((index) => heroes[index]).filter((hero) => hero && !hero.down);
    if (!selected.length) {
      setMessage("There is nobody able to take that order.");
      return;
    }
    let ordered = 0;
    selected.forEach((hero, index) => {
      const offset = formation(index);
      if (setRoute(hero, { x: point.x + offset.x, y: point.y + offset.y }, run ? "run" : "walk")) ordered += 1;
    });
    if (!ordered) {
      setMessage("That point is solid. Choose a visible open lane.");
      return;
    }
    state.action = null;
    playSfx(run ? "run" : "order");
    setMessage(run ? "Run order issued. The crew will make more noise." : "Formation order issued.", 2.1);
  }
  function selectHero(index, additive = false) {
    if (!heroes[index] || heroes[index].down) return;
    if (additive) {
      const copy = new Set(state.selection);
      if (copy.has(index)) copy.delete(index); else copy.add(index);
      state.selection = copy.size ? copy : new Set([index]);
    } else state.selection = new Set([index]);
    state.focus = index;
    state.action = null;
    state.specialLoaded = false;
    playSfx("select");
    setMessage(heroes[index].name + " selected. Weapon and tool are ready below.", 2.2);
  }
  function selectBox(box, additive) {
    const left = Math.min(box.x0, box.x1);
    const right = Math.max(box.x0, box.x1);
    const top = Math.min(box.y0, box.y1);
    const bottom = Math.max(box.y0, box.y1);
    const picked = heroes.map((hero, index) => ({ hero, index, point: worldToScreen(hero.x, hero.y) }))
      .filter((item) => !item.hero.down && item.point.x >= left && item.point.x <= right && item.point.y >= top && item.point.y <= bottom)
      .map((item) => item.index);
    if (!picked.length) {
      setMessage("No crew inside that selection box.");
      return;
    }
    const result = additive ? new Set(state.selection) : new Set();
    picked.forEach((index) => result.add(index));
    state.selection = result;
    state.focus = picked[0];
    state.action = null;
    state.specialLoaded = false;
    playSfx("group");
    setMessage(picked.length === 1 ? "One hand selected." : String(picked.length) + " hands selected. Formation movement is active.", 2.4);
  }
  function allHands() {
    state.selection = new Set(heroes.map((hero, index) => hero.down ? null : index).filter((index) => index !== null));
    state.focus = [...state.selection][0] || 0;
    state.action = null;
    state.specialLoaded = false;
    playSfx("group");
    setMessage("All hands selected. Click clear ground to give a formation order.", 2.4);
  }
  function nearestHero(point) {
    return heroes.filter((hero) => !hero.down).sort((a, b) => distance(a.x, a.y, point.x, point.y) - distance(b.x, b.y, point.x, point.y))[0];
  }
  function nearbyCache(range = 58) {
    const available = heroes.filter((hero) => !hero.down);
    return caches.find((cache) => !cache.collected && available.some((hero) => distance(hero.x, hero.y, cache.x, cache.y) <= range));
  }
  function distributeAmmo(amount) {
    let remaining = amount;
    const crew = heroes.filter((hero) => !hero.down && hero.ammo < hero.maxAmmo)
      .sort((a, b) => a.ammo / a.maxAmmo - b.ammo / b.maxAmmo);
    for (const hero of crew) {
      const added = Math.min(remaining, hero.maxAmmo - hero.ammo);
      hero.ammo += added;
      remaining -= added;
      if (remaining <= 0) break;
    }
    return amount - remaining;
  }
  function collectCache(cache) {
    if (cache.kind === "ammo") {
      const gained = distributeAmmo(cache.amount);
      if (!gained) {
        setMessage("Every bandolier is full. Leave this hidden cache for later.", 2.8);
        return false;
      }
      cache.collected = true;
      playSfx("pickup");
      setMessage("Hidden bandolier opened. " + gained + " round" + (gained === 1 ? "" : "s") + " shared across the crew.", 3.3);
      return true;
    }
    cache.collected = true;
    state.specialRounds += cache.amount;
    playSfx("pickup");
    setMessage("Found " + cache.amount + " Whisper Round" + (cache.amount === 1 ? "" : "s") + ". Load one with C for a silent stun shot.", 3.7);
    return true;
  }
  function interact() {
    const available = heroes.filter((hero) => !hero.down);
    if (!available.length) return;
    const cache = nearbyCache();
    if (cache) {
      collectCache(cache);
      return;
    }
    if (!relay.done) {
      const hero = nearestHero(relay);
      if (distance(hero.x, hero.y, relay.x, relay.y) <= 58) {
        relay.done = true;
        state.alarm = Math.max(0, state.alarm - 20);
        playSfx("objective");
        setMessage("Signal relay cut. Take the ledger at the Paymaster office.", 4);
      } else setMessage("Move a hand to the signal relay, then press E.");
      return;
    }
    if (!ledger.done) {
      const hero = nearestHero(ledger);
      if (distance(hero.x, hero.y, ledger.x, ledger.y) <= 54) {
        ledger.done = true;
        playSfx("objective");
        setMessage("Ledger acquired. Leave through the west gate.", 4);
      } else setMessage("Move a hand to the ledger marker, then press E.");
      return;
    }
    if (available.some((hero) => hero.x < exit.x + exit.w + 20 && hero.y > exit.y && hero.y < exit.y + exit.h)) finish(true);
    else setMessage("Bring at least one living hand to the west gate, then press E.");
  }
  function arm(action) {
    const hero = heroes[state.focus];
    if (!hero || hero.down) {
      setMessage("Choose a living hand first.");
      return;
    }
    state.specialLoaded = false;
    state.action = state.action === action ? null : action;
    if (state.action) playSfx("arm");
    if (state.action === "weapon") setMessage(weapons[hero.weapon].label + " armed. Click a guard on the map.", 3.4);
    if (state.action === "skill") setMessage(hero.skill + " armed. " + hero.skillHint + ".", 3.4);
    if (!state.action) setMessage("Action cancelled.");
  }
  function toggleSpecialRound() {
    const hero = heroes[state.focus];
    if (!hero || hero.down) {
      setMessage("Choose a living hand first.");
      return;
    }
    if (state.specialRounds <= 0) {
      setMessage("No Whisper Rounds. Search hidden caches in brush and beside buildings.", 3.2);
      return;
    }
    state.specialLoaded = !state.specialLoaded;
    state.action = state.specialLoaded ? "special" : null;
    playSfx("arm");
    setMessage(state.specialLoaded ? "Whisper round loaded in " + hero.name.split(" ")[0] + "'s " + weapons[hero.weapon].label + ". Click a guard for a silent stun." : "Whisper round unloaded.", 3.3);
  }
  function handleMapClick(point, run = false, additive = false) {
    if (state.action === "weapon") {
      const guard = guardAt(point, 32);
      if (guard && fireWeapon(heroes[state.focus], guard)) state.action = null;
      else if (!guard) setMessage("Click a guard to use the selected weapon.");
      return;
    }
    if (state.action === "skill") {
      if (useSkillAt(heroes[state.focus], point)) state.action = null;
      return;
    }
    if (state.action === "special") {
      const guard = guardAt(point, 32);
      if (guard && fireWeapon(heroes[state.focus], guard)) state.action = null;
      else if (!guard) setMessage("Click a guard to use the loaded Whisper Round.");
      return;
    }
    const hero = heroAt(point, 28);
    if (hero >= 0) {
      selectHero(hero, additive);
      return;
    }
    if (!terrainOpen(point.x, point.y, 4)) {
      setMessage("That is a solid building, wagon, fence, or crate footprint.");
      return;
    }
    issueMove(point, run);
  }

  function updateEdgePan(dt) {
    if (!screenInWorld(state.pointer.x, state.pointer.y) || state.drag) return;
    const margin = 42;
    const edge = (value) => clamp((margin - value) / margin, 0, 1);
    const left = edge(state.pointer.x - VIEW.x);
    const right = edge(VIEW.x + VIEW.w - state.pointer.x);
    const top = edge(state.pointer.y - VIEW.y);
    const bottom = edge(VIEW.y + VIEW.h - state.pointer.y);
    const horizontal = right - left;
    const vertical = bottom - top;
    if (!horizontal && !vertical) return;
    const speed = 520 / state.camera.zoom;
    state.camera.x += horizontal * speed * dt;
    state.camera.y += vertical * speed * dt;
    clampCamera();
  }
  function update(dt) {
    if (!state.started || state.won || state.lost) return;
    updateEdgePan(dt);
    if (state.paused) return;
    state.elapsed += dt;
    state.messageTime = Math.max(0, state.messageTime - dt);
    state.alarm = Math.max(0, state.alarm - dt * (relay.done ? .48 : .13));
    state.flashes.forEach((flash) => { flash.time -= dt; });
    state.flashes = state.flashes.filter((flash) => flash.time > 0);
    state.noises.forEach((noise) => { noise.time -= dt; });
    state.noises = state.noises.filter((noise) => noise.time > 0);
    state.smokes.forEach((smoke) => { smoke.time -= dt; });
    state.smokes = state.smokes.filter((smoke) => smoke.time > 0);
    for (const hero of heroes) {
      moveActor(hero, dt);
      refreshActor(hero, dt);
      if (hero.moving && hero.moveMode === "run" && rand() < dt * .56) createNoise(hero.x, hero.y, .35);
    }
    const newFinds = caches.filter((cache) => !cache.collected && !cache.discovered && heroes.some((hero) => !hero.down && distance(hero.x, hero.y, cache.x, cache.y) <= 132));
    for (const cache of newFinds) cache.discovered = true;
    if (newFinds.length) {
      setMessage(newFinds.length === 1 ? "A hidden cache is nearby. Bring a hand close and press E to search it." : "Hidden caches found nearby. Bring a hand close and press E to search one.", 3.4);
      playSfx("pickup");
    }
    for (const guard of guards) updateGuard(guard, dt);
    if (state.alarm >= 100) {
      state.lossReason = "THE CALL-OUT ARRIVED";
      finish(false);
    }
    updateDom();
  }

  function drawWorldGround() {
    const groundWash = ctx.createLinearGradient(0, 0, WORLD.w, WORLD.h);
    groundWash.addColorStop(0, "#887b4c");
    groundWash.addColorStop(.54, P.ground);
    groundWash.addColorStop(1, "#625c38");
    ctx.fillStyle = groundWash;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    for (const road of roads) {
      ctx.fillStyle = P.road;
      ctx.fillRect(road.x, road.y, road.w, road.h);
      ctx.fillStyle = "rgba(67,54,29,.15)";
      if (road.w > road.h) {
        ctx.fillRect(road.x, road.y + road.h * .27, road.w, 2);
        ctx.fillRect(road.x, road.y + road.h * .72, road.w, 2);
      } else {
        ctx.fillRect(road.x + road.w * .27, road.y, 2, road.h);
        ctx.fillRect(road.x + road.w * .72, road.y, 2, road.h);
      }
      ctx.strokeStyle = "rgba(89,72,39,.22)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 12]);
      ctx.strokeRect(road.x + 9, road.y + 9, road.w - 18, road.h - 18);
      ctx.setLineDash([]);
    }
    for (const bit of terrainSpecks) {
      ctx.fillStyle = ["rgba(56,49,25,.18)", "rgba(223,201,130,.15)", "rgba(69,84,47,.16)", "rgba(111,70,39,.13)"][bit.tone];
      ctx.fillRect(bit.x, bit.y, bit.r, bit.r);
    }
    for (const tuft of terrainTufts) {
      ctx.strokeStyle = ["rgba(61,82,39,.28)", "rgba(205,184,107,.20)", "rgba(77,65,32,.25)"][tuft.tone];
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(tuft.x - tuft.size * .35, tuft.y + tuft.size * .5);
      ctx.lineTo(tuft.x + tuft.lean, tuft.y - tuft.size * .58);
      ctx.moveTo(tuft.x, tuft.y + tuft.size * .5);
      ctx.lineTo(tuft.x + tuft.size * .38 + tuft.lean, tuft.y - tuft.size * .25);
      ctx.stroke();
    }
    ctx.strokeStyle = "#bba46b";
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, WORLD.w - 24, WORLD.h - 24);
  }
  function drawBrushes() {
    for (const zone of brush) {
      ctx.save();
      ctx.translate(zone.x, zone.y);
      for (let index = 0; index < 20; index += 1) {
        const angle = index * 2.38;
        const radius = zone.r * (.18 + (index % 6) * .13);
        ctx.fillStyle = index % 3 ? "#49623e" : "#355038";
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * radius, Math.sin(angle * 1.6) * radius * .65, 13 + index % 5, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(220,229,152,.20)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, zone.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
  function drawSolid(item) {
    if (item.type === "tower") {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = P.shadow;
      ctx.beginPath();
      ctx.ellipse(11, 14, item.r + 8, item.r - 12, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#638c8f";
      ctx.beginPath();
      ctx.arc(0, 0, item.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#dfc77e";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(19,35,35,.42)";
      ctx.lineWidth = 3;
      for (let y = -58; y <= 58; y += 22) {
        ctx.beginPath();
        ctx.moveTo(-65, y);
        ctx.lineTo(65, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#384b4e";
      ctx.fillRect(-9, -112, 18, 30);
      ctx.fillStyle = P.paper;
      ctx.font = "700 13px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(item.label, 0, 4);
      ctx.restore();
      return;
    }
    ctx.fillStyle = P.shadow;
    ctx.fillRect(item.x + 10, item.y + 11, item.w, item.h);
    if (item.type === "building") {
      const roof = ctx.createLinearGradient(item.x, item.y, item.x + item.w, item.y + item.h);
      roof.addColorStop(0, "rgba(255,218,151,.34)");
      roof.addColorStop(.26, item.roof);
      roof.addColorStop(1, "rgba(42,27,20,.72)");
      ctx.fillStyle = roof;
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = "#32291e";
      ctx.lineWidth = 5;
      ctx.strokeRect(item.x, item.y, item.w, item.h);
      ctx.fillStyle = "rgba(241,204,132,.10)";
      for (let x = item.x + 17; x < item.x + item.w - 8; x += 20) ctx.fillRect(x, item.y + 8, 4, item.h - 16);
      ctx.strokeStyle = "rgba(31,24,17,.26)";
      ctx.lineWidth = 2;
      for (let y = item.y + 22; y < item.y + item.h - 10; y += 18) {
        ctx.beginPath();
        ctx.moveTo(item.x + 10, y);
        ctx.lineTo(item.x + item.w - 10, y);
        ctx.stroke();
      }
      ctx.strokeStyle = item.roof === "#5f4a35" ? "#b79c6f" : "#a8784c";
      ctx.lineWidth = 3;
      ctx.strokeRect(item.x + 10, item.y + 10, item.w - 20, item.h - 20);
      ctx.fillStyle = "#30231a";
      if (item.door === "s") ctx.fillRect(item.x + item.w / 2 - 18, item.y + item.h - 16, 36, 16);
      if (item.door === "n") ctx.fillRect(item.x + item.w / 2 - 18, item.y, 36, 16);
      if (item.door === "w") ctx.fillRect(item.x, item.y + item.h / 2 - 18, 16, 36);
      if (item.door === "e") ctx.fillRect(item.x + item.w - 16, item.y + item.h / 2 - 18, 16, 36);
      ctx.fillStyle = "rgba(255,231,165,.22)";
      ctx.fillRect(item.x + 18, item.y + 18, item.w - 36, 5);
      ctx.fillStyle = "rgba(35,27,18,.55)";
      ctx.fillRect(item.x + item.w - 20, item.y + 20, 8, item.h - 40);
      ctx.fillStyle = "#2b2c21";
      ctx.fillRect(item.x + item.w * .24, item.y + item.h * .28, 18, 15);
      ctx.fillStyle = "rgba(218,191,117,.55)";
      ctx.fillRect(item.x + item.w * .24 + 3, item.y + item.h * .28 + 3, 12, 9);
      ctx.fillStyle = "rgba(255,239,181,.87)";
      ctx.font = "700 14px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(item.label, item.x + item.w / 2, item.y + item.h / 2 + 4);
      return;
    }
    if (item.type === "railcar") {
      ctx.fillStyle = "#5b4d3b";
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = "#2c251c";
      ctx.lineWidth = 5;
      ctx.strokeRect(item.x, item.y, item.w, item.h);
      ctx.fillStyle = "#8e7651";
      for (let x = item.x + 35; x < item.x + item.w - 10; x += 58) ctx.fillRect(x, item.y + 13, 32, item.h - 26);
      ctx.fillStyle = P.paper;
      ctx.font = "700 13px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(item.label, item.x + item.w / 2, item.y + item.h / 2 + 4);
      return;
    }
    if (item.type === "wagon") {
      ctx.fillStyle = "#895a33";
      ctx.fillRect(item.x, item.y + 7, item.w, item.h - 14);
      ctx.strokeStyle = "#402c1f";
      ctx.lineWidth = 4;
      ctx.strokeRect(item.x, item.y + 7, item.w, item.h - 14);
      for (const x of [item.x + 23, item.x + item.w - 23]) {
        ctx.fillStyle = "#30251b";
        ctx.beginPath();
        ctx.arc(x, item.y + item.h / 2, 16, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#c29e5b";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      return;
    }
    if (item.type === "crate") {
      ctx.fillStyle = "#78542f";
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = "#2d2519";
      ctx.lineWidth = 4;
      ctx.strokeRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = "#bf9655";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(item.x + 7, item.y + 7);
      ctx.lineTo(item.x + item.w - 7, item.y + item.h - 7);
      ctx.moveTo(item.x + item.w - 7, item.y + 7);
      ctx.lineTo(item.x + 7, item.y + item.h - 7);
      ctx.stroke();
      return;
    }
    if (item.type === "barrels") {
      const positions = [[.24,.35],[.52,.35],[.76,.35],[.38,.70],[.66,.70]];
      for (const point of positions) {
        const x = item.x + item.w * point[0];
        const y = item.y + item.h * point[1];
        ctx.fillStyle = "#70472c";
        ctx.beginPath();
        ctx.ellipse(x, y, item.w * .14, item.h * .25, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#2e2219";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = "#bd8647";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - item.w * .11, y - item.h * .08);
        ctx.lineTo(x + item.w * .11, y - item.h * .08);
        ctx.moveTo(x - item.w * .11, y + item.h * .09);
        ctx.lineTo(x + item.w * .11, y + item.h * .09);
        ctx.stroke();
      }
      return;
    }
    if (item.type === "hay") {
      ctx.fillStyle = "#a8843d";
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = "#48351d";
      ctx.lineWidth = 4;
      ctx.strokeRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = "rgba(240,208,116,.72)";
      ctx.lineWidth = 2;
      for (let x = item.x + 8; x < item.x + item.w - 4; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, item.y + 5);
        ctx.lineTo(x - 5, item.y + item.h - 5);
        ctx.stroke();
      }
      ctx.strokeStyle = "#6d4c25";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(item.x + 3, item.y + item.h * .48);
      ctx.lineTo(item.x + item.w - 3, item.y + item.h * .48);
      ctx.stroke();
      return;
    }
    if (item.type === "sandbags") {
      const rows = [[.14,.34],[.37,.34],[.60,.34],[.83,.34],[.26,.69],[.49,.69],[.72,.69]];
      for (const point of rows) {
        ctx.fillStyle = "#786846";
        ctx.beginPath();
        ctx.ellipse(item.x + item.w * point[0], item.y + item.h * point[1], item.w * .15, item.h * .22, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#3e3525";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      return;
    }
    if (item.type === "rocks") {
      const rocks = [[.20,.68,.21,.27],[.43,.40,.25,.34],[.67,.62,.25,.30],[.83,.34,.17,.23]];
      for (const rock of rocks) {
        ctx.fillStyle = "#5e5b4c";
        ctx.beginPath();
        ctx.ellipse(item.x + item.w * rock[0], item.y + item.h * rock[1], item.w * rock[2], item.h * rock[3], -.2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#292a23";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = "rgba(218,200,142,.33)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(item.x + item.w * (rock[0] - rock[2] * .45), item.y + item.h * (rock[1] - rock[3] * .35));
        ctx.lineTo(item.x + item.w * (rock[0] + rock[2] * .25), item.y + item.h * (rock[1] - rock[3] * .54));
        ctx.stroke();
      }
      return;
    }
    ctx.fillStyle = "#3c3325";
    ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.strokeStyle = "#c9ad69";
    ctx.lineWidth = 3;
    if (item.w > item.h) {
      for (let x = item.x + 7; x < item.x + item.w; x += 15) {
        ctx.beginPath();
        ctx.moveTo(x, item.y - 6);
        ctx.lineTo(x, item.y + item.h + 6);
        ctx.stroke();
      }
    } else {
      for (let y = item.y + 7; y < item.y + item.h; y += 15) {
        ctx.beginPath();
        ctx.moveTo(item.x - 6, y);
        ctx.lineTo(item.x + item.w + 6, y);
        ctx.stroke();
      }
    }
  }
  function drawExit() {
    ctx.fillStyle = "#30342a";
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeStyle = "#d6b760";
    ctx.lineWidth = 4;
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = P.paper;
    ctx.font = "700 13px Courier New";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(exit.x + exit.w / 2, exit.y + exit.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("WEST GATE", 0, 4);
    ctx.restore();
  }
  function drawCaches() {
    for (const cache of caches) {
      if (cache.collected || !cache.discovered) continue;
      const closest = nearestHero(cache);
      const close = closest && distance(closest.x, closest.y, cache.x, cache.y) <= 72;
      const pulse = .72 + Math.sin(state.elapsed * 4 + cache.x) * .28;
      ctx.save();
      ctx.translate(cache.x, cache.y);
      ctx.fillStyle = "rgba(17,15,10,.34)";
      ctx.beginPath();
      ctx.ellipse(5, 8, 22, 10, 0, 0, TAU);
      ctx.fill();
      if (cache.kind === "ammo") {
        ctx.fillStyle = "#6f4b2d";
        ctx.fillRect(-16, -11, 32, 21);
        ctx.strokeStyle = "#2c2218";
        ctx.lineWidth = 3;
        ctx.strokeRect(-16, -11, 32, 21);
        ctx.strokeStyle = "#c69b5d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, -7);
        ctx.lineTo(12, 7);
        ctx.moveTo(12, -7);
        ctx.lineTo(-12, 7);
        ctx.stroke();
        ctx.fillStyle = "#e3c879";
        for (const x of [-8, 0, 8]) {
          ctx.fillRect(x - 2, -18, 4, 10);
          ctx.fillRect(x - 2.5, -20, 5, 3);
        }
      } else {
        ctx.fillStyle = "#284657";
        ctx.fillRect(-15, -10, 30, 20);
        ctx.strokeStyle = "#99d2db";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-15, -10, 30, 20);
        ctx.fillStyle = "#d4c56a";
        ctx.fillRect(-5, -18, 10, 12);
        ctx.strokeStyle = "#f0e0a1";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-5, -18, 10, 12);
      }
      ctx.strokeStyle = cache.kind === "special" ? "rgba(126,207,218," + pulse + ")" : "rgba(222,183,90," + pulse + ")";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, close ? 32 : 25, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (close) {
        ctx.fillStyle = cache.kind === "special" ? "#bde6e5" : P.paper;
        ctx.font = "700 11px Courier New";
        ctx.textAlign = "center";
        ctx.fillText("E · " + cache.label, 0, -34);
      }
      ctx.restore();
    }
  }
  function drawObjective(item, label, done, active) {
    const pulse = 1 + Math.sin(state.elapsed * 4) * .08;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.strokeStyle = done ? "#6f9d77" : active ? P.gold : "rgba(219,181,95,.24)";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, item.r * pulse, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = done ? "#649170" : active ? P.gold : P.muted;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.font = "700 12px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(done ? "✓" : "!", 0, 5);
    ctx.fillStyle = done ? "#9fbd8e" : P.paper;
    ctx.font = "700 12px Courier New";
    ctx.fillText(label, 0, -38);
    ctx.restore();
  }
  function drawVision(guard) {
    if (guard.down || guard.stunned > 0) return;
    const alpha = guard.mode === "alert" ? .13 : guard.mode === "suspicious" ? .075 : .025;
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.rotate(guard.drawFacing);
    ctx.fillStyle = guard.mode === "alert" ? "rgba(215,93,70," + alpha + ")" : "rgba(232,195,104," + alpha + ")";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, guard.vision, -guard.fov / 2, guard.fov / 2);
    ctx.closePath();
    ctx.fill();
    if (guard.mode !== "patrol") {
      ctx.strokeStyle = guard.mode === "alert" ? "rgba(215,93,70,.48)" : "rgba(232,195,104,.38)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawSmoke() {
    for (const smoke of state.smokes) {
      const alpha = clamp(smoke.time / 2, 0, 1) * .23;
      ctx.fillStyle = "rgba(155,166,157," + alpha + ")";
      ctx.beginPath();
      ctx.arc(smoke.x, smoke.y, smoke.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(221,226,211," + alpha + ")";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  function drawSpeechBubble(actor) {
    if (actor.team !== "guard" || actor.down || actor.speechTime <= 0) return;
    const width = clamp(58 + actor.speech.length * 6.1, 82, 142);
    const height = 27;
    const x = actor.x - width / 2;
    const y = actor.y - 69;
    const radius = 6;
    ctx.save();
    ctx.fillStyle = actor.mode === "alert" ? "rgba(77,30,25,.96)" : "rgba(35,38,29,.96)";
    ctx.strokeStyle = actor.mode === "alert" ? "#e27a5d" : "#d7bd71";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(actor.x + 6, y + height);
    ctx.lineTo(actor.x, y + height + 7);
    ctx.lineTo(actor.x - 6, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4e1b0";
    ctx.font = "700 13px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(actor.speech, actor.x, y + 18);
    ctx.restore();
  }
  function drawActor(actor, selected) {
    if (actor.down) {
      ctx.save();
      ctx.translate(actor.x, actor.y);
      ctx.fillStyle = "rgba(18,16,11,.36)";
      ctx.beginPath();
      ctx.ellipse(5, 7, 20, 10, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = actor.team === "hero" ? actor.coat : "#6b3f36";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#16130f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(8, -8);
      ctx.lineTo(-8, 8);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const facing = actor.drawFacing;
    const fx = Math.cos(facing);
    const fy = Math.sin(facing);
    const sx = -fy;
    const sy = fx;
    const stride = actor.moving ? Math.sin(actor.phase * 1.45) * 4 : 0;
    ctx.save();
    ctx.translate(actor.x, actor.y);
    ctx.fillStyle = "rgba(20,18,12,.38)";
    ctx.beginPath();
    ctx.ellipse(4, 8, 18, 9, 0, 0, TAU);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = actor.hidden ? "#7db886" : P.gold;
      ctx.lineWidth = 3;
      ctx.setLineDash(actor.hidden ? [4, 4] : []);
      ctx.beginPath();
      ctx.arc(0, 1, 22, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (actor.team === "guard" && actor.mode !== "patrol") {
      ctx.strokeStyle = actor.mode === "alert" ? P.red : P.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 1, 21, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = "#2a261e";
    for (const foot of [[7,stride],[-7,-stride]]) {
      ctx.beginPath();
      ctx.ellipse(sx * foot[0] - fx * 6 + fx * foot[1], sy * foot[0] - fy * 6 + fy * foot[1], 5, 6, facing, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = actor.hit > 0 ? "#f0d08d" : actor.team === "hero" ? actor.coat : "#7a4440";
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 14, facing, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#171710";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = actor.team === "hero" ? "rgba(250,219,162,.34)" : "rgba(244,202,150,.26)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sx * 8 - fx * 5, -sy * 8 - fy * 5);
    ctx.lineTo(sx * 8 - fx * 5, sy * 8 - fy * 5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(26,21,15,.72)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sx * 10 + fx * 2, -sy * 10 + fy * 2);
    ctx.lineTo(-sx * 15 + fx * 9, -sy * 15 + fy * 9);
    ctx.moveTo(sx * 10 + fx * 2, sy * 10 + fy * 2);
    ctx.lineTo(sx * 15 + fx * 9, sy * 15 + fy * 9);
    ctx.stroke();
    if (actor.team === "guard") {
      ctx.strokeStyle = "#2f291e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fx * 10, fy * 10);
      ctx.lineTo(fx * 26, fy * 26);
      ctx.stroke();
    }
    ctx.fillStyle = actor.skin || "#c9976d";
    ctx.beginPath();
    ctx.arc(fx * 7, fy * 7, 7.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = actor.team === "hero" ? actor.hat : "#33342b";
    ctx.save();
    ctx.translate(fx * 10, fy * 10);
    ctx.rotate(facing);
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-6, -10, 12, 10);
    ctx.restore();
    if (actor.cover) {
      ctx.strokeStyle = "rgba(168,213,144,.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, Math.PI * .1, Math.PI * .9);
      ctx.stroke();
    }
    if (actor.stunned > 0) {
      ctx.fillStyle = P.blue;
      ctx.font = "700 18px Georgia";
      ctx.textAlign = "center";
      ctx.fillText("✦", 0, -24);
    }
    ctx.restore();
    ctx.fillStyle = actor.team === "hero" ? P.paper : "#efceb4";
    ctx.font = "700 12px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(actor.team === "hero" ? actor.name.split(" ")[0] : actor.name.replace(" Watch", ""), actor.x, actor.y - 28);
    if (actor.team === "hero" && actor.hidden) {
      ctx.fillStyle = P.green;
      ctx.font = "700 9px Courier New";
      ctx.fillText("HIDDEN", actor.x, actor.y - 40);
    }
    const width = actor.team === "hero" ? 30 : 24;
    ctx.fillStyle = "rgba(8,10,8,.72)";
    ctx.fillRect(actor.x - width / 2, actor.y + 27, width, 4);
    ctx.fillStyle = actor.team === "hero" ? "#a2c77d" : "#d66a50";
    ctx.fillRect(actor.x - width / 2, actor.y + 27, width * (actor.health / actor.maxHealth), 4);
    drawSpeechBubble(actor);
  }
  function drawFlashes() {
    for (const flash of state.flashes) {
      const alpha = clamp(flash.time * 7, 0, 1);
      if (flash.type === "shot") {
        ctx.strokeStyle = flash.hostile ? "rgba(226,101,72," + alpha + ")" : "rgba(247,218,133," + alpha + ")";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(flash.x, flash.y);
        ctx.lineTo(flash.tx, flash.ty);
        ctx.stroke();
      } else if (flash.type === "specialShot") {
        ctx.strokeStyle = "rgba(128,220,222," + alpha + ")";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(flash.x, flash.y);
        ctx.lineTo(flash.tx, flash.ty);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (flash.type === "stun") {
        ctx.strokeStyle = "rgba(120,184,206," + alpha + ")";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, 16 + (1 - alpha) * 28, 0, TAU);
        ctx.stroke();
      } else if (flash.type === "down") {
        ctx.strokeStyle = flash.hostile ? "rgba(226,101,72," + alpha + ")" : "rgba(244,186,104," + alpha + ")";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, 13 + (1 - alpha) * 34, 0, TAU);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(231,199,112," + alpha + ")";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, 18 + (1 - alpha) * 38, 0, TAU);
        ctx.stroke();
      }
    }
  }
  function drawWorldAtmosphere() {
    const light = ctx.createLinearGradient(0, 0, WORLD.w, WORLD.h);
    light.addColorStop(0, "rgba(255,235,176,.15)");
    light.addColorStop(.42, "rgba(255,212,137,.035)");
    light.addColorStop(1, "rgba(29,43,30,.11)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(39,48,27,.075)";
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.restore();
  }
  function drawWorld() {
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    ctx.clip();
    ctx.translate(VIEW.x - state.camera.x * state.camera.zoom, VIEW.y - state.camera.y * state.camera.zoom);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    drawWorldGround();
    drawBrushes();
    drawExit();
    for (const solid of solids) drawSolid(solid);
    drawCaches();
    drawObjective(relay, "SIGNAL RELAY", relay.done, !relay.done);
    drawObjective(ledger, "PAYMASTER LEDGER", ledger.done, relay.done && !ledger.done);
    for (const guard of guards) drawVision(guard);
    drawSmoke();
    const actors = [...guards, ...heroes].sort((a, b) => a.y - b.y);
    for (const actor of actors) drawActor(actor, actor.team === "hero" && state.selection.has(heroes.indexOf(actor)));
    drawFlashes();
    drawWorldAtmosphere();
    ctx.restore();
    ctx.strokeStyle = "#a99662";
    ctx.lineWidth = 3;
    ctx.strokeRect(VIEW.x + 1.5, VIEW.y + 1.5, VIEW.w - 3, VIEW.h - 3);
  }
  function objectiveText() {
    if (!relay.done) return "1/3  CUT THE SIGNAL RELAY";
    if (!ledger.done) return "2/3  TAKE THE LEDGER";
    return "3/3  LEAVE BY WEST GATE";
  }
  function drawMiniMap() {
    const box = { x: 1082, y: 6, w: 184, h: 28 };
    ctx.fillStyle = "#343a2b";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    const scaleX = box.w / WORLD.w;
    const scaleY = box.h / WORLD.h;
    ctx.fillStyle = "#76623e";
    for (const solid of solids) {
      if (solid.type === "tower") {
        ctx.beginPath();
        ctx.arc(box.x + solid.x * scaleX, box.y + solid.y * scaleY, Math.max(1.5, solid.r * scaleX), 0, TAU);
        ctx.fill();
      } else ctx.fillRect(box.x + solid.x * scaleX, box.y + solid.y * scaleY, Math.max(1, solid.w * scaleX), Math.max(1, solid.h * scaleY));
    }
    ctx.strokeStyle = P.gold;
    ctx.strokeRect(box.x + state.camera.x * scaleX, box.y + state.camera.y * scaleY, viewWorldWidth() * scaleX, viewWorldHeight() * scaleY);
    for (const hero of heroes) {
      if (hero.down) continue;
      ctx.fillStyle = P.green;
      ctx.fillRect(box.x + hero.x * scaleX - 1, box.y + hero.y * scaleY - 1, 3, 3);
    }
  }
  function drawTopBar() {
    ctx.fillStyle = P.ui;
    ctx.fillRect(0, 0, W, 42);
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 42);
    ctx.lineTo(W, 42);
    ctx.stroke();
    ctx.fillStyle = P.paper;
    ctx.font = "700 17px Georgia";
    ctx.textAlign = "left";
    ctx.fillText("DUST", 18, 26);
    ctx.fillStyle = P.amber;
    ctx.fillText("&", 69, 26);
    ctx.fillStyle = P.paper;
    ctx.fillText("IRON", 85, 26);
    ctx.fillStyle = P.muted;
    ctx.font = "700 10px Courier New";
    ctx.fillText("MESA JUNCTION · " + difficultyConfig().label + " CONTRACT", 210, 25);
    ctx.textAlign = "center";
    ctx.fillStyle = P.gold;
    ctx.fillText(objectiveText(), W / 2, 25);
    ctx.textAlign = "right";
    ctx.fillStyle = P.muted;
    ctx.fillText("TIME " + timeText(state.elapsed), 1044, 17);
    ctx.fillText("ALARM", 1044, 32);
    for (let index = 0; index < 10; index += 1) {
      ctx.fillStyle = state.alarm >= (index + 1) * 10 ? (index > 6 ? P.red : P.amber) : "#363a2d";
      ctx.fillRect(1054 + index * 8, 25, 6, 7);
    }
    drawMiniMap();
  }
  function drawCard(rect, label, title, text, active, tone) {
    ctx.fillStyle = active ? "#3b4531" : "#242a20";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = active ? P.gold : "#596047";
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = tone;
    ctx.font = "700 12px Courier New";
    ctx.textAlign = "left";
    ctx.fillText(label, rect.x + 12, rect.y + 20);
    ctx.fillStyle = P.paper;
    ctx.font = "700 15px Courier New";
    ctx.fillText(title, rect.x + 12, rect.y + 43);
    ctx.fillStyle = P.muted;
    ctx.font = "11px Courier New";
    ctx.fillText(text, rect.x + 12, rect.y + 64);
  }
  function drawInventory() {
    ctx.fillStyle = "#141710";
    ctx.fillRect(0, 592, W, 128);
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 592);
    ctx.lineTo(W, 592);
    ctx.stroke();
    const hero = heroes[state.focus] || heroes[0];
    ctx.fillStyle = P.muted;
    ctx.font = "700 10px Courier New";
    ctx.textAlign = "left";
    ctx.fillText("ACTIVE HAND", 20, 618);
    ctx.fillStyle = hero ? hero.hat : P.muted;
    ctx.beginPath();
    ctx.arc(45, 654, 18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.paper;
    ctx.font = "700 16px Courier New";
    ctx.fillText(hero ? hero.name : "NO HAND", 76, 646);
    ctx.fillStyle = P.muted;
    ctx.font = "11px Courier New";
    ctx.fillText(hero ? hero.role + " · " + hero.health + "/" + hero.maxHealth + " HEALTH · " + hero.ammo + "/" + hero.maxAmmo + " RDS" : "", 76, 668);
    if (!hero) return;
    const data = weapons[hero.weapon];
    drawCard(inventory.weapon, "CLICK · WEAPON", data.label, hero.ammo + "/" + hero.maxAmmo + " rounds · loud", state.action === "weapon", data.color);
    drawCard(inventory.skill, "CLICK · TOOL", hero.skill, hero.skillHint, state.action === "skill", hero.id === "june" ? P.blue : hero.id === "silas" ? P.gold : P.green);
    drawCard(inventory.special, "CLICK · SPECIAL", state.specialRounds ? (state.specialLoaded ? "WHISPER LOADED" : "WHISPER ROUNDS ×" + state.specialRounds) : "NO WHISPER ROUNDS", state.specialRounds ? "Silent 5s stun · click guard" : "Search hidden field caches", state.action === "special", state.specialRounds ? P.blue : P.muted);
    ctx.fillStyle = P.muted;
    ctx.font = "10px Courier New";
    ctx.textAlign = "right";
    ctx.fillText("CLICK A CARD TO ARM · RMB GUARD: FIRE · RMB HAND: CROUCH · EDGE: SCROLL", W - 20, 708);
  }
  function drawSelectionBox() {
    if (!state.drag || state.drag.mode !== "box" || !state.drag.box) return;
    const box = state.drag.box;
    const x = Math.min(box.x0, box.x1);
    const y = Math.min(box.y0, box.y1);
    const w = Math.abs(box.x1 - box.x0);
    const h = Math.abs(box.y1 - box.y0);
    ctx.fillStyle = "rgba(219,180,91,.12)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
  function drawCursor() {
    if (!screenInWorld(state.pointer.x, state.pointer.y)) return;
    ctx.strokeStyle = state.action ? P.gold : "rgba(235,215,157,.52)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(state.pointer.x, state.pointer.y, state.action ? 12 : 8, 0, TAU);
    ctx.stroke();
  }
  function draw() {
    ctx.fillStyle = "#2f3529";
    ctx.fillRect(0, 0, W, H);
    drawTopBar();
    drawWorld();
    drawSelectionBox();
    drawCursor();
    drawInventory();
  }

  function updateRoster(force = false) {
    const alive = heroes.filter((hero) => !hero.down).length;
    const allSelected = alive > 0 && state.selection.size === alive;
    const signature = [
      state.focus,
      [...state.selection].sort().join(","),
      heroes.map((hero) => [hero.down ? 1 : 0, hero.health, hero.ammo, hero.maxAmmo].join(":")).join("|")
    ].join("/");
    if (!force && signature === rosterSignature) return;
    rosterSignature = signature;
    let html = '<button type="button" class="squad-card ' + (allSelected ? "active" : "") + '" data-all="1" aria-pressed="' + String(allSelected) + '"><strong>ALL HANDS <span class="card-key">A</span></strong><span>' + alive + '/3 READY · BOX SELECT</span></button>';
    heroes.forEach((hero, index) => {
      const classes = ["character-card", state.selection.has(index) ? "active" : "", state.focus === index ? "focus" : "", hero.down ? "down" : "", hero.health < hero.maxHealth ? "wounded" : ""].filter(Boolean).join(" ");
      html += '<button type="button" class="' + classes + '" data-hero="' + index + '" aria-pressed="' + String(state.selection.has(index)) + '"' + (hero.down ? " disabled" : "") + ' style="--hero-color:' + hero.hat + ';--skin:' + hero.skin + ';--coat:' + hero.coat + '"><span class="portrait"><i class="hat"></i><i class="face"></i><i class="coat"></i></span><span class="card-copy"><strong>' + hero.name + '</strong><span>' + hero.role + " · " + hero.ammo + "/" + hero.maxAmmo + " RDS · " + hero.health + "/" + hero.maxHealth + '</span></span><span class="card-key">' + hero.key + "</span></button>";
    });
    rosterEl.innerHTML = html;
  }
  function updateDom(force = false) {
    const hero = heroes[state.focus];
    if (force || state.messageTime > 0) {
      instructionEl.textContent = state.action === "weapon" ? (hero ? weapons[hero.weapon].label : "Weapon") + " armed — click a guard." : state.action === "skill" ? (hero ? hero.skill : "Tool") + " armed — click its target." : state.action === "special" ? "Whisper Round loaded — click a guard for a silent stun." : state.message;
    }
    pauseLabel.textContent = state.paused ? "PLAN MODE" : "LIVE";
    pauseLabel.style.color = state.paused ? "#d8af51" : "#9abb79";
    statusText.textContent = "MAP: MESA JUNCTION / " + difficultyConfig().label + " / " + objectiveText();
    updateRoster(force);
  }

  function eventPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  }
  function inventoryHit(point) {
    const inBox = (box) => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h;
    if (inBox(inventory.weapon)) return "weapon";
    if (inBox(inventory.skill)) return "skill";
    if (inBox(inventory.special)) return "special";
    return null;
  }
  function toggleCrouchForHero(hero) {
    if (!hero || hero.down) return;
    hero.stance = hero.stance === "crouch" ? "stand" : "crouch";
    refreshActor(hero, 0);
    setMessage(hero.stance === "crouch" ? hero.name.split(" ")[0] + " crouches. Brush and smoke now conceal this hand." : hero.name.split(" ")[0] + " stands.", 2.6);
  }
  function beginDrag(event) {
    if (!state.started || state.won || state.lost || event.button !== 0) return;
    const point = eventPoint(event);
    state.pointer = point;
    const hit = inventoryHit(point);
    if (hit) {
      if (hit === "special") toggleSpecialRound();
      else arm(hit);
      return;
    }
    if (!screenInWorld(point.x, point.y)) return;
    const world = screenToWorld(point.x, point.y);
    const hero = heroAt(world, 28);
    if (!state.action && hero >= 0) {
      selectHero(hero, event.shiftKey);
      event.preventDefault();
      return;
    }
    if (!state.action && event.shiftKey) {
      state.drag = { id: event.pointerId, x0: point.x, y0: point.y, moved: false, mode: "box", additive: true };
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    handleMapClick(world, false, event.shiftKey);
    event.preventDefault();
  }
  function moveDrag(event) {
    const point = eventPoint(event);
    state.pointer = point;
    const drag = state.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = point.x - drag.x0;
    const dy = point.y - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 7) drag.moved = true;
    if (drag.mode === "box") drag.box = { x0: drag.x0, y0: drag.y0, x1: point.x, y1: point.y };
  }
  function endDrag(event) {
    const point = eventPoint(event);
    state.pointer = point;
    const drag = state.drag;
    if (!drag || drag.id !== event.pointerId) return;
    state.drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (drag.moved && drag.mode === "box" && drag.box) {
      selectBox(drag.box, drag.additive);
      return;
    }
  }
  canvas.addEventListener("pointerdown", beginDrag);
  canvas.addEventListener("pointermove", moveDrag);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointerleave", () => { state.pointer = { x: -100, y: -100 }; });
  canvas.addEventListener("pointercancel", () => { state.drag = null; state.pointer = { x: -100, y: -100 }; });
  canvas.addEventListener("contextmenu", (event) => {
    if (!state.started || state.won || state.lost) return;
    const point = eventPoint(event);
    if (!screenInWorld(point.x, point.y)) return;
    event.preventDefault();
    const world = screenToWorld(point.x, point.y);
    const heroIndex = heroAt(world, 28);
    if (heroIndex >= 0) {
      selectHero(heroIndex);
      toggleCrouchForHero(heroes[heroIndex]);
      return;
    }
    const guard = guardAt(world, 32);
    if (guard) {
      const used = state.action === "skill" ? useSkillAt(heroes[state.focus], world) : fireWeapon(heroes[state.focus], guard);
      if (used) state.action = null;
      return;
    }
    if (state.action) {
      state.action = null;
      state.specialLoaded = false;
      setMessage("Action cancelled.");
      return;
    }
    issueMove(world, true);
  });
  canvas.addEventListener("dblclick", (event) => {
    if (!state.started || state.won || state.lost || state.action) return;
    const point = eventPoint(event);
    if (!screenInWorld(point.x, point.y)) return;
    const world = screenToWorld(point.x, point.y);
    if (heroAt(world, 28) >= 0 || guardAt(world, 32)) return;
    event.preventDefault();
    handleMapClick(world, true, event.shiftKey);
  });
  canvas.addEventListener("wheel", (event) => {
    if (!state.started) return;
    const point = eventPoint(event);
    if (!screenInWorld(point.x, point.y)) return;
    event.preventDefault();
    const anchor = screenToWorld(point.x, point.y);
    const old = state.camera.zoom;
    state.camera.zoom = clamp(state.camera.zoom * (event.deltaY > 0 ? .90 : 1.11), .52, 1.05);
    state.camera.x = anchor.x - (point.x - VIEW.x) / state.camera.zoom;
    state.camera.y = anchor.y - (point.y - VIEW.y) / state.camera.zoom;
    if (old !== state.camera.zoom) clampCamera();
  }, { passive: false });
  function chooseRosterButton(event) {
    const button = event.target && typeof event.target.closest === "function" ? event.target.closest("button[data-hero], button[data-all]") : null;
    if (!button || !rosterEl.contains(button) || !state.started || button.disabled) return false;
    if (button.dataset.all) allHands();
    else if (button.dataset.hero !== undefined) selectHero(Number(button.dataset.hero), event.shiftKey);
    updateDom();
    return true;
  }
  rosterEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    if (chooseRosterButton(event)) event.preventDefault();
  });
  rosterEl.addEventListener("click", (event) => {
    if (event.detail === 0) chooseRosterButton(event);
  });
  if (audioToggle) {
    audioToggle.addEventListener("click", () => {
      setAudioEnabled(!audioEnabled, state.started);
    });
  }
  if (briefingButton && fieldGuide) {
    briefingButton.addEventListener("click", () => {
      const opening = fieldGuide.classList.contains("hidden");
      if (opening) fieldGuide.classList.remove("hidden");
      else fieldGuide.classList.add("hidden");
      briefingButton.textContent = opening ? "HIDE FIELD GUIDE" : "FIELD GUIDE";
      briefingButton.setAttribute("aria-expanded", String(opening));
    });
  }
  if (difficultyPicker) {
    difficultyPicker.addEventListener("click", (event) => {
      const button = event.target && typeof event.target.closest === "function" ? event.target.closest("button[data-difficulty]") : null;
      if (button && difficultyPicker.contains(button)) chooseDifficulty(button.dataset.difficulty);
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const key = event.key.toLowerCase();
    if (!state.started && (key === "enter" || key === " ")) {
      event.preventDefault();
      begin();
      return;
    }
    if (!state.started) return;
    if (key === "m") {
      event.preventDefault();
      setAudioEnabled(!audioEnabled, true);
    } else if (key === "a") {
      event.preventDefault();
      allHands();
    } else if (key >= "1" && key <= "3") {
      event.preventDefault();
      selectHero(Number(key) - 1, event.shiftKey);
    } else if (key === "f") {
      event.preventDefault();
      arm("weapon");
    } else if (key === "q") {
      event.preventDefault();
      arm("skill");
    } else if (key === "c") {
      event.preventDefault();
      toggleSpecialRound();
    } else if (key === "e") {
      event.preventDefault();
      interact();
    } else if (key === "x") {
      event.preventDefault();
      const selected = [...state.selection].map((index) => heroes[index]).filter((hero) => hero && !hero.down);
      const crouch = !selected.every((hero) => hero.stance === "crouch");
      selected.forEach((hero) => {
        hero.stance = crouch ? "crouch" : "stand";
        refreshActor(hero, 0);
      });
      setMessage(crouch ? "Crouch order. Brush and smoke now hide the crew. Right-click a hand for the same control." : "Stand order.");
    } else if (key === " ") {
      event.preventDefault();
      state.paused = !state.paused;
      setMessage(state.paused ? "Plan mode. Map and patrols are frozen." : "Live. Patrols are moving again.", 2);
    } else if (key === "r") {
      event.preventDefault();
      reset(true);
    } else if (key === "escape") {
      state.action = null;
      state.specialLoaded = false;
      state.drag = null;
      setMessage("Action cancelled.");
    }
    updateDom();
  });
  startButton.addEventListener("click", begin);
  restartButton.addEventListener("click", () => {
    startAudio();
    reset(true);
    outcome.classList.add("hidden");
    playSfx("start");
    canvas.focus({ preventScroll: true });
  });
  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000 || 0));
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  reset(false);
  requestAnimationFrame(frame);
})();
