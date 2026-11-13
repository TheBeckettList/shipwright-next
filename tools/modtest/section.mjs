// inherency: instrument
import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// A slice of the laid world from the side: chunks laid whole (all three passes) by the built add-on, and the blocks
// on one line drawn x (or z) across and y up, a few pixels a block. What a building stands on, or is buried under.
//   node tools/modtest/section.mjs <x|z> <along0> <along1> <at> <y0> <y1> out.png [--scripts dir] [--px 4]
//   (x: a line of constant z = at from x = along0 to along1; z: constant x = at)
process.env.WW_NOSTORE = "1";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, `scripts_section_${process.pid}`);
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(arg("--scripts", path.join(here, "../../dist/Waterworld_BP/scripts")), S, { recursive: true });
const { mockDim, blocks } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
await imp("main.js");
const L = await imp("lay.js"), { LEVEL } = await imp("rings.js"), { encode } = await import("../png.js");

const [axis, a0, a1, at, y0, y1, out] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6], +process.argv[7], process.argv[8]];
const px = +arg("--px", 4), W = a1 - a0 + 1, H = y1 - y0 + 1, C = 16;
const xz = (s) => (axis === "x" ? [s, at] : [at, s]);
const ids = new Array(W * H);
const chunks = new Set(); for (let s = a0; s <= a1; s++) { const [x, z] = xz(s); chunks.add(`${Math.floor(x / C)},${Math.floor(z / C)}`); }
for (const ck of chunks) { const [cx, cz] = ck.split(",").map(Number); blocks.clear(); const g = L.layTo(mockDim, cx, cz, LEVEL.deep, { folk: false }); while (!g.next().done);
  for (let s = a0; s <= a1; s++) { const [x, z] = xz(s); if (Math.floor(x / C) !== cx || Math.floor(z / C) !== cz) continue; for (let y = y0; y <= y1; y++) ids[(y1 - y) * W + (s - a0)] = blocks.get(`${x},${y},${z}`); } }
const FIX = { "minecraft:water": [52, 92, 180], "minecraft:grass_block": [96, 160, 64], "minecraft:dirt": [134, 96, 67], "minecraft:sand": [220, 210, 150], "minecraft:stone": [125, 125, 125], "minecraft:tuff": [108, 109, 102], "minecraft:deepslate": [80, 80, 86], "minecraft:calcite": [236, 236, 230], "minecraft:cobblestone": [150, 150, 150], "minecraft:gravel": [140, 135, 130], "minecraft:bedrock": [40, 40, 40], "minecraft:mangrove_log": [180, 60, 50], "minecraft:mangrove_planks": [200, 80, 70], "minecraft:air": [255, 255, 255] };
const hue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return [(h & 255) * 0.5 + 100, ((h >> 8) & 255) * 0.5 + 60, ((h >> 16) & 255) * 0.3 + 30]; };   // the buildings' own blocks warm, so they stand out of the grey rock
const img = new Uint8Array(W * px * H * px * 3), seen = {};
for (let q = 0; q < W * H; q++) { const id = ids[q]; const c = id ? FIX[id] ?? hue(id) : [214, 232, 250]; if (id) seen[id] = (seen[id] ?? 0) + 1;   // vision: the sky (unlaid) pale blue
  const i = q % W, j = Math.floor(q / W); for (let b = 0; b < px; b++) for (let a = 0; a < px; a++) img.set(c, ((j * px + b) * W * px + i * px + a) * 3); }
for (let y = y0; y <= y1; y++) if (y === G.SEA) for (let i = 0; i < W * px; i += 2) img.set([0, 0, 160], (((y1 - y) * px) * W * px + i) * 3);   // the sea's level, dotted
fs.writeFileSync(out, encode(W * px, H * px, img, 3));
console.log(out, Object.entries(seen).sort((p, q) => q[1] - p[1]).slice(0, 10).map(([k, v]) => `${k.replace("minecraft:", "")} ${v}`).join(", "));
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
