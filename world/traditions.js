// inherency: data (a vision table: every number in it is a choice, stated where it is)
// Pure data. The ten seafaring traditions of the old mod, as the world they came from: each one's
// home climate, its boat woods, how it lived. A people takes the tradition whose world its own most
// resembles (peoples.js), so traditions turn up where their world is, not where someone put them.
// Boats are the old mod's plans for each tradition (to be rebuilt on core/boat.js).
//
//   T, M     the home's temperature (C) and moisture, the middle of the range it lived in
//   woods    the boat woods it built from (vanilla logs)
//   living   how it fed itself, mostly
const near = (v, mid, half) => Math.max(0, 1 - Math.abs(v - mid) / half);
const has = (p, ids) => ids.some((w) => p.woods.includes(w)) ? 1 : 0;
const fitOf = (t) => (p) => near(p.T, t.T, 10) + near(p.M, t.M, 0.4) + 1.2 * has(p, t.woods) + (p.living === t.living ? 0.5 : 0) + (t.biome && p.biomes.some((b) => t.biome.test(b)) ? 0.8 : 0);   // vision: woods weigh most, then climate, then life

const T = (o) => ({ ...o, fit: fitOf(o) });
export const TRADITIONS = {
  norse: T({ name: "Norse", T: 4, M: 0.7, woods: ["minecraft:spruce_log"], living: "fishers", boats: ["faering", "longship", "skeid"], biome: /taiga/ }),
  european: T({ name: "Northern European", T: 11, M: 0.65, woods: ["minecraft:oak_log"], living: "farmers", boats: ["rowboat", "cog", "carrack"], biome: /forest|plains/ }),
  birchbark: T({ name: "Bark canoe", T: 6, M: 0.6, woods: ["minecraft:birch_log"], living: "fishers", boats: ["bark_canoe", "freight_canoe"], biome: /birch/ }),
  pacific: T({ name: "Pacific", T: 27, M: 0.75, woods: ["minecraft:jungle_log"], living: "fishers", boats: ["outrigger", "voyaging_canoe", "drua"], biome: /jungle|beach/ }),
  indian_ocean: T({ name: "Indian Ocean", T: 27, M: 0.3, woods: ["minecraft:acacia_log"], living: "herders", boats: ["sewn_boat", "dhow", "baghlah"], biome: /savanna|desert/ }),
  east_asian: T({ name: "East Asian", T: 22, M: 0.8, woods: ["minecraft:bamboo"], living: "farmers", boats: ["sampan", "junk", "fuchuan"], biome: /bamboo/ }),
  japanese: T({ name: "Japanese", T: 15, M: 0.7, woods: ["minecraft:cherry_log"], living: "fishers", boats: ["wasen", "bezaisen", "shuinsen"], biome: /cherry/ }),
  dugout: T({ name: "Great dugout", T: 10, M: 0.9, woods: ["minecraft:dark_oak_log"], living: "fishers", boats: ["dugout", "war_canoe"], biome: /dark_forest/ }),
  shallow: T({ name: "Shallow water", T: 26, M: 0.85, woods: ["minecraft:mangrove_log"], living: "fishers", boats: ["punt", "flatboat"], biome: /mangrove|swamp/ }),
  arctic: T({ name: "Arctic", T: -10, M: 0.3, woods: [], living: "fishers", boats: ["kayak", "umiak"], biome: /snowy|ice|frozen/ }),
};
