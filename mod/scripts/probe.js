// The server's probes: what the game actually did, written to the server's log as one JSON line each
// ("[WWPROBE] {...}"), for the feedback loop (ww probes -> tools/calibrate.mjs). Every probe says what the
// sim predicted beside what the game saw, so the loop compares like with like.
import { world, system } from "@minecraft/server";
import { RESIDENTS, FOLK_BY_CHUNK, CULTURES } from "./data/folk.js";
import { PLACES, BY_CHUNK } from "./data/structures.js";
import { SEA } from "./game/ground.js";
import { CALIBRATION } from "./game/calibration.js";
import { FOLK, COUNT, isDone, planNow } from "./lay.js";

export const VERSION_TAG = "probe-1";
export function probe(kind, data) { console.warn(`[WWPROBE] ${JSON.stringify({ k: kind, t: system.currentTick, cal: CALIBRATION, ...data })}`); }

// ---- the frame rate: ticks a second against the clock, and what each duty of the tempo costs
let last = { tick: 0, ms: 0 };
export function tpsProbe(dim, tempo = null) {
  const now = { tick: system.currentTick, ms: Date.now() };
  if (last.ms) {
    const tps = ((now.tick - last.tick) * 1000) / (now.ms - last.ms);
    let folk = -1; try { folk = dim.getEntities({ type: FOLK }).length; } catch {}
    probe("tps", { tps: Math.round(tps * 100) / 100, players: world.getAllPlayers().length, folk, tempo });
  }
  last = now;
}

// ---- the holes in a player's view (the glitch the loading model counts: tools/flysim.mjs)
export function holesProbe(data) { probe("holes", data); }

// ---- a chunk laid: its cost (ms busy, of it jsms the sim's own reckoning; the game's calls and blocks)
export function chunkProbe(cx, cz, ms, before, kind, pass = {}) { probe("chunk", { cx, cz, ms, jsms: COUNT.js - before.js, fills: COUNT.fill - before.fill, sets: COUNT.set - before.set, vol: COUNT.vol - before.vol, kind, ...pass, folk: (FOLK_BY_CHUNK[`${cx},${cz}`] ?? []).length, structures: (BY_CHUNK[`${cx},${cz}`] ?? []).length }); }

// ---- a site, checked: the ground where the sim says it is, the folk's light, the folk still near home
export function siteProbe(dim, name, cx, cz) {
  const out = { name, cx, cz, ground: { cols: 0, holes: 0, wrongTop: 0 }, light: [], folk: { expected: 0, found: 0, nearHome: 0 } };
  const plan = planNow(cx, cz);   // the plan the layer laid by (the meshed relief where it uses it)
  for (const c of plan.cols) {
    if ((c.i + c.j) % 4) continue;   // a sample: every fourth column
    out.ground.cols++;
    try {
      const b = dim.getBlock({ x: c.x, y: c.top, z: c.z }), up = dim.getBlock({ x: c.x, y: c.top + 1, z: c.z });
      if (!b || b.typeId === "minecraft:air") out.ground.holes++;
      else if (c.top > SEA && b.typeId !== c.topId && up?.typeId === "minecraft:air") out.ground.wrongTop++;
    } catch {}
  }
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const k of FOLK_BY_CHUNK[`${cx + a},${cz + b}`] ?? []) {
    const f = RESIDENTS[k]; out.folk.expected++;
    try { const loc = { x: f[0], y: f[1], z: f[2] }; out.light.push([CULTURES[f[4]] ?? "league", dim.getLightLevel?.(loc) ?? -1, dim.getSkyLightLevel?.(loc) ?? -1]); } catch {}
  }
  try {
    const es = dim.getEntities({ type: FOLK, location: { x: (cx - 1) * 16, y: -64, z: (cz - 1) * 16 }, volume: { x: 48, y: 384, z: 48 } });
    out.folk.found = es.length;
    for (const e of es) { const k = e.getDynamicProperty("waterworld:folk"), f = typeof k === "number" ? RESIDENTS[k] : null; if (f && Math.hypot(e.location.x - f[0], e.location.z - f[2]) < 8) out.folk.nearHome++; }
  } catch {}
  probe("site", out);
  return out;
}

/** The soak's sites: the places, the first folk of every people (Thera and the towns), the open sea, the poles' edge, the equator. */
export function soakSites() {
  const sites = Object.entries(PLACES).map(([n, p]) => [n, p.x, p.z]), seen = new Set();
  RESIDENTS.forEach((f, k) => { const t = CULTURES[f[4]] ?? "league", far = Math.abs(f[0] - PLACES.spawn.x) > 2000 ? "town" : "Thera", key = `${t} ${far}`; if (!seen.has(key)) { seen.add(key); sites.push([`${t} (${far})`, f[0], f[2]]); } });
  sites.push(["open sea", 8, 8008], ["the cold seas", 5008, 1208], ["the equator", 20008, 8200]);   // vision: three sea samples off the land
  return sites;
}
