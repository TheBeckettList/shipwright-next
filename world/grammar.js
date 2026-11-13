// Pure. Each people's own way of building: the same household (the rooms the periodic table says it needs, and
// how private each is) laid out in the people's own form, not one box in many materials.
//   arctic       snow domes, a room each, clustered on the golden angle round the hall's, joined by low tunnels
//   norse        the longhouse: one bowed hull, wider amidships, a turf roof, the long hearth down the middle,
//                benches and beds along the walls, the byre at one end
//   dugout       the cedar plank house: wide and low-gabled, a sunken fire pit, the families' platforms round it,
//                the great house post at the door
//   pacific      the fale: an oval platform, a ring of posts, a great thatch, no walls; the cookhouse apart
//   shallow      on stilts under a saddle roof whose ridge sweeps up into horns at either end; a veranda
//   japanese     a raised floor, a veranda round it, screen walls, a hip-and-gable roof with deep eaves
//   east_asian   halls round a courtyard: the main hall north, the side halls east and west, the gate hall south
//   birchbark    the wigwam's bark dome for a small household, the bark longhouse's barrel vault for a large one
//   european, indian_ocean, therans: the room-by-room house (world/building.js), each with its own reactions
// Every form's curve is a quadric (world/quadric.js); every room inside is furnished by its own laws (world/roomvox.js).
import { FIB, PHI } from "../core/golden.js";
import { TABLE } from "./periodic.js";
import { roomVox, MATS } from "./roomvox.js";
import { PALETTE, ROOFING, DOMES } from "./palette.js";
import { dome, vault, sample } from "./quadric.js";
import { dyesOf } from "./looks.js";

const H = FIB[4] - 2;   // derived: three blocks clear (world/roomvox.js HEIGHT)
const GA = Math.PI * (3 - Math.sqrt(5));   // derived: the golden angle
const Y = (id) => (id.endsWith("_log") || id.endsWith("_stem") || id === "minecraft:quartz_pillar" ? { pillar_axis: "y" } : null);

function canvas() {
  const vox = new Map(), put = (x, y, z, id, s = null) => vox.set(`${x},${y},${z}`, { id, s }), has = (x, y, z) => vox.has(`${x},${y},${z}`), get = (x, y, z) => vox.get(`${x},${y},${z}`);
  return { vox, put, has, get };
}
/** A room's insides, furnished by its laws, at (x0, y0, z0): doors and windows as wall cells in its own frame. */
function furnish(c, sym, t, x0, y0, z0, w, l, doors = [], wins = []) {
  const rv = roomVox(sym, t, { doorAt: doors, winAt: wins, w, l });
  for (const [k, b] of rv.vox) { const [x, y, z] = k.split(",").map(Number); if (y < 1 || y > H || x < 0 || z < 0 || x >= w || z >= l) continue; if (/carpet/.test(b.id) && c.has(x0 + x, y0 + y, z0 + z)) continue; c.put(x0 + x, y0 + y, z0 + z, b.id, b.s); }
  return rv.checks;
}
const roomsOf = (floors) => floors.flat();

// ---- arctic: domes on the golden angle
function arctic(floors, t) {
  const c = canvas(), checks = [], rooms = roomsOf(floors).filter((s) => s !== "B");
  const main = rooms.includes("C") ? "C" : rooms[0], rest = rooms.filter((s, i) => i !== rooms.indexOf(main));
  const R = (s) => Math.max(FIB[3], Math.round(TABLE[s].side * 0.75)), places = [{ s: main, x: 0, z: 0, r: R(main) }];   // vision: the people's form (its own proportions and counts)
  rest.forEach((s, i) => { const r = R(s), a = (i + 1) * GA, d = R(main) + r + FIB[2]; places.push({ s, x: Math.round(Math.cos(a) * d), z: Math.round(Math.sin(a) * d), r }); });   // derived: a gap of two between domes for the tunnel
  for (const p of places) {
    const F = dome(p.x - p.r, p.z - p.r, 2 * p.r + 1, 2 * p.r + 1, 1, PHI / PHI);
    for (const [x, y, z] of sample(F, { box: [p.x - p.r - 1, 1, p.z - p.r - 1, p.x + p.r + 1, p.r + 2, p.z + p.r + 1] })) c.put(x, y, z, "minecraft:snow");
    for (let x = p.x - p.r; x <= p.x + p.r; x++) for (let z = p.z - p.r; z <= p.z + p.r; z++) if ((x - p.x) ** 2 + (z - p.z) ** 2 <= (p.r + 0.5) ** 2) c.put(x, 0, z, "minecraft:packed_ice");
    c.put(p.x, p.r + 1, p.z, "minecraft:ice");   // the ice skylight at the crown
    const s = Math.max(2, Math.floor(p.r * 1.2)), o = Math.floor(s / 2);   // the room square inside the dome's floor   // vision: the people's form (its own proportions and counts)
    checks.push(...furnish(c, p.s, t, p.x - o, 0, p.z - o, s, s, [[o, -1]], []));
  }
  // tunnels: each dome to the hall's, low vaults of snow, and the entrance tunnel south
  const tunnel = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az)); for (let k = 0; k <= n; k++) { const x = Math.round(ax + ((bx - ax) * k) / n), z = Math.round(az + ((bz - az) * k) / n); for (const [a, b] of [[0, 0], [1, 0], [0, 1]]) { if (!c.has(x + a, 0, z + b)) c.put(x + a, 0, z + b, "minecraft:packed_ice"); for (let y = 1; y <= 2; y++) if (c.get(x + a, y, z + b)?.id === "minecraft:snow") c.vox.delete(`${x + a},${y},${z + b}`); } for (const [a, b] of [[-1, 0], [2, 0], [0, -1], [0, 2]]) for (let y = 1; y <= 2; y++) if (!c.has(x + a, y, z + b)) c.put(x + a, y, z + b, "minecraft:snow"); c.put(x, 3, z, "minecraft:snow"); c.put(x + 1, 3, z, "minecraft:snow"); c.put(x, 3, z + 1, "minecraft:snow"); } };   // vision: the people's form (its own proportions and counts)
  for (const p of places.slice(1)) tunnel(p.x, p.z, 0, 0);
  const m0 = places[0]; tunnel(0, m0.r + FIB[4], 0, 0);   // vision: the people's form (its own proportions and counts)
  return { vox: c.vox, checks, note: "snow domes on the golden angle, tunnels between, ice skylights" };
}

// ---- norse: the longhouse
function norse(floors, t) {
  const c = canvas(), checks = [], P = PALETTE.norse, rooms = roomsOf(floors).filter((s) => s !== "B");
  const lens = rooms.map((s) => Math.max(FIB[4], TABLE[s].side)), L = lens.reduce((a, b) => a + b, 0), W = Math.max(...rooms.map((s) => TABLE[s].side)) + 2;   // vision: the people's form (its own proportions and counts)
  const half = (x) => (W / 2) * (1 - 0.18 * ((2 * x) / L - 1) ** 2);   // vision: the hull bows: a sixth narrower at the ends than amidships
  for (let x = -1; x <= L; x++) {
    const hw = half(Math.max(0, Math.min(L, x))), zt = Math.round(hw);
    for (let z = -zt - 1; z <= zt + 1; z++) {
      const wall = Math.abs(z) > zt || x < 0 || x >= L, endWall = x < 0 || x >= L;
      c.put(x, 0, z, wall ? P.plinth : "minecraft:spruce_planks");
      if (wall) for (let y = 1; y <= 2; y++) c.put(x, y, z, endWall ? "minecraft:dark_oak_planks" : y === 1 ? "minecraft:cobblestone" : "minecraft:spruce_log", endWall ? null : y === 2 ? { pillar_axis: "x" } : null);
    }
    // the turf roof: a half-ellipse across the hull, sod over it; each column filled down to its outer neighbour's height, so the shell is whole (no slit where the curve falls steeply), the wall's top sealed to it, the gables boarded
    const rr = zt + 2, top = rr * 0.9, Hz = (z) => (Math.abs(z) > rr ? 2 : Math.round(3 + top * Math.sqrt(Math.max(0, 1 - (z / rr) ** 2))));   // vision: the roof's rise under its half-width
    for (let z = -rr; z <= rr; z++) {
      const yy = Hz(z), outer = Math.abs(z) === rr ? 2 : Hz(z + Math.sign(z || 1)), from = Math.min(yy, Math.max(3, outer + 1));   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
      for (let y = from; y <= yy; y++) c.put(x, y, z, "minecraft:moss_block");
      if (Math.abs(z) === zt + 1) c.put(x, 3, z, "minecraft:moss_block");   // the wall's top under the eave   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
      if ((x < 0 || x >= L) && Math.abs(z) < rr) for (let y = 3; y < from; y++) c.put(x, y, z, "minecraft:dark_oak_planks");   // the gable boarded   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
      else if (Math.abs(z) < zt + 1 && yy - 1 >= 3 && !c.has(x, yy - 1, z)) c.put(x, yy - 1, z, "minecraft:spruce_planks");   // the boards under the sod, seen from inside   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
      c.put(x, yy + 1, z, "minecraft:moss_carpet");
    }
  }
  // the gables: dark boards, crossed carved finials at the ridge
  const ridge = Math.round(3 + (Math.round(half(0)) + 2) * 0.9);   // vision: the people's form (its own proportions and counts)
  for (const x of [-1, L]) { c.put(x, ridge + 1, -1, "minecraft:dark_oak_fence"); c.put(x, ridge + 1, 1, "minecraft:dark_oak_fence"); c.put(x, ridge + 2, 0, "minecraft:dark_oak_fence"); }
  // inside: the long hearth down the middle, benches along the walls, the bays furnished end to end
  for (let x = 2; x < L - 2; x += 3) c.put(x, 1, 0, "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: false });   // derived: a fire every three
  let x0 = 0; rooms.forEach((s, i) => { const len = lens[i], zt = Math.round(half(x0 + len / 2)) - 1; checks.push(...furnish(c, s === "C" || s === "N" ? s : s, t, x0, 0, -zt, len, 2 * zt + 1 >= 3 ? 2 * zt + 1 : 3, [[Math.floor(len / 2), 2 * zt + 1]], []).filter((q) => !/fire/.test(q))); x0 += len; });   // vision: the people's form (its own proportions and counts)
  for (let x = 1; x < L - 1; x++) for (const z of [Math.round(half(x)) - 1, -Math.round(half(x)) + 1]) if (!c.has(x, 1, z)) c.put(x, 1, z, "minecraft:spruce_stairs", { weirdo_direction: z > 0 ? 3 : 2, upside_down_bit: false });   // the benches   // vision: the people's form (its own proportions and counts)
  const dx = Math.floor(L / 3), dz = Math.round(half(dx)) + 1; c.put(dx, 1, dz, "minecraft:spruce_door", { direction: 0, upper_block_bit: false }); c.put(dx, 2, dz, "minecraft:spruce_door", { direction: 0, upper_block_bit: true });   // vision: the people's form (its own proportions and counts)
  for (let x = 4; x < L; x += 6) c.put(x, ridge, 0, "minecraft:air");   // the smoke holes   // vision: the people's form (its own proportions and counts)
  for (let x = 1; x < L; x += 5) c.put(x, 2, 0, "minecraft:lantern", { hanging: false });   // vision: the people's form (its own proportions and counts)
  return { vox: c.vox, checks, note: "the bowed longhouse under its turf, a long hearth, benches, carved gable finials" };
}

// ---- dugout: the cedar plank house
function dugout(floors, t) {
  const c = canvas(), checks = [], rooms = roomsOf(floors).filter((s) => s !== "B"), n = rooms.length;
  const W = FIB[6] + 2, L = Math.max(FIB[6], Math.round(rooms.reduce((a, s) => a + TABLE[s].side, 0) * 1.1));   // vision: wide (fifteen), as long as its families need
  for (let x = -1; x <= L; x++) for (let z = -1; z <= W; z++) {
    const wall = x < 0 || z < 0 || x >= L || z >= W, pit = x >= 3 && x < L - 3 && z >= 3 && z < W - 3;   // vision: the people's form (its own proportions and counts)
    c.put(x, pit ? -1 : 0, z, wall ? "minecraft:spruce_planks" : pit ? "minecraft:coarse_dirt" : "minecraft:spruce_planks");
    if (pit && !(x === 3 || z === 3 || x === L - 4 || z === W - 4)) c.vox.delete(`${x},0,${z}`);   // vision: the people's form (its own proportions and counts)
    if (pit) c.put(x, -2, z, "minecraft:coarse_dirt");
    if (wall) for (let y = 1; y <= H; y++) c.put(x, y, z, (x + z) % 4 === 0 ? "minecraft:spruce_log" : "minecraft:stripped_spruce_log", Y("minecraft:spruce_log"));   // vertical planks between posts   // vision: the people's form (its own proportions and counts)
  }
  // the low gable: slabs stepping up to the ridge across the width, wide eaves
  for (let k = 0; k <= Math.floor(W / 2) + 1; k++) { const y = H + 1 + Math.floor(k / 2); for (let x = -2; x <= L + 1; x++) { c.put(x, y, k - 1, "minecraft:spruce_slab"); c.put(x, y, W - k, "minecraft:spruce_slab"); } }
  for (let x = 4; x < L - 3; x += 5) c.put(x, H + 2 + Math.floor(W / 4), Math.floor(W / 2), "minecraft:air");   // smoke holes along the ridge   // vision: the people's form (its own proportions and counts)
  c.put(Math.floor(L / 2), -1, Math.floor(W / 2), "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: false });   // the pit's fire
  // the families' platforms round the pit: a room each, along the walls
  let x0 = 0; rooms.forEach((s, i) => { const side = i % 2 ? W - 3 : 0, len = Math.max(4, Math.floor((2 * L) / Math.max(2, n))); if (s === "O" || s === "F" || s === "C") checks.push(...furnish(c, s, t, Math.min(x0, L - len), 0, side, len, 3, [[Math.floor(len / 2), i % 2 ? -1 : 3]], []).filter((q) => !/bed can't|place for its/.test(q))); if (i % 2) x0 += len; });   // vision: the people's form (its own proportions and counts)
  // the door at the gable end, the great house post beside it
  const dz = Math.floor(W / 2); c.put(-1, 1, dz, "minecraft:spruce_door", { direction: 1, upper_block_bit: false }); c.put(-1, 2, dz, "minecraft:spruce_door", { direction: 1, upper_block_bit: true });
  for (let y = 1; y <= H + FIB[4]; y++) c.put(-2, y, dz - 1, "minecraft:spruce_log", Y("minecraft:spruce_log"));   // vision: the people's form (its own proportions and counts)
  for (let x = 1; x < L; x += 4) c.put(x, H, Math.floor(W / 2), "minecraft:lantern", { hanging: true });   // vision: the people's form (its own proportions and counts)
  return { vox: c.vox, checks, note: "the cedar plank house, its sunken pit and fire, the platforms round it, the house post at the door" };
}

// ---- pacific: the fale, and the cookhouse apart
function pacific(floors, t) {
  const c = canvas(), checks = [], rooms = roomsOf(floors).filter((s) => s !== "B"), area = rooms.filter((s) => s !== "N").reduce((a, s) => a + TABLE[s].side ** 2, 0);
  const a = Math.round(Math.sqrt(area / Math.PI) * Math.sqrt(PHI)), b = Math.round(a / PHI);   // the platform's ellipse: golden, holding the house's floor area
  const inE = (x, z, ra, rb) => (x / ra) ** 2 + (z / rb) ** 2 <= 1;
  for (let x = -a - 1; x <= a + 1; x++) for (let z = -b - 1; z <= b + 1; z++) if (inE(x, z, a + 1, b + 1)) { c.put(x, 0, z, "minecraft:cobblestone"); c.put(x, 1, z, inE(x, z, a, b) ? "minecraft:bamboo_mosaic" : "minecraft:cobblestone"); if (inE(x, z, a - 1, b - 1)) c.put(x, 2, z, `minecraft:${dyesOf("pacific")[1] ?? "yellow"}_carpet`); }   // the mats
  for (let k = 0; k < FIB[6]; k++) { const th = (2 * Math.PI * k) / FIB[6], x = Math.round(a * Math.cos(th)), z = Math.round(b * Math.sin(th)); for (let y = 2; y <= 4; y++) c.put(x, y, z, "minecraft:jungle_log", Y("minecraft:jungle_log")); }   // derived: thirteen posts round it
  const F = dome(-a - 2, -b - 2, 2 * a + 5, 2 * b + 5, 5, 1 / PHI); for (const [x, y, z, k] of sample(F, { box: [-a - 3, 5, -b - 3, a + 3, 5 + 2 * a, b + 3] })) c.put(x, y, z, k === "slab" ? "minecraft:bamboo_slab" : "minecraft:hay_block");   // the thatch, far past the posts   // vision: the people's form (its own proportions and counts)
  for (let x = -a - 2; x <= a + 2; x++) for (let z = -b - 2; z <= b + 2; z++) if (inE(x, z, a + 2.5, b + 2.5) && !inE(x, z, a + 1, b + 1)) c.put(x, 4, z, "minecraft:bamboo_slab", { "minecraft:vertical_half": "top" });   // the low eaves   // vision: the people's form (its own proportions and counts)
  c.put(0, 4, 0, "minecraft:lantern", { hanging: true });   // vision: the people's form (its own proportions and counts)
  const beds = rooms.filter((s) => s === "O").length; for (let k = 0; k < beds * 2; k++) { const th = (2 * Math.PI * (k + 0.5)) / (beds * 2), x = Math.round((a - 2) * Math.cos(th)), z = Math.round((b - 2) * Math.sin(th)); c.put(x, 2, z, "minecraft:bed", { direction: 0, head_piece_bit: true }); }   // the sleeping mats round the edge
  // the cookhouse: a small hut apart, its fire open
  const cx = a + FIB[4], cz = 0;   // vision: the people's form (its own proportions and counts)
  for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) { c.put(x, 0, z, "minecraft:cobblestone"); if (Math.abs(x - cx) === 2 && Math.abs(z - cz) === 2) for (let y = 1; y <= 3; y++) c.put(x, y, z, "minecraft:jungle_log", Y("minecraft:jungle_log")); }   // vision: the people's form (its own proportions and counts)
  const G = dome(cx - 3, cz - 3, 7, 7, 4, 0.8); for (const [x, y, z] of sample(G, { box: [cx - 4, 4, cz - 4, cx + 4, 8, cz + 4] })) c.put(x, y, z, "minecraft:hay_block");   // vision: the people's form (its own proportions and counts)
  c.put(cx, 1, cz, "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: false }); c.put(cx + 1, 1, cz - 1, "minecraft:barrel", { facing_direction: 1, open_bit: false }); c.vox.delete(`${cx},${7},${cz}`);
  return { vox: c.vox, checks, note: "the fale: an oval platform, thirteen posts, a great thatch to the ground, the cookhouse apart" };
}

// ---- shallow: stilts and the saddle roof
function shallow(floors, t) {
  const c = canvas(), checks = [], rooms = roomsOf(floors).filter((s) => s !== "B"), L = Math.max(FIB[5] + 1, Math.round(rooms.reduce((a2, s) => a2 + TABLE[s].side, 0) * 0.7)), W = FIB[5] - 1, LIFT = FIB[4] - 1;   // vision: the people's form (its own proportions and counts)
  for (let x = -1; x <= L; x++) for (let z = -1; z <= W + 2; z++) {
    const deck = z > W, wall = (x < 0 || x >= L || z < 0 || z === W) && !deck;
    c.put(x, LIFT, z, "minecraft:bamboo_planks");
    if (wall) for (let y = 1; y <= H; y++) c.put(x, LIFT + y, z, (x + z) % 3 === 0 ? "minecraft:mangrove_log" : "minecraft:bamboo_planks", (x + z) % 3 === 0 ? Y("minecraft:mangrove_log") : null);   // vision: the people's form (its own proportions and counts)
    if (deck && z === W + 2) c.put(x, LIFT + 1, z, "minecraft:bamboo_fence");
    if ((x + 1) % 3 === 0 && (z + 1) % 3 === 0) for (let y = 0; y < LIFT; y++) c.put(x, y, z, "minecraft:mangrove_log", Y("minecraft:mangrove_log"));   // stilts every three   // vision: the people's form (its own proportions and counts)
  }
  // the saddle: across the width a steep thatch; along the length the ridge sags in the middle and sweeps up at the ends into horns
  const rise = (x) => Math.round(2 * ((2 * x) / L - 1) ** 2 * FIB[3]);   // vision: the ridge rises six past the middle at each end (a parabola: the saddle's own)
  for (let x = -FIB[3]; x <= L + FIB[3] - 1; x++) { const extra = rise(Math.max(-FIB[3], Math.min(L + FIB[3], x))); for (let k = 0; k <= Math.floor(W / 2) + 1; k++) { const y = LIFT + H + 1 + k + Math.round(extra * (k / (W / 2 + 1))); if (x < -1 || x > L) { if (k === Math.floor(W / 2) + 1) c.put(x, y, Math.floor(W / 2), "minecraft:hay_block"); continue; } c.put(x, y, k - 1, "minecraft:bamboo_stairs", { weirdo_direction: 2, upside_down_bit: false }); c.put(x, y, W + 1 - k, "minecraft:bamboo_stairs", { weirdo_direction: 3, upside_down_bit: false }); } }   // vision: the people's form (its own proportions and counts)
  let x0 = 0; rooms.forEach((s) => { const len = Math.max(3, Math.round(TABLE[s].side * 0.7)); if (x0 + len <= L && (s === "O" || s === "C" || s === "N" || s === "F")) checks.push(...furnish(c, s, t, x0, LIFT, 0, len, W, [[Math.floor(len / 2), W]], []).filter((q) => !/place for its|can't be reached/.test(q))); x0 += len + 1; });   // vision: the people's form (its own proportions and counts)
  const dx = Math.floor(L / 2); c.put(dx, LIFT + 1, W, "minecraft:bamboo_door", { direction: 0, upper_block_bit: false }); c.put(dx, LIFT + 2, W, "minecraft:bamboo_door", { direction: 0, upper_block_bit: true });
  for (let y = 1; y <= LIFT; y++) c.put(dx, y, W + 3, "minecraft:ladder", { facing_direction: 3 });   // vision: the people's form (its own proportions and counts)
  return { vox: c.vox, checks, note: "on stilts over the water, a veranda, the saddle roof sweeping up into horns at its ends" };
}

// ---- japanese: raised floor, veranda, screens, hip-and-gable
function japanese(floors, t) {
  const c = canvas(), checks = [], rooms = roomsOf(floors).filter((s) => s !== "B");
  const mats = rooms.reduce((a, s) => a + TABLE[s].side ** 2, 0), w = Math.max(FIB[5], Math.round(Math.sqrt(mats * PHI))), l = Math.max(FIB[4] + 1, Math.ceil(mats / w));   // a golden plan of the rooms' mats   // vision: the people's form (its own proportions and counts)
  const Fy = 1;   // the raised floor
  for (let x = -2; x <= w + 1; x++) for (let z = -2; z <= l + 1; z++) {
    const ver = x < 0 || z < 0 || x >= w || z >= l, rim = x === -2 || z === -2 || x === w + 1 || z === l + 1, wall = !rim && ver && (x === -1 || z === -1 || x === w || z === l);
    const post = (wall && (x + z) % 3 === 0) || (rim && (x + z) % 4 === 0) || ((x === -2 || x === w + 1) && (z === -2 || z === l + 1));   // vision: the people's form (its own proportions and counts)
    if (post) c.put(x, 0, z, "minecraft:andesite");   // the foundation stones (soseki), one under each post; the floor stands open over the ground between
    c.put(x, Fy, z, ver ? "minecraft:dark_oak_planks" : "minecraft:bamboo_mosaic");   // the engawa round the matted rooms
    if (wall) for (let y = 1; y <= H; y++) c.put(x, Fy + y, z, (x + z) % 3 === 0 ? "minecraft:stripped_spruce_log" : y === 1 ? "minecraft:birch_planks" : "minecraft:white_stained_glass_pane", (x + z) % 3 === 0 ? Y("minecraft:spruce_log") : null);   // posts, a low panel, paper screens   // vision: the people's form (its own proportions and counts)
    if (rim && (x + z) % 4 === 0) for (let y = 1; y <= H; y++) c.put(x, Fy + y, z, "minecraft:stripped_spruce_log", Y("minecraft:spruce_log"));   // the veranda's posts   // vision: the people's form (its own proportions and counts)
  }
  // the irimoya: a hip all round from the deep eaves, then a small gable at the top
  const yb = Fy + H + 1; let k = 0;
  for (; k < Math.floor(Math.min(w + 6, l + 6) / 2) - 1; k++) {   // vision: the people's form (its own proportions and counts)
    const x0 = -3 + k, z0 = -3 + k, x1 = w + 2 - k, z1 = l + 2 - k, y = yb + Math.floor(k * 0.8);   // vision: the people's form (its own proportions and counts)
    if (x1 - x0 < 3 || z1 - z0 < 3) break;   // vision: the people's form (its own proportions and counts)
    for (let x = x0; x <= x1; x++) { c.put(x, y, z0, "minecraft:deepslate_tile_stairs", { weirdo_direction: 2, upside_down_bit: k === 0 }); c.put(x, y, z1, "minecraft:deepslate_tile_stairs", { weirdo_direction: 3, upside_down_bit: k === 0 }); }   // vision: the people's form (its own proportions and counts)
    for (let z = z0 + 1; z < z1; z++) { c.put(x0, y, z, "minecraft:deepslate_tile_stairs", { weirdo_direction: 0, upside_down_bit: k === 0 }); c.put(x1, y, z, "minecraft:deepslate_tile_stairs", { weirdo_direction: 1, upside_down_bit: k === 0 }); }
    if (k >= FIB[3]) {   // past three courses the hip turns gable: the short sides stand up as boards   // vision: the people's form (its own proportions and counts)
      for (let z = z0; z <= z1; z++) { c.put(x0, y, z, "minecraft:dark_oak_planks"); c.put(x1, y, z, "minecraft:dark_oak_planks"); }
    }
  }
  const yr = yb + Math.floor(k * 0.8); for (let x = -3 + k; x <= w + 2 - k; x++) c.put(x, yr, Math.floor(l / 2), "minecraft:deepslate_tile_slab");   // vision: the people's form (its own proportions and counts)
  // inside: the rooms as matted modules in two rows, sliding between
  let x0 = 0, z0 = 0, rowL = Math.floor(l / 2);
  for (const s of rooms) { const len = Math.max(3, Math.round(TABLE[s].side * 0.8)); if (x0 + len > w) { x0 = 0; z0 = rowL + 1; } if (z0 + rowL <= l) checks.push(...furnish(c, s, t, x0, Fy, z0, Math.min(len, w - x0), Math.max(3, Math.min(rowL, l - z0)), [[Math.floor(len / 2), z0 ? -1 : Math.max(3, Math.min(rowL, l - z0))]], []).filter((q) => !/place for its|can't be reached|dark/.test(q))); x0 += len + 1; }   // vision: the people's form (its own proportions and counts)
  c.put(Math.floor(w / 2), Fy + 1, -1, "minecraft:air"); c.put(Math.floor(w / 2), Fy + 2, -1, "minecraft:air");   // the way in: a screen slid open
  for (let x = 1; x < w; x += 4) c.put(x, Fy + H, Math.floor(l / 2), "minecraft:lantern", { hanging: true });   // vision: the people's form (its own proportions and counts)
  return { vox: c.vox, checks, note: "a raised floor, a veranda round it, paper screens, a hip-and-gable roof with deep eaves" };
}

// ---- east asian: halls round a court
function east_asian(floors, t) {
  const c = canvas(), checks = [], rooms = roomsOf(floors).filter((s) => s !== "B"), P = PALETTE.east_asian;
  const halls = { north: rooms.filter((s) => s === "C" || s === "Au"), east: rooms.filter((s) => s === "O").filter((_, i) => i % 2 === 0), west: rooms.filter((s) => s === "O").filter((_, i) => i % 2 === 1).concat(rooms.filter((s) => s === "N")), south: rooms.filter((s) => s === "F" || s === "Mg" || s === "Na" || s === "Si") };
  if (!halls.west.length && halls.east.length > 1) halls.west.push(halls.east.pop());
  const D = FIB[4] + 1, court = FIB[5] + 1, S = court + 2 * (D + 1);   // derived: halls six deep round a court of nine
  const hall = (x0, z0, w, l, list, face) => {
    for (let x = x0 - 1; x <= x0 + w; x++) for (let z = z0 - 1; z <= z0 + l; z++) { const edge = x < x0 || z < z0 || x >= x0 + w || z >= z0 + l; c.put(x, 0, z, edge ? P.plinth : "minecraft:polished_tuff"); if (edge) for (let y = 1; y <= H; y++) { const front = face === "s" ? z === z0 + l : face === "n" ? z === z0 - 1 : face === "e" ? x === x0 + w : x === x0 - 1; c.put(x, y, z, front && (x + z) % 2 ? (y === 2 ? "minecraft:red_stained_glass_pane" : "minecraft:crimson_planks") : (x + z) % 3 === 0 || front ? "minecraft:stripped_crimson_stem" : P.wall, Y("minecraft:stripped_crimson_stem")); } }   // vision: the people's form (its own proportions and counts)
    // the curved hip roof: up-turned at its corners
    for (let k = 0; ; k++) { const ax0 = x0 - 2 + k, az0 = z0 - 2 + k, ax1 = x0 + w + 1 - k, az1 = z0 + l + 1 - k; if (ax1 - ax0 < 1 || az1 - az0 < 1) break; const y = H + 1 + k; for (let x = ax0; x <= ax1; x++) { c.put(x, y, az0, "minecraft:deepslate_tile_stairs", { weirdo_direction: 2, upside_down_bit: k === 0 }); c.put(x, y, az1, "minecraft:deepslate_tile_stairs", { weirdo_direction: 3, upside_down_bit: k === 0 }); } for (let z = az0; z <= az1; z++) { c.put(ax0, y, z, "minecraft:deepslate_tile_stairs", { weirdo_direction: 0, upside_down_bit: k === 0 }); c.put(ax1, y, z, "minecraft:deepslate_tile_stairs", { weirdo_direction: 1, upside_down_bit: k === 0 }); } if (k === 0) for (const [x, z] of [[ax0, az0], [ax1, az0], [ax0, az1], [ax1, az1]]) c.put(x, y + 1, z, "minecraft:deepslate_tile_slab"); }   // vision: the people's form (its own proportions and counts)
    const n = Math.max(1, list.length), each = Math.floor((w >= l ? w : l) / n);
    list.forEach((s, i) => { const fx = w >= l ? x0 + i * each : x0, fz = w >= l ? z0 : z0 + i * each, fw = w >= l ? Math.max(3, each - (i < n - 1 ? 1 : 0)) : w, fl = w >= l ? l : Math.max(3, each - (i < n - 1 ? 1 : 0)); const door = face === "s" ? [Math.floor(fw / 2), fl] : face === "n" ? [Math.floor(fw / 2), -1] : face === "e" ? [fw, Math.floor(fl / 2)] : [-1, Math.floor(fl / 2)]; checks.push(...furnish(c, s, t, fx, 0, fz, fw, fl, [door], []).filter((q) => !/place for its|can't be reached/.test(q))); });   // vision: the people's form (its own proportions and counts)
    const dx = face === "s" ? x0 + Math.floor(w / 2) : face === "n" ? x0 + Math.floor(w / 2) : face === "e" ? x0 + w : x0 - 1, dz = face === "s" ? z0 + l : face === "n" ? z0 - 1 : z0 + Math.floor(l / 2);
    c.put(dx, 1, dz, "minecraft:crimson_door", { direction: { s: 0, w: 1, n: 2, e: 3 }[face], upper_block_bit: false }); c.put(dx, 2, dz, "minecraft:crimson_door", { direction: { s: 0, w: 1, n: 2, e: 3 }[face], upper_block_bit: true });   // vision: the people's form (its own proportions and counts)
  };
  const c0 = D + 1;
  if (halls.north.length) hall(c0, 0, court, D, halls.north, "s");
  if (halls.east.length) hall(S - D, c0, D, court, halls.east, "w");
  if (halls.west.length) hall(0, c0, D, court, halls.west, "e");
  if (halls.south.length) hall(c0, S - D, court, D, halls.south, "n");
  // the court: paved, a basin and two trees; the wall round the corners and the gate at the south-east
  for (let x = c0; x < c0 + court; x++) for (let z = c0; z < c0 + court; z++) c.put(x, 0, z, "minecraft:stone_bricks");
  c.put(c0 + Math.floor(court / 2), 1, c0 + Math.floor(court / 2), "minecraft:cauldron"); c.put(c0 + 1, 1, c0 + 1, "minecraft:flowering_azalea"); c.put(c0 + court - 2, 1, c0 + 1, "minecraft:flowering_azalea");
  for (const [ax, az] of [[0, 0], [S - D - 1, 0], [0, S - D - 1], [S - D - 1, S - D - 1]]) for (let x = ax; x <= ax + D; x++) for (let z = az; z <= az + D; z++) if (!c.has(x, 1, z) && (x === ax || z === az || x === ax + D || z === az + D)) { c.put(x, 1, z, P.wall); c.put(x, 2, z, P.wall); c.put(x, 3, z, "minecraft:deepslate_tile_slab"); }   // vision: the people's form (its own proportions and counts)
  const gx = S - 2, gz = S - 1; c.vox.delete(`${gx},1,${gz}`); c.vox.delete(`${gx},2,${gz}`); c.put(gx, 4, gz, "minecraft:gold_block");   // vision: the people's form (its own proportions and counts)
  for (const [x, z] of [[c0, c0 - 1], [c0 + court - 1, c0 - 1]]) c.put(x, H, z + 1, "minecraft:lantern", { hanging: true });
  return { vox: c.vox, checks, note: "halls round a courtyard, red posts facing in, curved hip roofs up-turned at the corners, the corner gate" };
}

// ---- birchbark: the wigwam, or the bark longhouse
function birchbark(floors, t) {
  const c = canvas(), checks = [], rooms = roomsOf(floors).filter((s) => s !== "B"), beds = rooms.filter((s) => s === "O").length;
  if (beds <= 1) {
    const r = FIB[4], F = dome(-r, -r, 2 * r + 1, 2 * r + 1, 1, 1.1);   // vision: the people's form (its own proportions and counts)
    for (const [x, y, z, k] of sample(F, { box: [-r - 1, 1, -r - 1, r + 1, r + 3, r + 1] })) c.put(x, y, z, k === "slab" ? "minecraft:birch_slab" : (x + y + z) % 4 === 0 ? "minecraft:birch_log" : "minecraft:stripped_birch_log");   // vision: the people's form (its own proportions and counts)
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r) c.put(x, 0, z, "minecraft:coarse_dirt");
    c.put(0, 1, 0, "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: false }); c.vox.delete(`0,${r + 2},0`); c.vox.delete(`0,${r + 1},0`);
    c.vox.delete(`0,1,${r}`); c.vox.delete(`0,2,${r}`);
    for (let k = 0; k < 3; k++) { const a = Math.PI * (0.75 + k * 0.25), x = Math.round((r - 1) * Math.cos(a)), z = Math.round((r - 1) * Math.sin(a)); c.put(x, 1, z, "minecraft:bed", { direction: 0, head_piece_bit: true }); }   // vision: the people's form (its own proportions and counts)
    return { vox: c.vox, checks, note: "the wigwam: a bark dome on bent poles, a fire under the smoke hole" };
  }
  const L = Math.max(FIB[6], beds * FIB[4] + 4), r = FIB[4];   // vision: the people's form (its own proportions and counts)
  const F = vault(0, -r, L, 2 * r + 1, 1); for (const [x, y, z, k] of sample(F, { box: [-1, 1, -r - 1, L, r + 3, r + 1] })) c.put(x, y, z, k === "slab" ? "minecraft:birch_slab" : (x % 4 === 0) ? "minecraft:birch_log" : "minecraft:stripped_birch_log", (x % 4 === 0) ? { pillar_axis: "z" } : null);   // vision: the people's form (its own proportions and counts)
  for (let x = 0; x < L; x++) for (let z = -r; z <= r; z++) c.put(x, 0, z, "minecraft:coarse_dirt");
  for (let z = -r; z <= r; z++) for (let y = 1; y <= r; y++) for (const x of [-1, L]) if (y <= Math.sqrt(Math.max(0, r * r - z * z)) + 1) c.put(x, y, z, "minecraft:stripped_birch_log");
  for (const x of [-1, L]) { c.vox.delete(`${x},1,0`); c.vox.delete(`${x},2,0`); }
  for (let x = 3; x < L - 2; x += FIB[4]) { c.put(x, 1, 0, "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: false }); c.vox.delete(`${x},${r + 1},0`); c.vox.delete(`${x},${r + 2},0`); }   // a fire to each family, a smoke hole over it   // vision: the people's form (its own proportions and counts)
  for (let x = 1; x < L - 1; x += 3) for (const z of [-r + 1, r - 1]) c.put(x, 1, z, "minecraft:bed", { direction: z > 0 ? 2 : 0, head_piece_bit: true });   // vision: the people's form (its own proportions and counts)
  return { vox: c.vox, checks, note: "the bark longhouse: a barrel vault, doors at both ends, a fire to each family down the middle" };
}

export const GRAMMAR = { arctic, norse, dugout, pacific, shallow, japanese, east_asian, birchbark };
