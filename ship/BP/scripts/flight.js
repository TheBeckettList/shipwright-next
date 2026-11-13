// The Exokoitos's flight, as pure laws (no game here; steering projects the result). She is a boat that glides:
// get her up to speed, pull up, and she leaves the water; let her be and she glides back down to it.
//
// Why she can: her asterion core (the Fallen Star's ore, a quasicrystal with phi in its grain) is in her keel, and
// the Star's ore stands off from the world: while she flies it bears all but 1/phi^4 of her weight. What is left,
// her wings carry like any wing's, lift = 1/2 rho v^2 S C_L. Burning the core drives her too (thrust); unburnt, she
// glides, and every glide ends on the water.
//
// A point mass in the vertical plane along her heading, in the world's units (blocks, ticks):
//   speed v (blocks a tick, along her path), path angle g (radians, up positive), height h (blocks over the water)
//   lift a tick   Lm = G * (v / V_LIFT)^2 * c        (c, 0..1, the share of her best lift the helm asks for)
//   drag a tick   Dm = Lm / E + G * (v / V_LIFT)^2 * D0   (induced, from the glide ratio; and her frame's own)
//   dv = T - Dm - G sin g        dg = (Lm - G cos g) / v        dh = v sin g
// where G is gravity on her flying weight. She leaves the water when her lift passes that weight, and is back on it
// when h reaches 0.

import { PHI } from "../core/golden.js";

const TICKS = 20;                                  // given: Minecraft's ticks a second
const g0 = 9.81 / (TICKS * TICKS);                 // given: Earth's gravity, 9.81 m/s^2, in blocks a tick^2 (a block a metre)

export const FLIGHT = {
  LIGHTEN: PHI ** 5,                               // vision: the core bears all but 1/phi^5 of her weight in flight (she lifts at
                                                   // about 9 blocks a second, under her 11 with the core burning)
  E: PHI ** 3,                                     // vision: her glide ratio, 4.24 to 1 (a cloth-and-frame wing's)
  D0: 1 / PHI ** 7,                                // vision: her frame's own drag, a share of her best lift's worth
  RHO: 1.225,                                      // given: air at sea level, kg/m^3
  CL_MAX: 1.4,                                     // given: a cambered wing's best lift coefficient, about 1.4
  CRUISE: 11.4 / TICKS,                            // vision: the burning core holds her at her top speed on the water, about
                                                   // 11 blocks a second (the world lays chunks that fast: tools/flysim.mjs)
  ASSIST: PHI ** 2,                                // vision: the core lends her up to phi^2 of her flying weight to turn her path
  AIM_DEG: 30,                                     // vision: a rider looking 30 degrees up or down aims her path 30 degrees
  DEAD_DEG: 8,                                     // vision: within 8 degrees of level the helm is neutral (aim level)
  RATE: (Math.PI / 6) / 21,                        // vision: 30 degrees of path in FIB 21 ticks, at most
  SPLASH: 1 / PHI,                                 // vision: the speed she keeps landing (the water takes the rest)
  CEILING: 89,                                     // vision: FIB, the height her core's hold on the world gives out at
};

/** Her flying numbers from her law's weight (kg) and her wings' area (m^2): gravity on her flying weight, and the
 *  speed at which her best lift carries it (blocks a tick). */
export function flyingOf({ mass, wingArea }) {
  const G = g0 / FLIGHT.LIGHTEN;                   // derived: gravity on what the core leaves her (blocks a tick^2)
  const W = (mass * 9.81) / FLIGHT.LIGHTEN;        // derived: that weight in newtons (9.81 given, as above)
  const vLift = Math.sqrt((2 * W) / (FLIGHT.RHO * wingArea * FLIGHT.CL_MAX)) / TICKS;   // derived: lift = weight at C_L max
  return { G, vLift };
}

/** The path the rider aims her at, from their look: pitch in degrees, negative looking up (Minecraft's). Radians, up
 *  positive; level within the dead band. */
export function aimOf(pitchDeg) {
  if (Math.abs(pitchDeg) <= FLIGHT.DEAD_DEG) return 0;
  const a = Math.min(FLIGHT.AIM_DEG, Math.abs(pitchDeg) - FLIGHT.DEAD_DEG) * (FLIGHT.AIM_DEG / (FLIGHT.AIM_DEG - FLIGHT.DEAD_DEG));
  return (-Math.sign(pitchDeg) * Math.min(FLIGHT.AIM_DEG, a) * Math.PI) / 180;   // derived: degrees to radians
}

/**
 * One tick of flight. state { v, g, h, flying }; inputs { pitch (degrees), burning (bool) }; f = flyingOf(...).
 * The rider aims her path (aimOf); her wings give what lift they can toward it, and the core the rest, up to ASSIST.
 * On the water she flies when aimed up at or past her lift speed; in the air the laws run until she meets the water.
 */
export function flyLaw(state, { pitch, burning }, f) {
  const aim = state.h >= FLIGHT.CEILING ? Math.min(0, aimOf(pitch)) : aimOf(pitch);   // at the ceiling the core aims her level
  if (!state.flying) {
    if (aim <= 0 || state.v < f.vLift) return { ...state, g: 0, h: 0, lift: 0 };   // still a boat
    state = { ...state, flying: true, g: 0, h: 0 };
  }
  const q = (state.v / f.vLift) ** 2;
  const thin = state.h > FLIGHT.CEILING ? 0 : 1;                                     // above it the core lets go
  const turn = Math.max(-FLIGHT.RATE, Math.min(FLIGHT.RATE, aim - state.g));         // the path's wanted bend this tick
  const want = f.G * Math.cos(state.g) + state.v * turn;                             // the lift that bends it so
  const Lm = thin * f.G * q * Math.max(0, Math.min(1, want / (f.G * q)));            // the wings' share, at most their best
  // the core's share, its most either way: it bends her path, but never holds her up (it lends nothing upward once her
  // wings can't carry her flying weight, so a glide that runs out of speed comes down)
  const short = want - Lm;
  const assist = (short > 0 ? (Lm >= f.G * Math.cos(state.g) ? Math.min(FLIGHT.ASSIST * f.G, short) : 0) : Math.max(-FLIGHT.ASSIST * f.G, short));
  const Dm = Lm / FLIGHT.E + f.G * q * FLIGHT.D0;
  const qc = (FLIGHT.CRUISE / f.vLift) ** 2;
  const T = burning ? f.G * (1 / FLIGHT.E + qc * FLIGHT.D0) : 0;                     // derived: her level drag at cruise
  const v = Math.max(0.01, state.v + T - Dm - f.G * Math.sin(state.g));
  const g = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, state.g + (Lm + assist - f.G * Math.cos(state.g)) / state.v));   // vision: 60 degrees either way at most
  const h = state.h + v * Math.sin(g);
  if (h <= 0) return { v: v * FLIGHT.SPLASH, g: 0, h: 0, flying: false, landed: true, lift: 0 };
  return { v, g, h, flying: true, lift: Lm / f.G };
}

// Her stages (glide.js shows them): how far the helmsman pulls back asks for one, and her speed allows it.
export const PULL = [FLIGHT.DEAD_DEG, FLIGHT.DEAD_DEG + (FLIGHT.AIM_DEG - FLIGHT.DEAD_DEG) / PHI ** 2,
  FLIGHT.DEAD_DEG + (FLIGHT.AIM_DEG - FLIGHT.DEAD_DEG) / PHI, FLIGHT.AIM_DEG];          // vision: degrees of pull for stages 1..4
export const GATE = [1 / PHI ** 3, 1 / PHI ** 2, 1 / PHI, 1];                                  // vision: of her lift speed, for stages 1..4

/** The stage the helm asks for and her speed allows (0 sailing .. 4 flying). */
export function stageOf(pullDeg, speed, flying, vLift) {
  if (flying) return 4;
  const asked = PULL.filter((d) => pullDeg >= d).length;
  const allowed = GATE.filter((f) => speed >= vLift * f).length;
  return Math.min(asked, allowed);
}

