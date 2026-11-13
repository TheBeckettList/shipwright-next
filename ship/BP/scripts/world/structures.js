// Pure. The sea world's great structures: what vanilla's overworld offers, taken to sea.
//
//   fortress   the stronghold. Three on a ring 1,400-2,800 blocks out from the spawn, each a keep on
//              an island (or raised on a seamount) with the End portal room in the rock beneath,
//              a library and a store. Eyes of ender lead to the nearest (seaworld.js).
//   monument   the ocean monument: a stepped prismarine hall on the deep floor, with sea lanterns,
//              sponge rooms and a gold core. Guardians keep it (life.js).
//   gate       the ruined portal: a broken obsidian gate half-sunk on a shoal, crying obsidian and
//              netherrack round it, a chest with flint and steel and gold. Early obsidian, early fire.
//   igloo      on the polar and tundra islands: a snow dome with a bed, a furnace and a table.
//   hut        on the salt marshes and mangrove coasts: a witch's hut on stilts.
//   raft       Boatblock's castaway raft, moored at the Drowned Reach's heart (reach.js).
//
// structuresIn(seed, x0, z0, x1, z1) -> the structures whose footprint could reach a box.
// structureBlocks(seed, s) -> { blocks, containers } in world coordinates.
import { rand, hash } from "./noise.js";
import { columnAt as groundAt } from "./lattice.js";
import { elevation, groupAt, SEA_LEVEL, GROUP_CELL, place } from "./terrain.js";
import { BIOMES } from "./biomes.js";
import { raftSpot } from "./reach.js";

export const FORTRESS_RING = [1400, 2800];
const MONUMENT_CELL = 3200, GATE_CELL = 760, HUT_CELL = 400;

/** Where a new world's spawn island is (the fortress ring is measured from the middle of the world). */
const ORIGIN = { x: 0, z: 0 };

const fortCache = new Map(), cellCache = new Map();
const cellMemo = (fn, tag) => (seed, a, b) => {
  const k = `${tag}|${seed}|${a},${b}`;
  if (cellCache.has(k)) return cellCache.get(k);
  const v = fn(seed, a, b);
  cellCache.set(k, v);
  if (cellCache.size > 8192) cellCache.delete(cellCache.keys().next().value);
  return v;
};
/** The three fortresses: on the ring, a third of the way round from each other, on the island nearest each. */
export function fortresses(seed) {
  if (!fortCache.has(seed)) fortCache.set(seed, makeFortresses(seed));
  return fortCache.get(seed);
}
function makeFortresses(seed) {
  const out = [];
  const a0 = rand(seed, 401) * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i * Math.PI * 2) / 3;
    const d = FORTRESS_RING[0] + rand(seed, 402, i) * (FORTRESS_RING[1] - FORTRESS_RING[0]);
    const want = { x: ORIGIN.x + Math.cos(a) * d, z: ORIGIN.z + Math.sin(a) * d };
    // the nearest island group's heart, if one is close; else the spot itself (raised on a seamount)
    let best = null, bd = 700;
    const gx = Math.floor(want.x / GROUP_CELL), gz = Math.floor(want.z / GROUP_CELL);
    for (let i2 = -1; i2 <= 1; i2++) for (let j = -1; j <= 1; j++) {
      const g = groupAt(seed, gx + i2, gz + j);
      if (!g || g.special) continue;
      const dd = Math.hypot(g.x - want.x, g.z - want.z);
      if (dd < bd) { bd = dd; best = g; }
    }
    let x = Math.round(best?.x ?? want.x), z = Math.round(best?.z ?? want.z);
    // walk to the highest ground near the heart
    let top = groundAt(seed, x, z).top;
    for (let k = 0; k < 24; k++) {
      const tx = x + ((hash(seed, 403, i, k) % 41) - 20), tz = z + ((hash(seed, 404, i, k) % 41) - 20);
      const t = groundAt(seed, tx, tz).top;
      if (t > top) { top = t; x = tx; z = tz; }
    }
    out.push({ id: `fortress${i}`, kind: "fortress", x, z, top: Math.max(top, SEA_LEVEL + 3), raised: top <= SEA_LEVEL + 2, R: 14 });
  }
  return out;
}

export function monumentAt(seed, mx, mz) {
  if (rand(mx, mz, seed, 411) > 0.42) return null;
  const x = Math.round((mx + 0.3 + 0.4 * rand(mx, mz, seed, 412)) * MONUMENT_CELL), z = Math.round((mz + 0.3 + 0.4 * rand(mx, mz, seed, 413)) * MONUMENT_CELL);
  if (Math.hypot(x, z) < 1000) return null;
  const e = groundAt(seed, x, z);
  if (e.land || e.depth < 22) return null;
  return { id: `monument${mx},${mz}`, kind: "monument", x, z, floor: e.top, R: 16 };
}

export function gateAt(seed, gx, gz) {
  if (rand(gx, gz, seed, 421) > 0.55) return null;
  // the first shoal or low shore found in the cell (a few looks)
  for (let k = 0; k < 10; k++) {
    const x = Math.round((gx + 0.1 + 0.8 * rand(gx, gz, k, seed, 422)) * GATE_CELL), z = Math.round((gz + 0.1 + 0.8 * rand(gx, gz, k, seed, 423)) * GATE_CELL);
    const e = groundAt(seed, x, z);
    if (e.land ? e.top > SEA_LEVEL + 3 : e.depth > 6) continue;          // on a shoal or a low shore
    return { id: `gate${gx},${gz}`, kind: "gate", x, z, floor: e.top, R: 5, heading: hash(gx, gz, seed, 424) % 2 };
  }
  return null;
}

export function hutAt(seed, hx, hz) {
  if (rand(hx, hz, seed, 431) > 0.25) return null;
  const x = Math.round((hx + 0.25 + 0.5 * rand(hx, hz, seed, 432)) * HUT_CELL), z = Math.round((hz + 0.25 + 0.5 * rand(hx, hz, seed, 433)) * HUT_CELL);
  const e = groundAt(seed, x, z);
  if (!e.land) return null;
  const b = e.biome;
  if (b === "tundra" || b === "ice_sheet" || b === "snowy_taiga") return { id: `igloo${hx},${hz}`, kind: "igloo", x, z, floor: e.top, R: 4 };
  if ((b === "salt_marsh" || b === "mangrove") && e.top <= SEA_LEVEL + 2) return { id: `hut${hx},${hz}`, kind: "hut", x, z, floor: e.top, R: 4 };
  return null;
}

const monumentMemo = cellMemo((s, a, b) => monumentAt(s, a, b), "m"), gateMemo = cellMemo((s, a, b) => gateAt(s, a, b), "g"), hutMemo = cellMemo((s, a, b) => hutAt(s, a, b), "h");
/** Only the monuments in a box (what keeps their guardians): one memoized cell look-up, nothing else. */
export function monumentsIn(seed, x0, z0, x1, z1) {
  const out = [];
  for (let a = Math.floor(x0 / MONUMENT_CELL); a <= Math.floor(x1 / MONUMENT_CELL); a++)
    for (let b = Math.floor(z0 / MONUMENT_CELL); b <= Math.floor(z1 / MONUMENT_CELL); b++) {
      const s = monumentMemo(seed, a, b);
      if (s && s.x >= x0 - s.R && s.x <= x1 + s.R && s.z >= z0 - s.R && s.z <= z1 + s.R) out.push(s);
    }
  return out;
}
export function structuresIn(seed, x0, z0, x1, z1, margin = 24) {
  const out = [];
  const hit = (s) => s && s.x + s.R + margin >= x0 && s.x - s.R - margin <= x1 && s.z + s.R + margin >= z0 && s.z - s.R - margin <= z1;
  for (const f of fortresses(seed)) if (hit(f)) out.push(f);
  const rs = raftSpot(seed), raft = { id: "raft", kind: "raft", x: rs.x, z: rs.z, R: 2 };
  if (hit(raft)) out.push(raft);
  for (const [cell, fn] of [[MONUMENT_CELL, monumentMemo], [GATE_CELL, gateMemo], [HUT_CELL, hutMemo]])
    for (let a = Math.floor((x0 - 40) / cell); a <= Math.floor((x1 + 40) / cell); a++)
      for (let b = Math.floor((z0 - 40) / cell); b <= Math.floor((z1 + 40) / cell); b++) {
        const s = fn(seed, a, b);
        if (hit(s)) out.push(s);
      }
  return out;
}

// ---------------------------------------------------------------- building them

function canvas() {
  const m = new Map();
  return {
    put(x, y, z, id, states = {}) { m.set(`${x},${y},${z}`, { x, y, z, id, states }); },
    list() { return [...m.values()]; },
  };
}

const BRICKS = ["minecraft:stone_bricks", "minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks"];

function* fortress(seed, s) {
  const c = canvas(), containers = [];
  const { x, z } = s;
  const g = s.top;                                   // the keep's floor
  const brick = (a, y, b) => BRICKS[hash(a, y, b, seed, 441) % 3];
  // a seamount fortress stands on a stone mound out of the water
  if (s.raised) for (let a = -7; a <= 7; a++) {
    yield;
    for (let b = -7; b <= 7; b++) {
      if (Math.hypot(a, b) > 7.5) continue;
      const t = groundAt(seed, x + a, z + b).top;
      for (let y = t + 1; y <= g; y++) c.put(x + a, y, z + b, "minecraft:stone");
    }
  }
  yield;
  // the keep: 9 x 9, three storeys of wall, a parapet
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
    c.put(x + a, g, z + b, brick(a, g, b));
    const edge = Math.abs(a) === 4 || Math.abs(b) === 4;
    for (let y = g + 1; y <= g + 9; y++) {
      if (edge) {
        const door = b === -4 && a === 0 && y <= g + 2;
        const window = (y === g + 3 || y === g + 6) && (a === 0 || b === 0) && !(b === -4 && a === 0);
        c.put(x + a, y, z + b, door ? "minecraft:air" : window ? "minecraft:iron_bars" : brick(a, y, b));
      } else c.put(x + a, y, z + b, y === g + 4 || y === g + 7 ? brick(a, y, b) : "minecraft:air");
    }
    if (edge && (a + b) % 2 === 0) c.put(x + a, g + 10, z + b, brick(a, g + 10, b));
  }
  yield;
  // the shaft down: a ladder against the wall from the keep's floor to the portal room
  const room = g - 12;
  for (let y = room + 1; y <= g + 7; y++) {
    if (y < g) { for (let a = -1; a <= 1; a++) for (let b = 1; b <= 3; b++) c.put(x + a, y, z + b, a === 0 && b === 2 ? "minecraft:air" : "minecraft:stone_bricks"); }
    c.put(x, y, z + 2, "minecraft:ladder", { facing_direction: 2 });
    c.put(x, y, z + 3, "minecraft:stone_bricks");
    if (y === g + 4 || y === g + 7) { for (const [a, b] of [[0, 2], [0, 1]]) c.put(x + a, y, z + b, a === 0 && b === 2 ? "minecraft:ladder" : "minecraft:air", a === 0 && b === 2 ? { facing_direction: 2 } : {}); }
  }
  c.put(x, g, z + 2, "minecraft:ladder", { facing_direction: 2 });
  // the portal room: 13 x 11, the frame ring in the middle, lit
  for (let a = -6; a <= 6; a++) {
    yield;
    for (let b = -5; b <= 7; b++) for (let y = room; y <= room + 5; y++) {
      const edge = Math.abs(a) === 6 || b === -5 || b === 7 || y === room || y === room + 5;
      if (a === 0 && b >= 1 && b <= 3 && y > room) continue;              // the shaft comes down here
      c.put(x + a, y, z + b, edge ? brick(a, y, b) : "minecraft:air");
    }
  }
  const fy = room + 1;
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const ring = (Math.abs(a) === 2) !== (Math.abs(b) === 2);
    if (!ring) continue;
    const dir = b === -2 ? "south" : b === 2 ? "north" : a === -2 ? "east" : "west";
    c.put(x + a, fy, z + b - 1, "minecraft:end_portal_frame", { "minecraft:cardinal_direction": dir, end_portal_eye_bit: rand(a, b, seed, 442, s.x) < 0.1 });
  }
  for (const [a, b] of [[-5, -4], [5, -4], [-5, 6], [5, 6]]) c.put(x + a, fy, z + b, "minecraft:lantern", { hanging: false });
  // the library and the store, in the keep's upper floor
  for (let a = -3; a <= 3; a++) c.put(x + a, g + 5, z - 3, "minecraft:bookshelf");
  c.put(x + 3, g + 5, z + 3, "minecraft:chest", { "minecraft:cardinal_direction": "west" });
  containers.push({ x: x + 3, y: g + 5, z: z + 3, loot: [{ item: "minecraft:book", count: 3 + (hash(seed, 443) % 4) }, { item: "minecraft:paper", count: 6 }, { item: "minecraft:compass", count: 1 }, { item: "minecraft:ender_pearl", count: 1 + (hash(seed, 444) % 2) }], chart: false });
  c.put(x - 3, g + 1, z + 3, "minecraft:chest", { "minecraft:cardinal_direction": "east" });
  containers.push({ x: x - 3, y: g + 1, z: z + 3, loot: [{ item: "minecraft:iron_ingot", count: 4 + (hash(seed, 445) % 6) }, { item: "minecraft:bread", count: 3 }, { item: "minecraft:iron_pickaxe", count: 1 }, { item: "minecraft:redstone", count: 6 }], chart: false });
  c.put(x - 3, g + 1, z - 3, "minecraft:lantern", { hanging: false });
  c.put(x + 3, g + 1, z - 3, "minecraft:crafting_table");
  return { blocks: c.list(), containers };
}

function* monument(seed, s) {
  const c = canvas(), containers = [];
  const { x, z } = s, f = s.floor + 1;
  const top = Math.min(SEA_LEVEL - 3, f + 12);
  for (let a = -14; a <= 14; a++) for (let b = -14; b <= 14; b++) {
    if (b === -14) yield;
    const r = Math.max(Math.abs(a), Math.abs(b));
    const h = Math.min(top - f, Math.floor((14 - r) * 0.9) + 3);          // stepped flanks
    for (let k = 0; k <= h; k++) {
      const y = f + k;
      const shell = r >= 12 || k === h || k === 0;
      const id = shell ? (k === h && (a + b) % 5 === 0 ? "minecraft:sea_lantern" : (r + k) % 4 === 0 ? "minecraft:dark_prismarine" : (r + k) % 3 ? "minecraft:prismarine_bricks" : "minecraft:prismarine") : "minecraft:water";
      if (b === -14 + 0 && Math.abs(a) <= 2 && k >= 1 && k <= 4) { c.put(x + a, y, z + b, "minecraft:water"); continue; }   // the entrance
      if (b < -11 && Math.abs(a) <= 2 && k >= 1 && k <= 4) { c.put(x + a, y, z + b, "minecraft:water"); continue; }
      c.put(x + a, y, z + b, id);
    }
  }
  // the gold core and the sponge rooms
  for (let a = -1; a <= 0; a++) for (let b = -1; b <= 0; b++) for (let k = 2; k <= 3; k++) c.put(x + a, f + k, z + b, "minecraft:gold_block");
  for (const [a, b] of [[-8, 6], [7, 6], [-8, -6]]) for (let k = 2; k <= 3; k++) for (let d = 0; d <= 1; d++) c.put(x + a + d, f + k, z + b, "minecraft:wet_sponge");
  return { blocks: c.list(), containers };
}

function* gate(seed, s) {
  const c = canvas(), containers = [];
  const { x, z } = s, f = s.floor + 1;
  const along = s.heading ? (a) => [a, 0] : (a) => [0, a];
  // a 4-wide, 5-tall frame, broken from the top down (what's left still stands): its sides worn to
  // different heights, the lintel only where both sides still reach it; some of it crying
  const hl = 2 + (hash(seed, s.x, 451) % 3), hr = 2 + (hash(seed, s.z, 451) % 3);
  const ob = (a, k) => { const [dx, dz] = along(a); c.put(x + dx, f + k, z + dz, rand(a, k, seed, s.z, 452) < 0.2 ? "minecraft:crying_obsidian" : "minecraft:obsidian"); };
  for (let a = 0; a <= 3; a++) ob(a, 0);
  for (let k = 1; k <= hl; k++) ob(0, k);
  for (let k = 1; k <= hr; k++) ob(3, k);
  if (hl >= 4 && hr >= 4) for (let a = 0; a <= 3; a++) ob(a, 4);
  for (let i = 0; i < 9; i++) {
    const dx = (hash(seed, s.x, 453, i) % 7) - 3, dz = (hash(seed, s.z, 454, i) % 7) - 3;
    c.put(x + dx, s.floor, z + dz, i % 3 === 0 ? "minecraft:magma" : "minecraft:netherrack");
  }
  const [cx, cz] = along(-2);
  for (let y = s.floor - 3; y < f; y++) c.put(x + cx, y, z + cz, "minecraft:netherrack");   // its own footing (the ground can dip under it)
  c.put(x + cx, f, z + cz, "minecraft:chest", { "minecraft:cardinal_direction": "north" });
  containers.push({ x: x + cx, y: f, z: z + cz, loot: [{ item: "minecraft:obsidian", count: 2 + (hash(seed, s.x, 455) % 4) }, { item: "minecraft:flint_and_steel", count: 1 }, { item: "minecraft:gold_nugget", count: 6 + (hash(seed, s.z, 456) % 12) }, { item: "minecraft:golden_sword", count: hash(seed, s.x, 457) % 2 }].filter((l) => l.count > 0), chart: false });
  return { blocks: c.list(), containers };
}

function* igloo(seed, s) {
  const c = canvas(), containers = [];
  const { x, z } = s, f = s.floor + 1;
  // a packed-snow footing, so the floor is level even where the ground falls away
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (Math.hypot(a, b) <= 3.6) for (let y = f - 3; y < f; y++) c.put(x + a, y, z + b, "minecraft:snow");
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let k = 0; k <= 3; k++) {
    const d = Math.hypot(a, b, k * 1.2);
    if (d > 3.6) continue;
    c.put(x + a, f + k, z + b, d > 2.6 ? "minecraft:snow" : "minecraft:air");
  }
  c.put(x, f, z - 3, "minecraft:air"); c.put(x, f + 1, z - 3, "minecraft:air");
  c.put(x - 1, f, z + 1, "minecraft:bed", { direction: 0, head_piece_bit: false });
  c.put(x - 1, f, z + 2, "minecraft:bed", { direction: 0, head_piece_bit: true });
  c.put(x + 1, f, z + 2, "minecraft:furnace", { "minecraft:cardinal_direction": "north" });
  c.put(x + 2, f, z, "minecraft:crafting_table");
  c.put(x + 1, f, z - 1, "minecraft:white_carpet");
  c.put(x + 2, f, z + 1, "minecraft:chest", { "minecraft:cardinal_direction": "west" });
  containers.push({ x: x + 2, y: f, z: z + 1, loot: [{ item: "minecraft:coal", count: 4 }, { item: "minecraft:cod", count: 3 }, { item: "minecraft:golden_apple", count: hash(seed, s.x, 461) % 2 }].filter((l) => l.count > 0), chart: false });
  return { blocks: c.list(), containers };
}

function* hut(seed, s) {
  const c = canvas(), containers = [];
  const { x, z } = s, f = s.floor + 3;
  for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let y = s.floor + 1; y < f; y++) c.put(x + a, y, z + b, "minecraft:spruce_log", { pillar_axis: "y" });
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    c.put(x + a, f, z + b, "minecraft:spruce_planks");
    const edge = Math.abs(a) === 2 || Math.abs(b) === 2;
    for (let k = 1; k <= 2; k++) c.put(x + a, f + k, z + b, edge ? (a === 0 && b === -2 && k <= 2 ? "minecraft:air" : (k === 2 && a === 0) ? "minecraft:air" : "minecraft:spruce_planks") : "minecraft:air");
    c.put(x + a, f + 3, z + b, "minecraft:oak_planks");
  }
  c.put(x + 1, f + 1, z + 1, "minecraft:cauldron", { cauldron_liquid: "water", fill_level: 0 });
  c.put(x - 1, f + 1, z + 1, "minecraft:crafting_table");
  c.put(x + 1, f + 1, z - 1, "minecraft:flower_pot", { update_bit: false });
  for (let y = s.floor + 1; y < f; y++) { c.put(x, y, z - 2, "minecraft:spruce_log", { pillar_axis: "y" }); c.put(x, y, z - 3, "minecraft:ladder", { facing_direction: 2 }); }
  c.put(x, f, z - 3, "minecraft:spruce_planks");
  return { blocks: c.list(), containers };
}

/** The castaway raft: three by three planks on the water, nothing else. The sea gives the rest. */
function* raft(seed, s) {
  const c = canvas();
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) c.put(s.x + a, SEA_LEVEL, s.z + b, "minecraft:oak_planks");
  return { blocks: c.list(), containers: [] };
}

/** A structure's blocks, built in steps (a generator: the big ones are thousands of blocks). */
export function structureSteps(seed, s) {
  return { fortress, monument, gate, igloo, hut, raft }[s.kind](seed, s);
}
export function structureBlocks(seed, s) {
  const g = structureSteps(seed, s);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
