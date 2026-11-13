// Which of vanilla's terrain-atlas names each of our variant stems should take over. Read from Mojang's own atlas
// (bedrock-samples, resource_pack/textures/terrain_texture.json): only its single-path names are taken, since a name that
// holds a list (stone, dirt, sand, the leaves, grass) is read by index, and a list of variations in its place would
// break the blocks that index it. A stem names our texture file; the names are the atlas keys that draw from it.
const DYES = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "silver", "cyan", "purple", "blue", "brown", "green", "red", "black"];
const dyeName = (d) => (d === "silver" ? "light_gray" : d);
const WOODS = [["oak", "oak"], ["spruce", "spruce"], ["birch", "birch"], ["jungle", "jungle"], ["acacia", "acacia"], ["big_oak", "dark_oak"]];

export const VANILLA_KEYS = {
  // the woods: logs (side and top), their wood, their planks and all that's cut from them
  ...Object.fromEntries(WOODS.flatMap(([f, n]) => [
    [`log_${f}`, [`${n}_log_side`, `${n}_wood`, ...(f === "big_oak" ? ["grindstone_leg"] : [])]],
    [`log_${f}_top`, [`${n}_log_top`]],
    [`planks_${f}`, [`${n}_planks`, `wood_${f}`, f === "oak" ? "sign" : f === "big_oak" ? "darkoak_sign" : `${n}_sign`,
      ...(f === "oak" ? ["bookshelf_top", "crafting_table_bottom", "bed_bottom", "trip_wire_base", "lectern_bottom"] : f === "big_oak" ? ["cartography_table_bottom"] : [])]],
    [`shipwright/stripped_${n}_log`, [`stripped_${n}_log_side`, `stripped_${n}_wood`]],
    [`shipwright/stripped_${n}_log_top`, [`stripped_${n}_log_top`]],
  ])),
  "shipwright/stripped_cherry_log": ["stripped_cherry_log_side"], "shipwright/stripped_cherry_log_top": ["stripped_cherry_log_top"],
  "shipwright/stripped_mangrove_log": ["stripped_mangrove_log_side"], "shipwright/stripped_mangrove_log_top": ["stripped_mangrove_log_top"],
  "shipwright/cherry_log": ["cherry_log_side"], "shipwright/cherry_log_top": ["cherry_log_top"], "shipwright/cherry_planks": ["cherry_planks"],
  "shipwright/mangrove_log": ["mangrove_log_side"], "shipwright/mangrove_log_top": ["mangrove_log_top"], "shipwright/mangrove_planks": ["mangrove_planks", "mangrove_sign"],
  "shipwright/bamboo_block": ["bamboo_block"], "shipwright/bamboo_block_top": ["bamboo_block_top"], "shipwright/bamboo_planks": ["bamboo_planks", "bamboo_sign"],
  // the dyed: terracotta and wool (with wool's stairs and slabs)
  ...Object.fromEntries(DYES.flatMap((d) => [
    [`hardened_clay_stained_${d}`, [`${dyeName(d)}_terracotta`]],
    [`wool_colored_${d}`, [`wool_colored_${d}`, `${dyeName(d)}_wool_stairs`, `${dyeName(d)}_wool_slab`, `${dyeName(d)}_wool_double_slab`]],
  ])),
  // the stones
  stone: ["infested_stone", "normal_stone_slab", "bell_stone", "flattened_stone"],
  stonebrick: ["stone_bricks", "stone_brick_slab", "infested_stone_bricks", "stone_brick_wall"],
  cobblestone: ["cobblestone", "cobblestone_slab", "infested_cobblestone", "lever_particle", "flattened_cobblestone_wall"],
  "shipwright/mossy_cobblestone": ["cobblestone_mossy", "mossy_cobblestone_slab", "mossy_cobblestone_wall"],
  "shipwright/andesite": ["andesite", "andesite_slab", "andesite_wall"],
  brick: ["brick", "brick_slab", "brick_wall"], mud_bricks: ["mud_bricks"], calcite: ["calcite"], clay: ["clay"], gravel: ["gravel"],
  "shipwright/deepslate": ["deepslate"], "shipwright/deepslate_top": ["deepslate_top"],
  "shipwright/basalt": ["basalt_side"], "shipwright/basalt_top": ["basalt_top"],
  "shipwright/emerald_ore": ["emerald_ore"], "shipwright/gold_ore": ["gold_ore"],
  sandstone_normal: ["sandstone_slab_side", "flattened_sandstone", "sandstone_wall"],
  sandstone_top: ["smooth_sandstone", "sandstone_slab_top", "smooth_sandstone_slab", "cut_sandstone_slab_top", "flattened_sandstone_top"],
  sandstone_bottom: ["sandstone_slab_bottom", "flattened_sandstone_bottom"],
  "shipwright/red_sandstone": ["redsandstone", "red_sandstone_slab_side", "flattened_redsandstone", "red_sandstone_wall"],
  "shipwright/red_sandstone_top": ["smooth_red_sandstone", "red_sandstone_slab_top", "smooth_red_sandstone_slab", "cut_red_sandstone_slab_top", "flattened_redsandstone_top"],
  "shipwright/red_sandstone_bottom": ["red_sandstone_slab_bottom", "flattened_redsandstone_bottom"],
  "shipwright/quartz_pillar": ["quartz_pillar_side"], "shipwright/quartz_pillar_top": ["quartz_pillar_top"],
  "shipwright/purpur_pillar": ["purpur_pillar_side"], "shipwright/purpur_pillar_top": ["purpur_pillar_top"],
  // the soft and the made
  dirt: ["grass_carried_bottom", "dirt_podzol_bottom", "farmland_side", "flattened_dirt"], sand: ["flattened_sand"],
  "shipwright/mud": ["mud"], "shipwright/hay_block": ["hayblock_side"], "shipwright/hay_block_top": ["hayblock_top"],
  "shipwright/bone_block": ["bone_block_side"], "shipwright/bone_block_top": ["bone_block_top"], "shipwright/sponge": ["flattened_sponge"],
  "shipwright/brain_coral_block": ["brain_coral_block"], "shipwright/tube_coral_block": ["tube_coral_block"],
  snow: ["snow"], ice_packed: ["ice_packed"],
};
