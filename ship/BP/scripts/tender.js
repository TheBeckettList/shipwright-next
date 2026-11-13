// Ship's boats: a great ship carries her small boats with her, the way each tradition did.
//
//   in tow      any small boat, on a line astern (two at most, one behind the other): Norse
//               ships towed a faering, Pacific voyagers a canoe, everyone a boat in fair weather
//   on deck     a small boat that fits her deck, on chocks amidships (carracks, junks, dhows)
//   astern      a small boat hoisted up across her stern, clear of the water
//
// Bring a small boat alongside on a lead (lead her as you would an animal), then use the great
// ship: she offers to take her in tow, hoist her on deck, or hoist her astern. Use the ship with a
// lead again to put a boat over the side, or cast off a tow.
//
// State: the great ship's record lists the boats she carries (each with its own record, whole);
// a boat in tow keeps its own entity and record, with "towedBy" on it. Projection: the towed boat's
// velocity and heading each tick (law: towLaw), and a carried-boat skin on the ship's model.
import { world, system } from "@minecraft/server";
import { PLANS } from "./config/plans.js";
import { readRecord, writeRecord, applyRecord, seaChest, LAUNCHED_TAG } from "./ship.js";
import { ShipFrame, forwardOf } from "./frame.js";
import { setP } from "./props.js";
import { warnOnce } from "./warn.js";

const TOWED_BY = "shipwright:towedBy";
const TOW_INDEX = "shipwright:towIndex";
export const MAX_TOW = 2;
const LINE = 2.5;                   // blocks of line between a stern and the boat behind it

/** Which ways a great ship can take this small boat (pure). bigH, smallH: handling. */
export function stowageFor(bigPlan, bigH, bigRec, smallPlan, smallRec, smallH) {
  const out = [];
  if ((bigPlan.modelScale ?? 1) < 4 || (smallPlan.yardLevel ?? 1) !== 1) return out;
  const carried = bigRec.boats ?? [];
  const towed = bigRec.towing ?? 0;
  if (towed < MAX_TOW) out.push("tow");
  // On deck: a boat no longer than a third of her, narrower than her beam, on a decked ship.
  const deckFree = !carried.some((b) => b.mode === "deck");
  if (deckFree && (bigH.decks ?? 1) >= 2 && smallH.length <= bigH.length / 3 && smallH.beam <= bigH.beam - 1) out.push("deck");
  // Astern: hoisted across her stern, a boat no longer than her beam and a half.
  const sternFree = !carried.some((b) => b.mode === "stern");
  if (sternFree && smallH.length <= bigH.beam * 1.5 + 0.5) out.push("stern");
  return out;
}

/**
 * Towing (law): where a towed boat should be and how it moves there. lead: the point it's towed
 * from (the ship's stern, or the boat ahead's stern), with that leader's heading. The boat steers
 * for the lead point and closes on a spot a line's length behind it, like a boat on a painter: a
 * spring on the line (only when it's taut), its own water drag, and it never runs into the leader.
 */
export function towLaw({ pos, vel, heading }, { lead, leadHeading, smallHalf }) {
  const f = forwardOf(leadHeading);
  const spot = { x: lead.x - f.x * (LINE + smallHalf), z: lead.z - f.z * (LINE + smallHalf) };
  const dx = spot.x - pos.x, dz = spot.z - pos.z;
  const dist = Math.hypot(lead.x - pos.x, lead.z - pos.z);
  const taut = dist > LINE + smallHalf - 0.3;
  const k = taut ? 0.12 : 0.03, damp = 0.25;
  let vx = vel.x + dx * k - vel.x * damp, vz = vel.z + dz * k - vel.z * damp;
  const m = Math.hypot(vx, vz), cap = 0.9;
  if (m > cap) { vx *= cap / m; vz *= cap / m; }
  // Heading: the boat lies along the line, its bow toward the lead point.
  const want = (Math.atan2(-(lead.x - pos.x), lead.z - pos.z) * 180) / Math.PI;
  let d = ((want - heading + 540) % 360) - 180;
  const turned = heading + Math.max(-6, Math.min(6, d * 0.3));
  return { vel: { x: vx, z: vz }, heading: turned, parted: dist > 40 };
}

// ---------------------------------------------------------------- the game side

const boatsOf = (dim) => {
  try {
    return dim.getEntities({ families: ["shipwright_boat"] });
  } catch {
    return [];
  }
};
const byId = (dim, id) => boatsOf(dim).find((b) => b.id === id) ?? null;

/** Boats a ship has in tow, in order. */
export function towOf(ship) {
  return boatsOf(ship.dimension).filter((b) => b.getDynamicProperty(TOWED_BY) === ship.id)
    .sort((a, b) => (a.getDynamicProperty(TOW_INDEX) ?? 0) - (b.getDynamicProperty(TOW_INDEX) ?? 0));
}

/** Takes a small boat in tow. */
export function takeInTow(ship, boat) {
  const rec = readRecord(ship);
  const n = towOf(ship).length;
  if (n >= MAX_TOW) return "She already has two boats in tow.";
  boat.setDynamicProperty(TOWED_BY, ship.id);
  boat.setDynamicProperty(TOW_INDEX, n);
  rec.towing = n + 1;
  writeRecord(ship, rec);
  return `${readRecord(boat)?.name || "The boat"} is in tow.`;
}

export function castOff(ship, boat) {
  boat.setDynamicProperty(TOWED_BY, undefined);
  boat.setDynamicProperty(TOW_INDEX, undefined);
  const rec = readRecord(ship);
  rec.towing = towOf(ship).length;
  writeRecord(ship, rec);
  return `${readRecord(boat)?.name || "The boat"} is cast off.`;
}

/** Hoists a small boat aboard (deck or stern): its record goes into the ship's; the boat itself is taken up. */
export function hoist(ship, boat, mode) {
  const chest = seaChest(boat);
  if (chest) for (let i = 0; i < chest.size; i++) if (chest.getItem(i)) return "Empty her sea chest first.";
  if ((boat.getComponent("minecraft:rideable")?.getRiders() ?? []).length) return "Everyone out of her first.";
  const rec = readRecord(ship);
  const small = readRecord(boat);
  if (!rec || !small) return "";
  rec.boats = [...(rec.boats ?? []), { mode, typeId: boat.typeId, rec: small }];
  writeRecord(ship, rec);
  applyRecord(ship, rec);
  boat.remove();
  return `${small.name || "The boat"} is hoisted ${mode === "deck" ? "aboard onto her chocks" : "up across the stern"}.`;
}

/** Puts a carried boat over the side, alongside, in the water. */
export function putOverSide(ship, index, heading) {
  const rec = readRecord(ship);
  const b = rec?.boats?.[index];
  if (!b) return null;
  const h = computeOf(ship);
  const F = new ShipFrame(ship.location, heading, h);
  const out = (h?.overallHalfWidth ?? 3) + 1.5;
  const at = b.mode === "stern" ? F.fromCentre(-(h.half + 3), 0) : F.fromCentre(0, out);
  const e = ship.dimension.spawnEntity(b.typeId, { x: at.x, y: Math.floor(ship.location.y) + 0.6, z: at.z });
  writeRecord(e, b.rec);
  e.addTag(LAUNCHED_TAG);
  applyRecord(e, b.rec);
  try {
    e.triggerEvent("shipwright:launch");
    setP(e, "yaw", heading);
  } catch {
    /* fine */
  }
  rec.boats.splice(index, 1);
  writeRecord(ship, rec);
  applyRecord(ship, rec);
  return e;
}

// The ship's handling is the steering's; it hands it to us so this file doesn't depend on steering.
let computeOf = () => null;
export function useHandling(fn) { computeOf = fn; }

/**
 * One tick of towing for a boat: follows its leader (the ship, or the boat ahead in the line).
 * Returns true if this boat is in tow (so the steering leaves it alone).
 */
export function towTick(e, s, stateOf) {
  const shipId = e.getDynamicProperty(TOWED_BY);
  if (!shipId) return false;
  const ship = byId(e.dimension, shipId);
  if (!ship) { e.setDynamicProperty(TOWED_BY, undefined); return false; }
  const idx = e.getDynamicProperty(TOW_INDEX) ?? 0;
  const ss = stateOf(ship);
  if (!ss?.stats || !s.stats) return true;
  let lead, leadHeading;
  if (idx === 0) {
    lead = new ShipFrame(ship.location, ss.heading, ss.stats).fromCentre(-ss.stats.half, 0);
    leadHeading = ss.heading;
  } else {
    const ahead = towOf(ship)[idx - 1];
    if (!ahead) return true;
    const sa = stateOf(ahead);
    lead = new ShipFrame(ahead.location, sa.heading, sa.stats).fromCentre(-sa.stats.half, 0);
    leadHeading = sa.heading;
  }
  // the towed boat is moved by its centre, which lies ahead of its origin (helm)
  const c = new ShipFrame(e.location, s.heading, s.stats).centre();
  let vel = { x: 0, z: 0 };
  try {
    const v = e.getVelocity();
    vel = { x: v.x, z: v.z };
  } catch {
    /* none */
  }
  const r = towLaw({ pos: c, vel, heading: s.heading }, { lead, leadHeading, smallHalf: s.stats.half });
  if (r.parted) {
    castOff(ship, e);
    return false;
  }
  s.heading = r.heading;
  s.speed = Math.hypot(r.vel.x, r.vel.z);
  s.anchor = null;
  try {
    const v = e.getVelocity();
    e.applyImpulse({ x: r.vel.x - v.x, y: 0, z: r.vel.z - v.z });
    setP(e, "yaw", Math.round(s.heading * 10) / 10);
  } catch (err) {
    warnOnce(`tow:${e.id}`, `[Shipwright] Tow: ${err}`);
  }
  return true;
}

/** The menu a great ship offers when used with a lead (or with a small boat on your lead). */
export function tenderOptions(ship, player) {
  const rec = readRecord(ship);
  const plan = rec && PLANS[rec.plan];
  if (!plan || (plan.modelScale ?? 1) < 4 || rec.stage < 5) return [];
  const opts = [];
  const h = computeOf(ship);
  // a small boat on the player's lead, near the ship
  for (const b of boatsOf(ship.dimension)) {
    if (b.id === ship.id) continue;
    let led = false;
    try {
      led = b.getComponent("minecraft:leashable")?.leashHolder?.id === player.id;
    } catch {
      led = false;
    }
    if (!led) continue;
    const sr = readRecord(b);
    const sp = sr && PLANS[sr.plan];
    if (!sp) continue;
    for (const mode of stowageFor(plan, h, rec, sp, sr, computeOf(b))) opts.push({ kind: mode, boat: b, label: { tow: `Take ${sr.name || sp.name} in tow`, deck: `Hoist ${sr.name || sp.name} on deck`, stern: `Hoist ${sr.name || sp.name} up astern` }[mode] });
  }
  (rec.boats ?? []).forEach((b, i) => opts.push({ kind: "launch", index: i, label: `Put ${b.rec.name || PLANS[b.rec.plan]?.name || "the boat"} over the side` }));
  for (const b of towOf(ship)) opts.push({ kind: "cast", boat: b, label: `Cast off ${readRecord(b)?.name || "the boat in tow"}` });
  return opts;
}

/** Carries out one of tenderOptions' choices. Returns a message. */
export function doTender(ship, player, opt, heading) {
  const unleash = (b) => {
    try {
      b.getComponent("minecraft:leashable")?.unleash();
    } catch {
      /* not leashed */
    }
  };
  if (opt.kind === "tow") { unleash(opt.boat); return takeInTow(ship, opt.boat); }
  if (opt.kind === "deck" || opt.kind === "stern") { unleash(opt.boat); return hoist(ship, opt.boat, opt.kind); }
  if (opt.kind === "cast") return castOff(ship, opt.boat);
  if (opt.kind === "launch") {
    const e = putOverSide(ship, opt.index, heading);
    return e ? "Over the side she goes." : "";
  }
  return "";
}
