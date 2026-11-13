// The mod in Node: lays sample chunks of the built add-on (dist/) with a stand-in for the game's API that knows
// vanilla's every block and state (lab/bedrock_blocks.json), and reports cost, folk and any bad block.
//   node tools/buildmod.mjs --nozip && npm run modtest
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, "scripts");
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(path.join(here, "../../dist/Waterworld_BP/scripts"), S, { recursive: true });
const { mockDim, bad } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js"), ST = await imp("data/structures.js"), GR = await imp("data/grown.js"), { layChunk } = await imp("lay.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
// The skin and the body: after the surface pass alone, every column is whole from its foot to its top and nothing
// under the foot; after all three passes, whole from the floor to the top but for the caves (strata's air)
const L = await imp("lay.js"), S2 = await imp("game/strata.js"), { blocks } = await import("@minecraft/server"), BOTTOM = (await imp("game/ground.js")).BOTTOM;
const chunks = [[8034, 2421], [6756, 980], [0, 4000], [8588, 2483], [15975, 6350]];
let gaps = 0, below = 0, skin = 0, full = 0;
for (const [cx, cz] of chunks) {
  blocks.clear(); let g = L.surfaceChunk(mockDim, cx, cz); while (!g.next().done);
  const plan = (await imp("game/ground.js")).chunkColumns(cx, cz);
  for (const c of plan.cols) { const f = Math.max(BOTTOM + 1, L.footOf(c)); for (let y = BOTTOM + 1; y <= c.top; y++) { const b = blocks.get(`${c.x},${y},${c.z}`); if (y < f && b) below++; if (y >= f && !b) gaps++; if (b) skin++; } }
  g = L.lifeChunk(mockDim, cx, cz, { folk: false }); while (!g.next().done); g = L.deepChunk(mockDim, cx, cz); while (!g.next().done);
  for (const c of plan.cols) for (let y = BOTTOM; y <= c.top - 3; y++) { const b = blocks.get(`${c.x},${y},${c.z}`); if (b) full++; else gaps++; }
}
console.log(`skin blocks ${skin}, body blocks after deep ${full}; blocks under a foot after the skin ${below}; holes ${gaps} (caves count as laid air)`);
process.exit(0);
