// Glass floats: a fisherman's glass ball in a rope net. Set on open water she stays where she
// was put, and a boat can be made fast to her on a lead; hung from a dock face on a rope she is a
// fender, and a boat that comes in slowly is drawn alongside and held there, her hull spared the
// knock. A lantern used on a float goes inside the glass and lights the water round her.
//
// The laws (pure, tested) come first; the world glue after.
import { world, system, ItemStack } from "@minecraft/server";
import { DIMENSIONS } from "./dims.js";
import { isCreative } from "./inventory.js";
import { boatStateOf, dropAnchor } from "./steering.js";

export const FLOAT = "shipwright:glass_float";
const PHI = (1 + Math.sqrt(5)) / 2;                // vision: the golden law
const PX = 1 / 16;                                 // given: a pixel, in blocks
export const RADIUS = 6 * PX;                      // vision: the ball's radius (gen_float.py R)
const EYE = (6 / PHI ** 2 + 6 + 0.5 + 2) * PX;     // vision: the eye's top above her waterline (gen_float.py: LIFT + R + ROPE + 2)
export const SURFACE = 8 / 9;                      // given: a still water block's surface, from its foot
export const ROPE = PHI ** 2;                      // vision: a mooring line's scope, blocks
export const GAP = 1 / PHI ** 3;                   // vision: what a fender keeps between hull and dock face, blocks
export const SLOW = 0.05;                          // vision: blocks/tick: slower than this, a fender takes her alongside
export const REACH = PHI ** 2;                     // vision: how far along the dock a fender's reach runs, blocks
const PULL = 1 / PHI ** 4;                         // vision: how firmly she's drawn to the fender, per tick
const TICK = 5;                                    // vision: ticks between the moorings' rounds
const LIGHT = { "minecraft:lantern": 15, "minecraft:soul_lantern": 10 };   // given: a lantern's and a soul lantern's light
const SCAN = 6;                                    // vision: how far down from a dock face to look for its water, blocks
const TIE_REACH = 12;                              // vision: how far a lead reaches from a float to a boat, blocks

// ---- laws ----------------------------------------------------------------------------------

/**
 * Where a boat lies on her line: on the circle of the rope's scope round the float, on the side
 * she's on now, so she swings to wind and stream. Inside the scope she's slack and stays put.
 */
export function tieSpot(float, boat, rope = ROPE) {
  const dx = boat.x - float.x, dz = boat.z - float.z;
  const d = Math.hypot(dx, dz);
  if (d <= rope) return { x: boat.x, z: boat.z, slack: true };
  return { x: float.x + (dx / d) * rope, z: float.z + (dz / d) * rope, slack: false };
}

/**
 * A fender hung on a dock face (normal n, out of the dock, unit along x or z) and a boat near it:
 * whether the fender has her, and where she lies alongside: the dock face plus her half-beam
 * plus the gap, measured out along n, wherever she is along the dock.
 */
export function alongside(fender, n, boat, halfBeam, speed) {
  const ox = boat.x - fender.x, oz = boat.z - fender.z;
  const out = ox * n.x + oz * n.z;                      // how far out from the fender
  const along = Math.abs(ox * n.z - oz * n.x);          // how far along the dock from it
  const lie = halfBeam + GAP - RADIUS;                  // the fender's centre sits RADIUS off the face
  const has = Math.abs(speed) < SLOW && along <= REACH && out > -RADIUS && out <= lie + REACH;
  return { has, x: boat.x + n.x * (lie - out), z: boat.z + n.z * (lie - out), out, along };
}

/** A dock face's water: the first water surface at or below `from`, scanning down. */
export function surfaceBelow(isWater, x, y, z, scan = SCAN) {
  for (let k = 0; k <= scan; k++) {
    const yy = y - k;
    if (isWater(x, yy, z) && !isWater(x, yy + 1, z)) return yy;
  }
  return null;
}

/**
 * Where a float set from a raycast goes. `hit` is {x,y,z} of the block looked at, `face` its face
 * (North/South/East/West/Up/Down), `isWater(x,y,z)`. Afloat on water; hung on a dock's side face
 * when there's water below that side; else nowhere.
 */
export function placeFloat(hit, face, isWater) {
  if (isWater(hit.x, hit.y, hit.z)) {
    let y = hit.y;
    while (isWater(hit.x, y + 1, hit.z)) y++;
    return { x: hit.x + 0.5, y: y + SURFACE, z: hit.z + 0.5, drop: 0, n: null };
  }
  const N = { North: { x: 0, z: -1 }, South: { x: 0, z: 1 }, East: { x: 1, z: 0 }, West: { x: -1, z: 0 } }[face];
  if (!N) return null;
  const ax = hit.x + N.x, az = hit.z + N.z;
  const wy = surfaceBelow(isWater, ax, hit.y, az);
  if (wy === null) return null;
  const y = wy + SURFACE;
  const top = hit.y + 1;                                // the dock's deck
  const cx = hit.x + 0.5 + N.x * (0.5 + RADIUS);        // against the face
  const cz = hit.z + 0.5 + N.z * (0.5 + RADIUS);
  return { x: cx, y, z: cz, drop: Math.max(0, top - (y + EYE)), n: N };
}

// ---- glue ----------------------------------------------------------------------------------

function held(player) {
  try {
    const c = player.getComponent("minecraft:inventory")?.container;
    return { c, slot: player.selectedSlotIndex, item: c?.getItem(player.selectedSlotIndex) };
  } catch {
    return {};
  }
}

function spend(player) {
  if (isCreative(player)) return;
  const { c, slot, item } = held(player);
  if (!c || !item) return;
  if (item.amount > 1) { item.amount -= 1; c.setItem(slot, item); } else c.setItem(slot, undefined);
}

function give(player, id) {
  try {
    const left = player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(id, 1));
    if (left) player.dimension.spawnItem(left, player.location);
  } catch {
    /* nowhere to put it */
  }
}

const waterAt = (dim) => (x, y, z) => {
  try {
    const b = dim.getBlock({ x, y, z });
    return !!b && (b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water" || b.isWaterlogged === true);
  } catch {
    return false;
  }
};

function lightSpot(f) {
  const p = f.location;
  return { x: Math.floor(p.x), y: Math.floor(p.y) + 1, z: Math.floor(p.z) };
}

function setLight(f, level) {
  try {
    const b = f.dimension.getBlock(lightSpot(f));
    if (!b) return;
    if (level && b.typeId === "minecraft:air") b.setType(`minecraft:light_block_${level}`);
    if (!level && b.typeId.startsWith("minecraft:light_block")) b.setType("minecraft:air");
  } catch {
    /* unloaded */
  }
}

function normalOf(f) {
  const n = f.getDynamicProperty("shipwright:n");
  return typeof n === "string" ? JSON.parse(n) : null;
}

/** Sets a float from the item in hand. */
export function setFloat(player) {
  let hit;
  try {
    hit = player.getBlockFromViewDirection({ includeLiquidBlocks: true, includePassableBlocks: true, maxDistance: 6 });   // vision: a reach
  } catch {
    return "Look at water, or the side of a dock over water";
  }
  if (!hit?.block) return "Look at water, or the side of a dock over water";
  const b = hit.block;
  const spot = placeFloat({ x: b.location.x, y: b.location.y, z: b.location.z }, String(hit.face), waterAt(player.dimension));
  if (!spot) return "A float needs water under her";
  const f = player.dimension.spawnEntity(FLOAT, { x: spot.x, y: spot.y, z: spot.z });
  f.setDynamicProperty("shipwright:home", JSON.stringify({ x: spot.x, y: spot.y, z: spot.z }));
  if (spot.n) {
    f.setDynamicProperty("shipwright:n", JSON.stringify(spot.n));
    try { f.setProperty("shipwright:drop", Math.min(6, spot.drop)); } catch { /* visual only */ }   // given: the property's range (gen_float.py)
  }
  spend(player);
  return spot.n ? "Fender hung" : "Float set";
}

function nearestBoat(f, player) {
  const riding = player.getComponent("minecraft:riding")?.entityRidingOn;
  if (riding && boatStateOf(riding)) return riding;
  let best = null, bd = Infinity;
  for (const b of f.dimension.getEntities({ families: ["shipwright_boat"], location: f.location, maxDistance: TIE_REACH })) {
    const d = Math.hypot(b.location.x - f.location.x, b.location.z - f.location.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** Using a float: a lantern in or out, or a boat made fast or cast off with a lead. */
export function useFloat(f, player) {
  const { item } = held(player);
  const id = item?.typeId;
  const lit = f.getDynamicProperty("shipwright:lantern");
  if (LIGHT[id] && !lit) {
    f.setDynamicProperty("shipwright:lantern", id);
    try { f.setProperty("shipwright:lantern", true); } catch { /* visual only */ }
    setLight(f, LIGHT[id]);
    spend(player);
    return "Lantern lit in the glass";
  }
  if (!id && lit) {
    f.setDynamicProperty("shipwright:lantern", undefined);
    try { f.setProperty("shipwright:lantern", false); } catch { /* visual only */ }
    setLight(f, 0);
    give(player, lit);
    return "Lantern taken out";
  }
  if (id === "minecraft:lead") {
    const tied = f.getDynamicProperty("shipwright:tied");
    if (tied) {
      const boat = world.getEntity(tied);
      const s = boat && boatStateOf(boat);
      if (s?.anchor?.float === f.id) { s.anchor = null; }
      f.setDynamicProperty("shipwright:tied", undefined);
      return "Cast off";
    }
    const boat = nearestBoat(f, player);
    const s = boat && boatStateOf(boat);
    if (!s) return "No boat near enough to make fast";
    dropAnchor(boat, s, true);
    s.anchor.float = f.id;
    f.setDynamicProperty("shipwright:tied", boat.id);
    return "Made fast to the float";
  }
  return null;
}

/** Hitting a float takes her up, lantern and all; a boat on her is cast off. */
export function takeUp(f, player) {
  const lit = f.getDynamicProperty("shipwright:lantern");
  if (lit) { setLight(f, 0); give(player, lit); }
  const tied = f.getDynamicProperty("shipwright:tied");
  if (tied) {
    const s = boatStateOf(world.getEntity(tied));
    if (s?.anchor?.float === f.id) s.anchor = null;
  }
  if (!isCreative(player)) give(player, FLOAT);
  f.remove();
}

/** One round: lines keep their scope, fenders take slow boats alongside, floats keep their spot. */
export function mooringsTick() {
  for (const d of DIMENSIONS) {
    let floats;
    try {
      floats = world.getDimension(d).getEntities({ type: FLOAT });
    } catch {
      continue;
    }
    for (const f of floats) {
      try {
        const home = JSON.parse(f.getDynamicProperty("shipwright:home") ?? "null");
        if (home && Math.hypot(f.location.x - home.x, f.location.y - home.y, f.location.z - home.z) > 0.01) f.teleport(home);   // vision: a hair's drift
        const fp = home ?? f.location;
        const tied = f.getDynamicProperty("shipwright:tied");
        if (tied) {
          const boat = world.getEntity(tied);
          const s = boat?.isValid ? boatStateOf(boat) : null;
          if (!s?.anchor || s.anchor.float !== f.id) { f.setDynamicProperty("shipwright:tied", undefined); continue; }
          const t = tieSpot(fp, boat.location);
          if (!t.slack) { s.anchor.x = t.x; s.anchor.z = t.z; }
        }
        const n = normalOf(f);
        if (!n) continue;
        for (const boat of f.dimension.getEntities({ families: ["shipwright_boat"], location: fp, maxDistance: REACH * PHI + 4 })) {   // vision: her reach plus a long beam
          const s = boatStateOf(boat);
          if (!s || s.anchor) continue;
          const half = (s.stats?.beam ?? 1) / 2;
          const a = alongside(fp, n, boat.location, half, s.speed ?? 0);
          if (!a.has) continue;
          s.fendered = system.currentTick ?? 0;
          const v = boat.getVelocity();
          const into = v.x * n.x + v.z * n.z;               // her way toward or off the dock
          const want = (a.x - boat.location.x) * n.x + (a.z - boat.location.z) * n.z;
          const k = want * PULL - into;
          boat.applyImpulse({ x: n.x * k, y: 0, z: n.z * k });
        }
      } catch (err) {
        console.warn(`[Shipwright] Float: ${err}`);
      }
    }
  }
}

export function startMoorings() {
  world.afterEvents.itemUse?.subscribe((ev) => {
    if (ev.itemStack?.typeId !== FLOAT) return;
    const p = ev.source;
    system.run(() => {
      try {
        const msg = setFloat(p);
        if (msg) p.onScreenDisplay?.setActionBar?.(msg);
      } catch (err) {
        console.warn(`[Shipwright] Float: ${err}`);
      }
    });
  });
  world.beforeEvents.playerInteractWithEntity?.subscribe((ev) => {
    if (ev.target?.typeId !== FLOAT) return;
    ev.cancel = true;
    const f = ev.target, p = ev.player;
    system.run(() => {
      try {
        const msg = useFloat(f, p);
        if (msg) p.onScreenDisplay?.setActionBar?.(msg);
      } catch (err) {
        console.warn(`[Shipwright] Float: ${err}`);
      }
    });
  });
  world.afterEvents.entityHitEntity?.subscribe((ev) => {
    if (ev.hitEntity?.typeId !== FLOAT || ev.damagingEntity?.typeId !== "minecraft:player") return;
    try {
      takeUp(ev.hitEntity, ev.damagingEntity);
    } catch (err) {
      console.warn(`[Shipwright] Float: ${err}`);
    }
  });
  system.runInterval(mooringsTick, TICK);
}
