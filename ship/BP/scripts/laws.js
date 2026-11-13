// The laws: one tick of a boat's motion, as pure functions. Each takes the state and the inputs and
// returns the next state; none of them touches the game. The steering reads the game (wind, water,
// the helm's input), runs these laws, and projects the result back (velocity, entity properties).
// That keeps each law testable against a known answer, the habit the physics project lives by.
//
//   state      what the next tick needs: speed, heading, heel and its rate, the wake's budget
//   laws       sail, drive, heel, drift, wake (below)
//   projection what a player sees or the game is told: impulses, yaw, heel, sail fill, spray

import { sailPower } from "./wind.js";
import { telltale } from "./wind.js";
import { sailTargetBpt, dragStep, heelDeg } from "./ourmath.js";

/**
 * Sail: how hard the rig draws at this angle off the wind, and the speed it can drive the hull to.
 * cond: the sail's and hull's condition factors.
 */
export function sailLaw(h, { sailing, off, windSpeed, sailF = 1, hullF = 1 }) {
  if (!sailing) return { fill: 0, target: 0, telltale: 0 };
  const power = sailPower(h.rig, off);
  return {
    fill: power * Math.min(1, windSpeed),
    // Sails are the strongest drive a boat has: up to well past rowing speed on a good point of sail.
    // the steady speed core/boat.js finds for her at this angle in this wind (the polar), the sail's and hull's condition on it
    target: (h.core ? sailTargetBpt(h.core, off, windSpeed) : h.max * 1.45 * (h.sailDrive ?? 1) * power * windSpeed) * sailF * hullF,
    telltale: telltale(h.rig, off),
  };
}

/**
 * Water friction: what the water takes from a hull's speed in one tick. Two parts, as for any hull:
 * skin friction (in proportion to speed, so a slow drift lasts) and wave-making (with the square of
 * speed, so a fast hull slows hard at first). A heavy hull carries its way longer. Below a crawl she
 * stops. Returns the new speed.
 */
export function waterDrag(h, v) {
  const a = Math.abs(v);
  if (a < STOP_SPEED) return 0;
  // Waterworld's water (core/boat.js): skin friction on Denny's surface, rising past her Froude limit;
  // plus the touch of constant drag, so the last slow drift dies away in seconds, not minutes
  if (h.core) return Math.sign(v) * Math.max(0, Math.abs(dragStep(h.core, v)) - (h.dragConst ?? DRIFT_DRAG));
  const loss = (h.dragLin ?? 0.01) * a + (h.dragQuad ?? 0.1) * a * a + (h.dragConst ?? DRIFT_DRAG);
  return Math.sign(v) * Math.max(0, a - loss);
}
export const STOP_SPEED = 0.003;
export const DRIFT_DRAG = 0.0005;

/**
 * Oars in: when the sail alone gives the speed the helm asks for, the crew ship their oars and rest.
 * They wait a couple of seconds of steady wind before stopping, and take up the oars again as soon
 * as the sail falls short. Returns whether the oars are in.
 */
export const OARS_IN_AFTER = 40, OARS_OUT_AFTER = 10;
export function oarsInLaw(prev, { sailing, throttle, want, sailTarget }) {
  const carries = sailing && throttle > 0.05 && sailTarget >= want * 0.9;
  const t = carries ? Math.min(OARS_IN_AFTER, (prev?.t ?? 0) + 1) : Math.max(-OARS_OUT_AFTER, Math.min(0, (prev?.t ?? 0)) - 1);
  const shipped = prev?.shipped ? t > -OARS_OUT_AFTER : t >= OARS_IN_AFTER;
  return { t, shipped };
}
/** Turning costs way: the hull is pushed partly sideways through the water. Share of speed lost per tick. */
export const turnDrag = (h, turnRate) => 0.004 * Math.min(1, Math.abs(turnRate) / Math.max(0.05, h.turnMax ?? 1));

/**
 * Drive: the speed along the heading after this tick, and a ledger of what changed it. Oars (or a
 * furnace, or a pole) chase the speed asked for, the sail chases its own target, and drag bleeds
 * off what nothing is holding. The ledger's parts add up to the change (parallel effects add).
 */
export function driveLaw(h, speed, { wet, throttle, want, sailTarget, sailing, pull, aground, groundMax, beachedDrag }) {
  const ledger = { oars: 0, sail: 0, drag: 0, ground: 0 };
  let v = speed;
  const step = (key, next) => { ledger[key] += next - v; v = next; };
  if (!wet) step("drag", v * beachedDrag);
  else {
    if (throttle > 0.05) {
      const target = Math.min(h.max * 1.8, Math.max(want, sailTarget));
      if (v < target) step("oars", Math.min(target, v + h.accel * Math.max(0.3, throttle) * pull));
      else step("drag", Math.max(target, waterDrag(h, v)));     // eased off: settle back to the asked-for speed
    } else if (throttle < -0.05) step("oars", Math.max(-h.max * h.reverse, v + h.accel * throttle * pull));
    if (sailing && v < sailTarget) step("sail", Math.min(sailTarget, v + h.accel * 0.6));
    else if (throttle >= -0.05 && throttle <= 0.05) step("drag", waterDrag(h, v));
  }
  if (aground) step("ground", Math.max(-groundMax, Math.min(groundMax, v)));
  // A crawl with nothing driving it stops dead; a heavy ship just starting under oars keeps it.
  const driven = Math.abs(throttle) > 0.05 || (sailing && sailTarget > 0);
  if (Math.abs(v) < 0.001 && !driven) step("drag", 0);
  return { speed: v, ledger };
}

/**
 * Heel: a damped oscillator round the angle the wind and the turn push the hull to. Stepped exactly,
 * as a rotation in the (offset, rate / omega) plane shrunk by the damping, so it can never gain
 * energy at any tick rate (the physics project's "time is a rotation"). period: ticks per roll.
 */
export function heelLaw({ heel = 0, rate = 0 }, target, { period = 30, damping = 0.08, limit = 25, limitPos = limit } = {}) {
  const w = (2 * Math.PI) / period, c = Math.cos(w), s = Math.sin(w), k = Math.exp(-damping);
  const x = heel - target, y = rate / w;
  const nx = (c * x + s * y) * k, ny = (-s * x + c * y) * k;
  const free = target + nx;
  const next = Math.max(-limit, Math.min(limitPos, free));
  // at a limit the hull stops against it (the water's push, the float): no swing is kept going past it
  return { heel: next, rate: next !== free ? 0 : ny * w };
}

/** The angle the hull would settle at: away from the wind under sail, outward in turns, steadier on stiff hulls. */
export function heelTarget(h, { fill, windSpeed, off, windAcross, turnRight, speed }) {
  const sideways = Math.sin((off * Math.PI) / 180);
  const turnHeel = -turnRight * Math.min(1, Math.abs(speed) / (h.max || 1)) * 6;
  // under sail, the heel core/boat.js finds from her metacentric height and the sail's side push
  const sailHeel = h.core ? (fill > 0 ? heelDeg(h.core, off, windSpeed, speed) * Math.min(1, fill / 0.5) : 0) * Math.sign(sideways) * Math.sign(windAcross)
    : (fill * Math.min(1.3, windSpeed) * 20 * sideways * Math.sign(windAcross)) / h.stability;
  let t = sailHeel + turnHeel / h.stability;
  // an outrigger float to port (heel + puts the port side down): pressed under, it pushes back with
  // its whole buoyancy, so she heels toward it far less than away from it (when it lifts and flies)
  if (h.floatHeel != null && t > 0) t /= FLOAT_RIGHTING;
  return Math.max(-25, Math.min(25, t));
}
/** How much harder a float resists being pressed under than the hull alone resists heeling. */
export const FLOAT_RIGHTING = 3;   // vision: a float's buoyancy against its lever arm
/** How long a hull takes to roll back and forth: longer for bigger, heavier ships. */
export const rollPeriod = (h) => 24 * Math.sqrt(Math.max(1, h.length ?? 6) / 6) * Math.sqrt(Math.max(0.5, h.weight ?? 1));

/**
 * Drift: the velocity the hull should have, in the world. Forward at its speed, the sideways skid
 * bled off by grip, plus leeway (a sail drawing across the wind pushes the hull sideways) and any
 * shift from turning about a point other than the origin.
 */
export function driftLaw(h, { f, speed, across, wind, wet, sailUp, bumped, turnShift }) {
  const windAlong = wind.x * f.x + wind.z * f.z;
  const windAcross = wind.x * f.z - wind.z * f.x;
  const windage = wet ? 0.004 + (sailUp ? 0.006 : 0) : 0;
  const driftAlong = windAlong * windage;
  const driftAcross = windAcross * windage * (1 - 0.7 * h.grip);
  const keepAcross = bumped ? 0 : across * (1 - h.grip) + driftAcross;
  return {
    x: f.x * (speed + driftAlong) + f.z * keepAcross + (turnShift?.x ?? 0),
    z: f.z * (speed + driftAlong) - f.x * keepAcross + (turnShift?.z ?? 0),
    windAcross,
  };
}

/**
 * Wake: energy the water takes from the hull goes somewhere we track (the physics project's rule:
 * losses are never just deleted). Drag in the ledger removes kinetic energy; holding a speed against
 * the water costs energy too, rising with the cube of speed. That budget is spent on spray: each
 * puff costs a fixed amount, so a fast hull throws more, and a stopped one none.
 */
export const SPRAY_COST = 0.02;
export function wakeLaw(budget, h, { before, after, ledger }) {
  const m = h.weight ?? 1;
  const lostToDrag = Math.max(0, 0.5 * m * (before * before - after * after)) * (ledger.drag < 0 ? 1 : 0);
  const held = 0.6 * m * Math.abs(after) ** 3;                  // the hull making its waves at speed
  let b = budget + lostToDrag + held;
  const puffs = Math.min(1, Math.floor(b / SPRAY_COST));          // at most one puff a tick
  b -= puffs * SPRAY_COST;
  return { budget: Math.min(b, SPRAY_COST * 2), puffs };
}
