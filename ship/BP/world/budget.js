// Pure. The compute budget: what the world costs a tick on the device, steady and in the worst case
// a crowd of players can throw at it, and what's left to fill with life.
//
// Device givens are the old mod's probe defaults for a Switch (its world/limits.js DEFAULT_MEASURED):
// the slice of a tick the game gives scripts, and the native costs of reading and writing blocks.
// The lab's timings run on V8; the game runs QuickJS, about QJS times slower (the old lab's reading).
//
//   steady     the record (a day's step, spread over the day), the month's re-bake (sliced as a job
//              over the month), each player's own boat in the sea (every tick)
//   frontier   a ship sailing flat out uncovers chunks to lay (the old frontier law): sea chunks are
//              a few fills, land chunks a fill a column and some decoration
//   worst      PLAYERS at once, each flat out, each fighting (shots in flight), each blasting a chain
//              of TNT (the game changes the blocks; our work is to pin each in the overlay at once, so
//              the math never re-bakes over what a player changed, and to book it on its people's
//              ledger, which can wait for the beat)
//   shedding   in a crowd: shots past SHOT_CAP a player are resolved every other tick, and bookings
//              are spread over the beat: what must be now, now; what can wait, on the beat
//   life       what's left of the steady budget after the worst case's reserve: the ambient life's
//              share, given only to the quiet ticks (tempo.js fillGaps)
import { RUNGS } from "../core/clock.js";
const RUNG_BEAT = RUNGS.beat;
export const DEVICE = Object.freeze({
  SLICE: 10, SPIKE: 100,                    // given: ms a tick the game gives scripts; ms over which it warns
  FILL_CALL: 0.02, FILL_BLOCK: 0.00002, SET: 0.008, GET: 0.002,   // given: native costs, ms (the old probe's Switch defaults)
  LOADED: 6,                                // given: chunks loaded round a player (the old probe's default)
  QJS: 45,                                  // given: QuickJS against V8 (the old lab's reading)
});
export const LOAD = Object.freeze({
  STEADY: 0.3,            // vision: share of the slice the world may use steadily (the old budgets)
  SPEED: 0.42,            // vision: a ship flat out (blocks a tick, the old V_FULL)
  LAND: 0.12,             // derived elsewhere (the world lens): the share of land a ship crosses, on average
  SEA_CHUNK: { fills: 3, blocks: 16 * 16 * 70 },    // vision: bed, sand, water: three fills of a chunk's columns 70 deep
  LAND_CHUNK: { fills: 256, sets: 60 },             // vision: a fill a column, and decoration
  PLAYERS: 8,             // vision: a small server's crowd, all at once
  SHOTS: 30,              // vision: projectiles a fighting player keeps in flight
  SHOT_MS: 0.004,         // vision: our script's work a shot a tick (V8 ms)
  TNT: 240,               // vision: blocks a player's TNT chain changes a tick (four blasts): the game changes them; we pin and book
  PIN_MS: 0.0001,         // vision: our script's work to pin a changed block in the overlay (now: the math must never overwrite it) (V8 ms)
  BOOK_MS: 0.0004,        // vision: our script's work to book a changed block on its people's ledger (deferrable: batched to the beat) (V8 ms)
  SHOT_CAP: 10,           // vision: shots a player's fight resolves every tick; the rest every other tick (shed in a crowd)
  BOATS: 2,               // vision: boats near each player that feel the sea (its own and one met)
});

/** The budget from the lab's timings (V8 ms): { recordDay, monthBake, boatStep, lifeAsk }. */
export function budget(t, { dayTicks, monthTicks }) {
  const D = DEVICE, Q = D.QJS, Lo = LOAD;
  const ms = (v8) => v8 * Q;
  const steady = {
    "record (a day's step)": ms(t.recordDay) / dayTicks,
    "month's re-bake (sliced)": ms(t.monthBake) / monthTicks,
  };
  const perPlayer = {
    "its boats in the sea": ms(t.boatStep) * Lo.BOATS,
  };
  const chunksPerTick = (Lo.SPEED * (2 * D.LOADED + 1)) / 16;   // given: the frontier law (chunks a tick uncovered at speed)
  const sea = Lo.SEA_CHUNK.fills * D.FILL_CALL + Lo.SEA_CHUNK.blocks * D.FILL_BLOCK, land = Lo.LAND_CHUNK.fills * D.FILL_CALL + Lo.LAND_CHUNK.sets * D.SET;
  perPlayer["laying chunks, flat out"] = chunksPerTick * ((1 - Lo.LAND) * sea + Lo.LAND * land);
  const worstPer = { ...perPlayer, "fighting (shots in flight)": ms(Lo.SHOTS * Lo.SHOT_MS), "a TNT chain (pinned now)": Lo.TNT * ms(Lo.PIN_MS) };
  const deferred = { "a TNT chain's booking (batched to the beat)": (Lo.TNT * ms(Lo.BOOK_MS)) };
  // shedding in a crowd: shots past SHOT_CAP every other tick; bookings spread over the beat
  const shedPer = { ...worstPer, "fighting (shots in flight)": ms((Lo.SHOT_CAP + (Lo.SHOTS - Lo.SHOT_CAP) / 2) * Lo.SHOT_MS), "a TNT chain's booking, spread": deferred["a TNT chain's booking (batched to the beat)"] / RUNG_BEAT };
  const sumv = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const steadyMs = sumv(steady), oneMs = sumv(perPlayer), worstMs = (sumv(worstPer) + sumv(deferred)) * Lo.PLAYERS, shedMs = sumv(shedPer) * Lo.PLAYERS;
  const allowance = D.SLICE * Lo.STEADY;
  return {
    steady, perPlayer, worstPer, deferred, shedPer, steadyMs, onePlayerMs: steadyMs + oneMs, worstMs: steadyMs + worstMs, shedMs: steadyMs + shedMs,
    allowance, slice: D.SLICE, life: Math.max(0, allowance - steadyMs - oneMs),
    worstFits: steadyMs + worstMs <= D.SLICE, shedFits: steadyMs + shedMs <= D.SLICE, worstOverSpike: steadyMs + worstMs > D.SPIKE,
  };
}
