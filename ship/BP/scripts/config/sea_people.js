// Pure data. Who else sails: villager crews (each village biome's own boats, friendly) and the sea
// Illagers (raiders, by era; level 3 are the bosses). Every crew ship carries two people who matter:
//
//   navigator  keeps the charts. A villager navigator trades them; an Illager navigator drops one.
//              A chart's marks go into your chart book: their home water, wrecks, shoals, and for
//              Illagers their cove and the treasure they buried.
//   captain    carries the key to the ship's sea chest, which also opens the treasure their
//              navigator charted; an Illager captain drops it with loot that's theirs alone. A
//              villager captain gives you theirs when you've driven raiders off their water.
//
// marks: what a navigator's chart holds (kinds: home, cove, wreck, shoal, treasure, patrol).
// loot: [item, min, max] plus `unique`: one named piece only that captain carries.

export const VILLAGER_CREWS = {
  plains: { ship: "cog", navigator: "Plains navigator", captain: "Plains skipper", marks: ["home", "shoal", "wreck"] },
  desert: { ship: "dhow", navigator: "Desert navigator", captain: "Desert nakhoda", marks: ["home", "shoal", "wreck"] },
  savanna: { ship: "war_canoe", navigator: "Savanna pilot", captain: "Savanna headman", marks: ["home", "shoal", "wreck"] },
  taiga: { ship: "longship", navigator: "Taiga pilot", captain: "Taiga skipper", marks: ["home", "shoal", "wreck"] },
  snowy: { ship: "umiak", navigator: "Ice pilot", captain: "Snowy skipper", marks: ["home", "shoal", "wreck"] },
  jungle: { ship: "voyaging_canoe", navigator: "Wayfinder", captain: "Jungle navigator-chief", marks: ["home", "shoal", "wreck"] },
  swamp: { ship: "flatboat", navigator: "Bayou pilot", captain: "Swamp boatman", marks: ["home", "shoal", "wreck"] },
  cherry: { ship: "bezaisen", navigator: "Grove pilot", captain: "Grove sendō", marks: ["home", "shoal", "wreck"] },
};

/** What a villager navigator asks for a chart, and what a villager captain's thanks holds. */
export const VILLAGER_TRADES = {
  chart: { cost: [{ ids: ["minecraft:emerald"], count: 6, label: "Emerald" }, { ids: ["minecraft:paper"], count: 2, label: "Paper" }] },
  thanks: [["minecraft:emerald", 4, 10], ["minecraft:cooked_cod", 4, 8], ["minecraft:lead", 1, 2]],
};

export const ILLAGER_CREWS = {
  1: {
    era: "Reavers", navigator: "Reaver pilot", captain: "Reaver chief", mob: { navigator: "minecraft:pillager", captain: "minecraft:vindicator" },
    marks: ["cove", "patrol", "treasure"],
    loot: [["minecraft:emerald", 3, 8], ["minecraft:iron_ingot", 2, 6], ["minecraft:arrow", 8, 16], ["minecraft:string", 2, 5]],
    unique: { item: "minecraft:iron_axe", name: "Reaver's Boarding Axe", lore: ["Notched on a hundred gunwales."] },
    treasure: [["minecraft:emerald", 8, 16], ["minecraft:gold_ingot", 2, 6], ["minecraft:iron_ingot", 4, 10], ["minecraft:saddle", 0, 1]],
  },
  2: {
    era: "Freebooters", navigator: "Freebooter navigator", captain: "Freebooter captain", mob: { navigator: "minecraft:pillager", captain: "minecraft:pillager" },
    marks: ["cove", "patrol", "wreck", "treasure"],
    loot: [["minecraft:emerald", 6, 14], ["minecraft:gunpowder", 4, 10], ["minecraft:gold_ingot", 2, 5], ["minecraft:iron_nugget", 8, 20]],
    unique: { item: "minecraft:spyglass", name: "Freebooter's Spyglass", lore: ["Brass, dented, and always pointed at your sails."] },
    treasure: [["minecraft:emerald", 14, 28], ["minecraft:gold_block", 1, 3], ["minecraft:diamond", 1, 3], ["minecraft:gunpowder", 8, 16]],
  },
  3: {
    era: "Pirate lords", navigator: "Fleet navigator", captain: "Pirate lord", mob: { navigator: "minecraft:pillager", captain: "minecraft:evoker" },
    marks: ["cove", "patrol", "wreck", "treasure"],
    loot: [["minecraft:emerald", 16, 32], ["minecraft:diamond", 2, 5], ["minecraft:gold_block", 1, 3]],
    unique: { item: "minecraft:totem_of_undying", name: "Admiral's Totem", lore: ["Taken from the Grey Totem's own hand."] },
    treasure: [["minecraft:emerald_block", 2, 5], ["minecraft:diamond", 4, 8], ["minecraft:enchanted_golden_apple", 0, 1], ["minecraft:heart_of_the_sea", 0, 1]],
  },
};

/** How a chart mark reads in the book. */
export const MARK_KINDS = {
  home: { name: "home water", icon: "§a⚓" },
  cove: { name: "Illager cove", icon: "§c☠" },
  wreck: { name: "wreck", icon: "§7≈" },
  shoal: { name: "shoal", icon: "§e!" },
  treasure: { name: "buried treasure", icon: "§6✕" },
  patrol: { name: "raider patrol", icon: "§c→" },
  mine: { name: "your mark", icon: "§b●" },
};
