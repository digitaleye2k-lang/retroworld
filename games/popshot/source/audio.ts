export type Sound='splat'|'grenade'|'explosion'|'rifle'|'enemy'|'shotgun'|'hit'|'pop'|'jump'|'double'|'slide'|'launch'|'land'|'step'|'reload'|'ready'|'swap'|'hurt'|'respawn'|'start'|'finish';
/** Original synthesized arcade audio. No downloaded samples or autoplay dependency. */
export class ArcadeAudio{
 context:AudioContext;master:GainNode;effects:GainNode;music:GainNode;noise:AudioBuffer;muted=false;musicEnabled=true;effectsLevel=.8;musicLevel=.28;nextBeat=0;beat=0;
 constructor(context:AudioContext){
  this.context=context;this.master=context.createGain();this.effects=context.createGain();this.music=context.createGain();const compressor=context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.ratio.value=5;this.effects.connect(this.master);this.music.connect(this.master);this.master.connect(compressor);compressor.connect(context.destination);
  this.noise=context.createBuffer(1,context.sampleRate,context.sampleRate);const data=this.noise.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=(last+.08*white)/1.08;data[i]=last*3.5;}this.update();
 }
 update(){const t=this.context.currentTime;this.master.gain.setTargetAtTime(this.muted?0:.85,t,.02);this.effects.gain.setTargetAtTime(this.effectsLevel,t,.02);this.music.gain.setTargetAtTime(this.musicEnabled?this.musicLevel:0,t,.05);}
 tone(freq:number,end:number,duration:number,volume:number,type:OscillatorType='sine',at=this.context.currentTime,bus=this.effects){const o=this.context.createOscillator(),g=this.context.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);g.gain.setValueAtTime(.001,at);g.gain.linearRampToValueAtTime(volume,at+.004);g.gain.exponentialRampToValueAtTime(.001,at+duration);o.connect(g).connect(bus);o.start(at);o.stop(at+duration+.01);}
 hiss(duration:number,volume:number,frequency:number,at=this.context.currentTime){const s=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),g=this.context.createGain();s.buffer=this.noise;filter.type='highpass';filter.frequency.value=frequency;g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.001,at+duration);s.connect(filter).connect(g).connect(this.effects);s.start(at,Math.random()*.3);s.stop(at+duration);}
 play(sound:Sound){if(this.context.state!=='running')return;const t=this.context.currentTime;
  switch(sound){
   case 'splat':this.tone(540,120,.12,.28,'sine');this.hiss(.10,.36,700);this.tone(960,320,.07,.13,'triangle');break;
   case 'grenade':this.tone(350,680,.16,.24,'triangle');this.hiss(.14,.25,1500);break;
   case 'explosion':this.hiss(.52,.9,250);this.tone(125,28,.5,.72,'sine');[72,79,84].forEach((n,i)=>this.tone(this.note(n),this.note(n),.23,.18,'triangle',t+.07*i));break;
   case 'rifle':this.hiss(.09,.6,1200);this.tone(180,45,.12,.45,'triangle');this.tone(720,270,.055,.14,'square');break;
   case 'enemy':this.hiss(.08,.22,1100);this.tone(150,45,.1,.16,'triangle');break;
   case 'shotgun':this.hiss(.24,1.05,300);this.tone(90,28,.3,.85,'sine');this.tone(170,55,.13,.22,'sawtooth');break;
   case 'hit':this.tone(1300,850,.08,.24,'triangle');this.hiss(.045,.16,2400);break;
   case 'pop':[72,76,79,84].forEach((n,i)=>this.tone(this.note(n),this.note(n),.25,.28,'square',t+i*.085));this.hiss(.2,.22,1600);break;
   case 'jump':this.tone(230,680,.17,.26,'triangle');this.hiss(.12,.2,1800);break;
   case 'double':this.tone(480,1250,.22,.27,'sine');this.tone(720,1850,.18,.14,'triangle',t+.04);break;
   case 'slide':this.hiss(.42,.48,850);this.tone(150,65,.3,.16,'triangle');break;
   case 'launch':this.tone(130,1600,.5,.33,'triangle');this.hiss(.32,.32,1700);break;
   case 'land':this.tone(100,30,.12,.3);this.hiss(.08,.28,250);break;
   case 'step':this.tone(95,35,.055,.13);this.hiss(.045,.11,700);break;
   case 'reload':this.hiss(.08,.3,1600);this.tone(260,140,.1,.17,'square');this.hiss(.07,.23,2400,t+.28);break;
   case 'ready':this.tone(600,800,.065,.2,'square');this.hiss(.05,.22,2500);break;
   case 'swap':this.hiss(.12,.25,1800);this.tone(440,700,.1,.18,'triangle');break;
   case 'hurt':this.tone(180,70,.13,.26,'sawtooth');break;
   case 'respawn':case 'start':[60,64,67,72].forEach((n,i)=>this.tone(this.note(n),this.note(n),.3,.24,'triangle',t+i*.1));break;
   case 'finish':[67,72,76,79,84].forEach((n,i)=>this.tone(this.note(n),this.note(n),.4,.25,'triangle',t+i*.14));break;
  }
 }
 note(midi:number){return 440*Math.pow(2,(midi-69)/12);}
 tick(playing:boolean){if(!playing||!this.musicEnabled||this.context.state!=='running'){this.nextBeat=0;return;}const t=this.context.currentTime;if(!this.nextBeat||this.nextBeat<t-.3)this.nextBeat=t+.03;const eighth=60/126/2;
  while(this.nextBeat<t+.12){const step=this.beat%32,bar=Math.floor(step/8),root=[50,55,59,57][bar],melody=[74,78,81,78,83,81,78,76,79,83,86,83,81,79,78,76,83,86,90,86,83,81,78,81,81,85,88,85,83,81,78,76][step];
   if(step%4===0)this.tone(140,35,.17,.7,'sine',this.nextBeat,this.music);
   if(step%8===4){this.tone(220,110,.09,.24,'triangle',this.nextBeat,this.music);this.musicNoise(this.nextBeat,.12,.28);}
   this.musicNoise(this.nextBeat,.035,.10);if(step%2===0)this.tone(this.note(root),this.note(root),.22,.19,'triangle',this.nextBeat,this.music);
   this.tone(this.note(melody),this.note(melody),.17,.11,'triangle',this.nextBeat,this.music);if(step%4===0)[root+12,root+16,root+19].forEach(n=>this.tone(this.note(n),this.note(n),.36,.045,'sine',this.nextBeat,this.music));
   this.nextBeat+=eighth;this.beat++;
  }
 }
 musicNoise(at:number,duration:number,volume:number){const s=this.context.createBufferSource(),f=this.context.createBiquadFilter(),g=this.context.createGain();s.buffer=this.noise;f.type='highpass';f.frequency.value=4500;g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.001,at+duration);s.connect(f).connect(g).connect(this.music);s.start(at);s.stop(at+duration);}
 dispose(){this.master.disconnect();this.effects.disconnect();this.music.disconnect();}
}
