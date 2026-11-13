import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// The mod in Node: lays sample chunks of the built add-on (dist/) with a stand-in for the game's API that knows
// vanilla's every block and state (lab/bedrock_blocks.json), and reports cost, folk and any bad block.
//   node tools/buildmod.mjs --nozip && npm run modtest
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, "scripts_view");
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(path.join(here, "../../dist/Waterworld_BP/scripts"), S, { recursive: true });
const { mockDim, bad } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js"), ST = await imp("data/structures.js"), GR = await imp("data/grown.js"), { layChunk } = await imp("lay.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
await imp("main.js");
// What the game shows from above: chunks laid whole by the built add-on (dist/), the top block of every column
// coloured, a pixel a block.   node tools/modtest/view.mjs <cx> <cz> <chunks> out.png
const { blocks } = await import("@minecraft/server"), { encode } = await import("../png.js"), L = await imp("lay.js");
const [cx0, cz0, n, out] = [+process.argv[2], +process.argv[3], +(process.argv[4] ?? 16), process.argv[5] ?? "view.png"];
const N = n * 16, img = new Uint8Array(N * N * 3), tops = new Int16Array(N * N).fill(-999), ids = new Array(N * N);
for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { blocks.clear(); const g = L.layTo(mockDim, cx0 + a, cz0 + b, 2, { folk: false }); while (!g.next().done);
  for (const [k, id] of blocks) { if (id === "minecraft:air") continue; const [x, y, z] = k.split(",").map(Number), i = x - cx0 * 16, j = z - cz0 * 16; if (i < 0 || j < 0 || i >= N || j >= N) continue; const q = j * N + i; if (y > tops[q]) { tops[q] = y; ids[q] = id; } } }
const hue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return [(h & 255) * 0.6 + 60, ((h >> 8) & 255) * 0.6 + 60, ((h >> 16) & 255) * 0.6 + 60]; };
const FIX = { "minecraft:water": [40, 80, 170], "minecraft:grass_block": [96, 160, 64], "minecraft:sand": [220, 210, 150], "minecraft:stone": [128, 128, 128], "minecraft:gravel": [140, 135, 130], "minecraft:white_concrete": [245, 245, 245], "minecraft:calcite": [228, 228, 222], "minecraft:smooth_quartz": [236, 230, 224], "minecraft:pale_oak_leaves": [150, 160, 140], "minecraft:azalea_leaves": [90, 130, 60], "minecraft:orange_poplar_leaves": [222, 128, 40], "minecraft:yellow_poplar_leaves": [232, 190, 60], "minecraft:red_poplar_leaves": [184, 60, 40], "minecraft:spruce_leaves": [40, 70, 45], "minecraft:polished_diorite": [200, 200, 200], "minecraft:smooth_stone": [170, 170, 170], "minecraft:moss_block": [90, 125, 50], "minecraft:podzol": [110, 80, 40], "minecraft:oak_leaves": [70, 120, 40], "minecraft:dirt_path": [150, 120, 70], "minecraft:spruce_planks": [115, 85, 50], "minecraft:light_blue_terracotta": [110, 110, 140], "minecraft:blue_concrete": [45, 47, 143], "minecraft:mud_brick_slab": [140, 105, 80], "minecraft:prismarine_bricks": [99, 171, 158], "minecraft:packed_ice": [160, 190, 240], "minecraft:snow": [250, 250, 252], "minecraft:barrel": [130, 95, 55], "minecraft:quartz_block": [235, 229, 222], "minecraft:quartz_pillar": [230, 224, 216], "minecraft:gold_block": [246, 208, 61], "minecraft:light_blue_stained_glass": [120, 180, 230], "minecraft:sea_lantern": [200, 230, 230], "minecraft:birch_wood": [225, 222, 210], "minecraft:cherry_leaves": [240, 170, 200], "minecraft:flowering_azalea_leaves": [120, 140, 80], "minecraft:tube_coral_block": [50, 90, 200], "minecraft:brain_coral_block": [210, 90, 160], "minecraft:bubble_coral_block": [160, 30, 160], "minecraft:fire_coral_block": [200, 40, 40], "minecraft:horn_coral_block": [220, 200, 60], "minecraft:lily_pad": [40, 110, 40], "minecraft:mud": [60, 50, 45], "minecraft:prismarine": [90, 160, 150], "minecraft:blue_ice": [120, 170, 250] };   // vision: a colour a block, the rest by their names' hash   // vision: a colour a block, the rest by their names' hash
const seen = {};
for (let q = 0; q < N * N; q++) { const id = ids[q] ?? "none"; seen[id] = (seen[id] ?? 0) + 1; let c = FIX[id] ?? hue(id); const sh = q % N > 0 && tops[q - 1] > tops[q] ? 0.8 : q % N > 0 && tops[q - 1] < tops[q] ? 1.1 : 1; img.set(c.map((v) => Math.min(255, v * sh)), q * 3); }
fs.writeFileSync(out, encode(N, N, img, 3)); console.log(out, Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k.replace("minecraft:", "")} ${v}`).join(", "));
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
