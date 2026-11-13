// Pure (given a loaded map). Pirates: the sea's outlaws, out of the raider peoples' bad years.
//
//   who      a raider (or hungry wary) people in a waning month puts out a band; the band's tier
//            is how long its home has been waning (a month: Reavers; a season: Freebooters; half a
//            year: Pirate lords, the old mod's Illager eras)
//   how many bounded by the Therans (continuance.js BOUNDS.PIRATES of the peoples): the strongest
//            bands sail, the Therans' patrols keep the rest in port
//   where    a band works the lane between its home and the richest trade nearby (its target):
//            where it is at tick t is a closed form, back and forth along the great circle, so a
//            band far away costs nothing and is exactly where it should be when a ship comes near
//   crew     vanilla Illagers, as the old mod: pillagers, a vindicator or evoker for a captain
import { league } from "./league.js";
import { BOUNDS } from "./continuance.js";
import { peoples } from "./peoples.js";
import { loop } from "./history.js";
import { GIVEN, D } from "../core/given.js";
import { RUNGS } from "../core/clock.js";

export const TIERS = [
  { tier: 1, era: "Reavers", crew: ["minecraft:pillager"], captain: "minecraft:vindicator" },
  { tier: 2, era: "Freebooters", crew: ["minecraft:pillager", "minecraft:vindicator"], captain: "minecraft:pillager" },
  { tier: 3, era: "Pirate lords", crew: ["minecraft:pillager", "minecraft:vindicator"], captain: "minecraft:evoker" },   // vision: the tiers' crews
];
let N0 = null;
const neutral = () => N0 ?? (N0 = new Set(league().states.flatMap((st) => st.peoples.map((p) => p.key))));
export const PIRATE = Object.freeze({ SPEED: 0.25, CREW: [4, 8], TIER_MONTHS: [1, 3, 6] });   // vision: a band's speed (blocks a tick), crew by tier, and the waning months in a row that make each tier

/** The bands sailing in month m (records: every month's end so far; baked: that month's bake). */
export function bandsIn(y, records, baked) {
  const L = loop(), rec = records[y];
  const cand = [];
  L.forEach((p, i) => {
    const temper = baked.tempers.get(p.key) ?? p.temper;
    if (rec[i] !== -1 || !(temper === "raiders" || temper === "wary") || !p.target || neutral().has(p.key)) return;   // no pirates from the neutral Koinon
    let run = 0;
    for (let k = y; k >= 0 && records[k][i] === -1; k--) run++;
    const tier = PIRATE.TIER_MONTHS.filter((m) => run >= m).length;
    cand.push({ home: p.key, target: p.target, tier, strength: run * p.arms + p.capacity / 100 });   // vision: arms and months of want make a band strong
  });
  cand.sort((a, b) => b.strength - a.strength);
  const cap = Math.round(BOUNDS.PIRATES * L.length);
  return { sailing: cand.slice(0, cap).map((b) => ({ ...b, ...TIERS[b.tier - 1] })), kept: Math.max(0, cand.length - cap) };
}
/** Where a band is at tick t: back and forth along its lane (fraction 0 at home, 1 at the target). */
export function bandAt(band, t) {
  const by = peoples().byKey, a = by.get(band.home), b = by.get(band.target), C = D.PX;
  let dx = b.cx - a.cx; const W = D.CELLS_W; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
  const len = Math.hypot(dx, b.cz - a.cz) * C, period = (2 * len) / PIRATE.SPEED;
  const u = ((t % period) + period) % period / period, f = u < 0.5 ? 2 * u : 2 - 2 * u;
  return { f, x: (a.cx + dx * f) * C, z: (a.cz + (b.cz - a.cz) * f) * C, beats: Math.round(period / RUNGS.beat) };
}
