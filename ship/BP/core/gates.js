// Pure. The gate engine: every decision in the world is a list of gates, the same shape as the
// cultures' building rules:
//
//   { must | prefer: name, test: (subject, ctx) -> boolean | number, weight?, why }
//
// A choice (an action, a role, a rank) passes if every `must` holds; among those that pass, the one
// whose `prefer`s score highest wins (a prefer's test may return a number in [0, 1], or a boolean).
// Ties go to the first listed, so a decision is the same every time it's asked: definable. Every
// verdict carries its reasons, so anything an NPC does can be traced to the gate that chose it.

/** Score one choice: { ok, score, reasons }. */
export function judge(gates, subject, ctx) {
  let ok = true, score = 0, wsum = 0;
  const reasons = [];
  for (const g of gates) {
    const v = g.test(subject, ctx), n = typeof v === "number" ? Math.max(0, Math.min(1, v)) : v ? 1 : 0;
    if (g.must) { if (!n) { ok = false; reasons.push(`fails: ${g.why}`); } }
    else { const w = g.weight ?? 1; score += w * n; wsum += w; if (n) reasons.push(g.why); }
  }
  return { ok, score: wsum ? score / wsum : 1, reasons };
}
/** Choose among options ({ name, gates }): the best that passes, with why. */
export function choose(options, subject, ctx) {
  let best = null;
  for (const o of options) {
    const j = judge(o.gates, subject, ctx);
    if (j.ok && (!best || j.score > best.score)) best = { name: o.name, ...j };
  }
  return best;
}
