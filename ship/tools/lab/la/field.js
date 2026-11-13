// Pure. The sim's arithmetic: small integer matrices, exact mod p (trits are p = 3), and the
// Seedworld line law they come from. Nothing here touches the game; the rest of the sim
// (frames.js, tempo.js, gates.js, build.js) and later the game can import it.
//
//   trit      -1 antimatter, 0 empty, +1 matter: the residues mod 3, written balanced
//   F         the golden 2x2 [[1,1],[1,0]]: the one law (Seedworld, 6d-to-1d-map)
//   order     the smallest k > 0 with M^k = I (mod p): a law's own tempo
//   pisano    the order of F mod n: how many ticks the golden law takes to come round mod n
//   line      the native universe: F on neighbouring pairs, brick-wall, on a Mobius loop

/** Balanced residue: x mod p, written in [-(p-1)/2, (p-1)/2] (trits: -1, 0, 1). */
export const bal = (x, p = 3) => {
  const r = ((x % p) + p) % p;
  return r > Math.floor(p / 2) ? r - p : r;
};

/** A matrix: rows of integers. Reduced mod p when p is given, exact integers otherwise. */
export const mat = (rows) => rows.map((r) => r.slice());
export const I = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const F = Object.freeze([[1, 1], [1, 0]]);

const red = (x, p) => (p ? bal(x, p) : x);

export function mul(A, B, p = null) {
  const n = A.length, m = B[0].length, k = B.length;
  const out = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    let s = 0;
    for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
    out[i][j] = red(s, p);
  }
  return out;
}
export const apply = (A, v, p = null) => A.map((row) => red(row.reduce((s, a, j) => s + a * v[j], 0), p));
export const eq = (A, B) => A.length === B.length && A.every((r, i) => r.length === B[i].length && r.every((x, j) => x === B[i][j]));
export const trace = (A, p = null) => red(A.reduce((s, r, i) => s + r[i], 0), p);
export const neg = (A, p = null) => A.map((r) => r.map((x) => red(-x, p)));
export function pow(A, k, p = null) {
  let out = I(A.length), b = A;
  for (let e = k; e > 0; e >>= 1) { if (e & 1) out = mul(out, b, p); b = mul(b, b, p); }
  return out;
}
/** Determinant (Laplace; the sim's matrices are small). */
export function det(A, p = null) {
  const n = A.length;
  if (n === 1) return red(A[0][0], p);
  if (n === 2) return red(A[0][0] * A[1][1] - A[0][1] * A[1][0], p);
  let s = 0;
  for (let j = 0; j < n; j++) {
    const minor = A.slice(1).map((r) => r.filter((_, c) => c !== j));
    s += (j % 2 ? -1 : 1) * A[0][j] * det(minor);
  }
  return red(s, p);
}
/** Kronecker product: the block law from two line laws (F (x) F is the 2D block, 6d-to-1d-map). */
export function kron(A, B, p = null) {
  const out = [];
  for (const ra of A) for (const rb of B) {
    const row = [];
    for (const a of ra) for (const b of rb) row.push(red(a * b, p));
    out.push(row);
  }
  return out;
}
/** The law's order mod p (Infinity if it doesn't come round within `cap`). */
export function order(A, p, cap = 10000) {
  const id = I(A.length);
  let M = A.map((r) => r.map((x) => bal(x, p)));
  for (let k = 1; k <= cap; k++) { if (eq(M, id)) return k; M = mul(M, A, p); }
  return Infinity;
}
/** Pisano period: the order of F mod n (any n >= 2). */
export const pisano = (n) => order(F, n);

export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a, b) => (a / gcd(a, b)) * b;
export const lcmAll = (xs) => xs.reduce((a, b) => lcm(a, b), 1);
export const divisors = (n) => { const d = []; for (let k = 1; k <= n; k++) if (n % k === 0) d.push(k); return d; };

// ---------------------------------------------------------------- the native line (Seedworld v9, layer 1)

/**
 * One tick of the line law: F on neighbouring pairs, brick-wall (even ticks pair 0-1, 2-3, ...; odd
 * ticks pair 1-2, 3-4, ..., and the last cell with the first across the seam). On a Mobius loop the
 * first cell is seen negated across the seam. L must be even. Returns a new array of trits.
 */
export function lineStep(x, t, { mobius = true, law = F } = {}) {
  const L = x.length, y = x.slice();
  const [[a, b], [c, d]] = law;
  for (let i = t % 2; i < L; i += 2) {
    const j = (i + 1) % L, seam = j === 0 && mobius ? -1 : 1;
    const u = x[i], v = seam * x[j];
    y[i] = bal(a * u + b * v);
    y[j] = bal(seam * (c * u + d * v));
  }
  return y;
}
/** The point: one +1 in an empty loop of L cells. */
export const point = (L) => { const x = new Array(L).fill(0); x[0] = 1; return x; };
/** Ticks until the line comes back to where it started (its breath), or Infinity past `cap`. */
export function breath(L, opts = {}, cap = 100000) {
  const x0 = opts.seed ?? point(L);
  let x = x0;
  for (let t = 0; t < cap; t++) {
    x = lineStep(x, t, opts);
    if (t % 2 === 1 && x.every((v, i) => v === x0[i])) return t + 1;
  }
  return Infinity;
}
/** Run a line and keep every state (for the viewer and the tempo lens). */
export function history(L, ticks, opts = {}) {
  let x = opts.seed ?? point(L);
  const out = [x];
  for (let t = 0; t < ticks; t++) { x = lineStep(x, t, opts); out.push(x); }
  return out;
}
