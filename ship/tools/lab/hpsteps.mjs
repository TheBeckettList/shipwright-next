// Times the homeport job's steps (run under QuickJS: node tools/lab/qjs.mjs tools/lab/hpsteps.mjs).
import { homeportSteps } from "../../BP/scripts/world/homeport.js";
const g = homeportSteps(12345);
const big = []; let n = 0, total = 0;
for (;;) { const t = Date.now(); const r = g.next(); const ms = Date.now() - t; total += ms; if (ms > 40) big.push([n, ms]); n++; if (r.done) break; }
console.log(JSON.stringify({ steps: n, total, big: big.slice(0, 20) }));
