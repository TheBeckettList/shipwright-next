// Pure. Exact integers: the state of anything that moves is held in fixed point (Q units a block,
// TURN units a turn), so a step and its undo are the same arithmetic run backward, bit for bit.
// Angles look up a table (built once from Math.sin, then only ever read), so a step never depends
// on how an engine rounds a transcendental.
import { VISION } from "./given.js";

export const Q = VISION.Q, TURN = VISION.TURN, HALF = TURN / 2, QUARTER = TURN / 4;   // given: a half and a quarter turn
const STEPS = VISION.SINE_STEPS, PER = TURN / STEPS;
export const SINE = Object.freeze(Array.from({ length: STEPS }, (_, i) => Math.round(Math.sin((2 * Math.PI * i) / STEPS) * Q)));

export const mod = (a, m) => ((a % m) + m) % m;
export const toQ = (x) => Math.round(x * Q);
export const fromQ = (a) => a / Q;
/** sin of an angle in TURN units, in Q units (exact lookup, nearest step). */
export const sinQ = (a) => SINE[Math.floor(mod(a, TURN) / PER)];
export const cosQ = (a) => sinQ(a + QUARTER);
/** Q x Q -> Q, rounded half away from zero (the same both ways). */
export const mulQ = (a, b) => { const p = a * b; return Math.sign(p) * Math.round(Math.abs(p) / Q); };
export const angle = (deg) => Math.round((mod(deg, 360) / 360) * TURN);       // degrees -> TURN units
export const degrees = (a) => (mod(a, TURN) / TURN) * 360;
/** An angle difference folded to (-HALF, HALF]. */
export const turnDiff = (a, b) => { const d = mod(a - b, TURN); return d > HALF ? d - TURN : d; };
/** Bearing (TURN units, 0 north, clockwise) of a vector in the map's (east, south) frame. */
export const bearingOf = (e, s) => angle((Math.atan2(e, -s) * 180) / Math.PI);
