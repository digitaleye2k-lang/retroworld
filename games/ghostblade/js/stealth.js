// GHOSTBLADE - environment (time, weather), light, noise, concealment and social stealth
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T, W = GB.world;

  const env = GB.env = {
    time: 9, weather: 'clear', locked: false, flash: 0, nextBolt: 8, rain: 0, fog: 0, dayLen: 540,
    set(time, weather, locked) { env.time = time; env.weather = weather || 'clear'; env.locked = !!locked; },
    dayLight() {
      let l = U.clamp(0.55 + 0.7 * Math.cos((env.time - 13) / 12 * Math.PI), 0.1, 1);
      if (env.weather === 'storm') l *= 0.72; else if (env.weather !== 'clear') l *= 0.88;
      return Math.min(1, l + env.flash * 0.8);
    },
    night() { return env.dayLight() < 0.45; },
    update(dt) {
      if (!env.locked) { env.time += dt * 24 / env.dayLen; if (env.time >= 24) { env.time -= 24; env.rollWeather(); } if (Math.random() < dt / 150) env.rollWeather(); }
      const wr = env.weather === 'rain' ? 0.7 : env.weather === 'storm' ? 1 : 0, wf = env.weather === 'fog' ? 1 : env.weather === 'storm' ? 0.25 : 0;
      env.rain = U.approach(env.rain, wr, dt * 0.25); env.fog = U.approach(env.fog, wf, dt * 0.2);
      env.flash = Math.max(0, env.flash - dt * 2.5);
      if (env.weather === 'storm') { env.nextBolt -= dt; if (env.nextBolt <= 0) { env.nextBolt = U.rand(5, 14); env.flash = 1; env.thunderT = 1.8; if (GB.audio && GB.audio.stinger) setTimeout(() => GB.audio.stinger('thunder'), 350); } }
      env.thunderT = Math.max(0, (env.thunderT || 0) - dt);
    },
    rollWeather() { if (env.locked) return; const r = Math.random(); env.weather = r < 0.55 ? 'clear' : r < 0.75 ? 'rain' : r < 0.9 ? 'fog' : 'storm'; },
    visionMul() { return 1 - 0.3 * env.fog - 0.15 * env.rain; },
    noiseMul() { return (1 - 0.3 * env.rain) * (env.thunderT > 0 ? 0.35 : 1); }
  };

  const S = GB.stealth = {
    rings: [], smokes: [],
    reset() { S.rings.length = 0; S.smokes.length = 0; S.recentKill = 0; },
    noise(x, y, r, kind) {
      r *= env.noiseMul(); if (r < 8) return;
      if (r > 30) S.rings.push({ x, y, r, t: 0, kind });
      // everyday movement in public streets is not suspicious to the ear
      const z = W.zoneAt(x, y - 20); if ((!z || z.safe) && r < 240 && (kind === 'step' || kind === 'jump' || kind === 'land' || kind === 'slide' || kind === 'door' || kind === 'wallrun') && !W.indoorAt(x, y - 20)) return;
      const gs = GB.ai ? GB.ai.guards : [];
      for (const g of gs) {
        if (g.dead || g.sleepT > 0) continue;
        const d = U.dist(x, y, g.x, g.y - 30); if (d > r) continue;
        if (d > r * 0.55 && !W.los(x, y - 20, g.x, g.y - 34)) continue;
        GB.ai.hear(g, x, y, kind, r);
      }
      if (GB.ai && (kind === 'clash' || kind === 'glass' || kind === 'flash')) GB.ai.scareCivs(x, y, r * 0.7);
    },
    softSpotAt(x, y) { for (const h of W.hides) if ((h.type === 'hay' || h.type === 'cart') && Math.abs(x - h.x) < h.w / 2 + 8 && Math.abs(y - h.y) < 30) return h; return null; },
    spotNear(x, y, range) { let best = null, bd = range || 30; for (const h of W.hides) { if (h.type === 'grass') continue; const d = Math.abs(x - h.x); if (d < bd + h.w / 2 - 10 && Math.abs(y - h.y) < 26) { if (d < bd + h.w) { best = h; bd = d; } } } return best; },
    lightAt(x, y) {
      let l = W.indoorAt(x, y - 20) ? (y > (W.G + 1) * T ? 0.07 : 0.15 + 0.12 * env.dayLight()) : env.dayLight();
      if (l >= 1) return 1;
      const night = env.dayLight() < 0.62;
      const add = L => {
        if (!L.on || (L.kind === 'lamp' && !night)) return;
        const dx = L.x - x, dy = L.y - (y - 22); if (Math.abs(dx) > L.r || Math.abs(dy) > L.r) return;
        const d = Math.hypot(dx, dy); if (d >= L.r) return;
        if (!W.los(L.x, L.y, x, y - 22)) return;
        l += L.int * Math.pow(1 - d / L.r, 1.4);
      };
      for (const L of W.lights) add(L);
      if (GB.ai) for (const L of GB.ai.dynLights) add(L);
      return Math.min(1, l);
    },
    inSmoke(x, y) { for (const s of S.smokes) if (U.dist(x, y, s.x, s.y) < s.r) return true; return false; },
    losClear(x0, y0, x1, y1) {
      if (!W.los(x0, y0, x1, y1)) return false;
      for (const s of S.smokes) { // segment vs circle
        const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1; let t = ((s.x - x0) * dx + (s.y - y0) * dy) / l2; t = U.clamp(t, 0, 1);
        if (U.dist(x0 + dx * t, y0 + dy * t, s.x, s.y) < s.r * 0.85) return false;
      }
      return true;
    },
    // how suspicious the player looks to a guard who is not already hunting them (0 = ordinary citizen)
    suspicion(g, d) {
      const P = GB.player, zone = S.zone;
      S.soft = false;
      if (g && g.train) return 1;
      if (P.carrying) return 1.6;
      if (S.recentKill > 0) return 1.5;
      if (zone && !zone.safe) {
        if (GB.save.outfit === 'tabard' && d > 110 && !P.sprinting && P.state === 'ground' && !P.crouch) return 0.3;
        return 1;
      }
      if (S.zone && S.zone.safe) return 0;
      if (g && g.thug) return 0;
      if (P.blended) return 0;
      let s = 0; const noble = GB.save.outfit === 'noble';
      const nl = GB.prog.notorietyLevel(); if (nl > 0 && d < 70 + nl * 25) s += 0.09 * nl;
      if (P.sprinting) s += noble ? 0.2 : 0.45;
      if (P.state === 'climb' || P.state === 'hang' || P.state === 'pullup' || P.state === 'swing' || P.state === 'zip') s += 0.6;
      else if (S.onRoof) s += noble ? 0.25 : 0.4;
      if (P.crouch && P.state === 'ground') s += noble ? 0.15 : 0.3;
      if (P.drawn) s += 0.7;
      if (P.attackT > 0) s += 1;
      S.soft = s < 0.5 && nl < 3; // merely odd behaviour: guards come and look, they do not draw steel
      return s;
    },
    update(dt) {
      const P = GB.player;
      S.recentKill = Math.max(0, (S.recentKill || 0) - dt);
      for (let i = S.rings.length - 1; i >= 0; i--) { S.rings[i].t += dt; if (S.rings[i].t > 0.7) S.rings.splice(i, 1); }
      for (let i = S.smokes.length - 1; i >= 0; i--) { const s = S.smokes[i]; s.t += dt; s.r = Math.min(s.max, s.r + 260 * dt); if (s.t > s.life) S.smokes.splice(i, 1); }
      S.lightT = (S.lightT || 0) - dt;
      if (S.lightT <= 0) { S.lightT = 0.08; let l = S.lightAt(P.x, P.y); if (GB.save.outfit === 'shadow' && l < 0.4) l *= 0.75; P.light = U.lerp(P.light, l, 0.5); }
      S.zone = W.zoneAt(P.x, P.y - 20);
      S.onRoof = !W.indoorAt(P.x, P.y - 20) && P.y < (W.G - 3) * T;
      S.hbT = (S.hbT || 0) - dt; const mm = GB.ai ? GB.ai.maxMeter : 0;
      if (mm > 0.25 && GB.ai.combatCount === 0 && S.hbT <= 0) { S.hbT = U.lerp(0.9, 0.4, mm); GB.sfx('heartbeat', { vol: 0.3 + 0.6 * mm, rate: 0.9 + 0.3 * mm }); }
      // concealment in grass / bushes while crouched
      P.concealed = false;
      if (P.crouch && P.state === 'ground') for (const h of W.hides) if ((h.type === 'grass' || h.type === 'bush') && Math.abs(P.x - h.x) < h.w / 2 && Math.abs(P.y - h.y) < 12) { P.concealed = true; break; }
      // social stealth
      let blend = false;
      if (P.state === 'sit') blend = true;
      else if (P.state === 'ground' && !P.sprinting && !P.crouch && !P.drawn && !P.carrying && GB.ai) {
        const rad = GB.has('g4') ? 78 : 50;
        for (const c of GB.ai.crowds) if (c.calm && Math.abs(P.x - c.x) < rad && Math.abs(P.y - c.y) < 20) { blend = true; break; }
        if (!blend) { let n = 0; for (const c of GB.ai.civs) if (!(c.flee > 0) && Math.abs(c.x - P.x) < 34 && Math.abs(c.y - P.y) < 16) n++; if (n >= 2) blend = true; }
      }
      if (blend) S.blendHold = GB.has('g4') ? 1.2 : 0.35; else S.blendHold = Math.max(0, (S.blendHold || 0) - dt);
      P.blended = blend || (S.blendHold > 0 && P.state === 'ground' && !P.sprinting && !P.crouch);
    }
  };
})();
