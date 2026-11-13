// The ship as a body: the sum of its parts. (The physics project's rule for things that act at the
// same time: they add.) Each part has a mass and a place (along the hull from the centre, + forward;
// up from the keel); the ship's mass, centre of mass and stability are sums over them, recomputed
// whenever a part is added, removed or loaded. Nothing about a module is special-cased elsewhere:
// a castle high up makes a ship tender because it is heavy and high, a hold low down steadies it.
//
// Masses are in "standard boats": 1 is a 6-block spruce faering's hull.

// What each module adds to the body: mass, height (as a share of the hull's depth: 0 keel, 1 rail,
// above 1 above the deck), place along the hull (share of half-length, + forward), and any change to
// the hull's own mass (light_hull) or its righting (an outrigger float, a twin hull).
export const MODULE_BODY = {
  hold: { mass: 0.08, up: 0.25 },                      // low down: ballast as much as stores
  benches: { mass: 0.05, up: 0.6 },
  canopy: { mass: 0.03, up: 1.6 },
  navigation: { mass: 0.02, up: 1.0 },
  castle: { mass: 0.3, up: 1.8 },                      // heavy and high: makes a ship tender
  deckhouse: { mass: 0.2, up: 1.5 },
  shield_rail: { mass: 0.04, up: 1.0 },
  ram: { mass: 0.06, up: 0.2, along: 1 },
  ice_runners: { mass: 0.03, up: 0 },
  light_hull: { hullFactor: 0.67 },
  outrigger: { mass: 0.08, up: 0.6, righting: 1.6 },
  sewn_hull: {},
  bulkheads: { mass: 0.06, up: 0.4 },
};
const RIG = { mass: 0.12, up: 3.2 };                    // mast and sail, carried high
const LOAD = { share: 0.35, up: 0.3 };                  // a full sea chest adds a third of the hull, low
const CREW = { mass: 0.05, up: 1.2 };                   // each person aboard, at the rail

/**
 * Sums a ship's parts. hull: { mass, depth, beam, length, ratio, twin }; rig: carries a sail;
 * modules: keys; load: 0..1 of a full sea chest; crew: people aboard.
 * Returns { parts, mass, comUp, righting }.
 */
export function bodyOf({ hull, sail = false, modules = [], load = 0, crew = 0 }) {
  const parts = [];
  let hullFactor = 1, rightingFactor = 1;
  for (const key of modules) {
    const m = MODULE_BODY[key] ?? {};
    if (m.hullFactor) hullFactor *= m.hullFactor;
    if (m.righting) rightingFactor = Math.max(rightingFactor, m.righting);
  }
  if (hull.twin) rightingFactor = Math.max(rightingFactor, 1.6);           // twin hulls steady like a float
  const hullMass = hull.mass * hullFactor;
  parts.push({ name: "hull", mass: hullMass, up: 0.45 });
  if (sail) parts.push({ name: "rig", mass: RIG.mass, up: RIG.up });
  for (const key of modules) {
    const m = MODULE_BODY[key];
    if (m?.mass) parts.push({ name: key, mass: m.mass, up: m.up ?? 0.5, along: m.along ?? 0 });
  }
  if (load > 0) parts.push({ name: "load", mass: hullMass * LOAD.share * Math.min(1, load), up: LOAD.up });
  for (let i = 0; i < crew; i++) parts.push({ name: "crew", mass: CREW.mass, up: CREW.up });

  const mass = parts.reduce((a, p) => a + p.mass, 0);
  const comUp = parts.reduce((a, p) => a + p.mass * p.up, 0) / mass;
  // Righting: a beamy, short hull resists heeling; a low centre of mass more so, a high one less.
  // (The bare hull and rig sit near 0.6 of the depth: that is the reference.)
  const form = Math.min(1.8, Math.max(0.5, (hull.beam / 1.5) * (1 / (hull.ratio / 4.5)) ** 0.5));
  const bare = (hullMass * 0.45 + (sail ? RIG.mass * RIG.up : 0)) / (hullMass + (sail ? RIG.mass : 0));
  const tilt = Math.min(1.25, Math.max(0.6, 1 - 0.35 * (comUp - bare)));
  return { parts, mass, comUp, righting: form * tilt * rightingFactor };
}
