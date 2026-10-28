/* RETRO WORLD pad bridge: any gamepad plays any game. Sticks/D-pad -> arrow keys (+WASD for games that use it),
   A Space (+Enter tap), B/X/Y -> X/Z/C, L1/R1 -> Q/E, Start -> P. RIGHT STICK = virtual mouse, R2 / R3 / L3 = click.
   Select+Start (exit game) is left to the TV/console handler. Games with native gamepad support are not double-driven. */
(function(){'use strict';
const NATIVE=new Set(["alien-siege.html", "astro-breaker.html", "block-drop.html", "bomb-blaster.html", "bug-blaster.html", "castle-cannon.html", "castle-climb.html", "catapult-crash.html", "comet-catcher.html", "cyber-maze.html", "dungeon-dash.html", "fishing-quest.html", "frog-hop.html", "galactic-golf.html", "galaxy-defender.html", "ghost-patrol.html", "hellbyte-93.html", "hover-bike.html", "jewel-matrix.html", "key-quest.html", "laser-arena.html", "marble-spiral.html", "mech-titan.html", "memory-matrix.html", "meteor-dodge.html", "metro-brawler.html", "minefield-86.html", "missile-guard.html", "moon-lander.html", "nebula-wing.html", "neon-pinball.html", "neon-pod-rush.html", "neon-ranger.html", "neon-snake.html", "ninja-tower.html", "paddle-clash.html", "pearl-diver.html", "pixel-golf.html", "pixel-racer.html", "pixel-solitaire.html", "reactor-core.html", "retro-pong.html", "river-escape.html", "road-blaster-99.html", "robot-runner.html", "shadow-duel.html", "sky-flapper.html", "sky-raid-92.html", "space-courier.html", "space-dock.html", "spider-stack.html", "star-miner.html", "sub-hunter.html", "tank-duel.html", "word-tiles-mini.html"]),WASD=new Set(["air-hockey-arena.html", "beat-runner.html", "blackjack-royale.html", "box-pusher.html", "bubble-pop.html", "bullseye-archery.html", "centre-court-tennis.html", "checkers-club.html", "color-flood.html", "connect-four-clash.html", "dart-master.html", "grid-guardians.html", "hoops-showdown.html", "jungle-gunship.html", "lights-out.html", "lonely-universe.html", "neon-clicker.html", "neon-ludo-rally.html", "neon-snakes-ladders.html", "neon-survivors.html", "neon-whack.html", "number-slide.html", "pellet-chase.html", "penalty-keeper.html", "pipe-panic.html", "pixel-chess.html", "raptor-run.html", "reversi-reborn.html", "rock-blaster.html", "sandblade-1990.html", "sky-hop.html", "sky-hunter.html", "slice-frenzy.html", "snooker-club.html", "strike-zone-bowling.html", "tower-stack.html", "turbo-table-tennis.html", "type-rush.html", "word-grid.html"]);
const POINTER=new Set(['air-hockey-arena','blackjack-royale','box-pusher','bullseye-archery','checkers-club','color-flood','connect-four-clash','dart-master','hoops-showdown','lights-out','neon-clicker','neon-ludo-rally','neon-snakes-ladders','neon-whack','number-slide','pipe-panic','reversi-reborn','slice-frenzy','snooker-club','tower-stack','word-grid','neon-sudoku','echo-pad','blackjack-royale','pixel-solitaire','memory-matrix','minefield-86','neon-connect'].map(n=>n+'.html'));
const OVR={'echo-pad.html':{0:'k1',1:'k2',2:'k3',3:'k4'},'sandblade-1990.html':{0:'j',1:'z',2:'k',3:'x'},'ring-king.html':{0:'z',1:'x',2:'z',3:'x'},'strike-zone-bowling.html':{0:'sp',1:'x',2:'z',3:'c'}};
const K={k1:{key:'1',code:'Digit1',kc:49},k2:{key:'2',code:'Digit2',kc:50},k3:{key:'3',code:'Digit3',kc:51},k4:{key:'4',code:'Digit4',kc:52},j:{key:'j',code:'KeyJ',kc:74},k:{key:'k',code:'KeyK',kc:75},bs:{key:'Backspace',code:'Backspace',kc:8},up:{key:'ArrowUp',code:'ArrowUp',kc:38},dn:{key:'ArrowDown',code:'ArrowDown',kc:40},lf:{key:'ArrowLeft',code:'ArrowLeft',kc:37},rt:{key:'ArrowRight',code:'ArrowRight',kc:39},
 w:{key:'w',code:'KeyW',kc:87},s:{key:'s',code:'KeyS',kc:83},a:{key:'a',code:'KeyA',kc:65},d:{key:'d',code:'KeyD',kc:68},
 sp:{key:' ',code:'Space',kc:32},en:{key:'Enter',code:'Enter',kc:13},x:{key:'x',code:'KeyX',kc:88},z:{key:'z',code:'KeyZ',kc:90},c:{key:'c',code:'KeyC',kc:67},q:{key:'q',code:'KeyQ',kc:81},e:{key:'e',code:'KeyE',kc:69},p:{key:'p',code:'KeyP',kc:80},sh:{key:'Shift',code:'ShiftLeft',kc:16}};
const held=new Map();let cx=-1,cy=-1,lastMove=0,cur=null,prevBtn=[],prevClick=false,prevT=0;
function frame(){const f=document.getElementById('gameframe');return f&&document.body.classList.contains('game-active')?f:null}
function win(f){try{const w=f.contentWindow;return w&&w.document?w:null}catch(e){return null}}
function name(f){try{return(f.src||'').split('/').pop().split('?')[0]}catch(e){return''}}
function key(w,type,k,rep){try{const d=w.document,t=d.activeElement&&d.activeElement!==d.body?d.activeElement:d.body;const e=new w.KeyboardEvent(type,{key:k.key,code:k.code,bubbles:true,cancelable:true,repeat:!!rep});Object.defineProperty(e,'keyCode',{get:()=>k.kc});Object.defineProperty(e,'which',{get:()=>k.kc});t.dispatchEvent(e)}catch(e){}}
function press(w,id,now){if(!held.has(id)){held.set(id,{t:now,r:0});key(w,'keydown',K[id],false)}}
function repeatDir(w,id,now){const h=held.get(id);if(!h)return;if(now-h.t>380&&now-h.r>110){h.r=now;key(w,'keydown',K[id],true)}}
function release(w,id){if(held.has(id)){held.delete(id);if(w)key(w,'keyup',K[id])}}
function releaseAll(w){[...held.keys()].forEach(id=>release(w,id))}
function mk(){if(cur)return cur;cur=document.createElement('div');cur.id='rwPadCursor';cur.style.cssText='position:fixed;z-index:2147483000;width:22px;height:22px;margin:-3px 0 0 -3px;pointer-events:none;display:none;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#00e5ff;box-shadow:0 0 14px #00e5ff,0 0 0 2px #000';document.body.appendChild(cur);return cur}
function mouse(w,f,type,x,y,down){try{const r=f.getBoundingClientRect(),ix=x-r.left,iy=y-r.top,d=w.document,t=d.elementFromPoint(ix,iy)||d.body;
 const o={bubbles:true,cancelable:true,clientX:ix,clientY:iy,screenX:x,screenY:y,button:0,buttons:down?1:0,view:w};
 if(w.PointerEvent){t.dispatchEvent(new w.PointerEvent(type.replace('mouse','pointer'),Object.assign({pointerId:1,pointerType:'mouse',isPrimary:true},o)))}
 t.dispatchEvent(new w.MouseEvent(type,o));return t}catch(e){}}
let hinted='';let hintEl=null;
function hint(nm,native,ptr){if(hinted===nm)return;hinted=nm;if(!hintEl){hintEl=document.createElement('div');hintEl.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483001;background:#0b0f1ef2;border:2px solid #00e5ff;color:#fff;font:700 13px "Courier New",monospace;padding:10px 16px;border-radius:12px;box-shadow:0 0 24px #00e5ff66;pointer-events:none;transition:opacity .5s;max-width:92vw;text-align:center';document.body.appendChild(hintEl)}
 hintEl.textContent=native?'🎮 THIS GAME HAS BUILT-IN CONTROLLER SUPPORT':ptr?'🎮 LEFT STICK / D-PAD = CURSOR  •  A = CLICK  •  SELECT+START = EXIT':'🎮 D-PAD/STICK = MOVE  •  A = ACTION  •  RIGHT STICK = CURSOR  •  SELECT+START = EXIT';hintEl.style.opacity=1;clearTimeout(hintEl._t);hintEl._t=setTimeout(()=>hintEl.style.opacity=0,4200)}
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-prevT)/1000||0);prevT=now;
 const f=frame();const gp=navigator.getGamepads&&[...navigator.getGamepads()].find(Boolean);
 if(!f||!gp){if(held.size)releaseAll(f&&win(f));if(cur)cur.style.display='none';prevBtn=[];return}
 const w=win(f);if(!w)return;const B=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed),ax=i=>gp.axes[i]||0;
 const nm=name(f),native=NATIVE.has(nm),wasd=WASD.has(nm),sel=B(8),ptr=POINTER.has(nm);hint(nm,native,ptr);
 if(ptr){[...held.keys()].forEach(id=>release(w,id));const o=OVR[nm];if(o)[0,1,2,3].forEach(b=>{if(o[b]){if(B(b)&&!prevBtn[b])key(w,'keydown',K[o[b]]),key(w,'keyup',K[o[b]])}});if(B(1)&&!prevBtn[1]&&!OVR[nm])key(w,'keydown',K.bs),key(w,'keyup',K.bs)}
 else if(!native){const o=OVR[nm]||{};
  const dirs=[['up',B(12)||ax(1)<-.5,'w'],['dn',B(13)||ax(1)>.5,'s'],['lf',B(14)||ax(0)<-.5,'a'],['rt',B(15)||ax(0)>.5,'d']];
  dirs.forEach(([id,on,wid])=>{if(on){press(w,id,now);repeatDir(w,id,now);if(wasd){press(w,wid,now);repeatDir(w,wid,now)}}else{release(w,id);release(w,wid)}});
  [[0,o[0]||'sp'],[1,o[1]||'x'],[2,o[2]||'z'],[3,o[3]||'c'],[4,'q'],[5,'e'],[6,'sh']].forEach(([b,id])=>{if(B(b))press(w,id,now);else release(w,id)});
  if(B(0)&&!prevBtn[0]){key(w,'keydown',K.en);key(w,'keyup',K.en)}
  if(B(9)&&!sel)press(w,'p',now);else release(w,'p');
 }
 let rx=ax(2),ry=ax(3);if(ptr){rx+=(B(15)?1:0)-(B(14)?1:0)+(Math.abs(ax(0))>.2?ax(0):0);ry+=(B(13)?1:0)-(B(12)?1:0)+(Math.abs(ax(1))>.2?ax(1):0)}const m=Math.hypot(rx,ry),fr=f.getBoundingClientRect();
 if(cx<0||cx<fr.left||cx>fr.right||cy<fr.top||cy>fr.bottom){cx=fr.left+fr.width/2;cy=fr.top+fr.height/2}
 const click=B(7)||B(11)||B(10)||(ptr&&B(0));
 if(m>.25){const sp=(m>.9?900:520)*dt,nx=m>1?rx/m:rx,ny=m>1?ry/m:ry;cx=Math.min(fr.right-2,Math.max(fr.left+2,cx+nx*sp));cy=Math.min(fr.bottom-2,Math.max(fr.top+2,cy+ny*sp));lastMove=now;mouse(w,f,'mousemove',cx,cy,click)}
 const c=mk();if(now-lastMove<3500||click||ptr){c.style.display='block';c.style.left=cx+'px';c.style.top=cy+'px'}else c.style.display='none';
 if(click&&!prevClick)mouse(w,f,'mousedown',cx,cy,true);
 if(!click&&prevClick){const t=mouse(w,f,'mouseup',cx,cy,false);try{if(t)t.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,clientX:cx-fr.left,clientY:cy-fr.top,view:w}))}catch(e){}}
 prevBtn=gp.buttons.map(b=>!!b.pressed);prevClick=click}
requestAnimationFrame(loop);
new MutationObserver(()=>{if(!document.body.classList.contains('game-active')){hinted='';releaseAll(null);if(cur)cur.style.display='none';cx=-1}}).observe(document.body,{attributes:true,attributeFilter:['class']});
window.RWPadBridge={native:NATIVE};
})();
