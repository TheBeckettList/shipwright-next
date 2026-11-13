// Pure. The one law and its arithmetic (Seedworld; project docs seedworld-findings and
// 6d-to-1d-map): trits mod 3, the golden 2x2 F, brick-wall on a Mobius loop. The rest of the world
// borrows its tempo and its texture from it: gusts are the trit line (wind.js), beats are its
// periods (tempo.js), and the poles' fold is its lost sign (globe.js).
export const bal = (x, p = 3) => { const r = ((x % p) + p) % p; return r > Math.floor(p / 2) ? r - p : r; };   // given: trits are residues mod 3
export const F = Object.freeze([[1, 1], [1, 0]]);
export const I2 = Object.freeze([[1, 0], [0, 1]]);
const red = (x, p) => (p ? bal(x, p) : x);

export function mul(A, B, p = null) {
  return A.map((row) => B[0].map((_, j) => red(row.reduce((s, a, t) => s + a * B[t][j], 0), p)));
}
export const eq = (A, B) => A.length === B.length && A.every((r, i) => r.every((x, j) => x === B[i][j]));
export const det2 = (A) => A[0][0] * A[1][1] - A[0][1] * A[1][0];
export function kron(A, B, p = null) {
  const out = [];
  for (const ra of A) for (const rb of B) out.push(ra.flatMap((a) => rb.map((b) => red(a * b, p))));
  return out;
}
const id = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
/** The law's order mod p: its own tempo. */
export function order(A, p, cap = 1e4) {   // vision: a search cap, not a property of anything
  let M = A.map((r) => r.map((x) => bal(x, p)));
  for (let k = 1; k <= cap; k++) { if (eq(M, id(A.length))) return k; M = mul(M, A, p); }
  return Infinity;
}
/** Pisano period: ticks the golden law takes to come round mod n. */
export const pisano = (n) => order(F, n);
export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a, b) => (a / gcd(a, b)) * b;

/** One tick of the line: F on neighbouring pairs, brick-wall; across a Mobius seam the far cell is negated. */
export function lineStep(x, t, mobius = true) {
  const L = x.length, y = x.slice();
  for (let i = t % 2; i < L; i += 2) {
    const j = (i + 1) % L, seam = j === 0 && mobius ? -1 : 1;
    const u = x[i], v = seam * x[j];
    y[i] = bal(u + v);
    y[j] = bal(seam * u);
  }
  return y;
}
/** Its exact inverse: F^-1 = [[0,1],[1,-1]] on the same pairs. */
export function lineUnstep(y, t, mobius = true) {
  const L = y.length, x = y.slice();
  for (let i = t % 2; i < L; i += 2) {
    const j = (i + 1) % L, seam = j === 0 && mobius ? -1 : 1;
    const a = y[i], b = seam * y[j];
    x[i] = bal(b);
    x[j] = bal(seam * (a - b));
  }
  return x;
}
export const point = (L) => Array.from({ length: L }, (_, i) => +(i === 0));
/** Every state of one breath from the point (a Mobius loop of even L breathes in 2L ticks). */
export function breathTable(L) {
  const rows = [point(L)];
  for (let t = 0; t < 2 * L - 1; t++) rows.push(lineStep(rows.at(-1), t));
  return rows;
}
export function breath(L, mobius = true, cap = 1e6) {   // vision: a search cap
  let x = point(L);
  for (let t = 0; t < cap; t++) { x = lineStep(x, t, mobius); if (t % 2 && x.every((v, i) => v === +(i === 0))) return t + 1; }
  return Infinity;
}
