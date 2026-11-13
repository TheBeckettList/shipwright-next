// Pure. The pack's own blocks, past vanilla (the rule since 12 Nov 2026: vanilla blocks and the variations they
// need): the marbles, the columns built of them (a base, a shaft, a capital: footers and headers), and the faith's
// carvings. The faith is the math: every carved motif is one of its own figures, never a people's sacred design.
//
//   marbles    five stones, each a veined field: Theran white, grey-veined, rose, verde, black
//   parts      a marble's block; its round shaft, fluted or smooth; its base (plinth, torus, scotia, torus); its
//              capitals: the Doric (echinus and abacus), the Ionic (the golden spiral for its volutes), the
//              Corinthian (leaves set round it by the golden angle, phyllotaxis, for the acanthus); the Minoan's
//              painted shaft and its cushion capital, as Thera's own frescoes and houses had them
//   mouldings  the Hellenistic and Phoenician ornament, each from the same math: egg-and-dart (eggs of aspect phi),
//              bead-and-reel (in the Fibonacci word), the running scroll (golden spirals), the guilloche, the
//              anthemion (a palmette fanned by the golden angle), dentils; and the Aeolic capital (golden volutes)
//   carvings   the faith's figures in relief on a marble block: the golden spiral, the sea's wave trains, the
//              Fibonacci word's key (a meander that never repeats), the golden-angle rosette, the Truchet arcs,
//              the breath (the tile's own beat as a band)
//
// Each block: { id, shape, side, end, colour } with its textures drawn here as 16 x 16 of [r, g, b, height] and lit by
// world/textures.js relief, the pack's one light. Shapes are geometry the bake writes (tools/buildmod.mjs).
import { PHI, FIB, GOLDEN_ANGLE, golden, word } from "../core/golden.js";
import { STAMPED } from "./coinage.js";

const N = 16, TAU = 2 * Math.PI;   // given: a tile's pixels; a turn
const frac = (x) => x - Math.floor(x), clamp = (x) => Math.max(0, Math.min(1, x));
// a smooth noise on the torus (so tiles wrap): a sum of plane waves with Fibonacci wavenumbers and golden phases
const field = (u, v, seed) => { let s = 0, a = 0; for (const [kx, ky, w] of [[1, 2, 1], [2, 1, 0.8], [3, 2, 0.5], [2, 5, 0.3], [5, 3, 0.2]]) { s += w * Math.sin(TAU * (kx * u + ky * v) / N + TAU * golden(seed * FIB[5] + kx * 7 + ky)); a += w; } return s / a; };   // derived: Fibonacci wavenumbers, weights falling about as 1/phi

// ---- the marbles: [ground, vein, vein strength, vein sharpness]
export const MARBLES = {
  theran: { name: "Theran", ground: [240, 236, 226], vein: [170, 182, 198], k: 0.42, sharp: 5, seed: 6, flecks: true },   // vision: the Therans' own stone: a warm white, soft blue-grey veins, flecked with gold, copper and silver
  white: { name: "Theran white", ground: [236, 234, 228], vein: [196, 192, 186], k: 0.45, sharp: 5, seed: 1 },   // vision: the Therans' own, barely veined
  carrara: { name: "grey-veined", ground: [226, 226, 224], vein: [128, 132, 140], k: 0.85, sharp: 3, seed: 2 },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  rose: { name: "rose", ground: [230, 196, 186], vein: [176, 116, 108], k: 0.7, sharp: 3, seed: 3 },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  verde: { name: "verde", ground: [58, 104, 84], vein: [196, 220, 204], k: 0.75, sharp: 5, seed: 4 },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  nero: { name: "black", ground: [36, 36, 40], vein: [214, 212, 206], k: 0.85, sharp: 8, seed: 5 },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
};   // vision: the five stones' colours; the vein's sharpness a Fibonacci number (broad enough to read at sixteen pixels)
const MINOAN = { shaft: [158, 44, 34], capital: [26, 24, 26], band: [214, 170, 68] };   // vision: Thera's own painted columns: red ochre, the black cushion, a gold band

/** The variant being painted: each of a block's OWN_VARIANTS shifts its marble's field, so the veins never repeat block
 *  to block (the game picks one per block, by its position: terrain_texture.json variations). */
export const OWN_VARIANTS = FIB[4];   // vision: five of each
let VK = 0, FACE = "ns";
/** Paint a pixel of variant k on a face: "ns" (the north and south faces), "ew" (east and west) or "end" (up and down).
 *  Each face is its own slice of one solid stone (marble3), so a vein runs round a corner onto the next face and on into
 *  the next block; and the courses of the cut stocks (ashlar, brick) sit half a block on along the east and west faces
 *  from the north and south, so a corner bonds as masonry does. */
export const paintVariant = (k, f, u, v, face = "ns") => { VK = k; FACE = face; try { return f(u, v); } finally { VK = 0; FACE = "ns"; } };
export const FACES = ["ns", "ew", "end"];
const slice = (u, v) => (FACE === "ew" ? [0, N - 1 - v, u] : FACE === "end" ? [u, 0, v] : [u, N - 1 - v, 0]);   // a face's pixel as a point of the block's own sixteen-cube (y up)
const bond = () => (FACE === "ew" ? N / 4 : 0);   // derived: the east and west faces' courses half a stone (a quarter block) on
/** A marble's colour and its own (faint) relief at a pixel: veins where the warped field crosses zero. */
export function marbleAt(m, u, v) {
  const M = MARBLES[m], seed = M.seed + VK * FIB[6], [x, y, z] = slice(u, v);   // vision: the mason's drawing (the stone's figures in a tile's sixteen pixels)
  // the solid field: plane waves with whole Fibonacci wavenumbers in x, y and z (so the stone wraps every block), the veins
  // the level set where a warped bedding wave (mostly in y, the stone's bed) crosses zero
  let w = 0, a = 0; for (const [kx, ky, kz, wt] of [[1, 1, 2, 1], [2, 1, 1, 0.8], [1, 2, 3, 0.5], [3, 2, 1, 0.4], [2, 3, 5, 0.25]]) { w += wt * Math.sin(TAU * (kx * x + ky * y + kz * z) / N + TAU * golden(seed * FIB[5] + kx * 7 + ky * 3 + kz)); a += wt; } w /= a;   // derived: Fibonacci wavenumbers, the finest under the tile's Nyquist
  const f = Math.sin(TAU * (x + FIB[3] * y + 2 * z) / N + w * PHI ** 2 * 2), vein = Math.pow(1 - Math.abs(f), M.sharp) * M.k;   // derived: the bed at wavenumbers (1, 3, 2), warped by the field
  const mott = 0.97 + 0.04 * Math.sin(TAU * (2 * x + 3 * y + z) / N + seed) + (VK ? (golden(VK * FIB[7]) - 0.5) * 0.03 : 0);   // vision: a faint mottle, each variant a shade apart
  const base = [...M.ground.map((c, i) => (c + (M.vein[i] - c) * vein) * mott), 0.55 + (M.flecks ? 0.05 : 0.09) * w - (M.flecks ? 0.04 : 0.07) * vein];   // vision: the Theran stone only subtly 3D
  if (M.flecks) {   // the metal: faint broken threads, a second bed of veins at its own slant, mostly gold, copper and silver in hints along it; a glint here and there where a thread catches the light
    const g = Math.sin(TAU * (2 * x + y + FIB[3] * z) / N + w * PHI * FIB[3] + seed), thread = Math.pow(1 - Math.abs(g), FIB[5]), fade = clamp(0.5 + w * PHI + 0.5 * Math.sin(TAU * (x - 2 * y + z) / N + seed * 2));   // derived: wavenumbers (2, 1, 3), sharp as eight; broken where the field fades it
    const hue = 0.5 + 0.5 * Math.sin(TAU * (x + y - z) / N + seed * 3), mt = hue < 1 / PHI ? METALS[0] : hue < 1 / PHI + 1 / PHI ** 4 ? METALS[1] : METALS[2];   // derived: gold most of the thread, copper and silver in hints
    const t = thread * fade * (1 / PHI), glint = thread > 1 - 1 / PHI ** 4 && fade > 1 / PHI && golden(seed + x * FIB[5] + y * FIB[7] + z * FIB[9]) < 1 / PHI ** 4;   // derived: the thread a golden share of metal at most; a glint in some few of its brightest pixels
    if (glint) return [...mt.map((c) => Math.min(255, c * 1.18 + 26)), base[3] + 0.05];   // a glint: the metal lit, a hair proud   // vision: the glint a hair proud
    if (t > 1 / FIB[10]) return [...base.slice(0, 3).map((c, i) => c + (mt[i] * 1.06 - c) * t), base[3] + t / FIB[9]]; }   // derived: a thread too faint to see left out; it stands a hair proud as it brightens
  return base;
}
// the flecks: five a tile on the Fibonacci lattice, jittered by the golden sequence, each gold, copper or silver
// (gold the commonest, a golden share of them), a pixel across with a lit corner, a few two
const METALS = [[226, 184, 82], [200, 118, 70], [210, 216, 224]];   // vision: gold, copper, silver
function fleckAt(u, v, seed) {
  for (let k = 0; k < FIB[4]; k++) { const x = Math.floor(frac(k / FIB[4] + golden(seed * 3 + k) * 0.37) * N), y = Math.floor(frac((k * FIB[3]) / FIB[4] + golden(seed * 5 + k) * 0.29) * N);   // derived: the Fibonacci lattice of five, jittered
    const big = golden(seed + k * 11) < 1 / PHI ** 4, on = (u === x && v === y) || (big && u === (x + 1) % N && v === y);   // vision: the mason's drawing (the stone's figures in a tile's sixteen pixels)
    if (!on) continue; const g = golden(seed * 7 + k), mt = METALS[g < 1 / PHI ? 0 : g < 1 / PHI + 1 / PHI ** 3 ? 1 : 2], lit = u === x && v === y ? 1.12 : 0.92;   // vision: a fleck's lit pixel and its shade
    return { rgb: mt.map((c) => Math.min(255, c * lit)), t: 1 / PHI }; }   // derived: a fleck a golden share metal, the rest the stone it sits in
  return null;
}
const tone = (c, t) => c.map((x) => x * t);
const over = (m, u, v, h, t = 1) => { const p = marbleAt(m, u, v); return [...tone(p.slice(0, 3), t), h]; };   // the marble's colour at a carved height   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)

// ---- the parts' textures, drawn in the block's own pixel coordinates (u across, v down from the top), so a moulding's
// rows line up with the geometry's boxes (the bake maps each box face onto the matching window of the tile)
const PARTS = {
  block: (m) => (u, v) => over(m, u, v, 0.55),   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  end: (m) => (u, v) => over(m, u, v, 0.55),   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  // the fluted shaft: five flutes a face (twenty round), each a hollow, the arris between them a sharp edge
  shaft: (m) => (u, v) => { const t = frac((u + 0.5) / (N / FIB[4])), h = 0.25 + 0.7 * Math.sqrt(Math.abs(Math.cos(Math.PI * t))); return over(m, u, v, h, 0.9 + 0.12 * h); },   // derived: five flutes across a face
  smooth: (m) => (u, v) => over(m, u, v, 0.6),   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  // the base: plinth (v 13-15), lower torus (10-12), scotia (9), upper torus (7-8), the shaft's foot above
  base: (m) => (u, v) => { const y = N - 1 - v; const h = y < 3 ? 0.6 : y < 6 ? 0.35 + 0.6 * Math.sin(Math.PI * (y - 3 + 0.5) / 3) : y < 7 ? 0.1 : y < 9 ? 0.35 + 0.6 * Math.sin(Math.PI * (y - 7 + 0.5) / 2) : 0.55; return over(m, u, v, h, 0.86 + 0.18 * h); },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  // the Doric capital: the shaft's neck, the echinus swelling (v 3-5), the abacus (v 0-2)
  doric: (m) => (u, v) => { const h = v < 3 ? 0.65 : v < 6 ? 0.3 + 0.6 * Math.sin(Math.PI * (v - 3 + 0.5) / 3) : v === 6 ? 0.15 : 0.55; return over(m, u, v, h, 0.86 + 0.18 * h); },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  // the Ionic capital: a golden spiral (r = a phi^(theta / quarter turn)) wound at each volute's eye, the abacus over
  ionic: (m) => (u, v) => { if (v < 2) return over(m, u, v, 0.65);   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
    let best = 1; for (const cx of [3.5, 12.5]) { const dx = u + 0.5 - cx, dy = v + 0.5 - 6.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, cx < 8 ? -dx : dx); if (r > 5) continue;   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
      const turns = Math.log(Math.max(r, 0.3) / 0.35) / Math.log(PHI) / 4, d = Math.abs(frac(turns - a / TAU) - 0.5); best = Math.min(best, d); }   // derived: the golden spiral grows by phi a quarter turn
    const h = best < 1 ? 0.25 + 0.7 * clamp(best * 3) : 0.5; return over(m, u, v, h, 0.86 + 0.18 * h); },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  // the Aeolic capital (the Phoenicians' and the first Greek capitals'): two golden spirals rising from the shaft and
  // curling outward, a palmette's fan between them, no abacus over its volutes' tops
  aeolic: (m) => (u, v) => { let best = 1; for (const cx of [3, 13]) { const dx = u + 0.5 - cx, dy = v + 0.5 - 5, r = Math.hypot(dx, dy), a = Math.atan2(dy, cx < 8 ? dx : -dx); if (r > 4.6) continue; const t = Math.log(Math.max(r, 0.3) / 0.35) / Math.log(PHI) / 4 - a / TAU; best = Math.min(best, Math.abs(frac(t) - 0.5)); }   // vision: the carver's drawing (the moulding's figure in a tile's sixteen pixels)
    const fan = Math.abs(u + 0.5 - 8) < (13 - v) * 0.35 && v > 2 && v < 13 && (Math.round((u + 0.5 - 8) / Math.max(0.5, (13 - v) * 0.12)) % 2 === 0);   // vision: the carver's drawing (the moulding's figure in a tile's sixteen pixels)
    const h = best < 1 ? 0.25 + 0.7 * clamp(best * 3) : fan ? 0.8 : v < 2 ? 0.65 : 0.4; return over(m, u, v, h, 0.86 + 0.18 * h); },   // vision: the carver's drawing (the moulding's figure in a tile's sixteen pixels)
  // the Corinthian capital: leaves set by the golden angle round the bell (phyllotaxis), the abacus over them
  corinthian: (m) => (u, v) => { if (v < 3) return over(m, u, v, 0.65);   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
    let leaf = 0; for (let k = 0; k < FIB[6]; k++) { const a = k * GOLDEN_ANGLE, x = frac(a / TAU) * N, y = 4 + (k / FIB[6]) * 11, dx = Math.min(Math.abs(u + 0.5 - x), N - Math.abs(u + 0.5 - x)), dy = v + 0.5 - y, e = (dx / 2.2) ** 2 + (dy / (2.2 * PHI)) ** 2; if (e < 1) leaf = Math.max(leaf, 1 - e); }   // derived: thirteen leaves by the golden angle, each an ellipse of aspect phi
    return over(m, u, v, 0.3 + 0.6 * leaf, 0.84 + 0.22 * leaf); },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
};
// the Minoan column: the shaft painted red ochre, the cushion capital black with a gold band
const MINOAN_PARTS = {
  shaft: (u, v) => { const g = 0.92 + 0.08 * field(u, v, 21); return [...tone(MINOAN.shaft, g), 0.55]; },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  capital: (u, v) => { const band = v === 12 || v === 13; return band ? [...MINOAN.band, 0.6] : v < 3 ? [...tone(MINOAN.capital, 1.1), 0.7] : [...tone(MINOAN.capital, 0.9 + 0.2 * Math.sin(Math.PI * (v - 3) / 9)), 0.4 + 0.5 * Math.sin(Math.PI * (v - 3 + 0.5) / 9)]; },   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
};

// ---- the faith's carvings, each a figure of the math in relief on the marble
const CARVINGS = {
  spiral: (u, v) => { const dx = u + 0.5 - 8, dy = v + 0.5 - 8, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), turns = Math.log(Math.max(r, 0.4) / 0.45) / Math.log(PHI) / 4, d = Math.abs(frac(turns - a / TAU) - 0.5); return r > 7.6 ? 0.55 : 0.2 + 0.75 * clamp(1 - d * 4); },   // the golden spiral, phi a quarter turn   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  wave: (u, v) => { let h = 0; for (const [kx, ky, i] of [[1, 1, 0], [2, 1, 1], [1, 2, 2]]) h += Math.cos(TAU * (kx * u + ky * v) / N + i * GOLDEN_ANGLE) / Math.hypot(kx, ky); return 0.5 + 0.42 * h; },   // the sea's own wave trains (the water's), frozen   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  key: (u, v) => { const L = (n) => word(n) === 1, x = Math.floor(u / 2), y = Math.floor(v / 2); const on = (y % 4 === 0) || (L(x + y) && (x % 2 === 0)) || (y % 4 === 2 && L(x)); return on ? 0.85 : 0.3; },   // the Fibonacci word's key: a meander that never repeats   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  rosette: (u, v) => { let h = 0.3; const dx = u + 0.5 - 8, dy = v + 0.5 - 8; if (Math.hypot(dx, dy) > 7.5) return 0.55; for (let k = 1; k < FIB[8]; k++) { const r = 1.15 * Math.sqrt(k), a = k * GOLDEN_ANGLE, d = Math.hypot(dx - r * Math.cos(a), dy - r * Math.sin(a)); if (d < 1.1) h = Math.max(h, 0.95 - d * 0.5); } return h; },   // derived: thirty-four seeds by the golden angle (Vogel's spiral)
  truchet: (u, v) => { const c = (Math.floor(u / 8) + Math.floor(v / 8) * 2), x = u % 8 + 0.5, y = v % 8 + 0.5, flip = golden(c + 3) < 0.5, d = flip ? Math.min(Math.hypot(x, y), Math.hypot(8 - x, 8 - y)) : Math.min(Math.hypot(8 - x, y), Math.hypot(x, 8 - y)), ring = Math.abs(d - 8 / PHI); return ring < 1.4 ? 0.95 - ring * 0.3 : 0.3; },   // derived: arcs at the golden radius (as the glazed tiles), turned by the golden sequence
  // the Hellenistic and Phoenician mouldings, each drawn from the same math
  egg_dart: (u, v) => { const x = (u + 0.5) % 8, y = v + 0.5; if (v < 3 || v > 12) return v < 3 ? 0.7 : 0.45; const e = ((x - 4) / 2.6) ** 2 + ((y - 8) / (2.6 * PHI)) ** 2, dart = Math.abs(x - 0.5) < 0.9 && y > 6 && y < 12 - Math.abs(x - 0.5); return e < 1 ? 0.45 + 0.5 * Math.sqrt(1 - e) : dart ? 0.75 : e < 1.5 ? 0.15 : 0.35; },   // derived: eggs of aspect phi, a dart between each pair
  bead_reel: (u, v) => { if (v < 5 || v > 10) return v < 5 ? 0.62 : 0.5; let x = 0, k = 0, h = 0.3; while (x < N) { const w = word(k) === 1 ? 3 : 2, c = x + w / 2, d = Math.abs(u + 0.5 - c); if (d < w / 2) h = word(k) === 1 ? 0.4 + 0.55 * Math.sqrt(Math.max(0, 1 - (d / 1.5) ** 2 - ((v - 7.5) / 2.6) ** 2)) : 0.35 + 0.3 * (1 - d); x += w; k++; } return h; },   // derived: beads three wide and reels two, in the Fibonacci word
  scroll: (u, v) => { const x = (u + 0.5) % 8 - 4, y = v + 0.5 - 8, r = Math.hypot(x, y), a = Math.atan2(y, x), t = Math.log(Math.max(r, 0.35) / 0.4) / Math.log(PHI) / 4 - a / TAU, d = Math.abs(frac(t) - 0.5); return r < 4.2 ? 0.25 + 0.7 * clamp(1 - d * 4) : Math.abs(v + 0.5 - 8 + 3.5 * Math.cos(TAU * (u + 0.5) / 8)) < 1 ? 0.8 : 0.3; },   // the running scroll: a golden spiral every eight, the wave joining them   // vision: the carver's drawing (the moulding's figure in a tile's sixteen pixels)
  guilloche: (u, v) => { const a = 8 + 4.2 * Math.sin(TAU * (u + 0.5) / 8), b = 8 - 4.2 * Math.sin(TAU * (u + 0.5) / 8), da = Math.abs(v + 0.5 - a), db = Math.abs(v + 0.5 - b), over = Math.floor((u + 2) / 4) % 2 === 0, eye = Math.hypot(((u + 0.5) % 8) - 4, v + 0.5 - 8) < 1.6; return eye ? 0.75 : da < 1.1 && (over || db > 1.1) ? 0.9 - da * 0.3 : db < 1.1 ? 0.85 - db * 0.3 : 0.3; },   // two bands interlaced, a boss in each eye   // vision: the carver's drawing (the moulding's figure in a tile's sixteen pixels)
  anthemion: (u, v) => { const dx = u + 0.5 - 8, dy = v + 0.5 - 14, r = Math.hypot(dx, dy), a = Math.atan2(-dy, dx); if (r < 2) return 0.85; let h = 0.3; for (let k = -2; k <= 2; k++) { const ak = Math.PI / 2 + k * GOLDEN_ANGLE / FIB[4] * 2, d = Math.abs(Math.atan2(Math.sin(a - ak), Math.cos(a - ak))) * r; if (r < 12 - Math.abs(k) * 1.5 && d < 1.3 * (r / 8 + 0.4)) h = Math.max(h, 0.9 - d * 0.25); } return h; },   // the palmette: five leaves fanned by a share of the golden angle from a heart   // vision: the carver's drawing (the moulding's figure in a tile's sixteen pixels)
  dentil: (u, v) => (v < 3 ? 0.7 : v < 11 ? ((u % 4) < 3 ? 0.85 : 0.15) : 0.5),   // the dentils: blocks three wide, a gap of one   // vision: the carver's drawing (the moulding's figure in a tile's sixteen pixels)
  breath: (u, v) => { const beat = Math.sin(TAU * (v + 0.5) / FIB[5]) * Math.cos(TAU * (u + 0.5) / N * FIB[3]); return 0.5 + 0.4 * beat; },   // the tile's beat, eight rows and three across   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
};
const CARVED_IN = ["theran", "carrara"];   // (the mouldings run in both, the friezes and the cornices   // vision: the faith's figures cut in the Therans' white and in grey-veined

// ---- the blocks: id, shape (a geometry the bake writes), the textures' painters, a map colour
// the Therans' building stock in their own marble: polished, ashlar (cut blocks, the joints a hair sunk), brick, floor
// tile, a slab and stairs (four, by the way each rises)
// (the ashlar's top shows its stones' squared beds; the brick's top is plain)
const THERAN_STOCK = {
  polished: (u, v) => { const p = paintPolished(u, v); return p; },
  ashlar: (u, v) => { const c = Math.floor(v / 4), joint = FACE === "end" ? u % 8 === 7 || v % 8 === 7 : v % 4 === 3 || (u + bond() + (c % 2) * 4) % 8 === 7; const p = marbleAt("theran", u, v); return joint ? [...tone(p.slice(0, 3), 0.86), 0.3] : [...p.slice(0, 3), p[3] + 0.05]; },   // vision: blocks eight long and four high, a course's joints half a block on from the last's
  brick: (u, v) => { const c = Math.floor(v / FIB[3]), w = word(c) === 1 ? 5 : 3, uu = u + bond(), joint = FACE !== "end" && (v % FIB[3] === FIB[3] - 1 || (uu + c * w) % (2 * w + 2) === 0 || (uu + c * w) % (2 * w + 2) === w + 1); const p = marbleAt("theran", u, v); return joint ? [...tone(p.slice(0, 3), 0.84), 0.25] : p; },   // derived: courses three high, bricks five and three long by the word
  tile: (u, v) => { const x = u % 8, y = v % 8, edge = x === 0 || y === 0, alt = (Math.floor(u / 8) + Math.floor(v / 8)) % 2; const p = marbleAt(alt ? "theran" : "carrara", u, v); return edge ? [...tone(p.slice(0, 3), 0.8), 0.3] : [...p.slice(0, 3), 0.55 + 0.04 * (1 - Math.max(Math.abs(x - 4), Math.abs(y - 4)) / 4)]; },   // vision: squares of eight, Theran and grey-veined in turn, each a hair domed
};
function paintPolished(u, v) { const M = MARBLES.theran, keep = M.k;   // (polished: fainter veins)
   M.k = keep / PHI; try { const p = marbleAt("theran", u, v); return [...p.slice(0, 3).map((c) => Math.min(255, c * 1.03)), 0.55]; } finally { M.k = keep; } }   // derived: polished: the veins a golden share fainter, the face flat and bright
const PART_LIST = [["block", "full", "block"], ["column", "shaft", "shaft"], ["column_smooth", "shaft", "smooth"], ["column_base", "base", "base"], ["capital_doric", "doric", "doric"], ["capital_ionic", "ionic", "ionic"], ["capital_corinthian", "corinthian", "corinthian"], ["capital_aeolic", "ionic", "aeolic"]];
export const CUSTOM = [];
for (const m of Object.keys(MARBLES)) for (const [part, shape, tex] of PART_LIST) CUSTOM.push({ id: `waterworld:${m}_marble_${part}`, shape, side: PARTS[tex](m), end: PARTS.end(m), colour: MARBLES[m].ground, name: `${MARBLES[m].name} marble ${part.replace(/_/g, " ")}`, family: "stone" });
for (const [k, f] of Object.entries(THERAN_STOCK)) CUSTOM.push({ id: `waterworld:theran_marble_${k}`, shape: "full", side: f, end: f, colour: MARBLES.theran.ground, name: `Theran marble, ${k}`, family: "stone" });
CUSTOM.push({ id: "waterworld:theran_marble_baluster", shape: "baluster", side: PARTS.smooth("theran"), end: PARTS.end("theran"), colour: MARBLES.theran.ground, name: "Theran marble baluster", family: "stone" });   // the balustrade's turned post: the skyways' rail, open to the view
CUSTOM.push({ id: "waterworld:theran_marble_slab", shape: "slab", side: PARTS.block("theran"), end: PARTS.end("theran"), colour: MARBLES.theran.ground, name: "Theran marble slab", family: "stone" });
for (const d of ["east", "west", "south", "north"]) CUSTOM.push({ id: `waterworld:theran_marble_stairs_${d}`, shape: `roof_${d}`, side: PARTS.block("theran"), end: PARTS.end("theran"), colour: MARBLES.theran.ground, name: `Theran marble stairs (rising ${d})`, family: "stone" });
CUSTOM.push({ id: "waterworld:minoan_column", shape: "minoan_shaft", side: MINOAN_PARTS.shaft, end: (u, v) => [...MINOAN.shaft, 0.55], colour: MINOAN.shaft, name: "Minoan column", family: "stone" });   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
CUSTOM.push({ id: "waterworld:minoan_capital", shape: "minoan", side: MINOAN_PARTS.capital, end: (u, v) => [...MINOAN.capital, 0.6], colour: MINOAN.capital, name: "Minoan capital", family: "stone" });   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
for (const m of CARVED_IN) for (const [k, f] of Object.entries(CARVINGS)) CUSTOM.push({ id: `waterworld:${m}_marble_${k}`, shape: "full", side: (u, v) => { const h = f(u, v); return over(m, u, v, h, 0.84 + 0.24 * h); }, end: PARTS.end(m), colour: MARBLES[m].ground, name: `${MARBLES[m].name} marble, carved: ${k}`, family: "stone" });   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
// ---- the faith's glass: the same figures as leaded stained glass, for the windows' heads and the rose windows. A
// pixel is lead (dark, opaque) along the figure's edges, else a coloured pane, translucent, from the Therans' blue,
// gold and white
const PANES = [[44, 86, 178], [214, 170, 62], [236, 240, 244], [96, 162, 220], [34, 54, 120]];   // vision: deep blue, gold, white, sky, night blue
const LEAD = [40, 38, 44];   // vision: the cames' lead
const GLASSES = {
  spiral: (u, v) => { const dx = u + 0.5 - 8, dy = v + 0.5 - 8, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), t = Math.log(Math.max(r, 0.4) / 0.45) / Math.log(PHI) / 4 - a / TAU, d = Math.abs(frac(t) - 0.5); return { lead: d > 0.42 || r > 7.6 && r < 8.4, pane: r > 7.6 ? 3 : Math.floor(frac(t) * 2) }; },   // vision: the glazier's drawing (the panes' figures and leads in a tile's sixteen pixels)
  rosette: (u, v) => { const dx = u + 0.5 - 8, dy = v + 0.5 - 8, r = Math.hypot(dx, dy); if (r > 7.6) return { lead: r < 8.4, pane: 3 }; let best = 9, bk = 0, second = 9; for (let k = 1; k < FIB[7]; k++) { const rr = 1.6 * Math.sqrt(k), a = k * GOLDEN_ANGLE, d = Math.hypot(dx - rr * Math.cos(a), dy - rr * Math.sin(a)); if (d < best) { second = best; best = d; bk = k; } else if (d < second) second = d; } return { lead: second - best < 0.55, pane: bk % 3 === 0 ? 1 : bk % 3 === 1 ? 0 : 3 }; },   // derived: the Voronoi of twenty-one golden-angle seeds, leaded along its cells' edges
  truchet: (u, v) => { const c = Math.floor(u / 8) + Math.floor(v / 8) * 2, x = u % 8 + 0.5, y = v % 8 + 0.5, flip = golden(c + 3) < 0.5, d = flip ? Math.min(Math.hypot(x, y), Math.hypot(8 - x, 8 - y)) : Math.min(Math.hypot(8 - x, y), Math.hypot(x, 8 - y)), ring = d - 8 / PHI; return { lead: Math.abs(ring) < 0.6, pane: ring < 0 ? 0 : (c % 2 ? 2 : 3) }; },   // vision: the glazier's drawing (the panes' figures and leads in a tile's sixteen pixels)
  key: (u, v) => { const on = (a, b) => { const x = Math.floor(a / 2), y = Math.floor(b / 2); return (y % 4 === 0) || (word(x + y) === 1 && x % 2 === 0) || (y % 4 === 2 && word(x) === 1); }, me = on(u, v); return { lead: on(u + 1, v) !== me || on(u, v + 1) !== me, pane: me ? 1 : 0 }; },   // vision: the glazier's drawing (the key's own figure, leaded where it turns)
  quarry: (u, v) => { const a = (u + v) % 8, b = (u - v + 64) % 8; return { lead: a === 0 || b === 0, pane: (Math.floor((u + v) / 8) + Math.floor((u - v + 64) / 8)) % 2 ? 3 : 2 }; },   // diamond quarries, the breath's diagonal   // vision: the glazier's drawing (the panes' figures and leads in a tile's sixteen pixels)
  wave: (u, v) => { let h = 0; for (const [kx, ky, i] of [[1, 1, 0], [2, 1, 1], [1, 2, 2]]) h += Math.cos(TAU * (kx * u + ky * v) / N + i * GOLDEN_ANGLE) / Math.hypot(kx, ky); const band = Math.floor((h + 2) * 1.5); return { lead: Math.abs(frac((h + 2) * 1.5) - 0.5) > 0.42, pane: [4, 0, 3, 2, 1][((band % 5) + 5) % 5] }; },   // vision: the glazier's drawing (the panes' figures and leads in a tile's sixteen pixels)
};
export const GLASS_KINDS = Object.keys(GLASSES);
for (const [k, f] of Object.entries(GLASSES)) CUSTOM.push({ id: `waterworld:stained_${k}`, shape: "full", glass: true, rgba: (u, v) => { const g = f(u, v); if (g.lead) return [...LEAD, 255]; const c = PANES[g.pane] ?? PANES[0], lit = 0.92 + 0.12 * field(u, v, 31); return [...c.map((x) => Math.min(255, x * lit)), 150]; }, colour: PANES[0], name: `stained glass: ${k}`, family: "glass" });   // vision: a pane lets three-fifths of the light through
// ---- the peoples' carvings: the faith's own figures (the math, never a people's sacred design) cut in each people's
// own material and coloured in its own palette, for where carving naturally sits (door lintels, panels, house-fronts)
const WOOD = (c) => (u, v) => { const g = Math.sin(TAU * (v + 0.5 + 2 * Math.sin(TAU * u / N)) / FIB[4]) * 0.5 + 0.5; return c.map((x) => x * (0.9 + 0.12 * g)); };   // derived: a wood's grain, five to a tile, wavering
const STONE = (c) => (u, v) => { const g = field(u, v, 51); return c.map((x) => x * (0.94 + 0.08 * g)); };   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
const MOTIFS = {
  interlace: (u, v) => { const a = Math.abs(((v + 0.5) - 8) - 4.5 * Math.sin(TAU * (u + 0.5) / 8)), b = Math.abs(((v + 0.5) - 8) + 4.5 * Math.sin(TAU * (u + 0.5) / 8)), top = word(Math.floor((u + 2) / 4)) === 1; return a < 1.3 && (top || b >= 1.3) ? 0.9 - a * 0.25 : b < 1.3 ? 0.85 - b * 0.25 : 0.3; },   // two strands over and under where the Fibonacci word says   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  rosette: CARVINGS.rosette, truchet: CARVINGS.truchet, wave: CARVINGS.wave, spiral: CARVINGS.spiral,
  vine: (u, v) => { const stem = 8 + 3 * Math.sin(TAU * (u + 0.5) / N), d = Math.abs(v + 0.5 - stem); if (d < 0.9) return 0.85; for (let k = 0; k < FIB[5]; k++) { const x = (k * N) / FIB[5] + 1, y = 8 + 3 * Math.sin(TAU * x / N) + (k % 2 ? 2.6 : -2.6), a = k * GOLDEN_ANGLE, dx = u + 0.5 - x, dy = v + 0.5 - y, e = ((dx * Math.cos(a) + dy * Math.sin(a)) / 1.7) ** 2 + ((-dx * Math.sin(a) + dy * Math.cos(a)) / (1.7 / PHI)) ** 2; if (e < 1) return 0.75; } return 0.3; },   // a vine: leaves of aspect phi set by the golden angle along a sinuous stem   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  eyes: (u, v) => { const x = (u + 0.5) % 8 - 4, y = v + 0.5 - 8, r = Math.hypot(x / PHI, y), a = Math.atan2(y, x), t = Math.log(Math.max(r, 0.35) / 0.4) / Math.log(PHI) / 4 - a / TAU, d = Math.abs(frac(t) - 0.5); return r < 3.6 ? (r < 1 ? 0.95 : 0.25 + 0.7 * clamp(1 - d * 4)) : r < 4.3 ? 0.9 : 0.3; },   // a pair of golden spirals in ovals of aspect phi   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
};
export const PEOPLE_CARVINGS = {
  norse: { motif: "interlace", base: WOOD([150, 110, 70]), paint: [[168, 54, 40], [196, 150, 64]], where: "door lintels, roof-ridge ends" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  european: { motif: "rosette", base: STONE([150, 148, 140]), paint: null, where: "over doors, gable roundels" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  indian_ocean: { motif: "truchet", base: WOOD([92, 58, 36]), paint: [[196, 160, 82]], where: "door panels (brass bosses)" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  japanese: { motif: "wave", base: WOOD([214, 186, 140]), paint: [[46, 62, 112]], where: "transom panels over doors" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  east_asian: { motif: "spiral", base: STONE([128, 128, 126]), paint: [[164, 42, 36]], where: "beam ends, railing panels" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  birchbark: { motif: "vine", base: WOOD([226, 218, 196]), paint: [[178, 50, 44], [214, 172, 52], [52, 82, 150]], where: "lodge door frames" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  dugout: { motif: "eyes", base: WOOD([150, 96, 62]), paint: [[164, 40, 34], [24, 22, 24]], where: "house-front boards" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  pacific: { motif: "spiral", base: WOOD([84, 58, 40]), paint: null, where: "canoe-house posts" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  shallow: { motif: "wave", base: WOOD([170, 120, 80]), paint: [[52, 140, 160], [220, 170, 60], [196, 70, 60]], where: "boat-house gables" },   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
  therans: { motif: "rosette", theran: true, where: "over doors" },
};
for (const [t, P] of Object.entries(PEOPLE_CARVINGS)) {
  const fig = MOTIFS[P.motif];
  const side = P.theran ? (u, v) => { const h = fig(u, v); return over("theran", u, v, h, 0.84 + 0.24 * h); }   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
    : (u, v) => { const h = fig(u, v), c = P.base(u, v), raised = h > 0.6; let col = c.map((x) => x * (0.72 + 0.4 * h));   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
        if (P.paint && raised) { const k = Math.floor(golden(Math.floor(u / 4) + Math.floor(v / 4) * 5 + 1) * P.paint.length); col = P.paint[k].map((x, i) => x * 0.78 + col[i] * 0.22); }   // vision: the raised figure painted, the paint a little worn
        return [...col, h]; };
  CUSTOM.push({ id: `waterworld:${t}_carving`, shape: "full", side, end: P.theran ? PARTS.end("theran") : (u, v) => [...P.base(u, v), 0.5], colour: P.theran ? MARBLES.theran.ground : P.base(8, 8), name: `${t} carving (${P.motif})`, family: P.base === undefined || P.theran ? "stone" : "planks" });   // vision: the carver's drawing (each people's material and palette, the figure in a tile's sixteen pixels)
}
// ---- the stamped metals (world/coinage.js): nine ingots struck like a coin. A round die sunk into the plate, its rim
// beaded, and in it the figure struck up in soft relief, flowing, of the sea: the Theran refinery's die is the wave
// (a crest curling over into the golden spiral, a swell under it; the sea the Therans rule); the League's is the tide
// (rings spreading from a fallen drop; the trade that flows out and back). Heights, not lines: the light finds the figure.
export const METAL_RGB = { copper: [198, 112, 80], iron: [214, 214, 210], gold: [246, 204, 72], netherite: [72, 66, 68] };   // given: the metals' colours (vanilla's blocks)
const DIE = 6.9, smooth = (e) => { const t = clamp(e); return t * t * (3 - 2 * t); };   // vision: the die's radius in a tile's sixteen pixels; a soft step
/** The rim: a raised ring and its beads (twenty-one round, a Fibonacci number). -1 outside the die. */
const rimOf = (x, y, r) => { if (r > DIE + 0.6) return -1; if (r > DIE - 0.7) { const a = Math.atan2(y, x), k = Math.round((a / TAU) * FIB[7]), ak = (k / FIB[7]) * TAU; return 0.62 + 0.35 * smooth(1 - Math.hypot(x - DIE * Math.cos(ak), y - DIE * Math.sin(ak)) / 0.9); } return null; };   // vision: the beads a hair under a pixel across
/** The Theran wave: one great crest rising from the lower left and curling over into a golden spiral, a swell under it. */
export const theranDie = (u, v) => {
  const x = u + 0.5 - 8, y = v + 0.5 - 8, r = Math.hypot(x, y), rim = rimOf(x, y, r); if (rim !== null) return rim;   // given: the tile's middle
  const cx = 0.9, cy = -0.6, dx = x - cx, dy = y - cy, rr = Math.hypot(dx, dy), b = Math.log(PHI) / (Math.PI / 2), th = Math.atan2(dy, dx);   // derived: the curl's eye a little right of the middle; a golden spiral's growth
  let curl = 0; if (rr < 5.6) { const t = Math.log(Math.max(rr, 0.3) / 0.35) / b - th, d = Math.abs(((t % TAU) + TAU) % TAU - Math.PI) / Math.PI; curl = smooth((d - 0.35) / 0.4); }   // vision: the curl's ridge, a broad band
  const swell = Math.exp(-(((y - 4.4 - 0.8 * Math.sin(x * 0.7)) / 0.9) ** 2));   // vision: a swell rolling under it
  return 0.22 + 0.74 * Math.max(curl, swell * 0.8);   // vision: the field sunk, the figure struck up; the swell a little under the crest
};
/** The League's tide: rings spreading from a drop at the middle. */
export const leagueDie = (u, v) => {
  const x = u + 0.5 - 8, y = v + 0.5 - 8, r = Math.hypot(x, y), rim = rimOf(x, y, r); if (rim !== null) return rim;   // given: the tile's middle
  return 0.22 + 0.74 * Math.max(Math.max(0, Math.cos(r * 2.1)) ** 2 * smooth((6.2 - r) / 1.4), smooth((1 - r) / 0.5));   // vision: the rings three to the die, fading outward, the drop at the heart
};
/** A plate of the metal with the die struck into it: bevelled edge, the die's figure in relief, brushed, lit by height. */
export const plateOf = (metal, die) => (u, v) => {
  const c = METAL_RGB[metal], edge = Math.min(u, v, 15 - u, 15 - v), f = die ? die(u, v) : -1;   // given: a tile's last pixel
  const h = edge === 0 ? 0.35 : f >= 0 ? f : edge === 1 ? 0.72 : 0.58;   // vision: the bevel; the die's relief; the plate round it
  const brush = 0.96 + 0.04 * Math.sin(v * PHI * 2 + golden(u + v * FIB[4]) * 3), sheen = f >= 0 ? 0.6 + 0.62 * h : 0.84 + 0.2 * h;   // vision: brushed; the struck figure brighter than its field
  return [...c.map((x) => Math.min(255, x * brush * sheen)), h];   // given: a channel's top
};
for (const b of STAMPED) { const panel = b.stamp === "theran" ? theranDie : leagueDie;
  CUSTOM.push({ id: b.id, shape: "full", side: plateOf(b.metal, panel), end: plateOf(b.metal, panel), colour: METAL_RGB[b.metal], name: b.name, family: "metal" }); }
// the Theran mint's press: a crafting table of its own (its recipes are the mint's: coin from ingots, stamped blocks
// from nine), iron sides under the refinery's die, a gold die on top
CUSTOM.push({ id: "waterworld:theran_mint_press", shape: "full", side: plateOf("iron", theranDie), end: plateOf("gold", theranDie), colour: METAL_RGB.gold, name: "Theran Mint Press", family: "metal",
  components: { "minecraft:crafting_table": { table_name: "Theran Mint", crafting_tags: ["theran_mint"] } } });
// the League's counter: where coin, emeralds and warranted metal change hands (mod/scripts/bank.js opens its book)
CUSTOM.push({ id: "waterworld:league_counter", shape: "full", side: plateOf("gold", leagueDie), end: plateOf("iron", leagueDie), colour: METAL_RGB.gold, name: "League Counter", family: "metal" });
export const CUSTOM_IDS = new Set(CUSTOM.map((b) => b.id));   // (the great columns' quarters are pushed above, with the carvings)
export const CARVING_KINDS = Object.keys(CARVINGS);
// ---- roof tiles, as the Greeks laid marble and the Therans their blue: flat pan tiles (tegulae) in courses five
// pixels deep, a rounded cover tile (imbrex) over every joint every four pixels, running down the slope; four
// stairs by the way each rises (east, west, south, north) and the ridge
const ROOFS = { theran_marble: { m: "theran" }, blue_glazed: { glaze: [46, 84, 170] } };   // vision: the Therans' white and their blue
const roofTile = (R) => (u, v) => { const x = (u + 0.5) % 4, imbrex = Math.abs(x - 2) < 1.2, course = (v + 0.5) % FIB[4], lip = course > FIB[4] - 1.2;   // derived: a cover tile every four, a course every five
  const h = imbrex ? 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - ((x - 2) / 1.2) ** 2)) : lip ? 0.15 : 0.4 - 0.15 * (course / FIB[4]);   // vision: the tiler's drawing (the courses and cover tiles in a tile's sixteen pixels)
  if (R.m) return over(R.m, u, v, h, 0.84 + 0.22 * h);   // vision: the tiler's drawing (the courses and cover tiles in a tile's sixteen pixels)
  const g = 0.9 + 0.08 * field(u, v, 41 + VK), gloss = imbrex && Math.abs(x - 1.6) < 0.5 ? 1.25 : 1; return [...R.glaze.map((c) => Math.min(255, c * g * gloss * (0.8 + 0.3 * h))), h]; };   // vision: the tiler's drawing (the courses and cover tiles in a tile's sixteen pixels)
export const ROOF_DIRS = ["east", "west", "south", "north"];
// the low roof's layers: a quarter, a half and three quarters of a block, the tiles on top and the stone at the edges, so
// a roof can climb four pixels a block (one in four, the Greek pitch) with no stair's step and no turning
export const ROOF_LAYERS = [4, 8, 12];   // derived: a quarter block's steps
for (const [r, R] of Object.entries(ROOFS)) { const t = roofTile(R), colour = R.m ? MARBLES[R.m].ground : R.glaze, edge = R.m ? PARTS.block(R.m) : (u, v) => [...R.glaze.map((c) => c * 0.8), 0.5];   // vision: the glaze's edge a shade darker
  for (const h of ROOF_LAYERS) CUSTOM.push({ id: `waterworld:${r}_roof_layer_${h}`, shape: `layer_${h}`, side: edge, end: t, colour, name: `${r.replace("_", " ")} roof, ${h} high`, family: "stone" });
  CUSTOM.push({ id: `waterworld:${r}_roof_full`, shape: "full", side: edge, end: t, colour, name: `${r.replace("_", " ")} roof, a whole block`, family: "stone" });
  for (const d of ROOF_DIRS) CUSTOM.push({ id: `waterworld:${r}_roof_${d}`, shape: `roof_${d}`, side: t, end: t, colour, name: `${r.replace("_", " ")} roof tiles (rising ${d})`, family: "stone" });
  CUSTOM.push({ id: `waterworld:${r}_roof_ridge`, shape: "full", side: t, end: t, colour, name: `${r.replace("_", " ")} roof ridge`, family: "stone" }); }
// ---- the great columns, two blocks across: each part a column a block and a half wide, centred on the corner its four
// blocks share, cut into four quarter blocks (q = "ab": a the block's step east, b its step south from the corner's
// north-west block); in the Theran marble, its shaft fluted, its base Attic, its capital Ionic
export const BIG = { shaft: "big_column", base: "big_column_base", capital: "big_capital_ionic" };
const BIG_TEX = { big_column: "shaft", big_column_base: "base", big_capital_ionic: "ionic" };
for (const part of Object.values(BIG)) for (const q of ["00", "10", "01", "11"]) CUSTOM.push({ id: `waterworld:theran_marble_${part}_${q}`, shape: `${part}_${q}`, side: PARTS[BIG_TEX[part]]("theran"), end: PARTS.end("theran"), colour: MARBLES.theran.ground, name: `Theran marble great ${part.replace(/_/g, " ")} (quarter ${q})`, family: "stone" });

// ---- the shapes, as boxes in a block's pixels [x0, y0, z0, x1, y1, z1] (y up), each face mapped onto the matching
// window of its tile; "end" faces (up, down) take the marble's end
const OCT = (y0, y1, r) => { const a = Math.round(r * 0.414 * 2) / 2; return [[8 - r, y0, 8 - a, 8 + r, y1, 8 + a], [8 - a, y0, 8 - r, 8 + a, y1, 8 + r], [8 - r + 1, y0, 8 - r + 1, 8 + r - 1, y1, 8 + r - 1]]; };   // derived: an octagon's prism of three boxes (the round shaft's nearest in boxes)
// the great column's boxes in its own thirty-two pixels (its middle at 16, 16), cut into the four blocks' quarters
function bigShapes() {
  const O = (y0, y1, r) => OCT(y0, y1, r).map(([x0, a, z0, x1, b, z1]) => [x0 + 8, a, z0 + 8, x1 + 8, b, z1 + 8]);   // the octagon about (16, 16)   // given: a block's sixteen pixels; the great column's own thirty-two, its middle at sixteen
  const whole = { big_column: O(0, 16, 12), big_column_base: [[0, 0, 0, 32, 3, 32], ...O(3, 6, 15), ...O(6, 7, 13), ...O(7, 9, 14), ...O(9, 16, 12)], big_capital_ionic: [...O(0, 9, 12), ...O(9, 13, 14), [1, 7, 8, 31, 14, 24], [0, 13, 0, 32, 16, 32]] };   // vision: a shaft twelve out (a block and a half across), the base's plinth the whole two blocks, the volutes' bolster across the east and west
  const out = {};
  for (const [part, boxes] of Object.entries(whole)) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const ox = a * 16, oz = b * 16;   // given: a block's sixteen pixels; the great column's own thirty-two, its middle at sixteen
    out[`${part}_${a}${b}`] = boxes.map(([x0, y0, z0, x1, y1, z1]) => [Math.max(x0, ox) - ox, y0, Math.max(z0, oz) - oz, Math.min(x1, ox + 16) - ox, y1, Math.min(z1, oz + 16) - oz]).filter(([x0, , z0, x1, , z1]) => x1 > x0 && z1 > z0);   // given: a block's sixteen pixels; the great column's own thirty-two, its middle at sixteen
  }
  return out;
}
export const SHAPES = {
  full: null,   // the game's own full block
  shaft: OCT(0, 16, 6),   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  baluster: [[4, 0, 4, 12, 2, 12], ...OCT(2, 4, 2), ...OCT(4, 10, 3.5), ...OCT(10, 13, 2), [4, 13, 4, 12, 14, 12], [3, 14, 3, 13, 16, 13]],   // vision: a turned baluster: a plinth, a neck, the swelling belly, a neck, the collar and the cap a rail runs over   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  minoan_shaft: [...OCT(0, 8, 5), ...OCT(8, 16, 6)],   // Thera's own: wider at the top than the foot   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  base: [[0, 0, 0, 16, 3, 16], [1, 3, 1, 15, 6, 15], [2, 6, 2, 14, 7, 14], [1.5, 7, 1.5, 14.5, 9, 14.5], ...OCT(9, 16, 6)],   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  doric: [...OCT(0, 10, 6), [1, 10, 1, 15, 13, 15], [0, 13, 0, 16, 16, 16]],   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  ionic: [...OCT(0, 11, 6), [1, 7, 1, 15, 14, 15], [0, 14, 0, 16, 16, 16]],   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  corinthian: [...OCT(0, 4, 6), [1.5, 4, 1.5, 14.5, 13, 14.5], [0, 13, 0, 16, 16, 16]],   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
  ...bigShapes(),
  slab: [[0, 0, 0, 16, 8, 16]],   // a slab, the lower half   // given: a block's sixteen pixels
  layer_4: [[0, 0, 0, 16, 4, 16]], layer_8: [[0, 0, 0, 16, 8, 16]], layer_12: [[0, 0, 0, 16, 12, 16]],   // the roof's layers   // vision: the mason's drawing (the Theran stone's figures in a tile's sixteen pixels)
  roof_east: [[0, 0, 0, 16, 8, 16], [8, 8, 0, 16, 16, 16]], roof_west: [[0, 0, 0, 16, 8, 16], [0, 8, 0, 8, 16, 16]],   // a stair: its upper half on the side it rises to   // vision: the tiler's drawing (the courses and cover tiles in a tile's sixteen pixels)
  roof_south: [[0, 0, 0, 16, 8, 16], [0, 8, 8, 16, 16, 16]], roof_north: [[0, 0, 0, 16, 8, 16], [0, 8, 0, 16, 16, 8]],   // vision: the tiler's drawing (the courses and cover tiles in a tile's sixteen pixels)
  minoan: [...OCT(0, 4, 6), [1, 4, 0, 15, 13, 16], [0, 4, 1, 16, 13, 15], [0, 13, 0, 16, 16, 16]],   // the cushion: a rounded square, the abacus over it   // vision: the carver's drawing (the tile's rows, the shapes' boxes, in a block's sixteen pixels)
};
