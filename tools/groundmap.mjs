// The ground as the game lays it, from above, a pixel a block: each column's top block and what grows
// on it (game/ground.js), so the biomes' edges can be seen at the scale a player walks them.
//   node tools/groundmap.mjs find                 list chunks where a desert or beach meets other ground
//   node tools/groundmap.mjs <cx> <cz> <r> out.png [px]   the square of chunks round (cx, cz)
import fs from "node:fs";
import { loadMap } from "../world/load.js";
import { climateAt } from "../world/climate.js";
import { chunkColumns, treeAt, riverLifeAt, SEA } from "../game/ground.js";
import { map } from "../world/map.js";
import { encode } from "./png.js";
loadMap();
const [a, b, r = "6", out = "ground.png", pxs = "2"] = process.argv.slice(2);
if (a === "find") {
  const m = map(), hits = [];
  for (let cz = 0; cz < m.h; cz += 3) for (let cx = 0; cx < m.w; cx += 3) {
    const c = climateAt(cx, cz); if (c.h <= 0 || c.biome?.id !== "desert") continue;
    const ids = new Set([[4, 0], [-4, 0], [0, 4], [0, -4]].map(([i, j]) => climateAt(cx + i, cz + j).biome?.id));
    if (ids.size > 1) hits.push(`${cx} ${cz} ${[...ids].join(",")}`);
  }
  console.log(hits.slice(0, 40).join("\n"), `\n${hits.length} found`);
  process.exit(0);
}
const CC = { "minecraft:grass_block": [104, 160, 60], "minecraft:sand": [222, 206, 150], "minecraft:sandstone": [214, 196, 140], "minecraft:red_sand": [190, 100, 40], "minecraft:podzol": [110, 80, 40],
  "minecraft:coarse_dirt": [130, 96, 64], "minecraft:moss_block": [80, 120, 40], "minecraft:mud": [70, 60, 60], "minecraft:gravel": [140, 134, 130], "minecraft:stone": [125, 125, 125],
  "minecraft:snow": [240, 244, 250], "minecraft:packed_ice": [150, 180, 230], "minecraft:dirt": [134, 96, 66], "minecraft:orange_terracotta": [160, 84, 36], "minecraft:clay": [160, 166, 178], "minecraft:red_sandstone": [180, 96, 36], "minecraft:calcite": [225, 225, 220], "minecraft:hardened_clay": [150, 90, 66] };   // vision: a flat colour a block
const CX = Number(a), CZ = Number(b), R = Number(r), PX = Number(pxs), N = (2 * R + 1) * 16, img = new Uint8Array(N * PX * N * PX * 3);
for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
  const plan = chunkColumns(CX + dx, CZ + dz);
  for (const c of plan.cols) {
    let col = c.top <= SEA ? [50, 96, 190] : CC[c.topId] ?? [255, 0, 255];
    if (c.top <= SEA) { const d = SEA - c.top; col = col.map((v, k) => Math.round(v * (1 - Math.min(0.5, d / 40)) + (k === 2 ? 0 : 0))); if (d <= 2) col = [90, 150, 210]; }
    else { const sh = 0.85 + 0.15 * Math.sin(c.top / 3); col = col.map((v) => Math.min(255, Math.round(v * sh))); }
    if (c.cap) col = [235, 240, 248];
    if (c.water) { const d = c.water - c.top; col = [70 - d * 6, 130 - d * 8, 210 - d * 6]; const L = riverLifeAt(c); if (L && /waterlily/.test(L[0][1])) col = [60, 140, 50]; }
    if (c.top > SEA && !c.water) { const t = treeAt(c, c.rec ?? plan.climate.biome); if (t) col = /reeds/.test(t[0][3]) ? [150, 200, 90] : [40, 80, 30]; }
    const X = (dx + R) * 16 + c.i, Z = (dz + R) * 16 + c.j;
    for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) { const o = ((Z * PX + py) * N * PX + X * PX + px) * 3; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; }
  }
}
fs.writeFileSync(out, encode(N * PX, N * PX, img, 3));
console.log(`wrote ${out}: ${2 * R + 1} chunks a side round ${CX},${CZ}`);
