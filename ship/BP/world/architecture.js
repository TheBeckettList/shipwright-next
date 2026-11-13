// Pure. How a people builds, from what it has and the weather it lives in. A grammar, not a
// catalogue: each choice is the answer to one question the world asks, and the build sim
// (lab/build.js) draws buildings from the answers. Every block it names comes from the people's
// own resources (or the vanilla way of working them: logs to planks, mud to mud bricks, clay to
// bricks), so the vanilla lens can trace any block back to a chunk that gives it.
//
//   frame    timber where wood is plenty; stone where wood is short and stone is to hand; mud
//            brick where it's hot and there's mud; snow and ice past the tree line
//   roof     its pitch from the rain and snow (steep sheds water, flat keeps cool where it's dry);
//            its cover from what grows: turf in the cold wet north, thatch where there's grain
//            straw, tile where clay and a farming surplus allow, the frame's own wood otherwise
//   raised   on piles where the land floods (mangrove, marsh) or the tide runs high on flat shores
//   open     open-sided where it's hot and wet, to let the air through
//   mass     thick walls against the cold, and against the heat where it's dry
//   faces    fishers to the water; farmers to the sun (south in the north, north in the south);
//            every door to the lee of the belt's wind
//   guard    raiders: a palisade and a lookout; wary: a wall; traders: a market and a warehouse
//   set      the buildings their living needs
const id = (s) => `minecraft:${s}`;
const woodName = (log) => log.replace(/^minecraft:/, "").replace(/_log$/, "");

export function architecture(p) {
  const wood = p.woods[0] ? woodName(p.woods[0]) : null;
  const hotDry = p.T > 22 && p.M < 0.3;   // vision: the climate's bands for building
  const stone = p.stones.find((s) => /^minecraft:(stone|cobblestone|mossy_cobblestone|andesite|calcite)$/.test(s)) ?? (hotDry ? p.stones.find((s) => /sandstone/.test(s)) : null) ?? null;   // inland rock; beach sand only where it's the country's stone
  const mud = p.stones.includes("minecraft:mud"), clay = p.stones.includes("minecraft:clay") || p.biomes.some((b) => /swamp|mangrove/.test(b));
  const snowy = p.T < 0, hot = p.T > 22, dry = p.M < 0.3, wet = p.M > 0.65;   // vision: the climate's bands for building
  const bamboo = wood === "bamboo";
  const planks = wood ? id(bamboo ? "bamboo_planks" : `${wood}_planks`) : null;
  const log = wood ? id(bamboo ? "bamboo_block" : `${wood}_log`) : null;

  let frame;
  if (wood && p.timber >= 0.3) frame = { kind: "timber", post: log, wall: planks };   // vision: a third of the land wooded is timber country
  else if (hot && mud) frame = { kind: "mud brick", post: log ?? id("mud_bricks"), wall: id("mud_bricks") };
  else if (stone) frame = { kind: "stone", post: log ?? stone, wall: stone === id("stone") ? id("cobblestone") : stone };
  else if (snowy) frame = { kind: "snow and ice", post: id("packed_ice"), wall: id("snow") };
  else frame = { kind: "timber", post: log ?? id("oak_log"), wall: planks ?? id("oak_planks") };

  const pitch = snowy || p.M > 0.7 ? "steep" : p.M > 0.4 ? "pitched" : "flat";       // vision: the rain's bands
  let cover;
  if (p.T < 8 && wet && p.timber < 0.6) cover = id("moss_block");                     // turf   // vision: the climate's bands for building
  else if (p.crops.includes(id("wheat")) && p.T > 12) cover = id("hay_block");        // thatch   // vision: the climate's bands for building
  else if (clay && p.living === "farmers" && p.capacity / p.chunks > 0.7) cover = id("brick_block");   // tile, from clay and a surplus   // vision: the climate's bands for building
  else if (pitch === "flat") cover = frame.wall;
  else cover = planks ?? frame.wall;

  const raised = p.biomes.some((b) => /mangrove|swamp/.test(b));
  const open = hot && p.M > 0.6;   // vision: the climate's bands for building
  const mass = snowy || (hot && dry) ? 2 : 1;
  const sun = p.lat >= 0 ? "south" : "north";
  const faces = p.living === "fishers" ? "water" : p.living === "farmers" ? sun : "water";
  const guard = { raiders: "palisade and lookout", wary: "wall", peaceful: "none", traders: "market and warehouse" }[p.temper];
  const set = {
    fishers: ["boathouse", "net racks", "smokehouse"],
    farmers: ["barn", "granary", "fields"],
    herders: ["pens", "byre", "shearing shed"],
  }[p.living].concat(p.temper === "raiders" ? ["long hall"] : p.temper === "traders" ? ["warehouse", "market"] : []);
  return { frame, roof: { pitch, cover }, raised, open, mass, faces, lee: true, guard, set };
}
