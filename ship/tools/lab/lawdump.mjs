// The law's figures for every ship plan, as JSON: what the world's math says each hull should be, for the engineering
// lens (englab.py) to hold the models against. One source of truth: everything here is read from the core and the
// world (world/boatsizes.js sizeOf, core/boat.js hullOf and trial, core/sea.js seaState), never copied into Python.
//
//   node tools/lab/lawdump.mjs [out.json]           every plan's law (stdout without a file)
//   node tools/lab/lawdump.mjs --model dims.json    and the same hull laws fed the models' measured L, B, D
//                                                   ({id: {L, B, D}}; "-" reads stdin), under "model"
//   run with --import ./tests/mocks/register.mjs (from ship/) and each plan also carries the entity properties
//   the game sets on her at launch (ship.js applyRecord on a stand-in entity), so the lens can evaluate the render
//   controllers' Molang as the game would; without the mocks "props" is null and the lens falls back.
//
// Per plan:
//   size      sizeOf's typical length L (a whole block, the world's rung) and the hull at that length computed
//             exactly, without sizeOf's whole-block rounding: B = L/lb, D = B/phi (keel) or B/phi^2 (flat),
//             T = D/phi, freeboard D/phi^2. If sizeOf ever returns `exact`, its figures win (feature-detected).
//   need      the freeboard the reach's design wave asks: half the significant wave (seaState) of its design wind:
//             inshore the trials' light breeze, coastal the trades, sea the westerlies, ocean the westerlies with
//             a gust on them (chief.md §2); short of it the hull needs a washstrake of need - fb
//   wall      w(L) = max(floor, 16 L / K) world px, K on Fibonacci rungs by how she is built (chief.md §3):
//             89 frame-first carvel, 144 bulkheaded or flat, 233 shell-first light; a carved log keeps its floor.
//             Keel and wale max(2, phi w), deck slab max(2, w/phi), plank max(1, w/phi^2)
//   decks     n = floor((D - 1) / 2) (a block of bulwark, two of tween for a 1.8-block player); a decked hull
//             (n >= 1) covers 1 - 1/phi^4 of her length, an open one needs none
//   hull      hullOf fed the law's dimensions: GM, heel at the design wind on a beam reach, reef wind, and the
//             roll period 2 pi 0.4 B / sqrt(g' GM) for monohulls (chief.md §4)
//   ram       D-005: whether her tradition may carry a ram unbought (the League's and the Therans')
//
// Why here (ship/tools/lab) and not tools/lab: the lens, its ratchet test and the plans it reads are the ship
// module's; ship:test runs from ship/ and finds it beside englab.py and boatlab.py. It still reads the root's
// world/ and core/ (not ship/BP's copies), so the law is the one the world is laid from.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIP = path.resolve(HERE, "../..");
const ROOT = path.resolve(SHIP, "..");
const imp = (p) => import(path.join(ROOT, p));

const { FLEETS, sizeOf, CLASSES } = await imp("world/boatsizes.js");
const { hullOf, trial, TRIAL } = await imp("core/boat.js");
const { seaState } = await imp("core/sea.js");
const { GIVEN, VISION } = await imp("core/given.js");
const { PHI, FIBS } = await imp("core/golden.js");
const { PLANS } = await import(path.join(SHIP, "BP/scripts/config/plans.js"));

// ---- the design wind of each reach (m/s), from the core's own tables (chief.md §2)
const belt = (name) => VISION.BELTS.find((b) => b[1] === name)[2];
export const DESIGN_WIND = {
  inshore: TRIAL.WINDS[0],                      // derived: the trials' light breeze
  coastal: belt("trades"),                      // derived: the trades, the coasting belts' working wind
  sea: belt("westerlies"),                      // derived: the westerlies, where island-to-island crossings blow hardest
  ocean: belt("westerlies") * (1 + VISION.GUST),   // derived: the westerlies with a gust on them, for the open ocean
};
export const need = (reach) => seaState(DESIGN_WIND[reach]).Hs / 2;   // derived: green water comes aboard when the crest clears the rail

// ---- how each plan is built: the wall law's rung K and its floor (chief.md §3)
const K_OF = { carvel: FIBS[10], flat: FIBS[11], light: FIBS[12], carved: null };   // derived: 89, 144, 233 on the Fibonacci run; a carved log has no rung
// given: each plan's construction (the historical hulls': frame-first carvel; bulkheaded or flat-bottomed; shell-first
// light: clinker, mortise-and-tenon galleys, sewn plank, bark, skin; carved from one log), and its floor, the shell
// thickness v0.9.14 drew her section at (gen_boats CON: carvel 2, flat 2, clinker 1, bark 1, skin and chine 0.5,
// v 1.5, round 3), which the chief kept as the least wall because the small boats already read right
const BUILT = {
  rowboat: ["carvel", 2], cog: ["carvel", 1], carrack: ["carvel", 2], baghlah: ["carvel", 2], shuinsen: ["carvel", 2],   // given: frame-first carvel (the cog's clinker section draws 1)
  sampan: ["flat", 2], wasen: ["flat", 2], junk: ["flat", 2], bezaisen: ["flat", 2], fuchuan: ["flat", 1.5], punt: ["flat", 2], flatboat: ["flat", 2],   // given: bulkheaded or flat (the fuchuan's V section draws 1.5)
  theran_skiff: ["flat", 1.5], theran_ship: ["flat", 1.5], theran_flagship: ["flat", 1.5],   // vision: the Therans' bulkheaded composite hulls read with the 144 rung (therans.md: max(1.5, L/144))
  faering: ["light", 1], longship: ["light", 1], skeid: ["light", 1],   // given: clinker, shell-first
  league_monoreme: ["light", 2], league_bireme: ["light", 2], league_trireme: ["light", 2],   // given: mortise-and-tenon, shell-first (league.md: Kyrenia, Olympias)
  sewn_boat: ["light", 2], dhow: ["light", 2],   // vision: sewn plank is built shell-first, so the light rung, though the dhow's section is drawn carvel
  outrigger: ["light", 1.5], voyaging_canoe: ["light", 1.5], drua: ["light", 1.5],   // given: the Pacific's sewn plank on dugout bases
  bark_canoe: ["light", 1], freight_canoe: ["light", 1], umiak: ["light", 0.5], kayak: ["light", 0.5],   // given: bark and skin over a light frame
  dugout: ["carved", 3], war_canoe: ["carved", 3],   // given: carved from one log
};
const RAMMERS = new Set(["league", "therans"]);   // given: D-005, only the League and the Therans rammed

const G_GAME = GIVEN.G * GIVEN.TICKS_PER_S * GIVEN.TICKS_PER_S;   // derived: the game's gravity, m/s^2
const idOf = (name) => name.toLowerCase().replace(/ /g, "_");   // plans.js's own join of a fleet's name to a plan id

/** The fleet type a plan is drawn from, from the root's world (plans.js joins the ship's copy; this is the source). */
function typeOf(id, plan) {
  const f = plan.fleet;
  if (f) return FLEETS[f.tradition]?.find((t) => t.name === f.name) ?? null;
  for (const [tradition, fleet] of Object.entries(FLEETS)) for (const t of fleet)
    if (tradition === plan.tradition && [idOf(t.name), `theran_${idOf(t.name)}`, `league_${idOf(t.name)}`].includes(id)) return t;
  return null;
}

/** The hull laws for a length, beam and depth: GM, heel at the design wind, reef, roll. */
function stability({ L, B, D, type, tradition, mast, reach }) {
  const rig = TRIAL.RIGS[tradition] ?? "square";
  const twin = TRIAL.TWIN[type.name] ?? 0;
  const h = hullOf({ L, lb: L / B, flat: type.flat, full: type.full, rig, mast, twin, depth: D });
  const U = DESIGN_WIND[reach];
  const tr = trial(h, [U]);
  const w = tr.winds[0];
  const roll = !twin && h.gm > 0 ? (2 * Math.PI * 0.4 * B) / Math.sqrt(G_GAME * h.gm) * GIVEN.TICKS_PER_S : null;   // given: the Weiss/IMO roll rule, C about 0.4
  return { gm: h.gm, twin, heel: mast ? w.heel : 0, stands: mast ? w.stands : true, reef: tr.reef ?? null, roll, heelMax: VISION.HEEL_MAX };
}

/** The entity properties the game sets on a plan's boat launched at length L (ship.js applyRecord), or null without the mocks. */
async function propsOf(plan, L) {
  let ship;
  try { ship = await import(path.join(SHIP, "BP/scripts/ship.js")); } catch { return null; }
  const rec = ship.newRecord(plan, "lens", L);
  rec.stage = 5;                                   // given: STAGES.LAUNCHED
  rec.sections.rig.sail = !!plan.rigFamily;        // at sea with her sail bent on, if she carries one
  const props = {};
  const ent = { setProperty: (k, v) => (props[k] = v), getProperty: (k) => props[k], triggerEvent() {}, getComponent: () => undefined };
  try { ship.applyRecord(ent, rec); } catch { /* the seats need a live entity; every property is set before them */ }
  return Object.fromEntries(Object.entries(props).map(([k, v]) => [k.replace(/^shipwright:/, ""), typeof v === "boolean" ? +v : v]));
}

export async function lawdump(models = null) {
  const out = {};
  for (const [id, plan] of Object.entries(PLANS)) {
    const type = typeOf(id, plan);
    if (!type) { out[id] = { id, error: "no fleet type" }; continue; }
    const tradition = plan.fleet?.tradition ?? plan.tradition;
    const s = sizeOf(type), ex = s.exact ?? {};
    const L = ex.L ?? s.L;
    const B = ex.B ?? ex.beam ?? L / type.lb;
    const D = ex.depth ?? ex.D ?? B / (type.flat ? PHI * PHI : PHI);
    const T = ex.draft ?? ex.draught ?? ex.T ?? D / PHI;
    const fb = ex.freeboard ?? ex.fb ?? D - T;
    // the need the law holds this hull to: sizeOf's when it gives one (a Pacific twin's closed hulls are held to the
    // working sea); a hull it exempts (the decked kayak sheds the sea: no washstrake drawn) to the freeboard it draws
    const nd = ex.need == null ? need(type.reach) : ex.wash === 0 && ex.freeboard < ex.need ? ex.freeboard : ex.need;
    const [built, floor] = BUILT[id] ?? ["light", 1];   // vision: a plan not in the table reads as a light hull with the texel floor
    const K = K_OF[built];
    const raw = K ? (16 * L) / K : 0;   // given: 16 px a block
    const w = Math.max(floor, raw);
    const n = Math.max(0, Math.floor((D - 1) / 2));   // vision: a block of bulwark; given: a two-block tween for a 1.8-block player
    const mast = s.masts[0] ?? 0;
    const law = stability({ L, B, D, type, tradition, mast, reach: type.reach });
    const lMax = type.range[1];
    out[id] = {
      id, tradition, cls: type.cls, name: type.name, reach: type.reach, drive: type.drive, flat: type.flat, full: type.full,
      lb: type.lb, range: type.range, scale: plan.modelScale ?? 1, maxMids: plan.maxMids, twin: !!plan.twin, tri: !!plan.tri,
      L, B, D, T, fb, exactFromSizeOf: !!s.exact, rounded: { B: s.B, depth: s.depth, draft: s.draft }, masts: s.masts,
      need: nd, designWind: DESIGN_WIND[type.reach], washstrake: Math.max(0, nd - fb),
      wall: { built, K, floor, raw, w, keel: Math.max(2, PHI * w), wale: Math.max(2, PHI * w), deck: Math.max(2, w / PHI), plank: Math.max(1, w / PHI ** 2) },   // vision: any edge against the sky reads at 2 px, a texel at least
      decks: { n, cover: n >= 1 ? 1 - PHI ** -4 : 0 },   // derived: a full deck's share, the rest hatches and partners
      hull: law,
      ram: { unbought: RAMMERS.has(tradition) },
      classNominal: CLASSES[type.cls]?.nominal,
      props: await propsOf(plan, L),
      propsMax: await propsOf(plan, lMax),
    };
    const m = models?.[id];
    if (m) out[id].model = stability({ L: m.L, B: m.B, D: m.D, type, tradition, mast, reach: type.reach });
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const mi = args.indexOf("--model");
  let models = null;
  if (mi >= 0) { const src = args[mi + 1]; models = JSON.parse(readFileSync(src === "-" ? 0 : src, "utf8")); args.splice(mi, 2); }
  const json = JSON.stringify(await lawdump(models), null, 1);   // vision: one space of indent, readable and small
  if (args[0]) writeFileSync(args[0], json); else process.stdout.write(json + "\n");
}
