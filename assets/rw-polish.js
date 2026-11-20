/* RETRO WORLD — visual polish + accessibility layer (classic website view).
   • Library layout: Grid / Compact / List (remembered)
   • Display panel: layout, kids mode, larger text, high contrast, reduce motion
   • Tidier cards: one main Play button + a compact row of secondary links
   • Clear accessible names for Play / New tab / Guide buttons, skip link
   Classes on <html> (set before first paint by the inline head script):
   rw-layout-compact | rw-layout-list | rw-large | rw-contrast | rw-calm */
(function () {
  'use strict';
  var H = document.documentElement;
  var ls = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
             set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var LAYOUTS = [['grid', '▦', 'Grid'], ['compact', '▤', 'Compact'], ['list', '☰', 'List']];
  var OPTS = [['rw-large', 'rw_a11y_large', 'Larger text', 'Bigger text on cards, menus and descriptions'],
              ['rw-contrast', 'rw_a11y_contrast', 'High contrast', 'Brighter text and borders, calmer background'],
              ['rw-calm', 'rw_a11y_calm', 'Reduce motion', 'Stops blinking, hover zoom and background animation']];

  function layout() { return ls.get('rw_layout', 'grid'); }
  function setLayout(v) {
    ls.set('rw_layout', v);
    H.classList.toggle('rw-layout-compact', v === 'compact');
    H.classList.toggle('rw-layout-list', v === 'list');
    document.querySelectorAll('[data-layout]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-layout') === v ? 'true' : 'false'); });
  }
  function setOpt(cls, key, v) { H.classList.toggle(cls, v); ls.set(key, v ? '1' : '0'); syncPanel(); }

  /* ---------- cards ---------- */
  function titleOf(c) { var h = c.querySelector('h3'); return h ? h.textContent.trim() : 'this game'; }
  function tidy(card) {
    var t = titleOf(card);
    var main = card.querySelector(':scope > button.play');
    if (main && !main.hasAttribute('aria-label')) {
      var txt = main.textContent.trim();
      if (/^(▶\s*)?PLAY( NOW)?$/i.test(txt)) main.setAttribute('aria-label', 'Play ' + t);
    }
    var row = card.querySelector(':scope > .rw-actions');
    var extras = [].slice.call(card.querySelectorAll(':scope > a.play, :scope > .rwr-btn, :scope > button.play:not(:first-of-type)'))
      .filter(function (e) { return e !== main; });
    if (!extras.length) return;
    if (!row) { row = document.createElement('div'); row.className = 'rw-actions'; (main || card.lastElementChild).insertAdjacentElement('afterend', row); }
    extras.forEach(function (e) {
      var s = e.textContent.trim();
      if (e.tagName === 'A' && /NEW TAB/i.test(s)) { e.textContent = '↗ New tab'; e.setAttribute('aria-label', 'Open ' + t + ' in a new tab'); }
      else if (e.tagName === 'A' && /GUIDE/i.test(s)) { e.textContent = '📖 Guide'; e.setAttribute('aria-label', t + ' game guide and development notes'); }
      else if (/ITCH/i.test(s)) { e.setAttribute('aria-label', t + ' on itch.io (opens in a new tab)'); }
      else if (e.classList.contains('rwr-btn')) { e.setAttribute('aria-label', 'Rate and review ' + t); }
      row.appendChild(e);
    });
  }
  function tidyAll() { document.querySelectorAll('section.grid > article.card').forEach(tidy); }

  /* ---------- library toolbar: layout switch ---------- */
  function mountLayout() {
    var tools = document.querySelector('.rw-tools');
    if (!tools || document.getElementById('rwLayout')) return !!tools;
    var g = document.createElement('div');
    g.id = 'rwLayout'; g.className = 'rw-layout'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Library layout');
    g.innerHTML = LAYOUTS.map(function (l) { return '<button type="button" data-layout="' + l[0] + '" aria-pressed="false" title="' + l[2] + ' view"><span aria-hidden="true">' + l[1] + '</span> ' + l[2] + '</button>'; }).join('');
    g.addEventListener('click', function (e) { var b = e.target.closest('[data-layout]'); if (b) setLayout(b.getAttribute('data-layout')); });
    tools.appendChild(g);
    setLayout(layout());
    return true;
  }

  /* ---------- display / accessibility panel ---------- */
  var panel, pbtn;
  function syncPanel() {
    if (!panel) return;
    OPTS.forEach(function (o) { var i = panel.querySelector('[data-opt="' + o[0] + '"]'); if (i) i.checked = H.classList.contains(o[0]); });
    var k = panel.querySelector('[data-opt="kids"]'); if (k) k.checked = H.classList.contains('kids-mode');
  }
  function mountPanel() {
    var anchor = document.getElementById('kidsModeBtn') || document.getElementById('mobileModeBtn');
    if (!anchor || document.getElementById('rwA11yBtn')) return;
    pbtn = document.createElement('button');
    pbtn.type = 'button'; pbtn.id = 'rwA11yBtn'; pbtn.className = 'tv-mode-toggle rw-a11y-btn';
    pbtn.setAttribute('aria-expanded', 'false'); pbtn.setAttribute('aria-controls', 'rwA11y');
    pbtn.innerHTML = '<span aria-hidden="true">Aa</span> DISPLAY';
    pbtn.title = 'Layout, kids mode, text size, contrast and motion';
    anchor.insertAdjacentElement('afterend', pbtn);
    panel = document.createElement('div');
    panel.id = 'rwA11y'; panel.className = 'rw-a11y'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Display and accessibility settings');
    panel.innerHTML = '<div class="rw-a11y-h"><b>Display &amp; accessibility</b><button type="button" class="rw-a11y-x" aria-label="Close">✕</button></div>' +
      '<div class="rw-a11y-l">Game library layout</div><div class="rw-layout" role="group" aria-label="Library layout">' +
      LAYOUTS.map(function (l) { return '<button type="button" data-layout="' + l[0] + '" aria-pressed="false"><span aria-hidden="true">' + l[1] + '</span> ' + l[2] + '</button>'; }).join('') + '</div>' +
      '<label class="rw-sw"><input type="checkbox" data-opt="kids"><span><b>🧸 Kids mode</b><small>Hide games with realistic violence</small></span></label>' +
      OPTS.map(function (o) { return '<label class="rw-sw"><input type="checkbox" data-opt="' + o[0] + '"><span><b>' + o[2] + '</b><small>' + o[3] + '</small></span></label>'; }).join('');
    document.body.appendChild(panel);
    panel.addEventListener('click', function (e) { var b = e.target.closest('[data-layout]'); if (b) setLayout(b.getAttribute('data-layout')); if (e.target.closest('.rw-a11y-x')) close(true); });
    panel.addEventListener('change', function (e) {
      var i = e.target; if (!i.matches('input[data-opt]')) return;
      var k = i.getAttribute('data-opt');
      if (k === 'kids') { if (window.RWKIDS) RWKIDS.set(i.checked); setTimeout(syncPanel, 50); return; }
      OPTS.forEach(function (o) { if (o[0] === k) setOpt(o[0], o[1], i.checked); });
    });
    function place() { var r = pbtn.getBoundingClientRect(); panel.style.top = Math.round(r.bottom + 8) + 'px'; panel.style.right = Math.max(8, Math.round(innerWidth - r.right)) + 'px'; }
    function open() { place(); panel.hidden = false; pbtn.setAttribute('aria-expanded', 'true'); syncPanel(); setLayout(layout()); var f = panel.querySelector('[aria-pressed="true"]') || panel.querySelector('button'); if (f) f.focus(); }
    function close(refocus) { if (panel.hidden) return; panel.hidden = true; pbtn.setAttribute('aria-expanded', 'false'); if (refocus) pbtn.focus(); }
    pbtn.addEventListener('click', function () { panel.hidden ? open() : close(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { close(true); } });
    document.addEventListener('click', function (e) { if (!panel.hidden && !panel.contains(e.target) && e.target !== pbtn && !pbtn.contains(e.target) && !e.target.closest('.rw-kids-modal')) close(false); });
    addEventListener('resize', function () { if (!panel.hidden) place(); });
    addEventListener('scroll', function () { if (!panel.hidden) place(); }, { passive: true });
    window.addEventListener('rw-kids-change', syncPanel);
  }

  function skipLink() {
    if (document.querySelector('.rw-skip')) return;
    var a = document.createElement('a'); a.className = 'rw-skip'; a.href = '#games'; a.textContent = 'Skip to games';
    document.body.insertBefore(a, document.body.firstChild);
  }

  function init() {
    skipLink();
    tidyAll();
    mountPanel();
    var tries = 0;
    (function waitTools() { if (!mountLayout() && tries++ < 40) setTimeout(waitTools, 150); })();
    var grid = document.querySelector('section.grid');
    if (grid) {
      var pend = 0;
      new MutationObserver(function (m) {
        if (pend) return;
        if (!m.some(function (r) { return r.type === 'childList' && r.target !== grid; })) return;
        pend = requestAnimationFrame(function () { pend = 0; tidyAll(); });
      }).observe(grid, { childList: true, subtree: true });
    }
    setTimeout(tidyAll, 1500); setTimeout(tidyAll, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.RWLayout = { set: setLayout, get: layout };
})();
