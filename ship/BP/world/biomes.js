// inherency: data (a vision table: every number in it is a choice, stated where it is)
// Pure data and its one rule. Vanilla's biomes, as the climate places them, and what each gives a
// people: the only place resources enter the world. Every id is vanilla's (the vanilla lens checks
// them all against lab/bedrock_*.json); nothing here is invented.
//
// A biome:  when(c)   the climate it takes (c: { T deg C, M 0..1, h blocks, coast bool, ice bool })
//           wood      logs that grow there        stone  what the ground breaks into
//           crops     what can be farmed           herd   animals that can be kept
//           wild      what can be gathered         sea    what its shore waters give (sea biomes)
//           yield     food a chunk gives a year, by kind (vision: relative, 1 = a temperate field)
// Order matters: the first whose `when` holds wins.
import { FIB, FIBS, PHI } from "../core/golden.js";

// The bands (after Whittaker's: heat by wetness, height and the shore over them), the first that holds winning:
export const BANDS = Object.freeze({
  T: [-8, 0, 9, 18, 24],                       // vision: the heat's edges, degrees C (polar, subpolar, boreal, temperate, warm, tropical)
  M: [0.2, 0.4, 0.6, 0.8],                     // vision: the wet's edges (arid, dry, moderate, wet, very wet)
  H: [FIB[9], FIB[10]],                        // derived: the hills' and the peaks' heights (55 and 89 blocks)
});
const B = BANDS;
export const LAND_BIOMES = [
  { id: "frozen_peaks", when: (c) => c.T < B.T[1] && c.h > B.H[1], wood: [], stone: ["minecraft:packed_ice", "minecraft:stone"], crops: [], herd: ["minecraft:goat"], wild: ["minecraft:snowball"], yield: { crop: 0, herd: 0.05 } },
  { id: "snowy_slopes", when: (c) => c.T < B.T[1] && c.h > B.H[0], wood: ["minecraft:spruce_log"], stone: ["minecraft:stone", "minecraft:snow"], crops: [], herd: ["minecraft:goat"], wild: ["minecraft:sweet_berries"], yield: { crop: 0, herd: 0.15 } },
  { id: "ice_plains", when: (c) => c.T < B.T[0], wood: [], stone: ["minecraft:packed_ice", "minecraft:snow"], crops: [], herd: [], wild: ["minecraft:snowball"], yield: { crop: 0, herd: 0 } },
  { id: "snowy_taiga", when: (c) => c.T < B.T[1] && c.M >= (B.M[0] + B.M[1]) / 2, wood: ["minecraft:spruce_log"], stone: ["minecraft:stone", "minecraft:cobblestone", "minecraft:gravel"], crops: ["minecraft:potato"], herd: ["minecraft:sheep", "minecraft:rabbit"], wild: ["minecraft:sweet_berries"], yield: { crop: 0.2, herd: 0.4 } },
  { id: "snowy_plains", when: (c) => c.T < B.T[1], wood: ["minecraft:spruce_log"], stone: ["minecraft:stone", "minecraft:snow"], crops: [], herd: ["minecraft:rabbit"], wild: ["minecraft:sweet_berries"], yield: { crop: 0.05, herd: 0.2 } },
  { id: "jagged_peaks", when: (c) => c.T < B.T[3] && c.h > B.H[1], wood: [], stone: ["minecraft:stone", "minecraft:calcite", "minecraft:emerald_ore"], crops: [], herd: ["minecraft:goat"], wild: [], yield: { crop: 0, herd: 0.1 } },
  { id: "windswept_hills", when: (c) => c.T < B.T[3] && c.h > B.H[0], wood: ["minecraft:spruce_log", "minecraft:oak_log"], stone: ["minecraft:stone", "minecraft:andesite", "minecraft:emerald_ore"], crops: [], herd: ["minecraft:sheep", "minecraft:llama"], wild: [], yield: { crop: 0.1, herd: 0.6 } },
  { id: "taiga", when: (c) => c.T < B.T[2] && c.M >= B.M[1], wood: ["minecraft:spruce_log"], stone: ["minecraft:stone", "minecraft:cobblestone", "minecraft:mossy_cobblestone"], crops: ["minecraft:potato", "minecraft:beetroot"], herd: ["minecraft:sheep", "minecraft:pig"], wild: ["minecraft:sweet_berries", "minecraft:fern"], yield: { crop: 0.4, herd: 0.6 } },
  { id: "cold_steppe", when: (c) => c.T < B.T[2], wood: ["minecraft:spruce_log"], stone: ["minecraft:stone", "minecraft:gravel"], crops: ["minecraft:potato"], herd: ["minecraft:sheep", "minecraft:goat"], wild: ["minecraft:sweet_berries"], yield: { crop: 0.2, herd: 0.6 } },
  { id: "mangrove_swamp", when: (c) => c.T > B.T[4] && c.M >= B.M[2] && c.coast && c.h < FIB[4], wood: ["minecraft:mangrove_log"], stone: ["minecraft:mud", "minecraft:clay"], crops: ["minecraft:sugar_cane"], herd: ["minecraft:frog"], wild: ["minecraft:mangrove_propagule"], yield: { crop: 0.3, herd: 0.05 } },
  { id: "swamp", when: (c) => c.M >= B.M[3] && c.h < FIB[5], wood: ["minecraft:oak_log"], stone: ["minecraft:clay", "minecraft:mud"], crops: ["minecraft:sugar_cane", "minecraft:wheat"], herd: ["minecraft:pig"], wild: ["minecraft:blue_orchid", "minecraft:waterlily"], yield: { crop: 0.5, herd: 0.3 } },
  { id: "badlands", when: (c) => c.T > B.T[3] && c.M < B.M[0] && c.h > FIB[7], wood: [], stone: ["minecraft:red_sandstone", "minecraft:orange_terracotta", "minecraft:gold_ore"], crops: [], herd: [], wild: ["minecraft:cactus"], yield: { crop: 0, herd: 0.05 } },
  { id: "desert", when: (c) => c.T > B.T[3] && c.M < B.M[0], wood: [], stone: ["minecraft:sandstone", "minecraft:sand"], crops: [], herd: ["minecraft:camel"], wild: ["minecraft:cactus", "minecraft:deadbush"], yield: { crop: 0.05, herd: 0.15 } },
  { id: "bamboo_jungle", when: (c) => c.T > B.T[4] && c.M >= (B.M[2] + B.M[3]) / 2, wood: ["minecraft:jungle_log", "minecraft:bamboo"], stone: ["minecraft:stone", "minecraft:clay"], crops: ["minecraft:melon_slice", "minecraft:cocoa_beans"], herd: ["minecraft:chicken"], wild: ["minecraft:bamboo"], yield: { crop: 0.8, herd: 0.2 } },
  { id: "jungle", when: (c) => c.T > B.T[4] && c.M >= (B.M[1] + B.M[2]) / 2, wood: ["minecraft:jungle_log"], stone: ["minecraft:stone"], crops: ["minecraft:melon_slice", "minecraft:cocoa_beans", "minecraft:sugar_cane"], herd: ["minecraft:chicken"], wild: ["minecraft:vine"], yield: { crop: 0.9, herd: 0.2 } },
  { id: "sparse_jungle", when: (c) => c.T > B.T[4] && c.M >= B.M[1], wood: ["minecraft:jungle_log", "minecraft:oak_log"], stone: ["minecraft:stone", "minecraft:clay"], crops: ["minecraft:melon_slice", "minecraft:sugar_cane"], herd: ["minecraft:chicken", "minecraft:pig"], wild: ["minecraft:vine"], yield: { crop: 0.8, herd: 0.4 } },
  { id: "savanna_plateau", when: (c) => c.T > B.T[3] && c.M < B.M[1] && c.h > FIB[6], wood: ["minecraft:acacia_log"], stone: ["minecraft:stone", "minecraft:red_sandstone"], crops: ["minecraft:wheat"], herd: ["minecraft:horse", "minecraft:llama"], wild: ["minecraft:short_grass"], yield: { crop: 0.3, herd: 0.8 } },
  { id: "savanna", when: (c) => c.T > B.T[3] && c.M < B.M[1], wood: ["minecraft:acacia_log"], stone: ["minecraft:stone", "minecraft:sandstone"], crops: ["minecraft:wheat"], herd: ["minecraft:cow", "minecraft:horse"], wild: ["minecraft:short_grass"], yield: { crop: 0.5, herd: 0.9 } },
  { id: "dark_forest", when: (c) => c.T < B.T[3] && c.M >= B.M[3], wood: ["minecraft:dark_oak_log", "minecraft:oak_log"], stone: ["minecraft:stone", "minecraft:cobblestone"], crops: ["minecraft:potato"], herd: ["minecraft:pig"], wild: ["minecraft:red_mushroom", "minecraft:brown_mushroom"], yield: { crop: 0.4, herd: 0.4 } },
  { id: "cherry_grove", when: (c) => c.T < B.T[3] && c.M >= B.M[2] && c.h > FIB[5], wood: ["minecraft:cherry_log"], stone: ["minecraft:stone", "minecraft:clay"], crops: ["minecraft:wheat", "minecraft:carrot"], herd: ["minecraft:pig", "minecraft:sheep"], wild: ["minecraft:pink_petals"], yield: { crop: 0.8, herd: 0.5 } },
  { id: "meadow", when: (c) => c.T < B.T[3] && c.M >= B.M[1] && c.M < B.M[2] && c.h > FIB[6], wood: ["minecraft:oak_log", "minecraft:birch_log"], stone: ["minecraft:stone", "minecraft:calcite"], crops: ["minecraft:wheat"], herd: ["minecraft:sheep", "minecraft:cow"], wild: ["minecraft:cornflower", "minecraft:allium", "minecraft:dandelion"], yield: { crop: 0.7, herd: 1 } },
  { id: "birch_forest", when: (c) => c.T < (B.T[2] + B.T[3]) / 2 && c.M >= B.M[1], wood: ["minecraft:birch_log"], stone: ["minecraft:stone", "minecraft:gravel"], crops: ["minecraft:wheat", "minecraft:beetroot"], herd: ["minecraft:sheep", "minecraft:cow"], wild: ["minecraft:lily_of_the_valley"], yield: { crop: 0.7, herd: 0.7 } },
  { id: "forest", when: (c) => c.M >= B.M[1], wood: ["minecraft:oak_log", "minecraft:birch_log"], stone: ["minecraft:stone", "minecraft:cobblestone", "minecraft:clay"], crops: ["minecraft:wheat", "minecraft:carrot", "minecraft:pumpkin"], herd: ["minecraft:cow", "minecraft:pig", "minecraft:sheep"], wild: ["minecraft:apple"], yield: { crop: 0.9, herd: 0.8 } },
  { id: "dry_shrubland", when: (c) => c.M < B.M[0], wood: ["minecraft:oak_log"], stone: ["minecraft:stone", "minecraft:sandstone"], crops: ["minecraft:wheat"], herd: ["minecraft:goat", "minecraft:sheep"], wild: ["minecraft:deadbush"], yield: { crop: 0.2, herd: 0.4 } },
  { id: "plains", when: () => true, wood: ["minecraft:oak_log"], stone: ["minecraft:stone", "minecraft:gravel", "minecraft:clay"], crops: ["minecraft:wheat", "minecraft:carrot", "minecraft:potato"], herd: ["minecraft:cow", "minecraft:sheep", "minecraft:horse", "minecraft:chicken"], wild: ["minecraft:poppy", "minecraft:dandelion"], yield: { crop: 1, herd: 1 } },
];
// The extremes: each biome's far tail, the 1/13 of its land that scores highest on what makes it itself (each driver
// measured in its band's widths past the band's middle), with a slow field 2,584 blocks across so they come in patches.
// cut: the score past which a column is extreme, measured over the parent's land (tools/lab.mjs extremes) to 1/13.
// giant: trees grow by (1 + phi e), in vanilla's two-by-two form past e = 1/phi; spires: a spire of the block to that height.
const CUTS = { giant_jungle: 1.584, mega_taiga: 0.251, old_growth_birch: 0.857, flower_forest: 2.036, sunflower_plains: 0.43, windswept_savanna: 0.196, eroded_badlands: 0.787, ice_spikes: -0.309, stony_peaks: 2.846, deep_dark_forest: 0.5 };   // derived: measured over each parent's land so 1/13 of it is extreme (60,000 columns; the deep dark forest's parent too rare to measure, set by eye)
export const EXTREMES = [
  { id: "giant_jungle", parent: "jungle", drive: (c) => (c.T - B.T[4]) / (B.T[4] - B.T[3]) + (c.M - B.M[2]) / (B.M[1] - B.M[0]) - c.h / FIB[9], giant: FIB[8] },
  { id: "mega_taiga", parent: "taiga", drive: (c) => (c.M - B.M[2]) / (B.M[1] - B.M[0]) - (c.T - B.T[1]) / (B.T[2] - B.T[1]), giant: FIB[8] },
  { id: "old_growth_birch", parent: "birch_forest", drive: (c) => (c.M - B.M[2]) / (B.M[1] - B.M[0]), giant: FIB[7] },
  { id: "flower_forest", parent: "forest", drive: (c) => (c.M - B.M[2]) / (B.M[1] - B.M[0]) + (c.T - B.T[2]) / (B.T[3] - B.T[2]), flowers: 1 / FIB[3] },
  { id: "sunflower_plains", parent: "plains", drive: (c) => (c.T - B.T[2]) / (B.T[3] - B.T[2]) - (c.M - B.M[0]) / (B.M[1] - B.M[0]) - c.h / FIB[9], sunflowers: 1 / FIB[5] },
  { id: "windswept_savanna", parent: "savanna", drive: (c) => c.h / FIB[8] - (c.M - B.M[0]) / (B.M[1] - B.M[0]) },
  { id: "eroded_badlands", parent: "badlands", drive: (c) => c.h / FIB[8] - c.M / (B.M[1] - B.M[0]), spires: { id: "minecraft:orange_terracotta", tall: FIB[8], rate: 1 / FIB[8] } },
  { id: "ice_spikes", parent: "ice_plains", drive: (c) => -(c.T - B.T[0]) / (B.T[1] - B.T[0]) - c.M / (B.M[1] - B.M[0]), spires: { id: "minecraft:packed_ice", tall: FIB[9], rate: 1 / FIB[10] } },
  { id: "stony_peaks", parent: "jagged_peaks", drive: (c) => (c.T - B.T[1]) / (B.T[2] - B.T[1]) + c.h / FIB[10] },
  { id: "deep_dark_forest", parent: "dark_forest", drive: (c) => (c.M - B.M[3]) / (B.M[1] - B.M[0]), giant: FIB[7] },
].map((e) => ({ ...e, cut: CUTS[e.id] }));
export const EXTREME_FIELD = FIBS[17];   // vision: the extremes' patches, about 2,584 blocks across
export const BEACH = { id: "beach", wood: [], stone: ["minecraft:sand", "minecraft:sandstone"], crops: ["minecraft:sugar_cane"], herd: ["minecraft:turtle"], wild: ["minecraft:turtle_egg"], yield: { crop: 0.1, herd: 0.05 } };
export const SEA_BIOMES = [
  { id: "frozen_ocean", when: (c) => c.T < -4, sea: ["minecraft:salmon", "minecraft:ice", "minecraft:packed_ice"], fish: 0.4, mobs: ["minecraft:polar_bear"] },
  { id: "cold_ocean", when: (c) => c.T < 8, sea: ["minecraft:salmon", "minecraft:cod", "minecraft:kelp"], fish: 1.2, mobs: ["minecraft:squid"] },
  { id: "ocean", when: (c) => c.T < 18, sea: ["minecraft:cod", "minecraft:kelp", "minecraft:seagrass"], fish: 1, mobs: ["minecraft:dolphin", "minecraft:squid"] },
  { id: "lukewarm_ocean", when: (c) => c.T < 24, sea: ["minecraft:cod", "minecraft:tropical_fish", "minecraft:seagrass"], fish: 0.8, mobs: ["minecraft:dolphin"] },
  { id: "warm_ocean", when: () => true, sea: ["minecraft:tropical_fish", "minecraft:pufferfish", "minecraft:sea_pickle", "minecraft:brain_coral_block"], fish: 0.6, mobs: ["minecraft:turtle"] },
];
/** Ores. above: how high an island's rock must rise for its people to have the ore (the sim's, world/peoples.js).
 *  The ground's: target, the ore blocks a chunk of its best rock averages; lo, peak, hi, its depth window (a tent,
 *  vanilla's way of spreading ores by height); vein, its blocks a vein (Fibonacci numbers, down with its rarity);
 *  rich, how much of it each province holds against its best (1); pipes: only in the diamond pipes; high: only where
 *  the ground stands over 55 blocks. Scarce on purpose: about 95 a chunk in all, so mining is a search and trade
 *  matters; a player's start is carried by their homeport's lode. */
export const ORES = [
  { id: "minecraft:coal_ore", above: 4, target: 34, lo: 0, peak: 34, hi: 89, vein: 13, rich: { wetland: 1, temperate: 1, cold: 1 / PHI, default: 1 / PHI ** 2 } },
  { id: "minecraft:copper_ore", above: 8, target: 21, lo: -13, peak: 21, hi: 55, vein: 8, rich: { volcanic: 1, default: 1 / PHI } },
  { id: "minecraft:iron_ore", above: 15, target: 21, lo: -55, peak: 8, hi: 55, vein: 8, rich: { temperate: 1, cold: 1, default: 1 / PHI } },
  { id: "minecraft:redstone_ore", above: 45, target: 8, lo: -58, peak: -34, hi: -13, vein: 5, rich: { default: 1 } },
  { id: "minecraft:gold_ore", above: 45, target: 5, lo: -55, peak: -13, hi: 21, vein: 5, rich: { volcanic: 1, badlands: 1, default: 1 / PHI ** 2 } },
  { id: "minecraft:lapis_ore", above: 30, target: 3, lo: -55, peak: -13, hi: 34, vein: 3, rich: { limestone: 1, default: 1 / PHI ** 3 } },
  { id: "minecraft:diamond_ore", above: 80, target: 2, lo: -58, peak: -34, hi: -5, vein: 3, pipes: true, rich: { default: 1 } },
  { id: "minecraft:emerald_ore", above: 90, target: 1, lo: -13, peak: 34, hi: 89, vein: 1, high: 55, rich: { default: 1 } },
];
/** What a chunk's climate makes of it. */
export const landBiome = (c) => (c.coast && c.h <= 2 && !c.ice ? BEACH : LAND_BIOMES.find((b) => b.when(c)));
export const seaBiome = (c) => SEA_BIOMES.find((b) => b.when(c));
