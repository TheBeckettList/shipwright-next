// The ground's steps from above: each column's largest drop to a neighbour, as the game lays it (the city's kinds, the
// pools, the tarn): green flat, yellow a step or two, orange a climb, red a cliff of ten, magenta twenty and more.
//   node tools/modtest/rise.mjs <cx> <cz> <chunks> out.png
// The mod in Node: lays sample chunks of the built add-on (dist/) with a stand-in for the game's API that knows
// vanilla's every block and state (lab/bedrock_blocks.json), and reports cost, folk and any bad block.
//   node tools/buildmod.mjs --nozip && npm run modtest
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, "scripts_rise");
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(path.join(here, "../../dist/Waterworld_BP/scripts"), S, { recursive: true });
const { mockDim, bad } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js"), ST = await imp("data/structures.js"), GR = await imp("data/grown.js"), { layChunk } = await imp("lay.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
await imp("main.js");
const { encode } = await import("../png.js"), [cx0, cz0, n, out] = [+process.argv[2], +process.argv[3], +(process.argv[4] ?? 16), process.argv[5] ?? "rise.png"];
const N = n * 16, H = new Int16Array((N + 2) * (N + 2)), img = new Uint8Array(N * N * 3), hist = {};
for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) { const g = G.heightAt(cx0 * 16 + i, cz0 * 16 + j); H[(j + 1) * (N + 2) + i + 1] = Math.round(g.h); }
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = (j + 1) * (N + 2) + i + 1, h = H[k]; let r = 0; for (const d of [1, -1, N + 2, -(N + 2)]) r = Math.max(r, Math.abs(H[k + d] - h));
  const c = h <= 0 ? [40, 80, 170] : r <= 1 ? [90, 170, 80] : r <= 3 ? [230, 210, 70] : r <= 9 ? [240, 140, 40] : r <= 19 ? [220, 40, 40] : [230, 40, 230]; const b = r <= 1 ? "0-1" : r <= 3 ? "2-3" : r <= 9 ? "4-9" : r <= 19 ? "10-19" : "20+"; if (h > 0) hist[b] = (hist[b] ?? 0) + 1; img.set(c, (j * N + i) * 3); }
fs.writeFileSync(out, encode(N, N, img, 3)); console.log(out, JSON.stringify(hist));
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
