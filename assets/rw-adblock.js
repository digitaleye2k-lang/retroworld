/* RETRO WORLD — friendly adblock notice */
(function () {
  'use strict';
  if (window.RETROWORLD_TV_DEVICE || window.RW_NO_ADS) return;
  var KEY = 'rw_adblock_dismissed';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}

  function baitBlocked() {
    var b = document.createElement('div');
    b.className = 'adsbox ad-banner ad-placement pub_300x250 textads banner-ads';
    b.setAttribute('aria-hidden', 'true');
    b.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:2px;height:2px;';
    b.innerHTML = '&nbsp;';
    document.body.appendChild(b);
    return new Promise(function (res) {
      setTimeout(function () {
        var cs = window.getComputedStyle(b);
        var blocked = !b.parentNode || b.offsetHeight === 0 || cs.display === 'none' || cs.visibility === 'hidden';
        if (b.parentNode) b.parentNode.removeChild(b);
        res(blocked);
      }, 250);
    });
  }

  function scriptBlocked() {
    if (!window.fetch || navigator.onLine === false) return Promise.resolve(false);
    return fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7935805760564580', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
      .then(function () { return false; }, function () { return true; });
  }

  function show() {
    if (document.getElementById('rwAdblock')) return;
    var st = document.createElement('style');
    st.textContent =
      '#rwAdblock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,2,7,.82);backdrop-filter:blur(3px);font-family:"Courier New",monospace;animation:rwAbIn .25s ease-out}' +
      '@keyframes rwAbIn{from{opacity:0}to{opacity:1}}' +
      '#rwAdblock .bx{max-width:460px;width:100%;background:#0e0b18;border:2px solid #ffd75e;box-shadow:0 0 0 4px #000,0 0 40px #ffd75e33;color:#e8e6ff;padding:26px 22px 20px;text-align:center}' +
      '#rwAdblock .ic{font-size:42px;line-height:1;margin-bottom:10px}' +
      '#rwAdblock h2{margin:0 0 10px;font:900 22px/1.2 Impact,"Arial Black",sans-serif;letter-spacing:1px;color:#ffd75e;text-transform:uppercase}' +
      '#rwAdblock p{margin:0 0 12px;font-size:14px;line-height:1.55;color:#cfcbe8}' +
      '#rwAdblock ol{text-align:left;margin:0 auto 16px;padding-left:20px;max-width:340px;font-size:13px;line-height:1.6;color:#a9a4cc}' +
      '#rwAdblock .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}' +
      '#rwAdblock button{font:700 14px "Courier New",monospace;padding:11px 16px;cursor:pointer;border:2px solid #000;letter-spacing:.5px}' +
      '#rwAdblock .go{background:#ffd75e;color:#111;box-shadow:3px 3px 0 #ff4f8b}' +
      '#rwAdblock .go:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 #ff4f8b}' +
      '#rwAdblock .no{background:transparent;color:#8d88b0;border-color:#3a3456}' +
      '#rwAdblock .no:hover{color:#e8e6ff;border-color:#8d88b0}' +
      '#rwAdblock button:focus-visible{outline:3px solid #7af;outline-offset:2px}';
    document.head.appendChild(st);
    var o = document.createElement('div');
    o.id = 'rwAdblock';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-labelledby', 'rwAbT');
    o.innerHTML =
      '<div class="bx"><div class="ic" aria-hidden="true">👾</div>' +
      '<h2 id="rwAbT">Ad blocker detected</h2>' +
      '<p>Please disable your ad blocker to support us, so we can keep making the best games for you. Ads keep RETRO WORLD <b>free</b> for everyone.</p>' +
      '<ol><li>Click your ad blocker icon in the browser toolbar</li><li>Choose <b>"Pause"</b> or <b>"Don\'t run on this site"</b></li><li>Hit <b>Reload</b> below</li></ol>' +
      '<div class="row"><button type="button" class="go" id="rwAbReload">↻ I\'VE DISABLED IT, RELOAD</button>' +
      '<button type="button" class="no" id="rwAbClose">Continue anyway</button></div></div>';
    document.body.appendChild(o);
    var close = function () {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      o.remove();
      document.removeEventListener('keydown', onKey);
    };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    document.getElementById('rwAbReload').onclick = function () { location.reload(); };
    document.getElementById('rwAbClose').onclick = close;
  }

  function run() {
    Promise.all([baitBlocked(), scriptBlocked()]).then(function (r) {
      if (r[0] || r[1]) show();
    });
  }
  if (document.readyState === 'complete') setTimeout(run, 1200);
  else window.addEventListener('load', function () { setTimeout(run, 1200); });
  window.RWAdblock = { show: show };
})();
