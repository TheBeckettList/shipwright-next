// The redesigned Thera's plan from above (world/theraplan.js): each people's region in its own hue, each class a
// shade of it (town darkest, rural lightest), the corridors green, the Therans' caldera in white and gold.
//   node tools/theraplanmap.mjs out.png [km a pixel] [--classes]   (--classes: the classes alone: town red, village amber, rural pale green, waterfront cyan)
import fs from "node:fs";
import { encode } from "./png.js";
import { loadMap } from "../world/load.js"; loadMap();
const P = await import("../world/peoples.js"), TC = await import("../world/theracity.js"), TP = await import("../world/theraplan.js");
let ps = P.peoples(); ps = Array.isArray(ps) ? ps : ps.list;
const sectors = TC.useSectors(ps), t0 = Date.now(), plan = TP.usePeoples(sectors);
console.log(`balanced in ${Date.now() - t0} ms over ${plan.n} samples; shares ${plan.seeds.map((s, i) => `${s.tradition} ${(plan.shares[i] * 100).toFixed(1)}%`).join(", ")}`);
const out = process.argv[2] ?? "thera-plan.png", step = +(process.argv[3] ?? 0.025), x0 = -9, y1 = 12, N = Math.round(21 / step), img = new Uint8Array(N * N * 3), count = {};
const HUE = { indian_ocean: [196, 120, 60], european: [150, 90, 170], japanese: [200, 70, 90], east_asian: [210, 170, 50], norse: [90, 120, 170], pacific: [60, 160, 150], birchbark: [140, 110, 70], dugout: [170, 80, 50], shallow: [90, 170, 90], arctic: [150, 190, 220] };   // vision: a hue a people
const SHADE = { town: 0.6, village: 0.8, rural: 1.05, waterfront: 0.45 };
const FIXED = { lagoon: [70, 130, 200], sea: [40, 90, 170], wild: [70, 120, 60], precinct: [217, 194, 122], skirt: [245, 243, 236], city: [235, 232, 222], market: [200, 140, 60] };
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + i * step, y = y1 - j * step, p = TP.placeAt(x, y); count[p.cls] = (count[p.cls] ?? 0) + 1;
  if (process.argv.includes("--classes")) { const CL = { town: [190, 70, 60], village: [235, 170, 80], rural: [200, 215, 120], waterfront: [60, 200, 210] }; if (CL[p.cls]) { img.set(CL[p.cls], (j * N + i) * 3); continue; } }
  let c = FIXED[p.cls] ?? (p.people === "therans" ? [225, 222, 210] : (HUE[p.people] ?? [128, 128, 128]).map((v) => Math.min(255, v * (SHADE[p.cls] ?? 1))));
  if (p.people === "therans" && p.quarter) { const QT = { cliff: [236, 228, 214], harbour: [214, 230, 238], scholars: [240, 236, 214], gardens: [222, 236, 210], makers: [238, 222, 214] }, base = QT[p.quarter], k = { city: 0.9, town: 0.97, village: 1.04 }[p.cls] ?? 1; c = base.map((v) => Math.min(255, v * k)); }   // vision: a pale tint a quarter, darker where denser
  img.set(c, (j * N + i) * 3); }
// the skyways, drawn over: the trunks gold-brown, the stems and limbs a darker line
const px = (x, y) => [Math.round((x - x0) / step), Math.round((y1 - y) / step)];
for (const w of TP.skyways()) for (let k = 0; k + 1 < w.pts.length; k++) { const [a, b] = [px(w.pts[k][0], w.pts[k][1]), px(w.pts[k + 1][0], w.pts[k + 1][1])], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let t = 0; t <= n; t++) { const i = Math.round(a[0] + ((b[0] - a[0]) * t) / n), j = Math.round(a[1] + ((b[1] - a[1]) * t) / n); for (const [di, dj] of [[0, 0], [1, 0], [0, 1]]) if (i + di >= 0 && j + dj >= 0 && i + di < N && j + dj < N) img.set(w.kind === "trunk" ? [150, 110, 60] : [110, 90, 70], ((j + dj) * N + i + di) * 3); } }
fs.writeFileSync(out, encode(N, N, img, 3));
const tot = Object.values(count).reduce((a, b) => a + b, 0); console.log(out, Object.entries(count).map(([k, v]) => `${k} ${(v / tot * 100).toFixed(1)}%`).join(", "));
