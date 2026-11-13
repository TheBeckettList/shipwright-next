// The Theran cothon: the great round harbour as one building, after Carthage's: a ring of covered shipsheds round a
// round basin, two storeys under one roof, a colonnade of white columns along the basin's edge where every pier
// ends; a mouth toward the lagoon between two gate towers, a high arch over it carrying the roof's promenade; and on
// the island in the middle the admiral's house, a round colonnaded tholos with a watch tower, joined to the ring by a
// raised causeway at the roof's height. Everything is laid in true circles about the middle (the ground under it is
// a true circle too, world/city.js), so it is symmetric about the mouth's line.
//
// cothon({ rb, rs, rq, ri, bays, mouth }) -> Map "x,y,z" -> { id, s }, in blocks about the middle (z south), y from
// the first air over the ring's ground (the basin's floor is nine down, the island's ground one up).

const Q = "minecraft:", PIL = { pillar_axis: "y" }, FIB8 = 34;   // given: the eighth Fibonacci number

export function cothon({ rb, rs, rq, ri, bays, mouth, gateHalf, pierHalf = 1 }) {
  const v = new Map(), put = (x, y, z, id, s = null) => v.set(`${x},${y},${z}`, { id: id.includes(":") ? id : Q + id, s });
  const W = (n) => `waterworld:theran_marble_${n}`, G = (n) => `waterworld:blue_glazed_roof_${n}`;
  const R = Math.ceil(rq) + 1, ROOF = 13, FLOOR = -9;   // vision: the eaves thirteen up (a great ship's hull and her mast's stump under cover; the mast is unstepped to haul her up); the basin's floor nine down
  const angOff = (a) => Math.atan2(Math.sin(a - mouth), Math.cos(a - mouth));
  // a bay: a slip and the half piers either side. f: the place round the ring in bays (the pier at f = 0.5, the slip's middle at f = 0);
  // o: blocks from the slip's middle line, toward the pier
  const bayOf = (a, d) => { const f = ((a / (2 * Math.PI)) * bays % 1 + 1) % 1, w = (2 * Math.PI * d) / bays; return { f, w, toPier: Math.abs(f - 0.5) * w, o: Math.min(f, 1 - f) * w, slip: Math.floor((a / (2 * Math.PI)) * bays + bays) % bays }; };
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    const d = Math.hypot(x, z), a = Math.atan2(-z, x);   // the bearing in the plane with y north
    if (d < rb - 0.5 || d > rq + 0.5) continue;
    const along = Math.abs(angOff(a)) * d;
    if (along < gateHalf) continue;   // the mouth: open water, the arch over it is laid below
    const b = bayOf(a, d), pier = b.toPier < pierHalf, pierEdge = pier && b.toPier > pierHalf - 1, outer = d > rq - 1.5, front = d < rb + 1, back = d > rs;
    const step = Math.round(d - rb);   // blocks in from the basin's edge
    // the roof: a gable over each slip, its ridge down the slip's middle, climbing four pixels a block from the eaves over the
    // piers (the Greek pitch), in the Therans' blue glaze; the piers' tops a walk of white marble between the gables
    if (!outer) { if (pier) put(x, ROOF, z, front ? "gold_block" : W(pierEdge ? "polished" : "tile"));
      else { const px = Math.max(0, Math.round(4 * (b.w / 2 - pierHalf - b.o))), full = Math.floor(px / 16), rest = px % 16;   // pixels over the eaves
        put(x, ROOF, z, W("polished")); for (let k = 1; k <= full; k++) put(x, ROOF + k, z, G("full")); if (rest >= 4) put(x, ROOF + full + 1, z, G(`layer_${Math.min(12, Math.round(rest / 4) * 4)}`)); } }
    // the outer wall: white marble, a window to each slip in each storey, a blue band, the egg-and-dart under the parapet
    if (outer) { for (let y = 0; y < ROOF; y++) { const win = !pier && b.o < 2 && (y === 3 || y === 9); put(x, y, z, win ? "light_blue_stained_glass" : y === 6 ? "blue_concrete" : y === ROOF - 1 ? W("egg_dart") : y < 2 ? W("ashlar") : W("polished")); }
      put(x, ROOF, z, W("block")); put(x, ROOF + 1, z, pier ? W("polished") : W("slab")); continue; }
    if (pier) {
      // the pier: a walk of marble the ring's depth, its edges a colonnade (a column every fourth block in) carrying the roof;
      // at the basin a pair of bollards and a lantern, and a crane's mast and boom over each other pier's end
      put(x, 0, z, pierEdge ? W("polished") : W("tile"));
      if (pierEdge && step % 4 === 0) { put(x, 1, z, W("column_base")); for (let y = 2; y < ROOF - 1; y++) put(x, y, z, W("column")); put(x, ROOF - 1, z, W("capital_ionic")); }
      else if (pierEdge && !front) put(x, ROOF - 1, z, W("dentil"));   // the architrave's dentils between the columns
      if (front) { put(x, 1, z, pierEdge ? W("polished") : "iron_chain", pierEdge ? null : { pillar_axis: "y" }); if (!pierEdge && b.slip % 2 === 0) { for (let y = 2; y <= 7; y++) put(x, y, z, "stripped_spruce_log", PIL); put(x, 8, z, "lantern", { hanging: false }); } }   // vision: a bollard each side, a mooring chain's post between; a crane's mast every other pier, a lantern atop
      if (back) for (let y = 1; y < ROOF; y++) if (!pierEdge || y === 1 || y >= ROOF - 1) continue; else put(x, y, z, W("ashlar"));   // the workshops' party walls behind the slips
      continue; }
    // behind the slip's head: the workshop, its floor of marble and a loft (the gear's store) at the storey's height
    if (back) { put(x, 0, z, W("tile")); put(x, 7, z, "spruce_planks"); if (b.o < 1 && step % 3 === 0) put(x, 6, z, "lantern", { hanging: true }); continue; }   // vision: a lantern down the slip's line
    // the slip's own cradle: a keel block every third step down the ramp's middle (the ground is the ramp, world/city.js), and a lantern hung over it
    if (b.o < 0.6 && step % 3 === 0 && d > rb + 2) put(x, ROOF - 1, z, "lantern", { hanging: true });
  }
  // the gate towers either side of the mouth, at the ring's middle, and the arch between them
  const rm = (rb + rq) / 2, TOW = FIB8, tr = 5;   // vision: the towers thirty-four up (over the arch), five out
  const towers = [-1, 1].map((sd) => { const a = mouth + sd * (gateHalf + tr + 1) / rm; return [Math.round(Math.cos(a) * rm), -Math.round(Math.sin(a) * rm)]; });
  for (const [tx, tz] of towers) for (let x = -tr - 1; x <= tr + 1; x++) for (let z = -tr - 1; z <= tr + 1; z++) { const d = Math.hypot(x, z); if (d > tr + 0.5) continue;
    for (let y = FLOOR; y <= TOW; y++) { const shell = d > tr - 1; if (!shell && y > FLOOR && y < TOW) continue; put(tx + x, y, tz + z, y === TOW ? (shell ? "gold_block" : "sea_lantern") : y === 4 || y === ROOF ? "blue_concrete" : (y === 6 || y === 12) && Math.abs(x) + Math.abs(z) <= tr && (x === 0 || z === 0) ? "light_blue_stained_glass" : "waterworld:theran_marble_polished"); }
    put(tx, TOW + 1, tz, "lantern", { hanging: false }); }
  { const [ax, az] = towers[0], [bx, bz] = towers[1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, ARCH = 27;   // derived: the arch's deck at the skyways' clearance (world/theraplan.js DECK, thirty over the sea; the ring stands three up): a great ship sails in under it with her mast stepped
    for (let t = tr; t <= L - tr; t += 0.5) for (let w = -1.5; w <= 1.5; w += 0.5) { const x = Math.round(ax + ux * t + nx * w), z = Math.round(az + uz * t + nz * w), edge = Math.abs(w) > 1;
      put(x, ARCH, z, edge ? "waterworld:theran_marble_ashlar" : "waterworld:theran_marble_block"); if (edge) put(x, ARCH + 1, z, "quartz_slab");
      const s = (t - tr) / (L - 2 * tr), sag = Math.round(4 * (1 - Math.pow(2 * s - 1, 2)));   // the arch's soffit: down four at the towers, flush at the crown
      for (let y = ARCH - 1; y >= ARCH - 1 - (4 - sag); y--) put(x, y, z, y === ARCH - 1 ? "chiseled_quartz_block" : "waterworld:theran_marble_polished"); } }
  // the island: the admiral's house, a tholos: twenty-one columns round a white cella, a stepped roof, a watch tower
  const rt = Math.min(ri - 3, 11), rc = rt - 3, TOP = 12, WATCH = 21;   // vision: the tholos inside the island's rim, its cella three in; the tower twenty-one up
  const cols = 21;
  for (let x = -ri; x <= ri; x++) for (let z = -ri; z <= ri; z++) { const d = Math.hypot(x, z), a = Math.atan2(-z, x); if (d > ri + 0.4) continue;
    if (d <= rt + 1) put(x, 0, z, d > rt ? "waterworld:theran_marble_ashlar" : (x + z) % 2 ? "smooth_quartz" : "waterworld:theran_marble_polished");   // its platform
    else if (Math.round(a * 8 / Math.PI) % 2 === 0 && d > ri - 1) put(x, 1, z, "flowering_azalea");   // a hedge round the island's edge
    const colHere = Math.abs(d - rt) < 0.6 && Math.abs(((a / (2 * Math.PI)) * cols % 1 + 1) % 1 - 0.5) * (2 * Math.PI * rt / cols) < 0.8;
    if (colHere) for (let y = 1; y <= 7; y++) put(x, y, z, y === 1 ? "waterworld:theran_marble_column_base" : y === 7 ? "waterworld:theran_marble_capital_ionic" : "waterworld:theran_marble_column");
    if (Math.abs(d - rc) < 0.6) { const door = Math.abs(angOff(a)) * d < 1.6; for (let y = 1; y <= 7; y++) { if (door && y <= 3) continue; put(x, y, z, y === 5 && Math.round(a * 12 / Math.PI) % 2 === 0 ? "light_blue_stained_glass" : y === 4 ? "blue_concrete" : "waterworld:theran_marble_polished"); } }
    if (d <= rt + 1) { put(x, 8, z, d > rt - 0.5 ? "chiseled_quartz_block" : "waterworld:theran_marble_block"); if (d > rt - 0.5) put(x, 9, z, "blue_concrete"); }
    for (let k = 1; k <= 3; k++) if (d <= rt + 1 - 3 * k && d > rt + 1 - 3 * k - 1.5) put(x, 8 + k, z, k === 3 ? "gold_block" : "waterworld:theran_marble_block");   // the roof's steps
  }
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) { const d = Math.hypot(x, z); if (d > 2.5) continue;
    for (let y = TOP; y <= WATCH; y++) { const shell = d > 1.5; if (!shell && y < WATCH) continue; put(x, y, z, y === WATCH ? "gold_block" : y === WATCH - 2 && (x === 0 || z === 0) ? "light_blue_stained_glass" : y === 16 ? "blue_concrete" : "waterworld:theran_marble_polished"); } }
  put(0, WATCH + 1, 0, "sea_lantern"); put(0, WATCH + 2, 0, "lantern", { hanging: false });
  // the causeway: from the island to the ring's roof, opposite the mouth, climbing in half steps from the island's
  // ground to the roof's height (a half block a block), then level, on columns from the basin's floor
  { const a = mouth + Math.PI, ux = Math.cos(a), uz = -Math.sin(a), nx = -uz, nz = ux;
    for (let t = rt + 1; t <= rb + 1; t += 0.5) for (let w = -1.5; w <= 1.5; w += 0.5) { const x = Math.round(ux * t + nx * w), z = Math.round(uz * t + nz * w), edge = Math.abs(w) > 1;
      const hh = Math.max(0, Math.min(2 * ROOF, Math.floor(t - ri) + 2)), y = Math.floor(hh / 2), half = hh % 2 === 1;   // half blocks up
      if (half) { put(x, y + 1, z, "smooth_quartz_slab"); put(x, y, z, "waterworld:theran_marble_block"); } else put(x, y, z, edge ? "waterworld:theran_marble_ashlar" : "waterworld:theran_marble_block");
      for (let yy = y + 1; yy <= y + 3; yy++) if (!(half && yy === y + 1)) v.delete(`${x},${yy},${z}`);   // headroom
      if (edge && !half) put(x, y + 1, z, "quartz_slab");
      if (t > ri && Math.abs(w) < 0.3 && Math.round(t * 2) % 16 === 0) for (let yy = FLOOR; yy < y; yy++) put(x, yy, z, "quartz_pillar", PIL); } }
  return v;
}
