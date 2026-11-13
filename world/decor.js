// Pure. What a people makes of a gap in its town (world/growth.js gapsOf names the kind): the blocks, cell by cell,
// on the ground's own top. Each kind reads its gap's shape: its edge (the cells beside other ground), its axis (a
// strip's rows run along it), its middle (a square's feature, a garden's pond). Every id vanilla's.
import { FIB, PHI } from "../core/golden.js";
import { hashAt } from "../core/noise.js";

const LEAF = { persistent_bit: true };   // given: placed leaves keep
const tree = (put, x, y, z, log, leaves, tall = FIB[4] - 1) => {   // a small tree: its trunk and a ball of leaves   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
  for (let k = 1; k <= tall; k++) put(x, y + k, z, log, { pillar_axis: "y" });
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = tall - 1; c <= tall + 1; c++) if (a * a + b * b + (c - tall) ** 2 <= FIB[3] + (c === tall ? 2 : 0) && (a || b || c > tall)) put(x + a, y + c, z + b, leaves, LEAF);   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
  put(x, y + tall + 1, z, leaves, LEAF);
};
const FLOWERS = ["minecraft:poppy", "minecraft:dandelion", "minecraft:cornflower", "minecraft:oxeye_daisy", "minecraft:allium", "minecraft:azure_bluet"];   // given: vanilla's small flowers
/** Lay a gap's decor. put(x, y, z, id, states); H(x, z) the ground's top; P the people's palette. Returns a note. */
export function decorOf(gap, t, { put, H, P = {}, stone = "minecraft:stone_bricks", seed = 0 }) {
  const cells = gap.cells, set = new Set(cells.map(([x, z]) => `${x},${z}`)), inG = (x, z) => set.has(`${x},${z}`);
  const edge = cells.filter(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !inG(x + a, z + b)));
  let mx = 0, mz = 0; for (const [x, z] of cells) { mx += x; mz += z; } mx /= cells.length; mz /= cells.length;
  const mid = cells.reduce((b, c) => (Math.hypot(c[0] - mx, c[1] - mz) < Math.hypot(b[0] - mx, b[1] - mz) ? c : b), cells[0]);
  const [ux, uz] = gap.axis ?? [1, 0], along = (x, z) => x * ux + z * uz, across = (x, z) => -x * uz + z * ux;
  const h = (x, z) => Math.round(H(x, z)), r = (x, z, k) => hashAt(x, z, seed + k);
  const log = P.frame?.endsWith("_log") ? P.frame : "minecraft:oak_log", leaves = log.replace("_log", "_leaves").replace("stripped_", "");
  switch (gap.kind) {
    case "plaza": {   // paved, a feature at its middle (a tree in a planter, or a column and its lantern)
      for (const [x, z] of cells) put(x, h(x, z), z, stone);
      const y = h(...mid); if (cells.length > FIB[6]) { for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(mid[0] + a, y + 1, mid[1] + b, "minecraft:stone_brick_wall"); tree(put, mid[0], y, mid[1], log, leaves, FIB[4]); } else { put(mid[0], y + 1, mid[1], "minecraft:stone_brick_wall"); put(mid[0], y + 2, mid[1], "minecraft:stone_brick_wall"); put(mid[0], y + 3, mid[1], "minecraft:lantern"); }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      return "a paved square";
    }
    case "kitchen": case "kailyard": {   // beds in rows along the gap's axis, a water channel every fourth, a fence round
      const crops = gap.kind === "kailyard" ? ["minecraft:beetroot", "minecraft:potatoes"] : ["minecraft:carrots", "minecraft:wheat", "minecraft:potatoes"];
      for (const [x, z] of cells) { const y = h(x, z), row = Math.round(across(x, z)); if (edge.some((e) => e[0] === x && e[1] === z)) { put(x, y + 1, z, "minecraft:oak_fence"); continue; } if (row % FIB[3] === 0) { put(x, y, z, "minecraft:water"); continue; } put(x, y, z, "minecraft:farmland", { moisturized_amount: 7 }); put(x, y + 1, z, crops[Math.abs(row) % crops.length], { growth: 7 }); }   // given: ripe, and the farmland wet
      return "kitchen beds";
    }
    case "garden": {   // grass, flowers, a hedge round it, a gravel cross through it, a tree at its middle
      for (const [x, z] of cells) { const y = h(x, z), onEdge = edge.some((e) => e[0] === x && e[1] === z); put(x, y, z, "minecraft:grass_block"); if (onEdge) { put(x, y + 1, z, leaves, LEAF); continue; } if (Math.abs(Math.round(along(x - mid[0], z - mid[1]))) === 0 || Math.abs(Math.round(across(x - mid[0], z - mid[1]))) === 0) { put(x, y, z, "minecraft:gravel"); continue; } if (r(x, z, 3) < 1 / PHI ** 2) put(x, y + 1, z, FLOWERS[Math.floor(r(x, z, 5) * FLOWERS.length)]); }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      tree(put, mid[0], h(...mid), mid[1], log, leaves); return "a garden";
    }
    case "green": {   // the common: grass, a great tree, benches round it
      for (const [x, z] of cells) put(x, h(x, z), z, "minecraft:grass_block");
      const y = h(...mid); tree(put, mid[0], y, mid[1], log, leaves, FIB[5] - 2);   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      for (const [a, b, d] of [[3, 0, 1], [-3, 0, 0], [0, 3, 3], [0, -3, 2]]) if (inG(mid[0] + a, mid[1] + b)) put(mid[0] + a, h(mid[0] + a, mid[1] + b) + 1, mid[1] + b, "minecraft:oak_stairs", { weirdo_direction: d, upside_down_bit: false });   // given: a bench faces the tree
      return "the green";
    }
    case "pasture": { for (const [x, z] of cells) { const y = h(x, z); put(x, y, z, "minecraft:grass_block"); if (edge.some((e) => e[0] === x && e[1] === z)) put(x, y + 1, z, "minecraft:spruce_fence"); else if (r(x, z, 7) < 1 / FIB[8]) put(x, y + 1, z, "minecraft:hay_block", { pillar_axis: "y" }); } return "a pasture"; }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
    case "grove": case "olives": case "palms": case "bamboo": case "hedgerow": case "vines": {   // trees on a golden lattice (a strip's in a row along it)
      const kind = gap.kind, L = kind === "palms" ? "minecraft:jungle_log" : kind === "olives" ? "minecraft:birch_log" : kind === "hedgerow" ? log : log;
      const lv = kind === "palms" ? "minecraft:jungle_leaves" : kind === "olives" ? "minecraft:azalea_leaves" : leaves, gapT = kind === "hedgerow" || kind === "vines" ? FIB[3] : FIB[4];   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      let n = 0; for (const [x, z] of cells) { const y = h(x, z); put(x, y, z, "minecraft:grass_block"); const a = Math.round(along(x, z)), c = Math.round(across(x, z));
        if (kind === "bamboo") { if (r(x, z, 9) < 1 / PHI ** 2) for (let k = 1; k <= FIB[4] + Math.floor(r(x, z, 11) * 4); k++) put(x, y + k, z, "minecraft:bamboo"); continue; }   // vision: a thicket two in five
        if (kind === "vines" && c % FIB[3] === 0) { put(x, y + 1, z, "minecraft:oak_fence"); put(x, y + 2, z, "minecraft:azalea_leaves", LEAF); continue; }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
        if (kind === "hedgerow" && edge.some((e) => e[0] === x && e[1] === z)) { put(x, y + 1, z, lv, LEAF); continue; }
        if (a % gapT === 0 && c % gapT === 0 && r(x, z, 13) < 1 / PHI) { tree(put, x, y, z, L, lv, FIB[3] + Math.floor(r(x, z, 17) * 2)); n++; } }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      return `a ${kind === "olives" ? "grove of olives" : kind === "palms" ? "stand of palms" : kind === "bamboo" ? "bamboo thicket" : kind === "hedgerow" ? "hedgerow and its trees" : kind === "vines" ? "vine rows" : "grove"}`;
    }
    case "zen": {   // raked gravel, stones set in moss, a pond if there's room
      for (const [x, z] of cells) put(x, h(x, z), z, "minecraft:gravel");
      for (const [x, z] of cells) if (r(x, z, 19) < 1 / FIB[7]) { const y = h(x, z); put(x, y + 1, z, r(x, z, 23) < 0.5 ? "minecraft:mossy_cobblestone" : "minecraft:andesite"); put(x, y, z, "minecraft:moss_block"); }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      if (cells.length > FIB[8]) for (const [x, z] of cells) if (Math.hypot(x - mid[0], z - mid[1]) <= FIB[3]) put(x, h(x, z), z, "minecraft:water");   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      return "a dry garden";
    }
    case "pond": case "charbagh": {   // water at the heart: a round pond (or the four-fold garden's crossed channels), planted round
      for (const [x, z] of cells) { const y = h(x, z), d = Math.hypot(x - mid[0], z - mid[1]), ch = gap.kind === "charbagh" && (Math.abs(Math.round(along(x - mid[0], z - mid[1]))) === 0 || Math.abs(Math.round(across(x - mid[0], z - mid[1]))) === 0);
        if (ch || (gap.kind === "pond" && d <= Math.sqrt(cells.length / Math.PI) / PHI)) { put(x, y, z, "minecraft:water"); if (gap.kind === "pond" && r(x, z, 29) < 1 / FIB[5]) put(x, y + 1, z, "minecraft:waterlily"); continue; }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
        put(x, y, z, "minecraft:grass_block"); if (gap.kind === "charbagh" && Math.round(along(x, z)) % FIB[4] === 0 && Math.round(across(x, z)) % FIB[4] === 0) tree(put, x, y, z, "minecraft:jungle_log", "minecraft:jungle_leaves", FIB[3]); else if (r(x, z, 31) < 1 / PHI ** 3) put(x, y + 1, z, FLOWERS[Math.floor(r(x, z, 37) * FLOWERS.length)]); }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      return gap.kind === "pond" ? "a pond garden" : "a four-fold garden";
    }
    case "terrace": {   // the slope held in steps: a retaining wall where the ground drops two or more, the beds level behind it
      for (const [x, z] of cells) { const y = h(x, z), lower = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inG(x + a, z + b) && h(x + a, z + b) <= y - 2); put(x, y, z, lower ? stone : "minecraft:grass_block"); if (!lower && r(x, z, 41) < 1 / PHI ** 2) put(x, y + 1, z, t === "therans" ? "minecraft:flower_pot" : FLOWERS[Math.floor(r(x, z, 43) * FLOWERS.length)]); }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      return "terraced beds";
    }
    case "pots": { for (const [x, z] of cells) { const y = h(x, z); put(x, y, z, P.plinth ?? stone); if (r(x, z, 47) < 1 / PHI ** 2) put(x, y + 1, z, r(x, z, 53) < 0.5 ? "minecraft:flower_pot" : "minecraft:decorated_pot"); } return "a court of pots"; }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
    case "berries": { for (const [x, z] of cells) { const y = h(x, z); put(x, y, z, "minecraft:grass_block"); if (r(x, z, 59) < 1 / PHI) put(x, y + 1, z, "minecraft:sweet_berry_bush", { growth: 3 }); } return "a berry patch"; }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
    case "taro": { for (const [x, z] of cells) { const y = h(x, z), row = Math.round(across(x, z)); put(x, y, z, row % 2 ? "minecraft:mud" : "minecraft:water"); if (row % 2 && r(x, z, 61) < 1 / PHI) put(x, y + 1, z, "minecraft:fern"); } return "a taro patch"; }   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
    case "racks": case "landing": {   // the shore's: racks of fish or nets on posts (a landing's boats drawn up on its sand)
      for (const [x, z] of cells) { const y = h(x, z); put(x, y, z, gap.kind === "landing" ? "minecraft:sand" : "minecraft:gravel"); const a = Math.round(along(x, z)), c = Math.round(across(x, z)); if (c % FIB[4] === 0 && a % FIB[3] === 0) { put(x, y + 1, z, "minecraft:spruce_fence"); put(x, y + 2, z, "minecraft:spruce_fence"); } else if (c % FIB[4] === 0) put(x, y + 2, z, "minecraft:spruce_fence"); }   // the rail between the posts   // vision: the gap's own measure (its trees, rows and beds, in Fibonacci numbers)
      return gap.kind === "landing" ? "a landing" : "drying racks";
    }
    default: return null;
  }
}

// ---- the fields round a town (world/growth.js farms): rows square to the world, a channel every fourth row, the
// boundary hedged or fenced; a ranch's pasture fenced, its hay and its trough. Each people its crops (vision: their own)
export const CROPS = {
  european: ["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"], norse: ["minecraft:wheat", "minecraft:potatoes", "minecraft:beetroot"],
  japanese: ["minecraft:wheat"], east_asian: ["minecraft:wheat", "minecraft:carrots"], indian_ocean: ["minecraft:wheat", "minecraft:melon_stem"],
  therans: ["minecraft:wheat", "minecraft:beetroot"], dugout: ["minecraft:wheat", "minecraft:pumpkin_stem", "minecraft:sweet_berry_bush"], birchbark: ["minecraft:wheat", "minecraft:pumpkin_stem", "minecraft:sweet_berry_bush"],
  pacific: ["taro"], shallow: ["taro"], arctic: [],
};
// the beasts each people keeps (vision: theirs; vanilla's own mobs): the ranch's herd and the flock, the farm's own
export const BEASTS = {
  european: { ranch: ["minecraft:cow", "minecraft:sheep", "minecraft:horse"], farm: ["minecraft:pig", "minecraft:chicken"] },
  norse: { ranch: ["minecraft:sheep", "minecraft:cow", "minecraft:horse"], farm: ["minecraft:pig", "minecraft:chicken"] },
  japanese: { ranch: ["minecraft:horse", "minecraft:cow"], farm: ["minecraft:chicken"] }, east_asian: { ranch: ["minecraft:cow", "minecraft:horse"], farm: ["minecraft:pig", "minecraft:chicken"] },
  indian_ocean: { ranch: ["minecraft:goat", "minecraft:cow", "minecraft:camel"], farm: ["minecraft:chicken", "minecraft:goat"] }, therans: { ranch: ["minecraft:goat", "minecraft:sheep"], farm: ["minecraft:chicken"] },
  pacific: { ranch: ["minecraft:pig"], farm: ["minecraft:chicken", "minecraft:pig"] }, shallow: { ranch: ["minecraft:pig"], farm: ["minecraft:chicken"] },
  dugout: { ranch: ["minecraft:wolf"], farm: ["minecraft:chicken"] }, birchbark: { ranch: ["minecraft:wolf"], farm: ["minecraft:chicken"] },
  arctic: { ranch: ["minecraft:goat"], farm: [] },
};
export const HERD = FIB[7];   // vision: a beast to every 21 blocks of pasture
const PADDY = new Set(["japanese", "east_asian"]);   // the wet-rice peoples: a channel every other row
const HEDGE = new Set(["european", "norse"]);         // the hedging peoples; the rest fence
export function fieldOf(farm, t, { put, H, seed = 0, spawn = () => {} }) {
  const h = (x, z) => Math.round(H(x, z)), crops = CROPS[t] ?? CROPS.european, fence = t === "japanese" ? "minecraft:bamboo_fence" : t === "european" ? "minecraft:oak_fence" : "minecraft:spruce_fence", gate = fence.replace("_fence", "_fence_gate");
  let n = 0;
  for (const [pi, pt] of (farm.plots ?? []).entries()) {
    const set = new Set(pt.cells.map(([x, z]) => `${x},${z}`)), edge = ([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !set.has(`${x + a},${z + b}`));
    const rim = pt.cells.filter(edge), gc = rim.reduce((b, c) => (Math.hypot(c[0] - farm.x, c[1] - farm.z) < Math.hypot(b[0] - farm.x, b[1] - farm.z) ? c : b), rim[0]);   // the gate on the side toward the house
    let mx = 0, mz = 0; for (const [x, z] of pt.cells) { mx += x; mz += z; } mx = Math.round(mx / pt.cells.length); mz = Math.round(mz / pt.cells.length);
    const alongX = (Math.floor(mx / FIB[6]) + Math.floor(mz / FIB[7])) % 2 === 0, crop = crops[(farm.i + pi) % Math.max(1, crops.length)], stage = Math.floor(hashAt(mx, mz, seed + 13) * 8);   // given: a crop's eight stages, each plot sown at its own time   // given: the rows of neighbouring plots run crosswise, a patchwork
    for (const c of pt.cells) {
      const [x, z] = c, y = h(x, z), row = alongX ? z : x;
      if (edge(c)) { put(x, y, z, "minecraft:grass_block"); if (gc && c[0] === gc[0] && c[1] === gc[1]) put(x, y + 1, z, gate, { direction: Math.abs(x - mx) > Math.abs(z - mz) ? 1 : 0, open_bit: false, in_wall_bit: false }); else put(x, y + 1, z, pt.kind === "crop" && HEDGE.has(t) ? "minecraft:oak_leaves" : fence, pt.kind === "crop" && HEDGE.has(t) ? { persistent_bit: true } : null); continue; }   // the plot's fence (a crop field's hedge, for the hedging peoples) and its gate
      if (pt.kind === "orchard") { put(x, y, z, "minecraft:grass_block"); if (((x % FIB[4]) + FIB[4]) % FIB[4] === 0 && ((z % FIB[4]) + FIB[4]) % FIB[4] === 0) tree(put, x, y, z, "minecraft:oak_log", "minecraft:oak_leaves", FIB[3]); else if (hashAt(x, z, seed + 5) < 1 / FIB[8]) put(x, y + 1, z, "minecraft:beehive", { direction: 2 }); continue; }   // vision: a tree every five, a hive here and there
      if (pt.kind === "pen" || pt.kind === "pasture" || !crops.length) { put(x, y, z, "minecraft:grass_block"); if (hashAt(x, z, seed + 71) < 1 / FIB[8]) put(x, y + 1, z, "minecraft:hay_block", { pillar_axis: "y" }); else if (pt.kind === "pen" && x === mx && z === mz) put(x, y, z, "minecraft:water"); continue; }   // the pen's trough at its middle   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
      if (crop === "taro") { put(x, y, z, row % 2 ? "minecraft:mud" : "minecraft:water"); if (row % 2) put(x, y + 1, z, "minecraft:fern"); continue; }
      const every = PADDY.has(t) ? 2 : FIB[4] - 1;   // derived: a channel every fourth row (every other for paddies)
      if (((row % every) + every) % every === 0) { put(x, y, z, "minecraft:water"); continue; }
      put(x, y, z, "minecraft:farmland", { moisturized_amount: 7 });   // given: farmland at its wettest
      if (x === mx && z === mz + 1) { put(x, y + 1, z, fence); put(x, y + 2, z, "minecraft:hay_block", { pillar_axis: "y" }); put(x, y + 3, z, "minecraft:carved_pumpkin", { "minecraft:cardinal_direction": "south" }); continue; }   // the scarecrow   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
      put(x, y + 1, z, crop, crop === "minecraft:sweet_berry_bush" ? { growth: Math.min(3, stage >> 1) } : { growth: stage });   // growing, at its plot's stage   // vision: the farmstead's own measure (its coop, its run, its keys)
    }
    if (pt.kind === "pen" || pt.kind === "pasture") { const herd = (BEASTS[t] ?? BEASTS.european).ranch, inner = pt.cells.filter((c) => !edge(c)); for (let j = 0; j < Math.floor(inner.length / HERD); j++) { const [x, z] = inner[Math.floor(hashAt(j, pi, seed + 17) * inner.length)]; spawn(herd[(j + pi) % herd.length], x, h(x, z) + 1, z); } }   // the herd on its grass   // vision: the farmstead's own measure (its coop, its run, its keys)
    n++;
  }
  return n ? (farm.kind === "ranch" ? "a ranch's pastures" : PADDY.has(t) ? "paddies" : "fields") : null;
}
/** Round a farmstead: its woodpile, its haystack, its kitchen garden, a well to every third farm (on the free ground by the house). */
export function farmsteadOf(farm, house, t, { put, H, free, seed = 0, spawn = () => {} }) {
  const h = (x, z) => Math.round(H(x, z)), w = Math.ceil(house.atom.w / 2) + 2, l = Math.ceil(house.atom.l / 2) + 2, sides = [[house.x + w, house.z], [house.x - w, house.z], [house.x, house.z + l], [house.x, house.z - l]];   // derived: two blocks out from each wall
  const spots = sides.filter(([x, z]) => free(x, z));
  const [a, b, c2, d] = spots;
  if (a) { const [x, z] = a; for (let i = -1; i <= 1; i++) for (let y = 1; y <= 2; y++) if (free(x, z + i)) put(x, h(x, z + i) + y, z + i, "minecraft:spruce_log", { pillar_axis: "x" }); }   // the woodpile
  if (b) { const [x, z] = b; for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (free(x + i, z + j)) put(x + i, h(x + i, z + j) + 1, z + j, "minecraft:hay_block", { pillar_axis: "y" }); if (free(x, z)) put(x, h(x, z) + 2, z, "minecraft:hay_block", { pillar_axis: "y" }); }   // the haystack
  if (c2) { const [x0, z0] = c2; for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { const x = x0 + i, z = z0 + j; if (!free(x, z)) continue; const y = h(x, z); put(x, y, z, "minecraft:farmland", { moisturized_amount: 7 }); put(x, y + 1, z, j === 0 ? "minecraft:carrots" : "minecraft:potatoes", { growth: 7 }); } }   // the kitchen garden   // given: farmland at its wettest
  if (d && farm.i % FIB[3] === 0) { const [x, z] = d, y = h(x, z); for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (free(x + i, z + j)) put(x + i, y + 1, z + j, "minecraft:cobblestone_wall"); put(x, y, z, "minecraft:water"); }   // the well   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
  // the chicken coop on a corner of the yard: a hut of three, a slab roof, a fenced run before it, its hens (and the farm's other beasts at the house)
  const cw = Math.ceil(house.atom.w / 2) + FIB[4], cl = Math.ceil(house.atom.l / 2) + FIB[4];   // vision: the farmstead's own measure (its coop, its run, its keys)
  const corner = [[house.x + cw, house.z + cl], [house.x - cw, house.z + cl], [house.x + cw, house.z - cl], [house.x - cw, house.z - cl]].find(([x, z]) => { for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (!free(x + i, z + j)) return false; return true; });   // derived: a corner five past the walls, seven square of it free
  const beasts = (BEASTS[t] ?? BEASTS.european).farm;
  if (corner && beasts.length) {
    const [x0, z0] = corner, y0 = h(x0, z0), wood = t === "japanese" ? "minecraft:bamboo_planks" : "minecraft:spruce_planks";
    for (let i = -1; i <= 1; i++) for (let j = -3; j <= -1; j++) { const x = x0 + i, z = z0 + j; put(x, y0, z, wood); if (i === 0 && j === -1) continue; if (Math.abs(i) === 1 || j === -3) put(x, y0 + 1, z, wood); put(x, y0 + 2, z, "minecraft:oak_slab", { "minecraft:vertical_half": "bottom" }); }   // the hut, its door to the run   // vision: the farmstead's own measure (its coop, its run, its keys)
    put(x0, y0 + 1, z0 - 2, "minecraft:hay_block", { pillar_axis: "y" });
    for (let i = -3; i <= 3; i++) for (let j = 0; j <= 3; j++) { const x = x0 + i, z = z0 + j; if (Math.abs(i) === 3 || j === 3) put(x, h(x, z) + 1, z, "minecraft:oak_fence"); }   // the run's fence   // vision: the farmstead's own measure (its coop, its run, its keys)
    for (let j = 0; j < FIB[3]; j++) spawn("minecraft:chicken", x0 + j - 1, h(x0, z0 + 1) + 1, z0 + 1);   // vision: the farmstead's own measure (its coop, its run, its keys)
    for (const b of beasts.filter((b) => b !== "minecraft:chicken")) spawn(b, x0, h(x0, z0 + 2) + 1, z0 + 2);
  }
  return spots.length;
}
/** The town's wall on its line: a palisade of logs (every other a block higher, pointed), a stone wall with its crenels, or an earth bank capped; the gates open, their posts raised. */
export function wallOf(wall, t, { put, H, dig = () => {}, stone = "minecraft:stone_bricks" }) {
  for (const [x, z] of wall.ditch ?? []) { const y = Math.round(H(x, z)); dig(x, y, z); dig(x, y - 1, z); put(x, y - 2, z, "minecraft:coarse_dirt"); }   // the ditch before the wall, two deep
  const h = (x, z) => Math.round(H(x, z)), log = t === "birchbark" ? "minecraft:birch_log" : t === "pacific" ? "minecraft:bamboo_block" : "minecraft:spruce_log";
  for (const [x, z] of wall.cells) {
    const y = h(x, z), odd = ((x + z) % 2 + 2) % 2 === 1;
    if (wall.kind === "palisade") { for (let k = 1; k <= FIB[4] - 1 + (odd ? 1 : 0); k++) put(x, y + k, z, log, { pillar_axis: "y" }); put(x, y + FIB[4] + (odd ? 1 : 0), z, log.replace("_log", "_fence").replace("bamboo_block", "bamboo_fence")); }   // vision: four logs (five every other), a point on each
    else if (wall.kind === "stone") { for (let k = 1; k <= FIB[4]; k++) put(x, y + k, z, stone); if (odd) put(x, y + FIB[4] + 1, z, stone); }   // vision: five high, a crenel every other
    else { for (let k = 1; k <= FIB[3]; k++) put(x, y + k, z, k === FIB[3] ? "minecraft:packed_mud" : "minecraft:mud_bricks"); put(x, y + FIB[3] + 1, z, t === "japanese" ? "minecraft:bamboo_fence" : "minecraft:deepslate_tile_slab"); }   // vision: an earth bank three high, its cap
  }
  // the towers: three by three, three over the wall, a stone one crenellated, a palisade's a log watch-post with its rail, an earth bank's a capped block
  for (const [x0, z0] of wall.towers ?? []) {
    const base = h(x0, z0), top = base + (wall.kind === "earth" ? FIB[3] : FIB[4]) + FIB[3];   // vision: the country's and the wall's own measure (in Fibonacci numbers; the hash keys)
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const x = x0 + a, z = z0 + b; for (let y = h(x, z) + 1; y <= top; y++) put(x, y, z, wall.kind === "palisade" ? log : wall.kind === "earth" ? "minecraft:mud_bricks" : stone, wall.kind === "palisade" ? { pillar_axis: "y" } : null);
      if (wall.kind === "stone" && (a || b) && (a + b) % 2 === 0) put(x, top + 1, z, stone);
      if (wall.kind === "palisade" && (a || b)) put(x, top + 1, z, log.replace("_log", "_fence").replace("bamboo_block", "bamboo_fence"));
      if (wall.kind === "earth") put(x, top + 1, z, "minecraft:deepslate_tile_slab"); }
  }
  const tall = wall.kind === "palisade" ? FIB[5] : FIB[5] + 1;   // vision: the gate posts over the wall
  for (const [x, z] of wall.gates) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Z = z + b; if (!wall.cells.some(([p, q]) => p === X && q === Z)) continue; const y = h(X, Z); for (let k = 1; k <= tall; k++) put(X, y + k, Z, wall.kind === "palisade" ? log : stone, wall.kind === "palisade" ? { pillar_axis: "y" } : null); }
  return wall.kind;
}
/** The wild ring past the fields: a lone tree, a flower. */
export function wildOf(wild, t, { put, H, free }) {
  const log = t === "birchbark" ? "minecraft:birch_log" : t === "japanese" ? "minecraft:cherry_log" : t === "pacific" || t === "shallow" || t === "indian_ocean" ? "minecraft:jungle_log" : "minecraft:oak_log";
  for (const [x, z, kind] of wild) { if (!free(x, z)) continue; const y = Math.round(H(x, z)); if (kind === "tree") tree(put, x, y, z, log, log.replace("_log", "_leaves"), FIB[3] + 1); else put(x, y + 1, z, FLOWERS[Math.abs(x * 7 + z * 3) % FLOWERS.length]); }   // vision: the farm's and the wall's own measure (in Fibonacci numbers; the hash keys)
}

// ---- the buffer between town and country (world/growth.js buffer): the cemetery by a main gate, the market gardens by the roads in
const GRAVE = {
  european: ["minecraft:cobblestone_wall", null], norse: ["minecraft:mossy_cobblestone", "minecraft:andesite"], japanese: ["minecraft:stone_brick_wall", "minecraft:stone_brick_slab"], east_asian: [null, null],
  therans: ["minecraft:quartz_pillar", null], indian_ocean: ["minecraft:sandstone_wall", null], arctic: ["minecraft:cobblestone", null], pacific: [null, null], shallow: [null, null], dugout: ["minecraft:spruce_fence", null], birchbark: ["minecraft:birch_fence", null],
};   // vision: each people's marker (a headstone, a rune stone, a lantern-capped post; the mound alone where none is raised)
export function cemeteryOf(cem, t, { put, H }) {
  const set = new Set(cem.cells.map(([x, z]) => `${x},${z}`)), h = (x, z) => Math.round(H(x, z)), edge = ([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !set.has(`${x + a},${z + b}`));
  const [mark, cap] = GRAVE[t] ?? GRAVE.european, wallId = t === "european" || t === "japanese" ? "minecraft:cobblestone_wall" : t === "therans" ? "minecraft:white_concrete" : "minecraft:spruce_fence";
  let gate = false;
  for (const c of cem.cells) {
    const [x, z] = c, y = h(x, z), lx = x - cem.x0, lz = z - cem.z0;
    put(x, y, z, t === "east_asian" || t === "pacific" ? "minecraft:grass_block" : "minecraft:podzol");
    if (edge(c)) { if (!gate && lx > 2 && lz === 0) { gate = true; continue; } put(x, y + 1, z, wallId); continue; }   // the wall round, a gap for its gate
    if (lx % 2 === 1 && lz % FIB[3] === 1) { if (mark) { put(x, y + 1, z, mark); if (cap) put(x, y + 2, z, cap, cap.endsWith("_slab") ? { "minecraft:vertical_half": "bottom" } : null); } put(x, y, z + 1, "minecraft:coarse_dirt"); }   // a grave: its marker, its mound   // vision: the graves two apart, rows three apart
  }
  const [tx, tz] = cem.cells.find(([x, z]) => x === cem.x0 + 1 && z === cem.z0 + 1) ?? cem.cells[0]; tree(put, tx, h(tx, tz), tz, "minecraft:spruce_log", "minecraft:spruce_leaves", FIB[4]);   // the yew in its corner   // vision: the buffer's own measure (its graves, gardens and keys)
  return "a cemetery";
}
export function gardenOf(g, t, { put, H, seed = 0 }) {
  const set = new Set(g.cells.map(([x, z]) => `${x},${z}`)), h = (x, z) => Math.round(H(x, z)), edge = ([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !set.has(`${x + a},${z + b}`));
  const crops = (CROPS[t] ?? CROPS.european).filter((c2) => c2 !== "taro"), fence = t === "japanese" ? "minecraft:bamboo_fence" : "minecraft:oak_fence";
  for (const c of g.cells) { const [x, z] = c, y = h(x, z), lx = x - g.x0; if (edge(c)) { put(x, y, z, "minecraft:grass_block"); put(x, y + 1, z, fence); continue; } if (lx % FIB[3] === 0) { put(x, y, z, "minecraft:water"); continue; } put(x, y, z, "minecraft:farmland", { moisturized_amount: 7 }); if (crops.length) put(x, y + 1, z, crops[(lx + seed) % crops.length], { growth: Math.floor(hashAt(x, z, seed) * 8) }); }   // given: farmland at its wettest, a crop's eight stages
  return "market gardens";
}
