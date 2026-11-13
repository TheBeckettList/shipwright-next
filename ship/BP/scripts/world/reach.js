// Pure. The Drowned Reach: Boatblock's sea, a region of the same sea world where the archipelagos
// lie drowned. The island groups are where the math puts them, with their climates and peoples, but
// the ground is lowered by a sink, so most become reefs, shoals and bars; only the tallest heights
// still break the surface as islets, and the great islands and volcanoes stand as they are. The
// sink fades to nothing at the rim, so sailing out of the Reach brings you back to the full world.
//
// One world, two ways to play it: start at the homeport (homeport.js) and sail out, or take the
// castaway raft from the homeport to the Reach's heart and start with nothing (boatblock.js).
import { rand } from "./noise.js";
import { greatAt, groupAt, GREAT_CELL, GROUP_CELL } from "./terrain.js";
import { columnAt } from "./lattice.js";

/** Vision numbers for the Reach. */
export const REACH = Object.freeze({
  dist: 6000,          // vision: its heart lies this far from the middle of the world, east or west (same latitude as home)
  R: 1600,             // vision: the mainland ring: no sink at all beyond this radius
  sink: 16,            // vision: how far the ground is lowered at the heart (blocks)
  margin: 600,         // vision: the homeport is never chosen within this of the rim
  step: 400,           // vision: how far along the latitude the heart moves to keep clear of mainlands
  clear: 1000,         // vision: no great island's shore nearer the heart than this
  vent: 500,           // vision: no volcano nearer the heart than this
});

/** Whether a heart here keeps clear of the great islands and volcanoes (which never drown). */
function clearHeart(seed, x, z) {
  const gx = Math.floor(x / GREAT_CELL), gz = Math.floor(z / GREAT_CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const g = greatAt(seed, gx + i, gz + j);
    if (g && Math.hypot(g.x - x, g.z - z) - g.R * g.stretch < REACH.clear) return false;
  }
  const cx = Math.floor(x / GROUP_CELL), cz = Math.floor(z / GROUP_CELL);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const g = groupAt(seed, cx + i, cz + j);
    if (g?.special === "volcano" && Math.hypot(g.x - x, g.z - z) < REACH.vent) return false;
  }
  return true;
}

const centres = new Map();
/** The Reach's heart. */
export function reachCentre(seed) {
  let c = centres.get(seed);
  if (!c) {
    const side = rand(seed, 701) < 0.5 ? -1 : 1;   // given: hash salt
    c = { x: side * REACH.dist, z: 0 };
    for (let k = 0; k <= 12; k++) {                // vision: how far it may move along the latitude (12 steps)
      const x = side * (REACH.dist + k * REACH.step);
      if (clearHeart(seed, x, 0)) { c = { x, z: 0 }; break; }
    }
    centres.set(seed, c);
  }
  return c;
}

/** How far the ground is lowered here: the full sink at the heart, fading as (r/R)^4, none past R. */
export function sinkAt(seed, x, z) {
  const c = reachCentre(seed);
  const dx = x - c.x, dz = z - c.z;
  const R = REACH.R;
  if (Math.abs(dx) > R || Math.abs(dz) > R) return 0;
  const q = (dx * dx + dz * dz) / (R * R);
  return q >= 1 ? 0 : REACH.sink * (1 - q * q);
}

/** Whether a place lies within the Reach, plus a margin. */
export function inReach(seed, x, z, margin = 0) {
  const c = reachCentre(seed);
  return Math.hypot(x - c.x, z - c.z) < REACH.R + margin;
}

/**
 * Where the crew's castaway raft is moored: on the bar of the drowned group nearest the Reach's
 * heart (a flat shows beside it at low water), or at the heart itself if nothing lies near.
 */
const rafts = new Map();
export function raftSpot(seed) {
  if (rafts.has(seed)) return rafts.get(seed);
  const c = reachCentre(seed);
  let spot = { x: c.x, z: c.z };
  const cx = Math.floor(c.x / GROUP_CELL), cz = Math.floor(c.z / GROUP_CELL);
  const groups = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const g = groupAt(seed, cx + i, cz + j); if (g && !g.special) groups.push(g); }   // vision: two cells round
  groups.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
  search: for (const g of groups) for (let r = 0; r <= g.R * 1.4; r += 3) for (let a = 0; a < 16; a++) {   // vision: a ray every 22.5 degrees, every 3 blocks
    const x = Math.round(g.x + Math.cos((a / 16) * Math.PI * 2) * r), z = Math.round(g.z + Math.sin((a / 16) * Math.PI * 2) * r);   // vision: the Reach
    const col = columnAt(seed, x, z);
    if (!col.land && col.depth === 1) { spot = { x, z }; break search; }
  }
  rafts.set(seed, spot);
  return spot;
}
