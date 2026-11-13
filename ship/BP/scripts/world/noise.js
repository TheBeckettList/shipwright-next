// Pure. Deterministic randomness for the world: an integer hash, smooth value noise and fractal
// noise. Everything about the sea world is a function of the world seed and a place, so any part of
// it can be worked out again anywhere, in any order, by the game or by the lab.

/** A 32-bit hash of integers (any count). */
export function hash(...n) {
  let h = 0x811c9dc5 | 0;
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  h = Math.imul(h ^ (h >>> 16), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
/** A number in [0, 1) from integers. */
export const rand = (...n) => hash(...n) / 4294967296;

const smooth = (t) => t * t * (3 - 2 * t);

/** Value noise in [0, 1) at a point, on a unit lattice. */
export function value2(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = rand(ix, iz, seed), b = rand(ix + 1, iz, seed), c = rand(ix, iz + 1, seed), d = rand(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal noise in [0, 1): octaves of value noise, each half the size and weight. */
export function fbm(x, z, seed, octaves = 3) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += value2(x * f, z * f, seed + o * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const smoothstep = (a, b, v) => smooth(clamp((v - a) / (b - a), 0, 1));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Value noise in [0, 1) in three dimensions (caves). */
export function value3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const c = (a, b, d) => rand(ix + a, iy + b, iz + d, seed);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * fx, x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * fx;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * fx, x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * fx;
  const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}
