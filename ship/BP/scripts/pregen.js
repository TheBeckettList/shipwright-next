// Pre-generation: the server lays the sea world ahead of time, so nobody waits on the math.
//
// The world is fixed by its seed (every block is a pure function of it), so there's nothing to
// guess: the server can lay the whole stretch players will sail before they get there, save it
// with the world, and from then on the game only loads chunks from disk. That's what lets the
// haze open right out to the view distance.
//
// What it lays, in order: the tile where newcomers arrive, rings of tiles outward from the homeport, then round the
// castaways' raft in the Drowned Reach to REACH_R. A tile is 8 x 8 chunks; a ticking area keeps
// it loaded while it's laid (no player needs to be there), then it moves on. Progress is saved
// after every tile, so a restart carries on where it stopped.
//
//   /scriptevent shipwright:pregen status            how far it's got
//   /scriptevent shipwright:pregen start [port] [reach]   (re)start, with radii in blocks
//   /scriptevent shipwright:pregen stop              pause (start carries on)
// It starts by itself on a new world.
import { world, system } from "@minecraft/server";
import { SEA_DIM } from "./dims.js";
import { worldSeed, layChunk, isLaid, seaWorldOn } from "./seaworld.js";
import { homeportIfReady } from "./world/homeport.js";
import { raftSpot } from "./world/reach.js";
import { warnOnce, tell } from "./warn.js";

const KEY = "shipwright:pregen";
const AREA = "sw_pregen";
const CHUNK = 16;                       // given: a chunk
export const PREGEN = Object.freeze({
  tile: 8,                              // given: 8 x 8 chunks, inside a ticking area's 100-chunk limit
  port: 1536,                           // vision: how far round the homeport the world is laid ahead (blocks)
  reach: 768,                           // vision: and round the castaways' raft
  wait: 400,                            // vision: ticks to wait for a tile to load before trying it again
});

let job = null;
export const pregenState = () => {
  try { const s = world.getDynamicProperty(KEY); return typeof s === "string" ? JSON.parse(s) : null; } catch { return null; }
};
const save = (s) => { try { world.setDynamicProperty(KEY, JSON.stringify(s)); } catch { /* read-only */ } };

/** The tiles of ring k round a centre tile (k = 0: the centre itself), in order round the ring. */
export function ringTiles(k) {
  if (k === 0) return [[0, 0]];
  const out = [];
  for (let i = -k; i <= k; i++) out.push([i, -k]);
  for (let j = -k + 1; j <= k; j++) out.push([k, j]);
  for (let i = k - 1; i >= -k; i--) out.push([i, k]);
  for (let j = k - 1; j > -k; j--) out.push([-k, j]);
  return out;
}

/** Whether newcomers can arrive: the server isn't laying the world ahead, or it has laid where they arrive. */
export function arrivalReady() {
  const s = pregenState();
  if (!s || s.stopped || s.done) return true;
  const a = s.areas?.find((x) => x.name === "arrival");
  return !a || a.ring >= a.rings;
}

/** How far out from a place the world is already laid for sure (blocks), from the saved progress. */
export function laidAround(x, z) {
  const s = pregenState();
  if (!s?.areas) return 0;
  let best = 0;
  for (const a of s.areas) {
    const done = a.ring * PREGEN.tile * CHUNK - PREGEN.tile * CHUNK / 2;      // rings finished, less half a tile
    const d = Math.hypot(x - a.x, z - a.z);
    if (done > d) best = Math.max(best, done - d);
  }
  return best;
}

function areasFor(seed, portR, reachR) {
  const hp = homeportIfReady(seed), r = raftSpot(seed);
  const span = PREGEN.tile * CHUNK;
  return [
    { name: "arrival", x: hp.spawn.x, z: hp.spawn.z, rings: 1, ring: 0, i: 0 },        // where newcomers stand, first
    { name: "homeport", x: hp.x, z: hp.z, rings: Math.ceil(portR / span), ring: 0, i: 0 },
    { name: "Drowned Reach", x: r.x, z: r.z, rings: Math.ceil(reachR / span), ring: 0, i: 0 },
  ];
}

function* run(seed) {
  const dim = world.getDimension(SEA_DIM);
  let s = pregenState();
  const tiles = PREGEN.tile;
  while (s && !s.stopped) {
    const a = s.areas.find((x) => x.ring < x.rings);
    if (!a) { s.done = true; save(s); console.warn("[Shipwright] Pre-generation finished: the sea world is laid."); break; }
    const ring = ringTiles(a.ring);
    if (a.i >= ring.length) { a.ring++; a.i = 0; save(s); continue; }
    const [ti, tj] = ring[a.i];
    const c0x = Math.floor(a.x / CHUNK) - tiles / 2 + ti * tiles, c0z = Math.floor(a.z / CHUNK) - tiles / 2 + tj * tiles;
    const x0 = c0x * CHUNK, z0 = c0z * CHUNK, x1 = x0 + tiles * CHUNK - 1, z1 = z0 + tiles * CHUNK - 1;
    try { dim.runCommand(`tickingarea add ${x0} 0 ${z0} ${x1} 0 ${z1} ${AREA}`); } catch (err) { warnOnce("pregen-area", `[Shipwright] Pre-generation couldn't hold a tile loaded: ${err}`); }
    const t0 = system.currentTick;
    const loaded = () => { for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) if (!dim.isChunkLoaded({ x: (c0x + i) * CHUNK + 8, y: 64, z: (c0z + j) * CHUNK + 8 })) return false; return true; };   // given: a chunk's middle
    while (!loaded() && system.currentTick - t0 < PREGEN.wait) yield;
    if (loaded()) {
      for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) {
        if (!isLaid(dim, c0x + i, c0z + j)) yield* layChunk(dim, seed, c0x + i, c0z + j);
        yield;
      }
      a.i++;
      s.tiles = (s.tiles ?? 0) + 1;
    } else {
      warnOnce("pregen-wait", "[Shipwright] Pre-generation: a tile didn't load in time; it'll be tried again.");
    }
    try { dim.runCommand(`tickingarea remove ${AREA}`); } catch { /* none */ }
    save(s);
    if (s.tiles % 16 === 0) console.warn(`[Shipwright] Pre-generation: ${status()}`);   // vision: a progress line every sixteen tiles
    s = pregenState();
  }
  job = null;
}

export function status() {
  const s = pregenState();
  if (!s) return "not started.";
  if (s.done) return "finished: the sea world round the homeport and the Reach is laid.";
  const parts = s.areas.map((a) => `${a.name} ${Math.min(a.ring, a.rings) * PREGEN.tile * CHUNK} of ${a.rings * PREGEN.tile * CHUNK} blocks out`);
  return `${s.stopped ? "paused" : "running"}: ${parts.join(", ")} (${s.tiles ?? 0} tiles laid).`;
}

export function startPregen(seed, portR = PREGEN.port, reachR = PREGEN.reach, fresh = false) {
  if (!homeportIfReady(seed)) return false;
  let s = pregenState();
  if (!s || fresh) s = { areas: areasFor(seed, portR, reachR), tiles: 0 };
  s.stopped = false;
  save(s);
  if (!job) job = system.runJob(run(seed));
  return true;
}

export function startPregenWatch() {
  // start by itself once the homeport is known, and carry on after a restart
  const iv = system.runInterval(() => {
    if (!seaWorldOn()) return;
    const seed = worldSeed();
    const s = pregenState();
    if (s?.done || s?.stopped || job) return;
    if (startPregen(seed)) system.clearRun(iv);
  }, 100);   // vision: check every five seconds
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "shipwright:pregen") return;
    const [cmd, a, b] = String(ev.message ?? "").trim().split(/\s+/);
    if (cmd === "stop") { const s = pregenState(); if (s) { s.stopped = true; save(s); } }
    else if (cmd === "start") startPregen(worldSeed(), Number(a) || PREGEN.port, Number(b) || PREGEN.reach, !!a);
    const msg = `[Shipwright] Pre-generation ${status()}`;
    console.warn(msg);
    tell(ev.sourceEntity, `§e${msg}`);
  });
}
