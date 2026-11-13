// Pure (given a loaded map). Settlements as chemistry: a periodic table of what a town is made of,
// the stoichiometry of a population's needs, the stable compound those needs form on the ground,
// and the reactions by which it grows and shrinks.
//
//   the table   PERIODS are scales, each built of the one before: fixtures, rooms (rooms.js),
//               buildings (dwelling.js), quarters, the settlement. GROUPS are what a thing is for:
//               rest, fire, work, store, water, passage, gathering. An element's VALENCE is the
//               bonds it must make: a house bonds to a lane and to its quarter's well; a well to the
//               lane and to every house in reach; a dock to the shore and the main street
//   stoichiometry  a population gives its needs exactly: a bed each (vanilla's rule), households
//               of the culture's size, a house each, a quarter for every QUARTER households with its
//               well and its bell, a dock for every three boats, boathouses, granaries, a market,
//               a hall. Nothing else is placed
//   the compound   the needs placed on the site's plots in synthesis order, each where its energy is
//               least: the distance its lane must run to the roads already there (the pathway: towns
//               grow along their roads), the footing its slope asks for, its pull to the waterline
//               (fishers to the shore, the shallow-water people onto it), its reach to its quarter's
//               well, and how far the neighbourhood is from the culture's density. Each new house runs
//               a lane to the nearest road, and that lane is a road for every house after it
//   footings    each house's footprint read against the ground: within a block, cut and fill; more,
//               the culture's way: piles where it raises (and over water), a terrace on a retaining
//               wall where it builds in stone, post footings where in timber, and for the Therans the
//               cliff cut into; past STEEP the plot isn't built (it's a garden)
//   roads       the main street (the site to the shore and inland) three wide, lanes as the culture
//               walks (one in dense quarters, two where carts go: farmers and traders); surfaced by
//               the culture and the town's tier; a lane steeper than 1 in phi^2 runs as steps
//   reactions   the compound for a population is a prefix of the compound for any larger one (each
//               step depends only on the steps before), so growth is synthesis (the next house, the
//               next quarter's well), decline is decomposition in exactly the reverse order (the last
//               house to rise is the first to fall, a ruin), and when the site runs out of ground the
//               reaction turns to densification: houses already standing take a storey
import { PHI, FIB, golden, word, GOLDEN_ANGLE } from "../core/golden.js";
import { plotsAt, LAYOUT, FORM as LAYOUT_FORM } from "./settlement.js";
import { houseOf, FORM, needsOf, ROUNDNESS } from "./dwelling.js";
import { JOBS } from "./jobs.js";

// the periodic table: [period][group]
export const GROUPS = ["rest", "fire", "work", "store", "water", "passage", "gathering"];
export const PERIODIC = [
  { period: 1, scale: "fixture", elements: { rest: "bed", fire: "hearth", work: "workstation", store: "chest", water: "cauldron", passage: "door", gathering: "bell" } },
  { period: 2, scale: "room", elements: { rest: "sleep", fire: "hearth room", work: "work room", store: "store room", water: "well (light)", passage: "entry", gathering: "court" } },
  { period: 3, scale: "building", elements: { rest: "house", fire: "oven", work: "workshop", store: "granary", water: "well, dock, the shrine at the waterline (the sacred sea)", passage: "lane", gathering: "square" } },   // vision: the table's and the compound's own numbers (households, plots), stated where they are
  { period: 4, scale: "quarter", elements: { rest: "houses", fire: "the quarter's oven", work: "yards", store: "warehouse", water: "the quarter's well and shrine", passage: "street", gathering: "the quarter's bell, the district's temple" } },   // vision: the table's and the compound's own numbers (households, plots), stated where they are
  { period: 5, scale: "settlement", elements: { rest: "homes district", fire: "market", work: "crafts district", store: "harbour stores", water: "harbour", passage: "main street", gathering: "civic heart" } },   // vision: the periodic table's own rows
  { period: 6, scale: "the world", elements: { rest: "the peoples", fire: "the solar rite", work: "the Koinon", store: "the Exchange", water: "the Sea Rite Temple", passage: "the sea lanes", gathering: "the Great Rite at Thera" } },   // vision: the table's and the compound's own numbers (households, plots), stated where they are
];
// vision: each house law's household (folk under one roof), from how they lived
export const HOUSEHOLD = { longhall: 8, twocell: 5, round: 5, platform: 6, court: 6, module: 5, compound: 8, stilt: 4, dome: 4, akrotiri: 6 };   // vision: the table's and the compound's own numbers (households, plots), stated where they are
export const CHEM = Object.freeze({
  QUARTER: FIB[6],            // derived: thirteen households a quarter (a Fibonacci number)
  WELL_REACH: FIB[5],         // derived: plots from a house to its well, at most eight (32 blocks)
  BERTHS: FIB[3],             // derived: berths a dock
  GRADE: 1 / PHI ** 2,        // derived: the steepest a lane runs before it's steps
  LEVEL: 1,                   // given: a block of difference is cut and filled
  STEEP: LAYOUT.STEEP * LAYOUT.PLOT,   // derived: blocks of rise across a plot past which it's a garden
  ENERGY: { LANE: 1, SLOPE: LAYOUT.SLOPE, SHORE: 4, WELL: 2, DENSITY: 3, ROUND: 1.5 },   // vision: the weights of the compound's energy, in plots of lane
  REPEAT: FIB[3],             // derived: houses alike in a row before the next must differ (three)
});

/** The needs of a population of `pop` of a people: the stoichiometry. Every count is a function of the households so far, so a smaller town's needs are a prefix of a larger one's. */
export function needsOfTown(p, pop, soc = null) {
  const law = FORM[p.tradition]?.form ?? "twocell", hh = HOUSEHOLD[law], households = Math.ceil(pop / hh);
  const trades = soc ? Object.entries(soc.professions).filter(([j]) => JOBS[j]?.at) : [[p.living === "farmers" ? "farmer" : p.living === "herders" ? "shepherd" : "fisherman", 1]];
  const total = trades.reduce((a, [, n]) => a + n, 0) || 1;
  const jobOf = (h) => { let u = golden(h + 1) * total; for (const [j, n] of trades) { if (u < n) return j; u -= n; } return trades[0][0]; };   // each household's trade by the golden sequence over the trades' shares: the same household always the same trade
  const at = (h) => { const folk = (h + 1) * hh; return { quarters: Math.ceil((h + 1) / CHEM.QUARTER), docks: p.living === "fishers" || p.temper === "traders" ? Math.ceil(Math.ceil(folk / FIB[6]) / CHEM.BERTHS) : 0, granaries: p.living === "farmers" ? Math.ceil((h + 1) / FIB[5]) : 0, market: p.temper === "traders" || h + 1 >= FIB[6] ? 1 : 0 }; };   // vision: a boat for every thirteen folk; derived: a granary for every eight farming households, a market once there's a quarter
  const end = at(households - 1);
  return { law, pop, household: hh, households, beds: households * hh, folk: pop, ...end, wells: end.quarters, bells: end.quarters, hall: 1, at, jobOf };
}
/** A footing for a house's footprint: { kind, level, rise, fill, cut } from the ground under it and the culture. */
export function footing(p, heights, water = false) {
  const lo = Math.min(...heights), hi = Math.max(...heights), rise = hi - lo, law = FORM[p.tradition]?.form, f = p.build.frame.kind;
  if (water) return { kind: "piles", level: Math.max(hi, 0) + FIB[3], rise, note: "on piles over the water" };   // derived: three above the sea
  if (rise <= CHEM.LEVEL) return { kind: "level", level: Math.round((lo + hi) / 2), rise, note: "cut and filled" };
  if (rise > CHEM.STEEP) return { kind: "garden", level: null, rise, note: "too steep: a garden" };
  if (p.build.raised || law === "stilt" || law === "platform" || law === "module") return { kind: "piles", level: hi + 1, rise, note: "on piles, the floor level with the top" };
  if (law === "akrotiri") return { kind: "cut", level: lo + Math.ceil(rise / 2), rise, note: "cut into the slope, the uphill wall the rock" };
  if (f === "stone" || f === "mud brick") return { kind: "terrace", level: hi, rise, note: `a terrace on a retaining wall ${rise} high` };
  return { kind: "posts", level: hi, rise, note: `post footings, ${rise} high downhill, on a stone sill` };
}
/** How a culture surfaces its roads, by tier. */
export function surfaceOf(p, tier, water = false, steps = false) {
  if (water) return `minecraft:${p.build.frame.post.replace(/^minecraft:(stripped_)?/, "").replace(/_log$/, "")}_planks`;
  if (steps) return p.build.frame.kind === "stone" ? "minecraft:stone_stairs" : "minecraft:dirt_path";
  if (tier === "town" && p.build.frame.kind === "stone") return "minecraft:stone_bricks";
  if (tier === "town" || tier === "village") return p.stones.includes("minecraft:gravel") ? "minecraft:gravel" : "minecraft:cobblestone";
  return "minecraft:dirt_path";
}

/**
 * The compound: the town for `pop` on the site, in synthesis order. Returns { needs, steps (the
 * synthesis, in order), houses, roads (plot -> { width, surface, steps }), wells, footings, density }.
 */
/** A house's footprint in plots (its voxels' extent, a plot four blocks). */
export function footprintOf(h) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const k of h.vox.keys()) { const [x, , z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0, z0, w: x1 - x0 + 1, l: z1 - z0 + 1, pw: Math.ceil((x1 - x0 + 1) / LAYOUT.PLOT), pl: Math.ceil((z1 - z0 + 1) / LAYOUT.PLOT) }; }
export function compound(p, site, pop, { soc = null, tier = "village", pathways = [] } = {}) {
  const N = needsOfTown(p, pop, soc), G = plotsAt(site), E = CHEM.ENERGY, Lf = LAYOUT_FORM[p.tradition] ?? LAYOUT_FORM.european, P = LAYOUT.PLOT;
  const onWater = !!Lf.water, key = (q) => `${q.i},${q.j}`, taken = new Map(), roads = new Map(), steps = [];
  const buildable = (q) => q && !taken.has(key(q)) && !roads.has(key(q)) && (q.water ? onWater : true);
  const fishers = p.living === "fishers";
  // 0. the pathways already there: the main street, from the site to the waterline and inland along the gentlest ground
  const lane = (from, isGoal, width) => {   // cheapest path over the plots (Dijkstra), steps where steep; returns the plots
    const dist = new Map([[key(from), 0]]), prev = new Map(), open = [[0, from]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]); const [d, q] = open.shift(); if (d > dist.get(key(q))) continue;
      if (isGoal(q) && q !== from) { const path = [q]; let k = key(q); while (prev.has(k)) { const r = prev.get(k); path.push(r); k = key(r); } return path.reverse(); }
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = G.at.get(`${q.i + a},${q.j + b}`); if (!n || taken.has(key(n)) || (n.water && !onWater)) continue;
        const grade = Math.abs(n.h - q.h) / P, c = 1 + (grade > CHEM.GRADE ? PHI ** 2 : 0) + (n.water ? 1 : 0);   // steps cost phi^2 more; water a boardwalk
        if (d + c < (dist.get(key(n)) ?? Infinity)) { dist.set(key(n), d + c); prev.set(key(n), q); open.push([d + c, n]); }
      }
      if (open.length > 4000) break;   // vision: a bound on the search
    }
    return null;
  };
  const pave = (path, width, kind) => { for (let i = 0; i < path.length; i++) { const q = path[i], n = path[i + 1] ?? path[i - 1], grade = n ? Math.abs(n.h - q.h) / P : 0; if (!roads.has(key(q))) roads.set(key(q), { q, width, kind, steps: grade > CHEM.GRADE, surface: surfaceOf(p, tier, q.water, grade > CHEM.GRADE) }); } };
  const origin = G.at.get("0,0");
  for (const k of pathways) { const q = G.at.get(k); if (q) roads.set(k, { q, width: 2, kind: "old road", steps: false, surface: surfaceOf(p, tier) }); }   // the roads already there (an older town's streets) are the first pathways
  const proto = houseFor(p, { n: N.household, job: N.jobOf(0) }), FP = footprintOf(proto), yard = Lf.spread;   // every household's house the same law: its footprint in plots, and the culture's yard round it
  const shore = lane(origin, (q) => q.shore, 3); if (shore) { pave(shore, 3, "main street"); steps.push({ what: "main street", to: "the waterline", plots: shore.length }); }   // derived: three wide
  const inland = lane(origin, (q) => Math.hypot(q.i, q.j) >= FIB[5] && !q.shore && q.slope < CHEM.GRADE, 3); if (inland) { pave(inland, 3, "main street"); steps.push({ what: "main street", to: "inland", plots: inland.length }); }   // derived: three wide, eight plots out
  if (!roads.size) pave([origin], 3, "square");   // vision: the table's and the compound's own numbers (households, plots), stated where they are
  // energy of a plot for a house: the pathway (lane to the roads), footing, waterline, well, density
  const wells = [], houses = [], density = 1 / (1 + Lf.spread);   // houses a plot round a house the culture wants
  const nearRoad = (q) => { let best = Infinity; for (const r of roads.values()) { const d = Math.abs(r.q.i - q.i) + Math.abs(r.q.j - q.j); if (d < best) { best = d; if (d <= 1) break; } } return best; };
  const round = ROUNDNESS[p.tradition] ?? 0, ring = Math.sqrt((FP.pw + yard) * (FP.pl + yard) / Math.PI) * 1.2;   // vision: the spiral's spacing, a little more than the houses need
  const target = (h) => ({ i: ring * Math.sqrt(h + 1) * Math.cos(h * GOLDEN_ANGLE), j: ring * Math.sqrt(h + 1) * Math.sin(h * GOLDEN_ANGLE) });   // derived: the sunflower: r ~ sqrt(n), theta n golden angles
  let hNow = 0;
  const energy = (q, foot) => {
    let local = 0; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (taken.get(`${q.i + a},${q.j + b}`)?.kind === "house") local++; local /= 25;   // given: a five-by-five neighbourhood
    const well = wells.length ? Math.min(...wells.map((w) => Math.hypot(w.i - q.i, w.j - q.j))) : 0;
    const tg = target(hNow), rnd = E.ROUND * round * Math.hypot(q.i - tg.i, q.j - tg.j);
    return rnd + E.LANE * (nearRoad(q) - 1) * (1 - round / 2) + E.SLOPE * foot.rise / P + E.SHORE * (fishers ? Math.min(q.coast, FIB[5]) / FIB[5] : 0) + E.WELL * Math.max(0, well - CHEM.WELL_REACH) + E.DENSITY * Math.abs(local - density) * 5 + 0.01 * Math.hypot(q.i, q.j);   // vision: a tie broken toward the centre
  };
  // 1. synthesis: the hall, the market, a well and bell for each quarter as it starts, the docks, the houses
  const place = (what, extra = {}) => {
    let best = null;
    const [fw, fl] = what === "house" ? [FP.pw + (yard ? 1 : 0) + (extra.vary?.longer || extra.vary?.porch ? 1 : 0), FP.pl + (yard ? 1 : 0) + (extra.vary?.porch ? 1 : 0)] : what === "hall" || what === "market" ? [FIB[3], FIB[3]] : [1, 1];   // a house's plots and a yard plot if the culture spreads; derived: a hall or market three plots square   // vision: the table's and the compound's own numbers (households, plots), stated where they are
    for (const q of G.plots) {
      if ((q.water && what !== "house" && what !== "dock") || (what === "dock" && !q.shore)) continue;
      const cells = []; let ok = true; for (let a = 0; a < fw && ok; a++) for (let b = 0; b < fl && ok; b++) { const r = G.at.get(`${q.i + a},${q.j + b}`); if (!buildable(r)) ok = false; else cells.push(r); }
      if (!ok) continue;
      const hs = cells.map((r) => Math.round(r.h)), foot = footing(p, hs, cells.some((r) => r.water)); if (foot.kind === "garden") continue;
      const e = what === "dock" ? Math.hypot(q.i, q.j) : what === "well" ? Math.hypot(q.i - extra.at.i, q.j - extra.at.j) + nearRoad(q) : energy(q, foot);
      if (!best || e < best.e) best = { q, e, foot };
    }
    if (!best) return null;
    for (let a = 0; a < fw; a++) for (let b = 0; b < fl; b++) taken.set(`${best.q.i + a},${best.q.j + b}`, { kind: what, q: best.q, part: a || b, ...extra });
    const path = nearRoad(best.q) > 1 ? lane(best.q, (r) => roads.has(key(r)) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => roads.has(`${r.i + a},${r.j + b}`)), 1) : null;   // its lane to the roads: the pathway the next house follows
    if (path) pave(path.slice(1), N.law === "court" || p.living === "farmers" || p.temper === "traders" ? 2 : 1, "lane");   // derived: lanes one wide, two where carts go
    return best;
  };
  const hall = place("hall"); if (hall) steps.push({ what: "hall", at: key(hall.q) });
  let densified = 0; const done = { quarters: 0, docks: 0, granaries: 0, market: 0 };
  for (let h = 0; h < N.households; h++) {   // one stream, household by household: whatever the town now needs, then the house
    const need = N.at(h);
    while (done.quarters < need.quarters) { const ref = houses.at(-1)?.q ?? origin, w = place("well", { at: ref }); done.quarters++; if (w) { wells.push(w.q); steps.push({ what: "well and bell", quarter: done.quarters, at: key(w.q) }); } }
    while (done.market < need.market) { const mk = place("market"); done.market++; if (mk) steps.push({ what: "market", at: key(mk.q) }); }
    while (done.docks < need.docks) { const dk = place("dock"); done.docks++; if (dk) steps.push({ what: "dock", at: key(dk.q) }); }
    while (done.granaries < need.granaries) { const gr = place("granary"); done.granaries++; if (gr) steps.push({ what: "granary", at: key(gr.q) }); }
    hNow = h;
    const n = N.household, job = N.jobOf(h);
    // repetition breaks the bond: after REPEAT houses alike, the next takes a substitution, read off the word
    const alike = houses.slice(-CHEM.REPEAT).filter((o) => o.job === job && !Object.keys(o.vary).length).length;
    const SUBS = ["mirror", "porch", "store", "longer", "palette"], vary = {};
    if (alike >= CHEM.REPEAT) { const k = Math.floor(golden(h) * SUBS.length); vary[SUBS[k]] = true; if (word(h)) vary[SUBS[(k + 2) % SUBS.length]] = true; if (vary.palette) vary.palette = 1 + (h % 2); }   // derived: a second substitution where the word says L
    const b = place("house", { n, job, vary });
    if (!b) {   // the site is full: the reaction turns to densification, the oldest house takes a storey
      const old = houses[densified % Math.max(1, houses.length)]; if (!old) break; old.dense = true; old.n += n; densified++; steps.push({ what: "storey", on: key(old.q), n }); continue;
    }
    houses.push({ q: b.q, n, job, foot: b.foot, e: b.e, vary }); steps.push({ what: "house", at: key(b.q), n, job, footing: b.foot.kind, ...(Object.keys(vary).length ? { vary: Object.keys(vary).join("+") } : {}) });
  }
  return { needs: N, steps, houses, roads, wells, taken, grid: G, densified, footprint: FP, proto };
}
/** The reaction from one population to another: what is synthesised (or decomposed), in order. */
export function reaction(p, site, from, to, opts = {}) {
  const a = compound(p, site, Math.min(from, to), opts).steps, b = compound(p, site, Math.max(from, to), opts).steps;
  const same = a.every((s, i) => JSON.stringify(s) === JSON.stringify(b[i]));
  const diff = b.slice(a.length);
  return { prefix: same, steps: from <= to ? diff : diff.slice().reverse().map((s) => ({ ...s, undone: true })) };
}
/** Builds the house of a compound's step (its voxels), with its culture and household. */
export function houseFor(p, h, k = 0) { return houseOf(p, { n: Math.min(h.n, FIB[5]), job: h.job, k, dense: !!h.dense, vary: h.vary ?? {} }); }   // vision: a house holds eight at most; more is a storey (dense)
export { needsOf };
