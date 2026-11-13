// Pure. The Cold House: the Therans' glassed-in arctic, by the Library on the cone. It is the solar
// rite (solar.js) turned round: where the rite brings the world its warmth, the Cold House keeps a
// piece of the far north under glass, so the Therans' climate is theirs to set, both ways.
//
// What keeps it cold is vanilla's own rule. Ice melts where block light reaches more than 11 (the
// sun through glass does not melt it; only lamps do). A soul lantern gives 10. So the Cold House is
// lit by soul lanterns alone, set on its floor on a lattice close enough that every cell is lit to 8
// (nothing spawns) and nowhere above 10 (nothing melts): the lantern's 10 less two steps is 8, so no
// floor cell may be more than two steps from one (a diamond lattice, four apart).
//
//   the dome   glass, a golden radius (8 blocks, a Fibonacci number), a touch taller than round, its
//              floor packed ice and snow (neither melts at any light), a pond of plain ice (the one
//              thing that would melt, kept by the lanterns), powder snow drifts on the Fibonacci
//              lattice, three spruces of the north, a door and a lobby to keep the warm out
//   checks     every floor cell at light 8 to 10; the pond's every neighbour at most 11; every cell
//              reached from the door
import { FIB, lattice, cellsOn } from "../core/golden.js";

export const COLD = Object.freeze({ R: FIB[5], SOUL: 10, MELT: 11, LIT: 8, POND: FIB[3], TREES: FIB[3] });   // derived: radius eight; given: a soul lantern's light, the light that melts ice, the light at which nothing spawns; derived: a pond three across, three trees
const K = (x, y, z) => `${x},${y},${z}`;

/** The Cold House's voxels and its checks. */
export function coldHouse() {
  const v = new Map(), set = (x, y, z, id, s = null) => v.set(K(x, y, z), { id: `minecraft:${id}`, s }), R = COLD.R, c = R + 1;
  const inside = (x, z) => Math.hypot(x - c, z - c) < R;
  for (let x = 0; x <= 2 * c; x++) for (let z = 0; z <= 2 * c; z++) {
    const r = Math.hypot(x - c, z - c);
    if (r <= R + 0.5) set(x, 0, z, "packed_ice");
    for (let y = 1; y <= R + 1; y++) { const rr = Math.hypot(r, y * 0.9); if (rr >= R - 0.5 && rr < R + 0.5) set(x, y, z, "glass"); }   // vision: the dome a touch taller than round
  }
  // the ground: snow blocks in drifts on the Fibonacci lattice, powder snow in the hollows, a pond of plain ice
  const drift = lattice(6, 2 * c, 1, 0.5);   // vision: the Cold House's own drawing (lattice, drifts, tree height, light steps)
  for (let x = 1; x < 2 * c; x++) for (let z = 1; z < 2 * c; z++) {
    if (!inside(x, z)) continue;
    const d = cellsOn(x + 0.5, z + 0.5, drift, 2 * c);
    if (Math.hypot(x - c, z - c) < COLD.POND / 2 + 0.5) set(x, 0, z, "ice");
    else if (d.f1 < 1.2) set(x, 0, z, "snow");   // vision: the Cold House's own drawing (lattice, drifts, tree height, light steps)
    else if (d.f2 - d.f1 < 0.4) set(x, 0, z, "blue_ice");   // vision: blue ice in the drifts' seams
  }
  // three spruces of the north, on the golden angle round the pond
  for (let t = 0; t < COLD.TREES; t++) { const a = t * 2.39996 + 0.7, x = Math.round(c + (R - 3.5) * Math.cos(a)), z = Math.round(c + (R - 3.5) * Math.sin(a)); for (let y = 1; y <= 4; y++) set(x, y, z, "spruce_log", { pillar_axis: "y" }); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let y = 3; y <= 4; y++) set(x + dx, y, z + dz, "spruce_leaves", { persistent_bit: true }); set(x, 5, z, "spruce_leaves", { persistent_bit: true }); }   // given: the golden angle in radians; vision: a small spruce's shape
  // the door and its lobby (warm air stays out): a short glass passage to the south
  for (let z = 2 * c - 1; z <= 2 * c + 2; z++) { set(c - 1, 0, z, "packed_ice"); set(c, 0, z, "packed_ice"); set(c + 1, 0, z, "packed_ice"); for (let y = 1; y <= 3; y++) { set(c - 1, y, z, "glass"); set(c + 1, y, z, "glass"); } set(c, 3, z, "glass"); v.delete(K(c, 1, z)); v.delete(K(c, 2, z)); }   // vision: the Cold House's own drawing (lattice, drifts, tree height, light steps)
  const door = { x: c, y: 1, z: 2 * c + 2 };
  v.set(K(c, 1, 2 * c + 2), { id: "minecraft:spruce_door", s: { "minecraft:cardinal_direction": "south", upper_block_bit: false } }); v.set(K(c, 2, 2 * c + 2), { id: "minecraft:spruce_door", s: { "minecraft:cardinal_direction": "south", upper_block_bit: true } });
  // soul lanterns on the floor, a diamond lattice four apart, never on the pond or under a tree
  const lamps = [];
  for (let x = 1; x < 2 * c; x++) for (let z = 1; z < 2 * c + 2; z++) {
    if ((x + z) % 4 !== 0 || (x - z + 400) % 4 !== 0 && (x - z + 400) % 4 !== 2) continue;   // given: the diamond lattice four apart (every cell within two steps)
    if (!(inside(x, z) || (Math.abs(x - c) <= 0 && z >= 2 * c - 1)) || v.get(K(x, 1, z)) || v.get(K(x, 0, z))?.id === "minecraft:ice") continue;
    v.set(K(x, 1, z), { id: "minecraft:soul_lantern", s: { hanging: false } }); lamps.push({ x, y: 1, z });
  }
  // and one more at a dark cell, until none is (the trees shade the lattice)
  let ch = checks(v, lamps, door, c);
  for (let g = 0; g < FIB[5] && ch.dark; g++) { const d = ch.darkCells.find(([x, , z]) => v.get(K(x, 0, z))?.id !== "minecraft:ice"); if (!d) break; v.set(K(d[0], 1, d[2]), { id: "minecraft:soul_lantern", s: { hanging: false } }); lamps.push({ x: d[0], y: 1, z: d[2] }); ch = checks(v, lamps, door, c); }   // vision: lanterns at most to add
  return { vox: v, door, lamps, checks: ch };
}
/** Block light from the soul lanterns (10, less one a step through air); the floor's range; the ice's most; reach from the door. */   // vision: the Cold House's own drawing (lattice, drifts, tree height, light steps)
function checks(v, lamps, door, c) {
  const L = new Map(), q = [], solid = (x, y, z) => { const b = v.get(K(x, y, z)); return b && !/lantern|door/.test(b.id); };
  for (const l of lamps) { L.set(K(l.x, l.y, l.z), COLD.SOUL); q.push([l.x, l.y, l.z]); }
  for (let h = 0; h < q.length; h++) { const [x, y, z] = q[h], l = L.get(K(x, y, z)); if (l <= 1) continue; for (const [a, b, d] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const k = K(x + a, y + b, z + d); if (solid(x + a, y + b, z + d) || (L.get(k) ?? 0) >= l - 1 || y + b < 1 || y + b > COLD.R + 2) continue; L.set(k, l - 1); q.push([x + a, y + b, z + d]); } }
  const floor = []; for (const [k, b] of v) { const [x, y, z] = k.split(",").map(Number); if (y !== 0 || /glass/.test(b.id)) continue; if (!v.get(K(x, 1, z)) || /lantern/.test(v.get(K(x, 1, z)).id)) floor.push([x, 1, z]); }
  const lit = floor.map(([x, y, z]) => L.get(K(x, y, z)) ?? 0), darkCells = floor.filter((_, i) => lit[i] < COLD.LIT), dark = darkCells.length, most = Math.max(...lit);
  let iceMost = 0; for (const [k, b] of v) if (b.id === "minecraft:ice") { const [x, y, z] = k.split(",").map(Number); for (const [a, bb, d] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) iceMost = Math.max(iceMost, L.get(K(x + a, y + bb, z + d)) ?? 0); }
  const seen = new Set([K(door.x, door.y, door.z)]), Q = [[door.x, door.y, door.z]];
  for (let h = 0; h < Q.length; h++) { const [x, y, z] = Q[h]; for (const [a, d] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = K(x + a, y, z + d); if (seen.has(k) || solid(x + a, y, z + d) || solid(x + a, y + 1, z + d) || !v.get(K(x + a, y - 1, z + d))) continue; seen.add(k); Q.push([x + a, y, z + d]); } }
  const reached = floor.filter(([x, y, z]) => seen.has(K(x, y, z))).length;
  return { floor: floor.length, dark, darkCells, most, iceMost, melts: iceMost > COLD.MELT, reached, ok: dark === 0 && iceMost <= COLD.MELT && reached >= floor.length * 0.9 };   // vision: a tree's cells aside, nine in ten reached
}
