// Pure data. Each tradition's rule gates: how its people lay out a shipyard quarter, written as
// rules the homeport's culture agents (world/portsim.js) must pass ("must") or try for ("prefer").
// Grounded in how each tradition's real waterfronts are laid out; working waterfronts only.
//
// The agents build one quarter each round Strongyle's lagoon: one dry dock, then their wing (the
// causeway from the rings to their quarter, which each designs for itself), then their buildings
// one at a time, taking turns. The port's math (PORT_PLAN.sim in homeport.js) sets the hard limits
// every agent shares: ground in its own arc of the lagoon, nothing on anyone else's, a dock mouth
// open to the lagoon, a wing no wider or tighter than the math allows.
//
// A gate:  { must | prefer: rule, piece, ...args, weight?, why }
//   piece:  "main" (the boathouse or workshop), "home", "side" (the gathering place), "*" (any)
//   rules:
//     faces    to: "water" | "shore" | "south" | "dock" | "side"   the front looks that way
//     parallel to: "shore"                                          its long side runs along the shore
//     near     to: "dock" | "main" | "side" | "home" | "shore", within   no further than within
//     behind   to: "main" | "dock", range: [a, b]                   shoreward of it, a to b blocks back
//     around   to: "side" | "dock", range: [a, b]                   round it, a to b away, spread out
//     row      gap                                                  beside one of its kind, same way round, gap between
//     apart    gap                                                  at least gap from its own people's buildings
//     out      from: "shore", range: [a, b]                         out from the cliff foot (stilts stand out in the water)
//   wing:   form ("straight" | "arc" | "dogleg" | "zigzag" | "meander"), width [a, b] (half widths),
//           lamps every n blocks
//   room:   how much of the lagoon's shore the people ask for (shares are drawn round this)
//   ground: "land" (a sculpted island in its arc, cut by small canals) or "water" (on stilts and decks)
//   trees:  the trees its people plant (world/chunkgen.js treeBlocks kinds), groves: how thickly
//   homes:  how many homes, [fewest, most]

export const CULTURE_GATES = {
  norse: {
    room: 1.15, homes: [3, 5], ground: "land", trees: ["spruce"], groves: 0.5,
    wing: { forms: ["straight", "dogleg"], width: [2, 2.75], lamps: 9 },
    gates: [
      { must: "faces", piece: "main", to: "water", why: "the naust's gable opens to the water, for the boat" },
      { must: "near", piece: "main", to: "dock", within: 16, why: "the boathouse stands at the slipway" },
      { must: "parallel", piece: "home", to: "shore", why: "the longhouse lies long side to the shore" },
      { prefer: "near", piece: "home", to: "main", within: 22, weight: 2, why: "the farm keeps near its naust" },
      { prefer: "near", piece: "side", to: "dock", within: 14, weight: 1, why: "the longfire is on the quay" },
      { must: "apart", piece: "*", gap: 2, why: "room to walk round" },
    ],
  },
  european: {
    room: 1.0, homes: [4, 6], ground: "land", trees: ["oak"], groves: 0.35,
    wing: { forms: ["straight"], width: [2.75, 3.5], lamps: 6 },
    gates: [
      { must: "faces", piece: "main", to: "water", why: "a Hanseatic warehouse turns its gable and hoist to the quay" },
      { must: "faces", piece: "home", to: "water", why: "the wharf's houses stand gable-on to the water, as on Bryggen" },
      { prefer: "row", piece: "home", gap: 1, weight: 3, why: "in one close row along the wharf" },
      { prefer: "near", piece: "side", to: "dock", within: 10, weight: 1, why: "the market stall is on the quay" },
      { must: "apart", piece: "*", gap: 1, why: "close-built" },
    ],
  },
  birchbark: {
    room: 0.9, homes: [3, 6], ground: "land", trees: ["birch"], groves: 0.6,
    wing: { forms: ["arc", "meander"], width: [1.5, 2], lamps: 8 },
    gates: [
      { must: "faces", piece: "main", to: "water", why: "the canoe house opens to the landing" },
      { must: "near", piece: "main", to: "dock", within: 14, why: "the building bed is by the water" },
      { must: "around", piece: "home", to: "side", range: [6, 22], why: "the wiigiwaams stand round the fire circle" },
      { prefer: "faces", piece: "home", to: "side", weight: 2, why: "their doors to the fire" },
      { must: "apart", piece: "*", gap: 3, why: "open ground between" },
    ],
  },
  pacific: {
    room: 1.1, homes: [3, 5], ground: "land", trees: ["palm"], groves: 0.5,
    wing: { forms: ["arc"], width: [1.5, 2.25], lamps: 8 },
    gates: [
      { must: "faces", piece: "main", to: "water", why: "the hālau opens to the lagoon, for the canoes" },
      { must: "near", piece: "main", to: "dock", within: 12, why: "the canoe house is at the water's edge" },
      { must: "around", piece: "home", to: "side", range: [7, 24], why: "the hale stand round open ground" },
      { prefer: "apart", piece: "home", gap: 5, weight: 2, why: "space and air between houses" },
      { must: "apart", piece: "*", gap: 3, why: "open-sided buildings need room" },
    ],
  },
  indian_ocean: {
    room: 1.0, homes: [4, 6], ground: "land", trees: ["palm", "acacia"], groves: 0.35,
    wing: { forms: ["straight", "dogleg"], width: [2.25, 3], lamps: 7 },
    gates: [
      { must: "near", piece: "main", to: "dock", within: 12, why: "the coral-stone store fronts the dhow yard" },
      { must: "out", piece: "main", from: "shore", range: [18, 70], why: "the store is on the seafront, the town behind" },
      { must: "behind", piece: "home", to: "main", range: [3, 30], why: "the stone town rises behind the seafront" },
      { prefer: "row", piece: "home", gap: 1, weight: 3, why: "houses wall to wall along narrow lanes" },
      { prefer: "faces", piece: "home", to: "water", weight: 1, why: "the baraza bench by the door looks out to sea" },
      { must: "apart", piece: "*", gap: 1, why: "close-built" },
    ],
  },
  east_asian: {
    room: 1.0, homes: [3, 5], ground: "land", trees: ["bamboo", "cherry"], groves: 0.45,
    wing: { forms: ["zigzag", "dogleg"], width: [1.75, 2.5], lamps: 6 },
    gates: [
      { must: "faces", piece: "home", to: "south", why: "a southern Chinese house faces south, to the sun" },
      { must: "near", piece: "main", to: "dock", within: 14, why: "the workshop is at the slip" },
      { prefer: "near", piece: "side", to: "main", within: 14, weight: 2, why: "the tea stall by the workshop" },
      { prefer: "row", piece: "home", gap: 1, weight: 1, why: "houses share a lane" },
      { must: "apart", piece: "*", gap: 2, why: "a lane between" },
    ],
  },
  japanese: {
    room: 1.0, homes: [3, 5], ground: "land", trees: ["cherry", "spruce"], groves: 0.45,
    wing: { forms: ["arc", "straight"], width: [1.75, 2.5], lamps: 7 },
    gates: [
      { must: "faces", piece: "main", to: "water", why: "the funaya's ground floor is a boat garage open to the sea" },
      { must: "out", piece: "main", from: "shore", range: [18, 70], why: "the funaya stands at the water's edge, the lane and the houses behind it" },
      { must: "behind", piece: "home", to: "main", range: [4, 26], why: "the family house stands across the lane behind its funaya, as at Ine" },
      { prefer: "row", piece: "home", gap: 1, weight: 2, why: "houses in a line along the lane" },
      { prefer: "near", piece: "side", to: "main", within: 12, weight: 1, why: "net racks on the veranda by the boathouse" },
      { must: "apart", piece: "*", gap: 1, why: "close-built along the water" },
    ],
  },
  dugout: {
    room: 1.05, homes: [4, 6], ground: "land", trees: ["spruce", "dark_oak"], groves: 0.55,
    wing: { forms: ["straight", "arc"], width: [2, 2.75], lamps: 8 },
    gates: [
      { must: "faces", piece: "home", to: "water", why: "the plank houses face the beach" },
      { prefer: "row", piece: "home", gap: 2, weight: 3, why: "in a single line along the shore" },
      { must: "behind", piece: "side", to: "main", range: [2, 22], why: "the smokehouse and racks behind the front" },
      { must: "near", piece: "main", to: "dock", within: 16, why: "canoes drawn up before the houses" },
      { must: "out", piece: "main", from: "shore", range: [8, 60], why: "the front row on the beach, room behind" },
      { must: "apart", piece: "*", gap: 2, why: "room between houses" },
    ],
  },
  shallow: {
    room: 0.9, homes: [4, 6], ground: "water", trees: ["mangrove"], groves: 0.5,
    wing: { forms: ["meander", "zigzag"], width: [1.5, 1.75], lamps: 6 },
    gates: [
      { must: "out", piece: "home", from: "shore", range: [14, 60], why: "the stilt houses stand out over the water" },
      { must: "near", piece: "home", to: "side", within: 24, why: "the landing stage is the village's street" },
      { prefer: "apart", piece: "home", gap: 3, weight: 1, why: "boats pass between the houses" },
      { must: "near", piece: "main", to: "dock", within: 14, why: "the net shed is by the boats" },
      { must: "apart", piece: "*", gap: 2, why: "water between" },
    ],
  },
  arctic: {
    room: 0.8, homes: [2, 4], ground: "land", trees: [], groves: 0,
    wing: { forms: ["straight"], width: [1.5, 2], lamps: 10 },
    gates: [
      { must: "out", piece: "home", from: "shore", range: [0, 12], why: "the qarmaq is dug in at the back of the beach, out of the wind" },
      { must: "near", piece: "side", to: "dock", within: 16, why: "boat racks and the windbreak by the water" },
      { prefer: "apart", piece: "home", gap: 6, weight: 1, why: "a camp spreads out" },
      { must: "apart", piece: "*", gap: 3, why: "room round each" },
    ],
  },
};
