// The map of natural Thera: heights at two blocks a pixel, for tools/theramap.py to draw (relief,
// contours, coast, places). node tools/theramap.mjs out.png
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { theraHeight, THERA, PLACES } from "../world/thera.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? "thera.png", S = 2, R = 1100;   // vision: two blocks a pixel; the map's half width in blocks
const n = (2 * R) / S, h = new Float32Array(n * n), what = [];
const kinds = new Map();
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const t = theraHeight(-R + i * S, -R + j * S);
  h[j * n + i] = t.h;
  if (!kinds.has(t.what)) kinds.set(t.what, kinds.size);
}
const tmp = fs.mkdtempSync("/tmp/thera-");
fs.writeFileSync(path.join(tmp, "h.bin"), Buffer.from(h.buffer));
fs.writeFileSync(path.join(tmp, "meta.json"), JSON.stringify({ n, S, R, KM: THERA.KM, M: THERA.M, places: PLACES }));
execFileSync("python3", [path.join(here, "theramap.py"), tmp, out], { stdio: "inherit" });
let land = 0, top = -1e9; for (const v of h) { if (v > 0) land++; top = Math.max(top, v); }
console.log(`land ${(land * S * S / 1e6).toFixed(2)} million square blocks; highest ${top.toFixed(0)} blocks over the sea (${(top * THERA.M).toFixed(0)} m)`);
