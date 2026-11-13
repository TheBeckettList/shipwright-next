// Pure (given a loaded map). The observer: step into the world at any tick and see it as it is there:
// a people, one of its villagers, or a place. Everything is read off the math (no state is kept by
// the observer), so looking changes nothing, and the same question always gets the same answer.
import { when, RUNGS } from "../core/clock.js";
import { fold } from "../core/globe.js";
import { windAt } from "../core/wind.js";
import { tideAt, wavesAt, currentEast } from "../core/sea.js";
import { GIVEN, D } from "../core/given.js";
import { peoples, dayOf } from "./peoples.js";
import { loop, firstWorld, bake } from "./history.js";
import { societyOf, ranks } from "./society.js";
import { monthRecords } from "./buildings.js";
import { economy } from "./economy.js";
import { whereAt, rosterAt } from "./folk.js";
import { JOBS } from "./jobs.js";
import { lifeAt } from "./ambient.js";
import { climateAt } from "./climate.js";
import { chunkHeight } from "./map.js";
import { bandsIn, bandAt } from "./pirates.js";

const monthsTo = (t) => { const w = when(t); return w.year * (RUNGS.year / RUNGS.month) + w.month; };
/** The world's state at the end of the month before tick t's month: record, bake, economy. */
function worldAt(t) {
  const m = monthsTo(t), recs = monthRecords(Math.max(1, m + 1)), w = firstWorld();
  w.record = (m > 0 ? recs[m - 1] : w.record).slice();
  return { m, w, baked: bake(w), econ: economy(Math.max(1, m)), recs };
}
const byKey = (key) => { const p = peoples().byKey.get(key) ?? loop()[Number(key)] ?? loop().find((q) => q.tradition === key); if (!p) throw new Error(`no people "${key}"`); return p; };

/** A people now: who they are, their fortune and temper, what they want and do (and why), their folk, stores, buildings, fleet, borders, and the life about them. */
export function observePeople(key, t) {
  const p = byKey(key), { m, w, baked, econ } = worldAt(t), i = loop().indexOf(p), s = econ.state[i];
  const soc = societyOf(p, baked, w), place = whereAt(p, soc, t), c = when(t);
  const built = s.built.filter(Boolean).length, rank = ranks(new Map(loop().map((q, k) => [q.key, w.record[k]]))).get(p.key);
  const top = Object.entries(s.stock).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${Math.round(n)} ${id.replace("minecraft:", "")}`);   // vision: a thousand ticks an hour, twenty a second
  const borders = baked.borders.filter((b) => b.a === p.key || b.b === p.key).map((b) => `${b.a === p.key ? b.b : b.a} ${b.state} (lean ${b.lean})`);
  const events = econ.events.filter((e) => e.at === p.key || e.by === p.key || e.who === p.key).slice(-5).map((e) => `month ${e.m}: ${e.what}${e.by && e.by !== p.key ? ` by ${e.by}` : ""}${e.at && e.at !== p.key ? ` at ${e.at}` : ""}`);   // vision: a thousand ticks an hour, twenty a second
  return {
    who: `${p.key}: ${p.tradition} ${p.living}, ${rank} of its tradition, ${s.tier}`, when: `year ${c.year}, month ${c.month + 1}, day ${c.dayOfYear} (${c.season}), ${c.part}`,
    fortune: w.record[i], temper: soc.temper, goal: soc.goal, doing: soc.action, why: soc.why, today: dayOf(p, t),
    folk: soc.folk, where: Object.fromEntries(["home", "work", "docks", "market", "sea", "thera"].map((k) => [k, place[k]])), professions: soc.professions,
    stores: top, hunger: +s.hunger.toFixed(2), built: `${built} of ${s.plan.length}: ${s.plan.filter((_, k) => s.built[k]).map((b) => b.name).join(", ")}`,
    fleet: `${soc.fleet.boats} ${soc.fleet.kind} boats, damage ${Math.round(s.fleetDamage * 100)}%, short this month of ${Object.entries(s.fleetShort ?? {}).map(([k, v]) => `${k} ${v}%`).join(", ") || "nothing"}`,
    borders, events, moved: s.moves, life: lifeAt({ p, soc, place, when: c, built }),
  };
}
/** One villager now: who they are this beat, how they're dressed, where they are and what they're doing. */
export function observeVillager(key, id, t) {
  const p = byKey(key), { w, baked } = worldAt(t), soc = societyOf(p, baked, w), c = when(t);
  const r = rosterAt(soc, t, p.tradition), v = r[id % r.length], J = JOBS[v.role] ?? JOBS.folk;
  const working = J.hours.includes(c.part);
  const at = !working ? (c.part === "night" ? "home, asleep" : c.part === "dusk" ? "at the market" : "home") :
    v.role === "fisherman" ? (c.part === "dawn" ? "out at the fishing grounds" : "at the docks with the catch") :
    v.role === "shipwright" ? "at the slip, on a hull" : v.role === "farmer" || v.role === "shepherd" ? "out in the fields" : v.role === "miner" ? "in the quarry" : J.at ? `at the ${J.at.replace(/^\w+:/, "").replace(/_/g, " ")}` : "about the village";
  const making = working ? Object.entries(J.makes(p, 1)).map(([k, n]) => `${k.replace("minecraft:", "")} (${Math.round(n)} a month)`).join(", ") : "";
  return { villager: `${p.key} #${v.id}`, when: `${c.season}, ${c.part}, beat ${c.beat}`, role: v.role, dress: `${v.dress} villager, ${v.role}'s clothes`, at, making, people: soc.action };
}
/** A place now (blocks): ground, climate, sea, wind, who's near, pirates near. */
export function observePlace(x, z, t) {
  const f = fold(x, z), cx = Math.floor(f.x / D.PX), cz = Math.floor(f.z / D.PX), c = climateAt(cx, cz);
  const wv = wavesAt(f.x, f.z, t), wind = windAt(f.x, f.z, t);
  let near = null;
  for (const p of peoples().list) { let dx = Math.abs(p.cx - cx); dx = Math.min(dx, 2048 - dx); const d = Math.hypot(dx, p.cz - cz); if (!near || d < near.d) near = { key: p.key, d }; }   // given: the map's chunks round
  const { m, baked, recs } = worldAt(t);
  const bands = bandsIn(Math.max(0, m - 1), recs, baked).sailing.map((b) => ({ b, at: bandAt(b, t) })).filter((x) => Math.hypot(x.at.x - f.x, x.at.z - f.z) < 1500).map((x) => `${x.b.era} of ${x.b.home}, ${Math.round(Math.hypot(x.at.x - f.x, x.at.z - f.z))} blocks off`);   // vision: within sight of a lookout (blocks)
  return { at: `${Math.round(f.x)}, ${Math.round(f.z)} (lat ${c.lat.toFixed(1)})`, ground: c.h > 0 ? `${c.biome.id}, ${c.h} blocks up` : `${c.biome.id}, ${-c.h} deep`, climate: `${c.T.toFixed(0)} C, moisture ${c.M.toFixed(2)}`,
    wind: `${wind.speed.toFixed(1)} m/s from ${wind.from.toFixed(0)} (${wind.belt})`, sea: c.h > 0 ? null : `Hs ${wv.Hs.toFixed(1)}, period ${(wv.period / 20).toFixed(1)} s, surface ${wv.eta.toFixed(2)}, tide ${tideAt(f.x, f.z, t, -c.h).toFixed(2)}, current ${(currentEast(f.z) * 20).toFixed(2)} m/s east`,
    nearest: `${near.key}, ${Math.round(near.d * D.PX)} blocks`, pirates: bands };
}
