// inherency: instrument
// Phase 2 of the build-out (handover/design/world-buildout.md): a grown town kept as its plan, not its blocks.
//
// A grown town's blocks are a pure function of a few things the grow decided: where each building stands and which
// building it is (its recipe: buildOf's kind, seed and storeys over, or a split part of one), the lanes, plots, farms,
// gardens, walls and wilds of the place, and the ground, which is the game's own (game/ground.js) and so is not kept.
// planOf takes a grown place to that record; layOf lays a record back to the exact blocks the grow laid, without
// growing (no census, no crystal, no claims): the proof (tools/replay.mjs) is that the two come out block for block.
//
// Nothing here is in the grown towns' closure (bakegrown.mjs sourceHash): it imports the closure, never the reverse.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIB } from "../core/golden.js";
import { loadMap } from "../world/load.js";
import { map } from "../world/map.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PLANS = path.join(ROOT, "lab/plans");
export const planFile = (key) => path.join(PLANS, `${key.replace(/[^\w]/g, "_")}.json`);
export const VERSION = 1;   // vision: the plan record's own version, bumped when its shape changes

// What layPlace reads of a grown place (world/district.js layPlace), and so all a plan keeps of one.
const KEEP = ["placed", "farms", "spine", "bridges", "stilted", "streets", "wall", "buffer", "wild", "gaps", "grown"];
// A placement's own fields that are its building, not its placing: rebuilt from the recipe.
const BUILT = new Set(["b", "atom", "parts", "tall"]);

const STEPS = [[0, 1], [0, -1], [1, 0], [-1, 0]];   // given: a cell's four neighbours

/** JSON for the place's shapes: Maps, Sets and arrays kept, functions and buildings' voxels refused. */
export function enc(v, where = "place") {
  if (v === null || typeof v !== "object") {
    if (typeof v === "function") return undefined;
    if (typeof v === "number" && !Number.isFinite(v)) return { $n: String(v) };
    return v;
  }
  if (v instanceof Map) {
    if (v.size && /^-?\d+,-?\d+,-?\d+$/.test(v.keys().next().value)) throw new Error(`a building's voxels at ${where}: keep its recipe instead`);
    return { $map: [...v].map(([k, x], i) => [enc(k, `${where}[${i}]`), enc(x, `${where}[${i}]`)]) };
  }
  if (v instanceof Set) return { $set: [...v].map((x, i) => enc(x, `${where}[${i}]`)) };
  if (ArrayBuffer.isView(v)) return { $ta: v.constructor.name, d: Array.from(v) };
  if (Array.isArray(v) && v.length > FIB[4] && v.every((c) => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1]))) {
    // a list of cells (a gap's, a fence's): straight runs, a step of one along x or z either way, in their own order:
    // [x, z, n, d, ...] with d the step (STEPS)   // vision: worth it past five cells
    const r = [];
    for (const [x, z] of v) {
      const k = r.length - 4;
      if (k >= 0) { const [sx, sz] = STEPS[r[k + 3]], n = r[k + 2]; if (r[k] + sx * n === x && r[k + 1] + sz * n === z) { r[k + 2]++; continue; } if (n === 1) { const d = STEPS.findIndex(([a2, b2]) => r[k] + a2 === x && r[k + 1] + b2 === z); if (d >= 0) { r[k + 3] = d; r[k + 2] = 2; continue; } } }
      r.push(x, z, 1, 0);
    }
    return { $cells: r };
  }
  if (Array.isArray(v)) return v.map((x, i) => enc(x, `${where}[${i}]`) ?? null);
  const o = {};
  for (const [k, x] of Object.entries(v)) { const e = enc(x, `${where}.${k}`); if (e !== undefined) o[k] = e; }
  return o;
}
export function dec(v) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(dec);
  if ("$n" in v) return Number(v.$n);
  if ("$runs" in v) { const out = [], r = v.$runs; for (let k = 0; k < r.length; k += 3) for (let i = 0; i < r[k + 2]; i++) out.push([r[k], r[k + 1] + i]); return out; }   // plans stored before the runs took either way
  if ("$cells" in v) { const out = [], r = v.$cells; for (let k = 0; k < r.length; k += 4) { const [sx, sz] = STEPS[r[k + 3]]; for (let i = 0; i < r[k + 2]; i++) out.push([r[k] + sx * i, r[k + 1] + sz * i]); } return out; }
  if ("$map" in v) return new Map(v.$map.map(([k, x]) => [dec(k), dec(x)]));
  if ("$set" in v) return new Set(v.$set.map(dec));
  if ("$ta" in v) return new globalThis[v.$ta](v.d);
  const o = {}; for (const [k, x] of Object.entries(v)) o[k] = dec(x); return o;
}

/**
 * Each placement's recipe. A body is buildOf(id, t, seed, null, { slope, up, dense, split }) (growth.js make), so its
 * recipe is { id, seed, up }; a split part is the i-th of its body's parts, { id, seed, up, part: i }. A placement whose
 * building matches neither is refused: the plan would not lay it back.
 */
function recipes(placed, rebuild) {
  const out = [];
  const tryMake = (id, seed, up) => { try { return rebuild(id, seed, up); } catch { return null; } };   // a part's own id (a form) is no building kind
  for (const [n, p] of placed.entries()) {
    const up = p.up ?? 0, whole = tryMake(p.id, p.seed, up);
    // a whole building (a body, or a farmstead's outbuilding, whose `of` is its farmhouse) is its own recipe's
    if (whole && whole.vox.size === p.b.vox.size && sameVox(whole.vox, p.b.vox)) { out.push({ id: p.id, seed: p.seed, up }); continue; }
    // a split part: the i-th part of its body (the placement `of` names), or of a building of its own kind and seed
    const owners = [placed[p.of], { id: p.id, seed: p.seed, up }].filter((q) => q && q.id !== undefined);
    let hit = null;
    for (const q of owners) {
      const body = tryMake(q.id, q.seed, q.up ?? 0); if (!body) continue;
      let part = (body.parts ?? []).findIndex((pt) => pt.vox === p.b.vox);
      if (part < 0) part = (body.parts ?? []).findIndex((pt) => sameVox(pt.vox, p.b.vox));
      if (part >= 0) { hit = { id: q.id, seed: q.seed, up: q.up ?? 0, part }; break; }
    }
    if (!hit) throw new Error(`placement ${n} (${p.id}, seed ${p.seed}, of ${p.of}) is no recipe's building nor part`);
    out.push(hit);
  }
  return out;
}
function sameVox(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, x] of a) { const y = b.get(k); if (!y || y.id !== x.id || JSON.stringify(y.s ?? null) !== JSON.stringify(x.s ?? null)) return false; }
  return true;
}

/** The town's building maker, as growth.js growOf makes them (its cache: one building a recipe). */
export async function makerOf(t, slope, dense) {
  const { buildOf } = await import("../world/census.js");
  const cache = new Map();
  return (id, seed, up = 0) => { const k = `${id}|${seed}|${up}`; if (!cache.has(k)) cache.set(k, buildOf(id, t, seed, null, { slope, up, dense, split: true })); return cache.get(k); };
}

/** The slope cityOf grows a town on, read off the game's ground round its heart (world/cities.js slopeAt). */
export function slopeOf(ground) {
  const gx = ground.h(FIB[3], 0) - ground.h(-FIB[3], 0), gz = ground.h(0, FIB[3]) - ground.h(0, -FIB[3]), g = Math.hypot(gx, gz) / (2 * FIB[3]);
  return g > 1 / FIB[6] ? { dir: [gx / Math.hypot(gx, gz), gz / Math.hypot(gx, gz)], grade: g } : null;   // derived: cities.js slopeAt, to the letter
}

/** The game's ground in a town's frame, as cityOf hands it to the grow (world/cities.js). */
export async function groundOf(at) {
  const { heightAt } = await import("../game/ground.js");
  try { map(); } catch { loadMap(); }   // the world's map, once (bakegrown loads it as it starts)
  const ground = { h: (x, z) => heightAt(at.x + x, at.z + z).h }, water = (x, z) => ground.h(x, z) <= 0;
  return { ground, water };
}

/** A grown town (bakegrown's settlement s and cityOf's c) as its plan. */
export async function planOf(s, c, hash) {
  const t = s.lead.tradition, slope = slopeOf(c.ground), dense = (c.place.census?.level ?? 0) >= FIB[3];   // derived: growth.js growOf's dense
  const make = await makerOf(t, slope, dense);
  const r = recipes(c.place.placed, make);
  const place = {};
  for (const k of KEEP) if (c.place[k] !== undefined) place[k] = k === "placed" ? c.place.placed.map((p) => Object.fromEntries(Object.entries(p).filter(([f]) => !BUILT.has(f)))) : c.place[k];
  place.centres = c.place.districts?.centres ?? [];
  return { v: VERSION, hash, key: s.key, t, at: c.at, dense, recipes: r, place: enc(place, "place") };
}

/** A plan's place, its buildings rebuilt from their recipes, ready for layPlace. */
export async function placeOfPlan(plan) {
  const { atomOf } = await import("../world/district.js");
  const { ground, water } = await groundOf(plan.at);
  const make = await makerOf(plan.t, slopeOf(ground), plan.dense);
  const pl = dec(plan.place);
  pl.districts = { centres: pl.centres }; delete pl.centres;
  // farms and the like hold copies of their placements: the rebuilt ones go in by index where the plan's own did
  pl.placed = pl.placed.map((p, n) => {
    const r = plan.recipes[n], body = make(r.id, r.seed, r.up);
    const b = r.part === undefined ? body : { vox: body.parts[r.part].vox };
    return { ...p, b, atom: atomOf(b) };
  });
  const protos = new Set(plan.recipes.map((r) => `${r.id}|${r.seed}|${r.up}|${r.part ?? ""}`)).size;   // a prototype a distinct recipe
  return { pl, ground, water, protos };
}

/** Lays a plan: the blocks, beasts and decor layPlace laid when the town was grown. */
export async function layOf(plan) {
  const { layPlace } = await import("../world/district.js");
  const { pl, ground, water, protos } = await placeOfPlan(plan);
  const lay = layPlace(pl, plan.t, { ground, water, margin: FIB[6] });   // vision: bakegrown's margin, to the letter
  return { lay, ground, water, protos };
}

export function writePlan(plan) {
  fs.mkdirSync(PLANS, { recursive: true });
  fs.writeFileSync(planFile(plan.key), JSON.stringify(plan));
}
export const readPlan = (key) => JSON.parse(fs.readFileSync(planFile(key), "utf8"));
