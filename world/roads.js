// Pure (given a loaded map). The land's veins: the roads between a people's towns, as the sea routes are between
// its ports (world/trade.js). Every road ends at a port or runs to one: the land feeds the sea.
//
//   the ground  the map at its own grain (a chunk a cell), eight ways out of each. A step costs its length times
//               the climb's toll: (1 + (grade phi^3)^2), so a road takes the gentle way round a hill (it
//               switchbacks rather than climbs); past a grade of 1/phi^4 the ground is too steep to walk, unless
//               the people cuts steps (the Therans), hangs a plank road on the cliff (East Asia), or tunnels
//   water       a road crosses water only on a bridge, as far as its people can span; past that the road ends at
//               a ferry, and the sea takes it on. A frozen sea is a road for the Arctic sledges; the shallows a
//               causeway for the shallow-water people
//   tunnels     the tunnelling peoples (the Therans after Eupalinos, East Asia's few) go under a ridge where the
//               way round costs more than phi^2 the way through, five cells at most
//   the network each island's towns as nodes; the least-cost way between every pair (Dijkstra over the ground);
//               the spanning tree of those costs (the fewest roads that join them all); and then the gravity
//               roads: a pair whose people over their cost squared pulls harder than the tree's median, joined too.
//               Every town joins its nearest port. A road's class follows what it joins: an artery between ports
//               and cities, a road between towns, a track to a hamlet
//   the people's way  each people builds its roads its own way (ROAD): the surface, the width by class, the bridge
//               and its span, what marks the way and where travellers rest
import { FIB, PHI } from "../core/golden.js";
import { chunkHeight, map } from "./map.js";
import { islands } from "./islands.js";
import { peoples } from "./peoples.js";
import { populations } from "./boxes.js";
import { climateAt } from "./climate.js";

export const GRADE_MAX = 1 / PHI ** 4;   // derived: the steepest a road walks at the map's grain (15 in a hundred, a chunk's mean: a cart's limit)
export const TUNNEL_MAX = FIB[4];   // derived: five cells under a ridge at most
export const CLASSES = ["artery", "road", "track"];
// vision: each people's road, after the real thing (one choice per people). width: blocks by class; span: the longest
// bridge in blocks (0: none, the road ends at the water); mark: what stands by the way, and every how many blocks;
// rest: where the traveller stops, every how many blocks; steep: how it takes ground past the grade (null: it doesn't)
export const ROAD = {
  norse: { name: "the vegr", surface: "minecraft:grass_path", width: [3, 2, 1], bridge: "timber trestle", span: FIB[5], mark: ["rune stone at each bridge and ford", FIB[9]], rest: ["the farm's guest hall", FIB[10]], wet: "corduroy of split logs over the bogs", steep: null, fun: "cairns on the fells; the thing-mound where roads meet" },   // vision: the people's road (its widths, after the real ways)
  european: { name: "the king's highway", surface: "minecraft:cobblestone", width: [5, 3, 2], bridge: "stone arches, twenty-one a span", span: FIB[9], mark: ["milestones", FIB[9]], rest: ["the coaching inn", FIB[10] + FIB[9]], wet: "a raised causeway", steep: null, fun: "toll gates at the bridges; gibbets at the crossroads; a wayside shrine" },   // vision: the people's road (its widths, after the real ways)
  therans: { name: "the white way", surface: "minecraft:polished_tuff", width: [5, 3, 2], bridge: "stone arches over a white parapet", span: FIB[9], mark: ["gold-capped herm pillars", FIB[8]], rest: ["the cistern and its shade", FIB[9]], wet: "a quay road", steep: "steps cut in the rock", tunnel: true, fun: "the aqueduct beside the artery; Eupalinos's tunnels through the ridges" },   // vision: the people's road (its widths, after the real ways)
  indian_ocean: { name: "the caravan road", surface: "minecraft:smooth_sandstone", width: [4, 3, 1], bridge: "a timber span on stone piers", span: FIB[6], mark: ["wells", FIB[9]], rest: ["the caravanserai, a day's march apart", FIB[10] + FIB[9]], wet: "a coral causeway", steep: null, fun: "date palms at the wells; the customs house where the road meets the dhows" },   // vision: the people's road (its widths, after the real ways)
  east_asian: { name: "the post road", surface: "minecraft:stone_bricks", width: [5, 3, 2], bridge: "stone arches, and the covered wind-and-rain bridge", span: FIB[8], mark: ["post stations", FIB[10]], rest: ["the post station's inn", FIB[10]], wet: "a stone embankment", steep: "plank galleries pinned to the cliff", tunnel: true, fun: "a paifang gate where the road enters a town; willows along the canal roads" },   // vision: the people's road (its widths, after the real ways)
  japanese: { name: "the kaidō", surface: "minecraft:gravel", width: [4, 3, 1], bridge: "the arched wooden taikobashi", span: FIB[7], mark: ["ichirizuka mounds, a pine on each", FIB[9]], rest: ["the post town (shukuba)", FIB[10]], wet: "a raised dike", steep: "stone steps up to the pass", fun: "pine rows both sides of the artery; stone lanterns at the passes; the barrier gate (sekisho)" },   // vision: the people's road (its widths, after the real ways)
  pacific: { name: "the ara", surface: "minecraft:cobblestone", width: [3, 2, 1], bridge: null, span: 0, mark: ["kerbstones lining the way", FIB[7]], rest: ["the marae where the roads meet", FIB[10]], wet: "a stepping-stone ford", steep: null, fun: "the inland ring road round the island; the canoe landing at every road's end" },   // vision: the people's road (its widths, after the real ways)
  dugout: { name: "the grease trail", surface: "minecraft:grass_path", width: [2, 2, 1], bridge: "a felled cedar", span: FIB[5], mark: ["carved posts at the trailheads", FIB[10]], rest: ["the fishing camp", FIB[10]], wet: "plank boardwalks over the muskeg", steep: null, fun: "the trade trail inland for the oolichan grease; the canoe ramp at the beach end" },   // vision: the people's road (its widths, after the real ways)
  birchbark: { name: "the portage", surface: "minecraft:grass_path", width: [2, 1, 1], bridge: null, span: 0, mark: ["blazed trees", FIB[7]], rest: ["the camp at the landing", FIB[9]], wet: "the canoe takes it", steep: null, fun: "roads that run from water to water: every trail ends at a landing; canoe racks at each end" },   // vision: the people's road (its widths, after the real ways)
  shallow: { name: "the causeway", surface: "minecraft:bamboo_planks", width: [3, 2, 1], bridge: "a boardwalk on stilts", span: FIB[7], mark: ["lanterns on poles", FIB[8]], rest: ["the stilt house over the water", FIB[9]], wet: "the boardwalk", steep: null, shallows: true, fun: "boardwalks over the lagoon between the villages; the market raft where they meet" },   // vision: the people's road (its widths, after the real ways)
  arctic: { name: "the sledge trail", surface: "minecraft:snow", width: [3, 2, 1], bridge: null, span: 0, mark: ["inuksuit", FIB[9]], rest: ["a snow house on the trail", FIB[10]], wet: "over the sea ice", steep: null, ice: true, fun: "the trail over the frozen sea from island to island in winter" },   // vision: the people's road (its widths, after the real ways)
};

const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
function heap() { const a = []; return { push(v) { a.push(v); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }, pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }, get size() { return a.length; } }; }

/** A step's cost and what it is: { cost, kind: "land" | "steep" | "tunnel" | "bridge" | "ice" | "causeway" } or null (no way). */
export function stepOf(t, a, b, len, CH) {
  const R = ROAD[t] ?? ROAD.european, ha = a.h, hb = b.h;
  if (hb <= 0) {   // water
    if (R.ice && b.T < -4) return { cost: len * PHI, kind: "ice" };   // given: the sea freezes under four below
    if (R.shallows && hb >= -FIB[3]) return { cost: len * PHI, kind: "causeway" };   // derived: the shallows three deep at most
    return R.span && b.wd * 2 * CH <= Math.max(R.span, CH * FIB[2]) ? { cost: len * FIB[4], kind: "bridge" } : null;   // derived: a bridge's cell costs five; only water its people could span (or a ferry's two cells) from a shore
  }
  const grade = Math.abs(hb - Math.max(0, ha)) / (CH * len);
  if (grade <= GRADE_MAX) return { cost: len * (1 + (grade * PHI ** 3) ** 2), kind: "land" };   // vision: the network's own measure
  if (R.steep) return { cost: len * (1 + (grade * PHI ** 3) ** 2) * PHI, kind: "steep" };   // vision: the network's own measure
  if (R.tunnel) return { cost: len * FIB[4] * PHI, kind: "tunnel" };   // derived: through rock at eight a cell
  return null;
}

/** The least-cost ways from a town over its island (and the water its people can cross). */
function dijkstra(t, src, cells, CH, limit) {
  const D = new Map([[src.k, 0]]), prev = new Map(), kind = new Map(), hp = heap(); hp.push([0, src.k]);
  while (hp.size) {
    const [d, k] = hp.pop(); if (d > (D.get(k) ?? Infinity) || d > limit) continue;
    const a = cells(k); if (!a) continue;
    for (const [dx, dz, len] of N8) {
      const b = cells(null, a.cx + dx, a.cz + dz); if (!b) continue;
      const s = stepOf(t, a, b, len, CH); if (!s) continue;
      const nd = d + s.cost; if (nd < (D.get(b.k) ?? Infinity)) { D.set(b.k, nd); prev.set(b.k, k); kind.set(b.k, s.kind); hp.push([nd, b.k]); }
    }
  }
  return { D, prev, kind };
}

/** The land network: { nodes, roads, ferries, byIsland }. */
export function roads({ maxIsland = Infinity } = {}) {
  const m = map(), W = m.w, H = m.h, isl = islands(), P = peoples().list, pops = populations(), CH = 16;   // given: a chunk's side
  const cache = new Map();
  const cells = (k, cx, cz) => {
    if (k != null) { cz = Math.floor(k / W); cx = k % W; }
    if (cz < 0 || cz >= H) return null; cx = ((cx % W) + W) % W; const key = cz * W + cx;
    let c = cache.get(key); if (!c) { const h = chunkHeight(cx, cz); c = { k: key, cx, cz, h, T: h <= 0 ? climateAt(cx, cz).T : 0, wd: isl.dist[key] ?? Infinity }; cache.set(key, c); } return c;
  };
  // the nodes: every people's town, its size and whether it's a port (the sea in reach)
  const nodes = P.map((p) => { const v = pops.get(p.key), cx0 = ((Math.round(p.cx) % W) + W) % W, cz0 = Math.round(p.cz), k = cz0 * W + cx0; const coast = N8.some(([dx, dz]) => chunkHeight(cx0 + dx * FIB[2], cz0 + dz * FIB[2]) <= 0); return { key: p.key, t: p.tradition, cx: cx0, cz: cz0, k, pop: v?.pop ?? 0, tier: v?.tier ?? "village", island: p.island ?? (isl.label[k] >= 0 ? isl.label[k] : isl.near[k]), port: coast }; });   // derived: a port: the sea two cells off
  const byIsland = new Map(); for (const n of nodes) { if (n.island < 0) continue; (byIsland.get(n.island) ?? byIsland.set(n.island, []).get(n.island)).push(n); }
  const out = [], ferries = [];
  for (const [id, ns] of byIsland) {
    if (ns.length < 2 || ns.length > maxIsland) continue;
    const size = Math.max(...ns.map((a) => Math.max(...ns.map((b) => Math.hypot(a.cx - b.cx, a.cz - b.cz)))));
    const runs = ns.map((n) => dijkstra(n.t, { k: n.k }, cells, CH, size * FIB[5]));   // derived: no road costs more than eight times the island's span
    // the spanning tree (Kruskal on the costs), then the gravity roads, then every town to its nearest port
    const pairs = []; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const c = runs[i].D.get(ns[j].k); if (isFinite(c)) pairs.push({ i, j, c }); }
    pairs.sort((a, b) => a.c - b.c);
    const up = ns.map((_, i) => i), find = (i) => (up[i] === i ? i : (up[i] = find(up[i]))), edges = new Set(), take = (e, why) => { const k = `${e.i},${e.j}`; if (!edges.has(k)) { edges.add(k); e.why = why; return true; } return false; }, chosen = [];
    for (const e of pairs) { const a = find(e.i), b = find(e.j); if (a !== b) { up[a] = b; if (take(e, "tree")) chosen.push(e); } }
    const g = (e) => (ns[e.i].pop * ns[e.j].pop) / (e.c * e.c), med = chosen.length ? chosen.map(g).sort((a, b) => a - b)[Math.floor(chosen.length / 2)] : Infinity;
    for (const e of pairs) if (g(e) > med * PHI && take(e, "gravity")) chosen.push(e);   // derived: pulling past phi times the tree's median
    const ports = ns.map((n, i) => (n.port ? i : -1)).filter((i) => i >= 0);
    for (let i = 0; i < ns.length; i++) { if (ns[i].port || !ports.length) continue; const best = ports.map((j) => ({ i: Math.min(i, j), j: Math.max(i, j), c: runs[i].D.get(ns[j].k) })).filter((e) => isFinite(e.c)).sort((a, b) => a.c - b.c)[0]; if (best && take(best, "port")) chosen.push(best); }
    // each road's way, its bridges and tunnels, its class and its people
    for (const e of chosen) {
      const a = ns[e.i], b = ns[e.j], run = runs[e.i], path = [], kinds = {}; let k = b.k;
      while (k !== undefined && k !== a.k) { path.push(k); const kd = run.kind.get(k); kinds[kd] = (kinds[kd] ?? 0) + 1; k = run.prev.get(k); } path.push(a.k); path.reverse();
      const big = (n) => n.port || /city|hub/.test(n.tier), cls = big(a) && big(b) ? "artery" : a.tier === "camp" || b.tier === "camp" || a.tier === "hamlet" || b.tier === "hamlet" ? "track" : "road";
      const t = a.t, R = ROAD[t] ?? ROAD.european;   // the road is its first town's people's (the way was found by their means)
      // a bridge longer than its people spans: the road stops at the water, a ferry crosses
      let wet = 0, longest = 0; for (const q of path) { const c = cells(q); if (c.h <= 0 && run.kind.get(q) === "bridge") { wet++; longest = Math.max(longest, wet); } else wet = 0; }
      const bridgeBlocks = longest * CH;
      if (bridgeBlocks > (R.span || 0) && longest > 0) { ferries.push({ a: a.key, b: b.key, t, island: id, gap: bridgeBlocks }); }
      out.push({ a: a.key, b: b.key, t, island: id, cls, why: e.why, cost: +e.c.toFixed(1), cells: path.length, path, kinds, bridge: longest ? bridgeBlocks : 0, ferry: bridgeBlocks > (R.span || 0) && longest > 0, width: R.width[CLASSES.indexOf(cls)] });
    }
  }
  return { nodes, roads: out, ferries, byIsland };
}
