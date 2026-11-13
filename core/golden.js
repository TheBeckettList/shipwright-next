// Pure. The golden toolkit for drawing: closed forms, cheap, every one periodic on a tile or never
// repeating at all, each a face of the one law F = [[1,1],[1,0]].
//
//   word      the Fibonacci word (L -> LS, S -> L: its substitution matrix is F itself). Its n-th
//             letter is a closed form, floor((n+1)/phi) - floor(n/phi): no state, no table, and the
//             sequence never repeats, yet every stretch of it looks like every other (L's share is
//             1/phi everywhere). Widths, courses, beds and rings read from it look made by hand
//   cuts      a length cut into L and S pieces from a stretch of the word, ending exactly on it
//   lattice   the Fibonacci lattice: F_k points (i/F_k, i F_(k-1)/F_k mod 1), the most even
//             spread of points a square can hold, and periodic on the tile (it wraps exactly).
//             Jittered per variant by the golden sequence, so no two variants share a stone
//   cellsOn   Voronoi cells of a point set on the torus: stones, cobbles, clods, cracks
//   truchet   a quarter-arc tile at golden radii: rotated by placement, sets of them draw spirals
export const PHI = (1 + Math.sqrt(5)) / 2;   // derived: F's larger eigenvalue
export const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / PHI);   // derived: the eigenvalue as a turn
export const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];   // derived: F's powers' entries, F^n = [[F(n+1), F(n)], [F(n), F(n-1)]]
export const FIBS = [...FIB, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946];   // derived: the same run on, for the world's longer measures (FIB itself keeps its eleven: rooms read its end)   // derived: F's powers' entries, F^n = [[F(n+1), F(n)], [F(n), F(n-1)]]
const frac = (x) => x - Math.floor(x);

/** The Fibonacci word's n-th letter: 1 (L) or 0 (S). */
export const word = (n) => Math.floor((n + 1) / PHI) - Math.floor(n / PHI);
/** The golden sequence: n/phi mod 1, the most evenly spread numbers in [0, 1). */
export const golden = (n) => frac(n / PHI);

/** `total` cut into pieces of L and S, read from the word from `start`; the last piece takes up the rest. */
export function cuts(total, L, S, start = 0) {
  const out = []; let sum = 0, n = start;
  while (sum < total) { let w = word(n++) ? L : S; if (sum + w > total || total - (sum + w) < S) w = total - sum; out.push(w); sum += w; }
  return out;
}
/** Which piece a position falls in, and where in it: { k, at, w, t } (t 0..1 across it). */
export function pieceAt(pos, list) {
  let a = 0;
  for (let k = 0; k < list.length; k++) { if (pos < a + list[k]) return { k, at: pos - a, w: list[k], t: (pos - a + 0.5) / list[k] }; a += list[k]; }
  return { k: list.length - 1, at: 0, w: list.at(-1), t: 0.5 };
}

/** F_k points of the Fibonacci lattice on a tile of side n, jittered by `jit` (cells) for variant v: [[x, y]]. */
export function lattice(k, n, v = 0, jit = 0.35) {   // vision: how far a variant moves its points, of a cell
  const Fk = FIB[k], Fk1 = FIB[k - 1], cell = n / Math.sqrt(Fk);
  return Array.from({ length: Fk }, (_, i) => {
    const j = i + v * Fk;   // a variant reads the golden sequence further on
    return [frac(i / Fk + (golden(2 * j) - 0.5) * jit * cell / n) * n, frac((i * Fk1) / Fk + (golden(2 * j + 1) - 0.5) * jit * cell / n) * n];
  });
}
/** Torus distance on a tile of side n. */
export const tdist = (ax, ay, bx, by, n) => { let dx = Math.abs(ax - bx) % n, dy = Math.abs(ay - by) % n; dx = Math.min(dx, n - dx); dy = Math.min(dy, n - dy); return Math.hypot(dx, dy); };
/** Nearest and second-nearest of the points to (x, y), wrapping: { f1, f2, i } (i the nearest's index). */
export function cellsOn(x, y, pts, n) {
  let f1 = Infinity, f2 = Infinity, i1 = 0;
  pts.forEach(([px, py], i) => { const d = tdist(x, y, px, py, n); if (d < f1) { f2 = f1; f1 = d; i1 = i; } else if (d < f2) f2 = d; });
  return { f1, f2, i: i1 };
}
/** A Truchet tile: distance from (x, y) to the nearer of two quarter arcs round opposite corners, at radius r. */
export function truchet(x, y, n, r) {
  return Math.min(Math.abs(Math.hypot(x, y) - r), Math.abs(Math.hypot(n - x, n - y) - r));
}
