// Runs a lab inside QuickJS, the engine the game runs scripts in, instead of Node: bundles it (with
// the test world standing in for @minecraft/server) and evaluates it, so its timings are the game's
// kind of timings. The lab leaves its findings in globalThis.RESULT.
//
//   node tools/lab/qjs.mjs tools/lab/mcsim.mjs [args for the lab...]
import { build } from "esbuild";
import { getQuickJS } from "quickjs-emscripten";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

export async function runInQuickJS(entry, args = []) {
  const out = await build({
    entryPoints: [path.resolve(entry)], bundle: true, write: false, format: "iife", platform: "neutral",
    alias: { "@minecraft/server": path.join(root, "tests/mocks/server.mjs"), "@minecraft/server-ui": path.join(root, "tests/mocks/server-ui.mjs") },
    banner: { js: `globalThis.SIM_ARGS = ${JSON.stringify(args)};` },
    logLevel: "error",
  });
  const code = out.outputFiles[0].text;
  const QJS = await getQuickJS();
  const vm = QJS.newContext();
  vm.runtime.setMemoryLimit(1024 * 1024 * 1024);
  vm.runtime.setMaxStackSize(0);
  // the game's console: warnings and logs come out here
  const con = vm.newObject();
  for (const k of ["log", "warn", "error"]) {
    const fn = vm.newFunction(k, (...a) => { console.log(`[qjs ${k}]`, ...a.map((h) => vm.dump(h))); });
    vm.setProp(con, k, fn);
    fn.dispose();
  }
  vm.setProp(vm.global, "console", con);
  con.dispose();
  const t = Date.now();
  const r = vm.evalCode(code, "lab.js");
  let result = null, error = null;
  if (r.error) {
    const m = vm.getProp(r.error, "message"), st = vm.getProp(r.error, "stack");
    error = `${vm.dump(m)}\n${vm.dump(st)}`;
    m.dispose(); st.dispose(); r.error.dispose();
  } else {
    r.value.dispose();
    const res = vm.getProp(vm.global, "RESULT");
    result = vm.dump(res);
    res.dispose();
  }
  vm.dispose();
  return { result: result ? JSON.parse(result) : null, error, seconds: (Date.now() - t) / 1000 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [entry, ...args] = process.argv.slice(2);
  const { result, error, seconds } = await runInQuickJS(entry, args);
  if (error) { console.log("error:", error); process.exitCode = 2; }
  else { console.log(JSON.stringify(result, null, 1)); console.log(`(QuickJS, ${seconds.toFixed(0)} s)`); process.exitCode = result?.issues?.length ? 1 : 0; }
}
