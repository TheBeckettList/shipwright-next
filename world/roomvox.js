// Pure. A room of the table (world/periodic.js), built: its floor, walls and ceiling in its people's own
// materials, its doors (its bonds) and windows (its lone pairs), what it holds, furnished, and lit. The fitting is
// a few plain laws, each checked:
//   reserved   the cell inside each door and each window, and the walk between the doors, stay clear
//   fixtures   along the walls, never on a reserved cell, never on one another, each with its use cell (the cell
//              you stand on to use it) clear and reachable from a door
//   fire       a campfire has its ring clear (no fixture beside it) and a vent over it
//   comfort    once the needs are met, what's left is furnished from the people's own: a rug in its dye, a
//              chest at the bed's foot, shelves in the hall's corners, a pot of flowers by a window
//   light      lanterns hung where it's darkest until every floor cell is lit to 8 (vanilla's)
import { FIB, PHI } from "../core/golden.js";
import { TABLE } from "./periodic.js";
import { dyesOf } from "./looks.js";

// vision: each people's own materials (its tradition's, not its biome's): wall, post, floor, roof, door, window, rug's dye
export const MATS = {
  norse: { wall: "minecraft:spruce_planks", post: "minecraft:spruce_log", floor: "minecraft:spruce_planks", roof: "minecraft:dark_oak_planks", door: "minecraft:spruce_door", window: "minecraft:spruce_trapdoor", base: "minecraft:cobblestone" },
  european: { wall: "minecraft:white_terracotta", post: "minecraft:dark_oak_log", floor: "minecraft:oak_planks", roof: "minecraft:deepslate_tiles", door: "minecraft:wooden_door", window: "minecraft:glass_pane", base: "minecraft:stone_bricks" },
  birchbark: { wall: "minecraft:stripped_birch_log", post: "minecraft:birch_log", floor: "minecraft:coarse_dirt", roof: "minecraft:birch_planks", door: "minecraft:birch_door", window: "minecraft:birch_trapdoor", base: "minecraft:coarse_dirt" },
  pacific: { wall: "minecraft:bamboo_planks", post: "minecraft:jungle_log", floor: "minecraft:bamboo_mosaic", roof: "minecraft:hay_block", door: "minecraft:bamboo_door", window: "minecraft:bamboo_trapdoor", base: "minecraft:jungle_planks" },
  indian_ocean: { wall: "minecraft:smooth_sandstone", post: "minecraft:mangrove_log", floor: "minecraft:light_gray_terracotta", roof: "minecraft:smooth_sandstone", door: "minecraft:dark_oak_door", window: "minecraft:dark_oak_trapdoor", base: "minecraft:sandstone" },
  east_asian: { wall: "minecraft:mud_bricks", post: "minecraft:stripped_dark_oak_log", floor: "minecraft:polished_tuff", roof: "minecraft:deepslate_tiles", door: "minecraft:dark_oak_door", window: "minecraft:red_stained_glass_pane", base: "minecraft:stone_bricks" },
  japanese: { wall: "minecraft:birch_planks", post: "minecraft:stripped_spruce_log", floor: "minecraft:bamboo_mosaic", roof: "minecraft:deepslate_tiles", door: "minecraft:spruce_door", window: "minecraft:white_stained_glass_pane", base: "minecraft:stone_bricks" },
  dugout: { wall: "minecraft:stripped_spruce_log", post: "minecraft:spruce_log", floor: "minecraft:spruce_planks", roof: "minecraft:spruce_planks", door: "minecraft:spruce_door", window: "minecraft:spruce_trapdoor", base: "minecraft:spruce_planks" },
  shallow: { wall: "minecraft:bamboo_planks", post: "minecraft:mangrove_log", floor: "minecraft:bamboo_planks", roof: "minecraft:hay_block", door: "minecraft:bamboo_door", window: "minecraft:bamboo_trapdoor", base: "minecraft:mangrove_roots" },
  arctic: { wall: "minecraft:snow", post: "minecraft:packed_ice", floor: "minecraft:light_gray_wool", roof: "minecraft:snow", door: "minecraft:spruce_door", window: "minecraft:ice", base: "minecraft:snow" },
  therans: { wall: "minecraft:tuff_bricks", post: "minecraft:stripped_dark_oak_log", floor: "minecraft:polished_tuff", roof: "minecraft:packed_mud", door: "minecraft:dark_oak_door", window: "minecraft:air", base: "minecraft:tuff" },
};
export const HEIGHT = FIB[4] - 2;   // derived: three blocks clear (a door's two and a lantern's one)
const LIT = 8;   // given: vanilla's spawn-proof light
// what each held thing is: [blocks (dx along the wall, dy, depth in), its use cell's depth in front]
const FIX = {
  bed: { cells: [[0, 0, 0], [0, 0, 1]], blocks: (o) => [["minecraft:red_bed", { direction: o, head_piece_bit: false }], ["minecraft:red_bed", { direction: o, head_piece_bit: true }]], beside: true },
  table: { cells: [[0, 0, 0]], blocks: () => [["minecraft:oak_fence"]], top: "minecraft:wooden_pressure_plate", seat: true },
  seat: { cells: [[0, 0, 0]], blocks: (o) => [["minecraft:oak_stairs", { weirdo_direction: o }]] },
  fire: { cells: [[0, 0, 0]], blocks: () => [["minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: false }]], ring: true, vent: true },
  store: { cells: [[0, 0, 0]], blocks: () => [["minecraft:barrel", { facing_direction: 1, open_bit: false }]] },
  counter: { cells: [[0, 0, 0]], blocks: () => [["minecraft:smooth_stone_slab"]] },
  work: { cells: [[0, 0, 0]], blocks: () => [["minecraft:crafting_table"]] },
  hay: { cells: [[0, 0, 0]], blocks: () => [["minecraft:hay_block"]] },
  oven: { cells: [[0, 0, 0]], blocks: () => [["minecraft:smoker"]] },
  basin: { cells: [[0, 0, 0]], blocks: () => [["minecraft:cauldron"]] },
  forge: { cells: [[0, 0, 0]], blocks: () => [["minecraft:blast_furnace"]] },
  anvil: { cells: [[0, 0, 0]], blocks: () => [["minecraft:anvil"]] },
  lectern: { cells: [[0, 0, 0]], blocks: () => [["minecraft:lectern"]] },
  tree: { cells: [[0, 0, 0]], blocks: () => [["minecraft:flowering_azalea"]], soil: true },
  stair: { cells: [[0, 0, 0], [1, 0, 0], [2, 0, 0]], blocks: () => [["minecraft:oak_stairs"], ["minecraft:oak_stairs"], ["minecraft:oak_stairs"]], climb: true },
};

/**
 * Build a room. sym: an element; tradition: whose; doors / windows: which walls carry them ("n","e","s","w"),
 * defaulting to the room's own valence and lone pairs round its walls. Returns { vox, checks, w, l }.
 */
export function roomVox(sym, tradition = "european", { doors = null, windows = null, doorAt = null, winAt = null, w: W0 = null, l: L0 = null } = {}) {
  const T = TABLE[sym], M = MATS[tradition] ?? MATS.european, dyes = dyesOf(tradition), dye = dyes[0] ?? "white", rug = dyes.find((d) => d !== dye) ?? "white";   // the beds in the first dye, the rug in the next
  const w = W0 ?? T.side, l = L0 ?? (sym === "Be" ? 2 : T.side), H = HEIGHT, vox = new Map(), checks = [];   // a room in a building is the size the building gave it
  const put = (x, y, z, id, s = null) => vox.set(`${x},${y},${z}`, { id, s });
  // the openings round the walls: doors first (the bonds), then windows (the lone pairs), spread as VSEPR spreads them
  const WALLS = ["s", "e", "n", "w"];   // the street side first
  const dw = doors ?? WALLS.slice(0, Math.max(1, T.bonds)).map((x) => x), ww = windows ?? (T.metal || T.noble ? [] : WALLS.filter((x) => !dw.includes(x)).concat(WALLS).slice(0, T.lone));
  const mid = (side) => (side === "n" || side === "s" ? [Math.floor((w - 1) / 2), side === "n" ? -1 : l] : [side === "w" ? -1 : w, Math.floor((l - 1) / 2)]);
  const inward = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] };
  const sideOf = ([x, z]) => (x < 0 ? "w" : x >= w ? "e" : z < 0 ? "n" : "s");   // which wall a wall cell is in
  const doorCells = doorAt ? doorAt.map((c) => ({ s: sideOf(c), at: c })) : dw.map((s) => ({ s, at: mid(s) })), winCells = winAt ? winAt.map((c) => ({ s: sideOf(c), at: c })) : ww.map((s, k) => { const [x, z] = mid(s), sh = dw.includes(s) ? 2 : 0; return { s, at: s === "n" || s === "s" ? [Math.min(w - 1, x + sh + (k % 2)), z] : [x, Math.min(l - 1, z + sh + (k % 2))] }; });
  // the shell
  for (let x = -1; x <= w; x++) for (let z = -1; z <= l; z++) {
    put(x, 0, z, T.noble ? "minecraft:stone_bricks" : x < 0 || z < 0 || x >= w || z >= l ? M.base : M.floor);
    const edge = x < 0 || z < 0 || x >= w || z >= l, corner = (x < 0 || x >= w) && (z < 0 || z >= l);
    if (T.noble) { if (edge && (corner || (x + z) % 2 === 0)) for (let y = 1; y <= HEIGHT; y++) put(x, y, z, M.post, M.post.endsWith("_log") ? { pillar_axis: "y" } : null); continue; }   // a noble: a pavilion, posts every other cell round it, open between (the roof is the building's)
    for (let y = 1; y <= H; y++) if (edge) put(x, y, z, corner ? M.post : M.wall, corner && M.post.endsWith("_log") ? { pillar_axis: "y" } : null);
    put(x, H + 1, z, edge ? M.post : M.roof, edge && M.post.endsWith("_log") ? { pillar_axis: "x" } : null);
  }
  // doors and windows in the walls
  const DIR = { s: 0, w: 1, n: 2, e: 3 };   // given: a door's direction (south, west, north, east)
  for (const d of doorCells) { const [x, z] = d.at; if (T.noble) { put(x, 1, z, "minecraft:air"); continue; } put(x, 1, z, M.door, { direction: DIR[d.s], upper_block_bit: false }); put(x, 2, z, M.door, { direction: DIR[d.s], upper_block_bit: true }); }
  for (const v of winCells) { const [x, z] = v.at; put(x, 2, z, M.window, /trapdoor/.test(M.window) ? { open_bit: true, upside_down_bit: false, direction: { s: 0, n: 1, e: 2, w: 3 }[v.s] ?? 0 } : null); }   // vision: the room's fitting (cells, rows and faces of the floor plan)
  // the reserved cells: inside each door and window; the walk between the doors
  const free = new Set(), key = (x, z) => `${x},${z}`; for (let x = 0; x < w; x++) for (let z = 0; z < l; z++) free.add(key(x, z));
  const reserved = new Set();
  const front = (o) => { const [x, z] = o.at, [dx, dz] = inward[o.s]; return [x + dx, z + dz]; };
  for (const o of [...doorCells, ...winCells]) reserved.add(key(...front(o)));
  const fronts = doorCells.map(front);
  for (let a = 1; a < fronts.length; a++) { let [x, z] = fronts[0]; const [tx, tz] = fronts[a]; while (x !== tx) { reserved.add(key(x, z)); x += Math.sign(tx - x); } while (z !== tz) { reserved.add(key(x, z)); z += Math.sign(tz - z); } reserved.add(key(x, z)); }
  // the fixtures: along the walls, each its cells and its use cell clear
  const taken = new Set(), used = [];
  const wallSpots = []; for (let x = 0; x < w; x++) wallSpots.push([x, 0, "n"], [x, l - 1, "s"]); for (let z = 1; z < l - 1; z++) wallSpots.push([0, z, "w"], [w - 1, z, "e"]);   // the cells along each wall
  const DIRV = (v) => (v[1] > 0 ? 0 : v[0] < 0 ? 1 : v[1] < 0 ? 2 : 3);   // given: a vector to Bedrock's direction (south 0, west 1, north 2, east 3)
  const STAIRV = (v) => (v[0] > 0 ? 0 : v[0] < 0 ? 1 : v[1] > 0 ? 2 : 3);   // given: stairs' weirdo_direction (east 0, west 1, south 2, north 3)
  const inRoom = (p) => p[0] >= 0 && p[1] >= 0 && p[0] < w && p[1] < l;
  const holds = [...(T.holds ?? [])];
  // a room furnishes as far as its walls allow: its holds round again until a share of its wall is used (1/phi), the rest the walk
  const wallN = 2 * (w + l) - 4, need = holds.length;   // vision: the room's fitting (cells, rows and faces of the floor plan)
  if (holds.length) for (let k = 0; holds.length < Math.floor(wallN / PHI / (FIX[holds[0]].cells.length + 1)); k++) holds.push(T.holds[k % need]);   // derived: one in phi of the wall's cells, a thing and its gap
  let placedNeed = 0;
  for (const [hi, item] of holds.entries()) {
    const F = FIX[item]; let ok = false;
    for (const [x, z, side] of wallSpots) {
      const [fx, fz] = inward[side], along = side === "n" || side === "s" ? [1, 0] : [0, 1], toWall = [-fx, -fz];
      const cells = F.cells.map(([a, , b]) => [x + a * along[0] + b * fx, z + a * along[1] + b * fz]);   // a along the wall, b in from it
      if (!cells.every(inRoom) || cells.some((c) => taken.has(key(...c)) || reserved.has(key(...c)))) continue;
      const last = cells.at(-1), useCell = F.climb ? null : F.beside ? [cells[0][0] + along[0], cells[0][1] + along[1]] : [last[0] + fx, last[1] + fz];   // where you stand to use it: in front, or beside a bed
      if (useCell && (!inRoom(useCell) || taken.has(key(...useCell)))) continue;
      if (F.ring && [...taken].some((t) => { const [tx, tz] = t.split(",").map(Number); return Math.abs(tx - cells[0][0]) <= 1 && Math.abs(tz - cells[0][1]) <= 1; })) continue;   // the fire's ring clear
      const blocks = item === "bed" ? [["minecraft:red_bed", { direction: DIRV(toWall), head_piece_bit: true }], ["minecraft:red_bed", { direction: DIRV(toWall), head_piece_bit: false }]] : item === "seat" ? [["minecraft:oak_stairs", { weirdo_direction: STAIRV(toWall), upside_down_bit: false }]] : F.blocks(0);   // the bed's head at the wall
      blocks.forEach(([id, st], k) => put(cells[k][0], 1, cells[k][1], id === "minecraft:red_bed" ? "minecraft:bed" : id, st ?? null));   // given: Bedrock's bed (its colour is the block entity's: red)
      if (F.top) put(cells[0][0], 2, cells[0][1], F.top);
      if (F.vent) put(cells[0][0], H + 1, cells[0][1], "minecraft:air");   // the vent: the ceiling open over the fire
      if (F.soil) put(cells[0][0], 0, cells[0][1], "minecraft:moss_block");
      for (const c of cells) taken.add(key(...c));
      if (F.ring) for (let a2 = -1; a2 <= 1; a2++) for (let b2 = -1; b2 <= 1; b2++) reserved.add(key(cells[0][0] + a2, cells[0][1] + b2));
      if (useCell) reserved.add(key(...useCell));
      used.push({ item, cells, use: useCell }); ok = true; break;
    }
    if (!ok && hi < need) checks.push(`no place for its ${item}`);
    if (ok && hi < need) placedNeed++;
  }
  // islands: a big room's middle in rows of its own (tables and benches in a hall, pews in a shrine, stalls in a shop), an aisle between
  const ISLAND = { C: ["table", "seat"], Au: ["table", "seat"], Li: ["table", "seat"], Ag: ["counter", "seat"], Na: ["store", "counter"], Mg: ["work", "store"], Si: ["store", "store"], Ca: ["store", "store"], K: ["store", "store"], Al: ["hay", "hay"], Fe: ["anvil", "store"], Cu: ["seat", "seat"], P: ["table", "seat"], S: ["basin", "basin"], Cl: ["seat", "seat"] };   // vision: what a big room keeps in its middle
  if (!T.noble && ISLAND[sym] && w >= FIB[5] - 1 && l >= FIB[5] - 1) {   // vision: the room's fitting (cells, rows and faces of the floor plan)
    const [a, b] = ISLAND[sym];
    for (let z = 2; z < l - 2; z += FIB[3]) for (let x = 2; x < w - 2; x += 2) {   // derived: a row every three (a thing, a seat, an aisle), every other cell along it
      if (reserved.has(key(x, z)) || taken.has(key(x, z)) || reserved.has(key(x, z + 1)) || taken.has(key(x, z + 1))) continue;
      const A = FIX[a].blocks(0)[0], B = b === "seat" ? ["minecraft:oak_stairs", { weirdo_direction: sym === "Cu" ? 3 : 2, upside_down_bit: false }] : FIX[b].blocks(0)[0];   // vision: the room's fitting (cells, rows and faces of the floor plan)
      put(x, 1, z, A[0], A[1] ?? null); if (FIX[a].top) put(x, 2, z, FIX[a].top); put(x, 1, z + 1, B[0], B[1] ?? null); taken.add(key(x, z)); taken.add(key(x, z + 1));
    }
  }
  const faceOf = inward;
  // comfort: the people's own, in what's left (never on a reserved cell)
  const left = [...free].filter((k) => !taken.has(k) && !reserved.has(k)).map((k) => k.split(",").map(Number));
  const corner = left.filter(([x, z]) => (x === 0 || x === w - 1) && (z === 0 || z === l - 1));
  if (!T.noble) {
    for (const [x, z] of corner.slice(0, sym === "C" || sym === "Au" || sym === "Ag" ? 4 : 1)) { put(x, 1, z, sym === "C" || sym === "Au" || sym === "Ag" ? "minecraft:bookshelf" : "minecraft:flower_pot"); taken.add(key(x, z)); }   // vision: the room's fitting (cells, rows and faces of the floor plan)
    for (const [x, z] of [...free].map((k) => k.split(",").map(Number))) if (!taken.has(key(x, z)) && x > 0 && z > 0 && x < w - 1 && z < l - 1 && !["Mg", "Fe", "Al", "K", "Ca", "Si", "P", "Na"].includes(sym)) put(x, 1, z, `minecraft:${rug}_carpet`);   // the rug: the room's middle, in the people's first dye (not where work or animals are)
  } else for (const [x, z] of corner) put(x, 1, z, "minecraft:decorated_pot");   // a pavilion's corners: pots
  // light: lanterns hung from the ceiling at the darkest cell until every floor cell is lit to 8
  const level = () => { const L = new Map(), q = []; for (const [k, v] of vox) if (/lantern|campfire/.test(v.id)) { const [x, y, z] = k.split(",").map(Number); L.set(`${x},${z}`, Math.max(L.get(`${x},${z}`) ?? 0, 15 - (y > 1 ? 1 : 0))); q.push([x, z]); }   // vision: the room's fitting (cells, rows and faces of the floor plan)
    while (q.length) { const [x, z] = q.shift(), v = L.get(`${x},${z}`); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, nz = z + b; if (nx < 0 || nz < 0 || nx >= w || nz >= l) continue; if ((L.get(`${nx},${nz}`) ?? 0) < v - 1) { L.set(`${nx},${nz}`, v - 1); q.push([nx, nz]); } } } return L; };   // block light spreading through the room, less one a block (the floor plan's own)
  let lamps = 0;
  for (let k = 0; k < FIB[6]; k++) { const L = level(); let dark = null; for (let x = 0; x < w; x++) for (let z = 0; z < l; z++) { const v = L.get(`${x},${z}`) ?? 0; if (v < LIT && (!dark || v < dark.v)) dark = { x, z, v }; } if (!dark) break; put(dark.x, H, dark.z, "minecraft:lantern", { hanging: true }); lamps++; }   // vision: the room's fitting (cells, rows and faces of the floor plan)
  { const L = level(); let min = 15; for (let x = 0; x < w; x++) for (let z = 0; z < l; z++) min = Math.min(min, L.get(`${x},${z}`) ?? 0); if (min < LIT) checks.push(`dark at ${min}`); }   // vision: the room's fitting (cells, rows and faces of the floor plan)
  // the laws, checked: the use cells reachable from a door over free floor
  const walk = new Set(); const q = fronts.map((f) => key(...f)); q.forEach((k) => walk.add(k));
  while (q.length) { const [x, z] = q.shift().split(",").map(Number); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = key(x + a, z + b); if (free.has(k2) && !taken.has(k2) && !walk.has(k2)) { walk.add(k2); q.push(k2); } } }
  for (const u of used) if (u.use && !walk.has(key(...u.use))) checks.push(`its ${u.item} can't be reached`);
  for (const o of winCells) if (taken.has(key(...front(o)))) checks.push("a window blocked from inside");
  return { vox, checks, w, l, h: H, sym, room: T.room, doors: doorCells.length, windows: winCells.length, lamps, holds: used.map((u) => u.item) };
}
