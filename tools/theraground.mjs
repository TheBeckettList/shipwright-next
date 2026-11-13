// Thera's natural ground from above (world/thera.js theraHeight, before anyone builds): hill-shaded, the sea by depth.
//   node tools/theraground.mjs out.png [blocks a pixel]
import fs from "node:fs";
import { encode } from "./png.js";
const T = await import("../world/thera.js");
const out = process.argv[2] ?? "thera-ground.png", step = +(process.argv[3] ?? 8), R = T.THERA.REACH * 16, N = Math.floor((2 * R) / step), img = new Uint8Array(N * N * 3), H = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = T.theraHeight(-R + i * step, -R + j * step).h;
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = H[j * N + i], dx = (H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)]) / (2 * step), dz = (H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i]) / (2 * step), sh = Math.max(0.45, Math.min(1.25, 1 - (dx + dz) * 1.6));   // vision: light from the north-west
  const c = h <= 0 ? [Math.max(20, 110 + h * 2), Math.max(50, 160 + h * 2), 215] : h < 3 ? [214, 204, 160] : [110 + h, 150 + h * 0.4, 80 + h * 0.6].map((v) => Math.min(235, v));
  img.set(c.map((v) => Math.min(255, v * (h > 0 ? sh : 1))), (j * N + i) * 3); }
fs.writeFileSync(out, encode(N, N, img, 3)); console.log(out, `${N}x${N}, ${step} blocks a pixel`);
