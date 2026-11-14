// inherency: instrument
import "./mock/register.mjs";   // the game's API, as modtest's stand-in (tools/modtest/mock)
// The terraform probe (design/s004-specs/terraform.md §5): every building of the built add-on (dist/) laid with all
// three passes, then read back block for block against its prototype and the ground the plan gave it:
//   blocked   a prototype's air cell holding something solid after the passes (the deep pass's body over a house)
//   doors     a door's lower half that isn't a door after the passes
//   step      a door's sill over the ground outside it: |door y - 1 - ground| (a player steps 1/2 and jumps 1.25)
//   footing   the run of foundation under the floor, per column (posts, where it stands on stilts)
//   ground    the floor against the natural ground under it (fill up, cut down)
//   node tools/buildmod.mjs --nozip && node tools/modtest/terra.mjs [--only thera|towns] [--limit n] [--out lab/terraform.json]
process.env.WW_NOSTORE = "1";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), S = path.join(here, `scripts_terra_${process.pid}`);   // its own copy: two probes may run at once
fs.rmSync(S, { recursive: true, force: true }); fs.cpSync(path.join(here, "../../dist/Waterworld_BP/scripts"), S, { recursive: true });
const { mockDim, blocks } = await import("@minecraft/server");
const imp = (f) => import(path.join(S, f));
const { b64 } = await imp("b64.js"), M = await imp("data/map.js"), CT = await imp("data/city.js"), map = await imp("world/map.js"), th = await imp("world/thera.js"), G = await imp("game/ground.js"), ST = await imp("data/structures.js");
const data = new Uint8Array(M.W * M.H); for (let z = 0; z < M.H; z++) data.set(b64(M.ROWS[z]), z * M.W);
map.useMap({ w: M.W, h: M.H, data }); map.useIslets(M.ISLETS); map.useInsets([th.theraChunk]);
{ const TR = await imp("data/terrain.js"); (await imp("world/rivers.js")).useDrainage(TR.DRAINAGE); (await imp("world/rivers.js")).useTrunks(TR.TRUNKS.trunks); (await imp("world/stones.js")).useStones(TR.STONES.stones); (await imp("world/homesites.js")).useHomeports(TR.HOMEPORTS.homeports); const r = b64(TR.SEADIST), sd = new Uint8Array(M.W * M.H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; } (await imp("world/climate.js")).useSeaDistance(sd); }
const rle = b64(CT.RLE), grid = new Uint8Array(CT.N * CT.N); for (let i = 0, k = 0; i < rle.length; i += 3) { const n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(rle[i], k, k + n); k += n; } G.useCity(grid, CT.N); G.useTarn(CT.TARN); G.useCascade(CT.POOLS);
await imp("main.js");
const L = await imp("lay.js"), { LEVEL } = await imp("rings.js"), SEA = G.SEA;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const only = arg("--only", null), limit = +arg("--limit", Infinity), out = arg("--out", null);
const C = 16, AIR = "minecraft:air", WATER = "minecraft:water";
const SKIP = /^(tree|skyway|promenade|the cothon|horaia|buoy|inuksuk|stall|cone|gate)/;   // not buildings with rooms: trees, ways, the cothon (its own probe), marks
const isDoor = (id) => /_door$/.test(id) || id === "minecraft:wooden_door" || id === "minecraft:iron_door";
const soft = (id) => !id || id === AIR || id === WATER || /(_door|leaves|torch|lantern|carpet|flower|grass$|fern|sapling|snow_layer|vine|sign|banner|button|pressure_plate|rail|fence|wall$|pane|bars)/.test(id);

// the prototypes, turned as the game turns them (lay.js lifeChunk)
const flats = new Map(); const flatOf = (p) => { if (!flats.has(p)) flats.set(p, L.flatOf(ST.PROTOS[p])); return flats.get(p); };
function cellsOf(a) {
  const f = flatOf(a[0]), turn = (a[5] >> 3) & 3, rot = turn ? ST.ROT[turn - 1] : null, cells = new Map();
  for (let i = 0; i < f.length; i += 4) { let dx = f[i], dz = f[i + 2]; for (let t = 0; t < turn; t++) [dx, dz] = [-dz, dx]; const e = ST.PALETTE[rot ? rot[f[i + 3]] : f[i + 3]]; cells.set(`${a[1] + dx},${a[2] + f[i + 1]},${a[3] + dz}`, e); }
  return cells;
}
const people = (name) => { const w = name.replace(/@\d+$/, "").split(" "); return w.find((s) => /^(therans|european|norse|indian_ocean|east_asian|japanese|dugout|birchbark|pacific|shallow|arctic)$/.test(s)) ?? "-"; };

// which placements: buildings (not free, not ways or trees)
const pick = [];
ST.PLACEMENTS.forEach((a, k) => {
  const name = ST.PROTOS[a[0]].name; if (a[5] & 4 || SKIP.test(name)) return;
  const thera = !!G.theraUV(a[1], a[3]); if (only === "thera" && !thera) return; if (only === "towns" && thera) return;
  pick.push(k);
});
if (pick.length > limit) { const step = pick.length / limit; const s = []; for (let q = 0; q < limit; q++) s.push(pick[Math.floor(q * step)]); pick.length = 0; pick.push(...s); }   // an even sample
// each placement's chunks, and each chunk's placements
const byChunk = new Map(), left = new Map();
for (const k of pick) { const a = ST.PLACEMENTS[k], R = 2; let n = 0;   // two round it: the door's outside
  for (let cx = Math.floor((a[6] - R) / C); cx <= Math.floor((a[8] + R) / C); cx++) for (let cz = Math.floor((a[7] - R) / C); cz <= Math.floor((a[9] + R) / C); cz++) { const ck = `${cx},${cz}`; if (!byChunk.has(ck)) byChunk.set(ck, []); byChunk.get(ck).push(k); n++; }
  left.set(k, n); }
const seen = new Map();   // placement -> Map "x,y,z" -> id, the laid blocks in its region
const tops = new Map();   // "x,z" -> the plan's natural top
const res = [];
const t0 = Date.now(); let nc = 0;
const chunks = [...byChunk.keys()].sort();
for (const ck of chunks) {
  const [cx, cz] = ck.split(",").map(Number);
  blocks.clear(); const g = L.layTo(mockDim, cx, cz, LEVEL.deep, { folk: false }); while (!g.next().done);
  const plan = L.planNow(cx, cz); for (const c of plan.cols) tops.set(`${c.x},${c.z}`, c.top);
  for (const k of byChunk.get(ck)) {
    const a = ST.PLACEMENTS[k], f = flatOf(a[0]); let ylo = Infinity, yhi = -Infinity; for (let i = 1; i < f.length; i += 4) { ylo = Math.min(ylo, f[i]); yhi = Math.max(yhi, f[i]); }
    if (!seen.has(k)) seen.set(k, new Map());
    const m = seen.get(k), R = 2, DOWN = 34;   // vision: read 34 down for footings and posts
    for (let x = Math.max(a[6] - R, cx * C); x <= Math.min(a[8] + R, cx * C + C - 1); x++) for (let z = Math.max(a[7] - R, cz * C); z <= Math.min(a[9] + R, cz * C + C - 1); z++)
      for (let y = a[2] + ylo - DOWN; y <= a[2] + yhi + 1; y++) { const id = blocks.get(`${x},${y},${z}`); if (id) m.set(`${x},${y},${z}`, id); }
    if (left.set(k, left.get(k) - 1).get(k) === 0) { res.push(judge(k, m)); seen.delete(k); }
  }
  if (++nc % 500 === 0) process.stderr.write(`${nc}/${chunks.length} chunks, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}

function judge(k, m) {
  const a = ST.PLACEMENTS[k], name = ST.PROTOS[a[0]].name, cells = cellsOf(a), y0 = a[2], at = (x, y, z) => m.get(`${x},${y},${z}`) ?? AIR;
  const foot = new Set(), floorCols = new Set(); let blocked = 0, blockedFloor = 0, air = 0, doors = 0, lost = 0; const steps = [], lostAt = [], blockedAt = [];
  // a prototype needn't write its empty cells: each column's cells between its lowest and highest solid block that it
  // leaves empty are its rooms' air (a stilt house's posts stand under its floor, so its floor isn't always at y 0)
  const span = new Map();   // "x,z" -> [lowest solid, highest solid]
  for (const [key, e] of cells) { const [x, y, z] = key.split(",").map(Number); foot.add(`${x},${z}`); if (e[0] === AIR) continue; const s = span.get(`${x},${z}`); if (!s) span.set(`${x},${z}`, [y, y]); else { s[0] = Math.min(s[0], y); s[1] = Math.max(s[1], y); } }
  const floorAt = new Map();   // "x,z" -> the lowest empty cell over a solid one: the floor's air
  for (const [fc, [lo, hi]] of span) { floorCols.add(fc); const [x, z] = fc.split(",").map(Number); for (let y = lo + 1; y < hi; y++) { const kk = `${x},${y},${z}`; if (!cells.has(kk)) { cells.set(kk, [AIR]); if (!floorAt.has(fc)) floorAt.set(fc, y); } else if (cells.get(kk)[0] === AIR && !floorAt.has(fc)) floorAt.set(fc, y); } }
  for (const [key, e] of cells) {
    const [x, y, z] = key.split(",").map(Number), got = at(x, y, z);
    if (e[0] === AIR) { air++; if (!soft(got)) { blocked++; if (floorAt.get(`${x},${z}`) === y) { blockedFloor++; if (!blockedAt.length) blockedAt.push(`${x},${y},${z} ${got}`); } } }
    if (isDoor(e[0]) && !(e[1]?.upper_block_bit)) {
      doors++; if (got !== e[0]) { lost++; if (!lostAt.length) lostAt.push(`${x},${y},${z} ${got}`); }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (foot.has(`${nx},${nz}`)) continue;   // the outside: a column the house doesn't stand on
        let gy = null; for (let yy = y + 1; yy >= y - 34; yy--) { const id = at(nx, yy, nz); if (!soft(id) || id === WATER) { gy = yy; break; } }   // vision: 34 down
        if (gy !== null) steps.push(y - 1 - gy); }
    }
  }
  // the footing: the foundation's run under each floor column (posts on stilts); and the floor against the ground
  const fid = ST.PALETTE[a[4]][0]; let footMax = 0, footCols3 = 0, postMax = 0, over = 0, fill = 0, cut = 0, water = 0; const gaps = [];
  for (const fc of floorCols) { const [x, z] = fc.split(",").map(Number); let n = 0; for (let y = Math.min(y0, span.get(fc)[0]) - 1; at(x, y, z) === fid && n < 64; y--) n++;   // vision: no run is longer
    if (a[5] & 1) postMax = Math.max(postMax, n); else { footMax = Math.max(footMax, n); if (n >= 3) footCols3++; }
    const t = tops.get(fc); if (t === undefined) continue; gaps.push(y0 - 1 - t); if (t < SEA) { water++; over = Math.max(over, SEA - t); } }
  gaps.sort((p, q) => p - q);
  for (const d of gaps) { fill = Math.max(fill, d); cut = Math.max(cut, -d); }
  const med = gaps.length ? gaps[gaps.length >> 1] : 0;
  return { k, name, people: people(name), thera: !!G.theraUV(a[1], a[3]), stilts: !!(a[5] & 1), carved: !!(a[5] & 2), at: [a[1], y0, a[3]], air, blocked, blockedFloor, doors, lost, lostAt, blockedAt, steps, footMax, footCols3, postMax, fill, cut, med, waterCols: water, overDeep: over, cols: floorCols.size };
}

// the readings
const sum = (rs) => {
  const st = rs.flatMap((r) => r.steps);
  return {
    buildings: rs.length,
    "buried (>half the air solid)": rs.filter((r) => r.air && r.blocked > r.air / 2).length,
    "blocked at floor level": rs.filter((r) => r.blockedFloor > 0).length,
    "doors": rs.reduce((s, r) => s + r.doors, 0), "doors lost": rs.reduce((s, r) => s + r.lost, 0),
    "door sides": st.length, "step >=2 up": st.filter((d) => d >= 2).length, "step >8 up": st.filter((d) => d > 8).length, "step >=2 down (sill under the ground)": st.filter((d) => d <= -2).length,
    "footing >=3": rs.filter((r) => r.footMax >= 3).length, "footing >=8": rs.filter((r) => r.footMax >= 8).length, "footing max": Math.max(0, ...rs.map((r) => r.footMax)),
    "posts >=8": rs.filter((r) => r.postMax >= 8).length, "posts >=13": rs.filter((r) => r.postMax >= 13).length, "posts max": Math.max(0, ...rs.map((r) => r.postMax)),
    "on stilts over land": rs.filter((r) => r.stilts && r.waterCols === 0 && r.cols).length, "stilts over water >5 deep": rs.filter((r) => r.stilts && r.overDeep > 5).length,
    "floor under the ground by >3 (median)": rs.filter((r) => r.med < -3).length, "fill >5": rs.filter((r) => r.fill > 5).length, "cut >5": rs.filter((r) => r.cut > 5).length,
  };
};
const groups = { all: res, thera: res.filter((r) => r.thera), "boxed towns": res.filter((r) => !r.thera), carved: res.filter((r) => r.carved), shallow: res.filter((r) => r.people === "shallow") };
const report = Object.fromEntries(Object.entries(groups).map(([g, rs]) => [g, sum(rs)]));
const worst = (f, n = 3) => [...res].sort((p, q) => f(q) - f(p)).slice(0, n).map((r) => `${r.name} at ${r.at.join(",")}${r.lostAt?.length && f === lostF ? ` (door ${r.lostAt[0]})` : ""}`);
const lostF = (r) => r.lost;
const examples = { buried: worst((r) => r.blocked), footing: worst((r) => r.footMax), posts: worst((r) => r.postMax), "under the ground": worst((r) => -r.med), "doors lost": worst(lostF, 6), "blocked floors": [...res].filter((r) => r.blockedFloor).sort((p, q) => q.blockedFloor - p.blockedFloor).slice(0, 8).map((r) => `${r.name} at ${r.at.join(",")} (${r.blockedFloor}: ${r.blockedAt[0]})`) };
console.log(`terraform probe: ${res.length} buildings over ${chunks.length} chunks in ${((Date.now() - t0) / 1000).toFixed(0)} s${only ? ` (${only})` : ""}${Number.isFinite(limit) ? ` (sample of ${limit})` : ""}`);
const keys = Object.keys(report.all); console.log(["", ...Object.keys(groups)].map((s) => s.padStart(12)).join(""));
for (const key of keys) console.log(key.padEnd(40).slice(0, 40) + Object.keys(groups).map((g) => String(report[g][key]).padStart(10)).join(""));
for (const [k, v] of Object.entries(examples)) console.log(`worst ${k}: ${v.join("; ")}`);
if (out) fs.writeFileSync(out, JSON.stringify({ only, limit: Number.isFinite(limit) ? limit : null, report, examples }, null, 1) + "\n");
fs.rmSync(S, { recursive: true, force: true }); process.exit(0);
