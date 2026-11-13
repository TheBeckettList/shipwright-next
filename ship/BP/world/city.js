// Pure (given a loaded map). The city of Thera: the Atlanteans' own city on Pre-Kameni, the cone in
// the bay, and round it, on the shallow bay floor, the hub every people sails to. A plan, drawn on
// the natural island (thera.js), each part where the ground puts it:
//
//   the cothon     the city's core docks, after Carthage's: a rectangular merchant harbour opening to
//                  the bay, and through it the round harbour, its ring of shipsheds and the harbour
//                  master's island in the middle. Cut into the cone's flank that faces the strait,
//                  so a ship from the sea sails straight in. The one round thing in the city, because
//                  that's what a cothon is
//   the Exchange   the great market and its warehouses, on the merchant harbour's quays
//   the fairway    the ships' road from the strait to the cothon, kept clear through the quarters
//   the inner city the Atlanteans' terraces up the cone: streets along its own contours, stairs
//                  straight downhill, the Library on the terrace over the round harbour, the
//                  acropolis on the summit. Its ground is the cone's, so nothing is laid out on a
//                  compass
//   the quarters   the peoples' dock quarters on the bay floor: a patchwork, each tradition holding
//                  several quarters across the bay (more for those who trade more: the world's
//                  goods by tradition, peoples.js), canals between and through them (the maze),
//                  a ring canal round the cone and a wall canal under the cliffs
//   the towns      the Therans' towns across the island, on the ground that suits each (towns.js)
//   the Light      on the stack in the middle of the strait: every ship from the sea passes under it
import { PHI } from "../core/golden.js";
import { THERA, theraMetres, warp } from "./thera.js";
import { fbm, ridged, smoothstep } from "../core/noise.js";
import { peoples } from "./peoples.js";
import { TRADITIONS } from "./traditions.js";
import { townAt, towns } from "./towns.js";
import { THERANS, blendAt } from "./therans.js";

export const CITY = Object.freeze({
  cothon: {                 // vision: Carthage's proportions (round harbour 325 m across, island 106 m, merchant harbour 456 x 356 m), at about 1.6 times this map's 1:10 so ships of every size can turn in it
    round: 0.26, island: 0.085, sheds: 0.19,   // vision: km: the round harbour's radius, its island's (the Sea Rite Temple stands on it: about 34 blocks out in the warped plane, enough for the temple's 34 by 55), the shipshed ring's depth; the water round the island a great ship's turn (about 21 blocks)
    neck: [0.07, 0.1],                         // vision: km: the channel from merchant to round harbour (half width, length)
    merchant: [0.36, 0.28],                    // vision: km: the merchant harbour's half length (toward the bay) and half width
    quay: 0.02, piers: 21, pier: 0.012,         // vision: km: the ring's back behind the slips (four blocks); twenty-one great slips round the ring (the user's word, 12 Nov: fewer berths, each a great ship's: thirty-eight deep for a ship of thirty-four and the cradle; a pier five wide between each), was fifty-six; (fourteen a quarter, so it is the same seen from each side of the map's square), a pier two blocks wide between each (half width in km)
    inset: 1.05, turn: -0.85,                  // vision: share of the cone's radius from its middle to the round harbour's middle (cut into the cone's shore), and its bearing turned off the axis to the right (radians), clear of the cascading pools that run down the axis
  },   // vision: the plan's numbers
  fairway: { half: 0.075, wander: 0.18 },      // vision: km: the ships' road's half width, and how far it bends with the bay floor
  terrace: 7, street: 0.22,                    // vision: blocks of height between the inner city's streets; share of a terrace the street takes
  stairs: { count: 7, half: 0.02 },            // vision: stairways down the cone; their half width (km, at the foot)
  acropolis: 0.84, library: [0.36, 0.52, 0.42],   // vision: shares of the summit's height: the acropolis above; the Library's terrace band, and its reach either side of the cothon's bearing (radians)
  rings: { inner: [0.97, 1.08], wall: 0.92 },  // vision: the ring canal round the cone (shares of the cone's radius), the wall canal beyond this share of the bay's
  quarters: { seeds: 40, canal: 0.028, lanes: 0.13 * (100 / 34) / 4.5, lanesScale: 100 / 34 },   // vision: quarters in the bay; canal half width between them (km); derived: the lanes a city block of 34 blocks apart (a Fibonacci block: two rows of the deepest houses and their lane, world/pinnacle.js), at the old lanes' width (their share scaled with the spacing)
  light: { r: 0.06 },                          // vision: km: the Light's footprint on the stack's top
});

const GOLD = Math.PI * (3 - Math.sqrt(5));     // given: the golden angle
const D = THERA.dome, B = THERA.bay;
// The city is laid out in the island's own plane (thera.js warp), where the cone and the bay are the
// shapes they were drawn as; a point of that plane goes back to the real one by undoing the warp.
export function unwarp(x, y) {
  let p = [x, y];
  for (let k = 0; k < 8; k++) { const w = warp(p[0], p[1]); p = [p[0] + (x - w[0]), p[1] + (y - w[1])]; }   // vision: eight refinements
  return p;
}

// the cothon's frame: its axis points from the cone's middle toward the strait's inner mouth
const mouth = THERA.strait.path[0];
const axis = Math.atan2(mouth[1] - D.y, mouth[0] - D.x);
const C = CITY.cothon;
const roundAt = { x: D.x + Math.cos(axis + C.turn) * D.r * C.inset, y: D.y + Math.sin(axis + C.turn) * D.r * C.inset };
let CW = null;
/** The cothon in the real plane (km, y north): its middle, and the bearing of its mouth (toward the main channel). */
export const cothonWorld = () => { if (CW) return CW; const [x, y] = unwarp(roundAt.x, roundAt.y), out0 = C.round + C.sheds + C.quay, [ex, ey] = unwarp(roundAt.x + Math.cos(axis) * out0, roundAt.y + Math.sin(axis) * out0); const q = Math.PI / 2, mouth = Math.round(Math.atan2(ey - y, ex - x) / q) * q, K = THERA.KM; return (CW = { x: Math.round(x * K) / K, y: Math.round(y * K) / K, mouth }); };   // given: square to the map: its middle on a whole block, its mouth turned to the nearest of the four quarters
const local = (x, y, o) => { const dx = x - o.x, dy = y - o.y; return { a: dx * Math.cos(axis) + dy * Math.sin(axis), b: -dx * Math.sin(axis) + dy * Math.cos(axis) }; };
const neckEnd = C.round + C.neck[1];
const merchantAt = { x: roundAt.x + Math.cos(axis) * (neckEnd + C.merchant[0]), y: roundAt.y + Math.sin(axis) * (neckEnd + C.merchant[0]) };
const fairwayPath = (() => {   // from the main cothon's neck to the lagoon's mouth, bending with the floor, then out the strait: the channel the docks line
  const out0 = C.round + C.sheds + C.quay, a = { x: roundAt.x + Math.cos(axis) * out0, y: roundAt.y + Math.sin(axis) * out0 }, b = { x: mouth[0], y: mouth[1] };
  const pts = [];
  for (let k = 0; k <= 8; k++) {   // vision: eight bends
    const t = k / 8, bend = Math.sin(t * Math.PI) * CITY.fairway.wander * (fbm(t * 3, 1, 91, 2) - 0.5) * 2;   // vision: the bends' noise
    pts.push([a.x + (b.x - a.x) * t - Math.sin(axis) * bend, a.y + (b.y - a.y) * t + Math.cos(axis) * bend]);
  }
  return [...pts, ...THERA.strait.path.slice(1)];
})();
// the harbour from the cone to the mouth: small cothons cut into the shores beside the fairway, a golden share of the
// way apart, each a round basin with its quay and a neck to the fairway (the docks along the shores are the bake's)
const SMALL = { r: 0.09, quay: 0.03, neck: 0.035 };   // vision: km: a small cothon's radius (eighteen blocks), its quay, its neck's half width
export const smallCothons = (() => { const out = [], n = fairwayPath.length - THERA.strait.path.length + 1;
  for (const [k, t] of [[0, 1 / PHI ** 2], [1, 1 / PHI], [2, 1 - 1 / PHI ** 3]]) {   // vision: three, at golden shares of the fairway
    const f = t * (n - 1), i = Math.min(n - 2, Math.floor(f)), u = f - i, [ax, ay] = fairwayPath[i], [bx, by] = fairwayPath[i + 1], px = ax + (bx - ax) * u, py = ay + (by - ay) * u, d = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / d, ny = (bx - ax) / d, side = k % 2 ? 1 : -1;
    found: for (const sd of [side, -side]) for (let r = 0.1; r < 2.5; r += 0.01) { const x = px + nx * sd * r, y = py + ny * sd * r; if (theraMetres(x, y).m > 0) { const cx = x + nx * sd * (SMALL.r + SMALL.quay), cy = y + ny * sd * (SMALL.r + SMALL.quay); out.push({ x: cx, y: cy, to: { x: px, y: py } }); break found; } }   // vision: searched a hundredth of a km a step, out to two and a half, this side then the other
  }
  return out; })();
function segDist(x, y, P) {
  let best = Infinity;
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

// the summit, and the Light's islet (found on the ground, not placed)
const domeTop = theraMetres(...unwarp(D.x, D.y)).m / THERA.M;
let lightAt = null;
{   // the Light stands on the strait stack: find its top on the ground (the stack is drawn in the island's wandering plane)
  const K = THERA.stack;
  for (let x = K.x - 0.8; x <= K.x + 0.8; x += 0.01) for (let y = K.y - 0.8; y <= K.y + 0.8; y += 0.01) {   // vision: the search's reach and step (km)
    const t = theraMetres(x, y);
    if (t.what === "the strait stack" && (!lightAt || t.m > lightAt.m)) lightAt = { x, y, m: t.m };
  }
}

// the quarters' seeds: a golden spiral over the bay floor, each given a tradition in proportion to its trade
let seeds = null;
export function quarterSeeds() {
  if (seeds) return seeds;
  const P = peoples().list, trade = {};
  for (const p of P) trade[p.tradition] = (trade[p.tradition] ?? 0) + p.goods + p.capacity;
  const keys = Object.keys(TRADITIONS), total = keys.reduce((a, k) => a + (trade[k] ?? 0), 0);
  // a deck of traditions, each as often as its share, dealt in golden order so neighbours differ
  const deck = [];
  for (const k of keys) for (let i = 0; i < Math.max(2, Math.round(((trade[k] ?? 0) / total) * CITY.quarters.seeds)); i++) deck.push(k);   // vision: every people at least two quarters
  const dealt = deck.map((k, i) => [k, (i * GOLD) % 1]).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  seeds = [];
  let n = 0;
  for (let i = 0; seeds.length < dealt.length && i < dealt.length * 40; i++) {   // vision: a spiral long enough to find room
    const r = Math.sqrt((i + 0.5) / (dealt.length * 6)) * Math.max(B.a, B.b) * 1.15, th = i * GOLD;   // vision: the spiral's density
    const x = B.x + r * Math.cos(th), y = B.y + r * Math.sin(th);
    const t = theraMetres(...unwarp(x, y));
    if (t.m >= 0 || t.what !== "bay" || t.bay > CITY.rings.wall - 0.04) continue;   // vision: inside the wall canal
    if (t.dome < CITY.rings.inner[1] * 1.05) continue;   // vision: clear of the ring canal
    if (segDist(x, y, fairwayPath) < CITY.fairway.half * 3) continue;   // vision: clear of the fairway
    if (seeds.some((s) => Math.hypot(s.x - x, s.y - y) < 0.32)) continue;   // vision: quarters at least 320 m (32 blocks) apart
    seeds.push({ x, y, culture: dealt[n++] });
  }
  return seeds;
}

/** What the city is at a real point (km): { kind, culture?, h (blocks over the sea) }. */
export function cityAt(x0, y0) {
  const nat = theraMetres(x0, y0), h = nat.m / THERA.M, x = nat.x, y = nat.y;
  // the Light
  if (lightAt && Math.hypot(x0 - lightAt.x, y0 - lightAt.y) < CITY.light.r) return { kind: "the Light", h };
  // the cothon: a true circle in the real plane (the building, game/cothon.js, stands on it): its basin, the island,
  // the ring the shipsheds stand on with its slips, and the gap of its mouth toward the lagoon
  { const w = cothonWorld(), d = Math.hypot(x0 - w.x, y0 - w.y);
    if (d < C.round + C.sheds + C.quay) {
      const a = Math.atan2(y0 - w.y, x0 - w.x), off = Math.abs(Math.atan2(Math.sin(a - w.mouth), Math.cos(a - w.mouth))) * d;   // km along the ring from the mouth's middle
      if (d < C.island) return { kind: "harbour master's island", h: Math.max(h, 3) };   // vision: the island stands three blocks up
      if (d < C.round || off < C.neck[0]) return { kind: "round harbour", h: -6 };   // vision: six blocks deep, the mouth as deep
      if (d < C.round + C.sheds) { const n = C.piers, sh = ((a / (2 * Math.PI)) * n % 1 + 1) % 1; return Math.abs(sh - 0.5) * (2 * Math.PI * d / n) < C.pier ? { kind: "shipsheds", h: 2 } : { kind: "round harbour", h: Math.min(0, Math.round(-6 + 7 * (d - C.round) / C.sheds)) }; }   // vision: each slip a ramp, six under the water at its mouth up to the water's edge at its back (a ship hauled up it on rollers)   // derived: the slips, a pier between each (its bay's share from its middle, as a length round the ring); vision: the piers two up, the slips six deep
      return { kind: "quay", h: 2 }; } }   // the ring's back, under the sheds' outer wall
  for (const c of smallCothons) { const d = Math.hypot(x - c.x, y - c.y); if (d < SMALL.r) return { kind: "round harbour", h: -6 }; const L = Math.hypot(c.to.x - c.x, c.to.y - c.y), t = ((x - c.x) * (c.to.x - c.x) + (y - c.y) * (c.to.y - c.y)) / (L * L), off = Math.abs((x - c.x) * (c.to.y - c.y) - (y - c.y) * (c.to.x - c.x)) / L; if (t > 0 && t < 1 && off < SMALL.neck && h > -6) return { kind: "round harbour", h: -6 }; if (d < SMALL.r + SMALL.quay) return { kind: "quay", h: Math.max(2, h) }; }   // a small cothon: its basin, its neck to the fairway, its quay   // vision: the basin six blocks deep, as the round harbour's
  // the fairway
  const inBay = nat.what === "bay" || nat.what === "strait" || (nat.what === "Pre-Kameni" && h <= 0);
  if (inBay && segDist(x, y, fairwayPath) < CITY.fairway.half) return { kind: "fairway", h: Math.min(h, -5) };   // vision: dredged to five blocks
  // the inner city on the cone
  if (nat.what === "Pre-Kameni" && h > 0) {
    if (h > domeTop * CITY.acropolis) return { kind: "acropolis", h };
    const ang = Math.atan2(y - D.y, x - D.x);
    let rel = ang - axis; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (h > domeTop * CITY.library[0] && h < domeTop * CITY.library[1] && Math.abs(rel) < CITY.library[2]) return { kind: "the Library", h };
    const wob = (fbm(Math.cos(ang) * 2 + 3, Math.sin(ang) * 2 + 3, 97, 2) - 0.5) * 0.5;   // vision: the stairs wander
    const k = (ang / (2 * Math.PI)) * CITY.stairs.count + wob;
    const dist = Math.abs(k - Math.round(k)) * ((2 * Math.PI * Math.hypot(x - D.x, y - D.y)) / CITY.stairs.count);
    if (dist < CITY.stairs.half) return { kind: "stairs", h };
    const f = ((h % CITY.terrace) + CITY.terrace) % CITY.terrace / CITY.terrace;
    if (f < CITY.street) return { kind: "street", h };
    return { kind: "inner city", h, theran: true };
  }
  // the lagoon: open water but for the Therans' own waterways round the cone (the redesign scrapped the bay's
  // quarters and their canals: claude/thera-redesign.md); the island's outer slope is the peoples' (theraplan.js)
  if ((nat.what === "bay" || nat.what === "Pre-Kameni") && h < 0) {
    if (nat.dome > CITY.rings.inner[0] && nat.dome < CITY.rings.inner[1]) return { kind: "ring canal", h };   // round the cone's own lobed shore
    return { kind: "bay", h };
  }
  return { kind: h > 0 ? "land" : "sea", h };
}
export const CITY_PLACES = ({ quarters = true } = {}) => {
  const real = ([n, x, y]) => [n, ...unwarp(x, y)];
  const out = [["Round harbour", roundAt.x, roundAt.y], ["The Exchange", merchantAt.x, merchantAt.y - C.merchant[1] - 0.12], ["Acropolis", D.x, D.y],   // vision: the labels' offsets
    ["The Library", D.x + Math.cos(axis) * D.r * 0.32, D.y + Math.sin(axis) * D.r * 0.32 - 0.1]];   // vision
  const o = out.map(real);
  for (const t of towns()) o.push([t.name, t.x, t.y + t.radius + 0.12]);   // vision: the label above the town
  if (lightAt) o.push(["The Light", lightAt.x, lightAt.y + 0.15]);   // vision
  const named = new Set();
  if (!quarters) return o;
  const far = new Map();
  for (const s of quarterSeeds()) { const d = Math.hypot(s.x - roundAt.x, s.y - roundAt.y); if (!far.has(s.culture) || d > far.get(s.culture).d) far.set(s.culture, { s, d }); }
  for (const [k, { s }] of far) o.push(real([TRADITIONS[k].name, s.x, s.y]));   // each people named where its quarters reach farthest from the cothon
  return o;
};
export const geometry = () => ({ roundAt, merchantAt, axis, lightAt, fairwayPath, lagoonPath: fairwayPath.slice(0, fairwayPath.length - THERA.strait.path.length + 1), domeTop, fairwayHalf: CITY.fairway.half });
export { segDist };
