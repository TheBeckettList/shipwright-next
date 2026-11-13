// The Minecraft simulator: the sea world's real code, run the way the game runs it.
//
//   node tools/lab/qjs.mjs tools/lab/mcsim.mjs [--boatblock] [--players n] [--seed n] [--load r] [--budget ms] [--kappa k] [--ticks n]
//
// The device it plays comes from world/limits.js (MEASURED: the probe's reading, or the guess):
// --load, --budget and --kappa override it. kappa scales the script's own time (a device kappa times
// slower than this lab's QuickJS); the native calls are costed by the reading's fill/set/get.
//   (or under Node, for a quick look: node --import ./tests/mocks/register.mjs tools/lab/mcsim.mjs)
//
// What it models from the game (and why each matters):
//   interpreter  run under QuickJS (qjs.mjs), the engine the game uses: no JIT, tens of times slower
//                than Node. Every timing that decides a hitch comes from here.
//   ticks        20 a second. Each tick: due timers, then jobs, which get what's left of a script
//                budget (--budget, default 10 ms of the 50 ms tick) but always at least one step.
//   watchdog     a tick's script over 100 ms is a spike (a warning); over 3,000 ms a hang, and the
//                game may stop the script.
//   loading      the server keeps chunks loaded only within a radius of each player (--load chunks);
//                outside it, blocks can't be read or set.
//   natives      fills and block sets cost what the game's own calls cost (a model: they're native).
//   a player     arrives (as on joining), stands only on a solid block, falls otherwise; then sails
//                flat out on a ship.
//   the haze     the sea haze ends 100 blocks out: an unlaid chunk nearer than that is void you'd see.
import { world, system } from "@minecraft/server";
import { makePlayer } from "../../tests/mocks/server.mjs";
import { SEA_DIM } from "../../BP/scripts/dims.js";
import { CHUNK, planTrace } from "../../BP/scripts/world/chunkgen.js";
import { FLOOR_MIN, SEA_LEVEL } from "../../BP/scripts/world/terrain.js";
import * as sw from "../../BP/scripts/seaworld.js";
import { DEFAULT_MEASURED, measured, GIVEN, BUDGET } from "../../BP/scripts/world/limits.js";

const ARGS = globalThis.SIM_ARGS ?? (typeof process !== "undefined" ? process.argv.slice(2) : []);
const opt = (k, d) => (ARGS.includes(k) ? Number(ARGS[ARGS.indexOf(k) + 1]) : d);
const HAZE = { haze_clear: 640, haze_open: 210, haze_far: 120, haze_mid: 84, haze_near: 52, haze_thick: 30, haze_dense: 12 };   // where each haze ends (blocks), as RP/fogs
const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function simulate({ mode = "port", players: crew = 1, seed = 12345, load = DEFAULT_MEASURED.L, budget = DEFAULT_MEASURED.J, kappa = DEFAULT_MEASURED.kappa, ticks = 900, speed = 0.42, heading = 0, sailFrom = 400, haze = 100 } = {}) {
  system.manualJobs = true;
  system.intervals.length = 0;
  system.jobs.length = 0;
  system.timeouts.length = 0;
  world.setDynamicProperty("shipwright:seed", seed);
  world.setDynamicProperty("shipwright:spawn", undefined);
  world.setDynamicProperty("shipwright:mode", mode);              // port: arrive at the homeport; boatblock: on the castaway raft
  const dim = world.getDimension(SEA_DIM);
  const p = makePlayer(dim);
  p.location = { x: 0.5, y: 70, z: 0.5 };
  p.dimension = world.getDimension("minecraft:overworld");
  p.isValid = true;
  p.addEffect = () => {};
  p.runCommand = (cmd) => { const m = /push shipwright:(\w+)/.exec(cmd); if (m) p.haze = m[1]; };
  p.inputInfo = { getButtonState: () => "Released" };
  p.teleport = (at, o) => { p.location = { ...at }; if (o?.dimension) p.dimension = o.dimension; p.vy = 0; };
  const dir = { x: Math.cos((heading * Math.PI) / 180), z: Math.sin((heading * Math.PI) / 180) };
  p.getVelocity = () => (sailing ? { x: dir.x * speed, y: 0, z: dir.z * speed } : { x: 0, y: 0, z: 0 });
  // the rest of the crew: they join a tick apart and stand where they arrive
  const others = [];
  for (let k = 1; k < crew; k++) {
    const o = makePlayer(dim);
    Object.assign(o, { location: { x: 0.5 + k, y: 70, z: 0.5 }, dimension: world.getDimension("minecraft:overworld"), isValid: true, addEffect: () => {}, runCommand: () => ({}),
      inputInfo: { getButtonState: () => "Released" }, getVelocity: () => ({ x: 0, y: 0, z: 0 }) });
    o.teleport = (at, op) => { o.location = { ...at }; if (op?.dimension) o.dimension = op.dimension; o.vy = 0; };
    others.push(o);
  }
  world.players = [p, ...others];
  // the server keeps chunks loaded round the player (in the sea world)
  dim.loadedFn = (x, z) => p.dimension === dim && Math.abs(Math.floor(x / CHUNK) - Math.floor(p.location.x / CHUNK)) <= load && Math.abs(Math.floor(z / CHUNK) - Math.floor(p.location.z / CHUNK)) <= load;
  // the game's native calls: costed by a model (they're native), the blocks they lay kept; the test
  // world's own time spent writing them is taken off (it's not the game's)
  let model = 0, mock = 0;
  const fill0 = dim.fillBlocks.bind(dim), get0 = dim.getBlock.bind(dim);
  dim.fillBlocks = (v, perm) => {
    const vol = (Math.abs(v.to.x - v.from.x) + 1) * (Math.abs(v.to.y - v.from.y) + 1) * (Math.abs(v.to.z - v.from.z) + 1);
    model += N.fill0 + vol * N.fill1;
    const a = clock();
    try { return fill0(v, perm); } finally { mock += clock() - a; }
  };
  dim.getBlock = (l) => {
    const a = clock();
    const b = get0(l);
    mock += clock() - a;
    model += N.get;
    if (!b) return b;
    const set = b.setPermutation;
    b.setPermutation = (perm) => { model += N.set; const c = clock(); try { return set(perm); } finally { mock += clock() - c; } };
    return b;
  };
  sw.startSeaWorld();
  const pace = sw.useLimits({ ...DEFAULT_MEASURED, L: load, J: budget, kappa });
  const N = measured();
  let sailing = false;
  const solid = (x, y, z) => { const id = dim.blocks.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`); return !!id && !/air|water|lava|seagrass|kelp|snow_layer|short_grass|fern|flower|poppy|dandelion/.test(id); };
  const out = { device: { L: load, J: budget, kappa }, pace, ticks, spikes: 0, hangs: 0, worstTick: 0, meanTick: 0, arrivedAt: null, standingAt: null, fell: 0, intoVoid: false, voidSeen: 0, nearestVoid: Infinity, laid: 0, slowestStep: { ms: 0 }, phases: {} };
  let sum = 0;
  for (let t = 1; t <= ticks; t++) {
    system.currentTick = t;
    const t0 = clock();
    model = 0; mock = 0;
    // the player joins on the first tick
    if (t === 1) sw.bringIn(p, seed);
    if (t >= 2 && t - 1 <= others.length) sw.bringIn(others[t - 2], seed);
    for (const tm of system.timeouts.filter((x) => x.at === t)) tm.f();
    system.timeouts = system.timeouts.filter((x) => x.at > t);
    for (const iv of system.intervals) if (t % iv.every === 0) iv.f();
    const after = (clock() - t0 - mock) * kappa + model;
    // jobs: what's left of the budget, at least one step each
    let steps = 0;
    while (system.jobs.length && (steps < system.jobs.length || (clock() - t0 - mock) * kappa + model < budget)) {
      const job = system.jobs[steps % system.jobs.length];
      const s0 = clock(), m0 = model, k0 = mock;
      const r = job.next();
      const ms = (clock() - s0 - (mock - k0)) * kappa + model - m0;
      const ph = sw.trace.phase + (planTrace.part && sw.trace.phase === "plan" ? "/" + planTrace.part : "");
      out.phases[ph] = +((out.phases[ph] ?? 0) + ms).toFixed(1);
      if (ms > GIVEN.SPIKE * BUDGET.step && (out.longSteps ??= []).length < 12) out.longSteps.push({ t, ms: +ms.toFixed(1), phase: ph });
      if (ms > out.slowestStep.ms) out.slowestStep = { ms: +ms.toFixed(1), phase: sw.trace.phase + (planTrace.part ? "/" + planTrace.part : ""), tick: t };
      if (r.done) system.jobs.splice(system.jobs.indexOf(job), 1);
      steps++;
      if (steps > 10000) break;
    }
    const tickMs = (clock() - t0 - mock) * kappa + model;
    sum += tickMs;
    out.worstTick = Math.max(out.worstTick, +tickMs.toFixed(1));
    if (tickMs > GIVEN.SPIKE) { out.spikes++; if ((out.spikeAt ??= []).length < 8) out.spikeAt.push({ t, ms: +tickMs.toFixed(1), timers: +after.toFixed(1), steps }); }
    if (tickMs > 3000) out.hangs++;
    // the player: in the sea world, standing or falling; then sailing
    if (p.dimension === dim) {
      out.arrivedAt ??= t;
      if (t >= sailFrom && out.standingAt !== null) {
        sailing = true;
        p.location = { x: p.location.x + dir.x * speed, y: SEA_LEVEL + 1, z: p.location.z + dir.z * speed };   // aboard: she floats
      } else if (solid(p.location.x, p.location.y - 0.5, p.location.z)) {
        out.standingAt ??= t;
        p.vy = 0;
      } else {
        p.vy = Math.min(3.9, (p.vy ?? 0) + 0.08);
        p.location = { ...p.location, y: p.location.y - p.vy };
        out.fell += p.vy;
        if (p.location.y < FLOOR_MIN) { out.intoVoid = true; p.location.y = FLOOR_MIN; }
      }
      // what can be seen through the haze: any unlaid chunk nearer than the haze ends
      if (t % 20 === 0 && out.standingAt !== null) {
        let nearest = Infinity;
        const pcx = Math.floor(p.location.x / CHUNK), pcz = Math.floor(p.location.z / CHUNK), R = Math.ceil(haze / CHUNK) + 1;
        for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
          const cx = pcx + i, cz = pcz + j;
          if (dim.blocks.get(`${cx * CHUNK},${FLOOR_MIN - 1},${cz * CHUNK}`) === "minecraft:barrier") continue;
          const dx = Math.max(0, Math.abs(p.location.x - (cx * CHUNK + 8)) - 8), dz = Math.max(0, Math.abs(p.location.z - (cz * CHUNK + 8)) - 8);
          nearest = Math.min(nearest, Math.hypot(dx, dz));
        }
        const hz = HAZE[p.haze] ?? haze;
        if (nearest < hz) {
          out.voidSeen++;
          if ((out.voidAt ??= []).length < 6) out.voidAt.push({ t, nearest: Math.round(nearest), haze: p.haze, jobs: system.jobs.length, at: [Math.round(p.location.x), Math.round(p.location.z)], sailing });
        }
        out.nearestVoid = Math.min(out.nearestVoid, Math.round(nearest));
      }
    }
  }
  out.meanTick = +(sum / ticks).toFixed(2);
  out.perChunk = Object.fromEntries(Object.entries(out.phases).map(([k, v]) => [k, +(v / Math.max(1, out.laid ?? 1)).toFixed(1)]));
  for (const v of dim.blocks.values()) if (v === "minecraft:barrier") out.laid++;
  out.perChunk = Object.fromEntries(Object.entries(out.phases).map(([k, v]) => [k, +(v / Math.max(1, out.laid)).toFixed(1)]));
  out.issues = [];
  if (out.hangs) out.issues.push(`${out.hangs} hang(s): a tick over 3 s`);
  if (out.spikes) out.issues.push(`${out.spikes} spike(s) over 100 ms (worst ${out.worstTick} ms)`);
  if (out.standingAt === null) out.issues.push("the arriving player never stood on anything");
  if (out.fell > 2) out.issues.push(`the arriving player fell ${out.fell.toFixed(1)} blocks`);
  if (out.intoVoid) out.issues.push("the arriving player fell into the void");
  if (out.voidSeen) out.issues.push(`unlaid void seen through the haze ${out.voidSeen} time(s) (nearest ${out.nearestVoid} blocks)`);
  return out;
}

const r = simulate({ mode: ARGS.includes("--boatblock") ? "boatblock" : "port", players: opt("--players", 1), seed: opt("--seed", 12345), load: opt("--load", DEFAULT_MEASURED.L), budget: opt("--budget", DEFAULT_MEASURED.J), kappa: opt("--kappa", DEFAULT_MEASURED.kappa), ticks: opt("--ticks", 900), heading: opt("--heading", 0) });
globalThis.RESULT = JSON.stringify(r);
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("mcsim.mjs")) console.log(JSON.stringify(r, null, 1));
