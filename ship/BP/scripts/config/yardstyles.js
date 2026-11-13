// Pure data. Dock styles: one per tradition, built from its own biome's blocks, plus Custom.
// Working waterfronts only: no sacred or ceremonial structures (no torii gates, shrines or carving).
//   wall: the walkway's inner ring (the dock's frame; a slab floats half a block over the water and
//         snow doesn't settle on it)   deck: its outer ring   base: footing where the walkway meets air
//   post: bollards on the outer ring, carried down to the bottom as pilings   accent: on each post
//   light: on the corner posts and every other one
//   every: posts every this many blocks along each side
//   arch: the tradition's yard buildings and gathering place (yardarch.js), built behind the table
//   about: one line for the menu

export const YARD_STYLES = {
  norse: { name: "Norse naust", arch: "naust",
    about: "A turf-roofed naust with a sail loft, a longhouse with a long hearth, and a longfire deck.", tradition: "norse", icon: "boat_faering",
    wall: "minecraft:spruce_slab", deck: "minecraft:dark_oak_slab", base: "minecraft:cobblestone", post: "minecraft:spruce_log",
    accent: "minecraft:spruce_fence", light: "minecraft:lantern", every: 4 },
  european: { name: "Hanseatic wharf", arch: "warehouse",
    about: "A timber-framed warehouse with a hoist, a jettied town house, and a quay with a market stall and bell.", tradition: "european", icon: "boat_rowboat",
    wall: "minecraft:stone_brick_slab", deck: "minecraft:oak_slab", base: "minecraft:stone_bricks", post: "minecraft:oak_log",
    accent: "minecraft:oak_fence", light: "minecraft:lantern", every: 4 },
  birchbark: { name: "Birchbark canoe camp", arch: "canoe_house",
    about: "A bark-roofed canoe house over the building bed, a wiigiwaam, and a fire circle where elders teach.", tradition: "birchbark", icon: "boat_bark_canoe",
    wall: "minecraft:birch_slab", deck: "minecraft:spruce_slab", base: "minecraft:gravel", post: "minecraft:stripped_birch_log",
    accent: "minecraft:birch_fence", light: "minecraft:torch", every: 3 },
  pacific: { name: "Pacific canoe house", arch: "halau",
    about: "An open-sided thatched canoe house, a thatched hale, and a leaf shade over mats and a fire pit.", tradition: "pacific", icon: "boat_outrigger",
    wall: "minecraft:jungle_slab", deck: "minecraft:bamboo_mosaic_slab", base: "minecraft:sandstone", post: "minecraft:stripped_jungle_log",
    accent: "minecraft:bamboo_fence", light: "minecraft:torch", every: 3 },
  indian_ocean: { name: "Coral-stone dhow yard", arch: "coral_store",
    about: "A two-storey coral-stone storehouse, a house with a baraza bench, and a majlis under an arish.", tradition: "indian_ocean", icon: "boat_sewn_boat",
    wall: "minecraft:smooth_sandstone_slab", deck: "minecraft:cut_sandstone_slab", base: "minecraft:sandstone", post: "minecraft:acacia_log",
    accent: "minecraft:acacia_fence", light: "minecraft:lantern", every: 4 },
  east_asian: { name: "Southern China yard", arch: "tile_shed",
    about: "A workshop under an upturned tiled roof, a grey-brick house with stepped gables, and a tea stall.", tradition: "east_asian", icon: "boat_sampan",
    wall: "minecraft:stone_brick_slab", deck: "minecraft:bamboo_slab", base: "minecraft:stone_bricks", post: "minecraft:stripped_bamboo_block",
    accent: "minecraft:bamboo_fence", light: "minecraft:lantern", every: 3 },
  japanese: { name: "Funaya boathouse", arch: "funaya",
    about: "A two-storey funaya with a net loft, a house with a sunken hearth, and a veranda with net racks.", tradition: "japanese", icon: "boat_wasen",
    wall: "minecraft:spruce_slab", deck: "minecraft:polished_andesite_slab", base: "minecraft:stone", post: "minecraft:stripped_spruce_log",
    accent: "minecraft:spruce_fence", light: "minecraft:lantern", every: 3 },
  dugout: { name: "Cedar plank house", arch: "plank_house",
    about: "A cedar plank house with benches round a fire, a smokehouse, and fish-drying racks.", tradition: "dugout", icon: "boat_dugout",
    wall: "minecraft:dark_oak_slab", deck: "minecraft:spruce_slab", base: "minecraft:cobblestone", post: "minecraft:stripped_dark_oak_log",
    accent: "minecraft:dark_oak_fence", light: "minecraft:torch", every: 4 },
  shallow: { name: "Stilt house landing", arch: "stilt_house",
    about: "A thatched stilt house with a porch, a bamboo net shed, and a landing stage with lanterns.", tradition: "shallow", icon: "boat_punt",
    wall: "minecraft:mangrove_slab", deck: "minecraft:mud_brick_slab", base: "minecraft:mud_bricks", post: "minecraft:mangrove_log",
    accent: "minecraft:mangrove_fence", light: "minecraft:lantern", every: 3 },
  arctic: { name: "Arctic qarmaq camp", arch: "qarmaq",
    about: "A stone-and-sod qarmaq, a summer tent of skins, and boat racks beside a lamp-lit windbreak.", tradition: "arctic", icon: "boat_kayak",
    wall: "minecraft:cobblestone_slab", deck: "minecraft:mossy_cobblestone_slab", base: "minecraft:cobblestone", post: "minecraft:bone_block",
    accent: "minecraft:cobblestone_wall", light: "minecraft:lantern", every: 4 },
};

// Custom: the choices for each part.
const woods = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry"];
const title = (id) => id.replace("minecraft:", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const opts = (ids) => ids.map((id) => ({ id, name: id ? title(id) : "None" }));

export const CUSTOM_PARTS = {
  wall: {
    Wood: opts([...woods.map((w) => `minecraft:${w}_slab`), ...woods.map((w) => `minecraft:${w}_planks`), ...woods.map((w) => `minecraft:${w}_log`), "minecraft:bamboo_slab"]),
    Stone: opts(["minecraft:stone_brick_slab", "minecraft:cobblestone_slab", "minecraft:smooth_stone_slab", "minecraft:stone_bricks", "minecraft:cobblestone", "minecraft:brick_block", "minecraft:mud_bricks",
      "minecraft:deepslate_bricks", "minecraft:sandstone", "minecraft:smooth_sandstone", "minecraft:polished_andesite"]),
  },
  base: opts([null, "minecraft:cobblestone", "minecraft:stone", "minecraft:stone_bricks", "minecraft:sandstone",
    "minecraft:mud_bricks", "minecraft:gravel", "minecraft:packed_ice"]),
  post: opts([null, ...woods.map((w) => `minecraft:${w}_log`), "minecraft:bamboo_block", "minecraft:bone_block", "minecraft:stone_bricks"]),
  accent: opts([null, ...woods.map((w) => `minecraft:${w}_fence`), "minecraft:bamboo_fence", "minecraft:cobblestone_wall",
    "minecraft:andesite_wall", "minecraft:stone_brick_wall"]),
  light: opts([null, "minecraft:lantern", "minecraft:soul_lantern", "minecraft:torch", "minecraft:copper_bulb"]),
};

export const styleName = (id) => title(id);
