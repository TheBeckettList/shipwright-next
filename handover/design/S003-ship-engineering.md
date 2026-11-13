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

## The engineering lens (`ship/tools/lab/englab.py` + `tools/lab/lawdump.mjs`)

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
