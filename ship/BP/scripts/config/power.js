// Pure data. The power slot: a vanilla furnace block that works the oars through cranks.
//   pull: how hard it drives the oars   top: top-speed multiplier under power
//   burn: fuel use per tick (smoker and blast furnace burn twice as fast, as in vanilla)
//   type: index for the model's texture (1 furnace, 2 smoker, 3 blast furnace)
export const POWER = {
  furnace: { name: "Furnace", item: "minecraft:furnace", pull: 1.25, top: 1.0, burn: 1, type: 1 },
  smoker: { name: "Smoker", item: "minecraft:smoker", pull: 1.6, top: 0.95, burn: 2, type: 2 },
  blast_furnace: { name: "Blast furnace", item: "minecraft:blast_furnace", pull: 1.35, top: 1.15, burn: 2, type: 3 },
};
export const CRANK_IRON = 4;

// Fuel, in ticks of driving the oars (vanilla furnace burn times).
export const FUELS = [
  { id: "minecraft:coal", ticks: 1600 },
  { id: "minecraft:charcoal", ticks: 1600 },
  { id: "minecraft:dried_kelp_block", ticks: 4000 },
  { id: "minecraft:blaze_rod", ticks: 2400 },
  { id: "minecraft:coal_block", ticks: 16000 },
];
