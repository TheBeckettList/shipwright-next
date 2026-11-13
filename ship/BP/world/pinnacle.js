// Pure. Each people's building at its pinnacle: what it raises in Thera, the one city where every people
// builds as close and as high as its own way allows. The house is the culture's own (dwelling.js
// houseOf, dense); the pinnacle stacks it, a household a storey, as the people really stacked:
//   european      the town house of the great ports, five storeys and more (Amsterdam, Edinburgh's lands)
//   indian_ocean  the coral-stone houses of the Swahili coast and the tower houses of Hadhramaut (Shibam)
//   east_asian    the storeyed hall and the walled round house (tulou)
//   japanese      the storeyed merchant house and the keep
//   shallow       the two-storey house on piles
//   therans       the Akrotiri mansion (the West House: three storeys, storerooms under the hall)
//   norse, birchbark, pacific, dugout, arctic: one storey, built long instead (the great hall, the longhouse,
//                 the chief's house on its platform, the cedar plank house, the dance house): their pinnacle is size, not height
// The storeys above the ground reach the street by a gallery along the door's wall and a ladder at its end.
import { FIB } from "../core/golden.js";
import { houseOf } from "./dwelling.js";

export const PARTY = new Set(["european", "indian_ocean", "east_asian", "japanese", "therans"]);   // vision: the peoples who build wall to wall (a lane of one between houses; the rest leave two)
// vision: the peoples whose own way builds up a cliff, house over house (and why); the rest keep to the flat
export const CLIFF = {
  therans: "Fira and Oia: cave houses cut into the caldera, whitewashed",
  european: "the Mediterranean hill towns (Amalfi, Monemvasia): stacked houses down the cliff",
  indian_ocean: "the cliff towns of Hadhramaut and the Yemeni highlands: towers standing on the rock",
  east_asian: "the hanging villages and temples on the gorges' walls",
};
export const PINNACLE = {
  european: { storeys: FIB[4], n: 5 }, indian_ocean: { storeys: FIB[4], n: 6 }, east_asian: { storeys: FIB[3], n: 6 }, japanese: { storeys: FIB[3], n: 5 },   // vision: storeys and households, after the real buildings named above
  dugout: { storeys: 1, n: FIB[6] }, shallow: { storeys: FIB[2], n: 4 }, therans: { storeys: FIB[3], n: 6 },   // vision: storeys and households, after the real buildings named above
  norse: { storeys: 1, n: FIB[6] }, birchbark: { storeys: 1, n: FIB[5] }, pacific: { storeys: 1, n: FIB[5] }, arctic: { storeys: 1, n: FIB[4] },   // vision: storeys and households, after the real buildings named above
};   // vision: storeys (Fibonacci: 1, 2, 3, 5) and households, after the real buildings above; derived: the one-storey peoples build a Fibonacci household larger
const FACING = { north: 2, south: 3, west: 4, east: 5 };   // given: Bedrock's facing_direction

/** A pinnacle building: the culture's dense house, a household a storey. Returns { vox, door, storeys, beds, lamps }. */
export function pinnacle(p, { tradition = p.tradition, job = "fisherman", storeys = null, n = null } = {}) {
  const P = PINNACLE[tradition] ?? { storeys: 1, n: 5 }, S = storeys ?? P.storeys, h = houseOf(p, { n: n ?? P.n, job, tradition, dense: true });   // vision: storeys and households, after the real buildings named above
  if (S <= 1) return { vox: h.vox, door: h.door, storeys: 1, beds: h.n ?? n ?? P.n, lamps: h.lamps.length, house: h, floorY: h.door.y - 1, step: 0 };
  const floorY = h.door.y - 1, H = h.needs.clear, f = H + 1, t = h.needs.thick ?? 1;   // a storey: the floor and its clear height
  const [rx0, rz0, rx1, rz1] = h.rect;
  const inBody = (x, z) => x >= rx0 - t && x <= rx1 + t && z >= rz0 - t && z <= rz1 + t;
  const vox = new Map(), put = (x, y, z, b) => vox.set(`${x},${y},${z}`, b);
  for (const [k, b] of h.vox) {
    const [x, y, z] = k.split(",").map(Number);
    if (y > floorY + H) { put(x, y + (S - 1) * f, z, b); continue; }   // the roof, on the top storey
    put(x, y, z, b);   // the ground storey as it is (its piles, its yard)
    if (y >= floorY && inBody(x, z)) for (let s = 1; s < S; s++) put(x, y + s * f, z, b);   // each storey above: the body only
  }
  // the way up: a gallery outside the door's wall on each storey above, a ladder at its end
  const d = h.door, side = d.z < rz0 ? "north" : d.z > rz1 ? "south" : d.x < rx0 ? "west" : "east";
  const [nx, nz] = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[side];
  const along = nx === 0 ? [rx0 - t, rx1 + t] : [rz0 - t, rz1 + t], line = nx === 0 ? d.z + nz : d.x + nx;
  const floorBlock = h.vox.get(`${Math.round((rx0 + rx1) / 2)},${floorY},${Math.round((rz0 + rz1) / 2)}`) ?? { id: "minecraft:oak_planks", s: null };
  const at = (a) => (nx === 0 ? [a, line] : [line, a]);
  const ladderA = along[1], doorA = nx === 0 ? d.x : d.z;
  const end = ladderA === doorA ? along[0] : ladderA;
  for (let s = 1; s < S; s++) {
    const y = floorY + s * f;
    for (let a = Math.min(along[0], doorA); a <= Math.max(along[1], doorA); a++) { if (a === end) continue; const [x, z] = at(a); put(x, y, z, floorBlock); }
  }
  const [lx, lz] = at(end);
  for (let y = floorY + 1; y <= floorY + (S - 1) * f + 1; y++) put(lx, y, lz, { id: "minecraft:ladder", s: { facing_direction: FACING[side] } });
  // the wall behind the ladder must hold it: fill it where the house left it open
  const [bx, bz] = [lx - nx, lz - nz];
  for (let y = floorY + 1; y <= floorY + (S - 1) * f + 1; y++) if (!vox.has(`${bx},${y},${bz}`)) put(bx, y, bz, floorBlock);
  return { vox, door: h.door, storeys: S, beds: (h.n ?? P.n) * S, lamps: h.lamps.length * S, house: h, floorY, step: f };
}

/** Where its folk stand: floor cells inside the house with two blocks of air over them, storey by storey. */
export function floorsOf(b) {
  const h = b.house, [rx0, rz0, rx1, rz1] = h.rect, out = [];
  for (let s = 0; s < b.storeys; s++) {
    const y = b.floorY + s * b.step;
    for (let x = rx0; x <= rx1; x++) for (let z = rz0; z <= rz1; z++) {
      const f = b.vox.get(`${x},${y},${z}`);
      if (f && !/water|air/.test(f.id) && !b.vox.has(`${x},${y + 1},${z}`) && !b.vox.has(`${x},${y + 2},${z}`)) out.push([x, y + 1, z, s]);
    }
  }
  return out;
}
