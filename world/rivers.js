// Pure (given a loaded map). The rivers: rain run down the map's own heights, region by region, then cut into the ground
// at block scale.
//
//   the flood   every hollow drains: a priority flood from the coast inward (lowest first) raises each land cell to at
//               least the level it must spill at, and hands it to the cell that reached it, its receiver. So every land
//               cell drains to the sea, down a tree of receivers
//   the flow    each cell's rain (its belt's wetness, world/climate.js's belts) summed down the tree: a cell's flow is the
//               wet cells upstream of it, itself among them
//   a channel   where the flow reaches 21 (a stream), 55 (a river) or 144 (a great river), a channel runs from the cell's
//               middle to its receiver's, its width as the root of its flow and its depth as its two-fifths power
//               (hydraulic geometry); its line wanders as a sine-generated curve (the shape real meanders take), its
//               wavelength eleven widths, quieted at both ends so the channels join
//   the cut     the channel's bed is cut into the ground under its water, its banks graded one in two; the water stands
//               level with the land it runs through, falling from cell to cell toward the sea
import { D, VISION } from "../core/given.js";
import { PHI, FIB, FIBS } from "../core/golden.js";
import { mod } from "../core/fixed.js";
import { latOf } from "../core/globe.js";
import { belt } from "../core/wind.js";
import { gnoise, hashAt } from "../core/noise.js";
import { map, chunkHeight } from "./map.js";

export const RIVER = Object.freeze({
  STREAM: FIB[7], RIVER: FIB[9], GREAT: FIB[11],   // derived: the flows (wet cells upstream) a stream, a river and a great river start at
  WIDE: FIB[6], DEEP: FIB[4],                       // vision: the widest channel (13 blocks) and the deepest (5)
  CREEK: FIB[5],                                    // vision: a creek from eight wet cells upstream: a block wide, for the look, carrying no boats
  NAVIGABLE: [FIB[5], FIB[3]],                      // vision: a trunk river at least 8 wide and 3 deep, whatever its flow
  MEANDER: FIB[5] + FIB[3],                         // vision: a meander's wavelength in widths (eleven, as real rivers keep)
  SWING: 1 / PHI,                                   // vision: the meander's swing on steep ground, in radians either way (on the flat it swings to phi, as lowland rivers loop)
  BANK: 2,                                          // given: banks graded one in two
  LOOP: FIBS[11], LOOP_SWING: FIB[10],              // vision: loops about 144 blocks across, swinging up to 89 (they cross their own path: oxbow islands)
  BEND: FIB[9], BEND_SWING: FIB[7],                 // vision: bends in them 55 long, 21 wide
  WANDER: FIBS[13], WANDER_SWING: FIB[9],           // vision: and the valley's own wander, 377 long and 55 wide
  OXBOW: 1 / PHI ** 5,                              // vision: an old loop left as a lake by about one river cell in eleven, where it bends hard on the flat
  OXBOW_TURN: 1 / PHI,                              // vision: a bend that hard (radians between pieces) at least
});
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];   // given: the eight neighbours
const N4 = N8.slice(0, 4);   // given: the four faces (water hands on across a face, so no two channels cross)

let cache = null;
/** Use a baked drainage (the game's: tools/buildmod.mjs keeps only the channels' cells): { W, H, cells: [k, to, Q, Hf, main, ...], receivers: [k, Hf, ...] }. */
export function useDrainage(b) {
  const d = { W: b.W, H: b.H, to: {}, Q: {}, Hf: {}, main: {} };
  for (let i = 0; i < b.cells.length; i += 5) { const k = b.cells[i]; d.to[k] = b.cells[i + 1]; d.Q[k] = b.cells[i + 2]; d.Hf[k] = b.cells[i + 3]; d.main[k] = b.cells[i + 4]; }   // given: five numbers a cell
  for (let i = 0; i < b.receivers.length; i += 2) if (d.Hf[b.receivers[i]] === undefined) d.Hf[b.receivers[i]] = b.receivers[i + 1];
  cache = d;
}
/** The drainage's channel cells, flat, for baking: [cells, receivers] as useDrainage takes them. */
export function bakeDrainage() {
  const d = drainage(), cells = [], rec = [];
  for (let k = 0; k < d.W * d.H; k++) if (d.Q[k] >= RIVER.CREEK) { cells.push(k, d.to[k], Math.round(d.Q[k] * FIB[6]) / FIB[6], Math.round(d.Hf[k] * FIB[6]) / FIB[6], d.main[k]); const t = d.to[k] >= 0 ? d.to[k] : -1 - d.to[k]; rec.push(t, Math.round((d.to[k] >= 0 ? d.Hf[t] : 0) * FIB[6]) / FIB[6]); }   // vision: kept to a thirteenth
  return { W: d.W, H: d.H, cells, receivers: rec };
}
/** The drainage: { to (receiver cell, -1 at the sea), Q (flow), Hf (filled height) } over the map's cells. */
export function drainage() {
  if (cache) return cache;
  const m = map(), W = m.w, H = m.h, N = W * H, h = (k) => chunkHeight(k % W, Math.floor(k / W));
  const to = new Int32Array(N).fill(-1), Hf = new Float32Array(N), seen = new Uint8Array(N), order = [];
  // a binary heap of (height, cell)
  const hk = [], hv = []; const push = (v, k) => { let i = hv.length; hv.push(v); hk.push(k); while (i > 0) { const p = (i - 1) >> 1; if (hv[p] <= hv[i]) break; [hv[p], hv[i]] = [hv[i], hv[p]]; [hk[p], hk[i]] = [hk[i], hk[p]]; i = p; } };
  const pop = () => { const k = hk[0], v = hv[0], lk = hk.pop(), lv = hv.pop(); if (hv.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let s = i; if (a < hv.length && hv[a] < hv[s]) s = a; if (b < hv.length && hv[b] < hv[s]) s = b; if (s === i) break; [hv[s], hv[i]] = [hv[i], hv[s]]; [hk[s], hk[i]] = [hk[i], hk[s]]; i = s; } } return [v, k]; };
  for (let k = 0; k < N; k++) { if (h(k) > 0) continue; seen[k] = 1; Hf[k] = 0; const i = k % W, j = Math.floor(k / W); if (N8.some(([a, b]) => j + b >= 0 && j + b < H && h((j + b) * W + mod(i + a, W)) > 0)) push(0, k); }   // the coast's sea cells start the flood
  while (hv.length) {
    const [v, c] = pop(), i = c % W, j = Math.floor(c / W); if (h(c) > 0) order.push(c);
    for (const [a, b] of N4) { const jj = j + b; if (jj < 0 || jj >= H) continue; const n = jj * W + mod(i + a, W); if (seen[n]) continue; seen[n] = 1; Hf[n] = Math.max(h(n), v); to[n] = h(c) > 0 ? c : -1 - c; push(Hf[n], n); }   // a land cell reached from the sea drains to it (stored as -1 - the sea cell)
  }
  const Q = new Float32Array(N);
  for (const k of order) Q[k] += VISION.WET[belt(latOf((Math.floor(k / W) + 0.5) * D.PX)).name] ?? VISION.WET.westerlies;   // its belt's rain
  for (let q = order.length - 1; q >= 0; q--) { const k = order[q]; if (to[k] >= 0) Q[to[k]] += Q[k]; }
  const main = new Int32Array(N).fill(-1); for (const k of order) { const t = to[k]; if (t >= 0 && (main[t] < 0 || Q[k] > Q[main[t]])) main[t] = k; }   // each cell's main inflow (the biggest)
  cache = { W, H, to, Q, Hf, main };
  return cache;
}
/** A channel's measure from its flow: { w, d } in blocks, or null under a stream's flow. */
let trunk = new Set();
/** Use the trunk rivers (world/trunks.json): their cells get a navigable channel. */
export function useTrunks(list = []) { trunk = new Set(list.flatMap((t) => t.cells)); segCache.clear?.(); }
export const isTrunk = (k) => trunk.has(k);
/** A cell's channel: its flow's (channelOf), widened to a navigable river on a trunk. */
export function channelAt(R, k) { const ch = channelOf(R.Q[k]); if (!trunk.has(k)) return ch; return { w: Math.max(RIVER.NAVIGABLE[0], ch?.w ?? 0), d: Math.max(RIVER.NAVIGABLE[1], ch?.d ?? 0), trunk: true }; }
export function channelOf(Q) {
  if (!(Q >= RIVER.CREEK)) return null;
  if (Q < RIVER.STREAM) return { w: 1, d: 1, creek: true };
  return { w: Math.min(RIVER.WIDE, Math.max(1, Math.round((Math.sqrt(Q) - PHI ** 2) / PHI))), d: Math.min(RIVER.DEEP, Math.max(1, Math.round(Q ** (2 / FIB[4]) / PHI ** 2))) };   // derived: width as the root of the flow, depth as its two-fifths power, scaled to the table's ends
}
const segCache = new Map(), SAMPLES = FIB[8], SMOOTH = [1, 6, 15, 20, 15, 6, 1], REACH3 = FIB[3];   // vision: a cell's channel through 34 points (smooth through its loops); given: the binomial row of six (the path smoothed over three cells either way)
/** A river cell's place on its smoothed path: its middle averaged with three cells up its main stem and three down,
 *  binomially, so a path that steps from cell to cell along the map's grid runs as a line, not a staircase. */
function smoothAt(R, k, ox) {
  const at = (q) => { const qi = q % R.W, qj = Math.floor(q / R.W); let dx = qi - ox; if (dx > R.W / 2) dx -= R.W; if (dx < -R.W / 2) dx += R.W; return [(ox + dx + 0.5) * D.PX, (qj + 0.5) * D.PX]; };
  const path = [k]; let u = k; for (let n = 0; n < REACH3; n++) { u = R.main[u]; if (!(u >= 0) || !channelOf(R.Q[u])) break; path.unshift(u); }   // given: three either way
  let d = k; for (let n = 0; n < REACH3; n++) { if (!(R.to[d] >= 0)) break; d = R.to[d]; path.push(d); }
  const mid = path.indexOf(k); let sx = 0, sz = 0, sw = 0;
  path.forEach((q, i) => { const w = SMOOTH[i - mid + REACH3], c = at(q); sx += w * c[0]; sz += w * c[1]; sw += w; });
  return [sx / sw, sz / sw];
}
/** The meander: a displacement field over the ground (three gradient waves: the loops, the bends in them, the valley's
 *  wander), the same at a point whoever reads it, so channels keep their joins and tributaries meet their rivers where
 *  they run. Where the loops swing past their own spacing the channel crosses its own path, leaving oxbow islands. */
export function meanderAt(x, z) {
  const f = (L, A, k) => [A * gnoise(x / L, z / L, k), A * gnoise(x / L + PHI, z / L - PHI, k + 2)];
  const a = f(RIVER.LOOP, RIVER.LOOP_SWING, 509), b = f(RIVER.BEND, RIVER.BEND_SWING, 519), c = f(RIVER.WANDER, RIVER.WANDER_SWING, 511);   // vision: the waves' keys
  return [a[0] + b[0] + c[0], a[1] + b[1] + c[1]];
}
/** The channel pieces near a map cell: each river cell in the ring round it (and itself) runs from its smoothed place to
 *  its receiver's, meandering by the field; a river's last piece runs out past its mouth into the sea, stilled as it
 *  goes, so it reaches the water. Beside the loops, now and then, an oxbow: a crescent of the old channel, cut off. */
function segmentsNear(i, j) {
  const key = j * D.CELLS_W + mod(i, D.CELLS_W); let s = segCache.get(key); if (s) return s;
  const R = drainage(), out = [], ox = mod(i, R.W);
  const cellMid = (r) => { const ri = r % R.W, rj = Math.floor(r / R.W); let dx = ri - ox; if (dx > R.W / 2) dx -= R.W; if (dx < -R.W / 2) dx += R.W; return [(ox + dx + 0.5) * D.PX, (rj + 0.5) * D.PX]; };
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const jj = j + b; if (jj < 0 || jj >= R.H) continue; const k = jj * R.W + mod(i + a, R.W), ch = channelAt(R, k); if (!ch) continue;
    const sea = !(R.to[k] >= 0), r = sea ? -1 - R.to[k] : R.to[k];
    const P0 = smoothAt(R, k, ox); let P1 = sea ? cellMid(r) : smoothAt(R, r, ox);
    if (sea) P1 = [P0[0] + (P1[0] - P0[0]) * PHI, P0[1] + (P1[1] - P0[1]) * PHI];   // derived: the mouth runs a golden share past the sea cell's middle
    const la = R.Hf[k], lb = sea ? 0 : R.Hf[r], pts = [];
    for (let q = 0; q <= SAMPLES; q++) {
      const t = q / SAMPLES, mx = P0[0] + (P1[0] - P0[0]) * t, mz = P0[1] + (P1[1] - P0[1]) * t, [dx, dz] = meanderAt(mx, mz), still = sea ? 1 - t : 1;   // stilled toward the mouth
      pts.push([mx + dx * still, mz + dz * still, Math.max(0, la + (lb - la) * t)]);
    }
    // an oxbow: on flat ground, at the piece's sharpest turn, by its own draw, the loop's crescent pushed out past the channel
    if (!sea && Math.abs(la - lb) < FIB[3] && hashAt(k, 0, 533) < RIVER.OXBOW) {   // derived: flat: a fall under three blocks a cell
      let best = -1, bk = 0; for (let q = 1; q < SAMPLES; q++) { const ax = pts[q][0] - pts[q - 1][0], az = pts[q][1] - pts[q - 1][1], bx = pts[q + 1][0] - pts[q][0], bz = pts[q + 1][1] - pts[q][1], turn = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz)); if (turn > bk) { bk = turn; best = q; } }
      if (best > 0 && bk >= RIVER.OXBOW_TURN) { const c = pts[best], m = [(pts[best - 1][0] + pts[best + 1][0]) / 2, (pts[best - 1][1] + pts[best + 1][1]) / 2], ex = c[0] - m[0], ez = c[1] - m[1], el = Math.hypot(ex, ez) || 1, ux = ex / el, uz = ez / el;
        const R0 = FIB[6] + ch.w * FIB[2] + FIB[7] * hashAt(k, 1, 535), gap = R0 + ch.w + FIB[5], spread = (Math.PI / FIB[3]) * (1 + hashAt(k, 2, 537));   // derived: a crescent 13 to 34 blocks round, its middle past the channel by its radius, a width and eight; 60 to 120 degrees of arc
        const lake = { ...ch, w: Math.max(FIB[3], ch.w + 1), d: Math.max(1, ch.d - 1), oxbow: true }, arc = [];   // given: an oxbow a little wider and shallower than its river
        for (let q = -FIB[4]; q <= FIB[4]; q++) { const ang = (q / FIB[4]) * spread, rr = R0 * (1 + gnoise(q / FIB[3], k % FIBS[12], 539) / PHI ** 2), cx0 = c[0] + ux * gap, cz0 = c[1] + uz * gap; arc.push([cx0 - ux * rr * Math.cos(ang) - uz * rr * Math.sin(ang), cz0 - uz * rr * Math.cos(ang) + ux * rr * Math.sin(ang), c[2]]); }   // derived: its outline wanders a golden square of its radius
        for (let q = 0; q + 1 < arc.length; q++) out.push({ a: arc[q], b: arc[q + 1], ...lake });
      }
    }
    const fall = Math.abs(la - lb) / (Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) || 1);   // the fall a block along
    for (let q = 0; q < SAMPLES; q++) out.push({ a: pts[q], b: pts[q + 1], ...ch, fall });
  }
  segCache.set(key, out); if (segCache.size > FIBS[13]) segCache.delete(segCache.keys().next().value);   // vision: 610 cells' pieces kept
  return out;
}
/** The river at block (x, z), if a channel or its banks reach it: { level (the water's top, blocks over the sea), bed, bank (the ground's cap there) }, or null. */
export function riverAt(x, z) {
  const i = Math.floor(x / D.PX), j = Math.floor(z / D.PX); let best = null;
  for (const s of segmentsNear(i, j)) {
    const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - s.a[0]) * ex + (z - s.a[1]) * ez) / L2));
    const d = Math.hypot(x - (s.a[0] + ex * t), z - (s.a[1] + ez * t)), half = s.w / 2;
    if (d > half + RIVER.BANK * RIVER.DEEP * FIB[4]) continue;   // derived: past the widest bank a valley can need
    const level = Math.max(0, s.a[2] + (s.b[2] - s.a[2]) * t) - 1, depth = Math.max(1, Math.round(s.d * (1 - (d / Math.max(half, 1)) ** 2))), bank = d <= half ? level - depth : level + (d - half) / RIVER.BANK;   // derived: the bed deepest at the middle, shallowing to a block at the edges (a parabola)
    if (!best || bank < best.bank) best = { level, bed: level - depth, bank, wet: d <= half, edge: d - half, oxbow: !!s.oxbow, fall: s.fall ?? 0, w: s.w };
  }
  return best;
}
