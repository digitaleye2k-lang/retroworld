# RETRO WORLD shared sound library

Real recorded sound effects every game can use. Trimmed, normalized mono MP3 (~1 MB total).

## How to use

```html
<script src="../../assets/rw-sfx.js"></script>   <!-- path from games/<game>/ or games/cartridges/ -->
```
```js
RWSFX.use(audioCtx, sfxGainNode);         // optional: share the game's context and volume bus
RWSFX.preload(['gun_rifle','punch1']);    // decode early (call once audio starts)
if (!RWSFX.play('gun_rifle', {vol:.6, vary:.06})) synthFallback();  // false while still loading
RWSFX.play('pump_rack', {vol:.4, at:.3});  // schedule after a delay
// options: vol, rate, vary (random pitch +-), at (seconds), pan (-1..1), gap (min seconds between repeats), dest (AudioNode)
```

Sources: Snake's Authentic Gun Sounds, 400 Sounds Pack, 96 Extra SFX (supplied by the site owner). `gun_shotgun` and `gun_minigun` are layered/pitched from the rifle recordings.

## Guns

`gun_ak`, `gun_auto`, `gun_auto_heavy`, `gun_burst`, `gun_heavy`, `gun_minigun`, `gun_pistol`, `gun_pistol2`, `gun_rifle`, `gun_rifle_tail`, `gun_shotgun`, `gun_sniper`, `gun_spray`, `gun_suppressed`

## Reloads & weapon handling

`ak_rack`, `ar_charge`, `bolt`, `lever`, `mag_in`, `mag_out`, `pistol_rack`, `pump_rack`, `rl_ak`, `rl_ar`, `rl_pump`, `shell_load`, `weapon_drop`, `weapon_equip`, `weapon_pickup`, `weapon_upgrade`

## Melee & impacts

`bone_snap`, `crunch`, `hit_muffled`, `impact_heavy`, `impact_wet`, `kick`, `punch1`, `punch2`, `punch3`, `slap`, `splat`, `swipe`, `sword_clash`, `sword_clash2`, `sword_draw`, `sword_light`, `sword_slice`, `whoosh1`, `whoosh2`

## Footsteps & landings

`land_dirt`, `land_grass`, `step_concrete1`, `step_concrete2`, `step_concrete3`, `step_concrete4`, `step_grass1`, `step_grass2`, `step_grass3`, `step_grass4`, `step_gravel1`, `step_gravel2`, `step_gravel3`, `step_gravel4`, `step_snow1`, `step_snow2`, `step_snow3`, `step_snow4`, `step_wood1`, `step_wood2`, `step_wood3`, `step_wood4`

## Cards, dice & board

`card1`, `card2`, `card3`, `card_fan`, `cardboard_hit`, `chip1`, `chip2`, `chip3`, `chips_gather`, `chips_stack`, `dice_roll1`, `dice_roll2`, `dice_roll3`, `dice_roll4`, `dice_shake`

## Match-3 cascade (pitched 1-10)

`match1`, `match10`, `match2`, `match3`, `match4`, `match5`, `match6`, `match7`, `match8`, `match9`, `match_strike`

## Sports

`applause`, `ball_kick`, `ball_kick2`, `ball_net`, `bat_hit`, `tennis_bounce`

## Pickups

`coin`, `coins`, `gem`, `heart`, `item_equip`

## Environment & objects

`bird`, `bricks`, `chest_open`, `clothing`, `cough`, `crow`, `crows`, `door_break`, `door_close`, `door_creak`, `door_open`, `fire_light`, `glass_ping`, `gulp`, `hydraulic`, `industrial_close`, `industrial_open`, `keys`, `lock_pick`, `lock_unlock`, `map_open`, `metal_clang`, `metal_tap`, `munch`, `page_turn`, `paper`, `pencil`, `shovel`, `splash`, `stone_rumble`, `switch_on`, `water_splash`, `whistle`, `wood_creak`, `wood_drop`, `zipper`
