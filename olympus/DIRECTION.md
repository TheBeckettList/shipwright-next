## Direction

The hall's board: where Shipwright is going and who is on what. Unlike a tablet, this page is edited in place. Each
stream keeps its own rows, and the Measure checks it at each sitting.

Rules:
- Keep it short.
- Link the doc or the PR rather than repeating it.
- When you finish or drop something, take it off and say so in a tablet.

### The streams

| stream | who | its gods | its branches |
|---|---|---|---|
| **W**, the world | the world architect and Claude | the Builder, the Grower, the Unmaker (the land row) | `world/*` |
| **R**, the ships | Richard and Claude | the Bounty, the Mover, the Toll (the sea row) | `s003/*`, `sim/sea` |
| **both** | either | the Reaper, the Trader (the peoples row), the Measure | `sim/measure`, `olympus` |

### Now

| stream | on | where |
|---|---|---|
| W | S004: Thera's terraforming, footings, paths and skin; the museum; Olympus's ring | `world/terraform`, PR #2 |
| W | phase 4's batch, next: shared seeds a kind, water fronts by the shore's normal, Thera's ring and cone | `handover/design/world-buildout.md` |
| R | phase 2 (towns as plans, D-009) and phase 3's first part (pads in the game) | `world/plans`, `world/pads` |
| R | ships: the Theran keels, moorings, ships in bottles | `s003/therans`, `s003/moorings`, `s003/bottles` |
| both | the pantheon, wave 0 | `sim/measure`, PR #3 |

### Merge order

Merged:
- #8, onboarding (2026-11-14). The sitting workflow now runs hourly from the stage.
- #6 (`world/plans`) and #7 (`world/pads`) into `world/terraform` (Richard, 2026-11-14). PR #2 now carries phases 2 and 3.

Open, in order:
1. #9: builds on GitHub, and `ww update` pulls them. Stands alone.
2. #3: the pantheon (`sim/measure`).
3. #2: `world/terraform`, which builds on #3.
4. #4 and #5: the ships (`s003/moorings`, `s003/bottles`).

### Builds

Every push to a working branch builds on GitHub as that branch's pre-release (`build-<branch>`). `ww update` pulls
the build of the branch you follow (`ww follow <branch>`), and `ww builds` lists them. Nobody needs to send build
files any more.

### Decided, and where

- D-008: the pantheon.
- D-009: the towns as plans, about 95 MB (Richard).
- D-010: the world is grown in Claude's workspace, never on a device (W).

### Waiting on

- **The Mover:** the keels' plinth sizes for the museum (`0001701712-builder`, now a debt).
- **The sea row:** whether its next change touches the towns' closure (`cities.js`, `district.js`, `ground.js`).
