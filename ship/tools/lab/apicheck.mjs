// The API lens: every call the pack makes into the game, checked against the game's own API.
//
// Microsoft publishes @minecraft/server's typings for each version. This type-checks BP/scripts
// against the typings of exactly the version the manifest asks for (BP/manifest.json, or tools/buildmod.mjs which writes it) (pinned in package.json),
// and keeps only what bears on the game: a member that doesn't exist on a game object, a call with
// the wrong number of arguments, an event that isn't there. (Our own plain objects aren't typed,
// so the rest of TypeScript's opinions are left out.) Every listed module must also match the
// manifest's version.
//
//   node tools/lab/apicheck.mjs           the findings, and whether they're over the ratchet
// The count is a ratchet (tests/apicheck.json), like the inherency lens: it may fall, never rise.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
// game objects: a finding about one of these is about the game's API
const GAME = /type '(typeof )?(World|System|Dimension|Entity|Player|Block|BlockPermutation|ItemStack|Container|ScreenDisplay|ItemType|BlockVolume|WorldAfterEvents|WorldBeforeEvents|SystemAfterEvents|SystemBeforeEvents|[A-Z][A-Za-z]*(Component|Event|EventSignal|Registry))'/;
const KEEP = new Set([2339, 2551, 2554, 2555, 2305, 2724]);   // given: TypeScript's codes for a missing member, a misspelt one, the wrong argument count, a missing export

export function apiCheck() {
  const issues = [], findings = [];
  // In the merged tree (shipwright-next) the bake writes the manifest, so its module versions are read from
  // tools/buildmod.mjs, where they're written; a standalone ship pack still has its own BP/manifest.json.
  const own = path.join(root, "BP/manifest.json"), bake = path.join(root, "../tools/buildmod.mjs");
  const manifest = existsSync(own) ? JSON.parse(readFileSync(own, "utf8"))
    : { dependencies: [...readFileSync(bake, "utf8").matchAll(/module_name: "([^"]+)", version: "([^"]+)"/g)].map(([, module_name, version]) => ({ module_name, version })) };
  for (const dep of manifest.dependencies.filter((d) => d.module_name)) {
    let have = null;
    try { have = JSON.parse(readFileSync(require.resolve(`${dep.module_name}/package.json`), "utf8")).version; } catch { /* missing */ }
    if (!have) issues.push(`${dep.module_name} typings aren't installed (npm install)`);
    else if (have !== dep.version) issues.push(`${dep.module_name}: the manifest asks for ${dep.version}, the typings are ${have}`);
  }
  if (issues.length) return { issues, findings, count: null };
  const ts = require("typescript");
  const files = [];
  const walk = (d) => { for (const f of require("node:fs").readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith(".js")) files.push(p); } };
  walk(path.join(root, "BP/scripts"));
  const program = ts.createProgram(files, { allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: false, noImplicitAny: false, skipLibCheck: true, lib: ["lib.es2022.d.ts"], types: [] });
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (!d.file || !KEEP.has(d.code)) continue;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
    if (!GAME.test(msg) && d.code !== 2305) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    findings.push({ file: path.relative(root, d.file.fileName), line: line + 1, code: d.code, msg });
  }
  return { issues, findings, count: findings.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = apiCheck();
  for (const i of r.issues) console.log("issue:", i);
  for (const f of r.findings) console.log(`${f.file}:${f.line}  ${f.msg}`);
  const ratchet = existsSync(path.join(root, "tests/apicheck.json")) ? JSON.parse(readFileSync(path.join(root, "tests/apicheck.json"), "utf8")).total : null;
  console.log(`\nGame API findings: ${r.count}${ratchet != null ? ` (ratchet ${ratchet})` : ""}`);
}
