# Shipwright, next: the waterworld sim

A clean rewrite of the math under Shipwright, written so that the world in Minecraft is the math, rendered. Nothing here touches the game yet. It's the sim the game will be a view of. Everything runs in Node with no packages.

```
npm test                         every lens, as tests (26)
node tools/lab.mjs [lens ...]    the lenses, with their readings
node tools/lab.mjs render f.png  the world: depth, biomes, peoples by temper
```

## The rules every file keeps

- **Inherency.** Every number is a *given* (Minecraft's, the Earth's, geometry's), a *vision* choice (ours, with its reason), or *derived* by a law. They live in `core/given.js`. Anywhere else a number needs a `// given:`, `// vision:` or `// derived:` tag on its line, or a data file says so in its first line. The `inherency` lens counts the rest. The ratchet is 0 (`tests/inherency.json`).
- **Reversibility.** Anything with state (a boat) is held in exact integers (`core/fixed.js`) and stepped by ops of two kinds (`core/reversible.js`):
  - A **shear** adds a function of everything except its own variable. It's the golden law's own shape, (a, b) → (a + b, a). The `purity` lens proves each shear never reads its own key.
  - A **record** is an exchange with the world (the wind gives, the water takes), and the sea keeps what was exchanged: the wake.
  - Run a tick back and you get the same bits. The `reverse` lens sails a boat 3,000 ticks through gusts, current and helm, and runs it back to the identical state. Exact reversal reaches as far back as the sea keeps its wake (`WAKE_KEEP`, two minutes). Past that a loss is real and is counted in `lost`.
- **Stateless sea.** Tide, waves, wind, gusts and currents are pure functions of (place, tick), so they reverse for free and can be asked about any tick without stepping.
- **Vanilla is the bound.** Every block, item and mob the world names is checked against Bedrock's own lists (`lab/bedrock_*.json`). The `vanilla` lens checks every biome resource and every block every people builds with.

## The world

- **Static, not seeded.** `world/map.png` is the world: 2,048 × 1,024 pixels, one pixel a chunk, 32,768 × 16,384 blocks.
  - Grayscale legend: below 100 is sea, depth 100 − v. 100 and up is land, height v − 99.
  - Paint it in any editor. `tools/makeworld.mjs` drew it once and won't redraw it without `--force`.
  - About 88% sea, 243 islands, the largest about 35,700 chunks (some 3,000 blocks across).
- **Circumnavigable two ways.**
  - Big ships cross the open seas.
  - Small boats can go round by island hopping, with no crossing over `VISION.HOP` (20 chunks, 320 blocks). The longer route needed 78 stepping-stone cays. They live in `world/islets.json`, laid over the map so the painting is never touched (`tools/makeislets.mjs`).
- **The globe** (`core/globe.js`):
  - Equirectangular, not Mercator. Mercator never reaches the poles, so its ends can't be joined.
  - East–west wraps.
  - Over a pole you come down 180° of longitude away, heading the other way: every direction is negated, −I. That's the same lost sign as F⁴ = −I.
  - Ships live on the unwrapped cover, so their laws have no seams. `fold()` projects them onto the world, and the bit it drops (which side of the pole) is exactly the 6D → 1D lost bit.
  - With `GLOBE_METRIC`, an east-west block at latitude φ is cos φ of an equatorial one, so high-latitude runs are honestly shorter.
- **Near and far** (`core/lod.js`):
  - Rendered out to 4 chunks, every tick.
  - The n + 1 ring is ready but not placed, on the 8-tick breath.
  - Chunk math out to 24 chunks, every 20 ticks.
  - Beyond that, nothing runs: everything there is a closed form of the tick and is read on arrival (a jump, not a replay).
  - Round one player that's 200 chunk-steps a tick, about 2.5 × the rendered ring alone.

## Wind, sea, boats

- **Wind** (`core/wind.js`): the real belts (doldrums, trades, horse latitudes, westerlies, polar easterlies), mirrored south of the line. No weather. Gusts are the Seedworld trit line: one golden breath on a Möbius loop, stepped once a second (20 ticks = the golden law's period mod 5).
- **Sea** (`core/sea.js`):
  - Tide: two bulges a day running west with the sky, higher over shelves.
  - Waves: the Pierson–Moskowitz sea for the local wind, fetch-limited, with trains obeying deep-water dispersion under Minecraft's gravity. A wave 16 times longer runs exactly 4 times slower (the `analogues` lens).
  - Currents: zonal bands.
- **Boats** (`core/boat.js`). Everything follows from length and rig:
  - mass from displacement, Denny's wetted area, skin friction rising past the Froude limit (0.4)
  - the sail's polar on the apparent wind, keel grip
  - heel as a leapfrog oscillator, turning radius in hull lengths
  - Readings: an 8-block square-rigger makes about 4.6 m/s on a beam reach in the trades and 5.7 in the westerlies, and won't point within about 60° of the wind.

## Thera (the natural island, before anyone builds)

`world/thera.js` draws pre-eruption Thera from its geology, after the current reconstruction (Karátson, Gertisser, Druitt, Nomikou et al., *Scientific Reports* 2018):

- a semi-closed caldera bay from the Cape Riva eruption (about 22,000 years ago), in the north only, because the southern basin had filled in
- a continuous southern and western rim from Thera through Aspronisi to Therasia, and a low, narrow strait to the north-west; the south-west is closed
- Pre-Kameni, a low lobed dome of young black andesite, in the middle of the bay
- the older rock standing out of the young volcanics: Profitis Ilias (567 m) and Mesa Vouno in the south-east, the Akrotiri ridge in the south-west, Megalo Vouno and Peristeria in the north
- gullies draining outward from the rim, deeper where the land is higher

**Scale:** 1:10 across (`THERA.KM`, 100 blocks a km: about 1,900 blocks end to end). Height is exaggerated 2.5 times (`THERA.M`, 4 m a block), so Profitis Ilias rises 138 blocks.

**Seat:** the island sits at chunk 1008, 297 (37.8°N, 2.8°W). That's the nearest point to Thera's real latitude with open sea all round it, and within 0.1% of the most central site for trade with every people. It's laid over the map like the cays, so the painted map is untouched. It's the Atlanteans' (the players'): no generated people live there.

**Checks:** the `thera` lens holds it to the research. The bay reaches the sea only by the north-west strait, Pre-Kameni stands in water on every side, and Profitis Ilias is the highest point.

`node tools/theramap.mjs out.png` draws the map (relief, 10-block contours, names); the current one is `world/thera_map.png`.

## The city (`world/city.js`) and the Therans' towns (`world/therans.js`, `world/towns.js`)

The plan is laid out in the island's own plane, so it fits the ground rather than a compass.

- **The inner city on Pre-Kameni** is the Atlanteans' heart, lived in by Therans. Streets follow the cone's own contours and stairs run straight downhill. The Library is on the terrace over the round harbour, the acropolis on the summit.
- **The cothon**, after Carthage's: a merchant harbour opening to the bay, then the round harbour with its shipsheds and the harbour master's island. It's cut into the cone's flank facing the strait, the one deliberately round thing.
- **The Exchange** stands on the merchant harbour's quays, where the fairway from the strait arrives.
- **The bay's dock quarters:** 44 of them, a patchwork. Each tradition holds several, in proportion to its trade with the world, so every people is spread across the bay (a mixing pot). Canals run between and through them (the maze), with a ring canal round the cone's lobed shore and a wall canal under the scalloped cliffs. Shallow-water people build on stilts.
- **The Light** is on a lava-plug stack in the middle of the north strait, with a passage either side.
- **The Therans** (NPCs, the waterworld's peak culture) build in two layers. Bronze Age Akrotiri: tuff ashlar, timber-laced walls, window rows, flat roofs, frescoes. Modern Santorini: whitewash, barrel vaults, cave houses cut into the cliffs, blue doors, stepped lanes, windmills. Domes only go on civic buildings; nothing is sacred.
- **The blend at a site:** cave houses where it's steep, Akrotiri stone where it's flat and low, whitewash rising with height.
- **Eight towns sited by scoring the ground:**
  - Fira, Imerovigli and Firostefani on the caldera lip (cave houses and whitewash)
  - Oia over the strait
  - Akrotiri on the south-west coast (Bronze Age stone)
  - Pyrgos on the hill under Profitis Ilias
  - Kamari and Perissa on the east shore

  Each town spreads over the ground it can build on, with a ragged edge.

`node tools/citymap.mjs prefix` draws the plan (`prefix_island.png`, `prefix_bay.png`).

## The living world (`core/cycles.js`, `world/history.js`, `world/society.js`)

The two-layer universe from Seedworld, as the engine of history. Everything is trits and exactly reversible.

- **The cycle:** the golden line on a Möbius loop through every people in sailing order from Thera (the world's end links to its start), one cell per realm of about three peoples. Its 180 cells breathe back to the point in exactly 360 culture days: a year (see the clock below), two hours of play.
- **The record:** each people's fortune (rising, steady, waning), driven by the cycle. It changes only where the breath passes, so it keeps every month's change. It starts from each people's own resources, so the world doesn't move in step. It stays balanced (each third 23–40% month by month, through the year): no people or tradition takes over, and no rule is needed to enforce it.
- **At every month's end the world is re-baked:**
  - borders between sea neighbours lean toward the waning side, by at most 3 chunks
  - borders are contested where fortunes are opposite and a temper runs hot, trading where both are calm
  - tempers move with fortune
  - each tradition's share of Thera's quarters moves by at most 30%
- **Reversibility:** any tick can be run back exactly. The whole world comes home after a whole number of breaths (96 ticks for a loop of 8; astronomically long for the real world). It's definable, but never repeats in play.
- **Society, all gates** (`core/gates.js`: the must/prefer shape of the culture gates, and every decision keeps its reasons):
  - **Needs** are limited resources (food, timber, stone, iron, goods), sharpened by fortune.
  - **The goal** is the sharpest need.
  - **Actions:** raid, trade, fish, farm, herd, build, defend. A raid needs a hot temper and a richer neighbour; trade needs a calm lane and cargo; building needs a rising fortune.
  - **Rank:** each tradition has one seat and a bounded share of ports; the seat passes between its own peoples as fortunes turn.
  - **Folk:** vanilla villager professions by living and ground. The cultures replace vanilla's villagers; there's no cleric.
- **First month:** trade 237, building 89, farming 81, fishing 75, herding 46, raids 23, defence 16. Goals: food 190, timber 146, prosper 143, iron 87.

## The breathing world: one clock, built, worn, moved, held

**One clock** (`core/clock.js`). These rungs are every system's only timekeeping, and every rung of the year is one of the golden law's own periods:

| Rung | Length | Golden period | What runs on it |
|---|---|---|---|
| tick | 1 | | motion |
| breath | 8 | mod 3 | |
| second | 20 | mod 5 | |
| beat | 100 | mod 25 | the folk's turns |
| day | 400 ticks (four beats) | | one step of the record |
| month | 30 days | mod 22 | the world re-bakes |
| season | 90 days | mod 181 | |
| year | 360 days | mod 135 | the Therans' continuance |

- **A year is 144,000 ticks:** two hours of play, and exactly six Minecraft days, so every year opens at sunrise.
- **Realms:** 180 of them, neighbouring runs of about three peoples in sailing order. The pulse has one cell per realm, so it breathes in exactly 360 days. Each of the 566 peoples keeps its own fortune, driven by its realm's pulse. The pulse never reads the record, so a whole year runs back exactly.
- **Seasons:** the year opens at midsummer (the pulse's point), and midwinter is its half-breath (its antimatter point).
- **Compute:** the record moves every day and the world re-bakes every month (12 times a year), so a year holds far more change. The steady load is 1.86 trit-steps a tick (746 a day), and everything else is read off the clock (`breathing` lens).

**Systems:**

| System | What it does |
|---|---|
| **Buildings** (`world/buildings.js`) | Each people has a plan: homes, then what its living needs, then its guard. Its wealth is a bounded walk, one step a year by fortune, never below its core homes. Wealth now steps once a month. Within a month a rising people's new building goes footing → frame → roof → finished, each starting at its own point in the month. A falling one goes abandoned → ruin → cleared, and its materials return. Every building is billed in its people's own vanilla materials. Over two years the world holds 56–61% of all plans standing, and 561 of 566 peoples build or lose something. |
| **Ships** (`world/ships.js`) | Each tradition's boats need its own stores (hull wood, fastenings, sail: spruce and iron rivets, sewn acacia, leather and bone…). Wear grows with distance and sea state, and repairs are its demand. What the ground can't supply becomes a need in society, so peoples trade for ship stores. Shipwrights are counted by repair load. |
| **Folk** (`world/folk.js`) | One pool of catch-all people per people, dealt between home, work, docks, market, sea and Thera by hour, season, living and the year's action. Counts are whole and exact. While a player is near, the roster turns each beat by a golden stride (a permutation), so faces change roles but every role stays filled. Dress is the culture's vanilla villager type plus the role. Thera's crowd is the world's travelling mass: 3,080 on a summer morning, 1,153 on a winter one. |
| **Pirates** (`world/pirates.js`) | Bands come from raider (or hungry wary) peoples in waning months. Tier is how long their home has waned: a month makes Reavers, a season Freebooters, half a year Pirate lords, with vanilla Illager crews. At most 3% of the peoples sail; the Therans keep the rest in port. Each band works the lane to its target, and its position is a closed form. |
| **Home port** (`world/homeport.js`) | The player's camp → hamlet → village → harbour town → fortress (4 berths, 24 folk). Each stage is gated (`core/gates.js`) by delivered stores in the style's materials, food, a filled town and time. The town and berthed ships wear daily. The style is a tradition (its home climate and boat woods through the building grammar, e.g. Japanese builds in cherry) or one the player defines from any vanilla blocks. |
| **Continuance, the Therans' power** (`world/continuance.js`) | At each year's end they hold the world in bounds: each third 27–40%, each tradition's mean fortune within ±0.34, pirates ≤ 3%. They fix with value swaps (the world's thirds) and cell swaps (between traditions). Each is its own inverse, logged and undone exactly. In the real world they move 0–3 fortunes a year. |

**Roles** (vanilla wherever vanilla has them):

- **Food:** fisherman, farmer, shepherd, butcher, leatherworker
- **Building and making:** mason (builders), fletcher, toolsmith, weaponsmith, armorer
- **Charts and books:** cartographer (navigators), librarian (chart keepers)
- **Shipwrights:** the pack's own shipwright's table as their job block
- **Merchants:** traders at sea and in Thera (vanilla's wandering trader for travelling merchants)
- **Pirates:** Illagers

There's no cleric: nothing sacred.

## The peoples (derived, not assigned)

`world/peoples.js` runs this chain on the map, in under 2 s:

1. **Climate**: heat from latitude and height, rain from the wind belt, wetter on coasts and windward slopes, a rain shadow in the lee.
2. **Biome**: vanilla's, by climate (`world/biomes.js`).
3. **Resources**: woods, stones, crops, herds, wild food, fish from their shelf waters, and ores by how high their rock rises.
4. **Living**: fishers, farmers or herders, by food share.
5. **Temper**: scarcity × arms × opportunity (richer peoples within a few hops) against surplus × a fair trade wind. This gives raiders, wary, peaceful or traders.
6. **Tradition**: the old mod's ten, matched by home climate and boat woods (`world/traditions.js`). The sea is kept diverse: every tradition holds 5–18% of the peoples (`TRADITION_SHARE`), and the featured ones get raised floors (`FEATURED`). The rarest fill their floors first with their best-fitting peoples. Each people keeps `traditionFit` and `naturalTradition`, so the nudged ones can be colonies far from home.
7. **Building grammar** (`world/architecture.js`):
   - frame: timber, stone, mud brick, or snow and ice
   - roof: pitch from rain; turf, thatch, tile or wood from what grows
   - on piles where it floods, open-sided where it's hot and wet, thick walls against cold and dry heat
   - doors to the water or the sun, in the lee of the wind
   - a palisade for raiders, a market for traders
   - the set of buildings their living needs
8. **The day** (`dayOf`): what they're doing at any tick, from the hour, the tide on their coast, and whether the wind is fair toward their raid target or trade partner.

Today's reading: 567 peoples. Farmers 271, fishers 178, herders 118. Peaceful 319, traders 168, wary 49, raiders 31.

Traditions: European 98, Arctic 97, Norse 88, Pacific 71, Japanese 40, bark-canoe 37, shallow-water 37, Great-dugout 36, Indian Ocean 34, East Asian 29. The raiders sit in the cold, poor, timbered north and south, which nobody told them to do.

## The full economy: jobs, war, wrecks, ruins, moves (`world/economy.js`, `jobs.js`, `settlement.js`)

- **Closed ledger.** Two years make about 65M items, and every one is accounted for (gap about 1e-6).
- **Jobs.** Jobs are vanilla professions plus shipwright, miner and folk. Yield per worker comes from the ground per worker, and the yield swings with fortune and season.
- **War.** A raid splits a razed building three ways: loot, the defender's salvage, and a wreck at the shore. Close fights sink part of the loot on the way home.
- **Moves and ruins.** Raided towns move. The site they leave is a ruin holding its items and the memory of its districts, and ruins are re-founded at a year's end.
- **Settlements.** `settlement.js` lays a town out in districts by culture, shore and wind, puts walls on the walled districts' boundary, and moves the walls when the town grows.
- **Life that costs nothing.** Ambient life fills each tempo's compute gaps (`ambient.js`, `tempo.fillGaps`). `budget.js` holds the worst-case "oh no" sums.
- **Observer.** `tools/observe.mjs` can look at a people, a villager or a place at any tick, or follow one over a year.

## Trade, the Koinon, wrecks and explorers (`world/trade.js`, `league.js`, `explorers.js`)

- **Tiers.** Goods move village → city → island hub (sometimes) → continental hub → Thera. Alongside that ladder, each tradition's cultural hub pools the tradition's own frames, roofs and ship stores.
  - Goods go up a tier only as far as someone wants them. Hubs send half their surplus up and ask their parent for what their children lacked, count for count.
  - Thera receives only the international trade (what another continent ordered) plus a 5% tithe, so a little of everything is there. That's about 1% of all trade.
  - Food goes no further than an island.
- **The sea's toll.** Hops between islands are voyages, limited by the cargo hold and at risk near contested borders and pirate bands. Pirates bury their take as treasure; the rest becomes sited wrecks that decay and can be salvaged.
- **The Koinon.** Twelve sovereign city-states on the big island nearest Thera's antipode.
  - **Specialised:** each masters one ship piece, and its twin across the island masters the piece that answers it.
  - **Self-sufficient together:** the twelve markets are levelled and circulate freely between them. Each state mines and smelts for its piece, and a tempo allotment guarantees a month's kits, no more.
  - **Neutral:** no raids by them or on them, and no pirates from them.
  - **The money people:** they keep Thera's market. A 3% brokerage on everything entering goes to their house, and they mint emeralds up to a month's worth in hand.
  - **Below the Therans:** the Therans take what the city needs first. The Koinon's coin buys from the nearest markets whatever the Exchange lacks.
  - The presidency moves one state a month.
- **Explorers.** Thirteen closed-form ships sail rounds of eight golden-sequence landfalls. Meeting one gives you a chart of what it passed: home, landfalls, wrecks, treasure and ruins.

## The texture pack (`core/golden.js`, `core/patterns.js`, `core/sight.js`, `world/textures.js`, `world/looks.js`)

- **Solid fields.** Faces are slices of one 3D field with Fibonacci wavenumbers, so veins, beds and grain run round corners and into the next block. Each tile is lit by its own relief.
- **Three layers.** Variants come in 2 × 3 × 5 = 30 (macro swell, meso accents, micro grain) and share their edges, so walls don't optically repeat. Lengths come from the Fibonacci word.
- **Axis materials.** Logs, basalt, deepslate, hay, bone, bamboo and pillars read one way stood and another laid. Each culture's `ORIENT` says which way it sets them.
- **Cultures.** Each culture has a palette from its climate group's dye stuffs and owns a glazed terracotta motif (quarter-tiles that close into the whole motif when turned round a point). The Therans own two, the League one.
- **Sight.** Rings at Fibonacci chunk radii each hold an equal share of what the eye resolves, so detail is budgeted by share and the view costs the log of its reach. Each family fades to its mean colour at its Nyquist ring.
- **Tools.** `tools/maketextures.mjs` writes the pack (`pack/RP/textures`, `SPEC.md`, `variations.json`, flipbooks). `tools/texsets.mjs` draws floors, stacks and stood/laid pairs. `tools/texmap.mjs` draws a town through the textures.

## Architecture: rooms to cities (`world/rooms.js`, `dwelling.js`, `chem.js`, `boxes.js`)

- **Needs are vanilla's own rules.** Every house has a bed per villager, the household's workstation, a store, a fire, a crafting table and a door. Every floor cell is lit to light level 8 (lanterns are hung at the darkest cell until it is), and every fixture is reachable from the door.
- **Rooms are atoms.** Each room's area is wholly what it holds plus the cell in front of each thing, with Fibonacci sides. The atoms are sleep, hearth, work, store, entry, court and well. Each culture bonds them its own way:
  - **fused:** the Norse longhall
  - **chain:** the two-cell house and the stilt house
  - **star:** the courtyard house
  - **chain of mats:** the Japanese module house
  - **stack:** the Akrotiri town house
- **Density folds the plan.** When a plot is too small, atoms move up a floor in the culture's order, with a light well and a ladder.
- **Round forms are single atoms:** the round lodge, the snow dome, the compound of huts, the open platform.
- **Roundness per culture** chamfers corners and pulls towns onto a sunflower spiral.
- **Repetition varies the bond.** After three houses alike, the Fibonacci word picks a substitution: mirror, porch, store, longer, palette. A house that can't meet a substitution falls back to plain.
- **Chemistry.**
  - A periodic table (periods are scales, groups are functions), with stoichiometry from population.
  - The compound is placed by least energy: lane length to existing roads, footing, waterline, well reach, density and roundness.
  - Footings: level, piles, terrace, posts, cut, or garden if too steep.
  - Roads: a main street 3 wide and lanes 1 to 2 wide, surfaced by culture and tier, with steps past a 1 in φ² grade.
  - Growth is synthesis in one stream, so any smaller town is a prefix of a larger one and decline undoes it exactly.
- **Boxes.**
  - Every settlement's population: its own, plus its market's draw (φ⁻³ of its villages; φ⁻² of a continent's cities).
  - Tiers at Fibonacci numbers: camp, hamlet at 34, village at 144, town at 610, city at 2,584.
  - Standard Fibonacci binding dimensions and boxes. Quarters of 13 households round a well and bell (a ring if round, rows if square), and districts of 8 quarters. Towns grow on the sunflower; quarters densify to 21 and then 34 households when ground runs out. Walls and gates are added where the guard calls for them.
  - Thera has 44 dock quarters, each in its culture's style, plus the Therans' quarters on the cone.
  - All 116,820 folk are housed, and the whole world is laid out in under a second.
- **Tools.** `tools/housemap.mjs` draws every culture's house (an isometric view plus plans). `tools/townchem.mjs` draws a chemistry town through the textures. `tools/boxmap.mjs` draws the world population map, a box town, and Thera.

## The sacred sea, the solar rite and the Cold House (`world/sealife.js`, `solar.js`, `coldhouse.js`)

- **The sea is sacred.** It runs on the world's own law: the sea's good and lean years are a record driven by the golden line. The clerics (vanilla's brewing stand) keep shrines at the waterline and read that record, so the math is held sacred because the world runs on it.
- **Sea life.**
  - 515 sea regions, each with habitats derived from depth, light and warmth: reef, kelp, seagrass, the deep, frozen water.
  - Vanilla's sea life as stocks with capacities and growth: coral, kelp, seagrass, cod, salmon, tropical fish, pufferfish, squid, glow squid, turtles, dolphins. Drowned gather on wrecks.
  - Each month the stocks follow the logistic law, pushed by the season and the record, with one community matrix (who eats whom). Without turtles to graze, seagrass shades the reefs.
- **Catch.** Every people's fishermen fish their own water, and the stock limits their catch.
- **The Therans' wardens.**
  - The sea tax is 1/13 of every catch landed.
  - A region whose fish fall below 1/φ² of its capacity is closed, and reopens only once they recover past 1/φ.
  - Bleached reefs are replanted out of the tax.
- **The solar rite.** The Therans' year-end rite returns the warmth the world's sun leaves short: sin 2·latitude in shape, sized so that Thera keeps the middle of the mild band (15 °C, a cherry grove). It fades by 1/φ² across the year, so each rite is necessary.
  - Its fresh warmth is what bleaches reefs, by more than 1 °C over a reef's own mean. The rite and the reefs pull against each other.
- **The Cold House.** A glassed-in arctic on Thera's cone. Packed ice, snow, blue ice and powder snow never melt. Its pond of plain ice is kept by soul lanterns (light 10, which is under ice's melting point of 11), set close enough that every floor cell is lit to 8. That is vanilla's own rule, turned into climate control.

## The one faith and the Sea Rite Temple (`world/faith.js`, `temple.js`)

- **One faith,** provisionally called "the Breath".
  - **What it holds sacred:** the sea, and the law the world runs by (the golden law: its scripture is the Reckoning, kept in Thera's Library).
  - **Tenets:** the sea is sacred; the law is sacred; take no more than the sea gives; what the year takes, the year's end gives back.
  - **Calendar:** the clerics' dawn reading; the monthly blessing; the Turning at midwinter (the half breath); the Great Rite at the year's end.
  - **Orders:** clerics at quarter shrines, priests at district temples, the Therans' Reckoners at the Temple.
  - **One faith, many ways:** each tradition keeps it in its own style, with its own shrine motif, rite name and offering.
- **The Sea Rite.** At every year's end the breath is back at its point, so the sea comes back with it: every fish, kelp and seagrass stock returns to 100%, and every closed water opens. Within a year stocks fall (to 35–93% at their lowest) and the wardens hold them.
- **Reefs as a see-saw.**
  - Water more than 1 °C over a reef's own mean bleaches part of its cover. If the next month cools, 1/φ of it recovers; otherwise it dies (vanilla's dead coral) and crumbles a thirteenth a month.
  - What dies, or is grazed, is owed back as spawn. It settles in 5 packets a month, each on a reef picked by the golden sequence (weighted by room, cool water and nearness), so it is sometimes home and often elsewhere.
  - Living + bleached + owed is the world's coral, held exactly, so every bleaching is a regrowth to come.
  - The Rite settles everything owed. Over two years: 188 dyings, 672 regrowths at home, 8,314 settlings elsewhere. Living coral never fell below 77%, and was back at 100% of the world's coral after each Rite.
- **The Sea Rite Temple at Thera.**
  - Built on vanilla's conduit, with its full 42-block prismarine frame and sea lanterns where the rings cross, giving the full 96-block blessing over the bay. It sits in a pool open to the sea by a channel and steps.
  - A colonnade of fluted quartz on a 13 × 21 calcite platform, under a prismarine frieze (the pack draws prismarine as the 5D string, so the law runs round its brow).
  - The Reckoning on a lectern, the clerics' stands, the offering chests and the bell.
- **Shrines and temples everywhere.** Every quarter has a shrine and every district a temple (boxes.js), and the periodic table gains a sixth period, the world, whose water element is the Temple.

## Layout

```
core/    given (every number), fixed (exact integers), field (the golden law), reversible (shear and record),
         globe (wrap and fold), wind, sea, boat, frames (the square's 8 symmetries, block states carried),
         tempo (the beat and phase plan), lod (near and far)
world/   map.png + map.js (the world), islets.json (the cays), islands (labels, hops, round-the-world),
         climate, biomes (vanilla's), traditions, architecture, peoples, load (lab side)
lab/     vanilla.js and Bedrock's block and item lists; legacy_census.json (the old mod's 28 timers)
tools/   lab.mjs (lenses, render), makeworld.mjs and makeislets.mjs (ran once), png.js
tests/   lab.test.mjs (every lens), inherency.json (the ratchet)
```

## Still to tune (the readings say so)

- The Koinon now makes all twelve kits, but every one sells out each month (demand outruns two masters a state), and Starward sometimes runs short of string.
- Explorers are slow: one round of eight landfalls takes longer than two game years.
- Little cargo is lost in contested waters (the danger radius is 6 chunks round border midpoints), and little comes back from Thera.
- The climate is cold-biased (Thera's latitude reads as taiga), fleet damage is widespread, slamming is rare in long seas, and 8 players at once exceed the tick slice even after shedding.
- Textures in game: check `VANILLA_NAME` and merge `variations.json` into `terrain_texture.json` under the right keys. Grass and leaves are drawn already coloured, so they need the grey-base tint convention.

- Thera: the southern "plain" is hillier than a filled basin probably was, and the bay is still a little round. Both are one landform's numbers in `THERA`.
- The frozen-ocean band starts by temperature, around 60°, well before `ICE_LAT`. That's probably right for pack ice, but say if you want open polar water further out.
- Boat feel: `HEEL_GAIN`, `SAIL_AREA` and the polar are first values.
- Not built yet:
  - the build sim on top of the grammar (Build, gates and frames are written, ready to port)
  - NPC voyages as closed-form routes
  - the promotion test (closed form = stepped at handover)
  - the game projection into a pack

## The add-on (Waterworld, v0.1)

`node tools/buildmod.mjs` builds `dist/Waterworld.mcaddon`. It copies the sim's pure modules
(core/, world/map, climate, biomes, solar, thera, game/) into a behavior pack unchanged, and it bakes
what the game can't work out cheaply: the map (a base64 row per chunk row), Thera's city plan
(world/city.js cityAt every 2 blocks, run-length coded), and Thera's structures (the Sea Rite Temple,
the Cold House, every people's quarter packed with its own houses, shrines, wells and bells, and the
Therans' houses on the cone and in their towns). Every block and state is checked against vanilla's
list as it's baked.

In the game a dimension of its own (`waterworld:sea`, the void generator) is laid chunk by chunk
around the players (mod/scripts/lay.js), with the same math the labs read (game/ground.js):
- the ground: its height from the map, and from Thera's own field inside its reach
- its make by biome, the sea floors, ice on the frozen seas
- trees by biome (one in 13 to 233 columns), grass and flowers
- reefs in the warm shallows (about two in five of that floor), kelp in the cool, seagrass

### Underground (game/strata.js)

Each chunk's rock is a **province**, read off what is already there: sea floor (sediment over
basalt), volcanic (Thera, and steep high tropical islands), limestone (warm and wet), dry, badlands,
cold, wetland and temperate.

- **Soil** follows the ground's surface.
- **Beds** lie flat below the soil, the way sediments settle. Their thicknesses follow the
  Fibonacci word (5 or 3 blocks, or 2 or 1 in the badlands): quasi-periodic, like real cyclothems.
  The golden sequence picks each bed's rock from its province's own. A slow fold of up to 8 blocks
  over 89-block swells bends them, down to vanilla's deepslate line.
- **Ores** form only where two beds meet, about one vein per 55 contacts. Which ores a place can
  have is world/biomes.js ORES, by how high the island's rock rises. Each rarer ore is 1/φ as likely
  as the one before it.
- **Caves** form only where something would make them:
  - karst tubes in limestone at the water table (y 59–62, half flooded)
  - lava tubes in volcanic rock, five blocks under the surface
  - no noise caves

The `underground` lens checks every province's column: it reaches the bedrock with no gaps, and
every block in it is vanilla.

## v0.2: Thera at its pinnacle, and its folk

- **Each people's best building** (world/pinnacle.js). Thera is where every people builds as close and as high as its own tradition allows:
  - five-storey town houses and Swahili/Hadhrami towers
  - three-storey Japanese, East Asian and Theran houses
  - the long one-storey halls of the Norse, bark-canoe, Pacific, great-dugout and Arctic peoples
  - storeys above the ground reached by a gallery and a ladder
  - the wall-to-wall builders leave a one-block lane, the rest two
- **The quarters** are the other peoples', never the Therans'.
- **The Therans** live in three places:
  - the ruling families in four-storey great houses on the cone's terraces
  - their towns across the island
  - the caldera wall
- **The caldera wall** is built up house over house. Peoples who really built on cliffs climb it from their own quarters: Therans (Fira, Oia), Europeans (Amalfi), the Indian Ocean (Hadhramaut), East Asians (the gorge villages). Houses are cut into the slope. The rest of the wall is the Therans', whitewashed (Santorini).
- **Thera's head-count** is whatever its quarters' ground and each people's building density hold. The world population is unchanged.
- **The folk** (world/dress.js, world/names.js): an entity of our own with 96 painted skins.
  - Each people's fibre, cut, dyes (its own, plus one bought dye), motif on the hem, and armour.
  - Ranks:
    - folk, the everyday dress
    - crafter, with an apron
    - elder, grey hair and a long garment
    - cleric, the one faith's sea-blue stole
    - guard, the people's own armour
  - Plus the Therans' rulers (murex purple and gold) and the League's 13 sea wardens at the Exchange and the quays.
  - One in eight of Thera's people stands in the city. Talk to one (use or tap) and they name their rite and offering.

## v0.3: the world's towns, and one command for the test server

- **Every people's town is built**: 493 towns with 21,454 houses.
  - Laid out by world/boxes.js townOf, each house the people's own.
  - Quarters that ran out of ground are densified a storey higher.
  - The hall is the people's great house; markets have stalls in the people's dye colour; temples are the district shrine; piers go out over the water.
  - Streets and plazas are paved on the ground as it lies, and the walls go up where the people's guard calls for them.
  - One in 21 townsfolk is shown (Thera: one in 8).
- **Thera's bay** has wider city blocks: lanes every 34 blocks, the old lanes' width.
- **The folk's arms** use vanilla villager_v2's own geometry and folded-arm pose (Mojang/bedrock-samples).
- **Climate colours**: the custom dimension has a single biome, so each climate's colours come from fog: vanilla's ocean water colour under water, and a haze for the land's climate. Two in five grass columns also show their biome's own ground (coarse dirt, moss, mud, podzol, gravel).
- **Names**: the north-west coast's folk go by their moiety (Raven or Eagle). Personal names there belong to clans and go with rank, so none are made up.
- **`ww`** (the kit's root) is one command for everything:
  - `ww setup` and `ww new`: carte blanche
  - `ww update` and `ww update --new`: install an update
  - `ww watch`: live messages and errors
  - `ww report`: everything for the chat, copied to the clipboard
  - `ww status`, `ww stop`, `ww start`, `ww cmd`

## Architecture sweep (10 Nov 2026, v0.3.1)

**Layers as they stand**
- **core/** is the law (golden, clock, globe, wind, noise).
- **world/** is the sim, pure and tested by the lab's lenses.
- **game/** is what the game lays (ground, strata). Both the bake and the game read it, so they can't disagree.
- **tools/buildmod.mjs** bakes the static world into the add-on.
- **mod/scripts** is the game side (dimension, laying, folk, HUD, commands).
- **dev/** and **ww** are the test server.
- **tools/modtest** runs the built add-on's laying in Node against vanilla's full block and state list (`npm run modtest`).

**Fixed in the sweep**
- One definition of the Therans as a people (world/therans.js `theranPeople`). It had been copied four times.
- game/ground.js reads world/sealife.js's habitat numbers instead of restating them, and the add-on now carries sealife.js.
- The bake fails if world/city.js returns a kind that game/ground.js's grid doesn't know.
- The baked data dropped from 24.6 MB to 7.4 MB:
  - streets, plazas and town walls are stored as shapes, and the game finds their blocks
  - placements are stored as arrays instead of objects
- Re-laying a chunk clears its folk first, so they don't double.
- Town walls are indexed only by the chunks their line crosses.
- The great-dugout people are now the north-west coast throughout:
  - the cedar plank house (the longhall law)
  - Ravenstail diamonds
  - a north-west palette (red ochre, charcoal, copper green, shell)
  - square-built (roundness 0.1)
  - named by moiety

**Found, not yet fixed**
1. **The game is a still picture of month one.** The economy, the sea's stocks and reefs, the solar rite, the wardens and the year's end don't run in the game. The HUD's clock turns, but nothing answers it. The next big architecture step is a server-side tick that runs the month (world/economy.js, world/sealife.js) as a job and writes what changed back into the blocks: reefs, kelp, closures, festivals.
2. **Thera's layout lives in the bake.** The packing of quarters, cliffs, great houses and towns is in tools/buildmod.mjs, so the lab can't test it. world/boxes.js theraBoxes is now only used for the Temple and Cold House positions; its dock quarters are dead code. The packing should move into a world module (world/theracity.js) with its own lens.
3. **tools/buildmod.mjs is a 430-line monolith.** It should be split into bake steps (map, city, structures, towns, folk, packs).
4. **A people's materials come from its biome.** world/peoples.js's build, roof cover included, can fight its tradition's real materials: the north-west coast's plank house has a moss roof where it should be cedar planks. A tradition's materials should override where it has them.

## v0.4: the feedback loop (sim -> game -> probes -> calibrate -> sim)

- **The server measures itself** (mod/scripts/probe.js). It writes one JSON line per measurement to its log (`[WWPROBE] {...}`):
  - the cost of each chunk laid
  - the frame rate and the number of folk loaded, every minute
  - any monster that spawns where folk live
  - for each test site: the ground where the sim says it is, the light at every folk's spot, and the folk found against those expected
- **The soak** (`ww soak`): the server tours its own sites with no player needed. A ticking area holds each site loaded while the server lays it, lets it settle and checks it. The sites are the city's landmarks, the first folk of every people in Thera and in the towns, and three seas.
- **The calibrator** (`node tools/calibrate.mjs probes.jsonl [--node dist/modtest-probes.jsonl] [--apply]`):
  - Each knob in game/calibration.js has a ladder of lawful values (Fibonacci numbers) and a model of what it does to something measured:
    - the ring's laying time ∝ (2R+1)² × ms a chunk
    - the frame rate = 20 / (1 + a × folk)
    - light against the house law
  - The probes fit the model's one unknown, the model picks the rung that meets the target (a 21 s ring, 19.05 ticks a second, nobody in the dark), and the knob moves one rung toward it.
  - It is damped: never more than one rung a step, and only on five probes or more.
  - It is reversible: the history keeps every step's from and to.
- **Laws are never tuned.** A hole in the ground or folk missing is reported as a bug.
- `npm run modtest` writes Node's chunk costs too, so the calibrator also learns how much slower the game is than Node. Node's numbers then predict the game's.
- The `loop` lens checks the loop's own rules: every knob is on its ladder, and every step is one rung.
