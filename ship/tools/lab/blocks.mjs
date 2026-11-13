// What a block is to a walking player: the vertical span it fills in its cell (0..1, or more for
// fences), whether it can be stood on, climbed, or walked through. Bedrock's real collision boxes,
// simplified to vertical intervals (good enough to "see" gaps, cramped headroom and blocked doors).

const PASS = /air$|torch|lantern|flower|tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lily_of|short_grass|tall_grass|fern|sapling|button|banner|sign|rail|candle|pressure_plate|tripwire|vine|seagrass|kelp|lever|redstone_wire|chain|_door$|structure_void|light_block|sweet_berry|wheat|carrots|potatoes|beetroot|bamboo_sapling|dead_bush|snow_layer|moss_carpet|pink_petals|leaf_litter|hanging_roots|cave_vines|spore_blossom|azalea$|item_frame|flower_pot|decorated_pot/;
const LIQUID = /water$|lava$/;
const HEIGHT = [
  [/carpet/, 0.0625],
  [/trapdoor$/, 0.1875],
  [/bed$/, 0.5625],
  [/campfire/, 0.4375],
  [/daylight_detector|_slab$/, 0.5],
  [/chest$/, 0.875],
  [/enchanting|stonecutter/, 0.75],
  [/lectern|cauldron|composter|anvil|grindstone|bell$|brewing_stand/, 1],
  [/fence$|_wall$|fence_gate/, 1.5],
];

export function shape(id, states = {}) {
  if (!id || PASS.test(id)) return { kind: "pass", lo: 0, hi: 0 };
  if (LIQUID.test(id)) return { kind: "liquid", lo: 0, hi: 0 };
  if (/ladder$/.test(id)) return { kind: "ladder", lo: 0, hi: 0 };
  if (/_slab$/.test(id)) {
    const top = states["minecraft:vertical_half"] === "top" || states.top_slot_bit === true;
    return top ? { kind: "solid", lo: 0.5, hi: 1 } : { kind: "solid", lo: 0, hi: 0.5 };
  }
  if (/_stairs$/.test(id)) return { kind: "stairs", lo: 0, hi: 1, upside: !!states.upside_down_bit };
  for (const [re, h] of HEIGHT) if (re.test(id)) return { kind: h > 1 ? "fence" : "solid", lo: 0, hi: h };
  return { kind: "solid", lo: 0, hi: 1 };
}

/** Things a yard is for: the lab checks a player can reach each one. */
export const FEATURE = /bed$|crafting_table|chest$|barrel|campfire|furnace|smoker|loom|cartography|smithing|fletching|anvil|grindstone|lectern|composter|stonecutter|bell$|cauldron|brewing_stand|shipwright_table/;

// ---------------------------------------------------------------- allowed and sticking
import fs from "node:fs";
const TABLE = JSON.parse(fs.readFileSync(new URL("./bedrock_blocks.json", import.meta.url), "utf8")).blocks;

/** Problems with a block as the game would see it: an id it doesn't know, or a state it rejects. */
export function notAllowed(id, states = {}) {
  if (!id || id === "minecraft:air" || id.startsWith("shipwright:")) return null;
  const def = TABLE[id];
  if (!def) return `unknown block ${id} (it would show as a placeholder)`;
  for (const [k, v] of Object.entries(states ?? {})) {
    if (!(k in def)) return `${id} has no state ${k}`;
    if (def[k].length && !def[k].includes(v)) return `${id} state ${k} can't be ${JSON.stringify(v)}`;
  }
  return null;
}

/** A full, opaque cube: what ladders, wall torches and the like can hang on. */
const NOT_FULL = /glass|pane|_slab$|_stairs$|fence|_wall$|leaves|trapdoor|_door$|carpet|ladder|lantern|torch|_bed$|campfire|cauldron|composter|lectern|grindstone|stonecutter|bell$|anvil|chest$|flower|sapling|iron_bars|chain|candle|button|lever|_sign|banner|scaffolding|snow_layer|water|lava|air|ice$|hopper|brewing|enchanting|cake|pot$|rail|pressure_plate|grass$|fern|vine|dripstone|amethyst_cluster|bud$|head$|skull/;
export const fullCube = (id) => !!id && !NOT_FULL.test(id) && id !== "minecraft:air";
/** Something a thing can stand on (its top is solid enough): full cubes, top slabs, fences and walls (posts), upside stairs. */
export function holdsUp(b) {
  if (!b?.id || /air|water|lava/.test(b.id)) return false;
  if (fullCube(b.id)) return true;
  if (/_slab$/.test(b.id)) return b.states?.["minecraft:vertical_half"] === "top" || /double/.test(b.id) || true;   // a slab top holds a lantern
  if (/fence|_wall$|iron_chain|_stairs$|lantern|cauldron|composter|chest$|barrel|scaffolding|campfire|hopper|lectern|_bed$/.test(b.id)) return true;
  if (/trapdoor/.test(b.id)) return true;
  return false;
}
const FALLS = /^minecraft:(sand|red_sand|gravel|suspicious_sand|suspicious_gravel|anvil|scaffolding|[a-z_]+_concrete_powder|pointed_dripstone)$/;
const FACING = { 2: [0, 0, 1], 3: [0, 0, -1], 4: [1, 0, 0], 5: [-1, 0, 0] };   // the support's offset for a ladder facing 2 north, 3 south, 4 west, 5 east

/** Why a placed block wouldn't stay put (or "" when it's fine). get(x, y, z) -> { id, states }. */
export function unsupported(get, x, y, z, b) {
  const id = b.id, st = b.states ?? {};
  const below = get(x, y - 1, z), above = get(x, y + 1, z);
  if (/ladder$/.test(id)) {
    const off = FACING[st.facing_direction];
    const back = off && get(x + off[0], y, z + off[2]);
    if (!back || !fullCube(back.id)) return `ladder with nothing solid behind it (${back?.id ?? "air"})`;
    return "";
  }
  if (/^minecraft:(soul_)?lantern$/.test(id)) {
    if (st.hanging) return above && !/air|water/.test(above.id) ? "" : "hanging lantern with nothing above";
    return holdsUp(below) ? "" : `lantern standing on ${below?.id ?? "air"}`;
  }
  if (/^minecraft:(torch|soul_torch)$/.test(id)) return holdsUp(below) ? "" : `torch on ${below?.id ?? "air"}`;
  if (/candle$|carpet$|_bed$|_door$|pressure_plate|flower_pot|_banner$|rail$|snow_layer|_sign$/.test(id) || /^minecraft:(bell|cake|campfire|soul_campfire)$/.test(id)) {
    return below && !/air|water|lava/.test(below.id) ? "" : `${id.replace("minecraft:", "")} on ${below?.id ?? "air"}`;
  }
  if (/sapling|poppy|dandelion|tulip|orchid|allium|bluet|daisy|cornflower|lily_of|fern$|short_grass|tall_grass|sweet_berry|dead_bush|azalea$|pink_petals/.test(id)) {
    return below && /grass_block|dirt|podzol|mud|moss|farmland|rooted|mycelium|coarse/.test(below.id) ? "" : `${id.replace("minecraft:", "")} needs soil, on ${below?.id ?? "air"}`;
  }
  if (FALLS.test(id)) return below && !/air|water|lava/.test(below.id) ? "" : `${id.replace("minecraft:", "")} would fall`;
  return "";
}
