// Pure. Where a new arrival comes ashore: a beach of the nearest gentle island group to the middle of
// the world, by water a boat can be launched in, where two peoples' waters meet, so the world shows
// itself from the first day.
import { elevation, groupAt, climate, SEA_LEVEL } from "./terrain.js";
import { peopleAt, warmPlace } from "./peoples.js";
import { columnAt, STEP } from "./lattice.js";
import { inReach, REACH } from "./reach.js";

export function spawnPoint(seed) {
  if (spawnCache.has(seed)) return spawnCache.get(seed);
  const g = spawnSteps(seed);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

/** The search as steps (a group at a time), for a game job: in the game's interpreter it's half a second. */
export function* spawnSteps(seed) {
  if (spawnCache.has(seed)) return spawnCache.get(seed);
  let fallback = null;
  for (let r = 0; r < 14; r++) for (let gx = -r; gx <= r; gx++) for (let gz = -r; gz <= r; gz++) {
    if (Math.max(Math.abs(gx), Math.abs(gz)) !== r) continue;
    const g = groupAt(seed, gx, gz);
    yield;                                                       // a group looked at, a step
    if (!g || g.special || inReach(seed, g.x, g.z, REACH.margin)) continue;     // the homeport stands in the full world
    const t = climate(seed, g.x, g.z).key;
    if (!["temperate", "dry", "boreal", "savanna"].includes(t) || (t === "boreal" && r < 6)) continue;   // a gentle first landfall (boreal only if nothing milder is near)
    // walk out from the group's heart to find dry ground by water a boat can be launched in
    let spot = null;
    // (on the lattice the ground is laid from, a ray at a time: no step near the watchdog)
    for (let a = 0; a < 16 && !spot; a++) {
      for (let d = 0, k = 0; d <= g.R * 1.3; d += STEP) {
        if (++k % 8 === 0) yield;                                // eight new columns at most a step
        const x = Math.round(g.x + Math.cos((a / 16) * Math.PI * 2) * d), z = Math.round(g.z + Math.sin((a / 16) * Math.PI * 2) * d);
        const e = columnAt(seed, x, z);
        if (!e.land || e.top > SEA_LEVEL + 4) continue;
        if (yield* launchableSteps(seed, x, z)) { spot = { x: x + 0.5, y: e.top + 1, z: z + 0.5 }; break; }
      }
      yield;
    }
    if (!spot) continue;
    fallback ??= spot;
    // a landfall where two peoples' waters meet: the world shows itself from the first day
    const peoples = new Set();
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const n = groupAt(seed, gx + i, gz + j);
      if (!n || Math.hypot(n.x - spot.x, n.z - spot.z) > 1500) continue;
      yield* warmPlace(seed, n.x, n.z);                     // its people, a step at a time
      const p = peopleAt(seed, n.x, n.z, { neighbours: false });   // settled or not is all this needs
      yield;
      if (!p.unsettled && p.member) peoples.add(p.tradition);
    }
    if (peoples.size >= 2) { spawnCache.set(seed, spot); return spot; }
  }
  const s = fallback ?? { x: 0.5, y: SEA_LEVEL + 2, z: 0.5 };
  spawnCache.set(seed, s);
  return s;
}
const spawnCache = new Map();

/** The spawn if it's been worked out (never starts the search). */
export const spawnIfKnown = (seed) => spawnCache.get(seed) ?? null;

/** A spawn worked out earlier (kept with the world). */
export function knownSpawn(seed, sp) { spawnCache.set(seed, sp); }

/** Water two deep within 12 blocks: somewhere a boat can be put in (read off the lattice). */
export function launchable(seed, x, z) {
  const g = launchableSteps(seed, x, z);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
/** The same, a row of the lattice a step (a fresh row can ask for a few dozen new nodes). */
function* launchableSteps(seed, x, z) {
  for (let dx = -12; dx <= 12; dx += STEP) {
    for (let dz = -12; dz <= 12; dz += STEP) {
      const w = columnAt(seed, x + dx, z + dz);
      if (!w.land && w.depth >= 2) return true;
    }
    yield;
  }
  return false;
}

