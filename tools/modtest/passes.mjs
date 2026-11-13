import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// The mod in Node: lays sample chunks of the built add-on (dist/) with a stand-in for the game's API that knows
// vanilla's every block and state (lab/bedrock_blocks.json), and reports cost, folk and any bad block.
//   node tools/buildmod.mjs --nozip && npm run modtest
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, "scripts");
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(path.join(here, "../../dist/Waterworld_BP/scripts"), S, { recursive: true });
const { mockDim, bad, calls } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js"), ST = await imp("data/structures.js"), GR = await imp("data/grown.js"), { layChunk } = await imp("lay.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
// The passes timed apart over a flight line: surface, life, deep, by kind of chunk (the loading model's inputs)
const L = await imp("lay.js"), { climateAtBlock } = await imp("world/climate.js"), K = (await imp("core/given.js")).D.PX / 16;
const line = (cx0, cz, n) => Array.from({ length: n }, (_, i) => [cx0 + i, cz]);
const lines = { "thera flight": line(8000, 2410, 40), "land flight": line(7400, 2400, 60), "sea sail": line(0, 4000, 40), "river": line(6740, 972, 40) };
const out = {};
for (const [name, cs] of Object.entries(lines)) { const t = { surface: [], life: [], deep: [], fills: 0, sets: 0, sea: 0, vol: { surface: 0, life: 0, deep: 0 }, f: { surface: 0, life: 0, deep: 0 }, s: { surface: 0, life: 0, deep: 0 } };
  for (const [cx, cz] of cs) { if (climateAtBlock(cx * 16 + 8, cz * 16 + 8).h <= -8) t.sea++;
    for (const [p, fn] of [["surface", L.surfaceChunk], ["life", L.lifeChunk], ["deep", L.deepChunk]]) { const c0 = { ...L.COUNT }, v0 = calls.vol, t0 = performance.now(), g = fn(mockDim, cx, cz, { folk: false }); let y = 0; while (!g.next().done) y++; t[p].push(performance.now() - t0); t.fills += L.COUNT.fill - c0.fill; t.sets += L.COUNT.set - c0.set; t.vol[p] += calls.vol - v0; t.f[p] += L.COUNT.fill - c0.fill; t.s[p] += L.COUNT.set - c0.set; } }
  const m = (a) => +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(2), p95 = (a) => +[...a].sort((p, q) => p - q)[Math.floor(a.length * .95)].toFixed(1);
  out[name] = { n: cs.length, seaShare: +(t.sea / cs.length).toFixed(2), surface: m(t.surface), life: m(t.life), deep: m(t.deep), p95: p95(t.surface.map((s, i) => s + t.life[i] + t.deep[i])), fills: Math.round(t.fills / cs.length), sets: Math.round(t.sets / cs.length), byPass: Object.fromEntries(["surface", "life", "deep"].map((p) => [p, { fills: Math.round(t.f[p] / cs.length), sets: Math.round(t.s[p] / cs.length), volume: Math.round(t.vol[p] / cs.length) }])) }; }
console.log(JSON.stringify(out, null, 1)); fs.writeFileSync(path.join(here, process.env.WW_PASSES ?? "../../dist/modtest-passes.json"), JSON.stringify(out, null, 1));
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
