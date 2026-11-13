// Build the Waterworld add-on (dist/Waterworld.mcaddon): the sim's pure modules copied into a behavior
// pack, the static world baked into data modules beside them, and a resource pack of the textures.
//   node tools/buildmod.mjs            build
//   node tools/buildmod.mjs --nozip    build the folders only (dist/Waterworld_BP, dist/Waterworld_RP)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
import { decode } from "./png.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist"), BP = path.join(DIST, "Waterworld_BP"), RP = path.join(DIST, "Waterworld_RP");
const VERSION = [0, 9, 13];
const t0 = performance.now(), say = (s) => console.log(`[${((performance.now() - t0) / 1000).toFixed(1)}s] ${s}`);

loadMap();
const { GIVEN, D } = await import("../core/given.js");
const { FIB, PHI } = await import("../core/golden.js");
const { THERA } = await import("../world/thera.js");
const { cityAt, quarterSeeds, unwarp } = await import("../world/city.js");
const { theraBoxes } = await import("../world/boxes.js");
const { seaRiteTemple, TEMPLE } = await import("../world/temple.js");
const { coldHouse } = await import("../world/coldhouse.js");
const { houseOf, FORM } = await import("../world/dwelling.js");
const { HOUSEHOLD } = await import("../world/chem.js");
const { FORM: LAYOUT_FORM_ } = await import("../world/settlement.js");
const LAYOUT_WATER = Object.fromEntries(Object.entries(LAYOUT_FORM_).map(([k, v]) => [k, !!v.water]));
const { dyesOf } = await import("../world/looks.js");
const { pinnacle, PARTY, CLIFF, floorsOf } = await import("../world/pinnacle.js");
const { skinIndex, rulerIndex, wardenIndex, CULTURES, SKINS, RANKS } = await import("../world/dress.js");
const { nameOf, NAMES } = await import("../world/names.js");
const { golden, GOLDEN_ANGLE } = await import("../core/golden.js");
const { peoples } = await import("../world/peoples.js");
const { theranPeople } = await import("../world/therans.js");
const { FAITH, WAYS } = await import("../world/faith.js");
const { DRESS } = await import("../world/dress.js");
const G = await import("../game/ground.js");

fs.rmSync(DIST, { recursive: true, force: true });
for (const d of [BP, RP]) fs.mkdirSync(d, { recursive: true });
const S = path.join(BP, "scripts");

// ---- 1. the sim's pure modules, at the same relative paths
const copy = (rel) => { const to = path.join(S, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), to); };
for (const f of fs.readdirSync(path.join(ROOT, "core"))) if (f.endsWith(".js")) copy(`core/${f}`);
for (const f of ["map", "climate", "biomes", "solar", "thera", "sealife", "rivers", "stones", "homesites", "boatsizes", "coinage"]) copy(`world/${f}.js`);
for (const f of fs.readdirSync(path.join(ROOT, "game"))) if (f.endsWith(".js")) copy(`game/${f}`);
say("copied the sim");

// ---- 2. the map: a base64 row a chunk row (decoded over a few ticks in the game)
const B64 = (u8) => Buffer.from(u8).toString("base64");
const m = decode(fs.readFileSync(path.join(ROOT, "world/map.png")));
const rows = []; for (let z = 0; z < m.h; z++) rows.push(B64(m.data.subarray(z * m.w, (z + 1) * m.w)));
const islets = [];   // the square cays are retired (world/load.js): the stones carry the route round
fs.mkdirSync(path.join(S, "data"), { recursive: true });
fs.writeFileSync(path.join(S, "data/map.js"), `// baked by tools/buildmod.mjs from world/map.png: one base64 row a chunk row\nexport const W = ${m.w}, H = ${m.h};\nexport const ROWS = ${JSON.stringify(rows)};\nexport const ISLETS = ${JSON.stringify(islets)};\n`);
say(`map: ${m.w} x ${m.h}`);

// ---- 3. the city grid over Thera (world/theracity.js: the caldera the Therans', the outer slope the peoples' wedges), run-length coded
const { theraPlan, useSectors, sectorAt, sectorsNow } = await import("../world/theracity.js");
useSectors(peoples().list);
const { theraMetres } = await import("../world/thera.js");
const TPL = await import("../world/theraplan.js"), tplan = TPL.usePeoples(sectorsNow());   // the redesign's plan: the peoples' equal shares, the classes (claude/thera-houses-and-land.md)
const TR = THERA.REACH * GIVEN.CHUNK, N = (2 * TR) / G.CELL, grid = new Uint8Array(N * N), clsGrid = new Uint8Array(N * N), cultGrid = new Uint8Array(N * N), quarterGrid = new Uint8Array(N * N);
const CULT = ["", "therans", ...tplan.seeds.map((q) => q.tradition)], QNAMES = ["", ...Object.keys(TPL.QUARTER_KINDS)];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const u = (i - N / 2) * G.CELL + G.CELL / 2, v = (j - N / 2) * G.CELL + G.CELL / 2;
  const c = theraPlan(u, v); if (!(c.kind in G.KIND) && c.kind !== "land" && c.kind !== "sea" && c.kind !== "bay") throw new Error(`world/theracity.js has a kind game/ground.js doesn't: ${c.kind}`);
  grid[j * N + i] = (c.kind === "caldera" || c.kind === "outer") && c.h < 2 ? 0 : G.KIND[c.kind] ?? 0;   // vision: two blocks over the sea at least to build on
  if (c.cls) { clsGrid[j * N + i] = TPL.CLASSES.indexOf(c.cls) + 1; cultGrid[j * N + i] = Math.max(0, CULT.indexOf(c.culture)); quarterGrid[j * N + i] = Math.max(0, QNAMES.indexOf(c.quarter)); }
}
const clsAt = (i, j) => TPL.CLASSES[clsGrid[j * N + i] - 1] ?? null;
say(`Thera's peoples (equal shares of the outer slope, each from the rim to its own shore): ${tplan.seeds.map((q) => `${q.tradition} ${Math.round((tplan.shares[tplan.seeds.indexOf(q)]) * 1000) / 10}% (${Math.round((q.off * 180) / Math.PI)}° from home)`).join(", ")}`);
G.useCity(grid, N);
const POOLS = TPL.cascadePools().map((p) => ({ kind: p.kind, u: Math.round(p.x * THERA.KM), v: Math.round(-p.y * THERA.KM), R: Math.round(p.r * THERA.KM), level: p.level, depth: p.depth, island: Math.round(p.island * THERA.KM), to: p.to ? { u: Math.round(p.to.x * THERA.KM), v: Math.round(-p.to.y * THERA.KM) } : null })); G.useCascade(POOLS);   // the cascading pools, in Thera's blocks
say(`the cascading pools: ${POOLS.map((p) => `${p.kind} at ${p.level}`).join(", ")}`);
const TARN = tplan.tarn ? { u: Math.round(tplan.tarn.x * THERA.KM), v: Math.round(-tplan.tarn.y * THERA.KM), R: Math.round(tplan.tarn.r * THERA.KM), level: Math.round(tplan.tarn.level), depth: tplan.tarn.depth } : null; G.useTarn(TARN);   // the Arctic tarn, in Thera's blocks
say(`the Arctic tarn: ${TARN ? `${TARN.R * 2} across at ${TARN.level} blocks up (${Math.round(tplan.tarn.m)} m), frozen` : "no ground for it"}`);
const rle = []; for (let k = 0; k < grid.length;) { let n = 1; while (k + n < grid.length && grid[k + n] === grid[k] && n < 65535) n++; rle.push(grid[k], n & 255, n >> 8); k += n; }
{ const { bakeDrainage } = await import("../world/rivers.js"), { bakeSeaDistance } = await import("../world/climate.js"), dr = bakeDrainage(), sd = bakeSeaDistance(), srle = []; for (let k = 0; k < sd.length;) { let n = 1; while (k + n < sd.length && sd[k + n] === sd[k] && n < 65535) n++; srle.push(sd[k], n & 255, n >> 8); k += n; }
  fs.writeFileSync(path.join(S, "data/terrain.js"), `// baked by tools/buildmod.mjs: the rivers' cells (world/rivers.js useDrainage) and each map cell's distance from the sea (cells, a byte, run-length coded [v, n lo, n hi])\nexport const DRAINAGE = ${JSON.stringify(dr)};\nexport const SEADIST = "${B64(Uint8Array.from(srle))}";\nexport const STONES = ${fs.readFileSync(path.join(ROOT, "world/stones.json"), "utf8")};\nexport const TRUNKS = ${fs.existsSync(path.join(ROOT, "world/trunks.json")) ? fs.readFileSync(path.join(ROOT, "world/trunks.json"), "utf8") : "{\"trunks\":[]}"};\nexport const HOMEPORTS = ${fs.existsSync(path.join(ROOT, "world/homeports.json")) ? fs.readFileSync(path.join(ROOT, "world/homeports.json"), "utf8") : "{\"homeports\":[]}"};\n`);
  say(`terrain: ${dr.cells.length / 5} river cells, the sea's distance in ${srle.length / 3} runs`); }
fs.writeFileSync(path.join(S, "data/city.js"), `// baked by tools/buildmod.mjs: world/city.js cityAt over Thera, kinds (game/ground.js KINDS) run-length coded [kind, n lo, n hi]; the Arctic tarn\nexport const TARN = ${JSON.stringify(TARN)};\nexport const POOLS = ${JSON.stringify(POOLS)};\nexport const N = ${N};\nexport const RLE = "${B64(Uint8Array.from(rle))}";\n`);
const kc = {}; for (const k of grid) kc[G.KINDS[k] || "natural"] = (kc[G.KINDS[k] || "natural"] ?? 0) + 1;
say(`city grid ${N} x ${N}: ${Object.entries(kc).filter(([k]) => k !== "natural").map(([k, v]) => `${k} ${v}`).join(", ")}`);

// ---- 4. the structures: prototypes (rotated in the bake, block states turned with them) and placements
const palette = [], palKey = new Map();
const BLOCKS = JSON.parse(fs.readFileSync(path.join(ROOT, "lab/bedrock_blocks.json"), "utf8")).blocks, unvanilla = new Set(), dropped = new Set();
const { CUSTOM, SHAPES, OWN_VARIANTS, paintVariant, FACES } = await import("../world/carvings.js");
for (const b of CUSTOM) BLOCKS[b.id] = {};   // the pack's own blocks (world/carvings.js), no states
fs.writeFileSync(path.join(ROOT, "lab/custom_blocks.json"), JSON.stringify({ about: "the pack's own blocks (world/carvings.js), written by tools/buildmod.mjs; the mock server takes them with vanilla's", blocks: Object.fromEntries(CUSTOM.map((b) => [b.id, {}])) }));
const pal = (id, s) => {
  const b = BLOCKS[id]; if (!b) unvanilla.add(id);
  else if (s) { if (s.direction != null && !b.direction && b["minecraft:cardinal_direction"] && /_door$/.test(id)) { s = { ...s, "minecraft:cardinal_direction": ["east", "south", "west", "north"][s.direction] }; delete s.direction; }   // given: a door's old direction (0 east, 1 south, 2 west, 3 north) as the facing the game now keeps
    if (s.direction != null && !b.direction && b["minecraft:cardinal_direction"] && /fence_gate$/.test(id)) { s = { ...s, "minecraft:cardinal_direction": ["south", "west", "north", "east"][s.direction] }; delete s.direction; }   // given: a fence gate's old direction (0 south, 1 west, 2 north, 3 east)
    const t = {}; for (const [k, v] of Object.entries(s)) if (b[k]?.includes(v)) t[k] = v; else dropped.add(`${id} ${k}=${v}`); s = Object.keys(t).length ? t : null; }   // the vanilla bounds: every block the game's own (a state it hasn't is dropped, and told)
  const k = s ? `${id}|${JSON.stringify(s)}` : id; if (!palKey.has(k)) { palKey.set(k, palette.length); palette.push(s ? [id, s] : [id]); } return palKey.get(k); };
const CARD = ["north", "east", "south", "west"];   // given: clockwise from above
const turnStates = (s, r) => {
  if (!s || !r) return s;
  const o = { ...s };
  for (let t = 0; t < r; t++) {
    if (o.direction !== undefined) o.direction = (o.direction + 1) % 4;   // given: beds and doors: 0..3 turn clockwise one a step
    if (o.weirdo_direction !== undefined) o.weirdo_direction = [2, 3, 1, 0][o.weirdo_direction];   // given: stairs: east 0, west 1, south 2, north 3 (east -> south -> west -> north)
    if (o.facing_direction !== undefined && o.facing_direction >= 2) o.facing_direction = { 2: 5, 5: 3, 3: 4, 4: 2 }[o.facing_direction];   // given: north 2, south 3, west 4, east 5
    if (o["minecraft:cardinal_direction"]) o["minecraft:cardinal_direction"] = CARD[(CARD.indexOf(o["minecraft:cardinal_direction"]) + 1) % 4];
    if (o.pillar_axis === "x") o.pillar_axis = "z"; else if (o.pillar_axis === "z") o.pillar_axis = "x";
  }
  return o;
};
const protos = [], protoKey = new Map();
/** A prototype from a vox map, turned r quarter-turns clockwise: { flat [x,y,z,p,...], bounds }. */
function proto(name, vox, r = 0) {
  const key = `${name}@${r}`; if (protoKey.has(key)) return protoKey.get(key);
  const flat = []; let b = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  for (const [k, blk] of vox) {
    let [x, y, z] = k.split(",").map(Number); for (let t = 0; t < r; t++) [x, z] = [-z, x];
    flat.push(x, y, z, pal(blk.id, turnStates(blk.s, r)));
    b = [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], y), Math.max(b[3], y), Math.min(b[4], z), Math.max(b[5], z)];
  }
  const P = { i: protos.length, name: key, flat, b, r, base: r ? proto(name, vox, 0).i : null }; protos.push(P); protoKey.set(key, P); return P;   // a turned prototype keeps its base: only the bases are written (the game turns them: lay.js)
}
const footOf = (vox) => { let b = [Infinity, -Infinity, Infinity, -Infinity]; for (const k of vox.keys()) { const [x, , z] = k.split(",").map(Number); b = [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], z), Math.max(b[3], z)]; } return b; };

const K = THERA.KM, D0 = THERA.dome, SX = THERA.seat.cx * D.PX, SZ = THERA.seat.cz * D.PX;   // Thera's map cell's corner, in blocks
// a box's frame: box space is the island's own (warped) plane, blocks from the cone's middle, z north; this takes it to the world
const shiftAt = (bx, bz) => { const wx = D0.x + bx / K, wy = D0.y + bz / K, [rx, ry] = unwarp(wx, wy); return [(rx - wx) * K, (ry - wy) * K]; };
const toWorld = (bx, bz, sh) => [Math.round(SX + D0.x * K + bx + sh[0]), Math.round(SZ - (D0.y * K + bz + sh[1]))];

const placements = [], taken = new Set(), why = {};
const no = (w) => { why[w] = (why[w] ?? 0) + 1; return false; };
const colKey = (x, z) => `${x},${z}`;
const BAD = new Set(["round harbour", "merchant harbour", "fairway", "ring canal", "wall canal", "canal"].map((k) => G.KIND[k]));
/** Place a prototype with its footprint's middle at world (X, Z): its floor (y 0) on the highest ground under it. */
function place(P, X, Z, { foundation = "minecraft:cobblestone", floorAt = null, water = false, stilts = false, tag = "", pad = 0, kinds = null, slope = Infinity, anyWater = false, carve = false, trunk = false, over = false, foot = null, origin = false } = {}) {   // origin: the prototype's own 0,0 goes at X, Z (not its box's middle)   // foot: the columns it truly stands on (a round pad's), in place of its box   // over: stands on something already placed (a dockhouse on its pad)
  const [x0, x1, , , z0, z1] = trunk ? [0, 0, 0, 0, 0, 0] : P.b, ox = origin ? X : X - Math.round((x0 + x1) / 2), oz = origin ? Z : Z - Math.round((z0 + z1) / 2);   // trunk: the footprint is the trunk's column (a crown hangs free)
  if (!over) { if (foot) { for (const [x, z] of foot) if (taken.has(colKey(ox + x, oz + z))) return no("overlap"); } else for (let x = x0 - pad; x <= x1 + pad; x++) for (let z = z0 - pad; z <= z1 + pad; z++) if (taken.has(colKey(ox + x, oz + z))) return no("overlap"); }
  let top = -Infinity, low = Infinity; const cols = [];
  for (const [x, z] of foot ?? (function* () { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) yield [x, z]; })()) {
    const wx = ox + x, wz = oz + z;
    const g = G.heightAt(wx, wz); if (BAD.has(g.kind) && !anyWater) return no("water of the city's plan");
    if (kinds && !kinds.has(g.kind)) return no("outside its ground");
    const t = G.SEA + Math.round(g.h); if (t <= G.SEA && !water) return no("the sea"); top = Math.max(top, t); low = Math.min(low, t); cols.push([wx, wz, t]);
  }
  if (top - low > slope) return no("too steep");
  const y0 = trunk ? top + 1 : floorAt ?? (carve ? Math.max(low, G.SEA + 1) : Math.max(top, G.SEA + 1));   // a carved house sits at its downhill foot, cut into the slope
  for (const [wx, wz] of cols) taken.add(colKey(wx, wz));
  placements.push({ p: P.i, x: ox, y: y0, z: oz, f: pal(foundation), stilts, carve, tag, b: [ox + x0, oz + z0, ox + x1, oz + z1] });
  return true;
}

// the prototypes
const L = peoples().list, byT = new Map(); for (const p of L) if (!byT.has(p.tradition)) byT.set(p.tradition, p);
const eu = byT.get("european");
const theran = theranPeople(eu);   // vision: the Therans as the pack draws them (tools/lab.mjs's houses lens)
const houseVox = new Map();
const houseFor = (t) => { if (houseVox.has(t)) return houseVox.get(t); const p = t === "therans" ? theran : byT.get(t); const law = FORM[t]?.form ?? "twocell", h = houseOf(p, { n: HOUSEHOLD[law] ?? 5, job: "fisherman", tradition: t }); houseVox.set(t, h); return h; };   // the same house the boxes are sized from (world/boxes.js houseBox)
const small = (blocks) => new Map(blocks.map(([x, y, z, id, s]) => [`${x},${y},${z}`, { id, s: s ?? null }]));
const WELL = small([...[-1, 0, 1].flatMap((a) => [-1, 0, 1].flatMap((b) => (a || b ? [[a, 0, b, "minecraft:cobblestone"], [a, 1, b, "minecraft:cobblestone_wall"]] : [[0, 0, 0, "minecraft:water"]]))), [0, -1, 0, "minecraft:water"], [-1, 2, -1, "minecraft:oak_fence"], [1, 2, 1, "minecraft:oak_fence"], [-1, 2, 1, "minecraft:oak_fence"], [1, 2, -1, "minecraft:oak_fence"], ...[-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => [a, 3, b, "minecraft:oak_slab"]))]);   // vision: a village well
const BELL = small([[0, 0, 0, "minecraft:stone_bricks"], [0, 1, 0, "minecraft:oak_fence"], [0, 2, 0, "minecraft:bell", { attachment: "standing", direction: 0 }], [0, 3, 0, "minecraft:lantern", { hanging: false }]]);   // vision
const SHRINE = small([...[-1, 0, 1].flatMap((a) => [-2, -1, 0, 1, 2].map((b) => [a, 0, b, "minecraft:prismarine_bricks"])), [0, 0, 0, "minecraft:water"], [0, 0, -1, "minecraft:water"], [0, 0, 1, "minecraft:water"],
  [-1, 1, -2, "minecraft:sea_lantern"], [1, 1, -2, "minecraft:sea_lantern"], [-1, 1, 2, "minecraft:sea_lantern"], [1, 1, 2, "minecraft:sea_lantern"], [0, 1, 2, "minecraft:lectern", { "minecraft:cardinal_direction": "north" }]]);   // vision: a basin of the sea and its lights (world/faith.js shrineOf)
const PAVE = (w, l, id) => small(Array.from({ length: w * l }, (_, k) => [(k % w) - Math.floor(w / 2), 0, Math.floor(k / w) - Math.floor(l / 2), id]));

// the temple, then the cold house, then the quarters
const tb = theraBoxes(), byKind = (k) => tb.boxes.find((b) => b.kind === k);
const tbox = byKind("sea rite temple"), sht = shiftAt(tbox.x + tbox.w / 2, tbox.z + tbox.l / 2), [TX, TZ] = toWorld(tbox.x + tbox.w / 2, tbox.z + tbox.l / 2, sht);
let TP = null, templeOk = false, HORAIA_AT = null; const POOLDRESS = [], POOLFISH = [], COURSES = [], SKYROOTS = []; let PARK = null;   // the Sea Rite Temple is the great temple on the summit now (game/theranciv.js: the redesign's grander scale)
// (the Cold House is gone: the cone's round lake's island is the Horaia's park now)

// the quarters: each people's quarter (world/city.js's cells between the canals) packed with its own houses,
// a shrine, a well and a bell at the quarter's seed; the Therans' houses on the cone's terraces and in their towns
// the cothon (game/cothon.js): the great round harbour as one building on its true-circle ground (world/city.js), laid
// before anything else on the cone so nothing stands in its ring
{ const { cothon } = await import("../game/cothon.js"), CG = await import("../world/city.js"), w = CG.cothonWorld(), C = CG.CITY.cothon;
  const vox = cothon({ rb: C.round * K, rs: (C.round + C.sheds) * K, rq: (C.round + C.sheds + C.quay) * K, ri: C.island * K, bays: C.piers, mouth: w.mouth, gateHalf: C.neck[0] * K, pierHalf: C.pier * K });
  const foot = [...new Set([...vox.keys()].map((k) => { const [a, , c] = k.split(","); return `${a},${c}`; }))].map((k) => k.split(",").map(Number));
  const ok = place(proto("the cothon", vox, 0), Math.round(SX + w.x * K), Math.round(SZ - w.y * K), { foot, origin: true, floorAt: G.SEA + 3, water: true, anyWater: true, over: true, foundation: "minecraft:water", tag: "cothon" });
  if (ok) { placements.at(-1).free = true; for (const [x, z] of foot) taken.add(colKey(Math.round(SX + w.x * K) + x, Math.round(SZ - w.y * K) + z)); }   // free: no foundation under it, so the basin's water is the lagoon's own (a water foundation stood it three over the sea)
  say(`the cothon: ${ok ? "built" : "NOT built"}, ${vox.size} blocks, ${C.piers} slips round a basin ${Math.round(2 * C.round * K)} blocks across`); }

// the summit's buildings (game/theranciv.js): the great temple on the cone's top, its front to the mouth; the
// navigation house toward the mouth, the library and the government seat a third of a turn either side; on the
// precinct's ground, which only ground ways climb (claude/thera-houses-and-land.md decision 3)
{ const { CIVIC } = await import("../game/theranciv.js"), Dm = THERA.dome, cx = SX + Dm.x * K, cz = SZ - Dm.y * K;
  const mouth = Math.atan2(-(THERA.strait.path[0][1] - Dm.y), THERA.strait.path[0][0] - Dm.x);   // the mouth's bearing from the summit, in the world's plane (z south)
  const turnTo = (a) => ((Math.round((a + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;   // the quarter-turns that face a front (its -z) toward bearing a
  const done = [];
  const site = (name, a, r0) => { const vox = CIVIC[name](), r = turnTo(a + Math.PI), P = proto(name, vox, r);   // its front toward the summit's outside (away from the middle)
    const tries = []; for (let r1 = r0; r1 < r0 + FIB[10]; r1 += 3) tries.push([r1, a]); for (let k = 1; k < (FIB[10] + FIB[9]); k++) tries.push([r0 + FIB[8] * Math.sqrt(k / (FIB[10] + FIB[9])), a + k * Math.PI * (3 - Math.sqrt(5))]);   // straight out, then a golden spiral round the spot (given: the golden angle)
    const w0 = { ...why };
    for (const [r1, a1] of tries) { const X = Math.round(cx + r1 * Math.cos(a1)), Z = Math.round(cz + r1 * Math.sin(a1)); if (place(P, X, Z, { foundation: "minecraft:calcite", pad: 3, tag: name === "great temple" ? "temple" : name })) { if (name === "great temple") { TP = P; templeOk = true; } done.push(`${name} ${r1} out`); return; } }
    done.push(`${name} NOT placed (${Object.entries(why).filter(([k, v]) => v > (w0[k] ?? 0)).map(([k, v]) => `${v - (w0[k] ?? 0)} ${k}`).join(", ")})`); };
  // the cascading pools (world/theraplan.js): the Horaia on the first one's island; each pool dressed as its water,
  // and its fish (spawned with the chunk's folk: lay.js POOLFISH)
  { const { horaia } = await import("../game/therantrees.js"), top = POOLS[0];
    if (top) { const X = SX + top.u, Z = SZ + top.v, hv = horaia(1), P = proto("horaia", new Map(hv.map((b) => [`${b.x},${b.y},${b.z}`, { id: b.id, s: null }])), 0);
      const ok = place(P, X, Z, { trunk: true, pad: 1, tag: "horaia" }); if (ok) { const pl = placements[placements.length - 1]; HORAIA_AT = { x: pl.x, y: pl.y, z: pl.z, leaves: hv.filter((b) => b.leaf).flatMap((b) => [b.x, b.y, b.z]) }; }
      done.push(`the Horaia ${ok ? "on the first pool's island" : "NOT placed"}`); }
    const DRESS = {   // vision: each water's own life on its floor, and its fish
      theran: { floor: [["minecraft:sea_pickle", 1]], top: "minecraft:lily_pad", fish: ["minecraft:tropicalfish"] },
      warm: { floor: ["tube", "brain", "bubble", "fire", "horn"].flatMap((c) => [[`minecraft:${c}_coral_block`, 1], [`minecraft:${c}_coral_fan`, 1]]), fish: ["minecraft:tropicalfish", "minecraft:pufferfish"] },
      lush: { floor: [["minecraft:seagrass", 2], ["minecraft:clay", 1]], top: "minecraft:lily_pad", fish: ["minecraft:axolotl"] },
      mangrove: { floor: [["minecraft:mangrove_roots", 2], ["minecraft:seagrass", 1]], top: "minecraft:lily_pad", fish: ["minecraft:frog", "minecraft:tadpole"] },
      cold: { floor: [["minecraft:blue_ice", 1], ["minecraft:seagrass", 1]], fish: ["minecraft:salmon", "minecraft:cod"] },
      deep: { floor: [["minecraft:sea_lantern", 1], ["minecraft:prismarine_bricks", 2]], fish: ["minecraft:glow_squid"] },
      river: { floor: [["minecraft:seagrass", 2]], fish: ["minecraft:salmon"] },
    };
    let dressed = 0;
    for (const p of POOLS) { const D = DRESS[p.kind]; if (!D) continue;
      const tot = D.floor.reduce((a, [, w]) => a + w, 0);
      for (let k = 1; k <= FIB[7]; k++) { const a = k * Math.PI * (3 - Math.sqrt(5)), r = (p.island + 2) + (p.R - p.island - 3) * Math.sqrt(k / FIB[7]), X = Math.round(SX + p.u + r * Math.cos(a)), Z = Math.round(SZ + p.v + r * Math.sin(a)), g = G.heightAt(X, Z);   // derived: twenty-one by the golden spiral (given: the golden angle)
        if (g.water == null) continue; let x = golden(k + p.u) * tot, id = D.floor[0][0]; for (const [i2, w] of D.floor) { x -= w; if (x < 0) { id = i2; break; } }
        POOLDRESS.push([X, G.SEA + Math.round(g.h) + 1, Z, id]); if (D.top && k % 3 === 0) POOLDRESS.push([X, G.SEA + Math.round(g.water) + 1, Z, D.top]); dressed++; }   // vision: a lily pad on every third
      for (let f = 0; f < FIB[4]; f++) { const a = f * 2.4, r = p.island + (p.R - p.island) / 2; POOLFISH.push([D.fish[f % D.fish.length], Math.round(SX + p.u + r * Math.cos(a)), G.SEA + p.level - 1, Math.round(SZ + p.v + r * Math.sin(a))]); } }   // vision: five fish a pool, half way out
    // the park's beasts on the banks round each pool, by its water (spawned with the fish): rabbits and foxes by the
    // Therans' own, parrots and turtles by the warm, frogs by the lush and the mangrove, foxes by the cold; a sniffer
    // grazing by the Horaia's pool
    const BANK = { theran: ["minecraft:rabbit", "minecraft:fox"], warm: ["minecraft:parrot", "minecraft:turtle"], lush: ["minecraft:frog", "minecraft:rabbit"], mangrove: ["minecraft:frog", "minecraft:parrot"], cold: ["minecraft:fox", "minecraft:rabbit"], deep: ["minecraft:rabbit"], river: ["minecraft:fox", "minecraft:rabbit"] };
    let beasts = 0, fish0 = POOLFISH.length; if (POOLS[0]) PARK = { x: Math.round(SX + POOLS[0].u), z: Math.round(SZ + POOLS[0].v), r: FIB[10] };   // the park's leash: eighty-nine blocks round the Horaia's pool (game: main.js park)
    for (const [n, p] of POOLS.entries()) { const kinds = [...(BANK[p.kind] ?? []), ...(n === 0 ? ["minecraft:sniffer"] : [])];
      for (let f = 0; f < FIB[4] - 2 + (n === 0 ? 1 : 0); f++) { const a = f * 2.4 + n, X = Math.round(SX + p.u + (p.R + FIB[4]) * Math.cos(a)), Z = Math.round(SZ + p.v + (p.R + FIB[4]) * Math.sin(a)), g = G.heightAt(X, Z);   // vision: three a pool (four by the Horaia's), five out from the water
        if (g.water != null || g.h < 1) continue; POOLFISH.push([kinds[f % kinds.length], X, G.SEA + Math.round(g.h) + 1, Z]); beasts++; } }
    done.push(`the pools dressed (${dressed} things on their floors), ${fish0} fish, ${beasts} beasts on their banks`); }
  site("great temple", mouth, 0);   // the Sea Rite Temple on the summit's middle
  site("navigation house", mouth + Math.PI, 89); site("library", mouth + (2 * Math.PI) / 3, 89); site("government seat", mouth - (2 * Math.PI) / 3, 89);   // vision: eighty-nine out from the summit's middle at least (clear of the great temple)
  say(`the summit: ${done.join(", ")}`); }
// the skyways (world/theraplan.js, game/skyway.js): a tree from the cone's skirt to each Theran quarter, over the
// lagoon at the great ships' clearance and up the wall to the rim; laid before the houses so they keep clear of it
{ const { skywayNetwork } = await import("../game/skyway.js"), ground = (X, Z) => { const t = G.SEA + Math.round(G.heightAt(X, Z).h); return { top: t, water: t <= G.SEA }; };
  let pieces = 0, blocks = 0;
  const ways = TPL.skyways().map((w) => ({ ...w, pts: w.pts.map(([x, y, h]) => [SX + x * K, SZ - y * K, G.SEA + h]) }));
  SKYROOTS.push(...ways.filter((w) => w.kind === "trunk").map((w) => w.pts[0]));   // where each trunk leaves the cone's skirt: the cone's paths come to them
  skywayNetwork(ways, ground).forEach((pc) => {   // drawn as one network: open where its ways join, railed only where the walk ends in air
    const vox = new Map(pc.vox.map((v) => [`${v.x - pc.b[0]},${v.y},${v.z - pc.b[1]}`, { id: v.id, s: v.s }])), P = proto(`skyway ${pieces}`, vox, 0);
    placements.push({ p: P.i, x: pc.b[0], y: 0, z: pc.b[1], f: pal("minecraft:air"), stilts: false, carve: false, free: true, tag: "skyway", b: pc.b });
    for (const v of pc.vox) taken.add(colKey(v.x, v.z)); pieces++; blocks += pc.vox.length;
  });
  say(`the skyways: ${TPL.skyways().length} ways in ${pieces} pieces, ${blocks} blocks`); }
// ---- the cone's park (the user's word, 12 Nov: the cone uncapped of its white stone and given back to the garden). Its
// ground is grass now (game/ground.js: the acropolis); over it a network of Theran marble paths: rings along the
// contours at the Fibonacci heights (34, 21, 13, 8 over the sea), five serpentine ways down from the summit at the golden
// angle that never fall more than a block in phi squared, and a spur to the foot of every skyway trunk, so the skyways
// land on the paths. Along them gardens (beds of the Therans' flowers, azaleas, cypresses), lamps and benches; and on
// the flank toward the lagoon an amphitheatre cut into the slope, its tiers facing the water
{ const DM = THERA.dome, CX = SX + DM.x * K, CZ = SZ - DM.y * K, R = DM.r * K, Hs = (X, Z) => Math.round(G.heightAt(X, Z).h), Y = (X, Z) => G.SEA + Hs(X, Z);
  const M = (n) => `waterworld:theran_marble_${n}`, vox = new Map(), put = (x, y, z, id, s = null) => vox.set(`${x},${y},${z}`, { x, y, z, id, s });
  const paths = new Map(), W = 3;   // vision: the paths three wide: a tile walk with a polished edge
  const keyOf = (x, z) => `${x},${z}`, free = (x, z) => !taken.has(colKey(x, z)) && Hs(x, z) > 0;
  const stroke = (pts, w = W) => { for (let k = 0; k + 1 < pts.length; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let s = 0; s <= n; s++) { const x = ax + ((bx - ax) * s) / n, z = az + ((bz - az) * s) / n;
      for (let ox = -w; ox <= w; ox++) for (let oz = -w; oz <= w; oz++) { const X = Math.round(x) + ox, Z = Math.round(z) + oz, d = Math.hypot(X - x, Z - z); if (d > w / 2 + 0.3 || !free(X, Z)) continue;
        const c = paths.get(keyOf(X, Z)); if (!c || d < c.d) paths.set(keyOf(X, Z), { X, Z, d, edge: d > w / 2 - 0.8 }); } } } };
  // the rings: the contour at each Fibonacci height, a point every two degrees, smoothed
  const ring = (L) => { const pts = []; for (let a = 0; a < 360; a += 2) { const t = (a * Math.PI) / 180; let hit = null; for (let r = 4; r < R * 1.3; r++) if (Hs(Math.round(CX + r * Math.cos(t)), Math.round(CZ + r * Math.sin(t))) <= L) { hit = r; break; } pts.push(hit); }   // vision: a point every two degrees
    const sm = pts.map((r, i) => { if (r == null) return null; let s = 0, n = 0; for (let d = -3; d <= 3; d++) { const q = pts[(i + d + pts.length) % pts.length]; if (q != null) { s += q; n++; } } return s / n; });   // vision: smoothed over fourteen degrees
    const out = []; sm.forEach((r, i) => { if (r != null) out.push([CX + r * Math.cos((i * 2 * Math.PI) / 180), CZ + r * Math.sin((i * 2 * Math.PI) / 180)]); }); if (out.length > 2) out.push(out[0]); return out; };
  const LEVELS = [FIB[8], FIB[7], FIB[6], FIB[5]];   // derived: 34, 21, 13 and 8 blocks over the sea
  for (const L of LEVELS) if (L < Hs(Math.round(CX), Math.round(CZ))) stroke(ring(L));
  // the serpentine ways: from the summit's edge down, each step the most downhill heading that falls no more than a block in phi squared
  const GRADE = 1 / PHI ** 2, SPOKES = FIB[4];   // derived: a block's fall in two and a half; five ways
  for (let s = 0; s < SPOKES; s++) { const a0 = s * GOLDEN_ANGLE, side = s % 2 ? 1 : -1; let x = CX + FIB[9] * Math.cos(a0), z = CZ + FIB[9] * Math.sin(a0), h = Hs(Math.round(x), Math.round(z)); const pts = [[x, z]];   // derived: from fifty-five out (the summit's buildings inside)
    for (let n = 0; n < FIB[10] * FIB[3] && h > 2; n++) { const out = Math.atan2(z - CZ, x - CX); let best = null;
      for (let turn = 0; turn <= 75; turn += 5) { const t = out + side * (turn * Math.PI) / 180, nx = x + Math.cos(t), nz = z + Math.sin(t), nh = G.heightAt(Math.round(nx), Math.round(nz)).h; if (h - nh <= GRADE + 0.5 || turn === 75) { best = [nx, nz, nh]; break; } }   // vision: turning up to seventy-five degrees off the fall line, five at a time
      [x, z] = best; h = best[2]; if (n % 3 === 0) pts.push([x, z]); }   // vision: a point every three blocks
    stroke(pts); }
  // the spurs: each skyway trunk's foot to the nearest path
  const all = () => [...paths.values()];
  for (const [rx, rz] of SKYROOTS) { let best = null, bd = Infinity; for (const c of all()) { const d = Math.hypot(c.X - rx, c.Z - rz); if (d < bd) { bd = d; best = c; } } if (best && bd < R) stroke([[rx, rz], [best.X, best.Z]]); }
  // the amphitheatre: on the flank toward the lagoon, its orchestra where the cone stands twenty-one over the sea, its tiers up the slope
  const B = THERA.bay, BX = SX + B.x * K, BZ = SZ - B.y * K, ad = Math.atan2(BZ - CZ, BX - CX), dx = Math.cos(ad), dz = Math.sin(ad);
  let O = null; for (let r = FIB[9]; r < R * 1.2; r++) { const X = Math.round(CX + r * dx), Z = Math.round(CZ + r * dz); if (Hs(X, Z) <= FIB[7]) { O = [X, Z]; break; } }
  let tiers = 0;
  if (O) { const [ox, oz] = O, y0 = Y(ox, oz), RO = FIB[5], ROWS = FIB[6], RS = FIB[4] - 1;   // vision: the orchestra eight across its radius, thirteen tiers, the stage four deep
    for (let x = ox - RO - ROWS - 2; x <= ox + RO + ROWS + 2; x++) for (let z = oz - RO - ROWS - 2; z <= oz + RO + ROWS + 2; z++) {
      const ex = x - ox, ez = z - oz, r = Math.hypot(ex, ez), up = -(ex * dx + ez * dz) / (r || 1), g = Y(x, z);   // up: toward the summit (the cavea's side)
      if (r <= RO) { put(x, y0, z, r < 1.5 ? M("rosette") : r > RO - 1 ? M("polished") : M("tile")); for (let y = y0 + 1; y <= Math.max(g, y0) + 1; y++) put(x, y, z, "minecraft:air"); for (let y = g; y < y0; y++) put(x, y, z, M("ashlar")); taken.add(colKey(x, z)); continue; }
      if (r <= RO + ROWS && up > -0.17) {   // vision: the cavea a little past the half circle
        const k = Math.floor(r - RO), ys = y0 + 1 + k, ox2 = Math.abs(ex) >= Math.abs(ez) ? (ex > 0 ? "east" : "west") : (ez > 0 ? "south" : "north");   // the seat rises away from the orchestra
        for (let y = g; y < ys; y++) put(x, y, z, M("ashlar")); put(x, ys, z, M(`stairs_${ox2}`)); for (let y = ys + 1; y <= Math.max(g, ys) + 1; y++) put(x, y, z, "minecraft:air"); taken.add(colKey(x, z)); tiers++; continue; }
      if (r <= RO + RS && up < -0.5) {   // the stage, toward the water
        put(x, y0 + 1, z, M("polished")); for (let y = g; y <= y0; y++) put(x, y, z, M("ashlar")); for (let y = y0 + 2; y <= g + 1; y++) put(x, y, z, "minecraft:air"); taken.add(colKey(x, z));
        if (r > RO + RS - 1 && Math.round(Math.atan2(ez, ex) * FIB[6]) % 3 === 0) { put(x, y0 + 2, z, M("column_base")); for (let y = y0 + 3; y < y0 + 6; y++) put(x, y, z, M("column")); put(x, y0 + 6, z, M("capital_ionic")); put(x, y0 + 7, z, M("egg_dart")); }   // vision: the stage's colonnade, a column every third step round, four high under an egg-and-dart lintel
      } }
    stroke([[ox + dx * -(RO + ROWS + 1), oz + dz * -(RO + ROWS + 1)], [ox + dx * -(RO + ROWS + FIB[5]), oz + dz * -(RO + ROWS + FIB[5])]]);   // a path to the top of the tiers
  }
  // the paths' stones, a half step where the next stone is a block higher; lamps and benches at the edges; gardens beside
  let lamps = 0, benches = 0, beds = 0, trees = 0, i = 0;
  const ps = all().sort((a, b) => a.X - b.X || a.Z - b.Z), isPath = (x, z) => paths.has(keyOf(x, z));
  for (const c of ps) { const y = Y(c.X, c.Z); i++;
    put(c.X, y, c.Z, c.edge ? M("polished") : M("tile"));
    if (!c.edge && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isPath(c.X + a, c.Z + b) && Y(c.X + a, c.Z + b) === y + 1)) put(c.X, y + 1, c.Z, M("slab"));
    taken.add(colKey(c.X, c.Z));
    if (c.edge && golden(i * 7) < 1 / FIB[6]) { put(c.X, y + 1, c.Z, M("polished")); put(c.X, y + 2, c.Z, "minecraft:soul_lantern", { hanging: false }); lamps++; }   // vision: a lamp to about every thirteen edge stones
    else if (c.edge && golden(i * 11) < 1 / FIB[7]) { const out = [[1, 0, "west"], [-1, 0, "east"], [0, 1, "north"], [0, -1, "south"]].find(([a, b]) => !isPath(c.X + a, c.Z + b)); if (out) { put(c.X, y + 1, c.Z, M(`stairs_${out[2]}`)); benches++; } }   // vision: a bench to about every twenty-one, its back to the garden
  }
  const FLOWERS = ["cornflower", "lily_of_the_valley", "allium", "azure_bluet", "oxeye_daisy", "dandelion"];   // vision: the Therans' blue, white and gold, and the summer's purple
  for (const c of ps) { if (!c.edge) continue;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let r = 1; r <= FIB[3]; r++) { const x = c.X + a * r, z = c.Z + b * r, k = keyOf(x, z); if (isPath(x, z) || taken.has(colKey(x, z)) || vox.has(`${x},${Y(x, z) + 1},${z}`)) continue;
      const g = golden(x * 31 + z * 17);
      if (g < 1 / PHI ** 2) { put(x, Y(x, z) + 1, z, `minecraft:${FLOWERS[Math.floor(golden(x + z * 7) * FLOWERS.length)]}`); beds++; }   // vision: flowers in about two cells of five beside the paths
      else if (g < 1 / PHI ** 2 + 1 / FIB[6]) { put(x, Y(x, z) + 1, z, golden(x * z) < 0.5 ? "minecraft:flowering_azalea" : "minecraft:azalea"); beds++; } } }
  { const { theranTree } = await import("../game/therantrees.js"), tv = new Map(); const treeOf = (v) => tv.get(v) ?? tv.set(v, new Map(theranTree("kyparissi", v + 1).map((b) => [`${b.x},${b.y},${b.z}`, { id: b.id, s: null }]))).get(v);
    for (const c of ps) { if (!c.edge || golden(c.X * 3 + c.Z * 5) >= 1 / FIB[6]) continue; const out = [[2, 0], [-2, 0], [0, 2], [0, -2]].find(([a, b]) => !isPath(c.X + a, c.Z + b));   // vision: a cypress to about every thirteen edge stones, two out
      if (out && place(proto(`tree kyparissi ${c.X % FIB[4]}`, treeOf(((c.X % FIB[4]) + FIB[4]) % FIB[4]), 0), c.X + out[0], c.Z + out[1], { trunk: true, pad: 1, tag: "tree" })) trees++; } }
  // into pieces a couple of chunks a side, laid as free structures
  const pieces = new Map(); for (const v of vox.values()) { const k = `${Math.floor(v.x / 32)},${Math.floor(v.z / 32)}`; (pieces.get(k) ?? pieces.set(k, []).get(k)).push(v); }
  for (const [, list] of pieces) { let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const v of list) b = [Math.min(b[0], v.x), Math.min(b[1], v.z), Math.max(b[2], v.x), Math.max(b[3], v.z)];
    const P2 = proto(`cone park ${b[0]},${b[1]}`, new Map(list.map((v) => [`${v.x - b[0]},${v.y},${v.z - b[1]}`, { id: v.id, s: v.s }])), 0);
    placements.push({ p: P2.i, x: b[0], y: 0, z: b[1], f: pal("minecraft:air"), stilts: false, carve: false, free: true, tag: "park", b }); }
  say(`the cone's park: ${paths.size} path stones (${LEVELS.length} rings, ${SPOKES} serpentine ways, ${SKYROOTS.length} skyway spurs), ${lamps} lamps, ${benches} benches, ${beds} garden plants, ${trees} cypresses; the amphitheatre ${O ? `${tiers} seats on ${FIB[6]} tiers facing the lagoon` : "found no ground"}`); }
// ---- Akrotiri: the old Theran town under the ash, on the ridge's foot toward the south shore (the real site lies
// there). Thera's red Minoan columns stand only here now (the user's word, 12 Nov: too far from the living city's
// white, gold and blue): stumps of them broken at different heights on their white bases, fallen capitals, low walls of
// the old town's tuff, ash and pumice drifted over the floors
{ const A = THERA.massifs.find((m) => /Akrotiri/.test(m[0])), M = (n) => `waterworld:theran_marble_${n}`, vox = new Map(), put = (x, y, z, id) => vox.set(`${x},${y},${z}`, { x, y, z, id, s: null });
  let site = null;
  for (let r = 0; r < FIB[10] + FIB[9] && !site; r += 3) for (let a = 0; a < 2 * Math.PI && !site; a += GOLDEN_ANGLE / 2) { const x = A[1] * K + r * Math.cos(a), y = (A[2] - A[4] / 2) * K + r * Math.sin(a), X = Math.round(SX + x), Z = Math.round(SZ - y);   // vision: from the ridge's southern flank outward, toward the shore
    const h = G.heightAt(X, Z).h; if (h < FIB[3] || h > FIB[8]) continue; let ok = true; for (let dx = -FIB[6]; dx <= FIB[6] && ok; dx += 3) for (let dz = -FIB[5]; dz <= FIB[5] && ok; dz += 3) { const g2 = G.heightAt(X + dx, Z + dz).h; if (taken.has(colKey(X + dx, Z + dz)) || g2 < 1 || Math.abs(g2 - h) > FIB[5]) ok = false; } if (ok) site = [X, Z]; }   // vision: three to thirty-four over the sea, dry, the ground within eight over the ruin's span
  let cols = 0;
  if (site) { const [X0, Z0] = site, Yg = (x, z) => G.SEA + Math.round(G.heightAt(x, z).h);
    for (let dx = -FIB[6]; dx <= FIB[6]; dx++) for (let dz = -FIB[5]; dz <= FIB[5]; dz++) { const x = X0 + dx, z = Z0 + dz, y = Yg(x, z), g = golden(x * 13 + z * 7);
      const wall = (Math.abs(dx) % FIB[5] === 0 || Math.abs(dz) % FIB[4] === 0) && g > 1 / PHI ** 3;   // vision: rooms eight by five, their walls broken
      put(x, y, z, g < 1 / PHI ** 2 ? "minecraft:gravel" : g < 1 / PHI ? "minecraft:tuff" : "minecraft:coarse_dirt");   // the ash and pumice over the floors
      if (wall) { const hgt = Math.floor(golden(x + z * 3) * FIB[4]); for (let k = 1; k <= hgt; k++) put(x, y + k, z, golden(x * k + z) < 1 / PHI ** 2 ? "minecraft:mossy_cobblestone" : "minecraft:tuff_bricks"); }   // vision: up to four courses left
      else if (dx % 3 === 0 && dz % 3 === 0 && Math.abs(dz) === FIB[3] && g < 1 / PHI) { put(x, y + 1, z, M("column_base")); const n = Math.floor(golden(x * 5 + z) * FIB[4]); for (let k = 2; k <= n + 1; k++) put(x, y + k, z, "waterworld:minoan_column"); cols++; }   // vision: a colonnade's stumps either side of the old street, up to four high
      else if (g > 1 - 1 / FIB[6]) put(x, y + 1, z, "waterworld:minoan_capital");   // the capitals fallen where they lay
    }
    const pieces = new Map(); for (const v of vox.values()) { const k = `${Math.floor(v.x / 32)},${Math.floor(v.z / 32)}`; (pieces.get(k) ?? pieces.set(k, []).get(k)).push(v); }
    for (const [, list] of pieces) { let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const v of list) b = [Math.min(b[0], v.x), Math.min(b[1], v.z), Math.max(b[2], v.x), Math.max(b[3], v.z)];
      const P2 = proto(`Akrotiri ${b[0]},${b[1]}`, new Map(list.map((v) => [`${v.x - b[0]},${v.y},${v.z - b[1]}`, { id: v.id, s: v.s }])), 0);
      placements.push({ p: P2.i, x: b[0], y: 0, z: b[1], f: pal("minecraft:air"), stilts: false, carve: false, free: true, tag: "ruin", b }); for (const v of list) taken.add(colKey(v.x, v.z)); } }
  say(`Akrotiri's ruins: ${site ? `${cols} Minoan column stumps and the old town's broken walls at ${site.map((v) => v).join(",")}` : "no ground found"}`); }
// the Arctic village on its tarn: igloos on the ice by Vogel's golden spiral (the k-th at 137.5° k, out by the root
// of k, so any count spreads evenly), a fishing hole by each, and inuksuit on the shore at the eight bearings
if (TARN) { const SN = "minecraft:snow", R0 = 3, igloo = new Map();   // vision: an igloo three blocks out (seven across), snow blocks
  for (let x = -R0; x <= R0; x++) for (let z = -R0; z <= R0; z++) for (let y = 0; y <= R0; y++) { const d = Math.hypot(x, y * 1.15, z); if (d <= R0 + 0.5 && d > R0 - 0.6) igloo.set(`${x},${y},${z}`, { id: SN, s: null }); }   // vision: a dome a little flattened
  for (let x = -R0 + 1; x <= R0 - 1; x++) for (let z = -R0 + 1; z <= R0 - 1; z++) if (Math.hypot(x, z) < R0 - 0.5) igloo.set(`${x},-1,${z}`, { id: "minecraft:white_wool", s: null });   // a floor of furs
  for (const [y, id] of [[0, "minecraft:air"], [1, "minecraft:air"]]) { igloo.set(`0,${y},${R0}`, { id, s: null }); igloo.set(`0,${y},${R0 + 1}`, { id: y ? SN : "minecraft:air", s: null }); igloo.set(`-1,${y},${R0 + 1}`, { id: SN, s: null }); igloo.set(`1,${y},${R0 + 1}`, { id: SN, s: null }); }   // the door, its short tunnel
  igloo.set(`0,0,0`, { id: "minecraft:campfire", s: null }); igloo.set(`0,${R0 + 1},0`, { id: "minecraft:air", s: null });   // a fire, and its smoke hole
  const IP = [0, 1, 2, 3].map((r) => proto("igloo", igloo, r)), hole = proto("fishing hole", new Map([["0,-1,0", { id: "minecraft:water", s: null }], ["1,0,0", { id: "minecraft:barrel", s: null }]]), 0);
  const inuk = proto("inuksuk", small([[0, 0, 0, "minecraft:stone"], [0, 1, 0, "minecraft:stone"], [-1, 2, 0, "minecraft:cobblestone_slab"], [0, 2, 0, "minecraft:stone"], [1, 2, 0, "minecraft:cobblestone_slab"], [0, 3, 0, "minecraft:cobblestone_wall"]]), 0);
  const TX0 = SX + TARN.u, TZ0 = SZ + TARN.v, n = Math.floor((TARN.R / (R0 * PHI ** 2)) ** 2);   // derived: as many as fit a golden square of an igloo's radius apart
  let built = 0;
  for (let k = 1; k <= n; k++) { const a = k * Math.PI * (3 - Math.sqrt(5)), r = (TARN.R - R0 - 2) * Math.sqrt(k / n), X = Math.round(TX0 + r * Math.cos(a)), Z = Math.round(TZ0 + r * Math.sin(a));   // given: the golden angle
    if (place(IP[k % 4], X, Z, { floorAt: G.SEA + TARN.level + 1, water: true, anyWater: true, foundation: "minecraft:packed_ice", pad: 1, tag: "igloo" })) { built++; place(hole, X + Math.round(Math.cos(a) * (R0 + 3)), Z + Math.round(Math.sin(a) * (R0 + 3)), { floorAt: G.SEA + TARN.level, water: true, anyWater: true, foundation: "minecraft:water", tag: "fishing hole" }); } }
  for (let b = 0; b < FIB[5]; b++) { const a = (b * Math.PI) / 4, X = Math.round(TX0 + (TARN.R + 4) * Math.cos(a)), Z = Math.round(TZ0 + (TARN.R + 4) * Math.sin(a)); place(inuk, X, Z, { pad: 1, tag: "inuksuk" }); }   // vision: four past the shore
  say(`the Arctic village: ${built} igloos of ${n} on the tarn's ice, eight inuksuit round its shore`); }
// (the bay's quarters are gone: the lagoon is open water but for the Therans' waterways round the cone)
// what each ground holds: the quarters, every people's pinnacle (world/pinnacle.js: as close and as high as its own way
// allows); the cone, the Therans' ruling houses (the mansion, a storey more); the island's towns, Theran town houses
const theranOf = (t) => (t === "therans" ? theran : byT.get(t));
const BUILDS = {
  quarter: (t) => pinnacle(theranOf(t), { tradition: t }),
  outer: (t) => pinnacle(theranOf(t), { tradition: t }),
  ruling: (t, v = 0) => { const b = pinnacle(theran, { tradition: "therans", storeys: 2 + (v % 2), n: 1 + (v % 3) }); return { ...b, vox: santorini(b.vox, v) }; },   // vision: the cone's houses two or three storeys, one household (no great blocks: the redesign)
  town: () => pinnacle(theran, { tradition: "therans", storeys: FIB[2], n: 5 }),   // derived: two storeys (Akrotiri's own: two or three)
  caldera: (t, v = 0) => { if (t !== "therans") return pinnacle(theranOf(t), { tradition: t }); const b = pinnacle(theran, { tradition: "therans", storeys: 1 + (v % 3), n: 1 + ((v >> 2) % 2) }); return { ...b, vox: santorini(b.vox, v) }; },   // cut into the cliff: the Therans' whitewashed houses, one to three storeys, one or two to a household, every variant its own accent pinnacle
};
const { THERANS } = await import("../world/therans.js");
const ST = THERANS.santorini, SWAP = { "minecraft:tuff_bricks": ST.wall, "minecraft:polished_tuff": ST.plaster, "minecraft:packed_mud": ST.vault.replace("_slab", ""), "minecraft:stripped_dark_oak_log": ST.plaster, "minecraft:tuff": ST.plaster };   // vision: the whitewash over the island's stone
const ACCENTS = [[ST.door, ST.shutter], ["minecraft:warped_door", "minecraft:warped_trapdoor"], ["minecraft:bamboo_door", "minecraft:bamboo_trapdoor"], ["minecraft:cherry_door", "minecraft:cherry_trapdoor"], ["minecraft:mangrove_door", "minecraft:mangrove_trapdoor"]];   // vision: blue, sea-green, ochre, rose, red-earth: the five accents on doors and shutters only
const WHITES = ["minecraft:white_concrete", "minecraft:calcite", "minecraft:smooth_quartz"];   // vision: the limewash's three whites, mixed so a wall weathers
const santorini = (vox, v = 0) => { const out = new Map(), [door, shutter] = ACCENTS[v % ACCENTS.length]; let n = 0; for (const [k, b] of vox) { let to = SWAP[b.id] ?? (/_door$/.test(b.id) ? door : /_trapdoor$/.test(b.id) ? shutter : null); if (to === ST.wall || to === ST.plaster) { const g = golden(n++ + v * 31); to = g < 0.8 ? WHITES[0] : g < 0.9 ? WHITES[1] : WHITES[2]; } out.set(k, to ? { id: to, s: /door|trapdoor/.test(to) ? b.s : null } : b); } return out; };   // vision: four in five plain white, the rest calcite or quartz
// the houses, every one its own: the room law's buildings (world/census.js buildOf, world/building.js: rooms from the
// periodic table, each people's own grammar), the type drawn by the plan's class, the seed by the cell
const CEN = await import("../world/census.js");
const MIX = {   // vision: what each class builds, by weight: homes mostly, with the work and trade a place of that size keeps
  city: [["house", 5], ["narrow", 3], ["shophouse", 3], ["bighouse", 1], ["workshop", 2], ["inn", 1], ["bakehouse", 1], ["smithy", 1]],
  town: [["house", 5], ["cottage", 3], ["shophouse", 2], ["workhouse", 1], ["weavery", 1], ["bakehouse", 1]],
  village: [["cottage", 5], ["house", 3], ["farmhouse", 2], ["smokehouse", 1], ["byre", 1]],
  rural: [["farmhouse", 5], ["barn", 2], ["granary", 1], ["byre", 1], ["cottage", 2], ["woodshed", 1]],
  waterfront: [["fisherhouse", 5], ["warehouse", 2], ["smokehouse", 1], ["inn", 1], ["markethall", 1], ["counting", 1]],
  skirt: [["house", 5], ["cottage", 3], ["bighouse", 1], ["workshop", 1]],
};
const pickType = (cls, g) => { const m = MIX[cls] ?? MIX.town, tot = m.reduce((a, [, w]) => a + w, 0); let x = g * tot; for (const [id, w] of m) { x -= w; if (x < 0) return id; } return m[0][0]; };
const spotsOf = (vox) => { const out = []; for (const k of vox.keys()) { const [x, y, z] = k.split(",").map(Number); if (vox.has(`${x},${y + 1},${z}`) || vox.has(`${x},${y + 2},${z}`)) continue; for (let u = 3; u < 13; u++) if (vox.has(`${x},${y + u},${z}`)) { out.push([x, y + 1, z]); break; } } return out; };   // a floor cell under a roof with two clear over it
// roof gardens on any big flat roof (a Theran villa's, a courtyard house's, a market hall's): the roof is the commonest
// top among the building's columns; where it is level over at least eighty-nine cells, beds of grass go into its
// inner cells on a six-block grain, an azalea at each bed's heart and the people's own flowers round it
const GARDENED = new WeakSet(), FLOWERS = { therans: ["cornflower", "lily_of_the_valley", "dandelion", "lily_of_the_valley"], default: ["poppy", "oxeye_daisy", "cornflower", "allium", "azure_bluet"] };   // vision: Thera's blue, white and gold; elsewhere a meadow's
const SMOKY = new Set(["smithy", "tannery", "smokehouse", "minehead", "woodshed", "shipyard", "boathouse", "byre", "barn", "kiln", "forge"]);   // vision: no garden over a fire, a hide pit, a byre or a slipway
const roofGarden = (vox, t, id) => { if (t !== "therans" || SMOKY.has(id) || GARDENED.has(vox)) return 0;   // vision: gardens on Thera's roofs only, for now
  GARDENED.add(vox);
  const top = new Map(); for (const [k, v] of vox) { if (!v || v.id === "minecraft:air") continue; const [x, y, z] = k.split(",").map(Number), c = `${x},${z}`; if (!top.has(c) || y > top.get(c)) top.set(c, y); }
  const hist = new Map(); for (const y of top.values()) hist.set(y, (hist.get(y) ?? 0) + 1); let roofY = null, n = 0; for (const [y, c] of hist) if (c > n) { n = c; roofY = y; }
  if (n < FIB[10]) return 0;   // vision: a roof of eighty-nine cells or more
  const FL = FLOWERS[t] ?? FLOWERS.default; let beds = 0;
  for (const [c, y] of top) { if (y !== roofY) continue; const [x, z] = c.split(",").map(Number);
    if (![[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(([a, b]) => top.get(`${x + a},${z + b}`) === roofY)) continue;   // inner cells only: the parapet and the edge stay
    const v = vox.get(`${x},${y},${z}`); if (!v || /stairs|slab|glass|lantern|chest|bed/.test(v.id)) continue;
    const i = ((x % 6) + 6) % 6, k = ((z % 6) + 6) % 6; if (!(i >= 2 && i <= 4 && k >= 2 && k <= 4)) continue;   // vision: beds three across on a six-block grain
    vox.set(`${x},${y},${z}`, { id: "minecraft:grass_block", s: null });
    vox.set(`${x},${y + 1},${z}`, { id: i === 3 && k === 3 ? ((x + z) % 4 === 0 ? "minecraft:flowering_azalea" : "minecraft:azalea") : `minecraft:${FL[((x * 7 + z * 13) % FL.length + FL.length) % FL.length]}`, s: null }); beds++; }
  return beds; };
let roofBeds = 0, lintels = 0;
// the peoples' carvings over their doors (world/carvings.js PEOPLE_CARVINGS): the block over each door's top, and the
// wall's blocks either side of it, become the people's carving; once a building
const { PEOPLE_CARVINGS } = await import("../world/carvings.js"), CARVED_DOORS = new WeakSet();
const carveDoor = (vox, t) => { if (!PEOPLE_CARVINGS[t] || CARVED_DOORS.has(vox)) return; CARVED_DOORS.add(vox); const id = `waterworld:${t}_carving`;
  let best = null; for (const [k, v] of vox) { if (!v || !/_door$/.test(v.id)) continue; const [x, y, z] = k.split(",").map(Number); if (!best || y > best[1]) best = [x, y, z]; }   // the door's top block
  if (!best) return; const [x, y, z] = best, solid = (a, b, c) => { const v = vox.get(`${a},${b},${c}`); return v && !/air|glass|pane|door|stairs|slab|trapdoor|lantern|torch/.test(v.id); };
  if (!solid(x, y + 1, z)) return; vox.set(`${x},${y + 1},${z}`, { id, s: null }); lintels++;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (solid(x + dx, y + 1, z + dz) && solid(x + dx, y, z + dz)) vox.set(`${x + dx},${y + 1},${z + dz}`, { id, s: null }); };   // the lintel three wide along its wall
const roomBuild = (id, t, seed) => { const b = CEN.buildOf(id, t, seed), vox = b.vox; roofBeds += roofGarden(vox, t, id); carveDoor(vox, t); const spots = spotsOf(vox), beds = Math.max(1, [...vox.values()].filter((v) => /_bed$|^minecraft:bed$/.test(v.id)).length); return { vox, beds, spots, storeys: 1, door: null, room: true }; };
const builtVox = new Map(), buildOf = (kind, t, v = 0) => { const k = `${kind} ${t} ${v}`; if (!builtVox.has(k)) builtVox.set(k, BUILDS[kind](t, v)); return builtVox.get(k); };
const VARIANTS = FIB[5];   // vision: eight seeds a type a people, dealt by the golden sequence (no two neighbours alike)
// how built-up each class is: the share of the cells tried that get a house (the plan's FILL, as a share of the densest packing)
const KEEP = { ...TPL.FILL, wild: 0, market: 0, precinct: 0, ice: 0, skirt: TPL.FILL.city }, THINNER = 1 / PHI ** 2;   // vision: the Therans' own city thinner yet, a golden square (a garden city round the lagoon)   // derived: the plan's share of the ground under houses, a class (theraplan.js FILL); none on the wild, the market or the precinct
let houses = 0, beds = 0; const perCulture = {}; const residents = [];
// the folk: one in SHOWN of a house's people stands in it (the rest are out at sea, at work, asleep): each a skin of its
// people (world/dress.js) and a name (world/names.js); the great houses' are the Therans' rulers and their guards
const { CALIBRATION } = await import("../game/calibration.js");
const SHOWN = CALIBRATION.shownThera;   // calibrated (game/calibration.js): one in so many of Thera's people shown (a city of twenty thousand would be too many to walk among)
let folkN = 0;
const rankSlot = (g) => (g < 1 / 13 ? 5 : g < 1 / 13 + 1 / 21 ? 4 : g < 1 / 13 + 1 / 21 + 1 / 8 ? 6 : g < 1 / 13 + 1 / 21 + 1 / 4 ? 7 : Math.floor(g * 97) % 4);   // derived: a guard in 13, a cleric in 21, a crafter in 8, an elder in 8; the rest everyday
function settle(pl, b, t, kind, r, shown = SHOWN) {
  const spots = b.room ? b.spots : floorsOf(b); if (!spots.length) return;
  const n = kind === "town" ? Math.floor(b.beds / shown + golden(placements.length)) : Math.max(1, Math.round(b.beds / shown)),   // a small house's share, dealt by the golden sequence so it comes out right over a town
    every = Math.max(1, Math.floor(spots.length / n));
  for (let k = 0; k < n; k++) {
    let [x, y, z] = spots[(k * every + Math.floor(golden(folkN) * every)) % spots.length]; for (let q = 0; q < r; q++) [x, z] = [-z, x];
    const g = golden(folkN * 3 + 1);
    const skin = kind === "ruling" ? (g < 1 / 3 ? rulerIndex(folkN) : g < 1 / 3 + 1 / 5 ? skinIndex("therans", 5) : skinIndex("therans", Math.floor(g * 97) % 4)) : skinIndex(t, rankSlot(g));   // derived: a third of a great house's folk its rulers, a fifth its guards
    residents.push([pl.x + x, pl.y + y, pl.z + z, skin, CULTURES.indexOf(t), folkN]); folkN++;
  }
}
const scan = (kinds, kind, cultureOf, slope, stride = 1, { max = Infinity, classed = true } = {}) => {   // classed: the count from the plan's shares (else max)
  let made = 0;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (kinds.has(grid[j * N + i])) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); z0 = Math.min(z0, j); z1 = Math.max(z1, j); }
  if (x0 === Infinity) return;
  const order = []; for (let j = z0; j <= z1; j += stride) for (let i = x0; i <= x1; i += stride) if (kinds.has(grid[j * N + i])) order.push(j * N + i);
  // how many: each class's share of its ground over a lot (seventeen by twenty-one, the plan's mean), the Therans thinner; tried
  // in a weighted shuffle (Efraimidis and Spirakis: each cell's key its draw to the power one over its class's share), so the
  // houses come out in their classes' proportions and spread over all the ground, and the tries go on till the count is met
  const wOf = (c) => { const cls = TPL.CLASSES[clsGrid[c] - 1] ?? null; return (cls ? KEEP[cls] ?? 1 : 1) * (CULT[cultGrid[c]] === "therans" ? THINNER : 1); };
  if (classed) { let want = 0; for (const c of order) want += (wOf(c) * (G.CELL * stride) ** 2) / (17 * 21); max = Math.min(max, Math.round(want)); classed = false; }   // vision: the plan's mean lot
  const key = new Map(order.map((c) => [c, wOf(c) > 0 ? Math.pow(golden(c * 3 + 1), 1 / wOf(c)) : -1]));
  order.sort((a, b) => key.get(b) - key.get(a));
  while (order.length && key.get(order[order.length - 1]) < 0) order.pop();
  for (const cell of order) { const i = cell % N, j = Math.floor(cell / N);   // every cell: the densest packing the lanes allow (or the shuffle's)
    const u = (i - N / 2) * G.CELL + 1, v = (j - N / 2) * G.CELL + 1, X = SX + u, Z = SZ + v, t = cultureOf(u, v, i, j); if (!t) continue;
    const vv = Math.floor(golden(i * 7 + j * 13) * VARIANTS), cls0 = clsAt(i, j), ty = pickType(kind === "ruling" ? "skirt" : cls0, golden(i * 5 + j * 11 + 3)), key = `${ty} ${t} ${vv}`;
    if (!builtVox.has(key)) builtVox.set(key, roomBuild(ty, t, vv + 1));
    const b = builtVox.get(key), pad = PARTY.has(t) ? 1 : 2;
    // the plan's density: a house's chance at a cell is its class's share of the ground over the cells its footprint
    // takes (with its pad), so each class comes out at its own share whatever the house's size
    const cls = clsAt(i, j), fp = footOf(b.vox), area = (fp[1] - fp[0] + 1 + 2 * pad) * (fp[3] - fp[2] + 1 + 2 * pad), keep = cls ? ((KEEP[cls] ?? 1) * (t === "therans" ? THINNER : 1) * (G.CELL * stride) ** 2) / area : 1;
    if (classed && golden(j * N + i) >= keep) continue;
    if (made >= max) return;
    for (const r of [0, 1, 2, 3]) if (place(proto(key, b.vox, r), X, Z, { pad, kinds, slope, carve: kind === "caldera" || (kind === "outer" && !!CLIFF[t]), foundation: kind === "caldera" ? ST.plaster : "minecraft:calcite", stilts: t === "shallow", water: t === "shallow", floorAt: t === "shallow" ? G.SEA + 1 : null, tag: `${kind}|${t}` })) {
      houses++; made++; beds += b.beds; const key = t === "therans" ? `therans (${kind})` : kind === "caldera" ? `${t} (cliff)` : t; perCulture[key] = (perCulture[key] ?? 0) + 1;
      placements[placements.length - 1].folk = { t, kind, beds: b.beds, door: b.door, storeys: b.storeys, r };
      settle(placements[placements.length - 1], b, t, kind, r);
      break;
    }
  }
};
const live = new Set(L.map((p) => p.tradition));
{ let cells = 0; for (const k of grid) if (k === G.KIND["inner city"]) cells++; const want = Math.round((cells * G.CELL ** 2 * KEEP.skirt * THINNER) / (FIB[7] * FIB[7]));   // derived: the cone's city at the city's share, thinned as the Therans' are, over a house and its garden (twenty-one square)
  scan(new Set([G.KIND["inner city"]]), "ruling", () => "therans", FIB[5], 1, { max: want, classed: false }); }   // derived: a terrace (seven blocks, world/city.js) under a house at most: the great houses stand on podiums
scan(new Set([G.KIND.caldera]), "caldera", () => "therans", FIB[5]);   // the caldera's wall, the Therans': derived: a cliff of eight at most under a house, cut back into it
// the outer slope: each people's wedge, rim to sea, its commons down the wedge's middle, then its houses as close as its way allows
for (const q of tplan.seeds) {
  if (!live.has(q.tradition)) continue;
  for (let r = 0, k = 0; r < TR; r += FIB[9], k++) {   // derived: a common every 55 blocks down the region's middle
    const X = Math.round(SX + Math.cos(-q.a) * r), Z = Math.round(SZ + Math.sin(-q.a) * r), g = G.heightAt(X, Z); if (g.kind !== G.KIND.outer) continue;
    if (k % 3 === 0) place(proto("shrine", SHRINE), X, Z, { foundation: "minecraft:prismarine_bricks", pad: 2 }); else if (k % 3 === 1) place(proto("well", WELL), X, Z, { pad: 1 }); else place(proto("bell", BELL), X, Z, { pad: 1 });
  }
}
scan(new Set([G.KIND.outer]), "outer", (u, v, i, j) => { const t = CULT[cultGrid[j * N + i]]; return t && live.has(t) ? t : null; }, FIB[4], 2);   // derived: a rise of five under a house, made up or cut back; every other cell tried
// the Theran garden (game/therantrees.js, claude/thera-garden.md): its trees on the Therans' ground wherever a house
// didn't take it: olives on the wall's terraces, lefka (the white poplar, amber over white bark) in golden stripes
// down the wall and on the rim's walks, cypress at the precinct and the market; a tree every few cells, by a draw
{ const { theranTree } = await import("../game/therantrees.js"), { gnoise } = await import("../core/noise.js"), treeVox = new Map(), TV = FIB[4];   // vision: five shapes a kind
  const treeOf = (kind, v) => { const k = `${kind} ${v}`; if (!treeVox.has(k)) treeVox.set(k, new Map(theranTree(kind, v + 1).map((b) => [`${b.x},${b.y},${b.z}`, { id: b.id, s: null }]))); return treeVox.get(k); };
  const TK = new Set([G.KIND.caldera, G.KIND["inner city"], G.KIND.acropolis, G.KIND.street, G.KIND["harbour master's island"]]); let n = 0; const by = {};
  for (let j = 0; j < N; j += FIB[4]) for (let i = 0; i < N; i += FIB[4]) {   // derived: a try every ten blocks
    if (!TK.has(grid[j * N + i]) || CULT[cultGrid[j * N + i]] !== "therans") continue;
    const cls = clsAt(i, j), keep = cls === "precinct" || cls === "market" ? 1 / PHI : cls === "city" ? 1 / PHI ** 2 : 1 / PHI; if (golden(j * N + i + 7) >= keep) continue;   // vision: the gardens' share of the tries
    const jit = FIB[4] * G.CELL, u = (i - N / 2) * G.CELL + 1 + Math.round((golden(i * 11 + j) - 0.5) * jit), v = (j - N / 2) * G.CELL + 1 + Math.round((golden(j * 17 + i) - 0.5) * jit), X = SX + u, Z = SZ + v;   // derived: each try jittered within its own ten blocks (a grove, not an orchard's grid)
    const stripe = gnoise(u / FIB[9], v / FIB[9], 719) > 0.35, kind = (cls === "precinct" && golden(i * j + 3) < 1 / PHI) || (cls === "market" && golden(i + j) < 1 / PHI ** 3) ? "kyparissi" : stripe || (cls === "market" && golden(i + j + 1) < 1 / PHI) ? "lefka" : "elia";   // vision: the lefka in stripes fifty-five blocks across where the noise passes 0.35; the cypress a golden share of the precinct's trees and a golden cube's of the market's
    const vv = Math.floor(golden(i * 3 + j * 5) * TV);
    if (place(proto(`tree ${kind} ${vv}`, treeOf(kind, vv), Math.floor(golden(i + j * 3) * 4)), X, Z, { trunk: true, pad: kind === "kyparissi" ? 1 : 3, kinds: TK, tag: "tree" })) { n++; by[kind] = (by[kind] ?? 0) + 1; }
  }
  say(`the Theran garden: ${n} trees (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ")})`); }
const folkOf = {}; for (const pl of placements) if (pl.folk) folkOf[pl.folk.t] = (folkOf[pl.folk.t] ?? 0) + pl.folk.beds;
say(`Thera's folk by people (as many as its quarters' ground and its building's density hold): ${Object.entries(folkOf).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
say(`Thera: ${houses} buildings, ${beds} beds (${Object.entries(perCulture).map(([k, v]) => `${k} ${v}`).join(", ")}); not placed: ${Object.entries(why).map(([k, v]) => `${v} ${k}`).join(", ")}`);

// ---- the learn-to-sail courses: buoyed round the lagoon's open water (the channel from the cothon to the mouth left open)
{ const CG = await import("../world/city.js"), g = CG.geometry(), path = g.lagoonPath.map(([x, y]) => { const [rx, ry] = unwarp(x, y); return [rx, ry]; }), half = g.fairwayHalf;   // the channel from the main cothon to the mouth (not out the strait)
  const { skywayPieces } = await import("../game/skyway.js"), ground = (X, Z) => { const t = G.SEA + Math.round(G.heightAt(X, Z).h); return { top: t, water: t <= G.SEA }; };
  // the courses: three loops of buoys round the lagoon's open water, each from a dock (a red mark to round to port, white
  // to starboard), by the golden angle round each course's middle so each loop's marks are evenly spread
  const buoy = (depth, red) => small([...Array.from({ length: depth }, (_, y) => [0, -y, 0, "minecraft:stripped_birch_log"]), [0, 1, 0, red ? "minecraft:red_concrete" : "minecraft:white_concrete"], [0, 2, 0, "minecraft:lantern", { hanging: false }]]);
  let buoys = 0; const B = THERA.bay, BX = SX + B.x * K, BZ = SZ - B.y * K; COURSES.length = 0;
  for (let c = 0; c < 3; c++) { const R = (B.a * K) * (0.35 + 0.18 * c), n = FIB[5]; const marks = []; COURSES.push(marks);   // vision: courses at a third of the lagoon's half-width and out from there, eight marks each
    for (let m = 0; m < n; m++) { const a = (m / n) * 2 * Math.PI + c * 0.7, X = Math.round(BX + R * Math.cos(a)), Z = Math.round(BZ + R * Math.sin(a)), g2 = G.heightAt(X, Z); if (g2.h > -2) continue;
      if (place(proto(`buoy ${-Math.round(g2.h)} ${m % 2}`, buoy(Math.min(FIB[5], -Math.round(g2.h)), m % 2 === 0), 0), X, Z, { floorAt: G.SEA, water: true, anyWater: true, foundation: "minecraft:water", tag: "buoy" })) { buoys++; marks.push([X, Z]); } } }
    say(`the sailing courses: ${buoys} buoys on three courses`); }

// ---- the waterfront promenade (the showcase waterfront, claude/thera-redesign.md): along the Therans' low shores round
// the lagoon (the caldera's foot and the cone's), a paved esplanade six blocks deep from the water's edge, in each people's own stone (the Therans'
// calcite edged in quartz): a kerb at the water with a low rail, lamps on posts along it, benches facing the water a
// little back, planters at its inner edge; only on ground one to five over the sea, never on a house or a skyway's feet
{ const WF = TPL.CLASSES.indexOf("waterfront") + 1, DEEP = FIB[6] - FIB[5] + 1, LAMPGAP = FIB[6] - 2, BENCHGAP = FIB[7] - FIB[4], PLANTGAP = FIB[5] + 1;   // vision: six deep; a lamp every eleven, a bench every sixteen, a planter every nine
  const PAVE = { therans: ["calcite", "smooth_quartz", "smooth_quartz_slab", "soul_lantern", "quartz_pillar"], european: ["stone_bricks", "polished_andesite", "stone_brick_slab", "lantern", "stone_brick_wall"], norse: ["spruce_planks", "stripped_spruce_log", "spruce_slab", "lantern", "spruce_fence"],
    japanese: ["polished_andesite", "stone_bricks", "polished_andesite_slab", "lantern", "stone_brick_wall"], east_asian: ["polished_andesite", "stone_bricks", "polished_andesite_slab", "lantern", "stone_brick_wall"], indian_ocean: ["smooth_sandstone", "cut_sandstone", "cut_sandstone_slab", "lantern", "sandstone_wall"],
    pacific: ["bamboo_planks", "stripped_bamboo_block", "bamboo_slab", "lantern", "bamboo_fence"], default: ["smooth_stone", "stone_bricks", "smooth_stone_slab", "lantern", "stone_brick_wall"] };   // vision: each people's stone: the walk, its kerb, the rail, the lamp, the lamp's post
  const cells = new Map(), DIRS = Array.from({ length: 8 }, (_, k) => [Math.round(Math.cos(k * Math.PI / 4)), Math.round(Math.sin(k * Math.PI / 4))]);
  const SHOREKINDS = new Set([G.KIND.caldera, G.KIND["inner city"]].filter((v) => v !== undefined));   // the Therans' own shores: the caldera's foot round the lagoon, and the cone's (the peoples' coasts keep their own beaches and quays)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (!SHOREKINDS.has(grid[j * N + i]) && clsGrid[j * N + i] !== WF) continue; const t = CULT[cultGrid[j * N + i]] || "therans"; if (t !== "therans") continue;
    for (let a = 0; a < G.CELL; a++) for (let b = 0; b < G.CELL; b++) { const X = Math.round(SX + (i - N / 2) * G.CELL + a), Z = Math.round(SZ + (j - N / 2) * G.CELL + b), k = colKey(X, Z); if (cells.has(k) || taken.has(k)) continue;
      const h = Math.round(G.heightAt(X, Z).h); if (h < 1 || h > FIB[4]) continue;
      let d = Infinity, wd = null; for (const [dx, dz] of DIRS) for (let r = 1; r <= DEEP && r < d; r++) if (G.heightAt(X + dx * r, Z + dz * r).h < 0) { d = r; wd = [dx, dz]; break; }
      if (d > DEEP) continue; cells.set(k, { X, Z, y: G.SEA + h, d, wd, t }); } }
  const spaced = (list, gap) => { const out = [], grid2 = new Map(); for (const c of list) { const gx = Math.floor(c.X / gap), gz = Math.floor(c.Z / gap); let near = false;
      for (let a = -1; a <= 1 && !near; a++) for (let b = -1; b <= 1 && !near; b++) for (const o of grid2.get(`${gx + a},${gz + b}`) ?? []) if (Math.hypot(o.X - c.X, o.Z - c.Z) < gap) { near = true; break; }
      if (!near) { out.push(c); (grid2.get(`${gx},${gz}`) ?? grid2.set(`${gx},${gz}`, []).get(`${gx},${gz}`)).push(c); } } return new Set(out); };
  const all = [...cells.values()].sort((p, q) => p.X - q.X || p.Z - q.Z), lamps = spaced(all.filter((c) => c.d === 1), LAMPGAP), benches = spaced(all.filter((c) => c.d === FIB[4] - 2), BENCHGAP), plants = spaced(all.filter((c) => c.d === DEEP), PLANTGAP);
  const pieces = new Map(), put = (X, y, Z, id, st = null) => { const ck = `${Math.floor(X / 16)},${Math.floor(Z / 16)}`; if (!pieces.has(ck)) pieces.set(ck, new Map()); pieces.get(ck).set(`${X},${y},${Z}`, { x: X, y, z: Z, id: `minecraft:${id}`, s: st }); };
  const FACE = (dx, dz) => Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 1 : 0) : (dz > 0 ? 3 : 2);   // given: a stair's weirdo_direction rising east 0, west 1, south 2, north 3: the seat's back to the land, so it faces the water
  let lit = 0, sat = 0, grown = 0;
  for (const c of all) { const P = PAVE[c.t] ?? PAVE.default, kerb = c.d === 1;
    put(c.X, c.y, c.Z, kerb ? P[1] : ((c.X + c.Z) % 5 === 0 ? P[1] : P[0]));   // the walk, a border stone every so often; the kerb at the water
    if (kerb) { if (lamps.has(c)) { put(c.X, c.y + 1, c.Z, P[4], P[4].endsWith("pillar") ? { pillar_axis: "y" } : null); put(c.X, c.y + 2, c.Z, P[4], P[4].endsWith("pillar") ? { pillar_axis: "y" } : null); put(c.X, c.y + 3, c.Z, P[3], { hanging: false }); lit++; } else put(c.X, c.y + 1, c.Z, P[2], { "minecraft:vertical_half": "bottom" }); }
    else if (benches.has(c) && c.wd) { put(c.X, c.y + 1, c.Z, c.t === "therans" ? "quartz_stairs" : "stone_brick_stairs", { weirdo_direction: FACE(-c.wd[0], -c.wd[1]), upside_down_bit: false }); sat++; }
    else if (plants.has(c)) { put(c.X, c.y, c.Z, "grass_block"); put(c.X, c.y + 1, c.Z, c.t === "therans" ? "flowering_azalea" : "azalea"); grown++; } }
  for (const [, m] of pieces) { const vox = [...m.values()]; let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const v of vox) b = [Math.min(b[0], v.x), Math.min(b[1], v.z), Math.max(b[2], v.x), Math.max(b[3], v.z)];
    const P2 = proto(`promenade ${b[0]},${b[1]}`, new Map(vox.map((v) => [`${v.x - b[0]},${v.y},${v.z - b[1]}`, { id: v.id, s: v.s }])), 0);
    placements.push({ p: P2.i, x: b[0], y: 0, z: b[1], f: pal("minecraft:air"), stilts: false, carve: false, free: true, tag: "promenade", b }); for (const v of vox) taken.add(colKey(v.x, v.z)); }
  { const DM = THERA.dome, cxB = SX + DM.x * K, czB = SZ - DM.y * K, hist = {}; for (const c of cells.values()) { const r = Math.round(Math.hypot(c.X - cxB, c.Z - czB) / 200) * 200; hist[r] = (hist[r] ?? 0) + 1; } say(`promenade by distance from the cone: ${JSON.stringify(hist)}; by people ${JSON.stringify([...cells.values()].reduce((a, c) => (a[c.t] = (a[c.t] ?? 0) + 1, a), {}))}`); }
  say(`the waterfront promenade: ${cells.size} paved columns in ${pieces.size} pieces, ${lit} lamps, ${sat} benches, ${grown} planters`); }

// ---- the market ring (claude/thera-redesign.md): along the rim's crest, a stall every eight blocks, a golden share
// of the slots taken (the rest the ring's open walks), each stall's awning the colour of the nearest people's gate;
// and a gate where each people's land meets the ring, built in that people's stone
{ const B = THERA.bay, mid = (TPL.BANDS.RIM[0] + TPL.BANDS.RIM[1]) / 2, ring = [];
  for (let k = 0; k < 4 * FIB[10] * FIB[5]; k++) { const a = (k / (4 * FIB[10] * FIB[5])) * 2 * Math.PI; let lo = 0.8, hi = 2.2;   // vision: the crest found on 2,848 bearings, by halving
    for (let n = 0; n < FIB[6]; n++) { const r = (lo + hi) / 2, t = theraMetres(B.x + r * B.a * Math.cos(a), B.y + r * B.b * Math.sin(a)); if (t.bay < mid) lo = r; else hi = r; }
    const r = (lo + hi) / 2, x = B.x + r * B.a * Math.cos(a), y = B.y + r * B.b * Math.sin(a); if (theraMetres(x, y).m > 0) ring.push([Math.round(SX + x * K), Math.round(SZ - y * K), a]); }
  const AWN = { indian_ocean: "orange", european: "purple", japanese: "red", east_asian: "yellow", norse: "light_blue", pacific: "cyan", birchbark: "brown", dugout: "black", shallow: "lime", arctic: "white" };   // vision: a colour a people (the plan map's hues)
  const STONE = { indian_ocean: "minecraft:sandstone", european: "minecraft:stone_bricks", japanese: "minecraft:dark_oak_planks", east_asian: "minecraft:red_nether_brick", norse: "minecraft:spruce_planks", pacific: "minecraft:bamboo_planks", birchbark: "minecraft:birch_planks", dugout: "minecraft:stripped_spruce_log", shallow: "minecraft:mangrove_planks", arctic: "minecraft:packed_ice" };   // vision: each people's own stuff for its gate
  const stall = (c) => small([...[-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [[a, 0, b, "minecraft:oak_fence"], [a, 1, b, "minecraft:oak_fence"]])), ...[-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => [a, 2, b, `minecraft:${c}_wool`])), [0, 0, -1, "minecraft:barrel"], [0, 0, 1, "minecraft:crafting_table"], [0, 1, 0, "minecraft:lantern", { hanging: true }]]);
  const gate = (st) => { const v = []; for (let y = 0; y <= FIB[5]; y++) for (const x of [-3, 3]) v.push([x, y, 0, st]); for (let x = -3; x <= 3; x++) v.push([x, FIB[5] + 1, 0, st], [x, FIB[5] + 2, 0, x % 3 === 0 ? st : "minecraft:smooth_quartz"]); v.push([0, FIB[5], 0, "minecraft:lantern", { hanging: true }]); return small(v); };   // vision: an arch seven wide, eight clear
  const peopleAt = (X, Z) => { const i = Math.round((X - SX) / G.CELL + N / 2), j = Math.round((Z - SZ) / G.CELL + N / 2); for (let r = 0; r < 60; r++) for (const [di, dj] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const t = CULT[cultGrid[(j + dj) * N + i + di]]; if (t && t !== "therans") return t; } return null; };   // vision: the nearest people's ground, out to 120 blocks
  let stalls = 0, gates = 0, last = FIB[5];
  ring.forEach(([X, Z], k) => { const d = Math.hypot(X - (ring[k - 1]?.[0] ?? X), Z - (ring[k - 1]?.[1] ?? Z)); last += d; if (last < FIB[5]) return; last = 0; if (golden(k) >= 1 / PHI) return; const t = peopleAt(X, Z); if (!t) return; if (place(proto(`stall ${t}`, stall(AWN[t] ?? "white"), k % 4), X, Z, { pad: 1, foundation: "minecraft:calcite", tag: "stall" })) stalls++; });
  for (const q of tplan.seeds) { const a = -q.a, near = ring.map(([X, Z], k) => { const b = Math.atan2(Z - (SZ - B.y * K), X - (SX + B.x * K)); return { X, Z, b, d: Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) }; }).sort((p, r) => p.d - r.d).slice(0, FIB[9]);   // the ring's points nearest the people's middle bearing, the first that takes the gate
    for (const best of near) if (place(proto(`gate ${q.tradition}`, gate(STONE[q.tradition] ?? "minecraft:stone_bricks"), Math.round(((best.b / (Math.PI / 2)) % 4 + 4) % 4) % 4), best.X, best.Z, { pad: 1, foundation: "minecraft:calcite", tag: "gate" })) { gates++; break; } }
  say(`the market ring: ${ring.length} points round the rim, ${stalls} stalls, ${gates} gates of ${tplan.seeds.length}`); }

// ---- the world's towns: every people's town as world/boxes.js townOf lays it out, its houses the people's own (world/dwelling.js),
// a quarter densified a storey more where its ground ran out; the hall a great house of the people, the market its stalls, the temple
// the district's shrine; the streets and plazas paved on the ground as it lies; the walls where the people's guard calls for them
const { economy } = await import("../world/economy.js");
const { townOf, populations } = await import("../world/boxes.js");
const { surfaceOf } = await import("../world/chem.js");
const { loop } = await import("../world/history.js");
const Lw = loop(), Rw = economy(1), Pw = populations();
// the settlements grown as crystals (tools/bakegrown.mjs: lab/grown/, nearest Thera first): their members' towns are theirs, not townOf's
const GROWN = await (async () => { const dir = path.join(ROOT, "lab/grown"); if (!fs.existsSync(dir)) return []; const { sourceHash } = await import("./bakegrown.mjs"), h = sourceHash(), all = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))), fresh = all.filter((g) => g.hash === h);
  if (fresh.length < all.length) say(`grown settlements: ${all.length - fresh.length} of ${all.length} grown under older sources, left out (node tools/bakegrown.mjs grows them again)`); return fresh; })();   // a town grown on other ground would stand on the wrong ground
const grownMembers = new Set(GROWN.flatMap((g) => g.members));
const SHOWN_TOWN = CALIBRATION.shownTown;   // calibrated: one in so many of a town's people stands in it (the world holds far more than Thera)
const plainCache = new Map(), plainOf = (p, t, storeys = 1) => { const ck = `${t} ${storeys}`; if (!plainCache.has(ck)) { const b = plainOf0(p, t, storeys); if (b?.vox instanceof Map) carveDoor(b.vox, t); plainCache.set(ck, b); } return plainCache.get(ck); };   // each people's house, its carving over the door
const plainOf0 = (p, t, storeys = 1) => { if (storeys > 1) return pinnacle(p, { tradition: t, storeys, n: HOUSEHOLD[FORM[t]?.form ?? "twocell"] ?? 5 }); const h = houseOf(p, { n: HOUSEHOLD[FORM[t]?.form ?? "twocell"] ?? 5, job: "fisherman", tradition: t }); return { vox: h.vox, door: h.door, storeys: 1, beds: h.n ?? 5, house: h, floorY: h.door.y - 1, step: 0 }; };
const hallCache = new Map(), hallOf = (p, t) => { if (!hallCache.has(t)) { const b = pinnacle(p, { tradition: t, storeys: 1, n: FIB[6] }); if (b?.vox instanceof Map) carveDoor(b.vox, t); hallCache.set(t, b); } return hallCache.get(t); };   // derived: a hall of thirteen: the people's great house, the moot under one roof
const rename = (id) => (id === "minecraft:dirt_path" ? "minecraft:grass_path" : id === "minecraft:stone_stairs" ? "minecraft:cobblestone" : id === "minecraft:oak_fence_gate" ? "minecraft:fence_gate" : id);   // given: Bedrock calls the oak gate plain fence_gate
const MARKET = (dyeName) => small([...Array.from({ length: 8 }, (_, k) => { const x = (k % 4) * 5 - 7, z = Math.floor(k / 4) * 8 - 4; return [[x, 1, z, "minecraft:oak_fence"], [x + 2, 1, z, "minecraft:oak_fence"], [x, 2, z, "minecraft:oak_fence"], [x + 2, 2, z, "minecraft:oak_fence"], [x, 3, z, `minecraft:${dyeName}_wool`], [x + 1, 3, z, `minecraft:${dyeName}_wool`], [x + 2, 3, z, `minecraft:${dyeName}_wool`], [x + 1, 1, z, "minecraft:barrel", { facing_direction: 1 }]]; }).flat()]);   // vision: eight stalls in two rows, a barrel under each awning
const PIER = small([...Array.from({ length: 13 }, (_, k) => [[-1, 0, k - 6, "minecraft:oak_planks"], [0, 0, k - 6, "minecraft:oak_planks"], [1, 0, k - 6, "minecraft:oak_planks"], ...(k % 4 === 0 ? [[-1, 1, k - 6, "minecraft:oak_fence"], [1, 1, k - 6, "minecraft:oak_fence"]] : [])]).flat()]);   // derived: the pier box (three by thirteen), a post every four
const paints = [], walls = [];
const paintRect = (X, Z, w, l, id) => { if (w > 0 && l > 0) paints.push({ d: ["r", pal(rename(id)), X, Z, w, l], b: [X, Z, X + w - 1, Z + l - 1] }); };   // a plaza: its rectangle
const paintLine = (X0, Z0, X1, Z1, w, id) => { const h = Math.ceil(w / 2); paints.push({ d: ["l", pal(rename(id)), Math.round(X0), Math.round(Z0), Math.round(X1), Math.round(Z1), w], b: [Math.round(Math.min(X0, X1)) - h, Math.round(Math.min(Z0, Z1)) - h, Math.round(Math.max(X0, X1)) + h, Math.round(Math.max(Z0, Z1)) + h] }); };   // a street: its line and width (the game finds its blocks)
// ---- the grown settlements, per chunk: a 32-byte mask of the columns no tree may grow on (a changed column within three), the
// chunk's lowest y (u16, + 64) and its own palette (u8 count, u16 each), then each column's blocks as runs up it (u8 column,
// u8 runs, then u8 y over the lowest, u8 length, u8 kind a run)
const C0 = GIVEN.CHUNK, GROWN_BY = {}, BEAST_TYPES = [], BEASTS = [], BEAST_BY = {}; let grownCols = 0, grownBlocks = 0, grownLost = 0; const lostBy = {};
{
  const cols = new Map();   // "x,z" -> Map(y -> palette)
  for (const g of GROWN) {
    const pals = g.ids.map(([id, st]) => pal(rename(id), st ?? null));
    // the grown towns' doors carved too: each door's top block, the wall over it and that wall's blocks either side become the people's carving
    const carving = PEOPLE_CARVINGS[g.t] ? pal(`waterworld:${g.t}_carving`, null) : null, carve = new Map();
    if (carving != null) { const at = new Map(g.cols.map((c) => [`${c[0]},${c[1]}`, c])), idAt = (x, y, z) => { const c = at.get(`${x},${z}`); if (!c) return null; for (let i = 2; i < c.length; i += 2) if (c[i] === y) return g.ids[c[i + 1]][0]; return null; };
      const solid = (x, y, z) => { const id = idAt(x, y, z); return id && !/air|glass|pane|door|stairs|slab|trapdoor|lantern|torch/.test(id); }, mark = (x, y, z) => { let s = carve.get(`${x},${z}`); if (!s) carve.set(`${x},${z}`, (s = new Set())); s.add(y); };
      for (const [x, z, ...row] of g.cols) for (let i = 0; i < row.length; i += 2) { const y = row[i]; if (!/_door$/.test(g.ids[row[i + 1]][0]) || /_door$/.test(idAt(x, y + 1, z) ?? "") || !solid(x, y + 1, z)) continue;
        mark(x, y + 1, z); lintels++; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (solid(x + dx, y + 1, z + dz) && solid(x + dx, y, z + dz)) mark(x + dx, y + 1, z + dz); } }
    for (const [x, z, ...row] of g.cols) { const k = colKey(x, z); if (taken.has(k)) { grownLost++; lostBy[g.key] = (lostBy[g.key] ?? 0) + 1; continue; } let m = cols.get(k); if (!m) cols.set(k, (m = new Map())); const cv = carve.get(`${x},${z}`); for (let i = 0; i < row.length; i += 2) m.set(row[i], cv?.has(row[i]) ? carving : pals[row[i + 1]]); }
    for (const [type, x, y, z] of g.beasts) { let ti = BEAST_TYPES.indexOf(type); if (ti < 0) { ti = BEAST_TYPES.length; BEAST_TYPES.push(type); } const ck = `${Math.floor(x / C0)},${Math.floor(z / C0)}`; (BEAST_BY[ck] ??= []).push(BEASTS.length); BEASTS.push([ti, x, y, z]); }
  }
  for (const k of cols.keys()) taken.add(k);   // the older towns keep off the grown ones' ground
  const byChunkCols = new Map(); for (const [k, m] of cols) { const [x, z] = k.split(",").map(Number), ck = `${Math.floor(x / C0)},${Math.floor(z / C0)}`; let a = byChunkCols.get(ck); if (!a) byChunkCols.set(ck, (a = [])); a.push([x, z, m]); }
  const REACH = FIB[4] - 2;   // derived: a tree's crown reaches three from its trunk (game/ground.js treeAt)
  for (const [ck, list] of byChunkCols) {
    const [cx, cz] = ck.split(",").map(Number), x0 = cx * C0, z0 = cz * C0, mask = new Uint8Array(C0 * C0 / 8), bytes = [];
    for (let i = 0; i < C0; i++) for (let j = 0; j < C0; j++) { let near = false; for (let a = -REACH; a <= REACH && !near; a++) for (let b = -REACH; b <= REACH && !near; b++) if (cols.has(colKey(x0 + i + a, z0 + j + b))) near = true; if (near) mask[(j * C0 + i) >> 3] |= 1 << ((j * C0 + i) & 7); }
    bytes.push(...mask);
    let yb = Infinity, yt = -Infinity; const lp = new Map(); for (const [, , m] of list) for (const [y, pi] of m) { yb = Math.min(yb, y); yt = Math.max(yt, y); if (!lp.has(pi)) lp.set(pi, lp.size); }
    if (yt - yb > 255 || lp.size > 255) throw new Error(`grown chunk ${ck}: ${yt - yb} high, ${lp.size} kinds (a byte each)`);   // given: a byte
    bytes.push((yb + 64) & 255, (yb + 64) >> 8, lp.size); for (const pi of lp.keys()) bytes.push(pi & 255, pi >> 8);   // given: the world's floor at -64
    list.sort((a, b) => (a[1] - z0) * C0 + (a[0] - x0) - ((b[1] - z0) * C0 + (b[0] - x0)));
    for (const [x, z, m] of list) {
      const ys = [...m.keys()].sort((a, b) => a - b), runs = [];
      for (const y of ys) { const r = runs.at(-1); if (r && r[0] + r[1] === y && r[2] === m.get(y) && r[1] < 255) r[1]++; else runs.push([y, 1, m.get(y)]); }   // given: a byte's longest run
      for (let q = 0; q < runs.length; q += 255) { const part = runs.slice(q, q + 255); bytes.push((z - z0) * C0 + (x - x0), part.length); for (const [y, n, pi] of part) bytes.push(y - yb, n, lp.get(pi)); }
      grownCols++; grownBlocks += ys.length;
    }
    GROWN_BY[ck] = B64(Uint8Array.from(bytes));
  }
}
say(`grown settlements: ${GROWN.length} (${GROWN.reduce((a, g) => a + g.folk, 0)} folk, ${GROWN.reduce((a, g) => a + g.buildings, 0)} buildings, ${GROWN.reduce((a, g) => a + g.farms, 0)} farms): ${grownBlocks} blocks in ${grownCols} columns over ${Object.keys(GROWN_BY).length} chunks, ${BEASTS.length} beasts${grownLost ? `; ${grownLost} columns under Thera's own structures left (${Object.entries(lostBy).map(([k, n]) => `${k} ${n} of ${GROWN.find((g) => g.key === k).cols.length}`).join(", ")})` : ""}`);
let townHouses = 0, townBeds = 0, towns = 0, townWalls = 0;
Lw.forEach((p, i) => {
  if (grownMembers.has(p.key)) return;   // grown (below)
  const v = Pw.get(p.key), T = townOf(p, Rw.state[i].site, v.pop, v.tier); if (!T.households) return; towns++;
  const t = p.tradition, X0 = T.x, Z0 = T.z, surf = surfaceOf(p, v.tier), dyeName = dyesOf(t)[0];
  for (const st of T.streets) paintLine(X0 + st.x0, Z0 + st.z0, X0 + st.x1, Z0 + st.z1, st.w, surf);
  for (const b of T.boxes) {
    const cx = X0 + Math.round(b.x + b.w / 2), cz = Z0 + Math.round(b.z + b.l / 2);
    if (b.kind === "plaza" || b.kind === "district plaza") paintRect(X0 + Math.round(b.x), Z0 + Math.round(b.z), Math.round(b.w), Math.round(b.l), surf);
    else if (b.kind === "hall") { const h = hallOf(p, t); place(proto(`hall ${t}`, h.vox, 0), cx, cz, { pad: 1 }); }
    else if (b.kind === "market") { paintRect(X0 + Math.round(b.x), Z0 + Math.round(b.z), Math.round(b.w), Math.round(b.l), surf); place(proto(`market ${dyeName}`, MARKET(dyeName)), cx, cz); }
    else if (b.kind === "temple") place(proto("shrine", SHRINE), cx, cz, { foundation: "minecraft:prismarine_bricks", pad: 1 });
    else if (b.kind === "pier") place(proto("pier", PIER), cx, cz, { water: true, anyWater: true, floorAt: G.SEA + 1, stilts: true });
    else if (b.kind === "quarter") {
      for (const part of [...b.parts].sort((a, c) => (a.kind === "house") - (c.kind === "house"))) {
        const X = X0 + Math.round(part.x + part.w / 2), Z = Z0 + Math.round(part.z + part.l / 2);
        if (part.kind === "plaza" || part.kind === "street") paintRect(X0 + Math.round(part.x), Z0 + Math.round(part.z), Math.round(part.w), Math.round(part.l), surf);
        else if (part.kind === "well") place(proto("well", WELL), X, Z);
        else if (part.kind === "bell") place(proto("bell", BELL), X, Z);
        else if (part.kind === "shrine") place(proto("shrine", SHRINE), X, Z, { foundation: "minecraft:prismarine_bricks" });
        else if (part.kind === "house") {
          const hb = plainOf(t === "therans" ? theran : p, t, b.storeys ?? 1), [fx0, fx1, fz0, fz1] = footOf(hb.vox), pw = fx1 - fx0 + 1, pl = fz1 - fz0 + 1, bw = Math.round(part.w), bl = Math.round(part.l);
          const face = [Math.cos(part.face ?? 0), Math.sin(part.face ?? 0)], dc = [hb.door.x - (fx0 + fx1) / 2, hb.door.z - (fz0 + fz1) / 2];   // town boxes are in world axes (z south)
          const opts = [0, 1, 2, 3].map((r) => { let [dx, dz] = dc; for (let k = 0; k < r; k++) [dx, dz] = [-dz, dx]; const [w, l] = r % 2 ? [pl, pw] : [pw, pl]; return { r, over: Math.max(0, w - bw) + Math.max(0, l - bl), align: (dx * face[0] + dz * face[1]) / (Math.hypot(dx, dz) || 1) }; }).sort((a, c) => a.over - c.over || c.align - a.align);
          const water = !!LAYOUT_WATER[t];
          for (const o of opts.slice(0, 2)) if (place(proto(`town ${t} ${b.storeys ?? 1}`, hb.vox, o.r), X, Z, { pad: 0, water, stilts: water, floorAt: water ? G.SEA + 1 : null })) { townHouses++; townBeds += hb.beds; settle(placements[placements.length - 1], hb, t, "town", o.r, SHOWN_TOWN); break; }
        }
      }
    }
  }
  if (T.wall) {   // the wall: its shape round the town (the game finds its blocks), a gate on each main street's bearing
    const isPal = T.wall.kind === "palisade", id = isPal ? (p.woods?.[0] ?? "minecraft:oak_log") : "minecraft:stone_bricks", h = isPal ? FIB[3] : FIB[4] - 1;   // derived: a palisade three high, a wall four
    const gates = (T.wall.gates ?? []).flatMap((g) => [Math.round(g.a * 1000) / 1000, g.w]), pid = pal(id, id.endsWith("_log") ? { pillar_axis: "y" } : null);
    if (T.wall.shape === "circle") { const R = T.wall.r; walls.push({ d: ["c", pid, h, X0, Z0, R, gates], b: [X0 - R - 1, Z0 - R - 1, X0 + R + 1, Z0 + R + 1] }); }
    else { const pts = T.wall.points.flatMap(([x, z]) => [X0 + x, Z0 + z]); let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity; for (let k = 0; k < pts.length; k += 2) { bx0 = Math.min(bx0, pts[k]); bx1 = Math.max(bx1, pts[k]); bz0 = Math.min(bz0, pts[k + 1]); bz1 = Math.max(bz1, pts[k + 1]); } walls.push({ d: ["p", pid, h, X0, Z0, pts, gates], b: [bx0 - 1, bz0 - 1, bx1 + 1, bz1 + 1] }); }
    townWalls++;
  }
});
say(`the world's towns: ${towns} towns, ${townHouses} houses, ${townBeds} beds, ${townWalls} walls, ${paints.length} paved ways`);

// the League's sea wardens: at the Exchange, the quays and the harbour master's island (world/sealife.js's wardens, the tax's keepers)
{
  const posts = []; for (let j = 0; j < N; j += 4) for (let i = 0; i < N; i += 4) if ([G.KIND["the Exchange"], G.KIND.quay, G.KIND["harbour master's island"]].includes(grid[j * N + i])) posts.push([i, j]);
  const W = FIB[6]; for (let k = 0; k < W && posts.length; k++) { const [i, j] = posts[Math.floor(golden(k) * posts.length)], x = SX + (i - N / 2) * G.CELL + 1, z = SZ + (j - N / 2) * G.CELL + 1; residents.push([x, G.topAt(x, z) + 1, z, wardenIndex(k), -1, folkN++]); }   // derived: thirteen wardens
}
const folkByChunk = {}; residents.forEach((f, k) => (folkByChunk[`${Math.floor(f[0] / 16)},${Math.floor(f[2] / 16)}`] ??= []).push(k));
say(`folk: ${residents.length} stand in the world (one in ${SHOWN} of Thera's people, one in ${SHOWN_TOWN} of a town's), ${SKINS} skins`);
// the chunk index: every placement in each chunk it touches
const C = GIVEN.CHUNK, byChunk = {};
const PAINT_BY = {}, WALL_BY = {}; const idx = (list, by) => list.forEach((pl, k) => { for (let cx = Math.floor(pl.b[0] / C); cx <= Math.floor(pl.b[2] / C); cx++) for (let cz = Math.floor(pl.b[1] / C); cz <= Math.floor(pl.b[3] / C); cz++) (by[`${cx},${cz}`] ??= []).push(k); }); idx(paints, PAINT_BY);
walls.forEach((w, k) => { const d = w.d, seen = new Set(), mark = (x, z) => { const key = `${Math.floor(x / C)},${Math.floor(z / C)}`; if (!seen.has(key)) { seen.add(key); (WALL_BY[key] ??= []).push(k); } };   // only the chunks the wall's line crosses
  if (d[0] === "c") { const [, , , cx, cz, R] = d, n = Math.ceil(2 * Math.PI * R); for (let q = 0; q < n; q++) { const a = (2 * Math.PI * q) / n; for (const dr of [-1, 0, 1]) mark(cx + (R + dr) * Math.cos(a), cz + (R + dr) * Math.sin(a)); } }
  else { const P = d[5]; for (let i = 0; i < P.length; i += 2) { const ax = P[i], az = P[i + 1], bx = P[(i + 2) % P.length], bz = P[(i + 3) % P.length], n = Math.ceil(Math.hypot(bx - ax, bz - az)); for (let q = 0; q <= n; q++) for (const [ox, oz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) mark(ax + ((bx - ax) * q) / n + ox, az + ((bz - az) * q) / n + oz); } } });
placements.forEach((pl, k) => { for (let cx = Math.floor(pl.b[0] / C); cx <= Math.floor(pl.b[2] / C); cx++) for (let cz = Math.floor(pl.b[1] / C); cz <= Math.floor(pl.b[3] / C); cz++) (byChunk[`${cx},${cz}`] ??= []).push(k); });

// the places to go: the temple's floor beside the pool, the cold house's door, the city's landmarks
const floorSpot = (pl, P) => {   // the floor block nearest the footprint's middle with two blocks of air over it
  const solid = new Map(); for (let k = 0; k < P.flat.length; k += 4) solid.set(`${P.flat[k]},${P.flat[k + 1]},${P.flat[k + 2]}`, palette[P.flat[k + 3]][0]);
  const mx = (P.b[0] + P.b[1]) / 2, mz = (P.b[4] + P.b[5]) / 2; let best = null;
  for (let k = 0; k < P.flat.length; k += 4) {
    const [x, y, z] = [P.flat[k], P.flat[k + 1], P.flat[k + 2]], id = palette[P.flat[k + 3]][0];
    if (y !== 0 || /water|air|lantern|conduit/.test(id) || solid.has(`${x},1,${z}`) || solid.has(`${x},2,${z}`)) continue;
    const d = Math.hypot(x - mx, z - mz); if (!best || d < best.d) best = { d, x, z };
  }
  return best ? { x: pl.x + best.x + 0.5, y: pl.y + 1, z: pl.z + best.z + 0.5 } : { x: pl.x + mx, y: pl.y + 6, z: pl.z + mz };
};
const PLACES = {};
const tpl = placements.find((p) => p.tag === "temple"), cpl = placements.find((p) => p.tag === "cold house");
if (tpl) PLACES.temple = floorSpot(tpl, TP);
if (cpl) PLACES.coldhouse = { x: cpl.x + cold.door.x + 0.5, y: cpl.y + cold.door.y, z: cpl.z + cold.door.z + 0.5 };
const nearestKind = (kind) => { let best = null; for (let j = 0; j < N; j += 2) for (let i = 0; i < N; i += 2) if (grid[j * N + i] === G.KIND[kind]) { const u = (i - N / 2) * G.CELL, v = (j - N / 2) * G.CELL, d = Math.hypot(u - D0.x * K, v + D0.y * K); if (!best || d < best.d) best = { d, u, v }; } return best ? { x: SX + best.u + 1, y: G.topAt(SX + best.u + 1, SZ + best.v + 1) + 1, z: SZ + best.v + 1 } : null; };
for (const [name, kind] of [["exchange", "the Exchange"], ["library", "the Library"], ["acropolis", "acropolis"], ["light", "the Light"], ["harbour", "harbour master's island"]]) { const p = nearestKind(kind); if (p) PLACES[name] = p; }
PLACES.spawn = PLACES.temple ?? { x: SX, y: G.topAt(SX, SZ) + 1, z: SZ };
// the structures baked whole (.mcstructure, little-endian NBT): each prototype placeable by the game in one call
// (world.structureManager.place "ww:p<i>"), the drawing's cheapest op (world/render.js)
if (process.env.WW_MCSTRUCTURE) { const { writeStructure, blockVersion } = await import("./mcstructure.js");   // only on request (WW_MCSTRUCTURE=1): thousands of files, hundreds of MB the server loads, and the layer lays block by block anyway const SD = path.join(BP, "structures", "ww"); fs.mkdirSync(SD, { recursive: true }); let bytes = 0;
  for (const P of protos) { const vox = new Map(); for (let i = 0; i < P.flat.length; i += 4) { const e = palette[P.flat[i + 3]]; vox.set(`${P.flat[i]},${P.flat[i + 1]},${P.flat[i + 2]}`, { id: e[0], s: e[1] ?? null }); } const r = writeStructure(vox, { version: blockVersion([1, 21, 90]) }); fs.writeFileSync(path.join(SD, `p${P.i}.mcstructure`), r.buf); bytes += r.buf.length; P.origin = r.origin; }
  say(`structures: ${protos.length} prototypes as .mcstructure (${(bytes / 1e6).toFixed(1)} MB), placeable whole`); }
// only the unturned prototypes are written: a placement of a turned one names its base and its turn (flags bits 3-4),
// and ROT maps each palette entry to its turned entry (a turn's block states), so the game turns them as it lays
const bases = protos.filter((P) => !P.r), newIdx = new Map(bases.map((P, k) => [P.i, k]));
const palN = palette.length, ROT = [1, 2, 3].map((r) => palette.slice(0, palN).map(([id, st]) => pal(id, turnStates(st ?? null, r))));
for (const pl of placements) { const P = protos[pl.p]; pl.turn = P.r ?? 0; pl.p = newIdx.get(P.r ? P.base : P.i); }
fs.writeFileSync(path.join(S, "data/structures.js"), `// baked by tools/buildmod.mjs: Thera's structures. palette [id, states?]; protos: f, base64 of an Int16Array [x, y, z, palette index, ...] (decoded when first laid: lay.js flatOf), and bounds;\n// placements: [proto, x, y, z (origin), foundation (palette), flags (1 stilts, 2 carved, 4 free: a skyway, bits 3-4 the quarter turns of its proto), x0, z0, x1, z1]; byChunk "cx,cz" -> placement indices\nexport const PALETTE = ${JSON.stringify(palette)};\nexport const ROT = ${JSON.stringify(ROT)};\nexport const PROTOS = ${JSON.stringify(bases.map((P) => ({ name: P.name, f: B64(new Uint8Array(Int16Array.from(P.flat).buffer)), b: P.b, o: P.origin })))};\nexport const PLACEMENTS = ${JSON.stringify(placements.map(({ p, x, y, z, f, stilts, carve, free, turn, b }) => [p, x, y, z, f, (stilts ? 1 : 0) | (carve ? 2 : 0) | (free ? 4 : 0) | ((turn ?? 0) << 3), ...b]))};\nexport const BY_CHUNK = ${JSON.stringify(byChunk)};\nexport const HORAIA = ${JSON.stringify(HORAIA_AT)};\nexport const POOLDRESS = ${JSON.stringify(POOLDRESS)};\nexport const POOLFISH = ${JSON.stringify(POOLFISH)};\nexport const PARK = ${JSON.stringify(PARK)};\nexport const COURSES = ${JSON.stringify(COURSES)};\nexport const PAINTS = ${JSON.stringify(paints.map((q) => q.d))};\nexport const PAINT_BY = ${JSON.stringify(PAINT_BY)};\nexport const WALLS = ${JSON.stringify(walls.map((w) => w.d))};\nexport const WALL_BY = ${JSON.stringify(WALL_BY)};\nexport const PLACES = ${JSON.stringify(PLACES)};\n`);
fs.writeFileSync(path.join(S, "data/grown.js"), `// baked by tools/buildmod.mjs from tools/bakegrown.mjs's settlements: per chunk "cx,cz" a base64 of a 32-byte no-tree mask, the lowest y\n// (u16, + 64), the chunk's kinds (u8 n, u16 index in data/structures.js PALETTE each), then columns (u8 j*16+i, u8 runs, each u8 y over the lowest,\n// u8 length, u8 kind); beasts [type, x, y, z]\nexport const GROWN_BY = ${JSON.stringify(GROWN_BY)};\nexport const BEAST_TYPES = ${JSON.stringify(BEAST_TYPES)};\nexport const BEASTS = ${JSON.stringify(BEASTS)};\nexport const BEAST_BY = ${JSON.stringify(BEAST_BY)};\n`);
fs.writeFileSync(path.join(S, "data/folk.js"), `// baked by tools/buildmod.mjs: Thera's folk [x, y, z, skin, people (index in CULTURES, -1 the League), n]\nexport const CULTURES = ${JSON.stringify(CULTURES)};\nexport const RESIDENTS = ${JSON.stringify(residents)};\nexport const FOLK_BY_CHUNK = ${JSON.stringify(folkByChunk)};\nexport const NAMES = ${JSON.stringify(NAMES)};\nexport const SKINS = ${SKINS};\nexport const RANKS = ${JSON.stringify(RANKS)};\n`);
fs.writeFileSync(path.join(S, "data/faith.js"), `// baked by tools/buildmod.mjs from world/faith.js\nexport const FAITH = ${JSON.stringify({ name: FAITH.name, tenets: FAITH.tenets, calendar: FAITH.calendar })};\nexport const WAYS = ${JSON.stringify(WAYS)};\nexport const DRESS = ${JSON.stringify(Object.fromEntries(Object.entries(DRESS).map(([k, v]) => [k, v.note])))};\n`);
if (dropped.size) say(`states dropped (the block hasn't them): ${[...dropped].join(", ")}`);
if (unvanilla.size) throw new Error(`neither vanilla nor the pack's own: ${[...unvanilla].join(", ")}`);
say(`structures: ${protos.length} prototypes, ${palette.length} block kinds, ${placements.length} placements in ${Object.keys(byChunk).length} chunks; places: ${Object.keys(PLACES).join(", ")}`);

say(`roof gardens: ${roofBeds} beds on the big flat roofs; the peoples' carvings over ${lintels} doors`);
// ---- 5. the game's own scripts and the manifests
fs.cpSync(path.join(ROOT, "mod/scripts"), S, { recursive: true });
const uuid = (n) => { const h = (s) => [...s].reduce((a, c) => (Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261 ^ n).toString(16).padStart(8, "0"); const a = h("waterworld" + n) + h("shipwright" + n) + h("thera" + n) + h("breath" + n); return `${a.slice(0, 8)}-${a.slice(8, 12)}-4${a.slice(13, 16)}-8${a.slice(17, 20)}-${a.slice(20, 32)}`; };   // stable ids, made once from the names
const bpId = uuid(1), rpId = uuid(3);
fs.writeFileSync(path.join(BP, "manifest.json"), JSON.stringify({
  format_version: 2,
  header: { name: "Waterworld BP", description: "The golden-law waterworld: Thera, its city and the sea round it (Shipwright)", uuid: bpId, version: VERSION, min_engine_version: [1, 21, 90] },
  modules: [{ type: "data", uuid: uuid(2), version: VERSION }, { type: "script", language: "javascript", uuid: uuid(5), version: VERSION, entry: "scripts/main.js" }],
  dependencies: [{ uuid: rpId, version: VERSION }, { module_name: "@minecraft/server", version: "2.8.0" }, { module_name: "@minecraft/server-ui", version: "2.0.0" }],
}, null, 2));
fs.writeFileSync(path.join(RP, "manifest.json"), JSON.stringify({
  format_version: 2,
  header: { name: "Waterworld RP", description: "The waterworld's textures", uuid: rpId, version: VERSION, min_engine_version: [1, 21, 90] },
  modules: [{ type: "resources", uuid: uuid(4), version: VERSION }],
  dependencies: [{ uuid: bpId, version: VERSION }],
}, null, 2));
// the resource pack: the base textures under vanilla's names (the _vN variants and their tables wait for the variation pass)
const TX0 = path.join(ROOT, "pack/RP/textures/blocks"), TX1 = path.join(RP, "textures/blocks"); fs.mkdirSync(TX1, { recursive: true });
let nt = 0; const copyTx = (d) => { for (const f of fs.readdirSync(path.join(TX0, d), { withFileTypes: true })) { const r = path.join(d, f.name);
  if (f.isDirectory()) { fs.mkdirSync(path.join(TX1, r), { recursive: true }); copyTx(r); } else if (f.name.endsWith(".png")) { fs.copyFileSync(path.join(TX0, r), path.join(TX1, r)); nt++; } } };
copyTx("");   // every tile and every variant of it, the new-named ones in their own folder
// the pack's own blocks (world/carvings.js): their tiles lit by the pack's one light, their shapes' geometry, their
// definitions, and the terrain atlas's names for their textures
{ const { relief } = await import("../world/textures.js"), { encode } = await import("./png.js"), TD = path.join(RP, "textures/blocks/waterworld"); fs.mkdirSync(TD, { recursive: true });
  const tile = (f, fam, k = 0, face = "ns") => { const px = []; for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) px.push(paintVariant(k, f, u, v, face)); return encode(16, 16, relief(px, fam), 3); };   // given: a tile's sixteen pixels
  const atlas = {}, put = (rel, o) => { const f = path.join(rel.startsWith("BP") ? BP : RP, rel.slice(3)); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
  const glassTile = (f) => { const px = new Uint8Array(16 * 16 * 4); for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) px.set(f(u, v).map(Math.round), (v * 16 + u) * 4); return encode(16, 16, px, 4); };   // given: a tile's sixteen pixels, four channels
  for (const b of CUSTOM) { const n = b.id.split(":")[1];
    if (b.glass) { fs.writeFileSync(path.join(TD, `${n}.png`), glassTile(b.rgba)); atlas[`ww_${n}`] = { textures: `textures/blocks/waterworld/${n}` };
      put(`BP/blocks/${n}.json`, { format_version: "1.21.80", "minecraft:block": { description: { identifier: b.id, menu_category: { category: "construction" } }, components: { "minecraft:geometry": "minecraft:geometry.full_block", "minecraft:material_instances": { "*": { texture: `ww_${n}`, render_method: "blend" } }, "minecraft:light_dampening": 0, "minecraft:destructible_by_mining": { seconds_to_destroy: 0.3 }, "minecraft:map_color": "#2c56b2" } } }); continue; }   // vision: glass breaks at a touch
    const vary = (stem, f, face) => { const vs = []; for (let k = 0; k < OWN_VARIANTS; k++) { const nm = k ? `${stem}_v${k}` : stem; fs.writeFileSync(path.join(TD, `${nm}.png`), tile(f, b.family, k, face)); vs.push({ path: `textures/blocks/waterworld/${nm}`, weight: 1 }); } return { textures: { variations: vs } }; };   // each texture in five, the veins shifted in each; the game picks one a block
    for (const face of FACES) atlas[`ww_${n}_${face}`] = vary(`${n}_${face}`, face === "end" ? b.end : b.side, face);   // each face its own slice of the stone (north-south, east-west, the ends)
    const full = b.shape === "full", T = (f) => ({ texture: `ww_${n}_${f}`, render_method: "opaque" });
    const mi = full ? { "*": T("ns"), east: T("ew"), west: T("ew"), up: T("end"), down: T("end") } : { "*": T("ns"), ew: T("ew"), end: T("end") };   // by the face's orientation
    put(`BP/blocks/${n}.json`, { format_version: "1.21.110", "minecraft:block": { description: { identifier: b.id, menu_category: { category: "construction" } }, components: { ...(b.components ?? {}),
      "minecraft:geometry": full ? "minecraft:geometry.full_block" : `geometry.waterworld.${b.shape}`, "minecraft:material_instances": mi,
      "minecraft:destructible_by_mining": { seconds_to_destroy: 1.5 }, "minecraft:destructible_by_explosion": { explosion_resistance: 6 }, "minecraft:map_color": "#" + b.colour.map((c) => Math.round(c).toString(16).padStart(2, "0")).join(""), ...(full ? {} : { "minecraft:light_dampening": 0 }) } } }); }   // vision: as hard as stone to mine
  // the shapes: each box's faces mapped onto the matching window of the block's tile; up and down take the end
  for (const [shape, boxes] of Object.entries(SHAPES)) { if (!boxes) continue;
    const cubes = boxes.map(([x0, y0, z0, x1, y1, z1]) => { const w = x1 - x0, h = y1 - y0, d = z1 - z0, side = (a) => ({ uv: [a, 16 - y1], uv_size: [Math.max(w, d), h] });
      return { origin: [x0 - 8, y0, z0 - 8], size: [w, h, d], uv: { north: { uv: [16 - x1, 16 - y1], uv_size: [w, h] }, south: { uv: [x0, 16 - y1], uv_size: [w, h] }, east: { uv: [16 - z1, 16 - y1], uv_size: [d, h], material_instance: "ew" }, west: { uv: [z0, 16 - y1], uv_size: [d, h], material_instance: "ew" }, up: { uv: [x0, z0], uv_size: [w, d], material_instance: "end" }, down: { uv: [x0, z0], uv_size: [w, d], material_instance: "end" } } }; });   // given: a block's sixteen pixels, its middle at (8, 8)
    put(`RP/models/blocks/${shape}.geo.json`, { format_version: "1.12.0", "minecraft:geometry": [{ description: { identifier: `geometry.waterworld.${shape}`, texture_width: 16, texture_height: 16, visible_bounds_width: 2, visible_bounds_height: 2, visible_bounds_offset: [0, 0.5, 0] }, bones: [{ name: "block", pivot: [0, 0, 0], cubes }] }] }); }   // given: a block's tile and its bounds (two blocks round its middle)
  // vanilla's own names, each turned to the variations of the texture it draws (one picked a block, so no wall repeats)
  { const VAR = JSON.parse(fs.readFileSync(path.join(ROOT, "pack/RP/textures/variations.json"), "utf8")), { VANILLA_KEYS } = await import("./vanillaatlas.mjs"); let nk = 0;
    for (const [stem, keys] of Object.entries(VANILLA_KEYS)) { const vs = VAR[stem]; if (!vs) throw new Error(`no variants for ${stem}`);
      for (const { path: p } of vs) if (!fs.existsSync(path.join(RP, p + ".png"))) throw new Error(`missing ${p}.png`);
      for (const k of keys) { if (atlas[k]) throw new Error(`atlas key ${k} twice`); atlas[k] = { textures: { variations: vs } }; nk++; } }
    say(`vanilla's names given variations: ${nk}, from ${Object.keys(VANILLA_KEYS).length} textures`); }
  put("RP/textures/terrain_texture.json", { resource_pack_name: "waterworld", texture_name: "atlas.terrain", padding: 8, num_mip_levels: 4, texture_data: atlas });   // given: vanilla's atlas settings
  say(`the pack's own blocks: ${CUSTOM.length} (marbles, their columns' bases, shafts and capitals, the faith's carvings), ${Object.values(SHAPES).filter(Boolean).length} shapes`); }
// the leaves, coloured each by its kind: the game tints every leaf by the one biome our dimension has (plains), so a grey
// leaf comes out the same green whatever its tree. Each is drawn here as the colour its tree's own biome would give it,
// over the plains tint: spruce dark and blue, birch pale, jungle saturated, acacia olive, dark oak deep
{ const { decode: dec, encode: enc } = await import("./png.js"), TINT = [0x77, 0xab, 0x2f];   // given: vanilla's plains foliage, the tint our dimension's leaves get
  const WANT = { leaves_oak: [0x77, 0xab, 0x2f], leaves_birch: [0x80, 0xa7, 0x55], leaves_spruce: [0x61, 0x99, 0x61], leaves_jungle: [0x30, 0xbb, 0x0b], leaves_acacia: [0xae, 0xa4, 0x2a], leaves_big_oak: [0x3f, 0x8a, 0x22] };   // vision: each tree's leaf colour (vanilla's own biome foliage for its tree)
  for (const [f, want] of Object.entries(WANT)) { const src = path.join(TX0, `${f}.png`); if (!fs.existsSync(src)) continue; const im = dec(fs.readFileSync(src)), ch = im.channels, px = im.data, k = want.map((v, i) => v / TINT[i]);
    for (let p = 0; p < im.w * im.h; p++) for (let c = 0; c < 3; c++) px[p * ch + c] = Math.min(255, Math.round(px[p * ch + c] * k[c]));
    fs.writeFileSync(path.join(TX1, `${f}.png`), enc(im.w, im.h, px, ch)); }
  say("leaves coloured by their trees (over the dimension's one tint)"); }
// the folk: an entity of our own (the villager's shape, our own geometry and skins: world/dress.js)
{
  const { allSkins } = await import("./folkskins.mjs"), { encode } = await import("./png.js");
  const skins = allSkins(), TD = path.join(RP, "textures/entity/waterworld/folk"); fs.mkdirSync(TD, { recursive: true });
  skins.forEach((sk, i) => fs.writeFileSync(path.join(TD, `${i}.png`), encode(64, 64, sk.px, 4)));
  const w = (rel, o) => { const f = path.join(rel.startsWith("BP") ? BP : RP, rel.slice(3)); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
  const cube = (origin, size, uv, extra = {}) => ({ origin, size, uv, ...extra });
  w("RP/models/entity/folk.geo.json", { format_version: "1.12.0", "minecraft:geometry": [{
    description: { identifier: "geometry.waterworld.folk", texture_width: 64, texture_height: 64, visible_bounds_width: 2, visible_bounds_height: 3, visible_bounds_offset: [0, 1.25, 0] },
    bones: [
      { name: "root", pivot: [0, 0, 0] },
      { name: "body", parent: "root", pivot: [0, 24, 0], cubes: [cube([-4, 12, -3], [8, 12, 6], [16, 20]), cube([-4, 2, -3], [8, 20, 6], [0, 38], { inflate: 0.5 })] },
      { name: "head", parent: "body", pivot: [0, 24, 0], cubes: [cube([-4, 24, -4], [8, 10, 8], [0, 0]), cube([-4, 24, -4], [8, 10, 8], [32, 0], { inflate: 0.5 })] },
      { name: "nose", parent: "head", pivot: [0, 26, 0], cubes: [cube([-1, 23, -6], [2, 4, 2], [28, 46])] },
      { name: "arms", parent: "body", pivot: [0, 22, 0], cubes: [cube([-4, 16, -2], [8, 4, 4], [40, 38]), cube([-8, 16, -2], [4, 8, 4], [44, 22]), cube([4, 16, -2], [4, 8, 4], [44, 22], { mirror: true })] },   // given: vanilla villager_v2's arms (Mojang/bedrock-samples), folded by the pose below
      { name: "leg0", parent: "root", pivot: [-2, 12, 0], cubes: [cube([-4, 0, -2], [4, 12, 4], [0, 22])] },
      { name: "leg1", parent: "root", pivot: [2, 12, 0], mirror: true, cubes: [cube([0, 0, -2], [4, 12, 4], [0, 22])] },
    ] }] });
  w("RP/animations/folk.animation.json", { format_version: "1.8.0", animations: {
    "animation.waterworld.folk.move": { loop: true, bones: { leg0: { rotation: ["math.cos(query.modified_distance_moved * 38.17) * 40.0", 0, 0] }, leg1: { rotation: ["math.cos(query.modified_distance_moved * 38.17 + 180) * 40.0", 0, 0] } } },
    "animation.waterworld.folk.general": { loop: true, bones: { arms: { position: [0, -1, -1], rotation: [-42.97, 0, 0] } } },   // given: vanilla's animation.villager.general (the folded arms)
    "animation.waterworld.folk.look_at": { loop: true, bones: { head: { rotation: ["query.target_x_rotation", "query.target_y_rotation", 0] } } },
  } });
  w("RP/render_controllers/folk.render_controllers.json", { format_version: "1.8.0", render_controllers: { "controller.render.waterworld.folk": {
    arrays: { textures: { "Array.skins": skins.map((_, i) => `Texture.s${i}`) } }, geometry: "Geometry.default", materials: [{ "*": "Material.default" }], textures: ["Array.skins[query.property('waterworld:skin')]"] } } });
  w("RP/entity/folk.entity.json", { format_version: "1.10.0", "minecraft:client_entity": { description: {
    identifier: "waterworld:folk", materials: { default: "entity_alphatest" }, textures: Object.fromEntries(skins.map((_, i) => [`s${i}`, `textures/entity/waterworld/folk/${i}`])),
    geometry: { default: "geometry.waterworld.folk" }, animations: { general: "animation.waterworld.folk.general", move: "animation.waterworld.folk.move", look_at: "animation.waterworld.folk.look_at" },
    scripts: { animate: ["general", "move", "look_at"] }, render_controllers: ["controller.render.waterworld.folk"], spawn_egg: { base_color: "#3a6ea5", overlay_color: "#e0b040" } } } });
  w("RP/texts/en_US.lang", null); fs.writeFileSync(path.join(RP, "texts/languages.json"), JSON.stringify(["en_US"]));
  fs.writeFileSync(path.join(RP, "texts/en_US.lang"), "entity.waterworld:folk.name=Folk\nitem.spawn_egg.entity.waterworld:folk.name=Spawn Folk\n");
  w("BP/entities/folk.json", { format_version: "1.21.0", "minecraft:entity": {
    description: { identifier: "waterworld:folk", is_spawnable: true, is_summonable: true, properties: { "waterworld:skin": { type: "int", range: [0, SKINS - 1], default: 0, client_sync: true } } },
    components: {
      "minecraft:type_family": { family: ["folk", "npc", "mob"] }, "minecraft:health": { value: 20, max: 20 }, "minecraft:collision_box": { width: 0.6, height: 1.9 },
      "minecraft:damage_sensor": { triggers: { cause: "all", deals_damage: "no" } }, "minecraft:persistent": {}, "minecraft:nameable": { always_show: false, allow_name_tag_renaming: true },
      "minecraft:physics": {}, "minecraft:pushable": { is_pushable: true, is_pushable_by_piston: true }, "minecraft:movement": { value: 0.5 }, "minecraft:movement.basic": {}, "minecraft:jump.static": {},
      "minecraft:navigation.walk": { can_path_over_water: false, avoid_water: true, can_open_doors: true, can_pass_doors: true, can_walk: true },
      "minecraft:behavior.float": { priority: 0 }, "minecraft:behavior.open_door": { priority: 6, close_door_after: true },
      "minecraft:behavior.random_stroll": { priority: 8, speed_multiplier: 0.5, xz_dist: 5, y_dist: 2 },   // vision: they keep near home
      "minecraft:behavior.look_at_player": { priority: 7, look_distance: 6, probability: 0.02 }, "minecraft:behavior.random_look_around": { priority: 9 },
    } } });
  say(`folk: ${skins.length} skins, the entity and its model`);
}
// the climates' fog: the custom dimension has one biome, so the colours of the sea and the air come by fog (pushed by the
// scripts as a player moves): under water, vanilla's water colour for the sea's climate; in the air, a haze for the land's
const WATER = { frozen_ocean: "#3938C9", cold_ocean: "#3D57D6", ocean: "#3F76E4", lukewarm_ocean: "#45ADF2", warm_ocean: "#43D5EE" };   // given: vanilla's ocean water colours
const AIR = { temperate: "#ABD2FF", dry: "#E3D3A6", cold: "#DCE6F0", wet: "#B6D6C2" };   // vision: the hazes (vanilla's sky-blue fog, a dust, a snow-light, a damp green)
for (const [sea, wc] of Object.entries(WATER)) for (const [land, ac] of Object.entries(AIR)) {
  const f = path.join(RP, "fogs", `${sea}_${land}.json`); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ format_version: "1.16.100", "minecraft:fog_settings": { description: { identifier: `waterworld:${sea}_${land}` }, distance: {
    air: { fog_start: 0.92, fog_end: 1.0, fog_color: ac, render_distance_type: "render" }, water: { fog_start: 0, fog_end: 60, fog_color: wc, render_distance_type: "fixed" } } } }, null, 1));   // given: vanilla's own air fog (the last eighth of the render distance) and water fog (sixty blocks)
}
say(`packs written (${nt} block textures)`);
// ---- 6. the ship module (ship/: Shipwright's plans, yards, hulls, helm, crew and charts, folded in; its scripts
// under scripts/ship/, booted from main.js; its world generation left out, Waterworld lays the world)
{ const SH = path.join(ROOT, "ship"), cp = (a, b) => fs.cpSync(a, b, { recursive: true });
  cp(path.join(SH, "BP/scripts"), path.join(S, "ship"));
  for (const d of ["entities", "blocks", "items", "recipes"]) cp(path.join(SH, "BP", d), path.join(BP, d));
  for (const d of ["entity", "models", "animations", "render_controllers", "fogs", "textures/entity", "textures/items", "textures/ui"]) cp(path.join(SH, "RP", d), path.join(RP, d));
  for (const f of fs.readdirSync(path.join(SH, "RP/textures/blocks"))) if (f.endsWith(".png")) fs.copyFileSync(path.join(SH, "RP/textures/blocks", f), path.join(RP, "textures/blocks", f));
  const J = (f) => JSON.parse(fs.readFileSync(f, "utf8")), tt = path.join(RP, "textures/terrain_texture.json"), atl = J(tt), shipAtl = J(path.join(SH, "RP/textures/terrain_texture.json"));
  for (const [k, v] of Object.entries(shipAtl.texture_data)) { if (atl.texture_data[k]) throw new Error(`terrain key ${k} in both`); atl.texture_data[k] = v; }
  fs.writeFileSync(tt, JSON.stringify(atl, null, 1));
  fs.writeFileSync(path.join(RP, "textures/item_texture.json"), JSON.stringify({ ...J(path.join(SH, "RP/textures/item_texture.json")), resource_pack_name: "waterworld" }, null, 1));
  const bj = path.join(RP, "blocks.json"); fs.writeFileSync(bj, JSON.stringify({ ...(fs.existsSync(bj) ? J(bj) : { format_version: "1.21.40" }), ...J(path.join(SH, "RP/blocks.json")) }, null, 1));
  fs.appendFileSync(path.join(RP, "texts/en_US.lang"), fs.readFileSync(path.join(SH, "RP/texts/en_US.lang"), "utf8"));
  cp(path.join(SH, "BP/texts"), path.join(BP, "texts"));
  say(`the ship module: ${fs.readdirSync(path.join(SH, "BP/entities")).length} entities, ${fs.readdirSync(path.join(SH, "BP/scripts")).filter((f) => f.endsWith(".js")).length} scripts`); }
// ---- the coinage (world/coinage.js): the coins as items (each its metal's disc under the refinery's die), and the
// recipes: at the Theran mint's press an ingot strikes its coin and nine strike a stamped block; at any table a stamped
// block or a coin gives its metal back. The League's stamped blocks come only from its counter (mod/scripts/bank.js).
{ const { COINS, STAMPED, INGOT_ID, BLOCK_INGOTS } = await import("../world/coinage.js"), { METAL_RGB, CUSTOM, theranDie } = await import("../world/carvings.js"), { encode } = await import("./png.js");
  const J = (f) => JSON.parse(fs.readFileSync(f, "utf8")), put = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
  const it = path.join(RP, "textures/item_texture.json"), items = J(it), lang = [];
  fs.mkdirSync(path.join(RP, "textures/items/waterworld"), { recursive: true });
  for (const c of COINS) { const n = c.id.split(":")[1], rgb = METAL_RGB[c.metal], px = new Uint8Array(16 * 16 * 4);
    for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) { const r = Math.hypot(u + 0.5 - 8, v + 0.5 - 8); if (r > 7.6) continue;   // vision: the coin's disc, seven and a half pixels across its radius
      const h = r > 7.0 ? 0.7 : Math.max(0, theranDie(u, v)), lit = 0.66 + 0.5 * h - 0.014 * (u - v);   // vision: the milled edge, the wave struck up, lit from the upper left
      px.set([...rgb.map((x) => Math.max(0, Math.min(255, x * lit))), 255], (v * 16 + u) * 4); }
    fs.writeFileSync(path.join(RP, `textures/items/waterworld/${n}.png`), encode(16, 16, px, 4)); items.texture_data[`waterworld_${n}`] = { textures: `textures/items/waterworld/${n}` };
    put(path.join(BP, `items/${n}.json`), { format_version: "1.21.40", "minecraft:item": { description: { identifier: c.id, menu_category: { category: "items" } }, components: { "minecraft:icon": `waterworld_${n}`, "minecraft:max_stack_size": 64, "minecraft:display_name": { value: `item.${c.id}.name` } } } });
    lang.push(`item.${c.id}.name=${c.name} (${c.worth} obol${c.worth === 1 ? "" : "s"})`); }
  fs.writeFileSync(it, JSON.stringify(items, null, 1));
  const recipe = (id, tag, body) => put(path.join(BP, `recipes/${id.replace(":", "_")}.json`), { format_version: "1.20.10", ...body(id, tag) });
  const shapeless = (id, tags, ins, out, count = 1) => recipe(id, tags, () => ({ "minecraft:recipe_shapeless": { description: { identifier: id }, tags, ingredients: ins.map((i) => ({ item: i })), result: { item: out, count } } }));
  let n = 0;
  for (const c of COINS) { shapeless(`waterworld:strike_${c.metal}`, ["theran_mint"], [c.ingot], c.id); shapeless(`waterworld:melt_${c.metal}_coin`, ["theran_mint"], [c.id], c.ingot); n += 2; }   // an ingot strikes its coin; a coin melts back
  for (const b of STAMPED) { const nm = b.id.split(":")[1];
    if (b.stamp === "theran") { recipe(`waterworld:stamp_${b.metal}`, null, (id) => ({ "minecraft:recipe_shaped": { description: { identifier: id }, tags: ["theran_mint"], pattern: ["###", "###", "###"], key: { "#": { item: INGOT_ID[b.metal] } }, result: { item: b.id } } })); n++; }   // nine ingots under the die
    shapeless(`waterworld:unstamp_${nm}`, ["crafting_table", "theran_mint"], [b.id], INGOT_ID[b.metal], BLOCK_INGOTS); n++;   // any stamped block gives its nine back
  }
  recipe("waterworld:theran_mint_press", null, (id) => ({ "minecraft:recipe_shaped": { description: { identifier: id }, tags: ["crafting_table"], pattern: ["G G", " A ", "III"], key: { G: { item: "minecraft:gold_ingot" }, A: { item: "minecraft:anvil" }, I: { item: "minecraft:iron_ingot" } }, result: { item: "waterworld:theran_mint_press" } } })); n++;
  for (const b of CUSTOM) if (b.name) lang.push(`tile.${b.id}.name=${b.name[0].toUpperCase() + b.name.slice(1)}`);   // every one of the pack's own blocks by its name
  fs.appendFileSync(path.join(RP, "texts/en_US.lang"), "\n" + lang.join("\n") + "\n");
  say(`the coinage: ${COINS.map((c) => `${c.name.split(" ")[1].toLowerCase()} ${c.worth}`).join(", ")} obols, an emerald 16; ${STAMPED.length} stamped blocks, ${n} recipes at the mint and the table`); }
// every texture a well-formed PNG: its pixels' bytes what its header says (an RGBA tile once went out headed greyscale,
// and the game drew the stained glass and the folk as nothing)
{ const zlib = await import("node:zlib"), CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }, bad = []; let n = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith(".png")) { n++;
    const b = fs.readFileSync(p), w = b.readUInt32BE(16), h = b.readUInt32BE(20), depth = b[24], t = b[25], idat = []; for (let i = 8; i < b.length;) { const L = b.readUInt32BE(i), tag = b.toString("ascii", i + 4, i + 8); if (tag === "IDAT") idat.push(b.subarray(i + 8, i + 8 + L)); i += 12 + L; }
    let raw; try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { bad.push(p); continue; }
    if (raw.length !== (Math.ceil((w * CH[t] * depth) / 8) + 1) * h) bad.push(path.relative(RP, p)); } } };
  walk(RP); if (bad.length) throw new Error(`${bad.length} malformed textures: ${bad.slice(0, 5).join(", ")}`); say(`textures: ${n} PNGs, every one well formed`); }
// the test kit for the dev server (dev/: the Docker Bedrock server the Switch joins through BedrockConnect): waterworld/{BP, RP, dev, VERSION}
const KIT = path.join(DIST, "kit", "waterworld"); fs.mkdirSync(KIT, { recursive: true });
fs.cpSync(BP, path.join(KIT, "BP"), { recursive: true }); fs.cpSync(RP, path.join(KIT, "RP"), { recursive: true }); fs.cpSync(path.join(ROOT, "dev"), path.join(KIT, "dev"), { recursive: true });
fs.writeFileSync(path.join(KIT, "VERSION"), VERSION.join(".") + "\n");
fs.copyFileSync(path.join(ROOT, "ww"), path.join(KIT, "ww")); fs.chmodSync(path.join(KIT, "ww"), 0o755);
fs.writeFileSync(path.join(KIT, "START HERE.txt"), `Waterworld test server ${VERSION.join(".")}

First time (in Terminal):
  cd ~ && unzip -o ~/Downloads/waterworld-dev.zip && bash ~/waterworld/ww setup

That puts "ww" on your PATH, deletes the old test servers (it asks first), and starts a clean one for the Switch.

Every update after that:
  download waterworld-update.zip from the chat, then:   ww update        (keeps the world)
                                                         ww update --new  (a brand-new world)

While testing:
  ww watch     Waterworld's messages and errors, live
  ww report    everything for the chat: saved to the Desktop and copied, just paste
  ww status    is it up and reachable
  ww stop / ww start
  ww new       carte blanche again
`);
if (!process.argv.includes("--nozip")) {
  execSync(`cd "${path.join(DIST, "kit")}" && zip -qr ../waterworld-dev.zip waterworld && cd waterworld && zip -qr ../../waterworld-update.zip BP RP VERSION ww dev`);
  say(`dist/waterworld-dev.zip (the whole kit) and dist/waterworld-update.zip (for dev/refresh.sh)`);
  const out = path.join(DIST, "Waterworld.mcaddon"); fs.rmSync(out, { force: true });
  execSync(`cd "${DIST}" && zip -qr Waterworld.mcaddon Waterworld_BP Waterworld_RP`);
  say(`dist/Waterworld.mcaddon: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
}
