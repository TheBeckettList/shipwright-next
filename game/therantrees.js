// inherency: plan (the Theran garden biome: claude/thera-garden.md)
// Pure. The Therans' own trees, in vanilla blocks, each a voxel shape grown from a seed:
//   lefka       the white poplar (Populus alba; Greek λεύκα): a tall column of a tree, its bark white with dark
//               marks (birch), its crown the poplars' autumn amber, gold and red with a few silver leaves (the white
//               poplar's undersides)
//   elia        the olive (ελιά): low, its grey trunk twisting, a broad flat crown of silver-green (pale oak's)
//   kyparissi   the Mediterranean cypress (κυπαρίσσι): a dark flame, narrow and tall, at junctions and graves
// and the garden's ground: wildflowers, leaf litter under the poplars, flowering azalea on walls (the island's
// bougainvillea), bushes and firefly bushes.
import { hashAt } from "../core/noise.js";
import { FIB, PHI } from "../core/golden.js";

const h01 = (x, y, z, k) => hashAt(x * 7919 + z, y * 104729 + z * 31, k);   // a voxel's own draw, 0..1
/** The amber crown's mix: orange, gold, red, and the silver of the white poplar's undersides. */
const AMBER = [["minecraft:orange_poplar_leaves", 0.5], ["minecraft:yellow_poplar_leaves", 0.3], ["minecraft:red_poplar_leaves", 0.12], ["minecraft:pale_oak_leaves", 0.08]];   // vision: the crown's shares
const pick = (mix, u) => { let a = 0; for (const [id, p] of mix) { a += p; if (u < a) return id; } return mix[mix.length - 1][0]; };

/** A tree's voxels: [{ x, y, z, id }] from its foot (0, 0, 0). kind: lefka | elia | kyparissi; seed: any integer. */
export function theranTree(kind, seed) {
  const out = [], put = (x, y, z, id) => out.push({ x, y, z, id }), u = (k) => hashAt(seed, k, 701);
  if (kind === "lefka") {
    const H = FIB[6] + Math.floor(u(1) * (FIB[7] - FIB[6] + 1)), R = 2 + (u(2) < 1 / PHI ? 1 : 0), base = Math.round(H / PHI ** 3);   // vision: thirteen to twenty-one tall; a crown two or three across the middle; derived: it starts a golden cube's share up
    for (let y = 0; y < H - 1; y++) put(0, y, 0, "minecraft:birch_log");
    for (let y = base; y <= H; y++) { const t = (y - base) / (H - base), r = R * Math.sin(Math.PI * Math.min(0.999, 0.15 + t * 0.85)) ** 0.5 + 0.5;   // a full column, widest a little above its middle, drawn in at the top
      for (let x = -R - 1; x <= R + 1; x++) for (let z = -R - 1; z <= R + 1; z++) { const d = Math.hypot(x, z); if (d > r || (x === 0 && z === 0 && y < H - 1)) continue; if (d > r - 0.8 && h01(x, y, z, seed) < 0.3) continue; put(x, y, z, pick(AMBER, h01(x, y, z, seed + 1))); } }
    for (let k = 0; k < 3; k++) { const a = u(10 + k) * 2 * Math.PI, y = base + 1 + Math.floor(u(20 + k) * (H - base - 3)); put(Math.round(Math.cos(a)), y, Math.round(Math.sin(a)), "minecraft:birch_log"); }   // three stubs of branch, white in the gold
  } else if (kind === "elia") {
    const H = FIB[4] + Math.floor(u(1) * (FIB[5] - FIB[4] + 1)), R = 3 + (u(2) < 1 / PHI ? 1 : 0);   // vision: five to eight tall, its crown three or four out
    let x = 0, z = 0; const lean = u(3) * 2 * Math.PI;
    const trunk = Math.round(H / PHI);   // derived: the crown starts a golden share up
    for (let y = 0; y < trunk; y++) { put(x, y, z, "minecraft:pale_oak_wood"); if (y && h01(0, y, 0, seed) < 1 / PHI) { x += Math.round(Math.cos(lean + y)); z += Math.round(Math.sin(lean + y)); put(x, y, z, "minecraft:pale_oak_wood"); } }   // the trunk twists: a golden share of its rises step aside
    const top = trunk;
    for (let k = 0; k < 3; k++) { const a = lean + (k * 2 * Math.PI) / 3; for (let s = 1; s <= 2; s++) put(x + Math.round(Math.cos(a) * s), top + (s > 1 ? 1 : 0), z + Math.round(Math.sin(a) * s), "minecraft:pale_oak_wood"); }   // three limbs
    const crown = top + FIB[4] - 1 + (u(4) < 1 / PHI ? 1 : 0);   // vision: a crown four or five deep
    for (let y = top - 1; y <= crown; y++) { const t = (y - top + 1) / Math.max(1, crown - top + 1), r = R * Math.sqrt(Math.max(0, 1 - (2 * t - 0.7) ** 2)) + 0.4;   // a broad crown, rounded, fullest low
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { if (Math.hypot(a, b) > r || h01(a, y, b, seed) < 0.22) continue; put(x + a, y, z + b, h01(a, y, b, seed + 2) < 0.12 ? "minecraft:azalea_leaves" : "minecraft:pale_oak_leaves"); } }   // vision: holes in a fifth of it; an eighth of the leaves the deeper green
  } else if (kind === "kyparissi") {
    const H = FIB[5] + Math.floor(u(1) * (FIB[6] - FIB[5] + 1));   // vision: eight to thirteen tall
    for (let y = 0; y < H - 1; y++) put(0, y, 0, "minecraft:spruce_log");
    for (let y = 1; y <= H; y++) { const t = y / H, r = t < 0.12 ? 0 : 1.5 * Math.sin(Math.PI * t) ** 0.5 * (1 - t * 0.35);   // a flame: swelling low, drawn to a point
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { if ((a || b || y >= H - 1) && Math.hypot(a, b) <= r) put(a, y, b, "minecraft:spruce_leaves"); } }
    put(0, H, 0, "minecraft:spruce_leaves");
  }
  return out;
}

/** The garden's floor under and between the trees, by a column's own draw: { id } or null (bare grass). */
export function gardenFloor(x, z, nearTree) {
  const u = hashAt(x, z, 709);
  if (nearTree === "lefka" && u < 1 / PHI) return "minecraft:leaf_litter";   // under the poplars, their leaves
  if (u < 1 / PHI ** 4) return "minecraft:wildflowers";
  if (u < 1 / PHI ** 4 + 1 / PHI ** 6) return "minecraft:bush";
  if (u < 1 / PHI ** 4 + 1 / PHI ** 6 + 1 / PHI ** 8) return "minecraft:firefly_bush";
  return null;
}
export const THERAN_TREES = ["lefka", "elia", "kyparissi"];

// ---- the Horaia: the Therans' central tree, on the island in the cone's round lake. Named for the Horai (Ὧραι),
// the Greek goddesses of the seasons who kept the year's turning: its crown turns with the sim's year
// (core/clock.js): pink blossom in spring, deep green and flowering in summer, the poplars' amber and red in
// autumn, silver in winter. A white trunk three across, roots spread over the island, great limbs forking.
export const HORAIA = Object.freeze({ H: FIB[8], R: FIB[6], TRUNK: FIB[7] });   // derived: thirty-four high, a crown thirteen out, the trunk clear for twenty-one
/** The Horaia's voxels: [{ x, y, z, id, leaf? }]; leaf marks the crown's blocks (the season swaps them). */
export function horaia(seed = 1) {
  const out = [], put = (x, y, z, id, leaf = false) => out.push({ x, y, z, id, leaf }), { H, R, TRUNK } = HORAIA, u = (k) => hashAt(seed, k, 739), BARK = "minecraft:birch_wood", CORE = "minecraft:stripped_birch_wood";
  for (let y = 0; y < TRUNK; y++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(a, y, b, a || b ? BARK : CORE);   // the trunk, three across, white
  for (let k = 0; k < FIB[4]; k++) { const a = (k * 2 * Math.PI) / FIB[4] + u(k); for (let s = 2; s <= 5; s++) put(Math.round(Math.cos(a) * s), s > 3 ? -1 : 0, Math.round(Math.sin(a) * s), BARK); }   // vision: five roots spreading over the ground, out to five
  const limbs = [];
  for (let k = 0; k < FIB[5]; k++) { const a = k * Math.PI * (3 - Math.sqrt(5)), up = TRUNK - 3 + (k % 3) * 2, len = R - 3 - (k % 2) * 2;   // given: the golden angle; vision: eight great limbs, rising from near the trunk's top
    for (let s = 1; s <= len; s++) { const x = Math.round(Math.cos(a) * s), z = Math.round(Math.sin(a) * s), y = up + Math.round(s / PHI); put(x, y, z, BARK); if (s === len) limbs.push([x, y, z]); } }   // each climbing a block in a golden share of its run
  for (let y = TRUNK; y < TRUNK + 5; y++) put(0, y, 0, BARK);   // the leader
  // the crown: a broad dome over the limbs' ends, holes left by a draw so the light comes through
  const top = H, base = TRUNK - 2;
  for (let y = base; y <= top; y++) { const t = (y - base) / (top - base), r = R * Math.sqrt(Math.max(0, 1 - (t * 1.05 - 0.05) ** 2));
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) { const d = Math.hypot(x, z); if (d > r || h01(x, y, z, seed + 9) < 0.18) continue; if (d > r - 2.5 || limbs.some(([a, b, c]) => Math.hypot(x - a, y - b, z - c) < 4)) put(x, y, z, "minecraft:azalea_leaves", true); } }   // vision: a shell two and a half deep, filled round the limbs' ends; a fifth left open
  return out;
}
/** The crown's leaf for a season at a voxel (each season its own mix, drawn by the voxel's own hash). */
export const HORAI_MIX = Object.freeze({
  spring: [["minecraft:cherry_leaves", 0.8], ["minecraft:flowering_azalea_leaves", 0.2]],
  summer: [["minecraft:azalea_leaves", 0.6], ["minecraft:flowering_azalea_leaves", 0.4]],
  autumn: AMBER,
  winter: [["minecraft:pale_oak_leaves", 0.8], ["minecraft:air", 0.2]],
});   // vision: blossom, green and flower, amber, silver thinning
export const horaiLeaf = (season, x, y, z) => pick(HORAI_MIX[season] ?? HORAI_MIX.summer, h01(x, y, z, 743));
