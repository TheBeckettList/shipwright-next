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
//              longer than its fleet's reach is sailed by others (the League's ships, or a Theran charter)
import { FIB, PHI } from "../core/golden.js";
import { VISION } from "../core/given.js";
import { peoples } from "./peoples.js";
import { societyOf } from "./society.js";
import { FLEETS, sizeOf, typeFor, harbourOf, REACH } from "./boatsizes.js";
import { network, chunkDist } from "./trade.js";
import { SHIPS, raiseOf } from "./ships.js";

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
    route: { to: first?.hub ?? null, chunks: Math.round(dist), hops, need, best, carried },
  };
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
