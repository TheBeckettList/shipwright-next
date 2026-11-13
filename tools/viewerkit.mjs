// inherency: instrument
// The world viewer's pieces in the pack's own textures, for one release (after tools/worldviewer.mjs):
//   blocks   Thera in 3D (thera3d.bin/.json, from tools/modtest/vox.mjs) gets an atlas of the very tiles the pack is
//            made from (world/textures.js tileOf, as tools/maketextures.mjs draws them), each block's top, side and
//            bottom, in the sim's own colours (the pack greys leaves and grass for the game to tint; the sim's tiles
//            are already the colour it means); water alone is tinted, by its block colour
//   boats    every boat with each face's place on its sheet (ship/tools/boatexport.py --uv) and the sheets themselves
//            (ship/RP/textures/entity/shipwright), so the viewer draws them in the game's own wood, marble and cloth
//   dev      the project's state for the viewer's Development panel, read from handover/: the stages and their
//            plans, the issues, the priorities, the log, the math feed
//   node tools/viewerkit.mjs [version]        -> viewer/<version>/ (blocks.png, thera3d.png, thera3d.json updated, boats3d.json,
//                                                tex/*.png, dev.json)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { encode } from "./png.js";
import { tileOf, facesOf, TEXTURE } from "../world/textures.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2] ?? fs.readFileSync(path.join(ROOT, "mod/scripts/main.js"), "utf8").match(/VERSION = "([^"]+)"/)[1];
const OUT = path.join(ROOT, "viewer", version);
const say = (s) => console.log(`viewerkit ${version}: ${s}`);

// ---- blocks: an atlas of the pack's own tiles for Thera in 3D
{
  const metaFile = path.join(OUT, "thera3d.json");
  if (!fs.existsSync(metaFile)) say("no thera3d.json (run tools/modtest/vox.mjs first): blocks skipped");
  else {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8")), N = TEXTURE.N, COLS = 16;
    const TINTED = (id) => id === "minecraft:water";
    const tiles = [], seen = new Map();
    const add = (rgb) => { const k = Buffer.from(rgb).toString("base64"); if (!seen.has(k)) { seen.set(k, tiles.length); tiles.push(rgb); } return seen.get(k); };
    const tex = [], tint = [];
    for (const id of meta.names) {
      let faces; try { faces = facesOf(id) ?? ["side"]; } catch { faces = ["side"]; }
      const of = (face) => { const f = faces.includes(face) ? face : "side"; try { return add(tileOf(id, 0, f, 0).rgb); } catch { return -1; } };
      tex.push([of("top"), of("side"), of("bottom")]);
      tint.push(TINTED(id) ? 1 : 0);
    }
    const rows = Math.ceil(tiles.length / COLS), img = new Uint8Array(COLS * N * rows * N * 3);
    tiles.forEach((rgb, k) => { const ox = (k % COLS) * N, oy = Math.floor(k / COLS) * N;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) img.set(rgb.subarray((y * N + x) * 3, (y * N + x) * 3 + 3), ((oy + y) * COLS * N + ox + x) * 3); });
    fs.writeFileSync(path.join(OUT, "blocks.png"), encode(COLS * N, rows * N, img, 3));
    // the block records themselves, packed byte for byte into an RGB picture (the artifact host serves pictures, and
    // a PNG is the smaller download); the page reads them back with colour conversion off
    const raw = fs.readFileSync(path.join(OUT, "thera3d.bin")), PW = 2048, PH = Math.ceil(raw.length / 3 / PW), px = new Uint8Array(PW * PH * 3); px.set(raw);
    fs.writeFileSync(path.join(OUT, "thera3d.png"), encode(PW, PH, px, 3));
    Object.assign(meta, { tex, tint, atlas: { file: "blocks.png", cols: COLS, rows, tile: N }, packed: { file: "thera3d.png", bytes: raw.length } });
    fs.writeFileSync(metaFile, JSON.stringify(meta));
    say(`blocks: ${tiles.length} tiles for ${meta.names.length} kinds (${tint.filter(Boolean).length} tinted)`);
  }
}

// ---- boats: the faces on their sheets, and the sheets
{
  const file = path.join(OUT, "boats3d.json");
  execSync(`python3 ship/tools/boatexport.py --uv "${file}"`, { cwd: ROOT, stdio: "ignore" });
  const B = JSON.parse(fs.readFileSync(file, "utf8")), sheets = new Set();
  for (const [k, b] of Object.entries(B)) if (k[0] !== "_") for (const s of Object.values(b.sheets)) sheets.add(s);
  // every wood and cloth, so a boat can be shown in any of them
  const SRC = path.join(ROOT, "ship/RP/textures/entity/shipwright"), TX = path.join(OUT, "tex"); fs.mkdirSync(TX, { recursive: true });
  for (const f of fs.readdirSync(SRC)) if (/^(hull|sail)_.*\.png$/.test(f)) fs.copyFileSync(path.join(SRC, f), path.join(TX, f));
  B._sheets = fs.readdirSync(TX).map((f) => f.replace(/\.png$/, "")).sort();
  fs.writeFileSync(file, JSON.stringify(B));
  say(`boats: ${Object.keys(B).filter((k) => k[0] !== "_").length} boats on ${sheets.size} default sheets, ${B._sheets.length} sheets in all`);
}

// ---- dev: the project's state, from handover/
{
  const H = path.join(ROOT, "handover"), read = (f) => (fs.existsSync(path.join(H, f)) ? fs.readFileSync(path.join(H, f), "utf8") : "");
  const strip = (s) => s.replace(/\*\*|~~|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
  const table = (md) => md.split("\n").filter((l) => /^\|\s*[A-Z]+-\d+/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  const issues = table(read("ISSUES.md")).map(([id, sev, status, found, text]) => ({ id, sev, status: strip(status), found, title: strip((text.match(/^\*\*(.+?)\*\*/) ?? [, text.split(". ")[0]])[1]), text: strip(text) }));
  const stages = fs.readdirSync(path.join(H, "stages")).filter((f) => /^S\d{3}-\d{4}-\d\d-\d\d-\w+\.md$/.test(f)).sort().map((f) => {
    const md = read(`stages/${f}`), title = (md.match(/^# (.+)$/m) ?? [, f])[1];
    const sec = (n) => (md.split(new RegExp(`^## ${n}\\.`, "m"))[1] ?? "").split(/^## /m)[0];
    const plan = [...sec(2).matchAll(/^- \[( |x)\] (.+)$/gm)].map(([, x, t]) => ({ done: x === "x", text: strip(t) }));
    const cell = (k) => strip((md.match(new RegExp(`^\\| ${k} \\| (.+?) \\|$`, "m")) ?? [, ""])[1]);
    return { file: f, id: f.slice(0, 4), who: f.match(/-(\w+)\.md$/)[1], title: title.replace(/^S\d{3} — /, ""), dates: cell("Dates"), from: cell("Started from"), ended: cell("Ended on"), plan };
  });
  const state = read("STATE.md"), prio = (state.split(/^## Open, in priority order/m)[1] ?? "").split(/^## /m)[0];
  const priorities = [...prio.matchAll(/^\d+\. (.+)$/gm)].map(([, t]) => strip(t));
  const log = read("LOG.md").split("\n").filter((l) => /^\|\s*\[?S\d{3}/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => strip(c)));
  const feed = table(read("math-feed/INDEX.md").replace(/^\| \[(MF-\d+)\]\([^)]+\)/gm, "| $1")).map(([id, date, src, impact, head, acted]) => ({ id, date, src, impact: strip(impact), head: strip(head), acted: strip(acted ?? "") }));
  const decisions = [...read("DECISIONS.md").matchAll(/^## (D-\d+) — (.+?)\s+\((.+?)\)$/gm)].map(([, id, title, meta]) => ({ id, title: strip(title), status: strip(meta.split("·")[0]) }));
  const git = (c) => { try { return execSync(`git ${c}`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
  const commits = git("log -25 --format=%h%x09%ad%x09%s --date=short").split("\n").filter(Boolean).map((l) => l.split("\t"));
  fs.writeFileSync(path.join(OUT, "dev.json"), JSON.stringify({ version, built: new Date().toISOString(), branch: git("rev-parse --abbrev-ref HEAD"), stages, issues, priorities, log, feed, decisions, commits }));
  say(`dev: ${stages.length} stages, ${issues.length} issues (${issues.filter((i) => !/closed/.test(i.status)).length} open), ${commits.length} commits`);
}
