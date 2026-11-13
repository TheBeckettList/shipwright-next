# viewer-wip

- `boats.json`: every boat model (ship/tools/boatexport.py), boxes as eight corners in blocks plus cut cloths; `_cloth` holds each sail type's mask.
- `boat3d.js`: depth-buffered software renderer for it (works in the page and in node).
- `world3d.js` + `vox.mjs`: the built world in 3D (WebGL2), block for block. vox.mjs goes in `tools/modtest/`.

## rig_targets.json (ship/tools/)

Typical length and displacement per plan, read by gen_boats.py to draw each rig at the size it sails. Regenerate from `ship/` with:

```
node --import ./tests/mocks/register.mjs rigtargets.mjs > tools/rig_targets.json
```

```js
import { PLANS } from "../BP/scripts/config/plans.js";
import { newRecord } from "../BP/scripts/ship.js";
import { displacement } from "../BP/scripts/handling.js";
const T = { 1: 7, 2: 17, 4: 34 }, out = {};
for (const p of Object.values(PLANS)) { const L = T[p.modelScale ?? 1] ?? 7; const r = newRecord(p, "k", L); out[p.id] = { L, V23: +Math.pow(displacement(r, p) * (p.twin ? 2 : 1), 2 / 3).toFixed(4) }; }
console.log(JSON.stringify(out));
```
