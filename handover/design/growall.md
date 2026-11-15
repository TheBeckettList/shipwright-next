# Growing the towns: in Claude's workspace (`tools/growall.mjs`)

**Decided 2026-11-14 (W, D-010): the world is grown in Claude's own workspace, never on anyone's device.** The laptop
world-gen run planned the night before is scrapped.

`tools/growall.mjs` stays. It runs one `bakegrown` worker a core wherever Claude runs it, and shares out the stale
settlements by cost (folk^1.3), biggest first to the least-loaded worker. Each worker writes its own
`lab/grown/<key>.json`, and its plan in `lab/plans/`.

```
node tools/growall.mjs --dry                        # what is stale, and who grows what
node tools/growall.mjs [--olympus ../olympus-hall]  # grow, checking in on Olympus at each eighth and at the end
node tools/replay.mjs                               # every plan lays back IDENTICAL
node tools/buildmod.mjs                             # bake
```

**Measured in the workspace** (2 vCPU):
- towns of a few hundred folk: 0.39 s a head;
- the 4,625-folk European city: 0.80 s a head, 3,694 s.

Phase 4's whole world is 463 settlements and 107,581 folk, so it is a long run here. Split it across sessions:
`bakegrown` keeps what is grown and grows only the stale or new.

**Memory:** a city of 2,000 folk or more gets a worker of its own with at least 6,000 MB of heap. The 4,649-folk
city ran out at 3,000 MB an hour in on 2026-11-14. Towns need well under 3 GB. On an 8 GB workspace use `--workers 2`,
so the city's worker and one town worker fit.

**Plans:** every town grown also leaves its plan in `lab/plans/` (phase 2, `tools/plans.mjs`). Check them with
`node tools/replay.mjs`, which should print IDENTICAL for every town; then commit `lab/grown/` and `lab/plans/` together.
