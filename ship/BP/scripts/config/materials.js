// Pure data. Wood order must match tools/gen_assets.py (texture array indexes).

export const WOODS = [
  { key: "oak", density: 750, name: "Oak", tradition: "european", planks: "minecraft:oak_planks",
    logs: ["minecraft:oak_log", "minecraft:stripped_oak_log"] },
  { key: "spruce", density: 450, name: "Spruce", tradition: "norse", planks: "minecraft:spruce_planks",
    logs: ["minecraft:spruce_log", "minecraft:stripped_spruce_log"] },
  { key: "birch", density: 670, name: "Birch", tradition: "birchbark", planks: "minecraft:birch_planks",
    logs: ["minecraft:birch_log", "minecraft:stripped_birch_log"] },
  { key: "jungle", density: 650, name: "Jungle", tradition: "pacific", planks: "minecraft:jungle_planks",
    logs: ["minecraft:jungle_log", "minecraft:stripped_jungle_log"] },
  { key: "acacia", density: 800, name: "Acacia", tradition: "indian_ocean", planks: "minecraft:acacia_planks",
    logs: ["minecraft:acacia_log", "minecraft:stripped_acacia_log"] },
  { key: "dark_oak", density: 780, name: "Dark Oak", tradition: "dugout", planks: "minecraft:dark_oak_planks",
    logs: ["minecraft:dark_oak_log", "minecraft:stripped_dark_oak_log"] },
  { key: "mangrove", density: 880, name: "Mangrove", tradition: "shallow", planks: "minecraft:mangrove_planks",
    logs: ["minecraft:mangrove_log", "minecraft:stripped_mangrove_log"] },
  { key: "cherry", density: 600, name: "Cherry", tradition: "japanese", planks: "minecraft:cherry_planks",
    logs: ["minecraft:cherry_log", "minecraft:stripped_cherry_log"] },
  { key: "bamboo", density: 350, name: "Bamboo", tradition: "east_asian", planks: "minecraft:bamboo_planks",
    logs: ["minecraft:bamboo_block", "minecraft:stripped_bamboo_block"] },
];

// Skins for hide boats (the kayak). Texture indexes follow the woods: 9 leather, 10 rabbit hide.
export const SKINS = [
  { key: "hide", name: "Leather", density: 500, item: "minecraft:leather" },
  { key: "rabbit", name: "Rabbit Hide", density: 450, item: "minecraft:rabbit_hide" },
];

// Birch bark, for the bark canoe: peeled from birch logs (texture index 11).
export const BARK = { key: "birch_bark", name: "Birch Bark", density: 400, logs: ["minecraft:birch_log", "minecraft:stripped_birch_log"] };

// Rigs, each learned from its tradition. family sets the physics (points of sail); the style sets the look.
export const RIG_STYLES = {
  square: { name: "square sail", family: "square", index: 1, traditions: ["norse", "european", "japanese", "league"] },
  lateen: { name: "lateen", family: "fore_and_aft", index: 2, traditions: ["indian_ocean"] },
  crab_claw: { name: "crab claw", family: "fore_and_aft", index: 3, traditions: ["pacific"] },
  junk: { name: "battened junk sail", family: "fore_and_aft", index: 4, traditions: ["east_asian"] },
  wing: { name: "rigid wing", family: "fore_and_aft", index: 5, traditions: ["therans"] },
};

/** Every hull material in texture order: the 9 woods, then the skins. */
export const MATERIALS = [...WOODS, ...SKINS, BARK];
export const materialByKey = (key) => MATERIALS.find((m) => m.key === key);

// density: approximate kg per cubic metre of the real wood, used for boat weight.
export const woodIndex = (key) => MATERIALS.findIndex((w) => w.key === key);

export const TRADITIONS = {
  european: { name: "Northern European", boat: "Rowboat" },
  norse: { name: "Norse", boat: "Faering" },
  birchbark: { name: "Bark canoe", boat: "Bark canoe" },
  pacific: { name: "Pacific", boat: "Outrigger canoe" },
  indian_ocean: { name: "Indian Ocean", boat: "Sewn boat" },
  dugout: { name: "Great dugout", boat: "Dugout" },
  shallow: { name: "Shallow water", boat: "Punt" },
  japanese: { name: "Japanese", boat: "Wasen" },
  east_asian: { name: "East Asian", boat: "Sampan" },
  arctic: { name: "Arctic", boat: "Kayak" },
  therans: { name: "Theran", boat: "Theran Skiff" },
  league: { name: "League", boat: "Keles" },
};

// Arctic is learned from bones plus a hide, not wood.
export const ARCTIC_REQUIRES = {
  all: ["minecraft:bone"],
  any: ["minecraft:leather", "minecraft:rabbit_hide"],
};

// Order matches the sail texture array in tools/gen_assets.py.
export const WOOL = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
].map((key) => ({
  key,
  item: `minecraft:${key}_wool`,
  name: key.split("_").map((s) => s[0].toUpperCase() + s.slice(1)).join(" "),
}));

export const ITEMS = {
  stick: "minecraft:stick",
  string: "minecraft:string",
  ironNugget: "minecraft:iron_nugget",
};
