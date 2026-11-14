import { test } from "node:test";
import assert from "node:assert/strict";
import { tieSpot, alongside, placeFloat, surfaceBelow, ROPE, GAP, RADIUS, SURFACE, SLOW } from "../BP/scripts/moorings.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("moorings: a boat inside her scope lies slack; outside it she's drawn onto its circle, on her own side", () => {
  const f = { x: 0, z: 0 };
  assert.equal(tieSpot(f, { x: 1, z: 0 }).slack, true);
  const t = tieSpot(f, { x: 0, z: 10 });
  assert.equal(t.slack, false);
  near(t.x, 0);
  near(t.z, ROPE);
});

test("moorings: a fender takes a slow boat alongside, half her beam and the gap off the dock face", () => {
  const n = { x: 1, z: 0 };                         // dock to the west, water to the east
  const fender = { x: 10 + RADIUS, z: 0 };          // the dock face at x = 10
  const half = 1.5;
  const a = alongside(fender, n, { x: 13, z: 1 }, half, 0.01);
  assert.ok(a.has);
  near(a.x, 10 + half + GAP);                       // her side GAP off the face
  near(a.z, 1);                                     // where she is along the dock is hers
  assert.equal(alongside(fender, n, { x: 13, z: 1 }, half, SLOW * 2).has, false, "under way, she's let be");
  assert.equal(alongside(fender, n, { x: 13, z: 9 }, half, 0).has, false, "too far along the dock");
  assert.equal(alongside(fender, n, { x: 5, z: 0 }, half, 0).has, false, "behind the dock face");
});

test("moorings: a float set on water floats at its surface; on a dock's side she hangs over the water below it", () => {
  const water = new Set(["5,62,5", "5,63,5", "6,61,0", "6,62,0"]);
  const isWater = (x, y, z) => water.has(`${x},${y},${z}`);
  const afloat = placeFloat({ x: 5, y: 62, z: 5 }, "Up", isWater);
  near(afloat.y, 63 + SURFACE);
  assert.equal(afloat.n, null);
  const hung = placeFloat({ x: 5, y: 63, z: 0 }, "East", isWater);   // the dock block, its east face over the water at x=6
  assert.deepEqual(hung.n, { x: 1, z: 0 });
  near(hung.x, 6 + RADIUS);
  near(hung.y, 62 + SURFACE);
  assert.ok(hung.drop > 0, "a rope up to the deck");
  assert.equal(placeFloat({ x: 5, y: 63, z: 0 }, "West", isWater), null, "no water on that side");
  assert.equal(surfaceBelow(isWater, 6, 64, 0), 62);
});
