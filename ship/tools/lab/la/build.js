// The build: a set of blocks in its own frame, made of pieces set down by the frames' matrices.
//
//   const b = new Build("quay", { culture: "norse" });
//   b.box(0, 3, 0, 0, 0, 8, "minecraft:spruce_slab");     // x0..x1, y0..y1, z0..z1
//   b.place(post, { x: 0, z: 0, turns: 1, mirror: true });  // another Build, turned and mirrored
//   b.every(4, 0, 8, (z) => b.put(0, 1, z, "minecraft:lantern"));
//
// A build knows nothing of the world; `gates.js` checks it against the bounds and its culture, and
// `dump` writes it for tools/lab/view.py. yardarch's canvases come in through `fromCanvas`, so every
// building the mod already draws can be looked at, turned and checked here.
import { placement, xz, turnStates } from "./frames.js";
import { statesFor } from "../../../BP/scripts/yardarch.js";

const ns = (id) => (id.includes(":") ? id : `minecraft:${id}`);
const key = (x, y, z) => `${x},${y},${z}`;

export class Build {
  constructor(name, { culture = null, notes = "" } = {}) {
    this.name = name;
    this.culture = culture;
    this.notes = notes;
    this.cells = new Map();
    this.warnings = [];
  }
  put(x, y, z, id, states = {}) {
    if (id === null || id === undefined) return this;
    this.cells.set(key(x, y, z), { x, y, z, id: ns(id), states: { ...states } });
    return this;
  }
  get(x, y, z) { return this.cells.get(key(x, y, z)) ?? null; }
  remove(x, y, z) { this.cells.delete(key(x, y, z)); return this; }
  box(x0, x1, y0, y1, z0, z1, id, states, { hollow = false } = {}) {
    const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [c, d] = [Math.min(y0, y1), Math.max(y0, y1)], [e, f] = [Math.min(z0, z1), Math.max(z0, z1)];
    for (let x = a; x <= b; x++) for (let y = c; y <= d; y++) for (let z = e; z <= f; z++) {
      if (hollow && x > a && x < b && z > e && z < f && y > c && y < d) continue;
      this.put(x, y, z, id, states);
    }
    return this;
  }
  /** Run fn at every `step` from a to b (posts every n blocks, lamps every n posts: the yard's `every`). */
  every(step, a, b, fn) { for (let k = a; k <= b; k += step) fn(k); return this; }
  /** Set another build down here: its origin at (x, y, z), turned and mirrored. States go with it. */
  place(piece, { x = 0, y = 0, z = 0, turns = 0, mirror = false } = {}) {
    const A = placement(turns, mirror);
    for (const c of piece.cells.values()) {
      const p = xz(A, c.x, c.z);
      const t = turnStates(c.id, c.states, A);
      for (const u of t.unhandled) this.warn(`${c.id}: ${u} not carried through the turn`);
      this.put(x + p.x, y + c.y, z + p.z, c.id, t.states);
    }
    return this;
  }
  /** This build, turned and mirrored about its own origin (a new build). */
  transformed(turns = 0, mirror = false) {
    const b = new Build(this.name, { culture: this.culture, notes: this.notes });
    b.place(this, { turns, mirror });
    b.warnings.push(...this.warnings);
    return b;
  }
  warn(msg) { if (!this.warnings.includes(msg)) this.warnings.push(msg); }

  /** The box the blocks fill. */
  bounds() {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const c of this.cells.values()) {
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); z0 = Math.min(z0, c.z);
      x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); z1 = Math.max(z1, c.z);
    }
    return { x0, y0, z0, x1, y1, z1, dx: x1 - x0 + 1, dy: y1 - y0 + 1, dz: z1 - z0 + 1 };
  }
  /** Blocks by id, most first: the bill of materials (one item per block placed). */
  bill() {
    const n = new Map();
    for (const c of this.cells.values()) if (c.id !== "minecraft:air") n.set(c.id, (n.get(c.id) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }
  get size() { let n = 0; for (const c of this.cells.values()) if (c.id !== "minecraft:air") n++; return n; }

  /** The voxel dump tools/lab/view.py draws: { box, blocks: [[x, y, z, name, states]] }. */
  toDump() {
    const b = this.bounds(), blocks = [];
    for (const c of this.cells.values()) if (c.id !== "minecraft:air") blocks.push([c.x - b.x0, c.y - b.y0, c.z - b.z0, c.id.replace(/^\w+:/, ""), c.states]);
    return { name: this.name, culture: this.culture, box: b, blocks };
  }
}

/**
 * A yardarch canvas as a build: u (toward the building's front) runs along +x, w (its right hand)
 * along +z, dy up. The canvas's own orientation marks become block states through yardarch's own
 * statesFor, so what the sim checks is what the game would place.
 */
export function fromCanvas(canvas, name, opts = {}) {
  const b = new Build(name, opts);
  const d = { x: 1, z: 0 };
  for (const cell of canvas.cells.values()) b.put(cell.u, cell.dy, cell.w, cell.id, statesFor(cell, d));
  return b;
}
