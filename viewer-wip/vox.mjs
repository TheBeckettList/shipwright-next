// inherency: instrument
// The built world in 3D, block for block: lays chunks of the built add-on (dist/) with the stand-in for the game's
// API (as view.mjs does) and writes every block that can be seen (one with air, water or glass beside it) for the
// world viewer's 3D view, each with its colour and which of its faces show.
//   node tools/modtest/vox.mjs <cx0> <cz0> <nx> <nz> out.bin out.json
// out.bin: Uint16 records of five: x, y + 64, z (blocks from the region's corner), colour index, face mask
// (bit 0 x-, 1 x+, 2 y-, 3 y+, 4 z-, 5 z+; bit 6 marks see-through blocks: glass, water, leaves).
// out.json: { x0, z0, nx, nz, palette: [[r, g, b, a]], names: [id], count }
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, "scripts_vox");
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(path.join(here, "../../dist/Waterworld_BP/scripts"), S, { recursive: true });
const { mockDim } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
await imp("main.js");
const { blocks } = await import("@minecraft/server"), L = await imp("lay.js");
const { CUSTOM } = await import("../../world/carvings.js");
const [cx0, cz0, nx, nz, outBin, outJson] = [+process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], process.argv[6], process.argv[7]];
const W = nx * 16, D = nz * 16, YMIN = -64;

// Colours: the mod's own blocks by the colour they were drawn with; vanilla by a table, then by their names.
const custom = Object.fromEntries(CUSTOM.map((b) => [b.id, b.colour]));
const DYE = { white: [234, 236, 236], orange: [240, 118, 19], magenta: [189, 68, 179], light_blue: [58, 175, 217], yellow: [248, 197, 39], lime: [112, 185, 25], pink: [237, 141, 172], gray: [62, 68, 71], light_gray: [142, 142, 134], cyan: [21, 137, 145], purple: [121, 42, 172], blue: [53, 57, 157], brown: [114, 71, 40], green: [84, 109, 27], red: [161, 39, 34], black: [20, 21, 25] };   // given: vanilla's dye colours
const FIX = { water: [44, 90, 180, 150], grass_block: [98, 152, 62], sand: [219, 207, 163], red_sand: [190, 102, 33], stone: [125, 125, 125], gravel: [136, 126, 126], dirt: [134, 96, 67], coarse_dirt: [119, 85, 59], podzol: [91, 63, 24], mud: [60, 57, 61], clay: [160, 166, 179], calcite: [223, 224, 220], tuff: [108, 109, 102], basalt: [80, 81, 86], blackstone: [42, 36, 41], deepslate: [80, 80, 82], diorite: [188, 188, 188], andesite: [136, 136, 136], granite: [149, 103, 85], quartz: [235, 229, 222], smooth_quartz: [236, 230, 223], sandstone: [216, 203, 155], smooth_sandstone: [223, 214, 170], snow: [249, 254, 254], ice: [145, 183, 253, 180], packed_ice: [141, 180, 250], blue_ice: [116, 167, 253], moss_block: [89, 109, 45], mud_bricks: [137, 103, 79], bricks: [150, 97, 83], terracotta: [152, 94, 67], prismarine: [99, 156, 151], prismarine_bricks: [99, 171, 158], dark_prismarine: [51, 91, 75], sea_lantern: [172, 199, 190], glowstone: [171, 131, 84], gold_block: [246, 208, 61], iron_block: [220, 220, 220], copper_block: [192, 107, 79], lily_pad: [32, 128, 48], bamboo: [93, 144, 19], sugar_cane: [148, 192, 101], cactus: [85, 127, 43], hay_block: [166, 139, 12], barrel: [134, 100, 58], bookshelf: [117, 94, 59], crafting_table: [120, 73, 42], torch: [255, 200, 90], lantern: [220, 160, 80], soul_lantern: [110, 200, 210], iron_chain: [60, 66, 80], iron_bars: [110, 110, 110] };   // vision: a colour a block for the 3D view
const WOOD = { oak: [162, 130, 78], spruce: [114, 84, 48], birch: [192, 175, 121], jungle: [160, 115, 80], acacia: [168, 90, 50], dark_oak: [66, 43, 20], mangrove: [117, 54, 48], cherry: [226, 178, 172], bamboo: [193, 173, 80], pale_oak: [228, 217, 213], crimson: [101, 48, 70], warped: [43, 104, 99] };   // vision: the planks' colours
const LEAF = { oak: [72, 128, 40], spruce: [56, 96, 56], birch: [110, 150, 70], jungle: [60, 140, 30], acacia: [90, 130, 40], dark_oak: [50, 100, 30], mangrove: [80, 130, 40], cherry: [240, 175, 205], azalea: [90, 128, 50], flowering_azalea: [120, 140, 80], pale_oak: [160, 168, 150] };   // vision: the leaves' colours
const hash = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
function colourOf(id) {
  if (custom[id]) return [...custom[id].slice(0, 3), 255];
  const n = id.replace(/^minecraft:/, "").replace(/^waterworld:/, "");
  if (FIX[n]) return FIX[n].length === 4 ? FIX[n] : [...FIX[n], 255];
  const glass = /glass/.test(n);
  for (const [d, c] of Object.entries(DYE).sort((a, b) => b[0].length - a[0].length)) if (n.startsWith(d + "_") || n.includes("_" + d + "_")) {
    if (/concrete|wool|carpet|glazed/.test(n)) return [...c, glass ? 140 : 255];
    if (/terracotta/.test(n)) return [...c.map((v, i) => Math.round(v * 0.62 + [152, 94, 67][i] * 0.38)), 255];
    if (glass) return [...c, 130];
  }
  if (glass) return [200, 225, 235, 110];
  for (const [w, c] of Object.entries(LEAF)) if (n.startsWith(w + "_leaves")) return [...c, 255];
  if (/leaves/.test(n)) return [70, 120, 45, 255];
  for (const [w, c] of Object.entries(WOOD)) if (n.startsWith(w + "_") || n.startsWith("stripped_" + w)) return /log|wood|stem/.test(n) && !n.startsWith("stripped") ? [...c.map((v) => v * 0.6), 255] : [...c, 255];
  for (const [k, c] of Object.entries(FIX).sort((a, b) => b[0].length - a[0].length)) if (n.includes(k)) return c.length === 4 ? c : [...c, 255];
  if (/flower|tulip|poppy|dandelion|orchid|allium|lilac|rose|peony|daisy|cornflower|lily_of/.test(n)) { const h = hash(n); return [200 + (h & 55), 80 + ((h >> 8) & 120), 90 + ((h >> 16) & 120), 255]; }
  if (/grass|fern|bush|vine|kelp|seagrass/.test(n)) return [90, 140, 60, 255];
  const h = hash(n); return [90 + (h & 127), 90 + ((h >> 8) & 127), 90 + ((h >> 16) & 127), 255];
}
const SEE = (id) => id === "minecraft:air" || /water|glass|leaves|lantern|torch|flower|grass$|fern|bush|vine|kelp|seagrass|lily_pad|carpet|chain|bars|fence|wall|pane|slab|stairs|button|sign|banner|candle|rail|ladder|door|trapdoor|sapling|tulip|poppy|dandelion|orchid|allium|lilac|rose|peony|daisy|cornflower/.test(id);   // vision: what the eye sees past

const cells = new Map(), key = (x, y, z) => (y - YMIN) * W * D + z * W + x;
for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
  blocks.clear(); const g = L.layTo(mockDim, cx0 + a, cz0 + b, 2, { folk: false }); while (!g.next().done);
  for (const [k, id] of blocks) { if (id === "minecraft:air") continue; const [x, y, z] = k.split(",").map(Number), i = x - cx0 * 16, j = z - cz0 * 16; if (i < 0 || j < 0 || i >= W || j >= D) continue; cells.set(key(i, y, j), id); }
  if ((b * nx + a) % 64 === 0) process.stderr.write(`${b * nx + a}/${nx * nz} chunks\r`);
}
const pal = [], names = [], idx = new Map(), recs = [];
const at = (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D ? undefined : cells.get(key(x, y, z)));
for (const [k, id] of cells) {
  const y = Math.floor(k / (W * D)) + YMIN, r = k % (W * D), z = Math.floor(r / W), x = r % W;
  const see = SEE(id), water = /water/.test(id);
  let mask = 0;
  const nb = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
  nb.forEach(([dx, dy, dz], f) => {
    const o = at(x + dx, y + dy, z + dz);
    if (water) { if (f === 3 && (o === undefined || !/water/.test(o))) mask |= 1 << f; return; }   // the sea: its surface only
    if (o === undefined) { if (f !== 2 && !(x + dx < 0 || z + dz < 0 || x + dx >= W || z + dz >= D)) mask |= 1 << f; return; }
    if (SEE(o) && o !== id) mask |= 1 << f;
  });
  if (!mask) continue;
  if (!idx.has(id)) { idx.set(id, pal.length); pal.push(colourOf(id)); names.push(id); }
  recs.push(x, y - YMIN, z, idx.get(id), mask | (see ? 64 : 0));
}
fs.writeFileSync(outBin, Buffer.from(new Uint16Array(recs).buffer));
fs.writeFileSync(outJson, JSON.stringify({ x0: cx0 * 16, z0: cz0 * 16, nx: W, nz: D, ymin: YMIN, palette: pal, names, count: recs.length / 5 }));
console.log(`${recs.length / 5} blocks seen of ${cells.size}, ${names.length} kinds -> ${outBin}`);
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
