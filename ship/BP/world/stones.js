// Pure. The stepping stones, at block scale: the islets that keep a small boat's crossings to VISION.CROSSING (320 blocks)
// on its route round the world, hidden among decoys (tools/makestones.mjs lays them; world/stones.json keeps them).
//
//   a stone   { x, z (its middle, blocks), r (its radius), h (its top over the sea), kind, s (its shape's key) }; its
//             outline wanders (a gradient noise on the bearing), so no two are alike and none is round
//   the shoal round it: the sea floor rises toward each stone over twice its radius and 21 blocks, so the water
//             shoals and pales before a stone comes in sight, as round a real islet
//   kinds     sand cay, atoll (a ring round a lagoon), reef flat (awash), skerry, sea stack, volcanic islet, mangrove
//             islet, ice floe: by the stone's climate and its draw (tools/makestones.mjs)
import { D } from "../core/given.js";
import { FIB, PHI } from "../core/golden.js";
import { gnoise } from "../core/noise.js";

export const STONE = Object.freeze({
  SHOAL: FIB[7],                               // vision: the shoal reaches 21 blocks past twice the stone's radius
  SHOAL_TOP: -2,                               // vision: the shoal two blocks under the sea at the stone's foot
  WOBBLE: 1 / PHI ** 2,                        // derived: the outline wanders up to a golden square of its radius
});
let byCell = new Map(), list = [];
/** Use a list of stones (world/stones.json, or the game's baked copy). */
export function useStones(stones = []) {
  list = stones; byCell = new Map();
  for (const s of stones) {
    const reach = 2 * s.r + STONE.SHOAL, c0 = Math.floor((s.x - reach) / D.PX), c1 = Math.floor((s.x + reach) / D.PX), r0 = Math.floor((s.z - reach) / D.PX), r1 = Math.floor((s.z + reach) / D.PX);
    for (let i = c0; i <= c1; i++) for (let j = r0; j <= r1; j++) { const k = `${i},${j}`; (byCell.get(k) ?? byCell.set(k, []).get(k)).push(s); }
  }
}
export const stones = () => list;
/** The ground a stone makes at block (x, z), as a height over the sea (land or the shoal), or null where no stone reaches. */
export function stoneAt(x, z) {
  const near = byCell.get(`${Math.floor(x / D.PX)},${Math.floor(z / D.PX)}`); if (!near) return null;
  let best = null;
  for (const s of near) {
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
    const R = s.r * (1 + STONE.WOBBLE * gnoise(Math.cos(a) * PHI + s.s, Math.sin(a) * PHI - s.s, 461));   // vision: the outline's key
    let h;
    if (d <= R) {
      const t = d / R;
      if (s.kind === "atoll") h = t > 1 / PHI ? s.h * (1 - (t - 1 / PHI) * PHI) + 1 : -FIB[3];   // derived: a ring the outer golden share wide, its lagoon three deep
      else if (s.kind === "reef flat") h = 0;
      else if (s.kind === "sea stack") h = t < 1 / PHI ? s.h : s.h * (1 - t) * PHI ** 2;   // derived: sheer to a golden share out, then a skirt
      else h = Math.max(1, s.h * (1 - t * t));   // a low dome
    } else {
      const reach = R + R + STONE.SHOAL; if (d > reach) continue;
      h = STONE.SHOAL_TOP - (Math.abs(STONE.SHOAL_TOP) + FIB[6]) * ((d - R) / (reach - R));   // derived: the shoal falls from two under to fifteen under across its reach
    }
    if (best === null || h > best) best = h;
  }
  return best;
}
