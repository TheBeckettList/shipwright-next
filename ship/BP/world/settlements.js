// Pure. The map's places gathered into settlements, so towns stand apart. A place's footprint is estimated by the
// growth's own setup (world/growth.js): its town's ground (its census's footprints and outbuildings, the open share,
// a golden part over for streets), the buffer (55 blocks: the wall, the cemetery, the gardens, the common), and the
// country round it (as much farmland as the town's ground, a golden part over). Places of one people on one island
// whose towns and buffers would overlap are one settlement: their folk added, the biggest's heart its heart; again
// until none overlap. Each place keeps its own key in the sim; the settlement is where its folk live. What still
// overlaps (two peoples, or two settlements' farms) the claims split (world/cities.js).
import { PHI } from "../core/golden.js";
import { peoples } from "./peoples.js";
import { populations } from "./boxes.js";
import { societyOf } from "./society.js";
import { censusOf, buildOf } from "./census.js";
import { atomOf, NEGATIVE } from "./district.js";
import { BUFFER } from "./growth.js";

const cache = new Map();
const footOf = (id, t) => { const k = `${id}|${t}`; if (!cache.has(k)) { const b = buildOf(id, t, 5, null, { split: true }), a = atomOf(b); cache.set(k, a.w * a.l + (b.parts ?? []).reduce((s, p) => { const q = atomOf({ vox: p.vox }); return s + q.w * q.l; }, 0)); } return cache.get(k); };   // vision: one seed stands for its kind
/** A place's town ground (blocks), from its census. */
export function groundOf(p, folk) {
  const soc = societyOf(p), c = censusOf({ t: p.tradition, folk, living: p.living, temper: soc.temper, capital: false }), nu = (NEGATIVE.core + NEGATIVE.edge) / 2;
  return (c.list.reduce((s, { id, n }) => s + footOf(id, p.tradition) * n, 0) / (1 - nu)) * PHI;   // derived: footprints, the open share, the streets a golden part over
}
/** Radii from a town's ground: its city, its city and buffer, the whole with its country. */
export const radiiOf = (A) => { const rc = Math.sqrt(A / Math.PI), rb = rc + BUFFER; return { rc, rb, rr: Math.sqrt(rb * rb + (A * PHI) / Math.PI) }; };   // given: a disc's area
let ALL = null;
/** The settlements: { key (its leader's), t, island, members, folk, at, A, rc, rb, rr }, and by member key. */
export function settlements(epicentreOf) {
  if (ALL) return ALL;
  const list = peoples().list.map((p) => { const folk = populations().get(p.key)?.pop ?? societyOf(p).folk ?? 1, A = groundOf(p, folk); return { p, key: p.key, t: p.tradition, island: p.island, folk, A, at: epicentreOf(p) }; }).sort((a, b) => b.folk - a.folk);
  let sets = list.map((e) => ({ key: e.key, t: e.t, island: e.island, members: [e.key], folk: e.folk, A: e.A, at: e.at, lead: e.p }));
  for (let pass = 0; pass < 2 * sets.length; pass++) {
    let merged = false;
    for (let i = 0; i < sets.length && !merged; i++) for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i], b = sets[j]; if (a.t !== b.t || a.island !== b.island) continue;
      const ra = radiiOf(a.A), rb = radiiOf(b.A), d = Math.hypot(a.at.x - b.at.x, a.at.z - b.at.z);
      if (d >= ra.rb + rb.rb) continue;   // their towns and buffers keep apart
      const [big, small] = a.folk >= b.folk ? [a, b] : [b, a];
      big.members.push(...small.members); big.folk += small.folk; big.A = groundOf(big.lead, big.folk);   // one settlement: the folk added, its ground its census's again
      sets = sets.filter((s) => s !== small); merged = true; break;
    }
    if (!merged) break;
  }
  for (const s of sets) Object.assign(s, radiiOf(s.A));
  const byMember = new Map(); for (const s of sets) for (const m of s.members) byMember.set(m, s);
  return (ALL = { list: sets, byMember });
}
