// Pure. The sizes of every people's boats, and what those sizes ask of the shore. No hulls are drawn here:
// the ships themselves are entity models (the ship module, after Shipwright's own: RP/entity), not blocks.
// This is the measure the module, the docks and the towns all share, at one block a metre.
//
//   classes   three, by the length a people builds to: small (fishing, ferrying, the canals: Fibonacci 8),
//             ship (coasting cargo, war, the island crossings: 21), great (the open sea: 34). Not every
//             people builds a great ship; those that don't cross open water in others' hulls (the League's,
//             the Therans')
//   a type    each people's own boat of a class, its length range and length-to-beam ratio the old
//             Shipwright plans' (themselves the historical hulls'); a single boat takes a length in its
//             range by its seed, so no two harbours' fleets are the same size
//   the hull  beam = length / (L:B); depth = beam / phi (a keel hull), beam / phi^2 (a flat one); draft =
//             depth / phi. Masts: length / phi for the mainmast, the rest a step down each
//   crew      rowers: a pair to each room (a metre's oar spacing) between the ends, an end a length / phi^3;
//             paddlers: a file (two abreast past a beam of two); sailors: a hand to each 13 blocks of deck
//   cargo     the hold, length x beam x depth x the hull's fullness, in chests of 13 blocks
//   berths    what the boat asks of the shore: a boathouse (length + 2 by beam + 2, no ship past 21 under
//             one roof), a slip (length + 3 by beam + 4), a quay's run (length + 2, the fender gap) and its
//             depth alongside (draft + 1), a mooring's swing (length + 3 x the water's depth: the scope)
import { FIB, PHI } from "../core/golden.js";

export const CLASSES = {
  small: { nominal: FIB[5], range: [4, 10], reach: "inshore", use: "fishing, ferrying, the canals and creeks" },   // given: Shipwright's small plans (4 to 10 blocks)
  ship: { nominal: FIB[7], range: [12, 22], reach: "coastal", use: "coasting cargo, war, the island crossings" },   // given: Shipwright's ship plans (12 to 22 blocks)
  great: { nominal: FIB[8], range: [28, 40], reach: "ocean", use: "the open sea: the long trade, the flagships" },   // given: Shipwright's great plans (28 to 40 blocks)
};
export const REACH = ["inshore", "coastal", "sea", "ocean"];   // inshore, along a coast, island to island across open sea, the open ocean

// given: each people's boats (Shipwright's plans: range, typical L:B, fullness; the rig, the drive, the reach the
// historical type kept). drive: oars, paddles, sail, or both ("oars+sail"); masts for the great ships' count
const T = (name, cls, range, lb, full, drive, reach, more = {}) => ({ name, cls, range, lb, full, drive, reach, flat: false, masts: drive.includes("sail") ? 1 : 0, ...more });
export const FLEETS = {
  norse: [T("faering", "small", [4, 10], 4.25, 0.45, "oars", "inshore"), T("longship", "ship", [12, 20], 6.75, 0.45, "oars+sail", "sea"), T("skeid", "great", [28, 40], 7.5, 0.45, "oars+sail", "sea")],   // given: the Norse hulls (Skuldelev, Roskilde 6)
  european: [T("rowboat", "small", [4, 7], 3.25, 0.55, "oars", "inshore"), T("cog", "ship", [12, 22], 3.15, 0.6, "sail", "coastal"), T("carrack", "great", [28, 40], 3, 0.6, "sail", "ocean", { masts: 3 })],   // given: the cog (Bremen), the carrack
  therans: [T("skiff", "small", [4, 8], 4, 0.45, "paddles", "inshore"), T("Theran ship", "ship", [14, 22], 6, 0.5, "oars+sail", "sea"), T("flagship", "great", [28, 35], 7, 0.5, "oars+sail", "sea")],   // given: the Ship Procession fresco (Akrotiri): the hulls' estimated lengths and paddled crews
  indian_ocean: [T("sewn boat", "small", [5, 10], 3.75, 0.5, "sail", "inshore"), T("dhow", "ship", [12, 22], 3.75, 0.55, "sail", "sea"), T("baghlah", "great", [28, 40], 3.5, 0.6, "sail", "ocean", { masts: 2 })],   // given: the sewn boat, the dhow, the baghlah
  east_asian: [T("sampan", "small", [4, 8], 3.25, 0.6, "oars", "inshore", { flat: true }), T("junk", "ship", [12, 22], 3.25, 0.65, "sail", "sea", { flat: true, masts: 3 }), T("fuchuan", "great", [28, 40], 3.2, 0.65, "sail", "ocean", { masts: 5 })],   // given: the sampan, the junk, the Fujian ship
  japanese: [T("wasen", "small", [5, 9], 4.5, 0.5, "oars", "inshore"), T("bezaisen", "ship", [12, 22], 3.75, 0.6, "sail", "coastal"), T("shuinsen", "great", [28, 40], 3.4, 0.6, "sail", "ocean", { masts: 2 })],   // given: the wasen, the bezaisen, the red-seal ship
  pacific: [T("outrigger", "small", [5, 9], 7, 0.35, "paddles+sail", "coastal"), T("voyaging canoe", "ship", [12, 22], 7.5, 0.35, "paddles+sail", "ocean"), T("drua", "great", [28, 40], 8, 0.35, "sail", "ocean")],   // given: the outrigger, the double voyaging canoe, the Fijian drua
  dugout: [T("dugout", "small", [4, 9], 6, 0.45, "paddles", "inshore"), T("war canoe", "ship", [12, 20], 8, 0.4, "paddles", "coastal")],   // given: the Northwest Coast canoes (no great ship: they cross in others')
  birchbark: [T("bark canoe", "small", [4, 8], 5.75, 0.4, "paddles", "inshore"), T("freight canoe", "ship", [12, 18], 6, 0.4, "paddles", "coastal")],   // given: the bark canoe, the canot du maître
  shallow: [T("punt", "small", [4, 8], 4.5, 0.7, "poles", "inshore", { flat: true }), T("flatboat", "ship", [12, 20], 3.5, 0.75, "poles", "inshore", { flat: true })],   // given: the punt, the flatboat (river and lagoon only)
  league: [T("monoreme", "small", [6, 10], 6, 0.42, "oars+sail", "coastal"), T("bireme", "ship", [14, 22], 7, 0.42, "oars+sail", "sea"), T("trireme", "great", [30, 38], 8, 0.4, "oars+sail", "sea")],   // given: the oared galleys (the penteconter, the Phoenician bireme, the Olympias trireme: 37 m by 5.5, three banks)
  arctic: [T("kayak", "small", [4, 6], 6.5, 0.4, "paddles", "coastal"), T("umiak", "ship", [12, 16], 4, 0.45, "paddles+sail", "coastal")],   // given: the kayak, the umiak
};

/** A boat's measure: a type of a people's, its length the seed's within the range (or the typical: the range's geometric mean). */
export function sizeOf(type, seed = null) {
  const [lo, hi] = type.range, mean = Math.sqrt(lo * hi);   // derived: the geometric mean (the range's middle on the ratio scale)
  const L = seed == null ? Math.round(mean) : Math.round(lo + (((seed * PHI) % 1) * (hi - lo)));   // derived: the seed's golden step through the range
  const B = Math.max(1, Math.round(L / type.lb)), depth = Math.max(1, Math.round(B / (type.flat ? PHI * PHI : PHI))), draft = Math.max(1, Math.round(depth / PHI));
  const main = type.masts ? Math.round(L / PHI) : 0, masts = Array.from({ length: type.masts }, (_, k) => Math.round(main / PHI ** (k === 0 ? 0 : Math.min(k, 2) / 2)));   // derived: the main a length over phi; the fore and mizzen a half-step down, the rest a step
  const end = L / PHI ** 3, rooms = Math.max(1, Math.floor(L - 2 * end));   // derived: the ends a length over phi cubed; a room a metre
  const rowers = type.drive.includes("oars") ? 2 * rooms : 0, paddlers = /paddles|poles/.test(type.drive) ? rooms * (B > 2 ? 2 : 1) : 0;
  const sailors = type.drive.includes("sail") ? Math.max(2, Math.round((L * B) / FIB[6])) : 0;   // derived: a hand to each 13 blocks of deck
  const crew = Math.max(1, rowers + paddlers + (rowers || paddlers ? Math.ceil(sailors / PHI ** 2) : sailors));   // derived: a pulled boat's sail is worked by its own rowers, with a few hands more
  const cargo = Math.max(1, Math.round((L * B * depth * type.full) / FIB[6]));   // derived: chests of 13 blocks of hold
  return { name: type.name, cls: type.cls, L, B, depth, draft, masts, crew, cargo, drive: type.drive, reach: type.reach, ...berthOf({ L, B, draft }) };
}

/** What a boat asks of the shore. */
export function berthOf({ L, B, draft }) {
  const housed = L <= FIB[7];   // vision: no ship past 21 under one roof
  return {
    boathouse: housed ? { w: B + 2, l: L + 2, h: FIB[3] + (L > FIB[5] ? 1 : 0) } : null,   // derived: an aisle a side and at the ends; the masts unstepped, three clear (four past eight)
    slip: { w: B + FIB[2] * 2, l: L + FIB[3] },   // derived: the ways and the staging a side; the boat's length and three for the cradle
    quay: { run: L + 2, depth: draft + 1 },   // derived: the fender gap; a block under the keel
    swing: L + FIB[3] * (draft + 1),   // given: three times the water's depth of cable (the seaman's least scope)
    channel: B + 2,   // derived: a block clear a side
  };
}

/** Each people's boats at their typical sizes. */
export const sizes = (t) => (FLEETS[t] ?? FLEETS.european).map((x) => sizeOf(x));
/** The type a fleet's kind sails (world/ships.js fleetOf: small, cargo, war), by the people's temper. */
export function typeFor(t, kind, temper = "peaceful") {
  const F = FLEETS[t] ?? FLEETS.european, by = (c) => F.find((x) => x.cls === c);
  if (kind === "small") return by("small");
  if (kind === "cargo") return (temper === "traders" && by("great")) || by("ship");
  return (temper === "raiders" && by("great")) || by("ship");   // war: the ship; the great hull only where raiding is the people's life
}

// ---- the shore a fleet needs
// how a people keeps its boats out of the water (given: the historical practice): under a roof, drawn up on
// the beach or racks, or afloat at a quay
export const KEEPING = {
  norse: "naust", japanese: "funaya", birchbark: "racks", dugout: "beach", pacific: "canoe house", arctic: "racks",   // given: the naust, the funaya (boathouses under the house), the canoe racks and beaches, the Pacific canoe house
  european: "quay", indian_ocean: "quay", east_asian: "quay", therans: "quay", shallow: "landing",   // given: the quayed harbours; the lagoon's landings
};
/** The waterfront a fleet asks: counts by class -> berths, roofs, slips, the quays' run and the basin's depth. */
export function harbourOf(t, fleet = {}, { seed = 0, temper = "peaceful" } = {}) {
  const keep = KEEPING[t] ?? "quay", out = { keep, boathouses: [], racks: 0, beach: 0, quay: 0, depth: 1, slips: [], basin: 0, channel: 1 };
  let k = seed;
  for (const [kind, n] of Object.entries(fleet)) for (let i = 0; i < n; i++) {
    const s = sizeOf(typeFor(t, kind, temper), k++);
    const roofed = (keep === "naust" || keep === "funaya" || keep === "canoe house") && s.boathouse;
    if (roofed) out.boathouses.push(s.boathouse);
    else if (keep === "racks" && s.L <= FIB[6]) out.racks += s.L + 1;   // derived: a rack's length a boat and a block
    else if (keep === "beach" || keep === "landing" || keep === "racks") out.beach += s.B + 2;   // derived: drawn up side by side, a block between
    else out.quay += s.quay.run;
    out.depth = Math.max(out.depth, s.quay.depth); out.channel = Math.max(out.channel, s.channel);
    out.basin += s.L * (s.B + 2);   // derived: the water each boat takes, lying or turning
  }
  const biggest = Object.keys(fleet).filter((kind) => fleet[kind] > 0).map((kind) => sizeOf(typeFor(t, kind, temper)));
  const yard = biggest.sort((a, b) => b.L - a.L)[0];
  if (yard) out.slips.push(yard.slip);   // one slip, for the biggest the people builds
  return out;
}
