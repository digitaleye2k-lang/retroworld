(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const rosterEl = document.getElementById("roster");
  const introPanel = document.getElementById("introPanel");
  const outcomePanel = document.getElementById("outcomePanel");
  const outcomeKicker = document.getElementById("outcomeKicker");
  const outcomeTitle = document.getElementById("outcomeTitle");
  const outcomeText = document.getElementById("outcomeText");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const instructionEl = document.getElementById("instruction");
  const pauseLabel = document.getElementById("pauseLabel");
  const statusText = document.getElementById("statusText");

  // The painted map is intentionally smooth. The earlier pixelated scaling was
  // making the high-detail environment look like a flat backdrop.
  ctx.imageSmoothingEnabled = true;

  const W = canvas.width;
  const H = canvas.height;
  const VIEW = { left: 18, top: 54, right: 942, bottom: 506, w: 924, h: 452 };
  const WORLD = { left: 18, top: 54, right: 1678, bottom: 1014, w: 1660, h: 960 };
  const GRID = { x: 26, y: 62, cell: 16, cols: 103, rows: 59 };
  const MINI = { x: 771, y: 390, w: 145, h: 83 };
  const TAU = Math.PI * 2;
  const COLLISION = { terrainPad: 7, unitGap: 3, enemyGap: 7 };

  const P = {
    ink: "#10100d", ui: "#171916", paper: "#dfcf9c", paperDim: "#8f8564", gold: "#d6ae56",
    rust: "#a45335", red: "#c75b3e", safe: "#91b174", ground: "#666642", groundLight: "#9c8c58",
    groundDark: "#3d4631", roof: "#4a382a", wall: "#88704e", wallLight: "#b9a06f", wood: "#453326"
  };

  // Original illustrated art is the actual mission map. Gameplay coordinates remain
  // independent, but this image owns the world’s buildings, rail lines, and props.
  const terrainBackdrop = typeof Image === "undefined" ? null : new Image();
  if (terrainBackdrop) {
    terrainBackdrop.decoding = "async";
    terrainBackdrop.src = "assets/mesa-junction-tactical-v2.png";
  }

  // This is a hand-traced collision pass over the mission artwork. Foundations,
  // railcars, walls, doors, stacks, and fences are physical; painted shadows and
  // shallow verandas stay walkable so the map has no invisible walls.
  const obstacles = [
    { x: 18, y: 208, w: 468, h: 385, kind: "building", label: "Paymaster Office", blocksSight: true,
      shape: "poly", points: [[20,269],[156,218],[326,236],[410,300],[402,458],[350,548],[167,579],[19,526]] },
    { x: 294, y: 56, w: 647, h: 255, kind: "building", label: "Freight Depot", blocksSight: true,
      shape: "poly", points: [[315,77],[630,55],[876,111],[940,188],[894,286],[667,305],[412,254],[294,161]] },
    { x: 877, y: 57, w: 355, h: 114, kind: "railcar", label: "North Boxcar", blocksSight: true,
      shape: "poly", points: [[895,66],[1197,78],[1232,117],[1209,167],[945,163],[877,127]] },
    { x: 1360, y: 54, w: 215, h: 256, kind: "tower", label: "Water Tower", blocksSight: true,
      shape: "poly", points: [[1400,61],[1536,59],[1575,118],[1569,227],[1535,303],[1415,285],[1360,185]] },
    { x: 821, y: 315, w: 379, h: 171, kind: "railcar", label: "Coal Car", blocksSight: true,
      shape: "poly", points: [[846,334],[1116,351],[1199,392],[1176,472],[916,452],[821,394]] },
    { x: 1183, y: 303, w: 492, h: 274, kind: "building", label: "Cargo Shed", blocksSight: true,
      shape: "poly", points: [[1221,318],[1534,294],[1669,353],[1675,521],[1558,570],[1324,553],[1183,447]] },
    { x: 605, y: 566, w: 474, h: 177, kind: "building", label: "Workshop", blocksSight: true,
      shape: "poly", points: [[629,580],[826,560],[1033,620],[1080,693],[1017,738],[787,717],[605,649]] },
    { x: 1370, y: 679, w: 261, h: 226, kind: "building", label: "East Shack", blocksSight: true,
      shape: "poly", points: [[1400,700],[1570,670],[1630,746],[1615,891],[1464,905],[1370,820]] },

    // Real prop footprints make cover meaningful but keep lanes around them open.
    { x: 23, y: 591, w: 347, h: 110, kind: "wagon", label: "Supply Wagon", blocksSight: false,
      shape: "poly", points: [[34,615],[271,588],[368,637],[344,692],[87,696],[23,655]] },
    { x: 1004, y: 279, w: 230, h: 74, kind: "logs", label: "Timber Stack", blocksSight: false,
      shape: "poly", points: [[1024,291],[1189,276],[1234,313],[1207,352],[1043,347],[1004,319]] },
    { x: 775, y: 442, w: 128, h: 96, kind: "crates", label: "Switchyard Crates", blocksSight: false,
      shape: "poly", points: [[793,455],[871,438],[903,484],[878,535],[803,522],[775,486]] },
    { x: 454, y: 643, w: 164, h: 103, kind: "logs", label: "Workshop Timber", blocksSight: false,
      shape: "poly", points: [[470,662],[585,646],[618,689],[593,742],[492,728],[454,694]] },

    // Compound walls and fencing use individual strokes, preserving the painted gate gaps.
    { x: 400, y: 515, w: 215, h: 70, kind: "wall", label: "Compound North Wall", blocksSight: true,
      shape: "segment", ax: 412, ay: 539, bx: 615, by: 575, width: 12 },
    { x: 400, y: 543, w: 82, h: 236, kind: "wall", label: "Compound West Wall", blocksSight: true,
      shape: "segment", ax: 426, ay: 563, bx: 482, by: 779, width: 12 },
    { x: 493, y: 786, w: 203, h: 61, kind: "wall", label: "Compound South Wall", blocksSight: true,
      shape: "segment", ax: 498, ay: 806, bx: 696, by: 837, width: 12 },
    { x: 1050, y: 600, w: 154, h: 167, kind: "wall", label: "Compound East Wall", blocksSight: true,
      shape: "segment", ax: 1080, ay: 611, bx: 1204, by: 757, width: 12 },
    { x: 1138, y: 735, w: 139, h: 91, kind: "fence", label: "South Fence", blocksSight: false,
      shape: "segment", ax: 1142, ay: 808, bx: 1277, by: 744, width: 8 },
    { x: 1231, y: 195, w: 139, h: 78, kind: "fence", label: "Water Fence", blocksSight: false,
      shape: "segment", ax: 1238, ay: 225, bx: 1370, by: 273, width: 8 },
    { x: 1330, y: 598, w: 106, h: 89, kind: "fence", label: "East Yard Fence", blocksSight: false,
      shape: "segment", ax: 1335, ay: 675, bx: 1436, by: 604, width: 8 }
  ];

  const hideZones = [
    { x: 190, y: 910, r: 60, label: "approach brush" },
    { x: 120, y: 141, r: 27, label: "brush" }, { x: 251, y: 388, r: 24, label: "shade" },
    { x: 525, y: 331, r: 23, label: "brush" }, { x: 687, y: 392, r: 24, label: "brush" },
    { x: 774, y: 517, r: 22, label: "shade" }, { x: 1134, y: 207, r: 22, label: "brush" },
    { x: 1269, y: 254, r: 25, label: "brush" }, { x: 1176, y: 574, r: 26, label: "brush" },
    { x: 370, y: 742, r: 26, label: "brush" }, { x: 711, y: 854, r: 25, label: "brush" },
    { x: 1243, y: 700, r: 25, label: "brush" }, { x: 1330, y: 886, r: 28, label: "brush" },
    { x: 1600, y: 629, r: 25, label: "shade" }, { x: 1615, y: 888, r: 29, label: "brush" }
  ];

  const coverZones = [
    { x: 289, y: 429, r: 25, label: "barrels" }, { x: 487, y: 286, r: 24, label: "crates" },
    { x: 686, y: 295, r: 26, label: "crates" }, { x: 807, y: 496, r: 25, label: "crates" },
    { x: 1008, y: 461, r: 27, label: "railcar" }, { x: 1218, y: 553, r: 26, label: "barrels" },
    { x: 1305, y: 471, r: 27, label: "crates" }, { x: 548, y: 686, r: 26, label: "barrels" },
    { x: 1095, y: 757, r: 26, label: "crates" }, { x: 1446, y: 630, r: 25, label: "barrels" }
  ];

  const exitZone = { x: 46, y: 768, w: 122, h: 118, label: "WEST GATE" };
  const telegraph = { x: 1362, y: 286, disabled: false, label: "SIGNAL RELAY" };
  const ledger = { x: 520, y: 500, taken: false, label: "PAYMASTER LEDGER" };

  const heroBlueprints = [
    {
      id: "quill", name: "JUNE MERCER", title: "QUILL · PATHFINDER",
      ability: "COIN TOSS", abilityShort: "Toss a sound lure", abilityType: "coin",
      hint: "Coin Toss armed: click a reachable patch of ground to divert a patrol.",
      color: "#d75c35", coat: "#31566a", skin: "#e7ac78",
      x: 190, y: 902, speed: 78, range: 180, cooldownMax: 5.3, health: 3, key: "1", weapon: "pistol"
    },
    {
      id: "rook", name: "SILAS ROOK", title: "ROOK · LONG GUN",
      ability: "COVER SHOT", abilityShort: "Range · loud", abilityType: "shot",
      hint: "Cover Shot armed: click a visible armed guard. The report will wake the yard.",
      color: "#d1a345", coat: "#6c3e2d", skin: "#d99e72",
      x: 226, y: 917, speed: 68, range: 270, cooldownMax: 7.6, health: 3, key: "2", weapon: "rifle"
    },
    {
      id: "ox", name: "TOMÁS GARZA", title: "OX · STRONGARM",
      ability: "QUIET TAKEDOWN", abilityShort: "Close · silent", abilityType: "takedown",
      hint: "Quiet Takedown armed: click an unaware guard close to Ox.",
      color: "#604128", coat: "#5b7046", skin: "#c8855d",
      x: 154, y: 928, speed: 60, range: 42, cooldownMax: 6.7, health: 4, key: "3", weapon: "shotgun"
    }
  ];

  const weapons = {
    rifle: { name: "RIFLE", glyph: "RFL", range: 188, damage: 2, cooldown: 2.1, color: "#e1b657" },
    pistol: { name: "PISTOL", glyph: "PST", range: 132, damage: 1, cooldown: 1.55, color: "#d9834b" },
    shotgun: { name: "SHOTGUN", glyph: "SGN", range: 78, damage: 2, cooldown: 2.7, color: "#d96a46" }
  };

  const guardBlueprints = [
    { id: "g-office", name: "Office Watch", x: 492, y: 492, face: Math.PI, weapon: "shotgun", patrol: [[492,492],[554,530],[540,610],[492,600]] },
    { id: "g-west", name: "West Gate Watch", x: 350, y: 700, face: 0, weapon: "pistol", patrol: [[350,700],[420,680],[395,730],[310,748]] },
    { id: "g-depot", name: "Depot Watch", x: 670, y: 350, face: 0, weapon: "rifle", patrol: [[670,350],[760,382],[736,454],[620,420]] },
    { id: "g-switch", name: "Switchyard Watch", x: 967, y: 510, face: 0, weapon: "pistol", patrol: [[967,510],[1080,516],[1108,566],[1012,600]] },
    { id: "g-rail", name: "Rail Watch", x: 1282, y: 280, face: 0, weapon: "rifle", patrol: [[1282,280],[1331,284],[1280,298],[1214,281]] },
    { id: "g-water", name: "Water Watch", x: 1282, y: 218, face: Math.PI, weapon: "rifle", patrol: [[1282,218],[1308,180],[1340,152],[1312,132]] },
    { id: "g-cargo", name: "Cargo Watch", x: 1348, y: 604, face: Math.PI, weapon: "shotgun", patrol: [[1348,604],[1480,594],[1535,644],[1406,677]] },
    { id: "g-compound", name: "Compound Watch", x: 765, y: 780, face: -Math.PI / 2, weapon: "rifle", patrol: [[765,780],[850,790],[875,850],[734,852]] },
    { id: "g-shack", name: "Shack Watch", x: 1330, y: 754, face: 0, weapon: "pistol", patrol: [[1330,754],[1334,816],[1288,858],[1248,821],[1243,700]] }
  ];

  let heroes = [];
  let guards = [];
  let lastTime = 0;
  let domTick = 0;
  const terrainBits = makeTerrain();
  const state = {
    started: false, paused: false, won: false, lost: false, selection: [0, 1, 2], focus: 0,
    alarm: 0, elapsed: 0, message: "Choose a hand, then click the ground to give an order.", messageTimer: 0,
    noise: [], flashes: [], abilityMode: null, pointer: { x: -100, y: -100, sx: -100, sy: -100 },
    stage: 0, objectiveText: "1/3 CUT THE TELEGRAPH", reinforcementsCalled: false,
    lastAlert: 0, commandsIssued: 0, lossReason: "", camera: { x: 0, y: 0 }, cameraTarget: null, followSelected: false,
    lastRunOrder: 0, interaction: null, attackMode: false
  };

  function makeTerrain() {
    let seed = 2166136261;
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 10000) / 10000;
    };
    return Array.from({ length: 1180 }, () => ({
      x: WORLD.left + Math.floor(rnd() * WORLD.w), y: WORLD.top + Math.floor(rnd() * WORLD.h),
      r: rnd() < .72 ? 1 : 2, tone: Math.floor(rnd() * 4)
    }));
  }

  function cloneHero(source) {
    return {
      ...source, maxHealth: source.health, path: [], queue: [], cooldown: 0, hidden: false, cover: false, down: false,
      moving: false, facing: -Math.PI / 2, renderFacing: -Math.PI / 2, step: 0, motion: Math.random() * TAU,
      walkBlend: 0, runBlend: 0, crouchBlend: 0, stance: "stand", actualSpeed: 0,
      moveMode: "walk", runNoiseCooldown: 0, hitFlash: 0, weaponCooldown: 0,
      weaponData: weapons[source.weapon], colliderRadius: 7, stuckTime: 0, blockedByActor: false
    };
  }

  function cloneGuard(source) {
    return {
      ...source, x: source.x, y: source.y, face: source.face, patrolIndex: 1, mode: "patrol", investigate: null,
      lastSeen: null, suspicion: 0, down: false, moving: false, speed: source.speed ?? 30,
      vision: source.vision ?? Math.max(88, Math.round(weapons[source.weapon].range * .58 + 34)),
      fov: Math.PI * .52, step: 0, motion: Math.random() * TAU, walkBlend: 0, runBlend: 0, actualSpeed: 0,
      moveMode: "walk", facing: source.face, renderFacing: source.face, route: [], routeGoal: null, fireCooldown: 1.05,
      weaponData: weapons[source.weapon], damage: source.damage ?? (source.weapon === "rifle" ? 1 : weapons[source.weapon].damage),
      colliderRadius: 7, health: source.health ?? 2, maxHealth: source.health ?? 2,
      hidden: false, stuckTime: 0, blockedByActor: false,
      standoffRange: source.standoffRange ?? Math.max(56, Math.round(weapons[source.weapon].range * .5))
    };
  }

  function resetGame(keepStarted = false) {
    heroes = heroBlueprints.map(cloneHero);
    guards = guardBlueprints.map(cloneGuard);
    telegraph.disabled = false;
    ledger.taken = false;
    Object.assign(state, {
      started: keepStarted, paused: false, won: false, lost: false, selection: [0, 1, 2], focus: 0, alarm: 0, elapsed: 0,
      message: "The west gate is quiet. Disable the signal relay before the yard goes loud.", messageTimer: 5,
      noise: [], flashes: [], abilityMode: null, interaction: null, stage: 0, objectiveText: "1/3 DISABLE SIGNAL RELAY",
      reinforcementsCalled: false, lastAlert: 0, commandsIssued: 0, lossReason: "", camera: { x: 0, y: 0 }, cameraTarget: null, followSelected: false,
      lastRunOrder: 0, attackMode: false
    });
    if (keepStarted && heroes[0]) setCameraTo(heroes[0].x, heroes[0].y, true);
    outcomePanel.classList.add("hidden");
    updateRoster();
    updateDom(true);
  }

  function startGame() {
    if (!state.started) {
      resetGame(true);
      introPanel.classList.add("hidden");
    }
    canvas.focus({ preventScroll: true });
  }

  function finish(won) {
    if (state.won || state.lost) return;
    state.won = won;
    state.lost = !won;
    state.paused = false;
    state.abilityMode = null;
    state.attackMode = false;
    state.interaction = null;
    outcomePanel.classList.remove("hidden");
    if (won) {
      const unconscious = guards.filter((guard) => guard.down).length;
      outcomeKicker.textContent = "CONTRACT COMPLETE";
      outcomeTitle.textContent = "YARD GONE COLD";
      outcomeText.textContent = `The signal stayed dark and the payroll book disappeared. ${unconscious ? `${unconscious} armed watch${unconscious === 1 ? "man" : "men"} never made it home.` : "The crew left no one on the ground."} Time: ${formatTime(state.elapsed)}.`;
    } else {
      outcomeKicker.textContent = "CONTRACT BURNED";
      outcomeTitle.textContent = state.lossReason || "CREW PINNED DOWN";
      outcomeText.textContent = "The yard has control of the angles. Reset the plan, use cover, and keep the alarm below the call-out threshold.";
    }
    updateDom(true);
  }

  function setMessage(message, seconds = 3.2) {
    state.message = message;
    state.messageTimer = seconds;
    updateDom(true);
  }

  function setStage(stage) {
    state.stage = stage;
    state.objectiveText = stage === 0 ? "1/3 DISABLE SIGNAL RELAY" : stage === 1 ? "2/3 TAKE PAYMASTER LEDGER" : "3/3 EXIT WEST GATE";
  }

  function activeMissionObjective() {
    if (state.stage === 0) return { type: "signal", point: telegraph, range: 34, duration: 1.55, verb: "disable the signal relay" };
    if (state.stage === 1) return { type: "ledger", point: ledger, range: 32, duration: 1.25, verb: "lift the payroll ledger" };
    return null;
  }

  function clearInteraction() {
    state.interaction = null;
  }

  function toggleCrouch() {
    const squad = selectedHeroes();
    if (!squad.length) return;
    const crouch = squad.some((hero) => hero.stance !== "crouch");
    squad.forEach((hero) => {
      hero.stance = crouch ? "crouch" : "stand";
      if (crouch) hero.moveMode = "walk";
    });
    setMessage(crouch ? `${squad.length === 1 ? squad[0].name.split(" ")[0] : "The crew"} drops low: slower, quieter, harder to spot.` : `${squad.length === 1 ? squad[0].name.split(" ")[0] : "The crew"} stands ready.`, 2.1);
  }

  function tryInteract() {
    if (!state.started || state.paused || state.won || state.lost) return;
    const objective = activeMissionObjective();
    const hero = selectedHeroes().sort((a, b) => distanceXY(a.x, a.y, objective?.point?.x ?? 0, objective?.point?.y ?? 0) - distanceXY(b.x, b.y, objective?.point?.x ?? 0, objective?.point?.y ?? 0))[0] || currentHero();
    if (!hero || hero.down) return;
    if (!objective) {
      setMessage(`The ${exitZone.label.toLowerCase()} is open — get a hand through it.`, 2.2);
      return;
    }
    if (distanceXY(hero.x, hero.y, objective.point.x, objective.point.y) > objective.range) {
      setMessage(`Move ${hero.name.split(" ")[0]} close enough to ${objective.verb}.`, 2.4);
      return;
    }
    hero.path = [];
    hero.queue = [];
    hero.actualSpeed = 0;
    hero.moveMode = "walk";
    state.interaction = { heroId: hero.id, type: objective.type, progress: 0, duration: objective.duration };
    setMessage(`${hero.name.split(" ")[0]} begins to ${objective.verb}...`, objective.duration + .8);
  }

  function completeInteraction(hero, type) {
    clearInteraction();
    if (type === "signal" && state.stage === 0) {
      telegraph.disabled = true;
      setStage(1);
      state.flashes.push({ x: telegraph.x, y: telegraph.y, ttl: 1.1, max: 1.1, kind: "telegraph" });
      setMessage(`${hero.name.split(" ")[0]} cripples the signal relay. No reinforcements are coming.`, 4);
    } else if (type === "ledger" && state.stage === 1) {
      ledger.taken = true;
      setStage(2);
      state.flashes.push({ x: ledger.x, y: ledger.y, ttl: 1.1, max: 1.1, kind: "ledger" });
      setMessage(`${hero.name.split(" ")[0]} has the ledger. Reach the west gate.`, 4);
    }
  }

  function formatTime(total) {
    const minutes = Math.floor(total / 60).toString().padStart(2, "0");
    const seconds = Math.floor(total % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function distanceXY(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function angleBetween(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function angleDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function pointInRect(x, y, rect, pad = 0) { return x > rect.x - pad && x < rect.x + rect.w + pad && y > rect.y - pad && y < rect.y + rect.h + pad; }

  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
      const [currentX, currentY] = points[index];
      const [previousX, previousY] = points[previous];
      const crosses = (currentY > y) !== (previousY > y);
      const edgeX = (previousX - currentX) * (y - currentY) / (previousY - currentY || .00001) + currentX;
      if (crosses && x < edgeX) inside = !inside;
    }
    return inside;
  }

  function distancePointToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const span = dx * dx + dy * dy;
    const along = span ? clamp(((px - ax) * dx + (py - ay) * dy) / span, 0, 1) : 0;
    return Math.hypot(px - (ax + dx * along), py - (ay + dy * along));
  }

  function pointInObstacle(x, y, obstacle, pad = 0) {
    if (obstacle.shape === "segment") {
      return distancePointToSegment(x, y, obstacle.ax, obstacle.ay, obstacle.bx, obstacle.by) <= (obstacle.width || 0) * .5 + pad;
    }
    if (obstacle.shape === "circle") return distanceXY(x, y, obstacle.cx, obstacle.cy) <= obstacle.r + pad;
    if (obstacle.shape === "poly") {
      if (!pointInRect(x, y, obstacle, pad)) return false;
      if (pointInPolygon(x, y, obstacle.points)) return true;
      if (!pad) return false;
      return obstacle.points.some((point, index) => {
        const next = obstacle.points[(index + 1) % obstacle.points.length];
        return distancePointToSegment(x, y, point[0], point[1], next[0], next[1]) <= pad;
      });
    }
    return pointInRect(x, y, obstacle, pad);
  }

  function isWalkable(x, y, pad = COLLISION.terrainPad) {
    if (x < WORLD.left + pad || x > WORLD.right - pad || y < WORLD.top + pad || y > WORLD.bottom - pad) return false;
    return !obstacles.some((obstacle) => pointInObstacle(x, y, obstacle, pad));
  }

  function segmentIsClear(ax, ay, bx, by, pad = COLLISION.terrainPad) {
    const span = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(span / 7));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      if (!isWalkable(ax + (bx - ax) * t, ay + (by - ay) * t, pad)) return false;
    }
    return true;
  }

  function segmentBlocked(ax, ay, bx, by) {
    const span = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(span / 5));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (obstacles.some((obstacle) => obstacle.blocksSight !== false && pointInObstacle(x, y, obstacle))) return true;
    }
    return false;
  }

  function bodyBlocksPosition(actor, x, y) {
    const actorIsHero = heroes.includes(actor);
    return [...heroes, ...guards].some((other) => {
      if (other === actor || other.down) return false;
      const otherIsHero = heroes.includes(other);
      const gap = actorIsHero === otherIsHero ? COLLISION.unitGap : COLLISION.enemyGap;
      return distanceXY(x, y, other.x, other.y) < (actor.colliderRadius ?? 7) + (other.colliderRadius ?? 7) + gap;
    });
  }

  function canOccupy(actor, x, y) {
    return isWalkable(x, y, actor.colliderRadius ?? COLLISION.terrainPad) && !bodyBlocksPosition(actor, x, y);
  }

  function gridPoint(col, row) { return { x: GRID.x + col * GRID.cell + GRID.cell / 2, y: GRID.y + row * GRID.cell + GRID.cell / 2 }; }
  function gridCell(x, y) { return { col: clamp(Math.floor((x - GRID.x) / GRID.cell), 0, GRID.cols - 1), row: clamp(Math.floor((y - GRID.y) / GRID.cell), 0, GRID.rows - 1) }; }
  function keyFor(col, row) { return `${col},${row}`; }

  function findNearestOpen(cell) {
    const initial = gridPoint(cell.col, cell.row);
    if (isWalkable(initial.x, initial.y)) return cell;
    for (let radius = 1; radius < 15; radius += 1) {
      for (let row = cell.row - radius; row <= cell.row + radius; row += 1) {
        for (let col = cell.col - radius; col <= cell.col + radius; col += 1) {
          if (Math.abs(col - cell.col) !== radius && Math.abs(row - cell.row) !== radius) continue;
          if (col < 0 || row < 0 || col >= GRID.cols || row >= GRID.rows) continue;
          const candidate = gridPoint(col, row);
          if (isWalkable(candidate.x, candidate.y)) return { col, row };
        }
      }
    }
    return null;
  }

  function findPath(fromX, fromY, toX, toY) {
    const start = findNearestOpen(gridCell(fromX, fromY));
    const goal = findNearestOpen(gridCell(toX, toY));
    if (!start || !goal) return [];
    const startKey = keyFor(start.col, start.row);
    const goalKey = keyFor(goal.col, goal.row);
    if (startKey === goalKey) return [{ x: toX, y: toY }];

    const open = [startKey];
    const openSet = new Set([startKey]);
    const closed = new Set();
    const costs = new Map([[startKey, 0]]);
    const score = new Map([[startKey, Math.hypot(goal.col - start.col, goal.row - start.row)]]);
    const cameFrom = new Map();
    const cells = new Map([[startKey, start]]);
    const directions = [[-1,0,1],[1,0,1],[0,-1,1],[0,1,1],[-1,-1,1.4],[1,-1,1.4],[-1,1,1.4],[1,1,1.4]];
    let found = false;

    while (open.length) {
      let best = 0;
      for (let i = 1; i < open.length; i += 1) if ((score.get(open[i]) ?? Infinity) < (score.get(open[best]) ?? Infinity)) best = i;
      const currentKey = open.splice(best, 1)[0];
      openSet.delete(currentKey);
      if (currentKey === goalKey) { found = true; break; }
      closed.add(currentKey);
      const current = cells.get(currentKey);
      for (const [dc, dr, cost] of directions) {
        const col = current.col + dc;
        const row = current.row + dr;
        if (col < 0 || row < 0 || col >= GRID.cols || row >= GRID.rows) continue;
        const neighborKey = keyFor(col, row);
        if (closed.has(neighborKey)) continue;
        const point = gridPoint(col, row);
        if (!isWalkable(point.x, point.y)) continue;
        if (dc && dr) {
          const sideA = gridPoint(current.col + dc, current.row);
          const sideB = gridPoint(current.col, current.row + dr);
          if (!isWalkable(sideA.x, sideA.y) || !isWalkable(sideB.x, sideB.y)) continue;
        }
        const nextCost = (costs.get(currentKey) ?? Infinity) + cost;
        if (nextCost < (costs.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          costs.set(neighborKey, nextCost);
          score.set(neighborKey, nextCost + Math.hypot(goal.col - col, goal.row - row));
          cells.set(neighborKey, { col, row });
          if (!openSet.has(neighborKey)) { open.push(neighborKey); openSet.add(neighborKey); }
        }
      }
    }
    if (!found) return [];
    const raw = [];
    let current = goalKey;
    while (current !== startKey) {
      const cell = cells.get(current);
      raw.push(gridPoint(cell.col, cell.row));
      current = cameFrom.get(current);
    }
    raw.reverse();
    const requested = { x: clamp(toX, WORLD.left + 12, WORLD.right - 12), y: clamp(toY, WORLD.top + 12, WORLD.bottom - 12) };
    raw.push(isWalkable(requested.x, requested.y, 9) ? requested : gridPoint(goal.col, goal.row));
    const simple = [];
    let anchor = { x: fromX, y: fromY };
    let index = 0;
    while (index < raw.length) {
      let furthest = index;
      for (let next = index + 1; next < raw.length; next += 1) {
        if (segmentIsClear(anchor.x, anchor.y, raw[next].x, raw[next].y)) furthest = next;
        else break;
      }
      simple.push(raw[furthest]);
      anchor = raw[furthest];
      index = furthest + 1;
    }
    return simple;
  }

  function selectedHeroIndexes() {
    return state.selection.filter((index) => heroes[index] && !heroes[index].down);
  }

  function selectedHeroes() {
    return selectedHeroIndexes().map((index) => heroes[index]);
  }

  function isHeroSelected(index) {
    return state.selection.includes(index) && !heroes[index]?.down;
  }

  function currentHero() {
    if (heroes[state.focus] && !heroes[state.focus].down) return heroes[state.focus];
    const fallback = selectedHeroIndexes()[0] ?? heroes.findIndex((hero) => !hero.down);
    state.focus = Math.max(0, fallback);
    return heroes[state.focus];
  }

  function chooseHero(index, additive = false) {
    if (!state.started || state.won || state.lost) return;
    const next = (index + heroes.length) % heroes.length;
    const hero = heroes[next];
    if (!hero || hero.down) { setMessage(`${heroes[next]?.name?.split(" ")[0] || "That hand"} is down. Pick another hand.`); return; }
    if (additive) {
      state.selection = state.selection.includes(next)
        ? state.selection.filter((candidate) => candidate !== next)
        : [...state.selection, next].sort((a, b) => a - b);
      if (!state.selection.length) state.selection = [next];
    } else state.selection = [next];
    state.focus = next;
    state.abilityMode = null;
    state.attackMode = false;
    const count = selectedHeroes().length;
    setMessage(count === 1 ? `${hero.name} is on point. ${hero.weaponData.name} ready; ${hero.ability} is available.` : `${count} hands selected. ${hero.name.split(" ")[0]} is on point.`, 2.2);
    updateRoster();
  }

  function selectAllHeroes(announce = true) {
    const standing = heroes.map((hero, index) => !hero.down ? index : -1).filter((index) => index >= 0);
    if (!standing.length) return;
    state.selection = standing;
    if (!standing.includes(state.focus)) state.focus = standing[0];
    state.abilityMode = null;
    state.attackMode = false;
    if (announce) setMessage(`${standing.length} hands selected. Click ground to move the crew in formation.`, 2.3);
    updateRoster();
  }

  function chooseNextStanding(afterIndex) {
    for (let offset = 1; offset <= heroes.length; offset += 1) {
      const candidate = (afterIndex + offset) % heroes.length;
      if (!heroes[candidate].down) {
        state.selection = [candidate];
        state.focus = candidate;
        updateRoster();
        return;
      }
    }
  }

  function lastQueuedEndpoint(hero) {
    for (let i = hero.queue.length - 1; i >= 0; i -= 1) if (hero.queue[i].type === "move") return hero.queue[i].end;
    if (hero.path.length) return hero.path[hero.path.length - 1];
    return { x: hero.x, y: hero.y };
  }

  function issueMove(hero, x, y, { run = false, quiet = false } = {}) {
    if (hero.down) return;
    if (state.interaction) clearInteraction();
    if (run && hero.stance === "crouch") hero.stance = "stand";
    const origin = state.paused ? lastQueuedEndpoint(hero) : { x: hero.x, y: hero.y };
    const path = findPath(origin.x, origin.y, x, y);
    if (!path.length) { if (!quiet) setMessage("That route is blocked by the yard."); return false; }
    const command = { type: "move", path, end: path[path.length - 1], run };
    if (state.paused) {
      hero.queue.push(command);
      if (!quiet) setMessage(`${hero.name.split(" ")[0]} will ${run ? "run" : "move"} when the plan runs.`, 2.1);
    } else {
      hero.path = path;
      hero.queue = [];
      hero.moveMode = run ? "run" : "walk";
      hero.runNoiseCooldown = run ? .12 : 0;
      state.followSelected = true;
      if (!quiet) setMessage(run ? `${hero.name.split(" ")[0]} is running — faster, but noisier.` : `${hero.name.split(" ")[0]} is moving.`, 1.8);
    }
    state.commandsIssued += 1;
    return true;
  }

  function squadCenter(squad = selectedHeroes()) {
    if (!squad.length) return { x: WORLD.left + 40, y: WORLD.bottom - 40 };
    return squad.reduce((center, hero) => ({ x: center.x + hero.x / squad.length, y: center.y + hero.y / squad.length }), { x: 0, y: 0 });
  }

  function nearestWalkablePoint(x, y) {
    if (isWalkable(x, y, 8)) return { x, y };
    const open = findNearestOpen(gridCell(x, y));
    return open ? gridPoint(open.col, open.row) : null;
  }

  function issueSquadMove(x, y, { run = false } = {}) {
    const squad = selectedHeroes();
    if (!squad.length) return;
    if (state.interaction) clearInteraction();
    const center = squadCenter(squad);
    const heading = angleBetween(center.x, center.y, x, y);
    const forward = { x: Math.cos(heading), y: Math.sin(heading) };
    const side = { x: -forward.y, y: forward.x };
    const formation = squad.length === 1 ? [[0, 0]] : squad.length === 2 ? [[-13, 5], [13, 5]] : [[0, -13], [-17, 10], [17, 10]];
    let moved = 0;
    squad.forEach((hero, index) => {
      const [lateral, back] = formation[index] || [0, 0];
      const desiredX = x + side.x * lateral - forward.x * back;
      const desiredY = y + side.y * lateral - forward.y * back;
      const target = nearestWalkablePoint(desiredX, desiredY);
      if (target && issueMove(hero, target.x, target.y, { run, quiet: true })) moved += 1;
    });
    if (!moved) { setMessage("That route is blocked by the yard."); return; }
    state.followSelected = true;
    setMessage(run ? `${moved} hand${moved === 1 ? "" : "s"} break into a run — guards can hear it.` : `${moved} hand${moved === 1 ? "" : "s"} move in formation.`, 1.9);
  }

  function armAbility() {
    const hero = currentHero();
    if (!hero || hero.down) return;
    if (hero.cooldown > 0) { setMessage(`${hero.ability} reloads in ${hero.cooldown.toFixed(1)}s.`); return; }
    state.attackMode = false;
    state.abilityMode = hero.abilityType;
    if (hero.abilityType === "coin") setMessage("Coin Toss armed. Click a reachable patch of ground.", 4);
    if (hero.abilityType === "shot") setMessage("Cover Shot armed. Click a visible armed guard.", 4);
    if (hero.abilityType === "takedown") setMessage("Quiet Takedown armed. Click an unaware guard close to Ox.", 4);
    updateDom(true);
  }

  function armWeapon() {
    const hero = currentHero();
    if (!hero || hero.down) return;
    if (hero.weaponCooldown > 0) { setMessage(`${hero.weaponData.name} is cycling for ${hero.weaponCooldown.toFixed(1)}s.`); return; }
    state.abilityMode = null;
    state.attackMode = true;
    setMessage(`${hero.name.split(" ")[0]}'s ${hero.weaponData.name} is ready. Click a guard with a clear line.`, 4);
    updateDom(true);
  }

  function nearestGuardAt(x, y, range = 18) {
    return guards.find((guard) => !guard.down && (!guard.hidden || distanceXY(guard.x, guard.y, x, y) < 12) && distanceXY(guard.x, guard.y, x, y) <= range);
  }

  function woundGuard(guard, damage, source, { silent = false } = {}) {
    guard.hidden = false;
    guard.health = Math.max(0, guard.health - damage);
    guard.mode = "alert";
    guard.lastSeen = { x: source.x, y: source.y };
    guard.suspicion = 1;
    if (guard.health <= 0) {
      guard.down = true;
      guard.mode = "down";
      guard.route = [];
      return true;
    }
    if (!silent) state.flashes.push({ x: guard.x, y: guard.y, ttl: .35, max: .35, kind: "hit" });
    return false;
  }

  function fireHeroWeapon(hero, guard) {
    if (!hero || hero.down || !guard || guard.down) return false;
    if (hero.weaponCooldown > 0) { setMessage(`${hero.weaponData.name} is cycling.`, 1.2); return false; }
    if (distance(hero, guard) > hero.weaponData.range || segmentBlocked(hero.x, hero.y, guard.x, guard.y)) {
      setMessage(`${hero.name.split(" ")[0]} does not have a clean ${hero.weaponData.name.toLowerCase()} line.`, 2.1);
      return false;
    }
    hero.weaponCooldown = hero.weaponData.cooldown;
    hero.facing = angleBetween(hero.x, hero.y, guard.x, guard.y);
    state.noise.push({ x: guard.x, y: guard.y, ttl: 3.2, max: 3.2, kind: "shot", radius: 342 });
    state.flashes.push({ x: guard.x, y: guard.y, ttl: .62, max: .62, kind: "shot", from: { x: hero.x, y: hero.y } });
    const down = woundGuard(guard, hero.weaponData.damage, hero);
    guards.forEach((other) => {
      if (!other.down && other !== guard && distance(other, guard) < 310) {
        other.hidden = false;
        other.mode = "investigate";
        other.investigate = { x: guard.x, y: guard.y, ttl: 5 };
      }
    });
    state.alarm = clamp(state.alarm + 14, 0, 100);
    setMessage(down ? `${hero.name.split(" ")[0]}'s ${hero.weaponData.name.toLowerCase()} drops a guard.` : `${hero.name.split(" ")[0]} hits the guard — the yard is going loud.`, 2.5);
    return true;
  }

  function giveAttackOrder(x, y) {
    const hero = currentHero();
    const guard = nearestGuardAt(x, y, 24);
    if (!guard) { setMessage("Put the reticle directly over an armed guard.", 1.8); return false; }
    let fired = false;
    if (state.paused) {
      hero.queue.push({ type: "fire", x: guard.x, y: guard.y, guardId: guard.id });
      fired = true;
      setMessage(`${hero.weaponData.name} shot queued. Release the plan when ready.`, 2.3);
    } else fired = fireHeroWeapon(hero, guard);
    if (fired) state.commandsIssued += 1;
    state.attackMode = false;
    return fired;
  }

  function giveAbilityOrder(x, y) {
    const hero = currentHero();
    if (!hero || !state.abilityMode) return false;
    const targetGuard = nearestGuardAt(x, y, 24);
    const order = { type: state.abilityMode, x, y, guardId: targetGuard?.id || null };
    if (state.paused) {
      hero.queue.push(order);
      setMessage(`${hero.ability} queued. Release the plan when ready.`, 2.5);
    } else executeAbility(hero, order);
    state.abilityMode = null;
    state.commandsIssued += 1;
    return true;
  }

  function executeAbility(hero, order) {
    if (hero.cooldown > 0 || hero.down) return false;
    if (order.type === "coin") {
      if (distanceXY(hero.x, hero.y, order.x, order.y) > hero.range || !isWalkable(order.x, order.y, 3)) { setMessage("That toss is out of reach."); return false; }
      hero.cooldown = hero.cooldownMax;
      state.noise.push({ x: order.x, y: order.y, ttl: 5, max: 5, kind: "coin" });
      state.flashes.push({ x: order.x, y: order.y, ttl: .45, max: .45, kind: "coin" });
      guards.forEach((guard) => {
        if (!guard.down && guard.mode !== "alert" && distanceXY(guard.x, guard.y, order.x, order.y) < 270) {
          guard.mode = "investigate";
          guard.investigate = { x: order.x, y: order.y, ttl: 5.5 };
        }
      });
      setMessage("Coin sings on the dust. Nearby patrols peel off to inspect it.", 3.1);
      return true;
    }
    const guard = guards.find((candidate) => candidate.id === order.guardId);
    if (!guard || guard.down) { setMessage("No target there."); return false; }
    const range = distance(hero, guard);
    if (order.type === "shot") {
      if (range > hero.range || segmentBlocked(hero.x, hero.y, guard.x, guard.y)) { setMessage("Rook does not have a clean line."); return false; }
      hero.cooldown = hero.cooldownMax;
      guard.down = true;
      guard.mode = "down";
      state.alarm = clamp(state.alarm + 22, 0, 100);
      state.noise.push({ x: guard.x, y: guard.y, ttl: 3.8, max: 3.8, kind: "shot" });
      state.flashes.push({ x: guard.x, y: guard.y, ttl: .7, max: .7, kind: "shot", from: { x: hero.x, y: hero.y } });
      guards.forEach((other) => {
        if (!other.down && other !== guard && distance(other, guard) < 285) {
          other.mode = "investigate";
          other.investigate = { x: guard.x, y: guard.y, ttl: 5 };
        }
      });
      setMessage("Cover Shot lands. Every armed guard heard it.", 3.2);
      return true;
    }
    if (order.type === "takedown") {
      if (range > hero.range || guard.mode === "alert" || guard.suspicion > .42) { setMessage(range > hero.range ? "Ox needs to get closer." : "That guard is too alert for a quiet takedown."); return false; }
      hero.cooldown = hero.cooldownMax;
      guard.down = true;
      guard.mode = "down";
      state.flashes.push({ x: guard.x, y: guard.y, ttl: .5, max: .5, kind: "takedown" });
      setMessage("Quiet as a dropped hat. One armed guard is out.", 3);
      return true;
    }
    return false;
  }

  function togglePause() {
    if (!state.started || state.won || state.lost) return;
    state.paused = !state.paused;
    setMessage(state.paused ? "TACTICAL PAUSE — queue routes and abilities, then press Space to run them." : "Plan released. Watch every sight-line.", state.paused ? 5 : 2.2);
    updateDom(true);
  }

  function moveActor(actor, target, speed, dt) {
    const dx = target.x - actor.x;
    const dy = target.y - actor.y;
    const length = Math.hypot(dx, dy);
    const radius = actor.colliderRadius ?? 7;
    actor.blockedByActor = false;
    if (length < 1.2) {
      actor.x = target.x;
      actor.y = target.y;
      actor.actualSpeed = 0;
      actor.moving = false;
      actor.stuckTime = 0;
      return true;
    }

    // Follow a path at a constant, predictable speed. Small collision-safe steps
    // prevent the old velocity/tangent loop from making units buzz against walls.
    const travel = Math.min(speed * dt, length);
    const pieces = Math.max(1, Math.ceil(travel / 3));
    const piece = travel / pieces;
    const before = { x: actor.x, y: actor.y };
    let moved = 0;
    for (let step = 0; step < pieces; step += 1) {
      const heading = angleBetween(actor.x, actor.y, target.x, target.y);
      let candidate = null;
      for (const offset of [0, .2, -.2, .42, -.42]) {
        const nextX = actor.x + Math.cos(heading + offset) * piece;
        const nextY = actor.y + Math.sin(heading + offset) * piece;
        if (!isWalkable(nextX, nextY, radius)) continue;
        if (bodyBlocksPosition(actor, nextX, nextY)) { actor.blockedByActor = true; continue; }
        const nextDistance = distanceXY(nextX, nextY, target.x, target.y);
        if (nextDistance <= distanceXY(actor.x, actor.y, target.x, target.y) + .15) {
          candidate = { x: nextX, y: nextY };
          break;
        }
      }
      if (!candidate) break;
      actor.x = candidate.x;
      actor.y = candidate.y;
      moved += piece;
    }
    const actualX = actor.x - before.x;
    const actualY = actor.y - before.y;
    const actualDistance = Math.hypot(actualX, actualY);
    if (actualDistance > .01) {
      actor.facing = Math.atan2(actualY, actualX);
      if (Object.prototype.hasOwnProperty.call(actor, "face")) actor.face = actor.facing;
      actor.step += actualDistance / 15;
      actor.stuckTime = 0;
    } else actor.stuckTime = (actor.stuckTime || 0) + dt;
    actor.actualSpeed = dt ? actualDistance / dt : 0;
    actor.moving = actualDistance > .01;
    if (distanceXY(actor.x, actor.y, target.x, target.y) <= Math.max(1.3, travel * .55) && canOccupy(actor, target.x, target.y)) {
      actor.x = target.x;
      actor.y = target.y;
      actor.actualSpeed = 0;
      actor.moving = false;
      actor.stuckTime = 0;
      return true;
    }
    return false;
  }

  function updateActorPose(actor, dt) {
    const turn = angleDelta(actor.facing, actor.renderFacing);
    actor.renderFacing += clamp(turn, -dt * 7.1, dt * 7.1);
    const pace = clamp((actor.actualSpeed || 0) / Math.max(1, actor.speed || 60), 0, 1.8);
    const targetWalk = actor.moving ? clamp(.46 + pace * .54, 0, 1) : 0;
    const targetRun = actor.moving && actor.moveMode === "run" ? 1 : 0;
    actor.walkBlend += (targetWalk - actor.walkBlend) * Math.min(1, dt * 10.5);
    actor.runBlend += (targetRun - actor.runBlend) * Math.min(1, dt * 8.5);
    if (Object.prototype.hasOwnProperty.call(actor, "stance")) {
      const targetCrouch = actor.stance === "crouch" ? 1 : 0;
      actor.crouchBlend += (targetCrouch - actor.crouchBlend) * Math.min(1, dt * 8);
    }
    actor.motion += dt * (actor.moving ? 5.7 + pace * 7.2 + actor.runBlend * 5.3 : 1.35);
  }

  function followGuardRoute(guard, destination, speed, dt) {
    const goalChanged = !guard.routeGoal || distanceXY(guard.routeGoal.x, guard.routeGoal.y, destination.x, destination.y) > 22;
    if (goalChanged) {
      guard.routeGoal = { x: destination.x, y: destination.y };
      guard.route = findPath(guard.x, guard.y, destination.x, destination.y);
    }
    if (!guard.route.length) {
      guard.moving = false;
      return false;
    }
    const waypoint = guard.route[0];
    const beforeX = guard.x, beforeY = guard.y;
    if (moveActor(guard, waypoint, speed, dt)) guard.route.shift();
    if (!guard.route.length && distanceXY(guard.x, guard.y, destination.x, destination.y) < 13) guard.routeGoal = null;
    return distanceXY(beforeX, beforeY, guard.x, guard.y) > .05;
  }

  function runQueued(hero) {
    if (hero.path.length || !hero.queue.length || hero.down) return;
    const command = hero.queue.shift();
    if (command.type === "move") {
      hero.path = command.path.map((point) => ({ ...point }));
      hero.moveMode = command.run ? "run" : "walk";
      hero.runNoiseCooldown = command.run ? .12 : 0;
    }
    else if (command.type === "fire") fireHeroWeapon(hero, guards.find((guard) => guard.id === command.guardId));
    else executeAbility(hero, command);
  }

  function updateHero(hero, dt) {
    if (hero.down) return;
    hero.cooldown = Math.max(0, hero.cooldown - dt);
    hero.weaponCooldown = Math.max(0, hero.weaponCooldown - dt);
    hero.hitFlash = Math.max(0, hero.hitFlash - dt);
    hero.hidden = hideZones.some((zone) => distanceXY(hero.x, hero.y, zone.x, zone.y) < zone.r * .72);
    hero.cover = coverZones.some((zone) => distanceXY(hero.x, hero.y, zone.x, zone.y) < zone.r * .7);
    hero.moving = false;
    if (hero.path.length) {
      const target = hero.path[0];
      const speed = hero.speed * (hero.moveMode === "run" ? 1.65 : 1) * (hero.stance === "crouch" ? .58 : 1);
      if (moveActor(hero, target, speed, dt)) hero.path.shift();
      if (hero.stuckTime > .5 && !hero.blockedByActor && hero.path.length) {
        const end = hero.path[hero.path.length - 1];
        hero.path = findPath(hero.x, hero.y, end.x, end.y);
        hero.stuckTime = 0;
      }
      if (hero.moving && hero.moveMode === "run") {
        hero.runNoiseCooldown -= dt;
        if (hero.runNoiseCooldown <= 0) {
          state.noise.push({ x: hero.x, y: hero.y, ttl: .48, max: .48, kind: "run", radius: 154 });
          hero.runNoiseCooldown = .64;
        }
      }
      if (!hero.path.length) hero.moveMode = "walk";
    } else {
      hero.actualSpeed = 0;
      hero.moveMode = "walk";
      runQueued(hero);
    }
    updateActorPose(hero, dt);
  }

  function seenHeroBy(guard) {
    let seen = null;
    let nearest = Infinity;
    for (const hero of heroes) {
      if (hero.down || hero.hidden) continue;
      const range = distance(guard, hero);
      if (guard.hidden && range > 94) continue;
      const exposure = hero.stance === "crouch" ? .52 : hero.cover ? .7 : 1;
      if (range > guard.vision * exposure) continue;
      const angle = angleBetween(guard.x, guard.y, hero.x, hero.y);
      if (Math.abs(angleDelta(angle, guard.face)) > guard.fov / 2) continue;
      if (segmentBlocked(guard.x, guard.y, hero.x, hero.y)) continue;
      if (range < nearest) { seen = hero; nearest = range; }
    }
    return seen;
  }

  function fireAtHero(guard, hero) {
    guard.fireCooldown = guard.weaponData.cooldown + .7;
    state.noise.push({ x: guard.x, y: guard.y, ttl: 2.5, max: 2.5, kind: "enemyShot" });
    state.flashes.push({ x: hero.x, y: hero.y, ttl: .55, max: .55, kind: "enemyShot", from: { x: guard.x, y: guard.y } });
    if (hero.cover && Math.random() < .68) {
      setMessage("A round chews through cover. Keep moving.", 1.8);
      return;
    }
    hero.health = Math.max(0, hero.health - guard.damage);
    hero.hitFlash = .72;
    state.alarm = clamp(state.alarm + 3, 0, 100);
    if (hero.health === 0) {
      hero.down = true;
      hero.path = [];
      hero.queue = [];
      setMessage(`${hero.name.split(" ")[0]} is down!`, 3.2);
      if (heroes.every((member) => member.down)) {
        state.lossReason = "LAST HAND DOWN";
        finish(false);
      } else if (state.focus === heroes.indexOf(hero)) chooseNextStanding(state.focus);
    } else setMessage(`${hero.name.split(" ")[0]} takes a hit — use cover.`, 2.1);
  }

  function updateGuard(guard, dt) {
    if (guard.down) return;
    guard.fireCooldown = Math.max(0, guard.fireCooldown - dt);
    const noise = state.noise.find((event) => event.ttl > 0 && distance(guard, event) < (event.radius || 285));
    if (noise && guard.mode !== "alert") {
      guard.hidden = false;
      guard.mode = "investigate";
      guard.investigate = { x: noise.x, y: noise.y, ttl: noise.ttl + 1 };
    }
    const seen = seenHeroBy(guard);
    if (seen) {
      guard.hidden = false;
      guard.lastSeen = { x: seen.x, y: seen.y };
      const noticeRate = seen.stance === "crouch" ? .36 : seen.cover ? .52 : .78;
      guard.suspicion = clamp(guard.suspicion + dt * noticeRate, 0, 1);
      if (guard.suspicion >= .72) {
        guard.mode = "alert";
        state.alarm = clamp(state.alarm + dt * (4 + guard.suspicion * 4), 0, 100);
        if (state.lastAlert < .2) setMessage("ARMED WATCH HAS A LOCK — use cover or break line of sight!", 3.4);
        state.lastAlert = 1;
        if (distance(guard, seen) <= guard.weaponData.range && !segmentBlocked(guard.x, guard.y, seen.x, seen.y) && guard.fireCooldown <= 0) fireAtHero(guard, seen);
      } else {
        guard.mode = "suspicious";
        if (guard.suspicion > .24 && state.lastAlert < .2) {
          setMessage("A patrol is suspicious — crouch, hide, or move behind cover before it raises the alarm.", 3.2);
          state.lastAlert = .7;
        }
      }
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - dt * .5);
      if (guard.mode === "suspicious" && guard.suspicion < .08) {
        guard.mode = "investigate";
        guard.investigate = guard.lastSeen ? { ...guard.lastSeen, ttl: 2.8 } : null;
      }
    }

    let destination = null;
    if (guard.mode === "alert" && guard.lastSeen) {
      const standoff = guard.standoffRange;
      const rangeToLastSeen = distance(guard, guard.lastSeen);
      if (rangeToLastSeen > standoff) destination = guard.lastSeen;
      else {
        guard.face = angleBetween(guard.x, guard.y, guard.lastSeen.x, guard.lastSeen.y);
        guard.facing = guard.face;
        guard.route = [];
      }
      if (!seen && rangeToLastSeen < standoff * .82 && guard.suspicion < .16) {
        guard.mode = "investigate";
        guard.investigate = { ...guard.lastSeen, ttl: 3.2 };
      }
    } else if (guard.mode === "suspicious" && guard.lastSeen) {
      const cautiousDistance = Math.max(42, guard.standoffRange * .7);
      if (distance(guard, guard.lastSeen) > cautiousDistance) destination = guard.lastSeen;
      else guard.face = angleBetween(guard.x, guard.y, guard.lastSeen.x, guard.lastSeen.y);
    } else if (guard.mode === "investigate" && guard.investigate) {
      guard.investigate.ttl -= dt;
      destination = guard.investigate;
      if (distance(guard, destination) < 8 || guard.investigate.ttl <= 0) { guard.mode = "patrol"; guard.investigate = null; }
    }
    if (guard.mode === "patrol") {
      destination = { x: guard.patrol[guard.patrolIndex][0], y: guard.patrol[guard.patrolIndex][1] };
      if (distance(guard, destination) < 5) {
        guard.patrolIndex = (guard.patrolIndex + 1) % guard.patrol.length;
        destination = { x: guard.patrol[guard.patrolIndex][0], y: guard.patrol[guard.patrolIndex][1] };
      }
    }
    guard.moving = false;
    guard.moveMode = guard.mode === "alert" ? "run" : "walk";
    if (destination) {
      const speed = guard.mode === "alert" ? guard.speed * 1.08 : guard.mode === "suspicious" ? guard.speed * .72 : guard.speed;
      followGuardRoute(guard, destination, speed, dt);
      if (guard.stuckTime > .55 && !guard.blockedByActor && guard.routeGoal) {
        guard.route = findPath(guard.x, guard.y, guard.routeGoal.x, guard.routeGoal.y);
        guard.stuckTime = 0;
      }
    }
    guard.hidden = guard.mode === "patrol" && hideZones.some((zone) => distanceXY(guard.x, guard.y, zone.x, zone.y) < zone.r * .66);
    updateActorPose(guard, dt);
  }

  function callReinforcements() {
    if (state.reinforcementsCalled || telegraph.disabled) return;
    state.reinforcementsCalled = true;
    const extras = [
      { id: "g-r1", name: "Call-out Rifle", x: 1640, y: 178, face: Math.PI, weapon: "rifle", patrol: [[1640,178],[1590,240],[1652,280],[1662,310]] },
      { id: "g-r2", name: "Call-out Shotgun", x: 1660, y: 238, face: Math.PI, weapon: "shotgun", patrol: [[1660,238],[1615,310],[1650,324],[1600,300]] }
    ];
    guards.push(...extras.map(cloneGuard));
    state.flashes.push({ x: 1627, y: 245, ttl: 1.2, max: 1.2, kind: "callout" });
    setMessage("The signal relay carries the alarm — two armed reinforcements enter the yard!", 5);
  }

  function updateObjectives(dt) {
    const objective = activeMissionObjective();
    if (state.interaction && objective) {
      const hero = heroes.find((candidate) => candidate.id === state.interaction.heroId);
      const inRange = hero && !hero.down && distanceXY(hero.x, hero.y, objective.point.x, objective.point.y) <= objective.range + 5;
      if (!inRange || hero.moving) {
        clearInteraction();
        setMessage("The job was interrupted — get back in position and press E.", 2.5);
      } else {
        state.interaction.progress += dt;
        if (state.interaction.progress >= state.interaction.duration) completeInteraction(hero, state.interaction.type);
      }
    }
    if (state.stage === 2) {
      const survivors = heroes.filter((hero) => !hero.down);
      if (survivors.length && survivors.every((hero) => pointInRect(hero.x, hero.y, exitZone))) finish(true);
    }
  }

  function setCameraTo(x, y, immediate = false) {
    const target = {
      x: clamp(x - VIEW.w / 2, 0, WORLD.right - VIEW.right),
      y: clamp(y - (VIEW.top + VIEW.bottom) / 2, 0, WORLD.bottom - VIEW.bottom)
    };
    if (immediate) { state.camera.x = target.x; state.camera.y = target.y; state.cameraTarget = null; }
    else state.cameraTarget = target;
  }

  function panCamera(dx, dy) {
    state.followSelected = false;
    state.cameraTarget = null;
    state.camera.x = clamp(state.camera.x + dx, 0, WORLD.right - VIEW.right);
    state.camera.y = clamp(state.camera.y + dy, 0, WORLD.bottom - VIEW.bottom);
  }

  function updateCamera(dt) {
    const squad = selectedHeroes();
    if (state.followSelected && squad.length) {
      const center = squadCenter(squad);
      setCameraTo(center.x, center.y);
      if (squad.every((hero) => !hero.path.length && !hero.queue.length)) state.followSelected = false;
    }
    if (!state.cameraTarget) return;
    const amount = Math.min(1, dt * 5.4);
    state.camera.x += (state.cameraTarget.x - state.camera.x) * amount;
    state.camera.y += (state.cameraTarget.y - state.camera.y) * amount;
    if (Math.abs(state.cameraTarget.x - state.camera.x) < .5 && Math.abs(state.cameraTarget.y - state.camera.y) < .5) {
      state.camera.x = state.cameraTarget.x;
      state.camera.y = state.cameraTarget.y;
      state.cameraTarget = null;
    }
  }

  function update(dt) {
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (!state.started || state.won || state.lost || state.paused) return;
    state.elapsed += dt;
    state.lastAlert = Math.max(0, state.lastAlert - dt);
    state.alarm = Math.max(0, state.alarm - dt * .16);
    state.noise.forEach((event) => { event.ttl -= dt; });
    state.noise = state.noise.filter((event) => event.ttl > 0);
    state.flashes.forEach((flash) => { flash.ttl -= dt; });
    state.flashes = state.flashes.filter((flash) => flash.ttl > 0);
    heroes.forEach((hero) => updateHero(hero, dt));
    guards.forEach((guard) => updateGuard(guard, dt));
    if (state.alarm >= 58 && !telegraph.disabled) callReinforcements();
    updateObjectives(dt);
    updateCamera(dt);
    if (state.alarm >= 100) { state.lossReason = "YARD LOCKDOWN"; finish(false); }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.left, VIEW.top, VIEW.w, VIEW.h);
    ctx.clip();
    ctx.translate(-state.camera.x, -state.camera.y);
    drawTerrain();
    drawExitZone();
    drawSightCones();
    drawCoverPatches();
    drawObjectives();
    drawNoise();
    drawPlans();
    drawActors();
    drawFlashes();
    ctx.restore();
    drawMapFrame();
    drawTopHud();
    drawMiniMap();
    drawPointer();
  }

  function drawTerrain() {
    ctx.fillStyle = P.ground;
    ctx.fillRect(WORLD.left, WORLD.top, WORLD.w, WORLD.h);
    if (terrainBackdrop && terrainBackdrop.complete && terrainBackdrop.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(terrainBackdrop, WORLD.left, WORLD.top, WORLD.w, WORLD.h);
      ctx.fillStyle = "rgba(20, 25, 17, .06)";
      ctx.fillRect(WORLD.left, WORLD.top, WORLD.w, WORLD.h);
      ctx.restore();
      return;
    }
    ctx.fillStyle = "rgba(226, 196, 113, .10)";
    ctx.fillRect(WORLD.left, WORLD.top, WORLD.w, 185);
    for (const bit of terrainBits) {
      ctx.fillStyle = bit.tone === 0 ? "rgba(30,38,25,.27)" : bit.tone === 1 ? "rgba(218,193,112,.17)" : bit.tone === 2 ? "rgba(234,221,151,.10)" : "rgba(75,62,38,.16)";
      ctx.fillRect(bit.x, bit.y, bit.r, bit.r);
    }
    ctx.save();
    ctx.globalAlpha = .18;
    ctx.strokeStyle = "#4c5638";
    ctx.lineWidth = 3;
    for (let row = 0; row < 11; row += 1) {
      const y = WORLD.top + 78 + row * 82;
      ctx.beginPath();
      ctx.moveTo(WORLD.left + 20 + (row % 2) * 24, y);
      ctx.lineTo(WORLD.right - 30, y - 28);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(28,34,22,.24)";
    ctx.fillRect(WORLD.left, WORLD.bottom - 8, WORLD.w, 8);
  }

  function drawRoadsAndRails() {
    drawRoad([[35, 435], [207, 439], [435, 367], [637, 367], [923, 454], [1121, 479], [1342, 457], [1643, 542]], 54);
    drawRoad([[1061, 512], [1061, 879]], 37);
    drawRoad([[1083, 767], [1435, 767]], 38);
    drawRailPair(414, 133, 1630, 133);
    drawRailPair(414, 816, 1630, 816);
    drawRailPair(1070, 761, 1522, 761);
  }

  function drawRoad(points, width) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(47, 45, 30, .36)";
    ctx.lineWidth = width + 8;
    ctx.beginPath(); ctx.moveTo(points[0][0] + 5, points[0][1] + 8);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x + 5, y + 8);
    ctx.stroke();
    ctx.strokeStyle = "#897a4e";
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(228, 208, 137, .26)";
    ctx.lineWidth = Math.max(2, width - 15);
    ctx.beginPath(); ctx.moveTo(points[0][0] - 1, points[0][1] - 2);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x - 1, y - 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(69, 60, 37, .46)";
    ctx.lineWidth = 2;
    for (let segment = 1; segment < points.length; segment += 1) {
      const [ax, ay] = points[segment - 1]; const [bx, by] = points[segment];
      const distance = Math.hypot(bx - ax, by - ay);
      const steps = Math.floor(distance / 17);
      for (let step = 0; step < steps; step += 1) {
        const t = (step + .3) / steps;
        const x = ax + (bx - ax) * t; const y = ay + (by - ay) * t;
        ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.lineTo(x + 3, y - 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawRailPair(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
    ctx.save();
    ctx.strokeStyle = "rgba(36, 31, 23, .58)";
    ctx.lineWidth = 4;
    for (const offset of [-8, 8]) {
      ctx.beginPath(); ctx.moveTo(x1 + nx * offset + 2, y1 + ny * offset + 3); ctx.lineTo(x2 + nx * offset + 2, y2 + ny * offset + 3); ctx.stroke();
    }
    ctx.strokeStyle = "#514b3d";
    ctx.lineWidth = 3;
    for (const offset of [-8, 8]) {
      ctx.beginPath(); ctx.moveTo(x1 + nx * offset, y1 + ny * offset); ctx.lineTo(x2 + nx * offset, y2 + ny * offset); ctx.stroke();
    }
    ctx.strokeStyle = "#aa9565";
    ctx.lineWidth = 1;
    for (const offset of [-8, 8]) {
      ctx.beginPath(); ctx.moveTo(x1 + nx * offset - 1, y1 + ny * offset - 1); ctx.lineTo(x2 + nx * offset - 1, y2 + ny * offset - 1); ctx.stroke();
    }
    ctx.strokeStyle = "#403227";
    ctx.lineWidth = 4;
    for (let distance = 0; distance < length; distance += 16) {
      const px = x1 + dx * distance / length, py = y1 + dy * distance / length;
      ctx.beginPath(); ctx.moveTo(px - nx * 13, py - ny * 13); ctx.lineTo(px + nx * 13, py + ny * 13); ctx.stroke();
    }
    ctx.restore();
  }

  function drawExitZone() {
    ctx.save();
    const active = state.stage === 2;
    ctx.fillStyle = active ? "rgba(129,185,103,.25)" : "rgba(194,148,70,.16)";
    ctx.fillRect(exitZone.x, exitZone.y, exitZone.w, exitZone.h);
    ctx.strokeStyle = active ? "#a6d47c" : "#d8a652";
    ctx.lineWidth = 2; ctx.setLineDash([5,4]);
    ctx.strokeRect(exitZone.x + 1, exitZone.y + 1, exitZone.w - 2, exitZone.h - 2);
    ctx.setLineDash([]); ctx.fillStyle = active ? "#d8f19d" : "#e8bc61";
    ctx.font = "bold 8px monospace"; ctx.fillText(active ? "EXIT OPEN" : exitZone.label, exitZone.x + 12, exitZone.y + 15);
    ctx.restore();
  }

  function drawSightCones() {
    for (const guard of guards) {
      if (guard.down) continue;
      const alarmed = guard.mode === "alert";
      const vision = guard.hidden && !alarmed ? Math.min(94, guard.vision) : guard.vision;
      ctx.save();
      ctx.globalAlpha = alarmed ? .2 : guard.hidden ? .05 : .115;
      ctx.fillStyle = alarmed ? "#ed6844" : "#e8bd57";
      ctx.beginPath(); ctx.moveTo(guard.x, guard.y);
      ctx.arc(guard.x, guard.y, vision, guard.face - guard.fov / 2, guard.face + guard.fov / 2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = alarmed ? .72 : guard.hidden ? .17 : .36;
      ctx.strokeStyle = alarmed ? "#e76b48" : "#eec55e"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y); ctx.lineTo(guard.x + Math.cos(guard.face - guard.fov / 2) * vision, guard.y + Math.sin(guard.face - guard.fov / 2) * vision);
      ctx.moveTo(guard.x, guard.y); ctx.lineTo(guard.x + Math.cos(guard.face + guard.fov / 2) * vision, guard.y + Math.sin(guard.face + guard.fov / 2) * vision);
      ctx.stroke(); ctx.restore();
    }
  }

  function drawBuildings() {
    for (const obstacle of obstacles) obstacle.kind === "railcar" ? drawRailcar(obstacle) : drawBuilding(obstacle);
  }

  function drawBuilding(building) {
    const { x, y, w, h, kind, label } = building;
    const roofRise = Math.max(17, Math.min(29, Math.round(h * .27)));
    const roofColor = kind === "armory" ? "#4b4639" : kind === "stable" ? "#4c3427" : "#4f3a2c";
    const wallColor = kind === "office" ? "#9c8c66" : kind === "signal" ? "#81734f" : P.wall;
    ctx.save();
    ctx.fillStyle = "rgba(28, 31, 22, .52)";
    ctx.beginPath(); ctx.moveTo(x + 14, y + h + 8); ctx.lineTo(x + w + 17, y + h + 8); ctx.lineTo(x + w + 43, y + h + 31); ctx.lineTo(x + 34, y + h + 31); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#3d392c"; ctx.fillRect(x + 4, y + roofRise + 9, w, h - roofRise - 2);
    ctx.fillStyle = wallColor; ctx.fillRect(x, y + roofRise, w, h - roofRise);
    ctx.fillStyle = "rgba(233, 214, 149, .22)"; ctx.fillRect(x + 3, y + roofRise + 5, w - 7, 4);
    ctx.fillStyle = "#5b4d37";
    ctx.beginPath(); ctx.moveTo(x + w, y + roofRise); ctx.lineTo(x + w + 14, y + roofRise - 7); ctx.lineTo(x + w + 14, y + h - 3); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = roofColor;
    ctx.beginPath(); ctx.moveTo(x - 8, y + roofRise); ctx.lineTo(x + roofRise, y - 8); ctx.lineTo(x + w + roofRise, y - 8); ctx.lineTo(x + w - 5, y + roofRise); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(218, 189, 119, .34)"; ctx.lineWidth = 1;
    for (let stripe = x - 5; stripe < x + w; stripe += 11) {
      ctx.beginPath(); ctx.moveTo(stripe, y + roofRise - 2); ctx.lineTo(stripe + roofRise, y - 6); ctx.stroke();
    }
    ctx.fillStyle = "#2b2921"; ctx.fillRect(x - 7, y + roofRise - 3, w + 3, 4);
    ctx.fillStyle = "#4b3728"; ctx.fillRect(x + w * .43, y + h - 29, 23, 29);
    ctx.fillStyle = "#1d211b"; ctx.fillRect(x + w * .43 + 3, y + h - 25, 17, 25);
    ctx.fillStyle = "#d1bd7a";
    if (kind !== "shed") {
      const windowY = Math.min(y + h - 43, y + roofRise + 17);
      ctx.fillRect(x + 15, windowY, 16, 14); ctx.fillRect(x + w - 31, windowY, 16, 14);
      ctx.fillStyle = "#273239"; ctx.fillRect(x + 18, windowY + 3, 10, 8); ctx.fillRect(x + w - 28, windowY + 3, 10, 8);
    }
    if (["depot","office","armory"].includes(kind)) {
      ctx.fillStyle = "#c7b579"; ctx.fillRect(x + 44, y + roofRise + 12, Math.max(30, w - 88), 14);
      ctx.fillStyle = "#4a4030"; ctx.fillRect(x + 47, y + roofRise + 15, Math.max(24, w - 94), 8);
    }
    if (kind === "depot") { ctx.fillStyle = "#604a34"; ctx.fillRect(x + 18, y + h, w - 36, 13); ctx.fillStyle = "#b89b60"; ctx.fillRect(x + 18, y + h + 10, w - 36, 3); }
    if (kind === "stable") { ctx.fillStyle = "#302a21"; ctx.fillRect(x + 32, y + h - 35, 43, 35); ctx.fillRect(x + w - 75, y + h - 35, 43, 35); }
    if (kind === "signal") {
      ctx.strokeStyle = "#483a29"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w - 23, y + roofRise); ctx.lineTo(x + w - 18, y - 38); ctx.lineTo(x + w - 10, y + roofRise); ctx.stroke();
      ctx.fillStyle = "#d5b76b"; ctx.fillRect(x + w - 24, y - 40, 12, 4);
    }
    ctx.globalAlpha = .78; ctx.fillStyle = "#dfca8b"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"; ctx.fillText(label.toUpperCase(), x + w / 2 + roofRise / 2, y + roofRise + 14); ctx.textAlign = "left";
    ctx.restore();
  }

  function drawRailcar(car) {
    const { x, y, w, h } = car;
    const roofRise = 12;
    ctx.save();
    ctx.fillStyle = "rgba(27, 28, 21, .58)"; ctx.beginPath();ctx.moveTo(x+8,y+h+7);ctx.lineTo(x+w+12,y+h+7);ctx.lineTo(x+w+28,y+h+20);ctx.lineTo(x+23,y+h+20);ctx.closePath();ctx.fill();
    ctx.fillStyle = "#43392d"; ctx.fillRect(x, y + roofRise, w, h - roofRise);
    ctx.fillStyle = "#6a4d35"; ctx.fillRect(x + 4, y + roofRise + 6, w - 8, 5);
    ctx.fillStyle = "#3d3529"; ctx.beginPath();ctx.moveTo(x-5,y+roofRise);ctx.lineTo(x+roofRise,y-4);ctx.lineTo(x+w+roofRise,y-4);ctx.lineTo(x+w-4,y+roofRise);ctx.closePath();ctx.fill();
    ctx.strokeStyle = "rgba(220, 193, 123, .28)"; ctx.lineWidth = 1; for (let stripe=x-3;stripe<x+w;stripe+=13){ctx.beginPath();ctx.moveTo(stripe,y+roofRise-1);ctx.lineTo(stripe+roofRise,y-2);ctx.stroke();}
    ctx.fillStyle = "#22231d";
    for (let door = x + 19; door < x + w - 14; door += 79) { ctx.fillRect(door, y + 25, 50, Math.max(20, h - 25)); ctx.fillStyle = "#88704b"; ctx.fillRect(door + 4, y + 29, 42, 2); ctx.fillStyle = "#22231d"; }
    ctx.fillStyle = "#171713"; for (const wheelX of [x + 50, x + w - 57]) { ctx.fillRect(wheelX, y + h - 2, 14, 6); ctx.fillRect(wheelX + 3, y + h + 3, 8, 3); }
    ctx.fillStyle = "#d1bc7a"; ctx.font = "bold 7px monospace"; ctx.fillText("SANTA LUZ RAIL", x + Math.max(20, w / 2 - 45), y + Math.min(42, h - 12));
    ctx.restore();
  }

  function drawProps() {
    drawFence(46,151,110,false); drawFence(867,303,90,true); drawFence(620,273,37,true); drawFence(1182,281,110,false); drawFence(1551,401,120,true); drawFence(1018,600,95,false); drawFence(1302,694,170,false);
    drawWaterTrough(120,296); drawWaterTrough(888,558); drawHay(359,320); drawHay(389,344); drawHay(583,286); drawHay(899,410); drawHay(1163,350); drawHay(1565,740);
    for (const [x,y] of [[739,279],[773,281],[803,286],[1106,321],[1132,321],[1460,350],[1485,350],[1210,664],[1240,668],[1280,795]]) drawCrate(x,y);
    for (const [x,y] of [[626,326],[617,338],[872,280],[1005,541],[1017,546],[1574,706],[1586,714],[805,667]]) drawBarrel(x,y);
    for (const [x,y,s] of [[84,337,1],[906,118,.85],[903,439,.9],[399,92,.72],[956,690,.85],[1190,860,.9],[1612,530,1],[1515,865,.8]]) drawCactus(x,y,s);
    for (const [x,y] of [[626,277],[862,288],[423,196],[952,373],[1208,310],[1449,440],[1325,676],[1580,641]]) drawLamp(x,y);
    for (const zone of hideZones) drawShrub(zone.x, zone.y, zone.r, zone.label);
  }

  function drawFence(x, y, length, vertical) {
    ctx.save(); ctx.strokeStyle = "rgba(31,29,21,.52)"; ctx.lineWidth = 4; ctx.beginPath();
    if (vertical) { ctx.moveTo(x+3,y+4); ctx.lineTo(x+3,y+length+4); ctx.moveTo(x+11,y+4); ctx.lineTo(x+11,y+length+4); for (let p=y;p<=y+length;p+=20) { ctx.moveTo(x,p+4); ctx.lineTo(x+15,p+4); } }
    else { ctx.moveTo(x+3,y+4); ctx.lineTo(x+length+3,y+4); ctx.moveTo(x+3,y+12); ctx.lineTo(x+length+3,y+12); for (let p=x;p<=x+length;p+=20) { ctx.moveTo(p+3,y+1); ctx.lineTo(p+3,y+15); } }
    ctx.stroke(); ctx.restore();
    ctx.save(); ctx.strokeStyle = "#5b4931"; ctx.lineWidth = 2; ctx.beginPath();
    if (vertical) { ctx.moveTo(x,y); ctx.lineTo(x,y+length); ctx.moveTo(x+8,y); ctx.lineTo(x+8,y+length); for (let p=y;p<=y+length;p+=20) { ctx.moveTo(x-3,p); ctx.lineTo(x+12,p); } }
    else { ctx.moveTo(x,y); ctx.lineTo(x+length,y); ctx.moveTo(x,y+8); ctx.lineTo(x+length,y+8); for (let p=x;p<=x+length;p+=20) { ctx.moveTo(p,y-3); ctx.lineTo(p,y+12); } }
    ctx.stroke(); ctx.restore();
  }

  function drawWaterTrough(x, y) {
    ctx.save(); ctx.fillStyle="rgba(28,29,21,.42)";ctx.beginPath();ctx.ellipse(x+31,y+18,31,9,0,0,TAU);ctx.fill();
    ctx.fillStyle="#514432";ctx.beginPath();ctx.moveTo(x,y+6);ctx.lineTo(x+48,y+6);ctx.lineTo(x+55,y+14);ctx.lineTo(x+7,y+14);ctx.closePath();ctx.fill();
    ctx.fillStyle="#9c7b4e";ctx.fillRect(x+4,y+13,48,10);ctx.fillStyle="#273f42";ctx.fillRect(x+7,y+10,43,6);ctx.fillStyle="rgba(164,204,194,.45)";ctx.fillRect(x+10,y+11,18,1);ctx.restore();
  }
  function drawHay(x, y) {
    ctx.save();ctx.fillStyle="rgba(34,31,20,.38)";ctx.beginPath();ctx.ellipse(x+18,y+20,19,8,0,0,TAU);ctx.fill();
    ctx.fillStyle="#aa873e";ctx.beginPath();ctx.ellipse(x+15,y+14,15,10,0,0,TAU);ctx.fill();ctx.fillStyle="#d2b45b";ctx.beginPath();ctx.ellipse(x+14,y+9,13,7,0,0,TAU);ctx.fill();
    ctx.strokeStyle="#745a31";ctx.lineWidth=1;for(let s=x+3;s<x+28;s+=5){ctx.beginPath();ctx.moveTo(s,y+9);ctx.lineTo(s+5,y+20);ctx.stroke();}ctx.restore();
  }
  function drawCrate(x, y) {
    ctx.save();ctx.fillStyle="rgba(29,28,20,.42)";ctx.beginPath();ctx.ellipse(x+12,y+18,13,5,0,0,TAU);ctx.fill();
    ctx.fillStyle="#725239";ctx.fillRect(x,y+5,17,13);ctx.fillStyle="#493b2c";ctx.beginPath();ctx.moveTo(x+17,y+5);ctx.lineTo(x+22,y+1);ctx.lineTo(x+22,y+14);ctx.lineTo(x+17,y+18);ctx.closePath();ctx.fill();
    ctx.fillStyle="#98734a";ctx.beginPath();ctx.moveTo(x,y+5);ctx.lineTo(x+5,y+1);ctx.lineTo(x+22,y+1);ctx.lineTo(x+17,y+5);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#b99564";ctx.lineWidth=1;ctx.strokeRect(x+2,y+7,12,9);ctx.beginPath();ctx.moveTo(x+2,y+7);ctx.lineTo(x+14,y+16);ctx.moveTo(x+14,y+7);ctx.lineTo(x+2,y+16);ctx.stroke();ctx.restore();
  }
  function drawBarrel(x, y) {
    ctx.save();ctx.fillStyle="rgba(29,28,20,.42)";ctx.beginPath();ctx.ellipse(x+9,y+17,10,4,0,0,TAU);ctx.fill();
    ctx.fillStyle="#6a4a34";ctx.fillRect(x+1,y+4,13,13);ctx.fillStyle="#967049";ctx.beginPath();ctx.ellipse(x+7.5,y+4,6.5,3,0,0,TAU);ctx.fill();
    ctx.fillStyle="#c09a58";ctx.fillRect(x+1,y+7,13,2);ctx.fillRect(x+1,y+14,13,2);ctx.restore();
  }
  function drawCactus(x, y, scale) {
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle="rgba(30,29,20,.42)";ctx.beginPath();ctx.ellipse(8,20,11,5,0,0,TAU);ctx.fill();
    ctx.fillStyle="#3e5839";ctx.fillRect(2,0,8,24);ctx.fillRect(-4,8,6,10);ctx.fillRect(-6,8,3,5);ctx.fillRect(9,11,6,9);ctx.fillRect(14,8,3,5);ctx.fillStyle="#77925a";ctx.fillRect(4,2,2,19);ctx.fillRect(-2,10,1,7);ctx.fillRect(11,13,1,6);ctx.restore();
  }
  function drawLamp(x, y) {
    ctx.save();ctx.fillStyle="rgba(228,190,102,.08)";ctx.beginPath();ctx.arc(x,y-16,29,0,TAU);ctx.fill();ctx.fillStyle="rgba(27,27,20,.42)";ctx.fillRect(x+2,y-1,5,24);
    ctx.fillStyle="#4e4030";ctx.fillRect(x-2,y-3,4,24);ctx.fillStyle="#e5c467";ctx.fillRect(x-4,y-21,8,7);ctx.fillStyle="#594936";ctx.fillRect(x-6,y-24,12,3);ctx.fillStyle="#b58b43";ctx.fillRect(x-2,y-19,4,3);ctx.restore();
  }
  function drawShrub(x, y, radius, kind) {
    const base = kind==="hay"?"#a4853e":kind==="shade"?"#4d4233":"#3f5738";
    const light = kind==="hay"?"#d0b45c":kind==="shade"?"#716249":"#718752";
    ctx.save();ctx.fillStyle="rgba(28,29,20,.4)";ctx.beginPath();ctx.ellipse(x+4,y+7,radius,radius*.55,0,0,TAU);ctx.fill();
    ctx.fillStyle=base;ctx.beginPath();ctx.ellipse(x-radius*.23,y+2,radius*.61,radius*.47,0,0,TAU);ctx.ellipse(x+radius*.27,y,radius*.66,radius*.5,0,0,TAU);ctx.ellipse(x,y-radius*.25,radius*.6,radius*.49,0,0,TAU);ctx.fill();
    ctx.fillStyle=light;ctx.beginPath();ctx.ellipse(x-radius*.18,y-radius*.3,radius*.33,radius*.22,0,0,TAU);ctx.ellipse(x+radius*.25,y-radius*.08,radius*.32,radius*.2,0,0,TAU);ctx.fill();ctx.restore();
  }

  function drawCoverPatches() {
    const pointerWorld = state.pointer;
    const allZones = [...hideZones.map((zone) => ({ ...zone, type: "hide" })), ...coverZones.map((zone) => ({ ...zone, type: "cover" }))];
    for (const zone of allZones) {
      const occupied = [...heroes, ...guards].some((actor) => !actor.down && distanceXY(actor.x, actor.y, zone.x, zone.y) < zone.r * .7);
      const hovered = pointerWorld.x > 0 && distanceXY(pointerWorld.x, pointerWorld.y, zone.x, zone.y) < zone.r;
      if (!state.paused && !occupied && !hovered) continue;
      ctx.save();
      ctx.globalAlpha = zone.type === "hide" ? .14 : .1;
      ctx.fillStyle = zone.type === "hide" ? "#91b870" : "#e2ba65";
      ctx.beginPath(); ctx.ellipse(zone.x, zone.y + 3, zone.r, zone.r * .58, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = .74;
      ctx.strokeStyle = zone.type === "hide" ? "#bde28c" : "#ebc873";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(zone.x, zone.y + 3, zone.r * .72, zone.r * .42, 0, 0, TAU); ctx.stroke();
      if (hovered || occupied) {
        ctx.fillStyle = zone.type === "hide" ? "#d5efa4" : "#f0d58b";
        ctx.font = "bold 7px monospace";
        ctx.textAlign = "center";
        ctx.fillText(zone.type === "hide" ? "BRUSH / HIDE" : "HARD COVER", zone.x, zone.y - zone.r * .67);
        ctx.textAlign = "left";
      }
      ctx.restore();
    }
  }

  function drawObjectives() {
    const pulse = Math.sin(performance.now() * .006) * .5 + .5;
    const objective = activeMissionObjective();
    const drawMarker = (point, label, complete, glyph) => {
      const active = objective && objective.point === point;
      ctx.fillStyle = active ? `rgba(239,207,104,${.12 + pulse * .12})` : "rgba(120,184,116,.12)";
      ctx.beginPath(); ctx.arc(point.x, point.y, 20 + pulse * 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = active ? "#f4cf6c" : "#9fd17c"; ctx.lineWidth = 1;
      ctx.strokeRect(point.x - 7, point.y - 7, 14, 14);
      ctx.fillStyle = active ? "#f6d373" : "#cde998"; ctx.font = "bold 7px monospace";
      ctx.fillText(complete ? "DONE" : label, point.x - 29, point.y - 18);
      if (glyph === "ledger") { ctx.fillStyle = complete ? "#75a96c" : "#dbbd63"; ctx.fillRect(point.x - 5, point.y - 5, 10, 11); }
    };
    ctx.save();
    drawMarker(telegraph, "SIGNAL", telegraph.disabled, "signal");
    if (state.stage >= 1 || ledger.taken) drawMarker(ledger, "LEDGER", ledger.taken, "ledger");
    if (objective && selectedHeroes().some((hero) => distanceXY(hero.x, hero.y, objective.point.x, objective.point.y) <= objective.range)) {
      ctx.fillStyle = "#f6d373"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center";
      ctx.fillText(state.interaction ? "WORKING..." : "PRESS E", objective.point.x, objective.point.y + 29);
      ctx.textAlign = "left";
    }
    if (state.interaction && objective) {
      const amount = clamp(state.interaction.progress / state.interaction.duration, 0, 1);
      ctx.strokeStyle = "#f5d276"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(objective.point.x, objective.point.y, 16, -Math.PI / 2, -Math.PI / 2 + TAU * amount); ctx.stroke();
    }
    ctx.restore();
  }

  function drawNoise() {
    for (const event of state.noise) {
      const progress = 1 - event.ttl / event.max;
      const running = event.kind === "run";
      ctx.save(); ctx.globalAlpha = event.kind === "shot" || event.kind === "enemyShot" ? .73 : running ? .28 : .56; ctx.strokeStyle = event.kind === "shot" ? "#ec6742" : event.kind === "enemyShot" ? "#f0744f" : running ? "#d9bd71" : "#f2cf6e"; ctx.lineWidth = event.kind === "shot" || event.kind === "enemyShot" ? 2 : 1;
      for (let ring = 0; ring < (running ? 2 : 3); ring += 1) { const radius = 8 + progress * (ring + 1) * (running ? 24 : event.kind === "coin" ? 34 : 58); ctx.beginPath();ctx.arc(event.x,event.y,radius,0,TAU);ctx.stroke(); }
      ctx.restore();
    }
  }

  function drawPlans() {
    for (const hero of heroes) {
      if (hero.down) continue;
      const selected = isHeroSelected(heroes.indexOf(hero));
      if (hero.path.length) drawPath(hero, hero.path, hero.moveMode === "run" ? "#e27849" : selected ? "#f3cf70" : "#bd9c63", false);
      if (state.paused && hero.queue.length) {
        let origin = { x: hero.x, y: hero.y };
        for (const command of hero.queue) {
          if (command.type === "move") { drawPath(origin, command.path, command.run ? "#e27849" : selected ? "#efb052" : "#b07444", true); origin = command.end; }
          else drawQueuedAbility(origin, command, selected);
        }
      }
    }
  }

  function drawPath(origin, path, color, dashed) { if (!path.length) return;ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=.8;ctx.lineWidth=1.4;if(dashed)ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(origin.x,origin.y);for(const point of path)ctx.lineTo(point.x,point.y);ctx.stroke();ctx.setLineDash([]);const end=path[path.length-1];ctx.fillStyle=color;ctx.fillRect(end.x-2,end.y-2,5,5);ctx.restore(); }
  function drawQueuedAbility(origin, command, selected) { ctx.save();ctx.strokeStyle=selected?"#efb052":"#b07444";ctx.globalAlpha=.8;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(command.x,command.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=command.type==="shot"||command.type==="fire"?"#e86b45":"#f1cc63";ctx.fillRect(command.x-3,command.y-3,7,7);ctx.restore(); }

  function drawActors() {
    const actors = [...guards.map((guard) => ({ ...guard, actorType: "guard" })), ...heroes.map((hero,index) => ({ ...hero, actorType: "hero", heroIndex:index }))].sort((a,b)=>a.y-b.y);
    for (const actor of actors) actor.actorType === "guard" ? drawGuard(actor) : drawHero(actor, actor.heroIndex);
  }

  function drawHero(hero, index) {
    const selected = isHeroSelected(index);
    const focused = index === state.focus;
    const x = Math.round(hero.x), y = Math.round(hero.y);
    ctx.save();
    if (hero.down) {
      drawDownFigure(hero, false);
      ctx.restore();
      return;
    }
    drawTacticalFigure(hero, { guard: false, selected, focused, index });
    if (hero.hitFlash > 0) { ctx.globalAlpha=hero.hitFlash*1.3;ctx.strokeStyle="#f16a4a";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,16,0,TAU);ctx.stroke(); }
    if (selected || hero.hidden || hero.cover || hero.stance === "crouch") {
      ctx.fillStyle=hero.hidden?"#b6d88b":hero.stance === "crouch"?"#a8c78b":hero.cover?"#e1c46b":"#f1cf79";
      ctx.font="bold 7px monospace";
      ctx.textAlign="center";
      ctx.fillText(hero.hidden?"HIDDEN":hero.stance === "crouch"?"LOW":hero.cover?"COVER":focused ? hero.name.split(" ")[0] : `HAND ${index + 1}`,x,y+24);
      ctx.textAlign="left";
    }
    ctx.restore();
  }

  function drawGuard(guard) {
    const x=Math.round(guard.x), y=Math.round(guard.y);
    ctx.save();
    if (guard.down) { drawDownFigure(guard, true); ctx.restore(); return; }
    drawTacticalFigure(guard, { guard: true, selected: false, focused: false, index: -1 });
    if (guard.mode === "alert" || guard.suspicion > .1) { ctx.fillStyle=guard.mode==="alert"?"#ee6744":"#e8c55f";ctx.font="bold 10px monospace";ctx.fillText(guard.mode==="alert"?"!":"?",x-3,y-18); }
    if (guard.mode === "alert") { ctx.fillStyle=guard.weaponData.color;ctx.font="bold 6px monospace";ctx.textAlign="center";ctx.fillText(guard.weaponData.glyph,x,y+21);ctx.textAlign="left"; }
    ctx.restore();
  }

  function drawDownFigure(actor, guard) {
    const x = Math.round(actor.x), y = Math.round(actor.y);
    ctx.fillStyle = "rgba(36,24,17,.54)";
    ctx.beginPath();
    ctx.ellipse(x, y + 7, 14, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y + 2);
    ctx.rotate(actor.facing || 0);
    ctx.fillStyle = guard ? "#56372c" : actor.coat;
    ctx.fillRect(-11, -4, 20, 7);
    ctx.fillStyle = guard ? "#8c3b30" : actor.color;
    ctx.beginPath();
    ctx.arc(-11, -1, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = guard ? "#d4b968" : "#e66d50";
    ctx.font = "bold 7px monospace";
    ctx.fillText(guard ? "OUT" : "DOWN", x + 7, y - 6);
  }

  function drawTacticalFigure(actor, { guard, selected, focused, index }) {
    const x = Math.round(actor.x), y = Math.round(actor.y);
    const walk = actor.walkBlend || 0;
    const run = actor.runBlend || 0;
    const crouch = actor.crouchBlend || 0;
    const stride = Math.sin(actor.motion) * walk * (1.6 + run * 1.7);
    const bob = Math.abs(Math.cos(actor.motion)) * walk * (1.1 + run * .7);
    const facing = actor.renderFacing ?? actor.facing ?? 0;
    const coat = guard ? "#514035" : actor.coat;
    const coatLight = guard ? "#76523c" : actor.color;
    const hat = guard ? "#352d28" : actor.color;
    const skin = guard ? "#c58a63" : actor.skin;
    const weapon = actor.weaponData || weapons.pistol;
    ctx.save();
    ctx.translate(x, y - bob + crouch * 3);
    ctx.fillStyle = "rgba(25,22,15,.48)";
    ctx.beginPath();
    ctx.ellipse(0, 8, 9 + walk * 1.6, 3.8, 0, 0, TAU);
    ctx.fill();
    if (selected) {
      const pulse = 1 + Math.sin(performance.now() * .007) * .12;
      ctx.strokeStyle = focused ? "#f4d27a" : "#d7b462";
      ctx.globalAlpha = actor.hidden ? .62 : .92;
      ctx.lineWidth = focused ? 1.5 : 1;
      ctx.beginPath();
      ctx.ellipse(0, 4, 13 * pulse, 6.5 * pulse, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f4d27a";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(index + 1), 0, -19);
      ctx.textAlign = "left";
    }
    if (actor.hidden) ctx.globalAlpha = .52;
    // Local up is the direction the actor faces. The independent leg and arm
    // arcs make turns and strides readable at tactical-map scale.
    ctx.rotate(facing + Math.PI / 2);
    ctx.scale(1, 1 - crouch * .26);
    const legSwing = stride;
    ctx.strokeStyle = "#1e1b17";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 2.9, 2);
      ctx.lineTo(side * 3.4 + legSwing * side * .62, 10 + Math.abs(legSwing * side) * .42);
      ctx.stroke();
    }
    const coatGradient = ctx.createLinearGradient(-7, -5, 7, 9);
    coatGradient.addColorStop(0, coatLight);
    coatGradient.addColorStop(.48, coat);
    coatGradient.addColorStop(1, "#26251d");
    ctx.fillStyle = coatGradient;
    ctx.beginPath();
    ctx.moveTo(-6.4, -4.5);
    ctx.lineTo(6.4, -4.5);
    ctx.lineTo(7.1, 6.5);
    ctx.lineTo(2.8, 9.4);
    ctx.lineTo(-3.1, 9.4);
    ctx.lineTo(-7.1, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(20,18,14,.76)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(228,202,151,.25)";
    ctx.fillRect(-4.5, -2.9, 2, 8.2);
    ctx.strokeStyle = guard ? "#2b2520" : "#3a3228";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-5.5, -1);
    ctx.lineTo(-7.5 - stride * .35, 4.8);
    ctx.moveTo(5.5, -1);
    ctx.lineTo(7.3 + stride * .35, 3.6);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -8.4, 4.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(74,47,35,.72)";
    ctx.fillRect(-2.8, -8.5, 5.6, 1.2);
    ctx.fillStyle = "#271f1a";
    ctx.beginPath();
    ctx.ellipse(0, -11.8, 8.4, 2.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hat;
    ctx.beginPath();
    ctx.ellipse(0, -12.1, 7.4, 1.7, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-3.8, -15.2, 7.6, 3.5);
    ctx.fillStyle = "rgba(236,213,161,.28)";
    ctx.fillRect(-2.7, -14.6, 1.2, 2.5);
    ctx.strokeStyle = weapon.color || "#caa25c";
    ctx.lineWidth = guard ? 1.8 : 2.1;
    ctx.beginPath();
    ctx.moveTo(4.6, -.4);
    ctx.lineTo(5.7, -11 - (weapon.name === "RIFLE" ? 4 : 0));
    ctx.stroke();
    ctx.fillStyle = "#201b16";
    ctx.fillRect(3.8, -3.4, 2.1, 5.4);
    ctx.restore();
    if (actor.hidden) drawFoliageMask(x, y + 4);
  }

  function drawFoliageMask(x, y) {
    ctx.save();
    ctx.globalAlpha = .72;
    ctx.fillStyle = "#4f6b3e";
    ctx.beginPath();
    ctx.arc(x - 8, y - 1, 5, 0, TAU);
    ctx.arc(x - 2, y + 2, 6, 0, TAU);
    ctx.arc(x + 6, y - 1, 5.4, 0, TAU);
    ctx.arc(x + 10, y + 3, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#8ba663";
    ctx.beginPath();
    ctx.arc(x - 4, y - 3, 2.2, 0, TAU);
    ctx.arc(x + 5, y - 2, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawFlashes() {
    for (const flash of state.flashes) {
      const amount=flash.ttl/flash.max;ctx.save();ctx.globalAlpha=amount;
      if ((flash.kind === "shot" || flash.kind === "enemyShot") && flash.from) { ctx.strokeStyle=flash.kind==="enemyShot"?"#f27650":"#ffe49b";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(flash.from.x,flash.from.y-4);ctx.lineTo(flash.x,flash.y-4);ctx.stroke(); }
      ctx.strokeStyle=flash.kind === "telegraph" ? "#9dd57b" : flash.kind === "callout" ? "#f16e4b" : flash.kind === "takedown" ? "#a3d377" : "#f6d36d";ctx.lineWidth=2;ctx.beginPath();ctx.arc(flash.x,flash.y,3+(1-amount)*20,0,TAU);ctx.stroke();ctx.restore();
    }
  }

  function drawMapFrame() {
    ctx.save();ctx.fillStyle="rgba(12,14,11,.78)";ctx.fillRect(VIEW.left-4,VIEW.top-4,VIEW.w+8,4);ctx.fillRect(VIEW.left-4,VIEW.bottom,VIEW.w+8,4);ctx.fillRect(VIEW.left-4,VIEW.top,4,VIEW.h);ctx.fillRect(VIEW.right,VIEW.top,4,VIEW.h);
    ctx.strokeStyle="rgba(87,83,58,.86)";ctx.lineWidth=2;ctx.strokeRect(VIEW.left-1,VIEW.top-1,VIEW.w+2,VIEW.h+2);ctx.strokeStyle="rgba(210,185,110,.3)";ctx.lineWidth=1;ctx.strokeRect(VIEW.left+3,VIEW.top+3,VIEW.w-6,VIEW.h-6);
    ctx.fillStyle="#777052";for(let x=VIEW.left+12;x<VIEW.right-10;x+=44){ctx.fillRect(x,VIEW.top-3,3,2);ctx.fillRect(x,VIEW.bottom+1,3,2);}for(let y=VIEW.top+15;y<VIEW.bottom-8;y+=43){ctx.fillRect(VIEW.left-3,y,2,3);ctx.fillRect(VIEW.right+1,y,2,3);}ctx.restore();
  }

  function drawTopHud() {
    ctx.save();ctx.fillStyle="rgba(13,15,12,.96)";ctx.fillRect(0,0,W,50);ctx.fillStyle="#393b30";ctx.fillRect(0,47,W,3);ctx.fillStyle="#8a805a";ctx.fillRect(0,48,W,1);
    ctx.fillStyle="rgba(119,111,75,.42)";for(let x=8;x<W;x+=37){ctx.fillRect(x,5,2,2);ctx.fillRect(x,44,2,2);}
    ctx.fillStyle=P.paperDim;ctx.font="bold 8px monospace";ctx.fillText("MESA JUNCTION / YARD DISTRICT",23,17);ctx.fillStyle=P.paper;ctx.font="bold 10px monospace";ctx.fillText(state.objectiveText,23,33);
    const barX=463,barW=170;ctx.fillStyle="#34372d";ctx.fillRect(barX,19,barW,11);ctx.fillStyle=state.alarm>66?"#d36243":state.alarm>33?"#d6a855":"#83aa65";ctx.fillRect(barX+2,21,(barW-4)*state.alarm/100,7);ctx.strokeStyle="#8a805a";ctx.strokeRect(barX,19,barW,11);ctx.fillStyle=P.paperDim;ctx.font="bold 8px monospace";ctx.fillText("ALARM",barX,15);ctx.fillStyle=state.alarm>0?P.paper:"#9db77b";ctx.fillText(`${Math.round(state.alarm).toString().padStart(3,"0")}%`,barX+barW+8,28);
    const healthX=678;ctx.fillStyle=P.paperDim;ctx.font="bold 8px monospace";ctx.fillText("CREW",healthX,15);heroes.forEach((hero,index)=>{ctx.fillStyle=hero.down?"#61382d":index===state.focus?"#f1cf79":isHeroSelected(index)?"#b7c87a":"#66583f";ctx.fillRect(healthX+index*48,21,38,7);ctx.fillStyle=hero.down?"#2c1a17":hero.health===1?"#e56142":"#86b16c";ctx.fillRect(healthX+index*48+2,23,Math.max(0,34*hero.health/hero.maxHealth),3);});
    const label=state.paused?"TACTICAL PAUSE":state.abilityMode?`${currentHero().ability} READY`:state.attackMode?`${currentHero().weaponData.name} READY`:"LIVE OPERATION";ctx.textAlign="right";ctx.fillStyle=state.paused?"#f4c464":state.abilityMode||state.attackMode?"#f0c65d":"#99be75";ctx.font="bold 9px monospace";ctx.fillText(label,925,19);ctx.fillStyle="#a77e51";ctx.font="8px monospace";ctx.fillText(state.paused?"QUEUE / SPACE TO RUN":`F: FIRE · Q: SKILL · E: USE · X: LOW`,925,34);
    if (state.messageTimer>0) { const messageWidth=Math.min(600,ctx.measureText(state.message).width+30);const x=W/2-messageWidth/2;ctx.fillStyle="rgba(13,15,12,.92)";ctx.fillRect(x,510,messageWidth,20);ctx.strokeStyle="#6f684c";ctx.strokeRect(x,510,messageWidth,20);ctx.fillStyle="#e3d092";ctx.textAlign="center";ctx.font="bold 8px monospace";ctx.fillText(state.message,W/2,523); }
    ctx.textAlign="left";ctx.restore();
  }

  function drawMiniMap() {
    const sx=MINI.w/WORLD.w, sy=MINI.h/WORLD.h;
    ctx.save();ctx.fillStyle="rgba(12,14,11,.9)";ctx.fillRect(MINI.x-3,MINI.y-3,MINI.w+6,MINI.h+6);ctx.strokeStyle="#736b4e";ctx.strokeRect(MINI.x-3,MINI.y-3,MINI.w+6,MINI.h+6);ctx.fillStyle="#596041";ctx.fillRect(MINI.x,MINI.y,MINI.w,MINI.h);
    ctx.fillStyle="#3f392c";ctx.strokeStyle="#3f392c";ctx.lineWidth=1;
    for(const obstacle of obstacles){
      if(obstacle.shape === "poly"){ctx.beginPath();obstacle.points.forEach((point,index)=>{const x=MINI.x+(point[0]-WORLD.left)*sx,y=MINI.y+(point[1]-WORLD.top)*sy;if(index)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.closePath();ctx.fill();}
      else if(obstacle.shape === "segment"){ctx.lineWidth=Math.max(1,(obstacle.width||1)*Math.max(sx,sy));ctx.beginPath();ctx.moveTo(MINI.x+(obstacle.ax-WORLD.left)*sx,MINI.y+(obstacle.ay-WORLD.top)*sy);ctx.lineTo(MINI.x+(obstacle.bx-WORLD.left)*sx,MINI.y+(obstacle.by-WORLD.top)*sy);ctx.stroke();ctx.lineWidth=1;}
      else ctx.fillRect(MINI.x+(obstacle.x-WORLD.left)*sx,MINI.y+(obstacle.y-WORLD.top)*sy,Math.max(2,obstacle.w*sx),Math.max(2,obstacle.h*sy));
    }
    ctx.fillStyle="#df6744";for(const guard of guards)if(!guard.down)ctx.fillRect(MINI.x+(guard.x-WORLD.left)*sx-1,MINI.y+(guard.y-WORLD.top)*sy-1,3,3);
    heroes.forEach((hero,index)=>{ctx.fillStyle=hero.down?"#4a2b25":index===state.focus?"#f0cf79":isHeroSelected(index)?"#c9d487":"#83b46d";ctx.fillRect(MINI.x+(hero.x-WORLD.left)*sx-1,MINI.y+(hero.y-WORLD.top)*sy-1,3,3);});
    ctx.strokeStyle="#e1c879";ctx.lineWidth=1;ctx.strokeRect(MINI.x+state.camera.x*sx,MINI.y+state.camera.y*sy,VIEW.w*sx,VIEW.h*sy);ctx.fillStyle="#d9c58a";ctx.font="bold 6px monospace";ctx.fillText("MAP · CLICK TO PAN",MINI.x,MINI.y-7);ctx.restore();
  }

  function drawPointer() {
    if (!state.started || state.won || state.lost) return;
    const { x, y, sx, sy } = state.pointer;
    if (sx < VIEW.left || sx > VIEW.right || sy < VIEW.top || sy > VIEW.bottom) return;
    ctx.save();const targetingGuard=state.attackMode || state.abilityMode === "shot" || state.abilityMode === "takedown";const target=targetingGuard ? nearestGuardAt(x,y,23) : null;ctx.strokeStyle=target?"#f06d48":state.abilityMode||state.attackMode?"#f2cb68":"rgba(244,214,130,.78)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx-5,sy);ctx.lineTo(sx+5,sy);ctx.moveTo(sx,sy-5);ctx.lineTo(sx,sy+5);ctx.stroke();if(state.abilityMode === "coin"||state.attackMode){ctx.setLineDash([3,2]);ctx.beginPath();ctx.arc(sx,sy,state.attackMode?12:10,0,TAU);ctx.stroke();ctx.setLineDash([]);}ctx.restore();
  }

  function updateRoster() {
    if (!rosterEl.children.length) {
      rosterEl.innerHTML = `<button class="squad-card" type="button" data-all="true" aria-label="Select all crew"><strong>ALL HANDS <span>A</span></strong><span class="squad-status">SELECT CREW</span></button>${heroes.map((hero,index) => `<button class="character-card" type="button" data-index="${index}" aria-label="Select ${hero.name}" style="--hero-color:${hero.color};--coat:${hero.coat};--skin:${hero.skin};--portrait-x:${index % 2 ? "100%" : "0%"};--portrait-y:${index > 1 ? "100%" : "0%"}"><span class="portrait portrait-art" aria-hidden="true"></span><span class="card-copy"><strong>${hero.name}</strong><span>${hero.ability}</span></span><span class="card-key">${hero.key}</span></button>`).join("")}`;
      rosterEl.querySelector(".squad-card").addEventListener("click", () => selectAllHeroes());
      rosterEl.querySelectorAll(".character-card").forEach((button) => button.addEventListener("click", (event) => chooseHero(Number(button.dataset.index), event.shiftKey)));
    }
    const standing = heroes.filter((hero) => !hero.down).length;
    const squadButton = rosterEl.querySelector(".squad-card");
    squadButton.classList.toggle("active", selectedHeroes().length === standing && standing > 0);
    squadButton.setAttribute("aria-pressed", String(selectedHeroes().length === standing && standing > 0));
    const squadStatus = squadButton.querySelector(".squad-status");
    if (squadStatus) squadStatus.textContent = `${selectedHeroes().length}/${standing} SELECTED · SHIFT ADD`;
    rosterEl.querySelectorAll(".character-card").forEach((button,index) => {
      const hero=heroes[index];button.classList.toggle("active",isHeroSelected(index));button.classList.toggle("focus",index===state.focus);button.classList.toggle("wounded",hero.health===1&&!hero.down);button.classList.toggle("down",hero.down);button.setAttribute("aria-pressed",String(isHeroSelected(index)));
      const detail=button.querySelector(".card-copy span");if(detail)detail.textContent=hero.down?"DOWN":`${hero.weaponData.glyph} · ${hero.ability} · ${hero.health}/${hero.maxHealth}`;
    });
  }

  function updateDom(force=false) {
    domTick += 1;if(!force&&domTick%12!==0)return;const hero=currentHero();if(!hero)return;const squad=selectedHeroes();
    const objective=activeMissionObjective();
    const closeToObjective=objective&&squad.some((member)=>distanceXY(member.x,member.y,objective.point.x,objective.point.y)<=objective.range);
    let instruction=state.messageTimer>0?state.message:closeToObjective?`Press E to ${objective.verb}.`:squad.length>1?`${squad.length} hands selected. Click ground to keep a tight formation.`:`${hero.name}: ${hero.weaponData.name} ready. ${hero.ability}: ${hero.abilityShort}.`;
    if(state.attackMode)instruction=`${hero.weaponData.name} armed: click an enemy with a clean line of fire.`;
    if(state.abilityMode)instruction=hero.hint;
    if(state.paused)instruction=`${instruction} Queue: ${heroes.reduce((total,member)=>total+member.queue.length,0)} command(s).`;
    instructionEl.textContent=instruction;pauseLabel.textContent=state.paused?"PAUSED":state.abilityMode?"SKILL":state.attackMode?"FIRE":"LIVE";pauseLabel.style.color=state.paused||state.abilityMode||state.attackMode?"#eabd58":"#85b86d";statusText.textContent=`YARD DISTRICT · ${squad.length} HAND${squad.length===1?"":"S"} SELECTED · ALARM ${Math.round(state.alarm).toString().padStart(3,"0")}%`;
    updateRoster();
  }

  function mapPointer(event) {
    const rect=canvas.getBoundingClientRect();const sx=(event.clientX-rect.left)*W/rect.width;const sy=(event.clientY-rect.top)*H/rect.height;
    return { sx, sy, x:sx+state.camera.x, y:sy+state.camera.y };
  }

  function inMiniMap(point) { return point.sx >= MINI.x-3 && point.sx <= MINI.x+MINI.w+3 && point.sy >= MINI.y-10 && point.sy <= MINI.y+MINI.h+3; }

  function onPointerDown(event) {
    const point=mapPointer(event);state.pointer={...point};
    if (!state.started || state.won || state.lost) return;
    if (inMiniMap(point)) { const worldX=WORLD.left+(point.sx-MINI.x)/MINI.w*WORLD.w;const worldY=WORLD.top+(point.sy-MINI.y)/MINI.h*WORLD.h;state.followSelected=false;setCameraTo(worldX,worldY,true);return; }
    if (point.sy < VIEW.top || point.sy > VIEW.bottom) return;
    const clickedHero=heroes.findIndex((hero) => !hero.down && distanceXY(hero.x,hero.y,point.x,point.y)<16);
    if (clickedHero >= 0 && !state.abilityMode && !state.attackMode) { chooseHero(clickedHero, event.shiftKey); return; }
    if (state.abilityMode) { giveAbilityOrder(point.x,point.y); return; }
    if (state.attackMode) { giveAttackOrder(point.x, point.y); return; }
    const run = event.detail >= 2;
    if (run) state.lastRunOrder = performance.now();
    issueSquadMove(point.x,point.y,{run});
  }

  function onDoubleClick(event) {
    if (performance.now() - state.lastRunOrder < 160) return;
    const point = mapPointer(event);
    state.pointer = { ...point };
    if (!state.started || state.won || state.lost || state.abilityMode || state.attackMode || inMiniMap(point)) return;
    if (point.sy < VIEW.top || point.sy > VIEW.bottom) return;
    if (heroes.some((hero) => !hero.down && distanceXY(hero.x, hero.y, point.x, point.y) < 16)) return;
    state.lastRunOrder = performance.now();
    issueSquadMove(point.x, point.y, { run: true });
  }

  function onKeyDown(event) {
    const key=event.key.toLowerCase();
    if(key === "enter" && !state.started){startGame();return;}
    if(key === "r"){resetGame(state.started);if(!state.started)introPanel.classList.remove("hidden");else introPanel.classList.add("hidden");canvas.focus({preventScroll:true});return;}
    if(!state.started||state.won||state.lost)return;
    if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(key))event.preventDefault();
    if(key === " ")togglePause();
    if(key === "q")armAbility();
    if(key === "f")armWeapon();
    if(key === "e")tryInteract();
    if(key === "x")toggleCrouch();
    if(key === "a")selectAllHeroes();
    if(key === "escape"){state.abilityMode=null;state.attackMode=false;setMessage("Targeting cancelled.",1.4);}
    if(["1","2","3"].includes(key))chooseHero(Number(key)-1,event.shiftKey);
    if(key === "tab"){
      event.preventDefault();
      const standing=selectedHeroIndexes();
      const pool=standing.length?standing:heroes.map((hero,index)=>!hero.down?index:-1).filter((index)=>index>=0);
      const from=Math.max(0,pool.indexOf(state.focus));
      state.focus=pool[(from+(event.shiftKey?-1:1)+pool.length)%pool.length] ?? state.focus;
      updateRoster();
      setMessage(`${currentHero().name.split(" ")[0]} is on point.`,1.1);
    }
    if(key === "c"){const squad=selectedHeroes();if(squad.length){const center=squadCenter(squad);state.followSelected=false;setCameraTo(center.x,center.y);setMessage("Camera centered on selected hands.",1.2);}}
    const pan=105;if(key === "arrowup")panCamera(0,-pan);if(key === "arrowdown")panCamera(0,pan);if(key === "arrowleft")panCamera(-pan,0);if(key === "arrowright")panCamera(pan,0);
  }

  function loop(time) { const dt=Math.min(.05,(time-lastTime)/1000||0);lastTime=time;update(dt);draw();updateDom();requestAnimationFrame(loop); }

  startButton.addEventListener("click",startGame);
  restartButton.addEventListener("click",()=>{resetGame(true);introPanel.classList.add("hidden");canvas.focus({preventScroll:true});});
  canvas.addEventListener("pointermove",(event)=>{state.pointer={...mapPointer(event)};});
  canvas.addEventListener("pointerleave",()=>{state.pointer={x:-100,y:-100,sx:-100,sy:-100};});
  canvas.addEventListener("pointerdown",onPointerDown);
  canvas.addEventListener("dblclick",onDoubleClick);
  window.addEventListener("keydown",onKeyDown);

  resetGame(false);
  requestAnimationFrame(loop);
})();
