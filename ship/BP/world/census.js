// Pure. Every building the world needs, what calls for each, how many a place of each level raises, and
// each one's variants by size and make-up. A building is a formula of rooms (world/periodic.js); this is the
// list of formulas the world asks for, so nothing a people does lacks a roof to do it under.
//
//   the call    each type is called by something the world already holds: a job's workstation
//               (world/jobs.js), a livelihood's set and a temper's guard (world/architecture.js), the
//               faith's places (world/faith.js), the fleet's berths (world/boatsizes.js), a household's
//               rank (world/dress.js RANKS), the place's level, or its being a capital, Thera or the League
//   levels      1 a hamlet (up to 8 households: buildings.js HOMES), 2 a village (to 21), 3 a town (past 21),
//               4 a capital (a people's seat, Thera, a League seat). A type stands from its level on
//   counts      a household is five folk; homes take every household, split by rank and level; the rest
//               one a place, or one to each so many households (a Fibonacci number), as the type says
//   variants    every type has three sizes (small, middling, large: its repeated rooms a Fibonacci step
//               apart) and extras, rooms it may take or leave, each taken by the seed with odds 1/phi,
//               1/phi^2, ... in its order. A home may also rise or spread: its storeys the people's, one
//               fewer for a small one, a narrow house's the people's and one more. So a street of one
//               type is not a street of one building
//   names       a few types are called by the people's own name for them (the naust, the kura, the fale):
//               the type is the same molecule; the people's grammar (world/grammar.js) draws its form
import { FIB, PHI } from "../core/golden.js";
import { TABLE, STOREYS, GROUND, fitStack, assemble } from "./periodic.js";
import { JOBS } from "./jobs.js";
import { FLEETS } from "./boatsizes.js";

export const HOUSEHOLD = FIB[4];   // vision: folk in a household
export const LEVELS = { 1: "hamlet", 2: "village", 3: "town", 4: "capital" };   // vision: the type's own measure (its levels, rooms and counts)
export const LEVEL_AT = [FIB[5], FIB[7]];   // vision: households a hamlet and a village hold at most (buildings.js HOMES' top, and the next Fibonacci but one)
export const levelOf = (households, capital = false) => (capital ? 4 : households <= LEVEL_AT[0] ? 1 : households <= LEVEL_AT[1] ? 2 : 3);   // vision: the type's own measure (its levels, rooms and counts)
export const SIZES = ["small", "middling", "large"];
const step = (n, k) => Math.max(1, Math.round(n * PHI ** (k - 1)));   // derived: a size a golden step from the middling

// ---- the types. rooms(k): the formula at size k (0 small, 1 middling, 2 large); extra: rooms it may take;
// home: built through the stacker (needs); call: what raises it; level: from which level; per: households to one
const R = (n, s) => Array(n).fill(s);
export const TYPES = {
  // homes (by rank and livelihood)
  hut: { kind: "home", name: "hut", needs: (k) => ({ beds: step(2, k), stores: 0 }), level: 1, call: "rank: the poorest households of a hamlet", storeys: 1 },   // vision: the household's own measure
  cottage: { kind: "home", name: "cottage", needs: (k) => ({ beds: step(3, k), stores: 1 }), extra: ["F", "S"], level: 1, call: "rank: folk" },   // vision: the household's own measure
  house: { kind: "home", name: "house", needs: (k) => ({ beds: step(5, k), stores: 1 }), extra: ["Li", "F", "S"], level: 2, call: "rank: folk, the settled" },   // vision: the household's own measure
  narrow: { kind: "home", name: "narrow house", needs: (k) => ({ beds: step(4, k), stores: 1 }), skinny: true, level: 3, call: "level: a town's tight streets", up: 1 },   // vision: the household's own measure
  farmhouse: { kind: "home", name: "farmhouse", rooms: (k) => ["Al", "C", "N", ...R(step(2, k), "O"), "F"], extra: ["Ca", "S"], level: 1, call: "livelihood: farmers and herders, the outer plots" },
  fisherhouse: { kind: "home", name: "fisher's house", rooms: (k) => ["K", "C", "N", ...R(step(1, k), "O")], extra: ["F", "Mg"], level: 1, call: "livelihood: fishers, the waterline" },
  shophouse: { kind: "home", name: "shop-house", needs: (k) => ({ beds: step(3, k), stores: 1 }), shop: true, extra: ["Si"], level: 2, call: "rank: merchants (traders' and towns' streets)" },   // vision: the household's own measure
  workhouse: { kind: "home", name: "workshop-house", needs: (k) => ({ beds: step(3, k), stores: 1, work: 1 }), extra: ["Si", "S"], level: 1, call: "rank: the crafter" },   // vision: the household's own measure
  bighouse: { kind: "home", name: "big house", rooms: (k) => ["Ne", "Li", "C", "N", ...R(step(3, k), "O"), "F"], extra: ["S", "Si", "C", "Cl"], level: 2, per: FIB[6], call: "rank: the elder" },   // vision: the type's own measure (its levels, rooms and counts)
  palace: { kind: "home", name: "palace", rooms: (k) => ["Ne", "Au", "Li", "C", "N", ...R(step(5, k), "O"), "F", "Ag"], extra: ["S", "Ne", "Cu", "Si"], level: 4, call: "the capital: the people's ruler; Thera's rulers" },   // vision: the type's own measure (its levels, rooms and counts)
  // work (the jobs' workstations)
  smithy: { kind: "work", name: "smithy", rooms: (k) => [...R(step(1, k), "Fe"), "Si"], extra: ["Mg", "O"], level: 2, per: FIB[7], jobs: ["toolsmith", "weaponsmith", "armorer"], call: "jobs: the smiths" },   // vision: the type's own measure (its levels, rooms and counts)
  workshop: { kind: "work", name: "workshop", rooms: (k) => [...R(step(1, k), "Mg"), "Si"], extra: ["Na", "O"], level: 2, per: FIB[6], jobs: ["fletcher"], call: "jobs: the fletcher; any trade without its own" },   // vision: the type's own measure (its levels, rooms and counts)
  lodge: { kind: "work", name: "mason's lodge", rooms: (k) => [...R(step(2, k), "Mg"), "Si"], extra: ["Al"], level: 2, jobs: ["mason"], call: "jobs: the mason (the builders)" },
  tannery: { kind: "work", name: "tannery", rooms: (k) => ["S", ...R(step(1, k), "Mg")], extra: ["Si"], level: 2, jobs: ["leatherworker"], call: "jobs: the leatherworker" },
  weavery: { kind: "work", name: "weaving shed", rooms: (k) => R(step(2, k), "Mg"), extra: ["Si", "S"], level: 1, jobs: ["shepherd"], call: "jobs: the shepherd's loom" },
  bakehouse: { kind: "work", name: "bakehouse", rooms: (k) => [...R(step(1, k), "P"), "F"], extra: ["Na", "Si"], level: 2, per: FIB[7], call: "food: the grain into bread" },   // vision: the type's own measure (its levels, rooms and counts)
  smokehouse: { kind: "work", name: "smokehouse", rooms: (k) => ["P", ...R(step(1, k), "F")], extra: ["Si"], level: 1, jobs: ["butcher"], call: "jobs: the butcher's smoker; livelihood: the fishers' catch" },
  barn: { kind: "work", name: "barn", rooms: (k) => ["Al", ...R(step(1, k), "Si")], extra: ["Al", "Ca"], level: 1, jobs: ["farmer"], call: "jobs: the farmer; livelihood: farmers" },
  byre: { kind: "work", name: "byre", rooms: (k) => R(step(1, k), "Al"), extra: ["Si"], level: 1, call: "livelihood: herders (the beasts' winter)" },
  granary: { kind: "store", name: "granary", rooms: (k) => R(step(1, k), "Ca"), level: 1, call: "livelihood: farmers (a year's grain)" },
  shearing: { kind: "work", name: "shearing shed", rooms: () => ["Al", "Mg"], level: 1, call: "livelihood: herders" },
  minehead: { kind: "work", name: "mine head", rooms: (k) => ["Si", ...R(step(1, k), "Mg")], extra: ["Fe"], level: 1, jobs: ["miner"], call: "jobs: the miner (an ore under the ground)" },
  woodshed: { kind: "store", name: "woodshed", rooms: (k) => R(step(1, k), "Si"), level: 1, jobs: ["folk"], call: "jobs: the folk who gather" },
  charthouse: { kind: "work", name: "chart house", rooms: () => ["Ag", "Mg"], extra: ["O"], level: 3, jobs: ["cartographer"], call: "jobs: the cartographer" },   // vision: the type's own measure (its levels, rooms and counts)
  library: { kind: "civic", name: "library", rooms: (k) => ["Li", ...R(step(1, k), "C")], extra: ["Mg", "F"], level: 3, jobs: ["librarian"], call: "jobs: the librarian (Thera's Library the greatest)" },   // vision: the type's own measure (its levels, rooms and counts)
  // trade
  market: { kind: "trade", name: "market pavilion", rooms: () => ["Ar"], level: 2, call: "temper: traders; level: every village's square" },
  markethall: { kind: "trade", name: "market hall", rooms: (k) => [...R(step(2, k), "Na"), "Si"], level: 3, call: "level: a town's covered market" },   // vision: the type's own measure (its levels, rooms and counts)
  warehouse: { kind: "store", name: "warehouse", rooms: (k) => R(step(2, k) + 1, "Si"), extra: ["Ag"], level: 2, per: FIB[7], call: "temper: traders; the harbour's cargo" },   // vision: the type's own measure (its levels, rooms and counts)
  counting: { kind: "trade", name: "counting house", rooms: () => ["Ag", "Li"], extra: ["O", "Si"], level: 3, call: "temper: traders; the League's money people" },   // vision: the type's own measure (its levels, rooms and counts)
  inn: { kind: "trade", name: "inn", rooms: (k) => ["C", "N", ...R(step(3, k), "O"), "S"], extra: ["Al", "F", "Cl"], level: 2, call: "level: travellers (every village on a route; Thera's many)" },   // vision: the type's own measure (its levels, rooms and counts)
  // civic
  well: { kind: "civic", name: "well house", rooms: () => ["He"], level: 1, per: FIB[6], call: "water: every place" },   // vision: the type's own measure (its levels, rooms and counts)
  washhouse: { kind: "civic", name: "wash house", rooms: (k) => R(step(1, k), "S"), level: 2, call: "water: the common wash (Thera's baths)" },
  latrine: { kind: "civic", name: "latrine", rooms: () => ["Cl"], level: 2, per: FIB[7], call: "the common pit" },   // vision: the type's own measure (its levels, rooms and counts)
  meeting: { kind: "civic", name: "meeting hall", rooms: (k) => R(step(2, k) + 1, "C"), extra: ["N", "F"], level: 2, call: "level: the people's council (the raiders' long hall, larger)" },
  townhall: { kind: "civic", name: "town hall", rooms: () => ["Li", "C", "Ag"], extra: ["C", "Si"], level: 3, call: "level: a town's governing" },   // vision: the type's own measure (its levels, rooms and counts)
  throne: { kind: "civic", name: "throne hall", rooms: () => ["Au"], extra: ["Ne"], level: 4, call: "the capital's court" },   // vision: the type's own measure (its levels, rooms and counts)
  // guard
  lookout: { kind: "guard", name: "lookout tower", rooms: () => ["B", "C"], level: 1, call: "temper: raiders (palisade and lookout), the wary" },
  gatehouse: { kind: "guard", name: "gatehouse", rooms: () => ["Be", "B", "O"], level: 2, call: "temper: the wary (a wall and its gates)" },
  barracks: { kind: "guard", name: "barracks", rooms: (k) => ["C", "N", ...R(step(2, k), "O")], extra: ["Fe", "S"], level: 3, call: "rank: the guard (raiders' and wary towns, capitals)" },   // vision: the type's own measure (its levels, rooms and counts)
  // faith (world/faith.js: a shrine to each quarter at the waterline, a temple to each district, the Sea Rite Temple at Thera)
  kiosk: { kind: "faith", name: "shrine kiosk", rooms: () => ["Ne"], level: 1, call: "faith: every hamlet's" },
  shrine: { kind: "faith", name: "shrine", rooms: () => ["Cu"], extra: ["O"], level: 1, jobs: ["cleric"], call: "jobs: the cleric (the waterline shrine)" },
  temple: { kind: "faith", name: "temple", rooms: () => ["Kr"], level: 3, per: FIB[5] * FIB[5], call: "faith: each district's (eight quarters)" },   // vision: the type's own measure (its levels, rooms and counts)
  greattemple: { kind: "faith", name: "great temple", rooms: () => ["Xe"], level: 4, call: "faith: the capital's; the Sea Rite Temple at Thera" },   // vision: the type's own measure (its levels, rooms and counts)
  // harbour (world/boatsizes.js: harbourOf gives how many boathouses, the quays' run, the slip)
  boathouse: { kind: "harbour", name: "boathouse", rooms: (k) => R(step(1, k), "K"), extra: ["Si", "O"], level: 1, jobs: ["fisherman"], call: "fleet: a roofed berth (the naust, the funaya, the canoe house)" },
  shipyard: { kind: "harbour", name: "shipyard", rooms: (k) => ["K", ...R(step(1, k), "Mg"), "Si"], extra: ["Fe", "Si"], level: 2, jobs: ["shipwright"], call: "jobs: the shipwright; fleet: the slip for the biggest hull" },
  loft: { kind: "harbour", name: "sail and net loft", rooms: (k) => ["Si", ...R(step(1, k), "Mg")], level: 2, call: "fleet: the sails and nets mended (fishers' nets; sail peoples' canvas)" },
  ropewalk: { kind: "harbour", name: "ropewalk", rooms: (k) => R(step(3, k), "Be"), extra: ["Mg"], level: 3, call: "fleet: a sail people's town's rope" },   // vision: the type's own measure (its levels, rooms and counts)
  fishmarket: { kind: "harbour", name: "fish market", rooms: () => ["Ar"], level: 2, call: "livelihood: fishers' landing" },
  harbourmaster: { kind: "harbour", name: "harbourmaster's house", rooms: () => ["Ag", "Li", "O"], level: 3, call: "fleet: the quays' keeping (towns, Thera)" },   // vision: the type's own measure (its levels, rooms and counts)
  beacon: { kind: "harbour", name: "beacon tower", rooms: () => ["B", "Li"], level: 3, call: "fleet: the harbour mouth's light" },   // vision: the type's own measure (its levels, rooms and counts)
};

// a people's own names for a type (vision: the historical names; the molecule the type's)
export const NAMES = {
  norse: { house: "longhouse", boathouse: "naust", meeting: "mead hall", granary: "stabbur", bighouse: "chieftain's hall" },
  european: { house: "timber-framed house", narrow: "town house", bighouse: "manor", inn: "coaching inn", markethall: "market house" },
  therans: { house: "Akrotiri house", bighouse: "xeste", palace: "the palace", library: "the Library", washhouse: "the baths", well: "the cistern", counting: "the Exchange", greattemple: "the Sea Rite Temple" },
  indian_ocean: { house: "coral-stone house", inn: "caravanserai", market: "souk pavilion", markethall: "covered souk", bighouse: "merchant's house" },
  east_asian: { house: "courtyard house", meeting: "ancestral hall", warehouse: "godown", bighouse: "family compound" },
  japanese: { house: "machiya", granary: "kura", boathouse: "funaya", inn: "hatago", bighouse: "yashiki", warehouse: "kura row" },
  pacific: { house: "fale", meeting: "great fale", boathouse: "canoe house", greattemple: "marae", bighouse: "chief's fale" },
  dugout: { house: "plank house", meeting: "big house", bighouse: "chief's house", smokehouse: "smoke shed" },
  birchbark: { house: "wigwam", meeting: "longhouse", granary: "cache pit house", bighouse: "council lodge" },
  shallow: { house: "stilt house", meeting: "long stilt hall", boathouse: "canoe shed" },
  arctic: { house: "snow house", meeting: "qaggiq", granary: "meat cache", bighouse: "large qarmaq" },
};
export const nameOf = (id, t) => NAMES[t]?.[id] ?? TYPES[id].name;

/** A building of a type: { id, size, formula, floors, extras }. seed picks the extras and the size (null: middling). */
export function variantOf(id, t, seed = 0, size = null, up = 0) {
  const T = TYPES[id], u = (n) => ((seed + n) * PHI) % 1, k = size ?? (u(0) < 1 / PHI ** 2 ? 0 : u(0) < 1 - 1 / PHI ** 3 ? 1 : 2);   // derived: the sizes' odds: small 1/phi^2, large 1/phi^3
  const extras = (T.extra ?? []).filter((_, i) => u(i + 1) < 1 / PHI ** (i + 1));   // derived: the extras' odds, a golden step down each
  let storeys = STOREYS[t] ?? 1;
  if (T.storeys) storeys = T.storeys; else if (T.kind === "home") storeys = Math.max(1, storeys - (k === 0 ? 1 : 0) + (T.up ?? 0) + up);
  if (T.needs) {
    const needs = T.needs(k), st = fitStack(needs, t, { storeys, skinny: !!T.skinny, shop: !!T.shop });
    const f = extras.length ? spread([...st.floors[0], ...extras], st.floors.slice(1), t) : { formula: st.formula, floors: st.floors };
    return { id, size: SIZES[k], extras, ...f };
  }
  const rooms = [...T.rooms(k), ...extras];
  return { id, size: SIZES[k], extras, ...(T.kind === "home" && storeys > 1 ? rise(rooms, t, storeys) : { formula: rooms, floors: [rooms] }) };
}
const byChi = (f) => [...f].sort((a, b) => (TABLE[a].noble ? -1 : TABLE[a].chi) - (TABLE[b].noble ? -1 : TABLE[b].chi));
const join = (floors) => floors.flatMap((f, i) => (i === 0 ? byChi(f) : ["B", ...byChi(f)]));
/** The ground storey and those above as a formula; where a storey won't stand, its last room comes down. */
function spread(ground, ups, t) {
  const floors = [ground, ...ups.map((f) => [...f])];
  for (let g = 0; g < FIB[7] && floors.length > 1; g++) { if (!assemble(join(floors)).problems.length) break; const top = floors.at(-1); floors[0].push(top.pop()); if (!top.length) floors.pop(); }   // derived: twenty-one tries
  return { formula: join(floors), floors };
}
/** A non-stacker home's rooms raised: what needs the ground stays down, the rest go up by privacy. */
function rise(rooms, t, storeys) {
  const ground = rooms.filter((s) => GROUND.has(s) || TABLE[s].noble || s === "C" || s === "N" || s === "Li"), up = byChi(rooms.filter((s) => !ground.includes(s)));
  if (!up.length) return { formula: byChi(ground), floors: [ground] };
  const per = Math.ceil(up.length / (storeys - 1)), ups = []; for (let i = 0; i < up.length; i += per) ups.push(up.slice(i, i + per));
  return spread(ground, ups, t);
}

// ---- the census: what a place raises
/** A place's buildings: { level, households, list: [{ id, n }] }. place: { t, folk, living, temper, capital, fleet, ores } */
export function censusOf({ t, folk, living = "fishers", temper = "peaceful", capital = false, thera = false, ores = true, sail = null }) {
  const hh = Math.max(1, Math.ceil(folk / HOUSEHOLD)), level = levelOf(hh, capital || thera), out = new Map(), add = (id, n = 1) => { if (n > 0 && TYPES[id].level <= level) out.set(id, (out.get(id) ?? 0) + n); };
  const sails = sail ?? (FLEETS[t] ?? []).some((b) => b.drive.includes("sail"));
  // homes: the elders, the crafters, the merchants, the livelihood's, the rest (RANKS: one in eight a crafter, one in eight an elder)
  const elders = level >= 2 ? Math.max(1, Math.floor(hh / FIB[6])) : 0, crafters = Math.max(level >= 2 ? 1 : 0, Math.round(hh / FIB[5]));   // derived: an elder to thirteen households, a crafter to eight
  const merchants = level >= 2 ? Math.round(hh / (level >= 3 ? PHI ** 2 : PHI ** 4)) : 0;   // derived: a merchant to each phi^4 households in a village, phi^2 in a town
  let rest = hh - elders - crafters - merchants - (level === 4 ? 1 : 0);   // vision: the type's own measure (its levels, rooms and counts)
  add("palace", level === 4 ? 1 : 0); add("bighouse", elders); add("workhouse", crafters); add("shophouse", merchants);   // vision: the type's own measure (its levels, rooms and counts)
  const own = living === "fishers" ? "fisherhouse" : "farmhouse", ownN = Math.round(rest / (level >= 3 ? PHI ** 3 : PHI));   // derived: the livelihood's houses: most of a hamlet's, the edge of a town's
  add(own, ownN); rest -= ownN;
  const narrow = level >= 3 && (STOREYS[t] ?? 1) > 1 ? Math.round(rest / PHI ** 2) : 0; add("narrow", narrow); rest -= narrow;   // derived: the tight streets' share
  const huts = level === 1 ? Math.round(rest / PHI ** 2) : 0; add("hut", huts); rest -= huts;
  add(level >= 2 ? "house" : "cottage", Math.max(0, rest));
  // work, by the jobs the place's living and level keep
  const jobs = new Set(["cleric", "folk", ...(living === "fishers" ? ["fisherman"] : living === "farmers" ? ["farmer"] : ["shepherd", "butcher", "leatherworker"])]);
  if (level >= 2) ["mason", "toolsmith", "butcher", "fletcher", "shipwright"].forEach((j) => jobs.add(j));
  if (level >= 3) ["weaponsmith", "armorer", "cartographer", "librarian", "leatherworker"].forEach((j) => jobs.add(j));   // vision: the type's own measure (its levels, rooms and counts)
  if (ores) jobs.add("miner");
  const per = (id) => Math.max(1, Math.round(hh / (TYPES[id].per ?? Infinity)));
  for (const [id, T] of Object.entries(TYPES)) if (T.jobs && T.jobs.some((j) => jobs.has(j)) && !out.has(id)) add(id, T.per ? per(id) : 1);
  // the livelihood's set and the temper's guard (world/architecture.js)
  if (living === "fishers") { add("smokehouse"); add("loft"); add("fishmarket"); }
  if (living === "farmers") { add("barn", per("barn")); add("granary", Math.max(1, Math.round(hh / FIB[5]))); add("bakehouse", per("bakehouse")); }   // derived: a granary to eight households
  if (living === "herders") { add("byre", Math.max(1, Math.round(hh / FIB[5]))); add("shearing"); add("barn"); }   // derived: a byre to eight households
  if (temper === "raiders") { add("lookout"); add("meeting", 1); add("barracks"); }
  if (temper === "wary") { add("gatehouse", level >= 3 ? FIB[3] : 1); add("lookout"); add("barracks"); }   // vision: a town's three gates
  if (temper === "traders") { add("market"); add("warehouse", per("warehouse")); add("counting"); }
  // every place's, by level
  ["well", "kiosk", "boathouse", "market", "washhouse", "latrine", "meeting", "inn", "markethall", "townhall", "harbourmaster", "beacon", "throne", "greattemple"].forEach((id) => { if (!out.has(id)) add(id, TYPES[id].per ? per(id) : 1); });
  add("temple", level >= 3 ? Math.max(1, Math.round(hh / TYPES.temple.per)) : 0);   // vision: the type's own measure (its levels, rooms and counts)
  if (sails) add("ropewalk", level >= 3 ? 1 : 0);   // vision: the type's own measure (its levels, rooms and counts)
  if (level >= 4) add("library", out.has("library") ? 0 : 1);   // vision: the type's own measure (its levels, rooms and counts)
  return { level, name: LEVELS[level], households: hh, list: [...out].map(([id, n]) => ({ id, n, kind: TYPES[id].kind, name: nameOf(id, t) })) };
}

/** What nothing yet roofs: jobs without a workstation's building, table rooms no type uses, a fleet's berth with no type. */
export function coverage() {
  const jobsRoofed = new Set(Object.values(TYPES).flatMap((T) => T.jobs ?? []));
  const used = new Set(); for (const id of Object.keys(TYPES)) for (const k of [0, 1, 2]) { const v = variantOf(id, "european", 0, k); v.formula.forEach((s) => used.add(s)); (TYPES[id].extra ?? []).forEach((s) => used.add(s)); }
  return {
    jobs: Object.keys(JOBS).filter((j) => !jobsRoofed.has(j)),
    rooms: Object.keys(TABLE).filter((s) => s !== "H" && !used.has(s)),
    types: Object.keys(TYPES).length,
  };
}

// ---- a building of a type, built: its form where it has one (world/forms.js), else its people's grammar or its rooms
import { buildingOf, TERRACING, STEP_MAX, detailVox } from "./building.js";
import { GRAMMAR } from "./grammar.js";
import { formOf, FORM_OF } from "./forms.js";
import { sizes as boatSizes } from "./boatsizes.js";
// a home's working rooms stand outside it as their own buildings, where the people builds that way (the grammar
// peoples: a Norse farm is a longhouse and its byre and store across the yard); the room peoples keep their shops
// and workshops in the house and put only the beasts, the grain and the boat out
const OUT = { Na: "shed", Mg: "shed", Fe: "shed", S: "shed", P: "store", Al: "store", Si: "store", Ca: "store", K: "boathouse" };
const OUT_ROOMS = new Set(["Al", "Ca", "K"]);
const bbox = (vox) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0; for (const k of vox.keys()) { const [x, y, z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); y1 = Math.max(y1, y); } return { x0, x1, z0, z1, y1 }; };
const pasteY = (into, vox, dx, dy, dz) => { for (const [k, b] of vox) { const [x, y, z] = k.split(",").map(Number), kk = `${x + dx},${y + dy},${z + dz}`; if (!into.has(kk)) into.set(kk, b); } };
const paste = (into, vox, dx, dz) => { for (const [k, b] of vox) { const [x, y, z] = k.split(",").map(Number), kk = `${x + dx},${y},${z + dz}`; if (!into.has(kk)) into.set(kk, b); } };
const FENCE = { norse: "minecraft:spruce_fence", european: "minecraft:cobblestone_wall", therans: "minecraft:white_concrete", indian_ocean: "minecraft:sandstone_wall", east_asian: "minecraft:mud_brick_wall", japanese: "minecraft:bamboo_fence", pacific: "minecraft:bamboo_fence", dugout: "minecraft:spruce_fence", birchbark: "minecraft:birch_fence", shallow: "minecraft:bamboo_fence", arctic: "minecraft:cobblestone_wall" };   // vision: each people's yard wall or fence
// the country's roofs: a rural home of a tiled people thatches (the 1600s cottage, the minka's kaya roof, the village's straw)
const RURAL = new Set(["hut", "cottage", "farmhouse", "fisherhouse"]);
const THATCH = { "minecraft:deepslate_tile_stairs": "minecraft:hay_block", "minecraft:deepslate_tile_slab": "minecraft:bamboo_slab", "minecraft:deepslate_tiles": "minecraft:hay_block", "minecraft:polished_granite_stairs": "minecraft:hay_block", "minecraft:polished_granite_slab": "minecraft:bamboo_slab" };
const THATCHERS = new Set(["european", "japanese", "east_asian"]);
const KAYA = { stairs: "minecraft:spruce_stairs", slab: "minecraft:spruce_slab", block: "minecraft:spruce_planks" };   // vision: the kaya roof weathered dark, its slope kept (a stair for a stair)
const thatch = (vox, t) => {
  if (t === "japanese" || t === "east_asian") { for (const [k, b] of vox) { if (!THATCH[b.id]) continue; const id = b.id.endsWith("_stairs") ? KAYA.stairs : b.id.endsWith("_slab") ? KAYA.slab : KAYA.block; vox.set(k, { id, s: b.s }); } return vox; }
  for (const [k, b] of vox) if (THATCH[b.id]) vox.set(k, { id: THATCH[b.id], s: THATCH[b.id].endsWith("_slab") ? b.s : { pillar_axis: "y" } }); return vox;
};
/** Whether this building steps up its slope (its people terraces, and the seed falls in its share), else it levels. */
export const terraces = (t, seed, slope) => !!slope && slope.grade > 0 && ((seed * PHI) % 1) < (TERRACING[t] ?? 0);   // derived: the seed's golden step against the people's share
export function buildOf(id, t, seed = 0, size = null, { slope = null, up = 0, dense = false, split = false } = {}) {
  const built = build(id, t, seed, size, terraces(t, seed, slope) ? slope : null, up, dense, split);
  if (GRAMMAR[t] || FORM_OF[id]) { const notes = detailVox(built.vox, t, seed); for (const pt of built.parts ?? []) detailVox(pt.vox, t, seed + 1); if (notes.length) built.note = [built.note, ...notes].filter(Boolean).join(", "); }   // the grammar's and the forms' buildings take the shell's tricks (building.js does its own)
  if (RURAL.has(id) && THATCHERS.has(t)) { thatch(built.vox, t); for (const p of built.parts ?? []) thatch(p.vox, t); built.note = [built.note, "thatched (the country's roof)"].filter(Boolean).join(", "); }
  return built;
}
function build(id, t, seed, size, slope, up = 0, dense = false, split = false) {
  const v = variantOf(id, t, seed, size, up), form = FORM_OF[id], T = TYPES[id], meta = { id, type: T, name: nameOf(id, t), size: v.size, formula: v.formula, extras: v.extras, kind: T.kind };
  if (form) {
    const boats = boatSizes(t), boat = id === "boathouse" ? (boats[v.size === "large" && boats[1]?.boathouse ? 1 : 0] ?? boats[0]).boathouse : null;
    const b = formOf(form, v.formula, t, { seed, boat });
    return { ...b, ...meta, dims: b.size };
  }
  if (T.kind !== "home") { const b = buildingOf(v.formula, t, { seed, slope }); return { ...b, ...meta, dims: b.size, note: (b.reactions ?? []).join(", ") }; }
  // a home: the house, its wing, its outbuildings round a yard
  const grammar = !!GRAMMAR[t], outs = [], keep = [];
  for (const s of v.formula) (OUT[s] && (grammar || OUT_ROOMS.has(s)) ? outs : keep).push(s);
  const clean = keep.filter((s, i) => !(s === "B" && (i === keep.length - 1 || keep[i + 1] === "B" || i === 0)));
  const Os = clean.filter((s) => s === "O").length, wing = grammar && v.size === "large" && Os >= FIB[4] - 1 && t !== "east_asian" && t !== "arctic";   // derived: a large house of four bedrooms and more takes a wing (the court and the domes already spread)
  const main = wing ? clean.filter((s, i) => s !== "O" || clean.slice(0, i).filter((q) => q === "O").length < Math.ceil(Os / 2)) : clean;
  const body = buildingOf(main.length ? main : ["C"], t, { seed, slope }), vox = new Map(body.vox), notes = [...(body.reactions ?? [])];
  const gap = FIB[3], parts = [];   // derived: three blocks between buildings (a window's clear air)
  if (wing) parts.push({ b: buildingOf([...R(Os - Math.ceil(Os / 2), "O"), "C"], t, { seed: seed + 1 }).vox, at: "side", note: "a wing" });
  const groups = {}; for (const s of outs) (groups[OUT[s]] ??= []).push(s);
  for (const [f, rs] of Object.entries(groups)) parts.push({ b: formOf(f, rs, t, { seed: seed + rs.length, boat: f === "boathouse" ? boatSizes(t)[0].boathouse : null }).vox, at: rs.some((s) => s === "Na") ? "front" : f === "boathouse" ? "front" : (seed + rs.length) % 2 ? "back" : "side", note: { shed: "its work in a shed", store: "its store across the yard", boathouse: "its boathouse" }[f] });
  if (split) { const D0 = bbox(vox); return { ...body, vox, ...meta, dims: { w: D0.x1 - D0.x0 + 1, l: D0.z1 - D0.z0 + 1, h: D0.y1 + 1 }, parts: parts.map((p) => ({ vox: p.b, at: p.at, note: p.note })), note: notes.filter(Boolean).join(", ") }; }   // the house alone, its wing and outbuildings apart (world/growth.js sets them on the lot)
  let B = bbox(vox), side = 0, back = 0;
  for (const p of parts) {
    const P = bbox(p.b), w = P.x1 - P.x0, l = P.z1 - P.z0;
    let dx, dz;
    if (p.at === "front") { dx = B.x1 - w - P.x0; dz = B.z0 - gap - l - P.z0 - (p.b === parts[0]?.b ? 0 : 0); }
    else if (p.at === "side" ) { dx = B.x1 + gap - P.x0; dz = B.z0 + side - P.z0; side += l + gap; }
    else { dx = B.x0 + back - P.x0; dz = B.z1 + gap - P.z0; back += w + gap; }
    let dy = 0; if (slope) { const c = ((P.x0 + P.x1) / 2 + dx) * slope.dir[0] + ((P.z0 + P.z1) / 2 + dz) * slope.dir[1], c0 = ((B.x0 + B.x1) / 2) * slope.dir[0] + ((B.z0 + B.z1) / 2) * slope.dir[1]; dy = Math.max(-STEP_MAX, Math.min(STEP_MAX, Math.round(slope.grade * (c - c0)))); }   // a terracing household's outbuildings a few steps up or down the hill
    pasteY(vox, p.b, dx, dy, dz); notes.push(p.note + (dy ? ` (${Math.abs(dy)} ${dy > 0 ? "up" : "down"})` : ""));
  }
  // the yard: a fence or wall round house and outbuildings, a gate at the street, where the household has a yard
  if (parts.length && (T.kind === "home") && (id === "farmhouse" || id === "bighouse" || id === "palace" || (!dense && seed % FIB[3] === 0))) {   // derived: the farm, the big house, the palace, and a third of the rest
    B = bbox(vox); const F = FENCE[t] ?? "minecraft:oak_fence", gx = Math.round((B.x0 + B.x1) / 2);
    for (let x = B.x0 - 2; x <= B.x1 + 2; x++) for (const z of [B.z0 - 2, B.z1 + 2]) if (!(z === B.z0 - 2 && Math.abs(x - gx) <= 1)) { vox.set(`${x},1,${z}`, { id: F, s: null }); if (F === "minecraft:white_concrete") vox.set(`${x},2,${z}`, { id: F, s: null }); }
    for (let z = B.z0 - 2; z <= B.z1 + 2; z++) for (const x of [B.x0 - 2, B.x1 + 2]) { vox.set(`${x},1,${z}`, { id: F, s: null }); if (F === "minecraft:white_concrete") vox.set(`${x},2,${z}`, { id: F, s: null }); }
    notes.push("a yard walled round");
  }
  const D = bbox(vox);
  return { ...body, vox, ...meta, dims: { w: D.x1 - D.x0 + 1, l: D.z1 - D.z0 + 1, h: D.y1 + 1 }, note: notes.filter(Boolean).join(", ") };
}
