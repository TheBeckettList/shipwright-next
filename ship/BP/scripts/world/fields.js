// Pure. The base fields of the sea world: the few quantities everything else is derived from.
//
//   latitude   z is north-south (north is -z). The world is a planet folded flat: from the spawn's
//              middle latitudes, the pole lies about 4,800 blocks north and the equator about
//              4,200 south, with a southern hemisphere beyond it, mirrored.
//   heat       from latitude (sun), cooled by height (lapse) and moderated by the sea.
//   wind       the planet's prevailing belts: doldrums at the equator, steady trades, calm horse
//              latitudes, strong westerlies, polar easterlies. Turned by the hemisphere and slow
//              weather, swirled by moving storms, and stirred by sea and land breezes near shore.
//   moisture   wet at the equator and in the westerlies, dry under the subtropical highs and at
//              the poles; carried by the wind, wrung out on windward slopes, short in their shadow.
//
// Biomes (biomes.js), cultures (peoples.js), lanes, sites and the wind you sail by all come from
// these. Nothing downstream invents a number of its own about climate.
import { fbm, clamp, smoothstep, lerp, rand } from "./noise.js";

export const POLE = 9000;              // blocks from equator to pole
const SPAWN_LAT = 42;                  // degrees north at z = 0

const tri = (t) => 1 - Math.abs((((t + 1) % 4) + 4) % 4 - 2);   // -1..1, period 4

/** Signed latitude in degrees (+ north, - south). */
export function latitude(seed, x, z) {
  const waver = (fbm(x / 3200, z / 3200, seed + 201, 2) - 0.5) * 0.12;
  return 90 * tri(-z / POLE + SPAWN_LAT / 90 + waver);
}

// Heat changes over thousands of blocks: worked out on a 16-block grid and blended between its
// points (the same value wherever it's asked from, so chunks agree at their seams).
let heatGrid = new Map(), heatSeed = null;
function heatNode(seed, gx, gz) {
  if (seed !== heatSeed) { heatGrid = new Map(); heatSeed = seed; }
  const k = gx * 2097152 + gz;
  let v = heatGrid.get(k);
  if (v === undefined) {
    v = seaHeatExact(seed, gx * 16, gz * 16);
    heatGrid.set(k, v);
    if (heatGrid.size > 20000) heatGrid.delete(heatGrid.keys().next().value);
  }
  return v;
}
/** Heat 0 (polar) .. 1 (equatorial), at the sea's surface. */
export function seaHeat(seed, x, z) {
  const fx = x / 16, fz = z / 16, gx = Math.floor(fx), gz = Math.floor(fz), tx = fx - gx, tz = fz - gz;
  const a = heatNode(seed, gx, gz), b = heatNode(seed, gx + 1, gz), c = heatNode(seed, gx, gz + 1), d = heatNode(seed, gx + 1, gz + 1);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
export function seaHeatExact(seed, x, z) {
  const a = Math.abs(latitude(seed, x, z));
  return clamp(1 - a / 88, 0, 1) ** 0.8;          // the poles are small, the warm belts wide
}

/** Heat on land: the sea's, less 0.007 a block of height (a peak of 40 is a climate colder). */
export const heatAt = (seed, x, z, top = 62) => clamp(seaHeat(seed, x, z) - Math.max(0, top - 63) * 0.007, 0, 1);

// ---------------------------------------------------------------- wind

/** The prevailing belt at a latitude: direction (unit, world) and strength, before weather. */
export function belt(lat) {
  const a = Math.abs(lat);
  const toEq = lat >= 0 ? 1 : -1;                 // +z is toward the equator in the north
  // weights of each belt, blended across their edges
  const doldrums = 1 - smoothstep(3, 8, a);
  const trades = smoothstep(3, 8, a) * (1 - smoothstep(25, 31, a));
  const horse = smoothstep(25, 31, a) * (1 - smoothstep(32, 38, a));
  const west = smoothstep(32, 38, a) * (1 - smoothstep(57, 63, a));
  const polar = smoothstep(57, 63, a);
  const dir = {
    x: -1 * (trades + doldrums + horse * 0.3 + polar) + 1 * west,
    z: toEq * (0.45 * trades + 0.35 * polar) - toEq * 0.45 * west,
  };
  const m = Math.hypot(dir.x, dir.z) || 1;
  const strength = 0.22 * doldrums + 0.9 * trades + 0.32 * horse + 1.05 * west + 0.75 * polar;
  const name = [["doldrums", doldrums], ["trades", trades], ["horse latitudes", horse], ["westerlies", west], ["polar easterlies", polar]].sort((p, q) => q[1] - p[1])[0][0];
  return { x: dir.x / m, z: dir.z / m, strength, name, steadiness: 0.9 * trades + 0.5 * polar + 0.35 * west + 0.2 * (doldrums + horse) };
}

export const STORM_CELL = 1600, DAY = 24000;

/** Storms: each cell and day may hold one, born where the belts breed them, drifting with the wind. */
export function stormsNear(seed, x, z, tick) {
  const out = [];
  const day = Math.floor(tick / DAY), frac = (tick % DAY) / DAY;
  for (const d of [day - 1, day]) {
    const sx = Math.floor(x / STORM_CELL), sz = Math.floor(z / STORM_CELL);
    for (let i = -2; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const cx = sx + i, cz = sz + j;
      const ox = (cx + rand(cx, cz, d, seed, 211)) * STORM_CELL, oz = (cz + rand(cx, cz, d, seed, 212)) * STORM_CELL;
      const lat = latitude(seed, ox, oz), a = Math.abs(lat);
      // westerly gales, and tropical cyclones a little off the equator
      const chance = 0.22 * smoothstep(38, 46, a) * (1 - smoothstep(58, 66, a)) + 0.1 * smoothstep(9, 13, a) * (1 - smoothstep(20, 25, a));
      if (rand(cx, cz, d, seed, 213) > chance) continue;
      const b = belt(lat);
      const age = d === day ? frac : 1 + frac;                // a storm lives two days
      if (age > 1.6) continue;
      const travel = 1500 * age;
      out.push({ x: ox + b.x * travel, z: oz + b.z * travel, R: 260 + 160 * rand(cx, cz, d, seed, 214), power: Math.sin(Math.PI * Math.min(1, age / 1.6)), spin: lat >= 0 ? 1 : -1 });
    }
  }
  return out;
}

/**
 * The wind over open water at a place and time: { x, z } (blocks a tick, about 0..1.6), its belt,
 * and how stormy it is (0..1). Shelter, gusts and breezes near land are added by the steering
 * (wind.js), as they are anywhere.
 */
export function windField(seed, x, z, tick = 0) {
  const lat = latitude(seed, x, z);
  const b = belt(lat);
  // slow weather: the belt's direction swings, less where it's steady (the trades)
  const swing = (fbm(x / 2400, z / 2400 + tick / 48000, seed + 221, 2) - 0.5) * (1.4 - b.steadiness) * 1.3;
  const c = Math.cos(swing), s = Math.sin(swing);
  let wx = (b.x * c - b.z * s) * b.strength, wz = (b.x * s + b.z * c) * b.strength;
  const breathe = 0.85 + 0.3 * fbm(x / 900 + tick / 6000, z / 900, seed + 222, 2);
  wx *= breathe; wz *= breathe;
  let storm = 0;
  for (const st of stormsNear(seed, x, z, tick)) {
    const dx = x - st.x, dz = z - st.z, r = Math.hypot(dx, dz);
    if (r > st.R * 2.2) continue;
    const k = st.power * (r < st.R ? r / st.R : Math.exp(-(r - st.R) / (st.R * 0.6)));
    // round the low the wind runs anticlockwise in the north (seen from above, north up), inflowing
    const tx = (-dz / (r || 1)) * st.spin * -1, tz = (dx / (r || 1)) * st.spin * -1;
    const ix = -dx / (r || 1), iz = -dz / (r || 1);
    wx = lerp(wx, (tx * 0.85 + ix * 0.3) * 1.6, k);
    wz = lerp(wz, (tz * 0.85 + iz * 0.3) * 1.6, k);
    storm = Math.max(storm, k * (r < st.R * 1.2 ? 1 : 0.5));
  }
  return { x: wx, z: wz, belt: b.name, lat, storm };
}

// ---------------------------------------------------------------- moisture

/** Moisture from latitude alone: the planet's wet and dry belts. */
export function beltMoisture(lat) {
  const a = Math.abs(lat);
  return 0.5 + 0.32 * Math.cos((a / 30) * Math.PI) * (a > 60 ? 0.55 : 1) - (a > 70 ? 0.12 : 0);
}

/**
 * Moisture 0..1 at a place on land: the belt's, varied, plus sea air on small islands; less in the
 * shadow of high ground upwind (the wind has rained it out), more on slopes that face the wind.
 * elevationAt(x, z) -> top, so this stays free of the terrain module.
 */
export function moisture(seed, x, z, top, elevationAt) {
  const lat = latitude(seed, x, z);
  let m = beltMoisture(lat) + (fbm(x / 1300, z / 1300, seed + 231, 2) - 0.5) * 0.36;
  if (elevationAt) {
    const b = belt(lat);
    let shadow = 0, land = 0;
    for (let k = 1; k <= 6; k++) {
      const ux = x - b.x * k * 14, uz = z - b.z * k * 14;
      const t = elevationAt(ux, uz);
      if (t > 62) { land++; shadow = Math.max(shadow, t - top); }
    }
    m -= Math.max(0, shadow) * 0.012;
    if (land === 0 && top > 64) m += Math.min(0.15, (top - 63) * 0.008);   // the windward face
    if (land <= 1) m += 0.05;                                                // sea air
  }
  return clamp(m, 0, 1);
}
