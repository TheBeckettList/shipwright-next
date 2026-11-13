# Chief engineer: the fleet's laws, the engineering lens, and the cheap launched ship

Scope: fleet-wide laws replacing gen_boats' ad-hoc numbers, the lens, performance. Culture engineers override defaults with a `vision:` tag and a reason.
Measured: `ship/RP/models|animations|render_controllers|entity` (v0.9.14) and `viewer/0.9.14/boats3d.json` (the output of `ship/tools/boatexport.py`). The scripts are in `/tmp/chief/` (measure.py, perf.py, conn.py, cmp.mjs, stab.mjs). I list my assumptions in §8.

## 1. What is wrong today, in numbers

| Finding | Where | Measured |
|---|---|---|
| **Flat hulls.** Model depth vs the law's depth (B/φ, or B/φ² for flat hulls) | `y_scale()` uses 1+(s−1)·0.4; `SIDE_TRIM` 0.85 on great ships; depth factors in `medium()` | small 0.65–1.11; ship class 0.28–0.83; great 0.25–0.49. Theran ship 0.52 vs 1.85 blocks; flagship 0.69 vs 2.74; trireme 0.69 vs 2.63 |
| **Paper-thin hulls.** World thickness is `CON/SCALE·scale` = CON, the same for every length. Vertical faces are thinner still (×ys/s = 0.55 on great ships) | `th()`, `CON` | a 34-block carrack has a 2 px shell and a 1.1 px bottom, the same as a 7-block rowboat |
| **Hulls ride on top of the water.** The waterline is fixed at 0.4 blocks above the origin and the keel at 5/16 | `HULL_LIFT`, uselab `WATERLINE` | every hull draws about 0.1 block of draught. The law gives the carrack 4.2 |
| **Unstepped masts** (mast foot hangs above the floor) | rig `foot` at y 2 | faering 0.53, cog 1.07, carrack 1.80, junk 0.53, dhow 0.56 blocks of air (skeid and trireme 0.03) |
| **Detached parts** (box graph, SAT contact within ½ px) | §5 lens | 22 of 32 boats. Theran ship: 7 separate pieces (4 wings, the centreline steering oar 1.9 blocks from either hull, the ram 2.0 blocks out at x=0). The same centreline bug puts the rudder and ram in mid-air on voyaging_canoe (1.8 / 1.9) and drua (3.8 / 2.3). Flagship middle wing 0.03 off, skiff wing 0.15 off |
| **Law and model disagree** | `medium("v", 9…)` | Theran ship L:B 9 vs FLEETS 6; flagship 10 vs 7. Ship class tops out at 20 blocks (MAX_MIDS 7 × scale 2), but the plans and FLEETS go to 22 |
| **Freeboard in the core** | `VISION.HULL_DEPTH` 2.2 | boatsizes uses depth/draft = φ, so the two disagree |
| Deck tween height | `grid.js DECK_HEIGHT` 1.5 | that is crouch height; a player needs 2 blocks to walk |
| Roll period | `laws.js rollPeriod` | 24·√(L/6). It ignores GM |
| Model GM inflated by the flat models | `coreHull` reads model depth | trireme 5.15 (model) vs 0.75 (law); carrack 5.42 vs 1.07. Every big ship is far too stiff |

## 2. Size from the world's math

**Length.** Keep `boatsizes.js` (given: Shipwright's plans; rungs 8 / 21 / 34). Do not make the ships bigger.
- Hull speed 0.4·√(32 L) (game gravity): a 34 makes 13.2 blocks/s, 3,000 blocks in ~4 min. Doubling L buys √2 speed for 8× mass and 4× deck barriers; voyage time is set by the map and closed-form voyages anyway.
- At 64 blocks a 34 × 21 ship spans ~30°. What reads small is the flat, thin hull, not the length.
- 1 block = 1 m stays.

**Depth, draught, freeboard (derived, as boatsizes already says):**
- D = B/φ (keel hull) or B/φ² (flat hull); T = D/φ; freeboard fb = D − T = D/φ².
- Set `VISION.HULL_DEPTH` := φ, derived, not a vision.
- `sizeOf` rounds B, D and T to whole blocks for berths. Engineering reads the unrounded values; add `sizeOf(...).exact`.

**Freeboard needed (derived from `core/sea.js`).** Green water comes aboard when the crest clears the rail, so need(reach) = Hs(U)/2, with Hs = 0.21 U²/g.

| Reach | Design wind U | Source | Need |
|---|---|---|---|
| inshore | 4 m/s | `TRIAL.WINDS[0]` | 0.17 |
| coastal | 7 m/s | the trades, `BELTS` | 0.53 |
| sea | 10 m/s | the westerlies | 1.07 |
| ocean | 11.5 m/s | westerlies × (1 + `GUST`) | 1.42 |

Where the law's fb is short, the hull gets a **washstrake or bulwark** of height need − fb. This is historically right: Norse washstrakes, Pacific sewn washstrakes, galley side screens.
Longship +0.55, skeid +0.03, Theran ship +0.36, flagship +0.02, junk +0.35, dhow +0.06, bireme +0.46, trireme +0.07, monoreme +0.21, war canoe +0.08, voyaging canoe +0.92, drua +0.45 (Pacific: wet by design, may tag lower). Decked kayaks exempt.

**Model scale (derived).** s = 2^round(log₂(L_nominal / FIB[5])) = 1, 2, 4. Keep powers of two, so the half-world-pixel grid stays exact and length steps are whole blocks.
- Per class, MAX_MIDS = ceil(L_max/s) − 3: small 7, ship **8**, great 7. This brings back the 22-block cogs, dhows and junks.
- **Make the scale uniform in y**: `y_scale(s) = s`. Delete `SIDE_TRIM`.
- side_px = 16·D_law/s, and the depth property scales it in [0.75, 1.5] as now.
- The seat and eye problem that the 0.4 factor and `SIDE_TRIM` were patching is solved by raising the deck (§3), not by squashing the hull.

**Waterline.** Draw the hull so the waterline sits T below the rail line from the law: root y = WATERLINE − T, with the keel under water. Seats, decks and uselab follow the deck (§3), not the origin.

## 3. Scantlings and decks

Thicknesses are in world pixels p (16 to a block). The launched model has no frames, so its shell slab carries the **whole wall** (planking, frames and ceiling). That is what a hull shows at the rail.

**Wall law:** w(L) = max(CON_today[style], 16·L/K) p, with K on Fibonacci rungs by construction.

| Construction | K | Approximate givens (from memory, for the culture engineers to verify) |
|---|---|---|
| frame-first carvel (cog, carrack, baghlah, shuinsen) | FIB 89 | Mary Rose ~0.4 m on 34 m; Bremen cog ~0.25 m on 24 m |
| bulkheaded / flat (junk, fuchuan, sampan, bezaisen; Therans, vision) | 144 | Quanzhou ship ~0.2 m on 34 m |
| shell-first light (clinker, mortise-and-tenon galleys, v, bark, skin) | 233 | Skuldelev 2 ~0.13 m on 30 m; Olympias ~0.13 m on 37 m |
| carved log | CON (3 p) | vision: carved walls read thick |

The floor is today's CON, because small boats already read right (the owner's complaint is the big hulls). w ≥ 1 p is given (Minecraft's texel).

| Wall w, in p | L 6 | L 16 | L 21 | L 34 |
|---|---|---|---|---|
| K 89 | 2 | 3 | 4 | 6 |
| K 144 | 2 | 2 | 2.5 | 4 |
| K 233 | 1 | 1 | 1.5 | 2.5 |

**Elements as golden steps of w.** Any top edge the eye sees reads at ≥ 2 p, given by the vanilla boat's 2 p sides.

| Element | Law |
|---|---|
| plank (building model) | max(1, w/φ²) |
| frame | sided max(1, w/φ), moulded w − plank |
| keel | max(2, φ·w), square, standing proud below the bottom |
| wale / gunwale | max(2, φ·w) thick, proud of the shell by w/φ, 2 thick high; carvel great ships carry wales at fb and fb/φ |
| deck slab (plank + beams) | max(2, w/φ) |
| washstrake / bulwark | max(1, w/φ²), height from §2 |
| mast | diameter max(2, 16·H/FIB[8]) p (given: Steel 1794, an inch per yard of mast ≈ H/36) |
| oar loom | max(1, 16·L_oar/55) p. This replaces `THICK` |

Horizontal and vertical faces get the same thickness once the scale is uniform.

**Decks by class** (derived defaults; cultures override with `vision:`):
- Number of decks: n = floor((D − 1)/2). The 1 is the bulwark (vision: waist-high, a block); the 2 is the tween height (given: a 1.8-block player walks a 2-block gap). `DECK_HEIGHT` becomes 2.
- **open** (n = 0, rowed or small): thwarts; coverage 0–0.47.
- **half**: the ends decked, each L/φ³ long (boatsizes' rowing ends), so coverage ≥ 2/φ³ ≈ 0.47.
- **full** (n ≥ 1): coverage ≥ 1 − 1/φ⁴ ≈ 0.85 (the rest is hatches and mast partners). The weather deck sits at fb − 1 above the waterline, which is where `topDeckUp` should put the feet. Lower decks every 2 blocks down to the hold.
- Defaults from the law: carrack, baghlah, fuchuan and shuinsen get 2 decks; the cog gets 1. Skeid, trireme, dhow and junk come out at 0 (open or half). The trireme's katastroma and the junk's full deck are culture overrides.

**Masts** are stepped on the keel or keelson (foot = floor top) and pass through every deck they cross.

## 4. Stability

- GM = KB + BM (+ the twin hull's term) − 0.62·D (`core/boat.js hullOf`). Fed **law** dimensions, it gives faering 0.21, cog 0.50, carrack 1.07, trireme 0.75 and skeid 0.67.
- Heel comes from GM through `heelOf`, which the game already does. Fixing the model depth fixes the over-stiff ships.
- Roll period (given: the Weiss/IMO roll rule, C ≈ 0.4): T = 2π·0.4B/√(g′·GM). This replaces `rollPeriod`'s √L for monohulls. Results: faering 27 ticks, cog 64, carrack 94, trireme 43. Twins and outriggers keep √L, because GM there is the float's lever, not the roll.

Checks: GM > 0 (monohulls); heel at the reach's design wind, beam reach, full sail ≤ `HEEL_MAX`; reef wind ≥ design wind for sea and ocean reach (bireme 23.9, longship 22.9: pass).

## 5. The engineering lens: `ship/tools/lab/englab.py`

The lens is Python, beside `boatlab.py`. It reuses `boatexport.export(pid, mids=…)`, the game-faithful layout; add a `mids` argument so it can run at shortest, typical and longest. The law comes from `tools/lab/lawdump.mjs`, which writes `sizeOf`, `hullOf`, `trial` and `seaState` per plan to JSON, so there is one source of truth and no Python copy of the core.

Bones get kind tags so thickness can be measured: shell, keel, wale, deck, mast, rudder, ram.

| Check | Rule | Today |
|---|---|---|
| connect | every box touches the hull's graph (SAT, ½ p). Cloth quads count as links for battens and yards | 22 boats fail |
| step | mast foot ≤ ½ p from keel/keelson/floor top; passes through every deck | 20+ masts fail |
| thick | each tagged slab's least side ≥ the §3 law for its kind, at s | big ships fail |
| depth | model D / law D in [φ^−½, φ^½] = [0.79, 1.27] | 17 of 23 ship-class and great boats fail |
| L:B | model L:B = FLEETS lb ± a half-step | Theran ship and flagship fail |
| draught | keel bottom within ½ p of the law's T under the waterline | all fail |
| freeboard | rail (with washstrake) above waterline ≥ need(reach) | see §2 |
| deck | projected deck area / waterplane ≥ class share; deck count = n | great ships have 0 (no deck when launched) |
| beams | every deck slab's ends lie within ½ p of the shell's inner face at its height | — |
| GM / heel / reef / roll | as in §4, model dimensions beside law dimensions | trireme 5.15 vs 0.75 |
| budget | cubes near and far, bone instances, animated bones, render controllers, `part_visibility` entries vs §6 targets | — |
| z-fight, gaps | imported from `boatlab.py` | — |
| bounds | `visible_bounds` contain the AABB at the longest length and the tallest rig | 96 × 16 is too low for any mast over 16 blocks |

**Report.** One line per boat, the law's figure beside the measured one, as the house's probes do. For example:

`carrack L34 s4 | D 3.30/6.80 ! | fb 1.2/1.42 ! | wall 2/6 ! | keel 2/10 ! | T 0.1/4.2 ! | deck 0.00/0.85 ! | step 1.80 ! | conn 4 ! | GM 1.07 heel7 0 | cubes 206/377 | bones 349/55 !`

`--json` emits `[ENG] {k, law:{…}, model:{…}, fails:[…]}`.

**Ratchet.** `ship/tests/engineering.json` holds each boat's failure count and budget figures. A test in `ship/tests/run.test.mjs` lets them fall and never rise, like `inherency.json`. Once a check reaches zero fleet-wide (connect first, then step), it becomes a hard assertion. This replaces the 340/460 budget test with the §6 budgets.

## 6. Performance: today and the cheapest launched ship

**Measured per boat** (typical length, sail set, no modules):

| Item | Today |
|---|---|
| Render controllers | 12 always: three hull passes (one per zone's wood), fittings, sail, ram, four deck modules, chest, furnace |
| Geometries | 11 |
| Bone instances per frame | 331–351. The launched hull (38 bones) is instanced three times, and deck_wood (80–83 bones) is present with no modules fitted |
| Animated channels | 118–138: hull 21–22 (including 7 conditional mid scales), rig 16–34 (all five styles × masts, plus 10 telltales), oars 8 |
| `part_visibility` | 270–289 entries, 27–30 KB of Molang, each one re-decoding packed properties with math.mod/floor |
| Visible cubes | 151–233 small; 180–360 ship and great (the twins about 350) |
| Theran ship / flagship | **1,577 / 1,344** cubes: swept-tube akas (804), amas (864), net cords (86–128) |
| Hidden sections | 18–45 cubes of unused mid sections are drawn at scale 0 |
| `visible_bounds` | 96 × 16 for all boats |

**The cheap launched ship:**
1. **Per-length baked geometry** `Geometry.launched_m` (m = 1..MAX_MIDS) via `Array.hulls[v.mids]`: the midbody is one full-length slab per strake, keel, wale, deck (~9 cubes, not 9 × mids); the 7 mid bones and their scale channels go.
2. **Conditional `render_controllers`** (as vanilla's player first/third-person): one hull pass when the three woods match, else three; building controllers only at stage < 5; module, chest, furnace controllers only when fitted.
3. **Distance LOD.** Geometry index `q.distance_from_camera > 34`. A world pixel is a screen pixel at 34 blocks on a 720p screen at the default 70° FOV (Switch handheld); FIB[8].
   - Far model: ends 3 slices, no laps; oar banks as one slab a side; no telltales, pennant, stitches, net cords or deck modules smaller than a block. Hide underwater planking below T·φ⁻¹, which nobody sees through the surface at range.
   - Near model: end slices 4 small, 5 ship, 6 great.
4. **Rig geometry split by style** (`Array.rigs[v.style]`), so only one style's bones exist. Telltale animation runs only when within 34 blocks.
5. **Decode once.** `pre_animation` decodes every packed property into `v.*` (v.stage, v.mids, v.style, v.deck0..). Every expression reads the variable.
6. **Theran rebuild.** Akas as 3–5 tapered slabs each, nets as one alpha-tested slab a side (`entity_alphatest`), amas at hull launched density (about 70 cubes each).
7. **Derived bounds.** `visible_bounds` = (L_max + 2·float_out) wide and (rail + mast top + 1) high, so culling works and masts don't pop out.
8. **Shields** are one entity each today (`shields.js`). Draw them in the outfit geometry with a count property. I have not measured the per-tick teleport cost; that needs a probe.

**Targets** (Fibonacci rungs; near / far):

| Target | small | ship | great |
|---|---|---|---|
| visible cubes, near | ≤ 144 | ≤ 233 | ≤ 377 (room for decks, wales, castles) |
| visible cubes, far | ≤ 55 | ≤ 89 | ≤ 144 |

Twins and trimarans count in their class.

Across all classes:
- Bone instances per frame ≤ 34 small and ≤ 55 larger near; ≤ 21 far.
- Animated channels ≤ 21 / 34.
- Active render controllers at sea ≤ 4, plus one per fitted module family.
- `part_visibility` entries ≤ 34.

## 7. For the culture engineers

Twins steer with an oar on each hull's quarter and carry the ram on each bow (or a nacelle reaching it). Theran wings are stepped into the deck, foot sunk ≥ w. Junk battens tie to the mast (parrels). Great ships launch with their decks and masts stepped through them (today a launched carrack is an open box, masts floating at rail height). `gen_boats.py` should read lb, fullness, flat and range from a JSON export of `world/boatsizes.js`.

## 8. Verified and assumed

Verified by code or measurement: §1, §6, the law tables (run through `core/boat.js`, `core/sea.js`), masts and detached parts (boatexport boxes, longest length). Assumed, to verify: the historical wall thicknesses (from memory), `q.distance_from_camera` and conditional `render_controllers` on Switch, that hidden or zero-scaled bones still cost transforms, Bedrock's entity view distance, the 720p/70° screen figures.
