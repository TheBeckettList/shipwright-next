// Every building type in every people's hands (world/census.js buildOf): one labelled sheet a people, and the three sizes
// of a few types side by side. Writes PNGs and an index.html into outdir.
//   node tools/catalog.mjs outdir
import fs from "node:fs";
import path from "node:path";
import { encode } from "./png.js";
import { iso } from "./iso.js";
import { TYPES, NAMES, buildOf, nameOf } from "../world/census.js";
const out = process.argv[2] ?? "catalog"; fs.mkdirSync(out, { recursive: true });
const VAN = JSON.parse(fs.readFileSync(new URL("../lab/bedrock_blocks.json", import.meta.url), "utf8")).blocks;
const LABEL = { norse: "Norse", european: "European", therans: "Therans", indian_ocean: "Indian Ocean", east_asian: "East Asian", japanese: "Japanese", pacific: "Pacific", dugout: "Northwest Coast", birchbark: "Birchbark", shallow: "Shallow-water", arctic: "Arctic" };
const KINDS = ["home", "work", "store", "trade", "civic", "guard", "faith", "harbour"];
const ids = Object.keys(TYPES).sort((a, b) => KINDS.indexOf(TYPES[a].kind) - KINDS.indexOf(TYPES[b].kind));
// a tiny 5x7 font for the labels (the sheet is one image; no text renderer needed)
const GLYPH = { a: "0111010001111111000110001", b: "1111010001111101000111110", c: "0111110000100001000001111", d: "1111010001100011000111110", e: "1111110000111101000011111", f: "1111110000111101000010000", g: "0111110000100111000101111", h: "1000110001111111000110001", i: "0111000100001000010001110", j: "0011100010000101001001100", k: "1000110010111001001010001", l: "1000010000100001000011111", m: "1000111011101011000110001", n: "1000111001101011001110001", o: "0111010001100011000101110", p: "1111010001111101000010000", q: "0111010001101011001001101", r: "1111010001111101001010001", s: "0111110000011100000111110", t: "1111100100001000010000100", u: "1000110001100011000101110", v: "1000110001100010101000100", w: "1000110001101011101110001", x: "1000101010001000101010001", y: "1000101010001000010000100", z: "1111100010001000100011111", " ": "0000000000000000000000000", "'": "0010000100000000000000000", "-": "0000000000111110000000000", ",": "0000000000000000010001000", "(": "0001000100001000010000010", ")": "0100000100001000010001000", "0": "0111010011101011100101110", "1": "0010001100001000010001110", "2": "1111000001011101000011111", "3": "1111000001011100000111110", "4": "1001010010111110001000010", "5": "1111110000111100000111110", "6": "0111110000111101000101110", "7": "1111100001000100010000100", "8": "0111010001011101000101110", "9": "0111010001011110000111110", x2: "" };   // vision: a 5 by 5 pixel face for the sheet's labels
function text(img, W, x0, y0, s, col = [40, 40, 40], k = 2) { let x = x0; for (const ch of s.toLowerCase()) { const g = GLYPH[ch] ?? GLYPH[" "]; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j * 5 + i] === "1") for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { const X = x + i * k + a, Y = y0 + j * k + b; if (X >= 0 && X < W) img.set(col, (Y * W + X) * 3); } x += 6 * k; } }
const CW = 300, CH = 260, COLS = 10;   // vision: a cell of the sheet
const bad = new Set(), sheets = [];
for (const [ti, t] of Object.keys(NAMES).entries()) {
  const rows = Math.ceil(ids.length / COLS), W = CW * COLS, H = CH * rows + 40, img = new Uint8Array(W * H * 3).fill(246);
  text(img, W, 12, 10, `${LABEL[t]}: every building`, [20, 20, 20], 3);
  ids.forEach((id, n) => {
    const b = buildOf(id, t, n * 13 + ti * 5, 1);
    for (const v of b.vox.values()) if (!VAN[v.id] && v.id !== "minecraft:air") bad.add(v.id);
    const p = iso({ vox: b.vox }), s = Math.min(1, (CW - 12) / p.w, (CH - 44) / p.h), cx = (n % COLS) * CW, cy = 40 + Math.floor(n / COLS) * CH;
    const w = Math.round(p.w * s), h = Math.round(p.h * s), ox = cx + Math.floor((CW - w) / 2), oy = cy + 4 + Math.floor((CH - 44 - h) / 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.min(p.w - 1, Math.floor(x / s)), sy = Math.min(p.h - 1, Math.floor(y / s)), o = (sy * p.w + sx) * 3; if (p.img[o] === 246 && p.img[o + 1] === 246 && p.img[o + 2] === 246) continue; img.set(p.img.subarray(o, o + 3), ((oy + y) * W + ox + x) * 3); }
    text(img, W, cx + 8, cy + CH - 36, nameOf(id, t).slice(0, 24), [30, 30, 30], 2);
    text(img, W, cx + 8, cy + CH - 20, `${TYPES[id].kind}, ${b.dims ? `${b.dims.w}x${b.dims.l}` : ""}`.slice(0, 24), [120, 120, 120], 2);
  });
  const f = `sheet_${t}.png`; fs.writeFileSync(path.join(out, f), encode(W, H, img, 3)); sheets.push({ t, f });
  console.log(`${t}: ${ids.length} buildings`);
}
// sizes: the house, the big house and the warehouse at small, middling and large, for each people
const SIZED = ["house", "bighouse", "warehouse"], sizes = [];
for (const t of Object.keys(NAMES)) for (const id of SIZED) for (const k of [0, 1, 2]) { const b = buildOf(id, t, 7, k), p = iso({ vox: b.vox }), f = `size_${t}_${id}_${k}.png`; fs.writeFileSync(path.join(out, f), encode(p.w, p.h, p.img, 3)); sizes.push({ t, id, k, f, dims: b.dims }); }
console.log(`not vanilla: ${[...bad].join(", ") || "none"}`);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = `:root{--bg:#f6f4ef;--ink:#1f2328;--mute:#6b6f76;--line:#dcd8cf;--card:#fff}@media (prefers-color-scheme:dark){:root{--bg:#16181b;--ink:#e8e6e1;--mute:#9a9ea5;--line:#30343a;--card:#1f2226}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:0 auto;padding:28px 20px 60px}h1{font-size:28px;margin:0 0 6px}h2{font-size:20px;margin:36px 0 8px}p{color:var(--mute);max-width:900px}
img{max-width:100%;border:1px solid var(--line);border-radius:8px;background:#f6f4ef}nav{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}nav a{border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--ink);text-decoration:none;font-size:13px;background:var(--card)}
.sz{display:grid;grid-template-columns:repeat(9,1fr);gap:6px}.sz figure{margin:0}.sz img{height:120px;object-fit:contain;width:100%}figcaption{font-size:11px;color:var(--mute)}`;
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Every building, every people</title><style>${css}</style></head><body><main>
<h1>Every building, every people</h1>
<p>All ${ids.length} building types in each of the eleven peoples' hands, at middling size, grouped by kind: homes, work, stores, trade, civic, guard, faith, harbour. Shops, workshops, stores and boathouses are smaller than before, because a metal's room is now sized by its ion. Below the sheets: the house, the big house and the warehouse at small, middling and large for every people.</p>
<nav>${sheets.map((s) => `<a href="#${s.t}">${LABEL[s.t]}</a>`).join("")}<a href="#sizes">Sizes</a></nav>
${sheets.map((s) => `<h2 id="${s.t}">${LABEL[s.t]}</h2><img src="${s.f}" alt="${LABEL[s.t]} buildings" loading="lazy">`).join("")}
<h2 id="sizes">Sizes: small, middling, large</h2>
${Object.keys(NAMES).map((t) => `<h3>${LABEL[t]}</h3><div class="sz">${sizes.filter((x) => x.t === t).map((x) => `<figure><img src="${x.f}" alt="" loading="lazy"><figcaption>${esc(nameOf(x.id, t))}, ${["small", "middling", "large"][x.k]}${x.dims ? `, ${x.dims.w}x${x.dims.l}` : ""}</figcaption></figure>`).join("")}</div>`).join("")}
</main></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
