## Direction

The hall's board: where Shipwright is going and who is on what. Edited in place. The world lead (W's Claude, D-011)
keeps it, and each stream updates its own rows. Keep it short: link the doc or the PR rather than repeating it. When
you finish or drop something, take it off and say so in a tablet.

### The streams and their leads

| stream | lead | its gods | its branches |
|---|---|---|---|
| **W**, the world | W's Claude: world building, the board, the merge order, the grow schedule | the Builder, the Grower, the Unmaker | `world/*` (chain into `world/terraform`) |
| **R**, the ships | R's Claude: the ships | the Bounty, the Mover, the Toll | `s003/*`, `sim/sea` |
| **both** | the realm's lead, by subject | the Reaper, the Trader, the Measure | `sim/measure`, `olympus` |

Work in the other stream's realm: claim it here first, then make a PR into that realm's chain.

### The plan (2026-11-14, world lead)

**1. Land the world chain (now)**
- **#10 (`world/cone`, step 5: the larger cone, the crater, terraced pads).** Regrow its 19 towns in the workspace,
  replay them identical, then merge it into `world/terraform`. *W, running.*
- **#3 (the pantheon) into the stage.** Then **#2 (`world/terraform`: phases 0–3 and step 5).** `npm test` must be
  green, and the owner gets a build to play first. *W.*
- **#11 (D-011, the leads)** into the stage. *Owner's merge.*

**2. Thera, outside the towns' closure (next, W)**
- **thera.md §2a:**
  - the ring quay at +3;
  - the stoa (roof +13);
  - the Koinon House, half on moles at 261.8°;
  - the Mint on the Star's bearing;
  - the cothon on the ring line (the Mover's realm: ask first).
- **The paths:** the six rings, the skyway roots at DECK 30, the Mint Road.
- **terraform.md:**
  - WALL and DRAIN faces in each people's plinth;
  - the door apron;
  - plan stamping in `lay.js`.

**3. Phase 4's batch, then one grow (after 2)**

Every change to the towns' closure, batched together:
- shared seeds, five a kind;
- terracing slopes quantised;
- water fronts by the shore's normal (the Bounty's ask);
- the yards claimed before `gapsOf`;
- `s003/therans`' `world/boatsizes.js`, once its 9 failing tests pass (R).

Then grow the world's 463 settlements in the workspace, across sessions (D-010). The towns are kept as plans, about
95 MB (D-009).

**4. Thera beneath (after 3)**
- `impact.js` and the ore;
- `undercone.js`;
- the tunnels;
- the refinery;
- the mint counter;
- the lore.

The Unmaker, the Reaper and the Trader.

**Ships (R)**
- `s003/therans`' 9 failing tests (the model checks, the inherency ratchet at 2517 against 2494, the engineering lens,
  the boot lab), then #5, ships in bottles.
- The keels' plinth sizes for the museum (the Mover's debt).

### Merge order

Merged on 2026-11-14:
- #8, onboarding;
- #9, builds on GitHub;
- #4, moorings;
- #6 and #7, into `world/terraform`.

Open, in order:
1. #11, the leads.
2. #10, into `world/terraform`, after the regrow.
3. #3, the pantheon.
4. #2, the world chain.
5. #5, ships in bottles (a draft until `s003/therans` is green).

### Builds

Every push to a working branch builds on GitHub as that branch's pre-release (`build-<branch>`). To play:
- `ww follow world/terraform` once, then `ww update` from then on;
- `ww builds` lists every branch's build.

### The grow schedule (the closure: `world/cities.js`, `world/district.js`, `game/ground.js` and their imports)

- **Now:** the 19 towns near Thera, for #10 (the cone resize reads into the closure).
- **Next:** phase 4's batch, the whole world, with `boatsizes.js`.

Anything else that touches the closure waits for that grow, or says why here.

### Decided, and where

- D-008: the pantheon.
- D-009: the towns as plans, about 95 MB (R).
- D-010: the world is grown in Claude's workspace (W).
- D-011: each realm has a lead (W).

### Waiting on

- **The Mover:** the keels' plinth sizes (`0001701712-builder`, a debt).
- **The owner:** #11's merge.
