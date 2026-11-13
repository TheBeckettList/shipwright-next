// The observer: step into the world and look.
//   node tools/observe.mjs people <key|index|tradition> [--t tick | --month m --hour h]
//   node tools/observe.mjs villager <key> <id> [--t ...]
//   node tools/observe.mjs place <x> <z> [--t ...]
//   node tools/observe.mjs follow <key> <id> [--hours 0,3,8,12,18]          a villager through a day
//   node tools/observe.mjs year <key> [--hour h]                           a people month by month
import { loadMap } from "../world/load.js";
import { observePeople, observeVillager, observePlace } from "../world/observer.js";
import { RUNGS, YEAR_TICKS } from "../core/clock.js";
const a = process.argv.slice(2), opt = (k, d) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : d);
const tickOf = (month, hour) => { const base = Math.round(month * RUNGS.month * RUNGS.day); return base + ((((hour * 1000 - base) % RUNGS.sky) + RUNGS.sky) % RUNGS.sky); };   // given: a thousand ticks an hour
const t = opt("t") !== undefined ? Number(opt("t")) : tickOf(Number(opt("month", 0)), Number(opt("hour", 3)));
loadMap();
const show = (o) => console.log(JSON.stringify(o, null, 1));
const [cmd, ...rest] = a.filter((x, i) => !x.startsWith("--") && !(i > 0 && a[i - 1].startsWith("--")));
if (cmd === "people") show(observePeople(rest[0], t));
else if (cmd === "villager") show(observeVillager(rest[0], Number(rest[1] ?? 0), t));
else if (cmd === "place") show(observePlace(Number(rest[0]), Number(rest[1]), t));
else if (cmd === "follow") for (const h of opt("hours", "0,3,8,12,18").split(",").map(Number)) { const v = observeVillager(rest[0], Number(rest[1] ?? 0), tickOf(Number(opt("month", 0)), h)); console.log(`hour ${String(h).padStart(2)}: ${v.role.padEnd(13)} ${v.at.padEnd(30)} ${v.making}`); }
else if (cmd === "year") for (let m = 0; m < 12; m++) { const o = observePeople(rest[0], tickOf(m, Number(opt("hour", 3)))); console.log(`month ${String(m + 1).padStart(2)}: fortune ${String(o.fortune).padStart(2)} ${o.temper.padEnd(8)} ${o.doing.padEnd(6)} goal ${o.goal.padEnd(7)} hunger ${o.hunger}  ${o.built.split(":")[0]} built, fleet ${o.fleet.split(",")[1].trim()}${o.events.length ? "  | " + o.events.at(-1) : ""}`); }
else console.log("people | villager | place | follow | year  (see the header)");
