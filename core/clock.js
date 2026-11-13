// Pure. The world's one clock: every system keeps time by a rung of this ladder, and only by it.
// Every rung of the year is one of the golden law's own periods (field.js pisano): the year is 360
// days because the golden law mod 135 comes round in exactly 360, and its parts are periods too.
//
//   tick      1        motion (boats, waves felt)
//   breath    8        pisano 3: the trit breath (the edge ring)
//   second    20       pisano 5: gusts, chunk math
//   beat      100      pisano 25: the folk's moves, the town's freshening
//   day       24,000   pisano 25 x pisano 217 (100 x 240): Minecraft's own day, exactly. One step of the
//                      record (cycles.js), one turn of the sky, one round of everyone's day
//   month     30 days  pisano 22: the world re-bakes (borders, tempers, buildings, pirates)
//   season    90 days  pisano 181
//   year      360 days pisano 135: one breath of the realms' pulse (180 cells, 2 x 180 = 360), and
//                      the Therans' continuance. 8,640,000 ticks: 120 hours of play (a month ten hours,
//                      a season thirty), and every day of it a whole turn of the sky, so the folk's day,
//                      the record's step and the sun are one and every year opens at sunrise
//
// The year opens at midsummer (the pulse at its point); midwinter is its half-breath (the pulse's
// antimatter point, Seedworld). Everything finer than a rung is a closed form of the tick, asked and
// never stepped. Only the day steps (746 trits: the realms' pulse and the peoples' record), only the
// month re-bakes, only the year holds the world to its bounds.
import { pisano } from "./field.js";
import { GIVEN } from "./given.js";

export const YEAR_DAYS = pisano(135);                  // derived: 360
export const RUNGS = Object.freeze({
  tick: 1, breath: pisano(3), second: pisano(5), beat: pisano(25),   // derived: the golden law mod 3, 5, 25
  day: pisano(25) * pisano(217),                        // derived: 100 x 240 = 24,000, the sky's own day (pisano 217 = lcm of pisano 7 and pisano 31: 16 and 30)
  month: pisano(22), season: pisano(181), year: YEAR_DAYS,   // derived: in culture days: 30, 90, 360
  sky: GIVEN.DAY,                                       // given: Minecraft's day, in ticks (the hours)
});
export const YEAR_TICKS = RUNGS.year * RUNGS.day;      // derived: 8,640,000
if (RUNGS.day !== RUNGS.sky) throw new Error(`the day (${RUNGS.day}) must be the sky's (${RUNGS.sky})`);   // the one law the clock keeps with the game
export const SEASONS = Object.freeze(["summer", "autumn", "winter", "spring"]);   // the year starts at midsummer
const HOURS = 24;   // given: a day's hours
export const PART_HOURS = [1, 6, 11, 13, 23];   // vision: the hours (from sunrise) morning, afternoon, dusk, night and dawn begin

/** Where tick t sits on every rung. */
export function when(t) {
  const day = Math.floor(t / RUNGS.day), year = Math.floor(day / RUNGS.year), dayOfYear = ((day % RUNGS.year) + RUNGS.year) % RUNGS.year;
  const into = dayOfYear / RUNGS.year;
  const sx = (into + 1 / (2 * SEASONS.length)) % 1, s = Math.floor(sx * SEASONS.length);   // each season centred on its quarter
  const skyFrac = (((t % RUNGS.sky) + RUNGS.sky) % RUNGS.sky) / RUNGS.sky, hour = skyFrac * HOURS;   // 0 is sunrise in Minecraft
  return {
    beat: Math.floor(t / RUNGS.beat), day, year, dayOfYear, month: Math.floor(dayOfYear / RUNGS.month), into,
    season: SEASONS[s], seasonInto: sx * SEASONS.length - s,
    warmth: Math.cos(2 * Math.PI * into),   // derived: +1 at midsummer (the point), -1 at midwinter (the half-breath)
    hour, part: hour < PART_HOURS[0] || hour >= PART_HOURS[4] ? "dawn" : hour < PART_HOURS[1] ? "morning" : hour < PART_HOURS[2] ? "afternoon" : hour < PART_HOURS[3] ? "dusk" : "night",   // given: the five parts, in PART_HOURS' order
  };
}
