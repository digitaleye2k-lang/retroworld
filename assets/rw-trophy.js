/* RETRO WORLD — TROPHY ROOM
   Separate from the profile: levels & ranks, tiered trophies with live progress, secret trophies,
   daily check-in streak, weekly quests, Game of the Day, unlock celebrations. */
(()=>{
'use strict';
let R=null;
function boot(){R=window.RWP;if(!R||boot.done)return;boot.done=true;try{init()}catch(e){console.error('trophy room',e)}}

const $=(s,r)=>(r||document).querySelector(s),$$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};

/* ---------- date helpers ---------- */
const pad=n=>String(n).padStart(2,'0');
const keyOf=t=>t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate());
const parseKey=k=>{const a=String(k).split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
const addDays=(k,n)=>{const t=parseKey(k);t.setDate(t.getDate()+n);return keyOf(t)};
const diffDays=(a,b)=>Math.round((Date.UTC(...b.split('-').map((x,i)=>i===1?x-1:+x))-Date.UTC(...a.split('-').map((x,i)=>i===1?x-1:+x)))/864e5);
const weekStart=k=>{const t=parseKey(k);return addDays(k,-((t.getDay()+6)%7))};
const today=()=>R.dayKey();
function untilMidnight(){const n=new Date(),m=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1);return m-n}
function untilMonday(){const n=new Date(),d=(8-n.getDay())%7||7,m=new Date(n.getFullYear(),n.getMonth(),n.getDate()+d);return m-n}
function hms(ms){const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h>=24?Math.floor(h/24)+'d '+(h%24)+'h':h+'h '+pad(m)+'m'}
function seeded(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}
  return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return(h>>>0)/4294967296}}

/* ---------- tiers / ranks ---------- */
const TIERS={bronze:{xp:40,col:'#e0904a',name:'BRONZE',rar:'COMMON'},silver:{xp:90,col:'#cfd9ee',name:'SILVER',rar:'RARE'},
  gold:{xp:200,col:'#ffd23f',name:'GOLD',rar:'EPIC'},platinum:{xp:500,col:'#8ff7ff',name:'PLATINUM',rar:'LEGENDARY'}};
const TIER_ORDER=['bronze','silver','gold','platinum'];
const RANKS=[[1,'ROOKIE','#9aa0c9'],[3,'ARCADE KID','#67ff67'],[6,'PIXEL PUNK','#00ffff'],[10,'CABINET REGULAR','#4aa8ff'],[15,'HIGH SCORER','#c18bff'],
  [20,'COIN CRUSHER','#ff2bd6'],[25,'ARCADE ACE','#ff8a3d'],[30,'NEON LEGEND','#ffe85c'],[40,'GRAND MASTER','#ff4b64'],[50,'RETRO GOD','#8ff7ff']];
const needFor=l=>150+l*50;
function levelInfo(xp){let l=1,rem=xp;while(l<99&&rem>=needFor(l)){rem-=needFor(l);l++}return{level:l,into:rem,need:needFor(l)}}
function rankOf(l){let r=RANKS[0];RANKS.forEach(x=>{if(l>=x[0])r=x});return{title:r[1],col:r[2],at:r[0]}}

/* ---------- per-profile state ---------- */
const REWARDS=[{t:50,x:20},{t:75,x:25},{t:100,x:30},{t:150,x:40},{t:200,x:50},{t:300,x:60},{t:600,x:150,chest:1}];
function rw(p){
  if(!p)return null;
  const r=p.rw=p.rw&&typeof p.rw==='object'?p.rw:{};
  r.v=1;r.xp=r.xp||0;r.pinned=Array.isArray(r.pinned)?r.pinned:[];r.flags=r.flags||{};r.cnt=r.cnt||{};
  r.streak=r.streak||{last:null,count:0,best:0,freeze:1};
  r.streak.freeze=r.streak.freeze==null?1:r.streak.freeze;
  r.recent=Array.isArray(r.recent)?r.recent:[];
  r.week=r.week||{};r.gotd=r.gotd||{};r.pd=r.pd||{};
  return r;
}
function rollWeek(p){
  const r=rw(p),wk=weekStart(today());
  if(r.week.key!==wk){
    r.week={key:wk,plays:0,uniq:[],wins:0,finishes:0,points:0,daily:0,checkins:0,gotd:0,claimed:{},swept:false,quests:makeQuests(p,wk)};
  }
  if(!r.week.quests||!r.week.quests.length)r.week.quests=makeQuests(p,wk);
  return r.week;
}
const QPOOL=[
  {k:'uniq',icon:'🎮',name:'ARCADE TOURIST',txt:n=>'Play '+n+' different games',min:6,max:9,tok:300,xp:60,val:w=>w.uniq.length},
  {k:'wins',icon:'🏆',name:'WINNING STREAK',txt:n=>'Win '+n+' games',min:4,max:7,tok:400,xp:80,val:w=>w.wins},
  {k:'finishes',icon:'🏁',name:'FINISH WHAT YOU START',txt:n=>'Finish '+n+' game sessions',min:10,max:16,tok:350,xp:70,val:w=>w.finishes},
  {k:'points',icon:'💰',name:'POINT RUSH',txt:n=>'Bank '+R.fmt(n)+' points',min:3000,max:6000,step:500,tok:400,xp:80,val:w=>w.points},
  {k:'daily',icon:'🎲',name:'DAILY GRINDER',txt:n=>'Complete '+n+' daily challenges',min:5,max:8,tok:500,xp:100,val:w=>w.daily},
  {k:'checkins',icon:'🔥',name:'SHOW UP',txt:n=>'Check in on '+n+' different days',min:4,max:6,tok:400,xp:80,val:w=>w.checkins},
  {k:'gotd',icon:'⭐',name:'DAILY DRIVER',txt:n=>'Finish the Game of the Day on '+n+' days',min:3,max:4,tok:450,xp:90,val:w=>w.gotd},
  {k:'plays',icon:'🕹️',name:'INSERT COINS',txt:n=>'Start '+n+' game sessions',min:15,max:25,tok:300,xp:60,val:w=>w.plays}
];
function makeQuests(p,wk){
  const rng=seeded(wk+'|'+p.id),pool=QPOOL.slice(),out=[];
  while(out.length<4&&pool.length){
    const d=pool.splice(Math.floor(rng()*pool.length),1)[0],st=d.step||1;
    const n=Math.round((d.min+Math.floor(rng()*(d.max-d.min+1)))/st)*st;
    out.push({k:d.k,target:n});
  }
  return out;
}
const qdef=k=>QPOOL.find(q=>q.k===k);

/* ---------- Game of the Day ---------- */
function eligibleGames(p){
  return $$('button.play[data-game]').map(b=>b.dataset.game).filter((g,i,a)=>a.indexOf(g)===i)
    .filter(id=>!/popshot|crimson|dust|beat-up/.test(id)).filter(id=>{try{return R.unlocked(p,id)}catch(e){return true}}).sort();
}
function gotdId(p){
  const list=eligibleGames(p);if(!list.length)return null;
  const rng=seeded('gotd|'+today());return list[Math.floor(rng()*list.length)];
}
const nameOf=id=>(R.titles&&R.titles[id])||id.replace(/\.html$/,'').replace(/-/g,' ').toUpperCase();
const thumbOf=id=>'assets/thumbs/'+id.replace(/\.html$/,'')+'.jpg';

/* ---------- stats helpers for trophy tests ---------- */
const st=(p,id)=>(p.stats&&p.stats[id])||null;
const playedN=(p,id)=>{const s=st(p,id);return s?(s.plays||0):0};
const bestN=(p,id)=>{const s=st(p,id);return s&&typeof s.best==='number'?s.best:0};
const winsN=(p,id)=>{const s=st(p,id);return s?(s.wins||0):0};
const allPlayed=(p,ids)=>ids.every(i=>playedN(p,i)>0);
const cntPlayed=(p,ids)=>ids.filter(i=>playedN(p,i)>0).length;
const CNT=(p,k)=>(rw(p).cnt[k]||0);
const lvlOf=p=>levelInfo(totalXp(p)).level;
const NEWG=['neon-survivors.html','grid-guardians.html','bubble-pop.html','sky-hop.html','neon-sudoku.html'];

/* ---------- new trophies ---------- */
const N=(id,icon,name,desc,tier,cat,test,prog,hidden)=>({id,icon,name,desc,tier,cat,test,prog,hidden:!!hidden,fresh:true});
const NEW_DEFS=[
  // streaks
  N('streak_3','🔥','WARMING UP','Check in 3 days in a row.','bronze','STREAK',(a,p)=>rw(p).streak.best>=3,p=>[rw(p).streak.best,3]),
  N('streak_7','📆','WEEK WARRIOR','Reach a 7-day check-in streak.','silver','STREAK',(a,p)=>rw(p).streak.best>=7,p=>[rw(p).streak.best,7]),
  N('streak_14','⚡','FORTNIGHT FIGHTER','Reach a 14-day check-in streak.','gold','STREAK',(a,p)=>rw(p).streak.best>=14,p=>[rw(p).streak.best,14]),
  N('streak_30','🌋','MONTHLY MACHINE','Reach a 30-day check-in streak.','platinum','STREAK',(a,p)=>rw(p).streak.best>=30,p=>[rw(p).streak.best,30]),
  N('streak_60','♾️','UNSTOPPABLE','Reach a 60-day check-in streak.','platinum','STREAK',(a,p)=>rw(p).streak.best>=60,p=>[rw(p).streak.best,60]),
  N('checkins_10','🚪','REGULAR VISITOR','Check in on 10 different days.','silver','STREAK',(a,p)=>CNT(p,'checkins')>=10,p=>[CNT(p,'checkins'),10]),
  N('checkins_50','🏠','SECOND HOME','Check in on 50 different days.','gold','STREAK',(a,p)=>CNT(p,'checkins')>=50,p=>[CNT(p,'checkins'),50]),
  // weekly + daily
  N('week_1','🗓️','WEEKLY WINNER','Complete a weekly quest.','silver','QUESTS',(a,p)=>CNT(p,'weekly')>=1,p=>[CNT(p,'weekly'),1]),
  N('week_10','🎖️','QUEST RUNNER','Complete 10 weekly quests.','gold','QUESTS',(a,p)=>CNT(p,'weekly')>=10,p=>[CNT(p,'weekly'),10]),
  N('sweep_1','🧹','FULL SWEEP','Complete all 4 weekly quests in one week.','gold','QUESTS',(a,p)=>CNT(p,'sweep')>=1,p=>[CNT(p,'sweep'),1]),
  N('sweep_4','👑','SWEEP MASTER','Sweep the weekly quests 4 times.','platinum','QUESTS',(a,p)=>CNT(p,'sweep')>=4,p=>[CNT(p,'sweep'),4]),
  N('perfect_1','🎯','TRIPLE THREAT','Finish all 3 daily challenges in one day.','silver','QUESTS',(a,p)=>CNT(p,'perfect')>=1,p=>[CNT(p,'perfect'),1]),
  N('perfect_7','💫','PERFECT WEEK','Finish all 3 daily challenges on 7 different days.','gold','QUESTS',(a,p)=>CNT(p,'perfect')>=7,p=>[CNT(p,'perfect'),7]),
  N('gotd_1','⭐','GAME OF THE DAY','Finish the Game of the Day.','bronze','EXPLORER',(a,p)=>CNT(p,'gotd')>=1,p=>[CNT(p,'gotd'),1]),
  N('gotd_7','🌟','DAILY DRIVER','Finish the Game of the Day 7 times.','silver','EXPLORER',(a,p)=>CNT(p,'gotd')>=7,p=>[CNT(p,'gotd'),7]),
  N('gotd_30','💎','GAME-A-DAY','Finish the Game of the Day 30 times.','gold','EXPLORER',(a,p)=>CNT(p,'gotd')>=30,p=>[CNT(p,'gotd'),30]),
  // levels
  N('lvl_5','🔰','RISING STAR','Reach Level 5.','bronze','RANK',(a,p)=>lvlOf(p)>=5,p=>[lvlOf(p),5]),
  N('lvl_10','🛡️','CABINET REGULAR','Reach Level 10.','silver','RANK',(a,p)=>lvlOf(p)>=10,p=>[lvlOf(p),10]),
  N('lvl_20','⚔️','COIN CRUSHER','Reach Level 20.','gold','RANK',(a,p)=>lvlOf(p)>=20,p=>[lvlOf(p),20]),
  N('lvl_30','🏆','NEON LEGEND','Reach Level 30.','platinum','RANK',(a,p)=>lvlOf(p)>=30,p=>[lvlOf(p),30]),
  // new games
  N('new_arrivals2','🆕','FRESH CARTRIDGES','Play Neon Survivors, Grid Guardians, Bubble Pop, Sky Hop and Neon Sudoku.','silver','COLLECTOR',(a,p)=>allPlayed(p,NEWG),p=>[cntPlayed(p,NEWG),5]),
  N('surv_win','☠️','OVERMIND DOWN','Defeat the Overmind in Neon Survivors.','gold','CHAMPION',(a,p)=>winsN(p,'neon-survivors.html')>=1,null),
  N('surv_score','🌀','HORDE HUNTER','Score 1,500 in Neon Survivors.','silver','SCORE',(a,p)=>bestN(p,'neon-survivors.html')>=1500,p=>[bestN(p,'neon-survivors.html'),1500]),
  N('td_win','🛰️','GRID COMMANDER','Survive all 25 waves in Grid Guardians.','gold','CHAMPION',(a,p)=>winsN(p,'grid-guardians.html')>=1,null),
  N('td_play','🧱','FIRST TOWER','Start Grid Guardians 3 times.','bronze','COLLECTOR',(a,p)=>playedN(p,'grid-guardians.html')>=3,p=>[playedN(p,'grid-guardians.html'),3]),
  N('bubble_score','🫧','BUBBLE BOSS','Score 2,000 in Bubble Pop.','silver','SCORE',(a,p)=>bestN(p,'bubble-pop.html')>=2000,p=>[bestN(p,'bubble-pop.html'),2000]),
  N('hop_500','🚀','SKY CLIMBER','Score 500 in Sky Hop.','bronze','SCORE',(a,p)=>bestN(p,'sky-hop.html')>=500,p=>[bestN(p,'sky-hop.html'),500]),
  N('hop_2500','🌌','ORBIT BOUND','Score 2,500 in Sky Hop.','gold','SCORE',(a,p)=>bestN(p,'sky-hop.html')>=2500,p=>[bestN(p,'sky-hop.html'),2500]),
  N('sudoku_win','🧩','PUZZLE MIND','Solve a Neon Sudoku board.','silver','CHAMPION',(a,p)=>winsN(p,'neon-sudoku.html')>=1,null),
  N('sudoku_10','🧠','SUDOKU SAGE','Solve 10 Neon Sudoku boards.','gold','CHAMPION',(a,p)=>winsN(p,'neon-sudoku.html')>=10,p=>[winsN(p,'neon-sudoku.html'),10]),
  // secrets
  N('night_owl','🦉','NIGHT OWL','Play a game between midnight and 5 AM.','silver','SECRET',(a,p)=>!!rw(p).flags.night,null,true),
  N('early_bird','🐦','EARLY BIRD','Play a game between 5 AM and 8 AM.','silver','SECRET',(a,p)=>!!rw(p).flags.early,null,true),
  N('weekend_warrior','🏖️','WEEKEND WARRIOR','Play on a Saturday and a Sunday.','silver','SECRET',(a,p)=>!!(rw(p).flags.sat&&rw(p).flags.sun),null,true),
  N('comeback','🔙','THE RETURN','Come back after a week away.','gold','SECRET',(a,p)=>!!rw(p).flags.comeback,null,true),
  N('one_more','🔁','ONE MORE GAME','Finish 5 sessions in a single day.','bronze','SECRET',(a,p)=>(rw(p).cnt.maxFinishDay||0)>=5,null,true),
  N('marathon_day','🏃','ARCADE ALL-NIGHTER','Start 20 sessions in a single day.','gold','SECRET',(a,p)=>(rw(p).cnt.maxPlayDay||0)>=20,null,true),
  N('frozen','🧊','SAVED BY THE FREEZE','Miss a day and keep your streak with a Streak Freeze.','silver','SECRET',(a,p)=>!!rw(p).flags.froze,null,true)
];

/* ---------- classify the old trophies (tier / category / progress) from their test source ---------- */
const LADDER={unique:[[24,'gold'],[12,'silver']],wins:[[100,'platinum'],[50,'gold'],[25,'silver']],plays:[[500,'platinum'],[200,'gold'],[100,'silver']],
  points:[[250000,'platinum'],[100000,'gold'],[25000,'silver']],tokens:[[10000,'platinum'],[5000,'gold'],[1000,'silver']],
  challenges:[[50,'gold'],[20,'silver'],[10,'silver']],maxScore:[[10000,'gold'],[2000,'silver']],finishes:[[50,'gold'],[20,'silver']]};
const KINDCAT={unique:'EXPLORER',plays:'EXPLORER',wins:'CHAMPION',finishes:'CHAMPION',points:'SCORE',maxScore:'SCORE',challenges:'QUESTS',tokens:'QUESTS'};
const PLAT=new Set(['cartridge_master','fang_campaign_clear','dust_campaign_clear','popshot_campaign_clear']);
const GOLD=new Set(['hellbyte_win','galactic_win','boss_win','pixel_racer_campaign','hover_bike_campaign','road_blaster_campaign','epic_trinity','premium_sky_reward','premium_galactic_reward','premium_hellbyte_reward','deep_catalog','almost_everywhere']);
function classify(t){
  if(t.tier)return;
  const src=String(t.test);let m;
  t.tier='bronze';t.cat='COLLECTOR';
  if((m=src.match(/a\.(unique|wins|plays|points|tokens|challenges|maxScore|finishes)>=(\d+)/))){
    const kind=m[1],n=+m[2];t.cat=KINDCAT[kind];
    (LADDER[kind]||[]).some(r=>{if(n>=r[0]){t.tier=r[1];return true}});
    t.prog=(a)=>[a[kind==='unique'?'unique':kind],n];t.progA=true;
  }else if((m=src.match(/playedAll\(p,\[([^\]]*)\]\)/))){
    const ids=(m[1].match(/'[^']+'/g)||[]).map(x=>x.slice(1,-1));t.tier=ids.length>=4?'silver':'bronze';t.cat='COLLECTOR';
    t.prog=p=>[cntPlayed(p,ids),ids.length];
  }else if((m=src.match(/bestAtLeast\(p,'([^']+)',([\d_]+)\)/))){
    const n=+m[2];t.tier='silver';t.cat='SCORE';t.prog=p=>[bestN(p,m[1]),n];
  }else if(/hasWon|campaign_complete|world_clear|stage_clear|contract_clear/.test(src)){t.tier='silver';t.cat='CHAMPION'}
  else if(/gamesWithPlays/.test(src)){t.tier='silver';t.cat='EXPLORER'}
  else if(/hasPlayed/.test(src)){t.tier='bronze';t.cat='COLLECTOR'}
  else if(/hasGameAchievement/.test(src)){t.tier='silver';t.cat='COLLECTOR'}
  if(t.id==='first_coin'||t.id==='first_win')t.tier='bronze';
  if(PLAT.has(t.id))t.tier='platinum';else if(GOLD.has(t.id))t.tier='gold';
  if(/^mafia_/.test(t.id))t.cat='COLLECTOR';
}
function progress(t,a,p){
  try{
    if(!t.prog)return null;
    const r=t.progA?t.prog(a):t.prog(p,a);
    if(!r)return null;return[Math.min(r[0]||0,r[1]),r[1]];
  }catch(e){return null}
}
const xpOf=t=>(TIERS[t.tier]||TIERS.bronze).xp;
function totalXp(p){
  const r=rw(p);let x=r.xp||0;
  R.defs.forEach(t=>{if(p.trophies&&p.trophies[t.id])x+=xpOf(t)});
  return x;
}

/* ---------- celebration UI ---------- */
let popQ=[],popBusy=false;
function chime(tier){
  try{if(localStorage.getItem('rwMute')==='1')return;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    const c=chime.c=chime.c||new AC();if(c.state==='suspended')c.resume();
    const base={bronze:523,silver:587,gold:659,platinum:784}[tier]||523,seq=tier==='platinum'?[0,4,7,12]:tier==='gold'?[0,4,7]:[0,7];
    seq.forEach((s,i)=>{const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+i*.09;o.type='triangle';o.frequency.value=base*Math.pow(2,s/12);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.35);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.4)});
  }catch(e){}
}
function confetti(col){
  const cv=el('canvas','rwt-confetti');cv.width=innerWidth;cv.height=innerHeight;document.body.appendChild(cv);
  const x=cv.getContext('2d'),cols=[col,'#ffe85c','#ff2bd6','#00ffff','#67ff67'],ps=[];
  for(let i=0;i<90;i++)ps.push({x:innerWidth/2+(Math.random()-.5)*160,y:innerHeight*.28,vx:(Math.random()-.5)*11,vy:-Math.random()*9-3,s:4+Math.random()*5,c:cols[i%5],r:Math.random()*6,vr:(Math.random()-.5)*.4});
  let f=0;(function tick(){f++;x.clearRect(0,0,cv.width,cv.height);ps.forEach(q=>{q.vy+=.32;q.x+=q.vx;q.y+=q.vy;q.r+=q.vr;x.save();x.translate(q.x,q.y);x.rotate(q.r);x.fillStyle=q.c;x.fillRect(-q.s/2,-q.s/2,q.s,q.s*.6);x.restore()});
    if(f<110)requestAnimationFrame(tick);else cv.remove()})();
}
function popup(o){popQ.push(o);if(!popBusy)nextPop()}
function nextPop(){
  const o=popQ.shift();if(!o){popBusy=false;return}popBusy=true;
  let host=$('#rwtPop');if(!host){host=el('div');host.id='rwtPop';document.body.appendChild(host)}
  const col=o.col||(TIERS[o.tier]||{}).col||'#ffe85c';
  const d=el('div','rwt-pop '+(o.tier||''),'<div class="rwt-pop-ic" style="--c:'+col+'">'+o.icon+'</div><div class="rwt-pop-tx"><small style="color:'+col+'">'+esc(o.kicker)+'</small><b>'+esc(o.title)+'</b><span>'+esc(o.sub||'')+'</span></div>');
  d.style.setProperty('--c',col);host.appendChild(d);
  requestAnimationFrame(()=>d.classList.add('in'));
  chime(o.tier||'silver');if(o.tier==='gold'||o.tier==='platinum'||o.big)confetti(col);
  d.addEventListener('click',()=>{if(RoomOpen())return;openRoom(o.tab||'trophies')});
  setTimeout(()=>{d.classList.remove('in');d.classList.add('out');setTimeout(()=>{d.remove();nextPop()},350)},o.ms||3300);
}
const RoomOpen=()=>{const m=$('#rwtRoom');return m&&m.classList.contains('open')};

/* ---------- XP / level feedback ---------- */
function addXp(p,n,quiet){
  const r=rw(p),before=levelInfo(totalXp(p)).level;
  r.xp=(r.xp||0)+n;
  const after=levelInfo(totalXp(p)).level;
  if(r.lvlSeen==null)r.lvlSeen=before;
  if(after>r.lvlSeen){if(!quiet)levelUp(p,after);r.lvlSeen=after}
}
function checkLevel(p,quiet){
  const r=rw(p),l=levelInfo(totalXp(p)).level;
  if(r.lvlSeen==null){r.lvlSeen=l;return}
  if(l>r.lvlSeen){if(!quiet)levelUp(p,l);r.lvlSeen=l}
}
function levelUp(p,l){
  const rk=rankOf(l);rw(p).lvlSeen=l;
  popup({icon:'⬆️',kicker:'LEVEL UP',title:'LEVEL '+l+' — '+rk.title,sub:rk.at===l?'NEW RANK UNLOCKED!':'Keep climbing!',col:rk.col,big:true,tab:'overview',tier:'gold',ms:3800});
}

/* ---------- check-in ---------- */
function checkinInfo(p){
  const s=rw(p).streak,t=today();
  if(s.last===t)return{claimed:true,count:s.count,day:((s.count-1)%7+7)%7};
  let will=1,froze=false;
  if(s.last){const gap=diffDays(s.last,t);
    if(gap===1)will=s.count+1;
    else if(gap>1){const missed=gap-1;if(s.freeze>=missed){will=s.count+1;froze=true}}}
  return{claimed:false,will,froze,day:(will-1)%7,count:s.count};
}
function streakNow(p){
  const r=rw(p),s=r.streak;if(!s.last)return 0;
  if(s.last===today())return s.count;
  return diffDays(s.last,today())<=1+(s.freeze||0)?s.count:0;
}
function claimCheckin(){
  const p=R.active();if(!p)return;const r=rw(p),s=r.streak,info=checkinInfo(p);if(info.claimed)return;
  const t=today(),gap=s.last?diffDays(s.last,t):0;
  if(info.froze){s.freeze-=gap-1;r.flags.froze=true}
  if(s.last&&gap>7)r.flags.comeback=true;
  s.count=info.will;s.best=Math.max(s.best||0,s.count);s.last=t;
  const rew=REWARDS[(s.count-1)%7];
  R.cs(p).tokens+=rew.t;
  if(s.count%7===0)s.freeze=Math.min(2,(s.freeze||0)+1);
  r.cnt.checkins=(r.cnt.checkins||0)+1;
  const w=rollWeek(p);w.checkins++;
  addXp(p,rew.x);
  R.evaluate(p,true);R.save();
  popup({icon:rew.chest?'🎁':'🔥',kicker:'DAY '+s.count+' STREAK',title:'+'+R.fmt(rew.t)+' TOKENS  +'+rew.x+' XP',sub:info.froze?'Streak Freeze saved your streak! ❄️':rew.chest?'7-day bonus chest opened!':'Come back tomorrow for more!',col:'#ff8a3d',big:!!rew.chest,tab:'overview'});
  refreshAll();
}

/* ---------- weekly quests ---------- */
function questVal(p,q){const d=qdef(q.k);return Math.min(q.target,d?d.val(rollWeek(p)):0)}
function claimQuest(i){
  const p=R.active();if(!p)return;const r=rw(p),w=rollWeek(p),q=w.quests[i],d=qdef(q.k);
  if(w.claimed[i]||questVal(p,q)<q.target)return;
  w.claimed[i]=true;R.cs(p).tokens+=d.tok;r.cnt.weekly=(r.cnt.weekly||0)+1;addXp(p,d.xp);
  const all=w.quests.every((x,j)=>w.claimed[j]);
  popup({icon:d.icon,kicker:'WEEKLY QUEST COMPLETE',title:d.name,sub:'+'+R.fmt(d.tok)+' tokens  +'+d.xp+' XP',col:'#00ffff',tab:'quests'});
  if(all&&!w.swept){w.swept=true;r.cnt.sweep=(r.cnt.sweep||0)+1;R.cs(p).tokens+=1000;addXp(p,300);
    popup({icon:'🧹',kicker:'FULL SWEEP BONUS',title:'+1,000 TOKENS  +300 XP',sub:'All weekly quests done!',col:'#ffd23f',big:true,tab:'quests',ms:4200})}
  R.evaluate(p,true);R.save();refreshAll();
}

/* ---------- game events ---------- */
function onGame(ev){
  const d=ev.detail,p=R.active();if(!p||!d)return;
  const r=rw(p),w=rollWeek(p),t=today(),now=new Date(),h=now.getHours();
  if(r.pd.day!==t)r.pd={day:t,xp:0,plays:0,fin:0};
  const room=()=>r.pd.xp<60;
  if(d.type==='start'){
    w.plays++;if(!w.uniq.includes(d.gameId))w.uniq.push(d.gameId);
    r.pd.plays++;r.cnt.maxPlayDay=Math.max(r.cnt.maxPlayDay||0,r.pd.plays);
    if(room()){r.pd.xp+=2;r.xp+=2}
    if(h<5)r.flags.night=true;else if(h<8)r.flags.early=true;
    if(now.getDay()===6)r.flags.sat=true;if(now.getDay()===0)r.flags.sun=true;
  }
  if(d.type==='finish'){
    w.finishes++;r.pd.fin++;r.cnt.maxFinishDay=Math.max(r.cnt.maxFinishDay||0,r.pd.fin);
    const v=Number(d.value);if(Number.isFinite(v)&&d.higherBetter!==false)w.points+=Math.max(0,Math.min(5000,v));
    if(d.result==='win'){w.wins++;if(room()){r.pd.xp+=15;r.xp+=15}}
    if(room()){r.pd.xp+=6;r.xp+=6}
    // game of the day
    if(r.gotd.day!==t)r.gotd={day:t,done:false};
    if(!r.gotd.done&&d.gameId===gotdId(p)){
      r.gotd.done=true;r.cnt.gotd=(r.cnt.gotd||0)+1;w.gotd++;R.cs(p).tokens+=150;r.xp+=60;
      setTimeout(()=>popup({icon:'⭐',kicker:'GAME OF THE DAY',title:'+150 TOKENS  +60 XP',sub:nameOf(d.gameId)+' bonus claimed!',col:'#ffe85c',tab:'overview'}),900);
    }
  }
  // daily challenge completions (diff against what we already counted today)
  try{
    const dc=p.dailyChallenges;if(dc&&dc.date===t&&Array.isArray(dc.items)){
      const done=dc.items.filter(c=>c.done).length;r.dayDone=r.dayDone&&r.dayDone.day===t?r.dayDone:{day:t,n:0,perfect:false};
      if(done>r.dayDone.n){w.daily+=done-r.dayDone.n;r.xp+=40*(done-r.dayDone.n);r.dayDone.n=done}
      if(done>=dc.items.length&&!r.dayDone.perfect){r.dayDone.perfect=true;r.cnt.perfect=(r.cnt.perfect||0)+1;r.xp+=100;
        setTimeout(()=>popup({icon:'🎯',kicker:'PERFECT DAY',title:'ALL DAILY CHALLENGES DONE',sub:'+100 XP bonus',col:'#67ff67',tab:'quests'}),1500)}
    }
  }catch(e){}
}
function onAfter(){
  const p=R.active();if(!p)return;
  checkLevel(p);R.save();refreshAll();
}

/* ---------- unlock popups (called from evaluateTrophies) ---------- */
let unlockQuiet=0;
function unlocked(list){
  const p=R.active();if(p){const r=rw(p);list.forEach(t=>{r.recent.unshift({id:t.id,at:Date.now()})});r.recent=r.recent.slice(0,12);r.unseen=(r.unseen||0)+list.length;checkLevel(p)}
  const sorted=list.slice().sort((a,b)=>TIER_ORDER.indexOf(b.tier||'bronze')-TIER_ORDER.indexOf(a.tier||'bronze'));
  sorted.slice(0,3).forEach(t=>{const T=TIERS[t.tier]||TIERS.bronze;
    popup({icon:t.icon,kicker:'🏆 TROPHY UNLOCKED · '+T.name,title:t.name,sub:t.desc+'  (+'+T.xp+' XP)',tier:t.tier,tab:'trophies'})});
  if(sorted.length>3)popup({icon:'🏆',kicker:'MORE TROPHIES',title:'+'+(sorted.length-3)+' more unlocked!',sub:'Open the Trophy Room to see them all.',tier:'silver',tab:'trophies'});
  setTimeout(refreshAll,50);
}

/* ---------- Trophy Room modal ---------- */
let room,curTab='overview',filt={tier:'all',cat:'all',status:'all',q:''};
function buildRoom(){
  room=el('div');room.id='rwtRoom';room.setAttribute('aria-hidden','true');room.setAttribute('role','dialog');room.setAttribute('aria-label','Trophy Room');
  room.innerHTML='<div class="rwt-win"><div class="rwt-top"><h2>🏆 TROPHY ROOM</h2><button type="button" class="rwt-x" aria-label="Close trophy room">×</button></div>'+
    '<div class="rwt-tabs" role="tablist"></div><div class="rwt-body"></div></div>';
  document.body.appendChild(room);
  const tabs=[['overview','🏠 OVERVIEW'],['trophies','🏆 TROPHIES'],['quests','🎯 QUESTS'],['rewards','🎁 REWARDS']];
  const tb=$('.rwt-tabs',room);
  tabs.forEach(([id,l])=>{const b=el('button','rwt-tab',l);b.type='button';b.dataset.tab=id;b.addEventListener('click',()=>{curTab=id;render()});tb.appendChild(b)});
  $('.rwt-x',room).addEventListener('click',closeRoom);
  room.addEventListener('click',e=>{if(e.target===room)closeRoom()});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&RoomOpen())closeRoom()});
  // stash for relocated profile sections
  const stash=el('div','rwt-stash');stash.hidden=true;stash.id='rwtStash';room.appendChild(stash);
}
function openRoom(tab){
  const p=R.active();
  if(!p){R.openOnboarding(true);return}
  if(R.closeProfile)R.closeProfile();
  if(tab)curTab=tab;
  rollWeek(p);R.evaluate(p,false);rw(p).unseen=0;R.save();
  try{R.render()}catch(e){}
  room.classList.add('open');room.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  render();
  if(tab==='rewards'){setTimeout(()=>{const t=$('.rwt-premium .premium-reward',room);if(t)t.scrollIntoView({block:'center',behavior:'smooth'})},120)}
}
function closeRoom(){room.classList.remove('open');room.setAttribute('aria-hidden','true');if(!$('#player.open'))document.body.style.overflow='';refreshAll()}

function render(){
  if(!room)return;
  const p=R.active();if(!p)return;
  $$('.rwt-tab',room).forEach(b=>b.classList.toggle('on',b.dataset.tab===curTab));
  const body=$('.rwt-body',room);
  // park the moved nodes before wiping so their listeners survive
  const stash=$('#rwtStash');$$('.rwt-keep',body).forEach(n=>stash.appendChild(n));
  if(!render.busy&&(curTab==='quests'||curTab==='rewards')){render.busy=true;try{R.render()}catch(e){}render.busy=false}
  body.innerHTML='';
  ({overview:renderOverview,trophies:renderTrophies,quests:renderQuests,rewards:renderRewards})[curTab](body,p);
  body.scrollTop=0;
}
function refreshAll(){
  try{refreshBtn()}catch(e){}try{refreshToday()}catch(e){}try{refreshProfileCard()}catch(e){}
  if(room&&RoomOpen()){const body=$('.rwt-body',room),sy=body.scrollTop;if(!(curTab==='trophies'&&document.activeElement&&document.activeElement.id==='rwtSearch')){render();body.scrollTop=sy}}
}

/* counts */
function counts(p){
  const a=R.agg(p),out={total:R.defs.length,done:0,tiers:{bronze:0,silver:0,gold:0,platinum:0}};
  R.defs.forEach(t=>{if(p.trophies[t.id]){out.done++;out.tiers[t.tier]++}});return out;
}
function profileHead(p){
  const li=levelInfo(totalXp(p)),rk=rankOf(li.level),av=R.avatar(p.avatar),r=rw(p),c=counts(p);
  const pct=Math.round(100*li.into/li.need);
  return '<div class="rwt-hero" style="--rk:'+rk.col+'"><div class="rwt-av">'+esc(av.icon)+'<i>'+li.level+'</i></div><div class="rwt-hero-tx"><b>'+esc(p.name)+'</b><span class="rwt-rank">'+rk.title+'</span>'+
    '<div class="rwt-xp"><i style="width:'+pct+'%"></i></div><small>LEVEL '+li.level+' · '+R.fmt(li.into)+' / '+R.fmt(li.need)+' XP to next</small></div>'+
    '<div class="rwt-hero-st"><div><b>🔥 '+streakNow(p)+'</b><small>DAY STREAK</small></div><div><b>🏆 '+c.done+'/'+c.total+'</b><small>TROPHIES</small></div><div><b>🎟️ '+R.fmt(R.cs(p).tokens)+'</b><small>TOKENS</small></div></div></div>';
}

/* overview */
function renderOverview(body,p){
  const r=rw(p),c=counts(p),ci=checkinInfo(p),g=gotdId(p),w=rollWeek(p);
  let h=profileHead(p);
  h+='<div class="rwt-tiers">'+TIER_ORDER.map(t=>'<span style="--c:'+TIERS[t].col+'"><i></i>'+TIERS[t].name+' <b>'+c.tiers[t]+'</b></span>').join('')+'</div>';
  // showcase
  h+='<h3 class="rwt-h">:: SHOWCASE <small>pin up to 3 unlocked trophies</small></h3><div class="rwt-show">';
  for(let i=0;i<3;i++){const id=r.pinned[i],t=id&&R.defs.find(x=>x.id===id);
    h+=t&&p.trophies[t.id]?'<div class="rwt-sc '+t.tier+'" style="--c:'+TIERS[t.tier].col+'"><span>'+t.icon+'</span><b>'+esc(t.name)+'</b><small>'+TIERS[t.tier].name+'</small></div>':'<div class="rwt-sc empty"><span>＋</span><small>Pin a trophy from the TROPHIES tab</small></div>'}
  h+='</div>';
  // check-in
  h+='<h3 class="rwt-h">:: DAILY CHECK-IN <small>resets in '+hms(untilMidnight())+'</small></h3><div class="rwt-cal">';
  const cur=ci.claimed?ci.day:ci.day;
  REWARDS.forEach((rw_,i)=>{
    const done=ci.claimed?i<=ci.day:i<ci.day,now=!ci.claimed&&i===ci.day;
    h+='<div class="rwt-day'+(done?' done':'')+(now?' now':'')+(rw_.chest?' chest':'')+'"><small>DAY '+(i+1)+'</small><span>'+(done?'✅':rw_.chest?'🎁':'🎟️')+'</span><b>'+rw_.t+'</b><em>+'+rw_.x+'xp</em></div>'});
  h+='</div><div class="rwt-ci"><button type="button" id="rwtClaim" class="rwt-btn big"'+(ci.claimed?' disabled':'')+'>'+(ci.claimed?'✔ CHECKED IN TODAY':'🎁 CLAIM TODAY\'S REWARD')+'</button><span>'+
    '❄️ Streak Freezes: <b>'+(r.streak.freeze||0)+'</b> — a freeze automatically covers one missed day. Earn one every 7 days.'+(ci.froze?' <i>A freeze will be used!</i>':'')+'</span></div>';
  // game of the day
  if(g){const done=r.gotd.day===today()&&r.gotd.done;
    h+='<h3 class="rwt-h">:: GAME OF THE DAY <small>new pick in '+hms(untilMidnight())+'</small></h3><div class="rwt-gotd"><img alt="" src="'+thumbOf(g)+'"><div><b>'+esc(nameOf(g))+'</b><p>Finish a run today for <b>+150 tokens</b> and <b>+60 XP</b>.</p>'+
      (done?'<span class="rwt-ok">✔ BONUS CLAIMED</span>':'<button type="button" class="rwt-btn" data-play="'+esc(g)+'">▶ PLAY NOW</button>')+'</div></div>'}
  // up next
  const a=R.agg(p),near=R.defs.filter(t=>!p.trophies[t.id]&&!t.hidden).map(t=>({t,pr:progress(t,a,p)})).filter(x=>x.pr&&x.pr[0]>0)
    .sort((x,y)=>(y.pr[0]/y.pr[1])-(x.pr[0]/x.pr[1])).slice(0,4);
  if(near.length){h+='<h3 class="rwt-h">:: UP NEXT <small>closest trophies</small></h3><div class="rwt-next">'+near.map(x=>tcard(x.t,p,a,true)).join('')+'</div>'}
  // recent
  const rec=r.recent.map(x=>R.defs.find(t=>t.id===x.id)).filter(Boolean).slice(0,6);
  if(rec.length)h+='<h3 class="rwt-h">:: RECENT UNLOCKS</h3><div class="rwt-recent">'+rec.map(t=>'<span style="--c:'+TIERS[t.tier].col+'" title="'+esc(t.name)+'">'+t.icon+'<b>'+esc(t.name)+'</b></span>').join('')+'</div>';
  body.innerHTML=h;
  const cb=$('#rwtClaim',body);if(cb)cb.addEventListener('click',claimCheckin);
  bindCommon(body);
}

/* trophies */
function tcard(t,p,a,compact){
  const T=TIERS[t.tier]||TIERS.bronze,has=!!p.trophies[t.id],pr=!has?progress(t,a,p):null,pinned=rw(p).pinned.includes(t.id);
  const secret=t.hidden&&!has;
  let h='<div class="rwt-tc '+t.tier+(has?' has':'')+(secret?' secret':'')+'" style="--c:'+T.col+'" data-id="'+esc(t.id)+'">';
  h+='<div class="rwt-tc-ic">'+(secret?'❓':has?t.icon:'🔒')+'</div><div class="rwt-tc-tx"><b>'+(secret?'SECRET TROPHY':esc(t.name))+'</b><small>'+(secret?'Hidden — discovered by playing in unexpected ways.':esc(t.desc))+'</small>';
  if(pr){const pc=Math.round(100*pr[0]/pr[1]);h+='<div class="rwt-bar"><i style="width:'+pc+'%"></i></div><em>'+R.fmt(pr[0])+' / '+R.fmt(pr[1])+' · '+pc+'%</em>'}
  h+='</div><div class="rwt-tc-m"><span class="rwt-pill">'+T.rar+'</span><span class="rwt-xpv">+'+T.xp+' XP</span>';
  if(has&&!compact)h+='<button type="button" class="rwt-pin'+(pinned?' on':'')+'" data-pin="'+esc(t.id)+'" title="Pin to showcase">'+(pinned?'📌':'📍')+'</button>';
  h+='</div></div>';return h;
}
function renderTrophies(body,p){
  const a=R.agg(p),cats=['all',...new Set(R.defs.map(t=>t.cat||'COLLECTOR'))].sort((x,y)=>x==='all'?-1:y==='all'?1:x.localeCompare(y));
  let h=profileHead(p);
  h+='<div class="rwt-filters"><input id="rwtSearch" type="search" placeholder="SEARCH TROPHIES…" value="'+esc(filt.q)+'" aria-label="Search trophies">'+
    '<select id="rwtStatus" aria-label="Status">'+[['all','ALL'],['unlocked','UNLOCKED'],['locked','LOCKED'],['progress','IN PROGRESS']].map(x=>'<option value="'+x[0]+'"'+(filt.status===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select>'+
    '<select id="rwtCat" aria-label="Category">'+cats.map(c=>'<option value="'+c+'"'+(filt.cat===c?' selected':'')+'>'+(c==='all'?'ALL CATEGORIES':c)+'</option>').join('')+'</select></div>';
  h+='<div class="rwt-chips">'+['all',...TIER_ORDER].map(t=>'<button type="button" data-tier="'+t+'" class="'+(filt.tier===t?'on':'')+'"'+(t!=='all'?' style="--c:'+TIERS[t].col+'"':'')+'>'+(t==='all'?'ALL TIERS':TIERS[t].name)+'</button>').join('')+'</div>';
  h+='<div class="rwt-grid" id="rwtGrid"></div>';
  body.innerHTML=h;
  const grid=$('#rwtGrid',body);
  const draw=()=>{
    const q=filt.q.trim().toLowerCase();
    let list=R.defs.filter(t=>{
      const has=!!p.trophies[t.id],pr=!has&&progress(t,a,p);
      if(filt.tier!=='all'&&t.tier!==filt.tier)return false;
      if(filt.cat!=='all'&&(t.cat||'COLLECTOR')!==filt.cat)return false;
      if(filt.status==='unlocked'&&!has)return false;
      if(filt.status==='locked'&&has)return false;
      if(filt.status==='progress'&&!(pr&&pr[0]>0))return false;
      if(q&&!(t.hidden&&!has)&&!(t.name+' '+t.desc).toLowerCase().includes(q))return false;
      if(q&&t.hidden&&!has)return false;
      return true});
    list.sort((x,y)=>{
      const hx=p.trophies[x.id]?1:0,hy=p.trophies[y.id]?1:0;if(filt.status==='all'&&hx!==hy)return hx-hy;
      const px=progress(x,a,p),py=progress(y,a,p),fx=px?px[0]/px[1]:0,fy=py?py[0]/py[1]:0;
      if(!hx&&fx!==fy)return fy-fx;return TIER_ORDER.indexOf(y.tier)-TIER_ORDER.indexOf(x.tier)});
    grid.innerHTML=list.length?list.map(t=>tcard(t,p,a)).join(''):'<p class="rwt-empty">No trophies match — try another filter.</p>';
  };
  draw();
  $('#rwtSearch',body).addEventListener('input',e=>{filt.q=e.target.value;draw()});
  $('#rwtStatus',body).addEventListener('change',e=>{filt.status=e.target.value;draw()});
  $('#rwtCat',body).addEventListener('change',e=>{filt.cat=e.target.value;draw()});
  $$('.rwt-chips button',body).forEach(b=>b.addEventListener('click',()=>{filt.tier=b.dataset.tier;$$('.rwt-chips button',body).forEach(x=>x.classList.toggle('on',x===b));draw()}));
  bindCommon(body);
}

/* quests */
function renderQuests(body,p){
  const w=rollWeek(p);let h=profileHead(p);
  h+='<h3 class="rwt-h">:: WEEKLY QUESTS <small>reset in '+hms(untilMonday())+'</small></h3><div class="rwt-quests">';
  w.quests.forEach((q,i)=>{
    const d=qdef(q.k),v=questVal(p,q),done=v>=q.target,cl=!!w.claimed[i],pc=Math.round(100*v/q.target);
    h+='<div class="rwt-q'+(cl?' claimed':done?' ready':'')+'"><div class="rwt-q-ic">'+(cl?'✅':d.icon)+'</div><div class="rwt-q-tx"><b>'+d.name+'</b><small>'+d.txt(q.target)+'</small><div class="rwt-bar"><i style="width:'+pc+'%"></i></div><em>'+R.fmt(v)+' / '+R.fmt(q.target)+'</em></div>'+
      '<div class="rwt-q-r"><span>+'+R.fmt(d.tok)+' 🎟️</span><span>+'+d.xp+' XP</span>'+(cl?'<b class="rwt-ok">CLAIMED</b>':'<button type="button" class="rwt-btn" data-claim="'+i+'"'+(done?'':' disabled')+'>CLAIM</button>')+'</div></div>'});
  const nclaim=w.quests.filter((q,i)=>w.claimed[i]).length;
  h+='</div><div class="rwt-sweep'+(w.swept?' ok':'')+'">🧹 <b>FULL SWEEP BONUS</b> — claim all 4 quests for <b>+1,000 tokens +300 XP</b> <span>'+nclaim+'/4</span></div>';
  h+='<h3 class="rwt-h">:: DAILY CHALLENGES <small>reset in '+hms(untilMidnight())+'</small></h3><div class="rwt-slot" data-slot="daily"></div>';
  body.innerHTML=h;
  mount('daily',$('[data-slot=daily]',body));
  $$('[data-claim]',body).forEach(b=>b.addEventListener('click',()=>claimQuest(+b.dataset.claim)));
  bindCommon(body);
}
function renderRewards(body,p){
  const li=levelInfo(totalXp(p));
  let h=profileHead(p);
  h+='<h3 class="rwt-h">:: PREMIUM GAME REWARDS <small>earn tokens + trophies to unlock</small></h3><div class="rwt-slot rwt-premium" data-slot="premium"></div>';
  h+='<h3 class="rwt-h">:: RANK LADDER</h3><div class="rwt-ranks">'+RANKS.map(r=>{const on=li.level>=r[0];return '<div class="'+(on?'on':'')+'" style="--c:'+r[2]+'"><span>'+(on?'★':'🔒')+'</span><b>'+r[1]+'</b><small>LEVEL '+r[0]+'</small></div>'}).join('')+'</div>';
  h+='<p class="rwt-note">Level up by unlocking trophies, finishing games, completing quests and checking in. Your rank shows on your profile and in the Trophy Room header.</p>';
  body.innerHTML=h;
  mount('premium',$('[data-slot=premium]',body));
  bindCommon(body);
}
/* relocated profile sections */
const relocated={};
function relocate(){
  const modal=$('#profileModal');if(!modal)return;
  const hs=$$('h3.profile-section-title',modal),find=t=>hs.find(h=>h.textContent.includes(t));
  const hd=find('DAILY RANDOM'),hp=find('PREMIUM GAME'),ht=find('TROPHY CABINET'),hg=find('GAME RECORDS');
  if(!hd||!hp||!ht)return;
  const grab=(from,to)=>{const out=[];let n=from.nextElementSibling;while(n&&n!==to){out.push(n);n=n.nextElementSibling}return out};
  const wrap=(nodes)=>{const d=el('div','rwt-keep');nodes.forEach(n=>d.appendChild(n));return d};
  relocated.daily=wrap(grab(hd,hp));relocated.premium=wrap(grab(hp,ht));
  const grid=$('#trophyGrid');if(grid){const g=el('div','rwt-keep');g.hidden=true;g.appendChild(grid);relocated.grid=g;$('#rwtStash').appendChild(g)}
  hd.remove();hp.remove();ht.remove();
  $('#rwtStash').appendChild(relocated.daily);$('#rwtStash').appendChild(relocated.premium);
  // profile gets a compact trophy-room card instead
  const sum=$('.profile-summary',modal);
  if(sum){const c=el('div','rwt-pcard');c.id='rwtPCard';sum.parentNode.insertBefore(c,sum.nextSibling)}
}
function mount(k,host){const n=relocated[k];if(n&&host){n.hidden=false;host.appendChild(n)}}
function bindCommon(body){
  $$('[data-play]',body).forEach(b=>b.addEventListener('click',()=>{playGame(b.dataset.play)}));
  $$('[data-pin]',body).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();togglePin(b.dataset.pin)}));
  $$('.rwt-next .rwt-tc',body).forEach(c=>c.addEventListener('click',()=>{curTab='trophies';filt={tier:'all',cat:'all',status:'progress',q:''};render()}));
}
function togglePin(id){
  const p=R.active();if(!p)return;const r=rw(p),i=r.pinned.indexOf(id);
  if(i>=0)r.pinned.splice(i,1);else{r.pinned.push(id);if(r.pinned.length>3)r.pinned.shift()}
  R.save();render();refreshProfileCard();
}
function playGame(id){
  const b=$('button.play[data-game="'+id+'"]');if(!b)return;
  closeRoom();setTimeout(()=>b.click(),60);
}

/* ---------- header button ---------- */
let tbtn;
function buildBtn(){
  const pb=$('#profileBtn');if(!pb||!pb.parentNode)return;
  tbtn=el('button','rwt-launch','<span class="rwt-launch-ic">🏆</span><span class="rwt-launch-tx"><b id="rwtLvl">TROPHIES</b><small id="rwtSub">ROOM · QUESTS</small></span><i class="rwt-dot" hidden></i>');
  tbtn.type='button';tbtn.id='rwtBtn';tbtn.setAttribute('aria-label','Open Trophy Room');
  pb.parentNode.insertBefore(tbtn,pb.nextSibling);
  tbtn.addEventListener('click',()=>openRoom());
}
function attention(p){
  const r=rw(p),w=rollWeek(p);
  const ci=checkinInfo(p);if(!ci.claimed)return true;
  if(w.quests.some((q,i)=>!w.claimed[i]&&questVal(p,q)>=q.target))return true;
  return false;
}
function refreshBtn(){
  if(!tbtn)return;const p=R.active();
  const dot=$('.rwt-dot',tbtn);
  if(!p){$('#rwtLvl').textContent='TROPHIES';$('#rwtSub').textContent='JOIN & EARN';dot.hidden=false;return}
  const li=levelInfo(totalXp(p)),rk=rankOf(li.level);
  $('#rwtLvl').textContent='LV '+li.level+' · '+rk.title;$('#rwtSub').textContent=attention(p)?'REWARDS READY!':'ROOM · QUESTS';
  tbtn.style.setProperty('--rk',rk.col);dot.hidden=!attention(p)&&!(rw(p).unseen>0);
  tbtn.classList.toggle('hot',attention(p));
}

/* ---------- front-page "Today" strip ---------- */
function buildToday(){
  const host=$('#rwRails');if(!host||!host.parentNode)return;
  const d=el('section','rwt-today');d.id='rwtToday';d.setAttribute('aria-label','Daily rewards');
  host.parentNode.insertBefore(d,host);
}
function refreshToday(){
  const d=$('#rwtToday');if(!d)return;const p=R.active();
  if(!p){d.innerHTML='<div class="rwt-t-main"><span class="rwt-t-ic">🏆</span><div><b>Earn trophies, level up &amp; collect daily rewards</b><small>Free local profile — no email, no password. Streaks, weekly quests and a Game of the Day.</small></div></div><button type="button" class="rwt-btn big" id="rwtJoin">CREATE FREE PROFILE</button>';
    $('#rwtJoin',d).addEventListener('click',()=>R.openOnboarding(true));return}
  const r=rw(p),w=rollWeek(p),ci=checkinInfo(p),g=gotdId(p),li=levelInfo(totalXp(p)),rk=rankOf(li.level);
  const streak=streakNow(p);
  const q=w.quests.filter((x,i)=>w.claimed[i]).length,gdone=r.gotd.day===today()&&r.gotd.done;
  d.innerHTML='<div class="rwt-t-card"><span class="rwt-t-ic">🔥</span><div><b>'+streak+'-DAY STREAK</b><small>'+(ci.claimed?'Checked in ✔ · back in '+hms(untilMidnight()):'Check in for +'+REWARDS[ci.day].t+' tokens')+'</small></div>'+(ci.claimed?'':'<button type="button" class="rwt-btn" id="rwtT1">CLAIM</button>')+'</div>'+
    (g?'<div class="rwt-t-card"><img alt="" src="'+thumbOf(g)+'"><div><b>GAME OF THE DAY</b><small>'+esc(nameOf(g))+(gdone?' · bonus claimed ✔':' · +150 🎟️')+'</small></div>'+(gdone?'':'<button type="button" class="rwt-btn" id="rwtT2">PLAY</button>')+'</div>':'')+
    '<div class="rwt-t-card"><span class="rwt-t-ic">🎯</span><div><b>WEEKLY QUESTS '+q+'/4</b><small>Resets in '+hms(untilMonday())+'</small></div><button type="button" class="rwt-btn ghost" id="rwtT3">VIEW</button></div>'+
    '<div class="rwt-t-card lvl" style="--rk:'+rk.col+'"><span class="rwt-t-ic">⬆️</span><div><b>LEVEL '+li.level+' · '+rk.title+'</b><small>'+R.fmt(li.need-li.into)+' XP to next level</small></div><button type="button" class="rwt-btn ghost" id="rwtT4">TROPHY ROOM</button></div>';
  const on=(id,f)=>{const b=$(id,d);if(b)b.addEventListener('click',f)};
  on('#rwtT1',claimCheckin);on('#rwtT2',()=>playGame(g));on('#rwtT3',()=>openRoom('quests'));on('#rwtT4',()=>openRoom('overview'));
}

/* ---------- profile modal: small trophy card ---------- */
function refreshProfileCard(){
  const c=$('#rwtPCard');if(!c)return;const p=R.active();if(!p)return;
  const li=levelInfo(totalXp(p)),rk=rankOf(li.level),r=rw(p),cn=counts(p);
  const pins=r.pinned.map(id=>R.defs.find(t=>t.id===id)).filter(t=>t&&p.trophies[t.id]);
  c.innerHTML='<div class="rwt-pc-l" style="--rk:'+rk.col+'"><b>LV '+li.level+'</b><span>'+rk.title+'</span></div><div class="rwt-pc-m"><div class="rwt-xp"><i style="width:'+Math.round(100*li.into/li.need)+'%"></i></div><small>'+cn.done+'/'+cn.total+' trophies · '+R.fmt(R.cs(p).tokens)+' tokens'+
    (pins.length?' · '+pins.map(t=>t.icon).join(' '):'')+'</small></div><button type="button" class="rwt-btn" id="rwtPOpen">🏆 OPEN TROPHY ROOM</button>';
  $('#rwtPOpen',c).addEventListener('click',()=>openRoom('overview'));
}

/* ---------- init ---------- */
function init(){
  // tier/category metadata for existing trophies
  R.defs.forEach(classify);
  // add new trophies once
  NEW_DEFS.forEach(n=>{if(!R.defs.some(t=>t.id===n.id))R.defs.push(n)});
  window.RWP_UI={unlocked,openRoom,closeRoom};
  buildRoom();relocate();buildBtn();buildToday();
  window.addEventListener('rw-game-event',onGame);window.addEventListener('rw-after-event',onAfter);
  const p=R.active();
  if(p){
    const r=rw(p);rollWeek(p);
    const fresh=r.lvlSeen==null;
    R.evaluate(p,!fresh);   // pick up the new trophies; celebrate them for returning players
    checkLevel(p,true);R.save();
  }
  refreshAll();
  // keep countdowns / buttons fresh; react to profile switches
  setInterval(()=>{if(document.hidden)return;const q=R.active();if(q){rollWeek(q)}refreshBtn();refreshToday();if(RoomOpen()&&curTab==='overview')render()},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAll()});
  let lastName=null,lastId=null;const mo=$('#profileHeaderName');if(mo)new MutationObserver(()=>{const q=R.active(),nm=q?q.name+'|'+q.id:'';if(nm===lastName)return;const first=lastName===null;lastName=nm;if(first)return;if(q){rollWeek(q);R.evaluate(q,false);checkLevel(q,true)}refreshAll()}).observe(mo,{childList:true,characterData:true,subtree:true});
  // first visit after the profile exists: nudge the check-in
  if(p&&!checkinInfo(p).claimed)setTimeout(()=>RoomOpen()||popup({icon:'🎁',kicker:'DAILY REWARD READY',title:'Check in to keep your streak',sub:'Tap to open the Trophy Room',col:'#ff8a3d',tab:'overview',ms:4200}),2200);
}
window.addEventListener('rw-bridge-ready',boot);
if(window.RWP)boot();else window.addEventListener('load',()=>setTimeout(boot,0));
})();
