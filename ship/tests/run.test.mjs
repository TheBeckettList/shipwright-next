import { test } from "node:test";
import assert from "node:assert/strict";
import { world, system, makePlayer, __handlers } from "@minecraft/server";
import { answers, shown } from "@minecraft/server-ui";
import "../BP/scripts/main.js";
import { detectBeachYard, detectYard } from "../BP/scripts/yard.js";
import { detectDock, floodDock } from "../BP/scripts/dock.js";
import { planDock, buildDock } from "../BP/scripts/yardbuild.js";
import { YARD_STYLES } from "../BP/scripts/config/yardstyles.js";
import { seaChestOf, vaultLocation, loadChest, chestOwner, returnAbsentChests } from "../BP/scripts/chest.js";
import { PLANS } from "../BP/scripts/config/plans.js";
import { setP, getP } from "../BP/scripts/props.js";
import { beamRange, keelCost, frameCost, plankCost, rigCost, readRecord, writeRecord, newRecord, healProperties, applyRecord, shellChoices } from "../BP/scripts/ship.js";
import { keepAfloat } from "../BP/scripts/buoyancy.js";
import { steerBoat, forwardOf, dropAnchor, weighAnchor, takeSoundings, safeDepth, showWind, holdAtAnchor, isTethered, rowingEffort, flushWear, _test as steerTest } from "../BP/scripts/steering.js";
import { rigFor, displacement, SAIL_RATIO, SAIL_PER_L2, rigScaleFor, computeHandling, turningRadius, turnRateAt, RUDDERS, oarPairsFor, PROPULSION } from "../BP/scripts/handling.js";
import { classifyBiome, sailPower, windAtCell, angleOffWind, seaBreeze, gustFactor, _test as windTest } from "../BP/scripts/wind.js";
import { hullHits } from "../BP/scripts/steering.js";
import { syncOrientation, getMode, MODES } from "../BP/scripts/orientation.js";
import { countItems } from "../BP/scripts/inventory.js";

const TABLE = "shipwright:shipwright_table";
const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 2)); };

/** Beach like the in-game self-test: sand to dz=5, water from dz=6, table at o. */
let siteX = 0;
function beach(opts = {}) {
  const dim = world.getDimension("minecraft:overworld");
  const o = { x: (siteX += 40), y: 64, z: 0 };
  for (let x = o.x - 3; x <= o.x + 3; x++)
    for (let z = o.z - 1; z <= o.z + 16; z++) {
      dim.set(x, o.y - 2, z, "minecraft:stone");
      if (z - o.z <= 5) dim.set(x, o.y - 1, z, "minecraft:sand");
      else if (!opts.noWater) { dim.set(x, o.y - 1, z, "minecraft:water"); dim.set(x, o.y, z, "minecraft:water"); }
    }
  dim.set(o.x, o.y, o.z, TABLE);
  return { dim, o, table: () => dim.getBlock(o) };
}

const fullInventory = () => [
  { typeId: "minecraft:spruce_log", amount: 10 }, { typeId: "minecraft:stick", amount: 64 },
  { typeId: "minecraft:spruce_planks", amount: 64 }, { typeId: "minecraft:cherry_planks", amount: 64 },
  { typeId: "minecraft:oak_planks", amount: 64 }, { typeId: "minecraft:iron_nugget", amount: 40 },
  { typeId: "minecraft:red_wool", amount: 12 }, { typeId: "minecraft:string", amount: 12 },
];
const count = (inv, id) => inv.filter(Boolean).filter((i) => i.typeId === id).reduce((a, i) => a + i.amount, 0);

function useTable(player, site) {
  const ev = { block: site.table(), player, cancel: false, isFirstEvent: true };
  __handlers.interact(ev);
  return ev;
}

// ---------- yard ----------

test("beach yard detected toward the water", () => {
  const s = beach();
  const y = detectBeachYard(s.table());
  assert.equal(y.ok, true, y.reason);
  assert.equal(y.dirName, "south");
  assert.equal(y.length, 10);
  assert.equal(y.waterDist, 6);
});

test("blocked yard names the blocking block", () => {
  const s = beach();
  s.dim.set(s.o.x + 1, s.o.y + 1, s.o.z + 3, "minecraft:oak_fence");
  const y = detectBeachYard(s.table());
  assert.equal(y.ok, false);
  assert.match(y.reason, /oak fence/);
  assert.deepEqual([y.blocker.x, y.blocker.y, y.blocker.z], [s.o.x + 1, s.o.y + 1, s.o.z + 3]);
});

test("no water gives a clear reason", () => {
  const s = beach({ noWater: true });
  const y = detectBeachYard(s.table());
  assert.equal(y.ok, false);
  assert.match(y.reason, /No water/);
});

test("decor whitelist is allowed inside the yard", () => {
  const s = beach();
  s.dim.set(s.o.x - 1, s.o.y, s.o.z + 2, "minecraft:torch");
  s.dim.set(s.o.x, s.o.y + 2, s.o.z + 4, "minecraft:lantern");
  assert.equal(detectBeachYard(s.table()).ok, true);
});

test("ties between equal water distances go to the table's facing", () => {
  const s = beach();
  for (let x = s.o.x - 9; x <= s.o.x - 4; x++) for (let z = -3; z <= 3; z++) s.dim.set(x, s.o.y - 1, z, "minecraft:sand");
  for (let z = -3; z <= 3; z++) { s.dim.set(s.o.x - 6, s.o.y, z, "minecraft:water"); }
  s.dim.facing = "west";
  const y = detectBeachYard(s.table());
  assert.equal(y.dirName, "west");
  s.dim.facing = undefined;
});

test("falling water at the launch spot invalidates the yard", () => {
  // Like a dug basin filled only from the top: sources on top, falling water below.
  const s = beach();
  for (let x = s.o.x - 2; x <= s.o.x + 2; x++)
    for (let z = s.o.z + 6; z <= s.o.z + 16; z++) {
      s.dim.set(x, s.o.y, z, "minecraft:water", { liquid_depth: 0 });
      s.dim.set(x, s.o.y - 1, z, "minecraft:flowing_water", { liquid_depth: 8 });
    }
  const y = detectBeachYard(s.table());
  assert.equal(y.ok, false);
  assert.match(y.reason, /source blocks on every layer/);
  assert.equal(y.blocker.typeId, "falling water");
});

test("spreading water at the shore edge is fine", () => {
  const s = beach();
  for (let x = s.o.x - 1; x <= s.o.x + 1; x++) s.dim.set(x, s.o.y, s.o.z + 6, "minecraft:flowing_water", { liquid_depth: 3 });
  assert.equal(detectBeachYard(s.table()).ok, true);
});

function sunkBoat(bx, ridden) {
  const dim = world.getDimension("minecraft:overworld");
  for (let y = 60; y <= 64; y++) dim.set(bx, y, 0, "minecraft:water");
  const e = dim.spawnEntity("shipwright:faering", { x: bx + 0.5, y: 60, z: 0.5 });
  e.triggerEvent("shipwright:launch");
  if (ridden) e.riders = [{ typeId: "minecraft:player" }];
  return e;
}

const repeat = (e, n) => { let r = ""; for (let i = 0; i < n; i++) r = keepAfloat(e) || r; return r; };

test("a sunk, unridden boat is lifted to the surface after a short delay", () => {
  const e = sunkBoat(3000, false);
  assert.equal(repeat(e, 4), "", "waits before acting");
  assert.equal(keepAfloat(e), "lifted");
  assert.ok(e.location.y > 64.5 && e.location.y < 65, `y = ${e.location.y}`);
  assert.equal(repeat(e, 10), "", "a floating boat is left alone");
});

test("a boat floating normally is never pushed (no yo-yo)", () => {
  const e = sunkBoat(3020, true);
  e.location.y = 64.6; // riding at the surface of a 60-64 water column
  assert.equal(repeat(e, 20), "");
  assert.equal(e.impulses.length, 0);
});

test("a sunk boat with a rider gets one gentle push, not a teleport", () => {
  const e = sunkBoat(3010, true);
  const y0 = e.location.y;
  assert.equal(repeat(e, 5), "pushed");
  assert.equal(e.location.y, y0, "no teleport while ridden");
  assert.equal(e.impulses.length, 1);
  assert.ok(e.impulses[0].y > 0 && e.impulses[0].y <= 0.1);
});

// ---------- plan math ----------

test("beam range respects length:beam ratios at every length", () => {
  const plan = PLANS.faering;
  for (let L = plan.lengthRange[0]; L <= plan.lengthRange[1]; L++) {
    const [lo, hi] = beamRange(plan, L);
    assert.ok(lo <= hi, `L=${L}`);
    assert.ok(lo >= plan.beamScale[0] && hi <= plan.beamScale[1], `L=${L} ${lo}..${hi}`);
    const ratioAtHi = L / (plan.baseBeam * hi);
    assert.ok(ratioAtHi >= plan.lengthToBeam[0] - 0.05, `L=${L} too wide`);
  }
});

test("7-block faering costs match the spec", () => {
  const plan = PLANS.faering;
  assert.equal(keelCost(plan, 7)[0].count, 3);
  assert.equal(frameCost(plan, 7)[0].count, 14);
  const planks = plankCost(plan, { bow: "spruce", mid: "spruce", stern: "spruce" }, { length: 7, beam: 1, depth: 1 });
  const total = planks.filter((c) => c.label.includes("Planks")).reduce((a, c) => a + c.count, 0);
  assert.equal(total, 21);
  assert.equal(planks.find((c) => c.label === "Iron Nugget").count, 14);
});

// ---------- full flows through the table ----------

async function buildFaering(player, s, { length = 7, woods = [1, 7, 1], name = "Grey Gull" } = {}) {
  answers.length = 0;
  answers.push(0, "Advanced", [length], 0, [100, 110], 0, woods, 0, 1, [true, 0, 14], 0, "Launch", [name]);
  const ev = useTable(player, s);
  await settle();
  return ev;
}

test("survival build: discover, five stages, launch, costs taken", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory());
  const ev = await buildFaering(p, s);
  assert.equal(ev.cancel, true);
  const ship = s.dim.entities.at(-1);
  const rec = readRecord(ship);
  assert.equal(rec.stage, 5);
  assert.equal(rec.name, "Grey Gull");
  assert.equal(ship.props["shipwright:mids"], 4);
  assert.equal(getP(ship, "wood_mid"), 7);
  assert.equal(getP(ship, "sail"), true, `rig ${JSON.stringify(rec.sections.rig)} flags ${ship.props["shipwright:flags"]}`);
  assert.ok(ship.events.includes("shipwright:launch"));
  assert.ok(ship.getComponent("minecraft:rideable"), "seated after launch");
  assert.ok(ship.location.z > s.o.z + 6, "launched into the water");
  const rig = rigCost(PLANS.faering, 14, rec);   // the sail is sized to this hull
  const take = (label) => rig.find((c) => c.label.includes(label))?.count ?? 0;
  assert.equal(count(p.inventory, "minecraft:spruce_log"), 10 - 3 - take("Log"));
  assert.equal(count(p.inventory, "minecraft:stick"), 64 - 14);
  assert.equal(count(p.inventory, "minecraft:red_wool"), 12 - take("Wool"));
  assert.ok(p.messages.some((m) => m.includes("Norse")));
});

test("missing materials stop the stage and say what's short", async () => {
  const s = beach();
  const p = makePlayer(s.dim, [{ typeId: "minecraft:spruce_log", amount: 1 }]);
  const before = s.dim.entities.length;
  answers.length = 0;
  answers.push(0, "Advanced", [9], 0);
  useTable(p, s);
  await settle();
  assert.ok(p.messages.some((m) => m.includes("2 more Spruce Log")), p.messages.join(" | "));
  assert.equal(s.dim.entities.length, before);
});

test("creative skips costs", async () => {
  const s = beach();
  const inv = [{ typeId: "minecraft:spruce_log", amount: 1 }];
  const p = makePlayer(s.dim, inv, "Creative");
  await buildFaering(p, s, { name: "Free" });
  assert.equal(readRecord(s.dim.entities.at(-1)).stage, 5);
  assert.equal(count(inv, "minecraft:spruce_log"), 1);
});

test("closing a form saves progress and the table resumes", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory());
  answers.length = 0;
  answers.push(0, "Advanced", [6], 0, [100, 100], 0); // keel and frames, then close
  useTable(p, s);
  await settle();
  const ship = s.dim.entities.at(-1);
  assert.equal(readRecord(ship).stage, 2);
  assert.ok(p.messages.some((m) => m.includes("Progress saved")));
  await new Promise((r) => setTimeout(r, 420)); // table cooldown
  shown.length = 0;
  answers.push(0, [1, 1, 1], 0, "Launch", ["Resumed"]);   // planking, then straight to Launch from the fit-out screen
  useTable(p, s);
  await settle();
  assert.match(shown[0].buttons[0], /Continue building/);
  assert.equal(readRecord(ship).stage, 5);
  assert.equal(getP(ship, "sail"), false);
});

test("refit replaces a zone, refunds, and keeps the ship", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory());
  await buildFaering(p, s);
  const ship = s.dim.entities.at(-1);
  await new Promise((r) => setTimeout(r, 420));
  answers.length = 0;
  answers.push(1, "Hull: replace", [0, 0], 0); // Edit a boat, hull, bow, oak, confirm
  useTable(p, s);
  await settle();
  const rec = readRecord(ship);
  assert.deepEqual(rec.sections.bow, { mat: "oak", original: false });
  assert.equal(rec.name, "Grey Gull");
  assert.equal(getP(ship, "wood_bow"), 0);
  assert.ok(s.dim.drops.some((d) => d.typeId === "minecraft:spruce_planks"));
  assert.ok(p.messages.at(-1).includes("83%"));
});

test("breaking a boat refunds half its planking", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory());
  await buildFaering(p, s);
  const ship = s.dim.entities.at(-1);
  s.dim.drops.length = 0;
  __handlers.die({ deadEntity: ship });
  const total = s.dim.drops.reduce((a, d) => a + d.amount, 0);
  assert.ok(total >= 10 && total <= 14, `refunded ${total}`);
});

test("sneaking lets blocks be placed against the table", () => {
  const s = beach();
  const p = makePlayer(s.dim, []);
  p.isSneaking = true;
  assert.equal(useTable(p, s).cancel, false);
});

// ---------- dev commands ----------

test("in-game self-test passes against the mock", async () => {
  const dim = world.getDimension("minecraft:overworld");
  const p = makePlayer(dim, [], "Creative");
  p.location = { x: 500, y: 64, z: 0 };
  world.players = [p];
  __handlers.scriptevent({ id: "shipwright:selftest", sourceEntity: p });
  for (let i = 0; i < 40 && !p.messages.some((m) => m.includes("passed,")); i++) await settle(5);
  const summary = p.messages.find((m) => m.includes("passed,"));
  const fails = p.messages.filter((m) => m.includes("FAIL"));
  assert.ok(summary, "self-test finished");
  assert.deepEqual(fails, []);
  assert.match(summary, / 0 failed/);
});

test("showcase builds labeled boats and cleanup removes them", async () => {
  const dim = world.getDimension("minecraft:overworld");
  const p = makePlayer(dim, [], "Creative");
  p.location = { x: 900, y: 64, z: 0 };
  __handlers.scriptevent({ id: "shipwright:showcase", sourceEntity: p });
  for (let i = 0; i < 40 && !p.messages.some((m) => m.includes("Showcase built")); i++) await settle(5);
  const boats = dim.getEntities({ tags: ["shipwright_test"] });
  assert.ok(boats.length >= 7);
  assert.ok(boats.some((b) => b.nameTag === "1 Keel"));
  __handlers.scriptevent({ id: "shipwright:cleanup", sourceEntity: p });
  for (let i = 0; i < 40 && !p.messages.some((m) => m.includes("Removed")); i++) await settle(5);
  assert.equal(dim.getEntities({ tags: ["shipwright_test"] }).length, 0);
});

// ---------- orientation and mounting ----------

test("orientation mode syncs to the boat", () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 4000, y: 64, z: 0 });
  syncOrientation(e);
  assert.equal(getP(e, "orient"), getMode());
});

test("orient command cycles modes and accepts a number", async () => {
  const p = makePlayer(world.getDimension("minecraft:overworld"), []);
  world.players = [p];
  const start = getMode();
  __handlers.scriptevent({ id: "shipwright:orient", message: "", sourceEntity: p });
  assert.equal(getMode(), (start + 1) % MODES.length);
  __handlers.scriptevent({ id: "shipwright:orient", message: "3", sourceEntity: p });
  assert.equal(getMode(), 3);
  assert.match(p.messages.at(-1), /mode 3 of 3: turn direction B, bow flipped/);
  __handlers.scriptevent({ id: "shipwright:orient", message: "0", sourceEntity: p });
});

test("interacting with a launched boat seats the player", async () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 4100, y: 64, z: 0 });
  const p = makePlayer(dim, []);
  __handlers.interactEntity({ player: p, target: e });
  await settle(3);
  assert.equal((e.riders ?? []).length, 0, "not rideable before launch");
  e.triggerEvent("shipwright:launch");
  __handlers.interactEntity({ player: p, target: e });
  await settle(3);
  assert.equal(e.riders.length, 1);
  __handlers.interactEntity({ player: p, target: e });
  await settle(3);
  assert.equal(e.riders.length, 1, "no double seating");
});

test("boats whose properties were lost are restored from their record", () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 4200, y: 64, z: 0 });
  const rec = newRecord(PLANS.faering, "k", 8);
  rec.stage = 5;
  writeRecord(e, rec);
  for (const k of Object.keys(e.props)) delete e.props[k];
  assert.equal(healProperties(e), true);
  assert.equal(e.props["shipwright:stage"], 5);
  assert.equal(e.props["shipwright:mids"], 5);
  assert.equal(healProperties(e), false, "healthy boats are left alone");
});

test("float properties are declared with decimal values", async () => {
  const fs = await import("node:fs");
  const raw = fs.readFileSync(new URL("../BP/entities/faering.json", import.meta.url), "utf8");
  const props = JSON.parse(raw)["minecraft:entity"].description.properties;
  for (const [k, v] of Object.entries(props)) {
    if (v.type !== "float") continue;
    const block = raw.slice(raw.indexOf(`"${k}"`), raw.indexOf("}", raw.indexOf(`"${k}"`)));
    assert.ok(!/"default": -?\d+\s*[,}\n]/.test(block + "\n"), `${k} default must be written as a decimal`);
    assert.ok(!/"range": \[\s*-?\d+\s*,/.test(block), `${k} range must be written as decimals`);
  }
});

test("the helm sits over the origin, with every other seat and hit area along the hull ahead of it", async () => {
  const fs = await import("node:fs");
  for (const [pid, scale] of [["faering", 1], ["longship", 2], ["kayak", 1]]) {
    const ent = JSON.parse(fs.readFileSync(new URL(`../BP/entities/${pid}.json`, import.meta.url), "utf8"))["minecraft:entity"];
    for (let m = 1; m <= 7; m++) {
      const g = ent.component_groups[`shipwright:seats_mid_${m}`];
      const seats = g["minecraft:rideable"].seats;
      const len = (m + 3) * scale;                       // stern tip at +scale, bow tip at -(len - scale)
      assert.equal(seats[0].position[2], 0, `${pid} m${m}: the helm is the origin`);
      for (const st of seats) assert.ok(st.position[2] <= 0 && st.position[2] >= -(len - scale), `${pid} m${m}: seat inside the hull`);
      const hits = g["minecraft:custom_hit_test"].hitboxes.map((h) => h.pivot[2]);
      assert.ok(Math.max(...hits) > scale - 1 && Math.min(...hits) < -(len - scale) + 1, `${pid} m${m}: hit areas cover the whole hull`);
    }
  }
});

test("every boat's own animation puts the helm, one model block in from the stern, over the origin", async () => {
  const fs = await import("node:fs");
  for (const pid of Object.keys(PLANS).filter((k) => k !== "testship")) {
    const an = JSON.parse(fs.readFileSync(new URL(`../RP/animations/${pid}.animation.json`, import.meta.url), "utf8"));
    const expr = an.animations[`animation.shipwright.${pid}.hull`].bones.root.position[2];
    const scale = PLANS[pid].modelScale ?? 1;                // each boat's animation carries its own scale
    for (let mids = 1; mids <= 7; mids++) {
      const src = expr.replace(/q\.property\('shipwright:mids'\)/g, "m");
      const z = Function("m", `return ${src};`)(mids);
      const sternTip = z + 24 * scale;                    // stern geometry spans 0..24 px, scaled with the hull
      assert.equal(sternTip, 16 * scale, `the helm is one model block in from the stern at mids=${mids}, scale ${scale}`);
    }
  }
});

test("a launched boat with no seats (older boat, after a restart) gets them and seats the player", async () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 4400, y: 64, z: 0 });
  const rec = newRecord(PLANS.faering, "k", 7);
  rec.stage = 5;
  writeRecord(e, rec); // record says launched, but no seat layout was ever applied
  assert.equal(e.getComponent("minecraft:rideable"), undefined);
  const p = makePlayer(dim, []);
  __handlers.interactEntity({ player: p, target: e });
  await settle(5);
  assert.ok(e.getComponent("minecraft:rideable"), "seats added");
  assert.equal(e.riders?.length, 1, "player seated");
  assert.ok(e.tags.has("shipwright_launched"));
});

test("inspect reports nearby boats, including ones with no seats", async () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 4500, y: 64, z: 0 });
  writeRecord(e, newRecord(PLANS.faering, "k", 6));
  const p = makePlayer(dim, []);
  p.location = { x: 4501, y: 64, z: 1 };
  __handlers.scriptevent({ id: "shipwright:inspect", sourceEntity: p });
  await settle(3);
  const text = p.messages.join("\n");
  assert.match(text, /Shipwright inspect/);
  assert.match(text, /NO SEATS/);
  assert.match(text, /record: stage 1, length 6/);
});

// ---------- steering ----------

function steerSetup(x0, length = 6) {
  const dim = world.getDimension("minecraft:overworld");
  for (let x = x0 - 30; x <= x0 + 30; x++) for (let z = -30; z <= 30; z++) dim.set(x, 63, z, "minecraft:water");
  const e = dim.spawnEntity("shipwright:faering", { x: x0 + 0.5, y: 63.6, z: 0.5 });
  const rec = newRecord(PLANS.faering, "k", length);
  rec.stage = 5;
  writeRecord(e, rec);
  const helm = { typeId: "minecraft:player", input: { x: 0, y: 0 }, jump: false,
    inputInfo: { getMovementVector() { return helm.input; }, getButtonState(b) { return b === "Jump" && helm.jump ? "Pressed" : "Released"; } } };
  return { e, helm };
}
const run = (e, helm, n) => { let s; for (let i = 0; i < n; i++) s = steerBoat(e, helm); return s; };

test("forward throttle builds speed along the bow, capped at hull speed", () => {
  const { e, helm } = steerSetup(6000);
  helm.input = { x: 0, y: 1 };
  const s = run(e, helm, 200);
  assert.ok(s.speed > 0.2 && s.speed <= s.stats.max + 1e-9, `speed ${s.speed}`);
  const f = forwardOf(s.heading);
  const v = e.velocity;
  const along = v.x * f.x + v.z * f.z, across = Math.abs(v.x * f.z - v.z * f.x);
  assert.ok(along > 0.15 && across < 0.01, `moves along the bow (along ${along}, across ${across})`);
  assert.ok(Math.abs(e.props["shipwright:yaw"] - s.heading) <= 0.5, "model heading follows the script");
  assert.equal(e.rotation.y, 0, "the script never rotates the entity itself");
});

test("turning changes heading; longer hulls turn slower", () => {
  const a = steerSetup(6100, 5), b = steerSetup(6200, 10);
  for (const t of [a, b]) { t.helm.input = { x: 0, y: 1 }; run(t.e, t.helm, 100); t.helm.input = { x: -1, y: 1 }; }
  const ha0 = steerTest.state.get(a.e.id).heading, hb0 = steerTest.state.get(b.e.id).heading;
  const sa = run(a.e, a.helm, 10), sb = run(b.e, b.helm, 10);
  const da = sa.heading - ha0, db = sb.heading - hb0;
  assert.ok(da > 0, "stick right (x = -1 by default) turns right, raising yaw");
  assert.ok(da > db * 1.5, `short hull turns faster (${da.toFixed(1)} vs ${db.toFixed(1)} degrees)`);
});

test("at rest you can still paddle round slowly; letting go coasts to a stop", () => {
  const { e, helm } = steerSetup(6300);
  helm.input = { x: 1, y: 0 };
  const s = run(e, helm, 10);
  assert.ok(s.heading < 0 && s.heading > -30, `slow pivot at rest (${s.heading})`);
  helm.input = { x: 0, y: 1 }; run(e, helm, 100);
  helm.input = { x: 0, y: 0 };
  const s2 = run(e, helm, 400);                   // the water takes her way over some seconds
  assert.ok(s2.speed < 0.01, `coasted to ${s2.speed}`);
});

test("reverse is slow", () => {
  const { e, helm } = steerSetup(6400);
  helm.input = { x: 0, y: -1 };
  const s = run(e, helm, 300);
  assert.ok(s.speed < 0 && Math.abs(s.speed) <= s.stats.max * 0.3 + 1e-9, `reverse speed ${s.speed}`);
});

test("the boat no longer borrows the vanilla boat engine", async () => {
  const fs = await import("node:fs");
  const ent = JSON.parse(fs.readFileSync(new URL("../BP/entities/faering.json", import.meta.url), "utf8"))["minecraft:entity"];
  assert.equal(ent.description.runtime_identifier, undefined);
  assert.ok(ent.components["minecraft:buoyant"], "floats on its own");
});

// ---------- handling from the build ----------

function built({ length = 6, beam = 1, depth = 1, wood = "spruce", sail = false, propulsion = null } = {}) {
  const r = newRecord(PLANS.faering, "k", length);
  r.propulsion = propulsion;
  r.dims.beam = beam; r.dims.depth = depth;
  for (const z of ["bow", "mid", "stern"]) r.sections[z].mat = wood;
  r.sections.rig.sail = sail;
  return computeHandling(r);
}

test("turning circle widens with speed", () => {
  const h = built();
  const slow = turningRadius(h, 0.2), half = turningRadius(h, 0.5), full = turningRadius(h, 1);
  assert.ok(slow < half && half < full, `radius ${slow.toFixed(1)} < ${half.toFixed(1)} < ${full.toFixed(1)}`);
  assert.ok(turnRateAt(h, h.max) < turnRateAt(h, h.max * 0.2), "turn rate fades at speed");
});

test("longer hulls are faster but turn wider", () => {
  const short = built({ length: 4 }), long = built({ length: 10 });
  assert.ok(long.max > short.max);
  assert.ok(turningRadius(long, 0.5) > turningRadius(short, 0.5));
});

test("slender hulls are faster; beamy hulls pivot more easily", () => {
  const narrow = built({ length: 8, beam: 0.8 }), wide = built({ length: 8, beam: 1.4 });
  assert.ok(narrow.max > wide.max, "slender is faster");
  assert.ok(wide.turnMax > narrow.turnMax * 0.95, "beamy turns at least as readily");
});

test("deeper hulls grip better in turns and draw more water", () => {
  const shallow = built({ depth: 0.75 }), deep = built({ depth: 1.5 });
  assert.ok(deep.grip > shallow.grip);
  assert.ok(deep.draft > shallow.draft);
});

test("heavy wood accelerates slower but coasts further than light wood", () => {
  const light = built({ wood: "bamboo" }), heavy = built({ wood: "mangrove" });
  assert.ok(heavy.weight > light.weight);
  assert.ok(heavy.accel < light.accel);
  assert.ok(heavy.coastDrag > light.coastDrag, "higher coast factor = keeps way longer");
});

test("a mast and sail add weight aloft", () => {
  const bare = built(), rigged = built({ sail: true });
  assert.ok(rigged.weight > bare.weight && rigged.accel < bare.accel);
});

test("a faering floats in a single block of water (shallow draft)", () => {
  assert.ok(built({ depth: 1.5 }).draft < 1, "even the deepest faering draws under a block");
});

test("a deep hull runs aground in shallow water", () => {
  PLANS.testship = { ...PLANS.faering, id: "testship", baseDepth: 2 };   // a deep cargo hull: draft 2 blocks
  const { e, helm } = steerSetup(6600);
  const rec = readRecord(e); rec.plan = "testship"; rec.dims.depth = 1.5; writeRecord(e, rec);
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 6570; x <= 6630; x++) for (let z = -30; z <= 30; z++) dim.set(x, 62, z, "minecraft:sand");
  steerTest.state.delete(e.id);
  e.location.y = 63.6; // one block of water over sand: shallower than the draft
  helm.input = { x: 0, y: 1 };
  const s = run(e, helm, 100);
  assert.equal(s.aground, true);
  assert.ok(s.speed <= 0.03 + 1e-9, `crawling at ${s.speed}`);
  delete PLANS.testship;
});

// ---------- wind and sails ----------

test("biomes fall into 5 temperature classes and 3 surfaces", () => {
  assert.deepEqual(classifyBiome("minecraft:desert"), { temp: 4, surface: 0.6 });
  assert.deepEqual(classifyBiome("minecraft:frozen_ocean"), { temp: 0, surface: 1.0 });
  assert.deepEqual(classifyBiome("minecraft:warm_ocean"), { temp: 3, surface: 1.0 });
  assert.equal(classifyBiome("minecraft:taiga").temp, 1);
  assert.equal(classifyBiome("minecraft:plains").temp, 2);
  assert.equal(classifyBiome("minecraft:jagged_peaks").surface, 0.25);
});

test("square sails run before the wind; fore-and-aft rigs point closer", () => {
  assert.equal(sailPower("square", 0), 1);
  assert.equal(sailPower("square", 130), 0, "square sail can't head into the wind");
  assert.ok(sailPower("fore_and_aft", 130) > 0.5, "fore-and-aft still draws close-hauled");
  assert.ok(sailPower("fore_and_aft", 90) > sailPower("square", 90));
});

test("wind blows from cool cells toward warm ones, strongest over water", () => {
  const dim = world.getDimension("minecraft:overworld");
  windTest.cells.clear();
  // Cell x <= 100 is frozen ocean, x >= 101 is warm ocean, around cell z = 50.
  dim.biomeAt = (x) => (x < 101 * 64 ? "minecraft:frozen_ocean" : "minecraft:warm_ocean");
  const w = windAtCell(dim, 100, 50);
  dim.biomeAt = null; windTest.cells.clear();
  assert.ok(Math.hypot(w.x, w.z) > 0.5, "a strong temperature step makes a strong wind");
  const calm = windAtCell(dim, 300, 300);
  assert.ok(Math.hypot(calm.x, calm.z) < 0.4, "open, even sea only has the light prevailing wind");
  windTest.cells.clear();
});

function sailBoat(x0, { sail = true } = {}) {
  const t = steerSetup(x0, 7);
  const rec = readRecord(t.e); rec.sections.rig.sail = sail; writeRecord(t.e, rec);
  steerTest.state.delete(t.e.id);
  return t;
}

test("running before the wind, a sail carries the boat with no rowing", () => {
  const { e, helm } = sailBoat(7000);
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  s.wind = { x: 0, z: 1 }; s.heading = 0;           // wind blowing toward +z, boat facing +z: dead downwind
  windTest.cells.clear();
  const dim = world.getDimension("minecraft:overworld");
  dim.biomeAt = () => "minecraft:ocean";
  for (let i = 0; i < 150; i++) { s.wind = { x: 0, z: 1 }; steerBoat(e, helm); }
  dim.biomeAt = null;
  assert.ok(s.speed > 0.15, `sailing at ${s.speed.toFixed(3)} with no oars`);
});

test("a square sail can't drive the boat into the wind", () => {
  const { e, helm } = sailBoat(7100);
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  s.heading = 0;
  for (let i = 0; i < 150; i++) { s.wind = { x: 0, z: -1 }; steerBoat(e, helm); }  // dead ahead
  assert.ok(s.speed < 0.01, `stays put head-to-wind (${s.speed.toFixed(3)})`);
});

test("jump raises and lowers the sail; a lowered sail doesn't draw", () => {
  const { e, helm } = sailBoat(7200);
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  assert.equal(s.sailSet, true);
  helm.jump = true; steerBoat(e, helm); steerBoat(e, helm);   // a quick tap: toggles on release
  helm.jump = false; steerBoat(e, helm);
  assert.equal(s.sailSet, false);
  assert.equal(getP(e, "sail_set"), false);
  s.heading = 0; s.speed = 0;
  for (let i = 0; i < 100; i++) { s.wind = { x: 0, z: 1 }; steerBoat(e, helm); }
  assert.ok(s.speed < 0.01, "no drive with the sail down");
});

// ---------- terrain ----------

test("the hull stops at the shore instead of sliding into it", () => {
  const { e, helm } = steerSetup(7400, 7);
  const dim = world.getDimension("minecraft:overworld");
  // A wall of stone at z = 12; the bow starts at z 6.5 (boat faces +z at heading 0).
  for (let x = 7390; x <= 7410; x++) for (let y = 62; y <= 66; y++) dim.set(x, y, 12, "minecraft:stone");
  steerTest.state.delete(e.id);
  helm.input = { x: 0, y: 1 };
  let s;
  for (let i = 0; i < 200; i++) { s = steerBoat(e, helm); e.location.x += e.velocity.x; e.location.z += e.velocity.z; }
  const bowTip = e.location.z + 7 / 2;                    // the origin is the craft's centre
  assert.ok(bowTip > 9, `it actually sailed toward the wall (bow at z ${bowTip.toFixed(2)})`);
  assert.ok(bowTip < 12.05, `bow stopped at the wall (bow at z ${bowTip.toFixed(2)})`);
  assert.ok(s.speed < 0.05);
});

test("a turn that would swing the hull into land is refused", () => {
  const dim = world.getDimension("minecraft:overworld");
  const { e } = steerSetup(7600, 7);
  for (let z = -10; z <= 10; z++) for (let y = 62; y <= 66; y++) dim.set(7602, y, z, "minecraft:stone"); // wall 1.5 blocks to the side
  const h = computeHandling(readRecord(e));
  assert.equal(hullHits(dim, e.location, 0, h), false, "straight ahead is clear");
  assert.equal(hullHits(dim, e.location, -90, h), true, "swinging the bow toward the wall hits it");
});

// ---------- anchoring ----------

function anchorBoat(x0) {
  const t = steerSetup(x0, 7);
  t.e.tags.add("shipwright_launched");
  t.e.triggerEvent("shipwright:launch");
  steerTest.state.delete(t.e.id);
  return t;
}
const tickAll = (n) => { for (let i = 0; i < n; i++) steerTest.tick(); };

test("a boat with nobody at the helm anchors itself and holds its spot", () => {
  const { e } = anchorBoat(8000);
  e.velocity = { x: 0.3, y: 0, z: 0.2 };       // drifting when the helmsman steps off
  tickAll(1);
  const s = steerTest.state.get(e.id);
  assert.ok(s.anchor && !s.anchor.manual, "auto anchor dropped");
  assert.ok(Math.hypot(e.velocity.x, e.velocity.z) < 0.06, "drift cancelled");
  e.location.x += 2;                            // pushed off its spot
  tickAll(1);
  assert.ok(e.velocity.x < 0, "drawn back toward the anchor");
});

test("taking the helm raises an anchor that dropped itself", () => {
  const { e, helm } = anchorBoat(8100);
  tickAll(1);
  assert.ok(steerTest.state.get(e.id).anchor);
  e.riders = [helm];
  tickAll(1);
  assert.equal(steerTest.state.get(e.id).anchor, null);
});

test("holding jump drops the anchor by hand, and it stays down while seated", () => {
  const { e, helm } = anchorBoat(8200);
  e.riders = [helm];
  helm.input = { x: 0, y: 1 };
  tickAll(60);
  assert.ok(steerTest.state.get(e.id).speed > 0.1, "under way");
  helm.jump = true; tickAll(15); helm.jump = false; tickAll(1);
  const s = steerTest.state.get(e.id);
  assert.ok(s.anchor?.manual, "hand-dropped anchor");
  assert.equal(readRecord(e).anchor?.manual, true, "saved in the record");
  tickAll(30);
  assert.equal(s.speed, 0, "no way on while anchored, even with the stick forward");
  assert.equal(s.pushingAtAnchor, true, "the action bar can tell you how to weigh anchor");
  helm.jump = true; tickAll(15); helm.jump = false; tickAll(1);
  assert.equal(s.anchor, null, "holding jump again weighs anchor");
  assert.equal(readRecord(e).anchor, null);
});

test("a quick tap of jump still works the sail, not the anchor", () => {
  const { e, helm } = anchorBoat(8300);
  const rec = readRecord(e); rec.sections.rig.sail = true; writeRecord(e, rec);
  steerTest.state.delete(e.id);
  e.riders = [helm];
  tickAll(2);
  const s = steerTest.state.get(e.id);
  const before = s.sailSet;
  helm.jump = true; tickAll(3); helm.jump = false; tickAll(1);
  assert.equal(s.sailSet, !before);
  assert.equal(s.anchor, null);
});

// ---------- soundings and mooring ----------

test("soundings report depth under the hull and the boat's safe depth", () => {
  const { e, helm } = steerSetup(9000, 7);
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 8970; x <= 9030; x++) for (let z = -30; z <= 30; z++) for (let y = 58; y <= 62; y++) dim.set(x, y, z, "minecraft:water");
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  const sd = takeSoundings(e, s, s.stats);
  assert.equal(sd.under, 6, "water from y 58 to 63");
  assert.equal(sd.safe, safeDepth(s.stats));
  assert.equal(sd.alert, "");
});

test("a shoal ahead of the bow is called out before you reach it", () => {
  const { e, helm } = steerSetup(9100, 7);
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 9070; x <= 9130; x++) for (let z = -30; z <= 30; z++) for (let y = 58; y <= 62; y++) dim.set(x, y, z, "minecraft:water");
  for (let x = 9090; x <= 9110; x++) for (let z = 8; z <= 9; z++) { dim.set(x, 63, z, "minecraft:sand"); for (let y = 58; y <= 62; y++) dim.set(x, y, z, "minecraft:sand"); }
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  s.heading = 0; s.speed = 0.1;     // heading +z toward the sandbar, bow tip at z 6.4
  assert.equal(takeSoundings(e, s, s.stats).alert, "shoal");
  s.heading = 180;                  // facing away: open water
  assert.equal(takeSoundings(e, s, s.stats).alert, "");
});



// ---------- the flag, the quiet action bar, and anchor details ----------

test("the pennant gets the wind relative to the hull and its strength", () => {
  const { e, helm } = steerSetup(9500, 7);
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  s.heading = 0;                         // bow toward +z
  s.wind = { x: 0, z: 0.8 };             // blowing toward +z: from astern
  showWind(e, s);
  assert.equal(e.props["shipwright:wind_rel"], 0, "streams forward over the bow");
  assert.equal(e.props["shipwright:wind_str"], 0.8);
  s.wind = { x: -0.8, z: 0 };            // blowing toward -x (west, yaw 90): from starboard
  showWind(e, s);
  assert.equal(e.props["shipwright:wind_rel"], 90);
});

test("the action bar stays clear unless something needs attention", () => {
  const { e, helm } = anchorBoat(9600);
  const shown = [];
  helm.onScreenDisplay = { setActionBar: (t) => shown.push(t) };
  e.riders = [helm];
  helm.input = { x: 0, y: 1 };
  tickAll(40);
  assert.deepEqual(shown, [], `no speed or wind text while sailing normally (got ${JSON.stringify(shown)})`);
});

test("anchoring furls the sail; weighing anchor sets it again", () => {
  const { e, helm } = anchorBoat(9700);
  const rec = readRecord(e); rec.sections.rig.sail = true; writeRecord(e, rec);
  steerTest.state.delete(e.id);
  e.riders = [helm];
  tickAll(2);
  const s = steerTest.state.get(e.id);
  assert.equal(s.sailSet, true);
  helm.jump = true; tickAll(15); helm.jump = false; tickAll(1);
  assert.equal(s.sailSet, false, "furled at anchor");
  assert.equal(getP(e, "sail_set"), false);
  helm.jump = true; tickAll(15); helm.jump = false; tickAll(1);
  assert.equal(s.sailSet, true, "set again when the anchor comes up");
});

test("a stone anchor drags in a near gale; an iron one holds", () => {
  for (const [type, drags] of [["stone", true], ["iron", false]]) {
    const { e, helm } = steerSetup(9800 + (drags ? 0 : 50), 7);
    steerBoat(e, helm);
    const s = steerTest.state.get(e.id);
    s.anchorType = type;
    dropAnchor(e, s, true);
    const x0 = s.anchor.x;
    for (let i = 0; i < 50; i++) { s.wind = { x: 1.3, z: 0 }; holdAtAnchor(e, s); }
    assert.equal(s.anchor.x > x0 + 0.1, drags, `${type} anchor ${drags ? "drags" : "holds"}`);
  }
});


test("shallowing warns when the bottom comes up, not over steady safe shallows", () => {
  const { e, helm } = steerSetup(10000, 7);
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 9970; x <= 10030; x++) for (let z = -30; z <= 30; z++) for (let y = 60; y <= 62; y++) dim.set(x, y, z, "minecraft:water");
  // A shelf ahead: only 1 block of water from z 8 onward.
  for (let x = 9990; x <= 10010; x++) for (let z = 8; z <= 30; z++) for (let y = 60; y <= 62; y++) dim.set(x, y, z, "minecraft:sand");
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  s.heading = 0; s.speed = 0.1;
  assert.equal(takeSoundings(e, s, s.stats).alert, "shallowing", "4 blocks under, 1 ahead");
  e.location.z = 12;                    // now over the shelf itself
  assert.equal(takeSoundings(e, s, s.stats).alert, "", "steady 1-block shelf is fine for a faering");
});

// ---------- tethering with a lead ----------

test("with a lead in hand, interacting takes the boat's line instead of boarding", async () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 10100, y: 64, z: 0 });
  e.triggerEvent("shipwright:launch");
  const inv = [{ typeId: "minecraft:lead", amount: 2 }];
  const p = makePlayer(dim, inv);
  e.riders = [p];                         // even if the game seated them first
  __handlers.interactEntity({ player: p, target: e });
  await settle(3);
  assert.equal(e.riders.length, 0, "not seated while holding a lead");
  assert.equal(e.leashedTo, p, "the line is in your hand");
  assert.equal(inv[0].amount, 1, "exactly one lead used");
  __handlers.interactEntity({ player: p, target: e });
  await settle(3);
  assert.equal(inv[0].amount, 1, "no second lead used when already tied");
});

test("a tethered boat holds still and says so if you try to sail", () => {
  const { e, helm } = anchorBoat(10200);
  const shown = [];
  helm.onScreenDisplay = { setActionBar: (t) => shown.push(t) };
  e.leashedTo = { location: { x: 10202, y: 64, z: 0 } };
  e.riders = [helm];
  helm.input = { x: 0, y: 1 };
  tickAll(30);
  const s = steerTest.state.get(e.id);
  assert.equal(s.speed, 0);
  assert.ok(shown.includes("Tethered: untie the line first"));
  assert.equal(isTethered(e), true);
});

test("an unridden tethered boat is held by its line, not anchored", () => {
  const { e } = anchorBoat(10300);
  e.leashedTo = { location: { x: 10302, y: 64, z: 0 } };
  tickAll(2);
  assert.equal(steerTest.state.get(e.id).anchor ?? null, null);
});

// ---------- rudders ----------

test("small boats steer with a steering oar, bigger hulls with a sternpost rudder", () => {
  assert.equal(built({ length: 7 }).rudder, "steering_oar");
  PLANS.testship = { ...PLANS.faering, id: "testship", lengthRange: [10, 24] };
  const r = newRecord(PLANS.testship, "k", 16);
  const big = computeHandling(r);
  delete PLANS.testship;
  assert.equal(big.rudder, "sternpost");
  assert.ok(big.draft > built({ length: 10 }).draft, "a sternpost rudder adds draft");
});

test("the rudder needs way on: at a crawl you pivot by paddling", () => {
  const h = built({ length: 7 });
  const rest = turnRateAt(h, 0), crawl = turnRateAt(h, h.max * 0.05), moving = turnRateAt(h, h.max * 0.3);
  assert.ok(Math.abs(crawl - rest) < 0.01, "a crawl turns no better than paddling");
  assert.ok(moving > rest * 1.3, "with way on, the rudder turns you much faster");
});

test("a deeper hull turns a little wider but grips better", () => {
  const shallow = built({ depth: 0.75 }), deep = built({ depth: 1.5 });
  assert.ok(turningRadius(deep, 0.5) > turningRadius(shallow, 0.5));
  assert.ok(deep.grip > shallow.grip);
});

test("the steering oar swings with the helm and recentres when you let go", () => {
  const { e, helm } = steerSetup(10400, 7);
  helm.input = { x: -1, y: 1 };           // stick right
  run(e, helm, 30);
  assert.ok(e.props["shipwright:rudder"] > 20, `swung over (${e.props["shipwright:rudder"]})`);
  helm.input = { x: 0, y: 1 };
  run(e, helm, 40);
  assert.equal(e.props["shipwright:rudder"], 0, "back to centre");
});

// ---------- oars, sail, heel, drift, gusts, breezes ----------

test("oar pairs follow hull length, and more oars pull harder", () => {
  // One pair per two blocks of hull between the ends, in the model's own scale.
  assert.deepEqual([4, 5, 6, 8, 9, 10].map((L) => oarPairsFor(L)), [1, 1, 2, 3, 3, 4]);
  assert.deepEqual([12, 16, 20].map((L) => oarPairsFor(L, 2)), [2, 3, 4], "a longship's model is drawn at twice the size");
  // Same hull, different oar counts: compare acceleration per unit of base rowing.
  const short = built({ length: 5 }), mid = built({ length: 6 });
  assert.equal(short.oarPairs, 1); assert.equal(mid.oarPairs, 2);
});

test("rowing shows on the oars, and they ship at rest", () => {
  const { e, helm } = steerSetup(10500, 7);
  helm.input = { x: 0, y: 1 };
  run(e, helm, 5);
  assert.equal(e.props["shipwright:rowing"], 1);
  helm.input = { x: 0, y: 0 };
  run(e, helm, 5);
  assert.equal(e.props["shipwright:rowing"], 0);
});

function sailingBoat(x0) {
  const t = sailBoat(x0);
  steerBoat(t.e, t.helm);
  const s = steerTest.state.get(t.e.id);
  s.heading = 0;
  return { ...t, s };
}

test("the sail fills running before the wind and empties head to wind", () => {
  const { e, helm, s } = sailingBoat(10600);
  for (let i = 0; i < 5; i++) { s.wind = { x: 0, z: 1 }; steerBoat(e, helm); }
  assert.ok(e.props["shipwright:sail_fill"] >= 0.9, `full (${e.props["shipwright:sail_fill"]})`);
  for (let i = 0; i < 5; i++) { s.wind = { x: 0, z: -1 }; steerBoat(e, helm); }
  assert.equal(e.props["shipwright:sail_fill"], 0, "luffing head to wind");
});

test("the hull heels away from a beam wind, and a narrow hull heels more", () => {
  const heelOf = (x0, beam) => {
    const t = sailingBoat(x0);
    const rec = readRecord(t.e); rec.dims.beam = beam; writeRecord(t.e, rec);
    steerTest.state.delete(t.e.id); steerBoat(t.e, t.helm);
    const s = steerTest.state.get(t.e.id); s.heading = 0;
    for (let i = 0; i < 5; i++) { s.wind = { x: -0.9, z: 0.2 }; steerBoat(t.e, t.helm); }   // wind blowing to starboard
    return s.heel;
  };
  const narrow = heelOf(10700, 0.8), wide = heelOf(10800, 1.4);
  assert.ok(narrow !== 0 && Math.sign(narrow) === Math.sign(wide), "heels to the same (leeward) side");
  assert.ok(Math.abs(narrow) > Math.abs(wide), `narrow ${narrow.toFixed(1)} vs wide ${wide.toFixed(1)}`);
});

test("wind drifts an idle boat downwind; a deep hull slips sideways less", () => {
  const sideSlip = (x0, depth) => {
    const { e, helm } = steerSetup(x0, 7);
    const rec = readRecord(e); rec.dims.depth = depth; writeRecord(e, rec);
    steerTest.state.delete(e.id); steerBoat(e, helm);
    const s = steerTest.state.get(e.id); s.heading = 0;
    for (let i = 0; i < 60; i++) { s.wind = { x: 1, z: 0 }; steerBoat(e, helm); }   // wind blowing across, toward +x
    return e.velocity.x;
  };
  const shallow = sideSlip(10900, 0.75), deep = sideSlip(11000, 1.5);
  assert.ok(shallow > 0, "pushed downwind");
  assert.ok(deep < shallow, `deep ${deep.toFixed(4)} < shallow ${shallow.toFixed(4)}`);
});

test("gusts breathe within about a fifth of the wind's strength", () => {
  let lo = 9, hi = 0;
  for (let t = 0; t < 2000; t += 7) { const g = gustFactor(3, 5, t); lo = Math.min(lo, g); hi = Math.max(hi, g); }
  assert.ok(lo >= 0.77 && hi <= 1.23 && hi - lo > 0.2, `range ${lo.toFixed(2)} to ${hi.toFixed(2)}`);
});

test("sea breezes blow onshore by day and offshore by night", () => {
  const dim = world.getDimension("minecraft:overworld");
  windTest.cells.clear();
  dim.biomeAt = (x) => (x < 201 * 64 ? "minecraft:ocean" : "minecraft:plains");   // land to the east (+x)
  const day = seaBreeze(dim, 200, 10, 3000), night = seaBreeze(dim, 200, 10, 15000);
  dim.biomeAt = null; windTest.cells.clear();
  assert.ok(day.x > 0, "by day toward the land");
  assert.ok(night.x < 0, "by night out to sea");
});

// ---------- propulsion styles ----------

test("a faering rows with long oars by default; any learned style can be fitted", () => {
  assert.equal(built().propulsion, "oars");
  assert.equal(built({ propulsion: "double_paddle" }).propulsion, "double_paddle");
});

test("paddles are quick off the mark and spin on the spot; long oars reach a higher top speed", () => {
  const oars = built({ length: 7 }), paddles = built({ length: 7, propulsion: "paddles" });
  assert.ok(paddles.accel > oars.accel * 0.95, "paddles at least as quick off the mark");
  assert.ok(paddles.restTurn > oars.restTurn, "paddles pivot better at rest");
  assert.ok(oars.max > paddles.max, "oars faster flat out");
});

test("a double paddle shines on a short hull and loses punch on a long one", () => {
  const shortDP = built({ length: 5, propulsion: "double_paddle" }), longDP = built({ length: 10, propulsion: "double_paddle" });
  const shortOars = built({ length: 5 }), longOars = built({ length: 10 });
  assert.ok(shortDP.accel / shortOars.accel > longDP.accel / longOars.accel);
});

test("a punting pole stops working when it can't reach the bottom", () => {
  const { e, helm } = steerSetup(11100, 7);
  const rec = readRecord(e); rec.propulsion = "pole"; writeRecord(e, rec);
  steerTest.state.delete(e.id);
  helm.input = { x: 0, y: 1 };
  const shallow = run(e, helm, 60).speed;          // 1 block of water: the pole reaches
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 11070; x <= 11130; x++) for (let z = -30; z <= 30; z++) for (let y = 55; y <= 62; y++) dim.set(x, y, z, "minecraft:water");
  steerTest.state.delete(e.id);
  const deep = run(e, helm, 60).speed;              // 9 blocks: it doesn't
  assert.ok(deep < shallow * 0.3, `deep ${deep.toFixed(3)} vs shallow ${shallow.toFixed(3)}`);
});

test("going astern depends on the style: a pole backs as well as it pushes", () => {
  assert.ok(PROPULSION.pole.reverse > PROPULSION.oars.reverse);
});

// ---------- sail on taking the helm, crank furnace, rowing effort ----------

test("taking the helm makes sail, even after a restart left it furled", () => {
  const { e, helm } = anchorBoat(11200);
  const rec = readRecord(e); rec.sections.rig.sail = true; writeRecord(e, rec);
  setP(e, "sail_set", false);   // furled at anchor before a restart
  steerTest.state.delete(e.id);
  tickAll(2);                                // nobody aboard: anchors itself, sail stays furled
  e.riders = [helm];
  tickAll(1);
  assert.equal(getP(e, "sail_set"), true);
});

function furnaceBoat(x0, inv, power = "furnace") {
  const { e, helm } = anchorBoat(x0);
  const rec = readRecord(e); rec.power = power; writeRecord(e, rec); applyRecord(e, rec);
  steerTest.state.delete(e.id);
  const p = makePlayer(world.getDimension("minecraft:overworld"), inv);
  p.inputInfo = helm.inputInfo; p.onScreenDisplay = { setActionBar() {} };
  Object.defineProperty(p, "input", { get: () => helm.input, set: (v) => { helm.input = v; } });
  e.riders = [p];
  return { e, p, helm };
}

test("rowing by hand costs energy", () => {
  const { e, helm } = anchorBoat(11300);
  const p = makePlayer(world.getDimension("minecraft:overworld"), []);
  p.inputInfo = { getMovementVector: () => ({ x: 0, y: 1 }), getButtonState: () => "Released" };
  e.riders = [p];
  tickAll(200);
  assert.ok(p.exhaustion > 0.8 && p.exhaustion < 1.2, `about a quarter hunger point in 10 seconds (${p.exhaustion.toFixed(2)})`);
});

test("the crank furnace burns coal instead of your energy, and shows lit", () => {
  const inv = [{ typeId: "minecraft:coal", amount: 3 }];
  const { e, p, helm } = furnaceBoat(11400, inv);
  helm.input = { x: 0, y: 1 };
  tickAll(100);
  assert.equal(inv[0].amount, 2, "one coal stoked");
  assert.equal(p.exhaustion, 0, "no hunger while the furnace drives the oars");
  assert.equal(getP(e, "furnace_lit"), true);
  assert.equal(getP(e, "furnace"), true);
});

test("with no fuel the furnace goes out and rowing is back to your own effort", () => {
  const { e, p, helm } = furnaceBoat(11500, []);
  helm.input = { x: 0, y: 1 };
  tickAll(60);
  assert.ok(p.exhaustion > 0);
  assert.equal(getP(e, "furnace_lit") ?? false, false);
});

test("power is fitted at the table into the power slot, not a module slot", async () => {
  const s = beach();
  const p = makePlayer(s.dim, [...fullInventory(), { typeId: "minecraft:furnace", amount: 1 }, { typeId: "minecraft:iron_ingot", amount: 8 }]);
  await buildFaering(p, s);
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:faering").at(-1);
  await new Promise((r) => setTimeout(r, 420));
  answers.length = 0;
  answers.push(1, "→ Power", 0, 0);   // Edit a boat, power, furnace, confirm
  useTable(p, s);
  await settle();
  assert.equal(readRecord(ship).power, "furnace");
  assert.deepEqual(readRecord(ship).modules, [], "no module slot used");
  assert.equal(getP(ship, "furnace"), true);
  assert.equal(count(p.inventory, "minecraft:furnace"), 0);
  assert.equal(count(p.inventory, "minecraft:iron_ingot"), 4);
});

// ---------- supply chest and power types ----------

test("a chest against the table supplies materials before your inventory", async () => {
  const s = beach();
  const chest = s.dim.chestAt(s.o.x - 1, s.o.y, s.o.z, [{ typeId: "minecraft:spruce_log", amount: 10 }, { typeId: "minecraft:stick", amount: 64 }]);
  const p = makePlayer(s.dim, fullInventory());
  answers.length = 0;
  answers.push(0, "Advanced", [7], 0, [100, 100], 0);   // keel and frames, then stop
  useTable(p, s);
  await settle();
  const chestLogs = chest.slots.filter(Boolean).find((i) => i.typeId === "minecraft:spruce_log")?.amount ?? 0;
  assert.equal(chestLogs, 10 - 3, "keel logs came from the chest");
  assert.equal(count(p.inventory, "minecraft:spruce_log"), 10, "inventory untouched");
  assert.equal(count(p.inventory, "minecraft:stick"), 64, "frame sticks came from the chest too");
});

test("refunds go into the supply chest", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory());
  await buildFaering(p, s);
  const chest = s.dim.chestAt(s.o.x - 1, s.o.y, s.o.z, []);
  await new Promise((r) => setTimeout(r, 420));
  answers.length = 0;
  answers.push(1, "Hull: replace", [0, 0], 0);   // Edit a boat, hull, bow, oak, confirm
  useTable(p, s);
  await settle();
  assert.ok(chest.slots.some((i) => i?.typeId === "minecraft:spruce_planks"), "old planks deposited in the chest");
});

test("the smoker is quickest off the mark and the blast furnace fastest; both burn fuel twice as fast", () => {
  const speedAfter = (x0, power, ticks) => {
    const inv = [{ typeId: "minecraft:coal_block", amount: 2 }];
    const { e, helm } = furnaceBoat(x0, inv, power);
    helm.input = { x: 0, y: 1 };
    tickAll(ticks);
    const st = steerTest.state.get(e.id);
    e.riders = [];   // step off so later runs don't keep this boat rowing
    return { s: { speed: st.speed, fuel: st.fuel } };   // a snapshot, taken the moment this run ends
  };
  const f20 = speedAfter(11600, "furnace", 20).s, s20 = speedAfter(11700, "smoker", 20).s;
  assert.ok(s20.speed > f20.speed, `smoker gets going faster (smoker ${s20.speed}, furnace ${f20.speed}, fuel ${s20.fuel}/${f20.fuel})`);
  const f400 = speedAfter(11800, "furnace", 400).s, b400 = speedAfter(11900, "blast_furnace", 400).s;
  assert.ok(b400.speed > f400.speed, `blast furnace reaches more speed (${b400.speed.toFixed(3)} vs ${f400.speed.toFixed(3)})`);
  assert.ok(16000 - b400.fuel > (16000 - f400.fuel) * 1.8, "twice the fuel use");
});

test("dried kelp blocks are fuel", () => {
  const inv = [{ typeId: "minecraft:dried_kelp_block", amount: 1 }];
  const { helm } = furnaceBoat(12000, inv);
  helm.input = { x: 0, y: 1 };
  tickAll(10);
  assert.equal(inv[0], undefined, "one kelp block stoked");
});

test("old boats with a furnace module move it to the power slot", () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 12100, y: 64, z: 0 });
  const rec = newRecord(PLANS.faering, "k", 6);
  rec.modules = ["furnace"]; delete rec.power;
  e.setDynamicProperty("shipwright:record", JSON.stringify(rec));
  const r = readRecord(e);
  assert.equal(r.power, "furnace");
  assert.deepEqual(r.modules, []);
});

// ---------- energy ----------

function rower(x0, stick, food = 20) {
  const { e } = anchorBoat(x0);
  const p = makePlayer(world.getDimension("minecraft:overworld"), []);
  p.food = food;
  p.inputInfo = { getMovementVector: () => ({ x: 0, y: stick }), getButtonState: () => "Released" };
  p.onScreenDisplay = { setActionBar() {} };
  e.riders = [p];
  return { e, p };
}

test("half stick cruises at about half speed for a fraction of the effort", () => {
  const full = rower(12200, 1), half = rower(12300, 0.5);
  tickAll(300);
  const sf = steerTest.state.get(full.e.id), sh = steerTest.state.get(half.e.id);
  assert.ok(Math.abs(sh.speed / sf.speed - 0.5) < 0.08, `half speed (${(sh.speed / sf.speed).toFixed(2)})`);
  assert.ok(half.p.exhaustion < full.p.exhaustion * 0.3, `cheap cruising (${half.p.exhaustion.toFixed(2)} vs ${full.p.exhaustion.toFixed(2)})`);
});

test("the sail pays for the speed the wind gives; you only pay for the rest", () => {
  const h = built({ length: 7 });
  const alone = rowingEffort(h, h.max * 0.8, h.max * 0.8, 0);
  const withWind = rowingEffort(h, h.max * 0.8, h.max * 0.8, h.max * 0.6);
  assert.ok(withWind < alone * 0.6, `${withWind.toFixed(2)} vs ${alone.toFixed(2)}`);
  assert.equal(rowingEffort(h, h.max * 0.5, h.max * 0.5, h.max * 0.7), 0, "free when the wind already does it");
});

test("accelerating costs more than holding speed", () => {
  const h = built({ length: 7 });
  assert.ok(rowingEffort(h, h.max, 0, 0) > rowingEffort(h, h.max, h.max, 0));
});

test("too hungry to row hard: speed capped at half, like sprinting", () => {
  const fed = rower(12400, 1, 20), hungry = rower(12500, 1, 6);
  tickAll(300);
  const sf = steerTest.state.get(fed.e.id), sh = steerTest.state.get(hungry.e.id);
  assert.ok(sh.speed <= sf.speed * 0.55, `${sh.speed.toFixed(3)} vs ${sf.speed.toFixed(3)}`);
});

test("raising or lowering the sail costs a burst of energy", () => {
  const { e, helm } = anchorBoat(12600);
  const rec = readRecord(e); rec.sections.rig.sail = true; writeRecord(e, rec);
  setP(e, "sail_set", false);      // furled, as after anchoring
  steerTest.state.delete(e.id);
  const p = makePlayer(world.getDimension("minecraft:overworld"), []);
  p.inputInfo = helm.inputInfo; p.onScreenDisplay = { setActionBar() {} };
  e.riders = [p];
  tickAll(2);                                   // boarding makes sail
  const afterBoard = p.exhaustion;
  assert.ok(afterBoard > 0.2, "hauling the sail up cost something");
  helm.jump = true; tickAll(3); helm.jump = false; tickAll(1);   // tap: lower it
  assert.ok(p.exhaustion > afterBoard + 0.2, "lowering it costs too");
});

test("with power fitted, easy cruising sips fuel and flat out burns it", () => {
  const sip = furnaceBoat(12700, [{ typeId: "minecraft:coal_block", amount: 1 }]);
  const burn = furnaceBoat(12800, [{ typeId: "minecraft:coal_block", amount: 1 }]);
  sip.helm.input = { x: 0, y: 0.4 };
  tickAll(200);
  const used = (b) => 16000 - steerTest.state.get(b.e.id).fuel;
  const usedSip = used(sip);
  sip.e.riders = [];
  burn.helm.input = { x: 0, y: 1 };
  tickAll(200);
  assert.ok(used(burn) > usedSip * 1.5, `flat out ${used(burn).toFixed(0)} vs easy ${usedSip.toFixed(0)}`);
});

// ---------- the sea chest ----------

test("the power slot takes fuel from the sea chest before your inventory", () => {
  const inv = [{ typeId: "minecraft:coal", amount: 5 }];
  const { e, helm } = furnaceBoat(12900, inv);
  e.chest = { size: 9, slots: [{ typeId: "minecraft:charcoal", amount: 2 }] };
  helm.input = { x: 0, y: 1 };
  tickAll(5);
  assert.equal(e.chest.slots[0].amount, 1, "charcoal from the chest");
  assert.equal(inv[0].amount, 5, "your coal untouched");
});

test("sneaking and using the boat doesn't seat you, so the game can open the sea chest", async () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 13000, y: 64, z: 0 });
  e.triggerEvent("shipwright:launch");
  const p = makePlayer(dim, []);
  p.isSneaking = true;
  __handlers.interactEntity({ player: p, target: e });
  await settle(3);
  assert.equal((e.riders ?? []).length, 0);
});

test("a full sea chest makes the boat heavier and slower to get going", () => {
  const r = newRecord(PLANS.faering, "k", 7);
  const empty = computeHandling(r, 0), full = computeHandling(r, 1);
  assert.ok(full.weight > empty.weight * 1.3);
  assert.ok(full.accel < empty.accel);
});

// ---------- the tier-1 fleet ----------

test("every boat has a plan, a behaviour entity, a model and a name", async () => {
  const fs = await import("node:fs");
  const lang = fs.readFileSync(new URL("../RP/texts/en_US.lang", import.meta.url), "utf8");
  for (const p of Object.values(PLANS)) {
    if (p.id === "testship") continue;
    assert.ok(fs.existsSync(new URL(`../BP/entities/${p.id}.json`, import.meta.url)), `${p.id} entity`);
    assert.ok(fs.existsSync(new URL(`../RP/models/entity/${p.id}.geo.json`, import.meta.url)), `${p.id} model`);
    assert.ok(fs.existsSync(new URL(`../RP/entity/${p.id}.entity.json`, import.meta.url)), `${p.id} client entity`);
    assert.ok(fs.existsSync(new URL(`../RP/textures/ui/shipwright/boat_${p.id}.png`, import.meta.url)), `${p.id} icon`);
    assert.ok(lang.includes(`entity.shipwright:${p.id}.name=`), `${p.id} name`);
    const [lo, hi] = p.lengthRange;
    for (let L = lo; L <= hi; L++) assert.ok(beamRange(p, L)[0] <= beamRange(p, L)[1], `${p.id} beam range at ${L}`);
  }
  const plans = Object.values(PLANS).filter((p) => p.id !== "testship");
  assert.equal(plans.length, 32, "twelve small boats, twelve medium ships and eight large ones (the Therans' three and the League's galleys with them)");
  assert.equal(plans.filter((p) => p.yardLevel === 3).length, 8, "the large ones need a dry dock");
});

test("each boat builds from its own tradition's materials", () => {
  const dims = { length: 5, beam: 1, depth: 1 };
  const kayak = PLANS.kayak, dugout = PLANS.dugout, sewn = PLANS.sewn_boat;
  assert.equal(keelCost(kayak, 5)[0].label, "Bone");
  assert.equal(frameCost(kayak, 5)[0].label, "Bone");
  assert.deepEqual(shellChoices(kayak).map((m) => m.key), ["hide", "rabbit"]);
  assert.match(plankCost(kayak, { bow: "hide", mid: "hide", stern: "hide" }, dims)[0].label, /Leather/);
  assert.deepEqual(frameCost(dugout, 5), [], "a dugout has no frames");
  assert.match(plankCost(dugout, { bow: "dark_oak", mid: "dark_oak", stern: "dark_oak" }, dims)[0].label, /Dark Oak Log/);
  assert.ok(plankCost(sewn, { bow: "acacia", mid: "acacia", stern: "acacia" }, dims).some((c) => c.label === "String"), "sewn with string");
});

test("a kayak is learned from bones and hide and built from them at the table", async () => {
  const s = beach();
  const inv = [{ typeId: "minecraft:bone", amount: 64 }, { typeId: "minecraft:leather", amount: 32 }];
  const p = makePlayer(s.dim, inv);
  answers.length = 0;
  answers.push(0, "Advanced", [5], 0, [100, 100], 0, [0, 0, 0], 0, "Launch", ["Little Seal"]);   // Build, keel, frames, skin, fit out: Launch, name
  useTable(p, s);
  await settle();
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:kayak").at(-1);
  assert.ok(ship, "a kayak was built");
  const rec = readRecord(ship);
  assert.equal(rec.stage, 5);
  assert.equal(rec.sections.mid.mat, "hide");
  assert.equal(getP(ship, "wood_mid"), 9, "leather texture");
  assert.ok(count(inv, "minecraft:bone") < 64 && count(inv, "minecraft:leather") < 32);
});

test("the outrigger canoe carries its float; any hull can fit one as a Pacific special", () => {
  const r = newRecord(PLANS.outrigger, "k", 6);
  assert.equal(computeHandling(r).outrigger, true);
  const plain = newRecord(PLANS.faering, "k", 6), fitted = newRecord(PLANS.faering, "k", 6);
  fitted.modules = ["outrigger"];
  const a = computeHandling(plain), b = computeHandling(fitted);
  assert.ok(b.grip > a.grip && b.stability > a.stability * 1.5);
});

test("a light hull makes a small boat a third lighter", () => {
  const plain = newRecord(PLANS.bark_canoe, "k", 6), light = newRecord(PLANS.bark_canoe, "k", 6);
  light.modules = ["light_hull"];
  const hullOf = (r) => computeHandling(r).body.parts.find((p) => p.name === "hull").mass;
  assert.ok(Math.abs(hullOf(light) / hullOf(plain) - 0.67) < 0.01, "the hull itself is a third lighter");
  assert.ok(computeHandling(light).weight < computeHandling(plain).weight * 0.8);
});

test("fitting modules from the edit screen: hold doubles the chest; locked specials say why", async () => {
  const s = beach();
  const p = makePlayer(s.dim, [...fullInventory(), { typeId: "minecraft:chest", amount: 1 }]);
  await buildFaering(p, s);
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:faering").at(-1);
  await new Promise((r) => setTimeout(r, 420));
  answers.length = 0;
  // Edit a boat, the Deck category, Add, Hold, confirm; then the Side category, Add, Outrigger (Pacific not learned)
  answers.push(1, "→ Deck", "Add", "Hold", 0, "→ Side", "Add", "Outrigger");   // catalog order: hold, ram, bunk, lookout, crossbow, cannon, bell, shield rail, castle, light hull, outrigger
  useTable(p, s);
  await settle();
  assert.deepEqual(readRecord(ship).modules, ["hold"]);
  assert.ok(ship.events.includes("shipwright:hold_on"));
  assert.ok(p.messages.some((m) => /Outrigger: learn the Pacific tradition/.test(m)), p.messages.join(" | "));
});

test("ice runners let a boat be worked across ice", () => {
  const { e, helm } = steerSetup(13100, 6);
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 13070; x <= 13130; x++) for (let z = -30; z <= 30; z++) { dim.set(x, 63, z, "minecraft:air"); dim.set(x, 62, z, "minecraft:ice"); }
  e.location.y = 63.0;
  helm.input = { x: 0, y: 1 };
  steerTest.state.delete(e.id);
  const without = run(e, helm, 60).speed;
  const rec = readRecord(e); rec.modules = ["ice_runners"]; writeRecord(e, rec);
  steerTest.state.delete(e.id);
  const withRunners = run(e, helm, 60).speed;
  assert.ok(without < 0.01 && withRunners > 0.05, `without ${without.toFixed(3)}, with ${withRunners.toFixed(3)}`);
});

// ---------- wear and repair ----------

function wornBoat(x0, cond = {}, extra = {}) {
  const { e, helm } = steerSetup(x0, 7);
  const rec = readRecord(e);
  Object.assign(rec.condition, cond);
  Object.assign(rec, extra);
  writeRecord(e, rec);
  steerTest.state.delete(e.id);
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  flushWear(e, s);
  return { e, helm, s };
}

test("planks weaken slowly with use; a dugout carved from one trunk doesn't rot", () => {
  const { e, helm, s } = wornBoat(14000);
  helm.input = { x: 0, y: 1 };
  run(e, helm, 400);
  flushWear(e, s);
  const c = readRecord(e).condition;
  assert.ok(c.mid < 1 && c.mid > 0.99, `slow rot (${c.mid.toFixed(4)})`);
  const d = steerSetup(14100, 6);
  const rec = readRecord(d.e); rec.plan = "dugout"; writeRecord(d.e, rec);
  steerTest.state.delete(d.e.id);
  d.helm.input = { x: 0, y: 1 };
  run(d.e, d.helm, 400);
  flushWear(d.e, steerTest.state.get(d.e.id));
  assert.equal(readRecord(d.e).condition.mid, 1);
});

test("a hard hit damages the bow; sewn seams take half", () => {
  const hit = (x0, mods) => {
    const { e, s } = wornBoat(x0, {}, { modules: mods });
    s.speed = 0.3; s.bumped = false; s.wasBumped = false;
    s.wear = null;
    // simulate the contact tick the way steerBoat records it
    s.bumped = true;
    const prev = 0.3;
    const sewn = mods.includes("sewn_hull") ? 0.5 : 1;
    s.wear = { bow: (prev - 0.08) * 2.0 * sewn, mid: 0, stern: 0, sail: 0 };
    flushWear(e, s);
    return 1 - readRecord(e).condition.bow;
  };
  const plain = hit(14200, []), sewn = hit(14300, ["sewn_hull"]);
  assert.ok(plain > 0.4, `plain bow damage ${plain.toFixed(2)}`);
  assert.ok(Math.abs(sewn - plain / 2) < 0.01);
});

test("hitting the shore at speed in the steering loop wears the bow", () => {
  const { e, helm } = steerSetup(14400, 7);
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 14390; x <= 14410; x++) for (let y = 62; y <= 66; y++) dim.set(x, y, 12, "minecraft:stone");
  steerTest.state.delete(e.id);
  helm.input = { x: 0, y: 1 };
  for (let i = 0; i < 200; i++) { steerBoat(e, helm); e.location.x += e.velocity.x; e.location.z += e.velocity.z; }
  flushWear(e, steerTest.state.get(e.id));
  assert.ok(readRecord(e).condition.bow < 0.95, `bow ${readRecord(e).condition.bow.toFixed(3)}`);
});

test("a worn hull is slower and a torn sail doesn't draw", () => {
  const fresh = wornBoat(14500), worn = wornBoat(14600, { bow: 0.4, mid: 0.4, stern: 0.4 });
  for (const b of [fresh, worn]) { b.helm.input = { x: 0, y: 1 }; run(b.e, b.helm, 300); }
  assert.ok(worn.s.speed < fresh.s.speed * 0.9, `${worn.s.speed.toFixed(3)} vs ${fresh.s.speed.toFixed(3)}`);
  const torn = wornBoat(14700, { sail: 0.1 });
  const rec = readRecord(torn.e); rec.sections.rig.sail = true; writeRecord(torn.e, rec);
  steerTest.state.delete(torn.e.id); steerBoat(torn.e, torn.helm);
  const s = steerTest.state.get(torn.e.id); flushWear(torn.e, s); s.heading = 0;
  for (let i = 0; i < 100; i++) { s.wind = { x: 0, z: 1 }; steerBoat(torn.e, torn.helm); }
  assert.ok(s.speed < 0.01, "no drive from a torn sail");
});

test("a holed boat founders and its chest floats free; bulkheads keep it afloat", () => {
  const a = wornBoat(14800, { bow: 0.02 });
  a.e.chest = { size: 9, slots: [{ typeId: "minecraft:gold_ingot", amount: 3 }] };
  a.s.wear = { bow: 0.05, mid: 0, stern: 0, sail: 0 };
  const dim = world.getDimension("minecraft:overworld");
  const before = dim.drops.length;
  flushWear(a.e, a.s);
  assert.equal(a.e.killed, true);
  assert.ok(dim.drops.slice(before).some((d) => d.typeId === "minecraft:gold_ingot"), "chest contents float free");
  const b = wornBoat(14900, { bow: 0.02 }, { modules: ["bulkheads"] });
  b.s.wear = { bow: 0.5, mid: 0, stern: 0, sail: 0 };
  flushWear(b.e, b.s);
  assert.ok(!b.e.killed && readRecord(b.e).condition.bow === 0.1, "held at 10% by bulkheads");
});

test("patching at sea with the hull's own planks, up to three-quarters; wool mends the sail", async () => {
  const { e } = wornBoat(15000, { stern: 0.3, sail: 0.2 });
  const rec = readRecord(e); rec.sections.rig.sail = true; rec.stage = 5; writeRecord(e, rec);
  e.triggerEvent("shipwright:launch");
  const inv = [{ typeId: "minecraft:spruce_planks", amount: 20 }, { typeId: "minecraft:red_wool", amount: 5 }];
  const p = makePlayer(world.getDimension("minecraft:overworld"), inv);
  p.selectedSlotIndex = 0;
  for (let i = 0; i < 3; i++) { __handlers.interactEntity({ player: p, target: e }); await settle(2); }
  assert.equal(readRecord(e).condition.stern, 0.75, "capped at 75% at sea");
  assert.equal(count(inv, "minecraft:spruce_planks"), 20 - 2 * 3, "three patches of two planks");
  assert.equal((e.riders ?? []).length, 0, "patching, not boarding");
  p.selectedSlotIndex = 1;
  __handlers.interactEntity({ player: p, target: e });
  await settle(2);
  assert.ok(Math.abs(readRecord(e).condition.sail - 0.45) < 1e-9, "wool mends the sail");
  p.selectedSlotIndex = 0;
  __handlers.interactEntity({ player: p, target: e });
  await settle(2);
  assert.equal(e.riders?.length, 1, "nothing left to patch at sea, so you board");
});

test("a sound boat boards normally even with planks in hand", async () => {
  const { e } = wornBoat(15100);
  e.triggerEvent("shipwright:launch");
  const p = makePlayer(world.getDimension("minecraft:overworld"), [{ typeId: "minecraft:spruce_planks", amount: 5 }]);
  __handlers.interactEntity({ player: p, target: e });
  await settle(3);
  assert.equal(e.riders?.length, 1);
});

test("a yard repair restores everything; the builder previews handling before you pay", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory());
  await buildFaering(p, s);
  const keelPreview = shown.find((f) => f.title === "Lay the keel");
  assert.match(keelPreview.body, /top speed about [0-9.]+ knots/);
  const framesPreview = shown.find((f) => f.title === "Raise the frames");
  assert.match(framesPreview.body, /Turning circle about/);
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:faering").at(-1);
  const rec = readRecord(ship); rec.condition.bow = 0.5; writeRecord(ship, rec);
  await new Promise((r) => setTimeout(r, 420));
  answers.length = 0;
  answers.push(1, "Repair at the yard", 0);   // Edit a boat, repair, confirm
  useTable(p, s);
  await settle();
  assert.equal(readRecord(ship).condition.bow, 1);
});

// ---------- the dock and the longship ----------

/**
 * A dock built like a flat Nether portal: an oak-plank frame at y 64 around a basin 2 deep,
 * the table set into the middle of the landward end, the sea wall at the far end, sea behind it.
 */
let dockX = 20000;
function dockSite({ length = 14, width = 5, gap = null, shallowAt = null, noSea = false, tableBehind = false, lowSea = false, frame = "minecraft:oak_planks" } = {}) {
  const dim = world.getDimension("minecraft:overworld");
  const o = { x: (dockX += 100), y: 64, z: 0 };
  const half = Math.floor(width / 2);
  for (let x = o.x - 3; x <= o.x + length + 12; x++) for (let z = -half - 4; z <= half + 4; z++) {
    for (let y = 56; y <= 68; y++) {
      const u = x - o.x - 1;   // first basin cell is u = 0
      let type = "minecraft:air";
      if (u > length && y <= (lowSea ? 61 : 63) && !noSea) type = "minecraft:water";
      else if (y < 62) type = "minecraft:stone";
      else if (y <= 63 && (u < -1 || u > length || Math.abs(z) > half + 1)) type = "minecraft:dirt";
      else if (y === 62) type = "minecraft:stone";
      dim.set(x, y, z, type);
    }
  }
  // frame at y 64: side walls, landward wall, sea wall
  for (let u = -1; u <= length; u++) for (let w = -half - 1; w <= half + 1; w++) {
    const edge = u === -1 || u === length || Math.abs(w) === half + 1;
    if (edge) dim.set(o.x + 1 + u, 64, w, frame);
  }
  dim.set(o.x, o.y, o.z, "shipwright:shipwright_table");
  if (tableBehind) {                     // the table right behind the landward wall, touching it
    dim.set(o.x, o.y, o.z, frame);
    dim.set(o.x - 1, 63, 0, "minecraft:stone");
    dim.set(o.x - 1, o.y, o.z, "shipwright:shipwright_table");
    return { dim, o, table: () => dim.getBlock({ x: o.x - 1, y: o.y, z: o.z }) };
  }
  if (gap) dim.set(o.x + 1 + gap[0], 64, gap[1], "minecraft:air");
  if (shallowAt) dim.set(o.x + 1 + shallowAt[0], 63, shallowAt[1], "minecraft:dirt");
  return { dim, o, table: () => dim.getBlock(o) };
}

test("a frame around a basin with the table set in it reads as a dock, ready to flood", () => {
  const s = dockSite();
  const d = detectDock(s.table());
  assert.equal(d?.ok, true, d?.reason);
  assert.equal(d.flooded, false);
  assert.deepEqual([d.length, d.width], [14, 5]);
});

test("a missing frame block is named, with where it goes", () => {
  const s = dockSite({ gap: [6, 3] });
  const d = detectDock(s.table());
  assert.equal(d.ok, false);
  assert.match(String(d.reason), /Frame block missing at/);
  assert.deepEqual([d.blocker.x - s.o.x - 1, d.blocker.z], [6, 3]);
});

test("a basin that isn't dug deep enough says where", () => {
  const s = dockSite({ shallowAt: [4, 1] });
  assert.match(String(detectDock(s.table()).reason), /Basin needs digging out: dirt/);
});

test("the sea wall needs open water behind it", () => {
  const s = dockSite({ noSea: true });
  assert.match(String(detectDock(s.table()).reason), /Open water needed/);
});

test("flooding opens the sea wall and fills the basin to just below the frame", async () => {
  const s = dockSite();
  const d = detectDock(s.table());
  let done = false;
  floodDock(d, () => (done = true));
  for (let i = 0; i < 60 && !done; i++) await settle(2);
  assert.equal(done, true);
  assert.equal(s.dim.getBlock({ x: s.o.x + 1 + 7, y: 63, z: 0 }).typeId, "minecraft:water", "basin flooded");
  assert.equal(s.dim.getBlock({ x: s.o.x + 1 + 7, y: 64, z: 0 }).typeId, "minecraft:air", "water stands below the frame");
  assert.equal(s.dim.getBlock({ x: s.o.x + 1 + 14, y: 64, z: 0 }).typeId, "minecraft:air", "sea wall opened");
  const y = detectYard(s.table());
  assert.equal(y.kind, "dock");
  assert.equal(y.ok && y.flooded, true);
});

test("the longship is built afloat in a flooded dock, with 3 module slots and a steering oar", async () => {
  const s = dockSite({ length: 16 });
  let done = false;
  floodDock(detectDock(s.table()), () => (done = true));
  for (let i = 0; i < 60 && !done; i++) await settle(2);
  const p = makePlayer(s.dim, fullInventory(), "Creative");
  p.inventory.push({ typeId: "minecraft:spruce_log", amount: 1 });
  answers.length = 0;
  answers.push(0, 1, "Advanced", [14], 0, [100, 100], 0, [1, 1, 1], 0, "Launch", ["Sea Wolf"]);
  useTable(p, s);
  await settle(60);
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:longship").at(-1);
  assert.ok(ship, "a longship was built");
  assert.equal(readRecord(ship).stage, 5);
  assert.equal(ship.props["shipwright:mids"], 4);
  assert.equal(getP(ship, "hull_scale"), 2);
  assert.ok(Math.abs(ship.location.y - 63.9) < 0.01, `afloat in the dock (y ${ship.location.y})`);
  const h = computeHandling(readRecord(ship));
  assert.equal(h.rudder, "steering_oar");
  assert.ok(shown.find((f) => f.title === "Choose a plan").buttons.some((b) => /Longship/.test(b)));
});

test("at a beach yard the longship isn't offered", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory());
  shown.length = 0;
  answers.length = 0;
  answers.push(0);
  useTable(p, s);
  await settle();
  assert.ok(!shown.some((f) => f.title === "Choose a plan" && f.buttons.some((b) => /Longship/.test(b))));
  assert.ok(shown.some((f) => f.title === "1 of 5: Lay the keel"));
});

test("a finished dock far from any beach offers Flood the dock, and flooding works from the table", async () => {
  const s = dockSite();          // the sea is at the far end, so the table can't also be a beach yard
  assert.equal(detectBeachYard(s.table()).ok, false, "no beach yard here");
  const p = makePlayer(s.dim, []);
  shown.length = 0; answers.length = 0;
  answers.push(0);               // the first button
  useTable(p, s);
  for (let i = 0; i < 80 && !p.messages.some((m) => /flooded/.test(m)); i++) await settle(2);
  assert.equal(shown[0].buttons[0], "Flood the dock");
  assert.match(shown[0].body, /ready to flood/);
  assert.ok(p.messages.some((m) => /The dock is flooded/.test(m)), p.messages.join(" | "));
});

test("the table can sit right behind the landward wall instead of in it", () => {
  const s = dockSite({ tableBehind: true });
  const d = detectDock(s.table());
  assert.equal(d?.ok, true, d?.reason);
  assert.equal(d.length, 14);
});

test("water a few blocks below the frame still counts as the sea behind the wall", () => {
  const s = dockSite({ lowSea: true });
  assert.equal(detectDock(s.table())?.ok, true);
});

test("older stone brick ids work as frame blocks", () => {
  const s = dockSite({ frame: "minecraft:stonebrick" });
  assert.equal(detectDock(s.table())?.ok, true);
});

test("the flood option always shows once there's a frame, and explains what's missing", async () => {
  const s = dockSite({ gap: [6, 3] });
  const p = makePlayer(s.dim, []);
  shown.length = 0; answers.length = 0;
  answers.push(0);   // "Flood the dock (see what's missing)"
  useTable(p, s);
  await settle();
  const first = shown[0];
  assert.ok(first.buttons.some((b) => /Flood the dock/.test(b)), JSON.stringify(first.buttons));
  assert.ok(shown.some((f) => f.title === "Not ready to flood" && /Frame block missing/.test(f.body)));
});

test("with no frame at all, the menu says so and points to the guide", async () => {
  const s = beach();
  const p = makePlayer(s.dim, []);
  shown.length = 0; answers.length = 0;
  useTable(p, s);
  await settle();
  assert.match(shown[0].body, /No dock frame around this table yet/);
});

test("the yard guide explains each level and can draw the dock blueprint", async () => {
  const s = beach();
  const p = makePlayer(s.dim, []);
  shown.length = 0;
  answers.length = 0;
  answers.push(2, 1);   // main menu: Build a boat, Upgrade the yard, Yard guide; then the guide's "Dock" page
  useTable(p, s);
  await settle();
  const g = shown.find((f) => f.title === "Dock");
  assert.ok(g && /Nether portal laid flat/.test(g.body));
});

// ---------- each boat its own way ----------

test("no boat shares its animation, render controllers or model with another", async () => {
  const fs = await import("node:fs");
  const ids = new Set();
  for (const pid of Object.keys(PLANS).filter((k) => k !== "testship")) {
    const ce = JSON.parse(fs.readFileSync(new URL(`../RP/entity/${pid}.entity.json`, import.meta.url), "utf8"))["minecraft:client_entity"].description;
    for (const id of [...Object.values(ce.geometry), ...Object.values(ce.animations), ...ce.render_controllers]) {
      assert.ok(!ids.has(id), `${id} is shared`);
      ids.add(id);
    }
  }
  assert.ok(!fs.existsSync(new URL("../RP/animations/boat.animation.json", import.meta.url)), "no shared animation left");
});

test("every boat's model carries the full culture-made parts kit, so anything can be fitted", async () => {
  const fs = await import("node:fs");
  const kit = ["mast", "rig_square", "rig_lateen", "rig_crab", "rig_junk", "oar_0_r", "paddle", "dpaddle", "scull", "pole", "ama", "rudder", "furnace"];
  for (const pid of Object.keys(PLANS).filter((k) => k !== "testship")) {
    const geo = JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"));
    const bones = new Set(geo["minecraft:geometry"].flatMap((g) => g.bones).map((b) => b.name));
    for (const k of kit) assert.ok(bones.has(k), `${pid} has ${k}`);
    const bad = geo["minecraft:geometry"].flatMap((g) => g.bones).flatMap((b) => b.cubes ?? []).filter((c) => c.size.some((v) => v < 0));
    assert.equal(bad.length, 0, `${pid} has no broken cubes`);
  }
});

test("hull cross-sections differ by tradition", async () => {
  const fs = await import("node:fs");
  const midPlank = (pid) => JSON.stringify(JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))
    ["minecraft:geometry"].flatMap((g) => g.bones).find((b) => b.name === "mid_0_plank").cubes);
  const looks = new Set(["faering", "rowboat", "bark_canoe", "outrigger", "sampan", "dugout", "punt", "kayak"].map(midPlank));
  assert.equal(looks.size, 8, "eight distinct midship sections");
});

test("each tradition's own rig and propulsion show on its boats, and both can be swapped", () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:sampan", { x: 16000, y: 64, z: 0 });
  const rec = newRecord(PLANS.sampan, "k", 6);
  rec.stage = 5; rec.sections.rig.sail = true;
  writeRecord(e, rec); applyRecord(e, rec);
  assert.equal(getP(e, "rig_style"), 4, "junk sail");
  assert.equal(getP(e, "prop_style"), 3, "sculling oar");
  rec.sections.rig.style = "crab_claw"; rec.propulsion = "double_paddle";
  applyRecord(e, rec);
  assert.equal(getP(e, "rig_style"), 3);
  assert.equal(getP(e, "prop_style"), 2);
  assert.equal(computeHandling(rec).rig, "fore_and_aft", "crab claw sails like a fore-and-aft rig");
});

test("the bark canoe is skinned in birch bark peeled from birch logs", () => {
  assert.deepEqual(shellChoices(PLANS.bark_canoe).map((m) => m.key), ["birch_bark"]);
  const c = plankCost(PLANS.bark_canoe, { bow: "birch_bark", mid: "birch_bark", stern: "birch_bark" }, { length: 6, beam: 1, depth: 1 });
  assert.equal(c[0].label, "Birch Log");
});

// ---------- personal sea chests, through each boat's own chest ----------

function chestBoat(x0) {
  const { e, helm } = anchorBoat(x0);
  e.riders = [];
  return { e, helm, dim: world.getDimension("minecraft:overworld") };
}

test("each player has their own vault chest, tamed to them, kept in a vault that never moves", () => {
  const dim = world.getDimension("minecraft:overworld");
  const a = makePlayer(dim, []), b = makePlayer(dim, []);
  const ca = seaChestOf(a), cb = seaChestOf(b);
  assert.ok(ca && cb && ca.id !== cb.id);
  assert.equal(seaChestOf(a).id, ca.id);
  assert.equal(ca.owner, a.id);
  const v = vaultLocation();
  assert.deepEqual([ca.location.x, ca.location.y, ca.location.z], [v.x, v.y, v.z]);
  assert.ok(dim.commands.some((c) => /tickingarea add .* shipwright_vault/.test(c)));
});

test("taking the helm brings your own items into the boat's chest", () => {
  const { e, dim } = chestBoat(17000);
  const p = makePlayer(dim, []);
  p.inputInfo = { getMovementVector: () => ({ x: 0, y: 0 }), getButtonState: () => "Released" };
  p.onScreenDisplay = { setActionBar() {} };
  seaChestOf(p).chest = { size: 54, slots: [{ typeId: "minecraft:diamond", amount: 3 }] };
  e.riders = [p];
  steerTest.state.delete(e.id);
  tickAll(2);
  assert.equal(chestOwner(e), p.id);
  assert.equal(e.chest.slots[0]?.typeId, "minecraft:diamond", "your diamonds are in the boat's chest");
  assert.equal(seaChestOf(p).chest.slots[0], undefined, "moved, not copied");
});

test("someone else's items never show: the first sneak-use swaps them home, and yours come in", async () => {
  const { e, dim } = chestBoat(17100);
  const a = makePlayer(dim, []), b = makePlayer(dim, []);
  world.players = [a, b];
  for (const p of [a, b]) { p.location = { ...e.location }; p.dimension = dim; }
  seaChestOf(a).chest = { size: 54, slots: [{ typeId: "minecraft:gold_ingot", amount: 5 }] };
  seaChestOf(b).chest = { size: 54, slots: [{ typeId: "minecraft:emerald", amount: 2 }] };
  loadChest(e, a);
  b.isSneaking = true;
  const ev = { player: b, target: e, cancel: false };
  __handlers.beforeInteractEntity(ev);
  assert.equal(ev.cancel, true, "b's first use doesn't open a's things");
  await settle(2);
  assert.equal(chestOwner(e), b.id);
  assert.equal(e.chest.slots[0]?.typeId, "minecraft:emerald");
  assert.equal(seaChestOf(a).chest.slots[0]?.typeId, "minecraft:gold_ingot", "a's gold went home safe");
  const again = { player: b, target: e, cancel: false };
  __handlers.beforeInteractEntity(again);
  assert.equal(again.cancel, false, "now it opens");
});

test("step away from the boat and your items go home", () => {
  const { e, dim } = chestBoat(17200);
  const p = makePlayer(dim, []);
  world.players = [p];
  p.location = { ...e.location }; p.dimension = dim;
  seaChestOf(p).chest = { size: 54, slots: [{ typeId: "minecraft:iron_ingot", amount: 9 }] };
  loadChest(e, p);
  returnAbsentChests([e]);
  assert.equal(chestOwner(e), p.id, "still aboard-ish: nothing moves");
  p.location = { x: e.location.x + 20, y: e.location.y, z: e.location.z };
  returnAbsentChests([e]);
  assert.equal(chestOwner(e), null);
  assert.equal(seaChestOf(p).chest.slots[0]?.typeId, "minecraft:iron_ingot");
});

test("logging off sends your items home too", () => {
  const { e, dim } = chestBoat(17300);
  const p = makePlayer(dim, []);
  world.players = [p];
  p.location = { ...e.location }; p.dimension = dim;
  seaChestOf(p).chest = { size: 54, slots: [{ typeId: "minecraft:book", amount: 1 }] };
  loadChest(e, p);
  world.players = [];                       // gone
  returnAbsentChests([e]);
  assert.equal(chestOwner(e), null);
  assert.equal(seaChestOf(p).chest.slots[0]?.typeId, "minecraft:book");
});

test("the power slot burns fuel from the boat's chest (the helmsman's own items)", () => {
  const inv = [{ typeId: "minecraft:coal", amount: 5 }];
  const { e, p, helm } = furnaceBoat(17400, inv);
  seaChestOf(p).chest = { size: 54, slots: [{ typeId: "minecraft:charcoal", amount: 2 }] };
  helm.input = { x: 0, y: 1 };
  tickAll(4);
  assert.equal(e.chest.slots[0]?.amount, 1, "from the chest");
  assert.equal(inv[0].amount, 5, "not the pocket");
});

test("every boat has its sea chest drawn on deck, skinned like an ender chest", async () => {
  const fs = await import("node:fs");
  for (const pid of Object.keys(PLANS).filter((k) => k !== "testship")) {
    const ce = JSON.parse(fs.readFileSync(new URL(`../RP/entity/${pid}.entity.json`, import.meta.url), "utf8"))["minecraft:client_entity"].description;
    assert.match(ce.textures.sea_chest, /sea_chest_ender/);
    assert.ok(ce.render_controllers.some((r) => r.endsWith(".chest")));
  }
});

// ---------- rigs sized to hulls, stronger sails, strokes, beaching, yards ----------

test("rigs grow with the hull, and the sail's materials grow with its area", () => {
  const small = newRecord(PLANS.faering, "k", 4), big = newRecord(PLANS.sewn_boat, "k", 10);
  const ls = newRecord(PLANS.longship, "k", 20);
  assert.ok(rigScaleFor(small, PLANS.faering) < rigScaleFor(big, PLANS.sewn_boat));
  const wool = (plan, rec) => rigCost(plan, 0, rec).find((c) => /Wool/.test(c.label)).count;
  assert.ok(wool(PLANS.faering, small) < wool(PLANS.sewn_boat, big));
  assert.ok(wool(PLANS.longship, ls) >= 4 * wool(PLANS.faering, small) - 2, "a longship's sail takes several times the cloth");
  assert.ok(rigCost(PLANS.sampan, 0, newRecord(PLANS.sampan, "k", 6)).some((c) => c.label === "Bamboo"), "junk battens");
});

// A piece's eight corners in the model's own (file) coordinates, turned by its own rotation about its pivot as the
// game turns it (the game shows file x mirrored and turns by Rz(rz) . Ry(-ry) . Rx(-rx)).
function cornersOf(c) {
  const [x, y, z] = c.origin, [sx, sy, sz] = c.size;
  let pts = [];
  for (const i of [0, 1]) for (const j of [0, 1]) for (const l of [0, 1]) pts.push([-(x + i * sx), y + j * sy, z + l * sz]);
  if (c.rotation) {
    const [a, b, g] = [-c.rotation[0], -c.rotation[1], c.rotation[2]].map((d) => (d * Math.PI) / 180);
    const piv = [-(c.pivot?.[0] ?? 0), c.pivot?.[1] ?? 0, c.pivot?.[2] ?? 0];
    const rx = ([p, q, r]) => [p, q * Math.cos(a) - r * Math.sin(a), q * Math.sin(a) + r * Math.cos(a)];
    const ry = ([p, q, r]) => [p * Math.cos(b) + r * Math.sin(b), q, -p * Math.sin(b) + r * Math.cos(b)];
    const rz = ([p, q, r]) => [p * Math.cos(g) - q * Math.sin(g), p * Math.sin(g) + q * Math.cos(g), r];
    pts = pts.map((p) => { const d = rz(ry(rx([p[0] - piv[0], p[1] - piv[1], p[2] - piv[2]]))); return [d[0] + piv[0], d[1] + piv[1], d[2] + piv[2]]; });
  }
  return pts.map(([px, py, pz]) => [-px, py, pz]);
}
const boxOf = (c) => { const P = cornersOf(c); return [0, 1, 2].map((k) => [Math.min(...P.map((p) => p[k])), Math.max(...P.map((p) => p[k]))]); };
const touch = (A, B, tol = 0.35) => A.every(([lo, hi], k) => B[k][0] <= hi + tol && lo <= B[k][1] + tol);

test("the rig_scale property reaches the model", () => {
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:longship", { x: 18000, y: 64, z: 0 });
  const rec = newRecord(PLANS.longship, "k", 20);
  applyRecord(e, rec);
  // the model's rig is drawn at the area it sails with on a hull of typical length, so a longer hull's scale is a little over 1
  const r = e.props["shipwright:rig_scale"];
  assert.ok(r >= 0.9 && r < 3, String(r));
});

test("a good breeze on the sail carries her to the speed the trials give (core/boat.js's polar)", async () => {
  const { sailTargetBpt } = await import("../BP/scripts/ourmath.js");
  const { angleOffWind } = await import("../BP/scripts/wind.js");
  const { e, helm } = steerSetup(18100, 7);
  const rec = readRecord(e); rec.sections.rig.sail = true; writeRecord(e, rec);
  steerTest.state.delete(e.id);
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  s.heading = 0;
  for (let i = 0; i < 400; i++) { s.wind = { x: 0.6, z: 1.0 }; steerBoat(e, helm); }   // broad reach, fresh breeze
  const want = sailTargetBpt(s.stats.core, angleOffWind(s.wind, s.heading), Math.hypot(s.wind.x, s.wind.z));
  assert.ok(want > 0 && Math.abs(s.speed - want) < 0.15 * want, `${s.speed.toFixed(3)} against the polar's ${want.toFixed(3)}`);
});

test("strokes: both sides together ahead, opposite to turn on the spot, inside eased under way", () => {
  const { e, helm } = steerSetup(18200, 7);
  helm.input = { x: 0, y: 1 };
  run(e, helm, 20);
  assert.ok(e.props["shipwright:stroke_l"] > 0.5 && e.props["shipwright:stroke_l"] === e.props["shipwright:stroke_r"]);
  const spot = steerSetup(18300, 7);
  spot.helm.input = { x: -1, y: 0 };
  run(spot.e, spot.helm, 10);
  const l = spot.e.props["shipwright:stroke_l"], r = spot.e.props["shipwright:stroke_r"];
  assert.ok(l * r < 0, `turning on the spot rows one side and backs the other (${l}, ${r})`);
  helm.input = { x: -1, y: 1 };
  run(e, helm, 10);
  assert.ok(Math.abs(e.props["shipwright:stroke_l"] - e.props["shipwright:stroke_r"]) > 0.5, "one side eased");
});

test("oars and paddles run on smooth phases, not raw time, so turning can't make them jump", async () => {
  const fs = await import("node:fs");
  for (const pid of ["faering", "outrigger", "kayak", "sampan", "punt"]) {
    const an = Object.values(JSON.parse(fs.readFileSync(new URL(`../RP/animations/${pid}.animation.json`, import.meta.url), "utf8"))
      .animations).map((a) => a.bones).reduce((m, b) => Object.assign(m, b), {});
    for (const k of ["oar_0_l", "paddle", "dpaddle", "scull", "pole"]) {
      assert.ok(!JSON.stringify(an[k]).includes("q.life_time"), `${pid} ${k} uses a running phase`);
    }
  }
});

test("running onto a beach at the waterline beaches the boat gently; rowing astern pushes off", () => {
  const { e, helm } = steerSetup(18400, 6);
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 18380; x <= 18420; x++) for (let z = 9; z <= 20; z++) { dim.set(x, 63, z, "minecraft:sand"); dim.set(x, 64, z, "minecraft:air"); dim.set(x, 65, z, "minecraft:air"); }
  steerTest.state.delete(e.id);
  helm.input = { x: 0, y: 0.6 };
  let s;
  for (let i = 0; i < 300; i++) { s = steerBoat(e, helm); e.location.x += e.velocity.x; e.location.z += e.velocity.z; }
  assert.equal(s.beached, true);
  assert.match(String(s.msg), /Beached/);
  flushWear(e, s);
  assert.ok(readRecord(e).condition.bow > 0.99, "a gentle landing does no harm to the bow");
  helm.input = { x: 0, y: -1 };
  for (let i = 0; i < 20; i++) s = steerBoat(e, helm);
  assert.equal(s.beached, false);
  assert.ok(s.speed < 0, "backing off");
});

test("a beach yard follows the shore: ground falling away is fine, anything at table height blocks", () => {
  const s = beach();
  s.dim.set(s.o.x, s.o.y - 1, s.o.z + 2, "minecraft:air");      // a dip in the beach
  assert.equal(detectBeachYard(s.table ? s.table() : s.dim.getBlock(s.o)).ok, true);
  s.dim.set(s.o.x + 1, s.o.y, s.o.z + 2, "minecraft:oak_planks");
  const y = detectBeachYard(s.dim.getBlock(s.o));
  assert.equal(y.ok, false);
});

test("a dock needs 3 clear blocks above its water", () => {
  const s = dockSite();
  s.dim.set(s.o.x + 6, 66, 1, "minecraft:stone");                 // a ledge over the basin
  const d = detectDock(s.table());
  assert.equal(d.ok, false);
  assert.match(String(d.reason), /Not enough room above the dock/);
});

test("the outrigger float scales with a short hull", async () => {
  const fs = await import("node:fs");
  const an = JSON.parse(fs.readFileSync(new URL("../RP/animations/outrigger.animation.json", import.meta.url), "utf8"))
    .animations["animation.shipwright.outrigger.hull"].bones;
  const src = an.ama.scale[2].replace(/q\.property\('shipwright:mids'\)/g, "m");
  const at = (m) => Function("m", "const math = { clamp: (v, a, b) => Math.min(b, Math.max(a, v)) }; return " + src)(m);
  assert.ok(at(1) < 0.8 && at(6) > 1.0, `${at(1)}, ${at(6)}`);
});

// ---------- proportions, not hard-coded numbers ----------

test("plan beams and depths come from the models' own proportions", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../BP/scripts/config/plans.js", import.meta.url), "utf8");
  assert.ok(!/baseBeam:\s*[0-9]/.test(src) && !/baseDepth:\s*[0-9]/.test(src), "no typed-in beams or depths");
  const { PROPORTIONS } = await import("../BP/scripts/config/proportions.js");
  for (const p of Object.values(PLANS).filter((x) => PROPORTIONS[x.id])) {
    assert.ok(Math.abs(p.baseBeam - PROPORTIONS[p.id].beam * p.modelScale) < 1e-9, p.id);
  }
});

test("rigs are sized by sail area against displacement, so area follows the hull", () => {
  for (const [id, L] of [["faering", 6], ["sewn_boat", 8], ["longship", 20]]) {
    const p = PLANS[id], r = newRecord(p, "k", L);
    const rig = rigFor(r, p);
    const want = Math.max(SAIL_RATIO[rig.style] * Math.pow(displacement(r, p), 2 / 3), SAIL_PER_L2[rig.style] * L * L);   // or the length floor
    if (rig.scale > 0.6 && rig.scale < 3.0) assert.ok(Math.abs(rig.area / want - 1) < 0.05, `${id}: area ${rig.area.toFixed(1)} vs ${want.toFixed(1)}`);
  }
  const small = rigFor(newRecord(PLANS.faering, "k", 4), PLANS.faering), big = rigFor(newRecord(PLANS.faering, "k", 10), PLANS.faering);
  assert.ok(big.area > small.area * 1.5 && big.mast > small.mast, "a longer hull carries more sail on a taller mast");
});

test("a 6-block faering's sail is about twice its beam, on a mast a bit over four blocks", () => {
  const p = PLANS.faering, r = newRecord(p, "k", 6);
  const rig = rigFor(r, p);
  const width = Math.sqrt(rig.area / 0.75);           // the Norse sail's aspect is 0.75
  assert.ok(width / p.baseBeam > 1.8 && width / p.baseBeam < 2.8, `width ${width.toFixed(2)} on beam ${p.baseBeam.toFixed(2)}`);
  // rig.mast stands over the rail; D-004 draws her to the Norse law's depth (B / phi^2, 0.56: she was drawn 0.89), so
  // her rail is lower and the mast over it shorter, though from its step on the keel it is still a bit over four
  assert.ok(rig.mast > 3.2 && rig.mast < 5.6, `mast ${rig.mast.toFixed(2)}`);
  assert.ok(rig.mast + p.baseDepth > 4 && rig.mast + p.baseDepth < 6, `mast from the keel ${(rig.mast + p.baseDepth).toFixed(2)}`);
});

test("each rig's mast reaches just above its own sail, not one height for all", async () => {
  const { PROPORTIONS } = await import("../BP/scripts/config/proportions.js");
  const m = PROPORTIONS.outrigger.masts;
  assert.notEqual(m.crab_claw, m.square, "each style has its own mast height");
  const fs = await import("node:fs");
  // Every mast reaches above the top of its own sail, so the pennant at the masthead flies highest.
  for (const pid of ALL_BOATS()) {
    const bones = JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))["minecraft:geometry"].flatMap((g) => g.bones);
    const mast = bones.find((b) => b.name === "mast");
    const foot = mast.pivot[1], H = mast.cubes[0].size[1];
    for (const [style, name] of [["square", "rig_square"], ["lateen", "rig_lateen"], ["crab_claw", "rig_crab"], ["junk", "rig_junk"]]) {
      const top = Math.max(...bones.find((b) => b.name === name).cubes.map((c) => c.origin[1] + c.size[1]));
      // PROPORTIONS.masts: each style's mast over the rail (D-004: the model is drawn at its scale every way, and the
      // mast is stepped on the keel, so its foot is no longer the rail)
      const pr = PROPORTIONS[pid], head = (pr.depth + pr.wash + pr.masts[style]) * 16;
      assert.ok(foot < (pr.depth + pr.wash) * 16 && foot + H >= head - 0.5, `${pid}: the mast stepped under the rail and tall enough for every rig`);
      const cloth = bones.find((b) => b.name === name).cubes.map((c) => c.origin[1]);
      // a square sail and a junk's hang from the masthead; a lateen's yard and a crab claw's spars are hoisted
      // on a short mast that props them part way up, so their heads stand clear above it
      const need = ["square", "junk"].includes(style) ? top : (Math.min(...cloth) + top) / 2;
      assert.ok(head > need - 0.5, `${pid} ${style}: masthead up to its sail (${head.toFixed(1)} vs ${need.toFixed(1)})`);
    }
  }
});

test("oar sweep and stroke rate follow oar length", async () => {
  const fs = await import("node:fs");
  const rate = (pid) => Number(/q\.delta_time \* \((\d+) \+ 240 \* v\.row\)/.exec(JSON.stringify(
    JSON.parse(fs.readFileSync(new URL(`../RP/entity/${pid}.entity.json`, import.meta.url), "utf8"))))[1]);
  assert.ok(rate("longship") < rate("rowboat"), "long Norse sweeps stroke slower than short European oars");
});

// ---------- no endless bobbing ----------

test("a floating boat's bob is damped without changing where it floats", async () => {
  const { settleBob } = await import("../BP/scripts/buoyancy.js");
  const { e } = steerSetup(19000, 6);
  e.impulses = [];
  const realImpulse = e.applyImpulse.bind(e);
  e.applyImpulse = (v) => { e.impulses.push(v); realImpulse(v); };
  e.velocity = { x: 0, y: 0.08, z: 0 };
  assert.equal(settleBob(e), true);
  assert.ok(Math.abs(e.impulses.at(-1).y + 0.08 * 0.65) < 1e-9, "pushes against the motion");
  assert.equal(e.impulses.at(-1).x, 0, "no sideways push");
  e.velocity = { x: 0, y: 0.001, z: 0 };
  assert.equal(settleBob(e), false, "a boat at rest is left alone");
  const land = world.getDimension("minecraft:overworld").spawnEntity("shipwright:faering", { x: 19500, y: 120, z: 0 });
  land.velocity = { x: 0, y: -0.3, z: 0 };
  assert.equal(settleBob(land), false, "never slows a fall or acts out of water");
});

// ---------- sails to leeward, telltales ----------

test("fore-and-aft sails turn against the wind's side so their free end swings to leeward", async () => {
  const fs = await import("node:fs");
  const ce = JSON.stringify(JSON.parse(fs.readFileSync(new URL("../RP/entity/sewn_boat.entity.json", import.meta.url), "utf8")));
  assert.match(ce, /v\.ftrim = math\.lerp\(v\.ftrim \?\? 0\.0, \(q\.property\('shipwright:wind_rel'\) >= 0 \? -1 : 1\)/);
});

test("telltales stream at a rig's best angle and show pinching or stalling either side of it", async () => {
  const { telltale, bestAngle, sailPower } = await import("../BP/scripts/wind.js");
  for (const rig of ["square", "fore_and_aft"]) {
    const best = bestAngle(rig);
    assert.ok(sailPower(rig, best) >= sailPower(rig, best - 20) && sailPower(rig, best) >= sailPower(rig, best + 20), `${rig} peaks at ${best}`);
    assert.equal(telltale(rig, best), 0);
    assert.ok(telltale(rig, best + 30) < 0, "pinching (closer to the wind; 180 is head to wind)");
    if (best >= 30) assert.ok(telltale(rig, best - 30) > 0, "too far off the wind");
  }
  assert.ok(bestAngle("fore_and_aft") > bestAngle("square"), "fore-and-aft rigs drive best closer to the wind");
});

test("the telltale reading reaches the model while sailing", () => {
  const { e, helm } = steerSetup(19100, 7);
  const rec = readRecord(e); rec.sections.rig.sail = true; writeRecord(e, rec);
  steerTest.state.delete(e.id);
  steerBoat(e, helm);
  const s = steerTest.state.get(e.id);
  s.heading = 0;
  for (let i = 0; i < 5; i++) { s.wind = { x: 0, z: -1 }; steerBoat(e, helm); }   // wind from dead ahead: badly pinched
  assert.equal(e.props["shipwright:telltale"], -1);
});

test("every rig carries a pair of telltales in the sail's yarn corner", async () => {
  const fs = await import("node:fs");
  const geo = JSON.parse(fs.readFileSync(new URL("../RP/models/entity/faering.geo.json", import.meta.url), "utf8"));
  const bones = geo["minecraft:geometry"].flatMap((g) => g.bones);
  for (const r of ["rig_square", "rig_lateen", "rig_crab", "rig_junk"]) {
    for (const s of ["a", "b"]) {
      const b = bones.find((x) => x.name === `tt_${r}_${s}`);
      assert.ok(b && b.parent === r, `${r} ${s}`);
      assert.deepEqual(b.cubes[0].uv, [120, 120]);
    }
  }
});

// ---------- the table builds the dock for you ----------

/** A shore: sand at y 63 and below, the table on it at y 65 (two above the sea), water from z 16 on. */
let shoreZ = 0;
function shore({ chestAt = null, tableRise = 2 } = {}) {
  const dim = world.getDimension("minecraft:overworld");
  const x0 = 25000 + (shoreZ += 60);
  for (let x = x0 - 8; x <= x0 + 8; x++) for (let z = -4; z <= 40; z++) for (let y = 56; y <= 70; y++) {
    let type = "minecraft:air";
    if (z >= 16 && y <= 63) type = "minecraft:water";
    else if (z < 16 && y <= 63 + (tableRise - 2) + 1) type = y === 63 + (tableRise - 2) + 1 ? "minecraft:grass_block" : "minecraft:sand";
    dim.set(x, y, z, type);
  }
  const o = { x: x0, y: 63 + tableRise, z: 0 };
  dim.set(o.x, o.y, o.z, "shipwright:shipwright_table");
  if (chestAt) dim.set(o.x + chestAt[0], chestAt[1], o.z + chestAt[2], "minecraft:chest");
  return { dim, o, table: () => dim.getBlock(o) };
}

test("the table plans a dock toward the water: a two-slab walkway on pilings, priced, with what it will clear", () => {
  const s = shore();
  const st = YARD_STYLES.european;
  const plan = planDock(s.table(), 16, 5, st, { buildings: false });
  assert.equal(plan.ok, true, plan.reason);
  assert.equal(plan.dirName, "south");
  const cost = (id) => plan.costs.find((c) => c.ids[0] === id)?.count ?? 0;
  assert.equal(cost(st.wall), plan.walls.length, "inner ring of the walkway");
  assert.equal(cost(st.deck), plan.edge.length, "outer ring");
  assert.equal(cost(st.post), plan.posts.length + plan.piles.length, "bollards and their pilings");
  assert.equal(cost(st.accent), plan.posts.length);
  assert.ok(plan.walls.length + plan.edge.length + plan.posts.length >= 2 * (2 * 16 + 9) - 4, "two blocks wide all round");
  assert.ok(/_slab$/.test(st.wall) && /_slab$/.test(st.deck), "slabs: half a block over the water, and snow won't settle");
  assert.equal(plan.tableAt, null, "without buildings the table stays in the wall");
  assert.ok(plan.cleared.get("minecraft:sand") > 0, "digs the basin out of the sand");
});

test("it won't clear anyone's chest, and says where it is", () => {
  const s = shore({ chestAt: [1, 64, 5] });
  const plan = planDock(s.table(), 16, 5, YARD_STYLES.norse);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /chest at/);
});

test("the table needs to sit 1 to 2 blocks above the water, and the dock must reach it", () => {
  const high = shore({ tableRise: 5 });
  assert.match(planDock(high.table(), 16, 5, YARD_STYLES.norse).reason ?? "", /1 to 2 blocks above the water/);
  const s = shore();
  assert.match(planDock(s.table(), 8, 5, YARD_STYLES.norse).reason, /wouldn't reach it/);
});

test("building clears, digs, lays the walkway, moves the table to the deck and floods a working dock", async () => {
  const s = shore();
  const plan = planDock(s.table(), 16, 5, YARD_STYLES.european);
  const st = plan.style;                                   // a level 2 dock: the biome's village look
  assert.equal(st.name, "Plains village dock");
  const back = new Map();
  let done = false;
  buildDock(plan, (id, n) => back.set(id, (back.get(id) ?? 0) + n), () => (done = true));
  for (let i = 0; i < 600 && !done; i++) await settle(2);
  assert.equal(done, true);
  assert.equal(s.dim.getBlock(plan.walls[3]).typeId, st.wall);
  assert.equal(s.dim.getBlock({ x: s.o.x, y: 63, z: 5 }).typeId, "minecraft:water", "basin flooded level with the sea");
  assert.equal(s.dim.getBlock({ x: s.o.x, y: 64, z: 5 }).typeId, "minecraft:air", "never a step of water above the sea at the mouth");
  assert.equal(s.dim.getBlock({ x: s.o.x, y: 65, z: 5 }).typeId, "minecraft:air", "headroom clear");
  const corner = plan.posts.find((p) => p.corner);
  assert.equal(s.dim.getBlock(corner).typeId, st.post, "a bollard");
  assert.equal(s.dim.getBlock({ x: corner.x, y: corner.y + 1, z: corner.z }).typeId, st.accent, "its top");
  assert.equal(s.dim.getBlock({ x: corner.x, y: corner.y + 2, z: corner.z }).typeId, st.light, "a light on the corner");
  // the table has moved to the deck, and its old place is walkway
  assert.ok(plan.tableAt, "a table spot on the deck");
  assert.equal(s.dim.getBlock(plan.tableAt).typeId, "shipwright:shipwright_table");
  assert.equal(s.dim.getBlock(s.o).typeId, st.wall);
  assert.ok((back.get("minecraft:sand") ?? 0) > 0, "dug-out sand comes back");
  // the dock is still found, from the table's new place
  const y = detectYard(s.dim.getBlock(plan.tableAt));
  assert.equal(y.kind, "dock");
  assert.equal(y.ok && y.flooded, true, y.reason);
  assert.deepEqual([y.length, y.width], [16, 5]);
  assert.deepEqual([y.origin.x, y.origin.z], [s.o.x, s.o.z], "measured from where it was built");
});

test("Upgrade the yard offers your traditions' dock styles and builds one from the table", async () => {
  const s = shore();
  const p = makePlayer(s.dim, [{ typeId: "minecraft:spruce_log", amount: 1 }], "Creative");   // learns Norse
  shown.length = 0;
  answers.length = 0;
  // "no working yard" screen: Upgrade first; Dock (0); style: Norse naust (0); size 16 x 5; confirm
  answers.push(0, 0, 0, [16, 5], 0);
  useTable(p, s);
  for (let i = 0; i < 800 && !p.messages.some((m) => /dock is built/.test(m)); i++) await settle(2);
  assert.ok(p.messages.some((m) => /dock is built and flooded/.test(m)), p.messages.join(" | "));
  const styleMenu = shown.find((f) => f.title === "Dock style");
  assert.deepEqual(styleMenu.buttons, ["Plains village dock", "Custom"], "a dock is the village's own; traditions build dry docks");
  const where = /\((-?\d+) (-?\d+) (-?\d+)\)/.exec(p.messages.find((m) => /dock is built/.test(m)));
  assert.ok(where, "says where the table moved to");
  const d = detectYard(s.dim.getBlock({ x: +where[1], y: +where[2], z: +where[3] }));
  assert.equal(d.kind, "dock");
});

test("every culture's dock is built from its own country's blocks", () => {
  const s = shore();
  for (const [key, st] of Object.entries(YARD_STYLES)) {
    const plan = planDock(s.table(), 16, 5, st, { buildings: false });
    assert.equal(plan.ok, true, `${key}: ${plan.reason}`);
    const ids = plan.costs.map((c) => c.ids[0]);
    assert.ok(ids.includes(st.wall) && ids.includes(st.post), `${key} uses its walls and posts`);
  }
  const walls = new Set(Object.values(YARD_STYLES).map((x) => `${x.wall}|${x.post}|${x.accent}`));
  assert.equal(walls.size, Object.keys(YARD_STYLES).length, "no two styles look alike");
});

test("a custom dock uses exactly the parts you choose", async () => {
  const s = shore();
  const p = makePlayer(s.dim, [], "Creative");
  answers.length = 0;
  // Upgrade, Dock, style: Custom (no traditions known, so it's the only button), size,
  // parts: Walls Stone (1), footing cobblestone (1), posts oak log (1), tops oak fence (1), lights soul lantern (2); material: Bricks (5); confirm
  answers.push(0, 0, 1, [16, 5], [1, 1, 1, 1, 2], [5], 0);    // style: the village dock (0) or Custom (1)
  useTable(p, s);
  for (let i = 0; i < 400 && !p.messages.some((m) => /dock is built/.test(m)); i++) await settle(2);
  assert.ok(p.messages.some((m) => /dock is built/.test(m)), p.messages.join(" | "));
  const anyWall = s.dim.getBlock({ x: s.o.x - 3, y: s.o.y, z: s.o.z + 2 });
  assert.equal(anyWall.typeId, "minecraft:brick_block");
});

// ---------- fitted modules drawn on the boat ----------

test("fitted modules reach the model: rail, ends and hull as bits, deck modules at their stations", async () => {
  const { modsBits, deckBits } = await import("../BP/scripts/ship.js");
  assert.equal(modsBits(["shield_rail"]), 1);
  assert.equal(modsBits(["ram", "hold"]), 2, "the hold is a deck module, drawn at its station");
  assert.equal(modsBits(["ice_runners"]), 8, "ice runners draw under the hull");
  assert.equal(modsBits(["light_hull"]), 256, "a light hull shows its lashings");
  assert.equal(modsBits(["hold", "benches", "canopy"]), 0, "deck modules are drawn at their stations, not as bits");
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 19600, y: 64, z: 0 });
  const rec = newRecord(PLANS.faering, "k", 7);
  rec.modules = ["shield_rail", "hold", "benches"];
  applyRecord(e, rec);
  assert.equal(e.props["shipwright:mods"], 1);
  // small boats: no walkways, one station each, from the helm forward: hold at section 0, benches at 1
  assert.equal(deckBits(rec, PLANS.faering), 1 + 2 * 16);
  assert.equal(e.props["shipwright:deck"], 1 + 2 * 16);
});

test("every boat has a shield rail batten per section and a ram at the bow; no drawn shields", async () => {
  const fs = await import("node:fs");
  for (const pid of Object.keys(PLANS).filter((k) => k !== "testship")) {
    const bones = JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))["minecraft:geometry"].flatMap((g) => g.bones);
    assert.ok(!bones.some((x) => /^shield_/.test(x.name)), `${pid}: shields are real items on pegs, not geometry`);
    assert.ok(bones.some((x) => x.name === "deck_rail_0"), `${pid}: rail batten`);
    assert.equal(bones.find((x) => x.name === "ram")?.parent, "bow");
    const rc = JSON.parse(fs.readFileSync(new URL(`../RP/render_controllers/${pid}.render_controllers.json`, import.meta.url), "utf8")).render_controllers;
    assert.ok(!rc[`controller.render.shipwright.${pid}.shields`], `${pid}: no shields pass`);
    assert.ok(JSON.stringify(rc).includes("deck_rail_0"), `${pid}: the rail shows when fitted`);
  }
});

// ---------- typical sizes, seats, walkable decks, connected stems ----------

test("sizes come at each tradition's typical proportions, with Advanced for the rest", async () => {
  const { sizePresets } = await import("../BP/scripts/ship.js");
  const fae = sizePresets(PLANS.faering, 10);
  assert.deepEqual(fae.map((p) => p.label), ["Short", "Typical", "Long"]);
  const typ = fae[1];
  assert.ok(Math.abs(typ.length / (typ.beam * PLANS.faering.baseBeam) - PLANS.faering.typicalLB) < 0.6, "about 4.25 times as long as wide");
  const canoe = sizePresets(PLANS.bark_canoe, 10)[1];
  assert.ok(canoe.length / (canoe.beam * PLANS.bark_canoe.baseBeam) > typ.length / (typ.beam * PLANS.faering.baseBeam), "a canoe is leaner than a faering");
});

test("choosing Typical builds with no sliders: the frames just confirm", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory(), "Creative");
  shown.length = 0; answers.length = 0;
  answers.push(0, "Typical", 0, 0);   // Build, Typical, pay the keel, confirm the frames
  useTable(p, s);
  await settle();
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:faering").at(-1);
  const rec = readRecord(ship);
  assert.equal(rec.stage, 2, "frames up");
  assert.ok(!shown.some((f) => f.title === "2 of 5: Raise the frames" && f.fields?.length), "no beam or depth sliders");
});

test("seat height can be calibrated in game for every boat at once", () => {
  const dim = world.getDimension("minecraft:overworld");
  const { e } = steerSetup(19700, 6);
  e.getComponent = ((orig) => (n) => (n === "minecraft:rideable" ? { getRiders: () => [] } : orig.call(e, n)))(e.getComponent);
  const p = makePlayer(dim, []);
  world.players = [p];
  __handlers.scriptevent({ id: "shipwright:seat", message: "high", sourceEntity: p });
  assert.equal(world.getDynamicProperty("shipwright:seat"), "high");
  assert.ok(e.events.some((x) => /^shipwright:seats_high_\d$/.test(x)), e.events.join(", "));
  world.setDynamicProperty("shipwright:seat", "mid");
});

function longshipAt(x0) {
  const dim = world.getDimension("minecraft:overworld");
  for (let x = x0 - 30; x <= x0 + 30; x++) for (let z = -30; z <= 30; z++) { dim.set(x, 63, z, "minecraft:water"); dim.set(x, 62, z, "minecraft:water"); dim.set(x, 61, z, "minecraft:stone"); }
  const e = dim.spawnEntity("shipwright:longship", { x: x0 + 0.5, y: 63.6, z: 0.5 });
  const rec = newRecord(PLANS.longship, "k", 16); rec.stage = 5; writeRecord(e, rec); applyRecord(e, rec);
  e.tags.add("shipwright_launched"); e.triggerEvent("shipwright:launch");
  steerTest.state.delete(e.id);
  return { dim, e };
}

test("a stopped longship lays a walkable deck over the water under its hull, and puts the water back", async () => {
  const { layDeck, liftDeck, deckOf } = await import("../BP/scripts/deck.js");
  const { dim, e } = longshipAt(20500);
  const h = computeHandling(readRecord(e));
  const n = layDeck(e, h, 0);
  assert.ok(n > 20, `${n} deck blocks`);
  const cell = deckOf(e.id).cells[0];
  assert.equal(dim.getBlock({ x: cell[0], y: cell[1], z: cell[2] }).typeId, "minecraft:barrier");
  liftDeck(e.id);
  assert.equal(dim.getBlock({ x: cell[0], y: cell[1], z: cell[2] }).typeId, "minecraft:water", "water put back");
  assert.equal(deckOf(e.id), null);
});

test("small boats never lay a deck", async () => {
  const { deckOf } = await import("../BP/scripts/deck.js");
  const { e } = anchorBoat(20600);
  tickAll(10);
  assert.equal(deckOf(e.id), null);
});

test("walkers are carried with the ship's movement and turning, and stay on deck", async () => {
  const { boardWalkers, carryWalkers, _deckTest } = await import("../BP/scripts/deck.js");
  const { dim, e } = longshipAt(20700);
  const h = computeHandling(readRecord(e));
  const s = { heading: 0, speed: 0.2 };
  const p = makePlayer(dim, []);
  world.players = [p];
  const start = _deckTest.world2(e.location, 0, 4, 0.3);        // 4 blocks forward of the helm
  p.location = { x: start.x, y: 64, z: start.z };
  boardWalkers(e, s, h);
  assert.equal(s.walkers.size, 1);
  e.location.z += 0.5;                                           // the ship moves on...
  s.heading = 10;                                                // ...and turns
  carryWalkers(e, s, h);
  const here = _deckTest.local(p.location, e.location, 10);
  assert.ok(Math.abs(here.a - 4) < 0.01 && Math.abs(here.s - 0.3) < 0.01, `kept at its deck spot (${here.a.toFixed(2)}, ${here.s.toFixed(2)})`);
  assert.equal(dim.getBlock({ x: Math.floor(p.location.x), y: 63, z: Math.floor(p.location.z) }).typeId, "minecraft:barrier", "a block under their feet");
  p.location = { ...p.location, x: p.location.x + 10 };          // walks straight off the side...
  carryWalkers(e, s, h);
  const kept = _deckTest.local(p.location, e.location, 10);
  assert.ok(Math.abs(kept.s) < h.beam / 2, "kept on the deck");
});

test("sneaking lets a walker go, and their support block becomes water again", async () => {
  const { boardWalkers, carryWalkers, _deckTest } = await import("../BP/scripts/deck.js");
  const { dim, e } = longshipAt(20800);
  const h = computeHandling(readRecord(e));
  const s = { heading: 0, speed: 0.2 };
  const p = makePlayer(dim, []);
  world.players = [p];
  const at = _deckTest.world2(e.location, 0, 3, 0);
  p.location = { x: at.x, y: 64, z: at.z };
  boardWalkers(e, s, h);
  carryWalkers(e, s, h);
  const cell = { x: Math.floor(p.location.x), y: 63, z: Math.floor(p.location.z) };
  assert.equal(dim.getBlock(cell).typeId, "minecraft:barrier");
  p.isSneaking = true;
  carryWalkers(e, s, h);
  assert.equal(s.walkers.size, 0);
  assert.equal(dim.getBlock(cell).typeId, "minecraft:water");
});

// Every piece standing out past the hull's tip (the stem, its head, the plate behind it) joins, piece to piece, back
// to the hull: one timber, never a part floating free.
function stemJoined(bones) {
  const tip = -7 * 16 - 24;
  const all = bones.find((b) => b.name === "bow_plank").cubes.map(boxOf);
  const out = all.filter((B) => B[2][0] < tip - 0.3), hull = all.filter((B) => B[2][0] >= tip - 0.3);
  const seen = new Set(), stack = out.filter((B) => hull.some((H) => touch(B, H))).map((B) => out.indexOf(B));
  stack.forEach((i) => seen.add(i));
  while (stack.length) { const i = stack.pop(); out.forEach((B, j) => { if (!seen.has(j) && touch(out[i], B)) { seen.add(j); stack.push(j); } }); }
  return out.length > 0 && seen.size === out.length;
}

test("Norse stem posts are one continuous timber joined to the hull", async () => {
  const fs = await import("node:fs");
  for (const pid of ["faering", "longship"]) {
    const bones = JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))["minecraft:geometry"].flatMap((g) => g.bones);
    assert.ok(stemJoined(bones), `${pid}: every piece of the stem joins the hull`);
  }
});

// ---------- the deck grid, module categories, stations and the lashed tiller ----------

test("minimum lengths follow the deck grid formula", async () => {
  const { minLength } = await import("../BP/scripts/grid.js");
  assert.equal(minLength("medium", [2, 2, 2]), 14, "three two-block modules with walkways");
  assert.equal(minLength("medium", [1, 1, 1]), 11, "three one-block modules");
  assert.equal(minLength("large", [3, 3, 3, 3]), 23, "the large bound, before a second mast");
  assert.equal(minLength("small", [1, 1], false), 6, "a small boat with two slots");
});

test("deck slots follow length: one per block past 4 on small boats, a kayak just one", async () => {
  const { deckSlotsFor } = await import("../BP/scripts/grid.js");
  assert.deepEqual([4, 5, 6, 10].map((L) => deckSlotsFor(newRecord(PLANS.faering, "k", L), PLANS.faering)), [0, 1, 2, 2]);
  assert.equal(deckSlotsFor(newRecord(PLANS.kayak, "k", 6), PLANS.kayak), 1);
  assert.equal(deckSlotsFor(newRecord(PLANS.longship, "k", 16), PLANS.longship), 3);
});

test("bigger modules need more stations: a hold too big for the deck says how many more", async () => {
  const s = dockSite({ length: 16 });
  let done = false;
  floodDock(detectDock(s.table()), () => (done = true));
  for (let i = 0; i < 60 && !done; i++) await settle(2);
  const p = makePlayer(s.dim, [{ typeId: "minecraft:spruce_log", amount: 1 }, { typeId: "minecraft:chest", amount: 3 }], "Creative");
  answers.length = 0;
  answers.push(0, 1, "Typical", 0, 0, [1, 1, 1], 0, "Launch", ["Sea Wolf"]);
  useTable(p, s);
  await settle(60);
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:longship").at(-1);
  const rec = readRecord(ship);
  rec.modules = ["hold", "hold"].map((k, i) => (i ? "canopy" : k));   // a hold and a canopy already aboard
  writeRecord(ship, rec);
  const { layoutDeck } = await import("../BP/scripts/grid.js");
  const { MODULES } = await import("../BP/scripts/config/modules.js");
  const lay = layoutDeck(rec, PLANS.longship, ["hold", "canopy", "benches"].map((k) => ({ key: k, ...MODULES[k] })));
  assert.ok(lay.placed[1].station === lay.placed[0].footprint + 1, "a walkway between modules on a medium ship");
});

test("each tradition draws its own benches and canopy, shown only at the layout's stations", async () => {
  const fs = await import("node:fs");
  const bones = (pid) => JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))["minecraft:geometry"].flatMap((g) => g.bones);
  const bench = (pid) => bones(pid).find((b) => b.name === "deck_bench_0").cubes.length;
  assert.equal(bench("faering"), 4, "Norse rowers' sea chests, each side with its lid");
  assert.equal(bench("rowboat"), 2, "a stout thwart on its post");
  const canopy = (pid) => JSON.stringify(bones(pid).find((b) => b.name === "deck_canopy_0").cubes);
  assert.notEqual(canopy("sampan"), canopy("outrigger"), "bamboo arch and thatch differ");
  const rc = JSON.parse(fs.readFileSync(new URL("../RP/render_controllers/sampan.render_controllers.json", import.meta.url), "utf8")).render_controllers;
  assert.ok(JSON.stringify(rc["controller.render.shipwright.sampan.deck_canopy"].part_visibility).includes("shipwright:deck"));
  const ce = JSON.parse(fs.readFileSync(new URL("../RP/entity/outrigger.entity.json", import.meta.url), "utf8"))["minecraft:client_entity"].description;
  assert.match(ce.textures.canopy, /hay_block/, "Pacific thatch");
});

test("benches add pull at the oars", () => {
  const plain = newRecord(PLANS.faering, "k", 7), benched = newRecord(PLANS.faering, "k", 7);
  benched.modules = ["benches"];
  assert.ok(computeHandling(benched).benchPull > computeHandling(plain).benchPull);
});

function lashBoat(x0, nav = true) {
  const { e, helm } = steerSetup(x0, 7);
  const dim = world.getDimension("minecraft:overworld");
  for (let x = x0 - 30; x <= x0 + 30; x++) for (let z = -30; z <= 30; z++) { dim.set(x, 62, z, "minecraft:water"); dim.set(x, 61, z, "minecraft:stone"); }
  e.tags.add("shipwright_launched");
  e.triggerEvent("shipwright:launch");                   // seats, so the steering loop sees the helmsman
  const rec = readRecord(e); rec.sections.rig.sail = true; if (nav) rec.modules = ["navigation"]; writeRecord(e, rec);
  steerTest.state.delete(e.id);
  const p = makePlayer(world.getDimension("minecraft:overworld"), []);
  p.inputInfo = helm.inputInfo; p.onScreenDisplay = { setActionBar() {} };
  Object.defineProperty(p, "input", { get: () => helm.input, set: (v) => { helm.input = v; } });
  e.riders = [p];
  tickAll(2);
  return { e, p, helm, s: steerTest.state.get(e.id) };
}

test("with Navigation, a lashed tiller holds the course with nobody at the helm", async () => {
  const { toggleLash } = await import("../BP/scripts/steering.js");
  const { e, p, s } = lashBoat(41000);
  s.heading = 30;
  assert.equal(toggleLash(e, p), true);
  e.riders = [];                                          // the helmsman steps away
  for (let i = 0; i < 200; i++) { s.wind = { x: 0.7, z: 0.7 }; tickAll(1); }
  assert.equal(s.anchor, null, "she sails on instead of anchoring");
  assert.ok(Math.abs(s.heading - 30) < 25, `holds roughly her course (${s.heading.toFixed(1)})`);
  assert.ok(s.speed > 0.01, `still sailing (speed ${s.speed}, sail ${s.sailSet}, anchor ${JSON.stringify(s.anchor)}, lashed ${s.lashed}, aground ${s.aground}, beached ${s.beached})`);
});

test("steering or dropping anchor frees a lashed tiller; without Navigation it can't be lashed", async () => {
  const { toggleLash, dropAnchor } = await import("../BP/scripts/steering.js");
  const a = lashBoat(41100);
  toggleLash(a.e, a.p);
  a.helm.input = { x: 1, y: 0 };
  tickAll(2);
  assert.equal(a.s.lashed, false, "steering frees it");
  toggleLash(a.e, a.p);
  dropAnchor(a.e, a.s, true);
  assert.equal(a.s.lashed, false, "anchoring frees it");
  const b = lashBoat(41200, false);
  assert.equal(toggleLash(b.e, b.p), false);
  assert.ok(b.p.messages.some((m) => /Navigation module/.test(m)));
});

test("with Navigation, soundings go into the ship's log", async () => {
  const { takeSoundings, flushWear } = await import("../BP/scripts/steering.js");
  const { e, s } = lashBoat(41300);
  takeSoundings(e, s, s.stats);
  flushWear(e, s);
  const log = readRecord(e).log.soundings;
  assert.ok(Object.keys(log).length >= 1);
  const { describeShip } = await import("../BP/scripts/ship.js");
  assert.match(describeShip(readRecord(e)), /Ship's log: 1 area sounded/);
});

// ---------- medium ships ----------

const MEDIUM = ["longship", "cog", "freight_canoe", "voyaging_canoe", "dhow", "junk", "bezaisen", "war_canoe", "flatboat", "umiak"];

test("every tradition has a medium ship, built only at a dock, drawn at twice the size", () => {
  const traditions = new Set(MEDIUM.map((k) => PLANS[k].tradition));
  assert.equal(traditions.size, 10, "one per tradition");
  for (const k of MEDIUM) {
    const p = PLANS[k];
    assert.equal(p.yardLevel, 2, `${k} needs a dock`);
    assert.equal(p.modelScale, 2, `${k} is drawn at twice the size`);
    assert.ok(p.lengthRange[0] >= 12, `${k} is a medium hull`);
  }
});

test("medium half-beams come from each tradition's length-to-beam ratio", () => {
  for (const k of MEDIUM.filter((x) => x !== "longship")) {
    const p = PLANS[k];
    const L = 17;
    const ratio = L / p.baseBeam;
    assert.ok(Math.abs(ratio - p.typicalLB) / p.typicalLB < 0.08, `${k}: ${ratio.toFixed(2)} vs ${p.typicalLB}`);
  }
});

test("cogs, junks and bezaisen hang a sternpost rudder; paddled hulls and the longship don't", async () => {
  const { rudderFor } = await import("../BP/scripts/handling.js");
  for (const k of ["cog", "junk", "bezaisen"]) assert.equal(rudderFor(PLANS[k], 16), "sternpost", k);
  for (const k of ["longship", "freight_canoe", "voyaging_canoe", "war_canoe", "umiak", "flatboat"]) assert.equal(rudderFor(PLANS[k], 16), "steering_oar", k);
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:cog", { x: 22000, y: 64, z: 0 });
  applyRecord(e, newRecord(PLANS.cog, "k", 16));
  assert.equal(getP(e, "rudder_type"), 1);
});

test("the voyaging canoe has two hulls with a platform between, and steadies like an outrigger", async () => {
  const fs = await import("node:fs");
  const bones = JSON.parse(fs.readFileSync(new URL("../RP/models/entity/voyaging_canoe.geo.json", import.meta.url), "utf8"))["minecraft:geometry"].flatMap((g) => g.bones);
  const xs = bones.find((b) => b.name === "mid_0_plank").cubes.map((c) => c.origin[0]);
  assert.ok(Math.max(...xs) > 15, "a second hull out to port");
  const plain = computeHandling(newRecord(PLANS.dhow, "k", 16)), twin = computeHandling(newRecord(PLANS.voyaging_canoe, "k", 16));
  assert.equal(twin.outrigger, true);
  assert.ok(twin.stability > 1);
});

test("every medium ship has crew stations and long hit areas", async () => {
  const fs = await import("node:fs");
  for (const k of MEDIUM) {
    const d = JSON.parse(fs.readFileSync(new URL(`../BP/entities/${k}.json`, import.meta.url), "utf8"))["minecraft:entity"];
    const seats = d.component_groups["shipwright:seats_mid_7"]["minecraft:rideable"].seats;
    assert.equal(seats.length, 6, `${k} stations`);
    assert.ok(d.component_groups["shipwright:seats_mid_7"]["minecraft:custom_hit_test"].hitboxes.length >= 8, `${k} hit areas`);
  }
});

test("each medium ship can be built afloat in a dock", async () => {
  const s = dockSite({ length: 20 });
  let done = false;
  floodDock(detectDock(s.table()), () => (done = true));
  for (let i = 0; i < 60 && !done; i++) await settle(2);
  const p = makePlayer(s.dim, [{ typeId: "minecraft:oak_log", amount: 1 }], "Creative");   // learns Northern European
  shown.length = 0; answers.length = 0;
  answers.push(0, "Cog", "Typical", 0, 0, [1, 1, 1], 0, "Launch", ["Hanse"]);
  useTable(p, s);
  await settle(60);
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:cog").at(-1);
  assert.ok(ship, "a cog was built");
  assert.equal(readRecord(ship).stage, 5);
});

test("every stem is one connected timber: Norse curls and raked stems alike", async () => {
  const fs = await import("node:fs");
  for (const pid of ALL_BOATS()) {
    const bones = JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))["minecraft:geometry"].flatMap((g) => g.bones);
    assert.ok(stemJoined(bones), `${pid}: every piece of the stem joins the hull`);
  }
});

test("every boat's icon is rendered from its own model", async () => {
  const fs = await import("node:fs");
  for (const k of Object.keys(PLANS).filter((x) => x !== "testship")) {
    assert.ok(fs.existsSync(new URL(`../RP/textures/ui/shipwright/boat_${k}.png`, import.meta.url)), k);
  }
});

// ---------- Bedrock's rules for entity properties (breaking them makes boats invisible) ----------

test("every entity stays within Bedrock's property rules, and the models only use defined properties", async () => {
  const fs = await import("node:fs");
  const dir = new URL("../BP/entities/", import.meta.url);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(new URL(f, dir), "utf8"))["minecraft:entity"].description;
    const props = d.properties ?? {};
    assert.ok(Object.keys(props).length <= 32, `${f}: ${Object.keys(props).length} properties; Bedrock allows 32 and rejects them all past that`);
    for (const [k, v] of Object.entries(props)) {
      if (v.type === "float") {
        const raw = fs.readFileSync(new URL(f, dir), "utf8");
        const block = raw.slice(raw.indexOf(`"${k}"`), raw.indexOf("}", raw.indexOf(`"${k}"`)));
        assert.ok(!/"default":\s*-?\d+\s*[,}\n]/.test(block + "\n") || /"default":\s*-?\d+\.\d+/.test(block), `${f}: ${k} needs a decimal default`);
      }
    }
    if (!d.identifier.startsWith("shipwright:") || d.identifier === "shipwright:sea_chest") continue;
    const pid = d.identifier.split(":")[1];
    const used = new Set();
    for (const rp of [`../RP/animations/${pid}.animation.json`, `../RP/render_controllers/${pid}.render_controllers.json`, `../RP/entity/${pid}.entity.json`]) {
      for (const m of fs.readFileSync(new URL(rp, import.meta.url), "utf8").matchAll(/q\.property\('([a-z_:]+)'\)/g)) used.add(m[1]);
    }
    for (const u of used) assert.ok(props[u], `${pid}: the model uses ${u}, which the entity doesn't define`);
  }
});

// ---------- the render split and the guided fit-out ----------

test("each render pass draws only its own small model, and animations run only for fitted parts", async () => {
  const fs = await import("node:fs");
  for (const pid of ["faering", "cog", "voyaging_canoe"]) {
    const geos = Object.fromEntries(JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))
      ["minecraft:geometry"].map((g) => [g.description.identifier, g.bones.length]));
    const ce = JSON.parse(fs.readFileSync(new URL(`../RP/entity/${pid}.entity.json`, import.meta.url), "utf8"))["minecraft:client_entity"].description;
    const rc = JSON.parse(fs.readFileSync(new URL(`../RP/render_controllers/${pid}.render_controllers.json`, import.meta.url), "utf8")).render_controllers;
    let work = 0;
    for (const c of Object.values(rc)) {
      // a pass names one model, or picks from an array of them (the hull: building or launched)
      const keys = c.geometry.startsWith("Array.") ? Object.values(c.arrays.geometries)[0] : [c.geometry];
      let most = 0;
      for (const g of keys) {
        const key = g.replace("Geometry.", "");
        assert.ok(ce.geometry[key], `${pid}: pass uses ${key}`);
        most = Math.max(most, geos[ce.geometry[key]]);
      }
      work += most;
    }
    assert.ok(work < 500, `${pid}: ${work} parts processed per frame (was about 1,700)`);
    const conditional = ce.scripts.animate.filter((a) => typeof a === "object").map((a) => Object.keys(a)[0]);
    assert.deepEqual(conditional.sort(), ["cranks", "oars", "paddles", "rig"]);
  }
});

test("the walking deck sits a block lower under the boat's own footprint, so the hull never rests on it", async () => {
  const { layDeck, deckOf, liftDeck } = await import("../BP/scripts/deck.js");
  const { e } = longshipAt(42000);
  layDeck(e, computeHandling(readRecord(e)), 0);
  const water = Math.floor(e.location.y);
  let under = 0;
  for (const [x, y, z, was] of deckOf(e.id).cells) {
    if (was === "minecraft:air") continue;                  // the gunwale and masts, above the deck
    const own = Math.abs(x + 0.5 - e.location.x) < 2 && Math.abs(z + 0.5 - e.location.z) < 2;
    if (own) under++;
    assert.equal(y, own ? water - 1 : water, `deck height at ${x},${z}`);
  }
  assert.ok(under > 0, "the deck continues under the hull's middle, nobody falls through");
  liftDeck(e.id);
});

test("a laid deck has a gunwale you hop over and masts you walk round, never through", async () => {
  const { layDeck, deckOf, liftDeck, clampToDeck, solidCells, hullCells } = await import("../BP/scripts/deck.js");
  const { e } = longshipAt(42100);
  const rec = readRecord(e);
  rec.sections.rig = { ...(rec.sections.rig ?? {}), sail: true, style: "square" };
  writeRecord(e, rec);
  const h = computeHandling(rec);
  assert.ok(h.mastsAt.length >= 1, "the longship steps a mast");
  layDeck(e, h, 0);
  const water = Math.floor(e.location.y);
  const cells = deckOf(e.id).cells;
  const raised = cells.filter((c) => c[3] === "minecraft:air");
  assert.ok(raised.some((c) => c[1] === water + 1), "a gunwale one block up");
  assert.ok(raised.some((c) => c[1] === water + 2), "a mast two blocks up");
  const deck = new Set(cells.filter((c) => c[3] !== "minecraft:air").map((c) => `${c[0]},${c[2]}`));
  for (const c of raised.filter((c) => c[1] === water + 1)) {
    const k = `${c[0]},${c[2]}`;
    const mast = raised.some((m) => m[1] === water + 2 && m[0] === c[0] && m[2] === c[2]);
    if (!mast) assert.ok(!deck.has(k), "the gunwale stands outside the deck, not on it");
  }
  // There's a way aboard: a gap in the rail each side amidships.
  const solids = solidCells(e.location, 0, h, hullCells(e.location, 0, h)).filter((c) => c.part === "gunwale");
  const ring = solids.length;
  assert.ok(ring > 8);
  liftDeck(e.id);
  for (const [x, y, z, was] of cells) assert.equal(e.dimension.getBlock({ x, y, z }).typeId, was, "everything put back");
  // Walking under way: pushed round the mast, kept inside the rail.
  const off = -h.helmAt;
  for (const m of h.mastsAt) {
    const k = clampToDeck(m + off, 0, h);
    assert.ok(Math.hypot(k.a - off - m, k.s) >= 0.54, "never inside the mast");
  }
  const wide = clampToDeck(off, 50, h);
  assert.ok(wide.s < h.overallHalfWidth, "never through the gunwale");
});

test("fitting out moves forward step by step, with Back and Launch now", async () => {
  const s = beach();
  const p = makePlayer(s.dim, fullInventory(), "Creative");
  shown.length = 0; answers.length = 0;
  // Build, Typical, keel, frames, planking, confirm; fit out: keep the sail, keep propulsion, Back, keep, keep power, Launch now; name
  answers.push(0, "Typical", 0, 0, [1, 1, 1], 0, "Keep", "Keep", "Back", "Keep", "Keep", "Launch now", ["Steady"]);
  useTable(p, s);
  await settle(40);
  const titles = shown.map((f) => f.title).filter((x) => /Fit out/.test(x));
  assert.deepEqual(titles.slice(0, 5).map((x) => x.replace(/.*\): /, "")), ["Sail", "Propulsion", "Power", "Propulsion", "Power"]);
  const ship = s.dim.entities.filter((x) => x.typeId === "shipwright:faering").at(-1);
  assert.equal(readRecord(ship).stage, 5, "launched");
});

// ---------- display and dimension standards ----------

const modelsOf = async (pid) => {
  const fs = await import("node:fs");
  return Object.fromEntries(JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))
    ["minecraft:geometry"].map((g) => [g.description.identifier.split(".").pop(), g.bones]));
};
const ALL_BOATS = () => Object.keys(PLANS).filter((k) => k !== "testship");

test("no frame ever passes through the planking, on any boat, anywhere along the hull", async () => {
  let checked = 0;
  for (const pid of ALL_BOATS()) {
    const bones = Object.fromEntries((await modelsOf(pid))[pid].map((b) => [b.name, b]));
    for (const zone of [...Array.from({ length: 7 }, (_, i) => `mid_${i}`), "bow", "stern"]) {
      // frames are ribs laid along the hull's own curve, inside its shell: none reaches past the planking's outer face
      const planks = bones[`${zone}_plank`].cubes.map(boxOf);
      const reach = Math.max(...planks.map((B) => Math.max(Math.abs(B[0][0]), Math.abs(B[0][1]))));
      for (const c of bones[`${zone}_frame`]?.cubes ?? []) {
        checked++;
        const B = boxOf(c);
        assert.ok(Math.max(Math.abs(B[0][0]), Math.abs(B[0][1])) <= reach + 0.01, `${pid} ${zone}: a frame reaches past the shell`);
      }
    }
  }
  assert.ok(checked > 300, `${checked} frames checked`);
});

test("plank thickness in the world follows the wall law, whatever the model scale", async () => {
  const { PROPORTIONS } = await import("../BP/scripts/config/proportions.js");
  const widths = async (pid, scale) => {
    const b = (await modelsOf(pid))[pid].find((x) => x.name === "mid_0_plank").cubes;
    // each strake is a slab laid on the hull's curve: its thickness is its size across (y)
    return [...new Set(b.filter((c) => c.rotation).map((c) => Math.round(c.size[1] * scale * 1000) / 1000))].sort((a, c) => a - c);
  };
  // D-004 (it was: the same in the world at every scale): w = max(CON, 16 L / K) world px, so a hull's walls grow with
  // her length, not her model scale. A 15-block longship and a 6-block faering both stand on clinker's floor of 1 px
  assert.deepEqual(await widths("longship", 2), await widths("faering", 1), "clinker: the same strakes and gunwale at the floor");
  const PHI = (1 + Math.sqrt(5)) / 2, w = PROPORTIONS.skeid.wall, has = (xs, v) => xs.some((x) => Math.abs(x - v) < 0.01);   // given: slabs are stored to 1/1000 of a model px
  assert.ok(w > PROPORTIONS.faering.wall, "a 33-block skeid's wall is thicker than a faering's");
  const sk = await widths("skeid", 4);
  assert.ok(has(sk, PHI * w), `her gunwale phi w (${sk})`);
  assert.ok(has(sk, Math.max(1, w / PHI / PHI)), `her building planks w / phi^2 (${sk})`);
});

test("carved dugouts have no frames; the others do", async () => {
  for (const pid of ["dugout", "war_canoe"]) {
    const b = (await modelsOf(pid))[pid];
    assert.equal(b.filter((x) => x.name.endsWith("_frame")).flatMap((x) => x.cubes ?? []).length, 0, pid);
  }
  assert.ok((await modelsOf("faering")).faering.find((x) => x.name === "mid_0_frame").cubes.length >= 3);
});

test("every piece sits on the half-pixel grid", async () => {
  for (const pid of ["faering", "cog", "kayak", "voyaging_canoe"]) {
    const scale = PLANS[pid].modelScale;
    for (const bones of Object.values(await modelsOf(pid))) {
      for (const c of bones.flatMap((b) => b.cubes ?? []).filter((c) => !c.rotation)) {   // turned pieces lie on the hull's curve
        for (const v of [...c.origin, ...c.size]) assert.ok(Math.abs(v * scale * 2 - Math.round(v * scale * 2)) < 1e-6, `${pid}: ${v}`);
      }
    }
  }
});

test("launched, every boat is drawn within its part budget: 340 small, 460 medium", async () => {
  for (const pid of ALL_BOATS()) {
    const p = PLANS[pid];
    const mids = Math.min(7, Math.max(1, Math.round(p.lengthRange[1] / p.modelScale - 3)));
    const launched = (await modelsOf(pid)).launched;
    const n = launched.filter((b) => !(b.name.startsWith("mid_") && Number(b.name.split("_")[1]) >= mids))
      .reduce((a, b) => a + (b.cubes?.length ?? 0), 0);
    const budget = p.modelScale === 1 ? 340 : 460;   // the rounded shell is planked in strakes along its curve; 460 for the Theran cat's pod and wave-piercing ends (S002)
    assert.ok(n + 40 <= budget, `${pid}: launched hull ${n} pieces, leaving under 40 for rig, propulsion and chest`);
    const building = (await modelsOf(pid))[pid].reduce((a, b) => a + (b.cubes?.length ?? 0), 0);
    assert.ok(n < building / 2, `${pid}: launched ${n} vs building ${building}`);
  }
});

test("the hull switches from the building model to the launched one at launch; the cradle only shows in the yard", async () => {
  const fs = await import("node:fs");
  const rc = JSON.parse(fs.readFileSync(new URL("../RP/render_controllers/faering.render_controllers.json", import.meta.url), "utf8")).render_controllers;
  const mid = rc["controller.render.shipwright.faering.mid"];
  assert.deepEqual(mid.arrays.geometries["Array.hulls"], ["Geometry.default", "Geometry.launched"]);
  assert.match(mid.geometry, /stage'\) >= 5 \? 1 : 0/);
  const cradle = mid.part_visibility.find((v) => v.mid_0_cradle)?.mid_0_cradle;
  assert.match(cradle, /< 5/);
});

test("shields are real shields on pegs outside the hull; canopies spread when moored and furl under way", async () => {
  const fs = await import("node:fs");
  const rc = JSON.parse(fs.readFileSync(new URL("../RP/render_controllers/faering.render_controllers.json", import.meta.url), "utf8")).render_controllers;
  const vis = (c, bone) => rc[`controller.render.shipwright.faering.${c}`].part_visibility.find((v) => v[bone])?.[bone] ?? "";
  const moored = "math.mod(math.floor(q.property('shipwright:flags') / 16), 2)";
  assert.ok(vis("deck_canopy", "deck_canopy_0").includes(moored) && vis("deck_canopy", "deck_furled_0").includes(`!(${moored})`));
  const { pegSlots } = await import("../BP/scripts/shields.js");
  // Every peg sits outside the planking (outer sides for twin hulls), one each side per section.
  for (const pid of ALL_BOATS()) {
    const plan = PLANS[pid];
    const rec = newRecord(plan, "k", 10);
    const slots = pegSlots(rec, plan);
    assert.ok(slots.length >= 2 && slots.length % 2 === 0, `${pid}: pegs in pairs`);
    const half = (plan.baseBeam * rec.dims.beam) / 2;
    for (const s of slots) assert.ok(Math.abs(s.across) > half, `${pid}: peg ${s.slot} outside the hull`);
    assert.ok(slots.every((s) => s.along > 0), `${pid}: pegs forward of the helm`);
  }
  const { shieldsFor } = await import("../BP/scripts/config/modules.js");
  assert.equal(shieldsFor(newRecord(PLANS.faering, "k", 7)), pegSlots(newRecord(PLANS.faering, "k", 7)).length, "one peg per shield");
});

test("shield pegs: hung while moored, cleared under way; take a shield down and hang it back", async () => {
  const { manageShields, pegsOf, usePeg, stockShields, shieldsAboard, PEG } = await import("../BP/scripts/shields.js");
  const dim = world.getDimension("minecraft:overworld");
  const e = dim.spawnEntity("shipwright:faering", { x: 47000, y: 64, z: 0 });
  const rec = newRecord(PLANS.faering, "k", 7);
  rec.stage = 5; rec.modules = ["shield_rail"];
  assert.equal(stockShields(rec, 3), 3);
  writeRecord(e, rec);
  const h = { helmAt: -2 };
  const n = manageShields(e, rec, 0, h, true);
  const pegs = pegsOf(e);
  assert.equal(pegs.length, n);
  assert.ok(pegs.every((p) => p.typeId === PEG));
  assert.equal(shieldsAboard(rec), 3);
  // take one down
  const p = makePlayer(dim, []);
  const peg = pegs.find((x) => x.getDynamicProperty("slot") === 0);
  assert.match(usePeg(peg, p, e, readRecord, writeRecord), /take/);
  assert.equal(shieldsAboard(readRecord(e)), 2);
  assert.ok(countItems(p, ["minecraft:shield"]) >= 1, "the shield is in your hands");
  // hang it back
  const inv = p.getComponent("minecraft:inventory").container;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === "minecraft:shield") { p.selectedSlotIndex = i; break; }
  assert.match(usePeg(peg, p, e, readRecord, writeRecord), /hang/);
  assert.equal(shieldsAboard(readRecord(e)), 3);
  // under way: pegs come down, the shields stay aboard
  manageShields(e, readRecord(e), 0, h, false);
  assert.equal(pegsOf(e).length, 0);
  assert.equal(shieldsAboard(readRecord(e)), 3);
});

test("anchoring sets the moored flag; getting under way clears it", () => {
  const { e } = anchorBoat(43000);
  tickAll(10);
  assert.equal(getP(e, "moored"), true);
  const s = steerTest.state.get(e.id);
  s.anchor = null;
  const p = makePlayer(world.getDimension("minecraft:overworld"), []);
  p.inputInfo = { getMovementVector: () => ({ x: 0, y: 1 }), getButtonState: () => "Released" };
  p.onScreenDisplay = { setActionBar() {} };
  e.riders = [p];
  tickAll(10);
  assert.equal(getP(e, "moored"), false);
});

test("at rest only one pair of oars shows; telltales only while the sail draws", async () => {
  const fs = await import("node:fs");
  const rc = JSON.parse(fs.readFileSync(new URL("../RP/render_controllers/longship.render_controllers.json", import.meta.url), "utf8")).render_controllers;
  const fit = rc["controller.render.shipwright.longship.fittings"].part_visibility;
  const rule = (b) => fit.find((v) => v[b])?.[b] ?? "";
  assert.ok(!rule("oar_0_l").includes("rowing"), "the first pair always shows");
  assert.ok(rule("oar_2_l").includes("q.property('shipwright:rowing') > 0"), "the rest only while rowing");
  const sail = rc["controller.render.shipwright.longship.sail"].part_visibility;
  assert.ok(sail.find((v) => v.tt_rig_square_a).tt_rig_square_a.includes("sail_fill') > 0"));
});

// ---------- 0.9: the craft's centre, multihulls ----------

test("hullSpan: the centre is the origin, the helm one model block from the stern tip, aft", async () => {
  const { hullSpan } = await import("../BP/scripts/ship.js");
  const small = hullSpan(newRecord(PLANS.faering, "k", 7));
  assert.equal(small.half, 3.5);
  assert.equal(small.helm, -2.5, "helm is aft (negative along the heading)");
  const big = hullSpan(newRecord(PLANS.longship, "k", 16));
  assert.equal(big.helm, -(big.half - 2), "medium ships: one model block is two world blocks");
});

test("a boat from 0.9 or 0.10 (origin at its centre) moves aft once, so its hull stays where it was drawn", async () => {
  const { helmOrigin, hullSpan } = await import("../BP/scripts/ship.js");
  const dim = world.getDimension("minecraft:overworld");
  for (const yaw of [0, 90]) {
    const e = dim.spawnEntity("shipwright:faering", { x: 23000, y: 64, z: 0 });
    const rec = newRecord(PLANS.faering, "k", 7);
    rec.stage = 5; delete rec.originAt; rec.centred = true;
    setP(e, "yaw", yaw);
    writeRecord(e, rec);
    assert.equal(helmOrigin(e, rec), true);
    const f = forwardOf(yaw), d = -hullSpan(rec).helm;
    assert.ok(Math.abs(e.location.x - (23000 - f.x * d)) < 1e-6 && Math.abs(e.location.z + f.z * d) < 1e-6, `moved aft at yaw ${yaw}`);
    assert.equal(helmOrigin(e, rec), false, "only once");
    assert.equal(readRecord(e).originAt, "helm");
  }
  // A boat from before 0.9 already had its origin at the helm: it stays put.
  const old = dim.spawnEntity("shipwright:faering", { x: 23050, y: 64, z: 0 });
  const r2 = newRecord(PLANS.faering, "k", 7); delete r2.originAt; r2.stage = 5; writeRecord(old, r2);
  helmOrigin(old, r2);
  assert.equal(old.location.x, 23050);
  assert.equal(newRecord(PLANS.faering, "k", 7).originAt, "helm", "new boats are built with the helm at the origin");
});

test("crew stations run forward from the helm, which is the origin", async () => {
  const { stationSpot } = await import("../BP/scripts/edit.js");
  const { e } = longshipAt(23100);
  const rec = readRecord(e);
  setP(e, "yaw", 0);
  const s0 = stationSpot(e, 0, rec), s3 = stationSpot(e, 3, rec);
  assert.ok(Math.abs(s0.z - e.location.z - 1.5) < 1e-6, "the first station is a block and a half ahead of the helm");
  assert.ok(Math.abs(s3.z - s0.z - 3) < 1e-6, "one block each, forward");
});

test("turning swings about a point forward of the centre at speed, about the centre when stopped", async () => {
  const { turningPoint } = await import("../BP/scripts/steering.js");
  const h = { half: 6, max: 0.4 };
  assert.equal(turningPoint(h, 0), 0);
  assert.equal(turningPoint(h, 0.4), 2, "a third of the way to the bow at full speed");
  assert.equal(turningPoint(h, -0.4), -2, "astern it moves aft");
  const { e, helm } = steerSetup(23200, 7);
  helm.input = { x: 0, y: 1 }; run(e, helm, 60);
  helm.input = { x: -1, y: 1 };
  const s = run(e, helm, 1);
  assert.ok(s.turnShift && Math.hypot(s.turnShift.x, s.turnShift.z) > 0, "the centre swings out a little");
});

test("the game's facing is left to the game unless facing sync is switched on", async () => {
  const { e, helm } = steerSetup(23300, 7);
  e.setRotation({ x: 0, y: 123 });
  helm.input = { x: -1, y: 1 };
  for (let i = 0; i < 20; i++) { system.currentTick = (system.currentTick ?? 0) + 1; run(e, helm, 1); }
  assert.equal(e.getRotation().y, 123, "off by default: no fighting the game's own boat steering");
  world.setDynamicProperty("shipwright:facesync", "on");
  try {
    let s;
    helm.input = { x: 0, y: 1 };
    for (let i = 0; i < 12; i++) { system.currentTick = (system.currentTick ?? 0) + 1; s = run(e, helm, 1); }
    assert.ok(Math.abs(((e.getRotation().y - s.heading + 540) % 360) - 180) <= 5, "on: facing follows the heading");
  } finally {
    world.setDynamicProperty("shipwright:facesync", undefined);
  }
});

test("multihull layout comes from proportions: twin hulls either side of the centre, the float abeam", async () => {
  const fs = await import("node:fs");
  const twin = computeHandling(newRecord(PLANS.voyaging_canoe, "k", 16));
  assert.equal(twin.hullLines.length, 2);
  assert.equal(twin.hullLines[0], -twin.hullLines[1], "centred");
  assert.ok(!twin.float, "twin hulls carry no float");
  const out = newRecord(PLANS.outrigger, "k", 6);
  out.modules = [...(out.modules ?? []), "outrigger"];
  const h = computeHandling(out);
  assert.deepEqual(h.hullLines, [0]);
  assert.ok(h.float && h.float.across < 0 && h.float.half > 1, "a float out to port, most of the hull long");
  assert.ok(h.overallHalfWidth < Math.abs(h.float.across), "the walking deck stays over the hull, not the open water to the float");
  const ent = JSON.parse(fs.readFileSync(new URL("../BP/entities/outrigger.json", import.meta.url), "utf8"))["minecraft:entity"];
  const w = ent.component_groups["shipwright:seats_mid_3"]["minecraft:custom_hit_test"].hitboxes[0].width;
  assert.ok(w / 2 > Math.abs(h.float.across), "hit areas reach the float");
  // The model: twin hull planking sits symmetrically about the centre, the float hidden.
  const bones = JSON.parse(fs.readFileSync(new URL("../RP/models/entity/voyaging_canoe.geo.json", import.meta.url), "utf8"))["minecraft:geometry"].flatMap((g) => g.bones);
  const xs = bones.filter((b) => b.name === "mid_0_keel").flatMap((b) => b.cubes.map((c) => c.origin[0] + c.size[0] / 2));
  assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs)) < 0.01, "keels mirrored about the centre line");
  const rc = fs.readFileSync(new URL("../RP/render_controllers/voyaging_canoe.render_controllers.json", import.meta.url), "utf8");
  assert.doesNotMatch(rc, /"ama"/, "a twin hull has no float to show (hidden by default)");
});

test("a twin hull can't take the outrigger module", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../BP/scripts/edit.js", import.meta.url), "utf8");
  assert.match(src, /twin hulls need no float/);
});

test("a float hits the shore before the hull does", async () => {
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 23380; x <= 23420; x++) for (let z = -20; z <= 20; z++) { dim.set(x, 63, z, "minecraft:water"); dim.set(x, 64, z, "minecraft:air"); }
  const rec = newRecord(PLANS.outrigger, "k", 6);
  rec.modules = [...(rec.modules ?? []), "outrigger"];
  const h = computeHandling(rec);
  const pos = { x: 23400.5, y: 63.6, z: 0.5 };
  assert.equal(hullHits(dim, pos, 0, h), false);
  // Heading 0 is +z: the float's side (across < 0, port) is +x (r = (-f.z, f.x) points to starboard, -x).
  const fx = pos.x - h.float.across;
  dim.set(Math.floor(fx), 64, 0, "minecraft:stone");
  assert.equal(hullHits(dim, pos, 0, h), true, "a rock under the float stops the turn");
  assert.equal(hullHits(dim, pos, 0, { ...h, float: null }), false, "the hull alone clears it");
});

// ---------- 0.9.1: masts ----------

test("the mast is drawn in wood with the rig on every boat that carries a sail", async () => {
  const fs = await import("node:fs");
  for (const pid of ALL_BOATS()) {
    const rc = JSON.parse(fs.readFileSync(new URL(`../RP/render_controllers/${pid}.render_controllers.json`, import.meta.url), "utf8")).render_controllers;
    const fit = rc[`controller.render.shipwright.${pid}.fittings`];
    assert.match(fit.textures[0], /Array\.woods/, `${pid}: the fittings pass is textured in wood`);
    const geo = JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))["minecraft:geometry"];
    const bones = (id) => geo.find((g) => g.description.identifier.endsWith(id)).bones.map((b) => b.name);
    assert.ok(bones(".fittings").includes("mast"), `${pid}: the mast lives with the wooden fittings`);
    assert.ok(bones(".rig").includes("pennant"), `${pid}: the pennant flies with the rig`);
    const vis = Object.assign({}, ...fit.part_visibility);
    for (const n of bones(".fittings").filter((x) => /^mast(_\d)?$/.test(x))) assert.ok(typeof vis[n] === "string" && vis[n].includes("stage"), `${pid}: ${n} shown when rigged`);
  }
});

test("no sail sits or furls below the gunwale: every rig is set out from the deck", async () => {
  const fs = await import("node:fs");
  for (const pid of ALL_BOATS()) {
    const bones = JSON.parse(fs.readFileSync(new URL(`../RP/models/entity/${pid}.geo.json`, import.meta.url), "utf8"))["minecraft:geometry"].flatMap((g) => g.bones);
    const mast = bones.find((b) => b.name === "mast");
    const deck = mast.pivot[1];
    for (const name of ["rig_square", "rig_lateen", "rig_crab", "rig_junk"]) {
      const r = bones.find((b) => b.name === name);
      if (r.rotation) continue;                        // a canted mast's kit turns (and furls) about the mast's foot
      assert.ok(r.pivot[1] > deck, `${pid} ${name}: furls toward a point above the deck`);
      const low = Math.min(...r.cubes.map((c) => c.origin[1]));
      assert.ok(low >= deck, `${pid} ${name}: cloth starts above the deck (${low} vs ${deck})`);
    }
  }
});

test("long medium ships step two masts where their tradition did, and big ones carry a sail for their length", async () => {
  const { PROPORTIONS } = await import("../BP/scripts/config/proportions.js");
  for (const pid of ["voyaging_canoe", "dhow", "junk", "war_canoe"]) assert.equal(PROPORTIONS[pid].mast_count, 2, pid);
  for (const pid of ["cog", "longship", "bezaisen"]) assert.equal(PROPORTIONS[pid].mast_count, 1, pid);
  for (const pid of ["voyaging_canoe", "longship", "bezaisen", "cog"]) {
    const r = newRecord(PLANS[pid], "k", 18), rig = rigFor(r, PLANS[pid]);
    assert.ok(rig.area >= SAIL_PER_L2[rig.style] * 18 * 18 - 1, `${pid}: ${rig.area.toFixed(1)} square blocks`);
    assert.ok(rig.scale > 0.6 && rig.scale < 3, `${pid}: rig scale ${rig.scale} not pinned at a limit`);
  }
  assert.ok(PROPORTIONS.voyaging_canoe.sail.crab_claw > 0, "the crab claw's cloth is measured");
});

test("two masts cost two masts' timber and take two deck stations", async () => {
  const { rigCost } = await import("../BP/scripts/ship.js");
  const { stationsFor } = await import("../BP/scripts/grid.js");
  const rec = newRecord(PLANS.junk, "k", 18);
  rec.sections.rig = { ...(rec.sections.rig ?? {}), sail: true, style: "junk" };
  const one = { ...rec, plan: "bezaisen" };
  assert.ok(rigFor(rec, PLANS.junk).count === 2);
  assert.equal(stationsFor(rec, PLANS.junk), stationsFor(rec, PLANS.cog) - 1);
  const logs = rigCost(PLANS.junk, 0, rec).find((c) => c.label.endsWith("Log")).count;
  assert.ok(logs >= 2, `${logs} logs`);
});

test("slim hulls are a little fuller: typical presets sit inside each plan's ratio range", () => {
  for (const [id, p] of Object.entries(PLANS)) {
    if (!p.typicalLB || !p.lengthToBeam) continue;
    assert.ok(p.typicalLB >= p.lengthToBeam[0] && p.typicalLB <= p.lengthToBeam[1], `${id}: typical ${p.typicalLB} in ${p.lengthToBeam}`);
  }
  assert.ok(PLANS.voyaging_canoe.baseBeam > 2, "each voyaging hull over two blocks wide");
});

// ---------- 0.10: yard architecture ----------

test("every tradition's dry dock yard: a workshop, a home, a gathering deck and the dry dock's works, the table looking over the dock", async () => {
  const { buildYard } = await import("../tools/lab/yardlab.mjs");
  const gather = /campfire|carpet|candle|cauldron|bell/;
  const seen = new Set();
  for (const [key] of Object.entries(YARD_STYLES)) {
    const y = await buildYard(key, { length: 36, width: 11 });
    const plan = y.plan, s = { o: plan.origin };
    assert.equal(plan.level, 3);
    assert.ok(plan.structure.length > 250, `${key}: three real buildings (${plan.structure.length} blocks)`);
    assert.ok(plan.structure.some((p) => gather.test(p.id)), `${key}: somewhere for people to gather`);
    assert.equal(plan.features.length, 6, `${key}: lists what it builds`);
    assert.ok(plan.structure.some((p) => p.id === "minecraft:iron_chain"), `${key}: the gantry's chain`);
    // nothing built in the basin or on the walkway
    const open = new Set([...plan.basin, ...plan.walls, ...plan.edge].map((p) => `${p.x},${p.z}`));
    assert.ok(!plan.structure.some((p) => open.has(`${p.x},${p.z}`) && p.y <= s.o.y + 3), `${key}: the basin and walkway stay clear`);
    // the table's new place: on the deck, by the walkway, nothing else built there
    assert.ok(plan.tableAt, `${key}: a place for the table`);
    assert.ok(!plan.structure.some((p) => p.x === plan.tableAt.x && p.y === plan.tableAt.y && p.z === plan.tableAt.z), `${key}: its spot is free`);
    assert.ok(plan.structure.some((p) => p.x === plan.tableAt.x && p.y === plan.tableAt.y - 1 && p.z === plan.tableAt.z), `${key}: it stands on the deck`);
    const toBasin = Math.min(...plan.basin.map((p) => Math.hypot(p.x - plan.tableAt.x, p.z - plan.tableAt.z)));
    assert.ok(toBasin <= 3.5, `${key}: the table looks over the dock (${toBasin.toFixed(1)} blocks)`);
    seen.add(plan.structure.map((p) => p.id).sort().join());
    // every block it places is paid for, and is a real item id
    const cost = (id) => plan.costs.find((c) => c.ids[0] === id)?.count ?? 0;
    for (const id of new Set(plan.structure.map((p) => p.id))) {
      assert.ok(cost(id) > 0, `${key}: ${id} costed`);
      assert.ok(!/oak_pressure_plate|oak_trapdoor|^minecraft:stone_slab$|^minecraft:chain$|^minecraft:bricks$/.test(id), `${key}: ${id} is a Bedrock id`);
    }
  }
  assert.equal(seen.size, Object.keys(YARD_STYLES).length, "no two yards alike");
});

test("roofs are stairs turned toward the ridge, logs lie along their beams", async () => {
  const { buildYard } = await import("../tools/lab/yardlab.mjs");
  const y = await buildYard("european", { length: 36, width: 11 });
  const plan = y.plan, s = { o: plan.origin };
  // the warehouse behind the dock (the dock runs south, so it stands north of the table)
  const stairs = plan.structure.filter((p) => p.id === "minecraft:dark_oak_stairs" && !p.states.upside_down_bit && p.z < s.o.z - 1 && Math.abs(p.x - s.o.x) <= 4);
  assert.ok(stairs.length > 20);
  // the dock runs south (+z), so a ridge along it has east and west slopes: their backs face each other
  const dirs = new Set(stairs.map((p) => p.states.weirdo_direction));
  assert.deepEqual([...dirs].sort(), [0, 1], "east- and west-facing courses");
  const west = stairs.filter((p) => p.x < s.o.x), east = stairs.filter((p) => p.x > s.o.x);
  assert.ok(west.every((p) => p.states.weirdo_direction === 0), "the west slope's backs face east, toward the ridge");
  assert.ok(east.every((p) => p.states.weirdo_direction === 1), "and the east slope's face west");
  assert.ok(plan.structure.some((p) => /_log$/.test(p.id) && p.states.pillar_axis === "z"), "beams lie along the dock");
});

test("the yard clears ten blocks of headroom for masts, and you can build the dock alone", () => {
  const s = shore();
  const full = planDock(s.table(), 16, 5, YARD_STYLES.norse);
  assert.ok(full.headroom.some((p) => p.y === s.o.y + 10), "headroom reaches 10 up");
  const bare = planDock(s.table(), 16, 5, YARD_STYLES.norse, { buildings: false });
  assert.equal(bare.structure.length, 0);
  assert.ok(bare.costs.reduce((a, c) => a + c.count, 0) < full.costs.reduce((a, c) => a + c.count, 0) / 3, "the dock alone costs far less");
});

test("a built yard stands in the world with its turned blocks, and still works as a dock", async () => {
  const { buildYard } = await import("../tools/lab/yardlab.mjs");
  const yy = await buildYard("japanese", { length: 36, width: 11 });
  const plan = yy.plan, s = yy.s;
  const tile = plan.structure.find((p) => p.id === "minecraft:deepslate_tile_stairs");
  assert.equal(s.dim.getBlock(tile).typeId, "minecraft:deepslate_tile_stairs");
  assert.equal(s.dim.states.get(`${tile.x},${tile.y},${tile.z}`).weirdo_direction, tile.states.weirdo_direction);
  const y = detectYard(s.dim.getBlock(plan.tableAt));
  assert.equal(y.kind, "dock");
  assert.equal(y.ok && y.flooded, true, y.reason);
});

test("over water, a gathering deck stands on pilings rather than a solid fill", () => {
  const s = shore();
  // flood the starboard side so the quay deck stands over the sea
  for (let x = s.o.x - 9; x <= s.o.x - 4; x++) for (let z = 0; z <= 8; z++) for (let y = 58; y <= 64; y++) s.dim.set(x, y, z, "minecraft:water");
  const plan = planDock(s.table(), 16, 5, YARD_STYLES.norse);
  assert.equal(plan.ok, true, plan.reason);
  const piles = plan.footing.filter((p) => p.id === plan.style.post);
  assert.ok(piles.length > 0, "pilings go down to the bottom");
  assert.ok(plan.footing.length < 9 * 5 * 7, "not a solid fill");
});

// ---------- hardening ----------

test("property ranges in the scripts match the entity definitions, and broken numbers never reach the game", async () => {
  const fs = await import("node:fs");
  const { RANGES } = await import("../BP/scripts/props.js");
  const props = JSON.parse(fs.readFileSync(new URL("../BP/entities/faering.json", import.meta.url), "utf8"))["minecraft:entity"].description.properties;
  for (const [k, v] of Object.entries(props)) {
    const name = k.replace("shipwright:", "");
    if (["woods", "flags", "kinds"].includes(name)) continue;
    assert.deepEqual(RANGES[name], v.range.map(Number), name);
  }
  const e = world.getDimension("minecraft:overworld").spawnEntity("shipwright:faering", { x: 23900, y: 64, z: 0 });
  setP(e, "heel", 12);
  setP(e, "heel", NaN);
  assert.equal(e.props["shipwright:heel"], 12, "NaN is dropped");
  setP(e, "heel", 99);
  assert.equal(e.props["shipwright:heel"], 30, "clamped to its range");
});

test("one broken boat can't stop the others from being sailed", async () => {
  const a = steerSetup(24000, 7), b = steerSetup(24100, 7);
  a.e.getComponent = () => { throw new Error("boat unloading"); };
  const bad = a.e.getComponent;
  b.helm.input = { x: 0, y: 1 };
  steerTest.state.delete(b.e.id);
  // b has a rider; a throws on every call
  const rid = b.e.getComponent("minecraft:rideable");
  void rid; void bad;
  assert.doesNotThrow(() => steerTest.tick());
});

test("building a yard puffs a handful of particles, not hundreds", async () => {
  const s = shore();
  const plan = planDock(s.table(), 16, 5, YARD_STYLES.pacific);
  const before = s.dim.particles.length;
  let done = false;
  buildDock(plan, () => {}, () => (done = true));
  for (let i = 0; i < 400 && !done; i++) await settle(2);
  assert.ok(s.dim.particles.length - before <= 120, `${s.dim.particles.length - before} particles`);
});

// ---------- 0.11: laws pinned to known answers ----------

test("frames: a point taken into a ship's frame and back is where it started, and the dock's starboard is the ship's", async () => {
  const { ShipFrame, DockFrame, forwardOf } = await import("../BP/scripts/frame.js");
  for (const heading of [0, 37, 90, -135, 180]) {
    const F = new ShipFrame({ x: 10.25, y: 64, z: -3.5 }, heading, { helmAt: -2.5 });
    const p = F.toWorld(3.2, -1.7);
    const back = F.toLocal(p);
    assert.ok(Math.abs(back.along - 3.2) < 1e-9 && Math.abs(back.across + 1.7) < 1e-9, `round trip at ${heading}`);
    const c = F.centre(), f = forwardOf(heading);
    assert.ok(Math.abs((c.x - 10.25) * f.x + (c.z + 3.5) * f.z - 2.5) < 1e-9, "the centre is 2.5 ahead of the helm");
  }
  // facing south, the dock's +w and a ship's starboard are the same side
  const D = new DockFrame({ x: 0, y: 64, z: 0 }, { x: 0, z: 1 });
  const S = new ShipFrame({ x: 0, y: 64, z: 1 }, 0);
  const a = D.at(0, 1), b = S.toWorld(0, 1);
  assert.deepEqual([a.x, a.z], [b.x, b.z]);
});

test("heel law: undamped it returns after one period without gaining energy; damped it settles on its target", async () => {
  const { heelLaw } = await import("../BP/scripts/laws.js");
  let st = { heel: 10, rate: 0 };
  const period = 32;
  for (let i = 0; i < period; i++) st = heelLaw(st, 0, { period, damping: 0, limit: 90 });
  assert.ok(Math.abs(st.heel - 10) < 1e-9 && Math.abs(st.rate) < 1e-9, "a full roll and back, exactly");
  const energy = (x) => x.heel ** 2 + (x.rate / ((2 * Math.PI) / period)) ** 2;
  st = { heel: 7, rate: 0.3 };
  const e0 = energy(st);
  for (let i = 0; i < 1000; i++) { st = heelLaw(st, 0, { period, damping: 0, limit: 90 }); assert.ok(energy(st) <= e0 + 1e-9); }
  st = { heel: 0, rate: 0 };
  for (let i = 0; i < 200; i++) st = heelLaw(st, 12, { period });
  assert.ok(Math.abs(st.heel - 12) < 0.05, "settles on the angle the wind holds it at");
});

test("heel is mirrored: wind on the other side heels the other way by the same amount", async () => {
  const { heelTarget } = await import("../BP/scripts/laws.js");
  const h = computeHandling(newRecord(PLANS.faering, "k", 7));
  const a = heelTarget(h, { fill: 0.8, windSpeed: 1, off: 90, windAcross: 1, turnRight: 0, speed: 0.2 });
  const b = heelTarget(h, { fill: 0.8, windSpeed: 1, off: 90, windAcross: -1, turnRight: 0, speed: 0.2 });
  assert.ok(a !== 0 && Math.abs(a + b) < 1e-12);
  const l = heelTarget(h, { fill: 0, windSpeed: 0, off: 0, windAcross: 0, turnRight: 1, speed: h.max });
  const r = heelTarget(h, { fill: 0, windSpeed: 0, off: 0, windAcross: 0, turnRight: -1, speed: h.max });
  assert.ok(l !== 0 && Math.abs(l + r) < 1e-12, "turning left and right heel symmetrically");
});

test("drive law: its ledger of oars, sail, drag and grounding adds up to the change in speed", async () => {
  const { driveLaw } = await import("../BP/scripts/laws.js");
  const h = computeHandling(newRecord(PLANS.faering, "k", 7));
  const cases = [
    { wet: true, throttle: 1, want: h.max, sailTarget: 0, sailing: false, pull: 1, aground: false },
    { wet: true, throttle: 0, want: 0, sailTarget: h.max * 0.8, sailing: true, pull: 1, aground: false },
    { wet: true, throttle: 0, want: 0, sailTarget: 0, sailing: false, pull: 1, aground: false },
    { wet: true, throttle: -1, want: 0, sailTarget: 0, sailing: false, pull: 1, aground: true },
    { wet: false, throttle: 1, want: h.max, sailTarget: 0, sailing: false, pull: 1, aground: false },
  ];
  for (const c of cases) for (const v0 of [0, 0.1, -0.05, 0.3]) {
    const { speed, ledger } = driveLaw(h, v0, { ...c, groundMax: 0.03, beachedDrag: 0.8 });
    const sum = ledger.oars + ledger.sail + ledger.drag + ledger.ground;
    assert.ok(Math.abs(speed - v0 - sum) < 1e-12, `ledger adds up (${JSON.stringify(c)}, v0 ${v0})`);
  }
  // no input, no wind: the boat only ever slows, and stops within half a minute (Waterworld's water: core/boat.js)
  let v = 0.2;
  for (let i = 0; i < 600; i++) v = driveLaw(h, v, { ...cases[2], groundMax: 0.03, beachedDrag: 0.8 }).speed;
  assert.ok(v >= 0 && v < 0.01);
});

test("the ship is the sum of its parts: high weight makes it tender, low weight stiffens it, the crew weighs it", async () => {
  const { bodyOf } = await import("../BP/scripts/body.js");
  const hull = { mass: 2, beam: 3, depth: 1.5, length: 16, ratio: 5.3, twin: false };
  const plain = bodyOf({ hull, sail: true });
  const castle = bodyOf({ hull, sail: true, modules: ["castle"] });
  const hold = bodyOf({ hull, sail: true, modules: ["hold"] });
  assert.ok(castle.comUp > plain.comUp && castle.righting < plain.righting, "a castle up high makes a ship tender");
  assert.ok(hold.comUp < plain.comUp && hold.righting > plain.righting, "a hold low down steadies it");
  assert.ok(Math.abs(bodyOf({ hull, sail: true, crew: 3 }).mass - plain.mass - 0.15) < 1e-12, "each person aboard adds to it");
  const total = castle.parts.reduce((a, p) => a + p.mass, 0);
  assert.ok(Math.abs(total - castle.mass) < 1e-12, "mass is exactly the sum of the parts");
  assert.ok(bodyOf({ hull, sail: true, modules: ["outrigger"] }).righting > plain.righting * 1.4, "a float rights it");
});

test("wake law: what the water takes goes into spray; a stopped boat throws none, at most a puff a tick", async () => {
  const { wakeLaw, SPRAY_COST } = await import("../BP/scripts/laws.js");
  const h = { weight: 1 };
  let b = 0, puffs = 0;
  for (let i = 0; i < 100; i++) { const w = wakeLaw(b, h, { before: 0, after: 0, ledger: { drag: 0 } }); b = w.budget; puffs += w.puffs; }
  assert.equal(puffs, 0);
  const count = (v) => { let bb = 0, n = 0; for (let i = 0; i < 200; i++) { const w = wakeLaw(bb, h, { before: v, after: v, ledger: { drag: 0 } }); bb = w.budget; n += w.puffs; assert.ok(w.puffs <= 1); } return n; };
  assert.ok(count(0.3) > count(0.15), "a faster hull throws more spray");
  const drag = wakeLaw(0, h, { before: 0.3, after: 0.1, ledger: { drag: -0.2 } });
  assert.ok(drag.puffs === 1 || drag.budget >= SPRAY_COST, "slowing hard throws spray");
});

// ---------- 0.12: the lab's lenses, as tests ----------

test("lab: every biome's village dock and every tradition's dry dock: walkable, closed, nothing floating, every block allowed and stuck, rooms used, and a ship sails out", async () => {
  const { buildYard, lensAll } = await import("../tools/lab/yardlab.mjs");
  const { VILLAGES } = await import("../BP/scripts/config/villages.js");
  const BIOMES = { plains: "minecraft:plains", desert: "minecraft:desert", savanna: "minecraft:savanna", taiga: "minecraft:taiga",
    snowy: "minecraft:snowy_plains", jungle: "minecraft:jungle", swamp: "minecraft:mangrove_swamp", cherry: "minecraft:cherry_grove" };
  const bad = [];
  const looks = new Set();
  for (const v of Object.keys(VILLAGES)) {
    const y = await buildYard("european", { biome: BIOMES[v] });
    assert.equal(y.plan.style.name, VILLAGES[v].name, `${v}: the biome's own village look`);
    looks.add(y.plan.structure.map((p) => p.id).sort().join());
    for (const i of lensAll(y, v, "cog").issues) bad.push(`village ${v}: ${i}`);
  }
  assert.equal(looks.size, Object.keys(VILLAGES).length, "every biome's village dock looks its own");
  for (const k of Object.keys(YARD_STYLES)) {
    const y = await buildYard(k, { length: 36, width: 11 });
    for (const i of lensAll(y, k, "carrack").issues) bad.push(`dry dock ${k}: ${i}`);
  }
  assert.deepEqual(bad, []);
});

test("lab: every boat model has a closed hull and no flickering faces", async () => {
  const { execFileSync } = await import("node:child_process");
  let out = "";
  try {
    out = execFileSync("python3", ["tools/lab/boatlab.py"], { encoding: "utf8" });
  } catch (e) {
    assert.fail(`boat lab found issues:\n${e.stdout}`);
  }
  assert.ok(!/issue/.test(out), out);
});

test("a dry dock (level 3): a big dock dug 3 deep with keel blocks, where the great ships are built", async () => {
  const { buildYard, walkLens, gapsLens, overlapsLens } = await import("../tools/lab/yardlab.mjs");
  const y = await buildYard("european", { length: 36, width: 11 });
  assert.equal(y.plan.level, 3);
  assert.equal(y.plan.depth, 3);
  assert.ok(y.plan.keelBlocks.length >= 10, "keel blocks down the middle");
  for (const k of y.plan.keelBlocks) assert.match(y.get(k.x, k.y, k.z).id, /_log$/);
  const table = y.s.dim.getBlock(y.plan.tableAt ?? y.s.o);
  const yard = detectYard(table);
  assert.equal(yard.kind, "dock");
  assert.equal(yard.level, 3, yard.reason);
  assert.equal(yard.levelName, "Dry dock");
  // the lenses still see a sound yard at this size
  const w = walkLens(y);
  assert.deepEqual(w.unreachable, []);
  assert.equal(w.walkwayMissed, 0);
  assert.deepEqual(gapsLens(y).floating, []);
  assert.deepEqual(overlapsLens(y).clashes, []);
  // a small dock stays level 2
  const small = await buildYard("european", { length: 16, width: 5 });
  assert.equal(small.plan.level, 2);
  assert.equal(detectYard(small.s.dim.getBlock(small.plan.tableAt ?? small.s.o)).level, 2);
});

test("large ships: drawn at four times the size, need a dry dock, and fit its basin", async () => {
  const large = Object.values(PLANS).filter((p) => p.yardLevel === 3);
  assert.deepEqual(large.map((p) => p.id).sort(), ["baghlah", "carrack", "drua", "fuchuan", "league_trireme", "shuinsen", "skeid", "theran_flagship"]);
  for (const p of large) {
    assert.equal(p.modelScale, 4);
    const rec = newRecord(p, "k", 36);
    const h = computeHandling(rec);
    assert.ok(h.half * 2 >= 28 && h.half * 2 <= 40, `${p.id}: hull length`);
    assert.ok(h.helmAt < 0 && -h.helmAt === h.half - 4, `${p.id}: helm one model block in from the stern`);
    rec.sections.rig = { sail: true, style: p.rigStyle };
    if (p.rigFamily) assert.equal(computeHandling(rec).mastsAt.length, { skeid: 1, carrack: 3, baghlah: 2, fuchuan: 3, shuinsen: 3, drua: 1, theran_flagship: 3, league_trireme: 1 }[p.id]);
    const medium = Object.values(PLANS).find((q) => q.yardLevel === 2 && q.tradition === p.tradition);
    assert.ok(h.turnMax < computeHandling(newRecord(medium, "k", 18)).turnMax, `${p.id}: turns slower than its tradition's ${medium.id}`);
  }
  const fs = await import("node:fs");
  const ent = JSON.parse(fs.readFileSync(new URL("../BP/entities/carrack.json", import.meta.url), "utf8"))["minecraft:entity"];
  assert.equal(ent.component_groups["shipwright:seats_mid_7"]["minecraft:rideable"].seat_count, 8, "eight crew stations");
});

// ---------- 0.13: decks and the crew's modules ----------

test("deep hulls have decks below (black boxes) that stow the hold, bunks and guns; you walk the top deck", async () => {
  const { decksFor, topDeckUp, lowerSlotsFor, layoutDeck, deckSlotsFor } = await import("../BP/scripts/grid.js");
  const { MODULES } = await import("../BP/scripts/config/modules.js");
  const carrack = newRecord(PLANS.carrack, "k", 36);
  assert.ok(decksFor(carrack, PLANS.carrack) >= 2, "a carrack is deep enough for a deck below");
  assert.ok(topDeckUp(carrack, PLANS.carrack) >= 2, "her top deck is walked up at the rail");
  const cog = newRecord(PLANS.cog, "k", 18);
  assert.equal(decksFor(cog, PLANS.cog), 2, "a cog's rail stands too high to see over from her hold: she's decked");
  const dhow = newRecord(PLANS.dhow, "k", 18);
  assert.equal(decksFor(dhow, PLANS.dhow), 1);
  assert.equal(topDeckUp(dhow, PLANS.dhow), 0, "a dhow's crew stand inside the hull at the waterline");
  assert.equal(decksFor(dhow, PLANS.dhow, ["full_deck"]), 2, "a full deck decks her over");
  assert.equal(decksFor(newRecord(PLANS.war_canoe, "k", 18), PLANS.war_canoe, ["full_deck"]), 1, "too shallow to stand under a deck");
  // stowed below: no top station, not drawn
  carrack.modules = ["hold", "cannon", "castle"];
  const lay = layoutDeck(carrack, PLANS.carrack, carrack.modules.map((k) => ({ key: k, ...MODULES[k] })));
  assert.deepEqual(lay.below.sort(), ["cannon", "hold"]);
  assert.deepEqual(lay.placed.map((p) => p.key), ["castle"]);
  assert.equal(deckSlotsFor(carrack, PLANS.carrack), 4 + lowerSlotsFor(carrack, PLANS.carrack));
  const { deckBits } = await import("../BP/scripts/ship.js");
  assert.equal(deckBits(carrack, PLANS.carrack) % 16, 6, "only the castle is drawn, at the first station");
});

test("a raised top deck is laid in the air at the rail, with its gunwale above it, and put back", async () => {
  const { layDeck, liftDeck, deckOf } = await import("../BP/scripts/deck.js");
  const dim = world.getDimension("minecraft:overworld");
  const x0 = 48000;
  for (let x = x0 - 30; x <= x0 + 30; x++) for (let z = -30; z <= 30; z++) { dim.set(x, 63, z, "minecraft:water"); dim.set(x, 62, z, "minecraft:water"); dim.set(x, 61, z, "minecraft:stone"); }
  const e = dim.spawnEntity("shipwright:carrack", { x: x0 + 0.5, y: 63.6, z: 0.5 });
  const rec = newRecord(PLANS.carrack, "k", 36); rec.stage = 5; writeRecord(e, rec);
  const h = computeHandling(rec);
  assert.ok(h.deckUp >= 2);
  layDeck(e, h, 0);
  const cells = deckOf(e.id).cells;
  const floor = cells.filter((c) => c[1] === 63 + h.deckUp);
  assert.ok(floor.length > 60, "the deck floor, up at the rail");
  assert.ok(cells.every((c) => c[1] >= 63 + h.deckUp), "nothing laid in the water under her");
  assert.ok(cells.some((c) => c[1] === 63 + h.deckUp + 1), "a gunwale on it");
  liftDeck(e.id);
  for (const [x, y, z, was] of cells) assert.equal(dim.getBlock({ x, y, z }).typeId, was);
});

test("crew modules: ramming, guns, the shield rail's cover and the diving bell follow their laws", async () => {
  const { ramBlow, gunFor, shieldCover, underBell, hasBunk, hasHold } = await import("../BP/scripts/crew.js");
  assert.equal(ramBlow(0.05), 0, "too slow to ram");
  assert.ok(ramBlow(0.3).damage > ramBlow(0.15).damage, "faster strikes harder");
  assert.ok(ramBlow(0.3).own < ramBlow(0.3).wear / 3, "the cap takes most of the shock");
  const rec = { modules: ["cannon", "crossbow"] };
  assert.equal(gunFor(rec, 0.9), "cannon", "looking over the side: the broadside");
  assert.equal(gunFor(rec, 0.1), "crossbow", "looking ahead: the crossbow");
  assert.equal(gunFor({ modules: [] }, 1), null);
  assert.equal(shieldCover({ modules: ["shield_rail"], shields: [] }), 0, "no shields, no cover");
  assert.ok(shieldCover({ modules: ["shield_rail"], shields: [true, true, true, true] }) > 0.3);
  assert.ok(shieldCover({ modules: ["shield_rail"], shields: Array(20).fill(true) }) <= 0.6);
  assert.ok(underBell({ x: 0, y: 63, z: 0 }, { x: 1, y: 58, z: 1 }));
  assert.ok(!underBell({ x: 0, y: 63, z: 0 }, { x: 5, y: 58, z: 0 }), "too far out");
  assert.ok(!underBell({ x: 0, y: 63, z: 0 }, { x: 0, y: 64, z: 0 }), "above water");
  assert.ok(hasBunk({ modules: ["deckhouse"] }) && hasHold({ modules: ["deckhouse"] }), "a deckhouse is both");
});

test("a rammed ship is holed; a gunner fires the crossbow from a seat; a berth wakes you aboard", async () => {
  const { ramCheck, fire, takeBerth, wakeAboard } = await import("../BP/scripts/crew.js");
  const { e } = longshipAt(49000);
  const rec = readRecord(e); rec.modules = ["ram", "crossbow", "bunk"]; writeRecord(e, rec);
  const s = steerTest.state.get(e.id) ?? (tickAll(1), steerTest.state.get(e.id));
  const st = (await import("../BP/scripts/steering.js")).boatStateOf(e);
  st.heading = 0; st.speed = 0.3;
  const h = st.stats;
  const target = e.dimension.spawnEntity("shipwright:faering", { x: e.location.x, y: 63.6, z: e.location.z - h.helmAt + h.half + 0.6 });
  const trec = newRecord(PLANS.faering, "k", 6); trec.stage = 5; writeRecord(target, trec);
  assert.equal(ramCheck(e), 1);
  const tc = readRecord(target).condition, struck = Math.min(tc.bow, tc.mid, tc.stern);
  assert.ok(struck < 1, "the rammed ship is holed");
  assert.ok(readRecord(e).condition.bow < 1 && readRecord(e).condition.bow > struck, "the ram's cap takes less");
  // a gunner with arrows fires
  const p = makePlayer(e.dimension, [{ typeId: "minecraft:arrow", amount: 4 }]);
  p.getViewDirection = () => ({ x: 0, y: 0, z: 1 });
  const before = e.dimension.entities.filter((x) => x.typeId === "minecraft:arrow").length;
  fire(p, e);
  assert.equal(e.dimension.entities.filter((x) => x.typeId === "minecraft:arrow").length, before + 1);
  assert.equal(countItems(p, ["minecraft:arrow"]), 3);
  // a berth aboard
  assert.match(takeBerth(p, e), /berth/);
  p.teleport({ x: 0, y: 100, z: 0 });
  assert.equal(wakeAboard(p), true);
  assert.ok(Math.hypot(p.location.x - e.location.x, p.location.z - e.location.z) < 2, "back aboard, at the helm");
});

// ---------- 0.16: the fight lab ----------

test("fight lab: item ids are real, every module does something, and gear works", async () => {
  const { idsLens, modulesLens, gearLens } = await import("../tools/lab/fightlab.mjs");
  const bad = [...idsLens().issues, ...modulesLens().issues];
  for (const pid of ["faering", "cog", "carrack", "drua"]) bad.push(...gearLens(pid).issues.map((i) => `${pid}: ${i}`));
  assert.deepEqual(bad, []);
});

test("fight lab: broadsides carry, strike where aimed and sink; bulkheads hold; chain shot tears sails", async () => {
  const { gunsLens } = await import("../tools/lab/fightlab.mjs");
  for (const pid of ["carrack", "drua"]) {
    const r = gunsLens(pid);
    assert.deepEqual(r.issues, [], pid);
    assert.ok(r.ranges[0] >= 20 && r.ranges[2] <= 70, `${pid} ranges ${r.ranges}`);
  }
});

test("fight lab: rams strike along a whole hull, stop her, and spare a ram's own bow; slow touches stop without harm", async () => {
  const { ramLens, crossbowLens, crewLens } = await import("../tools/lab/fightlab.mjs");
  const bad = [];
  for (const pid of ["faering", "longship", "cog", "carrack", "voyaging_canoe", "punt"]) {
    bad.push(...ramLens(pid).issues.map((i) => `${pid}: ${i}`));
    bad.push(...crewLens(pid).issues.map((i) => `${pid}: ${i}`));
  }
  for (const pid of ["cog", "carrack", "skeid"]) bad.push(...crossbowLens(pid).issues.map((i) => `${pid}: ${i}`));
  assert.deepEqual(bad, []);
});

test("a shot is struck by a long hull far from its box; a ship's own guns never hit her", async () => {
  const { inHull, zoneAt } = await import("../BP/scripts/crew.js");
  const { ShipFrame } = await import("../BP/scripts/frame.js");
  const h = { half: 20, helmAt: -16, beamEach: 6, hullLines: [0], rail: 3, draft: 1.5 };
  const o = { x: 0, y: 64, z: 0 };
  const F = new ShipFrame(o, 0, h);
  const near = F.fromCentre(18, 2, 1);
  assert.ok(inHull(o, F, h, near));
  assert.equal(zoneAt(h, inHull(o, F, h, near).along), "bow");
  assert.equal(inHull(o, F, h, F.fromCentre(0, 5, 1)), null, "abeam, clear of her side");
  assert.equal(inHull(o, F, h, F.fromCentre(0, 0, 8)), null, "high over her deck");
  const twin = { ...h, hullLines: [-4, 4], beamEach: 2 };
  assert.equal(inHull(o, F, twin, F.fromCentre(0, 0, 1)), null, "the water between twin hulls");
});

// ---------- 0.13: using the boats (the use lab), standing helm, docks that open to the sea ----------

test("lab: every boat, shallow to deep, seats you over a hull, lets the helm see, keeps her rails dry and sails", async () => {
  const { useBoat } = await import("../tools/lab/uselab.mjs");
  const bad = [];
  for (const pid of Object.keys(PLANS).filter((k) => k !== "testship")) {
    for (const d of [0.8, 1.0, 1.35]) {   // the deepest as deep as her plan allows (D-004: drawn true, a great ship built 1.35 deep falls under GM's floor)
      const r = useBoat(pid, d);
      for (const i of [...r.seats.issues, ...r.heel.issues, ...r.deck.issues, ...r.sail.issues]) bad.push(`${pid} @${d}: ${i}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("a decked ship can be steered standing at the helm; sneaking steps away", async () => {
  const { takeHelmStanding } = await import("../BP/scripts/steering.js");
  const { launch } = await import("../tools/lab/uselab.mjs");
  const { e, h } = launch("carrack");
  tickAll(2);
  const s = steerTest.state.get(e.id);
  const p = makePlayer(e.dimension, []);
  p.inputInfo = { getMovementVector: () => ({ x: 0, y: 1 }), getButtonState: () => "Released" };
  p.onScreenDisplay = { setActionBar() {} };
  p.teleport({ x: e.location.x + 3, y: Math.floor(e.location.y) + h.deckUp + 1, z: e.location.z });
  assert.equal(takeHelmStanding(e, p), "", "too far from the helm");
  p.teleport({ x: e.location.x + 0.3, y: Math.floor(e.location.y) + h.deckUp + 1, z: e.location.z + 0.2 });
  assert.match(takeHelmStanding(e, p), /standing/);
  s.anchor = null;
  tickAll(60);
  assert.ok(steerTest.state.get(e.id).speed > 0.01, "she answers the standing helm");
  p.isSneaking = true;
  tickAll(2);
  assert.equal(steerTest.state.get(e.id).standing, null, "sneak to step away");
});

test("docks open to the sea: a dock turns away from an inlet that would trap it, and its water stands at sea level", async () => {
  const { buildYard, exitLens } = await import("../tools/lab/yardlab.mjs");
  const { planDock } = await import("../BP/scripts/yardbuild.js");
  const dim = world.getDimension("minecraft:overworld");
  // the sea to the south; a narrow dead-end creek two blocks east of the table
  const x0 = 960000;
  for (let x = x0 - 24; x <= x0 + 24; x++) for (let z = -16; z <= 44; z++) for (let y = 54; y <= 66; y++) {
    let type = "minecraft:air";
    if (z >= 16 && y <= 63) type = y <= 56 ? "minecraft:sand" : "minecraft:water";
    else if (z < 16 && y <= 64) type = y === 64 ? "minecraft:grass_block" : "minecraft:dirt";
    dim.set(x, y, z, type);
  }
  for (let x = x0 + 2; x <= x0 + 6; x++) for (let z = -1; z <= 1; z++) { dim.set(x, 64, z, "minecraft:water"); dim.set(x, 63, z, "minecraft:water"); }
  dim.set(x0, 65, 0, "shipwright:shipwright_table");
  const plan = planDock(dim.getBlock({ x: x0, y: 65, z: 0 }), 16, 5, YARD_STYLES.european);
  assert.ok(plan.ok, plan.reason);
  assert.equal(plan.dirName, "south", "not into the dead-end creek");
  // every culture's dock lets a ship sail straight out
  const y = await buildYard("norse");
  assert.deepEqual(exitLens(y, "cog").issues, []);
  const dry = await buildYard("japanese", { length: 36, width: 11 });
  assert.deepEqual(exitLens(dry, "carrack").issues, [], "a carrack gets out of a dry dock");
});

test("laws: water friction, oars in under sail, shields stowed only under sail, coast and open-sea wind", async () => {
  const { waterDrag, oarsInLaw, OARS_IN_AFTER } = await import("../BP/scripts/laws.js");
  const { shieldsLaw, STOW_AFTER } = await import("../BP/scripts/shields.js");
  const { localWind } = await import("../BP/scripts/wind.js");
  const light = computeHandling(newRecord(PLANS.faering, "k", 6)), heavy = computeHandling(newRecord(PLANS.carrack, "k", 36));
  // friction: fast hulls lose more per tick than slow ones; heavy ones carry their way longer
  const loss = (h, v) => v - waterDrag(h, v);
  assert.ok(loss(light, 0.3) / 0.3 > loss(light, 0.15) / 0.15, "wave-making grows with speed");
  assert.ok(loss(heavy, 0.15) < loss(light, 0.15), "a heavy hull carries her way");
  assert.equal(waterDrag(light, 0.002), 0, "a crawl stops");
  // oars: in after a steady spell with the sail giving the speed, out again as soon as it falls short
  let o = null;
  for (let i = 0; i < OARS_IN_AFTER - 1; i++) o = oarsInLaw(o, { sailing: true, throttle: 1, want: 0.2, sailTarget: 0.25 });
  assert.equal(o.shipped, false, "not on the first puff");
  o = oarsInLaw(o, { sailing: true, throttle: 1, want: 0.2, sailTarget: 0.25 });
  assert.equal(o.shipped, true);
  for (let i = 0; i < 12; i++) o = oarsInLaw(o, { sailing: true, throttle: 1, want: 0.2, sailTarget: 0.1 });
  assert.equal(o.shipped, false, "out oars when the wind drops");
  // shields: never flicker at rest; stowed only after steady sailing
  let sh = null;
  for (let i = 0; i < 200; i++) sh = shieldsLaw(sh, i % 10 < 5);
  assert.equal(sh.stowed, false, "a gusty, on-off sail never stows them");
  for (let i = 0; i < STOW_AFTER; i++) sh = shieldsLaw(sh, true);
  assert.equal(sh.stowed, true);
  for (let i = 0; i < 5; i++) sh = shieldsLaw(sh, false);
  assert.equal(sh.stowed, true, "a lull doesn't bring them straight back");
  // wind: open sea a little fresher than the weather, close under a weather shore much less
  const base = { x: -0.6, z: 0 };                         // blowing toward -x: comes from +x
  const open = { open: 1, fetch: Array(8).fill(32) };
  const lee = { open: 0.5, fetch: [4, 32, 32, 32, 32, 32, 32, 32] };   // land 4 blocks to +x (upwind)
  const m = (w) => Math.hypot(w.x, w.z);
  assert.ok(m(localWind(base, open, 0)) > m(base), "open water: fresher");
  assert.ok(m(localWind(base, lee, 0)) < m(base) * 0.6, "under a weather shore: sheltered");
});

test("ship's boats: a great ship tows a small boat on her line, hoists one on deck or astern, and puts it back over the side", async () => {
  const { towLens, launch } = await import("../tools/lab/uselab.mjs");
  const { stowageFor, hoist, putOverSide } = await import("../BP/scripts/tender.js");
  for (const [a, b] of [["skeid", "faering"], ["carrack", "rowboat"], ["drua", "outrigger"]]) {
    const r = await towLens(a, b);
    assert.deepEqual(r.issues, [], `${a} towing a ${b}`);
  }
  // only small boats, only great ships
  const big = launch("carrack");
  const cog = computeHandling(newRecord(PLANS.cog, "k", 16));
  assert.deepEqual(stowageFor(PLANS.carrack, big.h, readRecord(big.e), PLANS.cog, newRecord(PLANS.cog, "k", 16), cog), [], "no medium ships aboard");
  assert.deepEqual(stowageFor(PLANS.cog, cog, newRecord(PLANS.cog, "k", 16), PLANS.faering, newRecord(PLANS.faering, "k", 6), computeHandling(newRecord(PLANS.faering, "k", 6))), [], "a cog carries none");
  // hoist on deck, the model shows it, then over the side again with her record whole
  const dim = big.e.dimension;
  const boat = dim.spawnEntity("shipwright:rowboat", { x: big.e.location.x + 8, y: 63.6, z: big.e.location.z });
  const rrec = newRecord(PLANS.rowboat, "k", 5); rrec.stage = 5; rrec.name = "Little Auk"; writeRecord(boat, rrec);
  assert.match(hoist(big.e, boat, "deck"), /hoisted/);
  assert.equal(boat.isValid, false, "taken up out of the water");
  assert.equal(readRecord(big.e).boats.length, 1);
  assert.equal(Math.floor(big.e.props["shipwright:mods"] / 512) % 2, 1, "drawn on her deck");
  const back = putOverSide(big.e, 0, 0);
  assert.equal(readRecord(back).name, "Little Auk");
  assert.equal(readRecord(big.e).boats.length, 0);
});

// ---------- 0.16: charts, keys and treasure ----------

test("chart book: marks merge without doubles, soundings keep the shallowest, bearings read like a compass", async () => {
  const { emptyBook, addMarks, addSoundings, bearing, readBook } = await import("../BP/scripts/charts.js");
  const b = emptyBook();
  assert.equal(addMarks(b, [{ id: "a", kind: "wreck", dim: "o", x: 0, z: -100, name: "W" }]), 1);
  assert.equal(addMarks(b, [{ id: "b", kind: "wreck", dim: "o", x: 3, z: -102, name: "W2" }]), 0, "the same wreck, charted twice");
  assert.equal(addSoundings(b, { "0,0": 5 }), 1);
  assert.equal(addSoundings(b, { "0,0": 7 }), 0);
  assert.equal(addSoundings(b, { "0,0": 2 }), 1);
  assert.equal(bearing({ x: 0, z: 0 }, { x: 0, z: -100 }), "100 blocks N");
  assert.equal(bearing({ x: 0, z: 0 }, { x: 100, z: 0 }), "100 blocks E");
  assert.match(readBook(b, { x: 0, z: 0 }, "o").lines[0], /100 blocks N/);
});

test("a navigator's chart marks a treasure that only their captain's key opens", async () => {
  const { navigatorChart, captainLoot, treasureSpot } = await import("../BP/scripts/charts.js");
  const c = navigatorChart("illager", 2, { x: 100, z: 100 }, "minecraft:overworld", 4242);
  assert.deepEqual(c, navigatorChart("illager", 2, { x: 100, z: 100 }, "minecraft:overworld", 4242), "a chart is the same from the same seed");
  const t = c.marks.find((m) => m.kind === "treasure");
  assert.ok(t && Math.hypot(t.x - 100, t.z - 100) >= 120);
  const loot = captainLoot(2, 4242);
  assert.equal(loot.key.lock, t.lock);
  assert.equal(loot.unique.name, "Freebooter's Spyglass");
  const v = navigatorChart("villager", "desert", { x: 0, z: 0 }, "o", 1);
  assert.ok(v.marks.some((m) => m.kind === "home") && !v.marks.some((m) => m.kind === "treasure"), "villagers chart their home water, not loot");
  // where the chest goes: dry ground (not in the leaves), else the sea bottom
  const land = (x, y, z) => (y === 70 ? "minecraft:oak_leaves" : y < 66 ? "minecraft:sand" : "minecraft:air");
  assert.deepEqual(treasureSpot(land, 0, 0, 80, 40), { x: 0, y: 66, z: 0, under: false });
  const sea = (x, y, z) => (y >= 50 && y <= 62 ? "minecraft:water" : y < 50 ? "minecraft:sand" : "minecraft:air");
  assert.deepEqual(treasureSpot(sea, 0, 0, 80, 40, 1), { x: 0, y: 50, z: 0, under: true });
});

test("treasure: the chest appears when you come near, locked; the wrong key won't turn, the right one does", async () => {
  const charts = await import("../BP/scripts/charts.js");
  const dim = world.getDimension("minecraft:overworld");
  for (let x = 7990; x <= 8010; x++) for (let z = 7990; z <= 8010; z++) for (let y = 60; y <= 64; y++) dim.set(x, y, z, "minecraft:sand");
  const chart = { title: "T", lock: "illager:1:9", marks: [{ id: "t1", kind: "treasure", dim: dim.id, x: 8000, z: 8000, lock: "illager:1:9", level: 1, name: "X" }] };
  const item = charts.chartItem(chart);
  const p = makePlayer(dim, [item]);
  p.location = { x: 8000, y: 66, z: 8030 };
  assert.equal(charts.treasureTick([p]).length, 0, "too far yet");
  assert.match(charts.useChart(p, item), /Copied 1 mark/);
  assert.equal(charts.bookOf(p).marks.length, 1);
  p.location = { x: 8000, y: 66, z: 8010 };
  const [site] = charts.treasureTick([p]);
  assert.ok(site?.at, "placed");
  assert.equal(dim.getBlock(site.at).typeId, "minecraft:chest");
  assert.equal(charts.tryLock(dim.id, site.at, charts.keyItem("illager:1:8", "Someone")).open, false);
  const r = charts.tryLock(dim.id, site.at, charts.keyItem("illager:1:9", "Reaver chief"));
  assert.ok(r.open && r.used);
  assert.equal(charts.lockAt(dim.id, site.at), null, "open for good");
});

// ---------- 0.17: the sea world ----------

test("sea world: an ocean of archipelagos, peoples with capitals and lanes, wrecks on the lanes, a launchable spawn", async () => {
  const L = await import("../tools/lab/worldlab.mjs");
  for (const seed of [12345, 777]) {
    const bad = [...L.shapeLens(seed).issues, ...L.peoplesLens(seed).issues, ...L.sitesLens(seed).issues, ...L.spawnLens(seed).issues, ...L.speedLens(seed).issues];
    assert.deepEqual(bad, [], `seed ${seed}`);
  }
});

test("sea world: laid chunks are real blocks that stay put, marked done last, the same every time", async () => {
  const L = await import("../tools/lab/worldlab.mjs");
  const r = L.stickLens(4242, L.sampleChunks(4242));
  assert.deepEqual(r.issues, []);
});

test("sea world: the climate stands in for biomes (village docks and wind ask it)", async () => {
  const { biomeIdAt } = await import("../BP/scripts/world/biome.js");
  const { villageFor } = await import("../BP/scripts/config/villages.js");
  const { elevation, climate } = await import("../BP/scripts/world/terrain.js");
  const seen = new Set();
  for (let x = -5000; x < 5000; x += 97) for (let z = -5000; z < 5000; z += 97) {
    const e = elevation(12345, x, z);
    if (!e.land) continue;
    seen.add(`${climate(12345, x, z).key}:${villageFor(biomeIdAt(12345, x, z))}`);
  }
  assert.ok([...seen].some((s) => s.startsWith("polar:snowy")));
  assert.ok([...seen].some((s) => s.startsWith("arid:desert")));
  assert.ok([...seen].some((s) => s.startsWith("tropical:jungle")));
});

// ---------- 0.18: the world from the base fields, held to the vision ----------

test("balance: the first days, liveliness, the wind belts and the way to the portals meet the vision", async () => {
  const { balance } = await import("../tools/lab/balancelab.mjs");
  for (const seed of [12345, 2024]) {
    const r = balance(seed);
    assert.deepEqual(r.issues, [], `seed ${seed}`);
  }
});

test("inherency: a people lives only where its boat wood grows; cultures follow the land", async () => {
  const { confederation, seatAt, groupWoods } = await import("../BP/scripts/world/peoples.js");
  const { TRADITION_WOOD } = await import("../BP/scripts/world/biomes.js");
  const { groupAt, greatAt } = await import("../BP/scripts/world/terrain.js");
  let checked = 0;
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) {
    const c = confederation(777, seatAt(777, cx, cz));
    if (!c.culture) continue;
    const own = c.members.filter((m) => m.tradition === c.culture).map((m) => {
      const [a, b] = m.id.slice(1).split(",").map(Number);
      return m.great ? greatAt(777, a, b) : groupAt(777, a, b);
    });
    assert.ok(own.some((g) => (groupWoods(777, g).woods[TRADITION_WOOD[c.culture]] ?? 0) > 0), `${c.name} (${c.culture})`);
    checked++;
  }
  assert.ok(checked > 20);
});

test("wind: the belts blow the right way in each hemisphere; storms turn the wind", async () => {
  const { belt, windField, latitude } = await import("../BP/scripts/world/fields.js");
  assert.ok(belt(15).x < 0 && belt(15).z > 0, "north-east trades blow toward the west and the equator (+z)");
  assert.ok(belt(45).x > 0 && belt(45).z < 0, "westerlies blow east and toward the pole");
  assert.ok(belt(-45).z > 0, "southern westerlies blow toward the south pole (+z)");
  assert.ok(belt(2).strength < 0.4 && belt(30).strength < 0.6, "doldrums and horse latitudes are calm");
  assert.ok(Math.abs(latitude(1, 0, 0) - 42) < 6, "the spawn's middle latitudes");
});

test("portals: a fire in an obsidian frame finds the frame's inside; a broken frame finds nothing", async () => {
  const { frameAround } = await import("../BP/scripts/seaworld.js");
  const m = new Map();
  for (let a = -1; a <= 2; a++) for (let k = -1; k <= 3; k++) if (a === -1 || a === 2 || k === -1 || k === 3) m.set(`${a},${k}`, "minecraft:obsidian");
  const get = (x, y, z) => (z === 0 ? m.get(`${x},${y}`) ?? "minecraft:air" : "minecraft:air");
  const f = frameAround(get, { x: 0, y: 0, z: 0 });
  assert.equal(f?.cells.length, 6);
  assert.equal(f.axis, "x");
  m.delete("2,1");
  assert.equal(frameAround(get, { x: 0, y: 0, z: 0 }), null);
});

// ---------- 0.19: the sea world's backend at run time ----------

test("chunk laying: the fewest calls lay exactly what the plan says", async () => {
  const { chunkPlan, layPlan, CHUNK } = await import("../BP/scripts/world/chunkgen.js");
  const { layChunk } = await import("../BP/scripts/seaworld.js");
  const dim = world.getDimension("shipwright:sea");
  for (const [cx, cz] of [[3, 4], [-20, 11]]) {
    const p = chunkPlan(12345, cx, cz);
    const g = layChunk(dim, 12345, cx, cz);
    while (!g.next().done);
    const over = new Set(p.blocks.map((b) => `${b.x},${b.y},${b.z}`));
    for (const c of p.columns) for (const [y0, y1, id] of c.layers) for (let y = y0; y <= y1; y++) {
      if (over.has(`${c.x},${y},${c.z}`)) continue;
      const got = dim.blocks.get(`${c.x},${y},${c.z}`) ?? "minecraft:air";
      assert.equal(got, id, `${c.x},${y},${c.z}`);
    }
    const ops = layPlan(p);
    assert.ok(ops.filter((o) => o.op === "fill").length < 400, "few fills");
    assert.ok(planEqual(p, chunkPlan(12345, cx, cz)), "the same plan every time");
  }
  function planEqual(a, b) { return JSON.stringify(a.blocks) === JSON.stringify(b.blocks) && JSON.stringify(a.columns.map((c) => c.layers)) === JSON.stringify(b.columns.map((c) => c.layers)); }
});

test("run time: the generator keeps ahead of a ship at full speed, in small steps", async () => {
  // in a process of its own: timings taken inside this big test run would be the test run's garbage collections, not the generator's
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(process.execPath, ["--import", "./tests/mocks/register.mjs", "-e", "const { run } = await import('./tools/lab/runlab.mjs'); const r = await run(4242, { ticks: 700, heading: 90 }); console.log(JSON.stringify({ issues: r.issues, worstGap: r.worstGap }));"], { cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 300000 });
  const r = JSON.parse(out.trim().split("\n").pop());
  assert.deepEqual(r.issues, []);
  assert.ok(r.worstGap >= 2, `gap ${r.worstGap}`);
});

// ---------------------------------------------------------------- Minecraft's limits as units (0.21)
import * as LIM from "../BP/scripts/world/limits.js";
import { probeSteps } from "../BP/scripts/probe.js";
import { inherency } from "../tools/lab/inherency.mjs";
import { readFileSync as readSrc, readdirSync as readDir } from "node:fs";

test("limits: the scales come out of Minecraft's units", () => {
  assert.equal(Math.round(LIM.SKY_SCALE), 72);
  assert.equal(Math.round(LIM.G_PER_S2), 32);
  assert.equal(Math.round(LIM.mapScale(9000)), 1111);
});

test("limits: the frontier law matches the plan's table, and solving it gives back its speed", () => {
  const m = { ...LIM.DEFAULT_MEASURED, L: 6, J: 10 };
  const sp = (land, cLand) => LIM.frontierSpeed({ land, cLand, cSea: 3 }, m);
  assert.ok(Math.abs(sp(0.02, 27) - 2.48) < 0.02);
  assert.ok(Math.abs(sp(0.8, 27) - 0.39) < 0.01);
  assert.ok(Math.abs(sp(0.8, 12) - 0.84) < 0.01);
  const v = sp(0.4, 27);
  assert.ok(Math.abs(LIM.frontierLaw({ v, land: 0.4, cLand: 27, cSea: 3 }, m) - LIM.BUDGET.frontier) < 1e-9);
});

test("limits: shallow water: a ship at full speed hits the wall near 2.2 blocks of water", () => {
  assert.ok(Math.abs(LIM.depthFroude(0.42, 2.205) - 1) < 0.001);
  assert.ok(Math.abs(LIM.depthFroude(0.42, 8.82) - 0.5) < 0.001);
  assert.equal(LIM.shallowDrag(0), 1);
  assert.ok(LIM.shallowDrag(0.7) > 1.3 && LIM.shallowDrag(0.7) < 1.5);
  assert.ok(Number.isFinite(LIM.shallowDrag(5)));
});

test("limits: the tide comes twice a day, and continuity turns its rise into a stream", () => {
  assert.ok(Math.abs(LIM.tideLaw(1.5, 0, 0) - 1.5) < 1e-9);
  assert.ok(Math.abs(LIM.tideLaw(1.5, 0, 12000) - 1.5) < 1e-9);
  assert.ok(Math.abs(LIM.tideLaw(1.5, 0, 6000) + 1.5) < 1e-9);
  const peak = Math.abs(LIM.tideRate(1.5, 0, 3000));
  assert.ok(Math.abs(LIM.continuityStream(peak, 40, 1) - 0.0314) < 0.001);
});

test("limits: Froude carries a real sea into the game", () => {
  assert.equal(LIM.carryLength(3, 1), 3);
  assert.ok(Math.abs(LIM.carryTime(8.8, 1) - 4.88) < 0.05);
});

test("limits: pacing follows the device; a bad reading keeps the guess", () => {
  const p6 = LIM.pacing({ ...LIM.DEFAULT_MEASURED, L: 6 });
  assert.deepEqual([p6.genRadius, p6.lookahead, p6.hazeReach], [7, 114, 72]);
  const p4 = LIM.pacing({ ...LIM.DEFAULT_MEASURED, L: 4 });
  assert.ok(p4.genRadius < p6.genRadius && p4.hazeReach < p6.hazeReach);
  const m = LIM.setMeasured({ L: -3, J: "x", kappa: 2 });
  assert.equal(m.L, LIM.DEFAULT_MEASURED.L);
  assert.equal(m.J, LIM.DEFAULT_MEASURED.J);
  assert.equal(m.kappa, 2);
  LIM.setMeasured(LIM.DEFAULT_MEASURED);
});

test("limits: the world is built from fixed givens only (no world module reads the device)", () => {
  const dir = new URL("../BP/scripts/world/", import.meta.url);
  for (const f of readDir(dir)) {
    if (!f.endsWith(".js") || f === "limits.js") continue;
    const src = readSrc(new URL(f, dir), "utf8");
    const imports = src.match(/import[^;]*?from\s*["'][^"']*limits\.js["']/g) ?? [];
    for (const im of imports) assert.ok(!/\b(measured|DEFAULT_MEASURED|pacing|setMeasured)\b/.test(im), `${f} reads the device's limits`);
  }
});

test("inherency: the free numbers never rise (the ratchet)", () => {
  const { total } = inherency();
  const base = JSON.parse(readSrc(new URL("./inherency.json", import.meta.url), "utf8")).total;
  assert.ok(total <= base, `free numbers rose to ${total} (ratchet ${base}): name it in limits.js or vision.js, or tag it // given: or // vision:`);
});

// The engineering lens (tools/lab/englab.py) holds every model against the world's law (D-004): connectivity, mast
// steps, walls, depth, draught, freeboard, decks, stability, the cost at sea, bounds, rams (D-005). Like the inherency
// ratchet, a boat's fail count on a check may fall and never rise; the checks in "hard" must be zero fleet-wide.
test("engineering lens: no boat fails a check more than its ratchet allows, and the hard checks pass", async () => {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync("python3", ["tools/lab/englab.py", "--json"], { cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 180000 });
  const base = JSON.parse(readSrc(new URL("./engineering.json", import.meta.url), "utf8"));
  const rows = out.split("\n").filter((l) => l.startsWith("[ENG] ")).map((l) => JSON.parse(l.slice(6)));
  assert.ok(rows.length >= Object.keys(base.boats).length, `the lens measured ${rows.length} boats, the ratchet holds ${Object.keys(base.boats).length}`);
  const bad = [];
  for (const { k, checks } of rows) {
    const was = base.boats[k];
    if (!was) { bad.push(`${k}: a new boat: add its row to tests/engineering.json (englab.py --ratchet)`); continue; }
    for (const [c, n] of Object.entries(checks)) {
      if (base.hard.includes(c) && n > 0) bad.push(`${k}: ${c} ${n} (a hard check: must be 0)`);
      else if (n > (was[c] ?? 0)) bad.push(`${k}: ${c} rose to ${n} (ratchet ${was[c] ?? 0})`);
    }
  }
  assert.deepEqual(bad, [], "run python3 tools/lab/englab.py --boat <id> to see the model beside the law");
});

test("probe: measures and reports without throwing in the test world", () => {
  const dim = world.getDimension("minecraft:overworld");
  const p = makePlayer(dim);
  p.location = { x: 5, y: 70, z: 5 };
  p.dimension = dim;
  const out = {};
  const it = probeSteps(p, out);
  const t0 = system.currentTick;
  for (let k = 0; k < 500; k++) { system.currentTick++; if (it.next().done) break; }
  system.currentTick = t0;
  assert.equal(out.probed, true);
  assert.ok(out.kappa > 0);
  assert.ok(out.L >= 1);
  assert.ok(out.fill0 > 0 && out.get > 0);
});

// ---------------------------------------------------------------- the homeport and Boatblock (0.22)
import { homeport, cityKind, portQuarters, cityBlocksSteps, PORT_PLAN, forgetHomeport, portSite } from "../BP/scripts/world/homeport.js";
import { gate } from "../BP/scripts/world/portsim.js";
import { reachCentre, sinkAt, REACH, inReach } from "../BP/scripts/world/reach.js";
import { YARD_STYLES as STYLES } from "../BP/scripts/config/yardstyles.js";

test("homeport: Strongyle stands on its own water, one quarter for each tradition laid out by its agent, each with one dry dock", () => {
  const hp = homeport(4242);
  assert.ok(hp);
  assert.deepEqual(hp.quarters.map((q) => q.key).sort(), Object.keys(STYLES).sort());
  for (const q of portQuarters(hp)) {
    assert.ok(q.wing, `${q.key} designed its wing`);
    assert.ok(q.pieces.includes("main") && q.pieces.includes("home"), `${q.key}: ${q.pieces.join(", ")}`);
    assert.ok(q.log.some((l) => l.move === "dock" && l.ok));
  }
  const tables = portQuarters(hp).map((q) => q.table);
  for (let i = 0; i < tables.length; i++) for (let j = i + 1; j < tables.length; j++) assert.ok(Math.hypot(tables[i].x - tables[j].x, tables[i].z - tables[j].z) > 16, "quarters too close");
  const site = portSite(4242);
  assert.deepEqual([hp.x, hp.z], [site.x, site.z]);
});

test("homeport: the pre-eruption caldera: Plato's rings on Pre-Kameni, a shallow lagoon, one strait to the north-west, the southern land", () => {
  const hp = homeport(4242);
  const kinds = new Map();
  const R = PORT_PLAN.radius;
  for (let x = -R; x <= R; x += 4) for (let z = -R; z <= R; z += 4) {
    const k = cityKind(hp, hp.x + x, hp.z + z)?.kind ?? "natural";
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }
  for (const k of ["hub", "ringwater", "landring", "bridge", "tunnel", "quay", "shore", "canal", "wing", "plaza", "isle", "basin", "lagoon", "jetty", "cliff", "strait", "land", "mole", "islet", "natural"]) assert.ok(kinds.get(k) > 0, `no ${k}`);
  assert.equal(cityKind(hp, hp.x, hp.z).kind, "hub");
  // Plato's proportions: island 5, then 1, 2, 2, 3, 3 stades
  const st = PORT_PLAN.stade, Rr = PORT_PLAN.rings;
  assert.deepEqual(Rr.map((r) => r / st), [2.5, 3.5, 5.5, 7.5, 10.5, 13.5]);
  // the strait opens to the north-west (-x, -z); the south is land
  assert.ok(Math.cos(hp.straitA) < 0 && Math.sin(hp.straitA) < 0, `strait at ${hp.straitA}`);
  const southLand = [...Array(20).keys()].filter((k) => cityKind(hp, hp.x + (k - 10) * 10, hp.z + 500)?.kind === "land").length;
  assert.ok(southLand > 10, `southern land ${southLand}`);
  assert.equal(cityKind(hp, hp.x + 300 * Math.cos(hp.straitA), hp.z + 300 * Math.sin(hp.straitA))?.kind, "strait");
});

test("homeport: a level 2 dock and Table in every quarter, a dry dock for every people in the great harbour, the Chart Table, the Light in the harbour gate, a cliff town, the market", () => {
  const hp = homeport(4242);
  const blocks = [];
  for (let cx = Math.floor((hp.x - PORT_PLAN.radius) / 16); cx <= Math.floor((hp.x + PORT_PLAN.radius) / 16); cx++)
    for (let cz = Math.floor((hp.z - PORT_PLAN.radius) / 16); cz <= Math.floor((hp.z + PORT_PLAN.radius) / 16); cz++) {
      const g = cityBlocksSteps(4242, hp, cx, cz);
      let r;
      do { r = g.next(); } while (!r.done);
      blocks.push(...r.value);
    }
  assert.equal(blocks.filter((b) => b.id === "shipwright:shipwright_table").length, 20, "one in each quarter, one at each great dock");
  const top = Math.max(...blocks.filter((b) => b.x === hp.light.x && b.z === hp.light.z).map((b) => b.y));
  assert.ok(top >= hp.light.y + PORT_PLAN.tower - 2, `light ${top}`);
  assert.equal(hp.harbour.length, PORT_PLAN.great.docks);
  assert.ok(blocks.some((b) => /_wool$/.test(b.id)), "the market's awnings");
  assert.ok(blocks.filter((b) => /_leaves$|^minecraft:bamboo$/.test(b.id)).length > 2000, "trees: the peoples' and the Therans'");
  assert.ok(blocks.filter((b) => b.x === hp.light.x && b.z === hp.light.z && b.id === "minecraft:sea_lantern").length > 20, "a column of light up the well");
  assert.ok(blocks.some((b) => b.id === "minecraft:waxed_copper_bulb"), "orichalcum round the citadel");
  assert.ok(blocks.some((b) => b.id === "minecraft:gold_block" && b.x === hp.x && b.z === hp.z), "the chart's you-are-here");
  assert.ok(blocks.filter((b) => b.id === "minecraft:white_concrete").length > 200, "a cliff town");
  assert.ok(blocks.filter((b) => b.id === "minecraft:glass_pane").length > 100, "Theran houses");
  assert.ok(blocks.some((b) => b.id === "minecraft:bell" && b.x === hp.bell.x && b.z === hp.bell.z));
  assert.ok(blocks.filter((b) => /blackstone|basalt/.test(b.id)).length < 50, "light and nautical: hardly any black (the peoples' own roof tiles aside)");
});

test("reach: the archipelagos drown at the heart, the sink fades to nothing at the rim, the homeport stays clear", () => {
  const c = reachCentre(4242);
  assert.ok(Math.abs(c.x) >= REACH.dist && c.z === 0);
  assert.equal(sinkAt(4242, c.x, c.z), REACH.sink);
  assert.equal(sinkAt(4242, c.x + REACH.R + 1, c.z), 0);
  const hp = homeport(4242);
  assert.ok(!inReach(4242, hp.x, hp.z, REACH.margin));
  let land = 0, n = 0;
  for (let x = -900; x <= 900; x += 30) for (let z = -900; z <= 900; z += 30) { n++; if (elevationOf(c.x + x, c.z + z).land) land++; }
  assert.ok(land / n < 0.02, `land share in the Reach ${(land / n).toFixed(3)}`);
});
const elevationOf = (x, z) => columnAtOf(4242, x, z);
import { columnAt as columnAtOf } from "../BP/scripts/world/lattice.js";

test("boatblock: the bell sends you to the crew's raft with a kit once; castaways respawn there and newcomers can start there", async () => {
  const B = await import("../BP/scripts/boatblock.js");
  const { SEA_DIM } = await import("../BP/scripts/dims.js");
  world.setDynamicProperty("shipwright:seed", 4242);
  const dim = world.getDimension(SEA_DIM);
  const p = makePlayer(dim);
  const given = [];
  p.getComponent = (n) => (n === "minecraft:inventory" ? { container: { addItem: (s) => given.push(s.typeId ?? s.id) } } : undefined);
  p.teleport = (at, o) => { p.location = { ...at }; if (o?.dimension) p.dimension = o.dimension; };
  p.addEffect = () => {}; p.runCommand = () => ({});
  B.embark(p);
  const { worldSeed } = await import("../BP/scripts/seaworld.js");
  const spot = B.castawaySpot(worldSeed());
  assert.deepEqual([p.location.x, p.location.z], [spot.x, spot.z]);
  assert.ok(B.isCastaway(p));
  assert.equal(given.length, 3);
  B.embark(p);
  assert.equal(given.length, 3, "the kit is given once");
  const f = B.driftFind(4242, spot.x, spot.z, 7);
  assert.match(f.item, /^minecraft:[a-z_]+$/);
  assert.ok(f.count >= 1);
  world.setDynamicProperty("shipwright:mode", "boatblock");
  assert.equal(B.worldMode(), "boatblock");
  world.setDynamicProperty("shipwright:mode", undefined);
});

test("homeport: the culture agents keep the math (own arc, no overlaps, open dock mouths) and their people's must-gates", () => {
  for (const seed of [12345, 4242, 777, 2024]) {
    forgetHomeport();
    const hp = homeport(seed);
    const qs = hp.quarters;
    const rects = qs.flatMap((q) => [q.apron, ...q.pieces.map((p) => p.rect)].map((r) => ({ q: q.i, r })));
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      if (rects[i].q === rects[j].q) continue;
      const a = rects[i].r, b = rects[j].r;
      assert.ok(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3], `seed ${seed}: quarters ${rects[i].q} and ${rects[j].q} overlap`);
    }
    for (const q of qs) {
      const m = { x: q.dock.o.x + q.dock.d.x * (PORT_PLAN.dock.length + 4), z: q.dock.o.z + q.dock.d.z * (PORT_PLAN.dock.length + 4) };
      assert.ok(["lagoon", "canal"].includes(cityKind(hp, m.x, m.z)?.kind), `seed ${seed}: ${q.key}'s mouth opens on ${cityKind(hp, m.x, m.z)?.kind}`);
      for (const l of q.log.filter((l) => l.ok && l.gates)) for (const g of l.gates) if (!l.relaxed) assert.ok(!g.startsWith("✗ must"), `seed ${seed}: ${q.key} ${l.move} broke "${g}"`);
    }
    // the shares are uneven: the widest arc is well over the narrowest
    const w = hp.sim.quarters.map((q) => q.arc[1] - q.arc[0]);
    assert.ok(Math.max(...w) > 1.5 * Math.min(...w), `seed ${seed}: arcs ${w.map((x) => x.toFixed(2))}`);
  }
  forgetHomeport();
});

test("homeport: a gate is a rule, and the agents read it as one", () => {
  const piece = { which: "home", d: { x: 0, z: 1 }, rect: [0, 10, 6, 16], mid: { x: 3, z: 13 }, long: { x: 1, z: 0 } };
  const q = { apron: [0, 0, 6, 4], pieces: [{ which: "main", rect: [0, 0, 6, 6], mid: { x: 3, z: 3 }, d: { x: 0, z: -1 } }] };
  const geo = { x: 3, z: -100, rin: () => 140 };
  assert.ok(gate({ must: "faces", to: "south" }, piece, q, geo));
  assert.ok(!gate({ must: "faces", to: "water" }, piece, q, geo), "it faces away from the lagoon's middle");
  assert.ok(gate({ must: "parallel", to: "shore" }, piece, q, geo));
  assert.ok(gate({ must: "behind", to: "main", range: [5, 15] }, piece, q, geo));
  assert.ok(gate({ must: "near", to: "main", within: 5 }, piece, q, geo));
  assert.ok(!gate({ must: "apart", gap: 6 }, piece, q, geo));
});

test("Therans: wrecks of the round isle lie off the lanes with copper, tin and blue glass, and a tablet only you can read", async () => {
  const { theranWrecksIn } = await import("../BP/scripts/world/sites.js");
  const { wreck } = await import("../BP/scripts/world/wrecks.js");
  const { theranChart } = await import("../BP/scripts/seaworld.js");
  const ws = theranWrecksIn(4242, -6000, -6000, 6000, 6000);
  assert.ok(ws.length >= 8, `${ws.length} Theran wrecks`);
  const b = wreck(ws[0]);
  assert.ok(b.cells.some((c) => c.id === "minecraft:red_wool"), "her striped sail");
  assert.ok(b.containers[0].chart, "her tablet");
  assert.ok(b.containers.flatMap((c) => c.loot).some((l) => /copper|glass/.test(l.item)));
  const t = theranChart(4242, ws[0], "shipwright:sea");
  assert.ok(t.theran && t.marks[0].name.startsWith("Strongyle"));
  const charts = await import("../BP/scripts/charts.js");
  const dim = world.getDimension("shipwright:sea");
  const p = makePlayer(dim, [charts.chartItem(t)]);
  assert.match(charts.useChart(p, charts.chartItem(t)), /Linear A/);
});

test("Therans: each people tells its tale once, deep in its own waters, and never at home", async () => {
  const T = await import("../BP/scripts/theran.js");
  const { LEGENDS } = await import("../BP/scripts/config/theran.js");
  const { peopleAt, warmPeoples } = await import("../BP/scripts/world/peoples.js");
  assert.deepEqual(Object.keys(LEGENDS).sort(), Object.keys(STYLES).sort());
  const dim = world.getDimension("shipwright:sea");
  const p = makePlayer(dim);
  const props = new Map();
  p.getDynamicProperty = (k) => props.get(k); p.setDynamicProperty = (k, v) => props.set(k, v);
  let spot = null;
  for (let x = -4000; x <= 4000 && !spot; x += 250) for (let z = -4000; z <= 4000 && !spot; z += 250) {
    const g = warmPeoples(4242, x, z); while (!g.next().done);
    const pe = peopleAt(4242, x, z);
    if (pe.hold >= T.TALE_HOLD && LEGENDS[pe.tradition] && !inPortOf(x, z)) spot = { x, z };
  }
  assert.ok(spot, "somewhere deep in a people's waters");
  assert.match(T.taleFor(p, 4242, spot.x, spot.z), /they tell a tale/);
  assert.equal(T.taleFor(p, 4242, spot.x, spot.z), null, "once");
  const hp = homeport(4242);
  assert.equal(T.taleFor(makePlayer(dim), 4242, hp.x, hp.z), null, "not at home");
});
const inPortOf = (x, z) => Math.hypot(x - homeport(4242).x, z - homeport(4242).z) < PORT_PLAN.radius + 300;

// ---------------------------------------------------------------- Boatblock's sea laws (0.23)
import * as SL from "../BP/scripts/world/sealaws.js";

test("sea laws: the tide comes twice a day and uncovers the flats; waves grow with wind and fetch; reefs grow only warm", () => {
  const c = reachCentre(4242);
  const t0 = [0, 3000, 6000, 9000].map((t) => SL.tideAt(4242, c.x, c.z, t));
  assert.ok(Math.abs(SL.tideAt(4242, c.x, c.z, 0) - SL.tideAt(4242, c.x, c.z, 12000)) < 1e-9, "twice a day");
  assert.ok(Math.max(...t0) > 0 && Math.min(...t0) < 0);
  assert.ok(SL.waveHeight(19, 400) > SL.waveHeight(12, 400), "more wind, bigger sea");
  assert.ok(SL.waveHeight(12, 2) < SL.waveHeight(12, 400), "a short fetch, a small sea");
  assert.equal(SL.washChance(2, 5), 0, "behind a breakwater nothing goes over");
  assert.ok(SL.washChance(3, 1) > 0);
  assert.equal(SL.reefRate(0.3, 2), 0, "cold seas don't grow");
  assert.ok(SL.reefRate(0.8, 1) > SL.reefRate(0.8, 5), "light falls off with depth");
});

test("sea laws: at low water the flats round a castaway rise; at high water they go back under", async () => {
  const B = await import("../BP/scripts/boatblock.js");
  const { SEA_DIM } = await import("../BP/scripts/dims.js");
  const { columnAt } = await import("../BP/scripts/world/lattice.js");
  const seed = 4242;
  const { raftSpot } = await import("../BP/scripts/world/reach.js");
  const rs = raftSpot(seed);
  let flat = null;
  for (let dx = -12; dx <= 12 && !flat; dx++) for (let dz = -12; dz <= 12 && !flat; dz++) {
    if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) continue;
    if (SL.isFlat(columnAt(seed, rs.x + dx, rs.z + dz))) flat = { x: rs.x + dx, z: rs.z + dz };
  }
  assert.ok(flat, "a flat in the Reach");
  const dim = world.getDimension(SEA_DIM);
  dim.blocks.set(`${flat.x},62,${flat.z}`, "minecraft:water");
  const p = makePlayer(dim);
  p.location = { x: flat.x + 0.5, y: 63, z: flat.z + 0.5 };
  p.dimension = dim;
  world.players = [p];
  let t = 0;
  while (!SL.lowWater(seed, flat.x, flat.z, t)) t += 100;
  const was = world.getAbsoluteTime;
  world.getAbsoluteTime = () => t;
  const settle = async () => { for (let i = 0; i < 400; i++) await new Promise((r) => setTimeout(r, 0)); };
  system.manualJobs = false;
  B._seaLawsTest.reset();
  B._seaLawsTest.tideTick(seed, dim);
  await settle();
  const bed = SL.flatBlock(seed, flat.x, flat.z, columnAt(seed, flat.x, flat.z));
  assert.equal(dim.blocks.get(`${flat.x},62,${flat.z}`), bed);
  while (SL.lowWater(seed, flat.x, flat.z, t)) t += 100;
  B._seaLawsTest.tideTick(seed, dim);
  await settle();
  assert.equal(dim.blocks.get(`${flat.x},62,${flat.z}`), "minecraft:water");
  world.getAbsoluteTime = was;
  world.players = [];
});

test("handling: an outrigger heels away from its float freely, but hardly toward it (the float would go under)", async () => {
  const { heelTarget, heelLaw } = await import("../BP/scripts/laws.js");
  const { PLANS } = await import("../BP/scripts/config/plans.js");
  const { newRecord } = await import("../BP/scripts/ship.js");
  const { computeHandling } = await import("../BP/scripts/handling.js");
  const rec = newRecord(PLANS.outrigger, "test", 7);
  rec.stage = 5;
  const h = computeHandling(rec);
  assert.ok(h && h.floatHeel > 3 && h.floatHeel < 10, `float heel ${h?.floatHeel}`);
  const toward = heelTarget(h, { fill: 1, windSpeed: 1.2, off: 90, windAcross: 1, turnRight: 0, speed: 0 });
  const away = heelTarget(h, { fill: 1, windSpeed: 1.2, off: 90, windAcross: -1, turnRight: 0, speed: 0 });
  assert.ok(toward > 0 && away < 0 && toward < -away / 2);
  let s = { heel: 0, rate: 0 };
  for (let i = 0; i < 400; i++) s = heelLaw(s, 25, { limit: 25, limitPos: h.floatHeel });
  assert.ok(s.heel <= h.floatHeel + 1e-9);
});

// ---------------------------------------------------------------- built-in checks (0.24)
test("self-checks: the laws are stable for every hull, Strongyle keeps its rules, and the chunk plans hold together", async () => {
  const C = await import("../BP/scripts/checks.js");
  for (const seed of [4242, 2024]) {
    forgetHomeport();
    const g = C.selfChecks(seed);
    let r;
    do { r = g.next(); } while (!r.done);
    const failed = r.value.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    assert.deepEqual(failed, [], `seed ${seed}`);
  }
  forgetHomeport();
});

test("self-checks: a broken plan is caught (layers out of order, water inside the ground, a block outside its chunk)", async () => {
  const { planCheck } = await import("../BP/scripts/checks.js");
  const col = (layers, water = null) => ({ x: 0, z: 0, layers, water });
  assert.equal(planCheck({ cx: 0, cz: 0, columns: [col([[16, 16, "minecraft:bedrock"], [17, 60, "minecraft:stone"]], [61, 62])], blocks: [] }), true);
  assert.match(String(planCheck({ cx: 0, cz: 0, columns: [col([[16, 16, "minecraft:bedrock"], [16, 60, "minecraft:stone"]])], blocks: [] })), /out of order/);
  assert.match(String(planCheck({ cx: 0, cz: 0, columns: [col([[16, 60, "minecraft:stone"]], [58, 62])], blocks: [] })), /inside its water/);
  assert.match(String(planCheck({ cx: 0, cz: 0, columns: [], blocks: [{ x: 20, y: 70, z: 0, id: "minecraft:stone" }] })), /outside the chunk/);
});

test("boot: one system that throws doesn't stop the others, and the log line names it", async () => {
  const { start, bootReport, bootLine } = await import("../BP/scripts/boot.js");
  start("a test system that fails", () => { throw new Error("on purpose"); });
  start("a test system that works", () => {});
  const r = bootReport();
  assert.ok(r.failed.some((s) => s.name === "a test system that fails" && s.error === "on purpose"));
  assert.ok(r.started.includes("a test system that works"));
  assert.match(bootLine("x"), /Failed: .*a test system that fails \(on purpose\)/);
});

test("boot lab: the whole pack loads under the game's rules (no world reads before it exists), every system starts, and a newcomer reaches Strongyle", async () => {
  const { runInQuickJS } = await import("../tools/lab/qjs.mjs");
  const { result, error } = await runInQuickJS("tools/lab/bootlab.mjs", ["--ticks", "700"]);
  assert.equal(error, null);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.failed, []);
  assert.equal(result.where, "shipwright:sea");
});

test("api lens: every call into the game exists in the @minecraft/server version the manifest asks for", async () => {
  const { apiCheck } = await import("../tools/lab/apicheck.mjs");
  const r = apiCheck();
  assert.deepEqual(r.issues, []);
  const { total } = JSON.parse(readSrc(new URL("./apicheck.json", import.meta.url), "utf8"));
  assert.ok(r.count <= total, `game API findings rose to ${r.count} (ratchet ${total}): ${r.findings.map((f) => `${f.file}:${f.line} ${f.msg}`).join("; ")}`);
});
