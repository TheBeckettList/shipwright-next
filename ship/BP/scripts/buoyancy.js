import { warnOnce } from "./warn.js";
// Safety net for floating. The faering's minecraft:buoyant component keeps it
// on the surface; this acts only when a launched boat is clearly underwater
// (more than half a block below the real water surface, for several checks in
// a row), so it never fights normal floating.
//   Ridden boats get one gentle push up (teleporting would unseat riders).
//   Unridden boats are lifted straight to the surface.
// Toggle with /scriptevent shipwright:float on|off|status (or `bash dev/dev.sh float off`).
import { world, system } from "@minecraft/server";
import { WATER } from "./config/yards.js";
import { syncOrientation, getMode } from "./orientation.js";
import { LAUNCHED_TAG, BUILD_YAW } from "./ship.js";
import { getP as getProp, setP as setProp } from "./props.js";

const INTERVAL = 2;          // ticks; orientation updates ride along
const SUNK_DEPTH = 0.6;      // blocks below the surface before it counts as sunk
const SUNK_CHECKS = 5;       // consecutive checks (10 ticks) before acting
const PUSH = 0.08;
// Bedrock's buoyancy is an undamped spring: it overshoots the waterline both ways forever. A push
// against vertical motion settles it without moving where the boat floats (damping only acts on motion).
const DAMPING = 0.65;        // share of vertical speed removed per check
const STILL = 0.004;         // below this vertical speed, leave it alone
const KEY = "shipwright:float_assist";
import { DIMENSIONS } from "./dims.js";
const isWater = (b) => !!b && WATER.has(b.typeId);
const sunkCount = new Map();
const lastLog = new Map();

function blockAt(dim, x, y, z) {
  try {
    return dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
  } catch {
    return undefined;
  }
}

function riders(e) {
  try {
    return e.getComponent("minecraft:rideable")?.getRiders() ?? [];
  } catch {
    return [];
  }
}

export function assistEnabled() {
  try {
    return world.getDynamicProperty(KEY) !== false;
  } catch {
    return true;
  }
}

/** Height of the water surface above the boat, or null if it isn't in water. */
export function waterSurface(dim, x, y, z) {
  let top = Math.floor(y);
  if (!isWater(blockAt(dim, x, top, z))) return null;
  for (let k = 0; k < 16 && isWater(blockAt(dim, x, top + 1, z)); k++) top++;
  return top + 0.9; // a full water block's surface sits just under its top
}

function log(e, what) {
  const now = Date.now();
  if (now - (lastLog.get(e.id) ?? 0) < 10000) return;
  lastLog.set(e.id, now);
  console.warn(`[Shipwright] Float assist ${what} ${e.nameTag || "a boat"}.`);
}

/** Settles a floating boat's bob. Returns true if it damped any motion. */
export function settleBob(e) {
  const { x, y, z } = e.location;
  if (waterSurface(e.dimension, x, y, z) === null) return false;   // only afloat, never on land or falling
  let vy = 0;
  try {
    vy = e.getVelocity().y;
  } catch {
    return false;
  }
  if (Math.abs(vy) < STILL) return false;
  try {
    e.applyImpulse({ x: 0, y: -vy * DAMPING, z: 0 });
    return true;
  } catch {
    return false;
  }
}

/** Returns "pushed", "lifted", or "" if the boat was fine. */
export function keepAfloat(e) {
  const { x, y, z } = e.location;
  const surface = waterSurface(e.dimension, x, y, z);
  if (surface === null || y > surface - SUNK_DEPTH) {
    sunkCount.delete(e.id);
    return "";
  }
  const n = (sunkCount.get(e.id) ?? 0) + 1;
  sunkCount.set(e.id, n);
  if (n < SUNK_CHECKS) return "";
  sunkCount.delete(e.id);
  if (riders(e).length > 0) {
    try {
      e.applyImpulse({ x: 0, y: PUSH, z: 0 });
      log(e, "pushed up");
      return "pushed";
    } catch {
      return "";
    }
  }
  try {
    e.teleport({ x, y: surface - 0.1, z });
    log(e, "lifted");
    return "lifted";
  } catch {
    return "";
  }
}

function tick() {
  const mode = getMode();
  const assist = assistEnabled();
  for (const id of DIMENSIONS) {
    let boats = [];
    try {
      boats = world.getDimension(id).getEntities({ families: ["shipwright_boat"] });
    } catch {
      continue;
    }
    for (const e of boats) {
      try {
        // Only launched boats are rideable; boats under construction sit on land, held square
        // to their yard: neither the engine nor a rider may turn them (the model shows the
        // heading less the body's turn, so both are pinned together)
        if (!e.hasTag(LAUNCHED_TAG)) holdOnStocks(e);
        if (!e.hasTag(LAUNCHED_TAG) && !e.getComponent("minecraft:rideable")) continue;
        syncOrientation(e, mode);
        settleBob(e);
        if (assist) keepAfloat(e);
      } catch (err) {
        warnOnce(`float:${e.id}`, `[Shipwright] Floating a boat failed (it carries on next tick): ${err}`);
      }
    }
  }
}

/** Pins a boat under construction to the heading she was laid down on. */
export function holdOnStocks(e) {
  let yaw = e.getDynamicProperty(BUILD_YAW);
  if (typeof yaw !== "number") {                       // laid down before 0.24: hold her where she points now
    yaw = getProp(e, "yaw");
    if (typeof yaw !== "number") return;
    e.setDynamicProperty(BUILD_YAW, yaw);
  }
  const r = e.getRotation?.()?.y ?? yaw;
  const off = ((((r - yaw) % 360) + 540) % 360) - 180;   // given: degrees round
  if (Math.abs(off) > 0.5) e.setRotation({ x: 0, y: yaw });   // vision: half a degree
  if (getProp(e, "yaw") !== yaw) setProp(e, "yaw", yaw);
}

export function startBuoyancy() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "shipwright:float") return;
    const arg = String(ev.message ?? "").trim().toLowerCase();
    if (arg === "on" || arg === "off") world.setDynamicProperty(KEY, arg === "on");
    const msg = `[Shipwright] Float assist is ${assistEnabled() ? "on" : "off"}.`;
    console.warn(msg);
    for (const p of world.getAllPlayers()) p.sendMessage(`§e${msg}`);
  });
  system.runInterval(tick, INTERVAL);
}
