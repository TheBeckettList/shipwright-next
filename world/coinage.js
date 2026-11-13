// The coinage (the user's word, 12 Nov 2026): the Therans strike coin and stamp metal at the refinery and mint under the
// cone, from the ore of the impactor buried beneath it (world/impact.js); the League (the Koinon: its house at the
// Exchange, its central bank on the caldera's water) keeps the emerald, warrants metal with its own stamp, and
// exchanges every one of them for every other at the bank's counter.
//
// The measure is the item: an obol is one item's worth, the same worth an emerald counts sixteen of (world/trade.js
// EMERALD, a villager's trade). Each coin is struck from one ingot of its metal and is worth the ingot it's struck from:
//   obol     copper   1 obol
//   drachma  iron     8 obols         (a Fibonacci step: the iron of the old Peloponnese's money)
//   stater   gold     13 drachmas     (104 obols; thirteen to one, gold to the silver standard, is Croesus's own ratio,
//                                      the first coinage's, and a Fibonacci number)
//   emerald  League   2 drachmas      (16 obols)
// A stamped block is nine ingots under a stamp: the refinery's (struck where it was won) or the League's (warranted at
// the bank, so traded). Netherite stamped is worth eight staters an ingot (four of gold in it, and its scrap's labour).
// The bank buys under the worth and sells over it by the same share, 1/phi^5 (about 9%): its keep. The Exchange's
// brokerage (trade.js, 3%) is the house's on goods; this is the bank's on coin.
import { FIB, PHI } from "../core/golden.js";

export const OBOL = 1;   // vision: the measure: an obol is an item's worth
export const COINS = Object.freeze([
  { id: "waterworld:obol", name: "Theran Obol", metal: "copper", ingot: "minecraft:copper_ingot", worth: OBOL },
  { id: "waterworld:drachma", name: "Theran Drachma", metal: "iron", ingot: "minecraft:iron_ingot", worth: FIB[5] * OBOL },   // vision: eight obols
  { id: "waterworld:stater", name: "Theran Stater", metal: "gold", ingot: "minecraft:gold_ingot", worth: FIB[6] * FIB[5] * OBOL },   // vision: thirteen drachmas (Croesus's ratio)
]);
export const EMERALD_WORTH = 2 * FIB[5] * OBOL;   // vision: an emerald, two drachmas: sixteen obols (world/trade.js EMERALD)
/** An ingot's worth in obols, by metal. */
export const INGOT = Object.freeze({ copper: COINS[0].worth, iron: COINS[1].worth, gold: COINS[2].worth, netherite: FIB[5] * COINS[2].worth });   // vision: netherite eight staters
export const INGOT_ID = Object.freeze({ copper: "minecraft:copper_ingot", iron: "minecraft:iron_ingot", gold: "minecraft:gold_ingot", netherite: "minecraft:netherite_ingot" });
export const STAMPS = Object.freeze(["theran", "league"]);   // the refinery's stamp and the League's warrant
export const BLOCK_INGOTS = 9;   // given: a block of metal is nine ingots
/** The stamped blocks: one of each metal under each stamp. */
export const STAMPED = Object.freeze(Object.keys(INGOT).flatMap((metal) => STAMPS.map((stamp) => ({ id: `waterworld:${stamp}_stamped_${metal}`, metal, stamp, worth: BLOCK_INGOTS * INGOT[metal],
  name: `${stamp === "theran" ? "Theran Refinery" : "League"} Stamped ${metal[0].toUpperCase() + metal.slice(1)}` }))));
export const SPREAD = 1 / PHI ** 5;   // vision: the bank's keep, a share either side of the worth
/** What the bank pays for a thing worth w obols, and what it asks for it (whole obols). */
export const bankBuys = (w) => Math.floor(w * (1 - SPREAD));
export const bankSells = (w) => Math.ceil(w * (1 + SPREAD));
// The stamps themselves are drawn in world/carvings.js (theranPanel: the ring, the pentagon and its spokes; leaguePanel:
// the ring, the square and its diagonals), on the stamped blocks and the coins alike.
