// inherency: data (the jobs' vision table: what each trade makes and uses a month)
// The jobs: what each of vanilla's professions does with its people's ground in a month, at its own
// job block, in its own hours. Everything made is a vanilla item, and comes from something the
// people has (its sea, its fields, its herds, its rock, its woods): nothing is made from nothing.
// The shipwright is the pack's own trade, at the pack's own block.
//
//   at      the job block (where the worker stands; folk.js sends them there in their hours)
//   hours   the day's parts the job is worked in (folk.js parts)
//   makes   (p, n) -> { item: per worker a month }: scaled by how much ground there is for each of its n workers
//   uses    (p) -> { item: per worker a month } taken from the stores to do it
//   food    food units an item is worth, when eaten

const bestCrop = (p) => [...p.crops].sort((a, b) => (FOOD[b] ?? 0) - (FOOD[a] ?? 0))[0] ?? "minecraft:wheat";
const one = (list, fallback) => (list && list.length ? list[0] : fallback);
const per = (x, workers) => Math.max(0.2, Math.min(2, x / Math.max(1, workers * WORKS)));   // the ground's plenty for each worker: what's there over what they can work (a fifth to twice)
export const WORKS = 4;   // vision: yield units of ground a worker can work in a month

export const JOBS = {
  cleric: { at: "minecraft:brewing_stand", hours: ["dawn", "dusk"], makes: () => ({}), keeps: "the shrine at the waterline: reads the sea's record, tells the wardens" },   // the sea's keeper: makes nothing to sell
  fisherman: { at: "minecraft:barrel", hours: ["dawn", "morning"], makes: (p, n = 1) => ({ [one(p.sea.filter((x) => /cod|salmon|tropical|puffer/.test(x)), "minecraft:cod")]: 120 * per(p.food.fish, n) }) },
  farmer: { at: "minecraft:composter", hours: ["morning", "afternoon"], makes: (p, n = 1) => ({ [bestCrop(p)]: 180 * per(p.food.crop, n) }) },   // the most nourishing crop its ground grows
  shepherd: { at: "minecraft:loom", hours: ["morning", "afternoon"], makes: (p, n = 1) => ({ "minecraft:white_wool": 12 * per(p.food.herd, n), "minecraft:mutton": 18 * per(p.food.herd, n) }) },
  butcher: { at: "minecraft:smoker", hours: ["afternoon", "dusk"], makes: (p, n = 1) => ({ [p.herds.includes("minecraft:pig") ? "minecraft:cooked_porkchop" : p.herds.includes("minecraft:chicken") ? "minecraft:cooked_chicken" : "minecraft:cooked_beef"]: 72 * per(p.food.herd, n), "minecraft:bone": 12 * per(p.food.herd, n) }) },
  leatherworker: { at: "minecraft:cauldron", hours: ["afternoon"], makes: (p, n = 1) => ({ "minecraft:leather": 10 * per(p.food.herd, n) }) },
  fletcher: { at: "minecraft:fletching_table", hours: ["morning", "afternoon"], makes: (p, n = 1) => ({ "minecraft:arrow": 32 * per(p.timber * p.chunks, n), "minecraft:stick": 32 * per(p.timber * p.chunks, n) }) },
  mason: { at: "minecraft:stonecutter_block", hours: ["morning", "afternoon"], makes: (p, n = 1) => { const k = per(p.stones.length * p.chunks + p.timber * p.chunks, n), o = {}; for (const [id, n] of [[p.build.frame.wall, 64], [p.build.frame.post, 16], [p.build.roof.cover, 48]]) o[id] = (o[id] ?? 0) + n * k; return o; } },   // the builders: the people's own wall, post and roof
  toolsmith: { at: "minecraft:smithing_table", hours: ["afternoon"], makes: () => ({ "minecraft:iron_pickaxe": 1, "minecraft:iron_ingot": 3, "minecraft:iron_nugget": 27 }), uses: () => ({ "minecraft:raw_iron": 9 }) },   // nuggets for rivets: three ingots' worth
  weaponsmith: { at: "minecraft:grindstone", hours: ["afternoon"], makes: () => ({ "minecraft:iron_sword": 2 }), uses: () => ({ "minecraft:raw_iron": 2 }) },
  armorer: { at: "minecraft:blast_furnace", hours: ["afternoon", "dusk"], makes: () => ({ "minecraft:iron_chestplate": 1 }), uses: () => ({ "minecraft:raw_iron": 8 }) },
  cartographer: { at: "minecraft:cartography_table", hours: ["afternoon"], makes: () => ({ "minecraft:empty_map": 3 }), uses: () => ({ "minecraft:paper": 3 }) },
  librarian: { at: "minecraft:lectern", hours: ["afternoon", "dusk"], makes: (p, n = 1) => ({ "minecraft:paper": 24 * per(p.crops.includes("minecraft:sugar_cane") ? p.chunks : 0, n), "minecraft:book": 2 }) },
  shipwright: { at: "shipwright:shipwright_table", hours: ["morning", "afternoon"], makes: () => ({}) },   // repairs: works the fleet's stores into its hulls (economy.js)
  miner: { at: null, hours: ["morning", "afternoon"], makes: (p, n = 1) => ({ ...(p.ores.includes("minecraft:iron_ore") ? { "minecraft:raw_iron": 12 } : {}), ...(p.ores.includes("minecraft:copper_ore") ? { "minecraft:raw_copper": 16 } : {}), ...(p.ores.includes("minecraft:coal_ore") ? { "minecraft:coal": 10 } : {}), ...(p.stones.includes("minecraft:sand") ? { "minecraft:sand": 24 } : {}), "minecraft:cobblestone": 48 }) },   // not a vanilla profession: the folk who dig (the old mod's own)
  folk: { at: null, hours: ["morning", "afternoon"], makes: (p, n = 1) => ({ [one(p.woods, "minecraft:stick")]: 6 * per(p.timber * p.chunks, n), "minecraft:string": 4 }) },   // the rest: gathering wood (logs), and string from the spiders of the island's nights
};
/** Food units each eaten item gives (vanilla's own hunger points, a given). */
export const FOOD = {
  "minecraft:cod": 2, "minecraft:salmon": 2, "minecraft:tropical_fish": 1, "minecraft:pufferfish": 1, "minecraft:wheat": 1.7, "minecraft:carrot": 3, "minecraft:potato": 1, "minecraft:beetroot": 1,
  "minecraft:melon_slice": 2, "minecraft:sweet_berries": 2, "minecraft:mutton": 2, "minecraft:cooked_porkchop": 8, "minecraft:cooked_chicken": 6, "minecraft:cooked_beef": 8, "minecraft:cocoa_beans": 0, "minecraft:sugar_cane": 0,
};   // given: Minecraft's food points (wheat as a third of a loaf of bread)
export const EAT = 60;   // food points a folk eats a month (two a day of a month's thirty)
export const KEEP = { food: 2, goods: 6 };   // months of its own making a people's stores hold (food spoils past its months; goods past theirs go to market or rot)
