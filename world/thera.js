// Pure. Thera before the eruption: the natural island, from its geology, before anyone builds.
//
// Grounded in the current reconstruction (Karatson, Gertisser, Druitt, Nomikou et al., Scientific
// Reports 2018; Druitt & Francaviglia 1992): a ring island round a shallow, semi-closed caldera bay
// left by the Cape Riva eruption (about 22,000 years ago), the bay in the north only (the southern
// basin long since filled in), a continuous southern rim from Thera through Aspronisi to Therasia,
// perhaps a low, narrow strait to the north, the south-west closed; and in the middle of the bay a
// low lava dome island, Pre-Kameni (about 2.2-2.5 cubic km, growing since about 20,000 years ago).
// The older rock stands out of the young volcanics: the limestone massif of Profitis Ilias in the
// south-east (the island's highest, 567 m today), the Akrotiri volcanics along the south-west, the
// cones of the north (Peristeria, Megalo Vouno).
//
// The island is drawn as landforms, each where it is, each a smooth field, summed and then eroded:
//   shield     the young volcanic island: lobes of land whose slopes fall away to the sea
//   bay        the flooded caldera: steep walls, a shallow floor, a rim crest along the cliff top
//   strait     the low, narrow channel to the north-west sea
//   dome       Pre-Kameni: a low dome of black andesite, lobed where its lavas ran
//   massifs    Profitis Ilias and Mesa Vouno, the Akrotiri ridge, the northern cones
//   erosion    gullies running down from the heights, deeper where the land is higher; fine roughness
// Real coordinates are km from the middle of today's caldera (x east, y north), heights in metres.
// The game sees them through two scales (vision): THERA.KM blocks a km across, THERA.M metres a
// block upward (relief is exaggerated so Minecraft's blocks can show it).
import { fbm, ridged, smoothstep } from "../core/noise.js";
import { GIVEN, D } from "../core/given.js";

export const THERA = Object.freeze({
  name: "Thera",
  REACH: 144,               // derived: chunks from the middle that the island and its shelf can reach (the lens measures it)
  KM: 200,                  // vision: blocks a km (1:5): the island is about 3,400 blocks long, the crown jewel at twice its first size (the redesign, claude/thera-redesign.md)
  M: 4,                     // vision: metres a block upward (relief 2.5 times exaggerated: Profitis Ilias rises about 140 blocks)
  lat: 36.4,                // given: Thera's latitude (degrees north)
  seat: { cx: 1004, cz: 302 },   // derived: the centre of trade: of every open-water place at Thera's latitude where the whole island and its shelf fall on the map's sea, the one nearest every people (their distance weighted by what they hold; tools/theraseat.mjs)
  // ---- the shield: lobes of young volcanic land [x, y, a, b, turn (deg), height m] (vision: a reading of today's Thera and Therasia, with the southern basin filled)
  lobes: [
    [4.6, 0.6, 3.6, 8.2, -12, 300],     // vision: the long eastern crescent (Imerovigli to Pyrgos)
    [0.4, -5.2, 6.4, 3.0, 4, 220],      // vision: the south, the filled basin and the Akrotiri side
    [-5.1, 1.6, 2.0, 4.9, 6, 280],      // vision: Therasia, reaching south to the rim
    [0.3, 6.7, 3.9, 2.5, 14, 300],      // vision: the north, round Oia and Peristeria
    [-3.5, -2.7, 2.3, 1.5, -32, 170],   // vision: Aspronisi's ridge, the rim joining Therasia to the south
    [-0.9, -0.9, 3.0, 2.0, 0, 140],     // vision: the filled southern basin (today's southern caldera, land before the eruption)
  ],
  warp: 0.55,               // vision: km the landforms wander from their smooth shapes
  fray: 0.22,               // vision: km the coast frays at headland scale (capes and coves)
  shelf: 140,               // vision: metres deep at the shelf's foot
  shelfKm: 2.6,             // vision: km of shelf round the island
  bay: { x: -0.9, y: 3.2, a: 2.9, b: 3.4, floor: -30, rim: 70, wall: 0.16, scallops: 0.14 },   // vision: the flooded caldera (Cape Riva): centre, half-axes km, floor m, rim crest m, wall width (share)
  strait: { path: [[-2.5, 5.6], [-3.7, 7.1], [-4.4, 9.6]], half: 0.3, depth: -30 },   // vision: the mouth to the north-west, km (120 blocks wide: two great lanes and the light's islet); derived: 30 m, the great ships' 7 blocks and a half
  stack: { x: -3.3, y: 6.44, r: 0.12, top: 46, widen: 0.2 },   // vision: a lava-plug stack in mid-strait (km, m), and how much the strait widens round it (km)   // vision: the low narrow strait to the north-west, km; depth m
  dome: { x: -0.8, y: 2.7, r: 1.08, top: 230, lobes: 0.35 },   // vision: Pre-Kameni: centre, summit m, lobing (share of radius); derived: radius 1.75 km / phi, the least that holds the precinct on its plateau and the cothon on its flank (theramath.mjs)
  massifs: [                // [name, x, y, a, b, turn, height m, crags (share)]
    ["Profitis Ilias", 6.0, -5.0, 1.9, 1.15, 40, 567, 0.35],   // given: 567 m; vision: its shape
    ["Mesa Vouno", 6.9, -6.5, 0.7, 0.55, 30, 369, 0.3],        // given: 369 m
    ["Akrotiri ridge", -2.1, -5.7, 3.0, 0.95, 6, 220, 0.25],   // vision
    ["Megalo Vouno", 1.3, 5.6, 1.1, 1.0, 0, 330, 0.2],         // vision: the northern cones
    ["Peristeria", 2.4, 4.4, 1.0, 0.9, 0, 280, 0.2],           // vision
  ],
  gully: { depth: 34, across: 9, along: 0.9, rough: 9 },   // vision: m deep at the heights, gullies round the island, their length, fine roughness m
});

const RAD = Math.PI / 180;   // given
const rot = (dx, dy, deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [dx * c + dy * s, -dx * s + dy * c]; };
/** A smooth lobe: 1 at its centre, 0 at its edge, negative beyond (falls on smoothly). */
const lobe = (x, y, cx, cy, a, b, turn) => { const [p, q] = rot(x - cx, y - cy, turn); return 1 - (p / a) ** 2 - (q / b) ** 2; };
const smax = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (a - b)) / k)); return b + (a - b) * h + k * h * (1 - h); };   // given: the polynomial smooth maximum
function segDist(x, y, P) {
  let best = Infinity;
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** The island's own plane: every landform is drawn in this slightly warped copy of the real one. */
export function warp(x0, y0) {
  const T = THERA;
  const x = x0 + T.warp * (fbm(x0 * 0.45, y0 * 0.45, 11, 4) - 0.5) * 2 + T.fray * (fbm(x0 * 2.2, y0 * 2.2, 13, 4) - 0.5) * 2;   // vision: the warp's breadth and the fray's
  const y = y0 + T.warp * (fbm(x0 * 0.45, y0 * 0.45, 23, 4) - 0.5) * 2 + T.fray * (fbm(x0 * 2.2, y0 * 2.2, 29, 4) - 0.5) * 2;   // vision: as above
  return [x, y];
}
/** How far into the bay a point of the island's plane is: 0 at its middle, 1 at its (scalloped) wall. */
export function bayField(x, y) {
  const B = THERA.bay, bang = Math.atan2(y - B.y, x - B.x);
  const scallop = 1 + B.scallops * (fbm(Math.cos(bang) * 2.2 + 9, Math.sin(bang) * 2.2 + 9, 43, 3) - 0.5) * 2;   // vision: the collapse scars round the wall
  return Math.sqrt(Math.max(0, 1 - lobe(x, y, B.x, B.y, B.a, B.b, 0))) / scallop;
}
/** How far out from Pre-Kameni's middle a point of the island's plane is, in its own (lobed) radius. */
export function domeField(x, y) {
  const D = THERA.dome, ang = Math.atan2(y - D.y, x - D.x);
  const R = D.r * (1 + D.lobes * (fbm(Math.cos(ang) * 1.6 + 5, Math.sin(ang) * 1.6 + 5, 51, 3) - 0.5) * 2);   // vision: lobes round its edge
  return Math.hypot(x - D.x, y - D.y) / R;
}

/** Height in metres (negative: depth) at a real point (km, x east, y north), and what made it. */
export function theraMetres(x0, y0) {
  const T = THERA;
  // the wander: every landform sees a slightly warped plane, so nothing is a clean ellipse
  const [x, y] = warp(x0, y0);
  // the shield: the highest lobe here, smoothly joined to the rest
  let L = -Infinity, Hw = 0, Wsum = 0;
  for (const [cx, cy, a, b, turn, h] of T.lobes) {
    const l = lobe(x, y, cx, cy, a, b, turn);
    const w = Math.exp(l / 0.12);   // vision: how softly one lobe's height hands over to the next
    Hw += w * h; Wsum += w;
    L = smax(L === -Infinity ? l : L, l, 0.25);   // vision: how softly lobes merge
  }
  const H = Hw / Wsum;
  let m = L > 0 ? H * L ** 0.75 : -T.shelf * Math.min(1, (-L * Math.max(...T.lobes.map((o) => Math.max(o[2], o[3])))) / T.shelfKm) ** 0.7 - 2;   // vision: concave volcanic slopes; the shelf falls away
  let what = L > 0 ? "shield" : "sea";
  // the massifs: older rock standing out of the shield, with crags
  for (const [name, cx, cy, a, b, turn, h, crag] of T.massifs) {
    const l = lobe(x, y, cx, cy, a, b, turn);
    if (l <= -0.6) continue;   // vision: their foot reaches a little beyond their shape
    const rise = h * Math.max(0, (l + 0.6) / 1.6) ** 1.6 * (1 - crag + crag * ridged(x * 1.4, y * 1.4, 37, 4));   // vision: the massifs' profile
    if (rise > m) { m = smax(m, rise, 30); what = name; }   // vision: a soft join at their foot (m)
  }
  // the bay: the Cape Riva caldera, flooded, its walls steep, its rim crest along the cliff top
  const B = T.bay, d = bayField(x, y);   // 0 at the bay's middle, 1 at its wall
  const inside = smoothstep(1, 1 - B.wall, d);
  m += B.rim * Math.exp(-(((d - 1 - B.wall * 0.6) / (B.wall * 0.9)) ** 2)) * (m > 0 ? 1 : 0);   // vision: the crest just outside the wall
  if (inside > 0) { m = m * (1 - inside) + B.floor * inside; if (inside > 0.5) what = "bay"; }
  // the strait: a low, narrow channel through the north-west rim
  const K = T.stack, ds = Math.hypot(x - K.x, y - K.y);
  const half = T.strait.half + K.widen * smoothstep(1.2, 0.3, ds);   // vision: the widening's reach (km)
  const sd = segDist(x, y, T.strait.path), cut = smoothstep(half * 1.8, half, sd);   // vision: the strait's banks soften over this many half widths
  if (cut > 0) { m = m * (1 - cut) + Math.min(m, T.strait.depth) * cut; if (cut > 0.5) what = "strait"; }
  // the stack: a sheer plug of dark lava standing in the middle of the strait
  if (ds < K.r * 1.6) {   // vision: its skirt of fallen blocks
    const stack = ds < K.r ? K.top * (1 - (ds / K.r) ** 6) ** 0.5 : T.strait.depth * smoothstep(K.r * 1.6, K.r, ds) + m * smoothstep(K.r, K.r * 1.6, ds) * 0;   // vision: near-vertical sides
    if (stack > m) { m = stack; what = "the strait stack"; }
  }
  // Pre-Kameni: the dome, lobed where its lavas ran
  const D = T.dome, r = domeField(x, y);
  if (r < 1.25) {   // vision: its foot runs out under the bay
    const dome = B.floor + (D.top - B.floor) * Math.max(0, 1 - r * r) ** 1.3;   // vision: a low dome
    if (dome > m) { m = smax(m, dome, 12); what = "Pre-Kameni"; }   // vision: its foot's join (m)
  }
  // erosion: gullies down from the heights, running away from the caldera rim toward the sea
  if (m > 0 && what === "Pre-Kameni") m += T.gully.rough * 1.5 * (ridged(x * 5, y * 5, 81, 3) - 0.5);   // vision: blocky young lava, no gullies yet
  else if (m > 0) {
    const cx = T.bay.x, cy = T.bay.y, th = Math.atan2(y - cy, x - cx), rr = Math.hypot(x - cx, y - cy);   // the gullies drain outward from the caldera, as on any caldera island
    const g = ridged(th * T.gully.across, rr * T.gully.along, 61, 3) ** 3;   // vision: the gullies' noise (its salt, three octaves, three to the km)
    m -= T.gully.depth * g * smoothstep(15, 160, m);   // vision: gullies bite from 15 m up, fully from 160
    m += T.gully.rough * (fbm(x * 3, y * 3, 71, 3) - 0.5);   // vision: three to the km
  }
  return { m, what, x, y, bay: d, dome: r };
}

/** Height in blocks over the sea's level at a block (u east, v south, from the middle of the caldera). */
export function theraHeight(u, v) {
  const { m, what } = theraMetres(u / THERA.KM, -v / THERA.KM);
  return { h: m / THERA.M, what };
}
export const theraTop = (u, v) => GIVEN.SEA + Math.round(theraHeight(u, v).h);

/** Named places of the natural island (for maps and charts): [name, x km, y km]. */
export const PLACES = [
  ["The Bay", -1.2, 4.4], ["Pre-Kameni", -0.8, 2.7], ["The North Strait", -4.3, 8.3], ["Therasia", -5.3, 1.2],   // vision: where the labels sit
  ["Aspronisi ridge", -3.9, -2.4], ["Profitis Ilias", 6.0, -5.0], ["Mesa Vouno", 6.9, -6.5], ["Akrotiri ridge", -2.1, -5.7],   // vision: where the labels sit
  ["Megalo Vouno", 1.3, 5.6], ["Peristeria", 2.4, 4.4], ["The southern plain", 1.2, -3.0], ["East shore", 8.2, -1.0],   // vision: where the labels sit
  ["The caldera cliffs", 2.3, 2.0],   // vision
];

/**
 * Thera as the world's map sees it: a chunk's height (blocks), or null where the map's own sea (or land) stands.
 * The island and its shelf are laid into the map's sea, not cut out of it: past the shelf's foot the map's own
 * sea floor shows, and on the shelf the shallower of the two wins, so the shelf rises out of the map's sea
 * with no edge of its own.
 */
export function theraChunk(cx, cz, W, base = -Infinity) {
  let du = cx - THERA.seat.cx; if (du > W / 2) du -= W; if (du < -W / 2) du += W;
  const dv = cz - THERA.seat.cz, C = D.PX, R = Math.ceil((THERA.REACH * GIVEN.CHUNK) / C);   // derived: the reach in map cells
  if (Math.abs(du) > R || Math.abs(dv) > R) return null;
  const h = Math.round(theraHeight((du + 0.5) * C, (dv + 0.5) * C).h), foot = -THERA.shelf / THERA.M;
  if (h > 0) return h;   // the island
  if (h <= foot + 1) return null;   // past the shelf's foot: the map's own sea
  return Math.max(h, base);   // on the shelf: the shallower of the shelf and the map's sea floor
}
