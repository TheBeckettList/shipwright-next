// Pure (given a loaded map). The world's settlements as boxes: every people's population, its
// settlement's tier, and its town laid out as standard boxes bound by standard dimensions, to be
// refined into rooms and blocks later (rooms.js, dwelling.js, chem.js). Fast enough for the whole
// world at once.
//
//   population  what its food feeds (capacity times the jobs' folk a unit), and for a market town
//               a share of every village that sells to it (people come to the market: a city draws
//               1/phi^3 of its villages, a continental hub 1/phi^2 of its cities'): a city is made by
//               its market, not just its ground
//   tiers       by population, at Fibonacci numbers: camp, hamlet (34), village (144), town (610),
//               city (2584). The Koinon's twelve and Thera are what they are
//   binding     standard dimensions, all Fibonacci blocks: paths 1, lanes 2, streets 3, main streets
//               5, avenues 8; a setback of 1 from the lane; the gap between houses the culture's
//               spread (0 a party wall, then 1, 2, 3, 5); plazas 8 (a quarter's), 13 (a
//               district's), 21 (a city's)
//   boxes       every element a standard box (Fibonacci sides): the house the culture's own law's
//               footprint (dwelling.js), rounded up to the next Fibonacci sides; the well, the bell,
//               the oven, the shrine, the granary, the boathouse, the workshop, the warehouse, the
//               hall, the temple, the market, the pier
//   quarters    thirteen households round their quarter's plaza (its well and bell), bonded by the
//               culture's roundness: a ring where it builds round, two rows facing a street where it
//               builds square, staggered between
//               where the ground runs out, quarters densify (oldest first): a storey more, 13
//               households to 21, then 34
//   districts   eight quarters (a Fibonacci number) round a district's plaza and its shrine or temple
//   the town    quarters placed out from the heart (the hall and the market on the city's plaza)
//               in sunflower order, each on the nearest dry, gentle ground; the docks on the
//               waterline nearest the heart; main streets from the heart to every district plaza and
//               to the docks. Each box records its ground: level, or the footing it needs
import { PHI, FIB, GOLDEN_ANGLE, golden } from "../core/golden.js";
import { GIVEN, D } from "../core/given.js";
import { blockHeight } from "./map.js";
import { peoples } from "./peoples.js";
import { SOCIETY } from "./society.js";
import { FORM, ROUNDNESS, houseOf } from "./dwelling.js";
import { FORM as LAYOUT_FORM } from "./settlement.js";
import { HOUSEHOLD, CHEM, footing } from "./chem.js";
import { network } from "./trade.js";
import { league } from "./league.js";
import { quarterSeeds } from "./city.js";
import { THERA } from "./thera.js";
import { TRADE } from "./trade.js";
import { coldHouse, COLD } from "./coldhouse.js";
import { seaRiteTemple, TEMPLE } from "./temple.js";
import { TEMPLE_EVERY } from "./faith.js";

export const BIND = Object.freeze({
  ROAD: { path: FIB[1], lane: FIB[2], street: FIB[3], main: FIB[4], avenue: FIB[5] },   // derived: Fibonacci widths
  SETBACK: FIB[1], GAP: [0, FIB[1], FIB[2], FIB[3], FIB[4]],   // derived: the culture's spread as a Fibonacci gap
  PLAZA: { quarter: FIB[5], district: FIB[6], city: FIB[7] },   // derived: 8, 13, 21
  DISTRICT: FIB[5],          // derived: quarters a district
  TIERS: [[0, "camp"], [34, "hamlet"], [144, "village"], [610, "town"], [2584, "city"]],   // derived: the Fibonacci numbers F9, F12, F15, F18
});
export const BOX = Object.freeze({ well: [3, 3], bell: [1, 1], oven: [3, 3], shrine: [3, 5], granary: [5, 8], boathouse: [5, 8], workshop: [5, 8], warehouse: [8, 13], hall: [13, 21], temple: [13, 21], market: [21, 21], pier: [3, 13] });   // derived: Fibonacci boxes
const fibUp = (n) => FIB.find((f) => f >= n) ?? n;
const C = D.PX;   // blocks a map cell

let houseBoxes = new Map();
/** A culture's house box: its law's footprint for a full household, Fibonacci-rounded. */
export function houseBox(p) {
  const key = p.tradition; if (houseBoxes.has(key)) return houseBoxes.get(key);
  const law = FORM[p.tradition]?.form ?? "twocell", h = houseOf(p, { n: HOUSEHOLD[law] ?? 5, job: "fisherman" });   // vision: the boxes' own layout (blocks), to refine
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const k of h.vox.keys()) { const [x, , z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const w = x1 - x0 + 1, l = z1 - z0 + 1, box = [fibUp(Math.min(w, l)), fibUp(Math.max(w, l))];
  houseBoxes.set(key, box); return box;
}

/** Every people's population, tier and market: { key -> { pop, own, drawn, tier, hub } }. */
export function populations() {
  const P = peoples().list, net = network(), own = new Map(P.map((p) => [p.key, Math.round(p.capacity * SOCIETY.POP_PER)])), drawn = new Map(), Lg = league();
  // villages feed their city a share, cities their continental hub a share (one pass up the tiers)
  for (const p of P) { const n = net.of.get(p.key).first; if (n.hub !== p.key && n.hub !== "thera") drawn.set(n.hub, (drawn.get(n.hub) ?? 0) + own.get(p.key) / PHI ** 3); }   // derived: a village sends a phi^-3 share to its market
  for (const n of net.nodes.values()) { if (n.tier !== 3 || n.league) continue; for (const m of net.nodes.values()) if (m.parent === n.key && m.hub !== n.hub) drawn.set(n.hub, (drawn.get(n.hub) ?? 0) + ((own.get(m.hub) ?? 0) + (drawn.get(m.hub) ?? 0)) / PHI ** 2); }   // derived: a city a phi^-2 share to its continent's hub
  const out = new Map();
  for (const p of P) {
    const o = own.get(p.key), d = Math.round(drawn.get(p.key) ?? 0), pop = o + d, st = Lg.byPeople.get(p.key);
    const tier = st ? (st.seat === p ? "city-state" : "village") : [...BIND.TIERS].reverse().find(([t]) => pop >= t)[1];
    out.set(p.key, { pop, own: o, drawn: d, tier, hub: net.of.get(p.key).first.hub, state: st?.name });
  }
  return out;
}

const ground = (x, z) => blockHeight(((x % D.W) + D.W) % D.W, z);
/** A box's ground: its corners' heights, whether it's dry, and the footing the culture needs for it. */
function groundOf(p, x0, z0, w, l) {
  const hs = [[0, 0], [w - 1, 0], [0, l - 1], [w - 1, l - 1], [Math.floor(w / 2), Math.floor(l / 2)]].map(([a, b]) => Math.round(ground(x0 + a, z0 + b)));
  const wet = hs.filter((h) => h <= 0).length;
  return { hs, dry: wet === 0, wet, foot: footing(p, hs.map((h) => Math.max(h, 0)), wet > 2) };   // vision: more than two wet corners is over the water
}

/** A quarter: thirteen house boxes (or fewer) round a plaza with its well and bell, bonded by roundness. Box coordinates relative to the quarter's middle. */
export function quarterOf(p, households) {
  const [hw, hl] = houseBox(p), round = ROUNDNESS[p.tradition] ?? 0, gap = BIND.GAP[LAYOUT_FORM[p.tradition]?.spread ?? 1] ?? 1, pl = BIND.PLAZA.quarter, out = [];
  out.push({ kind: "plaza", x: -pl / 2, z: -pl / 2, w: pl, l: pl }, { kind: "well", x: -1.5, z: -1.5, w: BOX.well[0], l: BOX.well[1] }, { kind: "bell", x: 2, z: -2, w: 1, l: 1 }, { kind: "shrine", x: -pl / 2, z: pl / 2 - BOX.shrine[1], w: BOX.shrine[0], l: BOX.shrine[1] });   // the faith's shrine at the plaza's corner (faith.js)   // the well in the middle, the bell beside it   // vision: the boxes' own layout (blocks), to refine
  if (round >= 0.5) {   // a ring: the houses round the plaza, each turned to face it
    const R = Math.max(pl / 2 + hl / 2 + BIND.SETBACK, ((hw + gap) * households) / (2 * Math.PI));
    for (let h = 0; h < households; h++) { const a = (h * 2 * Math.PI) / households + golden(h) * 0.15, cx = R * Math.cos(a), cz = R * Math.sin(a); out.push({ kind: "house", x: cx - hw / 2, z: cz - hl / 2, w: hw, l: hl, face: a + Math.PI }); }   // vision: a little jitter round the ring
  } else {   // two rows facing a street through the plaza, staggered by roundness
    const st = BIND.ROAD.street, perRow = Math.ceil(households / 2), run = perRow * (hw + gap) - gap, stagger = round * hw / 2;
    out.push({ kind: "street", x: -run / 2, z: -st / 2, w: run, l: st });
    for (let h = 0; h < households; h++) { const row = h % 2, k = Math.floor(h / 2), x = -run / 2 + k * (hw + gap) + (row ? stagger : 0), z = row ? st / 2 + BIND.SETBACK : -st / 2 - BIND.SETBACK - hl; if (Math.abs(x + hw / 2) < pl / 2 + 1) continue; out.push({ kind: "house", x, z: z + (row ? 0 : 0), w: hw, l: hl, face: row ? -Math.PI / 2 : Math.PI / 2 }); }   // the plaza's ground is kept clear
    let placed = out.filter((b) => b.kind === "house").length, extra = 0;
    while (placed < households) { const k = perRow + extra++, row = placed % 2, x = -run / 2 + k * (hw + gap), z = row ? st / 2 + BIND.SETBACK : -st / 2 - BIND.SETBACK - hl; out.push({ kind: "house", x, z, w: hw, l: hl, face: row ? -Math.PI / 2 : Math.PI / 2 }); placed++; }
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const b of out) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.w); z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z + b.l); }
  const side = fibUp(Math.ceil(Math.max(x1 - x0, z1 - z0)) + BIND.ROAD.lane * 2);   // the quarter's own box: what it holds and its lanes round it, Fibonacci-rounded
  return { boxes: out, side, households };
}

/** A people's town as boxes, in block coordinates (x east, z south) from the site's middle. */
export function townOf(p, site, pop, tier = "village") {
  const W = D.CELLS_W, sx = (site % W) * C + C / 2, sz = Math.floor(site / W) * C + C / 2, law = FORM[p.tradition]?.form ?? "twocell", hh = HOUSEHOLD[law] ?? 5;   // vision: the boxes' own layout (blocks), to refine
  const households = pop > 0 ? Math.max(1, Math.ceil(pop / hh)) : 0, quarters = Math.ceil(households / CHEM.QUARTER), round = ROUNDNESS[p.tradition] ?? 0, out = [], used = [];
  const free = (x, z, w, l) => !used.some((b) => x < b.x + b.w && x + w > b.x && z < b.z + b.l && z + l > b.z);
  const take = (b) => { used.push(b); out.push(b); return b; };
  // the heart: the hall (and the market where there is one) on the city's plaza
  const pl = tier === "city" || tier === "town" ? BIND.PLAZA.city : tier === "village" ? BIND.PLAZA.district : BIND.PLAZA.quarter;
  take({ kind: "plaza", x: -pl / 2, z: -pl / 2, w: pl, l: pl, level: "heart" });
  if (households >= 2) take({ kind: "hall", x: -BOX.hall[0] / 2, z: -pl / 2 - BOX.hall[1], w: BOX.hall[0], l: BOX.hall[1] });
  if (households >= CHEM.QUARTER) take({ kind: "market", x: pl / 2, z: -BOX.market[1] / 2, w: BOX.market[0], l: BOX.market[1] });
  // quarters out from the heart in sunflower order, each on the nearest dry gentle ground
  const Q = quarterOf(p, Math.min(households, CHEM.QUARTER)), side = Q.side, step = side * (1 - 0.15 * round);   // vision: round towns pack their quarters a little closer (they overlap at the corners)
  let left = households, n = 0, tries = 0, districts = [];
  while (left > 0 && tries < quarters * FIB[9]) {   // vision: a bound on the search
    tries++;
    const k0 = Math.min(left, CHEM.QUARTER), q0 = k0 === CHEM.QUARTER ? Q : quarterOf(p, k0), qs = q0.side;   // a small last quarter takes only its own ground
    const r = step * Math.sqrt((n + FIB[4]) / Math.PI) * (round >= 0.5 ? 1 : 1.1), a = n * GOLDEN_ANGLE, cx = Math.round(r * Math.cos(a)), cz = Math.round(r * Math.sin(a)); n++;   // derived: the sunflower at a quarter's area a point (r = side sqrt(n / pi)), starting five out to clear the heart
    const x = cx - qs / 2, z = cz - qs / 2, g = groundOf(p, sx + x, sz + z, qs, qs);
    const rise = Math.max(...g.hs) - Math.min(...g.hs), grade = rise / qs;
    if ((!g.dry && !LAYOUT_FORM[p.tradition]?.water) || grade > 1 / PHI || !free(x, z, qs, qs)) continue;   // derived: a quarter climbs at most 1 in phi (its houses terraced)
    g.foot = rise <= CHEM.LEVEL ? g.foot : { kind: "terraced", rise, note: `terraced, ${rise} blocks of rise across the quarter` };
    const k = k0, q = q0, qi = out.filter((b) => b.kind === "quarter").length;
    take({ kind: "quarter", x, z, w: qs, l: qs, households: k, district: Math.floor(qi / BIND.DISTRICT), footing: g.foot.kind, parts: q.boxes.map((b) => ({ ...b, x: b.x + cx, z: b.z + cz })) });
    left -= k;
  }
  if (left > 0 && !out.some((b) => b.kind === "quarter")) { const k = Math.min(left, CHEM.QUARTER), q = quarterOf(p, k); take({ kind: "quarter", x: -q.side / 2, z: pl / 2 + BIND.ROAD.street, w: q.side, l: q.side, households: k, district: 0, footing: "as it lies", parts: q.boxes.map((b) => ({ ...b, z: b.z + pl / 2 + BIND.ROAD.street + q.side / 2 })) }); left -= k; }   // a place too cramped for any quarter still houses its folk beside its heart
  // when the ground runs out, the quarters densify, oldest first: a storey more, thirteen households to twenty-one, then thirty-four (the Fibonacci numbers on)
  const qs0 = out.filter((b) => b.kind === "quarter");
  for (const [cap, st] of [[FIB[7], 2], [FIB[8], 3], [FIB[9], 4]]) for (const q of qs0) { if (left <= 0) break; const add = Math.min(left, cap - q.households); if (add > 0) { q.households += add; q.storeys = st; left -= add; } }   // derived: 21, 34, 55 households a quarter, a storey each   // vision: the boxes' own layout (blocks), to refine
  // districts: a plaza and a shrine at each district's quarters' middle (from the second district on)
  const qs = out.filter((b) => b.kind === "quarter"), nd = Math.ceil(qs.length / BIND.DISTRICT);
  for (let d = 0; d < nd; d++) { const mine = qs.filter((q) => q.district === d), mx = mine.reduce((a, q) => a + q.x + q.w / 2, 0) / mine.length, mz = mine.reduce((a, q) => a + q.z + q.l / 2, 0) / mine.length; districts.push({ d, x: mx, z: mz, quarters: mine.length }); if (d > 0) out.push({ kind: "district plaza", x: mx - BIND.PLAZA.district / 2, z: mz - BIND.PLAZA.district / 2, w: BIND.PLAZA.district, l: BIND.PLAZA.district, district: d }, { kind: "temple", x: mx - BOX.temple[0] / 2, z: mz - BIND.PLAZA.district / 2 - BOX.temple[1], w: BOX.temple[0], l: BOX.temple[1], district: d }); }
  if (qs.length >= TEMPLE_EVERY) out.push({ kind: "temple", x: -pl / 2 - BOX.temple[0], z: -BOX.temple[1] / 2, w: BOX.temple[0], l: BOX.temple[1], district: 0 });   // the first district's temple beside the heart
  // docks on the waterline nearest the heart, one pier per three boats (a boat for every thirteen folk)
  const piers = p.living === "fishers" || p.temper === "traders" ? Math.ceil(Math.ceil(pop / FIB[6]) / CHEM.BERTHS) : 0, shore = [];   // vision: the boxes' own layout (blocks), to refine
  for (let r = 0; r < 160 && shore.length < piers; r += 4) for (let s = 0; s < 32 && shore.length < piers; s++) { const a = (s * 2 * Math.PI) / 32, x = Math.round(r * Math.cos(a)), z = Math.round(r * Math.sin(a)); if (ground(sx + x, sz + z) > 0 && ground(sx + x + Math.round(4 * Math.cos(a)), sz + z + Math.round(4 * Math.sin(a))) <= 0 && free(x - 2, z - 2, 4, 4)) shore.push(take({ kind: "pier", x: x - 1, z: z - 1, w: BOX.pier[0], l: BOX.pier[1], a })); }   // vision: the search's reach and fineness
  // main streets: from the heart to each district plaza and to the docks
  const streets = [...districts.slice(1).map((d) => ({ to: d, w: BIND.ROAD.main })), ...shore.slice(0, 1).map((s) => ({ to: { x: s.x, z: s.z }, w: BIND.ROAD.main }))].map((s) => ({ kind: "main street", x0: 0, z0: 0, x1: s.to.x, z1: s.to.z, w: s.w }));
  // walls, where the guard calls for them: round cultures a circle, square ones the quarters' hull, a gate where each main street goes out
  let wall = null;
  if (/wall|palisade/.test(p.build.guard) && qs.length) {
    const pts = []; for (const b of out) if (b.kind !== "pier") pts.push([b.x, b.z], [b.x + b.w, b.z], [b.x, b.z + b.l], [b.x + b.w, b.z + b.l]);
    const gap = BIND.ROAD.street + 2;   // a street inside the wall, and the wall itself two thick
    if (round >= 0.5) { const R = Math.max(...pts.map(([x, z]) => Math.hypot(x, z))) + gap; wall = { kind: /palisade/.test(p.build.guard) ? "palisade" : "wall", shape: "circle", r: Math.round(R), thick: 2 }; }
    else { const H = hull(pts).map(([x, z]) => { const r = Math.hypot(x, z) || 1; return [Math.round(x + (x / r) * gap), Math.round(z + (z / r) * gap)]; }); wall = { kind: /palisade/.test(p.build.guard) ? "palisade" : "wall", shape: "hull", points: H, thick: 2 }; }
    wall.gates = streets.map((st) => { const a = Math.atan2(st.z1, st.x1); return { a, w: BIND.ROAD.main }; });   // a gate on each main street's bearing
  }
  return { site, x: sx, z: sz, pop, households, quarters: qs.length, districts: nd, piers: shore.length, boxes: out, streets, wall, short: left > 0 ? left : 0 };
}

/** The convex hull of points (Andrew's monotone chain). */
function hull(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cross(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/**
 * Thera's city as boxes: every dock quarter of the bay a quarter of its culture's houses, two storeys
 * (Thera is dense: twenty-one households), at its seed; and the Therans' own quarters (Akrotiri houses, two
 * storeys) in a sunflower on the cone round the dome, as many as the city's Therans need.
 * Coordinates in blocks from the dome's middle (a kilometre of the island is a hundred blocks).
 */
export function theraBoxes() {
  const L = peoples().list, byT = new Map(); for (const p of L) if (!byT.has(p.tradition)) byT.set(p.tradition, p);
  const K = 100, D0 = THERA.dome, out = [];   // given: the island at 1:10, a kilometre a hundred blocks
  for (const s of quarterSeeds()) { const p = byT.get(s.culture); if (!p) continue; const q = quarterOf(p, FIB[7]); const cx = (s.x - D0.x) * K, cz = (s.y - D0.y) * K; out.push({ kind: "dock quarter", culture: s.culture, x: cx - q.side / 2, z: cz - q.side / 2, w: q.side, l: q.side, households: FIB[7], storeys: 2, parts: q.boxes.map((b) => ({ ...b, x: b.x + cx, z: b.z + cz })) }); }   // derived: a dense quarter's twenty-one households
  const theran = { ...byT.get("european"), tradition: "therans" }, hhT = HOUSEHOLD.akrotiri, need = Math.ceil(TRADE.THERANS / hhT), q = quarterOf(theran, FIB[7]), n = Math.ceil(need / FIB[7]), R0 = q.side * 0.62;   // vision: the Therans' quarters packed close on the cone
  for (let k = 0; k < n; k++) { const r = R0 * Math.sqrt(k + 2), a = k * GOLDEN_ANGLE, cx = r * Math.cos(a), cz = r * Math.sin(a); out.push({ kind: "theran quarter", culture: "therans", x: cx - q.side / 2, z: cz - q.side / 2, w: q.side, l: q.side, households: FIB[7], storeys: 2, parts: q.boxes.map((b) => ({ ...b, x: b.x + cx, z: b.z + cz })) }); }   // vision: the boxes' own layout (blocks), to refine
  // the Cold House: the Therans' glassed-in arctic, by the Library at the cone's heart (the solar rite turned round)
  const ch = coldHouse(), side = 2 * COLD.R + 3; out.push({ kind: "cold house", x: R0 * 0.5, z: -side / 2, w: side, l: side, households: 0, lamps: ch.lamps.length, ok: ch.checks.ok });   // derived: the dome and its lobby
  // the Sea Rite Temple: at the bay's waterline below the cone, its steps going down into the sea
  const tp = seaRiteTemple(); out.push({ kind: "sea rite temple", x: -TEMPLE.W / 2, z: R0 * 2.2, w: TEMPLE.W, l: TEMPLE.L + 4, households: 0, reach: tp.checks.reach, ok: tp.checks.ok });   // vision: below the Therans' quarters, toward the bay
  return { boxes: out, docks: out.filter((b) => b.kind === "dock quarter").length, theran: n, households: out.reduce((a, b) => a + b.households, 0), cold: ch.checks, temple: tp.checks };
}
