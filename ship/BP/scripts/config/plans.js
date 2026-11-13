// Pure data. One entry per buildable plan. Code never hardcodes a boat.
// Looks (hull profile) live in tools/gen_assets.py; this file is how each boat builds and handles.
//
//   shell: "planks" (choose a wood per zone), "logs" (carved from the plan's wood), "hide" (leather or rabbit hide)
//          or "bark" (birch bark, for the bark canoe)
//   typicalLB: the tradition's typical length-to-beam ratio for this boat (the ratio guide), used
//          for the Short / Typical / Long sizes; Advanced lets the player set length, beam and depth
//   rigStyle: the look of the tradition's own sail (square, lateen, crab_claw, junk); rigFamily its physics
//   keel/frame: what the keel and frames are made of ("logs" of the plan's wood, "sticks", or "bones")
//   fastening: "rivets" (iron nuggets), "string" (sewn) or "none"
//   rigFamily: the sail this tradition carries ("square" or "fore_and_aft"); null = no sail

import { PROPORTIONS } from "./proportions.js";
import { FLEETS } from "../../world/boatsizes.js";
import { hullOf } from "../../core/boat.js";
import { PHI } from "../../core/golden.js";

const base = {
  yardLevel: 1,
  endLength: 1.5,           // bow and stern, blocks each
  maxMids: 7,
  beamScale: [0.75, 1.5],
  depthScale: [0.75, 1.5],
  largeAtLength: 7,         // collision preset switches to large at this length
  shell: "planks",
  modelScale: 1,            // the model is drawn at this scale (2 for a longship)
  lengthStep: 1,
  keel: "logs",
  frame: "sticks",
  fastening: "none",
};

// Beam and depth come from the model itself (outside the planking), so physics matches what you see.
// A longship's model is drawn at twice the size every way (D-004: true depth); a ship-class model shows up to 8
// mid sections, so the ship class reaches its plans' 22 blocks.
const plan = (p) => {
  const full = { ...base, ...p, entity: `shipwright:${p.id}` };
  const m = full.modelScale;
  const dims = PROPORTIONS[p.id];
  if (dims) {
    full.baseBeam = dims.beam * m;
    full.baseDepth = dims.depth * m;
  }
  full.maxMids = p.maxMids ?? (m === 2 ? 8 : base.maxMids);   // derived: ceil(22 / 2) - 3 (tools/gen_boats.py max_mids)
  return full;
};

export const PLANS = {
  faering: plan({
    id: "faering", name: "Faering", typicalLB: 4.25, tradition: "norse", keelWood: "spruce",
    lengthRange: [4, 10], lengthToBeam: [2.5, 7],
    fullness: 0.45, rigFamily: "square", rigStyle: "square", fastening: "rivets",
  }),
  rowboat: plan({
    id: "rowboat", name: "Rowboat", typicalLB: 3.25, tradition: "european", keelWood: "oak",
    lengthRange: [4, 7], lengthToBeam: [2.5, 5],
    fullness: 0.55, rigFamily: "square", rigStyle: "square", fastening: "rivets",
  }),
  bark_canoe: plan({
    id: "bark_canoe", name: "Bark Canoe", typicalLB: 5.75, tradition: "birchbark", keelWood: "birch",
    lengthRange: [4, 8], lengthToBeam: [3.5, 7],
    fullness: 0.4, rigFamily: null, fastening: "string", shell: "bark",
  }),
  outrigger: plan({
    id: "outrigger", name: "Outrigger Canoe", typicalLB: 7, tradition: "pacific", keelWood: "jungle",
    lengthRange: [5, 9], lengthToBeam: [4, 8.5],
    fullness: 0.35, rigFamily: "fore_and_aft", rigStyle: "crab_claw", fastening: "string", outrigger: true,
  }),
  sewn_boat: plan({
    id: "sewn_boat", name: "Sewn Boat", typicalLB: 3.75, tradition: "indian_ocean", keelWood: "acacia",
    lengthRange: [5, 10], lengthToBeam: [3, 6.5],
    fullness: 0.5, rigFamily: "fore_and_aft", rigStyle: "lateen", fastening: "string",
  }),
  sampan: plan({
    id: "sampan", name: "Sampan", typicalLB: 3.25, tradition: "east_asian", keelWood: "bamboo",
    lengthRange: [4, 8], lengthToBeam: [2.5, 5],
    fullness: 0.6, rigFamily: "fore_and_aft", rigStyle: "junk",
  }),
  wasen: plan({
    id: "wasen", name: "Wasen", typicalLB: 4.5, tradition: "japanese", keelWood: "cherry",
    lengthRange: [5, 9], lengthToBeam: [3, 6],
    fullness: 0.5, rigFamily: "square", rigStyle: "square",
  }),
  dugout: plan({
    id: "dugout", name: "Dugout", typicalLB: 6, tradition: "dugout", keelWood: "dark_oak",
    lengthRange: [4, 9], lengthToBeam: [3, 7],
    fullness: 0.4, rigFamily: null, shell: "logs", frame: "none",
  }),
  punt: plan({
    id: "punt", name: "Punt", typicalLB: 4.5, tradition: "shallow", keelWood: "mangrove",
    lengthRange: [4, 8], lengthToBeam: [2.5, 5],
    fullness: 0.7, rigFamily: null,
  }),
  // Phase 2: medium hulls, built at a slipway.
  longship: plan({
    id: "longship", name: "Longship", typicalLB: 6.75, tradition: "norse", keelWood: "spruce", yardLevel: 2,
    modelScale: 2, endLength: 3,   // the faering's lines at twice the size
    lengthRange: [12, 20], lengthStep: 2, lengthToBeam: [4, 8],
    fullness: 0.4, rigFamily: "square", rigStyle: "square", fastening: "rivets", rudder: "steering_oar", largeAtLength: 0,
  }),
  // Phase 2: medium hulls, built at a dock, drawn at twice the size (1.4 times as tall).
  cog: plan({
    id: "cog", name: "Cog", typicalLB: 3.15, tradition: "european", keelWood: "oak", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 22], lengthStep: 2, lengthToBeam: [2.8, 3.8], fullness: 0.6,
    rigFamily: "square", rigStyle: "square", fastening: "rivets", rudder: "sternpost", largeAtLength: 0,
  }),
  freight_canoe: plan({
    id: "freight_canoe", name: "Freight Canoe", typicalLB: 6, tradition: "birchbark", keelWood: "birch", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 18], lengthStep: 2, lengthToBeam: [4.5, 7.5], fullness: 0.42,
    rigFamily: null, fastening: "string", shell: "bark", rudder: "steering_oar", largeAtLength: 0,
  }),
  voyaging_canoe: plan({
    id: "voyaging_canoe", name: "Voyaging Canoe", typicalLB: 7.5, tradition: "pacific", keelWood: "jungle", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 22], lengthStep: 2, lengthToBeam: [5.5, 10], fullness: 0.36,
    rigFamily: "fore_and_aft", rigStyle: "crab_claw", fastening: "string", twin: true, rudder: "steering_oar", largeAtLength: 0,
  }),
  dhow: plan({
    id: "dhow", name: "Dhow", typicalLB: 3.75, tradition: "indian_ocean", keelWood: "acacia", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 22], lengthStep: 2, lengthToBeam: [3, 4.5], fullness: 0.5,
    rigFamily: "fore_and_aft", rigStyle: "lateen", fastening: "string", largeAtLength: 0,
  }),
  junk: plan({
    id: "junk", name: "Junk", typicalLB: 3.25, tradition: "east_asian", keelWood: "bamboo", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 22], lengthStep: 2, lengthToBeam: [2.8, 4], fullness: 0.62,
    rigFamily: "fore_and_aft", rigStyle: "junk", rudder: "sternpost", largeAtLength: 0,
  }),
  bezaisen: plan({
    id: "bezaisen", name: "Bezaisen", typicalLB: 3.75, tradition: "japanese", keelWood: "cherry", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 22], lengthStep: 2, lengthToBeam: [3.2, 4.4], fullness: 0.55,
    rigFamily: "square", rigStyle: "square", rudder: "sternpost", largeAtLength: 0,
  }),
  war_canoe: plan({
    id: "war_canoe", name: "War Canoe", typicalLB: 8, tradition: "dugout", keelWood: "dark_oak", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 20], lengthStep: 2, lengthToBeam: [6, 10], fullness: 0.4,
    rigFamily: null, shell: "logs", frame: "none", rudder: "steering_oar", largeAtLength: 0,
  }),
  flatboat: plan({
    id: "flatboat", name: "Flatboat", typicalLB: 3.5, tradition: "shallow", keelWood: "mangrove", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 20], lengthStep: 2, lengthToBeam: [2.8, 4.2], fullness: 0.75,
    rigFamily: null, rudder: "steering_oar", largeAtLength: 0,
  }),
  umiak: plan({
    id: "umiak", name: "Umiak", typicalLB: 4, tradition: "arctic", keelWood: null, yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [12, 16], lengthStep: 2, lengthToBeam: [3.4, 4.6], fullness: 0.5,
    rigFamily: null, shell: "hide", keel: "bones", frame: "bones", propulsion: "oars", rudder: "steering_oar", largeAtLength: 0,
  }),
  // Phase 3: large ships, built in a dry dock, drawn at four times the size (2.2 times as tall).
  // the Therans' own (Waterworld): modern sailing in Bronze Age dress, white and gold. Wave-piercing hulls and rigid
  // wings, a step up in hulls with each size (the skiff a foiling monohull, the ship a catamaran with two canted wings
  // and twin tail fins, the flagship a trimaran). Bought, never built (buyOnly), and fitted out once and for all at
  // Strongyle's yards: their Theran fittings (THERAN_FIT) cover what the swappable modules do, and are not swapped.
  // Lightly armed by design: they run and out-think, they do not fight.
  theran_skiff: plan({
    id: "theran_skiff", name: "Theran Foiler", typicalLB: 4, tradition: "therans", keelWood: "spruce", buyOnly: true,
    lengthRange: [5, 8], lengthToBeam: [3.5, 5.5], fullness: 0.42, rigFamily: "fore_and_aft", rigStyle: "wing", propulsion: "paddles",
    foils: true, fixedModules: ["ram", "navigation", "light_hull", "bulkheads", "sewn_hull", "ice_runners"],
  }),
  theran_ship: plan({
    id: "theran_ship", name: "Theran Catamaran", typicalLB: 6, tradition: "therans", keelWood: "spruce", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [14, 22], lengthStep: 2, lengthToBeam: [5, 7.5], fullness: 0.45, twin: true, buyOnly: true,
    rigFamily: "fore_and_aft", rigStyle: "wing", propulsion: "paddles", rudder: "steering_oar", largeAtLength: 0,
    fixedModules: ["ram", "navigation", "lookout", "bulkheads", "sewn_hull", "ice_runners", "hold", "bunk", "crossbow"],
  }),
  theran_flagship: plan({
    id: "theran_flagship", name: "Theran Trimaran", typicalLB: 7, tradition: "therans", keelWood: "spruce", yardLevel: 3, modelScale: 4, endLength: 6,
    lengthRange: [28, 36], lengthStep: 4, lengthToBeam: [6, 8.5], fullness: 0.45, tri: true, outrigger: true, buyOnly: true,
    rigFamily: "fore_and_aft", rigStyle: "wing", propulsion: "oars", rudder: "steering_oar", largeAtLength: 0,
    fixedModules: ["ram", "navigation", "lookout", "full_deck", "bulkheads", "sewn_hull", "ice_runners", "hold", "bunk", "diving_bell", "crossbow"],
  }),
  // the League's galleys (Waterworld): the -remes, a bank of oars a side for each size, a square sail for the passage,
  // the three-bladed bronze ram. The League builds them in its own yards and sells them (buyOnly).
  league_monoreme: plan({
    id: "league_monoreme", name: "Monoreme", typicalLB: 6, tradition: "league", keelWood: "oak", buyOnly: true,
    lengthRange: [6, 10], lengthToBeam: [5, 7], fullness: 0.42, rigFamily: "square", rigStyle: "square", fastening: "rivets",
    propulsion: "oars", rudder: "steering_oar", banks: 1, sailShare: 0.55,
  }),
  league_bireme: plan({
    id: "league_bireme", name: "Bireme", typicalLB: 7, tradition: "league", keelWood: "oak", yardLevel: 2, modelScale: 2, endLength: 3,
    lengthRange: [14, 22], lengthStep: 2, lengthToBeam: [6, 8], fullness: 0.42, buyOnly: true,
    rigFamily: "square", rigStyle: "square", fastening: "rivets", propulsion: "oars", rudder: "steering_oar", largeAtLength: 0, banks: 2, sailShare: 0.55,
  }),
  league_trireme: plan({
    id: "league_trireme", name: "Trireme", typicalLB: 8, tradition: "league", keelWood: "oak", yardLevel: 3, modelScale: 4, endLength: 6,
    lengthRange: [30, 38], lengthStep: 4, lengthToBeam: [7, 9], fullness: 0.4, buyOnly: true,
    rigFamily: "square", rigStyle: "square", fastening: "rivets", propulsion: "oars", rudder: "steering_oar", largeAtLength: 0, banks: 3, sailShare: 0.55,
  }),
  skeid: plan({
    id: "skeid", name: "Skeid", typicalLB: 7.5, tradition: "norse", keelWood: "spruce", yardLevel: 3, modelScale: 4, endLength: 6,
    lengthRange: [28, 40], lengthStep: 4, lengthToBeam: [5.5, 9], fullness: 0.4,
    rigFamily: "square", rigStyle: "square", fastening: "rivets", rudder: "steering_oar", largeAtLength: 0,
  }),
  carrack: plan({
    id: "carrack", name: "Carrack", typicalLB: 3, tradition: "european", keelWood: "oak", yardLevel: 3, modelScale: 4, endLength: 6,
    lengthRange: [28, 40], lengthStep: 4, lengthToBeam: [2.6, 3.6], fullness: 0.62,
    rigFamily: "square", rigStyle: "square", fastening: "rivets", rudder: "sternpost", largeAtLength: 0, propulsion: "sweeps",
  }),
  baghlah: plan({
    id: "baghlah", name: "Baghlah", typicalLB: 3.5, tradition: "indian_ocean", keelWood: "acacia", yardLevel: 3, modelScale: 4, endLength: 6,
    lengthRange: [28, 40], lengthStep: 4, lengthToBeam: [3, 4.2], fullness: 0.52,
    rigFamily: "fore_and_aft", rigStyle: "lateen", fastening: "rivets", rudder: "sternpost", largeAtLength: 0, propulsion: "sweeps",
  }),
  fuchuan: plan({
    id: "fuchuan", name: "Fuchuan", typicalLB: 3.2, tradition: "east_asian", keelWood: "bamboo", yardLevel: 3, modelScale: 4, endLength: 6,
    lengthRange: [28, 40], lengthStep: 4, lengthToBeam: [2.8, 3.8], fullness: 0.6,
    rigFamily: "fore_and_aft", rigStyle: "junk", rudder: "sternpost", largeAtLength: 0, propulsion: "sweeps",
  }),
  shuinsen: plan({
    id: "shuinsen", name: "Shuinsen", typicalLB: 3.4, tradition: "japanese", keelWood: "cherry", yardLevel: 3, modelScale: 4, endLength: 6,
    lengthRange: [28, 40], lengthStep: 4, lengthToBeam: [3, 4], fullness: 0.56,
    rigFamily: "square", rigStyle: "square", rudder: "sternpost", largeAtLength: 0, propulsion: "sweeps",
  }),
  drua: plan({
    id: "drua", name: "Drua", typicalLB: 8, tradition: "pacific", keelWood: "jungle", yardLevel: 3, modelScale: 4, endLength: 6,
    lengthRange: [28, 40], lengthStep: 4, lengthToBeam: [6, 10], fullness: 0.36,
    rigFamily: "fore_and_aft", rigStyle: "crab_claw", fastening: "string", twin: true, rudder: "steering_oar", largeAtLength: 0,
  }),
  kayak: plan({
    id: "kayak", name: "Kayak", typicalLB: 6.5, tradition: "arctic", keelWood: null,
    lengthRange: [4, 6], lengthToBeam: [4, 6.5],
    fullness: 0.3, rigFamily: null, shell: "hide", keel: "bones", frame: "bones", deckSlotsMax: 1,
  }),
};

// One source of the measures: Waterworld's fleets (world/boatsizes.js, the historical hulls) give every plan its
// lengths, its usual length to beam and its fullness; the plan keeps how she's built and drawn. A people's boat
// is found by its name (the Therans' by "theran_" before it).
const idOf = (name) => name.toLowerCase().replace(/ /g, "_");
for (const [tradition, fleet] of Object.entries(FLEETS)) for (const t of fleet) {
  const p = PLANS[idOf(t.name)] ?? PLANS[`theran_${idOf(t.name).replace(/^theran_/, "")}`] ?? PLANS[`league_${idOf(t.name)}`];
  if (!p || p.tradition !== tradition) continue;
  p.lengthRange = [t.range[0], t.range[1]]; p.typicalLB = t.lb; p.fullness = t.full; p.fleet = { tradition, cls: t.cls, name: t.name };
}

for (const p of Object.values(PLANS)) p.sailAllowed = !!p.rigFamily;

// How deep a hull may be built (D-004, chief.md section 4): drawn to the law's depth, a monohull's metacentric height
// falls as she is built deeper (her weight rises with her depth, her waterplane does not), so the plan stops where
// GM falls to B / phi^6, the least a sailing ship kept (given: about 5% of beam; atlantic_indian.md section 5). Twins
// and outriggers stand on their second hull's lever, not their depth.
const GM_LEAST = PHI ** 6;   // given: beam over this, the least metacentric height of a working sailing hull
for (const p of Object.values(PLANS)) {
  if (!p.baseDepth || p.twin || p.tri || p.outrigger) continue;
  const L = Math.sqrt(p.lengthRange[0] * p.lengthRange[1]), B = p.baseBeam;   // derived: her typical length (the range's geometric mean)
  const gm = (d) => hullOf({ L, lb: L / B, full: p.fullness, depth: p.baseDepth * d }).gm - B / GM_LEAST;
  let [lo, hi] = [1, p.depthScale[1]];
  if (gm(hi) >= 0) continue;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (gm(m) >= 0) lo = m; else hi = m; }   // given: thirty halvings, past the slider's step
  p.depthScale = [p.depthScale[0], Math.max(1, Math.floor(lo * 20) / 20)];   // given: the build slider's 5% steps
}

export const STAGES = {
  NONE: 0,
  KEEL: 1,
  FRAMES: 2,
  PLANKED: 3,
  RIGGED: 4,
  LAUNCHED: 5,
};

export const ZONES = ["bow", "mid", "stern"];
