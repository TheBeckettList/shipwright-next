// A box of Thera as the game lays it, drawn isometric through the pack's textures: the ground's top few blocks
// (game/ground.js, the city map loaded) and the baked structures over them.
//   node tools/isobox.mjs <x> <z> <half-width> out.png [turns]     (after a bake: reads dist/)
import fs from "node:fs";
const R0 = process.cwd();
const { loadMap } = await import(R0 + "/world/load.js"); loadMap();
const G = await import(R0 + "/game/ground.js");
const C = await import(R0 + "/dist/Waterworld_BP/scripts/data/city.js");
const rle = Buffer.from(C.RLE, "base64"), grid = new Uint8Array(C.N * C.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const v = rle[i], n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(v, k, k + n); k += n; }
G.useCity(grid, C.N); G.useTarn(C.TARN); G.useCascade(C.POOLS);
const S = await import(R0 + "/dist/Waterworld_BP/scripts/data/structures.js");
const { encode } = await import(R0 + "/tools/png.js"), { iso } = await import(R0 + "/tools/iso.js");
const [cx, cz, half] = process.argv.slice(2, 5).map(Number), out = process.argv[5], turns = +(process.argv[6] ?? 0);
const x0 = cx - half, z0 = cz - half, N = 2 * half, vox = new Map();
const rot = (x, z) => { let a = x - cx, b = z - cz; for (let t = 0; t < turns; t++) [a, b] = [-b, a]; return [a, b]; };
const set = (x, y, z, id) => { const [a, b] = rot(x, z); if (/air$/.test(id)) vox.delete(`${a},${y},${b}`); else vox.set(`${a},${y},${b}`, { id }); };
for (let qz = Math.floor(z0 / 16); qz <= Math.floor((z0 + N) / 16); qz++) for (let qx = Math.floor(x0 / 16); qx <= Math.floor((x0 + N) / 16); qx++) { const { cols } = G.chunkColumns(qx, qz);
  for (const c of cols) { if (c.x < x0 || c.z < z0 || c.x >= x0 + N || c.z >= z0 + N) continue; for (let y = c.top - 2; y <= c.top; y++) set(c.x, y, c.z, y === c.top ? c.topId : c.underId ?? "minecraft:dirt"); if (c.water > c.top) set(c.x, c.water, c.z, "minecraft:water"); else if (c.top < G.SEA) set(c.x, G.SEA, c.z, "minecraft:water"); } }
const dec = (b) => { const buf = Buffer.from(b, "base64"); return new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2); };
for (const p of S.PLACEMENTS) { const [pi, px, py, pz, , fl, bx0, bz0, bx1, bz1] = p; if (bx1 < x0 || bz1 < z0 || bx0 >= x0 + N || bz0 >= z0 + N) continue; const a = dec(S.PROTOS[pi].f), turn = (fl >> 3) & 3;
  for (let q = 0; q < a.length; q += 4) { let dx = a[q], dz = a[q + 2]; for (let t = 0; t < turn; t++) [dx, dz] = [-dz, dx]; const x = px + dx, z = pz + dz; if (x < x0 || z < z0 || x >= x0 + N || z >= z0 + N) continue; set(x, py + a[q + 1], z, S.PALETTE[a[q + 3]][0]); } }
const { w, h, img } = iso({ vox }); fs.writeFileSync(out, encode(w, h, img, 3)); console.log(out, w, h, vox.size);
