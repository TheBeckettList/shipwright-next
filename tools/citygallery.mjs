// Real towns grown on their own ground (world/cities.js), living through a day (world/living.js), with what their sea
// asks of them (world/shipping.js). Writes PNGs and an index.html into outdir.
//   node tools/citygallery.mjs outdir [n]
import fs from "node:fs";
import path from "node:path";
import { encode } from "./png.js";
import { iso } from "./iso.js";
import { loadMap } from "../world/load.js";
loadMap();
const { cityOf } = await import("../world/cities.js");
const { layPlace, RHO } = await import("../world/district.js");
const L = await import("../world/living.js");
const { shipping } = await import("../world/shipping.js");
const { peoples } = await import("../world/peoples.js");
const { populations } = await import("../world/boxes.js");
const { RUNGS } = await import("../core/clock.js");
const out = process.argv[2] ?? "cities", want = +(process.argv[3] ?? 5); fs.mkdirSync(out, { recursive: true });
const LABEL = { norse: "Norse", european: "European", therans: "Therans", indian_ocean: "Indian Ocean", east_asian: "East Asian", japanese: "Japanese", pacific: "Pacific", dugout: "Northwest Coast", birchbark: "Birchbark", shallow: "Shallow-water", arctic: "Arctic" };
const S = shipping(), seaBy = new Map(S.rows.map((r) => [r.key, r])), P = peoples().list, pops = populations();
// the biggest town of each of the first `want` traditions by size (a hub of each people)
const best = new Map(); for (const p of P) { const v = pops.get(p.key)?.pop ?? 0; if (p.tradition === "therans") continue; if (!best.has(p.tradition) || v > best.get(p.tradition).v) best.set(p.tradition, { p, v }); }
const order = (process.argv[4] ?? "").split(",").filter(Boolean), picks = order.length ? order.map((t) => best.get(t).p) : [...best.values()].sort((a, b) => b.v - a.v).slice(0, want).map((x) => x.p);
const cull = (vox) => { const v = new Map(); for (const [k, b] of vox) { const [x, y, z] = k.split(",").map(Number); if ([[0, 1, 0], [1, 0, 0], [0, 0, 1]].every(([a, c, d]) => vox.has(`${x + a},${y + c},${z + d}`))) continue; v.set(k, b); } return v; };
const PLACE_COL = { home: [214, 168, 120], work: [170, 110, 60], docks: [60, 120, 190], market: [210, 70, 60] };   // vision: the day's colours
const KIND = { home: [205, 190, 165], work: [175, 150, 125], store: [165, 150, 130], trade: [200, 140, 120], civic: [150, 150, 190], guard: [130, 130, 130], faith: [215, 200, 140], harbour: [140, 170, 190] };
const cards = [];
for (const p of picks) {
  const t0 = Date.now(), c = cityOf(p, { seed: 11 }), pl = c.place; console.log(`  ${p.tradition}: grown, ${pl.placed.length} buildings, ${Date.now() - t0} ms`);
  const lay = layPlace(pl, p.tradition, { ground: c.ground, water: c.water, wall: c.soc.temper === "wary" }); console.log(`  laid, ${lay.vox.size} blocks, ${Date.now() - t0} ms`);
  const drawn = lay.vox.size < 3e6; if (drawn) { const v = cull(lay.vox), img = iso({ vox: v }); fs.writeFileSync(path.join(out, `${p.tradition}_iso.png`), encode(img.w, img.h, img.img, 3)); }   // a city past three million blocks is shown by its plan
  lay.vox.clear();
  // the living town through a day: the plan five times, its people as dots by where they are, the bodies ringed
  const town = { placed: pl.placed, quay: Math.max(0, pl.placed.findIndex((q) => /boathouse|shipyard|fishmarket/.test(q.id))), market: Math.max(0, pl.placed.findIndex((q) => /market/.test(q.id))) };
  town.chain = L.chainOf(pl.placed); town.jobs = L.jobsOf(pl.placed);
  const soc = c.soc, day = 3 * RUNGS.day, hours = [0.5, 3, 8, 12, 18], frames = [];
  const Pn = lay.plan, k = 2, W = Pn.w * k, Hh = Pn.l * k;
  const base = new Uint8Array(W * Hh * 3);
  const foot = new Map(); for (const q of pl.placed) { const w = (q.k % 2 ? q.atom.l : q.atom.w), l = (q.k % 2 ? q.atom.w : q.atom.l); for (let x = Math.round(q.x - w / 2); x < Math.round(q.x + w / 2); x++) for (let z = Math.round(q.z - l / 2); z < Math.round(q.z + l / 2); z++) foot.set(`${x},${z}`, q); }
  for (let j = 0; j < Pn.l; j++) for (let i = 0; i < Pn.w; i++) { const x = Pn.x0 + i, z = Pn.z0 + j, a = Pn.at(x, z), q = foot.get(`${x},${z}`); let col = a === "water" ? [80, 115, 170] : a === "lane" ? [232, 224, 205] : [158, 180, 128]; if (q && a === "building") col = KIND[q.b.kind] ?? [200, 200, 200]; if (a !== "water" && (pl.rho(x + 1, z) >= RHO.place) !== (pl.rho(x, z) >= RHO.place)) col = [80, 80, 80]; for (let a2 = 0; a2 < k; a2++) for (let b = 0; b < k; b++) base.set(col, ((j * k + b) * W + i * k + a2) * 3); }
  for (const h of hours) {
    const t = day + Math.round(h * RUNGS.day / 24), T = L.townAt(town, p, soc, t), shown = new Set(L.shownAt(T, t, { x: 0, z: 0, sight: Math.max(Pn.w, Pn.l) }).map((e) => e.k)), fimg = base.slice();
    const dot = (x, z, col, r) => { const i = Math.round((x - Pn.x0) * k), j = Math.round((z - Pn.z0) * k); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const X = i + a, Y = j + b; if (X >= 0 && Y >= 0 && X < W && Y < Hh) fimg.set(col, (Y * W + X) * 3); } };
    for (let q = 0; q < T.N; q++) { const at = T.at(q); if (at.away) continue; dot(at.x, at.z, shown.has(q) ? [20, 20, 20] : at.walking ? [250, 250, 250] : PLACE_COL[at.place] ?? [255, 0, 255], shown.has(q) ? 2 : 1); }
    const f = `${p.tradition}_h${h}.png`; fs.writeFileSync(path.join(out, f), encode(W, Hh, fimg, 3));
    frames.push({ f, h, part: T.part, counts: T.counts, N: T.N, shown: shown.size });
  }
  const sea = seaBy.get(p.key);
  cards.push({ p, c, pl, frames, sea, lanes: lay.lanes });
  console.log(`${p.tradition} (${p.key}): ${pl.census.name}, ${pl.census.households} households, ${pl.placed.length} buildings, ${pl.shape.primitive}, ${pl.placed.filter((q) => q.up).length} pressed, ${pl.dropped} unplaced; ${Date.now() - t0} ms`);
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = `:root{--bg:#f6f4ef;--ink:#1f2328;--mute:#6b6f76;--line:#dcd8cf;--card:#fff}@media (prefers-color-scheme:dark){:root{--bg:#16181b;--ink:#e8e6e1;--mute:#9a9ea5;--line:#30343a;--card:#1f2226}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1240px;margin:0 auto;padding:28px 20px 60px}h1{font-size:28px;margin:0 0 6px}h2{font-size:20px;margin:40px 0 6px}h3{font-size:15px;margin:18px 0 6px}p{color:var(--mute);max-width:880px}
img{max-width:100%;image-rendering:pixelated;border:1px solid var(--line);border-radius:8px;background:var(--card)}.strip{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.strip figure{margin:0}figcaption{font-size:12px;color:var(--mute)}
table{border-collapse:collapse;font-size:13px;width:100%;background:var(--card)}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}.key span{display:inline-block;width:11px;height:11px;margin:0 4px 0 10px;border-radius:2px;vertical-align:-1px}`;
const key = [["at home", PLACE_COL.home], ["at work", PLACE_COL.work], ["at the docks", PLACE_COL.docks], ["at the market", PLACE_COL.market], ["walking", [250, 250, 250]], ["a body (shown in the game)", [20, 20, 20]]].map(([k, c]) => `<span style="background:rgb(${c.join(",")});border:1px solid #999"></span>${k}`).join("");
const seaTable = (s) => s ? `<table><tr><th>Fleet</th><th>Hands</th><th>Shore</th><th>Yard</th><th>Stores short</th><th>Route to market</th></tr><tr><td>${s.fleet.boats} ${esc(s.fleet.type)} (${s.fleet.kind}, ${s.fleet.L} long, ${s.fleet.crew} crew each, ${s.fleet.cargo} chests in all)</td><td>${s.hands.need} needed, ${s.hands.have} at sea${s.hands.short ? `; ${s.hands.short} short, ${s.hands.idle} boats idle` : ""}</td><td>${esc(s.shore.keep)}: ${s.shore.boathouses} boathouses, ${s.shore.quay} blocks of quay at ${s.shore.depth} deep${s.shore.slip ? `; a slip ${s.shore.slip.w} by ${s.shore.slip.l}` : ""}</td><td>${s.yard.wrights} shipwrights raise ${s.yard.raise} hulls a year against ${s.yard.wearOut} worn out${s.yard.short ? " (short)" : ""}</td><td>${Object.entries(s.stores.short).filter(([, v]) => v > 0).map(([k2, v]) => `${k2} ${Math.round(v * 100)}%`).join(", ") || "none"}</td><td>${s.route.chunks} chunks, ${s.route.hops} hops; needs ${s.route.need}, its best reaches ${s.route.best}: sailed by ${esc(s.route.carried)}</td></tr></table>` : "";
const byRows = Object.entries(S.by).sort((a, b) => b[1].boats - a[1].boats).map(([t, T]) => `<tr><td>${LABEL[t]}</td><td>${T.peoples}</td><td>${T.boats}</td><td>${T.crew}</td><td>${T.short} (${T.idle} boats idle)</td><td>${T.boathouses}</td><td>${T.quay}</td><td>${T.yardShort}</td><td>${T.storesShort}</td><td>${T.own} / ${T.league} / ${T.theran}</td></tr>`).join("");
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Living towns on their own ground</title><style>${css}</style></head><body><main>
<h1>Living towns on their own ground</h1>
<p>Each people's biggest town, grown from its real size, way of living and temper on the map's own ground. A port's centre sits at the shore of its lee, where its height gathers; a farming town's sits on its flattest land. Then each town is lived through one day. Its people are records on its chain of homes, kept inside the chain's bounds. Where each one stands is computed from the clock alone, and the dark dots are the 21 bodies a player would see as civ villagers.</p>
<p class="key">${key}</p>
${cards.map(({ p, c, pl, frames, sea }) => `<h2>${LABEL[p.tradition]}: ${esc(p.name ?? p.key)}</h2><p>${esc(pl.census.name)} of ${c.pop} people (${pl.census.households} households), ${pl.placed.length} buildings in ${pl.quarters.length} quarters on ground shaped as a ${pl.shape.primitive} (eigenvalue ratio ${pl.shape.ratio.toFixed(2)}); ${pl.placed.filter((q) => q.up).length} homes raised by the press${pl.bridges.size ? `, ${pl.bridges.size} blocks of bridge` : ""}${pl.dropped ? `; ${pl.dropped} buildings found no ground` : ""}. ${esc(c.soc.temper)} ${esc(p.living)}, the year's doing: ${esc(c.soc.action)}.</p>
${fs.existsSync(path.join(out, `${p.tradition}_iso.png`)) ? `<img src="${p.tradition}_iso.png" alt="${esc(p.key)}" loading="lazy">` : `<p>Too big to draw whole here; its plan through the day is below.</p>`}
<h3>A day in it</h3><div class="strip">${frames.map((f) => `<figure><img src="${f.f}" alt="hour ${f.h}" loading="lazy"><figcaption>${f.part}: home ${f.counts.home}, work ${f.counts.work}, docks ${f.counts.docks}, market ${f.counts.market}, at sea ${f.counts.sea}, at Thera ${f.counts.thera}; ${f.shown} bodies</figcaption></figure>`).join("")}</div>
<h3>What its sea asks</h3>${seaTable(sea)}`).join("")}
<h2>The whole sea, by people</h2><p>Every people's fleet sized by its own boats' crews, and its yard by the work in its hulls: a shipwright frames a block of hull in eight days, and a hull lasts thirteen years. The last column says who sails each people's route to its market: its own boats, the League's ships, or a Theran charter.</p>
<div style="overflow-x:auto"><table><tr><th>People</th><th>Peoples</th><th>Boats</th><th>Hands needed</th><th>Short of hands</th><th>Boathouses</th><th>Quay (blocks)</th><th>Yards short</th><th>Stores short</th><th>Routes: own / League / Theran</th></tr>${byRows}</table></div>
</main></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log("wrote", out);
