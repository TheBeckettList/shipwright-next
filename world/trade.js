// Pure (given a loaded map). How goods move: a tiered network of markets, and what the sea takes.
// Called by the economy each month; every item stays on its ledger.
//
//   tiers     village -> city -> (island hub) -> continental hub -> Thera, and beside them each
//             tradition's cultural hub. Everything can be found at Thera, but only what crosses
//             continents goes there: goods move up a tier only as far as someone wants them
//     city        a tradition's seat or port; a village's city is the nearest on its island, else
//                 the nearest in its continent within HUB_REACH over the sea
//     island hub  on an island with two cities or more (that isn't a continent's own big island):
//                 its strongest city. Some islands have one; most don't
//     continent   every big island (CONTINENT chunks and up), with the smaller islands nearest it;
//                 its hub the strongest city on the big island. The Koinon's island is a continent
//                 whose hub is the presiding city-state's seat, month by month
//     culture     each tradition's seat pools its own materials (its frames, roofs and ship stores)
//                 from all its peoples, wherever they are, and gives them to those short of them
//     Thera       the Exchange: international goods only (what another continent ordered), plus a
//                 tithe of every continent's surplus, so a little of everything is always there
//   each month  peoples send overflow to their city (their tradition's materials to their cultural
//             hub) and take back, count for count, what they want. Then tier by tier, each hub
//             sends half its market's surplus up, and asks its parent for what its children wanted
//             and it lacked, count for count with what it sent. What a continent still lacks is
//             its order at Thera. Food goes no further than an island
//   the sea   a hop between islands is a voyage: as much as the sender's cargo ships hold, and at
//             risk where it passes a contested border or a sailing pirate band: pirates bury what
//             they take on their home shore (treasure), the rest sinks there, a wreck
//   wrecks    sited, holding their items; the sea takes a share a month; diving bells lift them
//   kits      the Koinon's pieces, sold through Thera to peoples whose continent traded there
//   the money the Koinon keeps Thera's market: a brokerage on everything that comes into it goes to
//             its house, the reserve the money people work with. The Therans stand above the market:
//             each month they take what the city needs first, free of brokerage; what the Exchange
//             lacks for them, the Koinon's house buys from the continents with its reserve and ships
//             in (the one time food sails), so Thera is fed by the world's money, not its own
import { GIVEN, D } from "../core/given.js";
import { peoples } from "./peoples.js";
import { islands } from "./islands.js";
import { THERA } from "./thera.js";
import { ranks } from "./society.js";
import { league, presiding, kitBill, PIECES, LEAGUE, mastersOf } from "./league.js";
import { bandsIn, bandAt } from "./pirates.js";
import { FOOD, KEEP, EAT } from "./jobs.js";
import { SHIPS } from "./ships.js";

export const TRADE = Object.freeze({
  HOLD: 27 * 64,           // given: a chest's 27 stacks of 64, a cargo ship's hold a trip
  HUB_REACH: 64,           // vision: chunks over the sea a town will send to a city
  CROSS: 6,                // vision: chunks from a contested border or a pirate band where a voyage is at risk
  LOSS: 0.15,              // vision: share of a cargo lost passing a danger
  PIRATE_TAKE: 0.6,        // vision: of what's lost near pirates, the share they take (the rest sinks)
  MARKET_ROT: 0.1,         // vision: share of a market's goods that rot a month (food: half)
  WRECK_DECAY: 0.04,       // vision: share of a wreck the sea takes a month
  BELL_LIFT: 200,          // vision: items a fitted diving bell lifts a month
  SALVAGE_REACH: 24,       // vision: chunks a bell will go for a wreck
  LOOT_SINK: 0.4,          // vision: share of a raid's loot that goes down when the fight was close (times defence over attack)
  CONTINENT: 5000,         // vision: chunks that make an island a continent
  UP: 0.5,                 // vision: share of a hub's surplus it sends up a tier a month
  TITHE: 0.05,             // vision: share of a continent's surplus that goes to Thera unasked, so Thera has some of everything
  BROKERAGE: 0.03,         // vision: the Koinon's share of everything that comes into Thera's market (they keep the market)
  THERANS: 2000,           // vision: the Therans of the city and its towns, who eat from the Exchange
  EMERALD: 16,             // vision: items an emerald buys (about a villager's trade)
  TIMBER: 600,             // vision: logs and planks the city's yards and roofs use a month
});
const add = (m, id, n) => { if (n > 0) m[id] = (m[id] ?? 0) + n; };
const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);
const take = (m, id, n) => { const k = Math.min(m[id] ?? 0, n); if (k > 0) m[id] -= k; return k; };
const C = D.PX;   // blocks a map cell
const cellXZ = (cell, W) => ({ x: (cell % W) * C + C / 2, z: Math.floor(cell / W) * C + C / 2 });   // given: a chunk's middle
/** Chunk distance on the wrapped map. */
export function chunkDist(a, b) { const W = D.CELLS_W; let dx = Math.abs(a.cx - b.cx); dx = Math.min(dx, W - dx); return Math.hypot(dx, a.cz - b.cz); }
const mid = (a, b) => { const W = D.CELLS_W; let dx = b.cx - a.cx; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; return { cx: (a.cx + dx / 2 + W) % W, cz: (a.cz + b.cz) / 2 }; };
export const THERA_AT = { cx: THERA.seat.cx, cz: THERA.seat.cz };

let theraIsland = null;
const theraIs = () => theraIsland ?? (theraIsland = islands().label[THERA.seat.cz * D.CELLS_W + THERA.seat.cx]);
let base = null;
/** The fixed part of the network: continents (big islands and the islands nearest them). */
function continents() {
  if (base) return base;
  const I = islands(), Lg = league(), big = I.info.filter((x) => x.area >= TRADE.CONTINENT && x.id !== theraIs() && x.id !== Lg.island), of = new Map();   // the Koinon's island is no one's continent but its own
  for (const x of I.info) { if (x.id === Lg.island) continue; const c = big.reduce((b, y) => (!b || chunkDist(x, y) < chunkDist(x, b) ? y : b), null); of.set(x.id, c.id); }
  return (base = { big, of });
}
const TIER = { city: 1, isle: 2, cont: 3, thera: 4 };   // given: the tiers' order, bottom to top
/** The month's network. nodes: key -> { key, tier, hub (a people key, or "thera"), parent, at, island }; of: people key -> { first (its market node), culture (node) }. */
export function network(fortunes = new Map(), m = 0) {
  const P = peoples().list, by = peoples().byKey, R = ranks(fortunes), Lg = league(), K = continents(), nodes = new Map(), of = new Map();
  const node = (key, tier, hub, parent) => { if (!nodes.has(key)) { const q = hub === "thera" ? THERA_AT : by.get(hub); nodes.set(key, { key, tier, hub, parent, at: { cx: q.cx, cz: q.cz }, island: hub === "thera" ? theraIs() : q.island }); } return nodes.get(key); };
  node("thera", TIER.thera, "thera", null);
  const isCity = (p) => !Lg.byPeople.has(p.key) && R.get(p.key) !== "outlying";
  const cities = P.filter((p) => p.island !== theraIs() && isCity(p)), cap = (p) => p.capacity * (1 + 0.5 * (fortunes.get(p.key) ?? 0));   // vision: fortune moves strength by half (as ranks)
  const strongest = (list) => list.reduce((b, c) => (!b || cap(c) > cap(b) ? c : b), null);
  // continental hubs
  const contHub = new Map();
  for (const c of K.big) {
    if (c.id === Lg.island) continue;   // the Koinon is its own organism (below)
    const onBig = cities.filter((p) => p.island === c.id), inCont = cities.filter((p) => K.of.get(p.island) === c.id);
    const h = strongest(onBig.length ? onBig : inCont); if (h) contHub.set(c.id, h);
  }
  // island hubs: an island with two cities or more that isn't its continent's big island
  const islandHub = new Map(), byIsle = new Map(); for (const c of cities) (byIsle.get(c.island) ?? byIsle.set(c.island, []).get(c.island)).push(c);
  for (const [isl, list] of byIsle) if (list.length >= 2 && !K.big.some((b) => b.id === isl)) islandHub.set(isl, strongest(list));
  const contOf = (p) => { const h = contHub.get(K.of.get(p.island)); return h ? node(`cont:${h.key}`, TIER.cont, h.key, "thera") : nodes.get("thera"); };
  const cityNode = (c) => { const ih = islandHub.get(c.island), cn = contOf(c); const parent = ih && ih !== c ? node(`isle:${ih.key}`, TIER.isle, ih.key, cn.key).key : ih === c ? node(`isle:${c.key}`, TIER.isle, c.key, cn.key).key : cn.key; return node(`city:${c.key}`, TIER.city, c.key, parent); };
  const cultHub = new Map(); for (const p of P) if (R.get(p.key) === "seat" && !Lg.byPeople.has(p.key)) cultHub.set(p.tradition, p);
  const leagueNode = node("league", TIER.cont, presiding(m).seat.key, "thera"); leagueNode.league = true;   // the Koinon's house at Thera, kept by the presiding state
  for (const st of Lg.states) { const n = node(`state:${st.k}`, TIER.city, st.seat.key, "league"); n.state = st; }   // each city-state its own market
  for (const p of P) {
    const cult = cultHub.get(p.tradition), culture = cult ? node(`cult:${p.tradition}`, 0, cult.key, null) : null;   // tier 0: beside the ladder, not on it
    if (p.island === theraIs()) { of.set(p.key, { first: nodes.get("thera"), culture }); continue; }
    if (isCity(p)) { of.set(p.key, { first: cityNode(p), culture }); continue; }
    if (Lg.byPeople.has(p.key)) { of.set(p.key, { first: nodes.get(`state:${Lg.byPeople.get(p.key).k}`), culture: null, league: true }); continue; }   // its city-state's market
    const near = (list) => list.reduce((b, c) => (!b || chunkDist(p, c) < chunkDist(p, b) ? c : b), null);
    const home = near(byIsle.get(p.island) ?? []), away = near(cities.filter((c) => K.of.get(c.island) === K.of.get(p.island)));
    of.set(p.key, { first: home ? cityNode(home) : away && chunkDist(p, away) <= TRADE.HUB_REACH ? cityNode(away) : contOf(p), culture });
  }
  return { nodes, of };
}
/** A people's own tradition materials (what its cultural hub pools). */
export const materialsOf = (p, fleet) => new Set([p.build.frame.post, p.build.frame.wall, p.build.roof.cover, fleet.stores.hull, fleet.stores.fasten, fleet.stores.sail].filter(Boolean));

/** The dangers a voyage from a to b passes this month: contested borders and sailing pirate bands near its course's middle. */
export function dangersOn(a, b, ctx) {
  const m = mid(a, b), out = [];
  for (const z of ctx.zones) if (chunkDist(m, z) <= TRADE.CROSS) out.push({ kind: "war", at: z });
  for (const band of ctx.bands) if (chunkDist(m, band.at) <= TRADE.CROSS) out.push({ kind: "pirates", at: band.at, band });
  return { mid: m, out };
}
/** A cargo on a voyage: what arrives, and what is lost (to pirates' hoards, or as a wreck where it was lost). */
function voyage(R, cargo, a, b, ctx, m, who) {
  const d = dangersOn(a, b, ctx);
  if (!d.out.length) return cargo;
  const lost = 1 - (1 - TRADE.LOSS) ** d.out.length, pir = d.out.find((x) => x.kind === "pirates"), arrive = {}, sunk = {}, taken = {};
  for (const [id, n] of Object.entries(cargo)) { const l = n * lost, t = pir ? l * TRADE.PIRATE_TAKE : 0; add(arrive, id, n - l); add(taken, id, t); add(sunk, id, l - t); }
  if (sum(sunk) > 0) addWreck(R, { cx: d.mid.cx, cz: d.mid.cz }, sunk, `${who}'s cargo, lost ${pir ? "to pirates" : "in contested waters"}`, m);
  if (sum(taken) > 0) { const home = peoples().byKey.get(pir.band.home); const h = R.hoards.find((x) => x.band === pir.band.home) ?? (R.hoards.push({ band: pir.band.home, at: home.coast[0] ?? home.cx, cx: home.cx, cz: home.cz, items: {}, since: m }), R.hoards.at(-1)); for (const [id, n] of Object.entries(taken)) add(h.items, id, n); }
  return arrive;
}
/** A wreck, sited (chunk), with its items: the sea takes a share of it a month. */
export function addWreck(R, at, items, cause, m) {
  R.wrecks.push({ cx: at.cx, cz: at.cz, x: Math.round(at.cx * C + C / 2), z: Math.round(at.cz * C + C / 2), items: { ...items }, cause, month: m });   // given: a chunk's middle
}

/** The month's dangers: contested borders' middles, and where the sailing bands are mid-month. */
export function dangers(baked, records, m, monthTicks) {
  const by = peoples().byKey, zones = baked.borders.filter((x) => x.state === "contested").map((x) => mid(by.get(x.a), by.get(x.b)));
  const bands = records && records.length > m ? bandsIn(m, records, baked).sailing.map((band) => { const p = bandAt(band, (m + 0.5) * monthTicks); return { ...band, at: { cx: p.x / C, cz: p.z / C } }; }) : [];
  return { zones, bands };
}

/** The month's markets up and down the tiers, kits, wear and salvage. made[i]: what people i makes a month (caps). */
export function tradeMonth(R, L, socs, made, m, ctx) {
  const by = peoples().byKey, net = network(ctx.fortunes, m), led = R.ledger, Lg = league();
  R.pools ??= {}; R.wrecks ??= []; R.hoards ??= []; R.kits ??= {};
  R.flows = { up: [0, 0, 0, 0, 0], down: [0, 0, 0, 0, 0], culture: 0, toThera: 0, tithe: 0, fromThera: 0, orders: 0, kitsMade: 0, kitsFitted: 0, lifted: 0, lost: 0 };   // by tier
  const lostBefore = R.wrecks.reduce((a, w) => a + sum(w.items), 0) + R.hoards.reduce((a, h) => a + sum(h.items), 0);
  const poolOf = (n) => (n.key === "thera" ? R.exchange : (R.pools[n.key] ??= {}));
  const hop = (cargo, from, to, who) => (from.island === to.island ? cargo : voyage(R, cargo, from.at, to.at, ctx, m, who));
  const roomOf = (key) => { const i = L.findIndex((q) => q.key === key); if (i < 0) return Infinity; const f = socs[i].fleet, boats = f.kind === "cargo" ? f.boats : Math.max(1, Math.floor(f.boats / 3)); return boats * TRADE.HOLD * (SHIPS.trips.cargo / 12) * effect(R.state[i], "capacity"); };   // vision: a hub not of traders sends a third of its boats with cargo, a twelfth of the year's voyages a month
  const unmet = new Map(), credit = new Map(); const want = (n, id, k) => { if (k > 0.5) { const u = unmet.get(n.key) ?? unmet.set(n.key, {}).get(n.key); add(u, id, k); } };
  // 1. peoples: overflow to their city (their own materials to their cultural hub)
  const sent = L.map(() => 0), wants = L.map(() => ({}));
  L.forEach((p, i) => {
    const s = R.state[i], N = net.of.get(p.key), first = N.first, cult = N.culture, mine = materialsOf(p, socs[i].fleet), trading = socs[i].action === "trade";
    const toFirst = {}, toCult = {};
    for (const id of Object.keys(s.stock)) {
      const cap = (made[i][id] ?? 0) * (FOOD[id] ? KEEP.food : KEEP.goods), over = (s.stock[id] ?? 0) - cap; if (over <= 0) continue;
      s.stock[id] -= over;
      const over_sea = first.island !== p.island;
      if (FOOD[id] && over_sea) { led.rot += over; continue; }   // food doesn't sail
      if (over_sea && !trading && !mine.has(id)) { led.rot += over; continue; }   // a village over the sea sends only when trading
      add(cult && mine.has(id) && !FOOD[id] ? toCult : toFirst, id, over);
    }
    const a = hop(toFirst, { island: p.island, at: p }, first, p.key), c = cult ? hop(toCult, { island: p.island, at: p }, cult, p.key) : {};
    for (const [id, n] of Object.entries(a)) add(poolOf(first), id, n);
    for (const [id, n] of Object.entries(c)) add(poolOf(cult), id, n);
    sent[i] = sum(a) + sum(c); R.flows.up[0] += sum(a); R.flows.culture += sum(c);
    const k = s.built.findIndex((x) => !x); for (const [id, n] of Object.entries(s.plan[k]?.bill ?? {})) add(wants[i], id, Math.max(0, n - (s.stock[id] ?? 0)));
    for (const [id, per] of [[socs[i].fleet.stores.hull, 1], [socs[i].fleet.stores.fasten, 0.5], [socs[i].fleet.stores.sail, 0.25]]) if (id) add(wants[i], id, (socs[i].fleet.wear / 12) * per);   // vision: a month's repairs (ships.js per)
    if (s.hunger > 0 && first.island === p.island) for (const id of Object.keys(FOOD)) { add(wants[i], id, s.hunger * socs[i].folk * 2); break; }   // vision: a hungry village asks its market for food (two points a head of the shortfall)
  });
  // 2. peoples take back, count for count: their own materials from their cultural hub first, the rest from their city
  L.forEach((p, i) => {
    const s = R.state[i], N = net.of.get(p.key), mine = materialsOf(p, socs[i].fleet); let cr = N.league ? Infinity : sent[i];   // inside the Koinon goods go where they're needed
    for (const [id, n] of Object.entries(wants[i])) {
      let need = n;
      for (const src of mine.has(id) && N.culture ? [N.culture, N.first] : [N.first]) { if (cr <= 0 || need <= 0) break; const pool = poolOf(src), k = Math.min(cr, need, pool[id] ?? 0); if (k > 0) { pool[id] -= k; add(s.stock, id, k); cr -= k; need -= k; R.flows.down[0] += k; } }
      want(N.first, id, need);
    }
  });
  // 3. tier by tier: half the surplus up, and what the tier below wanted and lacked asked of the parent, count for count
  const orders = {};
  for (const tier of [TIER.city, TIER.isle, TIER.cont]) {
    for (const n of net.nodes.values()) {
      if (n.tier !== tier) continue;
      const pool = poolOf(n), parent = net.nodes.get(n.parent), up = {};
      if (n.state || n.league) continue;   // the Koinon circulates on its own (below)
      let room = n.island === parent.island ? Infinity : roomOf(n.hub);
      for (const [id, q] of Object.entries(pool)) {
        if (FOOD[id] || room <= 0 || q <= 0) continue;
        let k = q * TRADE.UP;
        if (parent.key === "thera") k = Math.min(q, (R.orders?.[id] ?? 0) + q * TRADE.TITHE);   // only the international: what other continents ordered, and a tithe
        k = Math.min(k, room); pool[id] -= k; add(up, id, k); room -= k;
      }
      const arrived = hop(up, n, parent, n.hub), got = sum(arrived);
      R.house ??= {};
      for (const [id, q] of Object.entries(arrived)) { const fee = parent.key === "thera" ? q * TRADE.BROKERAGE : 0; add(poolOf(parent), id, q - fee); add(R.house, id, fee); R.flows.brokerage = (R.flows.brokerage ?? 0) + fee; }   // the Koinon keeps the market
      R.flows.up[tier] += got; if (parent.key === "thera") R.flows.toThera += got;
      credit.set(n.key, (credit.get(n.key) ?? 0) + got); n.sent = got;
      // ask the parent for what was lacking here
      let cr = credit.get(n.key), back = {};
      for (const [id, q] of Object.entries(unmet.get(n.key) ?? {})) {
        const k = Math.min(cr, q - Math.min(q, pool[id] ?? 0), poolOf(parent)[id] ?? 0);
        if (k > 0) { poolOf(parent)[id] -= k; add(back, id, k); cr -= k; }
        const still = q - (pool[id] ?? 0) - Math.max(0, k);
        if (still > 0.5) { if (parent.key === "thera") add(orders, id, still); else want(parent, id, still); }
      }
      back = hop(back, parent, n, `${n.hub} (home)`); R.flows.down[tier] += sum(back); if (parent.key === "thera") R.flows.fromThera += sum(back);
      for (const [id, q] of Object.entries(back)) add(pool, id, q);
      if (parent.key === "thera" && got > 0) n.shippedMonth = m;
    }
  }
  R.orders = orders; R.flows.orders = sum(orders); R.net = net;
  theransMonth(R, net, hop, m);
  leagueMonth(R, net, unmet, hop, m);
  // markets rot a little
  for (const pool of Object.values(R.pools)) for (const id of Object.keys(pool)) { if (id === COIN) continue; const r = pool[id] * (FOOD[id] ? 0.5 : TRADE.MARKET_ROT);   // coin doesn't rot
    pool[id] -= r; led.rot += r; }   // vision: half the food
  // 4. the Koinon's kits
  const pres = presiding(m);
  for (const st of Lg.states) {
    const i = L.findIndex((q) => q.key === st.seat.key); if (i < 0) continue;
    const s = R.state[i], pools = [R.pools[`state:${st.k}`] ?? {}, ...Lg.states.filter((x) => x !== st).map((x) => R.pools[`state:${x.k}`] ?? {})], bill = kitBill(st.piece, st), n = mastersOf(st, m);   // its own market first, then the other states' (the Koinon circulates)
    for (let k = 0; k < n; k++) {
      const have = (id) => (s.stock[id] ?? 0) + pools.reduce((a, q) => a + (q[id] ?? 0), 0);
      if (!Object.entries(bill).every(([id, q]) => have(id) >= q)) { st.short = Object.entries(bill).filter(([id, q]) => have(id) < q).map(([id]) => id.replace("minecraft:", "")); break; }
      st.short = null;
      for (const [id, q] of Object.entries(bill)) { let r = q; r -= take(s.stock, id, r); for (const q2 of pools) { if (r <= 0) break; r -= take(q2, id, r); } }
      const kit = (R.kits[st.piece] ??= { count: 0, per: sum(bill), from: st.name }); kit.count++; R.flows.kitsMade++;
    }
  }
  // 5. fitting: a people whose goods reached Thera this month buys a kit its fleet wants
  L.forEach((p, i) => {
    const s = R.state[i]; let n = net.of.get(p.key).first; while (n && n.key !== "thera" && n.shippedMonth !== m) n = net.nodes.get(n.parent) ?? null;
    const reached = n && (n.key === "thera" ? net.of.get(p.key).first.key === "thera" : n.shippedMonth === m);   // its goods reached Thera this month, through its tiers
    if (!reached) return;
    const fleet = socs[i].fleet; s.kits ??= {}; s.fitted ??= 0;
    const want = Object.entries(PIECES).filter(([k, P]) => P.for.includes(fleet.kind) && (s.kits[k] ?? 0) < fleet.boats && R.kits[k]?.count > 0).sort((a, b) => (s.kits[a[0]] ?? 0) - (s.kits[b[0]] ?? 0))[0];
    if (!want) return;
    const kit = R.kits[want[0]], price = kit.per, goods = Object.entries(s.stock).filter(([id]) => !FOOD[id]).reduce((a, [, n]) => a + n, 0);
    if (goods < price) return;
    R.house ??= {}; let r = price; for (const id of Object.keys(s.stock)) { if (r <= 0) break; if (FOOD[id]) continue; const k = take(s.stock, id, r); add(R.house, id, k); r -= k; }   // paid in goods, into the Koinon's house at Thera
    kit.count--; s.kits[want[0]] = (s.kits[want[0]] ?? 0) + 1; s.fitted += kit.per; R.flows.kitsFitted++;
  });
  // 6. kits wear out; bells lift from wrecks; the sea takes its share of every wreck
  L.forEach((p, i) => {
    const s = R.state[i]; if (!s.kits) return;
    for (const k of Object.keys(s.kits)) { const w = s.kits[k] / LEAGUE.KIT_LIFE; s.kits[k] -= w; const items = w * (R.kits[k]?.per ?? sum(PIECES[k].bill)); s.fitted -= items; led.used += items; }
    const bells = s.kits.diving_bell ?? 0;
    if (bells > 0.5) { let lift = bells * TRADE.BELL_LIFT; for (const w of R.wrecks) { if (lift <= 0) break; if (chunkDist(p, w) > TRADE.SALVAGE_REACH) continue; for (const id of Object.keys(w.items)) { const k = Math.min(w.items[id], lift); w.items[id] -= k; add(s.stock, id, k); lift -= k; R.flows.lifted += k; } } }
  });
  for (const w of R.wrecks) for (const id of Object.keys(w.items)) { const k = w.items[id] * TRADE.WRECK_DECAY; w.items[id] -= k; led.sea += k; }
  for (const w of R.wrecks) if (sum(w.items) < 1) { led.sea += sum(w.items); w.items = {}; }   // a wreck under one item is the sea's
  R.wrecks = R.wrecks.filter((w) => sum(w.items) > 0);
  const lostAfter = R.wrecks.reduce((a, w) => a + sum(w.items), 0) + R.hoards.reduce((a, h) => a + sum(h.items), 0);
  R.flows.lost = lostAfter - lostBefore;
  return net;
}
const COIN = "minecraft:emerald";
/** The Koinon's house pays for `items` worth of goods into `to`: in coin first (an emerald for EMERALD items), then in what it holds. Returns what it couldn't pay. */
function pay(house, to, items) {
  const coin = Math.min(house[COIN] ?? 0, items / TRADE.EMERALD); if (coin > 0) { house[COIN] -= coin; add(to, COIN, coin); items -= coin * TRADE.EMERALD; }
  for (const h of Object.keys(house)) { if (items <= 0) break; if (h === COIN) continue; const t = take(house, h, items); add(to, h, t); items -= t; }
  return Math.max(0, items);
}
/** What the house can pay for, in items: its coin at its worth, and its goods. */
const purse = (house) => (house[COIN] ?? 0) * TRADE.EMERALD + Object.entries(house).filter(([id]) => id !== COIN).reduce((a, [, n]) => a + n, 0);
/** The Koinon's mint: each month it tops its house up to coin enough to buy the Therans' month (their food and timber at the emerald's worth). */
export const MINT = Math.ceil((TRADE.THERANS * EAT / (Object.values(FOOD).filter(Boolean).reduce((a, b) => a + b, 0) / Object.values(FOOD).filter(Boolean).length) + TRADE.TIMBER) / TRADE.EMERALD);   // derived: the Therans' month in coin
/** The Therans take what the city needs from the Exchange first; what it lacks, the Koinon's house buys from the continents with its reserve. */
function theransMonth(R, net, hop, m) {
  const led = R.ledger, ex = R.exchange, house = (R.house ??= {}), strike = Math.max(0, MINT - (house[COIN] ?? 0)), F = (R.flows.therans = { ate: 0, timber: 0, bought: 0, minted: strike });
  add(house, COIN, strike); led.minted = (led.minted ?? 0) + strike;   // the Koinon's tempo: it strikes coin up to a month's worth in hand, never more
  let hungry = TRADE.THERANS * EAT;   // food points a month
  const takeFood = (pool) => { for (const [id, pts] of Object.entries(FOOD)) { if (hungry <= 0 || !pts) continue; const k = take(pool, id, hungry / pts); hungry -= k * pts; led.eaten += k; F.ate += k; } };
  const takeWood = (pool, n) => { let r = n; for (const id of Object.keys(pool)) { if (r <= 0) break; if (!/_log$|_planks$/.test(id)) continue; const k = take(pool, id, r); r -= k; led.used += k; F.timber += k; } return r; };
  takeFood(ex); let wood = takeWood(ex, TRADE.TIMBER);
  if (hungry <= 0 && wood <= 0) return;
  // the house buys the rest from the continents' markets, paying from its reserve, count for count
  const markets = [...net.nodes.values()].filter((n) => n.tier >= TIER.city && n.tier <= TIER.cont && !n.state && !n.league).sort((a, b) => chunkDist(a.at, THERA_AT) - chunkDist(b.at, THERA_AT));   // the nearest markets first (food is sold where it's grown)
  for (const n of markets) {
    if (hungry <= 0 && wood <= 0) break;
    const pool = R.pools[n.key] ?? {}, buy = {}; let cr = purse(house);
    for (const [id, pts] of Object.entries(FOOD)) { if (hungry <= 0 || cr <= 0 || !pts) continue; const k = Math.min(pool[id] ?? 0, hungry / pts, cr); if (k > 0) { pool[id] -= k; add(buy, id, k); cr -= k; hungry -= k * pts; } }
    for (const id of Object.keys(pool)) { if (wood <= 0 || cr <= 0) break; if (!/_log$|_planks$/.test(id)) continue; const k = Math.min(pool[id], wood, cr); if (k > 0) { pool[id] -= k; add(buy, id, k); cr -= k; wood -= k; } }
    pay(house, pool, sum(buy));   // the house pays the market in coin
    const came = hop(buy, n, net.nodes.get("thera"), "the Koinon's house, for the Therans"); F.bought += sum(came);
    takeFood(came); takeWood(came, Infinity); for (const [id, q] of Object.entries(came)) add(ex, id, q);   // what arrived feeds them; any left stays in the Exchange
  }
  F.hungry = Math.max(0, hungry) / (TRADE.THERANS * EAT);
}
/**
 * The Koinon's month: twelve city-states, each its own market, circulating as one body.
 *   smelt      each state's furnaces work its raw iron into ingots (a coal to eight, vanilla's rate),
 *              and ingots into nuggets as its kits want them: what a kit needs, it makes
 *   circulate  what one state's market lacks (its peoples' wants, its kits' stuff) is drawn freely
 *              from the others' markets: no barter and no loss between them, one island
 *   even       first the twelve markets are levelled: every item the Koinon holds, an equal share in
 *              each state's market (one island: goods flow to where they're thin)
 *   allotment  then the Koinon's tempo: each month every state is sure of its piece's stuff for its
 *              masters' kits (twice while presiding). What its own and the others' markets can't
 *              give, the world grants: an allotment on the tempo, written on the ledger as such,
 *              so the Koinon never starves and never grows past its masters' hands
 *   the house  what all twelve together still lack, the Koinon's house at Thera buys from the
 *              Exchange, count for count from what the house holds (its kits' earnings), and ships
 *              home; the rest of the house's holdings is the Koinon's reserve
 */
function leagueMonth(R, net, unmet, hop, m) {
  const Lg = league(), led = R.ledger, pools = Lg.states.map((st) => (R.pools[`state:${st.k}`] ??= {})), I = "minecraft:iron_ingot", RAW = "minecraft:raw_iron", COAL = "minecraft:coal", NUG = "minecraft:iron_nugget";
  R.flows.league = { smelted: 0, circulated: 0, bought: 0, reserve: 0 };
  // what each state lacks: its peoples' unmet wants, and its kits' stuff
  const lack = Lg.states.map((st, k) => { const l = { ...(unmet.get(`state:${st.k}`) ?? {}) }; for (const [id, q] of Object.entries(kitBill(st.piece, st))) add(l, id, mastersOf(st, m) * q * 2 - (pools[k][id] ?? 0)); return l; });   // vision: two months' kits in hand
  pools.forEach((pool, k) => {   // smelt
    const coal = pool[COAL] ?? 0, n = Math.min(pool[RAW] ?? 0, coal * 8); if (n > 0) { pool[RAW] -= n; take(pool, COAL, n / 8); led.used += n + n / 8; add(pool, I, n); led.made += n; R.flows.league.smelted += n; }   // given: a coal smelts eight
    const nugNeed = Math.max(0, (lack[k][NUG] ?? 0) - (pool[NUG] ?? 0)), ingots = Math.min(pool[I] ?? 0, Math.ceil(nugNeed / 9)); if (ingots > 0) { pool[I] -= ingots; led.used += ingots; add(pool, NUG, ingots * 9); led.made += ingots * 9; }   // given: an ingot is nine nuggets
  });
  // level: an equal share of everything in every state's market
  const ids = new Set(pools.flatMap((q) => Object.keys(q)));
  for (const id of ids) { const tot = pools.reduce((a, q) => a + (q[id] ?? 0), 0); if (tot <= 0) continue; for (const q of pools) { R.flows.league.circulated += Math.abs((q[id] ?? 0) - tot / pools.length) / 2; q[id] = tot / pools.length; } }
  const still = {};
  lack.forEach((l, k) => {   // circulate
    for (const [id, q0] of Object.entries(l)) {
      let q = q0 - Math.min(q0, pools[k][id] ?? 0);
      for (let j = 0; j < pools.length && q > 0; j++) { if (j === k) continue; const spare = Math.max(0, (pools[j][id] ?? 0) - (lack[j][id] ?? 0)), t = Math.min(q, spare); if (t > 0) { pools[j][id] -= t; add(pools[k], id, t); q -= t; R.flows.league.circulated += t; } }
      const kit = kitBill(Lg.states[k].piece, Lg.states[k])[id];
      if (kit && q > 0) { const g = Math.min(q, kit * mastersOf(Lg.states[k], m)); add(pools[k], id, g); led.allotted = (led.allotted ?? 0) + g; R.flows.league.allotted = (R.flows.league.allotted ?? 0) + g; q -= g; }   // the tempo's allotment: a month's kits, no more
      if (q > 0.5) add(still, id, q);
    }
  });
  R.house ??= {}; const house = R.house, home = pools[presiding(m).k], hn = net.nodes.get(`state:${presiding(m).k}`);
  let cr = purse(house), buy = {};
  for (const [id, q] of Object.entries(still)) {
    if (FOOD[id]) continue;
    const k = Math.min(cr, q, R.exchange[id] ?? 0); if (k <= 0) continue;
    R.exchange[id] -= k; add(buy, id, k); cr -= k; pay(house, R.exchange, k);   // the house pays the Exchange in coin
  }
  const came = hop(buy, { island: -1, at: THERA_AT }, hn, "the Koinon's house"); for (const [id, q] of Object.entries(came)) add(home, id, q);
  R.flows.league.bought = sum(came); R.flows.league.reserve = purse(house); R.flows.league.coin = house[COIN] ?? 0; R.flows.league.lacking = Object.keys(still).map((id) => id.replace("minecraft:", ""));
  if (sum(came) > 0) net.nodes.get("league").shippedMonth = m;
}
/** A fitted piece's effect on a people's fleet: 1 with none, the piece's full effect with one a boat. */
export function effect(s, what, boats = null) {
  if (!s.kits) return 1;
  let m = 1;
  for (const [k, n] of Object.entries(s.kits)) { const e = PIECES[k].effect[what]; if (!e) continue; const f = Math.min(1, n / Math.max(1, boats ?? n)); m *= 1 + (e - 1) * f; }
  return m;
}
/** What everything at sea and in the markets holds (for the ledger). */
export function afloat(R) {
  const pools = Object.values(R.pools ?? {}).reduce((a, p) => a + sum(p), 0), wrecks = (R.wrecks ?? []).reduce((a, w) => a + sum(w.items), 0), hoards = (R.hoards ?? []).reduce((a, h) => a + sum(h.items), 0);
  const kits = Object.values(R.kits ?? {}).reduce((a, k) => a + k.count * k.per, 0), fitted = R.state.reduce((a, s) => a + (s.fitted ?? 0), 0), house = sum(R.house ?? {});
  return { pools, wrecks, hoards, kits, fitted, house, total: pools + wrecks + hoards + kits + fitted + house };
}
export { cellXZ };
