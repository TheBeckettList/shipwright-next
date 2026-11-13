// What the game lays, from above: every column's top block (the game's own plan, game/ground.js chunkColumns, the
// meshed relief as the layer uses it), the sea's ice as lay.js lays it, a pixel a block.
//   node tools/topmap.mjs <cx> <cz> <chunks> out.png     the square of chunks from chunk (cx, cz)
import { loadMap } from "../world/load.js";
import { encode } from "./png.js";
import fs from "node:fs";
loadMap();
const G = await import("../game/ground.js"), { iceAt } = await import("../game/ground.js");
const [cx0, cz0, n, out] = [+process.argv[2], +process.argv[3], +(process.argv[4] ?? 32), process.argv[5] ?? "top.png"];
const COL = { grass_block: [96, 160, 64], podzol: [110, 80, 40], sand: [220, 210, 150], red_sand: [190, 100, 40], gravel: [130, 125, 120], stone: [128, 128, 128], snow: [245, 245, 250], packed_ice: [160, 190, 240], ice: [180, 210, 255],
  mud: [70, 60, 55], coarse_dirt: [120, 90, 60], moss_block: [80, 120, 40], calcite: [225, 225, 220], dirt: [130, 95, 65], sandstone: [210, 195, 140], orange_terracotta: [170, 90, 40], water: [40, 80, 170] };   // vision: a colour a block
const N = n * 16, img = new Uint8Array(N * N * 3), seen = {};
for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { const g = G.chunkColumnsSteps(cx0 + a, cz0 + b, { mesh: 3 }); let r; while (!(r = g.next()).done); const plan = r.value;
  for (const c of plan.cols) { const id = c.topId.replace("minecraft:", ""); seen[id] = (seen[id] ?? 0) + 1;
    let rgb = COL[id] ?? [255, 0, 255]; const sea = c.top < G.SEA || c.water;
    if (sea) { const d = Math.min(1, (G.SEA - c.top) / 40); rgb = rgb.map((v, k) => v * (1 - 0.6 - d * 0.3) + COL.water[k] * (0.6 + d * 0.3)); }
    if (c.top < G.SEA && iceAt(c)) rgb = COL.ice;
    const k = ((b * 16 + c.j) * N + a * 16 + c.i) * 3; img[k] = rgb[0]; img[k + 1] = rgb[1]; img[k + 2] = rgb[2]; } }
fs.writeFileSync(out, encode(N, N, img, 3)); console.log(out, JSON.stringify(seen));
