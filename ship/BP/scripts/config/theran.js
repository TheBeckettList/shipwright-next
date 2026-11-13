// Pure data. The Therans: the people of Strongyle, the round isle, and the summit of Shipwright's
// world. Every other seafaring tradition in the game is grounded in a real one; the Therans are the
// one people the game imagines, built on the Bronze Age island of Thera (Akrotiri, before the
// great eruption) and on Plato's description of a ringed harbour city (Critias 115d-116a, public
// domain). The player is one of them, sailing among the ordinary world, keeping it to themselves.
//
// The brand: a name, a palette from the island's own stone and its bronze, and a mark (the rings)
// used on charts, titles and books. Working waterfronts only: the mark never goes on a building,
// and nothing here is sacred or ceremonial; the Therans are shipwrights and chart-makers.

/** The brand: names, palette (blocks and chat colours) and the mark's words. */
export const THERAN = Object.freeze({
  isle: "Strongyle",                         // "the round one": an ancient name of Thera
  people: "Therans",
  one: "Theran",
  epithet: "the round isle",
  mark: "the Rings",                         // three rings of sea, two of land, a channel cut through
  // the stone Plato's Atlanteans quarried from their own island, white, black and red; and the
  // metals of their walls (brass, tin, orichalcum), which on Thera are Bronze Age copper and tin
  stone: { white: "minecraft:calcite", black: "minecraft:smooth_basalt", red: "minecraft:red_terracotta" },
  metal: { brass: "minecraft:waxed_cut_copper", tin: "minecraft:iron_block", orichalcum: "minecraft:waxed_copper_bulb" },
  faience: "minecraft:light_blue_stained_glass",   // Egyptian blue, the blue of Akrotiri's walls
  // chat colours: pumice white, orichalcum gold, scoria red, faience blue
  chat: { white: "§f", gold: "§6", red: "§c", blue: "§9", grey: "§7" },
});

/** The title shown on arriving at Strongyle. */
export const ARRIVAL = Object.freeze({
  title: "§6S T R O N G Y L E",
  subtitle: "§fthe round isle §7· §9home of the Therans",
  first: [
    "§6You are Theran.§r §7Strongyle's charts, its yards and its light are yours.",
    "§7Out on the sea the peoples know the round isle only from harbour tales. Keep it that way: sail as one of them.",
  ],
});

/**
 * Plato's harbour, in stades (Critias 115d-116a): the central island 5 across, then rings of water
 * and land of 1, 2, 2, 3 and 3 stades from the middle out, and a canal 50 stades to the sea, 300
 * feet wide and 100 deep. Bridges cross the rings of water; covered channels let a ship pass under
 * the rings of land; the docks are double, roofed with the native rock.
 */
export const PLATO = Object.freeze({
  island: 5,                                 // given: Critias 116a, the island's diameter (stades)
  rings: [1, 2, 2, 3, 3],                    // given: Critias 115e-116a, water, land, water, land, water (stades, inward to outward)
  canal: { length: 50, width: 0.5, depth: 1 / 6 },   // given: Critias 115d, 300 ft wide and 100 deep (a stade is 600 ft)
});

/** What a Theran ship carried: copper and tin as ox-hide ingots, cobalt-blue glass ingots (as in the Uluburun wreck), and charts. */
export const THERAN_CARGO = [
  ["minecraft:copper_ingot", 6, 18], ["minecraft:raw_copper", 2, 8], ["minecraft:iron_ingot", 1, 5],
  ["minecraft:blue_stained_glass", 2, 8], ["minecraft:light_blue_stained_glass", 1, 6], ["minecraft:amethyst_shard", 0, 4],
];

/**
 * Each tradition's harbour tale of the Therans: what sailors say about a people they've never
 * placed. These are tales told on Shipwright's sea, not any real people's traditions; they are
 * about ships, trade and the sea, nothing sacred, and the Therans in them are only ever sailors.
 */
export const LEGENDS = Object.freeze({
  norse: "Old skippers in the naust tell of a ship that came in under a sail striped white and red, rowed by nobody, and left on the same tide. They say her crew read the swell the way a skald reads a crowd.",
  european: "The wharf clerks keep an old story of copper that came in cast like ox hides, every ingot true to the grain, from merchants who never haggled and never came back by the same road twice.",
  birchbark: "At the fire circle, canoe builders tell of strangers who ran a hand down a canoe's seams, nodded, and showed how their own planks were sewn: a stitch nobody here has seen since.",
  pacific: "Navigators say there's a swell round the round isle that no star path leads you to. You only find it if you already know it's there.",
  indian_ocean: "In the majlis they say a monsoon once brought a ship with blue glass in her hold, cast in ingots like loaves, and a captain who paid in charts instead of silver.",
  east_asian: "At the tea stall the old shipwrights say there were sailors who steered without a compass, by a table of the whole sea set out in stone and copper.",
  japanese: "Net menders say that some nights a light stands on the sea where no island should be, bright as glass, and by morning it's gone.",
  dugout: "In the plank house they tell of a boatwright from the round isle who traded a copper adze for one season of learning to steam cedar, and left the adze behind when he went.",
  shallow: "On the landing stage they say the round isle's people built where you can't tell sea from shore, and nobody could say which of them made it.",
  arctic: "By the windbreak lamp they tell of a ship that came out of the fog with glass on her deckhouse, whose people asked only the way to the ice and the way back.",
});

/** How a Theran tablet reads: Linear A, which nobody in the world can read, except you. */
export const TABLET = Object.freeze({
  title: (n) => `A Theran tablet (${n})`,
  read: "§7The marks are Linear A. Nobody on this sea can read it. §6You can.§r",
});
