// Finds Thera's seat: every open-water place near Thera's latitude where the island and its shelf fall wholly on the map's sea, ranked by how near it is to every people (distance weighted by what they hold). The best is the seat (thera.js).
import { loadMap } from "../world/load.js";
import { map, chunkHeight } from "../world/map.js";
import { THERA, theraHeight } from "../world/thera.js";
import { GIVEN } from "../core/given.js";
loadMap(undefined, { thera: false });
const M = map(), W = M.w, C = GIVEN.CHUNK, foot = -THERA.shelf / THERA.M;
// the island's own footprint (land and shelf) as offsets
const fp = []; for (let dv = -THERA.REACH; dv <= THERA.REACH; dv++) for (let du = -THERA.REACH; du <= THERA.REACH; du++) { const h = theraHeight((du + 0.5) * C, (dv + 0.5) * C).h; if (h > foot + 1) fp.push([du, dv, h > 0]); }
console.log("footprint chunks", fp.length, "land", fp.filter(f=>f[2]).length);
// peoples weights
const { peoples } = await import("../world/peoples.js");
const P = peoples().list.map((p) => ({ cx: p.cx, cz: p.cz, w: p.capacity }));
const latOf = (cz) => 90 - ((cz + 0.5) / M.h) * 180;
const out = [];
for (let cz = 250; cz <= 360; cz += 4) for (let cx = 0; cx < W; cx += 4) {
  let clash = 0, near = 0; for (const [du, dv] of fp) { if (chunkHeight(cx + du, cz + dv) > 0) clash++; }
  if (clash) continue;
  // margin: no land within 8 chunks of the footprint edge
  let cost = 0, tot = 0; for (const p of P) { let dx = Math.abs(p.cx - cx); dx = Math.min(dx, W - dx); cost += p.w * Math.hypot(dx, p.cz - cz); tot += p.w; }
  out.push({ cx, cz, lat: latOf(cz).toFixed(1), cost: cost / tot });
}
out.sort((a, b) => a.cost - b.cost);
console.log(out.length, out.slice(0, 8));
