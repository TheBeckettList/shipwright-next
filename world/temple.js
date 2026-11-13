// Pure. The Sea Rite Temple at Thera: the one faith's heart, where the sea comes in.
//
// Its holy thing is vanilla's own: the conduit, which gives every swimmer in reach the sea's
// blessing (Conduit Power: breath under water, sight in the deep, a faster hand). A conduit wakes
// when set in water with its frame round it: the prismarine on the outer square ring of a 5 x 5
// in each of the three planes through it, 42 places in all, and the more of them filled, the
// further it reaches (16 to wake it, all 42 for its fullest reach, 96 blocks). The Temple fills all
// 42, so the blessing lies over the whole bay.
//
//   the pool    the conduit in the middle of a pool 5 deep, its water open to the sea by a channel
//               down the temple's middle and steps down into the water at its seaward end: the sea
//               comes into the temple, and the faithful go down into the sea
//   the frame   the 42 places, prismarine bricks and dark prismarine, and sea lanterns at the six
//               points where the rings cross (light the pool from within)
//   the house   a platform of calcite in golden proportion (13 by 21, Fibonacci), a colonnade of
//               fluted quartz pillars round it (stood: quartz stood is a column, laid a lintel),
//               spaced by the Fibonacci word, a frieze of prismarine above them (the pack draws
//               prismarine as the 5D string, back to its point every 48 frames: the golden law
//               itself, running round the Temple's brow), a flat roof over the colonnade and the sky
//               open over the pool, a floor of the Therans' blue spiral tiles round it
//   the rite    a lectern (the Reckoning: the law the world runs by), the clerics' brewing stands,
//               the offering chests (the sea tax, the wardens' purse), the bell
//   checks      the conduit's frame counted (all 42), its water whole (every place round it water),
//               the floor lit to 8, every block vanilla
import { FIB, word } from "../core/golden.js";

export const TEMPLE = Object.freeze({ W: FIB[6], L: FIB[7], COLUMN: FIB[4], POOL: FIB[4], FRAME: 42, WAKE: 16, REACH: 96, LIT: 8, LAMP: 15 });   // derived: 13 by 21, columns five high, a pool five across; given: the conduit's 42 frame places, 16 to wake it, its 96 blocks of reach; the light at which nothing spawns, a lantern's light
const K = (x, y, z) => `${x},${y},${z}`;

/** The conduit's 42 frame places round (cx, cy, cz): the outer ring of a 5 x 5 in each of the three planes through it. */   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
export function framePlaces(cx, cy, cz) {
  const out = new Set();
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== 2) continue; out.add(K(cx + a, cy + b, cz)); out.add(K(cx + a, cy, cz + b)); out.add(K(cx, cy + a, cz + b)); }   // given: vanilla's frame
  return [...out].map((k) => k.split(",").map(Number));
}

/** The Temple's voxels (x across, z toward the sea, y up from the platform) and its checks. */
export function seaRiteTemple() {
  const v = new Map(), set = (x, y, z, id, s = null) => v.set(K(x, y, z), { id: `minecraft:${id}`, s }), W = TEMPLE.W, L = TEMPLE.L, H = TEMPLE.COLUMN;
  // the platform, three courses of calcite on tuff
  for (let x = -1; x <= W; x++) for (let z = -1; z <= L; z++) { set(x, -1, z, "tuff_bricks"); set(x, 0, z, "calcite"); }
  // the floor: the Therans' blue spiral tiles in a band round the pool
  const cx = Math.floor(W / 2), cz = Math.floor(L / 2), cy = -2;   // the conduit, two below the floor
  for (let x = cx - 4; x <= cx + 4; x++) for (let z = cz - 4; z <= cz + 4; z++) if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) >= 3) set(x, 0, z, "blue_glazed_terracotta", { facing_direction: 2 + ((x + z) & 1) });   // given: glazed terracotta's facing (turned by turns, the spiral closes)
  // the pool: five across, five deep, water but for the frame
  const frame = framePlaces(cx, cy, cz), isFrame = new Set(frame.map(([x, y, z]) => K(x, y, z)));
  for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) for (let y = cy - 2; y <= 0; y++) { if (isFrame.has(K(x, y, z))) continue; set(x, y, z, "water"); }
  for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 3; z <= cz + 3; z++) for (let y = cy - 3; y <= 0; y++) { if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) === 3 || y === cy - 3) if (!v.get(K(x, y, z)) || v.get(K(x, y, z)).id === "minecraft:calcite") set(x, y, z, y === 0 ? "calcite" : "tuff_bricks"); }   // the pool's walls and floor   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
  const crossings = new Set([[2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2]].map(([a, b, c]) => K(cx + a, cy + b, cz + c)));
  for (const [x, y, z] of frame) set(x, y, z, crossings.has(K(x, y, z)) ? "sea_lantern" : (x + y + z) % 2 ? "prismarine_bricks" : "dark_prismarine");   // the frame: lanterns where the rings cross
  if (v.get(K(cx, 0, cz + 2))?.id !== "minecraft:sea_lantern") {}   // (the top crossing sits at the pool's surface, two above the conduit: below the floor's top, lit)
  set(cx, cy, cz, "conduit");
  // the channel to the sea: down the middle from the pool to the steps, two deep
  for (let z = cz + 3; z <= L; z++) for (let y = -2; y <= 0; y++) { set(cx, y, z, "water"); if (y === -2 || true) { set(cx - 1, y, z, y === 0 ? "calcite" : "tuff_bricks"); set(cx + 1, y, z, y === 0 ? "calcite" : "tuff_bricks"); } set(cx, -3, z, "tuff_bricks"); }   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
  // the steps down into the sea at the seaward end, the width of the temple
  for (let s = 1; s <= 4; s++) for (let x = -1; x <= W; x++) { const z = L + s; set(x, -s, z, "calcite"); for (let y = -s + 1; y <= 0; y++) set(x, y, z, "water"); }   // vision: four steps down
  // the colonnade: fluted quartz stood round the edge, spaced by the word; the frieze above; the roof over the walk round, the sky open over the pool
  const cols = [];
  for (let x = 0, i = 0; x < W; x += word(i++) ? FIB[3] : FIB[2]) cols.push([x, 0], [x, L - 1]);   // derived: three or two apart, as the word reads
  for (let z = 0, i = 0; z < L; z += word(i++ + 7) ? FIB[3] : FIB[2]) cols.push([0, z], [W - 1, z]);   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
  for (const [x, z] of cols) for (let y = 1; y <= H; y++) set(x, y, z, "quartz_pillar", { pillar_axis: "y" });
  for (let x = -1; x <= W; x++) for (let z = -1; z <= L; z++) {
    const edge = x <= 0 || x >= W - 1 || z <= 0 || z >= L - 1, ring = x <= 1 || x >= W - 2 || z <= 1 || z >= L - 2;
    if (edge) set(x, H + 1, z, "prismarine_bricks");   // the frieze: the golden law running round the brow
    if (ring) set(x, H + 2, z, "smooth_quartz"); else if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) > 4) set(x, H + 2, z, "smooth_quartz");   // the roof over the walk; open over the pool and its tiles   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
  }
  for (let x = -1; x <= W; x++) for (const z of [-1, L]) set(x, H + 3, z, "quartz_slab", { "minecraft:vertical_half": "bottom" });   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
  for (let z = -1; z <= L; z++) for (const x of [-1, W]) set(x, H + 3, z, "quartz_slab", { "minecraft:vertical_half": "bottom" });   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
  // the rite's things: the Reckoning on its lectern at the pool's head, the clerics' stands, the offering chests, the bell; the way in from the land side
  set(cx, 1, cz - 5, "lectern", { "minecraft:cardinal_direction": "south" });   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
  for (const dx of [-3, 3]) set(cx + dx, 1, cz - 5, "brewing_stand");   // vision: the Temple's own drawing (blocks: offsets, depths, places of the rite's things)
  for (const dx of [-2, 2]) set(cx + dx, 1, 1, "chest", { "minecraft:cardinal_direction": "south" });
  set(cx, H, 1, "bell", { attachment: "hanging", direction: 0 });
  // lanterns under the roof, over the walk round, until every floor cell is lit
  const lamps = [];
  const floor = () => { const out = []; for (const [k, b] of v) { const [x, y, z] = k.split(",").map(Number); if (y !== 0 || b.id === "minecraft:water") continue; const above = v.get(K(x, 1, z)); if (!above || /lantern/.test(above.id)) out.push([x, 1, z]); } return out; };
  const levels = () => {
    const Lm = new Map(), q = []; const src = [...lamps, ...[...v].filter(([, b]) => /sea_lantern/.test(b.id)).map(([k]) => k.split(",").map(Number))];
    for (const [x, y, z] of src) { Lm.set(K(x, y, z), TEMPLE.LAMP); q.push([x, y, z]); }
    for (let h = 0; h < q.length; h++) { const [x, y, z] = q[h], l = Lm.get(K(x, y, z)); if (l <= 1) continue; for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const k = K(x + a, y + b, z + c), B = v.get(k); if ((B && !/water|lantern|slab|bell|lectern|brewing/.test(B.id)) || (Lm.get(k) ?? 0) >= l - 1 || Math.abs(y + b) > 12) continue; Lm.set(k, l - 1); q.push([x + a, y + b, z + c]); } }   // vision: a bound on the search
    return Lm;
  };
  for (let g = 0; g < FIB[8]; g++) { const Lm = levels(), dark = floor().filter(([x, y, z]) => (Lm.get(K(x, y, z)) ?? 0) < TEMPLE.LIT); if (!dark.length) break; const [x, , z] = dark[Math.floor(dark.length / 2)]; const yy = v.get(K(x, H + 2, z)) ? H + 1 : 2; set(x, yy, z, "lantern", { hanging: yy > 2 }); lamps.push([x, yy, z]); }   // vision: lanterns at most; hung from the roof where there is one
  const Lm = levels(), darkLeft = floor().filter(([x, y, z]) => (Lm.get(K(x, y, z)) ?? 0) < TEMPLE.LIT).length;
  // the conduit's checks
  const filled = frame.filter(([x, y, z]) => /prismarine|sea_lantern/.test(v.get(K(x, y, z))?.id ?? "")).length;
  let wet = 0, round = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { if (!a && !b && !c) continue; round++; if (v.get(K(cx + a, cy + b, cz + c))?.id === "minecraft:water") wet++; }
  const reach = Math.floor(filled / 7) * 16;   // given: vanilla's reach, 16 blocks for every 7 frame blocks
  return { vox: v, conduit: { x: cx, y: cy, z: cz }, lamps, checks: { frame: filled, of: TEMPLE.FRAME, awake: filled >= TEMPLE.WAKE && wet === round, water: `${wet}/${round}`, reach, dark: darkLeft, ok: filled === TEMPLE.FRAME && wet === round && darkLeft === 0 } };
}
