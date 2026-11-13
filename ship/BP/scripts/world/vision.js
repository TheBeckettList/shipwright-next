// Pure data. The vision of the sea world, as numbers the balance lab holds the world to. If the
// world drifts from these, the lab fails: the vision is the specification, not a mood board.
//
// The world is an ocean planet folded flat (fields.js): a few base fields (latitude, heat, wind,
// moisture) decide everything else in order, and nothing downstream invents its own climate:
//   fields -> ground and biomes -> what grows (woods, plants) -> who can live there (a people needs
//   its boat wood) -> where they sail (lanes) -> where ships were lost (wrecks), what they left
//   (sunken harbours), what they carried (cargo, charts) -> what lives and hunts there (mobs).
// Everything vanilla's overworld offers is here, up to the Nether and End portals, at sea.

export const VISION = {
  // An ocean world: little land, in archipelagos, with open water between them.
  land: [0.05, 0.12],
  // Every biome has a place: none smaller than this share of its kind (land or sea), none bigger.
  // (Atoll lagoons need a warm-water atoll near the spawn, so the sea floor is 0.)
  biomeShare: { land: [0.003, 0.2], sea: [0, 0.8] },   // judged across seeds; the deep is most of the sea, by design
  // Every people has a place: each tradition holds this share of settled confederations; a few
  // archipelagos grow nothing to build with and stay unsettled.
  cultureShare: [0.04, 0.22],     // judged across seeds (one seed's share moves by chance)
  unsettled: [0, 0.22],
  // Lively: sailing a straight line, something new (an island, a wreck, a ruin, a structure, a new
  // sea, other people's water) comes up this often (blocks): the median gap, and the long gaps.
  liveliness: { median: 300, p90: 1100 },
  // Near the spawn (within this many blocks): how much of the world a new player meets.
  nearSpawn: { radius: 1500, biomes: 6, cultures: 2, wrecks: 3 },
  // Steady trades, stronger westerlies, storms born where the belts breed them.
  wind: { tradesSpreadMax: 30, westerliesOverTrades: 1.05, stormBelts: ["westerlies", "trades"] },
};

/**
 * Vanilla's overworld, up to the portals, and where each thing is in the sea world. `probe` names
 * how the balance lab finds the nearest one to the spawn; `within` is how far a player should have
 * to sail for it (blocks), set by when vanilla's progression needs it.
 */
export const PARITY = [
  // the first day
  { vanilla: "Wood (oak, birch, spruce)", ours: "Trees on the spawn's islands", probe: "wood", within: 200 },
  { vanilla: "Stone, coal, iron, copper", ours: "Every island's rock (ores at vanilla's depths)", probe: "land", within: 200 },
  { vanilla: "Food, wool, leather", ours: "Animals of each island's biome", probe: "animals", within: 300 },
  { vanilla: "Wheat seeds, flowers", ours: "Grass and flowers on temperate islands", probe: "grass", within: 1500 },
  { vanilla: "Sand, glass, clay, gravel, flint", ours: "Beaches and the sea bed", probe: "biome:beach|seagrass|open_sea|coral_reef|lagoon|stony_shore", within: 400 },
  { vanilla: "Sugar cane (paper, books)", ours: "Cane by the water on beaches and marshes", probe: "biome:beach|salt_marsh", within: 800 },
  // the first weeks
  { vanilla: "Gold, lapis, redstone, diamonds", ours: "Deep rock of every island (diamonds below y 28)", probe: "land", within: 200 },
  { vanilla: "Caves and lava", ours: "Caves through the bigger islands, lava lakes at their bottoms", probe: "big_island", within: 1200 },
  { vanilla: "Obsidian (Nether portal)", ours: "Drowned gates on the shoals, volcanic shores", probe: "obsidian", within: 1500 },
  { vanilla: "Ruined portal", ours: "Drowned gate (obsidian, flint and steel, gold)", probe: "structure:gate", within: 1500 },
  { vanilla: "Shipwreck, ocean ruins, buried treasure", ours: "Wrecks of the peoples' ships, sunken harbours, charted treasure", probe: "site:wreck", within: 600 },
  { vanilla: "Villages (trade)", ours: "Confederations' harbours (people of the ten traditions)", probe: "settled", within: 1500 },
  { vanilla: "Zombies, skeletons, spiders, creepers", ours: "Night on every island", probe: "land", within: 200 },
  { vanilla: "Endermen (pearls)", ours: "Night on every island", probe: "land", within: 200 },
  { vanilla: "Slimes, witches, witch hut", ours: "Salt marshes and mangrove coasts", probe: "biome:salt_marsh|mangrove", within: 4000 },
  { vanilla: "Igloo", ours: "Igloos on the tundra islands", probe: "biome:tundra|snowy_taiga|ice_sheet", within: 6000 },
  { vanilla: "Desert, husks, cactus", ours: "Desert isles", probe: "biome:desert|badlands", within: 6000 },
  { vanilla: "Jungle, melons, pandas, parrots", ours: "Rainforest isles", probe: "biome:jungle|lowland_forest|bamboo_forest", within: 7000 },
  { vanilla: "Mushroom fields", ours: "Mushroom isles, far from anyone", probe: "biome:mushroom_isle", within: 10000 },
  { vanilla: "Amethyst geodes", ours: "Geodes in the big islands' rock", probe: "big_island", within: 1200 },
  { vanilla: "Emeralds (ore)", ours: "Highlands and peaks", probe: "biome:highlands|peaks", within: 5000 },
  { vanilla: "Ocean monument (prismarine, sponge)", ours: "Monuments on the deep floor", probe: "structure:monument", within: 7000 },
  { vanilla: "Coral reefs, kelp, seagrass, icebergs", ours: "Reefs, kelp forests, meadows, pack ice", probe: "biome:coral_reef|kelp_forest|seagrass", within: 3000 },
  // the portals
  { vanilla: "Stronghold (End portal)", ours: "Sea fortresses, three on a ring 1,400-2,800 out", probe: "structure:fortress", within: 3000 },
  { vanilla: "Eyes of ender lead the way", ours: "An eye used at sea points to the nearest fortress", probe: "structure:fortress", within: 3000 },
];
