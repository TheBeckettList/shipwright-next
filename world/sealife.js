// Pure (given a loaded map). The sacred sea: its life, its reefs, and its keepers.
//
// The sea is sacred, and what keeps it is the same law that runs the world: the golden line. Its
// good years and lean years are a record driven by the pulse (cycles.js), as the peoples' are; so
// the reckoning the Therans keep in the Library, and the clerics read at their shrines on the shore,
// is the world's own math, held sacred because it is what the world runs on.
//
//   regions   the sea in squares of REGION chunks (each holding at least half sea): its depth, its
//             warmth (climate.js, with the solar rite), how much of it is shallow (lit to the floor,
//             SHALLOW blocks or less) and how much shore it has
//   habitats  from those alone: reef (warm and shallow: vanilla's warm ocean, where coral grows),
//             kelp forest (temperate and shallow), seagrass (any shallow not frozen), the deep, and
//             frozen water
//   stocks    vanilla's sea life as stocks a region holds, each with its carrying capacity from its
//             habitat (K) and its own growth (r): coral cover, kelp, seagrass; cod and salmon (the
//             cold and temperate), tropical fish and pufferfish (the reefs), squid and glow squid (the
//             deep), turtles (grazers of the seagrass), dolphins (hunters of the open water); and the
//             drowned, who gather on wrecks (trade.js), the sea's own dead
//   the month each stock grows by the logistic law, pushed by the season (the day's own warmth) and
//             the region's year in the record (the golden line: good years and lean), and is eaten by
//             what eats it: one community matrix (who eats whom) for every region, a single step of
//             x' = x + r x (1 - x / K) - (eaten) - (caught). Grazers keep the kelp and seagrass in
//             check; without turtles the seagrass smothers the reef's light
//   coral     a see-saw across the whole reef network. Water BLEACH over a reef's own mean bleaches a
//             share of its cover; if the next month runs cool, most of it recovers, else it dies, and
//             stays (vanilla's dead coral) until it crumbles to rubble. What dies (and what's grazed)
//             is owed back as spawn: it settles in packets, each on a reef picked by the golden
//             sequence by room, cool water and nearness, sometimes home, often elsewhere. Living +
//             bleached + owed is the world's coral, always: a mass bleaching is a mass regrowth to come.
//             The Sea Rite settles all that's owed; the reefs come back, not always where they were.
//             Bleaching comes with
//             the solar rite's fresh warmth, just after each year's end, is the reefs' danger, so
//             the Therans' rite is bounded by the reefs: the sea is sacred, and the warmth it can take
//             is the warmth the world gets
//   catch     a people's fishermen fish their own water (the region off their shore): their yield
//             is the economy's, times what the stock can give (its share of its capacity), and what
//             they land comes out of the stock
//   wardens   the Therans keep the balance, paid for by the sea tax: a share of every catch landed
//             goes to them. A region whose fish fall below 1/phi^2 of their capacity is closed (no
//             fishing: the stock recovers) until they are back over 1/phi; a reef bleached is replanted from the
//             tax (cover restored a step, its cost in items spent); a region left alone recovers by
//             its own law
//   the rite  at every year's end, the Sea Rite at the Temple (temple.js): the year is one breath, so
//             the pulse is back at its point, and the sea comes back with it: every stock to its
//             capacity, every reef whole, every closed water open (the Therans' end-of-year hand, as
//             the continuance is on land and the solar rite in the air)
//   clerics   vanilla's cleric (the brewing stand) is the sea's keeper: every people on the shore has
//             them, as many as its fishing and its shore ask, and their shrine stands at its
//             waterline. They read the sea's record and tell the wardens
import { GIVEN, D, VISION } from "../core/given.js";
import { PHI, FIB, golden } from "../core/golden.js";
import { chunkHeight } from "./map.js";
import { climateAt } from "./climate.js";
import { solarAt } from "./solar.js";
import { RUNGS } from "../core/clock.js";
import { worldOf, tick } from "../core/cycles.js";
import { latOf } from "../core/globe.js";

export const SEA = Object.freeze({
  REGION: FIB[7] * 3,           // vision: a region 63 chunks square (about 1000 blocks), a Fibonacci number thrice
  SHALLOW: 12,                  // vision: blocks of water the sun lights to the floor
  REEF_T: 20, KELP_T: [4, 20], FROZEN_T: 0,   // vision: vanilla's warm, temperate and frozen oceans, in C
  BLEACH: 1,                    // vision: degrees of warmth over the reef's own mean past which coral bleaches (reefs live at their own warmth; it's the excess that kills)
  BLEACH_LOSS: 1 / PHI ** 2,    // derived: the share of cover a bleaching month takes
  RECOVER: 1 / PHI,             // derived: of the bleached, the share that recovers if the next month runs cool (the rest dies)
  CRUMBLE: 1 / FIB[6],          // derived: dead coral breaks to rubble a thirteenth a month, freeing the reef
  SETTLE: 1 / PHI ** 2,         // derived: of the spawn a reef owes, the share that settles a month
  PACKETS: FIB[4],              // derived: the spawn goes out in five packets a month, each to its own reef
  REACH: FIB[3],                // derived: regions over which a packet's pull falls by e (spawn drifts, but not far)
  CLOSE: 1 / PHI ** 2,          // derived: fish below this share of capacity close the region
  OPEN: 1 / PHI,                // derived: and it reopens only once they're back over this (no flapping)
  TAX: 1 / FIB[6],              // derived: a thirteenth of every catch to the wardens
  RESTORE: 1 / FIB[5],          // derived: a replanting restores an eighth of the lost cover
  RESTORE_COST: 64,             // vision: items a replanting spends (a stack)
  CATCHABLE: 1 / FIB[4],        // derived: a fifth of a stock is in reach of a month's nets
  RECORD: 0.3,                  // vision: how far a good or lean year moves a stock's growth
});
// vision: each stock: what it lives in (its capacity per region unit of that habitat), how fast it grows a month, what it eats
export const STOCKS = {
  coral: { lives: { reef: 1 }, r: 1 / FIB[7], unit: "cover" },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  kelp: { lives: { kelp: 1 }, r: 1 / FIB[3], unit: "cover" },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  seagrass: { lives: { shallow: 1 }, r: 1 / FIB[3], unit: "cover" },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  cod: { lives: { kelp: 900, shallow: 300, open: 200 }, r: 1 / FIB[4], eats: ["kelp", "seagrass"], fish: "minecraft:cod" },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  salmon: { lives: { kelp: 500, cold: 400 }, r: 1 / FIB[4], eats: ["kelp"], fish: "minecraft:salmon" },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  tropical_fish: { lives: { reef: 1200 }, r: 1 / FIB[3], eats: ["coral"], fish: "minecraft:tropical_fish", grazes: true },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  pufferfish: { lives: { reef: 300 }, r: 1 / FIB[5], eats: ["coral"], fish: "minecraft:pufferfish" },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  squid: { lives: { deep: 600 }, r: 1 / FIB[4] },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  glow_squid: { lives: { deep: 150 }, r: 1 / FIB[5] },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  turtle: { lives: { shallow: 40 }, r: 1 / FIB[7], eats: ["seagrass"], grazes: true },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  dolphin: { lives: { open: 30, reef: 20 }, r: 1 / FIB[7], eats: ["cod", "salmon", "tropical_fish"] },   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
};
const NAMES = Object.keys(STOCKS), W = D.CELLS_W, H = D.CELLS_H ?? W / 2, RS = SEA.REGION;

let regionsCache = null;
/** The sea's regions and their habitats (from the map and the climate alone). */
export function regions() {
  if (regionsCache) return regionsCache;
  const out = [], step = FIB[3];   // derived: a region read every third chunk
  for (let rz = 0; rz * RS < H; rz++) for (let rx = 0; rx * RS < W; rx++) {
    let n = 0, sea = 0, shallow = 0, deep = 0, depth = 0, shore = 0, T = 0, Tn = 0;
    for (let z = rz * RS; z < Math.min(H, (rz + 1) * RS); z += step) for (let x = rx * RS; x < Math.min(W, (rx + 1) * RS); x += step) {
      n++; const h = chunkHeight(x, z); if (h > 0) continue;
      sea++; const d = -h * 16 / 16; depth += d; if (d <= SEA.SHALLOW) shallow++; if (d > 30) deep++;   // vision: past 30 blocks is the deep
      if ([[step, 0], [-step, 0], [0, step], [0, -step]].some(([a, b]) => chunkHeight(x + a, z + b) > 0)) shore++;
      if (sea % 4 === 1) { T += climateAt(x, z).T; Tn++; }   // vision: the warmth read in one sea cell in four
    }
    if (sea < n / 2) continue;
    const t = T / Math.max(1, Tn), lat = latOf(((rz + 0.5) * RS) * D.PX), sh = shallow / sea;
    const hab = { reef: t >= SEA.REEF_T ? sh : 0, kelp: t >= SEA.KELP_T[0] && t < SEA.KELP_T[1] ? sh : 0, shallow: t > SEA.FROZEN_T ? sh : 0, deep: deep / sea, open: 1 - sh, cold: t < SEA.KELP_T[1] && t > SEA.FROZEN_T ? 1 - sh : 0, frozen: t <= SEA.FROZEN_T ? 1 : 0 };
    const K = Object.fromEntries(NAMES.map((s) => [s, Object.entries(STOCKS[s].lives).reduce((a, [h, k]) => a + k * (hab[h] ?? 0), 0) * (1 - hab.frozen * 0.8)]));   // vision: frozen water holds a fifth
    out.push({ id: out.length, rx, rz, cx: (rx + 0.5) * RS, cz: (rz + 0.5) * RS, lat, T: t, depth: depth / sea, shallow: sh, shore: shore / sea, hab, K });
  }
  const at = new Map(out.map((r) => [`${r.rx},${r.rz}`, r]));
  return (regionsCache = { list: out, at, of: (cx, cz) => at.get(`${Math.floor(cx / RS)},${Math.floor(cz / RS)}`) ?? nearest(out, cx, cz) });
}
function nearest(list, cx, cz) { let b = null, bd = Infinity; for (const r of list) { let dx = Math.abs(r.cx - cx); dx = Math.min(dx, W - dx); const d = Math.hypot(dx, r.cz - cz); if (d < bd) { bd = d; b = r; } } return b; }

/** The sea at the start: every stock at the golden share of its capacity (a sea already fished and grazed); coral on the golden share of the reefs' ground, the rest of the ground open for spawn to settle: the world's coral is that measure, held for ever (the see-saw). */
export function seaStart() {
  const R = regions().list, P = FIB[7];   // derived: a pulse of 21 cells drives the sea's record
  const w = worldOf(P, R.map(() => 0), R.map((_, i) => i % P)); w.record[0] = 1;
  return { month: 0, regions: R.map((r) => ({ id: r.id, x: Object.fromEntries(NAMES.map((s) => [s, r.K[s] * (s === "coral" ? 1 / PHI : STOCKS[s].unit === "cover" ? 1 : 1 / PHI)])), closed: false, bleached: 0, b: 0, dead: 0, owed: 0, caught: 0 })), record: w, treasury: {}, log: [], packet: 0 };
}
/** The warmth of a region's water on day d (its year's mean, and the solar rite's sawtooth over it). */
export const waterT = (r, d) => r.T - solarAt(r.lat) + solarAt(r.lat, d);

/**
 * One month of the sea: growth (logistic, the season, the record), eating (the community matrix),
 * bleaching, the catch (demand: region id -> items wanted), the wardens (closures, replanting).
 * Returns what each region gave its fishermen: { region id -> share of the demand met }.
 */
export function seaMonth(S, m, demand, treasuryPay = null) {
  const R = regions().list, day = (m % 12) * RUNGS.month + RUNGS.month / 2, given = {};   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  for (let k = 0; k < RUNGS.month; k++) tick(S.record);   // the sea's record steps once a day
  S.log = [];
  R.forEach((r, i) => {
    const s = S.regions[i], x = s.x, year = S.record.record[i] ?? 0, season = Math.cos((2 * Math.PI * day) / RUNGS.year);   // midsummer at the year's start
    const T = waterT(r, day);
    // growth: the logistic law, the season's push (warm months grow), the record's year
    for (const n of NAMES) { const St = STOCKS[n], K = r.K[n]; if (!K || n === "coral") continue; const g = St.r * (1 + SEA.RECORD * year) * (1 + 0.25 * season); x[n] = Math.max(0, x[n] + g * x[n] * (1 - x[n] / K) + (x[n] < K * 0.01 ? K * 0.002 : 0)); }   // vision: the season's swing; a stock never quite gone (it seeds back in from the next region)
    // eating: each eater takes from its food in proportion to how many it is against its own capacity
    for (const n of NAMES) { const St = STOCKS[n]; if (!St.eats || !r.K[n]) continue; const press = x[n] / r.K[n]; for (const f of St.eats) { if (!r.K[f]) continue; const take = Math.min(x[f], x[f] * press * (STOCKS[f].unit === "cover" ? 0.02 : 0.05)); x[f] -= take; if (f === "coral") s.owed += take; } }   // vision: a month's grazing and hunting
    // without grazers the seagrass shades the reef
    if (r.K.coral && r.K.turtle && x.turtle < r.K.turtle / PHI ** 3) { const shade = x.coral * 0.01; x.coral -= shade; s.owed += shade; }   // vision: a hundredth of cover a month lost to the shade
    // the reef's month: last month's bleached recover if the water's cooled (most of them), else die; the water past
    // BLEACH bleaches more; the dead crumble, freeing the reef. What dies is owed back to the sea as spawn
    if (r.K.coral) {
      const hot = T - r.T > SEA.BLEACH;
      if (s.b > 0) { const back = hot ? 0 : s.b * SEA.RECOVER, died = s.b - back; x.coral += back; s.dead += died; s.owed += died; s.b = 0; if (died > 1e-4) S.log.push({ region: r.id, what: "coral died", cover: +died.toFixed(3) }); }   // vision: the reef's log's floor (a trace too small to note), its rounding
      if (hot) { const lost = x.coral * SEA.BLEACH_LOSS; x.coral -= lost; s.b += lost; s.bleached += lost; S.log.push({ region: r.id, what: "bleaching", T: +T.toFixed(1), lost: +lost.toFixed(3) }); }   // vision: the reef's log's floor (a trace too small to note), its rounding
      s.dead -= s.dead * SEA.CRUMBLE;
    }
    // the catch
    const want = demand[r.id] ?? 0; let got = 0;
    if (want > 0 && !s.closed) { const fishes = NAMES.filter((n) => STOCKS[n].fish && r.K[n]), can = fishes.reduce((a, n) => a + x[n] * SEA.CATCHABLE, 0), take = Math.min(want, can); for (const n of fishes) { const share = can > 0 ? (x[n] * SEA.CATCHABLE) / can : 0; x[n] -= take * share; } got = take; }
    s.caught = got; given[r.id] = want > 0 ? got / want : 1;
    // the wardens: close what's fallen low (for next month), open what's recovered; replant a bleached reef from the tax
    const fishK = NAMES.filter((n) => STOCKS[n].fish).reduce((a, n) => a + r.K[n], 0), fishX = NAMES.filter((n) => STOCKS[n].fish).reduce((a, n) => a + x[n], 0);
    const was = s.closed; s.closed = fishK > 0 && (was ? fishX < fishK * SEA.OPEN : fishX < fishK * SEA.CLOSE); if (s.closed !== was) S.log.push({ region: r.id, what: s.closed ? "closed by the wardens" : "reopened", share: +(fishX / fishK).toFixed(2) });
    if (s.owed > 0.001 && free(r, s) > 0.001 && treasuryPay && treasuryPay(SEA.RESTORE_COST)) { const back = Math.min(s.owed * SEA.RESTORE, free(r, s)); x.coral += back; s.owed -= back; s.bleached = Math.max(0, s.bleached - back); S.log.push({ region: r.id, what: "reef replanted", cover: +back.toFixed(3) }); }   // the wardens plant a reef's own spawn back where it died, where the rubble allows   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
  });
  settle(S, R, SEA.SETTLE);
  { const b = coralBook(S); S.coralLow = Math.min(S.coralLow ?? 1, b.living / b.held); S.coralSwing = Math.max(S.coralSwing ?? 0, b.owed / b.held); }   // the see-saw's lowest living share, and its most owed
  // the year's lowest: each stock's share of its capacity, the world over, at its worst month
  S.low ??= {}; for (const n of NAMES) { let x = 0, k = 0; R.forEach((r, i) => { x += S.regions[i].x[n]; k += r.K[n]; }); if (k > 0) S.low[n] = Math.min(S.low[n] ?? 1, x / k); }
  // the year's end: the Sea Rite. The year is exactly one breath (clock.js), so at its end the pulse is back at its bare
  // point: the world's math returns to where it began, and the sea with it. Every stock is given back to its capacity,
  // the bleached reefs made whole, the closed waters opened; what the sea was given back is logged
  if ((m + 1) % 12 === 0) {   // derived: the twelfth month's end is the year's
    let given2 = 0, cover = 0;
    R.forEach((r, i) => { const s = S.regions[i]; for (const n of NAMES) { if (n === "coral") continue; const back = Math.max(0, r.K[n] - s.x[n]); if (STOCKS[n].unit === "cover") cover += back; else given2 += back; s.x[n] = r.K[n]; } s.bleached = 0; s.closed = false; });
    const owedBefore = S.regions.reduce((a, s) => a + s.owed, 0); for (let k = 0; k < FIB[5] && S.regions.some((s) => s.owed > 1e-6); k++) settle(S, R, 1); cover += owedBefore - S.regions.reduce((a, s) => a + s.owed, 0);   // derived: the rite settles all the spawn owed, as many rounds as it takes (eight at most): the reefs come back, not always where they were
    const point = S.pulseAtPoint?.() ?? true;
    S.log.push({ what: "the Sea Rite", year: (m + 1) / 12, fishGivenBack: Math.round(given2), coverRestored: +cover.toFixed(2), pulseAtPoint: point });   // vision: the shade's loss a month
    S.rites = (S.rites ?? 0) + 1; S.lastRite = S.log.at(-1);
  }
  S.totals ??= {}; for (const e of S.log) S.totals[e.what] = (S.totals[e.what] ?? 0) + 1;
  S.month = m + 1;
  return given;
}
/** A reef's room for living coral: its capacity less its living, its bleached and its dead. */
function free(r, s) { return Math.max(0, r.K.coral - s.x.coral - s.b - s.dead); }
/**
 * The see-saw: every reef owing spawn sends `share` of it out in PACKETS, each to one reef picked by the golden
 * sequence over every reef's pull: its room, its water cool (not bleaching), its nearness (falling by e every REACH
 * regions). Sometimes the reef it came from (once its dead have crumbled), often a neighbour, now and then far off.
 * A packet that finds no room anywhere stays owed. Living + bleached + owed is the world's coral, always.
 */
function settle(S, R, share) {
  const reefs = R.filter((r) => r.K.coral > 0), W2 = D.CELLS_W / RS;
  for (const src of reefs) {
    const s = S.regions[src.id]; if (s.owed < 1e-6) continue;   // vision: the reef's log's floor (a trace too small to note), its rounding
    const out = s.owed * share, packet = out / SEA.PACKETS; let sent = 0;
    for (let k = 0; k < SEA.PACKETS; k++) {
      const pull = reefs.map((r) => { const t = S.regions[r.id], dx = Math.min(Math.abs(r.rx - src.rx), W2 - Math.abs(r.rx - src.rx)), d = Math.hypot(dx, r.rz - src.rz); return Math.min(free(r, t), packet) * Math.exp(-d / SEA.REACH) * (t.b > 0 ? 0 : 1); });
      const tot = pull.reduce((a, b) => a + b, 0); if (tot <= 0) break;
      let u = golden(S.packet++) * tot, j = 0; while (j < pull.length - 1 && u >= pull[j]) { u -= pull[j]; j++; }
      const t = S.regions[reefs[j].id], put = Math.min(packet, free(reefs[j], t)); t.x.coral += put; sent += put;
      if (reefs[j].id !== src.id && put > 1e-4) S.log.push({ region: reefs[j].id, what: "coral settled from elsewhere", from: src.id, cover: +put.toFixed(4) });   // vision: the reef's log's floor (a trace too small to note), its rounding
      else if (put > 1e-4) S.log.push({ region: src.id, what: "coral regrew at home", cover: +put.toFixed(4) });   // vision: the reef's log's floor (a trace too small to note), its rounding
    }
    s.owed -= sent;
  }
}
/** The world's coral, in its parts: living, bleached, dead (rubble-to-be), owed (spawn not yet settled); living + bleached + owed is held. */
export function coralBook(S) { const out = { living: 0, bleached: 0, dead: 0, owed: 0, K: 0 }; const R = regions().list; S.regions.forEach((s, i) => { out.living += s.x.coral; out.bleached += s.b; out.dead += s.dead; out.owed += s.owed; out.K += R[i].K.coral; }); out.held = out.living + out.bleached + out.owed; return out; }
/** Whether a chunk's reef is dead coral (vanilla's dead coral blocks): the same sequence against the dead's share. */
export const deadCoralAt = (S, cx, cz) => { const r = regions().of(cx, cz), s = r && S.regions[r.id]; if (!s || !r.K.coral || -chunkHeight(cx, cz) > SEA.SHALLOW) return false; const g = golden(cx * FIB[8] + cz * FIB[9]), live = s.x.coral / r.K.coral, dead = s.dead / r.K.coral; return g >= live && g < live + dead; };   // vision: the reef's log's floor (a trace too small to note), its rounding
/** The sea's state in sum: stocks against capacity, coral, closures. */
export function seaSummary(S) {
  const R = regions().list, tot = Object.fromEntries(NAMES.map((n) => [n, { x: 0, K: 0 }]));
  S.regions.forEach((s, i) => { for (const n of NAMES) { tot[n].x += s.x[n]; tot[n].K += R[i].K[n]; } });
  const hab = { reef: 0, kelp: 0, shallow: 0, deep: 0, frozen: 0 }; for (const r of R) for (const h of Object.keys(hab)) if (r.hab[h] > 0.2) hab[h]++;   // vision: a region counts for a habitat past a fifth of it
  return { regions: R.length, hab, stocks: tot, closed: S.regions.filter((s) => s.closed).length, bleached: S.regions.filter((s) => s.bleached > 0.001).length };   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
}
/** A people's clerics: the sea's keepers, as many as its fishing and its shore ask. */
export const clericsOf = (p) => (p.coast?.length ? Math.max(1, Math.round(p.coast.length / FIB[6])) : 0);   // derived: one for every thirteen chunks of shore, at least one
/** Whether coral grows in a chunk of a region (for the world's blocks): the golden sequence of the chunk against the region's cover. */
export const coralAt = (S, cx, cz) => { const r = regions().of(cx, cz), s = r && S.regions[r.id]; return !!s && r.K.coral > 0 && -chunkHeight(cx, cz) <= SEA.SHALLOW && golden(cx * FIB[8] + cz * FIB[9]) < s.x.coral / Math.max(1e-9, r.K.coral) * r.hab.reef; };   // vision: the stock's capacity a region of its habitat, its growth a month (Fibonacci reciprocals), what it eats
export { NAMES as SPECIES };
