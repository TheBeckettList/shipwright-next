// Boatblock: Shipwright's castaway way to play, in the same world as everything else.
//
// Everyone arrives at the homeport (world/homeport.js). From there you can sail out into the world,
// or ring the castaway bell by the raft moored in the inner canal and set out for the Drowned Reach
// (world/reach.js): the crew's one shared raft, far out where the islands lie drowned, with a few
// planks, a rod and a bucket. The sea brings the rest: driftwood and flotsam ride the current down
// from the islands upstream (law 1 of the Boatblock doc: the wood is what grows up-current). Build a
// boat and you can sail home; reach the port and you're no longer a castaway.
//
// The world's mode (/scriptevent shipwright:mode port|boatblock) says where newcomers start: at the
// homeport (port, the default) or straight on the raft (boatblock). It never changes the world.
import { world, system, ItemStack } from "@minecraft/server";
import { SEA_DIM } from "./dims.js";
import { SEA_LEVEL } from "./world/terrain.js";
import { groupsNear, climate } from "./world/terrain.js";
import { groupWoods } from "./world/peoples.js";
import { windField } from "./world/fields.js";
import { rand } from "./world/noise.js";
import { inReach, raftSpot } from "./world/reach.js";
import { homeportIfReady, inPort } from "./world/homeport.js";
import { worldSeed, arriveAt, seaWorldOn } from "./seaworld.js";
import { menu } from "./ui.js";
import { warnOnce, tell } from "./warn.js";
import { BlockPermutation } from "@minecraft/server";
import { columnAt } from "./world/lattice.js";
import { seaHeat } from "./world/fields.js";
import { lowWater, isFlat, flatBlock, waveHeight, washChance, reefRate, SEA_LAWS } from "./world/sealaws.js";

const MODE_KEY = "shipwright:mode";
const CASTAWAY = "shipwright:castaway";
const KIT = "shipwright:castawayKit";

/** Vision numbers for the drift (Boatblock doc, law 1). */
export const DRIFT = Object.freeze({
  every: 45,             // vision: seconds between finds for a castaway, on average
  near: [10, 15],        // vision: how far up-current a find appears (blocks)
  cap: 12,               // vision: at most this many afloat round a player
  pace: 0.3,             // derived: the surface current, 2.5% of a fresh breeze (12 m/s), in blocks a second   // vision: what the sea brings
});

export const worldMode = () => (world.getDynamicProperty(MODE_KEY) === "boatblock" ? "boatblock" : "port");
export const isCastaway = (p) => p?.getDynamicProperty?.(CASTAWAY) === true;

/** Where castaways stand: on the crew's raft. */
export function castawaySpot(seed) {
  const r = raftSpot(seed);
  return { x: r.x + 0.5, y: SEA_LEVEL + 1, z: r.z + 0.5 };
}

const WOOD_BY_CLIMATE = { polar: ["spruce"], boreal: ["spruce", "birch"], temperate: ["oak", "birch"], dry: ["acacia", "oak"], arid: ["acacia"],
  savanna: ["acacia"], tropical: ["jungle", "mangrove"], wet: ["jungle", "mangrove", "dark_oak"] };
const SAPLING = (w) => (w === "mangrove" ? "minecraft:mangrove_propagule" : `minecraft:${w}_sapling`);

/** What the current brings to a place (pure): the woods that grow on the islands about it, else its climate's. */
export function driftFind(seed, x, z, k) {
  const woods = {};
  for (const g of groupsNear(seed, x, z)) for (const [w, share] of Object.entries(groupWoods(seed, g).woods ?? {})) woods[w] = (woods[w] ?? 0) + share;
  let list = Object.keys(woods).filter((w) => w !== "bamboo" && w !== "bone");
  if (!list.length) list = WOOD_BY_CLIMATE[climate(seed, x, z).key] ?? ["oak"];
  const wood = list[Math.floor(rand(Math.floor(x), Math.floor(z), k, seed, 801) * list.length)];   // given: hash salts
  const r = rand(Math.floor(x), Math.floor(z), k, seed, 802);   // given: hash salts
  if (r < 0.45) return { item: `minecraft:${wood}_log`, count: 1 + (r < 0.1 ? 1 : 0) };   // vision: what the sea brings
  if (r < 0.6) return { item: "minecraft:stick", count: 2 + Math.floor(r * 10) % 3 };   // vision: what the sea brings
  if (r < 0.7) return { item: SAPLING(wood), count: 1 };   // vision: what the sea brings
  if (r < 0.78) return { item: `minecraft:${wood}_planks`, count: 2 };          // wreckage   // vision: what the sea brings
  if (r < 0.85) return { item: "minecraft:kelp", count: 2 };   // vision: what the sea brings
  if (r < 0.9) return { item: "minecraft:string", count: 1 };   // vision: what the sea brings
  if (r < 0.94) return { item: "minecraft:bone", count: 1 };   // vision: what the sea brings
  if (r < 0.98) return { item: "minecraft:wheat_seeds", count: 1 };   // vision: what the sea brings
  return { item: "minecraft:bamboo", count: 1 };
}

/** Sends a player out to the crew's raft. */
export function embark(player) {
  const seed = worldSeed();
  player.setDynamicProperty(CASTAWAY, true);
  arriveAt(player, castawaySpot(seed));
  if (player.getDynamicProperty(KIT) !== true) {
    player.setDynamicProperty(KIT, true);
    const inv = player.getComponent("minecraft:inventory")?.container;
    for (const [id, n] of [["minecraft:oak_planks", 4], ["minecraft:fishing_rod", 1], ["minecraft:bucket", 1]]) {   // vision: what the sea brings
      try { inv?.addItem(new ItemStack(id, n)); } catch { /* full */ }
    }
  }
  player.sendMessage?.("§e[Shipwright] Castaway. §7The crew's raft lies in the Drowned Reach. Watch the water up-current: the sea brings what grows on the islands that way. Build a boat and you can sail home.");
}

async function offerRaft(player) {
  const pick = await menu(player, "The castaway raft",
    "Set out for the Drowned Reach with nothing but a raft, a few planks, a rod and a bucket?\n\nThe whole crew shares one raft, far out where the islands lie drowned. Everything else comes from the sea. You can sail home once you've built a boat.",
    ["Set out", "Stay in port"]);
  if (pick === 0) embark(player);
}

const afloat = new Map();                      // player id -> [item entities drifting toward them]
let tick = 0;

function driftTick(seed) {
  tick++;
  const hp = homeportIfReady(seed);
  const dim = world.getDimension(SEA_DIM);
  for (const p of world.getAllPlayers()) {
    if (p.dimension?.id !== SEA_DIM) continue;
    // home: a castaway who reaches the port is a castaway no more
    if (isCastaway(p) && hp && inPort(hp, p.location.x, p.location.z)) {
      p.setDynamicProperty(CASTAWAY, false);
      p.sendMessage?.("§e[Shipwright] Home. §7You've sailed back to the homeport.");
    }
    if (!inReach(seed, p.location.x, p.location.z)) continue;
    const w = windField(seed, p.location.x, p.location.z, system.currentTick);
    const m = Math.hypot(w.x, w.z) || 1;
    // the surface current: with the wind, turned 45 degrees right in the north (Ekman)
    const c45 = Math.SQRT1_2, ux = (w.x * c45 - w.z * c45) / m, uz = (w.x * c45 + w.z * c45) / m;
    const list = (afloat.get(p.id) ?? []).filter((e) => e.isValid);
    for (const e of list) {                    // ride the current
      try { e.teleport({ x: e.location.x + ux * DRIFT.pace, y: Math.max(e.location.y, SEA_LEVEL + 0.6), z: e.location.z + uz * DRIFT.pace }); } catch { /* gone */ }   // vision: what the sea brings
    }
    afloat.set(p.id, list);
    // a find, now and then, a little way up-current (shared out among a crew standing together)
    const crew = world.getAllPlayers().filter((o) => o.dimension?.id === SEA_DIM && Math.hypot(o.location.x - p.location.x, o.location.z - p.location.z) < 24).length;   // vision: what the sea brings
    if (list.length >= DRIFT.cap || rand(tick, p.id.length, seed, 803) > 1 / (DRIFT.every * Math.max(1, crew))) continue;   // given: hash salts
    const d = DRIFT.near[0] + rand(tick, seed, 804) * (DRIFT.near[1] - DRIFT.near[0]);   // given: hash salts
    const side = (rand(tick, seed, 805) - 0.5) * 8;   // vision: what the sea brings
    const x = p.location.x - ux * d - uz * side, z = p.location.z - uz * d + ux * side;
    try {
      const b = dim.getBlock({ x: Math.floor(x), y: SEA_LEVEL, z: Math.floor(z) });
      if (!b || !/water/.test(b.typeId)) continue;
      const f = driftFind(seed, x, z, tick);
      const e = dim.spawnItem(new ItemStack(f.item, f.count), { x, y: SEA_LEVEL + 0.8, z });   // vision: what the sea brings
      if (e) list.push(e);
    } catch (err) {
      warnOnce("drift", `[Shipwright] Drift: ${err}`);
    }
  }
}

// ---------------------------------------------------------------- the sea laws, near players in the Reach

const now = () => { try { return world.getAbsoluteTime(); } catch { return system.currentTick; } };
const perm = (id) => BlockPermutation.resolve(id);
const NEAR = 24;                               // vision: how far round a player the tide and reefs are worked
const tides = new Map();                       // 64-block cell -> "low" | "high", as last laid
let tideJob = null, reefJob = null, lastDay = null;

/** Lays the tide's flats round each player in the Reach when the water turns (law 2). */
function tideTick(seed, dim) {
  if (tideJob) return;
  const work = [];
  for (const p of world.getAllPlayers()) {
    if (p.dimension?.id !== SEA_DIM || !inReach(seed, p.location.x, p.location.z)) continue;
    const key = `${Math.floor(p.location.x / 64)},${Math.floor(p.location.z / 64)}`;   // vision: a tide cell
    const low = lowWater(seed, p.location.x, p.location.z, now()) ? "low" : "high";
    if (tides.get(key) === low) continue;
    tides.set(key, low);
    work.push({ x: Math.floor(p.location.x), z: Math.floor(p.location.z), low: low === "low" });
  }
  if (!work.length) return;
  tideJob = system.runJob((function* () {
    try {
      for (const w of work) for (let dx = -NEAR; dx <= NEAR; dx++) {
        for (let dz = -NEAR; dz <= NEAR; dz++) {
          const x = w.x + dx, z = w.z + dz, c = columnAt(seed, x, z);
          if (!isFlat(c)) continue;
          const b = dim.getBlock({ x, y: SEA_LEVEL, z });
          if (!b) continue;
          const bed = flatBlock(seed, x, z, c);
          if (w.low && b.typeId === "minecraft:water") b.setPermutation(perm(bed));
          else if (!w.low && b.typeId === bed) b.setPermutation(perm("minecraft:water"));
        }
        yield;
      }
    } catch (err) { warnOnce("tide", `[Shipwright] Tide: ${err}`); }
    tideJob = null;
  })());
}

const CROPS = /^minecraft:(wheat|carrots|potatoes|beetroot|melon_stem|pumpkin_stem)$/;
/** In a storm, the sea takes loose things off the exposed edges of a raft (law 4: items and crops only). */
function washTick(seed, dim) {
  for (const p of world.getAllPlayers()) {
    if (p.dimension?.id !== SEA_DIM || !inReach(seed, p.location.x, p.location.z)) continue;
    const w = windField(seed, p.location.x, p.location.z, system.currentTick);
    if (w.storm < 0.25) continue;                                   // vision: only in a storm
    const m = Math.hypot(w.x, w.z) || 1;
    const H = waveHeight(SEA_LAWS.wind * m, 400);                   // vision: the Reach's open fetch, 400 blocks
    const ex = w.x / m, ez = w.z / m;                               // downwind
    const exposed = (x, y, z) => {                                  // freeboard over the sea, and a wall upwind
      let f = y - SEA_LEVEL;
      for (let k = 1; k <= 2; k++) {
        const b = dim.getBlock({ x: Math.round(x - ex * k), y: y + 1, z: Math.round(z - ez * k) });
        if (b && !b.isAir && b.typeId !== "minecraft:air" && !/water/.test(b.typeId)) { f += SEA_LAWS.breakwater; break; }
      }
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => /water/.test(dim.getBlock({ x: x + a, y: y - 1, z: z + c })?.typeId ?? ""));
      return edge ? f : Infinity;
    };
    for (const e of dim.getEntities({ type: "minecraft:item", location: p.location, maxDistance: 16 })) {   // vision: within a raft's reach
      const x = Math.floor(e.location.x), y = Math.floor(e.location.y), z = Math.floor(e.location.z);
      if (rand(x, z, system.currentTick, seed, 811) < washChance(H, exposed(x, y, z))) e.teleport({ x: e.location.x + ex * 3, y: SEA_LEVEL + 0.6, z: e.location.z + ez * 3 });   // vision: over the side
    }
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) for (let y = SEA_LEVEL + 1; y <= SEA_LEVEL + 3; y++) {   // vision: a raft's crops
      const x = Math.floor(p.location.x) + dx, z = Math.floor(p.location.z) + dz;
      const b = dim.getBlock({ x, y, z });
      if (!b || !CROPS.test(b.typeId)) continue;
      if (rand(x, y, z, system.currentTick, seed, 812) < washChance(H, exposed(x, y, z))) b.setPermutation(perm("minecraft:air"));   // given: hash salts
    }
  }
}

/** Once a day: coral spreads over touching sand, and sand caught between corals builds up (law 5). */
function reefTick(seed, dim) {
  const day = Math.floor(now() / 24000);           // given: a day in ticks
  if (lastDay === null) { lastDay = day; return; }
  if (day === lastDay || reefJob) return;
  lastDay = day;
  const centres = world.getAllPlayers().filter((p) => p.dimension?.id === SEA_DIM && inReach(seed, p.location.x, p.location.z)).map((p) => ({ x: Math.floor(p.location.x), z: Math.floor(p.location.z) }));
  if (!centres.length) return;
  reefJob = system.runJob((function* () {
    try {
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const c of centres) for (let dx = -NEAR; dx <= NEAR; dx++) {
        for (let dz = -NEAR; dz <= NEAR; dz++) {
          const x = c.x + dx, z = c.z + dz;
          for (let y = SEA_LEVEL - 1; y >= SEA_LEVEL - 7; y--) {     // vision: the lit shallows
            const b = dim.getBlock({ x, y, z });
            if (!b || b.typeId === "minecraft:water") continue;
            const id = b.typeId, depth = SEA_LEVEL - y;
            if (/_coral_block$/.test(id) && !/dead_/.test(id)) {
              const r = reefRate(seaHeat(seed, x, z), depth);
              for (const [a, k] of sides) {
                const n = dim.getBlock({ x: x + a, y, z: z + k });
                if (n?.typeId === "minecraft:sand" && rand(x + a, y, z + k, day, seed, 813) < r) n.setPermutation(perm(id));   // given: hash salts
              }
            } else if (id === "minecraft:sand" && depth <= 2) {
              const corals = sides.filter(([a, k]) => /_coral_block$/.test(dim.getBlock({ x: x + a, y, z: z + k })?.typeId ?? "")).length;
              const up = dim.getBlock({ x, y: y + 1, z });
              if (corals >= 2 && up?.typeId === "minecraft:water" && rand(x, y, z, day, seed, 814) < reefRate(seaHeat(seed, x, z), depth)) up.setPermutation(perm("minecraft:sand"));   // given: hash salts
            }
            break;
          }
        }
        yield;
      }
    } catch (err) { warnOnce("reef", `[Shipwright] Reefs: ${err}`); }
    reefJob = null;
  })());
}

export const _seaLawsTest = { tideTick, washTick, reefTick, reset: () => { tides.clear(); tideJob = null; reefJob = null; lastDay = null; } };

export function startBoatblock() {
  system.runInterval(() => {
    if (!seaWorldOn()) return;
    try {
      const seed = worldSeed(), dim = world.getDimension(SEA_DIM);
      tideTick(seed, dim);
      reefTick(seed, dim);
    } catch (err) { warnOnce("sealaws", `[Shipwright] Sea laws: ${err}`); }
  }, 100);   // vision: every five seconds
  system.runInterval(() => {
    if (!seaWorldOn()) return;
    try { washTick(worldSeed(), world.getDimension(SEA_DIM)); } catch (err) { warnOnce("wash", `[Shipwright] Storm wash: ${err}`); }
  }, 200);   // vision: a wave group every ten seconds
  system.runInterval(() => {
    if (!seaWorldOn()) return;
    try { driftTick(worldSeed()); } catch (err) { warnOnce("boatblock", `[Shipwright] Boatblock: ${err}`); }
  }, 20);   // vision: what the sea brings
  // the castaway bell on the heart's edge
  world.afterEvents.playerInteractWithBlock?.subscribe((ev) => {
    try {
      const b = ev.block, p = ev.player;
      if (b?.dimension?.id !== SEA_DIM || b.typeId !== "minecraft:bell") return;
      const hp = homeportIfReady(worldSeed());
      if (!hp || b.location.x !== hp.bell.x || b.location.y !== hp.bell.y || b.location.z !== hp.bell.z) return;
      system.run(() => offerRaft(p));
    } catch (err) {
      warnOnce("bell", `[Shipwright] Castaway bell: ${err}`);
    }
  });
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "shipwright:mode") return;
    const arg = String(ev.message ?? "").trim().toLowerCase();
    if (arg === "boatblock" || arg === "port") world.setDynamicProperty(MODE_KEY, arg);
    const msg = `[Shipwright] Newcomers start ${worldMode() === "boatblock" ? "on the castaway raft (boatblock)" : "at the homeport (port)"}.`;
    console.warn(msg);
    tell(ev.sourceEntity, `§e${msg}`);
  });
}
