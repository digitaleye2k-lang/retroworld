/* RetroWorld TV v1.2: menu focus, remote Back, and gamepad menu navigation.
   Deliberately does not remap buttons inside games. */
(() => {
  'use strict';
  const body = document.body;
  const toggle = document.getElementById('tvModeBtn');
  const rail = document.getElementById('tvCategoryRail');
  const categorySelect = document.getElementById('categorySelect');
  const hint = document.getElementById('tvModeHint');
  const STORE = 'retroWorldTVMode';
  const saved = (() => { try { return localStorage.getItem(STORE); } catch (_) { return null; } })();
  const query = new URLSearchParams(location.search).get('tv');
  const initial = query === '1' || query === 'on' || query === 'true' ||
    (query !== '0' && query !== 'off' && (window.RETROWORLD_TV_DEVICE || saved === 'on'));
  let tvOn = false;
  let previousFocus = null;
  let previousDialog = null;
  let lastGamePadState = [];
  let lastAxisMove = 0;
  let comboStart = 0;
  let comboDidExit = false;

  function inGame() { return !!document.querySelector('#player.open'); }
  function currentDialog() {
    // Topmost first: focus must not escape a dialog to elements behind it.
    for (const sel of ['#adminViewerModal.open','#dustDemoModal.open','#reportModal.open',
      '#profileModal.open','#profileChooserModal.open','#onboardingModal.open']) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function visible(el) {
    if (!el || el.disabled || el.getAttribute('aria-hidden') === 'true' || el.closest('[inert]')) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility !== 'visible') return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  function focusable() {
    const root = currentDialog() || document;
    const nodes = root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
    return Array.from(nodes).filter(el => visible(el) && (!el.closest('.card.category-hidden')));
  }
  function scrollToFocus(el) {
    if (!el) return;
    try { el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'}); } catch (_) { el.scrollIntoView(); }
  }
  function focusIt(el) {
    if (!el || !visible(el)) return;
    try { el.focus({preventScroll:true}); } catch (_) { el.focus(); }
    scrollToFocus(el);
  }
  function ensureFocused() {
    if (!tvOn || inGame()) return;
    const list = focusable();
    if (!list.length) return;
    if (list.includes(document.activeElement)) return;
    const dialog = currentDialog();
    const preference = dialog ? dialog.querySelector('#tvQuickCreate, #profileChooserGuest, .profile-close, #reportClose') :
      document.querySelector('.tv-category-chip.active') || document.querySelector('.tv-category-chip') || document.querySelector('#profileBtn');
    focusIt(preference && list.includes(preference) ? preference : list[0]);
  }
  function directionMove(dir) {
    if (!tvOn || inGame()) return;
    const list = focusable();
    if (!list.length) return;
    const current = document.activeElement;
    if (!list.includes(current)) { ensureFocused(); return; }
    const r = current.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    let best = null, score = Infinity;
    for (const el of list) {
      if (el === current) continue;
      const q = el.getBoundingClientRect();
      const dx = q.left + q.width/2 - cx, dy = q.top + q.height/2 - cy;
      const major = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      const minor = (dir === 'left' || dir === 'right') ? Math.abs(dy) : Math.abs(dx);
      if (major < 6) continue;
      const candidate = major + minor * 2.5 + (minor > major * 2 ? 3000 : 0);
      if (candidate < score) { score = candidate; best = el; }
    }
    if (best) { previousFocus = current; focusIt(best); }
  }
  function tvBack() {
    if (inGame()) { document.getElementById('closeBtn')?.click(); return; }
    const actions = [
      ['#adminViewerModal.open','#adminViewerClose'],
      ['#dustDemoModal.open','#dustDemoClose'],
      ['#reportModal.open','#reportClose'],
      ['#profileModal.open','#profileClose'],
      ['#profileChooserModal.open','#profileChooserGuest'],
      ['#onboardingModal.open','#onboardingGuest']
    ];
    for (const [modal,button] of actions) {
      if (document.querySelector(modal)) { document.querySelector(button)?.click(); setTimeout(ensureFocused,40); return; }
    }
    if (previousFocus && visible(previousFocus)) { focusIt(previousFocus); previousFocus = null; return; }
    const games = document.getElementById('games');
    games?.scrollIntoView({behavior:'auto',block:'start'});
    const activeCategory = document.querySelector('.tv-category-chip.active');
    focusIt(activeCategory || document.querySelector('.tv-category-chip') || document.querySelector('#profileBtn'));
  }
  function openActive() {
    if (!tvOn || inGame()) return;
    const el = document.activeElement;
    if (!el || el === document.body || !visible(el)) { ensureFocused(); return; }
    if (el.tagName === 'SELECT') { el.click(); return; }
    if (el.matches('button, a[href]')) el.click();
    else if (el.tagName === 'INPUT') el.focus();
  }
  function categories() {
    if (!rail || !categorySelect) return;
    if (!rail.children.length) Array.from(categorySelect.options).forEach(opt => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tv-category-chip';
      button.dataset.category = opt.value; button.textContent = opt.textContent;
      button.addEventListener('click', () => {
        categorySelect.value = opt.value;
        categorySelect.dispatchEvent(new Event('change',{bubbles:true}));
        updateCategories();
        const first = document.querySelector('.card:not(.category-hidden) .play');
        if (first) focusIt(first);
      });
      rail.appendChild(button);
    });
    updateCategories();
  }
  function updateCategories() {
    if (!rail || !categorySelect) return;
    Array.from(rail.children).forEach(b => {
      const chosen = b.dataset.category === categorySelect.value;
      b.classList.toggle('active',chosen);
      b.setAttribute('aria-pressed',chosen ? 'true':'false');
    });
  }
  function setMode(on,persist) {
    tvOn = !!on;
    body.classList.toggle('tv-mode',tvOn);
    if (toggle) {
      toggle.textContent = tvOn ? '▣ TV MODE: ON' : '▣ TV MODE';
      toggle.setAttribute('aria-pressed',tvOn ? 'true':'false');
    }
    hint?.setAttribute('aria-hidden',tvOn ? 'false':'true');
    if (persist) { try { localStorage.setItem(STORE,tvOn ? 'on':'off'); } catch (_) {} }
    if (tvOn) {
      // TV GPUs are significantly happier without full-screen animated canvases.
      const background = document.getElementById('bgSelect');
      if (background && background.value !== 'static') {
        background.value = 'static'; background.dispatchEvent(new Event('change',{bubbles:true}));
      }
      requestAnimationFrame(ensureFocused);
    }
    window.dispatchEvent(new CustomEvent('retroworld:tv-mode',{detail:{enabled:tvOn}}));
  }
  window.RETROWORLD_TV = {enable:()=>setMode(true,true),disable:()=>setMode(false,true),toggle:()=>setMode(!tvOn,true),isEnabled:()=>tvOn};
  categories();
  categorySelect?.addEventListener('change',updateCategories);
  toggle?.addEventListener('click',()=>setMode(!tvOn,true));
  setMode(initial,false);

  // Direct, no-keyboard local profile creation via the existing tested profile handler.
  const quick = document.getElementById('tvQuickCreate');
  quick?.addEventListener('click', () => {
    const name = document.getElementById('onboardingName');
    const bg = document.getElementById('onboardingBackground');
    if (name && !name.value.trim()) name.value = 'TV PLAYER';
    if (bg) bg.value = 'static';
    document.getElementById('onboardingCreate')?.click();
    setTimeout(ensureFocused,80);
  });

  // Opening a dialog triggers focus housekeeping; game frame keeps keyboard/gamepad focus.
  addEventListener('click',()=>setTimeout(ensureFocused,40),false);
  addEventListener('focusin',e=>{if (!tvOn || inGame()) return; if (currentDialog() && !currentDialog().contains(e.target)) setTimeout(ensureFocused,0);},false);
  new MutationObserver(()=>{
    if (!tvOn) return;
    const current = currentDialog();
    if (current !== previousDialog) { previousDialog = current; setTimeout(ensureFocused,50); }
  }).observe(body,{subtree:true,attributes:true,attributeFilter:['class']});

  addEventListener('keydown', e => {
    if (!tvOn) return;
    const code = e.keyCode || e.which;
    const tag = e.target && e.target.tagName;
    const editing = ['INPUT','TEXTAREA'].includes(tag);
    if ((code === 461 || e.key === 'BrowserBack' || e.key === 'Backspace') && !editing) {
      e.preventDefault(); e.stopPropagation(); tvBack(); return;
    }
    if (inGame()) return; // keep arrows, A/B and Start for actual game logic
    if (editing) return;
    const mapping = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
    const keyDirection = mapping[e.key] || ({37:'left',38:'up',39:'right',40:'down'})[code];
    if (keyDirection && tag !== 'SELECT') {
      e.preventDefault(); e.stopPropagation(); directionMove(keyDirection);
    }
  },true);
  // This is sent by a *same-origin* game iframe for LG remote Back.
  addEventListener('message',e=>{
    if (!tvOn || e.source !== document.getElementById('gameframe')?.contentWindow || (e.origin !== location.origin && !(location.protocol === 'file:' && e.origin === 'null'))) return;
    if (e.data && e.data.type === 'retroworld-tv-back') tvBack();
  });

  function tickPad() {
    if (!tvOn || !navigator.getGamepads || document.hidden) return;
    let gp;
    try { gp = Array.from(navigator.getGamepads()||[]).find(Boolean); } catch (_) { return; }
    if (!gp) { lastGamePadState=[]; comboStart=0; comboDidExit=false; return; }
    const pressed = i=>!!(gp.buttons[i]&&gp.buttons[i].pressed);
    const edge = i=>pressed(i)&&!lastGamePadState[i];
    const now=Date.now();
    if (inGame()) {
      // Avoid stealing B for exit: B is a legitimate attack/jump button in many games.
      // Long hold SELECT + START to close a game; remote BACK also works.
      if (pressed(8) && pressed(9)) {
        if (!comboStart) comboStart = now;
        else if (!comboDidExit && now - comboStart >= 650) {
          comboDidExit=true;
          document.getElementById('closeBtn')?.click();
        }
      } else { comboStart=0; comboDidExit=false; }
    } else {
      let dir = null;
      if (edge(14) || (gp.axes[0] < -0.6 && now-lastAxisMove>190)) dir='left';
      else if (edge(15) || (gp.axes[0] > 0.6 && now-lastAxisMove>190)) dir='right';
      else if (edge(12) || (gp.axes[1] < -0.6 && now-lastAxisMove>190)) dir='up';
      else if (edge(13) || (gp.axes[1] > 0.6 && now-lastAxisMove>190)) dir='down';
      if (dir) { directionMove(dir); lastAxisMove=now; }
      if (edge(0)) openActive();
      if (edge(1)) tvBack();
    }
    lastGamePadState = Array.from(gp.buttons,b=>!!b.pressed);
  }
  // At 50 ms menu polling uses less CPU than running two separate per-frame loops.
  setInterval(tickPad,50);
})();
