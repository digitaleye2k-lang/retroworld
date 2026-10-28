(()=>{
'use strict';
let games=[],built=false,root=null,tab='home',filter='all',ads=0;
const $=id=>document.getElementById(id);
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CATS=[['all','ALL','#2a475e'],['epic3d','EPIC & 3D','#6a3fb5'],['arcade','ARCADE','#c7551b'],['puzzle','PUZZLE','#1b7a8c'],['shooter','SHOOTER','#a3262e'],['space','SPACE','#2e3fa3'],['sports','SPORTS','#2c8a3e'],['survival','SURVIVAL','#6b5a2b'],['board','BOARD','#7a4a2b'],['platform','PLATFORM','#b0397a'],['fighting','FIGHTING','#8a2323'],['driving','DRIVING','#2b6e8a'],['defense','DEFENSE','#3a5a7a'],['premium','PREMIUM','#9a7a12']];
function read(){games=[...document.querySelectorAll('article.card')].map(c=>{const b=c.querySelector('[data-game]');if(!b)return null;const id=b.dataset.game,slug=id.replace('.html','');return{btn:b,id,slug,title:((c.querySelector('h3')||{}).textContent||slug).trim(),desc:((c.querySelector('p')||{}).textContent||'').trim(),tags:((c.querySelector('.tags')||{}).textContent||'').trim(),cats:(c.dataset.categories||'').split(/\s+/),isNew:c.dataset.new==='1',locked:c.classList.contains('premium-locked')}}).filter(Boolean)}
const img=g=>"background-image:url('assets/thumbs/"+g.slug+".jpg')";
const byCat=c=>c==='all'?games:c==='premium'?games.filter(g=>g.cats.includes('premium')||g.locked):games.filter(g=>g.cats.includes(c));
const bd=g=>g.locked?'<span class="m-bd lock">🔒 PREMIUM</span>':g.cats.includes('epic3d')?'<span class="m-bd">EPIC</span>':g.isNew?'<span class="m-bd">NEW</span>':'';
const find=id=>games.find(g=>g.id===id);
function play(g){g.btn.click()}
function cap(g){return '<button class="m-cap" data-open="'+g.id+'"><div class="im" style="'+img(g)+'">'+bd(g)+'</div><div class="nm">'+esc(g.title)+'</div></button>'}
function row(g){return '<button class="m-row" data-open="'+g.id+'"><div class="im" style="'+img(g)+'">'+bd(g)+'</div><div class="tx"><div class="tt">'+esc(g.title)+'</div><div class="tg">'+esc(g.tags)+'</div></div><span class="pl'+(g.locked?' lock':'')+'" data-play="'+g.id+'" role="button">'+(g.locked?'🔒':'▶ PLAY')+'</span></button>'}
function rowsWithAds(L){let h='';L.forEach((g,i)=>{h+=row(g);if((i+1)%9===0&&i<L.length-1)h+='<div class="m-adslot" data-adslot="1"></div>'});return h}
function section(t,L,more){return L.length?'<div class="m-sec"><h3><span>'+t+'</span>'+(more?'<button data-more="'+more+'">SEE ALL ›</button>':'')+'</h3><div class="m-hs">'+L.map(cap).join('')+'</div></div>':''}
function home(){const feat=games.filter(g=>g.isNew||g.cats.includes('epic3d')).slice(0,8);
 return '<div class="m-sec" style="padding-top:12px"><h3><span>Featured &amp; Recommended</span></h3><div class="m-hs">'+feat.map(g=>'<div class="m-feat" data-open="'+g.id+'"><div class="im" style="'+img(g)+'"></div><div class="in"><h4>'+esc(g.title)+'</h4><div class="m-tags">'+esc(g.tags)+'</div><button class="m-go" data-play="'+g.id+'">'+(g.locked?'🔒 UNLOCK':'▶ PLAY NOW')+'</button></div></div>').join('')+'</div></div>'
 +'<div class="m-adslot" data-adslot="1"></div>'
 +'<button class="m-btn" data-rand="1">🎲 SURPRISE ME<small>Jump into a random free game</small></button>'
 +section('New releases',games.filter(g=>g.isNew).slice(0,12),'all')
 +section('Epic &amp; 3D',byCat('epic3d'),'epic3d')
 +'<div class="m-sec"><h3><span>Browse by category</span></h3><div class="m-cats">'+CATS.slice(1,13).map(c=>'<button class="m-cat" style="background:linear-gradient(135deg,'+c[2]+',#171a21 160%)" data-more="'+c[0]+'">'+c[1]+'</button>').join('')+'</div></div>'
 +section('Arcade',byCat('arcade').slice(0,12),'arcade')+section('Puzzle',byCat('puzzle').slice(0,12),'puzzle')+section('Premium',byCat('premium'),'premium')}
function library(){return '<div class="m-chips">'+CATS.map(c=>'<button class="m-chip'+(c[0]===filter?' on':'')+'" data-chip="'+c[0]+'">'+c[1]+'</button>').join('')+'</div>'+rowsWithAds(byCat(filter))}
function searchV(){return '<div class="m-search"><input id="mQ" type="search" placeholder="Search games…" autocomplete="off"></div><div id="mRes">'+rowsWithAds(games.slice(0,18))+'</div>'}
function profile(){let n='Guest';try{const p=window.RWP&&RWP.active&&RWP.active();if(p&&p.name)n=p.name}catch(e){}
 return '<div class="m-prof"><div class="av">🎮</div><div><b>'+esc(n)+'</b><div style="font-size:12px;color:#8ba6ba;margin-top:3px">Retro World player</div></div></div>'
 +'<button class="m-btn" data-act="profile">🏆 PROFILE, TROPHIES &amp; TOKENS<small>Open your trophy room and Token Vault</small></button>'
 +'<button class="m-btn" data-act="console">🎮 CONSOLE MODE<small>PS4 / Xbox / Switch style menu</small></button>'
 +'<button class="m-btn" data-act="classic">🖥 CLASSIC VIEW<small>The normal Retro World website</small></button>'}
function render(){const b=root.querySelector('.m-body');b.innerHTML=tab==='home'?home():tab==='lib'?library():tab==='search'?searchV():profile();b.scrollTop=0;root.querySelectorAll('.m-nav button').forEach(x=>x.classList.toggle('on',x.dataset.tab===tab));mountAds()}
function mountAds(){ads=0;root.querySelectorAll('[data-adslot]').forEach(s=>{if(ads>=3||!window.RWAd){s.remove();return}ads++;const el=window.RWAd(s,'m-ad');if(!el)s.remove()})}
function detail(id){const g=find(id);if(!g)return;const d=$('mDetail');d.innerHTML='<div class="hero" style="'+img(g)+'"><button class="back" aria-label="Back">‹</button></div><div class="info"><h2>'+esc(g.title)+'</h2><div class="m-tags">'+esc(g.tags)+'</div><button class="m-go go" data-play="'+g.id+'">'+(g.locked?'🔒 UNLOCK INFO':'▶ PLAY NOW')+'</button><p>'+esc(g.desc)+'</p><a href="play/'+g.slug+'.html">ⓘ FULL DETAILS PAGE</a></div>';d.classList.add('open');d.scrollTop=0}
function build(){if(built)return;built=true;root=document.createElement('div');root.id='rwMob';
 root.innerHTML='<div class="m-head"><div class="m-logo"><b>RETRO</b> WORLD</div><button class="m-ic" data-tab="search" aria-label="Search">🔍</button></div><div class="m-body"></div><div class="m-nav"><button data-tab="home" class="on"><i>🏠</i>STORE</button><button data-tab="lib"><i>📚</i>LIBRARY</button><button data-tab="search"><i>🔍</i>SEARCH</button><button data-tab="prof"><i>👤</i>PROFILE</button></div><div id="mDetail"></div>';
 document.body.appendChild(root);
 root.addEventListener('click',e=>{const t=e.target;let x;
  if((x=t.closest('[data-play]'))){e.stopPropagation();const g=find(x.dataset.play);if(g)play(g);return}
  if((x=t.closest('.back'))){$('mDetail').classList.remove('open');return}
  if((x=t.closest('[data-tab]'))){tab=x.dataset.tab;$('mDetail').classList.remove('open');render();if(tab==='search')setTimeout(()=>{const q=$('mQ');q&&q.focus()},50);return}
  if((x=t.closest('[data-chip]'))){filter=x.dataset.chip;render();return}
  if((x=t.closest('[data-more]'))){filter=x.dataset.more;tab='lib';render();return}
  if(t.closest('[data-rand]')){const L=games.filter(g=>!g.locked);const g=L[Math.floor(Math.random()*L.length)];if(g)detail(g.id);return}
  if((x=t.closest('[data-act]'))){const a=x.dataset.act;if(a==='profile'){window.RWP&&RWP.openProfile&&RWP.openProfile()}else if(window.RWConsole)RWConsole.set(a);return}
  if((x=t.closest('[data-open]'))){detail(x.dataset.open);return}});
 root.addEventListener('input',e=>{if(e.target.id!=='mQ')return;const q=e.target.value.trim().toLowerCase();const L=q?games.filter(g=>(g.title+' '+g.tags).toLowerCase().includes(q)):games.slice(0,18);$('mRes').innerHTML=L.length?L.map(row).join(''):'<div style="padding:30px;text-align:center;color:#7f95a6">No games found.</div>'})}
window.RWMobile={show(v){if(v){build();read();render()}}};
})();
