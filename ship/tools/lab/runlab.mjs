// The runtime lab: the sea world's own timers and jobs, driven tick by tick on the test grid with a
// player sailing flat out, to see what the backend does when it runs, not only what it computes.
//
//   node --import ./tests/mocks/register.mjs tools/lab/runlab.mjs [seed] [--ticks n] [--speed b/t] [--budget ms]
//
// Lenses
//   ahead     the generator stays ahead of a ship: no ungenerated chunk inside the view ahead of her
//   cost      per chunk: the time to work it out, and the game calls to lay it (fills, block sets);
//             per tick: the slice the jobs use (as the game gives a job a time slice each tick)
//   wind      what one boat's wind costs each tick in the sea world
//   life      what the life loop brings in over a few in-game minutes, by kind, and never past its caps
import { world, system } from "@minecraft/server";
import { makePlayer } from "../../tests/mocks/server.mjs";
import { SEA_DIM } from "../../BP/scripts/dims.js";
import { CHUNK, chunkPlan } from "../../BP/scripts/world/chunkgen.js";
import { FLOOR_MIN } from "../../BP/scripts/world/terrain.js";
import { seaWorldWind } from "../../BP/scripts/wind.js";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);

export async function run(seed = 12345, { ticks = 1200, speed = 0.42, budget = 6, view = 5, heading = 0 } = {}) {
  system.manualJobs = true;
  system.intervals.length = 0;
  system.jobs.length = 0;
  world.setDynamicProperty("shipwright:seed", seed);
  const sw = await import("../../BP/scripts/seaworld.js");
  sw.forgetSeed();                                                   // (an earlier caller may have cached another)
  sw.startSeaWorld();
  const dim = world.getDimension(SEA_DIM);
  // The game's own block calls are native and fast; the test world's stand-ins write every block in
  // script, so they'd swamp the measure. Here they're counted and costed by a model instead
  // (FILL_MS a fill plus a little per block, SET_MS a set), and only the done marks are written.
  const calls = { fill: 0, set: 0, get: 0 };
  let model = 0;
  const FILL_MS = 0.02, PER_BLOCK_MS = 0.00002, SET_MS = 0.008;
  const fill0 = dim.fillBlocks.bind(dim), get0 = dim.getBlock.bind(dim);
  dim.fillBlocks = (v, p) => {
    calls.fill++;
    const vol = (Math.abs(v.to.x - v.from.x) + 1) * (Math.abs(v.to.y - v.from.y) + 1) * (Math.abs(v.to.z - v.from.z) + 1);
    model += FILL_MS + vol * PER_BLOCK_MS;
    if (vol === 1) return fill0(v, p);                    // the done marks (and single blocks)
  };
  dim.getBlock = (l) => {
    calls.get++;
    const b = get0(l);
    b.setPermutation = () => { calls.set++; model += SET_MS; };
    return b;
  };
  const dir = { x: Math.cos((heading * Math.PI) / 180), z: Math.sin((heading * Math.PI) / 180) };
  const { homeport } = await import("../../BP/scripts/world/homeport.js");
  const sp = homeport(seed).spawn;                                   // Strongyle, worked out before the clock starts (the game's job for it is timed in mcsim)
  const p = makePlayer(dim);
  p.location = { x: sp.x, y: 63, z: sp.z };
  p.dimension = dim;
  p.inputInfo = { getButtonState: () => "Released" };
  p.addEffect = () => {};
  p.getVelocity = () => (system.currentTick > 100 ? { x: dir.x * speed, y: 0, z: dir.z * speed } : { x: 0, y: 0, z: 0 });
  world.players = [p];
  const done = (cx, cz) => dim.blocks.get(`${cx * CHUNK},${FLOOR_MIN - 1},${cz * CHUNK}`) === "minecraft:barrier";
  let worstGap = Infinity, sliceMax = 0, sliceSum = 0, behind = 0, chunks0 = 0;
  const timers = {};
  const slowest = Array.from({ length: 5 }, () => ({ ms: 0 }));
  const firstAt = [];
  for (let t = 1; t <= ticks; t++) {
    system.currentTick = t;
    for (const iv of system.intervals) if (t % iv.every === 0) {
      const a = performance.now();
      iv.f();
      const ms = performance.now() - a;
      const key = `every ${iv.every}`;
      timers[key] = Math.max(timers[key] ?? 0, +ms.toFixed(2));
    }
    // the game gives jobs a slice of each tick
    const t0 = performance.now();
    model = 0;
    while (system.jobs.length && performance.now() - t0 + model < budget) {
      const s0 = performance.now(), m0 = model;
      const r = system.jobs[0].next();
      const step = performance.now() - s0 + model - m0;
      if (step > slowest[slowest.length - 1].ms) { slowest.push({ ms: +step.toFixed(1), phase: sw.trace.phase, part: (await import("../../BP/scripts/world/chunkgen.js")).planTrace.part, tick: t }); slowest.sort((a, b) => b.ms - a.ms); slowest.length = 5; }
      if (r.done) system.jobs.shift();
    }
    const slice = performance.now() - t0 + model;
    sliceMax = Math.max(sliceMax, slice);
    sliceSum += slice;
    // sail on (after a short start, as a ship gathers way)
    if (t > 100) p.location = { ...p.location, x: p.location.x + dir.x * speed, z: p.location.z + dir.z * speed };
    // how far ahead is laid: the first chunk on her course, within view, not yet laid
    if (t > 200 && t % 10 === 0) {
      const pcx = Math.floor(p.location.x / CHUNK), pcz = Math.floor(p.location.z / CHUNK);
      let gap = view + 1;
      for (let k = 0; k <= view; k++) {
        const cx = Math.floor((p.location.x + dir.x * k * CHUNK) / CHUNK), cz = Math.floor((p.location.z + dir.z * k * CHUNK) / CHUNK);
        if (!done(cx, cz)) { gap = k; break; }
      }
      worstGap = Math.min(worstGap, gap);
      if (gap < 2) behind++;
      void pcx; void pcz;
    }
    if (t === 200) chunks0 = countDone(dim);
    if (!firstAt.length && done(Math.floor(sp.x / CHUNK), Math.floor(sp.z / CHUNK))) firstAt.push(t);
  }
  const laid = countDone(dim);
  // the pure cost of working a chunk out, and the calls to lay one (averaged over what was laid)
  const t1 = performance.now();
  for (let i = 0; i < 20; i++) chunkPlan(seed, 500 + i, 300 - i);
  const planMs = (performance.now() - t1) / 20;
  // one boat's wind
  const t2 = performance.now();
  for (let i = 0; i < 400; i++) seaWorldWind({ x: sp.x + i * 0.4, z: sp.z }, i, 6000);
  const windMs = (performance.now() - t2) / 400;
  const issues = [];
  for (const [k, ms] of Object.entries(timers)) if (ms > 8) issues.push(`the timer running ${k} ticks took ${ms} ms`);
  if (slowest[0].ms > 50) issues.push(`a job step took ${slowest[0].ms} ms (${slowest[0].phase}): a hitch`);
  if (worstGap < 2) issues.push(`fell behind: an unlaid chunk ${worstGap} ahead of her (${behind} times)`);
  if (windMs > 0.15) issues.push(`a boat's wind costs ${windMs.toFixed(2)} ms a tick`);
  if (planMs > 15) issues.push(`a chunk takes ${planMs.toFixed(1)} ms to work out`);
  if (!firstAt.length || firstAt[0] > 60) issues.push(`the spawn chunk was laid at tick ${firstAt[0] ?? "never"} (a new player is falling)`);
  dim.fillBlocks = fill0; dim.getBlock = get0;                       // give the test world back its own block calls
  return {
    seed, ticks, laid, perChunk: { fills: +(calls.fill / Math.max(1, laid)).toFixed(0), sets: +(calls.set / Math.max(1, laid)).toFixed(0), gets: +(calls.get / Math.max(1, laid)).toFixed(0) },
    timers, slowest, planMs: +planMs.toFixed(1), slice: { max: +sliceMax.toFixed(1), mean: +(sliceSum / ticks).toFixed(2) }, worstGap, windMs: +windMs.toFixed(3), spawnLaidAt: firstAt[0] ?? null,
    rate: +(((laid - chunks0) / Math.max(1, ticks - 200)) * 20).toFixed(1), issues,
  };
}

function countDone(dim) {
  let n = 0;
  for (const [k, v] of dim.blocks) if (v === "minecraft:barrier" && k.includes(`,${FLOOR_MIN - 1},`)) n++;
  return n;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = Number(args.find((a) => /^\d+$/.test(a)) ?? 12345);
  const r = await run(seed, { ticks: opt("--ticks", 1200), speed: opt("--speed", 0.42), budget: opt("--budget", 6), heading: opt("--heading", 0) });
  console.log(JSON.stringify(r, null, 1));
  process.exitCode = r.issues.length ? 1 : 0;
}
