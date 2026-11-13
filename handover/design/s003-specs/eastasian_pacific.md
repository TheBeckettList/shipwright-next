# Spec: East Asian, Japanese and Pacific hulls (S003)

Engineer for `east_asian` (sampan, junk, fuchuan), `japanese` (wasen, bezaisen, shuinsen), `pacific` (outrigger, voyaging canoe, drua).
Tags: **G** given, **V** vision, **D** derived. "px" = world pixel (1/16 block).

## 0. Verified in the code

- **Homes and seas.** Home latitudes come from `traditions.js` T through `climate.js`. Pacific ≈ 13° and East Asian ≈ 22° (the trades, 7 m/s); Japanese ≈ 33° (horse latitudes, on the edge of the westerlies). Design seas come from `sea.js` `seaState` (Hs = 0.21U²/g, fetch-limited, storm × 1.6):
  - working trades: Hs 1.05
  - inside CROSSING 320: Hs 0.42
  - trades storm: Hs 2.69
  - westerlies storm: Hs 5.48
- **Rounding.** `sizeOf` rounds B, depth and draft to whole blocks. The sampan, wasen, outrigger and voyaging canoe get depth 1 and draft 1, so **freeboard 0**.
- **Mast counts disagree** (`FLEETS` against `BOATS`): junk 3 against 2, fuchuan 5 against 3, shuinsen 2 against 3.
- **Depths disagree.** The fuchuan is drawn at side 0.75F ≈ 0.37B, but its law gives B/φ = 0.62B. The bezaisen and shuinsen are drawn "flat" but carry the keel law in FLEETS.
- **Twins have no crossbeams.** `hull_bones` joins the hulls with one 3 px slab across the mid sections. The spacing is 0.3L in the generator but φ²B in core `TRIAL.SPREAD`.
- **Floating parts.** I checked `boats3d.json` with a box-overlap graph (ε 1 px):
  - The twins' `ram` and sternpost `rudder` sit at x = 0, between the hulls, touching nothing.
  - The junk's, fuchuan's and shuinsen's masts are separate pieces: the junk's foot is at y 1.27, over an empty floor.
- **Rams.** All 9 types of mine are in `RAM_OF` as "beak".
- **Thickness and cost.** Hull boxes are 1–2 px thick. The launched models have 38 bones; the junk and fuchuan are 168 cubes, the twins about 350 (the whole shell is copied per hull).
- **Twin displacement.** `handling.js:103` doubles it for twins, which double-counts under §2's combined-beam reading.

Assumed, not verified: Hōkūleʻa's hull beam and iako size; Quanzhou planking (2–3 laminated layers, ~0.12–0.18 m, from memory); bezaisen internal scantlings.

## 1. The boats, their roles, their reach

| Type | Role | Reach | Needs |
|---|---|---|---|
| sampan | Harbour ferry and fisher, family afloat under a mat arch | inshore | Draught ≤ ½, scull (yuloh) |
| junk (shachuan, flat) | Coasting trader | **coastal** (was sea) | Hold, leeboards, dries out on mud |
| fuchuan | Fujian keeled ocean trader and war junk | ocean | Bulkheaded hold, castles, sweeps |
| wasen | Inshore fisher, sculled (ro) | inshore | Open boat |
| bezaisen | Edo coastal bulk (rice) carrier | coastal | Huge hold, one great sail |
| shuinsen | Red-seal ocean trader (1600–1635), a hybrid | ocean | Full deck |
| outrigger | Lagoon and reef fishing | inshore (dares coastal, bailing) | Ama to port |
| voyaging canoe | Island-to-island voyager, crew 12–16 (G, Hōkūleʻa) | ocean | Platform, shelter, sweep |
| drua | Fijian war and transport double canoe | sea / ocean | Platform, deckhouse, shunting |

I have no League routes to measure.

## 2. Size from the world's math

Keep `boatsizes.js`: B = L/lb; depth = B/φ (keel) or B/φ² (flat); draft = depth/φ, so freeboard f = depth/φ² (D). Changes:

1. **Don't round the hull.** Carry B, D and T to the px (V: rounding a 2-block beam breaks the law). Integers go only into `berthOf` (ceil).
2. **Bezaisen `flat:true`.** G: the Naniwa Maru replica is 30 × 7.4 m, height 27.5 m; its broad *shiki* bottom gives D ≈ B/φ². **The shuinsen stays keeled:** draw it as "carvel" with `keel=True`.
3. **Junk reach goes to coastal.** The flat shachuan coasts; the fuchuan does the open sea.
4. **Twins** (fitted to G: Hōkūleʻa, 19 m long, 5.3 m beam overall, 0.76 m draught, 12 t, eight iako; [archive.hokulea.com](https://archive.hokulea.com/build.html), [Wikipedia](https://en.wikipedia.org/wiki/H%C5%8Dk%C5%ABle%CA%BBa)):
   - Read FLEETS' B as the **two hulls' combined beam**; core `hullOf` already reckons displacement that way.
   - Each hull is b = B/2 wide, with D and T from B. So D/b = 2/φ: a deep V hull.
   - Hull centres are **φ·B apart** (today φ²B and 0.3L). Overall beam = φB + b = 0.28L, Hōkūleʻa's 5.3/19 exactly.
   - **Iako** = round(L/φ²) + 1 (Hōkūleʻa 8 ✓), evenly spaced on a centred platform L/φ long.
5. **Drua hulls** (G: Haddon & Hornell, *Canoes of Oceania*). The windward *cama* is smaller than the leeward *kata*. V: its section is b/φ by D/φ^½, at the same length (assumed).
6. **Masts** (G):
   - junk 2: main, and a fore raked forward
   - fuchuan 3: the Quanzhou ship, 34.6 m, three masts ([Wikipedia](https://en.wikipedia.org/wiki/Quanzhou_ship)). Five is the treasure-ship legend.
   - shuinsen 3, plus a bowsprit spritsail (Sueyoshi ex-voto)
   - **bezaisen 1, at L/√φ** (D). One mast carries the area main + fore would (φ × the main's); area goes as height², so the height grows by √φ. Naniwa Maru: 27.5/30.

| Type | L | B | D | T | f | f\* (L3) | Scale |
|---|---|---|---|---|---|---|---|
| sampan | 6 | 1.85 | 0.71 | 0.44 | 0.27 | 0.21 ✓ | 1 |
| junk | 16 | 4.92 | 1.88 | 1.16 | 0.72 | 0.52 ✓ | 2 |
| fuchuan | 33 | 10.31 | 6.37 | 3.94 | 2.43 | 2.09 ✓ | 4 |
| wasen | 7 | 1.56 | 0.96 | 0.59 | 0.37 | 0.21 ✓ | 1 |
| bezaisen | 16 | 4.27 | **1.63** | 1.01 | 0.62 | 0.52 ✓ | 2 |
| shuinsen | 33 | 9.71 | 6.00 | 3.71 | 2.29 | 2.09 ✓ | 4 |
| outrigger | 7 | 1.00 | 0.62 | 0.38 | 0.24 | 0.21 ✓ | 1 |
| voyaging canoe | 16 | 2.13 (b 1.07) | 1.32 | 0.81 | 0.50 | 0.52 hull | 2 |
| drua kata | 33 | 4.13 (b 2.07) | 2.55 | 1.58 | 0.97 | 0.52 hull | 4 |

Twins are closed hulls under a raised platform (§3). Each hull is held to the working sea; the iako lift the platform clear. The model scales stay as they are. **The fuchuan's drawn depth must rise from 0.37B to 0.62B**, and its poop then rises from that deck.

## 3. Structure (scantlings)

**Shell law** (D). G: Quanzhou planking of 0.15–0.18 m on 34.6 m is about L/199 ≈ L/φ¹¹. The shell is **t = max(2 px, L/φ¹¹)**, snapped to ½ px (V: 2 px is the least that reads as a plank edge).

- Small boats and L 16: 2 px.
- L 33: 2.5 px (the fuchuan today is about 1.1).
- `CON` becomes t(L). `th()` still divides by scale.

| Member | Size (V: golden steps of t, so the sheer reads) |
|---|---|
| gunwale / capping, deck beams, ama booms, shiki | φt |
| wale (half-log, 2 a side: junk, fuchuan, shuinsen) | φ²t |
| keel (fuchuan, shuinsen), sided × moulded | φ²t × φ³t |
| iako (square) | φ²t |
| bulkheads, deck and platform planking | t |

**Bulkheads** (G: Quanzhou, 12 making 13 compartments). Compartments = round(L/φ²) (34.6/φ² = 13.2 ✓): fuchuan 13, junk 6, sampan 2. Junks have no frames: the bulkheads carry the deck, and the masts step against a bulkhead's forward face in partners.

**Decks and castles:**
- **Fuchuan:** flush deck, a forecastle, a raised poop over the after third.
- **Shuinsen:** the same, plus a Western quarter gallery and stern cabin.
- **Junk:** full deck with hatches, and a poop cabin.
- **Bezaisen:**
  - an open hold under removable boards
  - *funabari* through-beam ends showing in 2 tiers
  - a lattice bulwark (*kagatatsu*) from midships aft
  - the mast in a tabernacle, lowered by the capstan aft
- **Sampan and wasen:** open, with thwarts.

**Steering:**
- Junk and fuchuan: a balanced, lifting, fenestrated rudder in a transom trunk.
- Bezaisen: a huge rudder in an open stern well.
- Pacific: a sweep (*hoe uli*) about L/φ³ long, over the aft iako at the starboard hull's stern. The shunting drua carries one at each end.

**Pacific joining:**
- The iako sit **on** both sheers, with a lashing turn at each, overhanging the outer sides by t.
- Slats (*pola*) lie on top, so the platform is at sheer + φ²t + t. A rail runs each side.
- The voyaging canoe's masts are stepped on the platform centreline, over an iako, stayed to both hulls.
- The drua has a deckhouse, and its mast foot sits in a socket so it rakes toward either end.
- The outrigger's two iako run to the ama, with stanchions down to it (connected today ✓).

## 4. The launched model, cheap

- **One mid bone, scaled in z** for length (planks run along z; the `ama` already scales this way); the ends are translated. That gives **≤ 12 bones** (today 38).
- **Merged slabs:**
  - mid: 3 strakes a side, bottom, gunwale, wale
  - ends: 4 slices × 4 strips
  - decks: 1 slab per level
  - castles: 3 boxes each
  - bulkheads: only in the building model, except one under an open hatch
- **Twins:** the second hull is mirrored. Each iako is 1 cube, the platform 1 slab, the rails 2.
- **Detail kept:**
  - junk and fuchuan: oculi, transom, wales, battens
  - bezaisen: the funabari ends, the kagatatsu (2 slabs)
  - Pacific: a lashing turn at each iako end
- **Targets** (hull and fittings; the rig ≤ 40 a mast set):

| Boats | Pieces |
|---|---|
| small | ≤ 90 |
| junk, bezaisen | ≤ 140 |
| voyaging canoe | ≤ 190 |
| fuchuan, shuinsen | ≤ 200 |
| drua | ≤ 240 (today 349) |

## 5. Engineering lens: testable rules

- **L1 Connectivity.** Every cube is within 1 px of the hull graph. Twins: hull → iako → hull. Outrigger: ama → stanchion → iako → hull. Fails today: the twins' ram and rudder, and masts with a floating foot.
- **L2 Single source.** The model's L, B, D, mast count and mast heights match `sizeOf` within ½ px. Fails today: the fuchuan's depth and the mast counts.
- **L3 Freeboard.** f ≥ f\* = Hs/2, the significant wave's crest (D):
  - inshore, home working wind at fetch CROSSING: 0.21
  - coastal, working wind: 0.52
  - sea, home storm, decked so Hs/φ²: 1.03
  - ocean, westerlies storm, Hs/φ²: 2.09
  - twins: each closed hull meets the working figure, and the platform underside is ≥ T + 0.52 above the keel
- **L4 Stability.** GM > 0 from core `hullOf` (twins at spread φB), and heel < HEEL_MAX at the reef wind.
- **L5 Shell.** Every hull cube's least dimension is ≥ max(2 px, L/φ¹¹); the gunwale is ≥ φ × that.
- **L6 Deck cover.** junk, fuchuan and shuinsen ≥ 1 − 1/φ⁴ (0.85) of L; bezaisen boards ≥ 1/φ; twin platform ≥ 1/φ.
- **L7 Bulkheads.** Junk and fuchuan have round(L/φ²) − 1. Every mast foot touches a bulkhead, a deck or an iako.
- **L8 Twin geometry.** Hull centres are φB ± ½ px apart. Iako = round(L/φ²) + 1. Each iako overlaps both gunwales by ≥ 1 px.
- **L9 Steering.** The blade reaches ≥ T below the waterline, and its pivot touches the transom, the stern well or the aft iako.
- **L10 Culture.** No `ram` is offered for these 9 types.

## 6. Culture

- **Wrong today:**
  - the beak rams (`RAM_OF`)
  - a sternpost rudder on the twins, which steer with sweeps
  - equal drua hulls
  - the flat shuinsen
  - the FLEETS mast counts
  - the bezaisen mast at L/φ: too short, and its sail was its signature
  - the 0.3L twin spread: too wide
- **East Asian:** flat transoms and bow boards; mat battened lugs (`rig_junk` ✓) with a sheet to every batten; oculi; a red-and-black poop; bamboo (`ships.js` ✓); leeboards on the junk.
- **Japanese:** cherry planks, iron *funakugi* nails; frameless tana strakes; the blade stem (`blade` ✓); the bezaisen's single white strip-sail (*matsuemon-ho*). The wasen and sampan are sculled at the stern (`scull`), not rowed.
- **Pacific:** sennit lashings (`string` ✓); end boards (`end_board` ✓); crab-claw sails; the ama to port; a thatched shelter; the drua's deckhouse and shunting rig.
