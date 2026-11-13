# Northern spec: the Norse (faering, longship, skeid) and the Arctic (kayak, umiak)

S003, from the code at `/home/claude/sw` (v0.9.14). *Measured* figures come from `seaOf()` over all peoples,
`hullOf`/`heelOf`, `boats3d.json` and the `.geo.json` files. *Given* figures are historical, from memory and
unchecked.

## 1. The boats, their work and their routes

**Measured.** 66 Norse peoples at latitudes 57 to 67: 48 faering fleets, 17 skeid (`raiders`), 1 cargo (also a
skeid). 39 sail their own routes of 1 to 7 hops (median about 4,000 blocks); the League carries 13 at 13 to 22
hops. A hop is 20 map cells, 2,560 blocks (`shipping.js` wrongly calls them chunks). 36 Arctic peoples: 33 kayak
fleets, 3 umiak; 22 reach market themselves (≤ 3 hops), 14 by the League. Four sit at −28 to −34 degrees, which
needs checking. The homes straddle 60 degrees: in the westerlies Hs is 2.1 m (storm 5.5 m), in the polar
easterlies 0.77 m (storm 2.0 m).

| Boat | Role | Reach | Needs |
|---|---|---|---|
| faering | fishing, ferrying, tender | inshore | 2–3 rowers, thole pins (*keipar*), no ports |
| longship (snekkja, Skuldelev 5) | coastal war and escort | sea, 2–3 hops | a room a metre, ports, square sail, beachable |
| skeid (Skuldelev 2, Roskilde 6) | flagship of 1–7-hop raids | sea, ≤ 17,900 blocks | every room manned, a deck, a tent, shields in port |
| kayak | lone hunter at the ice edge | coastal, under 1 hop | one cockpit, a shedding deck, gear on deck |
| umiak | families, goods, whaling | coastal, ≤ 3 hops | open, flat-bottomed, thwarts, rowed, small gut sail |

**Range.** At 13 blocks/s a skeid sails its longest route in about one Minecraft day. The crew beaches at night
under the tent, so it needs no berths, only a sea chest for each rower.

**Wrong in the code today:**
- `typeFor(norse, cargo)` gives the skeid. Norse traders sailed the knarr (Skuldelev 1), so use the `ship`
  class until a knarr exists.
- `harbourOf` sends the skeid to a quay, because no ship longer than 21 gets a naust. Norse ships were drawn up
  a beach on rollers, so send them to `beach`.
- `sizeOf` gives the kayak 2 crew; it should be 1.
- `sizeOf` gives the faering 6 rowers; it should be 3. Fix: below a beam of 2, one rower to a room, the rule the
  paddlers already follow.

## 2. Size from the world's math

**Why the ships are flat.** `sizeOf` rounds depth and draught to whole blocks (the longship gets B 2, D 1, T 1:
a freeboard of 0). The generator draws the large hull `y_scale(4)` = 2.2 tall against a breadth scale of 4,
and `SIDE_TRIM` takes off another 15%. *Measured:* the skeid's midship is **0.44 blocks** from keel to rail.
Keep every dimension fractional and round only the berths.

**The Norse law** (it replaces `depth = B/φ`, `draft = depth/φ`):
- **Depth:** `D = max(B/φ², φ·R)`, with R = ½ block (*vision*: the rail stands at least ½ block over the deck).
  *Given:* Norse B/D is 2.3 to 2.7 (Skuldelev 1, 3 and 5; Gokstad 5.2/1.95), and φ² = 2.62.
- **Draught:** `T = D/φ²`, so the freeboard is `D/φ`. *Given:* Gokstad draws about 0.75 to 0.9 m on a depth of
  1.95; these clinker hulls float light.
- **Deck:** it lies on the biti **at the waterline** (*given*: Gokstad). So rail over deck = D/φ ≥ R, which means
  D ≥ 0.81.
- **Rowerless ends:** `L/φ⁴` each, not `L/φ³`. *Given:* Gokstad has 16 rooms in 23.2 m and Skuldelev 5 has 13 in
  17.3 m, which leaves ends of about 0.15 L.

**The Arctic law.** Both boats use the flat form (hard-chine skin boats). The kayak's crew is 1. The umiak's L:B
becomes 4.75 and its range [10, 16]. *Given:* Greenland umiaks are 9 to 12 by 2 to 2.4 m.

| | L | B | D | T | FB | scale | today's model (*measured*) |
|---|---|---|---|---|---|---|---|
| faering | 6 | 1.41 | 0.54 | 0.21 | 0.33 | 1 | 1.63 × 0.89, keep |
| longship | 15 | 2.22 | 0.85 | 0.32 | 0.53 | 2 | 2.88 × 1.06, hand-set F |
| skeid | 33 | 4.40 | **1.68** | 0.64 | 1.04 | 4 | 4.4 × **0.44** |
| kayak | 5 | 0.77 (model ≥ 1, for the seat) | 0.29 | 0.11 | 0.18 | 1 | 1.03 × 0.51 |
| umiak | 13 | 2.74 | 1.05 | 0.40 | 0.65 | 2 | 4.2 × 0.72 |

**Stability (*measured*, `hullOf` flat).** GM is 0.89 for the longship, 1.76 for the skeid, 1.10 for the umiak
and 0.31 for the kayak. At 11 m/s beam-on the skeid heels 2.4° and stands.

**Crews.** The longship has 10 rooms and 22 crew; the skeid has 23 rooms and 51 crew.

**Model scale.** Keep 2 and 4: the longest model is 10 blocks × scale, so 2 covers 12–20 and 4 covers 28–40.
Changes in the generator:
- Derive `side` from the world depth: `(D·16 − keel)/y_scale`.
- Drop `SIDE_TRIM` for these boats: the deck now puts the player's eye over the rail.
- Build the longship through `medium("clinker", 6.75, …)` like the other medium hulls.

## 3. Scantlings (world px, 16 to a block)

**Historical sizes (*given*: Gokstad, Skuldelev):** strakes 2 to 2.5 cm (0.4 px), the waterline strake
(*meginhúfr*) about 4 cm, the keel about 0.37 × 0.22 m, frames one room (about 1 m) apart, the gunwale about
10 cm. Oar ports are in the top strake (Skuldelev 5, Oseberg; Gokstad's are in the 14th of 16). The mast steps
in the *kerling* (a keelson block over 4 frames) and is held by the *fiskr* (mast fish, about 5 m) on the biti.
Loose deck boards lie on the biti, with the shield batten inside the top strake.

The planking is under a pixel, which is why the ships look like paper. **The thinnest that reads (*vision*):**
`t(L) = snap½(√(L/8))` px, never less than 1. The eye takes the whole ship in at a distance proportional to
L but judges thickness against blocks, so take the geometric mean. That gives faering 1, longship 1.5,
skeid 2, umiak 1.5 and kayak 1. It replaces `CON/SCALE` in `th()`.

| Member | Rule | longship | skeid |
|---|---|---|---|
| strake | t, lapped **t outboard** of the one below, overlapping it by ≥ t | 1.5 | 2 |
| meginhúfr | 1.5 t | 2.5 | 3 |
| gunwale + shield batten | one slab, 2t × 2t | 3 × 3 | 4 × 4 |
| keel | moulded max(D/5, 2t), sided max(B/20, 2t) | 3 × 3 | 5.5 × 4 |
| stems | sided as the keel, moulded 1.5 × the keel | 3 × 4.5 | 4 × 8 |
| biti + deck | one slab 2t thick, top at the waterline | 3 | 4 |
| frames, keelson | building model only | 1.5 | 2 |

**Decks and masts.** One open deck over the biti, along the rooms (0.71 L). The skeid adds a raised steering
platform aft (*lypting*: one slab on two posts). If `full_deck` is fitted on a Norse hull, draw half decks fore
and aft (as on Skuldelev 1), never planking at the gunwale. The mast stands just forward of midships; draw the
fish on the deck (5 rooms long, 2t × 2t) as part of the rig bone.

**Arctic.** The skin is t/φ: 0.5 px on the kayak, 1 px on the umiak. The frame carries the thickness: gunwales
2t, chine stringers t, the kayak's coaming 1.5t proud of the deck, umiak thwarts 2t.

## 4. The launched model, cheap

- **Bones:** merge the launched `_keel`/`_frame`/`_plank` layer bones into their section. That leaves yaw, root,
  7 mids, bow and stern: **11 hull bones instead of 38**.
- **Oars:** one bone a side (`bank_l`/`bank_r`) holding every room's oar (2 cubes each), pivoted on the thole
  line. The stroke is a roll about that line (every blade dips together) plus a shift of at most ⅛ block. That
  is 2 bones in place of 8, and the skeid shows all 23 oars a side. Under sail, show a stowed bundle on the
  crutches instead (3 cubes).
- **Per mid (14 cubes):** 5 lapped strakes a side, the keel, 2 gunwales and the deck. Paint the ports on the top
  strake's texture, and two land lines inside each slab so the 5 slabs read as 16 strakes.
- **Ends:** 6 slices × 10 strakes, plus the keel run and a stem of at most 10 slabs: about 75 each.
- **Targets:** launched hull ≤ 240 cubes (today it is 195, with no keel, gunwale or ports). Adding the oars (92)
  and the rig (≤ 40) gives ≤ 380, against the test's 460.
- **Umiak per mid (10 cubes):** the flat bottom, 2 panels a side, 2 gunwales, a thwart and a rib pair.
- **Toggles on `moored`:** shields (`shields.js` already does this) and the tent (*tjald*) show only in port. The
  carved head shows at sea and is **struck in port**, as the old law said.

## 5. What the engineering lens should check

Measure everything in the world, from the `boats3d.json` corners.

1. **Connectivity:** every launched cube lies within t of the hull graph from the keel, and the stems touch both
   the keel and the strakes.
2. **Thickness:** every hull cube's least edge is ≥ t(L); the gunwale is ≥ 2t; the keel is ≥ max(D/5, 2t).
3. **Lands:** strake k+1's lower edge is outboard of strake k by t ± ¼ px, and they overlap by ≥ t.
4. **Depth:** keel bottom to rail matches `max(B/φ², φR)` within 1 px, and Norse B/D is in [2.0, 2.8].
5. **Deck:** the top is at the waterline within 1 px, it covers ≥ 1 − 2/φ⁴ = 0.71 L, and the rail stands
   ≥ ½ block over the deck.
6. **Stability:** GM > 0 (`hullOf` with the built depth), and the ship stands at `TRIAL.WINDS[2]` beam-on.
7. **Sea:** run `seaAt` in head seas at the home belt's working wind for `WAKE_KEEP` ticks: no green water in the
   polar easterlies, and green water on fewer than 1 in 13 (FIB[6]) encounters in the westerlies. First, make
   `seaAt`'s freeboard `depth − draught`; its `draught·(HULL_DEPTH−1)` disagrees with `hullOf`.
8. **Oars:** one port and one oar per room a side, 1 block ± 1 px apart, in the top strake, centred 0.3 to 0.6
   over the deck. The thole moves no more than t in the stroke. The faering has tholes and no ports.
9. **Steering:** a side rudder on the **starboard quarter** (`rudder_type` 0). *Measured:* the viewer draws the
   longship's and skeid's rudder on the centre line.
10. **Budget:** launched hull ≤ 240 cubes and ≤ 11 hull bones; oars ≤ 2 bones.
11. **Culture:** shields only when moored, the head only under way, skin thinner than frame, umiak floor flat
    for ≥ B/φ.

## 6. Culture

**Norse.**
- What to keep: iron-riveted spruce clinker, rowers on their sea chests (`deck_bench`, correct), a striped
  square wool sail, two-colour shields (32 a side at Gokstad) in port only, a side rudder on the starboard
  quarter.
- Stems: the `norse_tall` spiral suits Oseberg-style display ships, but the war ships had plain stems with a
  detachable head. Draw the spiral on the longship and the plain stem with a head bone on the skeid.
- Wrong today: the bronze "chisel" ram (the `RAM_OF` default), since the Norse had no rams; if a ram is fitted,
  draw an iron-shod forefoot (2 cubes). Also the centre-line rudder and `full_deck` at the gunwale.

**Arctic.**
- Kayak: the hard chine is correct. Add a raised coaming, painted deck thongs, and the harpoon, line tray and
  float on deck (1 outfit bone).
- Umiak: `ROUND["skin"]` = 2.2 rounds it like a bilge; use ≥ 4 for its flat floor. Its gunwale ends stand past
  the posts as horns. It is the women's rowed boat: make `FLEETS` (`paddles+sail`) and `rigFamily: null` agree
  with `propulsion: "oars"`, and add a small gut square sail at L/φ².
- A ram on a skin boat should be a bone keel shoe.

**Verified and assumed.** I verified everything *measured* and the code paths named (`sizeOf`, `th()`,
`medium()/large()`, `SIDE_TRIM`, `shell()`, `hull_bones(simple)`, `harbourOf`, `typeFor`, `seaAt`,
`shields.js`). The historical figures are from memory. The thickness law and R are *vision*.
