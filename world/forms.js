// Pure. The forms of the buildings that aren't homes: the shed, the store, the boathouse, the tower. A home is
// its people's grammar (world/grammar.js) or its rooms (world/building.js); a barn is not a house with a byre
// in it. Each form takes its rooms (their areas give its footprint, their fixtures furnish it) and the
// people's style (how it posts, walls, raises and roofs), so the same form is a different building in each
// people's hands, and the seed's extras (a lean-to, a porch, a chimney, a yard, pots) set two of a people's
// apart.
//
//   footprint  the rooms' area, laid out golden (width the root of area over phi), the rooms in bays along it
//   shed       posts every three, open on the fronts (closed at the back where the people closes it), the
//              work in the bays: smithy, loft, ropewalk, shearing shed, fish market, woodshed
//   store      closed, raised where the people raises its stores (on posts, staddles, stilts), one door,
//              vents not windows: granary, warehouse, kura, stabbur, cache
//   boathouse  as long as the boat and two, its gable to the water, the water end open; the naust's low
//              stone sides, the funaya's house above, the canoe house's open thatch (world/boatsizes.js)
//   tower      a stair's square (or a pole frame) to a fenced platform: the lookout, the beacon's fire, the
//              gatehouse's passage under it
import { FIB, PHI } from "../core/golden.js";
import { TABLE } from "./periodic.js";
import { roomVox, HEIGHT } from "./roomvox.js";
import { PALETTE, ROOFING } from "./palette.js";
import { spire, sample } from "./quadric.js";

const H = HEIGHT, Y = { pillar_axis: "y" };
// vision: each people's way with a working building (the one choice per people): posts, walls, base, roof, raised
export const STYLE = {
  norse: { post: "minecraft:spruce_log", wall: "minecraft:spruce_planks", base: "minecraft:mossy_cobblestone", floor: "minecraft:spruce_planks", roof: "turf", roofs: { store: "gable", tower: "gable" }, roofing: "shingle", raise: { store: 1 }, back: true, accent: "minecraft:dark_oak_fence" },   // vision: the stabbur on its posts, the turf
  european: { post: "minecraft:dark_oak_log", wall: "minecraft:oak_planks", base: "minecraft:stone_bricks", floor: "minecraft:cobblestone", roof: "gable", roofing: "slate", raise: { store: 1 }, back: true, staddle: true, accent: "minecraft:lantern" },   // vision: the staddle granary, the boarded barn
  therans: { post: "minecraft:quartz_pillar", wall: "minecraft:white_concrete", base: "minecraft:calcite", floor: "minecraft:polished_tuff", roof: "flat", trim: "minecraft:gold_block", door: "minecraft:warped_door", raise: {}, back: true, pots: true, accent: "minecraft:blue_concrete" },   // vision: the storerooms' pithoi
  indian_ocean: { post: "minecraft:mangrove_log", wall: "minecraft:smooth_sandstone", base: "minecraft:sandstone", floor: "minecraft:sandstone", roof: "flat", trim: "minecraft:smooth_sandstone", beams: "minecraft:mangrove_log", raise: {}, back: true, pots: true, accent: "minecraft:dark_oak_trapdoor" },   // vision: the beam ends through the wall
  east_asian: { post: "minecraft:stripped_crimson_stem", wall: "minecraft:mud_bricks", base: "minecraft:polished_andesite", floor: "minecraft:stone_bricks", roof: "curved", roofing: "slate", raise: {}, back: true, accent: "minecraft:red_wool" },   // vision: the up-turned eaves
  japanese: { post: "minecraft:stripped_spruce_log", wall: "minecraft:dark_oak_planks", storeWall: "minecraft:white_concrete", storeBase: "minecraft:deepslate_tiles", base: "minecraft:stone_bricks", floor: "minecraft:dark_oak_planks", roof: "hip", roofing: "slate", raise: {}, back: true, accent: "minecraft:white_wool" },   // vision: the kura's white walls on their dark tiled base
  pacific: { post: "minecraft:jungle_log", wall: "minecraft:bamboo_planks", base: "minecraft:cobblestone", floor: "minecraft:bamboo_mosaic", roof: "thatch", raise: { store: 2 }, back: false, accent: "minecraft:yellow_wool" },   // vision: the storehouse on its post, open walls
  dugout: { post: "minecraft:spruce_log", wall: "minecraft:stripped_spruce_log", base: "minecraft:spruce_planks", floor: "minecraft:spruce_planks", roof: "low", roofing: "cedar", raise: { store: 2 }, back: true, racks: true, accent: "minecraft:red_wool" },   // vision: the raised cache, the drying racks
  birchbark: { post: "minecraft:birch_log", wall: "minecraft:stripped_birch_log", base: "minecraft:coarse_dirt", floor: "minecraft:coarse_dirt", roof: "vault", roofing: "bark", raise: { store: 2 }, back: false, racks: true, accent: "minecraft:birch_fence" },   // vision: the cache on poles
  shallow: { post: "minecraft:mangrove_log", wall: "minecraft:bamboo_planks", base: "minecraft:mangrove_roots", floor: "minecraft:bamboo_planks", roof: "thatch", raise: { shed: 1, store: 2, boathouse: 0 }, stilts: true, back: false, accent: "minecraft:green_wool" },   // vision: everything on stilts but the boat's shed
  arctic: { post: "minecraft:bone_block", wall: "minecraft:light_gray_wool", base: "minecraft:cobblestone", floor: "minecraft:spruce_planks", roof: "skin", raise: {}, back: true, cairn: true, accent: "minecraft:bone_block" },   // vision: skin over a bone and drift-wood frame, the stone cache
};

function canvas() {
  const vox = new Map(), put = (x, y, z, id, s = null) => vox.set(`${x},${y},${z}`, { id, s }), has = (x, y, z) => vox.has(`${x},${y},${z}`), get = (x, y, z) => vox.get(`${x},${y},${z}`), del = (x, y, z) => vox.delete(`${x},${y},${z}`);
  return { vox, put, has, get, del };
}
const u = (seed, n) => (((seed + n) * PHI) % 1);   // derived: the seed's golden steps
/** The rooms' footprint: a golden rectangle of their area, long along x. */
function footprint(rooms, aspect = PHI) {
  const area = rooms.reduce((a, s) => a + TABLE[s].side ** 2, 0), W = Math.max(FIB[3], Math.min(FIB[6], Math.round(Math.sqrt(area / aspect)))), L = Math.max(W, Math.ceil(area / W));   // derived: three to thirteen wide
  return { L, W };
}
/** The rooms' fixtures in bays along x, each bay its room's share of the length. */
function furnish(c, rooms, t, y0, L, W, skip = () => false) {
  const total = rooms.reduce((a, s) => a + TABLE[s].side, 0); let x0 = 0;
  for (const s of rooms) {
    const len = Math.max(FIB[3], Math.round((TABLE[s].side / total) * L)), w = Math.min(len, L - x0); if (w < FIB[3]) break;   // vision: the form's own measure (its people's proportions and counts)
    const rv = roomVox(s, t, { w, l: W, doorAt: [[Math.floor(w / 2), -1]], winAt: [] });
    for (const [k, b] of rv.vox) { const [x, y, z] = k.split(",").map(Number); if (y < 1 || y > H || x < 0 || z < 0 || x >= w || z >= W || /door|pane|glass/.test(b.id) || skip(x0 + x, z)) continue; c.put(x0 + x, y0 + y, z, b.id, b.s); }
    x0 += w;
  }
}

// ---- roofs over a rectangle [x0..x1] x [z0..z1] at y; return the roof's top
const STAIR = { n: 2, s: 3, w: 0, e: 1 };   // given: Bedrock's stair facings (weirdo_direction) up toward the middle from each side
function roof(c, x0, z0, x1, z1, y, S0, t, form = null) {
  const S = S0.roofs?.[form] ? { ...S0, roof: S0.roofs[form] } : S0;
  const R = ROOFING[S.roofing ?? PALETTE[t]?.roof] ?? ROOFING.shingle, alongX = x1 - x0 >= z1 - z0;
  if (S.roof === "flat") {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const edge = x === x0 || z === z0 || x === x1 || z === z1; c.put(x, y, z, edge ? S.trim ?? S.wall : S.wall); if (edge) c.put(x, y + 1, z, (x === x0 || x === x1) && (z === z0 || z === z1) && S.trim ? S.trim : S.wall === "minecraft:white_concrete" ? "minecraft:white_concrete" : "minecraft:smooth_sandstone_slab"); }
    if (S.beams) for (let x = x0 + 1; x < x1; x += FIB[3]) for (const z of [z0 - 1, z1 + 1]) c.put(x, y - 1, z, S.beams, { pillar_axis: "z" });   // derived: the beams' ends every three
    return y + 1;
  }
  if (S.roof === "turf") {
    const half = (alongX ? z1 - z0 : x1 - x0) / 2 + 1, mid = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
    let top = y;
    for (let a = alongX ? x0 - 1 : z0 - 1; a <= (alongX ? x1 + 1 : z1 + 1); a++) for (let b = Math.floor(mid - half); b <= Math.ceil(mid + half); b++) {
      const d = Math.abs(b - mid) / half; if (d > 1) continue; const yy = y + Math.round(half * Math.sqrt(1 - d * d) / PHI); top = Math.max(top, yy);   // derived: the sod's half-ellipse, its rise the half-width over phi
      const [x, z] = alongX ? [a, b] : [b, a]; c.put(x, yy, z, "minecraft:moss_block"); c.put(x, yy - 1, z, "minecraft:spruce_planks"); c.put(x, yy + 1, z, "minecraft:moss_carpet");
    }
    return top + 1;
  }
  if (S.roof === "vault") {
    const r = (alongX ? z1 - z0 + 2 : x1 - x0 + 2) / 2, mid = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2; let top = y;
    for (let a = alongX ? x0 - 1 : z0 - 1; a <= (alongX ? x1 + 1 : z1 + 1); a++) for (let b = Math.floor(mid - r); b <= Math.ceil(mid + r); b++) {
      const d = Math.abs(b - mid) / r; if (d > 1) continue; const yy = y - 1 + Math.round(r * Math.sqrt(1 - d * d)); top = Math.max(top, yy);
      const [x, z] = alongX ? [a, b] : [b, a]; for (let k = yy; k >= Math.max(y - 1, yy - 1); k--) c.put(x, k, z, a % FIB[4] === 0 ? "minecraft:birch_log" : R.block, a % FIB[4] === 0 ? { pillar_axis: alongX ? "z" : "x" } : null);   // derived: a bent pole every five
    }
    return top + 1;
  }
  if (S.roof === "skin") {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = Math.max(x1 - x0, z1 - z0) / 2 + 1, F = spire(cx, cz, r, y - H, r * PHI);   // derived: the tent's cone, its height the radius times phi
    let top = y; for (const [x, yy, z] of sample(F, { box: [Math.floor(cx - r - 1), y - H, Math.floor(cz - r - 1), Math.ceil(cx + r + 1), y + Math.ceil(r * PHI), Math.ceil(cz + r + 1)] })) { if (yy > y - H) { c.put(x, yy, z, (x + z) % FIB[3] ? S.wall : "minecraft:brown_wool"); top = Math.max(top, yy); } }   // derived: a darker hide in every third
    c.put(Math.round(cx), top + 1, Math.round(cz), S.post, Y);
    return top + 2;
  }
  // the pitched roofs: gable (two slopes), hip and curved (four), thatch (four, steep, deep), low (two, a rise of a half)
  const over = S.roof === "thatch" ? 2 : 1, four = S.roof === "hip" || S.roof === "curved" || S.roof === "thatch", slow = S.roof === "low" ? 2 : 1;
  const block = S.roof === "thatch" ? "minecraft:hay_block" : R.block, stairs = S.roof === "thatch" ? "minecraft:bamboo_stairs" : R.stairs, slab = S.roof === "thatch" ? "minecraft:bamboo_slab" : R.slab;
  let k = 0, ax0 = x0 - over, az0 = z0 - over, ax1 = x1 + over, az1 = z1 + over;
  for (;; k++) {
    const yy = y + Math.floor(k / slow);
    const lo = alongX ? az1 - az0 : ax1 - ax0; if (four ? Math.min(ax1 - ax0, az1 - az0) < 2 : lo < 2) break;
    const up = (S.roof === "curved" && k === 0) ? 1 : 0;
    if (alongX || four) for (let x = ax0; x <= ax1; x++) { c.put(x, yy, az0, stairs, { weirdo_direction: STAIR.n, upside_down_bit: false }); c.put(x, yy, az1, stairs, { weirdo_direction: STAIR.s, upside_down_bit: false }); }
    if (!alongX || four) for (let z = az0 + (four ? 1 : 0); z <= az1 - (four ? 1 : 0); z++) { c.put(ax0, yy, z, stairs, { weirdo_direction: STAIR.w, upside_down_bit: false }); c.put(ax1, yy, z, stairs, { weirdo_direction: STAIR.e, upside_down_bit: false }); }
    if (up) for (const [x, z] of [[ax0, az0], [ax1, az0], [ax0, az1], [ax1, az1]]) c.put(x, yy + 1, z, slab);   // the up-turned corners
    if (!four) for (const x of [ax0 + over, ax1 - over]) for (let z = az0 + 1; z < az1; z++) if (yy > y) c.put(x, yy, z, S.wall);   // the gables' ends
    if (four || alongX) { az0++; az1--; } if (four || !alongX) { ax0++; ax1--; }
    if (four && k === FIB[3] && S.roof === "hip") { for (let z = az0; z <= az1; z++) { c.put(ax0, yy + 1, z, S.post, null); c.put(ax1, yy + 1, z, S.post, null); } }   // past three courses the hip's small gable stands up   // vision: the form's own measure (its people's proportions and counts)
  }
  const yr = y + Math.floor(k / slow); for (let x = ax0; x <= ax1; x++) for (let z = az0; z <= az1; z++) c.put(x, yr, z, k > 0 ? slab : block);
  return yr + 1;
}

// ---- the forms
/** A building of a form: { vox, checks, note, size }. rooms: its formula's rooms (no stair halls); t: the people; seed: its extras. */
export function formOf(form, rooms0, t = "european", { seed = 0, boat = null } = {}) {
  const S = STYLE[t] ?? STYLE.european, c = canvas(), rooms = rooms0.filter((s) => s !== "B" && s !== "Be" && s !== "H"), notes = [];
  const lift = form === "boathouse" ? 0 : (S.raise?.[form] ?? 0) + (S.stilts && form !== "boathouse" ? FIB[3] - (S.raise?.[form] ?? 0) : 0);   // derived: stilts three up over the water
  const aspect = form === "shed" && rooms.every((s) => s === "Be") ? PHI ** FIB[4] : u(seed, 0) < 1 / PHI ? PHI : PHI * PHI;   // derived: most golden, some a golden step longer
  let { L, W } = footprint(rooms.length ? rooms : ["Mg"], aspect);
  if (rooms0.filter((s) => s === "Be").length >= FIB[3]) { L = FIB[8] + rooms0.length * FIB[4]; W = FIB[3]; }   // a ropewalk: thirty-four and more long, three wide (a rope's walk)   // vision: the form's own measure (its people's proportions and counts)
  if (form === "boathouse") { L = (boat?.l ?? FIB[5] + 2); W = boat?.w ?? FIB[3] + 1; }   // vision: the form's own measure (its people's proportions and counts)
  if (form === "tower") { L = W = FIB[4]; }   // vision: the form's own measure (its people's proportions and counts)
  const y0 = lift, wallTop = y0 + H + (form === "boathouse" && t === "japanese" ? H + 1 : 0);
  // the raise: posts, staddles, stilts, or the stone platform
  if (lift) for (let x = 0; x < L; x++) for (let z = 0; z < W; z++) if ((x % FIB[3] === 0 || x === L - 1) && (z === 0 || z === W - 1)) for (let y = 0; y < lift; y++) c.put(x, y, z, S.staddle && y === lift - 1 ? "minecraft:stone_brick_slab" : S.staddle ? "minecraft:stone_brick_wall" : S.post, S.staddle ? (y === lift - 1 ? { "minecraft:vertical_half": "top" } : null) : Y);   // derived: a post every three on the long sides
  // the floor and the walls
  const open = form === "shed", openFront = (x, z) => form === "shed" ? z === -1 || (!S.back && z === W) || x === -1 || x === L : form === "boathouse" ? x === L : false;
  const isPost = (x, z) => (x === -1 || x === L || x % FIB[3] === 0) && (z === -1 || z === W) || ((x === -1 || x === L) && (z === -1 || z === W));   // vision: the form's own measure (its people's proportions and counts)
  for (let x = -1; x <= L; x++) for (let z = -1; z <= W; z++) {
    const edge = x < 0 || z < 0 || x >= L || z >= W;
    if (form === "boathouse" && !edge && x > 0) { for (let y = -FIB[2]; y < 0; y++) c.put(x, y, z, "minecraft:water"); c.put(x, -FIB[3], z, "minecraft:gravel"); continue; }   // the boat's slip of water under the roof   // vision: the form's own measure (its people's proportions and counts)
    c.put(x, y0, z, edge ? (form === "store" && S.storeBase) || S.base : S.floor);
    if (!edge) continue;
    const post = isPost(x, z), stone = form === "boathouse" && t === "norse";   // the naust: stone side walls
    for (let y = y0 + 1; y <= wallTop; y++) {
      if (form === "boathouse" && x === L) break;   // the water end open
      if (open && openFront(x, z) && !post) continue;
      const id = post ? S.post : stone && y <= y0 + 2 ? "minecraft:cobblestone" : form === "store" && S.storeWall ? (y === y0 + 1 ? S.storeBase : S.storeWall) : S.wall;
      c.put(x, y, z, id, post || id.endsWith("_log") ? Y : null);
    }
  }
  // the door (the long side's middle; a store's raised door with steps), vents
  const dx = Math.floor(L / 2), door = S.door ?? PALETTE[t]?.door ?? "minecraft:spruce_door";
  if (form !== "shed") { const dz = form === "boathouse" ? -1 : W; c.put(dx, y0 + 1, dz, door, { direction: dz < 0 ? 2 : 0, upper_block_bit: false }); c.put(dx, y0 + 2, dz, door, { direction: dz < 0 ? 2 : 0, upper_block_bit: true }); if (lift) for (let k = 1; k <= lift; k++) c.put(dx, y0 - k + 1, dz + k, "minecraft:ladder", { facing_direction: 3 }); }   // given: the door's halves; the ladder on the wall below
  if (form === "store") for (let x = 1; x < L - 1; x += FIB[4]) c.put(x, y0 + H, -1, PALETTE[t]?.window ?? "minecraft:spruce_trapdoor", { direction: 0, open_bit: false, upside_down_bit: false });   // vents every five, high   // vision: the form's own measure (its people's proportions and counts)
  if (form === "boathouse") { for (let z = 0; z < W; z++) c.put(L, wallTop + 1, z, S.wall); c.put(L, wallTop, Math.floor(W / 2), "minecraft:air"); }   // the gable over the water's mouth
  // the furnishing: the rooms' fixtures in their bays
  if (form === "shed" || form === "store") furnish(c, rooms, t, y0, L, W);
  if (form === "boathouse") { for (let x = 1; x < L; x++) { c.put(x, 0, 0, S.floor); c.put(x, 0, W - 1, S.floor); } c.put(1, 1, 0, "minecraft:barrel", { facing_direction: 1, open_bit: false }); c.put(2, 1, W - 1, "minecraft:chest", { "minecraft:cardinal_direction": "north" }); }   // the walks a side of the slip, the gear
  if (form === "boathouse" && t === "japanese") { for (let x = 0; x < L; x++) for (let z = 0; z < W; z++) c.put(x, H + 1, z, S.floor); furnish(c, ["O", "C"], t, H + 1, L, W); notes.push("the house over the boat"); }   // the funaya: the family above, the boat below
  // the tower: a stair inside to a fenced platform; the beacon's fire on it; the gate's passage
  let top;
  if (form === "tower" && S.cairn) {   // the far north's lookout: a standing stone figure on the ridge, no stair
    c.vox.clear(); const h = FIB[5];   // vision: the form's own measure (its people's proportions and counts)
    for (let y = 0; y < h; y++) { const w = y < FIB[3] ? 1 : 0; for (let x = -w; x <= w; x++) for (let z = -w; z <= w; z++) c.put(x, y, z, "minecraft:cobblestone"); }   // vision: the form's own measure (its people's proportions and counts)
    for (let x = -FIB[2]; x <= FIB[2]; x++) c.put(x, FIB[4], 0, "minecraft:cobblestone_slab", { "minecraft:vertical_half": "bottom" });   // the arms   // vision: the form's own measure (its people's proportions and counts)
    return { vox: c.vox, checks: [], note: "the inuksuk: a standing stone figure on the ridge", size: { w: FIB[4], l: FIB[3], h } };   // vision: the form's own measure (its people's proportions and counts)
  }
  if (form === "tower") {
    const h = rooms.includes("Li") ? FIB[6] : rooms.includes("O") ? FIB[5] : FIB[5] + FIB[3];   // vision: the beacon thirteen up, the gatehouse eight, the lookout eleven
    for (let y = y0 + 1; y <= y0 + h; y++) for (let x = -1; x <= L; x++) for (let z = -1; z <= W; z++) { const edge = x < 0 || z < 0 || x >= L || z >= W; if (edge) c.put(x, y, z, isPost(x, z) || S.roof === "skin" || S.roof === "vault" || S.roof === "thatch" ? S.post : S.wall, isPost(x, z) ? Y : null); }
    if (S.roof === "skin" || S.roof === "vault" || S.roof === "thatch" || S.roof === "low") for (let y = y0 + 1; y <= y0 + h; y++) for (let x = -1; x <= L; x++) for (let z = -1; z <= W; z++) if (!isPost(x, z) && (x < 0 || z < 0 || x >= L || z >= W) && (y + x + z) % FIB[3]) c.del(x, y, z);   // the pole peoples' towers: a frame, open between   // vision: the form's own measure (its people's proportions and counts)
    for (let y = y0 + 1; y <= y0 + h; y++) c.put(Math.floor(L / 2), y, Math.floor(W / 2), "minecraft:ladder", { facing_direction: 2 });
    for (let x = -2; x <= L + 1; x++) for (let z = -2; z <= W + 1; z++) { c.put(x, y0 + h + 1, z, S.floor); if (x === -2 || z === -2 || x === L + 1 || z === W + 1) c.put(x, y0 + h + 2, z, S.accent?.endsWith("fence") ? S.accent : "minecraft:spruce_fence"); }
    c.del(Math.floor(L / 2), y0 + h + 1, Math.floor(W / 2));
    if (rooms.includes("Li")) { c.put(1, y0 + h + 2, 1, "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: false }); notes.push("the beacon's fire"); }
    if (rooms.includes("O")) { for (let y = y0 + 1; y <= y0 + FIB[3]; y++) for (const z of [-1, W]) c.del(Math.floor(L / 2), y, z); notes.push("the gate's passage under it"); }   // vision: the form's own measure (its people's proportions and counts)
    for (const [x, z] of [[-2, -2], [L + 1, -2], [-2, W + 1], [L + 1, W + 1]]) for (let y = y0 + h + 2; y <= y0 + h + FIB[3] + 1; y++) c.put(x, y, z, S.post, Y);   // vision: the form's own measure (its people's proportions and counts)
    top = roof(c, -2, -2, L + 1, W + 1, y0 + h + FIB[3] + 2, S.roof === "flat" ? { ...S, roof: "flat" } : S, t);   // vision: the form's own measure (its people's proportions and counts)
  } else top = roof(c, -1, -1, L, W, wallTop + 1, S, t, form);
  // the extras, by the seed: a lean-to, a chimney over the fire, pots, a yard, racks
  if (form !== "tower" && u(seed, 1) < 1 / PHI) {   // derived: a lean-to on most
    const lz = W + 1, lw = FIB[3];   // vision: the form's own measure (its people's proportions and counts)
    for (let x = 0; x < Math.min(L, FIB[5]); x++) { for (let z = lz; z < lz + lw; z++) c.put(x, y0, z, S.floor); if (x % FIB[3] === 0) for (let y = y0 + 1; y <= y0 + 2; y++) c.put(x, y, lz + lw - 1, S.post, Y); for (let z = lz - 1; z < lz + lw; z++) c.put(x, y0 + FIB[3] - (z - lz + 1 > 1 ? 1 : 0), z, ROOFING[S.roofing ?? PALETTE[t]?.roof]?.slab ?? "minecraft:spruce_slab"); }   // vision: the form's own measure (its people's proportions and counts)
    c.put(1, y0 + 1, lz, "minecraft:barrel", { facing_direction: 1, open_bit: false }); c.put(2, y0 + 1, lz, "minecraft:hay_block", { pillar_axis: "y" }); notes.push("a lean-to");
  }
  if (rooms.some((s) => s === "Fe" || s === "P" || s === "N")) { const cx = FIB[2], cz = Math.floor(W / 2); for (let y = y0 + 1; y <= top + 1; y++) if (!c.get(cx, y, cz) || y > wallTop) c.put(cx, y, cz, t === "therans" ? (y === top + 1 ? "waterworld:blue_glazed_roof_full" : "waterworld:theran_marble_polished") : S.roof === "flat" || t === "european" ? "minecraft:brick_block" : "minecraft:cobblestone"); c.put(cx, top + 2, cz, "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: true }); notes.push("a chimney over the fire"); }   // brick is for chimneys (world/palette.js); the Therans' flue white marble, a blue band under its fire (brick threw their white, gold and blue off)
  if (S.pots && u(seed, 2) < 1 / PHI) { for (let x = 0; x < L; x += FIB[3]) c.put(x, y0 + 1, W + 1, "minecraft:decorated_pot", { direction: 0 }); notes.push("pots along the wall"); }   // the pithoi in a row   // vision: the form's own measure (its people's proportions and counts)
  if (S.racks && (form === "shed" || u(seed, 3) < 1 / PHI)) { for (let x = 0; x < L; x += FIB[3]) { for (let y = 1; y <= FIB[3]; y++) c.put(x, y, -FIB[3], S.post, Y); } for (let x = 0; x < L; x++) c.put(x, FIB[3], -FIB[3], "minecraft:spruce_fence"); notes.push("drying racks"); }   // derived: a rack's poles every three, three up
  if (S.cairn && form === "store" && rooms.every((r) => r === "Ca")) { c.vox.clear(); for (let y = 0; y < FIB[3]; y++) for (let x = -2 + y; x <= 2 - y; x++) for (let z = -2 + y; z <= 2 - y; z++) c.put(x, y, z, y === FIB[3] - 1 ? "minecraft:cobblestone_slab" : "minecraft:cobblestone"); c.put(0, 1, 0, "minecraft:barrel", { facing_direction: 1, open_bit: false }); return { vox: c.vox, checks: [], note: "the stone cache: a cairn over the meat", size: { w: 5, l: 5, h: FIB[3] } }; }   // derived: a cairn five across, three high
  if (u(seed, 4) < 1 / PHI ** 2 && form !== "tower") {   // a yard fenced round, its gate at the front   // vision: the form's own measure (its people's proportions and counts)
    const F = S.accent?.endsWith("fence") ? S.accent : "minecraft:oak_fence", fy = y0 && !lift ? y0 + 1 : 1, xa = -FIB[3], xb = L + FIB[2], za = -FIB[3] - 1, zb = W + FIB[4], gx = Math.floor(L / 2);   // vision: the form's own measure (its people's proportions and counts)
    for (let x = xa; x <= xb; x++) for (const z of [za, zb]) if (!(z === zb && Math.abs(x - gx) <= 1)) c.put(x, fy, z, F);
    for (let z = za; z <= zb; z++) for (const x of [xa, xb]) c.put(x, fy, z, F);
    notes.push("a yard fenced");
  }
  const note = { shed: "an open shed on posts", store: "a closed store", boathouse: "a boathouse, its gable to the water", tower: "a tower to a fenced platform" }[form];
  return { vox: c.vox, checks: [], note: [note, ...notes].join(", "), size: { w: L, l: W, h: top } };
}

/** The form a type takes (world/census.js), where it isn't a home or a hall. */
export const FORM_OF = {
  smithy: "shed", workshop: "shed", lodge: "shed", tannery: "shed", weavery: "shed", shearing: "shed", minehead: "shed", woodshed: "shed", loft: "shed", ropewalk: "shed", fishmarket: "shed", smokehouse: "shed", shipyard: "shed", bakehouse: "store",
  barn: "store", byre: "store", granary: "store", warehouse: "store",
  boathouse: "boathouse", lookout: "tower", beacon: "tower", gatehouse: "tower",
};
