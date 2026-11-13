import { PLANS } from "./plans.js";
// Pure data. Modules fill a boat's slots (small 2, medium 3, large 4).
//   sizes: which hull sizes can take it      tradition: a culture special, unlocked by learning it
//   later: the effect arrives with a later system (combat, wear, bigger hulls); it can be fitted now
//   icon: textures/ui/shipwright/<icon>.png

const logs = (w) => [`minecraft:${w}_log`, `minecraft:stripped_${w}_log`];
const ALL = ["small", "medium", "large"];

export const MODULES = {
  // Common
  hold: { name: "Hold", category: "deck", footprint: { small: 1, medium: 2, large: 3 }, icon: "hold", sizes: ALL, about: "Doubles the sea chest.",
    cost: [{ ids: ["minecraft:chest", "minecraft:barrel"], count: 1, label: "Chest or Barrel" }] },
  ram: { name: "Ram", category: "ends", icon: "ram", sizes: ALL,
    about: "A copper-capped bow. At ramming speed (over about 5 knots) she holes a ship her stem reaches, anywhere along its length, and hurts and throws aside creatures at her bow; the cap takes most of the shock. Any ship striking another at speed is hurt too, a bare bow far more.",
    cost: [{ ids: ["minecraft:copper_block"], count: 4, label: "Block of Copper" }] },
  bunk: { name: "Bunk", category: "deck", footprint: 2, icon: "bunk", sizes: ["medium", "large"],
    about: "Use a bed aboard to make her your berth: when you die you wake aboard, wherever she lies. Stowed below on a ship with lower decks.",
    cost: [{ ids: ["minecraft:bed"], count: 1, label: "Bed" }] },
  lookout: { name: "Lookout", category: "deck", footprint: 1, icon: "lookout", sizes: ["medium", "large"],
    about: "A lookout aloft: soundings warn of shoals twice as far ahead.",
    cost: [{ ids: ["minecraft:lantern"], count: 1, label: "Lantern" }, { ids: ["minecraft:ladder"], count: 3, label: "Ladder" }] },
  crossbow: { name: "Crossbow mount", category: "rail", icon: "crossbow", sizes: ["medium", "large"],
    about: "Crew aboard (not at the helm) fire it where they look, once a second: Jump when seated, sneak and Jump when standing on deck. Arrows from your pack or the sea chest.",
    cost: [{ ids: ["minecraft:crossbow"], count: 1, label: "Crossbow" }, { ids: ["minecraft:iron_ingot"], count: 3, label: "Iron Ingot" }] },
  cannon: { name: "Cannon", category: "deck", footprint: 2, icon: "cannon", sizes: ["large"],
    about: "Broadside guns: crew aboard fire out over the side they face (Jump seated, sneak and Jump standing), every three seconds, for a gunpowder and an iron nugget; look up to lift the guns for range (about 30 to 55 blocks). Round shot bursts and holes a ship where it strikes, never the blocks. Hold a chain to load chain shot, which tears sails instead. Stowed on a gun deck below when she has one.",
    cost: [{ ids: ["minecraft:iron_block"], count: 3, label: "Block of Iron" }] },
  diving_bell: { name: "Diving bell", category: "deck", footprint: 3, icon: "bell", sizes: ["large"],
    about: "While she lies at rest, anyone working below her (within 3 blocks of her middle, down to 14) breathes from the bell.",
    cost: [{ ids: ["minecraft:glass"], count: 4, label: "Glass" }, { ids: ["minecraft:iron_ingot"], count: 4, label: "Iron Ingot" }, { ids: ["minecraft:iron_chain"], count: 2, label: "Chain" }] },

  benches: { name: "Benches", icon: "bunk", category: "deck", footprint: { small: 1, medium: 2, large: 3 }, sizes: ALL,
    about: "Rowing benches: each adds pulling power at the oars and room for crew.",
    cost: [{ ids: ["minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:birch_planks", "minecraft:jungle_planks", "minecraft:acacia_planks",
      "minecraft:dark_oak_planks", "minecraft:mangrove_planks", "minecraft:cherry_planks", "minecraft:bamboo_planks"], count: 6, label: "Planks" }] },
  canopy: { name: "Canopy", icon: "deckhouse", category: "deck", footprint: { small: 1, medium: 2, large: 2 }, sizes: ALL,
    about: "Shade and shelter on deck, in the tradition's own look.",
    cost: [{ ids: ["minecraft:bamboo", "minecraft:hay_block", "minecraft:white_wool"], count: 4, label: "Bamboo, Hay or Wool" },
      { ids: ["minecraft:stick"], count: 6, label: "Stick" }] },
  navigation: { name: "Navigation", icon: "lookout", category: "deck", footprint: { small: 1, medium: 2, large: 3 }, sizes: ALL,
    about: "Lash the tiller with a lead so she holds her course, and keep a log of the shallowest soundings everywhere she sails.",
    cost: [{ ids: ["minecraft:compass"], count: 1, label: "Compass" }, { ids: ["minecraft:lead"], count: 1, label: "Lead" }] },
  full_deck: { name: "Full deck", icon: "hull", category: "hull", sizes: ["medium", "large"],
    about: "Decks the hull over: you walk a top deck at the rail, and a deck below stows the hold, bunks and guns (a large ship gains a fifth top slot too). Needs a hull deep enough to stand under it.",
    cost: [{ ids: ["minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:dark_oak_planks"], count: 32, label: "Planks" }] },

  // Culture specials
  shield_rail: { name: "Shield rail", category: "rail", icon: "shield_rail", tradition: "norse", sizes: ALL,
    about: "Pegs for a real shield each side of every station, hung while moored and stowed under way; take one down or hang one any time. The shields aboard turn arrows: crew take up to 60% less.",
    cost: [{ ids: ["minecraft:stick"], count: (rec) => shieldsFor(rec), label: "Stick" },
      { ids: ["minecraft:iron_nugget"], count: (rec) => shieldsFor(rec), label: "Iron Nugget" }] },
  castle: { name: "Castle", category: "deck", footprint: 3, icon: "castle", tradition: "european", sizes: ["medium", "large"],
    about: "A raised fighting platform: arrows loosed by her crew fly a quarter faster, further and harder.",
    cost: [{ ids: ["minecraft:oak_planks"], count: 12, label: "Oak Planks" }] },
  light_hull: { name: "Light hull", category: "hull", icon: "light_hull", tradition: "birchbark", sizes: ["small"],
    about: "A third less weight: quick off the mark and easy to row.",
    cost: [{ ids: logs("birch"), count: 2, label: "Birch Log" }, { ids: ["minecraft:string"], count: 4, label: "String" }] },
  outrigger: { name: "Outrigger", category: "side", icon: "outrigger", tradition: "pacific", sizes: ALL,
    about: "A float to port: far steadier, grips better, heels less.",
    cost: [{ ids: logs("jungle"), count: 2, label: "Jungle Log" }, { ids: ["minecraft:string"], count: 4, label: "String" }] },
  sewn_hull: { name: "Sewn seams", category: "hull", icon: "sewn_hull", tradition: "indian_ocean", sizes: ALL,
    about: "Stitched planks flex: half the wear from hard landings and knocks.",
    cost: [{ ids: ["minecraft:string"], count: 8, label: "String" }] },
  bulkheads: { name: "Bulkheads", category: "hull", icon: "bulkheads", tradition: "east_asian", sizes: ALL,
    about: "Watertight compartments: hull damage can't sink the boat.",
    cost: [{ ids: ["minecraft:bamboo_planks"], count: 8, label: "Bamboo Planks" }] },
  deckhouse: { name: "Deckhouse", category: "deck", footprint: 3, icon: "deckhouse", tradition: "japanese", sizes: ["medium", "large"],
    about: "A bunk and a hold in one slot: the sea chest doubles, and a bed used aboard makes her your berth.",
    cost: [{ ids: ["minecraft:cherry_planks"], count: 12, label: "Cherry Planks" }] },
  ice_runners: { name: "Ice runners", category: "hull", icon: "ice_runners", tradition: "arctic", sizes: ALL,
    about: "Bone runners under the hull: drag the boat across ice to the next open water.",
    cost: [{ ids: ["minecraft:bone"], count: 4, label: "Bone" }, { ids: ["minecraft:iron_ingot"], count: 2, label: "Iron Ingot" }] },
};

// The Therans' fittings: fitted once at Strongyle and never swapped. Each does what the module of the same key does
// (so every law that reads rec.modules reads them), under the Therans' own names; between them they cover what a
// shipmaster would want anywhere on the sea, from ice to reef, and arm her only lightly.
export const THERAN_FIT = {
  ram: { name: "Gold ram", about: "A ram the Therans stopped needing long ago and kept as an emblem: nested chevrons of gold round a faceted spike. It still holes a ship in a pinch." },
  navigation: { name: "Rings chart table", about: "Holds her course on a lashed helm and logs every sounding, onto Strongyle's own charts." },
  lookout: { name: "Glass masthead", about: "A lens at the wing's head: soundings warn of shoals twice as far ahead." },
  light_hull: { name: "Pumice-light hull", about: "Laid up light: quick off the mark, easy to paddle." },
  bulkheads: { name: "Sealed cells", about: "Watertight cells end to end: hull damage can't sink her." },
  sewn_hull: { name: "Tenoned seams", about: "Mortise-and-tenon planking that gives: half the wear from knocks and hard landings." },
  ice_runners: { name: "Bronze ice shoes", about: "Shod keels: haul her over ice to the next open water." },
  hold: { name: "Stowage", about: "Lockers in every hull: the sea chest doubles." },
  bunk: { name: "Berths", about: "Use a bed aboard to make her your berth." },
  full_deck: { name: "Flush deck", about: "Decked over, a deck below for stowage and berths." },
  diving_bell: { name: "Sounding bell", about: "While she lies at rest, anyone working below her breathes from the bell." },
  crossbow: { name: "Bow sling", about: "Her one weapon, a light bow-mounted sling-bow for warning shots. She runs; she does not fight." },
};
export const fixedModules = (plan) => plan?.fixedModules ?? null;
export const moduleName = (plan, key) => (plan?.fixedModules && THERAN_FIT[key]?.name) || MODULES[key]?.name || key;

export const ANCHORS_FIT = {
  stone: { name: "Stone anchor", icon: "anchor_stone", cost: [] },
  iron: { name: "Iron anchor", icon: "anchor_iron",
    cost: [{ ids: ["minecraft:iron_block"], count: 1, label: "Block of Iron" }, { ids: ["minecraft:iron_chain"], count: 1, label: "Chain" }] },
};

/** How many modules of each kind a hull of each class can carry (deck slots come from the deck grid). */
export const CATEGORY_BUDGET = {
  hull: { small: 1, medium: 1, large: 2 },
  rail: { small: 1, medium: 2, large: 2 },
  ends: { small: 1, medium: 2, large: 2 },
  side: { small: 1, medium: 1, large: 1 },
};
export const CATEGORIES = [
  { key: "deck", name: "Deck" }, { key: "rail", name: "Rail" }, { key: "ends", name: "Ends" },
  { key: "hull", name: "Hull" }, { key: "side", name: "Side" },
];

/** Hull size class by length: tier-1 boats are all small. */
export const sizeClass = (length) => (length <= 10 ? "small" : length <= 24 ? "medium" : "large");
export const SLOTS = { small: 2, medium: 3, large: 4 };

/** Shields a shield rail hangs: one each side of every mid-section station the hull has. */
export function shieldsFor(rec) {
  const scale = PLANS[rec?.plan]?.modelScale ?? 1;
  const mids = Math.max(1, Math.min(7, Math.round((rec?.dims?.length ?? 6) / scale - 3)));
  return 2 * mids;
}

/** A module's costs for this boat (some counts depend on the hull). */
export const costFor = (m, rec) => m.cost.map((c) => ({ ...c, count: typeof c.count === "function" ? c.count(rec) : c.count }));
