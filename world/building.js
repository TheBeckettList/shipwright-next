// Pure. Buildings from rooms: a molecule (world/periodic.js) laid out, walled as one (the walls are where its
// rooms end, not round each room), furnished room by room (world/roomvox.js), clad by its people's palette
// from the ground up (world/palette.js: heavy low, light high), roofed by its people's pitch, and changed by
// its reactions: what two rooms make together that neither makes alone.
//   reactions  fusion     two rooms that open into one another (carbon with carbon): one hall, vaulted
//              noble      a court beside a room: the room's court wall opens as an arcade (a loggia)
//              coinage    a room of group 11 (copper, silver, gold: shrine, counting house, throne hall): a dome,
//                         crowned
//              stair      the stair hall rises a storey past the roof as a tower, and a spire tops it
//              fire       a kitchen or bakehouse: a chimney through the roof (brick: chimneys are brick)
//              metal      a public room on the street (shop, workshop, counting house): an awning, a banner,
//                         pots and barrels out front
//              window     a bedroom's street window: a flower box under it
//   split      on a slope, a people that terraces (TERRACING) steps its rooms up the hill rather than level
//              the ground: a room a few steps (one to three) above the one it's entered from, then the next a
//              few more. Rooms that open into one another stay one floor; a storey above stands on its own.
//              Not common: a people's share of its sloped plots, the rest levelled on a footing
// What a building is follows from its formula: living (it sleeps someone), commercial (it doesn't, and it
// trades or works), or both (the shop-house).
import { FIB, PHI, golden } from "../core/golden.js";
import { TABLE, assemble, formulaOf, CIRCULATION as CIRC } from "./periodic.js";
import { roomVox, MATS } from "./roomvox.js";
import { PALETTE, ROOFING, DOMES } from "./palette.js";
import { dome, vault, spire, sample } from "./quadric.js";
import { GRAMMAR } from "./grammar.js";

const H = FIB[4] - 2;   // derived: three blocks clear a storey (world/roomvox.js HEIGHT)
const STOREY = H + 1;   // a storey and its floor
export const TERRACING = { therans: 1, japanese: 1 / PHI, east_asian: 1 / PHI, indian_ocean: 1 / PHI ** 2, european: 1 / PHI ** 2 };   // vision: the share of its sloped plots a people steps rather than levels (Akrotiri's houses up the caldera; the hillside temple's halls; the stone towns' steps)
export const STEP_MAX = FIB[3];   // derived: three blocks at most between a room and the next (a few steps, never a storey)
const COMMERCE = new Set(["Na", "Mg", "Al", "Si", "K", "Ca", "Fe", "Ag", "P"]);   // the rooms that trade or work
export const kindOf = (formula) => { const live = formula.includes("O"), trade = formula.some((s) => COMMERCE.has(s)); return live && trade ? "shop-house" : live ? "living" : trade ? "commercial" : "civic"; };

/** Build a molecule as a building. Returns { vox, checks, kind, formula, size, reactions }. */
export function buildingOf(formula, tradition = "european", { seed = 0, street = [0, -1], tower = null, slope = null } = {}) {
  if (GRAMMAR[tradition] && !(formula.length === 1 && TABLE[formula[0]].noble) && !formula.some((q) => TABLE[q].group === 11 || q === "Kr" || q === "Xe")) {   // the people's own form (civic buildings keep the room-by-room law)   // vision: the building's own measure (its rooms' cells, storeys and courses)
    const floors = []; let cur = []; for (const q of formula) { if (q === "B") { floors.push(cur); cur = []; } else cur.push(q); } floors.push(cur);
    const g = GRAMMAR[tradition](floors, tradition);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0; for (const k of g.vox.keys()) { const [x, y, z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); y1 = Math.max(y1, y); }
    return { vox: g.vox, checks: g.checks, kind: kindOf(formula), formula, size: { w: x1 - x0 + 1, l: z1 - z0 + 1, h: y1 + 1 }, reactions: [g.note], molecule: null };
  }
  const P = PALETTE[tradition] ?? PALETTE.european, R = ROOFING[P.roof] ?? ROOFING.shingle, M = MATS[tradition] ?? MATS.european;
  const m = assemble(formula, { street }), vox = new Map(), checks = [...m.problems], reactions = [];
  const put = (x, y, z, id, s = null) => vox.set(`${x},${y},${z}`, { id, s });
  const has = (x, y, z) => vox.has(`${x},${y},${z}`);
  const floors = Math.max(...m.rooms.map((r) => r.f)) + 1;
  const alone = m.rooms.length === 1 && TABLE[m.rooms[0].sym].noble;   // a noble standing alone: a pavilion, roofed
  const inRoom = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  const roomsOn = (f) => m.rooms.filter((r) => r.f === f);
  const jet = (f) => (P.jetty && f > 0 ? 1 : 0);   // the jetty: each upper storey's walls a block out over the one below
  const interior = (f, x, z) => roomsOn(f).some((r) => x >= r.x0 - jet(f) && x <= r.x1 + jet(f) && z >= r.z0 - jet(f) && z <= r.z1 + jet(f));
  // ---- the levels: on a slope (slope: { dir: [dx, dz] uphill, grade: rise a block }), each room a few steps from the one before
  const DY = m.rooms.map(() => 0);
  if (slope && slope.grade > 0 && !P.stilts && !P.raised) {
    const cx = (r) => (r.x0 + r.x1) / 2, cz = (r) => (r.z0 + r.z1) / 2, r0 = m.rooms[0];
    for (const r of m.rooms) {
      if (r.i === 0) continue;
      if (r.landing) { const b = m.bonds.find((q) => q.b === r.i && q.join === "stair"); DY[r.i] = b ? DY[b.a] : 0; continue; }
      if (r.f > 0) { const under = m.rooms.filter((o) => o.f === r.f - 1 && o.x0 <= cx(r) && cx(r) <= o.x1 && o.z0 <= cz(r) && cz(r) <= o.z1); DY[r.i] = under.length ? Math.max(...under.map((o) => DY[o.i])) : 0; continue; }
      const b = m.bonds.find((q) => q.b === r.i); if (!b) continue;
      if (b.join === "open" || TABLE[r.sym].noble) { DY[r.i] = DY[b.a]; continue; }   // one room, one floor (and a court is the ground)
      const want = Math.round(slope.grade * ((cx(r) - cx(r0)) * slope.dir[0] + (cz(r) - cz(r0)) * slope.dir[1]));
      DY[r.i] = DY[b.a] + Math.max(-STEP_MAX, Math.min(STEP_MAX, want - DY[b.a]));
    }
    if (DY.some((d) => d !== 0)) reactions.push(`split: rooms stepped up the slope (${[...new Set(DY)].sort((a, b) => a - b).join(", ")} blocks)`);
  }
  const roomAt = (f, x, z) => roomsOn(f).find((r) => x >= r.x0 - jet(f) && x <= r.x1 + jet(f) && z >= r.z0 - jet(f) && z <= r.z1 + jet(f));
  const near8 = (f, x, z) => { const out = []; for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) { const r = roomAt(f, x + a, z + b); if (r) out.push(r); } return out; };
  const base = Math.min(0, ...DY);
  // ---- the shell: floor, walls and ceiling of each storey, from the union of its rooms
  let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity; for (const r of m.rooms) { const j = jet(r.f) + 1; bx0 = Math.min(bx0, r.x0 - j); bz0 = Math.min(bz0, r.z0 - j); bx1 = Math.max(bx1, r.x1 + j); bz1 = Math.max(bz1, r.z1 + j); }
  for (let f = 0; f < floors; f++) {
    const Y0 = f * STOREY, wallId = f === 0 ? P.wall : P.upper;
    for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) {
      const here = roomAt(f, x, z), inside = !!here, ns = near8(f, x, z);
      if (!inside && !ns.length) continue;
      const lo = inside ? DY[here.i] : Math.min(...ns.map((r) => DY[r.i])), hi = inside ? DY[here.i] : Math.max(...ns.map((r) => DY[r.i])), y0 = Y0 + lo;
      if (f === 0) for (let y = base; y < y0; y++) put(x, y, z, P.plinth);   // the footing under a stepped room: the plinth down to the lowest
      if (alone && !inside) { put(x, y0, z, P.plinth); if ((x + z) % 2 === 0 || ([-1, 1].some((a) => !interior(f, x + a, z)) && [-1, 1].some((b) => !interior(f, x, z + b)))) for (let y = 1; y <= H; y++) put(x, y0 + y, z, P.frame ?? P.wall, P.frame?.endsWith("_log") ? { pillar_axis: "y" } : null); put(x, y0 + H + 1, z, P.trim); continue; }   // a pavilion: posts round it, open between
      if (inside) { put(x, y0, z, f === 0 ? M.floor : R.block === "minecraft:snow" ? M.floor : "minecraft:spruce_planks"); continue; }
      // a wall cell: a corner (no interior beside it on either axis) takes the frame, the rest the wall; the ground course the plinth
      const sideIn = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => interior(f, x + a, z + b)), corner = !sideIn;
      put(x, y0, z, f === 0 ? P.plinth : P.trim);
      for (let y = 1; y <= H + hi - lo; y++) put(x, y0 + y, z, corner && P.frame ? P.frame : f === 0 && y === 1 && P.plinth !== P.wall && tradition !== "arctic" ? P.plinth : wallId, corner && P.frame?.endsWith("_log") ? { pillar_axis: "y" } : null);
      put(x, Y0 + hi + H + 1, z, P.trim);   // the beam course under the next floor or the eaves
    }
    if (jet(f)) for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) { const k = `${x},${Y0},${z}`; if (vox.has(k) && !interior(f - 1, x, z) && !roomsOn(f - 1).some((r) => x >= r.x0 - 1 && x <= r.x1 + 1 && z >= r.z0 - 1 && z <= r.z1 + 1) && (x + z) % 2 === 0) put(x, Y0 - 1, z, "minecraft:dark_oak_stairs", { weirdo_direction: 0, upside_down_bit: true }); }   // the jetty's brackets
    // the ceiling: the next floor where a room is over, else the roof's base (laid below)
    for (const r of roomsOn(f)) for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) if (f + 1 < floors && interior(f + 1, x, z)) put(x, Y0 + DY[r.i] + STOREY, z, "minecraft:spruce_planks");
  }
  // ---- doors and windows
  const DIR = (s) => ({ s: 0, w: 1, n: 2, e: 3 })[s];   // given: a door's direction
  const sideAt = (x, z, f) => { for (const [s, a, b] of [["w", 1, 0], ["e", -1, 0], ["n", 0, 1], ["s", 0, -1]]) if (interior(f, x + a, z + b)) return s; return "s"; };
  const steps = [];
  for (const d of m.doors) {
    const ra = m.rooms[d.a], rb = d.b === "out" ? null : m.rooms[d.b], up = rb ? Math.max(DY[ra.i], DY[rb.i]) : DY[ra.i], y0 = d.f * STOREY + up, s = sideAt(d.x, d.z, d.f);
    put(d.x, y0, d.z, M.floor); put(d.x, y0 + 1, d.z, P.door, { direction: DIR(s), upper_block_bit: false }); put(d.x, y0 + 2, d.z, P.door, { direction: DIR(s), upper_block_bit: true });
    if (rb && DY[ra.i] !== DY[rb.i]) steps.push({ d, low: DY[ra.i] < DY[rb.i] ? ra : rb, rise: Math.abs(DY[ra.i] - DY[rb.i]) });   // a few steps up through this door, laid in the lower room
  }
  for (const w of m.windows) { const y0 = w.f * STOREY + DY[w.room], trap = /trapdoor/.test(P.window); put(w.x, y0 + 2, w.z, P.window, trap ? { open_bit: true, upside_down_bit: false, direction: 0 } : null); }
  // ---- the rooms furnished: each in its own frame, with the building's doors and windows as its own
  for (const r of m.rooms) {
    if (r.landing) continue;
    const local = (c) => [c.x - r.x0, c.z - r.z0], onWall = ([x, z]) => (x === -1 || x === r.x1 - r.x0 + 1) !== (z === -1 || z === r.z1 - r.z0 + 1) && x >= -1 && z >= -1 && x <= r.x1 - r.x0 + 1 && z <= r.z1 - r.z0 + 1;
    const openings = m.bonds.filter((b) => b.join === "open" && (b.a === r.i || b.b === r.i)).map((b) => { const o = m.rooms[b.a === r.i ? b.b : b.a], d = b.a === r.i ? b.dir : [-b.dir[0], -b.dir[1]]; const mx = Math.round((Math.max(r.x0, o.x0) + Math.min(r.x1, o.x1)) / 2), mz = Math.round((Math.max(r.z0, o.z0) + Math.min(r.z1, o.z1)) / 2); return d[0] === 1 ? { x: r.x1 + 1, z: mz } : d[0] === -1 ? { x: r.x0 - 1, z: mz } : d[1] === 1 ? { x: mx, z: r.z1 + 1 } : { x: mx, z: r.z0 - 1 }; });   // where it opens into a room beside it: a way in, kept clear
    const doorAt = [...m.doors.filter((d) => d.f === r.f), ...openings].map(local).filter(onWall), winAt = m.windows.filter((w) => w.f === r.f && w.room === r.i).map(local).filter(onWall);
    const rv = roomVox(r.sym, tradition, { doorAt, winAt, w: r.x1 - r.x0 + 1, l: r.z1 - r.z0 + 1 });
    for (const c of rv.checks) checks.push(`${r.sym}: ${c}`);
    const y0 = r.f * STOREY + DY[r.i];
    for (const [k, b] of rv.vox) { const [x, y, z] = k.split(",").map(Number); if (y < 1 || y > H || x < 0 || z < 0 || x > r.x1 - r.x0 || z > r.z1 - r.z0) continue; put(r.x0 + x, y0 + y, r.z0 + z, b.id, b.s); }   // its insides only: the building has its own shell
    if (r.sym === "B" && r.f + 1 < floors) { const lx = r.x1, lz = r.z0; for (let y = 1; y <= STOREY; y++) put(lx, y0 + y, lz, "minecraft:ladder", { facing_direction: 4 }); put(lx, y0 + STOREY, lz, "minecraft:air"); }   // the way up: a ladder in the stair hall's corner through the floor above   // vision: the building's own measure (its rooms' cells, storeys and courses)
  }
  // the steps: from the lower room's floor up to the door, a stair a block, the top one at the wall
  for (const { d, low, rise } of steps) {
    const inward = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([a, b]) => inRoom(low, d.x + a, d.z + b)); if (!inward) continue;
    const yl = d.f * STOREY + DY[low.i], dir = { "1,0": 1, "-1,0": 0, "0,1": 3, "0,-1": 2 }[inward.join(",")];   // given: the stair rises toward the door (weirdo_direction: 0 east, 1 west, 2 south, 3 north)
    for (let j = 1; j <= rise; j++) {
      const x = d.x + inward[0] * j, z = d.z + inward[1] * j, top = yl + rise - j + 1;
      for (let y = yl + 1; y < top; y++) put(x, y, z, M.floor);
      put(x, top, z, R.stairs.endsWith("_stairs") ? R.stairs : "minecraft:stone_brick_stairs", { weirdo_direction: dir, upside_down_bit: false });
      for (let y = top + 1; y <= top + 2; y++) vox.delete(`${x},${y},${z}`);
    }
  }
  // ---- roofs: over every room with nothing above it, by the people's pitch
  const roofed = new Set();
  const roofRect = (x0, z0, x1, z1, yb, pitch, over) => {
    const w = x1 - x0 + 1, l = z1 - z0 + 1, alongX = w >= l, half = Math.floor((alongX ? l : w) / 2) + over;
    if (pitch === "flat" || pitch === "dome") {   // a parapet and a flat roof (a dome's drum)
      for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) { const edge = x < x0 || x > x1 || z < z0 || z > z1; put(x, yb, z, edge ? P.trim : R.slab ?? R.block); if (edge && pitch === "flat") put(x, yb + 1, z, tradition === "indian_ocean" ? ((x + z) % 2 === 0 ? P.upper : R.slab) : tradition === "therans" ? P.wall : R.slab); }   // the parapet: crenellated on the Indian Ocean, a white wall on Thera (the roof a terrace)
      return;
    }
    if (pitch === "round") { const F = vault(x0 - 1, z0 - 1, w + 2, l + 2, yb); for (const [x, y, z, k] of sample(F, { box: [x0 - 2, yb, z0 - 2, x1 + 2, yb + half + 2, z1 + 2] })) put(x, y, z, k === "slab" ? R.slab : R.block); return; }
    const rise = pitch === "low" ? 0.5 : 1, stepsUp = (k) => Math.floor(k * rise);   // derived: a low pitch rises a block in two
    for (let k = 0; k <= half; k++) {
      const y = yb + stepsUp(k), a0 = (alongX ? z0 : x0) - over + k, a1 = (alongX ? z1 : x1) + over - k;
      if (a0 > a1) break;
      const ridge = a1 - a0 <= 1;
      const run = alongX ? [x0 - over, x1 + over] : [z0 - over, z1 + over];
      for (let t = run[0]; t <= run[1]; t++) {
        const p0 = alongX ? [t, a0] : [a0, t], p1 = alongX ? [t, a1] : [a1, t];
        const curl = pitch === "curved" && k === 0;   // the curved eave: its first course turned up
        if (ridge) { put(p0[0], y + (rise < 1 ? 0 : 0), p0[1], R.slab); if (a1 !== a0) put(p1[0], y, p1[1], R.slab); continue; }
        const dirA = alongX ? 2 : 0, dirB = alongX ? 3 : 1;   // given: stairs' weirdo_direction rising toward the ridge (south 2 / north 3, east 0 / west 1)
        put(p0[0], y, p0[1], R.stairs, R.stairs.endsWith("_stairs") ? { weirdo_direction: dirA, upside_down_bit: curl } : null);
        put(p1[0], y, p1[1], R.stairs, R.stairs.endsWith("_stairs") ? { weirdo_direction: dirB, upside_down_bit: curl } : null);
        for (let yy = yb; yy < y; yy++) { for (const p of [p0, p1]) if ((alongX ? t === x0 - 1 || t === x1 + 1 : t === z0 - 1 || t === z1 + 1)) put(p[0], yy, p[1], P.upper); }   // the gable's end filled
      }
      // the gable ends between the slopes
      for (let a = a0 + 1; a < a1; a++) for (const t of alongX ? [x0 - 1, x1 + 1] : [z0 - 1, z1 + 1]) { const p = alongX ? [t, a] : [a, t]; for (let yy = yb; yy <= y; yy++) if (!has(p[0], yy, p[1])) put(p[0], yy, p[1], P.upper); }
    }
  };
  const top = (r) => !m.rooms.some((o) => o.f === r.f + 1 && o.x0 <= r.x1 && r.x0 <= o.x1 && o.z0 <= r.z1 && r.z0 <= o.z1);
  // the rooms that open into one another roof as one
  const groups = []; for (const r of m.rooms) { if ((TABLE[r.sym].noble && !alone) || !top(r)) continue; const g = groups.find((G) => G.f === r.f && DY[G.rooms[0].i] === DY[r.i] && G.rooms.some((o) => m.bonds.some((b) => b.join === "open" && ((b.a === o.i && b.b === r.i) || (b.b === o.i && b.a === r.i))))); if (g) g.rooms.push(r); else groups.push({ f: r.f, rooms: [r] }); }
  const domed = new Set();
  for (const g of groups) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const r of g.rooms) { x0 = Math.min(x0, r.x0); z0 = Math.min(z0, r.z0); x1 = Math.max(x1, r.x1); z1 = Math.max(z1, r.z1); }
    if (jet(g.f)) { x0 -= 1; z0 -= 1; x1 += 1; z1 += 1; }
    const yb = g.f * STOREY + STOREY + DY[g.rooms[0].i], coin = g.rooms.find((r) => TABLE[r.sym].group === 11 || (alone && TABLE[r.sym].period >= 4)) ?? (tradition === "therans" && g.rooms.some((r) => r.sym === "C" || r.sym === "O") && golden(seed * 13 + g.rooms[0].i) < 1 / PHI ? g.rooms[0] : null);   // Thera's blue domes: over a hall or a bedroom, one in phi   // the coinage metals, and the great nobles (temples), are domed   // vision: the building's own measure (its rooms' cells, storeys and courses)
    if (coin && (P.dome || tradition === "european" || tradition === "east_asian")) {   // coinage: the dome
      const cover = DOMES[P.dome] ?? "minecraft:oxidized_cut_copper"; roofRect(x0, z0, x1, z1, yb, "dome", 0);
      const drum = tradition === "indian_ocean" || tradition === "east_asian" ? FIB[2] : 0;   // derived: a drum two courses high under the onion
      for (let y = yb + 1; y <= yb + drum; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) put(x, y, z, (x + z + y) % 3 === 0 ? P.window : P.upper);   // vision: the building's own measure (its rooms' cells, storeys and courses)
      const F = dome(x0, z0, x1 - x0 + 1, z1 - z0 + 1, yb + 1 + drum, tradition === "indian_ocean" ? PHI : tradition === "therans" ? 1 : 1 / PHI); const pts = sample(F, { box: [x0 - 1, yb + 1 + drum, z0 - 1, x1 + 1, yb + drum + FIB[7], z1 + 1] });   // vision: the building's own measure (its rooms' cells, storeys and courses)
      let ty = yb; for (const [x, y, z] of pts) { put(x, y, z, cover); ty = Math.max(ty, y); }
      const cx = Math.round((x0 + x1) / 2), cz = Math.round((z0 + z1) / 2); put(cx, ty + 1, cz, P.crown ?? "minecraft:lightning_rod");
      reactions.push(TABLE[coin.sym].group === 11 ? `coinage: ${coin.sym} (${TABLE[coin.sym].room}) domed` : TABLE[coin.sym].noble ? `a great noble: the ${TABLE[coin.sym].room} domed` : `a blue dome over the ${TABLE[coin.sym].room}`); domed.add(g); continue;   // vision: the building's own measure (its rooms' cells, storeys and courses)
    }
    const fused = g.rooms.length > 1 && g.rooms.every((r) => r.sym === g.rooms[0].sym);
    if (fused && P.pitch !== "flat" && P.pitch !== "dome") reactions.push(`fusion: ${g.rooms.map((r) => r.sym).join("")} one hall under one roof`);
    roofRect(x0, z0, x1, z1, yb, P.pitch === "dome" ? "dome" : P.pitch, P.pitch === "flat" || P.pitch === "dome" ? 0 : P.pitch === "curved" || P.pitch === "steep" && tradition === "pacific" ? 2 : 1);   // derived: deep eaves (two) where the roof curves or the thatch comes low
    if (P.pitch === "dome") { const F = dome(x0 - 1, z0 - 1, x1 - x0 + 3, z1 - z0 + 3, yb - H, 1); for (const [x, y, z] of sample(F, { box: [x0 - 2, yb - H, z0 - 2, x1 + 2, yb + FIB[6], z1 + 2] })) if (!interior(g.f, x, z) || y > yb) put(x, y, z, DOMES.snow); }   // the snow dome: the whole house under it   // vision: the building's own measure (its rooms' cells, storeys and courses)
  }
  // ---- reactions on the outside
  const seedG = (k) => golden(seed * 7 + k);   // vision: the building's own measure (its rooms' cells, storeys and courses)
  for (const r of m.rooms) {
    const T = TABLE[r.sym], y0 = r.f * STOREY;
    const towers = tower ?? formula.some((q) => TABLE[q].group === 11);   // a tower and its spire: where the coinage metals are (shrine, counting house, throne hall), or asked for   // vision: the building's own measure (its rooms' cells, storeys and courses)
    if (towers && r.sym === "B" && !r.landing && top(m.rooms.find((o) => o.sym === "B" && o.landing && o.x0 === r.x0) ?? r)) {   // the stair: a tower and its spire
      const yt = (floors) * STOREY + Math.max(...DY), cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) for (let z = r.z0 - 1; z <= r.z1 + 1; z++) for (let y = yt; y < yt + STOREY; y++) { const edge = x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1; if (edge) put(x, y, z, (x === r.x0 - 1 || x === r.x1 + 1) && (z === r.z0 - 1 || z === r.z1 + 1) ? P.frame : y === yt + 2 && (x === Math.round(cx) || z === Math.round(cz)) ? P.window : P.upper); }
      const F = spire(cx, cz, (r.x1 - r.x0 + 3) / 2, yt + STOREY, ((r.x1 - r.x0 + 3) / 2) * PHI ** 2); let ty = 0;   // vision: the building's own measure (its rooms' cells, storeys and courses)
      for (const [x, y, z] of sample(F, { box: [r.x0 - 2, yt + STOREY, r.z0 - 2, r.x1 + 2, yt + STOREY + FIB[7], r.z1 + 2], solid: true })) { put(x, y, z, ROOFING.copper.block === R.block ? R.block : tradition === "therans" ? DOMES.blue : tradition === "european" ? ROOFING.slate.block : R.block); ty = Math.max(ty, y); }   // vision: the building's own measure (its rooms' cells, storeys and courses)
      put(Math.round(cx), ty + 1, Math.round(cz), P.crown ?? "minecraft:lightning_rod"); reactions.push("stair: a tower with a spire");
    }
    if ((r.sym === "N" || r.sym === "P") && top(r) && tradition !== "arctic" && tradition !== "birchbark") {   // fire: the chimney
      const x = r.x1, z = r.z1, yb = (r.f + 1) * STOREY + DY[r.i]; for (let y = yb; y <= yb + FIB[5]; y++) put(x + 1, y, z + 1, tradition !== "therans" ? "minecraft:brick_block" : y === yb + FIB[5] ? "waterworld:blue_glazed_roof_full" : "waterworld:theran_marble_polished"); put(x + 1, yb + FIB[5] + 1, z + 1, "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: true }); reactions.push(tradition === "therans" ? "fire: a white marble flue" : "fire: a brick chimney");   // vision: the building's own measure (its rooms' cells, storeys and courses)
    }
    if (TABLE[r.sym].metal && !CIRC.has(r.sym) && r.f === 0 && T.chi <= TABLE.C.chi) {   // metal: the street front
      const d = m.doors.find((q) => q.f === 0 && q.b === "out" && (q.a === r.i)); if (d) {
        const s = sideAt(d.x, d.z, 0), out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[s];
        for (let k = -2; k <= 2; k++) { const ax = out[0] ? d.x + out[0] : d.x + k, az = out[1] ? d.z + out[1] : d.z + k; put(ax, H + 1 + DY[r.i], az, `minecraft:${P.banner ?? "white"}_carpet`); }   // the awning
        put(d.x + out[0] + (out[1] ? 2 : 0), 1, d.z + out[1] + (out[0] ? 2 : 0), "minecraft:barrel", { facing_direction: 1, open_bit: false }); put(d.x + out[0] - (out[1] ? 2 : 0), 1, d.z + out[1] - (out[0] ? 2 : 0), "minecraft:decorated_pot");
        put(d.x + (out[1] ? 1 : 0), 3, d.z + (out[0] ? 1 : 0), "minecraft:wall_banner", { facing_direction: { n: 2, s: 3, w: 4, e: 5 }[s] }); reactions.push(`metal: ${T.room}'s street front`);   // vision: the building's own measure (its rooms' cells, storeys and courses)
      }
    }
  }
  for (const w of m.windows) { const r = m.rooms[w.room]; if (r?.sym !== "O" || seedG(w.x + w.z) > 1 / PHI) continue; const y0 = w.f * STOREY + DY[r.i], ox = w.x + w.out[0], oz = w.z + w.out[1]; if (has(ox, y0 + 1, oz)) continue; put(ox, y0 + 1, oz, P.trim); put(ox, y0 + 2, oz, "minecraft:flower_pot"); reactions.push("window: a flower box"); }   // derived: three windows in five
  // courts: the arcade (a court's walls open on posts); the court's floor paved, a basin in its middle
  for (const r of m.rooms) if (TABLE[r.sym].noble && !alone) {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) for (let z = r.z0 - 1; z <= r.z1 + 1; z++) { const edge = x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1; if (!edge) continue; const post = (x + z) % 2 === 0; for (let y = 1 + DY[r.i]; y <= H + DY[r.i]; y++) { const k = `${x},${y},${z}`; if (vox.get(k)?.id === P.wall || vox.get(k)?.id === P.upper || vox.get(k)?.id === P.plinth) put(x, y, z, post ? P.frame ?? P.wall : y === H ? `${R.stairs}` : "minecraft:air", !post && y === H && R.stairs.endsWith("_stairs") ? { weirdo_direction: 0, upside_down_bit: true } : post && P.frame?.endsWith("_log") ? { pillar_axis: "y" } : null); } }
    reactions.push("noble: a court and its arcade");
  }
  // bays: an upper window on the street side stands out as an oriel (glass) or a screened box (the Indian Ocean's mashrabiya), one in phi
  if (P.jetty || tradition === "indian_ocean" || tradition === "therans") for (const w of m.windows) {
    if (w.f < 1 || seedG(w.x * 3 + w.z) > 1 / PHI) continue;   // vision: the building's own measure (its rooms' cells, storeys and courses)
    const y0 = w.f * STOREY + DY[w.room], [ox, oz] = w.out, j = jet(w.f), bx = w.x + ox * (1 + j), bz = w.z + oz * (1 + j), side = ox ? [0, 1] : [1, 0], screen = tradition === "indian_ocean" ? "minecraft:dark_oak_trapdoor" : tradition === "therans" ? "minecraft:light_blue_stained_glass_pane" : "minecraft:glass_pane";
    for (const s2 of [-1, 0, 1]) { const x = bx + side[0] * s2, z = bz + side[1] * s2; put(x, y0 + 1, z, P.trim); put(x, y0 + 2, z, s2 === 0 ? screen : P.frame ?? P.upper, s2 !== 0 && P.frame?.endsWith("_log") ? { pillar_axis: "y" } : screen.includes("trapdoor") ? { open_bit: false, upside_down_bit: false, direction: 0 } : null); put(x, y0 + 3, z, R.slab); }   // vision: the building's own measure (its rooms' cells, storeys and courses)
    put(w.x + ox * j, y0 + 2, w.z + oz * j, "minecraft:air"); reactions.push(tradition === "indian_ocean" ? "window: a screened bay (mashrabiya)" : "window: an oriel bay");
  }
  // ---- the detail: each people's tricks of the trade, read off the shell (vision: after the builders' own: upside-down
  // stairs as corbels under the eaves and as hoods over the windows, slabs for sills, trapdoors for shutters, logs for the
  // half-timber's studs, weathered stone low on the wall, lanterns under the eaves and by the door, a ridge capped)
  const Dt = DETAIL[tradition] ?? {}, UP = { "1,0": 0, "-1,0": 1, "0,1": 2, "0,-1": 3 };   // given: weirdo_direction, the way a stair rises (east, west, south, north)
  const FACE = { "1,0": 0, "-1,0": 1, "0,1": 2, "0,-1": 3 };   // given: a trapdoor's direction (east, west, south, north)
  if (Dt.corbel) for (const [k, b] of [...vox]) {   // corbels: under every roof stair that overhangs a wall, an upside-down stair (all along, or every other)
    if (!b.id.endsWith("_stairs") || b.s?.upside_down_bit) continue; const [x, y, z] = k.split(",").map(Number); if (y < STOREY || has(x, y - 1, z)) continue;
    const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][[0, 1, 2, 3].indexOf(b.s?.weirdo_direction)]; if (!d || !has(x + d[0], y - 1, z + d[1])) continue;   // given: four quarter turns (and the four ways a 4-direction field points)
    if (Dt.corbel === "alt" && (x + z) % 2) continue;
    put(x, y - 1, z, b.id, { weirdo_direction: b.s.weirdo_direction, upside_down_bit: true }); reactions.push("detail: corbels under the eaves");
  }
  const fronts = []; for (const w of m.windows) {
    const y0 = w.f * STOREY + DY[w.room], [ox, oz] = w.out, along = ox ? [0, 1] : [1, 0], X = w.x + ox * (1 + jet(w.f)), Z = w.z + oz * (1 + jet(w.f)), inward = UP[`${-ox},${-oz}`];
    if (Dt.hood && !has(X, y0 + 3, Z)) put(X, y0 + 3, Z, R.stairs.endsWith("_stairs") ? R.stairs : "minecraft:stone_brick_stairs", { weirdo_direction: inward, upside_down_bit: true });   // the window's hood   // vision: the detail's own measure (its courses and rhythms)
    if (Dt.sill && !has(X, y0 + 1, Z)) put(X, y0 + 1, Z, Dt.sill, { "minecraft:vertical_half": "top" });   // its sill: a slab at the window's foot
    if (Dt.shutters && golden(seed * 5 + w.x * 3 + w.z) < Dt.shutters) for (const s2 of [-1, 1]) { const sx = X + along[0] * s2, sz = Z + along[1] * s2; if (!has(sx, y0 + 2, sz) && has(sx - ox, y0 + 2, sz - oz)) put(sx, y0 + 2, sz, Dt.shutterWood ?? "minecraft:spruce_trapdoor", { direction: FACE[`${ox},${oz}`], open_bit: true, upside_down_bit: false }); }   // the shutters, open against the wall either side   // vision: the detail's own measure (its courses and rhythms)
    fronts.push(w);
  }
  if (Dt.timber && P.frame?.endsWith("_log")) for (const [k, b] of [...vox]) {   // the half-timber: studs every third block of an upper wall
    if (b.id !== P.upper) continue; const [x, y, z] = k.split(",").map(Number); if (y <= STOREY || (x + z) % FIB[3]) continue;   // vision: the detail's own measure (its courses and rhythms)
    put(x, y, z, P.frame, { pillar_axis: "y" }); reactions.push("detail: the half-timber's studs");
  }
  if (Dt.weather) for (const [k, b] of [...vox]) {   // the weather on the stone: moss low on the wall, a crack anywhere
    const v = WEATHER[b.id]; if (!v) continue; const [x, y, z] = k.split(",").map(Number), g = golden(x * 31 + y * 7 + z * 13 + seed);   // vision: the detail's own measure (its courses and rhythms)
    if (y <= FIB[2] && v.moss && g < Dt.weather) put(x, y, z, v.moss); else if (v.crack && g > 1 - Dt.weather / PHI ** 2) put(x, y, z, v.crack);
  }
  const fd = m.doors.find((d) => d.b === "out" && d.f === 0);
  if (fd && (Dt.doorHood || Dt.lantern === "door")) {   // the door's hood (a slab over it and either side) and a lantern hung under it
    const s = sideAt(fd.x, fd.z, 0), out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[s], along = out[0] ? [0, 1] : [1, 0], y0 = DY[m.rooms[fd.a].i];
    for (const s2 of [-1, 0, 1]) { const X = fd.x + out[0] + along[0] * s2, Z = fd.z + out[1] + along[1] * s2; if (!has(X, y0 + 3, Z)) put(X, y0 + 3, Z, R.slab ?? P.trim, R.slab ? { "minecraft:vertical_half": "top" } : null); }   // vision: the detail's own measure (its courses and rhythms)
    if (Dt.lantern === "door") { const X = fd.x + out[0] + along[0], Z = fd.z + out[1] + along[1]; if (!has(X, y0 + 2, Z)) put(X, y0 + 2, Z, "minecraft:lantern", { hanging: true }); }
    reactions.push("detail: a hood over the door");
  }
  if (Dt.lantern === "eaves") {   // a lantern at each corner of the eaves, hung from the lowest block over it
    for (const [x, z] of [[bx0 - 1, bz0 - 1], [bx1 + 1, bz0 - 1], [bx0 - 1, bz1 + 1], [bx1 + 1, bz1 + 1]]) { let low = Infinity; for (let y = STOREY; y < STOREY * FIB[4]; y++) if (has(x, y, z)) { low = y; break; } if (low !== Infinity && low > FIB[3] && !has(x, low - 1, z)) put(x, low - 1, z, "minecraft:lantern", { hanging: true }); }   // vision: the detail's own measure (its courses and rhythms)
    reactions.push("detail: lanterns under the eaves");
  }
  if (Dt.ridge) for (const [k, b] of [...vox]) {   // the ridge capped: a wall along the top of a pitched roof
    if (b.id !== R.slab) continue; const [x, y, z] = k.split(",").map(Number); if (y < STOREY + 1 || has(x, y + 1, z)) continue;
    const pitched = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => vox.get(`${x + a},${y},${z + c}`)?.id?.endsWith("_stairs") || vox.get(`${x + a},${y - 1},${z + c}`)?.id?.endsWith("_stairs")); if (!pitched) continue;
    put(x, y + 1, z, Dt.ridge); reactions.push("detail: the ridge capped");
  }
  // the street door's pots, and a bench by it, where people live
  const front = m.doors.find((d) => d.b === "out" && d.f === 0);
  if (front && kindOf(m.formula) !== "commercial") { const s = sideAt(front.x, front.z, 0), out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[s], along = out[0] ? [0, 1] : [1, 0]; put(front.x + out[0] + along[0] * 2, 1, front.z + out[1] + along[1] * 2, "minecraft:decorated_pot"); if (seedG(3) < 1 / PHI) put(front.x + out[0] - along[0] * 2, 1, front.z + out[1] - along[1] * 2, "minecraft:flower_pot"); }   // vision: the building's own measure (its rooms' cells, storeys and courses)
  // stilts and platforms: the whole house lifted on its posts (a ladder to the door)
  const LIFT = P.stilts ? FIB[4] - 1 : P.raised ? FIB[2] : 0;   // derived: four blocks of stilts over the water, a platform of two
  if (LIFT) {
    const lifted = new Map(); for (const [k, b] of vox) { const [x, y, z] = k.split(",").map(Number); lifted.set(`${x},${y + LIFT},${z}`, b); } vox.clear(); for (const [k, b] of lifted) vox.set(k, b);
    for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) { const k0 = `${x},${LIFT},${z}`; if (!vox.has(k0)) continue; const edge = !interior(0, x, z); if (P.stilts ? edge && (x - bx0) % 3 === 0 && (z - bz0) % 3 === 0 || (edge && (x === bx0 || x === bx1) && (z === bz0 || z === bz1)) : edge) for (let y = 0; y < LIFT; y++) put(x, y, z, P.stilts ? P.frame : P.plinth, P.stilts && P.frame.endsWith("_log") ? { pillar_axis: "y" } : null); }   // derived: a post every three along the edge (and at the corners)
    if (front) { const s = sideAt(front.x, front.z, 0), out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[s]; for (let y = 0; y < LIFT; y++) put(front.x + out[0], y + 1, front.z + out[1], "minecraft:ladder", { facing_direction: { n: 2, s: 3, w: 4, e: 5 }[s] }); put(front.x + out[0], LIFT, front.z + out[1], P.trim); }   // vision: the building's own measure (its rooms' cells, storeys and courses)
    reactions.push(P.stilts ? "stilts: the house on its posts" : "a platform: the house raised");
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0; for (const k of vox.keys()) { const [x, y, z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); y1 = Math.max(y1, y); }
  return { vox, checks, kind: kindOf(m.formula), formula: m.formula, size: { w: x1 - x0 + 1, l: z1 - z0 + 1, h: y1 + 1 }, reactions: [...new Set(reactions)], molecule: m, levels: DY };
}
/** The tricks that read off a shell alone (for buildings drawn by a grammar, world/grammar.js, which keeps no molecule):
 *  corbels under the eaves, the weather on the stone, lanterns at the eaves' corners, a capped ridge. */
export function detailVox(vox, tradition, seed = 0) {
  const Dt = DETAIL[tradition] ?? {}, has = (x, y, z) => vox.has(`${x},${y},${z}`), put = (x, y, z, id, st = null) => vox.set(`${x},${y},${z}`, { id, s: st }), notes = [];
  if (Dt.corbel) { let n = 0; for (const [k, b] of [...vox]) { if (!b.id.endsWith("_stairs") || b.s?.upside_down_bit) continue; const [x, y, z] = k.split(",").map(Number); if (y < STOREY || has(x, y - 1, z)) continue; const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][[0, 1, 2, 3].indexOf(b.s?.weirdo_direction)]; if (!d || !has(x + d[0], y - 1, z + d[1])) continue; if (Dt.corbel === "alt" && (x + z) % 2) continue; put(x, y - 1, z, b.id, { weirdo_direction: b.s.weirdo_direction, upside_down_bit: true }); n++; } if (n) notes.push("corbels under the eaves"); }   // given: four quarter turns (and the four ways a 4-direction field points)
  if (Dt.weather) for (const [k, b] of [...vox]) { const v = WEATHER[b.id]; if (!v) continue; const [x, y, z] = k.split(",").map(Number), g = golden(x * 31 + y * 7 + z * 13 + seed); if (y <= FIB[2] && v.moss && g < Dt.weather) put(x, y, z, v.moss); else if (v.crack && g > 1 - Dt.weather / PHI ** 2) put(x, y, z, v.crack); }   // vision: the detail's own measure (its courses and rhythms)
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const k of vox.keys()) { const [x, , z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  if (Dt.lantern === "eaves") { let n = 0; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { let low = Infinity; for (let y = FIB[3]; y < STOREY * FIB[4]; y++) if (has(x, y, z)) { low = y; break; } if (low !== Infinity && low > FIB[3] && !has(x, low - 1, z) && !has(x, low - 2, z)) { put(x, low - 1, z, "minecraft:lantern", { hanging: true }); n++; } } if (n) notes.push("lanterns under the eaves"); }   // vision: the detail's own measure (its courses and rhythms)
  if (Dt.ridge) { let n = 0; for (const [k, b] of [...vox]) { if (!b.id.endsWith("_slab")) continue; const [x, y, z] = k.split(",").map(Number); if (y < STOREY + 1 || has(x, y + 1, z)) continue; const pitched = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => vox.get(`${x + a},${y - 1},${z + c}`)?.id?.endsWith("_stairs")); if (!pitched) continue; put(x, y + 1, z, Dt.ridge); n++; } if (n) notes.push("the ridge capped"); }
  return notes;
}
// ---- each people's tricks (vision: after their builders; every id vanilla's, so the pack draws them)
//   corbel  "all" a soffit of upside-down stairs under the whole eave, "alt" every other (dentils)
//   hood    an upside-down stair over each window;  sill  the slab under it;  shutters  the share of windows with them
//   timber  studs in the upper walls;  weather  the share of low stone mossed;  doorHood / lantern  the door's hood, a
//   lantern by the door or under the eaves' corners;  ridge  the wall that caps a pitched ridge
export const DETAIL = {
  european: { corbel: "alt", hood: true, sill: "minecraft:smooth_stone_slab", shutters: 1 / PHI, shutterWood: "minecraft:spruce_trapdoor", timber: true, weather: 1 / PHI ** 3, doorHood: true, lantern: "door" },   // vision: the detail's own measure (its courses and rhythms)
  therans: { sill: "minecraft:smooth_quartz_slab", shutters: 1 / PHI, shutterWood: "minecraft:warped_trapdoor", weather: 0, doorHood: false },
  indian_ocean: { hood: true, sill: "minecraft:smooth_sandstone_slab", weather: 1 / PHI ** 4, doorHood: true },   // vision: the detail's own measure (its courses and rhythms)
  east_asian: { corbel: "all", ridge: "minecraft:deepslate_tile_wall", lantern: "eaves", weather: 1 / PHI ** 4 },   // vision: the detail's own measure (its courses and rhythms)
  japanese: { corbel: "all", ridge: "minecraft:deepslate_tile_wall", lantern: "eaves", sill: null, weather: 1 / PHI ** 4 },   // vision: the detail's own measure (its courses and rhythms)
  norse: { doorHood: true, weather: 1 / PHI ** 2 },
  dugout: { corbel: "alt", doorHood: true },
  birchbark: {},
  pacific: { corbel: "all" },
  shallow: { corbel: "alt", lantern: "eaves" },
  arctic: {},
};
const WEATHER = {
  "minecraft:stone_bricks": { moss: "minecraft:mossy_stone_bricks", crack: "minecraft:cracked_stone_bricks" }, "minecraft:cobblestone": { moss: "minecraft:mossy_cobblestone" },
  "minecraft:deepslate_bricks": { crack: "minecraft:cracked_deepslate_bricks" }, "minecraft:polished_blackstone_bricks": { crack: "minecraft:cracked_polished_blackstone_bricks" },
  "minecraft:mud_bricks": { moss: "minecraft:packed_mud" }, "minecraft:sandstone": { crack: "minecraft:smooth_sandstone" }, "minecraft:tuff_bricks": { moss: "minecraft:tuff" },
};   // given: vanilla's weathered kin of each stone
export { formulaOf };
