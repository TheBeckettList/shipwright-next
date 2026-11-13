// The edit screen: fitting out a new boat and editing a launched one. The boat on top, then an
// arrow button for each part: sail, propulsion, power, anchor, each module category, and the hull.
import { system } from "@minecraft/server";
import { PLANS, ZONES } from "./config/plans.js";
import { getP } from "./props.js";
import { WOODS, WOOL, TRADITIONS, RIG_STYLES } from "./config/materials.js";
import { menu, info, confirm, modal } from "./ui.js";
import { getKnown } from "./knowledge.js";
import { depositOrDrop, isCreative, countItems, consumeCosts } from "./inventory.js";
import {
  readRecord, hullSpan, rigCost, refitPlan, applyRefit, describeShip, originalPercent, shellChoices,
  moduleSlots, powerCost, powerRefund, setPower, writeRecord, applyRecord, yardRepairCost,
} from "./ship.js";
import { POWER } from "./config/power.js";
import { MODULES, ANCHORS_FIT, sizeClass, CATEGORIES, CATEGORY_BUDGET, costFor, THERAN_FIT } from "./config/modules.js";
import { PROPULSION, TRADITION_PROPULSION, propulsionFor } from "./handling.js";
import { deckSlotsFor, layoutDeck, footprint } from "./grid.js";
import { pay } from "./purchase.js";
import { ShipFrame } from "./frame.js";
import { pegSlots, stockShields, shieldsAboard, pegsOf } from "./shields.js";

const ZONE_NAMES = { bow: "Bow", mid: "Midship", stern: "Stern" };

// ---------- the edit screen ----------

export const ICON = (n) => `textures/ui/shipwright/${n}`;
const POWER_ICON = {
  furnace: "textures/blocks/furnace_front_off",
  smoker: "textures/blocks/smoker_front_off",
  blast_furnace: "textures/blocks/blast_furnace_front_off",
};
const PROP_ICON = { oars: "prop_oars", sweeps: "prop_oars", paddles: "prop_paddles", double_paddle: "prop_double", scull: "prop_scull", pole: "prop_pole" };
const FAMILY = { square: "square", fore_and_aft: "fore-and-aft" };

/**
 * One screen for fitting out a new boat and for editing a launched one: the boat on top,
 * an arrow button for every part. Returns true when the player chooses Launch or Done.
 */
/**
 * Fitting out a new boat, as a guided sequence: sail, propulsion, power, anchor, then each module
 * category, then launch. Each step keeps going forward; Back goes one step back. Returns true to launch.
 */
export async function fitOut(player, entity, supply) {
  const ctx = { player, entity, supply };
  let at = 0;
  for (;;) {
    if (!entity.isValid) return false;
    const rec = readRecord(entity);
    const plan = PLANS[rec.plan];
    const steps = fitOutSteps(rec, plan, ctx);
    if (at >= steps.length) return true;
    const step = steps[at];
    const buttons = [{ text: `Keep and continue: ${step.now}`, act: "keep" }, { text: step.change, act: "change", icon: step.icon }];
    if (!step.last) buttons.push({ text: "Launch now", act: "launch", icon: ICON("launch") });
    if (at > 0) buttons.push({ text: "Back", act: "back" });
    if (step.last) buttons.splice(0, 2, { text: "Launch", act: "launch", icon: ICON("launch") });
    const pick = await menu(player, `4 of 5: Fit out (${at + 1} of ${steps.length}): ${step.title}`, step.about, buttons);
    if (pick < 0) return false;
    const b = buttons[pick];
    if (b.act === "launch") return true;
    if (b.act === "back") { at = Math.max(0, at - 1); continue; }
    if (b.act === "keep") { at++; continue; }
    await step.edit(rec, plan);
    if (!step.stay) at++;                        // parts move on after a change; module categories stay for more
  }
}

function fitOutSteps(rec, plan, { player, entity, supply }) {
  const rig = rec.sections.rig;
  const prop = propulsionFor(rec, plan);
  const anchor = ANCHORS_FIT[rec.anchorType ?? "stone"];
  const steps = [];
  if (plan.sailAllowed) {
    steps.push({ title: "Sail", now: rig.sail ? `${RIG_STYLES[rig.style ?? plan.rigStyle]?.name}, ${WOOL[rig.color].name.toLowerCase()}` : "no sail",
      change: "Change the sail", icon: ICON(rig.sail ? "sail_square" : "sail_none"), about: "A sail is the strongest drive a boat has.",
      edit: (r, p) => editSail(player, entity, r, p, supply) });
  }
  steps.push({ title: "Propulsion", now: PROPULSION[prop].name, change: "Change propulsion", icon: ICON(PROP_ICON[prop]),
    about: "How she's driven when the wind won't do it.", edit: (r, p) => editPropulsion(player, entity, r, p, supply) });
  steps.push({ title: "Power", now: rec.power ? POWER[rec.power].name : "none", change: "Change power",
    icon: rec.power ? POWER_ICON[rec.power] : ICON("power_none"), about: "A furnace block that works the oars for you, on fuel.",
    edit: (r) => refitPower(player, entity, r, supply) });
  steps.push({ title: "Anchor", now: anchor.name, change: "Change the anchor", icon: ICON(anchor.icon),
    about: "A stone anchor drags in a near gale; an iron anchor holds.", edit: (r) => editAnchor(player, entity, r, supply) });
  if (plan.fixedModules) {                           // a Theran's fittings: fitted for good, shown, never swapped
    steps.push({ title: "Theran fittings", now: plan.fixedModules.map((k) => THERAN_FIT[k]?.name ?? k).join(", "), change: "", icon: ICON("hull"),
      about: "Fitted once at Strongyle's yards; they are not swapped.", edit: async () => {} });
  }
  for (const c of plan.fixedModules ? [] : CATEGORIES) {
    const budget = categoryBudget(rec, plan, c.key);
    if (!budget) continue;
    const fitted = rec.modules.filter((k) => MODULES[k]?.category === c.key);
    steps.push({ title: `${c.name} modules`, now: `${fitted.map((k) => MODULES[k].name).join(", ") || "none"} (${fitted.length} of ${budget})`,
      change: fitted.length < budget ? "Add or remove a module" : "Remove a module", icon: ICON("slot_empty"), stay: true,
      about: c.key === "deck" ? "Deck modules take stations along the hull." : `${c.name} modules: ${budget} on this hull.`,
      edit: (r, p) => editCategory(player, entity, r, p, c.key, supply) });
  }
  steps.push({ title: "Launch", now: "", change: "", last: true, about: "She's ready. Launch her?", edit: async () => {} });
  return steps;
}

export async function editBoat(player, entity, supply, newBuild) {
  for (;;) {
    if (!entity.isValid) return false;
    const rec = readRecord(entity);
    const plan = PLANS[rec.plan];
    const rig = rec.sections.rig;
    const prop = propulsionFor(rec, plan);
    const anchor = ANCHORS_FIT[rec.anchorType ?? "stone"];
    const sailText = !plan.sailAllowed ? "none (no mast on this hull)"
      : rig.sail ? `${RIG_STYLES[rig.style ?? plan.rigStyle]?.name ?? "square sail"}, ${WOOL[rig.color].name.toLowerCase()}` : "none";
    const buttons = [
      { text: `${rec.name || "New boat"}\n${rec.dims.length}-block ${plan.name}`, icon: ICON(`boat_${plan.id}`), act: "card" },
      { text: `→ Sail: ${sailText}`, icon: ICON(rig.sail ? (RIG_STYLES[rig.style ?? plan.rigStyle]?.family === "fore_and_aft" ? "sail_fore" : "sail_square") : "sail_none"), act: "sail" },
      { text: `→ Propulsion: ${PROPULSION[prop].name}`, icon: ICON(PROP_ICON[prop]), act: "prop" },
      { text: `→ Power: ${rec.power ? POWER[rec.power].name : "none"}`, icon: rec.power ? POWER_ICON[rec.power] : ICON("power_none"), act: "power" },
      { text: `→ Anchor: ${anchor.name}`, icon: ICON(anchor.icon), act: "anchor" },
    ];
    // One button per module category: what's fitted and how many it can carry (a Theran's: her fixed fittings).
    if (plan.fixedModules) buttons.push({ text: `Theran fittings: ${plan.fixedModules.map((k) => THERAN_FIT[k]?.name ?? k).join(", ")}`, icon: ICON("hull"), act: "card" });
    for (const c of plan.fixedModules ? [] : CATEGORIES) {
      const fitted = rec.modules.filter((k) => MODULES[k]?.category === c.key);
      const budget = categoryBudget(rec, plan, c.key);
      if (!budget && !fitted.length) continue;
      const names = fitted.map((k) => MODULES[k].name).join(", ") || "empty";
      buttons.push({ text: `→ ${c.name}: ${names} (${fitted.length} of ${budget})`,
        icon: ICON(fitted[0] ? MODULES[fitted[0]].icon : "slot_empty"), act: "category", cat: c.key });
    }
    if (!newBuild) {
      const worst = Math.min(rec.condition.bow, rec.condition.mid, rec.condition.stern, rec.sections.rig.sail ? rec.condition.sail : 1);
      if (worst < 0.99) buttons.push({ text: `Repair at the yard (worst: ${Math.round(worst * 100)}%)`, icon: ICON("hull"), act: "repair" });
      buttons.push({ text: "Hull: replace a section", icon: ICON("hull"), act: "hull" });
    }
    buttons.push({ text: newBuild ? "Launch" : "Done", icon: ICON(newBuild ? "launch" : "done"), act: "done" });

    const pick = await menu(player, newBuild ? "4 of 5: Fit out" : `Edit ${rec.name}`,
      "Tap a part to change it.", buttons);
    if (pick < 0) return false;
    const b = buttons[pick];
    if (b.act === "done") return true;
    if (b.act === "card") await info(player, rec.name || plan.name, describeShip(rec));
    else if (b.act === "sail") await editSail(player, entity, rec, plan, supply);
    else if (b.act === "prop") await editPropulsion(player, entity, rec, plan, supply);
    else if (b.act === "power") await refitPower(player, entity, rec, supply);
    else if (b.act === "anchor") await editAnchor(player, entity, rec, supply);
    else if (b.act === "category") await editCategory(player, entity, rec, plan, b.cat, supply);
    else if (b.act === "hull") await refitHull(player, entity, rec, supply);
    else if (b.act === "repair") {
      if (await pay(player, "Repair at the yard", "Restores every section and the sail to full.", yardRepairCost(rec), supply)) {
        rec.condition = { bow: 1, mid: 1, stern: 1, sail: 1 };
        save(entity, rec);
        player.sendMessage(`§a${rec.name} repaired.`);
      }
    }
  }
}

function save(entity, rec) {
  writeRecord(entity, rec);
  applyRecord(entity, rec);
}

async function editSail(player, entity, rec, plan, supply) {
  if (!plan.sailAllowed) {
    await info(player, "Sail", `A ${plan.name.toLowerCase()} carries no mast.`);
    return;
  }
  const known = getKnown(player);
  const own = plan.rigStyle ?? "square";
  const styles = [...new Set([own, ...Object.keys(RIG_STYLES).filter((k) => RIG_STYLES[k].traditions.some((t) => known.has(t)))])];
  const rig = rec.sections.rig;
  const current = rig.style ?? own;
  const values = await modal(player, "Sail", [
    { type: "toggle", label: "Carry a sail", value: rig.sail || true },
    { type: "dropdown", label: "Rig (a square sail runs before the wind; lateen, crab claw and junk point closer)", options: styles.map((k) => RIG_STYLES[k].name), index: Math.max(0, styles.indexOf(current)) },
    { type: "dropdown", label: "Sail colour", options: WOOL.map((w) => w.name), index: rig.color ?? 14 },
  ]);
  if (!values) return;
  const style = styles[values[1]];
  const next = { sail: !!values[0], style, family: RIG_STYLES[style].family, color: values[2] };
  const changed = next.sail && (!rig.sail || next.style !== current || next.color !== rig.color);
  if (changed && !(await pay(player, "Make the sail", `A ${RIG_STYLES[style].name} in ${WOOL[next.color].name.toLowerCase()} wool, sized to this hull.`, rigCost(plan, next.color, rec, style), supply))) return;
  rec.sections.rig = { ...rig, ...next };
  save(entity, rec);
}

async function editPropulsion(player, entity, rec, plan, supply) {
  const known = getKnown(player);
  const styles = [...new Set([propulsionFor({}, plan), ...[...known].map((t) => TRADITION_PROPULSION[t]).filter(Boolean)])];
  const current = propulsionFor(rec, plan);
  const pick = await menu(player, "Propulsion", "Learned from the traditions you know; fits any hull.",
    styles.map((k) => ({ text: `${PROPULSION[k].name}${k === current ? " (fitted)" : ""}`, icon: ICON(PROP_ICON[k]) })));
  if (pick < 0 || styles[pick] === current) return;
  const key = styles[pick];
  if (!(await pay(player, "Change propulsion", `Fit ${PROPULSION[key].name}.`, [{ ids: ["minecraft:stick"], count: 6, label: "Stick" }], supply))) return;
  rec.propulsion = key === propulsionFor({}, plan) ? null : key;
  save(entity, rec);
}

async function editAnchor(player, entity, rec, supply) {
  const keys = Object.keys(ANCHORS_FIT);
  const current = rec.anchorType ?? "stone";
  const pick = await menu(player, "Anchor", "A stone anchor drags in a near gale; an iron anchor holds.",
    keys.map((k) => ({ text: `${ANCHORS_FIT[k].name}${k === current ? " (fitted)" : ""}`, icon: ICON(ANCHORS_FIT[k].icon) })));
  if (pick < 0 || keys[pick] === current) return;
  const key = keys[pick];
  if (ANCHORS_FIT[key].cost.length && !(await pay(player, `Fit an ${ANCHORS_FIT[key].name.toLowerCase()}`, "Takes the anchor slot.", ANCHORS_FIT[key].cost, supply))) return;
  rec.anchorType = key;
  save(entity, rec);
}

const SIZE_LOCK = { small: "small boats only", medium: "medium and up", large: "large only" };

/** Why a module can't go on this boat, or "" if it can. */
function moduleLock(key, rec, known) {
  const m = MODULES[key];
  if (!m.sizes.includes(sizeClass(rec.dims.length))) return SIZE_LOCK[m.sizes[0]] ?? "not for this size";
  if (key === "outrigger" && PLANS[rec.plan]?.twin) return "twin hulls need no float";
  if (m.tradition && !known.has(m.tradition)) return `learn the ${TRADITIONS[m.tradition].name} tradition`;
  if (rec.modules.includes(key)) return "fitted";
  return "";
}

/**
 * Where a deck station lies in the world: stations run forward from the helm (the entity's origin),
 * starting one block ahead of it, one block each.
 */
export function stationSpot(entity, station, rec = readRecord(entity)) {
  // Stations run forward from the helm, the ship's origin: one block ahead of it, one block each.
  return new ShipFrame(entity.location, getP(entity, "yaw") ?? 0).toWorld(1 + station + 0.5, 0, 0.6);
}

/** Marks the stations a module would take with a ghostly outline for a few seconds. */
export function showGhost(entity, plan, station, footprint) {
  let runs = 0;
  const id = system.runInterval(() => {
    if (!entity.isValid || ++runs > 12) {
      system.clearRun(id);
      return;
    }
    for (let k = 0; k < footprint; k++) {
      const c = stationSpot(entity, station + k);
      for (const dy of [0, 0.5, 1]) {
        try {
          entity.dimension.spawnParticle("minecraft:villager_happy", { x: c.x, y: c.y + dy, z: c.z });
        } catch {
          /* cosmetic */
        }
      }
    }
  }, 5);
}

/** How many modules of a category this hull can carry: deck slots from the deck grid, the rest by class. */
export function categoryBudget(rec, plan, cat) {
  if (cat === "deck") return deckSlotsFor(rec, plan);
  return CATEGORY_BUDGET[cat]?.[sizeClass(rec.dims.length)] ?? 0;
}

/** Why a module can't be added to this boat right now, or "" if it can. */
function addLock(key, rec, plan, known) {
  const lock = moduleLock(key, rec, known);
  if (lock) return lock;
  const m = MODULES[key];
  const fitted = rec.modules.filter((k) => MODULES[k]?.category === m.category);
  if (fitted.length >= categoryBudget(rec, plan, m.category)) return `no free ${m.category} slot`;
  if (m.category === "deck") {
    const deck = [...fitted, key].map((k) => ({ key: k, ...MODULES[k] }));
    const lay = layoutDeck(rec, plan, deck);
    if (!lay.fits) return `needs ${lay.used - lay.total} more deck station${lay.used - lay.total === 1 ? "" : "s"}`;
  }
  return "";
}

async function editCategory(player, entity, rec, plan, cat, supply) {
  const name = CATEGORIES.find((c) => c.key === cat).name;
  const fitted = rec.modules.filter((k) => MODULES[k]?.category === cat);
  const budget = categoryBudget(rec, plan, cat);
  const buttons = fitted.map((k) => ({ text: `Remove: ${MODULES[k].name}`, icon: ICON(MODULES[k].icon), act: "remove", key: k }));
  if (fitted.length < budget) buttons.push({ text: "Add a module", icon: ICON("slot_empty"), act: "add" });
  const pick = await menu(player, `${name} modules`, `${fitted.length} of ${budget} fitted.`, buttons);
  if (pick < 0) return;
  const b = buttons[pick];
  if (b.act === "remove") return removeModule(player, entity, rec, b.key, supply);

  const known = getKnown(player);
  const keys = Object.keys(MODULES).filter((k) => MODULES[k].category === cat);
  const options = keys.map((k) => {
    const m = MODULES[k];
    const lock = addLock(k, rec, plan, known);
    const fp = cat === "deck" ? `, ${footprint(m, sizeClass(rec.dims.length))} station${footprint(m, sizeClass(rec.dims.length)) === 1 ? "" : "s"}` : "";
    const note = lock ? ` (${lock})` : m.later ? ` (works with ${m.later}${fp})` : fp ? ` (${fp.slice(2)})` : "";
    return { text: `${m.name}${note}`, icon: ICON(m.icon) };
  });
  const choice = await menu(player, `Add: ${name}`, cat === "deck" ? "Deck modules take stations along the hull, with walkways between them on bigger ships." : "Choose a module.", options);
  if (choice < 0) return;
  const key = keys[choice];
  const lock = addLock(key, rec, plan, known);
  if (lock) {
    player.sendMessage(`§c${MODULES[key].name}: ${lock}.`);
    return;
  }
  const m = MODULES[key];
  if (cat === "deck") {
    // A ghost outline marks the stations this module would take, before you pay.
    const deck = [...rec.modules.filter((k) => MODULES[k]?.category === "deck"), key].map((k) => ({ key: k, ...MODULES[k] }));
    const spot = layoutDeck(rec, plan, deck).placed.at(-1);
    showGhost(entity, plan, spot.station, spot.footprint);
  }
  if (!(await pay(player, `Fit: ${m.name}`, `${m.about}${m.later ? ` Its effect arrives with ${m.later}.` : ""}`, costFor(m, rec), supply))) return;
  rec.modules.push(key);
  if (key === "shield_rail") {
    // Your own shields go straight onto the pegs (in creative, a full set).
    const want = pegSlots(rec).length;
    const have = isCreative(player) ? want : Math.min(want, countItems(player, ["minecraft:shield"], supply));
    if (have > 0) consumeCosts(player, [{ ids: ["minecraft:shield"], count: have, label: "Shield" }], supply);
    stockShields(rec, have);
    player.sendMessage(`§7${have} of ${want} shields hung on the rail.${have < want ? " Hang more any time: hold a shield and use an empty peg while moored." : ""}`);
  }
  save(entity, rec);
}

async function removeModule(player, entity, rec, key, supply) {
  const m = MODULES[key];
  if (!(await confirm(player, m.name, `${m.about}\n\nRemove it? Half its materials come back to you.`, "Remove", "Back"))) return;
  if (key === "hold" || key === "deckhouse") {
    const chest = entity.getComponent("minecraft:inventory")?.container;
    for (let i = 27; chest && i < chest.size; i++) {
      if (chest.getItem(i)) {
        player.sendMessage("§cEmpty the second half of the sea chest before removing the hold.");
        return;
      }
    }
  }
  for (const c of costFor(m, rec)) depositOrDrop(supply, entity.dimension, player.location, c.ids[0], Math.floor(c.count / 2));
  if (key === "shield_rail") {
    const n = shieldsAboard(rec);
    if (n) depositOrDrop(supply, entity.dimension, player.location, "minecraft:shield", n);   // every shield comes back
    rec.shields = [];
    for (const p of pegsOf(entity)) p.remove();
  }
  rec.modules.splice(rec.modules.indexOf(key), 1);
  save(entity, rec);
}

async function refitHull(player, e, rec, supply) {
  const options = shellChoices(PLANS[rec.plan]);
  const values = await modal(player, `Refit ${rec.name}`, [
    { type: "dropdown", label: "Section to replace", options: ZONES.map((z) => ZONE_NAMES[z]), index: 0 },
    { type: "dropdown", label: "New material", options: options.map((w) => w.name), index: 0 },
  ]);
  if (!values) return;
  const zone = ZONES[values[0]];
  const wood = options[values[1]];
  const { costs, refund } = refitPlan(rec, zone, wood.key);
  const summary = `Replace the ${ZONE_NAMES[zone].toLowerCase()} with ${wood.name.toLowerCase()} planking. The old planks return ${refund.count} usable planks. ${rec.name} stays the same ship.`;
  if (!(await pay(player, "Refit", summary, costs, supply))) return;
  depositOrDrop(supply, e.dimension, player.location, refund.item, refund.count);
  applyRefit(e, rec, zone, wood.key);
  player.sendMessage(`§a${rec.name} refitted. Original material: ${originalPercent(rec)}%.`);
}

async function refitPower(player, e, rec, supply) {
  const keys = Object.keys(POWER);
  const buttons = keys.map((k) => (rec.power === k ? `${POWER[k].name} (fitted)` : POWER[k].name));
  if (rec.power) buttons.push("Remove power");
  const pick = await menu(player, "Power slot",
    "Cranks from a furnace block work the oars while you row: no hunger, burning coal, charcoal, blaze rods, coal blocks or dried kelp blocks.\n\nFurnace: steady pull.\nSmoker: quick off the mark, burns fuel twice as fast.\nBlast furnace: most speed, burns fuel twice as fast.",
    buttons);
  if (pick < 0) return;
  const removing = pick === keys.length;
  const key = removing ? null : keys[pick];
  if (key && key === rec.power) return;
  if (key && !(await pay(player, `Fit a ${POWER[key].name.toLowerCase()}`, "Takes the power slot; any current power comes back to you.", powerCost(key), supply))) return;
  if (rec.power) for (const r of powerRefund(rec.power)) depositOrDrop(supply, e.dimension, player.location, r.item, r.count);
  setPower(e, rec, key);
  player.sendMessage(key ? `§a${POWER[key].name} fitted. Carry fuel to feed it.` : "§aPower removed.");
}

