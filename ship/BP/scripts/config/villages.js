// Pure data. Village docks (yard level 2): the look of the vanilla village of the biome the dock
// stands in, so a dock fits the village it's built beside. Every id here is a Bedrock id (the lab
// checks them against the game's own block list).
//
//   planks, log, strip (stripped log), stairs, slab, fence, door, trapdoor: the village's wood
//   found: foundation course; path: the village path; roof / roofSlab: roof stairs and slabs
//   flat: true for flat roofs (desert); window; lamp: lantern or torch; flower: potted in windows
//   extra: the biome's touch (hay, terracotta, snow, moss); wall / deck / post / accent / light: the walkway

const W = (wood, o = {}) => ({
  planks: `minecraft:${wood}_planks`, log: `minecraft:${wood}_log`, strip: `minecraft:stripped_${wood}_log`,
  stairs: `minecraft:${wood}_stairs`, slab: `minecraft:${wood}_slab`, fence: `minecraft:${wood}_fence`,
  door: `minecraft:${wood}_door`, trapdoor: `minecraft:${wood}_trapdoor`, ...o,
});

export const VILLAGES = {
  plains: {
    name: "Plains village dock", ...W("oak", { door: "minecraft:wooden_door", trapdoor: "minecraft:trapdoor" }),
    found: "minecraft:cobblestone", path: "minecraft:grass_path", roof: "minecraft:oak_stairs", roofSlab: "minecraft:oak_slab", roofFull: "minecraft:oak_planks",
    window: "minecraft:glass_pane", lamp: "minecraft:lantern", flower: "minecraft:flower_pot", extra: "minecraft:hay_block",
    wall: "minecraft:oak_slab", deck: "minecraft:spruce_slab", post: "minecraft:oak_log", accent: "minecraft:oak_fence", light: "minecraft:lantern",
  },
  desert: {
    name: "Desert village dock", ...W("jungle"),
    planks: "minecraft:smooth_sandstone", log: "minecraft:cut_sandstone", strip: "minecraft:chiseled_sandstone",
    stairs: "minecraft:smooth_sandstone_stairs", slab: "minecraft:smooth_sandstone_slab",
    found: "minecraft:sandstone", path: "minecraft:smooth_sandstone", roof: "minecraft:smooth_sandstone_stairs", roofSlab: "minecraft:cut_sandstone_slab",
    roofFull: "minecraft:smooth_sandstone", flat: true, window: "minecraft:glass_pane", lamp: "minecraft:lantern", flower: "minecraft:flower_pot",
    extra: "minecraft:orange_terracotta", wall: "minecraft:smooth_sandstone_slab", deck: "minecraft:jungle_slab", post: "minecraft:jungle_log",
    accent: "minecraft:jungle_fence", light: "minecraft:lantern",
  },
  savanna: {
    name: "Savanna village dock", ...W("acacia"),
    found: "minecraft:cobblestone", path: "minecraft:grass_path", roof: "minecraft:acacia_stairs", roofSlab: "minecraft:acacia_slab", roofFull: "minecraft:acacia_planks",
    window: "minecraft:glass_pane", lamp: "minecraft:torch", flower: "minecraft:flower_pot", extra: "minecraft:orange_terracotta",
    wall: "minecraft:acacia_slab", deck: "minecraft:acacia_slab", post: "minecraft:acacia_log", accent: "minecraft:acacia_fence", light: "minecraft:lantern",
  },
  taiga: {
    name: "Taiga village dock", ...W("spruce"),
    found: "minecraft:mossy_cobblestone", path: "minecraft:grass_path", roof: "minecraft:spruce_stairs", roofSlab: "minecraft:spruce_slab", roofFull: "minecraft:spruce_planks",
    window: "minecraft:glass_pane", lamp: "minecraft:lantern", flower: "minecraft:flower_pot", extra: "minecraft:hay_block",
    wall: "minecraft:spruce_slab", deck: "minecraft:cobblestone_slab", post: "minecraft:spruce_log", accent: "minecraft:spruce_fence", light: "minecraft:lantern",
  },
  snowy: {
    name: "Snowy village dock", ...W("spruce"),
    found: "minecraft:stone_bricks", path: "minecraft:packed_ice", roof: "minecraft:spruce_stairs", roofSlab: "minecraft:spruce_slab", roofFull: "minecraft:snow",
    window: "minecraft:glass_pane", lamp: "minecraft:lantern", flower: null, extra: "minecraft:snow",
    wall: "minecraft:spruce_slab", deck: "minecraft:stone_brick_slab", post: "minecraft:stripped_spruce_log", accent: "minecraft:spruce_fence", light: "minecraft:lantern",
  },
  jungle: {
    name: "Jungle village dock", ...W("jungle"),
    found: "minecraft:mossy_cobblestone", path: "minecraft:grass_path", roof: "minecraft:jungle_stairs", roofSlab: "minecraft:jungle_slab", roofFull: "minecraft:jungle_planks",
    window: "minecraft:glass_pane", lamp: "minecraft:lantern", flower: "minecraft:flower_pot", extra: "minecraft:moss_block",
    wall: "minecraft:jungle_slab", deck: "minecraft:bamboo_slab", post: "minecraft:jungle_log", accent: "minecraft:bamboo_fence", light: "minecraft:lantern",
  },
  swamp: {
    name: "Swamp village dock", ...W("mangrove"),
    found: "minecraft:mud_bricks", path: "minecraft:packed_mud", roof: "minecraft:mangrove_stairs", roofSlab: "minecraft:mangrove_slab", roofFull: "minecraft:mangrove_planks",
    window: "minecraft:glass_pane", lamp: "minecraft:lantern", flower: "minecraft:flower_pot", extra: "minecraft:mud_bricks",
    wall: "minecraft:mangrove_slab", deck: "minecraft:mud_brick_slab", post: "minecraft:mangrove_log", accent: "minecraft:mangrove_fence", light: "minecraft:lantern",
  },
  cherry: {
    name: "Cherry grove dock", ...W("cherry"),
    found: "minecraft:stone_bricks", path: "minecraft:grass_path", roof: "minecraft:cherry_stairs", roofSlab: "minecraft:cherry_slab", roofFull: "minecraft:cherry_planks",
    window: "minecraft:glass_pane", lamp: "minecraft:lantern", flower: "minecraft:flower_pot", extra: "minecraft:pink_wool",
    wall: "minecraft:cherry_slab", deck: "minecraft:stone_brick_slab", post: "minecraft:cherry_log", accent: "minecraft:cherry_fence", light: "minecraft:lantern",
  },
};

/** The village a biome builds (biome ids are checked by keyword, first match wins). */
const BY_BIOME = [                    // (most specific first: a mangrove_swamp isn't a snowy "grove")
  ["desert", ["desert", "badlands", "eroded"]],
  ["savanna", ["savanna"]],
  ["swamp", ["swamp", "mangrove"]],
  ["cherry", ["cherry"]],
  ["jungle", ["jungle", "bamboo"]],
  ["snowy", ["snowy", "frozen", "ice", "grove", "jagged"]],
  ["taiga", ["taiga", "old_growth"]],
];
export function villageFor(biomeId = "") {
  const s = String(biomeId).toLowerCase();
  for (const [key, words] of BY_BIOME) if (words.some((w) => s.includes(w))) return key;
  return "plains";
}
