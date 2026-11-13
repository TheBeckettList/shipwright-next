// Pure. The ground of the sea world: open ocean with archipelagos (clusters, chains, atolls in warm
// water, volcanoes over hot spots, the odd mushroom isle far from anyone), now and then a great
// island, shelves and reefs around them. Climate is not decided here: it comes from the base fields
// (fields.js) and the biomes (biomes.js) read it.
//
//   elevation(seed, x, z)  -> { top, land, depth, shelf, group, special, crater }
//   place(seed, x, z)      -> elevation + { h, m, biome, coast }      (everything a column needs)
//   climate(seed, x, z)    -> { key (family), t, m, biome }
//   groupsNear(seed, x, z) -> the island groups whose reach covers a place
import { hash, rand, fbm, clamp, smoothstep, lerp } from "./noise.js";
import { seaHeat, heatAt, moisture, latitude } from "./fields.js";
import { BIOMES, landBiome, seaBiome, plantAt } from "./biomes.js";
import { sinkAt } from "./reach.js";

export const SEA_LEVEL = 62;          // the top water block
export const FLOOR_MIN = 16;          // the world's bottom: bedrock here, nothing below
export const GROUP_CELL = 640;        // one island group, at most, per cell this size
export const GREAT_CELL = 2304;       // one great island, at most, per cell this size

// Groups never change, and every column asks for the nine round it: kept (a bounded cache).
const groupCache = new Map(), greatCache = new Map(), nearCache = new Map();
function remember(cache, key, make, cap = 4096) {
  let v = cache.get(key);
  if (v === undefined) {
    v = make();
    cache.set(key, v);
    if (cache.size > cap) cache.delete(cache.keys().next().value);
  }
  return v;
}

/** The island group a cell holds (or null): where, how big, what kind. */
export function groupAt(seed, gx, gz) {
  return remember(groupCache, `${seed}|${gx},${gz}`, () => makeGroup(seed, gx, gz));
}
function makeGroup(seed, gx, gz) {
  // groups gather into archipelago regions with open ocean between them
  const region = fbm(gx * GROUP_CELL / 5200, gz * GROUP_CELL / 5200, seed + 17, 2);
  const chance = 0.9 * smoothstep(0.36, 0.62, region);
  if (rand(gx, gz, seed, 11) > chance) return null;
  const cx = (gx + 0.2 + 0.6 * rand(gx, gz, seed, 12)) * GROUP_CELL;
  const cz = (gz + 0.2 + 0.6 * rand(gx, gz, seed, 13)) * GROUP_CELL;
  const k = rand(gx, gz, seed, 14);
  const h = seaHeat(seed, cx, cz);
  const sp = rand(gx, gz, seed, 18);
  // hot spots raise volcanoes (more often in the tropics); a mild, out-of-the-way group may be a mushroom isle
  const special = sp < 0.04 + 0.05 * h ? "volcano" : sp > 0.965 && h > 0.35 && h < 0.75 ? "mushroom" : null;
  const kind = special === "volcano" ? "cluster" : h > 0.68 && k < 0.3 ? "atoll" : k < 0.55 ? "chain" : "cluster";
  const R = kind === "atoll" ? 70 + 50 * rand(gx, gz, seed, 15) : special === "volcano" ? 90 + 60 * rand(gx, gz, seed, 15) : 110 + 150 * rand(gx, gz, seed, 15);
  const angle = rand(gx, gz, seed, 16) * Math.PI;
  return { id: `g${gx},${gz}`, gx, gz, x: cx, z: cz, R, kind, angle, stretch: kind === "chain" ? 2.4 : 1, great: false, special };
}

/** The great island a big cell holds (or null). */
export function greatAt(seed, gx, gz) {
  return remember(greatCache, `${seed}|${gx},${gz}`, () => makeGreat(seed, gx, gz));
}
function makeGreat(seed, gx, gz) {
  if (rand(gx, gz, seed, 21) > 0.35) return null;
  const x = (gx + 0.25 + 0.5 * rand(gx, gz, seed, 22)) * GREAT_CELL;
  const z = (gz + 0.25 + 0.5 * rand(gx, gz, seed, 23)) * GREAT_CELL;
  return { id: `G${gx},${gz}`, gx, gz, x, z, R: 260 + 260 * rand(gx, gz, seed, 24), kind: "great", angle: rand(gx, gz, seed, 25) * Math.PI, stretch: 1.5, great: true, special: null };
}

/** The groups (and great islands) whose reach could cover a place. */
export function groupsNear(seed, x, z) {
  const gx = Math.floor(x / GROUP_CELL), gz = Math.floor(z / GROUP_CELL);
  const Gx0 = Math.floor(x / GREAT_CELL), Gz0 = Math.floor(z / GREAT_CELL);
  return remember(nearCache, `${seed}|${gx},${gz}|${Gx0},${Gz0}`, () => gatherNear(seed, x, z), 1024);
}
function gatherNear(seed, x, z) {
  const out = [];
  const gx = Math.floor(x / GROUP_CELL), gz = Math.floor(z / GROUP_CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const g = groupAt(seed, gx + i, gz + j);
    if (g) out.push(g);
  }
  const Gx = Math.floor(x / GREAT_CELL), Gz = Math.floor(z / GREAT_CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const g = greatAt(seed, Gx + i, Gz + j);
    if (g) out.push(g);
  }
  return out;
}

/** How strongly a group shapes a place: 1 at its heart, 0 beyond its reach (chains are long and thin). */
export function reach(g, x, z) {
  const dx = x - g.x, dz = z - g.z;
  const c = Math.cos(g.angle), s = Math.sin(g.angle);
  const a = (dx * c + dz * s) / g.stretch, b = (-dx * s + dz * c) * (g.stretch > 1 ? 1.15 : 1);
  const d = Math.hypot(a, b) / (g.R * (g.great ? 1.5 : 1.35));
  return clamp(1 - d, 0, 1);
}

/**
 * The ground at a place. Ocean is the rule: 22 to 34 deep, with shelves rising to a few blocks deep
 * around island groups, reefs at their edges, and land where the group's noise breaks the surface.
 * A volcano is a cone with a lava crater; its lava ran into the sea and set as obsidian at the shore.
 */
export function elevation(seed, x, z) {
  const deep = 22 + 12 * fbm(x / 420, z / 420, seed + 3, 2);
  let I = 0, owner = null, atoll = 0;
  for (const g of groupsNear(seed, x, z)) {
    const r = reach(g, x, z);
    if (g.kind === "atoll" && r > 0) {
      const d = 1 - r;                                       // 0 at the heart
      atoll = Math.max(atoll, clamp(1 - Math.abs(d - 0.42) * 7, 0, 1) * smoothstep(0, 0.2, r));
    }
    if (r > I) { I = r; owner = g; }
  }
  const n = fbm(x / 70, z / 70, seed + 7, 4);                // the islands' own outline
  const ridge = fbm(x / 26, z / 26, seed + 9, 2);            // smaller bays and points
  const special = owner?.special ?? null;
  let land;
  if (owner?.kind === "atoll") land = atoll * 0.55 + (n - 0.5) * 0.35 - 0.3;
  else if (special === "volcano") land = I * 1.35 + (n - 0.5) * 0.4 - 0.62;
  else land = I * (owner?.great ? 1.1 : 0.95) + (n - 0.5) * 0.95 + (ridge - 0.5) * 0.18 - 0.58;
  const shelf = smoothstep(0.0, 0.55, I);
  if (land > 0) {
    let hill = land * (owner?.great ? 70 : 42) * (0.6 + 0.8 * fbm(x / 140, z / 140, seed + 5, 2));
    let crater = false;
    if (special === "volcano") {
      hill = land * 70;                                       // a steep cone
      if (I > 0.86) { hill -= (I - 0.86) * 140; crater = true; }
    }
    const top = SEA_LEVEL + 1 + Math.floor(Math.min(hill, owner?.great || special === "volcano" ? 46 : 26));
    // the Drowned Reach (reach.js): the ground lowered; what sinks below the sea is a bar or a shoal
    const s = owner?.great || special === "volcano" ? 0 : sinkAt(seed, x, z);
    if (s > 0) {
      const sunk = Math.round(top - s);
      if (sunk <= SEA_LEVEL) {
        let depth = Math.max(1, SEA_LEVEL - sunk);
        if (depth <= 3) depth = 1;                             // the sea planes a drowned island's shoulders into bars   // vision: bar depth
        return { top: SEA_LEVEL - depth, land: false, depth, shelf: 1, group: owner?.id ?? null, I, special, lagoon: false, nearShore: true, drowned: true };
      }
      return { top: sunk, land: true, depth: 0, shelf, group: owner?.id ?? null, I, special, crater, atoll: false };
    }
    return { top, land: true, depth: 0, shelf, group: owner?.id ?? null, I, special, crater, atoll: false };
  }
  // in the water: the shelf around a group, a reef rim just off its shores, an atoll's lagoon
  let depth = lerp(deep, 3 + 6 * fbm(x / 90, z / 90, seed + 4, 2), shelf);
  if (land > -0.07) depth = Math.min(depth, 1 + Math.floor((-land / 0.07) * 3));      // reef and beach shallows
  const lagoon = owner?.kind === "atoll" && I > 0.6;
  if (lagoon) depth = Math.min(depth, 3 + 3 * fbm(x / 30, z / 30, seed + 6, 2));
  depth = Math.max(1, Math.round(depth));
  return { top: SEA_LEVEL - depth, land: false, depth, shelf, group: owner?.id ?? null, I, special, lagoon, nearShore: land > -0.12 };
}

// a coarse cache of tops for the rain-shadow look upwind (many columns ask the same few points)
const tops = new Map();
function topAt(seed, x, z) {
  const gx = Math.round(x / 8) * 8, gz = Math.round(z / 8) * 8;
  const k = `${seed}|${gx},${gz}`;
  let t = tops.get(k);
  if (t === undefined) {
    t = elevation(seed, gx, gz).top;
    tops.set(k, t);
    if (tops.size > 20000) tops.delete(tops.keys().next().value);
  }
  return t;
}

/** Everything a column needs: its ground, heat, moisture, biome, and whether it's shore. */
export function place(seed, x, z, e = elevation(seed, x, z)) {
  if (!e.land) {
    const h = seaHeat(seed, x, z);
    return { ...e, h, m: 1, biome: seaBiome(h, e.depth, e.lagoon, x, z, seed), coast: false };
  }
  const h = heatAt(seed, x, z, e.top);
  const m = moisture(seed, x, z, e.top, (ux, uz) => topAt(seed, ux, uz));
  const coast = e.top <= SEA_LEVEL + 2;
  return { ...e, h, m, biome: landBiome(h, m, e.top - SEA_LEVEL, coast, e.special, fbm(x / 160, z / 160, seed + 261, 2)), coast };
}

/** The broad climate (family) at a place, as older code asks for it. */
export function climate(seed, x, z) {
  const p = place(seed, x, z);
  return { key: BIOMES[p.biome].family, t: p.h, m: p.m, biome: p.biome };
}
export const climateT = (seed, x, z) => seaHeat(seed, x, z);

/** The broad climates, for maps and tables. */
export const CLIMATES = { polar: {}, boreal: {}, temperate: {}, dry: {}, arid: {}, savanna: {}, tropical: {}, wet: {} };

/** What a land column is made of, top down. */
export function surfaceOf(seed, x, z, e, p = place(seed, x, z, e)) {
  const B = BIOMES[p.biome];
  return { climate: B.family, biome: p.biome, top: B.top, sub: B.sub, beach: p.coast, snow: !!B.snow };
}

/** Whether a tree stands here, and which (deterministic; trunks never closer than 3). */
export function treeAt(seed, x, z, e, p = null) {
  if (!e.land || e.top <= SEA_LEVEL + 1) return null;
  const cell = 3;
  const tx = Math.floor(x / cell), tz = Math.floor(z / cell);
  const ox = hash(tx, tz, seed, 51) % cell, oz = hash(tx, tz, seed, 52) % cell;
  if (x !== tx * cell + ox || z !== tz * cell + oz) return null;
  p = p ?? place(seed, x, z, e);
  const B = BIOMES[p.biome];
  if (!B.density || !B.trees?.length) return null;
  const grove = fbm(x / 60, z / 60, seed + 53, 2);                       // trees stand in groves
  if (rand(x, z, seed, 54) > B.density * 9 * smoothstep(0.3, 0.72, grove)) return null;
  const total = B.trees.reduce((a, [, w]) => a + w, 0);
  let r = (hash(x, z, seed, 55) % 1000) / 1000 * total;
  let kind = B.trees[0][0];
  for (const [k, w] of B.trees) { if (r < w) { kind = k; break; } r -= w; }
  return { kind, h: 4 + (hash(x, z, seed, 56) % 3) + (p.biome === "jungle" || p.biome === "old_growth" ? 3 : 0) };
}

export { plantAt, latitude };
