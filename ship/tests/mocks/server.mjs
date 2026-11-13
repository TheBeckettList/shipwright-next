// A small fake of @minecraft/server: a block grid, entities, events, ticks.
const key = (x, y, z) => `${x},${y},${z}`;
const handlers = {};
const listeners = {};
const ev = (name) => ({
  subscribe: (f) => {
    (listeners[name] ??= []).push(f);
    handlers[name] = (arg) => listeners[name].forEach((fn) => fn(arg));
    return f;
  },
});

export class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; }
}

export class BlockVolume {
  constructor(from, to) { this.from = { ...from }; this.to = { ...to }; }
}

export class BlockPermutation {
  static resolve(id, states = {}) {
    return { type: { id }, states, getState: (k) => states[k] };
  }
}

export function makeDimension(id = "minecraft:overworld") {
  const blocks = new Map();
  const states = new Map(); // "x,y,z" -> { liquid_depth: n }
  const containers = new Map(); // "x,y,z" -> mock container, for chest-like blocks
  const entities = [];
  const drops = [];
  const particles = [];
  const dim = {
    id, blocks, states, containers, entities, drops, particles,
    chestAt(x, y, z, items = [], size = 27) {
      blocks.set(key(x, y, z), "minecraft:chest");
      const slots = Array.from({ length: size }, (_, i) => items[i]);
      const c = {
        size, slots,
        getItem: (i) => (slots[i] ? { ...slots[i] } : undefined),
        setItem: (i, it) => { slots[i] = it; },
        addItem: (stack) => {
          let left = stack.amount;
          for (let i = 0; i < size && left > 0; i++) if (!slots[i]) { slots[i] = { typeId: stack.typeId, amount: left }; left = 0; }
          return left > 0 ? { typeId: stack.typeId, amount: left } : undefined;
        },
      };
      containers.set(key(x, y, z), c);
      return c;
    },
    set(x, y, z, t, st) { blocks.set(key(x, y, z), t); if (st) states.set(key(x, y, z), st); else states.delete(key(x, y, z)); },
    getBlock({ x, y, z }) {
      if (dim.loadedFn && !dim.loadedFn(x, z)) return undefined;     // the simulator's chunk loading
      const b = {
        get typeId() { return blocks.get(key(x, y, z)) ?? "minecraft:air"; },
        location: { x, y, z }, dimension: dim,
        permutation: { getState: (s) => (s === "minecraft:cardinal_direction" ? dim.facing ?? "north" : states.get(key(x, y, z))?.[s]) },
        setType: (t) => { blocks.set(key(x, y, z), t); states.delete(key(x, y, z)); },
        setPermutation: (p) => { blocks.set(key(x, y, z), p.type.id); states.set(key(x, y, z), { ...p.states }); },
        getComponent: (n) => (n === "minecraft:inventory" && containers.has(key(x, y, z)) ? { container: containers.get(key(x, y, z)) } : undefined),
      };
      return b;
    },
    getEntities(opts = {}) {
      return entities.filter((e) => e.isValid && (!opts.type || e.typeId === opts.type) &&
        (!opts.tags || opts.tags.every((t) => e.tags.has(t))) &&
        (!opts.families || opts.families.some((f) => e.families.includes(f))) &&
        (!opts.location || Math.hypot(e.location.x - opts.location.x, e.location.z - opts.location.z) <= (opts.maxDistance ?? Infinity)));
    },
    spawnParticle: (id, loc) => particles.push(id),
    explosions: [],
    createExplosion(at, radius, o) { this.explosions.push({ at: { ...at }, radius, ...(o ?? {}) }); return true; },
    playSound() {},
    fills: 0,
    fillBlocks(v, p) {
      if (dim.loadedFn && !(dim.loadedFn(v.from.x, v.from.z) && dim.loadedFn(v.to.x, v.to.z))) throw new Error("UnloadedChunksError");
      this.fills++;
      const id = typeof p === "string" ? p : p.type?.id ?? p.id;
      for (let x = Math.min(v.from.x, v.to.x); x <= Math.max(v.from.x, v.to.x); x++)
        for (let y = Math.min(v.from.y, v.to.y); y <= Math.max(v.from.y, v.to.y); y++)
          for (let z = Math.min(v.from.z, v.to.z); z <= Math.max(v.from.z, v.to.z); z++) this.set(x, y, z, id, p.states && Object.keys(p.states).length ? p.states : undefined);
    },
    isChunkLoaded(l) { return dim.loadedFn ? !!dim.loadedFn(l.x, l.z) : true; },
    commands: [],
    runCommand(c) { this.commands.push(c); return { successCount: 1 }; },
    biomeAt: null, // tests can set (x, z) => biome id
    getBiome({ x, z }) { return { id: dim.biomeAt ? dim.biomeAt(x, z) : "minecraft:ocean" }; },
    spawnItem: (stack, loc) => drops.push(stack),
    spawnEntity(typeId, loc) { const e = makeEntity(typeId, loc, dim); entities.push(e); return e; },
  };
  return dim;
}

let nextId = 1;
export function makeEntity(typeId, loc, dim) {
  const dp = {}, props = {}, groups = new Set();
  const e = {
    id: `e${nextId++}`, typeId, location: { ...loc }, dimension: dim, isValid: true, nameTag: "",
    tags: new Set(), families: ["shipwright_boat", "inanimate"], props, events: [],
    getDynamicProperty: (k) => dp[k], setDynamicProperty: (k, v) => (dp[k] = v),
    getProperty: (k) => props[k], setProperty: (k, v) => (props[k] = v),
    triggerEvent(name) {
      this.events.push(name);
      if (name === "shipwright:launch") groups.add("seats");
    },
    rotation: { x: 0, y: 0 },
    setRotation(r) { this.rotation = r; },
    getRotation() { return { ...this.rotation }; },
    velocity: { x: 0, y: 0, z: 0 }, impulses: [],
    getVelocity() { return { ...this.velocity }; },
    applyImpulse(v) { this.impulses.push(v); this.velocity.x += v.x; this.velocity.y += v.y; this.velocity.z += v.z; },
    teleport(l, o) { this.location = { ...l }; if (o?.rotation) this.rotation = o.rotation; if (o?.dimension) { if (o.dimension !== this.dimension) { this.dimension.entities.splice(this.dimension.entities.indexOf(this), 1); o.dimension.entities.push(this); } this.dimension = o.dimension; } },
    addTag(t) { this.tags.add(t); return true; },
    hasTag(t) { return this.tags.has(t); },
    remove() { this.isValid = false; },
    damage: 0,
    applyDamage(n) { this.damage += n; return true; },
    kill() { this.isValid = false; this.killed = true; },
    getComponent(name) {
      if (name === "minecraft:leashable") return {
        get isLeashed() { return !!e.leashedTo; },
        leashTo: (holder) => { e.leashedTo = holder; },
        unleash: () => {
          if (!e.leashedTo) return;
          const at = e.leashedTo.location;
          e.leashedTo = null;
          // like vanilla, untying drops a lead
          const lead = makeEntity("minecraft:item", at, dim);
          lead.families = [];
          lead.itemStack = { typeId: "minecraft:lead" };
          dim.entities.push(lead);
        },
      };
      if (name === "minecraft:item" && e.itemStack) return { itemStack: e.itemStack };
      if (name === "minecraft:projectile" && /arrow|snowball/.test(typeId)) return {
        owner: undefined,
        shoot(v) { e.velocity = { ...v }; },
      };
      if (name === "minecraft:tameable") return { tame: (p) => { e.owner = p.id; return true; } };
      if (name === "minecraft:inventory" && typeId.startsWith("shipwright:")) {
        e.chest ??= { size: typeId === "shipwright:sea_chest" ? 54 : e.events?.includes("shipwright:hold_on") ? 54 : 27, slots: [] };
        const c = e.chest;
        return { container: {
          get size() { return c.size; },
          getItem: (i) => (c.slots[i] ? { ...c.slots[i] } : undefined),
          setItem: (i, it) => { c.slots[i] = it; },
          addItem: (st) => { for (let i = 0; i < c.size; i++) if (!c.slots[i]) { c.slots[i] = { typeId: st.typeId, amount: st.amount }; return undefined; } return st; },
          moveItem(from, to, other) { const it = c.slots[from]; c.slots[from] = undefined; other.setItem(to, it); },
        } };
      }
      if (name === "minecraft:rideable" && groups.has("seats")) return {
        getRiders: () => e.riders ?? [],
        addRider: (p) => { e.riders = [...(e.riders ?? []), p]; return true; },
        ejectRider: (p) => { e.riders = (e.riders ?? []).filter((r) => r.id !== p.id); },
      };
      return undefined;
    },
  };
  return e;
}

let playerSeq = 1;
export function makePlayer(dim, inventory = [], mode = "Survival") {
  const dp = {};
  return {
    typeId: "minecraft:player", id: `p${playerSeq++}`, name: "Tester", isSneaking: false, dimension: dim, selectedSlotIndex: 0, isValid: true,
    teleport(l) { this.location = { ...l }; },
    location: { x: 0, y: 64, z: -2 }, messages: [], inventory,
    sendMessage(m) { this.messages.push(m); },
    getGameMode: () => mode,
    getDynamicProperty: (k) => dp[k], setDynamicProperty: (k, v) => (dp[k] = v),
    exhaustion: 0, food: 20,
    getComponent(n) {
      if (n === "minecraft:player.hunger") { const p = this; return { get currentValue() { return p.food; } }; }
      if (n === "minecraft:player.exhaustion") {
        const p = this;
        return { get currentValue() { return p.exhaustion; }, effectiveMax: 40, setCurrentValue(v) { p.exhaustion = v; } };
      }
      return n === "minecraft:inventory" ? {
      container: {
        get size() { return inventory.length; },
        getItem: (i) => (inventory[i] ? { ...inventory[i] } : undefined),
        setItem: (i, it) => { inventory[i] = it; },
        addItem: (it) => {
          let i = inventory.findIndex((x) => !x);
          if (i < 0) { inventory.push(undefined); i = inventory.length - 1; }
          inventory[i] = { typeId: it.typeId, amount: it.amount };
          return undefined;
        },
      },
    } : undefined;
    },
  };
}

const worldDp = {};
export const world = {
  beforeEvents: { playerInteractWithBlock: ev("interact"), playerInteractWithEntity: ev("beforeInteractEntity") },
  afterEvents: { entityDie: ev("die"), playerInteractWithEntity: ev("interactEntity") },
  getDay: () => 12,
  getDefaultSpawnLocation: () => ({ x: 0, y: 64, z: 0 }),
  getEntity(id) {
    for (const d of Object.values(this.dims)) { const e = d.entities.find((x) => x.id === id && x.isValid); if (e) return e; }
    return undefined;
  },
  dims: {},
  getDimension(id) { return (this.dims[id] ??= makeDimension(id)); },
  getAllPlayers: () => world.players ?? [],
  getDynamicProperty: (k) => worldDp[k],
  setDynamicProperty: (k, v) => (worldDp[k] = v),
};

export const system = {
  afterEvents: { scriptEventReceive: ev("scriptevent") },
  beforeEvents: { startup: ev("startup") },
  run: (f) => queueMicrotask(f),
  // intervalFn: the last one registered (older tests). intervals: all of them, for the runtime lab.
  intervals: [],
  runInterval: (f, every = 1) => { system.intervalFn = f; system.intervals.push({ f, every }); return system.intervals.length; },
  // timeouts: right away (tests), or on their tick when the simulator drives time
  timeouts: [],
  runTimeout: (f, delay = 1) => {
    if (system.manualJobs) { system.timeouts.push({ f, at: (system.currentTick ?? 0) + Math.max(1, delay) }); return system.timeouts.length; }
    return (setTimeout(f, 0), 1);
  },
  clearRun: () => {},
  currentTick: 0,
  waitTicks: () => new Promise((r) => setTimeout(r, 0)),
  // Jobs run to completion on their own (tests), or, with manualJobs set, wait for the runtime lab
  // to step them a time slice per tick as the game does.
  manualJobs: false,
  jobs: [],
  runJob(gen) {
    if (system.manualJobs) { system.jobs.push(gen); return system.jobs.length; }
    const step = () => { const r = gen.next(); if (!r.done) setTimeout(step, 0); };
    step();
    return 1;
  },
};

export const __handlers = handlers;
