// Made once, after the map: the stepping-stone cays that let a small boat go round the world by
// hopping. It finds the route round with the fewest cays (over the hop graph, world/islands.js),
// then lays cays along each crossing longer than VISION.HOP, no further apart than HOP. Written to
// world/islets.json, laid over the map (world/map.js), so the painted map itself is never touched.
//
//   node tools/makeislets.mjs [--force]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VISION } from "../core/given.js";
import { mod } from "../core/fixed.js";
import { loadMap } from "../world/load.js";
import { islands, around } from "../world/islands.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "world/islets.json");
if (fs.existsSync(out) && !process.argv.includes("--force")) { console.log(`${out} exists (--force to redo it)`); process.exit(0); }
loadMap(undefined, { cays: false });
const I = islands(), W = I.W, HOP = VISION.HOP;
const cost = (cyc) => cyc.reduce((n, h) => n + Math.max(0, Math.ceil(h.gap / HOP) - 1), 0);
let best = null;
for (let g = HOP; g <= 160; g += 4) {   // vision: the search's range and step (chunks)
  const r = around(g);
  if (r.ok && (!best || cost(r.cycle) < cost(best.cycle))) best = r;
}
if (!best) throw new Error("no route round within the search");
// trace a hop's two ends back to their coasts
const toCoast = (k) => {
  let c = k;
  while (I.dist[c] > 0) {
    const ci = c % W, cj = (c / W) | 0;
    let next = c;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // given: the four neighbours
      const nj = cj + b; if (nj < 0 || nj >= I.H) continue;
      const nk = nj * W + mod(ci + a, W);
      if (I.near[nk] === I.near[c] && I.dist[nk] === I.dist[c] - 1) { next = nk; break; }
    }
    if (next === c) break;
    c = next;
  }
  return { cx: c % W, cz: (c / W) | 0 };
};
const cays = [];
for (const h of best.cycle) {
  if (h.gap <= HOP) continue;
  const A = toCoast(h.ka), B = toCoast(h.kb);
  let dx = B.cx - A.cx; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
  const dz = B.cz - A.cz, n = Math.ceil(h.gap / HOP);
  for (let k = 1; k < n; k++) {
    const cx = mod(Math.round(A.cx + (dx * k) / n), W), cz = Math.round(A.cz + (dz * k) / n);
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) cays.push({ cx: mod(cx + a, W), cz: cz + b, h: VISION.CAY_HEIGHT });   // vision: a cay is two chunks across
  }
}
fs.writeFileSync(out, JSON.stringify({ about: "stepping-stone cays for the small-boat route round the world (tools/makeislets.mjs); edit freely", hop: HOP, route: best.cycle.length, islets: cays }, null, 0));
console.log(`route round: ${best.cycle.length} hops, longest ${Math.max(...best.cycle.map((h) => h.gap))} chunks before cays; ${cays.length / 4} cays laid`);
