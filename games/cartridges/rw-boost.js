/* RETRO WORLD game boost v1.5 - shared by every cartridge.
   Adds: pause (P), mute (M), CRT effect (C), fullscreen (F), local BEST score.
   Must load FIRST in <head> so timers/audio can be wrapped before the game starts. */
(function(){
  if(window.__rwBoost)return;window.__rwBoost=1;
  var file=(location.pathname.split('/').pop()||'game').replace(/\.html$/,'');
  var NOKEYS=/word-tiles/.test(file);
  var LS={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

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
  var muted=LS.get('retroWorldMute')==='1',masters=[],medias=[];
  try{
    var _con=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(dest){
      if(typeof AudioDestinationNode!=='undefined'&&dest instanceof AudioDestinationNode){
        var ctx=this.context,m=ctx.__rwMaster;
        if(!m){m=ctx.__rwMaster=ctx.createGain();m.gain.value=muted?0:1;_con.call(m,ctx.destination);masters.push(m)}
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
  function crtOn(){var s=LS.get('retroWorldCRT');return s===null?(window.innerWidth>700):s==='1'}
  function fs(){
    var d=document,e=d.documentElement;
    try{if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}else{(e.requestFullscreen||e.webkitRequestFullscreen).call(e)}}catch(x){}
  }
  function build(){
    css();
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
    _si.call(window,tick,400);
  }
  function tick(){
    if(paused)return;
    var sc=gscore();
    if(sc!==undefined&&sc>=0&&(isPlaying()||gstate()==='won'||gstate()==='over'||gstate()==='gameover')){
      if(sc>best){best=sc;LS.set('rwBest:'+file,String(best))}
    }
    if(best>0&&gscore()!==undefined){bestEl.style.display='block';bestEl.innerHTML='BEST<b>'+best+'</b>'}
  }

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
  window.RWBOOST={fit:function(v){fitOn=v!==false;if(fitOn)fit();else{var w=document.querySelector('.wrap');if(w){w.style.removeProperty('width');w.style.removeProperty('max-width')}}},pause:setPause,mute:setMute,isPaused:function(){return paused}};
})();
