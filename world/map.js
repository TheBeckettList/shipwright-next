// The world map: one pixel a chunk, 2,048 x 1,024, grayscale. It is the world (static, painted, not
// seeded). The legend, for anyone painting it:
//   0 .. 99     sea, depth (100 - value) blocks below the sea's level (99: one block deep)
//   100 .. 255  land, height (value - 99) blocks above it (100: one block, a beach or a flat)
//
// Three scales read it: a block asks its chunk's pixel (blended between pixel centres, so coasts are
// smooth); a chunk is a pixel; the world is the whole image (region views downsample it). The
// analogue lens (tools/lab.mjs analogues) holds the three to the same land share and coast.
import { GIVEN, D, VISION } from "../core/given.js";
import { mod } from "../core/fixed.js";
import { PHI, FIB, FIBS, golden } from "../core/golden.js";
import { vnoise, gnoise } from "../core/noise.js";

export const MAP = Object.freeze({
  COAST: 100,                                  // vision: the legend's sea/land line
  DEPTH_MAX: 99, LAND_MAX: 155,                // derived: what a byte holds either side of it
  encodeSea: (depth) => 100 - Math.max(1, Math.min(99, depth)),     // vision: the legend
  encodeLand: (h) => 99 + Math.max(1, Math.min(155, h)),            // vision: the legend
});
/** A pixel's height over the sea's level (blocks; negative: depth). */
export const heightOf = (v) => (v >= MAP.COAST ? v - (MAP.COAST - 1) : v - MAP.COAST);

let current = null, islets = new Map(), insets = [];
/** Places drawn by their own math, laid over the map (Thera): functions (cx, cz, W) -> height or null. */
export function useInsets(list = []) { insets = list; theraCache = new Map(); }
let theraCache = new Map();
/** The stepping-stone cays (world/islets.json): [{ cx, cz, h }], laid over the map. Static, hand-editable. */
export function useIslets(list = []) { islets = new Map(list.map((c) => [`${c.cx},${c.cz}`, c.h])); }
/** Use a decoded map: { w, h, data } (tools load it from world/map.png; the game will load it baked). */
export function useMap(m) {
  if (m.w !== D.CELLS_W || m.h !== D.CELLS_H) throw new Error(`map is ${m.w} x ${m.h}, the world is ${D.CELLS_W} x ${D.CELLS_H} chunks`);
  current = m;
  return m;
}
export const map = () => { if (!current) throw new Error("no map loaded (world/load.js loadMap)"); return current; };

/** The chunk's height (blocks over the sea; negative: depth). Wraps east-west, folds at the poles. */
export function chunkHeight(cx, cz) {
  const m = map();
  let x = mod(cx, m.w), z = cz;
  if (z < 0) { z = -1 - z; x = mod(x + m.w / 2, m.w); }
  if (z >= m.h) { z = 2 * m.h - 1 - z; x = mod(x + m.w / 2, m.w); }
  const key = z * m.w + x;
  if (insets.length) {
    let v = theraCache.get(key);
    if (v === undefined) { v = null; const base = cay0(x, z) ?? heightOf(m.data[key]); for (const f of insets) { const h = f(x, z, m.w, base); if (h !== null) { v = h; break; } } theraCache.set(key, v); }
    if (v !== null) return v;
  }
  return cay0(x, z) ?? heightOf(m.data[key]);
}
const cay0 = (x, z) => islets.get(`${x},${z}`);
/** The map's own height at a chunk, under any inset (the painted map and its cays only). */
export function baseChunkHeight(cx, cz) {
  const m = map();
  let x = mod(cx, m.w), z = cz;
  if (z < 0) { z = -1 - z; x = mod(x + m.w / 2, m.w); }
  if (z >= m.h) { z = 2 * m.h - 1 - z; x = mod(x + m.w / 2, m.w); }
  return cay0(x, z) ?? heightOf(m.data[z * m.w + x]);
}
/** A block's height, blended linearly between the four chunk centres round it (the coast's own line). */
const linearOf = (ch) => (x, z) => {
  const C = D.PX, fx = x / C - 0.5, fz = z / C - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = ch(i, j), b = ch(i + 1, j), c = ch(i, j + 1), d = ch(i + 1, j + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};
export const linearHeight = linearOf(chunkHeight);
// The land between: a linear blend creases at every chunk centre, and contours of it step on the chunk's
// period (the "stepped wave" a slope of sand shows). Inland, the height is a Catmull-Rom spline through
// the sixteen centres round the block (it still passes through every pixel's own height, so the map
// still means what it says), with a block or so of the ground's own grain over it. The coast keeps the
// linear line: the spline can overshoot, and the sea's edge is the map's.
const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * (p1 - p2) + p3 - p0) * t * t * t);   // given: the Catmull-Rom spline
export const LAND_SPLINE = Object.freeze({
  FROM: 1 / 2, TO: FIB[3],                     // derived: from where a column rounds to land (half a block) to all of it by 3 blocks
});
// The relief: the land between the map's region centres, an octave sum of Fibonacci wavelengths (1,597 down to 13
// blocks, a golden square apart, each 1/phi the last's strength: near real ground's spectrum), scaled by the land's own
// height and its region's character, and none of it at the waterline (the map's coast stays the coast). Under the sea
// the same, quieter and growing with depth, and quieter still on the shelf.
export const RELIEF = Object.freeze({
  WAVES: [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6].map((k) => FIBS[k]),   // derived: every Fibonacci wavelength from 1,597 down to 13 blocks (a golden step apart: no one wave's spacing shows)
  BASE: FIB[6],                                // vision: thirteen blocks of relief on the lowest land (times its region's character)
  COAST: [1 / 2, FIB[3], FIB[5]],              // vision: from the waterline, the rises in full three blocks up and the hollows eight (a hollow never drowns the shore)
  CHAR: [1 / PHI ** 2, 1 / PHI, 1, PHI],       // derived: plain, rolling, hills, rugged
  RIDGED: 4,                                   // derived: the rugged ground's crests on its four longest waves (down to 610 blocks)
  TOP: GIVEN.YMAX - GIVEN.SEA - 1,             // given: the build limit, a block under it
  SHELF_DAMP: 1 / FIB[4],                      // vision: the shelf a fifth as rough
  COASTLINE: [FIBS[12], FIB[9]],               // vision: the coast wanders up to 55 blocks either way, over 233
});
const CHAR_STEP = FIB[10], CHAR_SIZE = FIBS[17];   // vision: every 89 blocks of the map's height a character rougher; characters in country about 2,584 blocks across
/** The ground's character at a block, as a place on the scale plain, rolling, hills, rugged (from the first to the last): a slow field, rougher with height. */
const charAt = (x, z, B) => Math.max(0, Math.min(RELIEF.CHAR.length - 1, (RELIEF.CHAR.length - 1) * (0.5 + gnoise(x / CHAR_SIZE, z / CHAR_SIZE, 491) / 2) + Math.max(0, B) / CHAR_STEP));   // derived: the field's middle at rolling-to-hills
const AMP = (k) => PHI ** (-k / 2), W_SUM = RELIEF.WAVES.reduce((a, _, k) => a + AMP(k), 0);   // derived: each wave the root of phi weaker than the last (the same falloff as 1/phi a golden square)
const TURN = Math.PI * (3 - Math.sqrt(5));   // given: the golden angle (each wave turned by it, so no grid lines up)
/** The relief's shape at a block, -1 .. 1: the octaves summed and normalised, the longest two ridged as far as the ground is rugged. */
function waves(x0, z0, ridge) {
  const Wp = FIBS[15], Wa = FIBS[11], x = x0 + Wa * gnoise(x0 / Wp, z0 / Wp, 497), z = z0 + Wa * gnoise(x0 / Wp + PHI, z0 / Wp - PHI, 499);   // derived: the ground warped by up to 144 blocks over 987, so no wave keeps its spacing (and none is combed)
  let s = 0;
  RELIEF.WAVES.forEach((L, k) => { const ca = Math.cos(k * TURN), sa = Math.sin(k * TURN); let n = Math.max(-1, Math.min(1, gnoise((x * ca - z * sa) / L + k * PHI, (x * sa + z * ca) / L - k * PHI, 500 + k))); if (k < RELIEF.RIDGED && ridge > 0) n = (1 - ridge) * n + ridge * (1 - 2 * Math.abs(n)); s += n * AMP(k); });   // vision: the waves' keys
  return s / W_SUM;
}
// The map's pixels each carry their own height, drawn noisy at the pixel; a region a pixel, that noise would stand as a
// lattice of hills 128 blocks apart. The land's spline runs through the map smoothed by a binomial 5 x 5 (its pixel-scale
// noise gone, its ranges and basins kept); the coast keeps the map's own line.
const KERNEL = [1, 4, 6, 4, 1];   // given: the binomial row (its sum 16)
const smoothOf = (ch) => { let A = null; return (i, j) => {
  if (!A) A = new Float32Array(D.CELLS_W * D.CELLS_H).fill(NaN);
  const ii = mod(i, D.CELLS_W), jj = Math.max(0, Math.min(D.CELLS_H - 1, j)), k = jj * D.CELLS_W + ii;
  if (Number.isNaN(A[k])) { let s = 0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) s += KERNEL[a + 2] * KERNEL[b + 2] * ch(i + a, j + b); A[k] = s / 256; }   // given: the kernel's reach and its sum squared
  return A[k];
}; };
const splineOf = (ch0) => { const linear = linearOf(ch0), ch = smoothOf(ch0); return (x, z) => {
  const cw = RELIEF.COASTLINE, lin = linear(x + cw[1] * gnoise(x / cw[0], z / cw[0], 487) + (cw[1] / PHI) * gnoise(x / (cw[0] / PHI ** 2), z / (cw[0] / PHI ** 2), 489), z + cw[1] * gnoise(x / cw[0] + PHI, z / cw[0] - PHI, 491) + (cw[1] / PHI) * gnoise(x / (cw[0] / PHI ** 2) - PHI, z / (cw[0] / PHI ** 2) + PHI, 493));   // derived: the coast's line read through a warp (two waves a golden square apart), so the map's cells don't show as a staircase
  const C = D.PX, fx = x / C - 0.5, fz = z / C - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const t = charAt(x, z, lin), k0 = Math.min(RELIEF.CHAR.length - 2, Math.floor(t)), c = RELIEF.CHAR[k0] + (RELIEF.CHAR[k0 + 1] - RELIEF.CHAR[k0]) * (t - k0), ridge = sstep(t - (RELIEF.CHAR.length - 2));   // the character between its two nearest; rugged ground ridged as far as it is rugged
  if (lin <= LAND_SPLINE.FROM) {   // the coast's line, and the sea floor under it
    if (lin >= -1) return lin;
    const d = -lin, amp = (d / PHI ** 3) * c   // derived: the floor's relief a golden cube of its depth
       * (d < VISION.SHELF_DEPTH ? RELIEF.SHELF_DAMP : 1);
    return Math.min(-1, lin + amp * waves(x, z, 0));   // the sea stays sea
  }
  const row = (dj) => cr(ch(i - 1, j + dj), ch(i, j + dj), ch(i + 1, j + dj), ch(i + 2, j + dj), u);
  const cub = cr(row(-1), row(0), row(1), row(2), v);
  const w = sstep((Math.min(lin, cub) - LAND_SPLINE.FROM) / (LAND_SPLINE.TO - LAND_SPLINE.FROM));
  const B = lin + (cub - lin) * w, up = sstep((B - RELIEF.COAST[0]) / (RELIEF.COAST[1] - RELIEF.COAST[0])), down = sstep((B - RELIEF.COAST[0]) / (RELIEF.COAST[2] - RELIEF.COAST[0]));
  const rho = (RELIEF.BASE + Math.max(0, B) / PHI) * c, s = waves(x, z, ridge) + (c - 1) / PHI;   // derived: rough regions stand higher (their character over one, a golden share up), smooth ones lower
  return Math.min(RELIEF.TOP, Math.max(LAND_SPLINE.FROM, B + rho * s * (s > 0 ? up : down)));   // land stays land: the map's coast is the coast
}; };
/** A block's height (blocks over the sea, a float): the coast linear, the land a spline with its grain. */
export const blockHeight = splineOf(chunkHeight);
/** The same on the map's own ground, under any inset (where Thera's island isn't, it is blockHeight). */
export const baseBlockHeight = splineOf(baseChunkHeight);
const sstep = (t) => { const s = Math.max(0, Math.min(1, t)); return s * s * (3 - 2 * s); };   // given: smoothstep
/** The block column's top: the sea's level plus the height (rounded, as blocks are). */
export const blockTop = (x, z) => GIVEN.SEA + Math.round(blockHeight(x, z));
export const isLandChunk = (cx, cz) => chunkHeight(cx, cz) > 0;
