// Mounted shields: real Minecraft shields on a shield rail, one each side of every hull section.
//
// A shield hangs on a peg: a small invisible entity holding the shield item, placed on the hull's
// side through the ship's frame (its place is a projection of the ship's state, recomputed from the
// ship, never stored). Like Norse crews, shields hang on the rail while the ship is moored,
// anchored, tied up, beached or lying still, and are stowed aboard under way. Use a hung shield to
// take it; use an empty peg with a shield in hand to hang it.
//
// State: rec.shields, one true or false per peg slot (whether a shield is aboard for it).
// Projection: the pegs, spawned while moored and removed under way.

import { world } from "@minecraft/server";
import { PLANS } from "./config/plans.js";
import { PROPORTIONS } from "./config/proportions.js";
import { ShipFrame } from "./frame.js";
import { warnOnce } from "./warn.js";

export const PEG = "shipwright:shield_peg";
const SHIELD = "minecraft:shield";
const POSE_KEY = "shipwright:shieldpose";
const tagFor = (boatId) => `sw_peg_${boatId}`;

/** Peg slots along a hull: one each side of every mid section, from the helm forward. */
export function pegSlots(rec, plan = PLANS[rec.plan]) {
  const scale = plan.modelScale ?? 1;
  const mids = Math.max(1, Math.min(plan.maxMids ?? 7, Math.round(rec.dims.length / scale - 3)));
  const half = (plan.baseBeam * rec.dims.beam) / 2;
  const pr = PROPORTIONS[plan.id] ?? {};
  const twin = plan.twin ? ((pr.twin_gap ?? 0) * scale) / 2 : 0;    // twin hulls: on the outer sides
  const up = (pr.depth ?? 0.7) * (1 + (scale - 1) * 0.4) * rec.dims.depth * 0.7;
  const out = [];
  for (let i = 0; i < mids; i++) {
    // over the middle of each mid section: the stern section ends a block (scaled) forward of the helm
    for (const side of [1, -1]) out.push({ slot: out.length, i, side, along: (i + 1.5) * scale, across: side * (twin + half + 0.06), up });   // vision: a shield's thickness off the planking
  }
  return out;
}

/** The world's calibrated shield pose (orientation 0..63, lift and outward nudge in blocks). */
export function shieldPose() {
  try {
    const raw = world.getDynamicProperty(POSE_KEY);
    if (raw) return { pose: 0, lift: 0, out: 0, ...JSON.parse(raw) };
  } catch {
    /* default */
  }
  return { pose: 0, lift: 0, out: 0 };
}
export function setShieldPose(p) {
  world.setDynamicProperty(POSE_KEY, JSON.stringify(p));
}

/** Pegs currently hung for a boat. */
export function pegsOf(boat) {
  try {
    return boat.dimension.getEntities({ type: PEG, tags: [tagFor(boat.id)] });
  } catch {
    return [];
  }
}

const show = (peg, held) => {
  try {
    peg.setProperty("shipwright:held", !!held);                // the peg draws the shield itself, flat on the hull's side
  } catch (err) {
    warnOnce("peg-item", `[Shipwright] Couldn't put a shield on its peg: ${err}`);
  }
  try {
    peg.setDynamicProperty("held", !!held);
  } catch {
    /* mocks */
  }
};

/**
 * Projection: hangs (or moves) the pegs for a moored boat, or clears them under way. Called a few
 * times a second by the steering. moored: whether the ship is at rest; heading: its heading.
 */
export function manageShields(boat, rec, heading, h, moored) {
  const pegs = pegsOf(boat);
  const fitted = rec?.stage === 5 && (rec.modules ?? []).includes("shield_rail");
  if (!fitted || !moored) {
    for (const p of pegs) p.remove();
    return 0;
  }
  const slots = pegSlots(rec);
  rec.shields = (rec.shields ?? []).slice(0, slots.length);
  const F = new ShipFrame(boat.location, heading, h);
  const pose = shieldPose();
  const bySlot = new Map(pegs.map((p) => [p.getDynamicProperty("slot"), p]));
  for (const s of slots) {
    const at = F.toWorld(s.along, s.across, s.up);
    const face = heading + (s.side > 0 ? 90 : -90);                       // looking outward from the hull
    let peg = bySlot.get(s.slot);
    if (!peg) {
      try {
        peg = boat.dimension.spawnEntity(PEG, at);
        peg.addTag(tagFor(boat.id));
        peg.setDynamicProperty("slot", s.slot);
        peg.setDynamicProperty("boat", boat.id);
        peg.setRotation({ x: 0, y: face });
        peg.setProperty("shipwright:pose", pose.pose);
        peg.setProperty("shipwright:lift", pose.lift);
        peg.setProperty("shipwright:out", pose.out);
        show(peg, !!rec.shields[s.slot]);
      } catch (err) {
        warnOnce("peg-spawn", `[Shipwright] Couldn't hang a shield peg: ${err}`);
        continue;
      }
    } else if (Math.hypot(peg.location.x - at.x, peg.location.z - at.z) > 0.05 || Math.abs(peg.location.y - at.y) > 0.05) {
      peg.teleport(at, { rotation: { x: 0, y: face } });                  // the moored ship swung: follow
    }
    bySlot.delete(s.slot);
  }
  for (const extra of bySlot.values()) extra.remove();                   // a shorter hull than before
  return slots.length;
}

/**
 * When the shields hang (law). They stay on the rail at rest and under oars; they're stowed only
 * under sail, once she's been drawing steadily for a couple of seconds (so a puff of wind doesn't
 * flick them in and out), and go back up a second after the sail stops drawing.
 */
export const STOW_AFTER = 40, HANG_AFTER = 20;
export function shieldsLaw(prev, underSail) {
  const t = underSail ? Math.min(STOW_AFTER, Math.max(0, prev?.t ?? 0) + 1) : Math.max(-HANG_AFTER, Math.min(0, prev?.t ?? 0) - 1);
  const stowed = prev?.stowed ? t > -HANG_AFTER : t >= STOW_AFTER;
  return { t, stowed };
}

/** Using a peg: take its shield, or hang the one in your hand. Returns a message, or "". */
export function usePeg(peg, player, boat, readRecord, writeRecord) {
  const rec = boat && readRecord(boat);
  if (!rec) return "";
  const slot = peg.getDynamicProperty("slot");
  rec.shields = rec.shields ?? [];
  const inv = player.getComponent("minecraft:inventory")?.container;
  const sel = player.selectedSlotIndex ?? 0;
  const inHand = inv?.getItem(sel);
  if (rec.shields[slot]) {
    rec.shields[slot] = false;
    writeRecord(boat, rec);
    show(peg, false);
    const left = inv?.addItem(new ItemStackLike(SHIELD, 1));
    if (left) player.dimension.spawnItem(left, player.location);
    return "You take the shield down.";
  }
  if (inHand?.typeId === SHIELD) {
    if (inHand.amount > 1) { inHand.amount -= 1; inv.setItem(sel, inHand); } else inv.setItem(sel, undefined);
    rec.shields[slot] = true;
    writeRecord(boat, rec);
    show(peg, true);
    return "You hang your shield on the rail.";
  }
  return "Hold a shield to hang it here.";
}

// ItemStack comes from the game; tests swap in their own.
let ItemStackLike = class { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } };
export function useItemStack(cls) { ItemStackLike = cls; }

/** Shields aboard (hung or stowed), for refunds when the rail comes off or the ship is broken. */
export const shieldsAboard = (rec) => (rec?.shields ?? []).filter(Boolean).length;

/** Fitting the rail: hang shields from the player's inventory on as many pegs as they cover. */
export function stockShields(rec, available) {
  const slots = pegSlots(rec).length;
  rec.shields = Array.from({ length: slots }, (_, i) => i < available);
  return Math.min(slots, available);
}
