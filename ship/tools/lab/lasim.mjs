// The linear algebra sim: Seedworld's math, set to work on Shipwright. Pure lenses, no game.
//
//   node tools/lab/lasim.mjs golden                 the one law: breaths, its tempos, the frames' group
//   node tools/lab/lasim.mjs tempo [--json f]       every timer on the beat: today's load, the phase plan
//   node tools/lab/lasim.mjs cultures [key]         each people's palette (declared and learned) and
//                                                   its buildings through every gate
//   node tools/lab/lasim.mjs build <name|path> [--culture c | --all] [--png f] [--dump dir] [--key v ...]
//                                                   run a build script (tools/lab/la/builds), gate it, draw it
//   node tools/lab/lasim.mjs piece <culture> <main|home|side> [--turns n] [--mirror] [--png f]
//                                                   one of the mod's own buildings, set down any way round
//   node tools/lab/lasim.mjs find <regex>           vanilla block ids (and their states) matching
//   node tools/lab/lasim.mjs all                    golden, tempo and cultures, short
//
// The modules (tools/lab/la): field.js (exact mod-p matrices, the line law), frames.js (the square's
// eight symmetries, block states carried through them), tempo.js (the beat), vanilla.js (the
// bounds), gates.js (the rules), build.js (the build). See tools/lab/la/README.md.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { F, kron, order, breath, pisano } from "./la/field.js";
import { groupLaws, D4 } from "./la/frames.js";
import { CENSUS, BAR, goldenBeats, offBeat, profile, stats, phasePlan, meetings } from "./la/tempo.js";
import { Build, fromCanvas } from "./la/build.js";
import { check, culture, CULTURES, piecesOf } from "./la/gates.js";
import { registry, findBlocks, ROOT } from "./la/vanilla.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (k) => argv.includes(`--${k}`);
const opt = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && !["mirror", "all"].includes(argv[i - 1].slice(2))));

// ---------------------------------------------------------------- lenses

export function goldenLens() {
  const rows = [];
  for (const L of [2, 4, 6, 8, 10, 12, 16, 20, 30, 40]) rows.push({ L, mobius: breath(L), ring: breath(L, { mobius: false }) });
  const ok = rows.every((r) => r.mobius === 2 * r.L && r.ring === 3 * r.L);
  return {
    breath: rows, breathHolds: ok,
    orders: { F: order(F, 3), FxF: order(kron(F, F, 3), 3) },
    pisano: Object.fromEntries([2, 3, 4, 5, 10, 11, 15, 25].map((n) => [n, pisano(n)])),
    goldenBeats: goldenBeats(),
    frames: groupLaws(),
  };
}
export function tempoLens({ census = CENSUS } = {}) {
  const steady = census.filter((t) => !t.transient);
  const before = stats(profile(steady)), plan = phasePlan(steady), after = stats(profile(steady, plan));
  const golden = new Set(goldenBeats().map((b) => b.period));
  return {
    bar: BAR, timers: steady.length, transient: census.filter((t) => t.transient).map((t) => t.name),
    offBeat: offBeat(census).map((t) => t.name),
    onGoldenBeat: steady.filter((t) => golden.has(t.period)).length,
    before, after, plan,
    // the two that exchange most: chunks laid and the peoples warmed ahead of them
    exchange: meetings(steady.find((t) => t.name === "seaworld.chunks"), steady.find((t) => t.name === "seaworld.peoples"), plan).length,
  };
}
export function cultureLens(keys = CULTURES) {
  return keys.map((key) => {
    const c = culture(key), p = piecesOf(key);
    const pieces = ["main", "home", "side"].map((k) => {
      const r = check(fromCanvas(p[k], `${key}.${k}`, { culture: key }));
      return { piece: k, pass: r.pass, score: r.score, fails: r.results.filter((x) => x.kind === "must" && !x.ok).map((x) => `${x.rule}: ${x.detail}`) };
    });
    return { key, name: c.name, boats: c.plans, declared: c.declared, learned: c.learned.map(([m, n]) => `${m} ${n}`), pieces };
  });
}

// ---------------------------------------------------------------- builds

async function loadBuild(name) {
  const file = fs.existsSync(name) ? path.resolve(name) : path.join(here, "la/builds", name.endsWith(".js") ? name : `${name}.js`);
  if (!fs.existsSync(file)) throw new Error(`no build "${name}" (tools/lab/la/builds has ${fs.readdirSync(path.join(here, "la/builds")).join(", ")})`);
  return import(pathToFileURL(file).href);
}
const kv = () => { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) o[argv[i].slice(2)] = argv[i + 1]; return o; };

function report(b, r) {
  const bb = b.bounds();
  console.log(`\n${b.name}  (${b.size} blocks, ${bb.dx} x ${bb.dy} x ${bb.dz})  ${r.pass ? "PASS" : "FAIL"}  score ${r.score}`);
  for (const x of r.results) console.log(`  ${x.ok ? "ok  " : x.kind === "must" ? "FAIL" : "low "} ${x.kind.padEnd(6)} ${x.rule.padEnd(10)} ${x.detail}`);
  console.log(`  bill: ${b.bill().slice(0, 8).map(([id, n]) => `${n} ${id.replace("minecraft:", "")}`).join(", ")}`);
}
function draw(b, png) {
  const tmp = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "lasim-")), "dump.json");
  fs.writeFileSync(tmp, JSON.stringify(b.toDump()));
  execFileSync("python3", [path.join(here, "view.py"), tmp, png], { stdio: "inherit" });
}

async function buildCmd(name) {
  const mod = await loadBuild(name);
  const keys = flag("all") ? CULTURES : [opt("culture", "norse")];
  const out = [];
  for (const key of keys) {
    const made = mod.make({ Build, culture: culture(key), args: { ...(mod.params ?? {}), ...kv() } });
    for (const b of [made].flat()) {
      const r = check(b);
      report(b, r);
      out.push({ b, r });
      if (opt("dump")) { fs.mkdirSync(opt("dump"), { recursive: true }); fs.writeFileSync(path.join(opt("dump"), `${b.name.replace(/\W+/g, "_")}.json`), JSON.stringify(b.toDump())); }
      if (opt("png")) draw(b, keys.length > 1 ? opt("png").replace(/(\.png)?$/, `_${key}.png`) : opt("png"));
    }
  }
  return out;
}

// ---------------------------------------------------------------- main

async function main() {
  const cmd = positional[0] ?? "all";
  if (cmd === "golden" || cmd === "all") {
    const g = goldenLens();
    console.log(`GOLDEN  F = [[1,1],[1,0]] mod 3: order ${g.orders.F} (F (x) F: ${g.orders.FxF})`);
    console.log(`  breath from the point, Mobius loop / plain ring: ${g.breath.map((r) => `L${r.L} ${r.mobius}/${r.ring}`).join("  ")}  ${g.breathHolds ? "(2L and 3L: holds)" : "(DOES NOT HOLD)"}`);
    console.log(`  pisano (ticks the golden law takes mod n): ${Object.entries(g.pisano).map(([n, p]) => `${n}:${p}`).join("  ")}`);
    console.log(`  golden beats that fit the ${BAR}-tick bar: ${g.goldenBeats.map((b) => `${b.period} (mod ${b.n})`).join(", ")}`);
    console.log(`  frames: R^4=I ${g.frames.r4}, M^2=I ${g.frames.m2}, MRM=R^-1 ${g.frames.mrm}, closed ${g.frames.closed} (${g.frames.size} placements)`);
  }
  if (cmd === "tempo" || cmd === "all") {
    const t = tempoLens();
    console.log(`\nTEMPO  bar ${t.bar} ticks, ${t.timers} steady timers (${t.onGoldenBeat} on a golden beat), off the bar: ${t.offBeat.length ? t.offBeat.join(", ") : "none"}`);
    console.log(`  today (every timer at phase 0): peak ${t.before.peak} at tick ${t.before.peakAt}, mean ${t.before.mean}, peak/mean ${t.before.ratio}`);
    console.log(`  phase plan:                     peak ${t.after.peak} at tick ${t.after.peakAt}, mean ${t.after.mean}, peak/mean ${t.after.ratio}`);
    console.log(`  chunks and peoples still meet ${t.exchange} times a bar; transient timers (start when called): ${t.transient.join(", ")}`);
    if (cmd === "tempo") {
      for (const c of CENSUS.filter((x) => !x.transient)) console.log(`    ${c.name.padEnd(20)} every ${String(c.period).padStart(3)}  phase ${String(t.plan[c.name]).padStart(3)}  cost ${c.cost}  ${c.file}${c.inside ? `  (inside ${c.inside})` : ""}`);
      if (opt("json")) fs.writeFileSync(opt("json"), JSON.stringify({ bar: t.bar, plan: t.plan, census: CENSUS, before: profile(CENSUS.filter((x) => !x.transient)), after: profile(CENSUS.filter((x) => !x.transient), t.plan) }, null, 1));
    }
  }
  if (cmd === "cultures" || cmd === "all") {
    const which = cmd === "cultures" && positional[1] ? [positional[1]] : CULTURES;
    console.log(`\nCULTURES  (palette: declared by the yard style, trees and boats; learned from the culture's own buildings)`);
    for (const c of cultureLens(which)) {
      console.log(`  ${c.name} [${c.key}]  boats ${c.boats.join(", ")}`);
      if (cmd === "cultures") console.log(`    declared: ${c.declared.join(", ")}\n    learned:  ${c.learned.join(", ")}`);
      for (const p of c.pieces) console.log(`    ${p.piece.padEnd(5)} ${p.pass ? "pass" : "FAIL"} ${p.score}${p.fails.length ? `  ${p.fails.join("; ")}` : ""}`);
    }
  }
  if (cmd === "build") await buildCmd(positional[1] ?? "quay");
  if (cmd === "piece") {
    const [key, which = "main"] = positional.slice(1);
    const b = fromCanvas(piecesOf(key)[which], `${key}.${which}`, { culture: key }).transformed(Number(opt("turns", 0)), flag("mirror"));
    report(b, check(b));
    if (opt("png")) draw(b, opt("png"));
  }
  if (cmd === "find") {
    const re = new RegExp(positional[1] ?? ".");
    const reg = registry();
    for (const id of findBlocks(re).slice(0, 60)) console.log(`  ${id}  ${Object.entries(reg.blocks[id]).map(([k, v]) => `${k}=${v.join("/")}`).join("  ")}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
