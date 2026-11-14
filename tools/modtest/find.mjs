// inherency: instrument
import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// Where a block lies in the laid world: chunks laid whole (all three passes) by the built add-on, and every block whose
// id matches, listed (the probes' companion: find the ladder, the door, the ore, then slice through it).
//   node tools/modtest/find.mjs <x0> <z0> <x1> <z1> <id regex> [--max 40]
//
process.env.WW_NOSTORE = "1";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, `scripts_find_${process.pid}`);
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
const [x0, z0, x1, z1] = process.argv.slice(2, 6).map(Number), re = new RegExp(process.argv[6]), max = +arg("--max", 40), C = 16;
const hits = [];
for (let cz = Math.floor(z0 / C); cz <= Math.floor(z1 / C); cz++) for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) {
  blocks.clear(); const g = L.layTo(mockDim, cx, cz, LEVEL.deep, { folk: false }); while (!g.next().done);
  for (const [k, id] of blocks) if (re.test(id)) { const [x, y, z] = k.split(",").map(Number); if (x >= x0 && x <= x1 && z >= z0 && z <= z1) hits.push([x, y, z, id]); } }
hits.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
console.log(`${hits.length} blocks matching ${re}`); for (const h of hits.slice(0, max)) console.log(h.join(" "));
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
