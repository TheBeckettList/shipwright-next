# The Pantheon, sea row: Oceanus, Poseidon, Amphitrite and the ship module

2026-11-13 · R (Richard, with Claude) · the sea stream's half of `handover/design/pantheon.md` (D-008). Read that first;
this doc only fills in what the sea row owns, how the ship module becomes the Mover, and who builds what when.

## In short

The pantheon gives each stream a row. The sea row (a = −1) is Richard's:

| slot | god | (a, b) | op | in one line | wave |
|---|---|---|---|---|---|
| 4 | **the Mover** (Oceanus) | (−1, 0) | shear | everything that moves on the sea: wind, tide, waves, currents, hulls under way | 1, with the Builder |
| 5 | **the Toll** (Poseidon) | (−1, −1) | record | what the sea takes: wear, storms, wrecks, harbour damage | 2, with the Grower |
| 2 | **the Bounty** (Amphitrite) | (−1, +1) | record | what the sea gives: stocks, reefs, spawn owed back, flotsam | 3, with the Unmaker |

Each sea god's opposite (its ledger partner, −v) is on the land row, the world architect's: the Mover's is the Builder,
the Toll's the Grower, the Bounty's the Unmaker. So every sea ledger is closed by the two streams together, which is
why each wave pairs one god from each stream (pantheon.md, "The agents that build it").

The shared row (a = 0) touches the ships most: the Reaper takes (raids, rams, the fight from the rail), the Trader gives
(the League's galleys, coin, the yards' purchases). Neither is ours alone; we write their ship-side pieces when their
wave comes, by pull request into their branch.

## The Mover (Oceanus), (−1, 0): the ship module itself

A shear: it moves and shapes without exchanging anything, so it runs back with no memory, and it stores no wake. The
sea itself is a closed form of (place, tick). A hull under way is the Mover's state; it trades with the world only on
the Mover's slot.

**It owns** (by each file's header comment):

| where | files | what |
|---|---|---|
| `core/` | wind, sea, globe, boat | the wind, the waves and tide, the globe's frame, the size laws a hull is built on |
| `world/` | boatsizes, explorers, shipping (the routes), docks (berth geometry), harbour (the water's shape) | what each people's hulls are, where they go |
| `ship/BP/scripts/` | laws, steering, handling, body, buoyancy, frame, ourmath, orientation, orientmode, flight, glide, tender, deck, grid, props, ship, dims, seaworld | a boat's motion, as pure laws and their projection into the game; the Exokoitos's flight |
| `ship/tools/` | gen_boats, boatexport, sailcloth, lab/englab, lab/boatlab, lab/lawdump | the hulls themselves and the engineering lens |

**Its contract** (pantheon.md, `{ v, owns, turn, ask, ledger, lens }`):

- `turn(world, t, inbox)`: nothing to exchange in the common case (shears only). On its slot it settles what moving
  hulls owe the world: a hull's arrival at a berth, a tender cast off, a wreck's position handed to the Toll.
- `ask(place, t)`: the sea's closed form, as today (`core/sea.js`, `core/wind.js`): wind, waves and tide at a place and
  tick, for far places at no cost.
- Its inbox: the Bounty's entries (F⁻¹·v: the sea's stock moved, so a fishing ground shifts a route) and the Builder's
  (−v: a harbour built or unmade changes where a hull can berth).

**Its ledger with the Builder** (form and motion): exact reversal. A shear never reads its own key; the `purity` and
`reverse` lenses hold it. For the ships that means every law in `laws.js` and `flight.js` stays pure (state in, state
out, no game), which they already are, and `ship:test` keeps proving it.

**Its lens checks**, added to the `pantheon` lens: one hull a slot trades with the world; a hull's motion run forward
and back to the same bits over a breath; the engineering lens's ratchet (`ship/tests/engineering.json`) unchanged by
the wrap.

## The Toll (Poseidon), (−1, −1): what the sea takes

A record: the wake keeps what it took, so it can give it back.

**It owns:** `world/ships.js` (a fleet's year of wear, the stores it costs); the sea's toll and the wrecks in
`world/trade.js`; harbour damage; in the ship module, a hull's wear and repair (`steering.js` bumps and groundings,
`ourmath.js`, `logbook.js`'s healing), and the Exokoitos's landings and crashes (`glide.js`: a crash is the Toll's).

**Its contract:** `turn` writes the year's wear and each wreck as records (a deck plank, a hull's whole value). `ask`:
the wear a hull would take sailing from here to there (the closed form `ships.js` already uses).

**Its ledger with the Grower:** produced = used + stored + lost, and "lost" is the Toll's. A repair's timber is the
Grower's; the wear is the Toll's; they close each breath. Its debt route (−v): when the Toll takes more than a hull
holds, the excess washes ashore as flotsam and salvage, the Grower's.

## The Bounty (Amphitrite), (−1, +1): what the sea gives

A record.

**It owns:** `world/sealife.js` (regions, habitats, stocks, reefs, the coral's books); the catch a boat brings home
(its giving side; the taking is the Reaper's); the sea's treasure in `charts.js` (what the sea gives up to a chart).

**Its contract:** `turn` grows the stocks and owes back spawn (the logistic cap, already in sealife); `ask`: a region's
stock at a tick, its closed form.

**Its ledger with the Unmaker:** living + damaged + owed = the whole (the coral's books). Its debt route (−v): what
grows past capacity dies back, counted as returned, the Unmaker's.

## The Exokoitos and the sherd, in the pantheon

- Her motion and flight are the Mover's (`flight.js` pure, `glide.js` its projection).
- Her asterion core is the Fallen Star's ore: the Grower's lode, mined by the Reaper, worked by the Builder.
- Her rider's **sherd** (the echo shard, the ostrakon every Theran votes with) is the Measure's: the token of a
  judgement, the one thing that holds still. It wakes her core: a Theran's vote is what lets her fly. That keeps the lore
  and the math on one line: the Measure frames, the Mover moves.
- Her crashes are the Toll's.

## Who builds what, when (the sea stream's tasks)

The sea row is built by the waves pantheon.md sets (a god and its opposite together, at most two agents at once, each
wave merged only when the `pantheon` lens reads green). Between waves the ships keep going as they do now: designed with
Richard, step by step, in `s003/*` and `s004/*` branches.

| # | task | god | branch | wave / when | status |
|---|---|---|---|---|---|
| 1 | The Exokoitos: three-strip flexing rudders on the telescoping tip, the Sto-Wing wings checked folded/half/open, the seed sail | the Mover | `s003/therans` | now (design with Richard) | in progress |
| 2 | Exokoitos in the game: the fold, the flight, the sherd; load and look (I-012) | the Mover | `s003/therans` | now | wired, untested in game |
| 3 | The engineering lens taught the glider (no shell; stem, frames) and the catamaran's piece budget | the Mover | `s003/therans` | now | open |
| 4 | The Theran catamaran and flagship in the Exokoitos's language (gold frame, cloth, covered decks, interiors) | the Mover | `s003/therans` | after 1-3 | open |
| 5 | The League fleet (great galleys by route, small and medium by role) | the Mover, with the Trader's demand | `s003/league` | after 4 | WIP |
| 6 | `world/gods/mover.js`: the ship module and the sea wrapped as the Mover (`turn`, `ask`, its lens checks) | the Mover | `sim/mover` | wave 1, alongside the Builder | not started |
| 7 | `world/gods/toll.js`: wear, wrecks, harbour damage as records; its ledger with the Grower | the Toll | `sim/toll` | wave 2 | not started |
| 8 | `world/gods/bounty.js`: sealife's stocks and reefs as records; its ledger with the Unmaker | the Bounty | `sim/bounty` | wave 3 | not started |
| 9 | Ship-side pieces of the Reaper (rams, raids from the rail) and the Trader (the League's galleys, purchases) | shared | their branches | wave 4 | not started |
| 10 | The two open counterparts (pantheon.md): the shallow-water stilt peoples and the Europeans | — | — | Richard's call | open |

The agents for 6-8 are briefed in `.claude/agents/` (oceanus, poseidon, amphitrite). They are only run when a wave is
run; day to day the ships are built together, not by agents (Richard, S003: "lets not use agents as much; I like us
devving together").

## Verified and assumed

**Verified:** the sea row's vectors, slots and opposites, read from `core/pantheon.js` on `sim/measure`; which files
each god owns, read from each file's header comment (2026-11-13).

**Assumed, not yet tested:** that the ship module wraps as one shear god without rewrites (its laws are pure, its
game-side code is projection, so it should); where exactly wear lives between `steering.js`, `ourmath.js` and
`logbook.js` (read when wave 2 starts).
