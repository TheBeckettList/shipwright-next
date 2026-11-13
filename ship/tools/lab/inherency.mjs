// The inherency lens: every number in the scripts should be one of three kinds (world/limits.js):
// a given (Minecraft's), a vision number (ours, in vision.js or BUDGET), or derived by a law. This
// lists the rest: number literals outside limits.js, vision.js, laws.js and the config tables, other
// than 0, 1, 2 and 0.5, on lines not tagged `// given:` or `// vision:`. A measuring instrument (a
// file whose first line says `// inherency: instrument`, like the probe) is exempt: its numbers are
// how it measures, not what the world is.
//
//   node tools/lab/inherency.mjs [--files]       the count, the files with the most, [every file]
//
// The count is a ratchet (tests/inherency.json): it may fall, never rise. Each phase drives it down.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPTS = path.join(root, "BP/scripts");
const HOME = new Set(["world/limits.js", "world/vision.js", "laws.js"]);   // where the kinds live
const FREE = new Set([0, 1, 2, 0.5]);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith(".js")) out.push(p);
  }
  return out;
}

/** A source's code with comments, strings and templates blanked (line breaks kept). */
export function codeOf(src) {
  let out = "", i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") out += "\n"; i++; } i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      i++;
      while (i < n && src[i] !== c) { if (src[i] === "\\") i++; else if (src[i] === "\n") out += "\n"; i++; }
      i++; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}

/** The free numbers in one file: [{ line, value }]. */
export function freeNumbers(src) {
  const lines = src.split("\n");
  const code = codeOf(src).split("\n");
  const found = [];
  code.forEach((line, k) => {
    if (/\/\/\s*(given|vision):/.test(lines[k] ?? "")) return;
    for (const m of line.matchAll(/(?<![\w$.])(\d+\.?\d*(?:e[-+]?\d+)?|\.\d+)(?![\w$])/gi)) {
      const v = Number(m[1]);
      if (!FREE.has(v)) found.push({ line: k + 1, value: v });
    }
  });
  return found;
}

export function inherency() {
  const byFile = {};
  let total = 0;
  for (const f of walk(SCRIPTS)) {
    const rel = path.relative(SCRIPTS, f).split(path.sep).join("/");
    if (HOME.has(rel) || rel.startsWith("config/")) continue;
    const src = readFileSync(f, "utf8");
    if (/^\/\/ inherency: instrument/.test(src)) continue;
    const n = freeNumbers(src).length;
    if (n) byFile[rel] = n;
    total += n;
  }
  return { total, byFile };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = inherency();
  const files = Object.entries(r.byFile).sort((a, b) => b[1] - a[1]);
  console.log(`Free numbers: ${r.total} in ${files.length} files`);
  for (const [f, n] of process.argv.includes("--files") ? files : files.slice(0, 12)) console.log(`  ${String(n).padStart(5)}  ${f}`);
}
