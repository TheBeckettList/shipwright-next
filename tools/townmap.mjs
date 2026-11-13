// Draws a people's town as its math lays it out, at two moments, side by side: districts, walls (and
// the old wall line, if it outgrew it), gates, water and ground.
//   node tools/townmap.mjs <people key|tradition> <month a> <month b> out.png
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
import { peoples } from "../world/peoples.js";
import { loop, firstWorld, bake } from "../world/history.js";
import { economy } from "../world/economy.js";
import { monthRecords } from "../world/buildings.js";
import { layout, wallKeys, LAYOUT } from "../world/settlement.js";
import { encode } from "./png.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const [key, ma, mb, out = "town.png"] = process.argv.slice(2);
loadMap();
const L = loop(), p = peoples().byKey.get(key) ?? L.find((q) => q.tradition === key), i = L.indexOf(p);
const COL = { harbour: [30, 70, 140], civic: [200, 60, 60], market: [235, 170, 50], homes: [235, 225, 205], crafts: [150, 100, 70], farms: [190, 200, 90], pasture: [120, 170, 90] };   // vision: the map's colours
function snap(m) {
  const R = economy(Math.max(1, m)), s = R.state[i], recs = monthRecords(Math.max(1, m)), w = firstWorld(); w.record = recs[Math.max(0, m - 1)].slice();
  const b = bake(w), enemy = b.borders.find((x) => (x.a === p.key || x.b === p.key) && x.state === "contested");
  let enemyDir = null;
  if (enemy) { const q = peoples().byKey.get(enemy.a === p.key ? enemy.b : enemy.a); let di = q.cx - p.cx; if (di > 1024) di -= 2048; if (di < -1024) di += 2048; const n = Math.hypot(di, q.cz - p.cz) || 1; enemyDir = { i: di / n, j: (q.cz - p.cz) / n }; }   // given: half and all the map's chunks round
  return { m, s: { built: s.built.slice() }, T: layout(p, s.site, s.plan, s.built, { enemyDir, memory: s.memory }), enemy: !!enemy };   // a copy: the economy runs on
}
const A = snap(Number(ma)), B = snap(Number(mb));
// crop to the town: the plots either moment's districts or walls take, and a margin
let ext = 6; for (const X of [A, B]) for (const q of [...X.T.owner.keys(), ...X.T.walls]) ext = Math.max(ext, Math.abs(q.i) + 4, Math.abs(q.j) + 4);   // vision: the crop's margin, in plots
const R = Math.min(LAYOUT.REACH, ext), S = Math.max(4, Math.floor(480 / (2 * R + 1))), n = (2 * R + 1) * S, img = new Uint8Array(n * 2 * n * 3).fill(245);   // vision: about 480 pixels a side
const oldWalls = wallKeys(A.T);
[A, B].forEach((X, side) => {
  const wk = wallKeys(X.T), gk = new Set(X.T.gates.map((q) => `${q.i},${q.j}`));
  for (const q of X.T.grid.plots) {
    if (Math.abs(q.i) > R || Math.abs(q.j) > R) continue;
    let c = q.water ? [150, 195, 225] : [Math.min(255, 150 + q.h), Math.min(255, 160 + q.h * 0.6), 120];
    const d = X.T.owner.get(q); if (d) c = COL[d];
    const k = `${q.i},${q.j}`;
    if (side === 1 && oldWalls.has(k) && !wk.has(k)) c = [130, 120, 110];
    if (wk.has(k)) c = [60, 55, 50];
    if (gk.has(k)) c = [250, 250, 250];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const px = (q.i + R) * S + x + side * n, py = (q.j + R) * S + y; img.set(c, (py * 2 * n + px) * 3); }
  }
});
const tmp = fs.mkdtempSync("/tmp/town-"); fs.writeFileSync(path.join(tmp, "rgb.bin"), Buffer.from(img.buffer));
const label = (X) => `month ${X.m}: ${X.s.built.filter(Boolean).length} buildings, ${Object.entries(X.T.counts).map(([k, v]) => `${k} ${v}`).join(", ")}${X.T.walls.length ? `; wall ${X.T.walls.length} plots` : ""}${X.enemy ? "; a contested border" : ""}`;
fs.writeFileSync(path.join(tmp, "meta.json"), JSON.stringify({ w: 2 * n, h: n, title: `${p.key}: ${p.tradition} ${p.living}, ${p.temper} (wind from ${A.T.wind.toFixed(0)})`, a: label(A), b: label(B) }));
execFileSync("python3", [path.join(here, "townmap.py"), tmp, out], { stdio: "inherit" });
console.log(label(A)); console.log(label(B));
