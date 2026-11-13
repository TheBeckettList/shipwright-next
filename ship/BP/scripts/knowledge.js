import { WOODS, TRADITIONS, ARCTIC_REQUIRES } from "./config/materials.js";
import { hasAny } from "./inventory.js";

const KEY = "shipwright:known";

export function getKnown(player) {
  try {
    const raw = player.getDynamicProperty(KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveKnown(player, set) {
  player.setDynamicProperty(KEY, JSON.stringify([...set]));
}

/**
 * Checks the player's inventory and teaches any traditions whose materials
 * they're carrying. Returns the newly learned tradition keys.
 */
export function learnFromInventory(player) {
  const known = getKnown(player);
  const learned = [];
  for (const wood of WOODS) {
    if (!known.has(wood.tradition) && hasAny(player, wood.logs)) {
      known.add(wood.tradition);
      learned.push(wood.tradition);
    }
  }
  const arcticReady =
    ARCTIC_REQUIRES.all.every((id) => hasAny(player, [id])) && hasAny(player, ARCTIC_REQUIRES.any);
  if (!known.has("arctic") && arcticReady) {
    known.add("arctic");
    learned.push("arctic");
  }
  if (learned.length) {
    saveKnown(player, known);
    for (const t of learned) {
      const info = TRADITIONS[t];
      player.sendMessage(`§6You learned the ${info.name} boatbuilding tradition.§r §7(${info.boat})`);
    }
  }
  return learned;
}
