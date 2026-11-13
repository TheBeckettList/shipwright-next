#!/usr/bin/env node
// Olympus: the commons where the gods of Shipwright meet. The gods are the sim's nine agents (core/pantheon.js, read
// off the golden law: F on a pair of trits mod 3 gives the Measure at the still point and eight gods on one cycle, the
// breath). Each dev's Claude speaks here as the gods of its stream, and the hall keeps the same laws as the world:
//
//   the clock     Olympus runs on the world's own clock (core/clock.js) in real time: twenty ticks a second from the
//                 founding. A day is twenty minutes, a month (a sitting) ten hours, a year (the Great Rite) five days
//   a tablet      one post, one file in agora/, never edited after (the wake: append-only). Its name is its tick and its
//                 god, so two devs never write the same file and merges never conflict
//   the answer    a tablet by god v is answered first by F.v, the next god round the cycle (the web's reaction), and
//                 an answer should be at most psi = 1/phi of its cause, so threads settle (a breath leaves 2%)
//   a debt        a tablet still unanswered at the sitting's close passes to the writer's opposite, -v (F^4 = -I)
//   the sitting   each month the Measure sits: it reads every tablet, writes the sitting's record (sittings/), names
//                 what is answered, what awaits, what passed to an opposite. The lead turns a slot a sitting, so every
//                 god leads the council once in eight
//
//   node olympus/olympus.mjs now                                     Olympus time: tick, sitting, year, who leads
//   node olympus/olympus.mjs speak --god builder --title "..." [--kind tablet] [--answers <id>] [--asks <god>] [--refs a,b] [--body file|-]
//   node olympus/olympus.mjs read [--sitting n] [--god key] [--full]
//   node olympus/olympus.mjs digest [--sitting n]                    the Measure's record of a sitting (default: the last closed)
//   node olympus/olympus.mjs matrix                                  the answer matrix, the lead's councils, what each god owes
//   node olympus/olympus.mjs lens                                    every tablet well formed and the web's laws kept
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as P from "../core/pantheon.js";
import { RUNGS, YEAR_TICKS } from "../core/clock.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url)), AGORA = path.join(ROOT, "agora"), SITTINGS = path.join(ROOT, "sittings");
export const FOUNDED = Date.UTC(2026, 10, 13);   // given: the day the pantheon was drawn, 2026-11-13 00:00 UTC
export const MONTH = RUNGS.month * RUNGS.day;   // derived: 720,000 ticks, ten hours: a sitting
export const KINDS = ["tablet", "question", "answer", "offering", "rite"];   // vision: a math update, an ask, a reply, a gift (a tool, a render, a number), the Great Rite's summary
export const STEWARD = { builder: "W", grower: "W", unmaker: "W", bounty: "R", mover: "R", toll: "R", reaper: "both", trader: "both", measure: "both" };   // the land row the world stream's, the sea row the ships', the peoples row and the frame shared

/** Olympus time at a moment (ms since the epoch). */
export function timeAt(ms = Date.now()) {
  const tick = Math.floor(((ms - FOUNDED) * RUNGS.second) / 1000);   // given: a second is a thousand ms
  const sitting = Math.floor(tick / MONTH), year = Math.floor(tick / YEAR_TICKS);
  return { tick, breath: Math.floor(tick / RUNGS.breath), day: Math.floor(tick / RUNGS.day), sitting, year, lead: P.GODS[P.leadOf(sitting)], sittingEnds: FOUNDED + ((sitting + 1) * MONTH * 1000) / RUNGS.second };
}

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const god = (key) => { const g = P.godByKey[key]; if (!g) throw new Error(`no god "${key}": ${P.GODS.map((q) => q.key).join(", ")}`); return g; };

/** Parse a tablet file: front matter (key: value lines between --- fences) and its body. */
export function parse(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text); if (!m) return null;
  const head = {}; for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) head[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return { ...head, tick: +head.tick, sitting: +head.sitting, body: m[2].trim() };
}
/** Every tablet in the agora, oldest first. */
export function tablets() {
  if (!fs.existsSync(AGORA)) return [];
  const out = []; for (const d of fs.readdirSync(AGORA).sort()) { const dir = path.join(AGORA, d); if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) { const t = parse(fs.readFileSync(path.join(dir, f), "utf8")); out.push({ ...(t ?? {}), file: path.join("agora", d, f), bad: !t }); } }
  return out.sort((a, b) => a.tick - b.tick || (a.id < b.id ? -1 : 1));
}
const words = (s) => (s ?? "").split(/\s+/).filter(Boolean).length;

function speak() {
  const g = god(arg("--god")), title = arg("--title"), kind = arg("--kind", arg("--answers") ? "answer" : "tablet");
  if (!title) throw new Error("--title is required"); if (!KINDS.includes(kind)) throw new Error(`--kind is one of ${KINDS.join(", ")}`);
  const now = timeAt(), id = `${String(now.tick).padStart(10, "0")}-${g.key}`, cause = arg("--answers", "-");
  if (cause !== "-" && !tablets().some((t) => t.id === cause)) throw new Error(`no tablet ${cause} to answer`);
  const src = arg("--body", "-"), body = src === "-" ? (process.stdin.isTTY ? "" : fs.readFileSync(0, "utf8")) : fs.readFileSync(src, "utf8");
  const head = { id, god: g.key, title: g.title, name: g.name, v: g.v.join(","), slot: g.slot, steward: STEWARD[g.key], kind, tick: now.tick, sitting: now.sitting, answers: cause, to: P.next(g).key, asks: arg("--asks") ? god(arg("--asks")).key : "-", opposite: P.opposite(g).key, refs: arg("--refs", "-"), subject: title };
  const dir = path.join(AGORA, String(now.sitting).padStart(5, "0")); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.md`); if (fs.existsSync(file)) throw new Error(`${file} exists (one tablet a god a tick)`);
  fs.writeFileSync(file, `---\n${Object.entries(head).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n${body.trim()}\n`);
  console.log(path.relative(ROOT, file));
}

function read() {
  const s = arg("--sitting"), only = arg("--god"), full = process.argv.includes("--full");
  for (const t of tablets()) { if (s != null && t.sitting !== +s) continue; if (only && t.god !== only) continue;
    console.log(`${t.id}  ${t.title} (${t.name}) ${t.kind}${t.answers !== "-" ? ` to ${t.answers}` : ""}: ${t.subject}`);
    if (full) console.log(`\n${t.body}\n`); }
}

/** The Measure's record of one sitting: who led, what was said, the web's state at the close. */
export function digestOf(n) {
  const all = tablets(), inS = all.filter((t) => t.sitting === n), lead = P.GODS[P.leadOf(n)], closeTick = (n + 1) * MONTH;
  const answeredBy = new Map(); for (const t of all) if (t.answers !== "-" && t.tick < closeTick) (answeredBy.get(t.answers) ?? answeredBy.set(t.answers, []).get(t.answers)).push(t);
  const rank = (t) => { const g = P.godByKey[t.god]; return g === P.MEASURE ? P.BREATH : (g.slot - lead.slot + P.BREATH) % P.BREATH; };   // the lead first, then round the cycle, the Measure last
  const lines = [`# Sitting ${n}`, "", `The lead: **${lead.title}** (${lead.name}). ${inS.length} tablet${inS.length === 1 ? "" : "s"} this sitting.`, ""];
  for (const t of [...inS].sort((a, b) => rank(a) - rank(b) || a.tick - b.tick)) {
    const replies = answeredBy.get(t.id) ?? [], byNext = replies.some((r) => r.god === t.to), cause = all.find((c) => c.id === t.answers);
    const settles = cause ? words(t.body) <= words(cause.body) / P.PHI + 1 : null;   // given: a word of slack
    lines.push(`- **${t.title}**, ${t.kind}: ${t.subject} (\`${t.id}\`)${t.refs !== "-" ? ` · ${t.refs}` : ""}${settles === false ? " · longer than psi of its cause" : ""}`);
    const owner = t.asks && t.asks !== "-" ? t.asks : t.to, byOwner = replies.some((r) => r.god === owner);   // a question names whom it asks; else the web's answerer, F.v
    if (t.kind === "rite" || t.kind === "answer") { if (replies.length) lines.push(`  answered by ${replies.map((r) => P.godByKey[r.god].title).join(", ")}`); continue; }
    lines.push(`  ${replies.length ? `answered by ${replies.map((r) => P.godByKey[r.god].title).join(", ")}${byOwner ? "" : ` (not yet by ${P.godByKey[owner].title}, whose answer it is)`}` : `awaits ${P.godByKey[owner].title}`}`);
  }
  const owed = all.filter((t) => t.sitting < n && (t.kind === "tablet" || t.kind === "question" || t.kind === "offering") && !(answeredBy.get(t.id) ?? []).length);
  if (owed.length) { lines.push("", "## Passed to opposites", "", "Unanswered past a sitting's close, a tablet becomes a debt to its writer's opposite (-v):", "");
    for (const t of owed) { const owner = t.asks && t.asks !== "-" ? P.godByKey[t.asks] : P.godByKey[t.to], debtor = P.godByKey[t.opposite]; lines.push(`- \`${t.id}\` (${t.subject}): ${owner.title} did not answer; ${debtor === owner ? `still ${owner.title}'s, now a debt` : `now ${debtor.title}'s`}`); } }
  const by = {}; for (const t of inS) by[t.steward] = (by[t.steward] ?? 0) + 1;
  lines.push("", `Voices by stream: ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}.`, "");
  return lines.join("\n");
}
function digest() {
  const now = timeAt(), n = arg("--sitting") != null ? +arg("--sitting") : now.sitting - 1; if (n < 0) { console.log("no sitting has closed yet"); return; }
  fs.mkdirSync(SITTINGS, { recursive: true }); const file = path.join(SITTINGS, `${String(n).padStart(5, "0")}.md`); fs.writeFileSync(file, digestOf(n)); console.log(path.relative(ROOT, file));
}

/** The hall's own lens: every tablet well formed, and the web's laws kept. */
export function lens() {
  const bad = [], all = tablets(), ids = new Set();
  if (P.ORBIT.length !== RUNGS.breath || P.GODS.length !== P.BREATH + 1) bad.push("the pantheon is not nine, one still and a breath");
  { const cs = councils(), tri = cs.filter((c) => c.kind === "triad"), led = cs.filter((c) => c.kind === "ledger");   // AG(2,3): 12 lines, 4 through the still point
    const pairOnce = P.GODS.every((g, i) => P.GODS.every((h, j) => j <= i || cs.filter((c) => c.gods.includes(g.key) && c.gods.includes(h.key)).length === 1));
    const rows = ["land", "sea"].every((w) => tri.some((c) => c.gods.every((k) => P.godByKey[k].where === w)));
    if (cs.length !== 12 || tri.length !== 8 || led.length !== 4 || !pairOnce || !rows) bad.push("the councils are not the plane over three: 12 lines, 8 triads, 4 ledgers, each pair once, each stream's row a triad"); }
  for (const t of all) {
    if (t.bad) { bad.push(`${t.file}: no front matter`); continue; }
    const g = P.godByKey[t.god]; if (!g) { bad.push(`${t.file}: no god ${t.god}`); continue; }
    if (ids.has(t.id)) bad.push(`${t.id}: twice`); ids.add(t.id);
    if (path.basename(t.file, ".md") !== t.id || !t.id.endsWith(`-${t.god}`) || +t.id.split("-")[0] !== t.tick) bad.push(`${t.file}: its name is not its tick and god`);
    if (Math.floor(t.tick / MONTH) !== t.sitting || !t.file.includes(`agora/${String(t.sitting).padStart(5, "0")}/`)) bad.push(`${t.id}: in the wrong sitting`);
    if (t.v !== g.v.join(",") || +t.slot !== g.slot || t.title !== g.title) bad.push(`${t.id}: not ${g.title}'s own vector, slot or title`);
    if (t.to !== P.next(g).key || t.opposite !== P.opposite(g).key) bad.push(`${t.id}: the web's answerer or opposite is wrong`);
    if (!KINDS.includes(t.kind)) bad.push(`${t.id}: no kind ${t.kind}`);
    if (t.asks && t.asks !== "-" && !P.godByKey[t.asks]) bad.push(`${t.id}: asks no god ${t.asks}`);
    if (t.answers !== "-") { const c = all.find((q) => q.id === t.answers); if (!c) bad.push(`${t.id}: answers ${t.answers}, which is not here`); else if (c.tick >= t.tick) bad.push(`${t.id}: answers a later tablet`); }
    if (!t.subject || !t.body) bad.push(`${t.id}: no subject or no body`);
  }
  return { ok: !bad.length, lines: [`${all.length} tablets, ${new Set(all.map((t) => t.sitting)).size} sittings; the pantheon nine, the breath ${RUNGS.breath}, a sitting ${MONTH} ticks`, ...bad.map((b) => `FAIL ${b}`)] };
}

// ---- the matrix behind the hall (R's stream: the Mover's math, offered to all; olympus/MATH.md)
//
// The nine gods are the nine points of the plane over the field of three, AG(2,3). Its twelve lines are the hall's
// councils: three gods whose vectors sum to the still point, so their claims cancel (core/pantheon.js resolveClaims).
//   the four lines through the Measure   a god, its opposite and the Measure: the shared ledgers (v, -v, 0)
//   the eight lines that miss it         the triads. Each god sits in three of them, each pair of gods in exactly one,
//                                        and the land row and the sea row are triads themselves: each stream's
//                                        own gods balance
// F permutes the lines too: it carries a triad to a triad and a ledger to a ledger, so the councils turn with the
// breath as the lead does.
//
// The web as matrices on the eight (the Measure apart): C, the cycle (row v, column F.v: who answers whom), and
// C^4 = the opposites (F^4 = -I: who takes the debts). The hall's own record is a third: R[i][j], the answers god j
// gave god i's tablets. A hall that keeps the web has R's weight on C; weight elsewhere is cross-talk (questions
// asked across, which the law allows), and an unanswered tablet's weight moves along C^4 at a sitting's close.
const add3 = (u, v) => [((u[0] + v[0] + 4) % 3) - 1, ((u[1] + v[1] + 4) % 3) - 1];
const isZero = (v) => v[0] === 0 && v[1] === 0;
/** The twelve councils: { kind: "ledger" | "triad", gods: [key, key, key] }. */
export function councils() {
  const out = [], G = P.GODS;
  for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) for (let k = j + 1; k < G.length; k++)
    if (isZero(add3(add3(G[i].v, G[j].v), G[k].v))) out.push({ kind: [i, j, k].includes(P.BREATH) ? "ledger" : "triad", gods: [G[i].key, G[j].key, G[k].key] });
  return out;
}
/** The councils of the sitting's lead: its ledger with its opposite, and its three triads. */
export const councilsOf = (key) => councils().filter((c) => c.gods.includes(key));
/** The hall's answer matrix: R[writer][answerer] over every answer, and the web's share of it (on C, or by question). */
export function matrix(all = tablets()) {
  const keys = P.GODS.map((g) => g.key), R = keys.map(() => keys.map(() => 0)), byId = new Map(all.map((t) => [t.id, t]));
  let onWeb = 0, asked = 0, total = 0;
  for (const t of all) {
    const c = t.answers !== "-" ? byId.get(t.answers) : null; if (!c) continue;
    const i = keys.indexOf(c.god), j = keys.indexOf(t.god); R[i][j]++; total++;
    if (t.god === c.to) onWeb++; else if (c.asks === t.god) asked++;
  }
  return { keys, R, total, onWeb, asked, cross: total - onWeb - asked };
}
/** What each god owes at a tick: tablets addressed to it (by the web or by a question) still unanswered, and the debts
 * passed to it from closed sittings, in words weighted psi^hops (an answer owes psi of its cause). */
export function owed(tick = timeAt().tick, all = tablets()) {
  const answered = new Set(all.filter((t) => t.answers !== "-" && t.tick <= tick).map((t) => t.answers)), out = {};
  for (const g of P.GODS) out[g.key] = { open: 0, debt: 0, words: 0 };
  for (const t of all) {
    if (t.tick > tick || answered.has(t.id) || !["tablet", "question", "offering"].includes(t.kind)) continue;
    const owner = t.asks && t.asks !== "-" ? t.asks : t.to, closed = Math.floor(tick / MONTH) > t.sitting;
    const who = closed ? t.opposite : owner, w = Math.round(words(t.body) * Math.abs(P.PSI));
    out[who][closed ? "debt" : "open"]++; out[who].words += w;
  }
  return out;
}
function showMatrix() {
  const now = timeAt(), m = matrix(), lead = now.lead.key, pad = (s, n) => String(s).padEnd(n);
  console.log(`The answer matrix (row: the writer; column: who answered), ${m.total} answer${m.total === 1 ? "" : "s"}: ${m.onWeb} on the web (F.v), ${m.asked} asked by question, ${m.cross} across\n`);
  console.log(pad("", 9) + m.keys.map((k) => pad(k.slice(0, 7), 8)).join(""));
  m.keys.forEach((k, i) => console.log(pad(k, 9) + m.R[i].map((n, j) => pad(n ? n : (P.next(P.godByKey[k]).key === m.keys[j] ? "." : " "), 8)).join("")));
  console.log(`\n(. marks the web's edge, F.v, where an answer belongs)\n\nThe councils of the lead, ${now.lead.title}:`);
  for (const c of councilsOf(lead)) console.log(`  ${c.kind === "ledger" ? "ledger" : "triad "}  ${c.gods.map((k) => P.godByKey[k].title).join(" + ")}`);
  const o = owed(now.tick); console.log("\nOwed now (open: addressed and unanswered; debt: passed from a closed sitting; words at psi):");
  for (const g of P.GODS) { const x = o[g.key]; if (x.open || x.debt) console.log(`  ${pad(g.title, 32)} open ${x.open}, debt ${x.debt}, ${x.words} words`); }
}

const cmd = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("olympus.mjs")) {
  try {
    if (cmd === "now") { const t = timeAt(); console.log(`tick ${t.tick} · breath ${t.breath} · day ${t.day} · sitting ${t.sitting} (closes ${new Date(t.sittingEnds).toISOString()}) · year ${t.year} · the lead: ${t.lead.title} (${t.lead.name})`); }
    else if (cmd === "speak") speak();
    else if (cmd === "read") read();
    else if (cmd === "digest") digest();
    else if (cmd === "matrix") showMatrix();
    else if (cmd === "lens") { const r = lens(); console.log(r.lines.join("\n")); process.exit(r.ok ? 0 : 1); }
    else console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).slice(0, 24).map((l) => l.slice(3)).join("\n"));
  } catch (e) { console.error(e.message); process.exit(1); }
}
