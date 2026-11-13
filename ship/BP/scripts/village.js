// Village docks (yard level 2): the buildings of a vanilla village of the dock's biome, sized for
// work and nothing more. A boat shed with a net loft facing the dock, a fisher's cottage on the port
// side, and a small landing on the starboard side where the Shipwright's Table stands, with a bench,
// a lamp and the village bell. Same frames as the tradition yards (yardarch.js): u toward each
// building's front, w to its right, dy above the ground.
import { hall, gableRoof, flatRoof, lampPost, deck, hang, SEA, LAND, PORT, STAR } from "./yardarch.js";

/** Draws a village dock's buildings on canvas c. pal: VILLAGES[key]. Returns a line per building. */
export function layoutVillage(c, pal, { left, right }) {
  const main = c.place(-4, 0, 0);                    // behind the walkway, facing the dock
  const home = c.place(3, -(left + 4), 1);           // port side, facing the dock
  const side = c.place(3, right + 3, 3);             // starboard side, facing the dock
  const roof = (f, n, dy) => (pal.flat
    ? flatRoof(f, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy, block: pal.roofFull, parapet: pal.found, cap: pal.log })
    : gableRoof(f, { u0: n.u0, u1: n.u1, w0: n.w0, w1: n.w1, dy, stair: pal.roof, full: pal.roofFull, slab: pal.roofSlab, pitch: 1, eave: 1, ends: 1, gable: pal.planks }));

  // ---- The boat shed: wide doors to the dock, the bench and stores along the back, a net loft.
  const n = hall(main, { L: 6, h: 3, H: 4, floor: pal.planks, base: pal.found, baseH: 1, post: pal.log, bay: 3, beam: pal.strip,
    wall: pal.planks, window: pal.window, winY: [2], open: (u, w, y) => u === 0 && Math.abs(w) <= 1 && y <= 3 });
  roof(main, n, 6);
  // the back wall: everything a shipwright reaches for, in one row
  main.put(n.u0 + 1, -2, 1, "minecraft:crafting_table");
  main.put(n.u0 + 1, -1, 1, "minecraft:barrel"); main.put(n.u0 + 1, -1, 2, "minecraft:barrel");
  main.put(n.u0 + 1, 0, 1, "minecraft:chest");
  main.put(n.u0 + 1, 1, 1, "minecraft:grindstone");
  main.put(n.u0 + 1, 2, 1, "minecraft:barrel"); main.put(n.u0 + 1, 2, 2, pal.lamp);
  // the net loft over the back half (slabs on the beam), with the nets hung (trapdoors) and a ladder up
  for (let u = n.u0 + 1; u <= n.u0 + 2; u++) for (let w = -2; w <= 2; w++) main.slab(u, w, 4, pal.slab, true);
  for (let w = -1; w <= 1; w++) main.put(n.u0 + 1, w, 5, "minecraft:white_carpet");
  for (const w of [-2, 2]) main.put(n.u0 + 2, w, 5, pal.extra);
  for (let y = 1; y <= 4; y++) main.put(n.u0 + 3, -2, y, "minecraft:ladder", { facing: STAR });   // against the side wall (w = -3)
  main.remove(n.u0 + 3, -2, 4);
  main.put(n.u0 + 3, -2, 4, "minecraft:ladder", { facing: STAR });
  // a lantern over the door, under the beam
  hang(main, 0, 0, 3);
  main.put(0, 0, 4, pal.strip, { axis: "along_w" });

  // ---- The fisher's cottage: a door, a bed, a chest, a stove, a window with a flower.
  const h = hall(home, { L: 5, h: 2, H: 3, floor: pal.planks, base: pal.found, baseH: 1, post: pal.log, bay: 4, wall: pal.planks,
    door: { w: 1, h: 2 }, lintel: pal.strip, window: pal.window, winY: [2] });
  roof(home, h, 5);
  home.put(0, 0, 1, pal.door, { door: SEA }); home.put(0, 0, 2, pal.door, { door: SEA, upper: true });
  home.put(-3, -1, 1, "minecraft:bed", { bed: LAND, head: true }); home.put(-2, -1, 1, "minecraft:bed", { bed: LAND });
  home.put(-3, 1, 1, "minecraft:chest");
  home.put(-1, 1, 1, "minecraft:smoker");
  home.put(-2, 1, 1, "minecraft:barrel"); home.put(-2, 1, 2, pal.lamp);
  if (pal.flower) home.put(-1, -1, 1, pal.flower);
  // a step up to the door and a stack of the village's goods by the wall
  home.stair(1, 0, 0, pal.stairs, SEA);
  home.put(1, -2, 1, pal.extra); home.put(1, 2, 1, "minecraft:composter");

  // ---- The landing: where the table stands over the dock; a bench, the bell, a lamp and a stall.
  const d = deck(side, { L: 4, h: 2, floor: pal.planks, edge: pal.slab });
  side.stair(-2, -2, 1, pal.stairs, PORT); side.stair(-1, -2, 1, pal.stairs, PORT);
  side.put(d.u0, 2, 1, "minecraft:bell", { bell: true });
  side.put(d.u0, -2, 1, "minecraft:barrel"); side.put(d.u0, -1, 1, "minecraft:barrel");
  lampPost(side, 0, 2, pal.fence, pal.lamp);
  // the stall's awning: two posts and a slab roof over the barrels
  for (const w of [-2, -1]) for (let y = 2; y <= 3; y++) side.put(d.u0, w, y, pal.fence);
  for (const w of [-2, -1]) for (const u of [d.u0, d.u0 + 1]) side.slab(u, w, 4, pal.slab);
  for (const w of [-2, -1]) for (let y = 1; y <= 3; y++) side.put(d.u0 + 1, w, y, pal.fence);
  return [`boat shed with a work bench, stores and a net loft (${pal.name.toLowerCase()})`, "fisher's cottage with a bed, chest and stove",
    "landing with a bench, the village bell, a lamp and a market stall"];
}
