import { ItemStack } from "@minecraft/server";

// A cost is { ids: string[], count: number, label: string }.

export function isCreative(player) {
  try {
    return String(player.getGameMode()).toLowerCase() === "creative";
  } catch {
    return false;
  }
}

function container(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

function countIn(inv, set) {
  let total = 0;
  if (!inv) return 0;
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item && set.has(item.typeId)) total += item.amount;
  }
  return total;
}

/**
 * Containers touching a block (chests, barrels, shulker boxes...). A double chest is
 * one container seen from both halves, so only one 54-slot container is used.
 */
export function adjacentContainers(block) {
  const found = [];
  let double = false;
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
    try {
      const l = block.location;
      const b = block.dimension.getBlock({ x: l.x + dx, y: l.y + dy, z: l.z + dz });
      const c = b?.getComponent("minecraft:inventory")?.container;
      if (!c) continue;
      if (c.size >= 54) {
        if (double) continue;
        double = true;
      }
      found.push(c);
    } catch {
      /* not a container */
    }
  }
  return found;
}

/** Items the player can draw on: their inventory plus any supply containers. */
export function countItems(player, ids, supply = []) {
  const set = new Set(ids);
  return countIn(container(player), set) + supply.reduce((n, c) => n + countIn(c, set), 0);
}

export function hasAny(player, ids) {
  return countItems(player, ids) > 0;
}

/** Merge costs that use the same item set so counts add up correctly. */
export function mergeCosts(costs) {
  const map = new Map();
  for (const c of costs) {
    if (c.count <= 0) continue;
    const key = [...c.ids].sort().join("|");
    const prev = map.get(key);
    if (prev) prev.count += c.count;
    else map.set(key, { ...c });
  }
  return [...map.values()];
}

export function describeCosts(costs) {
  const list = mergeCosts(costs);
  if (list.length === 0) return "Nothing";
  return list.map((c) => `${c.count} × ${c.label}`).join(", ");
}

/** Returns the costs the player can't cover (empty array = affordable). */
export function missingCosts(player, costs, supply = []) {
  if (isCreative(player)) return [];
  return mergeCosts(costs)
    .map((c) => ({ ...c, have: countItems(player, c.ids, supply) }))
    .filter((c) => c.have < c.count);
}

function takeFrom(inv, set, need) {
  for (let i = 0; inv && i < inv.size && need > 0; i++) {
    const item = inv.getItem(i);
    if (!item || !set.has(item.typeId)) continue;
    if (item.amount > need) {
      item.amount -= need;
      inv.setItem(i, item);
      need = 0;
    } else {
      need -= item.amount;
      inv.setItem(i, undefined);
    }
  }
  return need;
}

/** Removes the costs, from supply containers first, then the player. Call after missingCosts returned []. */
export function consumeCosts(player, costs, supply = []) {
  if (isCreative(player)) return;
  for (const c of mergeCosts(costs)) {
    const set = new Set(c.ids);
    let need = c.count;
    for (const box of supply) need = takeFrom(box, set, need);
    takeFrom(container(player), set, need);
  }
}

/** Puts items into the supply containers if there's room, dropping the rest at a location. */
export function depositOrDrop(supply, dimension, location, itemId, count) {
  let left = Math.floor(count);
  for (const box of supply) {
    while (left > 0) {
      const n = Math.min(64, left);
      let leftover;
      try {
        leftover = box.addItem(new ItemStack(itemId, n));
      } catch {
        break;
      }
      const placed = n - (leftover?.amount ?? 0);
      left -= placed;
      if (leftover) break;   // this container is full
    }
    if (left <= 0) return;
  }
  dropItems(dimension, location, itemId, left);
}

/** Drops items at a location, split into stacks of 64. */
export function dropItems(dimension, location, itemId, count) {
  let left = Math.floor(count);
  while (left > 0) {
    const n = Math.min(64, left);
    try {
      dimension.spawnItem(new ItemStack(itemId, n), location);
    } catch (e) {
      console.warn(`[Shipwright] Could not drop ${itemId}: ${e}`);
      return;
    }
    left -= n;
  }
}

export function formatMissing(missing) {
  return missing.map((m) => `${m.count - m.have} more ${m.label}`).join(", ");
}
