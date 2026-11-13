import { warnOnce } from "./warn.js";
import { world, system } from "@minecraft/server";
import { readRecord, writeRecord, updateShipLocation, healProperties, ensureLaunchedState } from "./ship.js";
import { STAGES } from "./config/plans.js";

const INTERVAL = 100; // ticks (5 seconds)
import { DIMENSIONS } from "./dims.js";
const lastPos = new Map(); // entity id -> location

function ridden(entity) {
  try {
    const rideable = entity.getComponent("minecraft:rideable");
    return !!rideable && rideable.getRiders().length > 0;
  } catch {
    return false;
  }
}

export function tick() {
  for (const id of DIMENSIONS) {
    let boats = [];
    try {
      boats = world.getDimension(id).getEntities({ families: ["shipwright_boat"] });
    } catch {
      continue;
    }
    for (const e of boats) {
      try {
        logBoat(e);
      } catch (err) {
        warnOnce(`log:${e.id}`, `[Shipwright] Logbook for a boat failed (it carries on): ${err}`);
      }
    }
  }
}


function logBoat(e) {
  updateShipLocation(e);
  if (healProperties(e)) console.warn(`[Shipwright] Restored properties on ${e.nameTag || "a boat"}.`);
  if (ensureLaunchedState(e)) console.warn(`[Shipwright] Restored seats on ${e.nameTag || "a boat"}.`);
  if (!ridden(e)) {
    lastPos.delete(e.id);
    return;
  }
  const now = e.location;
  const prev = lastPos.get(e.id);
  lastPos.set(e.id, now);
  if (!prev) return;
  const dist = Math.hypot(now.x - prev.x, now.z - prev.z);
  if (dist < 0.5) return;
  const rec = readRecord(e);
  if (!rec || rec.stage !== STAGES.LAUNCHED) return;
  rec.log.distance += dist;
  writeRecord(e, rec); // one write per ridden boat per interval
}

export function startLogbook() {
  system.runTimeout(tick, 20); // repair boats shortly after startup
  system.runInterval(tick, INTERVAL);
}
