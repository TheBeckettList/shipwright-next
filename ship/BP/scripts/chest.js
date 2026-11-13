// Personal sea chests, like ender chests, opened through the chest built into every boat.
//
// Each player's belongings live in their own vault chest: an owner-locked entity kept in a small,
// always-loaded vault under the world spawn. It never moves. A boat's chest (its own inventory,
// drawn on deck as an ender-style chest) shows one player's items at a time: when they take the
// helm or sneak-use the boat, their items are moved in; when they step away or log off, back out.
// Items move container to container, so enchantments, names and durability all survive.
import { DIMENSIONS } from "./dims.js";
import { world } from "@minecraft/server";

export const CHEST_ID = "shipwright:sea_chest";
const KEY = "shipwright:sea_chest_id";        // on the player: their vault chest's id
const OWNER = "shipwright:chest_owner";       // on a boat: whose items are in its chest
const VAULT_KEY = "shipwright:vault_ready";
const AWAY = 6;                               // blocks: step further than this and your items go home

export function vaultLocation() {
  const s = world.getDefaultSpawnLocation();
  return { x: Math.floor(s.x) + 0.5, y: -58, z: Math.floor(s.z) + 0.5 };
}

function ensureVault() {
  if (world.getDynamicProperty(VAULT_KEY)) return;
  const v = vaultLocation();
  try {
    world.getDimension("minecraft:overworld").runCommand(`tickingarea add circle ${Math.floor(v.x)} ${v.y} ${Math.floor(v.z)} 1 shipwright_vault true`);
  } catch {
    /* already there */
  }
  world.setDynamicProperty(VAULT_KEY, true);
}

function findVaultChest(id) {
  if (!id) return undefined;
  try {
    const e = world.getEntity(id);
    return e?.isValid ? e : undefined;
  } catch {
    return undefined;
  }
}

/** The player's own vault chest, made (tamed to them) the first time it's needed. */
export function seaChestOf(player) {
  const found = findVaultChest(player.getDynamicProperty(KEY));
  if (found) return found;
  if (player.getDynamicProperty(KEY)) return undefined;   // exists but not loaded right now
  ensureVault();
  try {
    const e = world.getDimension("minecraft:overworld").spawnEntity(CHEST_ID, vaultLocation());
    e.getComponent("minecraft:tameable")?.tame(player);
    e.nameTag = `${player.name}'s sea chest`;
    player.setDynamicProperty(KEY, e.id);
    return e;
  } catch (err) {
    console.warn(`[Shipwright] Couldn't make a sea chest: ${err}`);
    return undefined;
  }
}

const inv = (entity) => {
  try {
    return entity?.getComponent("minecraft:inventory")?.container ?? null;
  } catch {
    return null;
  }
};

export const chestOwner = (boat) => boat.getDynamicProperty(OWNER) ?? null;

/** Moves every item from one container into the matching slots of another (up to the smaller size). */
function moveAll(from, to) {
  if (!from || !to) return;
  const n = Math.min(from.size, to.size);
  for (let i = 0; i < n; i++) {
    if (!from.getItem(i)) continue;
    if (to.getItem(i)) {
      const leftover = to.addItem(from.getItem(i));   // slot taken: find another place
      from.setItem(i, leftover);
    } else {
      from.moveItem(i, i, to);
    }
  }
}

/** Sends whatever is in a boat's chest back to its owner's vault. */
export function unloadChest(boat) {
  const owner = chestOwner(boat);
  if (!owner) return;
  const vault = findVaultChest(world.getAllPlayers().find((p) => p.id === owner)?.getDynamicProperty(KEY) ?? boat.getDynamicProperty(`${OWNER}_vault`));
  if (!vault) return;                       // vault not reachable: keep them aboard rather than lose them
  moveAll(inv(boat), inv(vault));
  boat.setDynamicProperty(OWNER, undefined);
  boat.setDynamicProperty(`${OWNER}_vault`, undefined);
}

/**
 * Brings a player's items into a boat's chest (sending anyone else's home first). Items found in
 * a boat with no owner (from older versions, when the chest was shared) go to the first player to load.
 * Returns true if the chest now holds the player's items.
 */
export function loadChest(boat, player) {
  if (chestOwner(boat) === player.id) return true;
  const vault = seaChestOf(player);
  if (!vault) return false;
  if (chestOwner(boat)) unloadChest(boat);
  if (chestOwner(boat)) return false;       // couldn't send the previous owner's items home
  // The player's items may be in another boat: bring them home first.
  for (const other of loadedBoatsOf(player)) if (other.id !== boat.id) unloadChest(other);
  moveAll(inv(boat), inv(vault));           // leftovers from the shared-chest days
  moveAll(inv(vault), inv(boat));
  boat.setDynamicProperty(OWNER, player.id);
  boat.setDynamicProperty(`${OWNER}_vault`, vault.id);
  return true;
}

function loadedBoatsOf(player) {
  const out = [];
  for (const id of DIMENSIONS) {
    try {
      for (const e of world.getDimension(id).getEntities({ families: ["shipwright_boat"] })) if (chestOwner(e) === player.id) out.push(e);
    } catch {
      /* dimension not loaded */
    }
  }
  return out;
}

/** Owners who have stepped away from their boat (or left the game) get their items sent home. */
export function returnAbsentChests(boats) {
  const players = new Map(world.getAllPlayers().map((p) => [p.id, p]));
  for (const boat of boats) {
    const owner = chestOwner(boat);
    if (!owner) continue;
    const p = players.get(owner);
    const far = !p || p.dimension.id !== boat.dimension.id ||
      Math.hypot(p.location.x - boat.location.x, p.location.z - boat.location.z) > AWAY;
    if (far) unloadChest(boat);
  }
}

/** How full a boat's chest is, 0 to 1 (cargo weighs the boat down). */
export function chestFill(boat) {
  const c = inv(boat);
  if (!c?.size) return 0;
  let load = 0;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it) load += Math.min(1, it.amount / (it.maxAmount ?? 64));
  }
  return load / c.size;
}
