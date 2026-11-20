# RETRO WORLD shared 3D model library

Low-poly retro models for future 3D games.

## nature/  (Retro Nature Pack by ElegantCrow)
glTF binary (`.glb`) trees, bushes and grass in summer and `_winter` variants; 128-256px textures in `nature/textures/` (seasonal variants: spring, summer, fall, winter).
The .glb files carry geometry + UVs only: apply the matching texture yourself. A few winter files use a different packing; load them with three.js GLTFLoader.

## psx-cars/  (PSX Style Cars by GGBot, ggbot.itch.io)
Eight PS1-style cars as `.obj` + `.mtl` with colour variants (`car_blue.png`, `car_snow*.png` and so on), plus a wheel and a blob shadow.
Matching car sounds (engine loop, start, stop, horn, doors, hood, trunk, parking brake) are in `assets/sfx/car_*.mp3`.

## Not included
The Classic 64 Asset Pack also ships Blender (`.blend`) models; those need exporting from Blender before a browser can load them. Its textures are all in `assets/textures/classic64/`.
