import { warnOnce } from "./warn.js";
// Script-driven sailing. The helmsman's stick sets throttle (forward/back) and
// turning (left/right). The script owns the heading: it never rotates the entity
// (the engine and rider fight that); it writes the heading to shipwright:yaw,
// which the model shows, and pushes the boat along the bow.
//
// Controls: stick forward/back rows, left/right steers, jump raises or lowers the sail.
// Calibration: /scriptevent shipwright:orient 0-3   model turn direction and bow flip.
//              /scriptevent shipwright:steer flip    swaps left/right on the stick.
import { setP, getP } from "./props.js";
import { world, system } from "@minecraft/server";
import { WATER } from "./config/yards.js";
import { readRecord, writeRecord, LAUNCHED_TAG, seaChest, chestLoad } from "./ship.js";
import { countItems, consumeCosts, isCreative } from "./inventory.js";
import { POWER, FUELS } from "./config/power.js";
import { loadChest, unloadChest, returnAbsentChests } from "./chest.js";
import { layDeck, liftDeck, deckOf, DECK_MIN_LENGTH, boardWalkers, carryWalkers, dropWalker } from "./deck.js";
import { computeHandling, turnRateAt, KNOTS_TO_BPT } from "./handling.js";
import { exposureAt, localWind } from "./wind.js";
import { windAt as windAtRaw, angleOffWind, sailPower, describeWind, telltale } from "./wind.js";
import { forwardOf, ShipFrame } from "./frame.js";
import { manageShields, shieldsLaw, PEG } from "./shields.js";
import { towTick, castOff, useHandling } from "./tender.js";
import { turnDrag, oarsInLaw } from "./laws.js";
import { sailLaw, driveLaw, heelLaw, heelTarget, rollPeriod, driftLaw, wakeLaw } from "./laws.js";

const SIGN_KEY = "shipwright:steer_sign";
import { DIMENSIONS } from "./dims.js";
const isWater = (b) => !!b && WATER.has(b.typeId);

function timeOfDay() {
  try {
    return world.getTimeOfDay();
  } catch {
    return 6000;
  }
}
/** Wind here and now, with gusts and the day/night sea breeze. */
// The wind a boat feels: the weather's cell wind, sheltered or freshened by what's around her.
const windAt = (dim, loc, s = null) => localWind(windAtRaw(dim, loc, system.currentTick ?? 0, timeOfDay()), s?.exposure, system.currentTick ?? 0);
/** Refreshes how open the water is around a boat (every couple of seconds; it changes slowly). */
function updateExposure(e, s) {
  const t = system.currentTick ?? 0;
  if (s.exposure && t - (s.exposureAt ?? -1e9) < 40) return;
  s.exposureAt = t;
  try {
    s.exposure = exposureAt(e.dimension, e.location);
  } catch {
    /* keep the last */
  }
}

/** Sets a client-synced property only when it has changed by more than a step. */
function setProp(e, s, key, value, step) {
  const k = `_${key}`;
  if (s[k] !== undefined && Math.abs(value - s[k]) < step && !(value === 0 && s[k] !== 0)) return;
  try {
    setP(e, key, value);
    s[k] = value;
  } catch {
    /* visual only */
  }
}
const state = new Map(); // entity id -> { heading, speed, stats, statsAt }

const BEACHED_DRAG = 0.5;     // per tick out of water
const AGROUND_MAX = 0.03;     // crawl speed when the water is shallower than the draft
const SMOOTHING = 0.5;        // how hard velocity is pulled toward the target each tick
const ANCHOR_HOLD = 15;       // ticks of holding jump to drop or raise the anchor
// The anchor slot: every boat has one. Holding = the wind strength it holds against before dragging.
export const ANCHORS = {
  stone: { name: "Stone anchor", holding: 1.0 },
  iron: { name: "Iron anchor", holding: 1.6 },
};
const DRAG_RATE = 0.02;       // blocks per tick of drift per unit of wind over the anchor's holding
const MESSAGE_TICKS = 60;     // how long a one-off message stays up
// Energy. Holding a speed against drag takes power rising with the cube of speed; the sail pays
// for whatever speed the wind gives, and you pay the rest. Effort 1 = rowing flat out with no help.
// 4 exhaustion = 1 hunger point (vanilla).
const ROW_EXHAUSTION = 0.005; // per tick at effort 1: about a hunger point every 40 seconds
const ACCEL_EFFORT = 0.35;    // extra effort while still picking up speed
const SAIL_HANDLING = 0.3;    // exhaustion to raise or lower a 7-block boat's sail
const HUNGRY_FOOD = 6;        // at or below 3 drumsticks you can't row hard (like sprinting)
// Wear, as a share of a section's condition.
const ROT_PER_BLOCK = 0.00002;   // planks weaken slowly with use: about 2% per 1,000 blocks sailed
const IMPACT_SPEED = 0.08;       // hits slower than this do no harm
const IMPACT_WEAR = 1.0;         // per unit of speed over that, taken by the bow (or stern going astern)
const GLANCE_SHEER = 1.5;        // degrees a glancing touch turns her away from the bank, per tick
const GLANCE_PUSH = 0.04;        // blocks a tick she's pushed clear of it
const GLANCE_KEEP = 0.97;        // share of her way she keeps through it
const SCRAPE_WEAR = 0.0004;      // per tick while moving aground
const SAIL_WEAR = 0.00004;       // per tick with the sail set in wind over 1.0
const LEAK_AT = 0.25;            // below this a section takes on water
const BEACH_HARD = 0.18;         // beaching faster than this scrapes the bottom
const ANCHOR_PULL = 0.08;     // how firmly an anchored boat is drawn back to its spot
const ANCHOR_PULL_MAX = 0.05;

export function steerSign() {
  try {
    const v = world.getDynamicProperty(SIGN_KEY);
    return v === -1 ? -1 : 1;
  } catch {
    return 1;
  }
}

const norm = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
/** Minecraft yaw: 0 faces +z (south), 90 faces -x (west). */
export { forwardOf };

/** How far forward of the entity's origin (the helm) the craft's centre lies, in blocks. */
export const centreAhead = (h) => -(h?.helmAt ?? 0);
/** The craft's centre, from where the entity is (its helm) and its heading (see frame.js). */
export const centreOf = (pos, heading, h) => new ShipFrame(pos, heading, h).centre();

const ICE = new Set(["minecraft:ice", "minecraft:packed_ice", "minecraft:blue_ice", "minecraft:frosted_ice"]);

/** Ice runners: a boat on ice can be worked along as if afloat. */
function onIce(e) {
  const { x, y, z } = e.location;
  try {
    return ICE.has(e.dimension.getBlock({ x: Math.floor(x), y: Math.floor(y - 0.5), z: Math.floor(z) })?.typeId);
  } catch {
    return false;
  }
}

/** Water under the boat: whether it's afloat and how many blocks deep the water is. */
function waterUnder(e) {
  const { x, y, z } = e.location;
  const fx = Math.floor(x), fz = Math.floor(z);
  const get = (yy) => {
    try {
      return e.dimension.getBlock({ x: fx, y: yy, z: fz });
    } catch {
      return undefined;
    }
  };
  let top = Math.floor(y);
  if (!isWater(get(top))) top = Math.floor(y - 0.4);
  if (!isWater(get(top))) {
    // A low lip (a bottom slab, a carpet) at the surface with water round it: she's still afloat,
    // in a few inches of water, and scrapes over it.
    const b = get(Math.floor(y));
    if (b && !PASSABLE.has(b.typeId) && blockSpan(b)[1] <= 0.5) {
      const wetAround = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
        try {
          return isWater(e.dimension.getBlock({ x: fx + dx, y: Math.floor(y), z: fz + dz }));
        } catch {
          return false;
        }
      });
      if (wetAround) return { wet: true, depth: 1 - blockSpan(b)[1], lip: true };
    }
    return { wet: false, depth: 0 };
  }
  let depth = 0;
  while (depth < 8 && isWater(get(top - depth))) depth++;
  return { wet: true, depth };
}

function boatState(e) {
  let s = state.get(e.id);
  const now = system.currentTick ?? 0;
  if (!s) {
    // Pick up the saved heading (set at build time, kept across restarts).
    let heading = 0;
    try {
      const saved = getP(e, "yaw");
      heading = typeof saved === "number" ? saved : e.getRotation().y;
    } catch {
      /* default heading */
    }
    let sailSet = true;
    try {
      sailSet = getP(e, "sail_set") !== false;
    } catch {
      /* default: sail set */
    }
    // Anchor: a hand-dropped anchor is saved in the record and survives restarts.
    let anchor = null;
    const rec0 = readRecord(e);
    if (rec0?.anchor) anchor = { x: rec0.anchor.x, z: rec0.anchor.z, manual: !!rec0.anchor.manual };
    s = { heading, speed: 0, stats: null, statsAt: -1e9, sailSet, anchor, anchorType: rec0?.anchorType ?? "stone" };
    state.set(e.id, s);
  }
  if (!s.stats || now - s.statsAt > 200) {
    const rec = readRecord(e);
    if (rec) {
      let crew = 0;
      try {
        crew = e.getComponent("minecraft:rideable")?.getRiders().length ?? 0;
      } catch {
        crew = 0;
      }
      // The body is summed from its parts: cargo in the sea chest and everyone aboard weigh it down.
      s.stats = computeHandling(rec, chestLoad(e), crew);
      s.anchorType = rec.anchorType ?? "stone";
      s.statsAt = now;
    }
  }
  return s;
}

// Blocks a hull may overlap: air, water, and small non-colliding plants and decor.
const PASSABLE = new Set([...WATER, "minecraft:air", "minecraft:seagrass", "minecraft:kelp",
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:waterlily", "minecraft:snow_layer",
  "minecraft:torch", "minecraft:lantern", "minecraft:iron_chain", "minecraft:ladder"]);

/**
 * The part of its block a block fills, bottom to top (0..1). A hull rides over anything that only
 * fills the bottom of the block it floats in (a bottom slab, a carpet, a closed trapdoor), as it
 * would over a sandbar's lip: only what reaches up to the probe stops it.
 */
export function blockSpan(b) {
  const id = b.typeId;
  if (/_slab$/.test(id)) {
    let top = false;
    try {
      top = b.permutation?.getState?.("minecraft:vertical_half") === "top" || b.permutation?.getState?.("top_slot_bit") === true;
    } catch {
      /* default bottom */
    }
    return top ? [0.5, 1] : [0, 0.5];
  }
  if (/carpet|pressure_plate|_rail$|^minecraft:rail$/.test(id)) return [0, 0.07];
  if (/trapdoor$/.test(id)) return [0, 0.19];
  if (/_bed$|^minecraft:bed$/.test(id)) return [0, 0.56];
  if (/daylight_detector|stonecutter|campfire/.test(id)) return [0, 0.45];
  return [0, 1];
}
function solidAt(dim, x, y, z) {
  try {
    const b = dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
    if (!b || PASSABLE.has(b.typeId)) return false;
    const [lo, hi] = blockSpan(b);
    const f = y - Math.floor(y);
    return f >= lo && f < hi;
  } catch {
    return true; // unloaded ground counts as solid
  }
}

/**
 * Feels along the real hull: the stern, every block of length to the bow, and both
 * sides amidships. True if any of those points would sit inside solid ground.
 * The pivot (helm) is 1 block forward of the stern tip; the bow is length - 1 ahead.
 */
export function hullHits(dim, at, heading, h) {
  return hullContacts(dim, at, heading, h, true).length > 0;
}

/**
 * Where the hull touches ground: each contact's place along the hull from the centre (a, + forward)
 * and across (s, + starboard), and whether it's on a centre line (keel) or a side (topsides).
 */
export function hullContacts(dim, at, heading, h, first = false) {
  const pos = centreOf(at, heading, h);
  const f = forwardOf(heading);
  const r = { x: -f.z, z: f.x };
  const ys = [pos.y + 0.3, pos.y + 0.8];
  const points = [];
  const half = hullHalf(h);
  const stride = h.length > 10 ? 1.5 : 1;     // long hulls probe a little more sparsely: fewer block reads per tick
  // Along every hull's centre line (twin hulls have two), from stern tip to bow tip...
  for (const line of h.hullLines ?? [0]) {
    for (let a = -half + 0.2; a <= half - 0.1; a += stride) points.push([a, line, true]);
    points.push([half - 0.1, line, true]);
  }
  // ...the sides, at the bow and stern quarters and amidships...
  const side = Math.max(0.3, h.beam / 2 - 0.15);
  for (const line of h.hullLines ?? [0]) {
    for (const a of [-half * 0.5, 0, half * 0.5]) points.push([a, line + side, false], [a, line - side, false]);
  }
  // ...and along an outrigger's float.
  if (h.float) for (let a = -h.float.half; a <= h.float.half; a += 1.5) points.push([a, h.float.across, false]);
  const out = [];
  for (const [a, sdist, keel] of points) {
    const x = pos.x + f.x * a + r.x * sdist;
    const z = pos.z + f.z * a + r.z * sdist;
    for (const y of ys) {
      if (solidAt(dim, x, y, z)) {
        out.push({ a, s: sdist, keel, line: keel ? sdist : null });
        if (first) return out;
        break;
      }
    }
  }
  return out;
}

/**
 * What a touch does: a hit on the keel at the leading end is head-on (she stops, or slides up a
 * beach); anything else is glancing, a side or quarter brushing the bank, and she sheers off it and
 * keeps going. Returns { headOn, side } (side: +1 starboard, -1 port, 0 none).
 */
export function classifyContact(contacts, h, dir) {
  const half = hullHalf(h);
  const lines = h.hullLines ?? [0];
  const headOn = contacts.some((c) => c.keel && dir * c.a > half * 0.45);
  const across = contacts.reduce((t, c) => t + (c.keel ? c.s - lines.reduce((m, l) => (Math.abs(l - c.s) < Math.abs(m - c.s) ? l : m), lines[0]) : c.s), 0);
  const side = contacts.filter((c) => !c.keel).reduce((t, c) => t + Math.sign(c.s - lines.reduce((m, l) => (Math.abs(l - c.s) < Math.abs(m - c.s) ? l : m), lines[0])), 0);
  return { headOn, side: Math.sign(side || across) };
}

/** Centre to bow (or stern) tip in blocks; older stats without it fall back to the helm-origin layout. */
export const hullHalf = (h) => h.half ?? h.length / 2;

/** How far forward of the centre the boat turns about: at the centre when stopped, a third from the bow at speed. */
export function turningPoint(h, speed) {
  const share = Math.min(1, Math.abs(speed) / (h.max || 1));
  return hullHalf(h) * (1 / 3) * share * Math.sign(speed || 1);
}

/**
 * Is what's ahead a shore at the waterline (beachable), rather than a wall? True when the block
 * at the bow is at water level with open air above it.
 */
export function shoreAhead(dim, at, heading, h) {
  const pos = centreOf(at, heading, h);
  const f = forwardOf(heading);
  const r = { x: -f.z, z: f.x };
  const bowTip = hullHalf(h) - 0.1;
  for (const line of h.hullLines ?? [0]) {
    for (let a = bowTip - 0.3; a <= bowTip + 0.7; a += 0.25) {
      const x = pos.x + f.x * a + r.x * line, z = pos.z + f.z * a + r.z * line;
      if (!solidAt(dim, x, pos.y + 0.3, z)) continue;
      return !solidAt(dim, x, pos.y + 1.3, z) && !solidAt(dim, x, pos.y + 2.3, z);   // low shore, open above
    }
  }
  return false;
}

// ---------- soundings ----------

const SOUNDING_MAX = 24;      // deepest a sounding reports; deeper reads as "24+"

/** Water depth in blocks in the column at (x, z), counting down from the surface block. */
function depthAt(dim, x, yTop, z, max = SOUNDING_MAX) {
  let d = 0;
  try {
    while (d < max && isWater(dim.getBlock({ x: Math.floor(x), y: yTop - d, z: Math.floor(z) }))) d++;
  } catch {
    /* unloaded: report what we have */
  }
  return d;
}

/** Safe depth for a hull: its draft plus a little water under the keel, in whole blocks. */
export const safeDepth = (h) => Math.max(1, Math.ceil(h.draft + 0.25));

/**
 * Sounds under the boat and ahead of the bow (further at speed).
 * Sets s.sounding = { under, ahead, safe, alert } where alert is "", "shallowing" or "shoal".
 */
export function takeSoundings(e, s, h) {
  const dim = e.dimension;
  const p = centreOf(e.location, s.heading, h);
  let yTop = Math.floor(p.y);
  if (!isWater(dim.getBlock?.({ x: Math.floor(p.x), y: yTop, z: Math.floor(p.z) }))) yTop = Math.floor(p.y - 0.4);
  const under = depthAt(dim, p.x, yTop, p.z);
  const f = forwardOf(s.heading);
  const bowTip = hullHalf(h) - 0.1;
  const reach = (3 + Math.abs(s.speed) * 30) * (h.lookout ? 2 : 1);   // about 1.5 seconds of travel ahead (twice that from a lookout)
  let ahead = SOUNDING_MAX;
  if (s.speed >= -0.005) {
    for (let d = bowTip + 1; d <= bowTip + reach; d += 1) {
      ahead = Math.min(ahead, depthAt(dim, p.x + f.x * d, yTop, p.z + f.z * d));
    }
  }
  const safe = safeDepth(h);
  // Shoal: not enough water ahead. Shallowing: the bottom is coming up toward your limit
  // (steady shallow water that's still safe stays quiet).
  const alert = ahead < h.draft ? "shoal" : ahead <= safe && ahead < under ? "shallowing" : "";
  s.sounding = { under, ahead, safe, alert };
  if (h.navigation) {          // the ship's log keeps the shallowest sounding in each 16-block area
    s.log = s.log ?? new Map();
    const cell = `${Math.floor(p.x / 16)},${Math.floor(p.z / 16)}`;
    const was = s.log.get(cell);
    if (was === undefined || under < was) s.log.set(cell, under);
  }
  return s.sounding;
}

// ---------- tethering ----------

/** True if the boat is tied with a lead (to a player or a fence post). */
export function isTethered(e) {
  try {
    return !!e.getComponent("minecraft:leashable")?.isLeashed;
  } catch {
    return false;
  }
}

/** Shows a short message on the helmsman's action bar for a few seconds. */
function say(s, text) {
  if (s.msg === text && (system.currentTick ?? 0) < s.msgUntil) return;
  s.msg = text;
  s.msgUntil = (system.currentTick ?? 0) + MESSAGE_TICKS;
  s.msgDirty = true;
}

function setSail(e, s, up, hands) {
  if (hands && s.sailSet !== up) tire(hands, SAIL_HANDLING * ((s.stats?.length ?? 7) / 7));
  s.sailSet = up;
  try {
    setP(e, "sail_set", up);
  } catch {
    /* visual only */
  }
}

function saveAnchor(e, s) {
  const rec = readRecord(e);
  if (!rec) return;
  rec.anchor = s.anchor && s.anchor.manual ? { x: s.anchor.x, z: s.anchor.z, manual: true } : null;
  writeRecord(e, rec);
}

export function dropAnchor(e, s, manual, hands) {
  unlash(s, "Anchored");
  const p = e.location;
  s.anchor = { x: p.x, z: p.z, manual };
  s.speed = 0;
  s.sailBeforeAnchor = s.sailSet;
  if (s.stats?.sail && s.sailSet) setSail(e, s, false, hands);   // anchoring furls the sail
  saveAnchor(e, s);
  say(s, "Anchored");
}

export function weighAnchor(e, s, hands) {
  const wasManual = !!s.anchor?.manual;
  s.anchor = null;
  if (wasManual) saveAnchor(e, s);
  if (s.stats?.sail) setSail(e, s, true, hands);  // getting under way: make sail
  s.sailBeforeAnchor = undefined;
}

/** Holds an anchored boat on its spot: cancels drift and draws it gently back. */
export function holdAtAnchor(e, s) {
  if (!s.anchor) return;
  // A strong enough wind drags the anchor.
  if (s.wind) {
    const holding = (ANCHORS[s.anchorType] ?? ANCHORS.stone).holding;
    const w = Math.hypot(s.wind.x, s.wind.z);
    if (w > holding) {
      const k = (DRAG_RATE * (w - holding)) / w;
      s.anchor.x += s.wind.x * k;
      s.anchor.z += s.wind.z * k;
      if (!s.dragging) say(s, "Anchor dragging");
      s.dragging = true;
    } else {
      s.dragging = false;
    }
  }
  try {
    const p = e.location;
    const v = e.getVelocity();
    let px = (s.anchor.x - p.x) * ANCHOR_PULL;
    let pz = (s.anchor.z - p.z) * ANCHOR_PULL;
    const m = Math.hypot(px, pz);
    if (m > ANCHOR_PULL_MAX) { px *= ANCHOR_PULL_MAX / m; pz *= ANCHOR_PULL_MAX / m; }
    const ix = px - v.x, iz = pz - v.z;
    if (Math.abs(ix) > 1e-4 || Math.abs(iz) > 1e-4) e.applyImpulse({ x: ix, y: 0, z: iz });
  } catch {
    /* entity can't take impulses this tick */
  }
}

/** Takes one piece of fuel: from the boat's sea chest (the helmsman's own items), then their inventory. */
function stokeFurnace(helm, hold) {
  if (isCreative(helm)) return 1600;
  for (const chest of [hold]) {
    for (let i = 0; chest && i < chest.size; i++) {
      const it = chest.getItem(i);
      const f = it && FUELS.find((x) => x.id === it.typeId);
      if (!f) continue;
      if (it.amount > 1) { it.amount -= 1; chest.setItem(i, it); } else chest.setItem(i, undefined);
      return f.ticks;
    }
  }
  // ...then whatever the helmsman carries.
  for (const f of FUELS) {
    if (countItems(helm, [f.id]) > 0) {
      consumeCosts(helm, [{ ids: [f.id], count: 1, label: f.id }]);
      return f.ticks;
    }
  }
  return 0;
}

function tire(helm, amount) {
  try {
    const ex = helm.getComponent("minecraft:player.exhaustion");
    if (ex) ex.setCurrentValue(Math.min(ex.effectiveMax ?? 40, ex.currentValue + amount));
  } catch {
    /* no hunger in this mode */
  }
}

function smoke(e) {
  try {
    const f = forwardOf(getP(e, "yaw") ?? 0);
    const p = e.location;   // the furnace sits about half a block ahead of the helm
    e.dimension.spawnParticle("minecraft:basic_smoke_particle", { x: p.x + f.x * 0.5, y: p.y + 1.0, z: p.z + f.z * 0.5 });
  } catch {
    /* cosmetic */
  }
}

/**
 * Rowing effort for a target speed: drag power at that speed minus what the sail is giving,
 * plus a little extra while still accelerating. 1.0 = rowing flat out with no help.
 */
export function rowingEffort(h, target, current, sailSpeed) {
  const p = (v) => Math.pow(Math.max(0, v) / (h.max || 1), 3);
  let effort = Math.max(0, p(target) - p(sailSpeed));
  if (current < target - 0.005) effort += ACCEL_EFFORT * Math.min(1, target / (h.max || 1));
  return Math.min(1.5, effort);
}

function foodLevel(helm) {
  try {
    return helm.getComponent("minecraft:player.hunger")?.currentValue ?? 20;
  } catch {
    return 20;
  }
}

function addWear(s, zone, amount) {
  s.wear = s.wear ?? { bow: 0, mid: 0, stern: 0, sail: 0 };
  s.wear[zone] += amount;
}

/**
 * Saves accumulated wear into the record, warns about leaks and torn sails, and founders a
 * boat whose hull is holed through (bulkheads keep it afloat). Returns the record's condition.
 */
export function flushWear(e, s) {
  const rec = readRecord(e);
  if (!rec) return null;
  const w = s.wear;
  const bulkheads = (rec.modules ?? []).includes("bulkheads");
  if (s.log?.size) {
    rec.log.soundings = rec.log.soundings ?? {};
    for (const [cell, d] of s.log) {
      const was = rec.log.soundings[cell];
      if (was === undefined || d < was) rec.log.soundings[cell] = d;
    }
    const keys = Object.keys(rec.log.soundings);
    for (const k of keys.slice(0, Math.max(0, keys.length - 600))) delete rec.log.soundings[k];   // the newest 600 areas
    s.log.clear();
    writeRecord(e, rec);
  }
  if (w) {
    for (const k of ["bow", "mid", "stern", "sail"]) {
      if (w[k] <= 0) continue;
      const floor = bulkheads && k !== "sail" ? 0.1 : 0;
      rec.condition[k] = Math.max(floor, rec.condition[k] - w[k]);
    }
    s.wear = null;
    writeRecord(e, rec);
  }
  s.cond = rec.condition;
  const holed = ["bow", "mid", "stern"].find((z) => rec.condition[z] <= 0);
  if (holed) {
    founder(e, rec);
    return rec.condition;
  }
  const leaking = ["bow", "mid", "stern"].find((z) => rec.condition[z] < LEAK_AT);
  const names = { bow: "bow", mid: "midship", stern: "stern" };
  if (leaking) say(s, `Taking water: patch the ${names[leaking]}`);
  else if (rec.sections.rig?.sail && rec.condition.sail < 0.15) say(s, "The sail is torn: patch it with wool");
  return rec.condition;
}

/** A holed boat goes down. Its owner's sea chest items go home to their vault; anything unowned floats free. */
function founder(e, rec) {
  try {
    unloadChest(e);
  } catch {
    /* float free below */
  }
  try {
    const chest = seaChest(e);
    for (let i = 0; chest && i < chest.size; i++) {
      const it = chest.getItem(i);
      if (it) {
        e.dimension.spawnItem(it, e.location);
        chest.setItem(i, undefined);
      }
    }
  } catch {
    /* nothing to save */
  }
  try {
    for (const r of e.getComponent("minecraft:rideable")?.getRiders() ?? []) r.sendMessage?.(`§c${rec.name || "The boat"} has foundered.`);
    e.kill();
  } catch {
    /* already gone */
  }
}

/** At rest: oars shipped, sail not drawing, hull level. */
function settle(e, s) {
  setProp(e, s, "rowing", 0, 0.1);
  setProp(e, s, "sail_fill", 0, 0.05);
  setProp(e, s, "heel", 0, 0.5);
}

function setRudder(e, s, target) {
  s.rudder = (s.rudder ?? 0) + (target - (s.rudder ?? 0)) * 0.25;
  if (Math.abs(s.rudder) < 0.3 && target === 0) s.rudder = 0;
  if (s.rudderShown === undefined || Math.abs(s.rudder - s.rudderShown) > 1 || (s.rudder === 0 && s.rudderShown !== 0)) {
    try {
      setP(e, "rudder", Math.round(Math.max(-30, Math.min(30, s.rudder)) * 10) / 10);
      s.rudderShown = s.rudder;
    } catch {
      /* visual only */
    }
  }
}

function jumpPressed(helm) {
  try {
    return String(helm.inputInfo.getButtonState("Jump")) === "Pressed";
  } catch {
    return false;
  }
}

/**
 * Advances one boat by one tick from its helmsman's input.
 * Returns the boat's state (heading, speed, wind, flags) for tests and the readout.
 */
export function steerBoat(e, helm) {
  const s = boatState(e);
  if (!s.stats) return s;
  const h = s.stats;
  const prevSpeed = s.speed;
  const cond = s.cond ?? { bow: 1, mid: 1, stern: 1, sail: 1 };
  const hullF = 0.7 + 0.3 * ((cond.bow + cond.mid + cond.stern) / 3);   // a worn hull is slower
  const sailF = cond.sail < 0.15 ? 0 : 0.4 + 0.6 * cond.sail;           // a frayed sail draws less; a torn one not at all
  let input = { x: 0, y: 0 };
  try {
    input = helm.inputInfo.getMovementVector();
  } catch {
    /* no input this tick */
  }
  const throttle = Math.max(-1, Math.min(1, input.y));
  // Turning right increases Minecraft yaw. By default stick +x is treated as left.
  let turnRight = -input.x * steerSign();
  if (s.lashed) {
    if (Math.abs(turnRight) > 0.3) unlash(s, "Tiller freed");           // steering frees a lashed tiller
    else turnRight = 0;
  }
  let water = waterUnder(e);
  if (!water.wet && h.iceRunners && onIce(e)) water = { wet: true, depth: 99, ice: true };
  s.aground = water.wet && water.depth < h.draft && !water.lip;   // a lip she scrapes over (with a touch of drag)
  if (water.lip) s.speed *= 0.985;

  // Jump: a quick tap raises or lowers the sail; holding it drops or raises the anchor.
  const jump = jumpPressed(helm);
  if (jump) {
    s.jumpTicks = (s.jumpTicks ?? 0) + 1;
    if (s.jumpTicks === ANCHOR_HOLD) {
      if (s.anchor) weighAnchor(e, s, helm);
      else if (water.wet) dropAnchor(e, s, true, helm);
    }
  } else {
    if (h.sail && s.jumpTicks > 0 && s.jumpTicks < ANCHOR_HOLD && !s.anchor) setSail(e, s, !s.sailSet, helm);
    s.jumpTicks = 0;
  }

  // Tethered with a lead: the line holds the boat; untie it to sail.
  if (isTethered(e)) {
    s.speed = 0;
    setRudder(e, s, 0);
    settle(e, s);
    if (Math.abs(throttle) > 0.3 || Math.abs(turnRight) > 0.3) say(s, "Tethered: untie the line first");
    try {
      const v = e.getVelocity();
      if (Math.abs(v.x) > 1e-4 || Math.abs(v.z) > 1e-4) e.applyImpulse({ x: -v.x, y: 0, z: -v.z });
    } catch {
      /* no velocity reading */
    }
    return s;
  }

  // Anchored: no way on, no turning; just hold the spot.
  if (s.anchor) {
    s.speed = 0;
    setRudder(e, s, 0);
    settle(e, s);
    s.pushingAtAnchor = Math.abs(throttle) > 0.3 || Math.abs(turnRight) > 0.3;
    if (s.pushingAtAnchor) say(s, "Anchored: hold jump to weigh anchor");
    updateExposure(e, s);
    s.wind = windAt(e.dimension, e.location, s);
    holdAtAnchor(e, s);
    return s;
  }
  s.pushingAtAnchor = false;

  // Wind: ease toward the local cell's wind so it changes gradually as you sail.
  updateExposure(e, s);
  const cellWind = windAt(e.dimension, e.location, s);
  s.wind = s.wind ? { x: s.wind.x + (cellWind.x - s.wind.x) * 0.02, z: s.wind.z + (cellWind.z - s.wind.z) * 0.02 } : cellWind;
  const windSpeed = Math.hypot(s.wind.x, s.wind.z);
  const off = angleOffWind(s.wind, s.heading);
  const sailing = h.sail && s.sailSet && water.wet;
  if (s.lashed && water.wet) lashedDrift(s, windSpeed);
  // Law: the sail. Projection: telltales and the cloth's fill.
  const sail = sailLaw(h, { sailing, off, windSpeed, sailF, hullF });
  const fill = sail.fill, sailTarget = sail.target;
  setProp(e, s, "telltale", Math.round(sail.telltale * 10) / 10, 0.1);
  setProp(e, s, "sail_fill", Math.round(fill * 20) / 20, 0.05);

  // A punting pole only works where it can reach the bottom.
  const poleOut = h.poleDepth !== null && water.depth > h.poleDepth;
  if (poleOut && Math.abs(throttle) > 0.3) say(s, "The pole can't reach bottom");

  // Rowing: the stick sets the speed you want; effort is what it takes beyond what the sail gives.
  // The crew ship their oars when the sail alone gives the speed asked for (law: oarsIn).
  const wantFull = throttle > 0.05 ? throttle * h.max * hullF : 0;
  const oars = oarsInLaw(s.oars, { sailing, throttle, want: wantFull, sailTarget });
  if (oars.shipped !== !!s.oars?.shipped) say(s, oars.shipped ? "The sail's drawing: oars in" : "Out oars");
  s.oars = oars;
  const rowing = water.wet && Math.abs(throttle) > 0.05 && !oars.shipped;
  const power = h.power ? POWER[h.power] : null;
  const hungry = foodLevel(helm) <= HUNGRY_FOOD;
  let furnaceDrive = false;
  if (rowing && power) {
    if ((s.fuel ?? 0) <= 0) {
      s.fuel = stokeFurnace(helm, seaChest(e));
      if (s.fuel <= 0 && !s.warnedFuel) { say(s, `The ${power.name.toLowerCase()} needs fuel`); s.warnedFuel = true; }
      if (s.fuel > 0) s.warnedFuel = false;
    }
    furnaceDrive = s.fuel > 0;
  }
  const baseTop = poleOut ? h.max * 0.15 : furnaceDrive ? Math.min(h.max * 1.25, h.max * power.top) : h.max;
  const rowTop = (!furnaceDrive && hungry ? baseTop * 0.5 : baseTop) * hullF;
  if (rowing && !furnaceDrive && hungry && !s.warnedHungry) { say(s, "Too hungry to row hard"); s.warnedHungry = true; }
  if (!hungry) s.warnedHungry = false;
  const want = throttle > 0.05 ? throttle * rowTop : 0;
  s.effort = rowing && throttle > 0 ? rowingEffort(h, want, Math.max(0, s.speed), sailTarget) : rowing ? 0.4 * Math.abs(throttle) : 0;
  if (furnaceDrive) s.fuel -= power.burn * (0.3 + s.effort);   // easy cruising sips fuel, flat out burns it
  else if (rowing) tire(helm, ROW_EXHAUSTION * s.effort * Math.sqrt(h.weight || 1));
  setProp(e, s, "rowing", rowing ? Math.round(Math.min(1, 0.25 + s.effort) * 10) / 10 : 0, 0.1);
  // Each side's stroke: both together ahead or astern, and turning pulls one side and backs the other
  // (on the spot) or eases the inside oars (under way).
  const pulling = rowing || (water.wet && Math.abs(turnRight) > 0.05 && !s.anchor);
  const base = rowing ? Math.sign(throttle) * Math.min(1, 0.35 + Math.abs(throttle) * 0.65) : 0;
  const tk = Math.abs(base) > 0.2 ? 0.65 : 0.85;
  const q = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 10) / 10;
  setProp(e, s, "stroke_l", pulling ? q(base + turnRight * tk) : 0, 0.1);
  setProp(e, s, "stroke_r", pulling ? q(base - turnRight * tk) : 0, 0.1);
  setProp(e, s, "turn", water.wet ? q(turnRight) : 0, 0.1);
  s.furnaceTicks = furnaceDrive ? 20 : Math.max(0, (s.furnaceTicks ?? 0) - 1);
  if (s.litShown !== s.furnaceTicks > 0) {
    try {
      setP(e, "furnace_lit", s.furnaceTicks > 0);
      s.litShown = s.furnaceTicks > 0;
    } catch {
      /* visual only */
    }
  }
  if (furnaceDrive && (system.currentTick ?? 0) % 8 === 0) smoke(e);
  const pull = (poleOut ? 0.15 : 1) * (furnaceDrive ? power.pull : 1) * (h.benchPull ?? 1);

  // Law: the drive. Oars and sail together; with the sail drawing, the boat sails on its own.
  const before = s.speed;
  const drive = driveLaw(h, s.speed, { wet: water.wet, throttle: oars.shipped ? 0 : throttle, want, sailTarget, sailing, pull, aground: s.aground,
    groundMax: AGROUND_MAX, beachedDrag: BEACHED_DRAG });
  s.speed = drive.speed;
  s.ledger = drive.ledger;
  // Law: the wake. What the water took goes into spray (projected below).
  const wake = wakeLaw(s.wake ?? 0, h, { before, after: s.speed, ledger: drive.ledger });
  s.wake = wake.budget;
  if (wake.puffs && water.wet && (system.currentTick ?? 0) % 2 === 0) spray(e, s, wake.puffs);   // at most ten a second

  // Heading: strongest slow, fading with speed. A turn that would swing the hull into land is refused.
  const pos = e.location;
  s.turnShift = null;
  if (water.wet && Math.abs(turnRight) > 0.05) {
    const next = norm(s.heading + turnRight * turnRateAt(h, s.speed) * (s.speed < -0.005 ? -1 : 1));
    if (!hullHits(e.dimension, pos, next, h)) {
      // Turning about a point forward of the centre: the boat turns about its origin (the helm), so
      // shift it as if it turned about that point instead; the stern swings out.
      const p = centreAhead(h) + turningPoint(h, s.speed);
      const a = forwardOf(s.heading), b = forwardOf(next);
      s.turnShift = { x: p * (a.x - b.x), z: p * (a.z - b.z) };
      // Law: a turn costs way (the hull goes partly sideways through the water).
      s.speed *= 1 - turnDrag(h, norm(next - s.heading));
      s.heading = next;
    }
    // A turn that would swing her into the bank simply doesn't happen: she holds her heading.
  }

  // Look ahead along the hull: stop rather than slide into the shore.
  const f = forwardOf(s.heading);
  let vel = { x: 0, z: 0 };
  try {
    const v0 = e.getVelocity();
    vel = { x: v0.x, z: v0.z };
  } catch {
    /* no velocity reading */
  }
  // Look ahead by whichever is further: where the speed is taking us, or where momentum is.
  const reach = Math.max(Math.abs(s.speed), Math.hypot(vel.x, vel.z)) * 4 + 0.2;
  const dir = s.speed < 0 ? -1 : 1;
  const ahead = { x: pos.x + f.x * reach * dir, y: pos.y, z: pos.z + f.z * reach * dir };
  s.bumped = false;
  if (s.beached && throttle < -0.05) s.beached = false;          // rowing astern pushes off the beach
  const contacts = Math.abs(s.speed) > 0.001 || Math.hypot(vel.x, vel.z) > 0.01 ? hullContacts(e.dimension, ahead, s.heading, h) : [];
  const touch = contacts.length ? classifyContact(contacts, h, dir) : null;
  if (touch && !touch.headOn && touch.side) {
    // Glancing: a side or quarter brushes the bank. She sheers off (turns away and is pushed clear)
    // and loses a little way, but keeps going; it doesn't hurt her.
    s.heading = norm(s.heading - touch.side * GLANCE_SHEER * dir);
    const r = { x: -f.z, z: f.x };
    s.turnShift = { x: (s.turnShift?.x ?? 0) - r.x * touch.side * GLANCE_PUSH, z: (s.turnShift?.z ?? 0) - r.z * touch.side * GLANCE_PUSH };
    s.speed *= GLANCE_KEEP;
    s.glancing = (s.glancing ?? 0) + 1;
  } else if (touch) {
    if (dir > 0 && shoreAhead(e.dimension, ahead, s.heading, h)) {
      // Running onto a shore at the waterline: slide up onto the beach and stop, gently.
      if (!s.beached) {
        s.beached = true;
        say(s, "Beached: row astern to push off");
        if (Math.abs(prevSpeed) > BEACH_HARD) addWear(s, "mid", (Math.abs(prevSpeed) - BEACH_HARD) * 0.8 * (h.sewnSeams ? 0.5 : 1));
        try {
          e.teleport({ x: pos.x + f.x * 0.35, y: pos.y + 0.2, z: pos.z + f.z * 0.35 }, { keepVelocity: false });
        } catch {
          /* stays where it is */
        }
      }
      s.speed = 0;
    } else {
      s.speed = 0;
      s.bumped = true;
    }
  }
  if (s.beached && s.speed > 0) s.speed = 0;                      // can't drive further up the beach

  // The rudder swings with the helm and eases back to centre when you let go.
  setRudder(e, s, water.wet ? turnRight * 25 : 0);
  // Keep the game's own facing in step with the heading, so seats and hit areas line up with the hull.
  if (faceSync()) {
    try {
      // At most twice a second, and only once it's drifted: rotating a ridden vehicle every tick
      // makes the game resend it to every player every tick.
      const t = system.currentTick ?? 0;
      if (Number.isFinite(s.heading) && t - (s.faceAt ?? -99) >= 10 && Math.abs(norm(e.getRotation().y - s.heading)) > 5) {
        s.faceAt = t;
        e.setRotation({ x: 0, y: s.heading });
      }
    } catch {
      /* not this tick */
    }
  }

  if (s.shown === undefined || Math.abs(norm(s.heading - s.shown)) > 0.5) {
    try {
      setP(e, "yaw", Math.round(s.heading * 10) / 10);
      s.shown = s.heading;
    } catch {
      /* property not available this tick */
    }
  }

  // Velocity: forward component to the boat's speed, sideways skid bled off by grip,
  // plus leeway: a sail drawing across the wind pushes the hull sideways a little.
  try {
    const v = e.getVelocity();
    const along = v.x * f.x + v.z * f.z;
    const across = v.x * f.z - v.z * f.x;
    if (water.wet && Math.abs(s.speed) > 0.02 && Math.abs(along) < Math.abs(s.speed) * 0.4) {
      s.blocked = (s.blocked ?? 0) + 1;
      if (s.blocked > 6) s.speed = s.speed * 0.8 + along * 0.2;
    } else {
      s.blocked = 0;
    }
    // Law: drift. Wind pushes the hull (more with the sail set); the keel resists the sideways part.
    const drift = driftLaw(h, { f, speed: s.speed, across, wind: s.wind, wet: water.wet, sailUp: h.sail && s.sailSet,
      bumped: s.bumped, turnShift: s.turnShift });
    const tx = drift.x, tz = drift.z;

    // Law: heel. A damped roll toward the angle the wind and the turn push it to; stiffer hulls lean less.
    const target = heelTarget(h, { fill, windSpeed, off, windAcross: drift.windAcross, turnRight, speed: s.speed });
    const roll = heelLaw({ heel: s.heel ?? 0, rate: s.heelRate ?? 0 }, target, { period: rollPeriod(h), limit: h.heelLimit ?? 25, limitPos: h.floatHeel != null ? Math.min(h.floatHeel, h.heelLimit ?? 25) : h.heelLimit ?? 25 });
    s.heel = roll.heel;
    s.heelRate = roll.rate;
    setProp(e, s, "heel", Math.round(s.heel * 2) / 2, 0.5);
    const k = s.bumped ? 1 : SMOOTHING;   // a stop is a stop: cancel momentum at once
    const ix = (tx - v.x) * k;
    const iz = (tz - v.z) * k;
    if (Math.abs(ix) > 1e-4 || Math.abs(iz) > 1e-4) e.applyImpulse({ x: ix, y: 0, z: iz });
  } catch {
    /* entity can't take impulses this tick */
  }

  // Wear: planks weaken with use (a dugout carved from one trunk doesn't rot), hard hits hurt
  // the bow (or the stern going astern), grounding scrapes the bottom, strong wind frays the sail.
  const sewn = h.sewnSeams ? 0.5 : 1;
  if (water.wet && !h.oneTrunk) for (const z of ["bow", "mid", "stern"]) addWear(s, z, Math.abs(s.speed) * ROT_PER_BLOCK);
  if (s.bumped && !s.wasBumped && Math.abs(prevSpeed) > IMPACT_SPEED) {
    addWear(s, prevSpeed > 0 ? "bow" : "stern", (Math.abs(prevSpeed) - IMPACT_SPEED) * IMPACT_WEAR * sewn);
  }
  s.wasBumped = s.bumped;
  if (s.aground && Math.abs(s.speed) > 0.005) addWear(s, "mid", SCRAPE_WEAR * sewn);
  if (sailing && windSpeed > 1.0) addWear(s, "sail", SAIL_WEAR * ((windSpeed - 1) / 0.4));
  return s;
}

/** Projection of the wake law: spray at the bow and along the hull, as many puffs as the water was given. */
function spray(e, s, puffs) {
  try {
    const f = forwardOf(s.heading), r = { x: -f.z, z: f.x };
    const bow = centreAhead(s.stats) + (s.stats.half ?? 1) - 0.3;
    const p = e.location;
    for (let i = 0; i < puffs; i++) {
      const side = (s.sprayFlip = !s.sprayFlip) ? 1 : -1;
      const a = bow - i * 0.8, w = side * ((s.stats.beam ?? 1) / 2 + 0.1);
      e.dimension.spawnParticle("minecraft:water_splash_particle_manual", { x: p.x + f.x * a + r.x * w, y: p.y + 0.2, z: p.z + f.z * a + r.z * w });
    }
  } catch {
    /* cosmetic */
  }
}

/** Feeds the masthead pennant: wind direction relative to the hull, and its strength. */
export function showWind(e, s) {
  const w = s.wind;
  if (!w) return;
  const str = Math.min(1.5, Math.hypot(w.x, w.z));
  const windYaw = (Math.atan2(-w.x, w.z) * 180) / Math.PI;  // the way the wind blows, as a Minecraft yaw
  const rel = Math.round(norm(windYaw - s.heading) * 10) / 10;
  if (s.flagRel === undefined || Math.abs(norm(rel - s.flagRel)) > 3 || Math.abs(str - s.flagStr) > 0.05) {
    try {
      setP(e, "wind_rel", rel);
      setP(e, "wind_str", Math.round(str * 100) / 100);
      s.flagRel = rel;
      s.flagStr = str;
    } catch {
      /* visual only */
    }
  }
}

function readout(helm, s) {
  // Conditions that last are repeated while they last; everything else is a short one-off message.
  const sd = s.sounding;
  const ongoing = s.anchor ? "" : s.aground ? "Aground!" : sd?.alert === "shoal" ? "Shoal ahead!"
    : sd?.alert === "shallowing" ? "Shallowing" : s.bumped ? "Hull touching" : "";
  let text = ongoing;
  if (!text && s.msg && (system.currentTick ?? 0) < s.msgUntil) text = s.msgDirty ? s.msg : "";
  s.msgDirty = false;
  if (!text) return;   // nothing to say: the action bar stays clear
  try {
    helm.onScreenDisplay.setActionBar(text);
  } catch {
    /* no HUD for this rider */
  }
}

/**
 * Walkable decks on medium and large ships: laid while the ship is stopped (anchored, tied up,
 * beached), lifted when it gets under way, after seating everyone on deck at a crew station.
 */
/** Whether the game's facing follows the heading (/scriptevent shipwright:facesync on|off). */
export function faceSync() {
  try {
    // Off unless asked for: rotating a ridden boat fights the game's own boat steering.
    return world.getDynamicProperty("shipwright:facesync") === "on";
  } catch {
    return true;
  }
}

// ---------- the lashed tiller (Navigation, small) ----------

const LASHED_HELM = {
  typeId: "shipwright:lashed", id: "lashed", isSneaking: false,
  inputInfo: { getMovementVector: () => ({ x: 0, y: 0 }), getButtonState: () => "Released" },
  onScreenDisplay: { setActionBar() {} },
};

/** Lashes or frees the tiller (a helmsman using a lead, with a Navigation module fitted). */
export function toggleLash(e, player) {
  const s = boatState(e);
  if (!(s.stats?.navigation)) {
    player.sendMessage("§7Fit a Navigation module to lash the tiller.");
    return false;
  }
  if (s.lashed) {
    unlash(s, "Tiller freed");
    return false;
  }
  if (s.anchor) weighAnchor(e, s, player);
  s.lashed = true;
  s.drift = 0;
  say(s, "Tiller lashed: she'll hold her course");
  return true;
}

function unlash(s, why) {
  if (!s.lashed) return;
  s.lashed = false;
  say(s, why);
}

/** A lashed tiller holds the rudder amidships; wind shifts nudge the heading a little, as they would. */
function lashedDrift(s, windSpeed) {
  s.drift = (s.drift ?? 0) * 0.97 + (Math.random() - 0.5) * 0.04 * Math.min(1.5, windSpeed);
  s.heading += s.drift;
}

export function manageDeck(e, s, tethered) {
  // Moored (anchored, tied up or beached): shields hang on the rail and canopies spread.
  setProp(e, s, "moored", s.anchor || tethered || s.beached ? 1 : 0, 0.5);
  const h = s.stats;
  if (!h || h.length < DECK_MIN_LENGTH) return;
  const stopped = !!(s.anchor || tethered || s.beached) && Math.abs(s.speed ?? 0) < 0.01;
  const deck = deckOf(e.id);
  if (stopped) {
    if (!deck) {
      for (const id of [...(s.walkers?.keys() ?? [])]) dropWalker(e, s, id);   // the full deck takes over
      layDeck(e, h, s.heading);
    }
    else if (Math.hypot(deck.at[0] - e.location.x, deck.at[1] - e.location.z) > 0.8) {   // dragged: re-lay it
      liftDeck(e.id);
      layDeck(e, h, s.heading);
    }
    return;
  }
  if (!deck) return;
  boardWalkers(e, s, h);                             // everyone on deck keeps walking as she gets under way
  liftDeck(e.id);
}

function tick() {
  for (const id of DIMENSIONS) {
    let boats = [];
    try {
      boats = world.getDimension(id).getEntities({ tags: [LAUNCHED_TAG] });
    } catch {
      continue;
    }
    for (const e of boats) {
      try {
        tickBoat(e);
      } catch (err) {
        warnOnce(`tick:${e.id}`, `[Shipwright] A boat's tick failed (it carries on next tick): ${err}`);
      }
    }
  }
}

/** Whether a ship is at rest: anchored, tied up, beached, or lying still for a couple of seconds. */
function atRest(e, s) {
  const t = system.currentTick ?? 0;
  if (Math.abs(s.speed ?? 0) > 0.01) s.movingAt = t;
  return !!s.anchor || s.beached || isTethered(e) || t - (s.movingAt ?? -1e9) > 40;
}

function tickBoat(e) {
  const t0 = system.currentTick ?? 0;
  {
    // Shields: on the rail except under sail (law: shieldsLaw). Moving, the pegs follow every tick.
    const s0 = boatState(e);
    const underSail = !!(s0.stats?.sail && s0.sailSet && (s0._sail_fill ?? 0) > 0.15);
    s0.shields = shieldsLaw(s0.shields, underSail);
    const moving = Math.abs(s0.speed ?? 0) > 0.01;
    if (s0.stats && (moving || t0 % 10 === 0)) {
      const rec = s0.rec && t0 - (s0.recAt ?? -1e9) < 40 ? s0.rec : readRecord(e);
      if (rec !== s0.rec) { s0.rec = rec; s0.recAt = t0; }
      if (rec) manageShields(e, rec, s0.heading, s0.stats, !s0.shields.stowed);
    }
  }
  let riders = [];
  try {
    riders = e.getComponent("minecraft:rideable")?.getRiders() ?? [];
  } catch {
    riders = [];
  }
  const s = boatState(e);
  // At the helm: the first rider, or a player standing at the helm on deck (see takeHelmStanding).
  const helm = riders[0]?.typeId === "minecraft:player" ? riders[0] : standingHelm(e, s) ?? riders[0];
  const t = system.currentTick ?? 0;
  if (!helm || helm.typeId !== "minecraft:player") {
    s.helmId = null;
    // A ship's boat in tow follows on her line (tender.js), and does nothing else.
    if (towTick(e, s, boatState)) return;
    // A lashed tiller sails on with nobody at the helm.
    if (s.lashed && !s.anchor) {
      steerBoat(e, LASHED_HELM);
      if (t % 5 === 0) manageDeck(e, s, false);
      if (t % 5 === 0) showWind(e, s);
      return;
    }
    // Nobody at the helm: a tethered boat is held by its line; otherwise it anchors where it is.
    if (isTethered(e)) {
      if (s.anchor && !s.anchor.manual) s.anchor = null;
      if (t % 5 === 0) manageDeck(e, s, true);
      return;
    }
    if (!s.anchor) dropAnchor(e, s, false);
    if (t % 5 === 0) manageDeck(e, s, false);
    if (t % 20 === 0) {
      updateExposure(e, s);
      s.wind = windAt(e.dimension, e.location, s);
      showWind(e, s);
    }
    holdAtAnchor(e, s);
    return;
  }
  // Taking the helm of a boat in tow casts her off: she's yours to sail.
  if (e.getDynamicProperty?.("shipwright:towedBy")) {
    const ship = world.getDimension(e.dimension.id).getEntities({ families: ["shipwright_boat"] }).find((b) => b.id === e.getDynamicProperty("shipwright:towedBy"));
    if (ship) castOff(ship, e); else e.setDynamicProperty("shipwright:towedBy", undefined);
    say(s, "Cast off: she's yours to sail");
  }
  // Taking the helm raises an anchor that dropped itself (a hand-dropped one stays down)
  // and makes sail, so you get under way with the sail up; tap jump to lower it.
  const helmId = helm.id ?? "helm";
  if (s.helmId !== helmId) {
    s.helmId = helmId;
    if (s.anchor && !s.anchor.manual) weighAnchor(e, s, helm);
    try {
      if (helm.typeId === "minecraft:player") loadChest(e, helm);   // your own sea chest aboard
    } catch (err) {
      console.warn(`[Shipwright] Sea chest: ${err}`);
    }
    if (!s.anchor && s.stats?.sail) setSail(e, s, true, helm);
  }
  if (!s.cond) flushWear(e, s);
  steerBoat(e, helm);
  if (t % 5 === 0) manageDeck(e, s, isTethered(e));
  if (s.stats?.length >= DECK_MIN_LENGTH && !deckOf(e.id)) carryWalkers(e, s, s.stats);

  if (t % 100 === 0) flushWear(e, s);
  if (t % 5 === 0) showWind(e, s);
  if (t % 10 === 0 && s.stats) {
    if (!s.anchor) takeSoundings(e, s, s.stats);
    readout(helm, s);
  }
}

useHandling((e) => boatState(e).stats ?? computeHandling(readRecord(e)));

export function startSteering() {
  // Owners who step away from a boat (or leave the game) get their sea chest items sent home.
  system.runInterval(() => {
    for (const id of DIMENSIONS) {
      try {
        returnAbsentChests(world.getDimension(id).getEntities({ tags: [LAUNCHED_TAG] }));
      } catch (err) {
        console.warn(`[Shipwright] Sea chest: ${err}`);
      }
    }
  }, 20);
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "shipwright:steer") return;
    const arg = String(ev.message ?? "").trim().toLowerCase();
    if (arg === "flip") world.setDynamicProperty(SIGN_KEY, steerSign() === 1 ? -1 : 1);
    const msg = `[Shipwright] Steering is ${steerSign() === 1 ? "normal" : "flipped"}.`;
    console.warn(msg);
    for (const p of world.getAllPlayers()) p.sendMessage(`§e${msg}`);
  });
  system.runInterval(tick, 1);
  // Pegs whose ship is gone (broken, despawned, moved away): taken down.
  system.runInterval(() => {
    for (const id of DIMENSIONS) {
      try {
        const dim = world.getDimension(id);
        const boats = new Set(dim.getEntities({ families: ["shipwright_boat"] }).map((b) => b.id));
        for (const p of dim.getEntities({ type: PEG })) if (!boats.has(p.getDynamicProperty("boat"))) p.remove();
      } catch (err) {
        warnOnce("peg-sweep", `[Shipwright] Peg sweep: ${err}`);
      }
    }
  }, 100);
}

/**
 * Standing at the helm. On a decked ship you can steer on your feet: stand at the helm and use the
 * deck there. You keep the helm while you stay at it; sneak to step away.
 */
export const HELM_REACH = 1.3;
function nearHelm(e, s, p) {
  const h = s.stats;
  if (!h || !p?.isValid || p.dimension?.id !== e.dimension.id) return false;
  const loc = new ShipFrame(e.location, s.heading, h).toLocal(p.location);
  const feet = Math.floor(e.location.y) + (h.deckUp ?? 0) + 1;
  return Math.abs(loc.along) <= HELM_REACH && Math.abs(loc.across) <= HELM_REACH && Math.abs(p.location.y - feet) <= 1.2;
}
function standingHelm(e, s) {
  const p = s.standing;
  if (!p) return null;
  if (p.isSneaking || !nearHelm(e, s, p)) {
    s.standing = null;
    try {
      p.onScreenDisplay?.setActionBar("You step away from the helm.");
    } catch {
      /* gone */
    }
    return null;
  }
  return p;
}
/** A player standing on deck takes the helm on their feet (when it's free). Returns a message. */
export function takeHelmStanding(e, p) {
  const s = boatState(e);
  if (!s.stats || (s.stats.length ?? 0) < DECK_MIN_LENGTH) return "";
  if (!nearHelm(e, s, p)) return "";
  const riders = e.getComponent("minecraft:rideable")?.getRiders() ?? [];
  if (riders[0]?.typeId === "minecraft:player") return "Someone already has the helm.";
  s.standing = p;
  return "You take the helm standing. Steer as you would seated; sneak to step away.";
}

/** Who has the helm: the first rider if a player, else a player standing at it, else nobody. */
export function helmOf(e) {
  let riders = [];
  try {
    riders = e.getComponent("minecraft:rideable")?.getRiders() ?? [];
  } catch {
    riders = [];
  }
  if (riders[0]?.typeId === "minecraft:player") return riders[0];
  const p = state.get(e.id)?.standing;
  return p?.isValid ? p : null;
}

/**
 * A blow to the hull (a shot, a ram): wear in one zone, saved at once, so a ship nobody sails is
 * holed too. Bulkheads keep her afloat; a hull holed through founders. Returns her condition.
 */
export function hullHit(e, zone, amount) {
  const s = boatState(e);
  addWear(s, zone, amount);
  return flushWear(e, s);
}

/** A collision takes way off her (keep: the share of her speed she keeps). */
export function loseWay(e, keep) {
  const s = boatState(e);
  s.speed = (s.speed ?? 0) * keep;
}

export const _test = { state, tick };
/** A ship's live state (heading, speed, handling) for the crew's modules. */
export const boatStateOf = (e) => (e ? boatState(e) : null);
