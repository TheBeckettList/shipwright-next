// Grows the settlements nearest Thera (world/cities.js cityOf -> world/growth.js growOf -> world/district.js layPlace) and
// keeps each as the world's own blocks: only what differs from the ground the game already lays (the skin layPlace draws,
// grass over dirt, sand under water, is the game's own), and every block of that skin a town dug away as air.
// One file a settlement in lab/grown/, keyed by a hash of core/ and world/: a rerun grows only what changed or is new.
// tools/buildmod.mjs reads them and bakes them into the mod (data/grown.js).
//   node tools/bakegrown.mjs [--folk 8000] [--secs 540] [--only key]
//   node tools/bakegrown.mjs --restamp [n]   the sources changed but not the towns (a Thera-only change): grow the n smallest stale
//                                            towns again (2 by default), and if each comes out identical, stamp every stale town current
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadMap } from "../world/load.js";
loadMap();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lab/grown");
const { FIB } = await import("../core/golden.js");
const { GIVEN, D } = await import("../core/given.js");
const { THERA } = await import("../world/thera.js");

/** The hash of the sources a grown town depends on: every module cities.js, district.js and game/ground.js import, and
 *  theirs, read off their import lines (a change elsewhere in the sim leaves the grown towns standing). */
export function sourceHash() {
  const seen = new Set(), todo = ["world/cities.js", "world/district.js", "game/ground.js"];
  while (todo.length) { const f = todo.pop(); if (seen.has(f)) continue; seen.add(f); const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of src.matchAll(/(?:import[^"']*from\s*|import\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g)) { const g = path.relative(ROOT, path.resolve(path.dirname(path.join(ROOT, f)), m[1])); if (g.endsWith(".js") && fs.existsSync(path.join(ROOT, g))) todo.push(g); } }
  const h = crypto.createHash("sha1"); for (const f of [...seen].sort()) h.update(f).update(fs.readFileSync(path.join(ROOT, f)));
  return h.digest("hex").slice(0, 12);   // given: enough of a sha1 to tell sources apart
}
/** The settlements to grow, nearest Thera first, until their folk pass the budget (the empty ones and Thera's own left out). */
export async function chosen(folkBudget) {
  const { epicentreOf } = await import("../world/cities.js"), { settlements } = await import("../world/settlements.js");
  const SX = THERA.seat.cx * D.PX, SZ = THERA.seat.cz * D.PX;
  const S = settlements(epicentreOf).list.filter((s) => s.folk > 0 && s.t !== "therans").map((s) => ({ s, d: Math.hypot(s.at.x - SX, s.at.z - SZ) })).sort((a, b) => a.d - b.d);
  const out = []; let folk = 0;
  for (const { s, d } of S) { if (folk >= folkBudget) break; out.push({ s, d }); folk += s.folk; }
  return out;
}
export const fileOf = (key) => path.join(OUT, `${key.replace(/[^\w]/g, "_")}.json`);

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
  const budget = Number(arg("folk", 8000)), secs = Number(arg("secs", 540)), only = arg("only", null);   // vision: the first towns round Thera; a run fits under ten minutes
  fs.mkdirSync(OUT, { recursive: true });
  const hash = sourceHash(), t00 = Date.now();
  const { cityOf } = await import("../world/cities.js"), { layPlace } = await import("../world/district.js"), { heightAt, SEA } = await import("../game/ground.js");
  const restamp = process.argv.includes("--restamp"), proofs = [];
  let list = (await chosen(budget)).filter(({ s }) => !only || s.key === only);
  const stale = ({ s }) => fs.existsSync(fileOf(s.key)) && JSON.parse(fs.readFileSync(fileOf(s.key), "utf8")).hash !== hash;
  if (restamp) list = list.filter(stale).sort((a, b) => a.s.folk - b.s.folk).slice(0, Number(arg("restamp", 2)) || 2);   // vision: two towns' proof
  let grown = 0, kept = 0, left = 0;
  for (const { s, d } of list) {
    const f = fileOf(s.key);
    if (fs.existsSync(f) && JSON.parse(fs.readFileSync(f, "utf8")).hash === hash) { kept++; continue; }
    if ((Date.now() - t00) / 1000 > secs) { left++; continue; }
    const t0 = Date.now(), c = cityOf(s.lead, { seed: FIB[6] - 2 }), t = s.lead.tradition;   // vision: the seed the snapshots show (eleven)
    const lay = layPlace(c.place, t, { ground: c.ground, water: c.water, margin: FIB[6] });
    const H = (x, z) => Math.round(c.ground.h(x, z)), wet = (x, z) => c.water(x, z);
    // the skin layPlace drew (district.js layPlace, its first loop): grass (snow in the Arctic) over two of dirt; under water, sand three deep or less
    const skinAt = (x, y, z) => { const h = H(x, z); if (wet(x, z)) return y === 0 ? "minecraft:water" : y === h && h >= -FIB[3] ? "minecraft:sand" : null; return y > h || y < h - FIB[2] ? null : y === h ? (t === "arctic" ? "minecraft:snow" : "minecraft:grass_block") : "minecraft:dirt"; };
    const byCol = new Map(); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [k, b] of lay.vox) { const [x, y, z] = k.split(",").map(Number), X = Math.round(x), Z = Math.round(z), ck = `${X},${Z}`; let m = byCol.get(ck); if (!m) byCol.set(ck, (m = new Map())); m.set(Math.round(y), b); if (X < x0) x0 = X; if (X > x1) x1 = X; if (Z < z0) z0 = Z; if (Z > z1) z1 = Z; }
    const ids = [], idKey = new Map(), idOf = (id, st) => { const k = st ? `${id}|${JSON.stringify(st)}` : id; if (!idKey.has(k)) { idKey.set(k, ids.length); ids.push(st ? [id, st] : [id]); } return idKey.get(k); };
    const AIR = idOf("minecraft:air"), cols = []; let blocks = 0, skipped = 0;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const m = byCol.get(`${x},${z}`), wx = c.at.x + x, wz = c.at.z + z; if (Math.round(heightAt(wx, wz).h) !== H(x, z)) { skipped++; continue; }   // where the game's ground isn't the town's (Thera's island and shelf, game/ground.js), the game's stands
      const h = H(x, z), row = [];
      if (m) for (const [y, b] of m) if (skinAt(x, y, z) !== b.id) row.push(SEA + y, idOf(b.id, b.s));
      if (!wet(x, z)) for (let y = h - FIB[2]; y <= h; y++) if (!m?.has(y)) row.push(SEA + y, AIR);   // the skin dug away
      if (row.length) { cols.push([wx, wz, ...row]); blocks += row.length / 2; }
    }
    const beasts = (lay.entities ?? []).map((e) => [e.type, c.at.x + Math.round(e.x), SEA + Math.round(e.y), c.at.z + Math.round(e.z)]);
    const rec = { hash, key: s.key, t, folk: s.folk, members: s.members.map((m) => m.key ?? m), at: s.at, d: Math.round(d), buildings: c.place.placed.length, farms: c.place.farms?.length ?? 0, ms: Date.now() - t0, ids, cols, beasts, decor: lay.decor };
    if (restamp) { const o = JSON.parse(fs.readFileSync(f, "utf8")), same = ["ids", "cols", "beasts"].every((k) => JSON.stringify(o[k]) === JSON.stringify(rec[k])); proofs.push([s.key, same]); console.log(`${s.key}: grown again ${same ? "identical" : "DIFFERENT"}`); continue; }
    fs.writeFileSync(f, JSON.stringify(rec)); grown++;
    console.log(`${s.key} ${t} ${s.folk} folk, ${Math.round(d)} from Thera: ${rec.buildings} buildings, ${rec.farms} farms, ${blocks} blocks in ${cols.length} columns, ${beasts.length} beasts${skipped ? `, ${skipped} columns where the game's ground differs, left` : ""}, ${rec.ms} ms`);
  }
  if (restamp) { if (proofs.length && proofs.every(([, same]) => same)) { let n = 0; for (const g of fs.readdirSync(OUT)) { const f = path.join(OUT, g), o = JSON.parse(fs.readFileSync(f, "utf8")); if (o.hash !== hash) { o.hash = hash; fs.writeFileSync(f, JSON.stringify(o)); n++; } } console.log(`restamped ${n} towns to ${hash}`); } else console.log("not restamped: a town came out different (or none was stale); grow them again"); process.exit(0); }
  console.log(`grown ${grown}, kept ${kept}, left for the next run ${left} (of ${list.length}), ${Math.round((Date.now() - t00) / 1000)} s`);
}
