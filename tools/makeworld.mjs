// Made once: draws the world map, world/map.png (one pixel a chunk, 2,048 x 1,024), and that file is
// the world from then on. It is not a seed: nothing at runtime generates anything; the map is read.
// Paint it in any image editor to change the world (the code's legend, world/map.js MAP).
//
//   node tools/makeworld.mjs [--force]
//
// How it was drawn: noise on the sphere itself (so the east-west wrap and the poles have no seams),
// three layers summed: broad basins and rises, chains of islands along ridges where hot spots are,
// and detail. The sea level is set where the land share is VISION.LAND's middle. Mostly sea.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "./png.js";
import { VISION, D } from "../core/given.js";
import { MAP } from "../world/map.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "world/map.png");
if (fs.existsSync(out) && !process.argv.includes("--force")) { console.log(`${out} exists: the world is drawn (--force to redraw it, which replaces any painting)`); process.exit(0); }

// noise on the sphere (the drawing's own tools; their numbers shape this one drawing, not the world's laws)
const hash = (x, y, z, k) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + k * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };   // vision: the drawing's hash
const sm = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, z, k) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm(x - xi), v = sm(y - yi), w = sm(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (i, j, l) => hash(xi + i, yi + j, zi + l, k);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm(x, y, z, k, oct) {   // vision: octaves halve in strength and double in frequency
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += a * vnoise(x * f, y * f, z * f, k + o); n += a; a *= 0.5; f *= 2; }
  return s / n;
}

const Wp = D.CELLS_W, Hp = D.CELLS_H;
const N = Wp * Hp, layers = ["basin", "chains", "islets", "detail", "polar"].map(() => new Float32Array(N));
console.log(`drawing ${Wp} x ${Hp} ...`);
for (let j = 0; j < Hp; j++) {
  const lat = (90 - (180 * (j + 0.5)) / Hp) * Math.PI / 180;
  for (let i = 0; i < Wp; i++) {
    const lon = ((360 * (i + 0.5)) / Wp - 180) * Math.PI / 180;
    const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
    // vision (the drawing): basins at 1.6 / sphere, a warp, ridged chains at 5, hot spots at 3, islets at 9, detail at 28
    const wx = x + 0.35 * (fbm(x * 2, y * 2, z * 2, 11, 3) - 0.5), wy = y + 0.35 * (fbm(x * 2, y * 2, z * 2, 23, 3) - 0.5), wz = z + 0.35 * (fbm(x * 2, y * 2, z * 2, 37, 3) - 0.5);
    const k = j * Wp + i;
    layers[0][k] = fbm(wx * 1.6, wy * 1.6, wz * 1.6, 101, 4);
    const hot = sm(Math.max(0, Math.min(1, (fbm(x * 3, y * 3, z * 3, 307, 3) - 0.42) / 0.2)));
    layers[1][k] = (1 - Math.abs(2 * fbm(wx * 5, wy * 5, wz * 5, 211, 4) - 1)) ** 2 * hot;
    layers[2][k] = fbm(wx * 9, wy * 9, wz * 9, 401, 4) * (0.4 + hot);
    layers[3][k] = fbm(x * 28, y * 28, z * 28, 503, 2);
    layers[4][k] = sm(Math.max(0, Math.min(1, (Math.abs(lat) * 180 / Math.PI - 62) / 16)));   // vision: open sea at the poles, so they can be sailed over
  }
}
const std = (a) => { let m = 0, v = 0; for (const x of a) m += x; m /= a.length; for (const x of a) v += (x - m) ** 2; v = Math.sqrt(v / a.length) || 1; return a.map((x) => (x - m) / v); };
const [basin, chains, islets, detail] = layers.slice(0, 4).map(std), polar = layers[4];
const score = new Float32Array(N);
for (let k = 0; k < N; k++) score[k] = 0.35 * basin[k] + 0.55 * chains[k] + 0.75 * islets[k] + 0.25 * detail[k] - 3 * polar[k];   // vision: islands first, basins to group them
// the sea level: land share at the middle of VISION.LAND
const sorted = Float32Array.from(score).sort();
const share = (VISION.LAND[0] + VISION.LAND[1]) / 2;
const T = sorted[Math.floor(sorted.length * (1 - share))], top = sorted.at(-1), bottom = sorted[0];
const px = new Uint8Array(Wp * Hp);
for (let k = 0; k < px.length; k++) {
  const s = score[k];
  if (s > T) px[k] = MAP.encodeLand(1 + Math.round(MAP.LAND_MAX * ((s - T) / (top - T)) ** 2.4));   // vision: most islands low, few peaks
  else px[k] = MAP.encodeSea(Math.max(1, Math.round(MAP.DEPTH_MAX * Math.min(1, ((T - s) / (T - bottom)) * 2.2) ** 0.7)));   // vision: shelves round the land, deep basins between
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encode(Wp, Hp, px, 1));
console.log(`wrote ${out}: land ${(share * 100).toFixed(0)}%`);
