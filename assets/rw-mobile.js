(()=>{
'use strict';
/* RETRO WORLD mobile mode — Play-Store-style storefront */
let games=[],built=false,root=null,tab='home',filter='all',ads=0,sortBy='default',scrollMem={};
const $=id=>document.getElementById(id);
const ls={get(k,d){try{return localStorage.getItem(k)||d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CATS=[['all','All','🎮'],['new','New','✨'],['epic3d','Epic & 3D','🌌'],['arcade','Arcade','🕹️'],['puzzle','Puzzle','🧩'],['shooter','Shooter','🎯'],['space','Space','🚀'],['sports','Sports','⚽'],['survival','Survival','🧟'],['board','Board','♟️'],['platform','Platform','🍄'],['fighting','Fighting','🥊'],['driving','Driving','🏎️'],['defense','Defense','🛡️'],['premium','Premium','👑']];
const GRAD=['#4285f4,#1a3c8f','#34a853,#0b5a2a','#ea4335,#7a1b14','#fbbc04,#8a5a00','#a142f4,#4b1b8a','#00acc1,#00525c','#ff6d00,#8a3300','#ec407a,#7a1840'];
function read(){games=[...document.querySelectorAll('article.card')].map(c=>{const b=c.querySelector('[data-game]');if(!b)return null;const id=b.dataset.game,slug=id.replace('.html','');return{btn:b,id,slug,title:((c.querySelector('h3')||{}).textContent||slug).trim(),desc:((c.querySelector('p')||{}).textContent||'').trim(),tags:((c.querySelector('.tags')||{}).textContent||'').trim(),cats:(c.dataset.categories||'').split(/\s+/),isNew:c.dataset.new==='1',locked:c.classList.contains('premium-locked')}}).filter(Boolean);games.forEach((g,i)=>g.hue=GRAD[(g.slug.length+i)%GRAD.length])}
const img=g=>"background-image:url('assets/thumbs/"+g.slug+".jpg')";
const byCat=c=>c==='all'?games:c==='new'?games.filter(g=>g.isNew):c==='premium'?games.filter(g=>g.cats.includes('premium')||g.locked):games.filter(g=>g.cats.includes(c));
const TC=t=>String(t||'').toLowerCase().replace(/(^|[\s\-:(&\/])([a-z0-9])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(Of|The|And)\b(?!$)/g,x=>x.toLowerCase()).replace(/\bUfo\b/g,'UFO').replace(/\b(3d|2d|Fps)\b/gi,x=>x.toUpperCase());
const find=id=>games.find(g=>g.id===id);
const genre=g=>{const t=(g.tags||'').split(/[•·|,\/]/)[0].trim();return TC(t||'Arcade')};
const badge=g=>g.locked?'<i class="bd pr">PREMIUM</i>':g.isNew?'<i class="bd nw">NEW</i>':'';
function play(g){g.btn.click()}
function tile(g){return '<button class="t" data-open="'+g.id+'"><span class="ic" style="'+img(g)+'">'+badge(g)+'</span><b>'+esc(TC(g.title))+'</b><small>'+esc(genre(g))+'</small></button>'}
function lrow(g,n){return '<button class="lr" data-open="'+g.id+'">'+(n?'<em>'+n+'</em>':'')+'<span class="ic" style="'+img(g)+'"></span><span class="tx"><b>'+esc(TC(g.title))+'</b><small>'+esc(genre(g))+(g.locked?' • Premium':' • Free')+'</small></span></button>'}
function sec(t,sub,L,more,cls){return L.length?'<div class="sc"><div class="sh2"><div><h3>'+t+'</h3>'+(sub?'<small>'+sub+'</small>':'')+'</div>'+(more?'<button class="mo" data-more="'+more+'" aria-label="See all">→</button>':'')+'</div><div class="hs '+(cls||'')+'">'+L.map(tile).join('')+'</div></div>':''}
function listSec(t,sub,L,more){if(!L.length)return'';const cols=[];for(let i=0;i<L.length;i+=3)cols.push(L.slice(i,i+3));return '<div class="sc"><div class="sh2"><div><h3>'+t+'</h3>'+(sub?'<small>'+sub+'</small>':'')+'</div>'+(more?'<button class="mo" data-more="'+more+'" aria-label="See all">→</button>':'')+'</div><div class="hs cols">'+cols.map((c,ci)=>'<div class="col">'+c.map((g,i)=>lrow(g,ci*3+i+1)).join('')+'</div>').join('')+'</div></div>'}
function adSlot(){return '<div class="adslot" data-adslot="1"></div>'}
function played(){try{const p=window.RWP&&RWP.active&&RWP.active();if(!p||!p.stats)return[];return games.filter(g=>{const s=p.stats[g.id]||p.stats[g.slug];return s&&s.plays>0}).sort((a,b)=>{const sa=p.stats[a.id]||p.stats[a.slug],sb=p.stats[b.id]||p.stats[b.slug];return(sb.plays||0)-(sa.plays||0)}).slice(0,12)}catch(e){return[]}}
function hero(){const L=games.filter(g=>g.isNew||g.cats.includes('epic3d')).slice(0,7);
 return '<div class="hero" id="mHero">'+L.map(g=>'<div class="hc" data-open="'+g.id+'" style="'+img(g)+'"><div class="sh"></div><div class="hi"><i class="bd nw">'+(g.cats.includes('epic3d')?'EPIC':'NEW')+'</i><h2>'+esc(TC(g.title))+'</h2><small>'+esc(genre(g))+' • Free</small><button class="go" data-play="'+g.id+'">'+(g.locked?'Unlock':'Play')+'</button></div></div>').join('')+'</div><div class="dots" id="mDots">'+L.map((_,i)=>'<i'+(i?'':' class="on"')+'></i>').join('')+'</div>'}
function home(){const pl=played(),fresh=games.filter(g=>g.isNew),epic=byCat('epic3d'),free=games.filter(g=>!g.locked&&!g.isNew&&!g.cats.includes('epic3d'));
 const sh=free.slice().sort((a,b)=>a.slug.charCodeAt(2)-b.slug.charCodeAt(2));
 return hero()
 +(pl.length?sec('Continue playing','Pick up where you left off',pl):'')
 +sec('New &amp; updated','Fresh games just added',fresh.slice(0,14),'new')
 +adSlot()
 +listSec('Top picks for you','Handpicked arcade favourites',sh.slice(0,12),'all')
 +sec('Epic &amp; 3D','Big, beautiful and bold',epic,'epic3d')
 +'<div class="sc"><div class="sh2"><div><h3>Browse categories</h3></div></div><div class="cg">'+CATS.slice(2,14).map((c,i)=>'<button class="cb" style="--g:'+GRAD[i%GRAD.length]+'" data-more="'+c[0]+'"><span>'+c[2]+'</span>'+c[1]+'</button>').join('')+'</div></div>'
 +sec('Arcade classics','Quick pick-up-and-play',byCat('arcade').slice(0,14),'arcade')
 +adSlot()
 +sec('Brain teasers','Puzzle &amp; board games',byCat('puzzle').concat(byCat('board')).slice(0,14),'puzzle')
 +sec('Premium','Exclusive games to unlock',byCat('premium'),'premium')
 +'<footer class="mf">Retro World • free browser arcade<br><button data-act="classic">Open the classic website</button></footer>'}
function library(){let L=byCat(filter).slice();if(sortBy==='az')L.sort((a,b)=>a.title.localeCompare(b.title));else if(sortBy==='new')L.sort((a,b)=>(b.isNew|0)-(a.isNew|0));
 let h='<div class="ch">'+CATS.map(c=>'<button class="chip'+(c[0]===filter?' on':'')+'" data-chip="'+c[0]+'">'+c[2]+' '+c[1]+'</button>').join('')+'</div><div class="sortbar"><span>'+L.length+' games</span><div><button class="'+(sortBy==='default'?'on':'')+'" data-sort="default">Featured</button><button class="'+(sortBy==='az'?'on':'')+'" data-sort="az">A–Z</button><button class="'+(sortBy==='new'?'on':'')+'" data-sort="new">Newest</button></div></div><div class="grid">';
 L.forEach((g,i)=>{h+=tile(g);if((i+1)%12===0&&i<L.length-1)h+='<div class="adslot full" data-adslot="1"></div>'});return h+'</div>'}
function searchV(){return '<div class="sr"><div class="pill big"><span>🔍</span><input id="mQ" type="search" placeholder="Search games" autocomplete="off"></div><div id="mRes"><h4>Popular right now</h4>'+games.filter(g=>!g.locked).slice(0,18).map(g=>lrow(g)).join('')+'</div></div>'}
function profile(){let n='Guest',av='🎮',acc='',t='',m='',theme='',an='';try{const p=window.RWP&&RWP.active&&RWP.active();if(p){n=p.name||n;const a=RWP.avatar&&RWP.avatar(p.avatar);if(a)av=a.icon;acc=p.acc||'';t=p.title||'';m=p.motto||'';const T=RWP.idn&&RWP.idn.themes.find(x=>x.id===(p.theme||''));theme=T&&T.id?T.c:'';an=p.anim||''}}catch(e){}
 const dark=ls.get('rw_mob_theme','dark')==='dark';
 return '<div class="pc" style="'+(theme?'background:'+theme:'')+'"><div class="pav" data-acc="'+esc(acc)+'" data-anim="'+esc(an)+'">'+av+'</div><h2>'+esc(n)+'</h2>'+(t?'<small>« '+esc(t)+' »</small>':'<small>Retro World player</small>')+(m?'<p>“'+esc(m)+'”</p>':'')+'</div>'
 +'<button class="row" data-act="profile"><span>🏆</span><div><b>Profile, trophies &amp; tokens</b><small>Customise your player card</small></div><i>›</i></button>'
 +'<button class="row" data-act="console"><span>🎮</span><div><b>Console mode</b><small>PS4 / Xbox / Switch style menu</small></div><i>›</i></button>'
 +'<button class="row" data-act="classic"><span>🖥️</span><div><b>Classic website</b><small>The normal Retro World view</small></div><i>›</i></button>'
 +'<button class="row" data-act="theme"><span>'+(dark?'🌙':'☀️')+'</span><div><b>Appearance</b><small>'+(dark?'Dark theme':'Light theme')+' — tap to switch</small></div><i>›</i></button>'}
function render(){const b=root.querySelector('.m-body');if(b.dataset.cur)scrollMem[b.dataset.cur]=b.scrollTop;b.dataset.cur=tab;
 b.innerHTML=tab==='home'?home():tab==='lib'?library():tab==='search'?searchV():profile();b.scrollTop=scrollMem[tab]||0;
 root.querySelectorAll('.nv button').forEach(x=>x.classList.toggle('on',x.dataset.tab===tab));
 root.classList.toggle('no-top',tab==='search');mountAds();hookHero()}
function hookHero(){const h=$('mHero'),d=$('mDots');if(!h||!d)return;h.addEventListener('scroll',()=>{const i=Math.round(h.scrollLeft/(h.firstChild.offsetWidth+10));[...d.children].forEach((x,j)=>x.classList.toggle('on',j===i))},{passive:true})}
function mountAds(){ads=0;root.querySelectorAll('[data-adslot]').forEach(s=>{if(ads>=3||!window.RWAd){s.remove();return}ads++;const el=window.RWAd(s,'m-ad');if(!el)s.remove()})}
function detail(id){const g=find(id);if(!g)return;const d=$('mDetail');
 const sim=games.filter(x=>x!==g&&x.cats.some(c=>c&&c!=='all'&&g.cats.includes(c))).slice(0,10);
 d.innerHTML='<div class="dh"><button class="back" aria-label="Back">←</button><span>'+esc(TC(g.title))+'</span></div><div class="db"><div class="ban" style="'+img(g)+'"></div><div class="top"><span class="ic lg" style="'+img(g)+'"></span><div><h2>'+esc(TC(g.title))+'</h2><b class="dv">Digital Eye</b><small>'+esc(genre(g))+(g.isNew?' • New':'')+'</small></div></div>'
 +'<div class="stats"><div><b>Free</b><small>No installs</small></div><div><b>🎮</b><small>Controller ready</small></div><div><b>⚡</b><small>Instant play</small></div><div><b>'+(g.locked?'👑':'3+')+'</b><small>'+(g.locked?'Premium':'Everyone')+'</small></div></div>'
 +'<button class="m-cta" data-play="'+g.id+'">'+(g.locked?'🔒 Unlock to play':'▶ Play now')+'</button>'
 +'<h4>About this game</h4><p class="ab">'+esc(g.desc)+'</p><div class="tg">'+(g.tags||'').split(/[•·|,\/]/).map(t=>t.trim()).filter(Boolean).map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>'
 +'<a class="lnk" href="play/'+g.slug+'.html">ⓘ Full details page</a>'
 +(sim.length?'<h4>You might also like</h4><div class="hs">'+sim.map(tile).join('')+'</div>':'')+'</div>';
 d.classList.add('open');d.querySelector('.db').scrollTop=0;try{history.pushState({mdet:1},'')}catch(e){}}
function closeDetail(){$('mDetail').classList.remove('open')}
function build(){if(built)return;built=true;root=document.createElement('div');root.id='rwMob';root.dataset.theme=ls.get('rw_mob_theme','dark');
 root.innerHTML='<div class="tp"><div class="pill" data-tab="search"><span>🔍</span><em>Search games</em><button class="av" data-tab="prof" aria-label="Profile">🎮</button></div></div><div class="m-body"></div><nav class="nv"><button data-tab="home" class="on"><i>🎮</i><span>Games</span></button><button data-tab="lib"><i>📚</i><span>Library</span></button><button data-tab="search"><i>🔍</i><span>Search</span></button><button data-tab="prof"><i>👤</i><span>You</span></button></nav><div id="mDetail"></div>';
 document.body.appendChild(root);refreshAv();
 addEventListener('popstate',()=>{if(root&&$('mDetail').classList.contains('open'))closeDetail()});
 root.addEventListener('click',e=>{const t=e.target;let x;
  if((x=t.closest('[data-play]'))){e.stopPropagation();const g=find(x.dataset.play);if(g)play(g);return}
  if(t.closest('.back')){closeDetail();return}
  if((x=t.closest('[data-tab]'))){tab=x.dataset.tab;closeDetail();render();refreshAv();if(tab==='search')setTimeout(()=>{const q=$('mQ');q&&q.focus()},60);return}
  if((x=t.closest('[data-chip]'))){filter=x.dataset.chip;render();return}
  if((x=t.closest('[data-sort]'))){sortBy=x.dataset.sort;render();return}
  if((x=t.closest('[data-more]'))){filter=x.dataset.more;tab='lib';render();return}
  if((x=t.closest('[data-act]'))){const a=x.dataset.act;if(a==='profile'){window.RWP&&RWP.openProfile&&RWP.openProfile()}else if(a==='theme'){const n=root.dataset.theme==='dark'?'light':'dark';root.dataset.theme=n;ls.set('rw_mob_theme',n);render()}else if(window.RWConsole)RWConsole.set(a);return}
  if((x=t.closest('[data-open]'))){detail(x.dataset.open);return}});
 root.addEventListener('input',e=>{if(e.target.id!=='mQ')return;const q=e.target.value.trim().toLowerCase();const L=q?games.filter(g=>(g.title+' '+g.tags+' '+g.cats.join(' ')).toLowerCase().includes(q)):games.filter(g=>!g.locked).slice(0,18);$('mRes').innerHTML=(q?'':'<h4>Popular right now</h4>')+(L.length?L.map(g=>lrow(g)).join(''):'<div class="none">No games found for “'+esc(q)+'”</div>')})}
function refreshAv(){try{const b=root.querySelector('.tp .av'),p=window.RWP&&RWP.active&&RWP.active(),a=p&&RWP.avatar&&RWP.avatar(p.avatar);if(b&&a)b.textContent=a.icon}catch(e){}}
window.RWMobile={show(v){if(v){build();read();render();refreshAv()}}};
})();
