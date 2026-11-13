// Pure. The folk: one pool of catch-all people a people, who go where the hour, the season and their
// people's doings send them, and who take whatever role and dress the town needs when a player is
// there to see. No villager is stepped: where everyone is, and who they are, is a closed form of the
// clock (core/clock.js), so a town far away costs nothing and is right the moment someone arrives.
//
//   where     each place (home, work, the docks, the market, at sea, gone to Thera) has a weight
//             from the part of the day, the living's way, the season's warmth and the people's
//             action this year; the folk are dealt out in proportion (largest remainder, so the
//             counts are whole and always add up to the folk)
//   who       the town's roles (society.js professions) make a roster of exactly the folk; each day
//             (and each time a player comes into town) the roster turns by a golden stride, a
//             permutation, so every role is always filled while each person takes a different one:
//             fresh every visit, the counts never change
//   dress     the people's own clothes (its vanilla villager type) and the role's
//   the hub   Thera's bay holds whoever the peoples have sent: its crowd swells in the sailing
//             season and by day, and its quarters fill by tradition (the travelling mass)
import { when, RUNGS } from "../core/clock.js";

// vision: the day's weights by part, for a people that lives ashore; the living and the season move them
export const DAY = {
  dawn: { home: 0.35, work: 0.25, docks: 0.25, market: 0.05, sea: 0.1, thera: 0 },   // vision: the part of the day's weights
  morning: { home: 0.1, work: 0.5, docks: 0.1, market: 0.1, sea: 0.15, thera: 0.05 },   // vision: the part of the day's weights
  afternoon: { home: 0.1, work: 0.35, docks: 0.15, market: 0.2, sea: 0.15, thera: 0.05 },   // vision: the part of the day's weights
  dusk: { home: 0.4, work: 0.1, docks: 0.15, market: 0.25, sea: 0.05, thera: 0.05 },   // vision: the part of the day's weights
  night: { home: 0.85, work: 0, docks: 0.05, market: 0.05, sea: 0.05, thera: 0 },   // vision: the part of the day's weights
};
export const FOLK = Object.freeze({
  SEA_SEASON: 0.5,        // vision: how much summer swells (and winter shrinks) the folk at sea and gone to Thera
  HEARTH: 0.3,            // vision: how much winter fills the homes
  WAY: { fishers: { sea: 2, work: 0.5 }, farmers: { work: 1.5, sea: 0.4 }, herders: { work: 1.5, sea: 0.3 } },   // vision: the living's pull
  ACT: { trade: { thera: 3, sea: 1.5, market: 1.5 }, raid: { sea: 2 }, build: { work: 1.5 }, defend: { home: 1.5, docks: 1.5 } },   // vision: the year's action's pull
});
/** Vanilla villagers' types (their clothes) by tradition. */
export const DRESS = { norse: "taiga", european: "plains", birchbark: "taiga", pacific: "jungle", indian_ocean: "desert", east_asian: "savanna", japanese: "plains", dugout: "taiga", shallow: "swamp", arctic: "snow", therans: "plains" };

/** Whole numbers in proportion to weights, adding up to n exactly (largest remainder). */
export function deal(n, weights) {
  const keys = Object.keys(weights), sum = keys.reduce((a, k) => a + weights[k], 0) || 1;
  const raw = keys.map((k) => (n * weights[k]) / sum), out = Object.fromEntries(keys.map((k, i) => [k, Math.floor(raw[i])]));
  let left = n - keys.reduce((a, k) => a + out[k], 0);
  keys.map((k, i) => [k, raw[i] - Math.floor(raw[i])]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, left).forEach(([k]) => out[k]++);
  return out;
}
/** Where a people's folk are at tick t. soc: societyOf (folk, action). */
export function whereAt(p, soc, t) {
  const c = when(t), F = FOLK, w = { ...DAY[c.part] };
  for (const [k, m] of Object.entries(F.WAY[p.living] ?? {})) w[k] *= m;
  for (const [k, m] of Object.entries(F.ACT[soc.action] ?? {})) w[k] *= m;
  w.sea *= 1 + F.SEA_SEASON * c.warmth; w.thera *= 1 + F.SEA_SEASON * c.warmth; w.home *= 1 - F.HEARTH * c.warmth;
  if (soc.action === "raid" && c.part !== "night") w.sea *= 0.5;   // vision: raiders sail by night
  return { ...deal(soc.folk, w), when: c };
}
/**
 * Who is who at tick t: the roster turned by a golden stride (a permutation) once a sky day, and once
 * more for every time a player has come into town (visits): a villager keeps a role for its day, and
 * a returning visitor finds the town rearranged. Every role is always filled.
 */
export function rosterAt(soc, t, tradition, visits = 0) {
  const roles = [];
  for (const [role, n] of Object.entries(soc.professions)) for (let k = 0; k < n; k++) roles.push(role);
  while (roles.length < soc.folk) roles.push("folk");
  roles.length = soc.folk;
  const n = roles.length, turn = Math.floor(t / RUNGS.sky) + visits;
  let g = Math.max(1, Math.round(n / ((1 + Math.sqrt(5)) / 2)));   // given: the golden ratio
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  while (n > 1 && gcd(g, n) !== 1) g++;
  return Array.from({ length: n }, (_, k) => ({ id: k, role: roles[(k + turn * g) % n], dress: DRESS[tradition] }));
}
/** Thera's crowd at tick t: the folk every people has sent, by tradition. */
export function theraCrowd(list, socs, t) {
  const by = {};
  list.forEach((p, i) => { const n = whereAt(p, socs[i], t).thera; if (n) by[p.tradition] = (by[p.tradition] ?? 0) + n; });
  return by;
}
