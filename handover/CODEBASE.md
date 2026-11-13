# Codebase map

_Regenerated in S001 from waterworld-update-0.9.13.zip._

Generated from each file's own header comment (the code documents itself; this is just the index). Built pack layout (BP/scripts). In the source tree these come from mod/scripts (entry files), core/, world/, game/, ship/BP/scripts (ship/), and data/ is written by tools/buildmod.mjs.
Regenerate after big changes: `bash handover/bin/codemap.sh path/to/BP/scripts > handover/CODEBASE.md`.


## Entry and engine glue

| File | Size | What it says it is |
|---|---|---|
| `main.js` | 477 lines | Waterworld: the golden-law world in the game. A dimension of its own ("waterworld:sea"), laid chunk by chunk around the players from the sim's own math (game/ground.js over world/map.js, world/thera.j… |
| `lay.js` | 281 lines | Lays the world's chunks in the game, from game/ground.js, in three passes a chunk can stop between (rings.js says which a chunk needs, by how near a player is): |
| `rings.js` | 66 lines | The rings: how much of the world is laid, and how much of it lives, by how near a player is (core/lod.js's levels, read for the laying). Rings are Chebyshev distances in chunks from the nearest player… |
| `tempo.js` | 42 lines | The tempo in the game: the server's periodic duties on core/tempo.js's beat. Every period divides the bar (200 ticks, ten seconds: the harmonic gate), so duties that exchange data meet on shared beats… |
| `probe.js` | 64 lines | The server's probes: what the game actually did, written to the server's log as one JSON line each ("[WWPROBE] {...}"), for the feedback loop (ww probes -> tools/calibrate.mjs). Every probe says what … |
| `bank.js` | 49 lines | The League's counter (world/coinage.js): use a League Counter block and its book opens. Coin is change at par (a stater for thirteen drachmas, a drachma for eight obols, and back); the bank buys emera… |
| `b64.js` | 14 lines | base64 to bytes (the game's scripts have no atob) |

## core/ — the pure math (no Minecraft imports)

| File | Size | What it says it is |
|---|---|---|
| `core/boat.js` | 243 lines | Pure. A hull under sail and helm, on the globe, as one reversible step (reversible.js). Everything a hull does follows from its length L (blocks = metres) and its rig, through the |
| `core/clock.js` | 50 lines | Pure. The world's one clock: every system keeps time by a rung of this ladder, and only by it. Every rung of the year is one of the golden law's own periods (field.js pisano): the year is 360 |
| `core/cycles.js` | 82 lines | Pure. The two-layer universe from Seedworld (v9), as the engine of anything that lives and changes in cycles: cultures, borders, fortunes. Everything here is trits and exactly reversible. |
| `core/field.js` | 65 lines | Pure. The one law and its arithmetic (Seedworld; project docs seedworld-findings and 6d-to-1d-map): trits mod 3, the golden 2x2 F, brick-wall on a Mobius loop. The rest of the world |
| `core/fixed.js` | 24 lines | Pure. Exact integers: the state of anything that moves is held in fixed point (Q units a block, TURN units a turn), so a step and its undo are the same arithmetic run backward, bit for bit. |
| `core/frames.js` | 99 lines | Pure. Frames as matrices: every way a build can be set down on the block grid is one of the eight symmetries of the square (four quarter turns, each with or without a mirror), a 2x2 integer matrix |
| `core/gates.js` | 30 lines | Pure. The gate engine: every decision in the world is a list of gates, the same shape as the cultures' building rules: { must / prefer: name, test: (subject, ctx) -> boolean / number, weight?, why } |
| `core/given.js` | 143 lines | Pure. Every number the world is made of, in one of three kinds, and no fourth: GIVEN what Minecraft or the Earth fixes. Not ours to change. VISION what we choose. Ratios, or multiples of a given, each… |
| `core/globe.js` | 50 lines | Pure. The globe: a sphere drawn on an equirectangular map (about 91 blocks a degree, north-south everywhere and east-west at the equator), x east in [0, W), z south in [0, H) from the north pole. |
| `core/golden.js` | 57 lines | Pure. The golden toolkit for drawing: closed forms, cheap, every one periodic on a tile or never repeating at all, each a face of the one law F = [[1,1],[1,0]]. |
| `core/lod.js` | 53 lines | Pure. Near and far: the world is the math everywhere, and only rendered where someone is. Every system says what it needs at each distance (in chunks, the nearest player's): |
| `core/noise.js` | 40 lines | Pure. Smooth value noise on the plane, for natural detail (a coast's ragged edge, gullies, lava lobes). Deterministic: a fixed integer hash, no seed: the same point always gives the same value. |
| `core/patterns.js` | 115 lines | Pure. Natural patterns, every one periodic on a square of side n (so a texture made of them tiles exactly), and as many as can be drawn from the golden law itself rather than from outside it. |
| `core/reversible.js` | 58 lines | Pure. The step machine: every law is a list of ops, and an op is one of two kinds. shear s[key] += by(s, ctx) by must not read s[key]. Undone by s[key] -= by(s, ctx), the |
| `core/sea.js` | 111 lines | Pure. The sea: tide, waves, currents. Each is a function of place and tick only (no state), so each is reversible by construction: run the clock back and the sea is where it was. |
| `core/sight.js` | 61 lines | Pure. What a player can see, ring by ring, and what that lets us spend where: the "spectrum" of sight. Two facts make it golden: resolution a block d blocks away is about PX_PER_RAD / d screen pixels … |
| `core/tempo.js` | 115 lines | Pure. The beat: one clock every timer in the mod keeps time by, so work that exchanges data meets on shared beats, and heavy work never lands on the same tick by accident. |
| `core/wind.js` | 58 lines | Pure. The wind: the planet's belts, no weather. Where the real ones lie (VISION.BELTS): calm at the equator, steady trades from the north-east (south-east below the line), calm horse latitudes, |

## world/ — the world's fields, read from the map

| File | Size | What it says it is |
|---|---|---|
| `world/biomes.js` | 92 lines | Pure data and its one rule. Vanilla's biomes, as the climate places them, and what each gives a people: the only place resources enter the world. Every id is vanilla's (the vanilla lens checks |
| `world/boatsizes.js` | 108 lines | Pure. The sizes of every people's boats, and what those sizes ask of the shore. No hulls are drawn here: the ships themselves are entity models (the ship module, after Shipwright's own: RP/entity), no… |
| `world/climate.js` | 125 lines | Pure (given a loaded map). A chunk's climate, from the base fields and nothing else: heat from latitude (the sun), cooled by height (lapse), and warmed by the Therans' solar |
| `world/coinage.js` | 39 lines | The coinage (the user's word, 12 Nov 2026): the Therans strike coin and stamp metal at the refinery and mint under the cone, from the ore of the impactor buried beneath it (world/impact.js); the Leagu… |
| `world/homesites.js` | 38 lines | Pure. The homeports the League charts for joining players (tools/makehomeports.mjs lays them; world/homeports.json keeps them): where each stands, its pad levelled into the ground round it, and its lo… |
| `world/map.js` | 136 lines | The world map: one pixel a chunk, 2,048 x 1,024, grayscale. It is the world (static, painted, not seeded). The legend, for anyone painting it: 0 .. 99 sea, depth (100 - value) blocks below the sea's l… |
| `world/rivers.js` | 149 lines | Pure (given a loaded map). The rivers: rain run down the map's own heights, region by region, then cut into the ground at block scale. the flood every hollow drains: a priority flood from the coast in… |
| `world/sealife.js` | 220 lines | Pure (given a loaded map). The sacred sea: its life, its reefs, and its keepers. The sea is sacred, and what keeps it is the same law that runs the world: the golden line. Its |
| `world/solar.js` | 54 lines | Pure (given a loaded map). The Therans' solar rite: the warmth the world runs on. The world's sun (climate.js: heat falls with latitude) leaves the middle latitudes cold: Thera |
| `world/stones.js` | 50 lines | Pure. The stepping stones, at block scale: the islets that keep a small boat's crossings to VISION.CROSSING (320 blocks) on its route round the world, hidden among decoys (tools/makestones.mjs lays th… |
| `world/thera.js` | 179 lines | Pure. Thera before the eruption: the natural island, from its geology, before anyone builds. Grounded in the current reconstruction (Karatson, Gertisser, Druitt, Nomikou et al., Scientific |

## game/ — what the game lays (ground, rock, Theran buildings)

| File | Size | What it says it is |
|---|---|---|
| `game/calibration.js` | 17 lines | The knobs the feedback loop may turn (tools/calibrate.mjs writes this file; nothing else should). Each is a vision number with a ladder of lawful values (Fibonacci numbers): calibration only ever move… |
| `game/cothon.js` | 86 lines | The Theran cothon: the great round harbour as one building, after Carthage's: a ring of covered shipsheds round a round basin, two storeys under one roof, a colonnade of white columns along the basin'… |
| `game/ground.js` | 275 lines | Pure (given a loaded map and, for Thera, the baked city grid). The ground the game lays: a column's top, what it is made of, and what grows on it, from the same math the labs read (world/map.js, |
| `game/skyway.js` | 112 lines | The skyways as blocks (world/theraplan.js skyways(): the cone-to-caldera trees), drawn as one network. Pure: given the ways (each its points in the world's blocks [X, Z, y] and its rank) and the groun… |
| `game/strata.js` | 144 lines | Pure. What lies under the ground, from the top to the bedrock: not vanilla's noise caves and scattered ores, but a column a geologist would recognise, from three rules: |
| `game/theranciv.js` | 218 lines | The Therans' summit buildings as voxels (claude/thera-redesign.md; sizes from tools/theramath.mjs's least, each a Fibonacci number). Pure. Each returns a Map "x,y,z" -> { id, s } with its floor at y 0… |
| `game/therantrees.js` | 85 lines | Pure. The Therans' own trees, in vanilla blocks, each a voxel shape grown from a seed: lefka the white poplar (Populus alba; Greek λεύκα): a tall column of a tree, its bark white with dark |

## ship/ — Shipwright, folded in as the ship module

| File | Size | What it says it is |
|---|---|---|
| `ship/boatblock.js` | 287 lines | Boatblock: Shipwright's castaway way to play, in the same world as everything else. Everyone arrives at the homeport (world/homeport.js). From there you can sail out into the world, |
| `ship/body.js` | 63 lines | The ship as a body: the sum of its parts. (The physics project's rule for things that act at the same time: they add.) Each part has a mass and a place (along the hull from the centre, + forward; |
| `ship/boot.js` | 33 lines | Starting the pack's systems so that one failing never takes the rest down, and saying which did. Every system starts through start(name, fn). A system that throws is recorded and the others start |
| `ship/build.js` | 428 lines |  |
| `ship/buoyancy.js` | 168 lines | Safety net for floating. The faering's minecraft:buoyant component keeps it on the surface; this acts only when a launched boat is clearly underwater (more than half a block below the real water surfa… |
| `ship/charts.js` | 400 lines | Charts, keys and treasure. Chart book (shipwright:chart_book): yours, kept on you (a player property). Marks (home waters, coves, wrecks, shoals, treasure, your own) and soundings (the shallowest wate… |
| `ship/checks.js` | 227 lines | The pack's self-checks: the math's own promises, checked by running the math. Every law and every plan in Shipwright makes promises that can be checked without the game: a heel |
| `ship/chest.js` | 152 lines | Personal sea chests, like ender chests, opened through the chest built into every boat. Each player's belongings live in their own vault chest: an owner-locked entity kept in a small, |
| `ship/crew.js` | 568 lines | What the crew does with the fitted modules: sleep aboard, keep a lookout, ram, fight from the castle and the rail, fire the crossbow and the guns, and work a wreck under the diving bell. |
| `ship/deck.js` | 349 lines | Walkable decks for medium and large ships. Bedrock can't carry a walking player along on a moving entity, so a ship's deck is walkable while it's stopped: anchored, tied up with a lead, beached, or ly… |
| `ship/devtools.js` | 429 lines | Developer commands, run in game or from the server console: scriptevent shipwright:selftest builds a test beach in the sky and checks everything scriptevent shipwright:showcase lays out one boat per b… |
| `ship/dims.js` | 3 lines | Every dimension Shipwright works in: the vanilla three and the sea world. |
| `ship/dock.js` | 279 lines | The Dock (yard level 2): built like a Nether portal laid flat. 1. Dig a basin at the shore, at least 2 deep, 3 to 7 wide and 8 to 24 long. 2. Ring it with a frame one block wide at ground level: logs,… |
| `ship/edit.js` | 379 lines | The edit screen: fitting out a new boat and editing a launched one. The boat on top, then an arrow button for each part: sail, propulsion, power, anchor, each module category, and the hull. |
| `ship/frame.js` | 56 lines | Frames: every position in Shipwright is measured from a zero we chose, and moving from one frame to another is one function, here. (The physics project's rule: no position is absolute; the map |
| `ship/grid.js` | 104 lines | The deck grid. A hull is a row of one-block stations between its two ends: the helm takes one, a rigged medium or large ship's mast takes one, and deck modules take one, two or three, with a |
| `ship/handling.js` | 260 lines | Turns a ship record into handling numbers. Everything comes from how the boat was built: length, beam, depth, the wood in each zone, and the rig. Units: speeds in blocks per tick, turn rates in degree… |
| `ship/inventory.js` | 154 lines | A cost is { ids: string[], count: number, label: string }. |
| `ship/knowledge.js` | 46 lines |  |
| `ship/laws.js` | 156 lines | The laws: one tick of a boat's motion, as pure functions. Each takes the state and the inputs and returns the next state; none of them touches the game. The steering reads the game (wind, water, |
| `ship/logbook.js` | 61 lines |  |
| `ship/main.js` | 332 lines | Shipwright, folded into Waterworld as its ship module: event wiring only. Logic lives in the modules below. Waterworld lays the world, so Shipwright's own sea dimension, its pre-generation, its probe,… |
| `ship/orientation.js` | 52 lines | Keeps the model pointing the way the boat actually faces. Which correction the engine needs is checked in game: cycle with /scriptevent shipwright:orient |
| `ship/orientmode.js` | 18 lines | The world's orientation mode, shared by the model (orientation.js) and the seats (ship.js). |
| `ship/ourmath.js` | 62 lines | The ship module on Waterworld's math. Shipwright's steering keeps what it does well (the helm's input, seats, contacts, the anchor, wear, the projection onto the entity); how fast a hull goes under sa… |
| `ship/pregen.js` | 152 lines | Pre-generation: the server lays the sea world ahead of time, so nobody waits on the math. The world is fixed by its seed (every block is a pure function of it), so there's nothing to |
| `ship/probe.js` | 137 lines | The probe: measures this device's limits (world/limits.js MEASURED) in the game itself, so the pacing is worked out from what this Switch or server really does, not a guess. |
| `ship/props.js` | 71 lines | Entity properties, under Bedrock's limit of 32 per entity (over it, the game rejects them all and the boat can't be drawn). Small values share a number: each logical name is a "digit" of a |
| `ship/purchase.js` | 16 lines | Paying for things at the table: materials come from the supply chest first, then the player. |
| `ship/seaworld.js` | 718 lines | The sea world: a dimension of our own, generated by our math (world/*.js) around the players as they sail, instead of the vanilla terrain. Open ocean, archipelagos and great islands, climates |
| `ship/shields.js` | 170 lines | Mounted shields: real Minecraft shields on a shield rail, one each side of every hull section. A shield hangs on a peg: a small invisible entity holding the shield item, placed on the hull's |
| `ship/ship.js` | 589 lines |  |
| `ship/stages.js` | 90 lines | Build-stage state changes with no UI and no costs. The table menus call these after taking materials; the self-tests call them directly. |
| `ship/steering.js` | 1254 lines | Script-driven sailing. The helmsman's stick sets throttle (forward/back) and turning (left/right). The script owns the heading: it never rotates the entity |
| `ship/tender.js` | 242 lines | Ship's boats: a great ship carries her small boats with her, the way each tradition did. in tow any small boat, on a line astern (two at most, one behind the other): Norse |
| `ship/theran.js` | 60 lines | The Therans in play: the welcome to Strongyle, and the peoples' harbour tales. Every player is Theran (config/theran.js): they arrive at the round isle, and the rest of the sea |
| `ship/ui.js` | 52 lines | All @minecraft/server-ui calls live here. Signatures follow server-ui 2.x (option objects for slider, dropdown, toggle, textField). If you target an older build, only this file needs to change. |
| `ship/version.js` | 2 lines | Written by tools/package.py. The version these scripts were packaged as. |
| `ship/village.js` | 64 lines | Village docks (yard level 2): the buildings of a vanilla village of the dock's biome, sized for work and nothing more. A boat shed with a net loft facing the dock, a fisher's cottage on the port |
| `ship/warn.js` | 18 lines | Throttled warnings: each kind of failure is logged at most once a minute, so an error that repeats every tick can't flood the server log. |
| `ship/wind.js` | 252 lines | Wind from the world's biomes, plus sail physics. Two small tables: 1. BIOMES: every biome falls into one of 5 temperature classes and 3 surfaces. 2. RIGS: every sail falls into one of 2 families with … |
| `ship/yard.js` | 408 lines |  |
| `ship/yardarch.js` | 931 lines | Yard architecture: each tradition's buildings and gathering places around its dock. Every building is drawn in its own frame, so the same building can stand by a dock today and in |
| `ship/yardbuild.js` | 390 lines | Yard upgrades: the table plans a dock, prices it by material category, and builds it for you: clears the headroom, digs the basin, raises the walls, sets the fittings and floods it. |

## ship/config/ — boat traditions, yards, plans, culture gates

| File | Size | What it says it is |
|---|---|---|
| `ship/config/culturegates.js` | 143 lines | Pure data. Each tradition's rule gates: how its people lay out a shipyard quarter, written as rules the homeport's culture agents (world/portsim.js) must pass ("must") or try for ("prefer"). |
| `ship/config/materials.js` | 84 lines | Pure data. Wood order must match tools/gen_assets.py (texture array indexes). |
| `ship/config/modules.js` | 126 lines | Pure data. Modules fill a boat's slots (small 2, medium 3, large 4). sizes: which hull sizes can take it tradition: a culture special, unlocked by learning it |
| `ship/config/plans.js` | 241 lines | Pure data. One entry per buildable plan. Code never hardcodes a boat. Looks (hull profile) live in tools/gen_assets.py; this file is how each boat builds and handles. |
| `ship/config/power.js` | 19 lines | Pure data. The power slot: a vanilla furnace block that works the oars through cranks. pull: how hard it drives the oars top: top-speed multiplier under power |
| `ship/config/proportions.js` | 1396 lines | Generated by tools/gen_boats.py from the same inputs as the boat models. Do not edit. beam, depth, mast, oar: blocks at model scale 1. sail: each rig's area at rig scale 1, square blocks. |
| `ship/config/sea_people.js` | 64 lines | Pure data. Who else sails: villager crews (each village biome's own boats, friendly) and the sea Illagers (raiders, by era; level 3 are the bosses). Every crew ship carries two people who matter: |
| `ship/config/theran.js` | 77 lines | Pure data. The Therans: the people of Strongyle, the round isle, and the summit of Shipwright's world. Every other seafaring tradition in the game is grounded in a real one; the Therans are the |
| `ship/config/villages.js` | 84 lines | Pure data. Village docks (yard level 2): the look of the vanilla village of the biome the dock stands in, so a dock fits the village it's built beside. Every id here is a Bedrock id (the lab |
| `ship/config/yards.js` | 40 lines | Pure data for yard detection. |
| `ship/config/yardstyles.js` | 73 lines | Pure data. Dock styles: one per tradition, built from its own biome's blocks, plus Custom. Working waterfronts only: no sacred or ceremonial structures (no torii gates, shrines or carving). |

## ship/world/ — Shipwright's world modules (homeport, port agents, peoples)

| File | Size | What it says it is |
|---|---|---|
| `ship/world/biome.js` | 16 lines | Pure. The sea world has no biomes of its own (a custom dimension is all one), so everything that asks "what biome is this?" (village docks, wind) asks the world's own climate instead and |
| `ship/world/biomes.js` | 166 lines | Pure. Biomes, from the base fields (fields.js) and the ground (terrain.js): heat (with height) and moisture (with rain shadow) pick a land biome, the way a Whittaker diagram does; heat and |
| `ship/world/chunkgen.js` | 374 lines | Pure. One 16x16 chunk of the sea world, worked out as columns and blocks. A column, bottom up: bedrock; deepslate to y 24; stone, with ores at the depths vanilla keeps |
| `ship/world/fields.js` | 161 lines | Pure. The base fields of the sea world: the few quantities everything else is derived from. latitude z is north-south (north is -z). The world is a planet folded flat: from the spawn's |
| `ship/world/homeport.js` | 1005 lines | Pure. Strongyle: the homeport, the round isle of the Therans (config/theran.js), where every player arrives, and where the seafaring peoples meet to trade, talk and build. |
| `ship/world/lattice.js` | 100 lines | Pure. The sea world's fields on a coarse lattice. The game runs scripts in an interpreter, where the full field math (islands, heat, moisture, biomes) costs about half a millisecond a point; a |
| `ship/world/life.js` | 73 lines | The sea world's life. Its dimension spawns nothing of its own, so it's brought in near each player, a few at a time and never past a cap, by the biome a spot lies in (biomes.js): fish, squid, |
| `ship/world/limits.js` | 143 lines | Pure. Minecraft's limits, as the units the sea world's laws are written in. Three kinds of number, and no fourth (the inherency lens, tools/lab/inherency.mjs, lists the rest): |
| `ship/world/noise.js` | 55 lines | Pure. Deterministic randomness for the world: an integer hash, smooth value noise and fractal noise. Everything about the sea world is a function of the world seed and a place, so any part of |
| `ship/world/peoples.js` | 306 lines | Pure. Who lives on the sea world: confederations of island groups. Each confederation has a capital group, a culture (one of the Shipwright traditions, chosen by the capital's climate), and |
| `ship/world/portsim.js` | 546 lines | Pure. The culture agents who build Strongyle's lagoon quarters. Each seafaring tradition sends one agent to the homeport. The agents take turns: each lays its |
| `ship/world/reach.js` | 91 lines | Pure. The Drowned Reach: Boatblock's sea, a region of the same sea world where the archipelagos lie drowned. The island groups are where the math puts them, with their climates and peoples, but |
| `ship/world/sealaws.js` | 72 lines | Pure. Boatblock's sea laws (the Boatblock doc's laws 2, 4 and 5), in the limits' units (limits.js): tide two highs a Minecraft day; the range grows over shelves; the phase sweeps across the |
| `ship/world/sites.js` | 111 lines | Pure. What lies in the sea: wrecks, sunken harbours and flotsam. One candidate per 96-block cell, kept or not by where it falls: wrecks gather along sea lanes and on shoals (where ships were lost), |
| `ship/world/spawn.js` | 81 lines | Pure. Where a new arrival comes ashore: a beach of the nearest gentle island group to the middle of the world, by water a boat can be launched in, where two peoples' waters meet, so the world shows |
| `ship/world/structures.js` | 306 lines | Pure. The sea world's great structures: what vanilla's overworld offers, taken to sea. fortress the stronghold. Three on a ring 1,400-2,800 blocks out from the spawn, each a keep on |
| `ship/world/terrain.js` | 210 lines | Pure. The ground of the sea world: open ocean with archipelagos (clusters, chains, atolls in warm water, volcanoes over hot spots, the odd mushroom isle far from anyone), now and then a great |
| `ship/world/underground.js` | 111 lines | Pure. Under the islands, worked out cheaply: caves as worm tunnels, a few per bigger island, winding down from near the surface to lava pools at the bottom (worked out once per island, as a |
| `ship/world/vision.js` | 64 lines | Pure data. The vision of the sea world, as numbers the balance lab holds the world to. If the world drifts from these, the lab fails: the vision is the specification, not a mood board. |
| `ship/world/wrecks.js` | 204 lines | Pure. Building the sea's sites as blocks: a wreck of a real Shipwright ship (her lines, her tradition's wood, lying on the bottom with a list, sometimes broken in two, her mast down beside |

## data/ — BAKED by tools/buildmod.mjs. Never hand-edit.

| File | Size | What it says it is |
|---|---|---|
| `data/city.js` | 0.1 MB | baked by tools/buildmod.mjs: world/city.js cityAt over Thera, kinds (game/ground.js KINDS) run-length coded [kind, n lo, n hi]; the Arctic tarn |
| `data/faith.js` | 0.0 MB | baked by tools/buildmod.mjs from world/faith.js |
| `data/folk.js` | 0.3 MB | baked by tools/buildmod.mjs: Thera's folk [x, y, z, skin, people (index in CULTURES, -1 the League), n] |
| `data/grown.js` | 0.0 MB | baked by tools/buildmod.mjs from tools/bakegrown.mjs's settlements: per chunk "cx,cz" a base64 of a 32-byte no-tree mask, the lowest y (u16, + 64), the chunk's kinds (u8 n, u16 index in data/structure… |
| `data/map.js` | 2.8 MB | baked by tools/buildmod.mjs from world/map.png: one base64 row a chunk row |
| `data/structures.js` | 18.9 MB | baked by tools/buildmod.mjs: Thera's structures. palette [id, states?]; protos: f, base64 of an Int16Array [x, y, z, palette index, ...] (decoded when first laid: lay.js flatOf), and bounds; |
| `data/terrain.js` | 3.4 MB | baked by tools/buildmod.mjs: the rivers' cells (world/rivers.js useDrainage) and each map cell's distance from the sea (cells, a byte, run-length coded [v, n lo, n hi]) |
