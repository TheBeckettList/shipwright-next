// The knobs the feedback loop may turn (tools/calibrate.mjs writes this file; nothing else should). Each is a
// vision number with a ladder of lawful values (Fibonacci numbers): calibration only ever moves a knob one rung
// along its ladder, toward what the server's probes say, and keeps the history, so every step can be undone.
// The laws (given, derived) are never knobs: when a probe disagrees with a law, the loop reports it instead.
export const LADDERS = {
  radius: [2, 3, 5, 8],            // vision: chunks laid round each player
  shownThera: [5, 8, 13, 21, 34],  // vision: one in this many of Thera's people stands in the city
  shownTown: [13, 21, 34, 55, 89], // vision: one in this many of a town's people stands in it
  columnsPerYield: [8, 13, 21, 34], // vision: columns laid between the layer's pauses (a pause each frame)
  litMargin: [0, 1, 2, 3],         // vision: blocks of light the house law adds over vanilla's 8, if the game sees darker than the lab
};
export const CALIBRATION = {
  radius: 5, shownThera: 8, shownTown: 21, columnsPerYield: 13, litMargin: 0,   // vision: the starting rungs (the loop moves them)
};
export const HISTORY = [
  // { at: "date", from: {..}, to: {..}, why: "the probe that moved it" }
];
