// The boot lab: does the pack load, and does it run, the way the game loads and runs it?
//
// Runs under QuickJS (node tools/lab/qjs.mjs tools/lab/bootlab.mjs), with the whole pack bundled from
// main.js as the game bundles it, against a strict test world (bootguard.mjs):
//   1. early execution: main.js and every module it imports run before the world exists; any world
//      call then is a load failure (the game would refuse the pack)
//   2. startup: the startup event fires (the sea world registers its dimension)
//   3. the world loads: every system's timers and jobs run for a while, a player joins and is brought
//      into the sea world, and every scriptevent the pack answers is sent once
// Any error thrown anywhere, a system that didn't start, or a Shipwright warning that says something
// failed is an issue. RESULT: { issues, started, warnings, ... }.
import { boot } from "./bootguard.mjs";
import "../../BP/scripts/main.js";
import { world, system, makePlayer, __handlers } from "@minecraft/server";
import { bootReport } from "../../BP/scripts/boot.js";
import { homeportIfReady } from "../../BP/scripts/world/homeport.js";

const ARGS = globalThis.SIM_ARGS ?? [];
const TICKS = Number(ARGS[ARGS.indexOf("--ticks") + 1]) || 600;
const issues = [];
const guard = (label, f) => { try { f(); } catch (e) { boot.errors.push(`${label}: ${e?.message ?? e}`); } };

// 1. early execution happened during the imports above
if (boot.early_calls.length) issues.push(`the world was read during early execution (${[...new Set(boot.early_calls)].join(" | ")}): the game would refuse the pack`);

// 2. startup
const registered = [];
guard("startup", () => __handlers.startup?.({ dimensionRegistry: { registerCustomDimension: (id) => registered.push(id) }, blockComponentRegistry: { registerCustomComponent() {} }, itemComponentRegistry: { registerCustomComponent() {} } }));
boot.early = false;

// 3. the world runs
system.manualJobs = true;
const dim = world.getDimension("minecraft:overworld");
const p = makePlayer(dim);
p.addEffect = () => {}; p.runCommand = () => ({}); p.onScreenDisplay = { setTitle() {} };
p.teleport = (at, o) => { p.location = { ...at }; if (o?.dimension) p.dimension = o.dimension; };
world.players = [p];
for (let t = 1; t <= TICKS; t++) {
  system.currentTick = t;
  if (t === 20) guard("playerSpawn", () => __handlers.playerSpawn?.({ player: p, initialSpawn: true }));
  for (const iv of [...system.intervals]) if (t % iv.every === 0) guard(`a timer every ${iv.every} ticks`, iv.f);
  for (const to of system.timeouts.filter((x) => x.at === t)) guard("a timeout", to.f);
  const t0 = Date.now();
  while (system.jobs.length && Date.now() - t0 < 10) {
    let r;
    try { r = system.jobs[0].next(); } catch (e) { boot.errors.push(`a job: ${e?.message ?? e}`); system.jobs.shift(); continue; }
    if (r.done) system.jobs.shift();
  }
}
// every scriptevent the pack answers, once, with no argument and from a player
for (const id of ["shipwright:probe", "shipwright:mode", "shipwright:pregen", "shipwright:seaworld", "shipwright:check"]) guard(`/scriptevent ${id}`, () => __handlers.scriptevent?.({ id, message: "", sourceEntity: p }));

const report = bootReport();
for (const s of report.failed) issues.push(`${s.name} failed to start: ${s.error}`);
for (const e of boot.errors) issues.push(e);
for (const w of boot.warnings) if (/\[Shipwright\].*(fail|error|couldn't|can't|refus)/i.test(w) && !/probe/i.test(w)) issues.push(`warning: ${w}`);
if (!registered.includes("shipwright:sea")) issues.push("the sea world's dimension was never registered at startup");
if (p.dimension?.id !== "shipwright:sea") issues.push(`the joining player never reached the sea world (still in ${p.dimension?.id})`);
globalThis.RESULT = JSON.stringify({ issues, portReady: !!homeportIfReady(Number(world.getDynamicProperty("shipwright:seed"))), jobsLeft: system.jobs.length, messages: p.messages.slice(0, 6), started: report.started, failed: report.failed.map((s) => s.name), ticks: TICKS, where: p.dimension?.id, warnings: boot.warnings.length });
