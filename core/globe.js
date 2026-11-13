// Pure. The globe: a sphere drawn on an equirectangular map (about 91 blocks a degree, north-south
// everywhere and east-west at the equator), x east in [0, W), z south in [0, H) from the north pole.
//
// Why not Mercator: Mercator never reaches the poles (they're at infinity), so its top and bottom
// can't be joined. Equirectangular reaches them, and both seams are honest:
//   east-west  x wraps: sail east W blocks and you're home (a plain ring)
//   the poles  sail over the top at longitude l and you come down at l + 180, heading the other way:
//              (x, z) -> (x + W/2, -z), and every direction vector is negated: -I, the lost sign
//              (F^4 = -I, the matter/antimatter flip, 6d-to-1d-map). Do it twice and it's undone.
//
// Ships live on the cover: unwrapped coordinates (X, Z) with no seams at all, so their laws are
// plain shears (reversible.js). fold() projects the cover onto the world: Z is taken mod W (a
// meridian is a full circle, W round), and the half beyond a pole is mirrored, shifted half the
// world, and flagged `sheet`. The sheet bit is what the map can't see: the cover is the world's
// double cover, and folding loses exactly that one bit.
import { D, VISION, GIVEN } from "./given.js";
import { mod } from "./fixed.js";

export const W = D.W, H = D.H;

/** The world point under a cover point (blocks, any real numbers). */
export function fold(X, Z) {
  const z = mod(Z, W);
  const sheet = z > H;
  return { x: mod(X + (sheet ? H : 0), W), z: sheet ? W - z : z, sheet };
}
/** A world vector as seen on the cover at a point of `sheet` (and back: it's its own inverse). */
export const onSheet = (v, sheet) => (sheet ? { e: -v.e, s: -v.s } : v);
/** The pole crossing as a map on world points and headings (an involution). */
export const overPole = ({ x, z, heading = 0 }, TURN = VISION.TURN) => ({ x: mod(x + H, W), z: -z, heading: mod(heading + TURN / 2, TURN) });

export const latOf = (z) => 90 - (180 * z) / H;                  // degrees, + north
export const lonOf = (x) => (360 * x) / W - 180;                 // degrees, + east
export const zOfLat = (lat) => ((90 - lat) / 180) * H;
export const xOfLon = (lon) => mod(((lon + 180) / 360) * W, W);
const RAD = Math.PI / 180;                                       // given: degrees to radians
/** How long an east-west block is at this z, as a share of one at the equator (never below the ice line's). */
export const metric = (z) => Math.max(Math.cos(VISION.ICE_LAT * RAD), Math.cos(latOf(z) * RAD));

/** Great-circle distance between two world points, in equatorial blocks (the honest sailing distance). */
export function greatCircle(a, b) {
  const p1 = latOf(a.z) * RAD, p2 = latOf(b.z) * RAD, dl = (lonOf(b.x) - lonOf(a.x)) * RAD;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return (W / Math.PI) * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Shortest east-west step from a to b across the wrap (blocks, signed). */
export const dxWrap = (a, b) => { const d = mod(b - a, W); return d > H ? d - W : d; };

/** The three scales a point lives on: its block, its chunk, its map pixel (a chunk too, by vision). */
export const chunkOf = (x, z) => ({ cx: Math.floor(mod(x, W) / GIVEN.CHUNK), cz: Math.floor(z / GIVEN.CHUNK) });
