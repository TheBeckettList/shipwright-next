# Theran naval engineer: theran_skiff, theran_ship (catamaran), theran_flagship (trimaran)

*"Our math is the religion": on a Theran hull, every ornament also carries load.*

## 0. What is wrong today (verified)

I measured `viewer/0.9.14/boats3d.json`, taking every cube as an oriented box. Two cubes count as connected when a separating-axis test puts them within 1/32 block. The result is a list of pieces that hang together.

| boat | pieces | the floating ones |
|---|---|---|
| skiff | 2 | the whole rig. The mast foot (y 0.88) stands in an open hull and touches nothing. |
| ship | 7 | both wings and both tail fins, stepped in open hulls 0.19 above the bottom; the gold ram, on the centre line at z −15.8 between the bows; the steering oar, on the centre line aft |
| flagship | 4 | all three wings. Mast feet are 0.23–1.46 from any hull cube. |

The viewer doesn't show one more fault. `plans.js` gives the flagship `outrigger: true`, so the render controller (l.~1723 hides `ama` only for `twin`) also draws the Pacific float and its booms at 0.28 L. That lands about 0.7 block from her own float, so one float is drawn twice and clips into itself. `handling.js` `floatFitted` also counts it.

**Why they are flat.** Midship depth, keel to sheer, against the world's law (`boatsizes.js` B/φ):

| boat | depth now | law |
|---|---|---|
| skiff | 0.66 | 0.93 |
| ship, each hull | **0.57** | 1.85 |
| flagship main hull | **0.46**, shallower than her own floats (0.78) | 3.0 |

Four factors multiply:
- `medium()`/`large()` set `side = depth × F`, and F is the half-beam. That gives depth/beam of 0.42 and 0.375, not 0.618.
- `SIDE_TRIM[4]` = 0.85.
- `y_scale` = 1 + 0.4(hs−1) squashes height to 0.7× at scale 2 and 0.55× at scale 4.
- The keel starts 1 px up.

`PIERCE.drop` 0.32 also leaves the bow a sliver 0.1 tall. And the hulls are **open canoes**: only the pod and floats have `deck=True`, so nothing can step a mast.

**Why they lag.** Each `swept_tube` is 192 slabs (m16 × ring12).

| | ship | flagship |
|---|---|---|
| beams / floats | akas **804** | amas **864** (floats plus tubes) |
| nets | 128 | 86 |
| rig | 388 | 294 |
| hull | 417 | 177 |
| **launched total** | **≈1,750** | **≈1,450** |

That is 3–4× the 460 budget, plus three animated bones that are only geometry (`akas`, `nets`, `amas`: z position and a clamped z-scale).

## 1. Boats and routes

**World data.** `data.json` has 485 `thera` routes, one from every people (straight line, wrapped).

| Thera route | blocks |
|---|---|
| p10 | 27,067 |
| median | **69,682** |
| median weighted by trade | 67,179 |
| p90 | 121,608 |
| longest | 148,205 |

Partner routes have a median of 7,150.
- **Reach.** `shipping.js` puts "sea" at 5 hops × 320 = 1,600 blocks, so every Theran route is **ocean**.
- **Scale.** `D.M_PER_BLOCK` is really 152.9 m. The "≈1,223 m" in `given.js` and the brief is stale: it belongs to the 32,768 globe. A median run is about 10,700 km.
- **Sea.** Thera (36.4°) lies in the westerlies, 10 m/s. Hs = 0.21U²/g = **2.1**, a storm (×1.6) gives **5.5**, and Hmax over 1,000 waves is about 10.
- **Harbours.** `harbourOf` dredges each quay to its own fleet's draught + 1. Most quays are **2** deep, and only great-ship ports reach 3–5. Therans call everywhere.

| boat | role | needs |
|---|---|---|
| Foiler | tender, courier, chart runner, the flagship's boat (`deck_boat`); coastal | 1–2 crew, 1 chest; draught ≤ 1, foils up |
| Catamaran | "a Theran charter" (`shipping.js`): the brokered, tithed international freight; ocean | about 4 hands, berths, dry cabin; **draught ≤ 1**, so she lies at any 2-deep quay |
| Trimaran | Strongyle's envoy and flagship; ocean | about 13 hands, bridge, hold; draught ≤ 1.5. At 2-deep ports she anchors off and sends the foiler in. |

Defence is speed, stability and sealed cells, not arms (`THERAN_FIT`).

## 2. Size from the world's math

The givens are `FLEETS.therans` L:B (the fresco) and `sizeOf`'s laws. The multihull reading is **vision**: the fresco's B is the breadth of hull a crew needs, which a Theran splits into slender hulls and spreads apart. All else is **derived**.

| | skiff | ship | flagship |
|---|---|---|---|
| L (typical; range) | 6 (5–8) | 18 (14–22) | 34 (28–36) |
| B = L/lb (given 4/6/7) | 1.5 | 3.0 | 4.86 |
| hull beam b | 1.5 | B/φ = **1.85** each (L/b 9.7, the generator's lb 9) | main B/φ = **3.0** (now 3.46) |
| depth D = B/φ | **0.93** (now 0.66) | **1.85** (now 0.57: ×3.2) | **3.0** (now 0.46: ×6.5) |
| draught T | D/φ = 0.57 | D/φ² = **0.71** | D/φ² = **1.15** |
| freeboard | cockpit decked | **1.14** | **1.85** |
| overall beam | 1.5 | L/φ² = **6.9** (centres 5.1, as now) | L/φ = **21** (float centres ±9.6) |
| floats | – | – | L/φ = 21 long, b/φ = 1.85 wide, depth D (decks flush) |

Multihull draught is D/φ² (vision) because the displacement is split over slender, light hulls. The ship displaces 2·L·b·T·0.45 ≈ **21 t**, a real 18 m catamaran's.

With drive set to sail, `sizeOf` gives:
- crew L·B/13: 4 and 13;
- cargo L·B·D·full/13: 4 (+2 cabin) and 19 chests.

**Model scale:** keep 1 / 2 / 4, with these changes for the Therans.
- Make the root scale **uniform**: y = hs, not `y_scale`.
- Drop `SIDE_TRIM`; the raised bridge answers its reason.
- Generator inputs:
  - `theran_ship = medium("v", 9.7, 2.0)`: D = b, so depth is 2.0 in half-beams.
  - `theran_flagship = large("v", 11.3, 2.0)`.
  - Float side = main side, `ar` = b/φ.
  - Skiff `side` 15 px.
  - `PIERCE.drop` 0.2.

## 3. Structure

**Givens:**
- Uluburun (c. 1300 BC, ~15 m): about 6 cm planks, mortise-and-tenon. Source: Pulak.
- Kyrenia (14 m): 3.7 cm. Source: Steffy.
- So wood is about **L/250–L/380**.
- A composite catamaran skin is about 25–30 mm (my assumption).

Under 1.5 px a face shimmers at distance.

**Rule (vision): t = max(1.5 px, L/144)**, with 144 = FIB[12]. That is about 2× the givens, so it reads. It is in world px, so `th()` must not divide this floor by SCALE.

| | skiff | ship | flagship |
|---|---|---|---|
| shell, deck | 1.5 px | **2 px** | **4 px** |
| keelson (mast bed), sheer strake (gold, 2t tall, t proud) | 2t | 2t | 2t |
| frames, deck beams | not drawn launched | not drawn launched | not drawn launched |
| rail | toe rail 2 px | toe rail plus stanchion rail at 0.6 | same as ship |

**Decks.** Every hull is **fully decked** (sealed cells), drawn in the hull group because it is fixed.
- Skiff: a cockpit well, L/φ² long.
- Ship:
  - A **solid bridge deck** on the hull tops, L/φ² = 6.9 long, abaft midships, plate 4t.
  - On it the **ikrion** (the fresco's stern cabin) as the bridge, 2 blocks headroom (the player is 1.8).
  - A trampoline forward, L/φ³ = 4.25.
- Flagship:
  - Flush main deck.
  - A lower deck at the waterline (1.85 headroom).
  - A deckhouse/bridge L/φ³ = 8 long, abaft the main wing.
  - The ikrion aft.
  - Floats decked.

**The ship's centre bow** (the Incat wave-piercer) replaces the 0.74-wide pod.
- A nacelle under the bridge deck's front, out to the forward beam, D/φ² deep.
- Its keel is 0.43 above the static waterline; today's pod sits in the water.
- **The ram goes on its nose**: the centre line the code already uses.

**Beams.**
- Ship: two full-span crossbeams, hull deck to hull deck, D/φ³ deep, swept in a chevron. The forward one is L/φ³ from the bow; the aft one is at the bridge deck's after edge.
- Flagship: **two akas a side**, forward swept and aft straight, main deck to float deck.
  - Root depth D/φ³.
  - **Gull-wing arched** D/φ³ at mid-span.
  - Nets laced to four edges.

**Masts and wings.**
- Each mast stands on a keelson step (2t cube) and passes through a **gold deck collar** 2t thick.
- A **root fairing** closes the `wy = base + 0.1a` gap between the deck and the wing.
- The ship's wings and tail fins step on each hull's centre line, the fins at the aft beam.
- **Twin rudders** on the ship's transoms. Today `rx = −(F+2)` is not moved for `twin`.

## 4. The launched model, cheap

Merge static parts into the hull bones so they lengthen with `mids` for free. The animated `akas`, `nets` and `amas` bones go away.
- Bridge deck, nacelle, nets and the floats' mid sections go in the `mid_i` plank bones.
- The forward beams/akas and float bows go in `bow`.
- The aft beams/akas, ikrion and float sterns go in `stern`.

| part | ship | flagship | skiff |
|---|---|---|---|
| hulls (3 strakes a side plus deck, 6 end slices) | 300 | 150 + 2×60 | 140 |
| bridge deck, deckhouse, ikrion, nacelle | 40 | 30 | 4 |
| beams/akas (3 slabs × 3 segments, not 192) | 18 | 36 | – |
| nets (one textured 0.5 px slab plus 4 rods a side) | 10 | 10 | – |
| wings (8 stacked × 2 plus cap plus collar; now 54) | 4×18 | 3×18 | 18 |
| ram, rudders, foils | 20 | 18 | 22 |
| **total** | **≈460** | **≈440** | **≈185** |

For the flagship:
- Exclude `ama` when `tri`.
- Drop `outrigger: true`.
- Key righting off `tri`.

Detail kept: the gold sheer band, chevron ram, wing slot and cap, ikrion posts, and the net texture.

## 5. What the engineering lens should check

Run on the launched state (stage 5, fixed modules on) at mids min, typical and max, from a boats3d-style corner export.

1. **One body.** All hull + fittings + rig cubes are one connected piece (SAT, ε 1/32). Today this fails 2/7/4.
2. **Stepped.** Each mast foot overlaps a hull cube and crosses the deck plane inside a collar cube.
3. **Wing root.** The gap from deck to the lowest wing cube is ≤ 1 px.
4. **Depth.** Midship D ≥ 0.95·B/φ, and float depth ≥ D/φ.
5. **Freeboard.** D − T ≥ D/φ.
6. **Wet deck.** Bridge deck, akas and nets clear the waterline by ≥ **0.06 L** (designers' rule, assumed). Ship 1.14 ≥ 1.08; flagship arch 2.55 ≥ 2.04.
7. **Floats.** Each float's volume ≥ 100% of displacement (trimaran practice 100–250%). Flush floats give about 110%.
8. **Righting.** Δ·g·s/2 ≥ 2× the wing heeling moment at `VISION.STORM` × belt wind. Ship: about 520 vs 55 kN·m.
9. **Shell.** Every hull, deck and float slab ≥ max(1.5 px, L/144) in world px.
10. **Draught.** T + rudder ≤ 1 (ship) and ≤ 1.5 (flagship), against `harbourOf` quays.
11. **Placement.** Centre-line parts (ram, nacelle) sit on centre-line structure; per-hull parts (mast, rudder) at ±gap/2.
12. **Budget.** ≤ 460 launched cubes, and no animated Theran bone that is only geometry.

## 6. Culture

**Theirs:**
- White hulls veined in gold, with a fresco-blue band under the gold sheer.
- Spirals and dolphins at the bows.
- The **ikrion** (the Akrotiri Ship Procession fresco) as the deck saloon.
- The fresco's stern projection as the transom's swim step.
- Festoons on the wings in port.
- The glass lens on the wing cap ("Glass masthead").
- Mortise-and-tenon ("Tenoned seams").
- Kneeling paddlers as the ceremonial drive.

**Wrong today:**
- `FLEETS.therans` still describes the fresco's paddled boats (`oars+sail`, reach `sea`), so `sizeOf` gives the catamaran 18 rowers. It should be: skiff `sail+paddles`, coastal; ship and flagship **`sail`, `ocean`**.
- The flagship's `propulsion: "oars"` sweeps oars through her own nets and floats. It should be `paddles`, worked from the float decks.
- The header comment (l.82–84) describes one centre tail wing, but the code makes two canted fins.
- The ranges 28–35 and 28–36 should be unified.

**Verified:** every measurement, count, distance and code location above. **Assumed:** the multihull reading of B, the 0.06 L rule, float-volume practice, the composite skin, the fresco details, and that buy-only Therans keep beam = depth = 1 (`ship.js newRecord`).
