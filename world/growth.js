// Pure. A town grown as a crystal grows: on its own ground, from a seed, by its people's habit.
//
//   the plane     the ground is a warped plane: its metric tensor G = I + (phi^3)^2 grad h grad h^T (a step up the
//                 fall line costs more than one along the contour, as roads.js's grade cost), and the walk D from
//                 the epicentre is the geodesic distance in it. Water is crossed at a bridge's cost, never built on
//                 (but by the stilt peoples, over the shallows)
//   the ease      a site's ease of build: the earthwork its footprint asks, the cut and fill to level it. Over a
//                 building's depth (RING blocks) the ground's spread sigma (its standard deviation, from integral
//                 images of h and h^2) is the mean depth of cut or fill a block, and ease = exp(-sigma): a block of
//                 spread is a third as easy (given: the block). A town follows its ease: streets avoid the hard ground
//                 and buildings take the easiest of the sites their street gives them
//   the pour      the town's mass (its census, every building's footprint by its height, with the open ground it keeps)
//                 is poured over its box as sand: the pile stands at its angle of repose on the ground, measured along
//                 the walk, P(p) = max(0, top - REPOSE D(p) - (h(p) - h0)), its top found so the pile's volume is the
//                 mass. The pile's depth is the town's density: it fills a valley, thins up a slope, stops at a cliff or
//                 the sea, and where it ends the town ends. Deep sand rises: a house takes storeys where the pile
//                 stands over its own height, one for each golden step
//   the frame     the town's lattice. A harmonic field u (the graph Laplacian over the pile's cells, each edge's
//                 conductance the ease at both ends, u = 0 at the epicentre and 1 where the pile ends) is the warped
//                 polar plane fitted to the town's blob: its gradient the radials, its level sets the rings. The frame
//                 is a 4-direction field held as a complex number, F = e^(4 i theta), so the four ways a street can go
//                 add as vectors: the people's habit (radial: grad u; axis: the pile's long axis; shore: across the
//                 water's distance; contour: across grad h) plus the ground's contours weighted by its slope squared;
//                 then smoothed by the graph Laplacian (Jacobi), so the lattice bends rather than breaks
//   the growth    the streets are the crystal's arms. The arteries are geodesics from the epicentre to the exits;
//                 roads and paths trace the frame from them (each step the frame's direction nearest the last, with
//                 the habit's wobble), branching across at each block's length, densest sand first; a street ends at
//                 the pile's edge, at a climb steeper than its class takes, or where it comes within half a block's
//                 spacing of another street, which it joins (a T: the crystal's grain boundary). They stop growing
//                 when the frontage they give holds the town's buildings
//   the bond      the buildings attach to the streets only (Kossel's crystal grows only where a new unit bonds to
//                 the surface): each is a molecule fitted to the lattice, its front to its street at the street's own
//                 cant, its door on it. A site's energy is its ease, its sand, and its bonds: a kink, beside a
//                 building already on that frontage, is the most bonded, so rows grow along streets as a crystal's
//                 steps advance. What must front what is the frontage: the arteries carry the trade and the halls,
//                 the roads the work and the shops, the paths the homes and the yards, the water the harbour's
//   the cant      a building turns to its street by a quarter turn and a cant, the cant snapped to a slope a voxel
//                 wall can hold cleanly (Farey's slopes of small denominators: 0, 1/3, 1/2, 1), so a canted wall
//                 steps evenly
import { FIB, PHI } from "../core/golden.js";
import { hashAt, vnoise as vnoiseG } from "../core/noise.js";
import { buildOf, censusOf, TYPES } from "./census.js";
import { atomOf, bondOf, ROWS, LANE, STILTED, BRIDGE, NEGATIVE, RING, QUARTER, shapeOf } from "./district.js";
import { PINNACLE } from "./pinnacle.js";
import { STOREYS } from "./periodic.js";
import { harbourPlan } from "./harbour.js";
import { moduleOf, MODULE } from "./farms.js";

// ---- the habits: each people's crystal (vision: after their towns' real forms)
//   frame     the lattice it grows by;  arteries  how many main streets leave the core;  contour  how far the ground's
//   contours bend its lattice;  wobble  radians a block its streets wander;  branch  the chance a cross street
//   grows at each block's length;  long  a block's length in spacings;  spacing  how far apart parallel streets
//   stand, in lot depths;  grain  how far each district's lattice turns from the town's (a polycrystal's misorientation, in
//   eighths of a turn: 0 one crystal, a single grid)
export const HABIT = {
  european: { grain: 1 / PHI, crystal: "dendrite: radiocentric, arms and rings", frame: "radial", arteries: FIB[4], contour: 1, wobble: 1 / FIB[6], branch: 1 / PHI, long: 1, spacing: 1 },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  therans: { grain: 0, crystal: "terrace: step-flow round a screw dislocation", frame: "contour", arteries: FIB[3], contour: PHI ** 2, wobble: 0, branch: 1, long: PHI, spacing: 1, stairs: true },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  indian_ocean: { grain: 1, crystal: "fractal aggregate: diffusion-limited, dense dead ends", frame: "radial", arteries: FIB[4], contour: 1, wobble: 1 / FIB[4], branch: 1 / PHI, long: 1 / PHI, spacing: 1 / PHI },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  east_asian: { grain: 0, crystal: "cubic: halite's square lattice", frame: "axis", arteries: FIB[2] * 2, contour: 1 / PHI ** 2, wobble: 0, branch: 1, long: PHI, spacing: 1 },
  japanese: { grain: 1 / PHI ** 3, crystal: "cubic, strained: the grid bent to the slope", frame: "axis", arteries: FIB[2] * 2, contour: 1, wobble: 1 / FIB[8], branch: 1, long: PHI, spacing: 1 },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  norse: { grain: 1 / PHI, crystal: "needle: acicular, along the shore", frame: "shore", arteries: FIB[2], contour: 1, wobble: 1 / FIB[7], branch: 1 / PHI ** 2, long: PHI, spacing: 1 },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  dugout: { grain: 1, crystal: "spherulite: a cluster round its commons", frame: "radial", arteries: FIB[2], contour: 1, wobble: 1 / FIB[5], branch: 1 / PHI, long: 1 / PHI, spacing: PHI },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  birchbark: { grain: 1, crystal: "spherulite: a cluster round its commons", frame: "radial", arteries: FIB[2], contour: 1, wobble: 1 / FIB[5], branch: 1 / PHI, long: 1 / PHI, spacing: PHI },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  pacific: { grain: 1, crystal: "spherulite with its ring: round the malae", frame: "radial", arteries: FIB[3], contour: 1, wobble: 1 / FIB[6], branch: 1 / PHI, long: 1, spacing: PHI },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  shallow: { grain: 1 / PHI, crystal: "needle on posts: the boardwalk", frame: "shore", arteries: FIB[2], contour: 1 / PHI, wobble: 1 / FIB[7], branch: 1 / PHI, long: 1, spacing: 1 },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  arctic: { grain: 1, crystal: "snowflake: six short arms", frame: "radial", arteries: FIB[3] * 2, contour: 1, wobble: 1 / FIB[6], branch: 1 / PHI ** 2, long: 1 / PHI, spacing: PHI },   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
};
// ---- the cant: how far each people turns its houses off the square to meet a street (vision: after their towns).
//   cants  the slopes a house may take (CANTS by index: 0 square, 1 a third, 2 a half, 3 the diagonal);  cardinal  the
//   lattice is the world's own square (north-south, east-west), the grid laid true and every house square to it
export const CANT = Object.fromEntries(Object.keys(HABIT).map((t) => [t, { cants: [0], cardinal: t === "japanese" || t === "east_asian" }]));   // every people builds square to the world; its streets may slant (the sawtooth takes up the angle). The cardinal peoples lay their streets true as well
// ---- the country round a town: its farms and ranches (vision: a farmstead feeds eight households; the herders' are
// ranches by a golden share, the farmers' by a golden cube, the fishers' a golden square; a ring of 55 blocks' walk)
export const FARM = {
  BAND: FIB[10], SPACING: FIB[9], FIELD: FIB[9], PER: FIB[5], PER_FISHERS: FIB[6],   // vision: the ring's walk (89), farmsteads 55 apart at the least (the country, not a suburb), their fields 55 out at most, eight (or thirteen) households a farmstead
  RANCH: { herders: 1 / PHI, farmers: 1 / PHI ** 3, fishers: 1 / PHI ** 2 },   // vision: the ranches' share by how a people lives
  BUILD: { farm: ["farmhouse", "barn", "granary"], ranch: ["farmhouse", "byre", "shearing"] },   // a farm's house, its barn, its granary; a ranch's house, its byre, its shearing shed
  IDS: new Set(["farmhouse", "barn", "byre", "granary", "shearing"]),
};
// ---- the town's wall: what each people encloses its town with, from what size, and how often (vision: after their own:
// the palisaded villages of the Haudenosaunee and the Northwest Coast, the Norse ring-forts, the European burh and its
// stone, the walled towns of China, the Japanese earth bank, the Maori pa, the coral walls of the Swahili towns)
export const WALLS = {
  european: [{ level: 3, kind: "stone", share: 1 }, { level: 2, kind: "palisade", share: 1 / PHI }],   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
  norse: [{ level: 2, kind: "palisade", share: 1 / PHI }],
  birchbark: [{ level: 1, kind: "palisade", share: 1 / PHI }], dugout: [{ level: 2, kind: "palisade", share: 1 / PHI ** 2 }],
  pacific: [{ level: 2, kind: "palisade", share: 1 / PHI ** 2 }],
  east_asian: [{ level: 3, kind: "stone", share: 1 }, { level: 2, kind: "earth", share: 1 }],   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
  japanese: [{ level: 3, kind: "earth", share: 1 / PHI ** 2 }],   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
  indian_ocean: [{ level: 3, kind: "stone", share: 1 / PHI }],   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
  therans: [], shallow: [], arctic: [],
};
export const WALL_OUT = FIB[5];   // vision: the wall eight blocks out from the town's closed edge
export const BUFFER = FIB[9];     // vision: 55 blocks between town and country (asked for about 50): the wall, its ditch, the cemetery, the gardens, the common
// ---- the street classes: [width, the steepest climb a block it takes] (vision: a cart's, a mule's, a walker's)
export const CLASS = { artery: { rank: 3, width: FIB[3], climb: 1 / PHI ** 2 }, quay: { rank: 3, width: FIB[3], climb: 1 / PHI ** 2 }, road: { rank: 2, width: FIB[2], climb: 1 / PHI }, path: { rank: 1, width: 1, climb: 1 }, pier: { rank: 0, width: FIB[2], climb: 1 }, track: { rank: 0, width: 1, climb: 1 }, mole: { rank: 0, width: FIB[3], climb: 1 } };   // vision: the quay as wide as an artery; a pier two, a mole three, built over the water
// ---- the frontage: what each building must face (vision: a town's own order: trade and the halls on its high
// street, work and the shops on its roads, homes and yards on its paths, the harbour's on the water)
const ON = { artery: ["artery", "quay"], road: ["road", "artery", "quay"], path: ["path", "road"], water: ["quay", "path", "road", "artery"] };
export const FRONT = {
  artery: ["market", "markethall", "inn", "townhall", "throne", "palace", "counting", "greattemple", "temple", "gatehouse", "barracks", "meeting"],
  road: ["shophouse", "narrow", "workhouse", "smithy", "workshop", "bakehouse", "lodge", "library", "charthouse", "washhouse", "bighouse", "warehouse", "tannery"],
  path: ["hut", "cottage", "house", "farmhouse", "fisherhouse", "barn", "byre", "granary", "shearing", "woodshed", "weavery", "smokehouse", "kiosk", "shrine", "well", "latrine", "lookout", "minehead"],
  water: ["boathouse", "shipyard", "loft", "ropewalk", "fishmarket", "harbourmaster", "beacon"],
};
const FRONT_OF = Object.fromEntries(Object.entries(FRONT).flatMap(([k, ids]) => ids.map((id) => [id, k])));
export const frontOf = (id) => FRONT_OF[id] ?? "path";
// ---- the measures
export const REPOSE = 1 / PHI ** 4;   // vision: the steepest a town's pile stands, a block of sand down every 7 of walk
/** The repose a town's own pile takes: the slope at which a cone of its volume covers its ground (on the flat: area A, volume V = A top / 3, top = s r). */   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
export const reposeOf = (V, A) => Math.min(REPOSE, (3 * V) / (A * Math.sqrt(A / Math.PI)));   // given: the cone
export const GRADE_COST = PHI ** 3;   // derived: roads.js's grade cost, (1 + (g phi^3)^2)
export const CANTS = [0, Math.atan(1 / 3), Math.atan(1 / 2), Math.PI / 4];   // given: Farey's slopes of denominator three or less, the walls a voxel steps cleanly
export const snapCant = (a, set = CANTS) => { const s = Math.sign(a), m = Math.abs(a); let best = 0; for (const c of set) if (Math.abs(c - m) < Math.abs(best - m)) best = c; return s * best; };
const TAU = 2 * Math.PI;   // given
const wrap = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };

function heap() { const a = []; return { push(v) { a.push(v); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }, pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }, get size() { return a.length; } }; }
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];   // given: a cell's eight neighbours

/** The warped plane over a window of radius R round the epicentre: ground, water, ease, the walk. */
export function planeOf({ R, ground, water, blocked, stilted }) {
  const N = 2 * R + 1, I = (x, z) => (z + R) * N + (x + R), inside = (x, z) => Math.abs(x) <= R && Math.abs(z) <= R;
  const h = new Float64Array(N * N), wet = new Uint8Array(N * N), can = new Uint8Array(N * N);
  for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) { const k = I(x, z); h[k] = ground.h(x, z); wet[k] = water(x, z) ? 1 : 0; const shallows = stilted && wet[k] && -h[k] <= FIB[3]; can[k] = (!wet[k] && !(blocked && blocked(x, z))) || shallows ? 1 : 0; }   // derived: the stilt peoples build over water three deep at most
  // ease: the spread of the ground over a building's depth (integral images of h and h^2)
  const S1 = new Float64Array((N + 1) * (N + 1)), S2 = new Float64Array((N + 1) * (N + 1)), J = (i, j) => j * (N + 1) + i;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = Math.max(0, h[j * N + i]); S1[J(i + 1, j + 1)] = v + S1[J(i, j + 1)] + S1[J(i + 1, j)] - S1[J(i, j)]; S2[J(i + 1, j + 1)] = v * v + S2[J(i, j + 1)] + S2[J(i + 1, j)] - S2[J(i, j)]; }
  const ease = new Float64Array(N * N), r = RING >> 1;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - r), b = Math.max(0, j - r), c = Math.min(N, i + r + 1), d = Math.min(N, j + r + 1), n = (c - a) * (d - b);
    const m1 = (S1[J(c, d)] - S1[J(a, d)] - S1[J(c, b)] + S1[J(a, b)]) / n, m2 = (S2[J(c, d)] - S2[J(a, d)] - S2[J(c, b)] + S2[J(a, b)]) / n;
    const k = j * N + i; ease[k] = !can[k] ? 0 : wet[k] ? 1 / PHI ** 2 : Math.exp(-Math.sqrt(Math.max(0, m2 - m1 * m1)));   // derived: posts over the shallows are a hard build (1/phi^2); dry ground by its spread
  }
  // the walk: the geodesic in the metric, eight ways, water at a bridge's cost
  const D = new Float64Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1), hp = heap();
  D[I(0, 0)] = 0; hp.push([0, 0, 0]);
  while (hp.size) {
    const [d, x, z] = hp.pop(), k = I(x, z); if (d > D[k]) continue;
    for (const [a, b] of N8) {
      const X = x + a, Z = z + b; if (!inside(X, Z)) continue; const K = I(X, Z);
      if (!can[K] && !wet[K]) continue;   // a cliff: never crossed
      const len = Math.hypot(a, b), g = (Math.max(0, h[K]) - Math.max(0, h[k])) / len;
      const nd = d + len * (wet[K] && !can[K] ? FIB[4] : Math.sqrt(1 + (g * GRADE_COST) ** 2));   // derived: the metric's length of the step; open water at five a block (a bridge's cost)
      if (nd < D[K]) { D[K] = nd; prev[K] = k; hp.push([nd, X, Z]); }
    }
  }
  return { R, N, I, inside, h, wet, can, ease, D, prev, xz: (k) => [(k % N) - R, Math.floor(k / N) - R] };
}

/** The walk's tree from a cell: each cell's step back toward it. */
function planeWalk(pl, [x0, z0]) {
  const { N, I, inside, h, wet, can } = pl, D = new Float64Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1), hp = heap();
  D[I(x0, z0)] = 0; hp.push([0, x0, z0]);
  while (hp.size) { const [d, x, z] = hp.pop(), k = I(x, z); if (d > D[k]) continue; for (const [a, b] of N8) { const X = x + a, Z = z + b; if (!inside(X, Z)) continue; const K = I(X, Z); if (!can[K] && !wet[K]) continue; const len = Math.hypot(a, b), g = (Math.max(0, h[K]) - Math.max(0, h[k])) / len, nd = d + len * (wet[K] && !can[K] ? FIB[4] : Math.sqrt(1 + (g * GRADE_COST) ** 2)); if (nd < D[K]) { D[K] = nd; prev[K] = k; hp.push([nd, X, Z]); } } }   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  return prev;
}

/** Sand poured over the plane: the pile's depth P at each cell, its volume the mass. */
export function pourOf(pl, mass, repose = REPOSE) {
  const { N, h, can, wet, D } = pl, h0 = Math.max(0, h[pl.I(0, 0)]);
  const depth = (top, k) => (can[k] && isFinite(D[k]) ? Math.max(0, top - repose * D[k] - ((wet[k] ? 0 : Math.max(0, h[k])) - h0)) : 0);
  const vol = (top) => { let v = 0; for (let k = 0; k < N * N; k++) v += depth(top, k); return v; };
  let lo = 0, hi = FIB[10]; for (let i = 0; i < FIB[7]; i++) { const m = (lo + hi) / 2; if (vol(m) < mass) lo = m; else hi = m; }   // derived: 21 halvings of a range of 89 blocks
  const top = hi, P = new Float64Array(N * N); let max = 0, cells = 0; for (let k = 0; k < N * N; k++) { P[k] = depth(top, k); if (P[k] > 0) { cells++; max = Math.max(max, P[k]); } }
  return { top, P, max, cells, reach: top / repose, repose };
}

/** The harmonic field over the pile: u = 0 at the epicentre, 1 past the pile, conductance the ease. */
export function harmonicOf(pl, pour) {
  const { N, ease } = pl, P = pour.P, u = new Float64Array(N * N).fill(1), live = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) if (P[k] > 0) { live[k] = 1; u[k] = 1 - P[k] / pour.max; }   // derived: the pile's own depth the first guess
  for (let a = -FIB[2]; a <= FIB[2]; a++) for (let b = -FIB[2]; b <= FIB[2]; b++) if (pl.inside(a, b)) { const k = pl.I(a, b); live[k] = 0; u[k] = 0; }   // the epicentre held at 0 (a disc of two)
  const w = PHI;   // vision: over-relaxation (SOR), between 1 and 2
  for (let it = 0; it < FIB[10] * 2; it++) {   // vision: 178 sweeps
    for (let k = N + 1; k < N * N - N - 1; k++) {
      if (!live[k]) continue; let s = 0, c = 0;
      for (const d of [1, -1, N, -N]) { const e = Math.sqrt(ease[k] * ease[k + d]) + 1e-6; s += e * u[k + d]; c += e; }   // given: the four-way Laplacian, each edge its two ends' geometric mean (and a whisker, so a cut edge still holds the field)
      u[k] += w * (s / c - u[k]);
    }
  }
  return u;
}

/** Geodesic walks from many seeds at once: each cell's nearest seed (its district) and the walk to it. */
export function voronoiOf(pl, seeds) {
  const { N, I, inside, h, wet, can } = pl, D = new Float64Array(N * N).fill(Infinity), lab = new Int16Array(N * N).fill(-1), hp = heap();
  seeds.forEach(([x, z], i) => { const k = I(x, z); D[k] = 0; lab[k] = i; hp.push([0, x, z]); });
  while (hp.size) {
    const [d, x, z] = hp.pop(), k = I(x, z); if (d > D[k]) continue;
    for (const [a, b] of N8) { const X = x + a, Z = z + b; if (!inside(X, Z)) continue; const K = I(X, Z); if (!can[K] && !wet[K]) continue; const len = Math.hypot(a, b), g = (Math.max(0, h[K]) - Math.max(0, h[k])) / len, nd = d + len * (wet[K] && !can[K] ? FIB[4] : Math.sqrt(1 + (g * GRADE_COST) ** 2)); if (nd < D[K]) { D[K] = nd; lab[K] = lab[k]; hp.push([nd, X, Z]); } }   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  }
  return { D, lab };
}
/** Spectral bisection: the district graph's Laplacian L = Deg - A, its Fiedler vector (the second eigenvector, by power
 *  iteration on c I - L with the constant vector taken out) splits the graph in two along its weakest links. */
export function fiedlerOf(A, nodes) {
  const n = nodes.length; if (n < 2) return nodes.map(() => 0);
  const deg = nodes.map((i) => nodes.reduce((s, j) => s + (A[i][j] || 0), 0)), c = 2 * Math.max(...deg) + 1;   // given: Gershgorin's bound, so c I - L is positive
  let v = nodes.map((_, i) => Math.cos(i * GOLD_TURN));
  for (let it = 0; it < FIB[9]; it++) {   // vision: fifty-five iterations
    const m = v.reduce((a, b) => a + b, 0) / n; v = v.map((x) => x - m);
    const w = v.map((x, a) => c * x - deg[a] * x + nodes.reduce((s, j, b) => s + (A[nodes[a]][j] || 0) * v[b], 0));
    const L = Math.hypot(...w) || 1; v = w.map((x) => x / L);
  }
  return v;
}
const GOLD_TURN = TAU / PHI ** 2;   // derived: the golden angle
/** Wards: the districts split by their Fiedler vectors, again and again, till each holds five at most. */
export function wardsOf(A, nodes, most = FIB[4]) {   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  if (nodes.length <= most) return [nodes];
  const v = fiedlerOf(A, nodes), med = [...v].sort((a, b) => a - b)[nodes.length >> 1];
  const a = nodes.filter((_, i) => v[i] < med), b = nodes.filter((_, i) => v[i] >= med);
  if (!a.length || !b.length) return [nodes];
  return [...wardsOf(A, a, most), ...wardsOf(A, b, most)];
}

/** The frame: a 4-direction field theta (radians) at each cell, the habit and the contours added as e^(4 i theta), smoothed. */   // given: four quarter turns (and the four ways a 4-direction field points)
export function frameOf(pl, pour, u, habit, axis, dist = null) {
  const { N, h, wet, I } = pl, P = pour.P, re = new Float64Array(N * N), im = new Float64Array(N * N);
  // the water's distance (for the shore habit): a breadth-first walk out from every wet cell
  let wd = null;
  if (habit.frame === "shore") { wd = new Float64Array(N * N).fill(Infinity); const q = []; for (let k = 0; k < N * N; k++) if (wet[k]) { wd[k] = 0; q.push(k); } for (let i = 0; i < q.length; i++) { const k = q[i]; for (const d of [1, -1, N, -N]) { const K = k + d; if (K < 0 || K >= N * N || wd[K] <= wd[k] + 1) continue; wd[K] = wd[k] + 1; q.push(K); } } }
  const g = (F, k) => [(F[k + 1] - F[k - 1]) / 2, (F[k + N] - F[k - N]) / 2];   // given: central differences
  const ax = Math.atan2(axis[1], axis[0]);
  for (let z = -pl.R + 1; z < pl.R; z++) for (let x = -pl.R + 1; x < pl.R; x++) {
    const k = I(x, z); if (P[k] <= 0) continue;
    let th; const di = dist ? dist.lab[k] : -1, ctr = di > 0 ? dist.centres[di] : null, turn = di > 0 ? dist.turns[di] : 0;
    if (habit.frame === "radial" && ctr) th = Math.atan2(z - ctr[1], x - ctr[0]);   // a district's own village: radial round its own core
    else if (habit.frame === "radial") { const [a, b] = g(u, k); th = a || b ? Math.atan2(b, a) : Math.atan2(z, x); }
    else if (habit.frame === "shore") { const [a, b] = g(wd, k); th = isFinite(a) && isFinite(b) && (a || b) ? Math.atan2(b, a) : ax; }
    else if (habit.frame === "contour") { const [a, b] = g(h, k); th = a || b ? Math.atan2(b, a) : Math.atan2(z, x); }
    else th = ax;
    th += turn;   // the grain's misorientation
    const [hx, hz] = g(h, k), s2 = (hx * hx + hz * hz) * GRADE_COST * GRADE_COST, wc = habit.contour * s2 / (1 + s2);   // derived: the ground's pull grows with its slope squared, to the habit's weight on a cliff
    const tc = Math.atan2(hz, hx);
    re[k] = Math.cos(4 * th) + wc * Math.cos(4 * tc); im[k] = Math.sin(4 * th) + wc * Math.sin(4 * tc);   // given: a 4-direction field as e^(4 i theta)
  }
  // smoothed: Jacobi sweeps of the graph Laplacian over the pile, so the lattice bends rather than breaks
  for (let it = 0; it < FIB[6]; it++) {   // vision: thirteen sweeps
    const r2 = re.slice(), i2 = im.slice();
    for (let k = N + 1; k < N * N - N - 1; k++) { if (P[k] <= 0) continue; let a = r2[k], b = i2[k]; for (const d of [1, -1, N, -N]) if (P[k + d] > 0) { a += r2[k + d]; b += i2[k + d]; } re[k] = a; im[k] = b; const m = Math.hypot(re[k], im[k]) || 1; re[k] /= m; im[k] /= m; }
  }
  const theta = new Float64Array(N * N); for (let k = 0; k < N * N; k++) theta[k] = Math.atan2(im[k], re[k]) / 4;   // given: four quarter turns (and the four ways a 4-direction field points)
  return theta;
}

/** A polyline smoothed (Chaikin's corner cutting, twice) and resampled a block apart. */
function smooth(pts) {
  let p = pts;
  for (let it = 0; it < 2 && p.length > 2; it++) { const q = [p[0]]; for (let i = 0; i + 1 < p.length; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } q.push(p.at(-1)); p = q; }   // given: Chaikin's quarters
  const out = [p[0]]; let acc = 0;
  for (let i = 1; i < p.length; i++) { const [ax, az] = p[i - 1], [bx, bz] = p[i], L = Math.hypot(bx - ax, bz - az); let t = 1 - acc; while (t <= L) { out.push([ax + ((bx - ax) * t) / L, az + ((bz - az) * t) / L]); t += 1; } acc = L - (t - 1); }
  if (Math.hypot(out.at(-1)[0] - p.at(-1)[0], out.at(-1)[1] - p.at(-1)[1]) > 0.5) out.push(p.at(-1));
  return out;
}

/**
 * The town, grown. Returns the same shape as district.js placeOf (placed, census, rho, spine, bridges, ...) and the
 * crystal's own: its streets (polylines with their class), the pile, the frame, and its measures (ease, cants, frontage).
 */
export function growOf(place, { seed = 0, ground = { h: () => 0 }, water = null, slope = null, blocked = null, exits = null, sea = null, wind = 0, approach = null } = {}) {
  const t = place.t, habit = HABIT[t] ?? HABIT.european, c = censusOf(place), wet0 = water ?? (() => false), stilted = STILTED.has(t);
  // the census: its buildings, their molecules and atoms
  const items = []; for (const { id, n } of c.list) for (let i = 0; i < n; i++) items.push({ id, seed: seed + items.length * FIB[5] });   // vision: a building's seed, eight apart
  const nq = Math.max(1, Math.round(c.households / QUARTER));
  for (let i = 1; i < nq; i++) items.push({ id: "well", seed: seed + i }, { id: "kiosk", seed: seed + i * FIB[3] });   // a well and a shrine to each quarter (the census gave the first)   // vision: their seeds
  const dense = c.level >= FIB[3], cache = new Map(), make = (id, sd, up = 0) => { const k = `${id}|${sd}|${up}`; if (!cache.has(k)) cache.set(k, buildOf(id, t, sd, null, { slope, up, dense, split: true })); return cache.get(k); };   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  const upCap = Math.min(FIB[3], Math.max(0, (PINNACLE[t]?.storeys ?? 1) - (STOREYS[t] ?? 1))), pressed = c.level >= 2;   // a people rises no higher than its pinnacle, three storeys over its own at most   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  const built = items.map((it) => { const b = make(it.id, it.seed); return { ...it, b, atom: atomOf(b), tall: heightOf(b.vox), parts: (b.parts ?? []).map((pt) => ({ ...pt, atom: atomOf({ vox: pt.vox }) })) }; });
  const nuMean = (NEGATIVE.core + NEGATIVE.edge) / 2, foot = built.reduce((a, q) => a + q.atom.w * q.atom.l + q.parts.reduce((b, pt) => b + pt.atom.w * pt.atom.l, 0), 0);
  const mass = built.reduce((a, q) => a + q.atom.w * q.atom.l * q.tall + q.parts.reduce((b, pt) => b + pt.atom.w * pt.atom.l * heightOf(pt.vox), 0), 0) / (1 - nuMean);   // the pile's volume: every building's block, with the open ground the town keeps
  // the plane, sized from the free town (its radius in walk), a golden square past it
  const Rfree = Math.sqrt(foot * PHI / (Math.PI * (1 - nuMean))), R0 = Math.ceil(Rfree * PHI) + FIB[6] + FARM.BAND + Math.ceil(Rfree / PHI);   // vision: 445 blocks the widest window
  const area = foot / (1 - nuMean) * PHI;   // derived: the ground a town covers, its footprints, its open share, and its streets a golden part over
  let R = R0, pl, pour;
  for (let grow = 0; ; grow++) {   // the window grows a golden step while the pile runs off its edge (twice at most)
    pl = planeOf({ R, ground, water: wet0, blocked, stilted }); pour = pourOf(pl, mass, reposeOf(mass, area));
    const Rr = Math.max(1, R - FARM.BAND - Math.ceil(Rfree / PHI)); let rim = 0; for (let i = -Rr; i <= Rr; i++) for (const [x, z] of [[i, -Rr], [i, Rr], [-Rr, i], [Rr, i]]) if (pour.P[pl.I(x, z)] > 0) rim++;   // the pile kept a ring's walk inside the window's edge (room for its farms)
    if (!rim || grow >= FIB[2]) break; R = Math.ceil(R * PHI);
  }
  const u = harmonicOf(pl, pour);
  const { N, I, inside, h, wet, can, ease, D, prev } = pl, P = pour.P;
  const pileCells = []; for (let z = -R; z <= R; z += 2) for (let x = -R; x <= R; x += 2) if (P[I(x, z)] > 0) pileCells.push([x, z]);
  const shape0 = shapeOf(pileCells), cantOf = CANT[t] ?? CANT.european, cantSet = cantOf.cants.map((i) => CANTS[i]), shape = cantOf.cardinal ? { ...shape0, axis: [1, 0] } : shape0;   // a cardinal people's lattice is the world's square
  // ---- the districts: each a village of its own (its core, its lattice), the town their matrix
  const nd = Math.max(1, Math.round(c.households / (QUARTER * FIB[5]))), centres = [[0, 0]];   // derived: a district of eight quarters (faith.js: a temple to each)
  for (let d = 1; d < nd; d++) { const vo = voronoiOf(pl, centres); let best = null, bv = 0; for (let k = 0; k < N * N; k++) if (P[k] > 0 && can[k] && !wet[k]) { const v = vo.D[k] * Math.pow(P[k] / (pour.max || 1), 1 / PHI); if (v > bv) { bv = v; best = pl.xz(k); } } if (!best) break; centres.push(best); }   // derived: farthest along the walk, the sand's weight a golden root
  const vor = voronoiOf(pl, centres), A = centres.map(() => centres.map(() => 0));
  for (let k = N + 1; k < N * N - N - 1; k++) { if (P[k] <= 0) continue; const a = vor.lab[k]; for (const d of [1, N]) { const b = vor.lab[k + d]; if (b >= 0 && b !== a && P[k + d] > 0) { A[a][b]++; A[b][a]++; } } }
  for (let a = 0; a < centres.length; a++) for (let b = 0; b < centres.length; b++) A[a][b] = A[a][b] >= FIB[5] ? 1 : 0;   // derived: neighbours where they share eight blocks of border
  const wards = wardsOf(A, centres.map((_, i) => i)), turns = centres.map((_, i) => (i && !cantOf.cardinal ? habit.grain * (Math.PI / 4) * (2 * ((i * PHI) % 1) - 1) : 0));   // derived: each grain turned up to the habit's share of an eighth, by the golden sequence
  const dist = { centres, lab: vor.lab, turns, A, wards };
  const theta = frameOf(pl, pour, u, habit, shape.axis, dist);
  const at = (A, x, z) => { const X = Math.round(x), Z = Math.round(z); return inside(X, Z) ? A[I(X, Z)] : 0; };
  const Pmax = pour.max || 1;
  // ---- the streets: a spatial hash of their points, for the joins
  const streets = [], HC = FIB[5], hash = new Map(), hk = (x, z) => `${Math.floor(x / HC)},${Math.floor(z / HC)}`;   // derived: eight-block cells
  const addPt = (sid, i, x, z) => { const k = hk(x, z); (hash.get(k) ?? hash.set(k, []).get(k)).push([sid, i, x, z]); };
  const nearest = (x, z, r, skip) => { let best = null, bd = r; const n = Math.ceil(r / HC); const cx = Math.floor(x / HC), cz = Math.floor(z / HC); for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (const e of hash.get(`${cx + a},${cz + b}`) ?? []) { if (skip && skip(e)) continue; const d = Math.hypot(e[2] - x, e[3] - z); if (d < bd) { bd = d; best = e; } } return best; };   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  const lot = Math.max(RING, quantile(built.map((q) => q.atom.l), 1 - 1 / PHI ** 2)) + 1;   // derived: a lot as deep as the town's buildings run back from their doors, all but the deepest golden share of them, and its step back
  const sepAt = (x, z) => habit.spacing * (2 * lot + CLASS.road.width) * (1 + (1 - at(P, x, z) / Pmax) * (PHI - 1));   // derived: two lots back to back and a road; a golden part wider at the pile's thin edge
  const register = (pts, cls, parent = -1) => { const sid = streets.length; const s = { sid, pts, cls, parent, len: pts.length }; streets.push(s); pts.forEach(([x, z], i) => addPt(sid, i, x, z)); return s; };
  // the arteries: geodesics from the epicentre to the exits (where the roads leave, or the habit's arms round the pile's long axis)
  const edge = []; for (let z = -R + 1; z < R; z++) for (let x = -R + 1; x < R; x++) { const k = I(x, z); if (P[k] > 0 && (P[k + 1] <= 0 || P[k - 1] <= 0 || P[k + N] <= 0 || P[k - N] <= 0)) edge.push([x, z]); }
  const ax0 = Math.atan2(shape.axis[1], shape.axis[0]);
  const wantA = exits?.length ? exits.map(([x, z]) => Math.atan2(z, x)) : habit.frame === "shore" || shape.primitive === "strip" ? [ax0, ax0 + Math.PI].slice(0, Math.max(1, habit.arteries)) : Array.from({ length: habit.arteries }, (_, i) => ax0 + (i * TAU) / habit.arteries);
  const ends = [];
  for (const a of wantA) { let best = null, bd = Infinity; for (const [x, z] of edge) { const d = Math.abs(wrap(Math.atan2(z, x) - a)) * (1 + Math.hypot(x, z) / (pour.reach + 1) / FIB[6]); if (d < bd) { bd = d; best = [x, z]; } } if (best && !ends.some((e) => Math.hypot(e[0] - best[0], e[1] - best[1]) < lot * 2)) ends.push(best); }   // derived: the edge cell nearest the arm's bearing (and not one already taken)
  for (const [x, z] of ends) { const pts = []; let k = I(x, z); while (k >= 0) { pts.push(pl.xz(k)); k = prev[k]; } if (pts.length > FIB[4]) register(smooth(pts.reverse()), "artery"); }   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  // the matrix's links: an artery along each edge of A, the walk between two districts' cores (the geodesic, from the epicentre's tree where it serves, else its own)
  const pathTo = (from, to) => { const vo = planeWalk(pl, from); const pts = []; let k = I(to[0], to[1]); while (k >= 0) { pts.push(pl.xz(k)); k = vo[k]; } return pts.reverse(); };
  for (let a = 0; a < centres.length; a++) for (let b = a + 1; b < centres.length; b++) if (A[a][b]) { const pts = pathTo(centres[a], centres[b]); if (pts.length > FIB[4]) register(smooth(pts), "artery"); }   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  for (let d = 1; d < centres.length; d++) if (!A[0][d] && !centres.some((_, e) => A[d][e])) { const pts = pathTo(centres[0], centres[d]); if (pts.length > FIB[4]) register(smooth(pts), "artery"); }   // an island of a district still linked to the core   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  // the waterfront (world/harbour.js): its quay a street the harbour's buildings face, its beach a path, its piers and mole over the water
  const port = harbourPlan(pl, pour, { level: c.level, need: sea ? { ...sea.shore, B: sea.fleet?.L ? Math.round(sea.fleet.L / PHI ** 2) : undefined, channel: sea.fleet?.L ? Math.round(sea.fleet.L / PHI ** 2) + 2 : undefined } : null, wind, approach, keep: sea?.shore?.keep ?? "quay" });
  if (port) {
    if (port.quay && port.quay.length > FIB[3]) register(smooth(port.quay), "quay");   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    if (port.beach && port.beach.length > FIB[3]) register(smooth(port.beach), "path");   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    for (const pr of port.piers) register(pr, "pier");
    if (port.mole) register(port.mole, "mole");
  }
  // the roads and paths: traced through the frame from the streets, densest sand first
  const wants = { artery: 0, road: 0, path: 0 }; for (const q of built) { const f = frontOf(q.id), c0 = f === "water" ? "path" : f; wants[c0] += (q.atom.w + (ROWS.has(t) && q.atom.home ? 0 : LANE[t] ?? FIB[3]) + q.parts.filter((pt) => pt.at !== "back").reduce((a, pt) => a + pt.atom.w + FIB[3], 0)) * PHI; }   // derived: the frontage each class owes (a house, its lane, the parts beside it), a golden part over for the corners and the joins
  const need = wants.artery + wants.road + wants.path, have = { artery: 0, road: 0, path: 0 };
  const usable = (st) => { let n = 0; const half = CLASS[st.cls].width / 2; for (let i = 1; i + 1 < st.pts.length; i++) { const [x, z] = st.pts[i], [px, pz] = st.pts[i - 1], [nx, nz] = st.pts[i + 1], tg = Math.atan2(nz - pz, nx - px); for (const side of [1, -1]) { const nn = tg + (side * Math.PI) / 2, X = Math.round(x + Math.cos(nn) * (half + lot / 2)), Z = Math.round(z + Math.sin(nn) * (half + lot / 2)); if (inside(X, Z) && can[I(X, Z)] && P[I(X, Z)] > 0) n++; } } return n; };   // a street's frontage: the sides of it a lot can stand on
  for (const st of streets) if (have[st.cls] !== undefined) have[st.cls] += usable(st);
  let length = streets.reduce((a, s) => a + s.len, 0);
  const short = (c) => Math.max(0, wants[c] - have[c]) / Math.max(1, wants[c]);
  const haveAt = () => ({ ...have });
  let pass = 0;
  const seeds = heap(), queue = (s) => { if (!CLASS[s.cls].rank) return; const step = Math.max(FIB[4], Math.round(sepAt(...s.pts[0]) * habit.long / PHI ** pass)), off = pass ? Math.round(step / PHI) : 0, br = pass ? 1 : habit.branch; for (let i = step - off; i < s.pts.length - step / 2; i += step) for (const side of [1, -1]) { const [x, z] = s.pts[i]; if (hashAt(x * FIB[4] + side, z, seed + s.sid + pass) > br) continue; seeds.push([-at(P, x, z), s.sid, i, side]); } };   // a cross street a block's length apart, each side, at the habit's chance; each later pass a golden step closer, every side   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  streets.forEach(queue);
  const trace = (x0, z0, hd0, cls, parent) => {
    const pts = [[x0, z0]], spec = CLASS[cls]; let x = x0, z = z0, hd = hd0, bridge = 0, joined = false;
    for (let s = 0; s < R * 2; s++) {
      const th = at(theta, x, z); let best = hd, bd = Infinity; for (let q = 0; q < 4; q++) { const a = th + (q * Math.PI) / 2, d = Math.abs(wrap(a - hd)); if (d < bd) { bd = d; best = a; } }   // the frame's way nearest the last   // given: four quarter turns (and the four ways a 4-direction field points)
      hd = hd + wrap(best - hd) / PHI + (hashAt(Math.round(x * FIB[3]), Math.round(z * FIB[3]), seed + streets.length) - 0.5) * 2 * habit.wobble;   // derived: it turns a golden part of the way to its frame each block
      const X = x + Math.cos(hd), Z = z + Math.sin(hd), XI = Math.round(X), ZI = Math.round(Z);
      if (!inside(XI, ZI)) break;
      const k = I(XI, ZI), k0 = I(Math.round(x), Math.round(z));
      if (wet[k] && !can[k]) { if (++bridge > BRIDGE) break; } else { if (P[k] <= 0) break; bridge = 0; }
      if (!wet[k] && Math.abs(Math.max(0, h[k]) - Math.max(0, h[k0])) > spec.climb + (habit.stairs ? 1 : 0)) break;   // too steep for its class (the stair peoples step it)
      const dtest = sepAt(X, Z) / 2, near = nearest(X, Z, dtest, (e) => (e[0] === parent && pts.length < dtest * 2) || e[0] === streets.length);
      x = X; z = Z; pts.push([x, z]);
      if (near && pts.length > dtest) { pts.push([near[2], near[3]]); joined = true; break; }   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
      if (near && pts.length <= dtest && near[0] !== parent) break;   // it set out too near another: no street   // come near another street: join it
    }
    if (bridge) pts.splice(pts.length - bridge);   // a bridge to nowhere is no bridge
    return { pts, joined };
  };
  for (; pass <= FIB[3] && (short("road") > 0 || short("path") > 0); pass++) {   // derived: three passes past the habit's own, if the frontage still falls short
  if (pass) streets.forEach(queue);
  while (seeds.size && (short("road") > 0 || short("path") > 0)) {
    const [, sid, i, side] = seeds.pop(), s = streets[sid], [x, z] = s.pts[i], [px, pz] = s.pts[Math.max(0, i - 1)], [nx, nz] = s.pts[Math.min(s.pts.length - 1, i + 1)];
    const tang = Math.atan2(nz - pz, nx - px), cls = s.cls === "path" ? "path" : (s.cls === "artery" || s.cls === "quay") && short("road") > 0 ? "road" : short("road") >= short("path") ? "road" : "path";   // an artery's and a road's cross streets: roads while the roads owe more of their frontage than the paths, then paths; a path's, paths
    const r = trace(x, z, tang + (side * Math.PI) / 2, cls, sid);
    if (r.pts.length < lot) continue;
    const ns = register(smooth(r.pts), cls, sid); length += ns.len; have[cls] += usable(ns); queue(ns);
  }
  }
  // ---- the lots: every street side a block at a time, each sorted by its sand and its ease
  const occ = new Int32Array(N * N).fill(-1), STREET = -2, cls = new Uint8Array(N * N);   // -1 free, -2 street, >= 0 a building
  const paint = (s) => { const half = (CLASS[s.cls].width - 1) / 2; for (let i = 0; i < s.pts.length; i++) { const [x, z] = s.pts[i], [px, pz] = s.pts[Math.max(0, i - 1)], [nx, nz] = s.pts[Math.min(s.pts.length - 1, i + 1)], L = Math.hypot(nx - px, nz - pz) || 1, ux = -(nz - pz) / L, uz = (nx - px) / L; for (let w = -Math.ceil(half); w <= Math.ceil(half); w += 0.5) { const X = Math.round(x + ux * w), Z = Math.round(z + uz * w); if (!inside(X, Z)) continue; const k = I(X, Z); occ[k] = STREET; cls[k] = Math.max(cls[k], CLASS[s.cls].rank); } } };
  streets.forEach(paint);
  const slots = [];
  for (const s of streets) { if (!CLASS[s.cls].rank) continue; const half = CLASS[s.cls].width / 2; for (let i = 1; i + 1 < s.pts.length; i++) { const [x, z] = s.pts[i], [px, pz] = s.pts[i - 1], [nx, nz] = s.pts[i + 1], tg = Math.atan2(nz - pz, nx - px); for (const side of [1, -1]) { const n = tg + (side * Math.PI) / 2, ox = x + Math.cos(n) * (half + lot / 2), oz = z + Math.sin(n) * (half + lot / 2); slots.push({ s, i, side, x, z, tg, n, P: at(P, ox, oz), e: at(ease, ox, oz), wetBehind: at(wet, x + Math.cos(n) * (half + lot + FIB[3]), z + Math.sin(n) * (half + lot + FIB[3])) }); } } }   // derived: the water three past a lot's depth is the harbour's
  slots.sort((a, b) => b.P * (0.5 + b.e) - a.P * (0.5 + a.e));   // derived: the sand first, the ease its half
  // ---- the buildings: the public first at the core, then the town mixed, the reactive at the edge (district.js's order)
  const PUBLIC = new Set(["trade", "civic", "faith", "guard"]), LOCAL = new Set(["latrine", "washhouse", "well", "kiosk", "shrine", "lookout", "gatehouse"]);
  const pub = (q) => PUBLIC.has(TYPES[q.id]?.kind) && !LOCAL.has(q.id) && !q.atom.reactive;
  const pubs = built.filter(pub).sort((a, b) => a.atom.chi - b.atom.chi), tail = built.filter((q) => !pub(q) && (q.atom.reactive || frontOf(q.id) === "water"));
  const mixed = built.filter((q) => !pub(q) && !tail.includes(q)).map((q, i) => ({ q, m: (i * PHI) % 1 })).sort((a, b) => a.m - b.m).map((e) => e.q);
  const lightQ = []; if (port) for (const lt of port.lights) { let q = built.find((b) => b.id === "beacon" && !b.light); if (!q) { const b = make("beacon", seed + lightQ.length); q = { id: "beacon", seed: seed + lightQ.length, b, atom: atomOf(b), tall: heightOf(b.vox), parts: [] }; } q.light = lt; lightQ.push(q); }   // a light the census didn't give is built anyway: the harbour asks it
  const farmQ = built.filter((q) => FARM.IDS.has(q.id) && !q.light);   // the farm buildings go out to their farms (the rural ring below)
  const order = [...pubs, ...mixed, ...tail].filter((q) => !q.light && !FARM.IDS.has(q.id));
  pubs.forEach((q, i) => { q.district = i < FIB[3] ? 0 : (i - FIB[3]) % centres.length; });   // the three most public at the town's core, the rest dealt to the districts' cores in turn   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
  built.filter((q) => q.id === "well" || q.id === "kiosk" || q.id === "temple").forEach((q, i) => { q.district = i % centres.length; });
  const placed = [], fails = { frontage: 0 };
  const base = (q) => (frontOf(q.id) === "water" && q.id === "boathouse" ? 0 : -Math.PI / 2);   // the way a building's front faces at no turn: a boathouse's open end east, the rest's door north (district.js)
  const rowsHome = (q) => ROWS.has(t) && q.atom.home;
  const footprint = (q, cx, cz, rho, w, l) => { const out = [], c0 = Math.cos(rho), s0 = Math.sin(rho), r = Math.ceil(Math.hypot(w, l) / 2) + 1; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const lx = a * c0 + b * s0, lz = -a * s0 + b * c0; if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= l / 2) out.push([Math.round(cx) + a, Math.round(cz) + b]); } return out; };
  /** Does a building fit at (cx, cz) turned rot? Its cells, their ease and its kinks, or why not. Checks stop at the first clash. */
  const fit = (q, cx, cz, rot, own = -1) => {
    const c0 = Math.cos(rot), s0 = Math.sin(rot), w = q.atom.w, l = q.atom.l, gap = rowsHome(q) ? 0 : Math.max(1, Math.ceil((LANE[t] ?? FIB[3]) / 2)), r = Math.ceil(Math.hypot(w + 2 * gap, l + 2 * gap) / 2) + 1, X0 = Math.round(cx), Z0 = Math.round(cz);   // derived: half the people's lane each side (the neighbour keeps the other half)
    const cells = []; let eSum = 0, e2 = 0, kink = 0;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      const lx = a * c0 + b * s0, lz = -a * s0 + b * c0, inCore = Math.abs(lx) <= w / 2 && Math.abs(lz) <= l / 2;
      if (!inCore && !(Math.abs(lx) <= w / 2 + gap && Math.abs(lz) <= l / 2 + gap)) continue;
      const x = X0 + a, z = Z0 + b;
      if (!inside(x, z)) { if (inCore) return { why: "cells" }; continue; }
      const kk = I(x, z), o = occ[kk];
      if (inCore) { if (o !== -1 || (!can[kk] && !(q.id === "boathouse" && wet[kk]))) return { why: "cells" }; cells.push([x, z]); const hh = Math.max(0, h[kk]); eSum += hh; e2 += hh * hh; }
      else if (o >= 0 && o !== own && placed[o]?.of !== own) { if (rowsHome(q) && rowsHome(placed[o])) kink++; else return { why: "ring" }; }
    }
    const n0 = Math.max(1, cells.length), m1 = eSum / n0; return { cells, e: Math.exp(-Math.sqrt(Math.max(0, e2 / n0 - m1 * m1))), kink };   // its own earthwork: the ground's spread over its own cells, the mean cut or fill its footing asks
  };
  // a household's wing and outbuildings on its lot: beside it along its frontage, or behind it in the yard, the same turn
  let partsLost = 0;
  const placeParts = (q, bodyId, cx, cz, rot) => {
    const c0 = Math.cos(rot), s0 = Math.sin(rot), w = q.atom.w, l = q.atom.l, g = FIB[3];   // derived: three blocks between a house and its outbuildings (a window's air)
    let right = w / 2, left = -w / 2, back = l / 2;
    for (const pt of q.parts) {
      const pw = pt.atom.w, pll = pt.atom.l, pq = { id: q.id + ":" + pt.at, atom: { ...pt.atom, home: false } };
      const tries = [[right + g + pw / 2, -l / 2 + pll / 2, "r"], [left - g - pw / 2, -l / 2 + pll / 2, "l"], [-w / 2 + pw / 2, back + g + pll / 2, "b"], [w / 2 - pw / 2, back + g + pll / 2, "b"]];
      if (pt.at === "back") tries.unshift(tries.splice(2, 1)[0]);
      let ok = null;
      for (const [dx, dz, side] of tries) { const X = cx + dx * c0 - dz * s0, Z = cz + dx * s0 + dz * c0, f = fit(pq, X, Z, rot, bodyId); if (!f.why) { ok = { X, Z, f, side, dx, dz }; break; } }
      if (!ok) { partsLost++; continue; }
      if (ok.side === "r") right = ok.dx + pw / 2; else if (ok.side === "l") left = ok.dx - pw / 2; else back = Math.max(back, ok.dz + pll / 2);
      const id = placed.length; for (const [x, z] of ok.f.cells) occ[I(x, z)] = id;
      placed.push({ id: pq.id, seed: q.seed, b: { vox: pt.vox }, atom: pt.atom, x: Math.round(ok.X), z: Math.round(ok.Z), k: 0, a: 0, rot, of: bodyId, part: pt.note, front: "lot", ease: ok.f.e, sand: at(P, ok.X, ok.Z), ring: Math.floor(at(D, ok.X, ok.Z) / RING) });
    }
  };
  /** A building set at a site of its own, and its path walked to the nearest street (a breadth-first walk out over free ground). */
  const attachAt = (q, x0, z0, reach = FIB[9]) => {   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    for (const [ox, oz] of [[0, 0], [FIB[3], 0], [-FIB[3], 0], [0, FIB[3]], [0, -FIB[3]], [FIB[4], FIB[4]], [-FIB[4], -FIB[4]], [FIB[4], -FIB[4]], [-FIB[4], FIB[4]]]) {   // derived: the site, or a step of three or five round it
      const x = x0 + ox, z = z0 + oz; if (!inside(x, z)) continue;
      const seen = new Map([[I(x, z), -1]]), qq = [I(x, z)]; let hit = -1;
      for (let i2 = 0; i2 < qq.length && hit < 0; i2++) { const k = qq[i2]; const [kx, kz] = pl.xz(k); if (Math.hypot(kx - x, kz - z) > reach) continue; for (const d of [1, -1, N, -N]) { const K = k + d; if (K < 0 || K >= N * N || seen.has(K)) continue; if (occ[K] === STREET) { seen.set(K, k); hit = K; break; } if (occ[K] !== -1 || !can[K]) continue; seen.set(K, k); qq.push(K); } }
      if (hit < 0) continue;
      const pts = []; let k = hit; while (k >= 0) { pts.push(pl.xz(k)); k = seen.get(k); }   // from the street back to the site
      const [dx, dz] = pts.length > 1 ? pts[pts.length - 2] : pts[0], toward = Math.atan2(dz - z, dx - x), rho = wrap(toward - base(q)), kq = ((Math.round(rho / (Math.PI / 2)) % 4) + 4) % 4, cant = snapCant(wrap(rho - (kq * Math.PI) / 2), cantSet), rot = kq * (Math.PI / 2) + cant;   // given: four quarter turns (and the four ways a 4-direction field points)
      const deep = q.atom.l / 2 + 1, cx = x - Math.cos(toward) * deep, cz = z - Math.sin(toward) * deep, f = fit(q, cx, cz, rot); if (f.why) continue;
      const id = placed.length; for (const [a, b] of f.cells) occ[I(a, b)] = id;
      const ps = register(pts.filter(([a, b]) => occ[I(a, b)] !== id).reverse(), "path"); paint(ps);
      placed.push({ ...q, x: Math.round(cx), z: Math.round(cz), k: kq, a: cant, rot, door: [x, z], front: "path", street: ps.sid, ease: f.e, sand: at(P, cx, cz), ring: Math.floor(at(D, cx, cz) / RING), pathed: true });
      return true;
    }
    return false;
  };
  let lightsLost = 0; for (const q of lightQ) if (!attachAt(q, q.light.x, q.light.z)) lightsLost++;
  let tried = 0, relaxed = 0; const why = {}; const no = (r) => { why[r] = (why[r] ?? 0) + 1; }; const RELAX = { artery: ["artery", "quay", "road"], road: ["road", "artery", "quay", "path"], path: ["path", "road", "artery"], water: ON.water };   // the last chance: a class either side
  const RANK = { artery: 3, road: 2, path: 1, water: 3 };   // given: the classes' order
  const pending = order.map((q, qi) => [q, qi]);
  for (let round = 0; round < 2; round++) for (const [q0, qi] of round ? pending.splice(0) : [...pending]) {
    let q = q0; const fr = frontOf(q.id), ok = round ? RELAX[fr] : ON[fr];
    let best = null, fits = 0;
    for (const sl of slots) {
      if (sl.dead) { no("dead"); continue; } if (!ok.includes(sl.s.cls) || (fr === "water" ? !sl.wetBehind : false)) { no("class"); continue; }
      { const fx = Math.round(sl.x + Math.cos(sl.n) * (CLASS[sl.s.cls].width / 2 + 1.5)), fz = Math.round(sl.z + Math.sin(sl.n) * (CLASS[sl.s.cls].width / 2 + 1.5)); if (!inside(fx, fz) || occ[I(fx, fz)] !== -1) { sl.dead = true; no("front"); continue; } }   // its frontage taken (by a building, or a street across it): gone for good   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
      if (fr !== "water" && sl.P <= 0) { no("sand"); continue; }
      tried++;
      // the house's storeys from the sand over it
      if (pressed && q.atom.home && fits === 0 && !q.raised) { const up = Math.min(upCap, Math.max(0, Math.floor(Math.log(Math.max(1, (sl.P * (1 - nuMean)) / q.tall)) / Math.log(PHI)))); if (up) { const b = make(q.id, q.seed, up); q = { ...q, b, atom: atomOf(b), tall: heightOf(b.vox), up, raised: true }; } else q = { ...q, raised: true }; }   // derived: a storey a golden step of sand over its height
      // its turn: the front to the street (a boathouse's open end to the water), the quarter turn and the cant
      const target = fr === "water" && q.id === "boathouse" ? sl.n : sl.n + Math.PI, rho = wrap(target - base(q) - (q.id === "boathouse" ? 0 : 0));
      const k = ((Math.round(rho / (Math.PI / 2)) % 4) + 4) % 4, cant = snapCant(wrap(rho - (k * Math.PI) / 2), cantSet), rot = k * (Math.PI / 2) + cant;   // given: four quarter turns (and the four ways a 4-direction field points)
      // square to the world, whatever the street's angle: its corner set back to the street's edge (a sawtooth row along a slanting street)
      const [W0, L0] = k % 2 ? [q.atom.l, q.atom.w] : [q.atom.w, q.atom.l], nx = Math.cos(sl.n), nz = Math.sin(sl.n), tx = Math.cos(sl.tg), tz = Math.sin(sl.tg);
      const set = rowsHome(q) ? 0 : 1, half = CLASS[sl.s.cls].width / 2, dn = half + set + (W0 / 2) * Math.abs(nx) + (L0 / 2) * Math.abs(nz), dt = (W0 / 2) * Math.abs(tx) + (L0 / 2) * Math.abs(tz);   // derived: the rectangle's reach along the street's normal and tangent (its support), a row house on the edge, the rest a block back
      const cx = sl.x + nx * dn + tx * dt, cz = sl.z + nz * dn + tz * dt;
      { const CX = Math.round(cx), CZ = Math.round(cz); if (!inside(CX, CZ) || occ[I(CX, CZ)] !== -1 || !can[I(CX, CZ)] && q.id !== "boathouse") { no("mid"); continue; } }   // its middle taken: no need to draw it
      const f = fit(q, cx, cz, rot); if (f.why) { no(f.why); continue; }
      const { cells, kink } = f;
      const toCore = q.district !== undefined ? Math.hypot(cx - centres[q.district][0], cz - centres[q.district][1]) / (lot * PHI ** 2) : 0;   // derived: a public building drawn to its district's core, a lot's golden square a unit
      const e = f.e, E = toCore + Math.abs(CLASS[sl.s.cls].rank - RANK[fr]) / PHI - sl.P / Pmax * PHI - e * PHI - Math.min(FIB[3], kink) / FIB[3] - (q.atom.reactive ? -sl.P / Pmax * PHI * 2 : 0) + hashAt(Math.round(cx), Math.round(cz), seed + qi) / FIB[4];   // derived: the sand and the ease a golden weight each, a kink up to one, the reactive pushed to the thin sand, a fifth of noise
      const fa = base(q) + rot, fd = (k % 2 ? q.atom.w : q.atom.l) / 2 + 1, door = [cx + Math.cos(fa) * fd, cz + Math.sin(fa) * fd];   // the door, a step out from the middle of its front
      if (!best || E < best.E) best = { E, x: cx, z: cz, k, cant, rot, cells, e, sl, door, edge: [sl.x + nx * half, sl.z + nz * half] };
      if (++fits >= FIB[6]) break;   // vision: the best of the first thirteen that fit
    }
    if (!best) { if (round) { pending.push([q0, qi]); fails[fr] = (fails[fr] ?? 0) + 1; (fails.ids ??= {})[q.id + " " + q.atom.w + "x" + q.atom.l] = ((fails.ids ??= {})[q.id + " " + q.atom.w + "x" + q.atom.l] ?? 0) + 1; } continue; }
    if (!round) pending.splice(pending.findIndex((e) => e[1] === qi), 1); else relaxed++;
    const id = placed.length; for (const [x, z] of best.cells) occ[I(x, z)] = id;
    // the step from the door to its street: a lane cell or two
    placed.push({ ...q, x: Math.round(best.x), z: Math.round(best.z), k: best.k, a: best.cant, rot: best.rot, door: best.door, front: best.sl.s.cls, street: best.sl.s.sid, ease: best.e, sand: best.sl.P, ring: Math.floor(at(D, best.x, best.z) / RING) });
    { const fa = base(q) + best.rot, ux = Math.round(Math.cos(fa)), uz = Math.round(Math.sin(fa)), [ax, az] = best.door.map(Math.round); let pts = []; for (let i = 0; i <= FIB[5]; i++) { const x = ax + ux * i, z = az + uz * i; if (!inside(x, z) || occ[I(x, z)] === STREET) break; if (occ[I(x, z)] >= 0) { pts = null; break; } pts.push([x, z]); if (i === FIB[5]) pts = null; }   // straight out of the door, square, till it meets the street (eight blocks at most)   // vision: the town's own measure (its lanes and farms, in Fibonacci numbers)
      if (!pts) { const [bx, bz] = best.edge, L = Math.ceil(Math.hypot(bx - ax, bz - az)); pts = []; for (let i = 0; i <= L; i++) pts.push([Math.round(ax + ((bx - ax) * i) / L), Math.round(az + ((bz - az) * i) / L)]); }   // else the straight line to the street's edge
      { const L = pts.length; const free = pts.filter(([x, z]) => inside(x, z) && occ[I(x, z)] === -1); if (free.length) { for (const [x, z] of free) occ[I(x, z)] = STREET; streets.push({ sid: streets.length, pts: free, cls: "path", parent: best.sl.s.sid, len: free.length, walk: true }); } } }   // its walk to the street, a block or a few
    if (q.parts.length) placeParts(q, id, best.x, best.z, best.rot);
  }
  // ---- what no frontage held: the best free ground near the streets, and its own path to them (so nothing stands detached)
  let pathed = 0;
  if (pending.length) {
    const REACH = FIB[8], dS = new Float64Array(N * N).fill(Infinity), qq = [];   // derived: a path of thirty-four blocks at most
    for (let k = 0; k < N * N; k++) if (occ[k] === STREET) { dS[k] = 0; qq.push(k); }
    for (let i2 = 0; i2 < qq.length; i2++) { const k = qq[i2]; if (dS[k] >= REACH) continue; for (const d of [1, -1, N, -N]) { const K = k + d; if (K < 0 || K >= N * N || occ[K] !== -1 || !can[K] || dS[K] <= dS[k] + 1) continue; dS[K] = dS[k] + 1; qq.push(K); } }
    const sites = []; for (let z = -R + 1; z < R; z += FIB[3]) for (let x = -R + 1; x < R; x += FIB[3]) { const k = I(x, z); if (P[k] > 0 && isFinite(dS[k]) && dS[k] > FIB[3]) sites.push([x, z, P[k] * (0.5 + ease[k]) / (1 + dS[k] / REACH)]); }   // derived: every third block, the sand and ease over the walk to the street
    sites.sort((a, b) => b[2] - a[2]);
    for (const [q] of pending.splice(0)) {
      let done = null;
      for (const [x, z] of sites) {
        const k = I(x, z); if (occ[k] !== -1) continue;
        const gx = (dS[k + 1] ?? Infinity) - (dS[k - 1] ?? Infinity), gz = (dS[k + N] ?? Infinity) - (dS[k - N] ?? Infinity), toward = Math.atan2(isFinite(gz) ? -gz : 0, isFinite(gx) ? -gx : 1);   // the way down the walk to the street
        const fr = frontOf(q.id), target = q.id === "boathouse" ? toward + Math.PI : toward, rho = wrap(target - base(q)), kq = ((Math.round(rho / (Math.PI / 2)) % 4) + 4) % 4, cant = snapCant(wrap(rho - (kq * Math.PI) / 2), cantSet), rot = kq * (Math.PI / 2) + cant;   // given: four quarter turns (and the four ways a 4-direction field points)
        const f = fit(q, x, z, rot); if (f.why) continue;
        const deep = q.atom.l / 2 + 1, door = [x + Math.cos(target) * deep, z + Math.sin(target) * deep];
        // the path: down the walk from the door to the street
        const pts = [door]; let c = I(Math.round(door[0]), Math.round(door[1]));
        if (!isFinite(dS[c])) continue;
        for (let n2 = 0; n2 < REACH * 2 && dS[c] > 0; n2++) { let nb = c; for (const d of [1, -1, N, -N]) if (dS[c + d] < dS[nb]) nb = c + d; if (nb === c) break; c = nb; pts.push(pl.xz(c)); }
        if (dS[c] > 0) continue;
        done = { f, rot, kq, cant, door, pts };
        break;
      }
      if (!done) { fails.lost = (fails.lost ?? 0) + 1; continue; }
      const id = placed.length; for (const [x, z] of done.f.cells) occ[I(x, z)] = id;
      const ps = register(done.pts, "path"); paint(ps); pathed++;
      const cx = done.f.cells.reduce((a, c2) => a + c2[0], 0) / done.f.cells.length, cz = done.f.cells.reduce((a, c2) => a + c2[1], 0) / done.f.cells.length;
      placed.push({ ...q, x: Math.round(cx), z: Math.round(cz), k: done.kq, a: done.cant, rot: done.rot, door: done.door, front: "path", street: ps.sid, ease: done.f.e, sand: at(P, cx, cz), ring: Math.floor(at(D, cx, cz) / RING), pathed: true });
      if (q.parts.length) placeParts(q, id, Math.round(cx), Math.round(cz), done.rot);
    }
  }
  // ---- city | buffer | country. The town's built ground (its buildings and streets) closed: grown out 13 and drawn back (a morphological closing),
  // so the town's shape is one smooth piece with its bays and pockets filled. Out from it: the buffer, 55 blocks; the wall at its inner edge, eight
  // out from the town, its ditch before it; past the wall the cemetery by a main gate, the market gardens along the roads in, the town's common;
  // past the buffer, the country (the farm modules)
  let wall = null, country = null, buffer = null;
  { const CLOSE = FIB[6], dist8 = (seedOf) => { const dd = new Int16Array(N * N).fill(-1), qq = []; for (let k = 0; k < N * N; k++) if (seedOf(k)) { dd[k] = 0; qq.push(k); } for (let i2 = 0; i2 < qq.length; i2++) { const k = qq[i2]; for (const e of [1, -1, N, -N, N + 1, N - 1, -N + 1, -N - 1]) { const K = k + e; if (K < 0 || K >= N * N || dd[K] >= 0) continue; dd[K] = dd[k] + 1; qq.push(K); } } return dd; };   // vision: thirteen blocks of closing
    const isBuilt = (k) => (occ[k] >= 0 && placed[occ[k]]?.farm === undefined) || (occ[k] === STREET && P[k] > 0);
    // the town's smooth shape: its built ground blurred (three box passes each way make a Gaussian, sigma about 21) and cut at a low contour,
    // so the line wraps the whole town in one easy curve; anything built past that contour keeps its own clearance
    const blur = new Float32Array(N * N); for (let k = 0; k < N * N; k++) blur[k] = isBuilt(k) ? 1 : 0;
    const box = (r) => { const tmp = new Float32Array(N * N); for (let z = 0; z < N; z++) { let acc = 0; for (let x = -r; x <= r; x++) acc += blur[z * N + Math.min(N - 1, Math.max(0, x))]; for (let x = 0; x < N; x++) { tmp[z * N + x] = acc / (2 * r + 1); acc += blur[z * N + Math.min(N - 1, x + r + 1)] - blur[z * N + Math.max(0, x - r)]; } } for (let x = 0; x < N; x++) { let acc = 0; for (let z = -r; z <= r; z++) acc += tmp[Math.min(N - 1, Math.max(0, z)) * N + x]; for (let z = 0; z < N; z++) { blur[z * N + x] = acc / (2 * r + 1); acc += tmp[Math.min(N - 1, z + r + 1) * N + x] - tmp[Math.max(0, z - r) * N + x]; } } };
    for (let pass = 0; pass < 3; pass++) box(FIB[7]);   // derived: three passes of a 43-wide box, a Gaussian near enough
    const grown = dist8(isBuilt), closed = (k) => blur[k] >= 1 / FIB[7] || (grown[k] >= 0 && grown[k] <= 2);   // vision: the contour at a 21st of the town's density; two blocks round anything past it
    const dC = dist8(closed);   // the walk out from the town's closed edge
    const flood = (inside0) => { const o = new Uint8Array(N * N), qq = []; for (let i = 0; i < N; i++) for (const k of [i, (N - 1) * N + i, i * N, i * N + N - 1]) if (inside0(k) && !o[k]) { o[k] = 1; qq.push(k); } for (let i2 = 0; i2 < qq.length; i2++) { const k = qq[i2]; for (const e of [1, -1, N, -N]) { const K = k + e; if (K >= 0 && K < N * N && !o[K] && inside0(K)) { o[K] = 1; qq.push(K); } } } return o; };
    const beyond = flood((k) => dC[k] > WALL_OUT);   // the outside of the wall's ring: reached from the window's edge (a pocket inside never is)
    country = new Uint8Array(N * N); for (let k = 0; k < N * N; k++) if (beyond[k] && dC[k] >= BUFFER) country[k] = 1;
    const inBuffer = (k) => beyond[k] && dC[k] < BUFFER && !wet[k] && can[k] && occ[k] === -1;
    const opts = (WALLS[t] ?? []).find((w) => c.level >= w.level), wary = place.temper === "wary" || place.temper === "raiders";
    if (opts && hashAt(Math.round(c.households), c.level, seed + 131) < Math.min(1, opts.share * (wary ? PHI : 1))) {   // a wary people walls a golden part more often   // vision: the buffer's own measure (its graves, gardens and keys)
      const cells = [], gates = [];
      for (let k = N + 1; k < N * N - N - 1; k++) { if (dC[k] !== WALL_OUT || wet[k] || beyond[k]) continue; if (![1, -1, N, -N].some((e) => beyond[k + e] && !wet[k + e])) continue; const xz = pl.xz(k); if (occ[k] === STREET) gates.push(xz); else if (occ[k] === -1) cells.push(xz); }   // the ring's outer edge, where it meets land (the water is its own wall)
      // the gates: where the town's arteries head out, the wall's nearest cells opened three wide (and two at the least, on opposite sides, if it has fewer)
      const heads = []; for (const st of streets) if (st.cls === "artery" || st.cls === "road") { const a = st.pts[0], b = st.pts.at(-1); heads.push(Math.hypot(...a) > Math.hypot(...b) ? a : b); }
      const nearestWall = ([x, z]) => cells.reduce((best, c2) => (Math.hypot(c2[0] - x, c2[1] - z) < Math.hypot(best[0] - x, best[1] - z) ? c2 : best), cells[0]);
      const gateAt = []; if (cells.length) { for (const hd of heads.sort((a, b) => Math.hypot(...b) - Math.hypot(...a))) { const g = nearestWall(hd); if (gateAt.length < FIB[5] && !gateAt.some((q) => Math.hypot(q[0] - g[0], q[1] - g[1]) < FIB[8])) gateAt.push(g); } if (gateAt.length < 2) { const far = cells.reduce((b, c2) => (gateAt.length && Math.hypot(c2[0] - gateAt[0][0], c2[1] - gateAt[0][1]) > Math.hypot(b[0] - gateAt[0][0], b[1] - gateAt[0][1]) ? c2 : b), cells[0]); gateAt.push(far); } }   // vision: eight gates at the most, 34 apart
      for (const g of gateAt) { for (let i2 = cells.length - 1; i2 >= 0; i2--) if (Math.hypot(cells[i2][0] - g[0], cells[i2][1] - g[1]) <= 1.5) gates.push(...cells.splice(i2, 1)); }   // derived: the gate three wide
      const towers = []; for (const [x, z] of cells) if (!towers.some(([a, b]) => Math.hypot(a - x, b - z) < FIB[7]) && !gates.some(([a, b]) => Math.hypot(a - x, b - z) < FIB[4])) towers.push([x, z]);   // vision: a tower every 21 blocks of wall, none in a gate
      const ditch = []; if (opts.kind !== "earth") for (let k = 0; k < N * N; k++) if (beyond[k] && (dC[k] === WALL_OUT + 2 || dC[k] === WALL_OUT + 3) && occ[k] === -1 && !wet[k] && can[k]) ditch.push(pl.xz(k));   // vision: the ditch two and three blocks out
      for (let i2 = ditch.length - 1; i2 >= 0; i2--) if (gates.some((g) => Math.hypot(g[0] - ditch[i2][0], g[1] - ditch[i2][1]) <= FIB[3] + 1)) ditch.splice(i2, 1);   // the causeway over the ditch before each gate   // vision: two gates at the least
      if (cells.length > FIB[6]) { wall = { kind: opts.kind, cells, gates, towers, ditch }; for (const [x, z] of cells) occ[I(x, z)] = -3; for (const [x, z] of ditch) occ[I(x, z)] = -3; }   // the wall holds its line: nothing built on it, lanes through its gates only   // vision: the buffer's own measure (its graves, gardens and keys)
    }
    // the buffer's things: by the busiest ways out (where a street leaves the town), the cemetery first, then market gardens either side of the road
    buffer = { cemetery: null, gardens: [], common: [] };
    const exits = (wall?.gates ?? []).length ? wall.gates : (() => { const ex = []; for (let k = 0; k < N * N; k++) if (occ[k] === STREET && dC[k] === WALL_OUT && beyond[k]) ex.push(pl.xz(k)); return ex; })();
    const spread = []; for (const g of exits) if (!spread.some((e) => Math.hypot(e[0] - g[0], e[1] - g[1]) < FIB[8])) spread.push(g);   // one gate in each 34 blocks of ring   // vision: the buffer's own measure (its graves, gardens and keys)
    const rect = (x0, z0, w, l) => { const out = []; for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + l; z++) { if (!inside(x, z) || !inBuffer(I(x, z))) return null; out.push([x, z]); } return out; };
    for (const [gi, [gx, gz]] of spread.entries()) {
      const k = I(gx, gz), ox = Math.sign((dC[k + 1] ?? 0) - (dC[k - 1] ?? 0)), oz = Math.sign((dC[k + N] ?? 0) - (dC[k - N] ?? 0)), out = Math.abs(ox) >= Math.abs(oz) ? [ox || 1, 0] : [0, oz || 1], side = [-out[1], out[0]];   // the way out from the gate, and across it
      const want = gi === 0 ? [FIB[7], FIB[6], "cemetery"] : [FIB[6], FIB[5], "garden"];   // vision: the cemetery 21 by 13, a garden 13 by 8
      for (const sd of [1, -1]) {
        const cx = gx + out[0] * (FIB[5] + want[1] / 2) + side[0] * sd * (FIB[3] + want[0] / 2), cz = gz + out[1] * (FIB[5] + want[1] / 2) + side[1] * sd * (FIB[3] + want[0] / 2);   // derived: eight out from the gate, three off the road
        const [w, l] = out[0] ? [want[1], want[0]] : [want[0], want[1]], cells = rect(Math.round(cx - w / 2), Math.round(cz - l / 2), w, l); if (!cells) continue;
        for (const [x, z] of cells) occ[I(x, z)] = -5;   // vision: the buffer's own measure (its graves, gardens and keys)
        if (want[2] === "cemetery" && !buffer.cemetery) buffer.cemetery = { cells, w, l, x0: cells[0][0], z0: cells[0][1] }; else buffer.gardens.push({ cells, w, l, x0: cells[0][0], z0: cells[0][1] });
        if (want[2] === "cemetery") break;
      }
    }
    for (let k = 0; k < N * N; k++) if (inBuffer(k) && hashAt(...pl.xz(k), seed + 233) < 1 / FIB[11]) buffer.common.push(pl.xz(k));   // the common's beasts, one to 144 blocks   // vision: the buffer's own measure (its graves, gardens and keys)
  }
  /** A farmstead at a site: the house square, facing the town, and its lane wandering to the nearest lane, track or street (the cheapest walk over the ground, a little chance in the cost so it bends like a lane). */
  const farmAt = (q, x0, z0) => {
    const k0 = I(x0, z0), gx = (pl.D[k0 + 1] ?? 0) - (pl.D[k0 - 1] ?? 0), gz = (pl.D[k0 + N] ?? 0) - (pl.D[k0 - N] ?? 0), toward = Math.atan2(-gz, -gx);   // the way back toward the town's heart
    const rho = wrap(toward - base(q)), k = ((Math.round(rho / (Math.PI / 2)) % 4) + 4) % 4, rot = k * (Math.PI / 2), f = fit(q, x0, z0, rot); if (f.why) return false;   // vision: the farmstead's own measure (its coop, its run, its keys)
    const fa = base(q) + rot, fd = (k % 2 ? q.atom.w : q.atom.l) / 2 + 1, door = [Math.round(x0 + Math.cos(fa) * fd), Math.round(z0 + Math.sin(fa) * fd)];
    if (!inside(...door) || occ[I(...door)] !== -1) return false;
    const id = placed.length; for (const [a, b] of f.cells) occ[I(a, b)] = id;
    const Dd = new Map([[I(...door), 0]]), from = new Map(), hp2 = heap(); hp2.push([0, ...door]); let hit = -1;
    while (hp2.size) { const [dd, x, z] = hp2.pop(), kk = I(x, z); if (dd > Dd.get(kk)) continue; if (occ[kk] === STREET) { hit = kk; break; } if (dd > FARM.BAND * PHI ** 2) break;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Z = z + b; if (!inside(X, Z)) continue; const K = I(X, Z); if (occ[K] !== -1 && occ[K] !== STREET) continue; if (!can[K] || wet[K]) continue; const g = Math.abs(Math.max(0, h[K]) - Math.max(0, h[kk])), nd = dd + 1 + (g * GRADE_COST) ** 2 + vnoiseG(X / FIB[6], Z / FIB[6], seed) * PHI; if (nd < (Dd.get(K) ?? Infinity)) { Dd.set(K, nd); from.set(K, kk); hp2.push([nd, X, Z]); } } }   // derived: a step, its climb's cost, and up to a golden step of chance
    if (hit < 0) { for (const [a, b] of f.cells) occ[I(a, b)] = -1; return false; }
    const pts = []; for (let kk = hit; kk !== undefined; kk = from.get(kk)) { pts.push(pl.xz(kk)); if (kk === I(...door)) break; }
    const lane = { sid: streets.length, pts: pts.reverse().filter(([a, b]) => occ[I(a, b)] !== STREET), cls: "track", parent: -1 }; lane.len = lane.pts.length; streets.push(lane);
    for (const [a, b] of lane.pts) occ[I(a, b)] = STREET;   // the lane a lane now: the next farm may join it
    placed.push({ ...q, x: Math.round(x0), z: Math.round(z0), k, a: 0, rot, door, front: "track", street: lane.sid, ease: f.e, sand: 0, ring: Math.floor(at(D, x0, z0) / RING) });
    return true;
  };
  // ---- the country (world/farms.js): the town's math turned inside out. The land picks the sites, the modules keep apart, the lanes come last
  const farms = [], tracks = [];
  { const total = Math.max(1, Math.round(c.households / (place.living === "fishers" ? FARM.PER_FISHERS : FARM.PER))), rs = t === "arctic" ? 1 : FARM.RANCH[place.living] ?? FARM.RANCH.farmers, nR = Math.round(total * rs), want = { ranch: nR, farm: total - nR };
    const edges = []; for (let z = -R + 1; z < R; z++) for (let x = -R + 1; x < R; x++) { const k = I(x, z); if (P[k] > 0 && (P[k + 1] <= 0 || P[k - 1] <= 0 || P[k + N] <= 0 || P[k - N] <= 0)) edges.push([x, z]); }
    const dT = edges.length ? voronoiOf(pl, edges).D : null;
    const open = (k) => P[k] <= 0 && can[k] && !wet[k] && dT && isFinite(dT[k]) && occ[k] === -1 && (!country || country[k]);
    if (dT) {
      // the ring: as much country as the town is ground, a golden part over (the modules take a golden part of it; the rest stays open)
      let built0 = 0; for (let k = 0; k < N * N; k++) if (P[k] > 0 && (occ[k] >= 0 || occ[k] === STREET)) built0++; const townArea = Math.round(built0 * PHI);   // the town's ground: what it built and its open share
      const ds = []; for (let k = 0; k < N * N; k++) if (open(k)) ds.push(dT[k]); ds.sort((a2, b2) => a2 - b2);
      const B = Math.max(FIB[8], ds[Math.min(ds.length - 1, Math.floor(townArea * PHI))] ?? FIB[8]), band = (k) => open(k) && dT[k] <= B;   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
      // the water's nearness: a breadth-first walk out from the wet cells
      const dw = new Float32Array(N * N).fill(Infinity), qw = []; for (let k = 0; k < N * N; k++) if (wet[k]) { dw[k] = 0; qw.push(k); } for (let i2 = 0; i2 < qw.length; i2++) { const k = qw[i2]; if (dw[k] >= FIB[7]) continue; for (const dd of [1, -1, N, -N]) { const K = k + dd; if (K < 0 || K >= N * N || dw[K] <= dw[k] + 1) continue; dw[K] = dw[k] + 1; qw.push(K); } }   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
      const fitness = (k, kind) => (kind === "farm" ? ease[k] ** PHI : ease[k] ** (1 / PHI)) * (dw[k] <= FIB[7] ? PHI : 1) / (1 + dT[k] / B) / PHI;   // the land's fitness for a farm (flat) or a ranch (it takes rougher), the water near, the market near   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
      const pool = [...farmQ]; const take = (id) => { const i2 = pool.findIndex((q) => q.id === id); if (i2 >= 0) return pool.splice(i2, 1)[0]; const sd = seed + FIB[9] + farms.length * FIB[4] + id.length, b = make(id, sd); return { id, seed: sd, b, atom: atomOf(b), tall: heightOf(b.vox), parts: [] }; };   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
      const cands = []; for (let z = -R + 1; z < R; z += FIB[4]) for (let x = -R + 1; x < R; x += FIB[4]) { const k = I(x, z); if (band(k)) cands.push([x, z, k]); }   // vision: the land looked at every five blocks
      const boxes = [], CARD = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // given: the four ways
      const nAll = Math.max(total, Math.round(townArea / (MODULE.SIZES[1][0] * MODULE.SIZES[1][1]))), extraR = Math.round((nAll - total) * rs); want.ranch += extraR; want.farm += nAll - total - extraR;   // as many as cover the town's own ground (the minimum the least)
      const kinds = []; for (let i = 0; i < nAll; i++) kinds.push(i % 2 === 0 ? (want.farm > 0 ? "farm" : "ranch") : want.ranch > 0 ? "ranch" : "farm"), want[kinds.at(-1)]--;
      for (const kind of kinds) {
        const order = cands.map(([x, z, k]) => [x, z, k, fitness(k, kind) * (1 + hashAt(x, z, seed + 151) / FIB[5])]).filter((cd) => band(cd[2])).sort((a2, b2) => b2[3] - a2[3]);   // the fittest land first, an eighth of chance   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
        const house = take("farmhouse"), outs = FARM.BUILD[kind].slice(1).map(take);
        let done = null;
        for (const [x, z, k, fv] of order) {   // every site, the fittest first
          const apart = MODULE.APART * (1 + (1 - Math.min(1, fv)) * PHI);   // the poorer the land, the further apart (a Poisson disc on the fitness)
          const toward = Math.atan2(-(dT[k + N] - dT[k - N]), -(dT[k + 1] - dT[k - 1])), qd = Number.isFinite(toward) ? ((Math.round(toward / (Math.PI / 2)) % 4) + 4) % 4 : 0, ez = CARD[(qd + 2) % 4], ex = CARD[(qd + 3) % 4];   // the module's back is away from the town; its x across   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
          for (const [W, L] of MODULE.SIZES) {
            const m = moduleOf({ kind, W, L, house: { w: house.atom.w, l: house.atom.l }, outs: outs.map((o) => ({ w: o.atom.w, l: o.atom.l })) }); if (!m) continue;
            const ox = x - Math.round((W / 2) * ex[0]), oz = z - Math.round((W / 2) * ex[1]), atM = (lx, lz) => [ox + lx * ex[0] + lz * ez[0], oz + lx * ex[1] + lz * ez[1]];
            const xs = [atM(0, 0)[0], atM(W - 1, L - 1)[0]], zs = [atM(0, 0)[1], atM(W - 1, L - 1)[1]], bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
            if (boxes.some((b) => bx0 - apart < b[2] && bx1 + apart > b[0] && bz0 - apart < b[3] && bz1 + apart > b[1])) continue;   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
            let ok = true, es = 0; for (let X = bx0; X <= bx1 && ok; X++) for (let Z = bz0; Z <= bz1; Z++) { if (!inside(X, Z) || !band(I(X, Z))) { ok = false; break; } es += ease[I(X, Z)]; }
            let lo = Infinity, hi = -Infinity; if (ok) for (let X = bx0; X <= bx1; X += 2) for (let Z = bz0; Z <= bz1; Z += 2) { const hh = h[I(X, Z)]; if (hh < lo) lo = hh; if (hh > hi) hi = hh; }   // its ground's span, every other block
            if (!ok || hi - lo > FIB[6] || es / (W * L) < (kind === "farm" ? 1 / PHI : 1 / PHI ** 2)) continue;   // vision: no module across more than 13 blocks of rise   // the land takes it, or not: a farm wants it level on the whole, a ranch less so
            done = { m, atM, box: [bx0, bz0, bx1, bz1], ez, ex };
            break;
          }
          if (done) break;
        }
        if (!done) { pool.push(house, ...outs); continue; }   // no land for it: not forced
        const { m, atM, box } = done; boxes.push(box);
        for (let X = box[0]; X <= box[2]; X++) for (let Z = box[1]; Z <= box[3]; Z++) occ[I(X, Z)] = -4;   // the module's ground, held whole   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
        const fid = farms.length, front = Math.atan2(-done.ez[1], -done.ez[0]), qs = [house, ...outs];
        const kept = new Set(m.spots.map((sp) => sp.i)); for (const [j, q] of qs.entries()) if (!kept.has(j)) pool.push(q);   // what the piece left out goes back
        m.spots.forEach((sp, j) => { const q = qs[sp.i]; const [wx, wz] = atM(sp.cx, sp.cz), rho = wrap(front - base(q)), kq = ((Math.round(rho / (Math.PI / 2)) % 4) + 4) % 4, rot = kq * (Math.PI / 2);   // given: four quarter turns
          const cells = []; for (const [a, b] of footprintOf(q, wx, wz, rot)) if (inside(a, b)) cells.push([a, b]); const id = placed.length; for (const [a, b] of cells) occ[I(a, b)] = id;
          const fd = (kq % 2 ? q.atom.w : q.atom.l) / 2 + 1; placed.push({ ...q, x: Math.round(wx), z: Math.round(wz), k: kq, a: 0, rot, door: [wx + Math.cos(front) * fd, wz + Math.sin(front) * fd], front: "track", ease: 1, sand: 0, ring: 0, farm: fid, of: j ? placed.length - j : undefined }); });
        { const hs2 = []; for (let lx = 0; lx < m.W; lx++) for (let lz = 0; lz < m.yard; lz++) { const [a, b] = atM(lx, lz); hs2.push(Math.round(Math.max(0, h[I(a, b)]))); } hs2.sort((a2, b2) => a2 - b2); m.Y = hs2[hs2.length >> 1]; }   // the yard's level: its median ground, its buildings on it
        const gate = atM(m.trackX, -1);
        farms.push({ i: fid, kind, m, box, ox: atM(0, 0), ex: done.ex, ez: done.ez, gate, x: Math.round(atM(m.W / 2, 0)[0]), z: Math.round(atM(m.W / 2, 0)[1]), cells: [[box[0], box[1]], [box[2], box[3]]] });   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
      }
      // the lanes: one tree of least effort out from the town's streets, climbing dear, a little chance in the cost; each gate walks it home, so lanes merge as they near the town
      if (farms.length) {
        const Dl = new Float64Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), hq = heap();
        for (let k = 0; k < N * N; k++) if (occ[k] === STREET && streets.length) { Dl[k] = 0; hq.push([0, ...pl.xz(k)]); }
        while (hq.size) { const [dd, x, z] = hq.pop(), kk = I(x, z); if (dd > Dl[kk]) continue; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Z = z + b; if (!inside(X, Z)) continue; const K = I(X, Z); if (occ[K] !== -1 || !can[K] || wet[K]) continue; const g = Math.abs(Math.max(0, h[K]) - Math.max(0, h[kk])), nd = dd + 1 + PHI * (g * GRADE_COST) ** 2 + vnoiseG(X / FIB[7], Z / FIB[7], seed + 3) / PHI; if (nd < Dl[K]) { Dl[K] = nd; from[K] = kk; hq.push([nd, X, Z]); } } }   // derived: a step, its climb dear (a golden part over the roads'), a little chance
        const laneCells = new Set();
        for (const f of farms) { let k = inside(...f.gate) ? I(...f.gate) : -1; const pts = []; while (k >= 0 && occ[k] !== STREET && !laneCells.has(k) && pts.length < N) { pts.push(pl.xz(k)); laneCells.add(k); k = from[k]; } if (k >= 0) pts.push(pl.xz(k)); if (pts.length > 1) { const tr = { sid: streets.length, pts, cls: "track", parent: -1, len: pts.length }; streets.push(tr); tracks.push(tr); } }
        for (const k of laneCells) occ[k] = STREET;
      }
      var wildRing = []; for (let k = 0; k < N * N; k++) { if (!band(k)) continue; const [x, z] = pl.xz(k), r0 = hashAt(x, z, seed + 211); if (r0 < 1 / FIB[12]) wildRing.push([x, z, "tree"]); else if (r0 < 1 / FIB[10]) wildRing.push([x, z, "flower"]); }   // the open country between: a lone tree in 233, a flower in 89   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
      var rural = { want: { farms: kinds.filter((k2) => k2 === "farm").length, ranches: kinds.filter((k2) => k2 === "ranch").length }, built: { farms: farms.filter((f) => f.kind === "farm").length, ranches: farms.filter((f) => f.kind === "ranch").length }, ring: Math.round(B), townArea, farmed: farms.reduce((a2, f) => a2 + f.m.W * f.m.L, 0), sizes: farms.map((f) => `${f.m.W}x${f.m.L}`).reduce((o, s2) => ({ ...o, [s2]: (o[s2] ?? 0) + 1 }), {}), lanes: tracks.reduce((a2, tr) => a2 + tr.len, 0) };
    }
  }
  // ---- the measures
  const eases = placed.map((p) => p.ease), cantN = {}; for (const p of placed) { const d = Math.round(Math.abs(p.a) * 180 / Math.PI); cantN[d] = (cantN[d] ?? 0) + 1; }
  const frontN = {}; for (const p of placed) frontN[p.front] = (frontN[p.front] ?? 0) + 1;
  const bodies = placed.filter((p) => p.of === undefined), DEG = 180 / Math.PI;   // given: degrees
  const offStreet = (p) => { const st = streets[p.street]; if (!st || p.pathed) return 0; let best = Infinity, tg = 0; for (let i = 1; i < st.pts.length; i++) { const d = Math.hypot(st.pts[i][0] - p.door[0], st.pts[i][1] - p.door[1]); if (d < best) { best = d; tg = Math.atan2(st.pts[i][1] - st.pts[i - 1][1], st.pts[i][0] - st.pts[i - 1][0]); } } const d = Math.abs(wrap(4 * (p.rot - tg))) / 4; return d * DEG; };   // its turn off its street's, folded to the quarter (a 4-direction difference)   // vision: CANTS by index (the people's own allowance)
  const align = { square: bodies.filter((p) => !p.a).length / Math.max(1, bodies.length), meanCant: bodies.reduce((a, p) => a + Math.abs(p.a) * DEG, 0) / Math.max(1, bodies.length), offStreet: bodies.reduce((a, p) => a + offStreet(p), 0) / Math.max(1, bodies.length), allowed: cantOf.cants.map((i) => +(CANTS[i] * DEG).toFixed(1)), cardinal: !!cantOf.cardinal };
  const measures = { rural, align, ease: eases.reduce((a, b) => a + b, 0) / Math.max(1, eases.length), hard: eases.filter((e) => e < 1 / PHI ** 2).length / Math.max(1, eases.length), cants: cantN, fronts: frontN, streets: streets.length, length, need: Math.round(need), wants, have, unplaced: order.length - placed.filter((p) => p.of === undefined && !p.light).length, partsLost, lightsLost, fails, relaxed, pathed, why, slots: slots.length, top: pour.top, reach: pour.reach, repose: pour.repose, tried };   // derived: a hard site is under 1/phi^2 easy (a block and a half of spread)
  const spine = new Set(), bridges = new Set();
  for (const s of streets) if (s.cls === "artery") for (const [x, z] of s.pts) { const X = Math.round(x), Z = Math.round(z); (inside(X, Z) && wet[I(X, Z)] ? bridges : spine).add(`${X},${Z}`); }
  const sigma = (a) => a.r / PHI, rho = (x, z) => placed.reduce((s2, p) => s2 + Math.exp(-((x - p.x) ** 2 + (z - p.z) ** 2) / (2 * sigma(p.atom) ** 2)), 0);
  const out = { census: c, placed, rho, shape, port, farms, wall, buffer, wild: typeof wildRing === "undefined" ? [] : wildRing, districts: { centres, A, wards, turns, of: (x, z) => at(vor.lab, x, z) }, spine, bridges, stilted, streets, habit, measures, pour: { top: pour.top, reach: pour.reach, max: pour.max, at: (x, z) => at(P, x, z) }, frame: (x, z) => at(theta, x, z), ease: (x, z) => at(ease, x, z), walk: (x, z) => at(D, x, z), grid: { N, R, occ, cls, P, h, wet, can }, mass, dropped: order.length - placed.filter((p) => p.of === undefined).length, quarters: Array.from({ length: nq }, (_, i) => ({ i })), grown: true };
  out.gaps = gapsOf(out, t); const gk = {}; for (const gp of out.gaps) gk[gp.kind] = (gk[gp.kind] ?? 0) + 1; out.measures.gaps = gk;
  return out;
}
// ---- the gaps: the ground no building fits, kept by its people as its shape and place suggest
//   a gap is a piece of free town ground (inside the town: within a lot and a half of a street), its area, its shape
//   matrix's eigenvalue ratio (shapeOf: under phi round, past phi^3 a strip), the street it touches, its slope (ease),
//   the water beside it. Small and on the street: a square or a garden plot; a strip: a row of trees or beds; round
//   and middling: the people's garden; big: its green or its grove; steep: terraced; by the water: its landing
export const GAP = {
  european: { square: "plaza", plot: "kitchen", strip: "hedgerow", garden: "garden", big: "green", steep: "terrace", shore: "landing" },
  therans: { square: "plaza", plot: "pots", strip: "vines", garden: "terrace", big: "olives", steep: "terrace", shore: "landing" },
  indian_ocean: { square: "plaza", plot: "kitchen", strip: "palms", garden: "charbagh", big: "palms", steep: "terrace", shore: "landing" },
  east_asian: { square: "plaza", plot: "kitchen", strip: "bamboo", garden: "pond", big: "grove", steep: "grove", shore: "landing" },
  japanese: { square: "plaza", plot: "kitchen", strip: "bamboo", garden: "zen", big: "grove", steep: "grove", shore: "landing" },
  norse: { square: "green", plot: "kailyard", strip: "hedgerow", garden: "kailyard", big: "pasture", steep: "grove", shore: "racks" },
  dugout: { square: "green", plot: "berries", strip: "grove", garden: "berries", big: "grove", steep: "grove", shore: "racks" },
  birchbark: { square: "green", plot: "berries", strip: "grove", garden: "berries", big: "grove", steep: "grove", shore: "racks" },
  pacific: { square: "green", plot: "taro", strip: "palms", garden: "taro", big: "palms", steep: "grove", shore: "landing" },
  shallow: { square: "plaza", plot: "taro", strip: "palms", garden: "taro", big: "palms", steep: "grove", shore: "landing" },
  arctic: { square: "green", plot: "racks", strip: "racks", garden: "racks", big: "green", steep: "green", shore: "racks" },
};   // vision: each people's ways with spare ground
export function gapsOf(g, t) {
  const { N, R, occ, P, can, wet } = g.grid, ease = g.ease, I = (x, z) => (z + R) * N + (x + R), STREET = -2, kinds = GAP[t] ?? GAP.european;
  // inside the town: a breadth-first walk out from the streets and buildings over free ground, a lot and a half deep
  const near = new Float64Array(N * N).fill(Infinity), q = [];
  for (let k = 0; k < N * N; k++) if (occ[k] !== -1) { near[k] = 0; q.push(k); }
  const deep = FIB[6] + FIB[4];   // derived: eighteen blocks, a lot and a half
  for (let i = 0; i < q.length; i++) { const k = q[i]; if (near[k] >= deep) continue; for (const d of [1, -1, N, -N]) { const K = k + d; if (K < 0 || K >= N * N || near[K] <= near[k] + 1 || occ[K] !== -1 || !can[K] || wet[K]) continue; near[K] = near[k] + 1; q.push(K); } }
  const seen = new Uint8Array(N * N), gaps = [];
  for (let k0 = 0; k0 < N * N; k0++) {
    if (seen[k0] || occ[k0] !== -1 || !isFinite(near[k0]) || near[k0] < 1 || P[k0] <= 0) continue;
    const cells = [], st = [k0]; seen[k0] = 1; let street = 0, shore = 0, es = 0, edge = false;
    while (st.length) { const k = st.pop(); cells.push(k); es += ease[k] ?? 1; for (const d of [1, -1, N, -N]) { const K = k + d; if (K < 0 || K >= N * N) continue; if (occ[K] === STREET) street++; if (wet[K]) shore++; if (!isFinite(near[K]) && can[K] && !wet[K] && occ[K] === -1) edge = true; if (seen[K] || occ[K] !== -1 || !isFinite(near[K]) || near[K] < 1 || P[K] <= 0) continue; seen[K] = 1; st.push(K); } }
    if (edge && cells.length > FIB[10]) continue;   // the open country past the town, not a gap in it   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    const xz = cells.map((k) => [(k % N) - R, Math.floor(k / N) - R]), sh = cells.length > 2 ? shapeOf(xz) : { ratio: 1, axis: [1, 0] }, A = cells.length, e = es / A;
    let kind;
    if (A < FIB[4]) kind = null;   // under five blocks: the grass is left   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    else if (shore > A / FIB[4]) kind = kinds.shore;   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    else if (e < 1 / PHI ** 2) kind = kinds.steep;
    else if (sh.ratio > PHI ** 3) kind = kinds.strip;   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    else if (A < FIB[8]) kind = street > FIB[4] && g.census.level >= 2 ? kinds.square : kinds.plot;   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    else if (A < FIB[10] * FIB[3]) kind = kinds.garden;   // vision: the town's own measure (its lots, spacings and turns, in Fibonacci numbers)
    else kind = kinds.big;
    if (kind) gaps.push({ kind, area: A, ratio: +sh.ratio.toFixed(2), axis: sh.axis, cells: xz });
  }
  return gaps;
}

function footprintOf(q, cx, cz, rot) { const out = [], c0 = Math.cos(rot), s0 = Math.sin(rot), r = Math.ceil(Math.hypot(q.atom.w, q.atom.l) / 2) + 1; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const lx = a * c0 + b * s0, lz = -a * s0 + b * c0; if (Math.abs(lx) <= q.atom.w / 2 && Math.abs(lz) <= q.atom.l / 2) out.push([Math.round(cx) + a, Math.round(cz) + b]); } return out; }
function dist2(cells, f) { let sx = 0, sz = 0; for (const [x, z] of cells) { sx += x; sz += z; } return Math.hypot(sx / cells.length - f.x, sz / cells.length - f.z); }
function inBox(cells, x, z) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [a, b] of cells) { if (a < x0) x0 = a; if (a > x1) x1 = a; if (b < z0) z0 = b; if (b > z1) z1 = b; } return x >= x0 && x <= x1 && z >= z0 && z <= z1; }
function heightOf(vox) { let y0 = Infinity, y1 = -Infinity; for (const k of vox.keys()) { const y = +k.split(",")[1]; if (y < y0) y0 = y; if (y > y1) y1 = y; } return Math.max(1, y1 - y0 + 1); }
function quantile(a, f) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * f))] : 0; }

// ---- the cant on the voxels: a molecule turned to its lattice
const THIN = /stairs|slab|door|trapdoor|fence|pane|bars|torch|lantern|carpet|bed|flower|sign|button|lever|chain|candle|pot|banner|rail|ladder|_wall$|wall_|plate|campfire|bell|vine|leaves/;   // the blocks a canted wall doesn't stretch to fill
/** A building's blocks turned by a cant (radians, under an eighth turn): each column takes the block under its centre, or a solid block under its corners (so the canted walls stay tight). */
export function cantVox(vox, a) {
  if (!a) return vox;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; const ys = new Set();
  for (const k of vox.keys()) { const [x, y, z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); ys.add(y); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, c = Math.cos(a), s = Math.sin(a), r = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2) + 1, out = new Map(), Y = [...ys];
  const src = (dx, dz) => [Math.round(cx + dx * c + dz * s), Math.round(cz - dx * s + dz * c)];
  const q = 0.35;   // vision: the corners sampled, a third of a block in
  for (let X = Math.floor(cx - r); X <= Math.ceil(cx + r); X++) for (let Z = Math.floor(cz - r); Z <= Math.ceil(cz + r); Z++) {
    const dx = X - cx, dz = Z - cz, mid = src(dx, dz), corners = [src(dx - q, dz - q), src(dx + q, dz - q), src(dx - q, dz + q), src(dx + q, dz + q)];
    for (const y of Y) {
      let b = vox.get(`${mid[0]},${y},${mid[1]}`);
      if (!b) for (const [u, v] of corners) { const o = vox.get(`${u},${y},${v}`); if (o && !THIN.test(o.id)) { b = o; break; } }
      if (b) out.set(`${X},${y},${Z}`, b);
    }
  }
  return out;
}
