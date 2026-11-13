// Shows the textures as they're seen: in sets, not alone.
//   floors   each family as a 5 x 5 floor, variants picked by position (as the sim does), glazed
//            terracotta turned by position so the set draws its spirals
//   stacks   the solid families as a 3 x 3 x 3 block of blocks in isometric view: top and two
//            sides, so the veins, beds, rings and courses can be seen running round the corners
//   node tools/texsets.mjs out.png
import fs from "node:fs";
import { encode } from "./png.js";
import { tileOf, variantAt, lookOf, TEXTURE } from "../world/textures.js";
import { golden } from "../core/golden.js";
const N = TEXTURE.N, out = process.argv[2] ?? "sets.png";
const FLOORS = ["minecraft:cobblestone", "minecraft:gravel", "minecraft:dirt", "minecraft:sand", "minecraft:oak_leaves", "minecraft:cherry_leaves", "minecraft:red_wool", "minecraft:snow", "minecraft:ice",
  "minecraft:blue_glazed_terracotta", "minecraft:light_blue_glazed_terracotta", "minecraft:cyan_glazed_terracotta", "minecraft:red_glazed_terracotta", "minecraft:yellow_glazed_terracotta", "minecraft:magenta_glazed_terracotta", "minecraft:purple_glazed_terracotta", "minecraft:white_glazed_terracotta", "minecraft:water", "minecraft:prismarine", "minecraft:brain_coral_block", "minecraft:grass_block", "minecraft:farmland"];
const STACKS = ["minecraft:stone", "minecraft:granite", "minecraft:oak_log", "minecraft:birch_log", "minecraft:stripped_spruce_log", "minecraft:orange_terracotta", "minecraft:sandstone", "minecraft:stone_bricks", "minecraft:bricks", "minecraft:spruce_planks", "minecraft:grass_block", "minecraft:calcite"];
const PILLARS = ["minecraft:oak_log", "minecraft:basalt", "minecraft:hay_block", "minecraft:bamboo_block", "minecraft:quartz_pillar", "minecraft:deepslate", "minecraft:bone_block", "minecraft:spruce_log"];
const F = 5, Z = 2, cellW = F * N * Z + 12, cols = 4;   // vision: a floor five blocks a side at twice size
const isoW = 3 * N * 2 * Z + 12, isoH = 3 * N * 2 * Z + 12;   // vision: three blocks a side
const W = cols * Math.max(cellW, isoW), rowsF = Math.ceil(FLOORS.length / cols), rowsS = Math.ceil(STACKS.length / cols), rowsP = Math.ceil((2 * PILLARS.length) / cols), H = rowsF * cellW + (rowsS + rowsP) * isoH;
const img = new Uint8Array(W * H * 3).fill(238);   // vision: the sheet's grey
const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) img.set(c, (Math.floor(y) * W + Math.floor(x)) * 3); };
const at = (t, u, v) => { const k = (v * N + u) * 3; return [t.rgb[k], t.rgb[k + 1], t.rgb[k + 2]]; };
FLOORS.forEach((id, n) => {
  const ox = (n % cols) * Math.max(cellW, isoW), oy = Math.floor(n / cols) * cellW, glazed = lookOf(id).family === "glazed";
  for (let bz = 0; bz < F; bz++) for (let bx = 0; bx < F; bx++) {
    const t = tileOf(id, 0, "top", variantAt(id, bx, 0, bz)), q = glazed ? (bx % 2) + 2 * (bz % 2) : 3;   // glazed: turned round each point (2 x 2), as builders lay them
    for (let y = 0; y < N * Z; y++) for (let x = 0; x < N * Z; x++) {
      const a = Math.floor(x / Z), b = Math.floor(y / Z), [u, v] = q === 3 ? [a, b] : q === 0 ? [N - 1 - a, N - 1 - b] : q === 1 ? [N - 1 - b, a] : [b, N - 1 - a];   // each tile turned so its corner sits at the group's centre
      put(ox + bx * N * Z + x, oy + bz * N * Z + y, at(t, u, v));
    }
  }
});
// isometric: a cube's top as a rhombus, its two near sides below it; each face shaded as the game shades faces.
// axis y: stood (end on top); axis x: laid (the side, turned, on top and on the front; the end on the right)
const SHADE = { top: 1, left: 0.8, right: 0.62 };   // vision: the game's face shades, roughly
const turn = (t) => ({ rgb: Uint8Array.from({ length: N * N * 3 }, (_, k) => { const p = Math.floor(k / 3), c = k % 3, u = p % N, v = Math.floor(p / N); return t.rgb[(u * N + (N - 1 - v)) * 3 + c]; }) });
function iso(id, axis, ox, oy) {
  const s = Z, endT = tileOf(id, 0, "top"), side = tileOf(id, 0, "side"), sideT = turn(side);
  const faces = axis === "y" ? { top: endT, left: side, right: side } : { top: sideT, left: sideT, right: endT };
  const P = (x, y, z) => [ox + (x - z) * s, oy + ((x + z) / 2 - y) * s + 3 * N * s];
  for (let by = 0; by < 3; by++) for (let bz = 0; bz < 3; bz++) for (let bx = 0; bx < 3; bx++) {
    if (bx < 2 && bz < 2 && by < 2) continue;
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) {
      const du = u + a / s, dv = v + b / s;
      if (by === 2) { const c = at(faces.top, u, v); const [x, y] = P(bx * N + du, 3 * N, bz * N + dv); put(x, y, c); put(x + 1, y, c); }
      if (bz === 2) { const c = at(faces.left, u, v).map((q) => q * SHADE.left); const [x, y] = P(bx * N + du, (by + 1) * N - dv, 3 * N); put(x, y, c); put(x, y + 1, c); }
      if (bx === 2) { const c = at(faces.right, u, v).map((q) => q * SHADE.right); const [x, y] = P(3 * N, (by + 1) * N - dv, (3 - bz) * N - du); put(x, y, c); put(x, y + 1, c); }
    }
  }
}
STACKS.forEach((id, n) => iso(id, "y", (n % cols) * Math.max(cellW, isoW) + isoW / 2, rowsF * cellW + Math.floor(n / cols) * isoH + 6));
// the axis materials, stood and laid side by side
PILLARS.forEach((id, n) => { const k = 2 * n; for (const [j, axis] of [[0, "y"], [1, "x"]]) iso(id, axis, ((k + j) % cols) * Math.max(cellW, isoW) + isoW / 2, rowsF * cellW + rowsS * isoH + Math.floor((k + j) / cols) * isoH + 6); });
fs.writeFileSync(out, encode(W, H, img, 3));
console.log(`wrote ${out}: ${FLOORS.length} floors, ${STACKS.length} stacks`);
