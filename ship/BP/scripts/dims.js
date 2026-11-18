// Every dimension Shipwright works in: the vanilla three and the sea world.
import { world, system } from "@minecraft/server";

export const SEA_DIM = "shipwright:sea";
export const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end", SEA_DIM];

/** Drops every dimension this world doesn't have (the sea world is only there where it's registered: a server
 *  without it threw "Dimension 'shipwright:sea' is invalid" every second from every loop over DIMENSIONS). */
export function pruneDims() {
  for (let i = DIMENSIONS.length - 1; i >= 0; i--) {
    try {
      if (!world.getDimension(DIMENSIONS[i])) DIMENSIONS.splice(i, 1);
    } catch {
      DIMENSIONS.splice(i, 1);
    }
  }
}
export const hasDim = (id) => DIMENSIONS.includes(id);
system.run(pruneDims);   // the first tick: native calls are refused while scripts load
