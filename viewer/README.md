# The world viewer

Published as the artifact **"Waterworld — world viewer"** (a page from files: `index.html`, `world3d.js`, `boatgl.js`
and one folder per release). Releases are generated, not kept in git (`.gitignore`): rebuild one from a bake.

```bash
node tools/buildmod.mjs                 # the bake (dist/), ~4 min
node tools/worldviewer.mjs 0.9.14       # -> viewer/0.9.14/ (map layers, towns, Thera from above, Thera in 3D, boats, then viewerkit)
node tools/viewerkit.mjs 0.9.14         # alone: refresh the textures, the textured boats and dev.json (the Development panel)
```
Then add the release to `RELEASES` at the top of `index.html` and publish the page with the release folder (skip
`boats.json` and `thera3d.bin`: the page reads `boats3d.json` and `thera3d.png`).

| Panel | Reads | Made by |
|---|---|---|
| Map (terrain, biomes, climate, rain, peoples; towns, trade, notes) | `data.json`, `*.png` | `tools/worldviewer.mjs` |
| Thera close up on the map | `thera.png` | `tools/modtest/view.mjs` |
| Boats, in the game's own wood, marble and cloth | `boats3d.json`, `tex/` | `ship/tools/boatexport.py --uv`, `tools/viewerkit.mjs` |
| Thera in 3D, block for block in the pack's tiles | `thera3d.json`, `thera3d.png`, `blocks.png` | `tools/modtest/vox.mjs`, `tools/viewerkit.mjs` |
| Development: stage plan, priorities, issues, decisions, math feed, commits | `dev.json` | `tools/viewerkit.mjs` from `handover/` |

Notes and tags on towns are kept in the page's database (`db` capability), per release, and Claude can read them.

## rig_targets.json (ship/tools/)

Typical length and displacement per plan, read by gen_boats.py to draw each rig at the size it sails. Regenerate from
`ship/` with `node --import ./tests/mocks/register.mjs rigtargets.mjs > tools/rig_targets.json`, where rigtargets.mjs is:

```js
import { PLANS } from "../BP/scripts/config/plans.js";
import { newRecord } from "../BP/scripts/ship.js";
import { displacement } from "../BP/scripts/handling.js";
const T = { 1: 7, 2: 17, 4: 34 }, out = {};
for (const p of Object.values(PLANS)) { const L = T[p.modelScale ?? 1] ?? 7; const r = newRecord(p, "k", L); out[p.id] = { L, V23: +Math.pow(displacement(r, p) * (p.twin ? 2 : 1), 2 / 3).toFixed(4) }; }
console.log(JSON.stringify(out));
```
