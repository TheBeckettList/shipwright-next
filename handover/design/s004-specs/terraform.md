# S004 · Terraforming and land use: the overlay law, and the yard

Engineer: terraforming and land use. Read from stage/S003-R; the laid world is dist 0.9.14. Scripts are in `/tmp/tf/an` and
`/tmp/tf/repo/tools/modtest/col.mjs`, which lays a chunk with all its passes and prints a column.

## 1. Today, measured

- **Thera and the boxed towns** (`buildmod.mjs place()` l.137): the floor goes at the *highest* top under the box, and the
  foundation is filled column by column up to the floor (`lay.js lifeChunk`). Carved houses sit at the *lowest* top, with air
  cut above.
- **Grown towns** (`district.js layPlace` l.280–287): the floor is the door's ground. A footing goes down where the ground falls,
  and only the 3-block skin is dug where it rises.
- **The ground** (`ground.js groundAt`): the only shaping is `SET` (per-kind constants) and the pool banks.

What goes wrong:
1. **Entombed houses.** On Thera, 221 shallow-people houses get `floorAt: SEA+1` on land (`buildmod.mjs` l.454). The median
   house has 17 blocks of hill over its floor. Example: barn at (129119, 63, 39077), ground 128. The laid column is tuff
   21–125, stone, then grass: the deep pass's body fill overwrites the whole building. In the world's boxed towns, 122 more
   shallow houses are buried by more than 3 (example: (138837, 63, 64585), ground 83).
2. **Buried doors.** `deepChunk` fills covered columns up to `top−rise−4`, but a carved house's floor can be 8 under the top.
   - 318 of 697 carved houses are entombed somewhere at floor level.
   - 153 of their 3,903 doors are tuff in the lower half. Laid examples: (128643, 92, 38664), whose upper half survives at
     93; (128437, 143, 37336); (128924, 89, 37989).
3. **Marble cubes.**
   - The Library stands on a calcite footing 33 high: column (128469, 38132) is calcite 74–106, a mean of 12.3 over its
     58×39 box.
   - The temple's footing is 9 and the government seat's 7.
   - The amphitheatre stands on ashlar up to 16 high ((128302, 37966): ashlar 80–95), and 190 columns of the cone pieces
     carry 8 or more marble.
   - 254 houses on Thera's outer slope stand on 3–4 blocks of calcite or cobble.
4. **Stilts over the deep.** In the world's shallow towns, 342 houses stand on posts of 8 or more and 203 on posts of 13 or
   more. At (248650, 64873) the floor is at 63 over a sea floor at 31.
5. **Doors.** Of 4,468 placed doors, 904 sit 2 or more over the ground outside (245 by more than 8), and 134 sit 2 or more
   under it.
6. **Grown towns are already fine.** They grow on ground under 1.5 blocks a block (`cities.js blocked`):
   - The ground under a footprint varies by 0.16–0.38 blocks on average, there are no footings, and the cut is at most 4 (a
     boathouse's slip).
   - Their 8–14 masonry runs are towers and beacons, checked by laying them.

The sweep is mostly Thera and the boxed towns, plus one engine bug. Grown towns gain terraces and yards, and their data
shrinks.

## 2. The overlay law

An overlay is a pure field **T(x, z)**: the natural ground h clamped by the settlement's **pads**. Where no pad reaches,
T = h exactly, so removing the pads gives the natural world back. Nothing is seeded, and ties break by pad index.

**The pad.** Each building has a footprint B (its box, or the `foot` cells of a round pad), a level L and a people t. The
floor is laid at `SEA+L+1`.
- Door-anchored (grown towns): L = h(door).
- Free-standing (Thera, boxed towns): **L = the median of h over B**. *Given:* the median minimises Σ|h−L|, the least
  earthwork, so cut balances fill. It replaces "highest top", which is pure fill.
- Bounds: max h − L ≤ 5 and L − min h ≤ 5 (FIB[4]). *Derived:* the outer slope's existing `slope: FIB[4]`, split between
  cut and fill.
  - Carved houses may cut 8 (FIB[5], the caldera's bound): the cut face is their back wall.
  - A site past the bounds is refused, and `place()` tries its next rotation or cell.
- The apron, FIB[3] = 3 blocks in front of the door, is held at L. The threshold is 0 by construction.

**The bank.** Round each pad, the ground is held to a cone:
- d_i = the distance to B_i (0 inside it). Within R = FIB[5] = 8, I_i = [L_i − g·d_i, L_i + g·d_i].
- **T = clamp(h, ∩ I_i)**. If the cones conflict (the intersection is empty), the nearest pad wins:
  i* = argmin (d_i, i), and T = clamp(h, I_{i*}).
- The grade is g = 1, a block a block. *Given:* the pool-bank law already in `groundAt` l.57.
- What follows: T = L under every footprint, so nothing stands on a footing and nothing is buried. |T − h| ≤ 5.

**The set of overlays** (Richard's "set overlays"):

| Set | Closed form | Material |
|---|---|---|
| PAD | T = L on B and the apron | apron in `SURFACE[t]` (the people's lanes), else the biome top |
| BANK | the clamp above | biome top over dirt |
| TERRACE | the terracing peoples (`building.js TERRACING`, picked by `terraces()`) quantise the banks: T ← L + s·round((T−L)/s), riser s = FIB[2] = 2, tread ≥ FIB[4] = 5. Tread over riser = 2.5 ≈ φ², so the mean grade is ≈ 1/φ² (22°), as Cycladic *pezoules* run (walls 1–2.5 m, treads 3–10 m) | walls in `PALETTE[t].plinth` |
| WALL | a column whose drop to a 4-neighbour is ≥ 2 is a retaining face, at most STEP_MAX = 3. This generalises `chunkColumns`' rise ≥ STEEP rule, which shows bare stone | plinth |
| STAIR | a lane cell 1–3 under its next cell along the lane gets a stair flight | the people's stairs |
| DRAIN | a cut pad (max h − L ≥ 2) keeps its uphill ring at d = 1 at L, as a swale | gravel |
| YARD | the curtilage (§4), drawn on T | `decor.js` kinds |

**Stilts** go only where the whole footprint is water no deeper than 5 (*vision:* Ganvié and the Bajau flats, 1–3 m), so a
post is at most 6. On land, the shallow people build on a PAD raised `LIFT` (FIB[2]).

**Thera.** `SET` is already a per-kind overlay; the pads generalise it. The inner city's terrace bands (`city.js`
`CITY.terrace = 7`) are a classification, and the ground is never stepped. As TERRACE pads, with each street band a tread,
they become ground. That is the hook for the cone engineer: the Library and the temples get median pads, and the
amphitheatre's tiers become a TERRACE with risers of 1 cut into the flank.

## 3. Where it plugs in

- **`world/terraform.js`** (new, pure; add it to buildmod's `copy()` list so the game ships it):
  - `padOf(cols, {door, t, carve, water})` gives a pad or a refusal;
  - `terraAt(x, z, h, pads)` gives `{h: T, wall, stair, drain}`;
  - `yardsOf(home, free, t, living, climate)` gives the yard's plots.
- **`game/ground.js`:**
  - `usePads(PADS, PAD_BY)`, a hook like `useCascade`.
  - `groundAt` applies `terraAt` after `SET`.
  - `naturalAt` keeps today's height, for the growers and the bake.
  - WALL and DRAIN columns take the pad's material in `chunkColumnsSteps`.
- **`buildmod.mjs place()`:**
  - reads `naturalAt` and takes its floor from `padOf`;
  - bakes `PADS` (Int16 `[x0, z0, x1, z1, L, t, flags]`, about 40k pads, under 1.5 MB) and `PAD_BY` (each chunk's pads
    whose box plus R touches it).
- **`district.js layPlace`:** H becomes T, so the footing and cut loop (l.287) has nothing to do. `bakegrown.mjs` writes air
  for cuts deeper than the skin (it digs only `h−2…h` today) and exports the town's pads. The dug skin and the footings
  become plain ground, so `grown.js` gets smaller.
- **`mod/scripts/lay.js`:**
  - `planSteps` reckons the pad chunks exactly: `|| PAD_BY[k] ? 0 : MESH`.
  - `lifeChunk` drops the foundation fill and the carve air for padded placements; free pieces and stilt posts keep them.
  - With top = T, `deepChunk`'s body fill is right as it stands.
- **Cost** (an estimate; verify with `tools/modtest/passes.mjs` against `passes-full.json`). Thera flight today costs
  8.0 + 1.2 + 13.9 = 23.1 ms a chunk, with 239 surface fills.
  - `terraAt` is about 8 pads × 256 columns of arithmetic in the cached plan: under 0.1 ms, inside its row yields.
  - The terrace risers break the surface runs: about +15% fills, roughly +1 ms.
  - The life pass loses one fill per covered column.
  - Net: about ±1 ms. No new duty goes into `tempo.js`; everything rides the layer's job.
- **Reversible and deterministic.** The pads derive from the placements, T from (h, pads), and the yards from (T, pads,
  people). With no pads, T ≡ h. Chunks already laid in a world keep their blocks, as with any bake.

## 4. The yard: land use by tradition, living and climate

**The curtilage** is the free ground within w_t = max(`LANE[t]`, `FORM[t].spread`·PLOT) of a home: the gap the people
already leaves between houses, 3–16 blocks.
- **Front** is the apron, the work yard.
- **Sides** take the people's `GAP.strip` kind.
- **Back** splits **fish : crop : herd = `p.shares`** (`peoples.js`), in Fibonacci plots of 5, 8, 13 and 21 cells. A share
  under 1/φ⁴ gets no plot.

The climate (`columnClimate`) adds to that:
- cold (T < 5): a woodpile, and a cellar in the cut bank;
- dry (M < 1/φ²): a cistern and a threshing floor;
- hot and wet (T > 21, M > 1/φ): shade trees.

A shore yard adds the people's boat place. Kinds in quotes already exist in `decorOf`. The new ones:
- threshing floor (a paved circle of r 3);
- oven or kiln;
- coop and pen (with the beasts of `decor.js BEASTS`);
- woodpile, cistern, hives;
- boat shed;
- hay or rice racks;
- cache on posts;
- clam garden.

| Tradition | Fish → | Crop → | Herd → | Its own |
|---|---|---|---|---|
| therans | "racks" | treads of "vines" (kouloura), "olives"; threshing floor | goat pen | cistern always, hives, a canava cut into the bank |
| european | "landing", "racks" | "kitchen", orchard ("grove") | pen, coop | woodpile |
| norse | stockfish "racks" (hjell), naust shed | "kailyard" | sheepfold ("pasture") | hay racks (hesjer), root cellar |
| indian_ocean | haul-out ("landing") | "charbagh", date "palms" | goat pen | cistern, kiln |
| east_asian | "pond" | paddy (a TERRACE flooded 1 deep), "kitchen" | pig or duck pen | paved threshing yard |
| japanese | funaya shed | paddy, "kitchen" | — | rice racks (hasa-kake), "zen" at the front |
| dugout | smoke racks, canoe haul-out | "berries" | — | clam garden (NW-coast rock-walled terraces) |
| birchbark | canoe and drying racks | "berries", a three-sisters "kitchen" | — | woodpile |
| pacific | canoe shed | "taro" pondfields (TERRACE flooded; lo'i kalo) | stone pig pen | earth oven (umu) |
| shallow | fish pens, boardwalk | "taro" on mud | — | mud beds over the shallows |
| arctic | high racks, kayak stands | — | — | cache, snow windbreak |

**Use of the terraformed ground:**
- the apron is the work yard;
- the treads are the fields (vines and olives on Thera, paddies in the east);
- the cut bank's face holds dug rooms (the cellar, the canava, the Akrotiri *yposkafa* that `pinnacle.js` already carves);
- the fill bank takes the strip kind;
- a WALL's top is a walk where a lane meets it;
- the DRAIN feeds the kitchen beds' channel.

Grown towns claim their curtilage in `growth.js` before `gapsOf`. Thera and the boxed towns bake their yards as `free`
pieces (the promenade mechanism).

## 5. Lens checks

There are two lenses: a terraform lens in `tools/lab.mjs`, and a probe in `tools/modtest` that lays the chunks and checks
them.

| # | Check | Bound | Today |
|---|---|---|---|
| 1 | \|door_y − 1 − T(the free neighbour)\|, with 2 air above | ≤ 1 (*given:* a player steps ½ and jumps 1.25); over water, a deck at the floor | 1,038 / 4,468 fail |
| 2 | masonry above T under a floor | ≤ 1 (the sill); posts ≤ 6, over water only | 1,327 placements at 3 or more; posts to 31 |
| 3 | solid blocks in a proto's air cells after all passes are laid | 0 | 343 houses, 318 carved, 153 doors |
| 4 | \|T − h\| | ≤ 5 (≤ 8 carved) | Library 33 |
| 5 | risers ≤ 3, treads ≥ 5, banks ≤ 1 a block | exact | — |
| 6 | no strict local minimum of T in cut ground that the natural ground lacks (ponds and paddies flagged) | 0 | — |
| 7 | along a lane, \|ΔT\| ≤ 1 or a STAIR | 0 failures | — |
| 8 | no pads gives T ≡ h on 10⁴ columns; the same inputs give the same PADS hash | exact | — |
| 9 | a home with ≥ 5 free curtilage cells has ≥ 1 use; the plot areas track `shares` | within 1/φ³ | — |
| 10 | Thera flight's three passes | ≤ 23.1 ms + 1/FIB[5] of it (≈ +3 ms) | 23.1 ms |

## 6. Cost to grown towns, and build order

`sourceHash` roots are `cities.js`, `district.js` and `game/ground.js`. Touching any of them stales all 21 towns (3,167
buildings).
- **A full regrow** costs **56 min of CPU** (the sum of the recorded `ms`): 7 runs at `--secs 540`, or one run at
  `--secs 3600`.
- **A change the towns don't feel** costs a `--restamp`: it regrows the two smallest towns (8 s + 9 s) and stamps the rest.

The order:
1. The lens and the baseline (it reproduces §1). No hash change.
2. **The bugs, outside the hash**, so no regrow:
   - cap `deepChunk`'s covered fill under the structure's base (fixes the 153 doors and 318 carved houses);
   - shallow-people stilts only over water no deeper than 5 (fixes 343 houses and 203 tall stilts).
3. `world/terraform.js` and its tests (checks 5–8).
4. `usePads` and `naturalAt`, the median pads for Thera and the boxed towns, and the `lay.js` changes. The hash changes,
   but the towns use no pads yet: **restamp**.
5. Thera's TERRACE pads, **together with the cone engineer's resize** (both Thera-only, so one restamp).
6. Yards for Thera and the boxed towns.
7. **Grown towns:** `layPlace` on T, the pads and deep-cut air from bakegrown, and the curtilage. **One full regrow.**
   Batch every other hash-touching change of this stage into it.
8. `passes.mjs` (check 10), then let the calibration loop see it.

**Verified:**
- every figure in §1, from scripts run over dist 0.9.14 and laid columns;
- the code paths for placement, foundation, carve and body fill;
- the hash roots and the grow times.

**Assumed:**
- the cost figures in §3 (not run);
- the historical givens, cited only in general terms;
- that Thera's resize stays clear of the grown towns. The nearest is 9,959 blocks away; Thera's reach today is 2,304.
