# STICK OPS: BLACKOUT

A cinematic 2D military stickman shooter for desktop browsers, built with **Phaser 3.80**, Arcade Physics and the Web Audio API.
Characters are procedural. Tanks, helicopters, jets and trucks are hand-designed illustrations painted at startup by `src/render/VehicleDraw.js`, modelled on the user's reference sheets (`dev/vehicle_sheets/`); preview them with `dev/vehicles_preview.html`. Weapon audio, ambiences, surface textures and explosion/smoke VFX come from the asset packs in `assets/` (see Credits). If any file fails to load, the game falls back to its procedural versions.

## Run it

Any static file server works. From this folder:

```
python dev/serve.py 8770
```

Then open http://localhost:8770. (A server is required because the game uses ES modules. Opening `index.html` directly from disk will not work.)

## Controls

| Key | Action |
| --- | --- |
| A / D | Move |
| W / Space | Jump (S + Jump drops through catwalks) · jump at or keep pushing into a ledge to climb it |
| W / S on a ladder | Climb up / down |
| Run into low cover | Auto-vault over sandbags & barriers |
| S | Crouch |
| Mouse | Aim · Left click fire · Right click aim down sights |
| Shift | Hold breath while aiming |
| R | Reload |
| 1–4 / wheel | Rifle · Pistol · Shotgun · Sniper (5 = launcher when picked up) |
| Q | Quick-swap last weapon |
| G | Frag grenade |
| F | Melee / silent takedown |
| E | Interact (hold for hacking, charges, mounted guns) |
| Hold Enter / Space | Fast-forward cutscenes (x4) |
| Esc / P | Pause |

## Story

**Act I: BLACKOUT.** Ghost (Echo-6) rescues the informant SPARROW. Squadmate **Rook** covers from overwatch, joins on the ground, and dies in the village of St. Ilya shielding SPARROW. Varkov's comms network and gunship are destroyed. The act ends with a dawn memorial.

**Act II: BLACK SUN.** Varkov's lieutenant, **Colonel Drago**, flees with the backup codes:
4. **IRON DAWN** (tank): command HAMMER-1 through bunkers, AT teams and armour to the MAMMOTH. HAMMER-3 is lost on the way.
5. **SKYFALL** (jet): fly REAPER-1 through fighters, flak and SAMs, then down the VALKYRIE bomber. Ghost is shot down and ejects over Kessel.
6. **DEAD CITY**: a street war with 3rd Battalion, Sgt. Vega and the tank BULLDOG. SPARROW (Mikhail Orlov) dies passing on the final codes.
7. **BLACK SUN**: storm the silo against a launch countdown, defeat Drago, outrun the self-destruct, then an epilogue at Rook's grave with Anna.

## Vehicle missions

- **Tank:** A/D drive · mouse aims turret · LMB fire · RMB coax MG · 1 120mm cannon · 2 guided missile (flies to the cursor) · 3 six-rocket salvo · wrench crates repair and rearm
- **Jet:** mouse steers the nose (point behind you to loop round) · WASD trim · LMB nose guns · RMB lock-on missile (locks what is ahead of the nose) · SPACE flares

## Music

`assets/music/`: *Vanguard Protocol* (menus, briefings, results, credits) and *Shadow Division* (all gameplay), re-encoded from the originals in this folder. The mix follows the action: muffled and quiet while sneaking, full during firefights and bosses, ducked under dialogue. Sad scenes switch to a procedural piano lament.

## Campaign

1. **NIGHTFALL**: night infiltration with flashlight patrols and a searchlight tower. Sabotage the generator, hack the grid (lights die and NVG kicks in), a slow-motion breach, rescue SPARROW, then fight the Juggernaut boss *THE WARDEN*.
2. **EXTRACTION**: a dawn battlefield with allied armour, artillery strikes, enemy helicopters rappelling troops, a collapsing building, an APC fight with the launcher, and an LZ defence. Then a **playable helicopter door-gunner section** with AA guns, RPG teams, technicals and a gunship pair.
3. **BLACKOUT**: a **sniper overwatch** sequence (scope sway, breath control, counter-sniper, bullet-cam), a base assault with a mounted MG, demolition of the comms centre, and the **BLACK WIDOW** attack-helicopter boss (AA guns, homing launcher, flares, three phases).

Includes checkpoints, objectives with on-screen markers, mission results and ranks, intel points for Armory upgrades, settings (volumes, shake, difficulty, subtitles, blood, FPS, fullscreen) and progress saved in localStorage.

## Code layout

```
src/
  main.js            Phaser config & scene list
  config.js          weapons, enemy types, difficulty, missions, upgrades
  core/              AudioEngine (synth SFX + reverb), Music (procedural score), SaveSystem, TextureFactory (procedural art)
  render/            StickFigure: IK skeleton renderer, tactical gear, weapons, verlet ragdolls
  systems/           Combat (swept bullets, rockets, grenades), Effects, Lighting, Level builder
  entities/          Actor, Player, Soldier AI, Boss/Informant, Helicopter/Gunship, Vehicles/MountedGun
  scenes/            BaseMission (shared gameplay), HUD, menus & overlays
  missions/          Mission1, Mission2, HeliGunner, Sniper, Mission3
  ui/                buttons, sliders, toggles, cursor
```

## Developer flags (URL query)

- `?debug=1`: F1 god mode · F2 next checkpoint · F3 kill all hostiles · F4 complete stage
- `?scene=Mission2&cp=2`: jump straight to a scene or checkpoint (Mission1, Mission2, HeliGunner, Sniper, Mission3)
- `?autoshot=name@ms`: save a canvas snapshot to `dev/shots/` via `dev/serve.py` (headless visual checks)
- `?forcetimer=1`: drive the game loop with timers (for testing in a hidden/background tab)

## Assets & credits

`assets/` is generated by `dev/build_assets.py` (needs ffmpeg). It trims, normalises and compresses the source packs in `../Texture assets`, `../Audio Effects`, `explosion pack 1.zip`, `Pixel_Military_Vehicles_2.0.zip` and the Brackeys VFX bundle:

```
python dev/build_assets.py <folder with the unzipped packs: guns/ s400/ s96/ tex/ brackeys/ expl1/ pmv/>
```

- **Gunshots, reloads & bolt cycles:** Snake's Authentic Gun Sounds; shotgun blast & pump: user-provided mp3s
- **Sniper, explosions, impacts, rain/thunder, engine:** Sonniss GDC 2024 Game Audio Bundle (Dramatic Cat, DavidDumais, BluezoneCorp, Bolt)
- **Footsteps, foley & UI:** 400 Sounds Pack, 96 Extra SFX
- **Helicopter flyover, jets, alarm, heavy shot, radio chatter:** user-provided freesound/Pixabay clips (`Audio Effects/`)
- **Surface textures:** SBS Tiny Texture Pack 3
- **Vehicles:** original illustrations drawn in code (`src/render/VehicleDraw.js`), based on the user-provided reference sheets
- **Distant convoys (background layer):** Pixel Military Vehicles 2.0 by de-alpe-game-art
- **Explosion/smoke/muzzle VFX:** Brackeys VFX bundle (CC0: CodeManu, Kenney, Picster); ground/air blast flipbooks: "explosion pack 1"
