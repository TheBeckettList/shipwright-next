// Close views of real towns with their roads: the core, the harbour, a quarter, and the road out (world/cities.js,
// world/district.js, world/roads.js), and a stretch of road between towns with its bridge. Writes PNGs and index.html.
//   node tools/snapshots.mjs outdir [traditions]
import fs from "node:fs";
import path from "node:path";
import { encode } from "./png.js";
import { iso } from "./iso.js";
import { loadMap } from "../world/load.js";
loadMap();
const { cityOf } = await import("../world/cities.js");
const { layPlace, RHO } = await import("../world/district.js");
const { roads, ROAD } = await import("../world/roads.js");
const { peoples } = await import("../world/peoples.js");
const { populations } = await import("../world/boxes.js");
const { blockHeight, map } = await import("../world/map.js");
const out = process.argv[2] ?? "snaps", list = (process.argv[3] ?? "european,japanese,norse").split(","); fs.mkdirSync(out, { recursive: true });
const LABEL = { norse: "Norse", european: "European", therans: "Therans", indian_ocean: "Indian Ocean", east_asian: "East Asian", japanese: "Japanese", pacific: "Pacific", dugout: "Northwest Coast", birchbark: "Birchbark", shallow: "Shallow-water", arctic: "Arctic" };
const W = map().w, P = peoples().list, pops = populations(), R = roads();
console.log(`roads: ${R.roads.length}`);
const best = new Map(); for (const p of P) { const v = pops.get(p.key)?.pop ?? 0; if (!best.has(p.tradition) || v > best.get(p.tradition).v) best.set(p.tradition, { p, v }); }
const cull = (vox) => { const v = new Map(); for (const [k, b] of vox) { const [x, y, z] = k.split(",").map(Number); if ([[0, 1, 0], [1, 0, 0], [0, 0, 1]].every(([a, c, d]) => vox.has(`${x + a},${y + c},${z + d}`))) continue; v.set(k, b); } return v; };
const crop = (vox, cx, cz, r) => { const v = new Map(); for (const [k, b] of vox) { const [x, , z] = k.split(",").map(Number); if (Math.abs(x - cx) <= r && Math.abs(z - cz) <= r) v.set(k, b); } return v; };
const shot = (vox, f) => { if (!vox.size) return null; const img = iso({ vox: cull(vox) }); fs.writeFileSync(path.join(out, f), encode(img.w, img.h, img.img, 3)); return f; };
// a road's chunk path as a block polyline in a frame centred at (ox, oz): chunk centres, smoothed once (Chaikin)
const polyline = (r, ox, oz) => { let pts = r.path.map((k) => { let cx = k % W, cz = Math.floor(k / W); let x = cx * 16 + 8 - ox; if (x > (W * 16) / 2) x -= W * 16; if (x < -(W * 16) / 2) x += W * 16; return [x, cz * 16 + 8 - oz]; }); const sm = [pts[0]]; for (let i = 0; i + 1 < pts.length; i++) { const [a, b] = [pts[i], pts[i + 1]]; sm.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } sm.push(pts.at(-1)); return sm; };   // given: Chaikin's quarter points
const cards = [], FIBR = 21;   // vision: a road's edge of town at least twenty-one blocks out
for (const t of list) {
  const p = best.get(t)?.p; if (!p) continue;
  const t0 = Date.now(), c = cityOf(p, { seed: 11 }), pl = c.place;
  const near = R.roads.filter((r) => r.a === p.key || r.b === p.key), rs = near.map((r) => ({ pts: polyline(r, c.at.x, c.at.z), width: r.width, surface: (ROAD[r.t] ?? ROAD.european).surface, r }));
  const lay = layPlace(pl, t, { ground: c.ground, water: c.water, wall: c.soc.temper === "wary", roads: rs, margin: 89 });
  for (const e of lay.entities ?? []) { const k = `${e.x},${e.y},${e.z}`; if (!lay.vox.has(k)) lay.vox.set(k, { id: `entity:${e.type}`, s: null }); }   // the beasts, drawn where they stand
  console.log(`${t}: ${pl.placed.length} buildings, ${near.length} roads out, laid ${lay.vox.size} blocks, ${Date.now() - t0} ms`);
  const R0 = 55, shots = [];
  shots.push({ name: "the core", f: shot(crop(lay.vox, 0, 0, R0), `${t}_core.png`) });
  const harbour = pl.port?.site ?? pl.placed.find((q) => /shipyard|boathouse|fishmarket|harbourmaster/.test(q.id)); if (harbour) shots.push({ name: "the harbour", f: shot(crop(lay.vox, harbour.x, harbour.z, R0), `${t}_harbour.png`) });
  if (pl.wall?.gates?.length) { const [gx, gz] = pl.wall.gates[0]; shots.push({ name: `the ${pl.wall.kind} and a gate`, f: shot(crop(lay.vox, gx, gz, R0), `${t}_wall.png`) }); }
  if (pl.buffer?.cemetery) { const c0 = pl.buffer.cemetery; shots.push({ name: "the buffer: cemetery and gardens", f: shot(crop(lay.vox, c0.x0 + c0.w / 2, c0.z0 + c0.l / 2, R0), `${t}_buffer.png`) }); }
  const farm = (pl.farms ?? []).slice().sort((a, b) => b.m.W * b.m.L - a.m.W * a.m.L)[0]; if (farm) shots.push({ name: "the farms", f: shot(crop(lay.vox, farm.x, farm.z, R0), `${t}_farms.png`) });
  const homes = pl.placed.filter((q) => q.atom.home), mid = homes[Math.floor(homes.length / 2)]; if (mid) shots.push({ name: "a quarter", f: shot(crop(lay.vox, mid.x, mid.z, R0), `${t}_quarter.png`) });
  const road = rs.sort((a, b) => ["artery", "road", "track"].indexOf(a.r.cls) - ["artery", "road", "track"].indexOf(b.r.cls))[0];
  if (road) { const edge = road.pts.find(([x, z]) => pl.rho(x, z) < RHO.place && Math.hypot(x, z) > FIBR) ?? road.pts[Math.min(road.pts.length - 1, 3)]; shots.push({ name: `the ${road.r.cls} out (${(ROAD[road.r.t] ?? ROAD.european).name})`, f: shot(crop(lay.vox, Math.round(edge[0]), Math.round(edge[1]), R0), `${t}_road.png`) }); }
  cards.push({ t, p, pl, c, near, shots });
}
// a stretch of road between towns, with a bridge if one is to be had: the ground's skin, the road, its deck
const bridged = R.roads.filter((r) => r.bridge && !r.ferry).sort((a, b) => b.bridge - a.bridge)[0] ?? R.roads.find((r) => r.cls === "artery");
let stretch = null;
if (bridged) {
  const wetAt = bridged.path.findIndex((k) => blockHeight((k % W) * 16 + 8, Math.floor(k / W) * 16 + 8) <= 0), k0 = bridged.path[Math.max(0, wetAt)], ox = (k0 % W) * 16 + 8, oz = Math.floor(k0 / W) * 16 + 8;
  const pts = polyline(bridged, ox, oz), Rr = 70, vox = new Map(), Rd = ROAD[bridged.t] ?? ROAD.european;
  for (let x = -Rr; x <= Rr; x++) for (let z = -Rr; z <= Rr; z++) { const h = Math.round(blockHeight(ox + x, oz + z)); if (h <= 0) { vox.set(`${x},0,${z}`, { id: "minecraft:water", s: null }); continue; } for (let y = h - 2; y <= h; y++) vox.set(`${x},${y},${z}`, { id: y === h ? "minecraft:grass_block" : "minecraft:dirt", s: null }); }
  for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az)); for (let s = 0; s <= n; s++) { const x = ax + ((bx - ax) * s) / Math.max(1, n), z = az + ((bz - az) * s) / Math.max(1, n), nx = -(bz - az) / Math.max(1, n), nz = (bx - ax) / Math.max(1, n); for (let w = -Math.ceil((bridged.width - 1) / 2); w <= Math.ceil((bridged.width - 1) / 2); w++) { const X = Math.round(x + nx * w), Z = Math.round(z + nz * w); if (Math.abs(X) > Rr || Math.abs(Z) > Rr) continue; const h = Math.round(blockHeight(ox + X, oz + Z)); if (h <= 0) { vox.set(`${X},1,${Z}`, { id: "minecraft:stone_bricks", s: null }); if (Math.abs(w) === Math.ceil((bridged.width - 1) / 2)) vox.set(`${X},2,${Z}`, { id: "minecraft:stone_brick_wall", s: null }); if (s % 3 === 0 && w === 0) for (let y = h; y < 1; y++) vox.set(`${X},${y},${Z}`, { id: "minecraft:stone_bricks", s: null }); } else vox.set(`${X},${h},${Z}`, { id: Rd.surface, s: null }); } } }
  stretch = { r: bridged, f: shot(vox, "road_stretch.png"), Rd };
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = `:root{--bg:#f6f4ef;--ink:#1f2328;--mute:#6b6f76;--line:#dcd8cf;--card:#fff}@media (prefers-color-scheme:dark){:root{--bg:#16181b;--ink:#e8e6e1;--mute:#9a9ea5;--line:#30343a;--card:#1f2226}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1300px;margin:0 auto;padding:28px 20px 60px}h1{font-size:28px;margin:0 0 6px}h2{font-size:20px;margin:40px 0 6px}p{color:var(--mute);max-width:900px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}@media (max-width:800px){.grid{grid-template-columns:1fr}}figure{margin:0}img{width:100%;border:1px solid var(--line);border-radius:8px;background:#f6f4ef;image-rendering:pixelated}figcaption{font-size:13px;color:var(--mute)}`;
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Town snapshots and their roads</title><style>${css}</style></head><body><main>
<h1>Town snapshots and their roads</h1>
<p>Close views of real towns grown on their own ground: the core, the harbour, a quarter, and where the main road leaves town. The roads are the land network's own, drawn at block scale in each people's surface and width, crossing water on bridges. Each view is a square about 110 blocks across.</p>
${cards.map(({ t, p, pl, c, near, shots }) => `<h2>${LABEL[t]}: ${c.pop} people</h2><p>${esc(pl.census.name)}, ${pl.census.households} households, ${pl.placed.length} buildings; ${near.length} roads out (${near.map((r) => r.cls).join(", ") || "none"}), its road style: ${esc((ROAD[t] ?? ROAD.european).name)}, ${esc((ROAD[t] ?? ROAD.european).surface.replace("minecraft:", "").replace(/_/g, " "))}.</p><div class="grid">${shots.map((s) => `<figure><img src="${s.f}" alt="${esc(s.name)}" loading="lazy"><figcaption>${esc(s.name)}</figcaption></figure>`).join("")}</div>`).join("")}
${stretch ? `<h2>Between towns: ${esc(stretch.Rd.name)}</h2><p>The ${stretch.r.cls} from one ${LABEL[stretch.r.t]} town to the next, ${stretch.r.cells} chunks long, crossing ${stretch.r.bridge} blocks of water on a bridge (its people span up to ${stretch.Rd.span}).</p><figure><img src="${stretch.f}" alt="the road between towns" loading="lazy"><figcaption>${esc(stretch.Rd.bridge ?? "no bridge")}, a pier every three blocks</figcaption></figure>` : ""}
</main></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log("wrote", out);
