# S004 — Thera: the larger cone, the Fallen Star, the Measure, the tunnels as math

*Thera engineer and loremaster. **M** marks what I measured, **A** what I assumed.*

## 1. Where the marble cubes come from (M)

**The mechanism.** `buildmod.mjs place()` stands a floor at `y0 = max(top)` over the footprint. Then `lay.js lifeChunk` fills every column up to `y0−1` with `foundation`.

**The culprit.** `site()` lays the summit's civic buildings with `foundation: "minecraft:calcite"`, **no slope limit**, and takes the first spot that fits. I rebuilt the ground from `dist/` (`ground.js topAt`) and summed the fill under every placement within 1.25 R of the cone:

| building | calcite fill (blocks) | tallest (blocks) |
|---|---|---|
| library (58×39) | **27,889** | **33** |
| government seat | 4,895 | 7 |
| great temple | 3,893 | 9 |
| navigation house | 1,456 | 6 |
| all other cone placements | 99 | – |

That makes 38k blocks in four podiums, and the library alone is 73% of it. In `thera3d.bin` it is the calcite mass 43 blocks tall at x266–448, z210–331.

**"Diorite"** (reading: A). No diorite is laid. It is calcite plus tuff risers. On the cone, the side faces are 25% tuff and 13% calcite, and 18.7% of the top faces are calcite. The tuff comes from `surfaceChunk`: it lays 2 blocks of `under`, then the volcanic `beds[0]` (tuff), so every riser of 3 or more shows grey.

## 2. The cone: radius × 1.5, 25% higher, open at the top (D-006)

I swept a patched copy of `world/thera.js` (M; scratch: `/tmp/thx/w`). Slopes are in blocks per block, rays every 2°.

| dome | land | summit (blocks) | median slope | p90 slope | shore radius | narrowest lagoon |
|---|---|---|---|---|---|---|
| now: r 1.08 km, 230 m | 2.68 km² | 59.1 | 0.46 | 0.78 | 0.70–1.17 km | 1.36 km |
| r·√2 (my first draft) | 5.54 km² | 73.5 | 0.39 | – | – | 0.96 km |
| **r·1.5 = 1.62 km, 287.5 m (D-006)** | **6.27 km²** (2.3×) | **73.5** | **0.36** | **0.64** | **1.04–1.71 km**, median 1.42 | **0.86 km** at 280° |
| r·2 | 11.5 km² | 73.5 | 0.27 | – | – | 0.22 km |

**The decision.** Set **`dome.r = 1.62`** and **`dome.top = 287.5`** (vision: the owner's word).

**The lobes.** I tried `lobes / φ²`. It barely rounds the shore (1.08–1.77 km), because the island's warp makes the wander, not the lobes. Keep 0.35.

**The passages out.** The strait is unchanged. Its inner mouth lies 3.36 km from the cone. Toward it there is **1.87 km of open water**, measured from the island's shore at 1.48 km.

**The narrowest lagoon.**

| measured to | narrowest | where |
|---|---|---|
| the ×1.5 island's raw shore | 0.86 km (172 blocks) | 280° |
| the ring (§2a) | 0.87 km (172 blocks) | 282° |
| the ring, other side | 187 blocks | 192° |

Every passage is more than five great-ship lanes.

Bearings are measured with 0° east and 90° north. The cothon stands at 81.8°.

**The crater** (a new term in `theraMetres`, inside the dome branch). Within `FIB[8]` (34) blocks of the summit, subtract `FIB[7]·M·(1−(rc/34)²)`: a bowl 21 deep, its floor near y 114. A throat of radius `FIB[4]` stays open in the floor for the `vent` node (§4): the dormant volcano, open at the top.

The great temple moves to the crater's rim on the mouth side, `site("great temple", mouth, FIB[8]+FIB[6])`. It faces across the vent, as Delphi faced its chasm.

**Footings by rule, not cube** (`place()`/`site()`):
1. **Fill ≤ `FIB[3]`.** A crepidoma is three steps (given). Anything higher is cut: the floor drops to `top−3` and the slope above is carved back.
2. **`site()` scores its tries.** It keeps the one with the least `Σcut + φ·Σfill` among those that obey rule 1, instead of the first that fits.
3. **Podiums wear Thera's three stones.** Banded `smooth_basalt` / `red_sandstone` by `word(y)`, with one Theran-marble coping course. Plato, *Critias* 116a: the stones under the central island were "white, black and red".

**The cone's skin.** On the cone's kinds, lay `under` down to `footOf(c)` so a riser up to 5 shows earth.
- A taller riser becomes a dry-stone terrace wall (*pezoula*) in the three stones.
- `CITYTOP`'s calcite `under` becomes dirt / packed mud.

**Lens targets:**
- tuff plus calcite side faces ≤ 1/φ⁴ (15%), down from 38%;
- calcite tops ≤ 5%;
- fill ≤ 3 per column, so the library goes from 27,889 to ≤ 1,000.

**More paths** (the cone park in `buildmod`). All keep today's grade, a fall of at most 1/φ² a block.
- **Rings: six, up from 4.**
  - the quay at +3;
  - the stoa's roof at **+13**;
  - the contours at 21, 34 and 55;
  - the crater rim, about 70.

  The old rings at 5 and 8 fall inside the waterfront ring's band, so they go.
- **Serpentines:** `FIB[5]` = 8, up from 5. They run from the crater rim down to the stoa's stairs.
- **Spurs:** one to every cone tube-mouth.
- **Two processional ways:** the **Sacred Way** (cothon to temple, switchbacked) and the **Mint Road** (Mint to the crater rim).

## 2a. The ring: the cone island's main waterfront (D-006)

**Its line.** The plain ×1.5 shore wanders from 1.04 to 1.71 km. I fitted the ring to the shore's own Fourier series and measured how far the shore strays from each fit (M):

| harmonics kept | ring radius | land beyond the ring (cut) | water inside the ring (fill) |
|---|---|---|---|
| 0: a true circle | 1.40 km | 63 blocks | 70 blocks |
| 3 | 1.10–1.62 km | 49 blocks | 37 blocks |
| **5** | **1.01–1.65 km** | **23 blocks** | **19 blocks** |
| 8 | 1.06–1.67 km | 19 blocks | 14 blocks |

- **The ring is the shore's first `FIB[4]` = 5 harmonics.** This is derived, and is the least that keeps both the cut and the fill inside the ring's own width.
- Its quay face runs about **1,760 blocks** round.
- It is a new term in `theraMetres`, applied after the dome:
  - beyond the ring's line: water;
  - in the band `[R5 − 34, R5]`: quay height;
  - inside the band: the dome.

  It is evaluated in the real plane, so its line is the true harbour line.
- **What it replaces:** `city.js`'s "ring canal" (`rings.inner`). The berth pocket takes its place.

**Its levels.** Width `FIB[8]` = 34, seaward to landward:

| level | height | what |
|---|---|---|
| berth pocket | water dredged to **SEA − 6** | D-004 draughts up to about 4.2. `harbourOf`'s rule is draught + 1, which gives 6. The pocket is 21 wide, which takes the Theran trimaran's 21 beam. Beyond it the lagoon's own floor (−7.5) is already deep enough. |
| quay face | −6 to +3 | dressed `smooth_basalt` with one marble coping course: no cube of marble |
| quay apron | **+3** (as the cothon's floor), 13 wide | bollards every 8, a crane (scaffolding and chain) at every berth, lamps |
| landing stages | **+1**, every 89 | for skiffs (draught ≤ 1) |
| stoa | 21 deep, two storeys | its back wall retains the cut, at most about 23 blocks (the table above), terraced in the three stones |
| stoa roof | **+13** | the ring path; stairs to the quay every 55 |

**The berths.**
- Free quay = 1,760 less the two harbours (about 190 each), so about 1,380 blocks.
- At one great ship a `FIB[9]` = 55 (34 long, 21 for lines and the gap), that is **about 25 berths alongside** (A).
- Small craft moor stern-to at the stages.

**The two harbours anchor it.** Each is centred **on the ring's quay line**: half in the island, half out on its own moles.
- **The cothon** stays at its bearing (81.8°, `CITY.cothon.turn` kept), with its mouth outward.
  - Wholly inland would mean a 188-wide basin cutting a bluff of about 55 blocks, which does not fit.
  - So the basin's landward half is cut open to the sky. Its back wall stands about 22–25 blocks high on the bigger slope (ground 18 at 26 in, 25 at 52 in).
  - The landward shipsheds are **rock-cut galleries under the cone**, roofed by the living rock (*Critias* 116b: docks "roofed by the native rock").
  - `CITY.cothon.inset` becomes the ring's share of the radius.
- **The Koinon House and Mint** stand at `IMPACT.bearing` = **261.8°**, still opposite the cothon.
  - The lagoon there is 1.33 km wide.
  - After the House reaches 94 out, about **170 blocks of water** are left at its centre line and about **140** at its edge toward the narrowest point (282°) (A: the lens must confirm).

**The skyways.**
- **Roots move** to where the cone's ground reaches the deck (`DECK` 30), not `top/3`, so each trunk leaves the ground level.
- **Each trunk crosses the ring at 30**, 17 over the stoa's roof, with a stair pylon down to the stoa roof.
- **Spans** from root to wall foot (M, warped plane, per quarter from the mouth):

| | spans (blocks) |
|---|---|
| today | 487, 365, 374, 408, 498 |
| ×1.5 | **407, 282, 313, 341, 426** |

- `theraplan.js skyways()` `crosses()` must keep clear of the Mint as well as the cothon.

**Closure.** `thera.js`, `city.js` (new kinds "quay ring", "stoa", "Koinon house"; the cothon's inset) and `ground.js` (`SET` for the new kinds) are in the grown towns' closure. That means **one regrow, batched with the terraforming** (D-006). `theraplan.js`, `theracity.js`, `buildmod` and `lay.js` are outside it.

## 3. The Fallen Star: `world/impact.js` (new, pure)

`coinage.js` already names this file. Import it only from `strata.js`, `undercone.js` and `buildmod`, which keeps it out of the closure.

```js
export const IMPACT = Object.freeze({
  bearing,                 // derived: cothon's bearing + π (cothonWorld 81.8° now → 261.8°): "a side not the cothon"
  r: R / PHI, y: -FIB[7],  // derived: under the flank, 200 out (R = 324: dome.r 1.62 km), about 100 inside the ring; vision: y -21, the homeports' lode floor
  body: FIB[6], breccia: FIB[8],
  splash: { y: GIVEN.SEA - FIB[9], thick: FIB[4], R0: FIB[8], R1: FIBS[12], aspect: PHI },   // S001's "~50 under the water": y 7–11, out 233 downrange
  LODE:   [["ancient_debris", 21], ["raw_iron_block", 89], ["deepslate_iron_ore", 377], ["deepslate_copper_ore", 144], ["deepslate_gold_ore", 55]],
  SPLASH: [["deepslate_iron_ore", 233], ["obsidian", 89], ["deepslate_copper_ore", 89], ["deepslate_diamond_ore", 34], ["deepslate_gold_ore", 34]],
});
export function impactAt(x, y, z)    // { zone: body|breccia|splash|null, ore, rock }
export function impactColumn(x, z)   // [[y, id]] for strata.js columnRock, as lodeOf
```

**The body** is a sphere.
- Its heart is ancient debris (netherite: the uncanny metal).
- Its shell is nickel-iron, which is what meteoric iron is (given).
- The matrix is basalt veined with `crying_obsidian`, the star-glass.
- The k-th ore sits at radius `body·√(k/n)` and bearing `k·GOLDEN_ANGLE`, so the counts come out exact.

**The breccia** is blackstone and tuff with `magma_block` warm spots: the volcano is dormant, not dead.

**The splash** keeps `strata.js`'s ore lattice. Each lattice centre's chance is `p0·(r/R0)^−3·(1+cos Δ/φ)/(1+1/φ)`:
- `(r/R0)^−3` is the ejecta-thickness law (given: McGetchin, Settle & Head 1973).
- The cosine leans it downrange, for an oblique strike (A: 45°).
- `p0` is solved so that the expected count meets `SPLASH`.

Diamonds here are impact diamonds and obsidian is impact glass. **The star has no emerald** (see §6).

## 4. The tunnels as math: `world/undercone.js` (new, pure)

Baked to `data/undercone.js` as parameters (~10 KB), not voxels, with a chunk index `NET_BY`.

```js
node = { id, layer: "lava"|"old"|"works", kind, x, y, z, r }   // vent lode refinery mint mouth skylight chamber junction shaft oldtown bullroom depot
edge = { id, a, b, kind: "lava"|"ruin"|"works"|"haul"|"shaft"|"breach"|"flooded", phase: golden(id) }
```

**Nodes, by rule.**
- **Anchors:**
  - `vent`: the throat's foot.
  - `lode`: y −8.
  - `refinery`: over the lode at `SEA−FIB[7]` (41).
  - `mint`: the House's undercroft (54). The haul from the refinery is about 100 blocks, about half the √2 draft's.
  - `bullroom`: by the lode.
  - `oldtown`: behind the wall's *cliff* quarter (`theranQuarters`).
- **Wall mouths:** `FIB[3]` per wall quarter (15), set along the arc by the golden angle.
  - Each sits at `y = SEA+5+8·golden(k)`, at the first wall column with ≥ 5 of rock above it.
  - No mouth goes on a placement.
- **Ring mouths:** `FIB[5]` = 8 in the stoa's back wall at quay level (+3), at bearings `IMPACT.bearing + k·GOLDEN_ANGLE`. These are the network's sea gates on the main waterfront.
- **The cothon's rock-cut sheds** open into the works layer at their back galleries.
- **Cone mouths:** one on each contour ring (21, 34, 55).
- **Lava chambers** lie on a **Vogel spiral**, `r_k = s√k`, `a_k = k·GOLDEN_ANGLE`.
  - Spacing: `s = FIB[8]` under the cone (R 284 to the ring: about 70 nodes), `FIB[9]` under the lagoon (~60).
  - Depth under land: 8–13 under the surface (`top−FIB[5]−FIB[4]·golden(k)`), where `strata.js`'s tubes lie.
  - Depth under water: `floor−FIB[4]−3`.
- **Ruins:** a honeycomb on an 8-grid round `oldtown` and `bullroom`.
  - A cell is a room where `golden(hash) < exp(−(d/21)²)`.
  - The levels stack 4 apart: Çatalhöyük was rebuilt on itself (given).
  - **The caldera's collapse sliced the old town open**: its outer rooms open in section on the cliff, and these are its mouths.

**Edges.**
- Candidates: each node's `FIB[4]` nearest, in 3D.
- Cost: `|e|·κ(kind)·(1+max(0, g−G)/G)²`.
- Network: the minimum spanning tree, so every node is reachable.
- Loops: add a leftover candidate where `golden(eid) < 1/φ²` and its length ≤ φ·mean (a labyrinth, not a tree).
- Forced edges: vent–refinery (shaft), refinery–lode (the Talos lift), refinery–mint (haul), every mouth to its nearest node.
- Kind, by the layers it joins:
  - same layer: that layer's kind;
  - across layers within 5 horizontally: `shaft`;
  - otherwise: `breach`, a rough break of a tube into an old wall.
- Grade limits: lava `G = 1/φ`, works and haul `1/φ²`. A steeper edge becomes a helix of radius 5 round a junction.

**Swept sections** (`sweep(edge)` gives the centreline, one point a block; `section(kind, s)` gives the cross-section):

| kind | path | section | dress |
|---|---|---|---|
| lava | Hermite curve + meander `3·sin(2πs/34 + 2π·phase)` | ellipse, half-width 3, half-height 3/φ, floor cut flat; 3 clear | `basalt`/`blackstone`; a ropy floor of `basalt`/`polished_basalt` by `word(s)`; skylights where the cover is < 3 and above the sea |
| works, haul | straight | box 5×4 | `polished_tuff`, `smooth_basalt` floor, `tuff_bricks` arches every 8; rails with powered rails on `redstone_block` every 8; lanterns on chain; waxed copper |
| ruin | Manhattan steps; rooms entered from the roof | 7×7 rooms (5×5 inside) in a cave over the roofscape | `mud_bricks`, `white_terracotta` plaster, `red_terracotta` bands in the Fibonacci word; a ladder hatch over the hearth; benches on the north and east |
| flooded | lava path, all below `SEA−1` | lava | water and kelp: the drowned way |

**Rooms.**
- **Chamber:** an ellipsoid of 8·5·8.
- **Refinery:** a hall of 55×21×13: blast furnaces, hoppers, magma hearths, and the **Talōi** (static frames of waxed copper, pistons and chain) over the lode.
- **Vent:** a shaft of radius 5 to the crater, with a ring of soul campfires at its foot.

**Finds by `golden(cell)`:**
- shrine: bucrania;
- store: decorated pots;
- workshop: obsidian blades;
- burial: suspicious gravel under a bench.

**New math-figure blocks** (`carvings.js`):
- `plaster_bucranium`: two golden arcs, the horns.
- `ochre_word`: the red Fibonacci-word band.
- `twin_spiral`: back-to-back golden spirals. It recalls the labrys, but it is the faith's own figure.
- `star_iron`: a Widmanstätten plate.

**Plug-in.**
- **`lay.js deepChunk`** ends with `yield* tunnelChunk`. That calls `undercone.carveChunk(cx, cz)` (pure), which returns column runs of air or water and the dress sets. It yields every `columnsPerYield`.
- **Then `DEEP_BY` placements:** the refinery's machines, the ruins' furniture, the undercroft. **These must be laid after the rock**, because `deepChunk` fills every covered column's body with beds. Anything placed in the life pass under the skin is buried (M).
- **Mouths are life-pass vestibules**, 3 deep, with horns of consecration and a closed waxed `copper_door`. Under the surface skin there is void until the deep pass runs, 5 chunks out. The deep pass opens the vestibule's back.
- **`strata.js`** turns its noise lava tubes off inside the caldera.

**The lens** (`tools/theralens.mjs`): the same pure functions run over a sparse voxel set (~1,400² × 170).
1. The graph is connected (union-find).
2. A flood fill from `refinery` reaches every node and every mouth's outside column.
3. **No breach:**
   - no carved air beside any water voxel (sea, pool, cothon, canal, river);
   - cover ≥ 5 under water (over the dredged depth) and ≥ 3 under land;
   - openings (mouths, skylights, vent) only above `SEA`;
   - a flooded tube meets air only through horizontal faces, with air above the water.
4. **Headroom:** ≥ 2 over every walk-line floor.
5. **Grade:** a floor steps ≤ 1 block a block; each edge's mean grade ≤ its G; rails ≤ 1/φ².
6. **Nothing carved within 3 under another placement's floor.**
7. **Every mouth has a path** within 5.
8. **Ore counts** equal `LODE` / `SPLASH`, and no ore floats.
9. **Determinism:** the baked hash is stable.
10. **Per chunk:** ≤ 233 fills and ≤ 377 sets (A).

## 5. Mythos: why the Therans keep it

**The fall.** A star fell into the sea before memory, and the mountain grew over it. Pre-Kameni is a healed scar.

**The Old Ones** lived as at Çatalhöyük, in rooms entered from the roof, with horned benches facing the deep. They dug to the star and read in its banded grain **the golden law written in metal**.

This rests on one real fact. Earth's only natural quasicrystal, icosahedral and so built on φ, came from a meteorite (Khatyrka; Bindi and Steinhardt, 2009). So "our math is the religion" is literal: the Reckoning was first read off the Star, and the Library's oldest tablet is a `star_iron` slab on a lectern.

**The flood.** They took too much, and the caldera fell: the Cape Riva collapse already in `thera.js`. The sea drowned their town and cut it open on the cliff. The Greeks remember them as the **Telchines**, the first smiths, who were flooded for their envy.

**The heirs.** Their survivors swore **the Measure**, the faith's tenet "take no more than the sea gives" made law: the star leaves the mountain only through the Mint, at a fixed rate.
- Their inner order are the **Kabeiroi**: smith-initiates under the mountain, and protectors of sailors.
- Their machines are the **Talōi**. Like Talos of Crete, each has one vein, here the haul line: cut it and they stop.
- They call the star's metal *orichalc*, after Atlantis. The players are Atlanteans.

**The uncanny, never explained.**
- The open crater **breathes**: warm air from the refinery, seen at the Great Rite. That is the source of the faith's placeholder name, "the Breath".
- Lodestone compasses bow toward the lode.
- Once a year the Mint strikes one netherite block, the star's heart.

This lore goes in `world/theranlore.js`, outside the closure.

## 6. The League's HQ and Mint, and the economy

**The Koinon House: the cothon's twin.** It stands at `IMPACT.bearing` (261.8°), centred on the ring's quay line (§2a): half cut into the island, its twelve halls stepping up the slope, and half out on moles. Its sizes come from the cothon's own numbers:
- outer radius `round+sheds+quay` = **94 blocks**;
- a ring of **12 state halls** (`LEAGUE.STATES`), 38 deep;
- a counting court of radius 52;
- at the middle, where the cothon has its island, **the Mint**: a domed rotunda of radius 17 (add it to `civicDomes`).

It is Theran marble and gold, the treasury banded in stamped-metal blocks (*Critias*: "coated with orichalcum"). The undercroft at y 54 holds the strongroom, the haul's terminus and a lift.

In code, `city.js` gets the kind "Koinon house", set at `SEA+3` (it rides the same restamp), and `buildmod` builds it as one structure, like `cothon.js`.

**Emeralds to stamped metal.** A new `waterworld:mint_counter` block (`plateOf("gold", theranDie)`) opens a second book in `bank.js`. It sells Theran-stamped blocks for emeralds at `bankSells`, with the change paid in coin:

| stamped | worth (obols) | price with the keep | in emeralds (change) |
|---|---|---|---|
| copper | 9 | 10 | 1 (6) |
| iron | 72 | 79 | 5 (1) |
| gold | 936 | 1,021 | 64 (3) |
| netherite | 7,488 | 8,164 | 511 (12) |

**The stock is the Measure** (vision).
- Every month: `FIB[6]` copper, `FIB[5]` iron and `FIB[3]` gold blocks.
- Netherite: once a year, at the Great Rite.
- The stock lives in `ww:mint:<metal>` and is refilled by the `seasons` duty at the month's turn.
- No delivery if the haul's rails are cut (checked at 8 points).

The star has no emerald, so the Mint is where **the world's emerald becomes the star's metal**.

## 7. Build order and cost

1. **Lens baseline.** The numbers above are it.
2. **Footing rule, site scoring, the cone's skin.** Rebake; the library goes from 27,889 to ≤ 1,000.
3. **The cone ×1.5 and 287.5 m, the five-harmonic ring and its stoa, the cothon onto the ring line, the crater, the temple on the rim.**
   - One grown-town regrow, batched with the terraforming (D-006); not just a restamp, since the ring adds `city.js`/`ground.js` kinds.
   - Lens: cut and fill each ≤ the ring's 34; lagoon ≥ 140 blocks past each harbour.
   - Re-check that the cothon, skyways, pools, fairway and lagoon gap stay ≥ the fairway's width.
4. **The path refresh.**
5. **`impact.js` and the strata hook**, with the ore lens.
6. **`undercone.js`:** the graph and its lens, then the carving and the voxel lens.
7. **`tunnelChunk`, `DEEP_BY` and the vestibules.** Then `modtest/vox.mjs` on the 48-chunk cone, with the deep pass.
8. **The refinery, the Talōi, the Koinon House.**
9. **Ruin dressing, the finds, the new blocks.**
10. **The mint counter, the Measure, `theranlore.js`.**

**Cost (A, not timed):**
- **Bake:** the graph (~170 nodes, ~220 edges) under 1 s; the voxel lens 10–30 s; the House about the cothon's size.
- **Data:** ~10 KB.
- **Game:** 0–233 fills per chunk, only within 5 chunks of a player.
- **Grown towns:** one regrow (batched), for `thera.js`, `city.js` and `ground.js`.
- **Thera's own bake:** the cone's land is 2.3×, so its park, paths and houses grow by about that (A: the Thera part of the bake about 1.5–2× today's).

**The grown towns' closure.** I computed it with `sourceHash`'s own rule (M). It excludes `strata.js`, `theraplan.js`, `coinage.js` and `carvings.js`. Keep `impact.js`, `undercone.js` and `theranlore.js` out of it.

**What I verified:** the footing source and its volumes, the face shares, the dome sweep, the cothon's bearing, the closure, and the burial of life-pass structures under the deep pass.

**What I assumed:** the "diorite" reading, the historical citations (from memory), the runtime costs, the berth count, the water left past the Mint's edge, and that the towns outside Thera's reach regrow unchanged.
