// Pure (given a loaded map). What each people's sea asks of it: the boats its living and its trade need, the hands to
// crew them, the shore to berth them, the yard to keep them, and the routes they must sail. The figures are the
// sim's own (ships.js fleets, boatsizes.js sizes and berths, trade.js routes), read together, so a shortfall
// anywhere is a reason for something the world does (a trade, a League ship hired, a Theran charter).
//
//   fleet      ships.js's boats, by kind (small, cargo, war), sized by boatsizes.js's type for the people and temper
//   hands      each boat's crew against the people's folk at sea (ships.js share): short means boats lie idle
//   shore      harbourOf: boathouses, quay run and depth, the slip for the biggest hull
//   yard       a hull lasts LIFE years; a shipwright frames a block of hull in 1/FRAME days: hulls a year it can
//              raise against the hulls a year the fleet wears out
//   stores     ships.js's repair need against what the ground gives: the share it must trade for
//   routes     the people's way to its market (trade.js network): the open water on it in small-boat hops; a route
//              longer than its fleet's reach is sailed by others (the League's ships, or a Theran charter). A route
//              the League carries goes in a bireme sized to it (boatsizes.js routeLength: its windier end's sea, its
//              longest open leg)
//   the League's fleet (leagueFleet; design/s003-specs/league.md): each of the League's jobs (league.js ROLES), the
//              route it sails, the length that route asks of its hull, and how many hulls the job takes
import { FIB, PHI } from "../core/golden.js";
import { VISION, D, GIVEN } from "../core/given.js";
import { peoples } from "./peoples.js";
import { societyOf } from "./society.js";
import { FLEETS, sizeOf, typeFor, harbourOf, REACH, routeLength, exactOf, GALLEY, DESIGN_WIND, KEEPING } from "./boatsizes.js";
import { network, chunkDist, THERA_AT, MINT, TRADE, TIER } from "./trade.js";
import { SHIPS, raiseOf } from "./ships.js";
import { league, ROUTES, ROLES, seaAt, longestLeg, fleetType } from "./league.js";
import { RUNGS } from "../core/clock.js";
import { greatCircle } from "../core/globe.js";
import { hullOf, pullSpeed, trial } from "../core/boat.js";

export const LIFE = SHIPS.life, FRAME = SHIPS.frame;   // ships.js: a hull's years, and the yard's pace (a block of hull in eight days: a longship some two hundred and forty days of a yard's work, a carrack twenty thousand)
const REACH_HOPS = { inshore: 1, coastal: FIB[3], sea: FIB[5], ocean: Infinity };   // vision: small-boat hops of open water each reach dares (core/given.js VISION.HOP: twenty chunks a hop)

/** A people's sea: { fleet, hands, shore, yard, stores, route }. */
export function seaOf(p, { soc = null, net = null } = {}) {
  const s = soc ?? societyOf(p), F = s.fleet, kind = F.kind, type = typeFor(p.tradition, kind, s.temper), size = sizeOf(type);
  const boats = F.boats, crew = boats * size.crew, atSea = Math.floor(s.folk * (kind === "war" ? SHIPS.share.raiders : kind === "cargo" ? SHIPS.share.traders : SHIPS.share.fishers));
  const shore = harbourOf(p.tradition, { [kind]: boats }, { temper: s.temper });
  const hull = size.L * size.B * size.depth, wearOut = boats / LIFE, wrights = s.professions.shipwright ?? 0, raise = raiseOf(wrights, hull);
  // the route: to its market node, in small-boat hops of open water; the reach it needs against the fleet's best
  const N = net ?? network(), first = N.of.get(p.key)?.first, at = first?.at ?? { cx: p.cx, cz: p.cz }, dist = chunkDist({ cx: p.cx, cz: p.cz }, at), hops = Math.ceil(dist / VISION.HOP);
  const need = REACH.find((r) => hops <= REACH_HOPS[r]) ?? "ocean", best = (FLEETS[p.tradition] ?? []).reduce((b, x) => (REACH.indexOf(x.reach) > REACH.indexOf(b) ? x.reach : b), "inshore");
  const carried = REACH.indexOf(best) >= REACH.indexOf(need) ? "its own" : first?.hub === "thera" ? "a Theran charter" : "the League's ships";
  return {
    key: p.key, t: p.tradition, temper: s.temper, living: p.living, folk: s.folk,
    fleet: { kind, type: size.name, cls: size.cls, boats, L: size.L, crew: size.crew, cargo: boats * size.cargo },
    hands: { need: crew, have: atSea, short: Math.max(0, crew - atSea), idle: crew > atSea ? Math.ceil((crew - atSea) / size.crew) : 0 },
    shore: { keep: shore.keep, boathouses: shore.boathouses.length, quay: shore.quay, depth: shore.depth, racks: shore.racks, beach: shore.beach, slip: shore.slips[0] ?? null },
    yard: { wrights, hull, wearOut: +wearOut.toFixed(2), raise: +raise.toFixed(2), short: raise < wearOut },
    stores: { short: F.short, need: Object.fromEntries(Object.entries(F.need).map(([k, v]) => [k, Math.round(v)])), supply: Object.fromEntries(Object.entries(F.supply).map(([k, v]) => [k, Math.round(v)])) },
    route: { to: first?.hub ?? null, chunks: Math.round(dist), hops, need, best, carried, ...(carried === "the League's ships" ? { by: carrierFor({ cx: p.cx, cz: p.cz }, at) } : {}) },
  };
}

/** The League's carrier for a route: a bireme, its length the route's (its windier end's sea, its longest open leg). */
function carrierFor(a, b) {
  const Hs = Math.max(seaAt(a), seaAt(b)), leg = longestLeg(a, b);
  return { type: ROLES.carrier.type, L: routeLength(fleetType("carrier"), { Hs, leg }), Hs: +Hs.toFixed(2), leg };
}

// ---- the League's fleet
const CHEST = 27 * 64;   // given: a vanilla chest, 27 slots of 64
const DAY_S = RUNGS.day / GIVEN.TICKS_PER_S;   // derived: a day's seconds (1,200)
const blocks = (a, b) => greatCircle({ x: a.cx * D.PX, z: a.cz * D.PX }, { x: b.cx * D.PX, z: b.cz * D.PX });   // derived: the great circle between two map cells, blocks
/** A League hull of a job at a length: her size, her passage speed (the better of rowing by halves and her sail's mean
 * made good in the trades, the route's middle), the share of her hold left for payload, in chests. */
function hullFor(role, L) {
  const type = fleetType(role), s = sizeOf({ ...type, range: [L, L] }), x = exactOf(type, L);
  const h = hullOf({ L, lb: type.lb, full: type.full, pull: "oars", pullers: s.oars?.rowers ?? s.crew, mast: s.masts[0] ?? 0, depth: x.depth });
  const pull = pullSpeed(h) * GALLEY.HALVES, sail = s.masts.length ? trial(h, [DESIGN_WIND.coastal]).winds[0].mean : 0;   // given: open water rowed by halves (Thucydides 3.49)
  const stores = ["carrier", "victualler", "coaster"].includes(role) ? PHI ** -2 : 1 / PHI;   // vision: boatsizes.js routeLength's share of free hold for stores
  return { ...s, speed: Math.max(pull, sail), payload: (s.cargo * (1 - stores)) / PHI ** ((type.banks ?? 1) - 1) };   // vision: each further bank takes a golden step of the hold
}
const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };

/** The League's fleet in the world: for each job (league.js ROLES), the route it sails, the length that route asks
 * (boatsizes.js routeLength), and how many hulls it takes. sea: shipping()'s rows, if already made. */
export function leagueFleet({ sea = null, net = null } = {}) {
  const Lg = league(), N = net ?? network(), rows = sea ?? shipping().rows, seats = Lg.states.map((st) => st.seat).filter(Boolean);
  const home = seaAt(Lg.at), thera = seaAt(THERA_AT), month = RUNGS.month * DAY_S;
  const ship = (role, L, count, route, why) => { const h = hullFor(role, L); return { role, type: ROLES[role].type, cls: h.cls, L, B: h.exact.B, depth: h.exact.depth, crew: h.crew, count, route, speed: +h.speed.toFixed(2), why }; };
  const out = [], routes = {};
  // R1, the Thera run: from every seat; the month-ship takes the worst seat's sea and leg. Each state keeps its own,
  // sailed in its month (vision); how many are at sea at once is the round trip over the month
  const r1 = seats.map((p) => ({ d: blocks(p, THERA_AT), Hs: Math.max(seaAt(p), thera), leg: longestLeg(p, THERA_AT) }));
  routes.R1 = { ...ROUTES.R1, length: [Math.min(...r1.map((r) => r.d)), Math.max(...r1.map((r) => r.d))].map(Math.round), leg: Math.max(...r1.map((r) => r.leg)), Hs: +Math.max(...r1.map((r) => r.Hs)).toFixed(2) };
  const L1 = routeLength(fleetType("month-ship"), routes.R1), days1 = (2 * routes.R1.length[1]) / hullFor("month-ship", L1).speed / DAY_S;
  out.push({ ...ship("month-ship", L1, Lg.states.length, "R1", `a seat to Thera and home in ${days1.toFixed(1)} days: ${Math.ceil((days1 * DAY_S) / month)} at sea at once`), atSea: Math.ceil((days1 * DAY_S) / month) });
  // R2, victualling: the continents' markets the House buys the Therans' month from (trade.js theransMonth), nearest first
  const markets = [...N.nodes.values()].filter((n) => n.tier >= TIER.city && n.tier <= TIER.cont && !n.state && !n.league).map((n) => ({ d: blocks(n.at, THERA_AT), Hs: Math.max(seaAt(n.at), thera), leg: longestLeg(n.at, THERA_AT) }));
  routes.R2 = { ...ROUTES.R2, length: [Math.round(median(markets.map((m) => m.d)))], leg: median(markets.map((m) => m.leg)), Hs: +Math.max(...markets.map((m) => m.Hs)).toFixed(2) };
  const chests = (MINT * TRADE.EMERALD) / CHEST, type2 = fleetType("victualler");   // derived: the Therans' month in items (the mint's coin at the emerald's worth), in chests
  const fleet2 = (L) => { const h = hullFor("victualler", L), trips = month / ((2 * routes.R2.length[0]) / h.speed); return Math.ceil(chests / (h.payload * trips)); };
  const L2lo = routeLength(type2, routes.R2), n2 = fleet2(type2.range[1]);
  let L2 = L2lo; while (L2 < type2.range[1] && fleet2(L2) > n2) L2++;   // derived: the least hull, from the sea's, that keeps the fewest ships
  out.push(ship("victualler", L2, n2, "R2", `the Therans' month, ${chests.toFixed(1)} chests, from markets a median ${routes.R2.length[0]} blocks off`));
  // R3, the carrying trade: a bireme to each route the League carries, each sized to its own
  const carried = rows.filter((r) => r.route.by);
  const L3 = carried.map((r) => r.route.by.L);
  routes.R3 = { ...ROUTES.R3, routes: carried.length, Hs: carried.length ? +Math.max(...carried.map((r) => r.route.by.Hs)).toFixed(2) : 0, leg: carried.length ? Math.max(...carried.map((r) => r.route.by.leg)) : 0 };
  if (carried.length) out.push({ ...ship("carrier", Math.round(median(L3)), carried.length, "R3", `a carrier to each of ${carried.length} routes, ${Math.min(...L3)} to ${Math.max(...L3)} long by their seas`), lengths: [Math.min(...L3), Math.max(...L3)] });
  // R4, the island round: the seats in order round the coast; R5, the seats whose harbours are landings
  const ring = seats.reduce((a, p, k) => a + blocks(p, seats[(k + 1) % seats.length]), 0), legs = seats.map((p, k) => longestLeg(p, seats[(k + 1) % seats.length]));
  routes.R4 = { ...ROUTES.R4, length: [Math.round(ring)], leg: Math.max(...legs), Hs: +Math.max(home, ...seats.map(seaAt)).toFixed(2) };
  const deep = seats.filter((p) => (KEEPING[p.tradition] ?? "quay") !== "landing"), landing = seats.length - deep.length;
  out.push(ship("guard", routeLength(fleetType("guard"), routes.R4), seats.length, "R4", "a guard at each seat's harbour mouth"));   // vision: one to a seat
  const L4c = routeLength(fleetType("coaster"), routes.R4), coastRound = ring / hullFor("coaster", L4c).speed;
  out.push(ship("coaster", L4c, 2 * Math.ceil(coastRound / month), "R4", `round the ${deep.length} deep seats each way, ${(coastRound / DAY_S).toFixed(1)} days a round`));   // vision: one each way round, so a seat sees one twice a month
  out.push(ship("dispatch", routeLength(fleetType("dispatch"), { Hs: home }), seats.length, "R4", "a courier at each seat, on the doldrum coast only"));   // vision: one to a seat; the small hull keeps to the calm (league.md section 5, 11)
  routes.R5 = { ...ROUTES.R5, seats: landing, Hs: +home.toFixed(2) };
  out.push(ship("tender", routeLength(fleetType("tender"), { Hs: home }), landing, "R5", `lighters at the ${landing} seats with landing harbours, too shallow for a great galley's draught`));   // vision: one to a landing seat
  return { routes, ships: out, hulls: out.reduce((a, s) => a + s.count, 0) };
}


/** The whole sea's figures: every people's, and the totals by tradition and by reach. */
export function shipping() {
  const P = peoples().list, net = network(), rows = P.map((p) => seaOf(p, { net })), by = {};
  for (const r of rows) {
    const T = (by[r.t] ??= { peoples: 0, boats: 0, crew: 0, short: 0, idle: 0, yardShort: 0, quay: 0, boathouses: 0, own: 0, league: 0, theran: 0, storesShort: 0 });
    T.peoples++; T.boats += r.fleet.boats; T.crew += r.hands.need; T.short += r.hands.short; T.idle += r.hands.idle; T.yardShort += r.yard.short ? 1 : 0; T.quay += r.shore.quay; T.boathouses += r.shore.boathouses;
    T[r.route.carried === "its own" ? "own" : r.route.carried === "a Theran charter" ? "theran" : "league"]++;
    T.storesShort += Object.values(r.stores.short).some((v) => v > 1 / PHI) ? 1 : 0;   // derived: short past 1/phi of a store
  }
  return { rows, by };
}
