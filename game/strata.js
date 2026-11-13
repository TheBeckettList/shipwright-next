// Pure. What lies under the ground, from the top to the bedrock: not vanilla's noise caves and scattered
// ores, but a column a geologist would recognise, from three rules:
//
//   provinces  every chunk's rock is one of a few provinces, read off what is already there: the sea
//              floor (sediment over basalt: ocean crust), the volcanic islands (Thera's cone and every
//              steep high island in the tropics: tuff and basalt over blackstone), limestone country
//              (warm and wet: calcite beds, which dissolve into caves), dry country (sandstone), the
//              badlands (banded terracotta), the cold (permafrost), the wetlands (mud over clay), and
//              the temperate default (stone bedded with andesite, diorite and granite)
//   beds       below the soil the beds lie flat, as sediments are laid: a stack whose thicknesses run by
//              the Fibonacci word (thick, thin, thick, thick, thin, ...: quasi-periodic, as real
//              cyclothems are), each bed's rock dealt by the golden sequence from the province's own,
//              gently folded (a long, low swell of the noise), down to vanilla's deepslate line
//   ores       ore forms where fluids meet a change of rock: at the beds' contacts, never scattered.
//              Which ores a place has is world/biomes.js ORES (the deeper veins come with the higher
//              rock: an island's height decides what's in it)
//   caves      three kinds, each where its process puts it: karst tubes in limestone at the water table
//              (just under the sea's level, half flooded), lava tubes in volcanic rock a few blocks under
//              the surface (winding, the roof a few blocks thick), and none elsewhere
import { FIB, PHI, word, golden } from "../core/golden.js";
import { fbm, hashAt } from "../core/noise.js";
import { ORES } from "../world/biomes.js";
import { lodeOf } from "../world/homesites.js";

export const DEEPSLATE = 0;                    // given: vanilla's deepslate line
const FOLD = FIB[5], FOLD_SCALE = FIB[10];     // derived: beds fold up to eight blocks over 89-block swells
const THICK = FIB[4], THIN = FIB[3];           // derived: a bed is five blocks or three (the word's two letters)

// the provinces: their soil (blocks under the top, which follow the ground), their beds (flat), their deep rock
export const PROVINCES = {
  seafloor:  { soil: [[FIB[3], "sed"]], beds: ["minecraft:smooth_basalt", "minecraft:basalt", "minecraft:smooth_basalt", "minecraft:tuff"], deep: "minecraft:deepslate" },   // ocean crust under its sediment
  volcanic:  { soil: [[FIB[2], "minecraft:tuff"]], beds: ["minecraft:tuff", "minecraft:basalt", "minecraft:smooth_basalt", "minecraft:tuff", "minecraft:blackstone"], deep: "minecraft:blackstone", tubes: true },
  limestone: { soil: [[FIB[3], "minecraft:dirt"]], beds: ["minecraft:calcite", "minecraft:calcite", "minecraft:stone", "minecraft:calcite", "minecraft:dripstone_block"], deep: "minecraft:deepslate", karst: true },
  dry:       { soil: [[FIB[4], "minecraft:sandstone"]], beds: ["minecraft:sandstone", "minecraft:stone", "minecraft:sandstone", "minecraft:granite"], deep: "minecraft:deepslate" },
  badlands:  { soil: [[FIB[2], "minecraft:red_sandstone"]], beds: ["minecraft:orange_terracotta", "minecraft:hardened_clay", "minecraft:yellow_terracotta", "minecraft:red_terracotta", "minecraft:white_terracotta", "minecraft:brown_terracotta", "minecraft:light_gray_terracotta"], deep: "minecraft:deepslate", thin: true },
  cold:      { soil: [[FIB[3], "minecraft:packed_ice"], [FIB[2], "minecraft:gravel"]], beds: ["minecraft:stone", "minecraft:andesite", "minecraft:stone", "minecraft:diorite"], deep: "minecraft:deepslate" },
  wetland:   { soil: [[FIB[3], "minecraft:mud"], [FIB[3], "minecraft:clay"], [FIB[2], "minecraft:gravel"]], beds: ["minecraft:stone", "minecraft:clay", "minecraft:andesite", "minecraft:stone"], deep: "minecraft:deepslate" },
  temperate: { soil: [[FIB[3], "minecraft:dirt"]], beds: ["minecraft:stone", "minecraft:andesite", "minecraft:stone", "minecraft:diorite", "minecraft:stone", "minecraft:granite"], deep: "minecraft:deepslate" },
};   // vision: each province's rock, after the real thing, in vanilla's blocks
const VOLCANIC_RISE = FIB[9];                  // derived: an island this high (55 blocks) in the tropics is a volcano
const TROPIC = 23.44;                          // given: the tropics' latitude

/** The province of a chunk, from its climate and its ground. */
export function provinceOf(cl, top, thera) {
  if (top < 62) return "seafloor";
  if (thera) return "volcanic";
  const b = cl.biome?.id ?? "plains";
  if (Math.abs(cl.lat) < TROPIC && cl.h > VOLCANIC_RISE) return "volcanic";
  if (b === "badlands") return "badlands";
  if (b === "desert" || b === "savanna" || b === "beach") return "dry";
  if (b === "swamp" || b === "mangrove_swamp") return "wetland";
  if (cl.T < 0 || /snowy|ice|frozen/.test(b)) return "cold";
  if (cl.T > 18 && cl.M > 0.6) return "limestone";
  return "temperate";
}

// the stack of beds: band k from the sea's level downward, its thickness by the word, its rock by the golden sequence
const BANDS = (() => {
  const out = []; let y = 62;
  for (let k = 0; y > -64 - FOLD; k++) { const t = word(k) ? THICK : THIN; out.push({ k, top: y, bot: y - t + 1, g: golden(k) }); y -= t; }
  const up = []; y = 63;
  for (let k = 1; y < 330; k++) { const t = word(k + 1) ? THICK : THIN; up.push({ k: -k, top: y + t - 1, bot: y, g: golden(-k + 1000) }); y += t; }   // above the sea's level, the same law upward
  return [...up.reverse(), ...out];
})();
const thinBands = (() => { const out = []; for (let y = 330, k = 0; y > -80; k++) { const t = word(k) ? 2 : 1; out.push({ k, top: y, bot: y - t + 1, g: golden(k) }); y -= t; } return out; })();   // derived: the badlands' bands, two blocks or one

export const foldAt = (x, z) => Math.round(FOLD * 2 * (fbm(x / FOLD_SCALE, z / FOLD_SCALE, 307, 2) - 0.5));
// ores: at each contact, veins round centres on an eight-block lattice (one a lattice cell and contact, jittered so no vein
// crosses its cell): the centre's ore is drawn by each ore's chance there, f (its target over what a chunk's centres and
// contacts give) times its depth tent times its rock's richness; a column is in the vein within the vein's radius
const LATTICE = FIB[5], MEAN_BED = THICK / PHI + THIN / PHI ** 2, CENTRES = (16 / LATTICE) ** 2;   // derived: the lattice's spacing, a bed's mean (the word's letters by their shares), the centres a chunk (sixteen blocks a side, given)
const ORE_F = ORES.map((o) => (o.target * MEAN_BED) / (CENTRES * o.vein * ((o.hi - o.lo) / 2)));   // derived: so a chunk of its best rock averages its target
const tent = (o, y) => (y < o.lo || y > o.hi ? 0 : y <= o.peak ? (y - o.lo) / Math.max(1, o.peak - o.lo) : (o.hi - y) / Math.max(1, o.hi - o.peak));
const RADIUS = ORES.map((o) => Math.sqrt(o.vein / Math.PI));   // derived: a vein a disc of its blocks
const JITTER = LATTICE / 2 - Math.ceil(Math.max(...RADIUS)) - 1;   // derived: the centre wanders as far as keeps its vein in its cell
/** The ore at a contact for a column, or null. */
function oreAt(x, z, c, prov, top, pipe) {
  const gx = Math.floor(x / LATTICE), gz = Math.floor(z / LATTICE);
  const cx = gx * LATTICE + LATTICE / 2 + (2 * hashAt(gx, gz, 341 + c) - 1) * JITTER, cz = gz * LATTICE + LATTICE / 2 + (2 * hashAt(gx, gz, 343 + c) - 1) * JITTER, d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);   // vision: the centre's keys
  if (d > RADIUS[0] + 1) return null;
  let r = hashAt(gx, gz, 311 + c);   // vision: the draw's key
  for (let k = 0; k < ORES.length; k++) {
    const o = ORES[k]; if (o.pipes && !pipe) continue; if (o.high && top - GIVEN_SEA < o.high) continue;
    const q = ORE_F[k] * tent(o, c) * (o.rich[prov] ?? o.rich.default) * (o.pipes ? PIPE.BOOST : 1);
    if (r < q) return d <= RADIUS[k] ? o.id : null;
    r -= q;
  }
  return null;
}
// the diamond pipes: one to each 13 x 13 chunks of high ground, a column of deep rock 3 to 5 blocks across from the floor
// nearly to the surface; diamonds form only on its walls
export const PIPE = Object.freeze({ EVERY: FIB[6] * 16, MIN_TOP: FIB[6], ROCK: "minecraft:blackstone", BOOST: FIB[6] * FIB[6] });   // derived: thirteen chunks (sixteen blocks, given) a pipe; ground thirteen over the sea; the pipe's walls carry the whole area's diamonds (13 x 13)
const GIVEN_SEA = 62;   // given: the sea's level
/** Is (x, z) a pipe's wall (1), its core (2), or neither (0)? */
export function pipeAt(x, z) {
  const gx = Math.floor(x / PIPE.EVERY), gz = Math.floor(z / PIPE.EVERY);
  const cx = (gx + 0.5) * PIPE.EVERY + (hashAt(gx, gz, 351) - 0.5) * (PIPE.EVERY / PHI), cz = (gz + 0.5) * PIPE.EVERY + (hashAt(gx, gz, 353) - 0.5) * (PIPE.EVERY / PHI), r = FIB[3] / 2 + hashAt(gx, gz, 355) * (FIB[4] - FIB[3]) / 2;   // vision: the pipe's keys; 3 to 5 across
  const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
  return d > r ? 0 : d > r - 1 ? 1 : 2;
}
const deepOre = (id) => id.replace("minecraft:", "minecraft:deepslate_");
const FLOOR_BED = -58;   // given: the deepest a bed runs (vanilla's deepest ores, a few blocks over the bedrock)
const DEEP_BEDS = ["minecraft:deepslate", "minecraft:deepslate", "minecraft:tuff", "minecraft:deepslate"];   // vision: the deep beds, deepslate with tuff between

/**
 * A column's rock: ops to lay it, bottom to its top block (exclusive: the top and the under-soil the ground
 * module gives). col: { x, z, top, under }, rise: the island's height (blocks, for the ores it has).
 * Returns { segs: [[y0, y1, id]], sets: [[y, id]], air: [[y0, y1]], water: [[y0, y1]] }.
 */
export function columnRock(col, prov, rise, sed) {
  const P = PROVINCES[prov], segs = [], sets = [], air = [], water = [];
  const f = foldAt(col.x, col.z), deep = DEEPSLATE + f;
  // the soil, following the ground, under the top block
  let y = col.top - 1;
  for (const [t, id0] of P.soil) { const id = id0 === "sed" ? sed : id0; if (t > 0) { segs.push([y - t + 1, y, id]); y -= t; } }
  const bedTop = y;
  // the beds, flat (folded), down to the deepslate line, then the deep rock
  const bands = P.thin ? thinBands : BANDS, beds = P.beds;
  let contacts = [];
  for (const b of bands) {
    const t = b.top + f, bo = b.bot + f;
    if (bo > bedTop) continue; if (t < FLOOR_BED) break;
    const y1 = Math.min(t, bedTop), y0 = Math.max(bo, FLOOR_BED); if (y1 < y0) continue;
    segs.push([y0, y1, y1 <= deep ? DEEP_BEDS[Math.floor(b.g * DEEP_BEDS.length)] : beds[Math.floor(b.g * beds.length)]]); contacts.push(y0);   // below the deepslate line the beds go on in deep rock
  }
  segs.push([-63, Math.min(FLOOR_BED - 1, bedTop), P.deep]);
  const pipe = col.top >= GIVEN_SEA + PIPE.MIN_TOP ? pipeAt(col.x, col.z) : 0;
  if (pipe === 2) segs.push([FLOOR_BED, Math.min(bedTop, col.top - FIB[5]), PIPE.ROCK]);   // the pipe's core: deep rock to eight under the ground
  // ores at the contacts
  for (const [y, id] of lodeOf(col.x, col.z) ?? []) if (y < bedTop) sets.push([y, y <= deep ? deepOre(id) : id]);   // a homeport's lode (world/homesites.js)
  if (pipe !== 2) for (const c of contacts) {
    const o = oreAt(col.x, col.z, c, prov, col.top, pipe === 1); if (o) sets.push([c, c <= deep ? deepOre(o) : o]);
  }
  // caves
  if (P.karst && col.top > 62 + FIB[5]) {   // at the water table: three high, the lowest block flooded
    const n = fbm(col.x / FIB[9], col.z / FIB[9], 331, 3);
    if (Math.abs(n - 0.5) < 0.025) { water.push([59, 59]); air.push([60, 62]); }   // vision: a tube's width, as a band of the noise
  }
  if (P.tubes && col.top > 62 + FIB[6]) {   // under the surface, three high
    const n = fbm(col.x / FIB[8], col.z / FIB[8], 337, 3), d = col.top - FIB[5];
    if (Math.abs(n - 0.5) < 0.03) air.push([d - 1, d + 1]);   // vision: a tube's width
  }
  return { segs, sets, air, water };
}
