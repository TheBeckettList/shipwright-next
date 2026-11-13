// Pure. A player's home port: a camp on a beach that grows, as the player brings it what it needs,
// through a hamlet, a village and a harbour town into a small fortress that berths a few ships.
// Its people are the player's: in a style the player picks (a tradition, whose materials come from
// that tradition's own peoples, peoples.js) or defines (any vanilla blocks, checked).
//
// Every day it's stepped once (a day is the clock's day rung):
//   the folk eat; fed, they grow toward the stage's number; hungry, they leave, one a day
//   the town wears: its buildings ask a little of their own materials, its berthed ships ask their
//     tradition's ship stores (ships.js) for every day they sailed
//   a stage is reached through gates (core/gates.js): the stores and food it costs delivered, the
//     town filled, enough days since the last stage. Then its cost is spent
// Nothing grows out of nothing: every block of the fortress is something the player brought.
import { judge } from "../core/gates.js";
import { peoples } from "./peoples.js";
import { SHIP_STORES } from "./ships.js";
import { TRADITIONS } from "./traditions.js";
import { architecture } from "./architecture.js";

// vision: the stages: folk, berths, what stands, what it costs (in the style's materials: wall, post, roof, stone; and food, iron), the days it takes at least
export const STAGES = [
  { name: "camp", folk: 0, berths: 1, stands: ["tent", "fire", "jetty"], cost: { wall: 20, post: 8, roof: 10, food: 10 }, days: 0 },   // vision: the stage
  { name: "hamlet", folk: 4, berths: 1, stands: ["2 homes", "a dock", "a store"], cost: { wall: 120, post: 30, roof: 80, food: 40 }, days: 1 },   // vision: the stage
  { name: "village", folk: 10, berths: 2, stands: ["5 homes", "a slipway", "a market stall", "a well"], cost: { wall: 300, post: 60, roof: 200, food: 120, iron: 10 }, days: 2 },   // vision: the stage
  { name: "harbour town", folk: 16, berths: 3, stands: ["8 homes", "a dry dock", "a warehouse", "a palisade"], cost: { wall: 600, post: 120, roof: 380, food: 240, iron: 40 }, days: 3 },   // vision: the stage
  { name: "fortress", folk: 24, berths: 4, stands: ["10 homes", "stone walls", "a gatehouse", "two towers", "a harbour chain", "a keep"], cost: { stone: 1200, wall: 400, post: 150, roof: 400, food: 400, iron: 120 }, days: 4 },   // vision: the stage
];
export const PORT = Object.freeze({
  EAT: 1,                 // vision: food a folk eats a day
  FILL: 0.75,             // vision: share of a stage's folk the town must hold before it grows again
  WEAR: { wall: 2, post: 0.5, roof: 1.5 },   // vision: a day's upkeep a stage, in each material
  SHIP_DAY: 3,            // vision: repair units a sailed ship asks a day
});

/** The style's materials: a tradition's (its peoples' commonest frame and roof) or the player's own. */
export function styleOf(style, exists = () => true) {
  if (style.custom) {
    const c = style.custom, bad = ["wall", "post", "roof", "stone"].filter((k) => !c[k] || !exists(c[k]));
    if (bad.length) throw new Error(`a defined style needs real blocks for: ${bad.join(", ")}`);
    return { ...c, tradition: style.tradition ?? "european", name: "own" };
  }
  const t = TRADITIONS[style.tradition];
  if (!t) throw new Error(`no tradition "${style.tradition}"`);
  // the tradition at home: its home climate and its boat woods, through the same grammar every people builds by
  const home = { woods: t.woods, T: t.T, M: t.M, timber: t.woods.length ? 1 : 0, living: t.living, temper: "peaceful", lat: 1, capacity: 1, chunks: 1,
    stones: t.T < 0 ? ["minecraft:packed_ice", "minecraft:stone"] : t.T > 22 && t.M < 0.4 ? ["minecraft:sandstone"] : ["minecraft:cobblestone", "minecraft:clay"],   // vision: home stone by climate
    crops: t.T > 12 ? ["minecraft:wheat"] : [], biomes: t.biome ? [t.biome.source.replace(/[^a-z_|]/g, "").split("|")[0]] : [] };   // vision: home warmth for grain
  const g = architecture(home);
  return { wall: g.frame.wall, post: g.frame.post, roof: g.roof.cover, stone: home.stones.find((x) => x !== "minecraft:packed_ice") ?? "minecraft:cobblestone", tradition: style.tradition, name: t.name, grammar: g };
}
const ids = (S) => ({ wall: S.wall, post: S.post, roof: S.roof, stone: S.stone, iron: "minecraft:iron_ingot" });

export const newPort = (style) => ({ day: 0, stage: 0, folk: 0, food: 0, since: 0, stores: {}, style, sailed: 0, log: [] });

/** Bring stores (vanilla items, { id: count }) and food (units). */
export function deliver(port, items = {}, food = 0) {
  for (const [id, n] of Object.entries(items)) port.stores[id] = (port.stores[id] ?? 0) + n;
  port.food += food;
  return port;
}
const have = (port, id, n) => (port.stores[id] ?? 0) >= n;
const take = (port, id, n) => { port.stores[id] = Math.max(0, (port.stores[id] ?? 0) - n); };

/** The gates to the next stage. */
export function nextGates(port) {
  const S = port.style, I = ids(S), next = STAGES[port.stage + 1];
  if (!next) return null;
  const cost = Object.entries(next.cost).filter(([k]) => k !== "food");
  return [
    { must: "stores", test: (p) => cost.every(([k, n]) => have(p, I[k], n)), why: `the stores it costs: ${cost.map(([k, n]) => `${n} ${I[k].replace("minecraft:", "")}`).join(", ")}` },
    { must: "food", test: (p) => p.food >= next.cost.food, why: `${next.cost.food} food` },
    { must: "filled", test: (p) => p.folk >= Math.floor(STAGES[p.stage].folk * PORT.FILL), why: "the town filled first" },
    { must: "time", test: (p) => p.since >= next.days, why: `${next.days} days since the last stage` },
  ];
}
/** One day. sailedShips: how many of its berthed ships sailed today. */
export function day(port, sailedShips = 0) {
  const st = STAGES[port.stage], S = port.style, I = ids(S);
  // the folk eat, grow or leave
  const eat = port.folk * PORT.EAT;
  if (port.food >= eat) { port.food -= eat; if (port.folk < st.folk) port.folk++; } else { port.food = 0; port.folk = Math.max(0, port.folk - 1); }
  // the town wears, and its ships ask their stores
  for (const [k, n] of Object.entries(PORT.WEAR)) take(port, I[k], n * port.stage);
  const stores = SHIP_STORES[S.tradition] ?? SHIP_STORES.european, ships = Math.min(sailedShips, st.berths);
  take(port, stores.hull, ships * PORT.SHIP_DAY); if (stores.fasten) take(port, stores.fasten, (ships * PORT.SHIP_DAY) / 2);
  port.sailed += ships;
  // grow, through the gates
  const g = nextGates(port);
  if (g && judge(g, port).ok) {
    const next = STAGES[port.stage + 1];
    for (const [k, n] of Object.entries(next.cost)) { if (k === "food") port.food -= n; else take(port, I[k], n); }
    port.stage++; port.since = 0; port.log.push({ day: port.day, stage: next.name });
  } else port.since++;
  port.day++;
  return port;
}
export { SHIP_STORES };
