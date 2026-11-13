// Pure (given a loaded map). The islands, and the sea between them, at chunk scale.
//
//   label     every land chunk's island (8-neighbour connected; wraps east-west)
//   reach     every sea chunk's nearest island and how far it is (chunks): one breadth-first sweep
//             from every coast at once
//   hops      where two islands' reaches meet, the gap between them: the open water a boat must
//             cross to hop from one to the other
//   around    whether a boat that can cross `gap` chunks of open water can go round the world by
//             hopping: a walk over the hop graph that comes back to its start one full turn east
//             (or west) of where it began. The smallest such gap is the small boat's route.
import { map, isLandChunk } from "./map.js";
import { mod } from "../core/fixed.js";

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];   // given: the eight neighbours
const N4 = N8.slice(0, 4);   // given: the first four are the faces

let cache = null;
export function islands() {
  if (cache) return cache;
  const m = map(), W = m.w, H = m.h, N = W * H;
  const label = new Int32Array(N).fill(-1), info = [];
  const land = (i, j) => isLandChunk(i, j);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (label[k] >= 0 || !land(i, j)) continue;
    const id = info.length, q = [k];
    label[k] = id;
    let area = 0, sx = 0, sz = 0, top = 0, coast = 0;
    const x0 = i;
    while (q.length) {
      const c = q.pop(), ci = c % W, cj = (c / W) | 0;
      area++; sz += cj; top = Math.max(top, m.data[c]);
      // centroid east-west, unwrapped relative to where the sweep began
      let dx = ci - x0; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; sx += dx;
      let shore = false;
      for (const [a, b] of N8) {
        const ni = mod(ci + a, W), nj = cj + b;
        if (nj < 0 || nj >= H) continue;
        const nk = nj * W + ni;
        if (!land(ni, nj)) { shore = true; continue; }
        if (label[nk] < 0) { label[nk] = id; q.push(nk); }
      }
      if (shore) coast++;
    }
    info.push({ id, area, cx: mod(x0 + sx / area, W), cz: sz / area, top, coast });
  }
  // the reach: nearest island and distance (in 4-steps) for every sea chunk
  const near = new Int32Array(N).fill(-1), dist = new Int32Array(N).fill(-1), q = [];
  for (let k = 0; k < N; k++) if (label[k] >= 0) { near[k] = label[k]; dist[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], ci = c % W, cj = (c / W) | 0;
    for (const [a, b] of N4) {
      const ni = mod(ci + a, W), nj = cj + b;
      if (nj < 0 || nj >= H) continue;
      const nk = nj * W + ni;
      if (dist[nk] >= 0) continue;
      dist[nk] = dist[c] + 1; near[nk] = near[c]; q.push(nk);
    }
  }
  // the hops: where two reaches meet, the gap is the sum of both distances
  const hops = new Map();
  for (let k = 0; k < N; k++) {
    const ci = k % W, cj = (k / W) | 0;
    for (const [a, b] of [[1, 0], [0, 1]]) {
      const ni = mod(ci + a, W), nj = cj + b;
      if (nj >= H) continue;
      const nk = nj * W + ni, A = near[k], B = near[nk];
      if (A < 0 || B < 0 || A === B) continue;
      const gap = dist[k] + dist[nk] + 1;
      // the crossing's east-west direction (does it run across the wrap?)
      const key = A < B ? `${A},${B}` : `${B},${A}`;
      const prev = hops.get(key);
      if (!prev || gap < prev.gap) hops.set(key, { a: A, b: B, gap, ka: k, kb: nk });
    }
  }
  cache = { label, info, near, dist, hops: [...hops.values()], W, H };
  return cache;
}

/** Can a boat that crosses at most `gap` chunks of open water hop round the world? { ok, path } */
export function around(gap, { minArea = 1 } = {}) {
  const { info, hops, W } = islands();
  const adj = new Map();
  const ok = (i) => info[i].area >= minArea;
  for (const h of hops) {
    if (h.gap > gap || !ok(h.a) || !ok(h.b)) continue;
    // unwrapped east-west step between the two islands' centres
    let d = info[h.b].cx - info[h.a].cx; if (d > W / 2) d -= W; if (d < -W / 2) d += W;
    (adj.get(h.a) ?? adj.set(h.a, []).get(h.a)).push({ to: h.b, d, hop: h });
    (adj.get(h.b) ?? adj.set(h.b, []).get(h.b)).push({ to: h.a, d: -d, hop: h });
  }
  // a walk that reaches an island again at a different winding has gone round
  const pos = new Map(), from = new Map();
  for (const start of adj.keys()) {
    if (pos.has(start)) continue;
    pos.set(start, 0);
    const q = [start];
    while (q.length) {
      const u = q.shift();
      for (const e of adj.get(u)) {
        const p = pos.get(u) + e.d;
        if (!pos.has(e.to)) { pos.set(e.to, p); from.set(e.to, { u, hop: e.hop }); q.push(e.to); }
        else if (Math.abs(pos.get(e.to) - p) > W / 2) {
          const chain = (v) => { const out = []; while (from.has(v)) { const f = from.get(v); out.push(f.hop); v = f.u; } return out; };
          return { ok: true, gap, cycle: [...chain(u), e.hop, ...chain(e.to)] };
        }
      }
    }
  }
  return { ok: false, gap };
}
/** The smallest open-water gap (chunks) a boat must manage to go round by hopping. */
export function smallestRound(maxGap = 256) {   // vision: a search bound
  let lo = 1, hi = maxGap;
  if (!around(hi).ok) return null;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (around(mid).ok) hi = mid; else lo = mid + 1; }
  return lo;
}
