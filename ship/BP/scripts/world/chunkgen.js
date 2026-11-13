// Pure. One 16x16 chunk of the sea world, worked out as columns and blocks.
//
// A column, bottom up: bedrock; deepslate to y 24; stone, with ores at the depths vanilla keeps
// them (diamonds and redstone deep, coal and copper high, emeralds in the highlands) and caves wormed
// through the bigger islands (lava lakes at their bottoms); the biome's subsoil and surface. At sea:
// the bed and the water over it. Volcanoes: basalt and blackstone, a lava crater, obsidian where
// their lava ran into the sea. Then what grows and stands on top: trees (only their blocks in this
// chunk; the neighbour lays the rest), plants, kelp, coral, seagrass, sea ice, snow; then geodes, and
// the parts of any sea site that fall inside. The game side lays it out; the lab checks it.
import { hash, rand, value2 } from "./noise.js";
import { climate, SEA_LEVEL, FLOOR_MIN } from "./terrain.js";
import { columnAt, chunkColumns, openOcean, warmNodes } from "./lattice.js";
import { cavesIn, veinsIn, ORE_VEINS } from "./underground.js";
import { BIOMES, plantAt } from "./biomes.js";
import { sitesIn, sitesInSteps } from "./sites.js";
import { siteBlocks, siteSteps } from "./wrecks.js";
import { structuresIn, structureBlocks, structureSteps } from "./structures.js";
import { homeport, homeportIfReady, portSite, PORT_PLAN, cityColumn, cityKind, cityBlocksSteps, inPort } from "./homeport.js";

/** Strongyle, where a place could be part of it (worked out on the spot only near it: the game has it ready long before). */
function portNear(seed, x, z) {
  const hp = homeportIfReady(seed);
  if (hp) return hp;
  const at = portSite(seed);
  return Math.abs(x - at.x) <= PORT_PLAN.radius + 64 && Math.abs(z - at.z) <= PORT_PLAN.radius + 64 ? homeport(seed) : null;   // vision: a chunk's reach and more
}

export const CHUNK = 16;
export const planTrace = { part: "" };          // which part of a plan is running (the labs read it)
export const DEEPSLATE_TOP = 24;
export { ORE_VEINS };

/** Vanilla's ore depths, mapped onto our 16..110 world: [ore, deepslate ore, chance a block, y from, y to]. */
export const ORES = [
  ["coal_ore", "deepslate_coal_ore", 0.012, 30, 120],
  ["copper_ore", "deepslate_copper_ore", 0.007, 28, 80],
  ["iron_ore", "deepslate_iron_ore", 0.008, 17, 90],
  ["gold_ore", "deepslate_gold_ore", 0.002, 17, 40],
  ["lapis_ore", "deepslate_lapis_ore", 0.0016, 18, 48],
  ["redstone_ore", "deepslate_redstone_ore", 0.004, 17, 32],
  ["diamond_ore", "deepslate_diamond_ore", 0.0011, 17, 27],
];

/** A column, bottom up, blended from the lattice: runs of [y0, y1, id], the water over it, and what it is. */
export function column(seed, x, z, c = columnAt(seed, x, z)) {
  const B = BIOMES[c.biome];
  const layers = [[FLOOR_MIN, FLOOR_MIN, "minecraft:bedrock"]];
  const top = c.top;
  const volcanic = c.special === "volcano";
  const rock = c.land ? top - 4 : top - 3;                      // under the soil (land) or the bed (sea)
  const deepTop = Math.min(DEEPSLATE_TOP, rock);
  if (deepTop >= FLOOR_MIN + 1) layers.push([FLOOR_MIN + 1, deepTop, "minecraft:deepslate"]);
  if (rock > DEEPSLATE_TOP) layers.push([DEEPSLATE_TOP + 1, rock, volcanic ? "minecraft:basalt" : "minecraft:stone"]);
  let lavaTop = null;
  if (c.land) {
    const sub = volcanic ? (hash(x, z, seed, 311) % 4 ? "minecraft:blackstone" : "minecraft:magma") : B.sub;
    layers.push([top - 3, top - 1, sub], [top, top, volcanic && c.coast ? "minecraft:obsidian" : B.top]);
    if (c.crater) { layers.push([top + 1, top + 1, "minecraft:lava"]); lavaTop = top + 1; }
  } else {
    const bed = volcanic && c.depth <= 6 ? (hash(x, z, seed, 312) % 2 ? "minecraft:obsidian" : "minecraft:magma") : B.bed ?? "minecraft:sand";
    layers.push([top - 2, top - 1, B.bed === "minecraft:gravel" ? "minecraft:gravel" : "minecraft:sandstone"], [top, top, bed]);
  }
  const clean = layers.filter(([a, b]) => b >= a);
  const nat = { x, z, top, land: c.land, layers: clean, water: c.land ? null : [top + 1, SEA_LEVEL], snow: !!B.snow && c.land && !c.crater, biome: c.biome, climate: B.family, c, lavaTop, solidTop: lavaTop ?? top };
  const hp = portNear(seed, x, z);                              // the homeport, where it stands, replaces the world's own column
  return (hp && cityColumn(seed, hp, x, z, nat)) || nat;
}

/** A tree standing at a column, or null (one candidate per 3-block cell; groves by the biome's density). */
function treeHere(seed, x, z, c) {
  if (!c.land || c.top <= SEA_LEVEL + 1) return null;
  const cell = 3, tx = Math.floor(x / cell), tz = Math.floor(z / cell);
  if (x !== tx * cell + (hash(tx, tz, seed, 51) % cell) || z !== tz * cell + (hash(tx, tz, seed, 52) % cell)) return null;
  const B = BIOMES[c.biome];
  if (!B.density || !B.trees?.length) return null;
  const grove = value2(x / 60, z / 60, seed + 53);
  if (rand(x, z, seed, 54) > B.density * 9 * Math.min(1, Math.max(0, (grove - 0.3) / 0.42))) return null;
  const total = B.trees.reduce((a, [, w]) => a + w, 0);
  let r = ((hash(x, z, seed, 55) % 1000) / 1000) * total, kind = B.trees[0][0];
  for (const [k, w] of B.trees) { if (r < w) { kind = k; break; } r -= w; }
  return { kind, h: 4 + (hash(x, z, seed, 56) % 3) + (c.biome === "jungle" || c.biome === "old_growth" ? 3 : 0) };
}

/** A tree's blocks (trunk at x, y on the ground, z). */
export function treeBlocks(kind, x, y, z, h, seed) {
  const out = [];
  const log = (id, yy, xx = x, zz = z) => out.push({ x: xx, y: yy, z: zz, id, states: { pillar_axis: "y" } });
  const leaf = (id, xx, yy, zz) => out.push({ x: xx, y: yy, z: zz, id, states: { persistent_bit: true }, leaf: true });
  if (kind === "bamboo") {
    const n = 6 + (hash(x, z, seed, 63) % 6);
    for (let i = 1; i <= n; i++) out.push({ x, y: y + i, z, id: "minecraft:bamboo", states: { bamboo_leaf_size: i >= n - 2 ? "large_leaves" : "no_leaves", bamboo_stalk_thickness: "thick" }, leaf: true });
    return out;
  }
  if (kind === "huge_mushroom") {
    const red = hash(x, z, seed, 64) % 2 === 0;
    const cap = red ? "minecraft:red_mushroom_block" : "minecraft:brown_mushroom_block";
    for (let i = 1; i <= h; i++) out.push({ x, y: y + i, z, id: "minecraft:mushroom_stem", states: { huge_mushroom_bits: 15 } });
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) + Math.abs(b) < 4) out.push({ x: x + a, y: y + h + 1, z: z + b, id: cap, states: { huge_mushroom_bits: 14 }, leaf: true });
    return out;
  }
  const wood = kind === "palm" ? "jungle" : kind;
  const L = `minecraft:${wood}_log`, F = `minecraft:${wood}_leaves`;
  if (kind === "palm") {                       // a leaning trunk with a fan of fronds
    let px = x, pz = z;
    const lean = hash(x, z, seed, 61) % 4, d = [[1, 0], [-1, 0], [0, 1], [0, -1]][lean];
    for (let i = 1; i <= h + 1; i++) { if (i === Math.floor(h / 2) + 1) { px += d[0]; pz += d[1]; } log(L, y + i, px, pz); }
    const ty = y + h + 2;
    leaf(F, px, ty, pz);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { leaf(F, px + a, ty, pz + b); leaf(F, px + 2 * a, ty - 1, pz + 2 * b); }
    return out;
  }
  for (let i = 1; i <= h; i++) log(L, y + i);
  if (kind === "spruce") {
    for (let k = 0; k < 4; k++) {
      const r = k === 0 ? 0 : k < 3 ? 1 : 2;
      const yy = y + h + 1 - k;
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (Math.abs(a) + Math.abs(b) <= r + (r > 1 ? 0 : 1) && (a || b || k === 0)) leaf(F, x + a, yy, z + b);
    }
    return out;
  }
  const top = y + h;
  const wide = kind === "dark_oak" || kind === "cherry" ? 3 : 2;
  for (let yy = top - 1; yy <= top + 1; yy++) {
    const r = yy === top + 1 ? wide - 1 : wide;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if (Math.abs(a) === r && Math.abs(b) === r && (r >= 2 || yy === top + 1)) continue;
      if (!a && !b && yy <= top) continue;
      leaf(F, x + a, yy, z + b);
    }
  }
  if (kind === "acacia") return out.filter((b) => !b.leaf || b.y >= top);     // a flat crown
  return out;
}

const CORALS = ["tube", "brain", "bubble", "fire", "horn"];

const siteCache = new Map();
function cached(key, make) {
  if (siteCache.has(key)) return siteCache.get(key);
  const b = make();
  siteCache.set(key, b);
  if (siteCache.size > 240) siteCache.delete(siteCache.keys().next().value);
  return b;
}

/**
 * Everything a chunk holds. { columns, blocks, containers, sites }. Blocks outside the chunk are
 * left out: the neighbour lays its own share of a tree, a wreck or a fortress.
 */
export function chunkPlan(seed, cx, cz) {
  const g = planSteps(seed, cx, cz);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

/** chunkPlan as steps: yields between its parts, so a game job can spread one chunk over ticks. */
export function* planSteps(seed, cx, cz) {
  const g = yield* groundSteps(seed, cx, cz);
  const d = yield* dressSteps(seed, g);
  return { cx, cz, columns: g.columns, blocks: d.blocks, containers: d.containers, over: new Map([...g.over, ...d.over]), open: g.open, sites: d.sites };
}

/**
 * The ground of a chunk: bedrock, rock, soil, the sea bed, its water, caves and ores. It needs only
 * the lattice, never the peoples, so it can be laid at once and the world appears quickly; the
 * dressing follows (dressSteps).
 */
export function* groundSteps(seed, cx, cz) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK, x1 = x0 + CHUNK - 1, z1 = z0 + CHUNK - 1;
  planTrace.part = "columns";
  const columns = [], blocks = [], over = new Map();
  const byXZ = new Map();
  yield* warmNodes(seed, cx, cz);
  const blended = chunkColumns(seed, cx, cz);
  yield;
  for (let i = 0; i < 256; i++) {
    const c = column(seed, blended[i].x, blended[i].z, blended[i]);
    columns.push(c);
    byXZ.set(c.x * 65536 + c.z, c);
    if ((i & 63) === 63) yield;
  }
  const colAt = (x, z) => byXZ.get(x * 65536 + z) ?? null;
  const landTop = (x, z) => { const c = colAt(x, z); return c && c.land ? c.top : null; };
  const open = openOcean(seed, cx, cz);
  if (!open) {
    planTrace.part = "underground";
    // underground: caves (air, lava at their ends) and ore veins, as overrides of the column runs
    for (const [k, id] of cavesIn(seed, x0, z0, x1, z1, landTop)) over.set(k, id);
    const emeralds = columns.some((c) => c.land && BIOMES[c.biome].emerald);
    for (const v of veinsIn(seed, cx, cz, landTop, emeralds)) { const k = `${v.x},${v.y},${v.z}`; if (!over.has(k)) over.set(k, v.id); }
    yield;
  }
  return { cx, cz, columns, over, open, byXZ };
}

/**
 * The dressing of a chunk on its ground: what grows and stands on top (plants, snow, ice, kelp, coral,
 * seagrass, trees), geodes in the rock, and the sea sites and great structures, which ask after the
 * peoples. Returns { blocks, containers, over (blocks that replace ground), sites }.
 */
export function* dressSteps(seed, g) {
  const { cx, cz, columns, open, byXZ } = g;
  const x0 = cx * CHUNK, z0 = cz * CHUNK, x1 = x0 + CHUNK - 1, z1 = z0 + CHUNK - 1;
  const inside = (b) => b.x >= x0 && b.x <= x1 && b.z >= z0 && b.z <= z1;
  const blocks = [], over = new Map();
  const colAt = (x, z) => byXZ.get(x * 65536 + z) ?? null;
  const hpD = portNear(seed, x0, z0);
  if (!open) {
    planTrace.part = "surface";
    // what grows and stands on top
    const waterAt = (x, z) => { const c = colAt(x, z); return c ? !c.land : !columnAt(seed, x, z).land; };
    for (const col of columns) {
      const { x, z } = col, B = BIOMES[col.biome];
      if (col.city && col.land) continue;                       // the port's decks: nothing grows through them
      if (col.land) {
        if (col.c.crater) continue;
        if (col.snow) { blocks.push({ x, y: col.top + 1, z, id: "minecraft:snow_layer", states: {} }); continue; }
        let plant = plantAt(col.biome, x, z, seed);
        if (plant === "minecraft:reeds" && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => waterAt(x + a, z + b))) plant = null;
        if (plant === "minecraft:cactus" && !/sand/.test(B.top)) plant = null;
        if (plant) {
          blocks.push({ x, y: col.top + 1, z, id: plant, states: {} });
          if (plant === "minecraft:reeds" || plant === "minecraft:cactus") blocks.push({ x, y: col.top + 2, z, id: plant, states: {} });
        }
        continue;
      }
      const d = col.c.depth, r = rand(x, z, seed, 93);
      if (B.ice) { blocks.push({ x, y: SEA_LEVEL, z, id: r < 0.7 ? "minecraft:packed_ice" : "minecraft:ice", states: {} }); continue; }
      if (B.kelp && d >= 4 && r < B.kelp) {
        const n = Math.max(1, d - 2 - (hash(x, z, seed, 94) % 3));
        for (let i = 1; i <= n; i++) blocks.push({ x, y: col.top + i, z, id: "minecraft:kelp", states: { kelp_age: i === n ? 20 : 25 } });
        continue;
      }
      if (B.coral && d >= 2 && r < B.coral) {
        const kind = CORALS[hash(x, z, seed, 95) % CORALS.length];
        over.set(`${x},${col.top},${z}`, `minecraft:${kind}_coral_block`);
        if (d >= 3) blocks.push({ x, y: col.top + 1, z, id: r < B.coral * 0.3 ? "minecraft:sea_pickle" : `minecraft:${kind}_coral`, states: r < B.coral * 0.3 ? { cluster_count: hash(x, z, seed, 96) % 4, dead_bit: false } : {} });
        continue;
      }
      if (d >= 2 && d <= 14 && r < (B.grass ?? 0.06)) blocks.push({ x, y: col.top + 1, z, id: "minecraft:seagrass", states: {} });
    }
    yield;
    planTrace.part = "trees";
    // trees with trunks within reach of the chunk (only candidate cells are looked at)
    for (let tx = Math.floor((x0 - 3) / 3); tx <= Math.floor((x1 + 3) / 3); tx++) for (let tz = Math.floor((z0 - 3) / 3); tz <= Math.floor((z1 + 3) / 3); tz++) {
      const x = tx * 3 + (hash(tx, tz, seed, 51) % 3), z = tz * 3 + (hash(tx, tz, seed, 52) % 3);
      if (x < x0 - 3 || x > x1 + 3 || z < z0 - 3 || z > z1 + 3) continue;
      const c = colAt(x, z)?.c ?? columnAt(seed, x, z);
      if (hpD && cityKind(hpD, x, z)) continue;               // not through the port's decks
      const t = treeHere(seed, x, z, c);
      if (!t) continue;
      for (const b of treeBlocks(t.kind, x, c.top, z, t.h, seed)) if (inside(b)) blocks.push(b);
    }
    yield;
    planTrace.part = "geodes";
    // geodes: one in a few big islands' rock (per 48-block cell), amethyst within calcite
    for (let gx = Math.floor((x0 - 6) / 48); gx <= Math.floor((x1 + 6) / 48); gx++) for (let gz = Math.floor((z0 - 6) / 48); gz <= Math.floor((z1 + 6) / 48); gz++) {
      if (rand(gx, gz, seed, 321) > 0.12) continue;
      const ox = gx * 48 + 8 + (hash(gx, gz, seed, 322) % 32), oz = gz * 48 + 8 + (hash(gx, gz, seed, 323) % 32);
      const c = columnAt(seed, ox, oz);
      if (!c.land || c.top < SEA_LEVEL + 12 || c.special) continue;
      const oy = FLOOR_MIN + 10 + (hash(gx, gz, seed, 324) % Math.max(1, c.top - FLOOR_MIN - 24));
      for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) for (let k = -4; k <= 4; k++) {
        const dd = Math.hypot(a, b, k);
        if (dd > 4.3) continue;
        const p = { x: ox + a, y: oy + k, z: oz + b };
        if (!inside(p)) continue;
        over.set(`${p.x},${p.y},${p.z}`, dd > 3.5 ? "minecraft:smooth_basalt" : dd > 2.7 ? "minecraft:calcite" : dd > 1.9 ? (rand(p.x, p.y, p.z, seed, 325) < 0.1 ? "minecraft:budding_amethyst" : "minecraft:amethyst_block") : "minecraft:air");
      }
    }
  }
  yield;
  planTrace.part = "sites";
  // sea sites and the great structures
  const containers = [];
  const sites = (yield* sitesInSteps(seed, x0, z0, x1, z1)).filter((s) => !inPort(hpD, s.x, s.z, 24));
  for (const s of sites) {
    if (!siteCache.has(`s:${s.id}`)) { const built = yield* siteSteps(s, climate(seed, s.x, s.z).key); cached(`s:${s.id}`, () => built); }
    const b = siteCache.get(`s:${s.id}`);
    for (const p of b.blocks) if (inside(p)) blocks.push(p);
    for (const k of b.containers) if (inside(k)) containers.push({ ...k, site: s });
  }
  yield;
  planTrace.part = "structures";
  for (const st of structuresIn(seed, x0, z0, x1, z1).filter((t) => !inPort(hpD, t.x, t.z, 24))) {
    if (!siteCache.has(`t:${st.id}`)) { const built = yield* structureSteps(seed, st); cached(`t:${st.id}`, () => built); }
    const b = siteCache.get(`t:${st.id}`);
    for (const p of b.blocks) if (inside(p)) blocks.push(p);
    for (const k of b.containers) if (inside(k)) containers.push({ ...k, site: st });
  }
  // the homeport's buildings: its light tower, its heart, and each tradition's quarter
  if (hpD && inPort(hpD, x0 + 8, z0 + 8, 12)) {
    planTrace.part = "port";
    blocks.push(...(yield* cityBlocksSteps(seed, hpD, cx, cz)));
  }
  return { blocks, containers, over, sites: sites.filter((s) => s.x >= x0 && s.x <= x1 && s.z >= z0 && s.z <= z1) };
}

/**
 * How to lay a planned chunk with as few game calls as possible: the bedrock floor, the deep base
 * (deepslate then stone, under every column), the sea's water, then each level above the base (and
 * wherever caves, ores or geodes change the base) as the fewest rectangles of one block that cover
 * it (single blocks as plain sets), then everything standing on top. Typed arrays and numbered
 * blocks throughout: this runs in the game's interpreter.
 * Returns [{ op: "fill", a, b, id } | { op: "set", x, y, z, id, states }].
 */
export function layPlan(p) {
  const ops = [];
  const x0 = p.cx * CHUNK, z0 = p.cz * CHUNK, x1 = x0 + CHUNK - 1, z1 = z0 + CHUNK - 1;
  const cols = p.columns;
  let minTop = Infinity, maxY = -Infinity, minWater = Infinity;
  for (const c of cols) {
    if (c.top < minTop) minTop = c.top;
    if (c.solidTop > maxY) maxY = c.solidTop;
    if (c.water && c.water[0] < minWater) minWater = c.water[0];
  }
  const baseTop = minTop - 4;
  ops.push({ op: "fill", a: { x: x0, y: FLOOR_MIN, z: z0 }, b: { x: x1, y: FLOOR_MIN, z: z1 }, id: "minecraft:bedrock" });
  if (baseTop >= FLOOR_MIN + 1) ops.push({ op: "fill", a: { x: x0, y: FLOOR_MIN + 1, z: z0 }, b: { x: x1, y: Math.min(DEEPSLATE_TOP, baseTop), z: z1 }, id: "minecraft:deepslate" });
  if (baseTop > DEEPSLATE_TOP) ops.push({ op: "fill", a: { x: x0, y: DEEPSLATE_TOP + 1, z: z0 }, b: { x: x1, y: baseTop, z: z1 }, id: "minecraft:stone" });
  if (minWater !== Infinity) ops.push({ op: "fill", a: { x: x0, y: minWater, z: z0 }, b: { x: x1, y: SEA_LEVEL, z: z1 }, id: "minecraft:water" });
  // numbered blocks
  const names = [null], num = new Map();
  const id = (n) => { let v = num.get(n); if (v === undefined) { v = names.length; names.push(n); num.set(n, v); } return v; };
  const DEEP = id("minecraft:deepslate"), STONE = id("minecraft:stone");
  // the levels to lay: above the base, and down to the lowest override
  let yLo = baseTop + 1;
  if (p.over) for (const k of p.over.keys()) { const y = +k.split(",")[1]; if (y < yLo) yLo = y; }
  yLo = Math.max(FLOOR_MIN + 1, yLo);
  const H = maxY - yLo + 1;
  if (H > 0) {
    const grid = new Uint16Array(256 * H);                      // 0: nothing to lay
    for (let i = 0; i < 256; i++) {
      const c = cols[i];
      for (const [y0, y1, n] of c.layers) {
        if (n === "minecraft:bedrock") continue;
        const v = id(n);
        for (let y = Math.max(y0, yLo); y <= y1; y++) {
          if (y <= baseTop && (y <= DEEPSLATE_TOP ? v === DEEP : v === STONE)) continue;   // the base laid it
          grid[(y - yLo) * 256 + i] = v;
        }
      }
    }
    if (p.over) for (const [k, n] of p.over) {
      const [x, y, z] = k.split(",").map(Number);
      if (x < x0 || x > x1 || z < z0 || z > z1 || y < yLo || y > maxY) continue;
      const i = (x - x0) * 16 + (z - z0);
      if (y > cols[i].solidTop) continue;                          // overrides only change what's there
      grid[(y - yLo) * 256 + i] = id(n);
    }
    const done = new Uint8Array(256);
    for (let L = 0; L < H; L++) {
      const base = L * 256, y = yLo + L;
      done.fill(0);
      for (let i = 0; i < 16; i++) for (let k = 0; k < 16; k++) {
        const at = i * 16 + k;
        if (done[at]) continue;
        const v = grid[base + at];
        if (!v) continue;
        let kk = k;
        while (kk < 15 && !done[at + (kk - k) + 1] && grid[base + i * 16 + kk + 1] === v) kk++;
        let ii = i;
        grow: while (ii < 15) {
          for (let q = k; q <= kk; q++) { const j = (ii + 1) * 16 + q; if (done[j] || grid[base + j] !== v) break grow; }
          ii++;
        }
        for (let a2 = i; a2 <= ii; a2++) for (let q = k; q <= kk; q++) done[a2 * 16 + q] = 1;
        if (ii === i && kk === k) ops.push({ op: "set", x: x0 + i, y, z: z0 + k, id: names[v], states: {} });
        else ops.push({ op: "fill", a: { x: x0 + i, y, z: z0 + k }, b: { x: x0 + ii, y, z: z0 + kk }, id: names[v] });
      }
    }
  }
  for (const b of p.blocks) ops.push({ op: "set", x: b.x, y: b.y, z: b.z, id: b.id, states: b.states ?? {} });
  return ops;
}
