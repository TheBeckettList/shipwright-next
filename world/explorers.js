// Pure (given a loaded map). Explorers: thirteen ships (a Fibonacci number) always somewhere at sea,
// in closed form: where one is at any tick is worked out from the tick alone, so they cost nothing
// until a player comes near. A player who meets one may be given a chart of what it has seen.
//
//   who       one from each tradition's seat, two from the Koinon's Starward (the state that
//             masters navigation), and one from Thera
//   voyage    a round of EIGHT landfalls (a Fibonacci number) and home: each landfall an island
//             within REACH chunks of the last, picked by the golden sequence (n / phi mod 1: the most
//             evenly spread picks, so a round covers its sea without clumping): a round is a region,
//             and the rounds wander as the sequence does, sailed island to island along the great circle
//             at SPEED; then home, and the next round reads the sequence on
//   meeting   a player within MEET blocks of an explorer: checked once a beat against thirteen
//             points, nothing more
//   chart     what the explorer has passed this round: its landfalls, the wrecks and buried
//             hoards within CHART_REACH of its course, the ruins near its landfalls: the pack's
//             sea_chart marks (home, cove, wreck, treasure, ruin), each with the sheet bit of the
//             globe's cover, so a mark carried over the pole still points true
import { GIVEN, D } from "../core/given.js";
import { islands } from "./islands.js";
import { peoples } from "./peoples.js";
import { loop } from "./history.js";
import { ranks } from "./society.js";
import { league } from "./league.js";
import { THERA } from "./thera.js";
import { TRADITIONS } from "./traditions.js";
import { golden, FIB } from "../core/golden.js";
import { greatCircle } from "../core/globe.js";

export const EXPLORE = Object.freeze({ SHIPS: FIB[6], LANDFALLS: FIB[5], SPEED: 0.4, STAY: 2400, MEET: 96, CHART_REACH: 12, MIN_AREA: 40, REACH: 144 });   // derived: thirteen ships, eight landfalls, a sea of 144 chunks (Fibonacci numbers); vision: blocks a tick under sail, ticks at each landfall, blocks to meet, chunks a chart sees, chunks an island needs to be worth a landfall   // derived: thirteen ships, eight landfalls; vision: blocks a tick under sail, ticks at each landfall, blocks to meet, chunks a chart sees, chunks an island needs to be worth a landfall
const C = D.PX;   // blocks a map cell

let cache = null;
/** The explorers and the islands they may make landfall on. */
export function explorers() {
  if (cache) return cache;
  const I = islands(), isl = I.info.filter((x) => x.area >= EXPLORE.MIN_AREA), R = ranks(), P = peoples().list, Lg = league();
  const homes = [
    ...Object.keys(TRADITIONS).map((t) => { const seat = P.find((p) => p.tradition === t && R.get(p.key) === "seat"); return seat && { name: `the ${t.replace("_", " ")} explorer`, home: { cx: seat.cx, cz: seat.cz }, of: seat.key }; }).filter(Boolean),
    ...[0, 1].map((k) => { const s = Lg.states.find((x) => x.piece === "navigation"); return { name: `${s.name}'s ${k ? "second" : "first"} explorer`, home: { cx: s.seat.cx, cz: s.seat.cz }, of: s.seat.key }; }),
    { name: "the Theran explorer", home: { cx: THERA.seat.cx, cz: THERA.seat.cz }, of: "thera" },
  ].slice(0, EXPLORE.SHIPS);
  cache = { islands: isl, ships: homes.map((h, e) => ({ ...h, e, rounds: new Map() })) };
  return cache;
}
const at = (q) => ({ x: q.cx * C + C / 2, z: q.cz * C + C / 2 });   // given: a chunk's middle
/** A round's course: home, eight landfalls, home; each leg's start tick within the round, and the round's length. */
function round(ship, r) {
  if (ship.rounds.has(r)) return ship.rounds.get(r);
  const { islands: isl } = explorers(), stops = [ship.home];
  let here = ship.home;
  for (let n = 0; n < EXPLORE.LANDFALLS; n++) {
    const W = D.CELLS_W, d = (a, b) => { let dx = Math.abs(a.cx - b.cx); dx = Math.min(dx, W - dx); return Math.hypot(dx, a.cz - b.cz); };
    const near = isl.filter((x) => d(x, here) <= EXPLORE.REACH && d(x, here) > 2), pool = near.length ? near : isl;   // vision: an island two chunks off isn't a voyage
    const k = Math.floor(golden(ship.e * FIB[9] + r * EXPLORE.LANDFALLS + n) * pool.length); here = { cx: pool[k].cx, cz: pool[k].cz, island: pool[k].id }; stops.push(here);   // derived: a Fibonacci stride between ships
  }
  stops.push(ship.home);
  const legs = []; let t = 0;
  for (let i = 0; i + 1 < stops.length; i++) { const len = greatCircle(at(stops[i]), at(stops[i + 1])), dur = len / EXPLORE.SPEED; legs.push({ from: stops[i], to: stops[i + 1], t0: t, dur, len }); t += dur + EXPLORE.STAY; }
  const out = { stops, legs, length: t };
  if (ship.rounds.size > 64) ship.rounds.clear();   // vision: rounds kept in memory
  ship.rounds.set(r, out);
  return out;
}
/** Where an explorer is at tick t: { round, leg, x, z (blocks), landfall (island it's at, if staying) }. Rounds are all the same length-order: found by walking from the first. */
export function explorerAt(ship, t) {
  let r = 0, start = 0;
  for (;;) { const R = round(ship, r); if (t < start + R.length) break; start += R.length; r++; if (r > 1e5) break; }   // vision: a guard on the walk
  const R = round(ship, r), tt = t - start;
  const leg = R.legs.findLast((l) => tt >= l.t0) ?? R.legs[0], f = Math.min(1, (tt - leg.t0) / leg.dur);
  const W = D.CELLS_W; let dx = leg.to.cx - leg.from.cx; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
  const cx = (leg.from.cx + dx * f + W) % W, cz = leg.from.cz + (leg.to.cz - leg.from.cz) * f;
  return { round: r, leg: R.legs.indexOf(leg), f, x: cx * C + C / 2, z: cz * C + C / 2, cx, cz, staying: f >= 1 ? leg.to : null };
}
/** The explorers within MEET blocks of a player at (x, z) at tick t. */
export function meet(x, z, t) {
  return explorers().ships.map((s) => ({ s, p: explorerAt(s, t) })).filter(({ p }) => greatCircle({ x, z }, p) <= EXPLORE.MEET);
}
/** The chart an explorer gives at tick t: marks of what it has passed this round. R: the economy run (wrecks, hoards, ruins). */
export function chartOf(ship, t, R = null) {
  const now = explorerAt(ship, t), Rd = round(ship, now.round), W = D.CELLS_W, marks = [];
  const near = (a, b) => { let dx = Math.abs(a.cx - b.cx); dx = Math.min(dx, W - dx); return Math.hypot(dx, a.cz - b.cz); };
  const mark = (kind, q, name) => marks.push({ kind, x: Math.round(q.x ?? q.cx * C + C / 2), z: Math.round(q.z ?? q.cz * C + C / 2), sheet: 0, name });   // the sheet bit: 0 on the first cover
  mark("home", ship.home, `${ship.name}'s home`);
  const passed = Rd.legs.slice(0, now.leg + 1);
  for (const l of passed) {
    if (l.to !== ship.home) mark("cove", l.to, `landfall, island ${l.to.island}`);
    if (!R) continue;
    const pts = Array.from({ length: 9 }, (_, i) => { let dx = l.to.cx - l.from.cx; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; return { cx: (l.from.cx + (dx * i) / 8 + W) % W, cz: l.from.cz + ((l.to.cz - l.from.cz) * i) / 8 }; });   // vision: the course sampled in eighths
    for (const w of R.wrecks ?? []) if (pts.some((p) => near(p, w) <= EXPLORE.CHART_REACH)) mark("wreck", w, `wreck: ${w.cause}`);
    for (const h of R.hoards ?? []) if (pts.some((p) => near(p, h) <= EXPLORE.CHART_REACH)) mark("treasure", h, `buried by ${h.band}'s band`);
    for (const r of R.ruins ?? []) { const q = { cx: r.site % W, cz: Math.floor(r.site / W) }; if (near(q, l.to) <= EXPLORE.CHART_REACH) mark("ruin", q, `ruins of ${r.of}`); }
  }
  const seen = new Set();
  return { by: ship.name, round: now.round, marks: marks.filter((m) => { const k = `${m.kind}${Math.round(m.x / 8)},${Math.round(m.z / 8)}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 64) };   // vision: dedupe within 8 blocks; the chart book's 64 marks (charts.js)
}
export { loop };
