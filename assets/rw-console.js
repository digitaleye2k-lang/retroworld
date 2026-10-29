(()=>{
'use strict';
const VK='rw_view2',SK='rw_xmb_snd',KK='rw_xmb_skin';
const ls={get(k,d){try{return localStorage.getItem(k)||d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const CATS=[['new',"WHAT'S NEW"],['all','ALL GAMES'],['epic3d','EPIC & 3D'],['arcade','ARCADE'],['puzzle','PUZZLE'],['shooter','SHOOTER'],['space','SPACE'],['sports','SPORTS'],['survival','SURVIVAL'],['board','BOARD'],['platform','PLATFORM'],['fighting','FIGHTING'],['driving','DRIVING'],['defense','DEFENSE'],['premium','PREMIUM']];
const SKINS=[['ps4','PS4 BLUE'],['xbox','XBOX GREEN'],['switch','SWITCH LIGHT'],['nebula','NEBULA'],['crimson','CRIMSON']];
let games=[],cat=0,idx=0,on=false,built=false,actx=null,pad={t:0,k:''},muteScroll=0,abgN=0;
function readGames(){games=[...document.querySelectorAll('article.card')].map(c=>{const b=c.querySelector('[data-game]');if(!b)return null;const id=b.dataset.game,slug=id.replace('.html','');return{card:c,btn:b,id,slug,title:((c.querySelector('h3')||{}).textContent||slug).trim(),icon:((c.querySelector('.icon')||{}).textContent||'🎮').trim(),desc:((c.querySelector('p')||{}).textContent||'').trim(),tags:((c.querySelector('.tags')||{}).textContent||'').trim(),cats:(c.dataset.categories||'').split(/\s+/),isNew:c.dataset.new==='1',locked:c.classList.contains('premium-locked')}}).filter(Boolean)}
function itemsRaw(){const c=CATS[cat][0];if(c==='new')return games.filter(g=>g.isNew);if(c==='all')return games;if(c==='premium')return games.filter(g=>g.cats.includes('premium')||g.locked);return games.filter(g=>g.cats.includes(c))}
const PADOK=new Set(["air-hockey-arena.html", "alien-siege.html", "astro-breaker.html", "beat-runner.html", "blackjack-royale.html", "block-drop.html", "bomb-blaster.html", "box-bot.html", "box-pusher.html", "bubble-pop.html", "bug-blaster.html", "bullseye-archery.html", "captain-leap.html", "castle-cannon.html", "castle-climb.html", "catapult-crash.html", "centre-court-tennis.html", "checkers-club.html", "color-flood.html", "comet-catcher.html", "connect-four-clash.html", "cyber-maze.html", "dart-master.html", "dungeon-dash.html", "echo-pad.html", "fishing-quest.html", "frog-hop.html", "galactic-golf.html", "galaxy-defender.html", "ghost-patrol.html", "grid-guardians.html", "hellbyte-93.html", "hoops-showdown.html", "hover-bike.html", "jewel-matrix.html", "jungle-gunship.html", "key-quest.html", "laser-arena.html", "lights-out.html", "lonely-universe.html", "marble-spiral.html", "mech-titan.html", "memory-matrix.html", "merge-2048.html", "meteor-dodge.html", "metro-brawler.html", "minefield-86.html", "missile-guard.html", "moon-lander.html", "nebula-wing.html", "neon-clicker.html", "neon-connect.html", "neon-ludo-rally.html", "neon-pinball.html", "neon-pod-rush.html", "neon-ranger.html", "neon-snake.html", "neon-snakes-ladders.html", "neon-sudoku.html", "neon-survivors.html", "neon-whack.html", "ninja-tower.html", "number-slide.html", "paddle-clash.html", "pearl-diver.html", "pellet-chase.html", "penalty-keeper.html", "pipe-panic.html", "pixel-chess.html", "pixel-golf.html", "pixel-racer.html", "pixel-solitaire.html", "raptor-run.html", "reactor-core.html", "retro-pong.html", "reversi-reborn.html", "ring-king.html", "river-escape.html", "road-blaster-99.html", "robot-runner.html", "rock-blaster.html", "sandblade-1990.html", "shadow-duel.html", "sky-flapper.html", "sky-hop.html", "sky-hunter.html", "sky-raid-92.html", "slice-frenzy.html", "snooker-club.html", "space-courier.html", "space-dock.html", "spider-stack.html", "star-miner.html", "strike-zone-bowling.html", "sub-hunter.html", "tank-duel.html", "tower-stack.html", "turbo-table-tennis.html"]);
let kmIn=false;try{kmIn=sessionStorage.getItem('rw_km')==='1'}catch(e){}
let kmForce=null;try{kmForce=localStorage.getItem('rw_km_all')}catch(e){}
function showAll(){return kmForce==='1'||(kmForce!=='0'&&kmIn)}
function items(){const L=itemsRaw();return showAll()?L:L.filter(g=>PADOK.has(g.id))}
function kmDetected(){if(kmIn)return;kmIn=true;try{sessionStorage.setItem('rw_km','1')}catch(e){}if(on&&kmForce==null){try{renderTabs();renderRow();renderDock();focus(false,true)}catch(e){}}}
let lmx=-1,lmy=-1,mvN=0;
document.addEventListener('mousemove',e=>{if(e.pointerType==='touch'||e.sourceCapabilities&&e.sourceCapabilities.firesTouchEvents)return;if(lmx<0){lmx=e.clientX;lmy=e.clientY;return}if(Math.abs(e.clientX-lmx)+Math.abs(e.clientY-lmy)>0&&++mvN>6&&!window.RETROWORLD_TV_DEVICE)kmDetected()},true);
document.addEventListener('keydown',e=>{if(/^[a-z0-9]$/i.test(e.key)&&!e.ctrlKey&&!e.metaKey)kmDetected()},true);

const $=id=>document.getElementById(id);
const LITE=!!(window.RETROWORLD_TV_DEVICE||/[?&](tv=(1|on|true)|lite=1)/i.test(location.search)||/web0s|webos|smart-?tv|tizen|hbbtv|netcast/i.test(navigator.userAgent));
if(LITE)document.documentElement.classList.add('rw-lite');
const MDEF=LITE?'off':'on';
const TH=slug=>(LITE?'assets/thumbs-s/':'assets/thumbs/')+slug+'.jpg';
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const skin=()=>ls.get(KK,'ps4');
function hueFor(k){if(k==='xbox')return 112;if(k==='nebula')return 280;if(k==='crimson')return 352;const h=new Date().getHours();return h>=5&&h<11?190:h<17?215:h<21?266:226}
function dockItems(){return[{ic:showAll()?'🖱️':'🎮',lb:showAll()?'ALL GAMES (MOUSE/KB)':'CONTROLLER GAMES',k:'g',run:()=>{kmForce=showAll()?'0':'1';try{localStorage.setItem('rw_km_all',kmForce)}catch(e){}renderTabs();renderRow();renderDock();focus(false,true)}},{ic:'🎲',lb:'RANDOM GAME',k:'r',run:rand},{ic:'👤',lb:'MY PROFILE',k:'t',run:showProf},{ic:'🏆',lb:'TROPHY ROOM',k:'h',run:showTro},{ic:fxMode()==='static'?'🖼️':'✨',lb:'BACKGROUND: '+(FXS.find(f=>f[0]===fxMode())||FXS[0])[1],k:'b',run:cycleFx},{ic:'🎨',lb:'STYLE: '+(SKINS.find(s=>s[0]===skin())||SKINS[0])[1],k:'k',run:cycleSkin},{ic:ls.get(MK,MDEF)==='on'?'🎵':'🔕',lb:'AMBIENT MUSIC',k:'m',run:()=>{ls.set(MK,ls.get(MK,MDEF)==='on'?'off':'on');syncMusic();renderDock()}},{ic:ls.get(SK,'on')==='on'?'🔊':'🔇',lb:'CLICK SOUNDS',k:'n',run:()=>{ls.set(SK,ls.get(SK,'on')==='on'?'off':'on');renderDock()}},{ic:'🖥',lb:'CLASSIC VIEW',k:'v',run:()=>setView('classic')}]}
// ---- PlayStation-style ambient music (generative, WebAudio) ----
const MK='rw_xmb_music';
const Amb=(()=>{let c=null,m=null,rev=null,t=null,nxt=0,step=0,run=false;
 const CH=[[48,[55,59,62,64,67]],[45,[52,57,60,64,67]],[41,[53,57,60,64,69]],[43,[55,59,62,66,69]],[40,[52,55,59,62,67]],[46,[53,57,62,65,69]]];
 const F=n=>440*Math.pow(2,(n-69)/12),BELL=[76,79,83,86,88,91,95];
 function ini(){if(c)return true;try{c=new(window.AudioContext||window.webkitAudioContext)();m=c.createGain();m.gain.value=0;const comp=c.createDynamicsCompressor();m.connect(comp);comp.connect(c.destination);
  const conv=c.createConvolver(),len=c.sampleRate*5,b=c.createBuffer(2,len,c.sampleRate);for(let k=0;k<2;k++){const d=b.getChannelData(k);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.4)*(1-Math.exp(-i/1200))}conv.buffer=b;rev=c.createGain();rev.gain.value=.9;const w=c.createGain();w.gain.value=.8;rev.connect(conv);conv.connect(w);w.connect(m);
  const dl=c.createDelay(2);dl.delayTime.value=.62;const fb=c.createGain();fb.gain.value=.4;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;rev.connect(dl);dl.connect(lp);lp.connect(fb);fb.connect(dl);lp.connect(m);
  return true}catch(e){c=null;return false}}
 function padV(n,t0,d,v){const g=c.createGain(),f=c.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(400,t0);f.frequency.linearRampToValueAtTime(1100,t0+d*.5);f.frequency.linearRampToValueAtTime(400,t0+d+3);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(v,t0+3);g.gain.setValueAtTime(v,t0+d-.5);g.gain.linearRampToValueAtTime(0,t0+d+3.5);for(const dt of[-9,8]){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=F(n);o.detune.value=dt;o.connect(f);o.start(t0);o.stop(t0+d+3.7)}const so=c.createOscillator();so.type='sine';so.frequency.value=F(n);so.connect(f);so.start(t0);so.stop(t0+d+3.7);f.connect(g);g.connect(m);g.connect(rev)}
 function sub(n,t0,d){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=F(n);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(.16,t0+2);g.gain.linearRampToValueAtTime(0,t0+d+2.5);o.connect(g);g.connect(m);o.start(t0);o.stop(t0+d+2.6)}
 function bell(n,t0,v){const g=c.createGain();for(const[mu,du,vv]of[[1,3.6,1],[2.76,1.8,.3],[5.4,.8,.12]]){const o=c.createOscillator(),e=c.createGain();o.type='sine';o.frequency.value=F(n)*mu;e.gain.setValueAtTime(0,t0);e.gain.linearRampToValueAtTime(v*vv,t0+.01);e.gain.exponentialRampToValueAtTime(.0001,t0+du);o.connect(e);e.connect(g);o.start(t0);o.stop(t0+du+.1)}g.connect(m);const r=c.createGain();r.gain.value=1.4;g.connect(r);r.connect(rev)}
 function sched(){if(!run||!c||c.state!=='running')return;const now=c.currentTime;if(nxt<now-.5)nxt=now+.1;while(nxt<now+.5){const t0=nxt;if(step%16===0){const ch=CH[(step/16)%CH.length],d=8;ch[1].forEach(n=>padV(n,t0,d,.012));sub(ch[0],t0,d)}if(step%4===0&&Math.random()<.55)bell(BELL[Math.floor(Math.random()*BELL.length)],t0+Math.random()*.3,.026);nxt+=.5;step++}}
 return{start(){if(!ini())return;run=true;if(c.state==='suspended')c.resume();m.gain.cancelScheduledValues(c.currentTime);m.gain.setTargetAtTime(.9,c.currentTime,1.6);if(!t)t=setInterval(sched,100)},stop(){if(!c)return;run=false;m.gain.cancelScheduledValues(c.currentTime);m.gain.setTargetAtTime(0,c.currentTime,.5)},get on(){return run}}})();
function musicWanted(){return on&&ls.get(MK,MDEF)==='on'&&!document.body.classList.contains('game-active')&&!document.hidden}
function exitToast(){try{const gp=navigator.getGamepads&&[...navigator.getGamepads()].find(Boolean);if(!gp)return;const g=glyphs();const t=document.createElement('div');t.className='x-toast';t.textContent='🎮 Hold '+g.E+' + '+g.S+' together to leave the game';document.body.appendChild(t);setTimeout(()=>t.remove(),6000)}catch(e){}}
let wasGame=false;
function syncMusic(){const ga=document.body.classList.contains('game-active');if(ga&&!wasGame&&on)exitToast();wasGame=ga;if(musicWanted())Amb.start();else if(Amb.on)Amb.stop()}
// ---- unobtrusive ad strip (labelled, hidden if unfilled) ----
function adStrip(host,cls){if(window.RETROWORLD_TV_DEVICE||window.RW_NO_ADS||!document.querySelector('script[src*="adsbygoogle"]'))return null;const w=document.createElement('div');w.className=cls||'x-ad';w.innerHTML='<small>ADVERTISEMENT</small>';const ins=document.createElement('ins');ins.className='adsbygoogle';ins.style.cssText='display:block;width:100%';ins.setAttribute('data-ad-client','ca-pub-7935805760564580');ins.setAttribute('data-ad-slot','4713461465');ins.setAttribute('data-ad-format','auto');ins.setAttribute('data-full-width-responsive','true');w.appendChild(ins);w.style.cssText='height:0;overflow:hidden;margin:0;padding:0;border:0';new MutationObserver(()=>{if(ins.getAttribute('data-ad-status')==='filled')w.style.cssText=''}).observe(ins,{attributes:true,attributeFilter:['data-ad-status']});host.appendChild(w);try{(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch(e){}return w}
window.RWAd=adStrip;
function build(){if(built)return;built=true;readGames();const r=document.createElement('div');r.id='rwXmb';r.setAttribute('aria-label','Retro World console menu');
 r.innerHTML='<div id="xBgFill"></div><div id="xArtBg"></div><canvas id="xBg"></canvas><div id="xShade"></div><div class="x-main"><div class="x-top"><div class="x-prof"><span class="x-av" id="xAv">🎮</span><b id="xName">RETRO WORLD</b></div><div class="x-status"><span id="xClock"></span><button class="x-pill" id="xClassic" type="button" title="Back to the normal website (V)">CLASSIC VIEW</button></div></div><div class="x-tabs" id="xTabs"></div><div class="x-hero" id="xHero"></div><div class="x-row" id="xRow"></div><div class="x-dock" id="xDock"></div><div class="x-pads" id="xPads"></div></div><div id="xProf" hidden></div><div id="xTro" hidden></div>';
 document.body.appendChild(r);
 $('xClassic').addEventListener('click',()=>setView('classic'));
 $('xTabs').addEventListener('click',e=>{const t=e.target.closest('.x-tab');if(t)selCat(+t.dataset.i)});
 $('xRow').addEventListener('click',e=>{const t=e.target.closest('.x-tile');if(!t)return;const i=+t.dataset.i;if(i===idx)act();else{idx=i;focus(true);tick(660)}});
 $('xDock').addEventListener('click',e=>{const b=e.target.closest('.x-d');if(!b)return;tick(700);dockItems()[+b.dataset.i].run()});
 let wt=0;$('xRow').addEventListener('wheel',e=>{if(Math.abs(e.deltaY)<8&&Math.abs(e.deltaX)<8)return;e.preventDefault();const n=Date.now();if(n-wt<110)return;wt=n;move(((e.deltaY||e.deltaX)>0)?1:-1)},{passive:false});
 let st=0;$('xRow').addEventListener('scroll',()=>{if(Date.now()<muteScroll)return;clearTimeout(st);st=setTimeout(()=>{const row=$('xRow'),pl=parseFloat(getComputedStyle(row).paddingLeft)||0,want=row.scrollLeft+pl;let best=0,bd=1e9;[...row.children].forEach((c,i)=>{const d=Math.abs(c.offsetLeft-want);if(d<bd){bd=d;best=i}});if(best!==idx){idx=best;focus(false)}},140)},{passive:true});
 document.addEventListener('keydown',key);document.addEventListener('visibilitychange',syncMusic);new MutationObserver(syncMusic).observe(document.body,{attributes:true,attributeFilter:['class']});document.addEventListener('pointerdown',()=>{if(on)syncMusic()},{passive:true});document.addEventListener('keydown',()=>{if(on)syncMusic()},{passive:true});setTimeout(()=>{if(innerHeight>=680&&innerWidth>=700){const mm=r.querySelector('.x-main');if(mm&&!mm.querySelector('.x-ad'))adStrip(mm,'x-ad')}},4000);bgInit();renderTabs();renderRow();renderDock();focus(false,true);applySkin();if(window.RETROWORLD_TV_DEVICE||innerWidth>=1700)r.classList.add('x-tv');renderPads();clock();setInterval(clock,20000);requestAnimationFrame(padLoop)}
function clock(){const d=new Date(),el=$('xClock');if(el)el.textContent=d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})+'  '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});try{const p=window.RWP&&RWP.active&&RWP.active();const n=$('xName');if(n&&p&&p.name)n.textContent=String(p.name).toUpperCase()}catch(e){}}
function renderTabs(){$('xTabs').innerHTML=CATS.map((c,i)=>'<button class="x-tab'+(i===cat?' on':'')+'" data-i="'+i+'" type="button">'+c[1]+'</button>').join('')}
function renderDock(){$('xDock').innerHTML=dockItems().map((d,i)=>'<button class="x-d" data-i="'+i+'" type="button" aria-label="'+esc(d.lb)+'">'+d.ic+'<span>'+esc(d.lb)+' ['+d.k.toUpperCase()+']</span></button>').join('')}
function renderRow(){const L=items();if(idx>=L.length)idx=Math.max(0,L.length-1);
 $('xRow').innerHTML=L.map((g,i)=>{const bd=g.locked?'<span class="bd lock">🔒</span>':g.cats.includes('epic3d')?'<span class="bd">EPIC</span>':g.isNew?'<span class="bd">NEW</span>':'';return '<button class="x-tile'+(i===idx?' on':'')+'" data-i="'+i+'" type="button" style="background-image:url(\''+TH(g.slug)+'\')">'+bd+'<span class="ic" style="display:none">'+g.icon+'</span><span class="nm">'+esc(g.title)+'</span></button>'}).join('')||'<div style="padding:30px;opacity:.7">Nothing here yet.</div>';
 if(!LITE){const tiles=$('xRow').children;L.forEach((g,i)=>{const im=new Image();im.onerror=()=>{const ic=tiles[i]&&tiles[i].querySelector('.ic');if(ic)ic.style.display='grid'};im.src=TH(g.slug)})}}
function setBackdrop(url){const w=$('xArtBg');if(!w)return;const d=document.createElement('div');d.className='x-abg';d.style.backgroundImage="url('"+url+"')";w.appendChild(d);requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add('in')));const old=[...w.children].slice(0,-1);old.forEach(o=>{o.classList.remove('in');setTimeout(()=>o.remove(),800)})}
function focus(smooth,instant){const row=$('xRow'),L=items(),g=L[idx];[...row.children].forEach((t,i)=>t.classList&&t.classList.toggle('on',i===idx));
 const t=row.children[idx];if(t&&t.classList){const pl=parseFloat(getComputedStyle(row).paddingLeft)||0;muteScroll=Date.now()+700;row.style.scrollBehavior=instant?'auto':'smooth';row.scrollLeft=Math.max(0,t.offsetLeft-pl-8)}
 const tab=$('xTabs').querySelector('.x-tab.on');if(tab)$('xTabs').scrollLeft=Math.max(0,tab.offsetLeft-window.innerWidth*.2);
 const h=$('xHero');if(!g){h.innerHTML='';return}
 const bd=(g.locked?'<span class="x-b lock">🔒 PREMIUM</span>':'')+(g.cats.includes('epic3d')?'<span class="x-b">EPIC & 3D</span>':g.isNew?'<span class="x-b">NEW</span>':'');
 h.innerHTML='<div class="x-txt"><div class="x-kick">'+esc(CATS[cat][1])+' '+bd+'</div><h2>'+esc(g.title)+'</h2><div class="x-tg">'+esc(g.tags)+'</div><p>'+esc(g.desc)+'</p><div class="x-act"><button class="x-go" id="xGo" type="button">'+(g.locked?'🔒 UNLOCK INFO':'▶ PLAY')+'</button><a class="x-sec" href="play/'+g.slug+'.html">ⓘ DETAILS</a></div></div><div class="x-art" style="background-image:url(\''+TH(g.slug)+'\')"><span class="ic" style="display:none">'+g.icon+'</span></div>';
 $('xGo').addEventListener('click',act);setBackdrop(TH(g.slug))}
function selCat(i){if(i<0||i>=CATS.length)return;cat=i;idx=0;renderTabs();renderRow();focus(false,true);tick(520)}
function move(d){const n=items().length;if(!n)return;const j=Math.max(0,Math.min(n-1,idx+d));if(j!==idx){idx=j;focus(true);tick(740)}}
function act(){const g=items()[idx];if(!g)return;tick(900);g.btn.click()}
function rand(){const L=items().filter(g=>!g.locked);if(!L.length)return;const g=L[Math.floor(Math.random()*L.length)];idx=items().indexOf(g);focus(true);tick(820)}
function cycleSkin(){const i=SKINS.findIndex(s=>s[0]===skin());ls.set(KK,SKINS[(i+1)%SKINS.length][0]);applySkin();renderDock()}
function applySkin(){const r=$('rwXmb');if(!r)return;const k=skin();r.dataset.skin=k;const h=hueFor(k);let bg;
 if(k==='xbox')bg='radial-gradient(900px 600px at 80% 10%,rgba(60,170,20,.45),transparent 62%),radial-gradient(700px 500px at 10% 100%,rgba(16,124,16,.35),transparent 60%),linear-gradient(160deg,#0b140b,#020402)';
 else if(k==='switch')bg='linear-gradient(180deg,#f4f4f7,#dcdce2)';
 else bg='radial-gradient(1200px 700px at 78% 12%,hsl('+(h+18)+',85%,34%) 0%,transparent 60%),linear-gradient(165deg,hsl('+h+',82%,24%),hsl('+(h+12)+',88%,8%))';
 $('xBgFill').style.background=bg}
function modalOpen(){if(document.body.classList.contains('game-active'))return true;for(const el of document.body.children){if(el.id==='rwXmb'||el.tagName==='SCRIPT')continue;const cs=getComputedStyle(el);if(cs.position==='fixed'&&cs.display!=='none'&&cs.visibility!=='hidden'&&el.offsetWidth>200&&el.offsetHeight>150&&(parseInt(cs.zIndex)||0)>=85)return true}return false}

// ---- console player profile ----
let profOpen=false,profI=0;
const PROF_ROWS=['avatar','acc','theme','color','anim','title','motto','rand','troph','full','close'];
function profData(){const p=window.RWP&&RWP.active&&RWP.active();return p}
function profCycle(list,cur,d){let i=list.indexOf(cur);if(i<0)i=0;return list[(i+d+list.length)%list.length]}
function profChange(row,d){const p=profData(),R=window.RWP;if(!p||!R||!R.idn)return;const I=R.idn,pk=a=>a[Math.floor(Math.random()*a.length)];
 if(row==='avatar'){const ids=I.avatars.map(a=>a.id);p.avatar=profCycle(ids,p.avatar,d)}
 else if(row==='acc')p.acc=profCycle(I.accs,p.acc||'',d);
 else if(row==='theme')p.theme=profCycle(I.themes.map(t=>t.id),p.theme||'',d);
 else if(row==='color')p.accent=profCycle(I.colors,p.accent||'',d);
 else if(row==='anim')p.anim=profCycle(I.anims.map(a=>a[0]),p.anim||'',d);
 else if(row==='title')p.title=profCycle(I.titles,p.title||'',d);
 else if(row==='motto')p.motto=profCycle(I.mottos,p.motto||'',d);
 else if(row==='rand'){p.avatar=pk(I.avatars).id;p.acc=pk(I.accs);p.theme=pk(I.themes).id;p.accent=pk(I.colors);p.anim=pk(I.anims)[0];p.title=pk(I.titles);p.motto=pk(I.mottos)}
 R.save();try{I.render(p);I.refresh()}catch(e){}renderProf()}
function pesc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function renderProf(){const el=$('xProf');if(!el)return;const R=window.RWP,p=profData();
 if(!p||!R||!R.idn){el.innerHTML='<div class="xp-box"><h2>NO PLAYER PROFILE YET</h2><p>Create one to save scores, trophies and your own look.</p><div class="xp-btns"><button class="xp-b kf" data-r="create">＋ CREATE PROFILE</button><button class="xp-b" data-r="close">BACK</button></div></div>';profI=0;return}
 const I=R.idn,av=R.avatar(p.avatar),acc=p.accent||av.accent,th=I.themes.find(t=>t.id===(p.theme||''))||I.themes[0];
 const a=R.agg(p),defs=R.defs||[],earned=defs.filter(d=>p.trophies&&p.trophies[d.id]);
 const val={avatar:av.icon+' '+av.name,acc:p.acc||'NONE',theme:th.n,color:p.accent?'●':'AUTO',anim:(I.anims.find(x=>x[0]===(p.anim||''))||I.anims[0])[1],title:p.title||'NONE',motto:p.motto||'NONE'};
 const lab={avatar:'CHARACTER',acc:'ACCESSORY',theme:'CARD THEME',color:'GLOW',anim:'ANIMATION',title:'TITLE',motto:'MOTTO'};
 const g=glyphs();
 const rows=PROF_ROWS.map((r,i)=>{const f=i===profI?' kf':'';if(lab[r])return '<div class="xp-r'+f+'" data-i="'+i+'"><span>'+lab[r]+'</span><b'+(r==='color'&&p.accent?' style="color:'+p.accent+'"':'')+'>◀ '+pesc(val[r])+' ▶</b></div>';
  const t={rand:'🎲 SURPRISE ME',troph:'🏆 OPEN TROPHY ROOM',full:'📋 FULL PROFILE, SAVE & EXPORT',close:'◀ BACK TO MENU'}[r];return '<button class="xp-b'+f+'" data-i="'+i+'">'+t+'</button>'}).join('');
 const st=[['GAMES PLAYED',a.plays],['DIFFERENT GAMES',a.unique],['WINS',a.wins],['TOTAL POINTS',a.points],['BEST SCORE',a.maxScore],['CHALLENGES',a.challenges],['TOKENS',a.tokens],['TROPHIES',earned.length+' / '+defs.length]].map(x=>'<div class="xp-s"><b>'+(typeof x[1]==='number'?x[1].toLocaleString():x[1])+'</b><small>'+x[0]+'</small></div>').join('');
 const tr=earned.slice(0,24).map(d=>'<span class="xp-t on" title="'+pesc(d.name)+'">'+d.icon+'</span>').join('')||'<small style="color:#9aa3cc;font:700 11px monospace">PLAY GAMES TO EARN TROPHIES 🏆</small>';
 el.innerHTML='<div class="xp-box" style="--ac:'+acc+'"><div class="xp-card" style="background:'+th.c+'"><div class="xp-av" data-acc="'+pesc(p.acc||'')+'" data-anim="'+pesc(p.anim||'')+'">'+av.icon+'</div><div class="xp-nm">'+pesc(p.name)+'</div><div class="xp-gn">'+pesc(p.genre)+' PLAYER • '+pesc(av.game)+'</div>'+(p.title?'<div class="xp-ti">« '+pesc(p.title)+' »</div>':'')+(p.motto?'<div class="xp-mo">“'+pesc(p.motto)+'”</div>':'')+'</div><div class="xp-right"><div class="xp-stats">'+st+'</div><div class="xp-trs">'+tr+'</div><div class="xp-list">'+rows+'</div></div></div><div class="xp-hint">◀ ▶ '+'CHANGE   ▲ ▼ MOVE   '+g.A+' SELECT   '+g.B+' BACK</div>';
 const f=el.querySelector('.kf');if(f&&f.scrollIntoView)f.scrollIntoView({block:'nearest'})}
function showProf(){const el=$('xProf');if(!el)return;profOpen=true;profI=0;el.hidden=false;renderProf();updTop()}
function hideProf(){profOpen=false;const el=$('xProf');if(el)el.hidden=true;updTop();focus&&focus(true)}
function updTop(){try{const p=profData(),av=p&&RWP.avatar(p.avatar),e=$('xAv');if(e&&av){e.textContent=av.icon+(p.acc||'')}}catch(x){}}
function profNav(k){const p=profData();if(!p||!(window.RWP&&RWP.idn)){if(k==='A'){hideProf();if(RWP&&RWP.openOnboarding)RWP.openOnboarding()}else if(k==='B')hideProf();return}
 const r=PROF_ROWS[profI];
 if(k==='U')profI=(profI-1+PROF_ROWS.length)%PROF_ROWS.length;else if(k==='D')profI=(profI+1)%PROF_ROWS.length;
 else if(k==='L'||k==='l'){if(!['rand','troph','full','close'].includes(r))profChange(r,-1);return}
 else if(k==='R'||k==='r'){if(!['rand','troph','full','close'].includes(r))profChange(r,1);return}
 else if(k==='X'){profChange('rand',0);return}
 else if(k==='B'||k==='E'||k==='S'){hideProf();return}
 else if(k==='A'){if(r==='close')hideProf();else if(r==='troph'){hideProf();showTro()}else if(r==='full'){hideProf();if(RWP.openProfile)RWP.openProfile()}else if(r==='rand')profChange('rand',0);else profChange(r,1);return}
 tick&&tick(700);renderProf()}

// ---- console trophy room ----
let troOpen=false,troI=0,troF=0;const TRO_F=['ALL','EARNED','LOCKED'];
function troList(){const p=profData(),R=window.RWP;const defs=(R&&R.defs)||[];const ea=d=>!!(p&&p.trophies&&p.trophies[d.id]);return defs.filter(d=>troF===0||(troF===1?ea(d):!ea(d)))}
function renderTro(keep){const el=$('xTro');if(!el)return;const p=profData(),R=window.RWP;const defs=(R&&R.defs)||[];const g=glyphs();
 const ea=d=>!!(p&&p.trophies&&p.trophies[d.id]);const n=defs.filter(ea).length;const L=troList();if(troI>=L.length)troI=Math.max(0,L.length-1);
 const cur=L[troI];const pct=defs.length?Math.round(n/defs.length*100):0;
 el.innerHTML='<div class="xt-top"><h2>🏆 TROPHY ROOM</h2><div class="xt-prog"><div style="width:'+pct+'%"></div></div><b>'+n+' / '+defs.length+' • '+pct+'%</b></div><div class="xt-tabs">'+TRO_F.map((f,i)=>'<span class="'+(i===troF?'on':'')+'" data-f="'+i+'">'+f+'</span>').join('')+'</div><div class="xt-grid">'+(L.length?L.map((d,i)=>'<div class="xt-t'+(ea(d)?' on':'')+(i===troI?' kf':'')+'" data-i="'+i+'"><span>'+d.icon+'</span></div>').join(''):'<div class="xt-empty">NOTHING HERE YET — GO PLAY! 🕹️</div>')+'</div><div class="xt-det">'+(cur?'<span class="xt-ic">'+cur.icon+'</span><div><b>'+pesc(cur.name)+'</b><small>'+(ea(cur)?'✔ UNLOCKED':'LOCKED')+'</small><p>'+pesc(cur.desc||'')+'</p></div>':'')+'</div><div class="xp-hint">◀ ▶ ▲ ▼ MOVE   '+g.L+'/'+g.R+' FILTER   '+g.Y+' FULL TROPHY ROOM   '+g.B+' BACK</div>';
 const f=el.querySelector('.kf');if(f&&f.scrollIntoView)f.scrollIntoView({block:'nearest'})}
function showTro(){const el=$('xTro');if(!el)return;if(profOpen)hideProf();troOpen=true;troI=0;el.hidden=false;renderTro()}
function hideTro(){troOpen=false;const el=$('xTro');if(el)el.hidden=true;focus&&focus(true)}
function troCols(){const t=document.querySelectorAll('#xTro .xt-t');if(t.length<2)return 1;const y=t[0].offsetTop;let c=0;while(c<t.length&&t[c].offsetTop===y)c++;return Math.max(1,c)}
function troNav(k){const L=troList(),c=troCols();
 if(k==='B'||k==='E'||k==='S'){hideTro();return}
 if(k==='Y'){hideTro();try{window.RWP_UI&&RWP_UI.openRoom?RWP_UI.openRoom('rewards'):RWP.openProfile()}catch(e){}return}
 if(k==='r'||k==='N'){troF=(troF+1)%3;troI=0}else if(k==='l'||k==='P'){troF=(troF+2)%3;troI=0}
 else if(k==='L')troI=Math.max(0,troI-1);else if(k==='R')troI=Math.min(L.length-1,troI+1);
 else if(k==='U')troI=troI-c>=0?troI-c:troI;else if(k==='D')troI=troI+c<L.length?troI+c:L.length-1;
 else return;tick&&tick(700);renderTro()}
let zone='row',dockI=0;
function dockFocus(){const ds=document.querySelectorAll('#xDock .x-d');ds.forEach((d,i)=>d.classList.toggle('kf',zone==='dock'&&i===dockI))}
function setZone(z){zone=z;dockFocus()}
function dockMove(d){const n=dockItems().length;dockI=(dockI+d+n)%n;dockFocus();tick(700)}
function dockAct(){const it=dockItems()[dockI];tick(900);if(it)it.run()}
function nav(k){ if(troOpen){troNav(k);return} if(profOpen){profNav(k);return} // k: L R U D A B X Y S(start) E(select) P(L2) N(R2) l(L1) r(R1)
 if(zone==='dock'){if(k==='L')dockMove(-1);else if(k==='R')dockMove(1);else if(k==='A')dockAct();else if(k==='U'||k==='B'||k==='E')setZone('row');return}
 if(k==='L')move(-1);else if(k==='R')move(1);else if(k==='D'){if(cat>=CATS.length-1)setZone('dock');else selCat(cat+1)}else if(k==='U')selCat(cat-1);else if(k==='A')act();else if(k==='X')rand();else if(k==='Y')cycleSkin();else if(k==='S'){showProf()}else if(k==='E')setZone('dock');else if(k==='P')move(-5);else if(k==='N')move(5);else if(k==='l')selCat(cat-1);else if(k==='r')selCat(cat+1)}
function key(e){if(!on)return;if(troOpen){const m={ArrowLeft:'L',ArrowRight:'R',ArrowUp:'U',ArrowDown:'D',Escape:'B',Backspace:'B',BrowserBack:'B',Tab:'r',y:'Y'}[e.key];if(m||e.keyCode===461){troNav(m||'B');e.preventDefault()}return}if(profOpen){const m={ArrowLeft:'L',ArrowRight:'R',ArrowUp:'U',ArrowDown:'D',Enter:'A',' ':'A',Escape:'B',Backspace:'B',BrowserBack:'B'}[e.key];if(m||e.keyCode===461){profNav(m||'B');e.preventDefault()}return}const tg=e.target;if(tg&&/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))return;if(modalOpen())return;const k=e.key,dk=dockItems().find(d=>d.k===k.toLowerCase());
 if(k==='Tab'){setZone(zone==='dock'?'row':'dock');e.preventDefault();return}
 if(k==='Escape'||k==='Backspace'||k==='BrowserBack'||e.keyCode===461){if(zone==='dock'){setZone('row');e.preventDefault();return}if((k==='BrowserBack'||e.keyCode===461)&&/web0s|webos/i.test(navigator.userAgent)){try{window.close()}catch(x){}}e.preventDefault();return}
 if(zone==='dock'){if(k==='ArrowRight')dockMove(1);else if(k==='ArrowLeft')dockMove(-1);else if(k==='Enter'||k===' ')dockAct();else if(k==='ArrowUp')setZone('row');else if(dk)dk.run();else return;e.preventDefault();return}
 if(k==='ArrowRight'||k==='d'){move(1)}else if(k==='ArrowLeft'||k==='a'){move(-1)}else if(k==='ArrowDown'||k==='s'||k==='PageDown'){nav('D')}else if(k==='ArrowUp'||k==='w'||k==='PageUp'){selCat(cat-1)}else if(k==='Enter'||k===' '){const ae=document.activeElement;if(ae&&(ae.id==='xClassic'||ae.classList.contains('x-d')))return;act()}else if(dk){dk.run()}else if(k==='Home'){idx=0;focus(true)}else if(k==='End'){idx=items().length-1;focus(true)}else return;e.preventDefault()}
// ---- controller (PS / Xbox / generic) ----
function padKind(gp){const id=((gp&&gp.id)||'').toLowerCase();return /054c|sony|dualshock|dualsense|wireless controller|playstation/.test(id)?'ps':'xb'}
function glyphs(){const gp=[...(navigator.getGamepads?navigator.getGamepads():[])].find(Boolean);const ps=padKind(gp)==='ps';return ps?{A:'✕',B:'○',X:'□',Y:'△',S:'OPTIONS',E:'SHARE',L:'L1',R:'R1'}:{A:'A',B:'B',X:'X',Y:'Y',S:'MENU',E:'VIEW',L:'LB',R:'RB'}}
function renderPads(){const el=$('xPads');if(!el)return;const gp=navigator.getGamepads&&[...navigator.getGamepads()].find(Boolean);const show=!!gp||!!window.RETROWORLD_TV_DEVICE||document.body.classList.contains('x-tvmode');el.style.display=show?'flex':'none';if(!show)return;const g=glyphs();el.innerHTML='<span><b>'+g.A+'</b> PLAY</span><span><b>'+g.X+'</b> RANDOM</span><span><b>'+g.Y+'</b> STYLE</span><span><b>'+g.L+'/'+g.R+'</b> CATEGORY</span><span><b>'+g.S+'</b> PROFILE</span><span><b>'+g.E+'</b> DOCK</span>'}
let lastPadN=0;
function padLoop(){requestAnimationFrame(padLoop);if(!navigator.getGamepads)return;const gp=[...navigator.getGamepads()].find(Boolean);const n=gp?1:0;if(n!==lastPadN){lastPadN=n;renderPads();if(!gp)setZone('row')}if(!on||!gp||modalOpen())return;
 const b=i=>gp.buttons[i]&&gp.buttons[i].pressed,ax=gp.axes||[];let k='';
 if(b(14)||ax[0]<-.6)k='L';else if(b(15)||ax[0]>.6)k='R';else if(b(13)||ax[1]>.6)k='D';else if(b(12)||ax[1]<-.6)k='U';else if(b(0))k='A';else if(b(1))k='B';else if(b(2))k='X';else if(b(3))k='Y';else if(b(9))k='S';else if(b(8))k='E';else if(b(4))k='l';else if(b(5))k='r';else if(b(6))k='P';else if(b(7))k='N';
 const nw=performance.now();if(!k){pad.k='';return}if(k!==pad.k){pad.k=k;pad.t=nw+420}else if(nw<pad.t||'ABXYSElr'.includes(k))return;else pad.t=nw+130;nav(k)}
function tick(f){if(ls.get(SK,'on')!=='on')return;try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();const o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime;o.type='sine';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.35,t+.07);g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+.12);o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+.13)}catch(e){}}
let bg,bx,bw,bh,bt=0,raf=0;
function bgInit(){bg=$('xBg');bx=bg.getContext('2d');const rs=()=>{bw=bg.width=Math.max(320,innerWidth>>1);bh=bg.height=Math.max(200,innerHeight>>1)};rs();addEventListener('resize',rs)}
const FXK='rw_xmb_fx',FXS=[['waves','WAVES'],['aurora','AURORA'],['stars','STARFIELD'],['rain','NEON RAIN'],['bubbles','BUBBLES'],['static','STATIC (OFF)']];
function fxMode(){let v=ls.get(FXK,LITE?'static':'waves');return FXS.some(f=>f[0]===v)?v:'waves'}
function fxApply(){const m=fxMode();document.documentElement.classList.toggle('rw-fxon',m!=='static');if(bx){bx.clearRect(0,0,bw,bh)}if(m!=='static'&&!raf&&on)bgFrame()}
function cycleFx(){const i=FXS.findIndex(f=>f[0]===fxMode());ls.set(FXK,FXS[(i+1)%FXS.length][0]);fxApply();renderDock()}
let fxP=null,fxM='';
function fxInitP(m){fxM=m;fxP=[];const n=m==='stars'?90:m==='rain'?42:m==='bubbles'?26:0;for(let i=0;i<n;i++)fxP.push({x:Math.random(),y:Math.random(),z:.3+Math.random()*.9,r:Math.random()})}
function bgFrame(){const m=fxMode();if(m==='static'){raf=0;return}raf=requestAnimationFrame(bgFrame);if(!on||document.hidden||document.body.classList.contains('game-active'))return;if(m!==fxM)fxInitP(m);
 if(m==='waves'){bt+=.012;const k=skin(),sw=k==='switch',h=hueFor(k);bx.clearRect(0,0,bw,bh);bx.globalCompositeOperation=sw?'source-over':'lighter';
 for(let i=0;i<6;i++){const y0=bh*(.4+i*.09),amp=bh*(.06+.02*i),f=.006+i*.0016,sp=bt*(.6+i*.18)+i*1.7,hh=sw?(i%2?190:352):h+i*9,L=sw?60:55+i*3,al=sw?.1:.1-i*.01;const g=bx.createLinearGradient(0,y0-amp,0,bh);g.addColorStop(0,'hsla('+hh+',90%,'+L+'%,'+al+')');g.addColorStop(1,'hsla('+(hh+30)+',90%,'+(sw?70:40)+'%,0)');bx.fillStyle=g;bx.beginPath();bx.moveTo(0,bh);for(let x=0;x<=bw;x+=8)bx.lineTo(x,y0+Math.sin(x*f+sp)*amp+Math.sin(x*f*2.3-sp*1.3)*amp*.35);bx.lineTo(bw,bh);bx.closePath();bx.fill()}
 if(!sw)for(let i=0;i<24;i++){const x=((i*137.5+bt*14*(1+i%3))%bw),y=(i*61.3+Math.sin(bt+i)*18)%(bh*.9);bx.fillStyle='rgba(255,255,255,'+(.06+.08*((i%5)/5))+')';bx.fillRect(x,y,1.6,1.6)}bx.globalCompositeOperation='source-over'}
 else{bt+=.012;const k=skin(),h=hueFor(k);bx.clearRect(0,0,bw,bh);bx.globalCompositeOperation='lighter';
  if(m==='aurora'){for(let i=0;i<4;i++){const cx=bw*(.2+.2*i)+Math.sin(bt*.6+i*1.9)*bw*.12,w=bw*.34,hh=h+i*38+Math.sin(bt+i)*20;const g=bx.createLinearGradient(0,bh*.05,0,bh*.85);g.addColorStop(0,'hsla('+hh+',90%,60%,0)');g.addColorStop(.35,'hsla('+hh+',95%,62%,.16)');g.addColorStop(1,'hsla('+(hh+40)+',90%,50%,0)');bx.fillStyle=g;bx.beginPath();bx.moveTo(cx-w/2,bh);for(let y=bh;y>=0;y-=10){bx.lineTo(cx-w/2+Math.sin(y*.02+bt*1.4+i)*bw*.05,y)}for(let y=0;y<=bh;y+=10){bx.lineTo(cx+w/2+Math.sin(y*.02+bt*1.2+i*2)*bw*.05,y)}bx.closePath();bx.fill()}}
  else if(m==='stars'){const cx=bw/2,cy=bh*.46;fxP.forEach(p=>{p.z-=.0035*(1+p.r);if(p.z<=.02){p.z=1.1;p.x=Math.random();p.y=Math.random();p.r=Math.random()}const sx=cx+(p.x-.5)*bw/p.z*.55,sy=cy+(p.y-.5)*bh/p.z*.55,s=Math.max(1,3.4*(1-p.z)),a=Math.min(1,(1-p.z)*1.8);bx.fillStyle='hsla('+(h+p.r*60)+',90%,85%,'+a+')';bx.fillRect(sx,sy,s,s)})}
  else if(m==='rain'){bx.lineWidth=2;fxP.forEach(p=>{p.y+=.006*p.z+.002;if(p.y>1.2){p.y=-.2;p.x=Math.random()}const x=p.x*bw,y=p.y*bh,l=bh*.12*p.z,g=bx.createLinearGradient(0,y-l,0,y);const hh=h+p.r*80;g.addColorStop(0,'hsla('+hh+',100%,60%,0)');g.addColorStop(1,'hsla('+hh+',100%,65%,'+(.35+.35*p.z)+')');bx.strokeStyle=g;bx.beginPath();bx.moveTo(x,y-l);bx.lineTo(x,y);bx.stroke()})}
  else if(m==='bubbles'){fxP.forEach(p=>{p.y-=.0016*p.z;p.x+=Math.sin(bt*2+p.r*9)*.0006;if(p.y<-.1){p.y=1.1;p.x=Math.random()}const x=p.x*bw,y=p.y*bh,r=(6+p.r*22)*p.z,g=bx.createRadialGradient(x-r*.3,y-r*.3,r*.1,x,y,r);g.addColorStop(0,'hsla('+(h+p.r*70)+',90%,85%,.22)');g.addColorStop(.8,'hsla('+(h+p.r*70)+',90%,60%,.06)');g.addColorStop(1,'hsla('+(h+p.r*70)+',90%,70%,.2)');bx.fillStyle=g;bx.beginPath();bx.arc(x,y,r,0,6.283);bx.fill()})}
  bx.globalCompositeOperation='source-over'}}
let liteDone=false;
function liteTrim(on){ // free memory + CPU of the hidden classic page on weak TV browsers
 const m=document.querySelector('main');
 if(on){if(liteDone)return;liteDone=true;
  try{const bs=document.getElementById('bgSelect');if(bs&&bs.value!=='static'){bs.value='static';bs.dispatchEvent(new Event('change'))}}catch(e){}
  document.querySelectorAll('video').forEach(v=>{try{v.pause();v.removeAttribute('src');v.querySelectorAll('source').forEach(x=>x.remove());v.load()}catch(e){}});
  if(m)m.querySelectorAll('img').forEach(i=>{if(i.getAttribute('src')){i.dataset.rwsrc=i.getAttribute('src');i.removeAttribute('src')}});
  document.querySelectorAll('canvas#arcadeBg').forEach(c=>{c.width=c.height=1})}
 else if(liteDone){liteDone=false;if(m)m.querySelectorAll('img[data-rwsrc]').forEach(i=>{i.src=i.dataset.rwsrc})}}
function setView(v){ls.set(VK,v);const c=v==='console',mb=v==='mobile';document.body.classList.toggle('rw-console',c);document.body.classList.toggle('rw-mobile',mb);on=c;if(window.RWMobile)window.RWMobile.show(mb);if(c){build();readGames();renderTabs();renderRow();renderDock();focus(false,true);applySkin();fxApply();if(LITE){liteTrim(true);setTimeout(()=>{liteDone=false;liteTrim(true)},4000)}}else if(LITE)liteTrim(false);try{if(window.RETROWORLD_TV)RETROWORLD_TV.temp(c||mb||!!window.RETROWORLD_TV_DEVICE)}catch(e){}syncMusic();window.scrollTo(0,0)}
function init(){const q=/[?&]view=(classic|console|mobile)/.exec(location.search);let v=q?q[1]:ls.get(VK,'');if(!q&&/[?&]tv=(1|on|true)/i.test(location.search))v='console';if(!v&&window.RETROWORLD_TV_DEVICE)v='console';if(!v){v=(matchMedia('(max-width:640px)').matches&&('ontouchstart' in window||navigator.maxTouchPoints>0))?'mobile':'classic'}if(!q&&/^#(games|epic|news|about|play=)/.test(location.hash))v='classic';
 const go=()=>{const tvb=document.getElementById('tvModeBtn');if(tvb)tvb.addEventListener('click',e=>{e.stopImmediatePropagation();e.preventDefault();setView(document.body.classList.contains('rw-console')?'classic':'console')},true);const mbb=document.getElementById('mobileModeBtn');if(mbb)mbb.addEventListener('click',()=>setView('mobile'));if(v!=='classic')setView(v)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go()}
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;if(t.closest('.x-prof')&&on){showProf();return}const b=t.closest('#xProf [data-r],#xProf [data-i]');if(!b)return;if(b.dataset.r==='create'){hideProf();if(RWP.openOnboarding)RWP.openOnboarding();return}if(b.dataset.r==='close'){hideProf();return}profI=+b.dataset.i;profNav('A')});
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('#xTro .xt-t,#xTro .xt-tabs span');if(!t)return;if(t.dataset.f!=null){troF=+t.dataset.f;troI=0}else troI=+t.dataset.i;renderTro()});
window.RWConsole={set:setView};init();
})();
