// The land's veins and the sea's: every road (world/roads.js) over the map, by class and by what it crosses, with the
// sea routes (world/trade.js) faint between the ports. Writes the world, the busiest islands up close, and a page.
//   node tools/roadmap.mjs outdir
import fs from "node:fs";
import path from "node:path";
import { encode } from "./png.js";
import { loadMap } from "../world/load.js";
loadMap();
const { roads, ROAD } = await import("../world/roads.js");
const { network } = await import("../world/trade.js");
const { chunkHeight, map } = await import("../world/map.js");
const { peoples } = await import("../world/peoples.js");
const out = process.argv[2] ?? "roads"; fs.mkdirSync(out, { recursive: true });
const m = map(), W = m.w, H = m.h, R = roads(), net = network();
const LABEL = { norse: "Norse", european: "European", therans: "Therans", indian_ocean: "Indian Ocean", east_asian: "East Asian", japanese: "Japanese", pacific: "Pacific", dugout: "Northwest Coast", birchbark: "Birchbark", shallow: "Shallow-water", arctic: "Arctic" };
const COL = { artery: [200, 40, 40], road: [230, 140, 40], track: [190, 160, 110], bridge: [255, 255, 255], tunnel: [20, 20, 20], steep: [140, 60, 170], ice: [170, 220, 255], causeway: [120, 200, 140] };   // vision: the map's colours
function draw(x0, z0, w, h, k, file) {
  const img = new Uint8Array(w * k * h * k * 3), px = (i, j, c) => { for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) img.set(c, ((j * k + b) * w * k + i * k + a) * 3); };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = chunkHeight(x0 + i, z0 + j); px(i, j, v > 0 ? [110 + Math.min(100, v), 150 + Math.min(60, v / 2), 90] : [40 + Math.max(0, 30 + v), 70 + Math.max(0, 40 + v), 120 + Math.max(0, 50 + v)]); }
  const put = (cx, cz, c) => { const i = ((cx - x0) % W + W) % W, j = cz - z0; if (i >= 0 && j >= 0 && i < w && j < h) px(i, j, c); };
  // the sea routes: each node to its parent, a faint straight line
  const at = (n) => n?.at; for (const n of net.nodes.values()) { const p = net.nodes.get(n.parent); if (!p) continue; const a = at(n), b = at(p); let dx = b.cx - a.cx; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; const steps = Math.ceil(Math.hypot(dx, b.cz - a.cz)); for (let s = 0; s <= steps; s += 2) { const cx = Math.round(a.cx + (dx * s) / steps), cz = Math.round(a.cz + ((b.cz - a.cz) * s) / steps); if (chunkHeight(cx, cz) <= 0) put(cx, cz, [150, 180, 220]); } }
  for (const r of [...R.roads].sort((a, b) => ["track", "road", "artery"].indexOf(a.cls) - ["track", "road", "artery"].indexOf(b.cls))) for (const q of r.path) { const cx = q % W, cz = Math.floor(q / W), v = chunkHeight(cx, cz); put(cx, cz, v <= 0 ? (r.ferry ? [255, 230, 120] : COL.bridge) : COL[r.cls]); }
  for (const n of R.nodes) put(n.cx, n.cz, n.port ? [20, 60, 160] : [30, 30, 30]);
  fs.writeFileSync(path.join(out, file), encode(w * k, h * k, img, 3));
}
draw(0, 0, W, H, 1, "world.png");
// the busiest islands, close
const byIs = new Map(); for (const r of R.roads) byIs.set(r.island, (byIs.get(r.island) ?? 0) + r.cells);
const top = [...byIs].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
const crops = top.map((id, i) => { const ns = R.nodes.filter((n) => n.island === id); let x0 = Math.min(...ns.map((n) => n.cx)) - 21, x1 = Math.max(...ns.map((n) => n.cx)) + 21, z0 = Math.max(0, Math.min(...ns.map((n) => n.cz)) - 21), z1 = Math.min(H - 1, Math.max(...ns.map((n) => n.cz)) + 21); if (x1 - x0 > W / 2) { x0 = 0; x1 = W - 1; } const w = x1 - x0 + 1, h = z1 - z0 + 1, k = Math.max(1, Math.min(6, Math.floor(900 / Math.max(w, h)))); draw(x0, z0, w, h, k, `island_${i}.png`); const t = {}; for (const n of ns) t[n.t] = (t[n.t] ?? 0) + 1; return { i, id, towns: ns.length, peoples: Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k2, v]) => `${LABEL[k2]} ${v}`).join(", "), roads: R.roads.filter((r) => r.island === id).length }; });
// the tallies
const tally = {}; for (const r of R.roads) { const T = (tally[r.t] ??= { roads: 0, cells: 0, artery: 0, road: 0, track: 0, bridges: 0, ferries: 0, tunnel: 0, steep: 0, ice: 0, causeway: 0 }); T.roads++; T.cells += r.cells; T[r.cls]++; if (r.bridge && !r.ferry) T.bridges++; if (r.ferry) T.ferries++; for (const k of ["tunnel", "steep", "ice", "causeway"]) T[k] += r.kinds[k] ?? 0; }
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const rows = Object.entries(ROAD).map(([t, r]) => { const T = tally[t] ?? {}; return `<tr><td><b>${LABEL[t]}</b><br><span class="m">${esc(r.name)}</span></td><td>${esc(r.surface.replace("minecraft:", "").replace(/_/g, " "))}; ${r.width.join(" / ")} wide</td><td>${r.bridge ? `${esc(r.bridge)}, up to ${r.span}` : "none: the road ends at the water"}</td><td>${r.steep ? esc(r.steep) : r.tunnel ? "tunnels" : "goes round"}${r.tunnel && r.steep ? "; tunnels" : ""}</td><td>${esc(r.mark[0])}, every ${r.mark[1]}; ${esc(r.rest[0])}, every ${r.rest[1]}</td><td>${esc(r.wet)}. ${esc(r.fun)}</td><td>${T.roads ?? 0} (${T.artery ?? 0} / ${T.road ?? 0} / ${T.track ?? 0}); ${T.bridges ?? 0} bridged, ${T.ferries ?? 0} ferries${T.tunnel ? `, ${T.tunnel} cells of tunnel` : ""}${T.steep ? `, ${T.steep} of steps or galleries` : ""}${T.ice ? `, ${T.ice} of sea ice` : ""}${T.causeway ? `, ${T.causeway} of causeway` : ""}</td></tr>`; }).join("");
const css = `:root{--bg:#f6f4ef;--ink:#1f2328;--mute:#6b6f76;--line:#dcd8cf;--card:#fff}@media (prefers-color-scheme:dark){:root{--bg:#16181b;--ink:#e8e6e1;--mute:#9a9ea5;--line:#30343a;--card:#1f2226}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1240px;margin:0 auto;padding:28px 20px 60px}h1{font-size:28px;margin:0 0 6px}h2{font-size:20px;margin:36px 0 8px}p{color:var(--mute);max-width:860px}
img{max-width:100%;image-rendering:pixelated;border:1px solid var(--line);border-radius:8px;background:var(--card)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}figure{margin:0}figcaption{font-size:13px;color:var(--mute)}
table{border-collapse:collapse;font-size:13px;width:100%;background:var(--card)}td,th{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}.m{color:var(--mute)}.key span{display:inline-block;width:12px;height:12px;margin:0 4px 0 12px;vertical-align:-1px;border-radius:2px}`;
const key = [["artery", COL.artery], ["road", COL.road], ["track", COL.track], ["bridge", COL.bridge], ["ferry", [255, 230, 120]], ["sea route", [150, 180, 220]], ["port", [20, 60, 160]], ["inland town", [30, 30, 30]]].map(([k, c]) => `<span style="background:rgb(${c.join(",")})"></span>${k}`).join("");
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The land's veins</title><style>${css}</style></head><body><main>
<h1>The land's veins</h1>
<p>${R.roads.length} roads join ${R.nodes.length} towns on ${R.byIsland.size} islands: ${R.roads.filter((r) => r.cls === "artery").length} arteries, ${R.roads.filter((r) => r.cls === "road").length} roads and ${R.roads.filter((r) => r.cls === "track").length} tracks. ${R.roads.filter((r) => r.bridge && !r.ferry).length} cross water on bridges, and ${R.ferries.length} reach water too wide for their people to bridge and end at a ferry.</p>
<p>How the network is built: each road takes the cheapest way over the ground, and climbing costs more the steeper it gets, so roads go round hills rather than over them. The islands' towns are joined by the fewest roads that connect them all, plus extra roads between pairs that are big and close. Every inland town also gets a road to its nearest port, so every road leads to the sea. The sea routes are drawn faintly between ports.</p>
<p class="key">${key}</p>
<img src="world.png" alt="the world's roads and sea routes">
<h2>The busiest islands</h2><div class="grid">${crops.map((c) => `<figure><img src="island_${c.i}.png" alt="island ${c.id}"><figcaption>${c.towns} towns, ${c.roads} roads: ${esc(c.peoples)}</figcaption></figure>`).join("")}</div>
<h2>Each people's road</h2><p>Lengths in blocks. Bridge spans are the longest a people builds; past that, the road ends at a ferry. Marks and rests are spaced along the way.</p>
<div style="overflow-x:auto"><table><tr><th>People</th><th>Surface, width (artery / road / track)</th><th>Bridges</th><th>Steep ground</th><th>Along the way</th><th>Wet ground, and the rest</th><th>In this world</th></tr>${rows}</table></div>
</main></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`${R.roads.length} roads; ${JSON.stringify(Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, [v.roads, v.bridges, v.ferries, v.tunnel, v.steep, v.ice, v.causeway]])))}`);
