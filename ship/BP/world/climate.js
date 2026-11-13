// Pure (given a loaded map). A chunk's climate, from the base fields and nothing else:
//   heat      from latitude (the sun), cooled by height (lapse), and warmed by the Therans' solar
//             rite (solar.js), renewed every year's end
//   moisture  the wind belt's rain, wetter on the coast and on windward slopes, dry in the lee of
//             high ground upwind (rain shadow: the wind comes from the belt's bearing, wind.js)
//   biome     the first of vanilla's biomes (biomes.js) whose climate it is
import { VISION, GIVEN, D } from "../core/given.js";
import { drainage, channelOf } from "./rivers.js";
const riverCell = (cx, cz) => { const R = drainage(), j = Math.max(0, Math.min(R.H - 1, cz)), k = j * R.W + (((cx % R.W) + R.W) % R.W); const ch = channelOf(R.Q[k]); return !!ch && !ch.creek && chunkHeight(cx, cz) > 0; };   // a map cell a river runs through
import { latOf } from "../core/globe.js";
import { belt } from "../core/wind.js";
import { chunkHeight, blockHeight, linearHeight } from "./map.js";
import { landBiome, seaBiome, LAND_BIOMES, BEACH, EXTREMES, EXTREME_FIELD } from "./biomes.js";
const EXTREME_OF = new Map(EXTREMES.map((e) => [e.parent, e]));
import { vnoise as vn, gnoise } from "../core/noise.js";
import { PHI as P_, FIB as F_, FIBS } from "../core/golden.js";
const FIB = F_;
import { solarAt } from "./solar.js";

const RAD = Math.PI / 180;   // given
const C = D.PX;   // blocks a map cell

/** The climate of the map cell holding block (x, z). */
export const climateAtBlock = (x, z) => climateAt(Math.floor(x / C), Math.floor(z / C));
// ---- the wet: the belts' rain blended across their edges, the sea's reach (coasts a little wetter, interiors drying over
// 2,584 blocks), and the wind over the relief (the highest ground upwind, nearer counting more, against this ground)
export const WETNESS = Object.freeze({
  COAST_REACH: FIBS[12], DRY_REACH: FIBS[17],   // vision: the coast's wet reaches 233 blocks; an interior dries over 2,584
  UP_FALL: FIBS[13], UP_REACH: FIBS[14],        // vision: upwind ground counts less over 377 blocks, out to 610
  RIVER: 1 / FIB[5], RIVER_REACH: FIB[10],      // vision: a river wets its country by an eighth, out to 89 blocks
});
/** The belts' rain at a latitude, each belt handing over to the next across BELT_BLEND (a smoothstep, not a step). */
export function beltWet(lat) {
  const a = Math.abs(lat), B = VISION.BELTS, half = VISION.BELT_BLEND / 2, wet = (k) => VISION.WET[B[k][1]] ?? VISION.WET.westerlies;
  let i = B.findIndex(([top]) => a <= top); if (i < 0) i = B.length - 1;
  const ss = (t) => { const q = Math.max(0, Math.min(1, t)); return q * q * (3 - 2 * q); };   // given: smoothstep
  if (i + 1 < B.length && a > B[i][0] - half) return wet(i) + (wet(i + 1) - wet(i)) * ss((a - (B[i][0] - half)) / (2 * half)) / 2;
  if (i > 0 && a < B[i - 1][0] + half) return wet(i) + (wet(i - 1) - wet(i)) * (1 - ss((a - (B[i - 1][0] - half)) / (2 * half))) / 2;
  return wet(i);
}
let seaDist = null;
/** Use a baked sea distance (map cells, a byte each, capped): the game's. */
export function useSeaDistance(a) { seaDist = a; }
/** The sea distance, for baking: a byte a cell (cells, capped at a byte.s top). */
export function bakeSeaDistance() { seaDistance(0, 0); return Uint8Array.from(seaDist, (v) => Math.min(255, v)); }   // given: a byte's top
/** How far a map cell is from open water, in blocks (a breadth-first sweep from every sea cell; land only). */
export function seaDistance(cx, cz) {
  if (!seaDist) {
    const W = D.CELLS_W, H = D.CELLS_H, d = new Float32Array(W * H).fill(Infinity), q = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (chunkHeight(i, j) <= 0) { d[j * W + i] = 0; q.push(j * W + i); }
    for (let n = 0; n < q.length; n++) { const k = q[n], i = k % W, j = Math.floor(k / W); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + b; if (jj < 0 || jj >= H) continue; const m = jj * W + ((i + a + W) % W); if (d[m] <= d[k] + 1) continue; d[m] = d[k] + 1; q.push(m); } }   // given: the four faces
    seaDist = d;
  }
  return seaDist[Math.max(0, Math.min(D.CELLS_H - 1, cz)) * D.CELLS_W + (((cx % D.CELLS_W) + D.CELLS_W) % D.CELLS_W)] * C;
}
export function climateAt(cx, cz) {
  const h = chunkHeight(cx, cz), lat = latOf((cz + 0.5) * C), b = belt(lat);
  const heat = Math.max(0, 1 - (Math.abs(lat) / 90) ** VISION.HEAT_POW - Math.max(0, h) * VISION.LAPSE);
  const T = VISION.TEMP[0] + (VISION.TEMP[1] - VISION.TEMP[0]) * heat + solarAt(lat);   // and the Therans' solar rite (solar.js), at the year's mean
  // upwind: the ground the wind crosses before it gets here, each cell counting less with its distance
  const ue = Math.sin(b.from * RAD), us = -Math.cos(b.from * RAD), steps = Math.ceil(WETNESS.UP_REACH / C);
  let up = 0;
  for (let k = 1; k <= steps; k++) up = Math.max(up, Math.max(0, chunkHeight(Math.round(cx + ue * k), Math.round(cz + us * k))) * Math.exp((-k * C) / WETNESS.UP_FALL));
  const coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => (chunkHeight(cx + a, cz + c) > 0) !== (h > 0));   // given: the four neighbours
  let M = beltWet(lat);
  if (h > 0) {
    const d = seaDistance(cx, cz);
    M *= (1 + VISION.COASTAL * Math.exp(-d / WETNESS.COAST_REACH)) * Math.exp(-d / WETNESS.DRY_REACH);   // the sea's reach
    M *= 1 + Math.tanh((h - up) / VISION.SHADOW) / 2;   // the wind over the relief: windward wetter, the lee drier (by half at most)
    if (riverCell(cx, cz)) M += WETNESS.RIVER;   // a river's country
  }
  M = Math.max(0, Math.min(1, M));
  const ice = Math.abs(lat) > VISION.ICE_LAT;
  const c = { cx, cz, h, lat, heat, T, M, coast, ice, belt: b.name, windFrom: b.from };
  c.biome = h > 0 ? landBiome(c) : seaBiome(c);
  return c;
}

// ---- the climate a column feels. The chunk's climate is the sim's (what a chunk yields, its people,
// its fog); the ground a player walks reads a field between: heat and wet blended between the chunk
// centres round the block, at a point the ground's own grain pushes up to a chunk aside, so a biome's
// edge wanders like a real one instead of stepping round chunk squares. The same function of the
// same map: no seed, no state.
export const EDGE = Object.freeze({
  WARP: C * P_,                                // vision: an edge wanders up to a golden chunk (26 blocks) either way
  SIZE: C * P_ * P_,                           // derived: the wander's size, a golden square of chunks (42 blocks)
  SHORE: F_[4],                                // vision: sand runs up to five blocks from the water
  DUNE: F_[3],                                 // vision: and up to three over the sea (less where the grain dips)
  KEEP: F_[10] * F_[7],                        // vision: chunks' climates kept (1,869)
  MICRO_T: 1, MICRO_M: 1 / F_[8],              // vision: a microclimate of a degree and a 34th of the wet, end to end
  MESO_T: 2, MESO_M: 1 / F_[5],                // vision: and over country 1,597 and 987 blocks across, two degrees and an eighth of the wet either way
});
const kept = new Map();
/** climateAt, kept (the field reads each chunk's four times over). */
export function climateOf(cx, cz) {
  const k = cz * 4096 + cx; let c = kept.get(k);   // derived: a key past the map's width (2,048 chunks)
  if (!c) { c = climateAt(cx, cz); kept.set(k, c); if (kept.size > EDGE.KEEP) kept.delete(kept.keys().next().value); }
  return c;
}
const SPAN = VISION.TEMP[1] - VISION.TEMP[0];   // derived: degrees across the heat's whole range
/** A column's climate: { T, M, h, coast, shore, ice, biome } at block (x, z), its top h over the sea. */
export function columnClimate(x, z, h = blockHeight(x, z)) {
  const S = EDGE.SIZE, W = EDGE.WARP;
  const wx = x + W * 2 * (vn(x / S, z / S, 401) * 0.6 + vn(x * P_ / S, z * P_ / S, 409) * 0.4 - 0.5);   // vision: two octaves, the finer at 0.4
  const wz = z + W * 2 * (vn(x / S, z / S, 419) * 0.6 + vn(x * P_ / S, z * P_ / S, 421) * 0.4 - 0.5);   // vision: the second warp, as the first (its own keys)
  const fx = wx / C - 0.5, fz = wz / C - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const q = [climateOf(i, j), climateOf(i + 1, j), climateOf(i, j + 1), climateOf(i + 1, j + 1)], wt = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
  let T = 0, M = 0, hb = 0, co = 0;
  for (let k = 0; k < 4; k++) { T += q[k].T * wt[k]; M += q[k].M * wt[k]; hb += Math.max(0, q[k].h) * wt[k]; co += (q[k].coast ? 1 : 0) * wt[k]; }   // given: the four corners
  T += (hb - Math.max(0, h)) * VISION.LAPSE * SPAN;   // the column's own height, not its chunks': a knoll is cooler than its plain
  const mc = (k) => (vn(x / F_[6], z / F_[6], k) + vn(x * P_ / F_[6] + 0.5, z * P_ / F_[6] + 0.5, k + 2) / P_) / (1 + 1 / P_) - 0.5;   // derived: two octaves a golden step apart, offset so their grids don't line up
  const g = mc(439), gm = mc(443);   // vision: the noise's keys; the ground's own microclimate, in patches about 13 blocks across
  T += g * EDGE.MICRO_T + EDGE.MESO_T * gnoise(x / FIBS[16], z / FIBS[16], 447); M += gm * EDGE.MICRO_M + EDGE.MESO_M * gnoise(x / FIBS[15], z / FIBS[15], 449);   // vision: the meso keys; warm and cool spells across an island, wet and dry country
  const ice = Math.abs(latOf(wz)) > VISION.ICE_LAT, coast = co >= 0.5;   // derived: coastal where most of the blend is
  let shore = false;
  if (h > 0 && h <= EDGE.DUNE * (0.5 + vn(x / F_[4], z / F_[4], 431))) {   // derived: the dune's height wanders a half either way
    const d = EDGE.SHORE * (0.6 + 0.8 * vn(x / F_[5], z / F_[5], 433));   // vision: the beach's width wanders, 3 to 7 blocks
    for (let a = 0; a < F_[5] && !shore; a++) { const t = a * 2 * Math.PI / F_[5]; if (linearHeight(x + d * Math.cos(t), z + d * Math.sin(t)) <= 0) shore = true; }   // derived: eight bearings
  }
  const c = { x, z, h, T, M, coast, shore, ice, lat: latOf(wz) };
  c.biome = h > 0 ? (shore && !ice ? BEACH : LAND_BIOMES.find((b) => b.when(c))) : seaBiome(c);
  const ex = h > 0 && EXTREME_OF.get(c.biome.id);
  if (ex) { c.extreme = ex.drive(c) + gnoise(x / EXTREME_FIELD, z / EXTREME_FIELD, 467); if (c.extreme > ex.cut) c.biome = { ...c.biome, ...ex, parent: c.biome.id }; }   // vision: the patches' key; the far tail of its own climate
  return c;
}
