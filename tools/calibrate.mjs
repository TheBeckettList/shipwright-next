// The feedback loop's middle: the server's probes in, the knobs' next rung out.
//   node tools/calibrate.mjs <probes.jsonl> [--node dist/modtest-probes.jsonl] [--apply]
//
// sim -> game -> probes -> calibrate -> sim. Each knob (game/calibration.js) has a ladder of lawful values and a model
// of what it does to something the server measures; the probes fit the model's one unknown, the model says which
// rung meets the target, and the knob moves one rung toward it (never more: the loop is damped, so it can't swing)
// and only on enough evidence. Laws are never moved: where a probe contradicts one (a hole in the ground, folk in the
// dark the lab says are lit), the report says so, as a bug to fix, not a number to tune.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIB, PHI } from "../core/golden.js";
import { LADDERS, CALIBRATION, HISTORY } from "../game/calibration.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), nodeFile = args.includes("--node") ? args[args.indexOf("--node") + 1] : null, file = args.find((a) => !a.startsWith("--") && a !== nodeFile);
if (!file) { console.log("usage: node tools/calibrate.mjs <probes.jsonl> [--node dist/modtest-probes.jsonl] [--apply]"); process.exit(1); }
const read = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const P = read(file), N = nodeFile && fs.existsSync(nodeFile) ? read(nodeFile) : [];
const of = (k) => P.filter((p) => p.k === k), median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };

// the targets (vision, each a law of the game's feel)
const TARGET = {
  ring: FIB[7],                       // seconds to lay the ring round an arriving player: 21
  tps: 20 * (1 - 1 / FIB[7]),         // the frame rate kept: 20 ticks a second, less one part in 21 (19.05)
  evidence: FIB[4],                   // probes needed before a knob moves: 5
};
const step = (ladder, now, want) => {   // one rung toward the wanted rung
  const i = ladder.indexOf(now) >= 0 ? ladder.indexOf(now) : ladder.findIndex((v) => v >= now), j = ladder.indexOf(want);
  return ladder[Math.max(0, Math.min(ladder.length - 1, i + Math.sign(j - i)))];
};
const report = [], next = { ...CALIBRATION }, why = {};
const say = (s) => report.push(s);

// ---- the layer's cost -> radius and columns a pause
const chunks = of("chunk").filter((c) => c.ms >= 0), ms = median(chunks.map((c) => c.ms));
const byKind = {}; for (const c of chunks) (byKind[c.kind] ??= []).push(c.ms);
say(`chunks laid: ${chunks.length}, ${isFinite(ms) ? ms : "-"} ms each (median, wall clock): ${Object.entries(byKind).map(([k, v]) => `${k} ${median(v)} ms (${v.length})`).join(", ")}`);
if (chunks.length >= TARGET.evidence) {
  const ringOf = (R) => ((2 * R + 1) ** 2 * ms) / 1000, want = [...LADDERS.radius].reverse().find((R) => ringOf(R) <= TARGET.ring) ?? LADDERS.radius[0];
  next.radius = step(LADDERS.radius, CALIBRATION.radius, want);
  say(`  the ring at radius ${CALIBRATION.radius}: ${ringOf(CALIBRATION.radius).toFixed(0)} s to lay (target ${TARGET.ring} s): radius ${want} would meet it`);
  if (next.radius !== CALIBRATION.radius) why.radius = `the ring took ${ringOf(CALIBRATION.radius).toFixed(0)} s at ${ms} ms a chunk`;
}
if (N.length) {   // the Node stand-in's cost against the game's: the ratio that makes npm run modtest predict the game
  const nm = median(N.filter((p) => p.k === "chunk").map((p) => p.ms));
  if (isFinite(nm) && isFinite(ms)) say(`  the game lays a chunk ${(ms / nm).toFixed(1)}x slower than Node's stand-in (${ms} ms against ${nm.toFixed(0)}): modtest x ${(ms / nm).toFixed(1)} predicts the game`);
}

// ---- the frame rate -> how many folk stand, and how much the layer does between pauses
const tps = of("tps").filter((p) => p.tps > 0);
if (tps.length) {
  const low = tps.filter((p) => p.tps < TARGET.tps), withFolk = tps.filter((p) => p.folk > 0);
  say(`frame rate: ${median(tps.map((p) => p.tps))} ticks a second (median of ${tps.length}); ${low.length} minutes under ${TARGET.tps.toFixed(2)}; folk loaded ${median(withFolk.map((p) => p.folk)) || 0}`);
  if (withFolk.length >= TARGET.evidence) {
    // tps = 20 / (1 + a folk): fit a, then the most folk (the smallest "one in so many") that keeps the target
    const a = median(withFolk.map((p) => Math.max(0, 20 / p.tps - 1) / p.folk)), F = median(withFolk.map((p) => p.folk));
    const tpsAt = (shown) => 20 / (1 + a * F * (CALIBRATION.shownThera / shown));
    const want = LADDERS.shownThera.find((s) => tpsAt(s) >= TARGET.tps) ?? LADDERS.shownThera.at(-1);
    next.shownThera = step(LADDERS.shownThera, CALIBRATION.shownThera, want);
    next.shownTown = LADDERS.shownTown[Math.min(LADDERS.shownTown.length - 1, Math.max(0, LADDERS.shownTown.indexOf(CALIBRATION.shownTown) + (LADDERS.shownThera.indexOf(next.shownThera) - LADDERS.shownThera.indexOf(CALIBRATION.shownThera))))];   // the towns move with Thera, rung for rung
    say(`  each folk costs ${(a * 1000).toFixed(2)} thousandths of the frame: one in ${want} of Thera's people would keep ${TARGET.tps.toFixed(2)} (now one in ${CALIBRATION.shownThera}: ${tpsAt(CALIBRATION.shownThera).toFixed(2)})`);
    if (next.shownThera !== CALIBRATION.shownThera) why.shownThera = why.shownTown = `the frame rate with ${F} folk loaded`;
  }
  const laying = low.filter((p) => chunks.some((c) => Math.abs(c.t - p.t) < 20 * 60));
  if (laying.length >= TARGET.evidence) { next.columnsPerYield = step(LADDERS.columnsPerYield, CALIBRATION.columnsPerYield, LADDERS.columnsPerYield[0]); why.columnsPerYield = `${laying.length} slow minutes while laying`; }
  else if (low.length === 0 && chunks.length >= TARGET.evidence && isFinite(ms) && ((2 * CALIBRATION.radius + 1) ** 2 * ms) / 1000 > TARGET.ring) { next.columnsPerYield = step(LADDERS.columnsPerYield, CALIBRATION.columnsPerYield, LADDERS.columnsPerYield.at(-1)); why.columnsPerYield = "the frame rate held and the ring was slow: more a pause"; }
}

// ---- the sites: the laws checked in the game
const sites = of("site");
if (sites.length) {
  let holes = 0, wrong = 0, cols = 0, dark = [], lightN = 0, expected = 0, found = 0, home = 0;
  for (const s of sites) {
    holes += s.ground.holes; wrong += s.ground.wrongTop; cols += s.ground.cols; expected += s.folk.expected; found += s.folk.found; home += s.folk.nearHome;
    for (const [t, bl, sky] of s.light) { if (bl < 0) continue; lightN++; if (bl < 8 + CALIBRATION.litMargin && sky < 8) dark.push(`${t} (${bl})`); }   // given: vanilla's spawn-proof light, 8
  }
  say(`sites checked: ${sites.length}: ${sites.map((s) => s.name).join(", ")}`);
  say(`  the ground: ${cols} columns sampled, ${holes} holes, ${wrong} with another top than the sim's${holes ? "  << LAW: the layer and game/ground.js disagree: a bug" : ""}`);
  say(`  the folk: ${found} found of ${expected} expected, ${home} near home${expected && found < expected / PHI ? "  << fewer than they should be: spawning or despawning: a bug" : ""}`);
  if (lightN) {
    say(`  the light: ${lightN} folk spots read, ${dark.length} darker than the house law promises${dark.length ? `: ${dark.slice(0, 13).join(", ")}` : ""}`);
    if (dark.length >= Math.max(1, lightN / FIB[7])) { next.litMargin = step(LADDERS.litMargin, CALIBRATION.litMargin, LADDERS.litMargin.at(-1)); why.litMargin = `${dark.length} of ${lightN} folk spots under the house law's light`; }   // derived: more than one in 21 dark moves the margin a block
  } else say("  the light: not readable on this server (getLightLevel missing)");
}
const monsters = of("monster");
if (monsters.length) { say(`monsters where folk live: ${monsters.length} (${[...new Set(monsters.map((m) => m.id))].join(", ")}), light ${median(monsters.map((m) => m.light))}`); if (monsters.length >= TARGET.evidence) { next.litMargin = step(LADDERS.litMargin, CALIBRATION.litMargin, LADDERS.litMargin.at(-1)); why.litMargin = (why.litMargin ? why.litMargin + "; " : "") + `${monsters.length} monsters spawned in towns`; } }

// ---- the verdict
const moved = Object.keys(next).filter((k) => next[k] !== CALIBRATION[k]);
say("");
say(moved.length ? `the next rung: ${moved.map((k) => `${k} ${CALIBRATION[k]} -> ${next[k]} (${why[k]})`).join("; ")}` : "every knob holds: the game and the sim agree on what was measured (the loop has converged for this evidence)");
console.log(report.join("\n"));
if (args.includes("--apply") && moved.length) {
  const H = [...HISTORY, { at: new Date().toISOString().slice(0, 10), from: Object.fromEntries(moved.map((k) => [k, CALIBRATION[k]])), to: Object.fromEntries(moved.map((k) => [k, next[k]])), why: Object.fromEntries(moved.map((k) => [k, why[k]])) }];
  const src = fs.readFileSync(path.join(ROOT, "game/calibration.js"), "utf8");
  const out = src.replace(/export const CALIBRATION = \{[\s\S]*?\};/, `export const CALIBRATION = {\n  ${Object.entries(next).map(([k, v]) => `${k}: ${v}`).join(", ")},\n};`).replace(/export const HISTORY = \[[\s\S]*?\];/, `export const HISTORY = ${JSON.stringify(H, null, 2)};`);
  fs.writeFileSync(path.join(ROOT, "game/calibration.js"), out);
  console.log(`\nwritten to game/calibration.js (undo: the history's last "from")`);
}
