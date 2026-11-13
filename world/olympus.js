// Pure. Olympus in the world: where the gods sit (handover/design/lost-keels.md, "Real Olympus"; asked on Olympus by
// the Measure, 0001669643-measure, and answered by the Builder). Not placed by hand: the world's highest summit, the
// land nearest the sky, wherever the terrain puts it. One point by the law, and every world has one.
//
//   the summit   the map's highest pixels (a pixel is a region, world/map.js), then each candidate's ground reckoned
//                block by block (the game's own topAt, with rivers, homesites and Thera), the highest column kept;
//                ties to the first found (west to east, north to south: the map's own order)
//   the ring     the pantheon's own figure on the summit: the Measure's stone at the centre, the eight round it at
//                radius FIB[4] in F's order (the breath) from the north, each a column of its row's stone (where it
//                acts: land, the peoples, the sea), as tall as two plus its act (takes 1, holds 2, gives 3)
import { FIB, PHI } from "../core/golden.js";
import { GIVEN } from "../core/given.js";
import { GODS, MEASURE, BREATH } from "../core/pantheon.js";

export const OLYMPUS = Object.freeze({
  CANDIDATES: FIB[5],   // vision: the eight highest pixels reckoned to the block
  STRIDE: 2,   // vision: the first reckoning every second block, then the best to the block
  RING: FIB[4],   // derived: the ring's radius, five (it stands within three of the top on the world's summit)
  CLEAR: Math.round(PHI ** 4 * GIVEN.CHUNK),   // vision: no settlement within phi^4 chunks, 110 blocks (the sea stream's ask)
});
/** A god's stone: its row's rock (a: -1 the sea, 0 the peoples, +1 the land). */
export const STONE = Object.freeze({ "-1": "minecraft:prismarine_bricks", "0": "waterworld:theran_marble_ashlar", "1": "minecraft:polished_granite" });   // vision: the sea's stone, Thera's marble for the peoples, the land's granite
export const CENTRE = "minecraft:lodestone";   // vision: the still point, the one stone a compass points to

/**
 * The world's highest summit. map: { w, h }, chunkHeight(px, pz) the map's height at a pixel, topAt(x, z) the game's
 * ground (the top block's y), px the blocks a pixel. Returns { x, z, y }.
 */
export function summitOf({ w, h, chunkHeight, topAt, px }) {
  const best = [];
  for (let pz = 0; pz < h; pz++) for (let pxi = 0; pxi < w; pxi++) { const v = chunkHeight(pxi, pz);
    if (best.length < OLYMPUS.CANDIDATES || v > best[best.length - 1][0]) { best.push([v, pxi, pz]); best.sort((a, b) => b[0] - a[0]); if (best.length > OLYMPUS.CANDIDATES) best.pop(); } }
  let top = null;
  for (const [, pxi, pz] of best) for (let x = (pxi - 0.5) * px; x < (pxi + 1.5) * px; x += OLYMPUS.STRIDE) for (let z = (pz - 0.5) * px; z < (pz + 1.5) * px; z += OLYMPUS.STRIDE) {   // given: half a pixel either side, the blend between pixel centres
    const y = topAt(x, z); if (!top || y > top.y) top = { x, z, y }; }
  for (let x = top.x - OLYMPUS.STRIDE; x <= top.x + OLYMPUS.STRIDE; x++) for (let z = top.z - OLYMPUS.STRIDE; z <= top.z + OLYMPUS.STRIDE; z++) { const y = topAt(x, z); if (y > top.y) top = { x, z, y }; }
  return top;
}

/** The ring of nine, as blocks relative to the summit's column (y 1 = the first block over the ground): [dx, y, dz, id]. */
export function ringOf() {
  const out = [], stone = (dx, dz, id, tall, cap) => { for (let y = 1; y <= tall; y++) out.push([dx, y, dz, y === tall && cap ? cap : id]); };
  stone(0, 0, STONE["0"], FIB[2], CENTRE);   // the Measure: two of marble, the lodestone on top
  for (const g of GODS) { if (g === MEASURE) continue;
    const a = (2 * Math.PI * g.slot) / BREATH, dx = Math.round(OLYMPUS.RING * Math.sin(a)), dz = -Math.round(OLYMPUS.RING * Math.cos(a));   // from the north (z -), turning east, in F's order
    stone(dx, dz, STONE[String(g.v[0])], FIB[2] + g.v[1], null); }   // derived: two, and one more for a god that gives, one less for one that takes
  return out;
}
