# Waterworld 0.9.13: handover

Waterworld is a Minecraft Bedrock add-on: a static, "golden-law" waterworld (Thera and its caldera city, the peoples
round it, a circumnavigation), with a ship module adapted from Shipwright 0.25.0 (`ship/`) running on our own math.

## What's in this folder

| Path | What it is |
|---|---|
| `build/Waterworld-0.9.13.mcaddon` | The full add-on (BP + RP), baked from the source below |
| `build/waterworld-update-0.9.13.zip` | The update pack |
| `shipwright-next-src-0.9.13.zip` | The whole source tree (no `node_modules`, no `dist`; run `npm install` first) |
| `renders/` | The current boat models, drawn from their geometry (fleet, Theran side, top and astern) |
| `viewer-wip/` | Work in progress for the world viewer (see "Next" below) |

## Build, test, check

All commands run from the repo root unless noted.

- **Bake** (about 3.5 minutes): `node tools/buildmod.mjs` writes `dist/Waterworld.mcaddon` and `dist/waterworld-update.zip`.
  - The version lives in two places: `tools/buildmod.mjs` (`VERSION` array) and `mod/scripts/main.js` (`VERSION` string).
- **Tests:**
  - `npm test` (53 pass)
  - `npm run modtest` (lays sample chunks; must report no bad blocks)
  - `npm run ship:test` (the ship module; see "Known failures")
- **Inherency** (house rule): every numeric literal in `core/` and `world/` is tagged `// given:` (Minecraft's or
  history's), `// vision:` (ours), or derived by a law.
  - `node tools/lab.mjs inherency` must stay at 0.
  - The ship module has its own ratchet: `node ship/tools/lab/inherency.mjs` (now 2494, in `ship/tests/inherency.json`). It may fall, never rise.
- **Grown towns** (`lab/grown`): `node tools/bakegrown.mjs --restamp [n]` after editing the closure files (`game/ground.js`, `world/city.js`, `world/forms.js`, `world/building.js`).

## Ship models: how they're made now

Work in `ship/`.

1. Edit `tools/gen_boats.py` (and `tools/sailcloth.py` for the sail cloths).
2. Run `python3 tools/gen_assets.py`.
3. Then restore `RP/models/entity/shield_peg.geo.json`, which `gen_assets` deletes (keep a copy before you run it).
4. Run `python3 tools/gen_icons.py` for the edit-screen icons.

**Never run `tools/gen_entities.py`.** Its template is stale and overwrites the hand-tuned `BP/entities`. To add a boat, copy an analogue's BP entity with `sed` (as the Theran and League ones were).

- **Hulls** are a rounded shell, not boxes.
  - Each section is a quarter superellipse from keel to sheer (`ROUND` per build tradition: a V with its turn rounded, a round bilge, a flat floor with a soft chine).
  - The shell is planked in `STRAKES` slabs. A slab is a cube turned to lie on four corners (`slab()`, `euler_file()`), and slabs that aren't turned are written as plain cubes.
  - The ends run in 8 slices, each slab fitted between the two edge sections, so the hull is smooth from the middle to the tip.
- **Rotation convention.** The game shows file x mirrored and turns a cube by Rz(rz)·Ry(−ry)·Rx(−rx) about its pivot.
  - `euler_file()` writes rotations that way.
  - The exporter (`tools/boatexport.py` `R_of`) and the tests (`cornersOf` in `tests/run.test.mjs`) read them back the same way.
  - **This is reasoned from Blockbench's Bedrock import, not yet seen in game.** If hulls look inside-out in game, the sign is wrong in `euler_file` and in both readers.
- **Stems** (`stem_curve`, `stem`): each end is one swept timber from the keel's foot to its head, plated back into the shell up to the sheer, so it always joins the hull. Kinds:
  - norse, norse_tall, recurve
  - raked, raked_short
  - piercer (the Theran wave-piercer)
  - blade, kayak
  - lug, end_board
  - boards and transoms (cut to the hull's curve)
- **Rams** (`ram_cubes`): cast at the stem's foot.
  - chisel: a bronze wedge (north)
  - fin: three-bladed (the League and the dhows)
  - beak: turned down (the junks and the Pacific hulls)
  - theran: gold nested chevrons round a faceted spike, ceremonial but sharp
- **Sails** are cut cloths (`sailcloth.py`).
  - Each rig type's shape is cut from the sail texture by alpha, with clean edges at any scale, and painted with seams, boltrope and corner patches. Bellied panels, with spars where the rig has them: yard, lateen yard, crab-claw spars, junk yard, battens and boom.
  - The sail sheet's regions are also the canvas for the planned **Sail Loft** (a sailmaker's table where a player stitches a device onto a sail like a banner). The table itself is not built.
- **Sail sizes** follow the physics.
  - Each type's area is `max(SAIL_RATIO[type] × V^2/3, SAIL_PER_L2[type] × L²) × sailShare` (`ship/BP/scripts/handling.js`). `gen_boats.py` reads the same tables, plus `tools/rig_targets.json`, so each rig is drawn at the size it sails at a typical length and the in-game rig scale stays near 1.
  - Regenerate `rig_targets.json` after changing hulls or plans:
    `node --import ./tests/mocks/register.mjs <script that writes {id: {L, V23}}>` (the script used is reproduced in `viewer-wip/README.md`).
  - Wing: `SAIL_EFF.wing` = 1.45, because a rigid slotted wing draws more per block.
  - Galleys: `sailShare` 0.55, because they row to fight and sail only for the passage.
- **Masts:** each rig type has its own mast (`MAST_OF`: how far the head stands over the cloth, and how thick it is), trimmed per style by `mast_factors` and `mast_thickness`.

## The Therans (buy-only, fixed modules)

Plans are in `ship/BP/scripts/config/plans.js`: `buyOnly`, `fixedModules`, rig style `wing`. Modern sailing in Bronze Age dress, white and gold, wave-piercing bows, lightly armed (run and out-think).

- **Theran Foiler** (small): a monohull on a T-foil, one rigid wing with a slotted flap.
- **Theran Catamaran** (medium):
  - two main wings canted outward
  - two small tail wings behind them, canted inward toward each other (a fighter's twin fins)
  - a white pod between the hulls, two white beams swept forward into a chevron, and an hourglass trampoline either side
- **Theran Trimaran** (large):
  - a longer main hull and two floats, each on a single white strut swept forward
  - hourglass trampolines of diamond mesh
  - three wings stepped short, tallest, middle from bow to stern
- **All three** carry the gold ceremonial ram.

## The League's galleys (new, buy-only)

`league_monoreme`, `league_bireme` and `league_trireme`:

- a bank of oars a side per size (one, two or three), the lower banks in echelon
- a square sail at 0.55 share
- the three-bladed bronze ram
- the stern curling in over the helm (an aphlaston)

They're registered in:
- `world/boatsizes.js` (`FLEETS.league`)
- `ship/BP/scripts/config/plans.js`
- `materials.js` (`TRADITIONS.league`) and `handling.js` (League propulsion: oars)
- `en_US.lang`
- icons, and BP/RP entities copied from rowboat, longship and skeid

The League's own fleet in the world, and buying the galleys (for example at the League counter), are not wired yet.

## Known failures (`npm run ship:test`: 282 pass, 8 fail)

The last two are environmental and failed before this work:
- `boot lab` needs the `esbuild` package.
- `api lens` looks for `ship/BP/manifest.json`, which the merged pack doesn't have.

The other six came from the rounded-hull rebuild and the new boats:

1. **Every boat has a plan, an entity, a model and a name**: fixed in the source after the run (counts now 32 / 8 large). Re-run to confirm.
2. **Each rig's mast reaches its sail**: the faering's crab claw masthead is 57 against a needed 71.1.
   - The test now wants a lateen or crab-claw mast to reach halfway up the cloth.
   - Either the crab claw's `_mast_top` (`apex + 0.36 S`) goes up, or the test's rule changes.
3. **Part budget**: the Theran catamaran's launched model is 417 pieces (budget 420 − 40). The pod and the 8-slice ends cost the most.
   - Fewer end slices or strakes in the launched (`SIMPLE`) model would fix it.
   - Or raise the medium budget, if in-game performance is fine.
4. **Closed hull and no flickering faces** (`tools/lab/boatlab.py`): deck bell / canopy faces against the new gunwale, and dpaddle against the crab claw.
   - Nudges were made in `deck_bones` and the crab apex; re-run to see what's left.
5. **Large ships**: a mast count of 3 where 1 is expected. Most likely `theran_flagship` or `league_trireme` in `computeHandling(...).mastsAt` for the large-ship test; check which, and fix the expectation or the plan.
6. **Seats over a hull / dry rails** (`boatlab.py`): on the catamaran, the seats at x 0 used to stand on a flat platform.
   - There's now the white pod there, but the lab's idea of where the hull is may need the pod; check after regenerating.
   - The lee-rail-at-3° report at depth 0.8 is new too.

Unverified in game:
- the rotation sign (above)
- the canted-mast furl (furling scales a canted kit about the mast's foot)
- how the alpha-cut sail textures render under `entity_alphatest`

## Next (in priority order)

1. **Load 0.9.13 in game** and check the hulls, stems, sails and canted wings, as listed above.
2. **The world viewer** (artifact "Waterworld — world viewer"; generator `node tools/worldviewer.mjs <version>` writes `viewer/<version>/`; publish `index.html` plus the release folder).
   - `viewer-wip/boat3d.js`: a depth-buffered software renderer for `boats.json` (`ship/tools/boatexport.py`). It draws cut cloths through their masks and has been checked in node. It still needs wiring into `viewer/index.html`, replacing the current painter's Boats panel, and `worldviewer.mjs` should write `boats.json` per release.
   - `viewer-wip/world3d.js` plus `tools/modtest/vox.mjs`: the built world in 3D, block for block, in WebGL2.
     - `vox.mjs` lays chunks of `dist/` (about 0.1 s a chunk) and writes every visible block, with colour and face mask.
     - It's meant for a 48-chunk square round the cone (see `worldviewer.mjs`'s Thera region), and then each grown town.
     - Not yet wired into the page or tested in a browser.
3. **The Theran ships' remaining physics:**
   - foil lift reducing drag above a take-off speed (`core/boat.js`)
   - twin and tri handling in `ship/BP/scripts/ourmath.js`
   - buying them (spawn a launched boat from `newRecord`, as at the League counter, `mod/scripts/bank.js`)
   - `build.js` should filter out buy-only plans
4. **The Sail Loft table:** paint a chosen device into a sail's region of the sheet (`sailcloth.py` regions) as preset textures.
5. **Thera builds, still to do:**
   - the buried impactor under the cone, and its ore splash about 50 blocks under the caldera water
   - the forge, refinery and mint tunnels in the cone
   - a pre-Akrotiri cave town like Çatalhöyük in the caldera walls
   - the League's circular central bank on the caldera water
6. **Ship port, steps 3 to 6:** modules as physics laws, yards at the cothon's slips, crews, charts, Strongyle → Thera.

## House style

- The Therans are white, gold and blue. Their cultural blocks are flavoured "our math is the religion".
- Vanilla blocks plus the custom variants we need.
- Comments explain why, in plain prose.

The project docs ("Physics Sim Game Sandbox" project) carry the design history: `ship-module.md`, `cone-park-cothon-skyways.md`, `world-viewer.md` and the rest.
