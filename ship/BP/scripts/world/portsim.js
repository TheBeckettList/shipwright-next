// Pure. The culture agents who build Strongyle's lagoon quarters.
//
// Each seafaring tradition sends one agent to the homeport. The agents take turns: each lays its
// one dry dock, then designs its own wing (the causeway from the rings out to its quarter), then
// sites its buildings one at a time. Every move must pass two kinds of gate:
//
//   the port's math (SIM, below): the agent's own arc of the lagoon, open water under it, nothing
//     on anyone else's ground, a dock mouth open to the lagoon, a wing no wider or tighter than
//     allowed, every building reachable by a path
//   its people's rules (config/culturegates.js): "must" gates it has to pass, "prefer" gates it
//     scores itself on (a Hanseatic agent wants its houses in a row, gable-on to the quay; a Japanese
//     one puts the family house across the lane behind its funaya)
//
// Because the arcs are drawn by how much room each people asks for, because they take turns, and
// because their rules differ, every quarter comes out its own shape. The whole run is a pure
// function of the seed, so every device builds the same port; it runs in steps, as a game job.
//
// What it gives back: a grid of what each lagoon cell became (deck, basin, wing, reserved water)
// with its owner, and each quarter's dock, wing and buildings, with every gate's verdict (the log).
import { rand, hash } from "./noise.js";
import { CULTURE_GATES } from "../config/culturegates.js";
import { YARD_STYLES } from "../config/yardstyles.js";
import { drawPieces } from "../yardarch.js";

/** The port's math: the limits every agent shares (vision numbers, except where given). */
export const SIM = Object.freeze({
  gap: 2,                     // vision: no one builds within this of another people's ground
  clear: 3,                   // vision: a wing keeps this clear of anyone else's ground, beyond its own width
  dock: { length: 18, left: 3, right: 3, depth: 2 },   // given: a level 2 dock (dock.js DOCK): medium ships come to the quarters
  apron: { back: 3, side: 6 },               // vision: the yard's walkways round the basin
  fairway: { length: 8, half: 4 },           // vision: open water kept before a dock's mouth
  ring: 20,                                  // vision: the ring canal between the rings' shore and the quarters (mediums sail it)
  edge: 3,                                   // vision: half the canal between two peoples' quarters
  venice: { every: 44, half: 2, band: 50 },  // vision: the small canals cut through a quarter: one every so far along it, their half width, and the quarter's depth that earns a canal along it too
  arch: 8,                                   // vision: how high a wing's arch rises over the ring canal, for the medium ships' masts
  head: [3, 30],              // vision: how far in from the cliff foot a dock's head may lie
  width: [1.5, 3.5],          // vision: a wing's half width, narrowest and widest
  turn: Math.PI / 2,          // vision: no wing turns sharper than a right angle
  path: 72,                   // vision: the longest path from a building's door to its people's ground
  tries: { dock: 24, piece: 56 },            // vision: how many places an agent looks at for each move
});
const CARDS = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }];
const TAU = Math.PI * 2;
export const CELL = Object.freeze({ none: 0, deck: 1, basin: 2, wing: 3, fair: 4, reserved: 5, land: 6 });   // vision: the agents' search
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const lerp = (a, b, t) => a + (b - a) * t;

/** A building's cells on the ground, turned and placed: frame origin o, front d (u along d, w to its right). */
const toWorld = (o, d, u, w) => ({ x: o.x + d.x * u - d.z * w, z: o.z + d.z * u + d.x * w });
function rectOf(o, d, b) {
  const a = toWorld(o, d, b.u0, b.w0), c = toWorld(o, d, b.u1, b.w1);
  return [Math.min(a.x, c.x), Math.min(a.z, c.z), Math.max(a.x, c.x), Math.max(a.z, c.z)];
}
const rectDist = (a, b) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]));   // vision: the agents' search
const rectMid = (r) => ({ x: (r[0] + r[2]) / 2, z: (r[1] + r[3]) / 2 });   // vision: the agents' search

/** A canvas's footprint in its own frame (u, w), with a block's margin round it. */
function boundsOf(canvas) {
  let u0 = 0, u1 = 0, w0 = 0, w1 = 0;
  for (const c of canvas.cells.values()) { u0 = Math.min(u0, c.u); u1 = Math.max(u1, c.u); w0 = Math.min(w0, c.w); w1 = Math.max(w1, c.w); }
  return { u0: u0 - 1, u1: u1 + 1, w0: w0 - 1, w1: w1 + 1 };
}

/**
 * Runs the agents. geo describes the lagoon:
 *   { x, z } its middle (the rings' heart); preK the rings' outer shore; rin(th) the cliff foot at a
 *   bearing; canal { a, half } and quay { a, half } the Therans' own water (bearing, half width).
 */
export function* portSim(seed, geo) {
  const G = Math.ceil(geo.rmax) + 4;   // vision: the agents' search
  const N = 2 * G + 1;
  const kind = new Uint8Array(N * N), owner = new Uint8Array(N * N), built = new Uint8Array(N * N);   // built: under a building, an apron or a wing (paths may be built over)
  const idx = (x, z) => { const i = x - geo.x + G, j = z - geo.z + G; return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
  const polar = (x, z) => ({ r: Math.hypot(x - geo.x, z - geo.z), th: Math.atan2(z - geo.z, x - geo.x) });
  const shoreIn = (x, z) => { const p = polar(x, z); return geo.rin(p.th) - p.r; };      // how far in from the cliff foot
  // halo: who has ground within SIM.gap of a cell (0 nobody, owner + 1, BLOCK for the Therans' water,
  // a fairway or more than one people), so "is anyone else near" is one look-up
  const halo = new Uint8Array(N * N), BLOCK = 255;   // given: a byte's highest value
  const mark = (x, z, k, who) => {
    const i = idx(x, z);
    if (i < 0) return;
    kind[i] = k; owner[i] = who + 1;
    const v = k === CELL.reserved || k === CELL.fair ? BLOCK : who + 1;
    for (let a = -SIM.gap; a <= SIM.gap; a++) for (let b = -SIM.gap; b <= SIM.gap; b++) {
      const j = idx(x + a, z + b);
      if (j < 0) continue;
      halo[j] = halo[j] === 0 || halo[j] === v ? v : BLOCK;
    }
  };
  const at = (x, z) => { const i = idx(x, z); return i < 0 ? { k: CELL.reserved, o: 0 } : { k: kind[i], o: owner[i] }; };

  // the Therans' own water first: the canal's fairway out to the strait, and the quay's
  function* corridor(a, half, r0, r1) {
    for (let r = r0; r <= r1; r += 0.5) {
      for (let w = -half; w <= half; w += 0.5) {
        const x = Math.round(geo.x + Math.cos(a) * r - Math.sin(a) * w), z = Math.round(geo.z + Math.sin(a) * r + Math.cos(a) * w);
        const i = idx(x, z);
        if (i >= 0 && kind[i] !== CELL.reserved) mark(x, z, CELL.reserved, -1);
      }
      if (r % 8 === 0) yield;   // vision: the agents' search
    }
  }
  yield* corridor(geo.canal.a, geo.canal.half, geo.preK - 2, G);
  yield* corridor(geo.quay.a, geo.quay.half, geo.preK - 2, geo.preK + geo.quay.length + 6);   // vision: the agents' search

  // the arcs: round the lagoon from the quay's far side to the canal, each people's share drawn round the room it asks for
  const keys = Object.keys(CULTURE_GATES);
  const order = keys.map((k, i) => ({ k, r: rand(seed, 801 + i) })).sort((a, b) => a.r - b.r).map((o) => o.k);   // given: hash salts
  const rMid = (geo.preK + geo.rinMean) / 2;
  const skip = (h) => h / rMid;
  const a0 = geo.quay.a + skip(geo.quay.half + 6);   // vision: a margin past the quay
  let span = angDiff(geo.canal.a - skip(geo.canal.half + 6), a0);   // vision: the agents' search
  if (span <= 0) span += TAU;
  const weights = order.map((k, i) => CULTURE_GATES[k].room * (0.55 + 0.9 * rand(seed, 820 + i)));   // given: hash salts   // vision: how uneven the shares are
  const total = weights.reduce((s, w) => s + w, 0);
  const quarters = [];
  let acc = a0;
  order.forEach((k, i) => {
    const w = (span * weights[i]) / total;
    quarters.push({ i, key: k, style: YARD_STYLES[k], rules: CULTURE_GATES[k], arc: [acc, acc + w], pieces: [], log: [] });
    acc += w;
  });
  // zone: which people's arc each lagoon cell lies in (-1 not the lagoon), worked out once, a few rows a step
  const QD = 1609, RIN = new Float32Array(QD);                            // given: a turn in quarter-degrees
  for (let k = 0; k < QD; k++) RIN[k] = geo.rin(k / 256);   // vision: the agents' search
  const rinOf = (th) => RIN[Math.round((((th % TAU) + TAU) % TAU) * 256) % QD];   // vision: the agents' search
  const zone = new Int8Array(N * N).fill(-1);
  const r0 = geo.preK + 1, r1 = geo.rmax;
  for (let j = 0; j < N; j++) {
    const dz = j - G;
    for (let i = 0; i < N; i++) {
      const dx = i - G, rr = dx * dx + dz * dz;
      if (rr <= r0 * r0 || rr >= r1 * r1) continue;
      const th = Math.atan2(dz, dx), r = Math.sqrt(rr);
      if (r >= rinOf(th) - 1) continue;
      let d = (th - a0) % TAU;
      if (d < 0) d += TAU;
      let z0 = -2;                                                          // lagoon, but no one's
      if (d <= span) for (const q of quarters) if (d <= q.arc[1] - a0) { z0 = q.i; break; }
      zone[j * N + i] = z0;
    }
    if (j % 4 === 3) yield;   // vision: the agents' search
  }
  const lagoonAt = (x, z) => { const i = idx(x, z); return i >= 0 && zone[i] !== -1; };

  // the ground: each land people's arc raised into an island, its shore wandering, cut off from its
  // neighbours by a canal and through by small canals (the Venice of it, for small boats); water
  // peoples keep the lagoon and build on stilts
  const lift = new Uint8Array(N * N);                                       // how high a bridge stands over the water here
  const shoreAt = (q, th) => geo.preK + SIM.ring + 2.5 * Math.sin(th * 7 + q.i) + 1.5 * Math.sin(th * 13 + q.i * 2);   // vision: the shore's wander
  for (const q of quarters) {
    if (q.rules.ground !== "land") continue;
    const w = q.arc[1] - q.arc[0], mid = (geo.preK + SIM.ring + geo.rinMean) / 2;
    const n = Math.max(1, Math.floor((w * mid) / SIM.venice.every));
    q.canals = { radial: [...Array(n - 1).keys()].map((k) => q.arc[0] + (w * (k + 1)) / n), ring: geo.rinMean - geo.preK - SIM.ring > SIM.venice.band ? geo.preK + SIM.ring + (geo.rinMean - geo.preK - SIM.ring) * 0.5 : null };   // vision: halfway in
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const zq = zone[j * N + i];
      if (zq < 0 || quarters[zq].rules.ground !== "land") continue;
      const q = quarters[zq], dx = i - G, dz = j - G;
      const r = Math.sqrt(dx * dx + dz * dz), th = Math.atan2(dz, dx);
      if (r < shoreAt(q, th)) continue;
      if (Math.min(Math.abs(angDiff(th, q.arc[0])), Math.abs(angDiff(th, q.arc[1]))) * r < SIM.edge) continue;
      const nearCliff = rinOf(th) - r < 8;   // vision: the canals stop short of the cliff
      if (!nearCliff && q.canals.radial.some((a) => Math.abs(angDiff(th, a)) * r < SIM.venice.half)) continue;
      if (!nearCliff && q.canals.ring && Math.abs(r - q.canals.ring) < SIM.venice.half) continue;
      if (kind[j * N + i] !== CELL.none) continue;
      kind[j * N + i] = CELL.land; owner[j * N + i] = zq + 1;
    }
    if (j % 4 === 3) yield;   // vision: the agents' search
  }
  const onLand = (q) => q.rules.ground === "land";
  const free = (q, x, z, gap = SIM.gap, overPaths = false) => {
    const i = idx(x, z);
    if (i < 0 || zone[i] !== q.i) return false;
    const mine = owner[i] === q.i + 1;
    const ground = onLand(q) ? kind[i] === CELL.land && mine : kind[i] === CELL.none;
    if (!ground && !(overPaths && kind[i] === CELL.deck && mine && !built[i])) return false;
    return halo[i] === 0 || halo[i] === q.i + 1;
  };
  const water = (x, z) => { const i = idx(x, z); return i >= 0 && zone[i] !== -1 && kind[i] === CELL.none; };

  // ------------------------------------------------------------ round one: the docks
  // a level 2 dock: on a land people's shore, its basin cut into the island and its mouth on the ring
  // canal; for a water people, on decks out in the lagoon by the cliff
  const D = SIM.dock, A = SIM.apron, F = SIM.fairway;
  for (const q of quarters) {
    const cands = [];
    for (let t = 0; t < SIM.tries.dock; t++) {
      const th = lerp(q.arc[0], q.arc[1], (t + 0.5) / SIM.tries.dock);
      const heads = onLand(q) ? [-1, 1, 3, 6].map((k) => shoreAt(q, th) + k) : [6, 10, 14, 18, 24].map((s) => geo.rin(th) - s);   // vision: its mouth at the shore; or its head in from the cliff foot
      for (const r of heads) for (const d of CARDS) {
        let hx = Math.round(geo.x + Math.cos(th) * r), hz = Math.round(geo.z + Math.sin(th) * r);
        if (onLand(q)) { hx -= d.x * D.length; hz -= d.z * D.length; }                 // its head inland from its mouth, along its own line
        else { const headIn = shoreIn(hx, hz); if (headIn < SIM.head[0] || headIn > SIM.head[1]) continue; }
        {
          const toC = { x: geo.x - hx, z: geo.z - hz }, L = Math.hypot(toC.x, toC.z) || 1;
          const open = (d.x * toC.x + d.z * toC.z) / L;
          if (open < 0.6) continue;                                   // the mouth opens toward the lagoon   // vision: the agents' search
          cands.push({ cost: (1 - open) * 20 + Math.abs(angDiff(th, (q.arc[0] + q.arc[1]) / 2)) * 30 + rand(seed, q.i, t, 840) * 4, o: { x: hx, z: hz }, d });   // given: hash salt   // vision: square to the lagoon, mid-arc
        }
      }
    }
    cands.sort((a, b) => a.cost - b.cost);
    let best = null;
    for (const pass of [0, 1]) for (const c of best ? [] : cands) {      // second pass: its walkways may stand out over the water on piles
      let ok = true;
      for (let u = -A.back; u < D.length + F.length && ok; u++) for (let w = -A.side; w <= A.side && ok; w++) {
        const p = toWorld(c.o, c.d, u, w);
        if (u >= D.length) {                                                                                // open water before its mouth (a land people cuts its shore back to it)
          if (Math.abs(w) > F.half) continue;
          const n = idx(p.x, p.z);
          if (u >= D.length + F.length - 3 ? !water(p.x, p.z) : !(water(p.x, p.z) || (onLand(q) && n >= 0 && kind[n] === CELL.land && owner[n] === q.i + 1))) ok = false;   // vision: the agents' search
          continue;
        }
        const basin = u >= 0 && w >= -D.left && w <= D.right;
        if (onLand(q) && (basin || u >= D.length - 6)) { const n = idx(p.x, p.z); if (n < 0 || zone[n] !== q.i || (kind[n] !== CELL.land && kind[n] !== CELL.none)) ok = false; continue; }   // (its basin is cut, and its mouth meets the shore wherever the shore is)   // vision: the agents' search
        if (pass === 1) { const n = idx(p.x, p.z); if (n < 0 || zone[n] !== q.i || (kind[n] !== CELL.none && kind[n] !== CELL.land)) ok = false; continue; }
        if (!free(q, p.x, p.z, 1) && !(onLand(q) && water(p.x, p.z) && zone[idx(p.x, p.z)] === q.i && polar(p.x, p.z).r > shoreAt(q, polar(p.x, p.z).th) + 2)) ok = false;   // (its walkways may bridge its own small canals)
      }
      yield;
      if (ok) { best = c; break; }
    }
    if (!best) { q.log.push({ move: "dock", ok: false, why: "no room for a dock on its shore" }); continue; }
    q.dock = { o: best.o, d: best.d, level: 2 };
    for (let u = -A.back; u < D.length + F.length; u++) for (let w = -A.side; w <= A.side; w++) {
      const p = toWorld(best.o, best.d, u, w);
      if (u >= D.length) { if (Math.abs(w) <= F.half) mark(p.x, p.z, CELL.fair, q.i); else if (onLand(q) && Math.abs(w) <= F.half + 1 && kind[idx(p.x, p.z)] === CELL.land) mark(p.x, p.z, CELL.fair, q.i); continue; }
      const basin = u >= 0 && w >= -D.left && w <= D.right;
      if (onLand(q) && !basin && kind[idx(p.x, p.z)] !== CELL.land && !water(p.x, p.z)) continue;           // the walkways on its ground (or bridging its small canals)
      mark(p.x, p.z, basin ? CELL.basin : CELL.deck, q.i);
      built[idx(p.x, p.z)] = 1;
    }
    q.apron = rectOf(best.o, best.d, { u0: -A.back, u1: D.length - 1, w0: -A.side, w1: A.side });
    q.log.push({ move: "dock", ok: true, at: best.o, facing: best.d, level: 2 });
  }
  yield;

  // ------------------------------------------------------------ round two: the wings
  for (const q of quarters) {
    if (!q.dock) continue;
    // where the wing lands: the apron's side nearest the rings, back from the dock's mouth (so it never crosses the fairway)
    const wr = q.rules.wing;
    const hw0 = Math.max(SIM.width[0], wr.width[0]), hw1 = Math.min(SIM.width[1], wr.width[1]);
    let B = null;
    if (onLand(q)) {                                                       // onto its island's shore, mid-arc, clear of its dock
      const mid = (q.arc[0] + q.arc[1]) / 2, dockTh = polar(q.dock.o.x, q.dock.o.z).th;
      for (const da of [0, 0.05, -0.05, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.26, -0.26, 0.32, -0.32]) {   // vision: the agents' search
        const th = mid + da;
        if (Math.abs(angDiff(th, dockTh)) * geo.preK < D.left + A.side + 6) continue;   // vision: clear of the dock's mouth
        for (let r = geo.preK + SIM.ring - 4; r < geo.preK + SIM.ring + 10; r++) {   // vision: the agents' search
          const p = { x: Math.round(geo.x + Math.cos(th) * r), z: Math.round(geo.z + Math.sin(th) * r) };
          const i = idx(p.x, p.z);
          if (i >= 0 && kind[i] === CELL.land && owner[i] === q.i + 1) { B = { ...p, r: r + 2 }; break; }
        }
        if (B) break;
      }
    }
    if (!B) for (const w of [-A.side, A.side]) for (let u = -A.back; u <= D.length - 3 - Math.ceil(hw1); u++) {   // vision: the agents' search
      const p = toWorld(q.dock.o, q.dock.d, u, w);
      const r = polar(p.x, p.z).r;
      if (!B || r < B.r) B = { ...p, r };
    }
    const thB = polar(B.x, B.z).th;
    // its designs, most wanted first (its people's first form, then the shortest); the first that keeps the math is built
    const designs = [];
    for (const [fi, form] of wr.forms.entries()) for (const da of [0, 0.06, -0.06, 0.14, -0.14]) for (let v = 0; v < 4; v++) {   // vision: where it may leave the rings, and four shapes of each form
      const thA = thB + da;
      const Aa = { x: geo.x + Math.cos(thA) * (geo.preK - 1), z: geo.z + Math.sin(thA) * (geo.preK - 1) };
      designs.push({ fi, form, v, Aa, est: Math.hypot(B.x - Aa.x, B.z - Aa.z) * (form === "straight" ? 1 : 1.08) + fi * 12 + rand(seed, q.i, fi, v, 852) * 6 + Math.abs(da) * 20 });   // given: hash salt   // vision: a bent wing runs a little longer; its people's first form; a little chance
    }
    designs.sort((a, b) => a.est - b.est);
    let best = null;
    for (const { fi, form, v, Aa } of designs) {
      yield;
      const hw = lerp(hw0, hw1, rand(seed, q.i, fi, v, 850));   // given: hash salt
      const pts = wingPath(form, Aa, B, v, rand(seed, q.i, fi, v, 851));   // given: hash salt
      if (!pts) continue;
      // the math: no turn sharper than a right angle; open water (or its own ground) all the way, clear of everyone else
      let ok = true, turn = 0;
      for (let k = 2; k < pts.length && ok; k++) {
        const a1 = Math.atan2(pts[k - 1].z - pts[k - 2].z, pts[k - 1].x - pts[k - 2].x), a2 = Math.atan2(pts[k].z - pts[k - 1].z, pts[k].x - pts[k - 1].x);
        const t = Math.abs(angDiff(a2, a1));
        turn = Math.max(turn, t);
        if (t > SIM.turn + 1e-6) ok = false;   // vision: the agents' search
      }
      if (!ok) continue;
      const cells = wingCells(pts, hw);
      const reach = Math.ceil(hw + SIM.clear);
      const root2 = (geo.preK + 1.5) * (geo.preK + 1.5);   // vision: the agents' search
      for (const c of cells) {
        const dx = c.x - geo.x, dz = c.z - geo.z;
        if (dx * dx + dz * dz <= root2) continue;                              // on the rings' shore: its root
        const n = idx(c.x, c.z);
        if (n < 0) { ok = false; break; }
        if (owner[n] === q.i + 1 && (kind[n] === CELL.deck || kind[n] === CELL.land)) continue;   // onto its own ground
        if (kind[n] !== CELL.none || zone[n] === -1) { ok = false; break; }   // (and never across its own dock's mouth: that's fairway)
      }
      if (ok) for (let k = 0; k < pts.length && ok; k += 2) for (let i = -reach; i <= reach && ok; i++) for (let j = -reach; j <= reach && ok; j++) {
        const n = idx(Math.round(pts[k].x) + i, Math.round(pts[k].z) + j);
        if (n >= 0 && (kind[n] === CELL.reserved || (kind[n] !== CELL.none && owner[n] !== q.i + 1))) ok = false;
      }
      if (!ok) continue;
      let len = 0;
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
      best = { form, pts, hw, cells, len, turn };
      break;
    }
    yield;
    if (!best) { q.log.push({ move: "wing", ok: false, why: "no way across the lagoon that keeps the math" }); continue; }
    // an arch over the ring canal, high enough for the medium ships' masts: it rises over the water and comes down at each shore
    const over = best.pts.map((p) => { const i = idx(Math.round(p.x), Math.round(p.z)); return i >= 0 && polar(p.x, p.z).r > geo.preK && kind[i] !== CELL.land && kind[i] !== CELL.deck; });
    const ka = over.indexOf(true), kb = over.lastIndexOf(true);
    for (const c of best.cells) {
      const p = polar(c.x, c.z);
      if (p.r <= geo.preK || at(c.x, c.z).k !== CELL.none) continue;
      mark(c.x, c.z, CELL.wing, q.i); built[idx(c.x, c.z)] = 1;
      let k = 0, dk = Infinity;
      for (let m = 0; m < best.pts.length; m++) { const d = Math.hypot(best.pts[m].x - c.x, best.pts[m].z - c.z); if (d < dk) { dk = d; k = m; } }
      const t = kb > ka ? Math.min(1, Math.max(0, (k - ka) / (kb - ka))) : 0;
      lift[idx(c.x, c.z)] = Math.round(SIM.arch * Math.min(1, 2.2 * Math.sin(Math.PI * t)));   // vision: steep at the ends, a level span in the middle
    }
    q.wing = { form: best.form, pts: best.pts, hw: best.hw, lamps: wr.lamps, length: Math.round(best.len) };
    q.log.push({ move: "wing", ok: true, form: best.form, half: +best.hw.toFixed(2), length: Math.round(best.len), turn: +best.turn.toFixed(2) });
  }
  yield;

  // ------------------------------------------------------------ then the buildings, a move each in turn
  const art = new Map();
  for (const q of quarters) {
    const s = q.style;
    const wood = (s.post ?? "spruce").replace(/minecraft:|stripped_|_log|_block|_stem/g, "") || "spruce";
    art.set(q.key, drawPieces(s.arch, { base: s.base ?? "minecraft:cobblestone", wood }));
    const [h0, h1] = q.rules.homes;
    const homes = h0 + (hash(seed, q.i, 860) % (h1 - h0 + 1));   // given: hash salt
    q.program = ["main", "side", ...Array(homes).fill("home")];
    yield;
  }
  yield;
  for (let round = 0; quarters.some((q) => q.dock && q.program.length); round++) {
    for (const q of quarters) {
      if (!q.dock || !q.program.length) continue;
      const which = q.program.shift();
      const relax = q.program.relax === which;                               // a second try, bending its own rules for this building
      if (relax) q.program.relax = "spent";
      const canvas = art.get(q.key)[which];
      const b = canvas.bounds ?? (canvas.bounds = boundsOf(canvas));
      let best = null;
      // where to look: anywhere in its arc, and round what it has already built (its gates mostly speak of those)
      const spots = [];
      for (let t = 0; t < SIM.tries.piece; t++) {
        const th = lerp(q.arc[0], q.arc[1], rand(seed, q.i, round, t, 870));   // given: hash salt
        const s = 3 + Math.floor(rand(seed, q.i, round, t, 871) * 56);   // given: hash salt   // vision: how far in from the cliff foot it may stand
        const r = geo.rin(th) - s;
        if (r >= geo.preK + 6) spots.push({ x: Math.round(geo.x + Math.cos(th) * r), z: Math.round(geo.z + Math.sin(th) * r) });   // vision: the agents' search
      }
      for (const near of [...q.pieces.slice(-4).map((p) => p.mid), rectMid(q.apron)]) for (const dist of [9, 14, 20, 27]) for (let k = 0; k < 8; k++) {   // vision: four rings of eight round the yard and the last few buildings
        const a = (k / 8) * TAU + rand(seed, q.i, round, dist, 873) * 0.8;   // given: hash salt
        spots.push({ x: Math.round(near.x + Math.cos(a) * dist), z: Math.round(near.z + Math.sin(a) * dist) });
      }
      for (let t = 0; t < spots.length; t++) {
        const o = spots[t];
        for (const d of CARDS) {
          const rect = rectOf(o, d, b);
          let ok = true;
          for (let x = rect[0]; x <= rect[2] && ok; x++) for (let z = rect[1]; z <= rect[3] && ok; z++) if (!free(q, x, z, SIM.gap, true)) ok = false;   // vision: the agents' search
          if (!ok) continue;
          const piece = { which, o, d, rect, mid: rectMid(rect), long: b.u1 - b.u0 >= b.w1 - b.w0 ? d : { x: -d.z, z: d.x } };
          const verdicts = q.rules.gates.filter((g) => g.piece === which || g.piece === "*").map((g) => ({ g, pass: gate(g, piece, q, geo) }));
          const bent = (v) => relax && v.g.piece === which;                     // a rule its people would bend before going without
          if (verdicts.some((v) => v.g.must && !v.pass && !bent(v))) continue;
          const score = verdicts.reduce((sum, v) => sum + ((v.g.prefer || bent(v)) && v.pass ? v.g.weight ?? 3 : 0), 0) - Math.hypot(piece.mid.x - q.dock.o.x, piece.mid.z - q.dock.o.z) * 0.02 + rand(seed, q.i, round, t, 872) * 0.3;   // given: hash salt   // vision: keep near the yard, and a little chance
          if (!best || score > best.score) best = { score, piece, verdicts: verdicts.map((v) => (v.g.must && bent(v) && !v.pass ? { ...v, bentRule: true } : v)) };
        }
        if (t % 2 === 1) yield;   // vision: the agents' search
      }
      if (best) {
        // its path: from its door out to its people's ground
        const door = toWorld(best.piece.o, best.piece.d, b.u1 + 1, 0);
        const path = findPath(door, q, at, (x, z) => free(q, x, z, 1) || (at(x, z).o === q.i + 1 && at(x, z).k === CELL.deck) || (onLand(q) && water(x, z) && zone[idx(x, z)] === q.i && polar(x, z).r > shoreAt(q, polar(x, z).th) + 2));   // (a footbridge over its own small canals)
        if (!path) {
          q.log.push({ move: which, ok: false, why: "no path to its people's ground" });
          if (!relax && !q.program.relax && !q.pieces.some((p) => p.which === which)) { q.program.unshift(which); q.program.relax = which; }
          continue;
        }
        const r = best.piece.rect;
        for (let x = r[0]; x <= r[2]; x++) for (let z = r[1]; z <= r[3]; z++) { mark(x, z, CELL.deck, q.i); built[idx(x, z)] = 1; }   // vision: the agents' search
        for (const p of path) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const x = p.x + i, z = p.z + j, n = idx(x, z);
          if (n < 0) continue;
          if (kind[n] === CELL.land && owner[n] === q.i + 1) { mark(x, z, CELL.deck, q.i); continue; }   // a path on its ground
          if (kind[n] === CELL.none && lagoonAt(x, z) && (!onLand(q) || (i === 0 && j === 0) || Math.abs(i) + Math.abs(j) === 1)) { mark(x, z, CELL.deck, q.i); if (onLand(q)) lift[n] = 2; }   // vision: a footbridge, two over the water, for the small boats
        }
        best.piece.canvas = canvas;
        q.pieces.push(best.piece);
        q.log.push({ move: which, ok: true, at: best.piece.o, facing: best.piece.d, relaxed: relax || undefined, gates: best.verdicts.map((v) => `${v.pass ? "✓" : v.bentRule ? "~" : "✗"} ${v.g.must ? "must" : "prefer"} ${v.g.must ?? v.g.prefer}: ${v.g.why}`) });
      } else {
        const failed = q.rules.gates.filter((g) => g.must && (g.piece === which || g.piece === "*")).map((g) => g.must);
        q.log.push({ move: which, ok: false, why: `nowhere passes its gates (${failed.join(", ") || "the port's math"})` });
        // a people never goes without a home or a gathering place: it tries once more, bending its own rules for it (the log keeps that)
        if (!relax && !q.program.relax && !q.pieces.some((p) => p.which === which)) { q.program.unshift(which); q.program.relax = which; }
      }
      yield;
    }
  }
  // ------------------------------------------------------------ last, each people plants its own trees on what's left of its ground
  for (const q of quarters) {
    q.trees = [];
    if (!onLand(q) || !q.rules.trees.length) continue;
    const step = 5;   // vision: a tree's room
    const xs = [], zs = [];
    for (let t = 0; t <= 8; t++) for (const r of [geo.preK, geo.rmax]) { const a = lerp(q.arc[0], q.arc[1], t / 8); xs.push(geo.x + Math.cos(a) * r); zs.push(geo.z + Math.sin(a) * r); }   // vision: the arc's corners
    const bx0 = Math.floor(Math.min(...xs)), bx1 = Math.ceil(Math.max(...xs)), bz0 = Math.floor(Math.min(...zs)), bz1 = Math.ceil(Math.max(...zs));
    for (let x = bx0 - (bx0 % step); x <= bx1; x += step) {
      if (x % (step * 6) === 0) yield;   // vision: a few columns of trees a step
      for (let z = bz0 - (bz0 % step); z <= bz1; z += step) {
      const tx = x + (hash(x, z, seed, 880) % 3) - 1, tz = z + (hash(x, z, seed, 881) % 3) - 1;   // given: hash salts
      const n = idx(tx, tz);
      if (n < 0 || zone[n] !== q.i || kind[n] !== CELL.land) continue;
      if (rand(tx, tz, seed, 882) > q.rules.groves) continue;   // given: hash salt
      let clear = true;
      for (let a = -2; a <= 2 && clear; a++) for (let b = -2; b <= 2 && clear; b++) { const m = idx(tx + a, tz + b); if (m < 0 || kind[m] !== CELL.land) clear = false; }   // vision: a crown's reach
      if (!clear) continue;
      const kindOf = q.rules.trees[hash(tx, tz, seed, 883) % q.rules.trees.length];   // given: hash salt
      q.trees.push({ x: tx, z: tz, kind: kindOf, h: (kindOf === "bamboo" ? 7 : 4) + (hash(tx, tz, seed, 884) % 3) });   // given: hash salt   // vision: a tree's height
      }
    }
    yield;
  }
  const ground = (x, z) => { const i = idx(x, z); return i >= 0 && (kind[i] === CELL.land || (kind[i] === CELL.deck && (built[i] ? onLand(quarters[owner[i] - 1] ?? { rules: {} }) : lift[i] === 0 && quarters[owner[i] - 1] && onLand(quarters[owner[i] - 1])))); };
  return { G, N, kind, owner, quarters, at, ground, liftAt: (x, z) => { const i = idx(x, z); return i < 0 ? 0 : lift[i]; }, lines: Object.fromEntries(quarters.map((q) => [q.key, art.get(q.key).lines])) };
}

/** A wing's centre line, from the rings' shore (a) to its quarter (b), in the given form. */
export function wingPath(form, a, b, v, r) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  if (L < 4) return null;   // vision: the agents' search
  const n = { x: -dz / L, z: dx / L };
  const side = v % 2 ? -1 : 1;
  const pts = [];
  const at = (t, off) => ({ x: a.x + dx * t + n.x * off, z: a.z + dz * t + n.z * off });
  if (form === "straight") { for (let s = 0; s <= L; s++) pts.push(at(s / L, 0)); return pts; }
  if (form === "arc") { const bend = side * lerp(0.08, 0.28, r) * L; for (let s = 0; s <= L; s++) { const t = s / L; pts.push(at(t, 4 * bend * t * (1 - t))); } return pts; }   // vision: how far an arc bows
  if (form === "meander") { const amp = lerp(4, 9, r); for (let s = 0; s <= L; s++) { const t = s / L; pts.push(at(t, side * amp * Math.sin(TAU * 1.5 * t) * Math.sin(Math.PI * t))); } return pts; }   // vision: a boardwalk's wander
  // dogleg and zigzag: straight legs between corners
  const corners = [];
  if (form === "dogleg") corners.push({ t: lerp(0.35, 0.65, r), off: side * lerp(0.12, 0.3, r) * L });   // vision: where it bends, and how far
  else { const k = 3 + Math.floor(r * 3), z = Math.min(8, Math.max(3, L / (k * 2))); for (let i = 1; i < k; i++) corners.push({ t: i / k, off: (i % 2 ? side : -side) * z }); }   // vision: a zigzag's legs
  const knots = [{ t: 0, off: 0 }, ...corners, { t: 1, off: 0 }];
  for (let i = 1; i < knots.length; i++) {
    const p = at(knots[i - 1].t, knots[i - 1].off), q = at(knots[i].t, knots[i].off);
    const l = Math.max(1, Math.round(Math.hypot(q.x - p.x, q.z - p.z)));
    for (let s = i === 1 ? 0 : 1; s <= l; s++) pts.push({ x: p.x + ((q.x - p.x) * s) / l, z: p.z + ((q.z - p.z) * s) / l });
  }
  return pts;
}
/** The cells a wing covers: a disc of its half width at every point of its centre line. */
export function wingCells(pts, hw) {
  const seen = new Set(), out = [];
  const R = Math.ceil(hw);
  for (const p of pts) for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    const x = Math.round(p.x) + i, z = Math.round(p.z) + j;
    if (Math.hypot(x - p.x, z - p.z) > hw + 0.25) continue;   // vision: the agents' search
    const k = `${x},${z}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ x, z });
  }
  return out;
}

/** The shortest way from a door to its people's ground (deck or wing), through free water. */
function findPath(door, q, at, passable) {
  const own = (x, z) => { const c = at(x, z); return c.o === q.i + 1 && (c.k === CELL.deck || c.k === CELL.wing); };
  const key = (x, z) => (x + 32768) * 65536 + (z + 32768);   // given: a key from two block coordinates
  const prev = new Map([[key(door.x, door.z), -1]]);
  let frontier = [door.x, door.z];
  for (let step = 0; step <= SIM.path && frontier.length; step++) {
    const next = [];
    for (let f = 0; f < frontier.length; f += 2) {
      const px = frontier[f], pz = frontier[f + 1];
      if (step > 0 && own(px, pz)) {
        const out = [];
        for (let k = key(px, pz); k !== -1; k = prev.get(k)) out.push({ x: Math.floor(k / 65536) - 32768, z: (k % 65536) - 32768 });   // given: the key's halves
        return out;
      }
      for (const d of CARDS) {
        const x = px + d.x, z = pz + d.z, k = key(x, z);
        if (prev.has(k)) continue;
        if (!own(x, z) && !passable(x, z)) continue;
        prev.set(k, key(px, pz));
        next.push(x, z);
      }
    }
    frontier = next;
  }
  return null;
}

/** Whether a building would pass one of its people's gates. */
export function gate(g, piece, q, geo) {
  const rule = g.must ?? g.prefer;
  const m = piece.mid;
  const toward = (t) => { const dx = t.x - m.x, dz = t.z - m.z, L = Math.hypot(dx, dz) || 1; return (piece.d.x * dx + piece.d.z * dz) / L; };
  const radial = (() => { const dx = m.x - geo.x, dz = m.z - geo.z, L = Math.hypot(dx, dz) || 1; return { x: dx / L, z: dz / L }; })();   // out toward the cliff
  const rects = (what) => (what === "dock" ? [q.apron] : what === "shore" ? [] : q.pieces.filter((p) => p.which === what).map((p) => p.rect));
  const shoreIn = () => geo.rin(Math.atan2(m.z - geo.z, m.x - geo.x)) - Math.hypot(m.x - geo.x, m.z - geo.z);
  switch (rule) {
    case "faces": {
      if (g.to === "water") return -(piece.d.x * radial.x + piece.d.z * radial.z) >= 0.5;
      if (g.to === "shore") return piece.d.x * radial.x + piece.d.z * radial.z >= 0.5;
      if (g.to === "south") return piece.d.z === 1;
      const ts = rects(g.to);
      return ts.length ? ts.some((r) => toward(rectMid(r)) >= 0.5) : false;
    }
    case "parallel": return Math.abs(piece.long.x * radial.x + piece.long.z * radial.z) <= 0.5;
    case "near": {
      if (g.to === "shore") return shoreIn() <= g.within;
      const ts = rects(g.to);
      return ts.length ? Math.min(...ts.map((r) => rectDist(piece.rect, r))) <= g.within : false;
    }
    case "behind": {
      const ts = rects(g.to);
      const rr = Math.hypot(m.x - geo.x, m.z - geo.z), th = Math.atan2(m.z - geo.z, m.x - geo.x);
      return ts.some((r) => {
        const t = rectMid(r), tr = Math.hypot(t.x - geo.x, t.z - geo.z), tth = Math.atan2(t.z - geo.z, t.x - geo.x);
        const back = rr - tr, along = Math.abs(angDiff(th, tth)) * tr;
        return back >= g.range[0] && back <= g.range[1] && along <= 24;   // vision: behind it, not off along the shore
      });
    }
    case "around": {
      const ts = rects(g.to);
      if (!ts.length) return false;
      const c = rectMid(ts[0]);
      const dist = Math.hypot(m.x - c.x, m.z - c.z);
      if (dist < g.range[0] || dist > g.range[1]) return false;
      const a = Math.atan2(m.z - c.z, m.x - c.x);
      return q.pieces.filter((p) => p.which === piece.which).every((p) => Math.abs(angDiff(Math.atan2(p.mid.z - c.z, p.mid.x - c.x), a)) >= 0.5);   // vision: spread round it
    }
    case "row": return q.pieces.some((p) => p.which === piece.which && p.d.x === piece.d.x && p.d.z === piece.d.z && rectDist(p.rect, piece.rect) <= g.gap + 1.5);   // vision: the agents' search
    case "apart": return q.pieces.every((p) => rectDist(p.rect, piece.rect) >= g.gap);
    case "out": { const s = shoreIn(); return s >= g.range[0] && s <= g.range[1]; }
    default: return false;
  }
}
