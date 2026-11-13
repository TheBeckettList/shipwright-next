// Pure (given a loaded map). The closed economy: every people's stores, buildings and fleet, month by
// month, with every item accounted for. Nothing appears except what the jobs make from the ground,
// and nothing vanishes except what is eaten, used, rots, or goes to the sea as wreckage (where a
// player can salvage it). The ledger lens holds the world to that, to the item.
//
// A month, for every people (in loop order, from the month's baked history and society):
//   work      its folk work their jobs (jobs.js): the trades its society allots, and of the rest a
//             share dig (miners) and the others gather wood. What they make goes into its stores
//   eat       its folk eat EAT food points each, from its stores; hunger is remembered
//   ships     its fleet's month of wear (ships.js) is repaired from its stores in its tradition's
//             own materials, as far as they go; what can't be is the fleet's damage
//   sea       its waterfront buildings take the month's worst sea (sea.js waveDamage) against their
//             material's blast resistance, sheltered or on piles; a building the sea wrecks goes
//             part to its stores as salvage, the rest to the sea
//   war       a raiding people's warriors against its target's defenders and guard: buildings
//             razed, each split three ways: loot to the raider, salvage to the defender, wreck to
//             the sea at the defender's shore
//   build     toward what its fortune wants (buildings.js wealth walk): the next building of its
//             plan when its stores hold the whole bill; over what it wants, the last one taken
//             down, most of it reclaimed, the rest rotted
//   market    a trading people sends what its stores can't hold to Thera's Exchange, and takes
//             from it, count for count, what its next building and its ships are short of. Past
//             what its stores hold, food spoils and other goods rot. The Exchange is on the ledger
//   move      a people raided MOVE_RAIDS months running, or left with less than its core, takes
//             down what stands (carrying most of it) and moves: to a ruin on its own ground if
//             there is one (recovering what the ruin holds, and building on its old streets), or
//             else to the coast of its ground farthest from its old site. The site it leaves is a
//             ruin: what it couldn't carry, and the memory of its districts
//   re-found  at a year's end a rising people with a ruin on its ground may move its town onto it
//             (a bounded few a year): it takes up the ruin, and leaves its own site a ruin in turn,
//             so towns layer and wander over the eras
// Its settlement's tier (camp to town) is read off what stands and who lives there.
import { VISION, GIVEN, D } from "../core/given.js";
import { seaState, waveMax, waveDamage, blastOf } from "../core/sea.js";
import { windAt } from "../core/wind.js";
import { loop, firstWorld, bake } from "./history.js";
import { peoples } from "./peoples.js";
import { societyOf } from "./society.js";
import { planOf, wealthWalk, monthRecords } from "./buildings.js";
import { JOBS, FOOD, EAT, KEEP } from "./jobs.js";
import { islands as islandsOf } from "./islands.js";
import { RUNGS } from "../core/clock.js";
import { tradeMonth, dangers, effect, afloat, addWreck, TRADE } from "./trade.js";
import { league } from "./league.js";
import { regions as seaRegions, seaStart, seaMonth, STOCKS, SEA } from "./sealife.js";
const ECONOMY_MONTHS = RUNGS.year / RUNGS.month;   // derived: twelve

export const ECONOMY = Object.freeze({
  MINERS: 0.35,           // vision: share of a people's unassigned folk who dig, where there's rock
  LEAGUE_MINERS: 0.15,    // vision: share of a city-state's folk who dig for its pieces
  YIELD: { FORTUNE: 0.35, WINTER_CROP: 0.25, WINTER_FISH: 0.6 },   // vision: how far fortune swings the food jobs' yields; what of a summer's crop and catch midwinter gives
  START_MONTHS: 2,        // vision: months of making a people has in store on the first day
  SALVAGE: 0.4,           // vision: share of a wrecked or razed building its own people save
  LOOT: 0.35,             // vision: share of a razed building the raiders carry off
  RECLAIM: 0.8,           // vision: share of a building taken down that goes back into store (the rest rots)
  CARRY: 0.6,             // vision: share of what stands that a moving people carries to its new site
  RAZE: 0.5,              // vision: the most of a target's buildings one month's raid can raze
  MOVE_RAIDS: 2,          // vision: months raided in a row that make a people move
  GUARD: { "palisade and lookout": 1.6, wall: 1.4, "market and warehouse": 1, none: 0.8 },   // vision: how much its guard multiplies a people's defence
  WATERFRONT: /boathouse|net racks|smokehouse|warehouse|market|landing/,   // vision: the buildings that stand at the water
  TIERS: [[0, "camp"], [3, "hamlet"], [6, "village"], [10, "town"]],     // vision: buildings standing for each settlement tier
  SITE: { HEART: 20, LEE: 1.5, AWAY: 30 },   // vision: chunks from its heart that cost a point; a lee's worth; chunks from the old site that earn one when moving
  REFOUND: 0.03,          // vision: share of the peoples who may re-found their town on a ruin at a year's end (the Therans' bound on churn)
  RUIN_MIN: 24,           // vision: items a ruin must still hold to be worth re-founding on (what a fallen home or two leaves)
  REFOUND_REACH: 48,      // vision: chunks from its town a people looks for a ruin to re-found on (a region: its neighbours' old towns too)
});

const add = (m, id, n) => { if (n > 0) m[id] = (m[id] ?? 0) + n; };
const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);
const takeAll = (from, bill, share, to) => { for (const [id, n] of Object.entries(bill)) { const k = n * share; if (to) add(to, id, k); } };
function take(stock, id, n) { const k = Math.min(stock[id] ?? 0, n); if (k > 0) stock[id] -= k; return k; }
const billSum = (b) => sum(b);

let run = null;
/** The economy through month n (0: the first day). Kept: asking again extends it. */
export function economy(n) {
  const L = loop(), P = peoples(), recs = monthRecords(n), walks = wealthWalk(n);
  if (!run) {
    const state = L.map((p, i) => {
      const plan = planOf(p), built = plan.map((_, k) => k < walks[i].walk[0]);
      return { key: p.key, site: siteOf(p), plan, built, cond: plan.map(() => 1), stock: {}, hunger: 0, fleetDamage: 0, raided: 0, moves: 0, tier: "camp" };
    });
    run = { month: 0, state, sea: [], wrecks: [], hoards: [], pools: {}, kits: {}, ruins: [], exchange: {}, ledger: { start: 0, made: 0, eaten: 0, used: 0, rot: 0, sea: 0 }, events: [] };
    // the first day's stores: START_MONTHS of making
    const w0 = firstWorld(), b0 = bake(w0);
    state.forEach((s, i) => { const made = work(L[i], societyOf(L[i], b0, w0)); for (const [id, k] of Object.entries(made)) add(s.stock, id, k * ECONOMY.START_MONTHS); });
    run.ledger.start = state.reduce((a, s) => a + sum(s.stock) + standing(s), 0);
  }
  const w = firstWorld();
  while (run.month < n) monthOf(run, run.month, L, recs, walks, w);
  return run;
}
const standing = (s) => s.plan.reduce((a, b, k) => a + (s.built[k] ? billSum(b.bill) : 0), 0);

/** A month's making by a people's folk (jobs.js), as a map of items. times: { fortune, warmth } swing the yields. */
export function work(p, soc, stock = null, times = { fortune: 0, warmth: 0 }) {
  const Y = ECONOMY.YIELD, good = 1 + Y.FORTUNE * times.fortune, summer = (1 + times.warmth) / 2;   // summer 1 at midsummer, 0 at midwinter
  const swing = { farmer: good * (Y.WINTER_CROP + (1 - Y.WINTER_CROP) * summer), fisherman: good * (Y.WINTER_FISH + (1 - Y.WINTER_FISH) * summer) * (times.catch ?? 1), shepherd: good, butcher: good, leatherworker: good };
  const out = {}, assigned = Object.values(soc.professions).reduce((a, b) => a + b, 0), rest = Math.max(0, soc.folk - assigned);
  const crew = { ...soc.professions };
  const miners = league().byPeople.has(p.key) ? Math.max(Math.round(rest * ECONOMY.MINERS), Math.round(soc.folk * ECONOMY.LEAGUE_MINERS)) : p.stones.length ? Math.round(rest * ECONOMY.MINERS) : 0;   // a city-state digs for its pieces whatever else it does
  crew.miner = miners; crew.folk = Math.max(0, rest - miners);
  for (const [job, n] of Object.entries(crew)) {
    const J = JOBS[job]; if (!J || !n) continue;
    let scale = 1;
    if (J.uses && stock) for (const [id, k] of Object.entries(J.uses(p))) scale = Math.min(scale, (stock[id] ?? 0) / (k * n));
    if (J.uses && !stock) scale = 0;
    for (const [id, k] of Object.entries(J.makes(p, n))) add(out, id, k * n * Math.max(0, scale) * (swing[job] ?? 1));
    if (J.uses && stock && scale > 0) for (const [id, k] of Object.entries(J.uses(p))) out[`-${id}`] = (out[`-${id}`] ?? 0) + k * n * scale;
  }
  return out;
}

function monthOf(R, m, L, recs, walks, w) {
  w.record = recs[m].slice();
  const b = bake(w), E = ECONOMY, led = R.ledger;
  const socs = L.map((p) => societyOf(p, b, w));
  const warmth = Math.cos(2 * Math.PI * (((m % ECONOMY_MONTHS) + 0.5) / ECONOMY_MONTHS));   // derived: the month's middle, on the year's warmth (clock.js)
  const raidsOn = new Map();
  // the sea first: every people's fishermen ask their own water for their catch; the sea gives what its stocks can (sealife.js), the wardens take their tax
  const FISH = new Set(Object.values(STOCKS).map((x) => x.fish).filter(Boolean)), SR = seaRegions();
  const pre = L.map((p, i) => work(p, socs[i], R.state[i].stock, { fortune: w.record[i], warmth, catch: effect(R.state[i], "catch", socs[i].fleet.boats) }));
  const waterOf = L.map((p) => { const c = p.coast?.[0]; return c !== undefined ? SR.of(c % D.CELLS_W, Math.floor(c / D.CELLS_W)) : SR.of(p.cx, p.cz); });
  const demand = {}; pre.forEach((made, i) => { for (const [id, k] of Object.entries(made)) if (FISH.has(id)) demand[waterOf[i].id] = (demand[waterOf[i].id] ?? 0) + k; });
  R.sea ??= []; R.seaLife ??= seaStart(); R.wardens ??= {};
  const pay = (n) => { let r = n; for (const id of Object.keys(R.wardens)) { if (r <= 0) break; const k = take(R.wardens, id, r); led.used += k; r -= k; } return r <= 0; };   // a replanting spends the wardens' tax
  const given = seaMonth(R.seaLife, m, demand, pay);
  L.forEach((p, i) => {
    const s = R.state[i], soc = socs[i];
    // work (the catch as the sea gave it, less the wardens' tax)
    const made = pre[i], share = given[waterOf[i].id] ?? 1;
    for (const [id, k0] of Object.entries(made)) {
      if (id.startsWith("-")) { led.used += take(s.stock, id.slice(1), k0); continue; }
      let k = k0; if (FISH.has(id)) { k = k0 * share; const tax = k * SEA.TAX; add(R.wardens, id, tax); led.made += tax; k -= tax; made[id] = k0 * share; }
      add(s.stock, id, k); led.made += k;
    }
    // eat
    let need = soc.folk * EAT;
    for (const [id, pts] of Object.entries(FOOD)) { if (need <= 0 || !pts) continue; const k = take(s.stock, id, need / pts); need -= k * pts; led.eaten += k; }
    s.hunger = need > 0 ? need / (soc.folk * EAT) : 0;
    // ships
    const st = soc.fleet.stores, wear = (soc.fleet.wear / (GIVEN.DAY > 0 ? 12 : 1)) * effect(s, "wear", soc.fleet.boats), parts = [[st.hull, 1], [st.fasten, 0.5], [st.sail, 0.25]];   // vision: a month is a twelfth of the year's wear, and the stores a repair takes (ships.js per)
    let short = 0;
    s.fleetShort = {};
    for (const [id, per] of parts) if (id) { const want = wear * per, got = take(s.stock, id, want); led.used += got; short += want - got; if (want - got > 0.5) s.fleetShort[id.replace("minecraft:", "")] = Math.round(((want - got) / want) * 100); }   // vision: a percentage
    s.fleetDamage = Math.min(1, Math.max(0, s.fleetDamage * 0.5 + short / Math.max(1, wear * 2)));   // vision: half the damage mended a month, the shortfall's share added
    // the sea on the waterfront
    const C = D.PX, x = p.cx * C, z = p.cz * C, wind = windAt(x, z, 0).speed * VISION.STORM, H = waveMax(seaState(wind).Hs);
    s.plan.forEach((bd, k) => {
      if (!s.built[k] || !E.WATERFRONT.test(bd.name)) return;
      const blast = Math.min(...Object.keys(bd.bill).map(blastOf)), exposure = VISION.SHELTER * (p.build.raised ? VISION.PILES : 1);
      s.cond[k] -= waveDamage(H, blast, exposure);
      if (s.cond[k] <= 0) { wreck(R, s, k, E.SALVAGE, null, p, "the sea"); }
    });
    // war: noted now, razed below (so every raid this month sees the same world)
    if (soc.action === "raid" && p.target && !league().byPeople.has(p.key) && !league().byPeople.has(p.target)) {   // the Koinon is neutral: it neither raids nor is raided
      const t = L.findIndex((q) => q.key === p.target); if (t >= 0) { const list = raidsOn.get(t) ?? []; list.push(i); raidsOn.set(t, list); } }
  });
  L.forEach((q, t) => {
    const s = R.state[t], list = raidsOn.get(t);
    if (!list) { s.raided = 0; return; }
    s.raided++;
    for (const i of list) {
      const p = L[i], A = socs[i].folk * (1 + p.arms) * effect(R.state[i], "attack", socs[i].fleet.boats), D = socs[t].folk * (E.GUARD[q.build.guard] ?? 1) * (1 - R.state[t].hunger * 0.5) * effect(s, "guard", socs[t].fleet.boats);   // vision: hunger halves a defence at worst
      if (A <= D) { R.events.push({ m, what: "raid beaten off", by: p.key, at: q.key }); continue; }
      const up = s.plan.map((_, k) => k).filter((k) => s.built[k]), n = Math.max(1, Math.round(((A - D) / (A + D)) * E.RAZE * up.length));
      for (const k of up.slice(-n)) wreck(R, s, k, E.SALVAGE, R.state[i], q, `raided by ${p.key}`, { sink: TRADE.LOOT_SINK * (D / A), from: p });
      R.events.push({ m, what: "razed", by: p.key, at: q.key, buildings: n });
    }
  });
  // market and shipping (trade.js): town to city, city to Thera; kits, wear, salvage; the sea's share of every wreck
  const made = L.map((p, i) => work(p, socs[i], null, { fortune: w.record[i], warmth }));
  R.hubs = tradeMonth(R, L, socs, made, m, { ...dangers(b, recs, m, RUNGS.month * RUNGS.day), fortunes: new Map(L.map((p, i) => [p.key, w.record[i]])) });
  // build, take down, move
  L.forEach((p, i) => {
    const s = R.state[i], want = walks[i].walk[m + 1] ?? walks[i].walk.at(-1), have = s.built.filter(Boolean).length;
    if (s.raided >= E.MOVE_RAIDS || have < 2) {   // vision: the core homes
      if (have > 0 || s.raided >= E.MOVE_RAIDS) moveOf(R, s, p, L, m);
    } else if (have < want) {
      const k = s.built.findIndex((x) => !x), bill = s.plan[k]?.bill;
      if (bill && Object.entries(bill).every(([id, n]) => (s.stock[id] ?? 0) >= n)) { for (const [id, n] of Object.entries(bill)) take(s.stock, id, n); s.built[k] = true; s.cond[k] = 1; }
    } else if (have > want) {
      const k = s.built.lastIndexOf(true), bill = s.plan[k].bill;
      for (const [id, n] of Object.entries(bill)) { add(s.stock, id, n * E.RECLAIM); led.rot += n * (1 - E.RECLAIM); }
      s.built[k] = false;
    }
    const n = s.built.filter(Boolean).length;
    s.tier = [...E.TIERS].reverse().find(([k]) => n >= k)[1];
  });
  if ((m + 1) % ECONOMY_MONTHS === 0) refound(R, L, w, m);
  R.month++;
}
/** A building wrecked: its own people save `salvage`, raiders (if any) loot, the rest to the sea at that shore. */
function wreck(R, s, k, salvage, raider, p, why, fight = null) {
  const bill = s.plan[k].bill, E = ECONOMY, loot = raider ? E.LOOT : 0, sea = {}, sunk = {};
  for (const [id, n] of Object.entries(bill)) {
    add(s.stock, id, n * salvage); add(sea, id, n * (1 - salvage - loot));
    if (raider) { const down = fight ? Math.min(1, fight.sink) * n * loot : 0; add(raider.stock, id, n * loot - down); add(sunk, id, down); }   // close fights sink loot on the way home
  }
  const W = D.CELLS_W, at = s.site !== null && s.site !== undefined ? { cx: s.site % W, cz: Math.floor(s.site / W) } : { cx: p.cx, cz: p.cz };
  addWreck(R, at, sea, why, R.month);
  if (fight && Object.keys(sunk).length) { let dx = fight.from.cx - at.cx; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; addWreck(R, { cx: (at.cx + dx / 2 + W) % W, cz: (at.cz + fight.from.cz) / 2 }, sunk, `${fight.from.key}'s loot, sunk after a hard fight`, R.month); }
  R.sea.push({ at: p.key, cell: s.site, why, month: R.month });
  s.built[k] = false; s.cond[k] = 1;
}
/** A people moves: takes down what stands, carrying CARRY of it; the rest stays as a ruin where it was. */
function moveOf(R, s, p, L, m, to = null) {
  const E = ECONOMY, left = {}, oldBuilt = s.plan.map((b, k) => (s.built[k] ? b.name : null)).filter(Boolean);
  s.plan.forEach((b, k) => { if (!s.built[k]) return; for (const [id, n] of Object.entries(b.bill)) { add(s.stock, id, n * E.CARRY); add(left, id, n * (1 - E.CARRY)); } s.built[k] = false; });
  const from = s.site ?? p.coast[0];
  if (sum(left) > 0) R.ruins.push({ site: from, of: p.key, tradition: p.tradition, built: oldBuilt, memory: s.memory ?? null, items: left, month: m });
  // where to: a ruin on its own ground (the richest), or its coast farthest from where it was
  const W = D.CELLS_W, mine = new Set(p.coast);
  const ruin = to ?? R.ruins.filter((r) => r.site !== from && mine.has(r.site) && sum(r.items) > 0).sort((a, b) => sum(b.items) - sum(a.items))[0] ?? null;
  const d = (a, c) => { let dx = Math.abs((a % W) - (c % W)); dx = Math.min(dx, W - dx); return Math.hypot(dx, ((a / W) | 0) - ((c / W) | 0)); };
  let site;
  if (ruin) { for (const [id, n] of Object.entries(ruin.items)) add(s.stock, id, n); ruin.items = {}; ruin.taken = { by: p.key, month: m }; site = ruin.site; s.memory = ruin.memory; }
  else { site = siteOf(p, from) ?? from; s.memory = null; }
  R.events.push({ m, what: ruin ? "re-founded on a ruin" : "moved", who: p.key, from, to: site, ruinOf: ruin?.of });
  s.site = site; s.raided = 0; s.moves++;
  // the core homes go up again first, from what it carried
  for (let k = 0; k < 2 && k < s.plan.length; k++) { const bill = s.plan[k].bill; if (Object.entries(bill).every(([id, n]) => (s.stock[id] ?? 0) >= n)) { for (const [id, n] of Object.entries(bill)) take(s.stock, id, n); s.built[k] = true; } }   // vision: the core homes
}
/** A year's end: a bounded few rising peoples re-found their towns on the ruins of their ground. */
function refound(R, L, w, m) {
  const E = ECONOMY, cap = Math.max(1, Math.round(E.REFOUND * L.length));
  const offers = [];
  const W = D.CELLS_W, I = islandsOf(), sites = new Set(R.state.map((s) => s.site));
  const far = (a, c) => { let dx = Math.abs((a % W) - (c % W)); dx = Math.min(dx, W - dx); return Math.hypot(dx, ((a / W) | 0) - ((c / W) | 0)); };
  L.forEach((p, i) => {
    if (w.record[i] !== 1) return;
    const s = R.state[i];
    // a ruin on its own island, near enough to be its country (its own, or a neighbour's of another age)
    const r = R.ruins.filter((x) => x.site !== s.site && !sites.has(x.site) && I.label[x.site] === p.island && far(x.site, s.site) <= E.REFOUND_REACH && sum(x.items) >= E.RUIN_MIN)
      .sort((a, b) => sum(b.items) - sum(a.items))[0];
    if (r) offers.push({ i, r, worth: sum(r.items) });
  });
  offers.sort((a, b) => b.worth - a.worth || a.i - b.i);
  const used = new Set();
  for (const o of offers.slice(0, cap * 2)) { if (used.has(o.r) || used.size >= cap) continue; used.add(o.r); moveOf(R, R.state[o.i], L[o.i], L, m, o.r); }
}

/**
 * Where a people sets its town: the coastal chunk of its ground that's nearest its heart, in the lee of
 * the belt's wind (the sea beside it lies downwind, so the swell comes from over the land), and low.
 * `away`: a site to keep away from (moving from), weighed in.
 */
export function siteOf(p, away = null) {
  const W = D.CELLS_W, C = D.PX, I = islandsOf();
  const wind = windAt(p.cx * C, p.cz * C, 0), de = wind.e / (wind.speed || 1), ds = wind.s / (wind.speed || 1);   // where the wind blows toward
  const d = (a, cx, cz) => { let dx = Math.abs((a % W) - cx); dx = Math.min(dx, W - dx); return Math.hypot(dx, ((a / W) | 0) - cz); };
  let best = null;
  for (const c of p.coast) {
    const x = c % W, z = (c / W) | 0;
    let lee = 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (z + b) * W + ((x + a + W) % W); if (I.label[k] < 0) lee += a * de + b * ds; }   // given: the four neighbours: sea downwind is shelter
    const score = -d(c, p.cx, p.cz) / ECONOMY.SITE.HEART + ECONOMY.SITE.LEE * lee + (away !== null ? d(c, away % W, (away / W) | 0) / ECONOMY.SITE.AWAY : 0);
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c ?? null;
}

/** The ledger: everything that ever was, against everything that is or went somewhere. */
export function ledger(R) {
  const L = R.ledger, nowStock = R.state.reduce((a, s) => a + sum(s.stock), 0), nowStanding = R.state.reduce((a, s) => a + standing(s), 0);
  const exchange = sum(R.exchange), ruins = R.ruins.reduce((a, r) => a + sum(r.items), 0), af = afloat(R), wardens = sum(R.wardens ?? {}), inn = L.start + L.made + (L.allotted ?? 0) + (L.minted ?? 0), out = nowStock + nowStanding + exchange + ruins + af.total + wardens + L.eaten + L.used + L.rot + L.sea;
  return { in: inn, out, gap: inn - out, stock: nowStock, standing: nowStanding, exchange, ruins, afloat: af, ...L };
}
