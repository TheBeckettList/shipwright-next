// inherency: data (the Therans' vision table, and the grammar that reads it)
// The Therans: Thera's own people (NPC villagers), the height of the waterworld's peoples. The
// players are Atlanteans; the Therans are who they live among. Two layers in everything they build,
// blended by the ground under it:
//
//   Akrotiri   the Bronze Age town as excavated: two and three storeys of tuff ashlar, walls laced
//              with timber against earthquakes, rows of windows and pier-and-door partitions
//              (polythyra), flat roofs, light wells, painted rooms (the frescoes: ships, swallows,
//              saffron gatherers, blue monkeys), stone-paved lanes with drains
//   Santorini  the island as it is now: whitewashed cubes with rounded edges, barrel vaults, cave
//              houses cut into the caldera cliffs (yposkafa), blue doors and shutters, stepped
//              lanes, terraces over the drop, windmills on the ridges, flowers on the walls.
//              Domes only on civic buildings (the Library, the baths, the cisterns, the Exchange's
//              hall): nothing sacred, as everywhere in the waterworld
//
// The blend at a site (blendAt): cave houses take over where the ground is steep (cliffs), Akrotiri
// stone where it's flat and low (the harbour towns, the inner city's lower terraces), whitewash
// rising with height and with view over the water. Every block is vanilla Bedrock's (vanilla lens).
export const THERANS = {
  name: "Therans",
  living: ["traders", "shipwrights", "vintners", "potters", "saffron gatherers", "chart makers"],
  temper: "peaceful",
  resources: {
    stone: ["minecraft:tuff", "minecraft:polished_tuff", "minecraft:tuff_bricks", "minecraft:smooth_basalt", "minecraft:red_sandstone", "minecraft:calcite"],   // the caldera's white, black and red layers
    soil: ["minecraft:coarse_dirt", "minecraft:gravel"],   // pumice soils
    crops: ["minecraft:sweet_berries", "minecraft:wheat", "minecraft:beetroot"],   // vines (low, wind-trained), barley, pulses
    dyes: ["minecraft:orange_tulip", "minecraft:lapis_lazuli"],   // saffron, and the blue of the frescoes
    sea: ["minecraft:cod", "minecraft:tropical_fish"],
  },
  akrotiri: {
    base: "minecraft:tuff_bricks", ashlar: "minecraft:polished_tuff", lacing: "minecraft:stripped_dark_oak_log",
    window: "minecraft:glass_pane", frame: "minecraft:dark_oak_fence", roof: "minecraft:packed_mud", parapet: "minecraft:mud_brick_slab",
    paving: "minecraft:tuff_brick_slab", fresco: ["minecraft:light_blue_terracotta", "minecraft:red_terracotta", "minecraft:white_terracotta", "minecraft:yellow_terracotta"],
    storeys: [2, 3], laceEvery: 3,
  },
  santorini: {
    wall: "minecraft:white_concrete", plaster: "minecraft:calcite", edge: "minecraft:smooth_quartz_stairs", vault: "minecraft:smooth_quartz_slab",
    door: "minecraft:warped_door", shutter: "minecraft:warped_trapdoor", dome: "minecraft:light_blue_concrete",
    lane: "minecraft:smooth_stone_slab", step: "minecraft:smooth_quartz_stairs", flowers: ["minecraft:azalea_leaves_flowered", "minecraft:pink_petals"],
    mill: { tower: "minecraft:white_concrete", sails: "minecraft:white_wool", frame: "minecraft:spruce_fence", cap: "minecraft:spruce_planks" },
    cave: { cut: "minecraft:tuff", front: "minecraft:white_concrete", lintel: "minecraft:smooth_quartz_slab" },
  },
  civicDomes: ["the Library", "the baths", "the cisterns", "the Exchange's hall"],
  // the blend's bands: slope (blocks of rise a block, in the game) where cave houses take over; height share where whitewash is full
  blend: { caveSlope: [0.7, 1.8], whiteHeight: [0.15, 0.65] },
};

/** The Therans as a people (for the house and dress laws): the Europeans' build, in Thera's own stone and flat roofs. */
export function theranPeople(eu) {
  return { ...eu, tradition: "therans", T: 18, living: "traders", build: { ...eu.build, frame: { kind: "stone", post: "minecraft:stripped_dark_oak_log", wall: "minecraft:tuff_bricks" }, roof: { pitch: "flat", cover: "minecraft:packed_mud" } } };   // vision: the Akrotiri house's tuff walls, its dark oak lacing, its packed-earth roof (THERANS.akrotiri)
}
const clamp01 = (t) => Math.max(0, Math.min(1, t));
/** How a Theran site builds: shares of the three ways (cave houses, Akrotiri stone, whitewash). */
export function blendAt({ slope, h, top }) {
  const B = THERANS.blend;
  const cave = clamp01((slope - B.caveSlope[0]) / (B.caveSlope[1] - B.caveSlope[0]));
  const white = clamp01((h / top - B.whiteHeight[0]) / (B.whiteHeight[1] - B.whiteHeight[0]));
  const akrotiri = (1 - cave) * (1 - white);
  const sum = cave + white * (1 - cave) + akrotiri;
  return { cave: +(cave / sum).toFixed(2), whitewash: +((white * (1 - cave)) / sum).toFixed(2), akrotiri: +(akrotiri / sum).toFixed(2) };
}

/**
 * The towns of the island, each a kind of site the ground offers, found by scoring the ground
 * (towns.js). Working names are the island's real villages (rename freely).
 *   score: what the kind wants of a place (h blocks over the sea, slope, bay: how far into the
 *   caldera, y km north, x km east, coast: km to the sea)
 */
export const TOWN_KINDS = [
  { kind: "cliff town", count: 3, names: ["Fira", "Imerovigli", "Firostefani"], radius: 0.5, spacing: 1.1,
    score: (s) => (s.h > 30 && s.h < 95 && s.bay > 0.97 && s.bay < 1.12 ? 1 + s.h / 100 - Math.abs(s.bay - 1.0) * 6 : -1) },   // on the lip, spilling down the face
  { kind: "strait town", count: 1, names: ["Oia"], radius: 0.55, spacing: 1.2,
    score: (s) => (s.h > 20 && s.h < 80 && s.strait < 1.4 && s.bay > 0.95 ? 2 - s.strait : -1) },
  { kind: "harbour town", count: 1, names: ["Akrotiri"], radius: 0.6, spacing: 2,   // on the south-west coast, as the real one
    score: (s) => (s.h > 2 && s.h < 14 && s.coast < 0.18 && s.y < -4.5 && s.x < 2 && s.slope < 0.5 ? 2 - s.slope * 1.5 - s.coast : -1) },
  { kind: "hill town", count: 1, names: ["Pyrgos"], radius: 0.45, spacing: 2,
    score: (s) => (s.h > 45 && s.h < 110 && s.coast > 1.0 && s.bay > 1.4 && s.peak ? 1 + s.h / 100 : -1) },
  { kind: "shore town", count: 2, names: ["Kamari", "Perissa"], radius: 0.45, spacing: 1.6,
    score: (s) => (s.h > 1 && s.h < 8 && s.coast < 0.15 && s.x > 5 && s.y > -7.6 && s.y < 3 && s.slope < 0.5 ? 2 - s.slope * 2 : -1) },
];
