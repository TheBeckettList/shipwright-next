// Pure. Near and far: the world is the math everywhere, and only rendered where someone is.
//
// Every system says what it needs at each distance (in chunks, the nearest player's):
//
//   level 0  rendered  d <= NEAR          blocks laid, every law every tick (boats, waves felt, crew)
//   level 1  edge      d = NEAR + 1       the n + 1 ring: block math ready (columns worked out,
//                                         entities staged), nothing placed; on the breath beat (8)
//   level 2  chunk     d <= FAR           chunk-pixel laws only (a chunk's tide, its people's work, a
//                                         ship as a point); on the second beat (20)
//   level 3  abstract  beyond             nothing runs. Everything there is a closed form of the tick:
//                                         tide, wind, gusts, waves are functions of (place, t); a ship
//                                         on a voyage is (route, phase): where it is at t is s0 + v t
//                                         along the route; a people's day is t mod DAY. Asked, the
//                                         math answers for any t at once: a jump, not a replay.
//
// That's the compression trick from Seedworld: a periodic or closed-form system needs no stepping
// to know its state at any tick (the line's state at t is its breath table at t mod 2L), so the far
// world costs nothing until it's looked at, and then it's exactly what it would have been. When a
// player comes within reach, a chunk is promoted level by level: its state is read from the closed
// form at the current tick, and from then on stepped. The analogue lens checks that promotion
// changes nothing (the stepped and the closed-form state agree at the handover).
import { VISION } from "./given.js";
import { pisano } from "./field.js";

export const NEAR = VISION.LOD.NEAR, FAR = VISION.LOD.FAR;
export const LEVELS = Object.freeze([
  { level: 0, name: "rendered", beat: 1 },
  { level: 1, name: "edge", beat: pisano(3) },          // derived: 8 ticks, the trit breath
  { level: 2, name: "chunk", beat: pisano(5) },         // derived: 20 ticks, a second
  { level: 3, name: "abstract", beat: Infinity },       // derived: closed form, asked and never stepped
]);
/** Chebyshev distance in chunks on the wrapped map. */
export function chunkDist(a, b, W) {
  let dx = Math.abs(a.cx - b.cx); dx = Math.min(dx, W - dx);
  return Math.max(dx, Math.abs(a.cz - b.cz));
}
/** The level a chunk is at, given every player's chunk. */
export function levelOf(chunk, players, W) {
  const d = Math.min(...players.map((p) => chunkDist(chunk, p, W)));
  return d <= NEAR ? 0 : d === NEAR + 1 ? 1 : d <= FAR ? 2 : 3;   // given: the four levels
}
/** Does a system at this level run on tick t? (phase spreads systems across the beat, tempo.js) */
export const due = (level, t, phase = 0) => { const b = LEVELS[level].beat; return Number.isFinite(b) && (t - phase) % b === 0; };
/** Chunks at each level round one player (the load the device carries). */
export function census() {
  const ring = (r) => (2 * r + 1) ** 2;
  return { rendered: ring(NEAR), edge: ring(NEAR + 1) - ring(NEAR), chunk: ring(FAR) - ring(NEAR + 1) };
}
/** Work a tick at each level, in chunk-steps (a level's chunks over its beat): the cost of the scheme. */
export function load() {
  const c = census();
  return { rendered: c.rendered, edge: c.edge / LEVELS[1].beat, chunk: c.chunk / LEVELS[2].beat, total: c.rendered + c.edge / LEVELS[1].beat + c.chunk / LEVELS[2].beat };
}
