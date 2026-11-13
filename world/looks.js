// Pure. The cultures' looks: what each people dyes, and the motif it owns.
//
//   grouped   each climate's dye stuffs (what grows or digs there) make a shared palette: the cold
//             north's woad, lichen and bone; the temperate lands' madder, weld and walnut; the dry
//             lands' ochre, red earth and indigo; the tropics' indigo, turmeric and mangrove bark.
//             A tradition dyes from its own group's palette (vanilla's 16 dyes, chosen to match)
//   special   every tradition owns one glazed terracotta, drawn with its motif (and the Therans
//             two, and the League one): a craft pattern of its own, in the spirit of real ones.
//             Glazed terracotta turns with how it's placed, so each tile is a quarter of its motif,
//             centred on its corner: four set round a point make the whole motif, and a floor or
//             a frieze of them repeats it as its makers would. The rest are golden Truchet tiles
//
// A motif is ink 0..1 at (X, Y) pixels from the motif's centre, for |X|, |Y| up to 16.
import { PHI, golden } from "../core/golden.js";

const TAU = 2 * Math.PI;
// vision: each climate's dyes, as vanilla's
export const PALETTES = {
  cold: { dyes: ["blue", "light_gray", "white", "brown"], from: "woad, lichen, bone and bark" },
  temperate: { dyes: ["red", "yellow", "blue", "brown"], from: "madder, weld, woad and walnut" },
  dry: { dyes: ["orange", "red", "blue", "white"], from: "ochre, red earth, indigo and lime" },
  tropical: { dyes: ["blue", "yellow", "brown", "black"], from: "indigo, turmeric, mangrove bark and soot" },
  northwest: { dyes: ["red", "black", "cyan", "white"], from: "red ochre, charcoal, copper green and shell" },
};
// vision: each tradition's group, its owned glazed terracotta and its motif
export const LOOKS = {
  norse: { group: "cold", glazed: "red", motif: "interlace", note: "two strands knotted over and under" },
  arctic: { group: "cold", glazed: "light_gray", motif: "beadwork", note: "stepped diamonds in two-pixel beads" },
  birchbark: { group: "cold", glazed: "brown", motif: "double_curve", note: "two curls mirrored, as bitten and quilled on bark" },
  european: { group: "temperate", glazed: "yellow", motif: "quatrefoil", note: "the four-lobed tracery of a rose window" },
  japanese: { group: "temperate", glazed: "cyan", motif: "seigaiha", note: "blue sea waves, arcs in scales" },
  east_asian: { group: "temperate", glazed: "green", motif: "fret", note: "the endless key fret, square turning in square" },
  indian_ocean: { group: "dry", glazed: "magenta", motif: "buta", note: "the block-printed teardrop, its curl a golden one" },
  dugout: { group: "northwest", glazed: "black", motif: "diamonds", note: "the nested diamonds and zigzags of Ravenstail weaving" },
  pacific: { group: "tropical", glazed: "orange", motif: "tapa", note: "the bark cloth's rows of teeth and bands" },
  shallow: { group: "tropical", glazed: "lime", motif: "kawung", note: "four ovals round a centre, as in batik" },
};
export const SPECIAL = {
  therans: [{ glazed: "blue", motif: "spiral", note: "the running golden spiral of the frescoes" }, { glazed: "light_blue", motif: "wave", note: "the Akrotiri wave scroll" }],
  league: [{ glazed: "purple", motif: "rose", note: "a rose of twelve rays, one for each city-state" }],
};
// vision: which way each tradition sets the materials that have an axis (stood: along y; laid: along x or z), and why
export const ORIENT = {
  norse: { logs: "laid", hay_block: "laid", why: "log walls laid course on course, turf and thatch laid" },
  european: { logs: "stood", quartz_pillar: "stood", hay_block: "laid", why: "timber framing stands its posts; thatch laid on the roof" },
  birchbark: { logs: "stood", bamboo_block: "stood", why: "poles stood in a ring under the bark" },
  pacific: { bamboo_block: "laid", logs: "stood", hay_block: "laid", why: "floors of laid poles on stood posts, thatch laid" },
  indian_ocean: { logs: "stood", hay_block: "stood", bamboo_block: "laid", why: "stood posts, palm-leaf screens bound upright, laid poles for floors" },
  east_asian: { bamboo_block: "stood", logs: "stood", why: "posts and bamboo screens stood" },
  japanese: { bamboo_block: "stood", hay_block: "laid", logs: "stood", why: "stood posts and bamboo, thatch laid thick" },
  dugout: { logs: "laid", hay_block: "stood", why: "laid logs at the water, reed screens stood" },
  shallow: { bamboo_block: "laid", logs: "stood", why: "stilts stood in the mud, floors of laid bamboo" },
  arctic: { bone_block: "stood", logs: "laid", why: "whalebone ribs stood for the frame, driftwood laid" },
  therans: { quartz_pillar: "stood", basalt: "laid", deepslate: "laid", why: "fluted columns stood; the island's own lava laid as ashlar" },
};
/** Which way a tradition sets a material ("stood", "laid", or null if it doesn't use it that way). */
export const orientOf = (tradition, id) => { const o = ORIENT[tradition] ?? {}, n = id.replace(/^\w+:/, ""); return o[n] ?? (/_log$/.test(n) ? o.logs : null) ?? null; };
const owners = new Map([...Object.entries(LOOKS).map(([t, l]) => [l.glazed, { owner: t, ...l }]), ...Object.entries(SPECIAL).flatMap(([o, list]) => list.map((l) => [l.glazed, { owner: o, ...l }]))]);
/** Who owns a glazed terracotta's colour, and its motif (null: a golden Truchet tile). */
export const ownerOf = (dye) => owners.get(dye) ?? null;
/** A tradition's dyes: its group's palette. */
export const dyesOf = (tradition) => PALETTES[LOOKS[tradition]?.group ?? "temperate"].dyes;

const band = (d, w) => Math.max(0, 1 - Math.abs(d) / w);   // a line of half-width w
/** The motifs: ink 0..1 at (X, Y) from the centre. */
export const MOTIFS = {
  spiral: (X, Y) => { const r = Math.hypot(X, Y) + 0.01, th = Math.atan2(Y, X), s = (Math.log(r) / Math.log(PHI) - (2 * th) / Math.PI) % 2; return r < 15 ? band(((s % 1) + 1.5) % 1 - 0.5, 0.18) : band(r - 15.3, 0.7); },   // derived: r = phi^(2 theta / pi), the golden spiral; vision: its line's width, the frame
  wave: (X, Y) => { const y0 = 4 * Math.sin((TAU * X) / 16), curl = Math.hypot(((X % 8) + 8) % 8 - 4, Y - y0 - 3); return Math.max(band(Y - y0, 0.9), band(curl - 2.2, 0.6) * (Y > y0 ? 1 : 0), band(Math.abs(Y) - 14.5, 0.8)); },   // vision: the scroll's swing, its curls, the border
  interlace: (X, Y) => { const a = Y - 6 * Math.sin((Math.PI * X) / 8), b = Y + 6 * Math.sin((Math.PI * X) / 8), over = Math.sin((Math.PI * X) / 8) * Math.cos((Math.PI * X) / 16) > 0; const ia = band(a, 1.6), ib = band(b, 1.6); return over ? Math.max(ia, ib * (ia > 0.2 ? 0 : 1)) : Math.max(ib, ia * (ib > 0.2 ? 0 : 1)); },   // vision: the strands' swing and width; over and under by turns
  beadwork: (X, Y) => { const bx = Math.floor(X / 2), by = Math.floor(Y / 2), d = Math.abs(bx) + Math.abs(by); return d % 4 === 0 || (d % 4 === 2 && (bx + by) % 2 === 0) ? 1 : 0; },   // vision: two-pixel beads, diamonds four beads apart
  double_curve: (X, Y) => { const ax = Math.abs(X), r = Math.hypot(ax - 6, Y + 2), th = Math.atan2(Y + 2, ax - 6); return Math.max(band(r - (2 + th / Math.PI + 2), 0.8) * (r < 6 ? 1 : 0), band(ax, 0.8) * (Y > 2 && Y < 13 ? 1 : 0)); },   // vision: the curls' centre and growth, the stem
  quatrefoil: (X, Y) => { const r = Math.hypot(X, Y), th = Math.atan2(Y, X), R = 9 * (1 + 0.28 * Math.cos(4 * th)); return Math.max(band(r - R, 0.9), band(r - 3, 0.8), band(Math.max(Math.abs(X), Math.abs(Y)) - 15, 0.8)); },   // vision: the lobes' size and depth, the eye, the frame
  seigaiha: (X, Y) => { let ink = 0; for (const [cx, cy] of [[0, 8], [-8, 0], [8, 0], [0, -8], [-8, 16], [8, 16], [0, 24], [-16, 8], [16, 8]]) { const d = Math.hypot(X - cx, Y - cy); if (d < 8 && Y <= cy) ink = band((d % 2.6) - 1.3, 0.55); } return ink; },   // vision: scales eight apart, arcs every 2.6 pixels
  fret: (X, Y) => { const m = Math.max(Math.abs(X), Math.abs(Y)), ring = Math.floor(m / 4), gap = (ring % 4) === Math.floor(((Math.atan2(Y, X) / TAU + 1) % 1) * 4); return m % 4 < 1.6 && !gap ? 1 : 0; },   // vision: rings four apart, each with a gap a quarter on from the last
  buta: (X, Y) => { const x = X + 2, y = Y - 1, e = Math.hypot(x / 7, (y * PHI) / 7), tip = Math.hypot(x - 5, y + 6); return Math.max(band(e - 1, 0.12), band(e - 0.55, 0.12), band(tip - 2.5, 0.7) * (x > 3 ? 1 : 0)); },   // derived: an ellipse of aspect phi; vision: its size, inner line, the curl at its tip
  diamonds: (X, Y) => { const d = Math.abs(X) + Math.abs(Y); return d % 6 < 2 ? 1 : (Math.abs(X) < 1 && Math.abs(Y) < 1 ? 1 : 0); },   // vision: diamonds six apart
  tapa: (X, Y) => { const row = Math.floor((Y + 16) / 8), t = (((X + 16) % 4) + 4) % 4, yy = (((Y + 16) % 8) + 8) % 8; return row % 2 ? (yy < 4 - t || yy > 4 + t ? 0 : 1) * (yy > 1 && yy < 7 ? 1 : 0) : band(yy - 4, 1); },   // vision: rows of teeth eight high, bands between
  kawung: (X, Y) => { let ink = 0; for (const a of [0.25, 0.75, 1.25, 1.75]) { const cx = 6 * Math.cos(a * Math.PI), cy = 6 * Math.sin(a * Math.PI), dx = X - cx, dy = Y - cy, u = dx * Math.cos(a * Math.PI) + dy * Math.sin(a * Math.PI), v = -dx * Math.sin(a * Math.PI) + dy * Math.cos(a * Math.PI); ink = Math.max(ink, band(Math.hypot(u / 5, v / 3) - 1, 0.15)); } return Math.max(ink, band(Math.hypot(X, Y) - 1, 0.8)); },   // vision: four ovals, their size
  rose: (X, Y) => { const r = Math.hypot(X, Y), th = Math.atan2(Y, X); return Math.max(r < 13 && r > 2 ? band(Math.sin(6 * th) * r * 0.5, 0.7) : 0, band(r - 13.5, 0.7), band(r - 1.5, 0.8)); },   // derived: twelve rays (sin 6 theta); vision: the rose's size, ring and hub
};
/** A glazed tile's ink at pixel (u, v): the motif's quarter, its centre at the tile's corner. */
export const motifAt = (motif, u, v) => MOTIFS[motif](u + 0.5, v + 0.5);
export { golden };
