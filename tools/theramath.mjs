// The Thera redesign's numbers, for review (claude/thera-redesign.md): the ships set the waterways and the bridges,
// the ground's own zones set the areas, and Fibonacci sizes set the buildings. Nothing here is laid yet.
//   node tools/theramath.mjs
import { loadMap } from "../world/load.js"; loadMap();
const T = await import("../world/thera.js"), { FLEETS } = await import("../world/boatsizes.js"), { FIB, PHI } = await import("../core/golden.js");
const KM = 2 * T.THERA.KM, M = T.THERA.M;   // vision: the island twice as big; heights as before (metres a block)
// ---- the ships: each class's largest mast, beam and draft over every people's fleet (boatsizes.js's hull law)
const cls = {};
for (const fleet of Object.values(FLEETS)) for (const t of fleet) { const L = t.range[1], beam = L / t.lb, depth = beam / (t.flat ? PHI * PHI : PHI), draft = depth / PHI, mast = t.masts ? L / PHI : 0, c = (cls[t.cls] ??= { L: 0, beam: 0, draft: 0, mast: 0 });
  c.L = Math.max(c.L, L); c.beam = Math.max(c.beam, beam); c.draft = Math.max(c.draft, draft); c.mast = Math.max(c.mast, mast); }
const MARGIN = FIB[4];   // vision: three blocks over a mast, three of water under a keel... the margin everywhere
const tiers = Object.fromEntries(Object.entries(cls).map(([k, c]) => [k, { clearance: Math.ceil(c.mast) + MARGIN, width: Math.ceil(2 * c.beam * PHI), depth: Math.ceil(c.draft) + 1, L: c.L, beam: +c.beam.toFixed(1), mast: +c.mast.toFixed(1) }]));
// ---- the ground: the zones of today's geometry, at twice the size
const S = 0.02, z = { lagoon: 0, cone: 0, wall: 0, wallBuild: 0, rim: 0, outer: 0 }; let coneTop = 0, wallTop = 0, plateau = 0, rimLen = 0;
for (let x = -9; x <= 9; x += S) for (let y = -9; y <= 11; y += S) { const t = T.theraMetres(x, y), a = S * S; if (t.m <= 0) { if (t.bay < 1) z.lagoon += a; continue; }
  const grade = Math.hypot(T.theraMetres(x + S, y).m - t.m, T.theraMetres(x, y + S).m - t.m) / M / (S * KM);   // the ground's grade in blocks: rise in blocks over run in blocks
  if (t.dome < 1) { z.cone += a; coneTop = Math.max(coneTop, t.m); } else if (t.bay < 1.30) { z.wall += a; wallTop = Math.max(wallTop, t.m); if (grade < 1 / PHI) z.wallBuild += a; } else if (t.bay < 1.45) z.rim += a; else z.outer += a; }
for (let x = -9; x <= 9; x += S) for (let y = -9; y <= 11; y += S) { const t = T.theraMetres(x, y); if (t.dome < 1 && t.m > coneTop / PHI) plateau += S * S; }
const B2 = (km2) => Math.round(km2 * KM * KM), H = (m) => Math.round(m / M);   // block areas, block heights
// ---- the buildings: Fibonacci footprints and heights, a least and a most
const BUILD = {
  "great temple": { min: [34, 55, 55], max: [55, 89, 89] },
  "government seat": { min: [21, 34, 21], max: [34, 55, 34] },
  "navigation house": { min: [21, 21, 34], max: [34, 34, 55] },
  library: { min: [21, 34, 13], max: [34, 55, 21] },
  "Theran forge": { min: [21, 21, 13], max: [34, 34, 21] },
  "great lighthouse": { min: [13, 13, 55], max: [21, 21, 89] },
  "villa (small)": { min: [13, 13, 8], max: [13, 21, 13] },
  "villa (large)": { min: [21, 21, 13], max: [21, 34, 21] },
};   // vision: [across, along, high] in blocks, every one a Fibonacci number
const vol = (b) => b[0] * b[1] * b[2];
// villas: sparse, a golden cube's share of the wall's buildable ground (the rest gardens, stairs, sky), mean lot 17×21
const FILL = 1 / PHI ** 3, LOT = 17 * 21, villas = Math.round((B2(z.wallBuild) * FILL) / LOT);   // vision: a mean lot between the small and the large
// the skyway: a tree over its stops (villa clusters of eight, the forge, the cothon, the rim gates), its length by the
// random-points spanning tree's law (Beardwood–Halton–Hammersley: about 0.71 √(N A) in the plane), each limb thinning
// a Fibonacci step at every fork (5, 3, 2, 1)
const gates = 9, stops = Math.ceil(villas / FIB[5]) + 1 + 1 + gates, A = B2(z.wall + z.cone + z.lagoon), treeLen = Math.round(0.7124 * Math.sqrt(stops * A));   // given: the BHH constant for the plane's spanning tree; vision: nine gates (a gate a wedge)
const RIM_W = (1.45 - 1.30) * ((T.THERA.bay.a + T.THERA.bay.b) / 2) * KM, rimRing = Math.round(B2(z.rim) / RIM_W), stalls = Math.floor(rimRing / FIB[5]);
const out = {
  ships: tiers,
  mouth: { width: 2 * tiers.great.width + FIB[7], depth: tiers.great.depth, note: "two great lanes and the light's islet (21) between" },
  cothon: { roundRadius: Math.ceil(tiers.great.L * PHI), greatBerths: FIB[6], shipBerths: FIB[8], note: "a great ship turns in a radius of its length times phi" },
  zones: { lagoon: B2(z.lagoon), cone: B2(z.cone), conePlateau: B2(plateau), wall: B2(z.wall), wallBuildable: B2(z.wallBuild), rim: B2(z.rim), outer: B2(z.outer) },
  heights: { coneTop: H(coneTop), wallTop: H(wallTop), templeTop: H(coneTop) + 89, worldTop: 63 + H(coneTop) + 89 },
  buildings: Object.fromEntries(Object.entries(BUILD).map(([k, b]) => [k, { min: b.min.join("×"), max: b.max.join("×"), volMin: vol(b.min), volMax: vol(b.max) }])),
  villas: { count: villas, fill: +FILL.toFixed(3), envelope: [villas * vol(BUILD["villa (small)"].min), villas * vol(BUILD["villa (large)"].max)] },
  precinct: { footprintMin: ["great temple", "government seat", "navigation house", "library"].reduce((s, k) => s + BUILD[k].min[0] * BUILD[k].min[1], 0), footprintMax: ["great temple", "government seat", "navigation house", "library"].reduce((s, k) => s + BUILD[k].max[0] * BUILD[k].max[1], 0) },
  skyway: { stops, length: treeLen, widths: [5, 3, 2, 1], blocksAbout: Math.round(treeLen * 2.2) },
  market: { ring: rimRing, bandWidth: Math.round(RIM_W), width: [13, 21], stalls, gates },
};
console.log(JSON.stringify(out, null, 1));
