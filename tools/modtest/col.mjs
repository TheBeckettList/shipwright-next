// inherency: instrument
import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// One column of the laid world: its chunk laid whole (all three passes) by the built add-on, the blocks from y0 to y1
// in runs, the plan's top, and the placements standing on it.   node tools/modtest/col.mjs <x> <z> <y0> <y1>
process.env.WW_NOSTORE = "1";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, `scripts_col_${process.pid}`);
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(path.join(here, "../../dist/Waterworld_BP/scripts"), S, { recursive: true });
const { mockDim, blocks } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js"), ST = await imp("data/structures.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
await imp("main.js");
const L = await imp("lay.js"), { LEVEL } = await imp("rings.js"), SEA = G.SEA;
const [x, z, y0, y1] = process.argv.slice(2).map(Number), cx = Math.floor(x / 16), cz = Math.floor(z / 16);
const g = L.layTo(mockDim, cx, cz, LEVEL.deep, { folk: false }); while (!g.next().done);
const top = L.planNow(cx, cz).cols.find((c) => c.x === x && c.z === z);
console.log("plan top", top.top, "rise", top.rise, "under", top.under, "kind", top.kind);
let prev = null, start = null; const runs = [];
for (let y = y0; y <= y1 + 1; y++) { const id = y <= y1 ? (blocks.get(`${x},${y},${z}`) ?? "·") : null; if (id !== prev) { if (prev !== null) runs.push(`${start}-${y - 1} ${prev.replace("minecraft:", "")}`); prev = id; start = y; } }
console.log(runs.join(" | "));
for (const k of ST.BY_CHUNK[`${cx},${cz}`] ?? []) { const a = ST.PLACEMENTS[k]; if (x >= a[6] && x <= a[8] && z >= a[7] && z <= a[9]) console.log("placement", k, ST.PROTOS[a[0]].name, "y", a[2], "flags", a[5], "found", ST.PALETTE[a[4]][0]); }
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
