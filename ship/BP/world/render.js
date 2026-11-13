// Pure. How the sim is drawn in the game, with what Bedrock lets an add-on draw, and what each drawing costs. The sim
// says what is there at tick t; this says how few calls put it on the screen.
//
//   the calls   the game's own, each one call however much it draws:
//                 structure  a baked building (its molecule, laid once into a .mcstructure in the pack) placed whole
//                            (world.structureManager.place); a building past STRUCT on a side goes as tiles of it
//                 fill       a box of one block (dimension.fillBlocks): the ground's runs
//                 list       one block at many places (a ListBlockVolume filled once): a chunk's ores, its plants, a
//                            town's lanterns, a month's changes, one call a kind of block
//                 crowd      one entity that is a group: up to CROWD people of a spot (the market's stall, the quay,
//                            the hearth), the client hiding the unused figures, dressing each from its people's sheet,
//                            playing what they do (the entity's properties: how many, who, the doing); one call to set
//                 walker     a single body on its way between spots, put on its path each breath
//   the budget  the calls a tick the server can spend (the budget lens's slice over the measured cost of a call),
//               shared nearest first: what a player sees grows while the server keeps up and shrinks when it
//               strains (the server's own tick time is the measure; the client's frame rate is the client's)
//   the law     every op is read from the sim at t (the chain, p(person, t), the month's record); drawing changes
//               nothing in the sim, and the same t draws the same ops
import { FIB, PHI } from "../core/golden.js";

export const STRUCT = 64;   // given: the game's largest structure, 64 blocks a side (a structure block's own bound)
export const CROWD = FIB[5];   // derived: eight people a crowd entity (its eight figures)
export const OP = Object.freeze({ structure: "structure", fill: "fill", list: "list", set: "set", crowd: "crowd", walker: "walker" });

/** A building's ops: one structure (or its tiles of STRUCT). vox: the building's blocks; at: its origin; proto: its baked key. */
export function buildingOps(vox, at, proto, k = 0) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const key of vox.keys()) { const [x, , z] = key.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const ops = []; for (let tx = x0; tx <= x1; tx += STRUCT) for (let tz = z0; tz <= z1; tz += STRUCT) ops.push({ op: OP.structure, proto, tile: [Math.floor((tx - x0) / STRUCT), Math.floor((tz - z0) / STRUCT)], at: { x: at.x + tx, y: at.y, z: at.z + tz }, k });
  return ops;
}
/** Scattered blocks as lists: one op a block kind (its states included). sets: [[x, y, z, id, states]]. */
export function listOps(sets) {
  const by = new Map(); for (const [x, y, z, id, s] of sets) { const key = s ? `${id}|${JSON.stringify(s)}` : id; (by.get(key) ?? by.set(key, []).get(key)).push([x, y, z]); }
  return [...by].map(([key, at]) => ({ op: OP.list, block: key, at }));
}
/** A column field as fills: each row's runs of equal columns, then runs stacked row on row into rectangles (one fill each). cols: [{ x, z, top, id }]. */
export function fillOps(cols) {
  const rows = new Map(); for (const c of cols) (rows.get(c.z) ?? rows.set(c.z, []).get(c.z)).push(c);
  const runs = []; for (const [z, r] of [...rows].sort((a, b) => a[0] - b[0])) { r.sort((a, b) => a.x - b.x); let i = 0; while (i < r.length) { let e = i; while (e + 1 < r.length && r[e + 1].x === r[e].x + 1 && r[e + 1].top === r[i].top && r[e + 1].id === r[i].id) e++; runs.push({ x0: r[i].x, x1: r[e].x, z, top: r[i].top, id: r[i].id }); i = e + 1; } }
  const open = new Map(), ops = [];   // a run equal to one that ended on the row before carries that rectangle on
  const close = (q) => ops.push({ op: OP.fill, from: [q.x0, q.top, q.z0], to: [q.x1, q.top, q.z1], block: q.id });
  let zPrev = null;
  for (const r of runs) {
    if (zPrev !== null && r.z !== zPrev) for (const [k, q] of open) if (q.z1 < r.z - 1) { close(q); open.delete(k); }
    const key = `${r.x0},${r.x1},${r.top},${r.id}`, q = open.get(key);
    if (q && q.z1 === r.z - 1) q.z1 = r.z; else { if (q) close(q); open.set(key, { x0: r.x0, x1: r.x1, top: r.top, id: r.id, z0: r.z, z1: r.z }); }
    zPrev = r.z;
  }
  for (const q of open.values()) close(q);
  return ops;
}
/** The shown people as crowds and walkers: a spot's shown in crowds of CROWD, the walking one body each (world/living.js shownAt). */
export function peopleOps(shown) {
  const spots = new Map(), ops = [];
  for (const e of shown) { if (e.q.walking) { ops.push({ op: OP.walker, k: e.k, at: { x: e.q.x, z: e.q.z } }); continue; } (spots.get(e.group) ?? spots.set(e.group, []).get(e.group)).push(e); }
  for (const [group, list] of spots) for (let i = 0; i < list.length; i += CROWD) { const part = list.slice(i, i + CROWD), cx = part.reduce((a, e) => a + e.q.x, 0) / part.length, cz = part.reduce((a, e) => a + e.q.z, 0) / part.length; ops.push({ op: OP.crowd, group, people: part.map((e) => e.k), doing: part[0].q.place, at: { x: cx, z: cz } }); }
  return ops;
}
/** The calls a set of ops takes (each op one call), and the blocks or people it draws. */
export function costOf(ops) {
  const calls = ops.length, by = {}; for (const o of ops) by[o.op] = (by[o.op] ?? 0) + 1;
  return { calls, by };
}
/** How many people a budget of entities shows when each crowd holds CROWD: the bodies' budget times what a crowd carries. */
export const peopleFor = (entities, walkers = 0) => (entities - walkers) * CROWD + walkers;
/** The share of a tick's budget each ring gets, nearest first (a golden fall: the first ring 1/phi of it, the next 1/phi of the rest). */
export const ringShare = (ring) => (1 / PHI) * (1 - 1 / PHI) ** ring;
