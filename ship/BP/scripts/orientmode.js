// The world's orientation mode, shared by the model (orientation.js) and the seats (ship.js).
import { world } from "@minecraft/server";

export const MODE_KEY = "shipwright:orient_mode";
export const MODE_COUNT = 4;
export const DEFAULT_MODE = 0;

export function getMode() {
  try {
    const v = world.getDynamicProperty(MODE_KEY);
    return typeof v === "number" && v >= 0 && v < MODE_COUNT ? v : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

/** Modes 2 and 3 rotate the model 180 degrees (bow and stern swapped). */
export const bowFlipped = (mode = getMode()) => mode >= 2;
