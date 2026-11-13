// inherency: instrument
// modtest's stand-in for @minecraft/server: the add-on in Node, laying the world into a map of blocks.
//
// It knows vanilla's every block and state (lab/bedrock_blocks.json, from Mojang's bedrock-samples), and acts as the
// game does where the laying code depends on it: BlockPermutation.resolve throws on a block or a state the game
// doesn't have (lay.js then falls back), and each such block or state is recorded in `bad`. The pack's own blocks
// (waterworld:, shipwright:) are taken as they come.
//   blocks   Map "x,y,z" -> id, every block laid (air included)        states  Map "x,y,z" -> states, where set
//   mockDim  the dimension the tools lay into (spawned: folk and beasts)  bad     Set of what the game would refuse
//   calls    { fill, set, get, vol }: calls into the game, and the blocks the fills covered
//   loop     the game's loop for flytest: intervals, timeouts and jobs stepped against a budget a tick
// Rebuilt in S002: the S001 stand-in lived in an ignored node_modules folder and never reached the source.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const VANILLA = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../../../lab/bedrock_blocks.json", import.meta.url)), "utf8")).blocks;
const OWN = /^(waterworld|shipwright):/;
export const blocks = new Map(), states = new Map(), bad = new Set(), calls = { fill: 0, set: 0, get: 0, vol: 0 };
const key = (x, y, z) => `${x},${y},${z}`;

// ---- events: any event the pack subscribes to exists, and the tools can fire it
const handlers = {};
const signal = (name) => ({ subscribe: (f) => ((handlers[name] ??= []).push(f), f), unsubscribe: (f) => { handlers[name] = (handlers[name] ?? []).filter((g) => g !== f); } });
const events = (side) => new Proxy({}, { get: (t, k) => (typeof k === "string" ? (t[k] ??= signal(`${side}.${k}`)) : undefined) });
export const fire = (name, arg) => (handlers[name] ?? []).forEach((f) => f(arg));
export const __handlers = handlers;

// ---- blocks
export class BlockPermutation {
  constructor(id, st) { this.type = { id }; this.states = st; }
  static resolve(id, st) {
    const s = st ?? {};
    if (!OWN.test(id)) {
      const known = VANILLA[id];
      if (!known) { bad.add(id); throw new Error(`unknown block ${id}`); }
      for (const [k, v] of Object.entries(s)) if (!known[k] || !known[k].includes(v)) { bad.add(`${id}[${k}=${v}]`); throw new Error(`bad state ${k}=${v} on ${id}`); }
    }
    return new BlockPermutation(id, { ...s });
  }
  getState(k) { return this.states[k]; }
  getAllStates() { return { ...this.states }; }
  withState(k, v) { return BlockPermutation.resolve(this.type.id, { ...this.states, [k]: v }); }
  matches(id, st) { return this.type.id === id && Object.entries(st ?? {}).every(([k, v]) => this.states[k] === v); }
}
export class BlockVolume { constructor(from, to) { this.from = { ...from }; this.to = { ...to }; } }
export class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; } }
const put = (x, y, z, p) => { const k = key(x, y, z); blocks.set(k, p.type.id); if (p.states && Object.keys(p.states).length) states.set(k, p.states); else states.delete(k); };
const asPerm = (p) => (typeof p === "string" ? BlockPermutation.resolve(p) : p.type ? p : BlockPermutation.resolve(p.id));

function makeBlock(dim, x, y, z) {
  const k = key(x, y, z);
  return {
    location: { x, y, z }, dimension: dim, x, y, z,
    get typeId() { return blocks.get(k) ?? "minecraft:air"; },
    get type() { return { id: this.typeId }; },
    get permutation() { return new BlockPermutation(this.typeId, states.get(k) ?? {}); },
    get isAir() { return this.typeId === "minecraft:air"; },
    get isLiquid() { return this.typeId === "minecraft:water" || this.typeId === "minecraft:lava"; },
    setType(t) { calls.set++; put(x, y, z, asPerm(t)); },
    setPermutation(p) { calls.set++; put(x, y, z, p); },
    setWaterlogged() {},
    above: (n = 1) => makeBlock(dim, x, y + n, z), below: (n = 1) => makeBlock(dim, x, y - n, z),
    getComponent: () => undefined,
  };
}

function makeDimension(id) {
  const dim = {
    id, spawned: [], heightRange: { min: -64, max: 320 },
    getBlock({ x, y, z }) { calls.get++; return makeBlock(dim, Math.floor(x), Math.floor(y), Math.floor(z)); },
    setBlockPermutation({ x, y, z }, p) { calls.set++; put(x, y, z, p); },
    setBlockType({ x, y, z }, t) { calls.set++; put(x, y, z, asPerm(t)); },
    fillBlocks(v, p) {
      calls.fill++; const perm = asPerm(p), a = v.from, b = v.to;
      const [x0, x1, y0, y1, z0, z1] = [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y), Math.min(a.z, b.z), Math.max(a.z, b.z)];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, perm);
      const n = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1); calls.vol += n; return { getCapacity: () => n };
    },
    isChunkLoaded: () => true,
    spawnEntity(typeId, location) { const e = makeEntity(typeId, location, dim); dim.spawned.push(e); return e; },
    getEntities: () => [], getEntitiesAtBlockLocation: () => [], getPlayers: () => loop.players.filter((p) => p.dimension === dim),
    runCommand: () => ({ successCount: 1 }), runCommandAsync: async () => ({ successCount: 1 }),
    spawnParticle() {}, playSound() {}, spawnItem() {}, createExplosion: () => true,
    getBiome: () => ({ id: "minecraft:ocean" }), getTopmostBlock: () => undefined,
  };
  return dim;
}
function makeEntity(typeId, location, dim) {
  const dp = {}, tags = new Set();
  return { typeId, id: `e${Math.random().toString(36).slice(2)}`, location: { ...location }, dimension: dim, isValid: true, nameTag: "",
    addTag: (t) => tags.add(t), hasTag: (t) => tags.has(t), removeTag: (t) => tags.delete(t), getTags: () => [...tags],
    getDynamicProperty: (k) => dp[k], setDynamicProperty: (k, v) => { dp[k] = v; }, setProperty() {}, getProperty: () => undefined,
    triggerEvent() {}, teleport(l) { Object.assign(this.location, l); }, remove() { this.isValid = false; }, kill() { this.isValid = false; },
    getComponent: () => undefined, addEffect() {}, setRotation() {}, getRotation: () => ({ x: 0, y: 0 }), runCommand: () => ({ successCount: 1 }) };
}
const dims = {};
export const mockDim = (dims["waterworld:sea"] = makeDimension("waterworld:sea"));

// ---- the loop: the game's timers and jobs, stepped by the tools
export const loop = {
  tick: 0, intervals: [], timeouts: [], jobs: [], players: [], steps: [], all: true, view: null, next: 1,
  /** One tick: due intervals and timeouts, then jobs a slice at a time while the budget (ms) lasts. Returns ms used. */
  step(budget = 1e9) {
    const t0 = performance.now(); loop.tick++; system.currentTick = loop.tick;
    for (const it of [...loop.intervals]) if (loop.tick % it.every === 0) it.f();
    for (const t of loop.timeouts.filter((t) => t.at <= loop.tick)) { loop.timeouts.splice(loop.timeouts.indexOf(t), 1); t.f(); }
    while (loop.jobs.length && performance.now() - t0 < budget) { const j = loop.jobs[0]; if (j.gen.next().done) loop.jobs.shift(); }
    const used = performance.now() - t0; loop.steps.push(used); return used;
  },
};
const handle = (list, item) => { item.id = loop.next++; list.push(item); return item.id; };
export const system = {
  currentTick: 0, afterEvents: events("system.after"), beforeEvents: events("system.before"),
  run: (f) => handle(loop.timeouts, { f, at: loop.tick + 1 }),
  runTimeout: (f, d = 1) => handle(loop.timeouts, { f, at: loop.tick + Math.max(1, d) }),
  runInterval: (f, every = 1) => handle(loop.intervals, { f, every: Math.max(1, every) }),
  runJob: (gen) => handle(loop.jobs, { gen }),
  clearRun(id) { for (const l of [loop.intervals, loop.timeouts]) { const i = l.findIndex((x) => x.id === id); if (i >= 0) l.splice(i, 1); } },
  clearJob(id) { const i = loop.jobs.findIndex((x) => x.id === id); if (i >= 0) loop.jobs.splice(i, 1); },
  waitTicks: (n = 1) => new Promise((r) => system.runTimeout(r, n)),
};
const worldDp = {};
export const world = {
  afterEvents: events("world.after"), beforeEvents: events("world.before"),
  getDimension: (id) => (id === "overworld" || id === "minecraft:overworld" ? (dims.overworld ??= makeDimension("minecraft:overworld")) : (dims[id] ??= makeDimension(id))),
  getAllPlayers: () => loop.players, getPlayers: () => loop.players,
  getDynamicProperty: (k) => worldDp[k], setDynamicProperty: (k, v) => { worldDp[k] = v; }, getDynamicPropertyIds: () => Object.keys(worldDp),
  getAbsoluteTime: () => loop.tick, getTimeOfDay: () => 6000, getDay: () => 0, getEntity: () => undefined,
  getDefaultSpawnLocation: () => ({ x: 0, y: 64, z: 0 }), sendMessage() {},
  structureManager: { get: () => undefined, place() {} },
  scoreboard: { getObjective: () => undefined, addObjective: () => ({ setScore() {}, getScore: () => 0 }) },
};
export const EntityComponentTypes = new Proxy({}, { get: (t, k) => String(k) });
export const BlockComponentTypes = EntityComponentTypes, ItemComponentTypes = EntityComponentTypes;
export const GameMode = { survival: "Survival", creative: "Creative", adventure: "Adventure", spectator: "Spectator", Survival: "Survival", Creative: "Creative" };
export const Direction = { Up: "Up", Down: "Down", North: "North", South: "South", East: "East", West: "West" };
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const DimensionTypes = { getAll: () => [] };
export class MolangVariableMap { setFloat() {} setColorRGB() {} setVector3() {} }
