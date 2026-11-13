// Pure. The one faith of the waterworld: every people keeps it, each in its own way.
//
// What it holds sacred is what the world is: the sea, which feeds and carries every people, and
// the law the world runs by, the golden law (F = [[1,1],[1,0]], the breath that returns to its
// point). Its scripture is the Reckoning, kept in Thera's Library and read on the Temple's lectern:
// the world's own math. Its great rite is the year's end, when the breath comes back to its point
// and the world is made whole again: the continuance on land, the solar rite in the air, the Sea
// Rite in the water. It is one faith because there is one law; its many ways are the peoples'.
//
//   tenets     the sea is sacred; the law is sacred, for the world runs by it; take no more than the
//              sea gives (the wardens' closures); what the year takes, the year's end gives back
//   calendar   on the clock's own rungs (clock.js): each day's dawn the clerics' reading at the
//              shrine; each month's turn the new month's blessing; midwinter (the half breath, the
//              antimatter point) the Turning, the night the world is its own mirror; the year's end
//              (midsummer, the breath back at its point) the Great Rite at Thera
//   places     a shrine in every quarter at the waterline (period 3; its cleric), a temple on every
//              district's plaza (period 4), the Sea Rite Temple at Thera (the faith's heart, its
//              conduit's blessing over the bay)
//   orders     clerics at the shrines (vanilla's cleric, the brewing stand), priests at the district
//              temples (a cleric of the highest level), the Therans' Reckoners at the Temple and the
//              Library, who keep the law and lead the Great Rite
//   pilgrims   at the year's end each people sends its clerics to Thera for the Great Rite; the
//              Theran crowd swells by them
//   ways       each tradition keeps the faith in its own look: its shrine in its own stuff with its
//              own motif (looks.js), its rite in its own words
// The faith has no name yet but its own: "the Breath" (a placeholder until the story names it).
import { LOOKS } from "./looks.js";
import { RUNGS } from "../core/clock.js";
import { FIB } from "../core/golden.js";

export const FAITH = Object.freeze({
  name: "the Breath",   // a placeholder
  tenets: ["The sea is sacred.", "The law is sacred, for the world runs by it.", "Take no more than the sea gives.", "What the year takes, the year's end gives back."],
  scripture: "the Reckoning (the golden law, kept in Thera's Library)",
  calendar: [
    { rite: "the reading", when: "every dawn", at: "the shrine", by: "the cleric" },
    { rite: "the blessing", when: "every month's turn", every: RUNGS.month, at: "the district temple", by: "the priest" },
    { rite: "the Turning", when: "midwinter, the half breath", day: RUNGS.year / 2, at: "every shrine, lamps out at dusk", by: "everyone" },
    { rite: "the Great Rite", when: "the year's end, midsummer, the breath at its point", day: 0, at: "the Sea Rite Temple at Thera", by: "the Reckoners and the pilgrims" },
  ],
  orders: [{ order: "clerics", at: "the quarter's shrine" }, { order: "priests", at: "the district temple" }, { order: "the Reckoners", at: "the Sea Rite Temple and the Library" }],
});
// vision: each tradition's way of keeping it: the rite's local name and its shrine's offering
export const WAYS = {
  norse: { rite: "the sea-blót", offering: "a carved prow-head given to the water" },
  european: { rite: "the blessing of the boats", offering: "the first catch's best fish" },
  birchbark: { rite: "the water's thanks", offering: "tobacco and cedar on the water" },
  pacific: { rite: "the tide's feast", offering: "the first fruits of the reef garden" },
  indian_ocean: { rite: "the monsoon's welcome", offering: "lamps set floating at dusk" },
  east_asian: { rite: "the sea lord's day", offering: "paper boats and incense" },
  japanese: { rite: "the sea's festival", offering: "a sacred rope across the cove" },
  dugout: { rite: "the river-mother's dance", offering: "white clay on the hulls" },
  shallow: { rite: "the mangrove's night", offering: "rice cakes on the roots" },
  arctic: { rite: "the sea mother's return", offering: "a drink of fresh water to the first seal" },
  therans: { rite: "the Great Rite", offering: "the year's Reckoning read aloud" },
};
/** A tradition's shrine: its stuff and its motif (its own glazed terracotta at the heart), with prismarine (the law's stone) in it. */
export function shrineOf(tradition, build) {
  const look = LOOKS[tradition];
  return { tradition, way: WAYS[tradition], base: build?.frame?.wall ?? "minecraft:stone", post: build?.frame?.post ?? "minecraft:oak_log", heart: look ? `minecraft:${look.glazed}_glazed_terracotta` : "minecraft:light_blue_glazed_terracotta", law: "minecraft:prismarine_bricks", keeper: "cleric (minecraft:brewing_stand)" };
}
/** Pilgrims to the Great Rite: every people's clerics. */
export const pilgrimsOf = (clerics) => clerics;
export const TEMPLE_EVERY = FIB[5];   // derived: a temple for each district of eight quarters
