// Pure. A hull under sail and helm, on the globe, as one reversible step (reversible.js).
//
// Everything a hull does follows from its length L (blocks = metres) and its rig, through the
// naval architects' laws and Minecraft's gravity:
//   mass       the water it displaces: L x beam x draught x block coefficient (VISION.HULL)
//   wetted     Denny's surface, S = 2.6 sqrt(volume x L)
//   drag       skin friction 1/2 rho S Cf v^2, rising steeply past the hull's Froude limit
//              (Fr = v / sqrt(g L) = 0.4: a displacement hull can't outrun its own bow wave)
//   sail       1/2 rho_air A |apparent wind|^2 times the rig's polar: lift and drag of the sail,
//              resolved along the hull (drive) and across it (the push the keel resists, the heel)
//   roll       an oscillator round the heel the sail pushes her to, period ~ sqrt(L)
//   turn       at full helm she turns a circle TURN_RADIUS_L lengths across
//
// The step, as ops (shears are internal motion, records are exchanges with wind and water):
//   record U  (wind drives, water drags)     record V  (the keel's grip)
//   shear  Wr (roll rate, toward the heel)   shear  Th += Wr      record Wr (roll damping)
//   shear  R  (the rudder)                   record R  (turn damping)   shear H += R
//   shear  X  (east: along her heading, over the globe's metric, plus the current)
//   shear  Z  (south: along her heading)
// X and Z are cover coordinates (globe.js): no seams in the state; the world sees fold(X, Z).
import { VISION, GIVEN, D } from "./given.js";
import { Q, TURN, HALF, sinQ, cosQ, mulQ, mod, bearingOf, turnDiff } from "./fixed.js";
import { fold, onSheet, metric, W } from "./globe.js";
import { windAt, GUST_BEAT } from "./wind.js";
import { currentEast, wavesAt, surface } from "./sea.js";

const TAU = 2 * Math.PI;                                          // given
const ACC = Q / (GIVEN.TICKS_PER_S * GIVEN.TICKS_PER_S);          // derived: Q units per tick of speed, per m/s^2
const SPD = GIVEN.TICKS_PER_S / Q;                                // derived: m/s per Q unit a tick

/** A hull's derived constants from its length and rig. */
export function hull(L, rig = "square") {
  const { LB, BT, CB } = VISION.HULL;
  const beam = L / LB, draught = beam / BT, vol = L * beam * draught * CB;
  const mass = vol * GIVEN.RHO_WATER;
  const wetted = 2.6 * Math.sqrt(vol * L);                       // given: Denny's wetted-surface formula
  const hullSpeed = VISION.HULL_FROUDE * Math.sqrt(GIVEN.G * L) * GIVEN.TICKS_PER_S;   // m/s
  const rollPeriod = VISION.ROLL_PERIOD * Math.sqrt(L / VISION.ROLL_REF_L);
  return { L, rig, beam, draught, vol, mass, wetted, sail: VISION.SAIL_AREA * L * L, hullSpeed, rollPeriod,
    omega2: (TAU / rollPeriod) ** 2, luff: VISION.RIG[rig]?.luff ?? VISION.RIG.square.luff };
}

/** The rig's polar at an apparent wind angle beta (degrees off the bow): drive and side coefficients. */
export function polar(beta, luff) {
  const P = VISION.POLAR, b = (beta * Math.PI) / 180;                     // given: degrees to radians
  const set = Math.max(0, Math.min(1, (beta - luff) / P.FILL));           // the sail fills past the luff angle
  const cl = P.CL * set * (beta <= 90 ? 1 : Math.sin(b));                 // lift falls away as she bears off downwind
  const cd = (P.CD0 + P.CD_RUN * ((1 - Math.cos(b)) / 2) ** 2) * set;     // and the sail becomes a wall the wind pushes
  return { x: cl * Math.sin(b) - cd * Math.cos(b), y: cl * Math.cos(b) + cd * Math.sin(b) };
}

/** Where the cover point is on the world, from Z alone for the z and the sheet (so X's shear never reads X). */
const zSide = (Z) => fold(0, Z / Q);

// The wind round a boat changes on its second rung (gusts step once a second, wind.js): read once a
// second for the chunk she's in. Shears may use it: it's a function of place and the second only.
const windCache = new Map();
function windNear(x, z, t) {
  const sec = Math.floor(t / GUST_BEAT), key = `${Math.floor(x / GIVEN.CHUNK)},${Math.floor(z / GIVEN.CHUNK)},${sec}`;
  let w = windCache.get(key);
  if (!w) { w = windAt(Math.floor(x / GIVEN.CHUNK) * GIVEN.CHUNK, Math.floor(z / GIVEN.CHUNK) * GIVEN.CHUNK, sec * GUST_BEAT); windCache.set(key, w); if (windCache.size > VISION.TRAIN_CACHE) windCache.delete(windCache.keys().next().value); }
  return w;
}

/** What the wind does to her this tick (accelerations in m/s^2, heel target in degrees). */
export function sailForce(s, h, t) {
  const f = fold(s.X / Q, s.Z / Q);
  const w = onSheet(windNear(f.x, f.z, t), f.sheet);                      // the true wind, on the cover
  const fe = sinQ(s.H) / Q, fs = -cosQ(s.H) / Q, re = cosQ(s.H) / Q, rs = sinQ(s.H) / Q;
  const ve = (s.U * fe + s.V * re) * SPD, vs = (s.U * fs + s.V * rs) * SPD;
  const ae = w.e - ve, as = w.s - vs, A2 = ae * ae + as * as;
  const from = bearingOf(-ae, -as);                                       // where the apparent wind comes from
  const rel = turnDiff(from, s.H), beta = (Math.abs(rel) / TURN) * 360;
  const side = rel > 0 ? 1 : -1;                                          // from starboard: pushed to port
  const c = polar(beta, h.luff), q = (0.5 * GIVEN.RHO_AIR * h.sail * A2) / h.mass;
  const heelCos = Math.cos((s.Th / TURN) * TAU);
  return { drive: q * c.x * heelCos, side: -side * q * c.y * heelCos, heel: -side * q * c.y * VISION.HEEL_GAIN, beta, apparent: Math.sqrt(A2) };
}
/** The water's drag on her forward speed (m/s^2, along her motion). */
export function waterDrag(v, h) {
  const a = Math.abs(v), Fr = a / h.hullSpeed;
  const skin = 0.5 * GIVEN.RHO_WATER * h.wetted * VISION.CF * a * a * (1 + Fr ** 4) / h.mass;   // given: wave-making rises as the fourth power of Froude's number past the limit
  return Math.sign(v) * skin;
}

const G_MC = GIVEN.G * GIVEN.TICKS_PER_S * GIVEN.TICKS_PER_S;      // derived: Minecraft's gravity, m/s^2 (32): the waves move under it

/**
 * The sea on the hull: the hull as a rigid body riding the real surface (sea.js trains) at HULL_POINTS
 * stations along its length. Its heave is their mean and its pitch their slope (least squares), so a
 * hull rides waves longer than itself and averages out shorter ones: the transfer falls out of the
 * geometry. The bow slams where the water falls below its keel, and ships green water where the sea
 * stands above its rail. Added resistance in waves grows with the square of their height, as the
 * beam squared over the length (the naval architects' scaling), worst head to sea.
 */
// The sea state round a boat changes slowly: its wave trains are built once a breath (8 ticks) for the
// chunk it's in, and only sampled in between (the surface itself still moves every tick)
const trainCache = new Map();
function trainsNear(x, z, t) {
  const key = `${Math.floor(x / GIVEN.CHUNK)},${Math.floor(z / GIVEN.CHUNK)},${Math.floor(t / VISION.TRAIN_EVERY)}`;
  let w = trainCache.get(key);
  if (!w) { w = wavesAt(x, z, Math.floor(t / VISION.TRAIN_EVERY) * VISION.TRAIN_EVERY); trainCache.set(key, w); if (trainCache.size > VISION.TRAIN_CACHE) trainCache.delete(trainCache.keys().next().value); }
  return w;
}
export function seaOnHull(s, h, t) {
  const f = fold(s.X / Q, s.Z / Q), heading = s.H / TURN * TAU + (f.sheet ? Math.PI : 0);
  const w = trainsNear(f.x, f.z, t), fe = Math.sin(heading), fs = -Math.cos(heading), n = VISION.HULL_POINTS;
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * h.L; pts.push([a, surface(w.trains, f.x + fe * a, f.z + fs * a, t)]); }
  const ma = pts.reduce((x, p) => x + p[0], 0) / n, me = pts.reduce((x, p) => x + p[1], 0) / n;
  const pitch = pts.reduce((x, p) => x + (p[0] - ma) * (p[1] - me), 0) / pts.reduce((x, p) => x + (p[0] - ma) ** 2, 0);
  const bowAt = me + pitch * (h.L / 2), bowSea = pts[n - 1][1];
  const freeboard = h.draught * (VISION.HULL_DEPTH - 1);
  const towardWaves = Math.atan2(w.trains[0]?.kx ?? 0, -(w.trains[0]?.kz ?? 1));   // where the waves run
  const head = Math.max(0, -Math.cos(towardWaves - heading));   // 1 head to sea, 0 beam or following
  const raw = VISION.ADDED * GIVEN.RHO_WATER * G_MC * (w.Hs / 2) ** 2 * (h.beam * h.beam) / h.L * (1 - VISION.ADDED_FOLLOW + VISION.ADDED_FOLLOW * head);
  return { heave: me, pitch: Math.atan(pitch), Hs: w.Hs, slam: bowAt - bowSea > h.draught, green: bowSea - bowAt > freeboard, added: raw / h.mass, head };
}

/** The ops of one tick. ctx: { t, helm (-1..1, + starboard), sail (bool), h (hull), waves (bool: the sea's surface felt; near a player) }. */
export const OPS = [
  { record: "U", name: "wind and water on U", by: (s, c) => {
    const drive = c.sail ? (c.sf = sailForce(s, c.h, c.t)).drive : 0;   // records may share this tick's reading (their value is kept)
    const v = s.U * SPD, sea = c.waves ? (c.sea ??= seaOnHull(s, c.h, c.t)) : null;   // one reading of the sea a tick, shared
    const added = sea ? Math.sign(v) * Math.min(Math.abs(v) * GIVEN.TICKS_PER_S, sea.added) : 0;   // added resistance never reverses her
    return -Math.round((drive - waterDrag(v, c.h) - added) * ACC) + Math.round(s.U * VISION.SKIN);
  } },
  { record: "V", name: "the keel on V", by: (s, c) => {
    const side = c.sail ? (c.sf ?? sailForce(s, c.h, c.t)).side : 0;
    return -Math.round(side * ACC) + Math.round(s.V * VISION.KEEL_GRIP);
  } },
  { shear: "Wr", name: "roll toward the heel", by: (s, c) => {
    const deg = c.sail ? Math.max(-VISION.HEEL_MAX, Math.min(VISION.HEEL_MAX, sailForce(s, c.h, c.t).heel)) : 0;
    return Math.round(c.h.omega2 * ((deg / 360) * TURN - s.Th));
  } },
  { shear: "Th", name: "heel", by: (s) => s.Wr },
  { record: "Wr", name: "roll damping", by: (s) => Math.round(s.Wr * VISION.ROLL_DAMP) },
  { shear: "R", name: "the rudder", by: (s, c) => Math.round(VISION.TURN_DAMP * ((c.helm * s.U) / Q / (VISION.TURN_RADIUS_L * c.h.L)) * (TURN / TAU)) },
  { record: "R", name: "turn damping", by: (s) => Math.round(s.R * VISION.TURN_DAMP) },
  { shear: "H", name: "heading", by: (s) => s.R, mod: TURN },
  { shear: "X", name: "east", by: (s) => {
    const zs = zSide(s.Z), m = VISION.GLOBE_METRIC ? metric(zs.z) : 1;
    const along = mulQ(s.U, sinQ(s.H)) + mulQ(s.V, cosQ(s.H));
    const cur = Math.round(currentEast(zs.z) * Q) * (zs.sheet ? -1 : 1);
    return Math.round((along + cur) / m);
  } },
  { shear: "Z", name: "south", by: (s) => -mulQ(s.U, cosQ(s.H)) + mulQ(s.V, sinQ(s.H)) },
  { record: "Wear", name: "the sea's wear on the hull", by: (s, c) => {
    if (!c.waves) return -Math.round(VISION.WEAR.SAIL * Math.abs(s.U) * SPD * Q);
    const sea = c.sea ?? seaOnHull(s, c.h, c.t);
    return -Math.round((VISION.WEAR.SAIL * Math.abs(s.U) * SPD + (sea.slam ? VISION.WEAR.SLAM : 0) + (sea.green ? VISION.WEAR.GREEN : 0)) * Q);
  } },
];
export const KEYS = ["X", "Z", "H", "U", "V", "R", "Th", "Wr", "Wear"];

/** A boat at a world point (blocks), heading (degrees, 0 north), on the near sheet. */
export function boatAt({ x, z, heading = 0, L = 8, rig = "square", keep } = {}) {   // vision: a working boat, eight blocks
  return { X: Math.round(x * Q), Z: Math.round(z * Q), H: Math.round((mod(heading, 360) / 360) * TURN), U: 0, V: 0, R: 0, Th: 0, Wr: 0, Wear: 0, wake: [], lost: 0, keep, h: hull(L, rig) };
}
/** What the game sees: the world point, heading (degrees), speed (m/s), heel (degrees). */
export function project(s, t = null) {
  const f = fold(s.X / Q, s.Z / Q), sea = t === null ? null : seaOnHull(s, s.h, t);
  return { x: f.x, z: f.z, sheet: f.sheet, heading: (mod(s.H + (f.sheet ? HALF : 0), TURN) / TURN) * 360,
    speed: Math.hypot(s.U, s.V) * SPD, heel: (turnDiff(s.Th, 0) / TURN) * 360, wear: s.Wear / Q,
    ...(sea ? { heave: sea.heave, pitch: (sea.pitch * 180) / Math.PI, slam: sea.slam, green: sea.green, Hs: sea.Hs } : {}) };
}
export { W, D };

// ---------------------------------------------------------------- the trials (tools/boatsim.mjs)
// The same laws, held still: a hull's steady speed under sail at each angle to the wind, under its crew's own
// power, how far the wind lays her over, and what that makes of a hop and a voyage. Pure; nothing steps.
import { PHI } from "./golden.js";
export const TRIAL = Object.freeze({
  PULL: { oars: 100, paddles: 70, poles: 50 },   // given: watts a hand keeps up for hours: a rower, a paddler, a poler (the sport physiologists' sustained figures)
  PULL_EFF: { oars: 0.6, paddles: 0.5, poles: 0.4 },   // given: the share the blade or pole turns into thrust (the propulsion studies')
  RIGS: { norse: "square", european: "square", therans: "square", japanese: "square", indian_ocean: "fore_and_aft", east_asian: "fore_and_aft", pacific: "fore_and_aft", arctic: "square" },   // given: the lateen, the lug and the crab claw point higher; the rest are square sails
  TWIN: { outrigger: 0.5, "voyaging canoe": 1, drua: 1 },   // given: the Pacific's hulls stand on a second hull (the double canoe, the drua) or an outrigger's float (about half the lever)
  SPREAD: PHI * PHI,        // vision: a twin's hulls a beam times phi squared apart, centre to centre
  KG: 0.62,                 // vision: a laden hull's centre of gravity as a share of its depth (ballast and cargo low, crew and gear high)
  CE: 0.42,                 // vision: a sail's centre of effort as a share of the mainmast over the deck
  WINDS: [4, 7, 11],        // vision: m/s: a light breeze, the trades' working wind, a fresh breeze
});

/** A people's hull from its measure (world/boatsizes.js): its own proportions, the same laws as hull(). */
export function hullOf({ L, lb, flat = false, full = VISION.HULL.CB, rig = "square", pull = null, pullers = 0, mast = 0, twin = 0, depth: built = null }) {
  const beam = L / lb, depth = built ?? beam / (flat ? PHI * PHI : PHI), draught = depth / PHI, vol = L * beam * draught * full;   // derived: a built hull keeps its own depth   // derived: boatsizes' proportions (a flat hull a step shallower)
  const mass = vol * GIVEN.RHO_WATER, wetted = 2.6 * Math.sqrt(vol * L);   // given: Denny's wetted surface
  const hullSpeed = VISION.HULL_FROUDE * Math.sqrt(GIVEN.G * L) * GIVEN.TICKS_PER_S;
  const cwp = (1 + 2 * full) / 3, kb = draught * (5 / 6 - full / (3 * cwp)), bm = (cwp * beam * beam) / (12 * draught * full);   // given: the waterplane's usual fullness; Morrish's centre of buoyancy; the metacentre over it (a box's B^2/12T, by fullness)
  const spread = TRIAL.SPREAD * beam, bmTwin = twin * (cwp * spread * spread) / (4 * draught * full);   // given: two hulls' waterplanes a spread apart: (s/2)^2 over the draught, by fullness
  const gm = kb + bm + bmTwin - TRIAL.KG * depth;
  return { L, rig, beam, depth, draught, vol, mass, wetted, hullSpeed, gm, mast, sail: mast ? VISION.SAIL_AREA * L * L : 0, luff: VISION.RIG[rig]?.luff ?? VISION.RIG.square.luff, pull, pullers };
}

const bisect = (f, lo, hi) => { for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; } return (lo + hi) / 2; };   // given: sixty halvings, past a double's precision
const G_GAME = GIVEN.G * GIVEN.TICKS_PER_S * GIVEN.TICKS_PER_S;   // derived: the game's gravity, m/s^2
const FROUDE = Math.sqrt(G_GAME / GIVEN.EARTH_G);   // derived: the game's speeds over the Earth's for the same hull (about 1.8)

/** The sail's push at boat speed v, true wind W (m/s) twa degrees off the bow: along and across (m/s^2), and the apparent angle. */
export function sailPush(h, W, twa, v) {
  const r = (twa * Math.PI) / 180, af = W * Math.cos(r) + v, as = W * Math.sin(r);   // given: degrees to radians; the apparent wind, where it comes from, in the boat's frame
  const beta = (Math.atan2(as, af) * 180) / Math.PI, c = polar(beta, h.luff), q = (0.5 * GIVEN.RHO_AIR * h.sail * (af * af + as * as)) / h.mass;
  return { along: q * c.x, across: q * c.y, beta };
}
/** How far the side push lays her over (degrees), and whether she stands it. */
export function heelOf(h, across) {
  if (!h.mast) return { heel: 0, stands: true };
  const arm = TRIAL.CE * h.mast + (h.depth - h.draught) + h.draught / 2;   // derived: the sail's centre over the deck, the freeboard, half the draught to the keel's grip
  if (h.gm <= 0) return { heel: 90, stands: false };   // vision: tender past standing: she needs her outrigger, her twin hull or ballast
  const s = (across * h.mass * arm) / (h.mass * G_GAME * h.gm);
  return s >= 1 ? { heel: 90, stands: false } : { heel: (Math.asin(s) * 180) / Math.PI, stands: (Math.asin(s) * 180) / Math.PI <= VISION.HEEL_MAX };
}
/** Steady speed under sail at twa off the bow in a true wind W, the sheet eased past HEEL_MAX (m/s). */
export function sailSpeed(h, W, twa) {
  if (!h.sail) return 0;
  const net = (v) => { const p = sailPush(h, W, twa, v), e = heelOf(h, p.across), ease = e.stands ? 1 : VISION.HEEL_MAX / Math.max(e.heel, VISION.HEEL_MAX); return p.along * ease * Math.cos((Math.min(e.heel, VISION.HEEL_MAX) * Math.PI) / 180) - waterDrag(v, h); };   // given: degrees to radians
  return net(0) <= 0 ? 0 : bisect(net, 0, 2 * h.hullSpeed);
}
/** Steady speed under her crew's own power (m/s). */
export function pullSpeed(h) {
  if (!h.pull || !h.pullers) return 0;
  const P = h.pullers * TRIAL.PULL[h.pull] * TRIAL.PULL_EFF[h.pull] * FROUDE ** 3;   // derived: a hand's watts, Froude-scaled to the game's gravity (as the hull speed and the waves are): a similar crew in a world of g' pulls a similar hull sqrt(g'/g) faster, and power goes as speed cubed
  return bisect((v) => P / v / h.mass - waterDrag(v, h), 1e-6, 2 * h.hullSpeed);   // given: a speed above none
}
/** Her best speed made good along a course c degrees off the wind: any sailing angle within a quarter turn of it (tacking, gybing), or her crew's pull. */
export function madeGood(h, W, c, polarRow) {
  let best = pullSpeed(h);
  for (const [a, v] of polarRow) { const d = Math.abs(a - c); if (d < 90) best = Math.max(best, v * Math.cos((d * Math.PI) / 180)); }   // given: degrees to radians
  return best;
}
/** The whole trial of a hull: its polar, its pull, its stability, and its mean speed over every course. */
export function trial(h, winds = TRIAL.WINDS, step = 15) {   // vision: the polar's angles a twenty-fourth of a turn apart
  const angles = Array.from({ length: Math.floor(180 / step) + 1 }, (_, i) => i * step);
  const pull = pullSpeed(h), out = { hullSpeed: h.hullSpeed, pull, gm: h.gm, mass: h.mass, winds: [] };
  for (const W of winds) {
    const row = angles.map((a) => [a, sailSpeed(h, W, a)]), mean = angles.reduce((s, c) => s + madeGood(h, W, c, row), 0) / angles.length;
    const beam = sailPush(h, W, 90, row.find(([a]) => a === 90)?.[1] ?? 0), heel = heelOf(h, beam.across);   // vision: the beam reach, where the side push is most
    const upwind = row.reduce((b, [a, v]) => Math.max(b, v * Math.cos((a * Math.PI) / 180)), 0);   // given: degrees to radians
    out.winds.push({ W, polar: row, mean, upwind, heel: heel.heel, stands: heel.stands });
  }
  if (h.sail) out.reef = bisect((W) => (heelOf(h, sailPush(h, W, 90, 0).across).stands ? 1 : -1), 0, 60);   // given: a wind past any gale (m/s); the wind at which, abeam, she lays over past HEEL_MAX and must reef
  return out;
}
