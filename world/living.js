// Pure. The living town: its people as records on its reaction chain, where each is at any tick, and which of them
// stand as bodies (the civ villagers: each people's own folk, in their own dress and their role's). The sim is what a
// player walks through; a body is the sim seen, and does only what the math says.
//
//   the chain   a town is a compound grown by synthesis (world/chem.js): its homes in the order they rose. Its people
//               are N = HOUSEHOLD x the homes standing, and N lives inside its chain's bounds: never under the core's
//               households, never past the homes built (the site's capacity). Every change to N is a reaction on that
//               chain: a birth adds a person to the household the chain fills next, a death takes one from the
//               household the chain empties first (the last to rise is the first to fall). So the town is always a
//               prefix of its chain, and every move has its reverse in the chain: reversibility keeps the town in
//               its bounds, never outside them
//   the acts    a player's act (a death, a gift of people: a rescue at sea, a settler brought) is a move on the chain
//               too, held in the town's journal as a count. The day's step settles it back toward the chain's own
//               level at the chain's own rate (a household a rising month, buildings.js), so a town struck by a
//               player heals as a town does, never past its bounds
//   who         person k of N lives in household floor(k / HOUSEHOLD) of the chain; a household's first is its elder,
//               the rest by the census's ranks; each holds a job from the town's work buildings, dealt in turn
//   where       folk.js deals N into places by the part of the sky's day (home, work, docks, market, at sea, gone to
//               Thera); who goes where is a golden permutation of the people, turned once a day. Each place has its
//               spots (a home's beds and hearth, a workshop's bench, the quay's bollards, the market's stalls); a
//               person stands at their own. When the part turns, those who change place walk the lanes, leaving
//               spread over the turn's first beat by their seed, at a walker's pace: p(person, t) is a closed form
//   bodies      a player sees B of them: the spots in sight share B by their counts to the 1/phi (busy places busy,
//               quiet ones never empty), each spot's shown the first by hash(person, day). A body keeps its person
//               while chosen; nothing about a person changes when their body comes or goes
import { FIB, PHI } from "../core/golden.js";
import { RUNGS, when, PART_HOURS } from "../core/clock.js";
import { hashAt } from "../core/noise.js";
import { deal, whereAt, DRESS } from "./folk.js";
import { HOUSEHOLD, TYPES } from "./census.js";

export const BODIES = FIB[7];   // derived: twenty-one bodies a player (a Switch draws them beside a town)
export const PACE = 1 / FIB[6];   // derived: a walker's thirteenth of a block a tick (a block and a half a second)
export const HOLD = FIB[3];   // derived: a body keeps its person three beats after it's last chosen
export const PLACES = ["home", "work", "docks", "market", "sea", "thera"];
const AWAY = new Set(["sea", "thera"]);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** The golden stride for n: n / phi, nudged to share no factor with n (so the turn is a permutation). */
export function stride(n) { let g = Math.max(1, Math.round(n / PHI)); while (n > 1 && gcd(g, n) !== 1) g++; return g; }

// ---- the chain
/** A town's chain: its homes in the order they rose, its bounds in people. core: homes no history takes away. */
export function chainOf(placed, { core = FIB[2] } = {}) {
  const homes = placed.map((p, i) => ({ p, i })).filter(({ p }) => p.atom?.home ?? TYPES[p.id]?.kind === "home");   // the placement order is the synthesis order
  return { homes, min: Math.min(homes.length, core) * HOUSEHOLD, max: homes.length * HOUSEHOLD };
}
/** People at a level (households standing) and a journal (net acts: deaths minus arrivals), inside the chain's bounds. */
export const peopleOf = (chain, standing, journal = 0) => Math.max(chain.min, Math.min(chain.max, Math.min(standing, chain.homes.length) * HOUSEHOLD - journal));
/** The day's step settles the journal toward zero by the chain's own rate: a household a step at most. */
export const settle = (journal) => (journal > 0 ? Math.max(0, journal - HOUSEHOLD) : Math.min(0, journal + HOUSEHOLD));
// (the settle forgets how far a journal was from zero once it reaches it, so the day's record keeps each day's journal,
// as history.js keeps every day's record: running the world back reads it, and every state on the way is in bounds)

// ---- the people
/** Person k: their household, their home on the chain, their rank, their job. jobs: [{ building index, slots }]. */
export function personOf(k, chain, jobs, N) {
  const h = Math.floor(k / HOUSEHOLD), home = chain.homes[h % Math.max(1, chain.homes.length)], rank = k % HOUSEHOLD === 0 ? "elder" : k % HOUSEHOLD === 1 ? "crafter" : "folk";
  let r = (k * stride(Math.max(1, N))) % Math.max(1, N), job = null;   // the jobs dealt by the golden stride: the first S of the turned people hold the S stations
  for (const j of jobs) { if (r < j.slots) { job = j; break; } r -= j.slots; }
  return { k, household: h, home: home?.i ?? 0, rank, work: job?.i ?? null };
}
/** The town's jobs: each work, trade, harbour or faith building's stations (its rooms, a worker each). */
export function jobsOf(placed) {
  const out = []; placed.forEach((p, i) => { const k = TYPES[p.id]?.kind; if (!k || k === "home" || k === "civic" && p.id === "well") return; const rooms = (p.b?.formula ?? []).filter((s) => s !== "B" && s !== "Be"); out.push({ i, slots: Math.max(1, rooms.length), kind: k, id: p.id }); });
  return out;
}

// ---- where
/** Who is in which place at tick t: N dealt by folk.js, the people turned by the day's golden stride. */
export function placesAt(p, soc, N, t) {
  const w = whereAt(p, { ...soc, folk: N }, t), day = Math.floor(t / RUNGS.day), g = stride(Math.max(1, N)), out = Object.fromEntries(PLACES.map((q) => [q, []]));
  const order = PLACES.flatMap((q) => Array(w[q] ?? 0).fill(q));
  for (let j = 0; j < N; j++) { const k = (j * g + day * FIB[5]) % N; out[order.at(j) ?? "home"].push(k); }   // derived: the turn moves eight a day
  return { by: out, when: w.when, counts: Object.fromEntries(PLACES.map((q) => [q, out[q].length])) };
}
/** The place each person is in at tick t (inverse of placesAt). */
export function placeOfPerson(byPlace) { const m = new Map(); for (const [q, ks] of Object.entries(byPlace)) for (const k of ks) m.set(k, q); return m; }
/** The tick the current part of the sky's day began: the last of the parts' hours (clock.js when: 23 dawn, 1 morning, 6 afternoon, 11 dusk, 13 night) at or before t. */   // given: the parts' hours, as clock.js has them
export function partTurn(t) {
  const sky = RUNGS.sky, hour = sky / 24, d0 = Math.floor(t / sky) * sky, h = (t - d0) / hour;   // given: a day's twenty-four hours
  const last = [...PART_HOURS].reverse().find((x) => x <= h);
  return Math.round(last != null ? d0 + last * hour : d0 - sky + PART_HOURS.at(-1) * hour);
}

// ---- spots and walks
/** A person's spot in a place: a point (x, z) in the town's frame, from their home, work, the quay or the market. */
export function spotOf(person, place, town) {
  const P = town.placed, at = (i, k) => { const q = P[i]; if (!q) return { x: 0, z: 0 }; const w = (q.k % 2 ? q.atom.l : q.atom.w) - 2, l = (q.k % 2 ? q.atom.w : q.atom.l) - 2, n = Math.max(1, Math.floor(Math.max(1, w) * Math.max(1, l) / FIB[4])), s = k % n; return { x: Math.round(q.x - w / 2 + 1 + (s * FIB[3]) % Math.max(1, w)), z: Math.round(q.z - l / 2 + 1 + Math.floor((s * FIB[3]) / Math.max(1, w)) % Math.max(1, l)) }; };   // derived: a spot to each five blocks of floor, three apart
  if (place === "home") return at(person.home, person.k % HOUSEHOLD);
  if (place === "work") return person.work != null ? at(person.work, person.k) : at(town.fields ?? person.home, person.k);
  if (place === "docks") return at(town.quay ?? 0, person.k);
  if (place === "market") return at(town.market ?? 0, person.k);
  return null;   // away: at sea, at Thera
}
/** Where a person stands at tick t: their spot, or on their way to it from where they were, or away. */
export function positionAt(person, town, t, ctx) {
  const turn = partTurn(t), nowPlace = ctx.placeNow.get(person.k), prevPlace = ctx.placePrev.get(person.k);
  const to = AWAY.has(nowPlace) ? null : spotOf(person, nowPlace, town), from = AWAY.has(prevPlace) ? null : spotOf(person, prevPlace, town);
  if (!to) return { away: nowPlace };
  if (!from || nowPlace === prevPlace) return { ...to, place: nowPlace, walking: false };
  const leave = turn + Math.floor(hashAt(person.k, 0, FIB[7]) * RUNGS.beat), d = Math.hypot(to.x - from.x, to.z - from.z), s = Math.max(0, Math.min(d, (t - leave) * PACE));   // derived (a Fibonacci rung): the walk, left spread over the turn's first beat
  if (s >= d) return { ...to, place: nowPlace, walking: false };
  const u = d ? s / d : 1; return { x: from.x + (to.x - from.x) * u, z: from.z + (to.z - from.z) * u, place: nowPlace, walking: s > 0, from: prevPlace };
}
/** Everything a town's people do at tick t: { N, counts, persons, at(k) }. */
export function townAt(town, p, soc, t, { standing = null, journal = 0 } = {}) {
  const chain = town.chain ?? chainOf(town.placed), N = peopleOf(chain, standing ?? chain.homes.length, journal), jobs = town.jobs ?? jobsOf(town.placed);
  const now = placesAt(p, soc, N, t), prev = placesAt(p, soc, N, partTurn(t) - 1), ctx = { placeNow: placeOfPerson(now.by), placePrev: placeOfPerson(prev.by) };
  const persons = Array.from({ length: N }, (_, k) => personOf(k, chain, jobs, N));
  return { N, counts: now.counts, part: now.when.part, persons, at: (k) => positionAt(persons[k], town, t, ctx), chain };
}

// ---- bodies
/** Which persons stand as bodies for a player at (x, z): spots in sight share B by count^(1/phi), the first of each by hash. */
export function shownAt(T, t, { x = 0, z = 0, sight = FIB[8] * FIB[2], B = BODIES } = {}) {   // derived: the living's own measure (a Fibonacci rung)
  const day = Math.floor(t / RUNGS.day), groups = new Map();
  for (let k = 0; k < T.N; k++) { const q = T.at(k); if (q.away || Math.hypot(q.x - x, q.z - z) > sight) continue; const key = q.walking ? "lanes" : `${q.place}:${Math.round(q.x / FIB[5])},${Math.round(q.z / FIB[5])}`; (groups.get(key) ?? groups.set(key, []).get(key)).push({ k, q }); }   // derived: a spot an eight-block cell of its place; the walkers one group
  const keys = [...groups.keys()], share = deal(Math.min(B, [...groups.values()].reduce((a, g) => a + g.length, 0)), Object.fromEntries(keys.map((k) => [k, groups.get(k).length ** (1 / PHI)])));
  const out = []; for (const key of keys) { const g = groups.get(key).sort((a, b) => hashAt(a.k, day, FIB[8]) - hashAt(b.k, day, FIB[8])); out.push(...g.slice(0, Math.min(g.length, share[key] ?? 0)).map((e) => ({ ...e, group: key }))); }   // derived: the living's own measure (a Fibonacci rung)
  return out;
}
/** The civ villager a person shows as: their people's dress, their rank's skin slot (dress.js RANKS), their role. */
export const looksOf = (person, tradition, role) => ({ dress: DRESS[tradition], slot: person.rank === "elder" ? 7 : person.rank === "crafter" ? 6 : person.k % FIB[4], role });   // given: the eight skins' slots (four everyday, cleric, guard, crafter, elder)
