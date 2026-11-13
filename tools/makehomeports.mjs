// Made once, after the ground, the towns' sites and the stones: the thirteen homeports the League charts for the players
// who join. The k-th is looked for at a bearing of k golden angles from Thera, 2,584 to 10,946 blocks out; of the shore
// spots there that keep every bound (the towns' footprints, the other homeports, the stones, the climate, the island's
// size), the best by shelter (bearings meeting land within 233 blocks), the pad's ease and the water off it. Its lode,
// 652 ore blocks of every kind in Fibonacci counts, is laid in the beds under its pad. Written to world/homeports.json.
//   node tools/makehomeports.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
loadMap();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { D } = await import("../core/given.js");
const { FIB, FIBS, PHI, golden } = await import("../core/golden.js");
const { THERA } = await import("../world/thera.js");
const { heightAt } = await import("../game/ground.js");
const { climateAtBlock, seaDistance } = await import("../world/climate.js");
const { stones } = await import("../world/stones.js");
const { epicentreOf } = await import("../world/cities.js");
const { settlements } = await import("../world/settlements.js");
const { islands } = await import("../world/islands.js");
const { HOME } = await import("../world/homesites.js");
const SX = THERA.seat.cx * D.PX, SZ = THERA.seat.cz * D.PX, I = islands(), S = settlements(epicentreOf).list, ST = stones();
const H = (x, z) => heightAt(Math.round(x), Math.round(z)).h;
const islandOf = (x, z) => { const i = ((Math.floor(x / D.PX) % I.W) + I.W) % I.W, j = Math.floor(z / D.PX); const id = I.label[j * I.W + i]; return id >= 0 ? I.info[id] : null; };
const out = [], why = {}, no = (w) => { why[w] = (why[w] ?? 0) + 1; return true; };
for (let k = 0; k < HOME.COUNT; k++) {
  const bearing = k * HOME.TURN; let best = null;
  for (const spread of [HOME.SPREAD, Math.PI]) { if (best) break;   // its bearing's own country first; failing that, the best spot left anywhere in the ring
  for (let dr = HOME.NEAR; dr <= HOME.FAR; dr += FIB[7]) for (let da = -spread; da <= spread; da += (spread === Math.PI ? FIB[8] : FIB[7]) / dr) {   // derived: every 21 blocks out and across (34 round the whole ring)
    const a = bearing + da, x = SX + Math.cos(a) * dr, z = SZ + Math.sin(a) * dr, h = H(x, z);
    if ((h < 1 || h > FIB[7] || seaDistance(Math.floor(x / D.PX), Math.floor(z / D.PX)) > D.PX) && no("not shore")) continue;   // derived: land up to 21 blocks high in a cell by the sea   // derived: a shore spot: three to 21 blocks over the sea
    const isle = islandOf(x, z); if (!isle && no("no island")) continue; const across = 2 * Math.sqrt(isle.area / Math.PI) * D.PX; if (across < HOME.ISLE[0] && no("island too small")) continue; const small = across <= HOME.ISLE[1];   // an island small enough to know is wanted; a big one's coast will do
    const cl = climateAtBlock(x, z); if ((cl.T < HOME.T[0] || cl.T > HOME.T[1] || cl.M < HOME.M[0] || cl.M > HOME.M[1]) && no("climate")) continue;
    if (S.some((s) => Math.hypot(s.at.x - x, s.at.z - z) < s.rr + HOME.FROM_TOWNS) && no("towns")) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < HOME.FROM_HOMES) && no("homeports")) continue;
    if (ST.some((s) => s.route && Math.hypot(s.x - x, s.z - z) < HOME.FROM_STONES) && no("stones")) continue;
    let wet = null; for (let r = 1; r <= FIB[10] && !wet; r += 2) for (let q = 0; q < FIB[5] && !wet; q++) { const b = (2 * Math.PI * q) / FIB[5]; if (H(x + Math.cos(b) * r, z + Math.sin(b) * r) <= -FIB[3]) wet = { r, b }; }   // derived: three deep within 89 blocks (a quay's run out; the yard dredges the rest), looked for on eight bearings
    if (!wet && no("no deep water")) continue;
    let shelter = 0; for (let q = 0; q < FIB[6]; q++) { const b = (2 * Math.PI * q) / FIB[6]; for (let r = FIB[7]; r <= FIBS[12]; r += FIB[7]) if (H(x + Math.cos(b) * r, z + Math.sin(b) * r) > 0) { shelter++; break; } }   // derived: thirteen bearings, land within 233 blocks
    let slope = 0; for (let q = 0; q < FIB[5]; q++) { const b = (2 * Math.PI * q) / FIB[5]; slope += Math.abs(H(x + Math.cos(b) * FIB[9] / 2, z + Math.sin(b) * FIB[9] / 2) - h) / (FIB[9] / 2) / FIB[5]; }   // derived: the pad's slope over its half-width (44 blocks)
    const v = (shelter / FIB[6]) * Math.exp(-slope * FIB[3]) * (1 + 1 / wet.r) * (small ? PHI : 1);   // derived: a small island a golden share better
    if (!best || v > best.v) best = { x: Math.round(x), z: Math.round(z), v, shelter, slope, wet, island: isle.id, T: cl.T, M: cl.M, dist: dr };
  } }
  if (!best) { console.log(`homeport ${k}: no spot keeps every bound near its bearing`); continue; }
  // the lode: fixed counts of every ore, at the beds' contacts under the pad (y -21 up to under the soil), spread by the golden sequence
  const lode = []; let n = 0;
  const top = 62 + Math.round(H(best.x, best.z)) - FIB[4];   // given: the sea's level; five blocks under the pad's top
  for (const [id, count] of HOME.LODE) for (let c = 0; c < count; c++, n++) { const a = 2 * Math.PI * golden(n * FIB[5] + k), r = (HOME.LODE_ACROSS / 2) * Math.sqrt(golden(n * FIB[6] + 2 * k + 1)), y = Math.round(HOME.LODE_FLOOR + (top - HOME.LODE_FLOOR) * golden(n * FIB[7] + 3 * k)); lode.push([Math.round(best.x + Math.cos(a) * r), y, Math.round(best.z + Math.sin(a) * r), id]); }   // derived: spread over the body by area (the root), its depth by the golden sequence
  const seam = { x: Math.round(best.x + Math.cos(best.wet.b) * best.wet.r * 0.8), z: Math.round(best.z + Math.sin(best.wet.b) * best.wet.r * 0.8) };   // the seam that shows at the waterline, toward the water
  out.push({ k, x: best.x, z: best.z, pad: Math.round(H(best.x, best.z)), bay: Math.round((best.wet.b * 180) / Math.PI), shelter: best.shelter, island: best.island, dist: Math.round(best.dist), T: +best.T.toFixed(1), M: +best.M.toFixed(2), lode, seam });
  console.log(`homeport ${k}: (${best.x}, ${best.z}), ${Math.round(best.dist)} from Thera, shelter ${best.shelter}/13, T ${best.T.toFixed(1)}, M ${best.M.toFixed(2)}, island ${best.island}`);
}
fs.writeFileSync(path.join(ROOT, "world/homeports.json"), JSON.stringify({ about: "the League's homeports for joining players (tools/makehomeports.mjs)", homeports: out }));
console.log(`${out.length} of ${HOME.COUNT} homeports; spots refused: ${JSON.stringify(why)}`);
