// Walkable decks for medium and large ships.
//
// Bedrock can't carry a walking player along on a moving entity, so a ship's deck is walkable
// while it's stopped: anchored, tied up with a lead, beached, or lying in a dock. It lays invisible
// barrier blocks in the top layer of water under its hull, so players stand at the waterline inside
// the hull, and lifts them (putting the water back exactly) when it gets under way. Everyone on deck
// is seated at a crew station first; with too few stations it won't get under way.
import { world } from "@minecraft/server";
import { WATER } from "./config/yards.js";

const DECKS = "shipwright:decks";          // world property: ship id -> the blocks it replaced
export const DECK_MIN_LENGTH = 11;         // medium and large ships only
const BARRIER = "minecraft:barrier";
const OWN_FOOTPRINT = 1.5;                 // half the large collision box (3 blocks wide), around the centre

function load() {
  try {
    return JSON.parse(world.getDynamicProperty(DECKS) ?? "{}");
  } catch {
    return {};
  }
}
function save(all) {
  world.setDynamicProperty(DECKS, JSON.stringify(all));
}

import { forwardOf as forward, ShipFrame } from "./frame.js";

/** The block cells under a hull: along its length from stern to bow, across its beam, narrowing at the ends. */
export function hullCells(at, heading, h) {
  const f = forward(heading);
  const k = -(h.helmAt ?? 0);                    // the craft's centre lies this far ahead of the origin (the helm)
  const pos = { x: at.x + f.x * k, z: at.z + f.z * k };
  const r = { x: -f.z, z: f.x };
  const H = h.half ?? h.length / 2;              // measured from the craft's centre (the origin)
  const from = -H + 0.3, to = H - 0.3;
  const mid = 0, half = to;
  const width = (h.overallHalfWidth ?? h.beam / 2) - 0.2;   // twin hulls: across both hulls and the platform
  const cells = new Map();
  for (let a = from; a <= to; a += 0.5) {
    const taper = 1 - Math.pow(Math.abs(a - mid) / half, 4);       // full width amidships, narrow at the ends
    const hb = Math.max(0.2, width * taper);
    for (let s = -hb; s <= hb + 1e-6; s += 0.5) {
      const x = Math.floor(pos.x + f.x * a + r.x * s), z = Math.floor(pos.z + f.z * a + r.z * s);
      cells.set(`${x},${z}`, { x, z });
    }
  }
  return [...cells.values()];
}

/** Lays the deck: barriers in the top water layer under the hull (only ever replacing water). */
export function layDeck(e, h, heading) {
  const all = load();
  if (all[e.id]) return all[e.id].cells.length;
  const dim = e.dimension;
  const y = Math.floor(e.location.y);                      // the water block the hull floats in
  const up = h.deckUp ?? 0;                                // a deep hull's top deck: walked at the rail
  const placed = [];
  const fills = (b) => b && (WATER.has(b.typeId) || (up > 0 && b.typeId === "minecraft:air"));
  // Keep clear of the boat's own footprint, so it never comes to rest on its own deck and lose buoyancy.
  const clear = OWN_FOOTPRINT + 0.5;
  for (const { x, z } of hullCells(e.location, heading, h)) {
    // Under the boat's own footprint the deck goes one block lower, so the hull never rests on it
    // (and loses its buoyancy) but nobody standing amidships falls through.
    const own = up === 0 && Math.abs(x + 0.5 - e.location.x) < clear && Math.abs(z + 0.5 - e.location.z) < clear;
    const yy = up > 0 ? y + up : own ? y - 1 : y;          // a raised deck is already clear of the hull's own box
    try {
      const b = dim.getBlock({ x, y: yy, z });
      if (!fills(b)) continue;
      placed.push([x, yy, z, b.typeId]);
      b.setType(BARRIER);
    } catch {
      /* unloaded */
    }
  }
  // The gunwale and masts stand up from the deck: hop over the rail, walk round the mast.
  const deckCells = hullCells(e.location, heading, h);
  for (const c of solidCells(e.location, heading, h, deckCells)) {
    if (c.part === "gunwale") {
      // Alongside a quay or walkway the rail stays open: step straight aboard.
      try {
        const below = dim.getBlock({ x: c.x, y: y + up, z: c.z });
        if (!below || !(WATER.has(below.typeId) || below.typeId === "minecraft:air")) continue;
      } catch {
        continue;
      }
    }
    for (const k of c.up) {
      try {
        const b = dim.getBlock({ x: c.x, y: y + up + k, z: c.z });
        if (!b || b.typeId !== "minecraft:air") continue;
        placed.push([c.x, y + up + k, c.z, "minecraft:air"]);
        b.setType(BARRIER);
      } catch {
        /* unloaded */
      }
    }
  }
  all[e.id] = { d: dim.id, at: [e.location.x, e.location.z], cells: placed };
  save(all);
  return placed.length;
}

/** Lifts the deck, putting back exactly what it replaced. Works from just the ship's id. */
export function liftDeck(id) {
  const all = load();
  for (const blk of Object.values(all[`${id}:walkers`] ?? {})) {   // walkers' support blocks too
    try {
      const b = world.getDimension(blk.d).getBlock(blk);
      if (b?.typeId === BARRIER) b.setType(blk.was);
    } catch {
      /* unloaded */
    }
  }
  if (all[`${id}:walkers`]) {
    delete all[`${id}:walkers`];
    save(all);
  }
  const deck = all[id];
  if (!deck) return 0;
  const dim = world.getDimension(deck.d);
  for (const [x, y, z, type] of deck.cells) {
    try {
      const b = dim.getBlock({ x, y, z });
      if (b?.typeId === BARRIER) b.setType(type);
    } catch {
      /* unloaded: the barrier stays until the area loads and the ship lays or lifts again */
    }
  }
  delete all[id];
  save(all);
  return deck.cells.length;
}

export const deckOf = (id) => load()[id] ?? null;

/** Players standing on the deck (inside the hull, not seated). */
export function walkersOn(e, h, heading) {
  const cells = new Set(hullCells(e.location, heading, h).map((c) => `${c.x},${c.z}`));
  const riders = new Set((e.getComponent("minecraft:rideable")?.getRiders() ?? []).map((r) => r.id));
  return world.getAllPlayers().filter((p) =>
    p.dimension.id === e.dimension.id && !riders.has(p.id) &&
    Math.abs(p.location.y - e.location.y - (h.deckUp ?? 0)) < 2.5 && cells.has(`${Math.floor(p.location.x)},${Math.floor(p.location.z)}`));
}

/**
 * All hands to stations: seats everyone on deck before the ship gets under way.
 * Returns true if everyone has a seat (the deck can lift), false if there weren't enough.
 */
export function crewToStations(e, h, heading) {
  const rideable = e.getComponent("minecraft:rideable");
  for (const p of walkersOn(e, h, heading)) {
    let seated = false;
    try {
      seated = rideable?.addRider(p) ?? false;
    } catch {
      seated = false;
    }
    if (!seated) return false;
  }
  return true;
}

// ---------- walking on deck under way ----------
//
// A walker's place is kept in the ship's own frame: each tick the script adds only the ship's own
// movement and turning to their position, so their own steps carry on as normal while the ship
// moves under them. A single invisible block follows each walker under their feet, and their place
// stays on the deck: inside the hull, narrowing at the ends, like walking on rails.

/** A point's place on the deck: along (blocks forward of the helm) and across (to starboard). */
function local(pos, shipPos, heading) {
  const { along, across } = new ShipFrame(shipPos, heading).toLocal(pos);
  return { a: along, s: across };
}

function world2(shipPos, heading, a, s) {
  const p = new ShipFrame(shipPos, heading).toWorld(a, s);
  return { x: p.x, z: p.z };
}

/** Keeps a deck place inside the hull's outline (narrower toward the ends). */
export function clampToDeck(along, s, h) {
  const off = -(h.helmAt ?? 0);                  // places are measured from the helm; the deck from the centre
  const a = along - off;
  const H = h.half ?? h.length / 2;
  const from = -H + 0.4, to = H - 0.5;
  const ca = Math.min(to, Math.max(from, a));
  const half = Math.max(from * -1, to);
  const width = (h.overallHalfWidth ?? h.beam / 2) - 0.45;
  const hb = Math.max(0.15, width * (1 - Math.pow(Math.abs(ca) / half, 4)));
  let pa = ca, ps = Math.min(hb, Math.max(-hb, s));
  // Masts: a walker is pushed round a mast, never through it (out along whichever way is shorter).
  for (const m of h.mastsAt ?? []) {
    const da = pa - m, R = MAST_CLEAR;
    if (Math.abs(da) < R && Math.abs(ps) < R) {
      if (R - Math.abs(ps) < R - Math.abs(da) && hb > R) ps = Math.sign(ps || 1) * R;
      else pa = m + Math.sign(da || -1) * R;
    }
  }
  return { a: pa + off, s: ps };
}
const MAST_CLEAR = 0.55;                    // a player's half-width plus the mast's

/**
 * Solid parts that stand on the deck while it's laid: the gunwale (a ring of barriers a block up,
 * just outside the hull's cells, so you can hop over it but not walk through it) and each mast
 * (a column two blocks high). Only ever replaces air. Cells: the deck's own.
 */
export function solidCells(at, heading, h, deckCells) {
  const inside = new Set(deckCells.map((c) => `${c.x},${c.z}`));
  const out = new Map();
  const F = new ShipFrame(at, heading, h);
  const centre = F.centre();
  const fwd = F.f;
  for (const c of deckCells) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${c.x + dx},${c.z + dz}`;
      if (inside.has(k)) continue;
      // A boarding gap each side amidships, so you can climb aboard from the water.
      const along = (c.x + dx + 0.5 - centre.x) * fwd.x + (c.z + dz + 0.5 - centre.z) * fwd.z;
      if (Math.abs(along) < 0.75) continue;
      out.set(k, { x: c.x + dx, z: c.z + dz, up: [1], part: "gunwale" });
    }
  }
  for (const m of h.mastsAt ?? []) {
    const p = F.fromCentre(m, 0);
    const x = Math.floor(p.x), z = Math.floor(p.z);
    out.set(`${x},${z}`, { x, z, up: [1, 2], part: "mast" });
  }
  return [...out.values()];
}

/** Records support blocks in the world registry too, so they're always put back (even if the ship is destroyed). */
// Walker support blocks move every tick; the registry is written at most once a second.
const pendingWalkers = new Map();
let flushAt = 0;
function remember(shipId, playerId, block) {
  pendingWalkers.set(`${shipId}|${playerId}`, { shipId, playerId, block });
  const now = Date.now();
  if (block && now - flushAt < 1000) return;      // releases are written straight away
  flushWalkers();
  flushAt = now;
}
export function flushWalkers() {
  if (!pendingWalkers.size) return;
  const all = load();
  for (const { shipId, playerId, block } of pendingWalkers.values()) {
    const key = `${shipId}:walkers`;
    all[key] = all[key] ?? {};
    if (block) all[key][playerId] = block;
    else delete all[key][playerId];
    if (!Object.keys(all[key]).length) delete all[key];
  }
  pendingWalkers.clear();
  try {
    save(all);
  } catch (err) {
    console.warn(`[Shipwright] Saving deck walkers failed: ${err}`);
  }
}

/** Moves a walker's support block to the cell under them, putting back what the old one replaced. */
function support(e, w, x, z, up = 0) {
  const dim = e.dimension;
  const y = Math.floor(e.location.y) + up;                   // a raised top deck: the block under its walkers
  const cell = { x: Math.floor(x), y, z: Math.floor(z) };
  if (w.block && w.block.x === cell.x && w.block.z === cell.z && w.block.y === y) return;
  const near = up === 0 && Math.abs(cell.x + 0.5 - e.location.x) < OWN_FOOTPRINT + 0.5 && Math.abs(cell.z + 0.5 - e.location.z) < OWN_FOOTPRINT + 0.5;
  if (near) cell.y = y - 1;                                  // the boat's own footprint: a block lower
  if (w.block && w.block.x === cell.x && w.block.z === cell.z && w.block.y === cell.y) return;
  releaseSupport(dim, w, e.id);
  try {
    const b = dim.getBlock(cell);
    if (b && (WATER.has(b.typeId) || (up > 0 && b.typeId === "minecraft:air"))) {
      w.block = { ...cell, was: b.typeId, d: dim.id };
      b.setType(BARRIER);
      remember(e.id, w.player.id, w.block);
    }
  } catch {
    /* unloaded */
  }
}

function releaseSupport(dim, w, shipId = null) {
  if (!w.block) return;
  try {
    const b = dim.getBlock(w.block);
    if (b?.typeId === BARRIER) b.setType(w.block.was);
  } catch {
    /* unloaded */
  }
  if (shipId) remember(shipId, w.player.id, null);
  w.block = null;
}

/** Starts carrying everyone standing on the deck (called as the ship gets under way). */
export function boardWalkers(e, s, h) {
  s.walkers = s.walkers ?? new Map();
  for (const p of walkersOn(e, h, s.heading)) if (!s.walkers.has(p.id)) s.walkers.set(p.id, { player: p, block: null });
  s.pose = { x: e.location.x, z: e.location.z, heading: s.heading };
}

/** Lets a walker go: their support block is put back, and they're on their own. */
export function dropWalker(e, s, id) {
  const w = s.walkers?.get(id);
  if (!w) return;
  releaseSupport(e.dimension, w, e.id);
  s.walkers.delete(id);
}

/**
 * Each tick under way: carries every walker with the ship's movement and turning, keeps them on
 * the deck, and moves their support block. Sneaking lets go (step off into the water).
 */
export function carryWalkers(e, s, h) {
  if (!s.walkers?.size) {
    s.pose = { x: e.location.x, z: e.location.z, heading: s.heading };
    return;
  }
  const last = s.pose ?? { x: e.location.x, z: e.location.z, heading: s.heading };
  const now = { x: e.location.x, z: e.location.z, heading: s.heading };
  const riders = new Set((e.getComponent("minecraft:rideable")?.getRiders() ?? []).map((r) => r.id));
  for (const [id, w] of [...s.walkers]) {
    const p = w.player;
    const gone = !p?.isValid || p.dimension?.id !== e.dimension.id || riders.has(id) ||
      Math.abs(p.location.y - e.location.y - (h.deckUp ?? 0)) > 3 || Math.hypot(p.location.x - now.x, p.location.z - now.z) > h.length + 3;
    if (gone || p.isSneaking) {
      dropWalker(e, s, id);
      continue;
    }
    // Where they stand on deck (from where the ship was), then where that spot is now.
    const here = local(p.location, last, last.heading);
    // A standing helmsman stays at the helm (the ship's origin) whatever their feet do.
    const kept = s.standing?.id === id ? { a: 0, s: 0 } : clampToDeck(here.a, here.s, h);
    const to = world2(now, now.heading, kept.a, kept.s);
    if (Math.hypot(to.x - p.location.x, to.z - p.location.z) > 0.002) {
      try {
        p.teleport({ x: to.x, y: p.location.y, z: to.z }, { keepVelocity: true, checkForBlocks: false });
      } catch {
        /* this tick */
      }
    }
    support(e, w, to.x, to.z, h.deckUp ?? 0);
  }
  s.pose = now;
}

export const _deckTest = { local, world2 };
