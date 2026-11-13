import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// The real layer (main.js) in Node's game loop: a player flies a line at a speed, the engine's slack is a budget of
// ms a tick, and we count the holes in view as the probes would: is the skin's mark on each chunk in view?
//   node tools/buildmod.mjs --nozip && node tools/modtest/flytest.mjs [--speed 10.89] [--secs 60] [--budget 2] [--view 8] [--heading 0]
process.env.WW_NOSTORE = "1";
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
const { loop, world, system } = await import("@minecraft/server");
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? +process.argv[i + 1] : d; };
const speed = arg("speed", 10.89), secs = arg("secs", 60), budget = arg("budget", 2), view = arg("view", 8), hd = (arg("heading", 0) * Math.PI) / 180;   // given: creative flight 10.89 b/s
const BOTTOM = (await imp("game/ground.js")).BOTTOM, L = await imp("lay.js"), { blocks } = await import("@minecraft/server");
for (let i = 0; i < 400 && !loop.intervals.length; i++) loop.step(1e9);   // the world's data loaded (the start's jobs run whole)
while (loop.jobs.length) loop.step(1e9);
const at = { x: ST.PLACES.spawn.x + 0.5, y: 120, z: ST.PLACES.spawn.z + 0.5 }, vx = Math.cos(hd) * speed, vz = Math.sin(hd) * speed;
const p = { id: "p1", typeId: "minecraft:player", name: "flier", location: { ...at }, dimension: world.getDimension(), getVelocity: () => ({ x: p.v.x / 20, y: 0, z: p.v.z / 20 }), v: { x: 0, z: 0 },
  sendMessage() {}, teleport(l) { Object.assign(p.location, l); }, addEffect() {}, removeEffect() {}, setSpawnPoint() {}, getDynamicProperty() {}, setDynamicProperty() {}, onScreenDisplay: { setActionBar() {} }, runCommand() {} };
loop.players.push(p); loop.all = false; loop.view = view;
const lvlAt = (cx, cz) => Math.max(0, L.MARKS.indexOf(blocks.get(`${cx * 16},${BOTTOM},${cz * 16}`)));
const count = () => { const pcx = Math.floor(p.location.x / 16), pcz = Math.floor(p.location.z / 16); let n = 0, h = 0, f = 0; for (let a = -view; a <= view; a++) for (let b = -view; b <= view; b++) { n++; if (lvlAt(pcx + a, pcz + b) < 1) { h++; if (a * vx + b * vz > 0) f++; } } return [h / n, f / n]; };
loop.steps.length = 0;
// wait at the start till the view is laid (a player arriving), then fly
let t = 0, used = 0; while (count()[0] > 0 && t < 20 * 600) { used += loop.step(budget); t++; }
const waited = t / 20; p.v = { x: vx, z: vz }; let hs = 0, fr = 0, worst = 0, n = 0; used = 0;
for (let k = 0; k < secs * 20; k++) { p.location.x += vx / 20; p.location.z += vz / 20; used += loop.step(budget); if (k % 20 === 19) { const [h, f] = count(); hs += h; fr += f; worst = Math.max(worst, h); n++; } }
const st = [...loop.steps].sort((a, b) => a - b), q = (f) => st[Math.floor(st.length * f)]?.toFixed(2);
console.log(`${speed} b/s, view ${view}, ${budget} ms a tick: waited ${waited.toFixed(1)} s for the first view; flying ${secs} s: ${(hs / n * 100).toFixed(1)}% of the view unlaid on average, ${(fr / n * 100).toFixed(1)}% ahead, worst ${(worst * 100).toFixed(1)}%; busy ${(used / (secs * 20 * budget) * 100).toFixed(0)}%; areas ${[...loop.areas.keys()].join(" ") || "none"}; a job's steps: median ${q(0.5)} ms, p99 ${q(0.99)}, longest ${st[st.length - 1]?.toFixed(1)}${Object.keys(loop.long).length ? `; steps past 4 ms: ${JSON.stringify(loop.long)}` : ""}`);
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
