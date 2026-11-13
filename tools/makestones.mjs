// Made once, after the map: the stepping stones that keep a small boat's crossings on its route round the
// world to VISION.CROSSING (320 blocks), hidden. The route is the hop graph's own (world/islands.js around, at the sim's
// least hop that goes round, the square cays retired); along each crossing longer than a small boat dares, a chain of stones wanders from coast to
// coast (each the last's 122 to 320 blocks on, its bearing up to 34 degrees off the far coast's), and round every
// stone of the chain a golden square of decoys on the same shelf, so the route is one path through an archipelago.
// Sizes follow Korcak's law for real islands (the k-th largest k^-phi of the largest), 8 to 89 blocks across; kinds by
// the stone's climate. Written to world/stones.json, laid over the ground (world/stones.js).
//   node tools/makestones.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
loadMap(undefined, { stones: false });
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { VISION, D } = await import("../core/given.js");
const { FIB, FIBS, PHI, golden } = await import("../core/golden.js");
const { mod } = await import("../core/fixed.js");
const { islands, around } = await import("../world/islands.js");
const { climateAtBlock } = await import("../world/climate.js");
const { blockHeight } = await import("../world/map.js");
const I = islands(), W = I.W, X = VISION.CROSSING;
const HOPS = [VISION.HOP, FIBS[9], FIBS[10], FIBS[11], FIBS[12]];   // vision: the sim's hop, then on up the Fibonacci numbers till a way round opens
let R = null; for (const g of HOPS) { R = around(g); if (R.ok) { console.log(`a way round at a hop of ${g} cells`); break; } }
if (!R.ok) throw new Error("no route round at any hop tried");
const toCoast = (k) => { let c = k; while (I.dist[c] > 0) { const ci = c % W, cj = (c / W) | 0; let next = c; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nj = cj + b; if (nj < 0 || nj >= I.H) continue; const nk = nj * W + mod(ci + a, W); if (I.near[nk] === I.near[c] && I.dist[nk] === I.dist[c] - 1) { next = nk; break; } } if (next === c) break; c = next; } return { x: ((c % W) + 0.5) * D.PX, z: (((c / W) | 0) + 0.5) * D.PX }; };
let n = 0; const out = [], WRAP = D.W;
const sizeOf = () => { const u = golden(n * FIB[4] + 1); return FIB[5] * (FIB[10] / FIB[5]) ** (u ** PHI); };   // Korcak's law, small ones the commonest: 8 .. 89 blocks across
const kindOf = (x, z, d) => { const c = climateAtBlock(x, z), r = golden(n * FIB[6] + 2);
  if (c.T < -4) return "ice floe"; if (c.T > 24) return r < 1 / PHI ** 2 ? "atoll" : r < 1 / PHI ? "sand cay" : d > FIB[9] && r > 1 - 1 / PHI ** 3 ? "mangrove islet" : "reef flat";
  if (c.T > 18) return r < 1 / PHI ? "sand cay" : "skerry"; return r < 1 / PHI ** 3 ? "sea stack" : r < 1 / PHI ? "skerry" : "sand cay"; };   // vision: the kinds by climate and the draw
const heightOf = (kind, d) => ({ "ice floe": FIB[2], atoll: FIB[2], "reef flat": 0, "sand cay": FIB[2] + Math.round(golden(n) * FIB[2]), skerry: FIB[3] + Math.round(golden(n) * FIB[4]), "sea stack": FIB[6] + Math.round(golden(n) * FIB[7]), "mangrove islet": FIB[1] }[kind] ?? FIB[2]);   // vision: each kind's top, from the doc's table
const put = (x, z, route) => { const d = sizeOf(), kind = kindOf(x, z, d); if (blockHeight(x, z) > -1) return null; const s = { x: Math.round(mod(x, WRAP)), z: Math.round(z), r: Math.round((d / 2) * 10) / 10, h: heightOf(kind, d), kind, s: Math.round(golden(n * FIB[7] + 3) * 1000) / 1000, route }; n++; out.push(s); return s; };   // never on land
let chains = 0, routeStones = 0;
for (const h of R.cycle) {
  if (h.gap * D.PX <= X) continue;
  const A = toCoast(h.ka), B = toCoast(h.kb); let dx = B.x - A.x; if (dx > WRAP / 2) dx -= WRAP; if (dx < -WRAP / 2) dx += WRAP;
  let x = A.x, z = A.z; const bx = A.x + dx, bz = B.z; chains++;
  for (let guard = 0; Math.hypot(bx - x, bz - z) > X && guard < FIB[10] * FIB[5]; guard++) {   // vision: a chain's bound
    const toB = Math.atan2(bz - z, bx - x), wander = ((golden(n * FIB[5] + 5) - 0.5) * 2 * FIB[8] * Math.PI) / 180, step = X / PHI ** 2 + (X - X / PHI ** 2) * golden(n * FIB[3] + 7);   // derived: up to 34 degrees off; 122 to 320 blocks on
    x += Math.cos(toB + wander) * step; z += Math.sin(toB + wander) * step;
    const s = put(x, z, true); if (!s) continue; routeStones++;
    const decoys = Math.floor(PHI ** 2) + (golden(n * FIB[8] + 11) < PHI ** 2 % 1 ? 1 : 0);   // derived: phi squared of them on average
    for (let k = 0; k < decoys; k++) { const a = 2 * Math.PI * golden(n * FIB[9] + 13), r = X / PHI + FIB[10] * PHI * golden(n * FIB[6] + 17); put(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, false); }   // derived: a golden share of a crossing to past two out
  }
}
fs.writeFileSync(path.join(ROOT, "world/stones.json"), JSON.stringify({ about: "the hidden stepping stones (tools/makestones.mjs): route and decoys alike", crossing: X, stones: out }));
console.log(`route round: ${R.cycle.length} hops, ${chains} crossings past ${X} blocks; ${routeStones} route stones, ${out.length - routeStones} decoys`);
