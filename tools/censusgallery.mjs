// Every building the world needs, drawn in every people's hands, with the boats' sizes and what a place of each
// level raises. Writes PNGs and an index.html into outdir.
//   node tools/censusgallery.mjs outdir
import fs from "node:fs";
import path from "node:path";
import { encode } from "./png.js";
import { iso } from "./iso.js";
import { TYPES, NAMES, buildOf, censusOf, coverage, nameOf, LEVELS } from "../world/census.js";
import { FLEETS, sizes, CLASSES, KEEPING, harbourOf } from "../world/boatsizes.js";
const out = process.argv[2] ?? "census"; fs.mkdirSync(out, { recursive: true });
const VAN = JSON.parse(fs.readFileSync(new URL("../lab/bedrock_blocks.json", import.meta.url), "utf8")).blocks;
const PEOPLE = Object.keys(NAMES);
const LABEL = { norse: "Norse", european: "European", therans: "Therans", indian_ocean: "Indian Ocean", east_asian: "East Asian", japanese: "Japanese", pacific: "Pacific", dugout: "Northwest Coast", birchbark: "Birchbark", shallow: "Shallow-water", arctic: "Arctic" };
const shot = (vox, name) => { const p = iso({ vox }); fs.writeFileSync(path.join(out, `${name}.png`), encode(p.w, p.h, p.img, 3)); return `${name}.png`; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// the street: each people's buildings, the house in its three sizes and two seeds
const PICK = [["hut", 0, null], ["cottage", 1, null], ["house", 2, 0], ["house", 3, 1], ["house", 4, 2], ["narrow", 5, null], ["farmhouse", 6, null], ["fisherhouse", 7, null], ["shophouse", 8, null], ["workhouse", 9, null], ["bighouse", 10, null], ["smithy", 11, null], ["barn", 12, null], ["granary", 13, null], ["warehouse", 14, null], ["boathouse", 15, null], ["shipyard", 16, null], ["lookout", 17, null], ["inn", 18, null], ["meeting", 19, null], ["temple", 20, null]];
const bad = new Set(); let built = 0;
const streets = PEOPLE.map((t, ti) => ({ t, cards: PICK.map(([id, s, size]) => {
  const b = buildOf(id, t, s * 7 + ti * 3, size); built++;
  for (const v of b.vox.values()) if (!VAN[v.id] && v.id !== "minecraft:air") bad.add(v.id);
  return { id, b, f: shot(b.vox, `${t}_${id}_${s}`) };
}) }));
console.log(`built ${built}; not vanilla: ${[...bad].join(", ") || "none"}`);
const cov = coverage();
const census = [["norse", 30, "fishers", "raiders"], ["european", 90, "farmers", "wary"], ["indian_ocean", 400, "fishers", "traders"], ["therans", 900, "fishers", "traders", true]].map(([t, folk, living, temper, capital]) => ({ t, folk, living, temper, c: censusOf({ t, folk, living, temper, capital }) }));
const KIND = ["home", "work", "store", "trade", "civic", "guard", "faith", "harbour"];
const typeRows = Object.entries(TYPES).sort((a, b) => KIND.indexOf(a[1].kind) - KIND.indexOf(b[1].kind) || a[1].level - b[1].level).map(([id, T]) => `<tr><td>${esc(T.name)}</td><td>${T.kind}</td><td>${LEVELS[T.level]}</td><td class="f">${esc((T.rooms ? T.rooms(1) : ["(stacked)"]).join(" "))}${T.extra ? ` <span class="mute">+ ${T.extra.join(" ")}</span>` : ""}</td><td>${esc(T.call)}</td></tr>`).join("");
const boatRows = PEOPLE.flatMap((t) => sizes(t).map((s) => `<tr><td>${LABEL[t]}</td><td>${s.cls}</td><td>${esc(s.name)}</td><td>${s.L}</td><td>${s.B}</td><td>${s.draft}</td><td>${s.masts.join(" / ") || "–"}</td><td>${s.crew}</td><td>${s.cargo}</td><td>${s.reach}</td><td>${s.boathouse ? `${s.boathouse.w} × ${s.boathouse.l}` : "afloat"}</td><td>${s.quay.run} at ${s.quay.depth} deep</td></tr>`)).join("");
const css = `:root{--bg:#f6f4ef;--ink:#1f2328;--mute:#6b6f76;--line:#dcd8cf;--card:#fff;--acc:#2e6db4}@media (prefers-color-scheme:dark){:root{--bg:#16181b;--ink:#e8e6e1;--mute:#9a9ea5;--line:#30343a;--card:#1f2226;--acc:#7fb0e8}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1240px;margin:0 auto;padding:28px 20px 60px}h1{font-size:28px;margin:0 0 6px}h2{font-size:20px;margin:40px 0 8px}h3{font-size:16px;margin:26px 0 8px}p{color:var(--mute);max-width:820px}
nav{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}nav a{border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--ink);text-decoration:none;font-size:13px;background:var(--card)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}.c{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px;display:flex;flex-direction:column}
.c img{width:100%;height:160px;object-fit:contain;image-rendering:pixelated}.c b{font-size:14px}.c small{color:var(--mute);font-size:12px;line-height:1.35}
table{border-collapse:collapse;font-size:13px;width:100%;background:var(--card)}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}th{font-weight:600}.f{font-family:ui-monospace,monospace;font-size:12px}.mute{color:var(--mute)}
.wrap{overflow-x:auto}.ok{color:#2e8b57}.cen{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}.cen div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;font-size:13px}`;
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Every building, and the boats' sizes</title><style>${css}</style></head><body><main>
<h1>Every building the world needs</h1>
<p>${Object.keys(TYPES).length} building types, each called by something the world already holds: a job, a livelihood, a temper, the faith, the fleet, a household's rank, or the place's level. Homes and halls keep each people's own grammar; work buildings, stores, boathouses and towers now have their own forms, so a Norse barn isn't a longhouse with a byre inside it. Every type comes in three sizes, and the seed adds extras (a lean-to, a chimney, pots, a fenced yard, drying racks), so no two buildings on a street match.</p>
<p class="ok">Coverage: every job has a building (${cov.jobs.length ? "missing: " + cov.jobs.join(", ") : "none missing"}); every room in the periodic table is used (${cov.rooms.length ? "unused: " + cov.rooms.join(", ") : "none unused"}).</p>
<nav>${PEOPLE.map((t) => `<a href="#${t}">${LABEL[t]}</a>`).join("")}<a href="#types">All types</a><a href="#census">Census by level</a><a href="#boats">Boat sizes</a></nav>
${streets.map(({ t, cards }) => `<h2 id="${t}">${LABEL[t]}</h2><div class="grid">${cards.map(({ id, b, f }) => `<figure class="c"><img src="${f}" alt="${esc(b.name)}" loading="lazy"><b>${esc(b.name)}</b><small>${b.size} · ${b.dims ? `${b.dims.w} × ${b.dims.l}, ${b.dims.h} high` : ""}<br>${esc(b.formula.join(" "))}${b.extras.length ? ` (+ ${b.extras.join(" ")})` : ""}<br>${esc(b.note ?? "")}</small></figure>`).join("")}</div>`).join("")}
<h2 id="types">All ${Object.keys(TYPES).length} types</h2><p>Rooms are shown at middling size; the extras are rooms a building may take or leave.</p><div class="wrap"><table><tr><th>Type</th><th>Kind</th><th>From</th><th>Rooms</th><th>Called by</th></tr>${typeRows}</table></div>
<h2 id="census">What a place of each level raises</h2><p>A household is five people. Homes take every household, split by rank (elders, crafters, merchants), livelihood and level; the rest follow from jobs, temper, faith and fleet.</p>
<div class="cen">${census.map(({ t, folk, living, temper, c }) => `<div><b>${LABEL[t]}, ${folk} people</b> <span class="mute">(${living}, ${temper})</span><br>${c.name}: ${c.households} households, ${c.list.reduce((a, b) => a + b.n, 0)} buildings<br><span class="mute">${c.list.map((x) => `${esc(x.name)} ${x.n}`).join(" · ")}</span></div>`).join("")}</div>
<h2 id="boats">Boat sizes</h2><p>One block is one metre. Three classes by length: small (about ${CLASSES.small.nominal}), ship (about ${CLASSES.ship.nominal}), great (about ${CLASSES.great.nominal}). Each people's own types, with lengths and length-to-beam ratios from the historical hulls. Lengths shown are typical; each boat takes its own length within its type's range. No ship over 21 is housed under a roof. The ships will be entity models in the ship module, not block builds.</p>
<div class="wrap"><table><tr><th>People</th><th>Class</th><th>Type</th><th>Length</th><th>Beam</th><th>Draft</th><th>Masts</th><th>Crew</th><th>Cargo (chests)</th><th>Reach</th><th>Boathouse</th><th>Quay</th></tr>${boatRows}</table></div>
<p>How each people keeps its boats: ${PEOPLE.map((t) => `${LABEL[t]}: ${KEEPING[t]}`).join(" · ")}.</p>
</main></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`wrote ${out}/index.html`);
