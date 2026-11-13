// Draws every people's pinnacle building (world/pinnacle.js) side by side in isometric view.
//   node tools/pinnaclemap.mjs out.png
import fs from "node:fs";
import { encode } from "./png.js";
import { iso } from "./iso.js";
import { loadMap } from "../world/load.js";
loadMap();
const { pinnacle } = await import("../world/pinnacle.js");
const { peoples } = await import("../world/peoples.js");
const { theranPeople } = await import("../world/therans.js");
const L = peoples().list, byT = new Map(); for (const p of L) if (!byT.has(p.tradition)) byT.set(p.tradition, p);
const eu = byT.get("european"); byT.set("therans", theranPeople(eu));   // vision: the Therans as the pack draws them
const pics = [...byT].map(([t, p]) => iso({ vox: pinnacle(p, { tradition: t }).vox }));
const W = pics.reduce((a, p) => a + p.w + 6, 0), H = Math.max(...pics.map((p) => p.h)), img = new Uint8Array(W * H * 3).fill(246);
let dx = 0; for (const p of pics) { const oy = H - p.h; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) img.set(p.img.subarray((y * p.w + x) * 3, (y * p.w + x) * 3 + 3), ((y + oy) * W + dx + x) * 3); dx += p.w + 6; }
fs.writeFileSync(process.argv[2] ?? "pinnacles.png", encode(W, H, img, 3));
console.log([...byT.keys()].join(", "), `${W} x ${H}`);
