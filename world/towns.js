// Pure. The Theran towns, found on the ground: every kind of town (therans.js TOWN_KINDS) scores
// every place on a grid over the island and takes its best, keeping its spacing from the towns
// already sited. Each town says how it builds (the blend) from its own ground.
import { THERA, theraMetres } from "./thera.js";
import { fbm } from "../core/noise.js";
import { TOWN_KINDS, blendAt } from "./therans.js";

export const TOWN_GRID = 0.05;                          // vision: km between the places scored (50 m)
const STRAIT_MOUTH = THERA.strait.path[0];

let cache = null;
export function towns() {
  if (cache) return cache;
  const g = TOWN_GRID, xs = [], pts = [];
  for (let x = -6.8; x <= 9.4; x += g) xs.push(x);   // vision: the island's reach (km)
  const top = THERA.massifs[0][6] / THERA.M;   // vision: the island's reach (km)
  for (let y = -8.8; y <= 9.8; y += g) for (const x of xs) {   // vision: as above
    const t = theraMetres(x, y);
    if (t.m <= 0) continue;
    const e = theraMetres(x + g, y).m, n = theraMetres(x, y + g).m;
    const slope = Math.hypot(e - t.m, n - t.m) / THERA.M / (g * THERA.KM);   // derived: blocks of rise a block of run, as the game shows it
    pts.push({ x, y, h: t.m / THERA.M, slope, bay: t.bay, what: t.what, strait: Math.hypot(t.x - STRAIT_MOUTH[0], t.y - STRAIT_MOUTH[1]) });
  }
  // how far each place is from the sea, and whether it's a local summit (by the grid)
  const key = (x, y) => `${Math.round(x / g)},${Math.round(y / g)}`, at = new Map(pts.map((p) => [key(p.x, p.y), p]));
  for (const p of pts) {
    let c = Infinity;
    for (let r = 1; r <= 40 && c === Infinity; r++) for (let a = -r; a <= r; a++) for (const [dx, dy] of [[a, -r], [a, r], [-r, a], [r, a]]) if (!at.has(key(p.x + dx * g, p.y + dy * g))) c = Math.min(c, Math.hypot(dx, dy) * g);   // vision: look 2 km for the sea
    p.coast = c;
    p.peak = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dy]) => (at.get(key(p.x + dx * g, p.y + dy * g))?.h ?? -1) <= p.h);   // vision: higher than everything 100 m round
  }
  const out = [];
  for (const K of TOWN_KINDS) {
    const ranked = pts.filter((p) => p.what !== "Pre-Kameni").map((p) => ({ p, s: K.score(p) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
    let named = 0;
    for (const { p, s } of ranked) {
      if (named >= K.count) break;
      if (out.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < Math.max(K.spacing, o.spacing))) continue;
      // the blend over the town's whole ground (a cliff town spills over the rim and down the face)
      const ground = pts.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < K.radius);
      const mix = { cave: 0, akrotiri: 0, whitewash: 0 };
      for (const q of ground) { const b = blendAt({ slope: q.slope, h: q.h, top }); for (const k in mix) mix[k] += b[k] / ground.length; }
      for (const k in mix) mix[k] = +mix[k].toFixed(2);
      out.push({ name: K.names[named++], kind: K.kind, x: p.x, y: p.y, h: Math.round(p.h), radius: K.radius, spacing: K.spacing, score: +s.toFixed(2), blend: mix, ground: ground.length });
    }
  }
  cache = out;
  return out;
}
/**
 * The town a real point (km) lies in, if any. A town spreads over the ground it can build on: its
 * edge frays with the ground (noise), it thins out where the ground is too steep for its way of
 * building (a cave town keeps to its cliff; the others keep off it), and it never takes the sea.
 */
export function townAt(x, y) {
  for (const t of towns()) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d > t.radius * 1.6) continue;   // vision: the farthest a ragged edge reaches
    const fray = 0.65 + 0.7 * fbm(x * 9, y * 9, 211, 3);   // vision: how ragged (0.65 to 1.35 of its radius), nine to the km
    if (d > t.radius * fray) continue;
    const here = theraMetres(x, y), e = theraMetres(x + 0.02, y).m, n = theraMetres(x, y + 0.02).m;   // vision: a 20 m step
    if (here.m <= 0) continue;
    const slope = Math.hypot(e - here.m, n - here.m) / THERA.M / (0.02 * THERA.KM);   // vision: as the step above
    const steepOk = t.blend.cave > 0.25 ? true : slope < 1.2;   // vision: the steepest a house that isn't cut into rock stands on
    if (!steepOk) continue;
    return t;
  }
  return null;
}
