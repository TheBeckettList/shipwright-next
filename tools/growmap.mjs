// A grown town's plan from above (world/growth.js): the ground by height, the sand's depth, the water, the streets by
// class, each building's footprint (a household's lot parts paler).
//   node tools/growmap.mjs <tradition> [rank] out.png [px]
import fs from "node:fs";
import { loadMap } from "../world/load.js";
import { peoples } from "../world/peoples.js";
import { cityOf } from "../world/cities.js";
import { populations } from "../world/boxes.js";
import { societyOf } from "../world/society.js";
import { blockHeight } from "../world/map.js";
import { growOf } from "../world/growth.js";
import { seaOf } from "../world/shipping.js";
import { climateAt } from "../world/climate.js";
import { encode } from "./png.js";
loadMap();
const [tr = "norse", rank = "0", out = "grow.png", pxs = "2"] = process.argv.slice(2), PX = Number(pxs);
const p = peoples().list.filter((q) => q.tradition === tr).sort((a, b) => (populations().get(b.key)?.pop ?? 0) - (populations().get(a.key)?.pop ?? 0))[Number(rank)];
const t0 = Date.now(), city = cityOf(p, { seed: 11 }), g = city.place, sea = city.sea;   // the settlement as the world grows it (world/cities.js)
const { N, occ, P, h, wet, can } = g.grid, img = new Uint8Array(N * PX * N * PX * 3), Pm = g.pour.max || 1;
const COL = { artery: [70, 40, 30], road: [120, 90, 60], path: [175, 150, 110] };
const sc = new Int8Array(N * N); for (let k = 0; k < N * N; k++) if (occ[k] === -2) sc[k] = g.grid.cls[k];
for (let k = 0; k < N * N; k++) {
  let c;
  if (wet[k] && !can[k]) c = [60, 100, 170];
  else { const v = Math.max(0, Math.min(1, h[k] / 60)); c = [110 + 80 * v, 150 + 60 * v, 90 + 70 * v]; if (!can[k]) c = [120, 120, 120]; if (P[k] > 0) { const d = P[k] / Pm; c = [c[0] * (1 - d * 0.3) + 230 * d * 0.3, c[1] * (1 - d * 0.3) + 210 * d * 0.3, c[2] * (1 - d * 0.3) + 150 * d * 0.3]; } }
  if (occ[k] === -2) c = [COL.path, COL.road, COL.artery][sc[k] - 1] ?? COL.path;
  if (occ[k] >= 0) { const q = g.placed[occ[k]]; if (q.farm !== undefined) { const X2 = k % N, Z2 = Math.floor(k / N); for (let a = 0; a < PX; a++) for (let b = 0; b < PX; b++) { const o = ((Z2 * PX + a) * N * PX + X2 * PX + b) * 3; img[o] = 120; img[o + 1] = 70; img[o + 2] = 30; } continue; } c = q.of !== undefined ? [200, 120, 110] : /home/.test(q.atom.home ? "home" : "") ? [150, 50, 40] : [70, 60, 130]; if (q.pathed) c = [200, 40, 200]; }
  const X = k % N, Z = Math.floor(k / N);
  for (let a = 0; a < PX; a++) for (let b = 0; b < PX; b++) { const o = ((Z * PX + a) * N * PX + X * PX + b) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; }
}
const R = g.grid.R, dot = (x, z, c, r = 1) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const X = Math.round(x) + R, Z = Math.round(z) + R; if (X + a < 0 || Z + b < 0 || X + a >= N || Z + b >= N) continue; for (let u = 0; u < PX; u++) for (let v = 0; v < PX; v++) { const o = (((Z + b) * PX + u) * N * PX + (X + a) * PX + v) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; } } };
for (const f of g.farms ?? []) { const m = f.m, at2 = (lx, lz) => [f.ox[0] + lx * f.ex[0] + lz * f.ez[0], f.ox[1] + lx * f.ex[1] + lz * f.ez[1]]; for (let lx = 0; lx < m.W; lx++) for (let lz = 0; lz < m.L; lz++) { const fl = m.fields.find((q) => lx >= q.x0 && lx <= q.x1 && lz >= q.z0 && lz <= q.z1), edge = lx === 0 || lx === m.W - 1 || lz === m.L - 1 || (fl && (lx === fl.x0 || lz === fl.z0 || lz === fl.z1)); const col = edge ? [110, 80, 50] : lz < m.yard ? [150, 140, 100] : lx === m.trackX ? [175, 150, 110] : !fl ? [120, 160, 80] : fl.kind === "crop" ? [205, 185, 90] : fl.kind === "orchard" ? [70, 120, 50] : fl.kind === "meadow" ? [160, 190, 100] : [120, 170, 80]; dot(...at2(lx, lz), col, 0); } }
const SC = { quay: [230, 230, 230], pier: [160, 110, 60], mole: [90, 90, 90], track: [150, 100, 50] };
for (const st of g.streets) if (SC[st.cls]) for (const [x, z] of st.pts) dot(x, z, SC[st.cls], st.cls === "pier" ? 0 : 1);
for (const [x, z] of g.wall?.cells ?? []) dot(x, z, g.wall.kind === "stone" ? [60, 60, 70] : [90, 50, 20], 1);
for (const [x, z] of g.wall?.gates ?? []) dot(x, z, [250, 250, 250], 1);
for (const [x, z] of g.wall?.towers ?? []) dot(x, z, [30, 30, 30], 2);
for (const lt of g.port?.lights ?? []) dot(lt.x, lt.z, [255, 230, 40], 3);
for (const sl of g.port?.slips ?? []) dot(sl.x, sl.z, [255, 140, 0], 2);
fs.writeFileSync(out, encode(N * PX, N * PX, img, 3));
console.log(JSON.stringify({ wall: g.wall && { kind: g.wall.kind, cells: g.wall.cells.length, gates: g.wall.gates.length }, rural: g.measures.rural, port: g.port && { infra: g.port.infra, level: g.port.level, keep: g.port.keep, measures: g.port.measures, piers: g.port.piers.length, mole: !!g.port.mole, lights: g.port.lights, slips: g.port.slips.length }, sea: sea.shore, measures: { ...g.measures, why: undefined, fails: undefined } }));
const m = g.measures; console.log(`${tr} ${p.key} (settlement of ${city.settlement?.members.length ?? 1}, folk ${city.pop}): ${g.placed.filter((q) => q.of === undefined).length} of ${g.placed.filter((q) => q.of === undefined).length + g.dropped} buildings, ${g.streets.length} streets, ease ${m.ease.toFixed(2)}, ${Date.now() - t0} ms -> ${out}`);
