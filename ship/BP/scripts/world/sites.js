// Pure. What lies in the sea: wrecks, sunken harbours and flotsam. One candidate per 96-block cell,
// kept or not by where it falls: wrecks gather along sea lanes and on shoals (where ships were lost),
// sunken harbours lie in the shallows off a confederation's islands (strongest near its capital),
// and flotsam drifts along the lanes. Each site's culture is the people whose water it lies in.
import { hash, rand } from "./noise.js";
import { columnAt as groundAt } from "./lattice.js";
import { elevation } from "./terrain.js";
import { lanesNear, toLane, peopleAt } from "./peoples.js";
import { PLANS } from "../config/plans.js";
import { portSite, PORT_PLAN } from "./homeport.js";

export const SITE_CELL = 96;

/** Ships of a tradition, by size (wrecks are the boats that sailed there). */
export function shipsOf(tradition) {
  const all = Object.values(PLANS).filter((p) => p.tradition === tradition && p.id !== "testship");
  const size = (p) => (p.yardLevel ?? 1);
  return { small: all.filter((p) => size(p) === 1), medium: all.filter((p) => size(p) === 2), large: all.filter((p) => size(p) === 3) };
}

const siteCache = new Map();
/** The site a cell holds, or null. */
export function siteAt(seed, cx, cz) {
  const key = `${seed}|${cx},${cz}`;
  if (siteCache.has(key)) return siteCache.get(key);
  const s = makeSite(seed, cx, cz);
  siteCache.set(key, s);
  if (siteCache.size > 8192) siteCache.delete(siteCache.keys().next().value);
  return s;
}
function makeSite(seed, cx, cz) {
  const x = Math.floor((cx + 0.15 + 0.7 * rand(cx, cz, seed, 81)) * SITE_CELL);
  const z = Math.floor((cz + 0.15 + 0.7 * rand(cx, cz, seed, 82)) * SITE_CELL);
  const e = groundAt(seed, x, z);
  if (e.land) return null;
  let lane = Infinity, laneKind = null;
  for (const l of lanesNear(seed, x, z)) {
    const d = toLane(l, x, z).d;
    if (d < lane) { lane = d; laneKind = l.kind; }
  }
  const r = rand(cx, cz, seed, 83);
  const p = peopleAt(seed, x, z);
  const base = { id: `s${cx},${cz}`, x, z, floor: e.top, depth: e.depth, tradition: p.tradition, confed: p.confed.name, hold: p.hold, seed: hash(cx, cz, seed, 84) };
  // wrecks: along the lanes, and where the bottom comes up to catch a keel
  const wreck = 0.008 + 0.32 * Math.exp(-lane / 70) + (e.depth <= 6 && e.depth >= 3 ? 0.05 : 0);
  if (e.depth >= 3 && r < wreck) {
    const ships = shipsOf(p.tradition);
    const roll = rand(cx, cz, seed, 85);
    const pool = laneKind === "far" && ships.large.length && roll < 0.35 ? ships.large
      : roll < 0.7 && ships.medium.length ? ships.medium : ships.small.length ? ships.small : ships.medium;
    const plan = pool[hash(cx, cz, seed, 86) % pool.length];
    if (plan) return { ...base, kind: "wreck", plan: plan.id, heading: hash(cx, cz, seed, 87) % 360, broken: rand(cx, cz, seed, 88) < 0.5 };
  }
  // sunken harbours: in the shallows by a confederation's islands
  if (e.depth >= 2 && e.depth <= 9 && e.shelf > 0.45 && p.hold > 0.25 && r > 0.9 - 0.2 * p.hold) {
    return { ...base, kind: "ruin", heading: (hash(cx, cz, seed, 89) % 4) * 90 };
  }
  // flotsam: drifting along a lane
  if (lane < 80 && r > 0.82) return { ...base, kind: "flotsam" };
  return null;
}

// Theran wrecks: the round isle's own ships, lost far from the peoples' lanes. One candidate in each
// THERAN_CELL, kept where the water is deep enough to hide her; few enough to read off a tablet.
export const THERAN_CELL = 1280;   // vision: about one Theran wreck in every 1,280 blocks square
const theranCache = new Map();
export function theranWreckAt(seed, cx, cz) {
  const key = `${seed}|${cx},${cz}`;
  if (theranCache.has(key)) return theranCache.get(key);
  let s = null;
  const x = Math.floor((cx + 0.2 + 0.6 * rand(cx, cz, seed, 191)) * THERAN_CELL), z = Math.floor((cz + 0.2 + 0.6 * rand(cx, cz, seed, 192)) * THERAN_CELL);   // given: hash salts
  const e = groundAt(seed, x, z);
  const home = portSite(seed);
  if (!e.land && e.depth >= 8 && rand(cx, cz, seed, 193) < 0.7 && Math.hypot(x - home.x, z - home.z) > PORT_PLAN.radius + 200)   // given: hash salt   // vision: seven cells in ten hold one
    s = { id: `t${cx},${cz}`, kind: "wreck", theran: true, plan: "theran", x, z, floor: e.top, depth: e.depth, tradition: "theran", confed: "the Therans", hold: 0, seed: hash(cx, cz, seed, 194), heading: hash(cx, cz, seed, 195) % 360, broken: rand(cx, cz, seed, 196) < 0.6 };   // given: hash salts
  theranCache.set(key, s);
  return s;
}
/** The Theran wrecks within a box. */
export function theranWrecksIn(seed, x0, z0, x1, z1) {
  const out = [];
  for (let cx = Math.floor(x0 / THERAN_CELL); cx <= Math.floor(x1 / THERAN_CELL); cx++) for (let cz = Math.floor(z0 / THERAN_CELL); cz <= Math.floor(z1 / THERAN_CELL); cz++) {
    const s = theranWreckAt(seed, cx, cz);
    if (s && s.x >= x0 && s.x <= x1 && s.z >= z0 && s.z <= z1) out.push(s);
  }
  return out;
}

/** Every site whose cell overlaps a box (x0..x1, z0..z1), with margin for its size. */
export function sitesIn(seed, x0, z0, x1, z1, margin = 48) {
  const out = theranWrecksIn(seed, x0 - margin, z0 - margin, x1 + margin, z1 + margin);
  for (let cx = Math.floor((x0 - margin) / SITE_CELL); cx <= Math.floor((x1 + margin) / SITE_CELL); cx++)
    for (let cz = Math.floor((z0 - margin) / SITE_CELL); cz <= Math.floor((z1 + margin) / SITE_CELL); cz++) {
      const s = siteAt(seed, cx, cz);
      if (s) out.push(s);
    }
  return out;
}

/** sitesIn as steps: a cell not yet worked out is a step of its own (each asks after the peoples' lanes). */
export function* sitesInSteps(seed, x0, z0, x1, z1, margin = 48) {
  const out = theranWrecksIn(seed, x0 - margin, z0 - margin, x1 + margin, z1 + margin);
  for (let cx = Math.floor((x0 - margin) / SITE_CELL); cx <= Math.floor((x1 + margin) / SITE_CELL); cx++)
    for (let cz = Math.floor((z0 - margin) / SITE_CELL); cz <= Math.floor((z1 + margin) / SITE_CELL); cz++) {
      const fresh = !siteCache.has(`${seed}|${cx},${cz}`);
      const s = siteAt(seed, cx, cz);
      if (s) out.push(s);
      if (fresh) yield;
    }
  return out;
}
