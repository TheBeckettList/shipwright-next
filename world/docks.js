// Pure. Each people's waterfront: its boats, its quay or beach, its piers, its sheds, its slipway with a hull on
// the stocks, its cranes and racks and warehouses, the way it really met the sea.
//   boats    a hull is half an ellipsoid, length L, beam B, depth D (golden: B = L / phi^2, D = B / phi), cut at
//            the deck, the sheer rising to bow and stern as a parabola, its stem and sternposts, its rig
//   scenes   the land at y 0, the water to y -1 (three deep), the shore along z = 0, the sea to the south
import { FIB, PHI } from "../core/golden.js";
import { buildingOf } from "./building.js";
import { dome, vault, sample } from "./quadric.js";
import { dyesOf } from "./looks.js";

const Y = (id) => (/_log$|_stem$|quartz_pillar/.test(id) ? { pillar_axis: "y" } : null);
function canvas() { const vox = new Map(), put = (x, y, z, id, s = null) => vox.set(`${x},${y},${z}`, { id, s }), has = (x, y, z) => vox.has(`${x},${y},${z}`); return { vox, put, has }; }
const blit = (c, v, ox, oy, oz) => { for (const [k, b] of v) { const [x, y, z] = k.split(",").map(Number); c.put(x + ox, y + oy, z + oz, b.id, b.s); } };

// ---- boats
// vision: each people's boat: its length, its hull's stuff, its rig (sail colour from its dyes), its stem's ornament
export const BOATS = {
  norse: { name: "longship", L: FIB[7] + 4, hull: "minecraft:spruce_planks", rig: "square", sheer: 3, stem: "curl", oars: true },   // vision: the waterfront's own proportions and counts
  european: { name: "cog", L: FIB[7], hull: "minecraft:dark_oak_planks", rig: "square", sheer: 2, castles: true },   // vision: the waterfront's own proportions and counts
  therans: { name: "galley", L: FIB[7] + 2, hull: "minecraft:birch_planks", rig: "square", sheer: 2, stem: "ram", oars: true, stripe: "minecraft:light_blue_concrete" },   // vision: the waterfront's own proportions and counts
  indian_ocean: { name: "dhow", L: FIB[7] - 3, hull: "minecraft:jungle_planks", rig: "lateen", sheer: 2, stem: "raked" },   // vision: the waterfront's own proportions and counts
  east_asian: { name: "junk", L: FIB[7] - 2, hull: "minecraft:spruce_planks", rig: "battened", sheer: 2, castles: true, transom: true },   // vision: the waterfront's own proportions and counts
  japanese: { name: "bune", L: FIB[6], hull: "minecraft:birch_planks", rig: "square", sheer: 2, transom: true },   // vision: the waterfront's own proportions and counts
  pacific: { name: "outrigger canoe", L: FIB[6], hull: "minecraft:jungle_planks", rig: "crab", sheer: 1, outrigger: true },   // vision: the waterfront's own proportions and counts
  dugout: { name: "great canoe", L: FIB[6] + 3, hull: "minecraft:spruce_log", rig: null, sheer: 2, stem: "prow" },   // vision: the waterfront's own proportions and counts
  shallow: { name: "raft-boat", L: FIB[5] + 3, hull: "minecraft:bamboo_planks", rig: "crab", sheer: 0, flat: true },   // vision: the waterfront's own proportions and counts
  arctic: { name: "umiak", L: FIB[6] - 3, hull: "minecraft:light_gray_wool", rig: null, sheer: 1 },   // vision: the waterfront's own proportions and counts
  birchbark: { name: "bark canoe", L: FIB[5] + 2, hull: "minecraft:birch_planks", rig: null, sheer: 2, stem: "curl" },   // vision: the waterfront's own proportions and counts
};
/** A boat of a people's kind, along +x, its keel at y 0. Returns a vox map. */
export function boatOf(t, scale = 1) {
  const S = BOATS[t] ?? BOATS.european, L = Math.round(S.L * scale), B = Math.max(3, Math.round(L / PHI ** 2)), D = Math.max(2, Math.round(B / PHI)), c = canvas();   // vision: the waterfront's own proportions and counts
  const sail = t === "therans" ? "minecraft:white_wool" : `minecraft:${dyesOf(t).find((d) => d !== "black") ?? "white"}_wool`;   // Thera's sails white (its blue in the hull's stripe)
  const deck = (x) => D + Math.round(S.sheer * ((2 * x) / (L - 1) - 1) ** 2);   // the sheer: a parabola up to bow and stern
  for (let x = 0; x < L; x++) {
    const u = (2 * x) / (L - 1) - 1, half = S.flat ? B / 2 : (B / 2) * Math.sqrt(Math.max(0, 1 - u ** 4));   // the waterline's curve: full amidships, fine at the ends (a quartic ellipse; a raft square)   // vision: the waterfront's own proportions and counts
    for (let z = -Math.ceil(B / 2); z <= Math.ceil(B / 2); z++) {
      if (Math.abs(z) > half + 0.3) continue;   // vision: the waterfront's own proportions and counts
      const depth = S.flat ? 1 : Math.max(1, Math.round(D * Math.sqrt(Math.max(0, 1 - (z / (half + 0.5)) ** 2)) * Math.sqrt(Math.max(0, 1 - u * u * 0.6))));   // the hull's section: an ellipse below the deck   // vision: the waterfront's own proportions and counts
      const top = deck(x);
      for (let y = top - depth; y <= top; y++) { const side = Math.abs(z) >= half - 0.7 || y === top - depth; if (side || y === top - depth) c.put(x, y, z, S.hull, S.hull.endsWith("_log") ? { pillar_axis: "x" } : null); }   // vision: the waterfront's own proportions and counts
      if (Math.abs(z) < half - 0.7) c.put(x, top - depth + 1, z, "minecraft:spruce_slab");   // the deck boards inside   // vision: the waterfront's own proportions and counts
      if (S.stripe && Math.abs(z) >= half - 0.7) c.put(x, top, z, S.stripe);   // vision: the waterfront's own proportions and counts
    }
  }
  const mid = Math.floor(L / 2), top0 = deck(0);
  // stem and sternpost
  if (S.stem === "curl") { for (let k = 1; k <= 3; k++) c.put(-1 + (k === 3 ? 1 : 0), top0 + k, 0, S.hull); c.put(L, deck(L - 1) + 2, 0, S.hull); c.put(L, deck(L - 1) + 3, 0, S.hull); }   // vision: the waterfront's own proportions and counts
  if (S.stem === "ram") { c.put(L, deck(L - 1) - D + 1, 0, "minecraft:gold_block"); c.put(L + 1, deck(L - 1) - D + 1, 0, "minecraft:gold_block"); c.put(-1, top0 + 1, 0, S.hull); }
  if (S.stem === "raked") { for (let k = 0; k < 3; k++) c.put(L + k, deck(L - 1) + k, 0, S.hull); }   // vision: the waterfront's own proportions and counts
  if (S.stem === "prow") { for (let k = 0; k < 3; k++) c.put(L + k, deck(L - 1) + 1 + k, 0, S.hull); c.put(-1, top0 + 1, 0, S.hull); }   // vision: the waterfront's own proportions and counts
  if (S.transom) for (let z = -1; z <= 1; z++) for (let y = top0; y <= top0 + 2; y++) c.put(-1, y, z, S.hull);
  if (S.castles) for (const x0 of [0, L - 4]) for (let x = x0; x < x0 + 4; x++) for (let z = -1; z <= 1; z++) { c.put(x, deck(x) + 1, z, "minecraft:spruce_slab"); if (Math.abs(z) === 1) c.put(x, deck(x) + 2, z, "minecraft:spruce_fence"); }   // vision: the waterfront's own proportions and counts
  if (S.oars) for (let x = 3; x < L - 3; x += 2) for (const z of [-Math.ceil(B / 2) - 1, Math.ceil(B / 2) + 1]) c.put(x, deck(x) - 1, z, "minecraft:spruce_fence");   // vision: the waterfront's own proportions and counts
  if (S.outrigger) { for (let x = 2; x < L - 2; x++) c.put(x, 0, B + 2, "minecraft:jungle_log", { pillar_axis: "x" }); for (const x of [4, L - 5]) for (let z = 1; z <= B + 2; z++) c.put(x, deck(x) + 1, z, "minecraft:bamboo_fence"); }   // vision: the waterfront's own proportions and counts
  // the rig: a mast, and the sail by the people's kind
  if (S.rig) {
    const mh = Math.round(L / PHI);   // the mast: the length over phi
    for (let y = deck(mid) + 1; y <= deck(mid) + mh; y++) c.put(mid, y, 0, "minecraft:spruce_fence");
    const sy = deck(mid) + 2, w = Math.max(2, Math.floor(B / 2) + 1);
    if (S.rig === "square") for (let y = sy + 1; y <= sy + mh - 3; y++) for (let z = -w; z <= w; z++) c.put(mid + 1, y, z, sail);   // vision: the waterfront's own proportions and counts
    if (S.rig === "lateen") for (let k = 0; k < mh; k++) for (let y = sy; y <= sy + k; y++) c.put(mid - Math.floor(mh / 2) + k, y + Math.floor(k / 2), 0, "minecraft:white_wool");   // the triangle, its yard raked
    if (S.rig === "battened") for (let y = sy + 1; y <= sy + mh - 2; y++) for (let z = -w; z <= w; z++) c.put(mid + 1, y, z, (y - sy) % 3 === 0 ? "minecraft:spruce_planks" : "minecraft:red_wool");   // the battens across the red sail   // vision: the waterfront's own proportions and counts
    if (S.rig === "crab") for (let k = 0; k < mh - 1; k++) for (let z = -Math.floor(k / 2); z <= Math.floor(k / 2); z++) c.put(mid + 1, sy + mh - 1 - k, z, "minecraft:white_wool");   // the crab claw: wide at the top
    if (S.rig === "square") c.put(mid, deck(mid) + mh + 1, 0, t === "therans" ? "minecraft:gold_block" : "minecraft:lantern", t === "therans" ? null : { hanging: false });
  }
  return c.vox;
}

// ---- the waterfront's pieces
const water = (c, x0, x1, z0, z1, floor = "minecraft:sand") => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { c.put(x, -3, z, floor); for (let y = -2; y <= 0; y++) c.put(x, y, z, "minecraft:water"); } };   // vision: the waterfront's own proportions and counts
const land = (c, x0, x1, z0, z1, top) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { for (let y = -3; y < 0; y++) c.put(x, y, z, "minecraft:dirt"); c.put(x, 0, z, top); } };   // vision: the waterfront's own proportions and counts
const quay = (c, x0, x1, z, face, cap, bollard, every = FIB[4]) => { for (let x = x0; x <= x1; x++) { for (let y = -3; y <= 0; y++) c.put(x, y, z, face); c.put(x, 1, z, cap); if ((x - x0) % every === 2) c.put(x, 2, z, bollard); } };   // the quay's face from the floor, its cap, a bollard every five   // vision: the waterfront's own proportions and counts
const pier = (c, x, z0, len, w, deck, pile, rail = null) => { for (let z = z0; z < z0 + len; z++) for (let a = 0; a < w; a++) { c.put(x + a, 1, z, deck); if ((z - z0) % FIB[3] === 0 && (a === 0 || a === w - 1)) for (let y = -3; y <= 0; y++) c.put(x + a, y, z, pile, Y(pile)); if (rail && (a === 0 || a === w - 1) && (z - z0) % 2 === 0) c.put(x + a, 2, z, rail); } };   // piles every three   // vision: the waterfront's own proportions and counts
const slip = (c, x0, z0, len, w, plank) => { for (let z = z0; z < z0 + len; z++) { const y = Math.round(1 - (z - z0) * (4 / len)); for (let x = x0; x < x0 + w; x++) { c.put(x, y, z, plank); for (let yy = y - 1; yy >= -3; yy--) if (!c.has(x, yy, z)) c.put(x, yy, z, "minecraft:dirt"); } } };   // the slipway: a ramp of planks into the water   // vision: the waterfront's own proportions and counts
const ribs = (c, x0, z0, L, B, wood) => { for (let k = 0; k < L; k += 2) { const u = (2 * k) / (L - 1) - 1, half = Math.max(1, Math.round((B / 2) * Math.sqrt(Math.max(0, 1 - u ** 4)))); for (let z = -half; z <= half; z++) { const y = 2 + Math.round(B / PHI * (1 - Math.sqrt(Math.max(0, 1 - (z / (half + 0.5)) ** 2)))); c.put(x0 + k, y, z0 + z, wood); } } for (let k = -1; k <= L; k++) c.put(x0 + k, 2, z0, "minecraft:spruce_log", { pillar_axis: "x" }); };   // a hull on the stocks: its keel and ribs, golden   // vision: the waterfront's own proportions and counts
const racks = (c, x0, z0, n, post, net = "minecraft:web") => { for (let k = 0; k < n; k++) { const x = x0 + k * 3; for (let y = 1; y <= 3; y++) { c.put(x, y, z0, post); c.put(x, y, z0 + 4, post); } for (let z = z0 + 1; z <= z0 + 3; z++) { c.put(x, 3, z, post); c.put(x, 2, z, net); } } };   // the drying racks, nets hung   // vision: the waterfront's own proportions and counts
const crane = (c, x, z, wood) => { for (let y = 1; y <= FIB[5]; y++) for (const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2]]) c.put(x + a, y, z + b, wood, Y(wood)); for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) c.put(x + a, FIB[5] + 1, z + b, "minecraft:spruce_planks"); for (let k = 1; k <= FIB[4] + 1; k++) c.put(x + 1, FIB[5] + 1, z + 2 + k, "minecraft:spruce_fence"); for (let y = 2; y <= FIB[5]; y++) c.put(x + 1, y, z + FIB[4] + 3, "minecraft:iron_chain"); };   // the treadwheel crane: its frame, its jib, its chain   // vision: the waterfront's own proportions and counts
const shed = (c, x0, z0, w, l, wall, roof, open = true, posts = null) => { for (let x = x0 - 1; x <= x0 + w; x++) for (let z = z0; z <= z0 + l; z++) { const edge = x < x0 || x >= x0 + w || z === z0; if (edge && !(open && z === z0 + l)) for (let y = 1; y <= 4; y++) c.put(x, y, z, posts && (x === x0 - 1 || x === x0 + w) && (z - z0) % 3 === 0 ? posts : wall, posts && (z - z0) % 3 === 0 ? Y(posts) : null); } const F = vault(x0 - 1, z0, w + 2, l + 1, 5); for (const [x, y, z, k] of sample(F, { box: [x0 - 2, 5, z0, x0 + w + 1, 5 + w, z0 + l] })) c.put(x, y, z, k === "slab" ? roof.replace(/_planks|_tiles|_bricks$/, (m) => (m === "_planks" ? "_slab" : m === "_tiles" ? "_tile_slab" : "_brick_slab")) : roof); };   // a boat shed: walled on three sides, open to the water, its vault for a roof   // vision: the waterfront's own proportions and counts

// ---- the scenes, a people each: what its waterfront has, from its own ways
function scene(t) {
  const c = canvas(), Wd = FIB[8] + 6, shore = 0, landD = FIB[7], seaD = FIB[7] + 4;   // vision: a waterfront forty wide, twenty-one of land, twenty-five of sea
  const hard = { european: "minecraft:stone_bricks", therans: "minecraft:smooth_quartz", indian_ocean: "minecraft:smooth_sandstone", east_asian: "minecraft:polished_andesite", japanese: "minecraft:stone_bricks" }[t];
  land(c, 0, Wd, -landD, shore - 1, hard ? "minecraft:cobblestone" : t === "arctic" ? "minecraft:snow" : t === "pacific" || t === "shallow" ? "minecraft:sand" : "minecraft:grass_block");
  water(c, 0, Wd, shore, seaD, t === "arctic" ? "minecraft:gravel" : "minecraft:sand");
  const notes = [], boat = (x, z, y = 0, scale = 1) => blit(c, boatOf(t, scale), x, y, z);
  if (hard) {   // a stone (or white) quay with bollards, the stair down to the water
    quay(c, 0, Wd, shore, hard, t === "therans" ? "minecraft:smooth_quartz_slab" : hard === "minecraft:stone_bricks" ? "minecraft:stone_brick_slab" : "minecraft:smooth_stone_slab", t === "therans" ? "minecraft:gold_block" : "minecraft:polished_blackstone_wall");
    for (let x = 0; x <= Wd; x++) for (let z = -landD; z < shore; z++) c.put(x, 0, z, t === "therans" ? "minecraft:calcite" : hard);
    for (let k = 0; k < 3; k++) c.put(Wd - 4 - k, 1 - k, shore + 1 + k, `${hard === "minecraft:smooth_quartz" ? "minecraft:smooth_quartz_stairs" : hard === "minecraft:stone_bricks" ? "minecraft:stone_brick_stairs" : hard === "minecraft:smooth_sandstone" ? "minecraft:smooth_sandstone_stairs" : "minecraft:polished_andesite_stairs"}`, { weirdo_direction: 3, upside_down_bit: false });   // vision: the waterfront's own proportions and counts
    notes.push("a stone quay, bollards, its stair to the water");
  } else notes.push("the beach");
  if (t === "european") {
    pier(c, 6, shore + 1, FIB[6], 3, "minecraft:oak_planks", "minecraft:oak_log", "minecraft:oak_fence"); boat(10, shore + 9, -1); crane(c, 16, shore - 3, "minecraft:spruce_log");   // vision: the waterfront's own proportions and counts
    slip(c, 24, shore - 6, FIB[6], 7, "minecraft:spruce_planks"); ribs(c, 25, shore - 3, FIB[6] - 2, 5, "minecraft:dark_oak_fence");   // vision: the waterfront's own proportions and counts
    blit(c, buildingOf(["Si", "C", "F"], t, { seed: 3 }).vox, 2, 1, -landD + 1); notes.push("a timber pier, the cog moored, a treadwheel crane, a hull on the slip, the gabled warehouse");   // vision: the waterfront's own proportions and counts
  }
  if (t === "therans") {   // the shipsheds: narrow vaulted sheds side by side, each on its own ramp down into the water
    for (let k = 0; k < 4; k++) { const x0 = 2 + k * 7; slip(c, x0, shore - 8, 12, 5, "minecraft:smooth_quartz"); shed(c, x0, shore - 9, 5, 9, "minecraft:white_concrete", "minecraft:light_blue_concrete", true, "minecraft:quartz_pillar"); }   // vision: the waterfront's own proportions and counts
    boat(30, shore + 8, -1); blit(c, buildingOf(["Ne"], t).vox, 32, 1, -landD + 2);   // vision: the waterfront's own proportions and counts
    notes.push("the shipsheds: four vaulted sheds on their ramps, white and blue, a galley at the quay, the harbour shrine");
  }
  if (t === "indian_ocean") { for (let k = 0; k < 2; k++) boat(4 + k * 16, shore - 4, 0, 1); boat(22, shore + 10, -1); blit(c, buildingOf(["Si", "C", "F"], t, { seed: 5 }).vox, 4, 1, -landD + 1); const lx = Wd - 3; for (let y = 1; y <= FIB[6]; y++) c.put(lx, y, -3, "minecraft:smooth_sandstone"); c.put(lx, FIB[6] + 1, -3, "minecraft:lantern", { hanging: false }); notes.push("dhows hauled up on the hard, one at anchor, the coral-stone warehouse, a lantern tower"); }   // vision: the waterfront's own proportions and counts
  if (t === "east_asian") { pier(c, 4, shore + 1, FIB[5], 5, "minecraft:polished_andesite", "minecraft:stone_bricks"); boat(12, shore + 8, -1); slip(c, 26, shore - 7, FIB[6], 7, "minecraft:spruce_planks"); ribs(c, 27, shore - 4, FIB[6] - 3, 5, "minecraft:crimson_fence"); blit(c, buildingOf(["Si", "C", "F"], t, { seed: 7 }).vox, 2, 1, -landD + 1); notes.push("a stone jetty, the junk moored, a hull on the slip, the warehouse"); }   // vision: the waterfront's own proportions and counts
  if (t === "japanese") {   // funaya: boathouses on the water's edge, the boat below and the house above
    for (let k = 0; k < 3; k++) { const x0 = 2 + k * 11; for (let x = x0; x < x0 + 8; x++) for (let z = shore - 6; z <= shore + 2; z++) { const edge = x === x0 || x === x0 + 7 || z === shore - 6; if (edge && z <= shore + 2) for (let y = -2; y <= 1; y++) c.put(x, y, z, "minecraft:spruce_log", Y("minecraft:spruce_log")); c.put(x, 2, z, "minecraft:spruce_planks"); } blit(c, buildingOf(["C", "O"], t, { seed: k }).vox, x0, 2, shore - 6); boat(x0 + 1, shore - 3, -1, 0.5); }   // vision: the waterfront's own proportions and counts
    notes.push("funaya: boathouses on the water, the boat below, the house above");
  }
  if (t === "norse") { pier(c, 4, shore + 1, FIB[6], 2, "minecraft:spruce_planks", "minecraft:spruce_log"); boat(8, shore + 6, -1); for (let k = 0; k < 2; k++) { const x0 = 20 + k * 10; shed(c, x0, shore - 10, 6, 11, "minecraft:spruce_planks", "minecraft:moss_block", true, "minecraft:spruce_log"); boat(x0 + 1, shore - 6, 1, 0.5); } racks(c, 2, -landD + 2, 4, "minecraft:spruce_fence"); notes.push("a timber jetty, the longship moored, turf-roofed nausts with their boats, the fish racks"); }   // vision: the waterfront's own proportions and counts
  if (t === "pacific") { for (let k = 0; k < 2; k++) { const x0 = 4 + k * 14; const F = dome(x0, -10, 12, 7, 4, 0.7); for (const [x, y, z] of sample(F, { box: [x0 - 1, 4, -11, x0 + 13, 12, -2] })) c.put(x, y, z, "minecraft:hay_block"); for (const [a, b] of [[0, 0], [11, 0], [0, 6], [11, 6], [5, 0], [5, 6]]) for (let y = 1; y <= 3; y++) c.put(x0 + a, y, -10 + b, "minecraft:jungle_log", Y("minecraft:jungle_log")); boat(x0, -8, 1, 0.8); } boat(30, shore + 6, -1); notes.push("canoe houses on the beach, thatched to the ground, outriggers drawn up, one afloat"); }   // vision: the waterfront's own proportions and counts
  if (t === "shallow") { for (let x = 0; x <= Wd; x++) for (let z = shore + 1; z <= shore + 3; z++) { c.put(x, 2, z, "minecraft:bamboo_planks"); if (x % 3 === 0 && z === shore + 2) for (let y = -3; y <= 1; y++) c.put(x, y, z, "minecraft:mangrove_log", Y("minecraft:mangrove_log")); } for (let k = 0; k < 3; k++) boat(3 + k * 12, shore + 7, -1); racks(c, 4, -8, 5, "minecraft:bamboo_fence"); notes.push("a boardwalk over the water on mangrove posts, rafts moored along it, the net racks"); }   // vision: the waterfront's own proportions and counts
  if (t === "dugout") { for (let k = 0; k < 3; k++) boat(3 + k * 13, shore - 4, 0); racks(c, 6, -landD + 3, 6, "minecraft:spruce_fence", "minecraft:red_carpet"); for (let y = 1; y <= FIB[6]; y++) c.put(Wd - 2, y, -6, "minecraft:spruce_log", Y("minecraft:spruce_log")); notes.push("the great canoes drawn up on the beach, the salmon racks, a tall pole"); }   // vision: the waterfront's own proportions and counts
  if (t === "arctic") { for (let k = 0; k < 4; k++) { const x0 = 3 + k * 9; for (let y = 1; y <= 2; y++) { c.put(x0, y, -6, "minecraft:spruce_fence"); c.put(x0 + 6, y, -6, "minecraft:spruce_fence"); } blit(c, boatOf(t, 0.6), x0, 3, -6); } for (let x = 0; x <= Wd; x++) for (let z = shore; z <= shore + 4; z++) c.put(x, 0, z, (x + z) % 3 ? "minecraft:ice" : "minecraft:packed_ice"); boat(14, shore + 10, -1); notes.push("kayaks and umiaks on their racks out of the dogs' reach, the ice edge, an umiak in the lead"); }   // vision: the waterfront's own proportions and counts
  if (t === "birchbark") { for (let k = 0; k < 3; k++) { const x0 = 3 + k * 12; for (let y = 1; y <= 2; y++) { c.put(x0, y, -5, "minecraft:birch_fence"); c.put(x0 + 8, y, -5, "minecraft:birch_fence"); } const v = boatOf(t), flip = new Map(); for (const [k2, b] of v) { const [x, y, z] = k2.split(",").map(Number); flip.set(`${x},${6 - y},${z}`, b); } blit(c, flip, x0, -1, -5); } boat(16, shore + 6, -1); pier(c, 30, shore + 1, FIB[5], 2, "minecraft:birch_planks", "minecraft:birch_log"); notes.push("bark canoes turned over on their racks, one afloat, a short landing stage"); }   // vision: the waterfront's own proportions and counts
  return { vox: c.vox, note: notes.join("; "), boat: BOATS[t]?.name };
}
export const docksOf = scene;
