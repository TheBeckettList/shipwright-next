// Thera from above as the game lays it: the ground (game/ground.js, the city map loaded) under the baked structures' top blocks, hill-shaded.
//   node tools/structmap.mjs <x> <z> <half-width> out.png      (after a bake: reads dist/)
import fs from "node:fs";
const R0 = process.cwd();
const { loadMap } = await import(R0 + "/world/load.js"); loadMap();
const G = await import(R0 + "/game/ground.js");
const C = await import(R0 + "/dist/Waterworld_BP/scripts/data/city.js");
const rle = Buffer.from(C.RLE, "base64"), grid = new Uint8Array(C.N * C.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const v = rle[i], n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(v, k, k + n); k += n; }
G.useCity(grid, C.N); G.useTarn(C.TARN); G.useCascade(C.POOLS);
const S = await import(R0 + "/dist/Waterworld_BP/scripts/data/structures.js");
const { encode } = await import(R0 + "/tools/png.js");
const [cxB, czB, half] = process.argv.slice(2, 5).map(Number), out = process.argv[5];
const x0 = cxB - half, z0 = czB - half, N = 2 * half;
const top = new Int16Array(N * N).fill(-999), id = new Array(N * N);
for (let cz = Math.floor(z0 / 16); cz <= Math.floor((z0 + N) / 16); cz++) for (let cx = Math.floor(x0 / 16); cx <= Math.floor((x0 + N) / 16); cx++) { const { cols } = G.chunkColumns(cx, cz);
  for (const c of cols) { const i = c.x - x0, j = c.z - z0; if (i < 0 || j < 0 || i >= N || j >= N) continue; const k = j * N + i; top[k] = c.water && c.water > c.top ? c.water : c.top; id[k] = c.water && c.water > c.top ? "water" : c.topId; } }
const dec = (b) => { const buf = Buffer.from(b, "base64"); return new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2); }, cache = new Map();
for (const p of S.PLACEMENTS) { const [pi, px, py, pz, , fl, bx0, bz0, bx1, bz1] = p; if (bx1 < x0 || bz1 < z0 || bx0 >= x0 + N || bz0 >= z0 + N) continue;
  let a = cache.get(pi); if (!a) cache.set(pi, (a = dec(S.PROTOS[pi].f))); const turn = (fl >> 3) & 3;
  for (let q = 0; q < a.length; q += 4) { let dx = a[q], dz = a[q + 2]; for (let t = 0; t < turn; t++) [dx, dz] = [-dz, dx]; const x = px + dx, y = py + a[q + 1], z = pz + dz, i = x - x0, j = z - z0; if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const bid = S.PALETTE[a[q + 3]][0]; if (/air$/.test(bid)) continue; const k = j * N + i; if (y >= top[k]) { top[k] = y; id[k] = bid; } } }
const col = (s) => { s = (s ?? "").replace(/^.*:/, "");
  if (s === "water") return [50, 90, 180]; if (/blue_glazed|blue_concrete|light_blue/.test(s)) return [60, 110, 200]; if (/gold/.test(s)) return [230, 190, 60];
  if (/theran_marble_tile/.test(s)) return [236, 230, 214]; if (/theran_marble|quartz|calcite/.test(s)) return [248, 246, 240]; if (/minoan/.test(s)) return [170, 50, 40];
  if (/leaves|azalea/.test(s)) return [70, 130, 60]; if (/grass|moss/.test(s)) return [110, 170, 70]; if (/sand/.test(s)) return [220, 205, 150]; if (/log|planks|wood/.test(s)) return [140, 100, 60];
  if (/tuff|stone|gravel|andesite|cobble/.test(s)) return [130, 130, 130]; if (/cornflower|bluet|allium|lily|daisy|dandelion|poppy|tulip|flower/.test(s)) return [200, 120, 200]; if (/lantern/.test(s)) return [255, 230, 120]; return [200, 80, 200]; };
const img = new Uint8Array(N * N * 3);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i, c = col(id[k]), dzs = (top[Math.min(N * N - 1, k + N)] - top[Math.max(0, k - N)]) / 2, dxs = (top[Math.min(N * N - 1, k + 1)] - top[Math.max(0, k - 1)]) / 2, sh = Math.max(0.55, Math.min(1.25, 1 - 0.12 * (dxs + dzs)));
  img.set(c.map((v) => Math.min(255, v * sh)), k * 3); }
fs.writeFileSync(out, encode(N, N, img, 3)); console.log(out, N);
