// GHOSTBLADE - in-game HUD, minimap, world map
(function () {
  'use strict';
  const GB = window.GB, U = GB.util, T = GB.T, W = GB.world, P = GB.player, I = GB.input;
  let mini = null;
  function buildMini() {
    mini = document.createElement('canvas'); mini.width = W.w; mini.height = W.h; const c = mini.getContext('2d'), img = c.createImageData(W.w, W.h), d = img.data;
    for (let i = 0; i < W.w * W.h; i++) {
      const t = W.tiles[i], y = Math.floor(i / W.w); let r = 0, g = 0, b = 0, a = 0;
      if (t === W.SOLID || t === W.SMOOTH) { if (y >= W.G) { r = 46; g = 42; b = 40; } else { r = 150; g = 146; b = 140; } a = 255; }
      else if (t === W.FACADE) { r = 92; g = 86; b = 80; a = 255; } else if (t === W.PLAT) { r = 176; g = 150; b = 110; a = 255; }
      else if (t === W.WATER) { r = 44; g = 86; b = 126; a = 255; } else if (t === W.LADDER) { r = 150; g = 110; b = 60; a = 255; } else if (y > W.G) { r = 22; g = 20; b = 22; a = 255; }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = a;
    }
    c.putImageData(img, 0, 0);
  }
  const bar = (ctx, x, y, w, h, k, col, back) => { ctx.fillStyle = back || 'rgba(8,8,12,0.6)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * U.clamp(k, 0, 1)), h - 2); };
  const text = (ctx, s, x, y, size, col, align, font) => { ctx.font = (font || '600 ') + size + 'px "Palatino Linotype", Georgia, serif'; ctx.textAlign = align || 'left'; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = col || '#e8e2d0'; ctx.fillText(s, x, y); };

  const H = GB.hud = {
    districtT: 0, lastDistrict: null, hintT: 0,
    status() {
      if (P.state === 'hidden') return ['HIDDEN', '#7fd6c2'];
      if (GB.ai.combatCount > 0) return ['DETECTED', '#ff4638'];
      if (GB.ai.alertLevel >= 3) return ['HUNTED', '#ff8232'];
      if (GB.ai.maxMeter > 0.3) return ['SUSPICIOUS', '#ffcd46'];
      if (P.blended) return ['BLENDED', '#7fd6c2'];
      if (P.concealed) return ['CONCEALED', '#7fd6c2'];
      const z = GB.stealth.zone; if (z && !z.safe) return ['TRESPASSING', '#ff8232'];
      if (P.light < 0.3) return ['IN SHADOW', '#8fa6c8'];
      return ['ANONYMOUS', '#c9cfd6'];
    },
    // markers drawn in world space (after lighting)
    world(ctx) {
      if (GB.game.state !== 'play') return;
      const k = GB.combat.killTarget;
      if (k && !P.busy()) { const g = k.g, y = g.y - 24; ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.3 * Math.sin(GB.time * 8)) + ')'; ctx.lineWidth = 1.5; const s = 13; ctx.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(g.x + a * s, y + b * (s + 8) - b * 6); ctx.lineTo(g.x + a * s, y + b * (s + 8)); ctx.lineTo(g.x + a * s - a * 6, y + b * (s + 8)); } ctx.stroke(); }
      const m = GB.missions.marker();
      if (m) { const y = m.y - 60 + Math.sin(GB.time * 3) * 4; ctx.fillStyle = 'rgba(230,195,90,0.95)'; ctx.beginPath(); ctx.moveTo(m.x, y + 12); ctx.lineTo(m.x - 8, y); ctx.lineTo(m.x, y - 12); ctx.lineTo(m.x + 8, y); ctx.fill(); if (m.rect) { ctx.strokeStyle = 'rgba(230,195,90,0.35)'; ctx.setLineDash([6, 6]); ctx.strokeRect(m.rect.x0, m.rect.y0, m.rect.x1 - m.rect.x0, m.rect.y1 - m.rect.y0); ctx.setLineDash([]); } }
      for (const s of GB.missions.starts()) { const y = s.y - 70 + Math.sin(GB.time * 2.4 + s.x) * 4; ctx.strokeStyle = 'rgba(230,195,90,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, y + 13); ctx.lineTo(s.x - 9, y); ctx.lineTo(s.x, y - 13); ctx.lineTo(s.x + 9, y); ctx.closePath(); ctx.stroke(); ctx.font = '600 11px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,195,90,0.95)'; ctx.fillText(String(s.id), s.x, y + 4); }
      for (const v of W.viewpoints) if (!GB.save.viewpoints[v.id] && Math.abs(v.x - P.x) < 900) { ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.25 * Math.sin(GB.time * 2)) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(v.x, v.y - 24, 14 + Math.sin(GB.time * 2) * 3, 0, 7); ctx.stroke(); }
      // gadget aim line
      if (!P.busy() && (I.isDown('gadget') || GB.save.gadget === 'rope' || (GB.touch && GB.touch.aiming)) && GB.save.gadget && GB.combat.ammo[GB.save.gadget] > 0 && GB.save.gadget !== 'decoy') {
        const mw = GB.cam.toWorld(I.mouse.x, I.mouse.y); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, P.y - P.h * 0.75);
        if (GB.save.gadget === 'rope') { const a = Math.atan2(mw.y - (P.y - 30), mw.x - P.x), d = Math.min(360, W.ray(P.x, P.y - 30, a, 360)); ctx.lineTo(P.x + Math.cos(a) * d, P.y - 30 + Math.sin(a) * d); } else ctx.lineTo(mw.x, mw.y);
        ctx.stroke(); ctx.setLineDash([]);
      }
    },
    draw(ctx, CW, CH, DPR) {
      if (GB.game.state !== 'play' || GB.game.cinematic || GB.ui.isOpen()) return;
      const u = CH / 720; ctx.setTransform(u, 0, 0, u, 0, 0); const VW = CW / u, VH = 720;
      if (!mini) buildMini();
      // --- vitals ---
      bar(ctx, 24, 22, 190, 12, P.hp / P.maxHp(), P.hp < 30 ? '#d9413a' : '#c9cfd6');
      bar(ctx, 24, 38, 150, 7, P.stamina / P.maxSta(), '#e6c35a');
      const st = H.status();
      // eye + light gem
      const ex = 42, ey = 72, open = st[0] === 'DETECTED' ? 1 : U.clamp(GB.ai.maxMeter * 1.2 + (st[0] === 'HIDDEN' ? 0 : 0.25), 0.08, 1);
      ctx.strokeStyle = st[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 16, ey); ctx.quadraticCurveTo(ex, ey - 13 * open, ex + 16, ey); ctx.quadraticCurveTo(ex, ey + 13 * open, ex - 16, ey); ctx.stroke();
      ctx.fillStyle = st[1]; ctx.beginPath(); ctx.arc(ex, ey, 4.5 * Math.min(1, open + 0.2), 0, 7); ctx.fill();
      text(ctx, st[0], 66, 77, 13, st[1]);
      bar(ctx, 24, 90, 110, 5, P.light, 'rgb(' + (120 + 135 * P.light | 0) + ',' + (130 + 110 * P.light | 0) + ',' + (170 + 40 * P.light | 0) + ')');
      text(ctx, 'LIGHT', 140, 96, 9, 'rgba(200,205,215,0.7)');
      const z = GB.stealth.zone; if (z && !z.safe) text(ctx, 'RESTRICTED  -  ' + z.name.toUpperCase(), 24, 116, 10, '#ff8232');
      // notoriety
      const nl = GB.prog.notorietyLevel(); if (GB.save.notoriety > 0) { text(ctx, 'NOTORIETY', 24, 134, 9, 'rgba(200,205,215,0.7)'); for (let i = 0; i < 4; i++) { ctx.fillStyle = i < nl ? '#d9413a' : 'rgba(255,255,255,0.18)'; ctx.fillRect(86 + i * 12, 127, 9, 7); } bar(ctx, 86, 136, 45, 3, (GB.save.notoriety % 20) / 20, '#d9413a'); }
      // --- detection arcs ---
      const sp = GB.cam.toScreen(P.x, P.y - 26), cx = sp.x * DPR / u, cy = sp.y * DPR / u;
      for (const g of GB.ai.guards) {
        if (g.dead || (g.meter < 0.04 && g.state !== 'combat')) continue; if (Math.abs(g.x - P.x) > 900) continue;
        const a = Math.atan2(g.y - P.y, g.x - P.x), m = g.state === 'combat' ? 1 : g.meter, r = 64;
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r, a - 0.32, a + 0.32); ctx.stroke();
        ctx.strokeStyle = g.state === 'combat' ? '#ff4638' : m > 0.62 ? '#ff8232' : '#ffcd46'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r, a - 0.32 * m, a + 0.32 * m); ctx.stroke();
      }
      // --- compass ---
      const cw = U.clamp(VW - 560, 160, 360), cx0 = VW / 2 - cw / 2; ctx.fillStyle = 'rgba(8,8,12,0.42)'; ctx.fillRect(cx0, 18, cw, 20); ctx.fillStyle = 'rgba(230,195,90,0.9)'; ctx.fillRect(VW / 2 - 0.5, 16, 1, 24);
      const mark = (wx, col, glyph) => { const dx = U.clamp((wx - P.x) / 2600, -1, 1); const x = VW / 2 + dx * (cw / 2 - 8); text(ctx, glyph, x, 33, 13, col, 'center'); };
      for (const d of W.districts) { const mx = (d.x0 + d.x1) / 2 * T; if (Math.abs(mx - P.x) > 300) mark(mx, 'rgba(200,205,215,0.45)', d.name.replace('The ', '').slice(0, 3).toUpperCase()); }
      for (const v of W.viewpoints) if (!GB.save.viewpoints[v.id]) mark(v.x, 'rgba(255,255,255,0.8)', '△');
      const mm = GB.missions.marker(); if (mm) mark(mm.x, '#e6c35a', '◆' + (Math.abs(mm.y - P.y) > 90 ? (mm.y < P.y ? '↑' : '↓') : ''));
      // --- objectives ---
      const info = GB.missions.hud(); let oy = 30;
      if (info) {
        text(ctx, info.title.toUpperCase(), VW - 24, oy, 13, '#e6c35a', 'right'); oy += 20;
        for (const l of info.lines) { text(ctx, l.text, VW - 24, oy, 13, l.done ? 'rgba(200,205,215,0.45)' : '#e8e2d0', 'right', l.done ? 'italic 400 ' : '400 '); oy += 18; }
        if (info.timer !== undefined) { text(ctx, U.fmtTime(info.timer), VW - 24, oy + 6, 20, info.timerWarn ? '#ff4638' : '#e8e2d0', 'right'); oy += 28; }
        for (const c of info.challenges || []) { text(ctx, (c.failed ? '✕ ' : '◇ ') + c.text, VW - 24, oy + 4, 10, c.failed ? 'rgba(217,65,58,0.7)' : 'rgba(200,205,215,0.6)', 'right', '400 '); oy += 14; }
      } else { const d = W.districtAt(P.x); text(ctx, (W.underground(P.y) && GB.stealth.zone && GB.stealth.zone.id === 'hq' ? 'The Hidden District' : W.underground(P.y) ? 'The Undercity' : d.name).toUpperCase(), VW - 24, oy, 12, 'rgba(200,205,215,0.7)', 'right'); oy += 18; text(ctx, 'Free roam  -  ' + I.keyLabel('map') + ': map', VW - 24, oy, 10, 'rgba(200,205,215,0.45)', 'right', '400 '); }
      // --- gear ---
      const wdef = GB.defs.byId(GB.defs.weapons, GB.save.weapon), gdef = GB.defs.byId(GB.defs.gadgets, GB.save.gadget);
      ctx.fillStyle = 'rgba(8,8,12,0.45)'; ctx.fillRect(24, VH - 74, 210, 50);
      text(ctx, I.keyLabel('weapon'), 32, VH - 56, 9, 'rgba(200,205,215,0.55)'); text(ctx, wdef ? wdef.name : '-', 32, VH - 40, 14, P.drawn ? '#ff8232' : '#e8e2d0');
      text(ctx, I.keyLabel('gadget'), 134, VH - 56, 9, 'rgba(200,205,215,0.55)');
      if (gdef) { const am = GB.combat.ammo[gdef.id] || 0; text(ctx, gdef.name, 134, VH - 40, 12, am > 0 ? '#e8e2d0' : 'rgba(200,205,215,0.4)'); for (let i = 0; i < GB.prog.gadgetCap(gdef.id); i++) { ctx.fillStyle = i < am ? '#e6c35a' : 'rgba(255,255,255,0.16)'; ctx.fillRect(134 + i * 7, VH - 34, 5, 5); } }
      text(ctx, GB.save.coins + ' florins', 32, VH - 82, 11, '#e6c35a');
      // --- minimap ---
      const tch = GB.touch && GB.touch.on, mw = tch ? 150 : 176, mh = tch ? 88 : 104, mx = tch ? 24 : VW - mw - 24, my = tch ? 150 : VH - mh - 24, sc = 2, tx = P.x / T, ty = P.y / T;
      ctx.fillStyle = 'rgba(8,8,12,0.62)'; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
      ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip(); ctx.imageSmoothingEnabled = false;
      const ox = mx + mw / 2 - tx * sc, oy2 = my + mh / 2 - (ty - 6) * sc; ctx.globalAlpha = 0.85; ctx.drawImage(mini, ox, oy2, W.w * sc, W.h * sc); ctx.globalAlpha = 1;
      for (const zn of W.zones) if (!zn.safe) { ctx.strokeStyle = 'rgba(217,65,58,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(ox + zn.x0 / T * sc, oy2 + zn.y0 / T * sc, (zn.x1 - zn.x0) / T * sc, (zn.y1 - zn.y0) / T * sc); }
      for (const g of GB.ai.guards) { if (g.dead || Math.abs(g.x - P.x) > 700 || Math.abs(g.y - P.y) > 420) continue; ctx.fillStyle = g.state === 'combat' ? '#ff4638' : g.state === 'unaware' ? '#d98a80' : '#ffcd46'; ctx.fillRect(ox + g.x / T * sc - 1.5, oy2 + (g.y - 24) / T * sc - 1.5, 3, 3); }
      if (mm) { ctx.fillStyle = '#e6c35a'; const qx = U.clamp(ox + mm.x / T * sc, mx + 4, mx + mw - 4), qy = U.clamp(oy2 + mm.y / T * sc - 3, my + 4, my + mh - 4); ctx.beginPath(); ctx.moveTo(qx, qy - 4); ctx.lineTo(qx + 4, qy); ctx.lineTo(qx, qy + 4); ctx.lineTo(qx - 4, qy); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + mw / 2, my + mh / 2 + 6 * sc - 2, 2.6, 0, 7); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(230,195,90,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(mx - 2, my - 2, mw + 4, mh + 4);
      const hr = Math.floor(GB.env.time), mn = Math.floor((GB.env.time % 1) * 60); text(ctx, String(hr).padStart(2, '0') + ':' + String(mn).padStart(2, '0') + (GB.env.weather !== 'clear' ? '  ' + GB.env.weather : ''), mx + mw, my - 8, 10, 'rgba(200,205,215,0.6)', 'right', '400 ');
      // --- prompts ---
      let py = VH - 120;
      const pr = GB.combat.prompt; if (pr) { promptBox(ctx, VW / 2, py, pr.key, pr.label); py -= 30; }
      const k = GB.combat.killTarget; if (k && !P.busy()) { promptBox(ctx, VW / 2, py, I.keyLabel('assassinate'), ({ air: 'Air Assassinate', ledge: 'Ledge Assassinate', hide: 'Assassinate from cover', chain: 'Chain Assassinate', informant: 'Silence informant' })[k.method] || 'Assassinate', '#ff6a5c'); py -= 30; }
      if (P.state === 'hang') { text(ctx, I.keyLabel('up') + ' climb up    ' + I.keyLabel('down') + ' drop' + (P.hang.kind === 'bar' ? '    ' + I.keyLabel('left') + '/' + I.keyLabel('right') + ' shimmy' : '    ' + I.keyLabel('jump') + ' + away: wall jump'), VW / 2, py, 11, 'rgba(200,205,215,0.6)', 'center', '400 '); }
      if (H.hint && H.hintT > 0) { H.hintT -= 1 / 60; ctx.globalAlpha = Math.min(1, H.hintT); const w = Math.min(VW - 80, 720); ctx.fillStyle = 'rgba(8,8,12,0.7)'; ctx.fillRect(VW / 2 - w / 2, VH - 214, w, 34); ctx.fillStyle = 'rgba(230,195,90,0.8)'; ctx.fillRect(VW / 2 - w / 2, VH - 214, 2, 34); text(ctx, H.hint, VW / 2, VH - 192, 14, '#e8e2d0', 'center', '400 '); ctx.globalAlpha = 1; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    setHint(t, secs) { H.hint = t; H.hintT = secs || 6; },

    drawWorldMap(canvas) {
      if (!mini) buildMini();
      const c = canvas.getContext('2d'), cw = canvas.width, ch = canvas.height; c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#0c0c10'; c.fillRect(0, 0, cw, ch);
      const s = Math.min(cw / (W.w + 20), ch / (W.h * 2.6 + 60)), vs = 2.6, ox = (cw - W.w * s) / 2, oy = (ch - W.h * s * vs) / 2 + 8 * s;
      c.imageSmoothingEnabled = false; c.drawImage(mini, ox, oy, W.w * s, W.h * s * vs);
      const X = x => ox + x / T * s, Y = y => oy + y / T * s * vs, fs = Math.max(11, s * 9);
      c.textAlign = 'center';
      for (const d of W.districts) {
        const vp = W.viewpoints.filter(v => v.x / T >= d.x0 && v.x / T < d.x1), known = vp.length === 0 || vp.some(v => GB.save.viewpoints[v.id]);
        if (!known) { c.fillStyle = 'rgba(8,8,12,0.72)'; c.fillRect(ox + d.x0 * s, oy, (d.x1 - d.x0) * s, W.G * s * vs); }
        c.fillStyle = known ? '#e6c35a' : 'rgba(200,205,215,0.4)'; c.font = '600 ' + fs + 'px "Palatino Linotype", Georgia, serif'; c.fillText(d.name.toUpperCase(), ox + (d.x0 + d.x1) / 2 * s, oy - 3 * s);
        c.fillStyle = 'rgba(230,195,90,0.25)'; c.fillRect(ox + d.x1 * s, oy - 8 * s, 1, (W.G * vs + 8) * s);
        d._known = known;
      }
      c.fillStyle = 'rgba(127,214,194,0.9)'; c.font = '600 ' + fs * 0.8 + 'px Georgia'; c.fillText('THE HIDDEN DISTRICT', X(253 * T), Y(80 * T));
      for (const z of W.zones) { c.strokeStyle = z.safe ? 'rgba(127,214,194,0.8)' : 'rgba(217,65,58,0.75)'; c.lineWidth = Math.max(1, s * 0.4); c.strokeRect(X(z.x0), Y(z.y0), (z.x1 - z.x0) / T * s, (z.y1 - z.y0) / T * s * vs); }
      const dot = (x, y, col, r, ring) => { c.beginPath(); c.arc(X(x), Y(y), r * s, 0, 7); if (ring) { c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.5); c.stroke(); } else { c.fillStyle = col; c.fill(); } };
      for (const v of W.viewpoints) dot(v.x, v.y, '#ffffff', 2.2, !GB.save.viewpoints[v.id]);
      for (const r of W.relics) if (!GB.save.relics[r.id] && W.districtAt(r.x)._known) dot(r.x, r.y, '#fff3c4', 1);
      for (const ch2 of W.chests) if (!GB.save.chests[ch2.id] && W.districtAt(ch2.x)._known) dot(ch2.x, ch2.y, '#c98a3a', 1.2);
      for (const m of GB.missions.starts(true)) { c.fillStyle = m.done ? 'rgba(230,195,90,0.45)' : '#e6c35a'; const x = X(m.x), y = Y(m.y) - 4 * s, r = 2.6 * s; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.fill(); c.fillStyle = '#0c0c10'; c.font = '700 ' + r * 1.2 + 'px Georgia'; c.fillText(String(m.id), x, y + r * 0.42); }
      const hq = W.marks.find(m => m.id === 'mentor'); dot(hq.x, hq.y - 30, '#7fd6c2', 2);
      c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, s * 0.6); c.beginPath(); c.arc(X(P.x), Y(P.y - 20), 3 * s, 0, 7); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(X(P.x), Y(P.y - 20), 1.2 * s, 0, 7); c.fill();
      c.textAlign = 'left'; c.fillStyle = 'rgba(200,205,215,0.7)'; c.font = '400 ' + fs * 0.75 + 'px Georgia';
      c.fillText('Viewpoints ' + Object.keys(GB.save.viewpoints).length + '/' + W.viewpoints.length + '    Ghost Feathers ' + Object.keys(GB.save.relics).length + '/' + W.relics.length + '    Treasures ' + Object.keys(GB.save.chests).length + '/' + W.chests.length + '    Notoriety ' + Math.round(GB.save.notoriety) + '%', ox, oy + (W.h * vs + 10) * s);
    }
  };
  function promptBox(ctx, x, y, key, label, col) {
    ctx.font = '600 14px "Palatino Linotype", Georgia, serif'; const w = ctx.measureText(label).width + 52; ctx.fillStyle = 'rgba(8,8,12,0.7)'; ctx.fillRect(x - w / 2, y - 17, w, 24);
    ctx.fillStyle = col || '#e6c35a'; ctx.fillRect(x - w / 2 + 4, y - 14, 26, 18); ctx.textAlign = 'center'; ctx.fillStyle = '#0c0c10'; ctx.font = '700 12px Georgia'; ctx.fillText(key, x - w / 2 + 17, y - 1);
    ctx.textAlign = 'left'; ctx.font = '600 14px "Palatino Linotype", Georgia, serif'; ctx.fillStyle = '#e8e2d0'; ctx.fillText(label, x - w / 2 + 38, y);
  }
})();
