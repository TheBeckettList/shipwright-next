// Pure. Under the islands, worked out cheaply: caves as worm tunnels, a few per bigger island,
// winding down from near the surface to lava pools at the bottom (worked out once per island, as a
// list of spheres a chunk tests against); ores as veins, a handful per chunk at vanilla's depths.
// Per-block noise (the old way) cost tens of thousands of hash calls a chunk in the game's
// interpreter.
import { hash, rand } from "./noise.js";
import { groupsNear } from "./terrain.js";
import { FLOOR_MIN, SEA_LEVEL } from "./terrain.js";

export const DEEPSLATE_TOP = 24;

const wormCache = new Map();
/** An island group's caves: worms of spheres { x, y, z, r }, the last of each a lava pool. */
export function wormsOf(seed, g) {
  const key = `${seed}|${g.id}`;
  if (wormCache.has(key)) return wormCache.get(key);
  const out = [];
  if (!g.special || g.special === "mushroom") {
    const n = g.great ? 7 : 2 + (hash(g.gx, g.gz, seed, 601) % 2);
    for (let w = 0; w < n; w++) {
      const a = rand(g.gx, g.gz, w, seed, 602) * Math.PI * 2, d = rand(g.gx, g.gz, w, seed, 603) * g.R * 0.6;
      let x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d, y = SEA_LEVEL - 2 - (hash(g.gx, g.gz, w, seed, 604) % 6);
      let yaw = rand(g.gx, g.gz, w, seed, 605) * Math.PI * 2, pitch = -0.25;
      const len = 40 + (hash(g.gx, g.gz, w, seed, 606) % 50);
      const pts = [];
      for (let i = 0; i < len && y > FLOOR_MIN + 4; i++) {
        const r = 1.4 + rand(g.gx, g.gz, w, i, seed, 607) * 1.6;
        pts.push({ x, y, z, r });
        yaw += (rand(g.gx, g.gz, w, i, seed, 608) - 0.5) * 0.6;
        pitch = Math.max(-0.7, Math.min(0.2, pitch + (rand(g.gx, g.gz, w, i, seed, 609) - 0.55) * 0.25));
        x += Math.cos(yaw) * 1.6; z += Math.sin(yaw) * 1.6; y += pitch * 1.6;
      }
      if (pts.length) { const last = pts[pts.length - 1]; out.push({ pts, lava: { x: last.x, y: Math.max(FLOOR_MIN + 2, last.y - 1), z: last.z, r: 3 } }); }
    }
  }
  wormCache.set(key, out);
  if (wormCache.size > 400) wormCache.delete(wormCache.keys().next().value);
  return out;
}

/**
 * The cave cells in a chunk's box (only where the column is land and the cell is below its top - 5):
 * a Map of "x,y,z" -> "air" | "lava".
 */
export function cavesIn(seed, x0, z0, x1, z1, topAt) {
  const cells = new Map();
  for (const g of groupsNear(seed, (x0 + x1) / 2, (z0 + z1) / 2)) {
    for (const w of wormsOf(seed, g)) {
      for (const s of [...w.pts, { ...w.lava, lava: true }]) {
        if (s.x + s.r < x0 || s.x - s.r > x1 || s.z + s.r < z0 || s.z - s.r > z1) continue;
        const r2 = s.r * s.r;
        for (let x = Math.max(x0, Math.floor(s.x - s.r)); x <= Math.min(x1, Math.ceil(s.x + s.r)); x++)
          for (let z = Math.max(z0, Math.floor(s.z - s.r)); z <= Math.min(z1, Math.ceil(s.z + s.r)); z++) {
            const top = topAt(x, z);
            if (top === null) continue;
            for (let y = Math.max(FLOOR_MIN + 1, Math.floor(s.y - s.r)); y <= Math.min(top - 5, Math.ceil(s.y + s.r)); y++) {
              const dx = x - s.x, dy = y - s.y, dz = z - s.z;
              if (dx * dx + dy * dy * 1.6 + dz * dz > r2) continue;
              const k = `${x},${y},${z}`;
              if (s.lava) { if (y <= s.y) cells.set(k, "minecraft:lava"); else if (!cells.has(k)) cells.set(k, "minecraft:air"); }
              else if (cells.get(k) !== "minecraft:lava") cells.set(k, "minecraft:air");
            }
          }
      }
    }
  }
  return cells;
}

/** Vanilla's ore depths, mapped onto our 16..110 world: [ore, deepslate ore, veins a land chunk, size, y from, y to]. */
export const ORE_VEINS = [
  ["coal_ore", "deepslate_coal_ore", 4, 8, 30, 120],
  ["copper_ore", "deepslate_copper_ore", 2, 7, 28, 80],
  ["iron_ore", "deepslate_iron_ore", 3, 6, 17, 90],
  ["gold_ore", "deepslate_gold_ore", 0.6, 5, 17, 40],
  ["lapis_ore", "deepslate_lapis_ore", 0.5, 5, 18, 48],
  ["redstone_ore", "deepslate_redstone_ore", 1.2, 6, 17, 32],
  ["diamond_ore", "deepslate_diamond_ore", 0.5, 4, 17, 27],
];

/** A chunk's ore veins: blocks { x, y, z, id } inside land columns' stone (below top - 3). */
export function veinsIn(seed, cx, cz, topAt, emeralds) {
  const out = [];
  let k = 0;
  for (const [ore, deep, per, size, lo, hi] of ORE_VEINS) {
    const n = Math.floor(per) + (rand(cx, cz, k, seed, 611) < per % 1 ? 1 : 0);
    for (let v = 0; v < n; v++, k++) {
      const x = cx * 16 + (hash(cx, cz, k, seed, 612) % 16), z = cz * 16 + (hash(cx, cz, k, seed, 613) % 16);
      const top = topAt(x, z);
      if (top === null) continue;
      const yTop = Math.min(hi, top - 4);
      if (yTop < lo) continue;
      let y = lo + (hash(cx, cz, k, seed, 614) % (yTop - lo + 1));
      let px = x, pz = z;
      for (let b = 0; b < size; b++) {
        const t = topAt(px, pz);
        if (t !== null && y < t - 3 && y > FLOOR_MIN) out.push({ x: px, y, z: pz, id: `minecraft:${y <= DEEPSLATE_TOP ? deep : ore}` });
        const step = hash(cx, cz, k, b, seed, 615) % 6;
        if (step === 0) px++; else if (step === 1) px--; else if (step === 2) pz++; else if (step === 3) pz--; else if (step === 4) y++; else y--;
        if (px < cx * 16 || px > cx * 16 + 15) px = Math.min(cx * 16 + 15, Math.max(cx * 16, px));
        if (pz < cz * 16 || pz > cz * 16 + 15) pz = Math.min(cz * 16 + 15, Math.max(cz * 16, pz));
      }
    }
  }
  if (emeralds) for (let v = 0; v < 2; v++) {
    const x = cx * 16 + (hash(cx, cz, v, seed, 616) % 16), z = cz * 16 + (hash(cx, cz, v, seed, 617) % 16);
    const t = topAt(x, z);
    if (t !== null && t > 70) out.push({ x, y: 60 + (hash(cx, cz, v, seed, 618) % Math.max(1, t - 64)), z, id: "minecraft:emerald_ore" });
  }
  return out;
}
