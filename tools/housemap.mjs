// Draws each culture's house for a household: an isometric view through the pack's textures, and
// the floor plans (every floor, fixtures marked) beside it. One sheet.
//   node tools/housemap.mjs out.png [household] [dense]
import fs from "node:fs";
import { encode } from "./png.js";
import { loadMap } from "../world/load.js";
import { loop } from "../world/history.js";
import { houseOf, FORM } from "../world/dwelling.js";
import { tileOf, DYE } from "../world/textures.js";
const [out = "houses.png", nArg = "5", denseArg = ""] = process.argv.slice(2);
loadMap();
const L = loop(), n = Number(nArg), dense = denseArg === "dense";
const theran = (() => { const e = L.find((q) => q.tradition === "european"); return { ...e, T: 18, living: "traders", build: { ...e.build, frame: { kind: "stone", post: "minecraft:stripped_dark_oak_log", wall: "minecraft:tuff_bricks" }, roof: { pitch: "flat", cover: "minecraft:packed_mud" } } }; })();   // vision: the Therans as the pack draws them (therans.js akrotiri)
const N = 16, S = 6;   // given: a tile; vision: pixels a block in the view
import { iso } from "./iso.js";
const KEYC = { bed: null, work: [120, 60, 160], store: [150, 100, 40], fire: [240, 110, 30], table: [200, 160, 90], water: [60, 120, 220] };   // vision: the plan's colours
function plans(h) {
  const cells = [...h.vox.keys()].map((k) => k.split(",").map(Number)); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, , z] of cells) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const levels = [...new Set(h.fixtures.filter((f) => /bed|store|work|table/.test(f.what)).map((f) => f.y))].sort((a, b) => a - b), cs = S + 2, gw = (x1 - x0 + 1) * cs, gh = (z1 - z0 + 1) * cs, W = Math.max(gw, 1), H = levels.length * (gh + 6);
  const img = new Uint8Array(W * H * 3).fill(255);
  levels.forEach((y, li) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const b = h.vox.get(`${x},${y},${z}`), below = h.vox.get(`${x},${y - 1},${z}`), fx = h.fixtures.find((f) => f.x === x && f.y === y && f.z === z);
      let c = below ? [232, 226, 212] : [255, 255, 255];
      if (b) { const n = b.id.replace("minecraft:", ""); c = /door|trapdoor/.test(n) ? [140, 90, 40] : /lantern/.test(n) ? [255, 210, 90] : /ladder/.test(n) ? [180, 140, 80] : n === "bed" ? DYE[b.d?.colour ?? "red"] : /fence/.test(n) ? [150, 120, 80] : [70, 64, 58]; }
      if (fx && KEYC[fx.what]) c = KEYC[fx.what];
      for (let a = 0; a < cs - 1; a++) for (let q = 0; q < cs - 1; q++) img.set(c, ((li * (gh + 6) + (z - z0) * cs + q) * W + (x - x0) * cs + a) * 3);
    }
  });
  return { w: W, h: H, img };
}
const cultures = Object.keys(FORM), views = cultures.map((t) => { const p = t === "therans" ? theran : L.find((q) => q.tradition === t); const h = houseOf(p, { n, job: "fisherman", tradition: t, dense }); return { t, h, a: iso(h), b: plans(h) }; });
const cols = 3, cellW = Math.max(...views.map((v) => v.a.w + v.b.w + 12)), cellH = Math.max(...views.map((v) => Math.max(v.a.h, v.b.h) + 10)), W = cols * cellW, H = Math.ceil(views.length / cols) * cellH;
const img = new Uint8Array(W * H * 3).fill(246);
views.forEach((v, i) => { const ox = (i % cols) * cellW, oy = Math.floor(i / cols) * cellH; for (const [part, dx] of [[v.a, 0], [v.b, v.a.w + 6]]) for (let y = 0; y < part.h; y++) for (let x = 0; x < part.w; x++) img.set(part.img.subarray((y * part.w + x) * 3, (y * part.w + x) * 3 + 3), ((oy + y) * W + ox + dx + x) * 3); });
fs.writeFileSync(out, encode(W, H, img, 3));
for (const v of views) console.log(`${v.t.padEnd(12)} ${v.h.form.padEnd(9)} ${v.h.plan ? v.h.plan.floors.map((r) => r.map((a) => a.kind).join("-")).join(" / ") : "(one atom)"}; ${v.h.lamps.length} lanterns; ${v.h.checks.ok ? "every need met" : JSON.stringify(v.h.checks)}`);
