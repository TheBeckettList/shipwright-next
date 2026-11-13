// Pure. The resource pack's look: a blank slate but for vanilla's names, drawn from the golden law
// (core/golden.js) and seen by the sim at no cost (a texture is made once; a texel is one lookup).
// The spec, resource by resource, is SPEC below; the method is three ideas:
//
//   1. solid, not painted. A block is a cube cut from one 3D field that repeats every 16 pixels in
//      x, y and z, with whole (Fibonacci) wavenumbers. Its faces are slices of that field, so a
//      vein, a bed or a grain runs on round every edge and corner, and on into the block above or
//      beside: a wall or a cliff reads as one carved mass, not a grid of stamps. Perspective comes
//      for free: what the eye sees round a corner is what the field holds there
//   2. lit by its own relief. Each pixel has a height (from the same field); the tile is shaded by
//      its slope, light from the upper left, gathers shadow in its hollows (the cavity), catches light on
//      its crests, and casts shadows from its ridges into what lies below them (a march toward the light),
//      so stones dome, joints sink, bark ridges stand and flutes round.
//      Baked once: the game's per-face shade does the rest, and no shader runs
//   3. varied in sets. Loose stuff (cobbles, gravel, clods, leaves, grains, snow, wool) comes in
//      five variants (a Fibonacci number): Fibonacci-lattice points jittered by the golden
//      sequence, those near the edges kept, so every variant meets every other seamlessly and no
//      two are the same. Lengths (boards, bricks, beds, rings, ridges) come from the Fibonacci
//      word, which never repeats. Glazed terracotta is a Truchet tile at golden radii: placed
//      turned, a floor of them draws spirals
//
// Faces: "top", "side", "bottom". Water turns 8 frames (the trit breath), prismarine 48 (the 5D
// string's return, 3n): both loop exactly, turned by the client. A tile's mips (halvings to one
// pixel) are its LOD: the far chunks are drawn in its mean colour.
import { PHI, GOLDEN_ANGLE, FIB, word, golden, cuts, pieceAt, lattice, cellsOn, truchet } from "../core/golden.js";
import { stringFrames, turing, recordLattice } from "../core/patterns.js";
import { ownerOf, motifAt } from "./looks.js";

export const TEXTURE = Object.freeze({
  N: 16,                     // given: Minecraft's tile, in pixels
  WATER_FRAMES: 8,           // derived: the trit breath (the golden line on a Mobius loop of four)
  LAYERS: [2, 3, 5],         // derived: three layers' variant counts, coprime Fibonacci numbers: 30 combinations, each reached once (the Chinese remainder)
  MACRO: 0.07,               // vision: the broad swell's strength
  MESO: 0.13,                // vision: an accent's strength
  MICRO: 0.035,              // vision: the fine grain's strength
  TRAINS: [[1, 1], [2, 1], [1, 2], [3, 2]],   // derived: the water's wave trains, Fibonacci pairs as wavenumbers across a tile
  FOAM: 1 - 1 / PHI ** 4,    // derived: crests in the golden fourth-power share break white
  LIGHT: 0.16,               // vision: how hard a pixel's slope shades it
  AO_R: 2,                   // vision: the cavity's neighbourhood, five pixels across
  CAVITY: 0.42,              // vision: how dark a hollow gathers (per unit of height under its neighbourhood)
  CREST: 0.22,               // vision: how bright a crest catches the light
  DEPTH: 3,                  // vision: the relief's full height, in pixels (the shadow's scale)
  ELEV: 0.62,                // derived: the light's rise per pixel, about 1/phi (an elevation of some 32 degrees)
  MARCH: 4,                  // vision: a shadow reaches four pixels at most
  SHADOW: 0.82,              // vision: how dark a cast shadow falls
  KEEP_EDGE: 3,              // vision: pixels from an edge where a variant keeps the shared points (so variants meet seamlessly)
});
export const VARIANTS = TEXTURE.LAYERS.reduce((a, b) => a * b, 1);   // derived: 30
export const STRING_FRAMES = 3 * TEXTURE.N;   // derived: the string's return
const N = TEXTURE.N, TAU = 2 * Math.PI, frac = (x) => x - Math.floor(x);

// colours from the name: dyes are vanilla's; the rest are this pack's palette
export const DYE = { white: [233, 236, 236], orange: [240, 118, 19], magenta: [189, 68, 179], light_blue: [58, 175, 217], yellow: [248, 197, 39], lime: [112, 185, 25], pink: [237, 141, 172], gray: [62, 68, 71],   // given: vanilla's dye colours (as its wool shows them)
  light_gray: [142, 142, 134], cyan: [21, 137, 145], purple: [121, 42, 172], blue: [53, 57, 157], brown: [114, 71, 40], green: [84, 109, 27], red: [160, 39, 34], black: [20, 21, 25] };   // given: vanilla's dye colours (as its wool shows them)
export const WOOD = { oak: [176, 138, 86], spruce: [118, 86, 52], birch: [214, 196, 138], jungle: [164, 116, 82], acacia: [178, 94, 52], dark_oak: [74, 50, 28], mangrove: [126, 52, 48], cherry: [228, 178, 170], bamboo: [206, 190, 92], crimson: [112, 50, 76], warped: [46, 112, 106], pale_oak: [232, 222, 216] };   // vision: the woods' colours
const BARK = { oak: [96, 76, 46], spruce: [58, 42, 26], birch: [226, 226, 214], jungle: [88, 70, 30], acacia: [104, 98, 88], dark_oak: [58, 44, 28], mangrove: [86, 64, 50], cherry: [56, 30, 40], bamboo: [118, 150, 50] };   // vision: the barks' colours
const STONE = { stone: [124, 124, 124], cobblestone: [118, 118, 118], deepslate: [78, 78, 84], andesite: [134, 134, 134], diorite: [196, 196, 196], granite: [152, 106, 86], tuff: [108, 110, 100], calcite: [222, 222, 216], basalt: [74, 74, 80], blackstone: [44, 40, 46],   // vision: the pack's palette
  sandstone: [218, 204, 152], red_sandstone: [188, 102, 40], sand: [222, 208, 162], red_sand: [192, 106, 40], gravel: [128, 124, 120], clay: [160, 166, 180], mud: [60, 54, 54], packed_mud: [142, 106, 80], mud_bricks: [138, 102, 76], bricks: [152, 86, 70],   // vision: the pack's palette
  prismarine: [100, 162, 146], dark_prismarine: [54, 96, 76], obsidian: [20, 16, 30], snow: [244, 250, 250], ice: [150, 186, 240], packed_ice: [140, 176, 230], blue_ice: [116, 166, 246], quartz: [236, 230, 224], terracotta: [152, 92, 66], dirt: [134, 96, 66],   // vision: the pack's palette
  grass: [124, 178, 82], podzol: [96, 66, 30], moss: [92, 112, 46], mycelium: [112, 96, 106], coral: [204, 92, 122], sponge: [204, 192, 76], glass: [200, 222, 228], water: [63, 118, 228], hay: [196, 164, 42], leaves: [72, 122, 50], farmland: [96, 64, 40], dirt_path: [148, 122, 72] };   // vision: the pack's palette
const byLen = (o) => Object.keys(o).sort((a, b) => b.length - a.length);
const STONE_WORDS = byLen(STONE), WOOD_WORDS = byLen(WOOD), DYE_WORDS = byLen(DYE);

/** The spec: each family, the resources it draws, how it's built, and the golden device it uses. */
export const SPEC = [
  { family: "stone", blocks: "stone, andesite, diorite, granite, tuff, calcite, deepslate, basalt, quartz, obsidian", kind: "solid",
    device: "veins in a 3D field: level sets of three plane waves with Fibonacci wavenumbers (1,1,2), (1,2,3), (2,3,5) across the cube (not (3,5,8): its face wavenumber passes the tile's Nyquist of 8 and would shimmer even up close), so veins run through every face and into the next block; grain from three crossing Fibonacci waves; 13 flecks on the Fibonacci lattice" },
  { family: "log", blocks: "every *_log and stripped log", kind: "solid",
    device: "a cylinder: rings inside, widths from the Fibonacci word (wet years and dry), the pith off centre by the golden sequence; bark outside, ridges round the trunk spaced by the word, gently spiralled, fissures between. Top shows the rings and the bark rim; sides the bark; stripped sides the rings cut lengthwise" },
  { family: "pillar", blocks: "basalt, deepslate, hay_block, bone_block, quartz_pillar, purpur_pillar, bamboo_block", kind: "axis",
    device: "anisotropic: the side runs along the block's axis, the end lies across it, and the game turns both when the block is laid sideways, so the same material reads one way stood up and another laid down. Basalt: columns five and three wide, cross-fractured by the word; ends near-hexagonal. Deepslate: wavering foliation. Hay: a bound sheaf, the band at the golden height; ends cut stalks. Bone: long grooves; ends marrow and ring at golden radii. Bamboo: poles five and three wide, nodes a golden interval apart; ends five hollow culms. Quartz and purpur: flutes three and two; ends a rosette" },
  { family: "planks", blocks: "every *_planks (and what's made of them)", kind: "solid",
    device: "boards five and three wide from the word (as near phi as whole pixels allow), a butt joint at each board's golden position so no two end together, grain warped by the field, each board its own tone" },
  { family: "grass", blocks: "grass_block, podzol, mycelium, moss_block", kind: "solid",
    device: "top: 34 blades on the Fibonacci lattice; side: earth under a turf fringe 16/phi^3 (about 4) pixels deep, ragged by the word; bottom: earth" },
  { family: "strata", blocks: "terracotta (all dyes), sandstone, red sandstone, smooth stone", kind: "solid",
    device: "beds in y, three and two thick from the word, each its own tone, rippled in x and z by Fibonacci waves so they bend round corners and run on block to block; top: the uppermost bed" },
  { family: "bricks", blocks: "bricks, stone bricks, mud bricks, deepslate and other bricks", kind: "solid",
    device: "courses four high; bricks six and four long (about phi) cut from the word, each course further on in it, so the bond wanders like hand-laid work; mortar sunk by the relief; each brick its own tone" },
  { family: "cobble", blocks: "cobblestone, blackstone", kind: "variants", device: "Voronoi stones round the 13-point Fibonacci lattice, jittered per variant by the golden sequence; domed, joints sunk" },
  { family: "gravel", blocks: "gravel", kind: "variants", device: "21 Voronoi pebbles, each its own tone from the golden sequence" },
  { family: "earth", blocks: "dirt, mud, clay, packed mud, hay, farmland, dirt path", kind: "variants", device: "8 soft clods and 34 specks on Fibonacci lattices; farmland: furrows" },
  { family: "sand", blocks: "sand, red sand", kind: "variants", device: "ripples of wavenumber (2, 3), windward the golden share of each, lee the rest; 34 grains on the lattice" },
  { family: "leaves", blocks: "every *_leaves", kind: "variants", device: "21 leaves on the Fibonacci lattice, each an ellipse of aspect phi turned the golden angle from the last; gaps dark" },
  { family: "wool", blocks: "wool and carpet (all dyes)", kind: "variants", device: "a broken twill: the diagonal steps on where the word says L and back where it says S, so it never rules a line" },
  { family: "snow", blocks: "snow, ice, packed ice, blue ice", kind: "variants", device: "snow: sparkle on a 21-point lattice; ice: cracks along 5 Voronoi edges, bubbles on the lattice" },
  { family: "glazed", blocks: "glazed terracotta (all dyes)", kind: "set", device: "a Truchet tile: quarter arcs round opposite corners at golden radii 16/phi and 16/phi^2. It turns with how it's placed, so a floor of them draws golden spirals and meanders: the set is the pattern" },
  { family: "water", blocks: "water", kind: "animated", device: "four wave trains at Fibonacci wavenumbers, each turning a whole number of times in 8 frames by deep-water dispersion; foam on the crests" },
  { family: "prismarine", blocks: "prismarine and its kin", kind: "animated", device: "the 5D string (Seedworld gate #5) over a ground of 13 cells: from a point to one closed string and back in exactly 48 frames" },
  { family: "coral", blocks: "coral blocks, sponge", kind: "single", device: "Gray-Scott reaction and diffusion (Turing's patterns), seeded by the record" },
  { family: "glass", blocks: "glass", kind: "single", device: "clear, a frame, one streak of light at half the golden angle" },
];

/** A block's family and colour, from its id (read once). */
const looks = new Map();
export const lookOf = (id) => looks.get(id) ?? (looks.set(id, lookOnce(id)), looks.get(id));
function lookOnce(id) {
  const n = id.replace(/^\w+:/, ""), dye = DYE_WORDS.find((d) => n.startsWith(d + "_")), wood = WOOD_WORDS.find((w) => n.startsWith(w + "_") || n.startsWith("stripped_" + w));
  const stone = STONE_WORDS.find((s) => n === s || n.startsWith(s + "_")) ?? STONE_WORDS.find((s) => n.includes(s));
  let col = (dye && DYE[dye]) ?? (wood && WOOD[wood]) ?? (stone && STONE[stone]) ?? [140, 140, 140];   // vision: an unknown block's grey
  const pillar = /^(basalt|polished_basalt|deepslate|hay_block|bone_block|quartz_pillar|purpur_pillar|bamboo_block)$/.test(n);
  const fam = pillar ? "pillar" :
    /water/.test(n) ? "water" : /prismarine/.test(n) ? "prismarine" : /glazed_terracotta/.test(n) ? "glazed" : /terracotta|sandstone|smooth_stone/.test(n) ? "strata" :
    /_planks|_slab|_stairs|_fence|_door|_trapdoor|^bamboo_block/.test(n) && wood ? "planks" : /_log|_wood|_stem|^bamboo$/.test(n) ? "log" :
    /leaves|azalea/.test(n) ? "leaves" : /wool|carpet/.test(n) ? "wool" : /brick/.test(n) ? "bricks" : /cobble|blackstone/.test(n) ? "cobble" : /gravel/.test(n) ? "gravel" :
    /^sand$|^red_sand$/.test(n) ? "sand" : /coral|sponge/.test(n) ? "coral" : /snow|ice/.test(n) ? "snow" : /glass/.test(n) ? "glass" :
    /grass_block|podzol|mycelium|moss_block/.test(n) ? "grass" : /dirt|mud|clay|hay|farmland|path/.test(n) ? "earth" : "stone";
  if (fam === "leaves") col = mix(STONE.leaves, wood ? WOOD[wood] : STONE.leaves, wood === "cherry" ? 0.8 : 0.25);   // vision: a leaf takes a little of its tree's colour (cherry's blossom most)
  if (/bone_block/.test(n)) col = [226, 220, 196];   // vision: bone
  if (/purpur/.test(n)) col = [168, 124, 168];   // vision: purpur
  if (/bamboo_block/.test(n)) col = [176, 170, 70];   // vision: dried poles
  return { family: fam, colour: col, bark: wood ? BARK[wood] : null, wood, dye, stripped: /stripped_/.test(n), name: n };
}
function mix(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
const tone = (c, k) => c.map((v) => v * k);

// the grain: three crossing waves at Fibonacci wavenumbers, phases from the golden sequence (no hash, no table): 0..1, periodic in x, y, z
const WAVES3 = [[FIB[1], FIB[2], FIB[3]], [FIB[3], FIB[1], FIB[2]], [FIB[2], FIB[3], FIB[4]]];   // derived: low Fibonacci triples (1,1,2), (2,1,1), (1,2,3): broad mottling, one finer
function grain3(X, Y, Z, s = 0) {
  let v = 0; for (let k = 0; k < 3; k++) { const [a, b, c] = WAVES3[k]; v += Math.sin(TAU * ((a * X + b * Y + c * Z) / N + golden(k + 7 * s))) / (k + 1); }   // vision: each wave's weight falls as 1/k; seven apart in the sequence a stream
  return (v / (1 + 1 / 2 + 1 / 3) + 1) / 2;   // derived: the weights' sum
}

// a face's pixel (u, v) as a point of the cube: top looks down (u = x, v = z), sides look in (u = x, v from the top down)
const cube = (face, u, v) => (face === "top" ? [u, N - 0.5, v] : face === "bottom" ? [u, 0.5, v] : [u, N - v, 0]);
const wrapd = (d) => ((((d % N) + N + N / 2) % N) - N / 2);
/** A variant's points, but those near an edge kept where the shared set has them: variants meet seamlessly. */
function keepEdges(pts, shared) {
  const E = TEXTURE.KEEP_EDGE, near = ([x, y]) => Math.min(x, y, N - x, N - y) < E;
  return pts.map((p, i) => (near(shared[i]) || near(p) ? shared[i] : p));
}
const LAT = new Map();
const pts = (k, v, jit = 0.35) => { const key = `${k},${v},${jit}`; if (!LAT.has(key)) LAT.set(key, keepEdges(lattice(k, N, v, jit), lattice(k, N, 0, jit))); return LAT.get(key); };   // vision: the lattices' jitter

/** One pixel: [r, g, b, height]. f: frame; k: variant. */
function pixel(L, face, u, v, f, k) {
  const c = L.colour, [X, Y, Z] = cube(face, u + 0.5, v + 0.5);
  switch (L.family) {
    case "water": { const h = waterAt(u, v, f), g = 150 + 90 * h; return h > TEXTURE.FOAM ? [255, 255, 255, h] : [g, g, g, h]; }   // vision: grey for the biome's tint, as vanilla's; given: white
    case "stone": {
      const W = [[1, 1, 2], [1, 2, 3], [2, 3, 5]].map(([a, b, cc], i) => Math.sin(TAU * ((a * X + b * Y + cc * Z) / N) + i * GOLDEN_ANGLE));   // derived: Fibonacci wavenumber triples
      const vein = Math.abs(W[0] + 0.6 * W[1] + 0.35 * W[2]), g = grain3(X, Y, Z) * 0.7 + 0.3 * golden(cellsOn(u + 0.5, v + 0.5, pts(5, 0), N).i), fleck = cellsOn(u, v, pts(6, 0), N).f1 < 0.7;   // vision: the waves' weights, a fleck's size
      return [...tone(c, 0.86 + 0.24 * g - (vein < 0.22 ? 0.2 * (1 - vein / 0.22) : 0) + (fleck ? 0.07 : 0)), 0.6 * g + (vein < 0.22 ? 0 : 0.4)];   // vision: the grain's swing, a vein's width and depth, a fleck's shine
    }
    case "log": {
      const ox = (golden(3) - 0.5) * 2, oz = (golden(5) - 0.5) * 2, r = Math.hypot(X - N / 2 - ox, Z - N / 2 - oz), th = Math.atan2(Z - N / 2, X - N / 2);   // vision: the pith a pixel or two off centre
      if (L.stripped || (face !== "side" && r < N / 2 - 1.2)) {   // vision: the bark's thickness
        const rr = L.stripped && face === "side" ? u + 0.35 * Y : r, rings = cuts(N, 2, 1, 4), at = pieceAt(Math.floor(rr * 1.2) % N, rings), early = at.t < 0.6, wood = L.wood ? WOOD[L.wood] : c;   // vision: the lengthwise cut's slant, ring spacing; earlywood the paler share
        return [...tone(wood, (early ? 1.04 : 0.84) * (0.94 + 0.1 * grain3(X, Y, Z, 1))), early ? 0.6 : 0.4];   // vision: early and late wood's tones
      }
      const wob = 1.6 * Math.sin((TAU * Y) / N + golden(Math.floor(u / 3))) + 0.9 * Math.sin((TAU * 2 * Y) / N + 2.4 * golden(Math.floor(u / 5) + 3));   // vision: ridges waver up the trunk, each its own way
      const ridges = cuts(N * 2, 3, 2, 9), a = face === "side" ? u * 2 + wob : (th / TAU + 0.5) * N * 2, at = pieceAt(Math.floor((a % (N * 2)) + N * 2) % (N * 2), ridges);   // vision: ridges three and two wide round the trunk
      const g = grain3(X, Y / 3, Z, 2), fissure = at.at === 0 && g > 0.35, b = L.bark ?? c;   // vision: fissures break where the grain is shallow
      return [...tone(b, fissure ? 0.62 : (0.84 + 0.22 * Math.sin(Math.PI * at.t)) * (0.88 + 0.24 * g)), fissure ? 0.1 : 0.4 + 0.5 * Math.sin(Math.PI * at.t) * g];   // vision: a fissure's dark, the ridge's light and shade
    }
    case "pillar": {   // anisotropic: the side runs along the axis (v along it), the end is across it
      const end = face !== "side", kind = L.name.replace(/^polished_/, "");
      if (kind === "basalt") {
        if (end) { const d = cellsOn(u + 0.5, v + 0.5, pts(6, 0, 0.2), N); return d.f2 - d.f1 < 0.7 ? [...tone(c, 0.55), 0] : [...tone(c, 0.9 + 0.2 * golden(d.i)), 1 - d.f1 / 5]; }   // vision: column joints, near-hexagonal (a barely jittered Fibonacci lattice)
        const cols = cuts(N, 5, 3, 1), p = pieceAt(Math.floor(u + 0.6 * Math.sin((TAU * v) / N)), cols), crack = cuts(N, 8, 5, 4 + p.k), q = pieceAt(v, crack);   // vision: columns five and three wide, cross-fractures eight and five apart, each column its own
        return p.at === 0 ? [...tone(c, 0.55), 0] : [...tone(c, (q.at === 0 ? 0.72 : 0.9) * (0.92 + 0.16 * Math.sin(Math.PI * p.t))), Math.sin(Math.PI * p.t)];   // vision: a joint's dark, a fracture's, a column's round
      }
      if (kind === "deepslate") {
        if (end) { const sp = cellsOn(u + 0.5, v + 0.5, pts(8, 0, 0.6), N); return [...tone(c, sp.f1 < 0.6 ? 1.15 : 0.92 + 0.1 * grain3(X, Y, Z)), 0.5]; }   // vision: mica glints across the cleavage
        const folia = u + 0.9 * Math.sin((TAU * v) / N + golden(2)) + 0.5 * Math.sin((TAU * 2 * v) / N), lines = cuts(N, 2, 1, 7), p = pieceAt(Math.floor(((folia % N) + N) % N), lines);   // vision: foliation two and one wide, wavering along the axis
        return [...tone(c, p.k % 2 ? 0.86 : 1.02), p.k % 2 ? 0.3 : 0.6];   // vision: alternate bands' tones
      }
      if (kind === "hay_block") {
        if (end) { const d = cellsOn(u + 0.5, v + 0.5, pts(8, 0, 0.6), N); return [...tone(c, d.f1 < 0.7 ? 0.7 : 1.02 + 0.08 * golden(d.i)), d.f1 < 0.7 ? 0 : 0.8]; }   // vision: cut stalks' hollow ends
        const straws = cuts(N, 2, 1, 3), p = pieceAt(u, straws), tie = Math.abs(v + 0.5 - N / PHI) < 1;   // derived: the band at the golden height; vision: straws two and one wide
        return tie ? [...tone([140, 110, 60], 1), 0.2] : [...tone(c, (p.k % 2 ? 0.88 : 1.04) * (0.94 + 0.12 * golden(p.k + Math.floor(v / 5)))), p.k % 2 ? 0.4 : 0.8];   // vision: the twine's colour; straws by turns
      }
      if (kind === "bone_block") {
        if (end) { const r = Math.hypot(u + 0.5 - N / 2, v + 0.5 - N / 2); return [...tone(c, r < N / PHI ** 3 ? 0.7 : Math.abs(r - N / PHI ** 2) < 0.8 ? 0.85 : 1), r < 3 ? 0 : 0.6]; }   // derived: marrow and ring at golden radii
        const groove = Math.abs(Math.sin((Math.PI * u * 3) / N)) < 0.2;   // vision: three long grooves
        return [...tone(c, groove ? 0.88 : 0.98 + 0.04 * grain3(X, Y / 4, Z)), groove ? 0.2 : 0.7];   // vision: the grooves' shade, the bone's grain
      }
      if (kind === "bamboo_block") {
        if (end) { const d = cellsOn(u + 0.5, v + 0.5, lattice(4, N, 0, 0.2), N); return d.f1 < 2.2 ? [...tone(c, 0.8), 0] : d.f1 < 3.4 ? [...tone(c, 1.05), 1] : [...tone(c, 0.5), 0]; }   // vision: five culms cut across, hollow, a wall each
        const poles = cuts(N, 5, 3, 2), p = pieceAt(u, poles), node = Math.abs(((v + golden(p.k) * N) % (N / PHI)) - 1) < 0.8;   // derived: nodes a golden interval apart, each pole's own phase
        return [...tone(c, p.at === 0 ? 0.6 : node ? 0.78 : 0.92 + 0.14 * Math.sin(Math.PI * p.t)), p.at === 0 ? 0 : Math.sin(Math.PI * p.t)];   // vision: a pole's round, its nodes
      }
      // quartz and purpur pillars: flutes along, a rosette across
      if (end) { const r = Math.hypot(u + 0.5 - N / 2, v + 0.5 - N / 2), th = Math.atan2(v + 0.5 - N / 2, u + 0.5 - N / 2); return [...tone(c, r < N / 2 - 1 && Math.abs(Math.sin(4 * th)) * r < 1 ? 0.85 : r > N / 2 - 1.5 ? 0.88 : 1), 0.5]; }   // vision: eight petals and a rim
      const flutes = cuts(N, 3, 2, 5), p = pieceAt(u, flutes);   // vision: flutes three and two wide
      return [...tone(c, 0.82 + 0.2 * Math.sin(Math.PI * p.t)), Math.sin(Math.PI * p.t)];   // vision: a flute's light and shade
    }
    case "planks": {
      const across = face === "side" ? v : v, boards = cuts(N, 5, 3, 2), b = pieceAt(Math.floor(across), boards), joint = Math.floor(golden(b.k + 3) * N);   // vision: boards five and three wide; a butt joint at the board's golden position
      const seam = b.at === 0 || Math.floor(u) === joint, g = Math.sin((TAU * (across * 1.7 + 3 * grain3(X, Y, Z, b.k))) / 4);   // vision: the grain's spacing and warp
      return [...tone(c, seam ? 0.7 : (0.9 + 0.07 * g) * (0.94 + 0.12 * golden(b.k + 11))), seam ? 0 : 0.5 + 0.1 * g];   // vision: a seam's shade, the grain's, each board's tone
    }
    case "grass": {
      const isGrass = L.name.startsWith("grass"), earth = isGrass ? STONE.dirt : tone(c, 0.8), turf = isGrass ? STONE.grass : c;   // vision: under podzol and mycelium, their own earth darker
      if (face === "bottom") return [...tone(earth, 0.9 + 0.15 * grain3(X, Y, Z)), 0.5];   // vision: plain earth
      if (face === "top") { const d = cellsOn(u + 0.5, v + 0.5, pts(8, 0, 0.5), N); return [...tone(turf, d.f1 < 0.9 ? 1.1 : 0.86 + 0.1 * golden(d.i)), d.f1 < 0.9 ? 1 : 0.3]; }   // vision: a blade's size and light
      const fringe = N / PHI ** 3 + (word(Math.floor(u) + 5) ? 1.2 : -0.6);   // derived: the turf hangs 16/phi^3; vision: ragged by the word
      return v < fringe ? [...tone(turf, 0.9 + 0.12 * grain3(X, Y, Z)), 0.8] : [...tone(earth, 0.86 + 0.2 * grain3(X, Y, Z, 3)), 0.4];   // vision: turf and earth's grain
    }
    case "strata": {
      const warp = 0.9 * Math.sin((TAU * (X + 2 * Z)) / N) + 0.6 * Math.sin((TAU * (3 * X - Z)) / N), beds = cuts(N, 3, 2, 6), b = pieceAt(Math.floor((((N - Y + warp) % N) + N) % N), beds);   // vision: the beds' ripple; beds three and two thick
      const t = 0.8 + 0.3 * golden(b.k + 2) + 0.06 * grain3(X, Y, Z), hue = mix(c, [236, 220, 196], 0.25 * golden(b.k + 5));   // vision: each bed its tone, and a little paler or not
      return [...tone(hue, b.at === 0 && face === "side" ? t * 0.85 : t), b.t];   // vision: a bedding plane's shade
    }
    case "bricks": {
      const row = Math.floor(v / 4), inRow = v % 4, bricks = cuts(N, 6, 4, 3 + row * 5), b = pieceAt(Math.floor(u + row * 3) % N, bricks);   // vision: courses four high, bricks six and four long, each course further on in the word
      const mortar = inRow === 3 || b.at === 0, t = 0.86 + 0.2 * golden(row * 7 + b.k) + 0.06 * grain3(X, Y, Z);   // vision: each brick its tone
      return mortar ? [...mix(c, [196, 190, 178], 0.55), 0] : [...tone(c, t), 0.7];   // vision: the mortar
    }
    case "cobble": { const d = cellsOn(u + 0.5, v + 0.5, pts(6, k % 3), N); return d.f2 - d.f1 < 0.9 ? [...tone(c, 0.5), 0] : [...tone(c, 0.82 + 0.28 * golden(d.i + 3 * (k % 3))), 1 - d.f1 / 4]; }   // vision: the joint's width, the stones' tones, their dome
    case "gravel": { const d = cellsOn(u + 0.5, v + 0.5, pts(7, k % 3), N); return d.f2 - d.f1 < 0.5 ? [...tone(c, 0.5), 0] : [...tone(c, 0.7 + 0.55 * golden(d.i * 3 + (k % 3))), 1 - d.f1 / 3]; }   // vision: the pebbles' joints, tones, dome
    case "earth": {
      if (/farmland/.test(L.name)) { const fur = Math.sin((TAU * v) / 4); return [...tone(c, 0.85 + 0.15 * fur), (fur + 1) / 2]; }   // vision: furrows four apart
      const clod = cellsOn(u + 0.5, v + 0.5, pts(5, k % 3), N), sp = cellsOn(u + 0.5, v + 0.5, pts(8, k % 3, 0.6), N);   // vision: 8 clods, 34 specks
      return [...tone(c, (0.88 + 0.16 * golden(clod.i + (k % 3))) * (sp.f1 < 0.6 ? 0.86 : 1)), 1 - clod.f1 / 6];   // vision: a speck's size and shade, the clods' tones and dome
    }
    case "sand": {
      const rip = frac(((2 * u + 3 * v) / N) * 2 + 0.15 * Math.sin((TAU * (u - v)) / N)), lee = 1 / PHI, crest = rip < lee ? rip / lee : (1 - rip) / (1 - lee);   // derived: wavenumber (2, 3) twice a tile, windward the golden share; vision: their wander
      const gr = cellsOn(u + 0.5, v + 0.5, pts(8, k % 3, 0.6), N);   // vision: 34 grains, their jitter
      return [...tone(c, 0.92 + 0.08 * crest + (gr.f1 < 0.55 ? (golden(gr.i) - 0.5) * 0.14 : 0)), crest];   // vision: the ripple's light, a grain's size and swing
    }
    case "leaves": {
      let best = 9, idx = 0;   // vision: past any leaf
      pts(7, k % 3, 0.6).forEach(([px, py], i) => { const a = i * GOLDEN_ANGLE, dx0 = wrapd(u + 0.5 - px), dy0 = wrapd(v + 0.5 - py), dx = dx0 * Math.cos(a) + dy0 * Math.sin(a), dy = -dx0 * Math.sin(a) + dy0 * Math.cos(a), e = Math.hypot(dx / 2.1, (dy * PHI) / 2.1); if (e < best) { best = e; idx = i; } });   // vision: a leaf's length; derived: its aspect phi
      return best < 1 ? [...tone(c, 0.88 + 0.32 * (1 - best) * (0.7 + 0.6 * golden(idx))), 1 - best] : [...tone(c, 0.45), 0];   // vision: a leaf's light, the gaps' dark
    }
    case "wool": {
      let s = 0; for (let i = 0; i < v; i++) s += word(i + 3 * (k % 3)) ? 1 : -1;   // the twill's diagonal walks by the word (vision: each variant three letters on)   // vision: each variant three letters on
      const over = (((u + s) % 4) + 4) % 4 < 2, fib = cellsOn(u + 0.5, v + 0.5, pts(8, k % 3, 0.6), N).f1 < 0.5;   // vision: two over, two under; fibre specks
      return [...tone(c, (over ? 1.03 : 0.9) * (fib ? 0.95 : 1)), over ? 0.7 : 0.3];   // vision: the weave's light
    }
    case "snow": {
      if (/ice/.test(L.name)) { const d = cellsOn(u + 0.5, v + 0.5, pts(4, k % 3), N), b = cellsOn(u + 0.5, v + 0.5, pts(7, (k % 3) + 1, 0.6), N); return [...tone(c, d.f2 - d.f1 < 0.4 ? 1.18 : b.f1 < 0.45 ? 1.1 : 0.96 + 0.04 * grain3(X, Y, Z)), 0.5]; }   // vision: 5 cells' cracks, bubbles, their light
      const sp = cellsOn(u + 0.5, v + 0.5, pts(7, k % 3), N);   // vision: 21 sparkles
      return [...tone(c, sp.f1 < 0.45 ? 1.04 : 0.95 + 0.03 * grain3(X, Y, Z)), 0.5];   // vision: sparkle
    }
    case "glazed": {
      const own = L.dye && ownerOf(L.dye), glaze = mix(c, [240, 236, 222], 0.6), ink = tone(c, 0.72);   // vision: the glaze's white, the ink's depth
      if (own) { const a = motifAt(own.motif, u, v); return [...mix(glaze, ink, Math.min(1, a)), a]; }   // a culture's motif, a quarter a tile
      const d1 = truchet(u + 0.5, v + 0.5, N, N / PHI), d2 = truchet(u + 0.5, v + 0.5, N, N / PHI ** 2), on = Math.min(d1, d2) < 1.1;   // derived: golden radii; vision: the line's width
      return on ? [...tone(c, d1 < d2 ? 0.85 : 0.65), 1] : [...glaze, 0.3];   // vision: the two arcs' tones
    }
    case "coral": { const t = turing(N)[v * N + u]; return [...tone(c, 0.5 + 0.7 * t), t]; }   // vision: the coral's shading
    case "prismarine": {
      const s = stringFrames(N)[f % STRING_FRAMES][v * N + u], d = cellsOn(u + 0.5, v + 0.5, pts(6, 0), N);   // vision: 13 ground cells
      return s === 1 ? [...tone(c, 1.5), 1] : s === -1 ? [...tone(c, 0.6), 0] : [...tone(c, 0.84 + 0.2 * golden(d.i)), d.f2 - d.f1 < 0.6 ? 0 : 0.5];   // vision: matter bright, antimatter dark, the ground's cells
    }
    case "glass": { const streak = Math.abs((((u - v * Math.tan(GOLDEN_ANGLE / 2) - 3) % N) + N) % N) < 1; return u === 0 || v === 0 ? [...tone(c, 0.8), 0] : streak ? [...tone(c, 1.15), 0] : [...c, 0]; }   // vision: the frame's shade, the streak's place and light
    default: return [...c, 0.5];   // vision: flat
  }
}

export const framesOf = (id) => { const f = lookOf(id).family; return f === "water" ? TEXTURE.WATER_FRAMES : f === "prismarine" ? STRING_FRAMES : 1; };
export const variantsOf = (id) => { const L = lookOf(id); return ["water", "prismarine", "glass", "glazed"].includes(L.family) ? 1 : L.dye ? TEXTURE.LAYERS.at(-1) : VARIANTS; };   // glazed keeps its motif whole; a dyed block (built with in patches, not masses) takes the micro layer's five
const LOOSE = new Set(["cobble", "gravel", "earth", "sand", "leaves", "wool", "snow"]);
const edgeW = (u, v) => { const e = Math.min(u + 0.5, v + 0.5, N - u - 0.5, N - v - 0.5); return Math.min(1, Math.max(0, (e - 1) / TEXTURE.KEEP_EDGE)); };   // 0 at the edge, 1 a few pixels in
/** The three layers' multiplier at a pixel for variant k: macro a broad swell, meso an accent or two, micro the grain (k taken by each layer's count). */
function layers(L, u, v, k) {
  const [A, B, C] = TEXTURE.LAYERS, k2 = k % A, k3 = k % B, k5 = k % C, w = edgeW(u, v);
  const cx = N * (0.3 + 0.4 * golden(k2 + 1)), cy = N * (0.3 + 0.4 * golden(k2 + 2)), r = Math.hypot(u + 0.5 - cx, v + 0.5 - cy) / (N / 2);   // vision: the swell's centre stays in the middle two-fifths
  const macro = (k2 ? 1 : -1) * TEXTURE.MACRO * Math.max(0, 1 - r * r) * w;
  let meso = 0;
  if (!LOOSE.has(L.family)) for (let j = 0; j < 2; j++) {   // vision: two accents a tile at most
    const px = N * (0.2 + 0.6 * golden(3 * k3 + j + 5)), py = N * (0.2 + 0.6 * golden(3 * k3 + j + 9)), rad = 1.3 + 1.4 * golden(k3 + j);   // vision: accents inside the edges, a pixel and more across
    const d = Math.hypot(u + 0.5 - px, v + 0.5 - py); if (d < rad && golden(k3 * 2 + j) < 0.75) meso += (golden(k3 + 7 * j) < 0.5 ? -1 : 0.7) * TEXTURE.MESO * (1 - d / rad);   // vision: three accents in four show; more darken than lighten
  }
  const R = recordLattice(N), micro = TEXTURE.MICRO * R[(((v + k5 * FIB[4]) % N) * N + ((u + k5 * FIB[5]) % N))];   // derived: the record read at the variant's offset, Fibonacci strides
  return 1 + macro + meso * w + micro;
}
export const facesOf = (id) => (["log", "grass", "strata", "pillar"].includes(lookOf(id).family) ? ["top", "side", "bottom"] : ["side"]);
export const hasAxis = (id) => ["log", "pillar"].includes(lookOf(id).family);

const RELIEF = { glazed: 0, water: 0, glass: 0, prismarine: 0, coral: 1 / PHI, wool: 1 / PHI ** 2, sand: 1 / PHI ** 2, snow: 1 / PHI, strata: 1 / PHI };   // vision: soft and layered stuff a golden share as deep; glazes and waters flat
/** Light a tile by its own relief: px is n x n of [r, g, b, height] (n from its length); the slope's light from the upper
 *  left, the cavity's shadow, the crest's light and the ridges' cast shadows, by the material's depth (RELIEF). */
export function relief(px, family, mult = () => 1) {
  const n = Math.round(Math.sqrt(px.length));
  const H = (u, v) => px[(((v % n) + n) % n) * n + (((u % n) + n) % n)][3], flat = family === "water" || family === "glass", rgb = new Uint8Array(n * n * 3);   // given: three channels
  // the cavity: how far a pixel sits under its neighbourhood's mean (a five-pixel box, wrapped), so joints and grooves
  // gather shadow; the crest: how far it stands over it
  const R2 = TEXTURE.AO_R, box = new Float32Array(n * n);
  for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) { let a = 0; for (let j = -R2; j <= R2; j++) for (let i = -R2; i <= R2; i++) a += H(u + i, v + j); box[v * n + u] = a / (2 * R2 + 1) ** 2; }
  // the shadow: march toward the light (the upper left) a few pixels; if the relief there stands higher than a ray
  // rising at the light's elevation, this pixel is in its shade, so a ridge throws its shadow into the hollow beside it
  const RK = RELIEF[family] ?? 1;   // how deep this material's relief reads: full for carved and grown stuff, half for soft, none for glazes
  const shade = (u, v) => { if (!RK) return 1; const h0 = H(u, v) * TEXTURE.DEPTH; for (let s = 1; s <= TEXTURE.MARCH; s++) if (H(u - s, v - s) * TEXTURE.DEPTH > h0 + s * Math.SQRT2 * TEXTURE.ELEV) return 1 - (1 - TEXTURE.SHADOW) * RK; return 1; };
  for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) {
    const dh = (H(u, v) - box[v * n + u]) * RK, ao = 1 + (dh < 0 ? TEXTURE.CAVITY : TEXTURE.CREST) * dh;
    const lit = flat ? 1 : (1 + TEXTURE.LIGHT * (H(u - 1, v - 1) - H(u + 1, v + 1))) * ao * shade(u, v) * mult(u, v);
    rgb.set(px[v * n + u].slice(0, 3).map((x) => Math.max(0, Math.min(255, Math.round(x * lit)))), (v * n + u) * 3);   // given: three channels, 255 their most
  }
  return rgb;
}
const tiles = new Map();
/** A block's tile: { rgb, mean, mips }, made once and then looked up. face: top, side, bottom; f: frame; k: variant. */
export function tileOf(id, f = 0, face = "side", k = 0) {
  const n = framesOf(id), V = variantsOf(id), fc = facesOf(id).includes(face) ? face : "side", fr = ((f % n) + n) % n, kv = ((k % V) + V) % V, key = `${id}|${fc}|${fr}|${kv}`;
  const hit = tiles.get(key); if (hit) return hit;
  const L = lookOf(id), px = [];
  for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) px.push(pixel(L, fc, u, v, fr, kv));
  const rgb = relief(px, L.family, (u, v) => layers(L, u, v, kv));
  const mips = [rgb];
  for (let s = N / 2, prev = rgb; s >= 1; s /= 2) {
    const m = new Uint8Array(s * s * 3), S = s * 2;   // given: three channels
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) for (let c = 0; c < 3; c++) m[(y * s + x) * 3 + c] = (prev[(2 * y * S + 2 * x) * 3 + c] + prev[(2 * y * S + 2 * x + 1) * 3 + c] + prev[((2 * y + 1) * S + 2 * x) * 3 + c] + prev[((2 * y + 1) * S + 2 * x + 1) * 3 + c]) >> 2;   // given: four pixels make one, three channels
    mips.push(m); prev = m;
  }
  const t = { w: N, h: N, rgb, mean: [...mips.at(-1)], mips, family: L.family };
  tiles.set(key, t);
  return t;
}
/** Which variant the sim draws at block (x, y, z): the golden sequence of the position (the client picks its own, weighted alike). */
export const variantAt = (id, x, y, z) => Math.floor(golden(x * FIB[5] + y * FIB[7] + z * FIB[9]) * variantsOf(id));   // derived: Fibonacci strides, so neighbours differ
/** What a player sees at (u, v) in a block's face (0..1), drawn `size` pixels a block: one lookup, in the mip that fits. */
export function texel(id, u, v, f = 0, size = N, face = "top", k = 0) {
  const t = tileOf(id, f, face, k), lvl = Math.max(0, Math.min(t.mips.length - 1, Math.ceil(Math.log2(N / Math.max(1, size))))), s = N >> lvl, m = t.mips[lvl];
  const i = Math.min(s - 1, Math.floor(u * s)), j = Math.min(s - 1, Math.floor(v * s)), q = (j * s + i) * 3;   // given: three channels
  return [m[q], m[q + 1], m[q + 2]];
}
/** The water's surface at a pixel in frame f, 0..1. */
export function waterAt(u, v, f) {
  let h = 0, a = 0;
  TEXTURE.TRAINS.forEach(([kx, ky], i) => { const kk = Math.hypot(kx, ky), turns = Math.max(1, Math.round(Math.sqrt(kk) * 2)); h += Math.cos(TAU * ((kx * u + ky * v) / N - (turns * f) / TEXTURE.WATER_FRAMES) + i * GOLDEN_ANGLE) / kk; a += 1 / kk; });   // derived: deep-water dispersion (w ~ sqrt k) in whole turns a loop; each train a golden angle on
  return (h / a + 1) / 2;
}
