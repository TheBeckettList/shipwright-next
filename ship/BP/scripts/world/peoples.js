// Pure. Who lives on the sea world: confederations of island groups. Each confederation has a
// capital group, a culture (one of the Shipwright traditions, chosen by the capital's climate), and
// a footprint: its member groups, which may lie in other climates, held more strongly near the
// capital. Groups far out on the footprint keep a local tradition too, so cultures blend at the edges.
// Sea lanes join each member toward the capital and each capital to its nearest neighbours: that's
// where trade sails, and where most wrecks lie.
import { rand, hash } from "./noise.js";
import { groupAt, greatAt, climate, place, GROUP_CELL, GREAT_CELL } from "./terrain.js";
import { TRADITION_WOOD, AFFINITY, woodsOf, BIOMES } from "./biomes.js";

export const CONFED_CELL = 2200;       // one confederation's seat per cell this size

/** Which traditions fit a climate, most likely first. */
export const TRADITIONS_BY_CLIMATE = {
  polar: ["arctic"],
  boreal: ["norse", "birchbark"],
  temperate: ["european", "norse", "japanese"],
  dry: ["european", "east_asian"],
  arid: ["indian_ocean"],
  savanna: ["indian_ocean", "east_asian", "dugout"],
  tropical: ["pacific", "east_asian"],
  wet: ["shallow", "dugout", "pacific"],
};

const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * r * list.length))];   // the first most often

const woodCache = new Map();
/** What an island group grows: wood kind -> share of its land (sampled), and its land biomes. */
export function groupWoods(seed, g) {
  const key = `${seed}|${g.id}`;
  if (woodCache.has(key)) return woodCache.get(key);
  const it = groupWoodsSteps(seed, g);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
/** groupWoods in steps (four samples a step: each sample is the full field math). */
export function* groupWoodsSteps(seed, g) {
  const key = `${seed}|${g.id}`;
  if (woodCache.has(key)) return woodCache.get(key);
  const woods = {}, biomes = {};
  let land = 0;
  for (let i = 0; i < 16; i++) {
    if (i && (i & 3) === 0) yield;
    const a = rand(i, seed, 501) * Math.PI * 2, d = Math.sqrt(rand(i, seed, 502)) * g.R * (g.great ? 1.2 : 0.9);
    const p = place(seed, g.x + Math.cos(a) * d * g.stretch, g.z + Math.sin(a) * d);
    if (!p.land) continue;
    land++;
    biomes[p.biome] = (biomes[p.biome] ?? 0) + 1;
    for (const w of new Set(woodsOf(p.biome))) woods[w] = (woods[w] ?? 0) + 1;
  }
  for (const k in woods) woods[k] /= Math.max(1, land);
  const out = { woods, biomes, land };
  woodCache.set(key, out);
  if (woodCache.size > 4000) woodCache.delete(woodCache.keys().next().value);
  return out;
}

/**
 * Which people a set of islands can hold: each tradition scored by how much of its boat wood the
 * islands grow (held more strongly near the capital), so a culture is only ever where it can build.
 * Chosen by weighted lot; null when nothing grows (open reefs), so the climate decides.
 */
export function cultureFor(seed, groups, holds, r, least = 0.02) {
  const score = {};
  groups.forEach((g, i) => {
    const w = groupWoods(seed, g).woods;
    for (const [t, wood] of Object.entries(TRADITION_WOOD)) score[t] = (score[t] ?? 0) + (w[wood] ?? 0) * holds[i] * AFFINITY[t];
  });
  const entries = Object.entries(score).filter(([, v]) => v > least).map(([t, v]) => [t, v]);           // as likely as the share of land that grows the wood
  if (!entries.length) return null;
  const total = entries.reduce((a, [, v]) => a + v, 0);
  let x = r * total;
  for (const [t, v] of entries) { if (x < v) return t; x -= v; }
  return entries[entries.length - 1][0];
}

/** The confederation seated in a big cell: its seat (a point), before groups are gathered to it. */
export function seatAt(seed, cx, cz) {
  return { id: `c${cx},${cz}`, cx, cz, x: (cx + 0.15 + 0.7 * rand(cx, cz, seed, 61)) * CONFED_CELL, z: (cz + 0.15 + 0.7 * rand(cx, cz, seed, 62)) * CONFED_CELL };
}

/** The seat nearest a place (its confederation holds the place). */
export function seatFor(seed, x, z) {
  const cx = Math.floor(x / CONFED_CELL), cz = Math.floor(z / CONFED_CELL);
  let best = null, bd = Infinity;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const s = seatAt(seed, cx + i, cz + j);
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

/** All island groups (and great islands) in a confederation's reach. */
function groupsIn(seed, seat) {
  const out = [];
  const R = CONFED_CELL * 1.2;
  for (let gx = Math.floor((seat.x - R) / GROUP_CELL); gx <= Math.floor((seat.x + R) / GROUP_CELL); gx++)
    for (let gz = Math.floor((seat.z - R) / GROUP_CELL); gz <= Math.floor((seat.z + R) / GROUP_CELL); gz++) {
      const g = groupAt(seed, gx, gz);
      if (g && seatFor(seed, g.x, g.z).id === seat.id) out.push(g);
    }
  for (let gx = Math.floor((seat.x - R) / GREAT_CELL); gx <= Math.floor((seat.x + R) / GREAT_CELL); gx++)
    for (let gz = Math.floor((seat.z - R) / GREAT_CELL); gz <= Math.floor((seat.z + R) / GREAT_CELL); gz++) {
      const g = greatAt(seed, gx, gz);
      if (g && seatFor(seed, g.x, g.z).id === seat.id) out.push(g);
    }
  return out;
}

const cache = new Map();
/**
 * A confederation, worked out in full: capital, culture, members (each with its hold on it, 0..1,
 * and the tradition its people follow), and its lanes. Cached: the game asks often.
 */
export function confederation(seed, seat) {
  const key = `${seed}|${seat.id}`;
  if (cache.has(key)) return cache.get(key);
  const groups = groupsIn(seed, seat);
  let capital = null, bd = Infinity;
  for (const g of groups) {
    const d = Math.hypot(g.x - seat.x, g.z - seat.z) - (g.great ? 600 : 0);   // a great island draws the capital
    if (d < bd) { bd = d; capital = g; }
  }
  const cc = capital ? climate(seed, capital.x, capital.z).key : "temperate";
  const far = Math.max(1, ...groups.map((g) => Math.hypot(g.x - (capital?.x ?? seat.x), g.z - (capital?.z ?? seat.z))));
  const holdOf = (g) => (g === capital ? 1 : Math.max(0.1, 1 - Math.hypot(g.x - capital.x, g.z - capital.z) / (far * 1.15)));
  // the capital's island and those nearest it decide the people; the woods they grow decide who can live there
  const culture = (capital && cultureFor(seed, groups, groups.map((g) => holdOf(g) ** 2), rand(seat.cx, seat.cz, seed, 63)))
    ?? (capital && cultureFor(seed, groups, groups.map(() => 1), rand(seat.cx, seat.cz, seed, 65), 0))
    ?? null;                                                   // islands that grow no boat wood: nobody settled
  const members = groups.map((g) => {
    const d = capital ? Math.hypot(g.x - capital.x, g.z - capital.z) : far;
    const hold = g === capital ? 1 : Math.max(0.1, 1 - d / (far * 1.15));
    const local = climate(seed, g.x, g.z).key;
    // weakly held groups in another climate keep a tradition of their own
    // weakly held islands that can't grow the confederation's wood keep a people of their own
    const grows = (groupWoods(seed, g).woods[TRADITION_WOOD[culture]] ?? 0) > 0;
    const own = !culture ? null : hold < 0.45 && !grows ? (cultureFor(seed, [g], [1], rand(g.x | 0, g.z | 0, seed, 64)) ?? culture) : culture;
    return { id: g.id, x: g.x, z: g.z, R: g.R, great: g.great, climate: local, hold, tradition: own, capital: g === capital };
  });
  // lanes: each member to the nearest member nearer the capital than itself (a tree toward the capital)
  const lanes = [];
  if (capital && culture) {
    const byD = [...members].sort((a, b) => Math.hypot(a.x - capital.x, a.z - capital.z) - Math.hypot(b.x - capital.x, b.z - capital.z));
    for (let i = 1; i < byD.length; i++) {
      const m = byD[i];
      let to = byD[0], td = Infinity;
      for (let j = 0; j < i; j++) {
        const d = Math.hypot(byD[j].x - m.x, byD[j].z - m.z);
        if (d < td) { td = d; to = byD[j]; }
      }
      lanes.push({ a: { x: m.x, z: m.z }, b: { x: to.x, z: to.z }, kind: "home", culture });
    }
  }
  const c = { id: seat.id, seat, capital: capital && culture ? members.find((m) => m.capital) : null, culture, members, lanes,
    name: culture ? confedName(seed, seat, culture) : `${confedName(seed, seat, "european")} (unsettled)` };
  cache.set(key, c);
  if (cache.size > 600) cache.delete(cache.keys().next().value);
  return c;
}

/** The long lanes between this confederation's capital and its two nearest neighbouring capitals. */
const capCache = new Map();
/**
 * A seat's capital, cheaply: its nearest group (a great island draws it), and whether anyone could
 * live there (its island grows some boat wood). What the long lanes need from a neighbour, without
 * working out its whole people.
 */
function capitalGroup(seed, seat) {
  let capital = null, bd = Infinity;
  for (const g of groupsIn(seed, seat)) {
    const d = Math.hypot(g.x - seat.x, g.z - seat.z) - (g.great ? 600 : 0);
    if (d < bd) { bd = d; capital = g; }
  }
  return capital;
}
export function seatCapital(seed, seat) {
  const key = `${seed}|${seat.id}`;
  if (capCache.has(key)) return capCache.get(key);
  const capital = capitalGroup(seed, seat);
  const lives = !!capital && Object.entries(groupWoods(seed, capital).woods).some(([w, v]) => v > 0 && Object.values(TRADITION_WOOD).includes(w));
  const out = lives ? { x: capital.x, z: capital.z } : null;
  capCache.set(key, out);
  if (capCache.size > 2000) capCache.delete(capCache.keys().next().value);
  return out;
}

/** The long lanes between this confederation's capital and its two nearest neighbouring capitals. */
export function farLanes(seed, seat) {
  const me = confederation(seed, seat);
  if (!me.capital) return [];
  const others = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    if (!i && !j) continue;
    const o = seatCapital(seed, seatAt(seed, seat.cx + i, seat.cz + j));
    if (o) others.push(o);
  }
  others.sort((a, b) => Math.hypot(a.x - me.capital.x, a.z - me.capital.z) - Math.hypot(b.x - me.capital.x, b.z - me.capital.z));
  return others.slice(0, 2).map((o) => ({ a: { x: me.capital.x, z: me.capital.z }, b: { x: o.x, z: o.z }, kind: "far", culture: me.culture }));
}

/** Works out the peoples round a place one confederation at a time (a generator, for game jobs). */
export function* warmPeoples(seed, x, z, r = 2) {
  // r 2: a site near a chunk can lie over a border, and its lanes ask after the seats round that
  const cx = Math.floor(x / CONFED_CELL), cz = Math.floor(z / CONFED_CELL);
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) yield* warmSeat(seed, seatAt(seed, cx + i, cz + j));
  for (let i = -r + 1; i <= r - 1; i++) for (let j = -r + 1; j <= r - 1; j++) {
    if (!laneCache.has(`${seed}|${cx + i},${cz + j}`)) { lanesNear(seed, (cx + i + 0.5) * CONFED_CELL, (cz + j + 0.5) * CONFED_CELL); yield; }
  }
}
/** One confederation worked out, a step at a time: its islands' woods, its neighbours' capitals, itself. */
function* warmSeat(seed, seat) {
  if (!cache.has(`${seed}|${seat.id}`)) {
    for (const g of groupsIn(seed, seat)) if (!woodCache.has(`${seed}|${g.id}`)) { yield* groupWoodsSteps(seed, g); yield; }   // the woods, an island at a time
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) yield* warmCapital(seed, seatAt(seed, seat.cx + a, seat.cz + b));
    confederation(seed, seat);
    yield;
  }
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) yield* warmCapital(seed, seatAt(seed, seat.cx + a, seat.cz + b));
}
function* warmCapital(seed, n) {
  if (capCache.has(`${seed}|${n.id}`)) return;
  const cap = capitalGroup(seed, n);
  yield;
  if (cap) yield* groupWoodsSteps(seed, cap);
  seatCapital(seed, n);
  yield;
}
/** The confederation whose water a place is in, worked out a step at a time (what peopleAt there asks for). */
export function* warmPlace(seed, x, z) {
  yield* warmSeat(seed, seatFor(seed, x, z));
}

/** Whether the peoples round a place are worked out (so a chunk there won't stall on them). */
export function peoplesReady(seed, x, z) {
  const cx = Math.floor(x / CONFED_CELL), cz = Math.floor(z / CONFED_CELL);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (!cache.has(`${seed}|${seatAt(seed, cx + i, cz + j).id}`)) return false;
  return true;
}

/** Every lane that could pass near a place: this and the neighbouring confederations' home and far lanes. */
const laneCache = new Map();
export function lanesNear(seed, x, z) {
  const cx = Math.floor(x / CONFED_CELL), cz = Math.floor(z / CONFED_CELL);
  const key = `${seed}|${cx},${cz}`;
  const hit = laneCache.get(key);
  if (hit) return hit;
  const out = gatherLanes(seed, cx, cz);
  laneCache.set(key, out);
  if (laneCache.size > 256) laneCache.delete(laneCache.keys().next().value);
  return out;
}
function gatherLanes(seed, cx, cz) {
  const out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const s = seatAt(seed, cx + i, cz + j);
    out.push(...confederation(seed, s).lanes, ...farLanes(seed, s));
  }
  return out;
}

/** Distance from a point to a lane (a segment), and where along it. */
export function toLane(l, x, z) {
  const vx = l.b.x - l.a.x, vz = l.b.z - l.a.z;
  const L2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((x - l.a.x) * vx + (z - l.a.z) * vz) / L2));
  return { d: Math.hypot(l.a.x + vx * t - x, l.a.z + vz * t - z), t };
}

/** Whose water a place is: the confederation, the nearest member group, and its hold there (0..1). */
export function peopleAt(seed, x, z, { neighbours = true } = {}) {
  const c = confederation(seed, seatFor(seed, x, z));
  let near = null, nd = Infinity;
  for (const m of c.members) {
    const d = Math.hypot(m.x - x, m.z - z) - m.R;
    if (d < nd) { nd = d; near = m; }
  }
  if (!c.culture && !neighbours) return { confed: c, member: near, hold: 0, tradition: null, unsettled: true };
  if (!c.culture) {                    // unsettled water: whoever sails past is the nearest people's
    let best = null, bd = Infinity;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const o = confederation(seed, seatAt(seed, c.seat.cx + i, c.seat.cz + j));
      if (!o.culture || !o.capital) continue;
      const d = Math.hypot(o.capital.x - x, o.capital.z - z);
      if (d < bd) { bd = d; best = o; }
    }
    return { confed: c, member: near, hold: 0, tradition: best?.culture ?? "european", unsettled: true };
  }
  const hold = near ? near.hold * Math.max(0, 1 - Math.max(0, nd) / 900) : 0;
  return { confed: c, member: near, hold, tradition: near?.tradition ?? c.culture };
}

const SYL = {
  arctic: ["Ki", "na", "tak", "ssu", "a", "liq"], norse: ["Hal", "vik", "sund", "ey", "fjor", "dal"], birchbark: ["Wa", "ba", "sik", "o", "mak", "na"],
  european: ["Ar", "mor", "lin", "ton", "brea", "ven"], japanese: ["Shi", "ma", "ku", "ra", "to", "na"], east_asian: ["Lin", "hai", "shan", "zhou", "an", "ling"],
  indian_ocean: ["Za", "ra", "mal", "ind", "ka", "si"], pacific: ["Ta", "ma", "ka", "lo", "ni", "va"], shallow: ["Bay", "ou", "mar", "sh", "ra", "lin"],
  dugout: ["Ko", "ma", "lu", "ba", "nde", "ri"],
};
/** A made-up name in the culture's sounds (never a real place). */
export function confedName(seed, seat, culture) {
  const s = SYL[culture] ?? SYL.european;
  const a = s[hash(seat.cx, seat.cz, seed, 71) % s.length], b = s[hash(seat.cx, seat.cz, seed, 72) % s.length];
  const c = s[hash(seat.cx, seat.cz, seed, 73) % s.length];
  const word = (a + b + (hash(seat.cx, seat.cz, seed, 74) % 2 ? c : "")).toLowerCase();
  return word[0].toUpperCase() + word.slice(1);
}
