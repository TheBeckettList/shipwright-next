// Draws a town as its chemistry builds it, from above, block by block through the pack's textures:
// the ground and the waterline, the main street and the lanes (steps where steep), every house as
// its culture's law builds it (its roof seen from above), the quarters' wells and bells, the hall,
// the market, the docks.
//   node tools/townchem.mjs <tradition|people> <population> out.png [pixels a block]
import fs from "node:fs";
import { encode } from "./png.js";
import { loadMap } from "../world/load.js";
import { loop } from "../world/history.js";
import { economy } from "../world/economy.js";
import { blockHeight } from "../world/map.js";
import { compound, houseFor } from "../world/chem.js";
import { LAYOUT } from "../world/settlement.js";
import { texel, variantAt } from "../world/textures.js";
const [who = "japanese", popArg = "500", out = "town_chem.png", pxArg = "2"] = process.argv.slice(2);
loadMap();
const L = loop(), i = L.findIndex((q) => q.key === who || q.tradition === who), p = L[i], R = economy(1), site = R.state[i].site, pop = Number(popArg), PX = Number(pxArg), P = LAYOUT.PLOT;
const C = compound(p, site, pop, { tier: "town" });
let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
for (const t of [...C.taken.values()].map((t) => t.q).concat([...C.roads.values()].map((r) => r.q))) { i0 = Math.min(i0, t.i); i1 = Math.max(i1, t.i); j0 = Math.min(j0, t.j); j1 = Math.max(j1, t.j); }
i0 -= 3; j0 -= 3; i1 += 6; j1 += 6;   // vision: a margin, in plots
const BW = (i1 - i0 + 1) * P, BH = (j1 - j0 + 1) * P, W = BW * PX, H = BH * PX, img = new Uint8Array(W * H * 3), top = new Float32Array(BW * BH).fill(-99);
const ground = (bx, bz) => blockHeight(C.grid.x0 + (bx + i0 * P), C.grid.z0 + (bz + j0 * P));
const paint = (bx, bz, id, k = 0, shade = 1, tint = null) => { if (bx < 0 || bz < 0 || bx >= BW || bz >= BH) return; for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) { let c = texel(id, (x + 0.5) / PX, (y + 0.5) / PX, 0, PX, "top", k); if (tint) c = c.map((v, q) => v * tint[q]); img.set(c.map((v) => Math.max(0, Math.min(255, v * shade))), ((bz * PX + y) * W + bx * PX + x) * 3); } };
// the ground
for (let bz = 0; bz < BH; bz++) for (let bx = 0; bx < BW; bx++) {
  const h = ground(bx, bz), k = variantAt("x", bx, 0, bz);
  if (h <= 0) paint(bx, bz, "minecraft:water", 0, 1, [0.3, 0.5, 0.9]);   // vision: the sea's tint
  else if (h <= 2) paint(bx, bz, "minecraft:sand", k, 0.95 + 0.02 * h);
  else paint(bx, bz, p.T < -2 ? "minecraft:snow" : "minecraft:grass_block", k, 0.85 + Math.min(0.3, h * 0.01), p.T < -2 ? null : [0.75, 1, 0.55]);   // vision: the grass tint, brighter up high
}
// the roads: from each road plot's middle toward its road neighbours, as wide as the road
const at = (q) => [(q.i - i0) * P, (q.j - j0) * P];
for (const r of C.roads.values()) {
  const [bx, bz] = at(r.q), w = r.width, mid = Math.floor(P / 2), lo = mid - Math.floor(w / 2), hi = lo + w - 1;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => C.roads.has(`${r.q.i + a},${r.q.j + b}`));
  for (let x = lo; x <= hi; x++) for (let z = lo; z <= hi; z++) paint(bx + x, bz + z, r.surface, 0);
  for (const [a, b] of nb) for (let s = 0; s < P; s++) for (let u = lo; u <= hi; u++) { const x = a ? (a > 0 ? mid + s : mid - s) : u, z = b ? (b > 0 ? mid + s : mid - s) : u; if (x >= 0 && x < P && z >= 0 && z < P) paint(bx + x, bz + z, r.surface, 0, r.steps ? 0.85 : 1); }
}
// the houses: each the culture's own, its roof seen from above, brighter the higher
const proto = new Map(); const voxOf = (h) => { const k = `${h.dense}|${JSON.stringify(h.vary ?? {})}|${h.job}`; if (!proto.has(k)) proto.set(k, houseFor(p, h)); return proto.get(k); };
for (const [hi, h] of C.houses.entries()) {
  const H0 = voxOf(h), cols = new Map(), FP = C.footprint;
  for (const [k, b] of H0.vox) { const [x, y, z] = k.split(",").map(Number); const c = `${x},${z}`; if ((cols.get(c)?.y ?? -99) < y) cols.set(c, { y, b }); }
  const [bx, bz] = at(h.q);
  for (const [c, { y, b }] of cols) { const [x, z] = c.split(",").map(Number), X = bx + x - FP.x0, Z = bz + z - FP.z0, id = b.id === "minecraft:bed" ? `minecraft:${b.d?.colour ?? "red"}_wool` : b.id.replace(/_stairs$|_slab$/, (m) => "").replace(/(\w+)_stairs$/, "$1"); paint(X, Z, /stairs|slab/.test(b.id) ? b.id.replace(/_stairs$|_slab$/, "").replace("minecraft:stone", "minecraft:cobblestone") + (/(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo)$/.test(b.id.replace(/_stairs$|_slab$/, "")) ? "_planks" : "") : id, variantAt(id, X, y, Z), 0.75 + Math.min(0.35, y * 0.04)); if (X >= 0 && Z >= 0 && X < BW && Z < BH) top[Z * BW + X] = y; }   // vision: brighter the higher
}
// shadows: a block's height casts to the south-east
for (let bz = BH - 1; bz > 0; bz--) for (let bx = BW - 1; bx > 0; bx--) { const t = top[(bz - 1) * BW + bx - 1]; if (t > top[bz * BW + bx] + 1) for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) { const o = ((bz * PX + y) * W + bx * PX + x) * 3; for (let c = 0; c < 3; c++) img[o + c] *= 0.7; } }   // vision: a shadow's dark
// wells and bells, the hall, the market, the docks
for (const t of C.taken.values()) {
  if (t.part) continue; const [bx, bz] = at(t.q);
  if (t.kind === "well") { for (let x = 1; x < 3; x++) for (let z = 1; z < 3; z++) paint(bx + x, bz + z, "minecraft:cobblestone"); paint(bx + 1, bz + 1, "minecraft:water", 0, 1, [0.3, 0.5, 0.9]); paint(bx + 2, bz + 2, "minecraft:yellow_glazed_terracotta"); }   // vision: the well's ring, its water, the bell beside it
  if (t.kind === "hall" || t.kind === "market") for (let x = 0; x < 3 * P; x++) for (let z = 0; z < 3 * P; z++) paint(bx + x, bz + z, t.kind === "hall" ? "minecraft:stone_bricks" : "minecraft:smooth_stone", 0, (x + z) % 7 === 0 ? 0.9 : 1);   // vision: paving's joints
  if (t.kind === "dock") for (let x = 0; x < P; x++) for (let z = 0; z < P * 2; z++) { const X = bx + x, Z = bz + z; if (ground(X, Z) <= 0) paint(X, Z, `minecraft:${p.build.frame.post.replace(/^minecraft:(stripped_)?/, "").replace(/_log$/, "")}_planks`, 0, 0.95); }
  if (t.kind === "granary") for (let x = 0; x < P; x++) for (let z = 0; z < P; z++) paint(bx + x, bz + z, "minecraft:hay_block", 0, 1, null);
}
fs.writeFileSync(out, encode(W, H, img, 3));
const kinds = {}; for (const s of C.steps) kinds[s.what] = (kinds[s.what] ?? 0) + 1;
console.log(`${p.key} (${p.tradition}, ${C.needs.law}) for ${pop}: ${C.needs.households} households of ${C.needs.household}, ${C.houses.reduce((a, h) => a + h.n, 0)} beds; ${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(", ")}; ${C.roads.size} road plots; ${BW} x ${BH} blocks -> ${out}`);
