// Pure (given a loaded map). The peoples: who lives where, what they have, what they do, how they
// build, all derived, in this order, with nothing assigned by hand:
//
//   1. where     every island big enough (VISION.SETTLE) holds a people; a big one holds one every
//                REGION chunks across
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
import { latOf, lonOf } from "../core/globe.js";
import { windAt } from "../core/wind.js";
import { tideAt } from "../core/sea.js";
import { islands } from "./islands.js";
import { climateAt } from "./climate.js";
import { heightOf } from "./map.js";
import { ORES } from "./biomes.js";
import { architecture } from "./architecture.js";
import { TRADITIONS } from "./traditions.js";
import { THERA } from "./thera.js";

const C = D.PX, RAD = Math.PI / 180;   // given
const inc = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const top = (m, n = 1) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

let cache = null;
export function peoples() {
  if (cache) return cache;
  const I = islands(), W = I.W, R = VISION.REGION;
  const seatK = THERA.seat.cz * W + THERA.seat.cx, seatIsl = I.label[seatK] >= 0 ? I.label[seatK] : I.near[seatK], islet = seatIsl >= 0 ? I.info[seatIsl].area : 0;
  const theran = (i) => { let dx = Math.abs(I.info[i].cx - THERA.seat.cx); dx = Math.min(dx, W - dx); return I.info[i].area <= islet && Math.max(dx, Math.abs(I.info[i].cz - THERA.seat.cz)) <= THERA.REACH; };   // derived: Thera and its islets (no bigger than Thera) are the Atlanteans': no generated people; a continent whose middle falls in Thera's reach keeps its peoples
  const groups = new Map();
  // 1. where: land chunks grouped by island and region cell; the shelf waters by nearest island and cell
  for (let k = 0; k < I.label.length; k++) {
    const isl = I.label[k] >= 0 ? I.label[k] : I.dist[k] <= 2 ? I.near[k] : -1;   // vision: a people fishes its waters out to two chunks
    if (isl < 0 || theran(isl) || I.info[isl].area < VISION.SETTLE) continue;
    const cx = k % W, cz = (k / W) | 0, key = `${isl}:${Math.floor(cx / R)},${Math.floor(cz / R)}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, island: isl, land: [], sea: [] }));
    (I.label[k] >= 0 ? g.land : g.sea).push(k);
  }
  const list = [];
  for (const g of groups.values()) {
    if (g.land.length < VISION.SETTLE) continue;
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
  cache = { list, byKey: new Map(list.map((p) => [p.key, p])) };
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
