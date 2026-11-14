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
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
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
const t0 = Date.now();
await Promise.all(shares.filter((w) => w.keys.length).map((w, i) => new Promise((done) => {
  const p = spawn(process.execPath, [`--max-old-space-size=${heap}`, path.join(here, "bakegrown.mjs"), "--folk", folk, "--secs", "1e9", "--keys", w.keys.join(";")], { stdio: ["ignore", "pipe", "inherit"] });
  p.stdout.on("data", (b) => { for (const line of String(b).split("\n")) if (line.trim()) console.log(`[${i}] ${line}`); });
  p.on("exit", (code) => { console.log(`[${i}] done (${code === 0 ? "ok" : `exit ${code}`}) at ${Math.round((Date.now() - t0) / 1000)} s`); done(); });
})));
console.log(`all grown in ${Math.round((Date.now() - t0) / 1000)} s; bake with node tools/buildmod.mjs`);
