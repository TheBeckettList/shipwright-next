// The boot lab's strict world: imported before main.js so its rules hold while the pack loads.
//
// In @minecraft/server 2.x a pack's scripts first run in "early execution", before the world exists:
// reading or writing the world then throws ("cannot be used in early execution") and the whole pack
// fails to load. This makes the test world do the same until the boot lab says the world has loaded,
// and keeps every error and every Shipwright warning for the lab to report.
import { world, system, __handlers } from "@minecraft/server";

export const boot = { early: true, errors: [], warnings: [], early_calls: [] };

// every event the pack listens to (the test world only has the ones the tests need)
const listeners = {};
const ev = (name) => ({ subscribe(f) { (listeners[name] ??= []).push(f); __handlers[name] = (a) => listeners[name].forEach((fn) => fn(a)); return f; }, unsubscribe() {} });
for (const name of ["entityDie", "entityHurt", "entitySpawn", "itemUse", "playerBreakBlock", "playerDimensionChange", "playerInteractWithBlock", "playerInteractWithEntity", "playerPlaceBlock", "playerSpawn", "projectileHitBlock", "projectileHitEntity"]) world.afterEvents[name] ??= ev(name);
for (const name of ["playerBreakBlock", "playerInteractWithBlock", "playerInteractWithEntity"]) world.beforeEvents[name] ??= ev(`before_${name}`);
const EARLY = ["getDimension", "getAllPlayers", "getDynamicProperty", "setDynamicProperty", "getEntity", "getDefaultSpawnLocation", "getDay"];
for (const name of EARLY) {
  const f = world[name];
  if (typeof f !== "function") continue;
  world[name] = function (...a) {
    if (boot.early) {
      const msg = `Native function [World::${name}] cannot be used in early execution`;
      boot.early_calls.push(name + " " + (new Error().stack ?? "").split("\n").slice(2, 5).map((l) => l.trim()).join(" < "));
      throw new Error(msg);
    }
    return f.apply(this, a);
  };
}
// the game's console: keep Shipwright's warnings
const warn0 = console.warn.bind(console), err0 = console.error.bind(console);
console.warn = (...a) => { boot.warnings.push(a.join(" ")); warn0(...a); };
console.error = (...a) => { boot.errors.push(`console.error: ${a.join(" ")}`); err0(...a); };
globalThis.__boot = boot;
system.manualJobs = true;                                  // timers and jobs wait for the lab to drive them, as the game does
