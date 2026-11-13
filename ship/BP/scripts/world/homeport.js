// Pure. Strongyle: the homeport, the round isle of the Therans (config/theran.js), where every
// player arrives, and where the seafaring peoples meet to trade, talk and build.
//
// It's Thera before the great Bronze Age eruption, as the geologists reconstruct it, with artistic
// liberty: a ring island round a shallow flooded caldera, its one strait to the north-west, the
// south of the island land. The strait opens gradually, a curving channel; outside it two curved
// breakwaters (after Caesarea's) make an outer harbour with a gate between them, and in the middle
// of the gate, on its own round islet, the Light (after the Pharos: square, then eight-sided, then
// round, in white stone and bronze).
//
// In the lagoon, on the black island the geologists call Pre-Kameni, the Therans cut Plato's rings
// (Critias 115d-116a, public domain) to his proportions in stades: a central island 5 across, then
// rings of water and land of 1, 2, 2, 3 and 3. Bridges cross the rings of water; covered channels let
// small boats under the rings of land; Plato's canal runs straight out through the strait, so large
// ships sail into the city to the great harbour: ten dry docks (level 3) in the outer ring of land,
// one for each people. The walls carry the rings' metals: brass, tin, orichalcum.
//
// Round the rings runs the ring canal, and beyond it, to the cliffs, the peoples' quarters
// (portsim.js): each people's island, sculpted in its arc and planted with its own trees, cut by
// small canals for small boats (or, for the stilt-house people, decks over the water), with its
// level 2 dock for medium ships, its buildings laid out by its own rules, and its arched bridge to the
// rings. The market where they meet is on the rings' shore, by the quay where you arrive.
//
// The Therans' design language: white stone and plaster, marble, bronze and copper, round where it
// can be; plain surfaces, few patterns, a lot of sea and green. Everything is a pure function of the
// seed. Working waterfronts only: the Light is a light, the quarters are yards, homes and markets;
// no sacred or ceremonial structures, carvings or crests.
import { hash, rand, fbm } from "./noise.js";
import { greatAt, groupAt, GREAT_CELL, GROUP_CELL } from "./terrain.js";
import { YARD_STYLES } from "../config/yardstyles.js";
import { THERAN, PLATO } from "../config/theran.js";
import { Canvas, dryDockWorks, statesFor } from "../yardarch.js";
import { columnAt } from "./lattice.js";
import { lanesNear, warmPeoples } from "./peoples.js";
import { reachCentre, inReach, REACH } from "./reach.js";
import { portSim, SIM, CELL } from "./portsim.js";
import { treeBlocks } from "./chunkgen.js";

const SEA = 62;                                   // given: the sea's level (terrain.js SEA_LEVEL)
const CHUNK = 16;                                 // given: a chunk
const B = (id) => `minecraft:${id}`;
const TABLE = "shipwright:shipwright_table";
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };   // given: smoothstep
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/** The rings' radii from the citadel's heart, in blocks: Plato's stades at PORT_PLAN.stade a stade. */
function ringRadii(stade) {
  const out = [(PLATO.island / 2) * stade];
  for (const w of PLATO.rings) out.push(out[out.length - 1] + w * stade);
  return out;                                     // citadel, water, land, water, land, water
}

/** The port's plan (vision numbers, ranges drawn per seed; Plato's proportions are given). */
export const PORT_PLAN = (() => {
  const stade = 12;                               // vision: a stade is twelve blocks (so a dry dock fits across the outer ring of land at any bearing)
  const R = ringRadii(stade);
  const plan = {
    stade, rings: R,
    shore: R[5] + 15,                             // vision: Pre-Kameni's outer shore, the market and the quay
    hill: { top: 10, flat: 15 },                  // vision: the citadel's low hill ("a mountain not very high", Critias 113c)
    land: 6,                                      // vision: the rings of land stand this far over the sea (small boats pass under them)
    deck: 2,                                      // vision: decks, quays and the peoples' islands stand this far over the sea
    lagoon: { inner: [252, 304], depth: 4 },      // vision: the lagoon's reach (to the cliff foot); given: a few metres deep (stromatolites)
    caldera: { face: 26, height: [30, 52], slope: [60, 130] },   // vision: the rim's terraced inner face, its height, its outer slope
    south: { bulge: 260, plateau: [6, 20], bearing: Math.PI / 2 },   // vision: the island's southern land, and which way (south)
    ledge: 4,                                     // vision: a ledge of the inner face (a house's height)
    strait: { inner: [12, 15], outer: 44, bearing: (-3 * Math.PI) / 4, wander: 0.3, depth: 8 },   // given: one strait, to the north-west; vision: how it opens out
    canal: { half: Math.max(5, Math.ceil((PLATO.canal.width * stade) / 2)), depth: 6 },   // derived: Plato's 300 ft, at least wide enough for a ship   // vision: ringRadii's shape
    tunnel: 4,                                    // vision: the covered channels' headroom (small boats)
    bridges: 3, bridgeHalf: 2.5,                  // vision: bridges across the rings of water
    great: { docks: 10, length: 28, half: 4, depth: 3 },   // given: a dry dock (dock.js DRY_DOCK), one for each people
    moles: { reach: 70, half: 3, gate: 26 },      // vision: the breakwaters: how far out, how wide, half the gate between them
    islet: 10,                                    // vision: the Light's islet
    quay: { length: 22, half: 1.6 },              // vision: the Castaway Quay
    chart: { radius: 11, scale: 96 },             // vision: the Chart Table's radius in cells, and blocks a cell
    town: { arcs: 2, span: [0.7, 1.1], every: 7 },   // vision: the cliff towns
    tower: 56,                                    // vision: the Light's height over its islet
    dock: SIM.dock,                               // given: a level 2 dock in each quarter
    sim: SIM,
  };
  plan.radius = plan.lagoon.inner[1] + plan.caldera.face + plan.caldera.slope[1] + plan.south.bulge + 20;   // derived: nothing of the port lies further out   // vision: ringRadii's shape
  plan.core = plan.radius;
  return Object.freeze(plan);
})();
const P = PORT_PLAN;
const RR = P.rings;

// the Therans' palette: white stone and plaster, marble, and the rings' metals
const WHITE = B("white_concrete"), STONE = THERAN.stone.white, MARBLE = B("smooth_quartz"), QUAY = B("smooth_sandstone");
const ROCK = B("sandstone"), SUB = B("smooth_sandstone"), PILE = B("stripped_oak_log");

// ---------------------------------------------------------------- where it stands

/** Whether the island may stand here: clear of the great islands and the volcanoes, out of the Reach. */
function siteClear(seed, x, z) {
  const reach = P.radius + 300;   // vision: open water round it
  const gx = Math.floor(x / GREAT_CELL), gz = Math.floor(z / GREAT_CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const g = greatAt(seed, gx + i, gz + j);
    if (g && Math.hypot(g.x - x, g.z - z) - g.R * g.stretch < reach) return false;
  }
  const cx = Math.floor(x / GROUP_CELL), cz = Math.floor(z / GROUP_CELL), n = Math.ceil(reach / GROUP_CELL);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const g = groupAt(seed, cx + i, cz + j);
    if (g?.special === "volcano" && Math.hypot(g.x - x, g.z - z) < reach) return false;
  }
  return !inReach(seed, x, z, REACH.margin + P.radius);
}
const sites = new Map();
/** Where Strongyle stands: the clear water nearest the middle of the world. */
export function portSite(seed) {
  if (sites.has(seed)) return sites.get(seed);
  const g = portSiteSteps(seed);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
/** The same, a try a step (each try asks after the great islands and the volcanoes round it). */
export function* portSiteSteps(seed) {
  if (sites.has(seed)) return sites.get(seed);
  let at = { x: 0, z: 0 };
  search: for (let k = 0; k <= 16; k++) for (let a = 0; a < Math.max(1, k * 6); a++) {   // vision: rings of tries, 600 blocks apart
    const th = (a / Math.max(1, k * 6)) * TAU + rand(seed, 501) * TAU;   // given: hash salt
    const x = Math.round(Math.cos(th) * k * 600), z = Math.round(Math.sin(th) * k * 600);   // vision: rings of tries 600 apart
    yield;
    if (siteClear(seed, x, z)) { at = { x, z }; break search; }
  }
  sites.set(seed, at);
  return at;
}

// ---------------------------------------------------------------- the plan

let cache = { seed: null, hp: null };
/** Strongyle, worked out (all at once: tests and labs; the game uses homeportSteps). */
export function homeport(seed) {
  if (cache.seed === seed && cache.hp) return cache.hp;
  const g = homeportSteps(seed);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
/** The homeport if it's been worked out (never starts the work). */
export const homeportIfReady = (seed) => (cache.seed === seed ? cache.hp : null);
/** Forget the port (tests). */
export function forgetHomeport() { cache = { seed: null, hp: null }; parts.clear(); }

/** The rim at a bearing: how far out its foot lies, how high it stands, how far its outer slope runs, and the island's coast. */
function rimAt(hp, th) {
  const k = Math.round(((th % TAU) + TAU) % TAU * 256) % 1609;   // vision: worked out at a quarter-degree   // given: a whole turn's quarter-degrees
  let c = hp.rims.get(k);
  if (c) return c;
  const a = k / 256, cx = Math.cos(a), sz = Math.sin(a), C = P.caldera;   // vision: rimAt's shape
  const n = fbm(cx * 1.7 + 5, sz * 1.7 + 5, hp.seed + 931, 3), m = fbm(cx * 2.3 + 9, sz * 2.3 + 9, hp.seed + 932, 3), o = fbm(cx * 1.3 + 2, sz * 1.3 + 2, hp.seed + 933, 2);   // given: hash salts   // vision: the rim's wander
  const south = Math.max(0, Math.cos(a - P.south.bearing));
  const bulge = P.south.bulge * south * south * (0.75 + 0.5 * fbm(cx * 2 + 4, sz * 2 + 4, hp.seed + 934, 2));   // given: hash salt   // vision: the southern land's wander
  c = { Rin: lerp(P.lagoon.inner[0], P.lagoon.inner[1], n), H: lerp(C.height[0], C.height[1], m), out: lerp(C.slope[0], C.slope[1], o), bulge };
  c.coast = c.Rin + C.face + c.out + c.bulge;
  hp.rims.set(k, c);
  return c;
}

/** Where a place lies against the canal's line: along it and across it. */
function canalOff(hp, dx, dz) {
  const ca = Math.cos(hp.straitA), sa = Math.sin(hp.straitA);
  return { along: dx * ca + dz * sa, across: -dx * sa + dz * ca };
}
/** The strait's half width a distance along the canal's line: narrow in the rim, opening out in a smooth curve to the sea. */
function straitHalf(hp, along) {
  const t = smooth((along - hp.straitIn) / (hp.coastA - hp.straitIn));
  return lerp(hp.straitHalf, P.strait.outer, Math.pow(t, 2.5)) + 4 * Math.sin(along / 17 + hp.seed) + 2 * Math.sin(along / 7 + hp.seed * 2);   // vision: a trumpet's flare, and wandering banks
}
/** How far the strait's middle swings off the canal's line: none in the rim, a slow bow toward the sea. */
function straitBow(hp, along) {
  const t = smooth((along - hp.straitIn) / (hp.coastA - hp.straitIn));
  return hp.bow * t * t;
}
const fromCanal = (hp, along, across) => ({ x: Math.round(hp.x + Math.cos(hp.straitA) * along - Math.sin(hp.straitA) * across), z: Math.round(hp.z + Math.sin(hp.straitA) * along + Math.cos(hp.straitA) * across) });
const nearBearing = (th, r, a, half) => Math.abs(angDiff(th, a)) * r <= half;
const toLocal = (d, o, x, z) => { const dx = x - o.x, dz = z - o.z; return { u: d.x * dx + d.z * dz, w: -d.z * dx + d.x * dz }; };
const toWorld = (o, d, u, w) => ({ x: o.x + d.x * u - d.z * w, z: o.z + d.z * u + d.x * w });
const cardinalOut = (a) => (Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a)) ? { x: Math.sign(Math.cos(a)), z: 0 } : { x: 0, z: Math.sign(Math.sin(a)) });
const ringOf = (r) => RR.findIndex((R) => r <= R);   // 0 citadel; 1, 3, 5 water; 2, 4 land; -1 beyond

/** The same, as steps for a game job. */
export function* homeportSteps(seed) {
  if (cache.seed === seed && cache.hp) return cache.hp;
  const at = yield* portSiteSteps(seed);
  const hp = { seed, x: at.x, z: at.z, rims: new Map() };
  const S = P.strait;
  hp.straitA = S.bearing + (rand(seed, 660) - 0.5) * 2 * S.wander;   // given: hash salt
  hp.straitHalf = lerp(S.inner[0], S.inner[1], rand(seed, 661));   // given: hash salt
  for (let k = 0; k < 1609; k++) { rimAt(hp, k / 256); if (k % 24 === 23) yield; }   // given: a turn in quarter-degrees   // vision: the rim worked out a few dozen bearings a step
  const r0 = rimAt(hp, hp.straitA);
  hp.straitIn = r0.Rin - 6;                         // vision: the strait begins just inside the cliff foot
  hp.coastA = r0.Rin + P.caldera.face + r0.out;     // where its banks meet the open sea
  hp.bow = (rand(seed, 664) < 0.5 ? -1 : 1) * (P.strait.outer - P.canal.half - 18);   // given: hash salt   // vision: its middle swings this far by the sea, the canal still clear
  hp.aq = hp.straitA + 0.42 + rand(seed, 662) * 0.2;   // given: hash salt   // vision: the Castaway Quay, just round from the canal
  // the bridges, all in the far half from the canal, so large ships reach the great harbour without passing under one
  hp.bridgeA = [-1, 0, 1].map((k) => hp.straitA + Math.PI + k * 1.15);   // vision: their spread
  // the great harbour: a dry dock for each people in the outer ring of land, opening on the outer ring of water
  hp.harbour = [];
  const G = P.great, keys = Object.keys(YARD_STYLES);
  const start = hash(seed, 663) % keys.length;   // given: hash salt
  for (let k = 0; k < 900 && hp.harbour.length < G.docks; k++) {   // vision: bearings tried
    if (k % 12 === 11) yield;   // vision: a dozen bearings a step
    const th = hp.straitA + 0.22 + (k / 900) * (TAU - 0.44);   // vision: clear of the canal's covered channel
    if (hp.bridgeA.some((a) => Math.abs(angDiff(th, a)) < 0.16)) continue;   // vision: clear of the bridges
    const d = cardinalOut(th);
    const mouth = { x: hp.x + Math.cos(th) * (RR[4] + 1), z: hp.z + Math.sin(th) * (RR[4] + 1) };   // its mouth just out on the ring of water   // vision: the plan's layout
    const o = { x: Math.round(mouth.x - d.x * G.length), z: Math.round(mouth.z - d.z * G.length) };
    let ok = true;
    for (let u = -2; u <= G.length + 4 && ok; u++) for (let w = -G.half - 5; w <= G.half + 5 && ok; w++) {   // vision: its walkways, its yard works and its mouth
      const p = toWorld(o, d, u, w), rr = Math.hypot(p.x - hp.x, p.z - hp.z), ring = ringOf(rr);
      if (u <= G.length - 3 && ring !== 4) ok = false;                                      // the dock and its yard in the ring of land   // vision: the plan's layout
      else if (u < G.length && u > G.length - 3 && ring !== 4 && ring !== 5) ok = false;   // its mouth may meet the water a little early   // vision: the plan's layout
      else if (u >= G.length && Math.abs(w) <= G.half && ring !== 5) ok = false;           // and opens on the ring of water   // vision: the plan's layout
    }
    if (!ok) continue;
    if (hp.harbour.some((h) => Math.hypot(h.o.x - o.x, h.o.z - o.z) < 2 * G.half + 14)) continue;   // vision: room between docks
    hp.harbour.push({ i: hp.harbour.length, o, d, key: keys[(start + hp.harbour.length) % keys.length], th });
  }
  // the culture agents lay out the lagoon's quarters
  let rinSum = 0;
  for (let k = 0; k < 72; k++) rinSum += rimAt(hp, (k / 72) * TAU).Rin;   // vision: the rim's mean from 72 bearings
  hp.sim = yield* portSim(seed, {
    x: hp.x, z: hp.z, preK: P.shore, rmax: P.lagoon.inner[1] + 2, rinMean: rinSum / 72,   // vision: the rim's mean from 72 bearings
    rin: (th) => rimAt(hp, th).Rin,
    canal: { a: hp.straitA, half: P.canal.half + 2 },
    quay: { a: hp.aq, half: P.quay.half + 2, length: P.quay.length },
  });
  hp.quarters = hp.sim.quarters.filter((q) => q.dock);
  // the market, the arrival, the quay's bell and the raft
  const on = (r, y, a = hp.aq) => ({ x: Math.round(hp.x + Math.cos(a) * r), y, z: Math.round(hp.z + Math.sin(a) * r) });
  hp.market = { a0: hp.aq - 0.62, a1: hp.aq - 0.12 };   // vision: the market's stretch of the shore, beside the quay
  const sp = on(P.shore - 5, SEA + P.deck + 1, hp.aq - 0.08);   // vision: the plan's layout
  hp.spawn = { x: sp.x + 0.5, y: sp.y, z: sp.z + 0.5 };
  hp.bell = on(P.shore + P.quay.length - 1, SEA + 2);
  hp.raft = on(P.shore + P.quay.length + 4, SEA);   // vision: the plan's layout
  // the outer harbour: two breakwaters curving in to the gate, and the Light on its islet in the gate
  const M = P.moles, out = new Map();
  hp.outer = out;
  const half0 = P.strait.outer + 6;   // vision: the breakwaters leave the coast just outside the strait's banks
  for (const side of [-1, 1]) {
    for (let t = 0; t <= 1; t += 0.004) {   // vision: fine steps along the curve
      const along = hp.coastA - 30 + (M.reach + 22) * Math.sin((Math.PI / 2) * t), across = straitBow(hp, hp.coastA) + side * (half0 - (half0 - M.gate) * (1 - Math.cos((Math.PI / 2) * t)));   // vision: rooted well back in the shore
      for (let w = -M.half; w <= M.half; w++) {
        const p = fromCanal(hp, along, across + w);
        out.set(`${p.x},${p.z}`, { kind: "mole", deckTop: SEA + 3, side, t, edge: Math.abs(w) === M.half });   // vision: the plan's layout
      }
    }
    const end = fromCanal(hp, hp.coastA - 8 + M.reach, straitBow(hp, hp.coastA) + side * M.gate);   // vision: the plan's layout
    for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) if (Math.hypot(a, b) <= 4.6) out.set(`${end.x + a},${end.z + b}`, { kind: "mole", deckTop: SEA + 3, side, t: 1, tower: true });   // vision: a gate tower's round footing
    yield;
  }
  const lc = fromCanal(hp, hp.coastA - 8 + M.reach, straitBow(hp, hp.coastA));   // vision: the plan's layout
  for (let a = -P.islet - 1; a <= P.islet + 1; a++) for (let b = -P.islet - 1; b <= P.islet + 1; b++) {
    const d = Math.hypot(a, b);
    if (d <= P.islet + 0.5) out.set(`${lc.x + a},${lc.z + b}`, { kind: "islet", deckTop: SEA + 3, edge: d > P.islet - 0.8 });   // vision: the plan's layout
  }
  hp.gateTowers = [-1, 1].map((side) => fromCanal(hp, hp.coastA - 8 + M.reach, straitBow(hp, hp.coastA) + side * M.gate));   // vision: the plan's layout
  hp.light = { x: lc.x, z: lc.z, a: hp.straitA, y: SEA + 4 };   // vision: the plan's layout
  // the cliff towns: two arcs of the rim, off the strait
  hp.towns = [];
  for (let k = 0; k < P.town.arcs; k++) {
    const a = hp.straitA + 1.3 + k * 2.4 + (rand(seed, 690 + k) - 0.5) * 0.6, span = lerp(P.town.span[0], P.town.span[1], rand(seed, 695 + k));   // given: hash salts   // vision: where the towns lie
    hp.towns.push({ a0: a, a1: a + span });
  }
  cache = { seed, hp };
  return hp;
}

// ---------------------------------------------------------------- what each place is

/** The great harbour's dock a place lies in, if any: { h, u, w }. */
function harbourAt(hp, x, z) {
  for (const h of hp.harbour) {
    const l = toLocal(h.d, h.o, x, z);
    if (l.u >= -3 && l.u <= P.great.length + 4 && Math.abs(l.w) <= P.great.half + 4) return { h, u: l.u, w: l.w };   // vision: its walkways and mouth
  }
  return null;
}

/**
 * What the port makes of a place, or null where the sea and the world are left as they are:
 *   decks  { kind: "hub" | "landring" | "shore" | "bridge" | "quay" | "plaza" | "wing" | "jetty" | "isle" | "mole" | "islet", deckTop, solid?, span? }
 *   water  { kind: "canal" | "ringwater" | "basin" | "lagoon" | "strait" | "tunnel", roof?, depth? }
 *   rim    { kind: "cliff", deckTop, face, ledge? }   land { kind: "land", deckTop }
 */
export function cityKind(hp, x, z) {
  const dx = x - hp.x, dz = z - hp.z;
  if (Math.abs(dx) > P.radius || Math.abs(dz) > P.radius) return null;
  const r = Math.hypot(dx, dz);
  if (r > P.radius) return null;
  const th = Math.atan2(dz, dx);
  const c = canalOff(hp, dx, dz);
  const inCanal = c.along > 0 && Math.abs(c.across) <= P.canal.half;
  const land = SEA + P.land, deck = SEA + P.deck;
  // the citadel's hill, Plato's rings, the outer shore
  if (r <= RR[0]) {
    const t = Math.max(0, (r - P.hill.flat) / (RR[0] - P.hill.flat));
    return { kind: "hub", deckTop: SEA + P.hill.top - Math.round(t * (P.hill.top - P.land)), solid: true };
  }
  if (r <= P.shore) {
    const ring = ringOf(r);
    if (ring === 1 || ring === 3 || ring === 5) {   // vision: the port's layout
      if (hp.bridgeA.some((a) => nearBearing(th, r, a, P.bridgeHalf))) {
        const top = ring === 5 ? Math.round(lerp(land, deck, (r - RR[4]) / (RR[5] - RR[4]))) : land;   // the outer bridges come down to the shore   // vision: the port's layout
        return { kind: "bridge", deckTop: top, span: true };
      }
      const g = ring === 5 ? harbourAt(hp, x, z) : null;   // vision: the port's layout
      if (g && g.u >= 0 && g.u < P.great.length && Math.abs(g.w) <= P.great.half) return { kind: "basin", great: g.h.i, u: g.u, w: g.w, depth: P.great.depth };
      return { kind: "ringwater", ring };
    }
    if (inCanal) return ring === -1 ? { kind: "canal" } : { kind: "tunnel", roof: land };   // covered channels under the rings of land
    if (ring === 4) {   // vision: the port's layout
      const g = harbourAt(hp, x, z);
      if (g) {
        if (g.u >= 0 && g.u < P.great.length && Math.abs(g.w) <= P.great.half) return { kind: "basin", great: g.h.i, u: g.u, w: g.w, depth: P.great.depth };
        return { kind: "quay", deckTop: deck, solid: true, great: g.h.i };            // the dock's walkways, down at the water
      }
    }
    if (ring === -1) return { kind: "shore", deckTop: deck, solid: true };
    return { kind: "landring", ring, deckTop: land, solid: true };
  }
  const rim = rimAt(hp, th);
  // the lagoon: the Castaway Quay, the canal's fairway, and the quarters the agents laid out
  if (r < rim.Rin) {
    if (c.along > 0 && nearBearing(th, r, hp.aq, P.quay.half) && r <= P.shore + P.quay.length) return { kind: "jetty", deckTop: SEA + 1 };
    if (inCanal) return { kind: "canal" };
    const s = hp.sim.at(x, z);
    if (s.o > 0 && s.k !== CELL.none && s.k !== CELL.fair && s.k !== CELL.reserved) {
      const q = hp.sim.quarters[s.o - 1];
      if (s.k === CELL.land) return { kind: "isle", deckTop: deck, solid: true, q: q.i };
      if (s.k === CELL.basin) { const l = toLocal(q.dock.d, q.dock.o, x, z); return { kind: "basin", q: q.i, u: l.u, w: l.w, depth: SIM.dock.depth }; }
      const lift = hp.sim.liftAt(x, z);
      if (s.k === CELL.wing) return { kind: "wing", deckTop: deck + lift, q: q.i, span: lift > 0 };
      const solid = hp.sim.ground(x, z);
      return { kind: "plaza", deckTop: deck + (solid ? 0 : lift), q: q.i, solid, span: !solid && lift > 0 };
    }
    return { kind: "lagoon" };
  }
  // the strait, opening out; the rim; the island beyond; the outer harbour
  const s = r - rim.Rin;
  if (s > P.caldera.face) { const o = hp.outer.get(`${x},${z}`); if (o) return { ...o, solid: true }; }   // the breakwaters and the Light's islet
  const off = c.across - straitBow(hp, c.along);
  if (c.along > hp.straitIn && Math.abs(off) <= straitHalf(hp, c.along)) return c.along <= hp.coastA + 12 ? { kind: "strait", depth: Math.round(lerp(P.strait.depth, 3, Math.abs(off) / straitHalf(hp, c.along))) } : null;   // vision: shelving to its banks
  if (s > rim.coast - rim.Rin) {
    const o = hp.outer.get(`${x},${z}`);
    return o ? { ...o, solid: true } : null;
  }
  if (s < P.caldera.face) { const top = faceTop(rim, s); return { kind: "cliff", deckTop: top, face: true, ledge: (top - SEA - 1) / P.ledge, rim }; }
  const f = 1 - (s - P.caldera.face) / rim.out;
  const slope = f > 0 ? SEA + Math.round(rim.H * Math.pow(f, 1.6)) : SEA;   // vision: the outer slope's shape
  let top = slope;
  if (rim.bulge > 0) {
    const toCoast = rim.coast - r;
    const plateau = SEA + lerp(P.south.plateau[0], P.south.plateau[1], fbm(x / 140, z / 140, hp.seed + 935, 3));   // given: hash salt   // vision: the southern land's rolls
    top = Math.max(top, Math.round(SEA + (plateau - SEA) * Math.min(1, toCoast / 40)));   // vision: falling to the sea over the last forty blocks
  }
  if (top <= SEA) { const o = hp.outer.get(`${x},${z}`); return o ? { ...o, solid: true } : null; }
  return { kind: f > 0 ? "cliff" : "land", deckTop: top, face: false, rim };
}

/** The inner face's height a distance s in from the rim's foot: ledges a house high, steep then easing. */
function faceTop(rim, s) {
  return SEA + 1 + P.ledge * Math.floor((rim.H * Math.pow(Math.max(0, s) / P.caldera.face, 0.8)) / P.ledge);   // vision: the face's curve
}

// The rim's strata, as on Thera's cliffs: warm browns and greys of old ash and scoria, a little red,
// and over all a white cap of pumice; only the sea-washed foot is dark.
const STRATA = [B("brown_terracotta"), B("light_gray_terracotta"), B("terracotta"), B("white_terracotta"), B("red_terracotta"), B("light_gray_terracotta"), B("brown_terracotta"), B("white_terracotta")];
const PUMICE = B("calcite");
function strata(hp, x, z, y0, y1) {
  const runs = [];
  const wob = fbm(x / 23, z / 23, hp.seed + 941, 2) * 5;   // given: hash salt   // vision: the bands' wander
  for (let y = y0; y <= y1; y++) {
    const id = y > y1 - 3 ? PUMICE : y <= SEA ? B("tuff") : STRATA[((Math.floor((y + wob) / 4) % STRATA.length) + STRATA.length) % STRATA.length];   // vision: the cap and the bands
    const last = runs[runs.length - 1];
    if (last && last[2] === id && last[1] === y - 1) last[1] = y; else runs.push([y, y, id]);
  }
  return runs;
}

const nonFalling = (id) => (!id || /gravel|sand$|concrete_powder/.test(id) ? B("cobblestone") : id);
const woodOf = (post) => (post ?? "spruce").replace(/minecraft:|stripped_|_log|_block|_stem/g, "") || "spruce";
const planksOf = (s) => { const w = woodOf(s.post); return w === "bone" ? B("spruce_planks") : B(`${w}_planks`); };

/** The surface a deck shows here: plain, one material to a place. */
function deckTopBlock(hp, k, x, z) {
  switch (k.kind) {
    case "jetty": return B("spruce_planks");
    case "hub": return Math.hypot(x - hp.x, z - hp.z) <= P.hill.flat ? MARBLE : B("grass_block");
    case "landring": return B("grass_block");
    case "shore": {                                                              // a quay round its edges and through the market, grass and gardens between
      const r = Math.hypot(x - hp.x, z - hp.z), th = Math.atan2(z - hp.z, x - hp.x);
      const market = angDiff(th, hp.market.a0) >= -0.02 && angDiff(hp.market.a1, th) >= -0.02;   // vision: the market's paving
      return r > P.shore - 3 || r < RR[5] + 3 || market ? QUAY : B("grass_block");   // vision: the quays' width
    }
    case "quay": case "mole": case "islet": return k.edge ? STONE : QUAY;
    case "bridge": return STONE;
    case "isle": return B("grass_block");
    case "wing": return planksOf(YARD_STYLES[hp.sim.quarters[k.q].key]);
    case "plaza": {
      const s = YARD_STYLES[hp.sim.quarters[k.q].key];
      return k.solid ? nonFalling(s.base) : planksOf(s);
    }
    default: return STONE;
  }
}

/**
 * A column of the port, replacing the world's own (nat, from chunkgen's column) where the port is.
 * Returns null where the world is left as it is.
 */
export function cityColumn(seed, hp, x, z, nat) {
  const k = cityKind(hp, x, z);
  if (!k) return null;
  const nTop = nat.solidTop ?? nat.top;
  const clip = (cap) => nat.layers.map(([a, b, id]) => [a, Math.min(b, cap), id]).filter(([a, b]) => b >= a);
  const WATER = { canal: P.canal.depth, ringwater: 5, basin: 3, lagoon: P.lagoon.depth, strait: P.strait.depth, tunnel: P.canal.depth };   // vision: depths
  if (k.kind in WATER) {
    const depth = k.depth ?? WATER[k.kind];
    const bed = Math.min(nTop, SEA - depth);
    const cut = nTop > bed || nat.land;                                           // the bed is cut, and laid fresh
    const layers = clip(cut ? bed - 1 : bed).filter(([a, b]) => b >= a);
    if (cut) layers.push([bed, bed, B("sand")]);
    if (k.kind === "basin" && k.w === 0 && k.u >= 1 && k.u % 2 === 1) {                // keel blocks, set into the bed
      const s = k.great != null ? YARD_STYLES[hp.harbour[k.great].key] : YARD_STYLES[hp.sim.quarters[k.q].key];
      const last = layers[layers.length - 1];
      if (last && last[1] === bed) { if (last[0] === bed) layers.pop(); else layers[layers.length - 1] = [last[0], bed - 1, last[2]]; }
      layers.push([bed, bed, s.post ?? B("spruce_log")]);
    }
    if (k.roof) {                                                                 // a roof of the island's own stone over the channel
      layers.push([SEA + P.tunnel + 1, k.roof - 1, ROCK], [k.roof, k.roof, B("grass_block")]);
      return { ...nat, top: k.roof, land: true, layers, water: [bed + 1, SEA], snow: false, lavaTop: null, solidTop: k.roof, city: k.kind, roofed: true };
    }
    return { ...nat, top: bed, land: false, layers, water: [bed + 1, SEA], snow: false, lavaTop: null, solidTop: bed, city: k.kind };
  }
  const top = k.deckTop;
  if (k.kind === "cliff" || k.kind === "land") {
    if (!k.face && nat.land && nTop >= top) return null;                         // the world stands higher here: its own ground
    const base = Math.min(nTop, SEA - 12);   // vision: the rim's roots
    const layers = [...clip(base), ...(k.kind === "cliff" ? strata(hp, x, z, base + 1, k.face ? top : top - 1) : [[base + 1, top - 3, B("tuff")], [top - 2, top - 1, B("dirt")]])];   // (off the face, the top block is the field's)   // vision: the port's ground
    const n = hash(x, z, seed, 613);   // given: hash salt
    if (!k.face) layers.push([top, top, k.kind === "land" ? (n % 9 === 0 ? B("coarse_dirt") : B("grass_block")) : n % 3 === 0 ? PUMICE : B("grass_block")]);   // vision: fields on the pumice
    return { ...nat, top, land: true, layers: layers.filter(([a, b]) => b >= a), water: null, snow: false, lavaTop: null, solidTop: top, city: k.kind };
  }
  const surface = deckTopBlock(hp, k, x, z);
  const soil = surface === B("grass_block");
  let layers, water = null;
  if (k.solid) {                                                                  // the island's own ground, right down
    layers = clip(Math.min(nTop, top - 1));
    const from = Math.min(nTop, top - 1) + 1;
    if (from <= top - 1) layers.push(soil && top - 1 >= from + 1 ? [from, top - 2, ROCK] : [from, top - 1, ROCK]);
    if (soil && top - 1 >= from + 1) layers.push([top - 1, top - 1, B("dirt")]);
  } else if (k.span) {                                                            // a bridge: a deck over open water
    const bed = Math.min(nTop, SEA - 4);   // vision: the port's ground
    layers = clip(bed);
    layers.push([top - 1, top - 1, SUB]);
    water = [bed + 1, SEA];
  } else if (nat.land || nTop >= SEA) {
    layers = clip(top - 1);
    if (Math.min(nTop, top - 1) < top - 1) layers.push([Math.min(nTop, top - 1) + 1, top - 1, SUB]);
  } else {
    const bed = Math.min(nTop, SEA - P.lagoon.depth);
    layers = clip(bed);
    if ((x + 2 * z) % 5 === 0) layers.push([bed + 1, SEA, PILE]);                 // vision: a pile every few blocks
    else water = [bed + 1, SEA];
    layers.push([SEA + 1, top - 1, k.kind === "jetty" ? B("spruce_planks") : SUB]);
  }
  layers.push([top, top, surface]);
  return { ...nat, top, land: true, layers: layers.filter(([a, b]) => b >= a), water, snow: false, lavaTop: null, solidTop: top, city: k.kind };
}

// ---------------------------------------------------------------- what stands on it

const parts = new Map();        // part key -> Map(chunk key -> blocks)

function bucket(blocks) {
  const m = new Map();
  for (const b of blocks) {
    const k = `${Math.floor(b.x / CHUNK)},${Math.floor(b.z / CHUNK)}`;
    let a = m.get(k);
    if (!a) m.set(k, (a = []));
    a.push(b);
  }
  return m;
}
const torchy = (id) => (/torch/.test(id ?? "") ? { torch_facing_direction: "top" } : {});
const putter = (out) => (x, y, z, id, states = {}) => out.push({ x, y, z, id, states });

/** A round tower course: the ring of blocks at radius R (the shell only, or filled). */
function disc(put, cx, y, cz, R, id, fill = false) {
  const n = Math.ceil(R) + 1;
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    const d = Math.hypot(a, b);
    if (d <= R + 0.5 && (fill || d > R - 0.75)) put(cx + a, y, cz + b, id);   // vision: a course one block thick
  }
}

/** An olive (a short gnarled trunk, a grey-green crown) or a cypress (a dark spire). */
function theranTree(put, x, y, z, n) {
  if (n % 3 === 0) {                                                             // a cypress   // vision: an olive's or a cypress's shape
    const h = 5 + (n % 3);   // vision: a cypress's height
    put(x, y + 1, z, B("spruce_log"), { pillar_axis: "y" });
    for (let k = 2; k <= h; k++) put(x, y + k, z, B("spruce_leaves"), { persistent_bit: true });
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 3; k <= h - 2; k++) if ((k + a + b + n) % 2 === 0) put(x + a, y + k, z + b, B("spruce_leaves"), { persistent_bit: true });   // vision: an olive's or a cypress's shape
    return;
  }
  put(x, y + 1, z, B("oak_log"), { pillar_axis: "y" });                          // an olive
  put(x, y + 2, z, B("oak_log"), { pillar_axis: "y" });
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const d = Math.abs(a) + Math.abs(b);
    if (d <= 3 && (d < 3 || (a + b + n) % 2 === 0)) put(x + a, y + 3, z + b, B("azalea_leaves"), { persistent_bit: true });   // vision: a round crown
    if (d <= 1) put(x + a, y + 4, z + b, B("azalea_leaves"), { persistent_bit: true });   // vision: an olive's or a cypress's shape
  }
}

/**
 * The Chart Table on the citadel's hill: a great chart plotter. Each cell is a stretch of sea the
 * size of P.chart.scale blocks, shown in relief: islands stacked by height, the sea shaded by depth,
 * the peoples' trade lanes, their capitals in gold, under a round bronze gantry with its pen.
 */
function* chart(hp) {
  const out = [], put = putter(out);
  const R = P.chart.radius, S = P.chart.scale, y0 = SEA + P.hill.top + 1;
  const lanes = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { yield* warmPeoples(hp.seed, hp.x + i * S * R, hp.z + j * S * R, 1); lanes.push(...lanesNear(hp.seed, hp.x + i * S * R, hp.z + j * S * R)); yield; }   // the peoples round about, worked out a step at a time
  const nearLane = (x, z) => lanes.some((l) => {
    const vx = l.b.x - l.a.x, vz = l.b.z - l.a.z, L2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((x - l.a.x) * vx + (z - l.a.z) * vz) / L2));
    return Math.hypot(l.a.x + vx * t - x, l.a.z + vz * t - z) < S * 0.55;   // vision: a lane's width on the chart
  });
  const capitals = new Set(lanes.flatMap((l) => [l.a, l.b]).map((p) => `${Math.round((p.x - hp.x) / S)},${Math.round((p.z - hp.z) / S)}`));
  for (let i = -R; i <= R; i++) {
    for (let j = -R; j <= R; j++) {
      const d = Math.hypot(i, j);
      if (d > R + 1.5) continue;   // vision: the rim's width
      const x = hp.x + i, z = hp.z + j;
      if (d > R) { put(x, y0, z, MARBLE); put(x, y0 + 1, z, (i === 0 || j === 0) && Math.round(d) === R + 1 ? B("gold_block") : B("waxed_cut_copper_slab")); continue; }   // the marble rim, the four points in gold
      const wx = hp.x + i * S, wz = hp.z + j * S;
      if (j % 6 === 0) yield;   // vision: a few cells a step
      const k = cityKind(hp, wx, wz);
      const c = columnAt(hp.seed, wx, wz);
      const land = k ? ("deckTop" in k || k.roof) : c.land, top = k ? (k.deckTop ?? k.roof ?? SEA - 6) : c.top;   // vision: the port's water shown shallow
      put(x, y0 - 1, z, MARBLE);
      if (i === 0 && j === 0) { put(x, y0, z, B("gold_block")); put(x, y0 + 1, z, B("sea_lantern")); continue; }   // you are here
      if (!land) {
        const depth = SEA - top;
        put(x, y0, z, nearLane(wx, wz) ? B("white_concrete") : depth <= 4 ? B("light_blue_concrete") : depth <= 14 ? B("cyan_concrete") : B("blue_concrete"));   // vision: depth bands
        continue;
      }
      const n = Math.max(1, Math.min(6, 1 + Math.round((top - SEA) / 8)));   // vision: a block a cell for every 8 blocks of height
      const mat = top <= SEA + 3 ? B("sandstone") : top <= SEA + 16 ? B("lime_terracotta") : top <= SEA + 30 ? B("terracotta") : B("white_concrete");   // vision: the chart's colours by height
      for (let y = 0; y < n; y++) put(x, y0 + y, z, y === n - 1 ? mat : B("smooth_sandstone"));
      if (capitals.has(`${i},${j}`)) put(x, y0 + n, z, B("gold_block"));
    }
    yield;
  }
  const rc = reachCentre(hp.seed), ra = Math.atan2(rc.z - hp.z, rc.x - hp.x);
  put(Math.round(hp.x + Math.cos(ra) * (R + 1)), y0 + 2, Math.round(hp.z + Math.sin(ra) * (R + 1)), B("sea_lantern"));   // the Reach's bearing on the rim
  const g = R + 2;
  for (const a of [0, 1, 2, 3]) {                                                 // four bronze posts and a ring overhead   // vision: the Chart Table's proportions
    const px = Math.round(hp.x + Math.cos(a * Math.PI / 2 + Math.PI / 4) * g), pz = Math.round(hp.z + Math.sin(a * Math.PI / 2 + Math.PI / 4) * g);   // vision: the Chart Table's proportions
    for (let y = y0; y <= y0 + 6; y++) put(px, y, pz, B("waxed_copper_block"));   // vision: the gantry's height
  }
  disc(put, hp.x, y0 + 7, hp.z, g, B("waxed_cut_copper"));   // vision: the Chart Table's proportions
  for (let i = -g; i <= g; i++) put(hp.x + i, y0 + 7, hp.z, B("waxed_cut_copper"));   // vision: the Chart Table's proportions
  put(hp.x, y0 + 6, hp.z + 3, B("end_rod"), { facing_direction: 0 });   // vision: the Chart Table's proportions
  return out;
}

/**
 * The Light, after the Pharos, on its islet in the harbour gate: a round marble podium; a tall square
 * tier with a bronze band; an eight-sided tier; a round tier of columns round a glass lantern with a
 * bronze fire bowl; a column of light up its heart. White stone and bronze, nothing else.
 */
function* pharos(hp) {
  const out = [], put = putter(out);
  const { x: cx, z: cz, y: y0 } = hp.light, H = P.tower;
  const sq = (a, b) => Math.max(Math.abs(a), Math.abs(b));
  const oct = (a, b) => Math.max(Math.abs(a), Math.abs(b), (Math.abs(a) + Math.abs(b)) * 0.75);   // given: an octagon's measure
  for (let y = y0 - 1; y <= y0 + 1; y++) disc(put, cx, y, cz, 8 - (y - y0 + 1), MARBLE, true);   // vision: the podium's steps
  const t1 = y0 + 2 + Math.round(H * 0.5), t2 = t1 + Math.round(H * 0.28), t3 = y0 + H - 6;   // vision: the three tiers
  for (let y = y0 + 2; y <= t1; y++) {                                            // the square tier: white walls, tall slit windows
    const h = 5 - (y - y0 - 2) / (t1 - y0 - 2) * 0.6;   // vision: a slight batter
    for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) {   // vision: the Light's proportions
      const d = sq(a, b);
      if (d > h + 0.5 || d < h - 0.5) continue;
      if (b === 5 && a === 0 && y <= y0 + 3) continue;                          // the door   // vision: the Light's proportions
      const slit = (a === 0 || b === 0) && (y - y0) % 8 >= 3 && (y - y0) % 8 <= 5;   // vision: windows in each face
      put(cx + a, y, cz + b, slit ? B("glass") : (y - y0) % 16 === 15 ? B("waxed_cut_copper") : STONE);   // vision: a bronze band
    }
    yield;
  }
  for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) if (sq(a, b) <= 5) put(cx + a, t1 + 1, cz + b, MARBLE);   // the square tier's roof   // vision: the Light's proportions
  for (let y = t1 + 2; y <= t2; y++) for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {   // the eight-sided tier   // vision: the Light's proportions
    const d = oct(a, b);
    if (d > 3.6 || d < 2.6) continue;   // vision: the Light's proportions
    put(cx + a, y, cz + b, (y - t1) % 5 === 3 && (a === 0 || b === 0) ? B("glass") : STONE);   // vision: its windows
  }
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (oct(a, b) <= 3.6) put(cx + a, t2 + 1, cz + b, MARBLE);   // vision: the Light's proportions
  yield;
  for (let y = t2 + 2; y <= t3; y++) {                                            // the round tier: a ring of columns round the lantern
    for (let k = 0; k < 8; k++) {   // vision: eight columns
      const a = (k / 8) * TAU;   // vision: the Light's proportions
      put(Math.round(cx + Math.cos(a) * 3), y, Math.round(cz + Math.sin(a) * 3), y === t3 ? B("waxed_cut_copper") : MARBLE);   // vision: the Light's proportions
    }
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (Math.abs(a) + Math.abs(b) === 1) put(cx + a, y, cz + b, B("glass"));
    put(cx, y, cz, B("sea_lantern"));
  }
  disc(put, cx, t3 + 1, cz, 3.5, B("waxed_cut_copper"), true);                   // the bronze bowl and the fire in it   // vision: the Light's proportions
  disc(put, cx, t3 + 2, cz, 3.5, B("waxed_cut_copper"));   // vision: the Light's proportions
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.hypot(a, b) <= 2.5) put(cx + a, t3 + 2, cz + b, a === 0 && b === 0 ? B("campfire") : B("magma"));   // vision: the Light's proportions
  disc(put, cx, t3 + 3, cz, 2, B("glass"));   // vision: the Light's proportions
  disc(put, cx, t3 + 4, cz, 1, B("glass"), true);   // vision: the Light's proportions
  put(cx, t3 + 5, cz, B("lightning_rod"), { facing_direction: 1 });   // vision: the Light's proportions
  // the column of light up its heart, from the podium to the bowl
  for (let y = y0 + 2; y <= t3; y++) put(cx, y, cz, B("sea_lantern"));
  return out;
}

/**
 * A Theran house, after the Cyclades: a whitewashed cube with soft corners, a flat roof with a low
 * parapet, a blue door and blue shutters, a small window or two; some have an upper room set back
 * behind a roof terrace with a vine pergola. front: which way its door faces (a compass vector).
 */
function theranHouse(put, cx, cz, y0, hw, hl, storeys, front, n) {
  const dx = front.x, dz = front.z, sx = -dz, sz = dx;
  const at = (a, b) => ({ x: cx + sx * a + dx * b, z: cz + sz * a + dz * b });
  const box = (aw, al, ya, yb, upper) => {
    for (let a = -aw; a <= aw; a++) for (let b = -al; b <= al; b++) {
      const edgeA = Math.abs(a) === aw, edgeB = Math.abs(b) === al, corner = edgeA && edgeB, p = at(a, b);
      for (let y = ya; y <= yb; y++) {
        if (!edgeA && !edgeB) { if (y === yb) put(p.x, y, p.z, WHITE); continue; }       // the roof
        if (corner && y === yb) continue;                                                 // soft corners
        const front = b === al && edgeB, rel = y - ya;
        if (front && a === 0 && rel <= 1) continue;                                       // the door
        if (front && a === 0 && rel === 2) { put(p.x, y, p.z, B("light_blue_concrete")); continue; }   // over the door
        if (!corner && rel === 1 && Math.abs(a) === Math.max(1, aw - 2) && edgeB) { put(p.x, y, p.z, B("glass_pane")); continue; }   // a window either side
        if (!corner && rel === 1 && edgeA && b === 0) { put(p.x, y, p.z, B("glass_pane")); continue; }
        put(p.x, y, p.z, WHITE);
      }
    }
    if (!upper) for (let a = -aw; a <= aw; a++) for (let b = -al; b <= al; b++) {           // a low parapet round the roof
      if ((Math.abs(a) === aw || Math.abs(b) === al) && !(Math.abs(a) === aw && Math.abs(b) === al)) { const p = at(a, b); put(p.x, yb + 1, p.z, B("smooth_quartz_slab"), { "minecraft:vertical_half": "bottom" }); }
    }
  };
  box(hw, hl, y0, y0 + 3, storeys < 2);   // vision: a house's proportions
  const door = at(0, hl + 1);
  put(door.x, y0, door.z, B("light_blue_concrete"));                              // a blue step before the door
  if (storeys >= 2) {                                                             // the upper room, set back; a terrace and a pergola in front
    box(hw - 1, Math.max(1, hl - 2), y0 + 4, y0 + 7, false);   // vision: a house's proportions
    for (const a of [-hw + 1, hw - 1]) { const p = at(a, hl - 1); for (let y = y0 + 4; y <= y0 + 5; y++) put(p.x, y, p.z, B("oak_fence")); put(p.x, y0 + 6, p.z, B("flowering_azalea_leaves"), { persistent_bit: true }); }   // vision: a house's proportions
    for (let a = -hw + 1; a <= hw - 1; a++) { const p = at(a, hl - 1); put(p.x, y0 + 6, p.z, B("azalea_leaves"), { persistent_bit: true }); }   // vision: a house's proportions
  }
  const lamp = at(hw, hl + 1);
  put(lamp.x, y0, lamp.z, B("flower_pot"));
  if (n % 2 === 0) { const l2 = at(-hw, hl + 1); put(l2.x, y0, l2.z, B("lantern")); }
}

/** A sector of a ring of land: white houses along its street, olives and cypresses between, never over a channel, a dock or a bridge. */
function* ringSector(hp, ring, a0, a1) {
  const out = [], put = putter(out);
  const rIn = RR[ring - 1], rOut = RR[ring], mid = (rIn + rOut) / 2, y0 = SEA + P.land + 1;
  const ok = (a, r, half) => { for (let t = -half; t <= half; t += 2) for (const dr of [-half, 0, half]) { const k = cityKind(hp, Math.round(hp.x + Math.cos(a + t / r) * (r + dr)), Math.round(hp.z + Math.sin(a + t / r) * (r + dr))); if (k?.kind !== "landring") return false; } return true; };
  // the street: a white path round the ring's middle
  for (let s = a0 * mid; s < a1 * mid; s += 0.5) {
    const a = s / mid;
    for (let w = -1; w <= 1; w++) {
      const x = Math.round(hp.x + Math.cos(a) * (mid + w)), z = Math.round(hp.z + Math.sin(a) * (mid + w));
      if (cityKind(hp, x, z)?.kind === "landring") put(x, y0 - 1, z, STONE);
    }
  }
  yield;
  // houses either side of the street, trees between
  const every = 9;   // vision: a house every nine blocks along each side
  for (const side of [-1, 1]) {
    const r = mid + side * ((rOut - rIn) / 4 + 0.5);   // vision: the rings' streets and houses
    for (let a = a0 + (side > 0 ? 0 : every / 2 / r); a < a1; a += every / r) {
      const n = hash(Math.round(a * 1000), ring, side, hp.seed, 631);   // given: hash salt
      const x = Math.round(hp.x + Math.cos(a) * r), z = Math.round(hp.z + Math.sin(a) * r);
      const room = Math.min(4, (rOut - rIn) / 4 - 1);   // vision: the rings' streets and houses
      if (!ok(a, r, room + 1)) continue;
      if (n % 4 === 0) { theranTree(put, x, y0 - 1, z, n); continue; }          // vision: a garden in one plot of four
      const hw = 2 + (n % 2), hl = 2 + ((n >> 2) % 2), storeys = ring === 4 && n % 3 === 0 ? 2 : 1;   // vision: a house's size
      theranHouse(put, x, z, y0, hw, hl, storeys, cardinalOut(a + (side > 0 ? Math.PI : 0)), n);   // the door to the street
      if (n % 5 === 1) { const t = a + 5 / r; theranTree(put, Math.round(hp.x + Math.cos(t) * r), y0 - 1, Math.round(hp.z + Math.sin(t) * r), n + 1); }   // vision: a tree by some houses
    }
    yield;
  }
  return out;
}

/** The rings' walls (brass, tin, orichalcum), the bridges' parapets, the channels' lamps. */
function* rings(hp) {
  const out = [], put = putter(out);
  const land = SEA + P.land;
  const walls = [[RR[4] - 1, THERAN.metal.brass], [RR[2] - 1, THERAN.metal.tin], [RR[0] - 1, THERAN.metal.orichalcum]];   // given: Critias 116b, brass outermost, then tin, orichalcum round the citadel
  for (const [R, metal] of walls) {
    const seen = new Set();
    for (let s = 0; s < TAU * R * 2; s++) {
      if (s % 64 === 63) yield;   // vision: the walls and lamps
      const a = s / (R * 2);
      const x = Math.round(hp.x + Math.cos(a) * R), z = Math.round(hp.z + Math.sin(a) * R);
      const key = `${x},${z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const k = cityKind(hp, x, z);
      if (!k || !["landring", "hub"].includes(k.kind)) continue;
      let pass = false;
      for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]) { const n = cityKind(hp, x + i, z + j); if (n && ["bridge", "tunnel", "quay", "basin"].includes(n.kind)) pass = true; }   // vision: the walls and lamps
      if (pass) continue;
      put(x, k.deckTop + 1, z, STONE);
      put(x, k.deckTop + 2, z, metal, metal === THERAN.metal.orichalcum ? { lit: true } : {});
    }
    yield;
  }
  for (const a of hp.bridgeA) for (let r = RR[0]; r <= P.shore; r++) for (const w of [-P.bridgeHalf - 0.5, P.bridgeHalf + 0.5]) {   // the bridges' white parapets, lamps every six
    const x = Math.round(hp.x + Math.cos(a) * r - Math.sin(a) * w), z = Math.round(hp.z + Math.sin(a) * r + Math.cos(a) * w);
    const k = cityKind(hp, x, z);
    if (!k || k.kind !== "bridge") continue;
    put(x, k.deckTop + 1, z, r % 6 === 0 ? B("lantern") : B("smooth_quartz_slab"), r % 6 === 0 ? {} : { "minecraft:vertical_half": "bottom" });   // vision: a lamp every six
  }
  yield;
  const ca = Math.cos(hp.straitA), sa = Math.sin(hp.straitA);
  for (let r = P.shore + 4; r <= P.lagoon.inner[1]; r += 16) for (const w of [-(P.canal.half + 1), P.canal.half + 1]) {   // the canal's lamp posts across the lagoon   // vision: a lamp every sixteen
    const x = Math.round(hp.x + ca * r - sa * w), z = Math.round(hp.z + sa * r + ca * w);
    if (cityKind(hp, x, z)?.kind !== "lagoon") continue;
    for (let y = SEA - P.lagoon.depth; y <= SEA + 2; y++) put(x, y, z, PILE, { pillar_axis: "y" });
    put(x, SEA + 3, z, B("lantern"));   // vision: the walls and lamps
  }
  for (const R of [RR[1], RR[2], RR[3], RR[4]]) for (const w of [-(P.canal.half + 1), P.canal.half + 1]) {   // lamps at the covered channels' mouths   // vision: the walls and lamps
    const x = Math.round(hp.x + ca * R - sa * w), z = Math.round(hp.z + sa * R + ca * w);
    put(x, land + 1, z, B("lantern"));
  }
  return out;
}

/** The great harbour: each people's dry dock in the city, in its own wood and stone, with its Table. */
function* harbour(hp) {
  const out = [];
  const deck = SEA + P.deck, G = P.great;
  for (const h of hp.harbour) {
    const s = YARD_STYLES[h.key];
    const c = new Canvas();
    dryDockWorks(c, s, { left: G.half, right: G.half, length: G.length });
    const inner = [-G.half - 1, G.half + 1], outer = [-G.half - 2, G.half + 2];
    for (let u = -2; u < G.length; u++) for (let w = outer[0]; w <= outer[1]; w++) {
      if (u === -1 && w === 0) continue;
      const innerRing = (u === -1 && w >= inner[0] && w <= inner[1]) || (u >= -1 && inner.includes(w));
      const outerRing = u === -2 || outer.includes(w);
      if (!innerRing && !outerRing) continue;
      if (innerRing) { c.put(u, w, 0, MARBLE); continue; }
      const post = outer.includes(w) && (u === -2 || u === G.length - 1 || (u + 2) % 6 === 0);   // vision: a post every six
      if (!post) continue;
      c.put(u, w, 1, s.accent ?? B("spruce_fence"));
      c.put(u, w, 2, s.light ?? B("lantern"));
    }
    c.settle(s.accent && /fence/.test(s.accent) ? s.accent : B("spruce_fence"));
    for (const cell of c.list()) { const p = toWorld(h.o, h.d, cell.u, cell.w); out.push({ x: p.x, y: deck + cell.dy, z: p.z, id: cell.id, states: statesFor(cell, h.d) }); }
    const t = toWorld(h.o, h.d, -1, 0);
    out.push({ x: t.x, y: deck, z: t.z, id: TABLE, states: {} });
    yield;
  }
  return out;
}

/** The quay, the market where the peoples meet, the arrival, the bell, the raft. */
function* quay(hp) {
  const out = [], put = putter(out);
  const a = hp.aq, ca = Math.cos(a), sa = Math.sin(a);
  const at = (r, w, y) => ({ x: Math.round(hp.x + ca * r - sa * w), y, z: Math.round(hp.z + sa * r + ca * w) });
  for (let r = P.shore; r <= P.shore + P.quay.length; r++) for (const w of [-2, 2]) {   // the Castaway Quay: driftwood on piles
    const p = at(r, w, SEA + 2);
    if (r % 4 === 0) for (let y = SEA - 4; y <= SEA + 2; y++) put(p.x, y, p.z, B("stripped_spruce_log"), { pillar_axis: "y" });   // vision: a pile every four
    else put(p.x, SEA + 2, p.z, B("spruce_fence"));
  }
  put(hp.bell.x, hp.bell.y - 1, hp.bell.z, B("stripped_spruce_log"), { pillar_axis: "y" });
  put(hp.bell.x, hp.bell.y, hp.bell.z, B("bell"), { attachment: "standing", direction: 0 });
  const fire = at(P.shore + P.quay.length, 1, SEA + 1);
  put(fire.x, SEA + 2, fire.z, B("campfire"));
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) put(hp.raft.x + i, SEA, hp.raft.z + j, B("bamboo_mosaic"));
  put(hp.raft.x, SEA + 1, hp.raft.z, B("barrel"));
  yield;
  // the market: a stall for each people along the shore, its awning in its colours, its goods out; long tables between
  const deck = SEA + P.deck + 1, rm = P.shore - 7;   // vision: the quay and the market
  const keys = Object.keys(YARD_STYLES);
  const AWNING = { norse: "red", european: "blue", birchbark: "white", pacific: "yellow", indian_ocean: "orange", east_asian: "red", japanese: "light_blue", dugout: "brown", shallow: "green", arctic: "light_gray" };
  const GOODS = { norse: "barrel", european: "hay_block", birchbark: "birch_log", pacific: "melon_block", indian_ocean: "orange_terracotta", east_asian: "bamboo_block", japanese: "cherry_log", dugout: "dried_kelp_block", shallow: "mud_bricks", arctic: "packed_ice" };
  const span = hp.market.a1 - hp.market.a0;
  keys.forEach((key, i) => {
    const th = hp.market.a0 + (span * (i + 0.5)) / keys.length;
    const cx = Math.round(hp.x + Math.cos(th) * (rm + (i % 2 ? 3 : -3))), cz = Math.round(hp.z + Math.sin(th) * (rm + (i % 2 ? 3 : -3)));   // vision: the quay and the market
    const fence = YARD_STYLES[key].accent && /fence/.test(YARD_STYLES[key].accent) ? YARD_STYLES[key].accent : B("oak_fence");
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { put(cx + a, deck, cz + b, fence); put(cx + a, deck + 1, cz + b, fence); }
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(cx + a, deck + 2, cz + b, B(`${AWNING[key] ?? "white"}_wool`));
    put(cx, deck, cz, B(GOODS[key] ?? "barrel"), /_log$|hay_block|bamboo_block/.test(GOODS[key] ?? "") ? { pillar_axis: "y" } : {});
    put(cx + 1, deck, cz, B("barrel"));
  });
  for (let k = 0; k < 3; k++) {                                                   // long tables where they sit together   // vision: the quay and the market
    const th = hp.market.a0 + (span * (k + 1)) / 4;   // vision: the quay and the market
    for (let t = -3; t <= 3; t++) {   // vision: the quay and the market
      const x = Math.round(hp.x + Math.cos(th) * rm - Math.sin(th) * t), z = Math.round(hp.z + Math.sin(th) * rm + Math.cos(th) * t);
      put(x, deck, z, B("oak_fence")); put(x, deck + 1, z, B("oak_pressure_plate"));
    }
  }
  yield;
  return out;
}

/** The breakwaters' lamps and their gate towers: round, white, capped in bronze. */
function* moles(hp) {
  const out = [], put = putter(out);
  for (const [key, o] of hp.outer) {
    if (o.kind !== "mole" || !o.edge) continue;
    const [x, z] = key.split(",").map(Number);
    if ((x * 7 + z * 13) % 23 === 0) put(x, o.deckTop + 1, z, B("lantern"));   // vision: a lamp now and then
  }
  yield;
  for (const g of hp.gateTowers) {
    for (let y = SEA + 4; y <= SEA + 14; y++) disc(put, g.x, y, g.z, 3, (y - SEA) % 5 === 4 ? B("waxed_cut_copper") : STONE);   // vision: the tower's height and its bands
    disc(put, g.x, SEA + 15, g.z, 3, MARBLE, true);   // vision: the breakwaters' towers and lamps
    put(g.x, SEA + 16, g.z, B("lantern"));   // vision: the breakwaters' towers and lamps
  }
  return out;
}

/** A stretch of a cliff town: white cave houses on the inner face's ledges, roofs level with the next ledge, scaffolds between. */
function* townSector(hp, t0, t1) {
  const out = [], put = putter(out);
  const levels = Math.floor(P.caldera.height[1] / P.ledge);
  for (let lv = 0; lv < levels; lv++) {
    for (let th = t0; th < t1; ) {
      const rim = rimAt(hp, th);
      const L = SEA + 1 + P.ledge * lv;
      let sa = null, sb = null;
      for (let s = 0; s < P.caldera.face; s += 0.5) {   // vision: half-block steps
        const top = faceTop(rim, s);
        if (sa === null && top >= L) sa = s;
        if (top >= L + P.ledge) { sb = s; break; }
      }
      const r = rim.Rin + (sb ?? 0);
      const stepA = P.town.every / Math.max(20, r);   // vision: a house every so many blocks
      const cOff = canalOff(hp, Math.cos(th) * r, Math.sin(th) * r);
      if (sa === null || sb === null || sb - sa < 3 || L + P.ledge > SEA + rim.H || (cOff.along > hp.straitIn - 10 && Math.abs(cOff.across - straitBow(hp, cOff.along)) <= straitHalf(hp, cOff.along) + 6) || hash(Math.round(th * 1000), lv, hp.seed, 621) % 10 < 3) { th += stepA; continue; }   // given: hash salt   // vision: three in ten left open
      const scaffold = hash(Math.round(th * 1000), lv, hp.seed, 622) % 5 === 0;   // given: hash salt   // vision: now and then a way up
      const cx = hp.x + Math.cos(th) * r, cz = hp.z + Math.sin(th) * r;
      for (let x = Math.floor(cx) - 4; x <= Math.ceil(cx) + 4; x++) for (let z = Math.floor(cz) - 4; z <= Math.ceil(cz) + 4; z++) {   // vision: the house's reach
        const rr = Math.hypot(x + 0.5 - hp.x, z + 0.5 - hp.z), tt = Math.atan2(z + 0.5 - hp.z, x + 0.5 - hp.x);
        const depth = rim.Rin + sb - rr, tau = angDiff(tt, th) * rr;
        if (depth <= 0 || depth > 3 || Math.abs(tau) > 2.5) continue;               // vision: a house three deep and five wide
        if (scaffold) { if (Math.abs(tau) < 0.5 && depth > 2) for (let y = L + 1; y <= L + P.ledge; y++) put(x, y, z, B("scaffolding")); continue; }
        const front = depth > 2, side = Math.abs(tau) > 1.5;   // vision: a cave house
        for (let y = L + 1; y < L + P.ledge; y++) {
          if (!front && !side) continue;
          if (front && Math.abs(tau) <= 0.5 && y <= L + 2) continue;               // the doorway
          if (front && !side && Math.abs(tau) > 0.5 && y === L + 2) { put(x, y, z, B("light_blue_stained_glass")); continue; }
          put(x, y, z, front && Math.abs(tau) <= 0.5 ? B("blue_concrete") : B("white_concrete"));
        }
        put(x, L + P.ledge, z, B("white_concrete"));                              // the roof: the next ledge's street
      }
      th += stepA;
    }
    if (lv % 2 === 1) yield;
  }
  return out;
}

/** A people's quarter, as its agent laid it out: its level 2 dock, its buildings, its trees, its arched bridge and its lamps. */
function* quarter(hp, q) {
  const out = [], s = q.style, D = SIM.dock;
  const deck = SEA + P.deck;
  const { o, d } = q.dock;
  const c = new Canvas();
  const inner = [-D.left - 1, D.right + 1], outer = [-D.left - 2, D.right + 2];
  const every = Math.max(2, s.every ?? 4);   // vision: a quarter's fittings
  for (let u = -2; u < D.length; u++) for (let w = outer[0]; w <= outer[1]; w++) {   // the dock's walkways, posts and lights
    if (u === -1 && w === 0) continue;
    const innerRing = (u === -1 && w >= inner[0] && w <= inner[1]) || (u >= -1 && inner.includes(w));
    const outerRing = u === -2 || outer.includes(w);
    if (!innerRing && !outerRing) continue;
    if (innerRing) { c.put(u, w, 0, s.wall); continue; }
    const post = outer.includes(w) && (u === -2 || u === D.length - 1 || (u + 2) % every === 0);
    if (!post) { c.put(u, w, 0, s.deck ?? s.wall); continue; }
    c.put(u, w, 0, s.post, { axis: "y" });
    if (s.accent) c.put(u, w, 1, s.accent);
    if (s.light && (u === -2 || u === D.length - 1 || (u + 2) % (every * 2) === 0)) c.put(u, w, s.accent ? 2 : 1, s.light);
  }
  for (const [u, w] of [[3, -6], [4, -6], [3, 6], [10, 6], [11, 6]]) c.put(u, w, 1, B("barrel"));   // vision: a working dock's barrels
  c.settle(s.accent && /fence/.test(s.accent) ? s.accent : B("spruce_fence"));
  for (const cell of c.list()) {
    const p = toWorld(o, d, cell.u, cell.w);
    const k = cityKind(hp, p.x, p.z);
    if (!k || !("deckTop" in k)) continue;                                        // only where there's ground under it
    out.push({ x: p.x, y: deck + cell.dy, z: p.z, id: cell.id, states: statesFor(cell, d) });
  }
  const t = toWorld(o, d, -1, 0);
  out.push({ x: t.x, y: deck, z: t.z, id: TABLE, states: {} });
  yield;
  let n0 = 0;
  for (const piece of q.pieces) {                                                 // the buildings, each where its agent put it
    for (const cell of piece.canvas.list()) {
      const p = toWorld(piece.o, piece.d, cell.u, cell.w);
      out.push({ x: p.x, y: deck + cell.dy, z: p.z, id: cell.id, states: statesFor(cell, piece.d) });
      if (++n0 % 400 === 0) yield;   // vision: a few hundred blocks a step
    }
    for (const pl of piece.canvas.piles) { const p = toWorld(piece.o, piece.d, pl.u, pl.w); for (let y = deck - 1; y >= SEA - 4; y--) out.push({ x: p.x, y, z: p.z, id: pl.id, states: /_log$/.test(pl.id) ? { pillar_axis: "y" } : {} }); }   // vision: a quarter's fittings
  }
  yield;
  for (const tr of q.trees ?? []) for (const b of treeBlocks(tr.kind, tr.x, deck, tr.z, tr.h, hp.seed)) out.push({ x: b.x, y: b.y, z: b.z, id: b.id, states: b.states ?? {} });   // its own trees
  yield;
  const w = q.wing;                                                               // its bridge: two white columns where it leaves the rings, its people's lamps along it
  if (w) {
    const pts = w.pts;
    const norm = (k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)]; const L = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: -(b.z - a.z) / L, z: (b.x - a.x) / L }; };
    const n = norm(1);
    for (const sd of [-1, 1]) {
      const g = { x: Math.round(pts[1].x + n.x * sd * (w.hw + 1)), z: Math.round(pts[1].z + n.z * sd * (w.hw + 1)) };
      for (let y = deck + 1; y <= deck + 4; y++) put0(out, g.x, y, g.z, MARBLE);   // vision: the gate columns' height
      put0(out, g.x, deck + 5, g.z, s.light ?? B("lantern"), torchy(s.light));   // vision: a quarter's fittings
    }
    for (let k = w.lamps; k < pts.length - 2; k += w.lamps) {
      const nn = norm(k);
      for (const sd of [-1, 1]) {
        const x = Math.round(pts[k].x + nn.x * sd * Math.max(0.5, w.hw - 0.5)), z = Math.round(pts[k].z + nn.z * sd * Math.max(0.5, w.hw - 0.5));
        const top = cityKind(hp, x, z)?.deckTop ?? deck;
        put0(out, x, top + 1, z, s.accent ?? B("spruce_fence"));
        put0(out, x, top + 2, z, s.light ?? B("lantern"), torchy(s.light));
      }
    }
  }
  return out;
}
const put0 = (out, x, y, z, id, states = {}) => out.push({ x, y, z, id, states });

/** The port's parts and the box each covers (so a chunk builds only what reaches it). */
function partList(hp) {
  if (hp.parts) return hp.parts;
  const g = P.chart.radius + 3, l = 10;   // vision: each part's reach
  const R = P.lagoon.inner[1] + 2;
  const list = [
    { name: "chart", box: [hp.x - g, hp.z - g, hp.x + g, hp.z + g], make: () => chart(hp) },
    { name: "light", box: [hp.light.x - l, hp.light.z - l, hp.light.x + l, hp.light.z + l], make: () => pharos(hp) },
    { name: "rings", box: [hp.x - R, hp.z - R, hp.x + R, hp.z + R], make: () => rings(hp) },
    { name: "harbour", box: [hp.x - RR[5], hp.z - RR[5], hp.x + RR[5], hp.z + RR[5]], make: () => harbour(hp) },   // vision: each part's reach
    { name: "quay", box: [hp.x - P.shore - P.quay.length - 6, hp.z - P.shore - P.quay.length - 6, hp.x + P.shore + P.quay.length + 6, hp.z + P.shore + P.quay.length + 6], make: () => quay(hp) },   // vision: each part's reach
  ];
  const xs0 = [...hp.outer.keys()].map((k) => k.split(",").map(Number));
  if (xs0.length) list.push({ name: "moles", box: [Math.min(...xs0.map((p) => p[0])) - 4, Math.min(...xs0.map((p) => p[1])) - 4, Math.max(...xs0.map((p) => p[0])) + 4, Math.max(...xs0.map((p) => p[1])) + 4], make: () => moles(hp) });   // vision: each part's reach
  const sector = 0.5;   // vision: a ring of houses is built half a radian at a time
  for (const ring of [2, 4]) for (let a = 0; a < TAU; a += sector) {   // vision: each part's reach
    const b = a + sector, Rr = RR[ring] + 8;   // vision: each part's reach
    const xs = [a, (a + b) / 2, b].map((t) => hp.x + Math.cos(t) * Rr), zs = [a, (a + b) / 2, b].map((t) => hp.z + Math.sin(t) * Rr);
    xs.push(hp.x); zs.push(hp.z);
    list.push({ name: `ring${ring}_${a.toFixed(1)}`, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], make: () => ringSector(hp, ring, a, b) });
  }
  for (const q of hp.quarters) {
    const xs = [q.apron[0], q.apron[2]], zs = [q.apron[1], q.apron[3]];   // vision: each part's reach
    for (const p of q.pieces) { xs.push(p.rect[0], p.rect[2]); zs.push(p.rect[1], p.rect[3]); }   // vision: each part's reach
    for (const p of q.wing?.pts ?? []) { xs.push(p.x); zs.push(p.z); }
    for (const t of q.trees ?? []) { xs.push(t.x); zs.push(t.z); }
    list.push({ name: `q${q.i}`, box: [Math.min(...xs) - 8, Math.min(...zs) - 8, Math.max(...xs) + 8, Math.max(...zs) + 8], make: () => quarter(hp, q) });   // vision: crowns, gates and lamps reach out
  }
  const tsec = 0.3;   // vision: a town is built a third of a radian at a time
  for (const [k, t] of hp.towns.entries()) for (let a = t.a0; a < t.a1; a += tsec) {
    const b = Math.min(t.a1, a + tsec);
    const xs = [], zs = [];
    for (const th of [a, (a + b) / 2, b]) for (const r of [rimAt(hp, th).Rin - 4, rimAt(hp, th).Rin + P.caldera.face + 4]) { xs.push(hp.x + Math.cos(th) * r); zs.push(hp.z + Math.sin(th) * r); }   // vision: the face's reach
    list.push({ name: `town${k}_${a.toFixed(2)}`, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], make: () => townSector(hp, a, b) });
  }
  hp.parts = list;
  return list;
}

/** A chunk's share of the port's buildings, built a part at a time (each part once, then kept). */
export function* cityBlocksSteps(seed, hp, cx, cz) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK, x1 = x0 + CHUNK - 1, z1 = z0 + CHUNK - 1;
  const out = [];
  for (const part of partList(hp)) {
    const [a, b, c, d] = part.box;
    if (c < x0 || a > x1 || d < z0 || b > z1) continue;
    const key = `${seed}|${hp.x},${hp.z}|${part.name}`;
    if (!parts.has(key)) {
      const made = yield* part.make();
      parts.set(key, bucket(made));
    }
    out.push(...(parts.get(key).get(`${cx},${cz}`) ?? []));
    yield;
  }
  return out;
}

/** Whether a place is within the island or its harbour (sites and structures keep clear of it). */
export function inPort(hp, x, z, margin = 0) {
  if (!hp) return false;
  const r = Math.hypot(x - hp.x, z - hp.z);
  if (r > P.radius + margin) return false;
  if (Math.hypot(x - hp.light.x, z - hp.light.z) <= P.moles.reach + margin) return true;   // the outer harbour
  return r <= rimAt(hp, Math.atan2(z - hp.z, x - hp.x)).coast + margin;
}

/** The quarters' names, what their agents made, and where each Table stands, for the logbook and the labs. */
export function portQuarters(hp) {
  return hp.quarters.map((q) => ({ key: q.key, name: q.style.name, tradition: q.style.tradition, ground: q.rules.ground, table: { ...toWorld(q.dock.o, q.dock.d, -1, 0), y: SEA + P.deck }, wing: q.wing && { form: q.wing.form, length: q.wing.length }, pieces: q.pieces.map((p) => p.which), trees: q.trees?.length ?? 0, log: q.log }));
}
