/* RETRO WORLD — live site stats (Supabase).
   • Total views: stored in public.rw_site_stats, +1 once per browser session via rpc rw_hit_view()
   • Live updates: Supabase Realtime (postgres_changes on rw_site_stats) — every visitor's count
     ticks up the moment someone else opens the site
   • Online now: Realtime Presence on channel "rw-live"
   • If the realtime socket can't connect, falls back to polling rw_get_views every 15s */
(function () {
  'use strict';
  if (window.RWLive) return;
  var URL_ = 'https://boyllgyfvdtdxmfmpxks.supabase.co', KEY = 'sb_publishable_aCaqIVUczjqoKeCCV62A4g_6B7gBE2l';
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.js';
  var HIT = 'rw_view_hit_v2';
  var el, vEl, oEl, oWrap, shown = -1, target = -1, raf = 0, poll = 0, live = false;
  var calm = function () { return document.documentElement.classList.contains('rw-calm') || matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var fmt = function (n) { return Math.max(0, Math.round(n)).toLocaleString('en-GB'); };

  function rpc(fn) {
    return fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (v) { var n = typeof v === 'number' ? v : parseInt(v, 10); if (!isFinite(n)) throw new Error('bad'); return n; });
  }

  function setViews(n) {
    if (!(n >= 0)) return;
    if (n < target) return;               // never count backwards (late poll vs realtime)
    var bump = target >= 0 && n > target;
    target = n;
    el.classList.add('ok');
    if (shown < 0 || calm()) { shown = n; vEl.textContent = fmt(n); return; }
    if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    cancelAnimationFrame(raf);
    var from = shown, t0 = performance.now(), d = Math.min(1200, 300 + (n - from) * 60);
    (function step(t) { var k = Math.min(1, (t - t0) / d); k = 1 - Math.pow(1 - k, 3); shown = from + (n - from) * k; vEl.textContent = fmt(shown); if (k < 1) raf = requestAnimationFrame(step); else shown = n; })(t0);
  }
  function setOnline(n) { if (!(n > 0)) return; oWrap.hidden = false; oEl.textContent = fmt(n); oWrap.title = n === 1 ? 'Just you right now' : n + ' people on RETRO WORLD right now'; }

  function startPolling() {
    if (poll || live) return;
    poll = setInterval(function () { if (!document.hidden) rpc('rw_get_views').then(setViews).catch(function () {}); }, 15000);
  }
  function stopPolling() { clearInterval(poll); poll = 0; }

  function realtime() {
    var s = document.createElement('script'); s.src = SDK; s.async = true; s.crossOrigin = 'anonymous';
    var to = setTimeout(startPolling, 10000);
    s.onerror = function () { clearTimeout(to); startPolling(); };
    s.onload = function () {
      try {
        var sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
        var me = Math.random().toString(36).slice(2, 10);
        var ch = sb.channel('rw-live', { config: { presence: { key: me } } });
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rw_site_stats', filter: 'id=eq.site' }, function (p) { if (p && p.new) setViews(+p.new.views); })
          .on('presence', { event: 'sync' }, function () { try { setOnline(Object.keys(ch.presenceState()).length); } catch (e) {} })
          .subscribe(function (st) {
            if (st === 'SUBSCRIBED') { live = true; clearTimeout(to); stopPolling(); el.classList.add('live'); ch.track({ at: Date.now() }).catch(function () {}); rpc('rw_get_views').then(setViews).catch(function () {}); }
            else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { live = false; el.classList.remove('live'); startPolling(); }
          });
        window.RWLive.channel = ch;
      } catch (e) { clearTimeout(to); startPolling(); }
    };
    document.head.appendChild(s);
  }

  function mount() {
    var after = document.querySelector('.hero .rw-chips') || document.querySelector('.hero .rw-hero-cta');
    if (!after || document.getElementById('rwLive')) return;
    el = document.createElement('div');
    el.id = 'rwLive'; el.className = 'rw-live';
    el.innerHTML = '<span class="rw-live-v" title="Total RETRO WORLD views, updated live"><i aria-hidden="true">◉</i> <b>—</b> views</span>' +
      '<span class="rw-live-o" hidden><i aria-hidden="true"></i> <b>1</b> online now</span>';
    after.insertAdjacentElement('afterend', el);
    vEl = el.querySelector('.rw-live-v b'); oEl = el.querySelector('.rw-live-o b'); oWrap = el.querySelector('.rw-live-o');
    var first = false;
    try { first = !sessionStorage.getItem(HIT); sessionStorage.setItem(HIT, '1'); } catch (e) {}
    (first ? rpc('rw_hit_view') : rpc('rw_get_views')).then(setViews).catch(function () { el.classList.add('off'); });
    realtime();
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !live) rpc('rw_get_views').then(setViews).catch(function () {}); });
  }

  window.RWLive = { set: setViews };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
