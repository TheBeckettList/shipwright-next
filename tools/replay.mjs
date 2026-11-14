// inherency: instrument
// Phase 2's proof (handover/design/world-buildout.md): lays grown towns again from their plans (tools/plans.mjs),
// without growing them, and compares block for block with what the grow laid (lab/grown/<key>.json).
//   node tools/replay.mjs [key ...]          every plan in lab/plans (or these): laid again and compared
//   node tools/replay.mjs --record key ...   grow these again (as bakegrown does), check the grow matches lab/grown, and
//                                            keep their plans: for towns grown before bakegrown kept plans
// Prints, a town a line: identical or not, the plan's size against the blocks', its prototypes (distinct recipes), and
// how many there would be with the seeds shared (five or eight a kind), the time to lay from the plan.
import fs from "node:fs";
import { FIB } from "../core/golden.js";
import { chosen, colsOf, fileOf, sourceHash } from "./bakegrown.mjs";
import { planOf, layOf, writePlan, readPlan, planFile, PLANS } from "./plans.mjs";

const args = process.argv.slice(2), record = args.includes("--record"), keys = args.filter((a) => !a.startsWith("--"));
const hash = sourceHash();
const same = (o, r) => ["ids", "cols", "beasts"].every((k) => JSON.stringify(o[k]) === JSON.stringify(r[k]));
const grownOf = (key) => (fs.existsSync(fileOf(key)) ? JSON.parse(fs.readFileSync(fileOf(key), "utf8")) : null);

if (record) {
  const { cityOf } = await import("../world/cities.js"), { layPlace } = await import("../world/district.js");
  const all = await chosen(1e9);
  for (const key of keys) {
    const hit = all.find(({ s }) => s.key === key), o = grownOf(key);
    if (!hit) { console.log(`${key}: not a settlement`); continue; }
    if (!o || o.hash !== hash) { console.log(`${key}: its grown file is ${o ? "stale" : "missing"}; grow it (bakegrown), which keeps its plan`); continue; }
    const { s } = hit, t0 = Date.now(), c = cityOf(s.lead, { seed: FIB[6] - 2 }), t = s.lead.tradition;   // vision: bakegrown's seed, to the letter
    const lay = layPlace(c.place, t, { ground: c.ground, water: c.water, margin: FIB[6] });
    const r = await colsOf(c, lay, t);
    if (!same(o, r)) { console.log(`${key}: grown again, it DIFFERS from lab/grown: no plan kept`); continue; }
    writePlan(await planOf(s, c, hash));
    console.log(`${key}: grown again identical in ${Math.round((Date.now() - t0) / 1000)} s; plan kept`);
  }
  process.exit(0);
}

const list = keys.length ? keys : fs.existsSync(PLANS) ? fs.readdirSync(PLANS).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(`${PLANS}/${f}`, "utf8")).key) : [];
if (!list.length) console.log("no plans yet: node tools/replay.mjs --record <key> (or grow with bakegrown, which keeps them)");
let ok = 0, bad = 0, planB = 0, grownB = 0;
const kinds = new Map();
for (const key of list) {
  const plan = readPlan(key), o = grownOf(key);
  if (!o) { console.log(`${key}: no grown town to compare with`); bad++; continue; }
  if (plan.hash !== o.hash) { console.log(`${key}: plan and grown town are of different sources (${plan.hash}, ${o.hash})`); bad++; continue; }
  const t0 = Date.now(), { lay, ground, water, protos } = await layOf(plan);
  const r = await colsOf({ at: plan.at, ground, water }, lay, plan.t), ms = Date.now() - t0;
  const ident = same(o, r) && JSON.stringify(o.decor) === JSON.stringify(lay.decor);
  ident ? ok++ : bad++;
  const pB = fs.statSync(planFile(key)).size, gB = fs.statSync(fileOf(key)).size; planB += pB; grownB += gB;
  const bodies = plan.recipes.filter((x) => x.part === undefined);
  const per = new Map(); for (const x of bodies) { const k = `${x.id}|${x.up}`; per.set(k, (per.get(k) ?? 0) + 1); }
  const shared = (m) => [...per.values()].reduce((a, n) => a + Math.min(n, m), 0);   // m seeds a kind (and storeys): a town needs no more prototypes of a kind than that
  for (const x of bodies) kinds.set(`${plan.t}|${x.id}`, (kinds.get(`${plan.t}|${x.id}`) ?? 0) + 1);
  let diff = "";
  if (!ident) { const oc = new Map(o.cols.map((c) => [`${c[0]},${c[1]}`, JSON.stringify(c)])), rc = new Map(r.cols.map((c) => [`${c[0]},${c[1]}`, JSON.stringify(c)])); let n = 0, first = null; for (const [k, v] of oc) if (rc.get(k) !== v) { n++; first ??= k; } for (const k of rc.keys()) if (!oc.has(k)) n++; diff = ` — ${n} columns differ (first at ${first}), ids ${JSON.stringify(o.ids) === JSON.stringify(r.ids) ? "same" : "differ"}, beasts ${JSON.stringify(o.beasts) === JSON.stringify(r.beasts) ? "same" : "differ"}, decor ${JSON.stringify(o.decor) === JSON.stringify(lay.decor) ? "same" : "differ"}`; }
  console.log(`${key} ${plan.t}: ${ident ? "IDENTICAL" : "DIFFERENT"}${diff}; plan ${(pB / 1024).toFixed(0)} KB against ${(gB / 1048576).toFixed(1)} MB of blocks; ${plan.recipes.length} placements, ${protos} prototypes (seeds shared: ${shared(FIB[4])} at five, ${shared(FIB[5])} at eight); laid in ${ms} ms`);   // vision: five or eight seeds a kind (world-buildout.md)
}
if (list.length) console.log(`${ok} identical, ${bad} not, of ${list.length}; plans ${(planB / 1048576).toFixed(2)} MB against ${(grownB / 1048576).toFixed(1)} MB of blocks; ${kinds.size} building kinds among them`);
process.exit(bad ? 1 : 0);
