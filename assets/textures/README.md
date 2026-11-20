# RETRO WORLD shared texture library

Seamless textures every game can use. All packs are **CC0 / public domain** (Screaming Brain Studios, Classic 64 Asset Library by Craig Snedeker). `index.json` lists every texture by set and category.

| Set | Look | Size | Count |
|---|---|---|---|
| `sbs-tiny2` | Bright painted tiles: brick, dirt, elements (lava, ice, water), metal, plaster, stone, tile, wood | 256px jpg | 160 |
| `sbs-tiny3` | Large painted sheets: animal, box, cloth, elements, gem, grating, metal, stone, terrain, weave | 256px jpg (+ `hd/` 512px) | 240 |
| `sbs-horror` | Grimy horror surfaces: brick, floor, metal, misc, stains (alpha), stone, wall | 256px jpg/png (+ `hd/` 512px) | 100 |
| `classic64` | Low-res N64/PSX-era photo textures: ground, wood, walls, roof, concrete, road, doors, windows, signs, food, products, nature sprites and more | 64-256px png | 747 |

## Using them

```js
// Three.js (path from games/<game>/ or games/cartridges/)
const t = new THREE.TextureLoader().load('../../assets/textures/classic64/wood/wood_planks_3.png');
t.wrapS = t.wrapT = THREE.RepeatWrapping;
// Canvas 2D: draw a pattern, or soft-light blend it over flat colours to add real detail but keep the palette
g.globalCompositeOperation = 'soft-light'; g.fillStyle = g.createPattern(img, 'repeat'); g.fillRect(x, y, w, h);
```

Already used in: Breakout '45 (ground, hut walls), Block Rig 3D (terrain detail), Beat Up Mafia (roads, sidewalks, grass, sand, docks), Stickman: Last Stand (ground per mission).

## Categories

**sbs-tiny2**: brick (20), dirt (20), elements (20), metal (20), plaster (20), stone (20), tile (20), wood (20)

**sbs-tiny3**: animal (24), box (24), cloth (24), elements (24), gem (24), grating (24), metal (24), stone (24), terrain (24), weave (24)

**sbs-horror**: brick (14), floor (14), metal (14), misc (15), stains (15), stone (14), wall (14)

**classic64**: art (9), books (15), boxes (11), bricks (22), buildings (14), concrete (32), doors (27), electrical (8), floor (14), food (42), gems (9), ground (89), industrial (24), metal (56), misc (73), nature (28), panels (19), papers (2), products (6), road (6), rocks (31), roof (13), shelves (3), signs (32), tiles (6), tools (3), units (2), vehicles (6), walls (39), water (5), windows (32), wood (69)
