// Developer commands, run in game or from the server console:
//   /scriptevent shipwright:selftest   builds a test beach in the sky and checks everything
//   /scriptevent shipwright:showcase   lays out one boat per build stage for visual checks
//   /scriptevent shipwright:cleanup    removes test boats and test sites
//   /scriptevent shipwright:seat low|mid|high   calibrates where riders sit, on every boat
//   /scriptevent shipwright:facesync on|off     keeps the game's facing in step with the heading (fallback: off)
import { DIMENSIONS } from "./dims.js";
import { setP, getP } from "./props.js";
import { world, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { PLANS, STAGES } from "./config/plans.js";
import { TABLE_ID } from "./config/yards.js";
import { detectBeachYard } from "./yard.js";
import { readRecord, writeRecord, applyRecord, seatEventFor, LAUNCHED_TAG, SEAT_HEIGHTS, seatHeight, seatEvent } from "./ship.js";
import { waterSurface, assistEnabled } from "./buoyancy.js";
import { getMode } from "./orientmode.js";
import { layKeel, raiseFrames, plankHull, rig, launch } from "./stages.js";
import { _test as steerTest } from "./steering.js";
import { shieldPose, setShieldPose, PEG } from "./shields.js";

const TAG = "shipwright_test";
const SITES_KEY = "shipwright:test_sites";
// The entity's actual properties (small values are packed together; see props.js).
const PROPS = ["stage", "mids", "beam", "depth", "woods", "flags", "kinds", "sail_color", "yaw", "wind_rel", "wind_str",
  "rudder", "sail_fill", "heel", "rowing", "oar_pairs", "rig_scale", "stroke_l", "stroke_r", "turn", "telltale", "mods", "deck"];

// ---------- reporting ----------

function reporter(player) {
  const lines = [];
  let pass = 0;
  let fail = 0;
  const out = (msg) => {
    console.warn(msg);
    try {
      player?.sendMessage(msg);
    } catch {
      /* player may have left */
    }
  };
  return {
    ok(name, detail = "") {
      pass++;
      lines.push(`PASS ${name}${detail ? `: ${detail}` : ""}`);
      out(`§a[Shipwright test] PASS§r ${name}${detail ? `: ${detail}` : ""}`);
    },
    bad(name, detail = "") {
      fail++;
      lines.push(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
      out(`§c[Shipwright test] FAIL§r ${name}${detail ? `: ${detail}` : ""}`);
    },
    note(msg) {
      out(`§7[Shipwright test] ${msg}§r`);
    },
    check(name, cond, detail) {
      cond ? this.ok(name, detail) : this.bad(name, detail);
    },
    summary() {
      out(`§l[Shipwright test] ${pass} passed, ${fail} failed§r`);
      console.warn(`[Shipwright test] SUMMARY\n${lines.join("\n")}`);
    },
  };
}

async function step(t, name, fn) {
  try {
    return await fn();
  } catch (e) {
    t.bad(name, `threw ${e}`);
    return undefined;
  }
}

// ---------- test sites ----------

function remember(site) {
  let sites = [];
  try {
    sites = JSON.parse(world.getDynamicProperty(SITES_KEY) ?? "[]");
  } catch {
    sites = [];
  }
  sites.push(site);
  world.setDynamicProperty(SITES_KEY, JSON.stringify(sites));
}

function setType(dim, x, y, z, type) {
  const b = dim.getBlock({ x, y, z });
  if (!b) throw new Error(`Chunk not loaded at ${x} ${y} ${z}`);
  b.setType(type);
}

/** Fills a box over several ticks. typeFor(x, y, z) returns a block id. */
function fillBox(dim, from, to, typeFor) {
  return new Promise((resolve, reject) => {
    system.runJob((function* () {
      try {
        let n = 0;
        for (let x = from.x; x <= to.x; x++)
          for (let z = from.z; z <= to.z; z++)
            for (let y = from.y; y <= to.y; y++) {
              setType(dim, x, y, z, typeFor(x, y, z));
              if (++n % 400 === 0) yield;
            }
        resolve();
      } catch (e) {
        reject(e);
      }
    })());
  });
}

/**
 * A small beach in the sky: stone base, sand strip, walled water basin.
 * The table sits at (o.x, o.y, o.z) and the water lies toward +z.
 */
async function buildBeach(dim, o) {
  const box = { dim: dim.id, from: { x: o.x - 3, y: o.y - 2, z: o.z - 1 }, to: { x: o.x + 3, y: o.y + 4, z: o.z + 16 } };
  remember(box);
  await fillBox(dim, box.from, box.to, (x, y, z) => {
    const dz = z - o.z;
    const edge = x === box.from.x || x === box.to.x || z === box.to.z;
    if (y === o.y - 2) return "minecraft:stone";
    if (dz <= 5 && y === o.y - 1) return "minecraft:sand";
    if (dz > 5 && (y === o.y - 1 || y === o.y)) return edge ? "minecraft:stone" : "minecraft:water";
    return "minecraft:air";
  });
  setType(dim, o.x, o.y, o.z, TABLE_ID);
  return box;
}

function testOrigin(player) {
  const p = player.location;
  return { x: Math.floor(p.x) + 6, y: Math.min(Math.floor(p.y) + 24, 300), z: Math.floor(p.z) };
}

function playerFrom(ev) {
  if (ev.sourceEntity?.typeId === "minecraft:player") return ev.sourceEntity;
  return world.getAllPlayers()[0];
}

// ---------- self-test ----------

async function selftest(player) {
  const t = reporter(player);
  t.note("Starting. A test beach appears about 24 blocks above you.");

  // Environment
  await step(t, "server-ui 2.x form signatures", () => {
    new ModalFormData()
      .slider("s", 0, 2, { valueStep: 1, defaultValue: 1 })
      .dropdown("d", ["a", "b"], { defaultValueIndex: 0 })
      .toggle("t", { defaultValue: true })
      .textField("x", "p", { defaultValue: "" });
    t.ok("server-ui 2.x form signatures");
  });
  await step(t, "game mode readable", () => t.ok("game mode readable", String(player.getGameMode())));

  // Site and yard detection
  const dim = player.dimension;
  const o = testOrigin(player);
  const site = await step(t, "build test beach", () => buildBeach(dim, o));
  if (!site) return t.summary();
  await system.waitTicks(5);

  const table = dim.getBlock(o);
  t.check("table placed", table?.typeId === TABLE_ID, table?.typeId);
  const yard = await step(t, "detect beach yard", () => detectBeachYard(table));
  if (!yard) return t.summary();
  t.check("beach yard valid", yard.ok, yard.ok ? `${yard.length} long toward ${yard.dirName}, water at ${yard.waterDist}` : yard.reason);
  t.check("yard faces the water (+z = south)", yard.dirName === "south", yard.dirName);
  if (!yard.ok) return t.summary();

  // Blocked yard
  await step(t, "blocked yard detected", async () => {
    setType(dim, o.x, o.y, o.z + 2, "minecraft:oak_planks");
    const blocked = detectBeachYard(dim.getBlock(o));
    t.check("blocked yard detected", !blocked.ok && blocked.blocker?.z === o.z + 2, blocked.reason);
    setType(dim, o.x, o.y, o.z + 2, "minecraft:air");
  });

  // Headless build
  const plan = PLANS.faering;
  const ship = await step(t, "lay keel (spawn entity)", () => layKeel(yard, plan, 7));
  if (!ship) return t.summary();
  ship.addTag(TAG);
  t.ok("lay keel (spawn entity)", ship.typeId);

  await step(t, "entity properties", () => {
    const missing = PROPS.filter((k) => ship.getProperty(`shipwright:${k}`) === undefined);
    t.check("entity properties", missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : `${PROPS.length} readable`);
    t.check("length maps to mids", ship.getProperty("shipwright:mids") === 4, `mids = ${ship.getProperty("shipwright:mids")}`);
  });

  await step(t, "record round trip", () => {
    const rec = readRecord(ship);
    t.check("record round trip", rec?.plan === "faering" && rec?.dims.length === 7);
  });

  await step(t, "stages 2 to 4", () => {
    raiseFrames(ship, 1.1, 0.9);
    plankHull(ship, { bow: "spruce", mid: "cherry", stern: "spruce" });
    rig(ship, true, 14);
    t.check("stages 2 to 4", ship.getProperty("shipwright:stage") === STAGES.RIGGED, `stage = ${ship.getProperty("shipwright:stage")}`);
    const beam = ship.getProperty("shipwright:beam");
    t.check("float property precision", Math.abs(beam - 1.1) < 0.01, `beam = ${beam}`);
    t.check("zone wood set", getP(ship, "wood_mid") === 7, `wood_mid = ${getP(ship, "wood_mid")}`);
  });

  t.check("not rideable before launch", !ship.getComponent("minecraft:rideable"));

  await step(t, "launch", () => launch(ship, yard, "Test Gull"));
  await system.waitTicks(20);
  t.check("rideable after launch", !!ship.getComponent("minecraft:rideable"));
  t.check("entity survives launch", ship.isValid);

  await system.waitTicks(40);
  if (ship.isValid) {
    const y = ship.location.y;
    t.check("floats at the waterline", y > yard.waterY - 0.5 && y < yard.waterY + 2, `y = ${y.toFixed(2)}, water block y = ${yard.waterY}`);
    const inBasin = ship.location.z > o.z + 5;
    t.check("launched into the water", inBasin, `z offset ${(ship.location.z - o.z).toFixed(1)}`);
  }

  t.note("Visual check: look up. Test Gull should be a 7-block faering with a cherry midship and a red sail, bow toward the far wall.");
  t.note("Run /scriptevent shipwright:cleanup when done.");
  t.summary();
}

// ---------- showcase ----------

async function showcase(player) {
  const t = reporter(player);
  const dim = player.dimension;
  const o = testOrigin(player);
  const box = { dim: dim.id, from: { x: o.x - 2, y: o.y - 1, z: o.z - 2 }, to: { x: o.x + 30, y: o.y + 4, z: o.z + 14 } };
  remember(box);
  await fillBox(dim, box.from, box.to, (x, y) => (y === box.from.y ? "minecraft:smooth_stone" : "minecraft:air"));

  const plan = PLANS.faering;
  const rows = [
    { label: "1 Keel", stage: 1, length: 6 },
    { label: "2 Frames", stage: 2, length: 6 },
    { label: "3 Planked", stage: 3, length: 6 },
    { label: "4 Rigged", stage: 4, length: 6 },
    { label: "Shortest (4)", stage: 4, length: 4 },
    { label: "Longest (10), wide", stage: 4, length: 10, beam: 1.5 },
    { label: "Narrow and deep", stage: 4, length: 8, beam: 0.8, depth: 1.5 },
  ];
  const woods = ["spruce", "oak", "dark_oak", "birch", "cherry", "acacia", "mangrove"];
  rows.forEach((r, i) => {
    const fakeYard = {
      dimension: dim, origin: { x: o.x + i * 4, y: o.y, z: o.z }, dir: { x: 0, z: 1 }, dirName: "south", key: "showcase",
    };
    const e = layKeel(fakeYard, plan, r.length);
    e.addTag(TAG);
    const rec = readRecord(e);
    rec.stage = r.stage;
    rec.dims.beam = r.beam ?? 1;
    rec.dims.depth = r.depth ?? 1;
    rec.sections.bow.mat = woods[i % woods.length];
    rec.sections.mid.mat = woods[(i + 1) % woods.length];
    rec.sections.stern.mat = woods[i % woods.length];
    rec.sections.rig = { sail: r.stage >= 4, color: i * 2 % 16, original: true };
    writeRecord(e, rec);
    applyRecord(e, rec);
    e.nameTag = r.label;
  });
  t.note(`Showcase built ${rows.length} boats in a row about 24 blocks above you, each labeled. Expect: keel only, then ribs, then planks, then mast and sail; lengths 4 to 10 with no gaps between bow, midsections and stern.`);
}

// ---------- cleanup ----------

async function cleanup(player) {
  let removed = 0;
  for (const id of DIMENSIONS) {
    try {
      for (const e of world.getDimension(id).getEntities({ tags: [TAG] })) {
        e.remove();
        removed++;
      }
    } catch {
      /* dimension not loaded */
    }
  }
  let sites = [];
  try {
    sites = JSON.parse(world.getDynamicProperty(SITES_KEY) ?? "[]");
  } catch {
    sites = [];
  }
  const left = [];
  for (const s of sites) {
    try {
      await fillBox(world.getDimension(s.dim), s.from, s.to, () => "minecraft:air");
    } catch {
      left.push(s); // not loaded; try again later
    }
  }
  world.setDynamicProperty(SITES_KEY, JSON.stringify(left));
  const msg = `[Shipwright test] Removed ${removed} test boats and ${sites.length - left.length} test sites${left.length ? `; ${left.length} sites not loaded, run cleanup near them` : ""}.`;
  console.warn(msg);
  player?.sendMessage(msg);
}

// ---------- inspect ----------

function inspect(player) {
  const lines = [];
  const say = (m) => lines.push(m);
  say(`[Shipwright inspect] orientation mode ${getMode()}, float assist ${assistEnabled() ? "on" : "off"}`);
  let boats = [];
  try {
    boats = player.dimension.getEntities({ families: ["shipwright_boat"], location: player.location, maxDistance: 24 });
  } catch {
    boats = [];
  }
  if (!boats.length) say("No boats within 24 blocks.");
  for (const e of boats) {
    const rec = readRecord(e);
    const l = e.location;
    const rideable = e.getComponent("minecraft:rideable");
    let riders = [];
    try {
      riders = rideable?.getRiders().map((r) => r.nameTag || r.typeId) ?? [];
    } catch {
      riders = [];
    }
    const prop = (k) => {
      try {
        return getP(e, k);
      } catch {
        return "missing";
      }
    };
    let vel = "?";
    try {
      const v = e.getVelocity();
      vel = `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
    } catch {
      /* not readable */
    }
    const surface = waterSurface(e.dimension, l.x, l.y, l.z);
    say(`- ${e.nameTag || "(unnamed)"} ${e.typeId} at ${l.x.toFixed(1)} ${l.y.toFixed(2)} ${l.z.toFixed(1)}, yaw ${e.getRotation().y.toFixed(0)}`);
    say(`  record: ${rec ? `stage ${rec.stage}, length ${rec.dims.length}` : "none"}; properties: stage ${prop("stage")}, mids ${prop("mids")}, orient ${prop("orient")}`);
    say(`  seats: ${rideable ? `yes (${rideable.seatCount ?? "?"} seats), riders: ${riders.join(", ") || "none"}` : "NO SEATS"}; layout: ${seatEventFor(e)}; launched tag: ${e.hasTag(LAUNCHED_TAG)}`);
    say(`  water: ${surface === null ? "not in water" : `surface at ${surface.toFixed(2)}, boat ${(l.y - surface).toFixed(2)} from surface`}; velocity ${vel}`);
    // The laws' last tick: the drive's ledger and the body it's summed from (see laws.js, body.js).
    const st = steerTest.state.get(e.id);
    if (st?.ledger) {
      const L = st.ledger, f = (v) => (v >= 0 ? "+" : "") + v.toFixed(4);
      say(`  drive: speed ${st.speed.toFixed(3)} = oars ${f(L.oars)} sail ${f(L.sail)} drag ${f(L.drag)} ground ${f(L.ground)}; heel ${(st.heel ?? 0).toFixed(1)} (rate ${(st.heelRate ?? 0).toFixed(2)}); wake ${(st.wake ?? 0).toFixed(3)}`);
    }
    if (st?.stats?.body) {
      const B = st.stats.body;
      say(`  body: mass ${B.mass.toFixed(2)} = ${B.parts.map((p) => `${p.name} ${p.mass.toFixed(2)}`).join(" + ")}; centre of mass ${B.comUp.toFixed(2)} of depth; righting ${B.righting.toFixed(2)}`);
    }
  }
  for (const m of lines) console.warn(m);
  for (const m of lines) player.sendMessage(`§7${m}`);
}

/** Calibrate where riders sit: switches every launched boat's seats to low, mid or high. */
function setSeatHeight(player, h) {
  if (!SEAT_HEIGHTS.includes(h)) {
    player.sendMessage(`§eSeat height is ${seatHeight()}. Use /scriptevent shipwright:seat low, mid or high.`);
    return;
  }
  world.setDynamicProperty("shipwright:seat", h);
  let n = 0;
  for (const id of DIMENSIONS) {
    try {
      for (const e of world.getDimension(id).getEntities({ families: ["shipwright_boat"] })) {
        if (!e.getComponent("minecraft:rideable")) continue;
        const rec = readRecord(e);
        if (rec) e.triggerEvent(seatEvent(rec, h));
        n++;
      }
    } catch {
      /* dimension not loaded */
    }
  }
  player.sendMessage(`§aSeats set to ${h} on ${n} boat${n === 1 ? "" : "s"}. Re-board to see it.`);
}

export function registerDevtools() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (!ev.id.startsWith("shipwright:")) return;
    const player = playerFrom(ev);
    if (!player) {
      console.warn("[Shipwright test] Needs a player in the world; join first, then run the command.");
      return;
    }
    const run = (fn) => Promise.resolve(fn(player)).catch((e) => console.warn(`[Shipwright test] Crashed: ${e}`));
    if (ev.id === "shipwright:selftest") run(selftest);
    else if (ev.id === "shipwright:showcase") run(showcase);
    else if (ev.id === "shipwright:cleanup") run(cleanup);
    else if (ev.id === "shipwright:inspect") run(inspect);
    else if (ev.id === "shipwright:seat") run(() => setSeatHeight(player, (ev.message ?? "").trim()));
    else if (ev.id === "shipwright:shieldpose") {
      // Calibrate how a hung shield sits: /scriptevent shipwright:shieldpose <pose 0-63> [lift] [out]
      const [pose, lift, out] = (ev.message ?? "").trim().split(/\s+/).map(Number);
      const cur = shieldPose();
      const next = {
        pose: Number.isFinite(pose) ? Math.max(0, Math.min(63, Math.round(pose))) : cur.pose,
        lift: Number.isFinite(lift) ? Math.max(-1, Math.min(1, lift)) : cur.lift,
        out: Number.isFinite(out) ? Math.max(-1, Math.min(1, out)) : cur.out,
      };
      setShieldPose(next);
      let n = 0;
      for (const p of player.dimension.getEntities({ type: PEG })) {
        try {
          p.setProperty("shipwright:pose", next.pose);
          p.setProperty("shipwright:lift", next.lift);
          p.setProperty("shipwright:out", next.out);
          n++;
        } catch {
          /* skip */
        }
      }
      player.sendMessage(`§aShield pose ${next.pose}, lift ${next.lift}, out ${next.out} (${n} pegs updated).`);
    } else if (ev.id === "shipwright:facesync") {
      // Fallback if keeping the game's facing in step with the heading misbehaves in game.
      const v = (ev.message ?? "").trim() === "off" ? "off" : "on";
      world.setDynamicProperty("shipwright:facesync", v);
      player?.sendMessage?.(`§aFacing sync ${v}.`);
    }
  });
}
