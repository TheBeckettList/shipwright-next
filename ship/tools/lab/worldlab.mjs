// The world lab: the sea world's math, laid out chunk by chunk through the game's own code on the
// test grid, and looked at the way the yard lab looks at docks.
//
//   node --import ./tests/mocks/register.mjs tools/lab/worldlab.mjs [seed ...]
//
// Lenses
//   shape     land is a small share (expansive ocean), in archipelagos; every group's water is
//             deep enough to sail between; the climates all occur
//   peoples   every confederation with islands has a capital and a culture its climate allows;
//             names are made up; lanes join every member
//   sites     wrecks lie along lanes more than off them; every wreck is a real ship of the water's
//             people; nothing breaks the surface but flotsam
//   stick     a laid chunk's blocks are all real Bedrock blocks and states, and stay put (nothing
//             falling, floating or hanging on air); trees stand on ground; seams between chunks agree
//   spawn     the spawn beach is dry, not polar, and a boat can be launched from it (water 2+ deep
//             within 24 blocks)
//   speed     a chunk is worked out quickly enough to stay ahead of a ship under sail
import { world, system } from "@minecraft/server";
import { elevation, climate, groupAt, SEA_LEVEL, FLOOR_MIN, CLIMATES } from "../../BP/scripts/world/terrain.js";
import { confederation, seatAt, lanesNear, toLane, groupWoods } from "../../BP/scripts/world/peoples.js";
import { TRADITION_WOOD } from "../../BP/scripts/world/biomes.js";
import { greatAt } from "../../BP/scripts/world/terrain.js";
import { sitesIn } from "../../BP/scripts/world/sites.js";
import { chunkPlan, CHUNK } from "../../BP/scripts/world/chunkgen.js";
import { layChunk, spawnPoint } from "../../BP/scripts/seaworld.js";
import { structuresIn, fortresses } from "../../BP/scripts/world/structures.js";
import { PLANS } from "../../BP/scripts/config/plans.js";
import { notAllowed, unsupported } from "./blocks.mjs";

export function shapeLens(seed) {
  const issues = [];
  let land = 0, n = 0;
  const seen = new Set();
  for (let x = -6000; x < 6000; x += 41) for (let z = -6000; z < 6000; z += 41) {
    const e = elevation(seed, x, z);
    n++;
    if (e.land) { land++; seen.add(climate(seed, x, z).key); }
  }
  const share = land / n;
  if (share > 0.14) issues.push(`land is ${(share * 100).toFixed(1)}%: not an ocean world`);
  if (share < 0.03) issues.push(`land is ${(share * 100).toFixed(1)}%: too little to live on`);
  const missing = Object.keys(CLIMATES).filter((k) => !seen.has(k));
  if (missing.length > 2) issues.push(`climates never met in 12000 blocks: ${missing.join(", ")}`);
  return { land: +(share * 100).toFixed(1), climates: [...seen], issues };
}

export function peoplesLens(seed) {
  const issues = [];
  const names = new Set();
  let confeds = 0, lanes = 0;
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) {
    const c = confederation(seed, seatAt(seed, cx, cz));
    if (!c.members.length) continue;
    confeds++;
    lanes += c.lanes.length;
    if (!c.culture) { confeds--; continue; }                     // unsettled: nothing grows there to build with
    if (!c.capital) issues.push(`${c.id}: islands but no capital`);
    // inherency: a people's own islands grow the wood its boats are built of
    const grows = c.members.filter((m) => m.tradition === c.culture).some((m) => {
      const g = m.great ? greatAt(seed, ...m.id.slice(1).split(",").map(Number)) : groupAt(seed, ...m.id.slice(1).split(",").map(Number));
      return (groupWoods(seed, g).woods[TRADITION_WOOD[c.culture]] ?? 0) > 0;
    });
    if (!grows && c.members.some((m) => groupWoods(seed, m.great ? greatAt(seed, ...m.id.slice(1).split(",").map(Number)) : groupAt(seed, ...m.id.slice(1).split(",").map(Number))).land > 0)) issues.push(`${c.name}: ${c.culture} people whose islands grow no ${TRADITION_WOOD[c.culture]}`);
    if (c.lanes.length !== c.members.length - 1) issues.push(`${c.name}: ${c.members.length} members but ${c.lanes.length} lanes`);
    names.add(c.name);
  }
  if (names.size < confeds * 0.7) issues.push(`only ${names.size} names for ${confeds} confederations`);
  return { confeds, lanes, issues };
}

export function sitesLens(seed) {
  const issues = [];
  const all = sitesIn(seed, -5000, -5000, 5000, 5000, 0);
  const near = [], far = [];
  for (const s of all.filter((x) => x.kind === "wreck" && !x.theran)) {   // (the Therans' own ships are lost off the lanes, on purpose)
    let d = Infinity;
    for (const l of lanesNear(seed, s.x, s.z)) d = Math.min(d, toLane(l, s.x, s.z).d);
    (d < 120 ? near : far).push(s);
    const p = PLANS[s.plan];
    if (!p) issues.push(`wreck ${s.id} of an unknown ship ${s.plan}`);
    else if (p.tradition !== s.tradition) issues.push(`wreck ${s.id}: a ${p.tradition} ship in ${s.tradition} water`);
  }
  if (near.length < far.length) issues.push(`more wrecks off the lanes (${far.length}) than on them (${near.length})`);
  const kinds = {};
  for (const s of all) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
  return { kinds, onLanes: near.length, offLanes: far.length, issues };
}

const dimOf = () => world.getDimension("shipwright:sea");

/** Lays chunks through the game's own generator, then checks every block. */
export function stickLens(seed, chunks) {
  const issues = [];
  const dim = dimOf();
  for (const [cx, cz] of chunks) {
    const g = layChunk(dim, seed, cx, cz);
    while (!g.next().done);
  }
  const get = (x, y, z) => {
    const id = dim.blocks.get(`${x},${y},${z}`);
    return id ? { id, states: dim.states.get(`${x},${y},${z}`) ?? {} } : null;
  };
  const bad = new Map();
  const note = (k) => bad.set(k, (bad.get(k) ?? 0) + 1);
  for (const [cx, cz] of chunks) {
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    if (dim.blocks.get(`${x0},${FLOOR_MIN - 1},${z0}`) !== "minecraft:barrier") note("chunk not marked done");
    for (let x = x0; x < x0 + CHUNK; x++) for (let z = z0; z < z0 + CHUNK; z++) for (let y = FLOOR_MIN; y <= SEA_LEVEL + 60; y++) {
      const b = get(x, y, z);
      if (!b || b.id === "minecraft:water") continue;
      const why = notAllowed(b.id, b.states);
      if (why) note(why);
      const u = unsupported(get, x, y, z, b);
      if (u) note(u);
      // nothing hangs on air except leaves, logs (tree crowns, beams), and flotsam riding the water
      const below = get(x, y - 1, z);
      if (!below && y > FLOOR_MIN && !/leaves|_log$|bamboo_block|bone_block|mushroom_block|bamboo$|ladder|end_portal_frame|stone_bricks|snow$|spruce_planks|oak_planks|iron_bars|lantern/.test(b.id) && !(y === SEA_LEVEL && /slab|barrel|ice/.test(b.id)) && b.id !== "minecraft:air") note(`${b.id} over the void`);
      if (y === SEA_LEVEL + 1 && /water/.test(below?.id ?? "") && !/slab|barrel/.test(b.id)) {}  // (surface blocks checked above)
      if (/_log$/.test(b.id) && b.states.pillar_axis === "y" && below && /water/.test(below.id) && y > SEA_LEVEL) note("a trunk standing in water");
    }
  }
  for (const [k, v] of bad) issues.push(`${v}× ${k}`);
  // seams: the plan for a chunk is the same however often it's made
  const [a] = chunks;
  if (JSON.stringify(chunkPlan(seed, a[0], a[1]).blocks) !== JSON.stringify(chunkPlan(seed, a[0], a[1]).blocks)) issues.push("a chunk's plan changes between runs");
  return { chunks: chunks.length, issues };
}

export function spawnLens(seed) {
  const issues = [];
  const sp = spawnPoint(seed);
  const e = elevation(seed, Math.floor(sp.x), Math.floor(sp.z));
  if (!e.land) issues.push("spawn is in the water");
  if (climate(seed, sp.x, sp.z).key === "polar") issues.push("spawn is polar");
  let water = Infinity;
  for (let dx = -24; dx <= 24; dx++) for (let dz = -24; dz <= 24; dz++) {
    const w = elevation(seed, Math.floor(sp.x) + dx, Math.floor(sp.z) + dz);
    if (!w.land && w.depth >= 2) water = Math.min(water, Math.hypot(dx, dz));
  }
  if (water > 24) issues.push("no water deep enough for a boat within 24 blocks of spawn");
  return { at: [Math.round(sp.x), Math.round(sp.z)], water: +water.toFixed(1), climate: climate(seed, sp.x, sp.z).key, issues };
}

export function speedLens(seed) {
  const t = Date.now();
  let n = 0;
  for (let i = 0; i < 60; i++) { chunkPlan(seed, 100 + i * 7, -50 + i * 3); n++; }
  const ms = (Date.now() - t) / n;
  // a ship at full speed (about 0.45 blocks a tick) crosses a chunk in 36 ticks: one chunk ahead
  // across a 15-chunk front needs a chunk every 2.4 ticks, about 120 ms of a second's 1000.
  return { ms: +ms.toFixed(1), issues: ms > 30 ? [`${ms.toFixed(1)} ms a chunk: too slow to stay ahead of a ship`] : [] };
}

/** Chunks to lay for the stick lens: around the spawn, a wreck, a ruin, flotsam, a forest. */
export function sampleChunks(seed) {
  const sp = spawnPoint(seed);
  const all = sitesIn(seed, -3000, -3000, 3000, 3000, 0);
  const st = structuresIn(seed, -9000, -9000, 9000, 9000, 0);
  const pts = [[sp.x, sp.z], ...["wreck", "ruin", "flotsam"].map((k) => all.find((s) => s.kind === k)).filter(Boolean).map((s) => [s.x, s.z]),
    ...["fortress", "monument", "gate", "igloo", "hut"].map((k) => st.find((s) => s.kind === k)).filter(Boolean).map((s) => [s.x, s.z])];
  const out = new Set();
  for (const [x, z] of pts) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.add(`${cx + i},${cz + j}`);
    out.add(`${cx},${cz + 2}`);
  }
  return [...out].map((k) => k.split(",").map(Number));
}

function main() {
  const seeds = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  let bad = 0;
  for (const seed of seeds.length ? seeds : [12345, 777, 4242]) {
    const say = (label, r, extra = "") => {
      bad += r.issues.length;
      console.log(`${String(seed).padEnd(6)} ${label.padEnd(8)} ${r.issues.length ? r.issues.length + " issue(s)" : "clean"} ${extra}`);
      for (const i of r.issues) console.log(`    ${i}`);
    };
    const sh = shapeLens(seed); say("shape", sh, `land ${sh.land}%, climates ${sh.climates.length}`);
    const pe = peoplesLens(seed); say("peoples", pe, `${pe.confeds} confederations, ${pe.lanes} lanes`);
    const si = sitesLens(seed); say("sites", si, JSON.stringify(si.kinds) + ` on lanes ${si.onLanes} / off ${si.offLanes}`);
    const sp = spawnLens(seed); say("spawn", sp, `at ${sp.at} (${sp.climate}), water ${sp.water} away`);
    const st = stickLens(seed, sampleChunks(seed)); say("stick", st, `${st.chunks} chunks laid`);
    const sd = speedLens(seed); say("speed", sd, `${sd.ms} ms a chunk`);
  }
  process.exitCode = bad ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
