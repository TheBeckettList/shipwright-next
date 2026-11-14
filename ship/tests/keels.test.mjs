import { test } from "node:test";
import assert from "node:assert/strict";
import { keelLaw } from "../BP/scripts/keels.js";

test("the flagship's keels: down in deep water, up over shallows, standing at anchor", () => {
  const r = 3, d = 1;
  assert.deepEqual(keelLaw({ reach: r, under: 20, draft: d, anchored: false }), { ext: 1, standing: false });
  const shoal = keelLaw({ reach: r, under: 2.5, draft: d, anchored: false });
  assert.ok(shoal.ext < 0.5 && !shoal.standing, "drawn up to clear the floor");
  const stand = keelLaw({ reach: r, under: 2.5, draft: d, anchored: true });
  assert.ok(stand.standing && Math.abs(stand.ext - 0.5) < 1e-9, "down onto the floor: half way, standing");
  assert.equal(keelLaw({ reach: 0, under: 1, draft: d, anchored: true }).ext, 1, "no retracting keels: unchanged");
});
