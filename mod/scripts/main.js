// Waterworld: the golden-law world in the game. A dimension of its own ("waterworld:sea"), laid chunk
// by chunk around the players from the sim's own math (game/ground.js over world/map.js, world/thera.js,
// world/climate.js) and the structures baked for Thera. Players arrive at the Sea Rite Temple.
//
// Commands (from chat, with cheats on):
//   /scriptevent waterworld:go temple|coldhouse|exchange|library|acropolis|light|harbour|spawn
//   /scriptevent waterworld:go <x> <z>         any place (the ground there is laid first)
//   /scriptevent waterworld:where              where you are: latitude, biome, temperature, the city's kind
//   /scriptevent waterworld:radius <n>         the surface ring: chunks laid round each player (default 13)
//   /scriptevent waterworld:pregen on|off|status|reset   the background tour that lays the whole world, outward from Thera
//   /scriptevent waterworld:relay              lay the chunk you stand in again
//   /scriptevent waterworld:struct [n]         try the drawing's trick: prototype n placed whole, and again block by block, timed
//   /scriptevent waterworld:leave              back to the overworld (waterworld:go to return)
//   /scriptevent waterworld:fly [b/s] [s] [deg] the flight test: the server flies a centre of its own and counts the holes
import { world, system } from "@minecraft/server";
import { useMap, useIslets, useInsets } from "./world/map.js";
import { useDrainage, useTrunks } from "./world/rivers.js";
import { useSeaDistance } from "./world/climate.js";
import { DRAINAGE, SEADIST, STONES, HOMEPORTS, TRUNKS } from "./data/terrain.js";
import { useHomeports } from "./world/homesites.js";
import { useStones } from "./world/stones.js";
import { theraChunk, THERA } from "./world/thera.js";
import { D } from "./core/given.js";
import { useCity, useTarn, useCascade, heightAt, theraUV, KINDS, SEA } from "./game/ground.js";
import { CALIBRATION } from "./game/calibration.js";
import { climateAtBlock } from "./world/climate.js";
import { latOf, lonOf } from "./core/globe.js";
import { when, RUNGS } from "./core/clock.js";
import { W, H, ROWS, ISLETS } from "./data/map.js";
import { N as CITY_N, RLE, TARN, POOLS } from "./data/city.js";
import { PLACES, PROTOS, PALETTE as STRUCT_PALETTE } from "./data/structures.js";
import { FAITH } from "./data/faith.js";
import { layChunk, layTo, levelAt, LEVEL, isDone, isLoaded, MARK, FOLK, COUNT, spawnFolk, perm, planAhead, flatOf } from "./lay.js";
import { RINGS, WEIGHT, targetAt, targetFor, chunkDist, tileOf, tourLength, TILE, ledChunk, aheadTile, FAST, SEEN } from "./rings.js";
import { duty, startTempo, tempoReport } from "./tempo.js";
import { probe, tpsProbe, chunkProbe, holesProbe, siteProbe, soakSites } from "./probe.js";
import { BY_CHUNK, HORAIA, COURSES, PARK } from "./data/structures.js";
import { horaiLeaf } from "./game/therantrees.js";
import { RESIDENTS, CULTURES } from "./data/folk.js";
import { WAYS, DRESS } from "./data/faith.js";
import { b64 } from "./b64.js";
import "./ship/main.js";   // the ship module: Shipwright folded in (ship/, baked to scripts/ship/)
import { useWaterworldWind } from "./ship/wind.js";
useWaterworldWind();   // the helm feels the globe's wind
import { startBank } from "./bank.js";
startBank();   // the League's counter (world/coinage.js)

export const VERSION = "0.9.13";
const DIM = "waterworld:sea";
console.warn(`[Waterworld] Scripts ${VERSION} loaded`);
const C = 16;
const CW = (W * D.PX) / C, CH = (H * D.PX) / C;   // the world in chunks (the map's cells are regions of D.PX blocks)
const PREGEN_TILES = (2 * Math.ceil(THERA.REACH / TILE) + 1) ** 2;   // the tour lays Thera's reach ahead of players; the rest of the world is laid as players reach it
RINGS.deep = Math.min(RINGS.surface, CALIBRATION.radius);   // calibrated (game/calibration.js): the deep ring
let ready = false, registered = false;
const done = new Set(), failed = new Map();

// ---- the dimension
try {
  system.beforeEvents.startup.subscribe((ev) => {
    try { ev.dimensionRegistry.registerCustomDimension(DIM); registered = true; }
    catch (e) { console.warn(`[Waterworld] couldn't register the dimension: ${e}`); }
  });
} catch (e) { console.warn(`[Waterworld] no startup event: ${e}`); }
const dim = () => { try { return world.getDimension(DIM); } catch { return null; } };

// ---- the world's data, decoded over a few ticks (so the game never waits on it)
function* loadWorld() {
  const data = new Uint8Array(W * H);
  for (let z = 0; z < H; z++) { data.set(b64(ROWS[z]), z * W); if (z % 16 === 0) yield; }
  useMap({ w: W, h: H, data });
  useIslets(ISLETS);
  useInsets([theraChunk]);
  useDrainage(DRAINAGE); useTrunks(TRUNKS.trunks); useStones(STONES.stones); useHomeports(HOMEPORTS.homeports); yield;
  { const r = b64(SEADIST), sd = new Uint8Array(W * H); for (let i = 0, k = 0; i < r.length; i += 3) { const n = r[i + 1] | (r[i + 2] << 8); sd.fill(r[i], k, k + n); k += n; if (i % 3000 === 0) yield; } useSeaDistance(sd); }
  const rle = b64(RLE), grid = new Uint8Array(CITY_N * CITY_N);
  for (let i = 0, k = 0; i < rle.length; i += 3) { const v = rle[i], n = rle[i + 1] | (rle[i + 2] << 8); grid.fill(v, k, k + n); k += n; if (i % 3000 === 0) yield; }
  useCity(grid, CITY_N); useTarn(TARN); useCascade(POOLS);
  ready = true;
  console.warn(`[Waterworld] the world is loaded: ${W} x ${H} chunks, Thera's city grid ${CITY_N} x ${CITY_N}`);
}

// ---- arrivals: into the sea world, held in the air until the ground under them is laid
const holding = new Map();   // player id -> { at, since }
function bring(p, at, why = "") {
  const d = dim(); if (!d) { p.sendMessage("§c[Waterworld] The sea world's dimension isn't there (see the notes: the add-on needs the Beta APIs experiment)."); return; }
  holding.set(p.id, { at, since: system.currentTick });
  try { p.teleport({ x: at.x, y: at.y + 1, z: at.z }, { dimension: d }); } catch (e) { console.warn(`[Waterworld] teleport: ${e}`); }
  try { p.addEffect("slow_falling", 600, { showParticles: false }); p.addEffect("resistance", 600, { amplifier: 4, showParticles: false }); } catch {}
  if (why) p.sendMessage(why);
}
function hold() {
  const d = dim(); if (!d) return;
  for (const p of world.getAllPlayers()) {
    const h = holding.get(p.id); if (!h) continue;
    const cx = Math.floor(h.at.x / C), cz = Math.floor(h.at.z / C);
    if (levelOf(d, cx, cz) >= LEVEL.life) {
      holding.delete(p.id);
      try { p.teleport(h.at, { dimension: d }); p.removeEffect("slow_falling"); } catch {}
      continue;
    }
    if (p.dimension.id !== DIM || Math.abs(p.location.x - h.at.x) > 2 || Math.abs(p.location.z - h.at.z) > 2 || p.location.y < h.at.y - 1) {
      try { p.teleport({ x: h.at.x, y: h.at.y + 1, z: h.at.z }, { dimension: d }); } catch {}
    }
    if (system.currentTick - h.since > 20 * 60) { holding.delete(p.id); p.sendMessage("§e[Waterworld] The ground is slow to come: you're free (it keeps laying round you)."); }
  }
}
world.afterEvents.playerSpawn.subscribe((ev) => {
  const p = ev.player;
  const go = () => {
    if (!ready) return system.runTimeout(go, 20);
    if (p.getDynamicProperty("waterworld:left")) return;
    if (p.dimension.id !== DIM) bring(p, PLACES.spawn, ev.initialSpawn ? `§b${welcomeText()}` : "");
    try { p.setSpawnPoint({ dimension: dim(), x: PLACES.spawn.x, y: PLACES.spawn.y, z: PLACES.spawn.z }); } catch {}
  };
  system.runTimeout(go, 10);
});
const welcomeText = () => `Welcome to Thera, at the Sea Rite Temple. ${FAITH.tenets[0]} ${FAITH.tenets[1]}\n§7/scriptevent waterworld:go coldhouse | exchange | library | acropolis | light | harbour, or waterworld:where`;

// ---- the laying, by rings (rings.js): one long job (system.runJob) that lays chunk after chunk in the engine's
// slack, each the pass with the least score (its distance times its pass's weight) round where each player will be
// (their velocity, LEAD seconds on); it stops when nothing wants laying, and the tempo's layer beat wakes it
let job = null;
const lvl = new Map();   // chunk -> level laid (read from its mark once, then kept)
const levelOf = (d, cx, cz) => { const k = `${cx},${cz}`; let v = lvl.get(k); if (v === undefined) { v = levelAt(d, cx, cz); lvl.set(k, v); if (v === LEVEL.deep) done.add(k); } return v; };
const wrapX = (cx) => ((cx % CW) + CW) % CW;
/** A centre the rings are laid round: where it is (cx, cz), where it will be (lx, lz), and whether it's fast. */
function centreOf(x, z, vx = 0, vz = 0) { const l = ledChunk(x, z, vx, vz, C); return { cx: wrapX(Math.floor(x / C)), cz: Math.floor(z / C), lx: wrapX(l.cx), lz: l.cz, x, z, vx, vz, fast: Math.hypot(vx, vz) > FAST }; }
function centres() {
  const want = [];
  for (const p of world.getAllPlayers()) {
    const h = holding.get(p.id); if (h) { want.push(centreOf(h.at.x, h.at.z)); continue; }
    if (p.dimension.id !== DIM) continue;
    let v = { x: 0, z: 0 }; try { v = p.getVelocity(); } catch {}
    want.push(centreOf(p.location.x, p.location.z, v.x * TPS, v.z * TPS));   // given: the velocity is blocks a tick
  }
  if (soak?.at) want.push(centreOf(soak.at.x, soak.at.z));
  const f = flightAt(); if (f) want.push(centreOf(f.x, f.z, f.vx, f.vz));
  return want;
}
const TPS = 20;   // given: the game's ticks a second
const nearest = (cx, cz, cs) => Math.min(...cs.map((c) => chunkDist(cx, cz, c.cx, c.cz, CW)));
/** The next pass anywhere round anyone: { cx, cz, level, why } or null. */
function pick(d, cs) {
  let best = null;
  for (const c of cs) for (let a = -RINGS.surface; a <= RINGS.surface; a++) for (let b = -RINGS.surface; b <= RINGS.surface; b++) {
    const cx = wrapX(c.lx + a), cz = c.lz + b; if (cz < 0 || cz >= CH) continue;
    let dist = Infinity, target = 0;
    for (const o of cs) { const dl = chunkDist(cx, cz, o.lx, o.lz, CW), dp = chunkDist(cx, cz, o.cx, o.cz, CW); target = Math.max(target, targetFor(dl, dp, o.fast)); dist = Math.min(dist, dl, dp); }
    if (!target || (failed.get(`${cx},${cz}`) ?? 0) > system.currentTick) continue;
    if (best && dist >= best.score) continue;   // no pass here can beat the best (the least weight is one)
    if (!isLoaded(d, cx, cz)) continue;
    const at = levelOf(d, cx, cz); if (at >= target) continue;
    const score = dist * WEIGHT[at + 1];
    if (!best || score < best.score) best = { cx, cz, level: at + 1, score, why: "ring" };
  }
  return best;
}
/** Spare time: the sim reckons the columns of chunks ahead of a fast centre that aren't loaded yet (so when they
 *  load, only the game's own calls are left). A few a wake, nearest the led centre first. */
const planned = new Set();
function* planSpare(d, cs) {
  let n = 0;
  for (const c of cs) { if (!c.fast) continue;
    for (let r = 0; r <= RINGS.surface && n < FIB_PLAN; r++) for (let a = -r; a <= r && n < FIB_PLAN; a++) for (let b = -r; b <= r && n < FIB_PLAN; b++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
      const cx = wrapX(c.lx + a), cz = c.lz + b, k = `${cx},${cz}`; if (cz < 0 || cz >= CH || planned.has(k) || (lvl.get(k) ?? 0) > 0) continue;
      yield* planAhead(cx, cz); planned.add(k); if (planned.size > FIB_PLANS) planned.delete(planned.values().next().value); n++; yield;
    } }
}
const FIB_PLAN = 5, FIB_PLANS = 144;   // vision: five chunks reckoned a wake, the last hundred and forty-four remembered
function* layer() {
  for (;;) {
    const d = dim(); if (!d || !ready) break;
    const cs = centres(), t = pick(d, cs) ?? pregenNext(d);
    if (!t) { yield* planSpare(d, cs); break; }
    yield* layOne(d, t, cs);
  }
  job = null;
}
/** One chunk to a level, its busy time measured step by step (the engine's slack between steps isn't counted). */
function* layOne(d, { cx, cz, level, why }, cs) {
  const key = `${cx},${cz}`, from = lvl.get(key) ?? 0, folkToo = why !== "pregen" && nearest(cx, cz, cs) <= RINGS.folk, before = { ...COUNT }, g = layTo(d, cx, cz, level, { folk: folkToo });
  let busy = 0;
  for (;;) {
    const t0 = Date.now(); let r;
    try { r = g.next(); } catch (e) { lvl.delete(key); failed.set(key, system.currentTick + 40); stats.fail++; if (stats.fail < 4) console.warn(`[Waterworld] chunk ${key}: ${e}`); return; }
    busy += Date.now() - t0; if (r.done) break; yield;
  }
  lvl.set(key, level); if (level === LEVEL.deep) done.add(key); if (folkToo && level >= LEVEL.life) folkOut.add(key);
  stats.n++; stats.ms += busy; stats.by[why] = (stats.by[why] ?? 0) + 1;
  chunkProbe(cx, cz, busy, before, theraUV(cx * C + 8, cz * C + 8) ? "thera" : BY_CHUNK[key] ? "town" : climateAtBlock(cx * C + 8, cz * C + 8).h > 0 ? "land" : "sea", { from, to: level, why });
}
function wake() { if (!job && ready) { job = true; system.runJob(layer()); } }

// ---- the watch: ticking areas held ahead of fast players (and the flight test), and the holes in view counted
const ahead = new Map();   // area name -> its tile
function watch() {
  const d = dim(); if (!d || !ready) return;
  const cs = centres().filter((c) => c.fast).slice(0, FIB_AHEAD), names = new Set();
  cs.forEach((c, i) => {
    const t = aheadTile(c.x, c.z, c.vx, c.vz, C, CW, CH), name = `wwahead${i}`; if (!t) return; names.add(name);
    const was = ahead.get(name); if (was && Math.abs(was.cx0 - t.cx0) < TILE / 2 && Math.abs(was.cz0 - t.cz0) < TILE / 2) return;   // moved half a tile or more: move the area
    try { d.runCommand(`tickingarea remove ${name}`); } catch {}
    try { d.runCommand(`tickingarea add ${t.cx0 * C} 0 ${t.cz0 * C} ${t.cx1 * C + C - 1} 0 ${t.cz1 * C + C - 1} ${name}`); ahead.set(name, t); } catch { ahead.delete(name); }
  });
  for (const name of [...ahead.keys()]) if (!names.has(name)) { try { d.runCommand(`tickingarea remove ${name}`); } catch {} ahead.delete(name); }
  if (++watch.n % FIB_HOLES === 0) holes(d);
  const f = flightAt(); if (f) flightStep(d, f);
}
watch.n = 0;
const FIB_AHEAD = 2, FIB_HOLES = 8;   // vision: two players' areas ahead at most (the game allows ten areas); holes counted every eighth watch
/** The glitch metric: chunks within SEEN of each centre whose skin isn't laid, and those in front of a mover. */
function holes(d) {
  for (const c of centres()) {
    let n = 0, h = 0, front = 0;
    for (let a = -SEEN; a <= SEEN; a++) for (let b = -SEEN; b <= SEEN; b++) {
      const cx = wrapX(c.cx + a), cz = c.cz + b; if (cz < 0 || cz >= CH) continue; n++;
      if ((lvl.get(`${cx},${cz}`) ?? 0) < LEVEL.surface) { h++; if (a * c.vx + b * c.vz > 0) front++; }
    }
    const speed = Math.round(Math.hypot(c.vx, c.vz) * 10) / 10;
    holesProbe({ speed, n, holes: h, front, fast: c.fast, laid: stats.n, kind: climateAtBlock(c.x, c.z).h > 0 ? "land" : "sea" });
    const fl = flightAt(); if (fl && fl.x === c.x) { fl.sum.n++; fl.sum.holes += h / n; fl.sum.front += front / n; fl.sum.worst = Math.max(fl.sum.worst, h / n); }
  }
}

// ---- the seasons: the Horaia (game/therantrees.js), the Therans' tree of the seasons on the island in the cone's
// round lake, its crown laid again in the season's leaves whenever the sim's season (core/clock.js) turns. Its
// crown was baked in summer's (the year starts at midsummer); on every start it's set to the season it is
let horaiNow = null, horaiJob = false;
function seasons() {
  if (!HORAIA || horaiJob || !ready) return;
  const d = dim(); if (!d) return;
  const season = when(world.getAbsoluteTime()).season; if (season === horaiNow) return;
  const cx = Math.floor(HORAIA.x / C), cz = Math.floor(HORAIA.z / C); if (!isLoaded(d, cx, cz) || levelOf(d, cx, cz) < LEVEL.life) return;   // only once the tree stands
  horaiJob = true;
  system.runJob((function* () { const L = HORAIA.leaves; for (let i = 0; i < L.length; i += 3) { const x = HORAIA.x + L[i], y = HORAIA.y + L[i + 1], z = HORAIA.z + L[i + 2]; try { d.getBlock({ x, y, z })?.setPermutation(perm(horaiLeaf(season, L[i], L[i + 1], L[i + 2]))); } catch {} if (i % 192 === 0) yield; } horaiNow = season; horaiJob = false; console.warn(`[Waterworld] the Horaia turns to ${season}`); })());
}

// ---- the park's invisible fence: the beasts round the summit pools keep to the cone (no wall, no barrier a player
// would meet): one that has strayed past the park's reach is sent back to where it was born
function park() {
  if (!PARK || !ready) return;
  const d = dim(); if (!d) return;
  let list = []; try { list = d.getEntities({ tags: ["ww_park"] }); } catch { return; }
  for (const e of list) { try { const dx = e.location.x - PARK.x, dz = e.location.z - PARK.z; if (Math.hypot(dx, dz) <= PARK.r) continue;
    const home = e.getTags().find((t) => t.startsWith("ww_home:")); if (!home) continue; const [, x, y, z] = home.split(":").map(Number);
    e.teleport({ x: x + 0.5, y: y + 0.1, z: z + 0.5 }); } catch {} }
}

// ---- the sailing courses (the lagoon, the learn-to-sail water): a player in a boat who passes a course's first buoy
// starts it; each buoy after in turn (within a golden eight of it) is a mark rounded; the last ends it, timed
const ROUND = 8, sailing = new Map();   // vision: within eight blocks of a mark
function courses() {
  if (!COURSES?.length) return;
  for (const p of world.getAllPlayers()) {
    let boat = false; try { boat = !!p.getComponent("minecraft:riding")?.entityRidingOn?.typeId?.includes("boat"); } catch {}
    const s = sailing.get(p.id), near = (m) => Math.hypot(p.location.x - m[0], p.location.z - m[1]) < ROUND;
    if (!boat) { if (s) { sailing.delete(p.id); p.sendMessage("§7Course abandoned (out of the boat)."); } continue; }
    if (!s) { COURSES.forEach((c, i) => { if (c.length && near(c[0]) && !sailing.has(p.id)) { sailing.set(p.id, { c: i, next: 1, t0: system.currentTick }); p.sendMessage(`§bCourse ${i + 1} begun: round ${c.length - 1} marks, red to port, white to starboard.`); } }); continue; }
    const c = COURSES[s.c]; if (s.next < c.length && near(c[s.next])) { s.next++; if (s.next < c.length) p.onScreenDisplay.setActionBar(`§bMark ${s.next - 1} of ${c.length - 1} rounded`); }
    if (s.next >= c.length && near(c[0])) { const secs = ((system.currentTick - s.t0) / TPS).toFixed(1); p.sendMessage(`§6Course ${s.c + 1} sailed in ${secs} s.`); probe("course", { course: s.c + 1, secs: +secs }); sailing.delete(p.id); }   // home to the first mark
  }
}

// ---- the flight test: the server flies a centre of its own along a heading at a speed (no player needed), a
// ticking area round it, and counts the holes: /scriptevent waterworld:fly <blocks a second> [seconds] [degrees]
let flight = null;
function flightAt() {
  if (!flight) return null;
  const s = (system.currentTick - flight.t0) / TPS;
  return Object.assign(flight, { x: flight.x0 + flight.vx * s, z: flight.z0 + flight.vz * s, s });
}
function flightStep(d, f) {
  if (f.s > f.secs) { try { d.runCommand("tickingarea remove wwfly"); } catch {} const sum = f.sum, r = { speed: f.speed, secs: f.secs, holes: sum.n ? sum.holes / sum.n : 0, front: sum.n ? sum.front / sum.n : 0, worst: sum.worst, laid: stats.n - f.laid0, perSec: (stats.n - f.laid0) / f.secs, tempo: tempoReport() }; probe("fly-done", r); console.warn(`[Waterworld] fly done: ${f.speed} b/s for ${f.secs} s: ${(r.holes * 100).toFixed(1)}% of the view unlaid on average, ${(r.front * 100).toFixed(1)}% ahead, worst ${(r.worst * 100).toFixed(1)}%; ${r.perSec.toFixed(2)} passes a second`); flight = null; return; }
  const cx = Math.floor(f.x / C), cz = Math.floor(f.z / C);
  if (f.area && Math.abs(f.area[0] - cx) < 2 && Math.abs(f.area[1] - cz) < 2) return;   // the area moves every two chunks
  try { d.runCommand("tickingarea remove wwfly"); } catch {}
  try { d.runCommand(`tickingarea add circle ${Math.floor(f.x)} 64 ${Math.floor(f.z)} 4 wwfly`); f.area = [cx, cz]; } catch (e) { console.warn(`[Waterworld] fly: no ticking area (${e})`); }
}
const stats = { n: 0, ms: 0, fail: 0, by: {} };

// ---- the folk ring: brought out within RINGS.folk, back into the sim past RINGS.release (rings.js)
const folkOut = new Set();
function folkRing() {
  const d = dim(); if (!d || !ready) return;
  const cs = centres(); if (!cs.length) return;
  try { for (const e of d.getEntities({ type: FOLK })) { const cx = Math.floor(e.location.x / C), cz = Math.floor(e.location.z / C); if (nearest(cx, cz, cs) > RINGS.release) { folkOut.delete(`${cx},${cz}`); e.remove(); } else folkOut.add(`${cx},${cz}`); } } catch {}
  let brought = 0;
  for (const c of cs) for (let a = -RINGS.folk; a <= RINGS.folk && brought < FIB_FOLK; a++) for (let b = -RINGS.folk; b <= RINGS.folk && brought < FIB_FOLK; b++) {
    const cx = (((c.cx + a) % CW) + CW) % CW, cz = c.cz + b, key = `${cx},${cz}`; if (folkOut.has(key) || cz < 0 || cz >= CH) continue;
    if ((lvl.get(key) ?? 0) < LEVEL.life || !isLoaded(d, cx, cz)) continue;
    spawnFolk(d, cx, cz); folkOut.add(key); brought++;
  }
}
const FIB_FOLK = 5;   // vision: chunks' folk brought out a beat at most (so a crowd doesn't arrive in one tick)

// ---- the pregen tour: a ticking area walks the map tile by tile, outward from Thera, laying each chunk's surface
// and life (its depth waits for a player); kept in the world, so it goes on where it stopped after a restart
const pregen = { on: true, sea: false, i: 0, tile: null, stage: "go", since: 0, queue: [], started: Date.now(), laid: 0 };
let tps = 20, lastT = { tick: 0, ms: Date.now() }, tpsN = 0;
const FIB_TPS = 8;   // vision: a tps probe every eighth reading
function tpsTick() { const now = Date.now(), dt = now - lastT.ms; if (dt > 0) tps = Math.min(20, ((system.currentTick - lastT.tick) * 1000) / dt); lastT = { tick: system.currentTick, ms: now }; }
const OPEN_SEA = 8;   // vision: blocks under the sea past which a chunk is open sea (the tour leaves it unless pregen sea on)
const theraCentre = () => ({ cx: Math.floor(PLACES.spawn.x / C), cz: Math.floor(PLACES.spawn.z / C) });
/** The tour's next chunk to lay ({ cx, cz, level, why }) or null; moves its ticking area tile by tile. */
function pregenNext(d) {
  if (!pregen.on || tps < 18) return null;   // vision: the tour yields to a busy server (under 18 ticks a second it waits)
  const total = Math.min(tourLength(CW, CH), PREGEN_TILES);
  if (pregen.stage === "go") {
    let t = null; while (pregen.i < total && !(t = tileOf(pregen.i, theraCentre(), CW, CH))) pregen.i++;
    if (!t) { if (pregen.on) console.warn(`[Waterworld] pregen: the whole world is laid (${pregen.laid} chunks)`); pregen.on = false; return null; }
    pregen.tile = t; try { d.runCommand("tickingarea remove wwpregen"); } catch {}
    try { d.runCommand(`tickingarea add ${t.cx0 * C} 0 ${t.cz0 * C} ${t.cx1 * C + C - 1} 0 ${t.cz1 * C + C - 1} wwpregen`); } catch (e) { console.warn(`[Waterworld] pregen: no ticking area (${e})`); pregen.on = false; return null; }
    pregen.queue = []; for (let cz = t.cz0; cz <= t.cz1; cz++) for (let cx = t.cx0; cx <= t.cx1; cx++) if (pregen.sea || climateAtBlock(cx * C + C / 2, cz * C + C / 2).h > -OPEN_SEA) pregen.queue.push([cx, cz]);   // the open sea waits for a player unless asked (it's a fifth of the cost and most of the world's size on disk)
    if (!pregen.queue.length) { pregen.i++; return null; }
    pregen.stage = "lay"; pregen.since = system.currentTick; return null;
  }
  if (pregen.stage === "lay") {
    while (pregen.queue.length) {
      const [cx, cz] = pregen.queue[0];
      if (!isLoaded(d, cx, cz)) { if (system.currentTick - pregen.since > 20 * 30) { pregen.queue.shift(); continue; } return null; }   // vision: thirty seconds for a tile's chunks to load, then on
      if (levelOf(d, cx, cz) >= LEVEL.life) { pregen.queue.shift(); continue; }
      pregen.queue.shift(); pregen.laid++; return { cx, cz, level: LEVEL.life, why: "pregen" };
    }
    try { d.runCommand("tickingarea remove wwpregen"); } catch {}
    pregen.i++; pregen.stage = "go"; world.setDynamicProperty("waterworld:pregen", pregen.i);
    if (pregen.i % 64 === 0) { const done2 = pregen.i / total, s = (Date.now() - pregen.started) / 1000; console.warn(`[Waterworld] pregen: tile ${pregen.i} of ${total} (${(done2 * 100).toFixed(1)}%), ${pregen.laid} chunks laid this run`); }   // vision: a word every sixty-four tiles
  }
}

// ---- the climate's colours: a fog for the sea's climate and the land's (the dimension itself has one biome)
const fogNow = new Map();
const landClass = (b) => (/desert|savanna|badlands|beach/.test(b) ? "dry" : /snow|ice|frozen/.test(b) ? "cold" : /jungle|mangrove|swamp/.test(b) ? "wet" : "temperate");
const seaClass = (T) => (T < -4 ? "frozen_ocean" : T < 8 ? "cold_ocean" : T < 18 ? "ocean" : T < 24 ? "lukewarm_ocean" : "warm_ocean");   // world/biomes.js SEA_BIOMES's own lines
function fogs() {
  if (!ready) return;
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== DIM) { if (fogNow.has(p.id)) { try { p.runCommand("fog @s remove waterworld"); } catch {} fogNow.delete(p.id); } continue; }
    const cl = climateAtBlock(p.location.x, p.location.z), id = `waterworld:${seaClass(cl.T)}_${landClass(cl.biome?.id ?? "")}`;
    if (fogNow.get(p.id) === id) continue;
    try { if (fogNow.has(p.id)) p.runCommand("fog @s remove waterworld"); p.runCommand(`fog @s push ${id} waterworld`); fogNow.set(p.id, id); } catch {}
  }
}

// ---- the clock and the faith, on the action bar
function hud() {
  if (!ready) return;
  const t = world.getAbsoluteTime(), w = when(t);
  const toRite = RUNGS.year - w.dayOfYear;
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== DIM) continue;
    const lat = latOf(p.location.z), hemi = lat >= 0 ? "N" : "S";
    const rite = w.dayOfYear === 0 ? "§6the Great Rite at the Sea Rite Temple" : w.dayOfYear === RUNGS.year / 2 ? "§9the Turning" : `§7${toRite} days to the Great Rite`;
    try { p.onScreenDisplay.setActionBar(`§fYear ${w.year + 1}, ${w.season}, day ${w.dayOfYear + 1} · ${w.part} · ${Math.abs(lat).toFixed(1)}°${hemi} · ${rite}`); } catch {}
  }
}

// ---- the folk: a word when you talk to them (their people, their rite, what they wear)
const PEOPLE = { norse: "Norse", european: "Northern European", birchbark: "bark-canoe", pacific: "Pacific", indian_ocean: "Indian Ocean", east_asian: "East Asian", japanese: "Japanese", dugout: "great-dugout", shallow: "shallow-water", arctic: "Arctic", therans: "Theran" };
try {
  world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
    const e = ev.target; if (e?.typeId !== FOLK) return;
    const k = e.getDynamicProperty("waterworld:folk"), f = typeof k === "number" ? RESIDENTS[k] : null; if (!f) return;
    if (f[4] < 0) { ev.player.sendMessage(`§b${e.nameTag}§r: The sea is sacred. A thirteenth of every catch to the wardens, and no fishing a stock below its line.`); return; }
    const t = CULTURES[f[4]], w = WAYS[t];
    const inThera = !!theraUV(Math.floor(e.location.x), Math.floor(e.location.z));
    ev.player.sendMessage(`§e${e.nameTag}§r, ${PEOPLE[t] ?? t}${inThera ? " of Thera" : ""}: ${w ? `We keep ${w.rite}: ${w.offering}.` : FAITH.tenets[2]} §7(${DRESS[t] ?? ""})`);
  });
} catch (err) { console.warn(`[Waterworld] no interact event: ${err}`); }

// ---- the soak: the server tours its own sites (a ticking area holds each one loaded), lays them, checks them,
// and writes a probe for each: no player needed. /scriptevent waterworld:soak (or: ww soak)
let soak = null;
function soakStep() {
  if (!soak || !ready) return;
  const d = dim(); if (!d) return;
  const [name, x, z] = soak.sites[soak.i] ?? [];
  if (!name) { probe("soak-done", { sites: soak.sites.length, ms: Date.now() - soak.started, summary: soak.summary }); console.warn(`[Waterworld] soak done: ${soak.sites.length} sites in ${Math.round((Date.now() - soak.started) / 1000)} s; ${soak.summary.holes} ground holes, ${soak.summary.dark} folk in the dark, ${soak.summary.lost} folk missing`); soak = null; return; }
  const cx = Math.floor(x / C), cz = Math.floor(z / C);
  if (soak.stage === "go") {
    try { d.runCommand("tickingarea remove wwsoak"); } catch {}
    try { d.runCommand(`tickingarea add circle ${Math.floor(x)} 64 ${Math.floor(z)} 2 wwsoak`); } catch (e) { console.warn(`[Waterworld] soak: no ticking area (${e})`); }
    soak.at = { x, y: 64, z }; soak.stage = "lay"; soak.since = system.currentTick; return;
  }
  if (soak.stage === "lay") {
    let all = true; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!done.has(`${cx + a},${cz + b}`)) all = false;
    if (all || system.currentTick - soak.since > 20 * 90) { soak.stage = "settle"; soak.since = system.currentTick; }   // vision: ninety seconds a site at most
    return;
  }
  if (soak.stage === "settle" && system.currentTick - soak.since > 20 * 8) {   // vision: eight seconds for the folk to stand and the light to spread
    const r = siteProbe(d, name, cx, cz);
    soak.summary.holes += r.ground.holes; soak.summary.dark += r.light.filter(([, bl]) => bl >= 0 && bl < 8).length; soak.summary.lost += Math.max(0, r.folk.expected - r.folk.found);
    try { d.runCommand("tickingarea remove wwsoak"); } catch {}
    soak.i++; soak.stage = "go"; soak.at = null;
  }
}
try {
  world.afterEvents.entitySpawn.subscribe((ev) => {   // a monster where folk live is the light law failing
    const e = ev.entity; if (!e || e.dimension.id !== DIM) return;
    let fam = []; try { fam = e.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? []; } catch {}
    if (!fam.includes("monster")) return;
    const key = `${Math.floor(e.location.x / C)},${Math.floor(e.location.z / C)}`;
    if (BY_CHUNK[key]) probe("monster", { id: e.typeId, x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z), light: (() => { try { return e.dimension.getLightLevel(e.location); } catch { return -1; } })() });
  });
} catch (err) { console.warn(`[Waterworld] no spawn event: ${err}`); }

// ---- commands
const FIB_MAX_RING = 21;   // vision: the widest surface ring a server is asked for
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "waterworld:pregen") {
    const a = (ev.message ?? "").trim(), total = Math.min(tourLength(CW, CH), PREGEN_TILES), say = (m) => { console.warn(`[Waterworld] ${m}`); ev.sourceEntity?.sendMessage?.(`[Waterworld] ${m}`); };
    if (a === "off") { pregen.on = false; say("pregen off"); }
    else if (a === "sea on" || a === "sea off") { pregen.sea = a === "sea on"; say(`pregen ${pregen.sea ? "lays the open sea too" : "leaves the open sea for players"}`); }
    else if (a === "on") { pregen.on = true; say("pregen on"); }
    else if (a === "reset") { pregen.i = 0; pregen.stage = "go"; world.setDynamicProperty("waterworld:pregen", 0); say("pregen from the start (laid chunks are kept)"); }
    else { const rate = stats.by.pregen ? stats.ms / stats.n : 0; say(`pregen ${pregen.on ? "on" : "off"}: tile ${pregen.i} of ${total} (${((pregen.i / total) * 100).toFixed(1)}%), ${pregen.laid} chunks this run; ${Math.round(rate)} ms a chunk; tps ${tps.toFixed(1)}`); }
    return;
  }
  if (ev.id === "waterworld:version") { console.warn(`[Waterworld] Scripts ${VERSION} loaded; world ${ready ? "loaded" : "loading"}; ${stats.n} chunks laid, ${stats.n ? Math.round(stats.ms / stats.n) : 0} ms each, ${stats.fail} retries`); ev.sourceEntity?.sendMessage?.(`[Waterworld] Scripts ${VERSION}`); return; }
  if (ev.id === "waterworld:fly") {   // the flight test: speed (blocks a second), seconds, heading (degrees from east, toward south)
    if (!ready) { console.warn("[Waterworld] fly: the world is still loading"); return; }
    const [v0, t0, h0] = (ev.message ?? "").trim().split(/\s+/).map(Number), speed = v0 > 0 ? v0 : 10.89, secs = t0 > 0 ? t0 : 90, hd = ((h0 || 0) * Math.PI) / 180;   // given: creative flight, 10.89 blocks a second; vision: ninety seconds
    const from = ev.sourceEntity?.location ?? PLACES.spawn;
    flight = { x0: from.x, z0: from.z, vx: Math.cos(hd) * speed, vz: Math.sin(hd) * speed, speed, secs, t0: system.currentTick, laid0: stats.n, sum: { n: 0, holes: 0, front: 0, worst: 0 }, area: null };
    console.warn(`[Waterworld] fly: ${speed} b/s for ${secs} s from ${Math.floor(from.x)}, ${Math.floor(from.z)}`); probe("fly-start", { speed, secs, x: from.x, z: from.z, heading: h0 || 0 }); return;
  }
  if (ev.id === "waterworld:soak") { if (!ready) { console.warn("[Waterworld] soak: the world is still loading"); return; } const n = Math.floor(+((ev.message ?? "").trim()) || 0); const sites = soakSites(); soak = { sites: n ? sites.slice(0, n) : sites, i: 0, stage: "go", started: Date.now(), summary: { holes: 0, dark: 0, lost: 0 } }; console.warn(`[Waterworld] soak: ${soak.sites.length} sites`); probe("soak-start", { sites: soak.sites.map((q) => q[0]) }); return; }
  const p = ev.sourceEntity; if (!p || p.typeId !== "minecraft:player") return;
  const args = (ev.message ?? "").trim().split(/\s+/).filter(Boolean);
  if (!ready) { p.sendMessage("[Waterworld] still loading the world, a moment."); return; }
  if (ev.id === "waterworld:go") {
    p.setDynamicProperty("waterworld:left", undefined);
    if (args.length >= 2 && !isNaN(+args[0]) && !isNaN(+args[1])) { const x = Math.floor(+args[0]), z = Math.floor(+args[1]); bring(p, { x: x + 0.5, y: SEA + Math.max(0, Math.round(heightAt(x, z).h)) + 1, z: z + 0.5 }, `[Waterworld] to ${x}, ${z}`); return; }
    const at = PLACES[args[0] ?? "spawn"]; if (!at) { p.sendMessage(`[Waterworld] places: ${Object.keys(PLACES).join(", ")}, or <x> <z>`); return; }
    bring(p, at, `[Waterworld] to ${args[0] ?? "spawn"}`);
  } else if (ev.id === "waterworld:where") {
    const x = Math.floor(p.location.x), z = Math.floor(p.location.z), cl = climateAtBlock(x, z), g = heightAt(x, z), uv = theraUV(x, z);
    p.sendMessage(`[Waterworld] ${x}, ${z}: ${Math.abs(latOf(z)).toFixed(2)}°${latOf(z) >= 0 ? "N" : "S"} ${Math.abs(lonOf(x)).toFixed(2)}°${lonOf(x) >= 0 ? "E" : "W"}; ${cl.biome?.id}, ${cl.T.toFixed(1)} °C, wet ${cl.M.toFixed(2)}, the ${cl.belt}; ground ${g.h.toFixed(1)} over the sea${uv ? `; Thera: ${KINDS[g.kind] || "the natural island"}` : ""}. Laid: ${stats.n} chunks, ${stats.n ? Math.round(stats.ms / stats.n) : 0} ms each${stats.fail ? `, ${stats.fail} tries again` : ""}.`);
  } else if (ev.id === "waterworld:radius") {
    const r = Math.max(RINGS.deep, Math.min(FIB_MAX_RING, Math.floor(+args[0] || RINGS.surface))); RINGS.surface = r; p.sendMessage(`[Waterworld] the surface ring: ${r} chunks round each player (deep ${RINGS.deep}, folk ${RINGS.folk})`);
  } else if (ev.id === "waterworld:struct") {   // the drawing's trick, tried: a baked building placed whole, against the same laid block by block
    const d = dim(), n = Math.max(0, Math.min(PROTOS.length - 1, Math.floor(+args[0] || 0))), P = PROTOS[n], at = { x: Math.floor(p.location.x) + 4, y: Math.floor(p.location.y), z: Math.floor(p.location.z) + 4 };
    let ms1 = -1, ms2 = -1, err = "";
    try { const t0 = Date.now(); world.structureManager.place(`ww:p${n}`, d, { x: at.x, y: at.y, z: at.z }); ms1 = Date.now() - t0; } catch (e) { err = String(e); }
    try { const t0 = Date.now(), ox = at.x + (P.b[1] - P.b[0]) + 6; for (let i = 0, F = flatOf(P); i < F.length; i += 4) { const e = STRUCT_PALETTE[F[i + 3]]; d.setBlockPermutation({ x: ox + F[i] - (P.o?.[0] ?? P.b[0]), y: at.y + F[i + 1] - (P.o?.[1] ?? P.b[2]), z: at.z + F[i + 2] - (P.o?.[2] ?? P.b[4]) }, perm(e[0], e[1])); } ms2 = Date.now() - t0; } catch (e) { err += ` ${e}`; }
    const msg = `[Waterworld] ${P.name}: ${flatOf(P).length / 4} blocks; whole as a structure ${ms1} ms, block by block ${ms2} ms${err ? `; ${err}` : ""}`; p.sendMessage(msg); console.warn(msg); probe("struct", { n, name: P.name, blocks: P.flat.length / 4, structure: ms1, blocks_ms: ms2, err });
  } else if (ev.id === "waterworld:relay") {
    const d = dim(), cx = Math.floor(p.location.x / C), cz = Math.floor(p.location.z / C);
    try { d.setBlockType({ x: cx * C, y: -64, z: cz * C }, "minecraft:bedrock"); } catch {}
    try { for (const e of d.getEntities({ type: FOLK, location: { x: cx * C, y: -64, z: cz * C }, volume: { x: C, y: 384, z: C } })) e.remove(); } catch {}   // its folk go too: the laying brings them back
    done.delete(`${cx},${cz}`); p.sendMessage(`[Waterworld] laying ${cx}, ${cz} again`);
  } else if (ev.id === "waterworld:leave") {
    p.setDynamicProperty("waterworld:left", true); holding.delete(p.id);
    try { const o = world.getDimension("overworld"); p.teleport({ x: 0, y: 100, z: 0 }, { dimension: o }); p.addEffect("slow_falling", 400); } catch {}
  }
});

// ---- start
system.run(() => {
  system.runJob(loadWorld());
  // the tempo (tempo.js's TEMPO on core/tempo.js's bar and phase plan); the layer fills every tick's slack
  duty("layer", wake);
  duty("hold", hold);
  duty("hud", hud);
  duty("soak", soakStep);
  duty("fogs", fogs);
  duty("folk", folkRing);
  duty("watch", watch);
  duty("seasons", seasons);
  duty("park", park);
  duty("courses", courses);   // the sailing courses' marks   // the Horaia's crown turned with the year
  duty("tps", () => { tpsTick(); if (++tpsN % FIB_TPS === 0) { const d = dim(); if (d) tpsProbe(d, tempoReport()); } });   // a probe every eighth reading (40 s)
  startTempo(system);
  system.runTimeout(() => { try { pregen.i = +(world.getDynamicProperty("waterworld:pregen") ?? 0) || 0; } catch {} }, 20);
  system.runTimeout(() => { if (!dim()) console.warn("[Waterworld] the dimension isn't registered: turn on the Beta APIs experiment for this world"); }, 40);
});
