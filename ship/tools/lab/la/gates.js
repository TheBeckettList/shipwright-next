// The gates: what a build must pass (must) and what it's scored on (prefer), in the same shape as
// the cultures' own rule gates (BP/scripts/config/culturegates.js):
//
//   { must | prefer: rule, ...args, weight?, why }
//
// Three layers, checked in order, each a pure function of the build and the data:
//   1. bounds   vanilla plus the pack (vanilla.js): every block exists, every state is the game's,
//               the build fits the height range at the y it's set down at, it stands up (no part
//               floats free of the ground row)
//   2. frames   every directional state survives a turn and a mirror (frames.js), so the build can
//               be set down any way round
//   3. culture  the culture's palette: its yard style's parts, its trees' woods, its boats' woods
//               (config/yardstyles.js, culturegates.js, plans.js), and every material its own three
//               buildings use (learned from yardarch.js, so the code is the source), plus the
//               neutral blocks every people uses (lights, glass, work blocks). A share, not a ban.
//
// Add a rule: a function (build, gate, ctx) -> { ok, score?, detail } in RULES, then use it in a
// gate list. A culture's gate list is BASE_GATES plus CULTURE_EXTRA[culture] (empty to start: the
// place to write what a people wants of a build beyond its palette).
import { blockExists, badStates, itemExists, WORLD } from "./vanilla.js";
import { D4, turnStates } from "./frames.js";
import { YARD_STYLES } from "../../../BP/scripts/config/yardstyles.js";
import { CULTURE_GATES } from "../../../BP/scripts/config/culturegates.js";
import { PLANS } from "../../../BP/scripts/config/plans.js";
import { TRADITIONS } from "../../../BP/scripts/config/materials.js";
import { drawPieces } from "../../../BP/scripts/yardarch.js";

// ---------------------------------------------------------------- the cultures, as data the gates read

const TREE_WOOD = { palm: "jungle", bamboo: "bamboo" };          // given: chunkgen.js treeBlocks (a palm is jungle wood)
/** A block's material: its id with the shape words taken off (spruce_slab -> spruce, stone_bricks -> stone_brick). */
export function material(id) {
  let s = id.replace(/^\w+:/, "");
  s = s.replace(/^(stripped_|waxed_|polished_|smooth_|cut_|chiseled_|mossy_|cracked_)+/, "");
  s = s.replace(/_(double_slab|slab|stairs|planks|log|wood|fence_gate|fence|wall|door|trapdoor|button|pressure_plate|hanging_sign|sign|leaves|sapling|block|mosaic|pillar)$/, "");
  s = s.replace(/_(slab|stairs|block|mosaic)$/, "");
  return s.replace(/bricks$/, "brick");
}
/** Blocks every people uses, whose material says nothing of a culture. vision: the neutral set. */
export const NEUTRAL = /lantern|torch|campfire|candle|glass|water$|^minecraft:air$|chest|barrel|crafting_table|furnace|smoker|cauldron|lectern|composter|loom|grindstone|smithing|cartography|fletching|stonecutter|anvil|bell$|_bed$|wool|carpet|chain|hay_block|ladder|flower|_leaves|grass|dirt|path|gravel|^minecraft:sand$|lead|scaffolding|iron|copper|shipwright|bookshelf|vine|kelp|seagrass|lily|flower_pot|decorated_pot|banner|item_frame|bee|honey|shelf|brewing|beacon|end_rod|sea_lantern|froglight|bone_block|white_concrete/;

/**
 * The materials a culture's own buildings use (yardarch's three pieces, drawn as the homeport draws
 * them): the palette learned from the code. A material counts once it's at least LEARN_MIN blocks.
 */
export const LEARN_MIN = 4;   // vision: below this a material is a detail, not the palette
const learned = new Map();
export function piecesOf(key) {
  const s = YARD_STYLES[key];
  const wood = (s.post ?? "spruce").replace(/minecraft:|stripped_|_log|_block|_stem/g, "") || "spruce";   // as portsim.js
  return drawPieces(s.arch, { base: s.base ?? "minecraft:cobblestone", wood });
}
function learnPalette(key) {
  if (learned.has(key)) return learned.get(key);
  const n = new Map();
  const p = piecesOf(key);
  for (const k of ["main", "home", "side"]) for (const c of p[k].cells.values()) {
    if (NEUTRAL.test(c.id) || c.id === "minecraft:air") continue;
    n.set(material(c.id), (n.get(material(c.id)) ?? 0) + 1);
  }
  const out = [...n.entries()].filter(([, k]) => k >= LEARN_MIN).sort((a, b) => b[1] - a[1]);
  learned.set(key, out);
  return out;
}

/** What the sim knows of a culture: its style, its rules, its tradition, its woods, its palette. */
export function culture(key) {
  const style = YARD_STYLES[key], rules = CULTURE_GATES[key];
  if (!style || !rules) throw new Error(`no culture "${key}" (have ${Object.keys(YARD_STYLES).join(", ")})`);
  const plans = Object.values(PLANS).filter((p) => p.tradition === key);
  const woods = new Set([...rules.trees.map((t) => TREE_WOOD[t] ?? t), ...plans.map((p) => p.keelWood).filter(Boolean)]);
  const parts = ["wall", "deck", "base", "post", "accent", "light"].map((k) => style[k]).filter(Boolean);
  const declared = new Set([...woods, ...parts.map(material)]);
  const learnt = learnPalette(key);
  const families = new Set([...declared, ...learnt.map(([m]) => m)]);
  return { key, name: TRADITIONS[key]?.name ?? key, style, rules, plans: plans.map((p) => p.id), woods: [...woods], parts,
    declared: [...declared], learned: learnt, families: [...families] };
}
export const CULTURES = Object.keys(YARD_STYLES);

// ---------------------------------------------------------------- the rules

const TOUCH = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (dx || dy || dz) TOUCH.push([dx, dy, dz]);
const cells = (b) => [...b.cells.values()].filter((c) => c.id !== "minecraft:air");

export const RULES = {
  /** Every block is vanilla or the pack's. */
  exists(b) {
    const bad = [...new Set(cells(b).filter((c) => !blockExists(c.id)).map((c) => c.id))];
    return { ok: !bad.length, detail: bad.length ? `not in the game: ${bad.join(", ")}` : `${cells(b).length} blocks, all real` };
  },
  /** Every state key and value is the game's for that block. */
  states(b) {
    const bad = new Set();
    for (const c of cells(b)) for (const s of badStates(c.id, c.states)) bad.add(`${c.id} ${s}`);
    return { ok: !bad.size, detail: bad.size ? [...bad].slice(0, 6).join("; ") : "all states valid" };
  },
  /** Fits the world's height range when its floor sits at y (default the sea's level). */
  height(b, g, ctx) {
    const y = ctx.y ?? WORLD.sea, bb = b.bounds();
    const lo = y + bb.y0, hi = y + bb.y1;
    return { ok: lo >= WORLD.ymin && hi <= WORLD.ymax, detail: `y ${lo}..${hi} (world ${WORLD.ymin}..${WORLD.ymax})` };
  },
  /** At most this many blocks across, along and up (a build that fits a yard or a chunk). */
  size(b, g) {
    const bb = b.bounds(), [mx, my, mz] = g.max;
    return { ok: bb.dx <= mx && bb.dy <= my && bb.dz <= mz, detail: `${bb.dx} x ${bb.dy} x ${bb.dz} (max ${mx} x ${my} x ${mz})` };
  },
  /** Everything joins the ground row (y = its lowest) through touching blocks (faces, edges or corners:
   *  a roof's stair steps out diagonally from its wall and reads as held): nothing floats. */
  grounded(b) {
    const all = cells(b), y0 = b.bounds().y0, seen = new Set(), q = [];
    for (const c of all) if (c.y === y0) { const k = `${c.x},${c.y},${c.z}`; seen.add(k); q.push(c); }
    while (q.length) {
      const c = q.pop();
      for (const [dx, dy, dz] of TOUCH) {
        const k = `${c.x + dx},${c.y + dy},${c.z + dz}`, n = b.cells.get(k);
        if (n && n.id !== "minecraft:air" && !seen.has(k)) { seen.add(k); q.push(n); }
      }
    }
    const loose = all.filter((c) => !seen.has(`${c.x},${c.y},${c.z}`));
    return { ok: !loose.length, detail: loose.length ? `${loose.length} floating, e.g. ${loose.slice(0, 3).map((c) => `${c.id.replace("minecraft:", "")}@${c.x},${c.y},${c.z}`).join(" ")}` : "all joined to the ground" };
  },
  /** Every directional state comes through all eight placements. */
  turnable(b) {
    const miss = new Set();
    for (const c of cells(b)) for (const g of D4) for (const u of turnStates(c.id, c.states, g.A).unhandled) miss.add(`${c.id.replace("minecraft:", "")}: ${u}`);
    for (const w of b.warnings) miss.add(w);
    return { ok: !miss.size, detail: miss.size ? [...miss].slice(0, 6).join("; ") : "turns and mirrors cleanly" };
  },
  /** Share of the non-neutral blocks that are the culture's own materials. */
  palette(b, g, ctx) {
    if (!ctx.culture) return { ok: true, score: 1, detail: "no culture" };
    const fam = new Set(ctx.culture.families);
    let own = 0, n = 0;
    const off = new Map();
    for (const c of cells(b)) {
      if (NEUTRAL.test(c.id)) continue;
      n++;
      if (fam.has(material(c.id))) own++;
      else off.set(material(c.id), (off.get(material(c.id)) ?? 0) + 1);
    }
    const share = n ? own / n : 1;
    const top = [...off.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, k]) => `${m} ${k}`).join(", ");
    return { ok: share >= g.min, score: share, detail: `${Math.round(share * 100)}% own materials${top ? `; others: ${top}` : ""}` };
  },
  /** Every block has an item a player can carry (water and lava come in buckets): survival can build it. */
  items(b) {
    const LIQUID = /^minecraft:(water|lava|flowing_water|flowing_lava)$/;   // given: placed from a bucket
    const bad = [...new Set(cells(b).map((c) => c.id).filter((id) => !LIQUID.test(id) && !itemExists(id)))];
    return { ok: !bad.length, score: bad.length ? 0 : 1, detail: bad.length ? `no item: ${bad.join(", ")}` : "every block has an item" };
  },
  /** Mirror symmetry across the build's long axis (share of blocks with a twin): a measure, for prefer. */
  symmetric(b) {
    const bb = b.bounds(), all = cells(b);
    const alongX = bb.dx >= bb.dz;
    let twin = 0;
    for (const c of all) {
      const k = alongX ? `${c.x},${c.y},${bb.z0 + bb.z1 - c.z}` : `${bb.x0 + bb.x1 - c.x},${c.y},${c.z}`;
      const o = b.cells.get(k);
      if (o && o.id === c.id) twin++;
    }
    const share = all.length ? twin / all.length : 1;
    return { ok: true, score: share, detail: `${Math.round(share * 100)}% mirrored across the ${alongX ? "x" : "z"} axis` };
  },
};

/** Every build passes these. vision: the palette's floor and a yard-sized box. */
export const BASE_GATES = [
  { must: "exists", why: "vanilla plus the pack is the bound: nothing outside it" },
  { must: "states", why: "a state the game doesn't know fails to place, silently" },
  { must: "height", why: "inside the world's build limits" },
  { must: "grounded", why: "nothing hangs in the air (lanterns hang from something)" },
  { must: "turnable", why: "a build can be set down any way round" },
  { must: "size", max: [48, 32, 48], why: "fits a yard's ground" },
  { prefer: "palette", min: 0.6, weight: 3, why: "built from its own people's materials" },
  { prefer: "items", weight: 1, why: "a player in survival can build it" },
  { prefer: "symmetric", weight: 1, why: "the eye reads a building by its symmetry" },
];
/** Per-culture gates beyond the base (fill as the dev direction asks). */
export const CULTURE_EXTRA = Object.fromEntries(CULTURES.map((c) => [c, []]));

/**
 * Run the gates on a build. Returns { pass (every must), score (the prefers, weighted, 0..1), results }.
 * ctx: { y: floor height, culture: key or null }.
 */
export function check(b, { gates = null, y = WORLD.sea, culture: cKey = b.culture } = {}) {
  const ctx = { y, culture: cKey ? culture(cKey) : null };
  const list = gates ?? [...BASE_GATES, ...(cKey ? CULTURE_EXTRA[cKey] ?? [] : [])];
  const results = [];
  let wsum = 0, ssum = 0;
  for (const g of list) {
    const rule = g.must ?? g.prefer, fn = RULES[rule];
    if (!fn) { results.push({ ...g, rule, ok: false, detail: `no rule "${rule}"` }); continue; }
    const r = fn(b, g, ctx);
    results.push({ rule, kind: g.must ? "must" : "prefer", why: g.why, ...r });
    if (g.prefer) { const w = g.weight ?? 1; wsum += w; ssum += w * (r.score ?? (r.ok ? 1 : 0)); }
  }
  return { pass: results.every((r) => r.kind !== "must" || r.ok), score: wsum ? +(ssum / wsum).toFixed(3) : 1, results };
}
