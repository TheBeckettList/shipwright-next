// inherency: instrument
// Phase 2's first question (handover/design/world-buildout.md): if a grown town were stored as its plan, not its
// blocks, how big would the plan be? Grows the chosen settlements (as bakegrown.mjs does, writing nothing) and counts
// their placements, the distinct prototypes behind them (buildOf's cache: the same object for the same key), the
// canted ones (turned by other than right angles, so not a stamp of a prototype), and the voxels and bytes of each
// way of keeping the town.
//   node tools/planprobe.mjs <key> [<key> ...]
import { FIB } from "../core/golden.js";
import { chosen } from "./bakegrown.mjs";
const keys = process.argv.slice(2), { cityOf } = await import("../world/cities.js"), { layPlace } = await import("../world/district.js");
const all = await chosen(1e9), rows = [];
for (const key of keys) {
  const hit = all.find(({ s }) => s.key === key); if (!hit) { console.log(`${key}: not among the chosen`); continue; }
  const { s } = hit, t0 = Date.now(), c = cityOf(s.lead, { seed: FIB[6] - 2 }), t = s.lead.tradition;
  const lay = layPlace(c.place, t, { ground: c.ground, water: c.water, margin: FIB[6] });
  const placed = c.place.placed, protos = new Map(); let canted = 0, partOf = 0;
  for (const p of placed) { const v = p.b?.vox; if (!v) continue; if (!protos.has(v)) protos.set(v, v.size ?? v.length ?? 0); if (p.a) canted++; if (p.of !== undefined) partOf++; }
  const keyOf = (p, m) => `${p.id}|${m ? (p.seed ?? 0) % m : p.seed}|${p.size ?? ""}|${p.up ?? 0}|${p.b?.vox && p.b.terraced ? p.k : ""}`;
  const quant = Object.fromEntries([0, FIB[4], FIB[5]].map((m) => [m ? `seeds${m}` : "seedsAll", new Set(placed.filter((p) => p.of === undefined).map((p) => keyOf(p, m))).size]));   // vision: five or eight seeds a kind
  const kindsOf = new Set(placed.map((p) => p.id)).size;
  const H = (x, z) => Math.round(c.ground.h(x, z)), wet = (x, z) => c.water(x, z);
  const skinAt = (x, y, z) => { const h = H(x, z); if (wet(x, z)) return y === 0 ? "minecraft:water" : y === h && h >= -FIB[3] ? "minecraft:sand" : null; return y > h || y < h - FIB[2] ? null : y === h ? (t === "arctic" ? "minecraft:snow" : "minecraft:grass_block") : "minecraft:dirt"; };   // bakegrown's own skin
  const kinds = {}; let diff = 0; for (const [k, b] of lay.vox) { const [x, y, z] = k.split(",").map(Number); if (skinAt(Math.round(x), Math.round(y), Math.round(z)) === b.id) continue; diff++; const kk = b.id.replace("minecraft:", ""); kinds[kk] = (kinds[kk] ?? 0) + 1; }
  const top = Object.entries(kinds).sort((p, q) => q[1] - p[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(", ");
  const protoVox = [...protos.values()].reduce((a, b) => a + b, 0), townVox = diff;
  rows.push({ key, t, folk: s.folk, ms: Date.now() - t0, placements: placed.length, parts: partOf, canted, protos: protos.size, protoVox, protoKB: Math.round((protoVox * 8) / 1024), townVox, townKB: Math.round((townVox * 6) / 1024), shareInProtos: +(protoVox / townVox).toFixed(3), kinds: kindsOf, ...quant, seedSample: placed.slice(0, 6).map((p) => p.seed), top });   // given: a prototype voxel x, y, z, block as four Int16 (8 bytes); a laid block y and block in its column (about 6)
  console.log(JSON.stringify(rows[rows.length - 1]));
}
