// The Exokoitos's seed sail as pure laws: a rigid wing, not cloth (Richard: "there's no sail fill; this is a rigid
// sail; it needs special physics"). Two valves, port and starboard, zip into one lens about an internal mast; zipped,
// they slide fore and aft on it in opposite ways and the lens takes a camber to leeward, as a two-element wing does
// ("this allows for the necessary wing variable geometry for foils and beating apparent wind"). Raised, it stands; as
// she gets faster it rakes aft (less area, lower down); gliding it lies closed along her deck.
//
// A rigid wing differs from cloth in three ways that matter here:
//   it never luffs: it trims to its best angle of attack at any apparent wind angle down to its stall, so she can
//     point high (CLOSEST, well inside a soft sail's);
//   its camber is chosen, not blown: CL_MAX runs from the flat lens's to the cambered wing's with the slide;
//   its drive is lift: it grows with the apparent wind, which grows as she speeds up, so on a reach she outruns the
//     true wind, and the limit is how much heeling force her hull can bear (HEEL_CAP), not the wind. Past it she
//     depowers: first flattening (the slide comes back), then raking the sail down.
//
// Speeds are blocks a tick; the wind is the game's (0..1 of a design wind, WIND_REF). Angles: off = the true wind's
// angle off her bow, degrees (0 head to wind, 180 dead downwind), as wind.js gives (180 - angleOffWind).
import { PHI } from "../core/golden.js";

export const CLAM = Object.freeze({
  WIND_REF: 0.35,                   // given: her design wind, 7 m/s (0.35 blocks a tick at 20 ticks a second)
  CL_FLAT: 1 / PHI,                 // derived: the zipped lens with no slide, a thick symmetric foil (0.62)
  CL_CAMBER: PHI,                   // derived: fully slid, a two-element wing's (1.62)
  CD0: 1 / PHI ** 5,                // derived: its profile drag, the lens and mast (0.09)
  AR: PHI ** 2,                     // derived: its aspect, 4.2 blocks tall over a mean chord of 1.6 (2.6)
  E: 0.85,                          // given: an ordinary span efficiency
  CLOSEST: 20,                      // vision: the apparent wind angle it can still draw at, degrees
  KAPPA: PHI,                       // vision: its drive over her hull's drag, so at a beam reach in the design wind she makes
                                    //   about phi times the true wind, near her core's cruise, under sail alone (see the tests)
  HEEL_CAP: PHI ** 3,               // vision: the side force (in units of the design wind's full force) her hull and
                                    //   riders can hold up; past it she depowers
  RAKE_MIN: 1 / PHI ** 2,           // vision: raked down to this much of its height before it would rather be stowed
});

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** The apparent wind on her: speed and angle off her bow (radians, 0 head on), from the true wind and her speed. */
export function apparent(trueSpeed, offDeg, boat) {
  const a = rad(offDeg);
  const x = trueSpeed * Math.sin(a), y = trueSpeed * Math.cos(a) + boat;   // y: along her bow
  return { speed: Math.hypot(x, y), angle: Math.atan2(Math.abs(x), y) };
}

/**
 * The wing at one apparent wind: the drive (along her course) and side force, per unit of q*area, for a camber
 * (0 flat lens, 1 fully slid). It trims to the angle of attack that drives hardest without stalling.
 */
export function wingForces(beta, camber, c = CLAM) {
  if (beta < rad(c.CLOSEST)) return { drive: 0, side: 0, cl: 0 };
  const clMax = c.CL_FLAT + (c.CL_CAMBER - c.CL_FLAT) * camber;
  let best = { drive: -Infinity, side: 0, cl: 0 };
  for (let k = 1; k <= 21; k++) {                          // FIB: the trims it looks through, up to its stall
    const cl = (clMax * k) / 21;
    const cd = c.CD0 + (cl * cl) / (Math.PI * c.AR * c.E);
    const drive = cl * Math.sin(beta) - cd * Math.cos(beta);
    if (drive > best.drive) best = { drive, side: cl * Math.cos(beta) + cd * Math.sin(beta), cl };
  }
  return best;
}

/**
 * The sail's law: what it drives her to, and how it is set. sailing: raised and on the water; wind 0..1; off the true
 * wind's angle off her bow, degrees; speed her speed now. Returns the steady speed it would carry her to (target),
 * the set (up: 1 standing .. RAKE_MIN raked, 0 stowed; zip; cam: the slide, signed to leeward), and its drive now.
 */
export function clamLaw({ sailing, wind, off, speed, tack = 1 }, c = CLAM) {
  if (!sailing || wind <= 0) return { target: 0, up: sailing ? 1 : 0, zip: 1, cam: 0, drive: 0 };
  const W = wind * c.WIND_REF;
  const force = (v, camber, up) => {
    const ap = apparent(W, off, v);
    const f = wingForces(ap.angle, camber, c);
    const q = (ap.speed / c.WIND_REF) ** 2;                  // in units of the design wind's
    return { drive: f.drive * q * up, side: f.side * q * up };
  };
  // the set at a speed: full camber and standing; past the heel cap, flatten first, then rake down
  const setAt = (v) => {
    let camber = 1, up = 1;
    let f = force(v, camber, up);
    if (f.side > c.HEEL_CAP) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 13; i++) { const m = (lo + hi) / 2; if (force(v, m, 1).side > c.HEEL_CAP) hi = m; else lo = m; }
      camber = lo;
      f = force(v, camber, up);
      if (f.side > c.HEEL_CAP) {
        up = clamp(c.HEEL_CAP / force(v, 0, 1).side, c.RAKE_MIN, 1);
        f = force(v, 0, up);
      }
    }
    return { camber, up, ...f };
  };
  // the steady speed: where its drive meets her hull's drag (kappa * v^2, in the same units)
  const hull = (v) => (v / c.WIND_REF) ** 2 / c.KAPPA;
  let lo = 0, hi = 4 * c.WIND_REF;
  for (let i = 0; i < 21; i++) { const m = (lo + hi) / 2; if (setAt(m).drive > hull(m)) lo = m; else hi = m; }
  const now = setAt(Math.max(0, speed));
  return { target: lo, up: now.up, zip: 1, cam: tack * now.camber, drive: now.drive };
}
