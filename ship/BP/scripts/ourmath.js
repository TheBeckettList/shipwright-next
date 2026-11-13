// The ship module on Waterworld's math. Shipwright's steering keeps what it does well (the helm's input,
// seats, contacts, the anchor, wear, the projection onto the entity); how fast a hull goes under sail and
// under its crew, what the water takes back, and how far she heels come from core/boat.js: the same laws
// the trials (tools/boatsim.mjs) hold still and the voyages step. Units here: Shipwright's blocks a tick
// at the edges, metres a second inside (a block a metre, twenty ticks a second).
import { hullOf, sailSpeed, pullSpeed, sailPush, heelOf, waterDrag as coreDrag } from "../core/boat.js";
import { VISION, GIVEN } from "../core/given.js";
import { PHI, FIB } from "../core/golden.js";

const TPS = GIVEN.TICKS_PER_S;
const BELT_TOP = Math.max(...VISION.BELTS.map((b) => b[2]));   // given: a belt row's third entry is its speed (core/given.js BELTS)
export const STRENGTH_TOP = 1.4;   // given: Shipwright's strongest wind (wind.js MAX_STRENGTH): the strongest belt
/** Shipwright's wind strength as m/s. */
export const mps = (strength) => (strength * BELT_TOP) / STRENGTH_TOP;

// who pulls her, by Shipwright's propulsion styles, from world/boatsizes.js's crews: a pair to each room
// between the ends (a room a metre, the ends a length over phi cubed), a file of paddlers (two abreast past a
// beam of two), a sculling oar or a pole worked by two, a double paddle by one to each eight blocks, a great
// ship's four sweeps by three hands each
const KIND = { oars: "oars", sweeps: "oars", scull: "oars", paddles: "paddles", double_paddle: "paddles", pole: "poles" };
export function pullersFor(prop, L, B) {
  const rooms = Math.max(1, Math.floor(L - (2 * L) / PHI ** 3));   // vision: boatsizes' rooms, the ends a length over phi cubed
  if (prop === "oars") return 2 * rooms;   // vision: a pair to each room
  if (prop === "paddles") return rooms * (B > 2 ? 2 : 1);   // vision: two abreast past a beam of two
  if (prop === "double_paddle") return Math.max(1, Math.round(L / FIB[5]));   // vision: a paddler to each eight blocks
  if (prop === "sweeps") return Math.max(4 * FIB[3], Math.round((L * B) / FIB[6]));   // vision: four sweeps, three hands each at least; a great ship puts her whole deck crew on them (a hand to each 13 blocks of deck)
  if (prop === "pole") return 2 * Math.max(1, Math.round(L / FIB[4]));   // vision: a poler each side to each five blocks
  return 2;   // vision: a sculling oar worked by two
}

/** The core hull of a Shipwright handling record (computeHandling's numbers). */
export function coreHull(h, { fullness = VISION.HULL.CB, twin = false, outrigger = false, benchPull = 1 } = {}) {
  const pull = KIND[h.propulsion] ?? "oars", pullers = Math.round(pullersFor(h.propulsion, h.length, h.beam) * benchPull);
  return hullOf({ L: h.length, lb: h.length / Math.max(0.5, h.beam), full: fullness, rig: h.rig === "fore_and_aft" ? "fore_and_aft" : "square",   // vision: no beam under half a block
    pull, pullers, mast: h.mast || h.length / PHI, twin: twin ? 1 : outrigger ? 0.5 : 0, depth: h.depth });
}

// steady speeds are bisections: kept per hull, per whole degree off the wind and tenth of a m/s
const cache = new WeakMap();
const memo = (c, key, f) => { let m = cache.get(c); if (!m) cache.set(c, (m = new Map())); if (!m.has(key)) { if (m.size > 4096) m.clear(); m.set(key, f()); } return m.get(key); };   // vision: steady speeds kept per hull, at most 4096

// Shipwright measures `off` from where the wind blows to (0 dead downwind); core/boat.js from where it comes
// from (0 head to wind): one is a half turn less the other
export const twaOf = (off) => 180 - Math.min(180, Math.abs(off));   // given: a half turn in degrees
/** The speed the sail drives her to at `off` degrees off the wind in a wind of Shipwright strength `w` (blocks a tick). */
export function sailTargetBpt(c, off, w) {
  const W = Math.round(mps(w) * 10) / 10, a = Math.round(twaOf(off));   // vision: the wind to a tenth of a m/s
  return memo(c, `s${a},${W}`, () => sailSpeed(c, W, a)) / TPS;
}
/** The speed her crew holds her at (blocks a tick). */
export const pullBpt = (c) => memo(c, "p", () => pullSpeed(c)) / TPS;
/** Her hull speed (blocks a tick). */
export const hullBpt = (c) => c.hullSpeed / TPS;
/** What the water takes from her speed in one tick (blocks a tick, the new speed). */
export function dragStep(c, v) {
  const dv = coreDrag(Math.abs(v) * TPS, c) / TPS / TPS;   // m/s^2 over a tick, as blocks a tick
  return Math.sign(v) * Math.max(0, Math.abs(v) - dv);
}
/** How far the wind lays her over (degrees, unsigned), sailing `off` off a wind of strength `w` at speed v (blocks a tick). */
export function heelDeg(c, off, w, v) {
  return heelOf(c, sailPush(c, mps(w), twaOf(off), Math.abs(v) * TPS).across).heel;
}
