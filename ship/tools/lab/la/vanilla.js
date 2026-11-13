// The bounds: what exists. Vanilla Bedrock (the block and item lists the lab already carries,
// tools/lab/bedrock_blocks.json and bedrock_items.json, from Mojang's bedrock-samples) plus what this
// pack adds (every "identifier" in BP/blocks, BP/items, BP/entities). Nothing outside these may be
// built, given, or asked for: vanilla plus the pack is the floor and the ceiling.
//
// Lab only (reads files); the game knows its own registry.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../../..");

/** Minecraft's height and sea, as the mod uses them (world/limits.js DEFAULT_MEASURED, terrain.js). */
export const WORLD = Object.freeze({ ymin: -64, ymax: 319, sea: 62 });   // given: overworld build limits, the sea's level

let cache = null;
export function registry() {
  if (cache) return cache;
  const blocks = JSON.parse(readFileSync(path.join(ROOT, "tools/lab/bedrock_blocks.json"), "utf8")).blocks;
  const items = new Set(JSON.parse(readFileSync(path.join(ROOT, "tools/lab/bedrock_items.json"), "utf8")));
  const pack = { blocks: new Set(), items: new Set(), entities: new Set() };
  for (const [dir, set] of [["BP/blocks", pack.blocks], ["BP/items", pack.items], ["BP/entities", pack.entities]]) {
    for (const f of readdirSync(path.join(ROOT, dir))) {
      if (!f.endsWith(".json")) continue;
      const m = readFileSync(path.join(ROOT, dir, f), "utf8").match(/"identifier"\s*:\s*"([^"]+)"/);
      if (m) set.add(m[1]);
    }
  }
  cache = { blocks, items, pack };
  return cache;
}

const ns = (id) => (id.includes(":") ? id : `minecraft:${id}`);
/** Does this block exist (vanilla or the pack)? */
export const blockExists = (id) => { const r = registry(); id = ns(id); return id in r.blocks || r.pack.blocks.has(id) || id === "minecraft:air"; };
/** Does this item exist (vanilla or the pack)? Blocks are items too. */
export const itemExists = (id) => { const r = registry(); id = ns(id); return r.items.has(id) || r.pack.items.has(id) || id in r.blocks; };
/** Which of a block's states are not the game's: unknown keys, or values outside the key's list. */
export function badStates(id, states = {}) {
  const r = registry(), def = r.blocks[ns(id)];
  if (!def) return [];                     // a pack block: its states live in its own json
  const bad = [];
  for (const [k, v] of Object.entries(states)) {
    if (!(k in def)) bad.push(`${k} (no such state)`);
    else if (!def[k].includes(v)) bad.push(`${k}=${v} (allowed ${def[k].join("/")})`);
  }
  return bad;
}
/** Every block id that matches a pattern (to look things up while building). */
export const findBlocks = (re) => Object.keys(registry().blocks).filter((k) => re.test(k));
