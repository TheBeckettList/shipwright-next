// Pure. Biomes, from the base fields (fields.js) and the ground (terrain.js): heat (with height)
// and moisture (with rain shadow) pick a land biome, the way a Whittaker diagram does; heat and
// depth pick a sea biome. Each biome lists what grows and lives there, in vanilla blocks and mobs,
// and the vanilla biome it stands in for. The woods each biome grows decide which peoples can
// build their boats there (peoples.js), so cultures follow the land.
//
// family: the broad climate (polar .. wet) older code and tables still key on.
import { rand, hash, fbm } from "./noise.js";

const W = (kind, w = 1) => [kind, w];

export const BIOMES = {
  // ---------------------------------------------------------------- land
  ice_sheet: { land: true, name: "Ice sheet", vanilla: "minecraft:ice_spikes", family: "polar", top: "minecraft:snow", sub: "minecraft:packed_ice", trees: [], density: 0,
    plants: [], animals: ["minecraft:polar_bear"], hostile: ["minecraft:stray"], snow: true },
  tundra: { land: true, name: "Tundra", vanilla: "minecraft:snowy_plains", family: "polar", top: "minecraft:snow", sub: "minecraft:dirt", trees: [W("spruce")], density: 0.004,
    plants: [], animals: ["minecraft:rabbit", "minecraft:polar_bear", "minecraft:fox"], hostile: ["minecraft:stray", "minecraft:zombie"], snow: true },
  snowy_taiga: { land: true, name: "Snowy taiga", vanilla: "minecraft:snowy_taiga", family: "boreal", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("spruce", 4), W("birch")], density: 0.05,
    plants: [["minecraft:sweet_berry_bush", 0.01]], animals: ["minecraft:wolf", "minecraft:rabbit", "minecraft:fox"], hostile: ["minecraft:stray", "minecraft:zombie", "minecraft:creeper"], snow: true },
  taiga: { land: true, name: "Taiga", vanilla: "minecraft:taiga", family: "boreal", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("spruce", 3), W("birch", 2)], density: 0.05,
    plants: [["minecraft:sweet_berry_bush", 0.02], ["minecraft:fern", 0.05], ["minecraft:short_grass", 0.12], ["minecraft:pumpkin", 0.002]], animals: ["minecraft:wolf", "minecraft:sheep", "minecraft:fox", "minecraft:rabbit"] },
  old_growth: { land: true, name: "Old-growth rainforest", vanilla: "minecraft:old_growth_spruce_taiga", family: "boreal", top: "minecraft:podzol", sub: "minecraft:dirt", trees: [W("spruce", 3), W("oak")], density: 0.07,
    plants: [["minecraft:fern", 0.08], ["minecraft:brown_mushroom", 0.01], ["minecraft:sweet_berry_bush", 0.01]], animals: ["minecraft:wolf", "minecraft:sheep", "minecraft:pig"] },
  steppe: { land: true, name: "Cold steppe", vanilla: "minecraft:windswept_hills", family: "boreal", top: "minecraft:grass_block", sub: "minecraft:coarse_dirt", trees: [W("spruce")], density: 0.004,
    plants: [["minecraft:short_grass", 0.25]], animals: ["minecraft:sheep", "minecraft:goat", "minecraft:horse"] },
  forest: { land: true, name: "Forest", vanilla: "minecraft:forest", family: "temperate", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("oak", 3), W("birch"), W("cherry")], density: 0.05,
    plants: [["minecraft:short_grass", 0.2], ["minecraft:poppy", 0.01], ["minecraft:dandelion", 0.01], ["minecraft:bee_nest", 0.0006]], animals: ["minecraft:sheep", "minecraft:cow", "minecraft:pig", "minecraft:chicken", "minecraft:wolf"] },
  birch_forest: { land: true, name: "Birch woods", vanilla: "minecraft:birch_forest", family: "temperate", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("birch")], density: 0.05,
    plants: [["minecraft:short_grass", 0.2], ["minecraft:poppy", 0.015]], animals: ["minecraft:sheep", "minecraft:cow", "minecraft:rabbit"] },
  rainforest: { land: true, name: "Temperate rainforest", vanilla: "minecraft:dark_forest", family: "temperate", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("dark_oak", 2), W("oak"), W("spruce")], density: 0.08,
    plants: [["minecraft:fern", 0.08], ["minecraft:red_mushroom", 0.01], ["minecraft:brown_mushroom", 0.01]], animals: ["minecraft:pig", "minecraft:sheep"], hostile: ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider", "minecraft:creeper", "minecraft:enderman"] },
  plains: { land: true, name: "Meadows", vanilla: "minecraft:plains", family: "temperate", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("oak")], density: 0.006,
    plants: [["minecraft:short_grass", 0.35], ["minecraft:dandelion", 0.03], ["minecraft:poppy", 0.02], ["minecraft:pumpkin", 0.001], ["minecraft:bee_nest", 0.0004]], animals: ["minecraft:cow", "minecraft:sheep", "minecraft:pig", "minecraft:chicken", "minecraft:horse"] },
  cherry_grove: { land: true, name: "Blossom hills", vanilla: "minecraft:cherry_grove", family: "temperate", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("cherry", 3), W("birch")], density: 0.04,
    plants: [["minecraft:short_grass", 0.2], ["minecraft:pink_petals", 0.05], ["minecraft:bee_nest", 0.0008]], animals: ["minecraft:sheep", "minecraft:pig", "minecraft:rabbit"] },
  scrubland: { land: true, name: "Scrubland", vanilla: "minecraft:savanna_plateau", family: "dry", top: "minecraft:coarse_dirt", sub: "minecraft:dirt", trees: [W("oak"), W("acacia")], density: 0.008,
    plants: [["minecraft:short_grass", 0.15], ["minecraft:deadbush", 0.01]], animals: ["minecraft:goat", "minecraft:sheep", "minecraft:rabbit"] },
  desert: { land: true, name: "Desert", vanilla: "minecraft:desert", family: "arid", top: "minecraft:sand", sub: "minecraft:sandstone", trees: [], density: 0,
    plants: [["minecraft:cactus", 0.006], ["minecraft:deadbush", 0.01]], animals: ["minecraft:rabbit", "minecraft:camel"], hostile: ["minecraft:husk", "minecraft:skeleton", "minecraft:spider", "minecraft:creeper", "minecraft:enderman"] },
  badlands: { land: true, name: "Red badlands", vanilla: "minecraft:badlands", family: "arid", top: "minecraft:red_sand", sub: "minecraft:orange_terracotta", trees: [], density: 0,
    plants: [["minecraft:cactus", 0.003], ["minecraft:deadbush", 0.012]], animals: ["minecraft:rabbit"] },
  savanna: { land: true, name: "Savanna", vanilla: "minecraft:savanna", family: "savanna", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("acacia")], density: 0.012,
    plants: [["minecraft:short_grass", 0.4]], animals: ["minecraft:cow", "minecraft:sheep", "minecraft:horse", "minecraft:donkey"] },
  bamboo_forest: { land: true, name: "Bamboo forest", vanilla: "minecraft:bamboo_jungle", family: "savanna", top: "minecraft:podzol", sub: "minecraft:dirt", trees: [W("bamboo", 4), W("jungle")], density: 0.06,
    plants: [["minecraft:fern", 0.05]], animals: ["minecraft:panda", "minecraft:parrot", "minecraft:chicken"] },
  dry_forest: { land: true, name: "Dry tropical forest", vanilla: "minecraft:sparse_jungle", family: "tropical", top: "minecraft:grass_block", sub: "minecraft:coarse_dirt", trees: [W("acacia", 2), W("dark_oak")], density: 0.03,
    plants: [["minecraft:short_grass", 0.25]], animals: ["minecraft:chicken", "minecraft:pig", "minecraft:ocelot"] },
  lowland_forest: { land: true, name: "Lowland forest", vanilla: "minecraft:jungle", family: "tropical", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("dark_oak", 2), W("jungle", 2), W("bamboo")], density: 0.07,
    plants: [["minecraft:fern", 0.06], ["minecraft:melon_block", 0.002]], animals: ["minecraft:parrot", "minecraft:chicken", "minecraft:ocelot"] },
  jungle: { land: true, name: "Rainforest", vanilla: "minecraft:jungle", family: "tropical", top: "minecraft:grass_block", sub: "minecraft:dirt", trees: [W("jungle", 4), W("palm"), W("bamboo", 2)], density: 0.08,
    plants: [["minecraft:fern", 0.06], ["minecraft:melon_block", 0.004]], animals: ["minecraft:parrot", "minecraft:ocelot", "minecraft:chicken", "minecraft:panda"] },
  palm_isle: { land: true, name: "Palm isle", vanilla: "minecraft:jungle", family: "tropical", top: "minecraft:grass_block", sub: "minecraft:sand", trees: [W("palm", 3), W("jungle")], density: 0.03,
    plants: [["minecraft:short_grass", 0.2]], animals: ["minecraft:chicken", "minecraft:parrot", "minecraft:turtle"] },
  mangrove: { land: true, name: "Mangrove coast", vanilla: "minecraft:mangrove_swamp", family: "wet", top: "minecraft:mud", sub: "minecraft:mud", trees: [W("mangrove")], density: 0.07,
    plants: [], animals: ["minecraft:frog"], hostile: ["minecraft:slime", "minecraft:drowned", "minecraft:bogged", "minecraft:zombie"] },
  salt_marsh: { land: true, name: "Salt marsh", vanilla: "minecraft:swamp", family: "wet", top: "minecraft:grass_block", sub: "minecraft:clay", trees: [W("oak"), W("mangrove", 2)], density: 0.012,
    plants: [["minecraft:reeds", 0.04], ["minecraft:blue_orchid", 0.01]], animals: ["minecraft:frog", "minecraft:chicken"], hostile: ["minecraft:slime", "minecraft:witch", "minecraft:zombie", "minecraft:skeleton"] },
  beach: { land: true, name: "Beach", vanilla: "minecraft:beach", family: "temperate", top: "minecraft:sand", sub: "minecraft:sand", trees: [], density: 0,
    plants: [["minecraft:reeds", 0.03]], animals: ["minecraft:turtle"] },
  stony_shore: { land: true, name: "Stony shore", vanilla: "minecraft:stony_shore", family: "boreal", top: "minecraft:gravel", sub: "minecraft:stone", trees: [], density: 0, plants: [], animals: [] },
  snowy_beach: { land: true, name: "Snowy shore", vanilla: "minecraft:snowy_beach", family: "polar", top: "minecraft:gravel", sub: "minecraft:gravel", trees: [], density: 0, plants: [], animals: [], snow: true },
  highlands: { land: true, name: "Highlands", vanilla: "minecraft:windswept_hills", family: "boreal", top: "minecraft:stone", sub: "minecraft:stone", trees: [W("spruce")], density: 0.006,
    plants: [], animals: ["minecraft:goat", "minecraft:llama"], emerald: true },
  peaks: { land: true, name: "Snowy peaks", vanilla: "minecraft:snowy_slopes", family: "polar", top: "minecraft:snow", sub: "minecraft:stone", trees: [], density: 0,
    plants: [], animals: ["minecraft:goat"], snow: true, emerald: true },
  volcanic: { land: true, name: "Volcanic isle", vanilla: "minecraft:stony_peaks", family: "arid", top: "minecraft:basalt", sub: "minecraft:blackstone", trees: [], density: 0,
    plants: [], animals: [], hostile: ["minecraft:magma_cube", "minecraft:skeleton", "minecraft:creeper"] },
  mushroom_isle: { land: true, name: "Mushroom isle", vanilla: "minecraft:mushroom_fields", family: "temperate", top: "minecraft:mycelium", sub: "minecraft:dirt", trees: [W("huge_mushroom")], density: 0.012,
    plants: [["minecraft:red_mushroom", 0.03], ["minecraft:brown_mushroom", 0.03]], animals: ["minecraft:mooshroom"], hostile: [] },

  // ---------------------------------------------------------------- sea
  deep_ocean: { land: false, name: "Deep ocean", vanilla: "minecraft:deep_ocean", family: "temperate", bed: "minecraft:gravel", life: ["minecraft:squid", "minecraft:cod", "minecraft:dolphin"] },
  open_sea: { land: false, name: "Open sea", vanilla: "minecraft:ocean", family: "temperate", bed: "minecraft:sand", life: ["minecraft:cod", "minecraft:squid", "minecraft:salmon"] },
  frozen_sea: { land: false, name: "Frozen sea", vanilla: "minecraft:frozen_ocean", family: "polar", bed: "minecraft:gravel", life: ["minecraft:salmon", "minecraft:cod"] },
  pack_ice: { land: false, name: "Pack ice", vanilla: "minecraft:frozen_ocean", family: "polar", bed: "minecraft:gravel", life: ["minecraft:salmon"], ice: true },
  kelp_forest: { land: false, name: "Kelp forest", vanilla: "minecraft:cold_ocean", family: "boreal", bed: "minecraft:gravel", life: ["minecraft:cod", "minecraft:salmon", "minecraft:squid"], kelp: 0.18 },
  seagrass: { land: false, name: "Seagrass meadow", vanilla: "minecraft:lukewarm_ocean", family: "savanna", bed: "minecraft:sand", life: ["minecraft:cod", "minecraft:turtle", "minecraft:tropical_fish"], grass: 0.3 },
  coral_reef: { land: false, name: "Coral reef", vanilla: "minecraft:warm_ocean", family: "tropical", bed: "minecraft:sand", life: ["minecraft:tropical_fish", "minecraft:pufferfish", "minecraft:dolphin", "minecraft:turtle"], coral: 0.22 },
  lagoon: { land: false, name: "Lagoon", vanilla: "minecraft:warm_ocean", family: "tropical", bed: "minecraft:sand", life: ["minecraft:tropical_fish", "minecraft:turtle"], grass: 0.2 },
};

const NIGHT = ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider", "minecraft:creeper", "minecraft:enderman"];
/** What comes out at night on a biome's ground (its own list, else the usual five). */
export const hostilesOf = (key) => BIOMES[key].hostile ?? NIGHT;

/** The wood each tradition builds with, and the land biomes that grow it. */
export const TRADITION_WOOD = { norse: "spruce", european: "oak", birchbark: "birch", pacific: "jungle", indian_ocean: "acacia", east_asian: "bamboo", japanese: "cherry", dugout: "dark_oak", shallow: "mangrove", arctic: "bone" };
/**
 * How strongly each people is drawn to land that grows its wood: a people whose wood is rare holds
 * to it hard (a mangrove coast is a shallow-water people's whole world), one whose wood is
 * everywhere shares it. Tuned by the balance lab so every people has a place (VISION.cultureShare).
 */
export const AFFINITY = { norse: 0.6, european: 0.9, birchbark: 1, pacific: 1.5, indian_ocean: 0.9, east_asian: 1.8, japanese: 2.4, dugout: 2.1, shallow: 3, arctic: 0.45 };
export function woodsOf(key) {
  const b = BIOMES[key];
  if (!b?.land) return [];
  const w = (b.trees ?? []).map(([k]) => (k === "palm" ? "jungle" : k)).filter((k) => k !== "huge_mushroom");
  if (b.family === "polar") w.push("bone");               // the far north builds of bone and hide
  return w;
}

/** The land biome at a place, from heat (h), moisture (m), height above the sea and the shore. */
export function landBiome(h, m, above, coast, special = null, patch = 0.5) {
  if (special === "volcano") return "volcanic";
  if (special === "mushroom") return "mushroom_isle";
  if (above >= 30 && h < 0.42) return "peaks";
  if (above >= 22) return "highlands";
  if (coast) {
    if (h < 0.18) return "snowy_beach";
    if (h > 0.72 && m > 0.52) return "mangrove";
    if (h >= 0.32 && h <= 0.7 && m > 0.7) return "salt_marsh";
    if (h < 0.34) return "stony_shore";
    return "beach";
  }
  if (h < 0.1) return "ice_sheet";
  if (h < 0.2) return "tundra";
  if (h < 0.3) return m > 0.42 ? "snowy_taiga" : "tundra";
  if (h < 0.42) return m > 0.7 ? "old_growth" : m > 0.4 ? "taiga" : "steppe";
  if (h < 0.62) {
    if (m > 0.72) return "rainforest";
    if (m > 0.62) return "forest";
    if (m > 0.5) return patch > 0.52 || above >= 12 ? "cherry_grove" : "birch_forest";
    if (m > 0.32) return "plains";
    return m > 0.24 || above >= 8 ? "scrubland" : "steppe";
  }
  if (h < 0.78) {
    if (m < 0.22) return above >= 8 ? "badlands" : "desert";
    if (m < 0.42) return "savanna";
    if (m < 0.56) return "dry_forest";
    return "bamboo_forest";
  }
  if (m < 0.24) return "desert";
  if (m < 0.42) return "dry_forest";
  if (m < 0.54) return "palm_isle";
  if (m < 0.68) return patch > 0.6 ? "bamboo_forest" : "lowland_forest";
  return "jungle";
}

/** The sea biome at a place, from the sea's heat, depth, and the shelf it lies on. */
export function seaBiome(h, depth, lagoon, x, z, seed) {
  if (h < 0.1) return fbm(x / 40, z / 40, seed + 241, 2) > 0.42 ? "pack_ice" : "frozen_sea";
  if (h < 0.16) return fbm(x / 40, z / 40, seed + 241, 2) > 0.62 ? "pack_ice" : "frozen_sea";
  if (lagoon) return "lagoon";
  if (depth >= 22) return "deep_ocean";
  if (depth <= 10 && h > 0.7) return "coral_reef";
  if (depth >= 4 && depth <= 16 && h < 0.56) return "kelp_forest";
  if (depth <= 10 && h >= 0.45) return "seagrass";
  return "open_sea";
}

/** Whether a plant is placed on a column (deterministic), and which. */
export function plantAt(key, x, z, seed) {
  const b = BIOMES[key];
  if (!b?.plants?.length) return null;
  const r = rand(x, z, seed, 251);
  let acc = 0;
  for (const [id, p] of b.plants) {
    acc += p;
    if (r < acc) return id;
  }
  return null;
}

export const SEA_BIOMES = Object.keys(BIOMES).filter((k) => !BIOMES[k].land);
export const LAND_BIOMES = Object.keys(BIOMES).filter((k) => BIOMES[k].land);
export const hashOf = hash;
