// GHOSTBLADE - ui: DOM menu layer (title, pause, sub-screens, results, dialogue, toasts, banners)
(function () {
  'use strict';
  const GB = window.GB = window.GB || {};

  // ---------- constants ----------
  const ACTION_LABELS = {
    left: 'Move Left', right: 'Move Right', up: 'Up / Climb', down: 'Down / Drop',
    sprint: 'Sprint', jump: 'Jump / Parkour', crouch: 'Crouch / Slide',
    interact: 'Interact', assassinate: 'Assassinate', gadget: 'Use Gadget',
    weapon: 'Switch Weapon', gadgetNext: 'Next Gadget', map: 'Map',
    attack: 'Attack', block: 'Block / Parry', pause: 'Pause'
  };
  const SCREEN_LIST = [
    ['map', 'World Map'], ['missions', 'Missions'], ['skills', 'Skills'],
    ['equipment', 'Equipment'], ['outfits', 'Outfits'], ['settings', 'Settings']
  ];
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const NAVKEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
  };
  const ACTKEYS = { Enter: 1, NumpadEnter: 1, Space: 1, KeyE: 1 };
  const STAT_ROWS = [
    ['time', 'Time', 'time'], ['kills', 'Kills'], ['stealthKills', 'Stealth Kills'],
    ['airKills', 'Air Assassinations'], ['detections', 'Detections'], ['alerted', 'Guards Alerted'],
    ['bodiesFound', 'Bodies Found'], ['alarms', 'Alarms Raised'], ['evidence', 'Evidence Left'],
    ['gadgetsUsed', 'Gadgets Used']
  ];
  const LEGEND = [
    ['Viewpoint', 'gb-lg-view'], ['Mission', 'gb-lg-mission'], ['Hideout', 'gb-lg-hide'],
    ['Relic', 'gb-lg-relic'], ['Treasure', 'gb-lg-chest'], ['Restricted area', 'gb-lg-restrict']
  ];

  // ---------- state ----------
  let root = null, built = false;
  const L = {};                       // layer / element references
  let view = null;                    // 'main' | 'pause' | 'screen' | 'result' | 'fail' | null
  let screenName = null, screenParent = null;
  let dlg = null, conf = null, res = null;
  let capAction = null;
  let audioReady = false;
  let swallowClickUntil = 0;
  let lastMX = -1, lastMY = -1;
  let selMission = 1;
  let mapCanvas = null;
  let lastSliderSfx = 0;
  let bannerTimer = 0, bannerTimer2 = 0;
  const menuFocus = { main: null, pause: null };

  // ---------- helpers ----------
  function add(el, c) {
    if (c == null || c === false) return el;
    if (Array.isArray(c)) { for (let i = 0; i < c.length; i++) add(el, c[i]); return el; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  function h(tag, a) {
    const el = document.createElement(tag);
    if (a) for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'data') { for (const d in v) el.dataset[d] = v[d]; }
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function sfx(name) { GB.audio && GB.audio.sfx && GB.audio.sfx(name); }
  function initAudio() {
    if (audioReady) return;
    audioReady = true;
    GB.audio && GB.audio.init && GB.audio.init();
  }
  function game(fn) {
    const g = GB.game;
    if (g && typeof g[fn] === 'function') return g[fn].apply(g, Array.prototype.slice.call(arguments, 1));
  }
  function fmtTime(s) {
    if (GB.util && GB.util.fmtTime) return GB.util.fmtTime(s);
    s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function fmtNum(n) { return (Math.round(n) || 0).toLocaleString('en-US'); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function rankCls(r) { return 'gb-r-' + (r === 'S+' ? 'sp' : String(r || 'c').toLowerCase()); }
  function actionLabel(a) { return ACTION_LABELS[a] || a; }
  function keyLabel(a) { return GB.input && GB.input.keyLabel ? GB.input.keyLabel(a) : '-'; }
  function keyChip(text, cls) { return h('span', { class: 'gb-key' + (cls ? ' ' + cls : ''), text: text }); }

  function navBtn(cls, key, onAct, o) {
    o = o || {};
    const b = h('button', { type: 'button', class: 'gb-nav ' + cls, data: { key: key } });
    if (o.disabled) b.disabled = true;
    if (o.soft) b.setAttribute('aria-disabled', 'true');
    if (o.nohover) b.dataset.nohover = '1';
    if (o.def) b.dataset.default = '1';
    if (o.label) b.textContent = o.label;
    b.addEventListener('click', function () {
      if (b.disabled) return;
      if (o.snd !== null) sfx(o.snd || 'uiSelect');
      onAct(b);
    });
    return b;
  }
  function deny(el) {
    sfx('uiDeny');
    if (!el) return;
    el.classList.remove('gb-shake');
    void el.offsetWidth;
    el.classList.add('gb-shake');
  }
  function hints(withBack) {
    return h('div', { class: 'gb-hints' },
      h('span', null, keyChip('W'), keyChip('S'), ' Navigate'),
      h('span', null, keyChip('Enter'), ' Select'),
      withBack ? h('span', null, keyChip('Esc'), ' Back') : null);
  }

  // ---------- focus / navigation ----------
  function topLayerEl() {
    if (conf) return L.confirm;
    if (dlg) return L.dialog;
    return view ? L[view] : null;
  }
  function navItems(layer) {
    if (!layer) return [];
    return Array.prototype.filter.call(layer.querySelectorAll('.gb-nav'), function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  }
  function currentNav() {
    const layer = topLayerEl(), a = document.activeElement;
    return layer && a && layer.contains(a) && a.classList.contains('gb-nav') && !a.disabled ? a : null;
  }
  function focusEl(el, silent, noScroll) {
    if (!el) return false;
    const changed = document.activeElement !== el;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    if (!noScroll && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* old browsers */ } }
    if (changed && !silent) sfx('uiMove');
    return true;
  }
  function findKey(layer, key) {
    if (key == null) return null;
    const items = navItems(layer);
    for (let i = 0; i < items.length; i++) if (items[i].dataset.key === String(key)) return items[i];
    return null;
  }
  function focusDefault(layer, silent) {
    layer = layer || topLayerEl();
    const items = navItems(layer);
    if (!items.length) return false;
    let pick = null;
    for (let i = 0; i < items.length; i++) if (items[i].dataset.default) { pick = items[i]; break; }
    return focusEl(pick || items[0], silent !== false);
  }
  function move(dir) {
    const layer = topLayerEl(), items = navItems(layer);
    if (!items.length) return;
    const cur = currentNav();
    if (!cur) { focusDefault(layer, false); return; }
    const idx = items.indexOf(cur), n = items.length;
    if (dir === 'next') { focusEl(items[(idx + 1) % n]); return; }
    if (dir === 'prev') { focusEl(items[(idx - 1 + n) % n]); return; }
    const hint = cur.dataset['nav' + dir];
    if (hint) { const t = findKey(layer, hint); if (t) { focusEl(t); return; } }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const vert = dir === 'up' || dir === 'down';
    let best = null, bestScore = Infinity;
    for (let i = 0; i < n; i++) {
      const it = items[i];
      if (it === cur) continue;
      const q = it.getBoundingClientRect();
      const qx = q.left + q.width / 2, qy = q.top + q.height / 2;
      let primary, gap, off;
      if (vert) {
        primary = dir === 'down' ? qy - cy : cy - qy;
        gap = q.right < r.left ? r.left - q.right : q.left > r.right ? q.left - r.right : 0;
        off = Math.abs(qx - cx);
      } else {
        primary = dir === 'right' ? qx - cx : cx - qx;
        gap = q.bottom < r.top ? r.top - q.bottom : q.top > r.bottom ? q.top - r.bottom : 0;
        off = Math.abs(qy - cy);
      }
      if (primary < 2) continue;
      const score = primary + gap * 3 + off * 0.15;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    if (!best && vert) best = items[(idx + (dir === 'down' ? 1 : -1) + n) % n];
    if (best && best !== cur) focusEl(best);
  }
  function nudge(input, d) {
    const min = +input.min || 0, max = +input.max || 100;
    const v = Math.max(min, Math.min(max, (+input.value || 0) + d));
    if (v === +input.value) return;
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---------- layers ----------
  function showOnly(name) {
    const names = ['main', 'pause', 'screen', 'result', 'fail'];
    for (let i = 0; i < names.length; i++) L[names[i]].classList.toggle('gb-on', names[i] === name);
    const a = document.activeElement;
    if (a && root.contains(a) && a.blur) a.blur();
  }
  function isOpen() { return !!(view || dlg || conf); }

  function hide() {
    if (!built) return;
    cancelCapture();
    closeConfirm(true);
    endDialog(false);
    cleanupResult();
    view = null; screenName = null; screenParent = null; mapCanvas = null;
    showOnly(null);
  }

  // ---------- generic menus ----------
  function buildMenu(listEl, items, menuName) {
    clear(listEl);
    items.forEach(function (it) {
      const b = navBtn('gb-mi', it.key, function () { it.act(); },
        { disabled: it.disabled, label: it.label });
      listEl.appendChild(b);
    });
  }
  function screenItems(parent) {
    return SCREEN_LIST.map(function (s) {
      return { key: s[0], label: s[1], act: function () { openScreen(s[0], parent); } };
    });
  }

  // ---------- main menu ----------
  function showMainMenu() {
    init();
    cancelCapture(); closeConfirm(true); endDialog(false); cleanupResult();
    view = 'main'; screenName = null; screenParent = null; mapCanvas = null;
    const started = !!(GB.save && GB.save.started);
    const canCont = !!(GB.saveSys && GB.saveSys.exists() && started);
    const items = [
      {
        key: 'new', label: 'New Game', act: function () {
          const begin = function () { hide(); game('newGame'); };
          if (GB.saveSys && GB.saveSys.exists() && GB.save && GB.save.started) {
            confirmBox('Begin Anew?', 'Your current progress will be lost. This cannot be undone.', 'New Game', begin, true);
          } else begin();
        }
      },
      { key: 'continue', label: 'Continue', disabled: !canCont, act: function () { hide(); game('continueGame'); } }
    ].concat(screenItems('main'));
    buildMenu(L.mainList, items, 'main');
    showOnly('main');
    const want = findKey(L.main, menuFocus.main) || findKey(L.main, canCont ? 'continue' : 'new');
    focusEl(want, true);
    menuFocus.main = null;
  }

  // ---------- pause ----------
  function showPause() {
    init();
    cancelCapture(); closeConfirm(true); cleanupResult();
    view = 'pause'; screenName = null; screenParent = null; mapCanvas = null;
    const m = GB.game && GB.game.mission;
    const items = [{ key: 'resume', label: 'Resume', act: function () { hide(); game('resume'); } }];
    if (m) {
      items.push({
        key: 'restart', label: 'Restart Mission', act: function () {
          confirmBox('Restart Mission?', 'Progress in this mission will be lost.', 'Restart', function () { hide(); game('restartMission'); });
        }
      });
      items.push({
        key: 'abandon', label: 'Abandon Mission', act: function () {
          confirmBox('Abandon Mission?', 'You will leave the mission and lose its progress.', 'Abandon', function () { hide(); game('abandonMission'); }, true);
        }
      });
    }
    Array.prototype.push.apply(items, screenItems('pause'));
    items.push({
      key: 'quit', label: 'Quit to Title', act: function () {
        const go = function () { quitToTitle(); };
        if (GB.game && GB.game.mission) confirmBox('Quit to Title?', 'Progress in the current mission will be lost.', 'Quit', go, true);
        else go();
      }
    });
    buildMenu(L.pauseList, items, 'pause');

    let mName = '';
    if (m && typeof m === 'object') mName = m.name || (m.def && m.def.name) || '';
    if (m && !mName && GB.defs && GB.defs.missions) {
      const id = typeof m === 'object' ? m.id : m;
      const def = GB.defs.byId(GB.defs.missions, id);
      if (def) mName = def.name;
    }
    L.pauseSub.textContent = mName ? mName : 'Free Roam';

    clear(L.pauseCtl);
    const actions = Object.keys((GB.input && GB.input.DEFAULT_KEYS) || ACTION_LABELS);
    actions.forEach(function (a) {
      L.pauseCtl.appendChild(h('div', { class: 'gb-ctl' },
        h('span', { class: 'gb-ctl-l', text: actionLabel(a) }), keyChip(keyLabel(a))));
    });

    showOnly('pause');
    focusEl(findKey(L.pause, menuFocus.pause) || findKey(L.pause, 'resume'), true);
    menuFocus.pause = null;
  }
  function quitToTitle() {
    hide();
    game('quitToMenu');
    if (!(GB.game && typeof GB.game.quitToMenu === 'function') && !isOpen()) showMainMenu();
  }

  // ---------- confirm ----------
  function confirmBox(title, text, yesLabel, onYes, danger) {
    conf = { prev: document.activeElement };
    L.confTitle.textContent = title;
    L.confText.textContent = text;
    clear(L.confBtns);
    const no = navBtn('gb-btn gb-btn-ghost', 'no', function () { closeConfirm(); }, { label: 'Cancel', snd: 'uiBack' });
    const yes = navBtn('gb-btn' + (danger ? ' gb-btn-danger' : ''), 'yes', function () { closeConfirm(true); onYes(); }, { label: yesLabel });
    add(L.confBtns, [no, yes]);
    L.confirm.classList.add('gb-on');
    focusEl(no, true);
  }
  function closeConfirm(silent) {
    if (!conf) return;
    const p = conf.prev;
    conf = null;
    L.confirm.classList.remove('gb-on');
    if (!silent && p && p.isConnected && root.contains(p)) focusEl(p, true);
  }

  // ---------- sub-screens ----------
  const SCREENS = {
    map: { title: 'World Map', render: renderMap },
    missions: { title: 'Missions', render: renderMissions },
    skills: { title: 'Skills', render: renderSkills },
    equipment: { title: 'Equipment', render: renderEquipment },
    outfits: { title: 'Outfits', render: renderOutfits },
    settings: { title: 'Settings', render: renderSettings }
  };

  function openScreen(name, parent) {
    init();
    if (!SCREENS[name]) return;
    cancelCapture(); closeConfirm(true); cleanupResult();
    view = 'screen'; screenName = name; screenParent = parent || null;
    if (name === 'missions') {
      const n = GB.defs.missions.length;
      selMission = Math.max(1, Math.min(n, (GB.save && GB.save.unlocked) || 1));
    }
    renderScreen();
    showOnly('screen');
    L.screenBody.scrollTop = 0;
    if (!focusDefault(L.screenBody, true)) focusEl(L.backBtn, true);
    const a = document.activeElement;
    if (a && a.scrollIntoView && L.screenBody.contains(a)) { try { a.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ } }
  }
  function renderScreen() {
    const def = SCREENS[screenName];
    L.screenTitle.textContent = def.title;
    clear(L.screenStat); clear(L.screenBody);
    L.screenBody.className = 'gb-sbody gb-s-' + screenName;
    mapCanvas = null;
    def.render(L.screenBody, L.screenStat);
  }
  function rerender() {
    if (view !== 'screen') return;
    const a = document.activeElement;
    const key = a && L.screen.contains(a) ? a.dataset.key : null;
    const top = L.screenBody.scrollTop;
    const scrolls = {};
    Array.prototype.forEach.call(L.screenBody.querySelectorAll('[data-scroll]'), function (el) { scrolls[el.dataset.scroll] = el.scrollTop; });
    renderScreen();
    L.screenBody.scrollTop = top;
    Array.prototype.forEach.call(L.screenBody.querySelectorAll('[data-scroll]'), function (el) {
      if (scrolls[el.dataset.scroll] != null) el.scrollTop = scrolls[el.dataset.scroll];
    });
    const t = findKey(L.screen, key);
    if (t) focusEl(t, true, true); else focusDefault(L.screenBody, true);
  }
  function back() {
    if (view !== 'screen') return;
    cancelCapture();
    sfx('uiBack');
    const p = screenParent;
    if (p === 'main') { menuFocus.main = screenName; showMainMenu(); }
    else if (p === 'pause') { menuFocus.pause = screenName; showPause(); }
    else { hide(); game('resume'); }
  }
  function chip(label, value, cls) {
    return h('div', { class: 'gb-chip' + (cls ? ' ' + cls : '') },
      h('span', { class: 'gb-chip-l', text: label }), h('span', { class: 'gb-chip-v', text: value }));
  }
  function florinChip() {
    return h('div', { class: 'gb-chip gb-chip-gold' },
      h('span', { class: 'gb-coin' }),
      h('span', { class: 'gb-chip-v', text: fmtNum(GB.save.coins || 0) }),
      h('span', { class: 'gb-chip-l', text: 'Florins' }));
  }

  // ----- MAP -----
  function renderMap(body) {
    mapCanvas = h('canvas', { class: 'gb-mapcv' });
    const legend = h('div', { class: 'gb-legend' });
    LEGEND.forEach(function (l) {
      legend.appendChild(h('span', { class: 'gb-lg' }, h('i', { class: 'gb-lg-m ' + l[1] }), l[0]));
    });
    add(body, [h('div', { class: 'gb-mapframe' }, mapCanvas), legend]);
    const cv = mapCanvas;
    requestAnimationFrame(function () { if (mapCanvas === cv) drawMap(); });
  }
  function drawMap() {
    if (view !== 'screen' || screenName !== 'map' || !mapCanvas) return;
    const r = mapCanvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr)), ht = Math.max(1, Math.round(r.height * dpr));
    if (mapCanvas.width !== w) mapCanvas.width = w;
    if (mapCanvas.height !== ht) mapCanvas.height = ht;
    if (GB.hud && typeof GB.hud.drawWorldMap === 'function') {
      GB.hud.drawWorldMap(mapCanvas);
    } else {
      const c = mapCanvas.getContext('2d');
      if (!c) return;
      c.clearRect(0, 0, w, ht);
      c.fillStyle = 'rgba(207,201,184,.55)';
      c.font = Math.round(15 * dpr) + 'px Georgia, serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('The map has not been charted yet.', w / 2, ht / 2);
    }
  }

  // ----- MISSIONS -----
  function renderMissions(body) {
    const s = GB.save, list = GB.defs.missions, unlocked = s.unlocked || 1;
    const listEl = h('div', { class: 'gb-mlist', data: { scroll: 'mlist' } });
    list.forEach(function (m) {
      const locked = m.id > unlocked, rec = s.missions && s.missions[m.id];
      const b = navBtn('gb-mrow' + (locked ? ' gb-locked' : '') + (m.id === selMission ? ' gb-sel' : ''), 'm' + m.id, function () {
        selectMission(m.id);
        if (locked) { deny(b); return; }
        sfx('uiSelect');
        focusEl(findKey(L.screen, 'begin'), true);
      }, { nohover: true, snd: null, def: m.id === selMission });
      b.dataset.navright = 'begin';
      let side;
      if (locked) side = h('span', { class: 'gb-mside' }, h('i', { class: 'gb-lock' }));
      else if (rec) side = h('span', { class: 'gb-mside' },
        h('span', { class: 'gb-rank-sm ' + rankCls(rec.rank), text: rec.rank || '-' }),
        h('span', { class: 'gb-mtime', text: rec.time != null ? fmtTime(rec.time) : '' }));
      else side = h('span', { class: 'gb-mside' }, h('span', { class: 'gb-mnew', text: 'New' }));
      add(b, [
        h('span', { class: 'gb-mnum', text: ROMAN[m.id] || String(m.id) }),
        h('span', { class: 'gb-mmain' },
          h('span', { class: 'gb-mname', text: m.name }),
          h('span', { class: 'gb-mdist', text: m.district }),
          h('span', { class: 'gb-mdesc', text: m.desc })),
        side
      ]);
      b.addEventListener('focus', function () { selectMission(m.id); });
      listEl.appendChild(b);
    });
    L.missionDetail = h('div', { class: 'gb-mdetail', data: { scroll: 'mdetail' } });
    add(body, [listEl, L.missionDetail]);
    renderMissionDetail();
  }
  function selectMission(id) {
    if (id === selMission) return;
    selMission = id;
    Array.prototype.forEach.call(L.screenBody.querySelectorAll('.gb-mrow'), function (el) {
      el.classList.toggle('gb-sel', el.dataset.key === 'm' + id);
    });
    renderMissionDetail();
  }
  function renderMissionDetail() {
    const el = L.missionDetail;
    if (!el) return;
    clear(el);
    const s = GB.save, m = GB.defs.byId(GB.defs.missions, selMission);
    if (!m) return;
    const locked = m.id > (s.unlocked || 1), rec = s.missions && s.missions[m.id];
    const inner = h('div', { class: 'gb-md-in' });
    add(inner, [
      h('div', { class: 'gb-md-kicker', text: 'Mission ' + (ROMAN[m.id] || m.id) + '  ·  ' + m.district }),
      h('h3', { class: 'gb-md-name', text: m.name }),
      h('div', { class: 'gb-rule' }),
      h('p', { class: 'gb-md-desc', text: m.desc })
    ]);
    const facts = h('div', { class: 'gb-facts' });
    add(facts, [
      chip('Par Time', fmtTime(m.par)),
      chip('Reward', fmtNum(m.coins) + ' florins'),
      chip('Experience', fmtNum(m.xp) + ' XP')
    ]);
    inner.appendChild(facts);
    if (rec) {
      const ch = Array.isArray(rec.challenges) ? rec.challenges : [];
      const done = ch.filter(Boolean).length;
      inner.appendChild(h('div', { class: 'gb-best' },
        h('div', { class: 'gb-best-rank ' + rankCls(rec.rank), text: rec.rank || '-' }),
        h('div', { class: 'gb-best-info' },
          h('div', { class: 'gb-best-h', text: 'Best Performance' }),
          h('div', { class: 'gb-best-row' },
            chip('Time', rec.time != null ? fmtTime(rec.time) : '-'),
            chip('Score', rec.score != null ? fmtNum(rec.score) : '-'),
            ch.length ? chip('Challenges', done + ' / ' + ch.length) : null))));
    } else if (!locked) {
      inner.appendChild(h('div', { class: 'gb-md-note', text: 'Not yet attempted.' }));
    }
    if (locked) {
      const prev = GB.defs.byId(GB.defs.missions, m.id - 1);
      inner.appendChild(h('div', { class: 'gb-md-locked' }, h('i', { class: 'gb-lock' }),
        h('span', { text: prev ? 'Complete “' + prev.name + '” to unlock.' : 'Locked.' })));
    } else {
      const begin = navBtn('gb-btn gb-btn-primary', 'begin', function () {
        const id = m.id;
        hide();
        game('startMission', id);
      }, { label: rec ? 'Replay Mission' : 'Begin Mission' });
      begin.dataset.navleft = 'm' + m.id;
      begin.dataset.navup = 'm' + m.id;
      inner.appendChild(h('div', { class: 'gb-md-act' }, begin));
    }
    el.appendChild(inner);
  }

  // ----- SKILLS -----
  function renderSkills(body, stat) {
    const s = GB.save, lvl = s.level || 1, need = GB.prog.xpNeed() || 1;
    const pct = Math.max(0, Math.min(100, (s.xp || 0) / need * 100));
    add(stat, [
      chip('Level', String(lvl)),
      h('div', { class: 'gb-xpwrap' },
        h('div', { class: 'gb-xp' }, h('div', { class: 'gb-xp-fill', style: 'width:' + pct.toFixed(1) + '%' })),
        h('div', { class: 'gb-xp-l', text: fmtNum(s.xp || 0) + ' / ' + fmtNum(need) + ' XP' })),
      chip('Skill Points', String(s.skillPoints || 0), 'gb-chip-gold')
    ]);
    const wrap = h('div', { class: 'gb-skills' });
    let defSet = false;
    Object.keys(GB.defs.branches).forEach(function (bk) {
      const br = GB.defs.branches[bk];
      const skills = GB.defs.skills.filter(function (k) { return k.branch === bk; });
      const got = skills.filter(function (k) { return s.skills[k.id]; }).length;
      const col = h('section', { class: 'gb-branch' });
      col.style.setProperty('--bc', br.color);
      col.appendChild(h('header', { class: 'gb-bhead' },
        h('span', { class: 'gb-bname', text: br.name }),
        h('span', { class: 'gb-bsub', text: br.sub }),
        h('span', { class: 'gb-bcount', text: got + ' / ' + skills.length })));
      const nodes = h('div', { class: 'gb-nodes' });
      skills.forEach(function (k) {
        const learned = !!s.skills[k.id], can = GB.prog.canLearn(k.id);
        const reqMet = !k.req || !!s.skills[k.req];
        const state = learned ? 'learned' : can ? 'avail' : !reqMet ? 'locked' : 'poor';
        let status;
        if (learned) status = 'Learned';
        else if (can) status = 'Learn';
        else if (!reqMet) { const rq = GB.defs.byId(GB.defs.skills, k.req); status = 'Requires ' + (rq ? rq.name : k.req); }
        else { const short = k.cost - (s.skillPoints || 0); status = 'Need ' + short + ' more point' + (short === 1 ? '' : 's'); }
        const isDef = !defSet && can;
        if (isDef) defSet = true;
        const b = navBtn('gb-node gb-st-' + state, 's' + k.id, function () {
          if (GB.prog.learn(k.id)) {
            sfx('uiBuy');
            toast('Skill learned: ' + k.name);
            rerender();
          } else deny(b);
        }, { soft: !can, snd: null, def: isDef });
        const pips = h('span', { class: 'gb-pips' });
        for (let i = 0; i < k.cost; i++) pips.appendChild(h('i', { class: 'gb-pip' }));
        add(b, [
          h('i', { class: 'gb-nmark' }),
          h('span', { class: 'gb-nmain' },
            h('span', { class: 'gb-nhead' }, h('span', { class: 'gb-nname', text: k.name }), pips),
            h('span', { class: 'gb-ndesc', text: k.desc }),
            h('span', { class: 'gb-nstatus' },
              state === 'locked' ? h('i', { class: 'gb-lock' }) : null,
              h('span', { text: status }),
              learned ? null : h('span', { class: 'gb-ncost', text: k.cost + (k.cost === 1 ? ' point' : ' points') })))
        ]);
        nodes.appendChild(b);
      });
      col.appendChild(nodes);
      wrap.appendChild(col);
    });
    body.appendChild(wrap);
  }

  // ----- EQUIPMENT -----
  function gearCard(kind, it) {
    const s = GB.save;
    const slot = kind === 'weapons' ? 'weapon' : kind === 'gadgets' ? 'gadget' : kind === 'outfits' ? 'outfit' : null;
    const owned = GB.prog.owns(kind, it.id);
    const equipped = !!slot && owned && s[slot] === it.id;
    const forSale = it.cost >= 0;
    const afford = GB.prog.canBuy(kind, it.id);
    let state, action, sub = '';
    if (equipped) { state = 'equipped'; action = 'Equipped'; }
    else if (owned && slot) { state = 'owned'; action = 'Equip'; }
    else if (owned) { state = 'have'; action = 'Owned'; }
    else if (!forSale) { state = 'locked'; action = 'Locked'; sub = 'Awarded, not for sale'; }
    else if (afford) { state = 'buy'; action = 'Buy'; sub = fmtNum(it.cost) + ' florins'; }
    else { state = 'poor'; action = fmtNum(it.cost) + ' florins'; sub = 'Need ' + fmtNum(it.cost - (s.coins || 0)) + ' more'; }
    const passive = state === 'equipped' || state === 'have';
    const b = navBtn('gb-card gb-gear gb-st-' + state, kind + ':' + it.id, function () {
      if (passive) { sfx('uiMove'); return; }
      if (owned && slot) {
        if (GB.prog.equip(slot, it.id)) { sfx('uiSelect'); rerender(); } else deny(b);
        return;
      }
      if (GB.prog.buy(kind, it.id)) {
        sfx('uiBuy');
        toast('Acquired: ' + it.name);
        rerender();
      } else deny(b);
    }, { soft: state === 'locked' || state === 'poor', snd: null });

    const meta = h('span', { class: 'gb-gmeta' });
    if (kind === 'weapons') {
      add(meta, [
        h('span', { class: 'gb-tag', text: 'Damage ' + it.dmg }),
        h('span', { class: 'gb-tag', text: (1 / it.cd).toFixed(1) + ' strikes/s' }),
        it.concealed ? h('span', { class: 'gb-tag gb-tag-steel', text: 'Concealed' }) : null
      ]);
    } else if (kind === 'gadgets') {
      meta.appendChild(h('span', { class: 'gb-tag', text: 'Carry ' + GB.prog.gadgetCap(it.id) }));
    }
    let preview = null;
    if (kind === 'outfits') {
      preview = h('canvas', { class: 'gb-outfit-cv' });
      drawOutfit(preview, it);
    }
    add(b, [
      preview,
      h('span', { class: 'gb-ghead' },
        h('span', { class: 'gb-gname', text: it.name }),
        equipped ? h('span', { class: 'gb-badge', text: 'Equipped' }) : null),
      h('span', { class: 'gb-gdesc', text: it.desc }),
      meta.firstChild ? meta : null,
      h('span', { class: 'gb-gfoot' },
        state === 'locked' ? h('i', { class: 'gb-lock' }) : null,
        (state === 'buy' || state === 'poor') ? h('i', { class: 'gb-coin' }) : null,
        h('span', { class: 'gb-gact', text: action }),
        sub ? h('span', { class: 'gb-gsub', text: sub }) : null)
    ]);
    return b;
  }
  function gearSection(title, note, kind) {
    const grid = h('div', { class: 'gb-grid' });
    GB.defs[kind].forEach(function (it) { grid.appendChild(gearCard(kind, it)); });
    return h('section', { class: 'gb-sec' },
      h('header', { class: 'gb-sechead' }, h('h3', { text: title }), note ? h('span', { text: note }) : null), grid);
  }
  function renderEquipment(body, stat) {
    stat.appendChild(florinChip());
    add(body, [
      gearSection('Weapons', 'Switch in the field with ' + keyLabel('weapon'), 'weapons'),
      gearSection('Gadgets', 'Cycle in the field with ' + keyLabel('gadgetNext'), 'gadgets'),
      gearSection('Upgrades', 'Permanent improvements', 'upgrades')
    ]);
  }

  // ----- OUTFITS -----
  function renderOutfits(body, stat) {
    stat.appendChild(florinChip());
    const grid = h('div', { class: 'gb-grid gb-grid-outfits' });
    GB.defs.outfits.forEach(function (o) { grid.appendChild(gearCard('outfits', o)); });
    body.appendChild(grid);
  }
  function drawOutfit(cv, o) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), W = 220, H = 150;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext && cv.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gy = H - 20, cx = W * 0.45;
    // night sky
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#161d2c'); g.addColorStop(1, '#34415c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // moon
    const mx = cx + 16, my = gy - 72;
    g = c.createRadialGradient(mx, my, 12, mx, my, 96);
    g.addColorStop(0, 'rgba(240,232,205,.5)'); g.addColorStop(1, 'rgba(240,232,205,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#efe7cc';
    c.beginPath(); c.arc(mx, my, 31, 0, Math.PI * 2); c.fill();
    // distant skyline
    c.fillStyle = '#121826';
    c.fillRect(0, gy - 20, 24, 30); c.fillRect(24, gy - 9, 26, 20);
    c.fillRect(168, gy - 16, 52, 30); c.fillRect(184, gy - 40, 16, 40);
    c.beginPath(); c.moveTo(181, gy - 40); c.lineTo(192, gy - 56); c.lineTo(203, gy - 40); c.closePath(); c.fill();
    // rooftop
    c.fillStyle = '#06070a'; c.fillRect(0, gy, W, H - gy);
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(0, gy, W, 1);

    c.lineCap = 'round'; c.lineJoin = 'round';
    // cloak
    c.beginPath();
    c.moveTo(cx + 4, gy - 80);
    c.lineTo(cx - 5, gy - 82);
    c.bezierCurveTo(cx - 22, gy - 72, cx - 42, gy - 54, cx - 64, gy - 32);
    c.lineTo(cx - 47, gy - 33); c.lineTo(cx - 52, gy - 14);
    c.lineTo(cx - 33, gy - 24); c.lineTo(cx - 31, gy - 7);
    c.lineTo(cx - 13, gy - 26);
    c.quadraticCurveTo(cx - 2, gy - 50, cx + 4, gy - 80);
    c.closePath();
    c.fillStyle = o.cloak; c.fill();
    c.globalAlpha = 0.6; c.strokeStyle = o.trim; c.lineWidth = 1; c.stroke(); c.globalAlpha = 1;

    const sh = [cx, gy - 78], hip = [cx - 2, gy - 46];
    const limbs = [
      [sh, [cx - 9, gy - 62], [cx - 7, gy - 47]],          // back arm
      [hip, [cx - 9, gy - 23], [cx - 15, gy]],             // back leg
      [[cx + 1, gy - 84], sh, hip],                        // neck + torso
      [hip, [cx + 6, gy - 24], [cx + 4, gy]],              // front leg
      [sh, [cx + 10, gy - 63], [cx + 17, gy - 49]]         // front arm
    ];
    const strokeLimbs = function () {
      for (let i = 0; i < limbs.length; i++) {
        const p = limbs[i];
        c.beginPath(); c.moveTo(p[0][0], p[0][1]);
        for (let j = 1; j < p.length; j++) c.lineTo(p[j][0], p[j][1]);
        c.stroke();
      }
    };
    c.globalAlpha = 0.5; c.strokeStyle = o.trim; c.lineWidth = 6.6; strokeLimbs();
    c.globalAlpha = 1; c.strokeStyle = o.body; c.lineWidth = 5; strokeLimbs();
    // hidden blade + sash
    c.strokeStyle = o.trim;
    c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx + 17, gy - 49); c.lineTo(cx + 29, gy - 41); c.stroke();
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(cx - 5, gy - 48); c.lineTo(cx + 2, gy - 47); c.stroke();
    // head
    const hx = cx + 2, hy = gy - 93;
    c.fillStyle = o.body; c.beginPath(); c.arc(hx, hy, 8.5, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.5; c.strokeStyle = o.trim; c.lineWidth = 0.8; c.stroke(); c.globalAlpha = 1;
    // pointed hood
    c.beginPath();
    c.moveTo(hx + 13, hy + 2);
    c.quadraticCurveTo(hx + 7, hy - 12, hx - 2, hy - 13);
    c.quadraticCurveTo(hx - 13, hy - 11, hx - 12, hy + 3);
    c.lineTo(hx - 10, hy + 13);
    c.lineTo(hx - 2, hy + 11);
    c.lineTo(hx + 3, hy + 1);
    c.closePath();
    c.fillStyle = o.cloak; c.fill();
    c.strokeStyle = o.trim; c.lineWidth = 1.2; c.globalAlpha = 0.9; c.stroke(); c.globalAlpha = 1;
  }

  // ----- SETTINGS -----
  function renderSettings(body) {
    const st = GB.save.settings;
    const wrap = h('div', { class: 'gb-settings' });

    // audio
    const audio = h('section', { class: 'gb-sec' }, h('header', { class: 'gb-sechead' }, h('h3', { text: 'Audio' })));
    [['master', 'Master Volume'], ['music', 'Music'], ['sfx', 'Effects']].forEach(function (d, i) {
      const k = d[0], v = Math.round(Math.max(0, Math.min(1, st[k] == null ? 1 : st[k])) * 100);
      const inp = h('input', { type: 'range', min: '0', max: '100', step: '1', class: 'gb-nav gb-range', 'aria-label': d[1], data: { key: 'vol-' + k } });
      if (i === 0) inp.dataset.default = '1';
      inp.value = v;
      inp.style.setProperty('--v', v + '%');
      const val = h('span', { class: 'gb-rval', text: v + '%' });
      inp.addEventListener('input', function () {
        const n = +inp.value;
        GB.save.settings[k] = n / 100;
        inp.style.setProperty('--v', n + '%');
        val.textContent = n + '%';
        GB.saveSys.applySettings();
        GB.saveSys.save();
        const now = performance.now();
        if (now - lastSliderSfx > 90) { lastSliderSfx = now; sfx('uiMove'); }
      });
      audio.appendChild(h('label', { class: 'gb-row gb-row-range' }, h('span', { class: 'gb-row-l', text: d[1] }), inp, val));
    });

    // gameplay toggles
    const play = h('section', { class: 'gb-sec' }, h('header', { class: 'gb-sechead' }, h('h3', { text: 'Gameplay' })));
    [['cones', 'Show guard vision cones'], ['shake', 'Screen shake']].forEach(function (d) {
      const k = d[0];
      const b = navBtn('gb-row gb-toggle' + (st[k] ? ' gb-on' : ''), 'tog-' + k, function () {
        GB.save.settings[k] = !GB.save.settings[k];
        GB.saveSys.applySettings();
        GB.saveSys.save();
        rerender();
      });
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-checked', st[k] ? 'true' : 'false');
      add(b, [h('span', { class: 'gb-row-l', text: d[1] }),
        h('span', { class: 'gb-tstate', text: st[k] ? 'On' : 'Off' }), h('i', { class: 'gb-switch' })]);
      play.appendChild(b);
    });

    // controls
    const ctl = h('section', { class: 'gb-sec' },
      h('header', { class: 'gb-sechead' }, h('h3', { text: 'Controls' }),
        h('span', { text: 'Select a binding, then press a key or mouse button. Esc cancels.' })));
    const binds = h('div', { class: 'gb-binds' });
    Object.keys(GB.input.DEFAULT_KEYS).forEach(function (a) {
      const custom = GB.input.keys[a] !== GB.input.DEFAULT_KEYS[a];
      const b = navBtn('gb-row gb-bind', 'bind-' + a, function () { beginCapture(a, b); });
      add(b, [h('span', { class: 'gb-row-l', text: actionLabel(a) }),
        keyChip(keyLabel(a), 'gb-bind-key' + (custom ? ' gb-key-custom' : ''))]);
      binds.appendChild(b);
    });
    ctl.appendChild(binds);
    ctl.appendChild(h('div', { class: 'gb-btnrow' },
      navBtn('gb-btn gb-btn-ghost', 'resetkeys', function () {
        GB.saveSys.resetKeys();
        toast('Controls reset to defaults');
        rerender();
      }, { label: 'Reset to Defaults' })));

    // save data
    const data = h('section', { class: 'gb-sec' },
      h('header', { class: 'gb-sechead' }, h('h3', { text: 'Save Data' }),
        h('span', { text: 'Erasing removes all progress. Settings and controls are kept.' })));
    data.appendChild(h('div', { class: 'gb-btnrow' },
      navBtn('gb-btn gb-btn-danger', 'erase', function () {
        confirmBox('Erase Save?', 'All missions, skills, equipment and florins will be permanently lost.', 'Erase', function () {
          const fromGame = screenParent !== 'main';
          GB.saveSys.reset();
          if (fromGame) { hide(); game('quitToMenu'); }
          showMainMenu();
          toast('Save data erased');
        }, true);
      }, { label: 'Erase Save' })));

    add(wrap, [audio, play, ctl, data]);
    body.appendChild(wrap);
  }
  function beginCapture(action, el) {
    cancelCapture();
    capAction = action;
    el.classList.add('gb-capturing');
    const k = el.querySelector('.gb-bind-key');
    if (k) k.textContent = 'Press a key…';
    if (GB.input) GB.input.capture = function (code) { finishCapture(code); return true; };
  }
  function cancelCapture() {
    if (!capAction) return;
    capAction = null;
    if (GB.input) GB.input.capture = null;
    const el = L.screenBody && L.screenBody.querySelector('.gb-capturing');
    if (el) {
      el.classList.remove('gb-capturing');
      const k = el.querySelector('.gb-bind-key');
      if (k) k.textContent = keyLabel((el.dataset.key || '').replace('bind-', ''));
    }
  }
  function finishCapture(code) {
    if (!capAction) return;
    const action = capAction;
    capAction = null;
    if (GB.input) GB.input.capture = null;
    if (code === 'Escape' || !code) {
      sfx('uiBack');
    } else {
      const keys = GB.input.keys, old = keys[action];
      if (old !== code) {
        for (const other in keys) {
          if (other !== action && keys[other] === code) {
            GB.saveSys.setKey(other, old);   // swap rather than leave a duplicate binding
            toast(actionLabel(other) + ' is now ' + GB.input.label(old));
          }
        }
        GB.saveSys.setKey(action, code);
      }
      sfx('uiSelect');
    }
    if (view === 'screen' && screenName === 'settings') rerender();
  }

  // ---------- result ----------
  function cleanupResult() {
    if (!res) return;
    clearTimeout(res.timer);
    cancelAnimationFrame(res.raf);
    res = null;
  }
  function skipResult() {
    if (!res) return;
    res.done = true;
    clearTimeout(res.timer);
    cancelAnimationFrame(res.raf);
    L.resPanel.classList.add('gb-skip');
    res.counters.forEach(function (c) { c.el.textContent = c.fmt(c.to); });
  }
  function showResult(result, onClose) {
    init();
    const r = result || {}, st = r.stats || {}, rw = r.rewards || {};
    cancelCapture(); closeConfirm(true); cleanupResult();
    view = 'result'; screenName = null; screenParent = null; mapCanvas = null;
    const P = L.resPanel;
    clear(P);
    P.classList.remove('gb-skip');
    const counters = [];
    let d = 0.2;
    const rin = function (el, delay) { el.classList.add('gb-rin'); el.style.setProperty('--d', delay.toFixed(2) + 's'); return el; };
    const count = function (el, to, fmt, delay) { el.textContent = fmt(0); counters.push({ el: el, to: to, fmt: fmt, at: delay * 1000 }); };

    let name = r.name;
    if (!name && r.missionId != null && GB.defs) { const def = GB.defs.byId(GB.defs.missions, r.missionId); if (def) name = def.name; }
    P.appendChild(h('header', { class: 'gb-res-head' },
      h('div', { class: 'gb-res-kicker', text: 'Mission Complete' }),
      h('h2', { class: 'gb-res-name', text: name || '' }),
      r.firstTime ? h('span', { class: 'gb-badge', text: 'First Completion' }) : null,
      h('div', { class: 'gb-rule' })));

    const stats = h('div', { class: 'gb-res-stats' });
    STAT_ROWS.forEach(function (row) {
      const v = st[row[0]];
      const val = h('span', { class: 'gb-stat-v' });
      if (typeof v === 'number') count(val, v, row[2] === 'time' ? fmtTime : fmtNum, d);
      else val.textContent = v === true ? 'Yes' : v === false ? 'No' : v == null ? '-' : String(v);
      stats.appendChild(rin(h('div', { class: 'gb-stat' }, h('span', { class: 'gb-stat-l', text: row[1] }), val), d));
      d += 0.09;
    });
    d += 0.5;
    const rankAt = d;
    let title = r.rankTitle;
    if (!title && GB.defs && GB.defs.ranks) { const rk = GB.defs.byId(GB.defs.ranks, r.rank); if (rk) title = rk.title; }
    const scoreEl = h('span', { class: 'gb-res-score-v' });
    if (typeof r.score === 'number') count(scoreEl, r.score, fmtNum, rankAt + 0.15); else scoreEl.textContent = r.score == null ? '-' : String(r.score);
    const rankBox = h('div', { class: 'gb-res-rank ' + rankCls(r.rank) },
      h('div', { class: 'gb-res-rank-l', text: 'Rank' }),
      h('div', { class: 'gb-stamp' }, h('span', { class: 'gb-stamp-t', text: r.rank || '-' })),
      rin(h('div', { class: 'gb-res-title', text: title || '' }), rankAt + 0.45),
      rin(h('div', { class: 'gb-res-score' }, h('span', { class: 'gb-res-score-l', text: 'Score' }), scoreEl), rankAt + 0.15));
    rankBox.style.setProperty('--d', rankAt.toFixed(2) + 's');
    P.appendChild(h('div', { class: 'gb-res-grid' }, stats, rankBox));
    d = rankAt + 0.8;

    const ch = Array.isArray(r.challenges) ? r.challenges : [];
    if (ch.length) {
      const list = h('div', { class: 'gb-res-ch' }, rin(h('div', { class: 'gb-res-sub', text: 'Challenges' }), d));
      ch.forEach(function (c) {
        d += 0.1;
        list.appendChild(rin(h('div', { class: 'gb-ch' + (c.done ? ' gb-done' : '') },
          h('i', { class: 'gb-ch-m' }),
          h('span', { class: 'gb-ch-t', text: c.text || '' }),
          c.bonus != null && c.bonus !== '' ? h('span', { class: 'gb-ch-b', text: (typeof c.bonus === 'number' ? '+' + fmtNum(c.bonus) : String(c.bonus)) }) : null,
          h('span', { class: 'gb-ch-s', text: c.done ? 'Complete' : 'Missed' })), d));
      });
      P.appendChild(list);
      d += 0.2;
    }

    const rewards = h('div', { class: 'gb-res-rw' }, h('span', { class: 'gb-res-sub', text: 'Rewards' }));
    if (rw.coins) rewards.appendChild(h('span', { class: 'gb-rw' }, h('i', { class: 'gb-coin' }), '+' + fmtNum(rw.coins) + ' florins'));
    if (rw.xp) rewards.appendChild(h('span', { class: 'gb-rw', text: '+' + fmtNum(rw.xp) + ' XP' }));
    if (rw.skillPoints) rewards.appendChild(h('span', { class: 'gb-rw gb-rw-sp', text: '+' + rw.skillPoints + ' skill point' + (rw.skillPoints === 1 ? '' : 's') }));
    if (rewards.children.length > 1) { P.appendChild(rin(rewards, d)); d += 0.2; }

    const story = Array.isArray(r.story) ? r.story : r.story ? [r.story] : [];
    if (story.length) {
      const sEl = h('div', { class: 'gb-res-story' });
      story.forEach(function (line) { sEl.appendChild(h('p', { text: String(line) })); });
      P.appendChild(rin(sEl, d)); d += 0.25;
    }

    const cont = navBtn('gb-btn gb-btn-primary', 'continue', function () {
      const cb = onClose;
      hide();
      if (typeof cb === 'function') cb();
    }, { label: 'Continue', def: true });
    P.appendChild(rin(h('footer', { class: 'gb-res-foot' }, cont), d));

    res = { done: false, counters: counters, t0: performance.now(), raf: 0, timer: 0 };
    const me = res, DUR = 520;
    me.timer = setTimeout(function () { if (res === me) me.done = true; }, (d + 0.4) * 1000);
    const tick = function (now) {
      if (res !== me) return;
      const t = now - me.t0;
      let pending = false;
      for (let i = 0; i < counters.length; i++) {
        const c = counters[i];
        const p = Math.max(0, Math.min(1, (t - c.at) / DUR));
        if (p < 1) pending = true;
        c.el.textContent = c.fmt(c.to * (1 - Math.pow(1 - p, 3)));
      }
      if (pending) me.raf = requestAnimationFrame(tick);
    };
    showOnly('result');
    L.result.scrollTop = 0; P.scrollTop = 0;
    if (reducedMotion()) skipResult(); else me.raf = requestAnimationFrame(tick);
    focusEl(cont, true, true);
  }

  // ---------- fail ----------
  function showFail(reason, onRetry, onQuit) {
    init();
    cancelCapture(); closeConfirm(true); cleanupResult();
    view = 'fail'; screenName = null; screenParent = null; mapCanvas = null;
    const B = L.failBox;
    clear(B);
    const btns = h('div', { class: 'gb-btnrow gb-btnrow-c' });
    btns.appendChild(navBtn('gb-btn gb-btn-primary', 'retry', function () {
      hide();
      if (typeof onRetry === 'function') onRetry();
    }, { label: 'Retry', def: true }));
    if (typeof onQuit === 'function') {
      btns.appendChild(navBtn('gb-btn gb-btn-ghost', 'abandon', function () { hide(); onQuit(); }, { label: 'Abandon' }));
    }
    add(B, [
      h('h2', { class: 'gb-fail-title', 'data-text': 'Desynchronized', text: 'Desynchronized' }),
      h('div', { class: 'gb-rule gb-rule-red' }),
      h('p', { class: 'gb-fail-reason', text: reason || 'The mission has failed.' }),
      btns
    ]);
    showOnly('fail');
    focusDefault(L.fail, true);
  }

  // ---------- dialogue ----------
  function showDialog(lines, onDone) {
    init();
    if (dlg) endDialog(false);
    const list = (Array.isArray(lines) ? lines : lines ? [lines] : []).filter(function (l) { return l != null; }).map(function (l) {
      return typeof l === 'string' ? { who: '', text: l } : { who: l.who || '', text: l.text == null ? '' : String(l.text) };
    });
    if (!list.length) { if (typeof onDone === 'function') onDone(); return; }
    dlg = { lines: list, i: 0, n: 0, full: '', timer: 0, onDone: onDone };
    L.dialog.classList.add('gb-on');
    dlgLine();
  }
  function dlgPaint() {
    L.dlgTyped.textContent = dlg.full.slice(0, dlg.n);
    L.dlgGhost.textContent = dlg.full.slice(dlg.n);
    L.dlgBox.classList.toggle('gb-dlg-ready', dlg.n >= dlg.full.length);
  }
  function dlgLine() {
    const ln = dlg.lines[dlg.i];
    clearInterval(dlg.timer);
    L.dlgWho.textContent = ln.who;
    L.dlgWho.style.display = ln.who ? '' : 'none';
    L.dlgCount.textContent = dlg.lines.length > 1 ? (dlg.i + 1) + ' / ' + dlg.lines.length : '';
    dlg.full = ln.text;
    dlg.n = reducedMotion() ? dlg.full.length : 0;
    dlgPaint();
    if (dlg.n < dlg.full.length) {
      const me = dlg;
      me.timer = setInterval(function () {
        if (dlg !== me) { clearInterval(me.timer); return; }
        me.n = Math.min(me.full.length, me.n + 1);
        dlgPaint();
        if (me.n >= me.full.length) clearInterval(me.timer);
      }, 22);
    }
  }
  function dlgAdvance() {
    if (!dlg) return;
    if (dlg.n < dlg.full.length) {
      clearInterval(dlg.timer);
      dlg.n = dlg.full.length;
      dlgPaint();
      return;
    }
    dlg.i++;
    if (dlg.i >= dlg.lines.length) { endDialog(true); return; }
    sfx('uiMove');
    dlgLine();
  }
  function endDialog(callDone) {
    if (!dlg) return;
    clearInterval(dlg.timer);
    const cb = dlg.onDone;
    dlg = null;
    L.dialog.classList.remove('gb-on');
    if (callDone && typeof cb === 'function') cb();
  }

  // ---------- toast / banner ----------
  function toast(text, ms) {
    init();
    ms = ms == null ? 2600 : ms;
    const box = L.toasts;
    const live = Array.prototype.filter.call(box.children, function (c) { return !c.classList.contains('gb-out'); });
    while (live.length >= 3) { const old = live.shift(); if (old.parentNode) old.parentNode.removeChild(old); }
    const el = h('div', { class: 'gb-toast' }, h('i', { class: 'gb-toast-m' }), h('span', { text: text == null ? '' : String(text) }));
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('gb-out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, Math.max(300, ms));
  }
  function banner(title, sub, ms) {
    init();
    ms = ms == null ? 3200 : ms;
    clearTimeout(bannerTimer); clearTimeout(bannerTimer2);
    const B = L.banner;
    B.classList.remove('gb-on');
    L.bannerTitle.textContent = title == null ? '' : String(title);
    L.bannerSub.textContent = sub == null ? '' : String(sub);
    L.bannerSub.style.display = sub ? '' : 'none';
    void B.offsetWidth;
    B.classList.add('gb-on');
    bannerTimer = setTimeout(function () { B.classList.remove('gb-on'); }, Math.max(400, ms));
  }

  // ---------- input ----------
  function goBack() {
    if (view === 'screen') back();
    else if (view === 'pause') { sfx('uiBack'); hide(); game('resume'); }
  }
  function isAltBackKey(c) {
    if (NAVKEYS[c] || ACTKEYS[c] || c === 'Tab') return false;
    const k = (GB.input && GB.input.keys) || {};
    return (view === 'pause' && c === k.pause) || (view === 'screen' && screenName === 'map' && c === k.map);
  }
  function onKeyDown(e) {
    if (!built || !isOpen()) return;
    initAudio();
    e.stopPropagation();
    if (capAction) {
      e.preventDefault();
      if (!e.repeat) finishCapture(e.code);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const c = e.code;
    if (/^F\d+$/.test(c)) return;
    e.preventDefault();
    const act = !!ACTKEYS[c], esc = c === 'Escape';
    if (conf) {
      if (esc) { if (!e.repeat) { sfx('uiBack'); closeConfirm(); } return; }
    } else if (dlg) {
      if (e.repeat) return;
      if (esc) endDialog(true); else if (act) dlgAdvance();
      return;
    } else if (esc || isAltBackKey(c)) {
      if (!e.repeat) goBack();
      return;
    }
    let dir = NAVKEYS[c];
    if (c === 'Tab') dir = e.shiftKey ? 'prev' : 'next';
    if (dir) {
      const a = document.activeElement;
      if ((dir === 'left' || dir === 'right') && a && a.type === 'range' && root.contains(a)) { nudge(a, dir === 'right' ? 5 : -5); return; }
      move(dir);
      return;
    }
    if (act && !e.repeat) {
      if (view === 'result' && !conf && res && !res.done) { skipResult(); return; }
      const a = currentNav();
      if (!a) { focusDefault(null, false); return; }
      if (a.type === 'range') return;
      a.click();
    }
  }
  function onKeyUp(e) {
    if (!built || !isOpen()) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault();
  }
  function onRootMouseDown(e) {
    initAudio();
    if (capAction) {
      e.preventDefault(); e.stopPropagation();
      swallowClickUntil = performance.now() + 400;
      finishCapture('Mouse' + e.button);
      return;
    }
    const t = e.target;
    if (!(t && t.closest && t.closest('.gb-nav'))) e.preventDefault();   // keep keyboard focus where it is
  }
  function onRootClick(e) {
    if (performance.now() < swallowClickUntil) { e.preventDefault(); e.stopPropagation(); }
  }
  function onRootMouseMove(e) {
    if (e.clientX === lastMX && e.clientY === lastMY) return;
    lastMX = e.clientX; lastMY = e.clientY;
    if (capAction) return;
    const t = e.target && e.target.closest ? e.target.closest('.gb-nav') : null;
    if (!t || t.disabled || t.dataset.nohover || t === document.activeElement) return;
    const layer = topLayerEl();
    if (!layer || !layer.contains(t)) return;
    focusEl(t, false, true);
  }
  function onResize() {
    if (view === 'screen' && screenName === 'map') drawMap();
  }

  // ---------- build ----------
  function init() {
    if (built) return;
    root = document.getElementById('ui-root');
    if (!root) { root = h('div', { id: 'ui-root' }); document.body.appendChild(root); }
    built = true;
    root.classList.add('gb-ui');

    // main menu
    L.mainList = h('nav', { class: 'gb-menu gb-anim' });
    L.main = h('div', { class: 'gb-layer gb-main' },
      h('div', { class: 'gb-main-col' },
        h('div', { class: 'gb-title gb-anim' },
          h('h1', { class: 'gb-logo' }, h('span', { text: 'Ghost' }), h('span', { class: 'gb-logo-b', text: 'blade' })),
          h('div', { class: 'gb-logo-rule' }),
          h('div', { class: 'gb-tagline', text: 'Move unseen. Strike without warning.' })),
        L.mainList),
      hints(false));

    // pause
    L.pauseList = h('nav', { class: 'gb-menu' });
    L.pauseSub = h('div', { class: 'gb-psub' });
    L.pauseCtl = h('div', { class: 'gb-ctls' });
    L.pause = h('div', { class: 'gb-layer gb-pause' },
      h('div', { class: 'gb-pause-left gb-anim' },
        h('div', { class: 'gb-ptitle', text: 'Paused' }), L.pauseSub, h('div', { class: 'gb-logo-rule' }), L.pauseList),
      h('aside', { class: 'gb-pause-right gb-anim' },
        h('div', { class: 'gb-panel' }, h('div', { class: 'gb-panel-h', text: 'Controls' }), L.pauseCtl)),
      hints(true));

    // sub-screen shell
    L.backBtn = navBtn('gb-back', 'back', back, { snd: null });
    add(L.backBtn, [h('i', { class: 'gb-back-a' }), h('span', { text: 'Back' }), keyChip('Esc')]);
    L.screenTitle = h('h2', { class: 'gb-stitle' });
    L.screenStat = h('div', { class: 'gb-sstat' });
    L.screenBody = h('div', { class: 'gb-sbody' });
    L.screen = h('div', { class: 'gb-layer gb-screen' },
      h('header', { class: 'gb-shead' }, L.backBtn, L.screenTitle, L.screenStat),
      L.screenBody);

    // result
    L.resPanel = h('div', { class: 'gb-res' });
    L.result = h('div', { class: 'gb-layer gb-result' }, L.resPanel);

    // fail
    L.failBox = h('div', { class: 'gb-failbox' });
    L.fail = h('div', { class: 'gb-layer gb-fail' }, L.failBox);

    // dialogue
    L.dlgWho = h('div', { class: 'gb-dlg-who' });
    L.dlgTyped = h('span');
    L.dlgGhost = h('span', { class: 'gb-dlg-ghost' });
    L.dlgCount = h('span', { class: 'gb-dlg-count' });
    L.dlgBox = h('div', { class: 'gb-dlg' },
      L.dlgWho,
      h('p', { class: 'gb-dlg-text' }, L.dlgTyped, L.dlgGhost),
      h('div', { class: 'gb-dlg-foot' }, L.dlgCount,
        h('span', { class: 'gb-dlg-hint' }, keyChip('E'), ' Continue'),
        h('span', { class: 'gb-dlg-hint' }, keyChip('Esc'), ' Skip'),
        h('i', { class: 'gb-dlg-next' })));
    L.dialog = h('div', { class: 'gb-layer gb-dialog' }, L.dlgBox);
    L.dialog.addEventListener('click', function () { if (dlg) dlgAdvance(); });

    // confirm
    L.confTitle = h('h3', { class: 'gb-conf-title' });
    L.confText = h('p', { class: 'gb-conf-text' });
    L.confBtns = h('div', { class: 'gb-btnrow gb-btnrow-c' });
    L.confirm = h('div', { class: 'gb-layer gb-confirm' },
      h('div', { class: 'gb-cbox' }, L.confTitle, h('div', { class: 'gb-rule' }), L.confText, L.confBtns));

    // banner + toasts (non-blocking)
    L.bannerTitle = h('div', { class: 'gb-banner-t' });
    L.bannerSub = h('div', { class: 'gb-banner-s' });
    L.banner = h('div', { class: 'gb-banner', 'aria-live': 'polite' }, L.bannerTitle, h('div', { class: 'gb-banner-r' }), L.bannerSub);
    L.toasts = h('div', { class: 'gb-toasts', 'aria-live': 'polite' });

    add(root, [L.main, L.pause, L.screen, L.result, L.fail, L.banner, L.dialog, L.confirm, L.toasts]);

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('resize', onResize);
    root.addEventListener('mousedown', onRootMouseDown, true);
    root.addEventListener('click', onRootClick, true);
    root.addEventListener('mousemove', onRootMouseMove);
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // ---------- public API ----------
  GB.ui = {
    init: init,
    showMainMenu: showMainMenu,
    showPause: showPause,
    showScreen: function (name) { openScreen(name, null); },
    hide: hide,
    isOpen: isOpen,
    showResult: showResult,
    showFail: showFail,
    showDialog: showDialog,
    toast: toast,
    banner: banner
  };
})();
