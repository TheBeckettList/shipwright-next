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
// The old mod's 28 timers, measured in the sim (lab/legacy_census.json): peak 90 on tick 0 of every
// bar; the phase plan brings it to 15 without changing one period.
//
// In the game (later): `fires(name, t)` replaces `t % period === 0`, and `system.runInterval(fn, p)`
// becomes a call on the beat that runs fn when `fires` says so. Periods stay what they are; only
// phases move, so nothing's pace changes.
import { pisano, lcm } from "./field.js";

export const PHI = (1 + Math.sqrt(5)) / 2;   // given: the golden ratio, F's eigenvalue
export const BAR = 200;                       // vision: ten seconds (the old mod's longest timer; every golden beat 8, 10, 20, 40, 100 divides it)

/** The golden law's own tempos that fit a bar: pisano(n) for n up to `nMax`, if it divides the bar. */
export function goldenBeats(bar = BAR, nMax = 60) {   // vision: the search reaches mod 60
  const out = [];
  for (let n = 2; n <= nMax; n++) {
    const p = pisano(n);
    if (Number.isFinite(p) && bar % p === 0 && !out.some((b) => b.period === p)) out.push({ n, period: p });
  }
  return out.sort((a, b) => a.period - b.period);
}

/** The world's timers: filled as systems are written (a name, a period, a cost weight, a group). */
export const CENSUS = [];

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

export const lcmAll = (xs) => xs.reduce((a, b) => lcm(a, b), 1);
export { pisano };

/**
 * Fill the gaps: give each light task (shown only where someone looks) a phase in its period where
 * the bar's load is lowest, so it rides the troughs and never lifts the peak. Returns { phases,
 * peak before, peak after }. tasks: [{ name, period, cost }]; load: a bar's per-tick load.
 */
export function fillGaps(load, tasks) {
  const L = load.slice(), before = Math.max(...L), phases = {};
  for (const t of [...tasks].sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))) {
    let best = 0, bestPeak = Infinity;
    for (let ph = 0; ph < t.period; ph++) {
      let pk = 0;
      for (let k = ph; k < L.length; k += t.period) pk = Math.max(pk, L[k] + t.cost);
      if (pk < bestPeak) { bestPeak = pk; best = ph; }
    }
    phases[t.name] = best;
    for (let k = best; k < L.length; k += t.period) L[k] += t.cost;
  }
  return { phases, before, after: Math.max(...L), load: L };
}
