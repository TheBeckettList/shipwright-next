// inherency: plan (Thera redesigned: claude/thera-redesign.md, claude/thera-houses-and-land.md)
// Pure. Thera as the crown jewel: who holds which ground, and how built-up each place is, before a single house is
// drawn. Two layers over the natural island (thera.js):
//
//   the peoples   every people of the world holds an equal share of the outer slope (the area) in a region whose
//                 shape is free: the slope cut by bearing from the caldera into equal areas (so every region runs
//                 from the rim to its own shore; a region is as wide as the ground there is narrow), the peoples in
//                 their homelands' order, turned to sit each nearest its homeland, on a gently warped plane so the
//                 borders wander like the ground's own lines. A wild corridor runs along every border. The caldera, its
//                 wall and the rim are the Therans'; the Arctic people's own ground is an ice sheet offshore
//   the classes   city, town, village, rural and the waterfront: the contours of a settlement field, not rings.
//                 The field is the caldera's pull, the people's own lean (how it lives: at the shore, mid-slope,
//                 climbing terraces, dispersed), the ground (gentle slopes draw, steep ground repels) and a slow
//                 warp; each people's class lines fall at the field's quantiles for its own shares, so each
//                 region holds exactly what its people builds
//
// The Therans' own zones inside the rim: the summit precinct (the upper half of the cone, ground routes only),
// the cone's skirt (the city, its waterways and the cothon), the wall (city low, town up it), the rim's market ring.
import { THERA, theraMetres } from "./thera.js";
import { geometry, unwarp, CITY } from "./city.js";
import { gnoise } from "../core/noise.js";
import { PHI, FIB } from "../core/golden.js";

const K = THERA.KM;
/** Bands of the bay's own measure (thera.js bayField: 0 at the bay's middle, 1 at its wall's foot). */
export const BANDS = Object.freeze({
  WALL: [0.95, 1.30],     // vision: the caldera's wall, from just inside its foot to below the crest (claude/thera-redesign.md)
  RIM: [1.30, 1.45],      // vision: the rim crest's band: the market ring
  SHORE: FIB[8] / K,      // derived: the waterfront's band, thirty-four blocks in from the coast (km)
  CORRIDOR: FIB[7] / K,   // derived: the wild corridor along every border, twenty-one blocks wide (km)
});
/** Each people's lean, by s (0 at the rim, 1 at the shore), and its shares of town, village and rural (the rest of its land is the waterfront and the corridors). */
export const LEAN = Object.freeze({
  indian_ocean: { at: (s) => s * s, shares: [0.38, 0.38, 0.24] },          // vision: to the shore: the souq town and the dhow harbour
  european: { at: (s) => Math.exp(-(((s - 0.5) * 3) ** 2)), shares: [0.15, 0.24, 0.61] },   // vision: a town mid-slope, wide orchards and vineyards
  japanese: { at: (s) => 0.6 * s + 0.4 * Math.exp(-(((s - 0.3) * 4) ** 2)), shares: [0.09, 0.38, 0.53] },   // vision: terraces climbing from the harbour, a shrine town
  east_asian: { at: (s) => Math.exp(-(((s - 0.45) * 3) ** 2)), shares: [0.24, 0.24, 0.52] },  // vision: a walled town on the best shelf
  norse: { at: (s) => 0.3 + 0.7 * s ** 3, shares: [0, 0.15, 0.85] },      // vision: farmsteads, a harbour village, no town
  pacific: { at: (s) => s ** 3, shares: [0, 0.38, 0.62] },                 // vision: strung along the beach, groves inland
  birchbark: { at: () => 0.5, shares: [0, 0.38, 0.62] },                   // vision: dispersed in the groves along the streams
  dugout: { at: (s) => s ** 4, shares: [0, 0.24, 0.76] },                  // vision: one plank-house village on its canoe beach
  shallow: { at: (s) => s ** 5, shares: [0, 0.38, 0.62] },                 // vision: stilt villages at the shore
  arctic: { at: (s) => s ** 6, shares: [0, 0.15, 0.85] },                  // vision: their village is the ice sheet; the land above is rural
});
export const CLASSES = ["city", "town", "village", "rural", "waterfront", "wild", "market", "precinct", "skirt", "lagoon", "sea", "ice"];
export const FILL = Object.freeze({ city: 1 / PHI ** 2, town: 1 / PHI ** 3, village: 1 / PHI ** 5, rural: 1 / PHI ** 8, waterfront: 1 / PHI ** 3 });   // derived: the houses' share falls a golden step a class

const MID = { x: THERA.bay.x, y: THERA.bay.y };   // the caldera's middle (km)
const warp = (x, y) => [x + 0.35 * gnoise(x / 1.6, y / 1.6, 601), y + 0.35 * gnoise(x / 1.6, y / 1.6, 607)];   // vision: the borders' wander, a third of a km over a km and a half
const bearingOf = (x, y) => Math.atan2(y - MID.y, x - MID.x);
const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
/** Which region a bearing falls in (each spans a0 to a1, turning anticlockwise), and how far it is from its nearest border (radians). */
function regionOf(a, seeds) { for (let i = 0; i < seeds.length; i++) { const s = seeds[i], span = ((s.a1 - s.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), d = ((a - s.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); if (d < span) return i; } return 0; }
function borderGap(a, s) { const span = ((s.a1 - s.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), d = ((a - s.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return Math.min(d, span - d); }
let plan = null;

/**
 * Balance the peoples' regions. sectors: [{ tradition, home (radians, the world's own plane: x east, z south) }].
 * Returns the plan: seeds, weights, measured shares, and the per-people field quantiles.
 */
export function usePeoples(sectors, { step = 0.05 } = {}) {   // vision: a sample every 50 m
  const pts = [];
  for (let x = -9; x <= 11; x += step) for (let y = -9; y <= 12; y += step) {   // vision: the island's plane, km, round the seat (thera.js's reach)
    const t = theraMetres(x, y); if (t.m <= 0 || t.bay < BANDS.RIM[1]) continue;
    pts.push({ x, y, m: t.m, bay: t.bay });
  }
  // s: 0 at the rim, 1 at the shore, by height (the rim's height down to the sea)
  const rimH = Math.max(...pts.filter((p) => p.bay < BANDS.RIM[1] + 0.05).map((p) => p.m), 1);   // vision: the rim's foot, a twentieth of the bay's measure past its band
  for (const p of pts) p.s = Math.max(0, Math.min(1, 1 - p.m / rimH));
  // the regions: the outer slope cut by bearing (from the caldera's middle, on the warped plane) into equal areas,
  // the peoples in their homelands' order round the ring, the whole turned to sit each region's middle as near its
  // homeland as equal areas allow (the least sum of squared turns, over a ring of trial turns)
  const n = sectors.length, order = [...sectors].sort((a, b) => -a.home - -b.home);   // the plane's bearing is the world's turned over (y north)
  const W = pts.map((p) => warp(p.x, p.y)), th = W.map(([x, y]) => bearingOf(x, y)), sorted = [...th].sort((a, b) => a - b);
  const cutAt = (k, off) => sorted[Math.floor(((k / n + off) % 1) * sorted.length)];   // the bearing below which (from the turn's start) k shares of the area lie
  let best = null;
  for (let j = 0; j < FIB[10]; j++) {   // vision: eighty-nine trial turns
    const off = j / FIB[10], cuts = Array.from({ length: n + 1 }, (_, k) => cutAt(k, off));   // derived: eighty-nine trial turns (Fibonacci's tenth)
    let cost = 0; const mids = [];
    for (let i = 0; i < n; i++) { const a0 = cuts[i], a1 = cuts[i + 1], span = ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), mid = a0 + span / 2; mids.push(mid); cost += turn(mid, -order[i].home) ** 2; }
    if (!best || cost < best.cost) best = { cost, cuts, mids };
  }
  const seeds = order.map((s, i) => ({ tradition: s.tradition, a0: best.cuts[i], a1: best.cuts[i + 1], a: best.mids[i], home: -s.home, off: turn(best.mids[i], -s.home) }));
  const owner = new Int16Array(pts.length), area = new Array(n).fill(0);
  for (let k = 0; k < pts.length; k++) { owner[k] = regionOf(th[k], seeds); area[owner[k]]++; }
  // each people's settlement field, and its class lines at the quantiles of its shares
  const byP = Array.from({ length: n }, () => []);
  for (let k = 0; k < pts.length; k++) { const p = pts[k], f = fieldAt(p, seeds[owner[k]].tradition); p.f = f; byP[owner[k]].push(f); }
  const cuts = byP.map((fs, i) => { const L = LEAN[seeds[i].tradition] ?? LEAN.european, s = [...fs].sort((a, b) => b - a), q = (share) => s[Math.min(s.length - 1, Math.floor(share * s.length))] ?? -Infinity; const [t, v] = L.shares; return { town: t ? q(t) : Infinity, village: q(t + v) }; });
  // the Arctic people's tarn: a frozen lake high in their own land (their village is on its ice): the highest of
  // their region's points whose ground is gentle enough to hold a lake its radius across, the lake's level two
  // blocks under the ground there
  const ai = seeds.findIndex((q) => q.tradition === "arctic"); let tarn = null;
  if (ai >= 0) { const R = TARN.r; for (let k = 0; k < pts.length; k++) { if (owner[k] !== ai) continue; const p = pts[k]; if (tarn && p.m <= tarn.m) continue;
    let ok = true; for (let a = 0; a < FIB[5] && ok; a++) { const q = theraMetres(p.x + R * PHI * Math.cos((a * Math.PI) / 4), p.y + R * PHI * Math.sin((a * Math.PI) / 4)); if (q.m < p.m - TARN.depth * THERA.M * PHI || q.bay < BANDS.RIM[1]) ok = false; }   // derived: eight bearings a golden share past its shore, none lower than its depth and a golden share (it holds its water), none in the rim's band
    if (ok) tarn = { x: p.x, y: p.y, m: p.m }; }
    if (tarn) tarn = { ...tarn, r: R, level: tarn.m / THERA.M - 2, depth: TARN.depth }; }   // vision: the ice two blocks under the ground's level there
  plan = { seeds, cuts, rimH, tarn, shares: area.map((a) => a / pts.length), n: pts.length, step };
  return plan;
}
export const planNow = () => plan;
// ---- the cascading pools: down the cone's flank toward the mouth (where the old round harbour was), a chain of
// terraced pools rimmed in white (travertine, as Pamukkale's), each spilling through a notch to the next. The first
// holds the Horaia's island; each after it is one of the world's waters: a warm reef, a lush cave pool, a mangrove,
// a cold pool, a deep one, a river's
export const POOL_KINDS = ["theran", "warm", "lush", "mangrove", "cold", "deep", "river"];
export function cascadePools() {
  // where the round lake was (on the cone's flank toward the mouth, a golden share out), the Horaia on its island in
  // the middle pool, and a ring of pools round it, each at its own ground's height, so on the slope they step down
  // round the tree, each spilling to the next pool below it: falls and pools filling the old crater
  const Dm = THERA.dome, mouth = THERA.strait.path[0], axis = Math.atan2(mouth[1] - Dm.y, mouth[0] - Dm.x), out = [];
  const cx = Dm.x + Math.cos(axis) * Dm.r / PHI, cy = Dm.y + Math.sin(axis) * Dm.r / PHI;   // derived: a golden share of the cone's radius out
  const at = (x, y) => Math.floor(theraMetres(x, y).m / THERA.M) - 1;
  out.push({ kind: POOL_KINDS[0], x: cx, y: cy, r: FIB[7] / K, level: at(cx, cy), depth: FIB[4] - 1, island: FIB[5] / K });   // derived: the middle pool twenty-one out, its island eight
  const n = POOL_KINDS.length - 1, ring = (FIB[7] + FIB[6] + 2) / K;   // derived: the ring's pools set round it, their middles thirty-six out (its radius, theirs, a rim between)
  for (let k = 0; k < n; k++) { const a = axis + (k * 2 * Math.PI) / n, x = cx + ring * Math.cos(a), y = cy + ring * Math.sin(a), r = (k % 2 ? FIB[6] : FIB[5]) / K;   // derived: thirteen and eight out by turns
    if (theraMetres(x, y).m < 3 * THERA.M) continue; out.push({ kind: POOL_KINDS[k + 1], x, y, r: Math.min(r, FIB[6] / K), level: at(x, y), depth: FIB[4] - 1, island: 0 }); }   // vision: none within three blocks of the sea (the plan's numbers: the ring's pools by kind)
  // each spills toward the nearest pool lower than it (the lowest spills down the slope, toward the sea)
  for (const p of out) { let best = null; for (const q of out) if (q !== p && q.level < p.level) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (!best || d < best.d) best = { d, q }; } p.to = best ? { x: best.q.x, y: best.q.y } : { x: p.x + Math.cos(axis), y: p.y + Math.sin(axis) }; }
  return out;
}

/** The Arctic tarn's size: radius (km) and depth (blocks). */
export const TARN = Object.freeze({ r: FIB[9] / K, depth: FIB[4] });   // derived: fifty-five blocks across its radius, five deep (Fibonacci's)

// ---- the Theran city's quarters: five, round the caldera's wall, each the wall's own character there
//   the quarters split the wall by bearing into five equal arcs; each arc's ground (its steepness, whether it
//   faces the mouth, the summit or the morning) gives it its character, and each character leans the house grammar
export const QUARTER_KINDS = Object.freeze({
  cliff: { lean: { cave: 3, tower: 1 }, note: "the steepest arc: cave houses cut into the wall, stairs, the views" },   // vision: the lean's weights
  harbour: { lean: { courtyard: 2, terrace: 1 }, note: "the arc by the mouth: shipwrights, chandlers, the trade harbour's quays" },
  scholars: { lean: { courtyard: 2, chapel: 1 }, note: "the arc facing the summit's front: the library's schools, the observers" },
  gardens: { lean: { terrace: 3, chapel: 1 }, note: "the gentlest arc: terrace villas among vines, olives and gardens" },   // vision: the lean's weights
  makers: { lean: { tower: 2, courtyard: 1 }, note: "the forge's arc: workshops, kilns, the forge itself" },
});
let quarters = null;
/** The wall's five arcs and their kinds: measured once (steepness by sampling, the mouth's bearing from the strait). */
export function theranQuarters() {
  if (quarters) return quarters;
  const n = FIB[4], B = THERA.bay, mouth = Math.atan2(THERA.strait.path[0][1] - B.y, THERA.strait.path[0][0] - B.x), front = Math.atan2(THERA.dome.y - B.y, THERA.dome.x - B.x) + Math.PI;   // derived: five, Fibonacci's; the summit's front faces away from where the dome sits off the bay's middle
  const arcs = Array.from({ length: n }, (_, i) => { const a0 = mouth + ((i - 0.5) * 2 * Math.PI) / n, a1 = a0 + (2 * Math.PI) / n, mid = (a0 + a1) / 2; let steep = 0, k = 0;
    for (let a = a0; a < a1; a += 0.02) for (let r = 0.9; r < 1.3; r += 0.02) { const x = B.x + r * B.a * Math.cos(a), y = B.y + r * B.b * Math.sin(a), t = theraMetres(x, y); if (t.m <= 0 || t.bay < BANDS.WALL[0] || t.bay >= BANDS.WALL[1]) continue; steep += Math.hypot(theraMetres(x + 0.02, y).m - t.m, theraMetres(x, y + 0.02).m - t.m); k++; }   // vision: the arcs sampled every 20 mrad and 2% of the bay's measure, from inside the wall's foot to past its crest
    return { i, a0, a1, mid, steep: k ? steep / k : 0 }; });
  const taken = new Set(), pick = (name, score) => { const a = arcs.filter((q) => !taken.has(q.i)).sort((p, q) => score(q) - score(p))[0]; a.name = name; taken.add(a.i); };
  pick("harbour", (q) => -Math.abs(turn(q.mid, mouth)));     // the arc at the mouth
  pick("cliff", (q) => q.steep);                              // the steepest left
  pick("scholars", (q) => -Math.abs(turn(q.mid, front)));     // the one facing the summit's front
  pick("gardens", (q) => -q.steep);                           // the gentlest left
  pick("makers", () => 0);                                    // the last: the forge's
  quarters = arcs; return arcs;
}
/** The Theran quarter at a point of the wall (by its bearing from the bay's middle). */
export function quarterAt(x, y) { const a = Math.atan2(y - THERA.bay.y, x - THERA.bay.x); return theranQuarters().find((q) => { const d = ((a - q.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return d < q.a1 - q.a0; }) ?? null; }

// ---- the skyways: a tree from the cone's skirt to every quarter of the wall, and on up to the rim
//   each quarter has a trunk from the cone's skirt (below the cone's halfway line: no air way above it), bowed a
//   little, over the lagoon at the great ships' clearance; a golden share of the way across it forks into two
//   branches that land on the wall either side of the quarter's middle; from each landing a limb climbs the wall
//   to the rim, drifting outward, landing at the city's, the town's and the market's lines; a twig joins the two
//   limbs at the town's line (the sparse cross-link)
export const DECK = 30;   // derived: theramath.mjs: the great ships' clearance (their tallest mast and three), blocks over the sea
export function skyways() {
  const B = THERA.bay, Dm = THERA.dome, out = [], at = (a, r) => [B.x + r * B.a * Math.cos(a), B.y + r * B.b * Math.sin(a)];
  for (const q of theranQuarters()) {
    // the trunk's root: on the cone's skirt toward the quarter, where the ground is a third of the cone's height (under its halfway line)
    const g = geometry(), [hx, hy] = unwarp(g.roundAt.x, g.roundAt.y), clear = CITY.cothon.round + CITY.cothon.sheds + CITY.cothon.quay;   // the cothon's round lake and its sheds: no trunk roots in them or crosses them
    const crosses = (x0, y0, x1, y1) => { for (let t = 0; t <= 1; t += 0.02) if (Math.hypot(x0 + (x1 - x0) * t - hx, y0 + (y1 - y0) * t - hy) < clear) return true; return false; };   // vision: a check every fiftieth of the way
    let root = null; for (let r = 0.2; r < 1.2; r += 0.01) { const x = Dm.x + r * Dm.r * Math.cos(q.mid), y = Dm.y + r * Dm.r * Math.sin(q.mid), m = theraMetres(x, y).m; if (m < Dm.top / 3) { root = [x, y, m / THERA.M]; break; } }   // derived: a third, under the half
    if (root && crosses(Dm.x, Dm.y, root[0], root[1])) { root = null; for (const turn of [0.35, -0.35, 0.7, -0.7]) { for (let r = 0.2; r < 1.2; r += 0.01) { const a = q.mid + turn, x = Dm.x + r * Dm.r * Math.cos(a), y = Dm.y + r * Dm.r * Math.sin(a), m = theraMetres(x, y).m; if (m < Dm.top / 3) { if (!crosses(Dm.x, Dm.y, x, y) && Math.hypot(x - hx, y - hy) > clear) root = [x, y, m / THERA.M]; break; } } if (root) break; } }   // vision: turned a third of a radian or two-thirds, either way, round the lake
    if (!root) continue;
    const footAt = (ang) => { for (let r = 0.7; r < 1.3; r += 0.005) { const [x, y] = at(ang, r), m = theraMetres(x, y).m; if (m > 0) return [x, y, Math.max(DECK, m / THERA.M)]; } return null; };   // vision: the search for the wall's foot, in the bay's measure, a two-hundredth a step
    const climb = (ang, from, drift) => { const pts = [from]; let a = ang;   // a limb up the wall: a landing at each class's line, drifting a little as it climbs (a branch, not a spoke)
      for (const up of [1 / PHI ** 2, 1 / PHI, 1]) { a += drift; const r = BANDS.WALL[0] + up * (BANDS.RIM[0] - BANDS.WALL[0]);
        for (let rr = 0.8; rr < 1.6; rr += 0.005) { const [x, y] = at(a, rr), t = theraMetres(x, y); if (t.m > 0 && t.bay >= r) { pts.push([x, y, t.m / THERA.M]); break; } } }   // vision: the search up the wall, in the bay's measure
      return pts; };
    const span = q.a1 - q.a0, feet = [-1, 1].map((side) => ({ side, a: q.mid + (side * span) / PHI ** 3, f: footAt(q.mid + (side * span) / PHI ** 3) })).filter((f) => f.f);   // derived: the two feet a golden cube's share of the arc either side
    if (!feet.length) continue;
    // the trunk to the fork, over the water, a golden share of the way to the wall; a slight bow so it isn't a spoke
    const mean = feet.reduce((m, f) => [m[0] + f.f[0] / feet.length, m[1] + f.f[1] / feet.length], [0, 0]), fork = [root[0] + (mean[0] - root[0]) / PHI, root[1] + (mean[1] - root[1]) / PHI, DECK];
    const bow = (p, r2, k) => [(p[0] + r2[0]) / 2 + k * (r2[1] - p[1]) / PHI ** 4, (p[1] + r2[1]) / 2 - k * (r2[0] - p[0]) / PHI ** 4, DECK];   // vision: a bow of a golden fourth power of the span
    out.push({ quarter: q.name, kind: "trunk", pts: [root, bow(root, fork, 1), fork] });
    for (const f of feet) {
      out.push({ quarter: q.name, kind: "branch", pts: [fork, bow(fork, f.f, -f.side), f.f] });
      out.push({ quarter: q.name, kind: "limb", pts: climb(f.a, f.f, (f.side * span) / FIB[8]) });   // derived: the limb drifts outward a thirty-fourth of the arc a landing
    }
    // a twig between the limbs, up the quarter's middle from the second landing of the first: the skyway's sparse cross-link
    const l0 = out[out.length - 3], l1 = out[out.length - 1];   // derived: the first limb is three ways back (its branch, the second branch, the second limb)
    if (l0.pts[2] && l1.pts[2]) out.push({ quarter: q.name, kind: "twig", pts: [l0.pts[2], l1.pts[2]] });
  }
  return out;
}

/** The settlement field at an outer-slope point: the caldera's pull, the people's lean, the ground, a slow warp. */
function fieldAt(p, tradition) {
  const L = LEAN[tradition] ?? LEAN.european, d = Math.hypot(p.x - MID.x, p.y - MID.y);
  const G = 0.144, grade = Math.hypot(theraMetres(p.x + G, p.y).m - theraMetres(p.x - G, p.y).m, theraMetres(p.x, p.y + G).m - theraMetres(p.x, p.y - G).m) / (2 * G * 1000);   // derived: metres a metre (a thousand to a km), over 144 m either way (the lie of the land, not its roughness)
  return Math.exp(-d / 6) / PHI + L.at(p.s) - grade * PHI ** 2 + 0.25 * gnoise(p.x / 1.165, p.y / 1.165, 613) + 0.06 * gnoise(p.x / 0.445, p.y / 0.445, 617);   // vision: the pull over six km, the warps' weights; derived: the warps at 233 and 89 blocks (km at 1:5)
}

/** What a point of Thera is: { cls, people, s } (x east, y north, km in the island's plane). */
export function placeAt(x, y) {
  const t = theraMetres(x, y);
  if (t.m <= 0) {
    if (t.bay < 1) return { cls: "lagoon", people: "therans" };
    return { cls: "sea", people: null };
  }
  if (t.dome < 1) return { cls: t.m > THERA.dome.top / 2 ? "precinct" : "skirt", people: "therans" };   // the upper half of the cone: the precinct, its ways on the ground only
  if (t.bay < BANDS.WALL[1]) { const up = (t.bay - BANDS.WALL[0]) / (BANDS.WALL[1] - BANDS.WALL[0]), q = quarterAt(x, y); return { cls: up < 1 / PHI ** 2 ? "city" : up < 1 / PHI ? "town" : "village", people: "therans", quarter: q?.name }; }   // derived: up the wall a golden step a class (the city low, the town midway, villas scattered toward the rim)
  if (t.bay < BANDS.RIM[1]) return { cls: "market", people: "therans" };
  if (!plan) return { cls: "rural", people: null };
  if (plan.tarn) { const d = Math.hypot(x - plan.tarn.x, y - plan.tarn.y); if (d < plan.tarn.r) return { cls: "ice", people: "arctic" }; if (d < plan.tarn.r + BANDS.CORRIDOR) return { cls: "village", people: "arctic" }; }   // the tarn's ice, and the Arctic village's shore round it
  const [wx, wy] = warp(x, y), a = bearingOf(wx, wy), best = regionOf(a, plan.seeds), me = plan.seeds[best];
  if (borderGap(a, me) * Math.hypot(wx - MID.x, wy - MID.y) < BANDS.CORRIDOR / 2) return { cls: "wild", people: null };   // the wild corridor along the border (a turn times the radius is a distance)
  const people = me.tradition;
  if (nearSea(x, y)) return { cls: "waterfront", people };
  const s = Math.max(0, Math.min(1, 1 - t.m / plan.rimH)), f = fieldAt({ x, y, m: t.m, s }, people), c = plan.cuts[best];
  return { cls: f >= c.town ? "town" : f >= c.village ? "village" : "rural", people, s };
}
/** Is the sea within the waterfront's band? (eight bearings) */
function nearSea(x, y) { for (let k = 0; k < FIB[5]; k++) { const a = (k * 2 * Math.PI) / FIB[5]; if (theraMetres(x + BANDS.SHORE * Math.cos(a), y + BANDS.SHORE * Math.sin(a)).m <= 0) return true; } return false; }   // derived: eight bearings
