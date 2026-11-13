// The bounds: vanilla Bedrock's blocks and items (Mojang's bedrock-samples lists, copied here as
// data) plus this pack's own (registered with addPack as the pack is written). Vanilla plus the pack
// is the floor and the ceiling: nothing outside it may be built, grown, given or asked for.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ns = (id) => (id.includes(":") ? id : `minecraft:${id}`);
let reg = null;
export function registry() {
  if (!reg) reg = {
    blocks: JSON.parse(readFileSync(path.join(here, "bedrock_blocks.json"), "utf8")).blocks,
    items: new Set(JSON.parse(readFileSync(path.join(here, "bedrock_items.json"), "utf8"))),
    pack: new Set(),
  };
  if (!reg.packed) { reg.packed = true; for (const id of PACK) reg.pack.add(id); }
  return reg;
}
export const addPack = (...ids) => ids.forEach((id) => registry().pack.add(ns(id)));
/** This pack's own blocks and items (the old mod's, carried into the new pack). */
export const PACK = ["shipwright:shipwright_table", "shipwright:gate_post", "shipwright:sea_chart", "shipwright:chart_book", "shipwright:captains_key"];
export const blockExists = (id) => { const r = registry(); id = ns(id); return id in r.blocks || r.pack.has(id); };
export const itemExists = (id) => { const r = registry(); id = ns(id); return r.items.has(id) || id in r.blocks || r.pack.has(id); };
export const exists = (id) => blockExists(id) || itemExists(id);
export function badStates(id, states = {}) {
  const def = registry().blocks[ns(id)];
  if (!def) return [];
  return Object.entries(states).filter(([k, v]) => !(k in def) || !def[k].includes(v)).map(([k, v]) => `${k}=${v}`);
}
/** Mobs are entities, not items: their spawn eggs prove they exist. */
export const mobExists = (id) => itemExists(`${ns(id)}_spawn_egg`);
