# Building the world: every town grown, laid by the gods

2026-11-13 · W (the world architect, with Claude) · plan for review, exported from the claude.ai doc of the same name.
The gods are the pantheon of `handover/design/pantheon.md` (PR "The pantheon, wave 0").

## In short

The world has **482 settlements** and about **119,000 folk** across ten traditions. Only **21** of them (8,692 folk,
7%) are grown towns: crystals grown street by street by `growth.js` and `district.js`, and they are the only towns that
already look right. The other **461** are boxed towns from `boxes.js townOf`, and those carry most of S004's faults:
buried houses, tall stilts and doors off the ground.

The plan is to **grow every settlement**. That can't be done the way the 21 are stored today. Each grown town is baked
as raw block columns, and at that rate the whole world would come to about **110 MB of add-on**. So the plan changes
what gets stored: **the plan, not the blocks**.
- A town becomes a list of placements, lanes, plots and pads.
- The ground comes from the S004 overlay law, T = clamp(h, pads).
- The game lays the buildings from their prototypes, as it already does for the boxed towns.

By estimate, and pending the prototype count in phase 2, the whole world's towns fit in **about 3 MB**.

It maps onto the pantheon:
- the **Grower** grows the plan, which is recorded and kept;
- the **Builder** lays it, as a shear undone by taking the pads away;
- the **Unmaker** keeps the ruins.

Order:
1. land S004's fixes;
2. build the overlay law;
3. prove that the 21 towns lay again from their plans;
4. batch every change that touches the grown towns' closure (Thera's ring, the terraforming);
5. grow all 482 once: about 13 CPU-hours, roughly 6½ hours on two cores;
6. the yards, then Thera's underworld.

Each phase stops for review.

## Where the world stands, measured

Counted from `settlements()` with the map loaded, and from `lab/grown`, on `stage/S003-R`.

| tradition | settlements | folk |
|---|---|---|
| indian_ocean | 87 | 26,487 |
| european | 44 | 23,905 |
| norse | 79 | 14,308 |
| pacific | 87 | 12,970 |
| east_asian | 24 | 12,655 |
| birchbark | 31 | 12,389 |
| shallow | 37 | 7,666 |
| japanese | 34 | 6,190 |
| dugout | 29 | 1,368 |
| arctic | 30 | 1,291 |
| **all** | **482** | **119,229** |

The largest settlements are three European cities (5,624, 4,625 and 3,679 folk) and an East Asian one (4,040).

**The 21 grown towns** are the ones nearest Thera.
- They hold 8,692 folk and 3,167 buildings, and took 56 minutes of CPU to grow: about 0.39 s a head, close to linear.
- In `lab/grown` they are 59 MB of JSON. The largest, Norse 3:18,3, is 298,591 block columns (9 MB).
- In the add-on they cost about 8 MB: 0.9.14 is 24.9 MB with them and 16.9 MB without.

**The 461 boxed towns** are houses in Fibonacci boxes placed by `buildmod place()`. Before S004 phase 0 they had:
- 122 shallow houses buried by more than 3 blocks;
- 342 houses on posts 8 or more high;
- 904 doors 2 or more blocks above the ground.

The grown towns pass every one of those checks.

## Store the plan, not the blocks

At 0.92 KB of add-on per head, 119,229 folk come to about 110 MB. Growing them at 0.39 s per head is about 13 CPU-hours.
The CPU is affordable, because the grow runs once and in batches. The size is not.

A grown town's columns hold three things:
- its buildings, `buildOf(id, t, seed, size, {slope, up, dense})`, a pure function of a few numbers;
- its ground, which the overlay law makes exact from h and the pads;
- its lanes and plots.

Store only what can't be derived:

| record | fields | world estimate |
|---|---|---|
| placement | proto, x, z, y (= L + 1), rotation | ~43,000 × 14 B ≈ 0.6 MB |
| pad | x0, z0, x1, z1, L, t, flags | ≈ 0.7 MB |
| lane | a polyline of cells, a width, a kind | measured in phase 2 |
| plot | a Fibonacci box, a decor kind | measured in phase 2 |
| proto | the voxels of one distinct `buildOf` key, shared | **the unknown** |

Terracing buildings add the slope's direction to their key, which could multiply the prototypes. Phase 2 measures this.
There are two fallbacks:
- quantise the seeds (FIB[7] = 21 seeds a kind, to start);
- ship `buildOf` to the game, trading add-on size for game CPU.

## Who builds what

The work is split by realm:
- the land row (a = +1) is the world stream's;
- the sea row is Richard's;
- the peoples row is shared.

| god | realm | in this build-out |
|---|---|---|
| the Builder (1,0), shear | land, holds | the overlay law (`world/terraform.js`); laying the plan; Thera's cone, ring, crater and footings; the Koinon House's fabric |
| the Grower (1,1), record | land, gives | growing all 482 plans; yards and curtilage; fields on the treads; the ore splash (`impact.js`) |
| the Unmaker (1,−1), record | land, takes | the Old Ones' tunnels and ruins (`undercone.js`); the drowned town; abandoned towns |
| the Reaper (0,−1) | peoples, takes | mining the lode; the haul to the Mint |
| the Trader (0,1) | peoples, gives | the Mint, the mint counter, `bank.js`'s second book |
| the Mover (−1,0) | sea, holds | harbours, the cothon on the ring line, berths: **Richard's** |
| the Bounty, the Toll | sea | fish pens, clam gardens, boat sheds in the yards; wrecks |
| the Measure (0,0) | frame | the lenses, the closure hash, the review gates |

A change that crosses a pair's shared line, such as the Builder and Mover's shore pads, is a PR that Richard reviews.

## The build order

Touching `cities.js`, `district.js`, `game/ground.js` or anything they import changes `sourceHash` and stales every
grown town. So **every closure change is batched into one grow** (phase 4).

| phase | god | what | gate | closure |
|---|---|---|---|---|
| 0. S004's fixes | Builder | the deep pass's fill capped under each base; stilts by the grown towns' rule (3 deep), on land too; PR #2 | the probe: buried 121 → 1, doors lost 280 → 0 on Thera | outside |
| 1. The overlay law | Builder | `world/terraform.js`, the `terraform` lens | the lens's checks: footprints at L, ground moved ≤ 5, banks, risers, no pits, cones meet, T ≡ h with no pads | outside |
| 2. The plan, proven | Grower | `bakegrown` writes plans; `tools/replay.mjs` lays the 21 from them and compares | building voxels identical; prototype count measured | outside |
| 3. Lay from the plan | Builder | `lay.js` stamps plans; `usePads`/`naturalAt`; median pads for Thera and the boxed towns | modtest clean; Thera flight ≤ 23.1 + 3 ms a chunk | restamp |
| 4. The one grow | Grower + Builder | `layPlace` on T; yards; Thera's cone ×1.5, ring, crater, new kinds; grow all 482 | every town passes terraform.md checks 1–4, 9; a render per tradition | **one grow, ~13 CPU-h** |
| 5. Thera beneath | Unmaker + Reaper + Trader | `impact.js`, `undercone.js`, `tunnelChunk`, refinery, Koinon House, mint counter, lore | thera.md §7's lenses | outside |
| 6. Calibrate | the Measure | `passes.mjs`, the calibration loop | terraform.md check 10 | outside |

## The open questions, answered with the math

| question | answer | why |
|---|---|---|
| Stilt depth? | **3** (`FIB[3]`) | the grown towns' own rule; two rules for one people would be a free number |
| Fix or replace boxed towns? | **replace, by growing** | the grown towns pass every check, and phase 4 removes `townOf` |
| A restamp per change, or one grow? | **one grow, batched** | 13 CPU-h once, rather than 13 CPU-h for every closure change |
| Grow order? | **nearest Thera first** | claims split the ground before growth, so order can't change the result |
| How much may a pad move ground? | **5 (8 carved)** | the outer slope's `FIB[4]`; the median minimises Σ\|h − L\| |

## Phase 2, first measurement (2026-11-13)

`tools/planprobe.mjs` grows chosen settlements as `bakegrown` does, writes nothing, and counts.

Two Indian Ocean towns, 248 and 209 folk:

| | 50:21,7 | 23:21,7 |
|---|---|---|
| placements | 95 | 84 |
| distinct prototypes | 95 | 84 |
| canted (not a right-angle turn) | 0 | 0 |
| building voxels | 108,690 | 90,499 |
| building share of what the town stores (blocks unlike the skin) | — | 69% |
| grow time | 113 s | 89–118 s |

Across the world:
- **kinds:** 311 building kinds over the ten peoples (about 31 a people);
- **`buildOf` (measured):** 3.8 ms and 857 voxels a building on average, in Node;
- **today's add-on:** already carries 1,889 prototypes (14.5 MB of base64) behind 33,360 placements, the boxed towns' way.

**What it means:**
- **Every grown building is its own prototype today.** Each takes its own seed, so storing a plan instead of blocks
  saves nothing until the seeds are shared.
- **Buildings are most of a town** (69% of its stored blocks). Trees, farms and streets are the rest, and they come from
  `layPlace`, which is a pure function of the plan.
- **Shared seeds put the world in today's budget.** With a fixed set of seeds a kind, the whole world's prototypes are
  bounded by kinds × seeds, whatever the number of towns:
  - 311 × 5 = 1,555 prototypes, about 11 MB raw;
  - 311 × 8 = 2,488 prototypes, about 17 MB raw;
  - today's library is 1,889 prototypes.
  The boxed towns' prototypes retire in phase 4 and free their share.
- **Terracing buildings** add the slope to their key, so their slope must be quantised too (four directions, a few
  steepnesses).
- **Both changes are in the closure** (`growth.js`, `census.js`), so they ride phase 4's one grow.

The plan stands, with fallback 1 (shared seeds) as the rule rather than the fallback. Shipping `buildOf` to the game
(3.8 ms a building in Node, likely several times that in the game) stays the second choice.

## Agreed on Olympus (2026-11-13)

- **The shore line** (the Mover, `0001609268-mover`): the line runs along the quay's face. What stands is land (the
  Builder's), including a mole to its tip; what floats is sea (the Mover's).
- **Stilts and fairways** (the Mover): a stilt floor may stand over water 3 deep or less, but never on a fairway.
  Phase 4 keeps φ × the widest berthing beam clear to every berth.
- **Shared seeds** (the Bounty, `0001609289-bounty`): every shallow and fishing kind may draw from the shared seeds.
  Reefs and wrecks are not buildings and stay out of the count.
- **Water fronts** (the Bounty): a building whose front is on the water faces the shore's normal, not its seed, so a
  quay row reads as one street. It goes into `growth.js` in phase 4.

## The towns regrown on S003's sources (2026-11-13)

The 19 settlements nearest Thera were regrown, since S003's peoples change had staled them. That's 11,648 folk:
- 18 towns: 7,023 folk, 2,657 buildings, about 50 minutes on one core;
- the European city 23:24,5: 4,625 folk, 1,501 buildings, 141 farms, **3,694 s**.

The city took 0.80 s a head, twice the towns' 0.39. **Growth is super-linear in a settlement's size**, so phase 4's
13 CPU-hours is low. The largest settlements (5,624, 4,625, 4,040 and 3,679 folk) alone are about 4 hours.

In blocks the city is 2.8 M blocks in 981,179 columns (32 MB of JSON); with it, the add-on is about 23.5 MB.

## For Richard

1. **The phase 4 window.** If S003's ship work touches the closure, it should land before the grow or wait for it.
2. **The shore line.** The cothon moves onto the ring's quay line, and the Koinon House stands half on moles.
3. **The plan store.** It changes how the add-on carries towns: decide once phase 2 has its numbers.

**Assumed:**
- grow time and add-on size scale linearly to the largest cities;
- the plan's size, above all the prototype count.
