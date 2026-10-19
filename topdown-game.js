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
  const restartButton = document.getElementById("restartButton");
  const instruction = document.getElementById("instruction");
  const pauseLabel = document.getElementById("pauseLabel");
  const statusText = document.getElementById("statusText");
  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;
  const MAP = { l: 26, t: 46, r: 1174, b: 662 };
  const CELL = 24;
  const color = {
    ink: "#10130e", ui: "#181b15", line: "#6f724f", paper: "#ead9a5",
    muted: "#9b956e", gold: "#d9b059", amber: "#d37c45", red: "#d65e46",
    green: "#98b97a", ground: "#807546", road: "#b09a64", wall: "#b89a63",
    water: "#61888a", shadow: "rgba(20,17,12,.36)"
  };
  const roads = [
    {x:33,y:564,w:1132,h:84}, {x:520,y:52,w:98,h:586},
    {x:42,y:244,w:1118,h:72}, {x:886,y:66,w:98,h:570}
  ];
  const solids = [
    {id:"cantina",type:"building",label:"CANTINA",x:92,y:82,w:238,h:136,roof:"#78482f",door:"s"},
    {id:"depot",type:"building",label:"FREIGHT DEPOT",x:458,y:72,w:244,h:146,roof:"#5d4935",door:"w"},
    {id:"bank",type:"building",label:"PAYMASTER",x:264,y:398,w:244,h:148,roof:"#70452f",door:"e"},
    {id:"stable",type:"building",label:"LIVERY STABLE",x:772,y:310,w:266,h:150,roof:"#68432b",door:"s"},
    {id:"workshop",type:"building",label:"WORKSHOP",x:668,y:536,w:232,h:106,roof:"#5a4733",door:"n"},
    {id:"shack",type:"building",label:"SIGNAL SHACK",x:1012,y:528,w:132,h:104,roof:"#65412f",door:"w"},
    {id:"tower",type:"tower",label:"WATER TOWER",x:1048,y:154,r:59},
    {id:"wagon",type:"wagon",x:554,y:280,w:116,h:48},
    {id:"crateA",type:"crate",x:584,y:476,w:76,h:58},
    {id:"crateB",type:"crate",x:922,y:486,w:62,h:46},
    {id:"crateC",type:"crate",x:104,y:322,w:56,h:42},
    {id:"fenceA",type:"fence",x:338,y:268,w:150,h:10},
    {id:"fenceB",type:"fence",x:708,y:258,w:132,h:10},
    {id:"fenceC",type:"fence",x:110,y:540,w:122,h:10}
  ];
  const brush = [
    {x:104,y:587,r:44}, {x:210,y:604,r:30}, {x:203,y:297,r:30},
    {x:380,y:330,r:28}, {x:724,y:290,r:31}, {x:694,y:448,r:29},
    {x:1064,y:462,r:30}, {x:955,y:596,r:29}, {x:1140,y:350,r:34}
  ];
  const cover = [
    {x:548,y:303,r:38}, {x:622,y:505,r:42}, {x:953,y:509,r:36},
    {x:133,y:343,r:32}, {x:730,y:530,r:30}, {x:750,y:238,r:28}
  ];
  const exitZone = {x:34,y:548,w:50,h:100};
  const relay = {x:968,y:580,r:23,done:false};
  const ledger = {x:540,y:486,r:20,done:false};
  const weapon = {
    pistol:{label:"PISTOL",range:144,damage:1,cooldown:1.25},
    rifle:{label:"RIFLE",range:226,damage:2,cooldown:2.2},
    shotgun:{label:"SHOTGUN",range:78,damage:2,cooldown:2.6}
  };
  const heroSpec = [
    {id:"june",key:"1",name:"JUNE MERCER",role:"QUILL · PATHFINDER",skill:"COIN TOSS",coat:"#3f6c80",hat:"#d36b41",skin:"#e1a476",x:104,y:606,speed:86,health:3,weapon:"pistol"},
    {id:"silas",key:"2",name:"SILAS ROOK",role:"ROOK · LONG GUN",skill:"COVER SHOT",coat:"#794b35",hat:"#cca249",skin:"#d79c70",x:142,y:620,speed:74,health:3,weapon:"rifle"},
    {id:"tomas",key:"3",name:"TOMÁS GARZA",role:"OX · STRONGARM",skill:"QUIET TAKEDOWN",coat:"#60764d",hat:"#5e3d2b",skin:"#c98a62",x:82,y:630,speed:64,health:4,weapon:"shotgun"}
  ];
  const guardSpec = [
    {name:"Gate Watch",weapon:"pistol",x:420,y:602,patrol:[[420,602],[548,602],[566,562],[524,552]]},
    {name:"Cantina Watch",weapon:"shotgun",x:206,y:288,patrol:[[206,288],[286,292],[330,330],[248,344]]},
    {name:"Depot Watch",weapon:"rifle",x:410,y:302,patrol:[[410,302],[504,282],[618,250],[654,302],[568,344]]},
    {name:"Crossing Watch",weapon:"pistol",x:704,y:346,patrol:[[704,346],[738,390],[704,456],[650,432]]},
    {name:"Tower Watch",weapon:"rifle",x:1066,y:274,patrol:[[1066,274],[1120,328],[1092,404],[1052,454],[1078,382]]},
    {name:"Signal Watch",weapon:"pistol",x:956,y:574,patrol:[[956,574],[974,486],[946,440],[906,480],[922,550]]},
    {name:"Bank Watch",weapon:"shotgun",x:210,y:350,patrol:[[210,350],[264,318],[356,320],[412,356],[384,376]]}
  ];
  const state = {
    started:false,paused:false,won:false,lost:false,elapsed:0,alarm:0,stage:0,
    message:"The west brush is safe. The nearest patrol is several lanes away.",messageTime:5,
    selection:new Set([0,1,2]),focus:0,ability:false,attack:false,pointer:{x:-100,y:-100},
    flashes:[],noises:[],lossReason:""
  };
  let heroes = [];
  let guards = [];
  let lastTime = 0;
  let seed = 201917;
  const specks = makeSpecks();

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function makeSpecks() {
    let s = 3113;
    const r = () => {
      s = (s * 1103515245 + 12345) >>> 0;
      return s / 4294967296;
    };
    return Array.from({length:720}, () => ({x:MAP.l + r() * (MAP.r - MAP.l),y:MAP.t + r() * (MAP.b - MAP.t),size:r() < .76 ? 1 : 2,tone:Math.floor(r() * 4)}));
  }
  function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }
  function d(ax,ay,bx,by) { return Math.hypot(ax - bx,ay - by); }
  function delta(a,b) { return Math.atan2(Math.sin(a - b),Math.cos(a - b)); }
  function turn(a,b,amount) { return a + delta(b,a) * Math.min(1,amount); }
  function timeText(seconds) {
    const value = Math.floor(seconds);
    return String(Math.floor(value / 60)).padStart(2,"0") + ":" + String(value % 60).padStart(2,"0");
  }
  function message(text,seconds=3.2) {
    state.message = text;
    state.messageTime = seconds;
    updateDom();
  }
  function cloneHero(source) {
    return {...source,team:"hero",radius:11,maxHealth:source.health,facing:-Math.PI/2,drawFacing:-Math.PI/2,route:[],goal:null,moving:false,moveMode:"walk",stance:"stand",hidden:false,cover:false,down:false,cooldown:0,skillCooldown:0,phase:random()*TAU,blocked:0,hit:0};
  }
  function cloneGuard(source) {
    const data = weapon[source.weapon];
    return {...source,team:"guard",radius:10,health:2,maxHealth:2,speed:37,data,range:data.range,vision:Math.round(data.range*.55+34),fov:Math.PI*.52,standoff:Math.max(70,Math.round(data.range*.52)),damage:source.weapon==="rifle"?1:data.damage,patrolIndex:1,mode:"patrol",suspicion:0,lastSeen:null,investigate:null,route:[],goal:null,moving:false,moveMode:"walk",facing:0,drawFacing:0,phase:random()*TAU,cooldown:1+random(),repath:random(),blocked:0,down:false,hit:0,cover:false,hidden:false};
  }
  function reset(started=false) {
    seed = 201917;
    heroes = heroSpec.map(cloneHero);
    guards = guardSpec.map(cloneGuard);
    relay.done = false;
    ledger.done = false;
    Object.assign(state,{started,paused:false,won:false,lost:false,elapsed:0,alarm:0,stage:0,message:"The west brush is safe. The nearest patrol is several lanes away.",messageTime:5,selection:new Set([0,1,2]),focus:0,ability:false,attack:false,flashes:[],noises:[],lossReason:""});
    outcome.classList.add("hidden");
    updateDom(true);
  }
  function begin() {
    if (!state.started) {
      reset(true);
      intro.classList.add("hidden");
    }
    canvas.focus({preventScroll:true});
  }
  function end(won) {
    if (state.won || state.lost) return;
    state.won = won;
    state.lost = !won;
    state.paused = false;
    state.ability = false;
    state.attack = false;
    outcome.classList.remove("hidden");
    if (won) {
      const down = guards.filter((guard) => guard.down).length;
      outcomeKicker.textContent = "CONTRACT COMPLETE";
      outcomeTitle.textContent = "YARD GONE COLD";
      outcomeText.textContent = "The relay stayed dark, the ledger disappeared, and the crew crossed the west gate. " + (down ? String(down) + " watch" + (down === 1 ? "man was" : "men were") + " put down." : "No one had to be put down.") + " Time: " + timeText(state.elapsed) + ".";
    } else {
      outcomeKicker.textContent = "CONTRACT BURNED";
      outcomeTitle.textContent = state.lossReason || "CREW PINNED";
      outcomeText.textContent = "The yard has the advantage. Use brush to disappear, cover to resist fire, and do not let guards crowd the crew.";
    }
    updateDom(true);
  }

  function circleRect(x,y,r,box) {
    const px = clamp(x,box.x,box.x+box.w);
    const py = clamp(y,box.y,box.y+box.h);
    return d(x,y,px,py) < r;
  }
  function terrainOpen(x,y,radius) {
    if (x-radius < MAP.l || x+radius > MAP.r || y-radius < MAP.t || y+radius > MAP.b) return false;
    return !solids.some((solid) => solid.type === "tower" ? d(x,y,solid.x,solid.y) < radius + solid.r : circleRect(x,y,radius,solid));
  }
  function lineOpen(ax,ay,bx,by,radius=8) {
    const steps = Math.max(2,Math.ceil(d(ax,ay,bx,by)/9));
    for (let index=1;index<steps;index+=1) {
      const t = index / steps;
      if (!terrainOpen(ax+(bx-ax)*t,ay+(by-ay)*t,radius)) return false;
    }
    return true;
  }
  function bodyBlock(actor,x,y) {
    for (const other of [...heroes,...guards]) {
      if (other === actor || other.down) continue;
      const spacing = other.team === actor.team ? 4 : 8;
      if (d(x,y,other.x,other.y) < actor.radius + other.radius + spacing) return other;
    }
    return null;
  }
  function valid(actor,x,y) { return terrainOpen(x,y,actor.radius) && !bodyBlock(actor,x,y); }
  function nearestOpen(point,radius) {
    if (terrainOpen(point.x,point.y,radius)) return {x:point.x,y:point.y};
    for (let ring=12;ring<=156;ring+=12) {
      for (let step=0;step<20;step+=1) {
        const a = step / 20 * TAU;
        const x = point.x + Math.cos(a)*ring;
        const y = point.y + Math.sin(a)*ring;
        if (terrainOpen(x,y,radius)) return {x,y};
      }
    }
    return null;
  }
  function route(actor,target) {
    const goal = nearestOpen(target,actor.radius);
    if (!goal) return [];
    if (lineOpen(actor.x,actor.y,goal.x,goal.y,actor.radius)) return [goal];
    const cols = Math.floor((MAP.r-MAP.l)/CELL);
    const rows = Math.floor((MAP.b-MAP.t)/CELL);
    const point = (x,y) => ({x:MAP.l+x*CELL+CELL/2,y:MAP.t+y*CELL+CELL/2});
    const cell = (p) => ({x:clamp(Math.floor((p.x-MAP.l)/CELL),0,cols-1),y:clamp(Math.floor((p.y-MAP.t)/CELL),0,rows-1)});
    const start = cell(actor);
    const endCell = cell(goal);
    const key = (x,y) => String(x)+":"+String(y);
    const startKey = key(start.x,start.y);
    const endKey = key(endCell.x,endCell.y);
    const open = [{x:start.x,y:start.y,f:0}];
    const cost = new Map([[startKey,0]]);
    const parent = new Map();
    const closed = new Set();
    const steps = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.42],[-1,1,1.42],[1,-1,1.42],[-1,-1,1.42]];
    let found = false;
    let safety = 0;
    while (open.length && safety<2400) {
      safety += 1;
      let best = 0;
      for (let i=1;i<open.length;i+=1) if (open[i].f < open[best].f) best = i;
      const current = open.splice(best,1)[0];
      const currentKey = key(current.x,current.y);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      if (currentKey===endKey) {
        found=true;
        break;
      }
      const nowCost = cost.get(currentKey);
      for (const step of steps) {
        const nx = current.x+step[0];
        const ny = current.y+step[1];
        if (nx<0 || ny<0 || nx>=cols || ny>=rows) continue;
        const nextPoint = point(nx,ny);
        if (!terrainOpen(nextPoint.x,nextPoint.y,actor.radius+1)) continue;
        if (step[0] && step[1]) {
          const a = point(current.x+step[0],current.y);
          const b = point(current.x,current.y+step[1]);
          if (!terrainOpen(a.x,a.y,actor.radius+1) || !terrainOpen(b.x,b.y,actor.radius+1)) continue;
        }
        const nextKey = key(nx,ny);
        const nextCost = nowCost+step[2];
        if (nextCost >= (cost.get(nextKey) || Infinity)) continue;
        cost.set(nextKey,nextCost);
        parent.set(nextKey,currentKey);
        open.push({x:nx,y:ny,f:nextCost+Math.hypot(endCell.x-nx,endCell.y-ny)});
      }
    }
    if (!found) return [];
    const raw = [];
    let cursor=endKey;
    while (cursor && cursor!==startKey) {
      const coords=cursor.split(":").map(Number);
      raw.push(point(coords[0],coords[1]));
      cursor=parent.get(cursor);
    }
    raw.reverse();
    raw.push(goal);
    const result=[];
    let origin={x:actor.x,y:actor.y};
    for (let index=0;index<raw.length;) {
      let pick=index;
      for (let test=raw.length-1;test>index;test-=1) {
        if (lineOpen(origin.x,origin.y,raw[test].x,raw[test].y,actor.radius)) {
          pick=test;
          break;
        }
      }
      result.push(raw[pick]);
      origin=raw[pick];
      index=pick+1;
    }
    return result;
  }
  function setRoute(actor,point,mode="walk") {
    const goal=nearestOpen(point,actor.radius);
    if (!goal) return false;
    actor.goal=goal;
    actor.route=route(actor,goal);
    actor.moveMode=mode;
    actor.moving=actor.route.length>0;
    actor.blocked=0;
    return actor.moving;
  }
  function move(actor,dt) {
    if (actor.down || !actor.route.length) {
      actor.moving=false;
      return;
    }
    let next=actor.route[0];
    if (d(actor.x,actor.y,next.x,next.y)<5) {
      actor.route.shift();
      if (!actor.route.length) {
        actor.moving=false;
        return;
      }
      next=actor.route[0];
    }
    const direction=Math.atan2(next.y-actor.y,next.x-actor.x);
    const speed=(actor.speed||70)*(actor.moveMode==="run"?1.48:1)*(actor.team==="hero" && actor.stance==="crouch"?.57:1);
    const pace=Math.min(speed*dt,d(actor.x,actor.y,next.x,next.y));
    let moved=false;
    let body=false;
    for (const offset of [0,.35,-.35,.7,-.7,1.1,-1.1]) {
      const x=actor.x+Math.cos(direction+offset)*pace;
      const y=actor.y+Math.sin(direction+offset)*pace;
      if (valid(actor,x,y)) {
        actor.x=x;
        actor.y=y;
        actor.facing=direction+offset;
        moved=true;
        break;
      }
      if (terrainOpen(x,y,actor.radius) && bodyBlock(actor,x,y)) body=true;
    }
    actor.moving=moved;
    if (!moved) {
      actor.blocked+=dt;
      if (!body && actor.blocked>.45 && actor.goal) {
        actor.route=route(actor,actor.goal);
        actor.blocked=0;
      }
    } else actor.blocked=0;
  }
  function inZone(list,actor) { return list.find((zone) => d(actor.x,actor.y,zone.x,zone.y)<=zone.r); }
  function refresh(actor,dt) {
    if (actor.down) return;
    actor.hidden=actor.team==="hero" && actor.stance==="crouch" && Boolean(inZone(brush,actor));
    actor.cover=Boolean(inZone(cover,actor));
    actor.phase+=dt*(actor.moving?(actor.moveMode==="run"?14:9):1.4);
    actor.drawFacing=turn(actor.drawFacing,actor.facing,dt*(actor.moving?11:5));
    actor.cooldown=Math.max(0,actor.cooldown-dt);
    actor.skillCooldown=Math.max(0,actor.skillCooldown-dt);
    actor.hit=Math.max(0,actor.hit-dt);
  }

  function lineOfSight(a,b) { return lineOpen(a.x,a.y,b.x,b.y,5); }
  function spottedBy(guard) {
    let selected=null;
    let best=Infinity;
    for (const hero of heroes) {
      if (hero.down) continue;
      const distance=d(guard.x,guard.y,hero.x,hero.y);
      const range=guard.vision*(hero.stance==="crouch"?.78:1)*(hero.cover?.86:1);
      if (hero.hidden && distance>54) continue;
      const angle=Math.atan2(hero.y-guard.y,hero.x-guard.x);
      if (distance>range || Math.abs(delta(angle,guard.facing))>guard.fov/2 || !lineOfSight(guard,hero)) continue;
      if (distance<best) {
        best=distance;
        selected=hero;
      }
    }
    return selected;
  }
  function noise(x,y) {
    state.noises.push({x,y,time:4.6});
    state.flashes.push({x,y,time:.52,type:"noise"});
  }
  function guardTarget(guard,point,mode) {
    if (!guard.goal || d(guard.goal.x,guard.goal.y,point.x,point.y)>24 || !guard.route.length) setRoute(guard,point,mode);
  }
  function enemyFire(guard,hero) {
    guard.cooldown=guard.data.cooldown+.75;
    const chance=Math.max(.08,.43-(hero.cover?.45:0)-(hero.stance==="crouch"?.12:0));
    state.flashes.push({x:guard.x,y:guard.y,tx:hero.x,ty:hero.y,time:.18,type:"shot",hostile:true});
    if (random()<chance) {
      hero.health-=guard.damage;
      hero.hit=.36;
      message(hero.name.split(" ")[0]+" is hit. Use cover or break sight.",2.7);
      if (hero.health<=0) {
        hero.health=0;
        hero.down=true;
        message(hero.name.split(" ")[0]+" is down.",3.3);
      }
    }
    state.alarm=clamp(state.alarm+3,0,100);
    if (heroes.every((hero) => hero.down)) {
      state.lossReason="THE WHOLE CREW IS DOWN";
      end(false);
    }
  }
  function updateGuard(guard,dt) {
    if (guard.down) return;
    guard.cooldown=Math.max(0,guard.cooldown-dt);
    guard.repath-=dt;
    const hero=spottedBy(guard);
    if (hero) {
      guard.lastSeen={x:hero.x,y:hero.y,hero};
      const rate=hero.hidden?.18:hero.stance==="crouch"?.31:hero.cover?.43:.68;
      guard.suspicion=clamp(guard.suspicion+rate*dt,0,1);
      if (guard.suspicion>.22 && guard.mode==="patrol") {
        guard.mode="suspicious";
        message(guard.name+" is suspicious. Break the angle or get into brush.",2.6);
      }
      if (guard.suspicion>=.72 && guard.mode!=="alert") {
        guard.mode="alert";
        noise(guard.x,guard.y);
        message("Alarm raised — guards hold a firing distance instead of piling into the crew.",3.2);
      }
    } else {
      guard.suspicion=Math.max(0,guard.suspicion-dt*.36);
      if ((guard.mode==="suspicious" || guard.mode==="alert") && guard.suspicion<.15) guard.mode="investigate";
    }
    const heard=state.noises.filter((item) => d(guard.x,guard.y,item.x,item.y)<280).sort((a,b) => d(guard.x,guard.y,a.x,a.y)-d(guard.x,guard.y,b.x,b.y))[0];
    if (heard && guard.mode==="patrol") {
      guard.mode="investigate";
      guard.investigate={x:heard.x,y:heard.y};
    }
    if (guard.mode==="alert" && guard.lastSeen && !guard.lastSeen.hero.down) {
      const target=guard.lastSeen.hero;
      const distance=d(guard.x,guard.y,target.x,target.y);
      guard.facing=Math.atan2(target.y-guard.y,target.x-guard.x);
      if (distance>guard.standoff && guard.repath<=0) {
        guardTarget(guard,target,"run");
        guard.repath=.5;
      } else if (distance<=guard.standoff) {
        guard.route=[];
        guard.moving=false;
      }
      if (distance<=guard.range && lineOfSight(guard,target) && guard.cooldown<=0) enemyFire(guard,target);
    } else if (guard.mode==="suspicious" && guard.lastSeen) {
      if (guard.repath<=0) {
        guardTarget(guard,guard.lastSeen,"walk");
        guard.repath=.9;
      }
    } else if (guard.mode==="investigate") {
      const target=guard.investigate || guard.lastSeen;
      if (target && d(guard.x,guard.y,target.x,target.y)>16) {
        if (guard.repath<=0) {
          guardTarget(guard,target,"walk");
          guard.repath=.8;
        }
      } else {
        guard.mode="patrol";
        guard.investigate=null;
      }
    } else {
      const target=guard.patrol[guard.patrolIndex];
      if (d(guard.x,guard.y,target[0],target[1])<18) guard.patrolIndex=(guard.patrolIndex+1)%guard.patrol.length;
      if (guard.repath<=0) {
        const next=guard.patrol[guard.patrolIndex];
        guardTarget(guard,{x:next[0],y:next[1]},"walk");
        guard.repath=1;
      }
    }
    move(guard,dt);
    refresh(guard,dt);
  }
  function shoot(hero,guard,bonus=false) {
    if (!hero || hero.down || hero.cooldown>0 || guard.down) return false;
    const data=weapon[hero.weapon];
    if (d(hero.x,hero.y,guard.x,guard.y)>data.range*(bonus?1.28:1) || !lineOfSight(hero,guard)) {
      message("No clear shot from this position.");
      return false;
    }
    hero.facing=Math.atan2(guard.y-hero.y,guard.x-hero.x);
    hero.cooldown=data.cooldown;
    guard.health-=data.damage;
    guard.hit=.35;
    guard.mode="alert";
    guard.suspicion=1;
    state.alarm=clamp(state.alarm+(bonus?12:8),0,100);
    state.flashes.push({x:hero.x,y:hero.y,tx:guard.x,ty:guard.y,time:.18,type:"shot",hostile:false});
    noise(hero.x,hero.y);
    if (guard.health<=0) {
      guard.health=0;
      guard.down=true;
      guard.route=[];
      message(guard.name+" is down.",2.3);
    } else message(hero.name.split(" ")[0]+" fires. The yard heard it.",2.3);
    return true;
  }
  function guardAt(x,y,padding=18) { return guards.find((guard) => !guard.down && d(x,y,guard.x,guard.y)<=guard.radius+padding); }
  function heroAt(x,y,padding=16) { return heroes.findIndex((hero) => !hero.down && d(x,y,hero.x,hero.y)<=hero.radius+padding); }
  function nearestHero(point) { return heroes.filter((hero) => !hero.down).sort((a,b) => d(a.x,a.y,point.x,point.y)-d(b.x,b.y,point.x,point.y))[0]; }
  function interact() {
    const active=heroes.filter((hero) => !hero.down);
    if (!active.length) return;
    if (!relay.done) {
      const hero=nearestHero(relay);
      if (d(hero.x,hero.y,relay.x,relay.y)<=45) {
        relay.done=true;
        state.stage=1;
        state.alarm=Math.max(0,state.alarm-18);
        message("Signal relay disabled. The ledger is at the Paymaster office.",4);
      } else message("Move a hand beside the signal relay, then press E.");
      return;
    }
    if (!ledger.done) {
      const hero=nearestHero(ledger);
      if (d(hero.x,hero.y,ledger.x,ledger.y)<=40) {
        ledger.done=true;
        state.stage=2;
        message("Ledger acquired. Get the crew through the west gate.",4);
      } else message("Move a hand to the Paymaster ledger, then press E.");
      return;
    }
    if (active.some((hero) => hero.x<exitZone.x+exitZone.w+16 && hero.y>exitZone.y && hero.y<exitZone.y+exitZone.h)) end(true);
    else message("Bring at least one living hand to the west gate, then press E.");
  }
  function skill(point) {
    const hero=heroes[state.focus];
    if (!hero || hero.down) {
      message("Choose a living hand first.");
      return;
    }
    if (!state.ability) {
      state.ability=true;
      state.attack=false;
      message(hero.skill+" armed — click a valid target.",4);
      return;
    }
    if (hero.skillCooldown>0) {
      message(hero.name.split(" ")[0]+" is still recovering.");
      return;
    }
    if (hero.id==="june") {
      const target=nearestOpen(point,4);
      if (!target || d(hero.x,hero.y,target.x,target.y)>164) {
        message("Pick clear ground within June's throwing range.");
        return;
      }
      hero.skillCooldown=5.2;
      noise(target.x,target.y);
      state.ability=false;
      message("Coin tossed. Nearby patrols will investigate the sound.",3.4);
      return;
    }
    const guard=guardAt(point.x,point.y,24);
    if (!guard) {
      message("Choose a guard for that skill.");
      return;
    }
    if (hero.id==="silas") {
      if (shoot(hero,guard,true)) {
        hero.skillCooldown=6.8;
        state.ability=false;
      }
      return;
    }
    if (d(hero.x,hero.y,guard.x,guard.y)>56) {
      message("Ox must be closer for a quiet takedown.");
      return;
    }
    if (guard.mode==="alert") {
      message("That guard is alert. Break away or use a weapon.");
      return;
    }
    guard.down=true;
    guard.health=0;
    guard.route=[];
    hero.skillCooldown=6;
    state.ability=false;
    message("Quiet takedown. No alarm added.",3.2);
  }
  function formation(index) {
    return [{x:0,y:0},{x:-22,y:20},{x:22,y:20},{x:0,y:42}][index] || {x:index%2?-25:25,y:18+index*11};
  }
  function order(point,run) {
    const chosen=[...state.selection].map((index) => heroes[index]).filter((hero) => hero && !hero.down);
    if (!chosen.length) {
      message("There is nobody able to take that order.");
      return;
    }
    let count=0;
    chosen.forEach((hero,index) => {
      const offset=formation(index);
      if (setRoute(hero,{x:point.x+offset.x,y:point.y+offset.y},run?"run":"walk")) count+=1;
    });
    if (!count) {
      message("That ground is blocked. Pick an open lane.");
      return;
    }
    state.ability=false;
    state.attack=false;
    message(run?"Run order. The crew will make noise in the open.":"Formation order. The crew leaves room for one another.",2.3);
  }
  function mapClick(point,run) {
    if (state.ability) {
      skill(point);
      return;
    }
    if (state.attack) {
      const guard=guardAt(point.x,point.y,21);
      if (guard && shoot(heroes[state.focus],guard)) state.attack=false;
      else if (!guard) message("Click an armed guard to fire.");
      return;
    }
    const hero=heroAt(point.x,point.y);
    if (hero>=0) {
      state.selection=new Set([hero]);
      state.focus=hero;
      message(heroes[hero].name+" selected.");
      return;
    }
    if (!terrainOpen(point.x,point.y,3)) {
      message("That is a solid footprint: roof, wagon, fence, or crate.");
      return;
    }
    order(point,run);
  }
  function update(dt) {
    if (!state.started || state.paused || state.won || state.lost) return;
    state.elapsed+=dt;
    state.messageTime=Math.max(0,state.messageTime-dt);
    state.alarm=Math.max(0,state.alarm-dt*(relay.done?.52:.16));
    state.noises.forEach((item) => { item.time-=dt; });
    state.noises=state.noises.filter((item) => item.time>0);
    state.flashes.forEach((item) => { item.time-=dt; });
    state.flashes=state.flashes.filter((item) => item.time>0);
    for (const hero of heroes) {
      move(hero,dt);
      refresh(hero,dt);
      if (hero.moving && hero.moveMode==="run" && random()<dt*.7) noise(hero.x,hero.y);
    }
    for (const guard of guards) updateGuard(guard,dt);
    if (state.alarm>=100) {
      state.lossReason="THE CALL-OUT ARRIVED";
      end(false);
    }
    updateDom();
  }

  function drawGround() {
    ctx.fillStyle="#746a40";
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle=color.ground;
    ctx.fillRect(MAP.l,MAP.t,MAP.r-MAP.l,MAP.b-MAP.t);
    for (const road of roads) {
      ctx.fillStyle=color.road;
      ctx.fillRect(road.x,road.y,road.w,road.h);
      ctx.strokeStyle="rgba(85,69,39,.2)";
      ctx.lineWidth=1;
      ctx.setLineDash([7,7]);
      ctx.strokeRect(road.x+5,road.y+5,road.w-10,road.h-10);
      ctx.setLineDash([]);
    }
    for (const speck of specks) {
      ctx.fillStyle=["rgba(51,48,27,.18)","rgba(224,201,126,.16)","rgba(68,76,43,.16)","rgba(107,68,39,.14)"][speck.tone];
      ctx.fillRect(speck.x,speck.y,speck.size,speck.size);
    }
    ctx.strokeStyle="#b9a36c";
    ctx.lineWidth=3;
    ctx.strokeRect(MAP.l,MAP.t,MAP.r-MAP.l,MAP.b-MAP.t);
  }
  function drawBrush() {
    for (const zone of brush) {
      ctx.save();
      ctx.translate(zone.x,zone.y);
      for (let index=0;index<17;index+=1) {
        const a=index*2.41;
        const r=zone.r*(.2+(index%5)*.13);
        ctx.fillStyle=index%3?"#48613c":"#355035";
        ctx.beginPath();
        ctx.arc(Math.cos(a)*r,Math.sin(a*1.7)*r*.66,8+(index%4),0,TAU);
        ctx.fill();
      }
      ctx.strokeStyle="rgba(215,225,148,.22)";
      ctx.setLineDash([3,4]);
      ctx.beginPath();
      ctx.arc(0,0,zone.r,0,TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
  function drawSolid(item) {
    if (item.type==="tower") {
      ctx.save();
      ctx.translate(item.x,item.y);
      ctx.fillStyle=color.shadow;
      ctx.beginPath();
      ctx.ellipse(7,10,item.r+4,item.r-10,0,0,TAU);
      ctx.fill();
      ctx.fillStyle=color.water;
      ctx.beginPath();
      ctx.arc(0,0,item.r,0,TAU);
      ctx.fill();
      ctx.strokeStyle="#d7c37b";
      ctx.lineWidth=4;
      ctx.stroke();
      ctx.strokeStyle="rgba(17,28,27,.4)";
      ctx.lineWidth=2;
      for (let y=-38;y<=38;y+=16) {
        ctx.beginPath();
        ctx.moveTo(-42,y);
        ctx.lineTo(42,y);
        ctx.stroke();
      }
      ctx.fillStyle="#384b4e";
      ctx.fillRect(-7,-70,14,20);
      ctx.fillStyle=color.paper;
      ctx.font="700 9px Courier New";
      ctx.textAlign="center";
      ctx.fillText(item.label,0,3);
      ctx.restore();
      return;
    }
    ctx.fillStyle=color.shadow;
    ctx.fillRect(item.x+7,item.y+8,item.w,item.h);
    if (item.type==="building") {
      ctx.fillStyle=item.roof;
      ctx.fillRect(item.x,item.y,item.w,item.h);
      ctx.strokeStyle="#32291f";
      ctx.lineWidth=4;
      ctx.strokeRect(item.x,item.y,item.w,item.h);
      ctx.fillStyle="rgba(239,203,130,.1)";
      for (let x=item.x+14;x<item.x+item.w-6;x+=16) ctx.fillRect(x,item.y+6,3,item.h-12);
      ctx.strokeStyle=item.roof==="#5d4935"?"#b1966a":"#a6784e";
      ctx.lineWidth=2;
      ctx.strokeRect(item.x+8,item.y+8,item.w-16,item.h-16);
      ctx.fillStyle=color.wall;
      if (item.door==="s") ctx.fillRect(item.x+item.w/2-12,item.y+item.h-11,24,11);
      if (item.door==="n") ctx.fillRect(item.x+item.w/2-12,item.y,24,11);
      if (item.door==="w") ctx.fillRect(item.x,item.y+item.h/2-12,11,24);
      if (item.door==="e") ctx.fillRect(item.x+item.w-11,item.y+item.h/2-12,11,24);
      ctx.fillStyle="rgba(255,239,177,.86)";
      ctx.font="700 10px Courier New";
      ctx.textAlign="center";
      ctx.fillText(item.label,item.x+item.w/2,item.y+item.h/2+3);
      return;
    }
    if (item.type==="wagon") {
      ctx.fillStyle="#8b5b32";
      ctx.fillRect(item.x,item.y+6,item.w,item.h-12);
      ctx.strokeStyle="#402c20";
      ctx.lineWidth=3;
      ctx.strokeRect(item.x,item.y+6,item.w,item.h-12);
      for (const x of [item.x+18,item.x+item.w-18]) {
        ctx.fillStyle="#30251b";
        ctx.beginPath();
        ctx.arc(x,item.y+item.h/2,13,0,TAU);
        ctx.fill();
        ctx.strokeStyle="#c09d59";
        ctx.lineWidth=2;
        ctx.stroke();
      }
      return;
    }
    if (item.type==="crate") {
      ctx.fillStyle="#77522f";
      ctx.fillRect(item.x,item.y,item.w,item.h);
      ctx.strokeStyle="#2e2519";
      ctx.lineWidth=3;
      ctx.strokeRect(item.x,item.y,item.w,item.h);
      ctx.strokeStyle="#bf9654";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(item.x+4,item.y+4);
      ctx.lineTo(item.x+item.w-4,item.y+item.h-4);
      ctx.moveTo(item.x+item.w-4,item.y+4);
      ctx.lineTo(item.x+4,item.y+item.h-4);
      ctx.stroke();
      return;
    }
    ctx.fillStyle="#3d3325";
    ctx.fillRect(item.x,item.y,item.w,item.h);
    ctx.strokeStyle="#c9ad68";
    ctx.lineWidth=2;
    for (let x=item.x+6;x<item.x+item.w;x+=12) {
      ctx.beginPath();
      ctx.moveTo(x,item.y-4);
      ctx.lineTo(x,item.y+item.h+4);
      ctx.stroke();
    }
  }
  function drawExit() {
    ctx.fillStyle="#31342a";
    ctx.fillRect(exitZone.x,exitZone.y,exitZone.w,exitZone.h);
    ctx.strokeStyle="#d3b461";
    ctx.lineWidth=3;
    ctx.strokeRect(exitZone.x,exitZone.y,exitZone.w,exitZone.h);
    ctx.fillStyle=color.paper;
    ctx.font="700 9px Courier New";
    ctx.textAlign="center";
    ctx.save();
    ctx.translate(exitZone.x+exitZone.w/2,exitZone.y+exitZone.h/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("WEST GATE",0,3);
    ctx.restore();
  }
  function drawObjective(item,label,done,active) {
    const pulse=1+Math.sin(state.elapsed*4)*.08;
    ctx.save();
    ctx.translate(item.x,item.y);
    ctx.strokeStyle=done?"#6e9975":active?color.gold:"rgba(218,175,81,.28)";
    ctx.lineWidth=2;
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.arc(0,0,item.r*pulse,0,TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=done?"#5f8a68":active?color.gold:color.muted;
    ctx.beginPath();
    ctx.arc(0,0,8,0,TAU);
    ctx.fill();
    ctx.fillStyle=color.ink;
    ctx.font="700 10px Courier New";
    ctx.textAlign="center";
    ctx.fillText(done?"✓":"!",0,4);
    ctx.fillStyle=done?"#9bb58a":color.paper;
    ctx.font="700 9px Courier New";
    ctx.fillText(label,0,-30);
    ctx.restore();
  }
  function drawVision(guard) {
    if (guard.down) return;
    const opacity=guard.mode==="alert"?.12:guard.mode==="suspicious"?.08:.035;
    ctx.save();
    ctx.translate(guard.x,guard.y);
    ctx.rotate(guard.drawFacing);
    ctx.fillStyle=guard.mode==="alert"?"rgba(214,91,66,"+opacity+")":"rgba(226,190,101,"+opacity+")";
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,guard.vision,-guard.fov/2,guard.fov/2);
    ctx.closePath();
    ctx.fill();
    if (guard.mode!=="patrol") {
      ctx.strokeStyle=guard.mode==="alert"?"rgba(214,91,66,.45)":"rgba(226,190,101,.35)";
      ctx.lineWidth=1;
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawActor(actor,selected) {
    if (actor.down) {
      ctx.save();
      ctx.translate(actor.x,actor.y);
      ctx.fillStyle="rgba(20,18,15,.34)";
      ctx.beginPath();
      ctx.ellipse(4,5,16,8,0,0,TAU);
      ctx.fill();
      ctx.fillStyle=actor.team==="hero"?actor.coat:"#6a3930";
      ctx.beginPath();
      ctx.arc(0,0,8,0,TAU);
      ctx.fill();
      ctx.strokeStyle="#181611";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(-7,-7);
      ctx.lineTo(7,7);
      ctx.moveTo(7,-7);
      ctx.lineTo(-7,7);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const f=actor.drawFacing;
    const fx=Math.cos(f);
    const fy=Math.sin(f);
    const sx=-fy;
    const sy=fx;
    const stride=actor.moving?Math.sin(actor.phase*1.45)*3.4:0;
    ctx.save();
    ctx.translate(actor.x,actor.y);
    ctx.fillStyle="rgba(23,20,14,.36)";
    ctx.beginPath();
    ctx.ellipse(3,7,14,7,0,0,TAU);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle=actor.hidden?"#7db582":color.gold;
      ctx.lineWidth=2;
      ctx.setLineDash(actor.hidden?[3,3]:[]);
      ctx.beginPath();
      ctx.arc(0,1,17,0,TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (actor.team==="guard" && actor.mode!=="patrol") {
      ctx.strokeStyle=actor.mode==="alert"?color.red:color.gold;
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(0,1,16,0,TAU);
      ctx.stroke();
    }
    ctx.fillStyle="#2a261f";
    for (const foot of [[5,stride],[-5,-stride]]) {
      ctx.beginPath();
      ctx.ellipse(sx*foot[0]-fx*5+fx*foot[1],sy*foot[0]-fy*5+fy*foot[1],4,5,f,0,TAU);
      ctx.fill();
    }
    ctx.fillStyle=actor.hit>0?"#f1d08c":actor.team==="hero"?actor.coat:"#7b4540";
    ctx.beginPath();
    ctx.ellipse(0,0,10,12,f,0,TAU);
    ctx.fill();
    ctx.strokeStyle="#171811";
    ctx.lineWidth=2;
    ctx.stroke();
    if (actor.team==="guard") {
      ctx.strokeStyle="#30291f";
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(fx*8,fy*8);
      ctx.lineTo(fx*20,fy*20);
      ctx.stroke();
    }
    ctx.fillStyle=actor.skin || "#c9976d";
    ctx.beginPath();
    ctx.arc(fx*6,fy*6,6.5,0,TAU);
    ctx.fill();
    ctx.fillStyle=actor.team==="hero"?actor.hat:"#34332b";
    ctx.save();
    ctx.translate(fx*9,fy*9);
    ctx.rotate(f);
    ctx.beginPath();
    ctx.ellipse(0,0,11,5,0,0,TAU);
    ctx.fill();
    ctx.fillRect(-5,-8,10,8);
    ctx.restore();
    if (actor.team==="hero" && actor.cover) {
      ctx.strokeStyle="rgba(163,209,141,.9)";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(0,0,13,Math.PI*.1,Math.PI*.9);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle=actor.team==="hero"?color.paper:"#efceb4";
    ctx.font="700 9px Courier New";
    ctx.textAlign="center";
    ctx.fillText(actor.team==="hero"?actor.name.split(" ")[0]:actor.name.replace(" Watch",""),actor.x,actor.y-22);
    const width=actor.team==="hero"?24:18;
    ctx.fillStyle="rgba(8,10,8,.7)";
    ctx.fillRect(actor.x-width/2,actor.y+21,width,3);
    ctx.fillStyle=actor.team==="hero"?"#9fc579":"#d66a50";
    ctx.fillRect(actor.x-width/2,actor.y+21,width*(actor.health/actor.maxHealth),3);
  }
  function drawFlashes() {
    for (const flash of state.flashes) {
      const opacity=clamp(flash.time*7,0,1);
      if (flash.type==="shot") {
        ctx.strokeStyle=flash.hostile?"rgba(224,102,74,"+opacity+")":"rgba(242,211,125,"+opacity+")";
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(flash.x,flash.y);
        ctx.lineTo(flash.tx,flash.ty);
        ctx.stroke();
      } else {
        ctx.strokeStyle="rgba(229,198,113,"+opacity+")";
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(flash.x,flash.y,13+(1-opacity)*32,0,TAU);
        ctx.stroke();
      }
    }
  }
  function objectiveText() {
    if (!relay.done) return "1/3  CUT THE SIGNAL RELAY";
    if (!ledger.done) return "2/3  TAKE THE LEDGER";
    return "3/3  LEAVE BY WEST GATE";
  }
  function drawHud() {
    ctx.fillStyle=color.ui;
    ctx.fillRect(0,0,W,38);
    ctx.fillStyle="#141610";
    ctx.fillRect(0,674,W,46);
    ctx.strokeStyle=color.line;
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(0,38);
    ctx.lineTo(W,38);
    ctx.moveTo(0,674);
    ctx.lineTo(W,674);
    ctx.stroke();
    ctx.fillStyle=color.paper;
    ctx.font="700 16px Georgia";
    ctx.textAlign="left";
    ctx.fillText("DUST",22,24);
    ctx.fillStyle=color.amber;
    ctx.fillText("&",69,24);
    ctx.fillStyle=color.paper;
    ctx.fillText("IRON",85,24);
    ctx.fillStyle=color.muted;
    ctx.font="700 10px Courier New";
    ctx.fillText("OVERHEAD TACTICAL MAP",150,23);
    ctx.textAlign="center";
    ctx.fillStyle=color.gold;
    ctx.fillText(objectiveText(),W/2,23);
    ctx.textAlign="right";
    ctx.fillStyle=color.muted;
    ctx.fillText("TIME "+timeText(state.elapsed),W-24,17);
    ctx.fillText("ALARM",W-161,31);
    for (let index=0;index<10;index+=1) {
      ctx.fillStyle=state.alarm>=(index+1)*10?(index>6?color.red:color.amber):"#35392d";
      ctx.fillRect(W-110+index*8,25,6,7);
    }
    ctx.textAlign="left";
    ctx.fillStyle=state.paused?color.gold:color.green;
    ctx.font="700 10px Courier New";
    ctx.fillText(state.paused?"PLAN MODE":"LIVE",22,697);
    ctx.fillStyle=color.paper;
    ctx.font="10px Courier New";
    const mode=state.ability?"SKILL ARMED — CLICK VALID TARGET":state.attack?"FIRE ARMED — CLICK GUARD":state.message;
    ctx.fillText(mode.slice(0,136),22,712);
    ctx.textAlign="right";
    ctx.fillStyle=color.muted;
    ctx.fillText("CLICK MOVE · DBL CLICK RUN · A ALL · F FIRE · Q SKILL · E USE · SPACE PLAN",W-22,705);
  }
  function draw() {
    drawGround();
    drawBrush();
    drawExit();
    for (const item of solids) drawSolid(item);
    drawObjective(relay,"SIGNAL RELAY",relay.done,!relay.done);
    drawObjective(ledger,"PAYMASTER LEDGER",ledger.done,relay.done&&!ledger.done);
    for (const guard of guards) drawVision(guard);
    const actors=[...guards,...heroes].sort((a,b) => a.y-b.y);
    for (const actor of actors) drawActor(actor,actor.team==="hero" && state.selection.has(heroes.indexOf(actor)));
    drawFlashes();
    if (state.pointer.x>MAP.l && state.pointer.x<MAP.r && state.pointer.y>MAP.t && state.pointer.y<MAP.b) {
      ctx.strokeStyle="rgba(235,215,157,.45)";
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.arc(state.pointer.x,state.pointer.y,8,0,TAU);
      ctx.stroke();
    }
    drawHud();
  }

  function updateRoster() {
    const alive=heroes.filter((hero) => !hero.down).length;
    let html='<button type="button" class="squad-card '+(state.selection.size===alive?"active":"")+'" data-all="1"><strong>ALL HANDS <span class="card-key">A</span></strong><span>'+alive+'/3 READY · FORMATION</span></button>';
    heroes.forEach((hero,index) => {
      const classes=["character-card",state.selection.has(index)?"active":"",state.focus===index?"focus":"",hero.down?"down":"",hero.health<hero.maxHealth?"wounded":""].filter(Boolean).join(" ");
      html+='<button type="button" class="'+classes+'" data-hero="'+index+'" style="--hero-color:'+hero.hat+';--skin:'+hero.skin+';--coat:'+hero.coat+'"><span class="portrait"><i class="hat"></i><i class="face"></i><i class="coat"></i></span><span class="card-copy"><strong>'+hero.name+'</strong><span>'+hero.role+" · "+weapon[hero.weapon].label+" · "+hero.health+"/"+hero.maxHealth+'</span></span><span class="card-key">'+hero.key+"</span></button>";
    });
    rosterEl.innerHTML=html;
  }
  function updateDom(force=false) {
    const hero=heroes[state.focus];
    if (force || state.messageTime>0) instruction.textContent=state.ability?(hero?hero.skill:"Skill")+" armed — click its valid target.":state.attack?"Fire armed — click a guard in clear weapon range.":state.message;
    pauseLabel.textContent=state.paused?"PLAN MODE":"LIVE";
    pauseLabel.style.color=state.paused?"#d8af51":"#9abb79";
    statusText.textContent="MAP: MESA JUNCTION / OVERHEAD · "+objectiveText();
    updateRoster();
  }
  function pointer(event) {
    const rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*W/rect.width,y:(event.clientY-rect.top)*H/rect.height};
  }
  canvas.addEventListener("pointermove",(event) => { state.pointer=pointer(event); });
  canvas.addEventListener("pointerdown",(event) => {
    if (!state.started || state.won || state.lost) return;
    event.preventDefault();
    mapClick(pointer(event),false);
    canvas.focus({preventScroll:true});
  });
  canvas.addEventListener("dblclick",(event) => {
    if (!state.started || state.won || state.lost || state.ability || state.attack) return;
    event.preventDefault();
    const point=pointer(event);
    if (terrainOpen(point.x,point.y,3)) order(point,true);
  });
  rosterEl.addEventListener("click",(event) => {
    const button=event.target.closest("button");
    if (!button || !state.started) return;
    if (button.dataset.all) {
      state.selection=new Set(heroes.map((hero,index) => hero.down?null:index).filter((index) => index!==null));
      state.focus=[...state.selection][0]||0;
      message("All hands selected. Click ground for a spaced formation.");
    } else if (button.dataset.hero !== undefined) {
      const index=Number(button.dataset.hero);
      if (!heroes[index].down) {
        state.selection=new Set([index]);
        state.focus=index;
        message(heroes[index].name+" selected.");
      }
    }
    updateDom();
  });
  document.addEventListener("keydown",(event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const key=event.key.toLowerCase();
    if (!state.started && (key==="enter" || key===" ")) {
      event.preventDefault();
      begin();
      return;
    }
    if (!state.started) return;
    if (key==="a") {
      event.preventDefault();
      state.selection=new Set(heroes.map((hero,index) => hero.down?null:index).filter((index) => index!==null));
      state.focus=[...state.selection][0]||0;
      message("All hands selected. Formation movement is active.");
    } else if (key>="1" && key<="3") {
      event.preventDefault();
      const index=Number(key)-1;
      if (!heroes[index].down) {
        state.selection=new Set([index]);
        state.focus=index;
        message(heroes[index].name+" selected.");
      }
    } else if (key==="f") {
      event.preventDefault();
      state.attack=!state.attack;
      state.ability=false;
      message(state.attack?"Fire armed — click a guard in clear range.":"Fire cancelled.");
    } else if (key==="q") {
      event.preventDefault();
      state.attack=false;
      skill(state.pointer);
    } else if (key==="e") {
      event.preventDefault();
      interact();
    } else if (key==="x") {
      event.preventDefault();
      const selected=[...state.selection].map((index) => heroes[index]).filter((hero) => hero&&!hero.down);
      const crouch=!selected.every((hero) => hero.stance==="crouch");
      selected.forEach((hero) => { hero.stance=crouch?"crouch":"stand"; });
      message(crouch?"Crouch order. Brush now hides the crew more effectively.":"Stand order.");
    } else if (key===" ") {
      event.preventDefault();
      state.paused=!state.paused;
      message(state.paused?"Plan mode. The yard is frozen.":"Live. The yard is moving again.",2);
    } else if (key==="r") {
      event.preventDefault();
      reset(true);
    }
    updateDom();
  });
  startButton.addEventListener("click",begin);
  restartButton.addEventListener("click",() => {
    reset(true);
    outcome.classList.add("hidden");
    canvas.focus({preventScroll:true});
  });
  function frame(now) {
    const dt=Math.min(.05,Math.max(0,(now-lastTime)/1000||0));
    lastTime=now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  reset(false);
  requestAnimationFrame(frame);
})();
