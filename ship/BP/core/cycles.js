// Pure. The two-layer universe from Seedworld (v9), as the engine of anything that lives and changes
// in cycles: cultures, borders, fortunes. Everything here is trits and exactly reversible.
//
//   layer 1  the pulse: the golden line on a Mobius loop of L cells (field.js). From the point it
//            breathes: back to the point in exactly 2L ticks, every time. A breath is an era.
//   layer 2  the record: one trit a cell, driven by layer 1 and never driving it. Each tick, on the
//            same brick-wall pairs, a pair gets F^c (c: the pulse's trit at the pair's first cell,
//            F^-1 for -1, nothing for 0), then the pulse is added in, mod 3. Where the pulse is
//            empty, the record doesn't change: it changes only where the breath passes, and so it
//            keeps a record of every breath. Driven this way it settles to balance (Seedworld: about
//            two-thirds occupied, matter and antimatter within a few percent): no side takes over.
//   growth   when the pulse is back at the point (an era's end), the loop may grow by a pair: two
//            new cells, the record's new cells empty (Seedworld's native growth). Nothing else
//            restarts: the record carries every change into the next era.
//
// step and unstep are inverses: any tick can be run forward or back at the same cost, and the
// state at a tick depends only on where it started (definable), while the record's state space is
// 3^L (endlessly changeable).
import { bal, lineStep, lineUnstep, point } from "./field.js";

const Fpow = (c, a, b) => (c === 1 ? [bal(a + b), a] : c === -1 ? [b, bal(a - b)] : [a, b]);   // F, F^-1 = [[0,1],[1,-1]], I
const FpowInv = (c, a, b) => Fpow(-c, a, b);

/**
 * A world: a pulse of P cells (even) and a record of R cells (even). Each record cell is driven by
 * one pulse cell, ctrl[i] (by default the same cell: P = R). A pulse coarser than its record (a
 * realm's pulse driving its peoples) breathes on its own length, so the record's year is the
 * pulse's breath, whatever the record's size. The pulse never reads the record: still exactly reversible.
 */
export const worldOf = (P, record = null, ctrl = null) => {
  const r = record ?? new Array(P).fill(0);
  return { t: 0, era: 0, pulse: point(P), record: r, ctrl: ctrl ?? r.map((_, i) => i) };
};

/** One tick forward. The Mobius seam: the last cell's pair with the first sees it negated, in both layers. */
export function tick(w) {
  const c = w.pulse, r = w.record.slice(), R = r.length, k = w.ctrl;
  for (let i = w.t % 2; i < R; i += 2) {
    const j = (i + 1) % R, seam = j === 0 ? -1 : 1;
    const [a, b] = Fpow(c[k[i]], r[i], seam * r[j]);
    r[i] = a; r[j] = bal(seam * b);
  }
  for (let i = 0; i < R; i++) r[i] = bal(r[i] + c[k[i]]);
  w.record = r;
  w.pulse = lineStep(c, w.t);
  w.t++;
  return w;
}
/** One tick back: exactly undoes tick. */
export function untick(w) {
  w.t--;
  const c = lineUnstep(w.pulse, w.t), r = w.record.slice(), R = r.length, k = w.ctrl;
  for (let i = 0; i < R; i++) r[i] = bal(r[i] - c[k[i]]);
  for (let i = w.t % 2; i < R; i += 2) {
    const j = (i + 1) % R, seam = j === 0 ? -1 : 1;
    const [a, b] = FpowInv(c[k[i]], r[i], seam * r[j]);
    r[i] = a; r[j] = bal(seam * b);
  }
  w.record = r; w.pulse = c;
  return w;
}
/** Is the pulse at the point (an era's end)? */
export const atPoint = (w) => w.pulse.every((v, i) => v === +(i === 0));
/** Close an era and grow the loop by `by` cells (even): the pulse restarts at the point, the record keeps everything. */
export function grow(w, by = 2) {
  w.record = [...w.record, ...new Array(by).fill(0)];
  w.ctrl = [...w.ctrl, ...Array.from({ length: by }, (_, i) => w.ctrl.length + i)];
  w.pulse = point(w.record.length);
  w.t = 0; w.era++;
  return w;
}
/** Run n ticks (default: one whole era, 2P ticks, one breath of the pulse), calling each(w) after every tick. */
export function era(w, each = null, n = 2 * w.pulse.length) {
  for (let k = 0; k < n; k++) { tick(w); each?.(w); }
  return w;
}
/** Share of the record at +1, 0 and -1. */
export function balance(record) {
  const n = record.length, c = { up: 0, still: 0, down: 0 };
  for (const v of record) c[v > 0 ? "up" : v < 0 ? "down" : "still"]++;
  return { up: c.up / n, still: c.still / n, down: c.down / n };
}
