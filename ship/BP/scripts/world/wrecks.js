// Pure. Building the sea's sites as blocks: a wreck of a real Shipwright ship (her lines, her
// tradition's wood, lying on the bottom with a list, sometimes broken in two, her mast down beside
// her, her cargo in the hold), a sunken harbour (a quay of the confederation's stone, its pier
// pilings, the stump of its light), and flotsam (a raft of planks and a crate adrift).
//
// siteBlocks(site, climate) -> { blocks: [{x, y, z, id, states}], containers: [{x, y, z, loot}] }
// Working harbour things only: no shrines, carvings or crests (the docks' rule holds under water).
import { rand, hash } from "./noise.js";
import { PLANS } from "../config/plans.js";
import { SEA_LEVEL } from "./terrain.js";
import { THERAN_CARGO } from "../config/theran.js";

/** A Theran ship, after the ships of Akrotiri's Flotilla fresco: long, slender, one square sail, oars. */
export const THERAN_SHIP = Object.freeze({ id: "theran", lengthRange: [18, 24], typicalLB: 6, keelWood: "spruce", rigFamily: "square", fullness: 0.35 });   // vision: her lines

const WOOD = { spruce: "spruce", oak: "oak", birch: "birch", jungle: "jungle", acacia: "acacia", bamboo: "bamboo", cherry: "cherry", dark_oak: "dark_oak", mangrove: "mangrove" };
function woodOf(plan) {
  const w = WOOD[plan.keelWood];
  if (!w) return { planks: "minecraft:spruce_planks", log: "minecraft:bone_block", strip: "minecraft:bone_block", slab: "minecraft:spruce_slab", fence: "minecraft:spruce_fence", hide: "minecraft:brown_wool" };
  if (w === "bamboo") return { planks: "minecraft:bamboo_planks", log: "minecraft:bamboo_block", strip: "minecraft:stripped_bamboo_block", slab: "minecraft:bamboo_slab", fence: "minecraft:bamboo_fence" };
  return { planks: `minecraft:${w}_planks`, log: `minecraft:${w}_log`, strip: `minecraft:stripped_${w}_log`, slab: `minecraft:${w}_slab`, fence: `minecraft:${w}_fence` };
}

/** Each tradition's harbour stone (its quays, its light), and what its holds carried. */
export const PEOPLES_STONE = {
  european: ["minecraft:stone_bricks", "minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks"],
  norse: ["minecraft:cobblestone", "minecraft:mossy_cobblestone", "minecraft:cobblestone"],
  birchbark: ["minecraft:cobblestone", "minecraft:mossy_cobblestone", "minecraft:stone"],
  pacific: ["minecraft:tuff", "minecraft:cobblestone", "minecraft:mossy_cobblestone"],
  indian_ocean: ["minecraft:smooth_sandstone", "minecraft:cut_sandstone", "minecraft:sandstone"],
  east_asian: ["minecraft:brick_block", "minecraft:stone_bricks", "minecraft:brick_block"],
  japanese: ["minecraft:stone", "minecraft:andesite", "minecraft:mossy_cobblestone"],
  dugout: ["minecraft:mud_bricks", "minecraft:packed_mud", "minecraft:mud_bricks"],
  shallow: ["minecraft:mud_bricks", "minecraft:packed_mud", "minecraft:mud_bricks"],
  arctic: ["minecraft:cobblestone", "minecraft:stone", "minecraft:mossy_cobblestone"],
};
export const CARGO = {
  european: [["minecraft:wheat", 4, 12], ["minecraft:white_wool", 2, 6], ["minecraft:iron_ingot", 1, 4]],
  norse: [["minecraft:spruce_log", 4, 10], ["minecraft:iron_nugget", 4, 12], ["minecraft:leather", 2, 5]],
  birchbark: [["minecraft:birch_log", 4, 10], ["minecraft:string", 3, 8], ["minecraft:rabbit_hide", 1, 4]],
  pacific: [["minecraft:bamboo", 6, 16], ["minecraft:cocoa_beans", 2, 6], ["minecraft:cod", 2, 6]],
  indian_ocean: [["minecraft:glass", 2, 6], ["minecraft:orange_dye", 2, 5], ["minecraft:gold_nugget", 3, 9]],
  east_asian: [["minecraft:paper", 4, 10], ["minecraft:bamboo", 4, 12], ["minecraft:clay_ball", 4, 10]],
  japanese: [["minecraft:paper", 3, 8], ["minecraft:cherry_sapling", 1, 3], ["minecraft:iron_nugget", 4, 10]],
  dugout: [["minecraft:cocoa_beans", 3, 8], ["minecraft:dark_oak_log", 3, 8], ["minecraft:leather", 1, 4]],
  shallow: [["minecraft:mangrove_propagule", 1, 4], ["minecraft:clay_ball", 4, 10], ["minecraft:cod", 2, 6]],
  arctic: [["minecraft:bone", 3, 8], ["minecraft:leather", 2, 6], ["minecraft:cod", 3, 8]],
};
const STORES = [["minecraft:dried_kelp", 2, 8], ["minecraft:bread", 1, 4], ["minecraft:lead", 0, 2], ["minecraft:emerald", 0, 3], ["minecraft:arrow", 0, 8]];

function roll(table, seed, k) {
  return table.map(([item, lo, hi], i) => ({ item, count: lo + (hash(seed, k, i) % (hi - lo + 1)) })).filter((x) => x.count > 0);
}

const CORAL = ["minecraft:brain_coral_block", "minecraft:tube_coral_block", "minecraft:fire_coral_block", "minecraft:horn_coral_block", "minecraft:bubble_coral_block"];

/** A wreck. Its lines are her plan's: a typical length for her size, her beam from length over beam. */
export function wreck(site, warm = false) {
  const g = wreckSteps(site, warm);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
/** wreck, in steps (a few frames of her hull a step): a great ship is a thousand blocks. */
export function* wreckSteps(site, warm = false) {
  const plan = site.theran ? THERAN_SHIP : PLANS[site.plan];
  const ms = plan.modelScale ?? 1;
  const L = Math.max(4, Math.round(((plan.lengthRange[0] + plan.lengthRange[1]) / 2)));
  const B = Math.max(2, Math.round(L / plan.typicalLB) + (ms > 1 ? 1 : 0));
  const D = Math.max(1, Math.min(6, Math.round(B * 0.5)));
  const wd = woodOf(plan);
  const s = site.seed;
  const list = new Map();
  const put = (u, w, dy, id, st) => list.set(`${u},${w},${dy}`, { u, w, dy, id, st });
  const heel = (rand(s, 1) < 0.5 ? -1 : 1) * (0.2 + 0.45 * rand(s, 2));          // a list to one side
  const gap = site.broken && L >= 10 ? Math.floor(L * (0.35 + 0.3 * rand(s, 3))) : null;
  const full = Math.max(1.4, 1 / (1 - (plan.fullness ?? 0.5)));                     // fuller hulls carry their beam further
  const halfAt = (u) => (B / 2) * (1 - Math.abs((2 * u) / L - 1) ** full);
  const twin = !!plan.twin;
  const Bh = twin ? Math.max(2, Math.round(B * 0.45)) : B;
  const lines = twin ? [-(Math.ceil(Bh / 2) + 1), Math.ceil(Bh / 2) + 1] : [0];
  const halfOf = (u) => (twin ? (Bh / 2) * (1 - Math.abs((2 * u) / L - 1) ** full) : halfAt(u));
  for (const off of lines) for (let u = 0; u < L; u++) {
    if ((u & 3) === 0) yield;
    if (gap !== null && u >= gap && u < gap + 2) continue;                          // broken here
    const shift = gap !== null && u >= gap + 2 ? 1 : 0;                              // the after part slewed
    const hw = Math.max(0.6, halfOf(u + 0.5));
    const W = Math.round(hw);
    for (let w = -W; w <= W; w++) {
      const sink = Math.round((w + off) * heel);
      put(u, w + off + shift, 0 + sink, w === 0 ? wd.log : wd.planks);               // the bottom (and keel)
      if (Math.abs(w) === W) {
        for (let k = 1; k <= D; k++) {
          const lost = rand(s, u, w + off, k) < 0.22 + 0.1 * k;                       // planks gone, ribs left
          if (!lost) put(u, w + off + shift, k + sink, k === D ? wd.slab : wd.planks);
          else if (u % 2 === 0 && k < D) put(u, w + off + shift, k + sink, wd.fence);
        }
      }
    }
  }
  if (twin) for (let u = 2; u < L - 2; u += 4) {                                    // the cross-beams that held the hulls
    if (gap !== null && u >= gap && u < gap + 2) continue;
    if (rand(s, 40, u) < 0.35) continue;
    for (let w = lines[0]; w <= lines[1]; w++) put(u, w, D + Math.round(w * heel), wd.log, { axis: "w" });
  }
  // her stem and stern posts
  put(-1, 0, 1 + 0, wd.log);
  put(L, 0, 1 + 0, wd.log);
  // the mast, fallen across the bottom beside her
  if (plan.rigFamily) {
    const side = heel > 0 ? 1 : -1;
    const ml = Math.round(L * 0.6);
    const along = rand(s, 5) < 0.5;
    for (let i = 0; i < ml; i++) {
      const u = along ? Math.floor(L * 0.3) + i : Math.floor(L * 0.4);
      const w = along ? side * (Math.round(B / 2) + 2) : side * (Math.round(B / 2) + 1 + i);
      put(u, w, 0, wd.log, { axis: along ? "u" : "w" });
    }
    put(Math.floor(L * 0.5), side * (Math.round(B / 2) + 3), 0, "minecraft:white_wool");   // a scrap of sail
    if (site.theran) put(Math.floor(L * 0.5) + 1, side * (Math.round(B / 2) + 3), 0, "minecraft:red_wool");   // her sail was striped white and red
  }
  // cargo in her hold, and sea growth
  const containers = [];
  const mid = Math.floor(L / 2) + (gap !== null && Math.floor(L / 2) >= gap ? 0 : 0);
  const hold = [[mid, 0], [mid + 1, 0], [mid - 1, 0]].filter(([u]) => gap === null || u < gap || u >= gap + 2);
  hold.forEach(([u, w], i) => {
    const sh = gap !== null && u >= gap + 2 ? 1 : 0;
    const id = i === 0 ? "minecraft:chest" : "minecraft:barrel";
    put(u, w + sh, 1, id);
    containers.push({ u, w: w + sh, dy: 1, loot: [...roll(site.theran ? THERAN_CARGO : CARGO[site.tradition] ?? CARGO.european, s, 10 + i), ...(i === 0 ? roll(STORES, s, 20) : [])], chart: i === 0 && (site.theran || rand(s, 6) < 0.35) });
  });
  if (warm) for (let i = 0; i < Math.round(L / 3); i++) {
    const u = hash(s, 30, i) % L, w = (hash(s, 31, i) % 3) - 1;
    const key = [...list.values()].find((c) => c.u === u && c.w === w);
    if (key) put(u, w, key.dy + 1, CORAL[hash(s, 32, i) % CORAL.length]);
  }
  return { cells: [...list.values()], containers, size: { L, B } };
}

/** A sunken harbour: a stretch of quay, its pier's pilings, the stump of its light, a strongbox. */
export function ruin(site) {
  const stone = PEOPLES_STONE[site.tradition] ?? PEOPLES_STONE.european;
  const s = site.seed;
  const list = new Map();
  const put = (u, w, dy, id, st) => list.set(`${u},${w},${dy}`, { u, w, dy, id, st });
  const top = Math.max(1, Math.min(site.depth - 1, 5));                             // never breaking the surface
  const len = 9 + (hash(s, 1) % 7);
  for (let u = 0; u < len; u++) {
    const h = Math.max(1, top - (rand(s, 2, u) < 0.35 ? 1 + (hash(s, 3, u) % 2) : 0));
    for (let w = 0; w <= 1; w++) for (let dy = 1; dy <= h; dy++) put(u, w, dy, stone[hash(s, u, w, dy) % stone.length]);
    if (u % 4 === 1 && h >= top) put(u, 0, h + 1 > top ? h : h + 1, "minecraft:stripped_spruce_log");   // a bollard
  }
  // the old pier: pilings in a line out from the quay
  for (let i = 0; i < 4; i++) {
    const ph = Math.max(1, top - (hash(s, 5, i) % 3));
    for (let dy = 1; dy <= ph; dy++) put(Math.floor(len / 2), 3 + i * 2, dy, "minecraft:stripped_oak_log");
  }
  // the stump of its light, at the quay's end
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (!a && !b) continue;
    const h = Math.max(1, top - (hash(s, 6, a + 1, b + 1) % 3));
    for (let dy = 1; dy <= h; dy++) put(len + 1 + a, b, dy, stone[0]);
  }
  // fallen stones
  for (let i = 0; i < 6; i++) put(hash(s, 7, i) % (len + 3), -2 - (hash(s, 8, i) % 3), 1, stone[i % stone.length]);
  put(2, -1, 1, "minecraft:barrel");
  const loot = [...roll(CARGO[site.tradition] ?? CARGO.european, s, 40), ["minecraft:emerald", 1, 4], ["minecraft:gold_nugget", 2, 8]].map((x) => (Array.isArray(x) ? { item: x[0], count: x[1] + (hash(s, 41) % (x[2] - x[1] + 1)) } : x));
  return { cells: [...list.values()], containers: [{ u: 2, w: -1, dy: 1, loot, chart: rand(s, 9) < 0.5 }] };
}

/** Flotsam: a few planks and a crate adrift on the surface. */
export function flotsam(site, wood = "oak") {
  const s = site.seed;
  const cells = [{ u: 0, w: 0, dy: 0, id: "minecraft:barrel" }];
  for (let i = 0; i < 3; i++) cells.push({ u: (hash(s, 1, i) % 3) - 1, w: 1 + (hash(s, 2, i) % 2), dy: 0, id: `minecraft:${wood}_slab` });
  return { cells: cells.filter((c, i, a) => a.findIndex((d) => d.u === c.u && d.w === c.w) === i), containers: [{ u: 0, w: 0, dy: 0, loot: roll(STORES, s, 50), chart: rand(s, 3) < 0.15 }], surface: true };
}

/** A site's blocks and containers in world coordinates. */
export function siteBlocks(site, climateKey) {
  const g = siteSteps(site, climateKey);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
/** siteBlocks in steps, for the game's jobs. */
export function* siteSteps(site, climateKey) {
  const warm = climateKey === "tropical" || climateKey === "wet" || climateKey === "savanna";
  const b = site.kind === "wreck" ? yield* wreckSteps(site, warm) : site.kind === "ruin" ? ruin(site) : flotsam(site, ["oak", "spruce", "birch"][site.seed % 3]);
  yield;
  const turns = Math.round((site.heading ?? 0) / 90) % 4;
  const rot = (u, w) => [[u, w], [-w, u], [-u, -w], [w, -u]][turns];
  const y0 = b.surface ? SEA_LEVEL : site.floor + 0;        // a wreck's bottom sits in the bed (dy 0 replaces the floor)
  const axisOf = (a) => (!a ? undefined : a === "u" ? (turns % 2 ? "x" : "z") : turns % 2 ? "z" : "x");
  const blocks = b.cells.map((c) => {
    const [du, dw] = rot(c.u, c.w);
    const st = {};
    const ax = axisOf(c.st?.axis);
    if (ax && /_log$|bone_block|bamboo_block/.test(c.id)) st.pillar_axis = ax;
    if (/_slab$/.test(c.id)) st["minecraft:vertical_half"] = "bottom";
    return { x: site.x + du, y: Math.min(SEA_LEVEL - (b.surface ? 0 : 1), y0 + c.dy), z: site.z + dw, id: c.id, states: st };
  }).filter((p) => p.y > site.floor - 3);
  const containers = b.containers.map((c) => {
    const [du, dw] = rot(c.u, c.w);
    return { x: site.x + du, y: Math.min(SEA_LEVEL, y0 + c.dy), z: site.z + dw, loot: c.loot, chart: c.chart };
  });
  return { blocks, containers };
}
