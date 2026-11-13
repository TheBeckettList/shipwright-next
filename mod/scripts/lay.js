// Lays the world's chunks in the game, from game/ground.js, in three passes a chunk can stop between (rings.js
// says which a chunk needs, by how near a player is):
//   surface  the bedrock, the province's rock in one fill to under the lowest column, each column up to its
//            soil and top, the water: the world as seen from above, at a fraction of the cost
//   life     the towns' ways and walls, the structures, what grows; the folk come out only near (rings.js)
//   deep     the rock's own beds, ores, caves and tubes (game/strata.js), under every column no structure stands on
// A generator: it yields as it goes, so the game keeps its frame rate (system.runJob). Each pass sets the
// chunk's mark (its north-west corner on the world's floor) last: structure void a surface, deny a life, a
// barrier all three (a chunk laid whole before the passes is a barrier too).
import { BlockPermutation, BlockVolume, system } from "@minecraft/server";
import { chunkColumnsSteps, iceAt, treeAt, plantAt, seaLifeAt, riverLifeAt, theraUV, SEA, BOTTOM } from "./game/ground.js";
import { columnRock, provinceOf, PROVINCES, DEEPSLATE } from "./game/strata.js";
import { CALIBRATION } from "./game/calibration.js";
import { POOLDRESS, POOLFISH } from "./data/structures.js";
const WATERBORN = new Set(["minecraft:tropicalfish", "minecraft:pufferfish", "minecraft:axolotl", "minecraft:salmon", "minecraft:cod", "minecraft:glow_squid", "minecraft:tadpole"]);   // the pools' own swimmers: the water keeps them; the park's beasts are leashed (main.js park)
import { PALETTE, PROTOS, ROT, PLACEMENTS, BY_CHUNK, PAINTS, PAINT_BY, WALLS, WALL_BY } from "./data/structures.js";
import { RESIDENTS, FOLK_BY_CHUNK, NAMES, CULTURES } from "./data/folk.js";
import { golden } from "./core/golden.js";
import { GROWN_BY, BEAST_TYPES, BEASTS, BEAST_BY } from "./data/grown.js";
import { b64 } from "./b64.js";
/** A prototype's blocks [x, y, z, palette index, ...], decoded from its base64 Int16Array the first time it's laid (the baked data stays a string till then: a fraction of the memory). */
export const flatOf = (P) => { if (!P._f) { const u = b64(P.f), buf = new ArrayBuffer(u.length); new Uint8Array(buf).set(u); P._f = new Int16Array(buf); } return P._f; };
export const FOLK = "waterworld:folk";
/** A folk's name and people. */
export function folkName(f) {
  if (f[4] < 0) return "Sea warden of the League";
  const t = CULTURES[f[4]], L = NAMES[t] ?? NAMES.european; return L[Math.floor(golden(f[5]) * L.length)];
}
/** Bring a chunk's folk out (once: the chunk's mark keeps them from coming twice). */
export function spawnFolk(dim, cx, cz) {
  let n = 0;
  for (const k of FOLK_BY_CHUNK[`${cx},${cz}`] ?? []) {
    const f = RESIDENTS[k];
    try {
      const e = dim.spawnEntity(FOLK, { x: f[0] + 0.5, y: f[1], z: f[2] + 0.5 });
      e.setProperty("waterworld:skin", f[3]); e.nameTag = folkName(f); e.setDynamicProperty("waterworld:folk", k); n++;
    } catch (err) { fails++; }
  }
  return n;
}

export const MARK = "minecraft:barrier";
export const MARKS = ["minecraft:bedrock", "minecraft:structure_void", "minecraft:deny", MARK];   // the corner by level: nothing yet, surface, life, all
import { LEVEL } from "./rings.js";
export { LEVEL };
const C = 16;   // given: a chunk's side
const perms = new Map();
export function perm(id, states) {
  const key = states ? `${id}|${JSON.stringify(states)}` : id;
  let p = perms.get(key);
  if (!p) {
    try { p = BlockPermutation.resolve(id, states ?? undefined); } catch { try { p = BlockPermutation.resolve(id); } catch { p = BlockPermutation.resolve("minecraft:stone"); } }
    perms.set(key, p);
  }
  return p;
}
const palPerm = (k) => { const e = PALETTE[k]; return perm(e[0], e[1]); };
let fails = 0;
export const failures = () => fails;
export const COUNT = { fill: 0, set: 0, vol: 0, js: 0 };   // what the layer did (the probes read it): calls, blocks filled, ms in the sim's own reckoning
function fill(dim, x0, y0, z0, x1, y1, z1, id) {
  if (y1 < y0) return;
  COUNT.fill++; COUNT.vol += (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
  dim.fillBlocks(new BlockVolume({ x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 }), typeof id === "string" ? perm(id) : id);
}
function set(dim, x, y, z, p, waterlog = false) {
  COUNT.set++;
  try {
    dim.setBlockPermutation({ x, y, z }, p);
    if (waterlog) dim.getBlock({ x, y, z })?.setWaterlogged?.(true);
  } catch { fails++; }
}
export const levelAt = (dim, cx, cz) => { try { return Math.max(0, MARKS.indexOf(dim.getBlock({ x: cx * C, y: BOTTOM, z: cz * C })?.typeId)); } catch { return 0; } };
export const isDone = (dim, cx, cz) => levelAt(dim, cx, cz) === LEVEL.deep;
const plans = new Map();   // the last few chunks' columns (the passes share them)
/** A chunk's columns, reckoned a row a step (the layer's steps stay short) and kept: the passes share them. */
function* planSteps(cx, cz) {
  const k = `${cx},${cz}`; let p = plans.get(k); if (p) return p;
  const g = chunkColumnsSteps(cx, cz, { mesh: BY_CHUNK[k] || GROWN_BY[k] ? 0 : MESH }); let r;   // a town's ground exact (it was grown on it)
  for (;;) { const t0 = Date.now(); r = g.next(); COUNT.js += Date.now() - t0; if (r.done) break; yield; }
  p = r.value; plans.set(k, p); if (plans.size > FIB_PLANS) plans.delete(plans.keys().next().value); return p;
}
/** The plan the layer lays a chunk by, reckoned whole (the probes check the ground against it). */
export function planNow(cx, cz) { const g = planSteps(cx, cz); let r; while (!(r = g.next()).done); return r.value; }
const ICE = "minecraft:ice";   // an id, not a permutation: nothing native may run while the script loads
const MESH = 3;   // vision: the relief reckoned on a lattice of three blocks (game/ground.js reliefMesh), exact where a town stands
const FIB_PLANS = 144;   // vision: a hundred and forty-four chunks' columns kept (a flier's ring ahead, reckoned before it loads)
const mark = (dim, cx, cz, level) => set(dim, cx * C, BOTTOM, cz * C, perm(MARKS[level]));
/** Work the sim ahead of the layer: a chunk's columns reckoned (and kept) before it's laid, in spare time. */
export function* planAhead(cx, cz) { yield* planSteps(cx, cz); }
/** Is a chunk loaded (so it can be laid)? The game's own answer where it has one, else a probe block's; asked
 *  once a tick a chunk (the layer's search asks of hundreds, and an unloaded chunk answers by throwing). */
const loadedNow = { tick: -1, m: new Map() };
export function isLoaded(dim, cx, cz) {
  const t = system.currentTick; if (loadedNow.tick !== t) { loadedNow.tick = t; loadedNow.m.clear(); }
  const k = cx * 65536 + cz; let v = loadedNow.m.get(k); if (v !== undefined) return v;
  const at = { x: cx * C + 8, y: 0, z: cz * C + 8 };
  try { v = typeof dim.isChunkLoaded === "function" ? dim.isChunkLoaded(at) : !!dim.getBlock(at); } catch { v = false; }
  loadedNow.m.set(k, v); return v;
}

/** A column's foot: as deep as the skin goes, three under the lowest of it and its four neighbours (so a cliff's
 *  face is skinned down to the ground at its foot, and the skin's last block is rock: nothing that falls). */
export const footOf = (c) => c.top - c.rise - FIB3;
const FIB3 = 3;   // derived: Fibonacci's three, the soil's two and a block of rock under them
/** The surface pass, the skin: each column from its foot to its top, and the water. No bedrock and no body: what a
 *  player sees from the air or a deck is the skin, and the body (the deep pass) waits till someone could dig to it.
 *  Under the skin is open void, which nothing spawns in (no floor) and the world file doesn't store. */
export function* surfaceChunk(dim, cx, cz) {
  const plan = yield* planSteps(cx, cz), cols = plan.cols, x0 = cx * C, z0 = cz * C;
  const thera = !!theraUV(x0 + 8, z0 + 8);
  const low = Math.min(...cols.map((c) => c.top)), P = PROVINCES[provinceOf(plan.climate, low, thera)] ?? PROVINCES.temperate, base = P.beds[0];
  // each row's runs of like columns (the same top, soil and top block) in one fill apiece: the sea floor and the
  // flats come in a few long runs, so the surface costs a fraction of the column-by-column laying
  for (let j = 0; j < C; j++) {
    let i = 0;
    while (i < C) {
      const c = cols[j * C + i], key = `${c.top}|${c.under}|${c.topId}|${c.water}|${c.frozen}`; let e = i, foot = footOf(c);
      while (e + 1 < C && `${cols[j * C + e + 1].top}|${cols[j * C + e + 1].under}|${cols[j * C + e + 1].topId}|${cols[j * C + e + 1].water}|${cols[j * C + e + 1].frozen}` === key) { e++; foot = Math.min(foot, footOf(cols[j * C + e])); }
      const xa = x0 + i, xb = x0 + e, z = c.z, a = Math.max(BOTTOM + 1, foot);
      if (a < DEEPSLATE) fill(dim, xa, a, z, xb, Math.min(c.top - 3, DEEPSLATE - 1), z, P.deep);
      fill(dim, xa, Math.max(a, DEEPSLATE), z, xb, c.top - 3, z, base);
      fill(dim, xa, c.top - 2, z, xb, c.top - 1, z, c.under);
      fill(dim, xa, c.top, z, xb, c.top, z, perm(c.topId));
      if (c.top < SEA) fill(dim, xa, c.top + 1, z, xb, SEA, z, "minecraft:water");
      if (c.water) fill(dim, xa, c.top + 1, z, xb, c.water, z, "minecraft:water");   // a river's water (or the tarn's)
      if (c.frozen && c.water) fill(dim, xa, c.water, z, xb, c.water, z, "minecraft:packed_ice");   // the Arctic tarn, frozen over (packed ice never melts)
      i = e + 1;
    }
    for (let i = 0; i < C; i++) { if (!iceAt(cols[j * C + i])) continue; let e = i; while (e + 1 < C && iceAt(cols[j * C + e + 1])) e++; fill(dim, x0 + i, SEA, z0 + j, x0 + e, SEA, z0 + j, ICE); i = e; }   // the sea's ice by its own columns, in runs (its edge in floes)
    if (j % 2) yield;
  }
  mark(dim, cx, cz, LEVEL.surface);
}

/** A grown settlement's chunk (data/grown.js): { mask (no tree), cols: [[column, [[y, n, palette], ...]], ...] }, or null. */
const grownCache = new Map();
function grownOf(cx, cz) {
  const k = `${cx},${cz}`; if (grownCache.has(k)) return grownCache.get(k);
  const s = GROWN_BY[k]; let g = null;
  if (s) { const u = b64(s), mask = u.subarray(0, 32), cols = [], yb = (u[32] | (u[33] << 8)) - 64, np = u[34], kinds = []; let o = 35;   // given: 256 columns' bits; the world's floor at -64
    for (let q = 0; q < np; q++, o += 2) kinds.push(u[o] | (u[o + 1] << 8));
    while (o < u.length) { const col = u[o], n = u[o + 1]; o += 2; const runs = []; for (let r = 0; r < n; r++, o += 3) runs.push([yb + u[o], u[o + 1], kinds[u[o + 2]]]); cols.push([col, runs]); }
    g = { mask, cols, changed: new Set(cols.map((c) => c[0])) }; }
  grownCache.set(k, g); if (grownCache.size > 64) grownCache.delete(grownCache.keys().next().value);   // vision: as many as the columns kept
  return g;
}
/** Bring a grown chunk's beasts out (once, as the folk). */
function spawnBeasts(dim, cx, cz) { for (const k of BEAST_BY[`${cx},${cz}`] ?? []) { const [t, x, y, z] = BEASTS[k]; try { dim.spawnEntity(BEAST_TYPES[t], { x: x + 0.5, y, z: z + 0.5 }); } catch { fails++; } } }

/** The columns a structure stands on (the deep pass leaves them as the surface laid them), each with the lowest block
 *  of what stands there (its prototype's base): the body is filled only under that, so a house set lower than the
 *  skin's foot (cut into a slope, or a floor under the hill) keeps its rooms. */
function coveredOf(cx, cz) {
  const x0 = cx * C, z0 = cz * C, covered = new Map();
  for (const k of BY_CHUNK[`${cx},${cz}`] ?? []) { const a = PLACEMENTS[k], base = a[5] & 4 ? Infinity : a[2] + PROTOS[a[0]].b[2];   // the prototype's bounds [x0, x1, y0, y1, z0, z1]: y doesn't turn; a free piece (a skyway's deck, the park) stands over the ground, not on it, so the body under it goes up to the skin as before   // given: the placement's flag bits (data/structures.js: 1 stilts, 2 carved, 4 free)
    for (let x = Math.max(a[6], x0); x <= Math.min(a[8], x0 + C - 1); x++) for (let z = Math.max(a[7], z0); z <= Math.min(a[9], z0 + C - 1); z++) { const q = (z - z0) * C + (x - x0); covered.set(q, Math.min(covered.get(q) ?? Infinity, base)); } }
  return covered;
}

/** The life pass: the towns' ways and walls, the structures, what grows. folk: bring the chunk's folk out too. */
export function* lifeChunk(dim, cx, cz, { folk = true } = {}) {
  const plan = yield* planSteps(cx, cz), cols = plan.cols.map((c) => ({ ...c })), x0 = cx * C, z0 = cz * C;
  let n = 0;
  // the towns' paved ways and plazas, on the ground as it lies; their walls
  const inChunk = (x, z) => x >= x0 && x < x0 + C && z >= z0 && z < z0 + C;
  for (const k of PAINT_BY[`${cx},${cz}`] ?? []) {
    const q = PAINTS[k], pp = palPerm(q[1]);
    for (const c of cols) {
      let on;
      if (q[0] === "r") on = c.x >= q[2] && c.x < q[2] + q[4] && c.z >= q[3] && c.z < q[3] + q[5];
      else { const [, , ax, az, bx, bz, w] = q, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / L2)); on = Math.hypot(c.x - (ax + t * dx), c.z - (az + t * dz)) <= w / 2; }   // within half the street's width of its line
      if (on && c.top > SEA && !c.kind) { set(dim, c.x, c.top, c.z, pp); c.paved = true; }
    }
  }
  for (const k of WALL_BY[`${cx},${cz}`] ?? []) {
    const [shape, id, h, tx, tz, R, gates] = WALLS[k], wp = palPerm(id);
    for (const c of cols) {
      const dx = c.x - tx, dz = c.z - tz, r = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
      let on = false;
      if (shape === "c") on = Math.abs(r - R) < 0.75;   // given: a ring a block thick, no gaps on the diagonal
      else for (let i = 0; i < R.length && !on; i += 2) { const ax = R[i], az = R[i + 1], bx = R[(i + 2) % R.length], bz = R[(i + 3) % R.length], ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((c.x - ax) * ex + (c.z - az) * ez) / L2)); on = Math.hypot(c.x - (ax + t * ex), c.z - (az + t * ez)) < 0.75; }
      if (on) for (let g = 0; g < gates.length; g += 2) if (Math.abs(Math.atan2(Math.sin(a - gates[g]), Math.cos(a - gates[g]))) * r < gates[g + 1] / 2 + 1) on = false;   // the gate: the street's width and a block
      if (on && c.top > SEA) { fill(dim, c.x, c.top + 1, c.z, c.x, c.top + h, c.z, wp); c.paved = true; }
    }
  }
  yield;
  // the structures baked for this chunk, clipped to it: foundations, then their blocks
  const covered = new Set();
  for (const k of BY_CHUNK[`${cx},${cz}`] ?? []) {
    const a = PLACEMENTS[k], pl = { p: a[0], x: a[1], y: a[2], z: a[3], f: a[4], s: a[5] & 1, c: a[5] & 2, free: a[5] & 4, b: [a[6], a[7], a[8], a[9]] }, P = PROTOS[pl.p], fp = palPerm(pl.f);   // free: a way in the air (a skyway), no foundation and nothing covered under it
    const bx0 = Math.max(pl.b[0], x0), bx1 = Math.min(pl.b[2], x0 + C - 1), bz0 = Math.max(pl.b[1], z0), bz1 = Math.min(pl.b[3], z0 + C - 1);
    if (!pl.free) for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) {
      covered.add((z - z0) * C + (x - x0));
      const top = cols[(z - z0) * C + (x - x0)].top;
      const corner = (x === pl.b[0] || x === pl.b[2]) && (z === pl.b[1] || z === pl.b[3]);
      if (!pl.s || corner) fill(dim, x, top + 1, z, x, pl.y - 1, z, fp);
      if (pl.c) fill(dim, x, pl.y + 1, z, x, top, z, "minecraft:air");   // cut into the slope
    }
    yield;
    const f = flatOf(P), turn = (a[5] >> 3) & 3, rot = turn ? ROT[turn - 1] : null;   // the base proto turned as it's laid (its block states by ROT)
    for (let i = 0; i < f.length; i += 4) {
      let dx = f[i], dz = f[i + 2]; for (let t = 0; t < turn; t++) [dx, dz] = [-dz, dx];
      const x = pl.x + dx, y = pl.y + f[i + 1], z = pl.z + dz;
      if (x < x0 || x >= x0 + C || z < z0 || z >= z0 + C) continue;
      set(dim, x, y, z, palPerm(rot ? rot[f[i + 3]] : f[i + 3]));
      if (i % 256 === 0) yield;
    }
  }
  // a grown settlement's blocks (data/grown.js): each column's runs, a fill apiece
  const grown = grownOf(cx, cz);
  if (grown) for (const [col, runs] of grown.cols) {
    const x = x0 + (col & 15), z = z0 + (col >> 4);
    for (const [y, len, pi] of runs) fill(dim, x, y, z, x, y + len - 1, z, palPerm(pi));
    covered.add(col); if (++n % 16 === 0) yield;   // vision: sixteen columns a breath
  }
  for (const [x, y, z, id] of POOLDRESS) if (Math.floor(x / C) === cx && Math.floor(z / C) === cz) set(dim, x, y, z, perm(id));   // the cascading pools' life (their coral, roots, lily pads)
  if (folk) { spawnFolk(dim, cx, cz); spawnBeasts(dim, cx, cz); for (const [t, x, y, z] of POOLFISH) if (Math.floor(x / C) === cx && Math.floor(z / C) === cz) { try { const e = dim.spawnEntity(t, { x: x + 0.5, y, z: z + 0.5 }); if (!WATERBORN.has(t)) { e.addTag("ww_park"); e.addTag(`ww_home:${x}:${y}:${z}`); } } catch {} } }   // and their fish
  yield;
  // what grows
  const cl = plan.climate, biomeRec = cl.biome;
  n = 0;
  for (const c of cols) {
    if (covered.has(c.j * C + c.i) || c.paved) continue;
    if (c.water) { const life = riverLifeAt(c); if (life) for (const [dy, id, st] of life) set(dim, c.x, c.top + dy, c.z, perm(id, st)); continue; }   // a river's lily pads and seagrass
    if (c.top < SEA) {
      const life = seaLifeAt(c, cl);
      if (life) for (const [dy, id, st, wl] of life) set(dim, c.x, c.top + dy, c.z, perm(id, st), wl);
    } else {
      const tree = grown && grown.mask[(c.j * C + c.i) >> 3] & (1 << ((c.j * C + c.i) & 7)) ? null : treeAt(c, biomeRec);   // no tree into a grown town's buildings
      if (tree) for (const [dx, dy, dz, id, st] of tree) set(dim, c.x + dx, c.top + dy, c.z + dz, perm(id, st));
      else {
        const p = plantAt(c, biomeRec);
        if (c.cap) set(dim, c.x, c.top + 1, c.z, perm(c.cap));
        else if (p) set(dim, c.x, c.top + 1, c.z, perm(p));
      }
    }
    if (++n % 32 === 0) yield;
  }
  mark(dim, cx, cz, LEVEL.life);
}

/** The deep pass: the rock's beds, ores, caves and tubes, under every column no structure stands on. */
export function* deepChunk(dim, cx, cz) {
  const plan = yield* planSteps(cx, cz), cols = plan.cols, x0 = cx * C, z0 = cz * C, covered = coveredOf(cx, cz);
  const thera = !!theraUV(x0 + 8, z0 + 8), rise = Math.max(0, plan.climate.h);
  const rocks = [];
  for (let j = 0; j < C; j++) { const tr = Date.now(); for (let i = 0; i < C; i++) { const c = cols[j * C + i]; rocks.push(columnRock({ x: c.x, z: c.z, top: c.top - 2 }, provinceOf(plan.climate, c.top, thera), rise, c.under)); } COUNT.js += Date.now() - tr; yield; }   // the rock reckoned a row a step
  fill(dim, x0, BOTTOM, z0, x0 + C - 1, BOTTOM, z0 + C - 1, "minecraft:bedrock"); mark(dim, cx, cz, LEVEL.life);   // the floor, and the corner's mark kept (a pass cut short lays again from life)
  { const P = PROVINCES[provinceOf(plan.climate, Math.min(...cols.map((c) => c.top)), thera)] ?? PROVINCES.temperate;   // the body under what stands on the ground (its columns keep their skin; the rock's beds go round them)
    for (const c of cols) if (covered.has(c.j * C + c.i)) { const f = Math.min(Math.max(BOTTOM + 1, footOf(c)), covered.get(c.j * C + c.i)) - 1; fill(dim, c.x, BOTTOM + 1, c.z, c.x, Math.min(f, DEEPSLATE - 1), c.z, P.deep); fill(dim, c.x, DEEPSLATE, c.z, c.x, f, c.z, P.beds[0]); } }
  yield;
  for (let j = 0; j < C; j++) {
    const runs = new Map();   // "y0,y1,id" -> [start i, last i]
    const flush = (k, r) => { const [y0, y1, id] = k.split("|"); fill(dim, x0 + r[0], +y0, z0 + j, x0 + r[1], +y1, z0 + j, id); };
    for (let i = 0; i < C; i++) {
      const seen = new Set();
      if (!covered.has(j * C + i)) for (const [y0, y1, id] of rocks[j * C + i].segs) { const k = `${y0}|${y1}|${id}`; seen.add(k); const r = runs.get(k); if (r && r[1] === i - 1) r[1] = i; else { if (r) flush(k, r); runs.set(k, [i, i]); } }
      for (const [k, r] of runs) if (!seen.has(k) && r[1] === i - 1) { flush(k, r); runs.delete(k); }
    }
    for (const [k, r] of runs) flush(k, r);
    yield;
  }
  let n = 0;
  for (const c of cols) {
    if (covered.has(c.j * C + c.i)) continue;
    const R = rocks[c.j * C + c.i];
    for (const [y, id] of R.sets) set(dim, c.x, y, c.z, perm(id));
    for (const [y0, y1] of R.air) fill(dim, c.x, y0, c.z, c.x, y1, c.z, "minecraft:air");
    for (const [y0, y1] of R.water) fill(dim, c.x, y0, c.z, c.x, y1, c.z, "minecraft:water");
    if (++n % CALIBRATION.columnsPerYield === 0) yield;
  }
  mark(dim, cx, cz, LEVEL.deep);
}

/** Lay a chunk up to a level (each pass it hasn't had, in order). Throws (and keeps the last mark) if it unloads. */
export function* layTo(dim, cx, cz, level, { folk = true } = {}) {
  let at = levelAt(dim, cx, cz);
  if (at < LEVEL.surface && level >= LEVEL.surface) { yield* surfaceChunk(dim, cx, cz); at = LEVEL.surface; }
  if (at < LEVEL.life && level >= LEVEL.life) { yield* lifeChunk(dim, cx, cz, { folk }); at = LEVEL.life; }
  if (at < LEVEL.deep && level >= LEVEL.deep) yield* deepChunk(dim, cx, cz);
}
/** Lay one chunk whole (all three passes). */
export function* layChunk(dim, cx, cz) { yield* layTo(dim, cx, cz, LEVEL.deep); }
