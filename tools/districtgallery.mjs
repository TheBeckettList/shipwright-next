// Places grown from their census (world/district.js): each drawn whole on its ground, with its plan (the cloud, the
// lanes, the buildings by how high the press raised them). Writes PNGs and an index.html into outdir.
//   node tools/districtgallery.mjs outdir
import fs from "node:fs";
import path from "node:path";
import { encode } from "./png.js";
import { iso } from "./iso.js";
import { placeOf, layPlace, RHO } from "../world/district.js";
import { fbm } from "../core/noise.js";
const out = process.argv[2] ?? "districts"; fs.mkdirSync(out, { recursive: true });
const VAN = JSON.parse(fs.readFileSync(new URL("../lab/bedrock_blocks.json", import.meta.url), "utf8")).blocks;
// the scenes: a people, its size and temper, and its ground (sea level 0)
const SCENES = [
  { key: "norse", title: "Norse fishing hamlet on a flat shore", place: { t: "norse", folk: 40, living: "fishers", temper: "raiders" }, h: (x, z) => 3 - z / 9 + fbm(x / 21, z / 21, 3) * 3, wall: false },
  { key: "european", title: "European walled town on a gentle rise, a river along its west", place: { t: "european", folk: 260, living: "farmers", temper: "wary" }, h: (x, z) => 4 + z / 14 + fbm(x / 34, z / 34, 5) * 4 - (Math.abs(x + 62 + Math.sin(z / 13) * 6) < 5 ? 7 : 0), wall: true },
  { key: "therans", title: "Theran quarter up the caldera's side, the sea below", place: { t: "therans", folk: 180, living: "fishers", temper: "traders" }, h: (x, z) => 2 + (-z) * 0.45 + fbm(x / 18, z / 18, 7) * 2, slope: { dir: [0, -1], grade: 0.45 }, wall: false },
  { key: "japanese", title: "Japanese fishing village between the hill and the sea", place: { t: "japanese", folk: 150, living: "fishers", temper: "peaceful" }, h: (x, z) => 2 - z / 8 + Math.max(0, -z - 18) * 0.6 + fbm(x / 25, z / 25, 9) * 2, slope: { dir: [0, -1], grade: 0.3 }, wall: false },
  { key: "indian_ocean", title: "Indian Ocean town pushed between a river, a cliff and the sea", place: { t: "indian_ocean", folk: 220, living: "fishers", temper: "traders" }, h: (x, z) => (Math.abs(x - 9 - Math.sin(z / 11) * 4) < 4 && z > -30 ? -3 : 2 - z / 16 + (z < -30 ? (-30 - z) * 2 : 0) + fbm(x / 23, z / 23, 13) * 2), wall: false },
  { key: "shallow", title: "Shallow-water village out over its lagoon", place: { t: "shallow", folk: 70, living: "fishers", temper: "peaceful" }, h: (x, z) => 1 - z / 7 + fbm(x / 15, z / 15, 17) * 2, wall: false },
  { key: "pacific", title: "Pacific hamlet behind its beach", place: { t: "pacific", folk: 50, living: "fishers", temper: "peaceful" }, h: (x, z) => 2 - z / 10 + fbm(x / 19, z / 19, 11) * 2, wall: false },
];
const cull = (vox) => { const v = new Map(); for (const [k, b] of vox) { const [x, y, z] = k.split(",").map(Number); if ([[0, 1, 0], [1, 0, 0], [0, 0, 1]].every(([a, c, d]) => vox.has(`${x + a},${y + c},${z + d}`))) continue; v.set(k, b); } return v; };   // only what the view can see (its top and two faces)
const KIND = { home: [214, 168, 120], work: [170, 120, 80], store: [150, 130, 100], trade: [214, 92, 70], civic: [120, 120, 190], guard: [90, 90, 90], faith: [230, 200, 80], harbour: [80, 140, 170] };   // vision: the plan's colours by kind
const cards = [];
for (const S of SCENES) {
  const t0 = Date.now(), ground = { h: S.h }, water = (x, z) => S.h(x, z) < 0, blocked = (x, z) => water(x, z) || Math.abs(S.h(x + 1, z) - S.h(x - 1, z)) + Math.abs(S.h(x, z + 1) - S.h(x, z - 1)) > 3;
  const pl = placeOf(S.place, { seed: 7, ground, water, slope: S.slope ?? null, blocked });
  if (process.env.ONLY && process.env.ONLY !== S.key) continue;
  const lay = layPlace(pl, S.place.t, { ground, water, wall: S.wall });
  const bad = new Set(); for (const b of lay.vox.values()) if (!VAN[b.id]) bad.add(b.id);
  const v = cull(lay.vox), p = iso({ vox: v }); fs.writeFileSync(path.join(out, `${S.key}_iso.png`), encode(p.w, p.h, p.img, 3));
  // the plan: the cloud's contours, the lanes, each building coloured by its kind and darkened by the press
  const P = lay.plan, k = 3, W = P.w * k, Hh = P.l * k, img = new Uint8Array(W * Hh * 3);
  const byCell = new Map(); for (const q of pl.placed) { const w = (q.k % 2 ? q.atom.l : q.atom.w), l = (q.k % 2 ? q.atom.w : q.atom.l); for (let x = Math.round(q.x - w / 2); x < Math.round(q.x + w / 2); x++) for (let z = Math.round(q.z - l / 2); z < Math.round(q.z + l / 2); z++) byCell.set(`${x},${z}`, q); }
  for (let j = 0; j < P.l; j++) for (let i = 0; i < P.w; i++) {
    const x = P.x0 + i, z = P.z0 + j, kind = P.at(x, z), r = pl.rho(x, z), h = S.h(x, z);
    let c = kind === "water" ? [70, 110, 170] : kind === "lane" ? [235, 225, 200] : [150 + Math.min(40, h * 3), 175 + Math.min(30, h * 2), 120];
    if (kind !== "water" && r >= RHO.place) c = c.map((q) => q * 0.92);
    const q = byCell.get(`${x},${z}`); if (q && kind === "building") { const base = KIND[q.b.kind] ?? [200, 200, 200]; c = base.map((v2) => v2 * (1 - Math.min(0.5, (q.up ?? 0) * 0.17))); }
    const edge = [[1, 0], [0, 1]].some(([a, b]) => (pl.rho(x + a, z + b) >= RHO.place) !== (r >= RHO.place)), wedge = S.wall && [[1, 0], [0, 1]].some(([a, b]) => (pl.rho(x + a, z + b) >= RHO.wall) !== (r >= RHO.wall));
    if (edge) c = [60, 60, 60]; if (wedge) c = [130, 40, 40];
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) img.set(c.map((v2) => Math.round(Math.max(0, Math.min(255, v2)))), ((j * k + b) * W + i * k + a) * 3);
  }
  fs.writeFileSync(path.join(out, `${S.key}_plan.png`), encode(W, Hh, img, 3));
  const ups = pl.placed.filter((q) => q.up).length, splits = pl.placed.filter((q) => (q.b.reactions ?? []).some((r) => /split/.test(r)) || /up\)|down\)/.test(q.b.note ?? "")).length;
  cards.push({ S, shape: pl.shape, bridges: pl.bridges.size, dropped: pl.dropped, n: pl.placed.length, q: pl.quarters.length, hh: pl.census.households, level: pl.census.name, ups, splits, lanes: lay.lanes, bad: [...bad] });
  console.log(`${S.key}: ${pl.shape.primitive} (ratio ${pl.shape.ratio.toFixed(2)}), ${pl.dropped} unplaced, ${pl.bridges.size} bridge cells; ${pl.placed.length} buildings in ${pl.quarters.length} quarters, ${ups} raised by the press, ${splits} stepped, ${lay.lanes} lane cells, ${Date.now() - t0} ms${bad.size ? ", not vanilla: " + [...bad].join(" ") : ""}`);
}
const css = `:root{--bg:#f6f4ef;--ink:#1f2328;--mute:#6b6f76;--line:#dcd8cf;--card:#fff}@media (prefers-color-scheme:dark){:root{--bg:#16181b;--ink:#e8e6e1;--mute:#9a9ea5;--line:#30343a;--card:#1f2226}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1240px;margin:0 auto;padding:28px 20px 60px}h1{font-size:28px;margin:0 0 6px}h2{font-size:20px;margin:38px 0 6px}p{color:var(--mute);max-width:860px}
.pair{display:grid;grid-template-columns:2fr 1fr;gap:12px;align-items:start}.pair img{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;image-rendering:pixelated}@media (max-width:800px){.pair{grid-template-columns:1fr}}
.key span{display:inline-block;width:12px;height:12px;border-radius:2px;margin:0 4px 0 12px;vertical-align:-1px}`;
const key = Object.entries(KIND).map(([k, c]) => `<span style="background:rgb(${c.join(",")})"></span>${k}`).join("");
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Places grown from their chemistry</title><style>${css}</style></head><body><main>
<h1>Places grown from their chemistry</h1>
<p>Each place is grown from its census, not drawn. A building is an atom: its electronegativity is its rooms' (shops low, houses high, a pavilion zero), and it's reactive if it holds a forge, an oven, vats or a latrine. Two buildings bond by Pauling's lines again: a shared wall, a lane between, or a yard apart. Each grows off the buildings already placed at golden-angle turns, where its energy is least: pulled to the core by how public it is, bonded to its likes, kept off steep ground and water, with a little noise. Quarters of about thirteen households grow round their wells, then round the hub the same way.</p>
<p>The outline is the place's density cloud, the sum of its buildings' orbitals, drawn where it passes 1/φ³. That makes it blobby, lobed by its quarters and strung along a shore. A wary town's wall follows a fainter contour. Where the sea, a river or a cliff takes ground from the cloud, the pressure lifts it: houses there take storeys, so the seafront, the valley floor, or the strip between river and cliff is where a place stands tallest. On slopes, peoples that terrace step some rooms a few blocks up the hill; the rest sit level on a footing.</p>
<p class="key">Plan:${key}<span style="background:#3c3c3c"></span>the cloud's edge<span style="background:#822828"></span>the wall's line; darker buildings were raised by the press.</p>
${cards.map((c) => `<h2>${c.S.title}</h2><p>The ground's shape: a ${c.shape.primitive} (its matrix's eigenvalues ${c.shape.l1.toFixed(0)} and ${c.shape.l2.toFixed(0)}, ratio ${c.shape.ratio.toFixed(2)}).${c.bridges ? ` ${c.bridges} blocks of bridge.` : ""} ${c.level}, ${c.hh} households, ${c.n} buildings in ${c.q} quarter${c.q > 1 ? "s" : ""}; ${c.ups} raised by the press; ${c.splits} stepped up the slope.</p><div class="pair"><img src="${c.S.key}_iso.png" alt="${c.S.title}" loading="lazy"><img src="${c.S.key}_plan.png" alt="plan" loading="lazy"></div>`).join("")}
</main></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
