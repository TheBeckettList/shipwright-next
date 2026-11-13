// Pure (given a loaded map). The peoples: who lives where, what they have, what they do, how they
// build, all derived, in this order, with nothing assigned by hand:
//
//   1. where     every island big enough (VISION.SETTLE) holds a people; a big one holds one about every
//                REGION chunks across, seeded low and golden-jittered, its ground grown out by what the
//                walk costs (climbs, fords, the shore), so borders run on ridges and rivers (territories)
//   2. what      the vanilla resources of their chunks' biomes (biomes.js): crops, herds, fish from
//                their shelf waters, woods, stones, ores by how high their rock rises
//   3. living    their food by kind gives their livelihood: fishers, farmers, herders (and timber
//                and stone for building, iron for arms)
//   4. temper    raiders where land is poor, boat timber and iron are to hand, and richer peoples lie
//                within a few hops; traders where there's surplus of many goods and a fair trade wind;
//                wary and peaceful between. Scarcity, arms and opportunity: not a label someone chose
//   5. tradition the seafaring tradition whose home climate and woods theirs most resembles (the ten of
//                the old mod: they appear where their world would be)
//   6. building  materials from what they have, form from their climate and life (architecture.js)
//   7. the day   what they're doing at any tick: the sky's hour, the tide on their coast, the wind
//                toward their neighbours (dayOf)
import { VISION, GIVEN, D } from "../core/given.js";
import { PHI, FIB, golden } from "../core/golden.js";
import { mod } from "../core/fixed.js";
import { gnoise } from "../core/noise.js";
import { latOf, lonOf } from "../core/globe.js";
import { windAt } from "../core/wind.js";
import { tideAt } from "../core/sea.js";
import { islands } from "./islands.js";
import { climateAt } from "./climate.js";
import { heightOf, chunkHeight } from "./map.js";
import { drainage, RIVER } from "./rivers.js";
import { ORES } from "./biomes.js";
import { architecture } from "./architecture.js";
import { TRADITIONS } from "./traditions.js";
import { THERA } from "./thera.js";

const C = D.PX, RAD = Math.PI / 180;   // given
const inc = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const top = (m, n = 1) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

// The ground a people holds. A square grid of claims draws borders no land ever had, so neither seeds nor borders keep
// one. The seeds: a row of REGION cells round the world (as many as fit whole, so the wrap has no seam), each row shifted
// east by the golden sequence (rows never line up into columns), and in each cell the aim jittered by it again, a part
// of the cell either way; the seed is the island's shore in that cell (land with sea or a lake beside it: these are
// seafaring peoples, and a people walled off from the water would have no landing) cheapest to reach from the aim,
// counting the climb from the sea as the walk does (a people settles low), if the island holds a settler's share of
// land there. The borders: every seed's ground grows out at once, cheapest first (one priority flood, a
// Dijkstra from all seeds), over its island's land and the waters it fishes. A step on land costs its length, more for
// the height climbed or dropped (Naismith's rule, scaled to the map's low mean heights), more to ford a river, and more
// or less by the ground's own grain; afloat, just its length. So a ridge or a river, dear to cross from either side, is
// where two peoples' walks meet: the border. A seed whose ground comes out under a settler's share is dropped and the
// rest grown again, so every people keeps at least SETTLE chunks of land.
export const TERRITORY = Object.freeze({
  JITTER: 1 / PHI ** 3,         // vision: the aim kept a golden cube in from its cell's sides (neighbouring cells' aims never crowd)
  NAISMITH: 5000 / 600,         // given: Naismith's rule, an hour for 5 km on the flat and another for every 600 m climbed
  RELIEF: FIB[8],               // vision: the map holds the ground's mean, and the game's hills (map.js RELIEF) rise and fall over it many times a cell: a block of the mean's rise walks like 34 of them
  FORD: FIB[7],                 // vision: a river (a flow of RIVER.RIVER or more) is crossed only at a ford: 21 cells' walk round to one, going in and again coming out (walking along it costs nothing more)
  GRAIN: [FIB[7], 1],           // vision: the ground's grain (wood, marsh, scree the map doesn't hold) 21 cells across, making a step up to phi dearer or cheaper
  WATERS: 2,                    // vision: a people fishes its waters out to two chunks
});
const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];   // given: the eight neighbours and their lengths
/** The peoples' grounds: { groups: [{ key, island, land, sea }], owner (a cell's group, or -1) }. */
function territories(I, theran) {
  const W = I.W, H = I.H, N = W * H, R = VISION.REGION, cols = Math.round(W / R), cw = W / cols, rows = Math.ceil(H / R);   // derived: whole cells round the world
  const islandOf = (k) => (I.label[k] >= 0 ? I.label[k] : I.dist[k] <= TERRITORY.WATERS ? I.near[k] : -1);
  const settled = (isl) => isl >= 0 && !theran(isl) && I.info[isl].area >= VISION.SETTLE;
  // the seeds: each (island, cell) holding a settler's share of land, its seed the shore (sea or lake beside it) cheapest from the jittered aim
  const shift = (j) => golden(j) * cw, cellOf = (x, z) => { const j = Math.floor(z / R); return [Math.floor(mod(x - shift(j), W) / cw) % cols, j]; };
  const span = 1 - 2 * TERRITORY.JITTER, aimOf = (i, j) => [shift(j) + (i + TERRITORY.JITTER + span * golden(j * cols + i)) * cw, (j + TERRITORY.JITTER + span * golden(i * rows + j)) * R];
  const climb = TERRITORY.NAISMITH * TERRITORY.RELIEF / D.PX;   // derived: a block of the map's rise, in cells of walking
  const cand = new Map();
  for (let k = 0; k < N; k++) {
    const isl = I.label[k]; if (isl < 0 || !settled(isl)) continue;
    const x = k % W, z = (k / W) | 0, [i, j] = cellOf(x, z), key = `${isl}:${i},${j}`, [ax, az] = aimOf(i, j);
    let dx = Math.abs(x + 0.5 - mod(ax, W)); dx = Math.min(dx, W - dx);
    const d = Math.hypot(dx, z + 0.5 - az) + climb * Math.max(0, chunkHeight(x, z));   // the walk to the aim and the climb from the sea: a people settles low
    const shore = STEPS.slice(0, 4).some(([a, b]) => z + b >= 0 && z + b < H && I.label[(z + b) * W + mod(x + a, W)] < 0);   // given: the four faces, as the coast is counted below
    let c = cand.get(key); if (!c) cand.set(key, (c = { key, island: isl, n: 0, seed: -1, d: Infinity }));
    c.n++; if (shore && d < c.d) { c.seed = k; c.d = d; }
  }
  let seeds = [...cand.values()].filter((c) => c.n >= VISION.SETTLE && c.seed >= 0);
  // the walk's cost, cell to cell
  const R0 = drainage(), river = (k) => R0.Q[k] >= RIVER.RIVER, h = (k) => Math.max(0, chunkHeight(k % W, (k / W) | 0));
  const grain = new Float32Array(N), Hc = new Float32Array(N), Rv = new Uint8Array(N), home = new Int32Array(N).fill(-1);
  for (let k = 0; k < N; k++) { const isl = islandOf(k); if (!settled(isl)) continue; home[k] = isl; if (I.label[k] < 0) continue; const x = k % W, z = (k / W) | 0; Hc[k] = h(k); Rv[k] = river(k) ? 1 : 0; grain[k] = PHI ** (TERRITORY.GRAIN[1] * gnoise(x / TERRITORY.GRAIN[0], z / TERRITORY.GRAIN[0], 601)); }   // vision: the grain's key
  const cost = (a, b, len) => {
    if (I.label[b] < 0) return len;   // afloat: no climb, no grain (a cheaper sea let shore peoples ring their inland neighbours)
    if (I.label[a] < 0) return len * grain[b];
    return len * grain[b] + climb * Math.abs(Hc[b] - Hc[a]) + (Rv[a] !== Rv[b] ? TERRITORY.FORD : 0);
  };
  const owner = new Int32Array(N);
  for (;;) {
    owner.fill(-1);
    const best = new Float64Array(N).fill(Infinity), heap = new Heap();
    seeds.forEach((s, i) => { best[s.seed] = 0; owner[s.seed] = i; heap.push(0, s.seed); });
    while (heap.size) {
      const [v, a] = heap.pop(); if (v > best[a]) continue;
      const x = a % W, z = (a / W) | 0;
      for (const [dx, dz, len] of STEPS) {
        const zz = z + dz; if (zz < 0 || zz >= H) continue;
        const b = zz * W + mod(x + dx, W); if (home[b] !== home[a]) continue;
        const nv = v + cost(a, b, len);
        if (nv < best[b] || (nv === best[b] && owner[a] < owner[b])) { best[b] = nv; owner[b] = owner[a]; heap.push(nv, b); }   // a tie to the first seed, so the flood is the same whatever order it runs
      }
    }
    const land = new Int32Array(seeds.length); for (let k = 0; k < N; k++) if (owner[k] >= 0 && I.label[k] >= 0) land[owner[k]]++;
    const kept = seeds.filter((_, i) => land[i] >= VISION.SETTLE);
    if (kept.length === seeds.length) break;
    seeds = kept;
  }
  const groups = seeds.map((s) => ({ key: s.key, island: s.island, seed: s.seed, land: [], sea: [] }));
  for (let k = 0; k < N; k++) if (owner[k] >= 0) (I.label[k] >= 0 ? groups[owner[k]].land : groups[owner[k]].sea).push(k);
  return { groups, owner };
}
/** A binary heap of (cost, cell), cheapest first. */
class Heap {
  constructor() { this.v = []; this.k = []; }
  get size() { return this.v.length; }
  push(v, k) { const V = this.v, K = this.k; let i = V.length; V.push(v); K.push(k); while (i > 0) { const p = (i - 1) >> 1; if (V[p] < V[i] || (V[p] === V[i] && K[p] <= K[i])) break; [V[p], V[i]] = [V[i], V[p]]; [K[p], K[i]] = [K[i], K[p]]; i = p; } }
  pop() { const V = this.v, K = this.k, out = [V[0], K[0]], lv = V.pop(), lk = K.pop(); if (V.length) { V[0] = lv; K[0] = lk; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let s = i; if (a < V.length && (V[a] < V[s] || (V[a] === V[s] && K[a] < K[s]))) s = a; if (b < V.length && (V[b] < V[s] || (V[b] === V[s] && K[b] < K[s]))) s = b; if (s === i) break; [V[s], V[i]] = [V[i], V[s]]; [K[s], K[i]] = [K[i], K[s]]; i = s; } } return out; }
}

let cache = null;
export function peoples() {
  if (cache) return cache;
  const I = islands(), W = I.W;
  const seatK = THERA.seat.cz * W + THERA.seat.cx, seatIsl = I.label[seatK] >= 0 ? I.label[seatK] : I.near[seatK], islet = seatIsl >= 0 ? I.info[seatIsl].area : 0;
  const theran = (i) => { let dx = Math.abs(I.info[i].cx - THERA.seat.cx); dx = Math.min(dx, W - dx); return I.info[i].area <= islet && Math.max(dx, Math.abs(I.info[i].cz - THERA.seat.cz)) <= THERA.REACH; };   // derived: Thera and its islets (no bigger than Thera) are the Atlanteans': no generated people; a continent whose middle falls in Thera's reach keeps its peoples
  // 1. where: seeds on the island, then each seed's ground grown out from it by what the walk costs
  const T = territories(I, theran);
  const list = [];
  for (const g of T.groups) {
    // 2. what
    const biomes = new Map(), woods = new Map(), stones = new Map(), crops = new Set(), herds = new Set(), wild = new Set(), sea = new Set();
    let crop = 0, herd = 0, fish = 0, sx = 0, sz = 0, T = 0, M = 0, x0 = g.land[0] % W;
    for (const k of g.land) {
      const cx = k % W, cz = (k / W) | 0, c = climateAt(cx, cz), b = c.biome;
      inc(biomes, b.id); b.wood.forEach((w) => inc(woods, w)); b.stone.forEach((s) => inc(stones, s));
      b.crops.forEach((x) => crops.add(x)); b.herd.forEach((x) => herds.add(x)); b.wild.forEach((x) => wild.add(x));
      crop += b.yield.crop; herd += b.yield.herd; T += c.T; M += c.M;
      let dx = cx - x0; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; sx += dx; sz += cz;
    }
    for (const k of g.sea) {
      const c = climateAt(k % W, (k / W) | 0), d = -c.h;
      if (d > VISION.SHELF_DEPTH) continue;
      fish += c.biome.fish * (1 - d / VISION.SHELF_DEPTH);
      c.biome.sea.forEach((x) => sea.add(x));
    }
    const n = g.land.length, rockTop = heightOf(I.info[g.island].top);
    const ores = ORES.filter((o) => rockTop >= o.above).map((o) => o.id);
    const cx = (x0 + sx / n + W) % W, cz = sz / n;
    // its coast: the land chunks with sea beside them (where a people can settle and land boats)
    const coast = g.land.filter((k) => { const x = k % W, z = (k / W) | 0; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => I.label[(z + b) * W + ((x + a + W) % W)] < 0); });   // given: the four neighbours
    list.push({
      key: g.key, island: g.island, chunks: n, coast, cx, cz, lat: latOf(cz * C), lon: lonOf(cx * C), T: T / n, M: M / n,
      biomes: top(biomes, 4), woods: top(woods, 3), stones: top(stones, 3), crops: [...crops], herds: [...herds], wild: [...wild], sea: [...sea], ores,   // vision: what the lenses list of each
      food: { crop, herd, fish }, timber: woods.size ? [...woods.values()].reduce((a, b) => a + b, 0) / n : 0,
    });
  }
  // 3. living
  for (const p of list) {
    const f = p.food, total = f.crop + f.herd + f.fish || 1;
    p.capacity = total;
    p.richness = total / p.chunks;
    p.living = f.fish >= f.crop && f.fish >= f.herd ? "fishers" : f.crop >= f.herd ? "farmers" : "herders";
    p.shares = { fish: +(f.fish / total).toFixed(2), crop: +(f.crop / total).toFixed(2), herd: +(f.herd / total).toFixed(2) };
    p.arms = Math.min(1, p.timber) * (p.ores.includes("minecraft:iron_ore") ? 1 : 0.4);   // vision: without iron, arms are wood and stone
    p.goods = new Set([...p.crops, ...p.wild, ...p.sea, ...p.ores.filter((o) => !/coal|copper|iron/.test(o))]).size;
  }
  // 4. temper: scarcity x arms x opportunity, against surplus x trade wind
  const rich = list.map((p) => p.richness).sort((a, b) => a - b), median = rich[rich.length >> 1] || 1;
  const maxGoods = Math.max(...list.map((p) => p.goods), 1);
  const reach = VISION.RAID * VISION.HOP;
  for (const p of list) {
    const scarcity = Math.max(0, Math.min(1, 1 - p.richness / median));
    let opportunity = 0, target = null, partner = null;
    for (const q of list) {
      if (q === p) continue;
      let dx = Math.abs(q.cx - p.cx); dx = Math.min(dx, W - dx);
      const d = Math.hypot(dx, q.cz - p.cz);
      if (d > reach) continue;
      const lure = Math.max(0, q.richness - p.richness) / (1 + d / VISION.HOP);
      opportunity += lure;
      if (!target || lure > target.lure) target = { key: q.key, lure, d };
      const swap = (q.goods + p.goods) / (1 + d / VISION.HOP);
      if (!partner || swap > partner.swap) partner = { key: q.key, swap, d };
    }
    const fairTrade = /trades|westerlies/.test(climateAt(Math.round(p.cx), Math.round(p.cz)).belt) ? 1 : 0.6;   // vision: steady belts carry trade
    p.war = +(scarcity * p.arms * Math.tanh(opportunity / median)).toFixed(3);   // vision: three places shown
    p.trade = +((p.goods / maxGoods) * (1 - scarcity) * fairTrade).toFixed(3);   // vision: three places shown
    p.temperScore = +(p.war - p.trade * 0.5).toFixed(3);   // vision: trade calms half as much as want stirs
    p.temper = p.temperScore > 0.15 ? "raiders" : p.temperScore > 0 ? "wary" : p.temperScore > -0.2 ? "peaceful" : "traders";   // vision: the temper's bands
    p.target = target?.lure > 0 ? target.key : null;
    p.partner = partner?.key ?? null;
  }
  // 5. tradition: each people's fit to each tradition's home world, then a diverse sea: every
  //    tradition gets its floor first (the rarest first, each taking its best-fitting peoples), then
  //    everyone else takes their best fit among the traditions not yet at their ceiling
  const keys = Object.keys(TRADITIONS), [lo, hi] = VISION.TRADITION_SHARE;
  const fits = list.map((p) => keys.map((k) => TRADITIONS[k].fit(p)));
  const floor = (k) => Math.round(list.length * lo * (VISION.FEATURED[k] ?? 1)), ceil = Math.round(list.length * hi);
  const held = Object.fromEntries(keys.map((k) => [k, 0])), natural = Object.fromEntries(keys.map((k) => [k, 0]));
  fits.forEach((f) => natural[keys[f.indexOf(Math.max(...f))]]++);
  const order = [...keys].sort((a, b) => natural[a] - natural[b]);
  for (const k of order) {
    const j = keys.indexOf(k);
    const free = list.map((p, i) => i).filter((i) => !list[i].tradition).sort((a, b) => fits[b][j] - fits[a][j]);
    for (const i of free.slice(0, floor(k))) { list[i].tradition = k; held[k]++; }
  }
  list.forEach((p, i) => {
    if (p.tradition) return;
    const ranked = keys.map((k, j) => [k, fits[i][j]]).sort((a, b) => b[1] - a[1]);
    const [k] = ranked.find(([k]) => held[k] < ceil) ?? ranked[0];
    p.tradition = k; held[k]++;
  });
  list.forEach((p, i) => { const f = fits[i], best = keys[f.indexOf(Math.max(...f))]; p.traditionFit = +(f[keys.indexOf(p.tradition)] / Math.max(...f)).toFixed(2); p.naturalTradition = best; });
  // 6. building
  for (const p of list) p.build = architecture(p);
  cache = { list, byKey: new Map(list.map((p) => [p.key, p])), owner: T.owner };
  return cache;
}

/** What a people is doing at tick t: from the hour, the tide on its coast, the wind toward its neighbours. */
export function dayOf(p, t) {
  const hour = (((t % GIVEN.DAY) + GIVEN.DAY) % GIVEN.DAY) / (GIVEN.DAY / 24);   // given: 24 hours a day (0 = sunrise in Minecraft)
  const day = hour < 12, x = p.cx * C, z = p.cz * C;   // given: Minecraft's day is the first twelve hours from sunrise
  const tide = tideAt(x, z, t, 2);                                                 // vision: their landing is in two blocks of water
  const w = windAt(x, z, t);
  const fair = (key) => {
    const q = key && peoples().byKey.get(key);
    if (!q) return false;
    const toward = Math.atan2(w.e, -w.s), bearing = Math.atan2(q.cx - p.cx, -(q.cz - p.cz));
    return Math.cos(toward - bearing) > Math.cos(60 * RAD) && w.speed > 3;          // vision: a fair wind is within 60 degrees and a breeze
  };
  if (!day) return p.temper === "raiders" && fair(p.target) ? { doing: "raiding", toward: p.target } : { doing: "at home" };
  if (p.temper === "traders" && fair(p.partner)) return { doing: "trading voyage", toward: p.partner };
  if (p.living === "fishers") return tide >= 0 ? { doing: "fishing on the flood", tide: +tide.toFixed(2) } : { doing: "mending nets (ebb)", tide: +tide.toFixed(2) };
  if (p.living === "farmers") return { doing: hour < 2 || hour > 10 ? "carrying to the granary" : "in the fields" };   // vision: the first and last two hours of daylight
  return { doing: "with the herds" };
}
