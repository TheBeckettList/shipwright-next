// Pure. The sea: tide, waves, currents. Each is a function of place and tick only (no state), so
// each is reversible by construction: run the clock back and the sea is where it was.
//
//   tide      two bulges a day that run west round the globe with the sky (the Earth turns under
//             the moon: high water at longitude l when 2 l + 4 pi t / DAY = 0). The range grows over
//             shallow shelves. On the sky clock: a Minecraft day.
//   waves     the sea state the local wind raises: a fully developed height (Pierson-Moskowitz, the
//             Earth's numbers, carried in 1:1 in length), cut down where the fetch is short, made of
//             WAVE_COMPONENTS trains whose speeds obey deep-water dispersion under Minecraft's
//             gravity (w^2 = g k), so the waves move as everything else falls. Their phases and
//             spread come from the golden angle: the most even spread a sum can have.
//   currents  zonal bands (VISION.CURRENTS): the equatorial currents west, the counter-current
//             and the west wind drift east. East-west only, by latitude: that's the shape the big
//             ocean currents have, and it's what keeps a ship's step a pure shear (boat.js).
import { VISION, GIVEN, D } from "./given.js";
import { latOf, lonOf } from "./globe.js";
import { windAt } from "./wind.js";

const RAD = Math.PI / 180, TAU = 2 * Math.PI;                    // given
const GOLDEN = Math.PI * (3 - Math.sqrt(5));                      // given: the golden angle (radians)

/** How shallow a sea is, 0 (deep) to 1 (at the shore), from its depth in blocks. */
export const shelf = (depth) => Math.max(0, Math.min(1, 1 - depth / VISION.SHELF_DEPTH));

/** The tide's height (blocks, + above mean sea) at a world point, tick t, over water `depth` deep. */
export function tideAt(x, z, t, depth = VISION.SHELF_DEPTH) {
  const A = VISION.TIDE_RANGE * (1 + VISION.TIDE_SHELF * shelf(depth));
  return A * Math.cos((2 * TAU * t) / GIVEN.DAY + 2 * lonOf(x) * RAD);
}
/** The tide's rise (blocks a tick): what a narrow channel turns into a stream. */
export function tideRate(x, z, t, depth = VISION.SHELF_DEPTH) {
  const A = VISION.TIDE_RANGE * (1 + VISION.TIDE_SHELF * shelf(depth));
  return -A * ((2 * TAU) / GIVEN.DAY) * Math.sin((2 * TAU * t) / GIVEN.DAY + 2 * lonOf(x) * RAD);
}

/**
 * The sea state for a wind (m/s) over a fetch (blocks of open water upwind): significant height Hs
 * (blocks), peak wavelength (blocks) and period (ticks), as Minecraft's gravity moves them.
 */
export function seaState(wind, fetch = VISION.FETCH_FULL) {
  const full = (0.21 * wind * wind) / GIVEN.EARTH_G;             // given: Pierson-Moskowitz, Hs = 0.21 U^2 / g
  const grown = Math.sqrt(Math.min(1, fetch / VISION.FETCH_FULL)); // fetch-limited: height grows as sqrt(fetch)
  const Hs = full * grown * VISION.WAVE_SCALE;
  const Tp = (7.69 * wind) / GIVEN.EARTH_G;                       // given: PM peak period, s (Earth)
  const lambda = Math.max(1, (GIVEN.EARTH_G * Tp * Tp) / TAU * grown);   // metres = blocks (1:1)
  const k = TAU / lambda, omega = Math.sqrt(GIVEN.G * k);         // derived: deep-water dispersion, per tick
  return { Hs, lambda, k, omega, period: TAU / omega };
}

/** The trains of a sea state, blowing toward `toward` (radians, map bearing): [{ a, kx, kz, w, p }]. */
export function trains(state, toward) {
  const N = VISION.WAVE_COMPONENTS, out = [];
  const a = (state.Hs / 4) * Math.sqrt(2 / N);                    // given: Hs = 4 sigma, sigma^2 = sum a^2 / 2
  for (let i = 0; i < N; i++) {
    const spread = (((i * GOLDEN) % TAU) / TAU - 0.5) * VISION.WAVE_SPREAD * TAU;
    const scale = 1 + (i / Math.max(1, N - 1) - 0.5) * VISION.WAVE_BAND;   // a band of wavelengths round the peak
    const k = state.k * scale, dir = toward + spread;
    out.push({ a, kx: Math.sin(dir) * k, kz: -Math.cos(dir) * k, w: Math.sqrt(GIVEN.G * k), p: (i * GOLDEN) % TAU });
  }
  return out;
}
/** The sea's surface (blocks above the still water) at a world point and tick, for these trains. */
export const surface = (tr, x, z, t) => tr.reduce((h, c) => h + c.a * Math.cos(c.kx * x + c.kz * z - c.w * t + c.p), 0);

/** Waves here and now, from the wind here: { Hs, period, eta } (eta: the surface at this point). */
export function wavesAt(x, z, t, fetch = VISION.FETCH_FULL) {
  const w = windAt(x, z, t);
  const st = seaState(w.speed, fetch);
  const tr = trains(st, Math.atan2(w.e, -w.s));
  return { ...st, eta: surface(tr, x, z, t), trains: tr };
}

/** The current's east speed (blocks a tick) at a latitude band. */
export function currentEast(z) {
  const a = Math.abs(latOf(z));
  const band = VISION.CURRENTS.find(([top]) => a <= top) ?? VISION.CURRENTS.at(-1);
  return band[2] * D.MPS;
}

// ---------------------------------------------------------------- what the sea does to things

/** Minecraft's blast resistance of the common building materials: how hard each is to break, a given of the game. */
export const BLAST = Object.freeze({
  planks: 3, log: 2, bamboo: 3, cobblestone: 6, stone: 6, stone_bricks: 6, bricks: 6, deepslate: 6, tuff: 6, andesite: 6, mud_bricks: 3, packed_mud: 3,   // given: Minecraft's blast resistance
  sandstone: 0.8, calcite: 0.75, concrete: 1.8, hay: 0.5, moss: 0.1, snow: 0.1, packed_ice: 0.5, ice: 0.5, wool: 0.8, glass: 0.3, leather: 0.8, bone: 2,   // given: as above (leather as wool, bone as the bone block)
});
/** The blast resistance of a vanilla block id, by its material word (the weakest match, if several). */
export function blastOf(id) {
  const s = id.replace(/^minecraft:/, "");
  const hits = Object.entries(BLAST).filter(([k]) => s.includes(k)).map(([, v]) => v);
  return hits.length ? Math.min(...hits) : BLAST.planks;   // vision: unknown blocks stand like planks
}
/** The sea's energy a square metre (J): rho g Hs^2 / 16, the Earth's water at 1:1 metres. */
export const waveEnergy = (Hs) => (GIVEN.RHO_WATER * GIVEN.EARTH_G * Hs * Hs) / 16;   // given: linear wave theory
/** The tallest wave in a sea state of n waves (Rayleigh): Hs sqrt(ln n / 2). */
export const waveMax = (Hs, n = VISION.WAVES_SEEN) => Hs * Math.sqrt(Math.log(n) / 2);   // given: the Rayleigh distribution of wave heights
/** How high a wave runs up a shore of slope tan (Hunt: Iribarren's number times the height, capped where it surges). */
export function runup(H, tan, wavelength) {
  const xi = tan / Math.sqrt(Math.max(1e-6, H / wavelength));   // given: the surf similarity parameter
  return H * Math.min(xi, VISION.RUNUP_MAX);
}
/**
 * A wave's load on a wall at the water (kPa, Goda's simple form: about 1.2 rho g H, from the wave's   // vision: Goda's figure, as GODA (the comment quotes it)
 * height), against what the wall's material stands (its blast resistance times RESIST_KPA). Returns
 * the share of the structure a month of that sea wrecks, 0 while the load is under its strength.
 * exposure: 1 at the water, less behind a breakwater or up on piles.
 */
export function waveDamage(H, blast, exposure = 1) {
  const load = (VISION.GODA * GIVEN.RHO_WATER * GIVEN.EARTH_G * H) / 1000, resist = blast * VISION.RESIST_KPA;   // given: Pa to kPa
  return Math.max(0, Math.min(1, exposure * (load / resist - 1) * VISION.DAMAGE_RATE));
}
