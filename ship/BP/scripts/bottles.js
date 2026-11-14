// Ships in bottles: a creative-menu item for every plan (tools/gen_bottles.py bakes them). Used on
// open water, the bottle asks which of the plan's sizes (Short, Typical, Long) and uncorks her
// there, finished and launched, bow the way you're looking. For testing and creative building.
import { world, system } from "@minecraft/server";
import { PLANS } from "./config/plans.js";
import { DIRS } from "./config/yards.js";
import { sizePresets } from "./ship.js";
import { uncork } from "./stages.js";
import { menu } from "./ui.js";
import { isCreative } from "./inventory.js";

export const BOTTLE = "shipwright:bottle_";
const REACH = 24;                          // vision: how far off you can uncork her, blocks

/** The cardinal direction nearest a view direction. */
export function nearestDir(v) {
  let best = "south", most = -Infinity;
  for (const [name, d] of Object.entries(DIRS)) {
    const dot = d.x * v.x + d.z * v.z;
    if (dot > most) { most = dot; best = name; }
  }
  return best;
}

const isWater = (b) => !!b && (b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water");

async function useBottle(player, item) {
  const plan = PLANS[item.typeId.slice(BOTTLE.length)];
  if (!plan) return;
  const hit = player.getBlockFromViewDirection({ includeLiquidBlocks: true, includePassableBlocks: true, maxDistance: REACH });
  let b = hit?.block;
  if (!isWater(b)) {
    player.sendMessage("§7Look at open water to uncork her.");
    return;
  }
  const dim = player.dimension;
  while (isWater(dim.getBlock({ x: b.location.x, y: b.location.y + 1, z: b.location.z }))) b = dim.getBlock({ x: b.location.x, y: b.location.y + 1, z: b.location.z });
  const presets = sizePresets(plan, plan.lengthRange[1]);
  const pick = await menu(player, `${plan.name} in a Bottle`, "Which size?",
    presets.map((s) => `${s.label}: ${s.length} blocks long, ${(s.beam * plan.baseBeam).toFixed(1)} wide`));
  if (pick < 0) return;
  const dirName = nearestDir(player.getViewDirection());
  const centre = { x: b.location.x + 0.5, y: b.location.y + 0.6, z: b.location.z + 0.5 };   // given: a launched hull's height over her water block (yard.js launchLocation)
  uncork(dim, plan, presets[pick], centre, dirName);
  if (!isCreative(player)) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    inv?.setItem(player.selectedSlotIndex, undefined);
  }
  player.sendMessage(`§aUncorked: the ${plan.name}, ${presets[pick].length} blocks.`);
}

export function startBottles() {
  world.afterEvents.itemUse?.subscribe((ev) => {
    const item = ev.itemStack;
    if (!item?.typeId?.startsWith(BOTTLE)) return;
    const p = ev.source;
    system.run(() => useBottle(p, item).catch((err) => console.warn(`[Shipwright] Bottle: ${err}`)));
  });
}
