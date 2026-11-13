// Pure. The pantheon: the nine who run the sim, and the web between them, all read off the one law (design doc
// "The Pantheon: the sim's nine agents and the web between them", reviewed by Richard 2026-11-13; D-008).
//
//   the nine     F = [[1,1],[1,0]] on a pair of trits (a, b) mod 3 (field.js). Its nine states fall into two
//                orbits: (0,0), which F holds still (the Measure), and the other eight in one cycle as long as the
//                Pisano period mod 3 (clock.js's breath). Each of the eight is a god; its slot is its place in the
//                cycle read from (1,0), the Builder. F^4 = -I, so a god's opposite, -v, is half a breath on
//   the axes     a is where a god acts (-1 the sea, 0 the peoples, +1 the land); b what it does to the world's stock
//                (-1 takes, 0 holds, +1 gives). A god that holds shears (reversible.js: undone with no memory); one
//                that gives or takes records (the wake keeps what moved); the Measure is the frame and only reads
//   the turn     the god at tick t is slot t mod the breath; the Measure audits at the breath's close
//   reactions    an entry written by v is answered by F.v on the next tick, at most psi^k of its cause after k hops,
//                psi = -1/phi (F's contracting eigenvalue): a disturbance settles to phi^-8 within one breath. In whole
//                units an answer is round(cause x psi), which from a Fibonacci number is the one below it (Binet:
//                F(n) psi = psi^n - F(n-1)); the roundings drift at most phi^2/2 in all. A god that holds may only move
//                its own stock: on another's it lets its tick pass, and the next god answers at psi^2
//   bounds       a stock lives in [0, room], starting at room / phi; what does not fit either end is a debt to the
//                writer's opposite. Chance is drawOf(tick, purpose): one god a tick, so the tick is its stream
//   conflicts    one god a tick, so no two writes at once; records are deltas, so they commute; an overflow is a
//                debt to the writer's opposite, always; claims on one cell add as vectors: claims that sum to the
//                still point cancel (the cell stays as it is), any other set goes to the earliest slot from the
//                breath's lead, the lead turning a slot a breath so every god leads once in eight (gates.js's rule,
//                ties to the first listed, F's order the list); what is left over is the Measure's at the year's end
//   the wake     every change is one entry of a fixed size (the codec below): tick, god and op, key, amount,
//                cause, gate. Who answers it, who it is owed to and who audits it are computed, never stored
import { bal } from "./field.js";
import { PHI } from "./golden.js";
import { hashAt } from "./noise.js";

/** F on a trit pair, and its inverse F^-1 = [[0,1],[1,-1]]. */
export const Fv = ([a, b]) => [bal(a + b), bal(a)];
export const Finv = ([a, b]) => [bal(b), bal(a - b)];
const same = (u, v) => u[0] === v[0] && u[1] === v[1];
export const vkey = (v) => `${v[0]},${v[1]}`;

// the cycle, read from the first unit vector (the Builder: land, holds)
const START = Object.freeze([1, 0]);
export const ORBIT = (() => { const out = [START]; for (let v = Fv(START); !same(v, START); v = Fv(v)) out.push(Object.freeze(v)); return Object.freeze(out); })();
export const BREATH = ORBIT.length;   // derived: F's cycle on the eight non-zero pairs (8, the Pisano period mod 3; the lens holds it to clock.js)

// who each is: a title for what it does, a Greek sea-power's name (each people names its own counterpart at its shrines)
const ROLE = {   // vision: the titles and names (The Pantheon, "The nine, named")
  "0,0": ["measure", "the Measure", "Nereus"],
  "1,0": ["builder", "the Builder", "the Kabeiroi"],
  "1,1": ["grower", "the Grower", "Aristaeus"],
  "-1,1": ["bounty", "the Bounty", "Amphitrite"],
  "0,-1": ["reaper", "the Reaper", "Diktynna"],
  "-1,0": ["mover", "the Mover", "Oceanus"],
  "-1,-1": ["toll", "the Toll", "Poseidon"],
  "1,-1": ["unmaker", "the Unmaker", "the Telchines"],
  "0,1": ["trader", "the Trader", "Melikertes"],
};
const WHERE = { [-1]: "sea", 0: "peoples", 1: "land" }, ACT = { [-1]: "takes", 0: "holds", 1: "gives" };
const godOf = (v, slot, op) => { const [key, title, name] = ROLE[vkey(v)]; return Object.freeze({ slot, v, key, title, name, where: WHERE[v[0]], act: ACT[v[1]], op }); };
/** The nine: the eight in slot order, then the Measure (its slot is the breath's close). */
export const GODS = Object.freeze([...ORBIT.map((v, slot) => godOf(v, slot, v[1] === 0 ? "shear" : "record")), godOf(Object.freeze([0, 0]), BREATH, "frame")]);
export const MEASURE = GODS[BREATH];
export const godByKey = Object.freeze(Object.fromEntries(GODS.map((g) => [g.key, g])));
export const godByV = (v) => GODS.find((g) => same(g.v, v)) ?? null;

// ---- the turn
/** The slot acting at tick t. */
export const slotAt = (t) => ((t % BREATH) + BREATH) % BREATH;
export const godAt = (t) => GODS[slotAt(t)];
/** Does the breath close after tick t (the Measure's audit)? */
export const closesBreath = (t) => slotAt(t) === BREATH - 1;

// ---- the web: three edges, all computed
/** The reaction: F.v, the god that answers g on the next tick. The Measure answers itself. */
export const next = (g) => (g === MEASURE ? MEASURE : GODS[(g.slot + 1) % BREATH]);
export const prev = (g) => (g === MEASURE ? MEASURE : GODS[(g.slot + BREATH - 1) % BREATH]);
/** The counter: -v, half a breath on (F to the fourth is -I); its ledger is the pair's, and it takes the god's debts. */
export const opposite = (g) => (g === MEASURE ? MEASURE : GODS[(g.slot + BREATH / 2) % BREATH]);
export const debtTo = opposite;
/** Who reads an entry g wrote: the next god, its opposite, and the Measure at the breath's close. */
export const readersOf = (g) => [next(g), opposite(g), MEASURE];

// ---- reactions: bounded by F's contracting eigenvalue
export const PSI = -1 / PHI;   // derived: F's second eigenvalue
/** The most a reaction k hops from its cause may move, for a cause of size d (signed: it alternates). */
export const reactionBound = (d, k) => d * PSI ** k;
export const SETTLE = Math.abs(PSI) ** BREATH;   // derived: what is left of a disturbance after one breath (phi^-8, about 2.1%)
export const NET = (1 - PSI ** BREATH) / (1 - PSI);   // derived: an act and its answers round one breath, net (about 0.605)
export const SLACK = PHI ** 2 / 2;   // derived: the most whole-unit roundings drift from the bound (half a unit a hop, shrinking by psi: 1/2 x 1/(1 - 1/phi))
/** The answer in whole units to a cause of d, or 0 when the chain ends (an answer must be smaller than its cause). */
export const answerOf = (d) => { const a = Math.round(d * PSI); return a && Math.abs(a) < Math.abs(d) ? a : 0; };
/** May god g answer on stock key (a stock is owned by the god of its slot)? A holder only on its own. */
export const mayWrite = (g, key) => g.op === "record" || key === g.slot;

// ---- bounds and chance
/** A stock's room: it starts at the golden section of it, so the room to give and the room to take stand as 1 to phi. */
export const roomOf = (s0) => Math.round(s0 * PHI);
/**
 * Write d on a stock s held in [0, room]: the part that fits, and the rest, a debt to the writer's opposite. Both ends
 * bound it: with the floor alone a stock is a walk reflected at zero, and it climbs as the root of its writes.
 */
export const fitWrite = (s, d, room) => { const put = Math.min(Math.max(d, -s), room - s); return { put, short: d - put }; };
/** A draw in [0, 1) for the god at tick t and a purpose: one god a tick, so the tick is the god's own stream. */
export const drawOf = (t, purpose) => hashAt(t, purpose);

// ---- conflicts on a cell's use: claims are vectors
/** The lead slot in breath b: it turns a slot a breath, so every god leads once in eight. */
export const leadOf = (b) => slotAt(b);
/**
 * Resolve the claims on one cell made in breath b: [{ slot }], each claim its god's vector. Claims that sum to the
 * still point cancel and the cell is held as it is (a god and its opposite, or any balanced set); otherwise the
 * earliest slot from the breath's lead wins. Returns { held, winner, why }.
 */
export function resolveClaims(claims, b = 0) {
  if (!claims.length) return { held: true, winner: null, why: "no claim" };
  const sum = claims.reduce((s, c) => [bal(s[0] + GODS[c.slot].v[0]), bal(s[1] + GODS[c.slot].v[1])], [0, 0]);
  if (same(sum, MEASURE.v)) return { held: true, winner: null, why: "the claims sum to the still point: the cell stays as it is" };
  const lead = leadOf(b), rank = (c) => (c.slot - lead + BREATH) % BREATH;
  const winner = [...claims].sort((p, q) => rank(p) - rank(q))[0];
  return { held: false, winner, why: `the earliest slot from the breath's lead (${GODS[lead].title}): ${GODS[winner.slot].title}` };
}

// ---- the wake: one entry a change, a fixed size
export const FIELDS = Object.freeze([["t", 4], ["godop", 2], ["key", 4], ["d", 4], ["cause", 4], ["gate", 2]]);   // given: an Int32 is four bytes, an Int16 two
const WIDTH = Object.fromEntries(FIELDS), OFFSET = {};
let at = 0; for (const [k, n] of FIELDS) { OFFSET[k] = at; at += n; }
export const ENTRY_BYTES = at;   // derived: the fields' widths summed (20)
const GOD_BITS = Math.ceil(Math.log2(GODS.length));   // derived: the bits that name one of nine (4)
const OPS = ["shear", "record"];   // the op bit: a shear 0, a record 1 (the Measure writes nothing)
const put = (view, o, k, v) => (WIDTH[k] === 2 ? view.setInt16(o + OFFSET[k], v, true) : view.setInt32(o + OFFSET[k], v, true));   // little-endian, as the game's typed arrays
const get = (view, o, k) => (WIDTH[k] === 2 ? view.getInt16(o + OFFSET[k], true) : view.getInt32(o + OFFSET[k], true));
/** A wake of n entries' room. */
export const wakeOf = (n) => new DataView(new ArrayBuffer(n * ENTRY_BYTES));
/** Write entry i: { t, slot, op, key, d, cause (-1: a first act), gate }. */
export function encodeEntry(view, i, e) {
  if (e.slot === MEASURE.slot) throw new Error("the Measure reads; it writes no entry");
  if (GODS[e.slot]?.op !== e.op) throw new Error(`${GODS[e.slot]?.title ?? `slot ${e.slot}`} may only ${GODS[e.slot]?.op ?? "act as a god"}: an act is typed by its writer`);
  const o = i * ENTRY_BYTES;
  put(view, o, "t", e.t); put(view, o, "godop", e.slot | (OPS.indexOf(e.op) << GOD_BITS)); put(view, o, "key", e.key);
  put(view, o, "d", e.d); put(view, o, "cause", e.cause ?? -1); put(view, o, "gate", e.gate ?? 0);
}
/** Read entry i back. */
export function decodeEntry(view, i) {
  const o = i * ENTRY_BYTES, godop = get(view, o, "godop"), slot = godop & ((1 << GOD_BITS) - 1);
  return { t: get(view, o, "t"), slot, op: OPS[godop >> GOD_BITS], key: get(view, o, "key"), d: get(view, o, "d"), cause: get(view, o, "cause"), gate: get(view, o, "gate") };
}
