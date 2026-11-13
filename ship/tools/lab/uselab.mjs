// The use lab: takes every boat out on the test grid and uses it the way a player would, through
// the game's own code. No graphics; it reads the numbers a player would feel.
//
//   node --import ./tests/mocks/register.mjs tools/lab/uselab.mjs [boat ...] [--depth lo|mid|hi]
//
// Lenses
//   seats    every seat over a hull (never over the gap between twin hulls), the helm's eye over
//            the rail so you can see where you're going, crew eyes at least level with it
//   heel     the hardest heel the laws allow (full sail on the beam, hard over at speed): the lee
//            rail must stay above the water
//   deck     where you stand on the laid deck: on a deep hull, the top deck at the rail, not the hold
//   sail     hands on the helm: she gathers way, turns both ways (opposite ways for opposite helm),
//            and holds a straight course with the helm amidships
import { world } from "@minecraft/server";
import { PLANS } from "../../BP/scripts/config/plans.js";
import { PROPORTIONS } from "../../BP/scripts/config/proportions.js";
import { newRecord, writeRecord, readRecord, midsOf, seatBand, LAUNCHED_TAG } from "../../BP/scripts/ship.js";
import { ShipFrame } from "../../BP/scripts/frame.js";
import { computeHandling, propulsionFor } from "../../BP/scripts/handling.js";
import { steerBoat, _test as steerTest } from "../../BP/scripts/steering.js";
import { heelTarget } from "../../BP/scripts/laws.js";
import fs from "node:fs";

const WATERLINE = 0.4;            // the water's surface above a floating boat's origin
const EYE = 1.1;                  // a seated player's eye above their seat
const DEPTHS = { lo: 0.8, mid: 1.0, hi: 1.35 };

// Two arenas, built once and reused (the test grid holds only so many blocks): open water 10
// deep, and a 3-deep river for poles. Each launch clears the last lab ship away.
const arenas = new Map();
let lastShip = null;
function water(deep = 10) {
  const dim = world.getDimension("minecraft:overworld");
  if (!arenas.has(deep)) {
    const x0 = 2_000_000 + arenas.size * 500;
    for (let x = x0 - 100; x <= x0 + 100; x++) for (let z = -100; z <= 100; z++) for (let y = 54; y <= 63; y++) dim.set(x, y, z, y > 63 - deep ? "minecraft:water" : "minecraft:sand");
    arenas.set(deep, x0);
  }
  if (lastShip) {
    lastShip.isValid = false;
    const i = dim.entities.indexOf(lastShip);
    if (i >= 0) dim.entities.splice(i, 1);
  }
  return { dim, at: { x: arenas.get(deep) + 0.5, y: 63.6, z: 0.5 } };
}

/** A built, launched ship of this plan at a typical size and the given depth. */
export function launch(pid, depth = 1.0) {
  const plan = PLANS[pid];
  const [lo, hi] = plan.lengthRange;
  const step = plan.lengthStep ?? 1;
  const L = lo + Math.round((hi - lo) / 2 / step) * step;
  const rec = newRecord(plan, "lab", L);
  rec.stage = 5;
  rec.dims.depth = depth;
  if (plan.rigFamily) rec.sections.rig = { ...(rec.sections.rig ?? {}), sail: true, style: plan.rigStyle };
  // A pole needs a bottom to push on: poled boats are tried in a 3-deep river, the rest in open water.
  const { dim, at } = water(propulsionFor(rec, plan) === "pole" ? 3 : 10);
  const e = dim.spawnEntity(plan.entity ?? `shipwright:${pid}`, at);
  writeRecord(e, rec);
  e.addTag(LAUNCHED_TAG);
  e.triggerEvent("shipwright:launch");                      // seats on, as at a real launch
  lastShip = e;
  return { e, rec, plan, h: computeHandling(rec) };
}

function seatsOf(pid, rec) {
  const ent = JSON.parse(fs.readFileSync(new URL(`../../BP/entities/${pid}.json`, import.meta.url), "utf8"))["minecraft:entity"];
  const g = ent.component_groups[`shipwright:seats_mid_${midsOf(rec)}${seatBand(rec)}`];
  return g?.["minecraft:rideable"]?.seats?.map((s) => s.position) ?? [];
}

const railAt = (pid, depth) => {
  const r = PROPORTIONS[pid]?.rail ?? 1;
  return 5 / 16 + (r - 5 / 16) * depth;
};

export function seatsLens({ e, rec, plan, h }, depth) {
  const pid = rec.plan, issues = [];
  const seats = seatsOf(pid, rec);
  const rail = railAt(pid, depth);
  const lines = h.hullLines ?? [0];
  const halfBeam = (h.beam ?? 1) / 2;
  seats.forEach(([x, y, z], k) => {
    const onHull = lines.some((c) => Math.abs(Math.abs(x) - Math.abs(c)) <= halfBeam + 0.05);
    if (!onHull) issues.push(`seat ${k} at x ${x} is over the water between the hulls`);
    const along = -z + h.helmAt;                  // seat z is forward-negative from the helm; along from the centre
    if (Math.abs(along) > h.half + 0.05) issues.push(`seat ${k} off the end of the hull (${along.toFixed(2)} of ±${h.half})`);
  });
  const helm = seats[0];
  const helmEye = helm ? helm[1] + EYE : 0;
  if (helm && helmEye < rail + 0.25) issues.push(`helm can't see over the rail (eye ${helmEye.toFixed(2)}, rail ${rail.toFixed(2)})`);
  const lowCrew = seats.slice(1).filter((s) => s[1] + EYE < rail - 0.3).length;
  if (lowCrew) issues.push(`${lowCrew} crew seat(s) sunk below the rail`);
  return { seats: seats.length, helmEye: +helmEye.toFixed(2), rail: +rail.toFixed(2), issues };
}

export function heelLens({ rec, h }, depth) {
  const rail = railAt(rec.plan, depth);
  const worst = Math.min(25, Math.abs(heelTarget(h, { fill: 1, windSpeed: 1.3, off: 90, windAcross: 1, turnRight: -1, speed: h.max })));
  const limit = h.heelLimit ?? 25;
  const a = (Math.min(worst, limit) * Math.PI) / 180;
  const W = h.overallHalfWidth ?? h.beam / 2;
  const lee = rail * Math.cos(a) - W * Math.sin(a);        // the lee rail's height above the origin
  const issues = lee < WATERLINE + 0.1 ? [`lee rail under water at ${(a * 180 / Math.PI).toFixed(1)}° (rail ${lee.toFixed(2)} vs water ${WATERLINE})`] : [];
  return { heel: +(a * 180 / Math.PI).toFixed(1), lee: +lee.toFixed(2), issues };
}

export function deckLens({ rec, h }, depth) {
  const issues = [];
  if ((h.length ?? 0) < 11) return { deckUp: 0, issues };
  const rail = railAt(rec.plan, depth);
  const feet = (h.deckUp ?? 0) + 1 - 0.6;                   // barrier top above the origin
  if (rail - feet > 1.6) issues.push(`crew stand ${(rail - feet).toFixed(1)} below the rail: in the hold, seeing nothing`);
  if (feet - rail > 0.6) issues.push(`the top deck floats ${(feet - rail).toFixed(1)} above the rail`);
  return { deckUp: h.deckUp ?? 0, feet: +feet.toFixed(2), rail: +rail.toFixed(2), issues };
}

export function sailLens({ e }) {
  const helm = { typeId: "minecraft:player", id: "lab-helm", input: { x: 0, y: 1 }, jump: false,
    inputInfo: { getMovementVector() { return helm.input; }, getButtonState() { return "Released"; } } };
  const run = (n) => { let s; for (let i = 0; i < n; i++) s = steerBoat(e, helm); return s; };
  const issues = [];
  let s = run(160);
  const speed = s.speed;
  if (speed < (s.stats?.propulsion === "pole" ? 0.04 : 0.08)) issues.push(`barely moves (${speed.toFixed(3)} b/t after 8 s)`);
  const h0 = s.heading;
  run(20);
  const straight = Math.abs(steerTest.state.get(e.id).heading - h0);
  if (straight > 2) issues.push(`wanders ${straight.toFixed(1)}° with the helm amidships`);
  helm.input = { x: -1, y: 1 };
  const a0 = steerTest.state.get(e.id).heading;
  run(40);
  const left = steerTest.state.get(e.id).heading - a0;
  helm.input = { x: 1, y: 1 };
  const b0 = steerTest.state.get(e.id).heading;
  run(40);
  const right = steerTest.state.get(e.id).heading - b0;
  if (Math.abs(left) < 3 || Math.abs(right) < 3) issues.push(`hardly turns (${left.toFixed(1)}°, ${right.toFixed(1)}° in 2 s)`);
  if (Math.sign(left) === Math.sign(right)) issues.push("turns the same way for both helms");
  return { speed: +speed.toFixed(3), turn: [+left.toFixed(1), +right.toFixed(1)], issues };
}

/**
 * Lens: coast. Up to speed, then hands off: how long she takes to lose half her way, how far she
 * glides, and when she stops. A hull should carry her way for a few seconds (longer the heavier),
 * never stop dead and never drift on forever.
 */
export function coastLens({ e }) {
  const helm = { typeId: "minecraft:player", id: "lab-coast", input: { x: 0, y: 1 },
    inputInfo: { getMovementVector() { return helm.input; }, getButtonState() { return "Released"; } } };
  let s;
  for (let i = 0; i < 300; i++) s = steerBoat(e, helm);
  const v0 = s.speed;
  helm.input = { x: 0, y: 0 };
  s.sailSet = false;                         // sail struck: what the water does on its own
  let half = null, stop = null, dist = 0;
  for (let t = 1; t <= 2400 && stop === null; t++) {
    s = steerBoat(e, helm);
    dist += s.speed;
    if (half === null && s.speed <= v0 / 2) half = t;
    if (s.speed < 0.01) stop = t;
  }
  const issues = [];
  if (half !== null && half < 30) issues.push(`loses half her way in ${(half / 20).toFixed(1)} s: stops like a car`);
  if (stop === null || stop > 1200) issues.push(`still drifting after a minute`);
  return { v0: +v0.toFixed(3), half: half && +(half / 20).toFixed(1), stop: stop && +(stop / 20).toFixed(1), glide: +dist.toFixed(1), issues };
}

/** Sails a lab ship for n ticks, moving her by her velocity unless her box would hit a block. */
export function sailFor(e, helm, n, hw = 0.8) {
  const dim = e.dimension;
  const solid = (x, y, z) => { const b = dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }); return b && !/water|air/.test(b.typeId) && !/_slab$/.test(b.typeId); };
  const hits = (x, z) => [-hw, 0, hw].some((ox) => [-hw, 0, hw].some((oz) => solid(x + ox, e.location.y + 0.3, z + oz)));
  let blocked = 0;
  for (let i = 0; i < n; i++) {
    steerBoat(e, helm);
    // Like the game: each axis on its own, so a box against a wall slides along it.
    const v = e.velocity;
    let { x, z } = e.location;
    if (!hits(x + v.x, z)) x += v.x; else { blocked++; v.x = 0; }
    if (!hits(x, z + v.z)) z += v.z; else { blocked++; v.z = 0; }
    e.location = { ...e.location, x, z };
  }
  return blocked;
}

/**
 * Lens: glance and lip. Sailing along a bank that brushes her side, she sheers off and keeps
 * going (never stopped dead); a bottom slab across her course at the waterline she rides over.
 */
export function brushLens(pid) {
  const b = launch(pid);
  const { e, h } = b;
  const dim = e.dimension;
  const helm = { typeId: "minecraft:player", id: "lab-brush", inputInfo: { getMovementVector: () => ({ x: 0, y: 1 }), getButtonState: () => "Released" } };
  steerTest.state.get(e.id) ?? steerBoat(e, helm);
  steerTest.state.get(e.id).sailSet = false;
  const x = e.location.x, z0 = Math.floor(e.location.z);
  const W = h.overallHalfWidth ?? h.beam / 2;
  // the bank: blocks along her starboard... a few tenths inside her side, from just ahead for 40 blocks
  // where her outermost side is probed (the steering's side points), so the bank meets her side,
  // never a keel line (a twin's hulls lie well out from her middle)
  const sideAt = Math.max(...(h.hullLines ?? [0]).map(Math.abs)) + Math.max(0.3, (h.beam ?? 1.5) / 2 - 0.15);
  const bankX = Math.min(Math.floor(x) - 1, Math.floor(x - sideAt));   // never in her own block
  const placed = [];
  for (let z = z0 + 4; z <= z0 + 60; z++) for (const y of [63, 64]) { placed.push([bankX, y, z, dim.getBlock({ x: bankX, y, z }).typeId]); dim.set(bankX, y, z, "minecraft:stone"); }
  // the lip: a bottom slab right across her course further on
  for (let xx = Math.floor(x - W - 2); xx <= Math.floor(x + W + 2); xx++) { placed.push([xx, 63, z0 + 70, dim.getBlock({ x: xx, y: 63, z: z0 + 70 }).typeId]); dim.set(xx, 63, z0 + 70, "minecraft:oak_slab"); }
  const startZ = e.location.z;
  sailFor(e, helm, 500, Math.max(0.5, Math.min((b.plan.modelScale ?? 1) > 1 ? 1.0 : 0.8, sideAt - 0.3)));
  const gone = e.location.z - startZ;
  const s = steerTest.state.get(e.id);
  for (const [px, py, pz, was] of placed) dim.set(px, py, pz, was);
  const issues = [];
  if (gone < 75 && s.speed < 0.02) issues.push(`brushed a bank or lip and stopped (${gone.toFixed(1)} blocks made good)`);
  return { gone: +gone.toFixed(1), glances: s.glancing ?? 0, issues };
}

export function useBoat(pid, depth = 1.0) {
  const b = launch(pid, depth);
  return { pid, seats: seatsLens(b, depth), heel: heelLens(b, depth), deck: deckLens(b, depth), sail: sailLens(b), coast: coastLens(launch(pid, depth)),
    brush: depth === 1.0 ? brushLens(pid) : { issues: [] } };
}

function main() {
  const args = process.argv.slice(2);
  const dArg = args.includes("--depth") ? args[args.indexOf("--depth") + 1] : null;
  const pids = args.filter((a) => PLANS[a]);
  const want = pids.length ? pids : Object.keys(PLANS).filter((k) => k !== "testship");
  const depths = dArg ? [DEPTHS[dArg]] : Object.values(DEPTHS);
  let bad = 0;
  for (const pid of want) for (const d of depths) {
    const r = useBoat(pid, d);
    const issues = [...r.seats.issues, ...r.heel.issues, ...r.deck.issues, ...r.sail.issues, ...r.coast.issues, ...r.brush.issues];
    bad += issues.length;
    console.log(`${pid.padEnd(15)} depth ${d}: ${issues.length ? issues.length + " issue(s)" : "clean"}  helm eye ${r.seats.helmEye} / rail ${r.seats.rail}, heel ${r.heel.heel}° lee ${r.heel.lee}, deck +${r.deck.deckUp}, speed ${r.sail.speed}, turn ${r.sail.turn.join("/")}, coast ½ ${r.coast.half}s stop ${r.coast.stop}s glide ${r.coast.glide}${r.brush.gone !== undefined ? `, brushed ${r.brush.gone} (${r.brush.glances} glances)` : ""}`);
    for (const i of issues) console.log(`    ${i}`);
  }
  process.exitCode = bad ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();

/**
 * Lens: ship's boats. A great ship takes a small boat in tow and sails on (turning too): the boat
 * follows on its line, lies along it, never rides up on the ship and never drops back out of
 * reach. Then the stowage each great ship offers for each small boat.
 */
export async function towLens(shipPid, boatPid) {
  const { takeInTow, stowageFor } = await import("../../BP/scripts/tender.js");
  const ship = launch(shipPid);
  const keep = ship.e;
  lastShip = null;                                            // keep the ship while the boat is launched
  const small = launch(boatPid);
  lastShip = keep;
  const dim = ship.e.dimension;
  // the boat starts alongside, a little astern
  small.e.location = { ...small.e.location, x: ship.e.location.x + ship.h.overallHalfWidth + 2, z: ship.e.location.z - 4 };
  const rec = readRecord(ship.e);
  writeRecord(ship.e, rec);
  takeInTow(ship.e, small.e);
  const p = { typeId: "minecraft:player", id: "lab-tow", isValid: true, dimension: dim, location: ship.e.location,
    inputInfo: { getMovementVector: () => p.input, getButtonState: () => "Released" }, onScreenDisplay: { setActionBar() {} }, input: { x: 0, y: 1 },
    getComponent: () => null, sendMessage() {} };
  ship.e.riders = [p];
  const issues = [];
  let worst = 0, closest = 99;
  const from = { ...ship.e.location };
  for (let t = 0; t < 600; t++) {
    if (t === 300) p.input = { x: 1, y: 1 };                  // a long turn to starboard
    steerTest.tick();
    for (const e of [ship.e, small.e]) e.location = { ...e.location, x: e.location.x + e.velocity.x, z: e.location.z + e.velocity.z };
    if (t > 120) {
      const ss = steerTest.state.get(ship.e.id), sb = steerTest.state.get(small.e.id);
      const stern = new ShipFrame(ship.e.location, ss.heading, ss.stats).fromCentre(-ss.stats.half, 0);
      const bc = new ShipFrame(small.e.location, sb.heading, sb.stats).centre();
      const d = Math.hypot(bc.x - stern.x, bc.z - stern.z);
      worst = Math.max(worst, d);
      closest = Math.min(closest, d - sb.stats.half);
    }
  }
  const sailed = Math.hypot(ship.e.location.x - from.x, ship.e.location.z - from.z);
  if (sailed < 20) issues.push(`the ship hardly moved (${sailed.toFixed(1)})`);
  if (!small.e.getDynamicProperty("shipwright:towedBy")) issues.push("the line parted");
  if (worst > 12) issues.push(`the boat dropped back ${worst.toFixed(1)} blocks`);
  if (closest < 0.5) issues.push(`the boat rode up on the ship (${closest.toFixed(2)} clear)`);
  const ways = stowageFor(ship.plan, ship.h, readRecord(ship.e), small.plan, readRecord(small.e), small.h);
  for (const e of [small.e]) { e.isValid = false; const i = dim.entities.indexOf(e); if (i >= 0) dim.entities.splice(i, 1); }
  return { sailed: +sailed.toFixed(1), worst: +worst.toFixed(1), closest: +closest.toFixed(2), ways, issues };
}
