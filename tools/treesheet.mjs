// The Theran trees side by side, front and top (game/therantrees.js), a pixel group a block: for review.
//   node tools/treesheet.mjs out.png
import fs from "node:fs";
import { encode } from "./png.js";
const { theranTree } = await import("../game/therantrees.js");
const COL = { "minecraft:birch_log": [232, 228, 218], "minecraft:orange_poplar_leaves": [222, 128, 40], "minecraft:yellow_poplar_leaves": [232, 190, 60], "minecraft:red_poplar_leaves": [184, 60, 40], "minecraft:pale_oak_leaves": [150, 160, 140], "minecraft:pale_oak_wood": [140, 130, 120], "minecraft:azalea_leaves": [90, 130, 60], "minecraft:spruce_log": [80, 60, 40], "minecraft:spruce_leaves": [40, 70, 45] };   // vision: each block's look
const trees = [["lefka", 1], ["lefka", 2], ["elia", 1], ["elia", 2], ["elia", 3], ["kyparissi", 1], ["kyparissi", 2]], P = 6, W = 14, Hh = 24, img = new Uint8Array(trees.length * W * P * (Hh + W) * P * 3).fill(250), IW = trees.length * W * P, IH = (Hh + W) * P;
trees.forEach(([k, s], n) => { const vs = theranTree(k, s), front = new Map(), top = new Map();
  for (const v of vs) { const f = `${v.x},${v.y}`, d = front.get(f); if (!d || v.z > d.z) front.set(f, v); const t = `${v.x},${v.z}`, e = top.get(t); if (!e || v.y > e.y) top.set(t, v); }
  const dot = (px, py, c, sh = 1) => { for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) { const i = px * P + a, j = py * P + b; if (i < 0 || j < 0 || i >= IW || j >= IH) continue; img.set(c.map((v) => Math.min(255, v * sh)), (j * IW + i) * 3); } };
  for (const v of front.values()) dot(n * W + W / 2 + v.x, Hh - 1 - v.y, COL[v.id] ?? [255, 0, 255], 0.85 + 0.15 * ((v.z + 4) / 8));
  for (const v of top.values()) dot(n * W + W / 2 + v.x, Hh + W / 2 + v.z, COL[v.id] ?? [255, 0, 255], 0.8 + 0.2 * (v.y / 20)); });
fs.writeFileSync(process.argv[2] ?? "trees.png", encode(IW, IH, img, 3)); console.log(IW, IH);
