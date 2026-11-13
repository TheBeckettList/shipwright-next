// The rings: how much of the world is laid, and how much of it lives, by how near a player is (core/lod.js's levels,
// read for the laying). Rings are Chebyshev distances in chunks from the nearest player, on Fibonacci numbers:
//
//   deep     5   the chunk whole: its rock's beds, ores and caves too (game/strata.js), as far as a player could
//                dig in the time it takes to walk there
//   folk     8   folk stand about here; past folk + 3 they go back into the sim (removed, and brought out again
//                the same when someone comes near: every folk is a record, data/folk.js)
//   surface 13   the surface and life passes: the world as far as a player sees it, towns, trees and all
//   beyond       the pregen tour lays it in the background, a tile at a time, outward from Thera; what lives there
//                is the closed-form sim (the economy, the fleets, the history: world/*.js), stepped by nobody
//
// A chunk's next pass is chosen by its score: its distance times its pass's weight (surface 1, life phi, deep
// phi^2), the least first. So the ground comes before the towns on it, and the towns before what's under them,
// nearest first, and a player walking out sees the world arrive in rings round them.
const PHI = (1 + Math.sqrt(5)) / 2, FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];   // derived: the golden law's own (core/golden.js; here so the rings stand alone)
export const LEVEL = { none: 0, surface: 1, life: 2, deep: 3 };   // a chunk's laying: nothing, its surface, its life, its depth (lay.js marks them)

export const RINGS = { deep: FIB[4], folk: FIB[5], surface: FIB[6], release: FIB[5] + FIB[3] };
export const WEIGHT = { [LEVEL.surface]: 1, [LEVEL.life]: PHI, [LEVEL.deep]: PHI * PHI };
/** The level a chunk at Chebyshev distance d from the nearest player should reach. */
export const targetAt = (d) => (d <= RINGS.deep ? LEVEL.deep : d <= RINGS.surface ? LEVEL.life : LEVEL.none);
/** Chebyshev distance in chunks on the map that wraps east-west. */
export function chunkDist(ax, az, bx, bz, W) { let dx = Math.abs(ax - bx); dx = Math.min(dx, W - dx); return Math.max(dx, Math.abs(az - bz)); }

// ---- the pregen tour: tiles of eight by eight chunks (a ticking area's 64, under the game's 100), in square rings
// out from the centre tile, wrapping east-west; tiles off the map's north and south edges are skipped
export const TILE = FIB[5];
/** The i-th tile of the square spiral round (0, 0), as tile offsets. */
export function spiral(i) {
  if (i === 0) return [0, 0];
  const n = Math.ceil((Math.sqrt(i + 1) - 1) / 2), side = 2 * n, start = (2 * n - 1) ** 2, k = i - start;
  const e = Math.floor(k / side), o = k % side;
  return e === 0 ? [n, -n + 1 + o] : e === 1 ? [n - 1 - o, n] : e === 2 ? [-n, n - 1 - o] : [-n + 1 + o, -n];
}
/** The tour's tile i: its chunk rectangle, or null if it lies off the map. centre: the centre tile's chunk. */
export function tileOf(i, centre, W, H) {
  const [a, b] = spiral(i), cz = centre.cz + b * TILE - TILE / 2;
  if (cz + TILE <= 0 || cz >= H) return null;
  const cx = (((centre.cx + a * TILE - TILE / 2) % W) + W) % W;
  return { cx0: cx, cz0: Math.max(0, cz), cx1: Math.min(W - 1, cx + TILE - 1), cz1: Math.min(H - 1, cz + TILE - 1) };
}
/** Tiles in the tour: enough rings to cover the map from the centre (its width is the longer reach). */
export const tourLength = (W, H) => (2 * Math.ceil(Math.max(W / 2, H) / TILE) + 1) ** 2;

// ---- motion: a player in flight (or under sail) is laid for where they'll be, not where they are
//   lead   the rings are centred LEAD seconds along the player's velocity, so what's ahead comes first and what's
//          behind drops out of the ring (it's laid already, or nobody will see it)
//   fast   past a sprint-jump nobody is on foot (a boat makes eight, a flier eleven to twenty-two): the deep pass
//          waits till they slow (it's the costliest pass, and the skin is all a flier or a sailor sees)
//   ahead  a ticking area of a tile held ahead of a fast player, its centre a surface ring along their heading:
//          the chunks there load, so they can be laid before the player's own view reaches them
export const LEAD = FIB[3];                       // vision: three seconds ahead
export const FAST = 7.127;                        // given: the game's sprint-jump, blocks a second: past it a player is riding, sailing or flying
export const SEEN = FIB[5];                       // vision: the view the probes count holes in (a Switch draws about this far)
/** The chunk the rings centre on: a player at (x, z) blocks moving (vx, vz) blocks a second. */
export const ledChunk = (x, z, vx, vz, C) => ({ cx: Math.floor((x + vx * LEAD) / C), cz: Math.floor((z + vz * LEAD) / C) });
/** The ahead tile (chunk rectangle) of a player moving faster than FAST, or null. */
export function aheadTile(x, z, vx, vz, C, W, H) {
  const v = Math.hypot(vx, vz); if (!(v > FAST)) return null;
  const tx = Math.floor((x + (vx / v) * RINGS.surface * C) / C) - TILE / 2, tz = Math.floor((z + (vz / v) * RINGS.surface * C) / C) - TILE / 2;
  if (tz + TILE <= 0 || tz >= H) return null;
  const cx = ((tx % W) + W) % W;
  return { cx0: cx, cz0: Math.max(0, tz), cx1: Math.min(W - 1, cx + TILE - 1), cz1: Math.min(H - 1, tz + TILE - 1) };
}
/** The target level by distance, for a player who may be fast: d from the led centre, dp from the player. */
export const targetFor = (d, dp, fast) => (dp <= RINGS.deep && !fast ? LEVEL.deep : d <= RINGS.surface || dp <= RINGS.deep ? LEVEL.life : LEVEL.none);
