// Pure (given a loaded map). The Koinon (the League): one island of twelve sovereign city-states, each the master
// of one piece of a ship that no culture owns (the cultures keep their own: the shield rail, the
// outrigger, the sewn seams...). Like the pirate lords, each has its lord, its seat and its trade;
// unlike them, they keep the peace, raid no one and are raided by no one (neutral, like the Swiss), and
// keep Thera's market: the money people, striking the Koinon's coin. The Therans stand above them.
//
//   where     the big island nearest Thera's antipode: the other side of the world from the
//             centre of trade, the far goal of a circumnavigation
//   twelve    the months: each state presides over the League for one month, round the coast, so
//             the presidency goes once round the island in a year (360 days, 30 a state: 30
//             degrees of coast a month). And the 6D law's count: Lambda^2 of the 2x2 block has six
//             pairs, each with the lost sign: twelve. Each state's twin sits across the island
//             (six on), and twins master paired pieces (strike and shelter, see and shoot...): no
//             state holds a piece without its twin holding the answer to it
//   states    the island's peoples, taken round the coast in order from its centre and cut into
//             twelve arcs; each arc's strongest people is its seat (its city), the rest its towns.
//             They keep their cultures; what makes them a state is the piece they master
//   pieces    the common modules of the pack (config/modules.js) and the iron anchor: each made
//             as a kit of vanilla items from the state's stores, and fitted to any people's fleet
//             that buys one at Thera. Pairs go to twin states by how well the pair's stuff fits
//             their ground, the most constrained first
import { islands } from "./islands.js";
import { peoples } from "./peoples.js";
import { THERA } from "./thera.js";
import { D } from "../core/given.js";

// vision: each piece as a kit of items the economy makes (from the pack's module costs, worked back to raw stuff); WOOD is the state's own log
export const PIECES = {
  hold: { name: "Hold", bill: { WOOD: 2 }, effect: { capacity: 2 }, for: ["cargo"] },
  ram: { name: "Ram", bill: { "minecraft:raw_copper": 36 }, effect: { attack: 1.25 }, for: ["war"] },   // vision: the piece's kit and what it does
  bunk: { name: "Bunk", bill: { "minecraft:white_wool": 3, WOOD: 1 }, effect: { capacity: 1.25 }, for: ["cargo"] },   // vision: the piece's kit and what it does
  lookout: { name: "Lookout", bill: { "minecraft:iron_nugget": 8, "minecraft:stick": 8, "minecraft:coal": 1 }, effect: { wear: 0.9, guard: 1.1 }, for: ["small", "cargo"] },   // vision: the piece's kit and what it does
  crossbow: { name: "Crossbow mount", bill: { "minecraft:stick": 3, "minecraft:string": 2, "minecraft:iron_ingot": 4 }, effect: { attack: 1.2 }, for: ["war"] },   // vision: the piece's kit and what it does
  cannon: { name: "Cannon", bill: { "minecraft:iron_ingot": 27 }, effect: { attack: 1.5 }, for: ["war"] },   // vision: the piece's kit and what it does
  diving_bell: { name: "Diving bell", bill: { "minecraft:sand": 4, "minecraft:coal": 2, "minecraft:iron_ingot": 4, "minecraft:iron_nugget": 6 }, effect: { salvage: 1 }, for: ["small", "cargo"] },   // vision: the piece's kit and what it does
  benches: { name: "Benches", bill: { WOOD: 2 }, effect: { catch: 1.15 }, for: ["small", "war"] },   // vision: the piece's kit and what it does
  canopy: { name: "Canopy", bill: { "minecraft:white_wool": 4, "minecraft:stick": 6 }, effect: { catch: 1.05, wear: 0.95 }, for: ["small"] },   // vision: the piece's kit and what it does
  navigation: { name: "Navigation", bill: { "minecraft:iron_ingot": 4, "minecraft:string": 4, "minecraft:paper": 2 }, effect: { wear: 0.8 }, for: ["cargo", "war"] },   // vision: the piece's kit and what it does
  full_deck: { name: "Full deck", bill: { WOOD: 8 }, effect: { wear: 0.85 }, for: ["cargo", "war"] },   // vision: the piece's kit and what it does
  iron_anchor: { name: "Iron anchor", bill: { "minecraft:iron_ingot": 10, "minecraft:iron_nugget": 9 }, effect: { wear: 0.9 }, for: ["cargo", "war", "small"] },   // vision: the piece's kit and what it does
};
// vision: the twins: each piece and its answer
export const TWINS = [["ram", "full_deck"], ["cannon", "iron_anchor"], ["crossbow", "lookout"], ["hold", "diving_bell"], ["benches", "canopy"], ["navigation", "bunk"]];
// vision: the states' names, from their pieces (the lords take the state's name)
const NAMES = { hold: "Holdfast", ram: "Ramshead", bunk: "Restharbour", lookout: "Watchtop", crossbow: "Boltgate", cannon: "Thunderport", diving_bell: "Bellwater",
  benches: "Oarsend", canopy: "Shadeby", navigation: "Starward", full_deck: "Deckhall", iron_anchor: "Anchorhold" };
export const KOINON_NAME = "the Koinon";
export const LEAGUE = Object.freeze({ STATES: TWINS.length * 2, MASTERS: 2, KIT_LIFE: 24, BIG: 5000 });   // derived: six twin pairs, twelve states; vision: kits a master makes a month, months a kit lasts, chunks that make an island big

const need = (piece) => Object.keys(PIECES[piece].bill).map((id) => id.replace("minecraft:", ""));
/** How well a state's ground gives a piece's stuff: the share of its inputs its peoples can make. */
function fit(state, piece) {
  const has = (k) => state.peoples.some((p) => (k === "WOOD" ? p.woods.length > 0 : k === "raw_copper" ? p.ores.includes("minecraft:copper_ore") : k === "coal" ? p.ores.includes("minecraft:coal_ore")
    : /iron/.test(k) ? p.ores.includes("minecraft:iron_ore") : k === "sand" ? p.stones.includes("minecraft:sand") : k === "white_wool" ? p.herds.includes("minecraft:sheep") : k === "paper" ? p.crops.includes("minecraft:sugar_cane") : true));
  const ks = need(piece); return ks.filter(has).length / ks.length;
}

let cache = null;
/** The Koinon: its island, its twelve states (seat, towns, piece, twin, lord), from the map alone. */
export function league() {
  if (cache) return cache;
  const I = islands(), W = I.W, ax = (THERA.seat.cx + W / 2) % W, az = I.H - THERA.seat.cz;   // Thera's antipode
  const dist = (a) => { let dx = Math.abs(a.cx - ax); dx = Math.min(dx, W - dx); return Math.hypot(dx, a.cz - az); };
  const island = I.info.filter((x) => x.area >= LEAGUE.BIG).sort((a, b) => dist(a) - dist(b))[0];
  const P = peoples().list.filter((p) => p.island === island.id);
  const ang = (p) => { let dx = p.cx - island.cx; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; return Math.atan2(p.cz - island.cz, dx); };
  const round = [...P].sort((a, b) => ang(a) - ang(b)), S = LEAGUE.STATES;
  const states = Array.from({ length: S }, (_, k) => {
    const peoples = round.slice(Math.floor((k * round.length) / S), Math.floor(((k + 1) * round.length) / S));
    const seat = [...peoples].sort((a, b) => b.capacity - a.capacity)[0];
    return { k, peoples, seat, towns: peoples.filter((p) => p !== seat), twin: (k + S / 2) % S };
  });
  // the pieces: twin pairs to twin states, the most constrained pair first, each pair to the twin states it fits best
  const pairs = TWINS.map((pr) => ({ pr, fits: states.slice(0, S / 2).map((s) => Math.max(fit(s, pr[0]) + fit(states[s.twin], pr[1]), fit(s, pr[1]) + fit(states[s.twin], pr[0]))) }));
  pairs.sort((a, b) => a.fits.filter((f) => f >= 1.5).length - b.fits.filter((f) => f >= 1.5).length);   // vision: a pair fits a state pair when three of four inputs are on its ground
  const free = new Set(states.slice(0, S / 2).map((s) => s.k));
  for (const { pr } of pairs) {
    let best = null;
    for (const k of free) { const s = states[k], t = states[s.twin], a = fit(s, pr[0]) + fit(t, pr[1]), b = fit(s, pr[1]) + fit(t, pr[0]); const sc = Math.max(a, b); if (!best || sc > best.sc) best = { k, sc, flip: b > a }; }
    free.delete(best.k);
    const s = states[best.k], t = states[s.twin]; [s.piece, t.piece] = best.flip ? [pr[1], pr[0]] : pr; s.fit = fit(s, s.piece); t.fit = fit(t, t.piece);
  }
  for (const s of states) { s.name = NAMES[s.piece]; s.lord = `the Lord of ${s.name}`; }
  const bySeat = new Map(states.map((s) => [s.seat?.key, s])), byPeople = new Map(states.flatMap((s) => s.peoples.map((p) => [p.key, s])));
  cache = { island: island.id, area: island.area, at: { cx: island.cx, cz: island.cz }, antipode: { cx: ax, cz: az }, states, bySeat, byPeople };
  return cache;
}
/** Who presides over the Koinon in month m: once round the island a year. */
export const presiding = (m) => league().states[m % LEAGUE.STATES];
/** A state's masters: one for every 233 of its peoples' capacity (about eighty folk), the fewest two; twice while presiding. */
export const mastersOf = (st, m) => Math.max(LEAGUE.MASTERS, Math.ceil(st.peoples.reduce((a, p) => a + p.capacity, 0) / FIB_233)) * (presiding(m) === st ? 2 : 1);   // derived: a Fibonacci share of hands
const FIB_233 = 233;   // derived: a master for every 233 of capacity (a Fibonacci number: about one for every eighty folk)
/** A kit's bill for a state: WOOD as its seat's own log. */
export const kitBill = (piece, state) => Object.fromEntries(Object.entries(PIECES[piece].bill).map(([id, n]) => [id === "WOOD" ? state.seat.woods[0] ?? "minecraft:stick" : id, n]));
export { D };
