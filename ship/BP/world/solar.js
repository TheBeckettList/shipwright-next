// Pure (given a loaded map). The Therans' solar rite: the warmth the world runs on.
//
// The world's sun (climate.js: heat falls with latitude) leaves the middle latitudes cold: Thera
// itself, at 38 degrees, reads as taiga. That shortfall is the Therans' work. At every year's end,
// with the continuance (and the new year opens at midsummer, the pulse at its point), the Therans
// keep the solar rite: their Library's reckoning of the sun, and the warmth it brings back to the
// world. Between rites the warmth fades; the rite restores it. Without the Therans, the world would
// slide back cold, year on year: the bump at the end of every year is necessary.
//
//   shape    the sun's own geometry: the rite's warmth goes as sin(2 |latitude|), nothing at the
//            equator (already the sun's) or the poles (beyond any rite), most at 45 degrees, where
//            the world's sun falls shortest
//   size     derived: just enough that Thera, over the year, keeps the mild band's middle (the
//            temperate climate of its crops: the cherry band, 9 to 21 C), so the Therans' island
//            reads as theirs; A = (15 - T_thera) / sin(2 * lat_thera)
//   the year the warmth is freshest just after the rite and fades evenly toward the next: a
//            sawtooth of depth 1/phi^2 round its mean, so the year's mean is the shape times A.
//            The static world (biomes, peoples) is drawn at that mean; what turns with the year
//            (yields, folk, ice at sea) can read the day's own warmth
import { VISION, GIVEN, D } from "../core/given.js";
import { latOf } from "../core/globe.js";
import { chunkHeight } from "./map.js";
import { THERA } from "./thera.js";
import { PHI } from "../core/golden.js";
import { RUNGS } from "../core/clock.js";

export const SOLAR = Object.freeze({ TARGET: (9 + 21) / 2, FADE: 1 / PHI ** 2 });   // derived: the middle of the cherry band (9 to 21 C, biomes.js); the fade's depth a golden share
const RAD = Math.PI / 180;   // given
const shape = (lat) => Math.sin(2 * Math.abs(lat) * RAD);
/** The world's own sun at a chunk (before the rite): climate.js's heat, as a temperature. */
export function sunT(cx, cz) {
  const h = chunkHeight(cx, cz), lat = latOf((cz + 0.5) * D.PX);
  const heat = Math.max(0, 1 - (Math.abs(lat) / 90) ** VISION.HEAT_POW - Math.max(0, h) * VISION.LAPSE);
  return { T: VISION.TEMP[0] + (VISION.TEMP[1] - VISION.TEMP[0]) * heat, lat };
}
let A = null;
/** The rite's strength: derived from Thera's own place. */
export function riteStrength() {
  if (A !== null) return A;
  const t = sunT(THERA.seat.cx, THERA.seat.cz);
  return (A = Math.max(0, (SOLAR.TARGET - t.T) / shape(t.lat)));
}
/** The rite's warmth at a latitude, on day d of the year (d omitted: the year's mean). */
export function solarAt(lat, d = null) {
  const mean = riteStrength() * shape(lat);
  if (d === null) return mean;
  const f = ((d % RUNGS.year) + RUNGS.year) % RUNGS.year / RUNGS.year;   // 0 just after the rite, 1 just before the next
  return mean * (1 + SOLAR.FADE * (0.5 - f));
}
const AT45 = 45;   // given: the latitude where the rite is strongest (sin 2 lat is 1)
/** The rite itself, at a year's end: what the Therans restore (logged with the continuance). */
export function rite(year) {
  return { year, what: "the solar rite", strength: +riteStrength().toFixed(2), restores: +(riteStrength() * SOLAR.FADE).toFixed(2), at45: +solarAt(AT45).toFixed(2), atThera: +solarAt(sunT(THERA.seat.cx, THERA.seat.cz).lat).toFixed(2) };
}
