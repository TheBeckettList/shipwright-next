// Pure. The wind: the planet's belts, no weather. Where the real ones lie (VISION.BELTS): calm at the
// equator, steady trades from the north-east (south-east below the line), calm horse latitudes,
// strong westerlies, polar easterlies. The Earth's turning (Coriolis) is why they blow from those
// quarters; the belts carry it already, so the same table serves both hemispheres, mirrored.
//
// Gusts are the trit line (field.js): one golden breath on a Mobius loop of GUST_LINE cells, stepped
// once a second (20 ticks, the golden law's own period mod 5), laid over the sea in GUST_CELL-block
// stripes. Matter is a gust, antimatter a lull, empty the steady wind: deterministic, reversible,
// and it breathes, so the same water comes back to the same gusts every breath.
import { VISION, D } from "./given.js";
import { breathTable, pisano } from "./field.js";
import { latOf } from "./globe.js";
import { mod } from "./fixed.js";

const RAD = Math.PI / 180;                     // given: degrees to radians
const GUSTS = breathTable(VISION.GUST_LINE);   // 2 x GUST_LINE rows
export const GUST_BEAT = pisano(5);            // derived: 20 ticks, one second (the golden law mod 5)

/** The belt at a latitude, blended into its neighbour near the boundary: { name, speed m/s, from (deg) }. */
export function belt(lat) {
  const a = Math.abs(lat), B = VISION.BELTS, half = VISION.BELT_BLEND / 2;
  let i = B.findIndex(([top]) => a <= top);
  if (i < 0) i = B.length - 1;
  const [top, name, speed, from] = B[i];
  const north = lat >= 0;
  const mirror = (f) => (north ? f : 180 - f);   // given: the southern hemisphere's belts are the northern ones mirrored
  let sp = speed, fr = mirror(from);
  const next = B[i + 1];
  if (next && a > top - half) {                   // hand over across the boundary
    const k = (a - (top - half)) / (2 * half);
    const [, , s2, f2] = next;
    const v1 = toward(mirror(from), speed), v2 = toward(mirror(f2), s2);
    const e = v1.e + (v2.e - v1.e) * k, s = v1.s + (v2.s - v1.s) * k;
    sp = Math.hypot(e, s);
    fr = mod(Math.atan2(-e, s) / RAD, 360);
  }
  return { name, speed: sp, from: fr };
}
/** A wind of `speed` from bearing `from`, as the vector it blows toward (east, south), m/s. */
export function toward(from, speed) {
  const b = (from + 180) * RAD;                   // given: wind blows toward the opposite bearing
  return { e: Math.sin(b) * speed, s: -Math.cos(b) * speed };
}
/** The trit under a world point at tick t: +1 gust, -1 lull, 0 steady. */
export function gustTrit(x, z, t) {
  const row = GUSTS[mod(Math.floor(t / GUST_BEAT), GUSTS.length)];
  const cell = Math.floor(x / VISION.GUST_CELL) + Math.floor(z / VISION.GUST_CELL);
  return row[mod(cell, row.length)];
}
/** The wind at a world point (blocks) and tick: m/s toward (east, south), plus its belt. */
export function windAt(x, z, t) {
  const b = belt(latOf(z));
  const g = 1 + VISION.GUST * gustTrit(x, z, t);
  const v = toward(b.from, b.speed * g);
  return { ...v, speed: b.speed * g, from: b.from, belt: b.name };
}
/** The same in blocks a tick (motion is 1:1: a metre a second is a twentieth of a block a tick). */
export const windBpt = (x, z, t) => { const w = windAt(x, z, t); return { e: w.e * D.MPS, s: w.s * D.MPS }; };
