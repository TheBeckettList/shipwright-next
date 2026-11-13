// The world viewer's data for one release: the map's layers as pictures (terrain, biomes, heat, wet, peoples), the
// settlements, peoples and trade lines as JSON, and Thera from above at a block a pixel (halved). viewer/index.html
// reads them.   node tools/worldviewer.mjs [version]     -> viewer/<version>/
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
import { encode } from "./png.js";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadMap();
const { D } = await import("../core/given.js");
const { chunkHeight } = await import("../world/map.js");
const { climateAt } = await import("../world/climate.js");
const { islands } = await import("../world/islands.js");
const { peoples } = await import("../world/peoples.js");
const { settlements } = await import("../world/settlements.js");
const { epicentreOf } = await import("../world/cities.js");
const { TRADITIONS } = await import("../world/traditions.js");
const { nameOf } = await import("../world/names.js");
const { THERA } = await import("../world/thera.js");
const { stones } = await import("../world/stones.js");
const version = process.argv[2] ?? fs.readFileSync(path.join(ROOT, "mod/scripts/main.js"), "utf8").match(/VERSION = "([^"]+)"/)[1];
const OUT = path.join(ROOT, "viewer", version); fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now(), say = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

const I = islands(), W = I.W, H = I.label.length / W, PX = D.PX;
const hgt = (x, z) => chunkH(((x % W) + W) % W, Math.max(0, Math.min(H - 1, z)));
const chunkH = (x, z) => chunkHeight(x, z);
const lerp = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
const ramp = (stops, t) => { t = Math.max(0, Math.min(1, t)); for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return lerp(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return stops.at(-1)[1]; };
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const hsl = (h, s, l) => { const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };

// one pass over the map: height, climate, biome, people
const terrain = new Uint8Array(W * H * 3), biome = new Uint8Array(W * H * 3), heat = new Uint8Array(W * H * 3), wet = new Uint8Array(W * H * 3), civ = new Uint8Array(W * H * 3);
const owner = new Int32Array(W * H).fill(-1);
const { VISION } = await import("../core/given.js"); const L = peoples().list, byKey = new Map(L.map((p, i) => [p.key, i])), R = VISION.REGION;
const biomes = new Map();
const TRAD = Object.keys(TRADITIONS), TRADCOL = Object.fromEntries(TRAD.map((t, i) => [t, (i * 360) / TRAD.length]));
for (let z = 0; z < H; z++) {
  for (let x = 0; x < W; x++) {
    const k = z * W + x, o = k * 3, c = climateAt(x, z), h = c.h;
    // terrain: the sea deepening blue, the land green to brown to white, lit from the north-west
    const shade = Math.max(0.6, Math.min(1.25, 1 + (hgt(x - 1, z - 1) - hgt(x + 1, z + 1)) * 0.02));
    let rgb = h > 0 ? ramp([[0, [96, 150, 80]], [0.15, [140, 170, 90]], [0.4, [150, 125, 85]], [0.75, [130, 120, 115]], [1, [245, 245, 250]]], h / 120) : ramp([[0, [70, 130, 200]], [0.3, [40, 80, 170]], [1, [12, 25, 70]]], -h / 99);
    if (h > 0) rgb = rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * shade))));
    terrain.set(rgb, o);
    // biomes
    const b = c.biome?.id ?? (h > 0 ? "land" : "sea"); if (!biomes.has(b)) biomes.set(b, { n: 0, rgb: null, sea: h <= 0 }); biomes.get(b).n++;
    const bc = biomes.get(b).rgb ??= h <= 0 ? hsl(200 + (hash(b) % 40), 0.55, 0.3 + (hash(b) % 25) / 100) : hsl(hash(b) % 360, 0.5, 0.45 + (hash(b) % 20) / 100);
    biome.set(c.ice && h <= 0 ? [220, 235, 250] : bc, o);
    // heat and wet (land), the sea dimmed
    const tr = ramp([[0, [40, 60, 200]], [0.35, [120, 200, 230]], [0.55, [240, 230, 140]], [0.8, [240, 140, 50]], [1, [180, 30, 30]]], (c.T + 25) / 60);
    heat.set(h > 0 ? tr : tr.map((v) => Math.round(v * 0.45)), o);
    const wr = ramp([[0, [215, 180, 110]], [0.5, [140, 190, 120]], [1, [30, 90, 160]]], c.M);
    wet.set(h > 0 ? wr : [20, 30, 50], o);
    // the peoples: whose ground (and fishing water) it is
    const isl = I.label[k] >= 0 ? I.label[k] : I.dist[k] <= 2 ? I.near[k] : -1;
    if (isl >= 0) { const pk = `${isl}:${Math.floor(x / R)},${Math.floor(z / R)}`, pi = byKey.get(pk); if (pi !== undefined) owner[k] = pi; }
  }
  if (z % 128 === 0) say(`row ${z} of ${H}`);
}
for (let k = 0; k < W * H; k++) { const o = k * 3, pi = owner[k], land = I.label[k] >= 0;
  if (pi < 0) { const x = k % W, z = (k / W) | 0; let dx = Math.abs(x - THERA.seat.cx); dx = Math.min(dx, W - dx); const theran = Math.max(dx, Math.abs(z - THERA.seat.cz)) <= THERA.REACH;   // the Therans' own sea and isles (world/peoples.js leaves them to Thera)
    civ.set(land ? (theran ? [236, 226, 196] : [110, 110, 105]) : theran ? [40, 60, 96] : [22, 34, 60], o); continue; }
  const p = L[pi], x = k % W, z = (k / W) | 0, edge = [[1, 0], [0, 1], [-1, 0], [0, -1]].some(([a, b]) => { const j = Math.max(0, Math.min(H - 1, z + b)) * W + ((x + a + W) % W); return owner[j] !== pi; });
  const rgb = hsl(TRADCOL[p.tradition] ?? 0, 0.55, 0.38 + (hash(p.key) % 24) / 100);
  civ.set(edge ? [20, 20, 20] : land ? rgb : rgb.map((v) => Math.round(v * 0.45 + 20)), o); }
for (const [name, img] of Object.entries({ terrain, biomes: biome, heat, wet, civs: civ })) fs.writeFileSync(path.join(OUT, `${name}.png`), encode(W, H, img, 3));
say("layers written");

// the settlements, the peoples, the trade lines
const st = settlements(epicentreOf).list.map((s, i) => ({ id: s.key, name: nameOf(s.t, hash(s.key)), t: s.t, folk: s.folk, x: +(s.at.x / PX).toFixed(2), z: +(s.at.z / PX).toFixed(2), bx: Math.round(s.at.x), bz: Math.round(s.at.z), r: +(s.rc / PX).toFixed(2), members: s.members.length }));
const grownDir = path.join(ROOT, "lab/grown"), grown = fs.existsSync(grownDir) ? fs.readdirSync(grownDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(grownDir, f), "utf8"))) : [];
const grownKeys = new Set(grown.map((g) => g.key).filter(Boolean));
for (const s of st) { s.tags = []; if (grownKeys.has(s.id)) s.tags.push("grown"); }
const townOf = new Map(); for (const [i, s0] of settlements(epicentreOf).list.entries()) for (const m of s0.members) townOf.set(m, st[i].name);
const pl = L.map((p) => ({ key: p.key, town: townOf.get(p.key) ?? null, t: p.tradition, x: +p.cx.toFixed(2), z: +p.cz.toFixed(2), temper: p.temper, partner: p.partner, living: p.living, shares: p.shares, trade: p.trade, chunks: p.chunks }));
const pos = new Map(pl.map((p) => [p.key, p])), routes = [];
for (const p of pl) { const q = pos.get(p.partner); if (q && p.key < q.key) routes.push({ a: p.key, b: q.key, kind: "partners" }); }
for (const p of pl) if ((p.trade ?? 0) > 0) routes.push({ a: p.key, b: "thera", kind: "thera", w: p.trade });
const theraAt = { x: THERA.seat.cx + 0.5, z: THERA.seat.cz + 0.5 };
const traditions = { ...Object.fromEntries(TRAD.map((t) => [t, { name: TRADITIONS[t].name, rgb: hsl(TRADCOL[t], 0.55, 0.5) }])), therans: { name: "Therans (Thera's own isles)", rgb: [236, 226, 196] } };
const legend = [...biomes].map(([id, b]) => ({ id, rgb: b.rgb, n: b.n, sea: b.sea })).sort((a, b) => b.n - a.n);

// Thera from above: the game's own laying with its buildings (tools/modtest/view.mjs), halved
const DM = THERA.dome, K = THERA.KM, SX = THERA.seat.cx * PX, SZ = THERA.seat.cz * PX, cxB = SX + DM.x * K, czB = SZ - DM.y * K, N = 96;   // vision: ninety-six chunks square round the cone
const tc0 = Math.floor(cxB / 16) - N / 2, tz0 = Math.floor(czB / 16) - N / 2;
if (!process.env.NO_THERA) { execSync(`node tools/modtest/view.mjs ${tc0} ${tz0} ${N} ${path.join(OUT, "thera_full.png")}`, { cwd: ROOT, stdio: "ignore" });
  execSync(`python3 -c "from PIL import Image; im=Image.open('${path.join(OUT, "thera_full.png")}'); im.resize((im.width//2, im.height//2), Image.LANCZOS).save('${path.join(OUT, "thera.png")}')"`); fs.rmSync(path.join(OUT, "thera_full.png")); say("Thera drawn"); }
const thera = { x0: (tc0 * 16) / PX, z0: (tz0 * 16) / PX, size: (N * 16) / PX, bx0: tc0 * 16, bz0: tz0 * 16, blocks: N * 16 };
const places = [{ id: "thera:cone", name: "The cone: temple, seat, library, navigation house", x: cxB / PX, z: czB / PX, tags: ["new"], kind: "thera" }];
fs.writeFileSync(path.join(OUT, "data.json"), JSON.stringify({ version, built: new Date().toISOString(), W, H, PX, theraAt, thera, settlements: st, peoples: pl, routes, traditions, biomes: legend, places, stones: stones().map((t) => [+(t.x / PX).toFixed(2), +(t.z / PX).toFixed(2), +(t.r / PX).toFixed(3), t.route ? 1 : 0, t.kind]) }));
say(`data: ${st.length} settlements, ${pl.length} peoples, ${routes.length} trade lines, ${legend.length} biomes`);

// the boats in 3D: every boat's model as boxes (ship/tools/boatexport.py), for the viewer's Boats panel
execSync(`python3 ship/tools/boatexport.py ${path.join(OUT, "boats.json")}`, { cwd: ROOT, stdio: "ignore" }); say("boats written");
