// The standard country pieces (world/farms.js): a farm and a ranch laid out on flat ground, drawn from above (the fence plan) and in blocks.
//   node tools/modules.mjs <tradition> <outdir>
import fs from "node:fs";
import path from "node:path";
import { moduleOf, drawModule, MODULE } from "../world/farms.js";
import { buildOf } from "../world/census.js";
import { atomOf } from "../world/district.js";
import { iso } from "./iso.js";
import { encode } from "./png.js";
const [t = "norse", out = "/tmp/modules"] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const BUILD = { farm: ["farmhouse", "barn", "granary"], ranch: ["farmhouse", "byre", "shearing"] };
for (const kind of ["farm", "ranch"]) {
  const bs = BUILD[kind].map((id, i) => { const b = buildOf(id, t, 5 + i, null, { split: true }); return { id, b, a: atomOf(b) }; });
  const [W, L] = MODULE.SIZES.find(([w, l]) => moduleOf({ kind, W: w, L: l, house: { w: bs[0].a.w, l: bs[0].a.l }, outs: bs.slice(1).map((o) => ({ w: o.a.w, l: o.a.l })) })) ?? MODULE.SIZES[0], m = moduleOf({ kind, W, L, house: { w: bs[0].a.w, l: bs[0].a.l }, outs: bs.slice(1).map((o) => ({ w: o.a.w, l: o.a.l })) }); m.Y = 0;
  const vox = new Map(), put = (x, y, z, id, s = null) => vox.set(`${x},${y},${z}`, { id, s }), ents = [];
  for (let x = -2; x < W + 2; x++) for (let z = -2; z < L + 2; z++) put(x, 0, z, "minecraft:grass_block");
  drawModule(m, t, { put, H: () => 0, at: (lx, lz) => [lx, lz], spawn: (ty, x, y, z) => ents.push([ty, x, y, z]), dig: (x, y, z) => vox.delete(`${x},${y},${z}`), seed: 3 });
  m.spots.forEach((sp) => { const v = bs[sp.i].b.vox; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const k of v.keys()) { const [x, , z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } const dx = Math.round(sp.cx - (x0 + x1) / 2), dz = Math.round(sp.cz - (z0 + z1) / 2); for (const [k, b] of v) { const [x, y, z] = k.split(",").map(Number); vox.set(`${x + dx},${y + 1},${z + dz}`, b); } });
  for (const [ty, x, y, z] of ents) if (!vox.has(`${x},${y},${z}`)) vox.set(`${x},${y},${z}`, { id: `entity:${ty}`, s: null });
  // the plan from above: a pixel group a block, the fences dark, the gates white, the fields by kind
  const S = 8, img = new Uint8Array(W * S * L * S * 3).fill(255), col = (x, z) => { const f = m.fields.find((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1); if (m.gates.some(([a, b]) => a === x && b === z)) return [250, 250, 250]; if (m.fence.some(([a, b]) => a === x && b === z)) return [70, 45, 25]; if (x === m.trackX) return [190, 160, 110]; if (z < m.yard) return m.spots.some((sp) => Math.abs(x - sp.cx) <= sp.b.w / 2 && Math.abs(z - sp.cz) <= sp.b.l / 2) ? [150, 60, 50] : [170, 160, 120]; if (!f) return [120, 165, 80]; return { crop: [215, 190, 90], orchard: [60, 120, 50], meadow: [170, 200, 110], pen: [200, 150, 140], pasture: [130, 180, 90] }[f.kind]; };
  for (let x = 0; x < W; x++) for (let z = 0; z < L; z++) { const c = col(x, z); for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) { const o = ((z * S + b) * W * S + x * S + a) * 3; const edge = a === 0 || b === 0; img.set(edge ? c.map((v) => v * 0.92) : c, o); } }
  fs.writeFileSync(path.join(out, `${t}_${kind}_plan.png`), encode(W * S, L * S, img, 3));
  const im = iso({ vox }); fs.writeFileSync(path.join(out, `${t}_${kind}_blocks.png`), encode(im.w, im.h, im.img, 3));
  console.log(kind, `${W}x${L}`, "fields", m.fields.map((f) => f.kind).join(","), "fence", m.fence.length, "gates", m.gates.length);
}
