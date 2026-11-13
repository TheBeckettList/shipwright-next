// Pure. Natural patterns, every one periodic on a square of side n (so a texture made of them tiles
// exactly), and as many as can be drawn from the golden law itself rather than from outside it.
//
//   recordNoise  the native noise: the two-layer universe's record (cycles.js) driven by the golden
//                line for a few breaths is a heat bath of trits, balanced and patternless, yet fixed
//                by where it started. Read on a periodic lattice and smoothed, it is value noise that
//                needs no hash: the world's own record, the same law that drives its cultures
//   fbm          octaves of it, each lattice a power of two dividing n
//   cells        Worley's cells (stones, cobbles, crazing) on the same native lattice: each lattice
//                cell's seed point placed by two record trits
//   phyllo       the sunflower's spiral: seeds at the golden angle, which is F's own eigenvalue
//                (phi, the golden law's growth) as a turn: 2 pi (1 - 1/phi)
//   string       the 5D string gate (Seedworld census gate #5, -(I + one shear)) on an n x n torus
//                of 2x2 blocks from one point: it grows a single closed string, beads at 3n/2, and
//                reassembles into the point at exactly 3n ticks. A flipbook of it loops exactly by
//                the law's own return
//   turing       Gray and Scott's reaction and diffusion: the spots and stripes that "pop up" in
//                coral, shells and skins (Turing's patterns), run on the torus, seeded natively
import { worldOf, tick } from "./cycles.js";
import { bal } from "./field.js";

const PHI = (1 + Math.sqrt(5)) / 2;   // derived: the golden law's growth, F's larger eigenvalue
export const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / PHI);   // derived: the eigenvalue as a turn
const memo = new Map();

/** A P x P lattice of trits from the record after `breaths` breaths of a P-cell pulse (period P both ways). */
export function recordLattice(P, breaths = 3, shift = 1) {   // vision: three breaths settle it to balance (Seedworld), a shift per row
  const key = `${P},${breaths},${shift}`;
  if (memo.has(key)) return memo.get(key);
  const R = P * P, ctrl = Array.from({ length: R }, (_, i) => (i + Math.floor(i / P) * shift) % P);   // given: a lattice's two coordinates; the block's four cells; mod 3
  const w = worldOf(P, new Array(R).fill(0), ctrl);
  w.record[0] = 1;   // one point in the record too, so it starts somewhere
  for (let t = 0; t < breaths * 2 * P; t++) tick(w);   // derived: a breath is 2P ticks
  const out = Float32Array.from(w.record);
  memo.set(key, out);
  return out;
}
const smooth = (t) => t * t * (3 - 2 * t);   // given: the smoothstep
/** Native value noise at (x, y) in a tile of side n, on a P-lattice (P divides n): 0..1. */
export function recordNoise(x, y, n, P, k = 0) {
  const L = recordLattice(P, 9 + k, 1 + 2 * k), s = n / P;   // vision: nine breaths and more settle it past its seed's shape; each octave a different settling and shift, so octaves don't echo
  const u = x / s, v = y / s, i = Math.floor(u), j = Math.floor(v), a = smooth(u - i), b = smooth(v - j);
  const at = (p, q) => (L[(((q % P) + P) % P) * P + (((p % P) + P) % P)] + 1) / 2;
  return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - b) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * b;
}
/** Octaves of native noise, lattices from base, doubling (each halving the weight): 0..1. stretch: rows per lattice row (grain). */
export function fbm(x, y, n, octaves = 3, base = 4, stretch = 1) {   // vision: three octaves from a 4-lattice
  let s = 0, w = 1, tot = 0;
  for (let o = 0, P = base; o < octaves && P <= n; o++, P *= 2) { s += w * recordNoise(x, y / stretch, n, P, o); tot += w; w /= 2; }
  return s / tot;
}
/** Worley cells on a P-lattice: { f1, f2 } distances (in lattice cells), seeds placed by record trits; wraps. */
export function cells(x, y, n, P, k = 0) {
  const L = recordLattice(P * 2, 9 + k, 3), s = n / P, u = x / s, v = y / s, i = Math.floor(u), j = Math.floor(v);   // vision: twice the lattice, so each cell has its own two trits
  let f1 = 9, f2 = 9;   // vision: past any distance in a 3 x 3 neighbourhood
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ci = (((i + di) % P) + P) % P, cj = (((j + dj) % P) + P) % P;
    const ox = (L[(2 * cj) * 2 * P + 2 * ci] + 1.5) / 3, oy = (L[(2 * cj + 1) * 2 * P + 2 * ci + 1] + 1.5) / 3;   // given: a trit -1, 0, 1 as a third of the cell, centred
    const d = Math.hypot(i + di + ox - u, j + dj + oy - v);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return { f1, f2 };
}
/** The sunflower: distance from (x, y) to the nearest of `count` seeds in golden-angle order round the tile's centre (wraps). */
export function phyllo(x, y, n, count) {
  let best = 9e9;   // vision: past any distance
  for (let k = 0; k < count; k++) {
    const r = (n / 2) * Math.sqrt((k + 0.5) / count), th = k * GOLDEN_ANGLE, px = n / 2 + r * Math.cos(th), py = n / 2 + r * Math.sin(th);
    let dx = Math.abs(px - x) % n, dy = Math.abs(py - y) % n; dx = Math.min(dx, n - dx); dy = Math.min(dy, n - dy);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

// The 5D string: gate #5 on blocks (TL, TR, BL, BR), brick-wall in 2D (blocks at even offsets on even ticks, odd on odd)
export const STRING_GATE = Object.freeze([[1, 0, 0, 2], [1, 2, 0, 1], [1, 0, 2, 1], [1, 0, 0, 0]]);   // given: Seedworld census gate #5
/** The string on an n x n torus (n even) from one point, frames 0..3n (frame 3n is frame 0 again). Each frame a trit grid. */
export function stringFrames(n) {
  const key = `string${n}`;
  if (memo.has(key)) return memo.get(key);
  let g = new Int8Array(n * n); g[0] = 1;
  const frames = [Int8Array.from(g)], G = STRING_GATE;
  for (let t = 0; t < 3 * n; t++) {   // derived: the string's return, 3n
    const o = t % 2, h = new Int8Array(n * n);   // given: a lattice's two coordinates; the block's four cells; mod 3
    for (let j = o; j < n + o; j += 2) for (let i = o; i < n + o; i += 2) {
      const ix = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([a, b]) => (b % n) * n + (a % n)), v = ix.map((q) => g[q]);   // given: a lattice's two coordinates; the block's four cells; mod 3
      ix.forEach((q, r) => { h[q] = bal(G[r][0] * v[0] + G[r][1] * v[1] + G[r][2] * v[2] + G[r][3] * v[3]); });   // given: the gate times the block's four trits
    }
    g = h; frames.push(Int8Array.from(g));
  }
  memo.set(key, frames);
  return frames;
}
/** Gray-Scott on an n x n torus, seeded where the native lattice is matter: v 0..1 after `steps`. */
export function turing(n, { feed = 0.055, kill = 0.062, steps = 3000, seedP = 4 } = {}) {   // vision: Pearson's coral regime (it patterns a tile this small; the spots regime fills it), steps to settle, the seed lattice
  const key = `turing${n},${feed},${kill},${steps},${seedP}`;
  if (memo.has(key)) return memo.get(key);
  const N = n * n, Du = 0.2, Dv = 0.1, dt = 1;   // vision: diffusion rates (u twice v), the step
  let U = new Float32Array(N).fill(1), V = new Float32Array(N), L = recordLattice(seedP);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = L[Math.floor((y * seedP) / n) * seedP + Math.floor((x * seedP) / n)]; if (c === 1) { V[y * n + x] = 0.5; U[y * n + x] = 0.5; } }   // vision: half and half where seeded
  const lap = (A, x, y) => A[((y + 1) % n) * n + x] + A[((y + n - 1) % n) * n + x] + A[y * n + ((x + 1) % n)] + A[y * n + ((x + n - 1) % n)] - 4 * A[y * n + x];   // given: the five-point Laplacian
  for (let s = 0; s < steps; s++) {
    const U2 = new Float32Array(N), V2 = new Float32Array(N);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = y * n + x, uvv = U[k] * V[k] * V[k];
      U2[k] = U[k] + dt * (Du * lap(U, x, y) - uvv + feed * (1 - U[k]));
      V2[k] = V[k] + dt * (Dv * lap(V, x, y) + uvv - (feed + kill) * V[k]);
    }
    U = U2; V = V2;
  }
  let hi = 0; for (const v of V) hi = Math.max(hi, v);
  const out = V.map((v) => v / (hi || 1));
  memo.set(key, out);
  return out;
}
