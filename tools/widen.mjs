// Made once: widens the world map two-fold each way (world/map.png, one pixel a chunk), the painted map
// kept as it is drawn: each new pixel the old map's height blended between its pixel centres (wrapping
// east-west, held at the poles), so every coast and island stays where it was, twice as far from the rest.
// The old map is kept beside it (world/map_2048.png).
//   node tools/widen.mjs [from] [to]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decode, encode } from "./png.js";
import { heightOf, MAP } from "../world/map.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = process.argv[2] ?? path.join(root, "world/map_2048.png"), to = process.argv[3] ?? path.join(root, "world/map.png");
const m = decode(fs.readFileSync(from)), S = 2, W = m.w * S, H = m.h * S, out = new Uint8Array(W * H);   // vision: two-fold
const hAt = (x, z) => heightOf(m.data[Math.max(0, Math.min(m.h - 1, z)) * m.w + (((x % m.w) + m.w) % m.w)]);
for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
  const fx = (x + 0.5) / S - 0.5, fz = (z + 0.5) / S - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const h = (hAt(i, j) * (1 - u) + hAt(i + 1, j) * u) * (1 - v) + (hAt(i, j + 1) * (1 - u) + hAt(i + 1, j + 1) * u) * v;
  out[z * W + x] = h > 0 ? MAP.encodeLand(Math.round(h)) : MAP.encodeSea(Math.round(-h));
}
fs.writeFileSync(to, encode(W, H, out, 1));
let land0 = 0, land1 = 0; for (const v of m.data) if (v >= MAP.COAST) land0++; for (const v of out) if (v >= MAP.COAST) land1++;
console.log(`${m.w} x ${m.h} -> ${W} x ${H}; land ${(land0 / m.data.length * 100).toFixed(2)}% -> ${(land1 / out.length * 100).toFixed(2)}%`);
