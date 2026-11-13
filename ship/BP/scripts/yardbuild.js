// Yard upgrades: the table plans a dock, prices it by material category, and builds it for you:
// clears the headroom, digs the basin, raises the walls, sets the fittings and floods it.
// Everything it digs out comes back as items, as if mined.
import { biomeAt } from "./seaworld.js";
import { system, BlockPermutation } from "@minecraft/server";
import { DIRS, WATER, ALLOWED, TABLE_ID } from "./config/yards.js";
import { DOCK, DRY_DOCK, dockLevel, saveDock, forgetDock } from "./dock.js";
import { Canvas, ARCH, layoutYard, statesFor, dryDockWorks } from "./yardarch.js";
import { layoutVillage } from "./village.js";
import { VILLAGES, villageFor } from "./config/villages.js";
import { DockFrame } from "./frame.js";

/** The wood a post is made of (spruce from spruce_log or stripped_spruce_log), for detailing. */
const woodOf = (id = "") => id.replace(/minecraft:|stripped_|_log|_block|_stem/g, "") || "spruce";

/** Clear headroom over the dock: room for masts and for the yard's buildings. */
export const HEADROOM = 10;
const FOOTING_MAX = 6;          // how far footing reaches down under a floor before it becomes a piling


// Blocks the table will never clear: anyone's containers, shipyard blocks, the unbreakable.
const PROTECTED = /chest|barrel|shulker|hopper|furnace|smoker|dispenser|dropper|bedrock|end_portal|command|structure|shipwright:|bed$|sign$|banner$/;
const isWater = (b) => !!b && WATER.has(b.typeId);
const isOpen = (b) => !!b && ALLOWED.has(b.typeId);

function getBlock(dim, x, y, z) {
  try {
    return dim.getBlock({ x, y, z });
  } catch {
    return undefined;
  }
}

/** A cell in the dock's frame (absolute height y): see frame.js. */
const at = (o, d, u, w, y) => new DockFrame(o, d).at(u, w, y - o.y);

/** The water each way from the table: how far, and its surface height (nearest first). */
function watersAround(table) {
  const o = table.location;
  const found = [];
  for (const [name, d] of Object.entries(DIRS)) {
    search: for (let i = 1; i <= DOCK.length[1] + 2; i++) {
      for (let dy = 0; dy >= -8; dy--) {                     // look well below: the table may sit too high
        if (isWater(getBlock(table.dimension, o.x + d.x * i, o.y + dy, o.z + d.z * i))) {
          found.push({ name, d, dist: i, top: o.y + dy });
          break search;
        }
      }
    }
  }
  return found.sort((a, b) => a.dist - b.dist);
}
function nearestWater(table) {
  return watersAround(table)[0] ?? null;
}

const CHANNEL_MAX = 12;
/**
 * The dock's mouth: rows past the basin's sea end, a block wider each side than the basin, must be
 * open water at the sea's level, or a ship built inside can't get out. Returns how many rows of
 * channel must be cut before the sea opens (0: it opens straight away), or -1 if it never does.
 */
export function mouthOf(dim, o, d, top, length, left, right) {
  const F = new DockFrame(o, d);
  const open = (u) => {
    for (let w = -left - 1; w <= right + 1; w++) {
      const p = F.at(u, w, top - o.y);
      if (!isWater(getBlock(dim, p.x, p.y, p.z))) return false;
    }
    return true;
  };
  for (let k = 0; k <= CHANNEL_MAX; k++) {
    if (open(length + k) && open(length + k + 1)) return k;
  }
  return -1;
}

/**
 * Plans a dock of inside length x width from this table, toward the nearest water, in a style.
 * The basin is ringed by a walkway two slabs wide, floating half a block above the water (snow
 * doesn't settle on bottom slabs), its outer edge on pilings with bollards and harbour lights.
 * With buildings, the tradition's yard stands around it and the table moves to the gathering
 * deck, looking over the dock. Returns the layout, what it costs, what it clears, and any problem.
 */
export function planDock(table, length, width, styleIn, { buildings = true } = {}) {
  let style = styleIn;
  const dim = table.dimension;
  const o = table.location;
  // The dock runs toward whichever water it can open onto: the nearest, unless its mouth would face
  // land (a ship built inside would be trapped); then the next way round with a clear way out.
  const left0 = Math.floor((width - 1) / 2), right0 = width - 1 - left0;
  const ways = watersAround(table).map((w) => ({ ...w, channel: mouthOf(dim, o, w.d, w.top, length, left0, right0) }));
  const water = ways.find((w) => w.channel === 0) ?? ways.filter((w) => w.channel > 0).sort((a, b) => a.channel - b.channel)[0] ?? ways[0];
  if (!water) return { ok: false, reason: `No water within ${DOCK.length[1] + 2} blocks. Put the table near the shore.` };
  if (water.channel < 0) {
    return { ok: false, reason: `Every way from here the dock's mouth would open onto land, so a ship couldn't get out. Put the table where the dock can run straight out into open water.` };
  }
  const rise = o.y - water.top;
  if (rise < 1 || rise > 2) {
    return { ok: false, reason: `Put the table 1 to 2 blocks above the water so the dock floods level with the sea (it's ${rise} above).` };
  }
  if (water.dist > length + 1) {
    return { ok: false, reason: `The water is ${water.dist} blocks away: a ${length}-long dock wouldn't reach it. Choose ${water.dist - 1} or longer, or move the table closer.` };
  }
  const d = water.d;
  const F = new DockFrame(o, d);
  const at = (u, w, dy) => F.at(u, w, dy);
  const left = Math.floor((width - 1) / 2), right = width - 1 - left;
  const walls = [], edge = [], posts = [], basin = [], headroom = [], keelBlocks = [];
  // Big enough for the great ships: dug a block deeper, with keel blocks down the middle (a dry dock).
  const level = dockLevel(length, width, DRY_DOCK.depth);
  // A level 2 dock is a village dock in the look of the biome's own village (a tradition's yard is
  // for the dry dock); Custom docks stay as chosen.
  let village = null;
  if (level === 2 && !style.custom && buildings) {
    let biome = "minecraft:plains";
    try {
      biome = biomeAt(dim, o) ?? biome;
    } catch {
      /* default */
    }
    village = VILLAGES[style.village ?? villageFor(biome)];
    style = { ...style, name: village.name, wall: village.wall, deck: village.deck, base: village.found, post: village.post,
      accent: village.accent, light: village.light, every: 4, arch: null };
  }
  const every = Math.max(2, style.every ?? 4);
  const depth = level === 3 ? DRY_DOCK.depth : DOCK.depth;
  const inner = [-left - 1, right + 1], outer = [-left - 2, right + 2];
  // The walkway: the inner ring (the dock's frame) and an outer ring beside it; posts on the outer ring.
  const isPost = (u, w) => outer.includes(w) && (u === -2 || u === length - 1 || (u + 2) % every === 0);
  for (let u = -2; u < length; u++) {
    for (let w = -left - 2; w <= right + 2; w++) {
      const innerRing = (u === -1 && w >= inner[0] && w <= inner[1]) || (u >= -1 && inner.includes(w));
      const outerRing = (u === -2) || (u >= -2 && outer.includes(w));
      if (u === -1 && w === 0) {                                   // the table's place in the wall
        for (let dy = 1; dy <= HEADROOM; dy++) headroom.push(at(u, w, dy));
        continue;
      }
      if (innerRing) walls.push({ ...at(u, w, 0), corner: false });
      else if (outerRing) (isPost(u, w) ? posts : edge).push({ ...at(u, w, 0), corner: u === length - 1 || u === -2 });
      else {
        // Dug from under the quay down: the water stands at the sea's level, so with the table two
        // above the sea the top block of the basin stays open air (a lip), never a step of water.
        for (let dy = 1; dy <= rise + depth - 1; dy++) basin.push(at(u, w, -dy));
        if (level === 3 && w === 0 && u >= 1 && u < length - 1 && u % 2 === 1) keelBlocks.push(at(u, w, -rise - depth));
      }
      for (let dy = innerRing || outerRing ? 1 : 0; dy <= HEADROOM; dy++) headroom.push(at(u, w, dy));
    }
  }
  // A channel cut from the dock's mouth to open water, where the shore runs too far out.
  const channel = [];
  for (let u = length; u < length + water.channel; u++) {
    for (let w = -left - 1; w <= right + 1; w++) {
      for (let dy = 1; dy <= rise + depth - 1; dy++) { basin.push(at(u, w, -dy)); channel.push(at(u, w, -dy)); }
      for (let dy = 0; dy <= HEADROOM; dy++) headroom.push(at(u, w, dy));
    }
  }
  // Footing: under the inner ring wherever it stands over water or air (it holds the basin's water),
  // under the outer ring only over air (over water it floats, carried by the pilings), and pilings
  // under every post down to the bottom.
  const base = [], piles = [];
  const below = (p, k) => getBlock(dim, p.x, p.y - k, p.z);
  for (const p of walls) { const b = below(p, 1); if (style.base && (!b || isOpen(b) || isWater(b))) base.push({ x: p.x, y: p.y - 1, z: p.z }); }
  for (const p of edge) {
    for (let k = 1; k <= 4; k++) {
      const b = below(p, k);
      if (!b || !isOpen(b) || isWater(b)) break;
      if (style.base) base.push({ x: p.x, y: p.y - k, z: p.z });
    }
  }
  for (const p of posts) {
    for (let k = 1; k <= 10; k++) {
      const b = below(p, k);
      if (!b || (!isOpen(b) && !isWater(b))) break;
      piles.push({ x: p.x, y: p.y - k, z: p.z });
    }
  }
  const accents = style.accent ? posts.map((p) => ({ x: p.x, y: p.y + 1, z: p.z, corner: p.corner })) : [];
  const lightOn = style.accent ? accents : posts;
  const lights = style.light ? lightOn.filter((p, i) => p.corner || i % 2 === 0).map((p) => ({ x: p.x, y: p.y + 1, z: p.z })) : [];

  // The tradition's buildings and gathering place, laid out in the dock's frame.
  const structure = [], footing = [], volume = [];
  let features = [], tableAt = null;
  if (buildings && (village || (style.arch && ARCH[style.arch]))) {
    const c = new Canvas();
    features = village ? layoutVillage(c, village, { left, right, length, width })
      : [...(layoutYard(c, style.arch, { left, right, length, width, base: style.base, wood: woodOf(style.post) }) ?? []),
        ...(level === 3 ? dryDockWorks(c, style, { left, right, length, width }) : [])];
    c.settle(style.accent && /fence/.test(style.accent) ? style.accent : "minecraft:spruce_fence");
    const placed = new Set();
    const mark = c.marks.table;
    if (mark) {
      tableAt = at(mark.u, mark.w, mark.dy);
      c.remove(mark.u, mark.w, mark.dy);
    }
    for (const cell of c.list()) {
      const p = at(cell.u, cell.w, cell.dy);
      placed.add(`${p.x},${p.y},${p.z}`);
      structure.push({ ...p, id: cell.id, states: statesFor(cell, d) });
    }
    for (const v of c.volumes) for (let u = v.u0; u <= v.u1; u++) for (let w = v.w0; w <= v.w1; w++) for (let dy = v.dy0; dy <= v.dy1; dy++) {
      const p = at(u, w, dy);
      if (!placed.has(`${p.x},${p.y},${p.z}`)) volume.push(p);
    }
    // Footing: fill under floors down to the ground; over deep water or a drop, pilings instead.
    const reach = (u, w, fromDy) => {
      const col = [];
      for (let dy = fromDy - 1; dy >= fromDy - 1 - FOOTING_MAX - 2; dy--) {
        const p = at(u, w, dy);
        const b = getBlock(dim, p.x, p.y, p.z);
        if (!b) return null;
        if (!isOpen(b) && !isWater(b)) return col;
        col.push({ ...p, wet: isWater(b) });
      }
      return col;
    };
    for (const f of c.floors) for (let u = f.u0; u <= f.u1; u++) for (let w = f.w0; w <= f.w1; w++) {
      const col = reach(u, w, 0);
      if (!col || !col.length) continue;
      const corner = (u === f.u0 || u === f.u1 || (u - f.u0) % 3 === 0) && (w === f.w0 || w === f.w1 || (w - f.w0) % 3 === 0);
      const solidBase = !style.base || /gravel|sand$/.test(style.base) ? "minecraft:cobblestone" : style.base;   // footing never falls
      if (col.length <= FOOTING_MAX && !col.some((p) => p.wet)) footing.push(...col.map((p) => ({ ...p, id: solidBase })));
      else if (corner) footing.push(...col.map((p) => ({ ...p, id: style.post ?? "minecraft:oak_log" })));
    }
    for (const pl of c.piles) {
      const col = reach(pl.u, pl.w, 0);
      if (col) footing.push(...col.map((p) => ({ ...p, id: pl.id })));
    }
  }

  // What will be cleared, and anything that must not be.
  const cleared = new Map();
  for (const p of [...walls, ...edge, ...posts, ...basin, ...headroom, ...structure, ...volume, ...(tableAt ? [tableAt] : [])]) {
    const b = getBlock(dim, p.x, p.y, p.z);
    if (!b) return { ok: false, reason: "Part of the dock is in an unloaded area. Stand closer and try again." };
    if (isOpen(b) || isWater(b)) continue;
    if (PROTECTED.test(b.typeId) && !(p.x === o.x && p.z === o.z)) {
      return { ok: false, reason: `There's a ${b.typeId.replace("minecraft:", "").replace(/_/g, " ")} at ${p.x} ${p.y} ${p.z}; move it first.`, blocker: p };
    }
    cleared.set(b.typeId, (cleared.get(b.typeId) ?? 0) + 1);
  }
  const need = new Map();
  const add = (id, n) => id && n && need.set(id, (need.get(id) ?? 0) + n);
  add(style.wall, walls.length + (tableAt ? 1 : 0));
  add(style.deck ?? style.wall, edge.length);
  add(style.post, posts.length + piles.length + keelBlocks.length);
  add(style.base, base.length);
  add(style.accent, accents.length);
  add(style.light, lights.length);
  for (const p of [...structure, ...footing]) if (p.id !== "minecraft:air") add(p.id, 1);
  const costs = [...need].map(([id, count]) => ({ ids: [id], count, label: pretty(id) }));
  return {
    ok: true, dim, origin: o, dir: d, dirName: water.name, length, width, left, right, style, channel: water.channel, rise, sea: water.top,
    walls, edge, posts, piles, base, accents, lights, basin, headroom, cleared, costs, structure, footing, volume, features, tableAt,
    level, depth, keelBlocks,
  };
}

const pretty = (id) => id.replace("minecraft:", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Items to hand back for a cleared block, as if mined (grass gives dirt, plants and liquids nothing). */
function minedAs(typeId) {
  if (/grass_block|mycelium|podzol|dirt_path|farmland/.test(typeId)) return "minecraft:dirt";
  if (/^minecraft:stone$/.test(typeId)) return "minecraft:cobblestone";
  if (/leaves|short_grass|tall_grass|fern|flower|vine|seagrass|kelp|snow_layer|fire/.test(typeId)) return null;
  return typeId;
}

/**
 * Builds a planned dock over a few seconds: headroom, basin, walls, fittings, then the flood. Cleared
 * blocks are handed back through giveBack(itemId, count). done() is called at the end.
 */
export function buildDock(plan, giveBack, done) {
  const { dim, origin: o, dir: d, length, left, right } = plan;
  const set = (p, type, states) => {
    try {
      const b = dim.getBlock(p);
      if (!b) return;
      if (states && Object.keys(states).length) {
        try {
          b.setPermutation(BlockPermutation.resolve(type, states));
          return;
        } catch {
          /* a state this block doesn't have: place it plain */
        }
      }
      b.setType(type);
    } catch {
      /* unloaded */
    }
  };
  // A few puffs show the crew at work; hundreds at once can overwhelm a console.
  let puffs = 0;
  const puff = (p, particle = "minecraft:basic_smoke_particle") => {
    if (++puffs % 6 !== 0 || puffs > 6 * 80) return;
    try {
      dim.spawnParticle(particle, { x: p.x + 0.5, y: p.y + 0.6, z: p.z + 0.5 });
    } catch {
      /* cosmetic */
    }
  };
  system.runJob((function* () {
    let n = 0;
    for (const p of [...plan.headroom, ...plan.basin, ...(plan.volume ?? [])]) {   // clear and dig
      const b = getBlock(dim, p.x, p.y, p.z);
      if (b && !isOpen(b) && !isWater(b)) {
        set(p, "minecraft:air");
        puff(p);
      }
      if (++n % 12 === 0) yield;
    }
    const st = plan.style;
    for (const p of plan.keelBlocks ?? []) {                      // keel blocks on the dry dock's floor, lying along it
      set(p, st.post ?? "minecraft:oak_log", /_(log|wood|stem)$/.test(st.post ?? "_log") ? { pillar_axis: d.x ? "x" : "z" } : {});
      if (++n % 8 === 0) yield;
    }
    for (const p of plan.base) {                                   // footing where walls meet the water
      set(p, /gravel|sand$/.test(st.base) ? "minecraft:cobblestone" : st.base);   // footing never falls
      if (++n % 8 === 0) yield;
    }
    for (const p of plan.piles ?? []) {                            // pilings down to the bottom
      set(p, st.post);
      if (++n % 8 === 0) yield;
    }
    for (const p of plan.walls) {                                  // the walkway: inner ring, then outer
      set(p, st.wall);
      puff(p, "minecraft:villager_happy");
      if (++n % 6 === 0) yield;
    }
    for (const p of plan.edge ?? []) {
      set(p, st.deck ?? st.wall);
      if (++n % 6 === 0) yield;
    }
    for (const p of plan.posts) set(p, st.post);                   // bollards, their tops, then the lights
    yield;
    for (const p of plan.accents) set(p, st.accent);
    for (const p of plan.lights) set(p, st.light);
    yield;
    // The yard's buildings: footing first, then from the ground up, a few blocks a tick.
    for (const p of plan.footing ?? []) {
      set(p, p.id);
      if (++n % 10 === 0) yield;
    }
    const pieces = [...(plan.structure ?? [])].sort((a, b) => a.y - b.y);
    for (const p of pieces) {
      set(p, p.id, p.states);
      if (p.id !== "minecraft:air" && n % 3 === 0) puff(p, "minecraft:villager_happy");
      if (++n % 10 === 0) yield;
    }
    // Flood: the basin (and any channel) fills to the sea's level, from the sea end inward.
    for (let u = length - 1 + (plan.channel ?? 0); u >= 0; u--) {
      const span = u >= length ? 1 : 0;                          // the channel runs a block wider
      for (let w = -left - span; w <= right + span; w++) {
        for (let dy = plan.rise ?? 1; dy <= 8 + (plan.rise ?? 1); dy++) {   // fill the column down to solid ground
          const p = at(o, d, u, w, o.y - dy);
          const b = getBlock(dim, p.x, p.y, p.z);
          if (!b || (!isOpen(b) && !isWater(b))) break;
          set(p, "minecraft:water");
        }
      }
      puff(at(o, d, u, 0, o.y - 1), "minecraft:water_splash_particle_manual");
      yield;
    }
    for (const [typeId, count] of plan.cleared) {
      const item = minedAs(typeId);
      if (item) giveBack(item, count);
    }
    // The table moves to the gathering deck, looking over the dock; its old place joins the walkway.
    if (plan.tableAt) {
      set(plan.tableAt, TABLE_ID);
      set(o, st.wall);
    }
    saveFlooded(plan);
    done?.(plan.tableAt ?? o);
  })());
}

function saveFlooded(plan) {
  const o = plan.origin;
  const key = (p) => `${plan.dim.id}:${p.x},${p.y},${p.z}`;
  const entry = { dir: plan.dirName, flooded: true, length: plan.length, width: plan.width, shift: 0 };
  if (plan.tableAt) {
    // The dock is found from wherever the table now stands, by the place it was built from.
    forgetDock(key(o));
    saveDock({ ...entry, key: key(plan.tableAt), anchor: { x: o.x, y: o.y, z: o.z } });
  } else saveDock({ ...entry, key: key(o) });
}

export const _test = { at, nearestWater, minedAs };
