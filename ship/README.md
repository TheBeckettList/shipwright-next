# Shipwright (MVP)

Historical boatbuilding for Minecraft Bedrock, built from vanilla materials. This MVP covers one plan, the Norse faering, through the full loop: learn, build in stages at a beach yard, launch, sail, refit, and break for a refund.

## Install

1. Double-click `shipwright.mcaddon` (or import both packs).
2. Create a world with both packs enabled. Script modules need no experimental toggle on builds that ship `@minecraft/server` 2.0.0 stable; if the packs fail to load, check the version notes below.

## Try it

1. Craft a **Shipwright's Table**: three planks on top, then stick, crafting table, stick.
2. Place it on a beach so a strip 3 wide and 3 high runs from the table to the water. Particles outline the yard; a lava particle marks anything in the way.
3. Carry spruce logs and use the table. You learn the Norse tradition.
4. Build: keel (length 4–10), frames (beam and depth), planking (wood per bow, midship, stern), rig (optional square sail in any wool color), name and launch.
5. Ride it. Use the table again to refit a section or inspect the boat. Sneak while using the table to place blocks against it.

Costs for a 7-block faering with a sail: 3 spruce logs, 14 sticks, 21 planks, 14 iron nuggets, 3 wool, 2 string. Creative mode skips costs.

## Local dev server (Mac with Docker, play from Switch)

The server in `dev/` runs the packs straight from `BP/` and `RP/`, so most edits need a reload, not a repackage.

**Docker Desktop settings (once):** Settings, Resources, Network: turn on host networking. On Apple Silicon also turn on Settings, General, "Use Rosetta for x86_64/amd64 emulation". Apply and restart Docker.

**Start from a clean slate:** in Terminal, `cd` into the `shipwright` folder and run

```
bash dev/fresh.sh
```

It stops any old server, deletes the old server files and world, links the Shipwright packs, downloads and starts the server, and waits until it's ready. When it finishes it prints the version, your Mac's IP, and whether the port is visible. If anything fails it writes `dev/fresh-log.txt`; paste that into chat.

**Join from a Switch:** run `bash dev/connect.sh`. It switches the server to a published port (remembered from then on), restarts it keeping your world, sends a real Bedrock ping to confirm the server answers on your network, checks the macOS firewall, looks up BedrockConnect's DNS address, and prints the Switch steps with your Mac's IP filled in. The server and Switch must be on the same Minecraft version.

The dev world uses normal terrain, creative mode, cheats on, and every player is an operator. Set `LEVEL_SEED` in the compose files to pin a seed; a new seed or terrain setting only applies after `bash dev/fresh.sh` (which deletes the world). In game, `/locate biome ocean` and `/locate biome taiga` find water and spruce.

| You changed | Run | Then |
| --- | --- | --- |
| Downloaded a new `shipwright-update.zip` | `bash dev/refresh.sh` (add `--wipe` for a clean world) | Rejoin |
| Anything in `BP/scripts` | `bash dev/dev.sh reload` | Keep playing |
| BP JSON (entity, block, recipe) | `bash dev/dev.sh restart` | Rejoin |
| Anything in `RP` (models, textures) | `bash dev/dev.sh rp` | Rejoin; the version bump forces a fresh download |
| Something is broken | `bash dev/fresh.sh` | Clean slate |

Other commands: `bash dev/dev.sh up` (start, keep world), `down` (stop), `connect`, `logs`, `status` (pings the server locally and on your network), `ip`.

### Self-tests

With you in the world, run `bash dev/dev.sh test` (or type `/scriptevent shipwright:selftest` in game). It builds a small beach about 24 blocks above you and checks yard detection, the blocked-yard case, every entity property, all build stages, launch, riding, and floating, then prints PASS and FAIL lines. `bash dev/dev.sh results` prints the latest output; paste it into chat for a fix.

- `bash dev/dev.sh showcase` lays out seven labeled boats: one per build stage plus shortest, longest, and narrow-deep hulls. Use it to check the model visually.
- `bash dev/dev.sh cleanup` removes test boats and test sites.

### Node tests (no game needed)

`npm test` runs the logic against mocked Minecraft modules: yard detection, costs, the full menu flow, resume after closing a form, refits, refunds, and the in-game self-test itself. Run it before every reload.

### The lab (no game needed)

The lab rebuilds things from the same code the game runs and looks at them through lenses. `npm test` runs every lens; run them yourself to see the detail.

- `node --import ./tests/mocks/register.mjs tools/lab/yardlab.mjs [style|all] [--dump dir]` builds each culture's yard on the test grid. A 2-block observer walks it from the walkway (can it reach every workplace, bed and hearth, and where does it have to jump or crawl); the gaps lens finds roof holes and floating blocks; the overlaps lens finds two parts claiming one block.
- `python3 tools/lab/view.py dump/norse.json out.png` draws a dumped yard from two corners and from above.
- `node --import ./tests/mocks/register.mjs tools/lab/uselab.mjs [boat ...] [--depth lo|mid|hi]` takes every boat out and uses it: seats over a hull, the helm's eye over the rail, the lee rail dry at the hardest heel, the deck you stand on, and that she gathers way and turns both ways.
- `node --import ./tests/mocks/register.mjs tools/lab/fightlab.mjs [boat ...]` fights with every ship: item ids, broadsides (range, striking where aimed, sinking, bulkheads, chain shot), rams along a whole hull, crossbows over the rail, crew modules, gear, and that every module does something.
- `node --import ./tests/mocks/register.mjs tools/lab/worldlab.mjs [seed ...]` checks the sea world: land share and climates, confederations and lanes, wrecks on the lanes, a launchable spawn, laid chunks block by block, and chunk speed.
- `node tools/lab/worldmap.mjs [seed] [size] [blocks per pixel] out.ppm [--biomes]` draws the sea world as a map (depth, climate or biomes, lanes, peoples).
- `node --import ./tests/mocks/register.mjs tools/lab/runlab.mjs [seed] [--ticks n] [--speed b/t] [--heading deg] [--budget ms]` runs the sea world's own timers and jobs tick by tick with a player sailing flat out: whether the generator stays ahead of her, the slowest job step and what it was doing, each timer's cost, the game calls a chunk takes (costed by a model of the game's native calls), and a boat's wind.
- `node --import ./tests/mocks/register.mjs tools/lab/balancelab.mjs [seed ...] [--json out.json]` holds the world to the vision (`BP/scripts/world/vision.js`): land and biome shares, peoples' shares (across seeds), what a new player meets near the spawn, the gaps between new things on a straight sail, the wind belts, and how far to sail for everything vanilla's overworld offers up to the portals.

- `node tools/lab/qjs.mjs tools/lab/mcsim.mjs [--seed n] [--load chunks] [--budget ms] [--kappa k] [--heading deg]` runs the sea world under QuickJS (the game's interpreter) as the game runs it: loaded radius, job slice, watchdog, native costs. The device it plays is the probe's reading (`BP/scripts/world/limits.js`); `--kappa 2` plays a device half as fast as the lab. It lists spikes, steps over a fifth of a spike, and void seen through the haze.
- `node tools/lab/inherency.mjs [--files]` counts the free numbers: those that are neither Minecraft's givens, our vision, nor derived by a law (`limits.js`). The count is a ratchet in `tests/inherency.json`.
- `node tools/lab/qjs.mjs tools/lab/probelab.mjs` times the probe's yardstick under QuickJS (the probe's `REF_MS`).

The sea world: players are brought into `shipwright:sea`, a dimension generated by `BP/scripts/world/` around them as they sail. `/scriptevent shipwright:seaworld off|on|go|where` switches it, takes you there, or tells you where you are (climate, confederation, tradition).
- The yard lab's exit lens launches a ship in each built dock and sails it out through the mouth.
- `python3 tools/lab/boatlab.py [boat ...]` checks every boat model: the planking runs closed from stern to bow, and no two faces share a plane (which flickers in game).
- `python3 tools/lab/boatview.py carrack out.png` draws a boat side-on and from a corner, at its true size beside a player.

### In-game calibration

- `/scriptevent shipwright:mode port|boatblock` sets where newcomers start: at the homeport (default) or on the crew's castaway raft in the Drowned Reach. Ring the castaway bell by the raft in the homeport's inner canal to set out as castaways yourself.
- `/scriptevent shipwright:probe` measures this device's limits (interpreter speed, job slice, loaded radius, height range, native fill/set/get costs), saves them with the world and paces the sea world by them; `/scriptevent shipwright:probe show` prints the reading in use.
- `/scriptevent shipwright:shieldpose <0-63> [lift] [out]` sets how a hung shield sits on its peg (saved for the world; every peg updates).
- `/scriptevent shipwright:facesync on|off` and `/scriptevent shipwright:seat low|mid|high` as before.

## Structure

```
BP/                     behavior pack
  blocks/               Shipwright's Table
  entities/             faering (runtime_identifier minecraft:boat)
  recipes/
  scripts/
    main.js             event wiring only
    config/             materials, plans, yards (pure data)
    yard.js             beach yard detection, outline
    build.js            table menu and the five build stages
    ship.js             record, properties, stats, costs, refits, refunds
    knowledge.js        tradition discovery
    inventory.js        costs and drops
    logbook.js          batched distance tracking
    ui.js               every form call
    stages.js           build-stage actions shared by menus and tests
    devtools.js         /scriptevent self-test, showcase, cleanup
RP/                     resource pack (models, render controllers, animations, textures are generated)
tools/gen_assets.py     regenerates geometry, render controllers, animation, client entity, textures
tools/gen_entities.py   behaviour entities, seats, hit areas, names
tools/lab/              the lab: yard and boat lenses, and the view renderers
tools/package.py        builds dist/shipwright.mcaddon and the source zip
tools/bump_version.py   bumps both pack versions (needed after RP changes)
tests/                  Node tests and Minecraft mocks
dev/                    local Bedrock server (docker-compose.yml, dev.sh)
```

Regenerate assets after changing the hull: `python3 tools/gen_assets.py` (needs Pillow). Never hand-edit generated files.

## Version notes and things to verify in game

- Targets `@minecraft/server` 2.0.0 and `@minecraft/server-ui` 2.0.0, `min_engine_version` 1.21.90. For older builds, change the manifest versions and the form calls in `ui.js` (1.x uses positional arguments for slider, dropdown, toggle, textField).
- `runtime_identifier: "minecraft:boat"` gives vanilla boat physics. It's unofficial; if it breaks on your build, remove it and the boat becomes a static entity until script movement lands in v1.
- If boats launch stern-first, set `MODEL_YAW_OFFSET` to 180 in `scripts/config/yards.js`.
- Render controllers hide build layers with Molang in `part_visibility`. If a stage shows too much or too little, check that first.
- Particle ids in the yard outline are cosmetic; a wrong id fails silently.
