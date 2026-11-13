// What the crew does with the fitted modules: sleep aboard, keep a lookout, ram, fight from the
// castle and the rail, fire the crossbow and the guns, and work a wreck under the diving bell.
//
// Each effect is a small law over the ship's state and the module list (pure where it can be), with
// a thin projection into the game (an arrow spawned, a heal, an effect). The ship's state comes from
// the steering (heading, speed); nothing here moves a ship.
import { world, system } from "@minecraft/server";
import { readRecord, writeRecord, seaChest } from "./ship.js";
import { boatStateOf, helmOf, hullHit, loseWay } from "./steering.js";
import { ShipFrame, forwardOf, starboardOf } from "./frame.js";
import { countItems, consumeCosts, isCreative } from "./inventory.js";
import { shieldsAboard } from "./shields.js";
import { warnOnce } from "./warn.js";

import { DIMENSIONS } from "./dims.js";
const BERTH = "shipwright:berth";
const SHOT_TAG = "sw_shot";

export const has = (rec, key) => (rec?.modules ?? []).includes(key);
/** A deckhouse is a bunk and a hold in one. */
export const hasBunk = (rec) => has(rec, "bunk") || has(rec, "deckhouse");
export const hasHold = (rec) => has(rec, "hold") || has(rec, "deckhouse");

// ---------------------------------------------------------------- the laws (pure)

/** Ramming: the blow a ram strikes at this speed (blocks a tick), or 0 below ramming speed. */
export const RAM_SPEED = 0.12;
export function ramBlow(speed) {
  const v = Math.abs(speed);
  if (v < RAM_SPEED) return 0;
  return { damage: Math.round(10 + (v - RAM_SPEED) * 60), wear: (v - RAM_SPEED) * 0.9 + 0.04, own: 0.01 + (v - RAM_SPEED) * 0.08 };
}

/** The castle: arrows loosed from a raised platform fly a quarter faster (further and harder). */
export const CASTLE_BOOST = 0.25;

/** The shield rail: shields aboard turn arrows. Share of an arrow's damage taken back, by shields aboard. */
export function shieldCover(rec) {
  if (!has(rec, "shield_rail")) return 0;
  const n = shieldsAboard(rec);
  return n ? Math.min(0.6, 0.2 + 0.05 * n) : 0;
}

/** Which gun a gunner works: the cannon when looking out over the side, the crossbow otherwise. */
export function gunFor(rec, lookAcross) {
  if (has(rec, "cannon") && Math.abs(lookAcross) > 0.6) return "cannon";
  if (has(rec, "crossbow")) return "crossbow";
  if (has(rec, "cannon")) return "cannon";
  return null;
}

/** The diving bell: who breathes from it (a point within 3 blocks of her middle, below the water). */
export function underBell(shipCentre, p) {
  const dx = p.x - shipCentre.x, dz = p.z - shipCentre.z, dy = shipCentre.y - p.y;
  return Math.hypot(dx, dz) <= 3 && dy > 0.5 && dy <= 14;
}

// ---------------------------------------------------------------- finding ships and crews

function shipById(id) {
  for (const d of DIMENSIONS) {
    try {
      const b = world.getDimension(d).getEntities({ families: ["shipwright_boat"] }).find((x) => x.id === id);
      if (b) return b;
    } catch {
      /* dimension not loaded */
    }
  }
  return null;
}

/** The ship a player is aboard: riding it, or standing on its laid or carried deck. */
export function shipOf(player) {
  try {
    const r = player.getComponent("minecraft:riding")?.entityRidingOn;
    if (r?.typeId?.startsWith("shipwright:")) return r;
  } catch {
    /* not riding */
  }
  try {
    for (const b of player.dimension.getEntities({ families: ["shipwright_boat"], location: player.location, maxDistance: 22 })) {
      const s = boatStateOf(b);
      const h = s?.stats;
      if (!h || h.length < 11) continue;
      const loc = new ShipFrame(b.location, s.heading, h).toLocal(player.location);
      const along = loc.along + h.helmAt;                   // from the centre
      if (Math.abs(along) <= h.half && Math.abs(loc.across) <= (h.overallHalfWidth ?? h.beam / 2) + 0.3 &&
        Math.abs(player.location.y - b.location.y - (h.deckUp ?? 0)) < 2.5) return b;
    }
  } catch {
    /* none */
  }
  return null;
}

// ---------------------------------------------------------------- bunk: a berth aboard

/** Using a bed aboard a ship with a bunk (or deckhouse) makes it your berth: you wake aboard. */
export function takeBerth(player, boat) {
  const rec = readRecord(boat);
  if (!rec || !hasBunk(rec)) return "";
  player.setDynamicProperty(BERTH, boat.id);
  return `Your berth is aboard ${rec.name || "the ship"}: you'll wake here.`;
}

/** After respawning: back aboard your ship, if she's afloat and nearby enough to be loaded. */
export function wakeAboard(player) {
  const id = player.getDynamicProperty(BERTH);
  if (!id) return false;
  const boat = shipById(id);
  const rec = boat && readRecord(boat);
  if (!rec || !hasBunk(rec)) {
    player.sendMessage("§7Your ship couldn't be found (too far, or gone): you woke ashore.");
    if (!boat) player.setDynamicProperty(BERTH, undefined);
    return false;
  }
  const st = boatStateOf(boat);
  const h = st?.stats;
  const up = (h?.deckUp ?? 0) + 1.1;
  // at the helm's station, on a hull (twin hulls: the starboard one, not the water between)
  const lines = h?.hullLines ?? [0];
  const across = lines.reduce((a, c) => (Math.abs(c) > Math.abs(a) ? c : a), 0);
  const at = h ? new ShipFrame(boat.location, st.heading, h).toWorld(h.modelScale > 1 ? h.modelScale * 0.5 : 0, Math.abs(across)) : boat.location;
  player.teleport({ x: at.x, y: Math.floor(boat.location.y) + up, z: at.z }, { dimension: boat.dimension });
  player.sendMessage(`§7You wake in your bunk aboard ${rec.name || "the ship"}.`);
  return true;
}

// ---------------------------------------------------------------- where a ship is

/** A ship's hull in the world: her frame and handling, or null. */
function hullOf(boat) {
  const s = boatStateOf(boat);
  const h = s?.stats;
  return h ? { s, h, F: new ShipFrame(boat.location, s.heading, h) } : null;
}

/**
 * Whether a world point is inside a ship's hull (pad: blocks of slack all round), and where:
 * { along } from her centre (+ forward), or null. Twin hulls are two hulls with water between;
 * an outrigger's float counts as hull, and so does a twin's bridge-deck pod.
 */
export function inHull(origin, F, h, p, pad = 0.25) {
  const loc = F.toLocal(p);
  const along = loc.along + (h.helmAt ?? 0);                // from the centre
  if (Math.abs(along) > (h.half ?? h.length / 2) + pad) return null;
  const dy = p.y - origin.y;
  if (dy < -0.6 - (h.draft ?? 0.5) || dy > (h.rail ?? 1) + (h.deckUp ?? 0) + 0.6 + pad) return null;
  const half = (h.beamEach ?? h.beam ?? 1.5) / 2 + pad;
  const onHull = (h.hullLines ?? [0]).some((c) => Math.abs(loc.across - c) <= half);
  const onFloat = h.float && Math.abs(loc.across - h.float.across) <= 0.6 + pad && Math.abs(along) <= h.float.half + pad;
  const onPod = (h.podHalf ?? 0) > 0 && Math.abs(loc.across) <= h.podHalf + pad;   // a twin's bridge-deck pod
  return onHull || onFloat || onPod ? { along, across: loc.across } : null;
}

/** The hull zone a point along her lies in: the fore third is the bow, the after third the stern. */
export function zoneAt(h, along) {
  const k = along / (h.half ?? h.length / 2);
  return k > 1 / 3 ? "bow" : k < -1 / 3 ? "stern" : "mid";
}

/** The ships whose hull holds this point (other than skip), with where it struck. */
export function shipsAt(dim, p, skip = null, pad = 0.25) {
  const out = [];
  for (const b of dim.getEntities({ families: ["shipwright_boat"], location: p, maxDistance: 48 })) {
    if (b.id === skip || !b.typeId?.startsWith("shipwright:")) continue;
    const hb = hullOf(b);
    const at = hb && inHull(b.location, hb.F, hb.h, p, pad);
    if (at) out.push({ boat: b, h: hb.h, zone: zoneAt(hb.h, at.along), ...at });
  }
  return out;
}

// ---------------------------------------------------------------- what a blow does

/** Hull wear a round shot does: a small hull is holed by a few, a great ship takes a broadside or two. */
export const shotWear = (h) => 0.16 / (h.modelScale ?? 1) ** 0.75;
/** Chain shot tears sails: share of the sail's condition one strike takes. */
export const CHAIN_SAIL = 0.2;

/**
 * Ramming a ship: the blow, set by the closing speed and the two ships' weights (a light boat
 * bounces off a heavy one). With a ram the copper cap takes most of the shock; without one the
 * striker's own bow suffers more than the side she hits.
 */
export function collisionLaw(speed, mine, theirs, rammed) {
  const blow = ramBlow(speed);
  if (!blow) return null;
  const ratio = Math.min(2, Math.max(0.3, (mine.weight ?? 1) / (theirs.weight ?? 1)));
  const toughness = (theirs.modelScale ?? 1) ** 0.5;
  return rammed
    ? { theirs: (blow.wear * ratio) / toughness, own: blow.own, keep: 0.3 }
    : { theirs: (blow.wear * ratio * 0.4) / toughness, own: (blow.wear * 0.6) / (mine.modelScale ?? 1) ** 0.5 * (mine.sewnSeams ? 0.5 : 1), keep: 0.25 };
}

/** Wears a struck ship's hull in a zone (or her sail), through the steering's wear: she founders if holed through. */
export function damageShip(boat, amount, zone = "mid") {
  try {
    return hullHit(boat, zone, amount);
  } catch (err) {
    warnOnce("damage", `[Shipwright] Damage: ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------- gunnery

const cooldown = new Map();          // key -> tick it's ready again
const ready = (key, ticks) => {
  const t = system.currentTick ?? 0;
  if ((cooldown.get(key) ?? -1) > t) return false;
  cooldown.set(key, t + ticks);
  return true;
};

/** Shots in flight: projectile id -> { p, from (the firing ship), kind, owner }. */
const shots = new Map();
const CHAIN_IDS = ["minecraft:iron_chain", "minecraft:chain"];
export const GUN_SPEED = 2.4;          // blocks a tick at the muzzle
export const GUN_RELOAD = 60;
export const MOUNT_TAG = "sw_mount";   // arrows from the crossbow mount (already castle-boosted)

function shoot(dim, type, at, velocity, owner, tag) {
  const p = dim.spawnEntity(type, at);
  if (tag) p.addTag(tag);
  const pc = p.getComponent?.("minecraft:projectile");
  if (pc?.shoot) {
    if (owner) pc.owner = owner;
    pc.shoot(velocity);
  } else p.applyImpulse(velocity);
  return p;
}

/** The gun's elevation from where the gunner looks: level fire, or up to a long lob. */
export const elevationFor = (lookUp) => Math.max(-0.05, Math.min(0.5, 0.08 + lookUp * 0.8));

function holding(player, ids) {
  try {
    const it = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    return !!it && ids.includes(it.typeId);
  } catch {
    return false;
  }
}

/**
 * A gunner (aboard, not at the helm; seated, or standing on deck) fires: the crossbow at the rail
 * along their aim, or a broadside gun out over the side they face, lifted as they look up. Holding
 * a chain loads chain shot (for sails). Ammunition from their own pack, then the sea chest.
 * Returns a message, or "".
 */
export function fire(player, boat) {
  const rec = readRecord(boat);
  const hb = hullOf(boat);
  if (!rec || !hb || rec.stage !== 5) return "";
  if (helmOf(boat)?.id === player.id) return "";
  const { s, h, F } = hb;
  const view = player.getViewDirection?.() ?? { x: 0, y: 0, z: 1 };
  const r = starboardOf(s.heading);
  const across = view.x * r.x + view.z * r.z;
  const gun = gunFor(rec, across);
  if (!gun) return "";
  const supply = [seaChest(boat)].filter(Boolean);
  const free = isCreative(player);
  const dim = boat.dimension;
  if (gun === "crossbow") {
    if (!ready(`xbow|${player.id}`, 20)) return "";
    if (!free && countItems(player, ["minecraft:arrow"], supply) < 1) return "The crossbow needs arrows.";
    if (!free) consumeCosts(player, [{ ids: ["minecraft:arrow"], count: 1, label: "Arrow" }], supply);
    const head = player.getHeadLocation?.() ?? { ...player.location, y: player.location.y + 1.6 };
    const k = 3.2 * (has(rec, "castle") ? 1 + CASTLE_BOOST : 1);
    shoot(dim, "minecraft:arrow", { x: head.x + view.x, y: head.y + view.y, z: head.z + view.z }, { x: view.x * k, y: view.y * k, z: view.z * k }, player, MOUNT_TAG);
    return "";
  }
  const chain = holding(player, CHAIN_IDS);
  if (!ready(`gun|${boat.id}`, GUN_RELOAD)) return "The guns are reloading.";
  const cost = [{ ids: ["minecraft:gunpowder"], count: 1, label: "Gunpowder" },
    chain ? { ids: CHAIN_IDS, count: 1, label: "Chain" } : { ids: ["minecraft:iron_nugget"], count: 1, label: "Iron Nugget" }];
  if (!free && cost.some((c) => countItems(player, c.ids, supply) < c.count)) {
    cooldown.delete(`gun|${boat.id}`);
    return chain ? "Chain shot needs gunpowder and a chain." : "The guns need gunpowder and iron nuggets.";
  }
  if (!free) consumeCosts(player, cost, supply);
  const side = Math.sign(across) || 1;
  const at = gunport(F, h, side);
  const v = boat.getVelocity?.() ?? { x: 0, y: 0, z: 0 };
  const up = elevationFor(view.y);
  const p = shoot(dim, "minecraft:snowball", at, { x: r.x * side * GUN_SPEED + v.x, y: up, z: r.z * side * GUN_SPEED + v.z }, player, SHOT_TAG);
  shots.set(p.id, { p, from: boat.id, kind: chain ? "chain" : "round", owner: player });
  try {
    dim.spawnParticle("minecraft:large_explosion", at);
    dim.playSound?.("random.explode", at, { volume: 0.6 });
  } catch {
    /* cosmetic */
  }
  return "";
}

/** Where a broadside gun's muzzle is: out through a gunport on that side, amidships, under the rail. */
export function gunport(F, h, side) {
  const out = (h.overallHalfWidth ?? h.beam / 2) + 0.6;
  return F.fromCentre(0, side * out, Math.max(0.9, Math.min((h.rail ?? 1) - 0.2, 1 + (h.deckUp ?? 0) * 0.5)));
}

/**
 * Shots in flight, each tick: one that passes into a ship's hull strikes her there (her collision
 * box is only her middle, so the game alone would let a shot through a long hull); one that falls
 * into the sea is spent with a splash. Returns what happened, for the lab.
 */
export function shotTick(dim = null) {
  const out = [];
  for (const [id, sh] of shots) {
    const p = sh.p;
    if (!p?.isValid) {
      shots.delete(id);
      continue;
    }
    if (dim && p.dimension !== dim) continue;
    const at = p.location;
    const v = p.getVelocity?.() ?? { x: 0, y: 0, z: 0 };
    const n = Math.max(1, Math.ceil(Math.hypot(v.x, v.y, v.z) / 0.5));
    let hit = null, q = at;
    for (let i = 0; i <= n && !hit; i++) {
      q = { x: at.x + (v.x * i) / n, y: at.y + (v.y * i) / n, z: at.z + (v.z * i) / n };
      hit = shipsAt(p.dimension, q, sh.from, 0.1)[0] ?? null;
    }
    if (hit) {
      shots.delete(id);
      shotLands(p.dimension, q, hit, sh.owner, sh.kind);
      out.push({ hit: hit.boat.id, zone: hit.zone, kind: sh.kind, at: q });
      try { p.remove(); } catch { /* gone */ }
      continue;
    }
    const b = p.dimension.getBlock?.({ x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z) });
    if (b && /water/.test(b.typeId)) {
      shots.delete(id);
      out.push({ splash: true, at });
      try {
        p.dimension.spawnParticle("minecraft:water_splash_particle_manual", at);
        p.remove();
      } catch { /* gone */ }
    }
  }
  return out;
}

/**
 * A gun's shot lands: round shot bursts (it hurts what's near but leaves the blocks standing) and
 * holes a ship where it strikes; chain shot tears her sail and cuts down anyone in its way.
 */
export function shotLands(dim, at, hit, owner, kind = "round") {
  if (kind === "round") {
    try {
      dim.createExplosion(at, 1.6, { breaksBlocks: false, causesFire: false, source: owner });
    } catch (err) {
      warnOnce("shot", `[Shipwright] Shot: ${err}`);
    }
  }
  if (!hit?.boat) return;
  if (kind === "chain") damageShip(hit.boat, CHAIN_SAIL, "sail");
  else damageShip(hit.boat, shotWear(hit.h), hit.zone);
}

// ---------------------------------------------------------------- ramming

/**
 * One collision check for a ship under way. Another ship whose hull her stem reaches takes the blow
 * (any ship: with a ram, it's a weapon; without, both suffer); with a ram, creatures at her bow are
 * hurt and thrown aside. Returns the number struck.
 */
export function ramCheck(boat) {
  const rec = readRecord(boat);
  const hb = hullOf(boat);
  if (!rec || !hb) return 0;
  const { s, h, F } = hb;
  const rammed = has(rec, "ram");
  const dir = Math.sign(s.speed ?? 0);
  if (Math.abs(s.speed ?? 0) < 0.02 || !dir) return 0;
  const stem = F.fromCentre(dir * ((h.half ?? h.length / 2) + 0.3), 0, 0.4);
  const f = forwardOf(s.heading);
  const towed = new Set([boat.getDynamicProperty?.("shipwright:towedBy")].filter(Boolean));
  let hits = 0;
  for (const t of shipsAt(boat.dimension, stem, boat.id, 0.3)) {
    if (towed.has(t.boat.id) || t.boat.getDynamicProperty?.("shipwright:towedBy") === boat.id) continue;
    const c = collisionLaw(s.speed, h, t.h, rammed);
    // A slow touch, or still against her after the blow: stopped there, not hurt again.
    if (!c || !ready(`ram|${boat.id}|${t.boat.id}`, 20)) {
      loseWay(boat, 0);
      continue;
    }
    hits++;
    damageShip(t.boat, c.theirs, t.zone);
    damageShip(boat, c.own, dir > 0 ? "bow" : "stern");
    loseWay(boat, c.keep);
    try {
      boat.dimension.playSound?.("random.break", stem, { volume: 0.8 });
    } catch {
      /* cosmetic */
    }
  }
  const blow = ramBlow(s.speed);
  if (!rammed || dir < 0 || !blow) return hits;
  const riders = new Set((boat.getComponent("minecraft:rideable")?.getRiders() ?? []).map((r) => r.id));
  for (const t of boat.dimension.getEntities({ location: stem, maxDistance: 1.8 })) {
    if (t.id === boat.id || riders.has(t.id) || t.typeId?.startsWith("shipwright:") || /item|xp_orb|arrow|snowball/.test(t.typeId)) continue;
    if (!ready(`ram|${boat.id}|${t.id}`, 20)) continue;
    hits++;
    try {
      t.applyDamage(blow.damage, { cause: "entityAttack", damagingEntity: boat });
    } catch {
      /* can't be hurt */
    }
    try {
      t.applyImpulse({ x: f.x * Math.abs(s.speed) * 2, y: 0.2, z: f.z * Math.abs(s.speed) * 2 });
    } catch {
      /* immovable */
    }
    loseWay(boat, 0.85);
  }
  return hits;
}

// ---------------------------------------------------------------- the diving bell

/** Anyone working below a resting ship with a diving bell breathes from it. */
export function bellCheck(boat) {
  const rec = readRecord(boat);
  if (!has(rec, "diving_bell")) return 0;
  const s = boatStateOf(boat);
  if (!s?.stats || Math.abs(s.speed ?? 0) > 0.02) return 0;
  const centre = { ...new ShipFrame(boat.location, s.heading, s.stats).centre(), y: boat.location.y };
  let n = 0;
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== boat.dimension.id || !underBell(centre, p.location)) continue;
    try {
      p.addEffect("water_breathing", 80, { showParticles: false });
      n++;
    } catch {
      /* effect refused */
    }
  }
  return n;
}

// ---------------------------------------------------------------- wiring

export function startCrew() {
  // Gunners: anyone seated aboard but not at the helm fires with Jump (the helm's Jump works the
  // anchor); anyone standing on her deck fires with Jump while sneaking.
  const held = new Map();
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      let pressed = false;
      try {
        pressed = String(p.inputInfo.getButtonState("Jump")) === "Pressed";
      } catch {
        pressed = false;
      }
      const was = held.get(p.id);
      held.set(p.id, pressed);
      if (!pressed || was) continue;
      try {
        let boat = p.getComponent("minecraft:riding")?.entityRidingOn;
        if (!boat?.typeId?.startsWith("shipwright:")) boat = p.isSneaking ? shipOf(p) : null;
        if (!boat) continue;
        const msg = fire(p, boat);
        if (msg) p.onScreenDisplay?.setActionBar(msg);
      } catch (err) {
        warnOnce("gunner", `[Shipwright] Gunner: ${err}`);
      }
    }
  }, 2);
  // Shots in flight, every tick; collisions and rams every other tick; bells once a second.
  system.runInterval(() => {
    try {
      shotTick();
    } catch (err) {
      warnOnce("shots", `[Shipwright] Shots: ${err}`);
    }
    if ((system.currentTick ?? 0) % 2) return;
    for (const d of DIMENSIONS) {
      try {
        for (const b of world.getDimension(d).getEntities({ families: ["shipwright_boat"] })) {
          ramCheck(b);
          if ((system.currentTick ?? 0) % 20 === 0) bellCheck(b);
        }
      } catch (err) {
        warnOnce("crew-loop", `[Shipwright] Crew: ${err}`);
      }
    }
  }, 1);

  // A shot the game stops first (it struck a block, or a ship's own box, or a creature).
  const landed = (ev, entity) => {
    const p = ev.projectile;
    const sh = p && shots.get(p.id);
    if (!sh) return;
    shots.delete(p.id);
    const hit = entity?.typeId?.startsWith("shipwright:") ? shipsAt(ev.dimension, ev.location, sh.from, 1)[0] ?? null : null;
    if (entity?.typeId?.startsWith("shipwright:") && entity.id === sh.from) return;
    if (!entity?.typeId?.startsWith("shipwright:") && entity && sh.kind === "chain") {
      try {
        entity.applyDamage(8, { cause: "projectile", damagingEntity: sh.owner });
      } catch {
        /* can't be hurt */
      }
    }
    shotLands(ev.dimension, ev.location, hit, sh.owner, sh.kind);
  };
  world.afterEvents.projectileHitBlock?.subscribe((ev) => landed(ev, null));
  world.afterEvents.projectileHitEntity?.subscribe((ev) => landed(ev, ev.getEntityHit?.()?.entity));

  // The castle: arrows loosed by its crew fly faster.
  world.afterEvents.entitySpawn?.subscribe((ev) => {
    const a = ev.entity;
    if (a?.typeId !== "minecraft:arrow") return;
    system.run(() => {
      try {
        if (a.hasTag?.(MOUNT_TAG)) return;                       // the mount's arrows are boosted at the mount
        const owner = a.getComponent("minecraft:projectile")?.owner;
        if (owner?.typeId !== "minecraft:player") return;
        const boat = shipOf(owner);
        if (!has(readRecord(boat), "castle")) return;
        const v = a.getVelocity();
        a.applyImpulse({ x: v.x * CASTLE_BOOST, y: v.y * CASTLE_BOOST, z: v.z * CASTLE_BOOST });
      } catch {
        /* gone already */
      }
    });
  });

  // The shield rail: shields aboard take part of every arrow meant for the crew.
  world.afterEvents.entityHurt?.subscribe((ev) => {
    const p = ev.hurtEntity;
    if (p?.typeId !== "minecraft:player" || ev.damageSource?.cause !== "projectile") return;
    try {
      const cover = shieldCover(readRecord(shipOf(p)));
      if (!cover) return;
      const hp = p.getComponent("minecraft:health");
      hp?.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + ev.damage * cover));
    } catch {
      /* not aboard */
    }
  });

  // Waking aboard.
  world.afterEvents.playerSpawn?.subscribe((ev) => {
    if (ev.initialSpawn) return;
    system.runTimeout(() => {
      try {
        wakeAboard(ev.player);
      } catch (err) {
        warnOnce("berth", `[Shipwright] Berth: ${err}`);
      }
    }, 5);
  });

  // A bed used aboard a ship with a bunk: your berth.
  world.afterEvents.itemUse?.subscribe((ev) => {
    if (!/_bed$|^minecraft:bed$/.test(ev.itemStack?.typeId ?? "")) return;
    try {
      const boat = shipOf(ev.source);
      const msg = boat && takeBerth(ev.source, boat);
      if (msg) ev.source.sendMessage(`§a${msg}`);
    } catch {
      /* not aboard */
    }
  });
}
