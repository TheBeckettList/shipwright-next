// inherency: data (a vision table: each people's architectural palette, the one choice per people)
// Pure. Each people's palette by elevation: what it builds low and what it builds high. The law is the
// builder's own: heavy low, light high (stone at the foot, the walls' own stuff above it, lighter stuff up
// top, the roof's covering, and something to crown it). A roof is always a roofing (shingle, slate, tile,
// thatch, copper, sod, snow), never a wall's stuff; brick is for chimneys.
//   plinth  the course the house stands on (and its footing, where the ground falls away)
//   wall    the ground storey's walls;  frame  their posts and beams (where the people frame)
//   upper   the storeys above (lighter: jettied timber, plaster, screens)
//   trim    sills, lintels, eaves, the balcony's rail
//   roof    the roofing: a family with its stairs and slab (the slope is stairs, the ridge a slab)
//   dome    a dome's covering, where the people domes;  crown  what tops it (finial, banner, weathervane)
//   door, window, shutter
export const ROOFING = {
  shingle: { block: "minecraft:spruce_planks", stairs: "minecraft:spruce_stairs", slab: "minecraft:spruce_slab" },
  darkshingle: { block: "minecraft:dark_oak_planks", stairs: "minecraft:dark_oak_stairs", slab: "minecraft:dark_oak_slab" },
  slate: { block: "minecraft:deepslate_tiles", stairs: "minecraft:deepslate_tile_stairs", slab: "minecraft:deepslate_tile_slab" },
  tile: { block: "minecraft:polished_granite", stairs: "minecraft:polished_granite_stairs", slab: "minecraft:polished_granite_slab" },
  thatch: { block: "minecraft:hay_block", stairs: "minecraft:bamboo_stairs", slab: "minecraft:bamboo_slab" },
  bark: { block: "minecraft:birch_planks", stairs: "minecraft:birch_stairs", slab: "minecraft:birch_slab" },
  copper: { block: "minecraft:oxidized_cut_copper", stairs: "minecraft:oxidized_cut_copper_stairs", slab: "minecraft:oxidized_cut_copper_slab" },
  cedar: { block: "minecraft:spruce_planks", stairs: "minecraft:spruce_stairs", slab: "minecraft:spruce_slab" },
  lime: { block: "minecraft:smooth_sandstone", stairs: "minecraft:smooth_sandstone_stairs", slab: "minecraft:smooth_sandstone_slab" },
  quartz: { block: "minecraft:smooth_quartz", stairs: "minecraft:smooth_quartz_stairs", slab: "minecraft:smooth_quartz_slab" },
  snow: { block: "minecraft:snow", stairs: "minecraft:snow", slab: "minecraft:snow_layer" },
};
export const PALETTE = {
  norse: { plinth: "minecraft:mossy_cobblestone", wall: "minecraft:spruce_planks", frame: "minecraft:spruce_log", upper: "minecraft:spruce_planks", trim: "minecraft:dark_oak_planks", roof: "shingle", pitch: "steep", dome: null, crown: "minecraft:dark_oak_fence", banner: "red", door: "minecraft:spruce_door", window: "minecraft:spruce_trapdoor", note: "a stone footing, plank walls on log frames, shingled steep roofs with carved gable posts" },
  european: { plinth: "minecraft:stone_bricks", wall: "minecraft:white_terracotta", frame: "minecraft:dark_oak_log", upper: "minecraft:white_terracotta", trim: "minecraft:dark_oak_planks", roof: "slate", pitch: "steep", dome: null, crown: "minecraft:lightning_rod", banner: "blue", door: "minecraft:wooden_door", window: "minecraft:glass_pane", jetty: true, note: "the 1600s town house: a stone ground course, half-timbered plaster above, upper storeys jettied out, a steep slate roof, a weathervane" },
  birchbark: { plinth: "minecraft:coarse_dirt", wall: "minecraft:stripped_birch_log", frame: "minecraft:birch_log", upper: "minecraft:stripped_birch_log", trim: "minecraft:birch_planks", roof: "bark", pitch: "round", dome: "bark", crown: null, banner: null, door: "minecraft:birch_door", window: "minecraft:birch_trapdoor", note: "bark over a bent-pole frame, rounded roofs, a smoke hole" },
  pacific: { plinth: "minecraft:cobblestone", wall: "minecraft:bamboo_planks", frame: "minecraft:jungle_log", upper: "minecraft:bamboo_planks", trim: "minecraft:jungle_planks", roof: "thatch", pitch: "steep", dome: null, crown: null, banner: "yellow", door: "minecraft:bamboo_door", window: "minecraft:bamboo_trapdoor", raised: true, note: "on a stone platform, open bamboo walls, a steep thatch that comes low over the eaves" },
  indian_ocean: { plinth: "minecraft:sandstone", wall: "minecraft:smooth_sandstone", frame: "minecraft:mangrove_log", upper: "minecraft:smooth_quartz", trim: "minecraft:dark_oak_planks", roof: "lime", pitch: "flat", dome: "quartz", crown: "minecraft:lightning_rod", banner: "white", door: "minecraft:dark_oak_door", window: "minecraft:dark_oak_trapdoor", note: "coral-lime walls, carved dark doors, flat roofs with parapets, the odd white dome" },
  east_asian: { plinth: "minecraft:polished_andesite", wall: "minecraft:mud_bricks", frame: "minecraft:stripped_crimson_stem", upper: "minecraft:mud_bricks", trim: "minecraft:crimson_planks", roof: "slate", pitch: "curved", dome: null, crown: "minecraft:gold_block", banner: "red", door: "minecraft:crimson_door", window: "minecraft:red_stained_glass_pane", note: "a stone platform, earth-brick walls between red lacquered posts, grey tiled roofs that curve up at the eaves" },
  japanese: { plinth: "minecraft:stone_bricks", wall: "minecraft:birch_planks", frame: "minecraft:stripped_spruce_log", upper: "minecraft:birch_planks", trim: "minecraft:dark_oak_planks", roof: "slate", pitch: "curved", dome: null, crown: null, banner: "white", door: "minecraft:spruce_door", window: "minecraft:white_stained_glass_pane", note: "a raised floor on stone, pale screens between dark posts, kawara tile roofs, deep eaves" },
  dugout: { plinth: "minecraft:spruce_planks", wall: "minecraft:stripped_spruce_log", frame: "minecraft:spruce_log", upper: "minecraft:stripped_spruce_log", trim: "minecraft:spruce_planks", roof: "cedar", pitch: "low", dome: null, crown: null, banner: null, door: "minecraft:spruce_door", window: "minecraft:spruce_trapdoor", note: "the cedar plank house: wide, low-gabled, its planks on great posts, facing the beach" },
  shallow: { plinth: "minecraft:mangrove_roots", wall: "minecraft:bamboo_planks", frame: "minecraft:mangrove_log", upper: "minecraft:bamboo_planks", trim: "minecraft:mangrove_planks", roof: "thatch", pitch: "saddle", dome: null, crown: null, banner: "green", door: "minecraft:bamboo_door", window: "minecraft:bamboo_trapdoor", stilts: true, note: "on mangrove stilts over the water, bamboo walls, a saddle-backed thatch" },
  arctic: { plinth: "minecraft:snow", wall: "minecraft:snow", frame: "minecraft:packed_ice", upper: "minecraft:snow", trim: "minecraft:packed_ice", roof: "snow", pitch: "dome", dome: "snow", crown: null, banner: null, door: "minecraft:spruce_door", window: "minecraft:ice", note: "snow domes with an ice window, a low entrance tunnel" },
  therans: { plinth: "minecraft:calcite", wall: "minecraft:white_concrete", frame: "minecraft:quartz_pillar", upper: "minecraft:smooth_quartz", trim: "minecraft:gold_block", roof: "quartz", pitch: "flat", dome: "blue", crown: "minecraft:gold_block", banner: "light_blue", door: "minecraft:warped_door", window: "minecraft:light_blue_stained_glass_pane", note: "white, gold and blue: whitewashed walls, blue domes and doors, gold at the finials and bells" },
};
export const DOMES = { blue: "minecraft:blue_concrete", quartz: "minecraft:smooth_quartz", bark: "minecraft:birch_planks", snow: "minecraft:snow" };   // a dome's covering block
