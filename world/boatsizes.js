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
//             depth / phi. Masts: length / phi for the mainmast, the rest a step down each. The whole-block
//             figures are the shore's (berths, quays, the hold's volume); `exact` carries the hull itself to
//             the pixel (1/16 block, the model's own quantum: rounding a 2-block beam breaks the law), by its
//             form (D-004): keel B/phi; flat, open (keel-less canoes) and norse (clinker, beam/depth 2.3-2.7)
//             B/phi^2; freeboard = depth - draft = depth/phi^2, against the need of its reach: half the
//             significant wave of the reach's design wind (core/sea.js), green water coming aboard when the
//             crest clears the rail. Short of it, a washstrake or bulwark makes up the rest (wash)
//   crew      rowers: a pair to each room (a metre's oar spacing) between the ends, an end a length / phi^3;
//             paddlers: a file (two abreast past a beam of two); sailors: a hand to each 13 blocks of deck
//   cargo     the hold, length x beam x depth x the hull's fullness, in chests of 13 blocks
//   berths    what the boat asks of the shore: a boathouse (length + 2 by beam + 2, no ship past 21 under
//             one roof), a slip (length + 3 by beam + 4), a quay's run (length + 2, the fender gap) and its
//             depth alongside (draft + 1), a mooring's swing (length + 3 x the water's depth: the scope)
import { FIB, PHI } from "../core/golden.js";
import { VISION } from "../core/given.js";
import { seaState } from "../core/sea.js";
import { TRIAL, hullOf, pullSpeed } from "../core/boat.js";

export const CLASSES = {
  small: { nominal: FIB[5], range: [4, 10], reach: "inshore", use: "fishing, ferrying, the canals and creeks" },   // given: Shipwright's small plans (4 to 10 blocks)
  ship: { nominal: FIB[7], range: [12, 22], reach: "coastal", use: "coasting cargo, war, the island crossings" },   // given: Shipwright's ship plans (12 to 22 blocks)
  great: { nominal: FIB[8], range: [28, 40], reach: "ocean", use: "the open sea: the long trade, the flagships" },   // given: Shipwright's great plans (28 to 40 blocks)
};
export const REACH = ["inshore", "coastal", "sea", "ocean"];   // inshore, along a coast, island to island across open sea, the open ocean
// The design wind of each reach (m/s), from the world's own winds: inshore the trials' light breeze, coastal the
// trades' working wind, sea the westerlies, ocean the westerlies in a gust (chief.md section 2)
const belt = (name) => VISION.BELTS.find((b) => b[1] === name)[2];
export const DESIGN_WIND = { inshore: TRIAL.WINDS[0], coastal: belt("trades"), sea: belt("westerlies"), ocean: belt("westerlies") * (1 + VISION.GUST) };
/** The freeboard a reach asks (blocks): half its design wave, the crest that would clear the rail. */
export const freeboardNeed = (reach) => seaState(DESIGN_WIND[reach] ?? DESIGN_WIND.ocean).Hs / 2;
// Depth by form (D-004): the depth a beam gives, as a power of phi
export const FORM_DEPTH = { keel: PHI, flat: PHI * PHI, open: PHI * PHI, norse: PHI * PHI };
const px = (v) => Math.round(v * 16) / 16;   // given: 16 pixels to a block, the model's quantum

// given: each people's boats (Shipwright's plans: range, typical L:B, fullness; the rig, the drive, the reach the
// historical type kept). drive: oars, paddles, sail, or both ("oars+sail"); masts for the great ships' count
const T = (name, cls, range, lb, full, drive, reach, more = {}) => ({ name, cls, range, lb, full, drive, reach, flat: false, masts: drive.includes("sail") ? 1 : 0, ...more, form: more.form ?? (more.flat ? "flat" : "keel") });
export const FLEETS = {
  norse: [T("faering", "small", [4, 10], 4.25, 0.45, "oars", "inshore", { form: "norse" }), T("longship", "ship", [12, 20], 6.75, 0.45, "oars+sail", "sea", { form: "norse" }), T("skeid", "great", [28, 40], 7.5, 0.45, "oars+sail", "sea", { form: "norse" })],   // given: the Norse hulls (Skuldelev, Roskilde 6); their beam/depth runs 2.3-2.7 (northern.md)
  european: [T("rowboat", "small", [4, 7], 3.25, 0.55, "oars", "inshore"), T("cog", "ship", [12, 22], 3.15, 0.6, "sail", "coastal"), T("carrack", "great", [28, 40], 3, 0.6, "sail", "ocean", { masts: 3 })],   // given: the cog (Bremen), the carrack
  therans: [T("skiff", "small", [4, 8], 4, 0.45, "paddles", "inshore"), T("Theran ship", "ship", [14, 22], 6, 0.5, "oars+sail", "sea"), T("flagship", "great", [28, 35], 7, 0.5, "oars+sail", "sea")],   // given: the Ship Procession fresco (Akrotiri): the hulls' estimated lengths and paddled crews
  indian_ocean: [T("sewn boat", "small", [5, 10], 3.75, 0.5, "sail", "inshore"), T("dhow", "ship", [12, 22], 3.75, 0.55, "sail", "sea"), T("baghlah", "great", [28, 40], 3.5, 0.6, "sail", "ocean", { masts: 2 })],   // given: the sewn boat, the dhow, the baghlah
  east_asian: [T("sampan", "small", [4, 8], 3.25, 0.6, "oars", "inshore", { flat: true }), T("junk", "ship", [12, 22], 3.25, 0.65, "sail", "sea", { flat: true, masts: 3 }), T("fuchuan", "great", [28, 40], 3.2, 0.65, "sail", "ocean", { masts: 5 })],   // given: the sampan, the junk, the Fujian ship
  japanese: [T("wasen", "small", [5, 9], 4.5, 0.5, "oars", "inshore"), T("bezaisen", "ship", [12, 22], 3.75, 0.6, "sail", "coastal", { form: "flat" }), T("shuinsen", "great", [28, 40], 3.4, 0.6, "sail", "ocean", { masts: 2 })],   // given: the wasen, the bezaisen (its broad shiki bottom: flat in form, eastasian_pacific.md), the red-seal ship
  pacific: [T("outrigger", "small", [5, 9], 7, 0.35, "paddles+sail", "coastal"), T("voyaging canoe", "ship", [12, 22], 7.5, 0.35, "paddles+sail", "ocean", { hullReach: "coastal" }), T("drua", "great", [28, 40], 8, 0.35, "sail", "ocean", { hullReach: "coastal" })],   // given: the outrigger, the double voyaging canoe, the Fijian drua; vision: the twins' closed hulls are held to the working sea (coastal), wet by design, the platform riding over the ocean's (chief.md section 2, eastasian_pacific.md L3)
  dugout: [T("dugout", "small", [4, 9], 6, 0.45, "paddles", "inshore", { form: "open" }), T("war canoe", "ship", [12, 20], 8, 0.4, "paddles", "coastal", { form: "open" })],   // given: the Northwest Coast canoes (no great ship: they cross in others'); open keel-less hulls, beam/depth 2.4-2.9 (inland.md)
  birchbark: [T("bark canoe", "small", [4, 8], 5.75, 0.4, "paddles", "inshore", { form: "open" }), T("freight canoe", "ship", [12, 18], 6, 0.4, "paddles", "coastal", { form: "open" })],   // given: the bark canoe, the canot du maître (open, keel-less)
  shallow: [T("punt", "small", [4, 8], 4.5, 0.7, "poles", "inshore", { flat: true }), T("flatboat", "ship", [12, 20], 3.5, 0.75, "poles", "inshore", { flat: true })],   // given: the punt, the flatboat (river and lagoon only)
  // The League (league.md): its -remes all great, each sized by its route (freeboard over the route's working sea,
  // stores for its longest open leg: routeLength); its ship class and small craft by the need they meet. role is the
  // job (world/league.js ROLES), banks the files of oars a side (a hemiolia's half file forward)
  league: [
    T("keles", "small", [8, 10], 6, 0.42, "oars+sail", "coastal", { galley: true, banks: 1, role: "dispatch" }),   // given: the single-banked "racehorse" (Thucydides 4.120: Brasidas crosses in a keles); vision: the presidency's courier
    T("skaphe", "small", [5, 8], 3.25, 0.55, "oars", "inshore", { role: "tender" }),   // given: the ship's boat and harbour lighter (Casson, SSAW; Latin scapha); vision: lighterage at the shallow seats, the diving bell's boat
    T("hemiolia", "ship", [16, 21], 7, 0.42, "oars+sail", "coastal", { galley: true, banks: 1.5, role: "guard" }),   // given: the "one-and-a-half", the pirate craft and the craft built to catch pirates (Casson, SSAW); vision: harbour guard, pirate chaser
    T("kerkouros", "ship", [18, 22], 5, 0.5, "oars+sail", "coastal", { galley: true, banks: 1, role: "coaster" }),   // given: the oared Levantine/Cypriot heavy transport, later in Ptolemaic service (Casson, SSAW); vision: the coaster between the deep seats
    T("monoreme", "great", [28, 30], 6, 0.42, "oars+sail", "sea", { galley: true, banks: 1, role: "victualler" }),   // given: the penteconter, the Phocaeans' long-haul ship (Herodotus 1.163); derived: the sea and payload laws (league.md section 2)
    T("bireme", "great", [30, 34], 7, 0.42, "oars+sail", "sea", { galley: true, banks: 2, role: "carrier" }),   // given: the Phoenician merchant-warship (Sennacherib's reliefs, Nineveh); derived: each takes its route's sea, routeLength
    T("trireme", "great", [36, 38], 8, 0.4, "oars+sail", "sea", { galley: true, banks: 3, role: "month-ship", masts: 2 }),   // given: the Olympias (36.9 m by 5.45), the Zea shipsheds (about 37 m; Blackman & Rankov 2013), the akateion forward (the naval inventories); derived: Thera's sea
  ],
  arctic: [T("kayak", "small", [4, 6], 6.5, 0.4, "paddles", "coastal", { form: "flat" }), T("umiak", "ship", [12, 16], 4, 0.45, "paddles+sail", "coastal", { form: "flat" })],   // given: the kayak, the umiak (hard-chine skin boats: flat in form, northern.md)
};

/** A boat's measure: a type of a people's, its length the seed's within the range (or the typical: the range's geometric mean). */
export function sizeOf(type, seed = null) {
  const [lo, hi] = type.range, mean = Math.sqrt(lo * hi);   // derived: the geometric mean (the range's middle on the ratio scale)
  const L = seed == null ? Math.round(mean) : Math.round(lo + (((seed * PHI) % 1) * (hi - lo)));   // derived: the seed's golden step through the range
  const B = Math.max(1, Math.round(L / type.lb)), depth = Math.max(1, Math.round(B / (type.flat ? PHI * PHI : PHI))), draft = Math.max(1, Math.round(depth / PHI));
  const main = type.masts ? Math.round(L / PHI) : 0, masts = Array.from({ length: type.masts }, (_, k) => Math.round(main / PHI ** (k === 0 ? 0 : Math.min(k, 2) / 2)));   // derived: the main a length over phi; the fore and mizzen a half-step down, the rest a step
  const galley = !!type.galley, banks = type.banks ?? 1;
  const end = L / PHI ** (galley ? 4 : 3), rooms = Math.max(1, Math.floor(L - 2 * end));   // derived: the ends a length over phi cubed; a room a metre. vision (league.md section 2): a galley's rowers fill her, her ends a step shorter (L/phi^4)
  const rowers = type.drive.includes("oars") ? Math.round(2 * rooms * banks) : 0, paddlers = /paddles|poles/.test(type.drive) ? rooms * (B > 2 ? 2 : 1) : 0;   // derived: a pair to each room for each bank
  const marines = galley ? Math.round(rowers / PHI ** 4) : 0;   // vision: a galley's deck crew, marines and archers, rowers/phi^4 (given check: the Olympias, 170 rowers and 30 more)
  const sailors = type.drive.includes("sail") ? Math.max(2, Math.round((L * (galley ? L / type.lb : B)) / FIB[6])) : 0;   // derived: a hand to each 13 blocks of deck (a galley's deck to the pixel: league.md's crews)
  const crew = Math.max(1, rowers + paddlers + marines + (rowers || paddlers ? Math.ceil(sailors / PHI ** 2) : sailors));   // derived: a pulled boat's sail is worked by its own rowers, with a few hands more
  const cargo = Math.max(1, Math.round((L * B * depth * type.full) / FIB[6]));   // derived: chests of 13 blocks of hold
  return { name: type.name, cls: type.cls, L, B, depth, draft, masts, crew, cargo, drive: type.drive, reach: type.reach, form: type.form, exact: exactOf(type, L), ...(galley ? { oars: { rooms, banks, rowers, marines }, role: type.role } : {}), ...berthOf({ L, B, draft }) };
}

// ---- a galley sized by her route (league.md section 2)
export const GALLEY = Object.freeze({
  RATION: 0.015,   // given: m^3 a crew-day: about 8 L of water (a litre an hour at the oar; Morrison, Coates & Rankov, The Athenian Trireme, 2000) and a choinix of grain (Herodotus 7.187), the amphorae filling 1/phi of the space (vision)
  HALVES: 2 ** (-1 / 3),   // given: galleys cross open water rowing by halves (Thucydides 3.49): half the power at P ~ v^3 is 2^(-1/3) of the speed
  DAY_S: 1200,   // given: a Minecraft day, seconds (the world's EAT clock)
});
const CARRIES = new Set(["carrier", "victualler", "coaster"]);   // vision: the hulls that carry payload keep 1/phi^2 of their free hold for stores, the rest for cargo
/** The length a galley takes for her route: the least in her range whose freeboard clears the route's working sea
 * (Hs/2, the crest) and whose free hold carries her crew's stores for its longest open leg (blocks), with phi in hand
 * for contrary weather. Hs: the route's design sea (blocks; core/sea.js seaState of its windier end's wind). */
export function routeLength(type, { Hs = 0, leg = 0 } = {}) {
  const [lo, hi] = type.range, banks = type.banks ?? 1;
  const sea = (Hs / 2) * type.lb * (FORM_DEPTH[type.form] ?? PHI) * PHI * PHI;   // derived: freeboard B/(form phi^2) = L/(lb form phi^2) over the crest
  const k = CARRIES.has(type.role) ? PHI ** -2 : 1 / PHI;   // vision: the share of free hold stores may take
  const stores = (L) => {
    if (!leg) return true;
    const s = sizeOf({ ...type, range: [L, L] }), x = exactOf(type, L);
    const pull = pullSpeed(hullOf({ L, lb: type.lb, full: type.full, pull: "oars", pullers: s.oars?.rowers ?? s.crew, depth: x.depth }));
    const days = leg / (pull * GALLEY.HALVES * GALLEY.DAY_S);   // derived: rowing by halves across the leg
    return s.crew * days * PHI * GALLEY.RATION <= (k * L * x.B * x.depth * type.full) / PHI ** banks;   // vision: each bank of rowers takes a golden step of the hull
  };
  for (let L = Math.max(lo, Math.ceil(sea)); L <= hi; L++) if (stores(L)) return L;
  return hi;
}

// D-004: the hull to the pixel, by its form
/** The hull itself at a length, to the pixel: beam, depth by form, draught, freeboard, the reach's need, and the
 * washstrake that makes up any shortfall (none on a decked kayak: the sea runs off her). */
export function exactOf(type, L) {
  const B = px(L / type.lb), depth = px(B / (FORM_DEPTH[type.form] ?? PHI)), draft = px(depth / PHI), freeboard = px(depth - draft);   // derived: the law's proportions
  const need = px(freeboardNeed(type.hullReach ?? type.reach));
  const wash = type.name === "kayak" ? 0 : Math.max(0, px(need - freeboard));   // given: the kayak's deck sheds the sea (chief.md section 2)
  return { L, B, depth, draft, freeboard, need, wash, form: type.form };
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
