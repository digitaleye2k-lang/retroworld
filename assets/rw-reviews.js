/* RETRO WORLD — ratings & reviews.
   Works out of the box: 1-5 star ratings are counted globally through the same counter service the site already uses,
   comments are stored on the player's device.
   To share COMMENTS between all players, create a free Supabase project, run reviews-setup.sql, then fill in CONFIG below. */
(()=>{
const CONFIG={supabaseUrl:'',supabaseKey:''};   // <- paste your Supabase project URL + anon (public) key here
const CA='https://countapi.mileshilliard.com/api/v1/';
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const J=(k,d)=>{try{return JSON.parse(LS.get(k)||'')||d}catch(e){return d}};
const SB=!!(CONFIG.supabaseUrl&&CONFIG.supabaseKey);
const dev=(()=>{let d=LS.get('rw_rv_dev');if(!d){d=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now());LS.set('rw_rv_dev',d)}return d})();
const mine=()=>J('rw_rv_mine',{}),saveMine=m=>LS.set('rw_rv_mine',JSON.stringify(m));
const local=()=>J('rw_rv_local',{}),saveLocal=m=>LS.set('rw_rv_local',JSON.stringify(m));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BAD=/\b(fuck|shit|bitch|cunt|nigg\w*|fag\w*|retard\w*|whore|slut|rape)\b/gi;
const clean=s=>s.replace(BAD,m=>'*'.repeat(m.length)).replace(/https?:\/\/\S+/gi,'[link removed]');
const css=`.rwr-btn{display:block;margin:8px 0 0;background:#14142e;border:1px solid #ffe14a;color:#ffe14a;font:700 12px/1 monospace;letter-spacing:1px;padding:8px 10px;cursor:pointer;width:100%}
.rwr-btn:hover{background:#ffe14a;color:#000}.rwr-btn .s{letter-spacing:2px}
.rwr-bar{margin-left:10px;background:#14142e;border:1px solid #ffe14a;color:#ffe14a;font:700 12px monospace;padding:6px 10px;cursor:pointer}
#rwrM{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,6,.82);display:none;align-items:center;justify-content:center;padding:14px}
#rwrM.on{display:flex}.rwr-box{width:min(620px,100%);max-height:92vh;overflow:auto;background:#0a0a1c;border:3px solid #ffe14a;box-shadow:0 0 0 2px #000,0 0 40px rgba(255,225,74,.3);color:#e8ecff;font-family:system-ui,sans-serif;padding:18px 20px}
.rwr-box h3{margin:0 0 2px;font:900 22px monospace;color:#ffe14a;letter-spacing:1px}.rwr-sub{font-size:12px;color:#8a92b8;margin-bottom:12px}
.rwr-sum{display:flex;gap:18px;align-items:center;margin-bottom:12px}.rwr-big{font:900 44px monospace;color:#fff;line-height:1}.rwr-big small{font-size:14px;color:#8a92b8;display:block}
.rwr-h{flex:1}.rwr-h div{display:flex;align-items:center;gap:6px;font:11px monospace;color:#8a92b8;margin:2px 0}.rwr-h i{display:block;height:7px;background:#ffe14a;min-width:2px}.rwr-h span{flex:1;background:#1a1a38}
.rwr-stars{display:flex;gap:4px;margin:6px 0}.rwr-stars button{background:none;border:0;font-size:34px;line-height:1;color:#3a3a5c;cursor:pointer;padding:0 2px}.rwr-stars button.on{color:#ffe14a;text-shadow:0 0 10px rgba(255,225,74,.6)}
.rwr-box input,.rwr-box textarea{width:100%;box-sizing:border-box;background:#05050f;border:1px solid #3e3e6b;color:#fff;font:14px system-ui;padding:9px;margin-top:6px}.rwr-box textarea{min-height:76px;resize:vertical}
.rwr-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}.rwr-go{background:#ffe14a;color:#000;border:2px solid #000;font:900 14px monospace;padding:10px 18px;cursor:pointer;box-shadow:3px 3px 0 #000}.rwr-x{background:none;border:1px solid #3e3e6b;color:#aab;font:12px monospace;padding:8px 12px;cursor:pointer}
.rwr-msg{font-size:12px;color:#7dffb0;min-height:16px}.rwr-msg.e{color:#ff7a7a}.rwr-note{font-size:11px;color:#6f77a0;margin-top:8px}
.rwr-list{margin-top:14px;border-top:1px solid #26264a;padding-top:10px}.rwr-c{padding:9px 0;border-bottom:1px solid #1a1a38}.rwr-c b{color:#9ff0ff;font-size:13px}.rwr-c .st{color:#ffe14a;font-size:12px;margin-left:6px}.rwr-c .dt{float:right;font-size:11px;color:#6f77a0}.rwr-c p{margin:4px 0 0;font-size:14px;line-height:1.4;word-break:break-word}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const modal=document.createElement('div');modal.id='rwrM';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');document.body.appendChild(modal);
let cur=null,pick=0,lastSend=0;const titles={},avgCache=J('rw_rv_avg',{});
const stars=n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));
// ---- backend
async function sbFetch(path,opt){const r=await fetch(CONFIG.supabaseUrl+'/rest/v1/'+path,Object.assign({headers:{apikey:CONFIG.supabaseKey,Authorization:'Bearer '+CONFIG.supabaseKey,'Content-Type':'application/json'}},opt));if(!r.ok)throw new Error('sb '+r.status);return r}
async function loadRatings(id){ // -> {counts:[c1..c5]}
 if(SB){const rows=await(await sbFetch('rw_reviews?game=eq.'+encodeURIComponent(id)+'&select=stars&limit=5000')).json();const c=[0,0,0,0,0];rows.forEach(r=>c[r.stars-1]++);return c}
 const c=await Promise.all([1,2,3,4,5].map(n=>fetch(CA+'get/rw_rate_v1_'+id.replace(/[^a-z0-9]/gi,'_')+'_'+n).then(r=>r.ok?r.json():{value:0}).then(d=>Math.max(0,parseInt(d.value,10)||0)).catch(()=>0)));return c}
async function loadComments(id){const l=(local()[id]||[]).map(x=>Object.assign({mine:1},x));if(!SB)return l;try{const rows=await(await sbFetch('rw_reviews?game=eq.'+encodeURIComponent(id)+'&comment=neq.&select=name,stars,comment,created_at&order=created_at.desc&limit=40')).json();return rows.map(r=>({n:r.name,s:r.stars,c:r.comment,ts:Date.parse(r.created_at)}))}catch(e){return l}}
async function send(id,stars_,name,comment,first){
 if(SB){await sbFetch('rw_reviews?on_conflict=game,device',{method:'POST',headers:{apikey:CONFIG.supabaseKey,Authorization:'Bearer '+CONFIG.supabaseKey,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({game:id,device:dev,stars:stars_,name:name||'Player',comment:comment||''})});return}
 if(first)fetch(CA+'hit/rw_rate_v1_'+id.replace(/[^a-z0-9]/gi,'_')+'_'+stars_).catch(()=>{})}
// ---- UI
function gameName(id){return titles[id]||id.replace(/\.html$/,'').replace(/-/g,' ').toUpperCase()}
async function open(id){cur=id;const m=mine()[id];pick=m?m.stars:0;
 modal.innerHTML=`<div class="rwr-box"><h3>★ ${esc(gameName(id))}</h3><div class="rwr-sub">Rate this game and tell other players what you think.</div><div class="rwr-sum"><div class="rwr-big" id="rwrAvg">–<small id="rwrCnt">loading…</small></div><div class="rwr-h" id="rwrHist"></div></div>
 <b style="font-size:13px">YOUR RATING</b><div class="rwr-stars" id="rwrPick">${[1,2,3,4,5].map(n=>`<button type="button" data-n="${n}" aria-label="${n} star${n>1?'s':''}">★</button>`).join('')}</div>
 <input id="rwrName" maxlength="20" placeholder="Your name (optional)" value="${esc(LS.get('rw_rv_name')||'')}"><textarea id="rwrTxt" maxlength="300" placeholder="Write a short review (optional, 300 characters)…">${esc(m&&m.c||'')}</textarea>
 <div class="rwr-row"><div class="rwr-msg" id="rwrMsg"></div><div><button class="rwr-x" type="button" id="rwrClose">CLOSE</button> <button class="rwr-go" type="button" id="rwrSend">SUBMIT</button></div></div>
 <div class="rwr-note">${SB?'Reviews are public and visible to all players.':'Ratings are counted for everyone. Your written review is saved on this device.'} Be kind – no links or abuse.</div>
 <div class="rwr-list" id="rwrList"></div></div>`;modal.classList.add('on');paint();
 modal.querySelector('#rwrClose').onclick=close;modal.querySelector('#rwrSend').onclick=submit;
 const P=modal.querySelector('#rwrPick');P.onclick=e=>{const b=e.target.closest('button');if(b){pick=+b.dataset.n;paint()}};P.onmouseover=e=>{const b=e.target.closest('button');if(b)paint(+b.dataset.n)};P.onmouseleave=()=>paint();
 loadRatings(id).then(c=>{const t=c.reduce((a,b)=>a+b,0),av=t?c.reduce((a,v,i)=>a+v*(i+1),0)/t:0;avgCache[id]={a:av,t};LS.set('rw_rv_avg',JSON.stringify(avgCache));if(cur!==id)return;modal.querySelector('#rwrAvg').firstChild.textContent=t?av.toFixed(1):'–';modal.querySelector('#rwrCnt').textContent=t?t+' rating'+(t>1?'s':''):'no ratings yet';modal.querySelector('#rwrHist').innerHTML=[5,4,3,2,1].map(n=>`<div>${n}★<span><i style="width:${t?c[n-1]/t*100:0}%"></i></span>${c[n-1]}</div>`).join('');decorate()}).catch(()=>{modal.querySelector('#rwrCnt').textContent='offline'});
 showList(id)}
function paint(h){const v=h||pick;modal.querySelectorAll('#rwrPick button').forEach((b,i)=>b.classList.toggle('on',i<v))}
async function showList(id){const l=await loadComments(id);if(cur!==id)return;const el=modal.querySelector('#rwrList');l.sort((a,b)=>(b.ts||0)-(a.ts||0));el.innerHTML=l.length?l.filter(x=>x.c).map(x=>`<div class="rwr-c"><span class="dt">${new Date(x.ts||Date.now()).toLocaleDateString()}</span><b>${esc(x.n||'Player')}</b><span class="st">${stars(x.s)}</span>${x.mine?' <small style="color:#6f77a0">(you)</small>':''}<p>${esc(x.c)}</p></div>`).join('')||'<div class="rwr-note">No written reviews yet – be the first!</div>':'<div class="rwr-note">No reviews yet – be the first!</div>'}
async function submit(){const msg=modal.querySelector('#rwrMsg');const say=(t,e)=>{msg.textContent=t;msg.className='rwr-msg'+(e?' e':'')};
 if(!pick)return say('Pick a star rating first.',1);if(Date.now()-lastSend<15000)return say('Please wait a few seconds.',1);
 const name=clean(modal.querySelector('#rwrName').value.trim()).slice(0,20)||'Player',c=clean(modal.querySelector('#rwrTxt').value.trim()).slice(0,300);
 const M=mine(),first=!M[cur];M[cur]={stars:pick,c,ts:Date.now()};saveMine(M);LS.set('rw_rv_name',name);
 const L=local();L[cur]=[{n:name,s:pick,c,ts:Date.now()}];saveLocal(L);lastSend=Date.now();
 try{await send(cur,pick,name,c,first);say(first?'Thanks! Your rating is in.':'Review updated.')}catch(e){say('Saved on this device (could not reach the server).',1)}
 showList(cur);decorate()}
function close(){modal.classList.remove('on');cur=null}
modal.addEventListener('mousedown',e=>{if(e.target===modal)close()});
modal.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close()},true);modal.addEventListener('keyup',e=>e.stopPropagation(),true);modal.addEventListener('keypress',e=>e.stopPropagation(),true);
// ---- hook into page
function gid(card){const e=card.querySelector('[data-game],[data-premium-game],[data-rail-game]');return e&&(e.dataset.game||e.dataset.premiumGame||e.dataset.railGame)}
function decorate(){document.querySelectorAll('article.card').forEach(card=>{const id=gid(card);if(!id)return;const h=card.querySelector('h3');if(h)titles[id]=h.textContent.replace(/★.*$/,'').trim();let b=card.querySelector('.rwr-btn');if(!b){b=document.createElement('button');b.type='button';b.className='rwr-btn';b.onclick=()=>open(id);card.appendChild(b)}
 const a=avgCache[id],m=mine()[id];const html=a&&a.t?`<span class="s">${stars(a.a)}</span> ${a.a.toFixed(1)} (${a.t}) · RATE`:m?`<span class="s">${stars(m.stars)}</span> YOUR RATING · EDIT`:'☆ RATE &amp; REVIEW';if(b.dataset.h!==html){b.dataset.h=html;b.innerHTML=html}})}
function playerBtn(){const bar=document.querySelector('#player .playerbar');if(!bar||bar.querySelector('.rwr-bar'))return;const b=document.createElement('button');b.type='button';b.className='rwr-bar';b.textContent='★ RATE THIS GAME';b.onclick=()=>{const t=(document.getElementById('gametitle')||{}).textContent||'';const id=Object.keys(titles).find(k=>titles[k].toUpperCase()===t.trim().toUpperCase());if(id)open(id)};const r=bar.querySelector('#reportGameBtn');bar.insertBefore(b,r?r.nextSibling:null)}
async function loadAll(){if(!SB)return;try{const rows=await(await sbFetch('rw_reviews?select=game,stars&limit=20000')).json();const g={};rows.forEach(r=>{(g[r.game]=g[r.game]||[0,0]);g[r.game][0]+=r.stars;g[r.game][1]++});Object.keys(g).forEach(k=>avgCache[k]={a:g[k][0]/g[k][1],t:g[k][1]});LS.set('rw_rv_avg',JSON.stringify(avgCache));decorate()}catch(e){}}
decorate();playerBtn();loadAll();let _t=0;new MutationObserver(()=>{clearTimeout(_t);_t=setTimeout(()=>{decorate();playerBtn()},500)}).observe(document.body,{childList:true,subtree:true});
window.RWReviews={open};
})();
