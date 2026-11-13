import { biomeAt } from "./seaworld.js";
import { PROPORTIONS } from "./config/proportions.js";
import { PLANS, STAGES, ZONES } from "./config/plans.js";
import { WOODS, WOOL, TRADITIONS, RIG_STYLES } from "./config/materials.js";
import { menu, info, confirm, modal } from "./ui.js";
import { detectYard, showOutline, boatsInYard } from "./yard.js";
import { floodDock, showBlueprint, DOCK, DRY_DOCK } from "./dock.js";
import { planDock, buildDock } from "./yardbuild.js";
import { YARD_STYLES, CUSTOM_PARTS } from "./config/yardstyles.js";
import { VILLAGES, villageFor } from "./config/villages.js";
import { layKeel, raiseFrames, plankHull, rig, launch } from "./stages.js";
import { learnFromInventory, getKnown } from "./knowledge.js";
import { describeCosts, missingCosts, consumeCosts, formatMissing, adjacentContainers, depositOrDrop } from "./inventory.js";
import {
  readRecord, beamRange, shellChoices, defaultShell,
  keelCost, frameCost, plankCost, rigCost, refitPlan, applyRefit, describeShip, originalPercent,
  moduleSlots, powerCost, powerRefund, setPower, writeRecord, applyRecord, yardRepairCost, newRecord, sizePresets,
} from "./ship.js";
import { POWER } from "./config/power.js";
import { pay } from "./purchase.js";
import { editBoat, fitOut, ICON } from "./edit.js";
import { MODULES, ANCHORS_FIT, sizeClass } from "./config/modules.js";
import { PROPULSION, TRADITION_PROPULSION, propulsionFor, computeHandling, describeHandling, KNOTS_TO_BPT, turningRadius } from "./handling.js";

const TITLE = "Shipwright's Table";
const ZONE_NAMES = { bow: "Bow", mid: "Midship", stern: "Stern" };

/** Checks and takes materials, from the supply chest first, then the player. Returns true if paid. */
function saved(player) {
  player.sendMessage("§7Progress saved. Use the Shipwright's Table to continue.");
}

const checklist = (checks) => checks.map((c) => `${c.ok ? "§a✓" : "§c✗"}§r ${c.text}`).join("\n");

// ---------- table entry point ----------

export async function openTable(player, block) {
  learnFromInventory(player);
  const yard = detectYard(block);
  yard.supply = adjacentContainers(block);
  const dock = yard.kind === "dock" ? yard : yard.dock;
  showOutline(dock && !dock.ok ? { ...dock, level: 1 } : yard);
  if (dock?.blocker) showOutline({ ...dock, level: 0, length: 0, blocker: dock.blocker });

  // A dock frame that hasn't been flooded: offer the flood (and say what's missing if it isn't ready).
  if (dock && !dock.flooded && !yard.skipDock) {
    const head = dock.ok ? "§aThe dock is ready to flood.§r" : "§eDock frame found, not ready yet.§r";
    const buttons = [dock.ok ? "Flood the dock" : "Flood the dock (see what's missing)", "Yard guide", "Upgrade the yard (build it for me)"];
    if (yard.kind !== "dock" && yard.ok) buttons.push("Use the beach yard for now");   // index 3
    const pick = await menu(player, TITLE, `${head}\n\n${checklist(dock.checks)}\n\nFlooding opens the sea wall and lets the sea in.`, buttons);
    if (pick === 0) {
      if (!dock.ok) {
        await info(player, "Not ready to flood", `${checklist(dock.checks)}\n\nFix the ✗ items, then flood. A marker shows the first one.`);
        return;
      }
      floodDock(dock, () => player.sendMessage(`§aThe dock is flooded: ${dock.length} long, ${dock.width} wide. Build your ship afloat.`));
      player.sendMessage("§7The sea wall opens...");
      return;
    }
    if (pick === 1) return guide(player, block, yard);
    if (pick === 2) return upgradeYard(player, block, yard);
    if (pick !== 3) return;
    yard.skipDock = true;   // carry on to the beach yard's menu
  }

  if (!yard.ok) {
    const list = yard.checks ? `\n\n${checklist(yard.checks)}` : "\n\nA beach yard needs a clear strip, 3 wide and 3 high, running from the table to the water.";
    const pick = await menu(player, TITLE, `§cNo working yard.§r\n\n${yard.reason}${list}`, ["Upgrade the yard (build it for me)", "Yard guide", "Close"]);
    if (pick === 0) await upgradeYard(player, block, yard);
    else if (pick === 1) await guide(player, block, yard);
    return;
  }

  const boats = boatsInYard(yard).map((e) => ({ e, rec: readRecord(e) })).filter((b) => b.rec);
  const building = boats.find((b) => b.rec.stage < STAGES.LAUNCHED && b.rec.yard === yard.key);
  const launched = boats.filter((b) => b.rec.stage === STAGES.LAUNCHED);

  const actions = [];
  if (building) {
    const name = PLANS[building.rec.plan].name;
    actions.push([`Continue building the ${name}`, () => continueBuild(player, yard, building.e)]);
  } else {
    actions.push(["Build a boat", () => startBuild(player, yard)]);
  }
  if (launched.length) actions.push(["Edit a boat", () => editMenu(player, launched, yard.supply)]);
  if (boats.length) actions.push(["Inspect a boat", () => inspectMenu(player, boats)]);
  if (yard.kind !== "dock") actions.push(["Upgrade the yard", () => upgradeYard(player, block, yard)]);
  actions.push(["Yard guide", () => guide(player, block, yard)]);

  const supplyLine = yard.supply.length
    ? "Supply chest found: materials come from it first."
    : "Tip: put a chest or barrel against the table to build from it.";
  const size = yard.kind === "dock" ? `${yard.length} long, ${yard.width} wide, flooded` : `${yard.length} long, ${yard.width} wide, ${yard.height} high`;
  const dockLine = yard.kind === "dock" ? "" : yard.dock ? `\n\n§eDock in progress:§r\n${checklist(yard.dock.checks)}`
    : "\n\n§7No dock frame around this table yet. A dock builds ships up to 24 blocks: see Yard guide.§r";
  const body = `${yard.levelName}: ${size}.\n${supplyLine}${dockLine}`;
  const pick = await menu(player, TITLE, body, actions.map((a) => a[0]));
  if (pick >= 0) await actions[pick][1]();
}

// ---------- yard upgrades: the table builds the next level for you ----------

async function upgradeYard(player, block, yard) {
  const pick = await menu(player, "Upgrade the yard",
    "Choose an upgrade. The table clears the ground, builds it and hands back what it digs out.",
    ["Dock (level 2): ships up to 24 blocks, built afloat",
     `Dry dock (level 3): the great ships, up to 40 blocks (at least ${DRY_DOCK.length} long and ${DRY_DOCK.width} wide)`]);
  if (pick < 0) return;
  const dry = pick === 1;
  // A style. A dock (level 2) is a village dock in the look of this biome's village; a dry dock
  // (level 3) is a tradition's own yard, for each tradition you know. Or Custom.
  const known = getKnown(player);
  let biome = "minecraft:plains";
  try {
    biome = biomeAt(block.dimension, block.location) ?? biome;
  } catch {
    /* default */
  }
  const vKey = villageFor(biome);
  const styles = dry ? Object.entries(YARD_STYLES).filter(([, s]) => known.has(s.tradition))
    : [[vKey, { name: VILLAGES[vKey].name, village: vKey, about: "a boat shed with a net loft, a fisher's cottage, and a landing with the village bell, in this biome's village look", icon: "boat_rowboat" }]];
  const pickStyle = await menu(player, "Dock style", (dry
    ? "Each tradition builds its dry dock yard from its own country's blocks: its buildings, a gathering place, and the dry dock's works (a gantry crane, gate posts, timber and steam box)."
    : "A dock is built like the village around it. Custom lets you choose every part of a plain dock.") + "\n\n" +
    styles.map(([, s]) => `${s.name}: ${s.about ?? ""}`).join("\n"),
    [...styles.map(([, s]) => ({ text: s.name, icon: ICON(s.icon) })), { text: "Custom", icon: ICON("hull") }]);
  if (pickStyle < 0) return;
  const size = await modal(player, dry ? "Dry dock size" : "Dock size", [
    { type: "slider", label: "Inside length (the longest ship it can build)", min: dry ? DRY_DOCK.length : DOCK.length[0], max: dry ? DOCK.length[1] : 24, step: 1, value: dry ? 36 : 14 },
    { type: "slider", label: "Inside width", min: dry ? DRY_DOCK.width : DOCK.width[0], max: dry ? DOCK.width[1] : 7, step: 1, value: dry ? 11 : 5 },
    { type: "toggle", label: "Build the yard's buildings and gathering place too", value: true },
  ], "Next");
  if (!size) return;
  const [length, width] = size;
  const buildings = size[2] !== false;
  let style;
  if (pickStyle < styles.length) {
    style = styles[pickStyle][1];
  } else {
    const P = CUSTOM_PARTS;
    const cats = Object.keys(P.wall);
    const parts = await modal(player, "Custom dock", [
      { type: "dropdown", label: "Walls", options: cats, index: 0 },
      { type: "dropdown", label: "Footing (under walls over water)", options: P.base.map((o) => o.name), index: 1 },
      { type: "dropdown", label: "Posts", options: P.post.map((o) => o.name), index: 1 },
      { type: "dropdown", label: "Post tops", options: P.accent.map((o) => o.name), index: 1 },
      { type: "dropdown", label: "Lights", options: P.light.map((o) => o.name), index: 1 },
    ], "Next");
    if (!parts) return;
    const walls = P.wall[cats[parts[0]]];
    const mat = await modal(player, `Walls: ${cats[parts[0]]}`, [
      { type: "dropdown", label: "Material", options: walls.map((m) => m.name), index: 0 },
    ], "Next");
    if (!mat) return;
    style = { custom: true, name: "Custom dock", wall: walls[mat[0]].id, base: P.base[parts[1]].id, post: P.post[parts[2]].id,
      accent: P.accent[parts[3]].id, light: P.light[parts[4]].id, every: 4 };
  }
  const plan = planDock(block, length, width, style, { buildings });
  if (!plan.ok) {
    if (plan.blocker) showOutline({ level: 0, length: 0, blocker: plan.blocker, origin: block.location, dimension: block.dimension, dir: { x: 0, z: 1 } });
    await info(player, "Can't build the dock here", plan.reason);
    return;
  }
  showBlueprint(block, plan.dirName, length, width);
  const clears = [...plan.cleared].sort((a, b2) => b2[1] - a[1]).slice(0, 5)
    .map(([id, n]) => `${n} ${id.replace("minecraft:", "").replace(/_/g, " ")}`).join(", ");
  const yardHas = plan.features?.length ? `\n\nWith: ${plan.features.join(", ")}.` : "";
  const summary = `A ${length} by ${width} ${style.name.toLowerCase()}${plan.level === 3 ? " dry dock, dug 3 deep with keel blocks down its middle" : ""}, toward the ${plan.dirName}. ` +
    `The blueprint is showing now.${yardHas}\n\nClears: ${clears || "nothing"}; you get the dug-out blocks back.`;
  if (!(await pay(player, "Build the dock", summary, plan.costs, yard.supply ?? []))) return;
  player.sendMessage("§7The yard crew sets to work...");
  const supply = yard.supply ?? [];
  const drop = { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 };
  buildDock(plan, (id, n) => depositOrDrop(supply, block.dimension, drop, id, n),
    (tablePos) => player.sendMessage(`§aThe dock is built and flooded: ${length} long, ${width} wide.` +
      (plan.tableAt ? ` The table has moved to the deck beside it (${tablePos.x} ${tablePos.y} ${tablePos.z}), looking over the dock.` : "") +
      " Use the table to build a ship afloat."));
}

// ---------- the yard guide ----------

const GUIDE = {
  beach: [
    "Beach yard (level 1): small boats up to 10 blocks.",
    "",
    "1. Place the Shipwright's Table on a shore, a few blocks from the water.",
    "2. Keep a strip 3 wide and 3 high clear from the table to the water.",
    "3. Use the table. That's all.",
  ],
  dock: [
    "Dock (level 2): ships up to 24 blocks, built afloat.",
    "",
    "Build it like a Nether portal laid flat:",
    "1. Dig a basin at the shore, at least 2 deep, 3 to 7 wide and 8 to 24 long (bigger and 3 deep makes a dry dock).",
    "2. Ring it with a frame one block wide at ground level: logs, planks, stone bricks, cobblestone or bricks. Corners are optional.",
    "3. Put the Shipwright's Table at the landward end: set into the frame, or right behind it, touching it.",
    "4. The seaward end of the frame is the sea wall; the sea must be right behind it (it can sit a few blocks lower).",
    "5. Use the table and choose Flood the dock. The sea wall opens and the sea pours in.",
    "",
    "Tip: \"Upgrade the yard\" at the table builds the whole dock for you, or \"Show me where to build\" draws it to build by hand.",
  ],
  dry: [
    `Dry dock (level 3): the great ships, up to 40 blocks.`,
    "",
    `A dock at least ${DRY_DOCK.length} long and ${DRY_DOCK.width} wide (up to ${DOCK.length[1]} by ${DOCK.width[1]}), dug ${DRY_DOCK.depth} deep all through.`,
    "Built the same way as a dock; \"Upgrade the yard\" builds one for you, with keel blocks down its middle.",
    "Here the skeid, carrack, baghlah, fuchuan, shuinsen and drua are laid down.",
  ],
};

async function guide(player, block, yard) {
  const pick = await menu(player, "Yard guide", "Shipyards grow from a beach to a dock, and a dry dock for the great ships.",
    ["Beach yard", "Dock", "Dry dock", "Show me where to build a dock"]);
  if (pick === 0) await info(player, "Beach yard", GUIDE.beach.join("\n"));
  else if (pick === 1) await info(player, "Dock", GUIDE.dock.join("\n"));
  else if (pick === 2) await info(player, "Dry dock", GUIDE.dry.join("\n"));
  else if (pick === 3) {
    const values = await modal(player, "Dock blueprint", [
      { type: "slider", label: "Inside length (the longest ship it can build)", min: DOCK.length[0], max: DOCK.length[1], step: 1, value: 14 },
      { type: "slider", label: "Inside width", min: DOCK.width[0], max: DOCK.width[1], step: 1, value: 5 },
    ], "Show it");
    if (!values) return;
    const dirName = yard.dirName ?? yard.dock?.dirName ?? "north";
    showBlueprint(block, dirName, values[0], values[1]);
    player.sendMessage("§aBlueprint shown for 30 seconds:§r green = place a frame block, white = already right, red = dig this out.");
  }
}

// ---------- build ----------

async function startBuild(player, yard) {
  const known = getKnown(player);
  const plans = Object.values(PLANS).filter((p) => !p.buyOnly && known.has(p.tradition) && p.yardLevel <= yard.level);
  if (!plans.length) {
    const hint = Object.values(PLANS)
      .map((p) => `${p.name}: ${TRADITIONS[p.tradition].name} tradition, learned by bringing ${p.keelWood} logs`)
      .join("\n");
    await info(player, TITLE, `You don't know a plan this yard can build yet. Bring logs to the table to learn their tradition.\n\n${hint}`);
    return;
  }
  let plan = plans[0];
  if (plans.length > 1) {
    const pick = await menu(player, "Choose a plan", "Every boat is built from one plan.", plans.map((p) => p.name));
    if (pick < 0) return;
    plan = plans[pick];
  }
  await stageKeel(player, yard, plan);
}

async function stageKeel(player, yard, plan) {
  const [min, planMax] = plan.lengthRange;
  const max = Math.min(planMax, yard.length);
  if (max < min) {
    await info(player, TITLE, `A ${plan.name} needs at least ${min} clear blocks; this yard has ${yard.length}.`);
    return;
  }
  // Sizes at the tradition's typical proportions, or Advanced to set length, beam and depth yourself.
  const presets = sizePresets(plan, max);
  const pick = await menu(player, "1 of 5: Lay the keel",
    `Choose a size. Each keeps the ${plan.name.toLowerCase()}'s typical proportions (about ${plan.typicalLB} times as long as it is wide).`,
    [...presets.map((s) => `${s.label}: ${s.length} blocks long, ${(s.beam * plan.baseBeam).toFixed(1)} wide`),
     "Advanced: set length, beam and depth"]);
  if (pick < 0) return;
  let length, planned = null;
  if (pick < presets.length) {
    ({ length } = presets[pick]);
    planned = { beam: presets[pick].beam, depth: presets[pick].depth };
  } else {
    const values = await modal(player, `1 of 5: Lay the keel`, [
      { type: "slider", label: `${plan.name} length in blocks (yard fits up to ${max})`, min, max, step: plan.lengthStep ?? 1, value: Math.min(Math.max(min, 6), max) },
    ]);
    if (!values) return;
    const step = plan.lengthStep ?? 1;
    length = Math.min(max, Math.max(min, Math.round(values[0] / step) * step));
  }
  const costs = keelCost(plan, length);
  const preview = computeHandling(newRecord(plan, "preview", length));
  const knots = (preview.max / KNOTS_TO_BPT).toFixed(1);
  if (!(await pay(player, "Lay the keel", `A ${length}-block ${plan.name} keel: top speed about ${knots} knots at a standard beam. Length is fixed once the keel is laid.`, costs, yard.supply))) return;

  const entity = layKeel(yard, plan, length);
  if (planned) {                       // remember the typical beam and depth for the frames
    const rec = readRecord(entity);
    rec.planned = planned;
    writeRecord(entity, rec);
  }
  player.sendMessage(`§aKeel laid: ${length} blocks.`);
  await continueBuild(player, yard, entity);
}

export async function continueBuild(player, yard, entity) {
  const steps = {
    [STAGES.KEEL]: stageFrames,
    [STAGES.FRAMES]: stagePlanking,
    [STAGES.PLANKED]: stageFitOut,
    [STAGES.RIGGED]: stageLaunch,
  };
  for (;;) {
    if (!entity.isValid) return;
    const rec = readRecord(entity);
    if (!rec) return;
    const step = steps[rec.stage];
    if (!step) return;
    const done = await step(player, yard, entity, rec);
    if (!done) {
      saved(player);
      return;
    }
  }
}

async function stageFrames(player, yard, entity, rec) {
  const plan = PLANS[rec.plan];
  const L = rec.dims.length;
  let [bLo, bHi] = beamRange(plan, L);
  if (yard.kind === "dock") {                                   // must fit the basin (both hulls and the gap, for twin hulls)
    const gap = plan.twin ? (PROPORTIONS[plan.id]?.twin_gap ?? 0) * (plan.modelScale ?? 1) : 0;
    bHi = Math.max(bLo, Math.min(bHi, (yard.width - 0.5 - gap) / plan.baseBeam));
  }
  if (rec.planned) {
    // A typical size: the frames follow the tradition's proportions; just confirm.
    const beam = Math.min(bHi, Math.max(bLo, rec.planned.beam));
    const depth = rec.planned.depth;
    const preview = describeHandling(computeHandling({ ...rec, dims: { ...rec.dims, beam, depth } })).slice(0, 3).join("\n");
    if (!(await pay(player, "2 of 5: Raise the frames", `${preview}\n\nTypical proportions: ${(beam * plan.baseBeam).toFixed(1)} blocks wide.`, frameCost(plan, L), yard.supply))) return false;
    raiseFrames(entity, beam, depth);
    return true;
  }
  const fields = [];
  const hasBeamChoice = bHi > bLo;
  // Bedrock sliders only step in whole numbers, so beam and depth are chosen in percent.
  const pct = (v) => Math.round(v * 100);
  const snap5 = (v) => Math.round(v / 5) * 5;
  const [bMin, bMax] = [snap5(pct(bLo)), snap5(pct(bHi))];
  if (hasBeamChoice && bMax > bMin) {
    fields.push({ type: "slider", label: "Beam, % of standard. Wider is steadier and holds more; narrower is faster.", min: bMin, max: bMax, step: 5, value: Math.min(Math.max(100, bMin), bMax) });
  }
  const [dMin, dMax] = [pct(plan.depthScale[0]), pct(plan.depthScale[1])];
  fields.push({ type: "slider", label: "Depth, % of standard. Deeper holds more cargo but draws more water.", min: dMin, max: dMax, step: 5, value: 100 });
  const values = await modal(player, "2 of 5: Raise the frames", fields);
  if (!values) return false;
  const usedBeam = hasBeamChoice && bMax > bMin;
  const beam = usedBeam ? Math.min(bHi, Math.max(bLo, values[0] / 100)) : bLo;
  const depth = Math.min(plan.depthScale[1], Math.max(plan.depthScale[0], values[usedBeam ? 1 : 0] / 100));
  const trial = { ...rec, dims: { ...rec.dims, beam, depth } };
  const preview = describeHandling(computeHandling(trial)).slice(0, 3).join("\n");
  if (!(await pay(player, "Raise the frames", `${preview}\n\nBeam and depth are fixed once the frames are up.`, frameCost(plan, L), yard.supply))) return false;
  raiseFrames(entity, beam, depth);
  return true;
}

async function stagePlanking(player, yard, entity, rec) {
  const plan = PLANS[rec.plan];
  const options = shellChoices(plan);
  const choice = {};
  if (options.length === 1) {
    for (const z of ZONES) choice[z] = options[0].key;       // a dugout is carved from one trunk
  } else {
    const start = Math.max(0, options.findIndex((m) => m.key === defaultShell(plan)));
    const what = plan.shell === "hide" ? "skin" : "planking";
    const values = await modal(player, `3 of 5: ${plan.shell === "hide" ? "Skin" : "Plank"} the hull`, ZONES.map((z) => ({
      type: "dropdown", label: `${ZONE_NAMES[z]} ${what}`, options: options.map((m) => m.name), index: start,
    })));
    if (!values) return false;
    ZONES.forEach((z, i) => (choice[z] = options[values[i]].key));
  }
  const summary = {
    rivets: "Clinker planking: overlapping strakes fastened with iron rivets.",
    string: "Planks sewn together with string, the old way.",
  }[plan.fastening] ?? (plan.shell === "logs" ? "Carving the hull from a single trunk." : plan.shell === "hide" ? "Stretching hide over the frame." : "Planking the hull.");
  if (!(await pay(player, "Plank the hull", summary, plankCost(plan, choice, rec.dims), yard.supply))) return false;
  plankHull(entity, choice);
  return true;
}

async function stageFitOut(player, yard, entity) {
  const launch = await fitOut(player, entity, yard.supply);
  if (!launch) return false;
  const rec = readRecord(entity);
  rig(entity, rec.sections.rig.sail, rec.sections.rig.color);
  return true;
}

async function stageLaunch(player, yard, entity, rec) {
  const values = await modal(player, "5 of 5: Name and launch", [
    { type: "text", label: "Name your boat", placeholder: "Grey Gull", value: "" },
  ], "Launch");
  if (!values) return false;
  const name = String(values[0] || "").trim().slice(0, 32) || "Unnamed";
  try {
    launch(entity, yard, name);
  } catch (e) {
    console.warn(`[Shipwright] Launch failed: ${e}`);
  }
  player.sendMessage(`§a${name} is launched.`);
  return true;
}

// ---------- refit, inspect, info ----------

async function pickBoat(player, title, boats) {
  if (boats.length === 1) return boats[0];
  const pick = await menu(player, title, "Choose a boat.", boats.map((b) => b.rec.name || PLANS[b.rec.plan].name));
  return pick < 0 ? null : boats[pick];
}

async function editMenu(player, launched, supply = []) {
  const boat = await pickBoat(player, "Edit a boat", launched);
  if (!boat) return;
  await editBoat(player, boat.e, supply, false);
}

async function inspectMenu(player, boats) {
  const boat = await pickBoat(player, "Inspect", boats);
  if (!boat) return;
  await info(player, boat.rec.name || PLANS[boat.rec.plan].name, describeShip(readRecord(boat.e) ?? boat.rec));
}

async function yardInfo(player, yard) {
  await info(player, yard.levelName, [
    `Clear strip: ${yard.length} long, ${yard.width} wide, ${yard.height} high, facing ${yard.dirName}.`,
    `Water starts ${yard.waterDist} blocks from the table.`,
    "",
    "Only air, water and small decorations may sit inside the strip.",
    "",
    "§7Next level: a Gate Post placed diagonally from the table at the waterline turns this into a slipway (version 1).§r",
  ].join("\n"));
}
