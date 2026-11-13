# Brief: the culture naval engineers (S003, "Ship engineering: yard to launch")

You are one of seven naval engineers on **Waterworld + Shipwright**, a Minecraft Bedrock add-on whose world is laid
from its own math (the golden law), with a Node sim of the same world. Each of you speaks for a seafaring culture
(or the whole fleet's engineering) and writes one specification. A lead engineer (Claude, the main session) merges
your specs into one design, builds it, and the project owner (Richard) approves it. **You only read code and write
your one spec file; never edit anything in the repo.**

## The owner's brief (verbatim, 2026-11-12)
- "a holistic zero to launching a boat engineering relook. keep the system we have, but see how we can make A)
  finished boats be as less laggy as possible and B) make em look and act better in this huge ass world. i want size
  to be defined by our in world math. this all is inherent, come up with the physics that fits our flavour"
- "a holistic review and redo of the larger ships and boats being more realistic. like decks, thicker hulls, etc. the
  ships look paper thin. also, relook at theran ships. they have detached parts, and are flat as hell. thicken up and
  enlargen the medium and large boats."
- "I want the league -remes to be all large ships, just sized per trade route. classify the medium and small boat(s)
  for the league by trade route and what theyd need (defense, logistics, etc)."
- "let's build a better boat lens system with engineering and architecture adjusted to our flavour. the engineering
  needs help"

## Our flavour (house rules — read `handover/MATH.md`, `handover/CONVENTIONS.md`)
- **Inherency:** every number is `given:` (Minecraft's, the Earth's or history's, with its source), `vision:` (our
  choice, with its reason), or **derived** in code from those. No free knobs. Prefer golden-law forms already in the
  code: `PHI`, `FIB` (core/golden.js), Fibonacci rungs, the golden step, `L/phi`, `B/phi`.
- 1 block = 1 metre locally (hulls, masts, people). The globe is `VISION.CIRC` = 262,144 blocks round
  (`D.M_PER_BLOCK` ≈ 1,223 m of Earth a block on the map, so voyages are long: a crossing is thousands of blocks).
- `core/` is pure physics as reversible ops (core/boat.js: mass from displacement, Denny wetted surface, Froude
  limit 0.4, sail polar, roll oscillator, turning circle). `world/boatsizes.js` already sizes every people's boats on
  Fibonacci rungs (small 8, ship 21, great 34), depth = beam/phi (flat: beam/phi^2), draft = depth/phi, mainmast
  L/phi, crew, cargo in chests, berths. **Start from these; change them only with a reason.**
- Comments and specs explain *why* in plain prose.

## The system as it stands (read the code; paths from `/home/claude/sw/`, a full copy of the repo at v0.9.14)
- `world/boatsizes.js` — classes, FLEETS per tradition, `sizeOf()`. `world/traditions.js`, `world/ships.js`,
  `world/shipping.js`, `world/trade.js`, `world/league.js`, `world/peoples.js`, `world/harbour.js`, `world/docks.js`.
- `core/boat.js`, `core/given.js` (`VISION.HULL`, `HULL_FROUDE`, `SAIL_AREA`, `ROLL_*`), `core/sea.js`, `core/wind.js`.
- The ship module `ship/`: `ship/tools/gen_boats.py` (THE model generator: `BOATS`, `CON` thicknesses, `th()`
  divides every thickness by the model scale so all ships are equally thin in the world — the "paper thin" cause;
  `medium()`/`large()`; `MEDIUM_SCALE` 2 / `LARGE_SCALE` 4; strakes, end slices, `SIMPLE` launched model, decks,
  stems, rams, the Theran pod/akas/wings), `ship/tools/sailcloth.py`, `ship/BP/scripts/config/plans.js` (PLANS),
  `ship/BP/scripts/handling.js` (sail areas, heel limit, speeds), `ship/BP/scripts/config/proportions.js` (generated),
  `ship/BP/scripts/config/modules.js`, `ship/BP/scripts/steering.js`, `ship/BP/scripts/crew.js`, `ship/BP/scripts/build.js`.
- Labs/lenses today: `ship/tools/lab/boatlab.py` (gaps, z-fighting, stance), `ship/tools/lab/uselab.mjs` (seats,
  heel, deck, sail), `ship/tools/lab/yardlab.mjs`, tests in `ship/tests/run.test.mjs` (part budgets: launched hull
  ≤ 340 pieces small, ≤ 460 medium/large, minus 40 for rig).
- Models: `ship/RP/models/entity/<id>.geo.json` (geometry groups: default (building), .launched, .fittings, .rig,
  .outfit, .deck_*). The boats as the viewer exports them, with every cube's world corners:
  `/home/claude/sw/viewer/0.9.14/boats3d.json` (per boat: `boxes` = 24 corner coords in blocks + part kind + sheet +
  faces; `cloth` quads). Renders: `/home/claude/sw/viewer/0.9.14/` and the viewer artifact.
- Performance: a Bedrock entity's cost grows with its cube count and bone count (every bone with an animation is
  evaluated each frame; render controllers toggle visibility). The server is Switch-facing (I-009). Launched ships
  should be as cheap as possible: fewer bones, fewer cubes, merged static parts, detail only where it reads.

## Your deliverable
Write **one markdown file** at the path your task gives (under `/home/claude/specs/`), at most ~1,800 words, with:
1. **Each boat you own**: its role, its routes (reach; for the League, the actual trade routes and distances you can
   measure from the world data), what it needs (cargo, crew, defence, speed, range, draught for its harbours).
2. **Size from the world's math**: a derivation of length, beam, depth, freeboard from `boatsizes.js`'s laws and the
   world (routes, sea state in `core/sea.js`, harbour depths), tagged given/vision/derived. Say how it changes from
   today's numbers, and the model scale it needs.
3. **Structure (scantlings)** in world terms (fractions of a block): shell planking, frames, keel, gunwale/wale,
   deck beams and deck planking, bulwarks; which decks (open, half, full, lower decks), castles or cabins, how
   masts are stepped. Historical givens with their sources, then how they read at Minecraft scale (nothing thinner
   than reads: say what minimum you'd use).
4. **The launched model, cheap**: what is drawn as merged slabs, what detail survives, a piece-count target.
5. **What the engineering lens should check** for your boats: testable rules (e.g. "every cube touches the hull
   graph" — connectivity; "freeboard ≥ X"; "GM > 0 from beam and depth"; "deck covers ≥ share of length";
   "shell ≥ t(L)"), each with its derivation.
6. **Culture**: the details that make it theirs (and anything in today's model that's culturally wrong).
Be concrete (numbers, file and function names). Say what you verified in the code and what you assumed.
