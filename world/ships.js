// Pure (given a loaded map). Ships make resources matter: every tradition's boats are built of its
// own materials, the sea wears them, and what a people can't grow or dig for its repairs it must
// trade for (society.js reads the shortfall as a need).
//
//   fleet     a people's boats by what it does: fishers keep many small boats, traders a few
//             cargo ships, raiders warships; never more than its folk can crew
//   wear      each year a boat sails a distance (fishing grounds and back daily; voyages to its
//             trade partner; raids at its target), worn faster in a heavier sea (the sea state its
//             belt's wind raises, sea.js). Wear is repaired in the boat's own materials
//   supply    what its ground gives of each material a year: its woods as planks, iron ore as
//             nuggets, sheep as wool, spiders' string at night on every island
//   short     repair need minus supply, as a share: what drives its trade for ship stores
import { seaState } from "../core/sea.js";
import { windAt } from "../core/wind.js";
import { greatCircle } from "../core/globe.js";
import { GIVEN, D } from "../core/given.js";
import { peoples } from "./peoples.js";
import { sizeOf, typeFor } from "./boatsizes.js";
const crews = new Map();
/** The crew of a people's boat of a kind (its type's typical size), or the old flat count where it has no type. */
export const crewOf = (t, kind, temper) => { const k = `${t}|${kind}|${temper}`; if (!crews.has(k)) { const ty = typeFor(t, kind, temper); crews.set(k, ty ? sizeOf(ty).crew : SHIPS.crew[kind]); } return crews.get(k); };

// vision: each tradition's ship stores (vanilla items): hull, fastening, sail (null: paddled or poled)
export const SHIP_STORES = {
  norse: { hull: "minecraft:spruce_planks", fasten: "minecraft:iron_nugget", sail: "minecraft:white_wool" },
  european: { hull: "minecraft:oak_planks", fasten: "minecraft:iron_nugget", sail: "minecraft:white_wool" },
  birchbark: { hull: "minecraft:birch_log", fasten: "minecraft:string", sail: null },
  pacific: { hull: "minecraft:jungle_planks", fasten: "minecraft:string", sail: "minecraft:white_wool" },
  indian_ocean: { hull: "minecraft:acacia_planks", fasten: "minecraft:string", sail: "minecraft:white_wool" },
  east_asian: { hull: "minecraft:bamboo_planks", fasten: "minecraft:iron_nugget", sail: "minecraft:bamboo" },
  japanese: { hull: "minecraft:cherry_planks", fasten: "minecraft:iron_nugget", sail: "minecraft:white_wool" },
  dugout: { hull: "minecraft:dark_oak_log", fasten: null, sail: null },
  shallow: { hull: "minecraft:mangrove_planks", fasten: "minecraft:string", sail: null },
  arctic: { hull: "minecraft:leather", fasten: "minecraft:string", sail: null, frame: "minecraft:bone" },
};
export const SHIPS = Object.freeze({
  crew: { small: 2, cargo: 6, war: 10 },          // vision: folk a boat of each kind takes where a people has no type of its own (boatsizes.js sizes the rest)
  share: { fishers: 0.5, traders: 0.35, raiders: 0.5 },   // vision: share of a people's folk that go to sea in their kind of boat
  trips: { small: 60, cargo: 4, war: 3 },         // vision: trips a year (fishing daily through the season; a few voyages; a few raids)
  ground: 40,                                     // vision: blocks to the fishing grounds
  wear: 0.002,                                    // vision: repair units a block sailed, in a calm sea
  heavy: 2,                                       // vision: blocks of significant wave height that double the wear
  per: { hull: 1, fasten: 0.5, sail: 0.25 },      // vision: stores a repair unit takes
  supply: { wood: 30, iron: 20, wool: 6, string: 3 },   // vision: stores a year from a wooded chunk, an iron-bearing island's chunk, a sheep-keeping chunk, any chunk at night
  life: 13,                                       // vision: a hull's years at sea before it's broken up
  frame: 1 / 8,                                   // vision: a block of hull (length x beam x depth) a shipwright frames in eight days
  yard: 1 / 4.236,                                // derived: the yard takes at most 1/phi^3 of a people's hands (past it, the fleet is what the yard can keep)
});
/** Hulls a year a yard of w shipwrights raises for hulls of this many blocks. */
export const raiseOf = (w, hull) => (w * 360 * SHIPS.frame) / Math.max(1, hull);   // given: the year's days
const woodOf = (id) => id?.replace(/^minecraft:/, "").replace(/_(planks|log)$/, "");

/** A people's fleet, its year of wear, its stores' supply and shortfall. folk and action from society.js. */
export function fleetOf(p, { folk, action, temper, cap = Infinity }, baked = null) {
  const S = SHIPS, stores = SHIP_STORES[p.tradition];
  const kind = temper === "raiders" ? "war" : temper === "traders" || action === "trade" ? "cargo" : "small";
  const share = kind === "war" ? S.share.raiders : kind === "cargo" ? S.share.traders : S.share.fishers;
  const boats = Math.max(1, Math.min(cap, Math.floor((folk * share) / crewOf(p.tradition, kind, temper))));   // the crew the people's own boat of that kind needs (boatsizes.js: one measure for the sea, the yard and the shore)
  // where they sail: the fishing grounds, the partner, the target
  const by = peoples().byKey, C = D.PX, at = (q) => ({ x: q.cx * C, z: q.cz * C });
  const far = (k) => (k && by.get(k) ? greatCircle(at(p), at(by.get(k))) : S.ground * 10);   // vision: no partner: a long coasting voyage
  const leg = kind === "small" ? S.ground : kind === "cargo" ? far(p.partner) : far(p.target);
  const w = windAt(p.cx * C, p.cz * C, 0), Hs = seaState(w.speed).Hs;
  const units = boats * S.trips[kind] * 2 * leg * S.wear * (1 + Hs / S.heavy);
  const need = { hull: units * S.per.hull, fasten: stores.fasten ? units * S.per.fasten : 0, sail: stores.sail ? units * S.per.sail : 0 };
  // what the ground gives of each store
  const hasWood = p.woods.some((l) => woodOf(l) === woodOf(stores.hull)) || (stores.hull === "minecraft:leather" && p.herds.length > 0);
  const iron = p.ores.includes("minecraft:iron_ore"), sheep = p.herds.includes("minecraft:sheep") || p.herds.includes("minecraft:llama");
  const supply = {
    hull: hasWood ? p.timber * p.chunks * S.supply.wood : 0,
    fasten: stores.fasten === "minecraft:iron_nugget" ? (iron ? p.chunks * S.supply.iron : 0) : stores.fasten === "minecraft:string" ? p.chunks * S.supply.string : 0,
    sail: stores.sail === "minecraft:white_wool" ? (sheep ? p.chunks * S.supply.wool : 0) : stores.sail ? p.chunks * S.supply.wood * p.timber : 0,
  };
  const short = Object.fromEntries(Object.keys(need).map((k) => [k, need[k] > 0 ? Math.max(0, Math.min(1, 1 - supply[k] / need[k])) : 0]));
  const ty = typeFor(p.tradition, kind, temper), z = ty ? sizeOf(ty) : null, hull = z ? z.L * z.B * z.depth : 1;
  return { kind, boats, hull, leg: Math.round(leg), Hs: +Hs.toFixed(2), wear: +units.toFixed(1), need, supply, short, stores };
}
