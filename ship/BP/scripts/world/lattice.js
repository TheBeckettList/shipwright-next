// Pure. The sea world's fields on a coarse lattice. The game runs scripts in an interpreter, where
// the full field math (islands, heat, moisture, biomes) costs about half a millisecond a point; a
// chunk asking it for every column (and the tree margins round it) took half a second. So the math
// runs on a lattice of nodes 4 blocks apart, shared by neighbouring chunks and remembered, and each
// column is blended from the four nodes round it, with a little cheap detail of its own. A chunk
// needs about 16 new nodes, not 740 points.
//
//   node(seed, nx, nz)      -> { H (height over the sea, + land / - depth), h, m, I, special, crater, lagoon, group, shelf, patch }
//   columnAt(seed, x, z)    -> { top, land, depth, h, m, biome, coast, special, crater, lagoon }
import { value2, fbm } from "./noise.js";
import { elevation, place, SEA_LEVEL } from "./terrain.js";
import { landBiome, seaBiome } from "./biomes.js";

export const STEP = 4;

let nodes = new Map(), nodeSeed = null;
/** A lattice node: the full field math at one point (remembered). */
export function node(seed, nx, nz) {
  if (seed !== nodeSeed) { nodes = new Map(); nodeSeed = seed; }
  const k = nx * 4194304 + nz;
  let n = nodes.get(k);
  if (n) return n;
  const x = nx * STEP, z = nz * STEP;
  const e = elevation(seed, x, z);
  const p = place(seed, x, z, e);
  n = {
    H: e.land ? e.top - SEA_LEVEL : -e.depth,
    h: p.h, m: p.m, I: e.I ?? 0, special: e.special ?? null, crater: !!e.crater, lagoon: !!e.lagoon, group: e.group ?? null, shelf: e.shelf ?? 0,
    patch: fbm(x / 160, z / 160, seed + 261, 2),
  };
  nodes.set(k, n);
  if (nodes.size > 60000) nodes.delete(nodes.keys().next().value);
  return n;
}

/** A chunk's 5 x 5 nodes worked out a row at a time (a cold row near a great island is the field math five times). */
export function* warmNodes(seed, cx, cz) {
  const n0x = (cx * 16) / STEP, n0z = (cz * 16) / STEP;
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) node(seed, n0x + i, n0z + j);
    yield;
  }
}

/** Whether a chunk lies in open ocean: every node round it deep water, no island within reach. */
export function openOcean(seed, cx, cz) {
  const n0x = Math.floor((cx * 16) / STEP), n0z = Math.floor((cz * 16) / STEP);
  for (let i = -1; i <= 5; i += 2) for (let j = -1; j <= 5; j += 2) {
    const n = node(seed, n0x + i, n0z + j);
    if (n.H > -8 || n.I > 0 || n.special) return false;
  }
  return true;
}

const lerp = (a, b, t) => a + (b - a) * t;

/** A column, blended from the lattice: its ground, heat, moisture and biome. */
export function columnAt(seed, x, z) {
  const fx = x / STEP, fz = z / STEP, nx = Math.floor(fx), nz = Math.floor(fz);
  return blend(seed, x, z, node(seed, nx, nz), node(seed, nx + 1, nz), node(seed, nx, nz + 1), node(seed, nx + 1, nz + 1), fx - nx, fz - nz);
}

/**
 * A whole chunk's columns from one grid of its 5 x 5 nodes (each column blends the four round it):
 * the same answer as columnAt for every column, with the node lookups done once, not 1,024 times.
 */
export function chunkColumns(seed, cx, cz) {
  const n0x = (cx * 16) / STEP, n0z = (cz * 16) / STEP;           // STEP divides 16: nodes line up with chunks
  const N = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) N.push(node(seed, n0x + i, n0z + j));
  const out = new Array(256);
  for (let lx = 0; lx < 16; lx++) {
    const i = lx >> 2, tx = (lx & 3) / STEP;
    for (let lz = 0; lz < 16; lz++) {
      const j = lz >> 2, tz = (lz & 3) / STEP;
      out[lx * 16 + lz] = blend(seed, cx * 16 + lx, cz * 16 + lz, N[i * 5 + j], N[(i + 1) * 5 + j], N[i * 5 + j + 1], N[(i + 1) * 5 + j + 1], tx, tz);
    }
  }
  return out;
}

function blend(seed, x, z, a, b, c, d, tx, tz) {
  const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
  const near = tx < 0.5 ? (tz < 0.5 ? a : c) : tz < 0.5 ? b : d;
  let H = a.H * w00 + b.H * w10 + c.H * w01 + d.H * w11;
  H += (value2(x / 5, z / 5, seed + 271) - 0.5) * (Math.abs(H) < 6 ? 2.2 : 1.2);
  const h = a.h * w00 + b.h * w10 + c.h * w01 + d.h * w11;
  const m = a.m * w00 + b.m * w10 + c.m * w01 + d.m * w11;
  const I = a.I * w00 + b.I * w10 + c.I * w01 + d.I * w11;
  if (H >= 0.5) {
    const top = SEA_LEVEL + Math.max(1, Math.round(H));
    const coast = top <= SEA_LEVEL + 2;
    const special = a.special === b.special && b.special === c.special && c.special === d.special ? near.special : near.special && H > 3 ? near.special : null;
    const patch = a.patch * w00 + b.patch * w10 + c.patch * w01 + d.patch * w11;
    return { x, z, top, land: true, depth: 0, h, m, biome: landBiome(h, m, top - SEA_LEVEL, coast, special, patch), coast, special, crater: near.crater && a.crater && d.crater, lagoon: false, group: near.group, I };
  }
  const depth = Math.max(1, Math.round(-H));
  const shelf = a.shelf * w00 + b.shelf * w10 + c.shelf * w01 + d.shelf * w11;
  return { x, z, top: SEA_LEVEL - depth, land: false, depth, h, m, biome: seaBiome(h, depth, near.lagoon, x, z, seed), coast: false, special: near.special, crater: false, lagoon: near.lagoon, group: near.group, I, shelf };
}
