# Spec: European (rowboat, cog, carrack) and Indian Ocean (sewn boat, dhow, baghlah) boats

Paths from `/home/claude/sw/`. **[V]** means verified in the code or data. **[A]** means assumed or taken from memory of the historical record.

## 0. Why they read paper-thin and flat [V]

- **Thin.** `th()` divides `CON` by `SCALE`, so every shell is 2 px (0.125) in the world; the clinker cog's is 1 px. In `boats3d.json` the median smallest edge of the hull boxes is 0.061 on the cog and 0.113 on the carrack.
- **Flat.** `y_scale = 1 + 0.4(s−1)` squashes scale-4 hulls to 2.2x tall, and `medium()` sets the side height by a hand ratio. The model depth (`proportions.js` depth x y_scale) against `sizeOf`'s D = B/φ:
  - cog 1.71 vs 3.14
  - dhow 1.05 vs 2.64
  - carrack 3.30 vs 6.80
  - baghlah 2.06 vs 5.83
- **Decks.** The only deck is the `deck_full` module slab. `grid.js` puts black-box decks 1.5 apart, based on rail height.
- **Launched bones.** 38 bones, 27 of them empty `_keel`/`_frame` layers; 160 to 190 rotated cubes.

## 1. Roles, routes, needs

The distances are straight lines between people centres in `viewer/0.9.14/data.json` (cells x 128, x wrapped) [V]. Hull speed is 0.4·√(32 L), using the game's g = 0.08 x 20² (core/boat.js). A day is 1,200 s.

**European** (45 peoples: 27 peaceful, 15 traders; |lat| median 27°, reaching about 49°, into the westerlies) [V]
- **Rowboat** (inshore): ferry, fisher, ship's boat. 2–4 rowers.
- **Cog** (coastal: 3 hops = 7,680). Carries bulk to partner towns: median 2,468, max 7,150, so every route is in reach. A run is 0.23 day at 9.0 b/s. Needs a hold (11 chests) and 6 crew, no berths. Defends from the aftcastle.
- **Carrack** (ocean). The trade to Thera: median 86,232, max 133,882. That is at least 5.5 days (8.6 at worst) at 13.0 b/s. With 28 crew aboard for days she needs **berths and stores below**, so she needs a lower deck. Also 117 chests, guns through ports, and castles.

**Indian Ocean** (87 peoples, 60 of them traders; |lat| median 22°, the trades at 7 m/s) [V]
- **Sewn boat** (inshore): beach fishing and lighterage.
- **Dhow** (sea: 8 hops = 20,480). Partner trade: median 3,565, max 5,579, about 0.33 day a run. 5 crew, no berths.
- **Baghlah** (ocean). The Thera trade: median 39,782 (2.6 days), max 131,748. 23 crew and 82 chests, berths under the poop.

## 2. Size from the world's math

Keep `sizeOf()` (L = geometric mean; B = L/lb; D = B/φ; T = D/φ) [V], with these changes:

1. **Keep B, D and T to the pixel (1/16), not the block** (derived: the model is drawn in px). Today's rounding gives the rowboat D = T = 1, which is zero freeboard. Unrounded it is 0.95 / 0.59, a freeboard of 0.36. The sim can keep integers for berths.
2. **D is depth of hold, from the keel to the lowest full deck** (given: tonnage practice). Freeboard to that deck is D/φ².
3. **Decks come from the sea.**
   - Given: `seaState` (Pierson–Moskowitz) and `waveMax` (Rayleigh, x1.858).
   - Vision, the design wave by reach: ocean H_d = waveMax(Hs); sea and coastal H_d = Hs; inshore H_d = Hs at `harbour.js FETCH` = 34.
   - The belt: westerlies for European ships (10 m/s: Hs 2.14, Hmax 3.98); trades for Indian Ocean ships (7 m/s: Hs 1.05, Hmax 1.95).
   - Derived: weather decks above the hold deck n = ceil((H_d − D/φ²)/P). The bulwark makes up the rest of H_d, at least 1/φ.
4. **Deck pitch P = 2** (given: the player is 1.8 tall, plus a 3 px plank). The Mary Rose tween decks were about 1.8 to 2 m [A]. Change `grid.js DECK_HEIGHT` from 1.5 to 2.

| boat | L / B / D / T | freeboard D/φ² | H_d | n | bulwark | decks (blocks above keel) | sheer |
|---|---|---|---|---|---|---|---|
| rowboat | 5 / 1.54 / 0.95 / 0.59 | 0.36 | 0.28 | 0 | gunwale | open | 0.95 |
| sewn boat | 7 / 1.87 / 1.15 / 0.71 | 0.44 | 0.14 | 0 | gunwale | open | 1.15 |
| cog | 16 / 5.08 / 3.14 / 1.94 | 1.20 | 2.14 | 0 | 1 | deck 3.14, through-beams 2.5, aftcastle 5.14 | 4.14 |
| dhow | 16 / 4.27 / 2.64 / 1.63 | 1.01 | 1.05 | 0 | 0.62 | deck 2.64, poop 3.64 | 3.26 |
| carrack | 33 / 11.0 / 6.80 / 4.20 | 2.60 | 3.98 | **1** | 1 | lower 4.8, gun deck 6.8, upper 8.8, quarterdeck 10.8, poop 12.8, forecastle 10.8 | 9.8 |
| baghlah | 33 / 9.43 / 5.83 / 3.60 | 2.23 | 1.95 | **0** | 1 | lower 3.83, main 5.83, poop 7.83 | 6.83 (poop rail 8.45) |

This gives the historical result without anyone choosing it. The westerlies' tallest wave would board the carrack's gun deck, so she gets an upper deck. The baghlah stays single-decked with a poop, as dhows were.

**Castles** (lengths on φ):
- Carrack: sterncastle L/φ² (12.6) with a poop of L/φ³ (7.8); waist L/φ²; forecastle L/φ³, overhanging the stem by B/φ² (4.2). These sum to L, since 2/φ² + 1/φ³ = 1.
- Cog: aftcastle L/φ³ (3.8).
- Baghlah: poop L/φ² (12.6).
- Dhow: poop L/φ³ (3.8).

**Model scale** (derived) = L_typ / FIB[5]: cog 2, carrack and baghlah 33/8 → 4. These are today's values, now with a reason.
- **y scales like x and z** (drop `y_scale`).
- `TYPICAL_BLOCKS` (17, 34) should come from `sizeOf` (16, 33), with a test that they agree.
- New side heights in model px: cog 33 (today 19.5), dhow 26 (12), carrack 39 (24), baghlah 27, and 34 at the poop (15).

## 3. Scantlings

**Readable thickness** t(L) = 2 px x L/FIB[5], rounded to the pixel, never under 2 px.
- Given: 2 texels is vanilla's thinnest plate (glass pane, iron bars).
- Vision: a hull is seen whole from about its length away, so its plates should subtend at L what a pane does at 8.
- Result: rowboat and sewn boat 0.125; cog and dhow 0.25; carrack and baghlah 0.5.
- At scale = L/8 this is about 2 *model* px on every hull. **So `th()` stops dividing by `SCALE`, and `CON` becomes multiples of t:**

| member | rule | cog / dhow | carrack / baghlah |
|---|---|---|---|
| shell | t | 0.25 | 0.5 |
| wale, standing t/φ proud | φt | 0.40 | 0.81 |
| cap rail | φt wide | 0.40 | 0.81 |
| bulwark, castle walls (lighter upperworks) | t/φ | 3 px | 0.31 |
| deck planking | max(2 px, t/φ) | 3 px | 5 px |
| deck beams, through-beams (1 per block) | φt square | 0.40 | 0.81 |
| keel, frames (building model only) | φt sided; frames t x φt, 1 per block | | |

- The historical givens [A] are about 1/5 of these: the Bremen cog's oak strakes about 4–5 cm, the Mary Rose's planking about 10 cm with wales 2–3x as thick, dhow teak 4–6 cm. Five times is the Minecraft exaggeration, and it brings the hulls toward block-built ships.
- The mass still checks: the carrack's shell is about 960 m² x 0.5 x 600 ≈ 290 t, against ρLBT·0.6 ≈ 940 t displaced. At 31% that is a realistic hull share.

**Masts**
- Cog: on the keelson just forward of midships.
- Carrack: main on the keelson; fore through the forecastle; mizzen through the quarterdeck. Today's `mast_at` fits [V]. **Add the missing bowsprit.**
- Dhow and baghlah: main forward of midships, **raked forward** about 1/φ⁴ rad (8°); the baghlah's mizzen through the poop.
- `FLEETS` dhow `masts: 1` disagrees with the model's 2 [V]. Set it to 2 (the boom and sambuk carried a mizzen).

## 4. The launched model, cheap

- **Bones.** Keep `yaw`, `root`, `bow`, `stern` and `mid_0..6`, and put the cubes on the zone bones: **38 → 11 bones** for the same picture. Castles, poop and galleries go on `stern`/`bow`.
- **Per mid** (about 10 to 12 cubes):
  - a flat floor slab (unrotated) and one rotated bilge slab a side
  - one vertical topside slab a side; on the cog, 3 stepped clinker strakes a side instead, unrotated and offset t/φ (the logic of today's `panels()`)
  - wales: carrack 2 a side, the others 1
  - only the walked deck, one slab; lower decks are not drawn
- **Ends.** 4 slices on medium and large hulls (today 6).
- **Surviving detail, all of it culture:**
  - cog: through-beam ends
  - carrack: riders across the wales every 2 blocks (the chequer) and a port lid per mid a side
  - baghlah: transom windows and 2 quarter galleries
  - castle rails as single cubes
- **Texture, not cubes:**
  - coir stitching as a `_sewn` hull sheet (today's 0.5 px stitch cubes vanish at launch anyway)
  - white chunam bottom below T on the dhows, and a tarred bottom on the European ships, by per-face UV
- **Targets** (hull without rig; today 165–192):

| boat | cubes |
|---|---|
| rowboat, sewn boat, dhow | ≤ 120 |
| cog | ≤ 150 |
| baghlah | ≤ 190 |
| carrack | ≤ 220 |
| rig (each) | ≤ 40, counting only the active style |

  The carrack's `.rig` geometry holds 294 cubes today [V].

## 5. What the engineering lens should check

As `ship/tools/lab/hulllab.py`, reading the `boats3d.json` boxes and `sizeOf`:

1. **Law match:** L, B and D at typical length within 1 px of `sizeOf` unrounded. The px-per-block in y equals that in x.
2. **Thickness:** every launched `hull` box has its smallest edge ≥ t(L) − 1/32. Wales ≥ φt. Nothing under 2 px world except cloth and rope.
3. **Freeboard:** sheer − T ≥ H_d(reach, belt).
4. **Deck pitch:** decks (castles included) ≥ 2 apart.
5. **Deck cover:** every station between the ends has a walked-level slab that touches both shells within 1 px. Castles are L/φ² or L/φ³ long, within one station.
6. **Ports:** sills ≥ T + 1. Given: the Mary Rose flooded through ports set near the water when she heeled [A].
7. **Stability:**
   - KG from the launched cubes (the plan's wood density) plus ballast on the hold floor, up to ρLBT·C_B.
   - KB ≈ 0.53 T and BM = B²/(12T)·C_WP².
   - Require GM ≥ B/φ⁶ (0.056 B; given: sailing ships ran about 5% of beam [A]).
   - This catches a top-heavy carrack.
8. **Connectivity:** every launched cube is within 1 px of the hull graph rooted at the keel. Galleries touch the transom, beam ends touch the shell, castles sit on the sheer.
9. **Budgets:** the §4 cube and bone counts, replacing the flat 340/460 in `run.test.mjs`.
10. **Draught vs harbour:**
    - Quay depth ≥ T + 1 + shelf tide (0.6 x 2.5 = 1.5): carrack 7, cog 5.
    - Dhows and sewn boats drop the tide term: they take the ground at low water (given: careened and dried out on the tide [A]).

## 6. Culture

- **Cog.** Given: the Bremen cog of 1380, about 23.3 x 7.6 x 4.3 m [A].
  - Its L:B is 3.05 (ours is 3.15) and its D/B 0.56 (ours is 1/φ = 0.62), so the law fits.
  - Flush bottom, clinker sides, straight raked stem and sternpost.
  - Sternpost rudder with the tiller under the aftcastle (`HELM` is right [V]).
  - **Through-beams with their ends through the side** are its signature.
- **Carrack.** Given: the Mary Rose of 1511, keel about 32 m, beam 11.7 m, draught 4.6 m; hold, orlop, main and upper decks plus castles [A].
  - Tall overhanging forecastle, stepped sterncastle, wales crossed by riders, lidded ports, three masts and a bowsprit, square stern.
  - The whipstaff really stood *under* the quarterdeck. Ours on top is a gameplay concession; say so in the code.
- **Rowboat.** Transom, tholes, thwarts [V]: fine.
- **Sewn boat and dhow.**
  - Planks sewn with coir through drilled holes, wadded seams (the Jewel of Muscat, about 18 m, after the Belitung wreck [A]).
  - Double-ended, with a raked stem and a stem head above the rail.
  - A lateen yard longer than the mast.
  - Acacia stands for teak [V].
- **Baghlah.**
  - **Nailed, not sewn.** Plans.js says `rivets` [V]; keep the stitches off it.
  - A raked transom carved round a row of (usually five) stern windows, and quarter galleries.
  - A long poop over the great cabin; the main mast raked forward.
  - Oiled topsides, a white chunam bottom.
- **Wrong today** [V]:
  - `RAM_OF` gives the dhow, baghlah and sewn boat the League's three-bladed `fin` ram.
  - `ram_style` gives the cog, carrack and rowboat a `chisel` ram.
  - None of these ships rammed: remove `ram` from all six plans.
  - The dhow's mast count disagrees between FLEETS and the model.

**Verified vs assumed.** Verified: the code paths, measured numbers and route distances. Assumed: the historical dimensions (from memory), the GM rule of thumb, and the view-distance premise of t(L), which is vision.
