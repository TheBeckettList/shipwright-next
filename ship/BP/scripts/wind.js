import { biomeAt, worldSeed } from "./seaworld.js";
import { windField } from "./world/fields.js";
import { elevation } from "./world/terrain.js";
import { SEA_DIM } from "./dims.js";
import { windAt as coreWind } from "../core/wind.js";
import { VISION } from "../core/given.js";
// Wind from the world's biomes, plus sail physics. Two small tables:
//   1. BIOMES: every biome falls into one of 5 temperature classes and 3 surfaces.
//   2. RIGS: every sail falls into one of 2 families with its own points of sail.
//
// The world is split into 64-block wind cells. Air flows from cooler cells toward
// warmer neighbours, bent 60 degrees (our stand-in for the planet's spin) so it forms
// steady lanes, on top of a light prevailing easterly. Water lets it run; mountains
// smother it. The field is the same every time for a given world, so routes can be learned.

// ---------- table 1: biomes ----------

// Checked in order; the first keyword found in the biome id wins.
const TEMPERATURE = [
  ["hot", 4, ["desert", "savanna", "badlands", "eroded"]],
  ["cold", 0, ["frozen", "snowy", "ice", "jagged"]],
  ["warm", 3, ["jungle", "warm_ocean", "lukewarm", "swamp", "mangrove", "bamboo"]],
  ["cool", 1, ["taiga", "cold_ocean", "grove", "windswept", "old_growth", "stony"]],
];
const TEMPERATE = 2;
const SURFACES = [
  ["water", 1.0, ["ocean", "river", "beach"]],
  ["rough", 0.25, ["peaks", "mountain", "hills", "plateau", "slopes", "windswept"]],
];
const LAND_STRENGTH = 0.6;

export function classifyBiome(id = "") {
  const s = String(id).toLowerCase();
  let temp = TEMPERATE;
  for (const [, t, words] of TEMPERATURE) if (words.some((w) => s.includes(w))) { temp = t; break; }
  let surface = LAND_STRENGTH;
  for (const [, k, words] of SURFACES) if (words.some((w) => s.includes(w))) { surface = k; break; }
  return { temp, surface };
}

// ---------- table 2: rigs ----------

// Points of sail: sail power by angle off the wind (0 = wind dead behind, 180 = wind dead ahead).
export const RIGS = {
  square: [[0, 1.0], [45, 0.95], [90, 0.7], [110, 0.35], [120, 0]],        // best running before the wind
  fore_and_aft: [[0, 0.8], [45, 0.9], [90, 1.0], [135, 0.55], [145, 0]],  // lateen, crab claw, junk: closer to the wind
};

export function sailPower(rig, angleOffWind) {
  const table = RIGS[rig] ?? RIGS.square;
  const a = Math.min(180, Math.abs(angleOffWind));
  for (let i = 1; i < table.length; i++) {
    const [a1, p1] = table[i];
    if (a <= a1) {
      const [a0, p0] = table[i - 1];
      return p0 + ((p1 - p0) * (a - a0)) / (a1 - a0);
    }
  }
  return 0;
}

/** The angle off the wind (0 = dead downwind, 180 = head to wind) where a rig drives hardest. */
export function bestAngle(rig) {
  let best = 90, power = -1;
  for (let a = 0; a <= 180; a += 1) {
    const p = sailPower(rig, a);
    if (p > power) { power = p; best = a; }
  }
  return best;
}

/**
 * What the telltales show: 0 streaming (at the rig's best angle), negative when pinching (too
 * close to the wind), positive when too far off (the sail stalls). Clamped to -1..1.
 */
export function telltale(rig, angleOff) {
  // angleOff runs from 0 (dead downwind) to 180 (head to wind): above the best angle is pinching.
  return Math.max(-1, Math.min(1, (bestAngle(rig) - Math.abs(angleOff)) / 45));
}

// ---------- the wind field ----------

const CELL = 64;
const PREVAILING = { x: -0.35, z: 0 };   // a light easterly everywhere (blowing toward -x)
const GRADIENT_GAIN = 0.22;
const DEFLECT = (60 * Math.PI) / 180;
const MAX_STRENGTH = 1.4;
const cells = new Map();

function sampleCell(dim, cx, cz) {
  const key = `${dim.id}:${cx},${cz}`;
  let c = cells.get(key);
  if (c) return c;
  let id = "minecraft:ocean";
  try {
    id = biomeAt(dim, { x: cx * CELL + CELL / 2, y: 63, z: cz * CELL + CELL / 2 });
  } catch {
    /* unloaded or unsupported: treat as open temperate sea */
  }
  c = classifyBiome(id);
  c.id = id;
  cells.set(key, c);
  if (cells.size > 4096) cells.delete(cells.keys().next().value);
  return c;
}

/** Wind at a cell as { x, z } in blocks-per-tick-ish units (magnitude 0..1.4). */
export function windAtCell(dim, cx, cz) {
  const here = sampleCell(dim, cx, cz);
  let gx = 0, gz = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const d = sampleCell(dim, cx + dx, cz + dz).temp - here.temp;  // positive = warmer neighbour
    gx += d * dx;
    gz += d * dz;
  }
  // Bend the cool-to-warm flow so it forms lanes and loops instead of pointing at the nearest desert.
  const rx = gx * Math.cos(DEFLECT) - gz * Math.sin(DEFLECT);
  const rz = gx * Math.sin(DEFLECT) + gz * Math.cos(DEFLECT);
  let x = (PREVAILING.x + GRADIENT_GAIN * rx) * here.surface;
  let z = (PREVAILING.z + GRADIENT_GAIN * rz) * here.surface;
  const m = Math.hypot(x, z);
  if (m > MAX_STRENGTH) { x *= MAX_STRENGTH / m; z *= MAX_STRENGTH / m; }
  return { x, z };
}

// Sea breezes: a water cell next to land gets wind toward the land by day, away from it by night.
const BREEZE = 0.3;
export function seaBreeze(dim, cx, cz, timeOfDay) {
  const here = sampleCell(dim, cx, cz);
  if (here.surface !== 1.0) return { x: 0, z: 0 };   // only over water
  let bx = 0, bz = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (sampleCell(dim, cx + dx, cz + dz).surface !== 1.0) { bx += dx; bz += dz; }
  }
  const m = Math.hypot(bx, bz);
  if (!m) return { x: 0, z: 0 };
  const day = timeOfDay >= 0 && timeOfDay < 12000 ? 1 : -1;
  return { x: (bx / m) * BREEZE * day, z: (bz / m) * BREEZE * day };
}

/** Gusts: strength breathes over a few seconds, out of step from one cell to the next. */
export function gustFactor(cx, cz, tick) {
  return 1 + 0.22 * Math.sin(tick / 37 + cx * 1.7) * Math.sin(tick / 91 + cz * 2.3 + 1);
}

// Waterworld's wind (core/wind.js): the planet's belts and the golden gusts, in m/s, as Shipwright's strengths
// (the strongest belt at MAX_STRENGTH). The overworld is Waterworld's globe, so its wind is the one the helm feels.
const BELT_TOP = Math.max(...VISION.BELTS.map((b) => b[2]));
let WATERWORLD = false;
/** Waterworld's main.js turns this on: its overworld is the globe, so the helm takes the globe's wind (off, as in
 *  Shipwright's own tests, the overworld keeps the biome cells' wind). */
export const useWaterworldWind = (on = true) => { WATERWORLD = on; };
export function waterworldWind(loc, tick = 0) {
  const w = coreWind(loc.x, loc.z, tick), k = MAX_STRENGTH / BELT_TOP;
  return { x: w.e * k, z: w.s * k, belt: w.belt, speed: w.speed };
}
export function windAt(dim, loc, tick = 0, timeOfDay = 6000) {
  const cx = Math.floor(loc.x / CELL), cz = Math.floor(loc.z / CELL);
  if (dim?.id === SEA_DIM) return seaWorldWind(loc, tick, timeOfDay);
  if (WATERWORLD && (!dim || dim.id === "minecraft:overworld")) return waterworldWind(loc, tick);
  const base = windAtCell(dim, cx, cz);
  const breeze = seaBreeze(dim, cx, cz, timeOfDay);
  const g = gustFactor(cx, cz, tick);
  return { x: (base.x + breeze.x) * g, z: (base.z + breeze.z) * g };
}

/**
 * The sea world's wind: the planet's belts, weather and storms (world/fields.js), with a sea breeze
 * toward the nearest land by day (off it by night) within 48 blocks of a shore.
 */
export function seaWorldWind(loc, tick = 0, timeOfDay = 6000) {
  const seed = worldSeed();
  const w = windField(seed, loc.x, loc.z, tick);
  let bx = 0, bz = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
    for (let r = 12; r <= 48; r += 12) if (elevation(seed, loc.x + dx * r, loc.z + dz * r).land) { bx += dx * (60 - r) / 48; bz += dz * (60 - r) / 48; break; }
  }
  const m = Math.hypot(bx, bz);
  const day = timeOfDay >= 0 && timeOfDay < 12000 ? 1 : -1;
  if (m) { w.x += (bx / m) * BREEZE * Math.min(1, m) * day; w.z += (bz / m) * BREEZE * Math.min(1, m) * day; }
  const g = gustFactor(Math.floor(loc.x / CELL), Math.floor(loc.z / CELL), tick) * (1 + w.storm * 0.4 * Math.sin(tick / 7));
  return { x: w.x * g, z: w.z * g, storm: w.storm, belt: w.belt };
}

// ---------- coast and open sea ----------
//
// The cell wind is the weather; what a boat feels depends on what's around it. Out at sea the wind
// runs clean and a little stronger (nothing slows it). Under a weather shore (land upwind) it's
// sheltered: weaker, puffy, and it shifts as it comes round headlands. Exposure is measured from
// the boat: how far the water runs in eight directions (a 32-block look, every 4 blocks).

const REACH = 32, STEP = 4;
export const RAYS = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 4), z: Math.sin((i * Math.PI) / 4) }));

/** How open the water is around a point: { open 0..1, fetch: [blocks of water along each ray] }. */
export function exposureAt(dim, loc) {
  const y = Math.floor(loc.y);
  const fetch = RAYS.map((r) => {
    for (let d = STEP; d <= REACH; d += STEP) {
      try {
        const b = dim.getBlock({ x: Math.floor(loc.x + r.x * d), y, z: Math.floor(loc.z + r.z * d) });
        if (b && !/water/.test(b.typeId)) return d - STEP;
      } catch {
        return REACH;                                       // unloaded: assume the sea goes on
      }
    }
    return REACH;
  });
  return { open: fetch.reduce((a, d) => a + d, 0) / (REACH * RAYS.length), fetch };
}

/**
 * The wind a boat feels, from the cell wind and its exposure (pure). Sheltered by land upwind
 * (down to 35% close under it), up to 15% stronger on open water; near land it puffs and veers.
 */
export function localWind(base, exposure, tick = 0) {
  if (!exposure) return base;
  const m = Math.hypot(base.x, base.z);
  if (m < 1e-6) return base;
  // the ray pointing upwind (where the wind comes from)
  const from = { x: -base.x / m, z: -base.z / m };
  let best = 0, dot = -2;
  RAYS.forEach((r, i) => { const d = r.x * from.x + r.z * from.z; if (d > dot) { dot = d; best = i; } });
  const shelter = Math.max(0.35, Math.min(1, exposure.fetch[best] / 24));
  const open = exposure.open;
  const gust = 1 + (0.08 + 0.25 * (1 - open)) * Math.sin(tick / 23) * Math.sin(tick / 61 + 1);
  const k = shelter * (0.85 + 0.3 * open) * gust;
  const veer = ((1 - open) * 18 * Math.PI) / 180 * Math.sin(tick / 53);
  const c = Math.cos(veer), s = Math.sin(veer);
  return { x: (base.x * c - base.z * s) * k, z: (base.x * s + base.z * c) * k };
}

// ---------- words for the action bar ----------

export function describeWind(wind, heading) {
  const m = Math.hypot(wind.x, wind.z);
  const strength = m < 0.15 ? "calm" : m < 0.35 ? "light air" : m < 0.6 ? "gentle breeze" : m < 0.9 ? "fresh breeze" : m < 1.15 ? "strong breeze" : "near gale";
  if (m < 0.15) return strength;
  const off = angleOffWind(wind, heading);
  const where = off < 30 ? "behind you" : off < 70 ? "on the quarter" : off < 110 ? "on the beam" : off < 150 ? "forward of the beam" : "dead ahead";
  return `${strength} ${where}`;
}

/** 0 = wind dead behind the boat, 180 = wind dead ahead. */
export function angleOffWind(wind, heading) {
  const fx = -Math.sin((heading * Math.PI) / 180), fz = Math.cos((heading * Math.PI) / 180);
  const m = Math.hypot(wind.x, wind.z) || 1;
  const cos = (wind.x * fx + wind.z * fz) / m;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export const _test = { cells };
