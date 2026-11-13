// Made once, after the map: the trunk rivers. Every continent (world/trade.js: an island of 5,000 cells or more) gets a
// river its boats can work, from deep in its interior down to the sea by its hub, the continent's strongest city: of
// its rivers' mouths, the one whose river drains most of it for its distance from the hub (flow over one plus that
// distance in 21 cells). Its main stem, mouth to source, is the trunk: world/rivers.js gives it a navigable channel
// (at least 8 wide and 3 deep) whatever its own flow, and the river peoples' boats run on it. Written to world/trunks.json.
//   node tools/maketrunks.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
loadMap();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { FIB } = await import("../core/golden.js");
const { islands } = await import("../world/islands.js");
const { drainage, RIVER } = await import("../world/rivers.js");
const { network, chunkDist } = await import("../world/trade.js");
const I = islands(), R = drainage(), N = network(), W = R.W;
const hubs = [...N.nodes.values()].filter((n) => n.tier === 3);   // the continents' hubs
const out = [];
for (const hub of hubs) {
  const isle = I.label[Math.round(hub.at.cz) * W + Math.round(hub.at.cx)]; if (isle < 0) continue;
  let best = null;
  for (let k = 0; k < W * R.H; k++) {
    if (I.label[k] !== isle || R.to[k] >= 0 || !(R.Q[k] >= RIVER.STREAM)) continue;   // a mouth on the hub's continent
    const d = chunkDist({ cx: k % W, cz: Math.floor(k / W) }, hub.at), v = R.Q[k] / (1 + d / FIB[7]);
    if (!best || v > best.v) best = { k, v, d };
  }
  if (!best) continue;
  const stem = [best.k]; let u = best.k; while (R.main[u] >= 0 && R.Q[R.main[u]] >= 1) { u = R.main[u]; stem.push(u); }   // up the main stem to its source
  out.push({ hub: hub.key ?? hub.name ?? `${hub.at.cx},${hub.at.cz}`, mouth: best.k, flow: Math.round(R.Q[best.k]), fromHub: Math.round(best.d), cells: stem });
  console.log(`${out.at(-1).hub}: a trunk of ${stem.length} cells (${stem.length * 128} blocks or so), flow ${Math.round(R.Q[best.k])} at its mouth, ${Math.round(best.d)} cells from the hub`);
}
fs.writeFileSync(path.join(ROOT, "world/trunks.json"), JSON.stringify({ about: "the continents' trunk rivers (tools/maketrunks.mjs): each a main stem, mouth to source, made navigable", trunks: out }));
console.log(`${out.length} trunks`);
