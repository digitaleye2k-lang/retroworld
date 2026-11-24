// STICK OPS: BLACKOUT — entry point
import { GAME_W, GAME_H, GRAVITY } from './config.js';
import { BootScene, MenuScene } from './scenes/MenuScene.js';
import { MissionSelectScene, SettingsScene, ArmoryScene, ControlsScene, BriefingScene, PauseScene, FailScene, ResultScene, CreditsScene } from './scenes/Screens.js';
import { HUDScene } from './scenes/HUDScene.js';
import { Mission1 } from './missions/Mission1.js';
import { Mission2 } from './missions/Mission2.js';
import { HeliGunnerScene } from './missions/HeliGunner.js';
import { SniperScene } from './missions/Sniper.js';
import { Mission3 } from './missions/Mission3.js';
import { Mission4 } from './missions/Mission4.js';
import { Mission5 } from './missions/Mission5.js';
import { Mission6 } from './missions/Mission6.js';
import { Mission7 } from './missions/Mission7.js';
import { AudioEngine } from './core/AudioEngine.js';
import { Music } from './core/Music.js';

// browsers only allow audio after a user gesture: unlock on the first input of any kind
AudioEngine.preload();
const unlock = () => { AudioEngine.resume(); Music.tryPending(); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

function boot() {
  const config = {
    type: Phaser.WEBGL,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#030507',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY }, debug: false } },
    audio: { noAudio: true },
    render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
    input: { mouse: { preventDefaultWheel: true } },
    fps: { target: 60, forceSetTimeOut: /forcetimer/.test(window.location.search) },
    scene: [BootScene, MenuScene, MissionSelectScene, SettingsScene, ArmoryScene, ControlsScene, BriefingScene,
      Mission1, Mission2, HeliGunnerScene, SniperScene, Mission3, Mission4, Mission5, Mission6, Mission7, HUDScene, PauseScene, FailScene, ResultScene, CreditsScene],
  };
  const game = new Phaser.Game(config);
  window.__game = game;
  // dev only: ?autoshot=name@ms,name2@ms posts canvas snapshots to dev/serve.py (for headless visual checks)
  const shots = /autoshot=([^&]+)/.exec(window.location.search);
  if (shots) for (const spec of decodeURIComponent(shots[1]).split(',')) {
    const [name, ms] = spec.split('@');
    setTimeout(() => game.renderer.snapshot((img) => fetch('/shot/' + name, { method: 'POST', body: img.src })), +ms || 8000);
  }
}

// wait for webfonts (with timeout) so canvas text renders in the right typeface
const fontsReady = document.fonts && document.fonts.load
  ? Promise.race([
    Promise.all([document.fonts.load('40px "Black Ops One"'), document.fonts.load('700 20px Rajdhani')]),
    new Promise((r) => setTimeout(r, 2500)),
  ])
  : Promise.resolve();
fontsReady.catch(() => {}).then(boot);
