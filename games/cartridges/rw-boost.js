/* RETRO WORLD game boost v1.5 - shared by every cartridge.
   Adds: pause (P), mute (M), CRT effect (C), fullscreen (F), local BEST score.
   Must load FIRST in <head> so timers/audio can be wrapped before the game starts. */
(function(){
  if(window.__rwBoost)return;window.__rwBoost=1;
  var file=(location.pathname.split('/').pop()||'game').replace(/\.html$/,'');
  var NOKEYS=/word-tiles|type-rush/.test(file);
  var LS={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};


  /* ---------- art pass: bevelled blocks + glossy circles drawn automatically on every canvas ---------- */
  var artOn=LS.get('rwArt')!=='0';
  try{
    var CP=CanvasRenderingContext2D.prototype,_fr=CP.fillRect,_arcF=CP.arc,_fillF=CP.fill,_bpF=CP.beginPath,pc={},nArc=0,lArc=null;
    var parseC=function(c){if(typeof c!=='string')return null;var v=pc[c];if(v!==undefined)return v;var m;
      if(m=/^#([0-9a-f]{6})$/i.exec(c))v=[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];
      else if(m=/^#([0-9a-f]{3})$/i.exec(c)){var h=m[1];v=[17*parseInt(h[0],16),17*parseInt(h[1],16),17*parseInt(h[2],16)]}
      else if(m=/^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(c))v=[+m[1],+m[2],+m[3]];else v=null;
      if(Object.keys(pc).length<400)pc[c]=v;return v};
    CP.fillRect=function(x,y,w,h){
      _fr.call(this,x,y,w,h);
      if(!artOn||w<5||h<5||w>64||h>64||this.globalAlpha<.9||(this.canvas&&this.canvas.id==='rwfx2'))return;
      var f=this.fillStyle,c=parseC(f);if(!c||c[0]*.3+c[1]*.59+c[2]*.11<65)return;
      var tt=Math.max(1,Math.min(3,Math.round(Math.min(w,h)/6)));
      this.fillStyle='rgba(255,255,255,.26)';_fr.call(this,x,y,w,tt);_fr.call(this,x,y+tt,tt,h-tt);
      this.fillStyle='rgba(0,0,0,.28)';_fr.call(this,x,y+h-tt,w,tt);_fr.call(this,x+w-tt,y,tt,h-tt);
      this.fillStyle=f;
    };
    CP.beginPath=function(){nArc=0;lArc=null;return _bpF.call(this)};
    CP.arc=function(x,y,r,a0,a1){nArc++;lArc=[x,y,r,a0,a1,arguments[5]];return _arcF.apply(this,arguments)};
    CP.fill=function(){
      _fillF.apply(this,arguments);
      if(!artOn||nArc!==1||!lArc||(arguments.length&&typeof arguments[0]==='object')||(this.canvas&&this.canvas.id==='rwfx2'))return;
      var r=lArc[2];if(!(r>=4&&r<=40)||Math.abs(lArc[4]-lArc[3])<6)return;
      var f=this.fillStyle,c=parseC(f);if(!c||c[0]*.3+c[1]*.59+c[2]*.11<75||this.globalAlpha<.9)return;
      var la=lArc;this.fillStyle='rgba(255,255,255,.36)';_bpF.call(this);this.ellipse(la[0]-r*.3,la[1]-r*.36,r*.34,r*.2,-.6,0,6.283);_fillF.call(this);
      this.fillStyle=f;_bpF.call(this);_arcF.call(this,la[0],la[1],la[2],la[3],la[4],la[5]);   // restore the circle path for a following stroke()
    };
  }catch(e){}

  /* ---------- pause-safe clocks and timers ---------- */
  var paused=false,p0=0,d0=0,off=0;
  var _pn=performance.now.bind(performance),_dn=Date.now;
  performance.now=function(){return (paused?p0:_pn())-off};
  Date.now=function(){return (paused?d0:_dn())-off};
  var _si=window.setInterval,_st=window.setTimeout,_raf=window.requestAnimationFrame;
  window.setInterval=function(f,t){
    if(typeof f!=='function')return _si.apply(window,arguments);
    var a=[].slice.call(arguments,2);
    return _si.call(window,function(){if(!paused)f.apply(this,a)},t);
  };
  window.setTimeout=function(f,t){
    if(typeof f!=='function')return _st.apply(window,arguments);
    var a=[].slice.call(arguments,2);
    function w(){if(paused){_st(w,120)}else f.apply(this,a)}
    return _st.call(window,w,t);
  };
  window.requestAnimationFrame=function(cb){
    return _raf.call(window,function(t){if(paused){window.requestAnimationFrame(cb)}else cb(t-off)});
  };

  /* ---------- master audio gain (mute) ---------- */
  var audioUsed=false,inBlip=false,stats={blips:0,celebrations:0};
  var muted=LS.get('retroWorldMute')==='1',masters=[],medias=[];

  /* ---------- audio polish: soft waveforms + filter + compressor + light reverb for every game ---------- */
  function impulse(ctx){var len=Math.floor(ctx.sampleRate*1.0),bf=ctx.createBuffer(2,len,ctx.sampleRate);for(var ch=0;ch<2;ch++){var d=bf.getChannelData(ch);for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}return bf}
  function buildChain(ctx,m,con){
    try{
      var lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=7000;lp.Q.value=.6;
      var warm=ctx.createBiquadFilter();warm.type='lowshelf';warm.frequency.value=220;warm.gain.value=3;
      var comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=18;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.18;
      var out=ctx.createGain();out.gain.value=1.35;
      var conv=ctx.createConvolver();conv.buffer=impulse(ctx);var wet=ctx.createGain();wet.gain.value=.17;
      con.call(m,warm);con.call(warm,lp);con.call(lp,comp);con.call(lp,conv);con.call(conv,wet);con.call(wet,comp);con.call(comp,out);con.call(out,ctx.destination);
    }catch(e){con.call(m,ctx.destination)}
  }
  try{
    var _co=BaseAudioContext.prototype.createOscillator,tdesc=Object.getOwnPropertyDescriptor(OscillatorNode.prototype,'type');
    var wave=function(ctx,v){var k='__rwW'+v;if(ctx[k])return ctx[k];var n=24,re=new Float32Array(n),im=new Float32Array(n);for(var i=1;i<n;i++)im[i]=v==='square'?((i%2)?1/Math.pow(i,1.35):0):1/Math.pow(i,1.7);return ctx[k]=ctx.createPeriodicWave(re,im)};
    BaseAudioContext.prototype.createOscillator=function(){
      var o=_co.call(this),ctx=this;
      Object.defineProperty(o,'type',{configurable:true,get:function(){return tdesc.get.call(o)},set:function(v){if(v==='square'||v==='sawtooth'){try{o.setPeriodicWave(wave(ctx,v));return}catch(e){}}tdesc.set.call(o,v)}});
      return o;
    };
  }catch(e){}

  try{
    var _con=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(dest){
      if(typeof AudioDestinationNode!=='undefined'&&dest instanceof AudioDestinationNode){
        if(!inBlip)audioUsed=true;
        var ctx=this.context,m=ctx.__rwMaster;
        if(!m){m=ctx.__rwMaster=ctx.createGain();m.gain.value=muted?0:1;buildChain(ctx,m,_con);masters.push(m)}
        dest=m;
      }
      return _con.apply(this,[dest].concat([].slice.call(arguments,1)));
    };
  }catch(e){}
  try{
    var _A=window.Audio;
    window.Audio=function(){var a=new (Function.prototype.bind.apply(_A,[null].concat([].slice.call(arguments))))();a.muted=muted;medias.push(a);return a};
    window.Audio.prototype=_A.prototype;
  }catch(e){}
  function applyMute(){
    masters.forEach(function(m){try{m.gain.value=muted?0:1}catch(e){}});
    medias.forEach(function(a){a.muted=muted});
    [].forEach.call(document.querySelectorAll('audio,video'),function(a){a.muted=muted});
  }

  /* ---------- read score / state of the host game ---------- */
  function rd(x){try{return (0,eval)(x)}catch(e){return undefined}}
  function gstate(){var s=rd('typeof state!=="undefined"?state:undefined');return typeof s==='string'?s.toLowerCase():undefined}
  function gscore(){
    var s=rd('typeof score==="number"?score:(typeof sc==="number"?sc:undefined)');
    return (typeof s==='number'&&isFinite(s))?Math.round(s):undefined;
  }
  function isPlaying(){var s=gstate();return s==='play'||s==='playing'||s==='running'}

  /* ---------- UI ---------- */
  var root,btnP,btnM,btnC,btnF,crt,best=parseInt(LS.get('rwBest:'+file)||'0',10)||0,bestEl,shade;
  function css(){
    var s=document.createElement('style');
    s.textContent=
    '#rwbx{position:fixed;right:4px;top:50%;transform:translateY(-50%);z-index:2147483600;display:flex;flex-direction:column;gap:5px;align-items:center;opacity:.42;transition:opacity .2s;font:700 9px "Courier New",monospace;color:#9fe}'+
    '#rwbx:hover,#rwbx:focus-within{opacity:1}'+
    '#rwbx button{width:30px;height:30px;padding:0;display:grid;place-items:center;cursor:pointer;font:700 13px "Courier New",monospace;color:#4deaff;background:#050714e6;border:1px solid #4deaff;border-radius:2px}'+
    '#rwbx button:hover{background:#4deaff;color:#050714}#rwbx button[aria-pressed="true"]{border-color:#ff2bd6;color:#ff2bd6}'+
    '#rwbest{text-align:center;line-height:1.15;color:#ffe35b;text-shadow:1px 1px #000}#rwbest b{display:block;font-size:10px;color:#fff}'+
    '#rwcrt{position:fixed;inset:0;z-index:2147483000;pointer-events:none;display:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.42) 100%)}'+
    '#rwshade{position:fixed;inset:0;z-index:2147483500;display:none;place-items:center;background:rgba(3,5,12,.78);color:#4deaff;font:900 clamp(22px,6vw,40px) "Courier New",monospace;letter-spacing:6px;text-align:center;cursor:pointer}'+
    '#rwshade small{display:block;margin-top:14px;font-size:clamp(10px,2.4vw,14px);letter-spacing:2px;color:#ffe35b}'+
    '#rwtoast{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:2147483550;background:#050714ee;border:1px solid #ff2bd6;color:#fff;padding:7px 12px;font:700 11px "Courier New",monospace;letter-spacing:1px;display:none;white-space:nowrap}'+
    '@media(max-width:560px){#rwbx{top:auto;bottom:6px;right:4px;transform:none;flex-direction:row;opacity:.55}#rwbest{margin-right:4px}#rwtoast{display:none!important}}'+
    '@media print{#rwbx,#rwcrt{display:none}}';
    document.head.appendChild(s);

    var s2=document.createElement('style');
    s2.textContent=
    'html,body{background:radial-gradient(1200px 620px at 50% -12%,#17255a 0%,#0a0f26 52%,#04050f 100%)!important}'+
    '.frame{border-radius:16px!important;border:1px solid rgba(77,234,255,.5)!important;background:#03040c!important;overflow:hidden;box-shadow:0 0 0 1px rgba(255,43,214,.14),0 22px 60px -12px rgba(0,0,0,.85),0 0 44px -8px rgba(77,234,255,.38)!important}'+
    '.frame canvas{border-radius:12px}'+
    'canvas:not(#rwfx2){filter:url(#rwsharp) saturate(1.12) contrast(1.05)}.rw-nosharp canvas:not(#rwfx2){filter:saturate(1.1) contrast(1.04)!important}'+
    '.top .title,.title{text-shadow:0 0 18px rgba(77,234,255,.55)!important;letter-spacing:2px}'+
    '.top select,.diff select,select{border-radius:8px!important;background:#0c1130!important;border:1px solid #2f3fa0!important;color:#dff!important}'+
    '.help{opacity:.78;letter-spacing:.5px}'+
    '.touch-btn{border-radius:18px!important;background:linear-gradient(160deg,rgba(77,234,255,.24),rgba(18,26,80,.6))!important;border:1px solid rgba(77,234,255,.6)!important;backdrop-filter:blur(6px);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 8px 18px -8px #000!important}'+
    '.touch-btn.action{background:linear-gradient(160deg,rgba(255,43,214,.3),rgba(60,12,70,.62))!important;border-color:rgba(255,43,214,.7)!important}'+
    '.touch-btn:active{transform:scale(.94);filter:brightness(1.3)}';
    document.head.appendChild(s2);
    if(LS.get('rwNoSharp')==='1')document.documentElement.classList.add('rw-nosharp');
  }
  function mk(txt,label,fn){var b=document.createElement('button');b.type='button';b.textContent=txt;b.setAttribute('aria-label',label);b.title=label;b.addEventListener('click',function(e){e.stopPropagation();fn();b.blur()});return b}
  function toast(t){var el=document.getElementById('rwtoast');if(!el)return;el.textContent=t;el.style.display='block';clearTimeout(toast.t);toast.t=_st(function(){el.style.display='none'},3200)}
  function setPause(v){
    if(v===paused)return;
    if(v){p0=_pn();d0=_dn();paused=true}else{off+=_pn()-p0;paused=false}
    if(shade)shade.style.display=paused?'grid':'none';
    if(btnP){btnP.textContent=paused?'\u25B6':'\u275A\u275A';btnP.setAttribute('aria-pressed',paused)}
    try{if(!paused&&window.focus)window.focus()}catch(e){}
  }
  function setMute(v){muted=v;LS.set('retroWorldMute',v?'1':'0');applyMute();if(btnM){btnM.textContent=muted?'\u2715':'\u266B';btnM.setAttribute('aria-pressed',muted)}}
  function setCRT(v){LS.set('retroWorldCRT',v?'1':'0');if(crt)crt.style.display=v?'block':'none';if(btnC)btnC.setAttribute('aria-pressed',v)}
  function crtOn(){var s=LS.get('retroWorldCRT');return s==='1'}
  function fs(){
    var d=document,e=d.documentElement;
    try{if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}else{(e.requestFullscreen||e.webkitRequestFullscreen).call(e)}}catch(x){}
  }
  function build(){
    css();

    var sv=document.createElementNS('http://www.w3.org/2000/svg','svg');sv.setAttribute('width','0');sv.setAttribute('height','0');sv.style.cssText='position:absolute;pointer-events:none';
    sv.innerHTML='<filter id="rwsharp" color-interpolation-filters="sRGB"><feConvolveMatrix order="3" kernelMatrix="0 -.45 0 -.45 2.8 -.45 0 -.45 0" preserveAlpha="true"/></filter>';document.body.appendChild(sv);
    root=document.createElement('div');root.id='rwbx';root.setAttribute('role','toolbar');root.setAttribute('aria-label','Game tools');
    bestEl=document.createElement('div');bestEl.id='rwbest';bestEl.style.display='none';
    btnP=mk('\u275A\u275A','Pause (P)',function(){setPause(!paused)});
    btnM=mk(muted?'\u2715':'\u266B','Mute (M)',function(){setMute(!muted)});
    btnC=mk('\u25A4','CRT effect (C)',function(){setCRT(crt.style.display!=='block')});
    root.appendChild(bestEl);root.appendChild(btnP);root.appendChild(btnM);root.appendChild(btnC);
    if(document.fullscreenEnabled||document.webkitFullscreenEnabled){btnF=mk('\u26F6','Fullscreen (F)',fs);root.appendChild(btnF)}
    crt=document.createElement('div');crt.id='rwcrt';
    shade=document.createElement('div');shade.id='rwshade';shade.innerHTML='<div>PAUSED<small>PRESS P OR CLICK TO RESUME</small></div>';
    shade.addEventListener('click',function(){setPause(false)});
    var t=document.createElement('div');t.id='rwtoast';
    document.body.appendChild(crt);document.body.appendChild(shade);document.body.appendChild(t);document.body.appendChild(root);
    btnM.setAttribute('aria-pressed',muted);
    setCRT(crtOn());applyMute();
    var shown=false;
    function hint(){if(shown||NOKEYS)return;shown=true;try{if(sessionStorage.getItem('rwHint'))return;sessionStorage.setItem('rwHint','1')}catch(e){}toast('P PAUSE \u2022 M MUTE \u2022 C CRT \u2022 F FULLSCREEN')}
    addEventListener('pointerdown',function(){_st(hint,1200)},{once:true});
    addEventListener('keydown',function(){_st(hint,1200)},{once:true});
    _si.call(window,tick,400);_si.call(window,watch,200);
  }
  function tick(){
    if(paused)return;
    var sc=gscore();
    if(sc!==undefined&&sc>=0&&(isPlaying()||gstate()==='won'||gstate()==='over'||gstate()==='gameover')){
      if(sc>best){best=sc;LS.set('rwBest:'+file,String(best))}
    }
    if(best>0&&gscore()!==undefined){bestEl.style.display='block';bestEl.innerHTML='BEST<b>'+best+'</b>'}
  }


  /* ---------- click sound for silent games (board games etc.) ---------- */
  var bctx=null;
  function blip(f){
    if(muted||audioUsed||rd('typeof sfx')==='function')return;
    try{
      inBlip=true;bctx=bctx||new (window.AudioContext||window.webkitAudioContext)();
      var o=bctx.createOscillator(),g=bctx.createGain();o.type='square';o.frequency.value=f||420;
      g.gain.value=.05;g.gain.exponentialRampToValueAtTime(.0001,bctx.currentTime+.09);
      o.connect(g);g.connect(bctx.destination);o.start();o.stop(bctx.currentTime+.1);stats.blips++;
    }catch(e){}finally{inBlip=false}
  }
  addEventListener('pointerdown',function(e){if(e.target&&e.target.tagName==='CANVAS'&&!paused)blip(380+Math.random()*160)},true);
  /* ---------- celebration: confetti + vibration on a new best score or a win ---------- */
  function confetti(){
    try{
      var cv=document.createElement('canvas');cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:2147483200;pointer-events:none';
      cv.width=innerWidth;cv.height=innerHeight;document.body.appendChild(cv);var c=cv.getContext('2d'),ps=[],cols=['#4deaff','#ff2bd6','#ffe35b','#73ff89','#ff5a79'];
      for(var i=0;i<140;i++)ps.push({x:cv.width/2+(Math.random()-.5)*160,y:cv.height*.45,vx:(Math.random()-.5)*14,vy:-Math.random()*13-3,s:4+Math.random()*5,c:cols[i%5],r:Math.random()*6});
      var t0=_pn();
      (function f(){var t=_pn()-t0;c.clearRect(0,0,cv.width,cv.height);
        ps.forEach(function(q){q.vy+=.35;q.x+=q.vx;q.y+=q.vy;q.r+=.2;c.save();c.translate(q.x,q.y);c.rotate(q.r);c.fillStyle=q.c;c.globalAlpha=Math.max(0,1-t/1900);c.fillRect(-q.s/2,-q.s/4,q.s,q.s/2);c.restore()});
        if(t<1900)window.requestAnimationFrame(f);else cv.remove()})();
    }catch(e){}
  }
  function celebrate(msg){stats.celebrations++;toast(msg);confetti();try{fanfare()}catch(e){}try{navigator.vibrate&&navigator.vibrate([60,40,90])}catch(e){}}
  var prevSt=null,runBest=0,startBest=best;
  function watch(){
    if(paused)return;var st=gstate(),sc=gscore();
    if(st===undefined)return;
    var playing=(st==='play'||st==='playing'||st==='running'),ended=(st==='won'||st==='over'||st==='gameover'||st==='win'||st==='lose');
    if(playing){if(prevSt!==null&&!(prevSt==='play'||prevSt==='playing'||prevSt==='running')){startBest=best;runBest=0}if(sc!==undefined&&sc>runBest)runBest=sc}
    if(ended&&prevSt!==st&&(prevSt==='play'||prevSt==='playing'||prevSt==='running')){
      if(sc!==undefined&&runBest>0&&runBest>startBest&&startBest>0)celebrate('NEW BEST! '+runBest);
      else if(st==='won'||st==='win')celebrate('YOU WIN!');
    }
    prevSt=st;
  }


  /* ---------- special effects layer (all games) + driving effects ---------- */
  var BLOOM=/neon-pod-rush|neon-pinball|marble-spiral|river-escape|hover-bike|pixel-racer|road-blaster-99/.test(file),bcv=null;
  var DRIVE=/hover-bike|neon-pod-rush|pixel-racer|road-blaster-99/.test(file);
  var perfN=0,perfS=0;var fxc,fxx,parts=[],pops=[],streaks=[],shk=0,flash=0,flashCol='255,60,90',pScore=null,pLives=null,maxSpd=1,pScroll=null,fxT=0,sCheck=0,spdN=.5,elapsed=0;
  function bigCanvas(){var l=[].slice.call(document.querySelectorAll('canvas')).filter(function(c){return c.id!=='rwfx2'});return l.sort(function(a,b){return b.width*b.height-a.width*a.height})[0]}
  function burst(px,py,n,cols,sp,up){for(var i=0;i<n;i++){var a=Math.random()*6.283,v=sp*(.35+Math.random());parts.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(up||0),l:1,c:cols[i%cols.length],s:2+Math.random()*3})}}
  function fxInit(){fxc=document.createElement('canvas');fxc.id='rwfx2';fxc.style.cssText='position:fixed;pointer-events:none;z-index:2147483100';document.body.appendChild(fxc);fxx=fxc.getContext('2d');fxT=_pn();window.requestAnimationFrame(fxFrame)}
  function fxRead(){
    var now=_pn();if(now-sCheck<90)return;var dts=(now-sCheck)/1000;sCheck=now;
    var sc=gscore(),lv=rd('typeof lives==="number"?lives:undefined'),st=gstate(),r=fxc.width,h=fxc.height;
    if(typeof sc==='number'&&pScore!==null&&sc>pScore&&(st===undefined||st==='play'||st==='playing')){
      var d=sc-pScore;burst(r*.5,h*.14,Math.min(26,6+Math.round(Math.log(d+1)*4)),['#ffe35b','#4deaff','#ff2bd6'],160,40);
      pops.push({x:r*.5,y:h*.17,t:0,v:'+'+d,big:d>=100});if(d>=100)sparkle();if(d>=250){shk=Math.min(7,shk+3);flash=.18;flashCol='255,226,91'}
    }
    if(typeof sc==='number')pScore=sc;
    if(typeof lv==='number'&&pLives!==null&&lv<pLives){shk=11;flash=.45;flashCol='255,60,90';burst(r*.5,h*.78,40,['#ff8a2a','#ffe35b','#ff4b64'],260,60);explode();try{navigator.vibrate&&navigator.vibrate(120)}catch(e){}}
    if(typeof lv==='number')pLives=lv;
    if(DRIVE){var raw=rd('typeof speed==="number"?speed:undefined'),sr=rd('typeof scroll==="number"?scroll:undefined');
      if(typeof raw==='number'){raw=Math.abs(raw)}else if(typeof sr==='number'){raw=pScroll===null?0:Math.abs(sr-pScroll)/Math.max(.02,dts);pScroll=sr}else raw=undefined;
      if(raw!==undefined){maxSpd=Math.max(maxSpd,raw,1);spdN=Math.min(1,raw/maxSpd)}else{elapsed+=dts;spdN=.55+.35*Math.min(1,elapsed/50)}
      if(st!=='play'&&st!=='playing')spdN=.15}
  }

  function sOut(){var C=window.AudioContext||window.webkitAudioContext;if(!C||muted)return null;return bctx||(bctx=new C())}
  function explode(){try{var cx=sOut();if(!cx)return;inBlip=true;var now=cx.currentTime,n=Math.floor(cx.sampleRate*.55),bf=cx.createBuffer(1,n,cx.sampleRate),d=bf.getChannelData(0);
    for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
    var s=cx.createBufferSource();s.buffer=bf;var f=cx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(2600,now);f.frequency.exponentialRampToValueAtTime(110,now+.5);
    var g=cx.createGain();g.gain.value=.26;s.connect(f);f.connect(g);g.connect(cx.destination);s.start(now);
    var o=cx.createOscillator(),g2=cx.createGain();o.type='sine';o.frequency.setValueAtTime(150,now);o.frequency.exponentialRampToValueAtTime(38,now+.4);g2.gain.setValueAtTime(.3,now);g2.gain.exponentialRampToValueAtTime(.0001,now+.45);o.connect(g2);g2.connect(cx.destination);o.start(now);o.stop(now+.5)}catch(e){}finally{inBlip=false}}
  var lastSp=0;
  function chime(notes,step,vol){try{var cx=sOut();if(!cx)return;inBlip=true;var now=cx.currentTime;notes.forEach(function(fq,i){var o=cx.createOscillator(),g=cx.createGain(),st=now+i*step;o.type='triangle';o.frequency.setValueAtTime(fq,st);g.gain.setValueAtTime(.0001,st);g.gain.exponentialRampToValueAtTime(vol,st+.01);g.gain.exponentialRampToValueAtTime(.0001,st+.28);o.connect(g);g.connect(cx.destination);o.start(st);o.stop(st+.3)})}catch(e){}finally{inBlip=false}}
  function sparkle(){var n=_pn();if(n-lastSp<380)return;lastSp=n;chime([1046,1318,1568,2093],.05,.05)}
  function fanfare(){chime([523,659,784,1047,784,1047,1319],.085,.07)}
  function beep2(){try{(window.sfx&&0)||0;var C=window.AudioContext||window.webkitAudioContext;if(!C||muted)return;var cx=bctx||(bctx=new C());inBlip=true;var o=cx.createOscillator(),g=cx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(220,cx.currentTime);o.frequency.exponentialRampToValueAtTime(50,cx.currentTime+.3);g.gain.setValueAtTime(.06,cx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,cx.currentTime+.3);o.connect(g);g.connect(cx.destination);o.start();o.stop(cx.currentTime+.32)}catch(e){}finally{inBlip=false}}
  function fxFrame(){
    var cv=bigCanvas();window.requestAnimationFrame(fxFrame);if(!cv||!fxx)return;
    var r=cv.getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);
    if(fxc.width!==w||fxc.height!==h){fxc.width=w;fxc.height=h}var S=fxc.style;S.setProperty('left',r.left+'px','important');S.setProperty('top',r.top+'px','important');S.setProperty('width',w+'px','important');S.setProperty('height',h+'px','important');S.setProperty('max-width','none','important');S.setProperty('max-height','none','important');S.setProperty('aspect-ratio','auto','important');S.setProperty('margin','0','important');S.setProperty('border-radius','12px','important');
    fxRead();var now=_pn(),raw=(now-fxT)/1000,dt=Math.min(.05,raw);fxT=now;perfN++;perfS+=Math.min(raw,.2);if(perfN===150&&perfS/150>.034){document.documentElement.classList.add('rw-nosharp');LS.set('rwNoSharp','1');artOn=false}fxx.clearRect(0,0,w,h);
    if(BLOOM&&artOn){if(!bcv){bcv=document.createElement('canvas')}var bw=Math.max(32,Math.round(w/6)),bh=Math.max(24,Math.round(h/6));if(bcv.width!==bw||bcv.height!==bh){bcv.width=bw;bcv.height=bh}var bx=bcv.getContext('2d');bx.clearRect(0,0,bw,bh);bx.drawImage(cv,0,0,bw,bh);fxx.save();fxx.globalCompositeOperation='lighter';fxx.globalAlpha=.42;fxx.imageSmoothingEnabled=true;fxx.drawImage(bcv,0,0,w,h);fxx.restore()}

    var fr=document.querySelector('.frame');if(fr){if(shk>.4){fr.style.transform='translate('+((Math.random()-.5)*shk).toFixed(1)+'px,'+((Math.random()-.5)*shk).toFixed(1)+'px)';shk*=.88}else if(fr.style.transform){fr.style.transform='';shk=0}}
    fxx.globalCompositeOperation='lighter';
    if(DRIVE){
      var n=(gstate()==='play'||gstate()==='playing')?1:.3;
      if(Math.random()<.9*spdN*n*dt*60){var left=Math.random()<.5;streaks.push({x:(left?.02+Math.random()*.2:.78+Math.random()*.2)*w,y:-30,l:30+Math.random()*80*spdN,v:500+900*spdN,c:Math.random()<.5?'77,234,255':'255,43,214'})}
      streaks.forEach(function(s){s.y+=s.v*dt;var g=fxx.createLinearGradient(0,s.y-s.l,0,s.y);g.addColorStop(0,'rgba('+s.c+',0)');g.addColorStop(1,'rgba('+s.c+','+(.22+.3*spdN)+')');fxx.fillStyle=g;fxx.fillRect(s.x,s.y-s.l,2,s.l)});
      streaks=streaks.filter(function(s){return s.y-s.l<h});
      if(spdN>.7){var a=(spdN-.7)*.9*(.7+.3*Math.sin(now/90)),g1=fxx.createLinearGradient(0,0,w*.22,0);g1.addColorStop(0,'rgba(77,234,255,'+a+')');g1.addColorStop(1,'rgba(77,234,255,0)');fxx.fillStyle=g1;fxx.fillRect(0,0,w*.22,h);var g2=fxx.createLinearGradient(w,0,w*.78,0);g2.addColorStop(0,'rgba(255,43,214,'+a+')');g2.addColorStop(1,'rgba(255,43,214,0)');fxx.fillStyle=g2;fxx.fillRect(w*.78,0,w*.22,h)}
    }
    parts.forEach(function(p){p.vy+=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.l-=dt*1.6;if(p.l>0){fxx.globalAlpha=Math.max(0,p.l);fxx.fillStyle=p.c;fxx.fillRect(p.x,p.y,p.s,p.s)}});fxx.globalAlpha=1;parts=parts.filter(function(p){return p.l>0});
    fxx.globalCompositeOperation='source-over';
    pops.forEach(function(q){q.t+=dt;fxx.globalAlpha=Math.max(0,1-q.t*1.5);fxx.fillStyle=q.big?'#ffe35b':'#ffffff';fxx.font='bold '+(q.big?26:18)+'px Courier New';fxx.textAlign='center';fxx.strokeStyle='#000';fxx.lineWidth=3;fxx.strokeText(q.v,q.x,q.y-q.t*45);fxx.fillText(q.v,q.x,q.y-q.t*45)});fxx.globalAlpha=1;pops=pops.filter(function(q){return q.t<.7});
    if(flash>0){fxx.fillStyle='rgba('+flashCol+','+flash+')';fxx.fillRect(0,0,w,h);flash=Math.max(0,flash-dt*1.4)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){_st(fxInit,50)});else _st(fxInit,50);

  /* ---------- input gating while paused + hotkeys ---------- */
  ['keydown','keypress','pointerdown','mousedown','touchstart','click'].forEach(function(t){
    window.addEventListener(t,function(e){
      if(!paused)return;
      var el=e.target;if(el&&el.closest&&(el.closest('#rwbx')||el.closest('#rwshade')))return;
      if(t==='keydown'&&(e.key==='p'||e.key==='P'||e.key==='Escape'))return;
      e.stopImmediatePropagation();
    },true);
  });
  addEventListener('keydown',function(e){
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    var tg=e.target&&e.target.tagName;if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;
    if(NOKEYS)return;
    var k=(e.key||'').toLowerCase();
    if(k==='p'){setPause(!paused);e.preventDefault()}
    else if(paused)return;
    else if(k==='m'){setMute(!muted)}
    else if(k==='c'){setCRT(crt.style.display!=='block')}
    else if(k==='f'){fs()}
  },true);

  /* ---------- auto-fit: grow the game to fill the screen (keeps aspect ratio) ---------- */
  var fitOn=true,fitT=0;
  function fit(){
    if(!fitOn)return;
    try{
      var wrap=document.querySelector('.wrap'),cvs=[].slice.call(document.querySelectorAll('canvas'));
      if(!wrap||!cvs.length)return;
      var cv=cvs.sort(function(a,b){return b.width*b.height-a.width*a.height})[0];
      wrap.style.removeProperty('width');
      var r1=wrap.getBoundingClientRect(),c1=cv.getBoundingClientRect();
      if(!c1.height||!c1.width)return;
      var ar=c1.width/c1.height,extra=r1.height-c1.height,border=r1.width-c1.width;
      var h=window.innerHeight,w=window.innerWidth;
      var width=Math.min(w*0.985,(h-extra-8)*ar+border);
      width=Math.max(width,Math.min(300,w));
      wrap.style.setProperty('width',Math.floor(width)+'px','important');
      wrap.style.setProperty('max-width','none','important');
      var r2=wrap.getBoundingClientRect();
      if(r2.height>h-2){wrap.style.setProperty('width',Math.floor(width*(h-2)/r2.height)+'px','important')}
    }catch(e){}
  }
  function fitSoon(){clearTimeout(fitT);fitT=_st(fit,60)}
  addEventListener('resize',fitSoon);addEventListener('orientationchange',fitSoon);
  document.addEventListener('fullscreenchange',fitSoon);
  addEventListener('load',function(){fit();_st(fit,300);_st(fit,1200)});
  document.addEventListener('visibilitychange',function(){if(document.hidden&&isPlaying())setPause(true)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
  window.RWBOOST={art:function(v){artOn=!!v;LS.set('rwArt',v?'1':'0')},stats:stats,fxState:function(){return{parts:parts.length,streaks:streaks.length,spd:spdN,drive:DRIVE}},fit:function(v){fitOn=v!==false;if(fitOn)fit();else{var w=document.querySelector('.wrap');if(w){w.style.removeProperty('width');w.style.removeProperty('max-width')}}},pause:setPause,mute:setMute,isPaused:function(){return paused}};
})();
