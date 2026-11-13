// The loading model: a player flies (or sails) a real line over the map, the layer lays chunks under a per-tick
// budget, and we count the holes: chunks in the player's view that aren't laid yet. Compares the ways of laying.
//   node tools/flysim.mjs [--speed 10.9] [--view 8] [--secs 120] [--probes waterworld-probes.jsonl]
//
// The cost of a pass in the game is a model with four unknowns: ms = r·js + a·fills + b·sets + c·blocks/1000, where
// js, fills, sets and blocks are measured in Node (tools/modtest/passes.mjs → dist/modtest-passes*.json) and r, a,
// b, c are the game's (QuickJS against V8, and the engine's price of a fill, a set and a thousand blocks). Until
// the server's probes fit them (--probes), three scenarios bracket them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadMap } = await import(path.join(root, "world/load.js")); loadMap();
const { climateAtBlock } = await import(path.join(root, "world/climate.js"));
const { theraUV, chunkColumnsSteps } = await import(path.join(root, "game/ground.js"));
const PHI = (1 + Math.sqrt(5)) / 2;   // derived: the golden ratio
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };

// ---- the measured passes (Node): what each kind of chunk costs the script and the engine
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "tools/modtest", f), "utf8"));   // kept beside the harness (the build clears dist/)
const FULL = read("passes-full.json"), SKIN = read("passes-skin.json"), MESHED = read("passes-mesh.json");
const KIND_OF = { thera: "thera flight", land: "river", shallow: "land flight", sea: "sea sail" };   // vision: which measured line stands for which kind of chunk
const passCost = (M, kind, pass, k) => { const m = M[KIND_OF[kind]]; return k.r * m[pass] + k.a * m.byPass[pass].fills + k.b * m.byPass[pass].sets + k.c * m.byPass[pass].volume / 1000; };

// ---- the game's unknowns: three scenarios, or the probes' fit
const SCEN = {   // vision: brackets for the engine until the probes say (ms; B is the script's slice of each 50 ms tick)
  quick: { r: 10, a: 0.01, b: 0.005, c: 0.05, B: 20 },
  middle: { r: 20, a: 0.03, b: 0.015, c: 0.2, B: 12 },
  slow: { r: 40, a: 0.08, b: 0.04, c: 0.6, B: 6 },
};
const probesFile = arg("probes");
if (probesFile) SCEN.fitted = fit(probesFile);

/** Least squares for (a, b, c) from the game's chunk probes that carry their calls ({k: "chunk", pass, ms, js, fills, sets, vol}). */
function fit(file) {
  const rows = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((p) => p.k === "chunk" && p.fills != null && p.src !== "node");
  if (rows.length < 8) { console.log(`probes: ${rows.length} chunk records with calls, too few to fit (eight or more)`); return { ...SCEN.middle }; }
  const X = rows.map((p) => [p.fills, p.sets, p.vol / 1000]), y = rows.map((p) => p.ms - (p.jsms ?? 0));
  const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, x) => s + x[i] * x[j], 0))), v = [0, 1, 2].map((i) => X.reduce((s, x, n) => s + x[i] * y[n], 0));
  const sol = solve3(A, v), B = rows.find((p) => p.budget)?.budget ?? SCEN.middle.B;
  // r: the game's reckoning against Node's, chunk by chunk (the surface passes carry the plan's ms)
  const surf = rows.filter((p) => p.to === 1 && p.jsms > 0).slice(0, 89); let g = 0, nd = 0;   // vision: up to 89 chunks timed again here
  for (const p of surf) { const t0 = performance.now(), it = chunkColumnsSteps(p.cx, p.cz, { mesh: p.kind === "town" || p.kind === "thera" ? 0 : 3 }); while (!it.next().done); nd += performance.now() - t0; g += p.jsms; }
  if (surf.length) console.log(`probes: the game reckons ${(g / nd).toFixed(1)} times slower than Node (${surf.length} surface passes)`);
  console.log(`probes: fitted on ${rows.length} chunks: a ${sol[0].toFixed(4)} ms a fill, b ${sol[1].toFixed(4)} a set, c ${sol[2].toFixed(3)} a thousand blocks`);
  return { r: 0, rGame: surf.length ? g / nd : null, a: Math.max(0, sol[0]), b: Math.max(0, sol[1]), c: Math.max(0, sol[2]), B };   // the probes' ms already hold the script's own time
}
function solve3(A, v) { const M = A.map((r, i) => [...r, v[i]]); for (let i = 0; i < 3; i++) { let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; for (let k = 0; k < 3; k++) if (k !== i && M[i][i]) { const f = M[k][i] / M[i][i]; for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j]; } } return M.map((r, i) => (r[i] ? r[3] / r[i] : 0)); }

// ---- the line: from Thera's harbour east along its latitude, every chunk's kind from the sim
const C = 16, TICK = 20, R = { deep: 5, surface: 13 }, WEIGHT = [0, 1, PHI, PHI * PHI];   // given: a chunk, the game's ticks a second; the rings (rings.js)
const kindCache = new Map();
function kindAt(cx, cz) { const key = cx * 65536 + cz; let k = kindCache.get(key); if (k) return k; const x = cx * C + 8, z = cz * C + 8, h = climateAtBlock(x, z).h; k = theraUV(x, z) ? "thera" : h > 0 ? "land" : h > -21 ? "shallow" : "sea"; kindCache.set(key, k); return k; }   // vision: deep sea past twenty-one blocks

/**
 * One flight. way: { skin, chain, lead, ahead, fastDeep }:
 *   skin   the surface pass lays only the skin (its body waits for the deep pass)
 *   chain  the layer goes straight on to the next chunk in the same tick (one job that never ends)
 *   lead   seconds of the player's velocity the rings are centred ahead by
 *   ahead  a ticking area of 8×8 chunks held ahead of a fast player (so chunks past the view load to be laid)
 *   slowDeep  the deep pass only for a player under the fast speed (nobody digs from the air)
 *   mesh   the relief reckoned on a lattice of three (game/ground.js reliefMesh): the plan at half the cost
 */
function fly(way, k, { speed, view, secs, start, heading, pre = 0 }) {
  const M = way.mesh ? MESHED : way.skin ? SKIN : FULL, laid = new Map(), cost = (cx, cz, pass) => passCost(M, kindAt(cx, cz), ["", "surface", "life", "deep"][pass], k);
  let x = start.x, z = start.z, job = null, holes = 0, front = 0, samples = 0, worstGap = 0, chunks = 0, spent = 0;
  const vx = Math.cos(heading) * speed, vz = Math.sin(heading) * speed, fast = speed > 7.127;   // given: a sprint-jump, 7.127 blocks a second (rings.js FAST)
  const lvl = (cx, cz) => laid.get(cx * 65536 + cz) ?? 0;
  if (pre) for (let a = -pre; a <= pre; a++) for (let b = -pre; b <= pre; b++) laid.set((Math.floor(x / C) + a) * 65536 + Math.floor(z / C) + b, 3);   // a ring laid before the flight (the player waited at the start)
  const loadedAt = (cx, cz, pcx, pcz) => { if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) <= view) return true; if (!way.ahead || !fast) return false; const tx = Math.floor((x + vx / speed * (view + 4) * C) / C), tz = Math.floor((z + vz / speed * (view + 4) * C) / C); return cx >= tx - 4 && cx < tx + 4 && cz >= tz - 4 && cz < tz + 4; };   // vision: the ahead area, eight by eight chunks, its near edge four past the view
  function pick() {
    const pcx = Math.floor(x / C), pcz = Math.floor(z / C), lx = Math.floor((x + vx * way.lead) / C), lz = Math.floor((z + vz * way.lead) / C); let best = null;
    for (let a = -R.surface; a <= R.surface; a++) for (let b = -R.surface; b <= R.surface; b++) {
      const cx = lx + a, cz = lz + b, d = Math.max(Math.abs(a), Math.abs(b)), dp = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz));
      const target = dp <= R.deep && !(way.slowDeep && fast) ? 3 : d <= R.surface ? 2 : 0, at = lvl(cx, cz);
      if (at >= target || !loadedAt(cx, cz, pcx, pcz)) continue;
      const score = d * WEIGHT[at + 1]; if (!best || score < best.score) best = { cx, cz, pass: at + 1, score };
    }
    return best ? { ...best, left: cost(best.cx, best.cz, best.pass) } : null;
  }
  for (let t = 0; t < secs * TICK; t++) {
    x += vx / TICK; z += vz / TICK;
    let budget = k.B;
    if (!job && (way.chain || t % 2 === 0)) job = pick();   // the old way: next() every second tick, a job at a time
    while (job && budget > 0) {
      const use = Math.min(budget, job.left); job.left -= use; budget -= use; spent += use;
      if (job.left <= 1e-9) { const key = job.cx * 65536 + job.cz; laid.set(key, Math.max(lvl(job.cx, job.cz), job.pass)); if (job.pass === 1) chunks++; job = way.chain ? pick() : null; }
    }
    if (t % TICK === 0 && t > TICK * 5) {   // once a second, after five: the holes in view (and in the front half of it)
      const pcx = Math.floor(x / C), pcz = Math.floor(z / C); let n = 0, h = 0, f = 0;
      for (let a = -view; a <= view; a++) for (let b = -view; b <= view; b++) { n++; if (lvl(pcx + a, pcz + b) < 1) { h++; if (a * vx + b * vz > 0) f++; } }
      holes += h / n; front += f / n; samples++; worstGap = Math.max(worstGap, h / n);
    }
  }
  return { holes: holes / samples, front: front / samples, worst: worstGap, perSec: chunks / secs, busy: spent / (secs * TICK * k.B) };
}

// ---- the world's share of land, from the sim (a lattice of chunks)
const CW = 2048 * 8, CH = 1024 * 8, SHARE = (() => { let l = 0, n = 0; for (let cz = 4; cz < CH; cz += 89) for (let cx = 4; cx < CW; cx += 89) { n++; if (climateAtBlock(cx * C + 8, cz * C + 8).h > 0) l++; } return { land: l / n }; })();   // given: the map's 2048 × 1024 regions of 8 × 8 chunks; vision: every 89th chunk
console.log(`land ${(SHARE.land * 100).toFixed(1)}% of ${CW * CH} chunks`);
// ---- the runs
const speed = +arg("speed", 10.89), view = +arg("view", 8), secs = +arg("secs", 90);   // given: creative flight, 10.89 blocks a second
const thera = { x: 8026 * C + 8, z: 2386 * C + 8 };   // vision: the line starts at the Sea Rite Temple (the spawn's chunk)
const WAYS = {
  "now (full passes, a job at a time)": { skin: false, chain: false, lead: 0, ahead: false, slowDeep: false },
  "skin": { skin: true, chain: false, lead: 0, ahead: false, slowDeep: false },
  "skin + one long job": { skin: true, chain: true, lead: 0, ahead: false, slowDeep: false },
  "+ no deep pass while flying": { skin: true, chain: true, lead: 0, ahead: false, slowDeep: true },
  "+ rings led 3 s ahead": { skin: true, chain: true, lead: 3, ahead: false, slowDeep: true },
  "+ a ticking area ahead": { skin: true, chain: true, lead: 3, ahead: true, slowDeep: true },
  "+ the meshed relief (all of it)": { skin: true, chain: true, lead: 3, ahead: true, slowDeep: true, mesh: true },
};
const BEST = "+ the meshed relief (all of it)";
const fmt = (v) => `${(v * 100).toFixed(1).padStart(5)}%`;
for (const [sname, k] of Object.entries(SCEN)) {
  console.log(`\n== ${sname}: r ${k.r}, a ${k.a} ms/fill, b ${k.b} ms/set, c ${k.c} ms/1000 blocks, budget ${k.B} ms a tick; ${speed} b/s, view ${view}`);
  console.log("way".padEnd(38), "holes", " front", " worst", " surf/s", " busy");
  for (const [w, way] of Object.entries(WAYS)) {
    const r = fly(way, k, { speed, view, secs, start: thera, heading: 0, pre: view });
    console.log(w.padEnd(38), fmt(r.holes), fmt(r.front), fmt(r.worst), r.perSec.toFixed(1).padStart(6), fmt(r.busy));
  }
  // the speed the best way holds with no holes ahead: halve the interval
  let lo = 0, hi = 60; for (let n = 0; n < 9; n++) { const v = (lo + hi) / 2, r = fly(WAYS[BEST], k, { speed: v, view, secs: 60, start: thera, heading: 0, pre: view }); if (r.front < 0.005) lo = v; else hi = v; }
  let lo0 = 0, hi0 = 60; for (let n = 0; n < 9; n++) { const v = (lo0 + hi0) / 2, r = fly(WAYS["now (full passes, a job at a time)"], k, { speed: v, view, secs: 60, start: thera, heading: 0, pre: view }); if (r.front < 0.005) lo0 = v; else hi0 = v; }
  console.log(`held with no holes ahead: now ${lo0.toFixed(1)} b/s; the new way ${lo.toFixed(1)} b/s`);
  // the preload: the tour laying skin and life, every chunk in turn, with the whole budget (no player)
  const per = (kind) => passCost(MESHED, kind, "surface", k) + passCost(MESHED, kind, "life", k), rate = (kind) => (k.B * TICK) / per(kind);
  const landShare = SHARE.land, chunks = CW * CH, hl = (chunks * landShare) / rate("land") / 3600, hs = (chunks * (1 - landShare)) / rate("sea") / 3600;
  console.log(`the preload (pregen): land ${rate("land").toFixed(1)} chunks a second, sea ${rate("sea").toFixed(1)}; the whole world's land ${hl.toFixed(0)} h, its sea ${hs.toFixed(0)} h more`);
}
