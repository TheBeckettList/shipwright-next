// Pure. Boatblock's sea laws (the Boatblock doc's laws 2, 4 and 5), in the limits' units (limits.js):
//   tide      two highs a Minecraft day; the range grows over shelves; the phase sweeps across the
//             world, so neighbouring groups are minutes apart. Where the bed lies one block under the
//             sea, low water uncovers it: the flats, whose sand, gravel or clay the tide lays again
//             every ebb (mined, it washes back in, so a flat is a slow, honest source).
//   waves     a storm's sea, carried in by Froude: the real fully developed or fetch-limited height,
//             in blocks for a hull of one block a metre. Loose things on a raft's edge go over the
//             side when the waves top its freeboard; a breakwater raises the freeboard behind it.
//   reefs     coral spreads over sand in warm, shallow, lit water; sand caught between corals builds
//             up, a layer at a time, toward the surface. Cold seas barely grow.
import { hash, rand } from "./noise.js";
import { columnAt } from "./lattice.js";
import { BIOMES } from "./biomes.js";
import { tideLaw, mapScale, EARTH } from "./limits.js";
import { POLE } from "./fields.js";

const SEA = 62;                           // given: the sea's level (terrain.js)

/** Vision numbers for the sea laws. */
export const SEA_LAWS = Object.freeze({
  range: 0.6,            // vision: the tide's range either way in open water (blocks)
  shelfGain: 1.5,        // vision: how much a shelf raises it (a full shelf: 2.5 times)
  lagoon: 1 / 3,         // vision: an atoll lagoon's damping
  sweep: 6000,           // vision: the tide's wavelength across the world (blocks)
  ebb: -0.5,             // derived: below this the top water block over a flat is gone (half a block)
  wind: 12,              // vision: m/s of wind for a wind field strength of 1 (force 6)
  wash: 0.5,             // vision: the most a wave group takes of what's loose on an exposed edge
  breakwater: 3,         // vision: the freeboard a wall adds behind it (blocks)
  reef: 0.5,             // vision: coral's spread a day onto touching sand, in warm, shallow water
  reefWarm: [0.45, 0.75],// vision: the heat at which reefs start growing, and grow fully
  light: 3,              // vision: the depth over which light (and growth) falls off by e
});

/** The tide's height here, now (blocks; t in ticks). */
export function tideAt(seed, x, z, t) {
  const c = columnAt(seed, x, z);
  const A = SEA_LAWS.range * (1 + SEA_LAWS.shelfGain * (c.shelf ?? (c.land ? 1 : 0))) * (c.lagoon ? SEA_LAWS.lagoon : 1);
  const b = rand(seed, 901) * Math.PI * 2;   // given: hash salt
  const phase = (2 * Math.PI * (x * Math.cos(b) + z * Math.sin(b))) / SEA_LAWS.sweep;
  return tideLaw(A, phase, t);
}

/** Whether the tide is out here (the flats show). */
export const lowWater = (seed, x, z, t) => tideAt(seed, x, z, t) < SEA_LAWS.ebb;

/** A flat: sea bed lying one block under the sea. */
export const isFlat = (c) => !c.land && c.top === SEA - 1;

/** What a flat's top is made of: its sea's bed, with clay in the cooler shallows. */
export function flatBlock(seed, x, z, c) {
  const B = BIOMES[c.biome] ?? {};
  if ((B.family === "temperate" || B.family === "boreal") && hash(x, z, seed, 902) % 5 === 0) return "minecraft:clay";   // given: hash salt
  return B.bed ?? "minecraft:sand";
}

/** A storm's waves in blocks: the real sea for wind U (m/s) over fetch F (blocks, on the map scale). */
export function waveHeight(U, fetch) {
  const g = EARTH.G, F = fetch * mapScale(POLE);
  const developed = (0.21 * U * U) / g;           // given: the fully developed sea (Pierson-Moskowitz)
  const limited = 0.0016 * U * Math.sqrt(F / g);   // given: the fetch-limited sea (JONSWAP)
  return Math.min(developed, limited);
}

/** The chance a wave group takes a loose thing off an edge of freeboard f (law 4). */
export const washChance = (H, f) => (H <= 0 ? 0 : SEA_LAWS.wash * Math.max(0, H - f) / H);

/** Coral's spread a day onto touching sand at this heat and depth (law 5). */
export function reefRate(heat, depth) {
  const [a, b] = SEA_LAWS.reefWarm;
  const warm = Math.min(1, Math.max(0, (heat - a) / (b - a)));
  return SEA_LAWS.reef * warm * Math.exp(-depth / SEA_LAWS.light);
}
