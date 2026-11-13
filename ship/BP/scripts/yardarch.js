// Yard architecture: each tradition's buildings and gathering places around its dock.
//
// Every building is drawn in its own frame, so the same building can stand by a dock today and in
// a seaside village later, turned to face any way:
//   u runs toward the building's front (its front wall is at u = 0, the rest at negative u),
//   w runs to its right (looking out of the front), dy is height above the ground (dy = 0 is the
//   floor you stand on).
// A yard places them around its dock with Canvas.place(u, w, turns).
//
// Building conventions borrowed from Minecraft builders: a log frame with posts at the corners
// and every few blocks, infill between; roofs of stairs whose full side faces the ridge,
// overhanging the walls; upside-down stairs as brackets under eaves; slabs for gentle slopes and
// for the soft first course of East Asian roofs; fences and trapdoors for thin details. Interiors
// use the villager job blocks that fit each trade, so villages can grow around these later.
// Working waterfronts and homes only: no sacred or ceremonial structures, carvings or crests.

export const SEA = "sea", STAR = "star", LAND = "land", PORT = "port";
const FACES = [SEA, STAR, LAND, PORT];         // +u, +w, -u, -w: each a quarter turn from the last
const turnFace = (f, r) => (f ? FACES[(FACES.indexOf(f) + r) % 4] : f);
const turnAxis = (a, r) => (r % 2 === 0 || !a || a === "y" ? a : a === "z_along_u" ? "along_w" : "z_along_u");

/** Collects blocks to place. Later puts overwrite earlier ones at the same cell. */
export class Canvas {
  constructor() {
    this.cells = new Map();
    this.volumes = [];          // boxes to clear before building (interiors, under roofs)
    this.floors = [];           // walking surfaces that need footing under them
    this.piles = [];            // single columns that need footing under them (stilts)
    this.marks = {};            // named spots (where the Shipwright's Table goes)
  }
  put(u, w, dy, id, opts = {}) { this.cells.set(`${u},${w},${dy}`, { u, w, dy, id, ...opts }); }
  has(u, w, dy) { return this.cells.has(`${u},${w},${dy}`); }
  remove(u, w, dy) { this.cells.delete(`${u},${w},${dy}`); }
  clear(u0, u1, w0, w1, dy0, dy1) {
    this.volumes.push({ u0: Math.min(u0, u1), u1: Math.max(u0, u1), w0: Math.min(w0, w1), w1: Math.max(w0, w1), dy0, dy1 });
  }
  addFloor(r) { this.floors.push(r); }
  pile(u, w, id) { this.put(u, w, 0, id); this.piles.push({ u, w, id }); }
  mark(name, u, w, dy) { this.marks[name] = { u, w, dy }; }
  /** A frame for drawing a building: its front at (u, w) here, turned `turns` quarter turns to the right. */
  place(u, w, turns = 0) { return new Frame(this, u, w, turns); }

  box(u0, u1, w0, w1, dy0, dy1, id, opts) {
    for (let u = Math.min(u0, u1); u <= Math.max(u0, u1); u++)
      for (let w = Math.min(w0, w1); w <= Math.max(w0, w1); w++)
        for (let dy = dy0; dy <= dy1; dy++) this.put(u, w, dy, id, opts);
  }
  /** The outline of a box (walls only), skipping cells where skip(u, w, dy) is true. */
  ring(u0, u1, w0, w1, dy0, dy1, id, opts = {}, skip = () => false) {
    for (let u = u0; u <= u1; u++) for (let w = w0; w <= w1; w++) {
      if (u !== u0 && u !== u1 && w !== w0 && w !== w1) continue;
      for (let dy = dy0; dy <= dy1; dy++) if (!skip(u, w, dy)) this.put(u, w, dy, id, opts);
    }
  }
  /** A walking surface at dy 0: footing is filled under it down to the ground (pilings over water). */
  floor(u0, u1, w0, w1, id, opts) {
    this.box(u0, u1, w0, w1, 0, 0, id, opts);
    this.addFloor({ u0: Math.min(u0, u1), u1: Math.max(u0, u1), w0: Math.min(w0, w1), w1: Math.max(w0, w1) });
  }
  stair(u, w, dy, id, face, upside = false) { this.put(u, w, dy, id, { face, upside }); }
  slab(u, w, dy, id, top = false) { this.put(u, w, dy, id, { half: top ? "top" : "bottom" }); }
  log(u, w, dy, id, axis = "y") { this.put(u, w, dy, id, { axis }); }
  list() { return [...this.cells.values()]; }
  /**
   * Makes every hanging thing hang from something: a hanging lantern gets a chain up to the first
   * block above it (within four); with nothing up there it stands on a post from the ground instead.
   */
  settle(post = "minecraft:spruce_fence") {
    for (const cell of [...this.cells.values()]) {
      if (!cell.hanging) continue;
      const { u, w, dy } = cell;
      if (this.has(u, w, dy + 1)) continue;
      let k = 1;
      while (k <= 4 && !this.has(u, w, dy + k)) k++;
      if (k <= 4) { for (let j = 1; j < k; j++) this.put(u, w, dy + j, "minecraft:iron_chain", { axis: "y" }); continue; }
      this.put(u, w, dy, cell.id, {});
      for (let y = dy - 1; y >= 1 && !this.has(u, w, y); y--) this.put(u, w, y, post);
    }
  }
}

/** A turned, shifted view onto a canvas: everything drawn here lands in the parent, rotated. */
class Frame extends Canvas {
  constructor(parent, u0, w0, r) {
    super();
    Object.assign(this, { p: parent, u0, w0, r: ((r % 4) + 4) % 4 });
  }
  tf(u, w) {
    const [gu, gw] = [[u, w], [-w, u], [-u, -w], [w, -u]][this.r];
    return [this.u0 + gu, this.w0 + gw];
  }
  put(u, w, dy, id, opts = {}) {
    const [gu, gw] = this.tf(u, w);
    this.p.put(gu, gw, dy, id, { ...opts, face: turnFace(opts.face, this.r), facing: turnFace(opts.facing, this.r), axis: turnAxis(opts.axis, this.r) });
  }
  has(u, w, dy) { const [gu, gw] = this.tf(u, w); return this.p.has(gu, gw, dy); }
  remove(u, w, dy) { const [gu, gw] = this.tf(u, w); this.p.remove(gu, gw, dy); }
  clear(u0, u1, w0, w1, dy0, dy1) {
    const [a, b] = this.tf(u0, w0), [c, d] = this.tf(u1, w1);
    this.p.clear(a, c, b, d, dy0, dy1);
  }
  addFloor({ u0, u1, w0, w1 }) {
    const [a, b] = this.tf(u0, w0), [c, d] = this.tf(u1, w1);
    this.p.addFloor({ u0: Math.min(a, c), u1: Math.max(a, c), w0: Math.min(b, d), w1: Math.max(b, d) });
  }
  pile(u, w, id) { const [gu, gw] = this.tf(u, w); this.p.pile(gu, gw, id); }
  mark(name, u, w, dy) { const [gu, gw] = this.tf(u, w); this.p.mark(name, gu, gw, dy); }
}

// ---------------------------------------------------------------- roofs

/**
 * A gable roof over u0..u1 x w0..w1 (the walls), its ridge running along u so the gables face the
 * front and back. Courses step up one block per block in (pitch 1) or two (pitch 2, steep).
 *   eave: overhang beyond the side walls; ends: overhang beyond the gables
 *   curve: a slab first course, then stairs (the soft sweep of a Japanese or Chinese roof)
 *   upturn: the four eave corners lift a block (southern Chinese)
 *   gable: what fills the triangular gable ends (null = open)
 *   ridge: a slab along the ridge on even-width roofs; course(k): material override per course
 *   ({ full } alone lays full blocks: thatch, turf)
 * Returns the height of the ridge.
 */
export function gableRoof(c, o) {
  const { u0, u1, w0, w1, dy, stair, full, slab = null, eave = 1, ends = 1, pitch = 1, curve = false, upturn = false,
    gable = null, ridge = null, course = null } = o;
  const ua = u0 - ends, ub = u1 + ends;
  let y = dy, top = dy;
  for (let k = 0; ; k++) {
    const wl = w0 - eave + k, wr = w1 + eave - k;
    if (wl > wr) break;
    const m = { stair, full, slab, ...(course ? course(k) : {}) };
    const first = k === 0;
    for (let u = ua; u <= ub; u++) {
      const corner = upturn && first && (u === ua || u === ub);
      if (wl === wr) {                                         // odd width: the ridge course
        c.put(u, wl, y, m.full, m.axis ? { axis: m.axis } : {});
        if (m.slab) c.slab(u, wl, y + 1, m.slab);
        continue;
      }
      for (const [w, face] of [[wl, STAR], [wr, PORT]]) {      // each slope's stairs face the ridge
        if (curve && first) c.slab(u, w, y, m.slab ?? m.full);
        else if (corner) {
          c.stair(u, w, y + 1, m.stair, face);
          c.stair(u, w, y, m.stair, face === STAR ? PORT : STAR, true);
        } else if (!m.stair) {
          for (let h = 0; h < pitch; h++) c.put(u, w, y + h, m.full, m.axis ? { axis: m.axis } : {});
        } else {
          if (pitch === 2) c.put(u, w, y, m.full);
          c.stair(u, w, y + (pitch === 2 ? 1 : 0), m.stair, face);
        }
      }
    }
    const courseTop = y + (pitch === 2 ? 1 : 0);
    top = courseTop;
    if (gable) for (const u of [u0, u1]) for (let w = Math.max(wl + 1, w0); w <= Math.min(wr - 1, w1); w++)
      for (let h = dy; h <= courseTop; h++) if (!c.has(u, w, h)) c.put(u, w, h, gable);
    if (wl === wr) { top = y + (m.slab ? 1 : 0); break; }
    if (wl + 1 === wr) {                                       // even width: stairs meet at the ridge
      if (ridge) for (let u = ua; u <= ub; u++) { c.slab(u, wl, y + 1, ridge); c.slab(u, wr, y + 1, ridge); }
      if (ridge) top = y + 1;
      break;
    }
    if (!(curve && first)) y += pitch;
  }
  c.clear(ua, ub, w0 - eave, w1 + eave, dy, top + 1);
  return top;
}

/** A gable roof whose ridge runs across the building (along w): a long side faces the front. */
export function gableRoofAcross(c, o) {
  const f = c.place(0, 0, 1);                                  // in f, u' runs along our w and w' along our -u
  return gableRoof(f, { ...o, u0: o.w0, u1: o.w1, w0: -o.u1, w1: -o.u0 });
}

/** A single-slope roof (Coast Salish shed roof): low at w0, rising toward w1 half a block a step. */
export function shedRoof(c, { u0, u1, w0, w1, dy, slab, eave = 1, ends = 1 }) {
  let h = 0;
  for (let w = w0 - eave; w <= w1 + eave; w++, h++) {
    const y = dy + Math.floor(h / 2), top = h % 2 === 1;
    for (let u = u0 - ends; u <= u1 + ends; u++) c.slab(u, w, y, slab, top);
  }
  c.clear(u0 - ends, u1 + ends, w0 - eave, w1 + eave, dy, dy + Math.ceil(h / 2) + 1);
  return dy + Math.floor(h / 2);
}
/** The roof height of a shed roof at w (for walls that rise to meet it). */
const shedY = (dy, w0, eave, w) => dy + Math.floor((w - (w0 - eave)) / 2);

/** A flat roof with a parapet, its corners capped (Indian Ocean coral-stone houses). */
export function flatRoof(c, { u0, u1, w0, w1, dy, block, parapet, cap, crenel = false }) {
  for (let u = u0; u <= u1; u++) for (let w = w0; w <= w1; w++) c.put(u, w, dy, block);
  c.ring(u0, u1, w0, w1, dy + 1, dy + 1, parapet, {}, (u, w) => crenel && (u + w) % 2 === 1 && u !== u0 && u !== u1 && w !== w0 && w !== w1);
  for (const [u, w] of [[u0, w0], [u0, w1], [u1, w0], [u1, w1]]) { c.put(u, w, dy + 1, cap); c.put(u, w, dy + 2, parapet); }
  c.clear(u0, u1, w0, w1, dy, dy + 2);
  return dy + 2;
}

/** A round house: a ring wall, then rings drawn in, course by course, to a smoke hole (domes, qarmaq, tents). */
export function dome(c, { cu, cw, r, walls, wallH = 2, roof, steps = null, door = null, hole = true }) {
  const rings = steps ?? Array.from({ length: Math.ceil(r) }, (_, i) => r - i - 0.5);
  for (let u = Math.floor(cu - r - 1); u <= Math.ceil(cu + r + 1); u++) for (let w = Math.floor(cw - r - 1); w <= Math.ceil(cw + r + 1); w++) {
    const d = Math.hypot(u - cu, w - cw);
    const isDoor = door && door(u, w);
    if (d <= r + 0.45 && d >= r - 0.55 && !isDoor) for (let y = 1; y <= wallH; y++) c.put(u, w, y, typeof walls === "function" ? walls(y) : walls);
    rings.forEach((rr, i) => {
      // The last ring closes the top on the course below it (a cap resting on the ring round it,
      // never a block floating over a gap); with a smoke hole it's left open.
      const cap = rr < 0.6;
      if (d <= rr + 0.45 && d >= rr - 0.55 && !(hole && cap)) c.put(u, w, wallH + (cap && i > 0 ? i : 1 + i), roof);
    });
    if (d <= r + 0.45) c.clear(u, u, w, w, 1, wallH + rings.length + 1);
  }
  return wallH + rings.length;
}

// ---------------------------------------------------------------- the hall

/**
 * A timber-framed building in its own frame: front wall at u = 0, back wall at u = -(L - 1),
 * side walls at w = -h and +h, walls up to H. Spec:
 *   floor, post (corner and bay posts), bay (post spacing), beam (a ring of logs on top), wall
 *   (infill), base/baseH (a stone course at the foot), window/winY (window block, rows), door
 *   ({ w, h } in the front wall), open(u, w, y) (cells left open), from (lowest wall row)
 */
export function hall(c, s) {
  const { L, h, H } = s;
  const u0 = -(L - 1), u1 = 0, w0 = -h, w1 = h;
  const bay = s.bay ?? 3, from = s.from ?? 1;
  if (s.floor) c.floor(u0, u1, w0, w1, s.floor);
  const edge = (u, w) => u === u0 || u === u1 || w === w0 || w === w1;
  const isDoor = (u, w, y) => s.door && u === u1 && Math.abs(w) <= (s.door.w >> 1) && y >= from && y < from + s.door.h;
  const open = (u, w, y) => isDoor(u, w, y) || (s.open && s.open(u, w, y));
  const isPost = (u, w) => ((w === w0 || w === w1) && (u === u0 || u === u1 || (u - u0) % bay === 0)) ||
    ((u === u0 || u === u1) && (w === w0 || w === w1 || (w - w0) % bay === 0));
  const midBay = (u, w) => (w === w0 || w === w1) ? (u - u0) % bay === bay >> 1 : (w - w0) % bay === bay >> 1;
  c.clear(u0, u1, w0, w1, 1, H + 1);
  for (let u = u0; u <= u1; u++) for (let w = w0; w <= w1; w++) {
    if (!edge(u, w)) continue;
    for (let y = from; y <= H; y++) {
      if (open(u, w, y)) continue;
      if (s.base && y < from + (s.baseH ?? 1)) c.put(u, w, y, s.base);
      else if (s.post && isPost(u, w) && !(s.door && u === u1 && Math.abs(w) <= (s.door.w >> 1))) c.log(u, w, y, s.post);
      else if (s.window && (s.winY ?? [2]).includes(y) && midBay(u, w) && !isPost(u, w)) c.put(u, w, y, s.window);
      else if (s.wall) c.put(u, w, y, s.wall, s.wallOpts ?? {});
    }
  }
  // Detailing (dry-dock yards): a sloped stone plinth round the foot of the walls, and a sill
  // under each window, so the building sits into the ground and its walls read as made, not blocky.
  const skirt = from === 1 ? (s.skirt ?? DETAIL?.skirt) : null, sill = s.sill ?? DETAIL?.sill;   // (a plinth only on the ground)
  if (skirt || sill) {
    const out = (u, w) => (u === u1 ? [u + 1, w, SEA] : u === u0 ? [u - 1, w, LAND] : w === w0 ? [u, w - 1, PORT] : [u, w + 1, STAR]);
    for (let u = u0; u <= u1; u++) for (let w = w0; w <= w1; w++) {
      if (!edge(u, w)) continue;
      const corner = (u === u0 || u === u1) && (w === w0 || w === w1);
      const [ou, ow, face] = out(u, w);
      if (skirt && !corner && !open(u, w, from) && !c.has(ou, ow, 1)) c.stair(ou, ow, from, skirt, face === SEA ? LAND : face === LAND ? SEA : face === PORT ? STAR : PORT);
      if (sill && s.window && !corner) for (const y of s.winY ?? [2]) {
        if (midBay(u, w) && !isPost(u, w) && !open(u, w, y) && !c.has(ou, ow, y - 1)) c.put(ou, ow, y - 1, sill, { half: "top" });
      }
    }
  }
  if (s.beam) {
    for (let u = u0; u <= u1; u++) for (const w of [w0, w1]) c.log(u, w, H + 1, s.beam, "z_along_u");
    for (let w = w0 + 1; w < w1; w++) for (const u of [u0, u1]) c.log(u, w, H + 1, s.beam, "along_w");
  }
  if (s.door && s.lintel) for (let w = -(s.door.w >> 1); w <= (s.door.w >> 1); w++) c.log(u1, w, from + s.door.h, s.lintel, "along_w");
  return { u0, u1, w0, w1, top: H + (s.beam ? 1 : 0) };
}

// ---------------------------------------------------------------- furnishings

/** A fire with seats around it: the gathering place where the crew eats, plans and tells stories. */
export function hearth(c, u, w, { fire = "minecraft:campfire", seat, kind = "stair", ring = null }) {
  c.put(u, w, 1, fire);
  if (ring) for (const [du, dw] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.slab(u + du, w + dw, 1, ring);
  for (const [du, dw, face] of [[0, 2, STAR], [0, -2, PORT], [2, 0, SEA], [-2, 0, LAND]]) {
    if (kind === "stair") c.stair(u + du, w + dw, 1, seat, face);
    else if (kind === "slab") c.slab(u + du, w + dw, 1, seat);
    else c.log(u + du, w + dw, 1, seat, du === 0 ? "z_along_u" : "along_w");
  }
}
/** A table (a fence leg under a slab top), with stools either side. */
export function table(c, u, w, { leg, top, seat = null }) {
  c.put(u, w, 1, leg);
  c.slab(u, w, 2, top);
  if (seat) { c.stair(u, w - 1, 1, seat, PORT); c.stair(u, w + 1, 1, seat, STAR); }
}
/** A lantern on a post (stands anywhere, no ceiling needed). */
export function lampPost(c, u, w, post, light = "minecraft:lantern", h = 2) {
  for (let y = 1; y <= h; y++) c.put(u, w, y, post);
  c.put(u, w, h + 1, light);
}
/** A lantern hanging under something solid. */
export const hang = (c, u, w, dy, light = "minecraft:lantern") => c.put(u, w, dy, light, { hanging: true });
/** A drying rack: two posts with a rail of trapdoors laid flat across the top. */
export function rack(c, u, w0, w1, post, rail, h = 3) {
  for (const w of [w0, w1]) for (let y = 1; y < h; y++) c.put(u, w, y, post);
  for (let w = w0; w <= w1; w++) c.put(u, w, h, rail, { half: "top" });
}
/** A ladder against the wall behind it (it faces `face`). */
export const ladder = (c, u, w, y0, y1, face, backing = null) => {
  // backing: a solid block set behind each rung (a ladder must hang on something solid, never glass)
  const [du, dw] = { sea: [1, 0], land: [-1, 0], star: [0, 1], port: [0, -1] }[face];
  for (let y = y0; y <= y1; y++) {
    c.put(u, w, y, "minecraft:ladder", { facing: face });
    if (backing) c.put(u - du, w - dw, y, backing);
  }
};

/** The deck every yard has beside its dock: a working floor whose front edge meets the walkway. */
export function deck(c, { L = 5, h = 3, floor, edge = null }) {
  c.floor(-(L - 1), 0, -h, h, floor);
  if (edge) for (let w = -h; w <= h; w++) c.slab(0, w, 0, edge, true);
  c.clear(-(L - 1), 0, -h, h, 1, 6);
  c.mark("table", 0, 0, 1);                               // the Shipwright's Table: front edge, looking over the dock
  return { u0: -(L - 1), w0: -h, w1: h };
}

// ---------------------------------------------------------------- the traditions
//
// Each yard: a workshop behind the dock (main), a home on the port side, and a gathering deck on
// the starboard side where the Shipwright's Table moves once the yard is built. Each returns a
// line per building for the menu.

const B = (id) => `minecraft:${id}`;

export const ARCH = {
  // ------------------------------------------------------------ Norse
  naust(main, home, side) {
    // The naust: a boathouse with drystone walls and a steep turf roof, gable to the sea, open for
    // the boat; oars racked on the wall, the smith's corner at the back, sails stowed in the loft.
    const n = hall(main, { L: 9, h: 3, H: 4, floor: B("spruce_planks"), base: B("cobblestone"), baseH: 2,
      post: B("spruce_log"), bay: 4, beam: B("stripped_spruce_log"), wall: B("spruce_planks"),
      open: (u, w) => u === 0 && Math.abs(w) <= 2 });
    for (let u = n.u0; u <= n.u1; u++) for (const w of [n.w0, n.w1]) if ((u + w) % 3 === 0) main.put(u, w, 1, B("mossy_cobblestone"));
    const top = gableRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: 6, stair: B("spruce_stairs"), full: B("spruce_planks"),
      slab: B("spruce_slab"), pitch: 2, eave: 1, ends: 1, gable: B("stripped_spruce_log"),
      course: (k) => (k <= 1 ? { stair: null, full: B("moss_block") } : {}) });
    for (const u of [n.u1 + 1, n.u0 - 1]) {                                                    // crossed barge boards
      main.stair(u, -1, top, B("spruce_stairs"), PORT); main.stair(u, 1, top, B("spruce_stairs"), STAR);
      main.log(u, 0, top + 1, B("spruce_fence"));
    }
    for (let u = n.u0 + 1; u <= -2; u += 2) main.put(u, n.w0 + 1, 1, B("spruce_fence")), main.put(u, n.w0 + 1, 2, B("spruce_fence"));     // oar rack
    main.put(n.u0 + 1, n.w1 - 1, 1, B("smithing_table"));
    main.put(n.u0 + 1, n.w1 - 2, 1, B("grindstone"));
    main.put(n.u0 + 2, n.w1 - 1, 1, B("crafting_table"));
    main.put(-2, n.w1 - 1, 1, B("barrel")); main.put(-2, n.w1 - 1, 2, B("barrel")); main.put(-3, n.w1 - 1, 1, B("chest"));
    main.box(n.u0 + 1, n.u0 + 3, n.w0 + 1, n.w1 - 1, 4, 4, B("spruce_slab"), { half: "top" });                  // the sail loft
    for (let w = n.w0 + 1; w <= n.w1 - 1; w += 2) main.log(n.u0 + 1, w, 5, B("hay_block"), "along_w");
    ladder(main, n.u0 + 4, n.w0 + 1, 1, 4, SEA, B("spruce_planks"));   // (its backing post carries the loft's edge)
    hang(main, n.u0 + 2, 0, 3); hang(main, n.u0 + 3, n.w1 - 1, 3);

    // The longhouse: long and low under turf, its long side to the dock, a long hearth down the
    // middle under a smoke hole, sleeping benches along the walls, the loom by the door.
    const lh = hall(home, { L: 7, h: 5, H: 3, floor: B("packed_mud"), base: B("mossy_cobblestone"), baseH: 1,
      post: B("spruce_log"), bay: 3, wall: B("spruce_planks"), door: { w: 1, h: 2 }, lintel: B("stripped_spruce_log"),
      window: B("spruce_trapdoor"), winY: [2] });
    const rTop = gableRoofAcross(home, { u0: lh.u0, u1: lh.u1, w0: lh.w0, w1: lh.w1, dy: 4, stair: B("spruce_stairs"), full: B("spruce_planks"),
      slab: B("spruce_slab"), pitch: 1, eave: 1, ends: 1, gable: B("spruce_planks"),
      course: (k) => (k <= 2 ? { stair: null, full: B("moss_block") } : {}) });
    const mid = (lh.u0 + lh.u1) >> 1;
    for (let w = -2; w <= 2; w++) home.slab(mid, w, 1, B("cobblestone_slab"));
    home.put(mid, 0, 1, B("campfire"));
    home.remove(mid, 0, rTop);                                                          // the smoke hole
    for (let w = lh.w0 + 1; w <= lh.w1 - 1; w++) {
      home.slab(lh.u0 + 1, w, 1, B("spruce_slab"), true);
      home.put(lh.u0 + 1, w, 2, w % 2 ? B("white_carpet") : B("brown_carpet"));
    }
    home.put(-1, lh.w0 + 1, 1, B("loom")); home.put(-1, lh.w1 - 1, 1, B("barrel")); home.put(-2, lh.w1 - 1, 1, B("cauldron"));
    home.put(mid, lh.w0 + 1, 1, B("chest"));
    home.put(lh.u0 + 1, lh.w1 - 1, 2, B("lantern")); home.put(lh.u0 + 1, lh.w0 + 1, 2, B("lantern"));

    // The longfire on the quay: benches round a fire, a woodpile, stockfish drying.
    const d = deck(side, { L: 6, h: 3, floor: B("spruce_planks"), edge: B("dark_oak_slab") });
    hearth(side, -3, 0, { seat: B("spruce_stairs"), ring: B("cobblestone_slab") });
    for (let w = d.w0; w <= d.w0 + 1; w++) for (let y = 1; y <= 2; y++) side.log(d.u0, w, y, B("spruce_log"), "z_along_u");
    rack(side, d.u0, 1, d.w1, B("spruce_fence"), B("spruce_trapdoor"));
    side.put(-1, d.w1, 1, B("barrel")); side.put(-1, d.w0, 1, B("barrel"));
    lampPost(side, 0, d.w0, B("spruce_fence")); lampPost(side, 0, d.w1, B("spruce_fence"));
    return ["naust: boathouse with a turf roof, oar rack, smith's corner and sail loft",
      "longhouse with a long hearth, sleeping benches and a loom", "longfire deck with benches, woodpile and stockfish racks"];
  },

  // ------------------------------------------------------------ Hanseatic
  warehouse(main, home, side) {
    // A tall timber-framed warehouse, gable to the wharf: cart door below, loading doors stacked
    // above under a hoist beam; the merchant's charts and ledger by the door, goods stacked within.
    const n = hall(main, { L: 8, h: 3, H: 8, floor: B("oak_planks"), base: B("stone_bricks"), baseH: 1,
      post: B("dark_oak_log"), bay: 2, wall: B("calcite"), window: B("glass_pane"), winY: [2, 6],
      door: { w: 3, h: 3 }, lintel: B("dark_oak_log"), open: (u, w, y) => u === 0 && w === 0 && (y === 5 || y === 6) });
    for (const y of [4, 8]) {                                                              // floor beams show on the walls
      for (let u = n.u0; u <= n.u1; u++) for (const w of [n.w0, n.w1]) main.log(u, w, y, B("dark_oak_log"), "z_along_u");
      for (let w = n.w0; w <= n.w1; w++) for (const u of [n.u0, n.u1]) if (!(u === 0 && w === 0 && y === 8)) main.log(u, w, y, B("dark_oak_log"), "along_w");
    }
    const top = gableRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: 9, stair: B("dark_oak_stairs"), full: B("dark_oak_planks"),
      slab: B("dark_oak_slab"), pitch: 2, eave: 1, ends: 1, gable: B("calcite") });
    main.log(1, 0, top - 2, B("dark_oak_log"), "z_along_u"); main.log(2, 0, top - 2, B("dark_oak_log"), "z_along_u");   // hoist beam
    main.put(2, 0, top - 3, B("dark_oak_fence")); hang(main, 2, 0, top - 4);
    main.box(n.u0 + 1, -1, n.w0 + 1, n.w1 - 1, 4, 4, B("oak_slab"), { half: "top" });                    // the upper floor
    ladder(main, n.u0 + 1, n.w0 + 1, 1, 5, SEA, B("dark_oak_planks")); main.remove(n.u0 + 1, n.w0 + 1, 4); main.put(n.u0 + 1, n.w0 + 1, 4, B("ladder"), { facing: SEA });
    for (let u = n.u0 + 1; u <= -3; u++) { main.put(u, n.w1 - 1, 1, B("barrel")); if (u % 2) main.put(u, n.w1 - 1, 2, B("barrel")); }
    main.put(-1, n.w0 + 1, 1, B("cartography_table")); main.put(-2, n.w0 + 1, 1, B("lectern"));
    main.put(n.u0 + 2, 0, 1, B("chest")); main.put(n.u0 + 2, 1, 1, B("chest"));
    for (let u = n.u0 + 2; u <= -2; u += 2) for (let w = n.w0 + 1; w <= n.w1 - 1; w += 2) main.put(u, w, 5, B("brown_wool"));   // sacks upstairs
    hang(main, -2, 0, 3); hang(main, n.u0 + 3, 0, 3);

    // A town house with its upper storey jettied over the street, a brick chimney, the kitchen below.
    const lo = hall(home, { L: 6, h: 2, H: 3, floor: B("oak_planks"), wall: B("brick_block"), post: B("dark_oak_log"), bay: 4,
      door: { w: 1, h: 2 }, lintel: B("dark_oak_log"), window: B("glass_pane"), winY: [2] });
    const up = home.place(1, 0, 0);                                                       // one block out over the street
    up.box(-(6), 0, -2, 2, 4, 4, B("dark_oak_planks"));
    for (let w = -2; w <= 2; w++) up.stair(0, w, 3, B("dark_oak_stairs"), LAND, true);     // the jetty's brackets
    hall(up, { L: 7, h: 2, H: 6, from: 5, post: B("dark_oak_log"), bay: 2, wall: B("calcite"), window: B("glass_pane"), winY: [5] });
    const t2 = gableRoof(up, { u0: -6, u1: 0, w0: -2, w1: 2, dy: 7, stair: B("dark_oak_stairs"), full: B("dark_oak_planks"), slab: B("dark_oak_slab"),
      pitch: 2, eave: 1, ends: 1, gable: B("calcite") });
    for (let y = 1; y <= t2 + 1; y++) home.put(lo.u0, lo.w1 + 1, y, B("brick_block"));           // the chimney, smoking
    home.put(lo.u0, lo.w1 + 1, t2 + 2, B("campfire"));
    home.put(lo.u0 + 1, lo.w1 - 1, 1, B("smoker")); home.put(lo.u0 + 1, lo.w0 + 1, 1, B("barrel"));
    table(home, -2, 0, { leg: B("oak_fence"), top: B("oak_slab"), seat: B("oak_stairs") });
    home.put(-2, 0, 3, B("lantern"));
    home.put(lo.u0 + 1, 0, 1, B("bookshelf")); home.put(-1, lo.w1 - 1, 1, B("flower_pot"));
    for (let w = -1; w <= 1; w++) home.put(-4, w, 5, B("red_carpet"));
    home.put(-5, 1, 5, B("chest"));
    ladder(home, -1, -1, 1, 4, STAR, B("dark_oak_planks")); home.remove(-1, -1, 4); home.put(-1, -1, 4, B("ladder"), { facing: STAR });   // up to the bedroom

    // The quay: trestle tables and benches, a market stall under a striped awning, the bell.
    const d = deck(side, { L: 6, h: 3, floor: B("oak_planks"), edge: B("stone_brick_slab") });
    for (const w of [-2, 2]) table(side, -2, w, { leg: B("oak_fence"), top: B("oak_slab") }), side.stair(-3, w, 1, B("oak_stairs"), LAND), side.stair(-1, w, 1, B("oak_stairs"), SEA);
    for (const [u, w] of [[d.u0, -3], [d.u0, -1], [-3, -3], [-3, -1]]) for (let y = 1; y <= 3; y++) side.put(u, w, y, B("oak_fence"));
    for (let u = d.u0; u <= -3; u++) for (let w = -3; w <= -1; w++) side.put(u, w, 4, (w + u) % 2 ? B("red_wool") : B("white_wool"));
    side.put(d.u0, -2, 1, B("barrel")); side.put(-4, -2, 1, B("barrel"));
    side.put(d.u0, 2, 1, B("bell"));
    lampPost(side, 0, d.w0, B("oak_fence")); lampPost(side, 0, d.w1, B("oak_fence"));
    return ["timber-framed warehouse with a hoist, the merchant's charts and ledger", "jettied town house with a brick chimney and kitchen",
      "quay with trestle tables, a striped market stall and the bell"];
  },

  // ------------------------------------------------------------ Birchbark (Anishinaabe)
  canoe_house(main, home, side) {
    // The canoe-building house: lashed poles under bark, open to the air; the staked building bed
    // in the sand, bark rolls and cedar laid ready, the pitch pot over its fire.
    const n = hall(main, { L: 9, h: 3, H: 3, floor: B("sand"), post: B("birch_fence"), bay: 2, open: () => true });
    gableRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: 4, stair: B("birch_stairs"), full: B("stripped_birch_log"),
      slab: B("birch_slab"), pitch: 1, eave: 1, ends: 0, course: (k) => (k === 0 ? { stair: null, full: B("birch_log"), axis: "z_along_u" } : {}) });
    const mid = (n.u0 + n.u1) >> 1;
    for (let u = n.u0 + 1; u <= n.u1 - 1; u++) {
      const half = Math.abs(u - mid) >= 3 ? 1 : 2;
      for (const w of [-half, half]) main.put(u, w, 1, B("birch_fence"));
    }
    main.log(n.u0 + 1, n.w0 + 1, 1, B("birch_log"), "z_along_u"); main.log(n.u0 + 2, n.w0 + 1, 1, B("birch_log"), "z_along_u");
    main.log(n.u0 + 1, n.w1 - 1, 1, B("stripped_spruce_log"), "z_along_u");
    main.put(-1, n.w1 - 1, 1, B("fletching_table"));
    main.put(n.u0 + 1, 0, 1, B("campfire")); main.put(n.u0 + 1, 0, 2, B("cauldron"));

    // The wiigiwaam: bent poles under bark, round, a fire in the middle under the smoke hole,
    // mats for sleeping round the walls.
    const cu = -3;
    home.floor(-6, 0, -3, 3, B("podzol"));
    dome(home, { cu, cw: 0, r: 3, walls: B("birch_log"), wallH: 2, roof: B("stripped_birch_log"), steps: [2.5, 1.5, 0.5],
      door: (u, w) => u >= cu + 2 && w === 0 });
    home.put(cu, 0, 1, B("campfire"));
    for (const [u, w] of [[cu - 2, -1], [cu - 2, 0], [cu - 2, 1], [cu - 1, -2], [cu - 1, 2], [cu, -2], [cu, 2]]) home.put(u, w, 1, (u + w) % 2 ? B("white_carpet") : B("brown_carpet"));
    home.put(cu + 1, -2, 1, B("decorated_pot")); home.put(cu + 1, 2, 1, B("barrel"));

    // The fire circle on the quay, with log seats, a cookpot, drying racks: where the elders teach.
    const d = deck(side, { L: 6, h: 3, floor: B("coarse_dirt"), edge: B("birch_slab") });
    hearth(side, -3, 0, { seat: B("stripped_birch_log"), kind: "log" });
    rack(side, d.u0, d.w0, d.w0 + 2, B("birch_fence"), B("birch_trapdoor"));
    side.put(d.u0, d.w1, 1, B("campfire")); side.put(d.u0, d.w1, 2, B("cauldron"));
    lampPost(side, 0, d.w0, B("birch_fence"), B("torch")); lampPost(side, 0, d.w1, B("birch_fence"), B("torch"));
    return ["canoe-building house of poles and bark over the staked bed", "wiigiwaam with a central fire and sleeping mats",
      "fire circle with log seats, cookpot and drying racks"];
  },

  // ------------------------------------------------------------ Pacific (Hawaiian)
  halau(main, home, side) {
    // The halau wa'a: an open-sided canoe house, posts on a stone platform under a steep thatch that
    // comes down low; mats in its shade, paddles racked, gourds of water by the posts.
    const n = hall(main, { L: 9, h: 3, H: 2, floor: B("cobblestone"), post: B("stripped_jungle_log"), bay: 2, open: () => true });
    main.ring(n.u0 - 1, n.u1 + 1, n.w0 - 1, n.w1 + 1, 0, 0, B("mossy_cobblestone"));
    main.addFloor({ u0: n.u0 - 1, u1: n.u1 + 1, w0: n.w0 - 1, w1: n.w1 + 1 });
    gableRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: 3, stair: null, full: B("hay_block"), pitch: 2, eave: 1, ends: 1,
      course: () => ({ stair: null, full: B("hay_block"), axis: "z_along_u" }) });
    for (const u of [n.u0, n.u1]) for (let y = 1; y <= 8; y++) main.log(u, 0, y, B("stripped_jungle_log"));
    for (let u = n.u0 + 1; u <= n.u1 - 1; u++) for (const w of [n.w0 + 1, n.w1 - 1]) main.put(u, w, 1, (u % 2) ? B("yellow_carpet") : B("brown_carpet"));
    for (let u = n.u0 + 1; u <= n.u0 + 3; u++) main.put(u, 0, 1, B("bamboo_fence"));
    main.put(-1, n.w0 + 1, 1, B("decorated_pot")); main.put(-1, n.w1 - 1, 1, B("barrel"));

    // A hale: thatched walls and roof on a stone platform, one low door, mats and gourds within.
    const h1 = hall(home, { L: 6, h: 2, H: 2, floor: B("cobblestone"), post: B("stripped_jungle_log"), bay: 5, wall: B("hay_block"),
      door: { w: 1, h: 2 } });
    home.ring(h1.u0 - 1, h1.u1 + 1, h1.w0 - 1, h1.w1 + 1, 0, 0, B("mossy_cobblestone"));
    home.addFloor({ u0: h1.u0 - 1, u1: h1.u1 + 1, w0: h1.w0 - 1, w1: h1.w1 + 1 });
    gableRoof(home, { u0: h1.u0, u1: h1.u1, w0: h1.w0, w1: h1.w1, dy: 3, stair: null, full: B("hay_block"), pitch: 2, eave: 1, ends: 1,
      gable: B("hay_block"), course: () => ({ stair: null, full: B("hay_block"), axis: "z_along_u" }) });
    for (let u = h1.u0 + 1; u <= -1; u++) for (let w = -1; w <= 1; w++) home.put(u, w, 1, (u + w) % 2 ? B("yellow_carpet") : B("brown_carpet"));
    home.put(h1.u0 + 1, -1, 1, B("decorated_pot")); home.put(h1.u0 + 1, 1, 1, B("candle"), { lit: true });

    // The quay: a leaf shade on poles over mats, a fire pit with stone seats, fish drying.
    const d = deck(side, { L: 6, h: 3, floor: B("sandstone"), edge: B("bamboo_mosaic_slab") });
    for (const [u, w] of [[-1, d.w0], [-1, d.w1], [d.u0, d.w0], [d.u0, d.w1]]) for (let y = 1; y <= 3; y++) side.put(u, w, y, B("bamboo_fence"));
    for (let u = d.u0; u <= -1; u++) for (let w = d.w0; w <= d.w1; w++) side.put(u, w, 4, B("jungle_leaves"), { persistent: true });
    hearth(side, -3, 0, { seat: B("smooth_stone_slab"), kind: "slab" });
    for (let u = d.u0 + 1; u <= -2; u++) side.put(u, d.w0 + 1, 1, B("yellow_carpet"));
    rack(side, d.u0, 1, d.w1 - 1, B("bamboo_fence"), B("bamboo_trapdoor"));
    lampPost(side, 0, d.w0, B("bamboo_fence"), B("torch")); lampPost(side, 0, d.w1, B("bamboo_fence"), B("torch"));
    return ["open-sided thatched canoe house on a stone platform", "thatched hale with mats and gourds", "leaf shade over mats, a fire pit and fish racks"];
  },

  // ------------------------------------------------------------ Indian Ocean (Omani and Swahili coasts)
  coral_store(main, home, side) {
    // A two-storey coral-stone storehouse with a flat roof and crenellated parapet: rope and sailcloth
    // within, the sailmaker's loom and the navigator's charts, latticed windows.
    const n = hall(main, { L: 8, h: 3, H: 7, floor: B("smooth_sandstone"), wall: B("sandstone"), post: B("cut_sandstone"), bay: 7,
      window: B("acacia_fence"), winY: [2, 5, 6], door: { w: 3, h: 3 }, lintel: B("stripped_acacia_log") });
    for (let u = n.u0; u <= n.u1; u++) for (const w of [n.w0, n.w1]) main.put(u, w, 4, B("cut_sandstone"));
    for (let w = n.w0; w <= n.w1; w++) for (const u of [n.u0, n.u1]) if (!(u === 0 && Math.abs(w) <= 1)) main.put(u, w, 4, B("cut_sandstone"));
    for (const w of [-2, 2]) for (let y = 1; y <= 4; y++) main.log(0, w, y, B("stripped_acacia_log"));               // the carved door frame, plain
    flatRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: 8, block: B("smooth_sandstone"), parapet: B("sandstone_wall"), cap: B("chiseled_sandstone"), crenel: true });
    main.box(n.u0 + 1, -1, n.w0 + 1, n.w1 - 1, 4, 4, B("smooth_sandstone_slab"), { half: "top" });
    ladder(main, n.u0 + 1, n.w0 + 1, 1, 4, SEA, B("sandstone")); ladder(main, n.u0 + 1, n.w0 + 1, 5, 8, SEA, B("sandstone")); main.remove(n.u0 + 1, n.w0 + 1, 8);
    main.put(n.u0 + 1, n.w0 + 1, 8, B("ladder"), { facing: SEA });
    main.put(-1, n.w1 - 1, 1, B("loom")); main.put(-2, n.w1 - 1, 1, B("cartography_table"));
    for (let u = n.u0 + 2; u <= -3; u++) main.put(u, n.w1 - 1, 1, B("barrel"));
    for (let u = n.u0 + 2; u <= -2; u++) for (let w = -1; w <= 1; w++) main.put(u, w, 1, (u + w) % 3 ? B("red_carpet") : B("orange_carpet"));
    hang(main, -2, 0, 3); hang(main, n.u0 + 3, 0, 3);
    for (let u = n.u0 + 1; u <= -2; u += 2) main.put(u, n.w1 - 1, 5, B("white_wool"));                          // sailcloth upstairs

    // A stone house with a baraza: stone benches either side of the door, where neighbours sit
    // and talk in the evening; a flat roof, carpets and a lamp within.
    const h1 = hall(home, { L: 6, h: 3, H: 4, floor: B("smooth_sandstone"), wall: B("smooth_sandstone"), post: B("cut_sandstone"), bay: 6,
      window: B("acacia_fence"), winY: [2, 3], door: { w: 1, h: 3 }, lintel: B("stripped_acacia_log") });
    for (const w of [-3, -2, 2, 3]) home.stair(1, w, 1, B("smooth_sandstone_stairs"), LAND);                 // the baraza
    home.floor(1, 1, -3, 3, B("sandstone"));
    flatRoof(home, { u0: h1.u0, u1: h1.u1, w0: h1.w0, w1: h1.w1, dy: 5, block: B("smooth_sandstone"), parapet: B("sandstone_wall"), cap: B("chiseled_sandstone") });
    for (let u = h1.u0 + 1; u <= -1; u++) for (let w = -2; w <= 2; w++) home.put(u, w, 1, (u + w) % 2 ? B("red_carpet") : B("orange_carpet"));
    home.put(h1.u0 + 1, -2, 1, B("decorated_pot")); home.put(h1.u0 + 1, 2, 1, B("chest"));
    hang(home, -2, 0, 4); hang(home, h1.u0 + 2, 0, 4);

    // The arish: acacia poles under palm fronds, a majlis of carpets and cushions, the coffee pot.
    const d = deck(side, { L: 6, h: 3, floor: B("sandstone"), edge: B("cut_sandstone_slab") });
    for (const [u, w] of [[-1, d.w0], [-1, d.w1], [d.u0, d.w0], [d.u0, d.w1], [-3, d.w0], [-3, d.w1]]) for (let y = 1; y <= 3; y++) side.put(u, w, y, B("acacia_fence"));
    for (let u = d.u0; u <= -1; u++) for (let w = d.w0; w <= d.w1; w++) side.put(u, w, 4, B("jungle_leaves"), { persistent: true });
    for (let u = d.u0 + 1; u <= -2; u++) for (let w = d.w0 + 1; w <= d.w1 - 1; w++) side.put(u, w, 1, (u + w) % 3 ? B("red_carpet") : B("orange_carpet"));
    for (let u = d.u0 + 1; u <= -2; u++) { side.stair(u, d.w0, 1, B("red_sandstone_stairs"), PORT); side.stair(u, d.w1, 1, B("red_sandstone_stairs"), STAR); }
    side.put(-3, 0, 1, B("decorated_pot"));
    hang(side, -3, 0, 3);
    return ["two-storey coral-stone storehouse with latticed windows, loom and charts", "stone house with a baraza bench by the door",
      "arish of palm fronds over a majlis of carpets and cushions"];
  },

  // ------------------------------------------------------------ East Asian (southern Chinese)
  tile_shed(main, home, side) {
    // A white-walled workshop under a grey-tiled roof whose corners turn up, lattice windows,
    // bamboo scaffolding inside for the hull's upper works, the mason's and carpenter's benches.
    const n = hall(main, { L: 8, h: 3, H: 4, floor: B("stone_bricks"), base: B("stone_bricks"), baseH: 1, post: B("dark_oak_log"), bay: 2,
      wall: B("white_concrete"), window: B("dark_oak_fence"), winY: [2, 3], door: { w: 3, h: 3 } });
    for (let u = n.u0; u <= n.u1; u++) for (const w of [n.w0 - 1, n.w1 + 1]) main.stair(u, w, 4, B("dark_oak_stairs"), w < 0 ? STAR : PORT, true);
    const top = gableRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: 5, stair: B("deepslate_tile_stairs"), full: B("deepslate_tiles"),
      slab: B("deepslate_tile_slab"), pitch: 1, eave: 2, ends: 1, curve: true, upturn: true, gable: B("white_concrete") });
    for (const u of [n.u0 - 1, n.u1 + 1]) main.stair(u, 0, top + 1, B("deepslate_tile_stairs"), u < 0 ? SEA : LAND);    // the ridge ends lift
    for (let u = n.u0 + 1; u <= -2; u += 2) for (let y = 1; y <= 3; y++) main.put(u, n.w0 + 1, y, B("scaffolding"));
    main.put(-1, n.w1 - 1, 1, B("stonecutter_block")); main.put(-2, n.w1 - 1, 1, B("crafting_table")); main.put(-3, n.w1 - 1, 1, B("barrel"));
    main.put(n.u0 + 1, n.w1 - 1, 1, B("barrel")); main.put(n.u0 + 1, n.w1 - 1, 2, B("barrel"));
    main.put(1, -2, 4, B("lantern"), { hanging: true }); main.put(1, 2, 4, B("lantern"), { hanging: true });

    // A grey-brick house with stepped gable walls rising above its tiled roof, a lattice door, the
    // tea table within.
    const h1 = hall(home, { L: 6, h: 3, H: 4, floor: B("stone_bricks"), wall: B("polished_andesite"), post: B("polished_andesite"), bay: 6,
      window: B("dark_oak_fence"), winY: [2, 3], door: { w: 1, h: 3 }, lintel: B("dark_oak_log") });
    const t = gableRoof(home, { u0: h1.u0, u1: h1.u1, w0: h1.w0, w1: h1.w1, dy: 5, stair: B("deepslate_tile_stairs"), full: B("deepslate_tiles"),
      slab: B("deepslate_tile_slab"), pitch: 1, eave: 1, ends: 0, curve: true, gable: B("polished_andesite") });
    for (const u of [h1.u0, h1.u1]) for (let w = -3; w <= 3; w++) {                                       // stepped gables
      const hh = 5 + Math.min(3 - Math.abs(w), 3);
      for (let y = 5; y <= hh; y++) home.put(u, w, y, B("white_concrete"));
      home.slab(u, w, hh + 1, B("deepslate_tile_slab"));
    }
    void t;
    table(home, -3, 0, { leg: B("dark_oak_fence"), top: B("dark_oak_slab"), seat: B("dark_oak_stairs") });
    home.put(-3, 0, 3, B("lantern"));
    home.put(h1.u0 + 1, -2, 1, B("bookshelf")); home.put(h1.u0 + 1, 2, 1, B("barrel")); home.put(-1, 2, 1, B("decorated_pot"));

    // The tea stall: a tiled awning on posts over tables and stools, lanterns, barrels of tea.
    const d = deck(side, { L: 6, h: 3, floor: B("stone_bricks"), edge: B("bamboo_slab") });
    for (const [u, w] of [[-1, d.w0], [-1, d.w1], [d.u0, d.w0], [d.u0, d.w1]]) for (let y = 1; y <= 3; y++) side.put(u, w, y, B("dark_oak_fence"));
    for (let u = d.u0; u <= -1; u++) for (let w = d.w0; w <= d.w1; w++) side.slab(u, w, 4, B("deepslate_tile_slab"));
    for (const w of [-2, 1]) table(side, -3, w, { leg: B("bamboo_fence"), top: B("bamboo_slab") }), side.slab(-2, w, 1, B("bamboo_slab")), side.slab(-4, w, 1, B("bamboo_slab"));
    hang(side, -2, 0, 3); hang(side, d.u0 + 1, 0, 3);
    side.put(d.u0, 0, 1, B("barrel"));
    side.put(d.u0, d.w1 - 1, 1, B("campfire")); side.put(d.u0, d.w1 - 1, 2, B("cauldron"));          // the kettle on its stove
    return ["white-walled workshop under an upturned tiled roof, with scaffolding and benches", "grey-brick house with stepped gables and a tea table",
      "tea stall under a tiled awning"];
  },

  // ------------------------------------------------------------ Japanese (Ine funaya)
  funaya(main, home, side) {
    // The funaya: the boat bay open to the water below; above, the net loft behind a balcony and
    // paper windows, under a grey-tiled roof with its gable to the sea.
    const n = hall(main, { L: 8, h: 3, H: 7, floor: B("stone"), post: B("spruce_log"), bay: 2, wall: B("spruce_planks"),
      window: B("white_stained_glass_pane"), winY: [6], open: (u, w, y) => u === 0 && Math.abs(w) <= 2 && (y <= 3 || y === 5 || y === 6) });
    for (let u = n.u0; u <= n.u1; u++) for (const w of [n.w0, n.w1]) main.log(u, w, 4, B("spruce_log"), "z_along_u");
    main.box(n.u0 + 1, -1, n.w0 + 1, n.w1 - 1, 4, 4, B("spruce_slab"), { half: "top" });
    for (let w = n.w0; w <= n.w1; w++) { main.slab(1, w, 4, B("spruce_slab"), true); main.put(1, w, 5, B("spruce_fence")); }   // balcony
    for (let w = -2; w <= 2; w++) for (const y of [5, 6]) main.put(0, w, y, B("white_stained_glass_pane"));
    main.remove(0, 0, 5); main.remove(0, 0, 6);
    gableRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: 8, stair: B("deepslate_tile_stairs"), full: B("deepslate_tiles"),
      slab: B("deepslate_tile_slab"), pitch: 1, eave: 1, ends: 2, curve: true, gable: B("spruce_planks") });
    ladder(main, n.u0 + 1, n.w0 + 1, 1, 4, SEA, B("spruce_planks")); main.remove(n.u0 + 1, n.w0 + 1, 4); main.put(n.u0 + 1, n.w0 + 1, 4, B("ladder"), { facing: SEA });
    for (let u = n.u0 + 2; u <= -2; u += 2) for (let y = 1; y <= 2; y++) main.put(u, n.w1 - 1, y, B("spruce_fence"));   // net racks
    main.put(n.u0 + 1, n.w1 - 1, 1, B("barrel")); main.put(n.u0 + 2, n.w1 - 1, 1, B("barrel"));
    hang(main, -2, 0, 3); hang(main, n.u0 + 3, 0, 3);
    for (let u = n.u0 + 2; u <= -1; u++) for (let w = -1; w <= 1; w++) main.put(u, w, 5, B("yellow_carpet"));       // tatami in the loft

    // A house with an engawa veranda, paper windows, and a sunken hearth (irori) in the floor,
    // where the family sits round the fire.
    const h1 = hall(home, { L: 6, h: 3, H: 4, floor: B("spruce_planks"), post: B("dark_oak_log"), bay: 2, wall: B("spruce_planks"),
      window: B("white_stained_glass_pane"), winY: [2, 3], door: { w: 1, h: 3 } });
    for (let w = -3; w <= 3; w++) home.slab(1, w, 1, B("spruce_slab"));                                  // the engawa
    home.floor(1, 1, -3, 3, B("stone"));
    gableRoof(home, { u0: h1.u0, u1: h1.u1, w0: h1.w0, w1: h1.w1, dy: 5, stair: B("deepslate_tile_stairs"), full: B("deepslate_tiles"),
      slab: B("deepslate_tile_slab"), pitch: 1, eave: 2, ends: 1, curve: true, gable: B("spruce_planks") });
    const ic = -3;
    home.put(ic, 0, 0, B("campfire"));                                                                  // the irori, sunk in the floor
    for (let u = h1.u0 + 1; u <= -1; u++) for (let w = -2; w <= 2; w++) if (!(u === ic && w === 0)) home.put(u, w, 1, B("yellow_carpet"));
    home.put(h1.u0 + 1, 2, 1, B("chest")); home.put(h1.u0 + 1, -2, 1, B("lantern"));

    // The veranda: a long bench, net racks, barrels.
    const d = deck(side, { L: 5, h: 3, floor: B("spruce_planks"), edge: B("polished_andesite_slab") });
    for (let w = d.w0; w <= d.w1; w++) side.slab(d.u0, w, 1, B("spruce_slab"));
    rack(side, -2, d.w0, d.w0 + 2, B("spruce_fence"), B("spruce_trapdoor"));
    side.put(-2, d.w1, 1, B("barrel")); side.put(-1, d.w1, 1, B("barrel"));
    lampPost(side, 0, d.w0, B("spruce_fence")); lampPost(side, 0, d.w1, B("spruce_fence"));
    return ["two-storey funaya: boat bay below, net loft and balcony above", "house with an engawa and a sunken hearth",
      "veranda with a bench and net racks"];
  },

  // ------------------------------------------------------------ Coast Salish
  plank_house(main, home, side) {
    // The plank house: cedar planks lashed to posts under a long shed roof; inside, raised benches
    // along the walls, a fire under a moved-aside roof plank, bentwood boxes, racks of fish above.
    const n = hall(main, { L: 9, h: 4, H: 3, floor: B("spruce_planks"), post: B("stripped_dark_oak_log"), bay: 3, wall: B("spruce_planks"),
      door: { w: 1, h: 2 } });
    const roofDy = 4, eave = 1;
    shedRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: roofDy, slab: B("spruce_slab"), eave, ends: 1 });
    for (let w = n.w0; w <= n.w1; w++) {
      const ry = shedY(roofDy, n.w0, eave, w);
      for (let y = roofDy; y < ry; y++) {
        for (const u of [n.u0, n.u1]) main.put(u, w, y, B("spruce_planks"));
        if (w === n.w1) for (let u = n.u0; u <= n.u1; u++) main.put(u, w, y, B("spruce_planks"));
      }
    }
    for (let u = n.u0 - 1; u <= n.u1 + 1; u += 3) main.put(u, n.w0 + 1, shedY(roofDy, n.w0, eave, n.w0 + 1) + 1, B("cobblestone"));   // stones hold the planks
    for (let u = n.u0 + 1; u <= -1; u++) for (const w of [n.w0 + 1, n.w1 - 1]) { main.slab(u, w, 1, B("spruce_slab"), true); main.put(u, w, 2, B("brown_carpet")); }
    const mid = (n.u0 + n.u1) >> 1;
    hearth(main, mid, 0, { seat: B("stripped_spruce_log"), kind: "log", ring: B("cobblestone_slab") });
    main.remove(mid, 0, shedY(roofDy, n.w0, eave, 0));                                                     // the roof plank moved aside for smoke
    for (let u = n.u0 + 1; u <= n.u0 + 2; u++) for (const w of [-2, 2]) main.put(u, w, 1, B("barrel"));
    for (let u = n.u0 + 1; u <= -1; u++) main.put(u, n.w1 - 1, 4, B("spruce_trapdoor"), { half: "top" });

    // The smokehouse: planks and a low shed roof, racks of salmon over a smoky fire.
    const h1 = hall(home, { L: 5, h: 2, H: 3, floor: B("coarse_dirt"), post: B("stripped_dark_oak_log"), bay: 4, wall: B("spruce_planks"),
      door: { w: 1, h: 2 } });
    shedRoof(home, { u0: h1.u0, u1: h1.u1, w0: h1.w0, w1: h1.w1, dy: 4, slab: B("spruce_slab"), eave: 1, ends: 1 });
    for (let w = h1.w0; w <= h1.w1; w++) for (let y = 4; y < shedY(4, h1.w0, 1, w); y++) for (const u of [h1.u0, h1.u1]) home.put(u, w, y, B("spruce_planks"));
    home.put(-2, 0, 1, B("campfire")); home.put(h1.u0 + 1, 1, 1, B("smoker"));
    for (let u = h1.u0 + 1; u <= -1; u++) home.put(u, 0, 3, B("spruce_trapdoor"), { half: "top" });

    // The quay: fish-drying racks, a fire with log benches, paddles racked.
    const d = deck(side, { L: 6, h: 3, floor: B("coarse_dirt"), edge: B("dark_oak_slab") });
    rack(side, d.u0, d.w0, d.w1, B("spruce_fence"), B("spruce_trapdoor"));
    rack(side, d.u0 + 1, d.w0, d.w1, B("spruce_fence"), B("spruce_trapdoor"));
    hearth(side, -2, 0, { seat: B("stripped_spruce_log"), kind: "log" });
    for (const w of [d.w0, d.w1]) for (let y = 1; y <= 2; y++) side.put(-1, w, y, B("dark_oak_fence"));
    lampPost(side, 0, d.w0, B("dark_oak_fence"), B("torch")); lampPost(side, 0, d.w1, B("dark_oak_fence"), B("torch"));
    return ["cedar plank house under a shed roof: benches, central fire, bentwood boxes", "smokehouse with salmon racks over the fire",
      "fish-drying racks and a fire with log benches"];
  },

  // ------------------------------------------------------------ Shallow waters (mangrove coasts, river landings)
  stilt_house(main, home, side) {
    // A stilt house on mangrove roots under a thatched roof, a deep porch with chairs looking over the
    // water, the cookpot and smoker inside, lanterns.
    const n = { u0: -6, u1: 0, w0: -3, w1: 3 };
    for (const u of [n.u0, -3, n.u1]) for (const w of [n.w0, n.w1]) main.pile(u, w, B("mangrove_roots"));
    main.box(n.u0, n.u1, n.w0, n.w1, 1, 1, B("mangrove_planks"));
    const room = main.place(-2, 0, 0);
    hall(room, { L: 5, h: 3, H: 4, from: 2, post: B("mangrove_log"), bay: 2, wall: B("mangrove_planks"), window: B("mangrove_trapdoor"), winY: [3],
      door: { w: 1, h: 2 } });
    for (const w of [n.w0, n.w1]) for (let y = 2; y <= 4; y++) main.log(n.u1, w, y, B("mangrove_log"));
    gableRoof(main, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy: 5, stair: null, full: B("hay_block"), pitch: 1, eave: 1, ends: 1,
      course: () => ({ stair: null, full: B("hay_block"), axis: "z_along_u" }) });
    main.stair(0, n.w0 + 1, 2, B("mangrove_stairs"), LAND); main.stair(0, n.w1 - 1, 2, B("mangrove_stairs"), LAND);   // porch chairs
    main.put(-1, n.w1 - 1, 2, B("barrel")); hang(main, 0, 0, 4);
    for (let w = -1; w <= 1; w++) main.stair(1, w, 1, B("mangrove_stairs"), LAND);                                      // steps down
    main.put(-5, -2, 2, B("cauldron")); main.put(-5, -1, 2, B("campfire")); main.put(-5, 2, 2, B("smoker")); main.put(-4, 2, 2, B("barrel"));
    main.put(-4, -2, 2, B("lantern"));
    main.clear(n.u0 - 1, n.u1 + 1, n.w0 - 1, n.w1 + 1, 1, 9);

    // The net shed: a small stilt shed of bamboo, fishing gear, the bait barrels, a compost heap.
    for (const u of [-4, 0]) for (const w of [-2, 2]) home.pile(u, w, B("mangrove_roots"));
    home.box(-4, 0, -2, 2, 1, 1, B("bamboo_planks"));
    hall(home, { L: 5, h: 2, H: 3, from: 2, post: B("bamboo_block"), bay: 4, wall: B("bamboo_planks"), door: { w: 1, h: 2 } });
    gableRoof(home, { u0: -4, u1: 0, w0: -2, w1: 2, dy: 4, stair: null, full: B("hay_block"), pitch: 1, eave: 1, ends: 1,
      course: () => ({ stair: null, full: B("hay_block"), axis: "z_along_u" }) });
    home.put(-3, -1, 2, B("barrel")); home.put(-3, 1, 2, B("barrel")); home.put(-1, 1, 2, B("composter"));
    // steps up the front, sideways along it: from the path to a landing at the door
    home.stair(1, -3, 0, B("bamboo_stairs"), STAR); home.stair(1, -2, 1, B("bamboo_stairs"), STAR);
    for (let w = -1; w <= 1; w++) home.put(1, w, 1, B("bamboo_planks"));

    // The landing stage: chairs, the cookpot on its fire, lanterns on poles.
    const d = deck(side, { L: 6, h: 3, floor: B("mangrove_planks"), edge: B("mud_brick_slab") });
    side.stair(-2, d.w0, 1, B("mangrove_stairs"), PORT); side.stair(-2, d.w1, 1, B("mangrove_stairs"), STAR);
    side.put(-3, 0, 1, B("campfire")); side.put(-3, 0, 2, B("cauldron"));
    side.put(d.u0, d.w0, 1, B("barrel")); side.put(d.u0, d.w1, 1, B("barrel"));
    lampPost(side, 0, d.w0, B("mangrove_fence")); lampPost(side, 0, d.w1, B("mangrove_fence")); lampPost(side, d.u0, 0, B("mangrove_fence"));
    return ["stilt house on mangrove roots: thatched, porch with chairs, cookpot inside", "net shed of bamboo with bait barrels",
      "landing stage with chairs, cookpot and lanterns"];
  },

  // ------------------------------------------------------------ Arctic (Inuit)
  qarmaq(main, home, side) {
    // The qarmaq: a round stone-and-sod house, whalebone rafters under skins, a low entrance passage;
    // inside, the raised sleeping platform under furs and the qulliq lamps.
    const cu = -5;
    main.floor(-9, 0, -4, 4, B("gravel"));
    dome(main, { cu, cw: 0, r: 4, walls: (y) => (y === 1 ? B("mossy_cobblestone") : B("coarse_dirt")), wallH: 2,
      roof: B("brown_wool"), steps: [3.5, 2.5, 1.5, 0.5], hole: false, door: (u, w) => u >= cu + 3 && w === 0 });
    for (const [du, dw] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) main.put(cu + du, dw, 4, B("bone_block"));
    main.put(cu, 0, 6, B("bone_block"));
    for (let u = cu + 4; u <= 0; u++) for (const w of [-1, 1]) { main.put(u, w, 1, B("cobblestone")); main.put(u, w, 2, B("coarse_dirt")); }   // the passage
    for (let u = cu + 4; u <= 0; u++) main.put(u, 0, 3, B("brown_wool"));
    for (let w = -3; w <= 3; w++) for (const u of [cu - 3, cu - 2]) if (Math.hypot(u - cu, w) < 3.6) {
      main.slab(u, w, 1, B("cobblestone_slab"), true); main.put(u, w, 2, (u + w) % 2 ? B("white_carpet") : B("brown_carpet"));
    }
    main.slab(cu, -2, 1, B("cobblestone_slab")); main.put(cu, -2, 1, B("candle"), { lit: true });
    main.slab(cu, 2, 1, B("cobblestone_slab")); main.put(cu, 2, 1, B("candle"), { lit: true });
    main.put(cu + 1, 3, 1, B("decorated_pot"));
    // the rest of the floor is work: stores by the wall, the harpoon-maker's bench, the meat pot
    main.put(cu + 2, -3, 1, B("barrel")); main.put(cu + 1, -3, 1, B("chest")); main.put(cu + 2, 3, 1, B("barrel"));
    main.put(cu + 3, -2, 1, B("fletching_table")); main.put(cu + 3, 2, 1, B("cauldron"));
    main.put(cu - 1, -3, 1, B("barrel")); main.put(cu - 1, 3, 1, B("loom"));

    // The tupiq: a summer tent of skins on poles, cone-shaped, its poles crossing above the top.
    home.floor(-4, 0, -2, 2, B("gravel"));
    dome(home, { cu: -2, cw: 0, r: 2, walls: B("brown_wool"), wallH: 1, roof: B("brown_wool"), steps: [1.5, 0.5], hole: false,
      door: (u, w) => u >= 0 && w === 0 });
    home.put(-2, 0, 4, B("birch_fence")); home.put(-2, 0, 5, B("birch_fence"));
    for (const [u, w] of [[-3, 0], [-2, -1], [-2, 1]]) home.put(u, w, 1, B("white_carpet"));
    for (const [u, w] of [[-4, -2], [-4, 2], [0, -2], [0, 2]]) home.put(u, w, 1, B("cobblestone"));        // stones hold the skins

    // The racks: stone pillars carrying bone rails for the umiak and kayaks; a curved windbreak with
    // a lamp and stone seats, where people sit out of the wind together.
    const d = deck(side, { L: 7, h: 3, floor: B("gravel"), edge: B("cobblestone_slab") });
    for (const u of [-1, -3, -5]) for (const w of [-2, 2]) for (let y = 1; y <= 2; y++) side.put(u, w, y, B("cobblestone_wall"));
    for (let u = -5; u <= -1; u++) for (const w of [-2, 2]) side.log(u, w, 3, B("bone_block"), "z_along_u");
    for (let w = d.w0; w <= d.w1; w++) { side.put(d.u0, w, 1, B("cobblestone")); side.put(d.u0, w, 2, B("cobblestone_wall")); }
    side.slab(d.u0 + 1, -1, 1, B("cobblestone_slab")); side.slab(d.u0 + 1, 1, 1, B("cobblestone_slab"));
    side.put(d.u0 + 1, 0, 1, B("candle"), { lit: true });
    return ["qarmaq of stone, sod and skins, with a sleeping platform and lamps", "tupiq: a summer tent of skins on poles",
      "stone-and-bone boat racks and a windbreak with a lamp"];
  },
};

// What each tradition lays between its buildings and the walkway: paths you walk from door to dock.
const PATHS = {
  naust: "spruce_planks", warehouse: "stone_bricks", canoe_house: "coarse_dirt", halau: "cobblestone", coral_store: "sandstone",
  tile_shed: "stone_bricks", funaya: "stone", plank_house: "spruce_planks", stilt_house: "mangrove_planks", qarmaq: "gravel",
};
const DOOR_LIGHT = { canoe_house: "torch", halau: "torch", plank_house: "torch", qarmaq: "candle" };

/** The stairs and trapdoor for a tradition's detailing, from its stone and wood. */
const STAIRS_OF = {
  // (Bedrock's cobblestone stairs are "stone_stairs"; stone stairs are "normal_stone_stairs")
  cobblestone: "stone_stairs", mossy_cobblestone: "mossy_cobblestone_stairs", stone_bricks: "stone_brick_stairs",
  sandstone: "sandstone_stairs", mud_bricks: "mud_brick_stairs", stone: "normal_stone_stairs", gravel: "stone_stairs",
  bone_block: "stone_stairs", polished_andesite: "polished_andesite_stairs", brick_block: "brick_stairs",
};
const TRAPDOOR_OF = { oak: "trapdoor", spruce: "spruce_trapdoor", birch: "birch_trapdoor", jungle: "jungle_trapdoor", acacia: "acacia_trapdoor",
  dark_oak: "dark_oak_trapdoor", mangrove: "mangrove_trapdoor", cherry: "cherry_trapdoor", bamboo: "bamboo_trapdoor" };
let DETAIL = null;

/** Lays out a tradition's yard around a dock (left and right are the basin's half widths). */
export function layoutYard(c, arch, { left, right, base = "minecraft:cobblestone", wood = "spruce" } = {}) {
  const st = STAIRS_OF[base.replace("minecraft:", "")];
  const td = TRAPDOOR_OF[wood];
  DETAIL = { skirt: st ? `minecraft:${st}` : null, sill: td ? `minecraft:${td}` : null };
  // The walkway is two rings round the basin (to u = -2 and w = -left-2 / right+2). Buildings stand
  // one row back from it, leaving room for porches, steps and platforms; the deck meets it, so the
  // table on its front edge looks straight over the dock.
  const main = c.place(-4, 0, 0);                    // behind the walkway, facing the dock
  const home = c.place(3, -(left + 4), 1);           // port side, facing the dock
  const side = c.place(3, right + 3, 3);             // starboard side, facing the dock
  const lines = ARCH[arch](main, home, side);
  // The row between each building and the walkway becomes a path, with a light by each door.
  const path = B(PATHS[arch] ?? "gravel"), light = B(DOOR_LIGHT[arch] ?? "lantern");
  const strip = (f, w0, w1) => { for (let w = w0; w <= w1; w++) if (!f.has(1, w, 0)) f.put(1, w, 0, path); f.addFloor({ u0: 1, u1: 1, w0, w1 }); };
  strip(main, -(left + 2), right + 2);
  strip(home, -4, 4);
  for (const [f, w] of [[main, -2], [main, 2], [home, -2], [home, 2]]) if (!f.has(1, w, 1)) f.put(1, w, 1, light, light === B("candle") ? { lit: true } : {});
  DETAIL = null;
  return lines;
}

/**
 * A tradition's three buildings, each on a canvas of its own (front at u = 0, facing +u), so they can
 * be placed apart: the homeport's culture agents (world/portsim.js) site each one by their own rules.
 * Each has a path and a light by its door, as in a yard.
 */
export function drawPieces(arch, { base = "minecraft:cobblestone", wood = "spruce" } = {}) {
  const st = STAIRS_OF[base.replace("minecraft:", "")];
  const td = TRAPDOOR_OF[wood];
  DETAIL = { skirt: st ? `minecraft:${st}` : null, sill: td ? `minecraft:${td}` : null };
  const out = { main: new Canvas(), home: new Canvas(), side: new Canvas() };
  const lines = ARCH[arch](out.main.place(0, 0, 0), out.home.place(0, 0, 0), out.side.place(0, 0, 0));
  const path = B(PATHS[arch] ?? "gravel"), light = B(DOOR_LIGHT[arch] ?? "lantern");
  for (const c of [out.main, out.home]) {
    for (let w = -2; w <= 2; w++) if (!c.has(1, w, 0)) c.put(1, w, 0, path);
    for (const w of [-2, 2]) if (!c.has(1, w, 1)) c.put(1, w, 1, light, light === B("candle") ? { lit: true } : {});
  }
  DETAIL = null;
  return { ...out, lines };
}

// ---------------------------------------------------------------- the dry dock's works

/**
 * What a dry dock has that a dock doesn't, in the yard's own materials: a gantry crane straddling
 * the basin (two braced towers, a beam, a chain and its block), gate posts with capstans at the
 * mouth, and along the sides beyond the walkway a timber stack, a saw bench, a steam box for
 * bending planks and a rope coil: the yard's working ground, not empty quay.
 */
export function dryDockWorks(c, style, { left, right, length }) {
  const log = style.post ?? B("spruce_log");
  const stone = !style.base || /gravel|sand$/.test(style.base) ? B("cobblestone") : style.base;   // nothing that falls
  const wood = (style.post ?? "spruce").replace(/minecraft:|stripped_|_log|_block|_stem/g, "") || "spruce";
  const planks = PLANKS[wood] ?? B("spruce_planks"), fence = FENCE[wood] ?? B("spruce_fence"), stairs = STAIRS[wood] ?? B("spruce_stairs");
  const timber = TIMBER[wood] ?? B("stripped_spruce_log");
  const slab = SLAB[wood] ?? B("spruce_slab");
  const wl = -left - 3, wr = right + 3;                       // just outside the walkway
  const lines = [];
  // The gantry: towers at a third of the way out, a beam across at the top of the headroom.
  const ug = Math.max(4, Math.floor(length * 0.4));
  for (const [w, out] of [[wl, PORT], [wr, STAR]]) {
    c.floor(ug - 1, ug + 1, w - (out === PORT ? 1 : 0), w + (out === STAR ? 1 : 0), stone);
    for (let y = 1; y <= 9; y++) c.log(ug, w, y, log);
    for (const du of [-1, 1]) {                                // braces: posts at the foot, stairs at the top
      c.put(ug + du, w, 1, fence); c.put(ug + du, w, 2, fence);
      c.stair(ug + du, w, 9, stairs, du < 0 ? SEA : LAND, true);
    }
  }
  for (let w = wl; w <= wr; w++) c.log(ug, w, 10, log, "along_w");
  c.put(ug, 0, 9, B("iron_chain"), { axis: "y" }); c.put(ug, 0, 8, B("iron_chain"), { axis: "y" });
  c.put(ug, 0, 7, B("lantern"), { hanging: true });
  lines.push("gantry crane over the basin");
  // Gate posts at the mouth, just outside the walkway, each with a capstan beside it.
  for (const [cw, out] of [[wl, -1], [wr, 1]]) {
    c.floor(length - 6, length - 1, cw, cw + out, stone);      // long enough to meet the walkway between its posts
    for (let y = 1; y <= 4; y++) c.log(length - 1, cw, y, log);
    c.put(length - 1, cw, 5, B("lantern"));
    c.log(length - 3, cw + out, 1, log); c.slab(length - 3, cw + out, 2, slab);
    c.put(length - 5, cw + out, 1, B("barrel"));
  }
  lines.push("gate posts with capstans at the mouth");
  // The working ground along the sides, between the buildings and the gantry, and past it.
  const runs = [[Math.max(10, ug + 3), length - 4]];
  for (const [ua, ub] of runs) {
    if (ub - ua < 3) continue;
    // port: a timber stack, logs laid along the dock, two high, under a slab cover
    const tw = wl - 1;
    c.floor(ua, ub, tw - 1, tw + 1, stone);
    for (let u = ua; u <= Math.min(ub, ua + 5); u++) for (const w of [tw - 1, tw, tw + 1]) for (let y = 1; y <= 2; y++) c.log(u, w, y, timber, "z_along_u");
    for (let u = ua; u <= Math.min(ub, ua + 5); u++) for (const w of [tw - 1, tw, tw + 1]) c.slab(u, w, 3, slab);
    if (ub - ua >= 9) {                                         // and the saw bench beyond it
      c.put(ua + 7, tw, 1, fence); c.put(ua + 9, tw, 1, fence);
      for (let u = ua + 7; u <= ua + 9; u++) c.slab(u, tw, 2, slab, false);
      c.put(ua + 8, tw + 1, 1, B("stonecutter_block"));
    }
    // starboard: the steam box (a long box over a fire), a rope coil, the anchor's cable barrels
    const sw = wr + 1;
    c.floor(ua, Math.min(ub, ua + 6), sw - 1, sw + 1, stone);
    for (let u = ua; u <= ua + 3; u++) c.log(u, sw, 2, timber, "z_along_u");
    c.put(ua, sw, 1, stone); c.put(ua + 3, sw, 1, stone);
    c.put(ua + 1, sw, 1, B("campfire")); c.put(ua + 2, sw, 1, B("campfire"));
    c.put(ua + 1, sw + 1, 1, B("cauldron"));
    c.put(ua + 5, sw, 1, B("barrel")); c.put(ua + 5, sw - 1, 1, B("barrel")); c.put(ua + 6, sw, 1, B("brown_carpet"));
    c.put(ua + 6, sw - 1, 1, planks);
  }
  lines.push("timber stack, saw bench and steam box along the quay");
  return lines;
}
const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry"];
const PLANKS = Object.fromEntries([...WOODS.map((w) => [w, B(`${w}_planks`)]), ["bamboo", B("bamboo_planks")], ["bone", B("spruce_planks")]]);
const FENCE = Object.fromEntries([...WOODS.map((w) => [w, B(`${w}_fence`)]), ["bamboo", B("bamboo_fence")]]);
const STAIRS = Object.fromEntries([...WOODS.map((w) => [w, B(`${w}_stairs`)]), ["bamboo", B("bamboo_stairs")]]);
const TIMBER = Object.fromEntries([...WOODS.map((w) => [w, B(`stripped_${w}_log`)]), ["bamboo", B("stripped_bamboo_block")]]);
const SLAB = Object.fromEntries([...WOODS.map((w) => [w, B(`${w}_slab`)]), ["bamboo", B("bamboo_slab")]]);

const CARD = ["east", "west", "south", "north"];
const CARD_NAME = CARD;
/** Blocks that take a pillar axis (logs, stems, pillars, hay): no other block may be given one. */
export const PILLAR = /_log$|_wood$|_stem$|_hyphae$|basalt$|bone_block|hay_block|_pillar$|bamboo_block$|^minecraft:deepslate$|iron_chain|muddy_mangrove_roots|ochre_froglight|verdant_froglight|pearlescent_froglight/;
/** Turns an orientation in the dock's frame into the block states the game wants. */
export function statesFor(cell, d) {
  const st = {};
  const vec = { sea: d, land: { x: -d.x, z: -d.z }, port: { x: d.z, z: -d.x }, star: { x: -d.z, z: d.x } };
  const card = (v) => (v.x > 0 ? 0 : v.x < 0 ? 1 : v.z > 0 ? 2 : 3);           // east, west, south, north
  if (cell.face) {
    st.weirdo_direction = card(vec[cell.face]);
    st.upside_down_bit = !!cell.upside;
  }
  if (cell.facing) st.facing_direction = { east: 5, west: 4, south: 3, north: 2 }[CARD[card(vec[cell.facing])]];
  if (cell.half && /trapdoor/.test(cell.id)) st.upside_down_bit = cell.half === "top";
  else if (cell.half) st["minecraft:vertical_half"] = cell.half;
  if (cell.axis && PILLAR.test(cell.id)) {
    const along = cell.axis === "z_along_u" ? d : cell.axis === "along_w" ? vec.star : null;
    st.pillar_axis = along ? (along.x !== 0 ? "x" : "z") : "y";
  }
  if (cell.door) {                                            // a door: which way it faces, and its upper half
    st["minecraft:cardinal_direction"] = CARD_NAME[card(vec[cell.door])];
    st.upper_block_bit = !!cell.upper;
  }
  if (cell.bed) {                                             // a bed: where its head points, and which half
    st.direction = { south: 0, west: 1, north: 2, east: 3 }[CARD_NAME[card(vec[cell.bed])]];
    st.head_piece_bit = !!cell.head;
  }
  if (/^minecraft:(torch|soul_torch)$/.test(cell.id)) st.torch_facing_direction = "top";
  if (cell.bell) st.attachment = "standing";
  if (cell.hanging) st.hanging = true;
  if (cell.persistent) st.persistent_bit = true;
  if (cell.lit) st.lit = true;
  return st;
}
