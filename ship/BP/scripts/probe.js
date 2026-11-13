// inherency: instrument
// The probe: measures this device's limits (world/limits.js MEASURED) in the game itself, so the
// pacing is worked out from what this Switch or server really does, not a guess.
//
//   /scriptevent shipwright:probe        measure, print, save with the world, and use
//   /scriptevent shipwright:probe show   print the reading in use
//
// What it measures, over a couple of seconds:
//   kappa    a fixed piece of our math (the lattice's noise), timed, over what the lab's QuickJS takes
//   J        how many ms a tick the game gives a job: a job of tiny steps, timed tick by tick
//   natives  fills of 1 and 4,096 blocks, block reads and sets, in the air at the top of the world
//            over the player (put back to air after)
//   L        how far chunks stay loaded round the player, ring by ring
//   ymin, ymax, weather   the dimension's height range, and whether it has weather of its own
import { tell } from "./warn.js";
import { world, system, BlockPermutation, BlockVolume } from "@minecraft/server";
import { fbm } from "./world/noise.js";
import { measured, DEFAULT_MEASURED, GIVEN } from "./world/limits.js";
import { saveLimits, pace_ } from "./seaworld.js";

/**
 * The fixed piece of math, and what it takes in the lab's QuickJS (tools/lab/probelab.mjs measures
 * REF_MS). kappa is the device over the lab: 1 runs like the lab, 2 at half its speed. Every timing
 * the labs take under QuickJS is a device's timing once multiplied by kappa.
 */
export const WORK_N = 1000;
export const REF_MS = 30;    // given: the lab's QuickJS time for work() (probelab)
export function work(n = WORK_N) {
  let s = 0;
  for (let i = 0; i < n; i++) s += fbm(i * 0.37, i * 0.11, 12345, 3);
  return s;
}

const now = () => Date.now();
function timed(f, reps) {
  const a = now();
  for (let i = 0; i < reps; i++) f(i);
  return (now() - a) / reps;
}

/** The probe, as a job: yields between measures so no tick carries it all. */
export function* probeSteps(p, out) {
  const dim = p.dimension;
  // the interpreter: the work five times, the fastest kept (a hitch on one run shouldn't count)
  let best = Infinity;
  for (let k = 0; k < 5; k++) {
    const a = now();
    work();
    best = Math.min(best, now() - a);
    yield;
  }
  out.kappa = +(Math.max(best, 0.5) / REF_MS).toFixed(2);
  // the job slice: tiny steps, timed per tick, for 40 ticks
  const ticks = new Map();
  const t0 = system.currentTick;
  while (system.currentTick - t0 < 40) {
    const t = system.currentTick, a = now();
    let x = 0;
    for (let i = 0; i < 200; i++) x += Math.sqrt(i);   // a few microseconds
    const r = ticks.get(t) ?? { first: a, last: a, steps: 0 };
    r.last = now(); r.steps++;
    ticks.set(t, r);
    yield x;
  }
  const spans = [...ticks.values()].filter((r) => r.steps > 2).map((r) => r.last - r.first).sort((a, b) => a - b);
  if (spans.length) out.J = Math.max(1, spans[Math.floor(spans.length / 2)]);
  // the height range and the weather
  try { out.ymin = dim.heightRange.min; out.ymax = dim.heightRange.max; } catch { /* older game */ }
  try { out.weather = String(dim.getWeather()); } catch { out.weather = "none"; }
  yield;
  // loaded chunks: ring by ring outward, until a ring isn't loaded on every side
  const cx = Math.floor(p.location.x / GIVEN.CHUNK), cz = Math.floor(p.location.z / GIVEN.CHUNK);
  let L = 0;
  for (let r = 1; r <= 32; r++) {
    const all = [[r, 0], [-r, 0], [0, r], [0, -r]].every(([i, j]) => {
      try { return dim.isChunkLoaded({ x: (cx + i) * GIVEN.CHUNK + 8, y: 64, z: (cz + j) * GIVEN.CHUNK + 8 }); } catch { return false; }
    });
    if (!all) break;
    L = r;
  }
  if (L > 0) out.L = L;
  yield;
  // natives: in the air near the top of the world, over the player's chunk; put back to air after
  const top = (out.ymax ?? DEFAULT_MEASURED.ymax) - 20, x0 = cx * GIVEN.CHUNK, z0 = cz * GIVEN.CHUNK;
  try {
    const air = BlockPermutation.resolve("minecraft:air"), glass = BlockPermutation.resolve("minecraft:glass");
    const one = new BlockVolume({ x: x0, y: top, z: z0 }, { x: x0, y: top, z: z0 });
    const cube = new BlockVolume({ x: x0, y: top - 15, z: z0 }, { x: x0 + 15, y: top, z: z0 + 15 });
    const f1 = timed((i) => dim.fillBlocks(one, i % 2 ? air : glass), 200);
    yield;
    const fBig = timed((i) => dim.fillBlocks(cube, i % 2 ? air : glass), 10);
    dim.fillBlocks(cube, air);
    yield;
    const b = dim.getBlock({ x: x0, y: top, z: z0 });
    const g = timed(() => dim.getBlock({ x: x0, y: top, z: z0 }), 2000);
    const s = b ? timed((i) => b.setPermutation(i % 2 ? air : glass), 1000) : null;
    b?.setPermutation(air);
    out.fill0 = Math.max(0.001, f1);
    out.fill1 = Math.max(0.0000001, (fBig - f1) / 4095);
    out.get = Math.max(0.0001, g);
    if (s !== null) out.set = Math.max(0.0001, s);
  } catch (err) {
    out.nativeError = String(err);
  }
  out.probed = true;
  out.at = system.currentTick;
}

function report(m, pace) {
  const n = (v, d = 3) => (typeof v === "number" ? +v.toFixed(d) : v);
  return [
    `§e[Shipwright] Limits${m.probed ? "" : " (a guess: not probed yet)"}:`,
    `§7interpreter ${n(m.kappa, 1)}x Node, job slice ${n(m.J, 1)} ms, loaded radius ${m.L} chunks`,
    `§7fill ${n(m.fill0)} ms + ${n(m.fill1 * 1000, 4)} µs a block, set ${n(m.set, 4)} ms, get ${n(m.get, 4)} ms`,
    `§7height ${m.ymin}..${m.ymax}, weather ${m.weather ?? "?"}`,
    `§7pacing: queue ${pace.genRadius} chunks round, plan ${pace.lookahead} ticks ahead, haze may reach ${pace.hazeReach} blocks`,
  ];
}

export function registerProbe() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "shipwright:probe") return;
    const p = ev.sourceEntity;
    const arg = String(ev.message ?? "").trim().toLowerCase();
    const say = (lines) => { for (const l of lines) { tell(p, l); console.warn(l.replace(/§./g, "")); } };
    if (arg === "show" || p?.typeId !== "minecraft:player") { say(report(measured(), pace_())); return; }
    tell(p, "§7[Shipwright] Probing this device's limits (a few seconds; stand still)...");
    const out = {};
    system.runJob((function* () {
      try { yield* probeSteps(p, out); } catch (err) { out.error = String(err); }
      const pace = saveLimits({ ...measured(), ...out });
      say(report(measured(), pace));
      if (out.nativeError) say([`§c native calls: ${out.nativeError}`]);
      say(["§7Saved with the world. Paste these lines back to Claude."]);
    })());
  });
}
