// inherency: plan (Thera's ground, by who lives where)
// Pure. Thera as it is lived in: the whole caldera is the Therans' city (the cone and its terraces, the bay's
// quarters and harbours, the cliff of the caldera's wall); the rim is where the other peoples begin, and each
// people's quarter runs from the rim down the island's gentle outer slope to the sea, on the side of the island
// that faces its homeland. Every wedge is the same breadth: how many live in it is how densely its people builds
// (world/pinnacle.js), not a share handed out.
import { placeAt } from "./theraplan.js";
import { THERA, theraMetres } from "./thera.js";
import { cityAt, unwarp } from "./city.js";

export const CALDERA = [0.95, 1.35];   // vision: the caldera's wall in the bay's own measure, from just inside its foot to past its rim
const K = THERA.KM;
let sectors = null;
/**
 * The outer slope's wedges: each tradition's homeland bearing from Thera (its peoples' capacity-weighted mean),
 * the traditions in bearing order, equal wedges turned to sit as near their homelands as equal wedges can.
 */
export function useSectors(list) {
  const sx = THERA.seat.cx, sz = THERA.seat.cz;
  const by = new Map();
  for (const p of list) {
    if (p.tradition === "therans") continue;
    let dx = p.cx - sx; if (dx > 1024) dx -= 2048; if (dx < -1024) dx += 2048;   // the shorter way round   // vision: the plan's own measure
    const dz = p.cz - sz, w = p.capacity ?? 1, e = by.get(p.tradition) ?? { x: 0, z: 0 };
    const d = Math.hypot(dx, dz) || 1; e.x += (w * dx) / d; e.z += (w * dz) / d; by.set(p.tradition, e);
  }
  const home = [...by].map(([t, e]) => ({ t, a: Math.atan2(e.z, e.x) })).sort((a, b) => a.a - b.a), n = home.length, step = (2 * Math.PI) / n;
  // the turn that puts each wedge's middle nearest its homeland: the circular mean of (homeland - its slot)
  let sx2 = 0, sz2 = 0; home.forEach((h, i) => { sx2 += Math.cos(h.a - i * step); sz2 += Math.sin(h.a - i * step); });
  const turn = Math.atan2(sz2, sx2);
  sectors = home.map((h, i) => ({ tradition: h.t, mid: turn + i * step, home: h.a, half: step / 2 }));
  return sectors;
}
export const sectorsNow = () => sectors;
/** The caldera's middle in the real plane (blocks from Thera's middle): the wedges turn about it. */
const MID = (() => { const B = THERA.bay, [x, y] = unwarp(B.x, B.y); return { u: x * K, v: -y * K }; })();
/** Whose wedge a point of the outer slope is in. */
export function sectorAt(u, v) {
  if (!sectors) return null;
  const a = Math.atan2(v - MID.v, u - MID.u);   // a bearing in the world's own plane (x east, z south), as the homelands'
  let best = null, bd = Infinity;
  for (const s of sectors) { const d = Math.abs(Math.atan2(Math.sin(a - s.mid), Math.cos(a - s.mid))); if (d < bd) { bd = d; best = s; } }
  return best.tradition;
}
/** What a point of Thera is, and whose: { kind, culture, h, bay } (u east, v south, blocks from Thera's middle). */
export function theraPlan(u, v) {
  const t = theraMetres(u / K, -v / K), c = cityAt(u / K, -v / K);
  if (t.m <= 0 || (c.kind !== "land" && c.kind !== "Theran town")) {   // the sea, the bay and the city's works: the bay's quarters are the Therans' own now
    return { kind: c.kind, culture: c.kind === "quarter" || c.kind === "stilt quarter" || t.m > 0 ? "therans" : null, cls: t.m > 0 ? placeAt(u / K, -v / K).cls : undefined, h: t.m / THERA.M, bay: t.bay };   // the cone's city takes the plan's class too (its skirt sparse, its precinct none)
  }
  const p = placeAt(u / K, -v / K);   // the redesign's plan (theraplan.js): who holds the ground, and how built-up it is
  if (p.people === "therans") return { kind: "caldera", culture: "therans", cls: p.cls, quarter: p.quarter, h: t.m / THERA.M, bay: t.bay };   // the caldera's wall and the rim's market: the Therans'
  return { kind: "outer", culture: p.people, cls: p.cls, h: t.m / THERA.M, bay: t.bay };   // the outer slope: the peoples' land, rim to sea, in its classes
}
