# The League (the Koinon): galleys sized by route, and their small craft

*League naval engineer. Measured from the world with `league()`, `network()`, `shipping()`, `islands().hops` and `core/boat.js` `hullOf`/`trial`, run read-only from scratch scripts. Speeds are game m/s (Froude-scaled), days are Minecraft days (1,200 s, the world's EAT clock).*

## 0. Findings that change the inputs
- **`D.M_PER_BLOCK` is 152.9 m, not 1,223.** 40,075,017 / 262,144 = 152.87. The comment in `core/given.js` (and the brief) still carries the 32,768-block world's figure. A Thera run of 104k blocks is about 15,900 km of Earth.
- **The League sits in the doldrums.** The island is at latitude −2.4°, with a mean wind of 1.5 m/s and Hs 0.05. Thera is at 36.8°, with wind 9.9 m/s, Hs 2.14 and a tallest wave of 5.3. The trade-wind middle of the route has 7.1 m/s and Hs 1.09. Oars are needed at the League's end and freeboard at Thera's end. **That is why the -remes are galleys, and why all three are large.**
- `shipping.js seaOf` counts `hops` as the straight distance to market divided by HOP, while its comment says "open water". Measured by island-hopping (the minimax gap over `islands().hops`), every League-carried route fits within the "sea" reach of 8 hops. Straight-line counting calls 39 of them "ocean".

## 1. The routes (measured)
| Route | What moves | Length (great circle) | Longest open leg (island-hopping) | Design sea Hs (windier end) |
|---|---|---|---|---|
| **R1 the Thera run**: a seat to Thera | the House's coin (`MINT`), kits, the Exchange's buys shipped home to the presiding seat | 98–108k (12 seats), 15 hops | **15,232** | 2.14 (Thera) |
| **R2 victualling**: continent markets to Thera (`theransMonth`) | the Therans' month: 41,878 items = **24.2 chests**/month | 9.6k–109k (median 50k) | median 9.6k, q3 13.3k, max 15.2k | 2.14 |
| **R3 carrying trade**: 67 peoples whose `route.carried` is "the League's ships" (norse 13, arctic 14, shallow 30, dugout 7, birchbark 3) to 21 hubs | others' goods | 3.3k–45k (median 22k) | median 13.3k, max 16.9k | q1 1.05, median 2.14 |
| **R4 the island round**: 12 seats, presidency circuit, `leagueMonth` levelling | ingots, kit stuff, wants | legs 3.4k–12.9k, ring 80k | ≤ 4.7k | 0.05–1.05 |
| **R5 inshore and harbour**: villages to their seat, ship to shore | three punt-peoples the League carries (33–43 cells), lighterage | ≤ 5.5k | — | 0.05 |

Five of the twelve seats are `shallow` (Thunderport, Shadeby, Starward, Deckhall, Anchorhold). They keep "landing" harbours built for punts (draft 1, depth 2). A great galley needs depth ≥ 2.8, so those seats need lighters (R5).

## 2. Size from the world's laws
Laws (B = L/lb, depth = B/φ, draft = depth/φ, freeboard = depth/φ², all from `boatsizes.js`):
- **Sea (derived):** freeboard ≥ the crest of the route's working sea, Hs/2. So **L_sea = (Hs/2)·lb·φ³**. Given: Pierson–Moskowitz, `seaState`.
- **Stores (derived):** crew × days × φ × s ≤ k × free hold.
  - days = longest open leg / (pull × 2^(−1/3) × 1,200). Given: galleys cross open water rowing *by halves* (Thucydides 3.49); half the power at P ∝ v³ is 2^(−1/3) of the speed. φ is a vision margin for contrary weather.
  - s = 0.015 m³ a crew-day. Given: about 8 L of water (a litre an hour at the oar; Morrison, Coates & Rankov, *The Athenian Trireme*, 2000) and a choinix of grain (Herodotus 7.187). Vision: amphorae fill 1/φ of the space.
  - free hold = L·B·depth·full / φ^banks. Vision: each bank of rowers takes a golden step of the hull.
  - k (vision): 1/φ with no cargo; 1/φ² for a carrier, leaving the rest for payload.
- **Galley ends (vision, with a given check):** a galley's ends are L/φ⁴, not L/φ³, because the rowers fill her. rooms = ⌊L − 2L/φ⁴⌋, one per block. rowers = 2·rooms·banks. marines = rowers/φ⁴. At L 37 this gives 156 rowers and 184 hands. Olympias carried 170 rowers and 200 hands with 0.888 m rooms (Vitruvius 1.2.4's two-cubit interscalmium).
- **Payload (derived):** the victuallers' hulls × trips a month × payload ≥ the Therans' 24.2 chests.

| Type | Route | L_sea | L_stores | **Range → typical** | B / depth / draft / fb | Rowers / crew | Pull / sail (7 m/s) | GM | Stores share | Payload |
|---|---|---|---|---|---|---|---|---|---|---|
| **Trireme** (month-ship) | R1 | 36.3 | 23 (k=1/φ) | **[36, 38] → 37** | 4.63 / 2.86 / 1.77 / 1.09 | 156 / 184 | 5.85 / 6.00 | 0.82 | 26% (limit 62%) | coin: 2,618 emeralds = 1.5 chests |
| **Bireme** (carrier) | R3 | 15.6 to 31.7 by route | ≤ 28 | **[30, 34] → 32** | 4.57 / 2.83 / 1.75 / 1.08 | 88 / 106 | 5.06 / 5.45 | 0.76 | 12% | 4.5 chests |
| **Monoreme** (victualler) | R2 | 27.2 | 14 | **[28, 30] → 29** | 4.83 / 2.99 / 1.85 / 1.14 | 40 / 51 | 3.96 / 4.81 | 0.80 | 4% | 8 chests |

- **Trireme 37** is set by Thera's sea; it matches the Olympias (36.9 × 5.45 m) and the Zea shipsheds (about 37 m; Blackman & Rankov 2013). Its round trip, 2 × 104k blocks at 5.5–6 m/s, takes **29–35 days: one Thera run a month**, in step with the mint and the presidency. The presiding state's trireme takes the coin out and brings the House's buys home.
- **Monoreme 29:** the sea and payload laws agree. At 8 chests a trip and about 1.7 trips a month, **two monoremes feed Thera**. The penteconter was the Phocaeans' long-haul trader (Herodotus 1.163); at L 36 the room law gives a true fifty-oar, if payload ever needs it.
- **Bireme:** each ship takes its route's length, L = clamp(⌈L_sea(Hs_route)⌉, 30, 34): 30 on calm southern routes, 32–34 for the norse and arctic runs. Given: the Phoenician merchant-warship (Sennacherib's reliefs, Nineveh, about 700 BC).
- The stores law never binds the carriers, and binds the trireme only on legs over about 40k blocks. So **the trireme must island-hop**; the lens routes it by `islands().hops`, not the great circle.
- **Model scale:** all three at scale 4, yardLevel 3, endLength 6. Today the bireme is scale 2 and the monoreme scale 1.

**Medium and small, by route and need** (the sea law at R4's windier seats, Hs 1.05):
| Type (tag) | Need | Route | Range → typ. | fb vs need | Rowers / crew | Pull | Historical source |
|---|---|---|---|---|---|---|---|
| **Hemiolia** (medium, *defence*) | harbour-mouth guard, pirate pursuit, convoy for the first hops of R1/R3 | R4, R1 approaches | [16, 21] → 18, banks 1.5 | 0.61 ≥ 0.53 | 36 / 43 | 5.39 (fastest after the trireme) | the "one-and-a-half": a pirate craft and the craft built to catch pirates (Casson, *Ships and Seamanship in the Ancient World* (SSAW), 1971, the Hellenistic galleys) |
| **Kerkouros** (medium, *logistics*) | inter-state coaster for ingots, kit stuff and the levelling between deep seats | R4 | [18, 22] → 20, lb 5, full 0.5 | 0.94 | 28 / 35 | 4.10 | the oared Levantine/Cypriot heavy transport, later in Ptolemaic service (Casson, SSAW) |
| **Keles** (small, *dispatch*) | the presidency's courier: seat to seat, out to the month-ship | R4 doldrum coast only | [8, 10] → 9 | 0.35: fails at Hs 1.05, passes at 0.05–0.08 | 12 / 15 | 5.25 | the fast single-banked "racehorse" (Thucydides 4.120: Brasidas crosses in a keles) |
| **Skaphe** (small, *tender/lighter*) | lighterage at the five shallow seats; ship's boat to the -remes; carries the diving bell (Bellwater's piece) | R5 | [5, 8] → 6, lb 3.25, full 0.55, oars only | 0.44 | 6 / 6 (ends L/φ³) | 4.57 | the ship's boat and harbour lighter (Casson, SSAW; Latin *scapha*) |

Rejected: the lembos (Illyrian, another culture's) and the trihemiolia (a large hull; the trireme already escorts).

## 3. Structure (scantlings)
Givens:
- Built shell-first: pegged mortise-and-tenon planks a few centimetres thick, frames after (the Kyrenia wreck; the Olympias).
- Oak keel for hauling ashore (Theophrastus, *Enquiry into Plants* 5.7.2); fir or pine planking (Minecraft spruce).
- Hypozomata (a stem-to-stern rope truss), the thranites' outrigger (parexeiresia), leather port sleeves (askomata), hide screens (Athenian naval inventories, via Morrison & Coates).

At Minecraft scale (vision: the true ~1/1000 of L is invisible), with world pixel = 1/16 block:
- **Shell t = max(2 px, round(16·L/φ¹⁰)).** Great galleys get 4–5 px (¼–5⁄16 block); medium 2–3; small 2. Nothing is thinner than 2 px.
- **Frames:** sided = t, one per room (1 block). The frame bay *is* the oar room.
- **Keel:** sided 2t, moulded 3t. **Wale / gunwale:** 2t. **Deck beams:** 1.5t. **Deck planks:** t. **Bulwark / screen:** t.
- **Trireme outrigger:** B/φ⁵ a side (0.42), which gives an overall beam of 5.47 (Olympias 5.45 ✓). Derived need: the thranite port row sits at 3/φ² = 1.15 above water, which is more than the freeboard of 1.09, so the third bank must ride outboard.
- **Port rows:** 1/φ² apart vertically, the lowest 1/φ² (0.38) above the waterline.

Decks: trireme full (cataphract); bireme a fighting deck with a shield rail (the relief); monoreme half-decks on its L/φ⁴ ends, a gangway, the hold between the benches; hemiolia half-decked aft, its aft benches clearing to strike the mast (Casson); kerkouros decked over ≥ 1/φ of L; keles and skaphe open. Masts are stepped on the keelson with deck partners, lowerable; the trireme adds the akateion forward (inventories). Two steering oars on every galley.

## 4. The launched model, cheap
Today each League galley's launched geometry has **38 bones and about 190 cubes** (trireme 190, bireme 192, monoreme 193).

Target bones: **≤ 6** — hull (static, merged), oars port, oars starboard (the only animated bones), steering oars, rig (sail toggle), pennant.

What is merged and what survives:
- **Hull:** strakes merged into 3 bands a side × length slices. The keel, wales and outrigger run as 3 segments each, and the deck is one slab per segment.
- **Oars:** 8 per bank-side, each a single cube with the loom and the blade on one UV. That is 48 cubes for the trireme, the same count as today's sample.
- **Detail that survives:** the three-bladed ram (3 cubes, Athlit-type), the bow eyes (2, *ophthalmoi*; given: the marble eyes from Piraeus), the aphlaston (2), the screens (2), mast and yard.

Cube budgets: **great ≤ 160, medium ≤ 110, small ≤ 50.**

## 5. Engineering lens (testable)
1. `fb ≥ Hs_route/2`. Use the unrounded depth − draft: `sizeOf` rounds B, depth and draft to whole blocks, so the trireme reads fb 1 < 1.07. Keep exact fields, or snap to the half block.
2. Stores: `crew·days·φ·s ≤ k·free`, using the island-hopped leg (`islands().hops` minimax).
3. `GM > 0` (`hullOf`) and `trial().winds[1].stands`.
4. Banks fit: `ceil(banks)·φ⁻² ≤ fb + outrigger lift`. Every oar cube passes through a port or a thole cut in the shell (no floating oars).
5. Connectivity: every cube touches the hull graph.
6. Shell ≥ t(L) (§3) in world pixels, measured from `boats3d.json` corners.
7. Deck share ≥ the type's figure in §3.
8. The ram's centre is within 1/φ² of the waterline.
9. `draft + 1 ≤` the seat's harbour depth, or the seat's fleet includes a skaphe.
10. Launched cubes and bones within §4.
11. The small types sail only where fb ≥ Hs/2: keles and skaphe on the equatorial coast only.

## 6. Culture, and what is wrong today
- **The -remes are the Koinon's common hull,** belonging to no member people: Mediterranean, shell-first, oak keel, spruce planks, bronze ram, painted eyes. The trireme is the presiding state's **month-ship**, flying its pennant and carrying the coin's strongbox.
- Default outfits from the twin pieces: trireme ram, full_deck, crossbow, lookout, navigation; bireme hold, bunk, navigation, iron_anchor; monoreme hold, iron_anchor; hemiolia ram, crossbow, lookout; kerkouros hold, full_deck; skaphe diving_bell.
- **Wrong today in `gen_boats.py`:** `GALLEY_STERN` uses `stem="norse_tall"` where a galley needs a fan-curled aphlaston. The trireme has no outrigger and no eyes. The monoreme has `ports=True`, but a penteconter rows on tholes at the gunwale. The `"carvel"` section reads right (flush), but its comment should say shell-first mortise-and-tenon.

## 7. What must change
**`world/boatsizes.js` `FLEETS.league`** (and its copy `ship/BP/world/boatsizes.js`):
```js
league: [
  T("keles","small",[8,10],6,0.42,"oars+sail","coastal",{galley:true,banks:1,role:"dispatch"}),
  T("skaphe","small",[5,8],3.25,0.55,"oars","inshore",{role:"tender"}),
  T("hemiolia","ship",[16,21],7,0.42,"oars+sail","coastal",{galley:true,banks:1.5,role:"guard"}),
  T("kerkouros","ship",[18,22],5,0.5,"oars+sail","coastal",{galley:true,banks:1,role:"coaster"}),
  T("monoreme","great",[28,30],6,0.42,"oars+sail","sea",{galley:true,banks:1,role:"victualler"}),
  T("bireme","great",[30,34],7,0.42,"oars+sail","sea",{galley:true,banks:2,role:"carrier"}),
  T("trireme","great",[36,38],8,0.4,"oars+sail","sea",{galley:true,banks:3,role:"month-ship",masts:2}),
]
```
- `sizeOf`: galley ends L/φ⁴; `rowers = round(2·rooms·(banks ?? 1))`; galley marines = rowers/φ⁴; keep the unrounded B, depth and draft.
- New `routeLength(type, {leg, Hs})` = clamp(max(L_sea, L_stores), range).
- New pure `leagueRoutes()`: the routes of §1, derived from `league()`, `network()`, `shipping()`, `islands().hops`, and `seaState(windAt)` averaged over a year. No literals.
- `typeFor` should be role-aware for the League.

**`ship/BP/scripts/config/plans.js`:**
- monoreme and bireme: `yardLevel: 3, modelScale: 4, endLength: 6, lengthStep: 2, largeAtLength: 0`.
- trireme: `lengthStep: 2`.
- Add `league_hemiolia` and `league_kerkouros` (yardLevel 2, modelScale 2, endLength 3), and `league_keles` and `league_skaphe` (scale 1; the skaphe has `rigFamily: null`). The FLEETS loop already maps `league_${name}`.
- `materials.js`: the league boat becomes "Keles".

**`ship/tools/gen_boats.py`:**
- monoreme and bireme go to `large(...)`.
- Add `medium` entries for the hemiolia (banks 1.5) and kerkouros, and small `dict`s for the keles and skaphe.
- `th()` becomes t(L) (§3) instead of `CON/SCALE`.
- Add the aphlaston stern, the outrigger, eyes, and tholes for single-bank galleys.
- Launched bone merge (§4).
- `gen_entities.py`, `gen_icons.py` and lang: the four new ids.

**`ship/tests/run.test.mjs`:**
- line 3284: the large list adds `league_bireme`, `league_monoreme`.
- line 3292: masts adds `league_monoreme: 1, league_bireme: 1`, and the trireme becomes 2 if the akateion is drawn.
- line 1270: 32 plans → 36, large 8 → 10 (update the message).
- The `medium` lookup at line 3293 then finds `league_hemiolia`.
- `newRecord(p,"k",36)` must clamp into the monoreme's [28, 30]. I assumed it clamps; verify.

*Verified in code and by running the scratch scripts: everything in §0–§2 and the model counts. Assumed: the historical figures as cited (page-level references not checked), and `newRecord` clamping. Mistake, now undone: running `tools/boatsim.mjs` regenerated `lab/boatsim.json`. I restored the original from `/tmp/orig` with its timestamp.*
