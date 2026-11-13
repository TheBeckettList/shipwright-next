import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// The mod in Node: lays sample chunks of the built add-on (dist/) with a stand-in for the game's API that knows
// vanilla's every block and state (lab/bedrock_blocks.json), and reports cost, folk and any bad block.
//   node tools/buildmod.mjs --nozip && npm run modtest
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, "scripts_slow");
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(path.join(here, "../../dist/Waterworld_BP/scripts"), S, { recursive: true });
const { mockDim, bad } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js"), ST = await imp("data/structures.js"), GR = await imp("data/grown.js"), { layChunk } = await imp("lay.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
await imp("main.js");
const Rv = await imp("world/rivers.js"), Mp = await imp("world/map.js"), Stn = await imp("world/stones.js"), Hs = await imp("world/homesites.js");
const parts = { blockHeight: Mp.blockHeight, riverAt: Rv.riverAt, stoneAt: Stn.stoneAt, heightAt: G.heightAt }, slow = {}; let n = 0;
for (let cx = 8026; cx < 8026 + 300; cx++) for (let j = 0; j < 16; j += 5) for (let i = 0; i < 16; i += 5) { const x = cx * 16 + i, z = 2386 * 16 + j; n++;
  for (const [k, f] of Object.entries(parts)) { const t0 = performance.now(); f(x, z); const dt = performance.now() - t0; if (dt > 0.5) { slow[k] = slow[k] ?? { n: 0, worst: 0, ms: 0 }; slow[k].n++; slow[k].ms += dt; slow[k].worst = Math.max(slow[k].worst, dt); } } }
console.log(n, "columns;", JSON.stringify(slow));
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
