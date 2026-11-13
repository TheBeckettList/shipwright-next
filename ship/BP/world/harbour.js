// Pure. A town's waterfront, worked out on its own warped plane (world/growth.js planeOf): where the harbour goes,
// how long its quay runs, how many piers, whether a mole shelters it, where its lights stand. The fleet's demand is
// boatsizes.js harbourOf's (the quay's run, the boathouses, the slip, the depth under the keel, the channel), through
// shipping.js seaOf; the shore's supply is the plane's.
//
//   shelter   from the water just off a shore cell, rays out every sixteenth of a turn, FETCH blocks long: the share
//             that meet land is how enclosed the water is (a bay's near one, an open beach's near a half). The fetch
//             upwind (the wind belt's bearing) is how much sea the weather has to build its waves over
//   depth     the walk out from the shore along the cell's outward normal to water as deep as the fleet's keels ask:
//             the quay stands where that is short (dredged to it), a pier reaches it where it is long
//   the site  each shore cell's score: shelter^phi, the depth's reach (1 / (1 + reach / 8)), the town's sand there
//             (the harbour is the seafront's peak), its ease. The quay is the best window of the shore's chain as long
//             as the fleet's run; what the chain can't hold goes out on piers, spaced two berths and a channel apart
//   the mole  a town or a city on exposed water (its quay's mean shelter under 1/phi) builds a breakwater: out from
//             the quay's upwind end, then along the shore across the weather, leaving a mouth phi^2 channels wide
//   the lights a light stands where the most open sea can see it (rays of 55 that reach open water, the approach's
//             bearing counted double), on high ground near the mouth; a city puts a second on the mole's head
//   by level  INFRA below: what each size of place builds at the water
import { FIB, PHI } from "../core/golden.js";

export const FETCH = FIB[8];   // derived: thirty-four blocks a shelter ray
export const VIEW = FIB[9];    // derived: fifty-five blocks a light's ray
const RAYS = FIB[6] + FIB[3];  // derived: sixteen bearings, the compass's points
const TAU = 2 * Math.PI;   // given
// what each size of place builds at its water (vision: after the historical harbours, hamlet to capital)
export const INFRA = {
  1: { name: "landing", builds: ["the beach or racks the boats are drawn up on", "drying racks", "a path down"], quay: false, piers: 0, mole: false, lights: 0, slips: 0, light: null },
  2: { name: "jetty harbour", builds: ["a timber jetty", "a slip", "the net loft", "the fish market", "a beacon fire on the headland"], quay: false, piers: 1, mole: false, lights: 1, slips: 1, light: "fire" },
  3: { name: "quayed port", builds: ["a stone quay its fleet's run", "piers for what the shore can't hold", "the shipyard's slip", "warehouses on the quay", "the harbourmaster's house", "a lighthouse on the headland", "a mole if the water is open"], quay: true, piers: FIB[4], mole: true, lights: 1, slips: 1, light: "tower" },   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  4: { name: "enclosed harbour", builds: ["the quays round a basin", "moles with a light on each head", "slips for the great hulls", "the ropewalk", "the counting house", "a great light"], quay: true, piers: FIB[5], mole: true, lights: FIB[3], slips: FIB[3], light: "great" },   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
};
export const RUN_MIN = { 1: FIB[4], 2: FIB[6], 3: FIB[8], 4: FIB[10] };   // vision: the least waterfront a place keeps (its fishing boats, its visitors), hamlet to city
const LIGHT_H = { fire: FIB[4], tower: FIB[6] + FIB[4], great: FIB[7] + FIB[5] };   // vision: a beacon's cairn, a tower to clear the roofs, a great light

/** The harbour on a plane: { quay, piers, mole, lights, slips, site, measures }; polylines in the plane's frame. */
export function harbourPlan(pl, pour, { level = 1, need = null, wind = 0, approach = null, keep = "quay" } = {}) {
  const { N, I, inside, h, wet, can } = pl, P = pour.P, Pm = pour.max || 1, L = Math.min(4, Math.max(1, level)), spec = INFRA[L];   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  const depth = need?.depth ?? 1, run = Math.max(RUN_MIN[L], (need?.quay ?? 0) + (need?.beach ?? 0) + (need?.racks ?? 0)), channel = need?.channel ?? FIB[3];   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  const deepAt = (k) => sea[k] && -h[k] >= depth;
  // the navigable water: what joins the open sea past the window's edge (a pond or a landlocked lake is no harbour)
  const sea = new Uint8Array(N * N), q0 = [];
  for (let i = 0; i < N; i++) for (const k of [i, (N - 1) * N + i, i * N, i * N + N - 1]) if (wet[k] && !sea[k]) { sea[k] = 1; q0.push(k); }
  for (let i = 0; i < q0.length; i++) { const k = q0[i]; for (const d of [1, -1, N, -N]) { const K = k + d; if (K >= 0 && K < N * N && wet[K] && !sea[K]) { sea[K] = 1; q0.push(K); } } }
  // the shore: land of the town beside water
  const shore = [];
  for (let z = -pl.R + 1; z < pl.R; z++) for (let x = -pl.R + 1; x < pl.R; x++) {
    const k = I(x, z); if (!can[k] || wet[k] || P[k] <= 0) continue;
    let nx = 0, nz = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (sea[I(x + a, z + b)]) { nx += a; nz += b; }
    if (!nx && !nz) continue; const m = Math.hypot(nx, nz); shore.push({ x, z, k, n: [nx / m, nz / m] });
  }
  if (!shore.length) return null;
  const ray = (x, z, a, len, hit) => { for (let s = 1; s <= len; s++) { const X = Math.round(x + Math.cos(a) * s), Z = Math.round(z + Math.sin(a) * s); if (!inside(X, Z)) return len; if (hit(I(X, Z))) return s; } return Infinity; };
  for (const c of shore) {
    const wx = c.x + c.n[0], wz = c.z + c.n[1];   // the water just off it
    let hits = 0; for (let r = 0; r < RAYS; r++) if (ray(wx, wz, (r * TAU) / RAYS, FETCH, (k) => !wet[k]) !== Infinity) hits++;
    c.shelter = hits / RAYS;
    c.fetch = Math.min(FETCH, ray(wx, wz, wind, FETCH, (k) => !wet[k]));
    const out = ray(c.x, c.z, Math.atan2(c.n[1], c.n[0]), FIB[7], (k) => deepAt(k));   // derived: a pier of twenty-one at most
    c.reach = out === Infinity ? FIB[7] + 1 : out;   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
    c.score = c.shelter ** PHI / (1 + c.reach / FIB[5]) * (P[c.k] / Pm) * (0.5 + (pl.ease[c.k] ?? 1) / 2);   // the harbour is the seafront's peak: the sand counts whole   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  }
  // the shore's chains: shore cells joined eight ways, each walked end to end
  const byK = new Map(shore.map((c) => [c.k, c])), seen = new Set(), chains = [];
  for (const c0 of shore) {
    if (seen.has(c0.k)) continue;
    const comp = [], st = [c0]; seen.add(c0.k);
    while (st.length) { const c = st.pop(); comp.push(c); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const k = I(c.x + a, c.z + b), d = byK.get(k); if (d && !seen.has(k)) { seen.add(k); st.push(d); } } }
    // order it: from one end (the cell farthest from an arbitrary one), greedy nearest
    const far = (from) => comp.reduce((b, c) => (Math.hypot(c.x - from.x, c.z - from.z) > Math.hypot(b.x - from.x, b.z - from.z) ? c : b), comp[0]);
    let cur = far(far(comp[0])); const left = new Set(comp), ord = [];
    while (cur) { ord.push(cur); left.delete(cur); let nb = null, bd = 2; for (const c of left) { const d = Math.hypot(c.x - cur.x, c.z - cur.z); if (d < bd) { bd = d; nb = c; } } cur = nb; }
    chains.push(ord);
  }
  // the quay: the best window of a chain, the fleet's run long (or all the chain has)
  let site = null;
  for (const ch of chains) {
    const w = Math.min(ch.length, run); let sum = 0;
    for (let i = 0; i < ch.length; i++) { sum += ch[i].score; if (i >= w) sum -= ch[i - w].score; if (i >= w - 1 && (!site || sum > site.sum)) site = { ch, a: i - w + 1, b: i, sum }; }
  }
  if (!site) return null;
  const quayCells = site.ch.slice(site.a, site.b + 1), shelter = quayCells.reduce((s, c) => s + c.shelter, 0) / quayCells.length;
  const mid = quayCells[quayCells.length >> 1];
  const out = { level: L, infra: spec.name, keep, site: { x: mid.x, z: mid.z, n: mid.n }, quay: null, beach: null, piers: [], mole: null, lights: [], slips: [], measures: { run, held: quayCells.length, shelter, fetch: mid.fetch, reach: mid.reach } };
  const line = quayCells.map((c) => [c.x, c.z]);
  if (spec.quay && keep === "quay") out.quay = line; else out.beach = line;   // a quay where a town keeps its boats afloat; elsewhere the shore they're drawn up on
  // the piers: what the shore couldn't hold, out along the normal to the keels' depth, two berths and a channel apart
  const deficit = Math.max(0, run - quayCells.length), B = need?.B ?? FIB[3], gapP = 2 * (B + 2) + channel;   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  const pierLen = Math.max(FIB[5], Math.min(FIB[7], mid.reach + FIB[3]));   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  const shallow = mid.reach > FIB[5], berths = shallow ? run : deficit;   // a shore too shallow for the keels within eight blocks puts all its berths out on piers   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  const np = Math.min(spec.piers, berths > 0 ? Math.max(1, Math.ceil(berths / (2 * pierLen))) : spec.piers && !spec.quay ? 1 : 0);
  out.measures.shallow = shallow;
  for (let i = 0; i < np; i++) {
    const j = Math.round(((i + 1) * quayCells.length) / (np + 1)), c = quayCells[Math.min(quayCells.length - 1, j)];
    if (out.piers.some((p) => Math.hypot(p[0][0] - c.x, p[0][1] - c.z) < gapP)) continue;
    const pts = []; for (let s = 1; s <= pierLen; s++) { const X = Math.round(c.x + c.n[0] * s), Z = Math.round(c.z + c.n[1] * s); if (!inside(X, Z) || !sea[I(X, Z)]) break; pts.push([X, Z]); }
    if (pts.length >= FIB[4]) out.piers.push([[c.x, c.z], ...pts]);   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  }
  // the mole: on open water, out from the quay's upwind end and along across the weather, a mouth left at the other end
  if (spec.mole && keep === "quay" && shelter < 1 / PHI && quayCells.length > FIB[5]) {   // a stone mole is a quayed people's work; the beach and boathouse peoples draw their boats up instead   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
    const e0 = quayCells[0], e1 = quayCells.at(-1), up = Math.cos(wind) * (e0.x - e1.x) + Math.sin(wind) * (e0.z - e1.z) > 0 ? [e0, e1] : [e1, e0];   // the upwind end first
    const [s0, s1] = up, n = [(s0.n[0] + s1.n[0]) / 2, (s0.n[1] + s1.n[1]) / 2], nm = Math.hypot(...n) || 1, nn = [n[0] / nm, n[1] / nm];
    const off = Math.max(FIB[5], Math.min(FIB[7], Math.round(Math.sqrt((need?.basin ?? FIB[8] * FIB[5]) / quayCells.length) + FIB[3])));   // derived: the basin's depth off the quay, its area over the quay's run
    const mouth = Math.min(channel * PHI ** 2, Math.hypot(s1.x - s0.x, s1.z - s0.z) / PHI ** 2), pts = [];   // derived: a mouth phi^2 channels wide, or a golden square's part of the quay
    for (let s = 1; s <= off; s++) pts.push([Math.round(s0.x + nn[0] * s), Math.round(s0.z + nn[1] * s)]);
    const ax = s1.x - s0.x, az = s1.z - s0.z, aL = Math.hypot(ax, az) || 1, along = Math.max(0, aL - mouth);
    for (let s = 1; s <= along; s++) pts.push([Math.round(s0.x + nn[0] * off + (ax / aL) * s), Math.round(s0.z + nn[1] * off + (az / aL) * s)]);
    if (pts.length > FIB[5]) out.mole = [[s0.x, s0.z], ...pts.filter(([x, z]) => inside(x, z))];   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
    out.measures.mouth = mouth;
  }
  // the slips: where the shore falls gently to the water, nearest the quay (one, or a city's three)
  const gentle = site.ch.filter((c) => (pl.ease[c.k] ?? 0) > 1 / PHI ** 2).sort((a, b) => Math.hypot(a.x - mid.x, a.z - mid.z) - Math.hypot(b.x - mid.x, b.z - mid.z));
  for (const c of gentle) { if (out.slips.length >= spec.slips) break; if (out.slips.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < FIB[6])) continue; out.slips.push({ x: c.x, z: c.z, n: c.n }); }   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  // the lights: on the land the open sea sees most of, near the mouth, the approach counted double
  if (spec.lights) {
    const mouth = out.mole ? out.mole.at(-1) : [mid.x + mid.n[0] * FIB[5], mid.z + mid.n[1] * FIB[5]], cands = [];   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
    for (let z = -pl.R + 2; z < pl.R - 1; z += 2) for (let x = -pl.R + 2; x < pl.R - 1; x += 2) {
      const k = I(x, z); if (!can[k] || wet[k]) continue; const dm = Math.hypot(x - mouth[0], z - mouth[1]); if (dm > VIEW) continue;
      let open = 0, wsum = 0; for (let r = 0; r < RAYS * 2; r++) { const a = (r * TAU) / (RAYS * 2), wgt = approach !== null && Math.cos(a - approach) > 1 / PHI ? 2 : 1; wsum += wgt; let water = 0; for (let s = 1; s <= VIEW; s++) { const X = Math.round(x + Math.cos(a) * s), Z = Math.round(z + Math.sin(a) * s); if (!inside(X, Z)) { water += VIEW - s; break; } const kk = I(X, Z); if (sea[kk]) water++; else if (Math.max(0, h[kk]) > Math.max(0, h[k])) break; } open += wgt * water / VIEW; }
      cands.push({ x, z, v: (open / wsum) * (1 + Math.max(0, h[k]) / FIB[7]) / (1 + dm / VIEW) });   // derived: the sea it sees, a block of height a 21st more, nearer the mouth better
    }
    cands.sort((a, b) => b.v - a.v);
    const kind = spec.light;
    if (cands[0]) out.lights.push({ x: cands[0].x, z: cands[0].z, kind, h: LIGHT_H[kind], sees: +cands[0].v.toFixed(3), at: "headland" });   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
    if (L >= 4 && out.mole) out.lights.push({ x: out.mole.at(-1)[0], z: out.mole.at(-1)[1], kind: "tower", h: LIGHT_H.tower, at: "mole head" });   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
    if (L >= 4) for (const c of cands.slice(1)) { if (out.lights.length >= spec.lights) break; if (out.lights.every((l) => Math.hypot(l.x - c.x, l.z - c.z) > VIEW)) out.lights.push({ x: c.x, z: c.z, kind: "tower", h: LIGHT_H.tower, sees: +c.v.toFixed(3), at: "the far headland" }); }   // vision: the harbour's own measure (its runs, reaches and levels, in Fibonacci numbers)
  }
  return out;
}
