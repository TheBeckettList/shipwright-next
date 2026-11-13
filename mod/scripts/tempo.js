// The tempo in the game: the server's periodic duties on core/tempo.js's beat. Every period divides the bar (200
// ticks, ten seconds: the harmonic gate), so duties that exchange data meet on shared beats; and their phases come
// from the phase plan (heaviest first, each to the phase where the bar's busiest tick is least busy, from the golden
// one), so no tick carries the spikes of all of them at once, as every runInterval starting on tick 0 did.
//
// What fills the rest of every tick is the layer (main.js): one long job (system.runJob) that lays chunk after
// chunk in the engine's slack, its every step short (a row of a chunk's reckoning at most), and stops when nothing
// wants laying; its wake duty starts it again.
import { BAR, phasePlan, profile, stats, offBeat, fires } from "./core/tempo.js";
export { BAR };

/** The server's duties: their period (ticks, dividing the bar) and cost weight (vision: what each does a firing). */
export const TEMPO = [
  { name: "layer", period: 8, cost: 1 },     // vision: the layer woken every 8 ticks (the trit breath, pisano 3) if it stopped
  { name: "hold", period: 10, cost: 1 },     // vision: arrivals held in the air, checked twice a second
  { name: "hud", period: 20, cost: 2 },      // vision: the action bar once a second (every player's line)
  { name: "soak", period: 20, cost: 1 },     // vision: the soak's tour stepped once a second
  { name: "watch", period: 20, cost: 3 },    // vision: the areas ahead of fliers and the flight test once a second; the holes every eighth
  { name: "fogs", period: 40, cost: 2 },     // vision: the climate's fog every two seconds
  { name: "folk", period: 40, cost: 5 },     // vision: folk brought out and put back every two seconds (it lists the dimension's folk)
  { name: "tps", period: 100, cost: 2 },     // vision: ticks a second read every five seconds
  { name: "seasons", period: 200, cost: 1 },
  { name: "courses", period: 10, cost: 1 },
  { name: "park", period: 100, cost: 2 },     // vision: the park's beasts looked at every five seconds (an invisible fence: a stray is walked home)  // vision: the courses' marks looked at twice a second // vision: the Horaia's season looked at once a bar (ten seconds)
];
export const PHASES = phasePlan(TEMPO);
const byName = new Map(TEMPO.map((t) => [t.name, t])), fns = new Map(), cost = new Map();

/** Give a duty of the table its work. */
export function duty(name, fn) { if (!byName.has(name)) throw new Error(`tempo: ${name} isn't in the table`); fns.set(name, fn); cost.set(name, { ms: 0, n: 0, worst: 0 }); }
/** The duties that fire on a tick. */
export const dueAt = (tick) => TEMPO.filter((t) => fires(t, tick, PHASES));
/** The dispatcher: one interval for them all. now: a clock in ms (Date.now in the game). */
export function startTempo(system, now = () => Date.now()) {
  return system.runInterval(() => {
    for (const t of dueAt(system.currentTick)) { const fn = fns.get(t.name); if (!fn) continue; const c = cost.get(t.name), t0 = now(); try { fn(); } catch (e) { if (c.n < 3) console.warn(`[Waterworld] ${t.name}: ${e}`); } const ms = now() - t0; c.ms += ms; c.n++; c.worst = Math.max(c.worst, ms); }
  }, 1);
}
/** Each duty's period, phase, mean and worst cost in ms (the tps probe carries it, to fit the weights). */
export const tempoReport = () => TEMPO.map((t) => { const c = cost.get(t.name) ?? { ms: 0, n: 0, worst: 0 }; return { name: t.name, every: t.period, phase: PHASES[t.name], mean: c.n ? +(c.ms / c.n).toFixed(2) : 0, worst: c.worst }; });
/** The plan's load on a bar (for the lens): its peak and mean, the same without the plan, and any off the gate. */
export function tempoLoad() { return { planned: stats(profile(TEMPO, PHASES)), unplanned: stats(profile(TEMPO, {})), off: offBeat(TEMPO).map((t) => t.name) }; }
