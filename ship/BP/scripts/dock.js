// The Dock (yard level 2): built like a Nether portal laid flat.
//
//   1. Dig a basin at the shore, at least 2 deep, 3 to 7 wide and 8 to 24 long.
//   2. Ring it with a frame one block wide at ground level: logs, planks, stone bricks,
//      cobblestone or bricks, mixed as you like. Corners are optional, as with a portal.
//   3. The Shipwright's Table sits at the landward end: set into the frame, or right behind it.
//   4. The seaward end is the sea wall, with open water just beyond it.
//   5. Use the table and flood the dock: the sea wall opens and the sea pours in.
//
// Ships are built afloat in the flooded dock and sail out through the opening.
import { world, system } from "@minecraft/server";
import { DIRS, WATER, ALLOWED, TABLE_ID } from "./config/yards.js";

export const DOCK = { length: [8, 44], width: [3, 15], depth: 2, name: "Dock" };
// Yard level 3: a dock long, wide and deep enough for the great ships, with keel blocks down its
// middle to build on. Any dock this big and 3 deep counts.
export const DRY_DOCK = { length: 28, width: 9, depth: 3, name: "Dry dock" };
/** A dock's level from its inside size and depth. */
export const dockLevel = (length, width, depth) =>
  length >= DRY_DOCK.length && width >= DRY_DOCK.width && depth >= DRY_DOCK.depth ? 3 : 2;
const DOCKS_KEY = "shipwright:docks";
// Wood and stone families, including older block ids some versions still use (stonebrick).
const FRAME = /(_log|_wood|_planks|_bricks|_stem|_hyphae|_slab)$|^minecraft:(cobblestone|mossy_cobblestone|stone|stonebrick|bricks|smooth_stone|sandstone|red_sandstone|smooth_sandstone|cut_sandstone|packed_mud|deepslate|cobbled_deepslate|polished_\w+|andesite|diorite|granite|blackstone|tuff)$/;

function getBlock(dim, x, y, z) {
  try {
    return dim.getBlock({ x, y, z });
  } catch {
    return undefined;
  }
}
const isWater = (b) => !!b && WATER.has(b.typeId);
const isOpen = (b) => !!b && ALLOWED.has(b.typeId);
export const isFrame = (b) => !!b && (b.typeId === TABLE_ID || FRAME.test(b.typeId));
const pretty = (id) => (id ?? "a block").replace(/^minecraft:/, "").replace(/_/g, " ");
const tableKey = (block) => `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;

function loadDocks() {
  try {
    return JSON.parse(world.getDynamicProperty(DOCKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function saveDock(entry) {
  const docks = loadDocks();
  const old = docks.find((d) => d.key === entry.key);
  const rest = docks.filter((d) => d.key !== entry.key);
  rest.push({ ...(old ?? {}), ...entry });                 // keeps what it knew (where it was built from)
  world.setDynamicProperty(DOCKS_KEY, JSON.stringify(rest));
}
export function forgetDock(key) {
  world.setDynamicProperty(DOCKS_KEY, JSON.stringify(loadDocks().filter((d) => d.key !== key)));
}

/**
 * Positions in the dock's own frame: u along toward the sea, w sideways. u = 0 is the first
 * basin cell past the table, so the table itself (in the landward wall) is u = -1.
 */
function cell(o, d, u, w, y) {
  return { x: o.x + d.x * (u + 1) - d.z * w, y, z: o.z + d.z * (u + 1) + d.x * w };
}

/**
 * Measures a frame in one direction. The table can sit in the landward wall (shift 0) or right
 * behind it, touching it (shift 1); o is then the wall position in front of the table.
 * Returns null if nothing frame-like is there.
 */
function measure(table, dirName, shift = 0) {
  const d = DIRS[dirName];
  const t = table.location;
  const o = { x: t.x + d.x * shift, y: t.y, z: t.z + d.z * shift };
  const dim = table.dimension;
  if (shift && !isFrame(getBlock(dim, o.x, o.y, o.z))) return null;
  const at = (u, w, y = o.y) => getBlock(dim, ...Object.values(cell(o, d, u, w, y)));
  if (!isOpen(at(0, 0))) return null;
  // Sideways from the first cell to the side walls.
  let left = 0, right = 0;
  while (left < DOCK.width[1] && isOpen(at(0, -(left + 1)))) left++;
  while (right < DOCK.width[1] && isOpen(at(0, right + 1))) right++;
  if (!isFrame(at(0, -(left + 1))) || !isFrame(at(0, right + 1))) return null;
  // Forward to the sea wall (or, once flooded, to the opening).
  let length = 0;
  while (length < DOCK.length[1] + 2 && isOpen(at(length, 0))) length++;
  return { d, dirName, o, dim, left, right, length, width: left + right + 1, at };
}

/**
 * Finds and checks a dock around this table. Returns null if the table isn't set into a frame;
 * otherwise a yard with a checklist (and the exact block to fix when something's wrong).
 */
export function detectDock(table) {
  const key = tableKey(table);
  const saved = loadDocks().find((x) => x.key === key);
  const order = saved ? [saved.dir] : Object.keys(DIRS);
  let m = null;
  if (saved?.anchor) {
    // A table that moved to its yard's deck: measure the dock from the place it was built from.
    m = measure({ location: saved.anchor, dimension: table.dimension }, saved.dir, 0);
    if (m) m.shift = 0;
  }
  for (const shift of m ? [] : [saved?.shift ?? 0, 1 - (saved?.shift ?? 0)]) {
    for (const dn of order) {
      m = measure(table, dn, shift);
      if (m) { m.shift = shift; break; }
    }
    if (m) break;
  }
  if (!m) return null;
  const { d, o, dim, left, right, width, at } = m;
  const flooded = !!saved?.flooded;
  // Once flooded, the sea wall is gone and the basin runs into the sea: use the length it was built at.
  const length = flooded && saved.length ? saved.length : m.length;
  const checks = [];
  let fix = null;
  const check = (ok, text, where = null) => {
    checks.push({ ok, text });
    if (!ok && !fix && where) fix = where;
  };

  check(width >= DOCK.width[0] && width <= DOCK.width[1], `Inside width ${width} (needs ${DOCK.width[0]} to ${DOCK.width[1]})`);
  check(length >= DOCK.length[0] && length <= DOCK.length[1], `Inside length ${length} (needs ${DOCK.length[0]} to ${DOCK.length[1]})`);

  // Side walls along the whole length, and the landward wall either side of the table.
  let wallGap = null;
  for (let u = 0; u < length && !wallGap; u++) {
    for (const w of [-(left + 1), right + 1]) if (!isFrame(at(u, w))) wallGap = cell(o, d, u, w, o.y);
  }
  for (let w = -left; w <= right && !wallGap; w++) if (!isFrame(at(-1, w))) wallGap = cell(o, d, -1, w, o.y);
  check(!wallGap, wallGap ? `Frame block missing at ${wallGap.x} ${wallGap.y} ${wallGap.z}` : "Frame complete", wallGap);

  // The basin: open at frame level and one below, all the way through.
  let shallow = null;
  for (let u = 0; u < length && !shallow; u++) {
    for (let w = -left; w <= right && !shallow; w++) {
      for (let dy = 0; dy < DOCK.depth; dy++) {
        const b = at(u, w, o.y - dy);
        if (!isOpen(b)) { shallow = { ...cell(o, d, u, w, o.y - dy), typeId: b?.typeId }; break; }
      }
    }
  }
  check(!shallow, shallow ? `Basin needs digging out: ${pretty(shallow.typeId)} at ${shallow.x} ${shallow.y} ${shallow.z}` : `Basin at least ${DOCK.depth} deep`, shallow);
  // How deep the whole basin goes (to 3): a big dock dug 3 deep is a dry dock.
  let depth = shallow ? 0 : DOCK.depth;
  if (!shallow && length >= DRY_DOCK.length && width >= DRY_DOCK.width) {
    let deep = true;
    const bottom = waterLevel(at, o) - DRY_DOCK.depth + 1;
    for (let u = 0; u < length && deep; u++) for (let w = -left; w <= right && deep; w++) deep = isOpen(at(u, w, bottom));
    if (deep) depth = DRY_DOCK.depth;
  }
  const level = dockLevel(length, width, depth);

  // Room above the water for the ship: 3 clear blocks over the whole basin.
  let low = null;
  for (let u = 0; u < length && !low; u++) {
    for (let w = -left; w <= right && !low; w++) {
      for (let dy = 1; dy <= 2; dy++) {
        const b = at(u, w, o.y + dy);
        if (!isOpen(b) || isWater(b)) { low = { ...cell(o, d, u, w, o.y + dy), typeId: b?.typeId }; break; }
      }
    }
  }
  check(!low, low ? `Not enough room above the dock: ${pretty(low.typeId)} at ${low.x} ${low.y} ${low.z}` : "3 blocks clear above the water", low);

  // The sea wall, with open water beyond it (once flooded, the opening itself).
  if (!flooded) {
    let seaGap = null;
    for (let w = -left; w <= right && !seaGap; w++) if (!isFrame(at(length, w))) seaGap = cell(o, d, length, w, o.y);
    check(!seaGap, seaGap ? `Sea wall block missing at ${seaGap.x} ${seaGap.y} ${seaGap.z}` : "Sea wall in place", seaGap);
    let beyond = false;
    for (let u = length + 1; u <= length + 2 && !beyond; u++)
      for (let w = -left - 1; w <= right + 1 && !beyond; w++)
        for (let dy = 0; dy >= -4 && !beyond; dy--) beyond = isWater(at(u, w, o.y + dy));
    check(beyond, beyond ? "Open water beyond the sea wall" : "Open water needed just beyond the sea wall", cell(o, d, length + 1, 0, o.y));
  } else {
    check(true, "Flooded and open to the sea");
  }

  const ok = checks.every((c) => c.ok);
  return {
    kind: "dock", level, levelName: level === 3 ? DRY_DOCK.name : DOCK.name, ok, checks, flooded, depth,
    reason: checks.find((c) => !c.ok)?.text, blocker: fix,
    origin: o, dimension: dim, key, dir: d, dirName: m.dirName, shift: m.shift,
    length, width, left, right, height: 3, waterY: waterLevel(at, o), waterDist: 0,
  };
}

/** The basin's water level: one below the frame, or two where the frame stands two above the sea. */
function waterLevel(at, o) {
  for (const y of [o.y - 1, o.y - 2]) if (isWater(at(0, 0, y)) || isWater(at(0, 1, y))) return y;
  return o.y - 1;
}

/** Floods a ready dock: the sea wall opens and the sea pours in, row by row from the sea end. */
export function floodDock(dock, done) {
  const { origin: o, dir: d, dimension: dim, left, right, length } = dock;
  // Water stands at the sea's level outside the sea wall: one below the frame, or two.
  const seaAt = (y) => isWater(getBlock(dim, ...Object.values(cell(o, d, length + 1, 0, y))));
  const top = seaAt(o.y - 1) || !seaAt(o.y - 2) ? o.y - 1 : o.y - 2;
  const set = (p, type) => {
    try {
      dim.getBlock(p)?.setType(type);
    } catch {
      /* unloaded */
    }
  };
  system.runJob((function* () {
    for (let w = -left; w <= right; w++) {          // open the sea wall
      set(cell(o, d, length, w, o.y), "minecraft:air");
      set(cell(o, d, length, w, top), "minecraft:water");
    }
    yield;
    for (let u = length - 1; u >= 0; u--) {
      for (let w = -left; w <= right; w++) {
        let floor = top;
        while (floor > top - 8 && isOpen(getBlock(dim, ...Object.values(cell(o, d, u, w, floor - 1))))) floor--;
        for (let y = floor; y <= top; y++) set(cell(o, d, u, w, y), "minecraft:water");
      }
      try {
        const p = cell(o, d, u, 0, top);
        dim.spawnParticle("minecraft:water_splash_particle_manual", { x: p.x + 0.5, y: p.y + 1, z: p.z + 0.5 });
        if (u % 3 === 0) dim.playSound?.("bucket.empty_water", p);
      } catch {
        /* cosmetic */
      }
      yield;
    }
    saveDock({ key: dock.key, dir: dock.dirName, flooded: true, length: dock.length, width: dock.width, shift: dock.shift ?? 0 });
    done?.();
  })());
}

/** Where a boat floats in the dock while being built, and where it is at launch: the same spot. */
export function dockLocation(dock, boatLength, half = null) {
  // the stern sits against the dock's head (by the table), the bow toward the mouth: square with the dock's end
  const c = half !== null ? Math.min(half, dock.length / 2) - 0.5 : Math.min(dock.length, boatLength) / 2 - 0.5;
  const mid = (dock.right - dock.left) / 2;
  const p = cell(dock.origin, dock.dir, c, mid, dock.waterY);
  return { x: p.x + 0.5, y: dock.waterY + 0.9, z: p.z + 0.5 };
}

// ---------- the blueprint guide ----------

/**
 * Projects a dock blueprint in front of the table for a while: green where a frame block is
 * still needed, white where it's already right, red where something blocks the basin.
 */
export function showBlueprint(table, dirName, length, width) {
  const d = DIRS[dirName];
  const o = table.location;
  const dim = table.dimension;
  const left = Math.floor((width - 1) / 2), right = width - 1 - left;
  const frame = [], basin = [];
  for (let u = -1; u <= length; u++) {
    for (let w = -(left + 1); w <= right + 1; w++) {
      const edge = u === -1 || u === length || w === -(left + 1) || w === right + 1;
      const corner = (u === -1 || u === length) && (w === -(left + 1) || w === right + 1);
      if (corner) continue;
      if (edge) frame.push(cell(o, d, u, w, o.y));
      else for (let dy = 0; dy < DOCK.depth; dy++) basin.push(cell(o, d, u, w, o.y - dy));
    }
  }
  let runs = 0;
  const id = system.runInterval(() => {
    for (const p of frame) {
      const b = getBlock(dim, p.x, p.y, p.z);
      const particle = isFrame(b) ? "minecraft:endrod" : "minecraft:villager_happy";
      try { dim.spawnParticle(particle, { x: p.x + 0.5, y: p.y + 1.1, z: p.z + 0.5 }); } catch { /* cosmetic */ }
    }
    for (const p of basin) {
      if (isOpen(getBlock(dim, p.x, p.y, p.z))) continue;
      try { dim.spawnParticle("minecraft:lava_particle", { x: p.x + 0.5, y: p.y + 1.1, z: p.z + 0.5 }); } catch { /* cosmetic */ }
    }
    if (++runs >= 60) system.clearRun(id);   // about 30 seconds
  }, 10);
  return { frame: frame.length, basin: basin.length };
}

export const _test = { loadDocks, saveDock, measure };
