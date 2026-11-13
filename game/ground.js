// Pure (given a loaded map and, for Thera, the baked city grid). The ground the game lays: a column's
// top, what it is made of, and what grows on it, from the same math the labs read (world/map.js,
// world/thera.js, world/climate.js). Shared by the bake (tools/buildmod.mjs, in Node) and the game
// (BP/scripts/main.js), so a placement the bake works out lands on the ground the game lays.
import { GIVEN, D } from "../core/given.js";
import { PHI, FIB, FIBS } from "../core/golden.js";
import { vnoise, hashAt } from "../core/noise.js";
import { blockHeight, baseBlockHeight, map } from "../world/map.js";
import { THERA, theraHeight } from "../world/thera.js";
import { climateAtBlock, columnClimate } from "../world/climate.js";
import { riverAt } from "../world/rivers.js";
import { stoneAt } from "../world/stones.js";
import { shapeHome } from "../world/homesites.js";
import { SEA as SEA_LIFE } from "../world/sealife.js";

export const SEA = GIVEN.SEA;                  // given: the sea's level (the water's top block)
export const BOTTOM = -64;                     // given: the world's floor in a vanilla overworld
const C = GIVEN.CHUNK;
const SX = THERA.seat.cx * D.PX, SZ = THERA.seat.cz * D.PX, TR = THERA.REACH * C;   // derived: Thera's middle (its map cell's corner) and reach in blocks
const FOOT = -THERA.shelf / THERA.M;           // derived: the shelf's foot (blocks)

// ---- the city grid (baked: world/city.js cityAt, sampled every CELL blocks over Thera's reach)
export const CELL = 2;                         // vision: the grid's spacing (blocks)
export const KINDS = ["", "harbour master's island", "round harbour", "shipsheds", "merchant harbour", "the Exchange", "quay", "fairway",
  "acropolis", "the Library", "stairs", "street", "inner city", "ring canal", "wall canal", "canal", "quarter", "stilt quarter", "Theran town", "the Light", "caldera", "outer"];   // the city's kinds (index 0: the natural ground)
export const KIND = Object.fromEntries(KINDS.map((k, i) => [k, i]));
let city = null, cityN = 0;
/** Use the baked grid: a Uint8Array of N x N kinds, cell (i, j) at u = (i - N/2) * CELL, v = (j - N/2) * CELL. */
export function useCity(grid, n) { city = grid; cityN = n; }
export function kindAt(u, v) {
  if (!city) return 0;
  const i = Math.floor(u / CELL) + cityN / 2, j = Math.floor(v / CELL) + cityN / 2;
  return i < 0 || j < 0 || i >= cityN || j >= cityN ? 0 : city[j * cityN + i];
}
/** The heights the plan sets (blocks over the sea), given the natural height n. */
const SET = {
  [KIND["harbour master's island"]]: (n) => Math.max(n, 3), [KIND["round harbour"]]: () => -6, [KIND.shipsheds]: () => 2,
  [KIND["merchant harbour"]]: () => -6, [KIND["the Exchange"]]: () => 2, [KIND.quay]: (n) => Math.max(2, n),
  [KIND.fairway]: (n) => Math.min(n, -5), [KIND.quarter]: () => 1,
};   // vision: world/city.js's own numbers, restated where the ground reads them

const wrapU = (x) => { const W = D.W; let du = x - SX; if (du > W / 2) du -= W; if (du < -W / 2) du += W; return du; };
/** Is a block inside Thera's reach? Returns [u, v] (blocks from the caldera's middle) or null. */
export function theraUV(x, z) { const u = wrapU(x), v = z - SZ; return Math.abs(u) <= TR && Math.abs(v) <= TR ? [u, v] : null; }

/** A column's height over the sea (blocks, a float) and the city's kind there. */
export function heightAt(x, z) { return groundAt(x, z, null); }
/** The same over a given relief (the map's blockHeight there, or the mesh's estimate of it; null: reckon it). */
function groundAt(x, z, relief) {
  const uv = theraUV(x, z);
  if (!uv) { let h = shapeHome(x, z, relief ?? blockHeight(x, z));   // a homeport's pad (world/homesites.js)
    if (h <= 0) { const st = stoneAt(x, z); if (st !== null && st > h) h = st; }   // a stepping stone and its shoal (world/stones.js)
    const r = h > 0 ? riverAt(x, z) : null; return r && r.bank < h ? { h: r.bank, kind: 0, water: r.wet && r.level > r.bank ? r.level : null, river: r } : r && r.edge <= RIVERSIDE ? { h, kind: 0, river: r } : { h, kind: 0 }; }   // a river's bed and banks cut into the ground (world/rivers.js)
  const [u, v] = uv, n = theraHeight(u, v).h, base = baseBlockHeight(x, z);
  let h = n > 0 ? n : n <= FOOT + 1 ? base : Math.max(n, base);   // the island laid into the map's sea, as world/thera.js theraChunk (the map's own ground splined as blockHeight is: the towns grown on it stand where the game lays it)
  const kind = kindAt(u, v), set = SET[kind];
  if (set) h = set(n);
  for (const p of pools) { const d = Math.hypot(u - p.u, v - p.v); if (d > p.R + FIB[7]) continue;
    if (d > p.R + FIB[3]) { const e = d - p.R - FIB[3]; h = Math.min(Math.max(h, p.level + 1 - e), p.level + 1 + e); continue; }   // the bank: the ground eased to the pool's rim a block a block, down from above and built up from below (no wall cut into the slope, none standing over it)   // the cascading pools (world/theraplan.js): a bowl under its water, its island, its white rim, its notch to the next
    if (p.island && d < p.island) return { h: p.level + 1, kind, pool: p.kind, isle: true };
    if (d < p.R) { const bowl = p.level - p.depth * (1 - (d / p.R) ** 2) - 1; return { h: Math.min(h, bowl), kind, water: p.level, pool: p.kind }; }
    const notch = p.to && ((u - p.u) * (p.to.u - p.u) + (v - p.v) * (p.to.v - p.v)) / (d * Math.hypot(p.to.u - p.u, p.to.v - p.v)) > Math.cos(1 / FIB[5]);   // derived: the notch an eighth of a radian either side of the way to the next pool
    if (notch) return { h: p.level - 1, kind, water: p.level, pool: p.kind, rim: true };   // the water spills through it and runs down to the next
    return { h: Math.max(h, p.level + 1), kind, pool: p.kind, rim: true }; }   // the rim: white, a block over the water, raised where the ground falls away
  if (tarn) { const a = Math.atan2(v - tarn.v, u - tarn.u), R = tarn.R * (1 + (vnoise(Math.cos(a) * 2 + 7, Math.sin(a) * 2 + 7, 727) - 0.5) / PHI ** 2), d = Math.hypot(u - tarn.u, v - tarn.v);   // vision: the shore wanders a golden square's share of the radius
    if (d < R) { const bowl = tarn.level - tarn.depth * (1 - (d / R) ** 2) - 1; return { h: Math.min(h, bowl), kind, water: tarn.level, frozen: true }; }   // the Arctic tarn (world/theraplan.js): a bowl under its water, frozen over
    if (d < R + FIB[6] * (0.5 + vnoise(u / FIB[5], v / FIB[5], 733))) return { h, kind, snowy: true }; }   // vision: its shore snowed over, out by thirteen blocks give or take
  return { h, kind };
}
let tarn = null, pools = [];
/** The cascading pools, baked (blocks from Thera's middle: u, v, R, level, depth, island, to: the next's u, v; kind). */
export function useCascade(list) { pools = list ?? []; }
/** The pool floors' ground, by kind: each pool one of the world's waters. */
export const POOL_FLOOR = { theran: "minecraft:calcite", warm: "minecraft:sand", lush: "minecraft:moss_block", mangrove: "minecraft:mud", cold: "minecraft:gravel", deep: "minecraft:prismarine", river: "minecraft:sand" };   // vision: each water's own floor
/** The Arctic tarn, baked (blocks from Thera's middle, u east, v south; level and depth in blocks over the sea). */
export function useTarn(t) { tarn = t; }
/** Is a sea column iced over? Its own temperature against the frozen sea's line (world/biomes.js: under -4), the
 *  line wandering with a noise eight blocks across by a golden cube's degrees, so the pack's edge breaks into floes
 *  and leads instead of following the chunks the climate was once read by. */
export function iceAt(c) {
  if (!(c.top < SEA) || c.water) return false;
  const edge = (vnoise(c.x / FIB[7], c.z / FIB[7], 541) + vnoise(c.x / FIB[5], c.z / FIB[5], 547) / PHI) / (1 + 1 / PHI) - 0.5;   // vision: the floes' keys; derived: floes about twenty-one blocks across, their edges eight, a golden step finer
  return c.T + edge * PHI ** 3 < ICE_LINE;
}
const ICE_LINE = -4;   // derived: world/biomes.js's frozen sea, under minus four
/** The meshed relief: the map's blockHeight reckoned on a lattice of S blocks (anchored on the world's own
 *  multiples of S, so neighbours share it) and laid between by bilinear blending, for an N×N square from (x0, z0).
 *  The relief's finest wave is thirteen blocks; on a lattice of three (Fibonacci's) the blend misses by under half
 *  a block: measured, the rounded top is the exact one in 99.76% of columns and one off in the rest, never more,
 *  the top block never differs, and a chunk's plan costs half (the rivers, stones and pads stay exact over it). */
export function reliefMesh(x0, z0, N, S) {
  const a0 = Math.floor(x0 / S), b0 = Math.floor(z0 / S), a1 = Math.floor((x0 + N - 1) / S) + 1, b1 = Math.floor((z0 + N - 1) / S) + 1, LW = a1 - a0 + 1;
  const L = new Float64Array(LW * (b1 - b0 + 1)); for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) L[(b - b0) * LW + a - a0] = blockHeight(a * S, b * S);
  const out = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + i, z = z0 + j, a = Math.floor(x / S), b = Math.floor(z / S), fx = x / S - a, fz = z / S - b, k = (b - b0) * LW + a - a0;
    out[j * N + i] = (L[k] * (1 - fx) + L[k + 1] * fx) * (1 - fz) + (L[k + LW] * (1 - fx) + L[k + LW + 1] * fx) * fz; }
  return out;
}
export const topAt = (x, z) => SEA + Math.round(heightAt(x, z).h);

// ---- what the ground is made of
// [top, under] for each of vanilla's biomes (biomes.js names them); every id vanilla's.
const LAND = {
  frozen_peaks: ["minecraft:packed_ice", "minecraft:packed_ice"], ice_plains: ["minecraft:snow", "minecraft:packed_ice"],
  snowy_slopes: ["minecraft:snow", "minecraft:stone"], snowy_plains: ["minecraft:grass_block", "minecraft:dirt"], snowy_taiga: ["minecraft:grass_block", "minecraft:dirt"],
  jagged_peaks: ["minecraft:snow", "minecraft:stone"], windswept_hills: ["minecraft:grass_block", "minecraft:stone"], taiga: ["minecraft:podzol", "minecraft:dirt"],
  mangrove_swamp: ["minecraft:mud", "minecraft:mud"], swamp: ["minecraft:grass_block", "minecraft:dirt"], bamboo_jungle: ["minecraft:podzol", "minecraft:dirt"],
  jungle: ["minecraft:grass_block", "minecraft:dirt"], desert: ["minecraft:sand", "minecraft:sandstone"], badlands: ["minecraft:red_sand", "minecraft:orange_terracotta"],
  savanna: ["minecraft:grass_block", "minecraft:dirt"], cherry_grove: ["minecraft:grass_block", "minecraft:dirt"], dark_forest: ["minecraft:grass_block", "minecraft:dirt"],
  birch_forest: ["minecraft:grass_block", "minecraft:dirt"], forest: ["minecraft:grass_block", "minecraft:dirt"], plains: ["minecraft:grass_block", "minecraft:dirt"],
  beach: ["minecraft:sand", "minecraft:sandstone"],
  cold_steppe: ["minecraft:grass_block", "minecraft:dirt"], meadow: ["minecraft:grass_block", "minecraft:dirt"], dry_shrubland: ["minecraft:coarse_dirt", "minecraft:dirt"], sparse_jungle: ["minecraft:grass_block", "minecraft:dirt"], savanna_plateau: ["minecraft:grass_block", "minecraft:red_sandstone"],
};   // vision: the ground's look, after vanilla's own biomes
const FLOOR = { frozen_ocean: "minecraft:gravel", cold_ocean: "minecraft:gravel", ocean: "minecraft:sand", lukewarm_ocean: "minecraft:sand", warm_ocean: "minecraft:sand" };   // vision: after vanilla's sea floors
const PATCH = { savanna_plateau: "minecraft:red_sand", sparse_jungle: "minecraft:coarse_dirt", cold_steppe: "minecraft:coarse_dirt", meadow: "minecraft:moss_block", savanna: "minecraft:coarse_dirt", jungle: "minecraft:moss_block", bamboo_jungle: "minecraft:moss_block", swamp: "minecraft:mud", dark_forest: "minecraft:podzol", windswept_hills: "minecraft:gravel", cherry_grove: "minecraft:moss_block" };   // vision: each biome's tell on the ground
const SNOWY = new Set(["snowy_plains", "snowy_taiga", "snowy_slopes", "windswept_hills_cold"]);
// the city's own ground: [top, under]
const CITYTOP = {
  [KIND["harbour master's island"]]: ["minecraft:grass_block", "minecraft:dirt"], [KIND.shipsheds]: ["minecraft:smooth_quartz", "minecraft:calcite"],
  [KIND["the Exchange"]]: ["waterworld:theran_marble_tile", "minecraft:calcite"], [KIND.quay]: ["minecraft:smooth_quartz", "minecraft:calcite"],
  [KIND.acropolis]: ["minecraft:grass_block", "minecraft:dirt"], [KIND["the Library"]]: ["minecraft:smooth_quartz", "minecraft:calcite"],
  [KIND.stairs]: ["waterworld:theran_marble_polished", "minecraft:calcite"], [KIND.street]: ["waterworld:theran_marble_tile", "minecraft:calcite"],
  [KIND["inner city"]]: ["minecraft:grass_block", "minecraft:dirt"], [KIND.quarter]: ["minecraft:stone_bricks", "minecraft:stone_bricks"],
  [KIND["the Light"]]: ["minecraft:calcite", "minecraft:calcite"],
};   // vision: the Therans' ways in their own marble, the summit given back to the garden (the cone uncapped: its paths and gardens are buildmod's), white calcite under; no grey, no black
const DEPTH = 3;                               // vision: blocks of soil (or made ground) over the rock
const RIVERSIDE = FIB[3];                      // vision: a river's banks dress the ground three blocks out from its water
const STEEP = 3;                               // vision: a rise this many blocks to a neighbour shows bare rock

// ---- the rivers' look: the bed by the water's speed (a steep river scours to stone and gravel; a slow one lays sand,
// silt and clay; a still oxbow mud), the banks by the biome (sand bars in the dry, mud in the wet heat, gravel and stone
// in the cold), in patches by the ground's own hash so a bank is never one block all along
const FAST = 1 / FIB[6];   // vision: a fall past a block in thirteen is a fast river
const BANKS = { desert: ["minecraft:sand", "minecraft:sand", "minecraft:sandstone"], badlands: ["minecraft:red_sand", "minecraft:red_sand", "minecraft:hardened_clay"], savanna: ["minecraft:sand", "minecraft:coarse_dirt", "minecraft:gravel"],
  savanna_plateau: ["minecraft:coarse_dirt", "minecraft:red_sand", "minecraft:gravel"], jungle: ["minecraft:mud", "minecraft:grass_block", "minecraft:moss_block"], bamboo_jungle: ["minecraft:mud", "minecraft:moss_block", "minecraft:grass_block"],
  sparse_jungle: ["minecraft:mud", "minecraft:grass_block", "minecraft:sand"], swamp: ["minecraft:mud", "minecraft:mud", "minecraft:clay"], mangrove_swamp: ["minecraft:mud", "minecraft:mud", "minecraft:mud"],
  taiga: ["minecraft:gravel", "minecraft:podzol", "minecraft:stone"], snowy_taiga: ["minecraft:gravel", "minecraft:snow", "minecraft:stone"], cold_steppe: ["minecraft:gravel", "minecraft:coarse_dirt", "minecraft:stone"],
  snowy_plains: ["minecraft:gravel", "minecraft:snow", "minecraft:stone"], windswept_hills: ["minecraft:gravel", "minecraft:stone", "minecraft:andesite"], default: ["minecraft:grass_block", "minecraft:sand", "minecraft:gravel"] };   // vision: each biome's banks, the commonest first
/** A river column's [top, under]: its bed under water, or its bank within RIVERSIDE of the water. */
function riverGround(riv, cc, biome, x, z, wet) {
  const r = hashAt(x, z, 289), patch = vnoise(x / FIB[4], z / FIB[4], 291);   // vision: the keys; patches five blocks across
  if (wet) {
    if (riv?.oxbow) return [patch < 1 / PHI ? "minecraft:mud" : "minecraft:clay", "minecraft:clay"];   // a still oxbow silts to mud and clay
    if ((riv?.fall ?? 0) > FAST) return [patch < 1 / PHI ** 2 ? "minecraft:stone" : "minecraft:gravel", "minecraft:gravel"];   // a fast river scours its bed
    if ((cc?.T ?? 15) > 22 && (cc?.M ?? 0.5) > 0.5) return [patch < 1 / PHI ? "minecraft:mud" : "minecraft:clay", "minecraft:clay"];   // derived: the wet heat's rivers run brown over mud
    return [patch < 1 / PHI ** 2 ? "minecraft:clay" : patch < 1 / PHI ? "minecraft:sand" : "minecraft:gravel", "minecraft:gravel"];
  }
  const B = BANKS[biome] ?? BANKS.default, pick = patch < 1 / PHI ? B[0] : patch < 1 - 1 / PHI ** 3 ? B[1] : B[2];   // derived: the first on most of the bank, the last in its patches
  return [r < 1 / FIB[6] && pick === "minecraft:grass_block" ? "minecraft:coarse_dirt" : pick, pick === "minecraft:grass_block" || pick === "minecraft:moss_block" || pick === "minecraft:podzol" ? "minecraft:dirt" : pick === "minecraft:snow" ? "minecraft:gravel" : pick];
}
/** Every column of a chunk (and a block of border, for slopes): tops and materials. */
export function chunkColumns(cx, cz) { const g = chunkColumnsSteps(cx, cz); let r; while (!(r = g.next()).done); return r.value; }
/** The same, a row at a time: it yields after every row (the game's layer takes it in slices, so no one step is a
 *  chunk's whole reckoning) and returns the plan. */
export function* chunkColumnsSteps(cx, cz, { mesh = 0 } = {}) {
  const x0 = cx * C, z0 = cz * C, N = C + 2, frozen = new Set(), snowy = new Set(), pooled = new Map(), tops = new Int16Array(N * N), kinds = new Uint8Array(N * N), waters = new Int16Array(N * N), rivs = new Array(N * N);
  const relief = mesh && !theraUV(x0 + C / 2, z0 + C / 2) ? reliefMesh(x0 - 1, z0 - 1, N, mesh) : null;
  if (relief) yield;
  for (let j = 0; j < N; j++) { for (let i = 0; i < N; i++) { const g = groundAt(x0 + i - 1, z0 + j - 1, relief ? relief[j * N + i] : null); tops[j * N + i] = SEA + Math.round(g.h); kinds[j * N + i] = g.kind; waters[j * N + i] = g.water != null ? SEA + Math.round(g.water) : 0; if (g.frozen) frozen.add(j * N + i); if (g.snowy) snowy.add(j * N + i); if (g.pool) pooled.set(j * N + i, g); rivs[j * N + i] = g.river ?? null; } yield; }
  const cl = climateAtBlock(cx * C + C / 2, cz * C + C / 2), biome = cl.biome?.id ?? "plains";
  const cols = [];
  for (let j = 0; j < C; j++) { if (j) yield; for (let i = 0; i < C; i++) {
    const k = (j + 1) * N + (i + 1), top = tops[k], kind = kinds[k], water = waters[k] > top ? waters[k] : null, riv = rivs[k];
    let rise = 0; for (const d of [1, -1, N, -N]) rise = Math.max(rise, Math.abs(tops[k + d] - top));
    let topId, under, cap = null;
    const cc = kind && kind !== KIND.caldera && kind !== KIND.outer ? null : columnClimate(x0 + i, z0 + j, top - SEA), rec = cc?.biome ?? cl.biome, b0 = rec?.parent ?? rec?.id ?? biome;   // an extreme biome is its parent's ground   // the column's own climate (world/climate.js): edges that wander, not chunk squares
    const pg = pooled.get(k);
    if (pg) { [topId, under] = pg.rim ? ["minecraft:calcite", "minecraft:calcite"] : pg.isle ? ["minecraft:grass_block", "minecraft:dirt"] : [POOL_FLOOR[pg.pool] ?? "minecraft:sand", "minecraft:calcite"]; }   // a pool's floor, its white rim, its island
    else if (top <= SEA) {   // the sea floor
      const fl = FLOOR[b0] ?? "minecraft:sand";
      topId = SEA - top > 20 ? "minecraft:gravel" : fl; under = topId === "minecraft:sand" ? "minecraft:sandstone" : "minecraft:gravel";   // vision: deep water floors with gravel
      if (CITYTOP[kind]) [topId, under] = CITYTOP[kind];
    } else if (CITYTOP[kind]) [topId, under] = CITYTOP[kind];
    else if (water || (riv && riv.edge <= RIVERSIDE && riv.edge > 0)) [topId, under] = riverGround(riv, cc ?? cl, b0, x0 + i, z0 + j, !!water);   // a river's bed and banks, by its ground and its biome
    else {
      const b = b0;
      [topId, under] = LAND[b] ?? LAND.plains;
      if (b === "jagged_peaks" && (cc ?? cl).T + (vnoise((x0 + i) / FIB[6], (z0 + j) / FIB[6], 557) - 0.5) * PHI ** 2 >= 0) { topId = hashAt(x0 + i, z0 + j, 563) < 1 / PHI ? "minecraft:stone" : hashAt(x0 + i, z0 + j, 569) < 1 / PHI ? "minecraft:calcite" : "minecraft:gravel"; under = "minecraft:stone"; }   // a high peak above the frost is bare rock and scree: its snow line wanders a golden square of degrees in patches thirteen blocks across
      if (rec?.id === "stony_peaks") { topId = hashAt(x0 + i, z0 + j, 287) < 1 / PHI ? "minecraft:stone" : "minecraft:calcite"; under = "minecraft:stone"; }   // derived: bare stone and chalk crests
      if (rise >= STEEP && topId !== "minecraft:sand" && topId !== "minecraft:red_sand") { topId = (cc ?? cl).T < 0 ? "minecraft:snow" : "minecraft:stone"; under = "minecraft:stone"; }
      if ((SNOWY.has(b) || snowy.has(k)) && topId === "minecraft:grass_block") cap = "minecraft:snow_layer";   // a snowy biome's, or the Arctic tarn's shore
      if (topId === "minecraft:grass_block" && (vnoise((x0 + i) / FIB[3], (z0 + j) / FIB[3], 271) + hashAt(x0 + i, z0 + j, 277)) / 2 < 1 / PHI ** 2) topId = PATCH[b] ?? topId;   // derived: the tell in clumps three blocks across, near three columns in ten (the grass colour cannot show it: one biome a dimension)
    }
    cols.push({ i, j, x: x0 + i, z: z0 + j, top, kind, topId, under, cap, rise, rec, T: cc?.T ?? cl.T, water, frozen: frozen.has(k) || undefined, riv: riv ? { edge: riv.edge, oxbow: riv.oxbow, fall: riv.fall, w: riv.w } : null });
  } }
  return { cols, climate: cl, biome };
}

// ---- what grows (deterministic: the noise's hash, nothing seeded)
const r01 = (x, z, k) => hashAt(x, z, k);   // a block's own value: the hash's
export const TREES = {
  forest: 1 / 34, dark_forest: 1 / 13, birch_forest: 1 / 34, jungle: 1 / 21, bamboo_jungle: 1 / 21, taiga: 1 / 34, snowy_taiga: 1 / 55,
  cherry_grove: 1 / 55, swamp: 1 / 89, mangrove_swamp: 1 / 34, savanna: 1 / 144, plains: 1 / 233, windswept_hills: 1 / 144, cold_steppe: 1 / 233, meadow: 1 / 233, dry_shrubland: 1 / 233, sparse_jungle: 1 / 34, savanna_plateau: 1 / 89,
};   // vision: a tree to this many columns (Fibonacci numbers), by biome
const LEAVES = (log) => log.replace("_log", "_leaves");
/** A tree's blocks at a column, or null: [[dx, dy, dz, id, states]] from the ground's top. */
export function treeAt(col, chunkRec) {
  const biomeRec = col.rec ?? chunkRec;
  if (col.top <= SEA || col.kind || col.water) return null;
  if (biomeRec?.spires) { const sp = biomeRec.spires; if (col.i < 1 || col.j < 1 || col.i > C - 2 || col.j > C - 2 || r01(col.x, col.z, 293) >= sp.rate) return null; const tall = Math.round(sp.tall * (1 / PHI ** 2 + (1 - 1 / PHI ** 2) * r01(col.x, col.z, 295))), out = []; for (let y = 1; y <= tall; y++) { const r = y < tall / PHI ** 2 ? 1 : 0; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (!(a && b)) out.push([a, y, b, sp.id, null]); } return out; }   // derived: a spire from a golden square of its height to all of it, a block wider at its foot
  if (biomeRec?.sunflowers && col.topId === "minecraft:grass_block" && r01(col.x, col.z, 297) < biomeRec.sunflowers) return [[0, 1, 0, "minecraft:sunflower", { upper_block_bit: false }], [0, 2, 0, "minecraft:sunflower", { upper_block_bit: true }]];
  if (col.riv && col.riv.edge > 0 && col.riv.edge <= 1.5 && (col.T ?? 15) > FIB[6] && !/snow|ice/.test(col.topId)) {   // derived: reeds at the water's edge where it is warmer than 13 degrees, a block and a half from the water at most
    if (r01(col.x, col.z, 301) < 1 / PHI ** 2) { const tall = 1 + Math.floor(r01(col.x, col.z, 303) * FIB[3]); return Array.from({ length: tall }, (_, y) => [0, y + 1, 0, "minecraft:reeds", { age: 0 }]); }   // derived: two-fifths of the edge, one to three tall
  }
  const p = TREES[biomeRec?.parent ?? biomeRec?.id]; if (!p || col.rise >= STEEP) return null;
  const giant = biomeRec?.giant ?? 0, reach = giant ? FIB[4] - 1 : 2;   // derived: a giant's crown four blocks out
  if (col.i < reach || col.j < reach || col.i > C - 1 - reach - (giant ? 1 : 0) || col.j > C - 1 - reach - (giant ? 1 : 0)) return null;   // whole inside its chunk
  if (r01(col.x, col.z, 211) >= p) return null;
  const woods = biomeRec.wood?.filter((w) => w.endsWith("_log")) ?? []; if (!woods.length) return null;
  const log = woods[Math.floor(r01(col.x, col.z, 223) * woods.length)], leaves = LEAVES(log);
  const spruce = log.includes("spruce"), out = [];
  if (giant) {   // a giant: two by two, its height a golden share of the biome's tallest to all of it, a crown in tiers
    const tall = Math.round(giant * (1 / PHI + (1 - 1 / PHI) * r01(col.x, col.z, 227)));
    for (let y = 1; y <= tall; y++) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) out.push([a, y, b, log, null]);   // given: the four trunks
    for (let y = Math.round(tall / PHI); y <= tall + 1; y++) {
      const r = spruce ? Math.max(1, Math.round(((tall + 1 - y) / (tall - tall / PHI + 1)) * reach)) : y > tall ? reach - 1 : reach;
      for (let a = -r; a <= r + 1; a++) for (let b = -r; b <= r + 1; b++) { const da = a - 0.5, db = b - 0.5; if (da * da + db * db <= r * r + 1 && !((a === 0 || a === 1) && (b === 0 || b === 1) && y <= tall)) out.push([a, y, b, leaves, { persistent_bit: true }]); }
    }
    return out;
  }
  const tall = 4 + Math.floor(r01(col.x, col.z, 227) * 3);   // vision: four to six blocks of trunk
  for (let y = 1; y <= tall; y++) out.push([0, y, 0, log, null]);
  for (let y = tall - 2; y <= tall + 1; y++) {
    const r = spruce ? Math.max(0, Math.round((tall + 1 - y) * 0.8)) : y > tall ? 1 : 2;   // vision: a cone for spruce, a ball for the rest
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if ((a || b || y > tall) && a * a + b * b <= r * r + 1) out.push([a, y, b, leaves, { persistent_bit: true }]);
    }
  }
  out.push([0, tall + 1, 0, leaves, { persistent_bit: true }]);
  return out;
}
const FLOWERS = ["minecraft:poppy", "minecraft:dandelion", "minecraft:cornflower", "minecraft:allium", "minecraft:azure_bluet", "minecraft:oxeye_daisy", "minecraft:red_tulip", "minecraft:orange_tulip", "minecraft:white_tulip", "minecraft:pink_tulip", "minecraft:lily_of_the_valley"];   // given: vanilla's small flowers
/** What grows in a river's water: [[y over the column's top, id, states]], or null: lily pads on still water (an oxbow, a slow river), seagrass where it runs two deep. */
export function riverLifeAt(col) {
  if (!col.water || !col.riv) return null; const d = col.water - col.top, r = r01(col.x, col.z, 307);
  if ((col.riv.oxbow || (col.riv.fall < 1 / FIBS[12] && col.riv.edge > -1.5)) && r < 1 / PHI ** 3 && (col.T ?? 15) > FIB[5]) return [[col.water - col.top + 1, "minecraft:waterlily", null]];   // derived: lily pads on a fifth of still warm water (an oxbow, or a river's edge where it falls under a block in 233)
  if (d >= 2 && r > 1 - 1 / PHI ** 2) return [[1, "minecraft:seagrass", { sea_grass_type: "default" }]];   // derived: seagrass on two-fifths of the bed two deep
  return null;
}
/** Small plants on a land column (one block over the top), or null. */
export function plantAt(col, chunkRec) {
  const biomeRec = col.rec ?? chunkRec;
  if (col.riv && col.riv.edge > 0 && (col.T ?? 15) <= FIB[6] && col.top > SEA && r01(col.x, col.z, 305) < 1 / PHI ** 2 && col.topId === "minecraft:grass_block") return "minecraft:fern";   // derived: ferns by the cool rivers
  if (col.top <= SEA || col.kind || col.cap || col.topId !== "minecraft:grass_block") return null;
  const r = r01(col.x, col.z, 229);
  if (r < 1 / PHI ** 4) return "minecraft:short_grass";   // derived: about one column in seven
  if (biomeRec?.flowers && r < 1 / PHI ** 4 + biomeRec.flowers) { const fl = FLOWERS[Math.floor(r01(col.x / FIB[4], col.z / FIB[4], 299) * FLOWERS.length)]; return fl; }   // vision: a flower forest's flowers, in bands five blocks across
  if (r < 1 / PHI ** 4 + 1 / 89) { const w = biomeRec?.wild?.find((s) => /poppy|dandelion|lily_of_the_valley|blue_orchid|fern|pink_petals/.test(s)); return w ?? null; }   // vision: a flower to 89 columns
  return null;
}
// the sea's life on the floor (world/sealife.js's habitats: reefs warm and shallow, kelp in the cool)
const { SHALLOW, REEF_T, KELP_T } = SEA_LIFE;   // world/sealife.js's own habitats
const CORALS = ["tube", "brain", "bubble", "fire", "horn"];   // given: vanilla's five corals
/** What stands on a sea column's floor: [[dy, id, states, waterlog]] from the floor up, or null. */
export function seaLifeAt(col, cl) {
  const d = SEA - col.top; if (d < 2 || col.kind) return null;   // vision: two blocks of water at least
  const T = cl.T, out = [];
  if (T >= REEF_T && d <= SHALLOW) {
    const patch = vnoise(col.x / 9, col.z / 9, 233);   // vision: reefs in patches nine blocks across
    if (patch > 1 / PHI) {   // derived: about two-fifths of the shallow warm floor is reef (world/sealife.js starts reefs at K/phi)
      const c = CORALS[Math.floor(vnoise(col.x / 5, col.z / 5, 239) * 5) % 5], r = r01(col.x, col.z, 241);
      out.push([0, `minecraft:${c}_coral_block`, null, false]);
      if (r < 0.5 && d >= 3) out.push([1, `minecraft:${c}_coral`, null, true]);
      else if (r < 0.75 && d >= 3) out.push([1, `minecraft:${c}_coral_fan`, null, true]);
      else if (r < 0.8 && d >= 3) out.push([1, "minecraft:sea_pickle", { cluster_count: Math.floor(r * 40) % 4, dead_bit: false }, true]);
      return out;
    }
  }
  if (T >= KELP_T[0] && T < KELP_T[1] && d >= 4) {
    const r = r01(col.x, col.z, 251);
    if (r < 1 / PHI ** 3) { const tall = Math.max(1, Math.min(d - 2, Math.floor(d * (0.4 + 0.5 * r01(col.x, col.z, 257))))); for (let y = 1; y <= tall; y++) out.push([y, "minecraft:kelp", null, false]); return out; }   // derived: a kelp a quarter of the floor
  }
  if (d <= SHALLOW && col.topId === "minecraft:sand" && r01(col.x, col.z, 263) < 1 / PHI ** 2) out.push([1, "minecraft:seagrass", null, false]);   // derived: seagrass on two-fifths of the shallow sand
  return out.length ? out : null;
}
