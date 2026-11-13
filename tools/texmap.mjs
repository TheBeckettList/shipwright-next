// Draws a people's town from above, block by block, through the resource pack's own textures
// (world/textures.js): what a player flying over would see, from the same math as the town's plan.
// Each block's top is one texel lookup; water is drawn at the frame the clock gives.
//   node tools/texmap.mjs <people key|tradition> <month> out.png [pixels a block] [tick]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
import { peoples } from "../world/peoples.js";
import { loop } from "../world/history.js";
import { economy } from "../world/economy.js";
import { layout, wallKeys, LAYOUT } from "../world/settlement.js";
import { texel, framesOf, variantAt } from "../world/textures.js";
import { encode } from "./png.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const [key, mo = "12", out = "tex_town.png", pxs = "4", tk = "0"] = process.argv.slice(2);
loadMap();
const L = loop(), p = peoples().byKey.get(key) ?? L.find((q) => q.tradition === key), i = L.indexOf(p), m = Number(mo), PX = Number(pxs), T = Number(tk);
const R0 = economy(Math.max(1, m)), s = R0.state[i], T0 = layout(p, s.site, s.plan, s.built, { memory: s.memory });
const B = p.build, stone = p.stones[0] ?? "minecraft:stone", grass = p.T < -2 ? "minecraft:snow" : p.biomes?.includes?.("desert") ? "minecraft:sand" : "minecraft:grass_block";   // vision: cold enough for snow
const crop = "minecraft:farmland", P = LAYOUT.PLOT;
const TOP = {   // what each district's plots show from above: roofs where it builds, its ground where it works
  homes: [B.roof.cover, B.frame.wall], civic: [B.roof.cover, stone.replace("cobblestone", "stone_bricks")], market: [stone, B.frame.wall], crafts: [B.roof.cover, B.frame.post],
  farms: [crop, "minecraft:hay_block"], pasture: [grass, grass], harbour: [B.frame.wall, B.frame.wall],
};
let ext = 6; for (const q of [...T0.owner.keys(), ...T0.walls]) ext = Math.max(ext, Math.abs(q.i) + 3, Math.abs(q.j) + 3);   // vision: the margin, in plots
const R = Math.min(LAYOUT.REACH, ext), blocks = (2 * R + 1) * P, n = blocks * PX, img = new Uint8Array(n * n * 3);
const wk = wallKeys(T0), gk = new Set(T0.gates.map((q) => `${q.i},${q.j}`)), byIJ = new Map(T0.grid.plots.map((q) => [`${q.i},${q.j}`, q]));
const frame = (id) => T % framesOf(id);
for (let bz = 0; bz < blocks; bz++) for (let bx = 0; bx < blocks; bx++) {
  const pi = Math.floor(bx / P) - R, pj = Math.floor(bz / P) - R, k = `${pi},${pj}`, q = byIJ.get(k), lx = bx % P, lz = bz % P;
  let id = q?.water ? "minecraft:water" : grass;
  const d = q && T0.owner.get(q);
  let lit = 1;
  if (d) {
    const [roof, edge] = TOP[d], built = /homes|civic|crafts|market/.test(d);
    id = lx === 0 || lz === 0 ? (built ? "minecraft:dirt_path" : edge) : roof;   // a lane between built plots
    if (built && id === roof) lit = lz < P / 2 ? 1.08 : 0.78;   // vision: a roof's two slopes, lit from the north
    if (d === "farms" && lx % 2 === 1) id = "minecraft:water";   // farms keep a ditch
  }
  if (q && !q.water && !d && q.h > 8) id = stone;   // vision: high ground shows its rock
  if (wk.has(k)) id = gk.has(k) && (lx === 1 || lx === 2 || lz === 1 || lz === 2) ? B.frame.post : stone.replace("gravel", "cobblestone");   // a gate's posts in the wall's stone
  for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
    let c = texel(id, (x + 0.5) / PX, (y + 0.5) / PX, frame(id), PX, "top", variantAt(id, bx, 0, bz));
    if (id === "minecraft:water") c = [c[0] * 0.25, c[1] * 0.45, c[2] * 0.9];   // the biome's water tint, as the game applies it (vision: an ocean's blue)
    if (id === grass && grass === "minecraft:grass_block") c = [c[0] * 0.75, c[1] * 1.0, c[2] * 0.55];   // vision: the grass tint
    c = c.map((v) => v * lit);
    img.set(c.map((v) => Math.max(0, Math.min(255, Math.round(v)))), ((bz * PX + y) * n + bx * PX + x) * 3);
  }
}
fs.writeFileSync(out, encode(n, n, img, 3));
console.log(`${p.key} (${p.tradition}) month ${m}: ${blocks} x ${blocks} blocks at ${PX} px a block, tick ${T} -> ${out}`);
