// Pure. The Therans' power: continuance. At every year's end the Therans hold the world to its bounds,
// so each year can begin again as a good year: the world keeps everything that happened, but nothing
// runs away. Their hand is itself reversible: every correction is an involution (a swap of two
// peoples' fortunes, or of two values in one fortune), logged, and undone by applying the log backward.
//
//   bounds (vision, BOUNDS below)
//     each third of the world (rising, steady, waning) within THIRDS. Fix first: swap a fortune's
//       value between the fullest third and the emptiest (a rise becomes steady, say), in the
//       tradition with most of the fullest. A swap of two values is its own inverse
//     a tradition's mean fortune within +-TRADITION: no people's family rises or sinks together
//       for good. Fix: swap a rising fortune of the tradition furthest up with a waning (or steady)
//       one of the tradition furthest down (the world's thirds don't change)
//     pirates no more than PIRATES of the peoples (pirates.js asks): the Therans' patrols take the rest
//
// The order is fixed and the choices are by rank (furthest first, then loop order), so the same year
// always gets the same correction: definable.
import { balance } from "../core/cycles.js";

export const BOUNDS = Object.freeze({ TRADITION: 0.34, THIRDS: [0.27, 0.4], PIRATES: 0.03 });   // vision: the bounds
// the most moves the Therans make in a year: each people touched at most once (the record's length)

/** Hold a record to the bounds. tradOf(i): cell i's tradition. Returns { record, log }. */
export function continuance(record, tradOf) {
  const r = record.slice(), log = [];
  const mean = () => {
    const m = {};
    r.forEach((v, i) => { const k = tradOf(i); (m[k] ??= [0, 0]); m[k][0] += v; m[k][1]++; });
    return Object.entries(m).map(([k, [s, n]]) => ({ k, mean: s / n })).sort((a, b) => b.mean - a.mean);
  };
  // first the world's thirds, then each tradition (a value swap moves the thirds, a cell swap keeps them)
  const third = (b, v) => (v > 0 ? b.up : v < 0 ? b.down : b.still);
  for (let move = 0; move < r.length; move++) {
    const b = balance(r), vals = [1, 0, -1];
    const over = vals.find((v) => third(b, v) > BOUNDS.THIRDS[1]) ?? null, under = vals.find((v) => third(b, v) < BOUNDS.THIRDS[0]) ?? null;
    if (over === null && under === null) break;
    const from = over ?? vals.filter((v) => v !== under).sort((x, y) => third(b, y) - third(b, x))[0];   // the fullest third gives
    const to = under ?? vals.filter((v) => v !== over).sort((x, y) => third(b, x) - third(b, y))[0];     // the emptiest takes
    // in the tradition that has most of the giving third
    const M = mean(), order = from > 0 ? M : from < 0 ? [...M].reverse() : M;
    let i = -1;
    for (const t of order) { i = r.findIndex((v, k) => v === from && tradOf(k) === t.k); if (i >= 0) break; }
    if (i < 0) break;
    r[i] = to; log.push({ trade: i, a: from, b: to });
  }
  for (let move = 0; move < r.length; move++) {
    const M = mean(), hi = M[0], lo = M.at(-1);
    if (hi.mean <= BOUNDS.TRADITION && lo.mean >= -BOUNDS.TRADITION) break;
    // the high tradition's best gives way to the low one's worst (a rise for a fall, or for a steady)
    const i = r.findIndex((v, k) => tradOf(k) === hi.k && v === 1);
    let j = r.findIndex((v, k) => tradOf(k) === lo.k && v === -1);
    if (j < 0) j = r.findIndex((v, k) => tradOf(k) === lo.k && v === 0);
    if (i < 0 || j < 0) break;
    [r[i], r[j]] = [r[j], r[i]]; log.push({ swap: [i, j] });
  }
  return { record: r, log };
}
/** Undo a year's continuance exactly (every move is its own inverse; applied backward). */
export function undo(record, log) {
  const r = record.slice();
  for (let k = log.length - 1; k >= 0; k--) {
    const m = log[k];
    if (m.swap) { const [i, j] = m.swap; [r[i], r[j]] = [r[j], r[i]]; } else r[m.trade] = r[m.trade] === m.a ? m.b : r[m.trade] === m.b ? m.a : r[m.trade];   // a value swap: its own inverse
  }
  return r;
}
