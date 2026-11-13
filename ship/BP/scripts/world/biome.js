// Pure. The sea world has no biomes of its own (a custom dimension is all one), so everything
// that asks "what biome is this?" (village docks, wind) asks the world's own climate instead and
// gets the vanilla biome that looks most like it.
import { elevation, climate } from "./terrain.js";

const LAND = { polar: "minecraft:snowy_plains", boreal: "minecraft:taiga", temperate: "minecraft:plains", dry: "minecraft:cherry_grove",
  arid: "minecraft:desert", savanna: "minecraft:savanna", tropical: "minecraft:jungle", wet: "minecraft:mangrove_swamp" };
const SEA = { polar: "minecraft:frozen_ocean", boreal: "minecraft:cold_ocean", temperate: "minecraft:ocean", dry: "minecraft:ocean",
  arid: "minecraft:lukewarm_ocean", savanna: "minecraft:lukewarm_ocean", tropical: "minecraft:warm_ocean", wet: "minecraft:warm_ocean" };

/** The vanilla biome id the sea world's climate at a place looks like. */
export function biomeIdAt(seed, x, z) {
  const k = climate(seed, x, z).key;
  const e = elevation(seed, x, z);
  return e.land || e.depth <= 2 ? LAND[k] : SEA[k];
}
