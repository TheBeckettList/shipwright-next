// Pure. The beat: one clock every timer in the mod keeps time by, so work that exchanges data meets
// on shared beats, and heavy work never lands on the same tick by accident.
//
// Three facts set it up (the tempo lens, lasim.mjs tempo, checks each):
//   1. The golden law keeps its own time. Mod n it comes round in pisano(n) ticks: mod 3 in 8 (the
//      trit breath), mod 5 in 20 (one Minecraft second, which is a given: 20 ticks a second), mod 25
//      in 100. Those are beats the math already has.
//   2. Every timer the mod runs today has a period that divides the bar (200 ticks, ten seconds), so
//      timers already meet at matched harmonics (Seedworld's nested-tempo rule). Keep it so: a new
//      timer's period must divide the bar (the harmonic gate).
//   3. But every timer starts at phase 0, so on tick 0 of every bar all of them fire together. The
//      phase plan spreads them: heaviest first, each to the phase where the bar's busiest tick is
//      least busy, starting from the golden-ratio phase (the most even spread a sequence can have).
//
// In the game (later): `fires(name, t)` replaces `t % period === 0`, and `system.runInterval(fn, p)`
// becomes a call on the beat that runs fn when `fires` says so. Periods stay what they are; only
// phases move, so nothing's pace changes.
import { pisano, lcmAll, divisors } from "./field.js";

export const PHI = (1 + Math.sqrt(5)) / 2;   // given: the golden ratio, F's eigenvalue
export const BAR = 200;                       // vision: ten seconds, the longest timer's period

/** The golden law's own tempos that fit a bar: pisano(n) for n up to `nMax`, if it divides the bar. */
export function goldenBeats(bar = BAR, nMax = 60) {
  const out = [];
  for (let n = 2; n <= nMax; n++) {
    const p = pisano(n);
    if (Number.isFinite(p) && bar % p === 0 && !out.some((b) => b.period === p)) out.push({ n, period: p });
  }
  return out.sort((a, b) => a.period - b.period);
}

/**
 * The mod's timers today (BP/scripts, from every runInterval and every `t % k` inside the steering
 * tick). cost: a weight for how heavy one firing is (1 light, 3 a scan of entities or players,
 * 8 block work or a job). The weights are vision, a first guess for the lens: runlab.mjs can
 * measure them, and they should be replaced by what it reads.
 */
export const CENSUS = [
  { name: "steering.tick", file: "steering.js:1171", period: 1, cost: 3, group: "motion" },
  { name: "crew.shots", file: "crew.js:473", period: 1, cost: 1, group: "motion" },
  { name: "crew.gunners", file: "crew.js:450", period: 2, cost: 1, group: "motion" },
  { name: "buoyancy", file: "buoyancy.js:167", period: 2, cost: 3, group: "motion" },
  { name: "seaworld.arrivals", file: "seaworld.js:538", period: 2, cost: 1, group: "world" },
  { name: "steering.deck", file: "steering.js:1098", period: 5, cost: 3, group: "motion", inside: "steering.tick" },
  { name: "steering.wind", file: "steering.js:1099", period: 5, cost: 1, group: "motion", inside: "steering.tick" },
  { name: "edit.ghost", file: "edit.js:231", period: 5, cost: 1, group: "ui", transient: true },
  { name: "steering.smoke", file: "steering.js:768", period: 8, cost: 1, group: "motion", inside: "steering.tick" },
  { name: "steering.stats", file: "steering.js:1144", period: 10, cost: 1, group: "ui", inside: "steering.tick" },
  { name: "dock.outline", file: "dock.js:264", period: 10, cost: 3, group: "ui", transient: true },
  { name: "seaworld.chunks", file: "seaworld.js:561", period: 10, cost: 8, group: "world" },
  { name: "seaworld.portals", file: "seaworld.js:589", period: 10, cost: 3, group: "world" },
  { name: "steering.chests", file: "steering.js:1154", period: 20, cost: 3, group: "world" },
  { name: "seaworld.haze", file: "seaworld.js:541", period: 20, cost: 3, group: "world" },
  { name: "boatblock.drift", file: "boatblock.js:263", period: 20, cost: 3, group: "world" },
  { name: "crew.bells", file: "crew.js:484", period: 20, cost: 1, group: "motion", inside: "crew.shots" },
  { name: "steering.exposure", file: "steering.js:1110", period: 20, cost: 8, group: "motion", inside: "steering.tick" },
  { name: "charts.treasure", file: "charts.js:391", period: 40, cost: 1, group: "world" },
  { name: "seaworld.peoples", file: "seaworld.js:547", period: 40, cost: 8, group: "world" },
  { name: "steering.pegs", file: "steering.js:1173", period: 100, cost: 3, group: "world" },
  { name: "steering.wear", file: "steering.js:1142", period: 100, cost: 3, group: "motion", inside: "steering.tick" },
  { name: "logbook", file: "logbook.js:60", period: 100, cost: 3, group: "world" },
  { name: "pregen.watch", file: "pregen.js:136", period: 100, cost: 3, group: "world" },
  { name: "boatblock.tides", file: "boatblock.js:251", period: 100, cost: 8, group: "world" },
  { name: "seaworld.life", file: "seaworld.js:575", period: 100, cost: 8, group: "world" },
  { name: "theran.welcome", file: "theran.js:47", period: 200, cost: 1, group: "ui" },
  { name: "boatblock.wash", file: "boatblock.js:259", period: 200, cost: 8, group: "world" },
];

/** The harmonic gate: every period divides the bar. Returns the timers that fail it. */
export const offBeat = (timers, bar = BAR) => timers.filter((t) => bar % t.period !== 0);

/** Load on each tick of one bar: the sum of the cost of every timer that fires there. */
export function profile(timers, phases = {}, bar = BAR) {
  const load = new Array(bar).fill(0);
  for (const t of timers) {
    const ph = phases[t.name] ?? 0;
    for (let k = ph % t.period; k < bar; k += t.period) load[k] += t.cost;
  }
  return load;
}
export function stats(load) {
  const peak = Math.max(...load), mean = load.reduce((a, b) => a + b, 0) / load.length;
  return { peak, mean: +mean.toFixed(2), ratio: +(peak / mean).toFixed(2), peakAt: load.indexOf(peak) };
}

/**
 * The phase plan. Every-tick timers keep phase 0 (they have no other). The rest, heaviest first:
 * start from the golden-ratio phase of their rank, then take whichever phase in their period gives
 * the lowest bar peak (ties to the golden one). `pin` fixes phases by name (a timer that must read
 * another's result one tick later, say). Pure and deterministic: same census, same plan.
 */
export function phasePlan(timers, { bar = BAR, pin = {} } = {}) {
  const phases = { ...pin };
  const load = new Array(bar).fill(0);
  const lay = (t, ph) => { for (let k = ph; k < bar; k += t.period) load[k] += t.cost; };
  for (const t of timers) if (t.name in pin) lay(t, pin[t.name] % t.period);
  const rest = timers.filter((t) => !(t.name in pin)).sort((a, b) => b.cost * (bar / b.period) - a.cost * (bar / a.period) || a.period - b.period || a.name.localeCompare(b.name));
  rest.forEach((t, rank) => {
    if (t.period === 1) { phases[t.name] = 0; lay(t, 0); return; }
    const golden = Math.floor(((rank / PHI) % 1) * t.period);
    let best = golden, bestPeak = Infinity, bestSum = Infinity;
    for (let d = 0; d < t.period; d++) {
      const ph = (golden + d) % t.period;
      let pk = 0, sum = 0;
      for (let k = ph; k < bar; k += t.period) { pk = Math.max(pk, load[k] + t.cost); sum += load[k]; }
      if (pk < bestPeak || (pk === bestPeak && sum < bestSum)) { best = ph; bestPeak = pk; bestSum = sum; }
    }
    phases[t.name] = best;
    lay(t, best);
  });
  return phases;
}

/** Ticks at which two timers both fire, in one bar: where they can exchange (the nested-tempo rule). */
export function meetings(a, b, phases = {}, bar = BAR) {
  const out = [];
  for (let k = 0; k < bar; k++) if ((k - (phases[a.name] ?? 0)) % a.period === 0 && (k - (phases[b.name] ?? 0)) % b.period === 0) out.push(k);
  return out;
}

/** The game-side test (pure): does the timer `t` fire on tick `tick`, under a plan? */
export const fires = (t, tick, phases = {}) => (((tick - (phases[t.name] ?? 0)) % t.period) + t.period) % t.period === 0;

export { pisano, lcmAll, divisors };
