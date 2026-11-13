// Pure. Frames as matrices: every way a build can be set down on the block grid is one of the eight
// symmetries of the square (four quarter turns, each with or without a mirror), a 2x2 integer matrix
// acting on (x, z). Composing two placements is multiplying their matrices; nothing else converts.
// (frame.js's rule, carried to builds: no position is absolute; the map from frame A to frame B is
// all there is.)
//
// Minecraft: x east, z south, y up. R, the quarter turn, takes east to south (clockwise from above).
// M, the mirror, flips x (east <-> west). yardarch's Canvas.place(u, w, turns) is R^turns; this adds
// the mirror, so a build can be drawn once and set down port or starboard.
//
// Block states hold directions in five different codes; the sim decodes each to a vector, carries the
// vector through the matrix, and encodes it back. A directional state it doesn't know is reported, not
// guessed (gates.js turns that into a warning).
import { mul, eq, det2 as det, I2 } from "./field.js";
const Id = () => I2;

export const R = Object.freeze([[0, -1], [1, 0]]);   // given: a quarter turn, east -> south
export const M = Object.freeze([[-1, 0], [0, 1]]);   // given: the mirror, east <-> west
export const D4 = (() => {
  const out = [];
  for (const m of [Id(2), M]) for (let k = 0; k < 4; k++) {   // given: four quarter turns
    let A = m;
    for (let j = 0; j < k; j++) A = mul(R, A);
    out.push({ name: `${m === M ? "mirror+" : ""}turn${k}`, A, turns: k, mirror: m === M });
  }
  return out;
})();
/** The transform for `turns` quarter turns, mirrored first if asked. */
export const placement = (turns = 0, mirror = false) => D4.find((g) => g.turns === ((turns % 4) + 4) % 4 && g.mirror === mirror).A;   // given: four quarter turns
export const xz = (A, x, z) => ({ x: A[0][0] * x + A[0][1] * z, z: A[1][0] * x + A[1][1] * z });
export const compose = (A, B) => mul(A, B);           // A after B
export const isMirror = (A) => det(A) < 0;

/** The group's laws, checked: R^4 = I, M^2 = I, M R M = R^-1, closure (eight elements). */   // given
export function groupLaws() {
  const R4 = mul(mul(R, R), mul(R, R));
  const Rinv = mul(R, mul(R, R));
  const closed = D4.every((a) => D4.every((b) => D4.some((c) => eq(c.A, mul(a.A, b.A)))));
  return { r4: eq(R4, Id(2)), m2: eq(mul(M, M), Id(2)), mrm: eq(mul(M, mul(R, M)), Rinv), closed, size: D4.length };
}

// ---------------------------------------------------------------- directions in block states

const V = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
const nameOf = (v) => Object.keys(V).find((k) => V[k][0] === v.x && V[k][1] === v.z);
const table = (names) => ({ dec: (n) => V[names[n]], enc: (v) => names.indexOf(nameOf(v)) });

// Each code: a decoder to a vector (or null for up/down, which turns leave alone) and an encoder.
export const CODES = {
  weirdo_direction: table(["east", "west", "south", "north"]),                         // given: stairs
  facing_direction: { dec: (n) => [null, null, V.north, V.south, V.west, V.east][n], enc: (v) => ({ north: 2, south: 3, west: 4, east: 5 })[nameOf(v)] },  // given
  "minecraft:cardinal_direction": { dec: (s) => V[s], enc: (v) => nameOf(v) },       // given
  "minecraft:block_face": { dec: (s) => V[s] ?? null, enc: (v) => nameOf(v) },        // given: up/down kept
  torch_facing_direction: { dec: (s) => V[s] ?? null, enc: (v) => nameOf(v) },        // given: top/unknown kept
  direction: table(["south", "west", "north", "east"]),                                // given: beds, bells, looms, hives
  ground_sign_direction: {                                                             // given: 16 steps, 0 south, 4 west
    dec: (n) => ({ ang: (n * Math.PI) / 8 }),   // given: sign directions are sixteenths of a turn
    enc: null,
  },
};
// Trapdoors keep `direction` in the stairs' order (east, west, south, north). vision: unverified in
// game; the sim flags trapdoor turns until a showcase confirms it.
const TRAPDOOR_DIR = table(["east", "west", "south", "north"]);
/** Keys the game works out itself after placing (fence and wall links, stair corners): dropped, not carried. */
export const RECOMPUTED = /^(minecraft:connection_|wall_connection_type_|minecraft:corner$|wall_post_bit$)/;
/** Directional keys the sim doesn't carry yet. */
export const UNHANDLED = new Set(["rail_direction", "coral_direction", "coral_fan_direction", "multi_face_direction_bits", "huge_mushroom_bits"]);

/**
 * A block's states, carried through placement A. Returns { states, unhandled: [keys] }.
 * pillar_axis swaps x and z on a quarter turn; a door's hinge flips in a mirror.
 */
export function turnStates(id, states = {}, A) {
  const out = {}, unhandled = [];
  const trap = /trapdoor/.test(id);
  for (const [k, v] of Object.entries(states)) {
    if (RECOMPUTED.test(k)) continue;
    if (UNHANDLED.has(k)) { unhandled.push(k); out[k] = v; continue; }
    if (k === "pillar_axis") {
      if (v === "y") out[k] = v;
      else { const p = xz(A, v === "x" ? 1 : 0, v === "z" ? 1 : 0); out[k] = p.x !== 0 ? "x" : "z"; }
      continue;
    }
    if (k === "door_hinge_bit") { out[k] = isMirror(A) ? !v : v; continue; }
    if (k === "ground_sign_direction") {
      const a = (v * Math.PI) / 8, p = xz(A, -Math.sin(a), Math.cos(a));   // given: sixteenths of a turn
      out[k] = ((Math.round((Math.atan2(-p.x, p.z) * 8) / Math.PI) % 16) + 16) % 16;   // given: sixteenths of a turn
      continue;
    }
    const code = k === "direction" && trap ? TRAPDOOR_DIR : CODES[k];
    if (!code) { out[k] = v; continue; }
    const d = code.dec(v);
    if (!d) { out[k] = v; continue; }
    const p = xz(A, d[0], d[1]);
    out[k] = code.enc(p);
    if (trap && k === "direction") unhandled.push("trapdoor direction (unverified)");
  }
  return { states: out, unhandled };
}
