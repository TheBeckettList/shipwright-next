// The city plan on natural Thera: the whole island (2 blocks a pixel) and the city close up (1 block a
// pixel), drawn over the relief, for tools/citymap.py to label.   node tools/citymap.mjs out_prefix
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
import { THERA, theraMetres, PLACES } from "../world/thera.js";
import { cityAt, CITY_PLACES, quarterSeeds } from "../world/city.js";
const here = path.dirname(fileURLToPath(import.meta.url));
loadMap();
const prefix = process.argv[2] ?? "city";
// vision: the plan's colours
const KIND = { "round harbour": [40, 95, 160], "merchant harbour": [45, 105, 165], fairway: [55, 120, 180], "ring canal": [70, 140, 190], "wall canal": [70, 140, 190], canal: [80, 150, 200], bay: [120, 175, 210],
  "harbour master's island": [235, 225, 200], shipsheds: [150, 120, 90], quay: [205, 195, 175], "the Exchange": [230, 170, 60], "inner city": [238, 232, 220], street: [200, 190, 175], stairs: [175, 160, 140],
  acropolis: [250, 250, 245], "the Library": [120, 70, 150], "cliff town": [215, 200, 180], "the Light": [255, 60, 40], "stilt quarter": [150, 120, 80], "Theran town": [248, 248, 244] };
const CULT = { norse: [140, 90, 60], european: [170, 60, 60], birchbark: [215, 205, 170], pacific: [60, 150, 90], indian_ocean: [210, 150, 80], east_asian: [190, 80, 60], japanese: [220, 150, 170], dugout: [110, 70, 50], shallow: [150, 120, 80], arctic: [200, 215, 225] };
function draw(file, cx, cy, halfKm, bpp) {
  const n = Math.round((2 * halfKm * THERA.KM) / bpp), out = new Uint8Array(n * n * 3), hs = new Float32Array(n * n);
  const at = (i, j) => [cx - halfKm + (i * bpp) / THERA.KM, cy + halfKm - (j * bpp) / THERA.KM];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const [x, y] = at(i, j); hs[j * n + i] = theraMetres(x, y).m / THERA.M; }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const [x, y] = at(i, j), c = cityAt(x, y), h = hs[j * n + i];
    let col;
    if (c.kind === "quarter") col = CULT[c.culture];
    else if (KIND[c.kind]) col = KIND[c.kind];
    else if (c.kind === "sea") { const t = Math.min(1, -h / 35); col = [150 - 110 * t, 200 - 110 * t, 225 - 70 * t]; }   // vision: as the island map
    else col = h > 60 ? [168, 140, 100] : h > 25 ? [150, 160, 100] : [175, 180, 125];   // vision: land by height
    let shade = 1;
    if (h > 0 && i > 0 && j > 0 && i < n - 1 && j < n - 1) shade = Math.max(0.55, Math.min(1.2, 1 + (-(hs[j * n + i + 1] - hs[j * n + i - 1]) - (hs[(j + 1) * n + i] - hs[(j - 1) * n + i])) / (2 * bpp) * 0.9));   // vision: light from the north-west
    if (c.kind === "quarter" && (fbm2(i, j))) shade *= 0.88;
    out.set(col.map((v) => Math.max(0, Math.min(255, Math.round(v * shade)))), (j * n + i) * 3);
  }
  const tmp = fs.mkdtempSync("/tmp/city-");
  fs.writeFileSync(path.join(tmp, "rgb.bin"), Buffer.from(out.buffer));
  const places = [...CITY_PLACES({ quarters: halfKm <= 5 }), ...(halfKm > 5 ? PLACES.filter(([n]) => !/Bay|Pre-Kameni|caldera|plain|East shore/.test(n)) : [])].map(([name, x, y]) => [name, (x - (cx - halfKm)) * THERA.KM / bpp, ((cy + halfKm) - y) * THERA.KM / bpp]);
  fs.writeFileSync(path.join(tmp, "meta.json"), JSON.stringify({ n, bpp, places, legend: halfKm <= 5 }));
  execFileSync("python3", [path.join(here, "citymap.py"), tmp, file], { stdio: "inherit" });
}
const fbm2 = (i, j) => ((i * 7 + j * 13) % 9) === 0;   // vision: a fleck of roofs in the quarters
const B = THERA.bay;
draw(`${prefix}_island.png`, 1.2, 1.0, 10.5, 2);   // vision: the island's frame (km)
draw(`${prefix}_bay.png`, B.x - 0.6, B.y + 0.6, 3.9, 1);   // vision: the city's frame (km)
const S = quarterSeeds(), count = {}; for (const s of S) count[s.culture] = (count[s.culture] ?? 0) + 1;
import("../world/towns.js").then(({ towns }) => { for (const t of towns()) console.log(`  ${t.name.padEnd(12)} ${t.kind.padEnd(13)} ${t.h} blocks up; builds ${Math.round(t.blend.cave * 100)}% cave, ${Math.round(t.blend.akrotiri * 100)}% Akrotiri, ${Math.round(t.blend.whitewash * 100)}% whitewash`); });
console.log(`${S.length} quarters:`, Object.entries(count).map(([k, v]) => `${k} ${v}`).join(", "));
