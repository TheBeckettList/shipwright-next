// Pure. Life that costs nothing: everything here is a closed form of the clock and of what the world
// already knows (its folk, its buildings, its catch, its lanes). Nothing is stored, nothing is
// stepped; it's asked only where someone can see it, and then it's exactly what it would be.
// When it is shown, the tempo's gap filler (core/tempo.js fillGaps) gives its updates only the
// ticks where the world's own work is below its mean: it fills the gaps and never raises a peak.
//
// Each:  rung    how often it changes (clock.js), the slot the gap filler finds a phase for
//        show    (ctx) -> what's there now (counts, or on/off), from ctx { p, soc, place, when, built }
import { RUNGS } from "../core/clock.js";

const night = (w) => w.part === "night" || w.part === "dusk";
const summer = (w) => (1 + w.warmth) / 2;

export const AMBIENT = [
  { name: "seabirds over the fishing grounds", rung: "second", show: ({ p, when }) => Math.round(VIEW.BIRDS * Math.min(1, p.food.fish / Math.max(1, p.chunks)) * (when.part === "dawn" ? 1 : when.part === "morning" ? 0.6 : 0.2) * (0.5 + summer(when))) },   // vision: the day's draw
  { name: "hearth smoke", rung: "second", show: ({ built, when }) => Math.round(built * (night(when) || when.part === "dawn" ? 1 : 0.2) * (1.5 - summer(when))) },   // vision: the day's draw
  { name: "lamps lit", rung: "beat", show: ({ built, when }) => (night(when) ? built : 0) },
  { name: "nets drying", rung: "beat", show: ({ soc, when }) => (when.part === "afternoon" || when.part === "dusk" ? Math.round((soc.professions.fisherman ?? 0) / 2) : 0) },
  { name: "washing out", rung: "day", show: ({ when, built }) => (when.warmth > 0 && when.day % RUNGS.breath === 0 && when.part === "morning" ? Math.round(built / 2) : 0) },
  { name: "children playing", rung: "beat", show: ({ soc, when }) => (when.part === "morning" || when.part === "afternoon" ? Math.round(soc.folk / VIEW.CHILDREN) : 0) },
  { name: "market bustle", rung: "beat", show: ({ place }) => place.market },
  { name: "dolphins on the lanes", rung: "second", show: ({ soc, when }) => (soc.fleet.kind === "cargo" ? Math.round(soc.fleet.boats * VIEW.DOLPHINS * (0.5 + summer(when))) : 0) },
  { name: "a feast", rung: "day", show: ({ when }) => FEASTS.find((f) => Math.abs(when.dayOfYear - f.day) <= VIEW.FEAST_DAYS)?.name ?? null },
];
export const VIEW = Object.freeze({ BIRDS: 24, CHILDREN: 8, DOLPHINS: 0.5, FEAST_DAYS: 2 });   // vision: the most birds a ground draws; folk to a child; dolphins a cargo ship; a feast's days either side
// the year's feasts (none sacred): midsummer (the pulse's point), the harvest home (autumn's end), midwinter (the half-breath), the first boats out (spring's middle)
export const FEASTS = [{ name: "midsummer", day: 0 }, { name: "the harvest home", day: 135 }, { name: "midwinter", day: 180 }, { name: "the first boats out", day: 270 }];   // vision: the days of the year (360)

/** All the ambient life at a people's place now. */
export const lifeAt = (ctx) => Object.fromEntries(AMBIENT.map((a) => [a.name, a.show(ctx)]).filter(([, v]) => v));
