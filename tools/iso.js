// An isometric view of a voxel set through the pack's textures (shared by the drawing tools).
import { tileOf as vanillaTile, relief } from "../world/textures.js";
import { CUSTOM } from "../world/carvings.js";
const OWN = new Map(CUSTOM.map((b) => [b.id, b])), ownTiles = new Map();
/** The pack's own blocks drawn from their painters (world/carvings.js), vanilla's through world/textures.js. */
const tileOf = (id, f, face) => { const b = OWN.get(id); if (!b) return vanillaTile(id, f, face); const k = `${id}|${face}`; if (!ownTiles.has(k)) { const px = []; const fn = b.glass ? (u, v) => [...b.rgba(u, v).slice(0, 3), 0.5] : face === "top" ? b.end : b.side; for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) px.push(fn(u, v)); const rgb = relief(px, b.family); ownTiles.set(k, { rgb, w: 16, h: 16, mean: [0, 0, 0], mips: [rgb] }); } return ownTiles.get(k); };
const N = 16, S = 6;   // given: a tile; vision: pixels a block in the view   // given: a tile; vision: pixels a block in the view
// what to texture a block with: its own tile, or for blocks that aren't cubes, the stuff they're made of
const stuff = (id, d) => {
  const n = id.replace("minecraft:", "");
  if (n === "bed") return `minecraft:${d?.colour ?? "red"}_wool`;
  if (n.endsWith("_bed")) return `minecraft:${n.replace(/_bed$/, "")}_wool`;
  if (n.endsWith("_carpet")) return `minecraft:${n.replace(/_carpet$/, "")}_wool`;
  if (n.endsWith("_pane")) return n === "glass_pane" ? "minecraft:glass" : `minecraft:${n.replace(/_pane$/, "")}`;
  if (/lantern|campfire|torch|^water$|^web$/.test(n)) return null;
  const m = n.match(/^(stripped_)?(\w+?)_(door|trapdoor|fence|stairs|slab|fence_gate)$/); if (m) { const base = m[2]; return /oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo/.test(base) ? `minecraft:${base}_planks` : `minecraft:${base === "stone" ? "cobblestone" : base === "mud_brick" ? "mud_bricks" : base}`; }
  if (n === "ladder") return "minecraft:oak_planks";
  if (n === "grass_path" || n === "dirt_path") return "minecraft:coarse_dirt";   // the path drawn as the trodden earth it is
  return id;
};
const SPECIAL = { lantern: [255, 210, 90], campfire: [255, 120, 30], torch: [255, 200, 80], water: [52, 98, 178], web: [225, 225, 225] };   // vision: lights drawn as their glow
export function iso(h) {
  const cells = [...h.vox.entries()].map(([k, b]) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z, b }; });
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of cells) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
  const W = ((x1 - x0) + (z1 - z0) + 2) * S + 4, H = (((x1 - x0) + (z1 - z0) + 2) / 2 + (y1 - y0) + 2) * S + 4, img = new Uint8Array(W * H * 3).fill(246);
  const P = (x, y, z) => [Math.round((x - x0 - (z - z0) + (z1 - z0) + 1) * S) + 2, Math.round((((x - x0) + (z - z0)) / 2 - (y - y1) ) * S) + 2];
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) img.set(c.map((v) => Math.max(0, Math.min(255, Math.round(v)))), (y * W + x) * 3); };
  const THIN = /fence|_wall$|_bars$|fence_gate/, LOW = /wheat|carrots|potatoes|beetroot|_stem$|poppy|dandelion|cornflower|daisy|allium|bluet|fern|berry_bush|short_grass|sapling|bamboo$|sugar_cane|waterlily/;   // given: the blocks that aren't cubes
  const solid = (k) => { const b = h.vox.get(k); return !!b && !THIN.test(b.id) && !LOW.test(b.id) && !b.id.startsWith("entity:"); };
  const has = (x, y, z) => solid(`${x},${y},${z}`);
  cells.sort((a, b) => a.x + a.z - (b.x + b.z) || a.y - b.y);
  for (const c of cells) {
    const n = c.b.id.replace("minecraft:", ""), glow = Object.entries(SPECIAL).find(([k]) => n.includes(k))?.[1], src = stuff(c.b.id, c.b.d);
    const top = src && tileOf(src, 0, "top"), side = src && tileOf(src, 0, "side");
    const tex = (t, u, v) => (t ? [t.rgb[(v * N + u) * 3], t.rgb[(v * N + u) * 3 + 1], t.rgb[(v * N + u) * 3 + 2]] : glow ?? [200, 200, 200]);
    if (n.startsWith("entity:")) {   // a beast: a small body in its colour
      const BEAST = { cow: [70, 50, 40], sheep: [235, 235, 230], pig: [235, 160, 160], chicken: [250, 250, 245], horse: [140, 95, 55], goat: [215, 210, 200], camel: [205, 170, 110], wolf: [190, 190, 190] }, col = BEAST[n.replace("entity:", "").replace("minecraft:", "")] ?? [200, 80, 80];   // vision: each beast's coat
      for (let a = 0; a < S * 2; a++) for (let b = 0; b < S * 2; b++) { const fu = 0.2 + (0.6 * a) / (S * 2), fv = 0.25 + (0.5 * b) / (S * 2); let [px, py] = P(c.x + fu, c.y + 0.7, c.z + fv); put(px, py, col); [px, py] = P(c.x + fu, c.y + 0.7 - (0.6 * b) / (S * 2), c.z + 0.75); put(px, py, col.map((q) => q * 0.8)); }
      continue;
    }
    const thin = THIN.test(n), low = LOW.test(n);
    if (thin || low) {   // a post (with rails toward its like) or a tuft: drawn small, so a fence reads as a fence
      const lo = thin ? 0.375 : 0.2, hi = thin ? 0.625 : 0.8, topY = low ? 0.55 : 1, FLOWER = { poppy: [200, 40, 40], dandelion: [240, 210, 40], cornflower: [70, 100, 220], oxeye_daisy: [240, 240, 235], allium: [180, 90, 200], azure_bluet: [220, 225, 240], fern: [70, 130, 50], short_grass: [90, 150, 60], sweet_berry_bush: [60, 110, 50], wheat: [205, 180, 70], carrots: [90, 160, 50], potatoes: [80, 140, 60], beetroot: [140, 60, 70], melon_stem: [90, 150, 60], pumpkin_stem: [100, 150, 50], bamboo: [120, 170, 60] }, col = FLOWER[n] ?? tex(side, 8, 8);   // vision: a post a quarter of a block; a crop's tuft a little over half high; a flower or a crop its own colour
      const near = (dx, dz) => THIN.test(h.vox.get(`${c.x + dx},${c.y},${c.z + dz}`)?.id ?? "");
      const boxes = [[lo, hi, lo, hi, 0, topY]]; if (thin) { if (near(1, 0)) boxes.push([0.5, 1, 0.44, 0.56, 0.4, 0.9]); if (near(-1, 0)) boxes.push([0, 0.5, 0.44, 0.56, 0.4, 0.9]); if (near(0, 1)) boxes.push([0.44, 0.56, 0.5, 1, 0.4, 0.9]); if (near(0, -1)) boxes.push([0.44, 0.56, 0, 0.5, 0.4, 0.9]); }   // vision: the rails
      for (const [ax, bx, az, bz, ay, by] of boxes) for (let a = 0; a < S * 2; a++) for (let b = 0; b < S * 2; b++) { const fu = ax + ((bx - ax) * a) / (S * 2), fv = az + ((bz - az) * b) / (S * 2), fy = ay + ((by - ay) * b) / (S * 2); let [px, py] = P(c.x + fu, c.y + by, c.z + fv); put(px, py, low ? col.map((q) => q * (0.85 + 0.3 * ((a + b) % 2))) : col); [px, py] = P(c.x + fu, c.y + by - (fy - ay), c.z + bz); put(px, py, col.map((q) => q * 0.8)); [px, py] = P(c.x + bx, c.y + by - (fy - ay), c.z + az + ((bz - az) * a) / (S * 2)); put(px, py, col.map((q) => q * 0.62)); }
      continue;
    }
    for (let a = 0; a < S * 2; a++) for (let b = 0; b < S * 2; b++) {
      const u = Math.floor((a * N) / (S * 2)), v = Math.floor((b * N) / (S * 2)), fu = a / (S * 2), fv = b / (S * 2);
      if (!has(c.x, c.y + 1, c.z)) { const [px, py] = P(c.x + fu, c.y + 1, c.z + fv); put(px, py, tex(top, u, v)); }
      if (!has(c.x, c.y, c.z + 1)) { const [px, py] = P(c.x + fu, c.y + 1 - fv, c.z + 1); put(px, py, tex(side, u, v).map((q) => q * 0.8)); }   // vision: the game's face shades, roughly
      if (!has(c.x + 1, c.y, c.z)) { const [px, py] = P(c.x + 1, c.y + 1 - fv, c.z + 1 - fu); put(px, py, tex(side, u, v).map((q) => q * 0.62)); }
    }
  }
  return { w: W, h: H, img };
}

