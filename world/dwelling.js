// Pure. A household's house, from what it needs to what it looks like, by the culture's own laws.
// Almost nothing here is a design choice: the choices are the culture's (its FORM, below, one line
// each, from how it really built), and everything else follows from the people and from vanilla.
//
//   household  folk a home: the people's folk over its homes (society and buildings)
//   needs      vanilla's own rules for a home that works: a bed for every villager (a villager
//              claims a bed, and no bed, no villager); the household's workstation (its trade:
//              jobs.js); a store (chest, or barrels where they fish); a fire (a campfire on the floor
//              where it's cold, with a vent in the roof; a stove against the wall where it's mild;
//              a cooking fire out in the yard where it's hot); a crafting table; a door; and light,
//              every floor cell at block light 8 or more, so nothing spawns indoors (a lantern's
//              15, less one a block)
//   rooms      each fixture takes its cells and one in front to reach it; a room is the smallest
//              rectangle in golden proportion (consecutive Fibonacci sides, as near phi as whole
//              blocks get) that holds them. Clear height from the climate: two blocks (a player is
//              1.8) where it's cold (keep the heat low), three where it's mild, four where it's hot
//              (let it rise). Walls doubled where the people builds massive (cold or hot-dry)
//   forms      the culture's own plan (FORM): the longhall, the two-cell, the round lodge, the open
//              platform, the courtyard, the mat-module house, the compound of huts, the stilt
//              house, the snow dome, the Akrotiri town house. Each places the same needs its own way
//   checks     every house is checked as it's made: beds = household, every fixture reachable from
//              the door (walkable: two blocks of clear air over a floor), every floor cell lit to
//              8. A lantern is added at the darkest cell until it is
//
// A house is voxels: "x,y,z" -> { id, s (block states), d (data, e.g. a bed's colour) }, x east, z
// south, y up, from its south-west corner at floor level. Every id is vanilla (the vanilla lens).
import { CALIBRATION } from "../game/calibration.js";
import { PHI, FIB, golden, word, cuts } from "../core/golden.js";
import { dyesOf } from "./looks.js";
import { JOBS } from "./jobs.js";
import { TRADITIONS } from "./traditions.js";
import { plan as planOfRooms, BONDS } from "./rooms.js";

// vision: each culture's plan, from how it really built (the one design choice per culture)
export const FORM = {
  norse: { form: "longhall", note: "one long hall, beds along both walls, the hearth down the middle" },
  european: { form: "twocell", note: "hall and chamber, beds upstairs when the household outgrows the ground floor" },
  birchbark: { form: "round", note: "a round lodge, beds round the wall, the fire in the middle" },
  pacific: { form: "platform", note: "an open platform under a deep roof, cooking in a shed apart" },
  indian_ocean: { form: "court", roof: "flat", note: "rooms round a courtyard, flat roofs to sleep on" },
  east_asian: { form: "court", roof: "pitched", note: "wings round a courtyard, the hall on its north" },
  japanese: { form: "module", note: "rooms counted in mats (a mat is a bed's size), a raised floor, a veranda" },
  dugout: { form: "longhall", note: "the north-west coast's cedar plank house: families on platforms along the walls, the fire pits down the middle" },
  shallow: { form: "stilt", note: "a house on piles over the water, a deck and a ladder down" },
  arctic: { form: "dome", note: "a snow dome, the sleeping bench at the back, the entrance sunk below the floor" },
  therans: { form: "akrotiri", note: "stone town house, storerooms below, the hall above, a light well" },
};
// vision: each culture's roundness, 0 (square-cut) to 1 (round-built): how round its houses' corners and its towns' outlines go
export const ROUNDNESS = { arctic: 1, birchbark: 0.9, dugout: 0.1, pacific: 0.5, therans: 0.45, shallow: 0.4, norse: 0.35, indian_ocean: 0.3, japanese: 0.2, east_asian: 0.15, european: 0.1 };   // vision: the builder's geometry (blocks): offsets, bays and clearances
export const DWELL = Object.freeze({
  FOLK: [2, 8],              // vision: folk a household, fewest and most
  LIT: 8,                    // given: block light at which nothing spawns
  LAMP: 15,                  // given: a lantern's (and a campfire's) light
  BED: 2,                    // given: a bed's length
  HEAT: [8, 22],             // vision: temperatures below which the hearth is indoors and above which the fire goes out to the yard
});
// Bedrock's own names where they differ from the pattern: oak's door and trapdoor are the old plain ones; the path is the grass path
const RENAME = { "minecraft:oak_door": "minecraft:wooden_door", "minecraft:oak_trapdoor": "minecraft:trapdoor", "minecraft:dirt_path": "minecraft:grass_path" };
const id = (s) => { const n = s.startsWith("minecraft:") ? s : `minecraft:${s}`; return RENAME[n] ?? n; };
const K = (x, y, z) => `${x},${y},${z}`;
const DIRS = { south: 0, west: 1, north: 2, east: 3 };   // given: Bedrock's bed and door directions

/** A Fibonacci rectangle (a <= b, consecutive or the next pair up) holding at least `area` cells, each side at least `min`. */
export function goldenRect(area, min = 3) {   // vision: the builder's geometry (blocks): offsets, bays and clearances
  for (let k = 2; k < FIB.length - 1; k++) { const a = Math.max(min, FIB[k]), b = Math.max(a, FIB[k + 1]); if (a * b >= area) return [a, b]; }
  return [FIB.at(-2), FIB.at(-1)];
}
/** A golden rectangle from a fixed short side: the long side the nearest whole number to w * phi that holds `area`. */
const longOf = (w, area) => Math.max(Math.round(w * PHI), Math.ceil(area / w));

/** What a house needs, from the people and its household. */
export function needsOf(p, n, job = null) {
  const T = p.T, fire = T < DWELL.HEAT[0] ? "hearth" : T > DWELL.HEAT[1] ? "yard" : "stove";
  const store = p.living === "fishers" ? "barrel" : "chest", stores = 1 + Math.floor(n / FIB[4]);   // vision: a store and one more for every five folk
  return { beds: n, fire, store, stores, work: job ? JOBS[job]?.at ?? null : null, clear: 2 + (T > 12 ? 1 : 0) + (T > 24 ? 1 : 0), thick: p.build.mass, why: { fire: `${T.toFixed(0)}C: ${fire}` } };   // vision: the clear height's steps
}

class Vox {
  constructor() { this.m = new Map(); }
  set(x, y, z, b, s = null, d = null) { this.m.set(K(x, y, z), { id: id(b), s, d }); }
  get(x, y, z) { return this.m.get(K(x, y, z)); }
  del(x, y, z) { this.m.delete(K(x, y, z)); }
  box(x0, y0, z0, x1, y1, z1, b) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, b); }
  air(x0, y0, z0, x1, y1, z1) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.del(x, y, z); }
}
const NO_STAIRS = /hay_block|moss_block|snow|packed_ice|dirt|mud$/;   // stuff vanilla makes no stairs of: its roofs step in whole blocks
const stairsOf = (b) => { if (NO_STAIRS.test(b)) return b; if (/brick_block$/.test(b)) return "minecraft:brick_stairs"; const n = b.replace("minecraft:", "").replace(/_planks$/, "").replace(/s$/, "").replace(/^cobblestone$/, "stone").replace(/^mud_brick$/, "mud_brick"); return `minecraft:${n}_stairs`; };
const woodOf = (p) => (p.build.frame.post.replace("stripped_", "").match(/minecraft:(\w+?)_(log|planks)/)?.[1] ?? (p.woods[0]?.replace(/^minecraft:|_log$/g, "") || "oak"));

/** The house's walls: a rectangle of interior (x0..x1, z0..z1) from y0, `h` high, `t` thick, posts at corners and every golden span. */
function shell(v, x0, z0, x1, z1, y0, h, wall, post, t = 1) {
  for (let k = 0; k < t; k++) for (let y = y0; y < y0 + h; y++) {
    for (let x = x0 - 1 - k; x <= x1 + 1 + k; x++) { v.set(x, y, z0 - 1 - k, wall); v.set(x, y, z1 + 1 + k, wall); }
    for (let z = z0 - 1 - k; z <= z1 + 1 + k; z++) { v.set(x0 - 1 - k, y, z, wall); v.set(x1 + 1 + k, y, z, wall); }
  }
  const span = FIB[5], o = t - 1;   // vision: a post at most every eight blocks
  const px = [x0 - 1 - o, ...cutsAt(x0, x1, span), x1 + 1 + o], pz = [z0 - 1 - o, ...cutsAt(z0, z1, span), z1 + 1 + o];
  for (let y = y0; y < y0 + h; y++) { for (const x of px) { v.set(x, y, z0 - 1 - o, post, { pillar_axis: "y" }); v.set(x, y, z1 + 1 + o, post, { pillar_axis: "y" }); } for (const z of pz) { v.set(x0 - 1 - o, y, z, post, { pillar_axis: "y" }); v.set(x1 + 1 + o, y, z, post, { pillar_axis: "y" }); } }
}
const cutsAt = (a, b, span) => { const out = []; for (let x = a + span; x < b; x += span) out.push(x); return out; };
/** Windows: openings in the walls at the word's positions, more of them where it's hot, at y0+1 (and +2 where tall). */
function windows(v, x0, z0, x1, z1, y0, h, p, t, frame) {
  const every = p.T > 22 ? 2 : p.T > 8 ? 3 : 5;   // vision: a window every two blocks where it's hot, three where mild, five where cold
  const open = (x, y, z) => { if (v.get(x, y, z)?.id !== id(frame.post)) v.del(x, y, z); };
  const at = (len) => { const out = []; let n = 0; for (let i = 1; i < len - 1; i++) if (word(i + n) && i % every === 0) out.push(i); return out; };
  for (let k = 0; k < t; k++) {
    for (const i of at(x1 - x0 + 1)) { open(x0 + i, y0 + 1, z0 - 1 - k); open(x0 + i, y0 + 1, z1 + 1 + k); if (h > 3) { open(x0 + i, y0 + 2, z0 - 1 - k); open(x0 + i, y0 + 2, z1 + 1 + k); } }   // vision: the builder's geometry (blocks): offsets, bays and clearances
    for (const i of at(z1 - z0 + 1)) { open(x0 - 1 - k, y0 + 1, z0 + i); open(x1 + 1 + k, y0 + 1, z0 + i); }
  }
}
/** A roof over the rectangle (outer bounds), from y: gable along the long axis (steep 1:1, pitched 1:1 too but eaves out a block), flat (a parapet of slabs), or a hip. */
function roof(v, x0, z0, x1, z1, y, pitch, cover, kind = "gable", fill = null) {
  const w = x1 - x0 + 1, l = z1 - z0 + 1, alongX = w >= l, st = stairsOf(cover);
  if (pitch === "flat") { v.box(x0, y, z0, x1, y, z1, cover); for (let x = x0; x <= x1; x++) { v.set(x, y + 1, z0, cover); v.set(x, y + 1, z1, cover); } for (let z = z0; z <= z1; z++) { v.set(x0, y + 1, z, cover); v.set(x1, y + 1, z, cover); } return y + 1; }
  const eave = pitch === "steep" ? 0 : 1, a0 = (alongX ? z0 : x0) - eave, a1 = (alongX ? z1 : x1) + eave, half = Math.floor((a1 - a0) / 2);   // the ridge runs along the long side
  const s0 = (alongX ? x0 : z0) - eave, s1 = (alongX ? x1 : z1) + eave;
  let top = y;
  for (let d = 0; d <= half; d++) {
    const yy = y + d, lo = a0 + d, hi = a1 - d;
    for (let s2 = s0; s2 <= s1; s2++) {
      for (const [c, dir] of lo === hi ? [[lo, null]] : [[lo, alongX ? 2 : 0], [hi, alongX ? 3 : 1]]) {   // given: Bedrock's stair directions (0 east, 1 west, 2 south, 3 north): each slope's stairs rise toward the ridge
        const [x, z] = alongX ? [s2, c] : [c, s2];
        if (dir === null) v.set(x, yy, z, cover); else v.set(x, yy, z, st, st === cover ? null : { weirdo_direction: dir });
      }
      if (lo + 1 <= hi - 1 && (s2 === s0 + eave || s2 === s1 - eave)) for (let c = lo + 1; c <= hi - 1; c++) { const [x, z] = alongX ? [s2, c] : [c, s2]; v.set(x, yy, z, fill ?? cover); }   // the gable ends, filled to the roof
    }
    top = yy;
  }
  return top;
}
/** A bed: head and foot, along `dir` (the way the sleeper's feet point), coloured. */
function bed(v, x, y, z, dir, colour) {
  const [dx, dz] = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[dir];
  v.set(x, y, z, "bed", { direction: DIRS[dir], head_piece_bit: true }, { colour }); v.set(x + dx, y, z + dz, "bed", { direction: DIRS[dir], head_piece_bit: false }, { colour });
}
function door(v, x, y, z, wood, facing) {
  v.set(x, y, z, `${wood}_door`, { "minecraft:cardinal_direction": facing, upper_block_bit: false }); v.set(x, y + 1, z, `${wood}_door`, { "minecraft:cardinal_direction": facing, upper_block_bit: true });
}

/** A household's house: { form, n, vox, size, fixtures (where each need was met), door, rooms, checks }. k: which house (varies the word's reading). */
export function houseOf(p, o = {}) {
  let h = null;
  for (const vary of [o.vary ?? {}, { ...(o.vary ?? {}), longer: false, store: false }, {}]) {   // a substitution that can't be met is dropped, the plainest last
    for (let grow = 0; grow < FIB[5]; grow++) { h = houseAt(p, { ...o, vary, grow }); if (h.checks.ok) return h; }   // vision: grow the plan a block at a time until every need is met
  }
  return h;
}
function houseAt(p, { n = 4, job = null, k = 0, tradition = p.tradition, dense = false, grow = 0, vary = {} } = {}) {   // vision: the builder's geometry (blocks): offsets, bays and clearances
  const N = needsOf(p, n, job), F = FORM[tradition] ?? FORM.european, v = new Vox(), fx = [], colour = dyesOf(tradition)[(k + (vary.palette ?? 0)) % dyesOf(tradition).length] ?? "white";
  if (vary.store) N.stores += 1; if (vary.longer) grow += FIB[2];   // a substitution: a store more, a golden step longer
  const f = p.build.frame, wood = woodOf(p), floor = f.kind === "timber" ? `minecraft:${wood}_planks` : f.wall, cover = p.build.roof.cover, t = N.thick, H = N.clear;
  const put = (what, x, y, z, b, s = null) => { v.set(x, y, z, b, s); fx.push({ what, x, y, z, id: id(b) }); };
  const fire = (x, y, z) => { if (N.fire === "hearth") { put("fire", x, y, z, "campfire", { extinguished: false }); return { x, z, vent: true }; } return null; };
  let door0 = null, rooms = [], form = F.form, y0 = 0, rect = null;
  // the stove or yard fire and the fixtures that go against a wall, shared by the rectangular forms
  const along = (cells, list) => { list.forEach((b, i) => { const c = cells[i]; if (c) put(b.what, c.x, c.y, c.z, b.id, b.s); }); };
  const kit = () => [N.work && { what: "work", id: N.work }, { what: "table", id: "crafting_table" }, ...Array.from({ length: N.stores }, () => ({ what: "store", id: N.store, s: N.store === "barrel" ? { facing_direction: 1 } : null })), N.fire === "stove" && { what: "fire", id: p.living === "fishers" ? "smoker" : "furnace" }].filter(Boolean);   // given: a barrel standing up
  const yardFire = (x, z) => { if (N.fire === "yard") put("fire", x, 0, z, "campfire", { extinguished: false }); };

  if (BONDS[form] && form !== "longhall") {
    const P = planOfRooms(N, form, dense ? FIB[7] : Infinity); y0 = form === "stilt" ? FIB[3] : form === "module" ? 1 : 0;   // vision: a dense plot's footprint (21 cells); derived: three blocks of piles, a block of raised floor
    const r = buildPlan(v, P, { p, N, F, form, wood, floor, cover, colour, t, H, y0, put, bedAt: (x, y, z, dir) => { bed(v, x, y, z, dir, colour); fx.push({ what: "bed", x, y, z }); }, grow });
    door0 = r.door; rooms = r.rooms; rect = [0, 0, P.size.w - 1, P.size.l - 1];
    if (N.fire === "yard") put("fire", Math.floor(P.size.w / 2), y0, P.size.l + t + FIB[3], "campfire", { extinguished: false });   // the yard fire, out front   // vision: the builder's geometry (blocks): offsets, bays and clearances
    var thePlan = P;
  } else if (form === "longhall") {
    const per = Math.ceil(n / 2), Wi = 5, Li = Math.max(longOf(Wi, 0), per * DWELL.BED + 3) + grow;   // derived: bed, aisle, hearth, aisle, bed; beds two long along each wall, the door bay and the store bay
    rect = [0, 0, Li - 1, Wi - 1]; shell(v, 0, 0, Li - 1, Wi - 1, 1, H, f.wall, f.post, t); v.box(-t, 0, -t, Li - 1 + t, 0, Wi - 1 + t, floor);   // the floor runs under the walls
    for (let i = 0; i < n; i++) { const side = i % 2, j = Math.floor(i / 2); bed(v, 2 + j * DWELL.BED, 1, side ? Wi - 1 : 0, "east", colour); fx.push({ what: "bed", x: 2 + j * DWELL.BED, y: 1, z: side ? Wi - 1 : 0 }); }
    const hearths = Math.max(1, Math.round(Li / FIB[5])); for (let h = 0; h < hearths; h++) fire(Math.round(((h + 0.5) * Li) / hearths), 1, 2);   // derived: a hearth every eight blocks of hall
    along([{ x: Li - 1, y: 1, z: 1 }, { x: Li - 1, y: 1, z: 2 }, { x: Li - 1, y: 1, z: 3 }, { x: Li - 2, y: 1, z: 2 }, { x: 0, y: 1, z: 2 }], kit());   // vision: the builder's geometry (blocks): offsets, bays and clearances
    door0 = { x: 1, y: 1, z: -1 - (t - 1), facing: "south" }; rooms = [{ name: "hall", x0: 0, z0: 0, x1: Li - 1, z1: Wi - 1 }];
    for (let k = 0; k < t - 1; k++) { v.del(1, 1, -1 - k); v.del(1, 2, -1 - k); }   // a thick wall opened through to the door
    windows(v, 0, 0, Li - 1, Wi - 1, 1, H, p, t, f); roof(v, -t, -t, Li - 1 + t, Wi - 1 + t, 1 + H, p.build.roof.pitch === "flat" ? "pitched" : p.build.roof.pitch, cover, "gable", f.wall);
    yardFire(Math.floor(Li / 2), -t - FIB[4]);   // vision: where it's hot the fire pits move out to the yard, five blocks out (the hearths above are lit only where it's cold)
  } else if (form === "twocell" || form === "stilt") {
    const up = form === "twocell" && n > 2 && !dense ? false : false, need = 6 + n * 3 + kit().length * 2, [Wi, Li] = goldenRect(form === "twocell" && n > 2 ? need / 2 + 6 : need, 3);   // vision: the hall's own six cells; a bed and its reach three, a fixture and its reach two
    const two = form === "twocell" && n > 2; y0 = form === "stilt" ? FIB[3] : 0;   // derived: three blocks of piles over the water
    rect = [0, 0, Li - 1, Wi - 1];
    if (form === "stilt") { for (const [x, z] of [[-1, -1], [Li, -1], [-1, Wi], [Li, Wi], [Math.floor(Li / 2), -1], [Math.floor(Li / 2), Wi]]) for (let y = 0; y < y0; y++) v.set(x, y, z, f.post, { pillar_axis: "y" }); v.box(-1, y0, Wi + 1, Li, y0, Wi + 2, floor); for (let x = -1; x <= Li; x++) v.set(x, y0 + 1, Wi + 2, `${wood}_fence`); for (let y = 0; y < y0; y++) v.set(-1, y, Wi + 2 + 1, "ladder", { facing_direction: 2 }); }   // a deck on the water side, a rail, a ladder down
    v.box(-t, y0, -t, Li - 1 + t, y0, Wi - 1 + t, floor);
    const cut = Math.round(Li / PHI);   // derived: the partition at the golden cut
    shell(v, 0, 0, Li - 1, Wi - 1, y0 + 1, H, f.wall, f.post, t);
    for (let z = 0; z < Wi; z++) for (let y = y0 + 1; y < y0 + 1 + H; y++) if (z !== Math.floor(Wi / 2) || y > y0 + 2) v.set(cut, y, z, f.wall);   // the partition, with a doorway
    const hall = { x0: 0, z0: 0, x1: cut - 1, z1: Wi - 1 }, chamber = { x0: cut + 1, z0: 0, x1: Li - 1, z1: Wi - 1 };
    along([{ x: 0, y: y0 + 1, z: 0 }, { x: 0, y: y0 + 1, z: Wi - 1 }, { x: 1, y: y0 + 1, z: 0 }, { x: 2, y: y0 + 1, z: 0 }, { x: 1, y: y0 + 1, z: Wi - 1 }, { x: 2, y: y0 + 1, z: Wi - 1 }], kit());
    let bedsDown = two ? 0 : n, yb = y0 + 1;
    const placeBeds = (count, yy, room) => { let i = 0; for (let z = room.z0; z <= room.z1 && i < count; z++) { for (const x of [room.x1 - 1]) { if (i >= count) break; if (z === Math.floor(Wi / 2) && room === chamber) continue; bed(v, x, yy, z, "east", colour); fx.push({ what: "bed", x, y: yy, z }); i++; } } return i; };
    let placed = placeBeds(Math.min(bedsDown, Wi - 1), yb, chamber);
    rooms = [{ name: "hall", ...hall }, { name: "chamber", ...chamber }];
    let top = y0 + 1 + H;
    if (two || placed < n) {   // an upper floor for the rest: beds along both long walls, a ladder up from the hall
      const yu = top; v.box(0, yu, 0, Li - 1, yu, Wi - 1, floor); v.del(1, yu, Math.floor(Wi / 2)); for (let y = y0 + 1; y <= yu; y++) v.set(1, y, Math.floor(Wi / 2) - 1 >= 0 ? Math.floor(Wi / 2) - 1 : 0, "ladder", { facing_direction: 3 });   // vision: the builder's geometry (blocks): offsets, bays and clearances
      shell(v, 0, 0, Li - 1, Wi - 1, yu + 1, H - 1, f.wall, f.post, t);
      for (let i = placed, x = 3, side = 0; i < n; i++, side ^= 1) { bed(v, x, yu + 1, side ? Wi - 1 : 0, "east", colour); fx.push({ what: "bed", x, y: yu + 1, z: side ? Wi - 1 : 0 }); if (side) x += DWELL.BED; }   // vision: the builder's geometry (blocks): offsets, bays and clearances
      rooms.push({ name: "loft", x0: 0, z0: 0, x1: Li - 1, z1: Wi - 1, y: yu + 1 }); top = yu + H;
    }
    windows(v, 0, 0, Li - 1, Wi - 1, y0 + 1, H, p, t, f);
    door0 = form === "stilt" ? { x: Math.floor(cut / 2), y: y0 + 1, z: Wi + t - 1 + 0, facing: "south" } : { x: Math.floor(cut / 2), y: y0 + 1, z: -t, facing: "north" };
    roof(v, -t, -t, Li - 1 + t, Wi - 1 + t, top, p.build.roof.pitch, cover);
    yardFire(Math.floor(Li / 2), -t - FIB[4]);   // vision: the yard fire five blocks out
  } else if (form === "round" || form === "dome") {
    const R = Math.max(form === "dome" ? FIB[4] - 1 : FIB[3], Math.ceil((n * 1.6 + 2) / (2 * Math.PI) + 1.5)) + grow, c = R + t, inside = (x, z) => Math.hypot(x - c, z - c) < R;   // derived: beds round the wall, each about 1.6 of the ring, and the door's two; vision: a bed's share of the ring
    const wall = form === "dome" ? "snow" : f.wall, top = form === "dome" ? R : H + 1;
    for (let x = 0; x <= 2 * c; x++) for (let z = 0; z <= 2 * c; z++) {
      const r = Math.hypot(x - c, z - c);
      if (r < R + t) v.set(x, 0, z, form === "dome" ? "snow" : floor);
      if (form === "dome") { for (let y = 1; y <= R + t; y++) { const rr = Math.hypot(r, y * 0.9); if (rr >= R - 0.5 && rr < R + t - 0.5) v.set(x, y, z, wall); } }   // vision: the dome a touch taller than round
      else if (r >= R && r < R + t) for (let y = 1; y <= H; y++) v.set(x, y, z, wall);
    }
    if (form === "round") { for (let d = 0; d <= R + t; d++) for (let x = c - (R + t - d); x <= c + (R + t - d); x++) for (let z = c - (R + t - d); z <= c + (R + t - d); z++) if (Math.hypot(x - c, z - c) <= R + t - d && Math.hypot(x - c, z - c) > R + t - d - 1.2) v.set(x, H + 1 + Math.floor(d / 1.5), z, cover); v.del(c, H + 1 + Math.floor((R + t) / 1.5), c); }   // a cone of the cover, the smoke hole at its peak   // vision: the builder's geometry (blocks): offsets, bays and clearances
    const zb = c - R + 2;   // the sleeping bench across the back, a block up, a bed's length deep
    if (form === "dome") for (let x = c - R + 1; x < c + R; x++) for (const z of [zb, zb + 1]) if (inside(x, z)) v.set(x, 1, z, "snow");
    // beds round the ring (or on the bench), the fire in the middle
    const yb = form === "dome" ? 2 : 1; let placed = 0;
    if (form === "dome") { for (let x = c - R + 1; x < c + R && placed < n; x++) { if (v.get(x, 1, zb)?.id !== id("snow") || v.get(x, 1, zb + 1)?.id !== id("snow") || v.get(x, 3, zb) || v.get(x, 3, zb + 1)) continue; bed(v, x, yb, zb, "south", colour); fx.push({ what: "bed", x, y: yb, z: zb }); placed++; } }   // vision: the builder's geometry (blocks): offsets, bays and clearances
    else for (let i = 0; i < n * 4 && placed < n; i++) {   // vision: the builder's geometry (blocks): offsets, bays and clearances
      const a = Math.PI / 2 + ((i + 1) * 2 * Math.PI) / (n + 1.5), x = Math.round(c + (R - 1.5) * Math.cos(a)), z = Math.round(c + (R - 1.5) * Math.sin(a)), dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? "west" : "east") : Math.sin(a) > 0 ? "north" : "south";   // vision: the builder's geometry (blocks): offsets, bays and clearances
      const [dx, dz] = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[dir];
      if (!inside(x, z) || !inside(x + dx, z + dz) || v.get(x, yb, z) || v.get(x + dx, yb, z + dz)) continue;
      bed(v, x, yb, z, dir, colour); fx.push({ what: "bed", x, y: yb, z }); placed++;
    }
    fire(c, 1, c) ?? null;
    if (form === "dome") { v.del(c, R + t - 1, c); v.del(c, R + t, c); }   // the vent
    const free = []; for (let x = c - R + 1; x < c + R; x++) for (let z = c - R + 1; z < c + R; z++) if (inside(x, z) && !v.get(x, 1, z) && Math.hypot(x - c, z - c) > R - 1.6 && z > c) free.push({ x, y: 1, z });   // vision: the builder's geometry (blocks): offsets, bays and clearances
    along(free.filter((q, i) => i % 2 === 0), kit());
    if (form === "dome") { for (let z = 2 * c - t; z <= 2 * c + FIB[3]; z++) { v.box(c - 1, 0, z, c + 1, 2, z, "snow"); v.set(c, 0, z, "snow"); v.del(c, 1, z); v.del(c, 2, z); if (z > 2 * c) { v.set(c, 0, z, "snow"); v.del(c, 1, z); v.set(c, -1 + 1, z, "snow"); } } door0 = { x: c, y: 1, z: 2 * c + FIB[3], facing: "south", open: true }; }   // derived: an entrance tunnel three long
    else { for (let z = c + R - 1; z <= c + R + t; z++) { v.del(c, 1, z); v.del(c, 2, z); } door0 = { x: c, y: 1, z: c + R + t - 1, facing: "south", open: true }; }   // the doorway through the wall
    rooms = [{ name: form === "dome" ? "dome" : "lodge", x0: c - R + 1, z0: c - R + 1, x1: c + R - 1, z1: c + R - 1, round: { c, R } }];
    rect = [0, 0, 2 * c, 2 * c];
    yardFire(c, 2 * c + FIB[4]);   // vision: the builder's geometry (blocks): offsets, bays and clearances
  } else if (form === "platform") {
    let need = n * 3 + kit().length * 2 + 4, [Wi, Li] = goldenRect(need, 3); Li = Math.max(Li, Math.ceil(n / 2) + 3) + grow; y0 = 1;   // a block up on posts; beds along both long edges   // vision: the builder's geometry (blocks): offsets, bays and clearances
    rect = [0, 0, Li - 1, Wi - 1];
    v.box(0, y0, 0, Li - 1, y0, Wi - 1, floor);
    for (const x of [0, ...cutsAt(0, Li - 1, FIB[3]), Li - 1]) for (const z of [0, Wi - 1]) for (let y = 0; y <= y0 + H; y++) if (y !== y0) v.set(x, y, z, f.post, { pillar_axis: "y" });   // derived: a post every three blocks round the edge, the roof on them
    let placed = 0; for (let x = 1; x < Li - 1 && placed < n; x += 1) for (const z of [1, Wi - 2]) { if (placed >= n || Wi < 4 && z !== 1) continue; if (v.get(x, y0 + 1, z) || v.get(x, y0 + 1, z + (z === 1 ? 1 : -1))) continue; bed(v, x, y0 + 1, z, z === 1 ? "south" : "north", colour); fx.push({ what: "bed", x, y: y0 + 1, z }); placed++; }   // vision: the builder's geometry (blocks): offsets, bays and clearances
    const free = []; for (let x = 1; x < Li - 1; x++) for (let z = 1; z < Wi - 1; z++) if (!v.get(x, y0 + 1, z)) free.push({ x, y: y0 + 1, z });
    along(free.filter((_, i) => i % FIB[3] === 0), kit().filter((q) => q.what !== "fire"));   // vision: the builder's geometry (blocks): offsets, bays and clearances
    roof(v, -1, -1, Li, Wi, y0 + H + 1, "steep", cover, "hip");
    door0 = { x: Math.floor(Li / 2), y: y0 + 1, z: -1, facing: "north", open: true };
    put("fire", Math.floor(Li / 2), 0, -FIB[4], "campfire", { extinguished: false });   // the cooking shed's fire, apart   // vision: the builder's geometry (blocks): offsets, bays and clearances
    rooms = [{ name: "platform", x0: 0, z0: 0, x1: Li - 1, z1: Wi - 1 }];
  } else if (form === "court") {
    const Cs = (n <= 6 ? FIB[3] : FIB[4]) + 2 * Math.floor(grow / 2), D = DWELL.BED + 1, S = Cs + 2 * (D + 1);   // derived: a court three or five across; wings a bed and its reach deep
    rect = [0, 0, S - 1, S - 1];
    v.box(0, 0, 0, S - 1, 0, S - 1, floor);
    shell(v, 0, 0, S - 1, S - 1, 1, H, f.wall, f.post, t);
    const c0 = D + 1, c1 = c0 + Cs - 1;   // the court
    for (let y = 1; y <= H; y++) for (let i = c0 - 1; i <= c1 + 1; i++) { v.set(i, y, c0 - 1, f.wall); v.set(i, y, c1 + 1, f.wall); v.set(c0 - 1, y, i, f.wall); v.set(c1 + 1, y, i, f.wall); }
    for (let y = 1; y <= 2; y++) { v.del(Math.floor(S / 2), y, c1 + 1); v.del(Math.floor(S / 2), y, c0 - 1); v.del(c0 - 1, y, Math.floor(S / 2)); v.del(c1 + 1, y, Math.floor(S / 2)); }   // a doorway from each wing to the court
    put("water", Math.floor(S / 2), 1, Math.floor(S / 2), "cauldron", { cauldron_liquid: "water", fill_level: 6 });   // given: a full cauldron
    let placed = 0;
    for (const [x, zs] of [[0, "west"], [S - DWELL.BED, "east"]]) for (let z = 0; z < S && placed < n; z++) { if (z >= c0 - 1 && z <= c1 + 1 && false) continue; if (v.get(x, 1, z) || v.get(x + 1, 1, z) || z === Math.floor(S / 2)) continue; bed(v, x, 1, z, "east", colour); fx.push({ what: "bed", x, y: 1, z }); placed++; }
    for (let x = DWELL.BED; x < S - DWELL.BED && placed < n; x++) { if (v.get(x, 1, S - 1) || v.get(x, 1, S - 2) || x === Math.floor(S / 2)) continue; bed(v, x, 1, S - 2, "south", colour); fx.push({ what: "bed", x, y: 1, z: S - 2 }); placed++; }
    const north = []; for (let x = 1; x < S - 1; x++) if (!v.get(x, 1, 0)) north.push({ x, y: 1, z: 0 });
    along(north.filter((_, i) => i % 2 === 0), kit());
    windows(v, 0, 0, S - 1, S - 1, 1, H, p, t, f);
    for (let x = c0; x <= c1; x++) for (let z = c0; z <= c1; z++) { v.del(x, 1 + H, z); }   // the court open to the sky
    if (F.roof === "flat") { v.box(-t, 1 + H, -t, S - 1 + t, 1 + H, S - 1 + t, f.wall); v.air(c0, 1 + H, c0, c1, 1 + H, c1); for (let x = -t; x <= S - 1 + t; x++) { v.set(x, 2 + H, -t, `${f.wall.replace("minecraft:", "")}`); v.set(x, 2 + H, S - 1 + t, f.wall); } }
    else { roof(v, -t, -t, S - 1 + t, c0 - 2 + 0, 1 + H, "pitched", cover); roof(v, -t, c1 + 2, S - 1 + t, S - 1 + t, 1 + H, "pitched", cover); }
    door0 = { x: Math.floor(S / 2), y: 1, z: S - 1 + t, facing: "south" };
    rooms = [{ name: "court", x0: c0, z0: c0, x1: c1, z1: c1, open: true }, { name: "wings", x0: 0, z0: 0, x1: S - 1, z1: S - 1 }];
    yardFire(Math.floor(S / 2), Math.floor(S / 2) + 1);
  } else if (form === "module") {
    const mats = n * 2 + 6, rows = n <= 3 ? FIB[3] : FIB[4], cols = Math.max(Math.ceil(mats / rows) + 2, Math.round(rows * PHI)) + grow; y0 = 1;   // derived: a mat is a bed (two cells); the living room six mats; a raised floor
    rect = [0, 0, cols - 1, rows - 1];
    for (const [x, z] of [[-1, -1], [cols, -1], [-1, rows], [cols, rows]]) v.set(x, 0, z, f.post, { pillar_axis: "y" });
    v.box(-1, y0, -1, cols, y0, rows + 1, floor);   // the floor, the veranda (engawa) a block wide on the south
    shell(v, 0, 0, cols - 1, rows - 1, y0 + 1, H, f.wall, f.post, 1);
    for (let x = 0; x < cols; x++) for (const z of [rows]) for (let y = y0 + 1; y <= y0 + 2; y++) if (x % 2 === 0) v.set(x, y, z, `${wood}_trapdoor`, { open_bit: true, direction: 2 }); else v.del(x, y, z);   // the south wall as sliding screens, half open
    const cut = Math.max(FIB[3], cols - Math.ceil(n / Math.floor(rows / 2)) - 1 - grow);   // vision: the builder's geometry (blocks): offsets, bays and clearances
    for (let z = 0; z < rows; z++) for (let y = y0 + 1; y <= y0 + 2; y++) if (z !== 1) v.set(cut, y, z, `${wood}_trapdoor`, { open_bit: false });   // a screen between living room and sleeping room
    let placed = 0; for (let x = cut + 1; x < cols && placed < n; x++) for (let z = 0; z + 1 < rows && placed < n; z += DWELL.BED) { if (z === 1 && false) continue; if (v.get(x, y0 + 1, z) || v.get(x, y0 + 1, z + 1)) continue; bed(v, x, y0 + 1, z, "south", colour); fx.push({ what: "bed", x, y: y0 + 1, z }); placed++; }
    fire(Math.floor(cut / 2), y0, Math.floor(rows / 2)) && v.del(Math.floor(cut / 2), y0 + 1, Math.floor(rows / 2));   // the irori: a fire set in the floor
    if (N.fire !== "hearth") put("fire", Math.floor(cut / 2), y0, Math.floor(rows / 2), "campfire", { extinguished: false });   // the irori is kept even where it's mild
    const wallCells = []; for (let x = 0; x < cut; x++) wallCells.push({ x, y: y0 + 1, z: 0 });
    along(wallCells.filter((_, i) => i % 2 === 0), kit().filter((q) => q.what !== "fire"));
    door0 = { x: 1, y: y0 + 1, z: rows, facing: "south", open: true };
    roof(v, -2, -2, cols + 1, rows + 2, y0 + 1 + H, p.build.roof.pitch === "flat" ? "pitched" : p.build.roof.pitch, cover, "hip");
    rooms = [{ name: "living", x0: 0, z0: 0, x1: cut - 1, z1: rows - 1 }, { name: "sleeping", x0: cut + 1, z0: 0, x1: cols - 1, z1: rows - 1 }];
  } else if (form === "compound") {
    const huts = Math.ceil(n / 2) + 1, Rr = Math.max(FIB[4], Math.ceil(huts * 1.4)) + grow, C = Rr + 4, sub = [];   // derived: a hut for every two, and a granary; vision: the ring's spacing
    v.box(0, 0, 0, 2 * C, 0, 2 * C, "grass_path");
    for (let h = 0; h < huts; h++) {
      const a = (h * 2 * Math.PI) / huts + Math.PI / 2, cx = Math.round(C + Rr * Math.cos(a)), cz = Math.round(C + Rr * Math.sin(a)), granary = h === huts - 1;
      for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) { const r = Math.hypot(x - cx, z - cz); if (r >= 1.6 && r < 2.6) for (let y = 1; y <= 2; y++) v.set(x, y, z, f.wall); if (r < 2.6) v.set(x, 3, z, cover); if (r < 1.6) v.set(x, 0, z, floor); }   // vision: a hut's round
      v.set(cx, 4, cz, cover);   // vision: the builder's geometry (blocks): offsets, bays and clearances
      const dx = Math.sign(C - cx), dz = Math.sign(C - cz), ex = Math.abs(C - cx) > Math.abs(C - cz) ? cx + 2 * dx : cx, ez = Math.abs(C - cx) > Math.abs(C - cz) ? cz : cz + 2 * dz;
      v.del(ex, 1, ez); v.del(ex, 2, ez); if (Math.abs(ex - cx) < 2 && Math.abs(ez - cz) < 2) {}
      const exd = Math.abs(C - cx) > Math.abs(C - cz) ? [Math.sign(ex - cx), 0] : [0, Math.sign(ez - cz)];
      v.del(cx + 2 * exd[0], 1, cz + 2 * exd[1]); v.del(cx + 2 * exd[0], 2, cz + 2 * exd[1]); v.del(cx + exd[0] * 1, 1, cz + exd[1] * 1);
      if (granary) { put("store", cx, 1, cz, "barrel", { facing_direction: 1 }); for (let s = 1; s < N.stores; s++) put("store", cx + (s % 2 ? 1 : -1), 1, cz, "barrel", { facing_direction: 1 }); }
      else for (let b = 0; b < 2 && sub.length < n; b++) { const bx = cx + (b ? 1 : -1) * (exd[1] !== 0 ? 1 : 0), bz = cz + (b ? 1 : -1) * (exd[0] !== 0 ? 1 : 0), dir = exd[0] !== 0 ? (exd[0] > 0 ? "west" : "east") : exd[1] > 0 ? "north" : "south"; const back = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] }[dir]; const hx = bx - back[0], hz = bz - back[1]; if (v.get(hx, 1, hz) || v.get(bx, 1, bz)) continue; bed(v, hx, 1, hz, dir, colour); fx.push({ what: "bed", x: hx, y: 1, z: hz }); sub.push(h); }
    }
    for (let x = 0; x <= 2 * C; x++) for (let z = 0; z <= 2 * C; z++) { const r = Math.hypot(x - C, z - C); if (r >= C - 0.5 && r < C + 0.5 && !(z > C && Math.abs(x - C) < 1)) v.set(x, 1, z, `${wood}_fence`); }   // the fence, its gate to the south
    put("fire", C, 1, C, "campfire", { extinguished: false });
    along([{ x: C + 1, y: 1, z: C - 1 }, { x: C - 1, y: 1, z: C - 1 }, { x: C + 1, y: 1, z: C + 1 }], kit().filter((q) => q.what !== "store" && q.what !== "fire"));
    door0 = { x: C, y: 1, z: 2 * C, facing: "south", open: true };
    rooms = [{ name: "yard", x0: 1, z0: 1, x1: 2 * C - 1, z1: 2 * C - 1, round: { c: C, R: C - 1 }, open: true }];
    rect = [0, 0, 2 * C, 2 * C];
  } else if (form === "akrotiri") {
    const storeys = dense ? FIB[3] : 2, need = n * 3 + kit().length * 2 + 4, [Wi, Li] = goldenRect(need, FIB[4]), hb = 3;   // derived: two storeys, three where the town is dense; vision: storey height
    rect = [0, 0, Li - 1, Wi - 1];
    v.box(-1, 0, -1, Li, 0, Wi, f.wall);
    const lw = { x0: Li - 3, z0: 1, x1: Li - 2, z1: 2 };   // the light well: a 2 x 2 shaft through every floor   // vision: the builder's geometry (blocks): offsets, bays and clearances
    for (let s = 0; s < storeys; s++) {
      const ys = s * (hb + 1);
      if (s > 0) { v.box(0, ys, 0, Li - 1, ys, Wi - 1, `minecraft:${wood}_planks`); v.air(lw.x0, ys, lw.z0, lw.x1, ys, lw.z1); }
      shell(v, 0, 0, Li - 1, Wi - 1, ys + 1, hb, f.wall, f.post, 1);
      if (s === 1) for (let x = 0; x < Li; x++) for (const z of [-1, Wi]) v.set(x, ys + 2, z, "red_terracotta");   // the fresco band
      windows(v, 0, 0, Li - 1, Wi - 1, ys + 1, hb, p, 1, f);
      for (let y = ys + 1; y <= ys + hb + 1 && s < storeys - 1; y++) v.set(lw.x0 - 1, y, lw.z0, "ladder", { facing_direction: 5 });   // up through the light well   // vision: the builder's geometry (blocks): offsets, bays and clearances
    }
    // below: the storerooms and the workshop; above: the hall and the beds
    const ground = []; for (let x = 0; x < lw.x0 - 1; x++) for (const z of [0, Wi - 1]) ground.push({ x, y: 1, z });
    along(ground.filter((_, i) => i % 2 === 0), [...kit().filter((q) => q.what !== "fire"), ...Array.from({ length: 2 }, () => ({ what: "store", id: "barrel", s: { facing_direction: 1 } }))]);
    const yu = hb + 2; let placed = 0;
    for (let x = 0; x < Li && placed < n; x++) for (const z of [0, Wi - 2]) { if (placed >= n || x >= lw.x0 - 1 && x <= lw.x1 + 1) continue; if (v.get(x, yu, z) || v.get(x, yu, z + 1)) continue; bed(v, x, yu, z, "south", colour); fx.push({ what: "bed", x, y: yu, z }); placed++; }
    if (N.fire !== "hearth") put("fire", 1, yu, Math.floor(Wi / 2), "smoker", { "minecraft:cardinal_direction": "east" });
    v.box(-1, storeys * (hb + 1), -1, Li, storeys * (hb + 1), Wi, f.wall); v.air(lw.x0, storeys * (hb + 1), lw.z0, lw.x1, storeys * (hb + 1), lw.z1);
    for (let x = -1; x <= Li; x++) { v.set(x, storeys * (hb + 1) + 1, -1, "mud_brick_slab"); v.set(x, storeys * (hb + 1) + 1, Wi, "mud_brick_slab"); }   // the parapet
    door0 = { x: 2, y: 1, z: Wi, facing: "south" };
    rooms = [{ name: "storerooms", x0: 0, z0: 0, x1: Li - 1, z1: Wi - 1 }, { name: "hall", x0: 0, z0: 0, x1: Li - 1, z1: Wi - 1, y: yu }];
  }
  // whatever of the kit the form couldn't place: against a wall, on the main floor, a cell apart, not by the door
  const want = kit(), have = (w) => fx.filter((q) => q.what === w).length;
  const missing = []; for (const w of ["work", "table", "store", "fire"]) { const need = want.filter((q) => q.what === w); for (let i = have(w); i < need.length; i++) missing.push(need[i]); }
  if (missing.length) {
    const yMain = Math.min(...fx.filter((q) => q.what === "bed").map((q) => q.y), y0 + 1), walls = floorCells(v).filter((c2) => c2.y === yMain && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => solid(v.get(c2.x + a, c2.y, c2.z + b))) && (!door0 || Math.abs(c2.x - door0.x) + Math.abs(c2.z - door0.z) > 2));
    const used = new Set(); for (const q of missing) { const c2 = walls.find((w) => !v.get(w.x, w.y, w.z) && ![...used].some((u) => { const [a, b] = u.split(",").map(Number); return Math.abs(a - w.x) + Math.abs(b - w.z) < 2; })); if (!c2) break; put(q.what, c2.x, c2.y, c2.z, q.id, q.s); used.add(`${c2.x},${c2.z}`); }
  }
  if (door0 && !door0.open) door(v, door0.x, door0.y, door0.z, wood, door0.facing);
  else if (door0) { v.del(door0.x, door0.y, door0.z); v.del(door0.x, door0.y + 1, door0.z); }
  // roundness: the outer corners cut, one block (or two, past the half) on every storey: a diagonal gap stays closed
  const round = ROUNDNESS[tradition] ?? 0;
  if (round >= 0.3 && rect && !["round", "dome", "compound"].includes(form)) chamfer(v, rect, t, round >= 0.6 ? 2 : 1, fx);   // vision: where a culture's corners start to round, and round twice
  if (vary.porch && door0) porch(v, door0, wood, p.build.roof.cover);   // a substitution: a porch at the door
  if (vary.mirror) mirror(v, fx, door0, rect);
  const lit = light(v, fx, door0, rooms);
  const checks = check(v, fx, door0, n, N); checks.ok = checks.bedsOk && !checks.unreached.length && Object.values(checks.has).every(Boolean);
  return { form, note: F.note, n, needs: N, vox: v.m, fixtures: fx, door: door0, rooms, lamps: lit, checks, rect, plan: typeof thePlan !== "undefined" ? thePlan : null };
}

/** Cut a house's outer corners: at each corner column the corner block goes (and with depth 2 its two neighbours, a block set in at the corner instead), every height; fixtures are never cut. */
function chamfer(v, rect, t, depth, fx) {
  const [x0, z0, x1, z1] = rect, cs = [[x0 - t, z0 - t, 1, 1], [x1 + t, z0 - t, -1, 1], [x0 - t, z1 + t, 1, -1], [x1 + t, z1 + t, -1, -1]], used = new Set(fx.map((f) => `${f.x},${f.z}`));
  let ys = []; for (const k of v.m.keys()) ys.push(Number(k.split(",")[1])); const ylo = Math.min(...ys), yhi = Math.max(...ys);
  for (const [cx, cz, dx, dz] of cs) {
    const two = depth > 1 && !used.has(`${cx + dx},${cz + dz}`) && !used.has(`${cx + 2 * dx},${cz + dz}`) && !used.has(`${cx + dx},${cz + 2 * dz}`);
    for (let y = ylo + 1; y <= yhi; y++) {
      const corner = v.get(cx, y, cz); if (!corner) continue;
      v.del(cx, y, cz);
      if (two) { const w = v.get(cx + dx, y, cz)?.id ?? corner.id; v.del(cx + dx, y, cz); v.del(cx, y, cz + dz); if (!v.get(cx + dx, y, cz + dz) || /air/.test(v.get(cx + dx, y, cz + dz).id)) v.set(cx + dx, y, cz + dz, w); }
    }
  }
}
/** A porch at the door: a slab roof on two posts, a step. */
function porch(v, d, wood, cover) {
  const out = d.facing === "south" ? [0, 1] : d.facing === "north" ? [0, -1] : d.facing === "east" ? [1, 0] : [-1, 0], [ax, az] = [out[1] !== 0 ? 1 : 0, out[0] !== 0 ? 1 : 0];
  for (const s of [-1, 1]) for (let y = d.y; y <= d.y + 2; y++) v.set(d.x + out[0] * 2 + ax * s, y, d.z + out[1] * 2 + az * s, `${wood}_fence`);
  for (let a = -1; a <= 1; a++) for (let b = 1; b <= 2; b++) v.set(d.x + out[0] * b + ax * a, d.y + 2, d.z + out[1] * b + az * a, `${wood}_slab`, { "minecraft:vertical_half": "bottom" });
  v.set(d.x + out[0], d.y - 1, d.z + out[1], `${wood}_planks`);
}
/** Mirror a house east to west (its fixtures and door with it). */
function mirror(v, fx, d, rect) {
  const [x0, , x1] = rect, flip = (x) => x0 + x1 - x, m = new Map();
  const turn = { east: "west", west: "east" };
  for (const [k, b] of v.m) { const [x, y, z] = k.split(",").map(Number); const s = b.s && b.s["minecraft:cardinal_direction"] && turn[b.s["minecraft:cardinal_direction"]] ? { ...b.s, "minecraft:cardinal_direction": turn[b.s["minecraft:cardinal_direction"]] } : b.s && typeof b.s.direction === "number" && b.id === "minecraft:bed" ? { ...b.s, direction: { 1: 3, 3: 1 }[b.s.direction] ?? b.s.direction } : b.s; m.set(`${flip(x)},${y},${z}`, { ...b, s }); }   // vision: the builder's geometry (blocks): offsets, bays and clearances
  v.m.clear(); for (const [k, b] of m) v.m.set(k, b);
  for (const f of fx) f.x = flip(f.x); if (d) d.x = flip(d.x);
}
/** Builds a rooms plan (rooms.js) as voxels: floors, walls round every atom (shared where they touch), doorways at the bonds, fixtures by kind, a ladder up the well, the roof. */
function buildPlan(v, P, c) {
  const { p, N, F, form, wood, floor, cover, t, H, y0, put, bedAt } = c, f = p.build.frame, hs = H + 1, W = P.size.w, D = P.size.l, top = y0 + P.floors.length * hs;
  const isOpen = (a) => a.kind === "court" || a.kind === "well";
  // the floors and the walls
  P.floors.forEach((row, fi) => {
    const yb = y0 + fi * hs;
    v.box(-t, yb, -t, W - 1 + t, yb, D - 1 + t, fi === 0 ? floor : `minecraft:${wood}_planks`);
    for (const a of row) {
      if (a.kind === "court") continue;
      for (let y = yb + 1; y <= yb + H; y++) for (let x = a.x0 - 1; x <= a.x1 + 1; x++) for (let z = a.z0 - 1; z <= a.z1 + 1; z++) if (x < a.x0 || x > a.x1 || z < a.z0 || z > a.z1) v.set(x, y, z, f.wall);
    }
    if (t > 1) for (let y = yb + 1; y <= yb + H; y++) { for (let x = -t; x <= W - 1 + t; x++) { v.set(x, y, -t, f.wall); v.set(x, y, D - 1 + t, f.wall); } for (let z = -t; z <= D - 1 + t; z++) { v.set(-t, y, z, f.wall); v.set(W - 1 + t, y, z, f.wall); } }
    for (const [x, z] of [[-1, -1], [W, -1], [-1, D], [W, D]]) for (let y = yb + 1; y <= yb + H; y++) v.set(x, y, z, f.post, { pillar_axis: "y" });
    windows(v, 0, 0, W - 1, D - 1, yb + 1, H, p, t, f);
  });
  // the court and the wells open to the sky; floors above open at the well
  for (const row of P.floors) for (const a of row) {
    if (a.kind === "court") for (let y = y0 + 1; y <= top + 2; y++) for (let x = a.x0; x <= a.x1; x++) for (let z = a.z0; z <= a.z1; z++) v.del(x, y, z);
    if (a.kind === "well" && (a.f ?? 0) > 0) for (let x = a.x0; x <= a.x1; x++) v.del(x, y0 + a.f * hs, a.z0);   // the shaft: the well's back row open through each floor (light and the ladder), its front row a landing
  }
  // bonds: doorways (two high) in the shared walls; star atoms open onto the court on their court side
  const doorway = (x, y, z) => { v.del(x, y, z); v.del(x, y + 1, z); };
  for (const b of P.bonds) {
    if (b.at) doorway(b.at.x, y0 + b.at.f * hs + 1, b.at.z);
    else if (b.atom) { const a = b.atom, mx = Math.floor((a.x0 + a.x1) / 2), mz = Math.floor((a.z0 + a.z1) / 2), yb = y0 + 1; ({ north: () => doorway(mx, yb, a.z1 + 1), south: () => doorway(mx, yb, a.z0 - 1), east: () => doorway(a.x0 - 1, yb, mz), west: () => doorway(a.x1 + 1, yb, mz) })[b.wing](); }
  }
  // fixtures, atom by atom
  const lamps = [], rooms = [], kit = [];
  for (const row of P.floors) for (const a of row) {
    const yb = y0 + (a.f ?? 0) * hs + 1; rooms.push({ name: a.kind, x0: a.x0, z0: a.z0, x1: a.x1, z1: a.z1, y: yb, f: a.f ?? 0 });
    if (a.kind === "sleep") {   // beds along the room's long walls, heads to the wall, an aisle between; a second row only where the room is five deep
      let k = 0; const tall = a.z1 - a.z0 > a.x1 - a.x0, deep = (tall ? a.x1 - a.x0 : a.z1 - a.z0) >= FIB[4] - 1;   // vision: the builder's geometry (blocks): offsets, bays and clearances
      const rows = tall ? [[a.x0, "east"], [a.x1, "west"]] : [[a.z0, "south"], [a.z1, "north"]];
      for (const [w, dir] of rows) { if (!deep && dir !== rows[0][1]) continue; for (let u = tall ? a.z0 : a.x0; u <= (tall ? a.z1 : a.x1) && k < a.beds; u++) { const [x, z] = tall ? [w, u] : [u, w], [dx, dz] = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[dir]; if (v.get(x, yb, z) || v.get(x + dx, yb, z + dz)) continue; bedAt(x, yb, z, dir); k++; } }
      a.placed = k;
    }
    if (a.kind === "hearth") { const cx = Math.floor((a.x0 + a.x1) / 2), cz = Math.floor((a.z0 + a.z1) / 2); if (a.indoor) { put("fire", cx, yb, cz, "campfire", { extinguished: false }); for (let y = yb + 1; y <= top + FIB[5]; y++) if (v.get(cx, y, cz) && y > yb + H - 1) v.del(cx, y, cz); } else if (N.fire === "stove") put("fire", a.x0, yb, a.z0, p.living === "fishers" ? "smoker" : "furnace", { "minecraft:cardinal_direction": "south" }); put("table", a.x1, yb, a.z0, "crafting_table"); }   // the smoke goes up through what's above it; vision: the vent's reach   // vision: the builder's geometry (blocks): offsets, bays and clearances
    if (a.kind === "work" && N.work) put("work", a.x0, yb, a.z0, N.work);
    if (a.kind === "store") for (let i = 0; i < a.stores; i++) { const x = a.x0 + 2 * i; if (x > a.x1) break; put("store", x, yb, a.z0, N.store, N.store === "barrel" ? { facing_direction: 1 } : { "minecraft:cardinal_direction": "south" }); }   // given: a barrel standing up
    if (a.kind === "well" && (a.f ?? 0) === 0) for (let y = y0 + 1; y <= y0 + (P.floors.length - 1) * hs + 1; y++) v.set(a.x0, y, a.z0, "ladder", { facing_direction: 3 });   // vision: the builder's geometry (blocks): offsets, bays and clearances
  }
  // the house's door: the entry's (or the hearth's) south wall, out to the street
  const front = P.floors[0].find((a) => a.kind === "entry") ?? P.floors[0].find((a) => a.kind === "hearth") ?? P.floors[0][0], dx = Math.floor((front.x0 + front.x1) / 2);
  const dz = front.wing === "north" ? -t : Math.max(...P.floors[0].map((a) => a.z1)) + t;
  for (let k = 1; k < t; k++) doorway(dx, y0 + 1, dz > 0 ? dz - k : dz + k);   // a thick wall opened through to the door
  const doorAt = { x: dx, y: y0 + 1, z: dz, facing: dz > 0 ? "south" : "north" };
  // culture's own touches
  if (form === "module") { for (let x = -1; x <= W; x++) v.set(x, y0, D + t, floor); for (let x = 0; x < W; x++) for (let y = y0 + 1; y <= y0 + 2; y++) if (x % 2 === 0 && x !== dx) v.set(x, y, D, `${wood}_trapdoor`, { open_bit: true, direction: 2 }); else if (x !== dx) v.del(x, y, D); for (const [x, z] of [[-1, -1], [W, -1], [-1, D + 1], [W, D + 1]]) for (let y = 0; y < y0; y++) v.set(x, y, z, f.post, { pillar_axis: "y" }); }   // the veranda and the screens, on posts
  if (form === "stilt") { for (const x of [-1, Math.floor(W / 2), W]) for (const z of [-1, D]) for (let y = 0; y < y0; y++) v.set(x, y, z, f.post, { pillar_axis: "y" }); v.box(-1, y0, D + 1, W, y0, D + 2, floor); for (let x = -1; x <= W; x++) if (x !== dx) v.set(x, y0 + 1, D + 2, `${wood}_fence`); for (let y = 0; y < y0; y++) v.set(dx, y, D + 3, "ladder", { facing_direction: 2 }); }   // piles, a deck, a rail, a ladder down   // vision: the builder's geometry (blocks): offsets, bays and clearances
  if (form === "akrotiri") for (let x = -1; x <= W; x++) for (const z of [-1, D]) if (P.floors.length > 1) v.set(x, y0 + hs + 2, z, "red_terracotta");   // the fresco band
  // the roof: flat (with a parapet) for flat roofs and stacked town houses; else the culture's pitch over the footprint, the court and wells left open
  const flat = p.build.roof.pitch === "flat" || F.roof === "flat" || form === "akrotiri";
  if (flat) { v.box(-t, top, -t, W - 1 + t, top, D - 1 + t, f.wall); for (let x = -t; x <= W - 1 + t; x++) { v.set(x, top + 1, -t, "mud_brick_slab"); v.set(x, top + 1, D - 1 + t, "mud_brick_slab"); } for (let z = -t; z <= D - 1 + t; z++) { v.set(-t, top + 1, z, "mud_brick_slab"); v.set(W - 1 + t, top + 1, z, "mud_brick_slab"); } }
  else if (P.court) { const { c0, c1 } = P.court; roof(v, -t, -t, W - 1 + t, c0 - 1, top, "pitched", cover); roof(v, -t, c1 + 1, W - 1 + t, D - 1 + t, top, "pitched", cover); roof(v, -t, c0, c0 - 1, c1, top, "pitched", cover); roof(v, c1 + 1, c0, W - 1 + t, c1, top, "pitched", cover); }
  else roof(v, -t, -t, W - 1 + t, D - 1 + t, top, p.build.roof.pitch, cover, "gable", f.wall);
  for (const row of P.floors) for (const a of row) if (isOpen(a)) for (let y = top; y <= top + FIB[5]; y++) for (let x = a.x0; x <= a.x1; x++) for (let z = a.z0; z <= (a.kind === "well" ? a.z0 : a.z1); z++) v.del(x, y, z);   // vision: clear the sky over the court and the wells' shafts
  for (const row of P.floors) for (const a of row) if (a.kind === "hearth" && a.indoor) { const cx = Math.floor((a.x0 + a.x1) / 2), cz = Math.floor((a.z0 + a.z1) / 2); for (let y = y0 + (a.f ?? 0) * hs + 2; y <= top + FIB[5]; y++) v.del(cx, y, cz); }   // the smoke hole, up through everything above the fire   // vision: the builder's geometry (blocks): offsets, bays and clearances
  return { door: doorAt, rooms };
}
/** Light every floor cell to LIT: block light spreads through air, less one a block; lanterns hung at the darkest until none is dark. */
function light(v, fx, door0, rooms) {
  const cells = floorCells(v), lamps = [], full = new Set();
  if (!cells.length) return lamps;
  const sources = () => [...fx.filter((f) => f.what === "fire" && /campfire/.test(f.id)), ...lamps].map((s) => ({ x: s.x, y: s.y, z: s.z }));
  const level = () => {   // breadth-first through air from every source, 15 less the steps
    const L = new Map(), q = []; for (const s of sources()) { L.set(K(s.x, s.y, s.z), DWELL.LAMP); q.push([s.x, s.y, s.z]); }
    for (let h = 0; h < q.length; h++) { const [x, y, z] = q[h], l = L.get(K(x, y, z)); if (l <= 1) continue; for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const k = K(x + a, y + b, z + c), B = v.get(x + a, y + b, z + c); if ((B && !passable(B.id)) || (L.get(k) ?? 0) >= l - 1) continue; if (Math.abs(x + a) > 64 || Math.abs(z + c) > 64 || y + b < -2 || y + b > 32) continue; L.set(k, l - 1); q.push([x + a, y + b, z + c]); } }   // vision: a bound on the search
    return L;
  };
  for (let g = 0; g < 64; g++) {   // vision: lanterns at most
    const L = level(), dark = cells.filter((c) => !full.has(K(c.x, c.y, c.z)) && (L.get(K(c.x, c.y, c.z)) ?? 0) < DWELL.LIT + CALIBRATION.litMargin);   // the margin: what the server's probes found the game's light short of the lab's
    if (!dark.length) break;
    const c = dark.sort((a, b) => (L.get(K(a.x, a.y, a.z)) ?? 0) - (L.get(K(b.x, b.y, b.z)) ?? 0))[Math.floor(dark.length / 2)];
    if (v.get(c.x, c.y + 1, c.z)) { full.add(K(c.x, c.y, c.z)); continue; }   // a doorway (the door's top half over it) has no room to hang a lantern: light it from the next darkest
    let y = c.y + 1; while (y < c.y + 6 && !v.get(c.x, y + 1, c.z)) y++;   // vision: hang it from the ceiling (or six up, if there's none)
    v.set(c.x, y, c.z, "lantern", { hanging: !!v.get(c.x, y + 1, c.z) }); lamps.push({ x: c.x, y, z: c.z });
  }
  return lamps;
}
const passable = (b) => /air|door|trapdoor|carpet|ladder|lantern|torch|fence_gate|campfire|bed/.test(b) && !/fence$/.test(b);
const solid = (B) => B && !passable(B.id);
/** Floor cells: inside the walls, two clear above a solid floor (walkable), found from the door. */
function floorCells(v) {
  const out = [], seen = new Set();
  for (const [k, B] of v.m) {
    if (!solid(B)) continue; const [x, y, z] = k.split(",").map(Number);
    const a = v.get(x, y + 1, z), b = v.get(x, y + 2, z);
    if (solid(a) || solid(b)) continue;
    let roofed = false; for (let yy = y + 3; yy < y + 12; yy++) if (v.get(x, yy, z)) { roofed = true; break; }   // vision: a roof within reach overhead makes it indoors
    if (!roofed) continue;
    const key = K(x, y + 1, z); if (seen.has(key)) continue; seen.add(key); out.push({ x, y: y + 1, z });
  }
  return out;
}
/** The house's checks: beds, reach from the door, light. */
function check(v, fx, door0, n, N) {
  const beds = fx.filter((f) => f.what === "bed").length, cells = floorCells(v), walk = new Set(cells.map((c) => K(c.x, c.y, c.z)));
  // walkable outside the walls too, for the door's reach: the door cell and the cells either side of it
  const start = door0 ? [door0.x, door0.y, door0.z] : null, reach = new Set();
  if (start) { const q = [start]; reach.add(K(...start)); const ok = (x, y, z) => { const B = v.get(x, y, z), C = v.get(x, y + 1, z), F = v.get(x, y - 1, z); return !solid(B) && !solid(C) && solid(F); };
    for (let h = 0; h < q.length; h++) { const [x, y, z] = q[h]; for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1], [1, -1, 0], [-1, -1, 0], [0, -1, 1], [0, -1, -1], [0, 1, 0], [0, -1, 0]]) { const X = x + a, Y = y + b, Z = z + c, k = K(X, Y, Z); if (reach.has(k) || Math.abs(X) > 64 || Math.abs(Z) > 64 || Y < -3 || Y > 24) continue; const ladder = /ladder/.test(v.get(X, Y, Z)?.id ?? "") || /ladder/.test(v.get(x, y, z)?.id ?? ""); if (!(ok(X, Y, Z) || (ladder && !solid(v.get(X, Y, Z)) && !solid(v.get(X, Y + 1, Z))))) continue; if (b !== 0 && a === 0 && c === 0 && !ladder) continue; reach.add(k); q.push([X, Y, Z]); } } }   // vision: a bound on the search
  const reachable = (f) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => reach.has(K(f.x + a, f.y, f.z + c)) || reach.has(K(f.x + a, f.y + 1, f.z + c)) || reach.has(K(f.x + a, f.y - 1, f.z + c)));
  const unreached = fx.filter((f) => f.what !== "fire" || /campfire/.test(f.id) ? !reachable(f) && f.what !== "fire" : !reachable(f));
  return { beds, bedsOk: beds === n, cells: cells.length, reached: fx.length - unreached.length, of: fx.length, unreached: unreached.map((f) => f.what), has: { work: !N.work || fx.some((f) => f.what === "work"), store: fx.some((f) => f.what === "store"), fire: fx.some((f) => f.what === "fire"), table: fx.some((f) => f.what === "table") } };
}
export { TRADITIONS };
