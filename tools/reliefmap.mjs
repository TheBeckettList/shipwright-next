// The ground's height from above, hill-shaded: the map's regions and the relief between them (world/map.js
// blockHeight, the game's own ground), a pixel every few blocks.
//   node tools/reliefmap.mjs <cx> <cz> <cells> out.png [blocks a pixel]     the square of map cells round cell (cx, cz)
//   node tools/reliefmap.mjs biggest out.png                                 the biggest island's middle
import fs from "node:fs";
import { loadMap } from "../world/load.js";
import { encode } from "./png.js";
loadMap();
const { map } = await import("../world/map.js");
const G = await import("../game/ground.js"), blockHeight = (x, z) => { const g = G.heightAt(x, z); return g.water != null ? { h: g.h, w: g.water } : g.h; };   // the game's own ground, its rivers cut in
const { D } = await import("../core/given.js");
const args = process.argv.slice(2);
let cx, cz, cells, out, step;
if (args[0] === "biggest") {
  const { islands } = await import("../world/islands.js"); const I = islands(), big = I.info.slice().sort((a, b) => b.area - a.area)[0];
  let sx = 0, sz = 0, n = 0; for (let k = 0; k < I.label.length; k++) if (I.label[k] === big.id) { sx += k % I.W; sz += Math.floor(k / I.W); n++; }
  [cx, cz, cells, out, step] = [Math.round(sx / n), Math.round(sz / n), Math.ceil(Math.sqrt(big.area) * 0.8), args[1] ?? "relief.png", 8];
  console.log(`biggest island ${big.id}: ${big.area} cells, middle (${cx}, ${cz})`);
} else [cx, cz, cells, out, step] = [+args[0], +args[1], +(args[2] ?? 8), args[3] ?? "relief.png", +(args[4] ?? 4)];
const B = (cells * D.PX) / 2, N = Math.floor((2 * B) / step), x0 = cx * D.PX - B, z0 = cz * D.PX - B, img = new Uint8Array(N * N * 3);
const H = new Float32Array(N * N), WET = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const g = blockHeight(x0 + i * step, z0 + j * step); if (typeof g === "object") { H[j * N + i] = g.h; WET[j * N + i] = 1; } else H[j * N + i] = g; }
let hi = -Infinity, lo = Infinity;
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const h = H[j * N + i]; hi = Math.max(hi, h); lo = Math.min(lo, h);
  const dx = (H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)]) / (2 * step), dz = (H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i]) / (2 * step);
  const shade = Math.max(0.35, Math.min(1.25, 1 + (-dx - dz) * 2));   // light from the north-west
  let c;
  if (WET[j * N + i]) c = [70, 130, 220];
  else if (h <= 0) { const d = Math.min(1, -h / 60); c = [40 + 60 * (1 - d), 90 + 80 * (1 - d), 150 + 70 * (1 - d)]; }
  else { const t = Math.min(1, h / 140); c = t < 0.1 ? [214, 200, 150] : t < 0.4 ? [110 + 60 * t, 150 - 30 * t, 80] : t < 0.75 ? [130, 110, 80] : [235, 235, 235]; c = c.map((v) => v * shade); }
  img.set(c.map((v) => Math.max(0, Math.min(255, Math.round(v)))), (j * N + i) * 3);
}
fs.writeFileSync(out, encode(N, N, img, 3));
console.log(`${out}: ${N} x ${N} px, ${2 * B} blocks across (${step} a pixel), heights ${lo.toFixed(0)} .. ${hi.toFixed(0)}`);
