/* RETRO WORLD appeal layer */
(()=>{
  const $=(s,r)=>(r||document).querySelector(s),$$=(s,r)=>[...(r||document).querySelectorAll(s)];
  const open=id=>{const b=$('button.play[data-game="'+id+'"]');if(b)b.click();else if(id==='beat-up-mafia.html'){const e=$('[data-game="beat-up-mafia.html"]');if(e)e.click()}};
  const cardOf=id=>{const b=$('button.play[data-game="'+id+'"]');return b?b.closest('.card'):null};
  const titleOf=c=>c?($('h3',c)||{}).textContent.trim():'';
  const tagsOf=c=>c?(($('.tags',c)||{}).textContent||'').trim():'';
  const thumbOf=id=>id==='beat-up-mafia.html'?'games/beat-up-mafia/preview.jpg':'assets/thumbs/'+id.replace(/\.html$/,'')+'.jpg';
  const NEW=['lonely-universe.html','jungle-gunship.html','raptor-run.html','air-hockey-arena.html','connect-four-clash.html','reversi-reborn.html','checkers-club.html','rock-blaster.html','pellet-chase.html','slice-frenzy.html','neon-survivors.html','grid-guardians.html','bubble-pop.html','sky-hop.html','neon-sudoku.html','beat-up-mafia.html','silent-wire.html','sandblade-1990.html','centre-court-tennis.html','snooker-club.html','strike-zone-bowling.html','hoops-showdown.html','penalty-keeper.html','turbo-table-tennis.html'];
  const PICKS=['neon-pod-rush.html','hellbyte-93.html','captain-leap.html','pixel-chess.html','neon-pinball.html','metro-brawler.html','galactic-golf.html','castle-cannon.html','ring-king.html','sky-raid-92.html'];
  function rail(title,sub,ids,badge){
    const r=document.createElement('div');r.className='rw-rail';
    r.innerHTML='<h2>'+title+' <small>'+sub+'</small></h2><div class="rw-track"></div>';
    const tr=$('.rw-track',r);
    ids.forEach((id,i)=>{const c=cardOf(id);if(!c&&id!=='beat-up-mafia.html')return;const b=document.createElement('button');b.type='button';b.className='rw-rc';b.dataset.railGame=id;
      const t=c?titleOf(c):'BEAT UP MAFIA',tg=c?tagsOf(c):'EPIC & 3D • TOP-DOWN CRIME • FREE';
      b.innerHTML='<img loading="lazy" decoding="async" alt="'+t+' gameplay" src="'+thumbOf(id)+'"><span class="'+(badge==='new'?'rw-rc-new':'rw-rc-hot')+'">'+(badge==='new'?'NEW':'TOP PICK')+'</span><b>'+t+'</b><small>'+tg+'</small><span class="rw-rc-play">▶ PLAY</span>';
      tr.appendChild(b)});
    return r;
  }
  const rails=$('#rwRails');
  if(rails){rails.appendChild(rail('🔥 NEW &amp; HOT','fresh arcade hits — play instantly',NEW,'new'));rails.appendChild(rail('⭐ TOP PICKS','hand-picked favourites',PICKS,'pick'))}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-rail-game]');if(b){e.preventDefault();open(b.dataset.railGame)}});
  // random
  const rb=$('#rwHeroRandom');if(rb)rb.addEventListener('click',()=>{const ids=$$('button.play[data-game]').filter(b=>!b.classList.contains('premium-locked-btn')).map(b=>b.dataset.game).filter(x=>!/popshot|crimson|dust/.test(x));open(ids[Math.floor(Math.random()*ids.length)])});
  // compact header toggle
  const hd=$('header .nav');if(hd){const m=document.createElement('button');m.type='button';m.className='rw-menu-btn';m.textContent='⚙ MENU';m.setAttribute('aria-expanded','false');m.addEventListener('click',()=>{const o=$('header').classList.toggle('rw-open');m.setAttribute('aria-expanded',o?'true':'false')});hd.insertBefore(m,$('nav',hd).nextSibling)}
  // share row
  const sh=$('#rwShare');if(sh){const url='https://retroworld.eu.cc/',txt='Retro World — 106 free retro browser games, no download';
    sh.innerHTML='<span>SHARE:</span>';
    if(navigator.share){const b=document.createElement('button');b.type='button';b.textContent='📤 SHARE';b.addEventListener('click',()=>navigator.share({title:'Retro World',text:txt,url}).catch(()=>{}));sh.appendChild(b)}
    const cp=document.createElement('button');cp.type='button';cp.textContent='🔗 COPY LINK';cp.addEventListener('click',()=>{const done=()=>{cp.textContent='✔ COPIED';setTimeout(()=>cp.textContent='🔗 COPY LINK',1800)};try{navigator.clipboard.writeText(url).then(done,done)}catch(e){done()}});sh.appendChild(cp);
    const mk=(l,h)=>{const a=document.createElement('a');a.textContent=l;a.href=h;a.target='_blank';a.rel='noopener';sh.appendChild(a)};
    mk('𝕏','https://twitter.com/intent/tweet?text='+encodeURIComponent(txt)+'&url='+encodeURIComponent(url));mk('WHATSAPP','https://wa.me/?text='+encodeURIComponent(txt+' '+url));mk('REDDIT','https://www.reddit.com/submit?url='+encodeURIComponent(url)+'&title='+encodeURIComponent(txt));
  }
  // deep links: #play=sky-hop.html  or ?play=sky-hop
  function deep(){let id=null;const h=location.hash.match(/play=([\w.-]+)/),q=location.search.match(/[?&]play=([\w.-]+)/);id=(h&&h[1])||(q&&q[1]);if(!id)return;if(!/\.html$/.test(id))id+='.html';if(cardOf(id))setTimeout(()=>open(id),600)}
  if(document.readyState==='complete')deep();else addEventListener('load',deep);
})();
