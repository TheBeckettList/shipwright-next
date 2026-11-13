// Pure. Minecraft's limits, as the units the sea world's laws are written in.
//
// Three kinds of number, and no fourth (the inherency lens, tools/lab/inherency.mjs, lists the rest):
//   givens   what Minecraft fixes. GIVEN is the same on every device; MEASURED varies by device and
//            is filled by the probe (/scriptevent shipwright:probe, probe.js) and saved with the world.
//   vision   what we choose (vision.js, and BUDGET below): ratios, or multiples of a given.
//   derived  laws: pure functions of givens and vision, here and in laws.js.
//
// The split that matters: the WORLD is derived only from GIVEN, so every device builds the same world
// from the same seed. MEASURED may only set the PACING: how fast and in what order it's delivered,
// the haze, the caches. A slower device sees the same world through a closer haze. (A test holds the
// world modules to this: none of them imports MEASURED or pacing.)
//
// Three scales, and each phenomenon says which it lives on:
//   motion     1:1 in space and time, under Minecraft's gravity (boats, waves as felt, currents, shot)
//   sky clock  time / 72: a day is 20 minutes (tide, storms' lives, the sun)
//   map        distance / MAP_SCALE: equator to pole is POLE blocks, not 10,000 km (climate, wind
//              belts, storms' size, fetch)

/** Minecraft's fixed units. */
export const GIVEN = Object.freeze({
  BLOCK: 1,                 // metres
  TICK: 1 / 20,             // seconds
  CHUNK: 16,                // blocks
  DAY: 24000,               // ticks
  G: 0.08,                  // gravity, blocks per tick per tick (32 b/s2), entities
  DRAG: 0.98,               // entities' air drag, kept each tick
  SPIKE: 100,               // ms: the watchdog warns of a tick's script over this
  HANG: 3000,               // ms: and may stop the script over this
  MEMORY: 250,              // MB: the script's memory limit
});

/** Earth's, for carrying real laws in (Froude similarity). */
export const EARTH = Object.freeze({ G: 9.81, QUARTER_MERIDIAN: 10002000, DAY_S: 86400 });

/** The sky clock: how much faster Minecraft's day runs than Earth's. */
export const SKY_SCALE = EARTH.DAY_S / (GIVEN.DAY * GIVEN.TICK);                 // 72

/** The map scale, from the world's pole distance (a vision number, fields.js). */
export const mapScale = (pole) => EARTH.QUARTER_MERIDIAN / pole;                  // 1,111 at 9,000

/** Minecraft's gravity in blocks per second squared. */
export const G_PER_S2 = GIVEN.G / (GIVEN.TICK * GIVEN.TICK);                      // 32

/**
 * The device's limits. Until the probe has run, a guess near the Switch's; the probe replaces it
 * (and seaworld.js loads a saved reading at start).
 *   L      chunks kept loaded round a player (blocks can be read and set only inside)
 *   J      ms a tick the game gives script jobs
 *   kappa  how much slower the device runs our math than the lab's QuickJS (tools/lab/qjs.mjs):
 *          the labs' timings times kappa are the device's (QuickJS itself is about 45x slower than V8)
 *   fill0, fill1, set, get   native costs: a fill (per call, per block), a block set, a block read (ms)
 *   ymin, ymax               our dimension's height range
 *   weather                  whether our dimension has weather of its own
 */
export const DEFAULT_MEASURED = Object.freeze({ L: 6, J: 10, kappa: 1, fill0: 0.02, fill1: 0.00002, set: 0.008, get: 0.002, ymin: -64, ymax: 320, weather: null, probed: false });
let measuredNow = { ...DEFAULT_MEASURED };
export const measured = () => measuredNow;
/** Take a reading (the probe's, or a saved one); unknown fields keep their guess. */
export function setMeasured(m) {
  const ok = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
  const next = { ...DEFAULT_MEASURED };
  for (const k of Object.keys(DEFAULT_MEASURED)) if (m?.[k] !== undefined && (typeof DEFAULT_MEASURED[k] !== "number" || ok(m[k]) || k === "ymin")) next[k] = m[k];
  measuredNow = next;
  return next;
}

/** Vision: how much of each limit we let ourselves use (the budgets table, as ratios). */
export const BUDGET = Object.freeze({
  frontier: 0.7,            // chunk demand over supply, sailing flat out
  step: 0.2,                // a job's longest step, of a spike
  tick: 0.3,                // steady per-tick work, of the job slice
  memory: 0.16,             // caches, of the memory limit
});

// ---------------------------------------------------------------- the laws

/**
 * Frontier law: chunks a ship uncovers a tick over chunks the world can lay a tick. Above BUDGET.frontier
 * the world falls behind her. v blocks/tick; land the share of land about her; cLand, cSea ms a chunk.
 */
export function frontierLaw({ v, land, cLand, cSea }, m = measuredNow) {
  const cost = land * cLand + (1 - land) * cSea;
  return (v * (2 * m.L + 1) * cost) / (GIVEN.CHUNK * m.J);
}

/** The frontier law solved for speed: the fastest the world keeps up with, here. */
export function frontierSpeed({ land, cLand, cSea }, m = measuredNow) {
  const cost = land * cLand + (1 - land) * cSea;
  return (BUDGET.frontier * GIVEN.CHUNK * m.J) / ((2 * m.L + 1) * cost);
}

/** Haze law: the farthest a haze may reach and still end on laid ground. lag: ticks a chunk waits. */
export const hazeLaw = (v, lag, m = measuredNow) => GIVEN.CHUNK * (m.L - 0.5) - v * lag;

/** Depth Froude number: a hull's speed over the speed of a wave in water this deep. */
export const depthFroude = (v, depth) => v / Math.sqrt(GIVEN.G * Math.max(depth, 0.1));

/** Hull Froude number: a hull's speed over the speed of a wave her own length. */
export const hullFroude = (v, length) => v / Math.sqrt(GIVEN.G * Math.max(length, 0.1));

/**
 * Shallow water: the drag a hull feels as her depth Froude number nears 1 (the wave she makes can
 * run no faster than the shallow water lets it). A multiplier on drag, 1 in deep water.
 */
export const shallowDrag = (fd) => 1 / Math.sqrt(1 - Math.min(fd, 0.95) ** 2);

/** Tide law (sky clock): two highs a day. A blocks of range either way, phase in radians. */
export const tideLaw = (A, phase, t) => A * Math.cos((4 * Math.PI * t) / GIVEN.DAY - phase);

/** The tide's rate of rise (blocks a tick): what continuity turns into a stream. */
export const tideRate = (A, phase, t) => -A * ((4 * Math.PI) / GIVEN.DAY) * Math.sin((4 * Math.PI * t) / GIVEN.DAY - phase);

/** Continuity: water filling a basin of `area` through a channel of `section` runs this fast. */
export const continuityStream = (rate, area, section) => (rate * area) / Math.max(section, 1);

/**
 * Froude similarity: carry a real length and time into the game for a hull of s blocks per real
 * metre, so the numbers without units (wave height over length, Froude's) are kept.
 */
export const carryLength = (metres, s) => metres * s;
export const carryTime = (seconds, s) => seconds * Math.sqrt((s * EARTH.G) / G_PER_S2);

// ---------------------------------------------------------------- the pacing (may read MEASURED)

/** Full speed: the fastest a ship sails (blocks a tick), the frontier's worst case. */
export const V_FULL = 0.42;   // vision: a ship flat out on a fair wind

/**
 * What the device's limits make of the delivery: worked out once from a reading, then used as is.
 *   genRadius   chunks queued round a player: the loaded radius and one ring beyond, so the ring a
 *               ship is about to load is first in the queue the moment it does
 *   lookahead   ticks ahead the queue plans from: the time to cross half the loaded radius
 *   hazeReach   the farthest a haze may end at full speed, a chunk's wait taken off
 */
export function pacing(m = measuredNow) {
  const lookahead = Math.round((GIVEN.CHUNK * m.L) / 2 / V_FULL);
  return {
    genRadius: m.L + 1,
    lookahead,
    hazeReach: Math.max(GIVEN.CHUNK, Math.round(hazeLaw(V_FULL, GIVEN.CHUNK / V_FULL, m))),
  };
}
