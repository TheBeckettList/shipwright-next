// Pure. Curved forms built inside the cube: every dome, vault, spire, arch and drum is a quadric,
//   q(p) = (p - c)^T A (p - c) + b . (p - c) - 1 <= 0,
// with A diagonal, its axes golden (a dome's height its radius over phi, an onion's over phi again). A block is
// solid where its middle is inside; it's on the surface where a neighbour's middle isn't; and the surface is
// dressed by its normal (the gradient 2A(p - c) + b): near flat on top, a slab; steep, a full block; between,
// a stair turned down the slope. So the curve is the matrix's, and the blocks only sample it.
import { PHI } from "../core/golden.js";

/** A form: { A: [ax, ay, az], c: [x, y, z], b: [bx, by, bz], clip(p) } -> q(p). */
export const q = (F, x, y, z) => {
  const dx = x - F.c[0], dy = y - F.c[1], dz = z - F.c[2];
  return F.A[0] * dx * dx + F.A[1] * dy * dy + F.A[2] * dz * dz + (F.b?.[0] ?? 0) * dx + (F.b?.[1] ?? 0) * dy + (F.b?.[2] ?? 0) * dz - 1;
};
const grad = (F, x, y, z) => [2 * F.A[0] * (x - F.c[0]) + (F.b?.[0] ?? 0), 2 * F.A[1] * (y - F.c[1]) + (F.b?.[1] ?? 0), 2 * F.A[2] * (z - F.c[2]) + (F.b?.[2] ?? 0)];

// the forms (vision: their golden proportions)
/** A dome over a w x l footprint from height y0: half an ellipsoid, rising the half-width over phi (a saucer) or times phi (an onion). */
export const dome = (x0, z0, w, l, y0, rise = 1 / PHI) => { const rx = w / 2, rz = l / 2, ry = Math.max(rx, rz) * rise * PHI; return { kind: "dome", A: [1 / rx ** 2, 1 / ry ** 2, 1 / rz ** 2], c: [x0 + rx - 0.5, y0 - 0.5, z0 + rz - 0.5], clip: (x, y) => y >= y0 }; };
/** A barrel vault along the longer side: a cylinder (A's long axis zero), half of it. */
export const vault = (x0, z0, w, l, y0) => { const alongX = w >= l, r = (alongX ? l : w) / 2, ry = r / PHI * PHI; return { kind: "vault", A: alongX ? [0, 1 / ry ** 2, 1 / r ** 2] : [1 / r ** 2, 1 / ry ** 2, 0], c: [x0 + w / 2 - 0.5, y0 - 0.5, z0 + l / 2 - 0.5], clip: (x, y, z) => y >= y0 && x >= x0 - 1 && x <= x0 + w && z >= z0 - 1 && z <= z0 + l }; };
/** A spire: a cone from a base of radius r at y0, h high (h = r * phi^3, the golden needle). */   // derived: the forms' own geometry (the quadric's terms)
export const spire = (cx, cz, r, y0, h = r * PHI ** 3) => ({ kind: "spire", cone: true, c: [cx, y0, cz], r, h, clip: (x, y) => y >= y0 && y <= y0 + h });   // derived: the forms' own geometry (the quadric's terms)
/** A round drum (a tower's body): a cylinder about the vertical, r across, from y0 to y1. */
export const drum = (cx, cz, r, y0, y1) => ({ kind: "drum", A: [1 / r ** 2, 0, 1 / r ** 2], c: [cx, y0, cz], clip: (x, y) => y >= y0 && y <= y1 });

const inside = (F, x, y, z) => {
  if (F.clip && !F.clip(x, y, z)) return false;
  if (F.cone) { const t = (y - F.c[1]) / F.h; if (t < 0 || t > 1) return false; const R = F.r * (1 - t); return (x - F.c[0]) ** 2 + (z - F.c[2]) ** 2 <= R * R + 0.25; }   // derived: the forms' own geometry (the quadric's terms)
  return q(F, x, y, z) <= 0;
};
/** Sample a form into blocks: its shell (solid: fill it), dressed by the normal. Returns [[x, y, z, kind, dir]], kind full / slab / stair. */
export function sample(F, { box, solid = false } = {}) {
  const out = [], [x0, y0, z0, x1, y1, z1] = box;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (!inside(F, x, y, z)) continue;
    const shell = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => !inside(F, x + a, y + b, z + c) && !(b === -1 && y === y0));
    if (!shell && !solid) continue;
    let n;
    if (F.cone) { const dx = x - F.c[0], dz = z - F.c[2], d = Math.hypot(dx, dz) || 1; n = [dx / d, F.r / F.h, dz / d]; }
    else n = grad(F, x, y, z);
    const len = Math.hypot(...n) || 1, up = n[1] / len;   // the normal's upward share: 1 flat, 0 a wall
    const above = inside(F, x, y + 1, z);
    const kind = !shell ? "full" : !above && up > 0.92 ? "slab" : !above && up > 0.38 ? "stair" : "full";   // derived: flat past cos 23°, a slope from cos 68° (the stair's own 45° between)
    const dir = Math.abs(n[0]) >= Math.abs(n[2]) ? (n[0] > 0 ? "e" : "w") : n[2] > 0 ? "s" : "n";   // which way it slopes down
    out.push([x, y, z, kind, dir]);
  }
  return out;
}
