// Pure. Rooms as atoms, houses as molecules. A room is an atom whose size is wholly its needs: the
// cells of what it holds and the cell in front of each, in golden proportion. A culture's house is a
// molecule: its atoms bonded by the culture's own law, and folded to fit the ground it's given.
//
//   atoms     sleep    beds along a wall, an aisle in front: 3 cells a bed (min side 3: a bed and
//                      its aisle)
//             hearth   the fire and the table: a campfire with its ring clear (3 x 3) where the
//                      fire is indoors; else a stove on the wall, the table, a seat's room (2 x 3)
//             work     the workstation and room to work at it (2 x 2)
//             store    each store and its reach (2 cells a store, min 2 x 2)
//             entry    the door and a lobby to turn in (2 x 2), where the house is entered
//                      through a room of its own (court and stacked houses)
//             court    open to the sky, the house's middle (3 x 3 or 5 x 5)
//             well     a light well through every floor (2 x 2), where a house stacks
//   bonds     fused    every atom one room (their areas summed, one golden rectangle)
//             chain    atoms in a row, each sharing a wall with the next, a doorway in it
//             star     atoms in wings round the court, each with a doorway onto it
//             stack    atoms on floors, each floor a chain, bonded by a ladder (in the well)
//   density   a plot gives a footprint. Atoms that don't fit go up a floor, in the culture's order
//             (sleep first, as in a loft; stores last, as in a storeroom below), and a house that
//             stacks gets a stair. On open ground nothing needs to go up
//
// plan(...) gives the atoms placed: floors of rectangles (interior cells), each with its kind and
// what it holds, and the bonds between them. dwelling.js builds the voxels from a plan.
import { FIB, PHI } from "../core/golden.js";

export const ATOM = Object.freeze({
  sleep: (k) => ({ area: 3 * k, min: 3 }),             // derived: a bed two long and its aisle
  hearth: (indoor) => (indoor ? { area: 9, min: 3 } : { area: 6, min: 2 }),   // derived: a fire's ring (3 x 3), or a stove, a table and a seat
  work: () => ({ area: 4, min: 2 }),                   // derived: a workstation and its reach, room to work
  store: (k) => ({ area: Math.max(4, 2 * k), min: 2 }),   // derived: a store and its reach
  entry: () => ({ area: 4, min: 2 }),                  // derived: a door and room to turn
  court: (big) => ({ area: big ? 25 : 9, min: big ? 5 : 3, open: true }),   // derived: three or five across
  well: () => ({ area: 4, min: 2, open: true }),       // derived: two by two
});
// vision: each house law's bonds, the order atoms go up when they must, and what fuses
export const BONDS = {
  longhall: { bond: "fused", up: [] },
  twocell: { bond: "chain", order: ["hearth", "work", "store", "sleep"], up: ["sleep"] },
  stilt: { bond: "chain", order: ["hearth", "work", "store", "sleep"], up: ["sleep"] },
  court: { bond: "star", order: ["hearth", "work", "sleep", "store", "entry"], up: ["sleep"] },
  module: { bond: "chain", order: ["hearth", "work", "store", "sleep"], up: [], mats: true },
  akrotiri: { bond: "stack", floors: [["entry", "store", "work"], ["hearth", "sleep"]], up: ["sleep", "hearth"] },
};

/** The atoms a household needs. */
export function atomsOf(needs) {
  const a = [];
  const bedsPerRoom = FIB[4], rooms = Math.ceil(needs.beds / bedsPerRoom);   // vision: five beds a sleeping room at most
  for (let r = 0; r < rooms; r++) { const k = Math.min(bedsPerRoom, needs.beds - r * bedsPerRoom); a.push({ kind: "sleep", beds: k, ...ATOM.sleep(k) }); }
  a.push({ kind: "hearth", indoor: needs.fire === "hearth", ...ATOM.hearth(needs.fire === "hearth") });
  if (needs.work) a.push({ kind: "work", ...ATOM.work() });
  a.push({ kind: "store", stores: needs.stores, ...ATOM.store(needs.stores) });
  return a;
}
/** An atom's rectangle for a given depth (the molecule's shared side): width the area over it, at least its own minimum. */
const widthAt = (atom, depth) => (atom.kind === "sleep" ? Math.max(atom.min - 1, Math.ceil(atom.beds / (depth >= FIB[4] ? 2 : 1))) : Math.max(atom.min, Math.ceil(atom.area / depth)));   // beds a row wide, two rows where the room is five deep   // derived: a bed's length and its aisle (two rows where five deep)
/** The depth a chain shares: the golden short side of the chain's whole area, at least every atom's minimum. */
const depthOf = (atoms) => Math.max(...atoms.map((x) => x.min), Math.round(Math.sqrt(atoms.reduce((s, x) => s + x.area, 0) / PHI)));

/**
 * The house's plan: { floors: [[{ kind, x0, z0, x1, z1, ... }]], bonds: [{ a, b, at: {x, z, f} }], size: { w, l }, stair }.
 * law: a BONDS key; footprint: most cells on the ground (Infinity on open ground).
 */
export function plan(needs, law, footprint = Infinity) {
  const B = BONDS[law], atoms = atomsOf(needs);
  if (B.bond === "fused") { const area = atoms.reduce((s, x) => s + x.area, 0), d = FIB[4], w = Math.max(Math.round(d * PHI), Math.ceil(area / d)); return { floors: [[{ kind: "hall", holds: atoms, x0: 0, z0: 0, x1: w - 1, z1: d - 1 }]], bonds: [], size: { w, l: d } }; }   // derived: the hall five wide (bed, aisle, hearth, aisle, bed)
  if (B.bond === "star") return star(atoms, needs, B);
  // chain and stack: assign atoms to floors, then lay each floor as a chain on a common depth
  let floors;
  if (B.bond === "stack") floors = B.floors.map((kinds) => atoms.filter((a) => kinds.includes(a.kind)).concat(kinds.includes("entry") ? [{ kind: "entry", ...ATOM.entry() }] : []));
  else floors = [atoms.slice().sort((a, b) => B.order.indexOf(a.kind) - B.order.indexOf(b.kind))];
  // density: move atoms up, in the law's order, until the ground floor fits the footprint
  const area = (list) => list.reduce((s, x) => s + x.area, 0) * (1 + 1 / FIB[4]);   // vision: walls and doorways, a fifth more
  for (const kind of B.up) { if (area(floors[0]) <= footprint) break; const moving = floors[0].filter((a) => a.kind === kind); if (!moving.length) continue; floors[0] = floors[0].filter((a) => a.kind !== kind); (floors[1] ??= []).push(...moving); }
  const stacked = floors.length > 1;
  if (stacked) for (const f of floors) f.unshift({ kind: "well", ...ATOM.well() });   // a light well and its ladder on every floor, first in the row so they line up
  const depth = Math.max(...floors.map(depthOf)), out = [], bonds = [];
  let W = 0;
  floors.forEach((list, f) => {
    let x = 0; const row = [];
    for (const a of list) { const w = widthAt(a, depth); row.push({ ...a, x0: x, z0: 0, x1: x + w - 1, z1: depth - 1, f }); x += w + 1; }   // a wall between atoms
    W = Math.max(W, x - 1); out.push(row);
    for (let i = 0; i + 1 < row.length; i++) bonds.push({ a: row[i].kind, b: row[i + 1].kind, at: { x: row[i].x1 + 1, z: Math.floor(depth / 2), f } });
  });
  // every floor as long as the longest: the last atom of a short floor takes up the slack
  for (const row of out) { const last = row.at(-1); if (last.x1 < W - 1) last.x1 = W - 1; }
  return { floors: out, bonds, size: { w: W, l: depth }, stacked };
}
/** Wings round a court: hearth and work on the north, sleep down the sides, stores and the entry on the south. */
function star(atoms, needs, B) {
  const court = { kind: "court", ...ATOM.court(needs.beds > 6) }, D = Math.max(...atoms.map((a) => a.min), 3), Cs = court.min;   // derived: wings as deep as their deepest atom
  const side = { north: atoms.filter((a) => a.kind === "hearth" || a.kind === "work"), east: [], west: [], south: atoms.filter((a) => a.kind === "store").concat([{ kind: "entry", ...ATOM.entry() }]) };
  atoms.filter((a) => a.kind === "sleep").forEach((a, i) => side[i % 2 ? "west" : "east"].push(a));
  const need = (list) => list.reduce((s, a) => s + widthAt(a, D) + 1, -1);
  const S = Math.max(Cs, need(side.north) - 2 * (D + 1), need(side.south) - 2 * (D + 1), need(side.east), need(side.west));   // the court grows to give every wing its length
  const c0 = D + 1, c1 = c0 + S - 1, out = [], bonds = [], total = S + 2 * (D + 1);
  const lay = (list, horiz, fixed0, fixed1, a0, a1, wing) => { let x = a0; list.forEach((a, i) => { const w = i === list.length - 1 ? a1 - x + 1 : widthAt(a, D); out.push(horiz ? { ...a, x0: x, x1: x + w - 1, z0: fixed0, z1: fixed1, wing, f: 0 } : { ...a, z0: x, z1: x + w - 1, x0: fixed0, x1: fixed1, wing, f: 0 }); x += w + 1; }); };
  lay(side.north, true, 0, D - 1, 0, total - 1, "north"); lay(side.south, true, c1 + 2, c1 + 1 + D, 0, total - 1, "south");
  lay(side.east, false, c1 + 2, c1 + 1 + D, c0, c1, "east"); lay(side.west, false, 0, D - 1, c0, c1, "west");
  out.push({ ...court, x0: c0, z0: c0, x1: c1, z1: c1, f: 0 });
  for (const a of out) if (a.kind !== "court") bonds.push({ a: a.kind, b: "court", wing: a.wing, atom: a });
  return { floors: [out], bonds, size: { w: total, l: total }, court: { c0, c1 } };
}
