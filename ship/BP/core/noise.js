// Pure. Smooth value noise on the plane, for natural detail (a coast's ragged edge, gullies, lava
// lobes). Deterministic: a fixed integer hash, no seed: the same point always gives the same value.
const hash = (x, y, k) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1274126177);   // vision: the hash's odd constants
  h = Math.imul(h ^ (h >>> 13), 1274126177);   // vision: the hash's mixing
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;   // given: 2^32
};
/** The hash itself, in [0, 1): a value for each integer point (for choices made a block at a time). */
export const hashAt = (x, y, k = 0) => hash(Math.floor(x), Math.floor(y), k);
const sm = (t) => t * t * (3 - 2 * t);   // given: smoothstep
/** Value noise in [0, 1). */
export function vnoise(x, y, k = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
  const a = hash(xi, yi, k), b = hash(xi + 1, yi, k), c = hash(xi, yi + 1, k), d = hash(xi + 1, yi + 1, k);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
/** Fractal noise: octaves halve in strength and double in frequency. In [0, 1). */
export function fbm(x, y, k = 0, octaves = 4) {   // vision: four octaves unless asked
  let s = 0, a = 1, f = 1, n = 0;
  for (let o = 0; o < octaves; o++) { s += a * vnoise(x * f, y * f, k + o); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
/** Ridged noise: sharp crests where fbm crosses its middle (ridges, or turned over, gullies). In [0, 1]. */
export const ridged = (x, y, k = 0, octaves = 4) => 1 - Math.abs(2 * fbm(x, y, k, octaves) - 1);   // vision: four octaves unless asked
export const smoothstep = (a, b, x) => sm(Math.max(0, Math.min(1, (x - a) / (b - a))));
// Gradient noise (Perlin's), for ground: value noise shows its lattice when it carries large relief; a gradient at each
// lattice point, from a fully mixed hash, doesn't. In [-1, 1] (about); smooth to the second derivative (quintic fade).
const mix = (x, y, k) => {
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(k + 0x9e3779b9, 0x85ebca6b)) >>> 0;   // vision: the hash's odd constants
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;   // vision: the mixing rounds (a murmur finaliser's shape)
  return (h >>> 0) / 4294967296;   // given: 2^32
};
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);   // given: Perlin's quintic
const grad = (xi, yi, k, dx, dy) => { const a = mix(xi, yi, k) * 2 * Math.PI; return Math.cos(a) * dx + Math.sin(a) * dy; };
/** Gradient noise in about [-1, 1]. */
export function gnoise(x, y, k = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fade(fx), v = fade(fy);
  const a = grad(xi, yi, k, fx, fy), b = grad(xi + 1, yi, k, fx - 1, fy), c = grad(xi, yi + 1, k, fx, fy - 1), d = grad(xi + 1, yi + 1, k, fx - 1, fy - 1);
  return Math.SQRT2 * ((a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v);   // derived: the root of two brings its range out to about one
}
