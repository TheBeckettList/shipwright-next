// Pure. The chemistry a scale up: a building is an atom, a quarter a molecule of buildings round its well, a
// district a molecule of quarters round its temple, a city the districts round its hub. The laws are the rooms'
// own (world/periodic.js), read again at each scale, and a place's shape is its electron cloud: soft, never drawn.
//
//   the atom      a building's electronegativity is its rooms' (their area-weighted mean: a shop-house low, a
//                 house high, a pavilion zero: a noble); its valence its street doors; its radius its
//                 footprint's half-diagonal; it is reactive if it holds a fire or a stench (the forge, the oven,
//                 the tannery's vats, the latrine), as the alkali metals and the halogens are
//   the bond      between two buildings, Pauling's lines again: under 0.4 they may share a wall (a row, where the
//                 people builds rows), up to 1.7 a lane between, past it they stand apart (a yard's width); a
//                 reactive building stands apart from every house; a noble is the plaza the rest face. A window
//                 still wants its three blocks of air: no lane narrower
//   the bound     a place is bounded by its ground: the walk from its epicentre over what it can build on (not
//                 the sea, not a cliff, a block of climb costing a block) gives its rings, which bend round what
//                 blocks them. Its mass is its census's footprints; each ring keeps a least share of negative space
//                 (NEGATIVE: the streets and alleys at the core, the yards at the edge), and holds the mass a free
//                 disc of the same place would put there; where the ring is cut short, the mass it can't hold
//                 rises (the press, below)
//   the molecule  grown, not drawn. The core first (the quarter's well, the district's temple, the city's market);
//                 then the public buildings in order of electronegativity (trade and the halls at the core), then the
//                 town's homes and the work they keep mixed by a golden sequence, the reactive last, at the edge. Each goes where its energy is
//                 least: its pull to the core (weighted by how public it is), its bonds to the buildings beside
//                 it (a bond at its length lowers the energy by how alike the two are: like clusters with like),
//                 the ground (the slope's cost, the water's pull for the boats), and a little of the seed's noise.
//                 The places tried are each placed building's bond lengths round it at golden-angle turns: the
//                 molecule grows off its own surface, never on a grid
//   the cloud     the place's density is the sum of its buildings' orbitals, rho(p) = sum exp(-d^2 / 2 sigma^2),
//                 sigma a building's radius over phi (the cloud hugs its buildings, and merges where they crowd). The place is where rho passes 1/phi^3 (its isodensity
//                 surface, as a molecule's is drawn): a blob, lobed where its quarters are, thin where it runs
//                 along a shore. A wary people's wall follows a fainter contour, 1/phi^5, round it all
//   the lanes     desire lines: each building's door to the nearest lane already laid (or the core), round every
//                 footprint, the cheapest way; a lane is cheaper to walk again, so they gather into streets
//   the press     the cloud is densest at its core, so the core stands tallest; and the cloud wants its free shape (the
//                 disc its buildings would make on open ground): where the sea, a cliff or a river takes ground from it,
//                 more than the place's own usual (a port's half-disc is its usual), the lost cloud goes somewhere. Sideways first (the
//                 molecule grows round what it can't cross: a town strung along its shore, up its valley), and
//                 up: each building's pressure is the cloud's density there over the core's, times one and the
//                 share of the ground round it (a cloud's width) that's blocked. A house under pressure takes
//                 storeys (one for each 1/phi of pressure past 1/phi, three at most): so the seafront is the
//                 town's height, as a valley's floor is, and a town pushed between a river and a cliff rises most
//   the hill      on a slope a building stands at its door's height; a terracing people's rooms step up it
//                 (world/building.js split), the rest level on a footing
import { FIB, PHI } from "../core/golden.js";
import { hashAt } from "../core/noise.js";
import { TABLE, OPEN, IONIC, CLEAR } from "./periodic.js";
import { buildOf, censusOf, TYPES, terraces } from "./census.js";
import { PALETTE } from "./palette.js";
import { PINNACLE } from "./pinnacle.js";
import { STOREYS } from "./periodic.js";
import { growOf, cantVox, CLASS } from "./growth.js";
import { decorOf, wallOf, wildOf, cemeteryOf, gardenOf } from "./decor.js";
import { drawModule } from "./farms.js";

export const REACTIVE = new Set(["Fe", "P", "S", "Cl"]);   // the forge, the oven, the vats, the pit
export const ROWS = new Set(["european", "therans", "indian_ocean", "japanese"]);   // vision: the peoples that build in rows (a shared wall)
export const LANE = { european: FIB[3], therans: FIB[3], indian_ocean: FIB[3], east_asian: FIB[4], japanese: FIB[3], norse: FIB[4], dugout: FIB[5], birchbark: FIB[5], pacific: FIB[5], shallow: FIB[4], arctic: FIB[5] };   // vision: the lane between buildings, by how close the people builds
export const RHO = { place: 1 / PHI ** 3, wall: 1 / PHI ** 5 };   // derived: the isodensity of the place, and the fainter one its wall keeps to
const STREET = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // the street side after k quarter turns
export const QUARTER = FIB[6];   // derived: thirteen households a quarter (its well, its shrine)
const SURFACE = { european: "minecraft:cobblestone", therans: "minecraft:polished_tuff", indian_ocean: "minecraft:smooth_sandstone", east_asian: "minecraft:stone_bricks", japanese: "minecraft:coarse_dirt", norse: "minecraft:grass_path", dugout: "minecraft:grass_path", birchbark: "minecraft:grass_path", pacific: "minecraft:grass_path", shallow: "minecraft:bamboo_planks", arctic: "minecraft:packed_ice" };   // vision: each people's lanes
const ARTERY = { european: "minecraft:stone_bricks", therans: "minecraft:tuff_bricks", indian_ocean: "minecraft:sandstone", east_asian: "minecraft:polished_andesite", japanese: "minecraft:gravel", norse: "minecraft:cobblestone", dugout: "minecraft:coarse_dirt", birchbark: "minecraft:coarse_dirt", pacific: "minecraft:coarse_dirt", shallow: "minecraft:bamboo_planks", arctic: "minecraft:packed_ice" };   // vision: each people's high street, quay and squares
const PATH = { european: "minecraft:gravel", therans: "minecraft:calcite", indian_ocean: "minecraft:sand", east_asian: "minecraft:gravel", japanese: "minecraft:grass_path", norse: "minecraft:grass_path", dugout: "minecraft:grass_path", birchbark: "minecraft:grass_path", pacific: "minecraft:grass_path", shallow: "minecraft:bamboo_planks", arctic: "minecraft:snow" };   // vision: each people's paths and lanes
const WALL = { european: "minecraft:stone_bricks", therans: "minecraft:white_concrete", indian_ocean: "minecraft:sandstone", east_asian: "minecraft:mud_bricks", japanese: "minecraft:stone_bricks", norse: "minecraft:spruce_log", dugout: "minecraft:spruce_log", birchbark: "minecraft:birch_log", pacific: "minecraft:bamboo_block", shallow: "minecraft:bamboo_block", arctic: "minecraft:packed_ice" };   // vision: each people's town wall (stone, or a palisade of logs)

// ---- the atom
const bbox = (vox) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const k of vox.keys()) { const [x, y, z] = k.split(",").map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, z0, z1, y0, y1 }; };
export function atomOf(b) {
  const rooms = (b.formula ?? []).filter((s) => s !== "B" && s !== "Be" && s !== "H"), area = (s) => TABLE[s].side ** 2;
  const noble = rooms.length === 1 && TABLE[rooms[0]].noble;
  const chi = noble ? 0 : rooms.reduce((a, s) => a + (TABLE[s].noble ? 0 : TABLE[s].chi) * area(s), 0) / Math.max(1, rooms.reduce((a, s) => a + area(s), 0));
  const B = bbox(b.vox), w = B.x1 - B.x0 + 1, l = B.z1 - B.z0 + 1;
  return { chi, noble, reactive: rooms.some((s) => REACTIVE.has(s)), home: b.kind === "home", valence: 1 + rooms.filter((s) => TABLE[s].metal && !TABLE[s].noble).length, w, l, r: Math.hypot(w, l) / 2, box: B };
}
/** The bond between two buildings: { join: "row" | "lane" | "apart" | "plaza", gap }. */
export function bondOf(a, b, t) {
  if (a.noble || b.noble) return { join: "plaza", gap: LANE[t] ?? FIB[3] };   // vision: the place's own measure (its lanes, gaps and turns)
  if ((a.reactive && b.home) || (b.reactive && a.home)) return { join: "apart", gap: FIB[4] + (LANE[t] ?? FIB[3]) };   // derived: a yard of five past the lane
  const d = Math.abs(a.chi - b.chi);
  if (d < OPEN && ROWS.has(t) && a.home === b.home) return { join: "row", gap: 1 };   // a shared wall's width (the eaves' drip between)
  return d <= IONIC ? { join: "lane", gap: Math.max(CLEAR, LANE[t] ?? FIB[3]) } : { join: "apart", gap: FIB[4] + (LANE[t] ?? FIB[3]) };   // vision: the place's own measure (its lanes, gaps and turns)
}

// ---- turning a building (a quarter turn at a time: x,z -> -z,x), its blocks' facings with it
const CARD = ["east", "south", "west", "north"], WEIRDO = [0, 3, 1, 2], FACE = { 5: 0, 3: 1, 4: 2, 2: 3 }, FACE_OF = [5, 3, 4, 2];   // given: Bedrock's facings, east south west north in turn
function turnState(s, k, id) {
  if (!s || !k) return s; const o = { ...s };
  if (o["minecraft:cardinal_direction"]) o["minecraft:cardinal_direction"] = CARD[(CARD.indexOf(o["minecraft:cardinal_direction"]) + k) % 4];   // given: the four quarter turns and Bedrock's facings
  if (o.weirdo_direction != null) { const i = WEIRDO.indexOf(o.weirdo_direction); o.weirdo_direction = WEIRDO[(i + k) % 4]; }   // given: the four quarter turns and Bedrock's facings
  if (o.facing_direction != null && FACE[o.facing_direction] != null) o.facing_direction = FACE_OF[(FACE[o.facing_direction] + k) % 4];   // given: the four quarter turns and Bedrock's facings
  if (o.direction != null) o.direction = /trapdoor/.test(id) ? WEIRDO[(WEIRDO.indexOf(o.direction) + k) % 4] : (o.direction + k) % 4;   // a door's and a pot's turn in step; a trapdoor's as a stair's   // given: the four quarter turns and Bedrock's facings
  if (o.pillar_axis && k % 2) o.pillar_axis = o.pillar_axis === "x" ? "z" : o.pillar_axis === "z" ? "x" : o.pillar_axis;
  return o;
}
export function turn(vox, k) {
  k = ((k % 4) + 4) % 4; if (!k) return vox; const out = new Map();   // given: the four quarter turns and Bedrock's facings
  for (const [key, b] of vox) { let [x, y, z] = key.split(",").map(Number); for (let i = 0; i < k; i++) [x, z] = [-z, x]; out.set(`${x},${y},${z}`, { id: b.id, s: turnState(b.s, k, b.id) }); }
  return out;
}

// ---- the molecule
/**
 * A quarter (or a hamlet): its buildings grown round a core. items: [{ id, seed }]; ground: { h(x, z), water(x, z) };
 * returns { placed: [{ id, b, atom, x, z, y, k }], rho(x, z), core }.
 */
export function growQuarter(items, t, { seed = 0, ground = null, coreId = "well", water = null, slope = null } = {}) {
  const built = items.map((it, i) => { const b = buildOf(it.id, t, it.seed ?? seed + i, null, { slope }); return { ...it, b, atom: atomOf(b) }; });
  let core = built.find((q) => q.id === coreId) ?? built.find((q) => q.atom.noble) ?? built[0];
  const rest = built.filter((q) => q !== core).sort((a, b) => (a.atom.reactive - b.atom.reactive) || a.atom.chi - b.atom.chi || b.atom.r - a.atom.r);
  const placed = [{ ...core, x: 0, z: 0, k: 0 }];
  const sigma = (a) => a.r * PHI;
  const rho = (x, z) => placed.reduce((s, p) => s + Math.exp(-((x - p.x) ** 2 + (z - p.z) ** 2) / (2 * sigma(p.atom) ** 2)), 0);
  const fits = (q, x, z, k) => { const w = k % 2 ? q.atom.l : q.atom.w, l = k % 2 ? q.atom.w : q.atom.l; for (const p of placed) { const pw = p.k % 2 ? p.atom.l : p.atom.w, pl = p.k % 2 ? p.atom.w : p.atom.l, g = bondOf(q.atom, p.atom, t).gap; if (Math.abs(x - p.x) * 2 < w + pw + 2 * g && Math.abs(z - p.z) * 2 < l + pl + 2 * g) return false; } if (water && water(x, z) && q.id !== "boathouse") return false; return true; };
  let n = 0;
  for (const q of rest) {
    let best = null;
    for (const p of placed) {
      const g = bondOf(q.atom, p.atom, t), d = q.atom.r + p.atom.r + g.gap;
      for (let j = 0; j < FIB[5]; j++) {   // vision: the place's own measure (its lanes, gaps and turns)
        const a = (n + j) * (Math.PI * (3 - Math.sqrt(5))) + hashAt(p.x, p.z, seed) * Math.PI * 2, x = Math.round(p.x + Math.cos(a) * d), z = Math.round(p.z + Math.sin(a) * d);   // derived: eight golden-angle turns round each placed building at the bond's length
        const k = ((Math.round((Math.atan2(-z, -x) + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;   // its street side (-z, turned k quarters) toward the core   // given: the four quarter turns and Bedrock's facings
        if (!fits(q, x, z, k)) continue;
        const pull = Math.hypot(x, z) * (IONIC + OPEN - Math.min(IONIC, q.atom.chi - (q.atom.noble ? 0 : 1))) / IONIC * (q.atom.reactive ? -1 / PHI : 1);   // the public pulled in, the private less, the reactive pushed out
        let bond = 0; for (const o of around(x, z, q.atom.r + span + GAP + FIB[4])) { const dd = Math.hypot(x - o.x, z - o.z), b0 = q.atom.r + o.atom.r + bondOf(q.atom, o.atom, t).gap, like = 1 - Math.min(IONIC, Math.abs(q.atom.chi - o.atom.chi)) / IONIC; bond -= Math.exp(-(((dd - b0) / FIB[3]) ** 2)) * like * FIB[3]; }   // derived: a bond's well three blocks wide, three deep
        const hill = ground ? Math.abs(ground.h(x + 1, z) - ground.h(x - 1, z)) + Math.abs(ground.h(x, z + 1) - ground.h(x, z - 1)) : 0;
        const wet = water && q.id === "boathouse" ? (water(x, z) ? -FIB[6] : FIB[5]) : 0;   // the boathouse to the water's edge   // vision: the place's own measure (its lanes, gaps and turns)
        const E = pull + bond + hill * FIB[3] + wet + hashAt(x, z, seed + 1) * FIB[3];   // derived: the slope costs three a block of rise; the seed's noise up to three
        if (!best || E < best.E) best = { x, z, k, E };
      }
    }
    if (!best) { const a = n * (Math.PI * (3 - Math.sqrt(5))), R = Math.sqrt(n + 1) * FIB[5]; best = { x: Math.round(Math.cos(a) * R), z: Math.round(Math.sin(a) * R), k: 0 }; }   // derived: nowhere bonds: Vogel's spiral, eight to the step
    if (slope && terraces(t, q.seed ?? 0, slope) && best.k) { let [ux, uz] = slope.dir; for (let i = 0; i < best.k; i++) [ux, uz] = [uz, -ux]; const b = buildOf(q.id, t, q.seed ?? 0, null, { slope: { ...slope, dir: [ux, uz] } }); q.b = b; q.atom = atomOf(b); }   // a terracing building rebuilt with the hill in its own frame
    placed.push({ ...q, ...best }); n++;
  }
  return { placed, rho, core: placed[0] };
}

/** A min-heap of [cost, ...] (the walk's search). */
function heap() { const a = []; return { push(v) { a.push(v); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }, pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }, get size() { return a.length; } }; }

export const STILTED = new Set(["shallow", "pacific"]);   // vision: the peoples that build out over the shallows on posts
export const BRIDGE = FIB[6];   // derived: a street bridges water thirteen blocks across at most
export const SHAPES = [[PHI, "disc"], [PHI ** 3, "lobe"], [Infinity, "strip"]];   // derived: the ground's shape by its matrix's eigenvalue ratio: under phi a disc, under phi^3 a lobe, past it a strip
/** The shape of a set of cells: its second-moment matrix [[a, b], [b, c]], eigenvalues, axes, and its primitive. */
export function shapeOf(cells) {
  const n = cells.length || 1; let mx = 0, mz = 0; for (const [x, z] of cells) { mx += x; mz += z; } mx /= n; mz /= n;
  let a = 0, b = 0, c = 0; for (const [x, z] of cells) { a += (x - mx) ** 2; b += (x - mx) * (z - mz); c += (z - mz) ** 2; } a /= n; b /= n; c /= n;
  const tr = a + c, det = a * c - b * b, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l1 = tr / 2 + disc, l2 = Math.max(1e-9, tr / 2 - disc);   // the matrix's eigenvalues (its trace and determinant)   // vision: the place's own measure (its lanes, gaps and turns)
  const ang = Math.atan2(l1 - a, b || 1e-9), ratio = l1 / l2;   // the major axis (the eigenvector of the larger)   // vision: the place's own measure (its lanes, gaps and turns)
  return { M: [[a, b], [b, c]], l1, l2, ratio, axis: [Math.cos(ang), Math.sin(ang)], centre: [mx, mz], primitive: SHAPES.find(([r]) => ratio < r)[1] };
}
export const NEGATIVE = { core: 1 / PHI ** 4, edge: 1 / PHI };   // derived: the least open ground a ring keeps (its streets, alleys and plaza): a seventh at a town's core, three fifths at the edge (its yards and gardens)
export const RING = FIB[5];   // derived: a ring eight blocks of walk wide (a building's depth and its lane)
/**
 * A whole place, bounded by its ground. Its mass is its census's footprints (the rooms' stoichiometry on the ground);
 * its rings are the walk from its epicentre over the ground it can build on (so they bend round the sea, the cliff,
 * the river: the contorted shape); each ring keeps its share of negative space, and the mass a ring can't hold
 * where the ground is taken rises (the press). The buildings fill the rings by their electronegativity, the least
 * private nearest, each where its bonds' energy is least.
 */
export function placeOf(place, opts = {}) {
  if (opts.grow !== false) return growOf(place, opts);   // the crystal (world/growth.js); the rings below are the older way, kept for comparison
  let pl = place1(place, opts, 0);
  for (let boost = 1; pl.dropped > 0 && boost <= FIB[2]; boost++) { const next = place1(place, opts, boost); if (next.dropped >= pl.dropped) break; pl = next; }   // what the ground can't hold presses the place higher: again, a storey more in every pressed ring (twice at most)
  return pl;
}
function place1(place, { seed = 0, ground = { h: () => 0 }, water = null, slope = null, blocked = null } = {}, boost = 0) {
  const c = censusOf(place), t = place.t, H = (x, z) => ground.h(x, z), wet = water ?? (() => false), shallows = (x, z) => STILTED.has(t) && wet(x, z) && -H(x, z) <= FIB[3], stop = (x, z) => (blocked ?? wet)(x, z) && !shallows(x, z);   // derived: the stilt peoples build over water three deep at most; the walk crosses other water at five a block (a bridge's cost), but nothing is built on it
  const items = []; const homes = c.list.filter((q) => TYPES[q.id].kind === "home").reduce((a, q) => a + q.n, 0);
  for (const { id, n } of c.list) for (let i = 0; i < n; i++) items.push({ id, seed: seed + items.length * FIB[5] });   // vision: the place's own measure (its lanes, gaps and turns)
  const nq = Math.max(1, Math.round(c.households / QUARTER));
  for (let i = 1; i < nq; i++) items.push({ id: "well", seed: seed + i }, { id: "kiosk", seed: seed + i * FIB[3] });   // a well and a shrine to each quarter (the census gave the first)   // vision: the place's own measure (its lanes, gaps and turns)
  const dense = c.level >= FIB[3], cache = new Map(), make = (id, sd, up = 0, size = null) => { const k = `${id}|${sd}|${up}|${size}`; if (!cache.has(k)) cache.set(k, buildOf(id, t, sd, size, { slope, up, dense })); return cache.get(k); };   // derived: a town (level three) keeps no yards but the farm's and the big house's
  const upCap = Math.max(0, (PINNACLE[t]?.storeys ?? 1) - (STOREYS[t] ?? 1)), pressed = c.level >= 2;   // a people rises no higher than its pinnacle; a one-storey people's press goes into the size of its houses; a hamlet isn't pressed
  const built = items.map((it) => { const b = make(it.id, it.seed); return { ...it, b, atom: atomOf(b) }; });
  const coreItem = built.find((q) => q.id === "market") ?? built.find((q) => q.id === "well") ?? built[0];
  const M = built.reduce((a, q) => a + q.atom.w * q.atom.l, 0), nuMean = (NEGATIVE.core + NEGATIVE.edge) / 2;
  const Rfree = Math.sqrt(M / (2 * (1 - nuMean))), Kfree = Math.max(1, Math.ceil(Rfree / RING)), R = Math.ceil(Rfree * PHI ** 2) + FIB[6];   // derived: the free place's radius in the walk's own measure (a walk of four ways: its ball a square of area 2 r^2), and the search a golden square past it
  // the walk: from the epicentre over the ground it can build on (a step a block: the hill's cost is the placing's, so the rings measure only the ground taken)
  const N = 2 * R + 1, I = (x, z) => (z + R) * N + (x + R), D = new Float64Array(N * N).fill(Infinity), hp = heap();
  D[I(0, 0)] = 0; hp.push([0, 0, 0]);
  while (hp.size) { const [d, x, z] = hp.pop(); if (d > D[I(x, z)]) continue; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Z = z + b; if (Math.abs(X) > R || Math.abs(Z) > R || (stop(X, Z) && !wet(X, Z))) continue; const nd = d + (shallows(X, Z) ? PHI : wet(X, Z) ? FIB[4] : 1); if (nd < D[I(X, Z)]) { D[I(X, Z)] = nd; hp.push([nd, X, Z]); } } }   // vision: the place's own measure (its lanes, gaps and turns)
  const dAt = (x, z) => (Math.abs(x) > R || Math.abs(z) > R ? Infinity : D[I(x, z)]);
  // the shape: the matrix of the ground the free place would take (the walk within its radius times phi), its eigenvalues
  // its primitive; the spines (the main streets) run out along its axes, meandering by the seed, bridging narrow water
  const near = []; for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) if (D[I(x, z)] <= Rfree * PHI) near.push([x, z]);
  const shape = shapeOf(near), [ux, uz] = shape.axis, reach = Rfree * PHI;
  const dirs = shape.primitive === "disc" ? Array.from({ length: FIB[4] }, (_, i) => { const a = Math.atan2(uz, ux) + i * (2 * Math.PI / FIB[4]); return [Math.cos(a), Math.sin(a)]; }) : shape.primitive === "lobe" ? [[ux, uz], [-ux, -uz], [-uz, ux], [uz, -ux]] : [[ux, uz], [-ux, -uz]];   // derived: a disc five spokes, a lobe its two axes both ways, a strip its spine
  const spine = new Set(), bridges = new Set();
  dirs.forEach(([dx, dz], si) => {
    let x = 0, z = 0, a = Math.atan2(dz, dx), wetRun = []; const len = shape.primitive === "lobe" && si >= 2 ? reach / PHI : reach;   // derived: the lobe's cross streets a golden part of its spine
    for (let s = 0; s < len; s++) {
      a += (hashAt(Math.round(x), Math.round(z), seed + si) - 0.5) / FIB[4]; x += Math.cos(a); z += Math.sin(a);   // derived: the street meanders, a fifth of a radian a block at most
      const X = Math.round(x), Z = Math.round(z);
      if (wet(X, Z) && !shallows(X, Z)) { wetRun.push([X, Z]); if (wetRun.length > BRIDGE) break; continue; }
      if (!isFinite(dAt(X, Z))) break;
      if (wetRun.length) { for (const q of wetRun) bridges.add(q.join(",")); wetRun = []; }   // land again past the water: the run a bridge
      for (const [p, q] of [[0, 0], [1, 0], [0, 1], [1, 1]]) spine.add(`${X + p},${Z + q}`);   // derived: the main street two wide
    }
  });
  // the rings: their ground, their open share, the free disc's mass in each, the press
  const cells = []; for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) { const d = D[I(x, z)]; if (!isFinite(d) || (wet(x, z) && !shallows(x, z))) continue; const k = Math.floor(d / RING); (cells[k] ??= []).push([x, z]); }
  // the press: the cloud is densest at its core, so the core stands tallest (its height a golden fall outward); and where the
  // ground is squeezed tighter than the place's own usual openness (a ring cut by a river and a cliff, a valley's neck, the
  // strip between the hill and the sea), the squeeze lifts it more. A port's half-disc is its usual, not a squeeze
  const flat = (k) => 2 * (2 * k + 1) * RING * RING, open = cells.map((cs, k) => (cs?.length ?? 0) / flat(k));   // the walk's ring on open ground: a square annulus
  const opens = open.slice(0, Kfree).filter((v) => v > 0).sort((a, b) => a - b), usual = opens.length ? opens[Math.floor(opens.length / 2)] : 1;
  const rings = cells.map((cs, k) => {
    const nu = NEGATIVE.edge - (NEGATIVE.edge - NEGATIVE.core) * Math.exp(-k / Math.max(1, Kfree / PHI));   // the open share grows outward (the core's streets, the edge's gardens)
    const free = k < Kfree ? (M * ((k + 1) ** 2 - k ** 2)) / Kfree ** 2 : 0, room = (cs?.length ?? 0) * (1 - nu);
    const squeeze = open[k] > 0 ? usual / open[k] : Infinity, core = Math.exp(-k / Math.max(1, Kfree / PHI ** 2)), pressure = k < Kfree ? squeeze * (1 + core) : 0;   // derived: the core's rise falls off over 1/phi^2 of the place's rings (its heart, round the public buildings)
    const up0 = Math.max(0, Math.floor((pressure - 1) * PHI)); return { k, cells: cs ?? [], nu, free, room, open: open[k], squeeze, pressure, up: Math.min(FIB[3], up0 + (up0 || pressure > 1 / PHI ? boost : 0)), used: 0 };   // derived: a storey for each 1/phi of pressure past one, three at most
  });
  // the fill: the core at the epicentre, then by electronegativity (wells among their homes), the reactive last
  // the public buildings first, by electronegativity (the market, the hall, the temple, the inn round the core); then the town
  // itself, its homes and the work and stores they keep mixed by a golden sequence (a crafter's shop by its houses, not
  // a ring of workshops round the square); the reactive last, at the edge; the boathouses to the water when it comes
  const PUBLIC = new Set(["trade", "civic", "faith", "guard"]), LOCAL = new Set(["latrine", "washhouse", "well", "kiosk", "shrine", "lookout", "gatehouse"]), pub = (q) => PUBLIC.has(TYPES[q.id]?.kind) && !LOCAL.has(q.id) && !q.atom.reactive;   // the neighbourhood's own (its latrine, its wash house, its shrine) stay with the neighbourhood
  const others = built.filter((q) => q !== coreItem), pubs = others.filter(pub).sort((a, b) => a.atom.chi - b.atom.chi), tail = others.filter((q) => q.atom.reactive || q.id === "boathouse");
  const mixed = others.filter((q) => !pub(q) && !tail.includes(q)).map((q, i) => ({ q, mix: (i * PHI) % 1 })).sort((a, b) => a.mix - b.mix).map((e) => e.q);
  const order = [...pubs.slice(0, FIB[3])], restPub = pubs.slice(FIB[3]);   // derived: the three most public round the core (the market, the hall, the temple); the rest among the town
  const spread = Math.max(1, Math.round(mixed.length / Math.max(1, restPub.length)));
  mixed.forEach((q, i) => { order.push(q); if ((i + 1) % spread === 0 && restPub.length) order.push(restPub.shift()); });   // the other public buildings spread evenly through the town
  order.push(...restPub, ...tail.sort((a, b) => (a.id === "boathouse") - (b.id === "boathouse") || a.atom.chi - b.atom.chi));
  const wells = order.filter((q) => (q.id === "well" || q.id === "kiosk")), rest = order.filter((q) => !wells.includes(q)), seq = [];
  const every = Math.max(1, Math.round(rest.length / (wells.length / 2 + 1)));
  rest.forEach((q, i) => { seq.push(q); if ((i + 1) % every === 0 && wells.length) seq.push(...wells.splice(0, 2)); }); seq.push(...wells);   // a quarter's well and shrine after each quarter's buildings
  const placed = [], dims = (q, k) => (k % 2 ? [q.atom.l, q.atom.w] : [q.atom.w, q.atom.l]);
  // a grid over the placed (a cell of 34 blocks), so a building asks only its neighbours: the fill stays near-linear in a city's size
  const CELL = FIB[8], grid = new Map(), cellOf = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`; let span = 0;   // derived: thirty-four blocks a cell
  const add = (q) => { placed.push(q); const k = cellOf(q.x, q.z); (grid.get(k) ?? grid.set(k, []).get(k)).push(q); span = Math.max(span, q.atom.r); };
  const around = (x, z, r) => { const out = [], n = Math.ceil(r / CELL); const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (const q of grid.get(`${cx + a},${cz + b}`) ?? []) out.push(q); return out; };
  add({ ...coreItem, x: 0, z: 0, k: 0, ring: 0 });
  const GAP = FIB[4] + FIB[5];   // derived: the widest gap a bond asks (apart: a yard of five past the widest lane)
  const fits = (q, x, z, k) => { const [w, l] = dims(q, k); for (const p of around(x, z, q.atom.r + span + GAP)) { const [pw, pl] = dims(p, p.k), g = bondOf(q.atom, p.atom, t).gap; if (Math.abs(x - p.x) * 2 < w + pw + 2 * g && Math.abs(z - p.z) * 2 < l + pl + 2 * g) return false; } for (const [a, b] of [[0, 0], [-w / 2, -l / 2], [w / 2, -l / 2], [-w / 2, l / 2], [w / 2, l / 2]]) { const X = Math.round(x + a), Z = Math.round(z + b); if (q.id !== "boathouse" && (!isFinite(dAt(X, Z)) || (wet(X, Z) && !shallows(X, Z)))) return false; } for (let X = Math.round(x - w / 2) - 1; X <= Math.round(x + w / 2) + 1; X++) for (let Z = Math.round(z - l / 2) - 1; Z <= Math.round(z + l / 2) + 1; Z++) if (spine.has(`${X},${Z}`) || bridges.has(`${X},${Z}`)) return false; return true; };   // nothing on the main streets
  const toward = (x, z) => { let best = 0, bd = Infinity; [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([a, b], k) => { const d = dAt(x + a * FIB[3], z + b * FIB[3]); if (d < bd) { bd = d; best = k; } }); return best; };   // the street side down the walk, toward the epicentre   // vision: the place's own measure (its lanes, gaps and turns)
  let ringAt = { home: 0, other: 0 }, j = 0;
  for (const q0 of seq) {
    let q = q0, done = null;
    const lane = q.atom.home ? "home" : "other";
    for (let pass = 0; pass < 2 && !done; pass++) for (let k = pass ? 0 : ringAt[lane]; k < rings.length && !done; k++) {   // a second pass, finer, over every ring, for what the first left over
      const ring = rings[k]; if (!ring.cells.length) continue;
      if (pressed && q.atom.home && (q.up ?? 0) !== ring.up) { if (!ring.up) q = q0; else { const up = Math.min(ring.up, upCap), b = make(q.id, q.seed, up, up ? null : 2); q = { ...q0, b, atom: atomOf(b), up: ring.up, storeysUp: up }; } }   // the press: this ring's houses rise (or, where the people can't, grow)
      const cap = ring.cells.length * (1 - ring.nu), area = (q.atom.w * q.atom.l) / Math.max(1, Math.min(q.atom.w, q.atom.l) / RING);   // a building deeper than a ring shares its mass among the rings it spans
      if (ring.used >= cap * (1 - 1 / PHI ** 2) && k === ringAt[lane]) ringAt[lane] = k + 1;   // derived: a ring past 1 - 1/phi^2 full is passed by those after
      if (!pass && ring.used + area > cap && k < rings.length - 1) continue;
      let best = null; const step = pass ? FIB[3] : Math.max(1, Math.floor(ring.cells.length / FIB[9])), off = Math.floor(((j * PHI) % 1) * ring.cells.length);   // derived: fifty-five places tried round the ring, from a golden offset
      for (let s = 0; s < ring.cells.length; s += step) {
        const [x, z] = ring.cells[(off + s) % ring.cells.length];
        let kk = toward(x, z);
        if (q.id === "boathouse") { const wd = [[1, 0], [0, 1], [-1, 0], [0, -1]].findIndex(([a, b]) => wet(x + a * FIB[4], z + b * FIB[4])); if (wd < 0) continue; kk = wd; }   // its open end (+x) to the water   // vision: the place's own measure (its lanes, gaps and turns)
        if (!fits(q, x, z, kk)) continue;
        let bond = 0; for (const o of placed) { const dd = Math.hypot(x - o.x, z - o.z), b0 = q.atom.r + o.atom.r + bondOf(q.atom, o.atom, t).gap, like = 1 - Math.min(IONIC, Math.abs(q.atom.chi - o.atom.chi)) / IONIC; bond -= Math.exp(-(((dd - b0) / FIB[3]) ** 2)) * like * FIB[3]; }   // derived: a bond's well three blocks wide, three deep
        const hill = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1));
        const E = bond + hill * FIB[3] + hashAt(x, z, seed + j) * FIB[3] + (q.atom.reactive ? -dAt(x, z) / RING : 0);   // derived: a block of slope costs three; the seed's noise up to three; the reactive drawn outward
        if (!best || E < best.E) best = { x, z, k: kk, E };
      }
      if (best) { done = { ...q, ...best, ring: k }; ring.used += area; }
    }
    if (done) add(done); j++;
  }
  const sigma = (a) => a.r / PHI, rho = (x, z) => placed.reduce((s2, p) => s2 + Math.exp(-((x - p.x) ** 2 + (z - p.z) ** 2) / (2 * sigma(p.atom) ** 2)), 0);
  return { census: c, placed, rho, shape, spine, bridges, stilted: STILTED.has(t), rings: rings.map(({ cells: cs, ...r }) => ({ ...r, area: cs.length })), walk: dAt, mass: M, dropped: seq.length + 1 - placed.length, quarters: Array.from({ length: nq }, (_, i) => ({ i })) };
}

// ---- laying it out: the ground, the buildings at their heights, the lanes, the wall
/** A place's blocks on its ground: { vox, plan } (plan: a top-down grid for the map). */
export function layPlace(pl, t, { ground = { h: () => 0 }, water = null, wall = false, margin = FIB[6], roads = [] } = {}) {   // vision: the place's own measure (its lanes, gaps and turns)
  const vox = new Map(), foot = new Set(), doors = [];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pl.placed) { const r = Math.ceil(p.atom.r) + 2; x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r); z0 = Math.min(z0, p.z - r); z1 = Math.max(z1, p.z + r); }
  for (const f of pl.farms ?? []) for (const [x, z] of f.cells) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }   // the fields round the town in its bounds
  x0 = Math.floor(x0 - margin); x1 = Math.ceil(x1 + margin); z0 = Math.floor(z0 - margin); z1 = Math.ceil(z1 + margin);
  const H = (x, z) => Math.round(ground.h(x, z));
  // the ground: grass over dirt, sand at the water, the sea
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const h = H(x, z), wet = water && water(x, z); if (wet) { vox.set(`${x},0,${z}`, { id: "minecraft:water", s: null }); if (h >= -FIB[3]) vox.set(`${x},${h},${z}`, { id: "minecraft:sand", s: null }); continue; } for (let y = h - FIB[2]; y <= h; y++) vox.set(`${x},${y},${z}`, { id: y === h ? (t === "arctic" ? "minecraft:snow" : "minecraft:grass_block") : "minecraft:dirt", s: null }); }   // derived: the ground's skin (its top three blocks) and the water's face: the place needs no more of the world under it
  // each building: turned, centred on its place, standing at its door's ground (the street side), its footing to the ground
  for (const p of pl.placed) {
    const v = p.a ? cantVox(turn(p.b.vox, p.k), p.a) : turn(p.b.vox, p.k), B = bbox(v), cx = Math.round((B.x0 + B.x1) / 2), cz = Math.round((B.z0 + B.z1) / 2), dx = Math.round(p.x) - cx, dz = Math.round(p.z) - cz;
    const [sx, sz] = STREET[p.k], depth = (p.k % 2 ? p.atom.w : p.atom.l) / 2 + 1, door = p.door ? { x: Math.round(p.door[0]), z: Math.round(p.door[1]) } : p.of !== undefined ? { x: Math.round(p.x), z: Math.round(p.z) } : { x: Math.round(p.x + sx * depth), z: Math.round(p.z + sz * depth) };
    const pad = p.farm !== undefined ? pl.farms?.[p.farm]?.m?.Y : undefined, over = water && water(p.x, p.z) && pl.stilted, fy = pad !== undefined ? pad : over ? 1 : Math.max(water && water(p.x, p.z) ? 0 : -Infinity, H(door.x, door.z));   // a farm's buildings on its pad   // the door's ground (a boathouse at the water's level; a stilt house a block over the shallows)
    if (over) { const [w2, l2] = p.k % 2 ? [p.atom.l, p.atom.w] : [p.atom.w, p.atom.l]; for (let x = Math.round(p.x - w2 / 2); x <= Math.round(p.x + w2 / 2); x += FIB[3]) for (let z = Math.round(p.z - l2 / 2); z <= Math.round(p.z + l2 / 2); z += FIB[3]) for (let y = H(x, z); y <= 0; y++) vox.set(`${x},${y},${z}`, { id: PALETTE[t]?.frame ?? "minecraft:mangrove_log", s: { pillar_axis: "y" } }); }   // derived: the posts every three down to the sea floor
    const minY = Math.min(...[...v.keys()].map((k) => +k.split(",")[1]));
    const cols = new Set();
    for (const [k, b] of v) { const [x, y, z] = k.split(",").map(Number), X = x + dx, Z = z + dz, Y = y + fy; if (b.id === "minecraft:water" && water && water(X, Z)) continue; vox.set(`${X},${Y},${Z}`, b); cols.add(`${X},${Z}`); foot.add(`${X},${Z}`); }
    // open under a raised floor: the ground cut back to the crawlspace, no footing
    const baseOf = new Map(); for (const [k, b] of v) { const [x, y, z] = k.split(",").map(Number); if (y === minY) baseOf.set(`${x + dx},${z + dz}`, b.id); }   // the building's own lowest course: its footing goes down only under that (a post's stone under a post, a plinth under a plinth)
    for (const c of cols) { if (!baseOf.has(c)) { const [X, Z] = c.split(",").map(Number), g = H(X, Z); for (let y = fy + minY + 1; y <= g; y++) if (/dirt|grass_block|snow$/.test(vox.get(`${X},${y},${Z}`)?.id ?? "")) vox.delete(`${X},${y},${Z}`); continue; } const fid = /stone|cobble|andesite|brick|tuff|sandstone|deepslate|blackstone/.test(baseOf.get(c)) ? baseOf.get(c) : PALETTE[t]?.plinth ?? "minecraft:cobblestone"; const [X, Z] = c.split(",").map(Number); const g = H(X, Z); let lowest = Infinity; for (let y = fy + minY; y < fy + minY + FIB[4]; y++) if (vox.has(`${X},${y},${Z}`) && vox.get(`${X},${y},${Z}`).id !== "minecraft:dirt" && vox.get(`${X},${y},${Z}`).id !== "minecraft:grass_block") { lowest = y; break; } if (lowest === Infinity) continue; for (let y = g + 1; y < lowest; y++) vox.set(`${X},${y},${Z}`, { id: fid, s: null }); for (let y = lowest; y <= g; y++) if (/dirt|grass_block|snow$/.test(vox.get(`${X},${y},${Z}`)?.id ?? "")) vox.delete(`${X},${y},${Z}`); }   // the footing down to the ground where it falls away; the ground cut where it rises   // vision: the place's own measure (its lanes, gaps and turns)
    if (p.light) { let top = -Infinity, at = null; for (const k of v.keys()) { const [x, y, z] = k.split(",").map(Number); if (y > top) { top = y; at = [x, z]; } } if (at) { const L = p.light.kind === "fire" ? "minecraft:campfire" : "minecraft:sea_lantern"; vox.set(`${at[0] + dx},${top + fy + 1},${at[1] + dz}`, { id: L, s: null }); if (L !== "minecraft:campfire") for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) vox.set(`${at[0] + dx + a},${top + fy + 1},${at[1] + dz + b}`, { id: "minecraft:glass", s: null }); vox.set(`${at[0] + dx},${top + fy + 2},${at[1] + dz}`, { id: PALETTE[t]?.trim ?? "minecraft:stone_bricks", s: null }); } }   // the light on the tower's top: a lantern in its glass (a fire on a beacon's cairn)
    if (p.of === undefined) doors.push(door);
  }
  // the lanes: each door to the lane nearest it (or the core), round the footprints, a laid lane half the cost
  const lane = new Set(), W = x1 - x0 + 1, idx = (x, z) => (z - z0) * W + (x - x0), inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  const core = pl.placed[0], cr = pl.grown ? -1 : Math.ceil(core.atom.r) + FIB[3]; for (let a = -cr; a <= cr; a++) for (let b = -cr; b <= cr; b++) if (!foot.has(`${core.x + a},${core.z + b}`) && Math.hypot(a, b) <= cr && !(water && water(core.x + a, core.z + b))) lane.add(`${core.x + a},${core.z + b}`);   // the plaza round the core   // vision: the place's own measure (its lanes, gaps and turns)
  for (const k of pl.spine ?? []) if (!foot.has(k)) lane.add(k);
  const kindOf = new Map();
  if (pl.grown) {
    // the streets as grown: each its class's width, a deck where it crosses water, the quay walled down to the floor, the piers on posts, the mole of stone
    for (const st of pl.streets) { const half = (CLASS[st.cls].width - 1) / 2; for (let i = 0; i < st.pts.length; i++) { const [x, z] = st.pts[i], [px, pz] = st.pts[Math.max(0, i - 1)], [nx, nz] = st.pts[Math.min(st.pts.length - 1, i + 1)], L = Math.hypot(nx - px, nz - pz) || 1, ux = -(nz - pz) / L, uz = (nx - px) / L; for (let w = -Math.ceil(half); w <= Math.ceil(half); w += 0.5) { const X = Math.round(x + ux * w), Z = Math.round(z + uz * w), key = `${X},${Z}`; if (foot.has(key) || !inside(X, Z)) continue; lane.add(key); const was = kindOf.get(key); if (!was || CLASS[st.cls].rank > CLASS[was].rank || !CLASS[st.cls].rank) kindOf.set(key, st.cls); } } }
    for (const d of doors) { const key = `${d.x},${d.z}`; if (!foot.has(key) && inside(d.x, d.z)) { lane.add(key); if (!kindOf.has(key)) kindOf.set(key, "path"); } }
    for (const dc of pl.districts?.centres ?? []) { const r0 = FIB[4]; for (let a = -r0; a <= r0; a++) for (let b = -r0; b <= r0; b++) { const X = dc[0] + a, Z = dc[1] + b, key = `${X},${Z}`; if (Math.hypot(a, b) <= r0 && !foot.has(key) && inside(X, Z) && !(water && water(X, Z))) { lane.add(key); kindOf.set(key, "artery"); } } }   // derived: each district's square, five blocks round its core
  }
  const order = (pl.grown ? [] : doors).map((d, i) => ({ d, i, r: Math.hypot(d.x - core.x, d.z - core.z) })).sort((a, b) => a.r - b.r);
  for (const { d } of order) {
    if (!inside(d.x, d.z)) continue;
    const dist = new Float64Array(W * (z1 - z0 + 1)).fill(Infinity), prev = new Int32Array(W * (z1 - z0 + 1)).fill(-1), q = heap(); q.push([0, d.x, d.z]); dist[idx(d.x, d.z)] = 0; let end = null, seen = 0;
    while (q.size) {
      const [c, x, z] = q.pop();   // the cheapest first
      if (c > dist[idx(x, z)]) continue; if (lane.has(`${x},${z}`)) { end = [x, z]; break; } if (++seen > W * FIB[6]) break;   // vision: the place's own measure (its lanes, gaps and turns)
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Z = z + b; if (!inside(X, Z) || foot.has(`${X},${Z}`) || (water && water(X, Z))) continue; const step = (lane.has(`${X},${Z}`) ? 1 / PHI : 1) + Math.abs(H(X, Z) - H(x, z)) * FIB[2]; const nd = c + step; if (nd < dist[idx(X, Z)]) { dist[idx(X, Z)] = nd; prev[idx(X, Z)] = idx(x, z); q.push([nd, X, Z]); } }   // derived: a laid lane at 1/phi the cost; a block of climb costs two
    }
    if (!end) continue;
    let k = idx(end[0], end[1]); while (k >= 0) { const x = (k % W) + x0, z = Math.floor(k / W) + z0; lane.add(`${x},${z}`); k = prev[k]; }
  }
  const surf = SURFACE[t] ?? "minecraft:gravel", stone = ARTERY[t] ?? surf, deck = PALETTE[t]?.trim ?? "minecraft:spruce_planks", masonry = PALETTE[t]?.plinth ?? "minecraft:stone_bricks";
  for (const c of lane) {
    const [x, z] = c.split(",").map(Number); if (foot.has(c)) continue; const h = H(x, z), kd = kindOf.get(c), wetc = water && water(x, z);
    if (kd === "mole") { for (let y = h; y <= 1; y++) vox.set(`${x},${y},${z}`, { id: masonry, s: null }); continue; }   // the breakwater: stone from the floor to a block over the sea
    if (wetc) { vox.set(`${x},1,${z}`, { id: deck, s: null }); if ((x + z) % FIB[3] === 0) for (let y = h; y < 1; y++) vox.set(`${x},${y},${z}`, { id: kd === "pier" ? (PALETTE[t]?.frame ?? "minecraft:spruce_log") : masonry, s: kd === "pier" ? { pillar_axis: "y" } : null }); continue; }   // a deck a block over the water, a post or pier every three   // vision: the place's own measure (its lanes, gaps and turns)
    vox.set(`${x},${h},${z}`, { id: kd === "artery" || kd === "quay" ? stone : kd === "path" ? PATH[t] ?? surf : kd === "track" ? "minecraft:grass_path" : surf, s: null });
    if (kd === "quay") for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Z = z + b; if (water && water(X, Z)) for (let y = H(X, Z); y <= 0; y++) vox.set(`${X},${y},${Z}`, { id: masonry, s: null }); }   // the quay's face, walled to the floor
  }
  // the gaps (world/growth.js gapsOf): each kept by its people, as its shape and place suggest (world/decor.js)
  const decor = {};
  if (pl.gaps) for (const gp of pl.gaps) {
    const cells = gp.cells.filter(([x, z]) => inside(x, z) && !foot.has(`${x},${z}`) && !lane.has(`${x},${z}`)); if (cells.length < FIB[4]) continue;   // vision: the place's own measure (its lanes, gaps and turns)
    const note = decorOf({ ...gp, cells }, t, { put: (x, y, z, id, st = null) => { if (!foot.has(`${x},${z}`) && !lane.has(`${x},${z}`)) vox.set(`${x},${y},${z}`, { id, s: st }); }, H, P: PALETTE[t] ?? {}, stone: ARTERY[t] ?? "minecraft:stone_bricks", seed: gp.cells.length });
    if (note) decor[note] = (decor[note] ?? 0) + 1;
  }
  // the fields (world/growth.js farms, world/decor.js fieldOf)
  const entities = [], spawn = (type, x, y, z) => entities.push({ type, x, y, z });   // the beasts, for the game to summon where they stand
  const freeAt = (x, z) => inside(x, z) && !foot.has(`${x},${z}`) && !lane.has(`${x},${z}`), putFree = (x, y, z, id, st = null) => { if (freeAt(x, z)) vox.set(`${x},${y},${z}`, { id, s: st }); };
  if (pl.wall) { const k = wallOf(pl.wall, t, { put: (x, y, z, id, st = null) => { if (inside(x, z)) vox.set(`${x},${y},${z}`, { id, s: st }); }, dig: (x, y, z) => vox.delete(`${x},${y},${z}`), H, stone: WALL[t] ?? "minecraft:stone_bricks" }); decor[`a ${k === "earth" ? "earth bank" : k === "stone" ? "stone wall" : "palisade"}`] = 1; }
  // the country's modules (world/farms.js): each drawn whole in its own frame, its buildings already laid above
  for (const f of pl.farms ?? []) { const [ox, oz] = f.ox, at2 = (lx, lz) => [ox + lx * f.ex[0] + lz * f.ez[0], oz + lx * f.ex[1] + lz * f.ez[1]]; const note = drawModule(f.m, t, { put: (x, y, z, id, st = null) => { if (inside(x, z) && !foot.has(`${x},${z}`)) vox.set(`${x},${y},${z}`, { id, s: st }); }, H, at: at2, spawn, seed: f.i, dig: (x, y, z) => { if (!foot.has(`${x},${z}`)) vox.delete(`${x},${y},${z}`); } }); decor[`${note === "ranch" ? "ranches" : "farms"}`] = (decor[`${note === "ranch" ? "ranches" : "farms"}`] ?? 0) + 1; }
  if (pl.buffer) { const put2 = (x, y, z, id, st = null) => { if (inside(x, z) && !foot.has(`${x},${z}`)) vox.set(`${x},${y},${z}`, { id, s: st }); };
    if (pl.buffer.cemetery) decor[cemeteryOf(pl.buffer.cemetery, t, { put: put2, H })] = 1;
    for (const [gi, g] of pl.buffer.gardens.entries()) { const n = gardenOf(g, t, { put: put2, H, seed: gi }); decor[n] = (decor[n] ?? 0) + 1; }
    const herd = { european: "minecraft:sheep", norse: "minecraft:sheep", japanese: "minecraft:horse", east_asian: "minecraft:cow", indian_ocean: "minecraft:goat", therans: "minecraft:goat" }[t];   // vision: the common's beasts
    if (herd) for (const [x, z] of pl.buffer.common) spawn(herd, x, Math.round(H(x, z)) + 1, z); }
  if (pl.wild?.length) wildOf(pl.wild, t, { put: putFree, H, free: freeAt });
  // the roads between places (world/roads.js), in this place's frame: each its people's surface and width on the ground,
  // a bridge's deck over the water it crosses (rails, a pier every three), never over a building
  for (const r of roads) for (let i = 0; i + 1 < r.pts.length; i++) {
    const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az)), half = (r.width - 1) / 2;
    for (let s2 = 0; s2 <= n; s2++) { const x = ax + ((bx - ax) * s2) / Math.max(1, n), z = az + ((bz - az) * s2) / Math.max(1, n), nx = -(bz - az) / Math.max(1, n), nz = (bx - ax) / Math.max(1, n);
      for (let w = -Math.ceil(half); w <= Math.ceil(half); w++) { const X = Math.round(x + nx * w), Z = Math.round(z + nz * w), key = `${X},${Z}`; if (X < x0 || X > x1 || Z < z0 || Z > z1 || foot.has(key)) continue; lane.add(key);
        if (water && water(X, Z)) { vox.set(`${X},1,${Z}`, { id: PALETTE[t]?.trim ?? "minecraft:spruce_planks", s: null }); if (Math.abs(w) === Math.ceil(half)) vox.set(`${X},2,${Z}`, { id: "minecraft:spruce_fence", s: null }); if (s2 % FIB[3] === 0 && w === 0) for (let y = H(X, Z); y < 1; y++) vox.set(`${X},${y},${Z}`, { id: PALETTE[t]?.plinth ?? "minecraft:stone_bricks", s: null }); }   // derived: a pier every three blocks
        else vox.set(`${X},${H(X, Z)},${Z}`, { id: r.surface, s: null }); } }
  }
  // the bridges: a deck a block over the water, rails, a pier every three
  // (the deck, as above)
  for (const c of pl.bridges ?? []) { const [x, z] = c.split(",").map(Number); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const X = x + a, Z = z + b; vox.set(`${X},1,${Z}`, { id: deck, s: null }); if ((X + Z) % FIB[3] === 0) for (let y = H(X, Z); y < 1; y++) vox.set(`${X},${y},${Z}`, { id: PALETTE[t]?.plinth ?? "minecraft:stone_bricks", s: null }); } const rail = [[-1, 0], [2, 0], [0, -1], [0, 2]].find(([a, b]) => !pl.bridges.has(`${x + a},${z + b}`) && water && water(x + a, z + b)); if (rail) vox.set(`${x + rail[0]},2,${z + rail[1]}`, { id: "minecraft:spruce_fence", s: null }); }   // derived: a pier every three blocks
  // the wall: on the faint contour, a gap where a lane crosses it
  if (wall && !pl.grown) {   // the older rings' wall (a grown town has its own, on its town-country line)
    const wid = WALL[t] ?? "minecraft:cobblestone", logs = wid.endsWith("_log") || wid.endsWith("_block") && t !== "european";
    for (let x = x0 + 1; x < x1; x++) for (let z = z0 + 1; z < z1; z++) {
      const r = pl.rho(x, z) >= RHO.wall, edge = r && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => pl.rho(x + a, z + b) < RHO.wall);
      if (!edge || lane.has(`${x},${z}`) || foot.has(`${x},${z}`) || (water && water(x, z))) continue;
      const h = H(x, z); for (let y = h + 1; y <= h + (logs ? FIB[3] : FIB[4] - 1); y++) vox.set(`${x},${y},${z}`, { id: wid, s: logs ? { pillar_axis: "y" } : null });   // vision: the place's own measure (its lanes, gaps and turns)
    }
  }
  // the plan: what each column is, for the map
  const plan = { x0, z0, w: W, l: z1 - z0 + 1, at: (x, z) => (foot.has(`${x},${z}`) ? "building" : lane.has(`${x},${z}`) ? "lane" : water && water(x, z) ? "water" : "ground") };
  return { vox, plan, lanes: lane.size, decor, entities };
}
