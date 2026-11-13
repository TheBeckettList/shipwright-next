// The sea world's life. Its dimension spawns nothing of its own, so it's brought in near each player,
// a few at a time and never past a cap, by the biome a spot lies in (biomes.js): fish, squid,
// dolphins and turtles by the water; the animals a crew needs on the islands; and at night what
// vanilla's night brings: zombies, skeletons, spiders, creepers, endermen (for their pearls), and
// each biome's own (husks, strays, witches, slimes, drowned and bogged). Guardians keep monuments.
import { rand } from "./noise.js";
import { SEA_LEVEL } from "./terrain.js";
import { columnAt } from "./lattice.js";
import { BIOMES, hostilesOf } from "./biomes.js";
import { monumentsIn } from "./structures.js";

export const CAPS = { water: 10, land: 8, night: 10, guardian: 6 };
const REACH = 40, NEAR = 16;

/** Where and what to bring in near a place (pure, so the lab can sim it). night: 0..1. */
export function pickLife(seed, x, z, t, night = 0) {
  const a = rand(Math.floor(x), Math.floor(z), t, seed, 101) * Math.PI * 2;
  const d = NEAR + rand(Math.floor(x), Math.floor(z), t, seed, 102) * (REACH - NEAR);
  const px = Math.floor(x + Math.cos(a) * d), pz = Math.floor(z + Math.sin(a) * d);
  const p = columnAt(seed, px, pz);                         // the lattice the ground was laid from
  const B = BIOMES[p.biome];
  const k = rand(px, pz, t, seed, 103);
  if (p.land) {
    if (night > 0.5 && k < 0.7) {
      const list = hostilesOf(p.biome);
      if (!list.length) return null;
      return { at: { x: px + 0.5, y: p.top + 1, z: pz + 0.5 }, id: list[Math.floor(rand(px, pz, t, seed, 104) * list.length)], kind: "night", biome: p.biome };
    }
    if (!B.animals?.length) return null;
    return { at: { x: px + 0.5, y: p.top + 1, z: pz + 0.5 }, id: B.animals[Math.floor(k * B.animals.length)], kind: "land", biome: p.biome };
  }
  if (p.depth < 3) return null;
  if (night > 0.5 && k < 0.12) return { at: { x: px + 0.5, y: p.top + 1, z: pz + 0.5 }, id: "minecraft:drowned", kind: "night", biome: p.biome };
  const list = B.life ?? ["minecraft:cod"];
  return { at: { x: px + 0.5, y: Math.max(p.top + 1, SEA_LEVEL - 2 - Math.floor(k * 4)), z: pz + 0.5 }, id: list[Math.floor(k * list.length)], kind: "water", biome: p.biome };
}

const WATER_LIFE = /cod|salmon|squid|tropical_fish|pufferfish|dolphin|turtle/;
const NIGHT_LIFE = /zombie|skeleton|spider|creeper|enderman|husk|stray|witch|slime|drowned|bogged|magma_cube/;

export function life(dim, seed, players, timeOfDay = 6000) {
  const t = Math.floor(Date.now() / 5000);
  const night = timeOfDay > 13000 && timeOfDay < 23000 ? 1 : 0;
  for (const p of players) {
    let near = [];
    try {
      near = dim.getEntities({ location: p.location, maxDistance: REACH + 16 }).filter((e) => e.typeId !== "minecraft:player" && !e.typeId.startsWith("shipwright:") && e.typeId !== "minecraft:item");
    } catch {
      continue;
    }
    const count = { water: 0, land: 0, night: 0, guardian: 0 };
    for (const e of near) count[/guardian/.test(e.typeId) ? "guardian" : NIGHT_LIFE.test(e.typeId) ? "night" : WATER_LIFE.test(e.typeId) ? "water" : "land"]++;
    // guardians round a monument close by
    for (const m of monumentsIn(seed, p.location.x - 48, p.location.z - 48, p.location.x + 48, p.location.z + 48)) {
      if (count.guardian >= CAPS.guardian) break;
      try {
        dim.spawnEntity("minecraft:guardian", { x: m.x + ((t * 7) % 21) - 10 + 0.5, y: m.floor + 6, z: m.z + ((t * 11) % 21) - 10 + 0.5 });
        count.guardian++;
      } catch {
        /* not loaded */
      }
    }
    const pick = pickLife(seed, p.location.x, p.location.z, t + p.id.length, night);
    if (!pick || count[pick.kind] >= CAPS[pick.kind]) continue;
    try {
      const b = dim.getBlock({ x: Math.floor(pick.at.x), y: Math.floor(pick.at.y) - 1, z: Math.floor(pick.at.z) });
      if (!b || (pick.kind !== "water" && /air|water/.test(b.typeId))) continue;          // not laid yet
      dim.spawnEntity(pick.id, pick.at);
    } catch {
      /* not loaded */
    }
  }
}
