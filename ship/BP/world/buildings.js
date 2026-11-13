// Pure (given a loaded map). Buildings live and die with their people. No building is placed by
// hand: each people has a plan (its homes, then what its living needs, then its guard, in that
// order: architecture.js), and how much of the plan stands is read off its history.
//
//   wealth    a bounded walk, one step a month: up by STEP in a rising month, down in a waning one,
//             never below the plan's core (a people never vanishes) nor above the plan
//   standing  the first floor(wealth) buildings of the plan stand
//   the month inside a month nothing is stepped: a building's state is a closed form of how far the
//             month has run. A building the month adds goes up in stages (footing, frame, roof,
//             finished), each starting at its own share of the month so the town is always at work;
//             a building the month loses is abandoned, falls to ruin, and is cleared in its second
//             half, its materials returned to its people's stores
//   wear      a standing building in a waning month shows its age (worn), and is mended in a rising one
//   the bill  every building costs its people's own materials (architecture.js frame and roof):
//             a home's walls, posts and roof, a hall's twice over. Vanilla items, so a player sees
//             the same stores the people spend
import { rite } from "./solar.js";
import { peoples } from "./peoples.js";
import { loop, firstWorld } from "./history.js";
import { era as runEra } from "../core/cycles.js";
import { continuance } from "./continuance.js";
import { RUNGS } from "../core/clock.js";

export const BUILD = Object.freeze({
  STEP: 1,                                      // vision: buildings a month's fortune adds or takes
  CORE: 2,                                      // vision: homes no history takes away
  HOMES: [3, 8],                                // vision: homes in a plan, fewest and most (by folk)
  STAGES: ["footing", "frame", "roof", "finished"],
  SIZE: { home: { wall: 40, post: 8, roof: 30 }, work: { wall: 60, post: 12, roof: 45 }, hall: { wall: 120, post: 20, roof: 90 }, guard: { wall: 90, post: 30, roof: 0 } },   // vision: blocks a building of each size takes
  START: 0.4,                                   // vision: share of a plan standing on the first day, for a people of median strength
});

/** A people's plan, in building order. */
export function planOf(p) {
  const homes = Math.max(BUILD.HOMES[0], Math.min(BUILD.HOMES[1], Math.round(p.capacity)));
  const plan = [];
  for (let i = 0; i < homes; i++) plan.push({ name: `home ${i + 1}`, size: "home" });
  for (const b of p.build.set) plan.push({ name: b, size: /hall|market|warehouse/.test(b) ? "hall" : "work" });
  if (p.build.guard !== "none") plan.push({ name: p.build.guard, size: "guard" });
  return plan.map((b, i) => ({ ...b, i, bill: bill(p, b.size) }));
}
/** What a building costs its people (vanilla items). */
export function bill(p, size) {
  const S = BUILD.SIZE[size], f = p.build.frame, out = {};
  const add = (id, n) => { if (id && n) out[id] = (out[id] ?? 0) + n; };
  add(f.wall, S.wall * p.build.mass); add(f.post, S.post); add(p.build.roof.cover, S.roof);
  return out;
}

// the months: every people's fortune at each month's end (the record), stepped a day at a time once
// and kept. Every twelfth month ends a year with the Therans' continuance (continuance.js): the next
// year begins from the held record, and the pulse is back at its point (a year is its breath).
let months = null;
export function monthRecords(n) {
  const L = loop(), trad = (i) => L[i].tradition;
  months ??= { w: firstWorld(), list: [], logs: [] };
  while (months.list.length < n) {
    runEra(months.w, null, RUNGS.month);
    if ((months.list.length + 1) % (RUNGS.year / RUNGS.month) === 0) {
      const c = continuance(months.w.record, trad);
      months.w.record = c.record; months.logs.push([...c.log, rite(Math.floor(months.list.length / 12))]);   // derived: the year's end (twelve months): the continuance, and the solar rite
    }
    months.list.push(months.w.record.slice());
  }
  return months.list.slice(0, n);
}
export const yearRecords = monthRecords;   // the walk's step is a month now (the name kept for callers)
export const continuanceLogs = () => months?.logs ?? [];
/** How much of each people's plan stands at the end of each month 0..n (0: the first day). */
export function wealthWalk(n) {
  const L = loop(), recs = yearRecords(n), caps = L.map((p) => p.capacity).sort((a, b) => a - b), median = caps[caps.length >> 1];
  return L.map((p, i) => {
    const size = planOf(p).length, walk = [];
    let w = Math.max(BUILD.CORE, Math.min(size, Math.round(size * BUILD.START * Math.sqrt(p.capacity / median))));   // vision: strength's weight on the first day
    walk.push(w);
    for (const r of recs) { w = Math.max(BUILD.CORE, Math.min(size, w + BUILD.STEP * r[i])); walk.push(w); }
    return { key: p.key, size, walk };
  });
}
/** Every building of a people in month m (y), a share `into` through it: its state and stage. */
export function buildingsAt(p, walk, y, into, fortune) {
  const plan = planOf(p), n0 = walk[y] ?? walk.at(-1), n1 = walk[y + 1] ?? n0;
  return plan.map((b) => {
    if (b.i < Math.min(n0, n1)) return { ...b, state: fortune < 0 ? "worn" : "standing" };
    if (n1 > n0 && b.i >= n0 && b.i < n1) {   // going up: each starts at its own share of the year
      const start = (b.i - n0) / (n1 - n0) * 0.5, u = (into - start) / 0.5;   // vision: building takes half a month
      if (u < 0) return { ...b, state: "plot" };
      return { ...b, state: u >= 1 ? "standing" : "building", stage: BUILD.STAGES[Math.min(BUILD.STAGES.length - 1, Math.floor(u * BUILD.STAGES.length))] };
    }
    if (n1 < n0 && b.i >= n1 && b.i < n0) return { ...b, state: into < 0.25 ? "abandoned" : into < 0.5 ? "ruin" : "cleared", returns: into >= 0.5 ? b.bill : null };   // vision: a quarter-month empty, a quarter in ruin
    return { ...b, state: "plot" };
  });
}
export { peoples };
