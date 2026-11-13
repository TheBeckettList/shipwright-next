import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
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
await imp("main.js");
const P = ST.PLACES, at = (p) => `${Math.floor(p.x / 16)},${Math.floor(p.z / 16)}`;
const TR0 = await imp("data/terrain.js"), K = (await imp("core/given.js")).D.PX / 16, ck = (cx, cz) => `${cx * K},${cz * K}`;   // the sample chunks, placed as on the first map (regions of K chunks a cell)
const sets = { temple: [at(P.temple)], "open sea": [ck(0, 500)], arctic: [ck(312, 18)], equator: [ck(1250, 512)], "densest Thera": Object.keys(ST.BY_CHUNK).sort((a, b) => ST.BY_CHUNK[b].length - ST.BY_CHUNK[a].length).slice(0, 4), town: Object.keys(ST.PAINT_BY).filter((k) => ST.BY_CHUNK[k]).slice(0, 4), homeport: TR0.HOMEPORTS.homeports.slice(0, 2).map((q) => `${Math.floor(q.x / 16)},${Math.floor(q.z / 16)}`), stones: TR0.STONES.stones.filter((q) => q.route && q.r > 13).slice(0, 3).map((q) => `${Math.floor(q.x / 16)},${Math.floor(q.z / 16)}`), river: (() => { const TRc = TR0.DRAINAGE, out = []; for (let i = 0; i < TRc.cells.length && out.length < 3; i += 5) if (TRc.cells[i + 2] >= 144) { const k = TRc.cells[i]; out.push(ck((k % TRc.W) * 8 + 4, Math.floor(k / TRc.W) * 8 + 4).split(",").map((v) => Math.round(v / K)).join(",")); } return out; })(), "grown town": Object.keys(GR.GROWN_BY).sort((a, b) => GR.GROWN_BY[b].length - GR.GROWN_BY[a].length).slice(0, 4) };
let worst = 0; const probes = [];
for (const [name, list] of Object.entries(sets)) { const t = performance.now(); for (const k of list) { const [cx, cz] = k.split(",").map(Number); const t1 = performance.now(), g = layChunk(mockDim, cx, cz); while (!g.next().done); probes.push({ k: "chunk", src: "node", cx, cz, ms: Math.round(performance.now() - t1), kind: name }); } const ms = (performance.now() - t) / list.length; worst = Math.max(worst, ms); console.log(`${name.padEnd(14)} ${ms.toFixed(0)} ms a chunk (Node)`); }
// the passes apart: what the surface costs alone (in fill and set calls, the game's own cost), then life, then deep
{ const L = await imp("lay.js"), tally = { surface: [0, 0], life: [0, 0], deep: [0, 0] }; const ks = [at(P.temple), ck(0, 500), ck(1250, 512), ...sets.town];
  for (const k of ks) { const [cx, cz] = k.split(",").map(Number); for (const [pass, fn] of [["surface", L.surfaceChunk], ["life", L.lifeChunk], ["deep", L.deepChunk]]) { const c0 = { ...L.COUNT }, g = fn(mockDim, cx + 900 * K, cz, { folk: false }); while (!g.next().done); tally[pass][0] += L.COUNT.fill - c0.fill; tally[pass][1] += L.COUNT.set - c0.set; } }
  console.log(`calls a chunk by pass (fills, sets): ${Object.entries(tally).map(([p2, [f, s2]]) => `${p2} ${Math.round(f / ks.length)}, ${Math.round(s2 / ks.length)}`).join("; ")}`); }
console.log(`folk spawned ${mockDim.spawned.length}; bad blocks or states: ${[...bad].join(", ") || "none"}`);
fs.writeFileSync(path.join(here, "../../dist/modtest-probes.jsonl"), probes.map((p) => JSON.stringify(p)).join("\n") + "\n");
fs.rmSync(S, { recursive: true, force: true });
process.exit(bad.size ? 1 : 0);
