// inherency: instrument
import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// What the cone shows from the side (thera.md §2's lens): chunks laid whole by the built add-on, and every solid
// block with air beside it (a side face) or over it (a top face), counted by block. A sample of chunks a stride apart.
//   node tools/modtest/faces.mjs <x0> <z0> <x1> <z1> [--stride 3] [--scripts dir]
process.env.WW_NOSTORE = "1";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, `scripts_faces_${process.pid}`);
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(arg("--scripts", path.join(here, "../../dist/Waterworld_BP/scripts")), S, { recursive: true });
const { mockDim, blocks } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
await imp("main.js");
const L = await imp("lay.js"), { LEVEL } = await imp("rings.js");
const [x0, z0, x1, z1] = process.argv.slice(2, 6).map(Number), stride = +arg("--stride", 3), C = 16;
const side = {}, top = {}; let ns = 0, nt = 0;
const soft = (id) => !id || id === "minecraft:air" || id === "minecraft:water" || /leaves|grass$|flower|fern|sapling|carpet|torch|lantern|vine|bush/.test(id);
for (let cz = Math.floor(z0 / C); cz <= Math.floor(z1 / C); cz += stride) for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx += stride) {
  blocks.clear(); const g = L.layTo(mockDim, cx, cz, LEVEL.deep, { folk: false }); while (!g.next().done);
  for (const [k, id] of blocks) { if (soft(id)) continue; const [x, y, z] = k.split(",").map(Number); if (y <= 63) continue;   // above the sea only
    if (Math.floor(x / C) !== cx || Math.floor(z / C) !== cz) continue;
    if (soft(blocks.get(`${x},${y + 1},${z}`))) { top[id] = (top[id] ?? 0) + 1; nt++; }
    const inC = (u, v) => Math.floor(u / C) === cx && Math.floor(v / C) === cz;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => inC(x + dx, z + dz) && soft(blocks.get(`${x + dx},${y},${z + dz}`)))) { side[id] = (side[id] ?? 0) + 1; ns++; } } }
const pct = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k.replace(/^(minecraft|waterworld):/, "")} ${((v / n) * 100).toFixed(1)}%`).join(", ");
console.log(`side faces ${ns}: ${pct(side, ns)}`); console.log(`top faces ${nt}: ${pct(top, nt)}`);
const share = (o, n, ids) => ids.reduce((s, k) => s + (o[k] ?? 0), 0) / n;
console.log(`tuff + calcite on the sides: ${(share(side, ns, ["minecraft:tuff", "minecraft:calcite"]) * 100).toFixed(1)}%; calcite on top: ${(share(top, nt, ["minecraft:calcite"]) * 100).toFixed(1)}%`);
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
