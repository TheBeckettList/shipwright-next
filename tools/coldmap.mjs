// Draws the Cold House (world/coldhouse.js) in isometric view through the pack's textures.
//   node tools/coldmap.mjs out.png
import fs from "node:fs";
import { encode } from "./png.js";
import { coldHouse } from "../world/coldhouse.js";
import { iso } from "./iso.js";
const h = coldHouse(), v = iso({ vox: h.vox }), cut = new Map([...h.vox].filter(([k, b]) => !(b.id === "minecraft:glass" && Number(k.split(",")[1]) > 1))), c2 = iso({ vox: cut });   // the dome, and the dome with its glass lifted off
const W = v.w + c2.w + 8, H = Math.max(v.h, c2.h), img = new Uint8Array(W * H * 3).fill(246);
for (const [part, dx] of [[v, 0], [c2, v.w + 8]]) for (let y = 0; y < part.h; y++) for (let x = 0; x < part.w; x++) img.set(part.img.subarray((y * part.w + x) * 3, (y * part.w + x) * 3 + 3), (y * W + dx + x) * 3);
fs.writeFileSync(process.argv[2] ?? "coldhouse.png", encode(W, H, img, 3));
const { darkCells, ...c } = h.checks;
console.log(`the Cold House: ${h.vox.size} blocks, ${h.lamps.length} soul lanterns; ${JSON.stringify(c)}`);
