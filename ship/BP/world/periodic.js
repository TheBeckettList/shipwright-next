// Pure. The periodic table of rooms: a room for each element, and the element's own properties as the
// room's laws, so a building is a molecule and fitting one is chemistry.
//
//   valence (bonds)       the room's doors to other rooms. Every door joins two rooms; the first room is also
//                         entered from the street (an H). A valence left over opens a public room to the yard;
//                         in a private room the spare electrons pair up: one more window each
//   lone pairs            the room's windows. A lone pair wants room (VSEPR): a window must face open air, at
//                         least FIB[3] blocks of it, not a wall of its own house or a neighbour's
//   steric number         bonds + lone pairs: how the room's openings sit round it. Two sit opposite (linear),
//                         three or four take a wall each (trigonal, tetrahedral: the bent of water makes a
//                         bedroom chain turn a corner), five or six need the floor and the ceiling (a stair)
//   covalent radius       the room's side, in blocks: radius / 13 pm (a Fibonacci number of picometres: the
//                         bedroom, oxygen, comes out five across: three beds, their chests, the aisle). A metal's room
//                         is its cation's: in a building (a compound) a metal has given up its electrons to the street,
//                         and its radius is its ion's (Shannon, six-fold), so a shop is eight across, not thirteen
//   electronegativity     the room's privacy (Pauling). The street is reached through ever more private rooms:
//                         a room is entered from one less private than itself (the privacy gradient). Between
//                         two rooms the difference decides the join: under 0.4 they open into one another (no
//                         wall: two halls of carbon are one long hall), up to 1.7 a door, past it they never
//                         touch (ionic: a passage, beryllium, goes between)
//   noble gases           full shells: they bond with nothing, so they stand alone. A noble is a building of
//                         one room, open on every side (a pavilion on posts): the well house, the shrine kiosk,
//                         the market pavilion, the temple, the great temple. (Inside a house, neon still keeps
//                         the court's place, until the court is the hole in a ring of rooms)
//   metals                give their electrons up: public rooms, open-fronted to the street (shops, halls of
//                         work), never windowed, never private
//
// The table's rooms are vanilla-buildable; the data (Z, group, period, valence, radius, electronegativity)
// is the elements' own (covalent radii: Cordero et al. 2008; electronegativity: Pauling).
import { FIB, PHI } from "../core/golden.js";

// given: the elements' data. bonds = the usual number of bonds; e = valence electrons (main groups)
const E = [
  // sym, Z, group, period, bonds, e, radius pm, chi
  ["H", 1, 1, 1, 1, 1, 31, 2.2], ["He", 2, 18, 1, 0, 2, 28, null],   // given: the elements' own data (Z, group, period, bonds, valence electrons, covalent radius, electronegativity)
  ["Li", 3, 1, 2, 1, 1, 128, 0.98], ["Be", 4, 2, 2, 2, 2, 96, 1.57], ["B", 5, 13, 2, 3, 3, 84, 2.04], ["C", 6, 14, 2, 4, 4, 76, 2.55],   // given: the elements' own data (Z, group, period, bonds, valence electrons, covalent radius, electronegativity)
  ["N", 7, 15, 2, 3, 5, 71, 3.04], ["O", 8, 16, 2, 2, 6, 66, 3.44], ["F", 9, 17, 2, 1, 7, 57, 3.98], ["Ne", 10, 18, 2, 0, 8, 58, null],   // given: the elements' own data (Z, group, period, bonds, valence electrons, covalent radius, electronegativity)
  ["Na", 11, 1, 3, 1, 1, 166, 0.93], ["Mg", 12, 2, 3, 2, 2, 141, 1.31], ["Al", 13, 13, 3, 3, 3, 121, 1.61], ["Si", 14, 14, 3, 4, 4, 111, 1.9],   // given: the elements' own data (Z, group, period, bonds, valence electrons, covalent radius, electronegativity)
  ["P", 15, 15, 3, 3, 5, 107, 2.19], ["S", 16, 16, 3, 2, 6, 105, 2.58], ["Cl", 17, 17, 3, 1, 7, 102, 3.16], ["Ar", 18, 18, 3, 0, 8, 106, null],   // given: the elements' own data (Z, group, period, bonds, valence electrons, covalent radius, electronegativity)
  ["K", 19, 1, 4, 1, 1, 203, 0.82], ["Ca", 20, 2, 4, 2, 2, 176, 1.0], ["Fe", 26, 8, 4, 2, 8, 132, 1.83], ["Cu", 29, 11, 4, 2, 11, 132, 1.9],   // given: the elements' own data (Z, group, period, bonds, valence electrons, covalent radius, electronegativity)
  ["Kr", 36, 18, 4, 0, 8, 116, 3.0], ["Ag", 47, 11, 5, 1, 11, 145, 1.93], ["Xe", 54, 18, 5, 0, 8, 140, 2.6], ["Au", 79, 11, 6, 1, 11, 136, 2.54],   // given: the elements' own data (Z, group, period, bonds, valence electrons, covalent radius, electronegativity)
];
// vision: what each element's room is (the one choice per element), and what it holds
const ROLE = {
  H: { room: "the street door", holds: [] }, He: { room: "well house", holds: ["basin"] },
  Li: { room: "front room", holds: ["table"] }, Be: { room: "passage", holds: [] }, B: { room: "stair hall", holds: ["stair"] },
  C: { room: "hall", holds: ["table", "seat"] }, N: { room: "kitchen", holds: ["fire", "table"] }, O: { room: "bedroom", holds: ["bed", "bed", "bed"] },
  F: { room: "larder", holds: ["store", "store"] }, Ne: { room: "shrine kiosk", holds: ["basin", "lectern"] },
  Na: { room: "shop", holds: ["counter", "store"] }, Mg: { room: "workshop", holds: ["work", "store"] }, Al: { room: "byre", holds: ["hay"] },
  Si: { room: "storehouse", holds: ["store", "store", "store", "store"] }, P: { room: "bakehouse", holds: ["oven", "table"] },
  S: { room: "wash house", holds: ["basin"] }, Cl: { room: "latrine", holds: ["seat"] }, Ar: { room: "market pavilion", holds: ["counter", "store", "counter", "store"] },
  K: { room: "boathouse", holds: ["store", "store"] }, Ca: { room: "granary", holds: ["store", "store", "store"] },
  Fe: { room: "smithy", holds: ["forge", "anvil"] }, Cu: { room: "shrine", holds: ["basin", "lectern"] }, Kr: { room: "temple", holds: ["lectern", "basin"] }, Xe: { room: "great temple", holds: ["lectern", "basin", "basin"] },
  Ag: { room: "counting house", holds: ["counter", "store"] }, Au: { room: "throne hall", holds: ["seat", "table"] },
};
const METALS = new Set(["Li", "Be", "Na", "Mg", "Al", "K", "Ca", "Fe", "Cu", "Ag", "Au"]);
export const SCALE = FIB[6];   // derived: 13 pm a block (a Fibonacci number of picometres)
export const OPEN = 0.4, IONIC = 1.7;   // given: Pauling's lines: under 0.4 non-polar (the rooms open into one another), past 1.7 ionic (they never touch)
export const CLEAR = FIB[3];   // derived: three blocks of open air before a window (a lone pair's room)

// given: the metals' ionic radii (Shannon 1976, six-coordinate, pm): Li+ 76, Be2+ 45, Na+ 102, Mg2+ 72, Al3+ 54, K+ 138,
// Ca2+ 100, Fe2+ 78, Cu+ 77, Ag+ 115, Au+ 137
export const IONIC_R = { Li: 76, Be: 45, Na: 102, Mg: 72, Al: 54, K: 138, Ca: 100, Fe: 78, Cu: 77, Ag: 115, Au: 137 };   // given: Shannon's ionic radii
/** The table: every element's room. */
export const TABLE = Object.fromEntries(E.map(([sym, Z, group, period, bonds, e, r, chi]) => {
  const metal = METALS.has(sym), noble = group === 18;   // given: the four walls and the chemistry's own counts
  const lone = noble || metal || sym === "H" ? 0 : Math.max(0, (e - bonds) / 2);   // given: the lone pairs (main-group nonmetals)
  const side = Math.max(FIB[3], Math.min(FIB[7], Math.round((metal && IONIC_R[sym] ? IONIC_R[sym] : r) / SCALE)));   // derived: radius over 13 pm (a metal's its ion's), three to 21 blocks
  return [sym, { sym, Z, group, period, bonds, lone, steric: bonds + lone, side, chi: chi ?? Infinity, metal, noble, ...ROLE[sym] }];
}));

/** How two rooms join: "open" (one room), "door", or "apart" (a passage between them). */
export function joinOf(a, b) {
  const A = TABLE[a], B = TABLE[b];
  if (A.noble || B.noble) return "open";   // a court is outside: rooms open onto it
  const d = Math.abs(A.chi - B.chi);
  return d < OPEN ? "open" : d <= IONIC ? "door" : "apart";
}

// ---- molecules: a building is a formula and a backbone
/**
 * A household's formula, in the order its rooms are reached from the street (the privacy gradient: least
 * electronegative first). needs: { beds, fire, work, stores }; law: the culture's backbone.
 */
export function formulaOf(needs, law = "chain") {
  const bedrooms = Math.max(1, Math.ceil(needs.beds / TABLE.O.holds.length));   // a bedroom, oxygen, sleeps three
  const O = Array(bedrooms).fill("O"), F = needs.stores ? ["F"] : [];
  if (law === "hall") return [...Array(Math.max(2, Math.ceil(needs.beds / 3))).fill("C"), ...F];   // the hall house: a carbon chain, open into one long hall   // given: the four walls and the chemistry's own counts
  if (law === "stack") return [...(needs.work ? ["Mg"] : []), "Si", "B", "C", "N", ...O, ...F];   // the stacked house: work and the storehouse at the street (Akrotiri's storerooms), the stair, the household above
  const rooms = [...(needs.work ? ["Mg"] : []), "C", "N", ...O, ...F];
  return law === "court" ? ["Ne", ...rooms] : rooms;   // the court house: every room opens onto the court
}

// ---- stacking: which rooms must stand on the ground, which may rise, and how high a people builds
// necessity: the street (the metals' fronts), water (the wash house), beasts (the byre), boats, the heavy fire
// (the smithy, the bakehouse's oven), the stores' weight (storehouse, granary), the pit (the latrine).
// ability: the rest may rise, by electronegativity: the hall lowest, then the kitchen, the bedrooms, the larder
// under the roof (where the people lives above its work; elsewhere hall and kitchen stay down to meet the street). A building rises first, as far as its people builds high,
// each storey no larger than the ground it stands on, and spreads only when it must (what can't go up stays down).
export const GROUND = new Set(["Na", "Mg", "Al", "Si", "K", "Ca", "Fe", "P", "S", "Cl", "Ag", "Li"]);   // vision: the rooms that need the ground (see above)
export const STOREYS = { european: 3, indian_ocean: 3, therans: 3, east_asian: 2, japanese: 2, shallow: 1, norse: 1, birchbark: 1, pacific: 1, dugout: 1, arctic: 1 };   // vision: storeys of an ordinary town house, 1600s (the pinnacles go higher: world/pinnacle.js)
export const KITCHEN_UP = new Set(["therans"]);   // vision: Akrotiri's kitchens were upstairs, over the storerooms
const area = (sym) => TABLE[sym].side * (sym === "Be" ? 2 : TABLE[sym].side);
/** A household's rooms stacked: { floors: [[sym]], formula } (the formula with a stair hall between storeys). */
export function stackOf(needs, tradition = "european", { storeys = null, work = needs.work ? "Mg" : null, shop = false, skinny = false } = {}) {
  const S = storeys ?? STOREYS[tradition] ?? 1, bedrooms = Math.max(1, Math.ceil(needs.beds / TABLE.O.holds.length));
  const rooms = [...(shop ? ["Na"] : []), ...(work ? [work] : []), "C", "N", ...Array(bedrooms).fill("O"), ...(needs.stores ? ["F"] : [])];
  const ground = rooms.filter((r) => GROUND.has(r)), up = rooms.filter((r) => !GROUND.has(r));
  if (S <= 1) { const f = rooms.sort((a, b) => TABLE[a].chi - TABLE[b].chi); return { floors: [f], formula: f }; }   // one storey: everything spreads on the ground
  // the hall stays below to receive the street unless the people lives above its work (then the storehouse stays to receive it)
  const keep = KITCHEN_UP.has(tradition) ? [] : ["C", "N"];
  for (const k of keep) { const i = up.indexOf(k); if (i >= 0) { ground.push(k); up.splice(i, 1); } }
  if (!ground.length) ground.push(KITCHEN_UP.has(tradition) ? "Si" : up.splice(up.indexOf("C"), 1)[0]);   // the street needs a room to meet it: the storeroom where the people lives above, else the hall
  const budget = skinny ? Math.max(...ground.map(area)) : ground.reduce((a, r) => a + area(r), 0);   // a storey is no bigger than the ground it stands on (a skinny house: no bigger than its biggest room, a room or two a storey)
  const order = up.sort((a, b) => TABLE[a].chi - TABLE[b].chi), floors = [ground];   // the storeys fill from the bottom: the least private lowest, the most private highest
  let cur = [], used = 0;
  for (const r of order) { if (used + area(r) > budget && cur.length) { floors.push(cur); cur = []; used = 0; } cur.push(r); used += area(r); }
  if (cur.length) floors.push(cur);
  while (floors.length > S) { floors[0].push(...floors.pop()); }   // past its storeys it spreads
  while (floors.length > 1 && floors.at(-1).every((r) => joinOf("B", r) === "apart")) { const last = floors.pop(); floors.at(-1).push(...last); }   // a storey the stair can't reach (only rooms too private to meet a landing) joins the one below
  const byChi = (f) => f.sort((a, b) => TABLE[a].chi - TABLE[b].chi);
  const formula = floors.flatMap((f, i) => (i === 0 ? byChi(f) : ["B", ...byChi(f)]));
  return { floors: floors.map(byChi), formula };
}

/** Stack, and where a storey won't stand on the one below, spread: the top storey's last room comes down, until the house fits. */
export function fitStack(needs, tradition = "european", opts = {}) {
  const st = stackOf(needs, tradition, opts), floors = st.floors.map((f) => [...f]);
  const formulaOfFloors = (F) => F.flatMap((f, i) => (i === 0 ? [...f].sort((a, b) => TABLE[a].chi - TABLE[b].chi) : ["B", ...[...f].sort((a, b) => TABLE[a].chi - TABLE[b].chi)]));
  for (let guard = 0; guard < FIB[7]; guard++) {   // derived: twenty-one tries at most
    const m = assemble(formulaOfFloors(floors));
    if (!m.problems.length || floors.length === 1) return { floors, formula: m.formula, molecule: m };
    const top = floors.at(-1); floors[0].push(top.pop()); if (!top.length) floors.pop();
  }
  const m = assemble(formulaOfFloors(floors)); return { floors, formula: m.formula, molecule: m };
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // east, south, west, north: the four walls
export const CIRCULATION = new Set(["B", "Be"]);   // the stair hall and the passage: the ways between rooms, taken from any room (the gradient governs the rooms, not the ways)
const SEARCH = Math.round(FIB[10] * PHI ** FIB[3]);   // derived: 377 layouts (89 phi^3, the Fibonacci beyond the table's last; FIB[13] was past its end, so the search had no bound) tried at most before the best so far is taken
/**
 * Fit a molecule on the grid. Each room bonds to the latest room before it that still has a bond to give and
 * is no more private than it (so a monovalent room, a larder, ends a branch, and the privacy gradient holds by
 * construction); past an ionic gap a passage goes between. The walls each bond takes are searched (depth first,
 * straight on for linear rooms and rooms that open into one another, a quarter turn first for the rest) for the
 * layout that breaks the fewest laws. Returns { formula, rooms, bonds, doors, windows, problems }.
 */
export function assemble(formula, { street = [0, -1] } = {}) {
  const chain = [];
  for (const s of formula) { if (chain.length && joinOf(chain.at(-1), s) === "apart" && !TABLE[s].noble) chain.push("Be"); chain.push(s); }
  let best = null, tried = 0, steps = 0;
  const go = (rooms, bonds, k, floor) => {
    if (tried > SEARCH || (best && best.problems.length === 0) || (best && ++steps > SEARCH * FIB[5])) return;   // derived: and 8 placements a layout tried, dead ends too, before the best so far is taken
    if (k === chain.length) { tried++; const m = finish(chain, rooms, bonds, street); if (!best || m.problems.length < best.problems.length) best = m; return; }
    const sym = chain[k], T = TABLE[sym], w = T.side, l = sym === "Be" ? 2 : T.side;   // derived: a passage two wide (a door's width and a step)
    if (!rooms.length) { go([{ sym, i: 0, f: 0, x0: 0, z0: 0, x1: w - 1, z1: l - 1, used: [street] }], [], k + 1, 0); return; }   // the first room: its street wall kept for the door
    const spare = (r) => (TABLE[r.sym].noble ? 4 : TABLE[r.sym].bonds) - bonds.filter((b) => b.a === r.i || b.b === r.i).length - (r.i === 0 && !TABLE[r.sym].noble && !TABLE[r.sym].metal ? 1 : 0);   // the first room's street door takes a bond (a metal's front is its own: it gives its electrons to the street)   // given: the four walls and the chemistry's own counts
    const cands = rooms.filter((r) => r.f === floor && spare(r) > 0 && (T.metal || CIRCULATION.has(sym) || (TABLE[r.sym].noble ? 0 : TABLE[r.sym].chi) <= (T.noble ? 0 : T.chi) + OPEN)).reverse().sort((a, b) => TABLE[b.sym].noble - TABLE[a.sym].noble);   // round a court first (the star), then the latest room
    for (const prev of cands) {
      const P = TABLE[prev.sym], join = joinOf(prev.sym, sym), gap = join === "open" && !P.noble ? 0 : 1;
      const back = prev.from ? DIRS.findIndex((d) => d[0] === prev.from[0] && d[1] === prev.from[1]) : 0;
      const order = P.steric <= 2 || join === "open" ? [0, 1, 3, 2] : [1, 3, 0, 2];   // given: the four walls and the chemistry's own counts
      for (const o of order) {
        const d = DIRS[(back + o) % 4]; if (prev.used.some((u) => u[0] === d[0] && u[1] === d[1])) continue;   // given: the four walls and the chemistry's own counts
        let r;
        const cz = prev.z0 + Math.floor((prev.z1 - prev.z0 + 1 - l) / 2), cx = prev.x0 + Math.floor((prev.x1 - prev.x0 + 1 - w) / 2);   // centred on the wall they share (the door in its middle)
        if (d[0] === 1) r = { x0: prev.x1 + 1 + gap, z0: cz, x1: prev.x1 + gap + w, z1: cz + l - 1 };
        else if (d[0] === -1) r = { x0: prev.x0 - gap - w, z0: cz, x1: prev.x0 - 1 - gap, z1: cz + l - 1 };
        else if (d[1] === 1) r = { x0: cx, z0: prev.z1 + 1 + gap, x1: cx + w - 1, z1: prev.z1 + gap + l };
        else r = { x0: cx, z0: prev.z0 - gap - l, x1: cx + w - 1, z1: prev.z0 - 1 - gap };
        const hit = rooms.some((q) => q !== prev && q.f === prev.f && q.x0 <= r.x1 + 1 && r.x0 <= q.x1 + 1 && q.z0 <= r.z1 + 1 && r.z0 <= q.z1 + 1);   // nothing inside anything, a wall between all
        if (hit) continue;
        if (prev.f > 0) {   // a storey stands on the one below: every cell over a room or a wall of the floor beneath
          const below = rooms.filter((q) => q.f === prev.f - 1), held = (x, z) => below.some((q) => x >= q.x0 - 1 && x <= q.x1 + 1 && z >= q.z0 - 1 && z <= q.z1 + 1);
          let ok = true; for (let x = r.x0 - 1; x <= r.x1 + 1 && ok; x++) for (let z = r.z0 - 1; z <= r.z1 + 1 && ok; z++) if (!held(x, z)) ok = false;
          if (!ok) continue;
        }
        const room = { sym, i: rooms.length, f: prev.f, ...r, used: [[-d[0], -d[1]]], from: d };
        const R = rooms.map((q) => (q === prev ? { ...q, used: [...q.used, d] } : q)).concat([room]), Bn = bonds.concat([{ a: prev.i, b: room.i, join, dir: d }]);
        if (sym === "B") { const land = { ...room, i: R.length, f: room.f + 1, used: [], landing: true, from: null }; go(R.concat([land]), Bn.concat([{ a: room.i, b: land.i, join: "stair", dir: [0, 0] }]), k + 1, room.f + 1); }   // the stair hall's landing above: the rest go up
        else go(R, Bn, k + 1, floor);
      }
    }
    if (!best) { tried++; const m = finish(chain, rooms, bonds, street); m.problems.push(`${sym} (${T.room}) found no free wall`); best = m; }
  };
  go([], [], 0, 0);
  return best;
}
/** A layout's doors and windows, and the laws it breaks. */
function finish(chain, rooms0, bonds, street) {
  const rooms = rooms0.map((r) => ({ ...r, used: [...r.used] })), problems = [], doors = [], windows = [];
  const wallCells = (r, d) => { const out = []; if (d[0] === 1) for (let z = r.z0; z <= r.z1; z++) out.push([r.x1 + 1, z]); else if (d[0] === -1) for (let z = r.z0; z <= r.z1; z++) out.push([r.x0 - 1, z]); else if (d[1] === 1) for (let x = r.x0; x <= r.x1; x++) out.push([x, r.z1 + 1]); else for (let x = r.x0; x <= r.x1; x++) out.push([x, r.z0 - 1]); return out; };
  const occupied = (x, z, f) => rooms.some((o) => o.f === f && x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1);
  // the doors between rooms: on the shared wall, in the middle of its shared stretch
  for (const b of bonds) {
    if (b.join !== "door") continue;
    const r = rooms[b.b], cells = wallCells(r, [-b.dir[0], -b.dir[1]]).filter(([x, z]) => occupied(x - b.dir[0], z - b.dir[1], r.f));
    const c = cells[Math.floor(cells.length / 2)]; if (c) doors.push({ x: c[0], z: c[1], f: r.f, a: b.a, b: b.b }); else problems.push(`no shared wall for the door between ${rooms[b.a].sym} and ${r.sym}`);
  }
  const PUBLIC = TABLE.C.chi;   // given: carbon's electronegativity: a room no more private than the hall may open to the outside
  for (const r of rooms) {
    if (r.landing) continue;
    const T = TABLE[r.sym], bonded = bonds.filter((b) => b.a === r.i || b.b === r.i).length;
    const outsideWall = (d) => wallCells(r, d).every(([x, z]) => !occupied(x + d[0], z + d[1], r.f));
    const freeWalls = (incl = []) => DIRS.filter((d) => (!r.used.some((u) => u[0] === d[0] && u[1] === d[1]) || incl.some((u) => u[0] === d[0] && u[1] === d[1])) && outsideWall(d));
    let spare = T.noble ? 0 : Math.max(0, T.bonds - bonded - (r.i === 0 ? 1 : 0));
    // the street door (the first room's: its kept wall), and a public room's spare bond opens to the yard
    if (r.i === 0) { const d = street, cells = wallCells(r, d); if (!outsideWall(d)) problems.push("the street wall is built over"); else { const c = cells[Math.floor(cells.length / 2)]; doors.push({ x: c[0], z: c[1], f: 0, a: 0, b: "out" }); } }
    else if (r.f === 0 && T.metal) { const d = freeWalls()[0]; if (d) { const cells = wallCells(r, d), c = cells[Math.floor(cells.length / 2)]; doors.push({ x: c[0], z: c[1], f: 0, a: r.i, b: "out", front: true }); r.used.push(d); } else problems.push(`${r.sym} (${T.room}): no street front`); }   // a metal's front: its own door to the street
    else if (r.f === 0 && !T.noble && T.chi <= PUBLIC && spare) { const d = freeWalls()[0]; if (d) { const cells = wallCells(r, d), c = cells[Math.floor(cells.length / 2)]; doors.push({ x: c[0], z: c[1], f: 0, a: r.i, b: "out" }); r.used.push(d); spare--; } }
    if (T.noble) continue;
    // the windows: the lone pairs, and a private room's spare bonds paired into one more each; spread along the
    // walls that face open air, one to three blocks of wall at most (they repel); metals open their fronts instead
    const want = T.metal ? 0 : T.lone + (T.chi > PUBLIC ? spare : 0);
    const slots = []; for (const d of freeWalls()) { const cells = wallCells(r, d), n = Math.max(1, Math.floor(cells.length / CLEAR)); for (let k = 0; k < n; k++) { const c = cells[Math.floor(((k + 0.5) * cells.length) / n)]; if (!doors.some((q) => q.f === r.f && q.x === c[0] && q.z === c[1])) slots.push({ x: c[0], z: c[1], out: d }); } }
    for (let k = 0; k < want; k++) { const w = slots[k]; if (!w) { if (k < T.lone) problems.push(`${r.sym} (${T.room}): window ${k + 1} of ${T.lone} has no wall to the open air`); break; } windows.push({ ...w, f: r.f, room: r.i }); }   // the lone pairs' windows must be; the spare bonds' only where a wall faces the air
    if (T.steric > 4) problems.push(`${r.sym} (${T.room}): steric number ${T.steric}: needs a stair`);   // given: the four walls and the chemistry's own counts
  }
  // the privacy gradient (by construction, checked): every room entered from one no more private than itself
  const chiOf = (i) => (TABLE[rooms[i].sym].noble ? 0 : TABLE[rooms[i].sym].chi);
  for (const b of bonds) if (b.join !== "stair" && !CIRCULATION.has(rooms[b.b].sym) && !(TABLE[rooms[b.b].sym].metal && rooms[b.b].f === 0) && chiOf(b.a) > chiOf(b.b) + OPEN) problems.push(`${rooms[b.b].sym} (${TABLE[rooms[b.b].sym].room}) is entered through the more private ${TABLE[rooms[b.a].sym].room}`);
  const seen = new Set([0]), q = [0]; while (q.length) { const a = q.shift(); for (const b of bonds) { const n = b.a === a ? b.b : b.b === a ? b.a : null; if (n !== null && !seen.has(n)) { seen.add(n); q.push(n); } } }
  for (const r of rooms) if (!seen.has(r.i)) problems.push(`${r.sym} (${TABLE[r.sym].room}) can't be reached from the street`);
  return { formula: chain, rooms, bonds, doors, windows, problems };
}

/** A molecule's windows against the world: each needs CLEAR blocks of open air beyond it, free of every footprint given. */
export function windowsClear(mol, ox, oz, blocked) {
  const out = [];
  for (const w of mol.windows) for (let k = 1; k <= CLEAR; k++) { const x = ox + w.x + w.out[0] * k, z = oz + w.z + w.out[1] * k; if (blocked(x, z)) { out.push(w); break; } }
  return out;
}
