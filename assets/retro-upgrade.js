/* RETRO WORLD upgrade layer. Decorates existing cards; no game code is touched. */
(()=>{
  const grid=document.querySelector('.grid'); if(!grid) return;
  const toolbar=document.querySelector('.category-toolbar'); if(!toolbar) return;
  const cards=[...grid.querySelectorAll('.card[data-categories]')];
  const count=document.getElementById('categoryCount');
  const FKEY='retroWorldFavs',SKEY='retroWorldSort';
  let favs=new Set(),favOnly=false;
  try{favs=new Set(JSON.parse(localStorage.getItem(FKEY)||'[]'))}catch(e){}
  const save=()=>{try{localStorage.setItem(FKEY,JSON.stringify([...favs]))}catch(e){}};
  const titleOf=c=>((c.querySelector('h3')||{}).textContent||'').trim();
  const idOf=c=>{const b=c.querySelector('button.play[data-game]');return b?b.dataset.game:titleOf(c)};

  cards.forEach((card,i)=>{
    card.dataset.order=i;
    const btn=card.querySelector('button.play[data-game]'),t=titleOf(card);
    // thumbnail (skip cards that already have a video preview)
    if(btn&&!card.querySelector('video')&&card.querySelector('.icon')){
      const slug=btn.dataset.game.replace(/\.html$/,'');
      const wrap=document.createElement('div');wrap.className='rw-thumb';
      const img=new Image();img.loading='lazy';img.decoding='async';img.alt=t+' gameplay preview';
      img.onload=()=>card.classList.add('rw-has-thumb');img.onerror=()=>wrap.remove();
      img.src='assets/thumbs/'+slug+'.jpg';wrap.appendChild(img);card.insertBefore(wrap,card.firstChild);
    }
    // favourite heart
    const f=document.createElement('button');f.type='button';f.className='rw-fav';f.textContent='\u2665';
    f.setAttribute('aria-label','Favourite '+t);
    const sync=()=>f.setAttribute('aria-pressed',favs.has(idOf(card))?'true':'false');sync();
    f.addEventListener('click',e=>{e.stopPropagation();const k=idOf(card);favs.has(k)?favs.delete(k):favs.add(k);save();sync();apply()});
    card.appendChild(f);
    if(card.dataset.new){const n=document.createElement('span');n.className='rw-new';n.textContent='NEW';card.appendChild(n)}
  });

  // toolbar
  const tools=document.createElement('div');tools.className='rw-tools';tools.setAttribute('role','search');
  tools.innerHTML='<input id="rwSearch" type="search" placeholder="SEARCH GAMES..." aria-label="Search games" autocomplete="off">'+
   '<select id="rwSort" aria-label="Sort games"><option value="default">SORT: DEFAULT</option><option value="az">SORT: A \u2192 Z</option><option value="new">SORT: NEW FIRST</option><option value="fav">SORT: FAVOURITES FIRST</option></select>'+
   '<button id="rwFavOnly" type="button" aria-pressed="false">\u2665 FAVOURITES</button>'+
   '<button id="rwRandom" type="button">\uD83C\uDFB2 SURPRISE ME</button>';
  toolbar.insertAdjacentElement('afterend',tools);
  const q=tools.querySelector('#rwSearch'),sortSel=tools.querySelector('#rwSort'),favBtn=tools.querySelector('#rwFavOnly'),rnd=tools.querySelector('#rwRandom');
  const empty=document.createElement('div');empty.className='rw-empty rw-hidden';empty.textContent='NO GAMES MATCH \u2014 TRY ANOTHER SEARCH';grid.appendChild(empty);
  try{const s=localStorage.getItem(SKEY);if(s&&[...sortSel.options].some(o=>o.value===s))sortSel.value=s}catch(e){}

  const vis=c=>!c.classList.contains('category-hidden')&&!c.classList.contains('rw-hidden');
  function recount(){const n=cards.filter(vis).length;if(count)count.textContent=n+' GAME'+(n===1?'':'S');empty.classList.toggle('rw-hidden',n!==0)}
  function sortCards(){
    const m=sortSel.value;let list=cards.slice();
    if(m==='az')list.sort((a,b)=>titleOf(a).localeCompare(titleOf(b)));
    else if(m==='new')list.sort((a,b)=>(!!b.dataset.new-!!a.dataset.new)||a.dataset.order-b.dataset.order);
    else if(m==='fav')list.sort((a,b)=>(favs.has(idOf(b))-favs.has(idOf(a)))||a.dataset.order-b.dataset.order);
    else list.sort((a,b)=>a.dataset.order-b.dataset.order);
    list.forEach(c=>grid.insertBefore(c,empty));
  }
  function apply(){
    const term=q.value.trim().toLowerCase();
    cards.forEach(c=>{
      const hay=(titleOf(c)+' '+((c.querySelector('.tags')||{}).textContent||'')+' '+(c.dataset.categories||'')).toLowerCase();
      const ok=(!term||hay.includes(term))&&(!favOnly||favs.has(idOf(c)));
      c.classList.toggle('rw-hidden',!ok);
    });
    sortCards();recount();
  }
  q.addEventListener('input',apply);
  q.addEventListener('keydown',e=>e.stopPropagation());
  sortSel.addEventListener('change',()=>{try{localStorage.setItem(SKEY,sortSel.value)}catch(e){}apply()});
  favBtn.addEventListener('click',()=>{favOnly=!favOnly;favBtn.setAttribute('aria-pressed',favOnly);apply()});
  rnd.addEventListener('click',()=>{
    const pool=cards.filter(c=>vis(c)&&!/\uD83D\uDD12/.test(c.textContent)&&c.querySelector('button.play[data-game]'));
    if(!pool.length)return;const c=pool[Math.floor(Math.random()*pool.length)];
    c.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>c.querySelector('button.play[data-game]').click(),450);
  });
  new MutationObserver(()=>requestAnimationFrame(recount)).observe(grid,{attributes:true,attributeFilter:['class'],subtree:true});

  /* ---------- recently played row ---------- */
  const RKEY='retroWorldRecent';let recent=[];
  try{recent=JSON.parse(localStorage.getItem(RKEY)||'[]').filter(r=>r&&r.id)}catch(e){}
  const rec=document.createElement('div');rec.className='rw-recent rw-hidden';tools.insertAdjacentElement('beforebegin',rec);
  function cardById(id){return cards.find(c=>idOf(c)===id)}
  function drawRecent(){
    const items=recent.filter(r=>cardById(r.id)).slice(0,6);rec.innerHTML='';
    rec.classList.toggle('rw-hidden',!items.length);if(!items.length)return;
    const l=document.createElement('span');l.textContent='RECENTLY PLAYED';rec.appendChild(l);
    items.forEach(r=>{const b=document.createElement('button');b.type='button';b.textContent='\u25B6 '+r.title;b.addEventListener('click',()=>{const c=cardById(r.id);const pb=c&&c.querySelector('button.play[data-game]');if(pb)pb.click()});rec.appendChild(b)});
  }
  addEventListener('message',e=>{
    const d=e.data;if(!d||d.source!=='retro-world-game'||d.type!=='start'||!d.gameId)return;
    recent=[{id:d.gameId,title:String(d.title||d.gameId).slice(0,28)}].concat(recent.filter(r=>r.id!==d.gameId)).slice(0,8);
    try{localStorage.setItem(RKEY,JSON.stringify(recent))}catch(x){}drawRecent();
  });
  drawRecent();
  apply();
})();
