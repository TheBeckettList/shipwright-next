// Pure. The homeports the League charts for joining players (tools/makehomeports.mjs lays them; world/homeports.json keeps
// them): where each stands, its pad levelled into the ground round it, and its lode under the pad.
//   the pad     an 89-block pad at its spot's own height, the ground blended toward it over 233 blocks (the blend falls by
//               a smoothstep, and the land's fine grain stays over it, so the shaping reads as a lucky flat by a bay)
//   the lode    652 ore blocks of all eight kinds in Fibonacci counts, in a body 34 blocks across from y -21 to under the
//               soil: about twice what the same ground holds elsewhere, and all eight kinds
import { FIB, FIBS, PHI } from "../core/golden.js";
import { D } from "../core/given.js";

export const HOME = Object.freeze({
  COUNT: FIB[6],                               // vision: thirteen homeports charted ahead
  TURN: 2 * Math.PI / PHI ** 2,                // given: the golden angle (a turn over phi squared)
  NEAR: FIBS[17], FAR: FIBS[20] + FIBS[19],     // vision: 2,584 to 17,711 blocks from Thera (the near ring's sea is wide)
  SPREAD: Math.PI / FIB[6],                    // vision: the search either side of the bearing (about 14 degrees)
  FROM_TOWNS: FIBS[14], FROM_HOMES: FIBS[16], FROM_STONES: FIBS[12],   // vision: 610 from a town's footprint, 1,597 from the next homeport, 233 from a route stone
  ISLE: [FIBS[14], FIBS[16]],                  // vision: an island 610 to 1,597 blocks across
  T: [9, 27], M: [0.4, 0.89],                  // vision: the climate (degrees C; the wet): timber, crops, fresh water (Thera's latitude runs warm)
  PAD: FIB[10], BLEND: FIBS[12],               // vision: the pad 89 blocks across, the ground blended to it over 233
  LODE: [["minecraft:coal_ore", FIBS[12]], ["minecraft:iron_ore", FIBS[11]], ["minecraft:copper_ore", FIBS[11]], ["minecraft:redstone_ore", FIB[9]], ["minecraft:gold_ore", FIB[8]], ["minecraft:lapis_ore", FIB[7]], ["minecraft:diamond_ore", FIB[6]], ["minecraft:emerald_ore", FIB[5]]],   // derived: Fibonacci counts, 652 in all
  LODE_ACROSS: FIB[8], LODE_FLOOR: -FIB[7],    // vision: the body 34 blocks across, from y -21
});
let list = [], lodeAt = new Map();
/** Use the homeports (world/homeports.json, or the game's baked copy). */
export function useHomeports(h = []) { list = h; lodeAt = new Map(); for (const p of h) for (const [x, y, z, id] of p.lode) { const k = `${x},${z}`; (lodeAt.get(k) ?? lodeAt.set(k, []).get(k)).push([y, id]); } }
export const homeports = () => list;
const ss = (t) => { const q = Math.max(0, Math.min(1, t)); return q * q * (3 - 2 * q); };   // given: smoothstep
/** The ground at (x, z) with the homeports' pads blended in: h (blocks over the sea, the land's own) to the shaped height. */
export function shapeHome(x, z, h) {
  if (h <= 0 || !list.length) return h;
  for (const p of list) {
    const d = Math.hypot(x - p.x, z - p.z); if (d > HOME.PAD / 2 + HOME.BLEND) continue;
    const w = (1 - ss((d - HOME.PAD / 2) / HOME.BLEND)) * (1 - 1 / PHI ** 4);   // derived: the ground kept a golden fourth power of its own grain over the pad
    return Math.max(1, h + w * (p.pad - h));
  }
  return h;
}
/** A column's lode blocks, [[y, id], ...], or none. */
export const lodeOf = (x, z) => lodeAt.get(`${x},${z}`) ?? null;
