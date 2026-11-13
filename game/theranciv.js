// The Therans' summit buildings as voxels (claude/thera-redesign.md; sizes from tools/theramath.mjs's least, each a
// Fibonacci number). Pure. Each returns a Map "x,y,z" -> { id, s } with its floor at y 0 and its footprint centred.
//   the great temple      the Sea Rite Temple: a peripteral temple, three steps, a ring of columns, the architrave,
//                         a stepped pediment roof, the rite's sacred pool in its cella; its finials are gold (one of
//                         Thera's three gold points)
//   the government seat   a courtyard house of state round an open court, two storeys, a blue dome over its hall,
//                         its doors framed in gold (the second gold point)
//   the navigation house  a hall with an observatory tower, its dome blue glass (the charts and the globe within)
//   the library           three reading terraces stepping back, a colonnade on the front of each
import { FIB, PHI } from "../core/golden.js";
const W = "minecraft:white_concrete", Q = "minecraft:smooth_quartz", QB = "minecraft:quartz_block", P = "minecraft:quartz_pillar", CA = "waterworld:theran_marble_polished";
const BLUE = "minecraft:blue_concrete", GLASS = "minecraft:light_blue_stained_glass", GOLD = "minecraft:gold_block", LAMP = "minecraft:sea_lantern", FLOOR = "waterworld:theran_marble_tile";
const put = (m, x, y, z, id, s = null) => m.set(`${x},${y},${z}`, { id, s });
const box = (m, x0, y0, z0, x1, y1, z1, id, s = null) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(m, x, y, z, id, s); };
const shell = (m, x0, y0, z0, x1, y1, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) put(m, x, y, z, id); };
/** A column: a chiselled base, a fluted shaft (quartz pillar), a chiselled capital. */
/** A column of the pack's marble (world/carvings.js): its base, its fluted shaft, its capital of the order asked;
 *  "minoan" is Thera's own, the red shaft wider at the top and the black cushion capital, on a white base. */
const WW = (m, part) => `waterworld:${m}_marble_${part}`, WWB = (part, a, b) => `waterworld:theran_marble_big_${part}_${a}${b}`;   // the great column's quarter at step (a, b) from its north-west block
const column = (m, x, y0, z, h, order = "ionic", marble = "theran") => {
  if (order === "minoan") { put(m, x, y0, z, WW("theran", "column_base")); for (let y = y0 + 1; y < y0 + h - 1; y++) put(m, x, y, z, "waterworld:minoan_column"); put(m, x, y0 + h - 1, z, "waterworld:minoan_capital"); return; }
  put(m, x, y0, z, WW(marble, "column_base")); for (let y = y0 + 1; y < y0 + h - 1; y++) put(m, x, y, z, WW(marble, "column")); put(m, x, y0 + h - 1, z, WW(marble, `capital_${order}`)); };
/** A carved frieze block of the faith's figures, turning through them along a run (k its place in the run). */
const STAINED = ["spiral", "rosette", "truchet", "quarry", "wave", "key"].map((k) => `waterworld:stained_${k}`);   // the faith's glass
const CARVED = ["spiral", "wave", "rosette", "key", "truchet", "breath"], carved = (k, marble = "theran", kinds = CARVED) => WW(marble, kinds[((k % kinds.length) + kinds.length) % kinds.length]);
const MB = "waterworld:theran_marble_block", MASH = "waterworld:theran_marble_ashlar", MPOL = "waterworld:theran_marble_polished", MTILE = "waterworld:theran_marble_tile", STAIR = "minecraft:quartz_stairs", BRICK = "minecraft:quartz_bricks", CHIS = "minecraft:chiseled_quartz_block", SLAB = "minecraft:smooth_quartz_slab";
/** A gable roof over x0..x1 (ridge along z), its slopes stairs rising to the ridge, its gable ends filled (the pediments). */
const gable = (m, x0, x1, y0, z0, z1, fill = MB, roof = "theran_marble") => {   // the roof at the Greek pitch, one in four, in the pack's layered tiles (world/carvings.js ROOF_LAYERS): it climbs four pixels a block from each eave to the ridge, no stair's step
  const P = 4, layer = (q) => `waterworld:${roof}_roof_layer_${q}`, full = `waterworld:${roof}_roof_full`;   // derived: four pixels a block, a quarter block
  let top = y0;
  for (let x = x0; x <= x1; x++) { const k = Math.min(x - x0, x1 - x), s = (k + 1) * P, yb = y0 + Math.floor(s / 16), q = s % 16; top = Math.max(top, yb);   // the roof's height over the eave, in pixels
    for (let z = z0; z <= z1; z++) { const face = z === z0 || z === z1;
      if (q) put(m, x, yb, z, layer(q)); else put(m, x, yb - 1, z, full);   // the tiled surface
      for (let y = y0; y < yb - (q ? 0 : 1); y++) if (face || y === yb - (q ? 1 : 2)) put(m, x, y, z, face ? fill : full); } }   // under it: the pediments solid at the ends, a course of stone under the tiles between
  return top; };
/** A dome of radius r over (cx, y0, cz), its shell of id. */
const dome = (m, cx, y0, cz, r, id) => { for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) for (let y = 0; y <= r; y++) { const d = Math.hypot(x, y, z); if (d <= r + 0.5 && d > r - 0.7) put(m, cx + x, y0 + y, cz + z, id); } };

// ---- the dress: what makes a white box a building. On a rectangle's outer walls (x0..x1, z0..z1, from y0 to the roof
// at y1): a plinth stepped a block out; pilasters standing a block proud every bay and at the corners; in each bay a
// window per storey (glass two high, a slab sill, a chiselled keystone over it); a blue string course at each upper
// floor; under the roof a frieze (chiselled triglyphs between blue metopes), a cornice a block out, and a balustrade
// (quartz brick between chiselled posts at the pilasters). doors: [[x, z], ...] cells of wall kept clear for doors.
const TOPSLAB = { "minecraft:vertical_half": "top" }, BOTSLAB = { "minecraft:vertical_half": "bottom" };
const dress = (m, x0, z0, x1, z1, y0, y1, { bay = FIB[4] + 1, floors = [], doors = [], parapet = true, keep = () => false } = {}) => {
  // the facade of a classical house of state, not a tower's grid: a stepped plinth; the ground storey rusticated (ashlar
  // courses two high, the joints staggered) with small windows; above it fewer, wider bays, each a tall arched window
  // on a balcony ledge; engaged columns only at the corners and every second bay; a ledge proud at each floor; a carved
  // frieze and a deep cornice under the roof; the door framed, its own pediment over it
  const ring = []; for (let x = x0; x <= x1; x++) ring.push([x, z0, 0, -1], [x, z1, 0, 1]); for (let z = z0 + 1; z < z1; z++) ring.push([x0, z, -1, 0], [x1, z, 1, 0]);
  const tall = !floors.length, top0 = tall ? y0 + 2 : floors[0], storeys = tall ? [y0] : [...floors];   // the rusticated ground storey up to the first floor (a hall of one tall storey: a rusticated dado, its tall windows over it)
  for (const [x, z, ox, oz] of ring) { if (keep(x, z)) continue;
    const along = ox ? z - z0 : x - x0, len = ox ? z1 - z0 : x1 - x0, n = Math.max(1, Math.round(len / bay)), step = len / n;   // the bays fitted to the wall: whole bays, about eight blocks each
    const pos = along / step, k = Math.round(pos), onLine = Math.abs(pos - k) * step < 0.5, corner = along === 0 || along === len;
    const col = corner || (onLine && k % 2 === 0), mid = Math.abs(pos - Math.floor(pos) - 0.5) * step <= step / 2 - 1.4,   // vision: each bay's window as wide as the bay leaves between its piers (light and openness: the wall mostly glass)
    door = doors.some(([a, b]) => Math.abs(a - x) <= 1 && b === z);
    put(m, x + ox, y0, z + oz, BRICK); put(m, x + ox, y0 + 1, z + oz, SLAB, BOTSLAB);   // the plinth
    // the rustication: courses two high, the vertical joints every fourth, staggered a course to the next
    for (let y = y0 + 1; y < top0; y++) { const c = Math.floor((y - y0 - 1) / 2), joint = (y - y0 - 1) % 2 === 1 || (along + (c % 2) * 2) % 4 === 0; if (m.has(`${x},${y},${z}`)) put(m, x, y, z, MASH); }   // the Theran ashlar (its joints in its own texture, bonded round the corners)
    if (col) { put(m, x + ox, y0 + 1, z + oz, WW("theran", "column_base")); for (let y = y0 + 2; y < y1 - 2; y++) put(m, x + ox, y, z + oz, WW("theran", "column")); put(m, x + ox, y1 - 2, z + oz, WW("theran", corner ? "capital_doric" : "capital_ionic")); }   // an engaged column, a block proud
    for (const fy of storeys) if (!col) { put(m, x, fy, z, BLUE); put(m, x + ox, fy, z + oz, SLAB, TOPSLAB); }   // the floor's ledge, blue behind it
    if (mid && !door && !col) {
      if (!tall && top0 - y0 >= FIB[4]) { for (let y = y0 + 2; y < top0 - 1; y++) put(m, x, y, z, GLASS); put(m, x, top0 - 1, z, STAIR, { weirdo_direction: ox ? (ox > 0 ? 1 : 0) : (oz > 0 ? 3 : 2), upside_down_bit: true }); }   // the ground storey's windows, arched too, up from the dado
      for (const sy of storeys) { const wy = sy + (tall ? 3 : 1), head = (storeys[storeys.indexOf(sy) + 1] ?? y1 - 1) - 2; if (head - wy < 2) continue;   // the tall windows, arched, the storey's whole height
        for (let y = wy; y < head; y++) put(m, x, y, z, y >= head - 2 ? STAINED[(Math.floor(pos) + (y === head - 1 ? 0 : 1)) % STAINED.length] : GLASS);   // the window's head stained with the faith's figures, its body clear for the light
        put(m, x, head, z, STAIR, { weirdo_direction: ox ? (ox > 0 ? 1 : 0) : (oz > 0 ? 3 : 2), upside_down_bit: true });   // the arch's head, an upturned stair (given: east 0, west 1, south 2, north 3)
        put(m, x, head + 1, z, CHIS);   // its keystone
        put(m, x + ox, wy - 1, z + oz, SLAB, BOTSLAB); put(m, x + ox, wy - 2, z + oz, STAIR, { weirdo_direction: ox ? (ox > 0 ? 0 : 1) : (oz > 0 ? 2 : 3), upside_down_bit: true });   // the balcony ledge on its bracket
      } }
    put(m, x, y1 - 1, z, col ? CHIS : along % 4 === 2 ? WW("theran", "anthemion") : WW("theran", "egg_dart"));   // the frieze: egg-and-dart, a palmette (anthemion) every fourth
    put(m, x + ox, y1 - 1, z + oz, STAIR, { weirdo_direction: ox ? (ox > 0 ? 0 : 1) : (oz > 0 ? 2 : 3), upside_down_bit: true });   // the cornice's bed, a stair turned under
    put(m, x + ox, y1, z + oz, SLAB, TOPSLAB); put(m, x + 2 * ox, y1, z + 2 * oz, SLAB, TOPSLAB); if (corner) { put(m, x + ox, y1, z, SLAB, TOPSLAB); put(m, x, y1, z + oz, SLAB, TOPSLAB); put(m, x + ox + ox, y1, z + oz + oz, SLAB, TOPSLAB); }   // the cornice, two blocks deep
    if (parapet) put(m, x, y1 + 1, z, col ? CHIS : BRICK), col && put(m, x, y1 + 2, z, SLAB, BOTSLAB);   // the balustrade
    if (door) { put(m, x + ox, y0 + 1, z + oz, CHIS); }
  }
  // each door's frame: an architrave of chiselled stone round it, a pediment of upturned stairs over
  for (const [dx, dz] of doors) { const onX = dz === z0 || dz === z1, oz2 = dz === z0 ? -1 : 1, ox2 = dx === x0 ? -1 : 1;
    for (let y = y0 + 1; y <= y0 + 6; y++) for (const s2 of [-3, 3]) onX ? put(m, dx + s2, y, dz + oz2, WW("theran", y === y0 + 1 ? "column_base" : y === y0 + 6 ? "capital_ionic" : "column")) : put(m, dx + ox2, y, dz + s2, WW("theran", y === y0 + 1 ? "column_base" : y === y0 + 6 ? "capital_ionic" : "column"));
    for (let i = -3; i <= 3; i++) { const ab = y0 + 7 + (3 - Math.abs(i) > 1 ? 1 : 0); onX ? put(m, dx + i, y0 + 7, dz + oz2, CHIS) : put(m, dx + ox2, y0 + 7, dz + i, CHIS); if (Math.abs(i) <= 2) onX ? put(m, dx + i, ab + (Math.abs(i) <= 1 ? 1 : 0), dz + oz2, Math.abs(i) <= 1 ? CHIS : SLAB, Math.abs(i) <= 1 ? null : BOTSLAB) : put(m, dx + ox2, ab + (Math.abs(i) <= 1 ? 1 : 0), dz + i, Math.abs(i) <= 1 ? CHIS : SLAB, Math.abs(i) <= 1 ? null : BOTSLAB); }   // the lintel and its pediment
  }
  return m; };
/** A pyramidal cap of stepped slabs and blocks over a square (cx, cz, r) from y0, a finial on top. */
const pyramid = (m, cx, y0, cz, r, id = BLUE, fin = CHIS) => { let y = y0; for (let k = r; k >= 0; k--) { for (let x = -k; x <= k; x++) for (let z = -k; z <= k; z++) put(m, cx + x, y, cz + z, Math.max(Math.abs(x), Math.abs(z)) === k ? SLAB : id, Math.max(Math.abs(x), Math.abs(z)) === k ? BOTSLAB : null); y++; } put(m, cx, y, cz, fin); return y; };
/** A drum: a round wall of radius r from y0 to y1 with tall windows every so often, for a dome to sit on. */
const drum = (m, cx, y0, cz, r, y1) => { for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) { const d = Math.hypot(x, z); if (d > r + 0.5 || d <= r - 0.6) continue; const a = Math.atan2(z, x), win = Math.round(a * 8 / Math.PI) % 2 === 0 && Math.abs(x) !== Math.abs(z);
  for (let y = y0; y <= y1; y++) put(m, cx + x, y, cz + z, y === y1 ? CHIS : win && y > y0 && y < y1 - 1 ? GLASS : CA); } };

/** A roof garden on a flat roof at height y over x0..x1, z0..z1: beds of grass set into the roof between white paths,
 *  each bed an azalea at its heart and Thera's flowers round it (cornflower blue, lily of the valley white, dandelion
 *  gold), a slab parapet round the edge; skip(x, z) keeps a cell as it is (a tower's foot, a dome's, the court's gap). */
export const roofGarden = (m, x0, z0, x1, z1, y, skip = () => false) => {
  const FL = ["minecraft:cornflower", "minecraft:lily_of_the_valley", "minecraft:dandelion", "minecraft:lily_of_the_valley"];   // vision: Thera's colours, white twice
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { if (skip(x, z) || !m.has(`${x},${y},${z}`)) continue;
    if (x === x0 || x === x1 || z === z0 || z === z1) { put(m, x, y + 1, z, SLAB); continue; }   // the parapet
    const i = (x - x0) % 6, k = (z - z0) % 6, bed = i >= 2 && i <= 4 && k >= 2 && k <= 4;   // vision: beds three across on a six-block grain, paths between
    if (!bed) continue; put(m, x, y, z, "minecraft:grass_block");
    put(m, x, y + 1, z, i === 3 && k === 3 ? ((x + z) % 4 === 0 ? "minecraft:flowering_azalea" : "minecraft:azalea") : FL[(((x * 7 + z * 13) % FL.length) + FL.length) % FL.length]); }
  return m; };
/** The great temple: w across, l long (a golden rectangle), its columns h tall. */
export function greatTemple({ w = 34, l = 55, h = 21 } = {}) {   // vision: 34 by 55 (the summit's room); its great columns twenty-one tall, two blocks across (the Sea Rite Temple)
  const m = new Map(), hx = Math.floor(w / 2), hz = Math.floor(l / 2);
  for (let s = 0; s < 3; s++) box(m, -hx + s, s, -hz + s, hx - s, s, hz - s, MB);   // vision: three steps (the crepidoma), all of the white marble
  const fx = hx - 3, fz = hz - 3, base = 3;
  // the peristyle, hexastyle: six great columns across each end, thirteen down each side (the classical 2n + 1), each
  // two blocks across, spaced evenly from corner to corner of the colonnade's line
  const NX = FIB[4] + 1, NZ = FIB[6], at = (lo, hi, n, k) => Math.round(lo + (k * (hi - lo)) / (n - 1));   // derived: six and thirteen
  const great = (x, z) => { for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { put(m, x + a, base, z + b, WWB("column_base", a, b)); for (let y = base + 1; y < base + h - 1; y++) put(m, x + a, y, z + b, WWB("column", a, b)); put(m, x + a, base + h - 1, z + b, WWB("capital_ionic", a, b)); } };
  for (let k = 0; k < NX; k++) { const x = at(-fx, fx - 1, NX, k); great(x, -fz); great(x, fz - 1); }
  for (let k = 1; k < NZ - 1; k++) { const z = at(-fz, fz - 1, NZ, k); great(-fx, z); great(fx - 1, z); }
  box(m, -fx, base + h, -fz, fx, base + h, fz, MB); for (let x = -fx; x <= fx; x++) for (const z of [-fz, fz]) put(m, x, base + h, z, WW("theran", "bead_reel")); for (let z = -fz; z <= fz; z++) for (const x of [-fx, fx]) put(m, x, base + h, z, WW("theran", "bead_reel"));   // the architrave, bead-and-reel along its face
  for (let x = -fx; x <= fx; x++) for (let z = -fz; z <= fz; z++) if (x === -fx || x === fx || z === -fz || z === fz) put(m, x, base + h + 1, z, (x + z) % 3 === 0 ? BLUE : carved(Math.floor((x + z) / 3), "theran", ["spiral", "wave"]));   // the frieze: the faith's spiral and wave carved in the metopes, blue between
  for (let x = -fx - 1; x <= fx + 1; x++) for (let z = -fz - 1; z <= fz + 1; z++) if (x === -fx - 1 || x === fx + 1 || z === -fz - 1 || z === fz + 1) put(m, x, base + h + 2, z, SLAB, { "minecraft:vertical_half": "bottom" });   // the cornice, a slab's overhang
  for (let x = -2; x <= 2; x++) for (let s2 = 0; s2 < 3; s2++) put(m, x, s2, -hz - 1 + s2 - 1, STAIR, { weirdo_direction: 2, upside_down_bit: false });   // the front stair up the three steps (given: stairs rising south 2)
  shell(m, -fx + 5, base, -fz + 8, fx - 5, base + h - 1, fz - 5, MB);   // vision: the cella within the colonnade, its walls of the white marble
  for (let y = base; y < base + 5; y++) for (let x = -1; x <= 1; x++) m.delete(`${x},${y},${-fz + 8}`);   // its door, facing the front
  for (let x = -fx + 6; x <= fx - 6; x += 4) put(m, x, base + h - 2, 0, LAMP);   // light within
  // the sacred pool of the Sea Rite in the cella's middle: a basin of prismarine, the sea's own water, lanterns at its corners
  const px = 4, pz = 7; box(m, -px - 1, base - 1, -pz - 1, px + 1, base - 1, pz + 1, "minecraft:prismarine_bricks"); box(m, -px, base - 1, -pz, px, base - 1, pz, "minecraft:water");   // vision: nine by fifteen, sunk a block
  for (const [a, b] of [[-px - 1, -pz - 1], [px + 1, -pz - 1], [-px - 1, pz + 1], [px + 1, pz + 1]]) put(m, a, base, b, LAMP);
  for (let x = -px - 1; x <= px + 1; x++) for (let z = -pz - 1; z <= pz + 1; z++) m.delete(`${x},${base},${z}`) || null;
  for (const [a, b] of [[-px - 1, -pz - 1], [px + 1, -pz - 1], [-px - 1, pz + 1], [px + 1, pz + 1]]) put(m, a, base, b, LAMP);
  // the roof: a gable of quartz stairs over the colonnade, its pediments filled in quartz brick
  const ridge = gable(m, -fx, fx, base + h + 2, -fz, fz);
  put(m, 0, ridge + 1, -fz, GOLD); put(m, 0, ridge + 1, fz, GOLD); put(m, 0, ridge + 1, 0, GOLD);   // the finials, gold (the temple's: one of Thera's three gold points)
  // the tympanum's emblem at both ends: the sea's round in blue, a gold sun at its heart; acroteria at the eaves' corners
  const ty = base + h + 3;   // the emblem low in the pediment, which is low now
  for (const z of [-fz, fz]) for (let x = -3; x <= 3; x++) for (let y = -1; y <= 1; y++) { const d = Math.hypot(x / PHI, y); if (d > 1.6) continue; put(m, x, ty + y, z, d < 0.7 ? GOLD : d < 1.2 ? BLUE : CHIS); }   // derived: an oval of aspect phi
  for (const x of [-fx, fx]) for (const z of [-fz, fz]) { put(m, x, base + h + 3, z, CHIS); put(m, x, base + h + 4, z, "minecraft:lantern", { hanging: false }); }
  // the cella dressed within the colonnade: a blue band, tall windows
  for (let x = -fx + 5; x <= fx - 5; x++) for (const z of [-fz + 8, fz - 5]) if (m.get(`${x},${base + 8},${z}`)?.id === MB) put(m, x, base + 8, z, BLUE);
  for (let z = -fz + 8; z <= fz - 5; z++) for (const x of [-fx + 5, fx - 5]) { put(m, x, base + 8, z, BLUE); if ((z + fz) % 4 === 0) for (let y = base + 10; y <= base + 14; y++) put(m, x, y, z, STAINED[(z + fz + y) % STAINED.length]); }
  return m;
}
/** The government seat: a square palace of state round an open court, two storeys, dressed all round; a portico of six
 *  columns and a pediment at its front, a pavilion at each corner under a blue pyramid, the hall's blue dome on a
 *  windowed drum at its back with a gold lantern (the seat's gold point), a fountain in its cloistered court. */
export function governmentSeat({ w = 34, l = 34 } = {}) {   // vision: 34 by 34 (the least seat but one, square for its court)
  const m = new Map(), hx = Math.floor(w / 2), hz = Math.floor(l / 2), H = 13, F = 7, C = 8;   // vision: two storeys, thirteen high, the upper floor at seven; the court eight in from the walls
  box(m, -hx, 0, -hz, hx, 0, hz, FLOOR);
  shell(m, -hx, 1, -hz, hx, H, hz, CA); shell(m, -hx + C, 1, -hz + C, hx - C, H, hz - C, CA);   // the outer and the court's walls: rooms between
  box(m, -hx, H + 1, -hz, hx, H + 1, hz, Q); for (let x = -hx + C + 1; x <= hx - C - 1; x++) for (let z = -hz + C + 1; z <= hz - C - 1; z++) m.delete(`${x},${H + 1},${z}`);   // the roof, open over the court
  for (let x = -hx + 1; x < hx; x++) for (let z = -hz + 1; z < hz; z++) if (!(x > -hx + C && x < hx - C && z > -hz + C && z < hz - C)) put(m, x, F, z, Q);   // the upper floor
  dress(m, -hx, -hz, hx, hz, 0, H + 1, { floors: [F], doors: [], parapet: false });   // the portico frames its door
  // the court: grass, a cloister of columns under upturned-stair arches, a fountain in a quartz basin at its middle
  for (let x = -hx + C + 1; x <= hx - C - 1; x++) for (let z = -hz + C + 1; z <= hz - C - 1; z++) put(m, x, 0, z, "minecraft:grass_block");
  for (let x = -hx + C; x <= hx - C; x += 2) for (const z of [-hz + C, hz - C]) { for (let y = 1; y <= 4; y++) m.delete(`${x},${y},${z}`); column(m, x, 1, z, 4, "doric"); put(m, x, 5, z, STAIR, { weirdo_direction: z < 0 ? 2 : 3, upside_down_bit: true }); }   // given: south 2, north 3
  for (let z = -hz + C; z <= hz - C; z += 2) for (const x of [-hx + C, hx - C]) { for (let y = 1; y <= 4; y++) m.delete(`${x},${y},${z}`); column(m, x, 1, z, 4, "doric"); put(m, x, 5, z, STAIR, { weirdo_direction: x < 0 ? 0 : 1, upside_down_bit: true }); }   // given: east 0, west 1
  box(m, -3, 0, -3, 3, 0, 3, BRICK); box(m, -2, 0, -2, 2, 0, 2, "minecraft:water"); column(m, 0, 0, 0, 3, "doric"); put(m, 0, 3, 0, "minecraft:lantern", { hanging: false });   // vision: the fountain seven across, a column in it
  for (const [a, b] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) put(m, a, 1, b, "minecraft:flowering_azalea");
  // the portico: six columns before the door, the height of the house, an entablature, a pediment facing out
  const pz = -hz - 5; box(m, -8, 0, pz, 8, 0, -hz - 1, FLOOR); for (let k = 0; k < 2; k++) box(m, -8 - k, -k, pz - 1 - k, 8 + k, -k, -hz - 1, BRICK);   // vision: five deep; its steps
  for (let x = -7; x <= 7; x += 3) column(m, x, 1, pz, H, "doric");   // vision: six columns, three apart
  box(m, -8, H + 1, pz, 8, H + 1, -hz, Q); for (let x = -8; x <= 8; x++) put(m, x, H + 2, pz, x % 4 === 0 ? BLUE : WW("theran", "scroll"));   // the architrave and the frieze
  for (let x = -9; x <= 9; x++) put(m, x, H + 3, pz - 1, SLAB, BOTSLAB);
  const ridge = gable(m, -8, 8, H + 3, pz, -hz); put(m, 0, ridge - 3, pz, GOLD); put(m, -1, ridge - 3, pz, BLUE); put(m, 1, ridge - 3, pz, BLUE);   // the pediment, its emblem gold between blue
  for (let x = -2; x <= 2; x++) for (let y = 1; y <= 5; y++) m.delete(`${x},${y},${-hz}`);   // the great door
  for (let y = 1; y <= 6; y++) { put(m, -3, y, -hz, GOLD); put(m, 3, y, -hz, GOLD); } for (let x = -3; x <= 3; x++) put(m, x, 6, -hz, GOLD);   // framed in gold
  // the corner pavilions: a storey higher, under blue pyramids
  for (const [cx, cz] of [[-hx + 3, -hz + 3], [hx - 3, -hz + 3], [-hx + 3, hz - 3], [hx - 3, hz - 3]]) { shell(m, cx - 3, H + 1, cz - 3, cx + 3, H + 5, cz + 3, CA);
    for (const [a, b] of [[0, -3], [0, 3], [-3, 0], [3, 0]]) { put(m, cx + a, H + 3, cz + b, GLASS); put(m, cx + a, H + 4, cz + b, GLASS); }
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (Math.max(Math.abs(x), Math.abs(z)) === 4) put(m, cx + x, H + 6, cz + z, SLAB, TOPSLAB);
    pyramid(m, cx, H + 6, cz, 3); }
  // the dome over the hall at the back: a windowed drum, the blue dome, a lantern with the gold point
  const dz = hz - 4; drum(m, 0, H + 2, dz, 4, H + 5); dome(m, 0, H + 6, dz, 4, BLUE); for (let y = H + 10; y <= H + 11; y++) for (const [a, b] of [[0, 0]]) put(m, a, y, dz + b, y === H + 11 ? GOLD : CHIS);
  roofGarden(m, -hx, -hz, hx, hz, H + 1, (x, z) => Math.hypot(x, z - dz) <= 5 || (Math.max(Math.abs(Math.abs(x) - (hx - 3)), Math.abs(Math.abs(z) - (hz - 3))) <= 3));   // the roof a garden round the court, clear of the dome and the pavilions
  return m;
}
/** The navigation house: a dressed hall with an arcaded loggia on its front, and the observatory tower at its back
 *  corner in three stages: a dressed shaft, a gallery a slab proud with its balustrade, an open belvedere of columns
 *  and the blue glass dome on it (the charts and the globe within), a compass in gold and blue on its face. */
export function navigationHouse({ w = 21, l = 21 } = {}) {   // vision: 21 by 21, the least
  const m = new Map(), hx = Math.floor(w / 2), hz = Math.floor(l / 2), H = 9, T1 = H + 8, T2 = T1 + 5;   // vision: the hall nine high; the tower's shaft eight over it, its belvedere five more (21 in all, not the old 34)
  box(m, -hx, 0, -hz, hx, 0, hz, FLOOR); shell(m, -hx, 1, -hz, hx, H, hz, CA); box(m, -hx, H + 1, -hz, hx, H + 1, hz, Q);
  const tx = hx - 4, tz = hz - 4;
  dress(m, -hx, -hz, hx, hz, 0, H + 1, { floors: [], doors: [], parapet: false });   // the loggia frames its door
  // the loggia: an arcade of five bays before the door
  const lz = -hz - 3; box(m, -6, 0, lz, 6, 0, -hz - 1, FLOOR); for (let x = -6; x <= 6; x += 3) { column(m, x, 1, lz, 5, "aeolic", "carrara"); }
  for (let x = -6; x <= 6; x++) { put(m, x, 6, lz, x % 3 === 0 ? CHIS : STAIR, x % 3 === 0 ? null : { weirdo_direction: 2, upside_down_bit: true }); box(m, x, 7, lz, x, 7, -hz - 1, Q); put(m, x, 8, lz, x % 2 ? BLUE : CHIS); }   // given: south 2
  for (let x = -1; x <= 1; x++) for (let y = 1; y <= 4; y++) m.delete(`${x},${y},${-hz}`);   // its door
  // the tower: the shaft dressed, the gallery, the belvedere, the dome
  shell(m, tx - 3, H + 2, tz - 3, tx + 3, T1, tz + 3, CA); dress(m, tx - 3, tz - 3, tx + 3, tz + 3, H + 1, T1, { bay: 3, floors: [], parapet: false });
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (Math.max(Math.abs(x), Math.abs(z)) === 4) { put(m, tx + x, T1, tz + z, Q); put(m, tx + x, T1 + 1, tz + z, (x + z) % 2 ? BRICK : CHIS); }   // the gallery a block proud, its balustrade
  box(m, tx - 3, T1, tz - 3, tx + 3, T1, tz + 3, Q);
  for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, -2], [0, 2], [-2, 0], [2, 0]]) column(m, tx + a, T1 + 1, tz + b, T2 - T1 - 1, "ionic", "carrara");   // the belvedere's columns
  box(m, tx - 2, T2, tz - 2, tx + 2, T2, tz + 2, Q); for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.max(Math.abs(x), Math.abs(z)) === 3) put(m, tx + x, T2, tz + z, SLAB, TOPSLAB);
  dome(m, tx, T2 + 1, tz, 3, GLASS); put(m, tx, T2 + 1, tz, LAMP); put(m, tx, T2 + 4, tz, CHIS); put(m, tx, T2 + 5, tz, "minecraft:lightning_rod");
  put(m, tx, T1 + 2, tz, "minecraft:lodestone");   // the globe's place in the belvedere
  // the compass on the tower's face toward the front: a gold cross on a blue round
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) { const d = Math.hypot(x, y); if (d > 2.5) continue; put(m, tx + x, H + 5 + y, tz - 4, x === 0 || y === 0 ? GOLD : BLUE); }
  roofGarden(m, -hx, -hz, hx, hz, H + 1, (x, z) => Math.abs(x - tx) <= 4 && Math.abs(z - tz) <= 4);   // the hall's roof a garden at the tower's foot
  put(m, 0, 1, 0, "minecraft:lodestone"); put(m, 0, 2, 0, "minecraft:lectern", { "minecraft:cardinal_direction": "south" });   // the chart table at its heart
  return m;
}
/** The library: three reading terraces stepping back, each hall dressed on its sides and back; along each front a
 *  colonnade under an entablature with a blue frieze and a cornice, a pediment over its middle bays; acroteria at the
 *  top terrace's corners and its roof a garden. */
export function library({ w = 34, l = 55 } = {}) {   // vision: 34 by 55, the least library
  const m = new Map(), hx = Math.floor(w / 2), hz = Math.floor(l / 2), step = Math.floor(l / 3), H = 7;   // vision: each terrace a third of its length deep, seven high
  for (let t = 0; t < 3; t++) {
    const z0 = -hz + t * step, y0 = t * (H + 1);
    box(m, -hx, y0, z0, hx, y0, hz, FLOOR);
    shell(m, -hx, y0 + 1, z0 + 3, hx, y0 + H, hz, CA);   // its hall, set back three behind its colonnade
    dress(m, -hx, z0 + 3, hx, hz, y0, y0 + H + 1, { floors: [], parapet: false, keep: (x, z) => z === z0 + 3 });   // its sides and back (its front is the colonnade's)
    for (let x = -hx; x <= hx; x += 3) column(m, x, y0 + 1, z0, H, "corinthian");   // the colonnade on its front, base and capital
    box(m, -hx, y0 + H + 1, z0, hx, y0 + H + 1, z0 + 2, Q);   // its colonnade's roof
    for (let x = -hx; x <= hx; x++) { put(m, x, y0 + H, z0 + 3, x % 3 === 0 ? CHIS : WW("theran", "guilloche")); put(m, x, y0 + H + 1, z0 - 1, SLAB, TOPSLAB); }   // the frieze over the colonnade, the cornice a block out
    if (t < 2) { const ridge = gable(m, -7, 7, y0 + H + 2, z0, z0 + 2); put(m, 0, ridge - 2, z0, GOLD); }   // vision: a pediment over the middle five bays, its emblem gold
    for (let x = -hx + 2; x <= hx - 2; x += 4) { put(m, x, y0 + 3, z0 + 3, GLASS); put(m, x, y0 + 4, z0 + 3, GLASS); put(m, x, y0 + 5, z0 + 3, CHIS); }   // reading windows on the front, keystoned
    for (let x = -2; x <= 2; x += 2) put(m, x, y0 + 1, z0 + 6, "minecraft:bookshelf");
    for (let x = -hx + 2; x <= hx - 2; x += 2) for (const z of [hz - 1]) for (let y = y0 + 1; y <= y0 + 3; y++) put(m, x, y, z, "minecraft:bookshelf");   // the stacks along its back wall
  }
  const top = 3 * (H + 1);
  box(m, -hx, top, -hz + 2 * step, hx, top, hz, Q);   // the top terrace's roof, a walk
  roofGarden(m, -hx, -hz + 2 * step, hx, hz, top);   // and a garden
  for (const [a, b] of [[-hx, -hz + 2 * step], [hx, -hz + 2 * step], [-hx, hz], [hx, hz]]) { put(m, a, top + 1, b, CHIS); put(m, a, top + 2, b, "minecraft:lantern", { hanging: false }); }   // acroteria
  return m;
}
export const CIVIC = { "great temple": greatTemple, "government seat": governmentSeat, "navigation house": navigationHouse, library };
