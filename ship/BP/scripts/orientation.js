// Keeps the model pointing the way the boat actually faces. Which correction
// the engine needs is checked in game: cycle with /scriptevent shipwright:orient
// (or `bash dev/dev.sh orient`) until the bow leads and turning looks right.
import { DIMENSIONS } from "./dims.js";
import { setP, getP } from "./props.js";
import { world, system } from "@minecraft/server";
import { MODE_KEY, getMode } from "./orientmode.js";
import { readRecord, applySeats } from "./ship.js";

export const MODES = [
  "turn direction A",
  "turn direction B",
  "turn direction A, bow flipped",
  "turn direction B, bow flipped",
];
export { getMode };

/** Pushes the orientation mode to the boat. (The heading itself is written by steering.js.) */
export function syncOrientation(e, mode = getMode()) {
  try {
    if (getP(e, "orient") !== mode) setP(e, "orient", mode);
  } catch {
    /* entity unloading */
  }
}

function applyToAll(mode) {
  for (const id of DIMENSIONS) {
    try {
      for (const e of world.getDimension(id).getEntities({ families: ["shipwright_boat"] })) {
        syncOrientation(e, mode);
        const rec = readRecord(e);
        if (rec) applySeats(e, rec);
      }
    } catch {
      /* dimension not loaded */
    }
  }
}

export function registerOrientation() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "shipwright:orient") return;
    const asked = parseInt(String(ev.message ?? "").trim(), 10);
    const mode = Number.isInteger(asked) && asked >= 0 && asked < MODES.length ? asked : (getMode() + 1) % MODES.length;
    world.setDynamicProperty(MODE_KEY, mode);
    applyToAll(mode);
    const msg = `[Shipwright] Orientation mode ${mode} of ${MODES.length - 1}: ${MODES[mode]}`;
    console.warn(msg);
    for (const p of world.getAllPlayers()) p.sendMessage(`§e${msg}`);
  });
}
