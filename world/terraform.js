// Pure. The overlay law (design/s004-specs/terraform.md §2): the ground a settlement stands on, as one field
// T(x, z) = the natural ground h clamped by the settlement's pads. Where no pad reaches, T = h exactly, so taking the
// pads away gives the natural world back (a shear: undone with no memory). Nothing is seeded; ties go to the first pad.
//
//   the pad      a building's box at one level L, its floor laid at L + 1. Free-standing, L is the median of the
//                natural ground under it (the median minimises the sum of |h - L|: the least earthwork, cut
//                balancing fill); door-anchored (the grown towns), L is the door's ground. Refused past the bounds:
//                cut (h over L) at most CUT, or CARVE for a carved house (the cut face is its back wall); fill (L
//                over h) at most FILL
//   the bank     round each pad the ground is held to a cone: within REACH of the box (d, the Chebyshev distance),
//                h is clamped into [L - g d, L + g d], one block a block (ground.js's pool-bank law). A terracing
//                pad's cone is a stair, [L - RISER ceil(d / TREAD), L + ...], and its bank is quantised to whole
//                risers (Cycladic pezoules: a riser of 2 to a tread of 5, a mean grade near 1/phi^2)
//   one field    a column within reach of several pads takes the meet of their cones. Two pads are compatible when
//                their levels differ by no more than g times the gap between their boxes: then every two cones meet
//                (|L1 - L2| <= g (d1 + d2), since d1 + d2 >= the gap), and intervals on a line that meet pairwise
//                meet all together (Helly in one dimension). So a pad that is not compatible with those already
//                set is refused, like a site past its bounds, and T never has to choose between pads
//   the drain    a cut pad (h over L by 2 or more somewhere) keeps the uphill ring next to it at L: a swale
//   the faces    a column whose drop to a 4-neighbour is 2 or more is a retaining face (a WALL, in the people's plinth)
//
//   the ease     the hold eases out over the reach: T = h + (held - h)(REACH + 1 - d)/(REACH + 1), whole at the box and
//                nothing past the reach, so where nature is as steep as the cone (or steeper) the bank still meets
//                it with no face at the reach's edge
// The held ground is 1-Lipschitz in h and the cones (clamp, max and min are), and the ease takes away at most the
// offset over the reach a block: the overlay makes no ground much steeper than nature or one block a block.
import { FIB } from "../core/golden.js";

export const BANK = Object.freeze({
  REACH: FIB[5],   // derived: eight blocks, the caldera's bound (terraform.md R)
  GRADE: 1,   // given: a block a block, the pool banks' law (ground.js groundAt)
  CUT: FIB[4],   // derived: the outer slope's own bound of five (theraplan.js slope), for cut
  FILL: FIB[4],   // derived: and for fill
  CARVE: FIB[5],   // derived: a carved house may cut the caldera's eight
  RISER: FIB[2],   // vision: a terrace's riser, two blocks (pezoules: walls of 1-2.5 m)
  TREAD: FIB[4],   // vision: and its tread, five (3-10 m)
  STEP_MAX: FIB[3],   // derived: the tallest retaining face, three (a riser and a half, the chunk's own STEEP)
});
export const FLAG = Object.freeze({ carve: 1, terrace: 2, door: 4 });   // given: bits of a pad's flags

/** The lower median (ties to the first): the level that moves the least earth. */
const medianOf = (hs) => { const s = [...hs].sort((a, b) => a - b); return s[(s.length - 1) >> 1]; };

/**
 * A pad for a building, or a refusal. cols: [{ x, z, h }] the natural ground under its footprint (h a whole block);
 * door: the door's ground (anchors L) or null; t: its people (carried for the materials); carve: cut into a slope;
 * terrace: a terracing people. Returns { x0, z0, x1, z1, L, t, flags, cut, fill } or { why }.
 */
export function padOf(cols, { door = null, t = null, carve = false, terrace = false } = {}) {
  if (!cols.length) return { why: "no ground" };
  const hs = cols.map((c) => c.h), L = door ?? medianOf(hs);
  const cut = Math.max(0, Math.max(...hs) - L), fill = Math.max(0, L - Math.min(...hs));
  if (cut > (carve ? BANK.CARVE : BANK.CUT)) return { why: `cut ${cut}` };
  if (fill > BANK.FILL) return { why: `fill ${fill}` };
  const xs = cols.map((c) => c.x), zs = cols.map((c) => c.z);
  return { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs), L, t, cut, fill,
    flags: (carve ? FLAG.carve : 0) | (terrace ? FLAG.terrace : 0) | (door != null ? FLAG.door : 0) };
}

/**
 * Does the ground round a pad let its bank meet nature within the pad's own bounds? Over the reach, the bank holds
 * the ground at most spread(d) off the pad's level, so where nature falls away faster the bank would stand off it:
 * refused when that is more than CUT (nature over the bank) or FILL (under it), as a site past its bounds is. Then
 * no column moves more than the pad's own bounds (the spec's check on how far ground moves). Returns null or a reason.
 */
export function bankFits(p, hAt) {
  for (let x = p.x0 - BANK.REACH; x <= p.x1 + BANK.REACH; x++) for (let z = p.z0 - BANK.REACH; z <= p.z1 + BANK.REACH; z++) {
    const d = distTo(p, x, z); if (d === 0) continue; const h = hAt(x, z), off = Math.abs(h - p.L) - spreadOf(p, d);
    if (off > (h > p.L ? (p.flags & FLAG.carve ? BANK.CARVE : BANK.CUT) : BANK.FILL)) return `bank ${off}`; }
  return null;
}
/** The Chebyshev distance from a column to a pad's box (0 inside it). */
export const distTo = (p, x, z) => Math.max(p.x0 - x, 0, x - p.x1, p.z0 - z, 0, z - p.z1);
/** The gap between two pads' boxes, Chebyshev (0 if they touch or overlap): any column has d1 + d2 >= it. */
export const gapOf = (p, q) => Math.max(0, p.x0 - q.x1, q.x0 - p.x1, p.z0 - q.z1, q.z0 - p.z1);
/** How far a pad's cone lets the ground stray from its level at distance d. */
export const spreadOf = (p, d) => (p.flags & FLAG.terrace ? BANK.RISER * Math.ceil(d / BANK.TREAD) : BANK.GRADE * d);
/**
 * May pad p be set beside those already set? Exactly when every column within reach of both lets their cones meet:
 * the spreads only grow with distance, so the tightest columns are those with d1 + d2 = the gap.
 */
export function compatible(p, pads) {
  for (const q of pads) { const gap = gapOf(p, q), dL = Math.abs(p.L - q.L);
    for (let d1 = Math.max(0, gap - BANK.REACH); d1 <= Math.min(gap, BANK.REACH); d1++) if (spreadOf(p, d1) + spreadOf(q, gap - d1) < dL) return false; }
  return true;
}

/**
 * The ground at (x, z): the natural h held by the pads within reach. Returns { h: T, pad: the nearest pad's index
 * or -1, d: its distance }. With no pads, T = h.
 */
export function terraAt(x, z, h, pads) {
  let lo = -Infinity, hi = Infinity, drain = Infinity, near = -1, dn = Infinity;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i], d = distTo(p, x, z); if (d > BANK.REACH) continue;
    if (d < dn) { dn = d; near = i; }
    const s = spreadOf(p, d); lo = Math.max(lo, p.L - s); hi = Math.min(hi, p.L + s);
    if (d === 1 && p.cut >= BANK.RISER && h > p.L) drain = Math.min(drain, p.L);   // the drain: a cut pad's uphill ring held at its level
  }
  if (near < 0) return { h, pad: -1, d: Infinity };
  if (drain >= lo) hi = Math.min(hi, drain);   // a swale only where the meet allows it
  const held = Math.min(Math.max(h, lo), hi), ease = (BANK.REACH + 1 - dn) / (BANK.REACH + 1);   // given: whole at the box, nothing past the reach
  let T = h + Math.round((held - h) * ease);   // the hold eases out over the reach, so the bank meets nature with no face
  const p = pads[near];
  if (p.flags & FLAG.terrace && dn > 0) T = BANK.RISER * Math.round(T / BANK.RISER);   // the treads: whole risers on one grid for every terrace (two terraces' grids never jar where the nearest changes)
  return { h: T, pad: near, d: dn };
}

const N4 = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);   // given: the four neighbours
/**
 * The ground the game lays at (x, z), hAt the natural ground: terraAt, and a bank column the pads would leave as a
 * hollow nature lacks (lower than all four neighbours, where the natural column was not) raised to its lowest
 * neighbour, so no pad leaves a puddle at its foot (the terraform spec's pit check). Raising a column to its lowest
 * neighbour's level makes no neighbour a new hollow: that neighbour now has one neighbour level with it.
 */
export function groundAt(x, z, hAt, pads) {
  const h = hAt(x, z), r = terraAt(x, z, h, pads); if (r.pad < 0 || r.d === 0) return r;
  let m = Infinity, natural = true;
  for (const [dx, dz] of N4) { const hn = hAt(x + dx, z + dz); m = Math.min(m, terraAt(x + dx, z + dz, hn, pads).h); if (hn < h) natural = false; }
  return m > r.h && !natural ? { ...r, h: m } : r;
}

/** A retaining face: the drop from T to the lowest of its four neighbours, where it is two or more (0 otherwise). */
export function faceOf(T, Tn) { const drop = T - Math.min(...Tn); return drop >= BANK.RISER ? drop : 0; }
