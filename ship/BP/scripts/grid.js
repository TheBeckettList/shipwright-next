// The deck grid. A hull is a row of one-block stations between its two ends: the helm takes one,
// a rigged medium or large ship's mast takes one, and deck modules take one, two or three, with a
// walkway station between modules on bigger ships. Slots and minimum lengths follow from adding up.
import { sizeClass } from "./config/modules.js";
import { PROPORTIONS } from "./config/proportions.js";

/** How many masts this plan steps (each takes a deck station on medium and large ships). */
export const mastCount = (plan) => PROPORTIONS[plan?.id]?.mast_count ?? 1;

export const GRID = {
  small: { end: 1.5, gap: 0, mast: 0, slots: 2 },        // a small boat's mast shares a rowing station
  medium: { end: 2, gap: 1, mast: 1, slots: 3 },
  large: { end: 3, gap: 1, mast: 1, slots: 4, fullDeck: 5 },
};

// Decks. A deep hull carries more than one: you walk the top deck, at the rail; the decks below
// are black boxes (not drawn, not walked) that stow modules made to go below: the hold, bunks and
// guns (fired through ports). A full deck adds a deck to any hull deep enough to stand under it.
export const BELOW = new Set(["hold", "bunk", "cannon"]);
const DECK_HEIGHT = 1.5;                 // blocks between decks
/** The rail's height above the boat's origin for this build, in blocks, as the model draws it. */
export const hullDepth = (rec, plan) => {
  const r = PROPORTIONS[plan.id]?.rail ?? 1;
  return 5 / 16 + (r - 5 / 16) * (rec.dims?.depth ?? 1);
};
/** How many decks this hull has: 1, or more where the rail stands too high to see over from the hold. */
export function decksFor(rec, plan, modules = rec.modules ?? []) {
  const R = hullDepth(rec, plan);
  if (sizeClass(rec.dims.length) === "small") return 1;
  let n = R >= 1.9 ? 1 + Math.floor((R - 0.4) / DECK_HEIGHT) : 1;
  if (modules.includes("full_deck") && R >= 1.3 && n < 2) n += 1;
  return Math.max(1, Math.min(3, n));
}
/** Where the top deck is walked: blocks above the water block the hull floats in (0 = at the waterline, inside the hull). */
export function topDeckUp(rec, plan, modules = rec.modules ?? []) {
  if (decksFor(rec, plan, modules) < 2) return 0;
  return Math.max(2, Math.round(hullDepth(rec, plan) - 0.8));   // feet just under the rail, clear of the boat's own box
}
/** Slots on the decks below (black boxes): a class's worth per lower deck. */
export function lowerSlotsFor(rec, plan, modules = rec.modules ?? []) {
  const n = decksFor(rec, plan, modules) - 1;
  return n * GRID[sizeClass(rec.dims.length)].slots;
}
/** Splits deck modules: those made to go below fill the lower decks first; the rest stand on top. */
export function splitDecks(rec, plan, deckModules, modules = rec.modules ?? []) {
  let room = lowerSlotsFor(rec, plan, modules);
  const top = [], below = [];
  for (const m of deckModules) {
    if (room > 0 && BELOW.has(m.key)) { below.push(m); room--; } else top.push(m);
  }
  return { top, below };
}

/** A module's footprint on this hull's class (from the catalog: one number, or one per class). */
export function footprint(mod, cls) {
  const f = mod.footprint ?? 1;
  return typeof f === "number" ? f : f[cls] ?? 1;
}

/** Usable deck stations: the length less the ends, the helm and (if rigged) the mast. */
export function stationsFor(rec, plan) {
  const cls = sizeClass(rec.dims.length);
  const g = GRID[cls];
  const rigged = !!rec.sections?.rig?.sail;
  return Math.max(0, Math.floor(rec.dims.length - 2 * g.end - 1 - (rigged ? g.mast * mastCount(plan) : 0)));
}

/** How many deck slots this hull has: one per block past 4 on small boats (up to 2), set counts above. */
export function deckSlotsFor(rec, plan, modules = rec.modules ?? []) {
  const cls = sizeClass(rec.dims.length);
  const g = GRID[cls];
  if (cls === "small") return Math.min(plan.deckSlotsMax ?? g.slots, Math.max(0, rec.dims.length - 4));
  const top = cls === "large" && modules.includes("full_deck") ? g.fullDeck : g.slots;
  return top + lowerSlotsFor(rec, plan, modules);
}

/** The shortest hull of a class that carries these footprints: ends, helm, mast, modules and walkways. */
export function minLength(cls, footprints, rigged = true, masts = 1) {
  const g = GRID[cls];
  const n = footprints.length;
  return 2 * g.end + 1 + (rigged ? g.mast * masts : 0) + footprints.reduce((a, b) => a + b, 0) + g.gap * Math.max(0, n - 1);
}

/**
 * Lays deck modules out along the stations, forward from the helm, with walkways between them.
 * Returns each module's first station and footprint, and whether they all fit.
 */
export function layoutDeck(rec, plan, deckModules) {
  const cls = sizeClass(rec.dims.length);
  const g = GRID[cls];
  const total = stationsFor(rec, plan);
  const placed = [];
  // Modules stowed below take no top-deck station (and aren't drawn).
  const { top, below } = cls === "small" ? { top: deckModules, below: [] }
    : splitDecks(rec, plan, deckModules, [...new Set([...(rec.modules ?? []), ...deckModules.map((m) => m.key)])]);
  let at = 0;
  for (const m of top) {
    const f = footprint(m, cls);
    if (placed.length) at += g.gap;
    placed.push({ key: m.key, station: at, footprint: f });
    at += f;
  }
  return { placed, below: below.map((m) => m.key), used: at, total, fits: at <= total };
}
