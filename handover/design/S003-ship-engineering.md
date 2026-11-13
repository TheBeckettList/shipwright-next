# S003 design: ship engineering, yard to launch

Merged by the lead engineer (Claude) from seven specs written by the culture naval engineers (`s003-specs/`:
`chief.md` laws + lens + performance; `therans.md`; `league.md`; `northern.md`; `atlantic_indian.md`;
`eastasian_pacific.md`; `inland.md`). Each spec carries its own derivations, sources and what it verified; this page
is what we build, in what order, and what Richard decides. **Status: proposed, awaiting Richard.**

## What the engineers found (all measured on v0.9.14 unless marked)

| Finding | Where | Effect |
|---|---|---|
| Vertical scale is `1 + (s−1)·0.4`, not `s`; `SIDE_TRIM` 0.85 on great ships; `medium()`/`large()` set side from the *half*-beam | `gen_boats.py` `y_scale`, `SIDE_TRIM`, `medium()` | ship and great hulls drawn at 0.25–0.83 of the depth the world's law gives (beam/φ): cog 1.71 vs 3.14, carrack 3.30 vs 6.80, Theran cat 0.52 vs 1.85, trimaran's main hull shallower than its floats. **This is the "flat".** |
| Every thickness divided by the model scale | `gen_boats.py th()` | every wall the same ~1/8 block whatever the length; horizontal faces on great ships thinner still. **This is the "paper thin".** |
| Waterline fixed 0.4 over the origin | `handling.js WATERLINE`, models | every hull shows ~0.1 block of draught (a carrack's law: 4.2) |
| Detached parts | connectivity over `boats3d.json` | **22 of 32 boats**. Theran cat: 7 pieces (4 wings, ram and steering oar on the centre line between the hulls). Trimaran: 3 floating wings and a second outrigger float drawn through her own (`plans.js outrigger: true`). Voyaging canoe and drua: ram and rudder on the centre line in open water. Masts stand above the floor (carrack 1.8 blocks, cog 1.07, faering 0.53). |
| `sizeOf` rounds beam, depth, draught to whole blocks | `world/boatsizes.js` | small hulls get **zero freeboard** (rowboat, dugout, sampan, wasen, outrigger, longship) |
| No decks on launched great ships; deck geometry (80 bones) always loaded | geo + render controllers | open shells; cost with nothing shown |
| Rams on cultures that never rammed | `RAM_OF` | Norse, European, Indian Ocean, East Asian, Japanese, Pacific, canoes all carry one |
| Cost per boat at sea | RP | 12 render controllers, **331–351 bone instances a frame** (the launched hull drawn three times, once per wood zone), 118–138 animated channels, ~28 KB of Molang visibility; Theran cat **1,577** visible cubes, trimaran 1,344 (192-piece tube beams and net cords); visible bounds 96×16 (too low for any mast over 16) |
| Data mismatches | `FLEETS` vs `BOATS` vs `plans.js` | mast counts (junk 3/2, fuchuan 5/3, shuinsen 2/3, dhow 1/2); Theran fleet still the fresco's paddled boats (cat gets 18 rowers); umiak paddles+sail vs oars; trimaran rows through her own nets |
| Stale figure | `core/given.js` comment | `D.M_PER_BLOCK` is **152.9 m**, not 1,223 (old 32,768-block globe): a Thera run of 104k blocks is ~15,900 km |

## The laws (proposed; all tagged given / vision / derived in code)

1. **Length stays on the world's rungs** (8 / 21 / 34, `boatsizes.js`). The chief engineer's case: what reads small
   is the flat, thin hull, not the length; doubling L buys √2 in speed for 8× the mass and the voyage time is set by
   the map. With true depth, decks and walls, a 34 stands 2–3× taller in the water than today. *Exceptions:* the
   League's galleys (below), ship class allowed to its plans' 22 (MAX_MIDS 8 at scale 2).
2. **Depth from the law, drawn true.** `y_scale(s) = s`; `SIDE_TRIM` goes; side = 16·D/s. D = B/φ (keel), B/φ²
   (flat, and open keel-less canoes; Norse: B/φ², their beam/depth runs 2.3–2.7), T = D/φ, freeboard = D/φ².
   `sizeOf` keeps 1/16-block values (`exact`); whole blocks only for berths.
3. **Freeboard needed** = half the significant wave of the reach's design wind (`core/sea.js`): inshore 0.17,
   coastal 0.53, sea 1.07, ocean 1.42 blocks. Short of it → a washstrake or bulwark (Norse washstrakes, galley screens).
4. **Walls grow with length:** w(L) = max(today's floor, 16·L/K) px, K on Fibonacci rungs by construction: 89
   frame-first carvel, 144 bulkheaded/flat (and the Therans), 233 shell-first light (clinker, galleys, bark, skin).
   A 34 gets 6 / 4 / 2.5 px. Keel and wale φ·w, deck w/φ, plank w/φ²; any edge against the sky ≥ 2 px.
5. **Decks from depth:** n = floor((D − 1)/2) (1-block bulwark, 2-block tween for a 1.8 player); open / half (ends
   L/φ³) / full (≥ 1 − 1/φ⁴ = 0.85 of the length). Weather deck at freeboard − 1 under the rail; feet go there.
   Masts stepped on the keel, through every deck. The design wave picks how many decks an ocean ship needs (carrack 2,
   baghlah 1 + poop).
6. **Stability from the true hull:** GM from `hullOf` fed the law's dimensions (today's flat models make GM
   several times too big: trireme 5.15 vs 0.75); roll period 2π·0.4B/√(g′·GM) for monohulls.
7. **Twins and outriggers** joined by real crossbeams, count round(L/φ²)+1 (Hōkūleʻa's 8); hull centres φ·beam apart;
   steering and anything centreline goes on the hulls.

## The engineering lens (`ship/tools/lab/englab.py` + `ship/tools/lab/lawdump.mjs`)

One line per boat, the law's figure beside the model's, like the house's probes; `--json` for `[ENG]` lines. Checks:
connect, mast step, wall thickness, depth, L:B, draught, freeboard, deck cover and count, beams landing on the shell,
GM / heel / reef / roll, budgets (cubes near/far, bone instances, animated bones, render controllers, visibility
entries), z-fight and gaps (from `boatlab.py`), visible bounds; plus the cultures' own (no rams where none rammed;
clinker laps; side rudder on Norse ships; bulkheads at junk mast feet; Pacific crossbeams; galley outrigger).
A ratchet in `ship/tests/engineering.json` (may fall, never rise); each check turns hard once the fleet passes it.
It replaces the 340/460 part-budget test.

## The cheap launched ship (targets)

One hull pass when the woods match; the mid-body merged into full-length slabs; ~11 bones instead of 38; oars one bone
a side; laps, ports, stitching and seams painted, not built; deck geometry only when a module is fitted; rig split
by style; visible bounds from length and mast height; Theran beams, floats and nets as slabs. A far model past ~34
blocks if Bedrock's `q.distance_from_camera` and conditional render controllers behave on the Switch (to probe first).

| | small | ship | great |
|---|---|---|---|
| visible cubes near / far | ≤ 144 / 55 | ≤ 233 / 89 | ≤ 377 / 144 |
| bone instances a frame | ≤ 34 | ≤ 55 | ≤ 55 |
| animated channels | ≤ 21 | ≤ 34 | ≤ 34 |

## The League (league.md)

The League sits in the doldrums (lat −2.4°, 1.5 m/s) and carries to Thera's westerlies (Hs 2.14): oars at home,
freeboard at the far end. The freeboard law puts all three -remes in the great class; each is sized by its route:

| Galley | Route | L | crew | job |
|---|---|---|---|---|
| Trireme, the month-ship | seat ⇄ Thera, 98–108k blocks, 15 hops | 36–38 (37) | 184 | coin, kits, the House's buys; one run a month |
| Bireme, carrier | the carrying trade for 67 peoples, 3.3–45k | 30–34 (32), by its route's sea | 106 | others' goods |
| Monoreme, victualler | continent markets ⇄ Thera, median 50k | 28–30 (29) | 51 | the Therans' month: 24 chests |

New: **hemiolia** (ship class, defence: harbour guard, pirate chaser, L 18), **kerkouros** (ship class, logistics:
coaster between the deep seats, L 20), **keles** (small, the presidency's dispatch courier, L 9), **skaphe** (small,
tender and lighter for the five shallow seats, carries the diving bell, L 6). The aphlaston stern, the trireme's
outrigger (parexeiresia) and eyes; the monoreme rows on tholes.

## The Therans (therans.md)

All-sail ocean ships (fleet table fixed: no 18 rowers): skiff 6, catamaran 18 (hulls 1.85 deep each, overall 6.9),
trimaran 34 (main hull 3.0 deep, floats 21 long, decks flush). Every hull fully decked; the catamaran's bridge deck
carries the fresco's stern cabin (ikrion) as its bridge, a centre bow under it carries the ram (modern wave-piercer
form), twin rudders on the sterns; the trimaran's beams two a side, arched like gull wings, nets laced to all four
edges; every wing stepped on a keel step through a gold collar, a fairing under each root; the duplicate float gone.
Targets ~460 / 440 / 185 cubes (from 1,577 / 1,344 / ~230).

## The other cultures (one line each; detail in their specs)

- **Northern:** real clinker lands (each strake t outboard of the one below), keel, one-timber stems, deck boards on
  the crossbeams at the waterline (Gokstad), oar ports in the top strake, starboard side rudder, raised steering
  platform on the skeid; skeid 33 × 4.4 × 1.68. Umiak flat floor and hard chine; kayak crew 1.
- **Atlantic / Indian Ocean:** decks from the design wave; castles on golden lengths (the carrack's sterncastle,
  waist and forecastle sum to her length); carvel wales; carrack bowsprit; gunport sills ≥ a block over the
  waterline (the Mary Rose lesson); dhow 2 masts; stitching and lime bottom in the texture.
- **East Asian / Japanese / Pacific:** junk bulkheads round(L/φ²) (Quanzhou's 13 on the fuchuan), balanced rudder;
  bezaisen flat and single-masted at L/√φ (Naniwa Maru); Pacific twins as above; masts junk 2, fuchuan 3, shuinsen 3.
- **Inland:** truer, not bigger; canoes B/φ², the flatboat gets its house; paddlers two abreast past 1.2 beam; the
  freight canoe 12–14 (portage limit); river lanes size the flatboat (φ³ beam fits the 8-wide river exactly).

## Order of work

1. **The lens first** (englab + lawdump), run on today's fleet: the baseline numbers, ratchet in.
2. **The laws** in `boatsizes.js` (exact sizes, depth forms, freeboard) and `gen_boats.py` (`y_scale`, `th()` → w(L),
   decks, mast steps, waterline) — regenerate, lens, viewer.
3. **Connectivity**: twins' centreline parts, masts, the Therans rebuilt.
4. **The cheap launched model** (bones, merged slabs, one wood pass, bounds); a probe on the Switch for LOD.
5. **The League fleet** (three great galleys, four new types: entities copied from analogues, never `gen_entities.py`).
6. **Culture fixes** (rams, rudders, castles, masts, data mismatches).
Each step: lens numbers, `ship:test`, a viewer release to look at. Minor version: **0.10.0**.

## Lens baseline, v0.9.14

Step 1 of the order of work, run on today's fleet before any hull law changes. `python3 ship/tools/lab/englab.py`
(one line per boat, model / law, `!` on a fail; `--json` for `[ENG]` lines; `--boat id`), about 10 s for the fleet.
The law comes from `ship/tools/lab/lawdump.mjs` (sizeOf exact, hullOf, trial, seaState, the wall law, decks; it
prefers `sizeOf(...).exact` once that exists); the models from `boatexport.export(pid, mids=, names=True)` at the
mid count the game gives the typical length, and from the render controllers, entity and animations with their
Molang evaluated against the properties `ship.js applyRecord` sets at launch (under way: sail drawing, oars pulling).
The ratchet is `ship/tests/engineering.json` (per boat, per check; may fall, never rise; `heel`, `zfight`, `gaps`
and `ram` are hard, zero fleet-wide today); `englab.py --ratchet` rewrites it after a fix lowers the counts. The
340/460 part-budget test stays until the §6 budgets pass.

| Check | Boats failing (of 32) | Fail count | What fails |
|---|---|---|---|
| conn | 25 | 162 | detached pieces (components off the hull's graph) |
| step | 23 | 38 | masts whose foot stands off the floor |
| thick | 27 | 41 | shell under w(L), plus a missing or thin keel |
| depth | 23 | 23 | model D outside [φ^-½, φ^½] of the law's |
| lb | 5 | 5 | model L:B outside the same band |
| draught | 32 | 32 | bottom not at the law's T under the waterline |
| freeboard | 11 | 11 | rail short of the design wave's need |
| deck | 5 | 5 | a decked law (n ≥ 1) without its decks |
| gm | 25 | 25 | model GM outside a step of the law's |
| heel (hard) | 0 | 0 | law or model hull lays over or reefs below her design wind |
| cubes | 13 | 13 | visible cubes over 144 / 233 / 377 |
| bones | 32 | 32 | bone instances over 34 / 55 |
| anim | 32 | 32 | animated bone evaluations over 21 / 34 |
| rc | 32 | 32 | render controllers over 4 (+1 per shown module family) |
| pv | 32 | 32 | part_visibility entries over 34 |
| zfight (hard) | 0 | 0 | coplanar fighting faces (boatlab) |
| gaps (hard) | 0 | 0 | holes in the planking (boatlab) |
| bounds | 16 | 30 | geometries whose visible_bounds cut the longest boat |
| ram (hard) | 0 | 0 | a ram drawn unbought outside the League and Therans |

| Boat | L, s | D model/law | T model/law | fb model/need | wall px model/law | step | conn | GM model/law | cubes | bones | fails |
|---|---|---|---|---|---|---|---|---|---|---|---|
| faering | 6, 1 | 0.89/0.87 | 0.03/0.54 | 0.86/0.17 | 1.0/1.0 | 0.53 | 4 | 0.34/0.21 | 190 | 331 | 12 |
| longship | 15, 2 | 1.06/1.37 | 0.00/0.85 | 1.06/1.07 | 1.0/1.0 | 0.63 | 6 | 1.21/0.34 | 208 | 331 | 17 |
| rowboat | 5, 1 | 0.83/0.95 | 0.03/0.59 | 0.81/0.17 | 2.0/2.0 | 0.50 | 4 | 0.28/0.17 | 143 | 331 | 12 |
| bark_canoe | 6, 1 | 0.67/0.64 | 0.03/0.40 | 0.65/0.17 | 1.0/1.0 | 0.00 | 0 | 0.36/0.19 | 174 | 331 | 7 |
| outrigger | 7, 1 | 0.69/0.62 | 0.03/0.38 | 0.66/0.52 | 1.5/1.5 | 0.37 | 3 | 3.92/3.84 | 176 | 331 | 11 |
| sewn_boat | 7, 1 | 0.83/1.15 | 0.03/0.71 | 0.81/0.17 | 2.0/2.0 | 0.50 | 5 | 0.27/0.24 | 190 | 331 | 15 |
| sampan | 6, 1 | 0.73/0.71 | 0.03/0.44 | 0.71/0.17 | 2.0/2.0 | 0.41 | 1 | 0.44/0.60 | 156 | 331 | 8 |
| wasen | 7, 1 | 0.82/0.96 | 0.03/0.59 | 0.80/0.17 | 2.0/2.0 | 0.50 | 2 | 0.32/0.20 | 166 | 331 | 10 |
| dugout | 6, 1 | 0.79/0.62 | 0.06/0.38 | 0.73/0.17 | 3.0/3.0 | 0.00 | 0 | 0.30/0.15 | 152 | 331 | 9 |
| punt | 6, 1 | 0.55/0.51 | 0.06/0.31 | 0.49/0.17 | 2.0/2.0 | 0.00 | 0 | 0.71/0.39 | 138 | 331 | 7 |
| kayak | 5, 1 | 0.52/0.48 | 0.03/0.29 | 0.49/0.52 | 0.5/0.5 | 0.00 | 1 | 0.30/0.14 | 153 | 331 | 9 |
| theran_skiff | 6, 1 | 0.66/0.93 | 0.03/0.57 | 0.63/0.17 | 1.5/1.5 | 0.34 | 1 | 0.20/0.23 | 315 | 332 | 11 |
| cog | 16, 2 | 1.64/3.14 | 0.00/1.94 | 1.63/0.52 | 1.0/2.9 | 1.07 | 6 | 2.34/0.50 | 203 | 334 | 19 |
| freight_canoe | 15, 2 | 0.59/1.55 | 0.00/0.95 | 0.59/0.52 | 0.9/1.0 | 0.00 | 0 | 2.71/0.44 | 190 | 331 | 8 |
| voyaging_canoe | 16, 2 | 0.56/1.32 | 0.00/0.81 | 0.56/1.42 | 1.3/1.5 | 0.35 | 16 | 45.02/15.94 | 347 | 337 | 30 |
| dhow | 16, 2 | 0.99/2.64 | 0.00/1.63 | 0.99/1.07 | 1.8/2.0 | 0.57 | 11 | 3.26/0.48 | 211 | 337 | 24 |
| junk | 16, 2 | 0.94/1.88 | 0.00/1.16 | 0.93/1.07 | 1.7/2.0 | 0.52 | 2 | 4.44/1.52 | 190 | 337 | 15 |
| bezaisen | 16, 2 | 0.81/2.64 | 0.00/1.63 | 0.80/0.52 | 1.8/2.0 | 0.44 | 6 | 3.94/0.42 | 177 | 331 | 18 |
| war_canoe | 15, 2 | 0.47/1.16 | 0.07/0.72 | 0.41/0.52 | 2.4/3.0 | 0.00 | 0 | 1.83/0.33 | 168 | 337 | 9 |
| flatboat | 15, 2 | 0.55/1.64 | 0.00/1.01 | 0.55/0.17 | 1.5/2.0 | 0.00 | 0 | 6.36/1.21 | 156 | 331 | 8 |
| umiak | 14, 2 | 0.72/2.16 | 0.00/1.34 | 0.71/0.52 | 0.5/1.0 | 0.00 | 0 | 4.49/0.53 | 180 | 331 | 8 |
| theran_ship | 18, 2 | 0.57/1.85 | 0.00/1.15 | 0.57/1.07 | 1.3/2.0 | 0.14 | 6 | 3.61/0.39 | 1716 | 351 | 23 |
| skeid | 33, 4 | 0.44/2.72 | -0.05/1.68 | 0.49/1.07 | 0.8/2.3 | 0.03 | 6 | 8.24/0.67 | 208 | 334 | 19 |
| carrack | 33, 4 | 2.71/6.80 | -0.05/4.20 | 2.75/1.42 | 1.8/5.9 | 1.80 | 18 | 7.00/1.07 | 200 | 349 | 33 |
| baghlah | 33, 4 | 1.68/5.83 | -0.05/3.60 | 1.72/1.42 | 1.7/5.9 | 0.99 | 16 | 8.92/0.92 | 196 | 343 | 30 |
| fuchuan | 33, 4 | 1.76/6.37 | -0.04/3.94 | 1.80/1.42 | 1.1/3.7 | 1.20 | 4 | 9.89/0.87 | 209 | 349 | 19 |
| shuinsen | 33, 4 | 1.46/6.00 | -0.05/3.71 | 1.51/1.42 | 1.7/5.9 | 0.84 | 18 | 10.61/0.95 | 198 | 349 | 33 |
| drua | 33, 4 | 0.73/2.55 | -0.04/1.58 | 0.77/1.42 | 1.3/2.3 | 0.42 | 9 | 114.81/30.83 | 332 | 334 | 22 |
| league_monoreme | 8, 1 | 0.74/0.82 | 0.03/0.51 | 0.71/0.52 | 2.0/2.0 | 0.41 | 3 | 0.24/0.22 | 206 | 331 | 11 |
| league_bireme | 18, 2 | 0.45/1.59 | 0.02/0.98 | 0.42/1.07 | 1.7/2.0 | 0.10 | 6 | 2.40/0.43 | 226 | 331 | 19 |
| league_trireme | 34, 4 | 0.45/2.63 | -0.05/1.62 | 0.50/1.07 | 1.5/2.3 | 0.00 | 5 | 8.10/0.75 | 236 | 334 | 17 |
| theran_flagship | 31, 4 | 0.46/2.74 | -0.04/1.69 | 0.50/1.07 | 1.1/3.4 | 0.03 | 3 | 4.60/0.58 | 1483 | 349 | 20 |

How to read it. Model figures are measured on the launched hull's midships pieces in the entity's frame: the
game's root bone moves by `HULL_LIFT` and is not scaled by its own scale, so pieces sit `HULL_LIFT·(ys − 1)` px
lower and `8·s` px further aft than `boatexport`'s viewer layout (which is unchanged). The launched model has no
keel, so D runs from the shell's floor to the rail; that is why the depths here sit a little under the chief's
proportion-based figures (carrack 2.71, not 3.30) and the model GMs a little over (trireme 8.10, not 5.15). A twin's
beam is one hull's. `conn` counts components off the hull (cloth quads count as links, so a sail that touches its
yard joins it). `bounds` scales the rig by the longest length's `rig_scale` about the mast foot. `ram`: today no
boat outside the League and the Therans draws one unbought (the outfit controller already keys on the fitting);
the check keeps it so (D-005).

Not verified here: the Bedrock rule that a hidden parent bone hides its children (assumed, as the controllers
are written that way), and that a bone's position is not scaled by its own scale (Blockbench's convention).

