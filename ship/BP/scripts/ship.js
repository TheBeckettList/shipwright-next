import { PROPORTIONS } from "./config/proportions.js";
import { setP, getP } from "./props.js";
import { world } from "@minecraft/server";
import { PLANS, STAGES, ZONES } from "./config/plans.js";
import { WOODS, WOOL, ITEMS, woodIndex, materialByKey, SKINS, RIG_STYLES } from "./config/materials.js";
import { dropItems } from "./inventory.js";
import { computeHandling, describeHandling, oarPairsFor, propulsionFor, rigScaleFor, rigFor, rudderFor, OARED, PROPULSION } from "./handling.js";
import { POWER, CRANK_IRON } from "./config/power.js";
import { MODULES } from "./config/modules.js";
import { layoutDeck } from "./grid.js";

const RECORD = "shipwright:record";
const P = (name) => `shipwright:${name}`;

// ---------- record ----------

export function readRecord(entity) {
  try {
    const raw = entity.getDynamicProperty(RECORD);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Brings records from older versions up to date. */
function normalize(rec) {
  rec.modules = rec.modules ?? [];
  if (rec.modules.includes("furnace")) {          // the furnace was a module before the power slot
    rec.power = rec.power ?? "furnace";
    rec.modules = rec.modules.filter((m) => m !== "furnace");
  }
  rec.power = rec.power ?? null;
  rec.condition = { bow: 1, mid: 1, stern: 1, sail: 1, ...(rec.condition ?? {}) };
  return rec;
}

export function writeRecord(entity, rec) {
  entity.setDynamicProperty(RECORD, JSON.stringify(rec));
  rememberShip(entity, rec);
}

/** The hull material a new boat starts with: its own wood, or leather for a hide boat. */
export const defaultShell = (plan) => (plan.shell === "hide" ? "hide" : plan.shell === "bark" ? "birch_bark" : plan.keelWood);

const PROP_INDEX = { oars: 0, sweeps: 0, paddles: 1, double_paddle: 2, scull: 3, pole: 4 };
/** The rig a boat carries: its own record's choice, else its tradition's. */
export const rigStyleOf = (rec, plan) => rec.sections.rig?.style ?? plan.rigStyle ?? "square";

export function newRecord(plan, yardKey, length) {
  const keel = plan.keelWood ?? "hide";
  const shell = defaultShell(plan);
  return {
    v: 1,
    name: "",
    plan: plan.id,
    yard: yardKey,
    stage: STAGES.KEEL,
    launchedDay: null,
    dims: { length, beam: 1, depth: 1 },
    sections: {
      keel: { mat: keel, original: true },
      frames: { mat: keel, original: true },
      bow: { mat: shell, original: true },
      mid: { mat: shell, original: true },
      stern: { mat: shell, original: true },
      rig: { sail: !!plan.buyOnly, color: 14, style: plan.rigStyle ?? "square", family: plan.rigFamily ?? "square", original: true },
    },
    log: { distance: 0, refits: 0 },
    condition: { bow: 1, mid: 1, stern: 1, sail: 1 },   // wear, 0 (holed or torn) to 1 (sound)
    anchorType: "stone",
    originAt: "helm",       // the entity's origin is the helm (the craft's centre lies ahead of it)   // the anchor slot: stone, later iron
    propulsion: null,      // null = the plan's own tradition style; can be any learned style
    modules: [...(plan.fixedModules ?? [])],   // fitted modules (a Theran's are fitted for good at Strongyle)
    power: null,           // the power slot: null, "furnace", "smoker" or "blast_furnace"
  };
}

// ---------- entity properties ----------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round2 = (v) => Math.round(v * 100) / 100;

const warned = new Set();

export function applyRecord(entity, rec) {
  const plan = PLANS[rec.plan];
  const scale = plan.modelScale ?? 1;
  const mids = midsOf(rec, plan);
  const set = (k, v) => {
    try {
      setP(entity, k, v);
    } catch (e) {
      if (!warned.has(k)) {
        warned.add(k);
        console.warn(`[Shipwright] setProperty ${k} failed (further failures for it are silent): ${e}`);
      }
    }
  };
  set("stage", rec.stage);
  set("hull_scale", scale);
  set("mids", Math.round(mids));
  set("beam", round2(clamp(rec.dims.beam, 0.75, 1.5)));
  set("depth", round2(clamp(rec.dims.depth, 0.75, 1.5)));
  for (const z of ZONES) set(`wood_${z}`, Math.max(0, woodIndex(rec.sections[z].mat)));
  set("sail", !!rec.sections.rig.sail);
  set("sail_color", clamp(rec.sections.rig.color, 0, 15));
  set("rig_style", RIG_STYLES[rigStyleOf(rec, plan)]?.index ?? 1);
  set("rig_scale", rigScaleFor(rec, plan));
  set("rudder_type", rudderFor(plan, rec.dims.length) === "sternpost" ? 1 : 0);
  set("prop_style", PROP_INDEX[propulsionFor(rec, plan)] ?? 0);
  set("outrigger", !!plan.outrigger || (rec.modules ?? []).includes("outrigger"));
  // (the ship's boats she carries show on her model like modules: on deck, or hoisted astern)
  set("mods", modsBits([...(rec.modules ?? []), ...(rec.boats ?? []).map((b) => `boat_${b.mode}`)]));
  set("deck", deckBits(rec, plan));
  try {
    entity.triggerEvent(["hold", "deckhouse"].some((k) => (rec.modules ?? []).includes(k)) ? "shipwright:hold_on" : "shipwright:hold_off");
  } catch {
    /* hold is optional */
  }
  set("power_type", rec.power ? POWER[rec.power].type : 0);
  // Only the long-oar style has a model so far; other styles get theirs with the table screen.
  const pk = propulsionFor(rec, plan);
  set("oar_pairs", OARED.has(pk) ? (PROPULSION[pk].pairs ?? oarPairsFor(rec.dims.length, plan.modelScale ?? 1)) : 0);
  try {
    entity.triggerEvent(rec.dims.length >= plan.largeAtLength ? "shipwright:size_large" : "shipwright:size_small");
  } catch {
    /* size presets are optional */
  }
  applySeats(entity, rec);
}

/** Launched boats get their seats from the launched group, at the world's chosen seat height. */
export function applySeats(entity, rec, force = false) {
  if (rec.stage !== STAGES.LAUNCHED) return;
  if (!force && entity.getComponent("minecraft:rideable")) return;
  try {
    entity.triggerEvent("shipwright:launch");
    entity.triggerEvent(seatEvent(rec));
  } catch (e) {
    console.warn(`[Shipwright] Adding seats failed: ${e}`);
  }
}

export const SEAT_HEIGHTS = ["low", "mid", "high"];
/** The seat height every boat uses (calibrated in game with /scriptevent shipwright:seat low|mid|high). */
/** Mid sections drawn for a record: its length at the model's scale, less the two ends. */
export function midsOf(rec, plan = PLANS[rec.plan]) {
  const scale = plan.modelScale ?? 1;
  return clamp(Math.round(rec.dims.length / scale - 3), 1, plan.maxMids);
}

/** The seats-and-hit-areas group for this hull's length at the world's seat height. */
/** The seat set for a hull: its length, the world's seat calibration, and (on deep hulls) its depth band. */
export const seatBand = (rec) => {
  const bands = PROPORTIONS[rec.plan]?.seats;
  if (!bands || Object.keys(bands).length < 2) return "";
  const d = rec.dims?.depth ?? 1;
  return d < 0.9 ? "_lo" : d > 1.05 ? "_hi" : "";   // vision: the deep set past 1.05, where the law-deep hulls' (D-004) helm loses the horizon over the mid set
};
export const seatEvent = (rec, height = seatHeight()) => `shipwright:seats_${height}_${midsOf(rec)}${seatBand(rec)}`;

/** The craft's centre to its helm, and to each tip, in blocks (the entity's origin is the centre). */
export function hullSpan(rec, plan = PLANS[rec.plan]) {
  const scale = plan.modelScale ?? 1;
  const half = ((midsOf(rec, plan) + 3) * scale) / 2;
  return { half, helm: -(half - scale) };        // along the heading: + forward, - aft
}

/**
 * Where a boat's origin is. Boats are drawn and seated with the helm over the origin (the game turns
 * a ridden boat about its origin, so the helmsman never swings out of the hull). Boats built in
 * 0.9 and 0.10 had their origin at the craft's centre ("centred"); they're moved aft once, by the
 * helm-to-centre distance, so the hull stays exactly where it was.
 */
export function helmOrigin(entity, rec) {
  if (rec.originAt === "helm") return false;
  if (rec.centred) {
    const d = -hullSpan(rec).helm;               // centre to helm
    const yaw = (getP(entity, "yaw") ?? 0) * (Math.PI / 180);
    const p = entity.location;
    try {
      entity.teleport({ x: p.x + Math.sin(yaw) * d, y: p.y, z: p.z - Math.cos(yaw) * d }, { keepVelocity: false });
    } catch {
      return false;                               // try again next time
    }
  }
  rec.originAt = "helm";
  delete rec.centred;
  writeRecord(entity, rec);
  return true;
}
export const centreOrigin = helmOrigin;           // older name

/** Where to put a boat's origin (its helm) so its hull's centre lands at a spot, facing along dir. */
export function helmAt(centre, dir, rec) {
  const d = -hullSpan(rec).helm;                 // the helm is this far aft of the centre, along dir
  return { x: centre.x - dir.x * d, y: centre.y, z: centre.z - dir.z * d };
}

export function seatHeight() {
  try {
    const h = world.getDynamicProperty("shipwright:seat");
    return SEAT_HEIGHTS.includes(h) ? h : "mid";
  } catch {
    return "mid";
  }
}

// ---------- geometry helpers ----------

export function zoneLength(plan, zone, length) {
  return zone === "mid" ? length - 2 * plan.endLength : plan.endLength;
}

export function beamBlocks(plan, scale) {
  return plan.baseBeam * scale;
}

/** Beam scale range allowed for a given length by the plan's length:beam ratios. */
export function beamRange(plan, length) {
  const [rMin, rMax] = plan.lengthToBeam;
  const lo = Math.max(plan.beamScale[0], length / rMax / plan.baseBeam);
  const hi = Math.min(plan.beamScale[1], length / rMin / plan.baseBeam);
  return [round2(Math.min(lo, hi)), round2(Math.max(lo, hi))];
}

// ---------- costs ----------

const woodByKey = (key) => materialByKey(key);

export function keelCost(plan, length) {
  if (plan.keel === "bones") return [{ ids: ["minecraft:bone"], count: length, label: "Bone" }];
  const w = woodByKey(plan.keelWood);
  return [{ ids: w.logs, count: Math.ceil(length / 3), label: `${w.name} Log` }];
}

export function frameCost(plan, length) {
  if (plan.frame === "none") return [];
  if (plan.frame === "bones") return [{ ids: ["minecraft:bone"], count: 2 * length, label: "Bone" }];
  return [{ ids: [ITEMS.stick], count: 2 * length, label: "Stick" }];
}

export function zonePlanks(plan, zone, length, beam, depth) {
  return Math.ceil(zoneLength(plan, zone, length) * (1.5 * beam + 1.25 * depth));
}

/** What a zone's shell costs in a given material: planks, logs (4 planks each) or hides (2 planks' worth each). */
function shellCost(plan, zone, matKey, dims) {
  const n = zonePlanks(plan, zone, dims.length, dims.beam, dims.depth);
  const m = woodByKey(matKey);
  if (plan.shell === "hide") return { ids: [m.item], count: Math.ceil(n / 2), label: m.name };
  if (plan.shell === "logs") return { ids: m.logs, count: Math.ceil(n / 4), label: `${m.name} Log` };
  if (plan.shell === "bark") return { ids: m.logs, count: Math.ceil(n / 4), label: "Birch Log" };
  return { ids: [m.planks], count: n, label: `${m.name} Planks` };
}

export function plankCost(plan, woodKeysByZone, dims) {
  const costs = ZONES.map((z) => shellCost(plan, z, woodKeysByZone[z], dims));
  if (plan.fastening === "rivets") costs.push({ ids: [ITEMS.ironNugget], count: 2 * dims.length, label: "Iron Nugget" });
  if (plan.fastening === "string") costs.push({ ids: [ITEMS.string], count: dims.length, label: "String" });
  return costs;
}

/**
 * What a rig costs, from its actual size: a block of wool covers two square blocks of sail, the mast
 * takes a log per five blocks of height, rigging takes string by the mast's height, and junk
 * battens take bamboo by area. rec is optional (a plan's standard size is used without it).
 */
export function rigCost(plan, colorIdx, rec = null, style = null) {
  const w = woodByKey(plan.keelWood ?? "spruce") ?? woodByKey("spruce");
  const wool = WOOL[colorIdx];
  const r = rec ? rec : newRecord(plan, "cost", Math.round((plan.lengthRange[0] + plan.lengthRange[1]) / 2));
  const st = style ?? r.sections.rig?.style ?? plan.rigStyle ?? "square";
  const rig = rigFor({ ...r, sections: { ...r.sections, rig: { ...r.sections.rig, style: st } } }, plan);
  const costs = [
    { ids: w.logs ?? ["minecraft:spruce_log"], count: rig.count * Math.max(1, Math.ceil(rig.mast / 5)), label: `${w.name} Log` },
    { ids: [wool.item], count: Math.max(2, Math.ceil(rig.area / 2)), label: `${wool.name} Wool` },
    { ids: [ITEMS.string], count: rig.count * Math.max(2, Math.ceil(rig.mast * 0.8)), label: "String" },
  ];
  if (st === "junk") costs.push({ ids: ["minecraft:bamboo"], count: Math.ceil(rig.area / 3), label: "Bamboo" });
  return costs;
}

/** The materials a plan's shell can be made of. */
export function shellChoices(plan) {
  if (plan.shell === "hide") return SKINS;
  if (plan.shell === "logs") return [woodByKey(plan.keelWood)];
  if (plan.shell === "bark") return [woodByKey("birch_bark")];
  return WOODS;
}

// ---------- stats ----------

export function computeStats(rec) {
  const plan = PLANS[rec.plan];
  const L = rec.dims.length;
  const B = beamBlocks(plan, rec.dims.beam);
  const D = plan.baseDepth * rec.dims.depth;
  const feet = L * 3.28; // one block treated as one meter
  return {
    hullSpeed: 1.34 * Math.sqrt(feet),
    ratio: L / B,
    stability: B / L,
    cargo: Math.max(1, Math.round(L * B * D * plan.fullness * 2)),
    turning: L * 0.8,
    draft: D * 0.6,
    beamBlocks: B,
  };
}

export function originalPercent(rec) {
  const parts = Object.entries(rec.sections).filter(([k, s]) => k !== "rig" || s.sail);
  const orig = parts.filter(([, s]) => s.original).length;
  return Math.round((orig / parts.length) * 100);
}

function soundingsLine(rec) {
  const d = Object.values(rec.log?.soundings ?? {});
  if (!d.length) return [];
  return [`Ship's log: ${d.length} area${d.length === 1 ? "" : "s"} sounded, shallowest ${Math.min(...d)} blocks`];
}

export function describeShip(rec) {
  const plan = PLANS[rec.plan];
  const s = computeStats(rec);
  const wood = (k) => woodByKey(rec.sections[k].mat)?.name ?? rec.sections[k].mat;
  const mark = (k) => (rec.sections[k].original ? "" : " §7(replaced)§r");
  const lines = [
    `§l${rec.name || "Unnamed"}§r, a ${plan.name}`,
    rec.launchedDay != null ? `Launched on day ${rec.launchedDay}` : `Under construction (stage ${rec.stage} of 4)`,
    "",
    `Length ${rec.dims.length} blocks, beam ${s.beamBlocks.toFixed(2)}, length to beam ${s.ratio.toFixed(1)} : 1`,
    ...describeHandling(computeHandling(rec)),
    `Cargo ${s.cargo} slots`,
    ...soundingsLine(rec),
    "",
    `Keel: ${wood("keel")}${mark("keel")}`,
    `Bow: ${wood("bow")}${mark("bow")}`,
    `Midship: ${wood("mid")}${mark("mid")}`,
    `Stern: ${wood("stern")}${mark("stern")}`,
    rec.sections.rig.sail ? `Sail: ${WOOL[rec.sections.rig.color].name} wool` : "Sail: none (oars only)",
    "",
    `Condition: bow ${Math.round(rec.condition.bow * 100)}%, midship ${Math.round(rec.condition.mid * 100)}%, stern ${Math.round(rec.condition.stern * 100)}%${rec.sections.rig.sail ? `, sail ${Math.round(rec.condition.sail * 100)}%` : ""}`,
    `Original material: ${originalPercent(rec)}%`,
    "Hold: sneak and use the boat. Your own sea chest comes up on deck whenever you're aboard",
    `Distance sailed: ${Math.round(rec.log.distance)} blocks, refits: ${rec.log.refits}`,
    "",
  ];
  return lines.join("\n");
}

// ---------- refunds on break ----------

const shipCache = new Map(); // entity id -> { dimId, location, refunds }

function refundList(rec) {
  if (rec.stage < STAGES.PLANKED) return [];
  const plan = PLANS[rec.plan];
  const out = ZONES.map((z) => {
    const c = shellCost(plan, z, rec.sections[z].mat, rec.dims);
    return { item: c.ids[0], count: Math.floor(c.count / 2) };
  });
  const shields = (rec.shields ?? []).filter(Boolean).length;      // every shield aboard comes back whole
  if (shields) out.push({ item: "minecraft:shield", count: shields });
  return out;
}

export function rememberShip(entity, rec) {
  try {
    shipCache.set(entity.id, { dimId: entity.dimension.id, location: entity.location, refunds: refundList(rec) });
  } catch {
    /* entity may be unloading */
  }
}

export function updateShipLocation(entity) {
  const c = shipCache.get(entity.id);
  if (c) c.location = entity.location;
}

export function refundBrokenShip(entity) {
  let entry = null;
  try {
    const rec = readRecord(entity);
    if (rec) entry = { dimId: entity.dimension.id, location: entity.location, refunds: refundList(rec) };
  } catch {
    /* fall back to the cache */
  }
  entry = entry ?? shipCache.get(entity.id);
  shipCache.delete(entity.id);
  if (!entry) return;
  const dim = world.getDimension(entry.dimId);
  for (const r of entry.refunds) dropItems(dim, entry.location, r.item, r.count);
}

// ---------- refit ----------

/** Replace one hull zone's planking. Returns { costs, refund } for the change. */
export function refitPlan(rec, zone, newWoodKey) {
  const plan = PLANS[rec.plan];
  const add = shellCost(plan, zone, newWoodKey, rec.dims);
  const old = shellCost(plan, zone, rec.sections[zone].mat, rec.dims);
  return { costs: [add], refund: { item: old.ids[0], count: Math.floor(old.count / 2) } };
}

export function applyRefit(entity, rec, zone, newWoodKey) {
  rec.sections[zone] = { mat: newWoodKey, original: false };
  rec.log.refits += 1;
  writeRecord(entity, rec);
  applyRecord(entity, rec);
}

/** Reapplies the record if the entity's properties have drifted (for example after a pack reload). */
export function healProperties(entity) {
  const rec = readRecord(entity);
  if (!rec) return false;
  let stage;
  try {
    stage = entity.getProperty("shipwright:stage");
  } catch {
    return false;
  }
  if (stage === rec.stage) return false;
  applyRecord(entity, rec);
  return true;
}

export const LAUNCHED_TAG = "shipwright_launched";
/** The heading a boat under construction is held at (she never turns on the stocks). */
export const BUILD_YAW = "shipwright:buildYaw";

/** Makes sure a launched boat is tagged and has its seats (for boats from older versions or after a restart). */
export function ensureLaunchedState(entity, rec = readRecord(entity)) {
  if (rec && rec.originAt !== "helm") helmOrigin(entity, rec);
  if (!rec || rec.stage !== STAGES.LAUNCHED) return false;
  try {
    if (!entity.hasTag(LAUNCHED_TAG)) entity.addTag(LAUNCHED_TAG);
  } catch {
    /* tags are optional */
  }
  const hasSeats = !!entity.getComponent("minecraft:rideable");
  applySeats(entity, rec, !hasSeats);
  return !hasSeats;
}

export const seatEventFor = (entity) => (entity.getComponent("minecraft:rideable") ? "launched seats" : "none");

// ---------- modules ----------

/** Module slots by hull size: small 2, medium 3, large 4 (5 with a full deck, later). */
export const moduleSlots = (rec) => (rec.dims.length <= 10 ? 2 : rec.dims.length <= 24 ? 3 : 4);
export const hasModule = (rec, key) => (rec.modules ?? []).includes(key);

// Fitted modules drawn on the boat, as bits of the shipwright:mods property (mirrored in tools/gen_boats.py).
export const MODULE_BITS = { shield_rail: 0, ram: 1, ice_runners: 3, crossbow: 4, full_deck: 5, sewn_hull: 6, bulkheads: 7, light_hull: 8, boat_deck: 9, boat_stern: 10 };

// Deck modules drawn at their stations: a code per hull section, 4 bits each (mirrored in tools/gen_boats.py).
export const DECK_CODES = { hold: 1, benches: 2, canopy: 3, navigation: 4, bunk: 5, castle: 6, deckhouse: 7, lookout: 8, cannon: 9, diving_bell: 10 };
export const DECK_BASE = 16;

/** Packs the deck layout for the model: which deck module stands at each hull section. */
export function deckBits(rec, plan) {
  const deck = (rec.modules ?? []).filter((k) => MODULES[k]?.category === "deck").map((k) => ({ key: k, ...MODULES[k] }));
  const { placed } = layoutDeck(rec, plan, deck);
  const scale = plan.modelScale ?? 1;
  const mids = Math.max(1, Math.round(rec.dims.length / scale - 3));
  let bits = 0;
  for (const p of placed) {
    const code = DECK_CODES[p.key];
    if (!code) continue;
    for (let st = p.station; st < p.station + p.footprint; st++) {
      const i = Math.floor(st / scale);
      if (i >= mids || i >= 7) break;
      const pv = DECK_BASE ** i;
      bits = bits - (Math.floor(bits / pv) % DECK_BASE) * pv + code * pv;
    }
  }
  return bits;
}
export const modsBits = (mods) => mods.reduce((n, m) => (m in MODULE_BITS ? n | (1 << MODULE_BITS[m]) : n), 0);

// ---------- the power slot ----------

export const powerCost = (key) => [
  { ids: [POWER[key].item], count: 1, label: POWER[key].name },
  { ids: ["minecraft:iron_ingot"], count: CRANK_IRON, label: "Iron Ingot" },
];
export const powerRefund = (key) => [
  { item: POWER[key].item, count: 1 },
  { item: "minecraft:iron_ingot", count: Math.floor(CRANK_IRON / 2) },
];

export function setPower(entity, rec, key) {
  rec.power = key;
  writeRecord(entity, rec);
  applyRecord(entity, rec);
}

export function fitModule(entity, rec, key) {
  rec.modules = [...(rec.modules ?? []), key];
  writeRecord(entity, rec);
  applyRecord(entity, rec);
}

export function removeModule(entity, rec, key) {
  const i = (rec.modules ?? []).indexOf(key);
  if (i >= 0) rec.modules.splice(i, 1);
  writeRecord(entity, rec);
  applyRecord(entity, rec);
}

// ---------- the sea chest ----------

/** The boat's own storage (the entity inventory). */
export function seaChest(entity) {
  try {
    return entity.getComponent("minecraft:inventory")?.container ?? null;
  } catch {
    return null;
  }
}

/** How full the sea chest is, 0 to 1, counting each slot by how full its stack is. */
export function chestLoad(entity) {
  const c = seaChest(entity);
  if (!c || !c.size) return 0;
  let load = 0;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it) load += Math.min(1, it.amount / (it.maxAmount ?? 64));
  }
  return load / c.size;
}

// ---------- wear and repair ----------

export const SEA_REPAIR_CAP = 0.75;   // patching at sea gets a section back to three-quarters; a yard restores it fully

/** The hull section in worst shape. */
export function worstZone(rec) {
  return ZONES.reduce((a, z) => (rec.condition[z] < rec.condition[a] ? z : a), "bow");
}

export const hullCondition = (rec) => ZONES.reduce((n, z) => n + rec.condition[z], 0) / ZONES.length;

/** What a full yard repair costs: shell material in proportion to the damage, plus wool for the sail. */
export function yardRepairCost(rec) {
  const plan = PLANS[rec.plan];
  const costs = [];
  for (const z of ZONES) {
    const miss = 1 - rec.condition[z];
    if (miss <= 0.01) continue;
    const c = shellCost(plan, z, rec.sections[z].mat, rec.dims);
    costs.push({ ...c, count: Math.max(1, Math.ceil(c.count * miss)) });
  }
  if (rec.sections.rig?.sail && rec.condition.sail < 0.99) {
    costs.push({ ids: [WOOL[rec.sections.rig.color].item], count: Math.max(1, Math.ceil(3 * (1 - rec.condition.sail))), label: `${WOOL[rec.sections.rig.color].name} Wool` });
  }
  return costs;
}

/** Item ids that patch a hull section at sea: the material it's made of. */
export function patchItems(rec, zone) {
  return shellCost(PLANS[rec.plan], zone, rec.sections[zone].mat, rec.dims).ids;
}

// ---------- typical proportions ----------

/** Beam scale for a length at the tradition's typical length-to-beam ratio, within the plan's range. */
export function typicalBeam(plan, length) {
  const [lo, hi] = beamRange(plan, length);
  const want = length / (plan.typicalLB ?? 4) / plan.baseBeam;
  return Math.round(Math.min(hi, Math.max(lo, want)) * 100) / 100;
}

/** Short, Typical and Long sizes for a plan within a yard's length, each at typical proportions. */
export function sizePresets(plan, yardMax) {
  const step = plan.lengthStep ?? 1;
  const [min, planMax] = plan.lengthRange;
  const max = Math.min(planMax, yardMax);
  const snap = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const out = [];
  for (const [label, L] of [["Short", min], ["Typical", snap((min + max) / 2)], ["Long", max]]) {
    if (out.some((o) => o.length === L)) continue;
    out.push({ label, length: L, beam: typicalBeam(plan, L), depth: 1 });
  }
  return out;
}
