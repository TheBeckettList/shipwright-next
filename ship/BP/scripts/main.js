// Shipwright, folded into Waterworld as its ship module: event wiring only. Logic lives in the modules below.
// Waterworld lays the world, so Shipwright's own sea dimension, its pre-generation, its probe, the castaway
// start (Boatblock) and its Therans are left out: the Therans are Waterworld's.
import { tell } from "./warn.js";
import { DIMENSIONS } from "./dims.js";
import { world, system } from "@minecraft/server";
import { TABLE_ID, GATE_POST_ID } from "./config/yards.js";
import { registerPost } from "./yard.js";
import { loadChest, chestOwner } from "./chest.js";
import { liftDeck } from "./deck.js";
import { PLANS } from "./config/plans.js";
import { openTable } from "./build.js";
import { refundBrokenShip, readRecord, writeRecord, ensureLaunchedState, worstZone, patchItems, SEA_REPAIR_CAP } from "./ship.js";
import { WOOL } from "./config/materials.js";
import { isCreative, consumeCosts, countItems } from "./inventory.js";
import { startLogbook } from "./logbook.js";
import { registerDevtools } from "./devtools.js";
import { startBuoyancy } from "./buoyancy.js";
import { registerOrientation } from "./orientation.js";
import { startSteering, toggleLash, takeHelmStanding } from "./steering.js";
import { VERSION } from "./version.js";
import { start, bootLine } from "./boot.js";
import { startChecks } from "./checks.js";
import { PEG, usePeg, useItemStack } from "./shields.js";
import { startCrew, takeBerth, shipOf } from "./crew.js";
import { startCharts, navigatorChart, captainLoot, chartItem, keyItem } from "./charts.js";
import { tenderOptions, doTender } from "./tender.js";
import { boatStateOf } from "./steering.js";
import { FLOAT, startMoorings } from "./moorings.js";
import { menu } from "./ui.js";
import { ItemStack } from "@minecraft/server";
useItemStack(ItemStack);

// Says which build is running, in the server log (dev/refresh.sh checks for this line) and on request.
console.warn(`[Shipwright] Scripts ${VERSION} loaded`);
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "shipwright:version") return;
  const msg = `[Shipwright] Scripts ${VERSION} loaded`;
  console.warn(msg);
  for (const p of world.getAllPlayers()) p.sendMessage(`§e${msg}`);
});

const COOLDOWN_MS = 400;
const lastUse = new Map(); // player id -> timestamp
const busy = new Set();    // players with a table form open

// Using the table opens its menu. Sneak to place blocks against it instead.
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  const { block, player } = ev;
  // Using a Gate Post registers it and says what to do next.
  if (block.typeId === GATE_POST_ID && !player.isSneaking && ev.isFirstEvent !== false) {
    const dim = block.dimension;
    const loc = { x: block.location.x, y: block.location.y, z: block.location.z };
    system.run(() => {
      const post = dim.getBlock(loc);
      if (post?.typeId !== GATE_POST_ID) return;
      registerPost(post, true);
      player.sendMessage("§7The Gate Post will be the dry dock's lock gate. For now, a dock is built as a frame around a basin: see Yard guide at the table.");
    });
    return;
  }
  // Using the deck at the helm (a ship's laid deck, or the block under you under way): take the helm standing.
  if (block.typeId === "minecraft:barrier" && !player.isSneaking && ev.isFirstEvent !== false) {
    system.run(() => {
      try {
        for (const b of player.dimension.getEntities({ families: ["shipwright_boat"], location: player.location, maxDistance: 5 })) {
          const msg = takeHelmStanding(b, player);
          if (msg) {
            player.onScreenDisplay?.setActionBar(msg);
            break;
          }
        }
      } catch (err) {
        console.warn(`[Shipwright] Standing helm: ${err}`);
      }
    });
    return;
  }
  if (block.typeId !== TABLE_ID || player.isSneaking) return;
  ev.cancel = true;
  if (ev.isFirstEvent === false) return;

  const now = Date.now();
  if (now - (lastUse.get(player.id) ?? 0) < COOLDOWN_MS || busy.has(player.id)) return;
  lastUse.set(player.id, now);

  const dim = block.dimension;
  const loc = { x: block.location.x, y: block.location.y, z: block.location.z };
  // Before-events are read-only; open forms on the next tick.
  system.run(() => {
    const table = dim.getBlock(loc);
    if (table?.typeId !== TABLE_ID) return;
    busy.add(player.id);
    openTable(player, table)
      .catch((err) => console.warn(`[Shipwright] Table error: ${err}`))
      .finally(() => busy.delete(player.id));
  });
});

// Breaking a boat returns half its planking.
// A broken ship refunds part of its materials, and always puts back the water its deck replaced.
world.afterEvents.entityDie.subscribe(
  (ev) => {
    try {
      liftDeck(ev.deadEntity.id);
    } catch {
      /* nothing laid */
    }
    refundBrokenShip(ev.deadEntity);
  },
  { entityTypes: Object.values(PLANS).map((p) => p.entity) },
);

// Interacting anywhere on a launched boat seats you, even if the engine's own
// mount check missed (long hulls are bigger than their collision box).
function heldItem(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
  } catch {
    return undefined;
  }
}

/** With a lead in hand, interacting takes the boat's line instead of boarding. */
function takeLine(player, boat) {
  const rideable = boat.getComponent("minecraft:rideable");
  try {
    if (rideable?.getRiders().some((r) => r.id === player.id)) rideable.ejectRider(player);
  } catch {
    /* not seated */
  }
  const leash = boat.getComponent("minecraft:leashable");
  if (!leash || leash.isLeashed) return; // the game already tied it
  try {
    leash.leashTo(player);
    if (!isCreative(player)) consumeCosts(player, [{ ids: ["minecraft:lead"], count: 1, label: "Lead" }]);
  } catch {
    /* too far or not allowed */
  }
}

const ZONE_NAME = { bow: "bow", mid: "midship", stern: "stern" };
const WOOL_IDS = new Set(WOOL.map((w) => w.item));

/**
 * Patching at sea, like mending an iron golem: use the hull's own material on the boat to patch
 * its worst section, or wool to patch the sail, up to three-quarters. Returns true if it patched.
 */
function patchBoat(player, boat, held) {
  const rec = readRecord(boat);
  if (!rec || rec.stage < 5 || !held) return false;
  let zone = null;
  let step = 0;
  let use = 0;
  if (WOOL_IDS.has(held.typeId) && rec.sections.rig?.sail && rec.condition.sail < SEA_REPAIR_CAP) {
    zone = "sail"; step = 0.25; use = 1;
  } else {
    const z = worstZone(rec);
    if (rec.condition[z] < SEA_REPAIR_CAP && patchItems(rec, z).includes(held.typeId)) { zone = z; step = 0.15; use = 2; }
  }
  if (!zone) return false;
  if (!isCreative(player) && countItems(player, [held.typeId]) < use) {
    player.sendMessage(`§cYou need ${use} to make a patch.`);
    return true;
  }
  consumeCosts(player, [{ ids: [held.typeId], count: use, label: held.typeId }]);
  rec.condition[zone] = Math.min(SEA_REPAIR_CAP, rec.condition[zone] + step);
  writeRecord(boat, rec);
  const what = zone === "sail" ? "sail" : ZONE_NAME[zone];
  const capped = rec.condition[zone] >= SEA_REPAIR_CAP ? ". That's as good as it gets at sea; a yard can do the rest" : "";
  player.sendMessage(`§aPatched the ${what}: ${Math.round(rec.condition[zone] * 100)}%${capped}.`);
  return true;
}

// Sneak-using a boat opens its sea chest. If someone else's items are in it, this first use is
// stopped before any screen opens, theirs go home and yours come in; use it again to open.
world.beforeEvents.playerInteractWithEntity?.subscribe((ev) => {
  const boat = ev.target;
  if (!ev.player.isSneaking || !boat?.typeId?.startsWith("shipwright:") || boat.typeId === "shipwright:sea_chest" || boat.typeId === FLOAT) return;
  const owner = chestOwner(boat);
  if (owner === ev.player.id) return;                 // your items are already in it
  const player = ev.player;
  if (owner) ev.cancel = true;                        // never show someone else's things
  system.run(() => {
    try {
      if (loadChest(boat, player) && owner) player.sendMessage("§aYour sea chest is ready: use it again to open.");
    } catch (err) {
      console.warn(`[Shipwright] Sea chest: ${err}`);
    }
  });
});

// Using a shield peg: take its shield down, or hang the one in your hand.
world.afterEvents.playerInteractWithEntity?.subscribe((ev) => {
  if (ev.target?.typeId !== PEG) return;
  const peg = ev.target;
  system.run(() => {
    try {
      const id = peg.getDynamicProperty("boat");
      let boat = null;
      for (const d of DIMENSIONS) {
        boat = world.getDimension(d).getEntities({ families: ["shipwright_boat"] }).find((b) => b.id === id) ?? boat;
      }
      const msg = usePeg(peg, ev.player, boat, readRecord, writeRecord);
      if (msg) ev.player.sendMessage(`§7${msg}`);
    } catch (err) {
      console.warn(`[Shipwright] Shield peg: ${err}`);
    }
  });
});

world.afterEvents.playerInteractWithEntity?.subscribe((ev) => {
  const boat = ev.target;
  if (!boat?.typeId?.startsWith("shipwright:") || boat.typeId === "shipwright:sea_chest" || boat.typeId === PEG || boat.typeId === FLOAT) return;   // chests open themselves
  if (ev.player.isSneaking) return;   // sneaking opens the sea chest (the game's own container screen)
  const held = heldItem(ev.player);
  if (/_bed$|^minecraft:bed$/.test(held?.typeId ?? "")) {               // a bed used on a ship with a bunk: your berth aboard
    const msg = takeBerth(ev.player, boat);
    if (msg) {
      ev.player.sendMessage(`§a${msg}`);
      return;
    }
  }
  if (held?.typeId === "minecraft:lead") {
    // A great ship: her boats (bring one alongside on your lead to take her in tow or hoist her).
    const opts = (() => {
      try {
        return tenderOptions(boat, ev.player);
      } catch {
        return [];
      }
    })();
    if (opts.length) {
      system.run(async () => {
        const all = [...opts, { kind: "line", label: "Take a line (tie her up)" }];
        const pick = await menu(ev.player, "Ship's boats", "Boats in tow, aboard, or on your lead alongside.", all.map((o) => ({ text: o.label })));
        if (pick < 0) return;
        if (all[pick].kind === "line") return takeLine(ev.player, boat);
        const msg = doTender(boat, ev.player, all[pick], boatStateOf(boat)?.heading ?? 0);
        if (msg) ev.player.sendMessage(`§7${msg}`);
      });
      return;
    }
    system.run(() => takeLine(ev.player, boat));
    return;
  }
  const riding = boat.getComponent("minecraft:rideable")?.getRiders().some((r) => r.id === ev.player.id);
  if (!riding && held) {
    // Patching takes priority over boarding when you're holding a repair material and it's needed.
    let patched = false;
    try {
      patched = patchBoat(ev.player, boat, held);
    } catch {
      patched = false;
    }
    if (patched) {
      system.run(() => {
        const r = boat.getComponent("minecraft:rideable");
        try {
          if (r?.getRiders().some((x) => x.id === ev.player.id)) r.ejectRider(ev.player);
        } catch {
          /* not seated */
        }
      });
      return;
    }
  }
  const seat = () => {
    try {
      const rideable = boat.getComponent("minecraft:rideable");
      if (rideable && !rideable.getRiders().some((r) => r.id === ev.player.id)) rideable.addRider(ev.player);
    } catch {
      /* seats full or boat gone */
    }
  };
  if (boat.getComponent("minecraft:rideable")) {
    system.run(seat);
    return;
  }
  // A launched boat with no seats yet (older boat or after a restart): add them, then seat the player.
  system.run(() => {
    if (ensureLaunchedState(boat, readRecord(boat))) system.runTimeout(seat, 2);
  });
});

// Gate Posts keep a registry so tables can find them without scanning.
world.afterEvents.playerPlaceBlock?.subscribe((ev) => {
  if (ev.block.typeId === GATE_POST_ID) registerPost(ev.block, true);
});
world.afterEvents.playerBreakBlock?.subscribe((ev) => {
  if (ev.brokenBlockPermutation?.type?.id === GATE_POST_ID) registerPost(ev.block, false);
});

// The helmsman uses a lead (not on anything) to lash or free the tiller.
world.afterEvents.itemUse?.subscribe((ev) => {
  if (ev.itemStack?.typeId !== "minecraft:lead") return;
  const boat = ev.source.getComponent("minecraft:riding")?.entityRidingOn;
  if (!boat?.typeId?.startsWith("shipwright:")) return;
  const helm = boat.getComponent("minecraft:rideable")?.getRiders()?.[0];
  if (helm?.id !== ev.source.id) return;
  toggleLash(boat, ev.source);
});

start("logbook", () => startLogbook());
start("orientation", () => registerOrientation());
start("steering", () => startSteering());
start("devtools", () => registerDevtools());
start("crew", () => startCrew());
start("charts", () => startCharts({ menu, shipOf, readRecord }));

// Trying the charts before the sea Illagers sail: /scriptevent shipwright:treasure [1|2|3] gives you
// what a beaten crew would: their navigator's chart (with a treasure on it) and their captain's loot and key.
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "shipwright:treasure") return;
  const p = ev.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  const level = [1, 2, 3].includes(Number(ev.message)) ? Number(ev.message) : 1;
  const seed = Math.floor(Math.random() * 1e9);
  const chart = navigatorChart("illager", level, p.location, p.dimension.id, seed);
  const loot = captainLoot(level, seed);
  const inv = p.getComponent("minecraft:inventory")?.container;
  inv?.addItem(chartItem(chart));
  inv?.addItem(keyItem(chart.lock, loot.key.captain));
  for (const { item, count } of loot.items) inv?.addItem(new ItemStack(item, count));
  const u = new ItemStack(loot.unique.item, 1);
  u.nameTag = loot.unique.name;
  u.setLore?.(loot.unique.lore.map((l) => `§7${l}`));
  inv?.addItem(u);
  tell(p, `§6${chart.title} and the ${loot.key.captain}'s key and loot. Use the chart to copy it into your chart book (craft one: book, compass, paper).`);
});
start("buoyancy", () => startBuoyancy());
start("moorings", () => startMoorings());
start("self-checks", () => startChecks());
console.warn(bootLine(VERSION));
