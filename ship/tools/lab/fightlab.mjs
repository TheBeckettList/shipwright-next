// The fight lab: every module that does something in a fight (or for the crew), used through the
// game's own code on the test grid, ship against ship. No graphics; it reads what a player would see
// happen.
//
//   node --import ./tests/mocks/register.mjs tools/lab/fightlab.mjs [boat ...]
//
// Lenses
//   ids       every item a module, anchor or recipe asks for is a real Bedrock item
//   guns      a broadside clears her own hull, carries a sensible range, strikes a ship lying
//             abeam in the zone it was aimed at, and enough shot founders her (bulkheads hold);
//             chain shot tears the sail and leaves the hull
//   ram       at speed her stem holes a ship it reaches anywhere along that ship's length (a great
//             ship's box is only amidships); she loses way doing it; a ram spares her own bow, no
//             ram costs her more than her victim; a light boat barely scratches a heavy one; a slow
//             touch stops her without harm
//   crossbow  bolts leave from outside her hull, fly a quarter faster from a castle (once, not
//             twice); the helmsman doesn't fire, a gunner seated or standing does
//   crew      shield cover, the diving bell at rest (and not under way), the berth wakes you on deck
//   modules   every module changes something about the ship it's fitted to
import { world, system } from "@minecraft/server";
import fs from "node:fs";
import { PLANS } from "../../BP/scripts/config/plans.js";
import { MODULES, ANCHORS_FIT, sizeClass } from "../../BP/scripts/config/modules.js";
import { newRecord, writeRecord, readRecord, LAUNCHED_TAG, applyRecord } from "../../BP/scripts/ship.js";
import { computeHandling } from "../../BP/scripts/handling.js";
import { ShipFrame, starboardOf, forwardOf } from "../../BP/scripts/frame.js";
import { _test as steerTest, steerBoat, boatStateOf, takeSoundings, toggleLash, dropAnchor, holdAtAnchor } from "../../BP/scripts/steering.js";
import * as crew from "../../BP/scripts/crew.js";
import { makePlayer } from "../../tests/mocks/server.mjs";
import { ILLAGER_CREWS, VILLAGER_CREWS, VILLAGER_TRADES } from "../../BP/scripts/config/sea_people.js";

const ITEMS = new Set(JSON.parse(fs.readFileSync(new URL("./bedrock_items.json", import.meta.url), "utf8")));
const SEA = 63;                      // the water block's top layer
const ships = [];

function arena() {
  const dim = world.getDimension("minecraft:overworld");
  if (!arena.x0) {
    arena.x0 = 3_000_000;
    for (let x = arena.x0 - 90; x <= arena.x0 + 90; x++) for (let z = -90; z <= 90; z++) for (let y = 55; y <= SEA; y++) dim.set(x, y, z, y > SEA - 8 ? "minecraft:water" : "minecraft:sand");
  }
  return dim;
}
function clear() {
  const dim = arena();
  for (const e of [...dim.entities]) { e.isValid = false; }
  dim.entities.length = 0;
  dim.explosions.length = 0;
  steerTest.state.clear();
  ships.length = 0;
}

/** A launched ship: plan, modules, where (dx, dz from the arena's middle), heading. */
export function launch(pid, { modules = [], dx = 0, dz = 0, heading = 0, length = null } = {}) {
  const dim = arena();
  const plan = PLANS[pid];
  const [lo, hi] = plan.lengthRange;
  const step = plan.lengthStep ?? 1;
  const L = length ?? lo + Math.round((hi - lo) / 2 / step) * step;
  const rec = newRecord(plan, "lab", L);
  rec.stage = 5;
  rec.name = `${pid}@${dx},${dz}`;
  rec.modules = [...modules];
  if (plan.rigFamily) rec.sections.rig = { ...(rec.sections.rig ?? {}), sail: true, style: plan.rigStyle };
  const e = dim.spawnEntity(plan.entity ?? `shipwright:${pid}`, { x: arena.x0 + 0.5 + dx, y: SEA + 0.6, z: 0.5 + dz });
  e.setDynamicProperty("shipwright:yaw", heading);
  e.rotation = { x: 0, y: heading };
  writeRecord(e, rec);
  e.addTag(LAUNCHED_TAG);
  e.triggerEvent("shipwright:launch");
  try { applyRecord(e, rec); } catch { /* lab: looks only */ }
  const s = boatStateOf(e);
  s.heading = heading;
  s.stats = computeHandling(rec);
  ships.push(e);
  return e;
}

const statsOf = (e) => boatStateOf(e).stats;
const cond = (e) => readRecord(e)?.condition ?? null;

/** A gunner with the given gamemode, view and held item, at a place. */
function gunner(dim, at, view, held = null) {
  const p = makePlayer(dim, held ? [{ typeId: held, amount: 8 }] : [], "Creative");
  p.location = { ...at };
  p.getViewDirection = () => view;
  p.getHeadLocation = () => ({ x: at.x, y: at.y + 1.6, z: at.z });
  p.onScreenDisplay = { setActionBar(m) { p.bar = m; } };
  return p;
}

/** Projectiles fly: shotTick, then each moves (gravity 0.03, drag 0.99 a tick, as a snowball). */
function fly(dim, ticks = 80) {
  const events = [];
  for (let t = 0; t < ticks; t++) {
    system.currentTick = (system.currentTick ?? 0) + 1;
    events.push(...crew.shotTick());
    for (const p of dim.entities) {
      if (!p.isValid || !/snowball|arrow/.test(p.typeId)) continue;
      p.location = { x: p.location.x + p.velocity.x, y: p.location.y + p.velocity.y, z: p.location.z + p.velocity.z };
      p.velocity = { x: p.velocity.x * 0.99, y: p.velocity.y * 0.99 - 0.03, z: p.velocity.z * 0.99 };
      if (p.location.y < 50) p.isValid = false;
    }
  }
  return events;
}
const later = () => { system.currentTick = (system.currentTick ?? 0) + 200; };

// ---------------------------------------------------------------- lenses

export function idsLens() {
  const issues = [];
  const check = (where, ids) => ids.forEach((i) => { if (i.startsWith("minecraft:") && !ITEMS.has(i)) issues.push(`${where}: ${i} isn't a Bedrock item`); });
  for (const [k, m] of Object.entries(MODULES)) for (const c of m.cost) check(`module ${k}`, c.ids);
  for (const [k, a] of Object.entries(ANCHORS_FIT)) for (const c of a.cost) check(`anchor ${k}`, c.ids);
  for (const [k, c] of Object.entries(ILLAGER_CREWS)) check(`level ${k} crew`, [...c.loot, ...c.treasure].map((x) => x[0]).concat(c.unique.item));
  check("villager trades", [...VILLAGER_TRADES.chart.cost.flatMap((c) => c.ids), ...VILLAGER_TRADES.thanks.map((x) => x[0])]);
  for (const [k, c] of Object.entries(VILLAGER_CREWS)) if (!PLANS[c.ship]) issues.push(`${k} villagers sail a ${c.ship}, which isn't a plan`);
  for (const f of fs.readdirSync(new URL("../../BP/recipes/", import.meta.url))) {
    const s = fs.readFileSync(new URL(`../../BP/recipes/${f}`, import.meta.url), "utf8");
    check(`recipe ${f}`, [...s.matchAll(/"item":\s*"(minecraft:[a-z0-9_]+)"/g)].map((m) => m[1]));
  }
  return { issues };
}

/** Fires one gun from `shooter` at the side facing +x... returns the shot's fate. */
function broadside(shooter, side, lookUp = 0, held = null) {
  const dim = shooter.dimension;
  const s = boatStateOf(shooter);
  const r = starboardOf(s.heading);
  const p = gunner(dim, shooter.location, { x: r.x * side, y: lookUp, z: r.z * side }, held);
  const msg = crew.fire(p, shooter);
  const ev = fly(dim);
  later();
  return { msg, ev: ev[0] ?? null };
}

export function gunsLens(pid) {
  const issues = [];
  const h0 = computeHandling(newRecord(PLANS[pid], "lab", PLANS[pid].lengthRange[0]));
  void h0;
  clear();
  const me = launch(pid, { modules: ["cannon"] });
  const F = new ShipFrame(me.location, 0, statsOf(me));
  const r = starboardOf(0);
  // range: level and lifted, each side, over open water
  const ranges = [];
  for (const look of [0, 0.25]) for (const side of [1, -1]) {
    const { ev } = broadside(me, side, look);
    if (!ev) { issues.push(`a shot (look ${look}, side ${side}) went nowhere`); continue; }
    if (ev.hit === me.id) issues.push("a shot struck her own hull");
    const c = F.centre();
    const d = Math.hypot(ev.at.x - c.x, ev.at.z - c.z);
    ranges.push(+d.toFixed(1));
  }
  if (ranges[0] < 12) issues.push(`a level shot falls ${ranges[0]} out: too short to fight with`);
  if (ranges[2] !== undefined && ranges[2] < ranges[0] + 8) issues.push(`lifting the gun adds little range (${ranges[0]} → ${ranges[2]})`);
  // a target abeam, 18 out from her side, lying parallel
  const mine = statsOf(me);
  const results = {};
  for (const tp of ["carrack", "cog", "faering"]) {
    clear();
    const shooter = launch(pid, { modules: ["cannon"] });
    const target = launch(tp, { dx: r.x * (18 + mine.overallHalfWidth), dz: r.z * 18 + (mine.helmAt ?? 0) * 0 });
    const th = statsOf(target);
    // aim: centre the target abeam (move it so its centre is level with the shooter's centre)
    const sc = new ShipFrame(shooter.location, 0, mine).centre();
    const tc = new ShipFrame(target.location, 0, th).centre();
    target.location = { ...target.location, z: target.location.z + (sc.z - tc.z) };
    let shots = 0, hits = 0, zones = new Set();
    while (target.isValid && shots < 60) {
      shots++;
      const look = 0.02 + 0.01 * (shots % 3);
      const { ev } = broadside(shooter, 1, look);
      if (ev?.hit === target.id) { hits++; zones.add(ev.zone); }
    }
    results[tp] = { shots, hits, sunk: !target.isValid };
    if (!hits) issues.push(`no shot struck a ${tp} lying abeam 18 out`);
    else if (target.isValid) issues.push(`a ${tp} took ${hits} hits and still floats`);
    if (hits && !zones.has("mid")) issues.push(`shots aimed amidships at a ${tp} struck ${[...zones].join("/")}`);
    // bulkheads: the same pounding doesn't sink her
    if (tp === "cog") {
      clear();
      const sh2 = launch(pid, { modules: ["cannon"] });
      const t2 = launch(tp, { modules: ["bulkheads"], dx: r.x * (18 + mine.overallHalfWidth) });
      t2.location = { ...t2.location, z: target.location.z };
      for (let i = 0; i < shots + 10; i++) broadside(sh2, 1, 0.02 + 0.01 * (i % 3));
      if (!t2.isValid) issues.push("bulkheads didn't keep a cog afloat");
      results.bulkheads = cond(t2)?.mid;
    }
  }
  // chain shot: sail, not hull
  clear();
  const s3 = launch(pid, { modules: ["cannon"] });
  const t3 = launch("cog", { dx: r.x * (18 + mine.overallHalfWidth) });
  const c0 = { ...cond(t3) };
  let chainHit = false;
  for (let i = 0; i < 6 && !chainHit; i++) chainHit = broadside(s3, 1, 0.03, "minecraft:iron_chain").ev?.hit === t3.id;
  const c1 = cond(t3);
  if (!chainHit) issues.push("chain shot never struck");
  else if (!(c1.sail < c0.sail) || c1.mid < c0.mid || c1.bow < c0.bow || c1.stern < c0.stern) issues.push(`chain shot: sail ${c0.sail}→${c1.sail}, hull ${c0.mid}→${c1.mid}`);
  if (s3.dimension.explosions.length && chainHit) issues.push("chain shot burst like round shot");
  return { ranges, results, issues };
}

const topSpeed = new Map();
const speeds = (e) => topSpeed.get(e.id) ?? [0];
/** Sails `e` straight ahead at her best for n ticks, checking for collisions as the game does. */
function charge(e, n) {
  const helm = { typeId: "minecraft:player", id: `lab-${e.id}`, isValid: true, location: e.location, dimension: e.dimension,
    inputInfo: { getMovementVector: () => ({ x: 0, y: 1 }), getButtonState: () => "Released" }, getComponent: () => null, sendMessage() {} };
  let hits = 0, before = 0, after = 0;
  for (let t = 0; t < n; t++) {
    system.currentTick = (system.currentTick ?? 0) + 1;
    const s = steerBoat(e, helm);
    const v0 = s.speed;
    topSpeed.set(e.id, [...speeds(e), v0]);
    const k = crew.ramCheck(e);
    if (k && !before) { before = v0; after = boatStateOf(e).speed; }
    hits += k;
    e.location = { ...e.location, x: e.location.x + e.velocity.x, z: e.location.z + e.velocity.z };
  }
  return { hits, before, after };
}

export function ramLens(pid) {
  const issues = [];
  const out = {};
  for (const [label, tp, rammed] of [["ram→carrack", "carrack", true], ["ram→cog", "cog", true], ["bare→cog", "cog", false]]) {
    clear();
    const me = launch(pid, { modules: rammed ? ["ram"] : [] });
    const h = statsOf(me);
    // a target lying across her course, 40 ahead, struck off-centre (near its stern: far from its box)
    const f = forwardOf(0);
    const tgt = launch(tp, { heading: 90, dz: 40 + h.half });
    const th = statsOf(tgt);
    const tf = forwardOf(90);
    const shift = th.half * 0.6;                                // strike 60% of the way to her stern
    tgt.location = { ...tgt.location, x: tgt.location.x + tf.x * (shift + (th.helmAt ?? 0) * -1) * -1 + 0, z: tgt.location.z };
    // put the target's centre on the rammer's track, then move it so the strike lands aft of centre
    const tc = new ShipFrame(tgt.location, 90, th).centre();
    const mc = new ShipFrame(me.location, 0, h).centre();
    tgt.location = { ...tgt.location, x: tgt.location.x + (mc.x - tc.x) + tf.x * shift };
    const c0 = cond(tgt), m0 = cond(me);
    const r = charge(me, 400);
    const c1 = cond(tgt) ?? { bow: 0, mid: 0, stern: 0 }, m1 = cond(me) ?? { bow: 0 };
    const theirs = ["bow", "mid", "stern"].reduce((n, z) => n + (c0[z] - c1[z]), 0);
    const own = m0.bow - m1.bow;
    out[label] = { hits: r.hits, theirs: +theirs.toFixed(3), own: +own.toFixed(3), kept: r.before ? +(r.after / r.before).toFixed(2) : null };
    if (!r.hits && Math.max(...speeds(me)) < crew.RAM_SPEED) { out[label].note = "too slow to ram here"; continue; }
    if (!r.hits) { issues.push(`${label}: never struck (sailed through her)`); continue; }
    if (r.after > r.before * 0.6) issues.push(`${label}: kept ${(100 * r.after / r.before).toFixed(0)}% of her way`);
    if (rammed && th.weight <= h.weight * 1.5 && own > theirs) issues.push(`${label}: the ram hurt her own bow (${own.toFixed(3)}) more than the ship she struck (${theirs.toFixed(3)})`);
    void f;
  }
  // the ram is worth fitting: against the same ship, it does more and costs her own bow less
  const a = out["ram→cog"], b = out["bare→cog"];
  if (a?.hits && b?.hits && !(a.theirs > b.theirs * 1.5 && a.own < b.own)) issues.push(`the ram makes little difference (ram ${a.theirs}/${a.own}, bare ${b.theirs}/${b.own}: theirs/own)`);
  // a slow touch: stopped, unhurt
  clear();
  const me = launch(pid);
  const h = statsOf(me);
  const stemAt = -(h.helmAt ?? 0) + h.half;                 // her stem, ahead of her origin
  const tgt = launch("cog", { heading: 90, dz: stemAt + 3 + (computeHandling(newRecord(PLANS.cog, "lab", 16)).beamEach ?? 2) / 2 });
  const tc = new ShipFrame(tgt.location, 90, statsOf(tgt)).centre();
  const mc = new ShipFrame(me.location, 0, h).centre();
  tgt.location = { ...tgt.location, x: tgt.location.x + (mc.x - tc.x) };
  boatStateOf(me).speed = 0.05;
  const helm = { typeId: "minecraft:player", id: "lab-slow", isValid: true, location: me.location, dimension: me.dimension,
    inputInfo: { getMovementVector: () => ({ x: 0, y: 0.3 }), getButtonState: () => "Released" }, getComponent: () => null, sendMessage() {} };
  let deepest = 0;
  for (let t = 0; t < 200; t++) {
    system.currentTick++;
    const s = steerBoat(me, helm);
    s.speed = Math.min(s.speed, 0.08);
    crew.ramCheck(me);
    me.location = { ...me.location, z: me.location.z + forwardOf(0).z * boatStateOf(me).speed };
    const stem = new ShipFrame(me.location, 0, h).fromCentre(h.half, 0).z;
    const side = new ShipFrame(tgt.location, 90, statsOf(tgt)).centre().z - (statsOf(tgt).beamEach ?? 1.5) / 2;
    deepest = Math.max(deepest, stem - side);
  }
  const tc2 = cond(tgt);
  if (["bow", "mid", "stern"].some((z) => tc2[z] < 1)) issues.push("a slow touch hurt the ship she touched");
  if (deepest > 2.5) issues.push(`a slow touch sailed ${deepest.toFixed(1)} blocks into the other ship`);
  out.touch = +deepest.toFixed(2);
  return { out, issues };
}

export function crossbowLens(pid) {
  const issues = [];
  clear();
  const plan = PLANS[pid];
  const mods = ["crossbow", ...(MODULES.castle.sizes.includes(sizeClass(PLANS[pid].lengthRange[0] + 1)) ? [] : [])];
  const me = launch(pid, { modules: mods });
  const h = statsOf(me);
  const F = new ShipFrame(me.location, 0, h);
  const dim = me.dimension;
  // a gunner at mid-deck, looking each way
  const at = F.fromCentre(0, 0, (h.length ?? 0) >= 11 ? (h.deckUp ?? 0) + 0.4 : 0.35);   // on deck, or seated
  const r = starboardOf(0), f = forwardOf(0);
  for (const [name, v] of [["starboard", { x: r.x, y: 0, z: r.z }], ["port", { x: -r.x, y: 0, z: -r.z }], ["ahead", { x: f.x, y: 0.1, z: f.z }]]) {
    const p = gunner(dim, at, v);
    me.riders = [{ typeId: "minecraft:player", id: "someone-else" }, p];
    later();
    crew.fire(p, me);
    const a = dim.entities.filter((x) => x.typeId === "minecraft:arrow" && x.isValid).pop();
    if (!a) { issues.push(`no bolt looking ${name}`); continue; }
    if (a.location.y - me.location.y < (h.rail ?? 1) + (h.deckUp ?? 0) * 0 + 0.1 && crew.inHull(me.location, F, h, a.location, 0)) issues.push(`the bolt looking ${name} starts below her rail (${(a.location.y - me.location.y).toFixed(2)} vs ${(h.rail ?? 1).toFixed(2)})`);
    if (!a.hasTag(crew.MOUNT_TAG)) issues.push("mount bolts aren't marked: the castle would boost them twice");
    a.isValid = false;
  }
  // the helmsman doesn't fire
  const helm = gunner(dim, at, { x: r.x, y: 0, z: r.z });
  me.riders = [helm];
  later();
  const n0 = dim.entities.filter((x) => x.typeId === "minecraft:arrow" && x.isValid).length;
  crew.fire(helm, me);
  if (dim.entities.filter((x) => x.typeId === "minecraft:arrow" && x.isValid).length > n0) issues.push("the helmsman fired the crossbow");
  // castle: once
  if (MODULES.castle.sizes.includes(sizeClass(readRecord(me).dims.length))) {
    clear();
    const c = launch(pid, { modules: ["crossbow", "castle"] });
    const p = gunner(dim, at, { x: r.x, y: 0, z: r.z });
    c.riders = [{ typeId: "minecraft:player", id: "x" }, p];
    later();
    crew.fire(p, c);
    const a = dim.entities.filter((x) => x.typeId === "minecraft:arrow" && x.isValid).pop();
    const sp = a && Math.hypot(a.velocity.x, a.velocity.y, a.velocity.z);
    if (!a || Math.abs(sp - 4) > 0.05) issues.push(`a castle bolt flies at ${sp?.toFixed(2)} (want 4.0: a quarter faster, once)`);
  }
  void plan;
  return { issues };
}

export function crewLens(pid) {
  const issues = [];
  const plan = PLANS[pid];
  const size = sizeClass(Math.round((plan.lengthRange[0] + plan.lengthRange[1]) / 2));
  const fits = (k) => MODULES[k].sizes.includes(size) && (!MODULES[k].tradition || MODULES[k].tradition === plan.tradition);
  const out = {};
  if (fits("shield_rail")) {
    clear();
    const e = launch(pid, { modules: ["shield_rail"] });
    const rec = readRecord(e);
    rec.shields = Array.from({ length: 6 }, () => true);
    out.cover = crew.shieldCover(rec);
    if (!(out.cover > 0)) issues.push("shields aboard give no cover");
  }
  if (fits("diving_bell")) {
    clear();
    const e = launch(pid, { modules: ["diving_bell"] });
    const h = statsOf(e);
    const c = new ShipFrame(e.location, 0, h).centre();
    const diver = makePlayer(e.dimension);
    diver.location = { x: c.x + 1, y: e.location.y - 5, z: c.z };
    const far = makePlayer(e.dimension);
    far.location = { x: c.x, y: e.location.y - 5, z: c.z + h.half };
    const effects = new Map();
    for (const p of [diver, far]) p.addEffect = (k) => effects.set(p.id, k);
    world.players = [diver, far];
    boatStateOf(e).speed = 0;
    crew.bellCheck(e);
    if (!effects.has(diver.id)) issues.push("the bell gave no air to a diver under her middle");
    if (effects.has(far.id)) issues.push("the bell gave air to a diver off her stern");
    effects.clear();
    boatStateOf(e).speed = 0.2;
    crew.bellCheck(e);
    if (effects.size) issues.push("the bell gave air under way");
    world.players = [];
  }
  if (fits("bunk") || fits("deckhouse")) {
    clear();
    const e = launch(pid, { modules: [fits("bunk") ? "bunk" : "deckhouse"] });
    const h = statsOf(e);
    const p = makePlayer(e.dimension);
    p.location = { ...e.location };
    const msg = crew.takeBerth(p, e);
    if (!msg) issues.push("a bed aboard didn't make a berth");
    world.dims["minecraft:overworld"] = e.dimension;
    const ok = crew.wakeAboard(p);
    if (!ok) issues.push("didn't wake aboard");
    else {
      const F = new ShipFrame(e.location, 0, h);
      const feet = p.location.y - e.location.y;
      if (!crew.inHull(e.location, F, h, { ...p.location, y: e.location.y }, 0)) issues.push("woke over the water");
      if (feet < 0.4) issues.push(`woke ${feet.toFixed(2)} above her origin: in the water`);
      if (feet > (h.rail ?? 1) + (h.deckUp ?? 0) + 1.6) issues.push(`woke ${feet.toFixed(2)} up: in the air over her deck`);
      out.wake = +feet.toFixed(2);
    }
  }
  return { out, issues };
}

/**
 * The ship's gear: the hold doubles the sea chest; a lookout warns of a shoal twice as far ahead;
 * a lashed tiller holds her course; an iron anchor holds in a wind that drags a stone one.
 */
export function gearLens(pid) {
  const issues = [];
  const out = {};
  const plan = PLANS[pid];
  const size = sizeClass(plan.lengthRange[1]);
  if (MODULES.hold.sizes.includes(size)) {
    clear();
    const a = launch(pid), b = launch(pid, { modules: ["hold"], dx: 40 });
    const sa = a.getComponent("minecraft:inventory")?.container?.size, sb = b.getComponent("minecraft:inventory")?.container?.size;
    out.chest = [sa, sb];
    if (!(sb >= 2 * sa)) issues.push(`the hold didn't double the sea chest (${sa} → ${sb})`);
  }
  if (MODULES.lookout.sizes.includes(size)) {
    const warnAt = (mods) => {
      clear();
      const e = launch(pid, { modules: mods });
      const s = boatStateOf(e), h = statsOf(e);
      s.speed = 0.2;
      const dim = e.dimension;
      const c = new ShipFrame(e.location, 0, h).centre();
      let first = null;
      for (let d = 30; d >= 2 && first === null; d--) {
        const z = Math.floor(c.z + h.half + d);
        for (let x = Math.floor(c.x) - 3; x <= Math.floor(c.x) + 3; x++) for (let y = 55; y <= SEA; y++) dim.set(x, y, z, "minecraft:sand");
        if (takeSoundings(e, s, h).alert === "shoal") first = d;
        for (let x = Math.floor(c.x) - 3; x <= Math.floor(c.x) + 3; x++) for (let y = SEA - 7; y <= SEA; y++) dim.set(x, y, z, "minecraft:water");
      }
      return first ?? 0;
    };
    const plain = warnAt([]), look = warnAt(["lookout"]);
    out.shoal = [plain, look];
    if (!plain) issues.push("no warning of a shoal dead ahead");
    else if (!(look >= plain * 1.8)) issues.push(`the lookout sights a shoal ${look} ahead, no further than without (${plain})`);
  }
  if (MODULES.navigation.sizes.includes(size)) {
    clear();
    const e = launch(pid, { modules: ["navigation"] });
    const p = makePlayer(e.dimension);
    p.onScreenDisplay = { setActionBar() {} };
    const s = boatStateOf(e);
    s.speed = 0.15;
    toggleLash(e, p);
    const h0 = s.heading;
    for (let t = 0; t < 200; t++) { system.currentTick++; steerTest.tick(); e.location = { ...e.location, x: e.location.x + e.velocity.x, z: e.location.z + e.velocity.z }; }
    out.lash = { wander: +Math.abs(s.heading - h0).toFixed(1), speed: +s.speed.toFixed(3) };
    if (!s.lashed) issues.push("the tiller didn't stay lashed");
    else if (Math.abs(s.heading - h0) > 25) issues.push(`a lashed tiller wandered ${Math.abs(s.heading - h0).toFixed(0)}° in 10 s`);
  }
  const drag = (type) => {
    clear();
    const e = launch(pid);
    const s = boatStateOf(e);
    s.anchorType = type;
    dropAnchor(e, s, true);
    s.wind = { x: 1.3, z: 0 };
    const x0 = s.anchor.x;
    for (let t = 0; t < 200; t++) holdAtAnchor(e, s);
    return s.anchor.x - x0;
  };
  out.anchor = [+drag("stone").toFixed(2), +drag("iron").toFixed(2)];
  if (!(out.anchor[0] > 0.5)) issues.push(`a stone anchor held in a gale (${out.anchor[0]})`);
  if (out.anchor[1] > 0.05) issues.push(`an iron anchor dragged ${out.anchor[1]} in a wind it should hold`);
  return { out, issues };
}

/** Every module, fitted where it can be, changes something about the ship (or is a known look-only one). */
export function modulesLens() {
  const issues = [];
  const LOOKS = new Set(["canopy"]);            // shade and shelter: the look is the point
  const byKey = {};
  for (const [k, m] of Object.entries(MODULES)) {
    const pid = Object.keys(PLANS).find((p) => p !== "testship" && m.sizes.some((sz) => sz === sizeClass(PLANS[p].lengthRange[1])) && !PLANS[p][k] && !PLANS[p].twin);   // a learned tradition's module fits any hull
    if (!pid) { issues.push(`${k}: no boat can take it`); continue; }
    const plan = PLANS[pid];
    const L = plan.lengthRange[1];
    const a = newRecord(plan, "lab", L), b = newRecord(plan, "lab", L);
    if (plan.rigFamily) for (const r of [a, b]) r.sections.rig = { ...(r.sections.rig ?? {}), sail: true, style: plan.rigStyle };
    b.modules = [k];
    const ha = computeHandling(a), hb = computeHandling(b);
    const changed = Object.keys(hb).filter((f) => typeof hb[f] !== "object" && hb[f] !== ha[f]);
    byKey[k] = { pid, changed: changed.slice(0, 5) };
    if (!changed.length && !LOOKS.has(k) && !["ram", "crossbow", "cannon", "castle", "shield_rail", "diving_bell", "hold", "bunk", "bulkheads", "deckhouse"].includes(k))
      issues.push(`${k} on a ${pid}: changes nothing in her handling and has no other effect`);
  }
  return { byKey, issues };
}

function main() {
  const args = process.argv.slice(2);
  const pids = args.filter((a) => PLANS[a]);
  const all = Object.keys(PLANS).filter((k) => k !== "testship");
  const want = pids.length ? pids : all;
  let bad = 0;
  const say = (label, r, extra = "") => {
    bad += r.issues.length;
    console.log(`${label.padEnd(24)} ${r.issues.length ? r.issues.length + " issue(s)" : "clean"} ${extra}`);
    for (const i of r.issues) console.log(`    ${i}`);
  };
  say("ids", idsLens());
  say("modules", modulesLens());
  for (const pid of want) {
    const size = sizeClass(PLANS[pid].lengthRange[1]);
    if (MODULES.cannon.sizes.includes(size)) { const g = gunsLens(pid); say(`${pid} guns`, g, JSON.stringify({ ranges: g.ranges, ...g.results })); }
    const rm = ramLens(pid); say(`${pid} ram`, rm, JSON.stringify(rm.out));
    if (MODULES.crossbow.sizes.includes(size)) say(`${pid} crossbow`, crossbowLens(pid));
    const c = crewLens(pid); say(`${pid} crew`, c, JSON.stringify(c.out));
    const g = gearLens(pid); say(`${pid} gear`, g, JSON.stringify(g.out));
  }
  process.exitCode = bad ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
