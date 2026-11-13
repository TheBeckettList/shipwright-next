// The probe's yardstick: times the probe's fixed piece of math (probe.js work()) here, so REF_MS
// in probe.js can be checked, and under QuickJS, so the probe's kappa can be compared with ours.
//
//   node --import ./tests/mocks/register.mjs tools/lab/probelab.mjs        (Node: REF_MS)
//   node tools/lab/qjs.mjs tools/lab/probelab.mjs                          (QuickJS)
import { work } from "../../BP/scripts/probe.js";
const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
let best = Infinity;
for (let k = 0; k < 20; k++) { const a = clock(); work(); best = Math.min(best, clock() - a); }
globalThis.RESULT = JSON.stringify({ workMs: +best.toFixed(3) });
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("probelab.mjs")) console.log(globalThis.RESULT);
