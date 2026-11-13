// Paying for things at the table: materials come from the supply chest first, then the player.
import { confirm } from "./ui.js";
import { describeCosts, missingCosts, consumeCosts, formatMissing } from "./inventory.js";

/** Checks and takes materials, from the supply chest first, then the player. Returns true if paid. */
export async function pay(player, title, summary, costs, supply = []) {
  const ok = await confirm(player, title, `${summary}\n\nNeeds: ${describeCosts(costs)}`, "Build", "Back");
  if (!ok) return false;
  const missing = missingCosts(player, costs, supply);
  if (missing.length) {
    player.sendMessage(`§cYou need ${formatMissing(missing)}.`);
    return false;
  }
  consumeCosts(player, costs, supply);
  return true;
}
