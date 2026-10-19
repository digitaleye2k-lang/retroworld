# Dust & Iron — Vertical Slice Design

`Dust & Iron` is an original, mouse-led tactical stealth game with a late-1980s DOS adventure-game presentation. It borrows the *feeling* of a tightly staged western heist—small squad, readable sight-lines, deliberate timing—without using the setting, cast, plot, art, or assets of any existing game.

## The demo: “The Silent Ledger”

**Goal:** cross the armed Mesa Junction yard, sabotage the telegraph, take the payroll ledger, and get every surviving hand out through the west gate.

**Map flow:**

1. **West gate approach** — a scrubby southern lane that establishes formation movement and brush hiding.
2. **Paymaster office** — a dense adobe block with cover, hard walls, and a guarded ledger route.
3. **Freight depot and switchyard** — long lanes, railcars, and overlapping rifle sight-lines.
4. **Water tower and cargo shed** — the relay sits in the eastern half of the yard, protected by patrols and an alarm call-out.
5. **West gate** — extraction becomes tense because every surviving hand must regroup at the original exit.

The map uses deliberately placed exterior walls and sight-line blockers, not procedural clutter, so the player can understand why a plan succeeds or fails.

## The crew

| Character | Role | Active ability | Tactical use |
| --- | --- | --- | --- |
| June “Quill” Mercer | Pathfinder | **Coin Toss** | Throw a brief sound lure into a guard’s patrol route. |
| Silas Rook | Long gun | **Cover Shot** | Incapacitate a visible guard at range, but adds alarm. |
| Tomás “Ox” Garza | Strongarm | **Quiet Takedown** | Incapacitate a nearby unalerted guard without raising alarm. |

Each hand has a colored hat, a readable silhouette, a unique speed, health, and a distinct control verb. Those roles support larger maps without changing the basic interface.

## Core loop

1. Start with the whole crew selected, or focus a hand with a portrait or `1–3`; use `Shift` to form a subset.
2. Click a reachable point to route the selected hands there in a loose formation; double-click to run.
3. Press `Space` to freeze time and queue a maneuver. This gives the demo the intended “think, then execute” rhythm.
4. Use `F` to arm the focused weapon or `Q` to arm the selected ability; click the map or a guard to commit it.
5. Select all hands with `A`, shift-select a subset, pan with the arrow keys, press `C` to center on the selected crew, or click the tactical minimap to navigate the expanded yard.
6. Keep out of the gold sight cones. Armed guards use rifles, pistols, or shotguns after spotting the crew; low cover can stop a round.
7. Cut the telegraph, steal the ledger, then reach the west gate with the surviving crew.

## What is implemented in this vertical slice

- Collision-safe formation movement with grid routing around buildings, props, walls, and fences.
- A scrollable yard district with a tactical minimap and eleven authored landmarks.
- Three selectable, animated heroes and nine armed patrols, with a telegraph-triggered reinforcement wave.
- Field-of-view cones that respect walls, cover, and brush; patrols can conceal themselves in authored hiding patches.
- Audio-free readable alert, weapon fire, noise-lure, close takedown, and noisy ranged takedown systems.
- Tactical pause with queued moves, skills, weapon fire, enemy fire, squad health, cover, and hard failure states.
- A three-step objective chain: cut wires, steal ledger, extract.
- Objective pickup, full-squad extraction, failure, reset, keyboard controls, responsive presentation, and entirely self-contained artwork.

## Expansion path

The next production pass would add authored multi-step objectives, inventory objects, alternate disguises, interiors, guard communication, character banter, save slots, and a map editor. The existing entity and command structure is intentionally small enough to grow into those systems.
