// Draws the Sea Rite Temple (world/temple.js) in isometric view through the pack's textures: whole, and with its roof and frieze lifted off.
//   node tools/templemap.mjs out.png
import fs from "node:fs";
import { encode } from "./png.js";
import { seaRiteTemple, TEMPLE } from "../world/temple.js";
import { iso } from "./iso.js";
const t = seaRiteTemple(), a = iso({ vox: t.vox }), cut = new Map([...t.vox].filter(([k]) => Number(k.split(",")[1]) <= TEMPLE.COLUMN - 2)), b = iso({ vox: cut });   // the roof and the columns' tops lifted
const W = a.w + b.w + 8, H = Math.max(a.h, b.h), img = new Uint8Array(W * H * 3).fill(246);
for (const [p, dx] of [[a, 0], [b, a.w + 8]]) for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) img.set(p.img.subarray((y * p.w + x) * 3, (y * p.w + x) * 3 + 3), (y * W + dx + x) * 3);
fs.writeFileSync(process.argv[2] ?? "temple.png", encode(W, H, img, 3));
console.log(`the Sea Rite Temple: ${t.vox.size} blocks, ${t.lamps.length} lanterns; ${JSON.stringify(t.checks)}`);
