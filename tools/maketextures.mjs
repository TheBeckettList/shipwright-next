// Writes the resource pack's textures (pack/RP/textures) from world/textures.js: the same tiles the
// sim reads. Every texture tiles exactly; water (8 frames, the breath) and prismarine (48, the 5D
// string's return) loop exactly, turned by the client's flipbook, at no cost to the world's scripts.
//
//   blocks     every block the sim's cultures, biomes and Therans use, under vanilla's file names
//              where it overrides vanilla (VANILLA_NAME: check in game), else under its own id
//   sails      each tradition's cloth: a weave and stripes from its own row of the golden line's
//              breath, a signature no other tradition shares
//   hulls      each wood's planking, for the boat models
//   fresco     the Therans' running spiral band
//   sheet      a contact sheet to look at (tools only)
//
//   node tools/maketextures.mjs [out dir] [sheet.png]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "./png.js";
import { breathTable } from "../core/field.js";
import { cuts, pieceAt, golden } from "../core/golden.js";
import { tileOf, framesOf, lookOf, facesOf, variantsOf, TEXTURE, DYE, SPEC } from "../world/textures.js";
import { TRADITIONS } from "../world/traditions.js";
import { SHIP_STORES } from "../world/ships.js";
import { LAND_BIOMES, SEA_BIOMES, BEACH } from "../world/biomes.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const N = TEXTURE.N;
const W = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "bamboo"];
// Bedrock's own file names for the blocks it draws (textures/blocks/<name>.png); anything else keeps its id
const OLD = { oak: "oak", spruce: "spruce", birch: "birch", jungle: "jungle", acacia: "acacia", dark_oak: "big_oak" };
const silver = (d) => (d === "light_gray" ? "silver" : d);
export const VANILLA_NAME = {
  "minecraft:water": "water_still_grey", "minecraft:stone": "stone", "minecraft:cobblestone": "cobblestone", "minecraft:sand": "sand", "minecraft:red_sand": "red_sand",
  "minecraft:gravel": "gravel", "minecraft:dirt": "dirt", "minecraft:clay": "clay", "minecraft:bricks": "brick", "minecraft:stone_bricks": "stonebrick", "minecraft:prismarine": "prismarine_rough",
  "minecraft:snow": "snow", "minecraft:ice": "ice", "minecraft:packed_ice": "ice_packed", "minecraft:calcite": "calcite", "minecraft:tuff": "tuff", "minecraft:mud_bricks": "mud_bricks",
  "minecraft:terracotta": "hardened_clay",
  ...Object.fromEntries(Object.entries(OLD).map(([w, o]) => [`minecraft:${w}_leaves`, `leaves_${o}`])),
  ...Object.fromEntries(Object.entries(OLD).map(([w, o]) => [`minecraft:${w}_planks`, `planks_${o}`])),
  ...Object.fromEntries(Object.entries(OLD).map(([w, o]) => [`minecraft:${w}_log`, `log_${o}`])),
  ...Object.fromEntries(Object.keys(DYE).map((d) => [`minecraft:${d}_wool`, `wool_colored_${silver(d)}`])),
  ...Object.fromEntries(Object.keys(DYE).map((d) => [`minecraft:${d}_terracotta`, `hardened_clay_stained_${silver(d)}`])),
  ...Object.fromEntries(Object.keys(DYE).map((d) => [`minecraft:${d}_glazed_terracotta`, `glazed_terracotta_${silver(d)}`])),
};
/** Every block the sim uses, plus the dyes' wools, terracottas and glazes (the cultures' colours). */
export function simBlocks() {
  const ids = new Set(["minecraft:water", "minecraft:prismarine", "minecraft:dirt_path", "minecraft:farmland", "minecraft:hay_block", "minecraft:stone_bricks", "minecraft:bricks", "minecraft:mud_bricks", "minecraft:calcite", "minecraft:glass", "minecraft:brain_coral_block", "minecraft:tube_coral_block", "minecraft:sponge", "minecraft:grass_block", "minecraft:basalt", "minecraft:deepslate", "minecraft:hay_block", "minecraft:bone_block", "minecraft:quartz_pillar", "minecraft:purpur_pillar", "minecraft:bamboo_block"]);
  for (const b of [...LAND_BIOMES, BEACH]) for (const id of [...b.wood, ...b.stone]) ids.add(id);
  for (const b of SEA_BIOMES) for (const id of b.sea) if (/coral|sand|gravel|clay|prismarine/.test(id)) ids.add(id);
  for (const w of W) { ids.add(`minecraft:${w}_planks`); ids.add(`minecraft:stripped_${w}_log`); if (w !== "bamboo") { ids.add(`minecraft:${w}_log`); ids.add(`minecraft:${w}_leaves`); } }
  for (const d of Object.keys(DYE)) for (const k of ["wool", "terracotta", "glazed_terracotta"]) ids.add(`minecraft:${d}_${k}`);
  for (const s of Object.values(SHIP_STORES)) for (const id of Object.values(s)) if (id && /planks|log/.test(id)) ids.add(id);
  return [...ids].filter((id) => id !== "minecraft:stripped_bamboo_log").sort();
}
// vanilla's own per-face names, where a block has faces
const FACE_NAME = {
  "minecraft:grass_block": { top: "grass_top", side: "grass_side_carried", bottom: "dirt" },
  "minecraft:sandstone": { top: "sandstone_top", side: "sandstone_normal", bottom: "sandstone_bottom" },
  ...Object.fromEntries(Object.entries(OLD).map(([w, o]) => [`minecraft:${w}_log`, { top: `log_${o}_top`, side: `log_${o}`, bottom: `log_${o}_top` }])),
};
const fileOf = (id, face = "side") => FACE_NAME[id]?.[face] ?? (VANILLA_NAME[id] ? VANILLA_NAME[id] + SUFFIX_OF(face) : `shipwright/${id.replace(/^\w+:/, "")}${SUFFIX_OF(face)}`);
const SUFFIX_OF = (face) => ({ side: "", top: "_top", bottom: "_bottom" })[face];

/** A texture's strip of frames (one tall image), as rgb. */
// vanilla tints these by biome from a grey base: the pack draws them grey (their light and shade kept), and the game colours them
const TINTED = (id, face) => (/_leaves$/.test(id) && !/cherry|azalea/.test(id)) || (id === "minecraft:grass_block" && face === "top");
function strip(id, face = "side", k = 0) {
  const n = framesOf(id), d = new Uint8Array(N * N * n * 3);
  for (let f = 0; f < n; f++) { const t = tileOf(id, f, face, k).rgb; if (TINTED(id, face)) { const g = new Uint8Array(t.length); let mx = 1; for (let i = 0; i < t.length; i += 3) mx = Math.max(mx, 0.3 * t[i] + 0.59 * t[i + 1] + 0.11 * t[i + 2]); for (let i = 0; i < t.length; i += 3) { const L = Math.min(255, Math.round(((0.3 * t[i] + 0.59 * t[i + 1] + 0.11 * t[i + 2]) / mx) * 230)); g[i] = g[i + 1] = g[i + 2] = L; } d.set(g, f * N * N * 3); } else d.set(t, f * N * N * 3); }   // given: luminance weights; vision: the grey's top
  return { w: N, h: N * n, d };
}
const SUFFIX = { side: "", top: "_top", bottom: "_bottom" };
// vision: each tradition's sailcloth (wool's own colours: undyed, and a dye)
const CLOTH = { norse: ["white", "red"], european: ["white", "blue"], birchbark: ["white", "brown"], pacific: ["yellow", "brown"], indian_ocean: ["white", "orange"],
  east_asian: ["orange", "brown"], japanese: ["white", "blue"], dugout: ["light_gray", "black"], shallow: ["white", "green"], arctic: ["white", "gray"] };
export function sails() {
  const rows = breathTable(N / 2), keys = Object.keys(TRADITIONS), outs = {};   // a Mobius loop of 8 cells: its breath's rows, one a tradition
  keys.forEach((k, i) => {
    const d = new Uint8Array(N * N * 3), row = rows[(i * 3) % rows.length], [base, dye] = (CLOTH[k] ?? ["white", "red"]).map((c) => tileOf(`minecraft:${c}_wool`, 0, "side", i));   // vision: rows three apart, so neighbours differ
    const panels = cuts(N, 5, 3, i * 2), dyed = panels.map((_, p) => row[(p * 3) % row.length] !== 0);   // sewn panels five and three wide; which are dyed, the tradition's row says
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const pc = pieceAt(x, panels), seam = pc.at === 0, src = dyed[pc.k] ? dye : base, o = (y * N + x) * 3, weather = 1 - 0.12 * Math.max(0, (y - N * 0.6) / (N * 0.4)) * (0.5 + golden(x + i));   // vision: the foot of the sail weathered, unevenly
      d.set([0, 1, 2].map((c2) => Math.round(src.rgb[o + c2] * weather * (seam ? 0.86 : 1))), o);   // vision: a seam's shade
    }
    outs[`sail_${k}`] = { w: N, h: N, d };
  });
  return outs;
}
export function hulls() { return Object.fromEntries(W.map((w) => [`hull_${w}`, { w: N, h: N, d: tileOf(`minecraft:${w}_planks`).rgb }])); }
export function fresco() {
  const d = new Uint8Array(N * N * 3), blue = tileOf("minecraft:blue_glazed_terracotta").rgb, red = tileOf("minecraft:red_terracotta").rgb;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const o = (y * N + x) * 3; d.set((y < 2 || y > 13 ? red : blue).subarray(o, o + 3), o); }   // vision: red borders, the spiral band between
  return { fresco_spiral: { w: N, h: N, d } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? path.join(root, "pack/RP/textures"), sheetFile = process.argv[3];
  fs.rmSync(out, { recursive: true, force: true });
  const ids = simBlocks(), flip = [];
  const variations = {};
  for (const id of ids) for (const face of facesOf(id)) for (let k = 0; k < variantsOf(id); k++) {
    const name = fileOf(id, face) + (k ? `_v${k}` : ""), f = path.join(out, "blocks", name + ".png"); fs.mkdirSync(path.dirname(f), { recursive: true });
    const s = strip(id, face, k); fs.writeFileSync(f, encode(s.w, s.h, s.d, 3));
    if (variantsOf(id) > 1) (variations[fileOf(id, face)] ??= []).push({ path: `textures/blocks/${name}`, weight: 1 });
    if (k || face !== "side") continue;
    if (framesOf(id) > 1) flip.push({ flipbook_texture: `textures/blocks/${fileOf(id)}`, atlas_tile: fileOf(id), ticks_per_frame: id.endsWith("water") ? 2 : 1, blend_frames: true });   // vision: water a frame every two ticks; the string a frame a tick
  }
  fs.mkdirSync(path.join(out, "entity/shipwright"), { recursive: true });
  const ent = { ...sails(), ...hulls(), ...fresco() };
  for (const [k, t] of Object.entries(ent)) fs.writeFileSync(path.join(out, "entity/shipwright", k + ".png"), encode(t.w, t.h, t.d, 3));
  fs.writeFileSync(path.join(out, "flipbook_textures.json"), JSON.stringify(flip, null, 1));
  // the variants, as terrain_texture.json "variations" (merge into the pack's terrain_texture.json under each block's atlas key: check the keys in game)
  fs.writeFileSync(path.join(out, "variations.json"), JSON.stringify(variations, null, 1));
  fs.writeFileSync(path.join(out, "SPEC.md"), "# Texture spec (generated from world/textures.js)\n\n| Family | Blocks | Kind | Golden device |\n|---|---|---|---|\n" + SPEC.map((x) => `| ${x.family} | ${x.blocks} | ${x.kind} | ${x.device} |`).join("\n") + "\n");
  console.log(`wrote ${ids.length} block textures (${flip.length} animated) and ${Object.keys(ent).length} entity textures to ${out}`);
  if (sheetFile) {   // every tile 2 x 2 (so a seam would show) at 3x, grouped by family
    const order = ids.slice().sort((a, b) => lookOf(a).family.localeCompare(lookOf(b).family) || a.localeCompare(b)), Z = 3, cell = 2 * N * Z + 4, cols = 12;   // vision: the sheet's scale and columns
    const all = [...order.map((id) => tileOf(id, 0).rgb), ...Object.values(ent).map((t) => t.d)], rows = Math.ceil(all.length / cols), Wd = cols * cell, Hd = rows * cell, img = new Uint8Array(Wd * Hd * 3).fill(250);
    all.forEach((rgb, k) => { const ox = (k % cols) * cell, oy = Math.floor(k / cols) * cell; for (let y = 0; y < 2 * N * Z; y++) for (let x = 0; x < 2 * N * Z; x++) { const sx = Math.floor(x / Z) % N, sy = Math.floor(y / Z) % N, o = (sy * N + sx) * 3; img.set(rgb.subarray(o, o + 3), ((oy + y) * Wd + ox + x) * 3); } });
    fs.writeFileSync(sheetFile, encode(Wd, Hd, img, 3));
    console.log(`sheet ${sheetFile}: ${all.length} tiles`);
  }
}
