// Pure data for yard detection.

export const TABLE_ID = "shipwright:shipwright_table";
export const GATE_POST_ID = "shipwright:gate_post";

export const LEVELS = {
  1: { name: "Beach yard", length: [4, 10], width: 3, height: 3 },
  // The Gate Post sits out toward the water, touching it. Distance out is the length, the sideways
  // offset the width (straight out gives a standard 5), the height difference the drop.
  2: { name: "Slipway", length: [8, 24], maxSide: 7, standardWidth: 5, drop: [-1, 8], height: 3 },
};

export const WATER = new Set(["minecraft:water", "minecraft:flowing_water"]);

// Only these may sit inside a yard's clear volume.
export const ALLOWED = new Set([
  "minecraft:air",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:torch",
  "minecraft:soul_torch",
  "minecraft:lantern",
  "minecraft:soul_lantern",
  "minecraft:iron_chain",
  "minecraft:ladder",
  "minecraft:short_grass",
  "minecraft:seagrass",
  "minecraft:kelp",
  "minecraft:snow_layer",
]);

export const DIRS = {
  north: { x: 0, z: -1, yaw: 180 },
  south: { x: 0, z: 1, yaw: 0 },
  east: { x: 1, z: 0, yaw: -90 },
  west: { x: -1, z: 0, yaw: 90 },
};

// If boats launch stern-first in testing, set this to 180.
export const MODEL_YAW_OFFSET = 0;
