// Charts, keys and treasure.
//
//   Chart book (shipwright:chart_book): yours, kept on you (a player property). Marks (home waters,
//     coves, wrecks, shoals, treasure, your own) and soundings (the shallowest water seen in each
//     16-block area). Use it to read it: every mark with its bearing and distance from you. Use it
//     aboard a ship with Navigation and her log's soundings are copied in.
//   Sea chart (shipwright:sea_chart): a navigator's. Use it and its marks go into your book.
//   Captain's key (shipwright:captains_key): opens one lock: a captain's sea chest, and the treasure
//     their navigator charted. Used up when it opens the treasure.
//   Treasure: a site charted on a sea chart. The chest is put there when someone first comes near
//     (on the shore, or on the bottom if the mark is over water), locked to the captain's key.
//
// The laws (merging, bearings, a navigator's chart, a captain's loot) are pure; the game side is thin.
import { world, system, ItemStack } from "@minecraft/server";
import { TABLET } from "./config/theran.js";
import { ILLAGER_CREWS, VILLAGER_CREWS, MARK_KINDS } from "./config/sea_people.js";
import { warnOnce } from "./warn.js";

// what a chart or key item carries, kept beside it in case the game drops its properties
const kept = new WeakMap();

export const BOOK_ID = "shipwright:chart_book";
export const CHART_ID = "shipwright:sea_chart";
export const KEY_ID = "shipwright:captains_key";
const BOOK_KEY = "shipwright:chartbook";
const SITES_KEY = "shipwright:treasure";
const LOCKS_KEY = "shipwright:locks";
export const MAX_MARKS = 64;
export const MAX_CELLS = 600;
const NEAR = 24;                 // a treasure chest is put in place when someone comes this close

// ---------------------------------------------------------------- the book (pure)

export const emptyBook = () => ({ marks: [], cells: {} });

/** Adds marks to a book (a mark already there, or the same kind within 8 blocks, isn't doubled). Returns how many were new. */
export function addMarks(book, marks) {
  let n = 0;
  for (const m of marks) {
    const dup = book.marks.some((b) => b.id === m.id || (b.kind === m.kind && b.dim === m.dim && Math.hypot(b.x - m.x, b.z - m.z) < 8));
    if (dup) continue;
    book.marks.push({ ...m });
    n++;
  }
  // a full book keeps your own marks and the newest of the rest
  while (book.marks.length > MAX_MARKS) {
    const i = book.marks.findIndex((m) => m.kind !== "mine");
    book.marks.splice(i < 0 ? 0 : i, 1);
  }
  return n;
}

/** Copies soundings (cell -> depth) into a book, keeping the shallowest. Returns how many areas were new or shallower. */
export function addSoundings(book, soundings = {}) {
  let n = 0;
  for (const [cell, d] of Object.entries(soundings)) {
    const was = book.cells[cell];
    if (was === undefined || d < was) {
      book.cells[cell] = d;
      n++;
    }
  }
  const keys = Object.keys(book.cells);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CELLS))) delete book.cells[k];
  return n;
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
/** "340 blocks NNE" from a place to a mark (north is -z in the world). */
export function bearing(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const d = Math.round(Math.hypot(dx, dz));
  if (d < 4) return "here";
  const deg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
  return `${d} blocks ${POINTS[Math.round(deg / 22.5) % 16]}`;
}

/** The book's pages, nearest marks first. */
export function readBook(book, at, dimId) {
  const here = book.marks.filter((m) => m.dim === dimId).sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
  const lines = here.map((m) => `${MARK_KINDS[m.kind]?.icon ?? "·"} §r${m.name}: ${bearing(at, m)}${m.found ? " §7(found)" : ""}`);
  const elsewhere = book.marks.length - here.length;
  return { lines, soundings: Object.keys(book.cells).length, elsewhere };
}

// ---------------------------------------------------------------- what navigators chart (pure)

/** A seeded random number source (so a chart is the same every time it's made from the same seed). */
export function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * A navigator's chart: marks around where their ship sails. side: "illager" (level 1..3) or
 * "villager" (a village key). The treasure mark carries the lock its captain's key opens.
 */
export function navigatorChart(side, key, origin, dimId, seed) {
  const r = rng(seed);
  const crew = side === "illager" ? ILLAGER_CREWS[key] : VILLAGER_CREWS[key];
  if (!crew) return null;
  const lock = `${side}:${key}:${Math.floor(seed)}`;
  const away = (lo, hi) => {
    const a = r() * Math.PI * 2, d = lo + r() * (hi - lo);
    return { x: Math.round(origin.x + Math.cos(a) * d), z: Math.round(origin.z + Math.sin(a) * d) };
  };
  const who = side === "illager" ? crew.era : crew.navigator.replace(/ (navigator|pilot)$/i, "");
  const marks = crew.marks.map((kind, i) => {
    const p = kind === "home" ? { x: Math.round(origin.x), z: Math.round(origin.z) } : kind === "treasure" ? away(120, 260) : away(40, 200);
    return { id: `${lock}:${kind}:${i}`, kind, dim: dimId, ...p, name: `${who} ${MARK_KINDS[kind].name}`, ...(kind === "treasure" ? { lock, level: key } : {}) };
  });
  return { title: `${crew.navigator}'s chart`, lock, marks };
}

/** What a captain carries: their loot, the piece only they have, and their key. */
export function captainLoot(level, seed) {
  const crew = ILLAGER_CREWS[level];
  if (!crew) return null;
  const r = rng(seed + 7);
  const roll = (table) => table.map(([item, lo, hi]) => ({ item, count: lo + Math.floor(r() * (hi - lo + 1)) })).filter((x) => x.count > 0);
  return { items: roll(crew.loot), unique: crew.unique, key: { lock: `illager:${level}:${Math.floor(seed)}`, captain: crew.captain } };
}

/** What a charted treasure holds. */
export function treasureLoot(level, seed) {
  const r = rng(seed + 13);
  return (ILLAGER_CREWS[level]?.treasure ?? []).map(([item, lo, hi]) => ({ item, count: lo + Math.floor(r() * (hi - lo + 1)) })).filter((x) => x.count > 0);
}

/** Where a treasure chest goes near a mark: the highest dry ground within reach, else the sea bottom. */
export function treasureSpot(getBlock, x, z, yTop = 120, yBottom = 30, reach = 8) {
  let wet = null;
  for (let ring = 0; ring <= reach; ring++) {
    for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      for (let y = yTop; y >= yBottom; y--) {
        const id = getBlock(x + dx, y, z + dz);
        if (!id || id === "minecraft:air") continue;
        if (/water/.test(id)) {
          let b = y;
          while (b > yBottom && /water/.test(getBlock(x + dx, b - 1, z + dz) ?? "")) b--;
          wet ??= { x: x + dx, y: b, z: z + dz, under: true };
          break;
        }
        if (/leaves|log|_wood$|vine|grass$|flower|snow_layer/.test(id)) continue;   // under the trees and plants
        return { x: x + dx, y: y + 1, z: z + dz, under: false };
      }
    }
  }
  return wet;
}

// ---------------------------------------------------------------- the game side

function stored(key, fallback) {
  try {
    const v = world.getDynamicProperty(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
const store = (key, v) => world.setDynamicProperty(key, JSON.stringify(v));

export function bookOf(player) {
  try {
    const v = player.getDynamicProperty(BOOK_KEY);
    return v ? { ...emptyBook(), ...JSON.parse(v) } : emptyBook();
  } catch {
    return emptyBook();
  }
}
export const saveBook = (player, book) => player.setDynamicProperty(BOOK_KEY, JSON.stringify(book));

/** A sea chart item holding a navigator's chart. The treasure on it is registered so it can be found. */
export function chartItem(chart) {
  const it = new ItemStack(CHART_ID, 1);
  try {
    it.nameTag = chart.title;
    it.setLore?.(chart.marks.map((m) => `${MARK_KINDS[m.kind]?.icon ?? ""} §7${m.name}`));
    it.setDynamicProperty?.("chart", JSON.stringify(chart));
  } catch (err) {
    warnOnce("chart-item", `[Shipwright] Chart: ${err}`);
  }
  kept.set(it, chart);                                      // (read back by chartIn when properties aren't kept)
  for (const m of chart.marks) if (m.kind === "treasure") registerTreasure(m);
  return it;
}
export function chartIn(item) {
  try {
    const v = item?.getDynamicProperty?.("chart");
    if (v) return JSON.parse(v);
  } catch {
    /* none */
  }
  return (item && kept.get(item)) ?? item?.chart ?? null;
}

/** A captain's key for a lock. */
export function keyItem(lock, captain) {
  const it = new ItemStack(KEY_ID, 1);
  try {
    it.nameTag = `${captain}'s key`;
    it.setLore?.(["§7Opens their sea chest,", "§7and the treasure their navigator charted."]);
    it.setDynamicProperty?.("lock", lock);
  } catch (err) {
    warnOnce("key-item", `[Shipwright] Key: ${err}`);
  }
  kept.set(it, lock);
  return it;
}
export function lockOf(item) {
  try {
    const v = item?.getDynamicProperty?.("lock");
    if (v) return v;
  } catch {
    /* none */
  }
  return (item && kept.get(item)) ?? item?.lock ?? null;
}

export function registerTreasure(mark) {
  const sites = stored(SITES_KEY, []);
  if (sites.some((s) => s.id === mark.id)) return;
  sites.push({ id: mark.id, dim: mark.dim, x: mark.x, z: mark.z, lock: mark.lock, level: mark.level ?? 1, placed: false });
  store(SITES_KEY, sites.slice(-200));
}
export const treasureSites = () => stored(SITES_KEY, []);

const lockKey = (dimId, p) => `${dimId}|${p.x},${p.y},${p.z}`;
export const locks = () => stored(LOCKS_KEY, {});
export function lockAt(dimId, p) {
  return locks()[lockKey(dimId, p)] ?? null;
}
function setLock(dimId, p, lock) {
  const all = locks();
  if (lock) all[lockKey(dimId, p)] = lock;
  else delete all[lockKey(dimId, p)];
  store(LOCKS_KEY, all);
}

/** Puts a charted treasure's chest in place, if a player has come near one. Returns the sites placed. */
export function treasureTick(players = world.getAllPlayers()) {
  const sites = treasureSites();
  let changed = false;
  const placed = [];
  for (const s of sites) {
    if (s.placed) continue;
    const p = players.find((pl) => pl.dimension?.id === s.dim && Math.hypot(pl.location.x - s.x, pl.location.z - s.z) <= NEAR);
    if (!p) continue;
    const dim = p.dimension;
    const spot = treasureSpot((x, y, z) => dim.getBlock({ x, y, z })?.typeId, s.x, s.z, Math.min(300, Math.floor(p.location.y) + 40), Math.max(-60, Math.floor(p.location.y) - 60));
    if (!spot) continue;
    try {
      dim.getBlock(spot).setType("minecraft:chest");
      const c = dim.getBlock(spot).getComponent("minecraft:inventory")?.container;
      for (const { item, count } of treasureLoot(s.level, Math.abs(s.x * 31 + s.z))) c?.addItem(new ItemStack(item, count));
      setLock(s.dim, spot, s.lock);
      s.placed = true;
      s.at = spot;
      changed = true;
      placed.push(s);
    } catch (err) {
      warnOnce("treasure", `[Shipwright] Treasure: ${err}`);
    }
  }
  if (changed) store(SITES_KEY, sites);
  return placed;
}

/**
 * Someone tries a locked chest. With the right key it opens for good (the key is used up on a
 * treasure); otherwise it stays shut. Returns { open, message }.
 */
export function tryLock(dimId, p, heldItem) {
  const lock = lockAt(dimId, p);
  if (!lock) return { open: true, message: "" };
  if (heldItem?.typeId === KEY_ID && lockOf(heldItem) === lock) {
    setLock(dimId, p, null);
    return { open: true, used: true, message: "§6The key turns. The chest is yours." };
  }
  return { open: false, message: "§7Locked fast. It needs its captain's key." };
}

// ---------------------------------------------------------------- using the book and charts

function held(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
  } catch {
    return undefined;
  }
}
function takeHeld(player) {
  try {
    const c = player.getComponent("minecraft:inventory")?.container;
    const it = c?.getItem(player.selectedSlotIndex);
    if (!it) return;
    if (it.amount > 1) {
      it.amount -= 1;
      c.setItem(player.selectedSlotIndex, it);
    } else c.setItem(player.selectedSlotIndex, undefined);
  } catch {
    /* nothing held */
  }
}

/** Using a sea chart: its marks go into your book. Returns a message. */
export function useChart(player, item) {
  const chart = chartIn(item);
  if (!chart) return "§7The chart is blank.";
  const theran = chart.theran ? `${TABLET.read} ` : "";                     // a Theran tablet: nobody else on the sea can read it
  const book = bookOf(player);
  const n = addMarks(book, chart.marks);
  saveBook(player, book);
  takeHeld(player);
  return theran + (n ? `§aCopied ${n} mark${n === 1 ? "" : "s"} from ${chart.title} into your chart book.` : "§7Your chart book already holds everything on this chart.");
}

/** Copies a ship's log (her Navigation soundings) into your book. Returns how many areas. */
export function copyLog(player, rec) {
  if (!rec?.log?.soundings) return 0;
  const book = bookOf(player);
  const n = addSoundings(book, rec.log.soundings);
  saveBook(player, book);
  return n;
}

/** Marks where you stand in your book. */
export function markHere(player, name) {
  const book = bookOf(player);
  const p = player.location;
  const n = addMarks(book, [{ id: `mine:${Date.now()}`, kind: "mine", dim: player.dimension.id, x: Math.round(p.x), z: Math.round(p.z), name: name || "Marked" }]);
  saveBook(player, book);
  return n;
}

export function startCharts({ menu, shipOf, readRecord } = {}) {
  world.afterEvents.itemUse?.subscribe((ev) => {
    const p = ev.source, it = ev.itemStack;
    if (!it || p?.typeId !== "minecraft:player") return;
    if (it.typeId === CHART_ID) {
      p.sendMessage(useChart(p, it));
      return;
    }
    if (it.typeId !== BOOK_ID) return;
    system.run(async () => {
      try {
        let logged = 0;
        const boat = shipOf?.(p);
        const rec = boat && readRecord?.(boat);
        if (rec?.modules?.includes("navigation")) logged = copyLog(p, rec);
        const page = readBook(bookOf(p), p.location, p.dimension.id);
        const body = [
          logged ? `§aCopied ${logged} area${logged === 1 ? "" : "s"} of soundings from the ship's log.§r` : "",
          ...(page.lines.length ? page.lines : ["§7No marks yet: navigators' charts, and your own marks, fill it."]),
          `§7Soundings: ${page.soundings} areas${page.elsewhere ? `; ${page.elsewhere} marks in other dimensions` : ""}.`,
        ].filter(Boolean).join("\n");
        const pick = await menu?.(p, "Chart book", body, ["Mark this spot", "Close"]);
        if (pick === 0) p.sendMessage(markHere(p, "Marked") ? "§aMarked in your chart book." : "§7Already marked here.");
      } catch (err) {
        warnOnce("chartbook", `[Shipwright] Chart book: ${err}`);
      }
    });
  });

  // Locked chests: a captain's key opens them.
  world.beforeEvents.playerInteractWithBlock?.subscribe((ev) => {
    if (ev.block?.typeId !== "minecraft:chest") return;
    const loc = ev.block.location;
    const res = tryLock(ev.block.dimension.id, loc, ev.itemStack ?? held(ev.player));
    if (res.open && !res.message) return;
    if (!res.open) ev.cancel = true;
    system.run(() => {
      try {
        ev.player.sendMessage(res.message);
        if (res.used) takeHeld(ev.player);
      } catch {
        /* left */
      }
    });
  });
  // A locked chest can't be broken open either.
  world.beforeEvents.playerBreakBlock?.subscribe((ev) => {
    if (ev.block?.typeId === "minecraft:chest" && lockAt(ev.block.dimension.id, ev.block.location)) {
      ev.cancel = true;
      system.run(() => ev.player?.sendMessage?.("§7Locked fast. It needs its captain's key."));
    }
  });

  system.runInterval(() => {
    try {
      for (const s of treasureTick()) {
        for (const p of world.getAllPlayers()) if (p.dimension.id === s.dim && Math.hypot(p.location.x - s.x, p.location.z - s.z) <= NEAR) p.onScreenDisplay?.setActionBar("§6You're on the spot the chart marks.");
      }
    } catch (err) {
      warnOnce("treasure-tick", `[Shipwright] Treasure: ${err}`);
    }
  }, 40);
}
