// Every lens must hold: reversibility, purity, the globe's seams, the sea, the analogues between
// scales, the beat, near and far, the world's shape and its small-boat route, the peoples, the
// vanilla bounds, and inherency (zero free numbers).
import test from "node:test";
import assert from "node:assert/strict";
import { LENSES } from "../tools/lab.mjs";
for (const [name, lens] of Object.entries(LENSES)) {
  test(name, async () => { const r = await lens(); assert.ok(r.ok, r.lines.join("\n")); });
}
