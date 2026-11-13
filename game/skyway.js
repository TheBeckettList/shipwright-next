// The skyways as blocks (world/theraplan.js skyways(): the cone-to-caldera trees), drawn as one network. Pure: given
// the ways (each its points in the world's blocks [X, Z, y] and its rank) and the ground (a function of X, Z giving
// the top block's y and whether it's water), it gives the network's voxels in pieces a few chunks across.
//
// Drawn together, not way by way: every way's deck goes into one plan of the walk first, and only then are the rails
// raised, round the edge of the whole. So a branch leaving its trunk, two ways meeting, or a way landing on the ground
// is open where they join: a rail stands only where the walk ends in air. (Drawn one by one, each way's rail ran across
// the mouth of every way that left it.)
//
//   the walk      Theran marble tile, edged a block either side in polished marble; a half step in the marble slab.
//                 As wide as the way's rank (trunk 5, branch 3, limb 2, twig 1: a Fibonacci step thinner at each fork),
//                 its height the plan's (the great ships' clearance over the lagoon), never lower than a block over
//                 the ground, never climbing more than a half step a block
//   the arches    no solid spandrel: two ribs under the deck's edges only, deep at the piers and none mid-span, so
//                 every span reads as an arch and the sky shows between the ribs
//   the piers     slender Ionic columns of Theran marble under each edge (one under a narrow way), a base on the
//                 ground or the water's floor, the capital under the deck, every 21 blocks where the deck stands high
//   the rail      a balustrade of turned marble balusters, open to the view, between polished posts every 4, a
//                 soul lantern (the blue flame) on every 13th post
const WIDTH = { trunk: 5, branch: 3, stem: 3, limb: 2, twig: 1 };   // vision: Fibonacci widths, thinning at each fork
const SPAN = 21, LAMP = 13, POST = 4, PIECE = 32;   // vision: a pier every twenty-one blocks, a lantern every thirteen, a post every four; pieces two chunks a side
const M = (n) => `waterworld:theran_marble_${n}`;
const WALK = M("tile"), EDGE = M("polished"), HALFSTEP = M("slab"), RIB = M("ashlar"), SHAFT = M("column"), BASE = M("column_base"), CAP = M("capital_ionic"), BALUSTER = M("baluster"), POSTID = M("polished"), LAMPID = "minecraft:soul_lantern";
const MERGE = 2;   // vision: two ways' walks within two blocks of height are one walk where they meet

/** A way's points curved: a centripetal Catmull-Rom spline through them (it neither overshoots nor loops), sampled every
 *  few blocks; the first and last points stay where they are, so a branch still leaves its trunk at the fork. */
const SAMPLE = 3;   // vision: a sample every three blocks of way
function smooth(pts) {
  if (pts.length < 3) return pts;
  const P = [pts[0].map((v, i) => 2 * v - pts[1][i]), ...pts, pts.at(-1).map((v, i) => 2 * v - pts.at(-2)[i])];   // a mirrored point past each end
  const out = [pts[0]];
  for (let k = 1; k + 2 < P.length; k++) {
    const [p0, p1, p2, p3] = [P[k - 1], P[k], P[k + 1], P[k + 2]], d = (a, b) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]))), t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const n = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / SAMPLE));
    for (let s = 1; s <= n; s++) { const t = t1 + ((t2 - t1) * s) / n, L = (a, b, ta, tb) => a.map((v, i) => ((tb - t) * v + (t - ta) * b[i]) / (tb - ta));
      const A1 = L(p0, p1, 0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, 0, t2), B2 = L(A2, A3, t1, t3), C = L(B1, B2, t1, t2);   // Barry and Goldman's pyramid
      out.push(s === n ? p2 : C); }
  }
  return out;
}

/** One way's walk, a block at a time: [{ x, z, surf (the walk's top, in half blocks), dx, dz, i }]. */
function walkOf(pts, ground) {
  pts = smooth(pts);
  const steps = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az, ay] = pts[k], [bx, bz, by] = pts[k + 1], n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az)));
    for (let s = k ? 1 : 0; s <= n; s++) { const t = s / n; steps.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, y: ay + (by - ay) * t, dx: (bx - ax) / n, dz: (bz - az) / n }); }
  }
  // the walk's top in half blocks: over the ground, raised where it must so it never climbs more than a half step a block
  const surf = steps.map((st) => Math.max(st.y, ground(Math.round(st.x), Math.round(st.z)).top + 1) + 1);
  for (let pass = 0; pass < 2; pass++) { for (let i = 1; i < surf.length; i++) surf[i] = Math.max(surf[i], surf[i - 1] - 0.5); for (let i = surf.length - 2; i >= 0; i--) surf[i] = Math.max(surf[i], surf[i + 1] - 0.5); }
  return steps.map((st, i) => ({ ...st, surf: Math.round(surf[i] * 2) / 2, i }));
}

/** The network's pieces: [{ vox: [{ x, y, z, id, s }], b: [x0, z0, x1, z1] }]. ways: [{ pts: [[X, Z, y], ...], kind }]. */
export function skywayNetwork(ways, ground) {
  // 1. the plan of the walk: every cell any way covers, at its walk's height; where two ways cover a cell within MERGE
  //    of each other they are one walk (the higher's height); further apart they pass over and under
  const plan = new Map();   // "x,z" -> [cells]
  const at = (x, z) => plan.get(`${x},${z}`) ?? [];
  ways.forEach((w, wi) => {
    const W = WIDTH[w.kind] ?? 1, half = (W - 1) / 2 + (W > 1 ? 1 : 0), R = Math.ceil(half) + 1;   // the walk and a rail's cell either side
    let since = SPAN;
    for (const st of walkOf(w.pts, ground)) {
      const len = Math.hypot(st.dx, st.dz) || 1, nx = -st.dz / len, nz = st.dx / len, g = ground(Math.round(st.x), Math.round(st.z));
      const slab = st.surf % 1 !== 0, deck = Math.floor(st.surf) - (slab ? 0 : 1), high = deck - g.top;
      since++; const pier = high > 3 && since >= SPAN; if (pier) since = 0;   // vision: piers only where the deck stands more than three over what's under it
      const sag = Math.min(3, Math.round(3 * Math.abs(((since % SPAN) / SPAN) * 2 - 1) ** 2));   // vision: the rib's depth: three at a pier (since = 0 or SPAN), none mid-span: an arch
      // the ribs, step by step under each outer edge: three deep at a pier, none mid-span (an arch), kept per cell at the deepest
      for (let ox = -R; ox <= R; ox++) for (let oz = -R; oz <= R; oz++) {
        const x = Math.round(st.x) + ox, z = Math.round(st.z) + oz, d = Math.hypot(x - st.x, z - st.z); if (d > half + 0.45) continue;
        const k = `${x},${z}`, list = plan.get(k) ?? plan.set(k, []).get(k), o = (x - st.x) * nx + (z - st.z) * nz;
        const c = { x, z, deck, slab, high, g, sag, d, half, o, wi, i: st.i, pier: pier && Math.abs(Math.abs(o) - Math.max(0, half - 1)) < 0.6, edge: d >= half - 0.55 };
        const same = list.find((q) => Math.abs(q.deck - deck) <= MERGE);
        if (!same) { list.push(c); continue; }
        if (same.wi === wi) { if (d < same.d) Object.assign(same, c); continue; }   // the way's own nearest step owns the cell
        // two ways meet here: one walk, at the higher's level, and an edge only if it's an edge of both
        if (deck > same.deck || (deck === same.deck && d < same.d)) Object.assign(same, { ...c, edge: c.edge && same.edge }); else same.edge = same.edge && c.edge;
      }
    }
  });
  const walkAt = (x, z, deck) => at(x, z).find((q) => Math.abs(q.deck - deck) <= 1);
  // 2. the blocks
  const pieces = new Map(), put = (x, y, z, id, st = null) => { const k = `${Math.floor(x / PIECE)},${Math.floor(z / PIECE)}`; if (!pieces.has(k)) pieces.set(k, new Map()); pieces.get(k).set(`${x},${y},${z}`, { x, y, z, id, s: st }); };
  const lamps = new Set();
  for (const list of plan.values()) for (const c of list) {
    // where the walk ends in air: no deck beside it at about its level, and no ground to step onto
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => { if (walkAt(c.x + a, c.z + b, c.deck)) return false; const g = ground(c.x + a, c.z + b); return !(g.top >= c.deck - 1 && g.top <= c.deck + 1); });
    const rail = c.edge && c.half >= 1 && open.length > 0;
    put(c.x, c.deck, c.z, c.edge ? EDGE : WALK);
    if (c.slab) put(c.x, c.deck + 1, c.z, rail ? EDGE : HALFSTEP);
    // the ribs: three deep at a pier, none mid-span (an arch)
    // under every edge cell (both of a wide way's, so a diagonal edge is a wall, not a comb of posts), the nearest step's depth
    const rib = c.edge && c.half >= 1 && c.high > 2 ? c.sag : 0;
    if (rib) for (let d = 1; d <= rib && c.deck - d > c.g.top; d++) put(c.x, c.deck - d, c.z, RIB);
    // the piers: an Ionic column of Theran marble, its base on the ground (or the water's floor), its capital under the rib
    if (c.pier) { const top = c.deck - 1 - (c.edge ? rib : 0), foot = c.g.top + 1 - (c.g.water ? 1 : 0);
      if (top - foot >= 2) { put(c.x, foot, c.z, BASE); for (let y = foot + 1; y < top; y++) put(c.x, y, c.z, SHAFT); put(c.x, top, c.z, CAP); } }
    if (!rail) continue;
    const y0 = c.deck + (c.slab ? 2 : 1), post = c.i % POST === 0, lamp = post && c.i % LAMP < POST && c.o > 0 && !lamps.has(`${c.wi},${Math.floor(c.i / LAMP)}`);
    if (lamp) lamps.add(`${c.wi},${Math.floor(c.i / LAMP)}`);
    put(c.x, y0, c.z, post ? POSTID : BALUSTER);
    if (lamp) put(c.x, y0 + 1, c.z, LAMPID, { hanging: false });
  }
  const out = [];
  for (const [, m] of [...pieces].sort()) { const vox = [...m.values()]; let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const v of vox) b = [Math.min(b[0], v.x), Math.min(b[1], v.z), Math.max(b[2], v.x), Math.max(b[3], v.z)]; out.push({ vox, b }); }
  return out.filter((p) => p.vox.length);
}
/** One way alone (the older call). */
export const skywayPieces = (pts, kind, ground) => skywayNetwork([{ pts, kind }], ground);
