# The Pantheon: the sim's nine agents and the web between them

2026-11-13 · W (the world architect, with Claude) · exported from the claude.ai doc of the same name; wave 0 is now built (`core/pantheon.js`, the `pantheon` lens, `tools/pantheon-sample.mjs`)

## In short

The pantheon is **nine**, and the golden law picks the number, not us. F = [[1,1],[1,0]] acting on a pair of trits (the engine's own state, `core/field.js`) has exactly nine states. It holds one still, (0,0), and walks the other eight round a single cycle of eight ticks: the breath. F⁴ = −I then pairs each of the eight with its opposite, four ticks away.

So: **one Measure** at the still point, **eight gods** on the cycle, **four opposed pairs**. A god's two trits say *where* it acts (sea, the peoples, land) and *what* it does to the world's stock (takes, holds, gives). The rest of this doc follows from those two facts: who answers whom, how an update is stored, what reacts to it, how conflicts end. It uses only the engine's existing shears, records and gates.

Going all in on the sim (D-003) means the nine become the sim's runtime: the world is the nine taking turns, and Minecraft is one view of them. Each god also gets one Claude agent that builds and keeps its part of the code.

## Why nine: the derivation

The engine's state is trits, and its one law is F acting on pairs of them (`core/field.js`, `core/cycles.js`). A pair (a, b) with a, b in {−1, 0, +1} has 3² = 9 states. F sends each to the next:

```latex
F\begin{pmatrix}a\\b\end{pmatrix}=\begin{pmatrix}a+b\\a\end{pmatrix}\pmod 3
```

Run on all nine (checked in Node, 2026-11-13), F splits them into exactly two orbits:

| orbit | length | states, in F's order |
|---|---|---|
| the still point | 1 | (0,0) |
| the cycle | 8 | (1,0) → (1,1) → (−1,1) → (0,−1) → (−1,0) → (−1,−1) → (1,−1) → (0,1) → back |

Three facts the engine already relies on fall out of this:

- **The cycle is the breath.** Its length 8 is the Pisano period mod 3, the clock's `breath` rung (`core/clock.js`). One god per tick, every god once a breath.
- **Opposites are half a breath apart.** F⁴ = −I mod 3 (`handover/MATH.md`, the globe's lost sign). Four steps from any god is its negative: four pairs that sum to (0,0).
- **The centre never moves.** F(0,0) = (0,0). The Measure is the one state the law leaves alone, so it is the one that judges rather than acts.

Other numbers were considered and lose on structure:

| count | where it comes from | why not |
|---|---|---|
| 5 | a Fibonacci number | no pairing, no cycle, no centre |
| 8 | Pisano mod 3 alone | the cycle without its still point: nobody keeps the balance |
| 12 | the League's six twin pairs | twins but no law-given order; 12 is chosen, not derived |
| 13 | Fibonacci, used for quarters and explorers | no group structure behind it |
| 27 | trit triples, 3³ | F is 2×2; a third trit has no law acting on it |

Nine is the only count where the number, the pairs, the turn order, the centre and the schedule all come from the one law.

## The nine

A god's first trit **a** is where it acts: −1 the sea, 0 the peoples (what is carried and decided between), +1 the land. Its second trit **b** is what it does to the world's stock: −1 takes, 0 holds, +1 gives.

The second trit also fixes the god's kind of op, from `core/reversible.js`:

- **b = 0, a shear.** It moves or shapes without exchanging anything, so it runs back exactly with no memory. These are the two gods of form and motion.
- **b = ±1, a record.** It exchanges with the world, and the wake keeps what moved. These are the six gods of giving and taking.
- **(0,0), the frame.** The Measure owns the pulse and the clock, which every op reads and none writes.

Slot is the god's tick within the breath, in F's order from the Builder. A god's title (the Builder, the Toll) says what it does; its name, in brackets, is explained in the next section.

| slot | god (after) | (a, b) | domain | op | its rung | today's files it owns | stream |
|---|---|---|---|---|---|---|---|
| — | **The Measure** (Nereus) | (0, 0) | the clock, the pulse, balance, judgement | frame | breath close; day; year | `core/` field, cycles, clock, reversible, gates, tempo, lod, given; `world/` history, society, continuance, observer, budget, faith, temple | shared |
| 0 | **The Builder** (the Kabeiroi) | (+1, 0) | what stands: buildings, towns, ways, the shaped ground | shear | month | `world/` architecture, building, census, periodic, rooms, roomvox, dwelling, grammar, forms, pinnacle, district, growth, cities, settlement(s), boxes, towns, roads, decor, carvings, palette, quadric, city, theraplan, theracity, homeport; `game/` cothon, skyway, theranciv; the terraform overlay | W |
| 1 | **The Grower** (Aristaeus) | (+1, +1) | what the land gives: ground, climate, crops, timber, ore | record | day, month | `world/` map, islands, climate, biomes, rivers, stones, solar, farms, jobs, peoples (resources), thera (the natural island), homesites (lode); `game/strata.js`; `impact.js` (new) | W |
| 2 | **The Bounty** (Amphitrite) | (−1, +1) | what the sea gives: stocks, reefs, spawn owed back | record | month | `world/sealife.js` | R |
| 3 | **The Reaper** (Diktynna) | (0, −1) | what the peoples take: catch, harvest, mining, raids, war | record | month | `world/pirates.js`; the raids, war and harvest in `economy.js` and `jobs.js` | shared |
| 4 | **The Mover** (Oceanus) | (−1, 0) | what moves: wind, tide, waves, currents, hulls under way | shear | tick | `core/` wind, sea, globe, boat; `world/` boatsizes, explorers, shipping (routes); the ship module | R |
| 5 | **The Toll** (Poseidon) | (−1, −1) | what the sea takes: wear, storms, wrecks, bleaching | record | month, voyage | `world/ships.js` (wear); the sea's toll and wrecks in `trade.js`; harbour damage | R |
| 6 | **The Unmaker** (the Telchines) | (+1, −1) | what the land takes back: decline, ruin, materials returned | record | month | building decline in `world/buildings.js`; ruins, moves and refounding in `economy.js` and `settlement.js`; the Akrotiri and under-cone ruins | W |
| 7 | **The Trader** (Melikertes) | (0, +1) | what the peoples give: trade, coin, markets, the folk's day | record | month, beat | `world/` trade, economy (ledger), league, coinage, shipping (demand), folk, living, dress, names, looks; `mod/scripts/bank.js` | shared |

The rows match the two streams already working: the land row is the world architect's (W), the sea row Richard's (R). The peoples row and the Measure are shared, as `core/` already is.

## The nine, named

Each god takes the name of a Greek sea-power, since the Aegean is Thera's own sea, and answers to other names in the world's other maritime traditions. That is already the faith's rule, "one faith, many ways" (`world/faith.js`): every people keeps the same nine, in its own way and under its own names.

| god | Greek name | why this one | in other maritime traditions |
|---|---|---|---|
| the Measure | **Nereus**, the Old Man of the Sea | Hesiod's eldest son of the Sea: truthful, gentle, never forgetting what is right. The judge who does not act. | **Varuna** (Indian Ocean): upholder of ṛta, the cosmic and moral order, and lord of the waters. **Mazu** (East Asian): protector of fishermen and sailors. |
| the Builder | **the Kabeiroi** | Smith-gods of Lemnos and Samothrace, sons of Hephaestus, called on by sailors in danger; their mother Kabeiro was a daughter of Nereus. The Thera spec already makes them the Therans' order of smiths. | none checked yet |
| the Grower | **Aristaeus** | The island god of Ceos, Sardinia and Sicily who taught olive growing, beekeeping, cheese and herding: the yards and terraces S004 plants. | **al-Khidr** (Indian Ocean coasts): "the Green One", a saint of sailors, named for barren ground turning green where he sat. |
| the Bounty | **Amphitrite** | Queen of the sea, mother of its fish, seals and dolphins. | **Sedna** (Arctic): mother of the sea animals, who gives them or withholds them. **Tangaroa** (Pacific): god of the sea and its fish. **Njörðr** (Norse): sea, wind, fishing and wealth. |
| the Reaper | **Diktynna**, Lady of the Nets | The Minoan goddess of Crete, Thera's neighbour: patron of hunters, fishermen and sailors, named for the net. | **Ebisu** (Japanese): patron of fishermen and tradesmen, with his rod and sea bream. |
| the Mover | **Oceanus** | The world-river that runs round everything: current, tide and wind. | **Ryūjin** (Japanese): the sea dragon whose two jewels make the tide ebb and flow. |
| the Toll | **Poseidon** | The earth-shaker and raiser of storms. | **Rán** (Norse), whose net takes the drowned. **Mishipeshu** (bark-canoe, Anishinaabe): the underwater panther who raises storms on the Great Lakes and guards their copper. |
| the Unmaker | **the Telchines** | The sea-born smiths of Rhodes, who blighted the fields with Styx water and were drowned for it. The Thera spec already makes them the Old Ones whose town the caldera swallowed. | Thera's own; none sought |
| the Trader | **Melikertes**, called Palaemon | The harbour god sailors called on, whom the Romans equated with Portunus, god of harbours. His name may come from Melqart's, though scholars dispute it. | **Melqart** (Phoenician): Tyre's god of trade and colonies, given a temple in each new colony. **Komokwa** (great-dugout, Kwakwaka'wakw): the "Wealthy One" or Copper-Maker, master of the seals. |

Two cautions:

- **Several of these are living traditions.** Sedna, Komokwa, Mishipeshu, al-Khidr, Mazu, Varuna and Ebisu are honoured today. The game should let each people name its own figure at its own shrines, never recast that figure as a Greek god. Indigenous figures need the same care and review the north-west coast's clan names already get (`world/names.js`).
- **Two traditions have no counterpart yet:** the shallow-water stilt villages and the Europeans. Those are Richard's to choose.

Each name was checked against search results for the pages listed under Sources; the pages were not read in full.

## The web

The web has three kinds of edge, and all three come from F; none is designed.

_(a diagram of the web: see the doc)_

Read the drawing clockwise from the top. Opposite boxes are opposite gods, and each dashed line runs through the Measure because a god and its opposite sum to it.

- **The reaction, F (the ring, 8 edges).** Each god answers the one before it, one tick later.
- **The counter, F⁴ = −I (the dashed lines, 4 pairs).** Each god's opposite answers four ticks later. The pair shares one ledger.
- **The audit (every god to the hub).** The Measure reads every entry at the breath's close.

The other powers of F (F², F³ and so on) are the same ring read further on: a god hears the god two before it at two ticks' remove, at the size ψ² gives.

**The cycle tells a story, and the story is the world's own.** The Builder raises a harbour town. The Grower answers with yards and fields round it. The Bounty's fishing ground is worked, and the Reaper takes the catch, and a raid drawn by the wealth. The Mover carries the ships, and the Toll takes its share in wear and wrecks. The Unmaker returns what was lost to the ground as ruin and salvage. The Trader sells the salvage and the surplus, and the Builder builds again. F's order was not chosen to tell this; it is what F does to (1, 0).

## How updates are stored

Every change any god makes is one **wake entry**, 20 bytes of integers. The web is not stored anywhere else: who reacts, who owes whom and who audits are all read off these entries.

| field | type | what it holds |
|---|---|---|
| t | Int32 | the tick (a year is 8,640,000, well inside) |
| god + op | Int16 | the writer's slot 0–7, or 8 for the Measure (its (a, b) follows), and shear or record |
| key | Int32 | what was touched: an index into the key table (`namespace:id`, such as a stock, a cell, a building or a hull) |
| d | Int32 | the amount: fixed point for what moves (`Q` = 2¹⁶ a block), whole items for goods, a trit for a claim |
| cause | Int32 | the entry this one answers, or −1 for a first act |
| gate | Int16 | the verdict that chose it (`core/gates.js`), so every act keeps its reasons |

**Two layers, as in ****`core/cycles.js`****.** *Stocks* are integers (items, fixed-point amounts), changed only by records, as deltas. *A claim is a god's vector on a cell; the cell's state is one trit*: +1 given to a use, 0 held as it is, −1 being cleared. The pulse drives the claims and never reads them, so a tick runs back exactly.

**Memory follows from b.**

- **The b = 0 gods store no wake.** A shear is undone by subtracting what it added. The Mover's sea is a closed form of (place, tick) and stores nothing at all.
- **The six b = ±1 gods store their entries**, because a record can only be undone by giving back what it took.
- **The Measure stores the pulse and the record:** a few hundred trits.

**Folding.** Entries stay whole for `WAKE_KEEP` = 2,400 ticks (300 breaths, two minutes; `core/given.js`), and any tick in that window runs back to the bit. Older entries fold into per-key sums, rung by rung: breath, day, month, year. Folding is where a loss becomes real (`s.lost` in `core/reversible.js`), as it is today. So whole days, months and years still run back, as sums.

**No routing table.** An entry written by god v is read by F·v on the next tick and by −v four ticks later. Both are computed from the writer's slot, so nothing about the web needs storing.

## Actions and reactions, from the storage

An action's kind is its writer's (a, b): sea, peoples or land, crossed with take, hold or give. There is no other kind, so every act in the world is typed before it is written.

1. **Ownership.** Every key has one owner, the god whose domain holds it. Only the owner may shear it. Any god may write a record on it, across rows: that is how the sea reaches the land.
2. **Who reacts.** An entry written by v at tick t is answered at t + 1 by F·v, the next god round the cycle. The answer is a new entry whose `cause` is the first.
3. **How big.** F has two eigenvalues, φ and ψ = −1/φ. The expanding one is growth; the contracting one is the reaction. A reaction may move at most ψ times its cause: the opposite sign, 0.618 of the size. Within that bound, the reacting god's own gates choose what it does.

```latex
d_k = d_0\,\psi^k,\qquad \psi=-\tfrac{1}{\varphi}\approx-0.618
```

A first act by the Builder, followed round one breath:

| hop k | god answering | bound ψ^k |
|---|---|---|
| 0 | the Builder (the act) | 1 |
| 1 | the Grower | −0.618 |
| 2 | the Bounty | +0.382 |
| 3 | the Reaper | −0.236 |
| 4 | the Mover, the Builder's opposite | +0.146 |
| 5 | the Toll | −0.090 |
| 6 | the Unmaker | +0.056 |
| 7 | the Trader | −0.034 |
| 8 | the Builder again | +0.021 |

Two results follow:

- **Every disturbance settles within one breath.** What is left at the breath's close is φ⁻⁸ ≈ 2.1% of the act, after 0.4 s. The Measure carries that residue; nothing echoes forever.
- **The world keeps a share of every act.** The act and its seven answers net to (1 − ψ⁸)/(1 − ψ) ≈ 0.605 of the act, so 60% of what a god does stands.

The opposite's share at hop 4, φ⁻⁴ ≈ 0.146, is the same 1/φ⁴ the terraform spec already uses as its floor for a yard share. Growth that compounds, such as a town's pour or a fortune rising, rides φ, but only through the Measure's pulse, never through reactions. No chain of reactions can run away.

## Conflicts, ended by the math

Most conflicts cannot happen. The rest end by arithmetic first, then by gates, and last by the Measure. Each rung of this ladder is cheaper than the next.

1. **Two gods at once: impossible.** One god acts a tick, so writes are always a sequence, never simultaneous.
2. **Two records on one stock: no conflict.** Records are deltas, and addition commutes: any order gives the same sum.
3. **A record that breaks a bound** (taking more than there is, storing past capacity): the part that fits is written. The rest becomes a *debt* entry to the writer's opposite, −v, settled at its slot four ticks later. Nothing is lost, and the debt keeps the tick reversible.
4. **Two claims on one cell**, where a piece of ground can hold one use. Each claim is its god's vector, and the claims add. A set that sums to the still point (a god and its opposite, or any balanced three) holds the cell as it is, and the clash is logged. Any other set goes to the earliest slot counted from the breath's lead, and the lead turns one slot a breath, so every god leads once in eight. That is `core/gates.js`'s rule, ties to the first listed, made exact by F's order. The loser asks again at its next turn, 8 ticks later, with the verdict's reasons stored.
5. **Whatever the ladder leaves unbalanced:** the Measure, at the year's end, by continuance's swaps, each its own inverse and logged, as `world/continuance.js` does today.

Rung 3's debts go where the opposite pair says. Most routes are things the world already does:

| writer overflows | the debt goes to | what it means | today |
|---|---|---|---|
| the Reaper takes more than exists | the Trader | the shortfall becomes demand, bought elsewhere | society turns a shortfall into trade |
| the Builder lacks materials | the Mover | the materials must be carried | ship stores |
| the Toll takes more than a hull holds | the Grower | the excess washes ashore as flotsam and salvage | wrecks and salvage |
| the Grower yields past storage | the Toll | it spoils, and is counted lost | new |
| the Bounty grows past capacity | the Unmaker | it dies back, counted as returned | the logistic cap |
| the Unmaker takes past what stands | the Bounty | what was unmade returns to the sea's stock; −v, like every debt (settled by the math) | — |
| the Trader gives more than it holds | the Reaper | credit becomes a debt to be collected; −v, like every debt (settled by the math) | — |

The Mover and the Builder shear and hold no stock, so they have no bound to break. Physics clamps the Mover; a site's refusal clamps the Builder.

The math settled rung 4. A claim is the god's whole vector, not just its sign, so balance is read off the sum the same way the eight gods sum to the Measure. A fixed slot order would hand the Builder every tie, so the lead turns. In the one-day sample each god won between 1,556 and 1,671 cells, and 1,735 sets held.

## Time and turns

The god at tick t is slot t mod 8, in F's order from the Builder. The Measure audits at each breath's close, between slot 7 and slot 0, and only reads.

The breath schedules only the traffic *between* gods: records, claims and debts. A god's own shears and closed forms run on its own rung, asked when needed, as today. A hull still moves every tick; it trades with the world on the Mover's slot.

| rung (`core/clock.js`) | ticks | breaths, so turns per god |
|---|---|---|
| breath | 8 | 1 |
| bar (`core/tempo.js`, the harmonic gate) | 200 | 25 |
| beat | 100 | 12.5: meets the breath every bar, since lcm(8, 100) = 200 |
| day | 24,000 | 3,000 |
| month | 720,000 | 90,000 |
| year | 8,640,000 | 1,080,000 |

A breath is 0.4 s, so each god takes 2.5 turns a second, and a year is 120 hours of play. The README's 400-tick day is stale: the clock's day is Minecraft's own, 24,000 ticks.

- **In the game:** one new duty in `mod/scripts/tempo.js`, period 8. It divides the 200-tick bar, as every duty must, and its cost weight is the calibrator's to set.
- **Near and far** (`core/lod.js`): near a player the gods step slot by slot. Far away, what they would have done is a closed form of the tick, asked on arrival, so a far god costs nothing until someone comes.

## Conservation and the lenses

Each opposed pair sums to the Measure, so each pair keeps one ledger that must close every breath, debts included. All four rest on checks the sim already makes; the pantheon only names their owners.

| pair | what must close | already in the sim |
|---|---|---|
| the Builder + the Mover (form and motion) | exact reversal: a shear never reads its own key | the `purity` and `reverse` lenses |
| the Grower + the Toll | produced = used + stored + lost, and "lost" is the Toll's | the economy's closed ledger |
| the Bounty + the Unmaker | living + damaged + owed = the whole | the coral's books: living + bleached + owed = all the world's coral |
| the Trader + the Reaper | every item changing hands goes by trade, by force, or as a debt | the economy: about 65M items over two years, gap about 1e-6 (README) |

All eight together: F⁸ = I and the eight vectors sum to (0, 0), so a whole breath nets to nothing in kind.

**A new ****`pantheon`**** lens** in `tools/lab.mjs`, run by `npm test`, checks seven things:

1. One god a tick, in F's order.
2. Every shear passes purity.
3. Each pair's ledger closes each breath, debts included.
4. A test kick settles to at most φ⁻⁸ of itself within one breath.
5. The thirds hold at the year's end (continuance's 27–40%).
6. The same inputs give the same wake hash.
7. A day runs forward and back to the same bits: whole entries inside the wake, folded rungs by their sums.

The `inherency` lens also needs one change: today it reads `core/` and `world/` but not their subfolders, so `world/gods/` would escape it.

## All in on the sim

The sim becomes the world, and Minecraft becomes one view of it (D-003). Little is rewritten: each god wraps the modules its row of the table already lists.

| piece | where | what it is |
|---|---|---|
| the pantheon's math | `core/pantheon.js` (new, pure, shared) | the nine vectors, F's order, slot(t), the wake-entry codec, ψ, the conflict ladder, the debt routes; no god's own logic |
| one module a god | `world/gods/<god>.js` (new) | `{ v, owns, turn(world, t, inbox), ask(place, t), ledger, lens }`; `turn` returns ops (shears or records), `ask` is the god's closed form for far places |
| the headless world | `tools/sim.mjs` (new) | runs a day, a month or a year in Node, writes snapshots and the wake; `world/observer.js` and the viewer read them as the sim's front end |
| the game | `mod/scripts/` | runs the same `core/pantheon.js` as one tempo duty; `lay.js` lays what the gods decided (what stands, what fell, the stocks), as it lays baked data now |
| the bake | `tools/buildmod.mjs` | becomes a snapshot of the pantheon at the year's first tick; the grown towns are the Builder's state at t = 0 |

Two rules keep it honest:

- **The sim and the game run the same code.** `core/pantheon.js` and `world/gods/` are copied into the pack as `core/` already is, so the two can only disagree if a lens fails.
- **The house rules carry over unchanged.** Ops are shears or records, decisions go through gates, numbers are tagged, timers divide the bar.

## The agents that build it

One Claude agent per god, nine in all, each on its own worktree and branch (`sim/builder`, `sim/toll` and so on), each merged into the stage branch by pull request. S003's engineers already worked this way. An agent's brief is this doc plus its own row:

- its vector and slot;
- the keys and files it owns;
- its pair's ledger;
- its inbox: entries from F⁻¹·v (the god before it) and from −v (its opposite);
- its lens checks.

The agents come in four waves of two after the Measure: a god and its opposite together, in F's order from the Builder, because a pair shares one ledger and neither can be checked alone. A wave merges only when the `pantheon` lens reads green.

| wave | gods | agents at once | what it delivers |
|---|---|---|---|
| 0 | the Measure | 1 | `core/pantheon.js`, the wake codec, the schedule, the conflict ladder, the `pantheon` lens; the contract everything else is built on |
| 1 | the Builder, the Mover | 2, one per stream | the two shear gods, wrapping existing code; no records yet |
| 2 | the Grower + the Toll | 4 | production and loss, the first ledger that already exists |
| 3 | the Bounty + the Unmaker | 2 | the owed-back ledger: the sea's stocks, ruin and return |
| 4 | the Reaper + the Trader | 2 | the economy: taking and trade |

At most two agents run at once, so the cost stays bounded. Each starts cold, so its brief has to carry everything it needs.

## What it changes for S004, and the questions

S004 doesn't stop. It becomes the land row's first work:

- **Terraforming** is the Builder writing cut and fill records on ground the Grower owns. The spec's "cut balances fill" (the median pad) then becomes a ledger check: a pad's records sum to zero.
- **Yards** are the Grower's claims on the Builder's curtilage.
- **The Fallen Star:**
  - its ore is the Grower's;
  - mining it is the Reaper's;
  - the refinery, the Mint and the coin are the Trader's;
  - the tunnels' ruins are the Unmaker's, and their works the Builder's.
- **The stilt fix stays open** from before. My recommendation is still the root fix in `boxes.js townOf` (water 3 deep at most, as grown towns already use), riding the batched regrow. The work so far sits uncommitted on `world/terraform`.

| # | question for Richard | my recommendation |
|---|---|---|
| 1 | Nine, derived from F on trit pairs? | yes |
| 2 | The axes: where (sea, peoples, land) by act (take, hold, give)? | yes |
| 3 | Are the gods beings in the world, or only the sim's architecture? The faith has no gods today ("nothing sacred"). | decided (Richard, 2026-11-13): both. The gods are the sim's architecture and beings in the world: they can enter the sim and look round, and the world honours them |
| 4 | The Greek names, with each people naming its own counterpart at its shrines (The nine, named)? | yes |
| 5 | Every reaction bounded by ψ = −1/φ? | yes |
| 6 | How do claims on one cell end? | answered by the math: as vectors; a balanced set holds, otherwise the earliest slot from a lead that turns each breath |
| 7 | The two weak debt routes (Unmaker to Bounty, Trader to Reaper)? | answered by the math: −v always, the only route F gives every god |
| 8 | Streams by row, the sea row yours? | yes |
| 9 | Start wave 0 now and park S004, or finish S004's first steps first? | wave 0 first: it is small and everything builds on it |
| 10 | How far may whole-unit answers stray from the ψ bound? | answered by the math: φ²/2 ≈ 1.309 units in all (half a unit a hop, shrinking by ψ); from 610 the answers walk Fibonacci down (Binet) |
| 11 | What does a holding god do with an answer on another's stock? | answered by the math: it lets its tick pass, and the next god answers at ψ² |
| 12 | Where does the sim's chance come from? | answered by the math: drawOf(tick, purpose). One god a tick, so the tick is already the god's stream; a row key adds nothing, and the world's own draws are untouched |
| 13 | Stocks climbed in the sample. Why, and what bounds them? | answered by the math: a floor alone makes a walk reflected at zero, which climbs as the root of its writes (the sample matched it). A stock lives in [0, room], starting at room/φ; an overflow is a debt like a shortfall. Rerun: every stock stayed in its room |

## Verified and assumed

**Verified:**

- F's orbits on the nine trit pairs split 1 + 8, and F⁴ = −I, both run in Node on 2026-11-13.
- The Pisano periods mod 3, 5 and 25 are 8, 20 and 100.
- The rung arithmetic: 200/8, 24,000/8, 8,640,000/8, and lcm(8, 100) = 200.
- The ψᵏ figures and the two sums, by arithmetic.
- Which files each god owns, read from each file's own header comment.
- The engine pieces this builds on, read in source: shears, records and the wake in `core/reversible.js`; the pulse and record in `core/cycles.js`; gates in `core/gates.js`; the rungs in `core/clock.js`.

**Assumed, not yet tested:**

- That the existing modules fit the `turn` and `ask` contract without heavy rewrites.
- What the debt routes mean in play, the two weak ones above above all.
- The pantheon duty's cost in the game, and the agents' cost in time.
- The economy figures (about 65M items, gap about 1e-6), which come from the README and weren't rerun.

## Sources

The names in "The nine, named" were checked against search results for these pages on 2026-11-13; the pages were not read in full.

- Greek: [Nereus](https://en.wikipedia.org/wiki/Nereus) · [Hesiod, Theogony 233–239](https://www.ellopos.net/elpenor/greek-texts/ancient-greece/hesiod/theogony.asp?pg=7) · [Cabeiri](https://en.wikipedia.org/wiki/Cabeiri) · [Aristaeus](https://en.wikipedia.org/wiki/Aristaeus) · [Amphitrite](https://theoi.com/Pontios/Amphitrite.html) · [Britomartis / Diktynna](https://en.wikipedia.org/wiki/Britomartis) · [Telchines](https://en.wikipedia.org/wiki/Telchines) · [Melicertes](https://en.wikipedia.org/wiki/Melicertes)
- Other traditions: [Varuna](https://en.wikipedia.org/wiki/Varuna) · [Mazu](https://en.wikipedia.com/wiki/Mazu) · [al-Khidr](https://www.britannica.com/topic/al-Khidr) · [Sedna](https://en.wikipedia.org/wiki/Sedna_(mythology)) · [Tangaroa](https://windows2universe.org/mythology/tangaroa_sea.html) · [Rán](https://en.wikipedia.org/wiki/R%C3%A1n) · [Njörðr and Ægir](https://atlasmythica.com/?p=259) · [Ebisu](https://www.britannica.com/topic/Ebisu) · [Ryūjin's tide jewels](https://en.wikipedia.org/wiki/Tide_jewels) · [Underwater panther (Mishipeshu)](https://en.wikipedia.org/wiki/Underwater_panther) · [Melqart](https://en.wikipedia.org/wiki/Melqart) · [Komokwa, Royal BC Museum](https://totems.royalbcmuseum.bc.ca/story/Riches) · [Kumugwe' mask, Smithsonian NMAI](https://artsandculture.google.com/asset/xi´xa´niyus-bob-harris-kwakwaka´wakw-ca-1870–ca-1935-kumukwamł-chief-of-the-undersea-mask/GgGYLgE7MGtsYg)
