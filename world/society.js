// Pure (given a loaded map). Society: what each people wants, does, and who holds what, all as gates
// (core/gates.js) over what the world gives them (peoples.js) and where history has them now
// (history.js bake). These replace vanilla's villagers: every NPC is a people's, with a profession
// its living and its ground allow.
//
//   needs     what a people is short of, for how it lives: food against its numbers, timber for
//             boats and houses, stone, iron for tools and arms, goods to trade. Each a share in
//             [0, 1]: limited resources, so every people wants something
//   goal      its sharpest need now (or, with none, to prosper)
//   action    chosen by gates: what it can do (must) and what it would rather (prefer), given its
//             goal, its temper now, its fortune, and its borders (contested or trading)
//   rank      within its tradition, bounded: one seat, a share of ports, the rest outlying, by
//             strength (capacity and fortune). The seat can pass to another people of the same
//             tradition as fortunes turn, never out of it
//   people    its folk by vanilla profession: the trades its living and ground support, as many as
//             its numbers allow (a village of POP_PER folk a unit of capacity)
//
// Bounds keep the balance: a raid is only on a contested border and only toward a richer
// neighbour; a seat is held by one people a tradition; professions never exceed what the ground gives.
import { choose } from "../core/gates.js";
import { peoples } from "./peoples.js";
import { loop } from "./history.js";
import { TRADITIONS } from "./traditions.js";
import { fleetOf, SHIPS, raiseOf } from "./ships.js";

import { WORKS } from "./jobs.js";
const SOCIETY_BASE = {
  NEED: { food: 1, timber: 0.3, stone: 2, iron: 0.6, goods: 6 },   // vision: what a people wants (food a chunk, a share of wooded land, kinds of stone, iron (a want, not survival), kinds of goods)
  URGENCY: { food: 1.5, timber: 1, stone: 0.8, iron: 1, goods: 0.7 },   // vision: how hard each need presses
  FORTUNE_FOOD: 0.3,      // vision: how much fortune moves a people's hunger
  SAIL_GOODS: 0.5,        // vision: how much a want of sailcloth counts as a want of goods
  REPAIRS: 120,           // vision: repair units a shipwright keeps up with in a year
  CRAFTS: 0.3,            // vision: share of a people's folk in crafts (the rest work the food their living gives)
  PORTS: 0.2,             // vision: share of a tradition's peoples that are ports; one is the seat; the rest villages
  POP_PER: null,          // derived below: folk a unit of food yield feeds (the jobs' own law)
  POP_MAX: 64,            // vision: the most folk a people shows in one place (a village's size in the game)
};
// derived: a people holds as many folk as its food workers can feed working all its ground: every
// WORKS units of yield keep a worker at full stretch, and the food workers are (1 - CRAFTS) of the folk
export const SOCIETY = Object.freeze({ ...SOCIETY_BASE, POP_PER: 1 / (WORKS * (1 - SOCIETY_BASE.CRAFTS)) });

/** Vanilla's villager professions, each with its job block (vanilla's own pairing) and who has it. The cleric keeps the sacred sea (sealife.js). */
export const PROFESSIONS = [
  { id: "fisherman", block: "minecraft:barrel", for: (p) => p.food.fish },
  { id: "farmer", block: "minecraft:composter", for: (p) => p.food.crop },
  { id: "shepherd", block: "minecraft:loom", for: (p) => (p.herds.includes("minecraft:sheep") || p.herds.includes("minecraft:llama") ? p.food.herd : 0) },
  { id: "butcher", block: "minecraft:smoker", for: (p) => p.food.herd * 0.5 },
  { id: "leatherworker", block: "minecraft:cauldron", for: (p) => (p.herds.some((h) => /cow|horse|camel|llama|rabbit/.test(h)) ? p.food.herd * 0.4 : 0) },   // vision: the profession's weight
  { id: "fletcher", block: "minecraft:fletching_table", for: (p) => p.timber * p.chunks * 0.2 },   // vision: the profession's weight
  { id: "mason", block: "minecraft:stonecutter_block", for: (p) => p.stones.length * p.chunks * 0.05 },   // vision: the profession's weight
  { id: "toolsmith", block: "minecraft:smithing_table", for: (p) => (p.ores.includes("minecraft:iron_ore") ? p.chunks * 0.1 : 0) },   // vision: the profession's weight
  { id: "weaponsmith", block: "minecraft:grindstone", for: (p, s) => (p.ores.includes("minecraft:iron_ore") ? p.chunks * 0.05 * (s.temper === "raiders" ? 3 : 1) : 0) },   // vision: the profession's weight
  { id: "armorer", block: "minecraft:blast_furnace", for: (p, s) => (p.ores.includes("minecraft:iron_ore") && s.temper !== "traders" ? p.chunks * 0.04 : 0) },   // vision: the profession's weight
  { id: "cartographer", block: "minecraft:cartography_table", for: (p, s) => (s.temper === "traders" ? p.goods * 0.5 : p.goods * 0.1) },   // vision: the profession's weight
  { id: "cleric", block: "minecraft:brewing_stand", for: (p) => (p.coast?.length ? (p.food.fish ?? 0) * 0.1 + p.coast.length / 13 : 0) },   // vision: the sea's keepers, by the people's fishing and its shore (one for every thirteen chunks of it)
  { id: "librarian", block: "minecraft:lectern", for: (p) => (p.crops.includes("minecraft:sugar_cane") ? p.chunks * 0.05 : 0) },   // vision: the profession's weight
];   // vision: the weights per profession

/** What a people is short of (shares in [0, 1]). */
export function needs(p) {
  const N = SOCIETY.NEED, pop = p.capacity;
  return {
    food: Math.max(0, 1 - p.capacity / (p.chunks * N.food)),
    timber: Math.max(0, 1 - p.timber / N.timber),
    stone: Math.max(0, 1 - p.stones.length / N.stone),
    iron: p.ores.includes("minecraft:iron_ore") ? 0 : N.iron,
    goods: Math.max(0, 1 - p.goods / N.goods),
    pop,
  };
}
const sharpest = (n) => { const U = SOCIETY.URGENCY, k = ["food", "timber", "stone", "iron", "goods"].reduce((a, b) => (n[b] * U[b] > n[a] * U[a] ? b : a), "food"); return n[k] * U[k] > 0.3 ? k : "prosper"; };   // vision: below this, a need doesn't drive

/** The actions, as gates. ctx: { p, need, goal, fortune, temper, borders: { contested, trading }, richer } */
export const ACTIONS = [
  { name: "raid", gates: [
    { must: "hot", test: (s) => s.temper === "raiders" || (s.temper === "wary" && s.fortune < 0), why: "only a hungry, hot people raids" },
    { must: "front", test: (s) => s.richer && (s.borders.contested > 0 || s.temper === "raiders"), why: "at a richer neighbour: across a contested border, or any border if it lives by raiding" },
    { prefer: "want", test: (s) => s.need[s.goal] ?? 0, weight: 2, why: "for what it's short of" },
    { prefer: "arms", test: (s) => s.p.arms, why: "with the iron and boats to do it" } ] },
  { name: "trade", gates: [
    { must: "calm", test: (s) => s.temper !== "raiders", why: "raiders don't trade" },
    { must: "lane", test: (s) => s.borders.trading > 0 || s.temper === "traders", why: "with a calm neighbour, or as traders on the long lanes" },
    { must: "cargo", test: (s) => s.p.goods >= SOCIETY.NEED.goods / 2, why: "only with goods to carry" },
    { prefer: "want", test: (s) => (["goods", "iron", "stone", "timber"].includes(s.goal) ? 1 : 0), why: "for what its ground can't give" },
    { prefer: "traders", test: (s) => (s.temper === "traders" ? 1 : 0.3), why: "as traders do" } ] },   // vision: how much the gate leans when it doesn't match
  { name: "fish", gates: [
    { must: "waters", test: (s) => s.p.food.fish > 0, why: "it has fishing waters" },
    { prefer: "hungry", test: (s) => (s.goal === "food" ? 1 : 0.3), why: "food first" },   // vision: how much the gate leans when it doesn't match
    { prefer: "way", test: (s) => s.p.shares.fish, weight: 2, why: "as its people live" } ] },
  { name: "farm", gates: [
    { must: "fields", test: (s) => s.p.food.crop > 0, why: "it has fields" },
    { prefer: "hungry", test: (s) => (s.goal === "food" ? 1 : 0.3), why: "food first" },   // vision: how much the gate leans when it doesn't match
    { prefer: "way", test: (s) => s.p.shares.crop, weight: 2, why: "as its people live" } ] },
  { name: "herd", gates: [
    { must: "herds", test: (s) => s.p.food.herd > 0, why: "it keeps animals" },
    { prefer: "hungry", test: (s) => (s.goal === "food" ? 1 : 0.3), why: "food first" },   // vision: how much the gate leans when it doesn't match
    { prefer: "way", test: (s) => s.p.shares.herd, weight: 2, why: "as its people live" } ] },
  { name: "build", gates: [
    { must: "rising", test: (s) => s.fortune > 0, why: "only a rising people builds" },
    { must: "means", test: (s) => s.need.timber < 0.5 || s.need.stone < 0.5, why: "with timber or stone to hand" },
    { prefer: "prosper", test: (s) => (s.goal === "prosper" ? 1 : 0.3), weight: 2, why: "when nothing presses" } ] },   // vision: how much the gate leans when it doesn't match
  { name: "defend", gates: [
    { must: "threat", test: (s) => s.borders.contested > 0, why: "a contested border" },
    { prefer: "waning", test: (s) => (s.fortune < 0 ? 1 : 0.4), why: "holding what it has" } ] },   // vision: how much the gate leans when it doesn't match
];

/** Rank within each tradition: one seat, a bounded share of ports, villages (from strength now). */
export function ranks(fortunes = new Map()) {
  const out = new Map(), byT = {};
  for (const p of peoples().list) (byT[p.tradition] ??= []).push(p);
  for (const [t, list] of Object.entries(byT)) {
    const strength = (p) => p.capacity * (1 + 0.5 * (fortunes.get(p.key) ?? 0));   // vision: fortune moves strength by half
    const sorted = [...list].sort((a, b) => strength(b) - strength(a));
    const ports = Math.max(1, Math.round(list.length * SOCIETY.PORTS));
    sorted.forEach((p, i) => out.set(p.key, i === 0 ? "seat" : i <= ports ? "port" : "outlying"));
  }
  return out;
}

/** A people's society now, from the baked history (or the first day's, without one). */
export function societyOf(p, baked = null, w = null) {
  const L = loop(), i = L.findIndex((q) => q.key === p.key);
  const fortune = w && i >= 0 ? w.record[i] : 0;
  const temper = baked?.tempers.get(p.key) ?? p.temper;
  const B = baked?.borders ?? [];
  const mine = B.filter((b) => b.a === p.key || b.b === p.key);
  const borders = { contested: mine.filter((b) => b.state === "contested").length, trading: mine.filter((b) => b.state === "trading").length };
  const richer = mine.some((b) => { const q = peoples().byKey.get(b.a === p.key ? b.b : b.a); return q && q.richness > p.richness; });
  const need = needs(p);
  need.food = Math.max(0, Math.min(1, need.food - SOCIETY.FORTUNE_FOOD * fortune));   // a waning people grows hungrier, a rising one less so
  // ship stores: the sea's wear on its fleet, repaired in its own tradition's materials (ships.js)
  const folk0 = Math.min(SOCIETY.POP_MAX, Math.max(2, Math.round(p.capacity * SOCIETY.POP_PER)));
  // the fleet within its people's bounds: its hands (ships.js), and the yard that keeps it: a hull a LIFE, raised by at most
  // SHIPS.yard of the folk; a fleet past what that yard can keep is cut to it (the bound is the sea's reaction chain: a people
  // builds no more hulls than it can raise again as they wear out)
  const act0 = temper === "traders" ? "trade" : "fish";
  let fleet = fleetOf(p, { folk: folk0, action: act0, temper });
  const yardMax = Math.max(1, Math.floor(folk0 * SHIPS.yard)), keep = Math.floor(raiseOf(yardMax, fleet.hull) * SHIPS.life);
  if (fleet.boats > keep) fleet = fleetOf(p, { folk: folk0, action: act0, temper, cap: Math.max(1, keep) });
  need.timber = Math.max(need.timber, fleet.short.hull);
  need.iron = Math.max(need.iron, fleet.stores.fasten === "minecraft:iron_nugget" ? fleet.short.fasten * SOCIETY.NEED.iron : 0);
  need.goods = Math.max(need.goods, fleet.short.sail * SOCIETY.SAIL_GOODS);
  const goal = sharpest(need);
  const s = { p, need, goal, fortune, temper, borders, richer };
  const act = choose(ACTIONS, s);
  const st = { temper };
  const FOOD = new Set(["fisherman", "farmer", "shepherd", "butcher", "leatherworker"]);
  const weights = PROFESSIONS.map((r) => [r.id, Math.max(0, r.for(p, st))]);
  const sum = (f) => weights.filter(([id]) => f(id)).reduce((a, [, w]) => a + w, 0) || 1;
  const foodSum = sum((id) => FOOD.has(id)), craftSum = sum((id) => !FOOD.has(id));
  const folk = Math.min(SOCIETY.POP_MAX, Math.max(2, Math.round(p.capacity * SOCIETY.POP_PER)));
  const professions = Object.fromEntries(weights.filter(([, w]) => w > 0).map(([id, w]) => [id, Math.max(1, Math.round((FOOD.has(id) ? (w / foodSum) * (1 - SOCIETY.CRAFTS) : (w / craftSum) * SOCIETY.CRAFTS) * folk))]));
  const build = Math.ceil((fleet.boats / SHIPS.life) / raiseOf(1, fleet.hull));   // the hands to raise the hulls the fleet wears out
  const shipwrights = Math.min(folk, Math.max(fleet.boats > 0 ? 1 : 0, Math.round(fleet.wear / SOCIETY.REPAIRS), build));   // the yard's hands: its repairs, and its new hulls
  professions.shipwright = shipwrights;
  return { key: p.key, tradition: p.tradition, goal, action: act?.name ?? "rest", why: act?.reasons ?? [], fortune, temper, folk, professions, fleet };
}
export { TRADITIONS };
