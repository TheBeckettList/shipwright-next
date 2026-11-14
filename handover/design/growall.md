# Growing the towns on a laptop's cores (`tools/growall.mjs`)

A runbook for whoever has the cores, or their Claude. Branch: `world/terraform` (PR #2).

## Why on a laptop

A town grows single-threaded (`tools/bakegrown.mjs`: `cities.js` → `growth.js` → `district.js`), and grown towns go
stale whenever the closure of `world/cities.js`, `world/district.js` or `game/ground.js` changes.

Measured on the cloud workspace (2 vCPU):
- towns of a few hundred folk: 0.39 s a head;
- the 4,625-folk European city: 0.80 s a head, 3,694 s.

`growall.mjs` runs one `bakegrown` worker a core and hands out the stale settlements by cost (folk^1.3), biggest
first, to the least-loaded worker. Each worker writes its own `lab/grown/<key>.json`, so nothing collides.

## Run it

```
git fetch origin && git checkout world/terraform && git pull
npm install
node tools/growall.mjs --dry                 # what is stale, and who grows what
node tools/growall.mjs                       # grow (the default: all cores but one)
node tools/buildmod.mjs                      # bake: dist/Waterworld.mcaddon and dist/waterworld-update.zip
```

**Memory:** a worker needs up to about 3 GB (the big city peaked at 2.6 GB).
- 16 GB of RAM: `--workers 4 --heap 3000`.
- 32 GB or more: the defaults (`--heap 4096`).

**Check:** the bake log line `grown settlements: N (…)` should list every chosen settlement, with none left out as
"grown under older sources".

**Then commit** `lab/grown/` with the source hash in the message, push to the branch you grew for, and post a tablet on
Olympus (the Grower) with the counts and times.

## What not to run yet

- **Do not use `--folk 1e9`** (every settlement in the world, 463 to grow, 107,581 folk). Towns are still stored block by
  block: the 19 near Thera are already 100 MB of JSON, so the whole world would be about 1 GB and an add-on far too
  large.
- **That run is phase 4** (`handover/design/world-buildout.md`), once towns share building designs and are stored as
  plans.
- **Estimate for phase 4:** on 10 cores the dry run puts the biggest city (5,624 folk) alone on one worker and splits
  the rest about evenly. That is perhaps 1.5–2 hours on an Apple-silicon laptop. This is an estimate: nobody has timed
  it there yet.

## Today

All 19 settlements nearest Thera are current (regrown on S003's sources, commit d8d7c9e), so `growall` has nothing to
do until a closure change.
