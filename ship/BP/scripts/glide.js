// The Exokoitos in the game: her rider's sherd, her core, her wings and her flight. The laws are flight.js's (pure);
// this reads the game (the rider's look and pack, the blocks round her) and projects the laws back (velocity, the
// fold). Steering calls it for her alone.
//
// The sherd (Richard: "every Theran has a sherd that's their potsherd to vote, etc., that's also the power to this"):
// every Theran carries an ostrakon, an echo shard, the potsherd they vote with; it is also what wakes their core. It
// isn't burnt: while her helmsman carries one, her core drives her (on the water to her cruise, in the air enough to
// hold her height), and without one she sails, and glides only on the speed she has.
//
// Controls: at speed, look up past 8 degrees to lift off and climb; look down to dive; look level to hold her path.
import { system } from "@minecraft/server";
import { countItems } from "./inventory.js";
import { setP } from "./props.js";
import { forwardOf } from "./frame.js";
import { flyLaw, flyingOf, FLIGHT } from "./flight.js";
import { WATER } from "./config/yards.js";
import { PHI } from "../core/golden.js";

export const GLIDER = "shipwright:theran_skiff";
export const SHERD = "minecraft:echo_shard";       // given: vanilla's echo shard; vision: every Theran's sherd
const MASS = 2335;                                 // derived: her law's displacement, kg (6 x 1.5 x 0.5625 m, block 0.45, sea water)
const WINGS = 30;                                  // derived: her kestrel wings' area, m^2 (gen_boats: the panels at a block a metre)
const FLY = flyingOf({ mass: MASS, wingArea: WINGS });
const GRAVITY = 0.08;                              // given: Bedrock's gravity on an entity, blocks a tick^2 (made good each tick aloft)
const AIR_TURN = 2;                                // vision: degrees a tick she turns in the air (a bank, not a rudder)
const FOLD_STEP = 1 / 21;                          // vision: FIB, the ticks her wings take to spread or fold
const SPREAD_AT = 1 / PHI;                         // vision: at 1/phi of her lift speed her wings come out
const SHERD_CHECK = 20;                            // vision: how often the helmsman's pack is looked in, ticks

export const isGlider = (e) => e?.typeId === GLIDER;

/** Whether the helmsman carries their sherd (looked for once a second). */
export function hasSherd(helm, s) {
  const t = system.currentTick ?? 0;
  if (t - (s.sherdAt ?? -1e9) >= SHERD_CHECK) {
    s.sherdAt = t;
    try {
      s.sherd = countItems(helm, [SHERD]) > 0;
    } catch {
      s.sherd = false;
    }
  }
  return !!s.sherd;
}

/** The core's top speed on the water (blocks a tick): her cruise. */
export const CORE_TOP = FLIGHT.CRUISE;

/** Her wings: spread aloft and at speed, folded onto the hull otherwise; eased over FOLD_STEP. */
export function foldTick(e, s) {
  const spread = s.fly?.flying || Math.abs(s.speed ?? 0) > FLY.vLift * SPREAD_AT;
  const want = spread ? 0 : 1;
  const was = s.fold ?? 1;
  s.fold = was + Math.max(-FOLD_STEP, Math.min(FOLD_STEP, want - was));
  if (Math.abs(s.fold - (s.foldShown ?? -1)) >= 0.05 || (s.fold === want && s.foldShown !== want)) {
    try {
      setP(e, "fold", Math.round(s.fold * 100) / 100);
      s.foldShown = s.fold;
    } catch {
      /* visual only */
    }
  }
}

const solid = (dim, x, y, z) => {
  try {
    const b = dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
    return !!b && !b.isAir && !WATER.has(b.typeId) && !b.isLiquid;
  } catch {
    return false;
  }
};

/**
 * One tick of her flight. On the water, it decides whether she lifts (aimed up at her lift speed); aloft, it runs the
 * laws and sets her velocity. Returns true while she flies (steering then leaves the water's laws alone this tick).
 */
export function flightTick(e, s, helm, { wet, turnRight }) {
  s.fly ??= { v: 0, g: 0, h: 0, flying: false };
  if (!s.fly.flying) {
    if (!wet) return false;                        // she leaves only from the water
    s.fly = { v: Math.max(0, s.speed), g: 0, h: 0, flying: false };
  }
  let pitch = 0;
  try {
    pitch = helm.getRotation().x;
  } catch {
    /* level */
  }
  const r = flyLaw(s.fly, { pitch, burning: !!s.core }, FLY);
  if (r.landed) {
    s.fly = { v: 0, g: 0, h: 0, flying: false };
    s.speed = r.v;
    return false;
  }
  s.fly = r;
  if (!r.flying) return false;
  // aloft: she banks round with the stick, and goes where her path points
  s.heading = (((s.heading + turnRight * AIR_TURN + 180) % 360) + 360) % 360 - 180;
  const f = forwardOf(s.heading);
  const vh = r.v * Math.cos(r.g), vy = r.v * Math.sin(r.g);
  const p = e.location;
  if (solid(e.dimension, p.x + f.x * (vh * 4 + 1), p.y + 0.5, p.z + f.z * (vh * 4 + 1))) {   // into a cliff or a wall: stopped
    s.fly = { v: 0, g: 0, h: 0, flying: false };
    s.speed = 0;
    s.bumped = true;
    return false;
  }
  if (vy <= 0 && solid(e.dimension, p.x, p.y - 0.5, p.z)) {      // down on land: she slides to a stop on it
    s.fly = { v: 0, g: 0, h: 0, flying: false };
    s.speed = 0;
    s.beached = true;
    return false;
  }
  s.speed = vh;
  try {
    const v = e.getVelocity();
    e.applyImpulse({ x: f.x * vh - v.x, y: vy - v.y + GRAVITY, z: f.z * vh - v.z });
  } catch {
    /* not this tick */
  }
  return true;
}
