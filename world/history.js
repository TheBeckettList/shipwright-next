// Pure (given a loaded map). The living world: the peoples on the two-layer engine (core/cycles.js).
//
//   the loop    every people, in sailing order: a tour that starts at Thera's nearest neighbour and
//               always sails to the nearest people not yet visited, closed on itself with a Mobius
//               seam, so the world's end links with its beginning. Loop neighbours are sea
//               neighbours: the borders that can flex are the ones ships actually cross
//   realms      the loop is cut into REALMS runs of neighbouring peoples (YEAR_DAYS / 2 = 180,
//               about three peoples each): the pulse has a cell a realm, so it breathes in exactly
//               360 days, a year (core/clock.js). Each people keeps its own record cell, driven by
//               its realm's pulse: a realm's peoples feel the same tide of fortune, each its own way
//   the day     one step of the record a day (a Minecraft day, 24,000 ticks); the world re-bakes every month
//               (30 days), the Therans hold it to its bounds every year (360 days, 120 hours of play)
//   fortune     each people's record trit: +1 rising, 0 steady, -1 waning
//   borders     between loop neighbours, the border leans toward the waning side by (fortune
//               difference) x FLEX / 2 chunks: never more than FLEX either way, never past a
//               neighbour. It flexes where fortunes differ, and settles where they agree
//   conflict    a border is contested where the fortunes are opposite (+1 against -1) and either
//               side's temper runs hot (raiders, wary); trading where both are calm and close in fortune
//   temper      a waning people grows hungrier, a rising one calmer: the base temper moves by
//               TEMPER_FLEX against its fortune, within its bounds
//   Thera       each tradition's share of the bay's quarters swells or shrinks with its peoples'
//               mean fortune, by QUARTER_FLEX at most, re-baked at every era's end
//   eras        at each breath's end the world is re-baked with the change accounted for: borders,
//               tempers, quarters. The record carries on into the next era; nothing is lost, and any
//               tick can be run back exactly
import { VISION, GIVEN, D } from "../core/given.js";
import { greatCircle } from "../core/globe.js";
import { RUNGS, YEAR_DAYS } from "../core/clock.js";
import { worldOf, tick, untick, atPoint, balance } from "../core/cycles.js";
import { peoples } from "./peoples.js";
import { THERA } from "./thera.js";

export const REALMS = YEAR_DAYS / 2;                   // derived: a pulse of 180 cells breathes in 360 days
export const HISTORY = Object.freeze({
  FLEX: 3,                // vision: chunks a border may lean either way
  TEMPER_FLEX: 0.12,      // vision: how far fortune moves a temper's score
  QUARTER_FLEX: 0.3,      // vision: how far fortune swells or shrinks a tradition's share of Thera's quarters
});

let loopCache = null;
/** The peoples in sailing order (even count: the loop needs pairs; an odd one out waits for the next era's growth). */
export function loop() {
  if (loopCache) return loopCache;
  const P = peoples().list, C = D.PX;
  const at = (p) => ({ x: p.cx * C, z: p.cz * C }), home = { x: THERA.seat.cx * C, z: THERA.seat.cz * C };
  const left = new Set(P.map((_, i) => i)), order = [];
  let here = home;
  while (left.size) {
    let best = -1, bd = Infinity;
    for (const i of left) { const d = greatCircle(here, at(P[i])); if (d < bd) { bd = d; best = i; } }
    order.push(P[best]); left.delete(best); here = at(P[best]);
  }
  loopCache = order.length % 2 ? order.slice(0, -1) : order;
  return loopCache;
}

/**
 * The first day's record: each people's fortune from its own ground, so the world doesn't move in
 * step. By terciles of richness (food a chunk): the richest third rising, the poorest waning.
 */
export function firstRecord() {
  const L = loop(), r = L.map((p) => p.richness).sort((a, b) => a - b);
  const lo = r[Math.floor(r.length / 3)], hi = r[Math.floor((2 * r.length) / 3)];   // vision: terciles
  return L.map((p) => (p.richness >= hi ? 1 : p.richness < lo ? -1 : 0));
}
/** Which realm (pulse cell) drives each people's record cell: the loop cut into REALMS even runs. */
export const realmOf = () => loop().map((_, i) => Math.floor((i * REALMS) / loop().length));
export const firstWorld = () => worldOf(REALMS, firstRecord(), realmOf());

/** The world's state at culture tick n (from the first day), stepped from the start (cheap: L trits a tick). */
export function historyAt(n, w = null) {
  w ??= firstWorld();
  while (w.t < n) tick(w);
  while (w.t > n) untick(w);
  return w;
}
/** Which year culture day n falls in, and how far into it. */
export const yearOf = (n) => ({ year: Math.floor(n / YEAR_DAYS), day: n % YEAR_DAYS, length: YEAR_DAYS, minutes: (YEAR_DAYS * RUNGS.day) / GIVEN.TICKS_PER_S / 60 });   // given: sixty seconds a minute

/** What the record means for the peoples now: fortunes, borders, conflicts, tempers, Thera's quarter weights. */
export function bake(w) {
  const L = loop(), f = w.record, H = HISTORY;
  const borders = [], tempers = new Map();
  for (let i = 0; i < L.length; i++) {
    const j = (i + 1) % L.length, a = L[i], b = L[j];
    const fb = j === 0 ? -f[j] : f[j];   // the Mobius seam: the far side sees the first people's fortune turned over
    const lean = ((f[i] - fb) * H.FLEX) / 2;   // + leans the border into b's ground
    const hot = (p) => p.temper === "raiders" || p.temper === "wary";
    const state = Math.abs(f[i] - fb) === 2 && (hot(a) || hot(b)) ? "contested" : Math.abs(f[i] - fb) <= 1 && !hot(a) && !hot(b) ? "trading" : "quiet";
    borders.push({ a: a.key, b: b.key, lean, state });
  }
  L.forEach((p, i) => {
    const score = p.temperScore - H.TEMPER_FLEX * f[i];
    tempers.set(p.key, score > 0.15 ? "raiders" : score > 0 ? "wary" : score > -0.2 ? "peaceful" : "traders");   // vision: the temper's bands (as peoples.js)
  });
  const byTrad = {};
  L.forEach((p, i) => { (byTrad[p.tradition] ??= []).push(f[i]); });
  const quarters = Object.fromEntries(Object.entries(byTrad).map(([k, v]) => [k, +(1 + H.QUARTER_FLEX * (v.reduce((a, b) => a + b, 0) / v.length)).toFixed(3)]));   // vision: the bands, as peoples.js
  return { borders, tempers, quarters, balance: balance(f), atEraEnd: atPoint(w) };
}
