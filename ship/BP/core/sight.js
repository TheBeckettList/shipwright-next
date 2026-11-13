// Pure. What a player can see, ring by ring, and what that lets us spend where: the "spectrum" of
// sight. Two facts make it golden:
//
//   resolution  a block d blocks away is about PX_PER_RAD / d screen pixels across, so its 16
//               texels are each PX_PER_RAD / (16 d) pixels: past the distance where a texel falls
//               under a pixel, the next mip (half the texels) shows as much as the eye can take.
//               What can be seen per block falls as 1/d^2
//   equal bands rings whose radii grow by phi (Fibonacci chunks: 1, 2, 3, 5, 8, 13, 21) each hold
//               area growing as d^2. Area times what can be seen per block is the same in every
//               ring: the eye takes in equal detail per golden band, as a spectrum has equal power
//               per octave when it falls as 1/f. So detail work split equally across the rings is
//               spent where it can be seen, and the whole view costs the number of rings: it grows
//               with the log of the view distance, not its square
//
//   spectrum    every texture is built from known whole wavenumbers (world/textures.js), so for
//               each ring the highest that still shows (the mip's Nyquist, half its size) is
//               known exactly. Past it a family is drawn by its mean colour (the far chunks' closed
//               form): nothing shimmers, and nothing is drawn that can't be seen
//
// "Light detailed work" (particles, ambient folk, flipbooks, small moving things) is budgeted per
// ring: an equal share each, as many items as the share buys at the ring's resolution.
import { VISION, GIVEN } from "./given.js";
import { FIB, PHI } from "./golden.js";

export const SIGHT = Object.freeze({
  PX_PER_RAD: 880,       // vision: a 1080-line screen over about 70 degrees of view
  TEXELS: 16,            // given: Minecraft's tile
  RINGS: FIB.slice(1, 8),   // derived: Fibonacci chunk radii, 1 to 21 (phi apart, to whole chunks)
  ITEM_MS: 0.004,        // vision: a light item's cost a tick (a particle, a flip), in the device's ms
});

/** Screen pixels a texel takes at d blocks. */
export const texelPx = (d) => SIGHT.PX_PER_RAD / (SIGHT.TEXELS * Math.max(1, d));
/** The mip a block at d blocks needs: 0 (every texel) up to the last halving (one texel). */
export const mipAt = (d) => Math.max(0, Math.min(Math.log2(SIGHT.TEXELS), Math.ceil(Math.log2(1 / Math.min(1, texelPx(d))))));
/** The highest whole wavenumber across a tile that still shows at mip m: the Nyquist of the tile halved m times. */
export const nyquist = (m) => (SIGHT.TEXELS >> m) / 2;

/** The rings out to `far` chunks: [{ k, inner, outer (chunks), area (blocks^2), mip, seen (texels the eye takes in), share }]. */
export function rings(far = VISION.LOD.FAR) {
  const C = GIVEN.CHUNK, R = SIGHT.RINGS.filter((r) => r <= far), out = [];
  let inner = 0;
  for (const [k, r] of R.entries()) {
    const a = inner * C, b = r * C, area = Math.PI * (b * b - a * a), mid = (a + b) / 2 || C / 2;
    // what the eye takes in: texels resolvable per block (texelPx^2 * 256, at most 256), times the ring's blocks
    let seen = 0; const steps = 16;   // vision: steps across the ring to sum it
    for (let s = 0; s < steps; s++) { const d = a + (b - a) * ((s + 0.5) / steps), ring = 2 * Math.PI * d * ((b - a) / steps); seen += ring * Math.min(SIGHT.TEXELS ** 2, (SIGHT.PX_PER_RAD / Math.max(1, d)) ** 2); }
    out.push({ k, inner, outer: r, area: Math.round(area), mip: mipAt(mid), seen });
    inner = r;
  }
  const tot = out.reduce((s, x) => s + x.seen, 0);
  out.forEach((x) => (x.share = x.seen / tot));
  return out;
}
/** Light items each ring can carry from `lifeMs` a tick: the budget split as the eye takes the view in (equal shares in the golden rings past where sight saturates). */
export function detailBudget(lifeMs, far = VISION.LOD.FAR) {
  return rings(far).map((x) => { const ms = lifeMs * x.share, items = Math.floor(ms / SIGHT.ITEM_MS); return { ...x, ms, items, perChunk: +(items / (x.area / GIVEN.CHUNK ** 2)).toFixed(2) }; });   // vision: two places
}
/** For a family whose highest wavenumber across the tile is kmax: the first ring where it no longer shows (drawn by its mean beyond). */
export const fadesAt = (kmax, far = VISION.LOD.FAR) => rings(far).find((x) => nyquist(x.mip) < kmax)?.k ?? null;
export { PHI };
