import { bodyOf } from "./body.js";
import { decksFor, topDeckUp, hullDepth } from "./grid.js";
// Turns a ship record into handling numbers. Everything comes from how the
// boat was built: length, beam, depth, the wood in each zone, and the rig.
// Units: speeds in blocks per tick, turn rates in degrees per tick.
import { PLANS } from "./config/plans.js";
import { WOODS, MATERIALS, RIG_STYLES } from "./config/materials.js";
import { PROPORTIONS } from "./config/proportions.js";
import { coreHull, pullBpt, hullBpt } from "./ourmath.js";

export const KNOTS_TO_BPT = 0.045;     // 6.4 knots -> about 5.8 blocks per second
const BASE_ACCEL = 0.006;
const BASE_TURN = 3.4;                 // a 6-block, average-beam, average-weight hull
const REFERENCE_DENSITY = 600;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Rudders are fixed by the boat: small hulls steer with an oar on the starboard quarter,
// bigger plank hulls with a rudder hung on the sternpost.
//   low:  turning bite at low and moderate speed      high: bite kept at full speed
//   draft: extra depth the rudder hangs below the keel (a steering oar can be lifted)
export const RUDDERS = {
  steering_oar: { name: "a steering oar on the starboard quarter", low: 1.1, high: 0.85, draft: 0 },
  sternpost: { name: "a sternpost rudder", low: 0.85, high: 1.15, draft: 0.3 },
};
/** Oar pairs by hull length, for the long-oar style. */
/** One pair of oars per two blocks of hull between the ends (in the model's own scale), up to 4. */
export const oarPairsFor = (L, modelScale = 1) => clamp(Math.floor((L / modelScale - 2) / 2), 1, 4);

// Propulsion is a piece of every boat, like the hull and the sail: one style per boat,
// learned from a tradition and fitted to any hull.
//   accel, top: multipliers on rowing acceleration and top speed
//   pivot: turning at a standstill   reverse: share of top speed going astern
export const PROPULSION = {
  oars: { name: "long oars", accel: 1.0, top: 1.0, pivot: 0.6, reverse: 0.3 },
  paddles: { name: "single-bladed paddles", accel: 1.25, top: 0.85, pivot: 1.0, reverse: 0.5 },
  double_paddle: { name: "a double-bladed paddle", accel: 1.4, top: 0.95, pivot: 1.1, reverse: 0.6, bestUpTo: 6 },
  scull: { name: "a sculling oar over the stern", accel: 0.8, top: 0.8, pivot: 0.9, reverse: 0.4 },
  pole: { name: "a punting pole", accel: 1.2, top: 0.7, pivot: 0.8, reverse: 0.9, maxDepth: 3 },
  // A great sailing ship's sweeps: a couple of long oars each side, several hands to each, worked
  // from the deck to get her in and out of harbour or through a calm. Slow, but they move her.
  sweeps: { name: "sweeps worked from the deck", accel: 0.55, top: 0.45, pivot: 0.45, reverse: 0.25, pairs: 2 },
};
/** Propulsion drawn with oars (and worked by the oar linkage under power). */
export const OARED = new Set(["oars", "sweeps"]);
export const TRADITION_PROPULSION = {
  norse: "oars", european: "oars", indian_ocean: "oars",
  birchbark: "paddles", pacific: "paddles", dugout: "paddles",
  east_asian: "scull", japanese: "scull",
  arctic: "double_paddle", shallow: "pole", therans: "paddles", league: "oars",
};
export const propulsionFor = (rec, plan) => rec.propulsion ?? plan.propulsion ?? TRADITION_PROPULSION[plan.tradition] ?? "oars";

/** Hands aboard, as a multiplier on what rowing and sail handling can do: grows with a great ship. */
export const hands = (plan, L) => ((plan.modelScale ?? 1) >= 4 ? Math.max(1, L / 8) : 1);

/** The rail's height above the origin for this build (blocks), from the model. */
export const railOf = (rec, plan) => {
  const r = PROPORTIONS[plan.id]?.rail ?? 1;
  return 5 / 16 + (r - 5 / 16) * (rec.dims?.depth ?? 1);
};
const WATERLINE = 0.4;
const FLOAT_FREEBOARD = 0.3;   // vision: how far a float's top stands over the water at rest (blocks)
/** Heel at which the lee rail would reach the water (with a margin), degrees, 3 to 25. */
export function heelLimitFor(rec, plan, halfWidth) {
  const free = railOf(rec, plan) - WATERLINE - 0.15;
  const a = (Math.atan2(Math.max(0, free), Math.max(0.3, halfWidth)) * 180) / Math.PI;
  return Math.max(3, Math.min(25, a * 0.9));
}

export const rudderFor = (plan, L) => plan.rudder ?? (L <= 10 ? "steering_oar" : "sternpost");
const density = (key) => MATERIALS.find((w) => w.key === key)?.density ?? REFERENCE_DENSITY;

// Sail area / displacement^(2/3): the dimensionless ratio naval architects use to size a rig. Our
// blocky hulls displace more than real boats of their length, so these run lower than real-world
// figures; calibrated so a 6-block faering carries a sail about twice its beam.
// Each sail type's area: against the hull's displacement (SAIL_RATIO, of V^2/3) and at least a share of its length
// squared (SAIL_PER_L2). A square sail drives hard for its cloth and carries the least; the fore-and-aft rigs need
// more cloth for the same push off the wind; the crab claw, a great loose kite, the most; the Theran wing, rigid and
// slotted, the least of all, and it draws more from each square block (SAIL_EFF).
export const SAIL_RATIO = { square: 5.5, lateen: 6.5, crab_claw: 7, junk: 6, wing: 4.5 };   // vision: each type's cloth for its push
const SAIL_RATIO_REF = 6;   // the ratio that sails at "standard" drive
export const SAIL_PER_L2 = { square: 0.18, lateen: 0.22, crab_claw: 0.24, junk: 0.2, wing: 0.15 };   // vision: the least cloth for a length
export const SAIL_EFF = { wing: 1.45 };   // vision: a rigid slotted wing draws more from each square block
const IMMERSED = 0.55;         // share of the hull's depth below the waterline

/** Displacement in cubic blocks: length x beam x draft x fullness (block coefficient). */
export function displacement(rec, plan) {
  const B = plan.baseBeam * rec.dims.beam;
  const T = plan.baseDepth * rec.dims.depth * IMMERSED;
  return rec.dims.length * B * T * plan.fullness;
}

/**
 * How big a rig this hull carries: the size that gives its rig family's sail-area/displacement ratio,
 * relative to the model's own rig (whose area at scale 1 is measured from the model).
 */
export function rigFor(rec, plan) {
  const style = rec.sections.rig?.style ?? plan.rigStyle ?? "square";
  const m = plan.modelScale ?? 1;
  const base = (PROPORTIONS[plan.id]?.sail?.[style] ?? 2.5) * m * m;   // area at rig scale 1
  // Twin hulls both displace; and a long hull never carries less than SAIL_PER_L2 of its length squared,
  // so slim, light hulls (canoes, catamarans) still get a rig that suits their length.
  const V23 = Math.pow(displacement(rec, plan) * (plan.twin ? 2 : 1), 2 / 3);
  const target = Math.max((SAIL_RATIO[style] ?? 12) * V23, (SAIL_PER_L2[style] ?? 0.2) * rec.dims.length ** 2) * (plan.sailShare ?? 1);   // vision: a galley's sail is a share of a sailer's
  const scale = Math.round(clamp(Math.sqrt(target / base), 0.6, 3.0) * 100) / 100;
  const area = base * scale * scale;
  const mast = (PROPORTIONS[plan.id]?.masts?.[style] ?? PROPORTIONS[plan.id]?.mast ?? 2.6) * m * scale;
  const count = PROPORTIONS[plan.id]?.mast_count ?? 1;   // the area is shared across this many masts
  return { style, scale, area, mast, count, drive: clamp((area * (SAIL_EFF[style] ?? 1)) / V23 / SAIL_RATIO_REF, 0.6, 1.6) };
}

export const rigScaleFor = (rec, plan) => rigFor(rec, plan).scale;

/** load: how full the sea chest is (0 to 1); a full chest adds about a third to the boat's weight. */
export function computeHandling(rec, load = 0, crew = 0) {
  const plan = PLANS[rec.plan];
  const L = rec.dims.length;
  const B = plan.baseBeam * rec.dims.beam;
  const D = plan.baseDepth * rec.dims.depth;
  const ratio = L / B;

  // Weight: shell area times the zone-weighted wood density, plus the rig.
  const endL = plan.endLength;
  const midL = L - 2 * endL;
  const avgDensity =
    (density(rec.sections.bow.mat) * endL + density(rec.sections.mid.mat) * midL + density(rec.sections.stern.mat) * endL) / L;
  const shell = L * (B + 2 * D);
  const referenceShell = 6 * (1.5 + 2 * 0.8);
  const sail = !!rec.sections.rig?.sail;
  const hullMass = (shell / referenceShell) * (avgDensity / REFERENCE_DENSITY) * (L / 6) ** -0.5;
  const mods = rec.modules ?? [];
  const outrigger = !!plan.outrigger || !!plan.twin || mods.includes("outrigger");   // twin hulls steady like an outrigger
  // The ship is the sum of its parts: hull, rig, every module, the sea chest's load, the crew aboard.
  const body = bodyOf({
    hull: { mass: hullMass, beam: B, depth: D, length: L, ratio, twin: !!plan.twin },
    sail, modules: [...mods, ...(plan.outrigger && !mods.includes("outrigger") ? ["outrigger"] : [])], load, crew,
  });
  const weight = body.mass;

  const hullSpeedKnots = 1.34 * Math.sqrt(L * 3.28);
  const rudderKey = rudderFor(plan, L);
  const rudder = RUDDERS[rudderKey];
  const depthTurn = (0.8 / D) ** 0.25;   // a deeper hull resists turning a little
  const propKey = propulsionFor(rec, plan);
  const prop = PROPULSION[propKey];
  const oarPairs = OARED.has(propKey) ? (prop.pairs ?? oarPairsFor(L, plan.modelScale ?? 1)) : 0;
  const rowPower = propKey === "oars" ? 0.7 + 0.15 * oarPairs : 1;   // more oars pull harder
  // A double paddle is made for short hulls; it loses punch on long ones.
  const reach = prop.bestUpTo && L > prop.bestUpTo ? Math.sqrt(prop.bestUpTo / L) : 1;
  const slenderness = clamp(0.85 + 0.05 * (ratio - 4), 0.8, 1.1);
  const max = hullSpeedKnots * KNOTS_TO_BPT * slenderness * clamp(1 - 0.06 * (weight - 1), 0.8, 1.05) * prop.top * reach;

  const rig = rigFor(rec, plan);
  const benches = mods.filter((m) => m === "benches").length;
  // Where the hull is, measured from the craft's centre (the entity's origin): along the heading
  // (+ forward), and across it (+ starboard). Twin hulls sit either side of the centre; an outrigger
  // float lies out to port.
  const ms = plan.modelScale ?? 1;
  const mids = Math.min(plan.maxMids ?? 7, Math.max(1, Math.round(rec.dims.length / ms - 3)));
  const half = ((mids + 3) * ms) / 2;
  const pr = PROPORTIONS[plan.id] ?? {};
  const gap = (pr.twin_gap ?? 0) * ms;
  const lenScale = Math.min(1.4, Math.max(0.6, (mids + 3) / (pr.typical_len ?? mids + 3)));
  const floatFitted = !plan.twin && (!!plan.outrigger || mods.includes("outrigger"));
  const out = {
    half,                                       // centre to bow tip, and to stern tip
    helmAt: -(half - ms),                       // the helm, aft of centre
    hullLines: plan.twin ? [-gap / 2, gap / 2] : [0],
    decks: decksFor(rec, plan),
    deckUp: topDeckUp(rec, plan),               // the walked top deck, blocks above the water block
    // Each mast's place along the hull from the centre (+ forward), where the model steps it.
    mastsAt: sail ? (pr.mast_at ?? [0]).map((f) => -f * 2 * half) : [],
    float: floatFitted ? { across: -(pr.float_out ?? 2) * ms, half: ((pr.float_len ?? 4) * ms * lenScale) / 2 } : null,
    overallHalfWidth: (gap + plan.baseBeam * rec.dims.beam) / 2,
    beamEach: plan.baseBeam * rec.dims.beam,     // one hull's beam (a twin has two)
    rail: railOf(rec, plan),                     // the rail above the origin
    benchPull: 1 + 0.15 * benches,       // each Benches module adds rowers' pull
    navigation: mods.includes("navigation"),
    lookout: mods.includes("lookout"),
    modelScale: plan.modelScale ?? 1,
    rigScale: rig.scale,
    sailArea: rig.area,
    sailDrive: rig.drive,     // sail area against displacement: big canvas on a light hull is lively
    sail,
    rig: RIG_STYLES[rec.sections.rig?.style]?.family ?? rec.sections.rig?.family ?? plan.rigFamily ?? "square",
    outrigger,
    iceRunners: mods.includes("ice_runners"),
    sewnSeams: mods.includes("sewn_hull"),
    oneTrunk: plan.shell === "logs",
    length: L,
    beam: B,
    depth: D,
    weight,
    hullSpeedKnots,
    max,
    propulsion: propKey,
    power: rec.power ?? null,
    oarPairs,
    reverse: prop.reverse,
    poleDepth: prop.maxDepth ?? null,
    // A great ship has many hands (on the sweeps, the halyards, the braces): her crew grows with her.
    accel: ((BASE_ACCEL * Math.sqrt(6 / L)) / weight ** 0.7) * (sail ? 0.95 : 1) * rowPower * prop.accel * reach * hands(plan, L),
    stability: body.righting,                          // resists heel: hull form, where the weight sits, any float
    // The most a hull may heel and keep its lee rail out of the water (it carries what it can't).
    heelLimit: heelLimitFor(rec, plan, ((plan.twin ? (pr.twin_gap ?? 0) * (plan.modelScale ?? 1) : 0) + plan.baseBeam * rec.dims.beam) / 2),
    // toward the float, she stops where its top would reach the water: the float's freeboard over its arm
    floatHeel: !plan.twin && (plan.outrigger || mods.includes("outrigger"))
      ? Math.max(3, ((Math.asin(Math.min(1, FLOAT_FREEBOARD / Math.max(0.5, (pr.float_out ?? 2) * (plan.modelScale ?? 1)))) * 180) / Math.PI) * 0.9)   // vision: a margin below the float's top
      : null,
    body,                                              // the parts it's summed from (inspect, tests)
    coastDrag: 1 - 0.04 / Math.sqrt(weight),          // (older saves and tests) per tick, no throttle
    // Water friction (laws.waterDrag): wave-making falls off with length (long hulls slip through),
    // and both parts with weight (a heavy hull carries her way).
    dragQuad: (0.035 * (6 / L) ** 0.2) / weight ** 0.1,
    dragLin: 0.006 / weight ** 0.35,
    dragConst: 0.0005 / Math.sqrt(weight),
    rudder: rudderKey,
    turnMax: (BASE_TURN * (6 / L) ** 0.75 * clamp(B / 1.5, 0.8, 1.25) ** 0.5) / weight ** 0.3 * (sail ? 0.95 : 1) * rudder.low * depthTurn,
    turnFalloff: clamp((0.4 + 0.02 * (ratio - 4)) * (2 - rudder.high), 0.25, 0.6), // how much turning fades at full speed
    restTurn: 0.6 * prop.pivot,                        // pivoting at a standstill, set by the propulsion style
    grip: clamp(0.2 + 0.3 * (D / 0.8) + (outrigger ? 0.15 : 0), 0.15, 0.8),   // share of sideways skid removed per tick
    draft: D * 0.6 + 0.2 + rudder.draft,               // blocks of water needed under the hull and rudder
  };
  // Waterworld's math (ourmath.js, core/boat.js): her crew's speed, her sail's, the water's drag and her heel
  // come from the core hull built from these same numbers, so the helm sails as the trials say she should
  out.mast = rig.mast;   // the rig she would carry: the heel law reads it whenever a sail draws
  out.core = coreHull(out, { fullness: plan.fullness, twin: !!plan.twin, outrigger: floatFitted, benchPull: out.benchPull });
  out.max = pullBpt(out.core) * (prop.top ?? 1) * reach;
  out.hullSpeedBpt = hullBpt(out.core);
  return out;
}

/** Turn rate (degrees per tick) at a given speed: strongest slow, fading as speed builds. */
export function turnRateAt(h, speed) {
  const v = Math.abs(speed);
  const paddling = h.turnMax * h.restTurn;                    // pivoting with the oars, no way on
  const bite = Math.min(1, v / (0.15 * h.max));               // the rudder needs water flowing past it
  const rudder = h.turnMax * bite * (1 - h.turnFalloff * Math.min(1, v / h.max) ** 1.2);
  return Math.max(paddling, rudder);
}

/** Turning circle radius in blocks at a fraction of top speed. */
export function turningRadius(h, fraction) {
  const v = h.max * fraction;
  const omega = (turnRateAt(h, v) * Math.PI) / 180;
  return omega > 0 ? v / omega : Infinity;
}

const rating = (x, words) => words[Math.min(words.length - 1, Math.max(0, Math.floor(x)))];

/** Plain-language handling summary for the inspect screen. */
export function describeHandling(h) {
  return [
    `Top speed about ${(h.max / KNOTS_TO_BPT).toFixed(1)} knots, ${rating(h.accel / 0.0015, ["sluggish", "slow", "steady", "brisk", "quick"])} off the mark`,
    `Turning circle about ${turningRadius(h, 0.3).toFixed(0)} blocks slow, ${turningRadius(h, 1).toFixed(0)} at full speed`,
    `Grip in turns: ${rating(h.grip / 0.12, ["loose", "light", "fair", "firm", "firm"])}; weight ${h.weight.toFixed(2)}`,
    `Draft ${h.draft.toFixed(1)} blocks; safe in ${Math.max(1, Math.ceil(h.draft + 0.25))} or more blocks of water`,
    `Steered by ${RUDDERS[h.rudder].name}; driven by ${PROPULSION[h.propulsion].name}${h.oarPairs ? ` (${h.oarPairs} pair${h.oarPairs > 1 ? "s" : ""})` : ""}`,
  ];
}
