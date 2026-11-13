// Draws towns as their boxes (world/boxes.js): quarters, the houses in them, plazas, wells, the
// hall and the market, the piers, the main streets, the walls; and the world's population map.
//   node tools/boxmap.mjs world out.png            the world: every settlement by population and tier
//   node tools/boxmap.mjs <people|tradition|thera> out.png
import fs from "node:fs";
import { encode } from "./png.js";
import { loadMap } from "../world/load.js";
import { map } from "../world/map.js";
import { loop } from "../world/history.js";
import { peoples } from "../world/peoples.js";
import { economy } from "../world/economy.js";
import { populations, townOf, theraBoxes } from "../world/boxes.js";
import { blockHeight } from "../world/map.js";
import { D } from "../core/given.js";
const [what = "world", out = "boxes.png"] = process.argv.slice(2);
loadMap();
const L = loop(), POP = populations();
const COL = { house: [205, 190, 165], plaza: [235, 225, 200], well: [70, 120, 200], bell: [230, 190, 40], street: [150, 140, 125], hall: [180, 60, 50], market: [230, 160, 40], pier: [120, 80, 40], "district plaza": [220, 205, 170], quarter: [120, 160, 90], "dock quarter": [140, 160, 120], "theran quarter": [240, 240, 250] };   // vision: the map's colours
const TIER = { camp: [170, 170, 170], hamlet: [120, 200, 120], village: [60, 160, 220], town: [240, 170, 40], city: [230, 50, 50], "city-state": [160, 60, 200] };   // vision: the tiers' colours
if (what === "world") {
  const M = map(), S = 2, W = M.w / S, H = M.h / S, img = new Uint8Array(W * H * 3);   // vision: half the chunks
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = M.data[(y * S) * M.w + x * S], land = v >= 128; img.set(land ? [150 + (v - 128) * 0.4, 150 + (v - 128) * 0.3, 110] : [30 + v * 0.3, 60 + v * 0.4, 110 + v * 0.4], (y * W + x) * 3); }   // vision: the map's land and sea
  const P = [...POP.entries()].map(([k, v]) => ({ p: peoples().byKey.get(k), ...v })).sort((a, b) => a.pop - b.pop);
  for (const s of P) { const r = Math.max(1, Math.sqrt(s.pop) / 6), cx = s.p.cx / S, cz = s.p.cz / S; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r) continue; const x = Math.round(cx + dx), y = Math.round(cz + dy); if (x >= 0 && y >= 0 && x < W && y < H) img.set(TIER[s.tier], (y * W + x) * 3); } }   // vision: a dot's radius from the square root of its folk
  fs.writeFileSync(out, encode(W, H, img, 3));
  const tiers = {}; for (const s of P) { tiers[s.tier] ??= { n: 0, pop: 0 }; tiers[s.tier].n++; tiers[s.tier].pop += s.pop; }
  console.log(`world: ${P.reduce((a, s) => a + s.pop, 0).toLocaleString()} folk; ${Object.entries(tiers).map(([t, v]) => `${v.n} ${t}s (${v.pop.toLocaleString()})`).join(", ")}`);
} else {
  let T, label, ground = null;
  if (what === "thera") { T = theraBoxes(); label = `Thera: ${T.docks} dock quarters and ${T.theran} Theran quarters, ${T.households} households`; }
  else { const i = L.findIndex((q) => q.key === what || q.tradition === what), p = L[i], R = economy(1), v = POP.get(p.key); T = townOf(p, R.state[i].site, v.pop, v.tier); label = `${p.key} (${p.tradition}) ${v.tier}: ${v.pop} folk (${v.own} its own, ${v.drawn} drawn by its market), ${T.households} households in ${T.quarters} quarters, ${T.districts} districts, ${T.piers} piers${T.wall ? `, a ${T.wall.shape} ${T.wall.kind} with ${T.wall.gates.length} gates` : ""}`; ground = (x, z) => blockHeight(((T.x + x) % D.W + D.W) % D.W, T.z + z); }
  const all = T.boxes.flatMap((b) => [b, ...(b.parts ?? [])]);
  let x0 = Math.min(...all.map((b) => b.x)) - 20, x1 = Math.max(...all.map((b) => b.x + b.w)) + 20, z0 = Math.min(...all.map((b) => b.z)) - 20, z1 = Math.max(...all.map((b) => b.z + b.l)) + 20;   // vision: a margin, in blocks
  if (T.wall?.r) { x0 = Math.min(x0, -T.wall.r - 8); x1 = Math.max(x1, T.wall.r + 8); z0 = Math.min(z0, -T.wall.r - 8); z1 = Math.max(z1, T.wall.r + 8); }
  const S = Math.max(1, Math.floor(900 / Math.max(x1 - x0, z1 - z0))), W = Math.ceil((x1 - x0) * S), H = Math.ceil((z1 - z0) * S), img = new Uint8Array(W * H * 3);   // vision: about 900 pixels
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = ground ? ground(x0 + x / S, z0 + y / S) : 1; img.set(h <= 0 ? [70, 110, 170] : [150 + Math.min(60, h), 175, 120], (y * W + x) * 3); }   // vision: sea and land
  const rect = (b, c) => { for (let y = Math.floor((b.z - z0) * S); y < (b.z + b.l - z0) * S; y++) for (let x = Math.floor((b.x - x0) * S); x < (b.x + b.w - x0) * S; x++) if (x >= 0 && y >= 0 && x < W && y < H) img.set(c, (y * W + x) * 3); };
  const line = (ax, az, bx, bz, w, c) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) * S); for (let k = 0; k <= n; k++) { const t = k / Math.max(1, n), x = ax + (bx - ax) * t, z = az + (bz - az) * t; rect({ x: x - w / 2, z: z - w / 2, w, l: w }, c); } };
  for (const st of T.streets ?? []) line(st.x0, st.z0, st.x1, st.z1, st.w, COL.street);
  for (const b of T.boxes) { rect(b, COL[b.kind] ?? [200, 200, 200]); for (const q of b.parts ?? []) rect(q, (q.kind === "house" && b.storeys) ? [175, 150, 120] : COL[q.kind] ?? [200, 200, 200]); }
  if (T.wall) { const c = [90, 70, 60]; if (T.wall.shape === "circle") { for (let a = 0; a < 2 * Math.PI; a += 0.5 / T.wall.r) { if (T.wall.gates.some((g) => Math.abs(((a - g.a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < g.w / 2 / T.wall.r)) continue; rect({ x: T.wall.r * Math.cos(a) - 1, z: T.wall.r * Math.sin(a) - 1, w: 2, l: 2 }, c); } } else { const P2 = T.wall.points; for (let k = 0; k < P2.length; k++) { const [ax, az] = P2[k], [bx, bz] = P2[(k + 1) % P2.length]; line(ax, az, bx, bz, 2, c); } } }   // vision: the gate's gap in the circle
  fs.writeFileSync(out, encode(W, H, img, 3)); console.log(label);
}
