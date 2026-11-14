// inherency: instrument
// Grows the settlements on every core (tools/bakegrown.mjs, one worker process a core): the stale or new ones among
// the chosen, shared out by their cost, biggest first to the least-loaded worker (a settlement's grow grows faster
// than its folk: the 4,625-folk city took 0.80 s a head where towns of a few hundred take 0.39, so a settlement's
// cost is reckoned as folk^1.3). Each worker writes its own files (lab/grown/<key>.json), so nothing is shared but the
// list. Run it where there are cores: an Apple-silicon laptop's performance cores each grow about as fast as one
// here, or faster, and there are many of them.
//   node tools/growall.mjs [--folk 8000] [--workers n] [--heap 4096] [--dry]
//   --folk     the budget bakegrown chooses by (nearest Thera first); 1e9 for every settlement in the world
//   --workers  default: the machine's cores less one
//   --heap     MB of heap a worker (the 4,625-folk city needed about 2.6 GB)
//   --olympus  the path of an olympus worktree (git worktree add ../olympus-hall olympus): the run checks in there as the
//              Grower at its milestones, each eighth of its cost grown (a breath of eight), then once at its end, a
//              tablet a milestone, each answering the last, committed and pushed (pulled and retried if the hall moved)
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chosen, fileOf, sourceHash } from "./bakegrown.mjs";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const here = path.dirname(fileURLToPath(import.meta.url)), folk = arg("folk", "8000"), heap = arg("heap", "4096");
const workers = Math.max(1, Number(arg("workers", Math.max(1, (os.availableParallelism?.() ?? os.cpus().length) - 1))));
const hash = sourceHash(), all = await chosen(Number(folk));
const todo = all.filter(({ s }) => !fs.existsSync(fileOf(s.key)) || JSON.parse(fs.readFileSync(fileOf(s.key), "utf8")).hash !== hash)
  .map(({ s }) => ({ key: s.key, folk: s.folk, cost: s.folk ** 1.3 })).sort((a, b) => b.cost - a.cost);   // vision: the cost's exponent, from the city's 0.80 s a head against the towns' 0.39
const shares = Array.from({ length: workers }, () => ({ keys: [], cost: 0, folk: 0 }));
for (const t of todo) { const w = shares.reduce((m, x) => (x.cost < m.cost ? x : m)); w.keys.push(t.key); w.cost += t.cost; w.folk += t.folk; }   // the biggest first to the least loaded
console.log(`${all.length} chosen, ${todo.length} to grow (${todo.reduce((a, t) => a + t.folk, 0)} folk) on ${workers} workers; the biggest: ${todo.slice(0, 4).map((t) => `${t.key} (${Math.round(t.folk)})`).join(", ")}`);
for (const [i, w] of shares.entries()) if (w.keys.length) console.log(`  worker ${i}: ${w.keys.length} settlements, ${Math.round(w.folk)} folk`);
if (process.argv.includes("--dry") || !todo.length) process.exit(0);
const t0 = Date.now(), hall = arg("olympus", null), total = todo.reduce((a, t) => a + t.cost, 0), costOf = new Map(todo.map((t) => [t.key, t]));
let grownCost = 0, grownFolk = 0, grownN = 0, nextMark = 1, lastTablet = null; const MARKS = 8;   // derived: a milestone each eighth, the breath
const host = `${os.hostname()} (${os.cpus()[0]?.model ?? "?"}, ${workers} workers)`;
function checkIn(final = false) {   // a tablet on Olympus from the Grower, committed and pushed
  if (!hall) return;
  const secs = Math.round((Date.now() - t0) / 1000), body = `${final ? "Done" : `Milestone ${nextMark - 1} of ${MARKS}`}: ${grownN} of ${todo.length} settlements grown, ${Math.round(grownFolk)} folk, in ${secs} s on ${host}.\n\nSources ${hash}; ${final ? "bake with node tools/buildmod.mjs and commit lab/grown/." : `about ${Math.round((secs * (total - grownCost)) / Math.max(1, grownCost))} s left by the cost reckoning (folk^1.3).`}\n`;
  const f = path.join(os.tmpdir(), `growall-${process.pid}.md`); fs.writeFileSync(f, body);
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: hall, encoding: "utf8" }).trim();
  try {
    run("git", ["pull", "-q", "--rebase"]);
    const out = run(process.execPath, ["olympus/olympus.mjs", "speak", "--god", "grower", ...(lastTablet ? ["--answers", lastTablet] : []), "--title", final ? `The grow is done: ${grownN} settlements` : `Growing: ${nextMark - 1} of ${MARKS}`, "--refs", `growall@${hash}`, "--body", f]);
    lastTablet = path.basename(out.split("\n").pop(), ".md");
    run("git", ["add", "olympus/agora"]); run("git", ["commit", "-q", "-m", `Olympus: the Grower checks in (growall, ${grownN}/${todo.length})`]);
    for (let k = 0; k < 3; k++) { try { run("git", ["push", "-q"]); break; } catch { run("git", ["pull", "-q", "--rebase"]); } }   // vision: three tries
    console.log(`checked in on Olympus: ${lastTablet}`);
  } catch (e) { console.log(`could not check in on Olympus: ${String(e.message).split("\n")[0]}`); }
}
const grew = (key) => { const t = costOf.get(key); if (!t) return; grownCost += t.cost; grownFolk += t.folk; grownN++; while (nextMark < MARKS && grownCost >= (total * nextMark) / MARKS) { nextMark++; checkIn(); } };
await Promise.all(shares.filter((w) => w.keys.length).map((w, i) => new Promise((done) => {
  const p = spawn(process.execPath, [`--max-old-space-size=${heap}`, path.join(here, "bakegrown.mjs"), "--folk", folk, "--secs", "1e9", "--keys", w.keys.join(";")], { stdio: ["ignore", "pipe", "inherit"] });
  p.stdout.on("data", (b) => { for (const line of String(b).split("\n")) if (line.trim()) { console.log(`[${i}] ${line}`); const k = /^(\S+) \S+ \d+ folk/.exec(line); if (k) grew(k[1]); } });
  p.on("exit", (code) => { console.log(`[${i}] done (${code === 0 ? "ok" : `exit ${code}`}) at ${Math.round((Date.now() - t0) / 1000)} s`); done(); });
})));
console.log(`all grown in ${Math.round((Date.now() - t0) / 1000)} s; bake with node tools/buildmod.mjs`);
checkIn(true);
