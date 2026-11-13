// Pure. The country's math: the town's turned inside out.
//
//   the town (world/growth.js)              the country (here)
//   sand poured at a heart: dense in,        the land's fitness spread out: dense where the land is good
//     thin out
//   the streets first, the buildings         the sites first (where the land allows), the paths after (the
//     bonded to them (attraction:              walks between them over the ground)
//     a kink is the best site)
//   neighbours attract (rows)                neighbours repel: each module keeps its land, spaced by how poor
//                                              the land is (a Poisson disc whose radius grows as fitness falls)
//   a lattice the streets trace              a tree of least effort: every gate's walk back to the town,
//                                              climbing dear, so the lanes keep to the contours and merge
//
//   fitness   F = ease^phi x the water's nearness (a stream or the shore within a field's reach, a golden
//             part more) x the walk from the town (a farm wants its market near: 1 / (1 + dT / band)); a
//             ranch takes rougher ground (ease^(1/phi)), a farm wants it flat
//   a module  a farm (or ranch) laid out whole, square to the world, its front to the town: the yard (the
//             house, the barn or byre, the coop and its run, the well, the woodpile, the kitchen garden), a
//             farm track down its side, the fields behind in fenced rectangles that share their lines, each
//             with a gate on the track. Three sizes in golden proportion; the land decides which fits.
import { FIB, PHI } from "../core/golden.js";
import { hashAt } from "../core/noise.js";

export const MODULE = {
  SIZES: [[FIB[9], FIB[10]], [FIB[8], FIB[9]], [FIB[7], FIB[8]]],   // vision: 55 by 89, 34 by 55, 21 by 34: golden rectangles, the largest first
  FIELD: FIB[6],      // vision: a field 13 deep
  YARD_GAP: FIB[3],   // vision: three blocks between the yard's buildings
  APART: FIB[6],      // vision: thirteen blocks of open country between two modules at the least, more on poor land
};
/** A module's plan in its own frame (x across, z back from its front at z = 0): its yard's spots, its track, its fields. */
export function moduleOf({ kind, W, L, house, outs }) {
  const g = MODULE.YARD_GAP, trackX = W - 2;
  // the yard: the house then the outbuildings along the front, a row behind if they don't fit
  const spots = []; let x = 2, row = 0, depth = 0, z0 = 2, rowDepth = 0;
  const most = L / PHI ** 2;   // the yard a golden square's share of the module's length at the most (the fields the rest)
  for (const [i, b] of [house, ...outs].entries()) {
    let nx = x, nz = z0, nr = row, nd = rowDepth;
    if (nx + b.w > trackX - 1) { nr++; nz += nd + g; nx = 2; nd = 0; }
    if (nr > 1 || nz + b.l + g > most || b.w > trackX - 3) { if (i === 0) return null; continue; }   // an outbuilding that won't fit is left out (the house never)   // vision: the terrace's own measure
    x = nx; z0 = nz; row = nr; rowDepth = nd;
    spots.push({ b, i, cx: x + b.w / 2, cz: z0 + b.l / 2 }); x += b.w + g; rowDepth = Math.max(rowDepth, b.l); depth = Math.max(depth, z0 + b.l);
  }
  const yard = depth + g;   // derived: the yard as deep as its buildings and a gap (its things stand beside them)
  if (yard >= L - FIB[5]) return null;   // no room left for a field: too small a module for these buildings   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
  const free = trackX - 2 - x, things = { coop: free >= FIB[4] ? [x, 2] : null, well: free >= FIB[5] + 2 ? [x + FIB[4] + 1, 3] : null, wood: free >= FIB[6] ? [x + FIB[5], 2] : null, garden: null };   // vision: the yard's things beside its buildings, as the room allows
  // the fields: rows of a field's depth behind the yard, split in two across where the module is wide; the track on the right
  const fields = [], fw = trackX - 1, cols = kind === "farm" && fw > FIB[8] ? 2 : 1;   // a ranch's paddocks run the width   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
  for (let z = yard; z + FIB[4] < L - 1; z += MODULE.FIELD) {   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
    const z1 = Math.min(L - 1, z + MODULE.FIELD); for (let c = 0; c < cols; c++) { const x0 = c === 0 ? 0 : Math.floor(fw / 2), x1 = c === cols - 1 ? trackX - 1 : Math.floor(fw / 2); fields.push({ x0, z0: z, x1, z1 }); }
  }
  if (!fields.length) return null;
  const lastZ = Math.max(...fields.map((f) => f.z0)); for (const f of fields) if (f.z0 === lastZ) f.z1 = L - 1;   // the last row runs to the back fence
  // what each field is: a farm's orchard by the yard, its crops, its hay meadow at the back; a ranch's pen by the yard, its pastures, its meadow
  fields.forEach((f, i) => { f.kind = kind === "farm" ? (i === 0 ? "orchard" : i === fields.length - 1 && fields.length > 2 ? "meadow" : "crop") : i === 0 ? "pen" : i === fields.length - 1 && fields.length > 2 ? "meadow" : "pasture"; });
  if (kind === "ranch") { for (let i = 0; i + 1 < fields.length; i++) if (fields[i].kind === "pasture" && fields[i + 1].kind === "pasture" && fields[i].z0 === fields[i + 1].z0) { fields[i].x1 = fields[i + 1].x1; fields.splice(i + 1, 1); } }   // a ranch's pastures run the module's width
  // the fence plan, each line once: the outer rectangle (a gate at the front where the lane comes in, on the track), the yard's back line,
  // the track's inner side, the rows between fields, the split down a wide farm's middle; a gate from each field onto the track
  const fence = new Set(), gates = [], line = (x0, z0, x1, z1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) fence.add(`${x},${z}`); };
  line(0, L - 1, W - 1, L - 1); line(0, 0, 0, L - 1); line(W - 1, 0, W - 1, L - 1);   // the outer rectangle, its front open: the yard meets the lane
  line(0, yard, trackX - 1, yard);   // the yard's back
  line(trackX - 1, yard, trackX - 1, L - 1);   // the track's inner side
  for (const f of fields) { line(f.x0, f.z0, f.x1, f.z0); line(f.x0, f.z1, f.x1, f.z1); if (f.x0 > 0) line(f.x0, f.z0, f.x0, f.z1); }   // the rows and the split, shared
  for (const f of fields) { const gz = Math.round((f.z0 + f.z1) / 2); if (f.x1 + 1 >= trackX - 1) gates.push([trackX - 1, gz]); else gates.push([Math.round((f.x0 + f.x1) / 2), f.z0]); }   // each field's gate onto the track (or, a field off it, into the one before)
  for (const [x, z] of gates) fence.delete(`${x},${z}`);
  return { kind, W, L, yard, trackX, spots, things, fields, fence: [...fence].map((k) => k.split(",").map(Number)), gates };
}

// ---- drawing a module: put(x, y, z, id, states) in the world; at(lx, lz) the world cell of a module cell
const FENCE = { japanese: "minecraft:bamboo_fence", birchbark: "minecraft:birch_fence", european: "minecraft:oak_fence" };   // vision: each people's fence wood (spruce the rest)
const CROPS = {
  european: ["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"], norse: ["minecraft:wheat", "minecraft:potatoes", "minecraft:beetroot"],
  japanese: ["minecraft:wheat"], east_asian: ["minecraft:wheat", "minecraft:carrots"], indian_ocean: ["minecraft:wheat", "minecraft:melon_stem"], therans: ["minecraft:wheat", "minecraft:beetroot"],
  dugout: ["minecraft:wheat", "minecraft:pumpkin_stem"], birchbark: ["minecraft:wheat", "minecraft:pumpkin_stem"], pacific: ["taro"], shallow: ["taro"], arctic: [],
};
const BEASTS = {
  european: { pasture: ["minecraft:cow", "minecraft:sheep", "minecraft:horse"], pen: ["minecraft:pig"] }, norse: { pasture: ["minecraft:sheep", "minecraft:cow", "minecraft:horse"], pen: ["minecraft:pig"] },
  japanese: { pasture: ["minecraft:horse", "minecraft:cow"], pen: ["minecraft:pig"] }, east_asian: { pasture: ["minecraft:cow", "minecraft:horse"], pen: ["minecraft:pig"] },
  indian_ocean: { pasture: ["minecraft:goat", "minecraft:cow", "minecraft:camel"], pen: ["minecraft:goat"] }, therans: { pasture: ["minecraft:goat", "minecraft:sheep"], pen: ["minecraft:pig"] },
  pacific: { pasture: ["minecraft:pig"], pen: ["minecraft:pig"] }, shallow: { pasture: ["minecraft:pig"], pen: ["minecraft:pig"] },
  dugout: { pasture: ["minecraft:goat"], pen: ["minecraft:chicken"] }, birchbark: { pasture: ["minecraft:goat"], pen: ["minecraft:chicken"] }, arctic: { pasture: ["minecraft:goat"], pen: ["minecraft:goat"] },
};   // vision: theirs, in vanilla's own beasts
const PADDY = new Set(["japanese", "east_asian"]);
const LEAF = { persistent_bit: true };
const tree = (put, x, y, z, log, leaves, tall) => { for (let k = 1; k <= tall; k++) put(x, y + k, z, log, { pillar_axis: "y" }); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = tall - 1; c <= tall + 1; c++) if (a * a + b * b + (c - tall) ** 2 <= FIB[4] && (a || b || c > tall)) put(x + a, y + c, z + b, leaves, LEAF); };   // vision: a small round crown
export function drawModule(m, t, { put, H, at, spawn = () => {}, seed = 0, dig = () => {} }) {
  const fence = FENCE[t] ?? "minecraft:spruce_fence", gate = fence.replace("_fence", "_fence_gate"), crops = CROPS[t] ?? CROPS.european, beasts = BEASTS[t] ?? BEASTS.european;
  // the terraces: each field levelled to its own median, the yard to its own (a farm's fields step down a slope as banks along their fences);
  // a fence line stands on the field it starts (its z0, its x0), the track and the outer edge on the field beside them
  const nat = (lx, lz) => { const [x, z] = at(lx, lz); return Math.round(H(x, z)); }, med = (cells) => { const v = cells.map(([a, b]) => nat(a, b)).sort((a, b) => a - b); return v[v.length >> 1] ?? 0; };
  const fieldAt = (lx, lz) => m.fields.findIndex((f) => lx >= f.x0 && lx < Math.max(f.x0 + 1, f.x1 + (f.x1 >= m.trackX - 1 ? 1 : 0)) && lz >= f.z0 && lz < Math.max(f.z0 + 1, f.z1 + (f.z1 === m.L - 1 ? 1 : 0)));
  const yardCells = []; for (let lx = 0; lx < m.W; lx++) for (let lz = 0; lz < m.yard; lz++) yardCells.push([lx, lz]);
  const Yy = m.Y ?? med(yardCells), lv = m.fields.map((f) => { const c2 = []; for (let lx = f.x0 + 1; lx < f.x1; lx++) for (let lz = f.z0 + 1; lz < f.z1; lz++) c2.push([lx, lz]); return med(c2.length ? c2 : [[f.x0, f.z0]]); });
  const level = (lx, lz) => { if (lz < m.yard) return Yy; const fi = fieldAt(Math.min(lx, m.trackX - 2), lz); return fi >= 0 ? lv[fi] : Yy; };
  for (let lx = 0; lx < m.W; lx++) for (let lz = 0; lz < m.L; lz++) { const [x, z] = at(lx, lz), g = nat(lx, lz), Y0 = level(lx, lz); for (let y = Y0 + 1; y <= g + 1; y++) dig(x, y, z); for (let y = g; y < Y0; y++) put(x, y, z, "minecraft:dirt"); }
  const P = (lx, lz) => { const [x, z] = at(lx, lz); return [x, level(lx, lz), z]; };
  const set = (lx, lz, dy, id, st = null) => { const [x, y, z] = P(lx, lz); put(x, y + dy, z, id, st); };
  // the ground: the yard trodden in patches, the track a path, the rest grass
  for (let lx = 0; lx < m.W; lx++) for (let lz = 0; lz < m.L; lz++) set(lx, lz, 0, lx === m.trackX ? "minecraft:grass_path" : lz < m.yard && (lx * 7 + lz * 3) % FIB[4] === 0 ? "minecraft:coarse_dirt" : "minecraft:grass_block");   // vision: the yard worn in patches
  for (const [lx, lz] of m.fence) set(lx, lz, 1, fence);
  const turned = at(1, 0)[0] === at(0, 0)[0];   // the module's x along the world's z: a gate across its line turns with it
  for (const [lx, lz] of m.gates) set(lx, lz, 1, gate, { direction: (lz === 0 || m.fields.some((f) => f.z0 === lz) ? 0 : 1) ^ (turned ? 1 : 0), open_bit: false, in_wall_bit: false });   // given: a gate across its line
  for (const [fi, f] of m.fields.entries()) {
    const stage = Math.floor(hashAt(fi, f.z0, seed + 13) * 8), crop = crops[(fi + seed) % Math.max(1, crops.length)], every = PADDY.has(t) ? 2 : FIB[4] - 1;   // given: a crop's eight stages; derived: a channel every fourth row (every other for paddies)
    for (let lx = f.x0 + 1; lx < f.x1; lx++) for (let lz = f.z0 + 1; lz < f.z1; lz++) {
      if (lx >= m.trackX - 1) continue;
      if (f.kind === "orchard") { if ((lx - f.x0) % FIB[4] === 2 && (lz - f.z0) % FIB[4] === 2) { const [x, y, z] = P(lx, lz); tree(put, x, y, z, "minecraft:oak_log", "minecraft:oak_leaves", FIB[3]); } else if (hashAt(lx, lz, seed + 5) < 1 / FIB[8]) set(lx, lz, 1, "minecraft:beehive", { direction: 2 }); continue; }   // vision: a tree every five, a hive here and there
      if (f.kind === "meadow") { if (hashAt(lx, lz, seed + 7) < 1 / FIB[7]) set(lx, lz, 1, "minecraft:hay_block", { pillar_axis: "y" }); else if (hashAt(lx, lz, seed + 9) < 1 / FIB[5]) set(lx, lz, 1, "minecraft:short_grass"); continue; }   // vision: the hay cut and stacked, the grass long
      if (f.kind === "pen" || f.kind === "pasture") { if (f.kind === "pen" && lx === f.x0 + 2 && lz === f.z0 + 2) set(lx, lz, 0, "minecraft:water"); else if (hashAt(lx, lz, seed + 11) < 1 / FIB[9]) set(lx, lz, 1, "minecraft:hay_block", { pillar_axis: "y" }); continue; }   // the pen's trough; a bale put out in the pasture   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
      if (!crops.length) continue;
      const row = (fi % 2 ? lx : lz);
      if (crop === "taro") { set(lx, lz, 0, row % 2 ? "minecraft:mud" : "minecraft:water"); if (row % 2) set(lx, lz, 1, "minecraft:fern"); continue; }
      if (row % every === 0) { set(lx, lz, 0, "minecraft:water"); continue; }
      set(lx, lz, 0, "minecraft:farmland", { moisturized_amount: 7 });   // given: farmland at its wettest
      set(lx, lz, 1, crop, { growth: stage });
    }
    if (f.kind === "crop" && crops.length) { const sx = Math.round((f.x0 + f.x1) / 2), sz = Math.round((f.z0 + f.z1) / 2) + 1; set(sx, sz, 0, "minecraft:farmland", { moisturized_amount: 7 }); set(sx, sz, 1, fence); set(sx, sz, 2, "minecraft:hay_block", { pillar_axis: "y" }); set(sx, sz, 3, "minecraft:carved_pumpkin", { "minecraft:cardinal_direction": "south" }); }   // the scarecrow   // given: farmland at its wettest
    if (f.kind === "pen" || f.kind === "pasture") { const herd = f.kind === "pen" ? beasts.pen : beasts.pasture, area = (f.x1 - f.x0) * (f.z1 - f.z0), n = Math.max(1, Math.floor(area / FIB[7])); for (let j = 0; j < n; j++) { const lx = f.x0 + 2 + Math.floor(hashAt(j, fi, seed + 17) * Math.max(1, f.x1 - f.x0 - 3)), lz = f.z0 + 2 + Math.floor(hashAt(fi, j, seed + 19) * Math.max(1, f.z1 - f.z0 - 3)), [x, y, z] = P(lx, lz); spawn(herd[j % herd.length], x, y + 1, z); } }   // vision: a beast to every 21 blocks
  }
  // the yard's things: the coop and its run (and its hens), the well, the woodpile, the kitchen garden
  const wood = t === "japanese" ? "minecraft:bamboo_planks" : "minecraft:spruce_planks";
  if (m.things.coop) { const [cx, cz] = m.things.coop; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { set(cx + a, cz + b, 0, wood); if (a === 1 && b === 2) continue; if (a !== 1 || b !== 1) set(cx + a, cz + b, 1, wood); set(cx + a, cz + b, 2, "minecraft:oak_slab", { "minecraft:vertical_half": "bottom" }); }   // the coop, its door to the run   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
    for (let a = 0; a <= 3; a++) for (let b = 3; b <= 5; b++) if (a === 3 || b === 5) set(cx + a, cz + b, 1, "minecraft:oak_fence");   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
    for (let j = 0; j < FIB[4]; j++) { const [x, y, z] = P(cx + (j % 3), cz + 3 + (j % 2)); spawn("minecraft:chicken", x, y + 1, z); } }   // vision: five hens
  if (m.things.well) { const [wx, wz] = m.things.well; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) set(wx + a, wz + b, 1, "minecraft:cobblestone_wall"); set(wx, wz, 0, "minecraft:water"); }
  if (m.things.wood) { const [wx, wz] = m.things.wood; for (let a = 0; a < 3; a++) for (let y = 1; y <= 2; y++) set(wx + a, wz, y, "minecraft:spruce_log", { pillar_axis: "x" }); }   // the woodpile   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
  if (m.things.garden) { const [gx, gz] = m.things.garden; for (let a = 0; a < FIB[4]; a++) for (let b = 0; b < 3; b++) { set(gx + a, gz + b, 0, "minecraft:farmland", { moisturized_amount: 7 }); set(gx + a, gz + b, 1, b === 1 ? "minecraft:carrots" : "minecraft:potatoes", { growth: FIB[4] }); } }   // the kitchen garden   // given: farmland at its wettest
  return m.kind;
}
