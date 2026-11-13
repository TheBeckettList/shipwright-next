// Pure. The step machine: every law is a list of ops, and an op is one of two kinds.
//
//   shear    s[key] += by(s, ctx)       by must not read s[key]. Undone by s[key] -= by(s, ctx), the
//            (mod m)                    same number, because nothing it read has changed. This is the
//                                       golden law's own shape: (a, b) -> (a + b, a) is two shears.
//                                       Internal dynamics (a roll, a turn, moving along) are shears.
//   record   d = by(s, ctx); s[key] -= d; the sea keeps d
//                                       An exchange with the world (the wind gives, the water takes):
//                                       any function at all, undone by giving d back. The record is the
//                                       wake: every interaction leaves one (Seedworld's rule), and the
//                                       sea keeps it for VISION.WAKE_KEEP ticks. Past that, the oldest
//                                       is forgotten and its size goes to s.lost: only then is a loss real.
//
// step(s, ops, ctx) runs a tick; unstep(s, ops, ctx) runs it back. Same ctx (the tick, the inputs),
// same bits. The purity lens (purity) checks each shear doesn't read its own key.
import { VISION } from "./given.js";
import { mod } from "./fixed.js";

export function step(s, ops, ctx) {
  const rec = [];
  for (const op of ops) {
    if (op.shear) { s[op.shear] += op.by(s, ctx); if (op.mod) s[op.shear] = mod(s[op.shear], op.mod); }
    else { const d = op.by(s, ctx); s[op.record] -= d; rec.push(d); }
  }
  s.wake ??= [];
  s.wake.push(rec);
  if (s.wake.length > (s.keep ?? VISION.WAKE_KEEP)) {
    const old = s.wake.shift();
    s.lost = (s.lost ?? 0) + old.reduce((a, d) => a + Math.abs(d), 0);
  }
  return s;
}

export function unstep(s, ops, ctx) {
  const rec = s.wake?.pop();
  if (!rec) throw new Error("beyond the sea's memory: no wake left to run back");
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (op.shear) { s[op.shear] -= op.by(s, ctx); if (op.mod) s[op.shear] = mod(s[op.shear], op.mod); }
    else s[op.record] += rec.pop();
  }
  return s;
}

/** Shears that read their own key (they would not undo exactly): [op names]. */
export function purity(s, ops, ctx) {
  const bad = [];
  for (const op of ops) {
    if (!op.shear) continue;
    const a = op.by({ ...s }, ctx), t = { ...s };
    t[op.shear] += 12345;          // vision: any nudge
    if (op.by(t, ctx) !== a) bad.push(op.name ?? op.shear);
  }
  return bad;
}

/** The state's own bits, for comparing (the wake aside). */
export const bits = (s, keys) => keys.map((k) => s[k]).join(",");
