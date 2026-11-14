import { world } from "@minecraft/server";
import { LEVELS, WATER, ALLOWED, DIRS, GATE_POST_ID } from "./config/yards.js";
import { detectDock, dockLocation } from "./dock.js";

const BEACH = LEVELS[1];
const SLIP = LEVELS[2];
const POSTS_KEY = "shipwright:gate_posts";

function getBlock(dim, x, y, z) {
  try {
    return dim.getBlock({ x, y, z });
  } catch {
    return undefined;
  }
}

const isWater = (b) => !!b && WATER.has(b.typeId);

// Water depth state: 0 is a source block, 1-7 is spreading flow, 8 and up is
// falling water. Boats get dragged down in falling water, so launches avoid it.
function liquidDepth(b) {
  try {
    const d = b.permutation.getState("liquid_depth");
    if (typeof d === "number") return d;
  } catch {
    /* state not exposed on this version */
  }
  return b.typeId === "minecraft:flowing_water" ? 1 : 0;
}
export const isFalling = (b) => isWater(b) && liquidDepth(b) >= 8;
export const isStillWater = (b) => isWater(b) && liquidDepth(b) === 0;

/**
 * Checks the first few blocks of water where boats launch: the surface must
 * include still water and nothing at or below the surface may be falling.
 */
function checkLaunchWater(dim, o, d, waterDist, waterY, half) {
  let still = 0;
  for (let i = waterDist; i < waterDist + 4; i++) {
    for (let w = -half; w <= half; w++) {
      const x = o.x + d.x * i - d.z * w;
      const z = o.z + d.z * i + d.x * w;
      const surface = getBlock(dim, x, waterY, z);
      if (isStillWater(surface)) still++;
      for (let dy = 0; dy <= 3; dy++) {
        const b = getBlock(dim, x, waterY - dy, z);
        if (!isWater(b)) break;
        if (isFalling(b)) return { ok: false, at: { x, y: waterY - dy, z } };
      }
    }
  }
  return still > 0 ? { ok: true } : { ok: false, at: null };
}
const isAllowed = (b) => !!b && ALLOWED.has(b.typeId);

export function yardKey(block) {
  const l = block.location;
  return `${block.dimension.id}:${l.x},${l.y},${l.z}`;
}

function facingOf(block) {
  try {
    return block.permutation.getState("minecraft:cardinal_direction");
  } catch {
    return undefined;
  }
}

/**
 * Level 1: the table alone. Finds the nearest water in any horizontal
 * direction (ties go to the table's facing), then measures how far a clear
 * box (3 wide, 3 high) runs from the table toward it.
 */
export function detectBeachYard(block) {
  const dim = block.dimension;
  const o = block.location;
  const facing = facingOf(block);
  const maxLen = BEACH.length[1];

  let best = null;
  for (const [name, d] of Object.entries(DIRS)) {
    for (let i = 1; i <= maxLen; i++) {
      const level = getBlock(dim, o.x + d.x * i, o.y, o.z + d.z * i);
      const below = getBlock(dim, o.x + d.x * i, o.y - 1, o.z + d.z * i);
      if (isWater(level) || isWater(below)) {
        const better = !best || i < best.dist || (i === best.dist && name === facing);
        if (better) best = { name, d, dist: i, waterY: isWater(level) ? o.y : o.y - 1 };
        break;
      }
    }
  }

  const base = { level: 1, levelName: BEACH.name, origin: o, dimension: dim, key: yardKey(block) };
  if (!best) {
    return { ...base, ok: false, reason: `No water within ${maxLen} blocks. Place the table on a shore near water.` };
  }

  const { d } = best;
  const half = Math.floor(BEACH.width / 2);
  let length = 0;
  let blocker = null;
  // Each column needs 3 clear blocks above its own surface (the ground or the water), so the yard
  // follows the shore: a rise or dip in the beach is fine as long as there's room above it.
  outer: for (let i = 1; i <= maxLen; i++) {
    for (let w = -half; w <= half; w++) {
      const x = o.x + d.x * i - d.z * w;
      const z = o.z + d.z * i + d.x * w;
      const why = columnBlocked(dim, x, z, o.y);
      if (why) {
        blocker = why;
        break outer;
      }
    }
    length = i;
  }

  const yard = {
    ...base,
    dirName: best.name,
    dir: d,
    length,
    width: BEACH.width,
    height: BEACH.height,
    waterDist: best.dist,
    waterY: best.waterY,
    blocker,
  };

  if (best.dist > length) {
    return { ...yard, ok: false, reason: `The way to the water is blocked by ${pretty(blocker?.typeId)}.` };
  }
  const water = checkLaunchWater(dim, o, d, best.dist, best.waterY, half);
  if (!water.ok) {
    return {
      ...yard,
      ok: false,
      blocker: water.at ? { ...water.at, typeId: "falling water" } : null,
      reason: "The water at the launch spot is flowing, not still, and boats sink in falling water. " +
        "Fill the basin with water source blocks on every layer (not just the top), or use a natural lake or the sea.",
    };
  }
  if (length < BEACH.length[0]) {
    const why = blocker ? ` ${pretty(blocker.typeId)} is in the way.` : "";
    return { ...yard, ok: false, reason: `The yard needs at least ${BEACH.length[0]} clear blocks toward the water; found ${length}.${why}` };
  }
  return { ...yard, ok: true };
}

/**
 * A column of the yard: finds its surface (ground or water) at or below the ground the table stands
 * on, and checks for 3 clear blocks above it. Returns the blocking block, or null if the column is clear.
 */
function columnBlocked(dim, x, z, tableY) {
  let surface = tableY - 6;
  for (let yy = tableY + 1; yy >= tableY - 6; yy--) {
    const b = getBlock(dim, x, yy, z);
    if (!b) return { x, y: yy, z, typeId: "unloaded" };
    if (isWater(b) || !isAllowed(b)) {
      surface = yy + 1;
      // The shore can fall away toward the water, but nothing may stand at the table's level or above.
      if (!isWater(b) && yy >= tableY) return { x, y: yy, z, typeId: b.typeId };
      break;
    }
  }
  for (let yy = surface; yy < surface + BEACH.height; yy++) {
    const b = getBlock(dim, x, yy, z);
    if (!isAllowed(b) || isWater(b) && yy > surface) return { x, y: yy, z, typeId: b?.typeId ?? "unloaded" };
  }
  return null;
}

export function pretty(typeId) {
  if (!typeId) return "a block";
  return typeId.replace(/^minecraft:/, "").replace(/_/g, " ");
}

/** Sideways offset to the middle of the yard (a slipway runs to one side of the table). */
function lateral(yard) {
  const side = yard.side ?? 0;
  const half = yard.level === 2 && side !== 0 ? (yard.width - 1) / 2 : 0;
  return { x: -yard.dir.z * side * half, z: yard.dir.x * side * half };
}

/** Where a boat of the given length sits while being built (afloat in a dock). */
export function buildLocation(yard, boatLength, half = null) {
  if (yard.kind === "dock") return dockLocation(yard, boatLength, half);
  const c = half !== null ? 0.5 + half : 1 + (boatLength - 1) / 2;   // the stern at the yard's head
  const l = lateral(yard);
  const x = yard.origin.x + 0.5 + yard.dir.x * c + l.x;
  const z = yard.origin.z + 0.5 + yard.dir.z * c + l.z;
  return { x, y: groundY(yard, x, z), z };   // on the actual ground (or water) at that spot
}

/** Where a boat lands in the water at launch (in a dock it's already afloat). */
export function launchLocation(yard, boatLength) {
  if (yard.kind === "dock") return dockLocation(yard, boatLength);
  // her whole length clear of the slip, a block and a half past the water's edge, on the slip's centre line (lateral):
  // launched to the edge itself, a long hull's stern hung over the slip and she stuck (Richard, S003)
  const c = yard.waterDist + boatLength / 2 + 1.5;   // vision: a block and a half of clear water astern
  const l = lateral(yard);
  return {
    x: yard.origin.x + 0.5 + yard.dir.x * c + l.x,
    y: yard.waterY + 0.6,
    z: yard.origin.z + 0.5 + yard.dir.z * c + l.z,
  };
}

export function boatsInYard(yard) {
  const center = buildLocation(yard, Math.max(yard.length, 1));
  try {
    return yard.dimension.getEntities({
      families: ["shipwright_boat"],
      location: center,
      maxDistance: yard.length / 2 + 3,
    });
  } catch {
    return [];
  }
}

/** Particle outline of the clear volume; red marker on the blocking block. */
export function showOutline(yard) {
  const dim = yard.dimension;
  const o = yard.origin;
  const d = yard.dir;
  if (!d) return;
  const half = yard.width / 2;
  const spawn = (id, loc) => {
    try {
      dim.spawnParticle(id, loc);
    } catch {
      /* particle ids vary by version; outline is cosmetic */
    }
  };
  const top = o.y + yard.height;
  for (let i = 0; i <= yard.length; i++) {
    const along = 0.5 + i + 0.5;
    for (const side of [-half, half]) {
      spawn("minecraft:villager_happy", {
        x: o.x + 0.5 + d.x * along - d.z * side,
        y: top,
        z: o.z + 0.5 + d.z * along + d.x * side,
      });
    }
  }
  if (yard.level === 2 && yard.post) {
    for (let k = 0; k < 6; k++) spawn("minecraft:villager_happy", { x: yard.post.x + 0.5, y: yard.post.y + 1 + k * 0.4, z: yard.post.z + 0.5 });
  }
  if (yard.blocker) {
    const b = yard.blocker;
    for (let k = 0; k < 4; k++) spawn("minecraft:lava_particle", { x: b.x + 0.5, y: b.y + 0.8, z: b.z + 0.5 });
  }
}

// ---------- the slipway ----------

function loadPosts() {
  try {
    return JSON.parse(world.getDynamicProperty(POSTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Gate Posts register when placed and unregister when broken, so the table never scans for them. */
export function registerPost(block, placed) {
  const l = block.location;
  const id = `${block.dimension.id}:${l.x},${l.y},${l.z}`;
  const posts = loadPosts().filter((p) => p.id !== id);
  if (placed) posts.push({ id, d: block.dimension.id, x: l.x, y: l.y, z: l.z });
  world.setDynamicProperty(POSTS_KEY, JSON.stringify(posts));
}

function postFits(o, p) {
  const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
  const along = Math.max(Math.abs(dx), Math.abs(dz)), side = Math.min(Math.abs(dx), Math.abs(dz));
  return along >= 2 && along <= SLIP.length[1] + 2 && side <= SLIP.maxSide && -dy >= SLIP.drop[0] && -dy <= SLIP.drop[1];
}

const searched = new Map();   // table key -> time of its last search for unregistered posts
const SEARCH_EVERY_MS = 5 * 60 * 1000;

/** Gate Posts near a table: the registry first, then (at most every few minutes) a search around the table. */
function findPost(block) {
  const o = block.location;
  const dim = block.dimension;
  let posts = loadPosts().filter((p) => p.d === dim.id && postFits(o, p) && getBlock(dim, p.x, p.y, p.z)?.typeId === GATE_POST_ID);
  const key = yardKey(block);
  const now = Date.now();
  if (!posts.length && now - (searched.get(key) ?? -Infinity) > SEARCH_EVERY_MS) {
    searched.set(key, now);
    // Posts placed before the registry existed, or missed by it: look once along each direction.
    for (const d of Object.values(DIRS)) {
      for (let u = 2; u <= SLIP.length[1] + 2; u++) {
        for (let w = -SLIP.maxSide; w <= SLIP.maxSide; w++) {
          for (let dy = -SLIP.drop[1]; dy <= -SLIP.drop[0]; dy++) {
            const x = o.x + d.x * u - d.z * w, z = o.z + d.z * u + d.x * w;
            const b = getBlock(dim, x, o.y + dy, z);
            if (b?.typeId === GATE_POST_ID) {
              registerPost(b, true);
              posts.push({ x, y: o.y + dy, z });
            }
          }
        }
      }
    }
  }
  let best = null;
  for (const p of posts) {
    const dist = Math.hypot(p.x - o.x, p.z - o.z);
    if (!best || dist < best.dist) best = { ...p, dx: p.x - o.x, dy: p.y - o.y, dz: p.z - o.z, dist };
  }
  return best;
}

const touchesWater = (dim, p) =>
  [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]].some(([a, b, c]) => isWater(getBlock(dim, p.x + a, p.y + b, p.z + c)));

/**
 * Level 2: the table and a Gate Post. The post sits 8 to 24 blocks out toward the water,
 * straight ahead or off to one side, touching water. The space between them must be clear for
 * three blocks up from the table's level; the ground below can be any shape.
 * Returns null when there's no post at all, otherwise a yard with a checklist.
 */
export function detectSlipway(block) {
  const post = findPost(block);
  if (!post) return null;
  const dim = block.dimension;
  const o = block.location;
  const alongX = Math.abs(post.dx) >= Math.abs(post.dz);
  const dir = alongX ? { x: Math.sign(post.dx), z: 0 } : { x: 0, z: Math.sign(post.dz) };
  const dirName = Object.entries(DIRS).find(([, d]) => d.x === dir.x && d.z === dir.z)[0];
  const length = alongX ? Math.abs(post.dx) : Math.abs(post.dz);
  const offset = alongX ? post.dz : post.dx;               // sideways, in world terms
  const width = offset === 0 ? SLIP.standardWidth : Math.abs(offset) + 1;
  // lateral() measures sideways as (-dir.z, dir.x); express the post's side in that frame.
  const side = offset === 0 ? 0 : alongX ? Math.sign(offset) * dir.x : -Math.sign(offset) * dir.z;
  const drop = -post.dy;
  const checks = [];
  const check = (ok, text) => checks.push({ ok, text });
  const base = {
    level: 2, levelName: SLIP.name, origin: o, dimension: dim, key: yardKey(block),
    dir, dirName, length, width, height: SLIP.height, drop, side, post, checks,
    waterDist: length, waterY: post.y,
  };

  check(length >= SLIP.length[0] && length <= SLIP.length[1],
    `Gate Post ${length} blocks out (needs ${SLIP.length[0]} to ${SLIP.length[1]})`);
  check(drop >= SLIP.drop[0] && drop <= SLIP.drop[1],
    drop >= 0 ? `Gate Post ${drop} below the table` : `Gate Post ${-drop} above the table (it should be at or below)`);
  check(touchesWater(dim, post), "Gate Post touching water");

  // Clear space between table and post, three blocks up from the table's level.
  let blocker = null;
  const lat = { x: -dir.z, z: dir.x };
  const lo = side === 0 ? -Math.floor(width / 2) : side < 0 ? -(width - 1) : 0;
  const hi = side === 0 ? Math.floor(width / 2) : side > 0 ? width - 1 : 0;
  outer: for (let u = 1; u < length; u++) {
    for (let w = lo; w <= hi; w++) {
      for (let yy = o.y; yy < o.y + SLIP.height; yy++) {
        const x = o.x + dir.x * u + lat.x * w, z = o.z + dir.z * u + lat.z * w;
        const b = getBlock(dim, x, yy, z);
        if (!isAllowed(b)) {
          blocker = { x, y: yy, z, typeId: b?.typeId ?? "unloaded" };
          break outer;
        }
      }
    }
  }
  check(!blocker, blocker ? `${pretty(blocker.typeId)} in the way at ${blocker.x} ${blocker.y} ${blocker.z}` : "Space between table and post clear");

  // Water to launch into, just past the post.
  let waterY = null;
  for (let u = 1; u <= 3 && waterY === null; u++) {
    for (const dyy of [0, -1, 1]) {
      if (isWater(getBlock(dim, post.x + dir.x * u, post.y + dyy, post.z + dir.z * u))) { waterY = post.y + dyy; break; }
    }
  }
  check(waterY !== null, "Open water just past the Gate Post");

  const failed = checks.find((c) => !c.ok);
  return { ...base, ok: !failed, reason: failed?.text, blocker, waterY: waterY ?? post.y };
}

/** The ground under a point in the yard: boats are built sitting on it. */
export function groundY(yard, x, z) {
  const top = yard.origin.y + 1;
  const bottom = Math.min(yard.waterY ?? yard.origin.y, yard.origin.y) - 4;
  for (let y = top; y >= bottom; y--) {
    const b = getBlock(yard.dimension, Math.floor(x), y, Math.floor(z));
    if (b && !isAllowed(b)) return y + 1;
    if (isWater(b)) return y + 1;
  }
  return yard.origin.y;
}

/**
 * The best yard this table makes: a flooded dock (level 2), otherwise a beach yard. A dock that's
 * built but dry, or nearly right, comes back with its checklist so the table can say what to do.
 */
export function detectYard(block) {
  const dock = detectDock(block);
  if (dock?.ok && dock.flooded) return dock;
  const beach = detectBeachYard(block);
  if (dock) {
    if (beach.ok) return { ...beach, dock };          // build small craft here meanwhile; show the dock's progress
    return dock;                                      // keep the dock's own ready / not-ready status
  }
  return beach;
}
