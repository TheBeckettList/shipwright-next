// The yard lab: builds each culture's yard in the test world (the real planning and building code,
// on the mock block grid) and looks at it through lenses. No graphics needed to see a gap.
//
//   node --import ./tests/mocks/register.mjs tools/lab/yardlab.mjs [style|all] [--dump dir]
//
// Lenses
//   walk      a 2-block observer walks from the walkway: can it reach every workplace, bed and
//             hearth, through every door; where does it have to crawl or jump
//   gaps      holes in roofs (sky over a floor that's roofed all round), floating blocks
//   overlaps  two plans writing different blocks into the same cell (one silently loses)
//   view      a voxel dump (--dump) for tools/lab/view.py to draw
import { world } from "@minecraft/server";
import { planDock, buildDock } from "../../BP/scripts/yardbuild.js";
import { YARD_STYLES } from "../../BP/scripts/config/yardstyles.js";
import { standable, walk } from "./observer.mjs";
import { shape, FEATURE, notAllowed, unsupported, fullCube } from "./blocks.mjs";
import fs from "node:fs";
import { detectYard, buildLocation } from "../../BP/scripts/yard.js";
import { newRecord, writeRecord, helmAt } from "../../BP/scripts/ship.js";
import { PLANS } from "../../BP/scripts/config/plans.js";
import { yawFor } from "../../BP/scripts/stages.js";
import { setP } from "../../BP/scripts/props.js";
import { steerBoat } from "../../BP/scripts/steering.js";

let siteX = 900000;
/** A shore like the tests': grass to the north, sea from z = 16 southward, table two above the water. */
function shore() {
  const dim = world.getDimension("minecraft:overworld");
  const x0 = (siteX += 120);
  for (let x = x0 - 24; x <= x0 + 24; x++) for (let z = -16; z <= 44; z++) for (let y = 54; y <= 66; y++) {
    let type = "minecraft:air";
    if (z >= 16 && y <= 63) type = y <= 56 ? "minecraft:sand" : "minecraft:water";
    else if (z < 16 && y <= 64) type = y === 64 ? "minecraft:grass_block" : "minecraft:dirt";
    dim.set(x, y, z, type);
  }
  const o = { x: x0, y: 65, z: 0 };
  dim.set(o.x, o.y, o.z, "shipwright:shipwright_table");
  return { dim, o, table: () => dim.getBlock(o) };
}

export async function buildYard(styleKey, { length = 16, width = 5, biome = null } = {}) {
  const s = shore();
  s.dim.biomeAt = biome ? () => biome : null;
  const plan = planDock(s.table(), length, width, YARD_STYLES[styleKey]);
  if (!plan.ok) throw new Error(`${styleKey}: ${plan.reason}`);
  let done = false;
  buildDock(plan, () => {}, () => (done = true));
  for (let i = 0; i < 4000 && !done; i++) await new Promise((r) => setTimeout(r, 0));
  if (!done) throw new Error(`${styleKey}: build never finished`);
  const get = (x, y, z) => {
    const k = `${x},${y},${z}`;
    const id = s.dim.blocks.get(k);
    return id ? { id, states: s.dim.states.get(k) ?? {} } : null;
  };
  const all = [...plan.walls, ...plan.edge, ...plan.structure, ...plan.footing, ...plan.basin];
  const xs = all.map((p) => p.x), zs = all.map((p) => p.z), ys = all.map((p) => p.y);
  const box = { x0: Math.min(...xs) - 2, x1: Math.max(...xs) + 2, z0: Math.min(...zs) - 2, z1: Math.max(...zs) + 2, y0: Math.min(...ys) - 1, y1: Math.max(...ys) + 2 };
  return { s, plan, get, box };
}

/** Lens: walk. */
export function walkLens({ plan, get, box }) {
  const nodes = standable(get, box);
  const starts = plan.walls.map((p) => ({ x: p.x, z: p.z, feet: p.y + 0.5 }));
  const { reached, jumps } = walk(nodes, starts);
  const reachedAt = [...reached.values()].map((r) => r.n);
  const near = (b) => reachedAt.some((n) => Math.max(Math.abs(n.x - b.x), Math.abs(n.z - b.z)) <= 1 && n.feet - b.y > -1.6 && n.feet - b.y < 2.2);
  // (a campfire on a chimney top is smoke, not a hearth)
  const features = plan.structure.filter((b) => FEATURE.test(b.id) && !(/campfire/.test(b.id) && b.y - plan.origin.y > 4));
  if (plan.tableAt) features.push({ ...plan.tableAt, id: "shipwright:shipwright_table" });
  const unreachable = features.filter((b) => !near(b)).map((b) => `${b.id.replace(/^\w+:/, "")}@${b.x},${b.y},${b.z}`);
  // doors: the lower half of each door has standable floor both sides, and both sides are reached
  const doors = plan.structure.filter((b) => /_door$/.test(b.id) && !plan.structure.some((o) => o.id === b.id && o.x === b.x && o.z === b.z && o.y === b.y - 1));
  const blockedDoors = [];
  for (const d of doors) {
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => reachedAt.some((n) => n.x === d.x + dx && n.z === d.z + dz && Math.abs(n.feet - d.y) < 0.7));
    const through = (sides[0] && sides[1]) || (sides[2] && sides[3]);
    if (!through) blockedDoors.push(`door@${d.x},${d.y},${d.z}`);
  }
  const walkway = [...plan.walls, ...plan.edge];
  const offWalk = walkway.filter((p) => !reachedAt.some((n) => n.x === p.x && n.z === p.z)).length;
  const crawl = [...reached.values()].filter((r) => r.via === "crawl").length;
  return { places: reached.size, of: nodes.size, features: features.length, unreachable, doors: doors.length, blockedDoors, walkwayMissed: offWalk, crawl, jumps };
}

/** Lens: gaps (roof holes over a floor that's roofed all round; blocks hanging in the air). */
export function gapsLens({ plan, get }) {
  const roofed = (x, y, z) => { for (let k = 2; k <= 12; k++) { const b = get(x, y + k, z); if (b && shape(b.id, b.states).kind !== "pass") return true; } return false; };
  const floors = plan.structure.filter((b) => shape(b.id, b.states).kind === "solid" && !get(b.x, b.y + 1, b.z)?.id?.match(/^(?!minecraft:air)/));
  const holes = [];
  const smoke = (x, z) => plan.structure.some((b) => /campfire/.test(b.id) && Math.abs(b.x - x) <= 1 && Math.abs(b.z - z) <= 1);
  for (const f of floors) {
    if (roofed(f.x, f.y, f.z) || smoke(f.x, f.z)) continue;     // a smoke hole over the fire is meant
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => roofed(f.x + dx, f.y, f.z + dz)).length;
    if (around === 4) holes.push(`${f.x},${f.y},${f.z}`);
  }
  const floating = [];
  for (const b of plan.structure) {
    if (shape(b.id, b.states).kind === "pass" || /lantern|chain|leaves|banner/.test(b.id)) continue;
    const touch = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => {
      const n = get(b.x + dx, b.y + dy, b.z + dz);
      return n && n.id !== "minecraft:air" && !/water/.test(n.id);
    });
    if (!touch) floating.push(`${b.id.replace(/^\w+:/, "")}@${b.x},${b.y},${b.z}`);
  }
  return { roofHoles: holes, floating };
}

/** Lens: overlaps (two parts of the plan claiming one cell with different blocks). */
export function overlapsLens({ plan }) {
  const parts = { walls: plan.walls.map((p) => ({ ...p, id: plan.style.wall })), edge: plan.edge.map((p) => ({ ...p, id: plan.style.deck })), posts: plan.posts.map((p) => ({ ...p, id: plan.style.post })), structure: plan.structure, footing: plan.footing };
  const seen = new Map(), clashes = [];
  for (const [part, list] of Object.entries(parts)) for (const p of list) {
    const k = `${p.x},${p.y},${p.z}`;
    const was = seen.get(k);
    if (was && was.id !== p.id && was.part !== part) clashes.push(`${k}: ${was.part} ${was.id.replace(/^\w+:/, "")} vs ${part} ${p.id.replace(/^\w+:/, "")}`);
    else seen.set(k, { id: p.id, part });
  }
  return { clashes };
}

/**
 * Lens: exit. The biggest ship the yard builds is laid down where the game lays it, launched, and
 * sailed straight ahead: she must clear the dock's mouth (never caught on the walkway or the shore).
 */
export function exitLens({ s, plan }, pid) {
  const table = s.dim.getBlock(plan.tableAt ?? plan.origin);
  const yard = detectYard(table);
  if (!yard?.ok) return { issues: [`the yard isn't recognised after building (${yard?.reason ?? "none"})`] };
  const p = PLANS[pid];
  const L = Math.min(yard.length, p.lengthRange[1]);
  const rec = newRecord(p, "lab", L);
  rec.stage = 5;
  rec.dims.beam = Math.min(rec.dims.beam, (yard.width - 0.5) / p.baseBeam);    // as the build fits her to the basin
  const e = s.dim.spawnEntity(p.entity ?? `shipwright:${pid}`, helmAt(buildLocation(yard, L), yard.dir, rec));
  writeRecord(e, rec);
  setP(e, "yaw", yawFor(yard));
  const start = { ...e.location };
  const helm = { typeId: "minecraft:player", id: "lab", inputInfo: { getMovementVector: () => ({ x: 0, y: 1 }), getButtonState: () => "Released" } };
  // The game's own block physics, simplified: the collision box (as wide as the entity's) moves by
  // its velocity each tick unless it would run into a solid block at the waterline or just above.
  const hw = (p.modelScale ?? 1) > 1 ? 1.0 : 0.8;
  const solid = (x, y, z) => { const b = s.dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }); return b && !/water|air/.test(b.typeId); };
  const hits = (x, z) => {
    for (const dy of [0, 0.6]) for (const ox of [-hw, 0, hw]) for (const oz of [-hw, 0, hw]) if (solid(x + ox, e.location.y + dy, z + oz)) return true;
    return false;
  };
  let blocked = 0;
  for (let i = 0; i < ((p.modelScale ?? 1) >= 4 ? 1200 : 600); i++) {   // a great ship works out on her sweeps in a minute (Waterworld's math: a 900-ton hull)
    steerBoat(e, helm);
    // Like the game: each axis on its own, so a box against a wall slides along it.
    const v = e.velocity;
    let { x, z } = e.location;
    if (!hits(x + v.x, z)) x += v.x; else { blocked++; v.x = 0; }
    if (!hits(x, z + v.z)) z += v.z; else { blocked++; v.z = 0; }
    e.location = { ...e.location, x, z };
  }
  const d = yard.dir;
  const gone = (e.location.x - start.x) * d.x + (e.location.z - start.z) * d.z;
  const need = yard.length + 3;                                   // past the mouth, hull and all
  const issues = gone < need ? [`a ${L}-block ${pid} gets ${gone.toFixed(1)} of ${need} blocks out: stuck in the dock (${blocked} ticks against blocks)`] : [];
  return { gone: +gone.toFixed(1), need, issues };
}

/**
 * Lens: allowed and sticking. Every block the yard placed is one the game knows, with states it
 * accepts (an unknown id shows as a placeholder block); and every block that hangs on something
 * (ladders, lanterns, torches, carpets, doors, plants, falling blocks) has it.
 */
export function stickLens({ plan, get }) {
  const bad = [], loose = [];
  for (const p of [...plan.structure, ...plan.walls.map((w) => ({ ...w, id: plan.style.wall })), ...plan.edge.map((w) => ({ ...w, id: plan.style.deck }))]) {
    const b = get(p.x, p.y, p.z);
    if (!b) continue;
    const why = notAllowed(b.id, b.states);
    if (why) bad.push(`${why} @${p.x},${p.y},${p.z}`);
    const u = unsupported(get, p.x, p.y, p.z, b);
    if (u) loose.push(`${u} @${p.x},${p.y},${p.z}`);
  }
  return { unknown: [...new Set(bad)], loose: [...new Set(loose)] };
}

/**
 * Lens: wasted space. Inside each roofed room, floor a player can stand on that's more than two
 * blocks from anything useful (a workplace, bed, chest, seat, table, hearth or the wall's door):
 * a room should be used, not a hall of nothing.
 */
export function spaceLens(y) {
  const { plan, get } = y;
  const useful = plan.structure.filter((b) => /bed$|crafting|chest$|barrel|campfire|furnace|smoker|loom|cartography|smithing|fletching|anvil|grindstone|lectern|composter|stonecutter|bell$|cauldron|_stairs$|bookshelf|ladder|_door$|hay_block|_fence$|flower_pot|_carpet$|brewing|jukebox|note_block|decorated_pot/.test(b.id));
  const roofed = (x, yy, z) => { for (let k = 2; k <= 8; k++) { const b = get(x, yy + k, z); if (b && !/air|water|lantern|chain|torch/.test(b.id)) return true; } return false; };
  let floor = 0, idle = 0;
  const idleAt = [];
  for (const p of plan.structure) {
    const b = get(p.x, p.y, p.z), up1 = get(p.x, p.y + 1, p.z), up2 = get(p.x, p.y + 2, p.z);
    if (!b || !fullCube(b.id) && !/_slab$/.test(b.id)) continue;
    if ((up1 && up1.id !== "minecraft:air") || (up2 && up2.id !== "minecraft:air")) continue;
    if (!roofed(p.x, p.y, p.z)) continue;
    floor++;
    if (!useful.some((q) => Math.max(Math.abs(q.x - p.x), Math.abs(q.z - p.z)) <= 2 && Math.abs(q.y - p.y) <= 3)) { idle++; idleAt.push(`${p.x},${p.y},${p.z}`); }
  }
  return { floor, idle, share: floor ? +(idle / floor).toFixed(2) : 0, idleAt };
}

export function dump({ get, box }, file) {
  const out = [];
  for (let x = box.x0; x <= box.x1; x++) for (let y = box.y0; y <= box.y1; y++) for (let z = box.z0; z <= box.z1; z++) {
    const b = get(x, y, z);
    if (b && b.id !== "minecraft:air") out.push([x - box.x0, y - box.y0, z - box.z0, b.id.replace(/^\w+:/, ""), b.states]);
  }
  fs.writeFileSync(file, JSON.stringify({ box, blocks: out }));
}

export function lensAll(y, label, exitPid) {
  const w = walkLens(y), g = gapsLens(y), o = overlapsLens(y), x = exitLens(y, exitPid), st = stickLens(y), sp = spaceLens(y);
  const issues = [...w.unreachable.map((i) => `unreachable ${i}`), ...w.blockedDoors.map((i) => `blocked ${i}`),
    ...(w.walkwayMissed ? [`walkway missed ${w.walkwayMissed}`] : []), ...g.roofHoles.map((i) => `roof hole ${i}`), ...g.floating.map((i) => `floating ${i}`),
    ...o.clashes.map((i) => `overlap ${i}`), ...x.issues, ...st.unknown, ...st.loose, ...(sp.share > 0.25 ? [`${Math.round(sp.share * 100)}% of the indoor floor is idle`] : [])];
  return { label, w, x, sp, issues };
}

async function main() {
  const args = process.argv.slice(2);
  const dumpAt = args.includes("--dump") ? args[args.indexOf("--dump") + 1] : null;
  const which = args.find((a) => !a.startsWith("--") && a !== dumpAt) ?? "all";
  const { VILLAGES } = await import("../../BP/scripts/config/villages.js");
  const BIOMES = { plains: "minecraft:plains", desert: "minecraft:desert", savanna: "minecraft:savanna", taiga: "minecraft:taiga",
    snowy: "minecraft:snowy_plains", jungle: "minecraft:jungle", swamp: "minecraft:mangrove_swamp", cherry: "minecraft:cherry_grove" };
  const runs = [];
  for (const v of Object.keys(VILLAGES)) if (which === "all" || which === "villages" || which === v) runs.push({ label: `village ${v}`, key: "european", opts: { biome: BIOMES[v] }, exit: "cog" });
  for (const k of Object.keys(YARD_STYLES).filter((k) => YARD_STYLES[k].arch)) if (which === "all" || which === "dry" || which === k) runs.push({ label: `dry dock ${k}`, key: k, opts: { length: 36, width: 11 }, exit: "carrack" });
  let bad = 0;
  for (const r of runs) {
    const y = await buildYard(r.key, r.opts);
    const L = lensAll(y, r.label, r.exit);
    bad += L.issues.length;
    console.log(`${r.label}: ${L.issues.length ? `${L.issues.length} issue(s)` : "clean"}  walk ${L.w.places}/${L.w.of}, ${L.w.features} features, ${L.w.jumps} jumps; idle floor ${Math.round(L.sp.share * 100)}%; exit ${L.x.gone}/${L.x.need}`);
    for (const i of L.issues.slice(0, 14)) console.log(`    ${i}`);
    if (L.issues.length > 14) console.log(`    (+${L.issues.length - 14} more)`);
    if (dumpAt) { fs.mkdirSync(dumpAt, { recursive: true }); dump(y, `${dumpAt}/${r.label.replace(/ /g, "_")}.json`); }
  }
  process.exitCode = bad ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
