// The Exokoitos's flight laws (BP/scripts/flight.js): she flies only from speed, a glide comes down, the burning core
// holds her up, and nothing runs away.
import test from "node:test";
import assert from "node:assert/strict";
import { flyLaw, flyingOf, FLIGHT } from "../BP/scripts/flight.js";

const f = flyingOf({ mass: 2335, wingArea: 30 });   // vision: her law's displacement (kg) and her wings (m^2)
const fly = (v0, helm, ticks = 1200) => {             // vision: a minute at most
  let s = { v: v0, g: 0, h: 0, flying: false }, top = 0, t = 0, flew = false;
  for (; t < ticks; t++) { s = flyLaw(s, helm(t), f); top = Math.max(top, s.h); flew ||= s.flying; if (s.landed) break; }
  return { s, top, t, flew };
};

test("she lifts at about 9 blocks a second, under her cruise", () => {
  assert.ok(f.vLift * 20 > 8 && f.vLift * 20 < 10, `lift speed ${(f.vLift * 20).toFixed(1)} b/s`);
  assert.ok(f.vLift < FLIGHT.CRUISE);
});
test("too slow, she stays a boat however hard she's pulled", () => {
  const r = fly(f.vLift * 0.9, () => ({ pitch: -40, burning: true }), 200);
  assert.equal(r.flew, false);
});
test("level helm on the water: no flight", () => {
  assert.equal(fly(FLIGHT.CRUISE, () => ({ pitch: 0, burning: true }), 200).flew, false);
});
test("an unpowered glide comes back down to the water", () => {
  const r = fly(FLIGHT.CRUISE, (t) => ({ pitch: t < 80 ? -40 : 0, burning: false }));
  assert.ok(r.flew && r.s.landed, "landed");
  assert.ok(r.top > 10 && r.top < 30, `zoom top ${r.top.toFixed(1)}`);
});
test("the burning core holds her level near cruise, and she never passes the ceiling", () => {
  const r = fly(FLIGHT.CRUISE, (t) => ({ pitch: t < 60 ? -40 : 0, burning: true }));
  assert.ok(!r.s.landed, "still flying after a minute");
  assert.ok(Math.abs(r.s.v - FLIGHT.CRUISE) / FLIGHT.CRUISE < 0.15, `speed ${(r.s.v * 20).toFixed(1)} b/s`);
  const up = fly(FLIGHT.CRUISE, () => ({ pitch: -40, burning: true }), 2400);
  assert.ok(up.top <= FLIGHT.CEILING + 3, `top ${up.top.toFixed(1)}`);   // vision: the few blocks her levelling takes
});

import { stageOf, PULL } from "../BP/scripts/flight.js";
test("her stages: the pull asks, her speed allows, flight only on a full pull at V1", () => {
  const vL = 0.45;
  assert.equal(stageOf(0, 1, false, vL), 0, "no pull: sailing");
  assert.equal(stageOf(PULL[0] + 1, 1, false, vL), 1, "a little pull: a third up her foil");
  assert.equal(stageOf(PULL[2] + 1, 1, false, vL), 3, "more: full foil, a third of sail");
  assert.equal(stageOf(PULL[3] + 1, vL * 0.9, false, vL), 3, "full pull short of V1: not yet");
  assert.equal(stageOf(PULL[3] + 1, vL, false, vL), 4, "full pull at V1: gliding");
  assert.equal(stageOf(PULL[3] + 1, 0.01, false, vL), 0, "no speed: no foil");
});
