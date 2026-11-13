# Inland and coastal canoes: dugout, birchbark, shallow (S003 spec)

Six hulls, all small or medium: **dugout / war canoe** (`dugout`), **bark canoe / freight canoe** (`birchbark`), **punt / flatboat** (`shallow`). None is a great ship (they cross open sea in others' hulls, `boatsizes.js`). The one-line verdict: **these boats should get truer, not bigger.** Only the flatboat is a timber hull that should get thicker. The canoes' problem is the opposite of "paper thin": they are drawn too deep, and today's whole-block rounding leaves them with no freeboard.

## 1. Roles, routes, needs

| boat | role | water it works (world data) | needs |
|---|---|---|---|
| dugout (Salish shovelnose / small canoe) | fishing, ferrying, poling up rivers | river mouths and streams; inshore water sheltered within ~27 blocks of fetch | 1–4 paddlers, no hold, beached |
| war canoe (Northern / Haida canoe) | raids, the potlatch voyages between villages, coastal trade | sheltered coast and straits, fetch up to ~109 in the westerlies (10 m/s) | 12–20 paddlers two abreast, a steersman, speed |
| bark canoe (hunting canoe up to *canot du nord*) | fishing, the trapline, the portage | **any stream 2+ wide** (`channelOf(Q≥34)` = 2×2): the only boat that goes up the creeks | 1–4 paddlers, light enough to carry |
| freight canoe (*canot du maître*) | the fur brigade, a people's long trade | the trunk rivers (`world/trunks.json`: 12 trunks, 51–168 map cells = 6.5k–21.5k blocks, median ~9.9k) and lakes, fetch up to ~170 | 12–14 paddlers, a bowsman and a steersman with long paddles, about a tonne of bales |
| punt | ferrying, fowling, the lagoon market | lagoons and marsh in the trades (7 m/s), fetch up to ~256; water ≤ 3 deep (`handling.js` pole `maxDepth: 3`) | 1 poler, passengers |
| flatboat (Ohio "broadhorn") | bulk downstream: a family, livestock, the harvest | trunk rivers hub to mouth, one way with the current, and great rivers | 3–4 hands (steersman, two sweeps, bow), a house |

## 2. Size from the world's math

**Keep** the `FLEETS` lengths and L:B (given, and true to the type) except the freight canoe. **Change two laws:**

**(a) Depth of an open hull with no keel = B/φ².** *derived.* `sizeOf` gives keel hulls B/φ and flat hulls B/φ². Canoes have no keel, and their stiffness comes from beam, not depth. Their historical depth:beam is 2.4–2.9 (canot du maître 1.7–1.8 m beam × 0.6–0.75 m deep; 16 ft bark canoe 0.85 × 0.33; big Northern canoes about 2 × 0.8–0.9; *given*: Adney & Chapelle 1964, Durham 1960, from memory) and φ² = 2.62. Add a `form` field: `"keel"` → B/φ, `"open"` or `"flat"` → B/φ². Set dugout, war canoe, bark canoe and freight canoe to `open`. `core/boat.js hullOf` takes the same switch (today its `flat` flag).

**(b) Stop rounding small hulls to whole blocks.** *derived.* `sizeOf` rounds B, depth and draft each to ≥1. The typical dugout comes out as B 1, depth 1, draft 1, which is **zero freeboard**, and the war canoe (L15) also comes out as depth 1, draft 1. Round to the pixel instead: 1/16, *given*: Minecraft's 16 px a block, the model's own quantum. Let `berthOf` take `ceil()` where it needs whole blocks.

Then (draft = depth/φ, freeboard = depth/φ², exact to 1/16):

| boat | L (range) | B | depth | draft | freeboard | today (`sizeOf`) | model scale |
|---|---|---|---|---|---|---|---|
| dugout | 6 (4–9) | 1.0 | 0.375 | 0.25 | 0.125 | 6×1×1, draft 1 | 1 |
| war canoe | 15 (12–20) | 1.875 | 0.6875 | 0.4375 | 0.25 | 15×2×1, draft 1 | 2 |
| bark canoe | 6 (4–8) | 1.0625 | 0.375 | 0.25 | 0.125 | 6×1×1 | 1 |
| freight canoe | **13 (12–14)** | 2.1875 | 0.8125 | 0.5 | 0.3125 | 15×3×2 | 2 |
| punt | 6 (4–8) | 1.3125 | 0.5 | 0.3125 | 0.1875 | 6×1×1 | 1 |
| flatboat | 15 (12–20) | 4.3125 | 1.625 | 1.0 | 0.625 | 15×4×2 | 2 |

- **Freight canoe range [12,18] → [12,14].** The canot du maître was 36–40 ft (11–12 m), held to that by bark sheets and by the portage: four men carry ~300 kg (*given*). The range floor stays 12 (the ship class's, *given*: Shipwright). The typical length, √(12·14) = 13, is FIB[6].
- **War canoe top 20** is the tree's limit (*given*: the largest cedar canoes, 18–20 m), so it must not grow. Thickness is in §3.
- **Flatboat top 20 is set by the river.** `riverAt` draws a trunk (8 wide, 3 deep, `RIVER.NAVIGABLE`) with bed depth `round(3·(1−(x/4)²))`. The lane 2+ deep (draft + 1, the `berthOf` rule) is 8·√(1−1.5/3) = **5.66 wide**. Since draft = B/φ³, a flatboat draws a full block at B = φ³ = 4.24, which is the typical L15 exactly. So the trunk carries flatboats up to 15. The 16–20 hulls (B up to 5.69, draft 1.375) need the great rivers (13×5, lane 3+ deep = 9.19 wide).
- **Freeboard sizes the reach** (*derived*, `seaState`): fb ≥ Hs/2 with Hs = 0.21U²/g·√(F/2000) gives the sheltered fetch F = 2000·(2fb·g/0.21U²)². In the home belt's wind (`VISION.BELTS`: dugout and birchbark peoples in the westerlies, 10 m/s; shallow in the trades, 7 m/s):
  - dugout and bark canoe 27 ≥ FIB[7] (inshore); war canoe 109 ≥ FIB[10] (coastal); freight canoe 170; punt 256.
  - flatboat 2,840, past `FETCH_FULL`: `reach: inshore` keeps it off the sea, not its freeboard.
- **Stability** (`hullOf`, run): GM/B = 0.40–0.44 for the canoes, 0.28 for punt and flatboat. Under the B/φ law small hulls fall to GM 0.10–0.19.
- **Crew.** Paddlers sit two abreast where B > 2 × 0.6 (*given*: Minecraft's player width), not where the rounded B > 2: a 15-block war canoe seats 14, not 7 in single file. Poles: a hand to each FIB[5] of length, plus a steersman on a ship (punt 1, flatboat 3; historically 3–5). Today's law gives the flatboat 14 polers.
- **Harbour depth.** These peoples beach, rack or land their boats (`KEEPING`), so `harbourOf` should ask `ceil(draft)` = 1 at the shore, not draft + 1. The site lands on the open beach, where canoe villages stand.
- **Model scale.** Scale 1 holds 10 blocks (7 × 16 + 2 × 24 px) and scale 2 holds 20, enough for all six; no scale 4. `medium()` should draw each hull from its own typical L, not the shared `MEDIUM_TYPICAL_LENGTH` 17, with depth argument 2/φ² = 0.764. Today the flatboat is drawn at 0.4 (half its depth) and the small dugout and bark canoe at side/F ≈ 1.2–1.3 (twice theirs).

## 3. Structure (world pixels, 1 px = 1/16 block = 6.25 cm)

Real canoe walls are thinner than one pixel. So the rule is **1 px is the floor for any skin, and 2 px for any rim seen against the sky** (vision: the edge is what reads at 16+ blocks).

| part | dugout / war canoe | bark / freight canoe | punt | flatboat |
|---|---|---|---|---|
| shell | carved wall **2** (given ~2.5–4 cm; today 3) | bark + cedar sheathing + ribs as one skin, **1** | sides 1 | sides **2** (2-in planks pegged to studs) |
| bottom | **3** (left thicker for wear; bottom:wall ≈ φ, consecutive Fibonacci) | 1 | 2 (cross-planked) | 2 on sleepers |
| frames | none: **thwarts** (spreaders) 1 × 2 at each mid, wall to wall | ribs 1 × 2 at half-segments (`half`); thwarts 1 × 2, one per mid (a 6 m canoe has 3) | none; a tread (floor slat) per mid | sleepers under the floor (hidden) |
| rim | gunwale 3 with an outward lip of 1 (the Northern rolled gunwale) | inwale + outwale + cap **2 × 2** (today 1.5), root lashings | cap 2 | **gunwale timber 3 × 5** (the hewn chine log, given 20 × 30 cm) |
| keel | **none** (today the `round` keel is 0, which is right) | **none**: no outer keel (today 1.5, which is wrong) | none (`keel=False`) | none |
| decks | open | open (small end decks under the stem caps) | open, a short **till** at one end L/φ⁴ | open bow and stern ends L/φ³ each; the **house** between |
| ends | dugout: blunt shovelnose. War canoe: scarfed-on carved prow and stern pieces | recurved stems, the ends sealed with gum | flat raked "swims" | flat raked scow ends |

- **Thicker and larger, per boat.** Canoes no: a log is not a ship. The dugout and war canoe walls go *down* to 2 while the bottom stays 3, and the bark canoe stays 1 with a 2 px rim. Punt no. **Flatboat yes**: gunwale timbers 3 × 5 and 2 px sides.
- **The flatboat's house** runs between the ends, L − 2L/φ³ (*derived*, the `sizeOf` end) = 0.53L, 7.9 blocks on L15. It is the full inner beam wide, its walls the side planking carried up, under a 1 px cambered roof with a 2 px ridge, ≥ 1.875 clear (*given*: the player is 1.8 tall). The steersman works the stern sweep from the roof; the two side sweeps (the "broadhorns") stand on its flanks.
- **No masts** on any of the six (drive: paddles or poles).

## 4. The launched model, cheap

Today's launched models are 167–201 cubes and 38 bones each (`RP/models/entity/*.geo.json`). Thirty of those bones are empty keel and frame groups, and each end costs 52–58 cubes.

- **Bones ≤ 12:** drop the empty keel and frame bones, leaving yaw, root, mid_0..6, bow, stern and one propulsion bone. (Assumed: the render controllers address `mid_k`, not `mid_k_plank`; check this.)
- **Merged slabs per mid:** canoe 7 (bottom, 2 bilge, 2 walls, 2 rims with the lip merged in). Punt and flatboat 5 (floor, 2 sides with the gunwale timber as the side's foot, 2 caps), plus 3 house pieces on the flatboat.
- **Ends:** swims are planar, so 4 cubes an end (today 52). Canoe ends: `END_SLICES_LAUNCHED` 6 → 4, keeping the stem's 6–8 timbers, which are the boat's face.
- **Detail that survives:** thwarts, the war canoe's end pieces, the recurve. Lashings and ribs go to the texture.
- **Targets (launched hull cubes):** punt ≤ 55, dugout ≤ 100, flatboat ≤ 95 with its house, war canoe ≤ 120, bark canoe ≤ 120, freight canoe ≤ 130. Lower the 340/460 test budgets to these once they are met.
- **Remove the war canoe's dead rig:** `masts=[(-0.2,1.0),(0.15,0.85)]` generates a 200-cube rig group, though the plan has `rigFamily: null`.

## 5. What the engineering lens checks (testable)

1. **Depth law:** |depth − B/φ²| ≤ 1/16 for `form: open|flat`, in both `sizeOf` and the model's `proportions.js` depth × beam.
2. **Freeboard:** fb ≥ 1/8 (2 px, the least that reads above the water), and the sheltered fetch F(fb, home-belt U) ≥ FIB[7] for inshore and ≥ FIB[10] for coastal, at the typical length.
3. **Stability:** GM > 0 from `hullOf`. For the flatboat, recompute KG with the house's mass (walls + roof at 1 px boards).
4. **River fit:** typical flatboat B ≤ lane(8, 3, draft+1) = 5.66 and draft ≤ 1; every flatboat B ≤ lane(13, 5) = 9.19. Bark canoe and dugout B ≤ lane(2, 2, 1) = 1.73 at the range top: they go up any stream.
5. **Pole reach:** punt and flatboat water depth ≤ `PROPULSION.pole.maxDepth` (3) on their designed water (the trunks).
6. **Connectivity:** every cube touches the hull graph within 1/32 block. The prow and stern pieces are plated to the stem (`stem()` does this today). Each thwart spans exactly inner wall to inner wall.
7. **Thickness:** no cube thinner than 1 world px. Rim cubes ≥ 2 px. Flatboat gunwale ≥ 3 × 5. Carved bottom ≥ carved wall.
8. **No foreign parts:** zero `keel` cubes on canoes (`boats3d.json` kind count), zero mast and rig cubes on all six, no ram style for canoes (see §6).
9. **Crew fits:** paddlers × 1 block of room fit between the ends (L − 2L/φ³), and two abreast only where inner beam ≥ 1.2.
10. **Headroom:** flatboat house interior ≥ 1.875.
11. **Budgets:** the piece and bone targets in §4.

## 6. Culture (and what's wrong today)

- **War canoe.** Wrong today: `stem="lug"`, `taper="blunt"`; the Northern canoe has a fine entry, a long raked overhanging cutwater and a separately carved, flat-sided prow piece, with a lower stern piece. Wrong today: `RAM_OF["war_canoe"] = "beak"`; these canoes never rammed, and the ram module (`sizes: ALL`, no tradition gate) offers copper rams to bark canoes too, so gate it off for these hull forms (lead's call). The hull was spread with steam and hot stones, held by its thwarts, and painted black with red and black formline on the end pieces (texture). `dark_oak` stands in for red cedar (*given*: traditions.js).
- **Dugout.** Blunt `lug` ends are **right** for the Salish shovelnose river canoe, so keep them. Add thwarts.
- **Bark and freight canoe.** Wrong today: the `bark` CON's 1.5 keel; bark canoes have none. Root-lashed gunwales (present), black gum on the end seams, painted ends. The freight canoe's `steering_oar` should read as a long steering *paddle* (the *gouvernail*), with a bowsman's paddle forward.
- **Punt.** Swim ends are right. Add the till.
- **Flatboat.** Wrong today: no house, which is its whole identity, and depth drawn at half. It drifted downstream and was broken up for lumber at the mouth. The ship scripts read no river current (no `riverAt` use in `ship/BP/scripts`), so the drift is a future hook. A **house** module is the natural "shallow" culture special; neither shallow nor dugout has one today.

**Verified in code:** `sizeOf`, `channelOf`, `seaState` and `hullOf` were run in node; `riverAt`, trunks.json, `harbour.js`, `gen_boats.py` (`CON`, `th`, `medium`, `BOATS`, `stem_curve`, `RAM_OF`), `plans.js`, `handling.js` and `modules.js` were read; geo cube and bone counts and `boats3d.json` extents were measured. **Assumed:** the historical dimensions (from the standard references, from memory, not checked online) and the render-controller bone names (§4).
