// The world lens's map: draws the sea world's math as a picture (no game needed).
//   node tools/lab/worldmap.mjs [seed] [size blocks] [blocks per pixel] [out.ppm]
import fs from "node:fs";
import { elevation, climate, place, SEA_LEVEL } from "../../BP/scripts/world/terrain.js";
import { lanesNear, toLane, peopleAt, confederation, seatAt, CONFED_CELL } from "../../BP/scripts/world/peoples.js";

export const BIOME_RGB = {
  ice_sheet: [240, 246, 250], tundra: [205, 214, 210], snowy_taiga: [150, 170, 160], taiga: [60, 96, 70], old_growth: [40, 74, 52], steppe: [150, 150, 100],
  forest: [70, 130, 60], birch_forest: [130, 170, 90], rainforest: [36, 90, 50], plains: [120, 175, 80], cherry_grove: [235, 160, 190], scrubland: [170, 160, 100],
  desert: [230, 210, 150], badlands: [200, 110, 60], savanna: [180, 175, 90], bamboo_forest: [120, 190, 70], dry_forest: [150, 150, 70], lowland_forest: [40, 120, 50],
  jungle: [20, 140, 40], palm_isle: [100, 190, 110], mangrove: [90, 100, 60], salt_marsh: [100, 130, 100], beach: [240, 225, 170], stony_shore: [140, 140, 140],
  snowy_beach: [220, 225, 230], highlands: [120, 120, 115], peaks: [250, 250, 250], volcanic: [60, 40, 40], mushroom_isle: [170, 110, 170],
  deep_ocean: [24, 52, 110], open_sea: [44, 90, 160], frozen_sea: [120, 150, 190], pack_ice: [200, 220, 240], kelp_forest: [40, 100, 100], seagrass: [60, 140, 150], coral_reef: [70, 190, 200], lagoon: [100, 200, 210],
};
export const LAND = { polar: [236, 240, 244], boreal: [74, 104, 70], temperate: [96, 150, 72], dry: [168, 160, 96], arid: [222, 204, 150], savanna: [170, 168, 82], tropical: [64, 168, 80], wet: [92, 110, 64] };
export const CULTURE = { arctic: [200, 220, 255], norse: [180, 60, 50], birchbark: [240, 240, 220], european: [70, 90, 200], japanese: [230, 120, 160], east_asian: [220, 60, 40], indian_ocean: [240, 180, 40], pacific: [40, 200, 180], shallow: [120, 90, 60], dugout: [140, 70, 140] };

export function render(seed, x0, z0, size, step, opts = {}) {
  const n = Math.floor(size / step);
  const px = new Uint8Array(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * step, z = z0 + j * step;
    let c;
    if (opts.biomes) {
      const p = place(seed, x, z);
      c = [...BIOME_RGB[p.biome]];
      if (p.land) c = c.map((v) => v * (0.85 + Math.min(0.3, (p.top - SEA_LEVEL) / 60)));
      else c = c.map((v) => v * (1.1 - Math.min(0.4, p.depth / 60)));
      px.set(c.map((v) => Math.max(0, Math.min(255, Math.round(v)))), (j * n + i) * 3);
      continue;
    }
    const e = elevation(seed, x, z);
    px.set(c.map((v) => Math.max(0, Math.min(255, Math.round(v)))), (j * n + i) * 3);
  }
  // lanes
  if (opts.lanes) {
    const seen = new Set();
    for (let cx = Math.floor(x0 / CONFED_CELL) - 1; cx <= Math.floor((x0 + size) / CONFED_CELL) + 1; cx++)
      for (let cz = Math.floor(z0 / CONFED_CELL) - 1; cz <= Math.floor((z0 + size) / CONFED_CELL) + 1; cz++)
        for (const l of lanesNear(seed, cx * CONFED_CELL + 1, cz * CONFED_CELL + 1)) {
          const k = `${l.a.x},${l.a.z},${l.b.x},${l.b.z}`;
          if (seen.has(k)) continue;
          seen.add(k);
          const L = Math.hypot(l.b.x - l.a.x, l.b.z - l.a.z);
          for (let s = 0; s <= L; s += step / 2) {
            const x = l.a.x + ((l.b.x - l.a.x) * s) / L, z = l.a.z + ((l.b.z - l.a.z) * s) / L;
            const i = Math.floor((x - x0) / step), j = Math.floor((z - z0) / step);
            if (i < 0 || j < 0 || i >= n || j >= n) continue;
            if ((s / step) % 6 < 3) px.set(l.kind === "far" ? [255, 230, 120] : [250, 250, 250], (j * n + i) * 3);
          }
        }
  }
  for (const m of opts.marks ?? []) {
    const i = Math.floor((m.x - x0) / step), j = Math.floor((m.z - z0) / step);
    for (let a = -m.r; a <= m.r; a++) for (let b = -m.r; b <= m.r; b++) {
      const ii = i + a, jj = j + b;
      if (ii >= 0 && jj >= 0 && ii < n && jj < n) px.set(m.c, (jj * n + ii) * 3);
    }
  }
  return { n, px };
}

export function savePPM(file, { n, px }) {
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`P6 ${n} ${n} 255\n`), Buffer.from(px)]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [seed = "12345", size = "12000", step = "16", out = "map.ppm"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const S = +size;
  const t = Date.now();
  const img = render(+seed, -S / 2, -S / 2, S, +step, { lanes: true, culture: !process.argv.includes("--biomes"), biomes: process.argv.includes("--biomes") });
  savePPM(out, img);
  console.log(`map ${img.n}px in ${Date.now() - t} ms`);
}
