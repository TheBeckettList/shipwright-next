// The balance lab: simulates a stretch of the sea world and holds it to the vision (world/vision.js).
//
//   node --import ./tests/mocks/register.mjs tools/lab/balancelab.mjs [seed ...] [--json out.json]
//
// It measures: land and every biome's share; every people's share of the settled confederations and
// how many lie unsettled; what a new player meets near the spawn; how far they sail between new
// things (liveliness); the wind belts (strength, steadiness) and where storms are born; and, for
// everything vanilla's overworld offers up to the portals (PARITY), how far from the spawn the
// nearest one lies.
import fs from "node:fs";
import { place, elevation, SEA_LEVEL } from "../../BP/scripts/world/terrain.js";
import { BIOMES, LAND_BIOMES, SEA_BIOMES, woodsOf } from "../../BP/scripts/world/biomes.js";
import { confederation, seatAt, peopleAt } from "../../BP/scripts/world/peoples.js";
import { sitesIn } from "../../BP/scripts/world/sites.js";
import { structuresIn, fortresses } from "../../BP/scripts/world/structures.js";
import { windField, belt, latitude, DAY } from "../../BP/scripts/world/fields.js";
import { TRADITION_WOOD } from "../../BP/scripts/world/biomes.js";
import { VISION, PARITY } from "../../BP/scripts/world/vision.js";
import { spawnPoint } from "../../BP/scripts/world/spawn.js";

const TRADITIONS = Object.keys(TRADITION_WOOD);

/** A grid of samples round the spawn: what's at each. */
export function survey(seed, R = 10000, step = 48) {
  const sp = spawnPoint(seed);
  const cells = [];
  for (let x = sp.x - R; x <= sp.x + R; x += step) for (let z = sp.z - R; z <= sp.z + R; z += step) {
    const p = place(seed, x, z);
    cells.push({ x, z, land: p.land, biome: p.biome, top: p.top, special: p.special, d: Math.hypot(x - sp.x, z - sp.z) });
  }
  return { sp, cells, step };
}

export function shares(sv) {
  const land = sv.cells.filter((c) => c.land), sea = sv.cells.filter((c) => !c.land);
  const count = (list) => list.reduce((m, c) => ((m[c.biome] = (m[c.biome] ?? 0) + 1), m), {});
  const L = count(land), S = count(sea);
  return {
    land: land.length / sv.cells.length,
    landBiomes: Object.fromEntries(LAND_BIOMES.map((k) => [k, (L[k] ?? 0) / Math.max(1, land.length)])),
    seaBiomes: Object.fromEntries(SEA_BIOMES.map((k) => [k, (S[k] ?? 0) / Math.max(1, sea.length)])),
  };
}

export function peoples(seed, span = 5) {
  const counts = Object.fromEntries(TRADITIONS.map((t) => [t, 0]));
  let settled = 0, unsettled = 0, members = Object.fromEntries(TRADITIONS.map((t) => [t, 0]));
  for (let cx = -span; cx <= span; cx++) for (let cz = -span; cz <= span; cz++) {
    const c = confederation(seed, seatAt(seed, cx, cz));
    if (!c.members.length) continue;
    if (!c.culture) { unsettled++; continue; }
    settled++;
    counts[c.culture]++;
    for (const m of c.members) if (m.tradition) members[m.tradition]++;
  }
  return { settled, unsettled, share: Object.fromEntries(TRADITIONS.map((t) => [t, counts[t] / Math.max(1, settled)])), members };
}

/** Nearest of each PARITY probe to the spawn (blocks), from the survey and the structure tables. */
export function parity(seed, sv) {
  const near = (pred) => sv.cells.filter(pred).reduce((m, c) => Math.min(m, c.d), Infinity);
  const sp = sv.sp;
  const nearestStructure = (kind) => {
    if (kind === "fortress") return Math.min(...fortresses(seed).map((f) => Math.hypot(f.x - sp.x, f.z - sp.z)));
    for (let r = 400; r <= 12000; r += 400) {
      const list = structuresIn(seed, sp.x - r, sp.z - r, sp.x + r, sp.z + r, 0).filter((s) => s.kind === kind);
      if (list.length) return Math.min(...list.map((s) => Math.hypot(s.x - sp.x, s.z - sp.z)));
    }
    return Infinity;
  };
  const nearestSite = (kind) => {
    for (let r = 200; r <= 6000; r += 200) {
      const list = sitesIn(seed, sp.x - r, sp.z - r, sp.x + r, sp.z + r, 0).filter((s) => s.kind === kind);
      if (list.length) return Math.min(...list.map((s) => Math.hypot(s.x - sp.x, s.z - sp.z)));
    }
    return Infinity;
  };
  const probe = (p) => {
    if (p === "wood") return near((c) => c.land && woodsOf(c.biome).some((w) => w !== "bone"));
    if (p === "land") return near((c) => c.land);
    if (p === "grass") return near((c) => c.land && (BIOMES[c.biome].plants ?? []).some(([id]) => /short_grass|fern|tall_grass/.test(id)));
    if (p === "animals") return near((c) => c.land && BIOMES[c.biome].animals?.length);
    if (p === "big_island") return near((c) => c.land && c.top >= SEA_LEVEL + 12);
    if (p === "obsidian") return Math.min(nearestStructure("gate"), near((c) => c.special === "volcano"));
    if (p === "settled") return near((c) => c.land && !peopleAt(seed, c.x, c.z).unsettled);
    if (p.startsWith("biome:")) { const set = new Set(p.slice(6).split("|")); return near((c) => set.has(c.biome)); }
    if (p.startsWith("structure:")) return nearestStructure(p.slice(10));
    if (p.startsWith("site:")) return nearestSite(p.slice(5));
    return Infinity;
  };
  return PARITY.map((row) => ({ ...row, nearest: Math.round(probe(row.probe)) }));
}

export function nearSpawn(seed, sv) {
  const r = VISION.nearSpawn.radius, sp = sv.sp;
  const biomes = new Set(sv.cells.filter((c) => c.d <= r).map((c) => c.biome));
  const cultures = new Set(sv.cells.filter((c) => c.d <= r && c.land).map((c) => peopleAt(seed, c.x, c.z)).filter((p) => !p.unsettled && p.member).map((p) => p.tradition));
  const wrecks = sitesIn(seed, sp.x - r, sp.z - r, sp.x + r, sp.z + r, 0).filter((s) => s.kind === "wreck" && Math.hypot(s.x - sp.x, s.z - sp.z) <= r).length;
  return { biomes: biomes.size, cultures: cultures.size, wrecks, list: { biomes: [...biomes], cultures: [...cultures] } };
}

/** Sailing straight out from the spawn: the gaps between new things. */
export function liveliness(seed, sv, lines = 24, length = 5000) {
  const gaps = [];
  const sp = sv.sp;
  for (let k = 0; k < lines; k++) {
    const a = (k / lines) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let last = 0, prevGroup = null, prevSea = null, seaRun = 0, prevPeople = null;
    const seen = new Set();
    const boxSites = sitesIn(seed, Math.min(sp.x, sp.x + dx * length) - 60, Math.min(sp.z, sp.z + dz * length) - 60, Math.max(sp.x, sp.x + dx * length) + 60, Math.max(sp.z, sp.z + dz * length) + 60, 0);
    const boxStructs = structuresIn(seed, Math.min(sp.x, sp.x + dx * length) - 80, Math.min(sp.z, sp.z + dz * length) - 80, Math.max(sp.x, sp.x + dx * length) + 80, Math.max(sp.z, sp.z + dz * length) + 80, 0);
    for (let s = 16; s <= length; s += 16) {
      const x = sp.x + dx * s, z = sp.z + dz * s;
      let event = false;
      // an island within sight (48 blocks either side)
      for (const off of [-48, 0, 48]) {
        const e = elevation(seed, x - dz * off, z + dx * off);
        if (e.land && e.group && e.group !== prevGroup) { prevGroup = e.group; event = true; }
      }
      for (const st of [...boxSites, ...boxStructs]) if (!seen.has(st.id) && Math.hypot(st.x - x, st.z - z) < 60) { seen.add(st.id); event = true; }
      if (s % 64 === 0) {
        const p = place(seed, x, z);
        if (!p.land) {
          if (p.biome !== prevSea) { seaRun++; if (seaRun >= 2) { if (prevSea !== null) event = true; prevSea = p.biome; seaRun = 0; } } else seaRun = 0;
        }
        const pe = peopleAt(seed, x, z);
        const who = pe.hold > 0.05 ? pe.tradition : null;
        if (who && who !== prevPeople) { prevPeople = who; event = true; }
      }
      if (event) { gaps.push(s - last); last = s; }
    }
    gaps.push(length - last);
  }
  gaps.sort((a, b) => a - b);
  const q = (f) => gaps[Math.min(gaps.length - 1, Math.floor(f * gaps.length))];
  return { median: q(0.5), p90: q(0.9), events: gaps.length };
}

export function winds(seed) {
  const byBelt = {};
  for (let lat = -84; lat <= 84; lat += 3) for (let i = 0; i < 24; i++) {
    const z = -(lat - 42) / 90 * 9000;                         // spawn's latitude at z 0, north is -z
    const x = i * 977 - 11000;
    for (const t of [0, DAY * 3, DAY * 7]) {
      const w = windField(seed, x, z + (i % 3) * 40, t + i * 1777);
      const b = byBelt[w.belt] ??= { n: 0, strength: 0, sx: 0, sz: 0, storms: 0 };
      const m = Math.hypot(w.x, w.z);
      b.n++; b.strength += m; b.sx += w.x / (m || 1); b.sz += w.z / (m || 1);
      if (w.storm > 0.3) b.storms++;
    }
  }
  const out = {};
  for (const [k, b] of Object.entries(byBelt)) {
    const R = Math.hypot(b.sx, b.sz) / b.n;                    // 1: always the same direction
    out[k] = { strength: +(b.strength / b.n).toFixed(2), spreadDeg: +(Math.sqrt(-2 * Math.log(Math.max(1e-6, R))) * 180 / Math.PI).toFixed(0), storms: +(b.storms / b.n).toFixed(3), n: b.n };
  }
  return out;
}

/** The rules' balance: shares averaged over several seeds (one seed's share moves by chance). */
export function judgeShares(rs) {
  const V = VISION, issues = [];
  const mean = (get) => { const keys = Object.keys(get(rs[0])); return Object.fromEntries(keys.map((k) => [k, rs.reduce((a, r) => a + get(r)[k], 0) / rs.length])); };
  const land = mean((r) => r.shares.landBiomes), sea = mean((r) => r.shares.seaBiomes), ppl = mean((r) => r.peoples.share);
  for (const [k, v] of Object.entries(land)) if (v < V.biomeShare.land[0] || v > V.biomeShare.land[1]) issues.push(`land biome ${k}: ${(v * 100).toFixed(1)}% across seeds`);
  for (const [k, v] of Object.entries(sea)) if (v < V.biomeShare.sea[0] || v > V.biomeShare.sea[1]) issues.push(`sea biome ${k}: ${(v * 100).toFixed(1)}% across seeds`);
  for (const [k, v] of Object.entries(ppl)) if (v < V.cultureShare[0] || v > V.cultureShare[1]) issues.push(`people ${k}: ${(v * 100).toFixed(1)}% of settled confederations across seeds`);
  return { issues, land, sea, peoples: ppl };
}

export function judge(r) {
  const V = VISION, issues = [];
  if (r.shares.land < V.land[0] || r.shares.land > V.land[1]) issues.push(`land ${(r.shares.land * 100).toFixed(1)}% (want ${V.land[0] * 100}-${V.land[1] * 100}%)`);
  const un = r.peoples.unsettled / Math.max(1, r.peoples.settled + r.peoples.unsettled);
  if (un > V.unsettled[1]) issues.push(`${(un * 100).toFixed(0)}% of confederations unsettled`);
  if (r.live.median > V.liveliness.median) issues.push(`median gap between new things ${r.live.median} blocks (want ≤ ${V.liveliness.median})`);
  if (r.live.p90 > V.liveliness.p90) issues.push(`long gaps ${r.live.p90} blocks (want ≤ ${V.liveliness.p90})`);
  const ns = V.nearSpawn;
  if (r.near.biomes < ns.biomes) issues.push(`only ${r.near.biomes} biomes near the spawn`);
  if (r.near.cultures < ns.cultures) issues.push(`only ${r.near.cultures} peoples near the spawn`);
  if (r.near.wrecks < ns.wrecks) issues.push(`only ${r.near.wrecks} wrecks near the spawn`);
  for (const p of r.parity) if (!(p.nearest <= p.within)) issues.push(`${p.vanilla}: nearest ${p.nearest === Infinity ? "none" : p.nearest} (want ≤ ${p.within})`);
  const w = r.winds;
  if (w.trades && w.trades.spreadDeg > V.wind.tradesSpreadMax) issues.push(`the trades wander ${w.trades.spreadDeg}°`);
  if (w.trades && w.westerlies && w.westerlies.strength < w.trades.strength * V.wind.westerliesOverTrades) issues.push("westerlies no stronger than the trades");
  return issues;
}

export function balance(seed, opts = {}) {
  const sv = survey(seed, opts.R ?? 10000, opts.step ?? 48);
  const r = { seed, spawn: [Math.round(sv.sp.x), Math.round(sv.sp.z)], shares: shares(sv), peoples: peoples(seed), near: nearSpawn(seed, sv), live: liveliness(seed, sv), winds: winds(seed), parity: parity(seed, sv) };
  r.issues = judge(r);
  return r;
}

function main() {
  const args = process.argv.slice(2);
  const jsonAt = args.indexOf("--json");
  const out = jsonAt >= 0 ? args[jsonAt + 1] : null;
  const seeds = args.filter((a, i) => i !== jsonAt && i !== jsonAt + 1).map(Number).filter((n) => !Number.isNaN(n));
  const all = [];
  let bad = 0;
  for (const seed of seeds.length ? seeds : [12345, 777, 4242]) {
    const t = Date.now();
    const r = balance(seed);
    all.push(r);
    bad += r.issues.length;
    console.log(`seed ${seed} (${((Date.now() - t) / 1000).toFixed(1)} s): land ${(r.shares.land * 100).toFixed(1)}%, ${r.peoples.settled} settled / ${r.peoples.unsettled} unsettled, near spawn ${r.near.biomes} biomes ${r.near.cultures} peoples ${r.near.wrecks} wrecks, gaps median ${r.live.median} p90 ${r.live.p90}: ${r.issues.length ? r.issues.length + " issue(s)" : "on vision"}`);
    for (const i of r.issues) console.log(`    ${i}`);
  }
  const agg = judgeShares(all);
  console.log(`across ${all.length} seeds: ${agg.issues.length ? agg.issues.length + " issue(s)" : "on vision"}`);
  for (const i of agg.issues) console.log(`    ${i}`);
  console.log("peoples: " + Object.entries(agg.peoples).map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(", "));
  bad += agg.issues.length;
  if (out) fs.writeFileSync(out, JSON.stringify({ seeds: all, agg }, null, 1));
  process.exitCode = bad ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
