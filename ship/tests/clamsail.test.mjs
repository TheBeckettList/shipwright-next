import { test } from "node:test";
import assert from "node:assert/strict";
import { clamLaw, wingForces, apparent, CLAM } from "../BP/scripts/clamsail.js";
import { FLIGHT } from "../BP/scripts/flight.js";

const at = (wind, off, speed = 0) => clamLaw({ sailing: true, wind, off, speed });

test("it never luffs: it draws to its closest apparent angle, and not inside it", () => {
  assert.equal(wingForces((CLAM.CLOSEST - 1) * Math.PI / 180, 1).drive, 0);
  assert.ok(wingForces((CLAM.CLOSEST + 1) * Math.PI / 180, 1).drive > 0);
  assert.ok(at(1, 40).target > 0, "a rigid wing beats at 40 degrees off the true wind");
});

test("on a reach it outruns the true wind (lift grows with the apparent wind)", () => {
  const beam = at(1, 90).target, W = CLAM.WIND_REF;
  assert.ok(beam > W, `beam reach ${beam.toFixed(3)} > wind ${W}`);
  assert.ok(beam < FLIGHT.CRUISE * 1.2, "but short of what her core gives her");
});

test("as she speeds up it depowers: flattens, then rakes down", () => {
  const slow = at(1, 90, 0), fast = at(1, 90, at(1, 90).target);
  assert.ok(Math.abs(fast.cam) <= Math.abs(slow.cam));
  const gale = at(2.5, 90, at(2.5, 90).target);
  assert.ok(gale.up < 1 && gale.up >= CLAM.RAKE_MIN, `raked to ${gale.up}`);
});

test("the slide cambers it to leeward, by tack", () => {
  assert.ok(clamLaw({ sailing: true, wind: 0.5, off: 90, speed: 0, tack: -1 }).cam < 0);
  assert.ok(clamLaw({ sailing: true, wind: 0.5, off: 90, speed: 0, tack: 1 }).cam > 0);
});

test("apparent wind comes forward as she speeds up", () => {
  assert.ok(apparent(0.35, 90, 0.4).angle < apparent(0.35, 90, 0).angle);
});
