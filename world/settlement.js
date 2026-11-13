// Pure (given a loaded map). Settlements lay themselves out: the districts of a town and its walls are
// a function of its people's culture, what stands (economy.js), and the ground round it. Nothing is
// placed by hand, and the same state always gives the same town.
//
//   plots     the ground round the site, in PLOT-block plots out to REACH plots: each with its height,
//             slope and whether it's water, and its cost from the site (distance, steepness, and the
//             culture's pull along the shore)
//   districts each kind (harbour, civic, market, homes, crafts, farms, pasture) ranks the plots by its
//             own affinity (the harbour the shore, crafts downwind of the belt's wind, the hall high
//             ground, farms flat open land far out) and takes the first it needs, in a fixed order
//             of districts. What it needs is its standing buildings times their plots (and the
//             culture's spread, the yards between). Growth takes the next plots; shrinking gives back
//             the last: a town that shrinks and grows again is the same town
//   enemies   a contested border pushes growth away from the enemy's side
//   ruins     a town built on a ruin builds on its old streets: each district saves REUSE plots of
//             cost on the plots it held before (the ruin's memory, economy.js)
//   walls     a people whose guard calls for one rings its walled districts (homes, civic, market,
//             crafts; the harbour meets the shore) with a wall on the plots just outside, gates where
//             the roads go out to the harbour and the fields. Outgrown, a new wall goes up outside;
//             the old line is remembered (old walls), as real cities keep theirs as streets
import { GIVEN, D } from "../core/given.js";
import { blockHeight } from "./map.js";
import { belt } from "../core/wind.js";
import { latOf } from "../core/globe.js";
import { mod } from "../core/fixed.js";

export const LAYOUT = Object.freeze({
  PLOT: 4,                // vision: blocks a plot (a house and its yard's width)
  REACH: 40,              // vision: plots from the site a town may grow (160 blocks)
  SLOPE: 6,               // vision: cost of a block of rise a plot, in plots of distance
  STEEP: 1.2,             // vision: blocks of rise a block past which a plot can't be built
  ENEMY: 8,               // vision: plots of cost toward a contested neighbour
  REUSE: 12,              // vision: plots of cost a district saves by building where it stood before (a ruin's streets)
  PLOTS: { home: 1, work: 2, hall: 4, guard: 0, fields: 12, pasture: 10 },   // vision: plots each kind of building takes
  WALLED: ["homes", "civic", "market", "crafts"],
  ORDER: ["harbour", "civic", "market", "homes", "crafts", "farms", "pasture"],
});
// vision: each tradition's form (after the old culture gates): spread (yard plots between houses),
// shore (pull along the water: 0 none, 1 a single ribbon), heart (what the centre is), water (builds on it)
export const FORM = {
  norse: { spread: 2, shore: 0.3, heart: "civic" }, european: { spread: 0, shore: 0.6, heart: "market" },   // vision: the form's numbers
  birchbark: { spread: 3, shore: 0.2, heart: "open" }, pacific: { spread: 3, shore: 0.3, heart: "open" },   // vision: the form's numbers
  indian_ocean: { spread: 0, shore: 0.5, heart: "market" }, east_asian: { spread: 1, shore: 0.2, heart: "civic" },   // vision: the form's numbers
  japanese: { spread: 0, shore: 0.8, heart: "market" }, dugout: { spread: 1, shore: 0.9, heart: "open" },   // vision: the form's numbers
  shallow: { spread: 2, shore: 0.4, heart: "open", water: true }, arctic: { spread: 4, shore: 0.4, heart: "open" },   // vision: the form's numbers
};
const DISTRICT_OF = (name) => (/^home/.test(name) ? "homes" : /boathouse|net racks|smokehouse|landing/.test(name) ? "harbour" : /long hall|hall/.test(name) ? "civic" : /market|warehouse/.test(name) ? "market" :
  /barn|granary|fields/.test(name) ? "farms" : /pens|byre|shearing/.test(name) ? "pasture" : /palisade|wall|lookout/.test(name) ? "guard" : "crafts");
const PLOTS_OF = (b) => (b.name === "fields" ? LAYOUT.PLOTS.fields : /pens|byre/.test(b.name) ? LAYOUT.PLOTS.pasture : LAYOUT.PLOTS[b.size] ?? 1);

/** The plots round a site (a chunk index), with their ground. */
export function plotsAt(site) {
  const W = D.CELLS_W, C = D.PX, P = LAYOUT.PLOT, R = LAYOUT.REACH;
  const x0 = (site % W) * C + C / 2, z0 = Math.floor(site / W) * C + C / 2, out = [];
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    if (i * i + j * j > R * R) continue;
    const x = mod(x0 + i * P, D.W), z = z0 + j * P, h = blockHeight(x, z), e = blockHeight(x + P, z), n = blockHeight(x, z + P);
    out.push({ i, j, x, z, h, water: h <= 0, slope: Math.hypot(e - h, n - h) / P });
  }
  const at = new Map(out.map((q) => [`${q.i},${q.j}`, q]));
  for (const q of out) q.shore = !q.water && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at.get(`${q.i + a},${q.j + b}`)?.water);   // given: the four neighbours
  for (const q of out) { let d = Infinity; for (let r = 0; r <= R && d === Infinity; r++) for (let a = -r; a <= r; a++) for (const [u, v] of [[a, -r], [a, r], [-r, a], [r, a]]) if (at.get(`${q.i + u},${q.j + v}`)?.shore) d = Math.min(d, Math.hypot(u, v)); q.coast = d; }
  return { plots: out, at, x0, z0 };
}

/** The town: every plot's district (or none), the walls, the gates. built: the plan's standing flags. */
export function layout(p, site, plan, built, { enemyDir = null, memory = null } = {}) {
  const F = FORM[p.tradition] ?? FORM.european, G = plotsAt(site), Lo = LAYOUT;
  const wind = belt(latOf(G.z0)), down = { i: Math.sin(((wind.from + 180) * Math.PI) / 180), j: -Math.cos(((wind.from + 180) * Math.PI) / 180) };   // the wind blows toward the opposite bearing
  const buildable = (q) => (q.water ? !!F.water : q.slope <= Lo.STEEP);
  const base = (q) => Math.hypot(q.i, q.j) + Lo.SLOPE * q.slope + F.shore * Lo.REACH * 0.25 * Math.min(1, q.coast / Lo.REACH) * 4 + (enemyDir ? Lo.ENEMY * Math.max(0, (q.i * enemyDir.i + q.j * enemyDir.j) / Math.max(1, Math.hypot(q.i, q.j))) : 0);   // vision: the shore's pull, as plots of cost
  const aff = {
    harbour: (q) => (q.shore ? 0 : q.coast * 3),   // vision: the district's pulls
    civic: (q) => -q.h * 0.5 + (F.heart === "civic" ? 0 : 6),   // vision: the district's pulls
    market: (q) => q.coast * 0.6 + (F.heart === "market" ? -4 : 0),   // vision: the district's pulls
    homes: () => 0,
    crafts: (q) => -2 * ((q.i * down.i + q.j * down.j) / Math.max(1, Math.hypot(q.i, q.j))),
    farms: (q) => -Math.hypot(q.i, q.j) * 0.3 + q.slope * 10,   // vision: the district's pulls
    pasture: (q) => -Math.hypot(q.i, q.j) * 0.4 + q.slope * 4,   // vision: the district's pulls
  };   // vision: each district's pulls, in plots of cost
  // what each district needs, from what stands
  const need = Object.fromEntries(Lo.ORDER.map((k) => [k, 0]));
  plan.forEach((b, k) => { if (!built[k]) return; const d = DISTRICT_OF(b.name); if (d in need) need[d] += PLOTS_OF(b) * (d === "homes" ? 1 + F.spread : 1); });
  if (F.heart === "open" && need.homes) need.civic += Lo.PLOTS.hall;   // an open heart: the ground the homes stand round
  const owner = new Map(), cand = G.plots.filter(buildable);
  for (const d of Lo.ORDER) {
    const held = memory?.[d] ? new Set(memory[d]) : null;   // a ruin's streets: the plots this district held before
    const order = cand.filter((q) => !owner.has(q)).map((q) => [q, base(q) + aff[d](q) - (held?.has(`${q.i},${q.j}`) ? Lo.REUSE : 0)]).sort((a, b) => a[1] - b[1] || a[0].i - b[0].i || a[0].j - b[0].j);
    for (const [q] of order.slice(0, need[d])) owner.set(q, d);
  }
  // the walls: the plots just outside the walled districts (never water), if the guard calls for walls
  const walls = [], gates = [];
  const guard = plan.find((b, k) => built[k] && DISTRICT_OF(b.name) === "guard");
  if (guard) {
    const inside = (q) => q && Lo.WALLED.includes(owner.get(q));
    const ring = new Set();
    for (const q of G.plots) if (inside(q)) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const n = G.at.get(`${q.i + a},${q.j + b}`); if (n && !inside(n) && !n.water && owner.get(n) !== "harbour") ring.add(n); }   // given: the eight neighbours
    walls.push(...ring);
    // gates: where the wall is nearest the harbour's middle and the fields' middle
    for (const d of ["harbour", "farms", "pasture"]) {
      const mine = [...owner.entries()].filter(([, v]) => v === d).map(([q]) => q);
      if (!mine.length || !walls.length) continue;
      const ci = mine.reduce((a, q) => a + q.i, 0) / mine.length, cj = mine.reduce((a, q) => a + q.j, 0) / mine.length;
      gates.push(walls.reduce((b, q) => (Math.hypot(q.i - ci, q.j - cj) < Math.hypot(b.i - ci, b.j - cj) ? q : b)));
    }
  }
  const counts = {}; for (const v of owner.values()) counts[v] = (counts[v] ?? 0) + 1;
  const memoryOut = {}; for (const [q, d] of owner) (memoryOut[d] ??= []).push(`${q.i},${q.j}`);
  return { grid: G, owner, walls, gates: [...new Set(gates)], counts, guard: guard?.name ?? null, form: F, wind: wind.from, memory: memoryOut };
}
/** Plots a town's wall ring covers, as keys (for comparing walls between months). */
export const wallKeys = (L) => new Set(L.walls.map((q) => `${q.i},${q.j}`));
