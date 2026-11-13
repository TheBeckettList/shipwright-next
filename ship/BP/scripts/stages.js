// Build-stage state changes with no UI and no costs. The table menus call
// these after taking materials; the self-tests call them directly.
import { setP, getP } from "./props.js";
import { seatEvent } from "./ship.js";
import { world } from "@minecraft/server";
import { STAGES, ZONES } from "./config/plans.js";
import { DIRS, MODEL_YAW_OFFSET } from "./config/yards.js";
import { buildLocation, launchLocation } from "./yard.js";
import { readRecord, writeRecord, newRecord, applyRecord, LAUNCHED_TAG, helmAt, hullSpan, BUILD_YAW } from "./ship.js";
import { syncOrientation } from "./orientation.js";

export const yawFor = (yard) => DIRS[yard.dirName].yaw + MODEL_YAW_OFFSET;

export function layKeel(yard, plan, length) {
  const rec = newRecord(plan, yard.key, length);
  // The yard gives where the hull's centre goes (by the hull's real length, stern at the yard's head);
  // the entity's origin is its helm, aft of that.
  const entity = yard.dimension.spawnEntity(plan.entity, helmAt(buildLocation(yard, length, hullSpan(rec).half), yard.dir, rec));
  try {
    entity.setRotation({ x: 0, y: yawFor(yard) });
    entity.setDynamicProperty(BUILD_YAW, yawFor(yard));       // held there until she's launched (buoyancy.js)
  } catch {
    /* rotation is cosmetic while building */
  }
  writeRecord(entity, rec);
  applyRecord(entity, rec);
  syncOrientation(entity);
  try {
    setP(entity, "yaw", yawFor(yard)); // starting heading: facing the water
    setP(entity, "sail_set", true);
    setP(entity, "wind_rel", 0.0);
    setP(entity, "wind_str", 0.0);
    setP(entity, "rudder", 0.0);
    setP(entity, "sail_fill", 0.0);
    setP(entity, "heel", 0.0);
    setP(entity, "rowing", 0.0);
    setP(entity, "furnace_lit", false);
    setP(entity, "power_type", 0);
    setP(entity, "mods", 0);
    setP(entity, "deck", 0);
    setP(entity, "rudder_type", 0);
    for (const k of ["stroke_l", "stroke_r", "turn", "telltale"]) setP(entity, k, 0.0);
  } catch {
    /* property not available */
  }
  return entity;
}

function save(entity, rec) {
  writeRecord(entity, rec);
  applyRecord(entity, rec);
  return rec;
}

export function raiseFrames(entity, beam, depth) {
  const rec = readRecord(entity);
  rec.dims.beam = beam;
  rec.dims.depth = depth;
  rec.stage = STAGES.FRAMES;
  return save(entity, rec);
}

/** woodByZone: { bow, mid, stern } wood keys */
export function plankHull(entity, woodByZone) {
  const rec = readRecord(entity);
  for (const z of ZONES) rec.sections[z] = { mat: woodByZone[z], original: true };
  rec.stage = STAGES.PLANKED;
  return save(entity, rec);
}

export function rig(entity, sail, color) {
  const rec = readRecord(entity);
  rec.sections.rig = { ...rec.sections.rig, sail: !!sail, color, original: true };
  rec.stage = STAGES.RIGGED;
  return save(entity, rec);
}

export function launch(entity, yard, name) {
  const rec = readRecord(entity);
  rec.name = name;
  rec.stage = STAGES.LAUNCHED;
  rec.launchedDay = world.getDay();
  save(entity, rec);
  entity.nameTag = name;
  entity.triggerEvent("shipwright:launch");
  entity.triggerEvent(seatEvent(readRecord(entity)));
  entity.addTag(LAUNCHED_TAG);
  entity.teleport(helmAt(launchLocation(yard, rec.dims.length), yard.dir, rec), { rotation: { x: 0, y: yawFor(yard) } });
  return rec;
}
