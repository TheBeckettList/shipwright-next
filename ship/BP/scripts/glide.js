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
import { flyLaw, flyingOf, stageOf as stageLaw, FLIGHT } from "./flight.js";
import { clamLaw } from "./clamsail.js";
import { WATER } from "./config/yards.js";
import { PHI } from "../core/golden.js";

export const GLIDER = "shipwright:theran_skiff";
export const SHERD = "minecraft:echo_shard";       // given: vanilla's echo shard; vision: every Theran's sherd
const MASS = 2335;                                 // derived: her law's displacement, kg (6 x 1.5 x 0.5625 m, block 0.45, sea water)
const WINGS = 29;                                  // derived: her two plates spread as wings, m^2 (gen_boats: 2 x 6.85 x 2.12 blocks, a block a metre)
const FLY = flyingOf({ mass: MASS, wingArea: WINGS });
const GRAVITY = 0.08;                              // given: Bedrock's gravity on an entity, blocks a tick^2 (made good each tick aloft)
const AIR_TURN = 2;                                // vision: degrees a tick she turns in the air (a bank, not a rudder)
const FOLD_STEP = 1 / 21;                          // vision: FIB, the ticks her wings take to spread or fold
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

// Her stages (Richard: "sailing; pull back a little, foil a third up; pull back more, 2/3; more, full foil with 1/3
// sail; full pull, V1, and the sail is away: you're gliding"): the helmsman's pull (how far they look up) asks for a
// stage, and her speed allows it. Stage n rides her min(n, 3) thirds of the way up her foil, and zips n - 1 thirds of
// her plates over from sail to wing; stage 4 is flight.
/** Her plates between sail and wing, and her stage, eased over FOLD_STEP. */
export function foldTick(e, s, helm) {
  let pull = 0;
  try {
    pull = -helm.getRotation().x;                    // looking up is pulling back
  } catch {
    /* level */
  }
  s.stage = stageLaw(pull, Math.abs(s.speed ?? 0), !!s.fly?.flying, FLY.vLift);
  const want = 1 - Math.max(0, s.stage - 1) / 3;
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
    if ((s.stage ?? 0) < 4) return false;          // and only on a full pull at V1, her sail away
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

/**
 * Her seed sail (clamsail.js): the law's set, shown. Stowed (lying closed on her deck) when it isn't set or she
 * flies; while it rakes up or down its valves stand open, and they zip once it is where it's going; zipped, they slide
 * on the mast to the camber the law wants. Returns the law's answer (its target speed is the sail's drive).
 */
export function clamTick(e, s, { sailing, wind, off, flying, tack = 1 }) {
  // (wind.js's angle off the wind is 0 dead downwind; the law's is 0 head to wind)
  const law = clamLaw({ sailing: sailing && !flying, wind, off: 180 - Math.abs(off), speed: Math.max(0, s.speed ?? 0), tack });
  const c = (s.clam ??= { up: 1, zip: 1, cam: 0 });
  const wantUp = sailing && !flying ? law.up : 0;
  c.up += Math.max(-FOLD_STEP, Math.min(FOLD_STEP, wantUp - c.up));
  const moving = Math.abs(wantUp - c.up) > 0.02;
  c.zip += Math.max(-FOLD_STEP * 2, Math.min(FOLD_STEP * 2, (moving && c.up > 0.05 ? 0 : 1) - c.zip));
  c.cam += Math.max(-FOLD_STEP, Math.min(FOLD_STEP, (c.zip > 0.95 ? law.cam : 0) - c.cam));
  const r2 = (v) => Math.round(v * 50) / 50;
  const shown = (s.clamShown ??= {});
  for (const k of ["up", "zip", "cam"]) {
    if (Math.abs(r2(c[k]) - (shown[k] ?? -9)) >= 0.04) {
      try {
        setP(e, `clam_${k}`, r2(c[k]));
        shown[k] = r2(c[k]);
      } catch {
        /* visual only */
      }
    }
  }
  return law;
}

// Her foiling (Richard: "the thirds can also be the foiling height"): each stage rides her a third higher on her keel's
// foil, her hull lifting clear of the water, until at stage 4 she flies. The foil
// reaches FOIL_H below her hull (gen_boats: her keel's foil at her rudders' feet), and she rises at most to keep it
// wet. Clear of the water her hull drags less: her sail and her core carry her faster (foilGain), which brings the next
// third sooner, as a foiler's take-off goes.
export const FOIL_H = 0.85;                        // derived: her foil's reach below her hull, blocks (11 px, less a little kept wet)
const FOIL_EASE = 1 / 13;                          // vision: FIB, the share of the gap to her ride height closed each tick

/** How far down to look for her water: the foil's depth while she foils. */
export const foilReach = (s) => (s.ride ?? 0) + 0.1;

/** Her speed gain while foiling: up to 1/phi more, full up on her foil. */
export const foilGain = (s) => 1 + ((s.fly?.flying ? 0 : Math.min(3, s.stage ?? 0)) / 3) / PHI;

/** Her ride height on the water: a third of FOIL_H a third, held by the foil's lift against her weight. */
export function foilTick(e, s, water) {
  if (s.fly?.flying) return;
  const want = water.wet && !water.lip ? (Math.min(3, s.stage ?? 0) / 3) * FOIL_H : 0;
  const was = s.ride ?? 0;
  s.ride = was + (want - was) * FOIL_EASE;
  if (s.ride < 0.01 && want === 0) {
    s.ride = 0;
    return;                                         // afloat: her buoyancy holds her
  }
  try {
    const v = e.getVelocity();
    const lift = s.ride - was;                      // what the foil raises her by this tick
    e.applyImpulse({ x: 0, y: lift - v.y + GRAVITY, z: 0 });
  } catch {
    /* not this tick */
  }
}
