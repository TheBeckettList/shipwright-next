// The boats in stages, the first: the sim. Every people's boat of every class, at its typical length, put
// through core/boat.js's trials: its steady speed at each angle to the wind (the polar), under its crew's own
// power, how far the wind lays it over and the wind it must reef in, and what that makes of a hop
// (VISION.HOP chunks of open water) and of the routes world/shipping.js gives it. Writes lab/boatsim.json.
//   node tools/boatsim.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FLEETS, sizeOf } from "../world/boatsizes.js";
import { hullOf, trial, TRIAL } from "../core/boat.js";
import { PHI } from "../core/golden.js";
import { VISION, GIVEN } from "../core/given.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOP_M = VISION.HOP * GIVEN.CHUNK;   // derived: a hop's blocks (a block a metre)
const pullOf = (drive) => (drive.includes("oars") ? "oars" : drive.includes("paddles") ? "paddles" : drive.includes("poles") ? "poles" : null);

// who pulls her: world/boatsizes.js sizeOf's rowers (a pair a room) or paddlers (a file, two abreast past a beam of two)
const pullersOf = (type, s) => { const rooms = Math.max(1, Math.floor(s.L - (2 * s.L) / PHI ** 3)); return type.drive.includes("oars") ? 2 * rooms : /paddles|poles/.test(type.drive) ? rooms * (s.B > 2 ? 2 : 1) : 0; };
export function boatTrials() {
  const rows = [];
  for (const [t, fleet] of Object.entries(FLEETS)) for (const type of fleet) {
    const s = sizeOf(type), sails = type.drive.includes("sail");
    const h = hullOf({ L: s.L, lb: type.lb, flat: type.flat, full: type.full, rig: sails ? TRIAL.RIGS[t] ?? "square" : "square", pull: pullOf(type.drive), pullers: pullersOf(type, s), twin: TRIAL.TWIN[type.name] ?? 0, mast: sails ? s.masts[0] ?? 0 : 0 });
    const r = trial(h), mid = r.winds[1];   // the trades' working wind
    rows.push({ people: t, boat: type.name, cls: type.cls, L: s.L, drive: type.drive, rig: sails ? h.rig : null, crew: s.crew, pullers: pullersOf(type, s), mass: h.mass, gm: h.gm, hullSpeed: h.hullSpeed, pull: r.pull,
      reach: Math.max(0, ...mid.polar.map(([, v]) => v)), upwind: mid.upwind, mean: mid.mean, heel: mid.heel, stands: mid.stands, reef: r.reef ?? null,
      hop: HOP_M / Math.max(mid.mean, r.pull), winds: r.winds.map((w) => ({ W: w.W, mean: w.mean, upwind: w.upwind, heel: w.heel, polar: w.polar })) });
  }
  return rows;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = boatTrials(), f = (x, d = 1) => (x == null ? "-" : x.toFixed(d));
  fs.writeFileSync(path.join(ROOT, "lab/boatsim.json"), JSON.stringify(rows, (k, v) => (typeof v === "number" ? +v.toFixed(3) : v)));
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
  else {
    console.log(`people        boat              L   t     GM    pull  reach  upwind mean   heel  reef  hop s   (sail figures in a ${TRIAL.WINDS[1]} m/s wind; m/s)`);
    for (const r of rows) console.log(`${r.people.padEnd(13)} ${r.boat.padEnd(16)} ${String(r.L).padStart(3)} ${f(r.mass / 1000).padStart(5)} ${f(r.gm, 2).padStart(6)} ${f(r.pull).padStart(5)} ${(r.rig ? f(r.reach) : "-").padStart(6)} ${(r.rig ? f(r.upwind) : "-").padStart(6)} ${f(Math.max(r.mean, r.pull)).padStart(5)} ${(r.rig ? f(r.heel) : "-").padStart(6)}${r.rig && !r.stands ? "!" : " "} ${(r.reef == null ? "-" : r.reef >= 59 ? ">60" : f(r.reef, 0)).padStart(4)} ${f(r.hop, 0).padStart(5)}`);
  }
}
